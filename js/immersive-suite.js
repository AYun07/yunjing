const ImmersiveSuite = function() {
  "use strict";
  const THEMES = {
    shrouding: {
      name: "遮天",
      deep: "#0b1020",
      panel: "#101830",
      primary: "#e8c477",
      accent: "#9f8ef0",
      text: "#e9e6da",
      muted: "#a9a6c0",
      realms: ["凡人", "苦海", "命泉", "神桥", "彼岸", "道宫", "四极", "化龙", "仙台", "大能", "圣人", "圣人王", "大圣", "准帝", "大帝·红尘仙"],
      realmLabel: "修行境界",
      realmHint: "轮海四境 → 道宫五藏 → 四极 → 化龙 → 仙台 → 圣道诸境",
      medium: "传音符",
      letterGreet: "道友亲启",
      courier: "灵鹊传音",
      compassName: "星轨罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["荒古", "圣墟", "星穹", "紫微", "古路", "仙台", "道音", "瑶池", "天倾", "源天"],
      titleB: ["拾遗", "惊变", "问道", "逢敌", "夜话", "渡劫", "夺缘", "归墟", "论源", "谒圣"],
      sigil: "道纹",
      sound: { kind: "bell", f0: 130, hue: 44 }
    },
    doupocangqiong: {
      name: "斗破苍穹",
      deep: "#150e08",
      panel: "#1e130a",
      primary: "#f0b45c",
      accent: "#e0703c",
      text: "#f2e8d8",
      muted: "#b8a48c",
      realms: ["斗之气", "斗者", "斗师", "大斗师", "斗灵", "斗王", "斗皇", "斗宗", "斗尊", "斗圣", "斗帝"],
      realmLabel: "斗气境界",
      realmHint: "斗之气九段筑基 → 斗者至斗帝十阶",
      medium: "飞鸽灵简",
      letterGreet: "阁下台鉴",
      courier: "商队捎信",
      compassName: "黄沙罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["乌坦", "迦南", "黑角", "塔戈尔", "云岚", "魔核", "异火", "丹会"],
      titleB: ["求药", "结怨", "夺火", "夜袭", "赌斗", "炼丹", "退婚", "雪耻"],
      sigil: "火纹",
      sound: { kind: "desert", f0: 98, hue: 28 }
    },
    douluodalu: {
      name: "斗罗大陆",
      deep: "#0a1420",
      panel: "#0e1c2c",
      primary: "#8fc3f2",
      accent: "#a8e0ff",
      text: "#e6eef8",
      muted: "#9fb4c8",
      realms: ["魂士", "魂师", "大魂师", "魂尊", "魂宗", "魂王", "魂帝", "魂圣", "封号斗罗", "巅峰斗罗", "极限斗罗", "神"],
      realmLabel: "魂师等阶",
      realmHint: "十级一阶，百级成神；魂环年限定强弱",
      medium: "魂导传讯",
      letterGreet: "见字如晤",
      courier: "驿马急递",
      compassName: "魂力罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["圣魂", "诺丁", "史莱克", "星斗", "大斗魂", "海神", "嘉陵", "武魂"],
      titleB: ["觉醒", "猎环", "斗魂", "夜训", "夺旗", "惊涛", "血战", "授业"],
      sigil: "魂环",
      sound: { kind: "chime", f0: 523, hue: 205 }
    },
    wanmeishijie: {
      name: "完美世界",
      deep: "#0a1712",
      panel: "#0e2018",
      primary: "#7ed9a8",
      accent: "#e6cf8f",
      text: "#e8f2ea",
      muted: "#a0b8a8",
      realms: ["搬血", "洞天", "化灵", "铭纹", "列阵", "尊者", "神火", "真一", "圣祭", "天神", "虚道", "斩我", "遁一"],
      realmLabel: "修行大境",
      realmHint: "搬血起步，洞天为基，一路至遁一",
      medium: "兽骨信符",
      letterGreet: "部落亲启",
      courier: "猎队带信",
      compassName: "荒古骨盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["石村", "大荒", "补天", "虚神", "太古", "仙古", "兽潮", "骨文"],
      titleB: ["围猎", "迁徙", "登塔", "祭灵", "拾荒", "结盟", "夜袭", "问仙"],
      sigil: "兽骨",
      sound: { kind: "wild", f0: 72, hue: 150 }
    },
    swallowedstar: {
      name: "吞噬星海",
      deep: "#070d1c",
      panel: "#0c1526",
      primary: "#5fd4f0",
      accent: "#8ab0ff",
      text: "#e8f0f8",
      muted: "#98a8c0",
      realms: ["学员级", "武者级", "战神级", "行星级", "恒星级", "宇宙级", "域主级", "界主级", "不朽", "宇宙之主"],
      realmLabel: "武者阶位",
      realmHint: "拳力与神经反应定级，级上还有星空",
      medium: "加密邮件",
      letterGreet: "同志见信",
      courier: "军用频道",
      compassName: "战术腕表",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["江南", "荒野", "基地", "雾岛", "训练营", "星空", "黑洞", "战刃"],
      titleB: ["考核", "巡逻", "撤离", "夺标", "夜训", "遭遇", "搏杀", "返航"],
      sigil: "军徽",
      sound: { kind: "hum", f0: 55, hue: 195 }
    },
    quanzhigaoshou: {
      name: "全职高手",
      deep: "#120e1e",
      panel: "#191327",
      primary: "#f0c060",
      accent: "#b48cf0",
      text: "#f0ecf8",
      muted: "#b0a8c8",
      realms: ["路人王", "网吧霸主", "半职业", "职业替补", "职业首发", "全明星", "冠军拼图", "王朝核心", "传奇巨星"],
      realmLabel: "竞技之路",
      realmHint: "从网吧到冠军奖杯的九级天梯",
      medium: "荣耀私信",
      letterGreet: "队友你好",
      courier: "战队邮件",
      compassName: "赛程表盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["兴欣", "嘉世", "蓝雨", "霸图", "微草", "轮回", "虚空", "烟雨"],
      titleB: ["上线", "转会", "团战", "翻盘", "加练", "抢野", "守擂", "夺冠"],
      sigil: "队徽",
      sound: { kind: "arcade", f0: 440, hue: 45 }
    },
    daoguiyixian: {
      name: "道诡异仙",
      deep: "#100a0c",
      panel: "#1c1016",
      primary: "#c9584a",
      accent: "#d8a898",
      text: "#e8dcd6",
      muted: "#a89088",
      realms: ["凡人", "学法", "得法", "斩上尸", "斩中尸", "斩下尸", "底轮", "腹轮", "脐轮", "幻海", "心轮", "喉轮", "顶轮", "司命"],
      realmLabel: "道行轮次",
      realmHint: "学法得法斩三尸，修真七轮至司命",
      medium: "托梦传音",
      letterGreet: "亲启",
      courier: "货郎捎带",
      compassName: "阴时罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["清风", "牛心", "白塔", "酆都", "白玉", "监天", "腊月", "纸人"],
      titleB: ["夜话", "讨封", "问米", "灌药", "傩戏", "香火", "换界", "还魂"],
      sigil: "阴纹",
      sound: { kind: "rain", f0: 66, hue: 8 }
    },
    zhongshengdushi: {
      name: "重生之都市修仙",
      deep: "#0c0e1a",
      panel: "#141126",
      primary: "#d8b468",
      accent: "#8a6df0",
      text: "#eef0e8",
      muted: "#a8a8c0",
      realms: ["凡人", "外劲", "内劲", "化境", "神境", "筑基", "通玄", "神海", "先天", "金丹", "元婴", "化神", "返虚", "合道", "渡劫"],
      realmLabel: "修为境界",
      realmHint: "武道四境起步，炼气三境登梯，先天之上问仙",
      medium: "加密短信",
      letterGreet: "道友台鉴",
      courier: "闪送急件",
      compassName: "都市时盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["泗水", "金陵", "燕京", "江北", "昆墟", "北琼", "昆仑", "仙土"],
      titleB: ["重生", "灯会", "打脸", "突破", "结丹", "立派", "护家", "问鼎"],
      sigil: "剑纹",
      sound: { kind: "hum", f0: 60, hue: 44 }
    },
    dibao: {
      name: "帝霸",
      deep: "#14100a",
      panel: "#1a140c",
      primary: "#d8b46a",
      accent: "#a8745a",
      text: "#efe6d4",
      muted: "#b0a488",
      realms: ["凡体武道", "命宫一重", "命宫三重", "命宫六重", "命宫九重", "命宫十二重", "真命初凝", "真命境", "道台境", "长生境", "大帝·仙帝"],
      realmLabel: "修行境界",
      realmHint: "凡体打熬 → 命宫十二重 → 叩问真命 → 道台长生 → 帝路绝巅",
      medium: "飞鹰传书",
      letterGreet: "道友亲启",
      courier: "商队捎信",
      compassName: "万古罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["边荒", "中域", "帝藏", "禁区", "坊市", "大教", "古族", "帝陵"],
      titleB: ["开宫", "夺宝", "夜话", "争渡", "点拨", "清算", "旧账", "问鼎"],
      sigil: "帝纹",
      sound: { kind: "bell", f0: 98, hue: 42 }
    },
    longzu: {
      name: "龙族",
      deep: "#0d0c16",
      panel: "#13121e",
      primary: "#8a9ae8",
      accent: "#d87a94",
      text: "#e8eaf6",
      muted: "#a0a4c0",
      realms: ["未觉醒", "C级", "B级", "A级", "S级"],
      realmLabel: "血统评级",
      realmHint: "C到S拾级而上——评级即天堑，也即诅咒",
      medium: "加密邮件",
      letterGreet: "同学见信",
      courier: "学院内网",
      compassName: "战术腕表",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["卡塞尔", "芝加哥", "执行部", "图书馆", "末班车", "东京", "家族", "冰川"],
      titleB: ["入学", "测试", "夜巡", "简报", "觉醒", "围猎", "告别", "黎明"],
      sigil: "龙纹",
      sound: { kind: "rain", f0: 87, hue: 232 }
    },
    quanzhifashi: {
      name: "全职法师",
      deep: "#0e0d18",
      panel: "#141222",
      primary: "#9d8cf0",
      accent: "#e8a25c",
      text: "#eae6f6",
      muted: "#a49cc0",
      realms: ["魔法学徒", "初级魔法师", "中级魔法师", "高级魔法师", "超级法师", "禁咒法师"],
      realmLabel: "法师等阶",
      realmHint: "学徒到禁咒拾级而上——每一级都是苦修与生死换来的质变",
      medium: "星讯",
      letterGreet: "法师台鉴",
      courier: "协会快讯",
      compassName: "星轨罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["博城", "帝都", "学院", "猎场", "结界", "公会", "雷云", "黑堂"],
      titleB: ["觉醒", "考核", "夜巡", "悬赏", "灾变", "围猎", "星辉", "黎明"],
      sigil: "星徽",
      sound: { kind: "thunder", f0: 120, hue: 258 }
    },
    limingzhijian: {
      name: "黎明之剑",
      deep: "#12100a",
      panel: "#1a1610",
      primary: "#d8a04c",
      accent: "#5fb8d8",
      text: "#e8e0d0",
      muted: "#a89878",
      realms: ["学徒", "一级", "二级", "三级", "四级", "五级", "六级", "七级", "八级", "九级", "传奇"],
      realmLabel: "法师等阶",
      realmHint: "学徒起步，一至九级拾级而上，传奇立于凡世之巅",
      medium: "魔能传讯",
      letterGreet: "阁下台鉴",
      courier: "领地驿马",
      compassName: "魔能钟塔",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["塞西尔", "南境", "废土", "魔潮", "刚铎", "圣灵平原", "奥术", "工坊"],
      titleB: ["点火", "试车", "量产", "夜话", "开荒", "警戒", "笔谈", "破晓"],
      sigil: "魔纹",
      sound: { kind: "chime", f0: 349, hue: 38 }
    },
    lunhuileyuan: {
      name: "轮回乐园",
      deep: "#0c0a0e",
      panel: "#141014",
      primary: "#e05858",
      accent: "#8a94b8",
      text: "#e8e4ea",
      muted: "#a89ca8",
      realms: ["一阶", "二阶", "三阶", "四阶", "五阶", "六阶", "七阶", "八阶", "九阶", "十阶", "绝强者", "至强者"],
      realmLabel: "契约者阶位",
      realmHint: "一阶起步十阶封顶——其上绝强与至强，位面之巅",
      medium: "乐园私信",
      letterGreet: "契约者见信",
      courier: "交易区捎带",
      compassName: "任务表盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["乐园", "交易区", "衍生世界", "悬赏榜", "强化仓", "回廊", "灰区", "清算"],
      titleB: ["组队", "猎杀", "反杀", "夜袭", "进货", "休整", "撤离", "结算"],
      sigil: "环纹",
      sound: { kind: "arcade", f0: 294, hue: 355 }
    },
    wulianfengdian: {
      name: "武炼巅峰",
      deep: "#100d0a",
      panel: "#1a1510",
      primary: "#d89030",
      accent: "#c8a878",
      text: "#ece4d8",
      muted: "#b0a48c",
      realms: ["淬体境", "开元境", "气动境", "离合境", "真元境", "神游境", "超凡境", "入圣境", "圣王境", "返虚境", "虚王境", "道源境", "帝尊境", "伪帝", "开天境"],
      realmLabel: "武道境界",
      realmHint: "淬体起步开天封顶——十六境长征，一境一重天",
      medium: "坊市信笺",
      letterGreet: "武友台鉴",
      courier: "镖局捎信",
      compassName: "武道罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["凌霄", "中都", "苍云", "玄铁", "恒罗", "坊市", "大比", "秘境"],
      titleB: ["递战", "淬体", "夺宝", "夜话", "争锋", "突破", "结怨", "问巅"],
      sigil: "剑纹",
      sound: { kind: "bell", f0: 147, hue: 36 }
    },
    shengxu: {
      name: "圣墟",
      deep: "#0a0e0f",
      panel: "#10171a",
      primary: "#4cb8a8",
      accent: "#a8c8c0",
      text: "#e8f0ee",
      muted: "#90aaa8",
      realms: ["凡人", "觉醒境", "枷锁境", "逍遥境", "观想境", "餐霞境", "塑形境", "金身境", "亚圣境", "圣者境", "映照级", "神照级", "神祇级"],
      realmLabel: "进化境界",
      realmHint: "觉醒入段，枷锁醒神通，逍遥称小妖——其上映照神祇",
      medium: "复苏讯息",
      letterGreet: "道友见信",
      courier: "伙伴团捎带",
      compassName: "复苏罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["大漠", "昆仑", "太行", "秦岭", "异人", "遗迹", "彼岸", "伙伴团"],
      titleB: ["初醒", "吐纳", "探秘", "遇袭", "异变", "结伴", "夜话", "复苏"],
      sigil: "云雷纹",
      sound: { kind: "wild", f0: 82, hue: 168 }
    },
    shenmifusu: {
      name: "神秘复苏",
      deep: "#0a0f0e",
      panel: "#0f1614",
      primary: "#7ab0a8",
      accent: "#a8c8c0",
      text: "#e8f0ec",
      muted: "#90a8a0",
      realms: ["普通人", "C级禁锢", "B级禁锢", "A级禁锢", "S级禁锢"],
      realmLabel: "禁锢等级",
      realmHint: "普通人起步S级封顶——以命换力，每一级都有价目",
      medium: "灵异档案",
      letterGreet: "幸存者见信",
      courier: "驭鬼人捎带",
      compassName: "鬼域罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["敲门声", "末班车", "旧宅", "医院", "档案", "禁锢", "黄金", "鬼域"],
      titleB: ["夜半", "叩门", "调查", "对峙", "规律", "脱身", "封印", "生还"],
      sigil: "鬼纹",
      sound: { kind: "rain", f0: 58, hue: 172 }
    },
    ditandali: {
      name: "开局地摊卖大力",
      deep: "#131009",
      panel: "#1a150c",
      primary: "#e8a04c",
      accent: "#f0c890",
      text: "#f0e8d8",
      muted: "#b09878",
      realms: ["黑铁", "青铜", "白银", "黄金", "铂金", "钻石", "星耀", "道天"],
      realmLabel: "灵武等阶",
      realmHint: "黑铁起步道天封顶——八阶长征，天赋评级压住一生",
      medium: "夜市传单",
      letterGreet: "老板见信",
      courier: "夜市捎带",
      compassName: "夜市灯牌",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["夜市", "地摊", "系统", "怨气", "大力", "灵武", "摊位", "觉醒"],
      titleB: ["开张", "吆喝", "进货", "抽奖", "开单", "遇险", "突破", "爆火"],
      sigil: "灯幌纹",
      sound: { kind: "chime", f0: 392, hue: 38 }
    },
    /* v3.25.0 凡人修仙传：凡人流的仙路长梯（炼气十三层数着走→大罗） */
    fanrenxiuxian: {
      name: "凡人修仙传",
      deep: "#0a0f12",
      panel: "#101820",
      primary: "#5db8c8",
      accent: "#a8d8e0",
      text: "#e8f0f2",
      muted: "#90a8b0",
      realms: ["凡人", "炼气", "筑基", "结丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫", "真仙", "金仙", "太乙", "大罗"],
      realmLabel: "修仙境界",
      realmHint: "炼气十三层数着走——筑基方入修士之列，元婴称一方巨擘，大乘渡劫方窥仙门",
      medium: "传音符",
      letterGreet: "道友台鉴",
      courier: "坊市捎信",
      compassName: "仙路罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["青牛镇", "黄枫谷", "坊市", "坠魔谷", "乱星海", "星城", "大晋", "天渊城"],
      titleB: ["测灵根", "入门", "夺宝", "闭关", "结丹", "遇袭", "拍卖", "飞升"],
      sigil: "剑纹",
      sound: { kind: "chime", f0: 330, hue: 192 }
    },
    /* v3.25.0 仙逆：四步之路的逆道长梯（凝气十五层→踏天） */
    xianni: {
      name: "仙逆",
      deep: "#0c0a12",
      panel: "#141020",
      primary: "#9d86d0",
      accent: "#c8b8e8",
      text: "#ece8f2",
      muted: "#a098b8",
      realms: ["凡人", "凝气", "筑基", "结丹", "元婴", "化神", "婴变", "问鼎", "阴虚", "阳实", "窥涅", "净涅", "碎涅", "空劫", "踏天"],
      realmLabel: "逆道境界",
      realmHint: "凝气十五层数着走——四步之路跨一步如换一界，踏天之上寥寥数人",
      medium: "传讯玉简",
      letterGreet: "道友见信",
      courier: "行商捎带",
      compassName: "逆途罗盘",
      hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
      titleA: ["赵国", "恒岳派", "藤家", "天南", "坊市", "鬼市", "罗天", "古神"],
      titleB: ["收徒", "测灵", "血仇", "凶名", "夺宝", "心魔", "闭关", "踏天"],
      sigil: "逆纹",
      sound: { kind: "hum", f0: 72, hue: 268 }
    },
    earth: {
      name: "地球开放世界",
      deep: "#0e1416",
      panel: "#141d1f",
      primary: "#5a9e7f",
      accent: "#c9a06a",
      text: "#e8f0ea",
      muted: "#98aaa0",
      realms: ["初来乍到", "勉强度日", "安身立命", "小有积蓄", "成家立业", "家业渐兴", "一方乡望", "功成名就", "颐养天年"],
      realmLabel: "人生境遇",
      realmHint: "无剧情的人生阶梯——从初来乍到到颐养天年，一步一个脚印过出来",
      medium: "亲笔书信",
      letterGreet: "见字如面",
      courier: "邮差投递",
      compassName: "时空罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["清晨", "市集", "码头", "车站", "弄堂", "田野", "工坊", "账房", "学堂", "饭馆"],
      titleB: ["谋生", "还债", "赶集", "谈成", "翻脸", "来信", "夜话", "落雪", "离别", "重逢"],
      sigil: "球纹",
      sound: { kind: "chime", f0: 262, hue: 160 }
    },
    /* v3.31.2 全球冰封：冰蓝末世——境界梯按空间异能原著脉络，信物走末世对讲频道 */
    quanqiubingfeng: {
      name: "全球冰封",
      deep: "#080f16",
      panel: "#0e1a24",
      primary: "#6fc0e0",
      accent: "#d8a860",
      text: "#e6f0f6",
      muted: "#8ca4b4",
      realms: ["凡人之躯", "空间异能·初醒", "空间异能·收放自如", "空间异能·容量精进", "空间异能·空间进化", "新蓝星之主"],
      realmLabel: "异能境界",
      realmHint: "识海虚空随囤随长——从初醒到新蓝星之主，容量即命",
      medium: "对讲频道",
      letterGreet: "幸存者见信",
      courier: "末路捎带",
      compassName: "寒潮罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["翡翠湾", "沃尔玛", "天海市", "安全屋", "北郊", "死城", "大仓", "地库", "冰原", "极光"],
      titleB: ["囤货", "加固", "降温", "叩门", "夜巡", "清算", "破冰", "过冬", "断电", "雪夜"],
      sigil: "冰纹",
      sound: { kind: "wind", f0: 52, hue: 202 }
    },
    /* v3.37.0 超神学院：圣光金辉——境界梯按超级基因原著脉络，信物走军用战术频道 */
    chaoshenxueyuan: {
      name: "超神学院",
      deep: "#0c0e18",
      panel: "#12141f",
      primary: "#e8c478",
      accent: "#7e9cd8",
      text: "#eef0e6",
      muted: "#9aa4bc",
      realms: ["凡人之躯·未觉醒", "一代超级战士", "二代超级战士", "二代·巅峰", "三代神体·初成", "神体·大圆满"],
      realmLabel: "基因觉醒",
      realmHint: "超级基因一级一级觉醒——一代扛枪弹，二代开异能，三代拆舰队",
      medium: "战术频道",
      letterGreet: "战友见讯",
      courier: "军邮转达",
      compassName: "战情罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["雄兵连", "天刃", "巨峡市", "费雷泽", "冥河", "虚空", "防线", "军营", "圣城", "天使星云"],
      titleB: ["集结", "空袭", "断后", "夜航", "契约", "突袭", "军礼", "牺牲", "反攻", "诸神"],
      sigil: "圣徽",
      sound: { kind: "chime", f0: 392, hue: 44 }
    },
    /* v3.38.0 斩神：迷雾青灰——境界梯按精神力六境原著脉络，信物走守夜人频道 */
    zhanhen: {
      name: "斩神",
      deep: "#101418",
      panel: "#141a1e",
      primary: "#a8c4c8",
      accent: "#9e86d0",
      text: "#e8f0f2",
      muted: "#8aa0a8",
      realms: ["凡人之躯·未觉醒", "盏境", "池境", "川境", "海境", "无量境·初窥", "克莱因境·破维度"],
      realmLabel: "精神力境界",
      realmHint: "精神力六境步步登天——盏境觉醒，池境外放，川境成势，海境称雄",
      medium: "守夜人频道",
      letterGreet: "守夜人见讯",
      courier: "哨点转达",
      compassName: "迷雾罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["沧南", "病院", "哨点", "雾区", "夜市", "沉龙关", "集训营", "旧城", "血月", "禁区"],
      titleB: ["值夜", "巡逻", "雾起", "斩落", "巡房", "结缘", "牺牲", "守望", "破境", "低语"],
      sigil: "雾纹",
      sound: { kind: "wind", f0: 196, hue: 195 }
    },
    /* v3.47.3 剑来：山水墨青——境界梯按练气十一境原著脉络，信物走飞剑传书 */
    jianlai: {
      name: "剑来",
      deep: "#101815",
      panel: "#16201c",
      primary: "#8fc4b8",
      accent: "#d8b86a",
      text: "#e8f0ec",
      muted: "#8aa8a0",
      realms: ["凡夫俗子", "下五境·淬体", "洞府境·中五", "观海境", "龙门境", "金丹境", "元婴境", "玉璞境·上五", "仙人境", "飞升境", "十四境·巅峰"],
      realmLabel: "修行境界",
      realmHint: "练气十一境步步登高——洞府开脉，观海养气，龙门一跃金丹成",
      medium: "飞剑传书",
      letterGreet: "敬启",
      courier: "驿站中转",
      compassName: "山水罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["骊珠洞天", "泥瓶巷", "落魄山", "山崖书院", "剑气长城", "倒悬山", "渡口", "藕花福地"],
      titleB: ["问心", "递帖", "登山", "求学", "斩妖", "护山", "远游", "论道"],
      sigil: "剑纹",
      sound: { kind: "chime", f0: 329.63, hue: 168 }
    },
    /* v3.47.3 诡秘之主：雾都暗紫——境界梯按序列 9→0，信物走邮政与电报 */
    guimi: {
      name: "诡秘之主",
      deep: "#14101a",
      panel: "#1a1422",
      primary: "#b8a0d8",
      accent: "#c9a06a",
      text: "#eae4f0",
      muted: "#a094b0",
      realms: ["凡人", "序列9", "序列8", "序列7", "序列6", "序列5", "序列4·圣者", "序列3", "序列2", "序列1·天使", "序列0·真神"],
      realmLabel: "非凡序列",
      realmHint: "序列九到零——魔药一口一口喝，扮演一分一分做，失控一步之遥",
      medium: "信件与电报",
      letterGreet: "敬启者",
      courier: "邮政转达",
      compassName: "占卜罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["贝克兰德", "明斯克街", "黑荆棘", "廷根", "塔苏克港", "教堂", "占卜屋", "舞会"],
      titleB: ["雾夜", "仪式", "占卜", "匿名信", "失窃", "出勤", "祈祷", "重逢"],
      sigil: "雾纹",
      sound: { kind: "rain", f0: 98, hue: 262 }
    },
    /* v3.47.3 蛊真人：蛊光幽绿——境界梯按蛊师转数，信物走传讯蛊 */
    guzhenren: {
      name: "蛊真人",
      deep: "#0c140c",
      panel: "#121c12",
      primary: "#8fd88a",
      accent: "#d84a4a",
      text: "#e8f2e8",
      muted: "#90b090",
      realms: ["凡人", "一转", "二转", "三转", "四转", "五转·蛊仙", "六转", "七转", "八转", "九转·仙尊"],
      realmLabel: "蛊师转数",
      realmHint: "一转到九转——真元、蛊虫、杀招，全凭熬与抢",
      medium: "传讯蛊",
      letterGreet: "如晤",
      courier: "飞蛊传讯",
      compassName: "寻踪蛊盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["青茅山", "古月家", "炼蛊房", "坊市", "义庄", "白云山", "猎场", "蛮荒"],
      titleB: ["炼蛊", "苦战", "夺宝", "盟誓", "反目", "夜袭", "交易", "杀劫"],
      sigil: "蛊纹",
      sound: { kind: "wind", f0: 146, hue: 96 }
    },
    /* v3.47.3 玄鉴仙族：灵田丹金——境界梯按炼气至飞升十阶，信物走传讯符 */
    xuanjianxianzu: {
      name: "玄鉴仙族",
      deep: "#101810",
      panel: "#161e16",
      primary: "#9fd8a8",
      accent: "#e8c45c",
      text: "#e8f0e8",
      muted: "#98b098",
      realms: ["凡人", "炼气·入门", "炼气·圆满", "筑基期", "金丹期", "元婴期", "化神期", "炼虚合体", "大乘期", "渡劫飞升"],
      realmLabel: "修为境界",
      realmHint: "炼气筑基金丹元婴——一阶一阶熬，一族一代人托一代人",
      medium: "传讯符",
      letterGreet: "族亲台启",
      courier: "坊市信阁",
      compassName: "望气罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["玄鉴宗", "灵田", "丹房", "藏经阁", "演武场", "祖祠", "矿脉", "坊市"],
      titleB: ["种田", "炼丹", "培育", "大比", "闭关", "联姻", "守护", "开山"],
      sigil: "灵纹",
      sound: { kind: "chime", f0: 261.63, hue: 130 }
    },
    /* v3.24.0 自由世界：世界玩家亲笔——境遇阶梯无剧本、章题词库世界中性（任何世界都成立） */
    freeworld: {
      name: "自由世界",
      deep: "#120f18",
      panel: "#1a1522",
      primary: "#b98fd8",
      accent: "#d8b088",
      text: "#ece6f0",
      muted: "#a898b0",
      realms: ["初来乍到", "立足未稳", "小有名气", "安身立命", "一方人物", "声望渐起", "执掌一方", "功成身退", "此生无憾"],
      realmLabel: "人生境遇",
      realmHint: "世界是你写的——境遇阶梯没有剧本，一步一步活出来",
      medium: "传讯",
      letterGreet: "见字如面",
      courier: "顺路人捎带",
      compassName: "世界罗盘",
      hourSet: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22"],
      titleA: ["清晨", "市集", "渡口", "巷陌", "山道", "工坊", "账房", "夜市", "异乡", "旧宅"],
      titleB: ["谋生", "还债", "赶集", "谈成", "翻脸", "来信", "夜话", "落雪", "离别", "重逢"],
      sigil: "星纹",
      sound: { kind: "chime", f0: 330, hue: 275 }
    }
  };
  THEMES.mystery = THEMES.wuxia = THEMES.cthulhu = THEMES.scifi = {
    name: "创作",
    deep: "#12100c",
    panel: "#1a1712",
    primary: "#d8c8a0",
    accent: "#9f8ef0",
    text: "#ece5d4",
    muted: "#a89f8c",
    realms: ["开笔", "立骨", "血肉", "转折", "高潮", "收束", "润稿", "完本"],
    realmLabel: "写作里程",
    realmHint: "以章节进度自动爬梯",
    medium: "读者来信",
    letterGreet: "作者亲启",
    courier: "编辑部转达",
    compassName: "案头更漏",
    hourSet: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
    titleA: ["雾夜", "旧宅", "深巷", "孤灯", "长夜", "冷雨"],
    titleB: ["来信", "谜面", "对峙", "真相", "抉择", "终章"],
    sigil: "墨纹",
    sound: { kind: "rain", f0: 110, hue: 40 }
  };
  const state = {
    genre: null,
    tab: "gallery",
    open: false,
    gallery: {},
    /* id → {name, role, desc, firstRound, lastRound, favor, tags[], line} */
    items: [],
    /* [{name, count, note, rarity, round}] */
    events: [],
    /* [{name, days, round, done}] */
    letters: [],
    /* [{id, from, title, body, round, read, replied}] */
    highlights: [],
    /* [{round, title, excerpt, tension}] */
    battles: [],
    /* [{round, result, moves, loot, wounds, foes}] */
    titles: [],
    /* [{round, title}] */
    time: null,
    weather: null,
    day: null,
    realmIdx: 0,
    realmRaw: "",
    chronicle: [],
    /* [{round, text}] ← 大事记 */
    tensions: []
    /* v3.14.0 [{round, v}] ← 张力曲线逐轮描点（0-100） */
  };
  const store = {};
  const skey = () => window.claimSlotKey ? window.claimSlotKey("imm_" + state.genre, state.genre) : "imm_" + state.genre;
  const immKey = (genre) => window.claimSlotKey ? window.claimSlotKey("imm_" + (genre || state.genre), genre || state.genre) : "imm_" + (genre || state.genre);
  function save() {
    const v = JSON.stringify(state);
    try {
      MoStore.setItem(skey(), v);
    } catch (e) {
    }
    store[skey()] = v;
  }
  function load(genre) {
    state.genre = genre;
    let raw = null;
    const myKey = immKey(genre);
    try {
      raw = MoStore.getItem(myKey) || store[myKey];
    } catch (e) {
      raw = store[myKey] || null;
    }
    const base = { tab: "gallery", gallery: {}, items: [], events: [], letters: [], highlights: [], battles: [], titles: [], chronicle: [], tensions: [], realmIdx: 0, realmRaw: "", time: null, weather: null, day: null };
    Object.assign(state, base);
    if (raw) {
      try {
        const o = JSON.parse(raw);
        Object.assign(state, o, { genre, open: state.open });
      } catch (e) {
      }
    }
    if (!Array.isArray(state.tensions)) state.tensions = [];
    try {
      if (state.gallery) for (const k of Object.keys(state.gallery)) {
        const g = state.gallery[k];
        if (!g || typeof g !== "object") {
          delete state.gallery[k];
          continue;
        }
        for (const f of ["name", "role", "desc", "status", "secret", "line", "relation"]) {
          if (g[f] != null && typeof g[f] !== "string") g[f] = String(g[f]);
        }
      }
      if (state.time != null) state.time = String(state.time);
      if (state.weather != null) state.weather = String(state.weather);
      if (state.day != null) state.day = String(state.day);
      if (state.realmRaw != null) state.realmRaw = String(state.realmRaw);
    } catch (e) {
    }
    try {
      if (window.AmbienceLayer) AmbienceLayer.setGenre(genre);
    } catch (e) {
    }
    try {
      if (window.TimelineBranch) TimelineBranch.onGenre(genre);
    } catch (e) {
    }
    try {
      if (window.GameLayer) GameLayer.onGenre(genre);
    } catch (e) {
    }
    try {
      if (window.ReaderLetters) ReaderLetters.onGenre(genre);
    } catch (e) {
    }
  }
  function reload() {
    if (!state.genre) return;
    try {
      delete store[skey()];
    } catch (e) {
    }
    load(state.genre);
    if ($("immDrawerMount")) {
      try {
        $("immDrawerMount").innerHTML = hubHTML();
        renderTab();
      } catch (e) {
      }
    }
  }
  const T = () => THEMES[state.genre] || THEMES.mystery;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const uid = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function hash(s) {
    let h = 5381;
    s = String(s);
    for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) >>> 0;
    return h;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  const $ = (id) => document.getElementById(id);
  function playerName(vars) {
    const st = window.storyFramework && window.storyFramework.storyState || {};
    const pn = st.setup && st.setup.playerName;
    if (pn) return pn;
    const cs = vars.characters || {};
    for (const [k, v] of Object.entries(cs)) {
      if (v && (v.isPlayer || k === "玩家" || k === "主角")) return k;
    }
    for (const [k, v] of Object.entries(vars)) {
      if (/\.location$/.test(k)) return k.split(".")[0];
    }
    return null;
  }
  function ingestCharacters(vars, round) {
    const cs = vars.characters || {};
    const pn = playerName(vars);
    const str = (v) => v == null ? null : String(v);
    for (const [name, c] of Object.entries(cs)) {
      if (!c || typeof c !== "object" || name === pn) continue;
      const g = state.gallery[name] || { name, firstRound: round, tags: [], line: "" };
      g.lastRound = round;
      if (c.role) g.role = str(c.role);
      if (c.desc || c.description) g.desc = str(c.desc || c.description);
      if (c.status) g.status = str(c.status);
      if (c.secret) g.secret = str(c.secret);
      if (c.line || c.quote) g.line = str(c.line || c.quote);
      if (c.relation) g.relation = str(c.relation);
      const fav = Number(c.favor != null ? c.favor : c.好感);
      if (!isNaN(fav)) g.favor = Math.max(0, Math.min(100, fav));
      else if (g.favor == null) g.favor = 50;
      state.gallery[name] = g;
    }
  }
  function ingestItems(vars, round) {
    const list = Array.isArray(vars.items) ? vars.items : Array.isArray(vars.items ? vars.items.list : null) ? vars.items.list : null;
    if (!list) return;
    state.items = list.map((it) => {
      if (typeof it === "string") return { name: it, count: 1, round };
      return { name: it.name || it.n || "无名之物", count: it.count || it.qty || 1, note: it.note || it.desc || "", rarity: it.rarity || rarityOf(it.name), round };
    });
  }
  function rarityOf(name) {
    const s = String(name);
    if (/神|帝|圣|仙|准帝|十万年|异火|皇/.test(s)) return 5;
    if (/灵宝|魂骨|魔核|源石|秘籍|皇级|史莱克|万年/.test(s)) return 4;
    if (/宝|丹|符|器|魂环|千年/.test(s)) return 3;
    if (/药|石|剑|刀|甲|书|信|币|卡/.test(s)) return 2;
    return 1;
  }
  const RARITY = [
    { n: "凡品", c: "#9aa0b4" },
    { n: "常见", c: "#8fb89a" },
    { n: "良品", c: "#6fb0d8" },
    { n: "珍品", c: "#b48cf0" },
    { n: "绝品", c: "#e8a54f" },
    { n: "神物", c: "#ef6a6a" }
  ];
  function ingestEvents(vars, round) {
    const evs = Array.isArray(vars.events) ? vars.events : null;
    if (!evs) return;
    for (const e of evs) {
      if (!e || !e.name) continue;
      const found = state.events.find((x) => x.name === e.name);
      const days = Math.max(0, Number(e.days != null ? e.days : e.remaining) || 0);
      if (found) {
        found.days = days;
        found.round = round;
        if (e.done) found.done = true;
      } else state.events.push({ name: e.name, days, round, done: !!e.done });
    }
    state.events = state.events.filter((e) => e.round >= round - 40 || e.days > 0);
  }
  function ingestCombat(vars, round) {
    const c = vars.combat || vars.battle;
    if (!c || typeof c !== "object" || !c.result) return;
    const last = state.battles[state.battles.length - 1];
    if (last && last.round === round) return;
    state.battles.push({
      round,
      result: c.result,
      foes: c.foes || c.enemy || "",
      moves: c.moves || c.sequence || "",
      loot: c.loot || c.gain || "",
      wounds: c.wounds || c.injury || ""
    });
    if (state.battles.length > 60) state.battles.shift();
    if (state.open && state.tab === "battles") renderTab();
    AudioBox.event(c.result === "胜" ? "victory" : "defeat");
  }
  function ingestTitle(vars, round) {
    const t = vars.chapterTitle || vars.回目 || vars.title;
    if (!t || typeof t !== "string") return;
    const last = state.titles[state.titles.length - 1];
    if (last && last.title === t) return;
    state.titles.push({ round, title: t.trim().slice(0, 40) });
    mountChapterBanner(round, t.trim());
    if (state.open && state.tab === "chronicle") renderTab();
  }
  function ingestHistory(vars, round) {
    const h = vars.history || vars.大事记;
    const arr = Array.isArray(h) ? h : h ? [h] : [];
    for (const line of arr) {
      const s = typeof line === "string" ? line : line && line.text || "";
      if (!s) continue;
      if (!state.chronicle.some((c) => c.text === s)) state.chronicle.push({ round, text: s.slice(0, 80) });
    }
  }
  function ingestTime(vars) {
    const t = vars.time || vars.时辰 || vars.environment && vars.environment.time;
    const w = vars.weather || vars.天气 || vars.environment && vars.environment.weather;
    const d = vars.day || vars.天数 || vars.date;
    if (w) state.weather = String(w).trim().slice(0, 10);
    if (t) {
      let s = String(t).trim();
      const parts = s.split(/[·｜|，,、]/).map((x) => x.trim()).filter(Boolean);
      if (parts.length > 1) {
        s = parts[0];
        if (!state.weather) state.weather = parts.slice(1).join("·").slice(0, 10);
      }
      state.time = s.slice(0, 12);
    }
    if (d != null) state.day = String(d).slice(0, 12);
    try {
      if (window.AmbienceLayer) {
        if (state.weather) window.AmbienceLayer.setWeather(state.weather);
        if (state.time) window.AmbienceLayer.setTime(state.time);
      }
    } catch (e) {
    }
  }
  function hourIdx() {
    const th = T();
    const hs = th.hourSet;
    const s = String(state.time || "").trim();
    if (!s) return -1;
    if (/^\d/.test(hs[0])) {
      const m = s.match(/(\d{1,2})\s*[:：时点]/) || s.match(/^(\d{1,2})/);
      if (!m) return -1;
      let h = parseInt(m[1], 10);
      if (isNaN(h)) return -1;
      if (h >= 24) h %= 24;
      return Math.min(11, Math.floor(h / 2));
    }
    for (let i = 0; i < hs.length; i++) if (s.includes(hs[i])) return i;
    return -1;
  }
  function ingestRealm(vars) {
    let raw = vars.cultivation || vars.realm || vars.ranking || vars.境界 || vars.rank || vars.level;
    if (!raw) {
      const cs = vars.characters || {};
      const pn = playerName(vars);
      const pcCard = pn && cs[pn];
      if (pcCard) raw = pcCard.realm || pcCard.等阶 || pcCard.评级 || "";
    }
    if (!raw || typeof raw !== "string") return;
    const th = T();
    const s = raw.trim();
    let best = -1;
    th.realms.forEach((r, i) => {
      if (s.includes(r)) best = Math.max(best, i);
    });
    if (best >= 0 && best !== state.realmIdx) {
      const up = best > state.realmIdx;
      state.realmIdx = best;
      state.realmRaw = s.slice(0, 24);
      if (up) {
        AudioBox.event("breakthrough");
        toastBanner("⚔ 破境 · " + th.realms[best]);
      }
    } else if (best >= 0) state.realmRaw = s.slice(0, 24);
  }
  function ingestHighlight(vars, round) {
    const hl = vars.highlight === true || vars.highlight === "true";
    const ten = Number(vars.tension != null ? vars.tension : vars.dashboard && vars.dashboard.tension);
    if (!hl && !(ten >= 88)) return;
    const last = state.highlights[state.highlights.length - 1];
    if (last && last.round === round) return;
    const title = (state.titles[state.titles.length - 1] || {}).title || `第${round}回`;
    const body = lastAssistantText();
    state.highlights.push({ round, title, excerpt: body.slice(0, 320), tension: ten || null });
    if (state.highlights.length > 40) state.highlights.shift();
    AudioBox.event("highlight");
  }
  function lastAssistantText() {
    try {
      const hist = window.storyFramework && window.storyFramework.storyState.conversationHistory || [];
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].role === "assistant") {
          return String(hist[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【行动选项】[\s\S]*$/i, "").trim();
        }
      }
    } catch (e) {
    }
    return "";
  }
  function portrait(name, size) {
    const th = T();
    const h = hash(name + state.genre);
    const P = th.primary, A = th.accent, D = th.deep;
    const rot = h % 360, r2 = 40 + (h >> 3) % 40;
    let inner = "";
    switch (th.sigil) {
      case "道纹":
        inner = `<circle r="30" fill="none" stroke="${hexA(P, 0.35)}" stroke-width="1"/>
                <circle r="${r2 * 0.55}" fill="none" stroke="${hexA(A, 0.5)}" stroke-width="1.2" stroke-dasharray="${4 + h % 9} ${3 + h % 5}"/>
                ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${(Math.cos((h + i * 60) * Math.PI / 180) * 18).toFixed(1)}" y1="${(Math.sin((h + i * 60) * Math.PI / 180) * 18).toFixed(1)}" x2="${(Math.cos((h + i * 60) * Math.PI / 180) * 32).toFixed(1)}" y2="${(Math.sin((h + i * 60) * Math.PI / 180) * 32).toFixed(1)}" stroke="${hexA(P, 0.6)}" stroke-width="1.4"/>`).join("")}
                <circle r="6" fill="${hexA(P, 0.25)}" stroke="${P}" stroke-width="1.4"/>`;
        break;
      case "火纹":
        inner = `<path d="M0,34 Q-26,10 -14,-14 Q-8,-2 0,-12 Q2,-4 14,-16 Q26,4 0,34 Z" fill="${hexA(A, 0.3)}" stroke="${A}" stroke-width="1.6"/>
                <path d="M0,28 Q-12,12 -6,-4 Q0,4 6,-6 Q12,12 0,28 Z" fill="${hexA(P, 0.5)}" stroke="${P}" stroke-width="1.2"/>`;
        break;
      case "魂环":
        inner = `<circle r="34" fill="none" stroke="${hexA("#ffffff", 0.75)}" stroke-width="4"/>
                <circle r="27" fill="none" stroke="${hexA("#e8d44f", 0.8)}" stroke-width="4"/>
                <circle r="20" fill="none" stroke="${hexA("#c088e8", 0.8)}" stroke-width="4"/>
                <path d="M0,-14 l4,10 l10,1 l-7,7 l2,10 l-9,-5 l-9,5 l2,-10 l-7,-7 l10,-1 Z" fill="${P}" transform="scale(.9)"/>`;
        break;
      case "兽骨":
        inner = `<path d="M-20,26 Q-30,6 -18,-8 M0,30 Q-4,4 0,-16 M20,26 Q30,6 18,-8" stroke="${hexA(P, 0.7)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
                <path d="M-22,-10 l-8,-8 M-19,-6 l-11,-3 M22,-10 l8,-8 M19,-6 l11,-3" stroke="${hexA(A, 0.6)}" stroke-width="1.8"/>
                <circle r="5" cy="8" fill="${hexA(A, 0.35)}" stroke="${A}" stroke-width="1.3"/>`;
        break;
      case "军徽":
        inner = `<path d="M0,20 L-26,4 L-26,-10 L0,-24 L26,-10 L26,4 Z" fill="${hexA(A, 0.18)}" stroke="${hexA(P, 0.8)}" stroke-width="1.8"/>
                <path d="M0,12 L-16,2 L-16,-8 L0,-18 L16,-8 L16,2 Z" fill="${hexA(P, 0.3)}"/>
                <path d="M0,-18 L0,12 M-16,-3 L16,-3" stroke="${hexA(P, 0.55)}" stroke-width="1.1"/>
                <circle r="3.4" cy="-1" fill="${P}"/>`;
        break;
      case "队徽":
        inner = `<path d="M0,-32 L28,-16 L28,14 L0,30 L-28,14 L-28,-16 Z" fill="${hexA(A, 0.16)}" stroke="${P}" stroke-width="1.8"/>
                <circle r="13" fill="none" stroke="${hexA(P, 0.8)}" stroke-width="1.4"/>
                <path d="M-18,0 h10 M8,0 h10 M0,-18 v10 M0,8 v10" stroke="${hexA(A, 0.8)}" stroke-width="1.6"/>
                <path d="M-5,0 l4,5 l8,-10" stroke="${P}" stroke-width="2" fill="none"/>`;
        break;
      case "阴纹":
        inner = `<path d="M0,-32 Q28,-10 12,16 Q6,4 0,14 Q-6,4 -12,16 Q-28,-10 0,-32 Z" fill="${hexA(A, 0.22)}" stroke="${hexA(P, 0.85)}" stroke-width="1.6"/>
                <circle r="7" cy="-10" fill="${hexA(D, 0.9)}" stroke="${P}" stroke-width="1.3"/>
                <circle r="1.8" cy="-10" fill="${P}"/>
                <path d="M-9,24 q9,-6 18,0" stroke="${hexA(A, 0.65)}" stroke-width="1.4" fill="none"/>
                ${[0, 1, 2].map((i) => `<path d="M${-16 + i * 16},28 v${6 + (h >> i) % 7}" stroke="${hexA(P, 0.4)}" stroke-width="1.2"/>`).join("")}`;
        break;
      case "剑纹":
        inner = `<path d="M0,-34 L4,-24 L4,14 L0,22 L-4,14 L-4,-24 Z" fill="${hexA(P, 0.35)}" stroke="${P}" stroke-width="1.5"/>
                <path d="M-12,16 h24" stroke="${hexA(A, 0.85)}" stroke-width="2"/>
                <path d="M0,22 v8" stroke="${A}" stroke-width="1.6"/>
                <circle r="2.2" cy="32" fill="${A}"/>
                <path d="M-9,-6 l7,-4 M9,-6 l-7,-4" stroke="${hexA(P, 0.5)}" stroke-width="1.2"/>
                ${[0, 1, 2].map((i) => `<path d="M0,-${26 + i * 4} v-4" stroke="${hexA(A, 0.55)}" stroke-width="1"/>`).join("")}`;
        break;
      case "帝纹":
        inner = `<path d="M0,-30 L26,-14 L18,22 L-18,22 L-26,-14 Z" fill="${hexA(A, 0.16)}" stroke="${hexA(P, 0.85)}" stroke-width="1.6"/>
                <path d="M0,-18 L12,-8 L8,14 L-8,14 L-12,-8 Z" fill="${hexA(P, 0.3)}" stroke="${P}" stroke-width="1.2"/>
                <circle r="3" fill="${A}"/>
                <path d="M-14,28 h28" stroke="${hexA(A, 0.6)}" stroke-width="1.6"/>
                ${[0, 1, 2].map((i) => `<path d="M${-12 + i * 12},30 v${5 + (h >> i) % 5}" stroke="${hexA(P, 0.45)}" stroke-width="1.2"/>`).join("")}`;
        break;
      case "龙纹":
        inner = `<path d="M-24,14 Q-30,-4 -12,-8 Q6,-12 4,-24 Q18,-20 16,-4 Q14,10 -2,8 Q-16,6 -14,20 Q-2,26 10,18" fill="none" stroke="${hexA(P, 0.9)}" stroke-width="2.2" stroke-linecap="round"/>
                <circle r="2.6" cx="10" cy="-16" fill="${A}"/>
                <path d="M16,-4 q10,-2 12,6" stroke="${A}" stroke-width="1.4" fill="none"/>
                ${[0, 1, 2].map((i) => `<circle r="${1.4 + i * 0.6}" cx="${-20 + i * 6}" cy="${16 - i * 4}" fill="${hexA(A, 0.6)}"/>`).join("")}`;
        break;
      case "魔纹":
        inner = `<path d="M0,-30 L26,-15 L26,15 L0,30 L-26,15 L-26,-15 Z" fill="${hexA(A, 0.14)}" stroke="${hexA(P, 0.8)}" stroke-width="1.6"/>
                ${[0, 1, 2, 3, 4, 5].map((i) => `<circle r="2.2" cx="${(Math.cos(i * Math.PI / 3) * 26).toFixed(1)}" cy="${(Math.sin(i * Math.PI / 3) * 26).toFixed(1)}" fill="${hexA(P, 0.65)}"/>`).join("")}
                <path d="M0,-14 L7,0 L0,14 L-7,0 Z" fill="${hexA(P, 0.4)}" stroke="${P}" stroke-width="1.4"/>
                <circle r="19" fill="none" stroke="${hexA(A, 0.55)}" stroke-width="1.2" stroke-dasharray="${3 + h % 5} ${4}"/>`;
        break;
      case "环纹":
        inner = `<circle r="32" fill="none" stroke="${hexA(P, 0.5)}" stroke-width="1.4" stroke-dasharray="${6 + h % 7} ${5}"/>
                <circle r="23" fill="none" stroke="${hexA(A, 0.7)}" stroke-width="1.6"/>
                <circle r="14" fill="none" stroke="${hexA(P, 0.85)}" stroke-width="2"/>
                <path d="M0,-32 A32,32 0 0 1 27.7,16" stroke="${P}" stroke-width="2.6" fill="none"/>
                <circle r="3" fill="${A}"/>`;
        break;
      case "云雷纹":
        inner = `<path d="M-22,-22 h44 v44 h-44 v-36 h36 v28 h-28 v-20 h20 v12" fill="none" stroke="${P}" stroke-width="1.8" stroke-linejoin="miter"/>
                <circle r="3" fill="${A}"/>
                ${[0, 1, 2, 3].map((i) => `<circle r="1.8" cx="${[-30, 30, 30, -30][i]}" cy="${[-30, -30, 30, 30][i]}" fill="${hexA(A, 0.7)}"/>`).join("")}
                <circle r="34" fill="none" stroke="${hexA(P, 0.35)}" stroke-width="1" stroke-dasharray="${3 + h % 5} ${4}"/>`;
        break;
      case "鬼纹":
        inner = `<path d="M-30,0 Q0,-26 30,0 Q0,26 -30,0 Z" fill="${hexA(A, 0.18)}" stroke="${P}" stroke-width="1.6"/>
                <circle r="10" fill="${hexA(D, 0.92)}" stroke="${P}" stroke-width="1.6"/>
                <circle r="4" fill="${A}"/>
                <path d="M-24,-18 l5,5 M24,-18 l-5,5 M-24,18 l5,-5 M24,18 l-5,-5" stroke="${hexA(A, 0.65)}" stroke-width="1.3"/>
                ${[0, 1, 2].map((i) => `<circle r="${17 + i * 8}" fill="none" stroke="${hexA(P, 0.34 - i * 0.09)}" stroke-width="1.1" stroke-dasharray="${2 + (h + i) % 4} ${3 + (h >> i) % 5}"/>`).join("")}`;
        break;
      case "灯幌纹":
        inner = `<path d="M-16,-32 h32 M0,-32 v6" stroke="${hexA(A, 0.75)}" stroke-width="1.6"/>
                <path d="M-13,-26 L0,-31 L13,-26 L13,14 Q0,24 -13,14 Z" fill="${hexA(P, 0.3)}" stroke="${P}" stroke-width="1.6"/>
                <path d="M-13,-26 h26 M-9,-19 h18 M-9,9 h18" stroke="${hexA(A, 0.7)}" stroke-width="1.2"/>
                <circle r="3.4" cy="-2" fill="${A}"/>
                ${[0, 1, 2, 3].map((i) => `<circle r="1.5" cx="${-9 + i * 6}" cy="${-11 + (h >> i) % 5}" fill="${hexA(A, 0.75)}"/>`).join("")}
                <path d="M0,24 v7" stroke="${A}" stroke-width="1.4"/><circle r="2" cy="34" fill="${A}"/>`;
        break;
      case "球纹":
        inner = `<circle r="26" fill="${hexA(A, 0.14)}" stroke="${P}" stroke-width="1.8"/>
                <ellipse rx="10" ry="26" fill="none" stroke="${hexA(P, 0.5)}" stroke-width="1.1"/>
                <ellipse rx="19" ry="26" fill="none" stroke="${hexA(P, 0.35)}" stroke-width="1"/>
                <path d="M-26,0 h52 M-23,-12 h46 M-23,12 h46" stroke="${hexA(A, 0.6)}" stroke-width="1.1"/>
                <path d="M0,-26 Q14,-16 14,0 Q14,16 0,26" fill="${hexA(P, 0.22)}" stroke="none"/>
                <circle r="3" cx="${-8 + h % 16}" cy="${-10 + h % 20}" fill="${A}"/>
                <circle r="34" fill="none" stroke="${hexA(P, 0.3)}" stroke-width="1" stroke-dasharray="${3 + h % 5} ${4}"/>`;
        break;
      case "星纹":
        inner = `<path d="M-22,18 L-8,-14 L4,8 L16,-20 L24,10" fill="none" stroke="${hexA(P, 0.55)}" stroke-width="1.1" stroke-linecap="round"/>
                <circle r="1.6" cx="-22" cy="18" fill="${hexA(A, 0.8)}"/>
                <circle r="1.3" cx="-8" cy="-14" fill="${hexA(A, 0.7)}"/>
                <circle r="1.8" cx="4" cy="8" fill="${A}"/>
                <circle r="1.4" cx="16" cy="-20" fill="${hexA(A, 0.7)}"/>
                <circle r="2.6" cx="24" cy="10" fill="${P}"/>
                <circle r="6" cx="24" cy="10" fill="none" stroke="${hexA(P, 0.35)}" stroke-width="1"/>
                <circle r="34" fill="none" stroke="${hexA(P, 0.22)}" stroke-width="1" stroke-dasharray="2 6"/>`;
        break;
      case "逆纹":
        inner = `<path d="M-28,-24 Q-6,-14 -2,2 Q2,18 26,28" fill="none" stroke="${hexA(P, 0.4)}" stroke-width="1.6" stroke-dasharray="${4 + h % 4} ${4}"/>
                <path d="M26,-28 Q4,-16 -4,2 Q-12,20 -24,24" fill="none" stroke="${hexA(A, 0.55)}" stroke-width="1.1"/>
                <path d="M-24,24 L-14,16 L-8,22 L2,10 L8,16 L18,2 L24,6" fill="none" stroke="${P}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M24,6 L18,0 M24,6 L20,12" stroke="${P}" stroke-width="2" stroke-linecap="round"/>
                <circle r="2.4" cx="-24" cy="24" fill="${A}"/>
                <circle r="1.6" cx="26" cy="28" fill="${hexA(P, 0.6)}"/>
                ${[0, 1, 2].map((i) => `<circle r="${1 + i * 0.4}" cx="${-18 + i * 14}" cy="${-14 - i * 5}" fill="${hexA(A, 0.6 - i * 0.12)}"/>`).join("")}
                <circle r="34" fill="none" stroke="${hexA(P, 0.28)}" stroke-width="1" stroke-dasharray="${3 + h % 5} ${5}"/>`;
        break;
      default:
        inner = `<circle r="30" fill="none" stroke="${hexA(P, 0.4)}" stroke-width="1"/>
                <path d="M0,-26 Q10,-8 0,10 Q-10,-8 0,-26 Z" fill="${hexA(P, 0.28)}" stroke="${hexA(P, 0.7)}" stroke-width="1.2"/>
                <path d="M-14,22 h28" stroke="${hexA(A, 0.6)}" stroke-width="1.6"/>`;
    }
    return `<svg viewBox="-40 -40 80 80" width="${size}" height="${size}" style="display:block;">
            <circle r="38" fill="${hexA(D, 0.8)}" stroke="${hexA(P, 0.45)}" stroke-width="1.2"/>
            <g transform="rotate(${rot})">${inner}</g></svg>`;
  }
  const TABS = [
    { id: "gallery", icon: "🎭", name: "众生相" },
    { id: "bonds", icon: "🌌", name: "羁绊图" },
    { id: "realms", icon: "⛩", name: "境界梯" },
    { id: "treasury", icon: "💎", name: "藏宝阁" },
    { id: "chronicle", icon: "📜", name: "编年史" },
    { id: "letters", icon: "✉", name: "传书" },
    { id: "events", icon: "⏳", name: "倒计时" },
    { id: "highlights", icon: "⭐", name: "名场面" },
    { id: "battles", icon: "⚔", name: "战报" },
    { id: "dao", icon: "☯", name: "天道" },
    { id: "ext", icon: "🧬", name: "界专属" },
    { id: "lines", icon: "🌐", name: "世界线" },
    { id: "settings", icon: "⚙", name: "设置" }
  ];
  function liveTabs() {
    try {
      return TABS.filter((t) => t.id !== "ext" || window.WorldExt && WorldExt.hasModules());
    } catch (e) {
      return TABS;
    }
  }
  function hubHTML() {
    const th = T();
    const badge = { letters: state.letters.filter((l) => !l.read).length }["letters"] || 0;
    return `
        <div class="imm-drawer" id="immDrawer" style="--ip:${th.primary};--ia:${th.accent};--id:${th.deep};--ipn:${th.panel};--itx:${th.text};--imt:${th.muted};">
            <div class="imm-head">
                <div class="imm-title">⛩ 太虚阁 <span class="imm-sub">${esc(th.name)} · 沉浸万象</span></div>
                <button class="imm-x" onclick="ImmersiveSuite.toggle(false)">✕</button>
            </div>
            <div class="imm-rail">
                ${liveTabs().map((t) => `<button class="imm-tab ${state.tab === t.id ? "on" : ""}" onclick="ImmersiveSuite.openTab('${t.id}')">
                    ${t.icon}<span>${t.name}</span>${t.id === "letters" && badge ? `<i class="imm-dot">${badge}</i>` : ""}</button>`).join("")}
            </div>
            <div class="imm-strip" id="immStrip">${stripHTML()}</div>
            <div class="imm-body" id="immBody"></div>
        </div>`;
  }
  function mount() {
    if (isEarth()) {
      unmountUI();
      return;
    }
    if (!$("immFab")) {
      try {
        const fab = document.createElement("button");
        fab.id = "immFab";
        fab.className = "imm-fab";
        fab.title = "太虚阁 · 沉浸万象（拖动换位，长按归位）";
        fab.innerHTML = "⛩";
        document.body.appendChild(fab);
        /* v3.55.18 悬浮球收敛：界面只留小云一个悬浮球，太虚阁改由小云菜单进入。
           模块本体照常挂载（抽屉/数据不受影响），只是入口球不再显示。 */
        fab.style.display = "none";
        makeFabDraggable(fab);
      } catch (e) {
        console.warn("[Immersive] 悬浮球创建失败:", e.message);
      }
    }
    if ($("immDrawerMount")) {
      try {
        $("immDrawerMount").innerHTML = hubHTML();
        renderTab();
      } catch (e) {
        console.warn("[Immersive] 抽屉刷新失败:", e.message);
      }
      return;
    }
    const m = document.createElement("div");
    m.id = "immDrawerMount";
    m.className = "imm-mount";
    document.body.appendChild(m);
    try {
      m.innerHTML = hubHTML();
      renderTab();
    } catch (e) {
      console.warn("[Immersive] 抽屉挂载失败:", e.message);
      m.innerHTML = `<div class="imm-drawer" id="immDrawer">
                <div class="imm-head"><div class="imm-title">⛩ 太虚阁</div>
                <button class="imm-x" onclick="ImmersiveSuite.toggle(false)">✕</button></div>
                <div class="imm-body"><div style="padding:24px;color:var(--imt,#c9b68a)">抽屉渲染故障，门仍可用</div></div></div>`;
    }
  }
  function isEarth() {
    try {
      return !!(window.storyFramework && storyFramework.config && storyFramework.config.genreKey === "earth");
    } catch (e) {
      return false;
    }
  }
  function unmountUI() {
    try {
      const fab = $("immFab");
      if (fab) fab.remove();
      const dm = $("immDrawerMount");
      if (dm) dm.remove();
      state.open = false;
    } catch (e) {
    }
  }
  function makeFabDraggable(fab) {
    const POS_KEY = "immFabPos";
    const HINT_KEY = "immFabHint";
    const resetPos = () => {
      fab.style.left = "";
      fab.style.top = "";
      fab.style.right = "";
      fab.style.bottom = "";
      try {
        MoStore.removeItem(POS_KEY);
      } catch (e) {
      }
      toastBanner("⛩ 小门已归位");
    };
    try {
      const saved = JSON.parse(MoStore.getItem(POS_KEY) || "null");
      if (saved && saved.x != null) {
        const x = Math.min(Math.max(0, saved.x), Math.max(0, window.innerWidth - fab.offsetWidth));
        const y = Math.min(Math.max(0, saved.y), Math.max(0, window.innerHeight - fab.offsetHeight));
        fab.style.left = x + "px";
        fab.style.top = y + "px";
        fab.style.right = "auto";
        fab.style.bottom = "auto";
      }
    } catch (e) {
    }
    let dragging = false, moved = false, longFired = false, holdTimer = 0;
    let sx = 0, sy = 0, bx = 0, by = 0;
    fab.addEventListener("pointerdown", (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      dragging = true;
      moved = false;
      longFired = false;
      sx = ev.clientX;
      sy = ev.clientY;
      const r = fab.getBoundingClientRect();
      bx = r.left;
      by = r.top;
      fab.style.left = bx + "px";
      fab.style.top = by + "px";
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      fab.classList.add("grab");
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (dragging && !moved) {
          longFired = true;
          resetPos();
        }
      }, 600);
      try {
        fab.setPointerCapture(ev.pointerId);
      } catch (e) {
      }
      ev.preventDefault();
    });
    fab.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        clearTimeout(holdTimer);
        try {
          if (!MoStore.getItem(HINT_KEY)) {
            toastBanner("⛩ 小门已解锁：可拖到任意处，长按归位");
            MoStore.setItem(HINT_KEY, "1");
          }
        } catch (e) {
        }
      }
      const maxX = window.innerWidth - fab.offsetWidth;
      const maxY = window.innerHeight - fab.offsetHeight;
      const nx = Math.min(Math.max(0, bx + dx), Math.max(0, maxX));
      const ny = Math.min(Math.max(0, by + dy), Math.max(0, maxY));
      fab.style.left = nx + "px";
      fab.style.top = ny + "px";
    });
    const end = () => {
      if (!dragging) return;
      clearTimeout(holdTimer);
      dragging = false;
      fab.classList.remove("grab");
      if (moved) {
        try {
          MoStore.setItem(POS_KEY, JSON.stringify({ x: parseInt(fab.style.left, 10), y: parseInt(fab.style.top, 10) }));
        } catch (e) {
        }
      } else if (!longFired) {
        ImmersiveSuite2.toggle(true);
      }
    };
    fab.addEventListener("pointerup", end);
    fab.addEventListener("pointercancel", end);
    window.addEventListener("resize", () => {
      if (fab.style.left === "") return;
      const maxX = Math.max(0, window.innerWidth - fab.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - fab.offsetHeight);
      fab.style.left = Math.min(Math.max(0, parseInt(fab.style.left, 10) || 0), maxX) + "px";
      fab.style.top = Math.min(Math.max(0, parseInt(fab.style.top, 10) || 0), maxY) + "px";
    });
  }
  function stripHTML() {
    const th = T();
    const realm = th.realms[state.realmIdx] || th.realmLabel;
    return `
            <div class="cp-mini">${compassSVG(44)}</div>
            <div class="cp-info">
                <div class="cp-time">${esc(state.time || "时辰未报")}</div>
                <div class="cp-wx">${esc(state.weather || "天象未知")}${state.day ? " · " + esc(state.day) : ""}</div>
            </div>
            <button class="cp-realm" onclick="ImmersiveSuite.openTab('realms')" title="查看境界天梯">${esc(realm)} ›</button>`;
  }
  function refreshStrip() {
    const el = $("immStrip");
    if (el) el.innerHTML = stripHTML();
  }
  function renderTab() {
    const body = $("immBody");
    if (!body) return;
    refreshStrip();
    const th = T();
    const map = { gallery: panelGallery, bonds: panelBonds, realms: panelRealms, treasury: panelTreasury, chronicle: panelChronicle, letters: panelLetters, events: panelEvents, highlights: panelHighlights, battles: panelBattles, settings: panelSettings, lines: panelLines, dao: panelDao, ext: panelExt };
    let html;
    try {
      html = (map[state.tab] || panelGallery)();
    } catch (e) {
      console.warn("[太虚阁] 页签渲染故障:", e.message);
      html = emptyBox("🧭", "本页签渲染故障", (e.message || String(e)) + " —— 其余页签不受影响；多为 AI 上报的字段格式异常所致，可试「设置 → 清空本界沉浸档」修复");
    }
    body.innerHTML = html;
    body.dataset.wxTab = state.tab === "ext" ? "1" : "";
    body.scrollTop = 0;
    const rail = $("immDrawer");
    if (rail) rail.querySelectorAll(".imm-tab").forEach((b) => b.classList.toggle("on", b.getAttribute("onclick").includes(`'${state.tab}'`)));
  }
  function panelLines() {
    if (!window.TimelineBranch) return emptyBox("🌐", "世界线模块未加载", "请检查 js/timeline-branch.js 是否随包引入");
    try {
      return window.TimelineBranch.panelHTML();
    } catch (e) {
      console.warn("[Immersive] 世界线面板故障:", e.message);
      return emptyBox("🌐", "世界线面板故障", e.message);
    }
  }
  function panelExt() {
    if (!window.WorldExt || !WorldExt.hasModules()) return emptyBox("🧬", "本界暂无专属模块", "界专属扩展按世界定制（js/world-ext/）");
    try {
      return window.WorldExt.panelHTML();
    } catch (e) {
      console.warn("[Immersive] 界专属面板故障:", e.message);
      return emptyBox("🧬", "界专属面板故障", e.message);
    }
  }
  function panelDao() {
    if (!window.GameLayer) return emptyBox("☯", "天道模块未加载", "请检查 js/game-layer.js 是否随包引入");
    try {
      return window.GameLayer.panelHTML();
    } catch (e) {
      console.warn("[Immersive] 天道面板故障:", e.message);
      return emptyBox("☯", "天道面板故障", e.message);
    }
  }
  function panelGallery() {
    const th = T();
    const list = Object.values(state.gallery).sort((a, b) => (b.favor || 0) - (a.favor || 0));
    if (!list.length) return emptyBox("🎭", "尚未结识任何人", "开篇后 AI 上报的每位 NPC 都会自动立卡入册—— portraits 为 " + th.sigil + "纹程序绘成，一人一相");
    return `<div class="imm-tip">共 ${list.length} 人入册 · 点击卡片看详情 · 好感随剧情起落</div>` + list.map((g) => {
      var _a;
      const fav = g.favor == null ? 50 : g.favor;
      const favCol = fav < 20 ? "#e07070" : fav < 45 ? "#c8a86a" : fav < 70 ? th.primary : "#8fd9a8";
      const descSrc = String(g.desc || g.status || "初见于第" + ((_a = g.firstRound) != null ? _a : "?") + "回");
      return `<div class="gl-card" onclick="ImmersiveSuite.showNPC('${esc(g.name).replace(/'/g, "")}')">
                <div class="gl-sigil">${portrait(g.name, 54)}</div>
                <div class="gl-main">
                    <div class="gl-name">${esc(g.name)} <span class="gl-role">${esc(g.role || "身份不明")}</span></div>
                    <div class="gl-desc">${esc(descSrc.slice(0, 46))}</div>
                    <div class="gl-fav"><span>好感</span><div class="gl-fbar"><i style="width:${fav}%;background:${favCol};"></i></div><b style="color:${favCol};">${fav}</b></div>
                </div></div>`;
    }).join("");
  }
  function showNPC(name) {
    const g = state.gallery[name];
    if (!g) return;
    const th = T();
    const fav = g.favor == null ? 50 : g.favor;
    dialogCard(`🎭 ${esc(g.name)}`, `
            <div style="display:flex;gap:14px;align-items:flex-start;">
                <div>${portrait(name, 86)}</div>
                <div style="flex:1;">
                    <div class="npc-row"><span>身份</span><b>${esc(g.role || "—")}</b></div>
                    <div class="npc-row"><span>初见</span><b>第 ${g.firstRound} 回</b>　<span>近况</span><b>第 ${g.lastRound} 回</b></div>
                    <div class="npc-row"><span>好感</span><b>${fav} / 100</b>　<span>关系</span><b>${esc(g.relation || "未明")}</b></div>
                </div>
            </div>
            ${g.desc ? `<div class="npc-block">${esc(g.desc)}</div>` : ""}
            ${g.status ? `<div class="npc-block"><span class="npc-tag">现状</span>${esc(g.status)}</div>` : ""}
            ${g.secret ? `<div class="npc-block secret"><span class="npc-tag">秘密</span>${esc(g.secret)}</div>` : ""}
            ${g.line ? `<div class="npc-quote">「${esc(g.line)}」</div>` : ""}
            <div class="whisper-entry">
                <button class="whisper-go" onclick="ImmersiveSuite.openWhisper('${esc(name).replace(/'/g, "")}')">
                    🕯 与 ${esc(g.name)} 密谈
                    <i>${g.whispers && g.whispers.length ? `已谈 ${(g.whispers.length / 2 | 0) + (g.whispers.length % 2 ? "" : "")}回 · 续谈` : "屏退左右，单独说话"}</i>
                </button>
            </div>`);
  }
  const Whisper = { name: null, busy: false };
  function whisperSystem(g) {
    const th = T();
    const fw = window.storyFramework;
    const pn = fw && fw.storyState && fw.storyState.setup && fw.storyState.setup.playerName || "道友";
    const hist = fw && fw.storyState && fw.storyState.conversationHistory || [];
    const recent = [];
    for (let i = hist.length - 1; i >= 0 && recent.length < 3; i--) {
      if (hist[i].role !== "assistant") continue;
      let t = String(hist[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
      if (t) recent.unshift(t.slice(0, 360));
    }
    const fav = g.favor == null ? 50 : g.favor;
    const attitude = fav >= 80 ? "极为亲近，言辞间有明显的信任与牵挂" : fav >= 60 ? "友善熟络" : fav >= 40 ? "客气而保留" : fav >= 20 ? "冷淡提防" : "敌意明显，句句带刺";
    return `你正在扮演角色扮演游戏《${th.name}》中的 NPC「${g.name}」，与玩家${pn}进行一场一对一的私下密谈。这不是写小说，是活的角色对话。

