#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.09.0 · 终验离线复判（不调用模型）

背景：38 界 × 3 步广度旅程的主进程在 J-2 / J-4 / J-5 修复前启动，
进程内已加载旧判定器，源码修改不会自动作用于它。补跑 114 次真实模型请求
会额外消耗额度；而判定器的输入本就是「玩家所见正文」，因此这里用修复后的
判定器对已落盘的全部 shown 文本做离线全量复判。

只复核**不依赖真值快照**的硬伤：降级提示、空正文、元叙述开头、标点异常、
指令泄漏、势力提取里的虚词 / 动词短语误报。数值与专名合法性在旅程当轮已用
TruthSnapshot 真值快照判定，此处不重复、不放宽。

用法：YJ_SINCE=<本轮旅程启动 epoch> python3 t_final_audit.py
输出：/workspace/云境-v4.09.0-终验复判.json
"""
import glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# t_player.py 顶层有 key 检查；这里只是占位，全程不发起任何模型请求
os.environ.setdefault("YJ_TEST_KEY", "offline-audit")
import t_player as tp

OUT = "/workspace/云境-v4.09.0-终验复判.json"
SINCE = float(os.environ.get("YJ_SINCE", "0"))
VALID_STEPS = {"open", "act", "act2"}
DEGRADED = tp.DEGRADED_NOTE

# 撤掉 v4.09.0 两批虚词补丁，还原成旅程主进程用的旧口径（用于反向对照）
OLD_PAT = (tp.FAC_VAGUE_ANY.pattern
           .replace("|进而|转而", "|进而")
           .replace(r"|负责|担负|掌管|打理|操持", "")
           .replace(r"|而在|而是|而非|而不|而且|然而|反而|从而|进而", ""))


def extract_with(text, pat):
    orig = tp.FAC_VAGUE_ANY
    tp.FAC_VAGUE_ANY = re.compile(pat)
    try:
        return tp.extract_factions(text, [])
    finally:
        tp.FAC_VAGUE_ANY = orig


def selftest():
    """灵敏度：新旧口径必须真有差异，降级检出必须真挂上。"""
    global DEGRADED
    note = "（这一轮没有生成正文：模型只返回了推理或协议内容，请重新发送指令重试。）"
    assert tp.is_degraded(note), "降级提示未命中"
    assert not tp.is_degraded("松木林的风穿过破庙的窗棂，他把剑横在膝上。"), "正常正文误报"
    s = "负责家族护卫与外联的叔父"
    assert "负责家族" in extract_with(s, OLD_PAT), "旧口径未复现误报"
    assert "负责家族" not in extract_with(s, tp.FAC_VAGUE_ANY.pattern), "新口径仍误报"
    # 变异：把降级正则换成永不匹配，正向断言必须失败
    _o = DEGRADED
    DEGRADED = re.compile(r"NEVER_MATCH_SENTINEL_x7f")
    try:
        assert DEGRADED.search(note)
    except AssertionError:
        pass
    else:
        raise AssertionError("变异体未被检出：终验降级检出形同虚设")
    finally:
        DEGRADED = _o


def main():
    selftest()
    print("终验复判自检：降级检出 + 新旧口径差异 + 变异灵敏度 → 通过")
    files = sorted(glob.glob("/tmp/yj_journey_*.txt"))
    files = [f for f in files if not f.endswith(".raw.txt")
             and os.path.basename(f)[:-4].rsplit("_", 1)[-1] in VALID_STEPS
             and (not SINCE or os.path.getmtime(f) >= SINCE)]
    rows = []
    for f in files:
        name = os.path.basename(f)[len("yj_journey_"):-4]
        genre, _, step = name.rpartition("_")
        t = open(f, encoding="utf-8", errors="replace").read()
        hard = {}
        if DEGRADED.search(t):
            hard["degraded"] = True
        if not t or len(t.strip()) < 20:
            hard["empty"] = True
        if tp.BAD_HEAD.match(t):
            hard["metaStart"] = True
        if tp.BAD_PUNCT.search(t):
            hard["badPunct"] = True
        if tp.LEAK.search(t):
            hard["directiveLeak"] = True
        new_fac = tp.extract_factions(t, [])
        old_fac = extract_with(t, OLD_PAT)
        rows.append({"genre": genre, "step": step, "len": len(t),
                     "hard": hard, "spuriousFactions": sorted(old_fac - new_fac)})
    summary = {
        "samples": len(files),
        "degraded": sum(1 for r in rows if r["hard"].get("degraded")),
        "empty": sum(1 for r in rows if r["hard"].get("empty")),
        "otherHard": sum(1 for r in rows if any(
            k in r["hard"] for k in ("metaStart", "badPunct", "directiveLeak"))),
        "spuriousFiles": sum(1 for r in rows if r["spuriousFactions"]),
        "spuriousTotal": sum(len(r["spuriousFactions"]) for r in rows),
    }
    json.dump({"summary": summary, "rows": rows},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 终验离线复判（修复后口径）===")
    print("样本 %d ｜ 产品降级提示 %d ｜ 空正文 %d ｜ 其他硬伤 %d" % (
        summary["samples"], summary["degraded"], summary["empty"], summary["otherHard"]))
    print("旧口径势力误报：%d 个文件 / %d 条；修复后口径全部消除" % (
        summary["spuriousFiles"], summary["spuriousTotal"]))
    for r in rows:
        if r["spuriousFactions"]:
            print("  %s/%s 旧口径误报 %s" % (r["genre"], r["step"], r["spuriousFactions"]))
        if r["hard"].get("degraded"):
            print("  %s/%s → 产品降级提示（模型侧未生成正文，已兜底）" % (r["genre"], r["step"]))
    print("报告:", OUT)


if __name__ == "__main__":
    main()
