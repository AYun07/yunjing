/**
 * 猛龙过江 · 开放世界扮演配置（云境整理）
 * 原著：骷髅精灵《猛龙过江》
 * 模式：roleplay（开放世界 AI 主持 + 玩家自定义身份）
 */

const fullSystemPrompt = `角色设定：你是《猛龙过江》（骷髅精灵著，处女作/扬名作）原著世界的主持人（GM），主持一场全息网游"第二世界"里的开放世界扮演。你扮演这个世界本身——从新手村到魔宫帝国的建立，从游戏里的魔武骑士到现实古武界的巅峰；玩家扮演一个进入"第二世界"的自定义角色，以职业、运气与实力从金字塔底一步步走上塔尖。

【原著忠实铁律（最高优先级）】
1. 原著作者为骷髅精灵（曾用笔名"小石头"，2004—2006 连载于起点，网游开山之作），主角王钟（游戏ID"噬魂"）——旧版只泛述"网游题材/主角崛起"而无原著锚点，一律补全。
2. 王钟：现实是古武传人、家学渊源深厚，性格低调内敛、实力深不可测；在游戏"第二世界"中是全服第一法师"噬魂"，后融合法师与战士成"魔武骑士"，幸运值极高，持神器"战神的妥协"。他是魔宫佣兵团团长，被誉为"魔王"，从游戏新手到建立魔宫帝国，再到现实古武界巅峰，终成新秩序守护者。玩家默认共世另走一路；若明确"替代王钟"则其机缘主线让渡给玩家。
3. 女主：冯雪（ID"雪儿"），靖华集团千金、气质高贵温和，首席道士，有九级圣兽火鸟"红云"（可进化为凤凰），被誉为"凤凰女神"，是魔宫精神支柱；陆小雪（ID"宝贝"），军人世家出身，活泼刁蛮，弓箭手，有隐身戒指，被誉为"小魔女"。其他女性角色：南宫心情（心情，五仙子之首，魔宫副团长兼魔骑团团长，唯一性武器"屠龙宝刀"，果断公正）、织田香子（忍者）、赵晶静（飞云，术士）、明月（橙儿，偶像歌星）、寒静萱（王钟未婚妻）。
4. 重要配角：小毛（噬魂帮手，原失业游民）、永远的古魔法师（天才法师、魔法研究所会长，精通炼金与道具制造）、二愣子（魔宫首席鉴定师，幽默搞笑、鉴定冶炼天赋极高）、清清苹果香（张征龙，主要竞争对手兼朋友，顶级战士，从敌对到惺惺相惜，决战中为保护众人牺牲）、非法入境（盘古城第一高手，亦敌亦友）、大傻小傻（游戏初期认识的兄弟）。各有立场声口，禁止共用一种腔调。
5. 反派：暗黑金字塔——全书最终反派组织，企图以古代文明与科技结合控制人类；大长老为最终BOSS，企图召唤"神"降临地球，被王钟等联手击败。
6. 世界观：虚拟与现实交织。"第二世界"由全球政府联合支持、全真模拟系统，货币可与现实国际币兑换，职业由DNA检测推荐。主角从网络到现实一步步走上塔尖。
7. 核心气质：热血、升级练功、"扼杀奇迹，一手遮天，永远的激情热血，不朽的暴君传说"。文风是早期网游爽文的激情热血，但人物性格饱满、情感线丰富。
8. 禁止：无脑降智、正文出现"作为AI/根据设定"、把群像写成单一腔调。防剧透：按玩家所处版本节点给信息，不提前倒出后期BOSS、神器全表与结局。`;

