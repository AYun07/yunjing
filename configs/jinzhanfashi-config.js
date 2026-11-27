/**
 * 近战法师 · 开放世界扮演配置（云境整理）
 * 原著：蝴蝶蓝《近战法师》
 * 模式：roleplay（开放世界 AI 主持 + 玩家自定义身份）
 */

const fullSystemPrompt = `角色设定：你是《网游之近战法师》（蝴蝶蓝著）原著世界的主持人（GM），精通原著设定与剧情脉络，主持一场全息网游《平行世界》里的开放世界扮演。你扮演这个世界本身——从云端城的新手集散地，到月夜城的哥特教堂与狼人传说，再到行会战、佣兵团对抗赛与燃烧的远征；玩家扮演一个进入《平行世界》的自定义角色，以职业、操作与功夫/战术在虚拟世界里走出自己的路。

【原著忠实铁律（最高优先级）】
1. 原著作者为蝴蝶蓝（起点中文网著名作家，《全职高手》作者）——以原著为准。
2. 《平行世界》是全球首个大规模部署全息拟真技术的 MMORPG，游戏内时间流速与现实 1:1 同步，玩家在线行为直接映射现实生理状态（饥饿、疲劳）；虚实共生。
3. 顾飞（ID"千里一醉"）为主角：现实是育林中学体育教师、顾氏功夫传人，出身功夫世家（顾家四少爷），因学生阿发进入游戏；因职业开号时已设定为法师不可改，只能以功夫玩法师——全敏捷加点、负重力低、体质偏弱，却凭二十年苦功与"极限操作"打出近战法师之路，被称为神秘近战法师、暴力法师、最强法师。性格认真、踏实、守信、直接、坦率，正义感与自信适度，偶尔也坑人一把；无金手指、无奇遇、无逆袭爽感。
4. 公子精英团：韩家公子（团长，光明牧师，旧ID"酒鬼"，与剑鬼为网游"黄金搭档"，智商高、策略过人、超级自恋、貌妖艳如女子）组建的六人佣兵团，成员：顾飞（千里一醉）、剑鬼（盗贼，旧ID"烟鬼"，网游传奇大神）、佑哥（情报分析）、御天神鸣（弓箭手，曾的网游第一法师，年纪最小）、战无伤（战士，老牌高手，外表稳重实则好色）。团队以精英策略为核心，承接高难度任务，标志性战术：蒙面伏击、卧底渗透、精准集火。
5. 席小天（骗子天）：神秘女盗贼，狡黠，与顾飞的对手戏是全书最富张力的情感支点——顾飞守原则底线，席小天信奉"规则即工具"；结局为开放式（主动加好友），非爱情线。
6. 其他重要角色：叶小五（红尘一笑，游戏平衡实验线）、细腰舞（女子公会重生紫晶主导者）、水深（丛林作战革新）、百世经纶、断水箭（军事素养）等。各人有自己的立场与声口，禁止共用一种腔调。
7. 成长体系双轨：官方数值体系（力量/体质/敏捷/智力/精神五维，每级5点自由加点）+ 玩家自驱技能树（鉴定术、附法攻击、电流墙壁等职业技能，及"唐刀九连""分流三式"等功夫流派衍生技）。核心突破是"极限操作"——精准发力、时机把控使伤害最大化，低等级可越阶挑战。
8. 地图：以云端城为原点，辐射月夜城、白石主城、霞雾城、林荫城、落日城等十二主城，环状分布；各主城人文鲜明（云端城新玩家集散地、蒸汽朋克混合东方元素；月夜城哥特教堂与狼人传说；霞雾城终年大雾、地形混沌；林荫城密林纵横、陷阱潜行核心区）。地图非静态沙盒，NPC生态、怪物刷新、环境交互随版本更新动态演化。
9. 核心思想：当社会评价体系失效时，个体如何通过极致专精重建价值坐标——顾飞的"功夫"不仅是技击之术，更是拒绝被定义的生命姿态。文风冷峻幽默、白描见骨、节奏明快、善用反讽与留白。
10. 禁止：无脑爽文打脸、数值面板淹没场景、把顾飞写成有金手指的龙傲天、把席小天写成恋爱脑、正文出现"作为AI/根据设定"。防剧透：按玩家所处版本节点给信息，不提前倒出后期首领与结局。`;

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

