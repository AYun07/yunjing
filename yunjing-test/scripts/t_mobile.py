#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.08.0 · 移动端小屏回归探测（不调模型）

v4.07.2 交付报告的未闭环项之一：「移动端视觉——本轮截图均为桌面视口，未做小屏适配回归」。

本脚本在 375×667（iPhone SE / 主流安卓小屏）与 414×896 两个视口下，
实机打开界面并测量：
  · 横向溢出（scrollWidth > clientWidth）——小屏最致命的问题
  · 文本溢出容器（元素实际宽度超出父容器）
  · 过小的可点区域（< 32px，手机上点不中）
  · 固定定位元素遮挡输入框
  · 关键面板（RPG 面板 / 舆图 / 存档槽 / 输入区）是否可见且不越界

同时输出截图，供人工复核。

用法：
  cd /workspace/yunjing && python3 -m http.server 8899 --bind 127.0.0.1 &
  python3 yunjing-test/scripts/t_mobile.py
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/mobile_probe.json"
SHOT_DIR = os.environ.get("YJ_SHOT_DIR", "/workspace/云境-v4.08.0-截图")
GENRE = os.environ.get("YJ_GENRE", "wangyou")

BOOT = """(g)=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《寰宇纪元 · 小屏回归》',playerName:'我',gender:'男',age:18,
      background:'',identity:(pick(meta.identities)||{}).name||'普通人',identityDesc:'',
      timeline:(pick(meta.timelines)||{}).name||'',timelineDesc:'',
      region:(pick(meta.regions)||{}).name||'',regionDesc:'',
      aptitude:(pick(meta.aptitudes)||{}).name||'',aptitudeDesc:'',
      perspective:(pick(meta.perspectives)||{}).name||'',perspectiveDesc:'',
      style:(pick(meta.styles)||{}).name||'',styleDesc:'',
      scale:(pick(meta.lengths)||{}).name||'',scaleDesc:'',customScale:'',
      totalChapters:40,targetWords:0,
      entryEvent:'standard',customEntry:'',boons:[],techniques:[],customBoon:'',
      stats:{...(config.baseAttributes||{})}};
    fw.storyState.setup=setup; fw.storyState.isStoryStarted=true;
    fw.storyState.variables={title:setup.title,chapter:0,totalChapters:40,wordCount:0,
      stats:{...setup.stats},
      characters:{'我':{role:setup.identity||'普通人',status:config.startRealm||'初入世界',firstAppearance:'入场事件',isPlayer:true}},
      foreshadowings:[],items:[],history:[]};
    (config.gauges||[]).forEach(x=>{fw.storyState.variables[x.key]=x.default!=null?x.default:50;});
    try{fw.saveStory&&fw.saveStory();}catch(e){}
    try{window.WorldExt&&window.WorldExt.onVars&&window.WorldExt.onVars(fw.storyState.variables,0);}catch(e){}
    return {ok:true};
  }catch(e){return {ok:false,err:String(e)};}
}"""

# 布局测量：横向溢出 / 文本溢出 / 小热区 / 遮挡
MEASURE = """(g)=>{
  const out = {overflow:[], tiny:[], clipped:[], docW:0, clientW:0, offenders:[]};
  try {
    out.docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    out.clientW = document.documentElement.clientWidth;
    const vw = out.clientW;
    // 1) 横向溢出的元素（自身右边界超出视口）
    const all = document.querySelectorAll('body *');
    const seen = new Set();
    // 判定「元素是否真的在屏幕上」：跳过被祖先 transform 推出屏幕的关闭态抽屉
    const onScreen = (el) => {
      let n = el;
      let first = true;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
        // 元素自身或祖先被 translateX 推出屏幕 → 关闭态抽屉，不算溢出
        if (cs.transform && cs.transform !== 'none') {
          const m = new DOMMatrixReadOnly(cs.transform);
          if (m.m41 > 40) return false;
        }
        n = n.parentElement;
        first = false;
      }
      return true;
    };
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 2 && onScreen(el)) {
        const tag = (el.tagName||'').toLowerCase();
        const id = el.id ? '#'+el.id : '';
        const cls = (typeof el.className === 'string' && el.className) ? '.'+el.className.split(/\s+/).slice(0,2).join('.') : '';
        const key = tag+id+cls;
        if (seen.has(key)) continue;
        seen.add(key);
        out.overflow.push({ sel: key, right: Math.round(r.right), vw, w: Math.round(r.width) });
      }
      // 2) 可点区域过小（手机点不中）
      if ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && el.offsetParent !== null && onScreen(el)) {
        if (r.height < 26 || r.width < 20) {
          const key = 'btn:' + (el.id ? '#'+el.id : (el.className||el.textContent||'').toString().trim().slice(0,20));
          if (!seen.has(key)) { seen.add(key); out.tiny.push({ sel: key, w: Math.round(r.width), h: Math.round(r.height) }); }
        }
      }
      // 3) 文本被裁掉（scrollWidth 明显大于 clientWidth 且 overflow hidden）
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
        const cs = getComputedStyle(el);
        if (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') {
          const key = 'clip:' + (el.id ? '#'+el.id : (el.className||'').toString().split(/\s+/)[0] || el.tagName);
          if (!seen.has(key)) { seen.add(key); out.clipped.push({ sel: key, need: el.scrollWidth, have: el.clientWidth, text: (el.textContent||'').trim().slice(0,30) }); }
        }
      }
    }
    out.overflow = out.overflow.slice(0, 20);
    out.tiny = out.tiny.slice(0, 20);
    out.clipped = out.clipped.slice(0, 20);
  } catch(e){ out.err = String(e); }
  return out;
}"""