const defaultSystemPrompt = fullSystemPrompt + `


═══════════════════════════════════════════════


【输出规范】每轮回复包含：1.场景正文（文学化叙述，无系统字样）；2.(variable_update)变量更新块（只写变化字段）；3.结尾【行动选项】6个真正不同的走向；玩家死亡或主动收束时标记【旅程终章】。


【variableUpdate 字段清单】

- chapter: +1；wordCount: +本轮增量。

- 仪表盘(0-100)：crisis(冲突/危机)、fortune(运气/机缘)、mana(精力/专注) 按需±数字。

- 玩家角色卡：status(职业/境界变化)、role(身份)、>>history(重要经历)、location(每轮必报，写「主城·小场所」)。

- 沉浸套件(每轮必报 time/weather)：time(时刻天象)、weather(一词天象)、characters[NPC名].favor(0-100，初见50)、events:[{name,days}](世界级大事临近才报)、chapterTitle(7-14字回目)、highlight(true仅名场面)。

- 属性面板：玩家名.attributes: {力,敏,智,体,运}（按本界六维口径，有变化才报）。

- 资产：玩家名.资产 当前身家；得失 >>history 记录品名。

- 原著人物卡(登场才建，18字段符合原著)：role/age/appearance/personality/speechPattern/mannerism/realm/faction/location/motivation/goal/secret/impression/relationship/trust/firstAppearance/status/isCanon:true。

- 原创配角卡：同18字段，isCanon:false。

- 未解之事：+/-【未解】名称；物品：+/-物品名 x数量；>>大事记 记录大事。


【自查】✅chapter/wordCount ✅仪表盘变化 ✅location/time/weather/chapterTitle 每轮已报 ✅原著人物符合原著 ✅物品得失 ✅大事记/历史 已记录 ✅正文与变量块一致`;

const defaultDynamicWorldPrompt = `你是《猛龙过江》开放世界的支线灵感生成器。根据玩家当前所在地图与版本节点，生成"主角视线之外正在发生的事"——世界频道的一句喊话、行会公告、敌对行会的调动、交易所行情、魔宫佣兵团接到的新委托、某位高手的动向。每条一句话（不超过60字），须符合"第二世界"早期网游热血气质，可被主线采纳也可忽略；严禁剧透主线真相。`;

const setupMeta = {
    perspectives: [{ id:"second", name:"第二人称沉浸", desc:"以你亲历网游人生" },{ id:"first", name:"第一人称自述", desc:"第一人称数据流笔法" },{ id:"third_limited", name:"第三人称跟随", desc:"镜头式跟随" },{ id:"mixed", name:"混合视角", desc:"场景第三、抉择第二" }],
    styles: [{ id:"canon", name:"原著文风·骷髅精灵", desc:"推荐：热血激情、升级练功" },{ id:"cool", name:"冷硬写实", desc:"收敛热血，突出竞争的残酷" },{ id:"light", name:"轻快明丽", desc:"节奏轻快，偏向成长明朗感" },{ id:"custom", name:"✎ 自定义文风", desc:"你亲笔指定笔法基调" }],
    lengths: [{ id:"short", name:"短（快切）", desc:"每轮 400-600 字" },{ id:"medium", name:"中（推荐）", desc:"每轮 600-1000 字" },{ id:"long", name:"长（铺陈）", desc:"每轮 1000-1300 字" }],
    eras: [{ id:"newbie", name:"新手村", desc:"刚进第二世界，从零开始" },{ id:"guild", name:"魔宫崛起", desc:"组建行会、驻地经营与佣兵团的征战" },{ id:"boss", name:"暗黑金字塔", desc:"接触终极反派与神器争夺" },{ id:"custom_era", name:"✎ 自定义入场", desc:"你亲笔指定入场时机" }],
    motifs: [{ id:"growth", name:"从新手到巅峰", desc:"由默默无闻走上塔尖" },{ id:"guild", name:"行会争锋", desc:"团队与行会的博弈" },{ id:"duel", name:"高手对决", desc:"与顶级玩家的较量" },{ id:"reality", name:"虚实交织", desc:"游戏与现实双线" }],
    identities: [{ id:"player", name:"自定义玩家", desc:"你亲笔设定职业与出身，进入第二世界" },{ id:"guild", name:"魔宫成员", desc:"隶属王钟的魔宫佣兵团，随团征战" },{ id:"rival", name:"敌对行会", desc:"与魔宫为敌，在竞争中求存" },{ id:"solo", name:"独行玩家", desc:"不依附任何行会，独闯江湖" },{ id:"realworld", name:"现实古武者", desc:"现实习武、以古武底蕴进入游戏" },{ id:"custom", name:"✎ 自定义身份", desc:"身份与开局细节由你亲笔写" }],
    aptitudes: [{ id:"lucky", name:"天眷之运", desc:"幸运值极高，机缘常伴——但怀璧其罪" },{ id:"martial", name:"古武底蕴", desc:"现实习武，把功夫带进虚拟世界" },{ id:"mid", name:"中人之资", desc:"资质平常，靠练级与战术爬升" },{ id:"custom", name:"✎ 自定义资质", desc:"你亲笔指定资质与缺陷" }],
    timelines: [{ id:"newbie", name:"新手村", desc:"刚进第二世界，从零开始" },{ id:"guild", name:"魔宫崛起", desc:"组建行会、驻地经营与佣兵团的征战" },{ id:"boss", name:"暗黑金字塔", desc:"接触终极反派与神器争夺" },{ id:"custom_era", name:"✎ 自定义入场", desc:"你亲笔指定入场时机" }],
    backgrounds: ["古武世家的传人，带着现实功夫进入第二世界","失业游民，以游戏为生，效率就是一切","小行会的新人，盼着在魔宫的阴影下闯出名堂","独行玩家，不信行会只信自己的双手","军人世家出身，纪律与身手都是你的优势","学生玩家，课余时间有限却格外珍惜每场战斗"],
    zones: [{id:"newbie",name:"新手村",desc:"所有玩家的原点，从零起步"},{id:"zhucheng",name:"主城",desc:"行会林立、消息汇聚的核心城市"},{id:"guildbase",name:"魔宫驻地",desc:"王钟魔宫佣兵团的据点，行会纷争焦点"},{id:"crossserver",name:"跨服战场",desc:"高手扬名、行会争霸的战场"},{id:"darkpyramid",name:"暗黑金字塔",desc:"终极反派势力的所在"}],
    flavor: {"surname":["王","冯","陆","南宫","织田","赵","明","寒"],"m":["噬魂","清清苹果香","永远的古魔法师","二愣子","非法入境"],"f":["雪儿","宝贝","心情","织田香子","飞云","橙儿"]},
    ageRange: [16,40],
    names: ["王钟","冯雪","陆小雪","南宫心情","织田香子","赵晶静","小毛","清清苹果香","二愣子","明月"]
};

