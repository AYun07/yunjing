# 云境 v3.91.0 · 功能回归记录

> 功能口径报告，回答「能不能用」。**视觉合理性另见 `VISUAL-REVIEW-v3.91.0.md`**——两者不能互相替代。
> 运行方式：先起 8080 本地服务，再 `node live-test-v3.91.0.mjs`（脚本在测试工作区 `/workspace/yunjing-test/`）。

## 1. 改动文件清单

| 文件 | 改动 |
|---|---|
| `index.html` | 删除 `.mh-mascot` 吉祥物 img；版本徽标移入 `.footer` 取消 fixed；head 注释改为六套风格；全页 `?v=` → 3.91.0；`YJ_VER` → 3.91.0 |
| `js/lobby-themes.js` | 主题列表 8 → 6（editorial/zine/y2k/ink/swiss/term），默认 `zine`，旧 id 自动回退 |
| `css/lobby-themes.css` | 重写：六套风格 token + 纸本/暗幕两套基底，覆盖整页所有组件与小云面板；切换坞样式；版本徽标静态化；手机胶囊收起 |
| `css/lobby-layouts.css` | 重写：六套异构骨架 + 三轮视觉修正 + 760px 窄屏兜底 |
| `css/lobby-xiaoyun.css` | 删除吉祥物规则与 `@keyframes float` |
| `css/xiaoyun-buddy.css` | 面板头头像改 ☁ 云朵符号；纸本三套的小云面板浅色适配 |
| `js/xiaoyun-buddy.js` | `renderHead()` 不再插入第二张小云头像 |
| `sw.js` | `SW_VER` → `yunjing-v3.91.0`；缓存注释更正（缓存的是唯一小云立绘，不是吉祥物） |
| `studio.html` / `selftest.html` / `js/*.js` / `css/*.css` / `README.md` / `QUICKSTART.txt` | 版本号同源，共 178 处 3.90.0 → 3.91.0 |
| `changelog/index.html` | 补登 v3.91.0；修正一处遗留 `?v=3.87.0` |
| `VERSIONS.md` | 版本数 58 → 59；速查表 + 详细条目补登 v3.91.0 |
| `test/VISUAL-REVIEW-v3.91.0.md` | 新增：三轮实拍视觉审查报告 |
| `test/LIVE-TEST-v3.91.0.md` | 本文件 |

## 2. 回归结果（50 / 50 PASS）

| 组 | 检查项 | 结果 |
|---|---|---|
| 1 | 四个入口页（index / studio / selftest / changelog）零 404、零脚本错误 | 8 / 8 |
| 2 | 六套主题各：`data-theme` 生效、切换器 6 项、主工坊 5 张、33 界跳转 33 条、无吉祥物且单小云 | 30 / 30 |
| 2 | 六套骨架指纹（10 个关键节点 computed style + 伪元素内容）两两不同 | 6 / 6 |
| 3 | `?theme=term` 记忆；全新会话下已删旧 id `colorful` 回退到默认 `zine` | 2 / 2 |
| 4 | `YJ_VER` / 标题 / 页脚徽标 / `SW_VER` / 168 处活动 `?v=` 全部 3.91.0 | 5 / 5 |
| 5 | `sw.js` 预缓存清单 158 个路径零缺失 | 1 / 1 |
| 6 | 一致性自检页点击「运行全部检查」 | **63 / 63 项通过** |

**另**：全仓 JS `node --check` **263 / 263** 通过。

## 3. 唯一小云专项（13 / 13 PASS）

`single-cloud-check.mjs` 覆盖：六套大厅首屏、点开小云面板、面板内切换性格、旧主题 id 回退、
创作室首屏、创作室交互后 demand 懒加载落地、创作室点开面板、手机端点开面板。
每个场景都断言 `mascot=0 / xiaoyunImgs=1 / buddyOrbs=1 / headImgs=0 / moChibiDom=0` 且零脚本错误。

## 4. 未验证项（强制披露）

- 中间宽度 768 / 1024、320px 极窄屏、iPad 竖屏与横屏未逐一实拍，只有 760px 断点兜底。
- `prefers-color-scheme` / `prefers-reduced-motion` 未做专项适配审查。
- 本轮未重跑 33 界真实 API 生成（改动范围是大厅 CSS / 首页 DOM / 小云面板，不触及创作室与 API 链路）；沿用 v3.89.0 的 33/33 结论，不冒充本轮结果。
- 手机端右下小云随页面滚动仍会轻微覆盖分组区最右侧的「入场 →」文字；已缩小到 76×96 / `scale(.68)`，属可接受的悬浮助手常态，未做进一步避让重构。
- 视觉审查含主观判断：技术口径是 V1–V8 全部判通过；**用户口径以你实际打开后的观感为准**，不一致时以你的为准，按下一批处理，不悄悄扩范围。
