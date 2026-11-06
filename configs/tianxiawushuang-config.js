/**
 * 自由创作类型配置 - Free Story Configuration
 * 万能模板：题材由作者在设定台中自定义（侦探/言情/历史/都市/奇幻/儿童文学……皆可）
 * 结构同 mystery-config.js
 */

const fullSystemPrompt = "角色设定：你是《网游之天下无双》开放世界的游戏主持兼数据流网游主笔。游戏名为《天纵》，原著作者失落叶。玩家默认顶替陆尘（游戏ID「折戟沉沙」）的叙事之位，也可选择与原著角色共世。\n\n【本界铁律·防幻觉】\n1）游戏名是「天纵」，主角陆尘ID「折戟沉沙」；「落尘」是他在《灵恸》（第二部）时期的旧ID，「轻狂书生」「唐宋元明清」属于丁舒升，勿串书。\n2）主角职业是「死亡剑术宗师」（隐藏线：死灵/亡灵剑士→修罗→神将）；「死亡霜刃」是称号不是职业（另有「死神霜刃」写法，存疑）；「暗黑神座守护者」仅见于百度百科旧版view页，存疑。\n3）「霜云工作室」≠「古剑魂梦」行会；主角还曾是「血色佣兵」旧盟主、「保护伞」旧盟主、「雪银杉」临时成员。何艺是「在水一方」(EVE)且为古剑魂梦盟主，林逸欣是「风色幻想」属雪银杉/苹果俱乐部——两人ID与归属勿对调。\n4）装备品级用《天纵》自己的「十二神器 / 七十二鬼器 / 上古神器 / 下位·中位神器 / 圣器 + 卓越★星级」；勿套《灵恸》的「暗金器/地器/天器/仙器/旷世圣器/太古神器」或《月恒》的「绿/蓝/紫」。\n5）天纵特有属性维度是「策略」，第二资源是「神力值」；名将技（武神）、神将技（上古符印）、上古神技（轩辕斩）是三层不同技能，不可混称。CGL名人堂前五位「轻狂书生、青菜白玉汤、慕容姗姗、折戟沉沙、风色幻想」是跨三部人物同榜，不要写成同一本书的角色。\n6）首发平台是17K小说网。多个自动生成「百科」页误写「起点中文网/阅文集团」，百度百科另一义项甚至混入「作者乱、2013创世最佳新人、1300万版税」等完全无关信息，均为错误。字数（517万/513万/510万）、完结日期（2013-1-30 vs 2013-2-15）、CGL排名（第3/第4/第一位）、主角等级（275 vs 252）各来源冲突，一律勿写死。\n7）陆尘「首次出场」两说冲突：互动百科/newton 词条称首次在《网游之盗版神话》，百度百科陆尘词条称首次在《网游之纵横天下》——存疑，勿断言。\n\n【数据流写法】\n正文用第一人称「我」。战斗、升级、换装、掉落必须给出可与面板核对的数值（等级、HP、攻击、防御、伤害、暴击、耗蓝、经验），但数值为爽感服务，不可让属性面板淹没场景与人物。装备按《天纵》自己的品级序列：白色 → 黑石器 → 青铜器 → 玄铁器 → 白银器 → 黄金器 → 暗金器 → 紫金器 → 灵器 → 仙器 → 圣器 → 七十二鬼器 → 神器 → 十二神兵。属性维度：力量、体力、敏捷、智力、策略、生命、攻击、防御、魔防、声望、幸运、神力值。三部曲每一部的品级、职业、人物ID互不通用，严禁串书。\n\n【网游角色面板】\n本轮请求会附一份【网游角色面板】快照（等级/经验/HP/MP/六维/攻防/装备/技能/金币/声望/当前地图）。正文写到的数值必须与之一致；战斗结算、换装、加点、领奖由面板引擎计算，不得在正文里凭空改数字。若想让面板变化，在 (variable_update) 块里写 >>网游面板.exp: +120 这样的行；不写则由引擎按轮次自动结算。\n\n【叙事总法则】\n1. 场景先行，越级取胜靠操作、地形与道具，不靠天降奇遇。\n2. 现实线（工作室、都市、情感）与游戏线（练级、行会、领地战、国战）双轨并行。\n3. 配角有自己的欲望与立场，不为玩家让路；反派有自己的道理。\n4. 严禁设定漂移、严禁降智推进、严禁正文出现「作为AI」「根据设定」。\n5. 防剧透：按玩家所处版本节点给信息，不得提前倒出后期BOSS、神装全表或结局。\n\n【界面与反馈规范】\n每次回复必须包含：\n1. 一段完整正文（具体场景、冲突推进、章末钩子）\n2. (variable_update) 变量更新块：章节/回合推进、角色卡、道具进出、大事记、主角状态卡，以及需要结算的数值变化行\n3. 结尾以【行动选项】给出 6 个真正分岔的走向";

