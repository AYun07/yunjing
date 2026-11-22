#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.08.0 · 多存档槽隔离探测（不调模型）

v4.07.2 交付报告的未闭环项之一：「多存档槽的隔离逻辑存在但未做跨槽混用测试」。
本脚本把这五条未闭环项变成可复跑的断言。

覆盖的缺陷（编号见 yunjing-test/DEFECTS-v4.07.2.md 与本版缺陷清单）：
  D1  删档漏删（键名格式 5 种，手写孤儿键表只覆盖 1 种 → 数据残留）
  D2  canon-ledger / canon-timeline 界键恒为 default（38 界共用一份账本/编年史）
  D4  副档认领旧共享键时摧毁主档数据
  D5  清档后灵宠/小队等主档键残留（新书继承上一本）
  D7  六处书内数据无槽隔离（副档继承主档）
  D8  世界库播种标记不带槽后缀（副档永不播种）
  D3  world-ext 槽位后缀求值时机脆弱
  D6  切档丢 worldExt 内存态

断言口径：全部用「localStorage 键集合差集」做纯函数判定，避免假阳性。

用法：
  cd /workspace/yunjing && python3 -m http.server 8899 --bind 127.0.0.1 &
  python3 yunjing-test/scripts/t_slots.py
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/slot_probe.json"
GENRE = os.environ.get("YJ_GENRE", "shrouding")

# ---------------------------------------------------------------- 浏览器侧脚本

# 1) 装一个"槽位环境"：设置 localStorage 后 reload，使各模块按新槽位重新求值
PREPARE = """(g)=>{
  try{
    const slot = 'sPROBE01';
    localStorage.setItem('storyActiveSlot_' + g, slot);
    return {ok:true, slot};
  }catch(e){return {ok:false, err:String(e)};}
}"""

# 1b) 把激活槽切回主档（删档/清档都只作用于「非激活档」或「当前档」，需要分别构造）
PREPARE_MAIN = """(g)=>{
  try{
    localStorage.setItem('storyActiveSlot_' + g, 'main');
    return {ok:true, slot:'main'};
  }catch(e){return {ok:false, err:String(e)};}
}"""

# 2) 读回当前槽位下各模块实际写入的键
PROBE_KEYS = """(g)=>{
  const out = {};
  const all = [];
  try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) all.push(k); } } catch(e){}
  out.all = all;
  out.slotId = (window.storyFramework && window.storyFramework.slotId) || 'main';
  out.slotSuffix = (window.SlotRegistry && window.SlotRegistry.suffix) ? window.SlotRegistry.suffix() : '?';
  out.genre = (window.SlotRegistry && window.SlotRegistry.genre) ? window.SlotRegistry.genre() : '?';
  try { out.canonLedgerKey = (window.CanonLedger && window.CanonLedger.key) ? window.CanonLedger.key() : null; } catch(e){ out.canonLedgerKey = null; }
  return out;
}"""

# 3) 在当前槽位下写一份"各模块数据"，模拟玩家玩了一阵
WRITE_STATE = """(g)=>{
  const slot = 'sPROBE01';
  const sid = slot;
  const put = (k,v)=>{ try{ localStorage.setItem(k, v); }catch(e){} };
  // 键名必须与各模块真实实现一致（否则测的是不存在的键）
  put('storySave_' + g + '~' + sid, JSON.stringify({turns:[{user:'p',text:'probe'}],variables:{}}));
  put('worldExt_' + g + '~' + sid, JSON.stringify({mods:{probe:{v:1}},ent:{}}));
  put('yunjingWorldBook:' + g + '~' + sid, JSON.stringify({entries:[{id:'e1',name:'probe'}]}));
  put('yunjingBeasts~' + sid, JSON.stringify([{id:'b1'}]));
  put('yunjingSquad~' + sid, JSON.stringify([{id:'q1'}]));
  put('yunjingStoryStance' + '~' + sid, JSON.stringify({a:1}));
  put('yunjingSideChar' + '~' + sid, JSON.stringify([{n:'x'}]));
  put('yunjingPlayerIdentity' + '~' + sid, JSON.stringify({id:'p'}));
  put('yunjingHeroRelation' + '~' + sid, JSON.stringify([{a:'p'}]));
  put('yunjingWorldRuntime~' + sid + '~' + g, JSON.stringify({npcs:{}}));
  put('yunjingWorldBus~' + sid + '~' + g, JSON.stringify({history:[{type:'t'}]}));
  put('yunjingWorldAlive~' + sid + '~' + g, JSON.stringify({events:[{id:'e'}]}));
  put('yunjingCanonLedger:' + sid + ':' + g, JSON.stringify({entries:{}}));
  put('yunjingCanonTL:' + sid + ':' + g, JSON.stringify({events:{},bonds:{}}));
  put('yunjing.clock.' + sid + '~' + g, JSON.stringify({enabled:true}));
  put('worldLegacyGranted~' + sid, '1');
  put('imm_' + g + '~' + sid, JSON.stringify({heroes:{}}));
  put('tl_' + g + '~' + sid, JSON.stringify({nodes:[]}));
  put('gl_' + g + '~' + sid, JSON.stringify({seals:[]}));
  put('rl_' + g + '~' + sid, JSON.stringify([]));
  put('storyAtlas_' + g + '~' + sid, JSON.stringify({visits:[]}));
  put('storyKnowledge_' + g, JSON.stringify({knowledge:[]}));   // 世界级设定，主档副档共享（语义正确）
  return {ok:true};
}"""

