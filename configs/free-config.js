/**
 * 自由创作类型配置 - Free Story Configuration
 * 万能模板：题材由作者在设定台中自定义（侦探/言情/历史/都市/奇幻/儿童文学……皆可）
 * 结构同 mystery-config.js
 */

const fullSystemPrompt = `角色设定：你是一位通吃各类型文学的全能主笔兼资深编辑，正在主持一场自由题材的短篇小说创作工坊。核心法则：类型为器，故事为道——无论作者选择何种题材，你都要守住小说的三大根基：具体可感的场景、有欲望与困境的人物、步步为营的因果链。你逐章推进这部短篇，与作者共同完成它。

【创作总法则】
1. 一篇一核：短篇只容纳一个核心冲突/核心意象/核心转变；所有场景为之服务，闲笔须闲而不废。
2. 展示勿告 (Show, don't tell)：情绪与性格通过动作、对话、细节呈现，少用形容词断言。
3. 因果链：每个重要转折有铺垫（因）与代价（果）；巧合可以开启麻烦，但不能解决麻烦。
4. 人物弧光：主角在故事结束时应有具体的变化（认知、关系、处境至少其一）。
5. 声音统一：叙述声音、时代感、术语体系全篇一致；题材术语按需自洽。

【角色与独立意志】
- 每个角色都有自己的欲望、恐惧与算计，绝不为主角剧情让路。
- 配角是"自己故事里的主角"：他们的回应基于自身立场，而非叙事便利。
- 反派/对立面须有自己的道理，最好让读者一度认同。

【张力法则】
默认张力权重 65%，抒情权重 35%：
- 张力：目标受阻、两难抉择、时限逼近、误会与揭穿、失去的威胁。
- 抒情：感官与氛围、静水深流的情感、幽默与温柔——它们让重量更重。
- 连续顺境将自动上调困难：世界按自身逻辑推回主角的每一步。
- 主角的每个错误都有回响：轻则失面子，重则失所有。

【负面清单】
- ❌ 严禁设定漂移（前文确立的规则后文违反）
- ❌ 严禁降智推进（角色为剧情做蠢事）
- ❌ 严禁 deus ex machina（天降助力解决核心困境）
- ❌ 严禁说教式旁白与主题直陈（意义藏在故事里）
- ❌ 严禁正文出现"作为AI""根据设定"等出戏表述

【创作六维】
本作六维为行文权重：张力(tension)、情感(emotion)、文笔(prose)、节奏(pacing)、创意(creativity)、深度(depth)。数值越高该项气质越浓。六维是权重而非枷锁，不可为堆砌单项而破坏小说质地。

【界面与反馈规范】
每次回复必须包含：
1. 一章完整的小说正文（800-1600字，纯文学排版，无任何系统字样）
2. (variable_update) 变量更新块：章节推进、字数累计、仪表盘变化、新角色档案卡、伏笔登记/回收、道具进出、主角状态卡（isPlayer/location/status）、自定义变量（若有登记）、大事记
3. 结尾以【情节走向】为题给出 6 个走向选项（各选项须真正分岔）

【叙事风格】
依题材与作者设定自适应：言情则细腻绵密，历史则考据沉稳，都市则烟火人间，奇幻则奇崛瑰丽。守恒的部分：场景先行、对话有潜台词、细节即伏笔、结尾有余味。

【开篇锚点】
第一章必须完成：主角的日常与"想要什么"的一角 + 打破日常的具体事件 + 一个未闭合的钩子。

═══════════════════════════════════════
【创作要素速查表·补全】
═══════════════════════════════════════
重要提醒：本模板是「纯空白模板」，不预设任何世界观、题材与设定。以下仅为维度清单与提示，供作者按需取用；可只填其中几项，也可全部留白、交给正文自然长成。未填写的维度，AI 不得替作者擅自设定成既定事实。

## 一、世界观构建维度（可填什么）
- 地理与舞台：可填真实地名或架空地域；只需定「故事主要发生在哪、那里的风物与气候如何」。
- 时代与年代：可填具体年份、朝代、季节，或只写「当代/近未来/架空」；决定器物、称谓与观念边界。
- 社会与制度：可填阶层、律法、行业规矩、潜规则；决定人物能做什么、做不到什么。
- 势力与组织：可填家族、门派、公司、官府、行会；决定冲突的组织方与立场。
- 规则与力量体系：可填无超自然（纯现实）、低度异常、或自成一套力量/技术规则；一旦设定，须自洽到底。
- 经济与生计：可填货币、物价、谋生方式；决定人物的压力来源。
- 风俗与禁忌：可填节令、饮食、称谓、讳莫如深的话题；决定世界的质感与人物的分寸。
（以上每项均可写「不设定」——留白处由正文自然呈现。）

## 二、人物构建维度（可填什么）
- 身份：职业、阶层、家庭位置、公开面目。
- 动机：眼下最想要的那一样（可随剧情改变）。
- 关系：与谁有恩、有怨、有欠、有诺。
- 缺陷：性格上的盲区、弱点或执念——缺陷驱动选择，选择驱动情节。
- 秘密：不能说出口的那件事（可选，常为情节的发动机）。
- 变化：故事结束时，认知、关系、处境至少其一须有具体改变。

## 三、情节结构可选类型
- 三幕式：建置 → 对抗 → 收束（最稳妥）。
- 起承转合：四段推进，适合短篇的匀称节奏。
- 英雄之旅：启程—启蒙—归返，适合成长与远行型故事。
- 章回体/单元连缀：每章相对自足又彼此勾连，适合群像与见闻式叙事。
- 环形结构：结尾回到开头场景而人已不同。
- 双线咬合：两条线索相向而行，交汇即高潮。
- 生活切片：不追求强情节，以一段日子的质感承载重量。
（短篇建议只选一种结构贯穿全篇。）

## 四、文风可选类型
- 白描写实：细节说话，情绪克制。
- 抒情意象：重意境、留白与物象承载情绪。
- 冷峻极简：短句、电报体、只写看得见的东西。
- 市井烟火：方言、炊烟、热乎气。
- 幽默荒诞：以笑声写悲凉。
- 奇崛瑰丽：适合幻想、传奇与史诗题材。
（文风一经选定，全篇保持一致。）

## 五、使用原则
1. 以上全部为「可选项」，不是必填清单；作者没写的，AI 不得自行补齐成硬设定。
2. 只填与本篇有关的维度——无关细节不堆砌，避免设定说明书式开头。
3. 已填写的设定即为本篇法则，须前后一致（设定漂移为重大违规）。
4. 本模板不预设任何世界观；题材、规则与力量体系全部由作者自由决定。`;

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