const defaultSystemPrompt = `
【开篇剧情指令 - 极其重要！必须严格遵守！】

第一次回复（收到"开始创作"指令后）必须严格按以下【通用短篇开局模板】写出第一章：

═══════════════════════════════════════
【通用短篇开局模板】
第一幕构成四要素：
1. 具体开场：以一个可视可听可感的场景切入（忌天气抒情、忌醒来、忌自我介绍式开头），前300字内建立"谁、在哪、想要什么的哪一角"。
2. 打破日常：一个具体事件改变了主角的处境或认知（信、来客、发现、意外、一句话）。
3. 钩子：一个未闭合的问题或威胁，让读者必须翻页。
4. 声音定调：本章确立全篇的叙述声音与题材质感。
═══════════════════════════════════════
【严格禁令】
- ❌ 严禁第一章解决核心冲突
- ❌ 严禁大段设定说明书（信息溶解在场景与动作里）
- ❌ 严禁人物无铺垫的重大行动

═══════════════════════════════════════
你是一位短篇小说主笔。
【极其重要】每次回复必须包含以下核心部分：
1. 一章完整正文（小说排版，无系统字样）
2. (variable_update) 变量更新块（系统的核心，必须逐项检查）
3. 【情节走向】6 个真正分岔的选项
4. 若故事推进至终局，坦然收束全篇，以【全文完】标记，回收所有已登记伏笔。

【最高优先级 - variableUpdate 字段检查清单】

1. 章节与字数检查：
   - chapter: +1（每写完一章）
   - wordCount: +本章新增字数（只填本章增量，勿填全书累计值）
   - 进入终章 → >>大事记: 收束卷开始

2. 仪表盘检查：
   - 张力变化 → tension: +/-数字（0-100，叙事张力）
   - 情感浓度 → emotionGauge: +/-数字（0-100，情感浓度）

3. 伏笔检查：
   - 埋设 → +【伏笔】名称
   - 回收 → -【伏笔】名称
   - 【铁律】收束章前，planted 状态伏笔必须回收

4. 角色检查：
   - 新角色建档 → 角色名.role / .age / .personality / .motivation / .secret / .appearance / .speechPattern / .firstAppearance
   - 关系变化 → 角色名.trust: +/-数字（0-100）
   - 状态变化 → 角色名.status: 状态
   - 重要转折 → >>角色名.history: 记录

5. 道具检查：
   - 关键道具（任何题材：信物/装备/道具/资源）入手 → +道具名 x数量（如：+母亲的怀表 x1）
   - 耗尽/遗失/易主/损毁 → -道具名 x数量

6. 主角检查：
   - 主角（第一视角核心人物）首次建档 → 主角名.isPlayer: true（标记主角身份）
   - 每轮 → 主角名.location: 本轮正文结束时所在（每轮必报；转场到达新地必须立即上报新位置——人在哪就报哪，严禁报出发前的旧位置；若身处客栈/渡口/镖局/山门等具体小场所，写成「大地点·小场所」，行旅图鉴会为小场所自动生成剧情地标，玩家走到哪地图记到哪）与 主角名.status: 当前状态/伤势（痊愈即清空）

7. 自定义变量检查：
   - 玩家在设定台或面板登记过自定义字段（如：身高/好感/存粮/理智…）→ 自定义.字段名: 值（每轮如实更新，变化须真实影响剧情走向）

【角色档案卡字段清单】（重要角色填全，路人可精简）
1. 角色名.role: 身份
2. 角色名.age: 年龄
3. 角色名.personality: 性格关键词（至少3个）
4. 角色名.motivation: 核心动机
5. 角色名.secret: 秘密
6. 角色名.appearance: 外貌与标志性细节
7. 角色名.speechPattern: 语言习惯
8. 角色名.firstAppearance: 首次出场（第X章·场景）
9. 角色名.trust: 与主角关系值（0-100）
10. 角色名.status: 当前状态

【档案示例】
陈默.role: 深夜便利店的店员
陈默.age: 26岁
陈默.personality: 温吞、观察力强、嘴硬心软、守时
陈默.motivation: 攒钱考下心理咨询师执照，搬出地下室
陈默.secret: 他记得三年间每一位深夜顾客买过的东西，包括那个再也没来过的人
陈默.appearance: 洗得发白的工装，胸牌上贴着褪色的猫咪贴纸
陈默.speechPattern: 爱用"要加热吗"结尾，紧张时整理收银台口香糖
陈默.firstAppearance: 第一章·凌晨两点的便利店
陈默.trust: 50
陈默.status: 在世
>>陈默.history: 第一章目击了一场没人报案的"事故"

【完整检查清单】每次 variable_update 后逐项自查：
✅ chapter/wordCount 已更新
✅ tension/emotionGauge 仪表盘已变化
✅ 新伏笔已登记（+名称）
✅ 已回收伏笔已标记（-名称）
✅ 新角色档案完整
✅ 既有角色关系/状态已更新
✅ >>大事记 或 >>角色名.history 已记录
✅ 主角 isPlayer/location/status 已上报
✅ 关键道具 +名称 x数量/-名称 x数量 已记账
✅ 自定义字段（若有登记）已更新
✅ 正文与变量块内容一致`;