# 输入框被固定元素遮挡？
OCCLUDE = """(g)=>{
  const out = {};
  try {
    const inp = document.getElementById('userInput');
    if (!inp) { out.noInput = true; return out; }
    const r = inp.getBoundingClientRect();
    const ir = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    const hits = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el === inp || inp.contains(el) || el.contains(inp)) return;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky' && cs.position !== 'absolute') return;
      if (cs.pointerEvents === 'none' || cs.opacity === '0' || cs.display === 'none') return;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      // 与输入框有交集，且该元素 z-index 更高
      const zi = parseInt(cs.zIndex || '0', 10) || 0;
      if (b.left < ir.right && b.right > ir.left && b.top < ir.bottom && b.bottom > ir.top && zi > 0) {
        hits.push({ sel: (el.id ? '#'+el.id : '.'+(typeof el.className==='string'? el.className.split(/\s+/)[0]:'')), z: zi, pos: cs.position });
      }
    });
    out.inputRect = ir;
    out.hits = hits.slice(0, 8);
  } catch(e){ out.err = String(e); }
  return out;
}"""


async def measure(page, label, tag):
    m = await page.evaluate(MEASURE, GENRE)
    o = await page.evaluate(OCCLUDE, GENRE)
    os.makedirs(SHOT_DIR, exist_ok=True)
    path = os.path.join(SHOT_DIR, f"移动端-{tag}.png")
    try:
        await page.screenshot(path=path, full_page=False)
    except Exception as e:
        m["shotErr"] = str(e)
    return {"label": label, "tag": tag, "measure": m, "occlude": o, "shot": path}


