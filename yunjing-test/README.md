# 云境验收脚本（v4.07.0）

本目录是**发版验收的可复现脚本**，随版本入库，任何人都能按同一口径复跑。

## 目录

```
yunjing-test/
├── MODEL_WHITELIST.md          # 允许调用的模型 ID 白名单
├── check_model_whitelist.py    # 枚举法扫描全库，校验无白名单外调用
└── scripts/
    ├── t_quests_v407.js        # 沙盒化动态委托系统验收（纯 Node vm，无浏览器）
    ├── sim_407.js              # 300 轮长程数值模拟（玩家视角，纯 Node vm）
    ├── t_v4071_ui.py           # 界面与链路定向回归（真实浏览器，24 项）
    ├── t_atlas_406.py          # 全 38 界舆图逐层截图 + 几何验收
    └── t_407_real.py           # 真实模型实测（调用 agnes-3.0-flash）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `YJ_ROOT` | `/workspace/yunjing` | 项目根目录（Node 脚本用） |
| `YJ_BASE` | `http://127.0.0.1:8899` | 本地静态服务地址（Python 脚本用） |
| `YJ_TEST_KEY` | 无 | **真实模型密钥，仅走环境变量，仓库内不存任何口令** |
| `YJ_TEST_ENDPOINT` | `https://apihub.agnes-ai.com/v1` | 模型接口地址 |

## 运行

```bash
cd /workspace/yunjing

# 1) 模型准入（无需网络/浏览器）
python3 yunjing-test/check_model_whitelist.py

# 2) 委托系统 + 长程模拟（纯 Node，秒级）
node yunjing-test/scripts/t_quests_v407.js     # 期望 37/37
node yunjing-test/scripts/sim_407.js             # 期望「数值异常（无）」

# 3) 界面与舆图（需先起静态服务）
python3 -m http.server 8899 --directory /workspace/yunjing &
python3 yunjing-test/scripts/t_v4071_ui.py      # 期望 24/24
python3 yunjing-test/scripts/t_atlas_406.py      # 期望「总判定: PASS 全量通过」

# 4) 真实模型实测（需密钥；并发 1、间隔 ≥4s、免费模型）
YJ_TEST_KEY=<你的密钥> python3 yunjing-test/scripts/t_407_real.py
YJ_TEST_KEY=<你的密钥> python3 yunjing-test/scripts/t_407_real.py sandbox   # 单例复跑
```

## 真实模型实测说明

- 只调用 `agnes-3.0-flash`（免费），**不调生图/视频、不花钱**
- 并发严格 1，相邻请求间隔 ≥ 4s，单轮 6 个请求，单请求 70s 超时
- 判定口径：
  - **委托一致性**——正文提到的报酬/时限数字必须与引擎真实板面一致（不比对描述性短语）
  - **势力名**——只认带引号/书名号的专名，且必须落在本界势力表或玩家自建势力名内；叠加「玩家势力名必须被原样使用」的正向断言
  - **沙盒不强推主线**——沙盒路线下正文不得出现「第一幕 / 第N幕 / 主线章节 / 你必须先 / 请先完成主线」
  - **不串味**——各界的原著专名按白名单放行，跨作品专名判失败
- 平台侧存在频控，个别用例会挂起超时；重试仍失败时**如实记录为「未取得有效响应」**，不得放宽判定口径掩盖