const defaultDynamicWorldPrompt = "你是《网游之天下无双》的支线灵感生成器。根据当前版本节点与玩家所在地图，生成「主角视线之外正在发生的事」——世界频道的一句喊话、行会公告、敌对公会的调动、交易所价格波动。每条一句话（不超过60字），须符合《天纵》的品级与等级体系，可被主线采纳也可忽略；严禁剧透主线真相。";

const setupMeta = {
    perspectives: [
        { id: 'third_limited', name: '第三人称有限（跟随主角）', desc: '贴跟主角的所见所想，视角外的事件留白，悬念与代入兼顾的稳妥之选' },
        { id: 'first', name: '第一人称（"我"的声音）', desc: '主角亲述，语气即人格；适合情感浓度高、或叙述者藏有秘密的故事' },
        { id: 'omniscient', name: '全知视角（上帝之眼）', desc: '叙述者凌驾所有人物之上，知道却不说；适合宿命感与群像命运交织' },
        { id: 'multi', name: '多视角轮转（每章换人）', desc: '同一事件的不同当事人各讲一章，拼图式还原，互为镜像与反转' },
        { id: 'epistolary', name: '书信体/日记体', desc: '信件、日记、庭审记录拼出故事，时间差与隐瞒本身就是戏剧性' },
        { id: 'second', name: '第二人称（"你"）', desc: '实验感最强的贴脸叙述：读者被点名、被凝视，代入与不安同时发生' },
        { id: 'dual', name: '双视角对照', desc: '两条人称线并行（如"他"与"她"、过去与现在），交汇处即高潮' },
        { id: 'child_view', name: '孩童之眼', desc: '借"不完全理解世界"的眼睛看成人世界，纯真滤镜下的残酷更锋利' },
        { id: 'elderly', name: '暮年回溯', desc: '老人隔着几十年雾气回望某一年，时间差自带挽歌质地' },
        { id: 'mockumentary', name: '伪访谈体', desc: '以受访者讲述、录音转写拼贴真相，每个讲述者都带私心' }
    ],
    styles: [
        { id:'dataflow', name:'数据流正统（面板与战斗数值入文）', desc:'装备属性行、伤害数字、爆率与冷却照实写，失落叶本味' },
        { id:'hotblood', name:'热血爽文（快节奏·钩子密集）', desc:'升级爆装与打脸推进，章末必留钩子' },
        { id:'comedy', name:'口语轻喜剧（插科打诨）', desc:'第一人称冷幽默、队友互损，笑里藏刀' },
        { id:'epic', name:'公会史诗（群像与国战）', desc:'行会争霸、领地战与跨国主城战的大开大合' }
    ],
    lengths: [
        { id: 'micro', name: '一幕剧', words: 1500, chapters: 1, desc: '单场景单反转，十分钟读完的完整冲击；适合极致切片' },
        { id: 'flash', name: '微型小说', words: 3000, chapters: 3, desc: '一个核心意象或反转，小切口深挖掘' },
        { id: 'short', name: '标准短篇', words: 6000, chapters: 5, desc: '起承转合完整，冲突两至三层递进，短篇经典规格' },
        { id: 'big', name: '进阶短篇', words: 9000, chapters: 6, desc: '主线加一条副线，人物弧光更完整' },
        { id: 'long', name: '长短篇', words: 12000, chapters: 8, desc: '接近中篇密度，可埋设大规模伏笔回收' },
        { id: 'novella', name: '小中篇', words: 20000, chapters: 12, desc: '三幕大结构，足以支撑群像与史诗感' }
    ],
    eras: [
        { id:'open', name:'公测开服 · 新手村', desc:'低等级地图与绿白装，练级与首杀' },
        { id:'mid', name:'主城立足 · 行会与领地', desc:'转职、建帮令、驻地争夺与线下赛' },
        { id:'late', name:'国战与神级版本', desc:'隐藏职业、神装、跨国主城战' },
        { id:'end', name:'终章 · 结局前后', desc:'版本更迭与人物归处' }
    ],
    motifs: [
        { id: 'growth_farewell', name: '成长与告别', desc: '得到必伴随失去，长大的每一步都是一次道别' },
        { id: 'love_loss', name: '爱与失去', desc: '以失去为镜照见爱的形状，克制的痛感最美' },
        { id: 'home_roots', name: '家与根', desc: '故乡、父母、血缘的引力与逃离，中国人的永恒命题' },
        { id: 'dream_gap', name: '梦想与现实的落差', desc: '理想主义者如何在生活的泥地里保持体面' },
        { id: 'ordinary_divine', name: '平凡中的神性', desc: '普通人的一个瞬间闪耀出史诗的光' },
        { id: 'loneliness_meet', name: '孤独与相遇', desc: '两座孤岛的短暂靠近，理解即救赎' },
        { id: 'time_regret', name: '时间与遗憾', desc: '如果能重来——但时间从不给答案' },
        { id: 'choice_burden', name: '选择与承担', desc: '每个选择都是刀刃，选了就要流血' },
        { id: 'grey_morality', name: '善恶的灰度', desc: '没有纯粹的坏人，只有立场与处境的碰撞' },
        { id: 'memory_identity', name: '记忆与自我', desc: '我是谁，取决于我记得什么——而记忆会说谎' }
    ]
};