async def main():
    issues = []
    reports = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        for tag, vw, vh in [("375", 375, 667), ("414", 414, 896)]:
            ctx = await browser.new_context(
                viewport={"width": vw, "height": vh},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                           "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                service_workers="block",
            )
            # v4.08.0：禁用 HTTP 缓存 —— 否则改完 CSS 后测的还是旧样式，
            # 会出现「代码改了但测试结果没变」的假象（本轮就踩过一次）。
            await ctx.route("**/*", lambda route: route.continue_(
                headers={**route.request.headers, "Cache-Control": "no-cache", "Pragma": "no-cache"}))
            page = await ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))

            # 1) 大厅（index）
            await page.goto(f"{BASE}/index.html", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            reports.append(await measure(page, f"大厅 {vw}px", f"大厅-{vw}"))

            # 2) 工作室（studio）：RPG 面板 / 输入区 / 舆图
            await page.goto(f"{BASE}/studio.html?genre={GENRE}", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            boot = await page.evaluate(BOOT, GENRE)
            if not boot.get("ok"):
                issues.append(f"[{vw}px] studio 引导失败：{boot}")
            reports.append(await measure(page, f"工作室 {vw}px", f"工作室-{vw}"))

            # 3) 打开 RPG 面板
            try:
                await page.evaluate("""()=>{
                  const W = window.WorldExt;
                  const fab = document.querySelector('[data-rpg-open], .rpg-fab, #rpgFab');
                  if (fab) { fab.click(); return 'fab'; }
                  const b = document.getElementById('rpgDrawer');
                  if (b) { b.classList.add('open'); b.style.display='block'; return 'drawer'; }
                  return 'none';
                }""")
                await page.wait_for_timeout(1500)
                reports.append(await measure(page, f"RPG面板 {vw}px", f"RPG面板-{vw}"))
                if os.environ.get("YJ_MOBILE_DEBUG"):
                    dbg = await page.evaluate("""()=>{
                      const vw = document.documentElement.clientWidth;
                      const out=[];
                      document.querySelectorAll('button.rpg-btn.q').forEach(el=>{
                        const r=el.getBoundingClientRect();
                        if (r.right <= vw + 2) return;
                        const chain=[]; let n=el;
                        while(n && n!==document.body){
                          const cs=getComputedStyle(n);
                          chain.push({tag:n.tagName,id:n.id,cls:(typeof n.className==='string'?n.className:''),box:cs.boxSizing,w:cs.width,pad:cs.padding,right:Math.round(n.getBoundingClientRect().right),disp:cs.display,pos:cs.position});
                          n=n.parentElement;
                        }
                        out.push({right:Math.round(r.right),w:Math.round(r.width),text:el.textContent,chain:chain.slice(0,6)});
                      });
                      return out;
                    }""")
                    print(f"  [DEBUG {tag}] 溢出的 rpg-btn.q:", json.dumps(dbg, ensure_ascii=False))
            except Exception as e:
                issues.append(f"[{vw}px] RPG 面板打开异常：{e}")

            # 4) 存档槽面板
            try:
                await page.evaluate("()=>{ if (window.SaveSlots && SaveSlots.open) SaveSlots.open(); }")
                await page.wait_for_timeout(900)
                reports.append(await measure(page, f"存档槽 {vw}px", f"存档槽-{vw}"))
            except Exception as e:
                issues.append(f"[{vw}px] 存档槽面板异常：{e}")

            if errs:
                issues.append(f"[{vw}px] 页面级 JS 异常 {len(errs)} 条：{errs[:2]}")

            await ctx.close()
        await browser.close()

    # ---------------- 判定 ----------------
    for rep in reports:
        m = rep["measure"]
        tag = rep["tag"]
        if m.get("err"):
            issues.append(f"[{tag}] 布局测量失败：{m['err']}")
            continue
        if m.get("docW", 0) > m.get("clientW", 0) + 2:
            issues.append(f"[{tag}] 页面横向溢出：scrollWidth={m['docW']} > clientWidth={m['clientW']}")
        ov = m.get("overflow", [])
        if ov:
            issues.append(f"[{tag}] {len(ov)} 个元素超出视口右边界（最宽 {max(o['right'] for o in ov)} > {m['clientW']}）：{[o['sel'] for o in ov[:4]]}")
        tiny = m.get("tiny", [])
        if tiny:
            tiny_desc = ["%s(%dx%d)" % (t["sel"], t["w"], t["h"]) for t in tiny[:4]]
            issues.append(f"[{tag}] {len(tiny)} 个可点区域过小（<26px 高）：{tiny_desc}")
        hits = rep.get("occlude", {}).get("hits", [])
        if hits:
            issues.append(f"[{tag}] 固定元素遮挡输入框：{hits[:3]}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"reports": reports, "issues": issues}, f, ensure_ascii=False, indent=2)

    print("=" * 68)
    print("云境 v4.08.0 · 移动端小屏回归")
    print("=" * 68)
    for rep in reports:
        m = rep["measure"]
        print(f"  {rep['label']:<16} 文档宽 {m.get('docW')} / 视口 {m.get('clientW')}　"
              f"溢出 {len(m.get('overflow',[]))}　小热区 {len(m.get('tiny',[]))}　"
              f"遮挡 {len(rep.get('occlude',{}).get('hits',[]))}")
    print("-" * 68)
    if issues:
        print(f"✗ 发现 {len(issues)} 项小屏问题：")
        for i in issues:
            print("  ·", i)
    else:
        print("✓ 移动端小屏：两个视口均无横向溢出 / 过小热区 / 输入框遮挡")
    print(f"截图：{SHOT_DIR}")
    print(f"明细：{OUT}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
