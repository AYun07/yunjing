/* ============================================================
 * 云境工坊 · 内置「云起正则」v1.1（云境原创）
 * ------------------------------------------------------------
 * 云起预设的配套正则集，全部规则由云境工坊独立撰写。
 * 字段沿用 SillyTavern regex 扩展结构，执行见 js/miaomiao-regex.js。
 *
 * v3.55.6 新增「云起·XX美化」系列（14 条）——独属于云起的专属美化：
 *   · 卡片美化（12 条）：协议块正文键名加粗/数值高亮/心声斜体/序号徽章，
 *     与 renderCards 的云起专属皮肤配套，ST 与云境双侧可用；
 *   · 思维链美化：推演键名高亮（须在「思维链折叠」之前执行）；
 *   · 行动选项美化：选项序号规整，接云境行动选项按钮区专属样式。
 * ============================================================ */
window.YUNQI_REGEX = [
 {
  "id": "yq_bt_thk",
  "scriptName": "云起·思维链美化",
  "findRegex": "/(^|\\n|>)([ \\t]*)(推理|分析|结论|综上|计划|步骤|观察|回顾|记忆|目标|判断|情绪|意图|方案|策略|评估|风险|下一步|注意)([：:])/g",
  "replaceString": "$1$2<b>$3</b>$4",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__0",
  "scriptName": "云起·思维链折叠",
  "findRegex": "/<thinking>\\s*([\\s\\S]*?)\\s*<\\/thinking>/gi",
  "replaceString": "<details class=\"mm-card yq-skin yq-think\"><summary class=\"mm-card-head\"><span class=\"mm-card-icon\">🧭</span><span class=\"mm-card-title\">本轮推演</span></summary><div class=\"mm-card-body\">$1</div></details>",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__1",
  "scriptName": "云起·思维链剥除(发送)",
  "findRegex": "/<thinking>[\\s\\S]*?<\\/thinking>\\s*/gi",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": false,
  "promptOnly": true,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__2",
  "scriptName": "云起·内部标签清洗",
  "findRegex": "/(?:<\\|im_(?:start|end)\\|>\\s*\\w*[\\s\\S]*?<\\|im_end\\|>|<\\|im_(?:start|end)\\|>|<\\/?(?:content|preparation|latest_interaction|interactive_input|supplement|system_response)\\s*>|<\\/?最新互动>|<\\/?补充资料>|<\\/?正式创作>)/gi",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_AI_3",
  "scriptName": "云起·AI腔尾巴",
  "findRegex": "/[ \\t]*(?:作为(?:一个)?(?:AI|人工智能|语言模型|助手)[^。\\n]*。?|我(?:无法|不能|不应该|没有资格)(?:继续|提供|创作|扮演)[^。\\n]*。?|请注意[：:][^。\\n]*。?|我必须(?:提醒|指出)[^。\\n]*。?)\\s*$/gim",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__4",
  "scriptName": "云起·八股词抹除",
  "findRegex": "/(^|[，。！？；：、\\n])[ \\t]*(?:突然[地]?|忽然[地]?|与此同时[，,]?|只见(?:他|她|它|那)?|说时迟那时快[，,]?|话音(?:未|刚)落[，,]?)(?=[^。\\n])/gm",
  "replaceString": "$1",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__5",
  "scriptName": "云起·空洞强调词",
  "findRegex": "/(?:不容置疑|(?:微|几)不可[察查闻]|难以(?:察觉|觉察|言喻)|不易(?:察觉|觉察)|无与伦比|无法用言语形容)[的地]?/g",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__6",
  "scriptName": "云起·套话抹除",
  "findRegex": "/(?:空气(?:仿佛|好像)凝固(?:了|一般|似的)?|心跳(?:漏了一拍|猛地一滞)|瞳孔(?:猛地)?一缩|虎躯一震|娇躯一颤|嘴角(?:微微)?勾起一抹?(?:不易察觉的)?(?:弧度|笑意)|眼中闪过一丝[^，。]{1,6}(?:光芒|异色|精光)|深吸了一口气[，,]?|心中一凛[，,]?)/g",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__7",
  "scriptName": "云起·省略号压缩",
  "findRegex": "/(…{3,}|(?:\\.{6,})|(?:…(?:\\s*…){2,}))/g",
  "replaceString": "……",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_markdown_8",
  "scriptName": "云起·markdown标题剥除",
  "findRegex": "/(^|\\n)#{1,6}[ \\t]+/g",
  "replaceString": "$1",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__9",
  "scriptName": "云起·代码围栏剥除",
  "findRegex": "/```[a-zA-Z]*\\n?([\\s\\S]*?)```/g",
  "replaceString": "$1",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__10",
  "scriptName": "云起·重复句压缩",
  "findRegex": "/([^\\n。！？]{6,}[。！？])\\s*\\1+/g",
  "replaceString": "$1",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__11",
  "scriptName": "云起·行首缩进剥除",
  "findRegex": "/(^[ \\t　]+)/gm",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__12",
  "scriptName": "云起·空行归一",
  "findRegex": "/\\n{3,}/g",
  "replaceString": "\n\n",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__13",
  "scriptName": "云起·双语对照美化",
  "findRegex": "/☆‹([^‹›]+)›\\n(.+)/g",
  "replaceString": "<div style=\"margin:12px 0;\"><span style=\"font-size:.85em;opacity:.8;\">$1</span><br>$2</div>",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": true,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq__14",
  "scriptName": "云起·历史瘦身(发送)",
  "findRegex": "/^[\\s\\S]*?(<memory_log>[\\s\\S]*?<\\/memory_log>)[\\s\\S]*$/g",
  "replaceString": "$1",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": false,
  "promptOnly": true,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": 2,
  "maxDepth": null
 },
 {
  "id": "yq_AI_15",
  "scriptName": "云起·思维链对AI隐藏",
  "findRegex": "/<thinking>[\\s\\S]*?<\\/thinking>\\s*/gi",
  "replaceString": "",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": true,
  "markdownOnly": false,
  "promptOnly": true,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_opt",
  "scriptName": "云起·行动选项美化",
  "findRegex": "/^([A-Fa-f])[.、)）：:][ \\t]*/gm",
  "replaceString": "$1. ",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_open",
  "scriptName": "云起·开场白美化",
  "findRegex": "/(^|>)【([^】\\n]{1,24})】[ \\t]*/gm",
  "replaceString": "$1**【$2】** ",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_status",
  "scriptName": "云起·玩家状态栏美化",
  "findRegex": "/(^|\\n|>)(时间|地点|状态|持有|关系|情绪|体力|灵力|法力|生命|魔力|金钱|声望|物品|技能|任务|天气|时辰|衣着|姿态|身份|阵营|势力|线索|目标|异常)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_aff",
  "scriptName": "云起·角色好感度美化",
  "findRegex": "/(^|\\n|>)(好感|好感度|亲密度|信任|羁绊|心动|爱慕|好感等级|关系值)([：: +\\-]*)([+-]?\\d+(?:\\.\\d+)?)/gi",
  "replaceString": "$1**$2**$3`$4`",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_npc",
  "scriptName": "云起·NPC内心话美化",
  "findRegex": "/([（(]\\s*(?:内心|心声|暗想|心想|独白|OS|os)[^)）\\n]{0,60}[)）])/g",
  "replaceString": "*$1*",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_wlog",
  "scriptName": "云起·世界运行报告美化",
  "findRegex": "/(^|\\n|>)(影响|变化|事件|进展|世界|时间线|天气|地点|势力|任务|状态)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_mem",
  "scriptName": "云起·剧情记忆归档美化",
  "findRegex": "/(^|\\n|>)([•·▪◦]|(?:\\d{1,2}[.、)）]))[ \\t]+/g",
  "replaceString": "$1**$2** ",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_spc",
  "scriptName": "云起·特殊状态栏美化",
  "findRegex": "/(^|\\n|>)(HP|MP|EXP|LV|SAN|理智|体力|魔力|生命|法力|饥饿|口渴|疲劳|中毒|诅咒|增益|减益|状态异常|buff|debuff)([：: ])/gi",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_par",
  "scriptName": "云起·平行线美化",
  "findRegex": "/(^|\\n|>)([⤷↳⇒»]|支线|主线|IF线|BE|GE|TE|分歧|结局线)([：: ]?)/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_lore",
  "scriptName": "云起·同人搜索美化",
  "findRegex": "/(^|\\n|>)(出处|来源|设定|考据|原文|引用|标签|角色|作品|初登场|相关)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_cbt",
  "scriptName": "云起·战斗引擎美化",
  "findRegex": "/(^|\\n|>)(攻击|防御|伤害|暴击|格挡|闪避|判定|先手|回合|行动|效果|命中|招式|破绽)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_sty",
  "scriptName": "云起·故事引擎美化",
  "findRegex": "/(^|\\n|>)(推演|走向|伏笔|冲突|目标|悬念|节奏|线索|转折|结局|主线|支线)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 },
 {
  "id": "yq_bt_acg",
  "scriptName": "云起·角色心理美化",
  "findRegex": "/(^|\\n|>)(动机|欲望|恐惧|秘密|态度|情绪|心结|执念|立场|伪装|软肋)([：:])/g",
  "replaceString": "$1**$2**$3",
  "trimStrings": [],
  "placement": [
   2
  ],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": 1,
  "minDepth": null,
  "maxDepth": null
 }
];
