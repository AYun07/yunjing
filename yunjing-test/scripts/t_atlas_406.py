#!/usr/bin/env python3
"""v4.05.0 舆图细节化浏览器验收（无外部 API）。
三段：① 全 38 界逐层回归 + 新增细节指标；② 悬停速览与详情增补；③ 全 38 界 375px 无横向溢出。
"""
import asyncio, glob, os, json
from playwright.async_api import async_playwright

ROOT = os.environ.get('YJ_ROOT', '/workspace/yunjing')
GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob(ROOT + '/js/kb/*.core.js'))
BASE = 'http://127.0.0.1:8899/studio.html'

PROBE = """()=>{
  const pn=document.getElementById('atlasPanel'); if(!pn) return {n:-1};
  const ns=[...pn.querySelectorAll('.atlas-node')];
  const html=ns.map(x=>x.innerHTML).join('');
  const mini=(html.match(/M-2\\.1,1\\.6|M-2\\.15,1\\.6|M-2\\.2,-|M-1\\.75,1\\.6|M-2\\.05,1\\.6/g)||[]).length;
  const fog=(html.match(/url\\(#agFog\\)/g)||[]).length;
  const labs=[...pn.querySelectorAll('.atlas-label')].filter(x=>{const b=x.getBoundingClientRect();return b.width>0&&b.height>0});
  const boxes=labs.map(x=>{const b=x.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom]});
  let ov=0;
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    const w=Math.min(a[2],b[2])-Math.max(a[0],b[0]), h=Math.min(a[3],b[3])-Math.max(a[1],b[1]);
    if(w>6&&h>6)ov++;
  }
  const svg=pn.querySelector('svg'); let out=0;
  if(svg){const sb=svg.getBoundingClientRect();
    labs.forEach(x=>{const b=x.getBoundingClientRect();if(b.left<sb.left-2||b.right>sb.right+2||b.top<sb.top-2||b.bottom>sb.bottom+2)out++;});}
  const types=pn.querySelectorAll('.atlas-typelegend .atl-item').length;
  const stat=pn.querySelectorAll('.atlas-layerstat span').length;
  const ticks=pn.querySelectorAll('.atlas-ticks .atlas-tick').length;
  const roads=pn.querySelectorAll('.atlas-road').length;
  const tiers=[...new Set([...pn.querySelectorAll('.atlas-road')].map(x=>x.getAttribute('data-road-tier')))].sort();
  const crest=!!pn.querySelector('img.atlas-crest');
  return {n:ns.length,mini,fog,labs:labs.length,ov,out,types,stat,ticks,roads,tiers,crest};
}"""

OPEN = """(g)=>{window.storyFramework=window.storyFramework||{};window.storyFramework.config=window.storyFramework.config||{};window.storyFramework.config.genreKey=g;window.storyFramework.config.genreName=g;window.storyFramework.storyState=window.storyFramework.storyState||{setup:{},variables:{},conversationHistory:[]};localStorage.removeItem('yj_atlas_'+g);}"""


async def open_map(pg, g):
    await pg.evaluate(OPEN, g)
    await pg.evaluate("()=>{try{StoryAtlas.toggle(false)}catch(e){};try{StoryAtlas.toggle(true)}catch(e){}}")
    await pg.wait_for_timeout(280)


# 面板有 .38s 滑入动画；几何判定必须等 transform 收敛，否则量到的是动画中间态（假阳性）。
# 判定阈值不变，只把测量时机移到稳定态。
STABLE = """()=>{
  const p=document.getElementById('atlasPanel'); if(!p) return false;
  const t=getComputedStyle(p).transform;
  if(t==='none') return true;
  try{ return Math.abs(new DOMMatrix(t).m41) < 1.5; }catch(e){ return true; }
}"""