const openings = [
    { id: 'daily_break', name: '日常之裂', pointsModifier: 0, description: '平静生活的某一天，出现了一道小小的裂缝', effectsText: '初始 tension+10', effects: { tension: 10 } },
    { id: 'stranger_arrives', name: '不速之客', pointsModifier: -5, description: '一位陌生人的到来，撬动了所有人的位置', effectsText: '初始 tension+15', effects: { tension: 15 } },
    { id: 'old_promise', name: '旧约重启', pointsModifier: -8, description: '以为早已翻篇的约定/旧案/旧人，突然回来敲门', effectsText: '初始 emotion+15', effects: { emotion: 15 } },
    { id: 'last_chance', name: '最后机会', pointsModifier: 8, description: '只剩一次翻盘的机会，代价是现在拥有的一切', effectsText: '初始 tension+20', effects: { tension: 20 } },
    { id: 'wrong_item', name: '错拿的东西', pointsModifier: -10, description: '拿错的一件小东西，牵出另一段人生', effectsText: '初始 creativity+15', effects: { creativity: 15 } },
    { id: 'city_corner', name: '城市一隅', pointsModifier: 5, description: '深夜小店/末班车/天台——城市缝隙里的相遇', effectsText: '初始 emotion+10', effects: { emotion: 10 } },
    { id: 'two_lives', name: '双线人生', pointsModifier: -15, description: '一次选择的两端，两种人生隔着玻璃相望', effectsText: '初始 depth+15', effects: { depth: 15 } },
    { id: 'season_gate', name: '季节之门', pointsModifier: 0, description: '从某个夏末或冬初的黄昏说起', effectsText: '初始 prose+15', effects: { prose: 15 } },
    { id: 'return_visit', name: '重返旧地', pointsModifier: -5, description: '多年后回到当初离开的地方，物是人非中有一件事没变', effectsText: '初始 emotion+15', effects: { emotion: 15 } },
    { id: 'inheritance_box', name: '遗物之匣', pointsModifier: -8, description: '整理逝者遗物时，翻出一件不该存在的东西', effectsText: '初始 depth+10', effects: { depth: 10 } },
    { id: 'one_promise', name: '无人知晓的约定', pointsModifier: 5, description: '和某人约好一件小事，对方失约的方式匪夷所思', effectsText: '初始 tension+10', effects: { tension: 10 } },
    { id: 'slow_change', name: '渐变之始', pointsModifier: -10, description: '世界在以每天百分之一的速度变得不对劲，只有主角注意到了', effectsText: '初始 creativity+10 depth+10', effects: { creativity: 10, depth: 10 } }
];

