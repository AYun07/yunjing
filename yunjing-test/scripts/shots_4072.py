#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.07.2 交付截图：本轮修复的可视化证据
  ① 角色面板 + 战斗结算日志（结算文案不再带野怪等级）
  ② 委托板（接取文案标注「完成后可得 · 尚未到账」）
  ③ 技能面板（冷却随动作推进，可重复释放）
  ④ 舆图全境总览
  ⑤ 主界面常驻状态板
"""
import asyncio, os
from playwright.async_api import async_playwright

OUT = "/workspace/云境-v4.07.2-截图"
os.makedirs(OUT, exist_ok=True)
BASE = "http://127.0.0.1:8899/studio.html?genre=wangyou"

BOOT = """()=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《寰宇纪元 · 交付实拍》',playerName:'我',gender:'男',age:18,
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


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1500, "height": 1020}, device_scale_factor=1.5,
                                  service_workers="block")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.goto(BASE, wait_until="domcontentloaded", timeout=60000)
        await pg.wait_for_timeout(6000)
        await pg.evaluate(BOOT)
        for _ in range(40):
            ok = await pg.evaluate("()=>{try{return !!(window.WorldExt&&window.WorldExt.moduleList&&window.WorldExt.moduleList().length);}catch(e){return false;}}")
            if ok:
                break
            await pg.wait_for_timeout(400)

        # 连打 3 场（验证冷却随动作推进）+ 接一个击杀委托
        info = await pg.evaluate("""()=>{
          const W=window.WorldExt; const out={logs:[]};
          for(let i=0;i<3;i++){ out.logs.push(String(W.act('wr_rpg','skill','slash'))); }
          const st=W.modState('wr_rpg').state;
          const q=(st.quests.offers||[]).filter(q=>q.t==='kills')[0];
          if(q) out.accept=String(W.act('wr_rpg','qaccept',q.id));
          for(let i=0;i<2;i++){ out.logs.push(String(W.act('wr_rpg','skill','slash'))); }
          const st2=W.modState('wr_rpg').state;
          out.lv=st2.lv; out.exp=st2.exp; out.gold=st2.gold;
          out.active=(st2.quests.active||[]).map(q=>q.title+'('+q.cur+'/'+q.need+')');
          return out;
        }""")
        print("战斗结算：")
        for l in info["logs"]:
            print("   ", l[:110])
        print("接取：", (info.get("accept") or "")[:130])
        print("Lv.%s 经验 %s 金币 %s ｜在手委托 %s" % (info["lv"], info["exp"], info["gold"], info["active"]))

        # 打开 RPG 面板并切到角色页
        await pg.evaluate("""()=>{
          try{ if(window.ImmersiveSuite) ImmersiveSuite.openTab('ext'); }catch(e){}
          const body=document.getElementById('immBody');
          if(body){ body.dataset.wxTab='1'; body.innerHTML=window.WorldExt.panelHTML?String(window.WorldExt.panelHTML()||''):''; }
          const tabs=document.querySelectorAll('.rpg-tab');
          if(tabs[0]) tabs[0].click();
        }""")
        await pg.wait_for_timeout(1200)
        el = await pg.query_selector("#immBody")
        if el:
            await el.screenshot(path=f"{OUT}/角色面板-战斗结算日志.png")
            print("  截图 角色面板-战斗结算日志.png")

        # 委托面板
        await pg.evaluate("""()=>{
          const tabs=document.querySelectorAll('.rpg-tab');
          for(const t of tabs){ if((t.innerText||'').includes('委托')){ t.click(); return; } }
        }""")
        await pg.wait_for_timeout(1200)
        el = await pg.query_selector("#immBody")
        if el:
            await el.screenshot(path=f"{OUT}/委托板-完成后方可得.png")
            print("  截图 委托板-完成后方可得.png")

        # 技能面板
        await pg.evaluate("""()=>{
          const tabs=document.querySelectorAll('.rpg-tab');
          for(const t of tabs){ if((t.innerText||'').includes('技能')){ t.click(); return; } }
        }""")
        await pg.wait_for_timeout(1000)
        el = await pg.query_selector("#immBody")
        if el:
            await el.screenshot(path=f"{OUT}/技能面板-冷却可推进.png")
            print("  截图 技能面板-冷却可推进.png")

        # 舆图
        await pg.evaluate("()=>{try{StoryAtlas.toggle(false)}catch(e){};try{StoryAtlas.toggle(true)}catch(e){}}")
        await pg.wait_for_timeout(2200)
        el = await pg.query_selector("#atlasPanel")
        if el:
            await el.screenshot(path=f"{OUT}/舆图-寰宇纪元-全境总览.png")
            print("  截图 舆图-寰宇纪元-全境总览.png")

        # 主界面
        await pg.evaluate("()=>{try{StoryAtlas.toggle(false)}catch(e){}}")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f"{OUT}/主界面-常驻状态板.png")
        print("  截图 主界面-常驻状态板.png")

        if errs:
            print("页面错误:", errs[:5])
        await b.close()


asyncio.run(main())