async def open_map_stable(pg, g):
    await pg.evaluate(OPEN, g)
    await pg.evaluate("()=>{try{StoryAtlas.toggle(false)}catch(e){};try{StoryAtlas.toggle(true)}catch(e){}}")
    try:
        await pg.wait_for_function(STABLE, timeout=6000)
    except Exception:
        await pg.wait_for_timeout(700)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])

        # ---- ① 逐层回归 ----
        ctx = await b.new_context(viewport={"width": 1400, "height": 1000}, service_workers="block")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:180]))
        await pg.goto(BASE, wait_until="networkidle", timeout=60000)
        rows = []
        for g in GENRES:
            await open_map(pg, g)
            tabs = await pg.evaluate("""()=>[...document.querySelectorAll('#atlasPanel .atlas-tab')].map(x=>(x.getAttribute('onclick')||''))""")
            for li, oc in enumerate(tabs):
                tid = oc.split("'")[1] if "'" in oc else ''
                await pg.evaluate("(id)=>{try{StoryAtlas.switchLayer(id)}catch(e){}}", tid)
                await pg.wait_for_timeout(190)
                rows.append((g, li, await pg.evaluate(PROBE)))
        n = len(rows)
        thin = [(g, li, r['n']) for g, li, r in rows if r['n'] < 10]
        ovl = [(g, li, r['ov']) for g, li, r in rows if r['ov'] > 0]
        outl = [(g, li, r['out']) for g, li, r in rows if r['out'] > 0]
        no_tip_ui = [(g, li) for g, li, r in rows if r['types'] != 8]
        no_stat = [(g, li) for g, li, r in rows if r['stat'] < 6]
        no_tick = [(g, li, r['ticks']) for g, li, r in rows if r['ticks'] < 36]
        no_road = [(g, li) for g, li, r in rows if r['roads'] < 1]
        no_crest = [(g, li) for g, li, r in rows if not r['crest']]
        tier_sets = set(tuple(r['tiers']) for _, _, r in rows)
        print("=== ① 全 38 界逐层回归 ===")
        print("界数", len(GENRES), "总层数", n, "渲染节点合计", sum(r['n'] for _, _, r in rows),
              "可见标签合计", sum(r['labs'] for _, _, r in rows))
        print("节点<10 的层", len(thin), thin[:6])
        print("标签实质压字 的层", len(ovl), ovl[:6])
        print("标签越界 的层", len(outl), outl[:6])
        print("agFog 残留合计", sum(r['fog'] for _, _, r in rows))
        print("8 类地标图例缺失层", len(no_tip_ui), no_tip_ui[:6])
        print("层统计条缺失层", len(no_stat), no_stat[:6])
        print("图廓刻度<36 的层", len(no_tick), no_tick[:6])
        print("无道路渲染的层", len(no_road), no_road[:6])
        print("纹章缺失层", len(no_crest), no_crest[:6])
        print("道路分级组合", sorted(tier_sets))
        print("PAGEERRORS", errs[:4] if errs else "none")

        # ---- ② 悬停速览 + 详情增补 ----
        await open_map_stable(pg, "wangyou")
        await pg.evaluate("()=>{try{StoryAtlas.switchLayer('end')}catch(e){}}")
        await pg.wait_for_timeout(300)
        hover = await pg.evaluate("""()=>{
          const el=document.querySelector('#atlasPanel .atlas-node'); if(!el) return {ok:false};
          const r=el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent('mouseenter',{clientX:r.left+8,clientY:r.top+8,bubbles:true}));
          el.dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+8,clientY:r.top+8,bubbles:true}));
          const t=document.getElementById('atlasTip');
          return {ok:true,on:!!(t&&t.classList.contains('on')),text:(t?t.innerText:'').replace(/\\s+/g,' ').trim().slice(0,120),
                  hidden:t?t.getAttribute('aria-hidden'):'missing'};
        }""")
        click = await pg.evaluate("""()=>{
          const el=document.querySelector('#atlasPanel .atlas-node'); if(!el) return {ok:false};
          el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
          const d=document.getElementById('atlasDetail');
          const txt=d?d.innerText.replace(/\\s+/g,' ').trim():'';
          return {ok:true,alias:!!(d&&d.querySelector('.ad-alias')),aliasTxt:(d&&d.querySelector('.ad-alias')?d.querySelector('.ad-alias').innerText:''),
                  pos:/图内方位/.test(txt),km:/约\\s*\\d+\\s*(公里|里)/.test(txt),head:txt.slice(0,150)};
        }""")
        print("\n=== ② 悬停速览与详情增补 ===")
        print("hover:", json.dumps(hover, ensure_ascii=False))
        print("detail:", json.dumps(click, ensure_ascii=False))
        await ctx.close()

        # ---- ③ 375px 全 38 界无横向溢出 ----
        ctx2 = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block")
        pg2 = await ctx2.new_page()
        errs2 = []
        pg2.on("pageerror", lambda e: errs2.append(str(e)[:180]))
        await pg2.goto(BASE, wait_until="networkidle", timeout=60000)
        over = []
        for g in GENRES:
            await open_map_stable(pg2, g)
            r = await pg2.evaluate("""()=>{
              const de=document.documentElement, pn=document.getElementById('atlasPanel');
              const pr=pn?pn.getBoundingClientRect():null;
              return {sw:de.scrollWidth,iw:window.innerWidth,
                      pr:pr?Math.round(pr.right):-1, w:pn?Math.round(pn.getBoundingClientRect().width):-1};
            }""")
            if r['sw'] > r['iw'] + 1 or r['pr'] > r['iw'] + 1:
                over.append((g, r))
        print("\n=== ③ 375px 移动端全 38 界 ===")
        print("横向溢出界数", len(over), over[:8])
        print("PAGEERRORS", errs2[:4] if errs2 else "none")
        await ctx2.close()
        await b.close()

        ok = (not thin and not ovl and not outl and not no_tip_ui and not no_stat
              and not no_tick and not no_road and not no_crest and not errs
              and hover['ok'] and hover['on'] and click['ok'] and click['alias']
              and click['pos'] and click['km'] and not over and not errs2
              and any('main' in t for t in tier_sets))
        print("\n总判定:", "PASS 全量通过" if ok else "FAIL 存在不合格项")


asyncio.run(main())