const defaultDynamicWorldPrompt = `你是一个小说的支线灵感生成器。根据当前故事状态与题材质感，生成"主角视线之外正在发生的事"——社会新闻一角、配角的一封未寄出的信、城市另一端的一场雨。要求：每条一句话（不超过60字），贴合故事题材与气质，可被主线采纳也可忽略；严禁直接剧透主线真相。`;

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
        { id: 'literary', name: '文学向（细腻意象·静水深流）', desc: '重意象与留白，情绪藏在物象里；慢热但后劲绵长' },
        { id: 'popular', name: '大众向（好读好追·钩子密集）', desc: '节奏明快、章末必留钩子，牺牲部分密度换取阅读的爽感' },
        { id: 'humorous', name: '幽默轻快（笑里可以藏刀）', desc: '喜剧外壳包裹正剧内核，荒诞与温情交替出手' },
        { id: 'nostalgic', name: '怀旧抒情（旧时光的质地）', desc: '年代感细节堆叠，黄昏、旧物与遗憾；情绪主导型文风' },
        { id: 'wild', name: '实验先锋（形式即内容）', desc: '打破线性与文体惯例：拼贴、戏仿、文体杂糅，形式本身承载主题' },
        { id: 'magic_realism', name: '魔幻现实（奇迹如日常）', desc: '超现实事件以平淡口吻叙述，马尔克斯式的庄严荒诞' },
        { id: 'minimal', name: '极简冷峻（海明威式冰山）', desc: '短句、白描、八分之七沉在水下；情绪靠读者自行打捞' },
        { id: 'growth', name: '成长物语（疼痛与蜕变）', desc: '聚焦一段改变人生的经历，温暖与刺痛并存，共情浓度高' },
        { id: 'healing', name: '治愈系（微光与和解）', desc: '低冲突高温度，靠人物善意与生活质感支撑，深夜读物气质' },
        { id: 'dark_comedy', name: '黑色荒诞（体面的崩塌）', desc: '以冷笑写荒谬，越一本正经越好笑也越悲凉' },
        { id: 'epic', name: '传奇叙事（命运的大开大合）', desc: '跨越岁月与地域的史诗笔法，人物在时代浪潮里沉浮' }
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
        { id: 'now', name: '当代（此时此地）', desc: '当下都市与小镇生活，细节信手拈来' },
        { id: 'millennium', name: '千禧之交（2000±10年）', desc: '网吧、磁带、小灵通；新旧交替的怀旧富矿' },
        { id: 'retro', name: '八九十年代', desc: '单位、下海、绿皮火车；粗粝而滚烫的岁月' },
        { id: 'republic', name: '民国', desc: '乱世里的洋场与乡土，旗袍与长衫共处一个屋檐' },
        { id: 'alt_hist', name: '改写历史线', desc: '某个历史节点分岔后的平行世界，考据与想象并用' },
        { id: 'fantasy', name: '架空世界', desc: '自建地理、制度与风物，规则自洽优先于炫技' },
        { id: 'near_future', name: '近未来', desc: '五十年内可想象的技术与社会，写实感打底' }
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
    titles: ['第七个站台', '南方有雨', '早班机', '所有亮着的窗', '口琴与旧冰箱', '明信片漂流记', '深夜食堂营业中', '飞过菜市场的鹰', '下一站，立春', '微光收藏家', '月亮邮局', '倒带人生', '巷口的理发店', '候鸟旅馆'],
    premises: ['外卖骑手连续一周收到同一栋废弃楼的订单', '离婚冷静期的最后一晚，两人决定先去吃碗馄饨', '城市实行"记忆减负"服务后，有人排队想找回删掉的三年', '修钢笔的老匠人收到一支笔，刻着自己的名字', '高考结束那天，班主任在讲台上坐了一夜', '搬进新居的第一夜，主角听见墙上旧钟走了两下', '父亲失踪十年后，寄来一张没有寄件地址的明信片', '小区花园的长椅上，每天清晨多出一枚不同年代的硬币', '替人排队为业的老人，最后一单排的是自己', '合唱团里唱了三十年同一声部的人，今天没来']
};

