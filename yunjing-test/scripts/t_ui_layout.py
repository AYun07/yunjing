#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v6.8.0 · 界面规整验收（真实浏览器）

逐条对应玩家 8 项反馈，全部 DOM 断言，不依赖大模型 Key：
  L-1 三栏布局：左功能栏 / 中正文 / 右状态栏，顺序正确
  L-2 左功能栏分组 + 太虚阁 12 模块入列 + 字体入口
  L-3 可折叠（收成 46px 图标条）
  L-4 太虚阁入口从模块清单消失
  L-5 行动选项去重：只有最新一组可点
  L-6 快捷指令默认折叠
  L-7 字体切换即时生效 + 持久化
  L-8 云起预设刺眼文案清零 + 合规护栏保留

用法：YJ_PORT=8931 python3 t_ui_layout.py
"""
import os, sys, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1")
PORT = os.environ.get("YJ_PORT", "8899")
URL = f"{BASE}:{PORT}"

PASS, FAIL = [], []
def rec(name, ok, detail=""):
    (PASS if ok else FAIL).append(name)
    print(("  ✓ " if ok else "  ✗ ") + name + (" ｜ " + detail if detail else ""))

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                              args=["--no-sandbox", "--disable-dev-shm-usage"])
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.goto(f"{URL}/studio.html?dev=1&genre=fanrenxiuxian", wait_until="load", timeout=60000)
        pg.wait_for_timeout(3000)

        # 进入世界态 + 造 3 轮正文
        pg.evaluate("""()=>{
          const fw=window.storyFramework;
          fw.storyState.isStoryStarted=true;
          fw.storyState.conversationHistory=[{role:'user',content:'开场'}];
          document.getElementById('chatArea').style.display='flex';
          document.getElementById('setupWrap').style.display='none';
          window.LeftRail.sync();
          const c=document.getElementById('chatMessages'); c.innerHTML='';
          for(let i=1;i<=3;i++) window.StoryResponseHandler.renderStoryMessage(
            '第'+i+'段：山风掠过青云峰，少年握紧木剑。','',
            ['拜入青云门','独行山下'],{chapter:i},'行动选项',{});
        }""")
        pg.wait_for_timeout(600)

        lay = pg.evaluate("""()=>{
          const r=document.getElementById('leftRail').getBoundingClientRect();
          const c=document.getElementById('chatArea').getBoundingClientRect();
          const s=document.getElementById('statusPanel').getBoundingClientRect();
          return {order:r.left<c.left && c.left<s.left, rw:Math.round(r.width)}; }""")
        rec("L-1 三栏布局顺序正确", lay["order"], f"左栏宽 {lay['rw']}px")

        left = pg.evaluate("""()=>{
          const gs=[...document.querySelectorAll('#leftRail .lr-group-head .lr-gname')].map(x=>x.textContent);
          const ns=[...document.querySelectorAll('#leftRail .lr-item .lr-label')].map(x=>x.textContent);
          const imm=['众生相','羁绊图','境界梯','藏宝阁','编年史','传书','倒计时','名场面','战报','天道','世界线','界专属'];
          return {gs, n:ns.length, imm:imm.filter(x=>ns.includes(x)).length, font:ns.includes('字体设置')}; }""")
        rec("L-2 左栏分组+太虚阁功能入列", len(left["gs"]) >= 5 and left["imm"] == 12 and left["font"],
            f"{len(left['gs'])}组/{left['n']}项/沉浸{left['imm']}项")

        pg.evaluate("()=>document.getElementById('lrToggle').click()")
        pg.wait_for_timeout(200)
        col = pg.evaluate("()=>({w:Math.round(document.getElementById('leftRail').getBoundingClientRect().width),on:document.getElementById('leftRail').classList.contains('collapsed')})")
        rec("L-3 左栏可折叠", col["on"] and col["w"] < 60, f"折叠后 {col['w']}px")
        pg.evaluate("()=>document.getElementById('lrToggle').click()")
        pg.wait_for_timeout(200)

        mod = pg.evaluate("""()=>{ try{ const e=(window.MoChibi&&MoChibi.moduleEntries)?MoChibi.moduleEntries():[];
          return {n:e.length, taixu:e.some(x=>/太虚阁/.test(x.name||''))}; }catch(err){return {err:err.message}} }""")
        rec("L-4 太虚阁入口已移除", mod.get("taixu") is False, f"模块数 {mod.get('n')}")

        opt = pg.evaluate("""()=>{ const a=[...document.querySelectorAll('#chatMessages .options-area')];
          return {total:a.length, stale:a.filter(x=>x.classList.contains('stale')).length,
                  live:a.filter(x=>!x.classList.contains('stale')).length,
                  clickable:document.querySelectorAll('#chatMessages .option-btn:not([disabled])').length}; }""")
        rec("L-5 选项仅最新一组可点", opt["total"] == 3 and opt["stale"] == 2 and opt["live"] == 1 and opt["clickable"] > 0,
            f"3组→{opt['stale']}归档+{opt['live']}可点/{opt['clickable']}按钮")

        qb = pg.evaluate("()=>({c:document.getElementById('quickBar').classList.contains('qb-collapsed'),t:!!document.querySelector('.quick-toggle')})")
        rec("L-6 快捷指令默认折叠", qb["c"] and qb["t"])

        pg.evaluate("()=>window.FontSwitcher.set('kai')")
        pg.wait_for_timeout(150)
        ft = pg.evaluate("()=>({cur:window.FontSwitcher.current(),save:localStorage.getItem('yunjingFontFamily')})")
        rec("L-7 字体切换+持久化", ft["cur"] == "kai" and ft["save"] == "kai")

        pr = pg.evaluate("""()=>{ const ps=(window.YUNQI_PRESET&&window.YUNQI_PRESET.prompts)||[];
          const all=JSON.stringify(ps);
          return {n:ps.length, jail:all.includes('SYSTEM OVERRIDE')||all.includes('破甲')||all.includes('红线'),
                  guard:all.includes('未成年人与真实在世人物的性化描写')}; }""")
        rec("L-8 预设文案清理+护栏保留", pr["n"] > 0 and not pr["jail"] and pr["guard"], f"{pr['n']}条预设")

        rec("无 pageerror", len(errs) == 0, "; ".join(errs[:2]))
        b.close()

    print(f"\nUI_LAYOUT: {len(PASS)} 通过 / {len(FAIL)} 失败")
    if FAIL:
        print("UI_LAYOUT_FAIL ✗ " + " ".join(FAIL))
        return 1
    print("UI_LAYOUT_OK ✓")
    return 0

if __name__ == "__main__":
    sys.exit(main())
