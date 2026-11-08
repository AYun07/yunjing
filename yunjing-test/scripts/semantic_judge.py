#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.09.0 · 语义判定层（白名单模型二次复核）

定位：规则判定器（truthdiff.py / t_player.py）只能抓确定性的模式，抓不住
「读起来不对劲」的语义幻觉。本脚本用同一个硬白名单模型 agnes-3.0-flash
对玩家所见正文做二次复核，输出**追加告警**。

纪律：
  · 规则层结果照单全收，绝不因为语义层说「没问题」就删掉或放宽；
  · 只用 agnes-3.0-flash；并发 1、请求间隔 ≥4s、超时 180s；
  · 真实模型调用必须等广度旅程跑完后再启动，避免并发突破硬约束；
  · --stub 用确定性桩跑自检与变异灵敏度，不调用任何模型。

用法：
  python3 semantic_judge.py --stub                  # 自检 + 变异验证（不调模型）
  YJ_TEST_KEY=<key> python3 semantic_judge.py --real --limit 30
"""
import argparse, glob, json, os, re, sys, time
import requests

E = os.environ.get("YJ_TEST_ENDPOINT", "https://apihub.agnes-ai.com/v1")
MODEL = "agnes-3.0-flash"
GAP = float(os.environ.get("YJ_GAP", "4.0"))
TIMEOUT = int(os.environ.get("YJ_TIMEOUT", "180"))
OUT = "/workspace/云境-v4.09.0-语义复核.json"

PROMPT = """你是中文小说正文的审校员。下面是一段玩家在游戏里读到的小说正文。
请只检查以下四类「硬伤」，逐条报告；没有问题就报告空列表。

A 界面/结算字段泄漏：出现 HP x/y、金币剩余、经验 +N、系统提示块、【装备面板】、
   「奖励：…」「已购买：…」这类本该由界面显示、不该写进小说的字段。
B 元叙述 / AI 口吻：出现「作为AI」「根据上文」「接下来我将」「(Thinking process:)」
   思维链、对读者的说明、章节总结、自我评论。
C 自相矛盾：同一段里具体数字前后对不上、人物身份/地点突然跳变且无过渡。
D 凭空专名：突然出现带引号的具体地名/势力/人名，且与正文所处世界的语境明显不符。

不要报告：文学修辞、模糊数量（些许/几人/数日）、心理描写、环境描写、
人物对话里合理的推测、以及正常的中文数字（三日后、第五层）。

严格输出 JSON，不要任何解释或代码围栏：
{"issues":[{"type":"A|B|C|D","quote":"正文里的原句片段（不超过30字）","why":"一句话理由"}]}
没有问题输出 {"issues":[]}

