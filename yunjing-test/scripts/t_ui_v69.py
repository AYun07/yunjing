#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v6.9.0 界面验收：双玩法分类 / 功能去重 / 独立设置页 / 角色助手 / 遮挡 / 小云去重。
接入 CI browser job。用法：YJ_PORT=8899 python3 t_ui_v69.py"""
import os, sys, json
from playwright.sync_api import sync_playwright

PORT = os.environ.get("YJ_PORT", "8899")
BASE = f"http://127.0.0.1:{PORT}"
FAIL = []

def check(name, cond, detail=""):
    ok = bool(cond)
    print(("  PASS " if ok else "  FAIL ") + name + (("  " + str(detail)[:100]) if not ok else ""))
    if not ok: FAIL.append(name)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        # 1) 独立设置页：只有设置、没有创作区
        pg = b.new_page(viewport={"width": 1280, "height": 800})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.goto(f"{BASE}/settings.html?goto=settings", wait_until="load", timeout=60000)
        pg.wait_for_timeout(1200)
        r = pg.evaluate("""()=>({title:document.title,
          noCreate:!(document.getElementById('chatArea')||document.getElementById('setupWrap')),
          model:!!document.getElementById('cfg_endpoint'), font:!!document.getElementById('fontBtn'),
          theme:!!document.getElementById('themeBtn'), secs:document.querySelectorAll('section.sec').length})""")
        check("设置页-无创作区", r["noCreate"], r)
        check("设置页-模型/字体/主题齐备", r["model"] and r["font"] and r["theme"], r)
        check("设置页-至少4分区", r["secs"] >= 4, r)
        check("设置页-0报错", not errs, errs)
        # 模型保存生效
        pg.fill("#cfg_endpoint", "https://ci-test.example/v1"); pg.click("#saveModel"); pg.wait_for_timeout(200)
        ep = pg.evaluate("()=>JSON.parse(localStorage.getItem('storyApiConfig')||'{}').endpoint")
        check("设置页-模型保存生效", ep == "https://ci-test.example/v1", ep)
        pg.close()

        # 2) 三栏 + 双模式 + 去重 + 角色助手 + 遮挡
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.goto(f"{BASE}/studio.html?dev=1&genre=fanrenxiuxian", wait_until="load", timeout=60000)
        pg.wait_for_timeout(2000)
        # 角色助手（roleplay 模式渲染后）
        pg.evaluate("()=>{try{StorySetupWizard.render()}catch(e){}}")
        pg.wait_for_timeout(400)
        r = pg.evaluate("""()=>({cs:!!document.getElementById('csWrap'),
          btns:document.querySelectorAll('#csWrap button').length,
          icon:(function(){try{const u=CharacterStudio.genIcon();return u&&u.startsWith('data:image');}catch(e){return false}})()})""")
        check("角色助手-三按钮在位", r["cs"] and r["btns"] >= 3, r)
        check("角色助手-图标程序化生成", r["icon"], r)

        # 进入正文态
        pg.evaluate("""()=>{document.getElementById('chatArea').style.display='flex';
          document.getElementById('setupWrap').style.display='none';
          window.storyFramework.storyState.isStoryStarted=true; window.LeftRail.sync();
          document.getElementById('chatMessages').innerHTML='';
          window.StoryResponseHandler.renderStoryMessage('测试正文。','',['选项甲'],{chapter:1},'行动选项',{});}""")
        pg.wait_for_timeout(500)
        # 双模式
        r = pg.evaluate("""()=>({modes:document.querySelectorAll('#leftRail .lr-mode').length,
          mode:LeftRail.mode(), groups:[...document.querySelectorAll('#leftRail .lr-gname')].map(x=>x.textContent)})""")
        check("双玩法-切换按钮在", r["modes"] == 2, r)
        check("双玩法-默认写小说模式", r["mode"] == "novel", r)
        pg.evaluate("()=>LeftRail.setMode('card')"); pg.wait_for_timeout(300)
        r2 = pg.evaluate("""()=>({mode:LeftRail.mode(),
          names:[...document.querySelectorAll('#leftRail .lr-label')].map(x=>x.textContent),
          groups:[...document.querySelectorAll('#leftRail .lr-gname')].map(x=>x.textContent)})""")
        check("双玩法-切到玩卡", r2["mode"] == "card", r2)
        check("玩卡模式-全是卡相关(无行旅图鉴/前情)",
              ("行旅图鉴" not in r2["names"]) and ("前情提要" not in r2["names"]), r2["names"][:8])
        pg.evaluate("()=>LeftRail.setMode('novel')"); pg.wait_for_timeout(300)
        r3 = pg.evaluate("()=>[...document.querySelectorAll('#leftRail .lr-label')].map(x=>x.textContent)")
        check("写小说模式-全是创作相关(无角色卡/立绘)",
              ("角色卡" not in r3) and ("立绘本" not in r3), r3[:8])

        # 去重：工具箱与左栏无交集
        r4 = pg.evaluate("""()=>{
          const left=new Set(); ['card','novel'].forEach(m=>{LeftRail.setMode(m);
            document.querySelectorAll('#leftRail .lr-label').forEach(x=>left.add(x.textContent.trim()));});
          const tb=[...document.querySelectorAll('#toolboxSheet .si-main b')].map(x=>x.textContent.trim());
          return {n:tb.length, inter:tb.filter(x=>left.has(x))};}""")
        check("去重-工具箱与左栏无同名功能", len(r4["inter"]) == 0, r4)

        # 遮挡：关键按钮中心点无遮挡
        r5 = pg.evaluate("""()=>{
          const sels='#leftRail .lr-toggle,#sendBtn,.option-btn,.quick-toggle,#leftRail .lr-item';
          const bad=[];
          document.querySelectorAll(sels).forEach(el=>{const b=el.getBoundingClientRect();
            if(b.width<=0||b.height<=0||b.bottom<0||b.top>innerHeight)return;
            const cx=b.left+b.width/2,cy=b.top+b.height/2;
            if(cx<0||cx>innerWidth||cy<0||cy>innerHeight)return;
            const hit=document.elementFromPoint(cx,cy);
            if(hit&&el!==hit&&!el.contains(hit)&&!hit.contains(el))bad.push(el.className||el.tagName);});
          return bad.length;}""")
        check("遮挡-关键功能按钮0遮挡", r5 == 0, r5)

        # 小云去重：创作室不渲染重合模块
        r6 = pg.evaluate("()=>({mod:document.querySelectorAll('#xyBuddy .xy-mod').length, q:document.querySelectorAll('#xyBuddy .xy-q').length})")
        check("小云-11个重合模块不再列出", r6["mod"] == 0, r6)
        check("小云-快捷栏精简到<=4", r6["q"] <= 4, r6)
        check("页面-0报错", not errs, errs)
        pg.close(); b.close()
    print(f"\nUI_V69 验收：{'全部通过' if not FAIL else str(len(FAIL))+' 项失败'}")
    return 1 if FAIL else 0

if __name__ == "__main__":
    sys.exit(main())
