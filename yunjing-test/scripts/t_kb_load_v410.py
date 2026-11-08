# -*- coding: utf-8 -*-
"""云境 v4.10.0 · KB 数据治理后的真浏览器加载回归。

验证：38 界逐界真加载、F12 源码碎片运行时归零、F6 斗破《大主宰》倒灌归零、
wangyou 嵌套数组展开的 34 条原创地点可检索、零 pageerror。
运行：python3 yunjing-test/scripts/t_kb_load_v410.py
"""
import json, sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
IDX = json.load(open('/workspace/yunjing/js/kb/_index.json', encoding='utf-8'))
GENRES = sorted(IDX['genres'].keys())

results = []
def rec(tag, ok, detail):
    results.append((tag, ok, detail))
    print(("  [OK]     " if ok else "  [DEFECT] ") + tag + "  ::  " + detail)

PROBE = """() => {
  const S = window.StoryKnowledge;
  const kb = (S && S.knowledgeBase) ? S.knowledgeBase : [];
  const codeFrag = kb.filter(e => {
    const t = String((e && e.title) || '').trim();
    const m = t.match(/^(?:世界观铁律|世界观设定)\\s*·\\s*(.*)$/);
    if (!m) return false;
    return /^(?:const\\s|let\\s|var\\s|function\\b|=>|defaultSystemPrompt|defaultDynamicWorldPrompt|getElementById|document\\.|window\\.|onInit\\b|on[A-Z]|build[A-Z]|[A-Za-z_]\\w*StoryConfig|[A-Za-z_]\\w*\\s*[:=]\\s*[\\(\\{`]|[A-Za-z_]\\w*\\s*\\(|if\\s*\\(|return\\b|[\\{\\}])/.test(m[1]);
  }).length;
  // 仅斗破界需要「大主宰·」归零；dazhuzai 是独立界，本来就该有该前缀条目。
  const dazhu = kb.filter(e => /^大主宰·/.test(String((e && e.title) || '').trim())).length;
  // 展开的 34 条分属隐藏职业/中枢/东境/北境/中天，不能只数「东境」。
  const origPlaces = kb.filter(e => /^寰宇纪元·原创·/.test(String((e && e.title) || '').trim())).length;
  return {len: kb.length, codeFrag: codeFrag, dazhu: dazhu, origPlaces: origPlaces};
}"""

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
            pg.wait_for_timeout(700)
            stats[g] = pg.evaluate(PROBE)
        b.close()

    empty = [g for g, v in stats.items() if v['len'] <= 0]
    frag = [(g, v['codeFrag']) for g, v in stats.items() if v['codeFrag'] > 0]
    dz = [('doupocangqiong', stats['doupocangqiong']['dazhu'])] if stats.get('doupocangqiong', {}).get('dazhu', 0) > 0 else []
    total = sum(v['len'] for v in stats.values())

    print("\n=== KB 治理后真浏览器加载回归 ===")
    rec("38 界逐界可加载且知识库非空", len(GENRES) == 38 and not empty,
        "界数 %d ｜ 空库 %d ｜ 运行时合计 %d 条" % (len(GENRES), len(empty), total))
    rec("F12 运行时源码碎片归零（过滤+物理清洗双防御）", not frag,
        "残留 %s" % (frag[:4] if frag else "0"))
    rec("F6 斗破库《大主宰》条目归零", not dz,
        "残留 %s" % (dz[:4] if dz else "0"))
    rec("P2 wangyou 嵌套数组展开的原创条目可检索",
        stats.get('wangyou', {}).get('origPlaces', 0) >= 34,
        "wangyou「寰宇纪元·原创」%d 条（治理前嵌套 34 条不可检索）" %
        stats.get('wangyou', {}).get('origPlaces', 0))
    rec("全程零 pageerror", len(errs) == 0, "pageerror %d %s" % (len(errs), errs[:2]))
    rec("斗破库条目数较治理前下降（污染已删）",
        IDX['genres'].get('doupocangqiong', 0) < 673,
        "_index 斗破 %d 条（治理前 673）" % IDX['genres'].get('doupocangqiong', 0))

    bad = [r for r in results if not r[1]]
    print("\n检查 %d 项 ｜ 通过 %d ｜ 失败 %d" % (len(results), len(results) - len(bad), len(bad)))
    return 0 if not bad else 1

if __name__ == '__main__':
    sys.exit(main())
