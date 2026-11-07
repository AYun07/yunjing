#!/usr/bin/env python3
"""云境 · 模型准入白名单校验（v4.04.0）
检查全仓与开发期评估脚本里是否出现收费 / 未授权模型调用。
退出码 0 = 通过，1 = 失败。这条检查有真实失败可能，不是恒真断言。
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWED = {
    "agnes-3.0-flash",          # 测试云境
    "agnes-image-2.5-flash",    # 生图
    "agnes-video-2.5-flash",    # 视频（用户指定的 2.0 不存在，登记替代）
    "agnes-2.5-flash",          # 历史 tiny 档，仅登记，本轮未用
}
BANNED = [
    r"agnes-2\.5-pro-alpha",
    r"agnes-2\.5-pro-beta",
    r"agnes-video-2\.5(?!-flash)",
    r"agnes-image-2\.[01]-flash",
    # 只兜底 agnes 家族的 pro 档；玩家配置面板里第三方厂商预设（如 doubao-...-pro-...）
    # 属于产品运行时，不花本账户的钱，按白名单声明不在约束范围。
    r"agnes-[a-z0-9-]*-pro-[a-z0-9-]+",
]
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
    for p in files:
        if os.path.abspath(p) == SELF:
            continue
        try:
            s = open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        for pat in BANNED:
            for m in re.finditer(pat, s):
                line = s[:m.start()].count("\n") + 1
                rel = os.path.relpath(p, ROOT) if p.startswith(ROOT) else p
                hits.append((rel, line, m.group(0)))

    wl = os.path.join(ROOT, "yunjing-test", "MODEL_WHITELIST.md")
    print("扫描生效文件数", len(files))
    print("违规模型调用数", len(hits))
    for h in hits[:20]:
        print("   ", h)

    if not os.path.exists(wl):
        print("FAIL 白名单文档缺失（yunjing-test/MODEL_WHITELIST.md）")
        return 1
    if hits:
        print("FAIL 存在收费 / 未授权模型调用，禁止发版")
        return 1
    print("PASS 模型准入校验通过；允许：", ", ".join(sorted(ALLOWED)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
