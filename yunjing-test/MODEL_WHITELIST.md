# 云境 · 开发期模型准入白名单（v4.04.0）

> **硬约束来源**：用户明确要求「必须用我给你的 API 的免费大模型测试，不许花我的钱，注意速率和并发限制」。
> 本清单只约束**开发期评估 / 生图 / 视频脚本**，绝不注入产品运行时——玩家在「⚙ 接口设置」里可自由配置自己的模型与厂商，云境不做任何限制。

## 一、实测依据

2026-11-07 用单个 `GET https://apihub.agnes-ai.com/v1/models` 拉取，返回 9 个模型：

```
agnes-2.5-pro-alpha, agnes-2.5-pro-beta, agnes-3.0-flash, agnes-2.5-flash,
agnes-image-2.0-flash, agnes-image-2.1-flash, agnes-image-2.5-flash,
agnes-video-2.5, agnes-video-2.5-flash
```

## 二、允许（免费 flash 档）

| 用途 | 实际模型 ID | 用户原话 | 本轮实测 |
|---|---|---|---|
| 测试云境 | `agnes-3.0-flash` | `agens-3.0-flash` | HTTP 200，usage 正常，无计费报错 |
| 生成图片 | `agnes-image-2.5-flash` | `Agnes-Image-2.5-Flash` | HTTP 200，`response_format:"b64_json"` 返回有效 PNG（1.8MB，magic `89504e47`） |
| 生成视频 | `agnes-video-2.5-flash` | `agens-video-2.0-flash` | **未调用**（本批不需要视频），仅登记替代 ID |

> 用户写的 `agens-` 少一个 n、`Agnes-` 为大写，实际 ID 全为小写 `agnes-`，按实际 ID 调用。

## 三、禁止

- 所有 `*-pro-*` 档（上一轮 v4.03.0 的 full 档因账户余额 `$0.004148` 不足返回 403，就是这类模型）
- `agnes-video-2.5`（非 flash 档，可能计费）
- 任何未在上表登记的模型、任何付费端点
- 历史评估脚本里含上述模型的，已重命名为 `*.disabled`，禁止再运行

## 四、速率与并发硬约束

1. **并发 = 1**，严格串行；禁止 `asyncio.gather` / 多线程 / 多进程同时打 API
2. 相邻请求间隔 **≥ 2s**（生图 ≥ 3s）
3. 单轮请求上限：文本测试 ≤ 8 次，生图 ≤ 3 张，视频 ≤ 1 段
4. 每次请求带超时；同一问题失败重试不超过 2 次，不无限试
5. Key 只从运行时传入或环境变量取，**不写进仓库文件**

## 五、技术决策记录

**D-404-1 · 视频模型名冲突**：用户指定 `agens-video-2.0-flash`，但 `/v1/models` 中**不存在**该 ID；免费档最贴近的是 `agnes-video-2.5-flash`。
- 取舍：本批不做视频过场，故不调用该模型，不产生费用、不触发口径冲突；只登记替代 ID。
- **失效条件**：① 用户明确要求生成视频；② API 上线 `agnes-video-2.0-flash`；③ 需确认 `agnes-video-2.5-flash` 是否免费。任一成立须重新与用户确认后再调用。

**D-404-2 · 测试口径收敛**：上一轮用三档（tiny / small / full）实测，full 档为收费 pro 模型导致 403。本轮按「测试云境只能用 agens-3.0-flash」收敛为**单模型**实测，不再区分三档，也不再测任何 pro 档。

**D-404-3 · 生图落地方式**：`agnes-image-2.5-flash` 返回的 `data[0].url` 指向 `platform-outputs.agnes-ai.space`，实测 **HTTP 404**（外部图床不可直连）。改用 `response_format:"b64_json"` 直接拿 base64 本地落地，绕开外部域名；项目 `js/image-gen.js` 本来就兼容 b64_json。

## 六、退回方法

本清单是纯文档 + 校验脚本，不改运行时代码。想退回就删掉 `yunjing-test/` 目录，产品行为不受影响；舆图纹章图片在 `assets/atlas/`，删掉后 `atlas-panel.js` 的 `.atlas-crest` 会显示为空白（不报错），需一并回退该 CSS 与 img 节点才能完全恢复 v4.03.0 外观。
