# 云境 · 智能体技能（yunjing skill）

让 deepseekharness、Claude、各类 agent 框架里的 AI 按云境的规则创作与跑团：38 个世界的原著设定、防吃书防全知、三段式输出契约，一次性加载。

## 包含什么

- `SKILL.md` —— 技能定义（frontmatter + 行为规范），符合通用 Agent Skill 约定，放进 agent 的 skills 目录即可被识别
- `yj.py` —— 零依赖 CLI（只需 Python 3），列出世界、导出世界设定、搜索设定、查看规则摘要
- `install.sh` —— 安装脚本，把技能复制到 agent 的技能目录

## 安装

```bash
bash install.sh                      # 默认装到 ~/.agents/skills/yunjing
bash install.sh /path/to/skills/yunjing   # 指定目录
```

装好后把云境仓库路径告诉 agent，或在仓库根目录运行 CLI。

## CLI 示例

```bash
python3 yj.py --repo /path/to/yunjing list          # 38 个世界
python3 yj.py --repo /path/to/yunjing world jianlai # 导出剑来设定
python3 yj.py --repo /path/to/yunjing search "境界" # 搜设定
python3 yj.py --repo /path/to/yunjing rules         # 规则摘要
```

## 输出契约

技能要求 agent 每轮产出三段：① 小说正文 ② `(variable_update)` 变量块 ③ 6 个行动选项。详见 SKILL.md。

## 边界

本技能是云境的"外挂大脑"，不是云境本体。世界设定以云境仓库 `configs/` 为准，技能不另造设定。拒绝未成年人色情与真实在世人物不当描写。

云境 v6.9.4 · 开源非盈利
