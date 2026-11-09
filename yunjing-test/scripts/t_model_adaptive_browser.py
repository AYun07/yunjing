# -*- coding: utf-8 -*-
"""云境 v4.11.1 · 模型无关自适应「真浏览器」验收
在真 chromium 里确认：① 模块真加载并暴露新接口；② 设置界面文案已纠正为「模型零限制」；
③ 双向升降在真实运行时可触发（同一套 localStorage 缓存）；④ 无 pageerror。
运行：python3 yunjing-test/scripts/t_model_adaptive_browser.py
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
results = []
def rec(tag, ok, detail):
    results.append((tag, ok, detail))
    print(("  [OK]     " if ok else "  [DEFECT] ") + tag + "  ::  " + detail)

GOOD = (
    "青石镇的晨雾还没散，他沿着被夜雨打湿的巷子往渡口走，檐角滴下的水落在肩头，"
    "凉意顺着衣领往里钻。街尾的茶棚刚支起来，炉火噼啪，掌柜的抬眼看了看天色，没多问，"
    "只把一碗热汤推到桌边。他端起碗，指节被烫得一缩，却没放下。远处传来渡船的橹声，"
    "一下，又一下，像谁在不紧不慢地数着时辰。他把铜钱压在碗底，起身时衣摆扫过凳脚，"
    "带起一点湿灰。河风迎面，带着水腥和上游松林的气味，他眯了眯眼，把怀里的信又按了按，"
    "确认没被雨浸透，这才朝石阶下走去。石阶尽头的老柳被风掀起半边枝条，露出系在树干上的"
    "旧红布条，颜色褪得发白，却还牢牢打着结。他记起那年也是这条船，也是这个时辰，只是送行的人"
    "如今不在了。橹声渐近，船头挑着一盏未熄的灯，在水雾里晃出一圈暖黄。他深吸一口气，"
    "把领口拢紧，抬脚踩上湿漉漉的跳板，木板发出一声低哑的吱呀，像是替他把这句没说出口的话"
    "应了下来。\n\n(variable_update)\n回合=回合+1\n位置=青石镇渡口\n(/variable_update)\n"
    "【行动选项】\n1. 【快进】径直登船离镇\n2. 【交互】向掌柜打听渡船时辰\n3. 【整活】顺手替茶棚挑两桶水\n"
    "4. 【慢推】沿河再走一段看水势\n5. 【时空】回想三年前离镇那日\n6. 【成人】与船上故人叙旧\n"
    "<status>\n回合：2 ｜ 位置：青石镇渡口 ｜ 状态：清醒\n</status>"
)

def main():
    import sys
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(service_workers="block")
        errs = []
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/studio.html", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(800)

        # ① 模块真加载 + 新接口就位
        api = pg.evaluate("""() => {
            const m = window.BaseModelMode;
            return m ? {ok:true, hasLooks:typeof m.looksCapable==='function',
                        hasReset:typeof m._resetProbe==='function',
                        hasNoteStable:typeof m.noteStable==='function'} : {ok:false};
        }""")
        rec("BaseModelMode 真加载且暴露新接口",
            api.get("ok") and api.get("hasLooks") and api.get("hasReset") and api.get("hasNoteStable"), str(api))

        # ② 设置界面文案已纠正。configModal 是 open() 时动态注入 DOM，先打开再读。
        opened = pg.evaluate("""() => {
            try {
                const C = window.ConfigModal;
                if (C && typeof C.open === 'function') { C.open(); return 'opened'; }
            } catch (e) { return 'open-err:' + e.message; }
            return 'no-open-api';
        }""")
        pg.wait_for_timeout(400)
        html = pg.evaluate("""() => {
            const el = document.getElementById('cfg_baseMode');
            if (!el) return '';
            const row = el.closest('.form-row') || el.parentElement;
            return row ? (row.textContent||'') : '';
        }""")
        rec("设置界面文案含「模型零限制」", "模型零限制" in html,
            ("面板=" + opened + " | ") + html.strip()[:80].replace("\n", " "))
        rec("设置界面不再宣称「自定义接口走安全档」", "自定义接口走安全档" not in html,
            "旧文案已移除" if "自定义接口走安全档" not in html else "仍存在")

        # ③ 真运行时双向升降：用受控 apiConfig（未知域名+未知模型）+ 手动 auto
        seq = pg.evaluate("""(good) => {
            const m = window.BaseModelMode, fw = window.storyFramework;
            if (!m || !fw) return {err:'missing'};
            const saved = fw.apiConfig;
            fw.apiConfig = Object.assign({}, saved, {
                endpoint:'https://unknown-gw.internal/api', model:'mystery-model-v1',
                baseModelMode:'auto'
            });
            m._resetProbe();
            const t0 = m.resolveTier();
            m.noteStable(good);
            const t1 = m.resolveTier();
            m.noteStable(good);
            const t2 = m.resolveTier();
            m.noteCollapse();
            const t3 = m.resolveTier();
            // 自定义域名 + 旗舰模型名 → full
            fw.apiConfig.model = 'gpt-4o';
            m._resetProbe();
            const t4 = m.resolveTier();
            fw.apiConfig = saved;
            m._resetProbe();
            return {t0,t1,t2,t3,t4};
        }""", GOOD)
        rec("真运行时 未知模型保守 lite", seq.get("t0") == "lite", "t0=" + str(seq.get("t0")))
        rec("真运行时 稳定2轮自动升 full", seq.get("t2") == "full", "t1=%s t2=%s" % (seq.get("t1"), seq.get("t2")))
        rec("真运行时 崩塌立即降 lite", seq.get("t3") == "lite", "t3=" + str(seq.get("t3")))
        rec("真运行时 自定义域名+旗舰模型名=full", seq.get("t4") == "full", "t4=" + str(seq.get("t4")))

        rec("零 pageerror", len(errs) == 0, str(errs[:2]))
        b.close()

    ok = sum(1 for _, o, _ in results if o)
    print(f"\n=== 汇总 ===\n检查 {len(results)} 项 ｜ 通过 {ok} ｜ 失败 {len(results)-ok}")
    if ok != len(results):
        sys.exit(1)

if __name__ == "__main__":
    main()