const techniques = [
    { id: 'chekhov_gun', name: '契诃夫之枪', cost: 0, description: '显著细节皆为伏笔，终有回响' },
    { id: 'foreshadow_mirror', name: '首尾镜像', cost: 5, description: '开头的意象在结尾回环，完成闭合' },
    { id: 'dual_timeline', name: '双线咬合', cost: 15, description: '两线相向而行，交汇即高潮' },
    { id: 'montage', name: '蒙太奇', cost: 10, description: '场景碎片快速拼接，情感在缝隙里爆发' },
    { id: 'unreliable', name: '不可靠叙事', cost: 15, description: '叙述者的盲区/私心即是最大的机关' },
    { id: 'reversal', name: '欧·亨利式反转', cost: 10, description: '意料之外情理之中的最后一击' },
    { id: 'open_ending', name: '开放余韵', cost: 0, description: '不闭合的闭合：留一扇门给读者' },
    { id: 'slice_of_life', name: '切片写法', cost: 0, description: '以生活横截面承载全部重量' },
    { id: 'iceberg', name: '冰山理论', cost: 5, description: '八分之一露出水面：省略的部分靠细节显影' },
    { id: 'memory_prism', name: '记忆多棱镜', cost: 10, description: '同一事件被不同人讲述多次，版本差即真相' },
    { id: 'everyday_epiphany', name: '日常顿悟', cost: 0, description: '乔伊斯式：平凡一天里的一次灵魂显影' },
    { id: 'ring_structure', name: '环形结构', cost: 10, description: '结尾回到开头的场景，人已非那人' },
    { id: 'dual_arcs', name: '双主角对照弧光', cost: 15, description: '两人同题不同解，命运互为注脚' },
    { id: 'slow_burn', name: '文火慢炖', cost: 5, description: '克制推进，情绪浓度在最后一章一次性兑付' }
];

const statKeys = [
    { key: 'tension', label: '张力' },
    { key: 'emotion', label: '情感' },
    { key: 'prose', label: '文笔' },
    { key: 'pacing', label: '节奏' },
    { key: 'creativity', label: '创意' },
    { key: 'depth', label: '深度' }
];

const gauges = [
    { key: 'tension', label: '叙事张力', icon: '⚡', color: 'linear-gradient(90deg,#e07856,#e0a84c)', default: 40 },
    { key: 'emotionGauge', label: '情感浓度', icon: '🌡', color: 'linear-gradient(90deg,#8ab4c8,#b7a8e8)', default: 50 }
];

const nameSeeds = {
    titles: ['首杀','晋级任务','建帮令','第一片领地','守城之夜','国战前夜','卓越九星','隐藏职业','深渊回响','新的开始'],
    premises: ['头盔到货的当晚，我在新手村卡住了一只不该出现在这里的精英怪','世界频道有人高价收一件绿装，我背包里正好有','行会驻地被人围了，盟主却迟迟不上线','转职任务失败，等级清零，我从零再练一次']
};

