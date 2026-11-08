#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.09.0 · 正文清洗 / 降级回归探针（真实浏览器，不调用模型）

覆盖两条真实缺陷，逐例断言、可失败：
  J-1  模型只吐英文思维链 → 玩家必须看到明确的降级提示，而不是空白卡片
  J-6  J-1 的 <15 阈值把「正常短正文」和「清洗后变短的正文」也降级吞掉 —— 必须原样保留

同时顺带回归数值真值白名单清洗（A/B/C/D 四类）与中文数字零误伤。
用法：python3 t_body_probe.py （需本地 8899 静态服务）
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899/studio.html?genre=wangyou"
NOTE = "这一轮没有生成正文"

# 构造一段纯英文思维链（不含任何中文叙事字），复现 J-1 的清洗结果
THINKING_RAW = (
    "(Thinking process: 1. Analyze the Request. The user wants a short continuation "
    "of the scene. 2. Check the world state and the previous turn. 3. Draft the prose, "
    "avoid UI panels and status lines, keep the tone consistent with the guild arc. "
    "Let me reconsider the pacing before writing the final answer. "
    "OK, the final answer should be a single paragraph in Chinese.)"
)

# (输入, 期望)  —— "<degraded>" 表示必须返回产品降级提示
CASES = [
    (THINKING_RAW, "<degraded>"),                                   # J-1 正向
    ("OK. Got it.", "<degraded>"),                                  # 无中文短输入必须降级（防分支被删）
    ("", ""),                                                       # 空串保持空串，由 handle() 的 emptyNote 兜底
    ("三日后，他回到松木林。", "三日后，他回到松木林。"),              # J-6 短正文零误伤
    ("他摸了摸钱袋，总金币 99，转身进了酒馆。", "他摸了摸钱袋，转身进了酒馆。"),
    ("HP 346/470，他喘着粗气靠在墙上。", "他喘着粗气靠在墙上。"),
    ("经验 +10000，境界隐隐松动。", "经验略有增长，境界隐隐松动。"),
    ("木剑才卖 5 金币，他掂了掂分量。", "木剑才卖些许金币，他掂了掂分量。"),
    ("目前 1/1，行囊再塞不下东西。", "行囊再塞不下东西。"),
    ("三十金币也不算多，他随手付了。", "三十金币也不算多，他随手付了。"),  # 中文数字零误伤
    ("他点了点头，转身走进风雪里，没有回头。", "他点了点头，转身走进风雪里，没有回头。"),
    # J-7：语义复核追加告警查出的协议 / 状态条残骸，剥掉但保留叙事正文
    ("他抬头看向远处。\n威胁逼近: 15/100\nworld_update: faction.饕餮文明.influence=+2\n（）",
     "他抬头看向远处。"),
    # J-7 反向保护：系统流世界把系统面板写进叙述句是合理设定，不得误剥
    ("你扯了扯嘴角，没接话。系统界面只在脑海里冷冰冰地闪了一下幽蓝的微光：【怨气值 5/100。当前状态：空腹、微醉、欠债。建议：搞点动静】。",
     "你扯了扯嘴角，没接话。系统界面只在脑海里冷冰冰地闪了一下幽蓝的微光：【怨气值 5/100。当前状态：空腹、微醉、欠债。建议：搞点动静】。"),
    # J-7 反向保护：有引导句的「全息屏幕文字」是叙事，不是裸 UI 面板
    ("仪器发出一声低沉的嗡鸣，随后是一块悬浮的全息屏幕在你面前展开。\n**基因亲和度：中**\n**适配方案：标准型二代超级战士强化程序**",
     "仪器发出一声低沉的嗡鸣，随后是一块悬浮的全息屏幕在你面前展开。\n**基因亲和度：中**\n**适配方案：标准型二代超级战士强化程序**"),
    ("他说：走吧，天快黑了。", "他说：走吧，天快黑了。"),
]


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(service_workers="block")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(2200)
        got = pg.evaluate("""(inputs) => {
          const H = window.StoryResponseHandler;
          return inputs.map(s => H ? String(H.extractBody(s, []) || '') : null);
        }""", [c[0] for c in CASES])
        b.close()

    fails = []
    for (inp, want), actual in zip(CASES, got):
        if actual is None:
            fails.append("StoryResponseHandler 未加载")
            break
        if want == "<degraded>":
            if NOTE not in actual:
                fails.append("降级提示缺失: 输入 %r → %r" % (inp[:36], actual[:70]))
        elif actual != want:
            fails.append("清洗结果不符: 输入 %r｜期望 %r｜实得 %r" % (inp[:36], want, actual))
    if errs:
        fails.append("pageerror: %s" % errs[:3])

    print("正文清洗 / 降级回归：%d 例" % len(CASES))
    for (inp, want), actual in zip(CASES, got):
        flag = "✓" if ((NOTE in (actual or "")) if want == "<degraded>" else actual == want) else "✗"
        label = "<思维链>" if inp == THINKING_RAW else inp[:18].replace("\n", "⏎")
        print("  %s %-34s → %s" % (flag, label,
                                   ("<降级提示>" if NOTE in (actual or "") else (actual or "")[:34].replace("\n", "⏎"))))
    if fails:
        print("\n失败 %d 例：" % len(fails))
        for f in fails:
            print("  -", f)
        raise SystemExit(1)
    print("\n全通过：J-1 降级生效、J-6 短正文零误伤、数值清洗与中文数字零误伤、零 pageerror")


if __name__ == "__main__":
    main()