const defaultDynamicWorldPrompt = `你是《网游之近战法师》开放世界的支线灵感生成器。根据玩家当前所在主城与版本节点，生成"主角视线之外正在发生的事"——世界频道的一句喊话、行会公告、敌对行会的调动、交易所价格波动、公子精英团接到的新委托、某位高手的动向。每条一句话（不超过60字），须符合《平行世界》的网游气质与顾飞式冷峻幽默的基调，可被主线采纳也可忽略；严禁剧透主线真相。`;

const setupMeta = {
    perspectives: [{ id:"second", name:"第二人称沉浸", desc:"以你亲历网游人生" },{ id:"first", name:"第一人称自述", desc:"第一人称数据流笔法" },{ id:"third_limited", name:"第三人称跟随", desc:"镜头式跟随" },{ id:"mixed", name:"混合视角", desc:"场景第三、抉择第二" }],
    styles: [{ id:"canon", name:"原著文风·蝴蝶蓝", desc:"推荐：冷峻幽默、白描见骨" },{ id:"cool", name:"冷硬写实", desc:"收敛幽默，突出竞技的残酷" },{ id:"light", name:"轻快明丽", desc:"节奏轻快，偏向少年成长" },{ id:"custom", name:"✎ 自定义文风", desc:"你亲笔指定笔法基调" }],
    lengths: [{ id:"short", name:"短（快切）", desc:"每轮 400-600 字" },{ id:"medium", name:"中（推荐）", desc:"每轮 600-1000 字" },{ id:"long", name:"长（铺陈）", desc:"每轮 1000-1300 字" }],
    eras: [{ id:"newbie", name:"新手期·云端城", desc:"初入平行世界，转正与第一桶金" },{ id:"guildrise", name:"行会与佣兵团", desc:"组建/加入佣兵团，承接高难任务" },{ id:"duel", name:"对抗赛与远征", desc:"高手对决、行会战与燃烧的远征" },{ id:"custom_era", name:"✎ 自定义入场", desc:"你亲笔指定入场时机" }],
    motifs: [{ id:"growth", name:"从新手到巅峰", desc:"由默默无闻走上塔尖" },{ id:"guild", name:"行会争锋", desc:"团队与行会的博弈" },{ id:"duel", name:"高手对决", desc:"与顶级玩家的较量" },{ id:"reality", name:"虚实交织", desc:"游戏与现实双线" }],
    identities: [{ id:"player", name:"自定义玩家", desc:"你亲笔设定职业与出身，进入平行世界" },{ id:"guild", name:"小行会成员", desc:"隶属某个行会，随行会参与任务与争锋" },{ id:"solo", name:"独行玩家", desc:"无行会无团队，靠自己的操作立足" },{ id:"student", name:"学生玩家", desc:"课余进入游戏，时间有限却格外专注" },{ id:"worker", name:"打金工作室", desc:"以游戏为生的职业玩家，讲效率与产出" },{ id:"custom", name:"✎ 自定义身份", desc:"身份与开局细节由你亲笔写" }],
    aptitudes: [{ id:"high", name:"天赋型", desc:"反应快、上手迅速，天生适合操作流" },{ id:"mid", name:"勤练型", desc:"资质平常，靠反复练习磨出精准操作" },{ id:"low", name:"手残型", desc:"起步迟缓，但意志与战术可补操作" },{ id:"custom", name:"✎ 自定义资质", desc:"你亲笔指定资质与缺陷" }],
    timelines: [{ id:"newbie", name:"新手期·云端城", desc:"初入平行世界，转正与第一桶金" },{ id:"guildrise", name:"行会与佣兵团", desc:"组建/加入佣兵团，承接高难任务" },{ id:"duel", name:"对抗赛与远征", desc:"高手对决、行会战与燃烧的远征" },{ id:"custom_era", name:"✎ 自定义入场", desc:"你亲笔指定入场时机" }],
    backgrounds: ["育林中学的体育老师，因学生阿发拉你进了《平行世界》","功夫世家的传人，家里盼你在游戏里也打出名堂","打金工作室的新人，效率是你的第一信条","独行侠，不加入任何行会，只信自己的操作","大学生玩家，课余时间有限却格外珍惜每一场战斗","小行会里被坑过的新手，如今学会了精明"],
    zones: [{id:"yunduan",name:"云端城",desc:"新玩家集散地，蒸汽朋克与东方元素交融"},{id:"yeyue",name:"月夜城",desc:"哥特教堂与狼人传说的主城"},{id:"xianwu",name:"霞雾城",desc:"终年大雾、地形混沌不可测"},{id:"linyin",name:"林荫城",desc:"密林纵横，陷阱与潜行战术核心区"},{id:"luori",name:"落日城",desc:"十二主城之一，落日熔金的边陲大城"}],
    flavor: {"surname":["顾","韩","剑","御","战","叶","席","水"],"m":["千里一醉","剑鬼","酒鬼","御天神鸣","战无伤","叶小五"],"f":["席小天","细腰舞","红尘一笑"]},
    ageRange: [16,40],
    names: ["顾飞","韩家公子","剑鬼","御天神鸣","战无伤","叶小五","席小天","细腰舞","佑哥","水深"]
};

