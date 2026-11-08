# -*- coding: utf-8 -*-
"""云境 v4.10.0 · P1-5 按界注册表真浏览器复现 / 回归资产。

动态枚举真实全局符号（不信注释、不用正则数对象键），逐界读取各表状态。
修复前建立基线（预期有 DEFECT），修复后重跑应全 PASS。

诚实分类（非缺陷，只记录不作为判据）：
  - yunqi 文风块数据源：默认预设未收录任何「📕文风·」块 → 全 38 界 resolveStyleBlock() 恒空，属既有能力边界
  - ATLAS_ERAS 仅 10/38：需产品确认是否补时代层（开放界无固定时代，可能属设计）
  - WorldPlus.MODS 仅 6 界：少数界专属扩展模块，属设计如此

运行：python3 yunjing-test/scripts/t_registry_v410.py
"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
IDX = json.load(open('/workspace/yunjing/js/kb/_index.json', encoding='utf-8'))
GENRES = sorted(IDX['genres'].keys())
NEW5 = ["dazhuzai", "wangyou", "wanxiangzhiwang", "wudongqiankun", "yuanzun"]
NOVEL4 = ["dazhuzai", "wanxiangzhiwang", "wudongqiankun", "yuanzun"]

PROBE = """() => {
  const g = new URLSearchParams(location.search).get('genre') || 'free';
  const S = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const YB = window.YunqiPresetBridge, SS = window.StoryStance,
        SIG = window.StoryImageGen, WS = window.WorldSeals, AL = window.AmbienceLayer;
  const T = (SS && SS._tables) ? SS._tables : {};
  return {
    g: g,
    genreName: S(() => !!(YB && YB.GENRE_NAME && YB.GENRE_NAME[g]), false),
    worldName: S(() => YB ? YB.worldName() : null, null),
    styleBlock: S(() => YB ? YB.resolveStyleBlock() : null, null),
    canon: S(() => !!(T.CANON_HEROES && T.CANON_HEROES[g]), false),
    canonName: S(() => SS ? SS.canonHeroName() : null, null),
    major: S(() => !!(T.MAJOR_NODES && T.MAJOR_NODES[g]), false),
    side: S(() => !!(T.SIDE_CHARS && T.SIDE_CHARS[g]), false),
    imgStyle: S(() => !!(SIG && SIG.GENRE_STYLES && SIG.GENRE_STYLES[g]), false),
    moodDefault: S(() => (AL && AL.moodOf) ? (AL.moodOf(g).dust === '墨韵浮尘') : null, null),
    seals: S(() => !!(WS && typeof WS.genres === 'function' && WS.genres().indexOf(g) >= 0), false),
    eras: S(() => !!(window.ATLAS_ERAS && window.ATLAS_ERAS[g]), false)
  };
}"""

results = []
def rec(tag, ok, detail):
    results.append((tag, ok, detail))
    print(("  [OK]     " if ok else "  [DEFECT] ") + tag + "  ::  " + detail)

def miss(stats, key, genres, want=True):
    return [g for g in genres if stats[g][key] is not want]

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(service_workers="block")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        stats = {}
        for g in GENRES:
            pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_timeout(650)
            # world-seals.js 是 yj-lazy「demand」组，页面初始只有占位 function，
            # 必须注入真身才能读到真实的 SEALS 表（与 F11 / P1-10 同型）。
            is_stub = pg.evaluate("() => typeof window.WorldSeals === 'function'")
            if is_stub:
                pg.add_script_tag(url=BASE + "/js/world-seals.js")
                pg.wait_for_timeout(150)
            stats[g] = pg.evaluate(PROBE)
        b.close()

    print("\n=== P1-5 按界注册表真浏览器回归 ===")
    rec("G1  yunqi GENRE_NAME 五新界就位",
        not miss(stats, 'genreName', NEW5, want=True),
        "缺失: " + (",".join(miss(stats, 'genreName', NEW5)) or "无"))
    wn = [g for g in NEW5 if not stats[g]['worldName']]
    rec("G2  worldName() 五新界返回非空中文界名", not wn,
        "为空: " + (",".join(wn) or "无"))
    rec("G3  StoryStance.CANON_HEROES 四小说界就位",
        not miss(stats, 'canon', NOVEL4, want=True),
        "缺失: " + (",".join(miss(stats, 'canon', NOVEL4)) or "无") +
        " ｜ 主角: " + ",".join("%s=%s" % (g, stats[g]['canonName']) for g in NOVEL4))
    rec("G4  StoryStance.MAJOR_NODES 四小说界就位",
        not miss(stats, 'major', NOVEL4, want=True),
        "缺失: " + (",".join(miss(stats, 'major', NOVEL4)) or "无"))
    rec("G5  StoryStance.SIDE_CHARS 四小说界就位",
        not miss(stats, 'side', NOVEL4, want=True),
        "缺失: " + (",".join(miss(stats, 'side', NOVEL4)) or "无"))
    rec("G6  StoryImageGen.GENRE_STYLES 五新界就位",
        not miss(stats, 'imgStyle', NEW5, want=True),
        "缺失: " + (",".join(miss(stats, 'imgStyle', NEW5)) or "无"))
    md = [g for g in NEW5 if stats[g]['moodDefault'] is not False]
    rec("G7  AmbienceLayer.MOODS 五新界非默认氛围", not md,
        "仍套默认: " + (",".join(md) or "无"))
    rec("G8  WorldSeals.SEALS 五新界有专属印章",
        not miss(stats, 'seals', NEW5, want=True),
        "缺失: " + (",".join(miss(stats, 'seals', NEW5)) or "无"))
    rec("全程零 pageerror", len(errs) == 0, "pageerror %d %s" % (len(errs), errs[:2]))

    # 只记录、不作为判据的三类边界
    sb_empty = sum(1 for g in GENRES if not stats[g]['styleBlock'])
    eras = [g for g in GENRES if stats[g]['eras']]
    print("\n--- 边界事实（诚实记录，非缺陷判据）---")
    print("  文风块 resolveStyleBlock() 为空的界: %d/38（默认预设未收录 📕文风· 块）" % sb_empty)
    print("  ATLAS_ERAS 时代层覆盖: %d/38（缺的含开放界，待产品确认）  %s" %
          (len(eras), ",".join(eras)))
    print("  wangyou 主角名（原创网游界，不属原著主角）: %s" % stats['wangyou']['canonName'])

    bad = [r for r in results if not r[1]]
    print("\n检查 %d 项 ｜ 通过 %d ｜ 失败 %d" % (len(results), len(results) - len(bad), len(bad)))
    return 0 if not bad else 1

if __name__ == '__main__':
    sys.exit(main())