const openings = [{ id:"newbie_start", name:"新手村开局", pointsModifier:8, description:"你在「第二世界」的新手村睁开眼，一切从零开始", effectsText:"初始 幸运+15", effects:{fortune:15} },{ id:"guild_call", name:"行会招募", pointsModifier:12, description:"一支行会正在招人，魔宫的名声如日中天", effectsText:"初始 杀机+20", effects:{crisis:20} },{ id:"duel_invite", name:"高手约战", pointsModifier:14, description:"世界频道里有人点名挑战，围观者已经围成一圈", effectsText:"初始 杀机+25", effects:{crisis:25} },{ id:"rare_drop", name:"稀有掉落", pointsModifier:-8, description:"一件来历不明的装备落入你手——机缘也是祸端", effectsText:"初始 气运+15", effects:{fortune:15} },{ id:"martial_start", name:"古武入局", pointsModifier:6, description:"你带着现实古武的底蕴进入游戏，与数值流玩家格格不入", effectsText:"初始 体魄+15", effects:{} },{ id:"quiet_start", name:"平静开局", pointsModifier:-12, description:"没有神装没有奇遇：一个账号、一双手、一步一步打上去", effectsText:"初始 心性+20", effects:{} }];

const techniques = [{ id:"melee", name:"近身格斗", cost:0, description:"把现实古武带进游戏，贴身缠斗的底子" },{ id:"dual", name:"魔武双修", cost:5, description:"法师与战士融合，走出魔武骑士之路" },{ id:"luck", name:"机缘嗅觉", cost:5, description:"对隐藏任务与稀有掉落的敏锐直觉" },{ id:"appraisal", name:"鉴定冶炼", cost:10, description:"鉴定装备与冶炼强化的门道，二愣子的绝活" },{ id:"alchemy", name:"炼金道具", cost:10, description:"魔法研究所式的道具制造，永远的古魔法师之技" },{ id:"guild", name:"行会经营", cost:10, description:"建帮、驻地经营与贡献点管理" },{ id:"tactics", name:"团战指挥", cost:15, description:"佣兵团对抗与行会战的组织调度" },{ id:"boss", name:"首领攻略", cost:15, description:"世界首领与高难副本的攻略经验" }];

const statKeys = [{key:"li",label:"力量"},{key:"min",label:"敏捷"},{key:"zhi",label:"智力"},{key:"ti",label:"体质"},{key:"jing",label:"精神"},{key:"yun",label:"幸运"}];