正文：
---
%s
---
"""

# v4.09.0：产品降级提示不是模型正文，送去语义复核没有意义，必须过滤
DEGRADED_NOTE = re.compile(r"这一轮没有生成正文|模型只返回了推理或协议内容|请重新发送指令重试")

# 桩：确定性关键词判定，仅用于验证脚本自身的解析/汇总/告警链路
STUB_RULES = [
    ("A", re.compile(r"HP\s*\d+\s*/\s*\d+|金币剩余|经验\s*\+\d+|【奖励|「奖励：")),
    ("B", re.compile(r"Thinking process|作为\s*AI|根据上文|接下来我将")),
    ("C", re.compile(r"金币\s*58.*金币\s*99|先说.*却说")),
    ("D", re.compile(r"「(?:霜狼谷|血月城|天机阁)」")),
]


def stub_judge(text):
    issues = []
    for typ, pat in STUB_RULES:
        m = pat.search(text)
        if m:
            issues.append({"type": typ, "quote": m.group(0)[:30], "why": "桩规则命中"})
    return {"issues": issues}


def parse_reply(raw):
    """容错解析模型 JSON（可能带代码围栏 / 前后废话）"""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s, flags=re.I | re.M).strip()
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except Exception:
        return None
    if not isinstance(d, dict) or not isinstance(d.get("issues"), list):
        return None
    out = []
    for x in d["issues"]:
        if isinstance(x, dict) and x.get("type") in ("A", "B", "C", "D"):
            out.append({"type": x["type"], "quote": str(x.get("quote", ""))[:60],
                        "why": str(x.get("why", ""))[:120]})
    return {"issues": out}


def real_judge(text, key, session):
    r = session.post(E + "/chat/completions", json={
        "model": MODEL,
        "messages": [{"role": "user", "content": PROMPT % text[:2200]}],
        "max_tokens": 380, "temperature": 0, "stream": False,
    }, timeout=TIMEOUT)
    r.raise_for_status()
    raw = r.json()["choices"][0]["message"]["content"]
    return parse_reply(raw)


def selftest():
    """正反样本 + 变异灵敏度：判定链路不能恒真盖章。"""
    pos = [
        "他喘着气，HP 346/470，金币剩余 28。",
        "(Thinking process: The user wants me to continue...)",
        "「霜狼谷」的风吹过来，他眯了眯眼。",
    ]
    neg = [
        "三日后，他回到松木林，风雪渐起。",
        "「这柄剑，你开个价吧。」他笑了笑，把些许金币推过去。",
        "两人对视一眼，谁也没先开口。",
    ]
    for t in pos:
        assert stub_judge(t)["issues"], "桩未检出: " + t
    for t in neg:
        assert not stub_judge(t)["issues"], "桩误报: " + t
    # 结构解析
    assert parse_reply('{"issues":[{"type":"A","quote":"HP 1/2","why":"x"}]}')["issues"]
    assert parse_reply('```json\n{"issues":[]}\n```')["issues"] == []
    assert parse_reply("没有 JSON") is None
    # 变异：桩恒返回空 → 同一组断言必须失败
    def mutant(_):
        return {"issues": []}
    try:
        for t in pos:
            assert mutant(t)["issues"], "变异体未生效"
    except AssertionError:
        return True
    raise AssertionError("变异体未被检出：语义判定自检形同虚设")


def collect_samples(limit):
    """读取广度旅程落盘的玩家所见正文 + 规则层结果"""
    files = sorted(glob.glob("/tmp/yj_journey_*.txt"))
    files = [f for f in files if not f.endswith(".raw.txt")]
    out = []
    skipped = 0
    # v4.09.0：/tmp 里混着上一轮 all 与深度旅程的同名旧正文。
    # 两道过滤：① 本轮 GENERIC 三步；② mtime 晚于本轮旅程启动（YJ_SINCE，epoch 秒）。
    VALID_STEPS = {"open", "act", "act2"}
    SINCE = float(os.environ.get("YJ_SINCE", "0"))
    picked = [f for f in files
              if os.path.basename(f)[:-4].rsplit("_", 1)[-1] in VALID_STEPS
              and (not SINCE or os.path.getmtime(f) >= SINCE)]
    for f in picked:
        base = os.path.basename(f)[len("yj_journey_"):-4]
        parts = base.rsplit("_", 1)
        txt = open(f, encoding="utf-8", errors="replace").read().strip()
        if DEGRADED_NOTE.search(txt):
            skipped += 1
            continue
        if len(txt) < 40:
            continue
        out.append({"genre": parts[0] if len(parts) > 1 else "?",
                    "step": parts[1] if len(parts) > 1 else "?", "text": txt})
        if len(out) >= limit:
            break
    print("样本过滤：可用 %d 条，跳过产品降级提示 %d 条" % (len(out), skipped))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stub", action="store_true", help="桩自检，不调用模型")
    ap.add_argument("--real", action="store_true", help="真实模型复核")
    ap.add_argument("--limit", type=int, default=30, help="抽样正文条数")
    a = ap.parse_args()

    selftest()
    print("语义判定自检：正反样本 + 结构解析 + 变异灵敏度 → 通过")

    samples = collect_samples(a.limit)
    print("待复核正文 %d 条（来源 /tmp/yj_journey_*.txt）" % len(samples))
    if not samples:
        print("⚠ 没有可用正文样本，请先跑 t_player.py all")
        return

    rule_issues = []
    if os.path.exists("/tmp/yj_journey.json"):
        try:
            rule_issues = json.load(open("/tmp/yj_journey.json", encoding="utf-8")).get("issues", [])
        except Exception:
            pass

    key = os.environ.get("YJ_TEST_KEY", "")
    if a.real and not key:
        print("⚠ 未设置 YJ_TEST_KEY")
        sys.exit(2)
    session = requests.Session()
    if key:
        session.headers.update({"Authorization": "Bearer " + key, "Content-Type": "application/json"})

    results, errors = [], []
    for i, s in enumerate(samples, 1):
        try:
            r = real_judge(s["text"], key, session) if a.real else stub_judge(s["text"])
            if r is None:
                errors.append({"i": i, "why": "模型输出无法解析为 JSON"})
                r = {"issues": []}
            results.append({"genre": s["genre"], "step": s["step"],
                            "issues": r["issues"], "textLen": len(s["text"])})
        except Exception as e:
            errors.append({"i": i, "why": "%s: %s" % (type(e).__name__, str(e)[:120])})
        if a.real:
            print("  %d/%d %-18s %-6s 告警 %d" % (
                i, len(samples), s["genre"], s["step"], len(results[-1]["issues"]) if results else 0), flush=True)
            time.sleep(GAP)

    semantic_alerts = [(r, x) for r in results for x in r["issues"]]
    report = {
        "mode": "real" if a.real else "stub",
        "model": MODEL, "gap": GAP, "samples": len(samples),
        "ruleIssues": len(rule_issues),          # 规则层结果照单全收，不修改
        "semanticAlerts": len(semantic_alerts),  # 语义层追加告警
        "parseErrors": errors,
        "results": results,
    }
    json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 汇总 ===")
    print("模式 %s ｜ 样本 %d ｜ 规则层问题 %d ｜ 语义层追加告警 %d ｜ 解析失败 %d" % (
        report["mode"], report["samples"], report["ruleIssues"],
        report["semanticAlerts"], len(errors)))
    for r, x in semantic_alerts[:20]:
        print("  %s/%s [%s] %s — %s" % (r["genre"], r["step"], x["type"], x["quote"], x["why"]))
    print("报告:", OUT)


if __name__ == "__main__":
    main()
