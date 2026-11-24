#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 · 舆图验收（真实浏览器，不调模型、不需 Key）

覆盖 v6.7.0 三条实玩反馈，逐条断言、可失败：
  M-1  分区必须用真实地名 —— 不允许再出现「北部中域 / 南部东域」这类方位词
  M-2  同一层的地名名牌不得互相压住 —— 两两矩形相交数必须为 0
  M-3  每一层都必须有底图 —— 不允许出现只有渐变、没有图的空层
  M-4  逐层下钻不得出现空层 —— 层里有节点却一个都没画出来即判失败

用法：
  python3 yunjing-test/scripts/t_atlas_map.py            # 默认查 8 个抽样世界
  python3 yunjing-test/scripts/t_atlas_map.py --all      # 38 世界全查（约 60s）
  YJ_PORT=8899（默认）、YJ_ROOT 可覆盖仓库路径
"""
import os
import re
import sys
import json
import subprocess
import time
import urllib.request

ROOT = os.environ.get("YJ_ROOT") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = os.environ.get("YJ_PORT", "8899")
BASE = f"http://127.0.0.1:{PORT}"
DIRWORD = re.compile(r"^[东南西北中]{1,2}部[东南西北中]{0,2}(域|区|地带)$")
SAMPLE = ["fanrenxiuxian", "guimi", "earth", "douluodalu", "doupocangqiong", "shrouding", "wanmeishijie", "quanzhifashi"]

MEASURE = r"""
() => {
  const marks = [...document.querySelectorAll('#atlasDrillOverlay .ad-mark')];
  const boxes = marks.map(m => {
    const nm = m.querySelector('.ad-name');
    const rb = nm ? nm.getBoundingClientRect() : m.getBoundingClientRect();
    return {n: (nm ? nm.textContent : '').trim(), l: rb.left, t: rb.top, r: rb.right, b: rb.bottom};
  });
  let ov = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 0 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 0) ov++;
    }
  }
  const img = document.querySelector('.ad-art');
  return {
    badge: (document.querySelector('.ad-lvbadge') || {}).textContent || '',
    count: marks.length, overlap: ov, names: boxes.map(b => b.n),
    artOK: img ? (img.naturalWidth > 0 && img.style.display !== 'none') : false
  };
}
"""


def serve():
    """起静态站（若端口已占用则复用）"""
    try:
        urllib.request.urlopen(BASE + "/studio.html", timeout=2)
        return None
    except Exception:
        pass
    p = subprocess.Popen([sys.executable, "-m", "http.server", PORT, "--bind", "127.0.0.1"],
                         cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.25)
        try:
            urllib.request.urlopen(BASE + "/studio.html", timeout=2)
            return p
        except Exception:
            continue
    p.terminate()
    raise SystemExit(f"静态服务未起来（端口 {PORT}）")


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("⚠ 未安装 playwright，跳过舆图验收（pip install playwright && playwright install chromium）")
        return 0

    check_all = "--all" in sys.argv
    srv = serve()
    fails, checked = [], 0
    dirnames, empty, noart, over = [], [], [], []

    with sync_playwright() as p:
        try:
            b = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        except Exception as e:
            print(f"⚠ 无法启动浏览器，跳过：{str(e)[:120]}")
            if srv:
                srv.terminate()
            return 0
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(f"{BASE}/studio.html?dev=1", wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_function("() => !!window.AtlasDrill && !!window.AtlasVerifiedAdapter", timeout=60000)
        # 校对数据自 v6.7.0 起按需加载：先显式等到位，否则读到空表会「零世界全绿」的假通过
        pg.evaluate("() => new Promise(r => (window.AtlasVerifiedAdapter.loadData || function (cb) { cb(); })(r))")
        pg.wait_for_function("() => Object.keys(window.ATLAS_VERIFIED || {}).length > 0", timeout=60000)
        genres = pg.evaluate("() => Object.keys(window.ATLAS_VERIFIED || {})")
        targets = genres if check_all else [g for g in SAMPLE if g in genres]

        for g in targets:
            pg.evaluate(f"window.AtlasDrill.show('{g}')")
            pg.wait_for_timeout(120)
            pg.wait_for_function("() => { const o = document.getElementById('atlasDrillOverlay'); "
                                 "return o && o.style.display === 'flex'; }", timeout=20000)
            pg.wait_for_timeout(420)
            for lv in range(3):
                m = pg.evaluate(MEASURE)
                checked += 1
                if m["overlap"]:
                    over.append(f"{g} L{lv + 1} 重叠 {m['overlap']} 对")
                if m["count"] == 0:
                    empty.append(f"{g} L{lv + 1}")
                if not m["artOK"]:
                    noart.append(f"{g} L{lv + 1}")
                for n in m["names"]:
                    if DIRWORD.match(n):
                        dirnames.append(f"{g} L{lv + 1} 「{n}」")
                nxt = pg.evaluate("""() => {
                    const ms = [...document.querySelectorAll('#atlasDrillOverlay .ad-mark.ad-drillable')];
                    if (!ms.length) return false; ms[0].click(); return true; }""")
                pg.wait_for_timeout(320)
                if not nxt:
                    break
        b.close()
    if srv:
        srv.terminate()

    def rec(title, bad, sample=3):
        if bad:
            fails.append(title)
            print(f"  ✗ {title}：{len(bad)} 处 —— " + "；".join(bad[:sample]))
        else:
            print(f"  ✓ {title}")

    print(f"舆图验收：{len(targets)} 世界 / {checked} 层")
    if not targets or checked == 0:
        # 一个世界都没查成 = 验收没真正发生，必须判失败，不能算通过
        print("ATLAS_MAP_FAIL ✗ 没有任何世界被验收（数据未加载或入口失效）")
        return 1
    rec("M-1 分区用真实地名（无方位词）", dirnames)
    rec("M-2 名牌零重叠", over)
    rec("M-3 每层都有底图", noart)
    rec("M-4 无空层", empty)
    if errs:
        fails.append("pageerror")
        print(f"  ✗ 页面报错 {len(errs)} 条：{errs[:2]}")

    if fails:
        print(f"ATLAS_MAP_FAIL ✗ {len(fails)} 项未通过")
        return 1
    print("ATLAS_MAP_OK ✓ 真实地名 / 零重叠 / 底图齐备 / 无空层")
    return 0


if __name__ == "__main__":
    sys.exit(main())