【角色档案】（仅供你把握人物，禁止成段复述）
- 身份：${g.role || "未知"}
- 描述：${g.desc || g.status || "（无）"}
- 现状：${g.status || "如常"}
- 与${pn}的关系：${g.relation || "初识"}；好感 ${fav}/100（${attitude}）
- 秘密：${g.secret || "无"}——除非好感极高或${pn}已戳破，否则守口如瓶，可被追问时露出破绽
- 标志性台词参考：「${g.line || "（无）"}」

【最近剧情（你亲历的事）】
${recent.join("\n——\n") || "（故事刚开始）"}

【腔调铁律】
1. 全程第一人称，只用「${g.name}」该有的身份用词说话（身份是仙师就不说现代词，是学生就不说文言）
2. 每次回复 ≤120 字，口语化，可穿插（动作/神态）小注
3. 态度必须符合好感度：${attitude}
4. 你只知道角色该知道的事；被问及剧情之外的问题，就以角色口吻困惑或岔开
5. 可以反问、试探、讨价还价——你是活人，不是答题机
6. 绝不提及"AI/模型/设定/档案"这些词`;
  }
  function openWhisper(name) {
    const g = state.gallery[name];
    if (!g) return;
    Whisper.name = name;
    Whisper.busy = false;
    closeDialog();
    const th = T();
    const ov = document.createElement("div");
    ov.id = "whisperOv";
    ov.className = "whisper-ov";
    ov.onclick = (e) => {
      if (e.target === ov) closeWhisper();
    };
    ov.innerHTML = `
            <div class="whisper-box" style="--ip:${th.primary};--ia:${th.accent};--id:${th.deep};--ipn:${th.panel};--itx:${th.text};--imt:${th.muted};">
                <div class="whisper-head">
                    <span class="whisper-ava">${portrait(name, 44)}</span>
                    <div class="whisper-tt"><b>${esc(name)}</b><i>${esc(g.role || "")} · 屏退左右</i></div>
                    <button class="whisper-x" onclick="ImmersiveSuite.closeWhisper()">✕</button>
                </div>
                <div class="whisper-flow" id="whisperFlow"></div>
                <div class="whisper-input">
                    <input id="whisperText" maxlength="200" placeholder="对 ${esc(name)} 说点什么…（回车送出）"
                        onkeydown="if(event.key==='Enter')ImmersiveSuite.sendWhisper()">
                    <button onclick="ImmersiveSuite.sendWhisper()" id="whisperSend">送出</button>
                </div>
            </div>`;
    document.body.appendChild(ov);
    setTimeout(() => {
      ov.classList.add("show");
      renderWhispers();
      const inp = $("whisperText");
      if (inp) inp.focus();
    }, 20);
    try {
      AudioBox.event("letter");
    } catch (e) {
    }
  }
  function renderWhispers(typing) {
    const flow = $("whisperFlow");
    if (!flow) return;
    const g = state.gallery[Whisper.name];
    if (!g) return;
    const list = g.whispers || [];
    let html = list.map((m, i) => {
      const lastNpc = !typing && i === list.length - 1 && m.r === "npc";
      return m.r === "me" ? `<div class="wm me" style="animation-delay:${Math.min(i, 8) * 0.03}s"><div class="wm-b">${esc(m.t)}</div></div>` : `<div class="wm npc" style="animation-delay:${Math.min(i, 8) * 0.03}s"><span class="wm-ava">${portrait(Whisper.name, 30)}</span>
                    <div class="wm-b">${esc(m.t)}${lastNpc ? `<button class="wm-carry" title="把这句密谈情报带回正文——AI 将在后续剧情中使其生效" onclick="ImmersiveSuite.carryIntel(this, '${esc(Whisper.name).replace(/'/g, "")}')">🧿 带回正文</button>` : ""}</div></div>`;
    }).join("");
    if (typing) html += `<div class="wm npc typing"><span class="wm-ava">${portrait(Whisper.name, 30)}</span><div class="wm-b"><i></i><i></i><i></i></div></div>`;
    flow.innerHTML = html;
    flow.scrollTop = flow.scrollHeight;
  }
  let pendingIntel = [];
  function carryIntel(btn, name) {
    var _a, _b;
    const g = state.gallery[name];
    if (!g) return;
    const list = g.whispers || [];
    const lastNpc = [...list].reverse().find((m) => m.r === "npc");
    if (!lastNpc) return;
    if (pendingIntel.some((p) => p.name === name && p.text === lastNpc.t)) {
      try {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "这句已带在身上了", "info");
      } catch (e) {
      }
      return;
    }
    pendingIntel.push({ name, text: lastNpc.t.slice(0, 200), at: Date.now() });
    if (pendingIntel.length > 3) pendingIntel = pendingIntel.slice(-3);
    if (btn) {
      btn.classList.add("done");
      btn.textContent = "✓ 已带回";
      btn.disabled = true;
    }
    try {
      (_b = window.showToast) == null ? void 0 : _b.call(window, `🧿 ${name} 的密语已随身——下一轮正文将悄然生效`, "success");
    } catch (e) {
    }
  }
  function takeIntel() {
    const p = pendingIntel;
    pendingIntel = [];
    return p;
  }
  async function sendWhisper() {
    var _a;
    const inp = $("whisperText");
    const g = state.gallery[Whisper.name];
    if (!inp || !g || Whisper.busy) return;
    const text = inp.value.trim();
    if (!text) return;
    const fw = window.storyFramework;
    if (!fw || !fw.isApiConfigured || !fw.isApiConfigured()) {
      if (fw && fw.guideToConfig) fw.guideToConfig();
      return;
    }
    inp.value = "";
    Whisper.busy = true;
    if (!Array.isArray(g.whispers)) g.whispers = [];
    g.whispers.push({ r: "me", t: text });
    if (g.whispers.length > 60) g.whispers = g.whispers.slice(-60);
    renderWhispers(true);
    const sendBtn = $("whisperSend");
    if (sendBtn) sendBtn.disabled = true;
    const msgs = [{ role: "system", content: whisperSystem(g) }];
    for (const m of g.whispers.slice(-12, -1)) msgs.push({ role: m.r === "me" ? "user" : "assistant", content: m.t });
    msgs.push({ role: "user", content: text });
    let cur = "";
    try {
      const whisperOpts = {
        onDelta: (d) => {
          cur += d;
          const flow = $("whisperFlow");
          if (flow) {
            const tp = flow.querySelector(".typing");
            if (tp) {
              tp.classList.remove("typing");
              tp.querySelector(".wm-b").textContent = cur;
            }
            flow.scrollTop = flow.scrollHeight;
          }
        }
      };
      const reply = window.ChannelHub && ChannelHub.canCall("troupe") ? await ChannelHub.call("troupe", msgs, whisperOpts) : await window.callOpenAI(msgs, whisperOpts);
      const fin = (reply || cur || "……（沉默）").trim();
      g.whispers.push({ r: "npc", t: fin.slice(0, 600) });
      save();
      try {
        AudioBox.event("letter");
      } catch (e) {
      }
    } catch (e) {
      g.whispers.pop();
      (_a = window.showToast) == null ? void 0 : _a.call(window, "密谈传音失败：" + (e.message || "网络异常").slice(0, 80), "error");
    } finally {
      Whisper.busy = false;
      const sb = $("whisperSend");
      if (sb) sb.disabled = false;
      renderWhispers();
      const i2 = $("whisperText");
      if (i2) i2.focus();
    }
  }
  function closeWhisper() {
    Whisper.name = null;
    const ov = $("whisperOv");
    if (ov) {
      ov.classList.remove("show");
      setTimeout(() => ov.remove(), 220);
    }
  }
  function panelBonds() {
    const th = T();
    const list = Object.values(state.gallery);
    if (!list.length) return emptyBox("🌌", "星图未启", "结识 NPC 后，此图将织出你与众生的好恶连线：金线挚友、灰线相识、红线仇敌");
    const pn = window.storyFramework && window.storyFramework.storyState.setup && window.storyFramework.storyState.setup.playerName || "你";
    const n = list.length;
    const W = 100, H = Math.max(60, 26 + n * 7.2);
    const cx = 50, cy = H / 2;
    const R = Math.min(38, 10 + n * 1.7);
    const pos = list.map((g, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return { g, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * (R * 0.8) };
    });
    const lines = pos.map(({ g, x, y }) => {
      const fav = g.favor == null ? 50 : g.favor;
      const col = fav < 20 ? "#e07070" : fav < 45 ? hexA(th.muted, 0.5) : fav < 70 ? hexA(th.primary, 0.65) : "#8fd9a8";
      const w = (0.3 + Math.abs(fav - 50) / 100 * 1.5).toFixed(2);
      const dash = fav < 20 ? 'stroke-dasharray="1.2 1"' : "";
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${w}" ${dash}/>
                <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${col}"/>
                <text x="${(cx + (x - cx) * 1.16).toFixed(1)}" y="${(cy + (y - cy) * 1.16 + 0.6).toFixed(1)}" font-size="2.6" fill="${fav < 20 ? "#e0a0a0" : th.text}" text-anchor="middle" class="imm-svgtx">${esc(g.name)}</text>`;
    }).join("");
    return `<div class="imm-tip">以「${esc(pn)}」为枢 · ${n} 条羁绊 · 线色即好恶</div>
        <div class="bond-wrap"><svg viewBox="0 0 ${W} ${H.toFixed(0)}" preserveAspectRatio="xMidYMid meet">
            <defs><radialGradient id="immCore"><stop offset="0%" stop-color="${hexA(th.primary, 0.5)}"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>
            <circle cx="${cx}" cy="${cy}" r="9" fill="url(#immCore)"/>
            ${lines}
            <circle cx="${cx}" cy="${cy}" r="3.2" fill="${th.primary}" class="imm-pulse"/>
            <circle cx="${cx}" cy="${cy}" r="4.6" fill="none" stroke="${hexA(th.primary, 0.6)}" stroke-width=".4" class="imm-spin"/>
            <text x="${cx}" y="${cy + 8.5}" font-size="3" fill="${th.primary}" text-anchor="middle" font-weight="700">${esc(pn.slice(0, 6))}</text>
        </svg></div>
        <div class="bond-legend"><span><i style="background:#8fd9a8;"></i>挚交(70+)</span><span><i style="background:${th.primary};"></i>友善(45-69)</span><span><i style="background:${hexA(th.muted, 0.6)};"></i>相识</span><span><i style="background:#e07070;"></i>仇敌(&lt;20)</span></div>`;
  }
  function panelRealms() {
    const th = T();
    const idx = state.realmIdx;
    const rungs = th.realms.map((r, i) => {
      const on = i < idx, cur = i === idx;
      return `<div class="rl-rung ${cur ? "cur" : on ? "passed" : ""}">
                <div class="rl-node ${cur ? "cur" : on ? "on" : ""}">${on ? "●" : cur ? "◆" : "○"}</div>
                <div class="rl-name">${esc(r)}</div>
                ${cur ? `<div class="rl-mark">此刻</div>` : ""}
            </div>`;
    }).reverse().join("");
    const pct = Math.round(idx / (th.realms.length - 1) * 100);
    return `<div class="rl-head">
                <div class="rl-now">${esc(th.realms[idx])}</div>
                <div class="rl-raw">${state.realmRaw ? esc(state.realmRaw) : th.realmHint}</div>
                <div class="rl-bar"><i style="width:${pct}%;"></i></div>
                <div class="rl-pct">${esc(th.realmLabel)} · 天梯 ${idx + 1} / ${th.realms.length} 层（${pct}%）</div>
            </div>
            <div class="rl-ladder">${rungs}</div>`;
  }
  function panelTreasury() {
    if (!state.items.length) return emptyBox("💎", "囊中尚空", "AI 上报的 items（物品/道具）会自动入阁，按珍稀度染出六色光");
    const gr = [...state.items].sort((a, b) => (b.rarity || 1) - (a.rarity || 1));
    return `<div class="imm-tip">共 ${state.items.length} 类 · 色阶即珍稀（凡→神六阶）</div>
        <div class="tz-grid">${gr.map((it) => {
      const rr = RARITY[Math.min(5, it.rarity || 1)];
      return `<div class="tz-cell" style="--rc:${rr.c};" onclick="ImmersiveSuite.itemInfo('${esc(it.name).replace(/'/g, "")}')">
                <div class="tz-gem">◈</div>
                <div class="tz-name">${esc(it.name)}</div>
                ${it.count > 1 ? `<i class="tz-ct">×${it.count}</i>` : ""}
                <div class="tz-rar">${rr.n}</div></div>`;
    }).join("")}</div>`;
  }
  function itemInfo(name) {
    const it = state.items.find((x) => x.name === name);
    if (!it) return;
    const rr = RARITY[Math.min(5, it.rarity || 1)];
    dialogCard(`💎 ${esc(name)}`, `
            <div class="npc-row"><span>珍稀</span><b style="color:${rr.c};">${rr.n}</b>　<span>数量</span><b>×${it.count || 1}</b></div>
            <div class="npc-row"><span>入手</span><b>第 ${it.round || "?"} 回</b></div>
            ${it.note ? `<div class="npc-block">${esc(it.note)}</div>` : ""}`);
  }
  function panelChronicle() {
    const th = T();
    const rows = [];
    const seen = /* @__PURE__ */ new Set();
    state.titles.forEach((t) => {
      if (!seen.has("T" + t.round)) {
        seen.add("T" + t.round);
        rows.push({ round: t.round, kind: "title", text: t.title });
      }
    });
    state.chronicle.forEach((c) => {
      if (!seen.has("C" + c.round + c.text)) {
        seen.add("C" + c.round + c.text);
        rows.push({ round: c.round, kind: "event", text: c.text });
      }
    });
    rows.sort((a, b) => a.round - b.round);
    if (!rows.length) return emptyBox("📜", "史册空白", "每回的章回标题与大事记将在此编成年表，可一键导出成书");
    const curve = window.ImmersionPlus && ImmersionPlus.svgTension && state.tensions.length >= 2 ? ImmersionPlus.svgTension(state.tensions) : "";
    return `<div class="imm-tip">${esc(th.name)}纪事 · ${rows.length} 笔 <button class="imm-mini" onclick="ImmersiveSuite.exportChronicle()">⬇ 导出 txt</button></div>
        ${curve}
        <div class="ch-list">${rows.map((r) => r.kind === "title" ? `<div class="ch-title">第${r.round}回 · ${esc(r.text)}</div>` : `<div class="ch-event"><span class="ch-dot"></span>${esc(r.text)}<i>（第${r.round}回）</i></div>`).join("")}</div>`;
  }
  function exportChronicle() {
    const th = T();
    const pn = window.storyFramework && window.storyFramework.storyState.setup && window.storyFramework.storyState.setup.playerName || "行者";
    const rows = [];
    state.titles.forEach((t) => rows.push({ round: t.round, kind: "title", text: t.title }));
    state.chronicle.forEach((c) => rows.push({ round: c.round, kind: "event", text: c.text }));
    rows.sort((a2, b) => a2.round - b.round);
    const lines = [`《${pn} · ${th.name}行纪》`, "＝＝＝＝＝＝＝＝＝＝", ""];
    rows.forEach((r) => lines.push(r.kind === "title" ? `【第${r.round}回】${r.text}` : `　　· ${r.text}`));
    if (state.highlights.length) {
      lines.push("", "◆ 名场面", ...state.highlights.map((h) => `【第${h.round}回】${h.title}`));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pn}_${th.name}行纪.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3e3);
  }
  function panelLetters() {
    const th = T();
    const hasApi = !!getExtraApi();
    const list = [...state.letters].reverse();
    return `<div class="imm-tip">${esc(th.courier)} · ${th.medium} <button class="imm-mini" onclick="ImmersiveSuite.requestLetter()">✉ 等一封信</button>${window.ReaderLetters ? ' <button class="imm-mini" onclick="ReaderLetters.poke()">📬 戳一下读者</button>' : ""}</div>
        ${!hasApi ? `<div class="imm-warn">未配置额外 API：传书由独立信使模型执笔。在「世界动态」设置里配好额外 API 后，NPC 便会随剧情主动来信。</div>` : ""}
        ${!list.length ? emptyBox("✉", "尚无来信", "相识的 NPC 会随剧情主动寄来" + th.medium + "——问候、求助、密讯、告别") : list.map((l) => `<div class="lt-card ${l.read ? "" : "unread"}" onclick="ImmersiveSuite.readLetter('${l.id}')">
                <div class="lt-head"><span class="lt-from">${portrait(l.from, 34)}</span>
                    <div><b>${esc(l.from)}</b> <span class="lt-round">第${l.round}回寄达</span>${l.reader ? ' <span class="lt-round">📬 读者</span>' : ""}</div>
                    ${l.read ? "" : '<i class="imm-dot">新</i>'}</div>
                <div class="lt-title">${esc(l.title)}</div></div>`).join("")}`;
  }
  function getExtraApi() {
    try {
      const o = JSON.parse(MoStore.getItem("storyExtraApi") || "null");
      return o && o.enabled !== false && o.endpoint ? o : null;
    } catch (e) {
      return null;
    }
  }
  async function requestLetter() {
    const th = T();
    const api = getExtraApi();
    const known = Object.values(state.gallery).slice(0, 20).map((g) => `${g.name}（${g.role || "相识"}，好感${g.favor == null ? 50 : g.favor}）`).join("；");
    const vars = window.storyFramework && window.storyFramework.storyState.variables || {};
    const loc = vars[playerName(vars) + ".location"] || "";
    if (!api) {
      toastBanner("✉ 需先在「世界动态」中配置额外 API");
      return;
    }
    toastBanner(th.courier + "启程…");
    try {
      const body = {
        model: api.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: `你是《${th.name}》世界的信使，替一位与玩家相识的NPC写一封${th.medium}（120-180字）。要求：以该NPC原著口吻行文（口癖/自称/语气贴合人设）；内容基于当前处境推进关系或递出钩子；不替玩家做决定；结尾署名。输出JSON：{"from":"名字","title":"信题4-8字","body":"正文"}` },
          { role: "user", content: `玩家近况：第${vars.chapter || state.titles.length || "?"}回，位于「${loc || "不明"}」。相识之人：${known || "尚无相识NPC，可由世界生人（须符合原著设定）"}。` }
        ],
        temperature: 0.95,
        response_format: { type: "json_object" }
      };
      const res = await fetch(api.endpoint.replace(/\/chat\/completions$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (api.key || api.apiKey || "") },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "{}";
      const o = JSON.parse(txt.replace(/^```json|```$/g, "").trim());
      if (!o.from || !o.body) throw new Error("bad");
      const letter = { id: uid(), from: String(o.from).slice(0, 12), title: String(o.title || "无名之信").slice(0, 16), body: String(o.body).slice(0, 600), round: Number(vars.chapter) || state.titles.length || 1, read: false, replied: false };
      state.letters.push(letter);
      if (state.letters.length > 40) state.letters.shift();
      save();
      AudioBox.event("letter");
      mountLetterCard(letter);
      if (state.open) renderTab();
    } catch (e) {
      toastBanner("✉ 信使在路上出了岔子（额外 API 未通或格式异常）");
    }
  }
  function readLetter(id) {
    const l = state.letters.find((x) => x.id === id);
    if (!l) return;
    l.read = true;
    save();
    const th = T();
    dialogCard(`✉ ${esc(l.title)}`, `
            <div class="lt-meta">${esc(th.letterGreet)} · 第${l.round}回寄达 · ${esc(th.courier)}</div>
            <div class="lt-body">${esc(l.body).replace(/\n/g, "<br>")}</div>
            <div class="lt-sign">—— ${esc(l.from)} 敬上</div>
            ${l.replied ? '<div class="lt-replied">已回信</div>' : `<button class="imm-mini big" onclick="ImmersiveSuite.replyLetter('${l.id}')">✎ 回信</button>`}`);
    if (state.open) renderTab();
  }
  function replyLetter(id) {
    const l = state.letters.find((x) => x.id === id);
    if (!l) return;
    const input = $("immDialog");
    if (input) closeDialog();
    const ta = $("messageInput");
    if (ta) {
      ta.value = `【回信·致${l.from}】`;
      ta.focus();
      l.replied = true;
      save();
      toastBanner("✎ 已起笺——写罢发送，下轮回信随剧情送达");
      if (state.open) renderTab();
    }
  }
  function mountLetterCard(l) {
    if (isEarth()) return;
    const box = $("chatMessages");
    if (!box) return;
    const th = T();
    const el = document.createElement("div");
    el.className = "imm-letter-card";
    el.innerHTML = `<span class="lc-sigil">${portrait(l.from, 40)}</span>
            <div class="lc-main"><b>${esc(l.from)}</b> 寄来一封${esc(th.medium)}：<span class="lc-title">「${esc(l.title)}」</span>
            <button class="imm-mini" onclick="ImmersiveSuite.toggle(true);ImmersiveSuite.openTab('letters');ImmersiveSuite.readLetter('${l.id}')">展信</button></div>`;
    box.appendChild(el);
    try {
      box.scrollTop = box.scrollHeight;
    } catch (e) {
    }
  }
  function panelEvents() {
    if (!state.events.length) return emptyBox("⏳", "四野无讯", "AI 上报的 events（大事倒计时）会在此挂牌：精英赛开赛、兽潮将至、宗门大比…");
    return `<div class="imm-tip">大事在即 · 随回合逼近</div>` + [...state.events].sort((a, b) => a.days - b.days).map((e) => {
      const urg = e.days <= 3 ? "hot" : e.days <= 7 ? "warm" : "";
      return `<div class="ev-plate ${urg} ${e.done ? "done" : ""}">
                <div class="ev-name">${esc(e.name)}</div>
                <div class="ev-days">${e.done ? "已了结" : `<b>${e.days}</b><span>回</span>`}</div>
                <div class="ev-track"><i style="width:${Math.max(4, 100 - Math.min(100, e.days * 5))}%;"></i></div>
            </div>`;
    }).join("");
  }
  function panelHighlights() {
    if (!state.highlights.length) return emptyBox("⭐", "高光未至", "张力拉满的回合（AI 标记 highlight 或张力≥88）自动剪存于此，随时重温");
    return `<div class="imm-tip">高光 ${state.highlights.length} 幕</div>` + [...state.highlights].reverse().map((h) => `
            <div class="hl-card" onclick="ImmersiveSuite.showHighlight(${h.round})">
                <div class="hl-head"><b>第${h.round}回</b> ${esc(h.title)}${h.tension ? `<i class="hl-ten">张力 ${h.tension}</i>` : ""}</div>
                <div class="hl-ex">${esc(h.excerpt.slice(0, 96))}…</div></div>`).join("");
  }
  function showHighlight(round) {
    const h = state.highlights.find((x) => x.round === round);
    if (!h) return;
    dialogCard(`⭐ 第${h.round}回 · ${esc(h.title)}`, `<div class="hl-full">${esc(h.excerpt)}…</div><div class="imm-tip">完整回合请回聊天流向上翻阅</div>`);
  }
  function panelBattles() {
    if (!state.battles.length) return emptyBox("⚔", "未历大战", "大战落幕后（AI 上报 combat）自动生成结算卡：出招序列 / 缴获 / 伤势");
    const R = { "胜": "#8fd9a8", "败": "#e07070", "平": "#d8c8a0", "逃": "#8ab0f0" };
    return `<div class="imm-tip">历战 ${state.battles.length} 场</div>` + [...state.battles].reverse().map((b) => `
            <div class="bt-card" style="--brc:${R[b.result] || "#d8c8a0"};">
                <div class="bt-head"><b class="bt-res">${esc(b.result)}</b><span class="bt-foe">对阵 ${esc(b.foes || "不明之敌")}</span><i>第${b.round}回</i></div>
                ${b.moves ? `<div class="bt-row"><span>招序</span>${esc(b.moves)}</div>` : ""}
                ${b.loot ? `<div class="bt-row loot"><span>缴获</span>${esc(b.loot)}</div>` : ""}
                ${b.wounds ? `<div class="bt-row hurt"><span>伤势</span>${esc(b.wounds)}</div>` : ""}
            </div>`).join("");
  }
  function panelSettings() {
    const th = T();
    const snd = AudioBox.enabled();
    const pOn = window.AmbienceLayer && AmbienceLayer.particleEnabled ? AmbienceLayer.particleEnabled() : false;
    const tOn = window.AmbienceLayer && AmbienceLayer.tintEnabled ? AmbienceLayer.tintEnabled() : false;
    return `<div class="st-sec">
            <div class="st-title">🎧 氛围音景 · ${esc(th.sound.kind)}</div>
            <div class="st-row"><span>环境音</span>
                <button class="imm-mini big ${snd ? "on" : ""}" onclick="ImmersiveSuite.toggleAmbient()">${snd ? "🔊 播放中（点击停止）" : "🔇 开启"}</button></div>
            <div class="st-note">程序合成音景（无音频文件）：${{ bell: "深空钟鸣与星辉泛音", desert: "荒漠风沙与炉火噼啪", chime: "学院风铃与林间鸟语", wild: "荒古低鼓与旷野长风", hum: "舰桥低鸣与仪表嗡振", arcade: "键盘敲击与街机提示音", rain: "夜雨敲窗与案头更漏" }[th.sound.kind]}</div>
        </div>
        <div class="st-sec">
            <div class="st-title">🌫 氛围引擎 · 风霜雨雪与昼夜</div>
            <div class="st-row"><span>全屏天象粒子</span>
                <button class="imm-mini big ${pOn ? "on" : ""}" onclick="ImmersiveSuite.toggleAmbParticle()">${pOn ? "❄ 感知中（点击关闭）" : "关闭 · 开启"}</button></div>
            <div class="st-row"><span>昼夜色温</span>
                <button class="imm-mini big ${tOn ? "on" : ""}" onclick="ImmersiveSuite.toggleAmbTint()">${tOn ? "🌇 随时辰流转（点击关闭）" : "关闭 · 开启"}</button></div>
            <div class="st-note">AI 每轮上报的 time / weather 驱动：雪落、雨斜、雾漫、沙横、雷闪各具形态，六界粒子气质不同（${esc(th.sigil)}界现为${esc(th.name)}气质）；时辰转动时页面色温随之晨昏流转</div>
        </div>
        <div class="st-sec">
            <div class="st-title">🧭 ${esc(th.compassName)}</div>
            ${compassSVG(150)}
            <div class="st-row"><span>时辰</span><b>${esc(state.time || "未知")}</b></div>
            <div class="st-row"><span>天象</span><b>${esc(state.weather || "未知")}</b></div>
            ${state.day ? `<div class="st-row"><span>历日</span><b>${esc(state.day)}</b></div>` : ""}
            <div class="st-note">AI 每轮上报 time / weather，罗盘指针随之而动</div>
        </div>
        <div class="st-sec">
            <div class="st-title">📦 数据</div>
            <div class="st-row"><span>本界档</span><button class="imm-mini" onclick="ImmersiveSuite.resetAll()">清空重来</button></div>
            <div class="st-row"><span>设定集</span><button class="imm-mini big" onclick="ImmersiveSuite.exportCodex()">📜 一键导出（HTML）</button></div>
            <div class="st-note">全量档案快照：众生卷·羁绊图·境界梯·藏宝·名场面·战报·传书·编年史·足迹·世界线·成就，自含样式可直接分享</div>
        </div>
        <div class="st-sec">
            <div class="st-title">🧾 提示词预算 · 上下文账单（v3.5.0）</div>
            ${window.PromptBudget ? PromptBudget.meterHTML() : ""}
            <div class="st-row"><span>预算控制</span>
                <button class="imm-mini big ${window.PromptBudget && PromptBudget.get().enabled ? "on" : ""}" onclick="ImmersiveSuite.toggleBudget()">${window.PromptBudget && PromptBudget.get().enabled ? "✅ 开启中（点击关闭）" : "已关闭 · 开启"}</button></div>
            <div class="st-row"><span>预算上限</span>
                <button class="imm-mini big" onclick="ImmersiveSuite.cycleBudgetLimit()">${window.PromptBudget ? (PromptBudget.get().auto !== false && PromptBudget.get().autoLimitChars ? "🔎 自适应 · " + (PromptBudget.get().limit / 1e4).toFixed(1) + " 万字符" : (PromptBudget.get().limit / 1e4).toFixed(0) + " 万字符") + "（点击切换）" : "—"}</button></div>
            <div class="st-note">🔎 自适应：按主接口模型的上下文窗口自动定预算（如 32K 上下文 ≈ 1.6 万字符）；点上面的按钮可切换成手动档位，循环到底回到自适应。</div>
            <div class="st-note">超预算时按"先丢最不值"裁剪：知识库背景 → 前景检索 → 反八股 → 历史最旧（保底12条）→ 场域注记 → 前情提要；系统提示词 / 设定卡 / 状态面板 / 本轮指令永不裁</div>
        </div>
        <div class="st-sec">
            <div class="st-title">📖 古籍竖排</div>
            <div class="st-row"><span>书卷竖读</span>
                <button class="imm-mini big ${MoStore.getItem("immVertical") === "on" ? "on" : ""}" onclick="ImmersiveSuite.toggleVertical()">${MoStore.getItem("immVertical") === "on" ? "📗 竖排中（点击复原）" : "📖 开启竖排"}</button></div>
            <div class="st-note">正文以古籍卷轴式竖排呈现：右起左行、繁体观感、首字下沉——适合仙武侠慢慢读</div>
        </div>
        ${window.ImmersionPlus && ImmersionPlus.settingsPanel ? ImmersionPlus.settingsPanel() : ""}`;
  }
  function compassSVG(size) {
    const th = T();
    const hs = th.hourSet;
    const idx = hourIdx();
    const ang = idx >= 0 ? idx * 30 : null;
    return `<div class="cp-wrap"><svg viewBox="-56 -56 112 112" width="${size}" height="${size}">
            <defs><radialGradient id="cpG"><stop offset="60%" stop-color="${hexA(th.deep, 0.2)}"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>
            <circle r="52" fill="url(#cpG)" stroke="${hexA(th.primary, 0.4)}" stroke-width="1"/>
            <circle r="42" fill="none" stroke="${hexA(th.primary, 0.18)}" stroke-width=".6"/>
            ${hs.map((x, i) => {
      const a = i * 30 * Math.PI / 180;
      const r1 = 46, r2 = 50;
      return `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * r2).toFixed(1)}" y2="${(Math.sin(a) * r2).toFixed(1)}" stroke="${hexA(th.primary, 0.5)}" stroke-width=".8"/>
                    <text x="${(Math.cos(a) * 36).toFixed(1)}" y="${(Math.sin(a) * 36 + 1.8).toFixed(1)}" font-size="5.4" fill="${i === idx ? th.primary : hexA(th.muted, 0.8)}" text-anchor="middle" ${i === idx ? 'font-weight="700"' : ""}>${x}</text>`;
    }).join("")}
            ${ang != null ? `<g transform="rotate(${ang})" class="imm-needle"><path d="M0,-30 L3.4,0 L0,7 L-3.4,0 Z" fill="${th.primary}"/><circle r="2.6" fill="${th.accent}"/></g>` : `<circle r="3" fill="${hexA(th.muted, 0.6)}"/>`}
            <text y="30" font-size="4.6" fill="${hexA(th.muted, 0.9)}" text-anchor="middle">${esc(state.weather || "")}</text>
        </svg></div>`;
  }
  const AudioBox = {
    _ctx: null,
    _master: null,
    _nodes: [],
    _on: false,
    KEY: "immAudio",
    enabled() {
      try {
        return MoStore.getItem(this.KEY) === "on";
      } catch (e) {
        return false;
      }
    },
    ctx() {
      if (!this._ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this._ctx = new AC();
        this._master = this._ctx.createGain();
        this._master.gain.value = 0.16;
        this._master.connect(this._ctx.destination);
      }
      if (this._ctx.state === "suspended") this._ctx.resume();
      return this._ctx;
    },
    /** 环境音：按界合成多层（噪声风声/低频钟鸣/琶音） */
    ambient() {
      const th = T();
      const ctx = this.ctx();
      if (!ctx) return false;
      this.stopAmbient();
      const kind = th.sound.kind;
      const f0 = th.sound.f0 || 110;
      const mk = (type) => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(this._master);
        this._nodes.push(g);
        return g;
      };
      const windGain = mk();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = kind === "rain" ? 2400 : kind === "desert" ? 420 : 900;
      bp.Q.value = kind === "rain" ? 0.4 : 0.8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.1;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.05;
      lfo.connect(lfoG);
      lfoG.connect(windGain.gain);
      noise.connect(bp);
      bp.connect(windGain);
      noise.start();
      lfo.start();
      windGain.gain.setTargetAtTime(kind === "hum" || kind === "arcade" ? 0.18 : 0.5, ctx.currentTime, 1.2);
      this._nodes.push(noise, lfo);
      const padGain = mk();
      const osc = ctx.createOscillator();
      osc.type = kind === "arcade" ? "square" : "sine";
      osc.frequency.value = f0;
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = f0 * 1.5 + 1.7;
      const og = ctx.createGain();
      og.gain.value = 0.5;
      osc.connect(og);
      osc2.connect(og);
      og.connect(padGain);
      osc.start();
      osc2.start();
      padGain.gain.setTargetAtTime(kind === "bell" || kind === "chime" ? 0.3 : 0.18, ctx.currentTime, 2);
      this._nodes.push(osc, osc2);
      if (kind === "bell" || kind === "chime") {
        const tick = () => {
          if (!this._on) return;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = f0 * (2 + Math.floor(Math.random() * 3));
          g.gain.value = 0;
          g.gain.setTargetAtTime(0.1, ctx.currentTime, 0.02);
          g.gain.setTargetAtTime(0, ctx.currentTime + 0.3, 0.5);
          o.connect(g);
          g.connect(this._master);
          o.start();
          o.stop(ctx.currentTime + 3.5);
          this._timer = setTimeout(tick, 3500 + Math.random() * 6e3);
        };
        this._timer = setTimeout(tick, 2e3);
      }
      this._on = true;
      return true;
    },
    stopAmbient() {
      this._on = false;
      clearTimeout(this._timer);
      const ctx = this._ctx;
      this._nodes.forEach((n) => {
        try {
          if (n.stop) n.stop();
          n.disconnect && n.disconnect();
        } catch (e) {
        }
      });
      this._nodes = [];
      if (ctx) try {
        this._master.gain.setTargetAtTime(1e-4, ctx.currentTime, 0.3);
      } catch (e) {
      }
      if (ctx) try {
        this._master.gain.setTargetAtTime(0.16, ctx.currentTime + 1.5, 0.3);
      } catch (e) {
      }
    },
    /** 事件音：突破/得胜/败北/来信/名场面/战鼓/落雷/盖章/心跳
        v3.2.0 扩展：war=战鼓滚奏 · thunder=金榜落雷 · seal=印章重击 · heart=紧张心跳
        v3.14.0 扩展：page=章节扉页翻纸 · drum=关键抉择低鼓（沉浸九艺） */
    event(name) {
      if (!this.enabled()) return;
      const ctx = this.ctx();
      if (!ctx) return;
      const seqs = {
        breakthrough: [[392, 0], [523, 0.12], [659, 0.24], [784, 0.38]],
        victory: [[523, 0], [659, 0.1], [784, 0.2]],
        defeat: [[330, 0], [262, 0.18], [196, 0.4]],
        letter: [[880, 0], [1174, 0.14]],
        highlight: [[659, 0], [784, 0.1], [988, 0.22], [1318, 0.36]],
        seal: [[262, 0], [196, 0.05]]
      };
      if (name === "war") {
        this._drums([[0, 0.9], [0.22, 0.55], [0.38, 0.25], [0.52, 0.8], [0.74, 0.5], [0.9, 1]]);
        return;
      }
      if (name === "thunder") {
        this._thunder();
        return;
      }
      if (name === "heart") {
        this._heart();
        return;
      }
      if (name === "page") {
        this._page();
        return;
      }
      if (name === "drum") {
        this._drums([[0, 0.8]]);
        return;
      }
      (seqs[name] || []).forEach(([f, t]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.22, ctx.currentTime + t, 0.015);
        g.gain.setTargetAtTime(0, ctx.currentTime + t + 0.12, 0.25);
        o.connect(g);
        g.connect(this._master || ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 1.2);
      });
    },
    /** 翻纸（v3.14.0 章节扉页）：带通噪声上扫，模拟纸张翻动 */
    _page() {
      const ctx = this.ctx();
      if (!ctx) return;
      const dest = this._master || ctx.destination;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.4);
      const n = ctx.createBufferSource();
      n.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(700, ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.04);
      g.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.3);
      n.connect(bp);
      bp.connect(g);
      g.connect(dest);
      n.start(ctx.currentTime);
      n.stop(ctx.currentTime + 0.36);
    },
    /** 战鼓：低频正弦体 + 噪声鼓皮，t=时刻 s=力度 */
    _drums(hits) {
      const ctx = this.ctx();
      if (!ctx) return;
      const dest = this._master || ctx.destination;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      for (const [t, s] of hits) {
        const at = ctx.currentTime + t;
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(96, at);
        o.frequency.exponentialRampToValueAtTime(46, at + 0.16);
        og.gain.setValueAtTime(0, at);
        og.gain.linearRampToValueAtTime(0.5 * s, at + 0.012);
        og.gain.exponentialRampToValueAtTime(1e-3, at + 0.3);
        o.connect(og);
        og.connect(dest);
        o.start(at);
        o.stop(at + 0.34);
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 700;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.16 * s, at);
        ng.gain.exponentialRampToValueAtTime(1e-3, at + 0.12);
        n.connect(hp);
        hp.connect(ng);
        ng.connect(dest);
        n.start(at);
      }
    },
    /** 落雷：噪声爆裂 + 低频震尾 */
    _thunder() {
      const ctx = this.ctx();
      if (!ctx) return;
      const dest = this._master || ctx.destination;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
      const n = ctx.createBufferSource();
      n.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3200, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 1.5);
      n.connect(lp);
      lp.connect(g);
      g.connect(dest);
      n.start();
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(58, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1.1);
      og.gain.setValueAtTime(0.3, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 1.3);
      o.connect(og);
      og.connect(dest);
      o.start();
      o.stop(ctx.currentTime + 1.4);
    },
    /** 心跳：双击低频闷响（紧张剧情垫底） */
    _heart() {
      const ctx = this.ctx();
      if (!ctx) return;
      const dest = this._master || ctx.destination;
      const thump = (t, v) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(64, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.02);
        g.gain.exponentialRampToValueAtTime(1e-3, t + 0.22);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + 0.26);
      };
      thump(ctx.currentTime, 0.3);
      thump(ctx.currentTime + 0.24, 0.2);
    }
  };
  function mountChapterBanner(round, title) {
    const box = $("chatMessages");
    if (!box) return;
    const th = T();
    const el = document.createElement("div");
    el.className = "imm-chapter-banner";
    el.innerHTML = `<span class="cb-num">第${round}回</span><span class="cb-line">──</span><b>${esc(title)}</b><span class="cb-line">──</span>`;
    box.appendChild(el);
    try {
      box.scrollTop = box.scrollHeight;
    } catch (e) {
    }
  }
  function mountBattleCard(b) {
    if (isEarth()) return;
    const box = $("chatMessages");
    if (!box) return;
    const R = { "胜": "#8fd9a8", "败": "#e07070", "平": "#d8c8a0", "逃": "#8ab0f0" };
    try {
      AudioBox.event("war");
    } catch (e) {
    }
    const el = document.createElement("div");
    el.className = "imm-battle-card";
    el.style.setProperty("--brc", R[b.result] || "#d8c8a0");
    el.innerHTML = `<div class="ib-head"><b>${esc(b.result)}</b><span>对阵 ${esc(b.foes || "不明之敌")}</span><i>第${b.round}回 · 战报</i></div>
            ${b.moves ? `<div class="ib-row">⚔ ${esc(b.moves)}</div>` : ""}
            ${b.loot ? `<div class="ib-row loot">💎 ${esc(b.loot)}</div>` : ""}
            ${b.wounds ? `<div class="ib-row hurt">🩸 ${esc(b.wounds)}</div>` : ""}`;
    box.appendChild(el);
    try {
      box.scrollTop = box.scrollHeight;
    } catch (e) {
    }
  }
  function toastBanner(txt) {
    const t = document.createElement("div");
    t.className = "imm-toast";
    t.textContent = txt;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("show"), 30);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 500);
    }, 2600);
  }
  function dialogCard(title, html) {
    closeDialog();
    const ov = document.createElement("div");
    ov.id = "immDialogOv";
    ov.className = "imm-dialog-ov";
    ov.onclick = (e) => {
      if (e.target === ov) closeDialog();
    };
    const th = T();
    ov.innerHTML = `<div class="imm-dialog" style="--ip:${th.primary};--idp:${th.panel};--itx:${th.text};">
            <div class="id-head"><b>${title}</b><button onclick="ImmersiveSuite.closeDialog()">✕</button></div>
            <div class="id-body">${html}</div></div>`;
    document.body.appendChild(ov);
    setTimeout(() => ov.classList.add("show"), 20);
  }
  function closeDialog() {
    const ov = $("immDialogOv");
    if (ov) {
      ov.classList.remove("show");
      setTimeout(() => ov.remove(), 200);
    }
  }
  function emptyBox(icon, t, d) {
    return `<div class="imm-empty"><b>${icon}</b><div class="ie-t">${t}</div><div class="ie-d">${d}</div></div>`;
  }
  function onVars(vars) {
    if (!vars) return;
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey;
    if (!genre) return;
    const round = Number(vars.chapter || vars.round || fw.storyState && fw.storyState.turnCount) || state.titles.length + 1;
    let dirty = false;
    try {
      if (state.genre !== genre) load(genre);
      if (isEarth()) unmountUI();
      const gl = Object.keys(state.gallery).length;
      ingestCharacters(vars, round);
      if (Object.keys(state.gallery).length !== gl) dirty = true;
      const itN = state.items.length;
      ingestItems(vars, round);
      if (state.items.length !== itN) dirty = true;
      const evN = state.events.length;
      ingestEvents(vars, round);
      if (state.events.length !== evN) dirty = true;
      const bN = state.battles.length;
      ingestCombat(vars, round);
      if (state.battles.length > bN) {
        mountBattleCard(state.battles[state.battles.length - 1]);
        dirty = true;
      }
      const tN = state.titles.length;
      ingestTitle(vars, round);
      if (state.titles.length !== tN) dirty = true;
      const cN = state.chronicle.length;
      ingestHistory(vars, round);
      if (state.chronicle.length !== cN) dirty = true;
      ingestTime(vars);
      ingestRealm(vars);
      const hN = state.highlights.length;
      ingestHighlight(vars, round);
      if (state.highlights.length !== hN) dirty = true;
      try {
        window.WorldExt && WorldExt.onVars(vars, round);
      } catch (e) {
      }
      const ten = Number(vars.tension != null ? vars.tension : vars.dashboard && vars.dashboard.tension);
      if (ten >= 70) {
        try {
          AudioBox.event("heart");
        } catch (e) {
        }
      }
      if (Number.isFinite(ten) && ten >= 0) {
        const v = Math.min(100, ten);
        const i = state.tensions.findIndex((x) => x.round === round);
        if (i >= 0) state.tensions[i] = { round, v };
        else {
          state.tensions.push({ round, v });
          if (state.tensions.length > 240) state.tensions.shift();
        }
        dirty = true;
      }
      if (state.open) renderTab();
      save();
    } catch (e) {
      console.warn("[Immersive]", e.message);
    }
  }
  function exportCodex() {
    var _a, _b;
    try {
      const th = T();
      const fw = window.storyFramework;
      const v = fw && fw.storyState.variables || {};
      const pn = fw && fw.storyState.setup && fw.storyState.setup.playerName || "旅人";
      const book = fw && fw.storyState.setup && fw.storyState.setup.bookTitle || th.name + "·游玩记录";
      const gal = Object.values(state.gallery);
      const fav = (g) => g.favor == null ? 50 : g.favor;
      let visits = [];
      try {
        const a2 = JSON.parse(MoStore.getItem("storyAtlas_" + state.genre) || "null");
        if (a2 && Array.isArray(a2.visits)) visits = a2.visits.map((x) => x.id || x.name).filter(Boolean);
      } catch (e) {
      }
      let lines = [];
      try {
        const t = JSON.parse(MoStore.getItem("tl_" + state.genre) || "null");
        if (t && Array.isArray(t.nodes)) lines = t.nodes;
      } catch (e) {
      }
      let seals = [];
      try {
        const g2 = JSON.parse(MoStore.getItem("gl_" + state.genre) || "null");
        seals = g2 && g2.seals || [];
      } catch (e) {
      }
      const sealTags = window.GameLayer && GameLayer.sealLabels ? GameLayer.sealLabels() : seals.map((id) => ({ icon: "🏆", name: id }));
      const sec = (icon, name, inner) => inner ? `<section><h2><span>${icon}</span>${name}</h2>${inner}</section>` : "";
      const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${esc(book)} · 设定集</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${th.deep};color:${th.text};font-family:"Noto Serif SC",serif;padding:36px 5%;line-height:1.8;max-width:1060px;margin:0 auto}
.cover{text-align:center;padding:44px 20px 30px;border-bottom:1px solid ${th.primary}55}
.cover h1{font-size:30px;color:${th.primary};letter-spacing:6px}
.cover .sub{margin-top:10px;color:${th.muted};font-size:13px;letter-spacing:2px}
.cover .stats{margin-top:16px;display:flex;justify-content:center;gap:26px;flex-wrap:wrap;font-size:12px;color:${th.muted}}
.cover .stats b{display:block;font-size:20px;color:${th.text};font-family:inherit}
h2{font-size:17px;color:${th.primary};margin:34px 0 14px;letter-spacing:3px;border-left:3px solid ${th.primary};padding-left:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:rgba(255,255,255,.03);border:1px solid ${th.primary}33;border-radius:12px;padding:14px}
.card .hd{display:flex;gap:12px;align-items:center}
.card b.nm{font-size:15px;color:${th.primary}}
.card .rl{font-size:12px;color:${th.muted}}
.card p{font-size:12.5px;color:${th.text};opacity:.85;margin-top:8px}
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;background:${th.primary}22;color:${th.primary};margin-right:6px}
.row{display:flex;gap:10px;padding:9px 12px;border-bottom:1px dashed ${th.muted}33;font-size:13px;align-items:baseline}
.row b{color:${th.text};min-width:64px;font-weight:600}
.row span{color:${th.muted};font-size:12px;flex:1}
.favbar{height:4px;border-radius:2px;background:${th.muted}33;overflow:hidden;margin-top:8px}
.favbar i{display:block;height:100%;background:${th.primary}}
.quote{font-size:12.5px;color:${th.primary};opacity:.8;margin-top:8px;font-style:italic}
footer{margin-top:44px;text-align:center;color:${th.muted};font-size:11px;letter-spacing:2px}
@media print{body{background:#fff;color:#111}}
</style></head><body>
<div class="cover"><h1>${esc(book)}</h1>
<div class="sub">${esc(th.name)} · ${esc(pn)} 的编年设定集 · 由云境 v3.4.0 自动纂成</div>
<div class="stats">
<div><b>${v.chapter || state.titles.length || "?"}</b>章</div>
<div><b>${v.wordCount || v.totalWords || "?"}</b>字</div>
<div><b>${gal.length}</b>相识</div>
<div><b>${state.battles.length}</b>战报</div>
<div><b>${visits.length}</b>足迹</div>
<div><b>${lines.length}</b>世界线</div>
</div></div>
${sec("🎭", "众生卷", gal.length ? `<div class="grid">${gal.map((g) => `
<div class="card"><div class="hd">${portrait(g.name, 62)}<div><b class="nm">${esc(g.name)}</b><div class="rl">${esc(g.role || "")}</div></div></div>
${g.relation ? `<div class="row"><b>关系</b><span>${esc(g.relation)}</span></div>` : ""}
${g.status ? `<div class="row"><b>现状</b><span>${esc(g.status)}</span></div>` : ""}
${g.desc ? `<p>${esc(String(g.desc).slice(0, 160))}</p>` : ""}
<div class="favbar"><i style="width:${fav(g)}%"></i></div>
${g.line ? `<div class="quote">「${esc(g.line)}」</div>` : ""}
${g.secret ? `<div class="tag">身负隐秘</div>` : ""}
</div>`).join("")}</div>` : "")}
${sec("🌌", "羁绊图", gal.length ? panelBonds() : "")}
${sec("⛩", "境界梯", state.realmRaw ? `<div class="row"><b>当前</b><span>${esc(state.realmRaw)}（第 ${state.realmIdx + 1} 阶 / 共 ${th.realms.length} 阶）</span></div>
<div class="row"><b>阶梯</b><span>${th.realms.map((r, i) => i === state.realmIdx ? `<b style="color:${th.primary}">◆${esc(r)}</b>` : esc(r)).join(" → ")}</span></div>` : "")}
${sec("🗺", "行旅足迹", visits.length ? `<div class="row"><b>已至</b><span>${visits.map(esc).join(" · ")}</span></div>` : "")}
${sec("💎", "藏宝卷", state.items.length ? state.items.map((it) => `<div class="row"><b>${esc(it.name)}</b><span>${esc(it.desc || "")}${it.count > 1 ? ` ×${it.count}` : ""}</span></div>`).join("") : "")}
${sec("⭐", "名场面", state.highlights.length ? `<div class="grid">${state.highlights.map((h) => `<div class="card"><b class="nm">第${h.round}回 · ${esc(h.title)}</b><p>${esc(String(h.excerpt || "").slice(0, 200))}</p></div>`).join("")}</div>` : "")}
${sec("⚔", "战报卷", state.battles.length ? state.battles.map((b) => `<div class="row"><b style="color:${/胜/.test(b.result) ? "#8fd9a8" : /败/.test(b.result) ? "#e07070" : "inherit"}">${esc(b.result)}</b><span>对阵 ${esc(b.foes || "不明")} · 第${b.round}回${b.moves ? " · " + esc(String(b.moves).slice(0, 80)) : ""}</span></div>`).join("") : "")}
${sec("✉", "传书卷", state.letters.length ? state.letters.map((l) => `<div class="card"><b class="nm">${esc(l.title)}</b><div class="rl">${esc(l.from)} · 第${l.round}回${l.reader ? " · 读者" : ""}</div><p>${esc(String(l.body).slice(0, 260))}</p></div>`).join("") : "")}
${sec("📜", "编年史", state.chronicle.length ? state.chronicle.map((c) => `<div class="row"><b>第${c.round}回</b><span>${esc(c.text)}</span></div>`).join("") : "")}
${sec("🌐", "世界线", lines.length ? lines.map((l) => `<div class="row"><b>${esc(l.label)}</b><span>第${l.chapter || "?"}章 · 约${l.words || "?"}字 · ${new Date(l.at).toLocaleDateString("zh-CN")}</span></div>`).join("") : "")}
${sec("🏆", "天道印章", sealTags.length ? sealTags.map((t) => `<span class="tag" style="font-size:13px;padding:5px 12px;margin:4px">${t.icon} ${esc(t.name)}</span>`).join("") : '<div class="row"><b></b><span>尚无成就</span></div>')}
${(() => {
        try {
          return window.WorldExt && WorldExt.hasModules && WorldExt.hasModules() ? sec("🧬", "界专属机制", `<div style="font-size:12px;line-height:1.9">${WorldExt.panelHTML().replace(/class="wx-[a-z-]+"/g, 'class=""').replace(/ onclick="[^"]*"/g, "")}</div>`) : "";
        } catch (e) {
          return "";
        }
      })()}
<footer>云境 · AI短篇小说创作室 — 本设定集为只读快照，生成于 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}</footer>
</body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(book || "设定集").replace(/[\\/:*?"<>|]/g, "")}-设定集.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 800);
      try {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📜 设定集已导出（HTML）", "success");
      } catch (e) {
      }
    } catch (e) {
      console.warn("[Codex]", e.message);
      try {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "设定集导出失败：" + e.message, "error");
      } catch (e2) {
      }
    }
  }
  const ImmersiveSuite2 = {
    onVars,
    init: mount,
    showNPC,
    itemInfo,
    readLetter,
    replyLetter,
    requestLetter,
    exportChronicle,
    showHighlight,
    closeDialog,
    openWhisper,
    sendWhisper,
    closeWhisper,
    reload,
    carryIntel,
    takeIntel,
    get _state() {
      return state;
    },
    get _audio() {
      return (n) => AudioBox.event(n);
    },
    /** v3.2.0 外部注入传书（读者来信等）：归一为信件结构并挂卡 */
    addLetter(o) {
      if (!o || !o.from || !o.body) return false;
      const letter = {
        id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        from: String(o.from).slice(0, 12),
        title: String(o.title || "无名之信").slice(0, 20),
        body: String(o.body).slice(0, 600),
        round: Number(o.round) || state.titles.length || 1,
        read: false,
        replied: false,
        reader: !!o.reader
      };
      state.letters.push(letter);
      if (state.letters.length > 40) state.letters.shift();
      save();
      AudioBox.event("letter");
      try {
        mountLetterCard(letter);
      } catch (e) {
      }
      if (state.open) renderTab();
      return true;
    },
    /** v3.2.0 古籍竖排模式：仙侠武侠竖排书卷 */
    toggleVertical() {
      const on = MoStore.getItem("immVertical") === "on";
      MoStore.setItem("immVertical", on ? "off" : "on");
      applyVertical(!on);
      if (state.open && state.tab === "settings") renderTab();
    },
    /** v3.5.0 提示词预算开关 */
    toggleBudget() {
      if (!window.PromptBudget) return;
      const cfg = PromptBudget.get();
      PromptBudget.save({ enabled: !cfg.enabled });
      if (state.open && state.tab === "settings") renderTab();
    },
    /** v3.5.0 预算上限档位循环：8万 / 11万 / 15万 / 20万字符；v3.55.18 末尾回到自适应 */
    cycleBudgetLimit() {
      if (!window.PromptBudget) return;
      const steps = [8e4, 11e4, 15e4, 2e5];
      const cfg = PromptBudget.get();
      if (cfg.auto !== false && cfg.autoLimitChars > 0) {
        PromptBudget.save({ limit: steps[0], auto: false });
      } else {
        const idx = steps.indexOf(cfg.limit);
        if (idx < 0 || idx === steps.length - 1) PromptBudget.save({ auto: true });
        else PromptBudget.save({ limit: steps[idx + 1], auto: false });
      }
      if (state.open && state.tab === "settings") renderTab();
    },
    /** v3.2.0 一键设定集：全量档案导出为独立 HTML */
    exportCodex,
    toggle(open) {
      if (isEarth()) {
        unmountUI();
        return;
      }
      state.open = open == null ? !state.open : !!open;
      const d = $("immDrawer");
      if (state.open) {
        try {
          if (!d) mount();
          else {
            d.classList.add("show");
            renderTab();
          }
        } catch (e) {
          console.warn("[太虚阁] 打开故障:", e.message);
        }
      } else if (d) d.classList.remove("show");
    },
    openTab(t) {
      state.tab = t;
      this.toggle(true);
      try {
        const d = $("immDrawer");
        if (d) {
          d.classList.add("show");
        }
        renderTab();
      } catch (e) {
        console.warn("[太虚阁] 切页故障:", e.message);
      }
    },
    toggleAmbient() {
      if (AudioBox.enabled()) {
        try {
          MoStore.setItem(AudioBox.KEY, "off");
        } catch (e) {
        }
        AudioBox.stopAmbient();
      } else {
        try {
          MoStore.setItem(AudioBox.KEY, "on");
        } catch (e) {
        }
        AudioBox.ambient();
        AudioBox.event("letter");
      }
      if (state.open && state.tab === "settings") renderTab();
    },
    toggleAmbParticle() {
      try {
        window.AmbienceLayer && AmbienceLayer.toggleParticle();
      } catch (e) {
      }
      if (state.open && state.tab === "settings") renderTab();
    },
    toggleAmbTint() {
      try {
        window.AmbienceLayer && AmbienceLayer.toggleTint();
      } catch (e) {
      }
      if (state.open && state.tab === "settings") renderTab();
    },
    get _tab() {
      return state.tab;
    },
    /** 槽位感知的沉浸档键（timeline-branch 快照/回写同源引用） */
    immKey(genre) {
      return immKey(genre);
    },
    /* v3.27.4 安卓适配：原生 confirm → 应用内 UIDialog */
    async resetAll() {
      var _a;
      const msg = "清空本界沉浸档（图鉴/物品/信件/战报/世界线/天道成就）？";
      if ((_a = window.UIDialog) == null ? void 0 : _a.confirm) {
        const ok = await window.UIDialog.confirm({ title: "清空沉浸档", message: msg, danger: true, confirmText: "清空" });
        if (!ok) return;
      } else if (!confirm(msg)) return;
      try {
        window.TimelineBranch && TimelineBranch.resetAll();
      } catch (e) {
      }
      try {
        window.GameLayer && GameLayer.resetAll();
      } catch (e) {
      }
      try {
        window.ReaderLetters && ReaderLetters.resetAll();
      } catch (e) {
      }
      load(state.genre);
      save();
      renderTab();
    },
    /** v3.18.1 新书重置（storyFramework.clearSave 调用，无确认弹窗——清档已确认过）：
     *  清空当前书档的沉浸数据（人物志/藏宝阁/编年史/战报/传书/天象…），
     *  内存态与槽位键一并清空，界面态（genre/open/tab）保留。
     *  旧版 imm_{genre} 不随清档重置——重新开篇后新书残留上一本书的角色（用户反馈）。 */
    resetForNewStory() {
      if (!state.genre) return;
      const keep = { genre: state.genre, open: state.open, tab: state.tab };
      try {
        MoStore.removeItem(skey());
      } catch (e) {
      }
      try {
        delete store[skey()];
      } catch (e) {
      }
      Object.assign(state, {
        gallery: {},
        items: [],
        events: [],
        letters: [],
        highlights: [],
        battles: [],
        titles: [],
        chronicle: [],
        tensions: [],
        realmIdx: 0,
        realmRaw: "",
        time: null,
        weather: null,
        day: null
      }, keep);
      save();
      if ($("immDrawerMount")) {
        try {
          renderTab();
        } catch (e) {
        }
      }
    },
    themes: THEMES
  };
  function applyVertical(on) {
    try {
      document.body.classList.toggle("imm-vertical", !!on);
    } catch (e) {
    }
  }
  return ImmersiveSuite2;
}();
window.ImmersiveSuite = ImmersiveSuite;
(function autoMountDoor() {
  const go = () => {
    try {
      ImmersiveSuite.init();
    } catch (e) {
      console.warn("[Immersive] 门自动挂载失败:", e.message);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
(function bootAmbience() {
  const go = () => {
    try {
      const g = window.storyFramework && storyFramework.config && storyFramework.config.genreKey;
      window.AmbienceLayer && AmbienceLayer.init(g);
    } catch (e) {
    }
    try {
      if (MoStore.getItem("immVertical") === "on") document.body.classList.add("imm-vertical");
    } catch (e) {
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