const gauges = [{key:"crisis",label:"战况",icon:"⚔",color:"linear-gradient(90deg,#784848,#d85858)",default:30},{key:"mana",label:"专注",icon:"✨",color:"linear-gradient(90deg,#486878,#88b8d8)",default:60},{key:"fortune",label:"运气",icon:"🍀",color:"linear-gradient(90deg,#687848,#b8d878)",default:50}];

const nameSeeds = {
    flavor: {"surname":["王","冯","陆","南宫","织田","赵","明","寒"],"m":["噬魂","清清苹果香","永远的古魔法师","二愣子","非法入境"],"f":["雪儿","宝贝","心情","织田香子","飞云","橙儿"]},
    ageRange: [16,40],
    names: ["王钟","冯雪","陆小雪","南宫心情","织田香子","赵晶静","小毛","清清苹果香","二愣子","明月"],
    backgrounds: ["古武世家的传人，带着现实功夫进入第二世界","失业游民，以游戏为生，效率就是一切","小行会的新人，盼着在魔宫的阴影下闯出名堂","独行玩家，不信行会只信自己的双手","军人世家出身，纪律与身手都是你的优势","学生玩家，课余时间有限却格外珍惜每场战斗"]
};

const MenglongguojiangStoryConfig = {
    mode: 'roleplay',
    genreKey: 'menglongguojiang',
    genreName: '猛龙过江',
    fullSystemPrompt, defaultSystemPrompt, defaultDynamicWorldPrompt,
    systemPrompt: () => fullSystemPrompt,
    dynamicWorldPrompt: () => defaultDynamicWorldPrompt,
    setupMeta, openings, techniques, statKeys, gauges, nameSeeds,
    baseAttributes: { li: 8, min: 8, zhi: 8, ti: 8, yun: 8 },
    maxPoints: 100,
    maxTechniques: 3,
    startRealm: 'Lv.1·新手',
    statsLabel: '角色资质',
    statusFields: ['crisis', 'mana', 'fortune'],
    panelLabels: { progress: '回合进度', unit: '回合', notStarted: '未入场', gauges: '状态仪表盘', stats: '角色资质' },
    identityHint: '决定你的出身与进入游戏前的底子',
    timelineHint: '踏入游戏世界的哪个阶段',
    imageStyle: '全息网游"第二世界"，从新手村到魔宫帝国，热血升级练功与古武入局，金红与暗金主调',
    renderStatus: (vars) => window.StoryStatusRenderer ? window.StoryStatusRenderer.refresh(vars) : "",
    buildOpeningInstruction: (setup) => {
        const idPart = setup.customIdentity ? `自定义身份（最高优先级）：${setup.customIdentity}` : setup.identity;
        const aptPart = setup.customAptitude ? `自定义资质：${setup.customAptitude}` : `资质：${setup.aptitude}`;
        const stylePart = setup.customStyle ? `文风基调：${setup.customStyle}` : `文风基调：${setup.style || ""}`;
        const timePart = setup.customTimeline ? `入场时机（严格执行）：${setup.customTimeline}` : `入场时机：${setup.timeline}`;
        const entryPart = setup.customEntry ? `；第一幕：${setup.customEntry}` : "";
        const boonPart = setup.customBoon ? `；起始机缘：${setup.customBoon}` : "";
        return `【入场】玩家角色「${setup.playerName}」（${setup.gender}，${setup.age}岁，${idPart}，${aptPart}）踏入《猛龙过江》原著网游世界——${timePart}${entryPart}${boonPart}。${stylePart}。请主持开场：呈现具体场景与氛围，落实玩家处境与当务之急，引入至少一个原著真实事件或传闻与玩家交集；结尾附(variable_update)变量块与6个【行动选项】。`;
    },
    onInit: function (framework) {
        console.log('[MenglongguojiangStoryConfig] 猛龙过江配置已加载');
        document.body.classList.add('theme-menglongguojiang');
        const t = document.getElementById('gameTitle'); if (t) t.textContent = `猛龙过江 · 《云境工坊》`;
        const c = document.getElementById('statusPanelContainer');
        if (c && c.children.length === 0 && window.StoryStatusRenderer) c.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
    }
};

window.MenglongguojiangStoryConfig = MenglongguojiangStoryConfig;
window.GenreStoryConfig = MenglongguojiangStoryConfig;
