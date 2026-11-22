/**
 * 云境 · 境界阶梯人工审定表（v1.0.0，v6.3.7）
 * ---------------------------------------------------------------------------
 * 数据来源：各世界 config 的「原著骨架速查表」境界章节，逐条人工对照原著钉死。
 * 本表是「原著设定钉死」的权威结构化锚：tiers 为主修炼阶梯顺序（低→高），
 * peaks 为原著明示的极境/特殊节点，crossAllow 为该世界观下顶级天骄可越境档数基调。
 * 说明：
 *  - tiers 只收「主修炼/力量阶梯」，副体系（炼药、符师、妖魔、职业等）保留在 canonText 供 AI 参考，不混入比对主轴。
 *  - realmMode:'none' 的创作/现实世界不做境界比对，只走属性钳制。
 *  - energy 由生成器按序号归一化到 0-100；有明确数值档的世界另存 numericNote。
 *  - 玩家自创体系 / 破例由 compare-engine 在本表基础上叠加比对，不改动本表。
 */
export const LADDERS = {
  chaoshenxueyuan: {
    name: '超神学院', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['凡人', '第一代超级战士', '第二代超级战士', '第三代超级战士·准神', '神体', '神圣之躯·凯莎'],
    peaks: ['神圣之躯·凯莎'],
    numericNote: '三代战士为现代基因造神，代差即战力差'
  },
  cthulhu: { name: '克苏鲁', mode: 'creation', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  daoguiyixian: {
    name: '道诡异仙', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['凡人', '学法', '得法', '底轮', '腹轮', '脐轮', '幻海·胸轮', '心轮', '喉轮', '顶轮', '司命'],
    peaks: ['顶轮·司命'],
    numericNote: '修真七轮为斗姥所传；坐忘道修假/斩三尸为并行体系，见 canon'
  },
  dazhuzai: {
    name: '大主宰', mode: 'roleplay', realmMode: 'ladder', crossAllow: 3,
    tiers: ['感应境', '灵动境', '灵轮境', '神魄境', '融天境', '化天境', '通天境', '至尊小三难', '至尊境', '地至尊', '天至尊', '主宰境'],
    peaks: ['大圆满地至尊·准天至尊', '圣品天至尊'],
    numericNote: '至尊分一至九品；本表以大境为 tier，品级见 canon'
  },
  dibao: {
    name: '盗墓', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['叩宫', '拓疆', '蕴体', '辟宫', '壮寿', '真命', '华盖', '涅浴', '天元', '育神', '玄命·王侯', '摘星·真人', '古圣', '圣尊', '圣皇', '大贤', '神王', '神皇', '仙帝'],
    peaks: ['十三宫·破极之宫', '十三真我苍天', '仙帝'],
    numericNote: '命宫数与天命数即天堑；九宫为极、十三宫万古唯一'
  },
  ditandali: {
    name: '大地铁犁', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['黑铁', '青铜', '白银', '黄金', '铂金', '钻石', '星耀', '道天', '超凡·破星', '行星毁灭级', '吞星级', '寰宇境·主宰境'],
    peaks: ['超凡·破星'],
    numericNote: '每大阶内一至九星为存疑项，正文只报大阶与几星模糊递进'
  },
  douluodalu: {
    name: '斗罗大陆', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['魂士', '魂师', '大魂师', '魂尊', '魂宗', '魂王', '魂帝', '魂圣', '魂斗罗', '封号斗罗', '超级斗罗', '极限斗罗', '百级成神'],
    peaks: ['极限斗罗·99级', '百级成神'],
    numericNote: '魂力1-100级，十级一阶，第N阶N-1个魂环；封号91-94/超级95-98/极限99'
  },
  doupocangqiong: {
    name: '斗破苍穹', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['斗之气', '斗者', '斗师', '大斗师', '斗灵', '斗王', '斗皇', '斗宗', '斗尊', '斗尊巅峰·九转', '半圣', '斗圣', '斗帝'],
    peaks: ['九转斗尊巅峰', '斗圣巅峰·血脉变异', '斗帝'],
    numericNote: '斗之气一至九段、其余每境一至九星；斗圣每星分初中后期；大主宰体系无此半圣阶'
  },
  earth: { name: '地球', mode: 'roleplay', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  fanrenxiuxian: {
    name: '凡人修仙', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['炼气', '筑基', '结丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙', '金仙', '太乙', '大罗', '道祖'],
    peaks: ['炼气十三层', '大乘圆满', '渡劫飞升'],
    numericNote: '炼气一至十三层（唯一按层计）；筑基巅峰假丹、结丹巅峰假婴；每境分初中后大圆满'
  },
  free: { name: '自由创作', mode: 'creation', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  freeworld: { name: '自由世界', mode: 'roleplay', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  guimi: {
    name: '诡秘之主', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['序列9', '序列8', '序列7', '序列6', '序列5', '序列4·半神', '序列3', '序列2', '序列1', '序列0·真神'],
    peaks: ['序列1·天使之王', '序列0·真神', '旧日·诡秘之主'],
    numericNote: '22途径共用序列9→0（数字越小越强）；序列4起为半神；旧日为真神之上'
  },
  guzhenren: {
    name: '古真人', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['一转蛊师', '二转蛊师', '三转蛊师', '四转蛊师', '五转蛊师', '六转蛊仙', '七转蛊仙', '八转蛊仙', '九转蛊尊'],
    peaks: ['五转巅峰·渡劫成仙', '八转·亚仙尊战力', '九转蛊尊·道主'],
    numericNote: '一至五转凡人、六至九转仙；每转分初中高巅峰；仙凡有本质鸿沟'
  },
  jianlai: {
    name: '剑来', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['铜皮', '草根', '柳筋', '骨气', '铸炉', '洞府', '观海', '龙门', '金丹', '元婴', '玉璞', '仙人', '飞升', '十四境·合道', '十五境'],
    peaks: ['龙门·逆行冲关', '十四境·合道', '十五境·三教祖师'],
    numericNote: '练气士十五境为主轴；纯粹武夫九境+止境另计（剑修同境+1境），见 canon'
  },
  limingzhijian: {
    name: '黎明之剑', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['学徒', '一级法师', '二级法师', '三级法师', '四级法师', '五级法师', '六级法师', '七级法师', '八级法师', '九级法师', '传奇', '圣域', '半神', '真神'],
    peaks: ['传奇巅峰', '半神·真神'],
    numericNote: '旧体系靠天赋上限锁死；塞西尔魔导新体系把力量量化（见 canon 副体系）'
  },
  longzu: {
    name: '龙族', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['G·F·E级混血', 'D级混血', 'C级混血', 'B级混血', 'A级混血', 'S级混血', '次代种·亲王', '初代种·君主', '白王·黑王'],
    peaks: ['临界血限·50%', '初代种', '黑王尼德霍格'],
    numericNote: '混血评级看优秀基因含量非血统比例；言灵按序列号（见 canon 副体系）'
  },
  lunhuileyuan: {
    name: '轮回乐园', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶', '七阶', '八阶', '九阶', '绝强者', '至强者', '超脱者'],
    peaks: ['真实属性点·属性壁障', '超脱者'],
    numericNote: '每10级一阶（LV1-10起），等级仅代表权限；主属性49/79/99/149/199须破壁障'
  },
  mystery: { name: '悬疑创作', mode: 'creation', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  quanqiubingfeng: {
    name: '全球冰封', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['阿尔法级', '贝塔级', '伽马级', '德尔塔级', '伊普西隆级', '欧米伽级'],
    peaks: ['伊普西隆级·天灾级', '欧米伽级·无限成长'],
    numericNote: '异人成长性六阶；异能指数十档（士兵级1万→国王级9万+）；本源技能谱作突破里程碑'
  },
  quanzhifashi: {
    name: '全知法师', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['魔法学徒', '初阶·星尘', '中阶·星云', '高阶·星河', '超阶·星海', '禁咒·星宿', '法神'],
    peaks: ['禁咒·星宿', '法神'],
    numericNote: '星子数7→49→343→2401递增；妖魔对应奴仆→战将→统领→君主→帝王'
  },
  quanzhigaoshou: { name: '全职高手', mode: 'roleplay', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  scifi: { name: '科幻创作', mode: 'creation', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  shengxu: {
    name: '圣墟', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['觉醒境', '枷锁境', '逍遥境', '观想境', '餐霞境', '塑形境', '金身境', '亚圣境', '圣者境', '映照级', '神祇级', '神将级', '神王级', '天尊级', '大能级', '大宇级', '究极进化者', '道祖级', '路尽级'],
    peaks: ['枷锁境·五十枷锁全开', '路尽级·楚天帝'],
    numericNote: '场域/异类品级为平行体系，见 canon'
  },
  shenmifusu: {
    name: '神秘复苏', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['未定级·观察级', 'C级·限制级', 'B级·危险级', 'A级·灾难级', 'S级·毁灭级'],
    peaks: ['S级·毁灭级', '鬼域十层·近乎无限折叠'],
    numericNote: '厉鬼危害分级C/B/A/S（非恐怖程度、会升格）；鬼域层数3/5/6/7/8/10为能力标尺'
  },
  shrouding: {
    name: '遮天', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['轮海秘境', '道宫秘境', '四极秘境', '化龙秘境', '仙台秘境', '大帝·证道者', '红尘仙·真仙'],
    peaks: ['仙九·大帝', '另类成道', '自斩一刀的至尊', '大成圣体'],
    numericNote: '仙台九层天：仙一半步大能→仙九大帝；体质为战力标尺（荒古圣体大成可敌大帝）'
  },
  swallowedstar: {
    name: '吞噬星空', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['战士级', '战将级', '战神级', '超越战神级', '行星级', '恒星级', '宇宙级', '域主级', '界主级', '不朽军主', '封侯不朽', '封王不朽', '宇宙尊者', '宇宙霸主', '顶尖宇宙霸主', '宇宙之主', '宇宙最强者·真神', '虚空真神', '永恒真神', '混沌主宰', '神王', '神帝', '半浑源生命体', '浑源生命', '浑源领主'],
    peaks: ['封王无敌', '宇宙霸主·顶尖', '浑源领主'],
    numericNote: '学徒/基础五境/不朽/尊者/之主/最强者/浑源篇分段；每境分阶，武者精神念师同阶不同路'
  },
  wangyou: { name: '网游创作', mode: 'roleplay', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  wanmeishijie: {
    name: '完美世界', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['搬血境', '洞天境', '化灵境', '铭纹境', '列阵境', '尊者境', '神火境', '真一境', '圣祭境', '天神境', '虚道境', '斩我境', '遁一境', '至尊境', '真仙', '仙王', '准仙帝', '仙帝'],
    peaks: ['搬血极境·十万斤', '唯一洞天', '至尊境·无敌者', '仙帝·荒天帝'],
    numericNote: '人道十四境+仙道四境共十八；搬血极境十万斤为原著明示极境'
  },
  wanxiangzhiwang: {
    name: '万象之王', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['十印境', '相师境', '拜将境', '封侯境', '称王境·三冠', '天王境'],
    peaks: ['十柱金台·无双侯', '真九品·虚九品', '万相种·十品'],
    numericNote: '原著以「品」定级非颜色；封侯九品、相性一至九品、虚九品/超九品特殊'
  },
  wudongqiankun: {
    name: '武动乾坤', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['淬体境', '地元境', '天元境', '元丹境', '造形境', '造气境', '造化境', '涅槃境', '生死玄境', '轮回境', '祖境'],
    peaks: ['九转涅槃', '三重轮回劫', '祖境·武祖'],
    numericNote: '符师等级（四印→灵符→天符→仙符→符宗→神宫）为并行精神力体系，见 canon'
  },
  wulianfengdian: {
    name: '武炼巅峰', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['淬体境', '开元境', '气动境', '离合境', '真元境', '神游境', '超凡境', '入圣境', '圣王境', '返虚境', '虚王境', '道源境', '帝尊境', '半步开天', '开天境', '创世境'],
    peaks: ['大帝·凝聚道印', '九品开天', '创世境'],
    numericNote: '乾坤之内九层→三层递进；伪帝/大帝为称谓非境界；开天分一至九品'
  },
  wuxia: { name: '武侠创作', mode: 'creation', realmMode: 'none', crossAllow: 0, tiers: [], peaks: [] },
  xianni: {
    name: '仙逆', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['凝气', '筑基', '结丹', '元婴', '化神', '婴变', '问鼎', '阴虚', '阳实', '窥涅', '净涅', '碎涅', '空涅', '空灵', '空玄', '空劫', '踏天境'],
    peaks: ['碎涅大圆满·破空五指', '空劫·大天尊', '踏天境'],
    numericNote: '修真四步（顺天/逆天/空/踏天）；古神一至九星为并列战力标尺'
  },
  xuanjianxianzu: {
    name: '玄鉴仙族', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['胎息', '练气', '筑基', '紫府·真人', '金丹·真君', '道胎'],
    peaks: ['紫府巅峰·五道神通', '金丹·果位真君', '道胎'],
    numericNote: '修行须灵窍；筑基/真人/果位真君/道胎/仙人逐级碾压，几无以下克上'
  },
  yuanzun: {
    name: '元尊', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['开脉境', '养气境', '天关境', '太初境', '神府境', '天阳境', '源婴境', '法域境', '伪法域', '伪圣', '准神', '圣者境·大尊', '神祇境'],
    peaks: ['三莲圣者', '第一序列之神', '源气九品·混沌源气'],
    numericNote: '源气九品（一品最劣九品最绝）；神祇分三/二/一序列'
  },
  zhanhen: {
    name: '战痕', mode: 'roleplay', realmMode: 'ladder', crossAllow: 1,
    tiers: ['盏境', '池境', '川境', '海境', '无量境', '克莱因境', '伪神', '次神', '主神', '至高神', '半步升维', '升维者'],
    peaks: ['克莱因境·精神力无限循环', '至高神·世界权柄', '升维者'],
    numericNote: '凡人六境以精神力为纲；禁墟序列分级（序号越小越强）为能力标尺'
  },
  zhongshengdushi: {
    name: '重生都市', mode: 'roleplay', realmMode: 'ladder', crossAllow: 2,
    tiers: ['外劲', '内劲', '化境', '神境', '筑基', '通玄', '神海', '先天', '金丹', '元婴', '化神', '返虚', '合道', '渡劫'],
    peaks: ['神境·超凡者', '金丹九品·仙品真形雷劫', '合道真仙'],
    numericNote: '地球武道四境与炼气三小境两阶映照（内劲≈筑基等）；金丹一品最低九品最高'
  }
};

export const LADDER_VERSION = '1.0.0';