const openings = [{ id:"newbie_start", name:"云端城开局", pointsModifier:8, description:"全息网游《平行世界》开服，你在云端城的新手区醒来", effectsText:"初始 敏捷+15", effects:{} },{ id:"guild_call", name:"行会招募", pointsModifier:12, description:"一支行会正在招人，高难任务与丰厚报酬摆在面前", effectsText:"初始 杀机+20", effects:{crisis:20} },{ id:"duel_invite", name:"高手约战", pointsModifier:14, description:"世界频道里有人点名约战，围观者已经围成一圈", effectsText:"初始 杀机+25", effects:{crisis:25} },{ id:"bug_hunt", name:"漏洞猎人", pointsModifier:-8, description:"你发现了一处可能被利用的规则漏洞——用它，还是守住底线？", effectsText:"初始 气运+15", effects:{fortune:15} },{ id:"worker_job", name:"打金差事", pointsModifier:-6, description:"工作室接下一单大活，效率与产出压倒一切", effectsText:"初始  strategy+15", effects:{} },{ id:"quiet_start", name:"平静开局", pointsModifier:-12, description:"没有奇遇没有神装：一个账号、一双眼睛、一步一步练", effectsText:"初始 心性+20", effects:{} }];

const techniques = [{ id:"melee", name:"近战格斗", cost:0, description:"把现实功夫带进游戏：顾飞式的贴身搏杀，法师职业也能打出拳脚" },{ id:"limit_op", name:"极限操作", cost:5, description:"精准发力与时机把控，把伤害压缩到理论极值，低等级越阶挑战" },{ id:"tactics", name:"战术布局", cost:5, description:"韩家公子式的坐标引导与风筝战术，以智取胜" },{ id:"ambush", name:"卧底渗透", cost:10, description:"蒙面伏击与身份隐匿，公子精英团的标志性手段" },{ id:"appraisal", name:"鉴定之术", cost:10, description:"辨装备真伪与词条价值，打金与捡漏的本钱" },{ id:"survival", name:"丛林生存", cost:10, description:"借地形与NPC生态周旋，霞雾城与林荫城的立足本事" },{ id:"smith", name:"锻造附魔", cost:15, description:"打造与附法，把材料变成趁手的装备" },{ id:"leadership", name:"行会经营", cost:15, description:"建帮、驻地经营与贡献点管理，从高手到领袖" }];

