#!/usr/bin/env python3.11
# -*- coding: utf-8 -*-
"""云境 v8 电影片头式入场验收：
纯黑底 →「云境」大字浮现(光晕/呼吸/扫光) → 大字淡出 → 画面推进到封面(虚/暗/放大→清晰)
→ 动态粒子全程开启 → 收尾移交封面常驻(场景视频+粒子)，四入口淡入。可跳过。
全程真动画、无静态贴图。用法：YJ_PORT=8899 python3 t_cover_intro.py"""
import os, sys, io
from playwright.sync_api import sync_playwright

PORT = os.environ.get("YJ_PORT", "8899")
BASE = f"http://127.0.0.1:{PORT}/opening.html"
FAIL = []

def check(name, cond, detail=""):
    ok = bool(cond)
    print(("  PASS " if ok else "  FAIL ") + name + (("  " + str(detail)[:120]) if not ok else ""))
    if not ok: FAIL.append(name)

def op(pg, sel):
    return pg.eval_on_selector(sel, "el=>+getComputedStyle(el).opacity")

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                              args=["--no-sandbox", "--disable-dev-shm-usage",
                                    "--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": 1280, "height": 800})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_function("()=>window.CoverIntro&&!!document.getElementById('coverIntro')", timeout=8000)

        # ① 片头标题卡（~1300ms，浮现中段）：黑屏底已过 +「云境」大字浮现中 + 粒子全程已开 + 场景在播但不可见
        pg.wait_for_timeout(1300)
        card = pg.query_selector(".ci-titlecard h1")
        check("S1 片头标题卡存在且文案为「云境」", card is not None and card.inner_text().strip()=="云境")
        check("S1 标题正在浮现", 0.05 < op(pg,".ci-titlecard") < 1.0, op(pg,".ci-titlecard"))
        sv = pg.query_selector(".ci-scene-video")
        check("S1 场景视频层在位", sv is not None)
        ss = pg.eval_on_selector(".ci-scene-video", "el=>({t:el.currentTime,ready:el.readyState,loop:el.loop,muted:el.muted})")
        check("S1 场景视频就绪并播放", ss["ready"]>=2 and ss["t"]>=0, ss)
        lsrc = pg.evaluate("()=>{ var v=window.CoverIntro&&window.CoverIntro._sceneVideo; return v?(v.currentSrc||v.src||''):''; }")
        check("S1 横屏用横版专用视频源", "girl_live.mp4" in lsrc and "port" not in lsrc, lsrc)
        check("S1 片头阶段封面揭示层不可见", op(pg,".ci-reveal")<0.05, op(pg,".ci-reveal"))
        pa = pg.evaluate("()=>({a:window.CoverIntro._engine.alpha, r:window.CoverIntro._engine.running})")
        check("S1 粒子全程开启(第0帧已在运行)", pa["r"] and pa["a"]>0.05, pa)
        check("S1 无透明女孩层(已弃用)", len(pg.query_selector_all(".ci-girl-layer,.ci-girl-video"))==0)

        # ② 标题停留（~2500ms，处于 2200-3500ms 停留期）：大字完全可见、有字距(电影感)、封面仍未推进
        pg.wait_for_timeout(1200)
        check("S2 大字完全显现", op(pg,".ci-titlecard")>0.9, op(pg,".ci-titlecard"))
        tr = pg.eval_on_selector(".ci-titlecard","el=>getComputedStyle(el).letterSpacing")
        check("S2 大字拉开字距(电影片头质感)", tr not in ("normal","0px"), tr)

        # ③ 推进转场：等待揭示层进入「推进中间态」(op 0.15~0.85)再采样，避开固定时间的抖动
        pg.wait_for_function(
            "()=>{const r=document.querySelector('.ci-reveal');if(!r)return false;"
            "const o=+getComputedStyle(r).opacity;return o>0.15&&o<0.85;}", timeout=4000)
        tc = op(pg,".ci-titlecard"); ro = op(pg,".ci-reveal")
        check("S3 标题开始淡出", tc<0.95, tc)
        check("S3 封面画面推进浮现", 0.15<ro<0.85, ro)
        check("S3 交叉溶解(标题与封面同时半透明)", tc<0.95 and ro>0.15, f"title={tc:.2f} reveal={ro:.2f}")
        tf = pg.eval_on_selector(".ci-reveal","el=>getComputedStyle(el).transform")
        fl = pg.eval_on_selector(".ci-reveal","el=>getComputedStyle(el).filter")
        check("S3 推镜头(transform scale 变化)", tf and "matrix" in tf, tf)
        check("S3 推镜头(由虚到清晰 filter 存在)", fl and fl!="none", fl)

        # ④ 自动收尾（约5s）→ 移交封面常驻
        pg.wait_for_function("()=>!document.getElementById('coverIntro')", timeout=8000)
        pg.wait_for_timeout(500)
        layer = pg.query_selector("#coverFxLayer")
        check("S4 收尾后动态层常驻", layer is not None)
        if layer:
            check("S4 场景视频常驻播放", layer.query_selector(".ci-scene-video") is not None)
            check("S4 粒子画布常驻", layer.query_selector(".ci-fx") is not None)
            check("S4 标题卡已移除", layer.query_selector(".ci-titlecard") is None)
            pst = pg.eval_on_selector("#coverFxLayer .ci-scene-video","el=>({paused:el.paused,t:el.currentTime})")
            check("S4 场景视频未暂停(整幅在动)", not pst["paused"], pst)
        check("S4 封面四入口在位", len(pg.query_selector_all("#menu .entry"))==4)
        bz = pg.eval_on_selector(".brand","el=>+getComputedStyle(el).zIndex")
        lz = pg.eval_on_selector("#coverFxLayer","el=>+getComputedStyle(el).zIndex")
        check("S4 标题层级高于视频层", bz>lz, f"brand={bz} layer={lz}")
        check("S4 四入口可见", op(pg,"#menu")>0.9, op(pg,"#menu"))
        # 定格后整幅画面在动（视频+粒子），非静态图
        import numpy as np
        from PIL import Image
        f1 = np.asarray(Image.open(io.BytesIO(pg.screenshot())).convert("RGB"), dtype=int)
        pg.wait_for_timeout(900)
        f2 = np.asarray(Image.open(io.BytesIO(pg.screenshot())).convert("RGB"), dtype=int)
        changed = float((np.abs(f1-f2).max(axis=2)>5).mean()*100)
        check("S4 定格后整幅在动(像素差>10%)", changed>10.0, f"{changed:.1f}%")
        # 粒子常驻：只要停在封面页，动效就一直保持（引擎从不 stop）
        check("S4 粒子持续运行(live)", pg.evaluate("()=>window.CoverIntro.particlesLive"))
        pa1 = pg.evaluate("()=>({a:window.CoverIntro._engine.alpha,r:window.CoverIntro._engine.running})")
        pg.wait_for_timeout(3000)
        pa2 = pg.evaluate("()=>({a:window.CoverIntro._engine.alpha,r:window.CoverIntro._engine.running})")
        check("S4 停留封面3秒粒子仍运行不衰减", pa2["r"] and pa2["a"]>0.9, f"before={pa1} after={pa2}")

        # ⑤ 每次启动都播
        pg.reload(wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(500)
        check("S5 重载仍播放(每次都播)", pg.query_selector("#coverIntro") is not None)

        # ⑥ 跳过：点击后立即收尾
        pg2 = b.new_page(viewport={"width": 1280, "height": 800})
        pg2.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        pg2.wait_for_timeout(500)
        pg2.click(".ci-skip")
        pg2.wait_for_function("()=>!document.getElementById('coverIntro')", timeout=3000)
        check("S6 可跳过(点击后立即收尾)", pg2.query_selector("#coverIntro") is None)

        # ⑦ 竖屏 + 自动播完
        pg3 = b.new_page(viewport={"width":390,"height":844})
        pg3.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        pg3.wait_for_timeout(600)
        check("S7 竖屏标题卡在位", pg3.query_selector(".ci-titlecard h1") is not None)
        fit = pg3.eval_on_selector(".ci-scene-video","el=>getComputedStyle(el).objectFit")
        check("S7 竖屏视频cover铺满", fit=="cover", fit)
        # 竖屏必须用竖构图专用动态封面（girl_live_port.mp4），不是横版裁切
        vidsrc = pg3.evaluate("()=>{ var v=window.CoverIntro&&window.CoverIntro._sceneVideo; return v?(v.currentSrc||v.src||''):''; }")
        check("S7 竖屏用竖版专用视频源", "girl_live_port" in vidsrc, vidsrc)
        pg3.wait_for_function("()=>!document.getElementById('coverIntro')", timeout=8000)
        check("S7 自动播完淡出(约5s)", pg3.query_selector("#coverIntro") is None)
        check("S7 播完后动态层常驻", pg3.query_selector("#coverFxLayer") is not None)

        check("S8 全程无JS报错", len(errs)==0, errs[:2])
        b.close()
    print(f"\n结果: {len(FAIL)} 项失败")
    sys.exit(1 if FAIL else 0)

if __name__=="__main__":
    main()
