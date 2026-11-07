#!/usr/bin/env python3
"""云境 · 模型准入白名单校验（v4.05.0）
用户硬约束：只能用 agnes-3.0-flash / agnes-image-2.5-flash / agnes-video-2.5-flash
这三个模型，别的都不许用。

采用「枚举法」而非逐个列黑名单：扫描生效代码里出现的**所有** agnes 模型 ID，
凡不在 ALLOWED 一律 FAIL。未来上线的新版本、pro 档、非 flash 档会自动被拦下，
不需要人工补规则。历史 tiny 档 agnes-2.5-flash 已从允许集移除（v4.04.0 还只是「仅登记」）。

退出码 0 = 通过，1 = 失败。这条检查有真实失败可能，不是恒真断言。
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWED = {
    "agnes-3.0-flash",          # 测试云境
    "agnes-image-2.5-flash",    # 生图
    "agnes-video-2.5-flash",    # 视频（本轮未调用，仅准入）
}
# 匹配 agnes 模型 ID；不匹配 apihub.agnes-ai.com / platform-outputs.agnes-ai.space 这类域名
# （域名里的 ai 既非数字版本，也不以 image/video 开头）。
MODEL_ID = re.compile(
    r"\bagnes-(?:[0-9]+\.[0-9]+(?:-[a-z0-9-]+)?"
    r"|image-[0-9.]+(?:-[a-z0-9-]+)?"
    r"|video-[0-9.]+(?:-[a-z0-9-]+)?)\b"
)
SKIP_DIRS = {".git", "libs", "node_modules", "releases", "test",
             "_shots_v398", "_shots_v399", "_shots_v397"}
# 只扫会真正发起调用的代码文件；.md 文档（含白名单自身）里列举禁用名属于说明，不是调用
EXTS = {".py", ".js", ".mjs", ".html"}
SELF = os.path.abspath(__file__)


def collect():
    files = []
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if os.path.splitext(n)[1] in EXTS:
                files.append(os.path.join(base, n))
    # 开发期评估脚本（.disabled 的已禁用，不计入生效文件）
    files += [p for p in glob.glob("/tmp/t_*.py")
              if not p.endswith(".disabled") and not p.endswith(".js.disabled")]
    return files


def main():
    files = collect()
    hits = []
    found = set()
    for p in files:
        if os.path.abspath(p) == SELF:
            continue
        try:
            s = open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        for m in MODEL_ID.finditer(s):
            mid = m.group(0)
            found.add(mid)
            if mid in ALLOWED:
                continue
            line = s[:m.start()].count("\n") + 1
            rel = os.path.relpath(p, ROOT) if p.startswith(ROOT) else p
            hits.append((rel, line, mid))

    wl = os.path.join(ROOT, "yunjing-test", "MODEL_WHITELIST.md")
    print("扫描生效文件数", len(files))
    print("发现的 agnes 模型 ID:", ", ".join(sorted(found)) or "无")
    print("违规模型调用数", len(hits))
    for h in hits[:20]:
        print("   ", h)

    if not os.path.exists(wl):
        print("FAIL 白名单文档缺失（yunjing-test/MODEL_WHITELIST.md）")
        return 1
    if hits:
        print("FAIL 存在未授权模型调用，禁止发版；只允许：", ", ".join(sorted(ALLOWED)))
        return 1
    print("PASS 模型准入校验通过；允许：", ", ".join(sorted(ALLOWED)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