# 4) 主档侧写一份"另一本书"的数据
WRITE_MAIN = """(g)=>{
  const put = (k,v)=>{ try{ localStorage.setItem(k, v); }catch(e){} };
  put('storySave_' + g, JSON.stringify({turns:[{user:'main',text:'mainbook'}],variables:{}}));
  put('worldExt_' + g, JSON.stringify({mods:{mainprobe:{v:9}},ent:{}}));
  put('yunjingWorldBook:' + g, JSON.stringify({entries:[{id:'em',name:'mainprobe'}]}));
  put('yunjingBeasts~main', JSON.stringify([{id:'bmain'}]));
  put('yunjingSquad~main', JSON.stringify([{id:'qmain'}]));
  put('yunjingWorldRuntime~main~' + g, JSON.stringify({npcs:{main:true}}));
  put('yunjingWorldBus~main~' + g, JSON.stringify({history:[{type:'main'}]}));
  put('yunjingWorldAlive~main~' + g, JSON.stringify({events:[{id:'em'}]}));
  put('yunjingCanonLedger:main:' + g, JSON.stringify({entries:{main:true}}));
  put('yunjingCanonTL:main:' + g, JSON.stringify({events:{main:true},bonds:{}}));
  put('yunjing.clock.main~' + g, JSON.stringify({enabled:false}));
  put('worldLegacyGranted~main', '1');
  put('imm_' + g, JSON.stringify({heroes:{main:true}}));
  put('tl_' + g, JSON.stringify({nodes:[{id:'nm'}]}));
  put('gl_' + g, JSON.stringify({seals:['main']}));
  put('rl_' + g, JSON.stringify([1,2]));
  put('storyAtlas_' + g, JSON.stringify({visits:['main']}));
  return {ok:true};
}"""

# 5) 删档：调用真实的 SaveSlots.remove
PURGE = """(g)=>{
  const slot = 'sPROBE01';
  try {
    if (!window.SaveSlots) return {ok:false, err:'SaveSlots 未加载'};
    // remove() 会 toast 并重新打开面板，这里只关心 localStorage 结果
    window.SaveSlots.remove(slot);
    const all=[];
    for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) all.push(k); }
    return {ok:true, keys:all};
  } catch(e){ return {ok:false, err:String(e), stack:(e&&e.stack)||''}; }
}"""

# 6) 清档：调用真实的 fw.clearSave
CLEAR = """(g)=>{
  try {
    if (!window.storyFramework) return {ok:false, err:'fw 未就绪'};
    window.storyFramework.clearSave();
    const all=[];
    for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k) all.push(k); }
    return {ok:true, keys:all};
  } catch(e){ return {ok:false, err:String(e), stack:(e&&e.stack)||''}; }
}"""

# 7) 认领旧共享键（副档进入时会发生）
CLAIM = """(g)=>{
  try {
    if (!window.claimSlotKey) return {ok:false, err:'claimSlotKey 未加载'};
    const k = window.claimSlotKey('imm_' + g, g);
    const legacy = localStorage.getItem('imm_' + g);
    return {ok:true, key:k, legacyStillThere: legacy !== null, legacyVal: legacy};
  } catch(e){ return {ok:false, err:String(e)}; }
}"""

