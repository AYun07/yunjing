# 云境 · 开发期模型准入白名单（v4.05.0）

> ⚠️ **v4.11.1 重申**：本清单里的三个模型只是**开发方做回归测试的夹具**，约束范围仅限 `yunjing-test/` 内的开发期脚本。**产品运行时对玩家模型零限制、零白名单**——玩家可配置任意厂商 / 任意渠道 / 任意模型。切勿把本清单误读为「玩家只能用这三个模型」。

> **硬约束来源（v4.05.0 用户原话）**：「agnes-3.0-flash、agnes-image-2.5-flash、agnes-video-2.5-flash，你只能用这三个模型，别的都不许用」。
> 延续 v4.04.0 的「必须用我给你的 API 的免费大模型测试，不许花我的钱，注意速率和并发限制」。
> 本清单只约束**开发期评估 / 生图 / 视频脚本**，绝不注入产品运行时——玩家在「⚙ 接口设置」里可自由配置自己的模型与厂商，云境不做任何限制。

## 一、可用模型实测依据

2026-11-07 用单个 `GET https://apihub.agnes-ai.com/v1/models` 拉取，返回 9 个模型：

```
agnes-2.5-pro-alpha, agnes-2.5-pro-beta, agnes-3.0-flash, agnes-2.5-flash,
agnes-image-2.0-flash, agnes-image-2.1-flash, agnes-image-2.5-flash,
agnes-video-2.5, agnes-video-2.5-flash
```

用户写的 `agens-` 少一个 n、`Agnes-` 为大写，实际 ID 全为小写 `agnes-`，一律按实际 ID 调用。

## 二、允许（**仅此三个，别的一律不许用**）

| 用途 | 实际模型 ID | 用户本轮原话 | 状态 |
|---|---|---|---|
| 测试云境 | `agnes-3.0-flash` | `agnes-3.0-flash` | 免费档，HTTP 200，usage 正常，本轮实测在用 |
| 生成图片 | `agnes-image-2.5-flash` | `agnes-image-2.5-flash` | 免费档，`response_format:"b64_json"` 返回有效 PNG，v4.04.0 已落地两张纹章 |
| 生成视频 | `agnes-video-2.5-flash` | `agnes-video-2.5-flash` | **本轮未调用**：用户把它列入允许集，但没有要求生成视频，且此前要求不许花钱；如需调用须先确认是否免费 |

> 与 v4.04.0 的差异：v4.04.0 还把历史 tiny 档 `agnes-2.5-flash` 列为「仅登记」。**v4.05.0 起它不再被允许**，出现即判定违规。

## 三、禁止

- **任何不在上表三个之内的 agnes 模型**，包括：`agnes-2.5-flash`、`agnes-2.5-pro-alpha/beta`、`agnes-image-2.0/2.1-flash`、`agnes-video-2.5`（非 flash）、`agnes-video-2.0-flash`（API 中不存在）、以及未来上线的任何新版本。
- 任何付费端点、任何第三方厂商模型用于开发期评估。
- 历史评估脚本里含上述模型的，一律重命名为 `*.disabled`，禁止再运行。

## 四、速率与并发硬约束

1. **并发 = 1**，严格串行；禁止 `asyncio.gather` / 多线程 / 多进程同时打 API
2. 相邻请求间隔 **≥ 2s**（生图 ≥ 3s）
3. 单轮请求上限：文本测试 ≤ 8 次，生图 ≤ 3 张，视频 ≤ 1 段
4. 每次请求带超时；同一问题失败重试不超过 2 次，不无限试
5. Key 只从运行时传入或环境变量取，**不写进仓库文件**

## 五、校验方式（v4.05.0 起改为枚举法）

`yunjing-test/check_model_whitelist.py` 不再逐个列黑名单，而是：

1. 扫描全仓 `.py / .js / .mjs / .html` 与 `/tmp/t_*.py` 生效脚本（排除 `.disabled`）；
2. 用正则抽出**所有** agnes 模型 ID（不匹配 `apihub.agnes-ai.com` 这类域名）；
3. 凡 `mid not in ALLOWED` 即记违规，`FAIL` 并退出码 1；
4. 同时校验白名单文档存在。

好处：未来新版本、pro 档、非 flash 档**自动被拦下**，不需要人工补规则。
实证：v4.05.0 首次运行即揪出旧黑名单漏掉的 `/tmp/t_punct.py`、`/tmp/t_tiny_only.py` 共 4 处 `agnes-2.5-flash`，两脚本已留底改名 `.disabled`；另造一个临时违规文件复测 `FAIL`，删除后 `PASS`。

## 六、技术决策记录

**D-404-1 · 视频模型名冲突（v4.05.0 已消解）**：v4.04.0 用户写 `agens-video-2.0-flash`，`/v1/models` 无此 ID，当时只登记 `agnes-video-2.5-flash` 作替代且不调用。
- **v4.05.0 更新**：用户本轮直接把 `agnes-video-2.5-flash` 列为三个允许模型之一，名称冲突消解；仍**未调用**，因为本轮没有视频需求且「不许花钱」约束延续。
- **失效条件**：用户明确要求生成视频，或确认该模型免费且不产生费用。

**D-404-2 · 测试口径收敛（沿用）**：不再区分 tiny / small / full 三档，测试只用 `agnes-3.0-flash`；禁止任何 pro 档。

**D-404-3 · 生图落地方式（沿用）**：`agnes-image-2.5-flash` 返回的 `data[0].url` 指向外部图床，实测 HTTP 404；改用 `response_format:"b64_json"` 直接落地 PNG。

**D-405-1 · 允许集严格收敛为三个**：用户明确「别的都不许用」，故把历史 tiny 档 `agnes-2.5-flash` 从允许集移除（v4.04.0 还是「仅登记、本轮未用」）。同时把 `js/base-model-mode.js` 注释里残留的该模型名改为「tiny 档 8K 窗口免费模型」，不篡改实验数据、只去掉具体 ID。

**D-405-2 · 校验改枚举法**：逐个列 BANNED 无法覆盖未来模型，改为「抽出全部 agnes ID、白名单外即 FAIL」。这是可失败校验，不是恒真断言。

**D-405-3 · 历史脚本留底禁用**：`/tmp/t_punct.py`、`/tmp/t_tiny_only.py` 含旧 tiny 档模型，改名为 `.disabled` 而非删除，保留留底且不再生效；校验脚本本就排除 `.disabled`。

## 七、退回方法

本清单是纯文档 + 校验脚本，不改运行时代码。想退回就删掉 `yunjing-test/` 目录，产品行为不受影响；舆图纹章图片在 `assets/atlas/`，删掉后 `atlas-panel.js` 的 `.atlas-crest` 会显示为空白（不报错），需一并回退该 CSS 与 img 节点才能完全恢复 v4.03.0 外观。