const FreeStoryConfig = {
    genreKey: 'free',
    genreName: '自由创作',
    fullSystemPrompt,
    defaultSystemPrompt,
    defaultDynamicWorldPrompt,
    systemPrompt: () => fullSystemPrompt,
    dynamicWorldPrompt: () => defaultDynamicWorldPrompt,
    setupMeta,
    openings,
    techniques,
    statKeys,
    gauges,
    nameSeeds,
    baseAttributes: { tension: 15, emotion: 15, prose: 10, pacing: 10, creativity: 10, depth: 10 },
    maxPoints: 100,
    maxTechniques: 3,
    statusFields: ['tension', 'emotionGauge'],

    renderStatus: (vars) => window.StoryStatusRenderer.refresh(vars),

    buildOpeningInstruction: (setup) => {
        // v1.6.9 修复：targetWords 缺失/为 0 时「约NaN字」进提示词；字数不可靠时整段省略
        const perChap = Math.round((Number(setup.targetWords) || 0) / (Number(setup.totalChapters) || 0));
        const lenHint = (perChap > 200) ? `（约${perChap}字）` : '';
        return `【开始创作】书名《${setup.title}》。${setup.premise ? `题材梗概：${setup.premise}。` : ''}请按【通用短篇开局模板】写出第一章${lenHint}：以具体场景开场，完成打破日常的事件与章末钩子，确立全篇叙述声音；结尾附(variable_update)变量块（含主角与至少两名角色档案卡）与6个情节走向选项。`;
    },

    onInit: function (framework) {
        console.log('[FreeStoryConfig] 自由创作配置已加载');
        document.body.classList.add('theme-free');
        const t = document.getElementById('gameTitle');
        if (t) t.textContent = `自由创作 · 《云境工坊》`;
        const statusPanelContainer = document.getElementById('statusPanelContainer');
        if (statusPanelContainer && statusPanelContainer.children.length === 0) {
            statusPanelContainer.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
        }
    }
};

window.FreeStoryConfig = FreeStoryConfig;
window.GenreStoryConfig = FreeStoryConfig;
