"""v4.07.2 定向复验：对广度旅程中被判失败的步骤，用【修复后的判定器】离线重判。

背景：广度旅程（38 界 × 3 步 = 114 次真实模型调用）跑完后有 8 步被判定为有问题。
其中 7 步经核为判定器口径问题（合法专名未进名单 / 语法性误报），
1 步（scifi act2）是真实产品缺陷（正文被选项段剥离规则整段吞掉）。

本脚本做两件事：
  ① 在浏览器里采集相关界的合法专名集（names），落盘 /tmp/yj_names.json
  ② 用【当前】的 judge() 离线重判这些步骤的落盘正文，验证判定器修正是否生效

零模型调用。
"""
import asyncio, json, os, re, sys, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("tp", os.path.join(ROOT, "yunjing-test", "scripts", "t_player.py"))
# t_player 末尾会 asyncio.run(main())，这里只取到 def judge 之前的部分
src = open(os.path.join(ROOT, "yunjing-test", "scripts", "t_player.py"), encoding="utf-8").read()
head = src.split("async def main(")[0]
TP = {}
exec(head, TP)
judge = TP["judge"]

TARGET_GENRES = ["free", "guzhenren", "longzu", "quanzhifashi", "wudongqiankun", "wangyou", "scifi", "freeworld"]

COLLECT_JS = """(g)=>{
  const out={places:[],factions:[],items:[],chars:[]};
  try{
    const A=window.ATLAS_DATA&&window.ATLAS_DATA[g];
    if(A) (A.layers||[]).forEach(L=>{(L.nodes||[]).forEach(n=>{
      out.places.push(n.n); (n.aliases||[]).forEach(x=>out.places.push(x));});});
  }catch(e){}
  try{
    const W=window.RPGCore&&window.RPGCore.WORLD&&window.RPGCore.WORLD[g];
    if(W){ (W.factions||[]).forEach(f=>out.factions.push(f.n||f));
           (W.monsters||[]).forEach(m=>out.items.push(m));
           (W.materials||[]).forEach(m=>out.items.push(m));
           (W.classes||[]).forEach(c=>out.items.push(c));
           (W.hidden||[]).forEach(c=>out.chars.push(c.n)); }
  }catch(e){}
  try{
    const N=window.KB_NAMES&&window.KB_NAMES[g];
    if(N){ (N.places||[]).forEach(x=>out.places.push(x));
            (N.factions||[]).forEach(x=>out.factions.push(x));
            (N.arts||[]).forEach(x=>out.items.push(x));
            (N.people||[]).forEach(x=>out.chars.push(x)); }
  }catch(e){}
  try{
    const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[];
    K.slice(0,4000).forEach(e=>{
      const t=String(e.title||''); const parts=t.split('·');
      const last=parts[parts.length-1]||'';
      if(parts.length>=3){ if(/人物|角色|NPC/i.test(parts[1])) out.chars.push(last); else out.places.push(last); }
    });
    const FAC_RE=/([一-鿿A-Za-z0-9]{2,12}(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟))/g;
    K.slice(0,1200).forEach(e=>{
      const txt=String(e.title||'')+' '+String(e.content||'').slice(0,3000);
      let mm; FAC_RE.lastIndex=0;
      while((mm=FAC_RE.exec(txt))) if(mm[1]) out.factions.push(mm[1]);
    });
    let kb='';
    K.forEach(e=>{ kb += String(e.title||'')+' '+String(e.content||'')+'\\n'; });
    out.kbText=kb.slice(0,400000);
  }catch(e){}
  return out;
}"""

async def collect():
    from playwright.async_api import async_playwright
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        pg = await b.new_page()
        for g in TARGET_GENRES:
            try:
                await pg.goto("http://127.0.0.1:8899/studio.html?genre=%s" % g,
                             wait_until="domcontentloaded", timeout=45000)
                # 等本界知识库加载完成且条目数稳定（KB 是分批懒加载的，
                # 采集太早会只拿到一部分 —— 「铁算盘商会」就因此漏掉过）
                last, stable, kb = -1, 0, -1
                for _ in range(40):
                    cur = await pg.evaluate("(g)=>{ const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[]; return K.length; }", g)
                    kb2 = await pg.evaluate("(g)=>{ const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[]; return K.reduce((n,e)=>n+String(e.content||'').length,0); }", g)
                    if cur == last and cur > 0 and kb2 == kb and kb2 > 0:
                        stable += 1
                        if stable >= 3:
                            break
                    else:
                        stable = 0
                    last, kb = cur, kb2
                    await pg.wait_for_timeout(600)
                await pg.wait_for_timeout(1200)
                out[g] = await pg.evaluate(COLLECT_JS, g)
                print("  %-16s places=%-4d factions=%-4d items=%-4d chars=%-3d kbText=%-7d" % (
                    g, len(out[g]["places"]), len(out[g]["factions"]), len(out[g]["items"]),
                    len(out[g]["chars"]), len(out[g].get("kbText") or "")))
            except Exception as e:
                print("  %-16s 采集失败: %s" % (g, str(e)[:80]))
        await b.close()
    return out

def rejudge(names):
    d = json.load(open("/tmp/yj_journey.json", encoding="utf-8"))
    issues = d.get("issues") or []
    print("\n=== 离线重判（原判定器判失败的步骤）===")
    fixed, remain = [], []
    for it in issues:
        g, s = it.get("genre"), it.get("step")
        f = "/tmp/yj_journey_%s_%s.txt" % (g, s)
        if not os.path.exists(f):
            print("  %-16s %-10s （无落盘正文，跳过）" % (g, s)); continue
        txt = open(f, encoding="utf-8").read()
        snap = it.get("snap") or {}
        nm = names.get(g) or {"places": [], "factions": [], "items": [], "chars": []}
        bad, _ = judge(txt, snap, nm, g)
        old = json.dumps(it.get("bad") or {}, ensure_ascii=False)
        new = json.dumps(bad, ensure_ascii=False)
        if not bad:
            print("  %-16s %-10s ✓ 复判通过（原判 %s）" % (g, s, old[:80]))
            fixed.append({"genre": g, "step": s, "old": it.get("bad")})
        else:
            print("  %-16s %-10s ✗ 仍有问题 %s" % (g, s, new[:120]))
            remain.append({"genre": g, "step": s, "bad": bad, "snap": snap})
    print("\n复判：原问题 %d 条 → 消解 %d 条，仍有 %d 条" % (len(issues), len(fixed), len(remain)))
    json.dump({"fixed": fixed, "remain": remain}, open("/tmp/yj_rejudge.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return remain

if __name__ == "__main__":
    cache = "/tmp/yj_names.json"
    if os.path.exists(cache) and "--refresh" not in sys.argv:
        names = json.load(open(cache, encoding="utf-8"))
        print("复用已采集名单:", list(names.keys()))
    else:
        print("=== 采集合法专名集 ===")
        names = asyncio.run(collect())
        json.dump(names, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
    remain = rejudge(names)
    if remain:
        print("\n仍需定向重跑的步骤:", [(r["genre"], r["step"]) for r in remain])
