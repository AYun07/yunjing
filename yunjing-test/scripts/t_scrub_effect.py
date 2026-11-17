#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.09.0 · 数值清洗层真实效果量化（离线，不调模型、不启浏览器）

诚实口径：t_player.py 判定的是「玩家所见正文 shown」，模型原始返回 raw 只落盘诊断。
清洗层让判定器变绿是真实修复（玩家看不到错误数字了），但不等于模型不再编造。
本脚本逐份对比 raw / shown，量化「模型仍编造、被产品兜底挡住」的数量，
避免把「清洗生效」误写成「模型变好了」。

另统计「产品降级提示」：模型只吐思维链时产品返回明确提示而非空白卡片，
这同样是兜底（不是模型正常输出），必须单独计数、不能混进通过数。

输入：/tmp/yj_journey_<界>_<步>.txt (shown) 与 .raw.txt (raw，仅在两者不同时落盘)
输出：/workspace/云境-v4.09.0-清洗效果.json
"""
import glob, json, os, re

OUT = "/workspace/云境-v4.09.0-清洗效果.json"

# 确定性 UI 字段 / 结算增量 / UI 进度对（与 number-scrubber.js 的 A/B/D 类同口径）
UI_PAT = re.compile(
    r"(?:HP|MP|怒气|气力|体力|血条|蓝条|血量|法力|总金币|金币剩余|当前总金币|当前金币|余额|背包格数|格数)"
    r"\s*[：:]?\s*[+＋]?\s*\d{1,7}(?:\s*[／/]\s*\d{1,7})?"
    r"|(?:经验|声望|金币|灵石|攻击|防御|伤害|体力|气血|怒气|生命)\s*[：:]?\s*[+＋]\s*\d{1,7}"
    r"|(?:背包|格数|进度|委托进度|任务进度|目前|当前)\s*[：:]?\s*\d{1,4}\s*[／/]\s*\d{1,4}"
)
MONEY_PAT = re.compile(r"\d{1,7}\s*(?:枚|个|颗|块|锭)?\s*(?:金币|灵石|银币|铜钱|元宝|晶石)")
# v4.09.0：产品侧空正文降级提示（与 ai-response-handler.js 的文案同源）
DEGRADED = re.compile(r"这一轮没有生成正文|模型只返回了推理或协议内容|请重新发送指令重试")


def measure(raw, shown):
    return {
        "uiRaw": len(UI_PAT.findall(raw)), "uiShown": len(UI_PAT.findall(shown)),
        "moneyRaw": len(MONEY_PAT.findall(raw)), "moneyShown": len(MONEY_PAT.findall(shown)),
    }


def delta(m):
    return {"ui": max(0, m["uiRaw"] - m["uiShown"]),
            "money": max(0, m["moneyRaw"] - m["moneyShown"])}


def selftest():
    """反向灵敏度：统计逻辑必须能检出差异，不能恒返回 0。"""
    global DEGRADED
    raw = "他喘着气，HP 346/470，总金币 99，经验 +10000，木剑才卖 5 金币。"
    shown = "他喘着气靠在墙上，木剑才卖些许金币，他掂了掂。"
    m = measure(raw, shown)
    assert delta(m)["ui"] >= 3, m
    assert delta(m)["money"] >= 1, m
    assert delta(measure("三日后，他回到松木林。", "三日后，他回到松木林。")) == {"ui": 0, "money": 0}
    # 降级提示：正向命中 + 正常正文零误伤 + 变异体必须被检出
    note = "（这一轮没有生成正文：模型只返回了推理或协议内容，请重新发送指令重试。）"
    assert DEGRADED.search(note), "降级提示未命中"
    assert not DEGRADED.search("三日后，他回到松木林，风雪渐起。"), "正常正文误报"
    _orig = DEGRADED
    DEGRADED = re.compile(r"NEVER_MATCH_SENTINEL_x7f")
    try:
        assert DEGRADED.search(note)
    except AssertionError:
        pass
    else:
        raise AssertionError("变异体未被检出：降级统计形同虚设")
    finally:
        DEGRADED = _orig
    # 变异：统计恒返回 0 → 同一组断言必须失败
    def mutant(a, b):
        return {"uiRaw": 0, "uiShown": 0, "moneyRaw": 0, "moneyShown": 0}
    try:
        assert delta(mutant(raw, shown))["ui"] >= 3
    except AssertionError:
        return True
    raise AssertionError("变异体未被检出：清洗效果统计形同虚设")


def main():
    selftest()
    print("统计自检：正向检出 + 零误伤 + 变异灵敏度 → 通过")
    files = sorted(glob.glob("/tmp/yj_journey_*.txt"))
    files = [f for f in files if not f.endswith(".raw.txt")]
    # 两道过滤：① 本轮 GENERIC 三步（排除深度旅程 class/combat/quest 等旧名）；
    # ② mtime 晚于本轮旅程启动（YJ_SINCE，epoch 秒），排除上一轮 all 的同名旧文件。
    VALID_STEPS = {"open", "act", "act2"}
    SINCE = float(os.environ.get("YJ_SINCE", "0"))
    files = [f for f in files
             if os.path.basename(f)[:-4].rsplit("_", 1)[-1] in VALID_STEPS
             and (not SINCE or os.path.getmtime(f) >= SINCE)]
    rows = []
    degraded = 0
    for f in files:
        shown = open(f, encoding="utf-8", errors="replace").read()
        if DEGRADED.search(shown):
            degraded += 1
        rf = f[:-4] + ".raw.txt"
        raw = open(rf, encoding="utf-8", errors="replace").read() if os.path.exists(rf) else shown
        m = measure(raw, shown)
        d = delta(m)
        if m["uiRaw"] or m["moneyRaw"] or d["ui"] or d["money"]:
            rows.append({"file": os.path.basename(f), **m, **d,
                         "hadRawDump": os.path.exists(rf)})
    tot = {
        "samples": len(files),
        "withRawDump": sum(1 for f in files if os.path.exists(f[:-4] + ".raw.txt")),
        "degradedSamples": degraded,
        "uiRawTotal": sum(r["uiRaw"] for r in rows),
        "uiShownTotal": sum(r["uiShown"] for r in rows),
        "uiRemoved": sum(r["ui"] for r in rows),
        "moneyRawTotal": sum(r["moneyRaw"] for r in rows),
        "moneyShownTotal": sum(r["moneyShown"] for r in rows),
        "moneyRewritten": sum(r["money"] for r in rows),
        "filesWithFindings": len(rows),
    }
    report = {"summary": tot, "rows": rows}
    json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 清洗层真实效果 ===")
    print("正文样本 %d ｜ 有原始输出留档 %d ｜ 命中文件 %d ｜ 产品降级提示 %d" % (
        tot["samples"], tot["withRawDump"], tot["filesWithFindings"], tot["degradedSamples"]))
    print("UI 字段：raw %d → shown %d（剥离 %d）" % (
        tot["uiRawTotal"], tot["uiShownTotal"], tot["uiRemoved"]))
    print("货币数量：raw %d → shown %d（改写 %d）" % (
        tot["moneyRawTotal"], tot["moneyShownTotal"], tot["moneyRewritten"]))
    for r in rows[:12]:
        print("  %-40s ui %d→%d  money %d→%d" % (
            r["file"], r["uiRaw"], r["uiShown"], r["moneyRaw"], r["moneyShown"]))
    print("报告:", OUT)


if __name__ == "__main__":
    main()