const TianxiawushuangStoryConfig = {
    mode: 'roleplay',
    genreKey: 'tianxiawushuang',
    genreName: '网游之天下无双',
    fullSystemPrompt, defaultSystemPrompt, defaultDynamicWorldPrompt,
    systemPrompt: () => fullSystemPrompt,
    dynamicWorldPrompt: () => defaultDynamicWorldPrompt,
    setupMeta, openings, techniques, statKeys, gauges, nameSeeds,
    baseAttributes: { tension: 15, emotion: 15, prose: 10, pacing: 10, creativity: 10, depth: 10 },
    maxPoints: 100,
    maxTechniques: 3,
    statusFields: ['tension','emotionGauge'],
    renderStatus: (vars) => window.StoryStatusRenderer.refresh(vars),
    buildOpeningInstruction: (setup) => {
        const cls = setup.aptitude || '死亡剑术宗师';
        const era = setup.timeline || '公测开服 · 新手村';
        const who = setup.playerName || '陆尘';
        const idn = setup.identity || '替代主角（陆尘／折戟沉沙）';
        const style = setup.customStyle || setup.style || '数据流正统';
        return `【开始游戏】玩家角色「${who}」以「${idn}」身份登录《天纵》——时代节点：${era}；初始职业方向：${cls}；文风：${style}。请主持开场：以头盔登录或新手村的具体场景落笔，给出可读的属性面板与当务之急（越级怪、任务、行会招募或世界频道的动静至少其一），引入至少一个本界真实地名与一件符合当前品级序列的装备；正文里的数值必须与【网游角色面板】快照一致。结尾附 (variable_update) 变量块（角色卡建档、首批NPC卡、道具与数值变化行）与 6 个【行动选项】。`;
    },
    onInit: function (framework) {
        console.log('[TianxiawushuangStoryConfig] 网游之天下无双 配置已加载');
        document.body.classList.add('theme-tianxiawushuang');
        const t = document.getElementById('gameTitle');
        if (t) t.textContent = '网游之天下无双 · 《云境工坊》';
        const c = document.getElementById('statusPanelContainer');
        if (c && c.children.length === 0 && window.StoryStatusRenderer) c.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
    }
};


setupMeta.identities = [
    { id:'canon', name:'替代主角（陆尘／折戟沉沙）', desc:'承接原著主角的际遇线、职业进阶与行会归属，原著主角本人不再独立登场' },
    { id:'coexist', name:'共世玩家（普通身份）', desc:'保留原著主角，自己以普通玩家入场，不得改写原著主角的关键际遇' },
    { id:'guild', name:'行会核心成员', desc:'从工作室/行会底层做起，靠操作与战功上位' },
    { id:'solo', name:'独行散人玩家', desc:'不依附大行会，靠越级单杀与倒卖装备谋生' }
];
setupMeta.timelines = [
    { id:'open', name:'公测开服 · 新手村', desc:'低等级地图，绿白装，练级与首杀' },
    { id:'mid', name:'主城立足 · 行会与领地', desc:'转职、建帮令、驻地争夺、比赛' },
    { id:'late', name:'国战与神级版本', desc:'隐藏职业、神装、跨国主城战' },
    { id:'end', name:'终章 · 结局前后', desc:'版本更迭与人物归处' }
];
setupMeta.aptitudes = [
    { id:'power', name:'力量流（重输出）', desc:'堆力量与武器攻击，硬碰硬' },
    { id:'agi', name:'敏捷流（暴击与攻速）', desc:'堆敏捷，靠走位与暴击吃越级怪' },
    { id:'tank', name:'体力流（血防）', desc:'堆体力和防御，扛BOSS与守城' },
    { id:'int', name:'智力流（法系/治疗）', desc:'堆智力与魔防，技能与团队增益' }
];
setupMeta.backgrounds = ['网吧包夜的老玩家，攒了三个月才买到头盔','被工作室挖来的代练，手速快但不会与人相处','现实里失意，想在游戏里重新赢一次','前职业选手退下来，只想安静练个小号'];
setupMeta.flavor = {"surname":[],"m":["尘","凡","升","雪","月","冰","风","雷","戟","轩"],"f":["姗","雪","月","韵","冰","欣","艺","昕","怜","星"]};
setupMeta.ageRange = [16, 32];
setupMeta.names = ['林凡','丁舒升','陆尘','凌雪','凌月','秦韵','许冰','何艺','林逸欣','北冥雪','慕容姗姗','王栩'];

window.TianxiawushuangStoryConfig = TianxiawushuangStoryConfig;
window.GenreStoryConfig = TianxiawushuangStoryConfig;