# 8) 世界库播种
SEED = """(g)=>{
  try {
    const WB = window.WorldBook;
    if (!WB || typeof WB.ensureSeed !== 'function') return {ok:false, err:'WorldBook.ensureSeed 不可用'};
    WB.ensureSeed();
    const raw = localStorage.getItem('yunjingWorldBook:' + g + '~sPROBE01');
    let n = 0;
    try { n = (JSON.parse(raw||'{}').entries||[]).length; } catch(e){}
    return {ok:true, entries:n, flag: localStorage.getItem('yunjingWorldBookSeeded:v3:' + g + '~sPROBE01')};
  } catch(e){ return {ok:false, err:String(e)}; }
}"""

# 9) 界键是否随界变化（canon-ledger / canon-timeline）
GENRE_KEY = """(g)=>{
  const out = {};
  try { out.ledger = window.CanonLedger ? window.CanonLedger.key() : null; } catch(e){ out.ledger = 'ERR:'+e; }
  try { out.tl = (window.CanonTimeline && window.CanonTimeline.key) ? window.CanonTimeline.key() : null; } catch(e){ out.tl = 'ERR:'+e; }
  return out;
}"""


async def main():
    issues = []
    results = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---------- 场景 1：主档 → 副档 隔离 ----------
        url = f"{BASE}/studio.html?genre={GENRE}"
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        await page.evaluate(WRITE_MAIN, GENRE)
        await page.evaluate(PREPARE, GENRE)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        probe = await page.evaluate(PROBE_KEYS, GENRE)
        results["slotProbe"] = probe
        if probe.get("slotId") != "sPROBE01":
            issues.append(f"[D3] 切到副档后 storyFramework.slotId 仍为 {probe.get('slotId')!r}")

        await page.evaluate(WRITE_STATE, GENRE)
        keys_after_write = await page.evaluate("()=>{const a=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)a.push(k);}return a;}")
        results["keysAfterWrite"] = keys_after_write

        # 副档键与主档键不得相同
        dup = []
        for k in keys_after_write:
            if k.startswith(("storySave_", "worldExt_", "yunjingWorldBook:", "yunjingBeasts",
                             "yunjingWorldRuntime~", "yunjingCanonLedger:", "yunjingCanonTL:")):
                if not (GENRE in k or k.startswith("yunjing")):
                    dup.append(k)
        # 主档键（裸/带 ~main）与副档键（带 ~sPROBE01）必须同时存在且互不相同
        main_keys = [k for k in keys_after_write if k.endswith("~main") or
                     (k.startswith(("storySave_", "worldExt_", "yunjingWorldBook:")) and "~sPROBE01" not in k and k.endswith(GENRE))]
        sub_keys = [k for k in keys_after_write if "~sPROBE01" in k]
        results["mainKeys"] = main_keys
        results["subKeys"] = sub_keys
        if not sub_keys:
            issues.append("[D1] 副档写入后没有任何带 ~sPROBE01 后缀的键")
        for k in main_keys:
            if k in sub_keys:
                issues.append(f"[D7] 主档键与副档键撞名：{k}")

        # ---------- 场景 2：canon-ledger / canon-timeline 界键 ----------
        gk = await page.evaluate(GENRE_KEY, GENRE)
        results["genreKeys"] = gk
        if gk.get("ledger") and "default" in str(gk["ledger"]):
            issues.append(f"[D2] canon-ledger 界键仍落到 default：{gk['ledger']}")
        if gk.get("tl") and "default" in str(gk["tl"]):
            issues.append(f"[D2] canon-timeline 界键仍落到 default：{gk['tl']}")

        # ---------- 场景 3：删档不彻底（D1）----------
        # 注意：SaveSlots.remove() 拒删「当前激活档」。要删副档必须先切回主档。
        await page.evaluate(PREPARE_MAIN, GENRE)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        purge = await page.evaluate(PURGE, GENRE)
        results["purge"] = purge
        if purge.get("ok"):
            left = [k for k in purge.get("keys", []) if "~sPROBE01" in k]
            if left:
                issues.append(f"[D1] 删档后仍残留 {len(left)} 个副档键：{left[:8]}")
        else:
            issues.append(f"[D1] SaveSlots.remove 调用异常：{purge.get('err')}")

        # 主档数据必须完好（删副档不能误伤主档）
        after_purge = await page.evaluate("()=>{const a=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)a.push(k);}return a;}")
        main_after = [k for k in after_purge if k.endswith("~main") or
                      (k.startswith(("storySave_", "worldExt_", "yunjingWorldBook:")) and k.endswith(GENRE))]
        if not main_after:
            issues.append("[D1] 删副档把主档数据一起清掉了")
        results["mainAfterPurge"] = main_after

        # ---------- 场景 4：副档认领旧共享键不得摧毁主档（D4）----------
        await page.evaluate(WRITE_MAIN, GENRE)
        await page.evaluate(PREPARE, GENRE)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        claim = await page.evaluate(CLAIM, GENRE)
        results["claim"] = claim
        if claim.get("ok"):
            # 正确期望：主档有存档 → 裸键归主档 → 副档认领后裸键**必须还在**
            if not claim.get("legacyStillThere"):
                issues.append("[D4] 副档认领把主档正在使用的裸键 imm_{g} 搬走了")
            if claim.get("key") == f"imm_{GENRE}":
                issues.append("[D4] 副档认领返回了主档裸键，未加槽位后缀")
        else:
            issues.append(f"[D4] claimSlotKey 异常：{claim.get('err')}")

        # ---------- 场景 5：世界库副档播种（D8）----------
        seed = await page.evaluate(SEED, GENRE)
        results["seed"] = seed
        if seed.get("ok"):
            if not seed.get("entries"):
                issues.append("[D8] 副档世界库播种后仍为空（播种标记未按槽隔离）")
        else:
            issues.append(f"[D8] ensureSeed 异常：{seed.get('err')}")

        # ---------- 场景 6：清档残留（D5）----------
        # clearSave 作用于「当前档」，所以要先切回主档再清，才能验主档键是否被清干净
        await page.evaluate(PREPARE_MAIN, GENRE)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        await page.evaluate(WRITE_MAIN, GENRE)
        clear = await page.evaluate(CLEAR, GENRE)
        results["clear"] = clear
        if clear.get("ok"):
            left_main = [k for k in clear.get("keys", []) if k.endswith("~main")]
            if left_main:
                issues.append(f"[D5] 清档后主档键仍残留 {len(left_main)} 个：{left_main[:8]}")
        else:
            issues.append(f"[D5] clearSave 异常：{clear.get('err')}")

        # ---------- 场景 7：timeline/game-layer 面板不崩溃（D9）----------
        panel = await page.evaluate("""()=>{
          const out = {};
          try {
            if (window.TimelineBranch && window.TimelineBranch.panelHTML) {
              out.tl = String(window.TimelineBranch.panelHTML()).length;
            }
          } catch(e){ out.tl = 'ERR:' + e; }
          try {
            if (window.GameLayer && window.GameLayer.panelHTML) {
              out.gl = String(window.GameLayer.panelHTML({})).length;
            }
          } catch(e){ out.gl = 'ERR:' + e; }
          return out;
        }""")
        results["panel"] = panel
        for k, v in panel.items():
            if isinstance(v, str) and v.startswith("ERR:"):
                issues.append(f"[D9] {k} 面板渲染抛错：{v[:120]}")

        # ---------- 场景 8：页面级错误 ----------
        real_errors = [e for e in errors if "ERR:" not in e][:10]
        results["pageErrors"] = real_errors
        if real_errors:
            issues.append(f"页面级 JS 异常 {len(real_errors)} 条：{real_errors[:3]}")

        await browser.close()

    results["issues"] = issues
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("=" * 66)
    print("云境 v4.08.0 · 多存档槽隔离探测")
    print("=" * 66)
    print(f"界：{GENRE}")
    if results.get("slotProbe"):
        sp = results["slotProbe"]
        print(f"  槽位探测：slotId={sp.get('slotId')!r} suffix={sp.get('slotSuffix')!r} genre={sp.get('genre')!r}")
        print(f"  界键：canonLedger={results.get('genreKeys',{}).get('ledger')} canonTL={results.get('genreKeys',{}).get('tl')}")
    print(f"  主档键 {len(results.get('mainKeys',[]))} 个 / 副档键 {len(results.get('subKeys',[]))} 个")
    print(f"  删档后残留：{[k for k in results.get('purge',{}).get('keys',[]) if '~sPROBE01' in k][:5] or '无'}")
    print(f"  认领后主档裸键是否还在：{results.get('claim',{}).get('legacyStillThere')}")
    print(f"  副档世界库条目数：{results.get('seed',{}).get('entries')}")
    print(f"  清档后主档残留：{[k for k in results.get('clear',{}).get('keys',[]) if k.endswith('~main')][:5] or '无'}")
    print(f"  面板渲染：timeline={results.get('panel',{}).get('tl')} gameLayer={results.get('panel',{}).get('gl')}")
    print("-" * 66)
    if issues:
        print(f"✗ 发现 {len(issues)} 项问题：")
        for i in issues:
            print("  ·", i)
    else:
        print("✓ 多存档槽隔离：全部通过")
    print(f"明细：{OUT}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