const statKeys = [{key:"li",label:"力量"},{key:"min",label:"敏捷"},{key:"zhi",label:"智力"},{key:"ti",label:"体质"},{key:"jing",label:"精神"},{key:"yun",label:"幸运"}];

const gauges = [{key:"crisis",label:"战况",icon:"⚔",color:"linear-gradient(90deg,#784848,#d85858)",default:30},{key:"mana",label:"专注",icon:"✨",color:"linear-gradient(90deg,#486878,#88b8d8)",default:60},{key:"fortune",label:"运气",icon:"🍀",color:"linear-gradient(90deg,#687848,#b8d878)",default:45}];

const nameSeeds = {
    flavor: {"surname":["顾","韩","剑","御","战","叶","席","水"],"m":["千里一醉","剑鬼","酒鬼","御天神鸣","战无伤","叶小五"],"f":["席小天","细腰舞","红尘一笑"]},
    ageRange: [16,40],
    names: ["顾飞","韩家公子","剑鬼","御天神鸣","战无伤","叶小五","席小天","细腰舞","佑哥","水深"],
    backgrounds: ["育林中学的体育老师，因学生阿发拉你进了《平行世界》","功夫世家的传人，家里盼你在游戏里也打出名堂","打金工作室的新人，效率是你的第一信条","独行侠，不加入任何行会，只信自己的操作","大学生玩家，课余时间有限却格外珍惜每一场战斗","小行会里被坑过的新手，如今学会了精明"]
};

const JinzhanfashiStoryConfig = {
    mode: 'roleplay',
    genreKey: 'jinzhanfashi',
    genreName: '近战法师',
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
    imageStyle: '全息网游《平行世界》，云端城到十二主城，功夫与法术结合的近战法师，冷峻幽默数据流，青碧与电光主调',
    renderStatus: (vars) => window.StoryStatusRenderer ? window.StoryStatusRenderer.refresh(vars) : "",
    buildOpeningInstruction: (setup) => {
        const idPart = setup.customIdentity ? `自定义身份（最高优先级）：${setup.customIdentity}` : setup.identity;
        const aptPart = setup.customAptitude ? `自定义资质：${setup.customAptitude}` : `资质：${setup.aptitude}`;
        const stylePart = setup.customStyle ? `文风基调：${setup.customStyle}` : `文风基调：${setup.style || ""}`;
        const timePart = setup.customTimeline ? `入场时机（严格执行）：${setup.customTimeline}` : `入场时机：${setup.timeline}`;
        const entryPart = setup.customEntry ? `；第一幕：${setup.customEntry}` : "";
        const boonPart = setup.customBoon ? `；起始机缘：${setup.customBoon}` : "";
        return `【入场】玩家角色「${setup.playerName}」（${setup.gender}，${setup.age}岁，${idPart}，${aptPart}）踏入《近战法师》原著网游世界——${timePart}${entryPart}${boonPart}。${stylePart}。请主持开场：呈现具体场景与氛围，落实玩家处境与当务之急，引入至少一个原著真实事件或传闻与玩家交集；结尾附(variable_update)变量块与6个【行动选项】。`;
    },
    onInit: function (framework) {
        console.log('[JinzhanfashiStoryConfig] 近战法师配置已加载');
        document.body.classList.add('theme-jinzhanfashi');
        const t = document.getElementById('gameTitle'); if (t) t.textContent = `近战法师 · 《云境工坊》`;
        const c = document.getElementById('statusPanelContainer');
        if (c && c.children.length === 0 && window.StoryStatusRenderer) c.innerHTML = window.StoryStatusRenderer.generatePanelHTML();
    }
};

window.JinzhanfashiStoryConfig = JinzhanfashiStoryConfig;
window.GenreStoryConfig = JinzhanfashiStoryConfig;
