# -*- coding: utf-8 -*-
"""云境 v4.11.0 · 真实页面「版本可见性」验收
用真 chromium 打开首页/工作室/自检页，确认用户实际看到的版本号一致且为 4.11.0，
DOM 里不存在残留旧号；并确认 SW 脚本本身返回 200（SW_VER 已变，老 PWA 会换代）。
运行：python3 yunjing-test/scripts/t_version_browser.py
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
VER = "4.11.0"
OLD = "4.10.0"

results = []
def rec(tag, ok, detail):
    results.append((tag, ok, detail))
    print(("  [OK]     " if ok else "  [DEFECT] ") + tag + "  ::  " + detail)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(service_workers="block")
        errs = []

        # 首页 index.html
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append("index:" + str(e)))
        pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(600)
        yj = pg.evaluate("window.YJ_VER")
        rec("index YJ_VER", yj == VER, "YJ_VER=" + str(yj))
        badge = pg.inner_text("#verBadge").strip() if pg.locator("#verBadge").count() else "(缺)"
        rec("index 页脚徽标", VER in badge and OLD not in badge, badge)
        title = pg.title()
        rec("index 页面标题", VER in title and OLD not in title, title)

        # 工作室 studio.html
        pg2 = ctx.new_page()
        pg2.on("pageerror", lambda e: errs.append("studio:" + str(e)))
        pg2.goto(BASE + "/studio.html", wait_until="domcontentloaded", timeout=30000)
        pg2.wait_for_timeout(600)
        yj2 = pg2.evaluate("window.YJ_VER")
        rec("studio YJ_VER", yj2 == VER, "YJ_VER=" + str(yj2))
        dot = pg2.inner_text("#verDot").strip() if pg2.locator("#verDot").count() else "(缺)"
        rec("studio 顶栏徽标", VER in dot and OLD not in dot, dot)
        title2 = pg2.title()
        rec("studio 页面标题", VER in title2 and OLD not in title2, title2)

        # 双页一致性
        rec("首页/工作室版本一致", yj == yj2 == VER, f"index={yj} studio={yj2}")

        # 自检页引擎号
        pg3 = ctx.new_page()
        pg3.on("pageerror", lambda e: errs.append("selftest:" + str(e)))
        pg3.goto(BASE + "/selftest.html", wait_until="domcontentloaded", timeout=30000)
        pg3.wait_for_timeout(400)
        ev = pg3.evaluate("typeof ENGINE_VER!=='undefined'?ENGINE_VER:null")
        rec("selftest ENGINE_VER", ev == VER, "ENGINE_VER=" + str(ev))

        # sw.js 可达 + SW_VER 文本正确（用 fetch 读，不注册 SW）
        sw = pg.request.get(BASE + "/sw.js")
        swtxt = sw.text()
        rec("sw.js 可达", sw.status == 200, "HTTP " + str(sw.status))
        rec("sw.js SW_VER 同号", ("yunjing-v" + VER) in swtxt and ("yunjing-v" + OLD) not in swtxt,
            next((l.strip()[:40] for l in swtxt.splitlines() if "SW_VER =" in l), "(未找到)"))

        rec("三页零 pageerror", len(errs) == 0, str(errs[:3]))

        # DOM 可见文本里不应残留 4.10.0 旧号（历史 changelog 不在这些页）
        visible_old = pg.evaluate("document.body.innerText.includes('" + OLD + "')")
        rec("index 可见文本无旧号", not visible_old, "含旧号=" + str(visible_old))

        b.close()

    ok = sum(1 for _, o, _ in results if o)
    print(f"\n=== 汇总 ===\n检查 {len(results)} 项 ｜ 通过 {ok} ｜ 失败 {len(results)-ok}")
    if ok != len(results):
        sys.exit(1)

if __name__ == "__main__":
    import sys
    main()
