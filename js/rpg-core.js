/* RPG Core v2.2.0 — 网游大世界《寰宇纪元》数值引擎 + 七标签角色面板（v4.06.0）
 *
 * v2.2.0：原三部曲三界（daobanshenhua / zonghengtianxia / tianxiawushuang）合并为
 *     单一 wangyou 大世界。三界不再并列，而是同一款网游《寰宇纪元》的三个服务器分区：
 *     东境·月恒服 / 北境·灵恸服 / 中天·天纵服，合流赛季再开第四区「寰宇中枢·神域」。
 *     新增：十五阶统一品级链、八隐藏职业（含中枢专属召唤师与铭器师）、
 *     分区机制（分区决定第二资源名与品级口头叫法，传送即切换）、
 *     六幕主线（开服→主城→秘境首杀→跨服会战→隐藏职业觉醒→神域终局）。
 *
 * RPG Core v2.1.0 — 网游三部曲数值引擎 + 七标签角色面板（v4.05.0）
 *
 * 复用 WorldExt 模块协议：stats/hud 进常驻状态栏，html 出个人面板，
 * directive 每轮把数值快照送进模型，read 按轮次与变量块结算。
 * 所有数值计算集中在 Engine（纯函数，同输入恒同输出），UI 只负责呈现。
 * 禁止 Math.random，一切随机走 Engine.hash(seed)。
 *
 * v2：任务/成就/商店/传送/战斗日志/Buff/强化/宠物/组队公会/竞技场/快捷栏，
 *     抽屉改为七标签，四态齐备，三界共用 rpg-suite.css（按 theme 变量换肤）。
 * v4.05.0：10 槽装备（掉落轮换/按槽装备/旧装退回）、强化成功率与费用随 +N 变化、
 *     主线条件（等级+击杀+前置幕，与竞技场胜场解耦）、竞技场对手实体与多回合累计伤害/
 *     连胜记录、组队/公会/宠物实体化、技能对确定性野怪结算（金币只来自掉落）、
 *     所有新字段在 normalizeState 补默认值与形状校验（老存档 backfill 不崩）。
 * v4.05.0 收口：免费模型实测发现模型给野怪自编「Lv.2」等级（fakeLevel 检测命中）。
 *     directive 与 ai-message-builder 的 rpgMode 例外同步收紧——野怪/对手的等级与 HP
 *     归引擎「练级目标」管理，正文只写外形与相对强弱，禁止标注具体数字。
 */
(function () {
  "use strict";
  var WR = window.WorldRuntime;
  var DIMS = [
    { k: 'str', n: '力量' }, { k: 'sta', n: '体力' }, { k: 'agi', n: '敏捷' },
    { k: 'int', n: '智力' }, { k: 'tac', n: '策略' }, { k: 'luk', n: '幸运' }
  ];
  var SLOTS = [
    { k: 'weapon', n: '武器', i: '🗡' }, { k: 'helm', n: '头盔', i: '⛑' },
    { k: 'armor', n: '胸甲', i: '🛡' }, { k: 'glove', n: '护手', i: '🧤' },
    { k: 'leg', n: '护腿', i: '🦵' }, { k: 'boot', n: '靴子', i: '👢' },
    { k: 'ring', n: '戒指', i: '💍' }, { k: 'neck', n: '项链', i: '📿' },
    { k: 'cloak', n: '披风', i: '🧥' }, { k: 'mount', n: '坐骑', i: '🐎' }
  ];

  /* ---------------- 职业模板 ---------------- */
  /* growth = 每级四维成长；hpK/mpK/atkK/defK = 职业系数；crit = 基础暴击% */
  var CLASSES = {
    warrior: { n: '剑士／战士', main: 'str', growth: { str: 3.2, sta: 2.6, agi: 1.4, int: 0.8, tac: 0.8, luk: 0.4 }, hpK: 1.25, mpK: 0.65, atkK: 1.15, defK: 1.10, crit: 5, skills: [['slash', '基本斩击', 4, 1, 1.00], ['rage', '狂暴', 9, 3, 1.65], ['clear', '剑荡四方', 16, 4, 2.20]] },
    archer: { n: '弓箭手', main: 'agi', growth: { str: 2.0, sta: 1.7, agi: 3.4, int: 1.3, tac: 1.1, luk: 0.8 }, hpK: 0.95, mpK: 0.85, atkK: 1.10, defK: 0.85, crit: 11, skills: [['shot', '普通射击', 3, 1, 1.00], ['multi', '千刃箭', 10, 3, 1.75], ['pierce', '追魂箭', 17, 4, 2.25]] },
    mage: { n: '法师', main: 'int', growth: { str: 0.9, sta: 1.5, agi: 1.4, int: 3.6, tac: 1.8, luk: 0.6 }, hpK: 0.85, mpK: 1.45, atkK: 1.05, defK: 0.75, crit: 6, skills: [['bolt', '魔法飞弹', 5, 1, 1.05], ['storm', '陨石风暴', 13, 3, 1.90], ['freeze', '冰封千里', 19, 4, 2.30]] },
    priest: { n: '牧师', main: 'int', growth: { str: 1.0, sta: 2.2, agi: 1.2, int: 3.1, tac: 1.6, luk: 0.9 }, hpK: 1.00, mpK: 1.35, atkK: 0.80, defK: 0.95, crit: 4, skills: [['smite', '圣光击', 5, 1, 0.95], ['heal', '圣疗术', 11, 3, 1.20], ['ward', '光明护佑', 15, 4, 1.60]] },
    rogue: { n: '盗贼／刺客', main: 'agi', growth: { str: 2.1, sta: 1.6, agi: 3.5, int: 1.2, tac: 1.4, luk: 1.4 }, hpK: 0.92, mpK: 0.80, atkK: 1.08, defK: 0.80, crit: 16, skills: [['stab', '背刺', 4, 1, 1.05], ['shadow', '潜行', 8, 3, 1.55], ['execute', '斩首', 18, 4, 2.45]] },
    knight: { n: '骑士', main: 'sta', growth: { str: 2.6, sta: 3.5, agi: 1.1, int: 1.0, tac: 1.2, luk: 0.5 }, hpK: 1.45, mpK: 0.70, atkK: 0.95, defK: 1.40, crit: 4, skills: [['bash', '盾击', 5, 1, 0.95], ['guard', '格挡', 8, 3, 0.80], ['charge', '冲锋', 16, 4, 1.90]] },
    beast: { n: '驯兽师', main: 'tac', growth: { str: 1.9, sta: 2.2, agi: 1.8, int: 2.1, tac: 2.6, luk: 1.0 }, hpK: 1.10, mpK: 1.00, atkK: 0.95, defK: 1.00, crit: 7, skills: [['pet', '宠物撕咬', 5, 1, 1.05], ['call', '召唤兽', 12, 3, 1.70], ['rage', '兽群冲锋', 18, 4, 2.10]] },
    tactician: { n: '谋士', main: 'tac', growth: { str: 1.0, sta: 1.6, agi: 1.5, int: 2.8, tac: 3.2, luk: 1.1 }, hpK: 0.92, mpK: 1.25, atkK: 0.90, defK: 0.88, crit: 8, skills: [['plan', '洞察', 4, 1, 1.00], ['ruse', '计策', 11, 3, 1.75], ['command', '名将技·王道', 19, 4, 2.20]] },
    /* 隐藏职业（转职后覆盖基础系数） */
    darkmage: { n: '暗火法师', main: 'int', growth: { str: 1.0, sta: 1.7, agi: 1.5, int: 3.8, tac: 2.0, luk: 0.7 }, hpK: 0.90, mpK: 1.55, atkK: 1.12, defK: 0.80, crit: 8, hidden: true, skills: [['darkbolt', '暗火弹', 6, 1, 1.15], ['flame', '暗焰风暴', 14, 3, 1.95], ['curse', '咒缚', 20, 4, 2.40]] },
    dragonknight: { n: '龙骑士', main: 'str', growth: { str: 3.6, sta: 3.0, agi: 1.6, int: 1.2, tac: 1.2, luk: 0.6 }, hpK: 1.40, mpK: 0.90, atkK: 1.28, defK: 1.22, crit: 8, hidden: true, skills: [['lance', '龙枪突刺', 6, 1, 1.15], ['roar', '龙威', 12, 3, 1.70], ['dragon', '龙骑舞', 20, 4, 2.55]] },
    elemental: { n: '元素弓箭手', main: 'agi', growth: { str: 2.4, sta: 2.0, agi: 4.0, int: 2.4, tac: 1.6, luk: 1.0 }, hpK: 1.00, mpK: 1.15, atkK: 1.24, defK: 0.90, crit: 14, hidden: true, skills: [['arrow', '元素箭', 5, 1, 1.10], ['rain', '千刃箭', 13, 3, 1.85], ['storm', '流星火雨', 20, 4, 2.50]] },
    dragonspeaker: { n: '龙语者', main: 'str', growth: { str: 3.8, sta: 3.2, agi: 2.8, int: 2.6, tac: 2.0, luk: 0.8 }, hpK: 1.30, mpK: 1.20, atkK: 1.38, defK: 1.15, crit: 10, hidden: true, skills: [['bind', '龙缚术', 7, 1, 1.20], ['breath', '龙息', 15, 3, 2.00], ['word', '龙语·终式', 22, 4, 2.70]] },
    deathblade: { n: '死灵剑士／修罗', main: 'str', growth: { str: 3.5, sta: 2.8, agi: 2.6, int: 1.8, tac: 2.2, luk: 1.0 }, hpK: 1.20, mpK: 1.05, atkK: 1.30, defK: 1.05, crit: 12, hidden: true, skills: [['reap', '死亡攫取', 6, 1, 1.15], ['revive', '亡灵再生', 13, 3, 1.80], ['slash', '诛刃', 20, 4, 2.55]] },
    deathmaster: { n: '死亡剑术宗师／神将', main: 'tac', growth: { str: 4.0, sta: 3.2, agi: 3.0, int: 2.4, tac: 3.4, luk: 1.2 }, hpK: 1.35, mpK: 1.30, atkK: 1.45, defK: 1.18, crit: 14, hidden: true, skills: [['blade', '斩龙刃', 8, 1, 1.25], ['seal', '上古符印', 16, 3, 2.10], ['wargod', '武神·轩辕斩', 24, 4, 2.90]] },
    /* v4.06.0 寰宇中枢专属隐藏职业：召唤师（宠物孵化·召唤流）、铭器师（自造武器·词条锻造） */
    summoner: { n: '召唤师', main: 'tac', growth: { str: 0.9, sta: 1.8, agi: 1.6, int: 2.6, tac: 2.8, luk: 1.3 }, hpK: 0.95, mpK: 1.30, atkK: 0.98, defK: 0.86, crit: 9, hidden: true, skills: [['summon', '召唤兽灵', 6, 1, 1.10], ['whorl', '万灵同调', 13, 3, 1.85], ['chaos', '混沌领域', 21, 4, 2.45]] },
    artificer: { n: '铭器师', main: 'int', growth: { str: 1.6, sta: 2.0, agi: 1.5, int: 3.2, tac: 2.4, luk: 1.0 }, hpK: 1.05, mpK: 1.15, atkK: 1.02, defK: 1.00, crit: 7, hidden: true, skills: [['forge', '铭纹', 6, 1, 1.15], ['rune', '词条共鸣', 14, 3, 1.95], ['legend', '万物归炉', 22, 4, 2.55]] },
    /* v4.07.0 原创隐藏职业（12 个，在三部曲八职业之外全新原创）
       设计口径：每区 2~3 个，解锁条件不再只有等级——声望、击杀、竞技场胜场、行会贡献各自成门槛，
       逼玩家用不同的方式去「挣」一个隐藏职业，而不是等级够了就白送。 */
    dreamweaver: { n: '织梦人', main: 'int', growth: { str: 0.8, sta: 1.6, agi: 1.6, int: 3.5, tac: 1.6, luk: 3.0 }, hpK: 0.92, mpK: 1.52, atkK: 1.06, defK: 0.82, crit: 8, hidden: true, skills: [['dream', '织梦', 8, 2, 1.30], ['phantasm', '幻象军团', 16, 4, 1.85], ['weave', '织梦者终式', 26, 6, 2.40]] },
    shadewalker: { n: '拾影者', main: 'agi', growth: { str: 1.2, sta: 1.4, agi: 3.4, int: 2.8, tac: 1.4, luk: 2.0 }, hpK: 0.95, mpK: 1.24, atkK: 1.14, defK: 0.88, crit: 13, hidden: true, skills: [['drain', '摄影', 7, 2, 1.25], ['vanish', '遁影', 12, 3, 1.70], ['steal', '窃法', 22, 5, 2.30]] },
    stargazer: { n: '观星者', main: 'int', growth: { str: 0.7, sta: 1.4, agi: 1.2, int: 3.8, tac: 1.5, luk: 2.8 }, hpK: 0.88, mpK: 1.58, atkK: 1.02, defK: 0.80, crit: 7, hidden: true, skills: [['scry', '观星', 9, 2, 1.20], ['forecast', '预判', 14, 3, 1.65], ['fall', '星陨', 24, 5, 2.35]] },
    windward: { n: '逐风者', main: 'agi', growth: { str: 1.8, sta: 1.6, agi: 3.6, int: 1.2, tac: 1.2, luk: 1.8 }, hpK: 0.98, mpK: 1.16, atkK: 1.16, defK: 0.90, crit: 15, hidden: true, skills: [['gust', '起风', 5, 1, 1.10], ['dash', '逐风步', 9, 2, 1.60], ['cyclone', '风眼', 20, 4, 2.30]] },
    oathkeeper: { n: '恒誓者', main: 'str', growth: { str: 3.4, sta: 3.4, agi: 1.0, int: 0.9, tac: 2.0, luk: 1.2 }, hpK: 1.38, mpK: 0.72, atkK: 1.24, defK: 1.28, crit: 6, hidden: true, skills: [['swear', '立誓', 10, 2, 1.35], ['bloodpact', '血契', 15, 3, 1.90], ['lastoath', '终誓', 25, 5, 2.45]] },
    soulrender: { n: '噬魂者', main: 'str', growth: { str: 3.2, sta: 2.0, agi: 2.0, int: 2.6, tac: 1.8, luk: 1.6 }, hpK: 1.10, mpK: 1.08, atkK: 1.28, defK: 1.04, crit: 13, hidden: true, skills: [['soulrend', '裂魂', 9, 2, 1.30], ['devour', '噬魂', 14, 3, 1.80], ['reaper', '收割魂魄', 24, 5, 2.40]] },
    relicsmith: { n: '器灵师', main: 'int', growth: { str: 2.2, sta: 2.6, agi: 1.2, int: 3.0, tac: 2.2, luk: 1.4 }, hpK: 1.18, mpK: 1.12, atkK: 1.10, defK: 1.16, crit: 6, hidden: true, skills: [['spiritforge', '启灵', 11, 3, 1.25], ['temper', '淬炼', 16, 4, 1.70], ['awaken', '器灵觉醒', 26, 6, 2.35]] },
    umbral: { n: '影行者', main: 'agi', growth: { str: 2.0, sta: 1.5, agi: 3.5, int: 2.0, tac: 1.6, luk: 2.0 }, hpK: 0.96, mpK: 1.22, atkK: 1.22, defK: 0.92, crit: 14, hidden: true, skills: [['shadowstep', '影步', 6, 1, 1.20], ['eclipse', '蔽日', 12, 3, 1.75], ['nightfall', '永夜', 23, 5, 2.40]] },
    resonant: { n: '音刃者', main: 'int', growth: { str: 1.8, sta: 1.8, agi: 2.8, int: 3.2, tac: 1.6, luk: 1.8 }, hpK: 0.97, mpK: 1.34, atkK: 1.18, defK: 0.94, crit: 11, hidden: true, skills: [['note', '音刃', 8, 2, 1.25], ['resonate', '共振', 13, 3, 1.75], ['dirge', '哀鸣', 24, 5, 2.38]] },
    returner: { n: '归墟行者', main: 'sta', growth: { str: 2.6, sta: 3.2, agi: 1.8, int: 2.4, tac: 1.8, luk: 2.0 }, hpK: 1.26, mpK: 1.18, atkK: 1.26, defK: 1.18, crit: 10, hidden: true, skills: [['recall', '归墟', 12, 3, 1.30], ['reborn', '复生', 18, 4, 1.80], ['eternal', '永恒归返', 28, 6, 2.45]] },
    lumenwright: { n: '灵枢使', main: 'tac', growth: { str: 1.0, sta: 1.8, agi: 1.4, int: 3.4, tac: 3.0, luk: 1.6 }, hpK: 1.02, mpK: 1.42, atkK: 1.12, defK: 1.06, crit: 8, hidden: true, skills: [['link', '灵枢链接', 13, 3, 1.25], ['hub', '枢纽编织', 17, 4, 1.72], ['singular', '万流归一', 27, 6, 2.36]] },
    soulforge: { n: '铸魂者', main: 'int', growth: { str: 3.0, sta: 2.4, agi: 1.2, int: 3.2, tac: 2.4, luk: 1.4 }, hpK: 1.20, mpK: 1.24, atkK: 1.30, defK: 1.12, crit: 9, hidden: true, skills: [['soulcraft', '铸魂', 14, 3, 1.30], ['reforge', '重铸', 19, 4, 1.82], ['ascend', '魂器升格', 29, 6, 2.48]] }
  };

  /* ---------------- 三界配置 ---------------- */
  var WORLD = {
    /* v4.06.0：网游三部曲三界合并为「寰宇纪元」网游大世界。
       三大分区（东境·月恒服 / 北境·灵恸服 / 中天·天纵服）是同一款网游的三个服务器区，
       第四区「寰宇中枢·神域」是合流赛季开放的跨服顶层区域。
       分区决定三件事：装备品级口头叫法、第二资源名、可用隐藏职业。 */
    wangyou: {
      game: '寰宇纪元', hero: '林凡', hid: '青菜白玉汤', startMap: '新手村 · 野狼谷',
      classes: ['warrior', 'archer', 'mage', 'priest', 'rogue', 'knight', 'beast', 'tactician'],
      /* v4.07.0 隐藏职业扩到 20 个：三部曲原有 8 个全部保留（门槛不变），
         另加 12 个全新原创职业。解锁条件从「只看等级」扩展为多维门槛：
         lv 等级 / kills 击杀 / rep 声望 / arena 竞技场胜场 / contrib 行会贡献。
         每个分区都有专属隐藏职业，逼玩家在本区扎根才能吃到本地红利。 */
      hidden: [
        /* —— 三部曲原有 8 个（设定与门槛原样保留）—— */
        { id: 'darkmage', lv: 12, n: '暗火法师', zone: 'dy', req: { lv: 12 } },
        { id: 'dragonknight', lv: 16, n: '龙骑士', zone: 'dy', req: { lv: 16, kills: 60 } },
        { id: 'elemental', lv: 12, n: '元素弓箭手', zone: 'by', req: { lv: 12 } },
        { id: 'dragonspeaker', lv: 16, n: '龙语者', zone: 'by', req: { lv: 16, rep: 80 } },
        { id: 'deathblade', lv: 12, n: '死灵剑士／修罗', zone: 'zt', req: { lv: 12 } },
        { id: 'deathmaster', lv: 18, n: '死亡剑术宗师／神将', zone: 'zt', req: { lv: 18, kills: 250 } },
        { id: 'summoner', lv: 20, n: '召唤师', zone: 'zy', req: { lv: 20, rep: 350 } },
        { id: 'artificer', lv: 22, n: '铭器师', zone: 'zy', req: { lv: 22, contrib: 100 } },
        /* —— v4.07.0 全新原创 12 个 —— */
        { id: 'dreamweaver', lv: 14, n: '织梦人', zone: 'dy', req: { lv: 14, rep: 120 }, origin: '原创' },
        { id: 'oathkeeper', lv: 20, n: '恒誓者', zone: 'dy', req: { lv: 20, contrib: 60 }, origin: '原创' },
        { id: 'shadewalker', lv: 14, n: '拾影者', zone: 'by', req: { lv: 14, kills: 120 }, origin: '原创' },
        { id: 'windward', lv: 18, n: '逐风者', zone: 'zy', req: { lv: 18, rep: 250 }, origin: '原创' },
        { id: 'umbral', lv: 22, n: '影行者', zone: 'by', req: { lv: 22, rep: 400 }, origin: '原创' },
        { id: 'resonant', lv: 24, n: '音刃者', zone: 'by', req: { lv: 24, arena: 8 }, origin: '原创' },
        { id: 'stargazer', lv: 18, n: '观星者', zone: 'zt', req: { lv: 18, kills: 200, rep: 200 }, origin: '原创' },
        { id: 'soulrender', lv: 22, n: '噬魂者', zone: 'zt', req: { lv: 22, kills: 400 }, origin: '原创' },
        { id: 'returner', lv: 26, n: '归墟行者', zone: 'zt', req: { lv: 26, rep: 700 }, origin: '原创' },
        { id: 'relicsmith', lv: 24, n: '器灵师', zone: 'zy', req: { lv: 24, contrib: 150 }, origin: '原创' },
        { id: 'lumenwright', lv: 28, n: '灵枢使', zone: 'zy', req: { lv: 28, rep: 1000, arena: 15 }, origin: '原创' },
        { id: 'soulforge', lv: 30, n: '铸魂者', zone: 'zy', req: { lv: 30, rep: 1500, contrib: 300 }, origin: '原创' }
      ],
      tiers: ['白装', '绿装', '蓝装', '紫装', '黑铁器', '青铜器', '玄铁器', '白银器', '黄金器', '暗金器', '灵器', '鬼器', '仙器', '圣器', '旷世圣器', '神装'],
      starter: { n: '新手木剑', tier: '白装', atk: 16, str: 6, sta: 5 },
      loot: [
        ['新手木剑', '白装', 1], ['松木林巨剑', '绿装', 8], ['守墓人戒指', '蓝装', 15], ['赤银剑', '紫装', 23],
        ['玄铁战盔', '黑铁器', 31], ['青铜长枪', '青铜器', 39], ['白银披风', '白银器', 47], ['黄金王者弓', '黄金器', 55],
        ['骨灵之戒', '暗金器', 63], ['追魂之弓', '灵器', 71], ['北冥剑', '仙器', 79], ['月神链', '圣器', 87],
        ['冰川壁垒', '旷世圣器', 93], ['帝海盾', '神装', 97]
      ],
      cur: '金币', res: '怒气',
      /* v4.07.0 势力表：42 个行会/工作室按三大区 + 中枢归档，供动态委托取委托人、
         也供「玩家创建势力」时的同类参照。每条含驻地（舆图可落点）。 */
      factions: [
        { n: '青菜家族', zone: 'dy', seat: '新手村 · 野狼谷' },
        { n: '失乐园', zone: 'dy', seat: '暮光城 · 浅水沼泽' },
        { n: '剑与玫瑰', zone: 'dy', seat: '银月城 · 城郊' },
        { n: '风流天下', zone: 'dy', seat: '疾风城 · 竞技场' },
        { n: 'TOT魔兽战队', zone: 'dy', seat: '连云城 · 血战台' },
        { n: '中国区', zone: 'dy', seat: '荣耀主城 · 领地' },
        { n: '雪月工作室', zone: 'dy', seat: '松木林 · 巨剑台' },
        { n: '梦回雪月', zone: 'dy', seat: '瘟疫墓地 · 试炼场' },
        { n: '傲世', zone: 'dy', seat: '龙域 · 高地' },
        { n: '血饮', zone: 'dy', seat: '恶狼岭 · 伏击带' },
        { n: '似水年华', zone: 'dy', seat: '恐惧墓穴 · 墓道' },
        { n: '兄弟会', zone: 'dy', seat: '荣耀主城 · 领地' },
        { n: '魂归战袍', zone: 'dy', seat: '白马平原 · 国战' },
        { n: '香草加冰', zone: 'dy', seat: '帝海 · 城关' },
        { n: '蓝星', zone: 'dy', seat: '新手村 · 野狼谷' },
        { n: '月恒公司', zone: 'dy', seat: '荣耀主城 · 领地' },
        { n: '霜云工作室', zone: 'dy', seat: '松木林 · 巨剑台' },
        { n: '雪月行会', zone: 'by', seat: '白云城 · 冰原' },
        { n: '天下行会', zone: 'by', seat: '王者之都 · 要塞' },
        { n: '永恒行会', zone: 'by', seat: '羽月废墟 · 浮冰台' },
        { n: '剑火', zone: 'by', seat: '龙语冰川 · 裂隙' },
        { n: '飞火', zone: 'by', seat: '浮雷古刹 · 雷阵' },
        { n: '雪银杉', zone: 'by', seat: '白云城 · 冰原' },
        { n: '烛龙', zone: 'by', seat: '羽月废墟 · 浮冰台' },
        { n: '战天盟', zone: 'by', seat: '王者之都 · 要塞' },
        { n: '灭神', zone: 'by', seat: '龙语冰川 · 裂隙' },
        { n: '花间派', zone: 'by', seat: '浮雷古刹 · 雷阵' },
        { n: '天涯海阁', zone: 'by', seat: '帝海 · 城关' },
        { n: '聚义轩', zone: 'by', seat: '暮光城 · 浅水沼泽' },
        { n: '古剑魂梦', zone: 'zt', seat: '轩辕 · 神兵冢' },
        { n: '血色佣兵', zone: 'zt', seat: '天空之城 · 果林地' },
        { n: '保护伞', zone: 'zt', seat: '毒蜂林 · 蜂巢' },
        { n: '君临', zone: 'zt', seat: '天空之城 · 果林地' },
        { n: '血舞风华', zone: 'zt', seat: '毒蜂林 · 蜂巢' },
        { n: '联想俱乐部', zone: 'zt', seat: '白马平原 · 国战' },
        { n: '苹果俱乐部', zone: 'zt', seat: '帝海 · 城关' },
        { n: '华硕俱乐部', zone: 'zt', seat: '轩辕 · 神兵冢' },
        { n: '寰宇行会', zone: 'zy', seat: '寰宇中枢 · 赛季广场' },
        { n: '战盟议会', zone: 'zy', seat: '跨服战场 · 深渊前线' },
        { n: '赛季仲裁庭', zone: 'zy', seat: '寰宇中枢 · 赛季广场' },
        { n: '万界商会', zone: 'zy', seat: '帝海 · 城关' },
        { n: '归途商会', zone: 'zy', seat: '王者之都 · 要塞' }
      ],
      /* 怪物库：按分区分化，取名字用时由委托系统按局势与种子选取 */
      monsters: [
        '霜狼', '荒原巨熊', '穴居盗', '拦路匪', '疫化兽', '叛军斥候', '虚空游魂', '冰甲兽', '怨灵',
        '黑雾蛛', '食腐鸦群', '泥沼鳄', '骨甲兵', '风行豹', '沙丘蝎', '血藤妖',
        '雷纹隼', '冰晶巨兽', '龙裔幼龙', '霜女妖', '雪线狼王', '寒铁傀儡', '龙语使徒', '雪原巨鹰',
        '剑冢残魂', '果林树妖', '蜂后', '神兵卫', '雷阵守卫', '国战先锋', '海疆鲨王', '古剑灵',
        '赛季守卫', '跨服魔将', '虚空先锋', '王者之影', '寰宇巨兽', '仲裁之光'
      ],
      /* 材料库：采集/锻造委托的标的物 */
      materials: [
        '兽皮', '玄铁矿石', '商队凭证', '净心草', '军令残页', '虚空结晶', '霜纹晶', '净咒符',
        '粗糙狼牙', '松木原木', '守墓人骨戒', '赤银锭', '玄铁碎料', '青铜锈片', '白银矿砂',
        '黄金砂', '暗金残片', '灵晶碎屑', '鬼面皮', '仙鹤羽', '圣辉结晶', '旷世神铁', '龙鳞碎片'
      ],
      /* 四大分区：id / 全名 / 简称 / 第二资源 / 品级叫法 / 说明 */
      zones: [
        { id: 'dy', n: '东境 · 月恒服', short: '东境', res: '怒气', tierNote: '绿色装备→蓝色装备→紫色装备→圣器→神器', note: '人口最多、行会垄断最重、品级链最短；中国区主城群是全球战主战场。' },
        { id: 'by', n: '北境 · 灵恸服', short: '北境', res: '魔法值', tierNote: '粗糙品→白色装→黑铁器→青铜器→白银器→黄金器→暗金器→旷世圣器→神器', note: '冰原与龙域地貌、品级链最长；元素弓箭手与龙语者的祖地。' },
        { id: 'zt', n: '中天 · 天纵服', short: '中天', res: '神力值', tierNote: '白色→黑石器→青铜器→玄铁器→白银器→黄金器→暗金器→灵器→仙器→圣器→神装', note: '浮空岛地貌与神兵冢；竞技场、名将对战与国战节奏最快。' },
        { id: 'zy', n: '寰宇中枢 · 神域', short: '中枢', res: '寰宇能', tierNote: '跨服通用链：白装→…→旷世圣器→神装', note: '合流赛季开放的顶层区域；跨服战场、世界首领总巢、战盟争霸与王者权杖终局。' }
      ],
      /* 地图 → 分区映射：传送后分区随之改变，第二资源与品级叫法同步切换 */
      maps: [
        '新手村 · 野狼谷', '松木林 · 巨剑台', '瘟疫墓地 · 试炼场', '银月城 · 城郊',
        '疾风城 · 竞技场', '连云城 · 血战台', '荣耀主城 · 领地', '龙域 · 高地',
        '暮光城 · 浅水沼泽', '白云城 · 冰原', '恶狼岭 · 伏击带', '恐惧墓穴 · 墓道',
        '羽月废墟 · 浮冰台', '龙语冰川 · 裂隙', '王者之都 · 要塞',
        '天空之城 · 果林地', '毒蜂林 · 蜂巢', '浮雷古刹 · 雷阵', '白马平原 · 国战',
        '帝海 · 城关', '轩辕 · 神兵冢',
        '寰宇中枢 · 赛季广场', '跨服战场 · 深渊前线', '世界首领 · 总巢'
      ],
      zoneOf: {
        '新手村 · 野狼谷': 'dy', '松木林 · 巨剑台': 'dy', '瘟疫墓地 · 试炼场': 'dy', '银月城 · 城郊': 'dy',
        '疾风城 · 竞技场': 'dy', '连云城 · 血战台': 'dy', '荣耀主城 · 领地': 'dy', '龙域 · 高地': 'dy',
        '暮光城 · 浅水沼泽': 'by', '白云城 · 冰原': 'by', '恶狼岭 · 伏击带': 'by', '恐惧墓穴 · 墓道': 'by',
        '羽月废墟 · 浮冰台': 'by', '龙语冰川 · 裂隙': 'by', '王者之都 · 要塞': 'by',
        '天空之城 · 果林地': 'zt', '毒蜂林 · 蜂巢': 'zt', '浮雷古刹 · 雷阵': 'zt', '白马平原 · 国战': 'zt',
        '帝海 · 城关': 'zt', '轩辕 · 神兵冢': 'zt',
        '寰宇中枢 · 赛季广场': 'zy', '跨服战场 · 深渊前线': 'zy', '世界首领 · 总巢': 'zy'
      },
      guildName: '寰宇行会', petName: '灵狼'
    }
  };

  /* ---------------- 商店 / Buff / 成就 / 主线 / 标签（确定性常量） ---------------- */
  var SHOP = [
    { k: 'hp', n: '生命药水', i: '🧪', price: 20, desc: '回复 40% HP' },
    { k: 'mp', n: '魔法药水', i: '🔵', price: 16, desc: '回复 40% MP' },
    { k: 'buff', n: '力量药剂', i: '⚗️', price: 35, desc: '攻击 +18 / 3 回合' }
  ];
  var BUFFS = {
    atk: { id: 'atk', n: '力量祝福', i: '⚔️', atk: 18, def: 0, turns: 3, kind: 'buff' },
    guard: { id: 'guard', n: '铁壁护佑', i: '🛡️', atk: 0, def: 14, turns: 3, kind: 'buff' },
    curse: { id: 'curse', n: '虚弱诅咒', i: '💀', atk: -10, def: -8, turns: 2, kind: 'debuff' }
  };
  var ACHS = [
    { id: 'firstblood', n: '第一滴血', i: '🩸', cond: '完成 1 次掉落', gold: 30, rep: 5, test: function (s) { return (Number(s.kills) || 0) >= 1; } },
    { id: 'slayer10', n: '十连斩', i: '⚔️', cond: '累计 10 次掉落', gold: 80, rep: 15, test: function (s) { return (Number(s.kills) || 0) >= 10; } },
    { id: 'lv10', n: '崭露头角', i: '🎖️', cond: '达到 Lv.10', gold: 50, rep: 10, test: function (s) { return (Number(s.lv) || 1) >= 10; } },
    { id: 'lv30', n: '一方高手', i: '🏆', cond: '达到 Lv.30', gold: 120, rep: 30, test: function (s) { return (Number(s.lv) || 1) >= 30; } },
    { id: 'epic', n: '紫装加身', i: '🟣', cond: '穿戴品级≥第 3 阶', gold: 60, rep: 12, test: function (s, w) { var best = 0; Object.keys(s.equip || {}).forEach(function (k) { var e = s.equip[k]; if (e && e.tier) { var i = w.tiers.indexOf(e.tier); if (i > best) best = i; } }); return best >= 2; } },
    { id: 'pk3', n: '竞技新星', i: '🥇', cond: '竞技场胜 3 场', gold: 90, rep: 20, test: function (s) { return (Number(s.arenaWins) || 0) >= 3; } }
  ];
  /* 主线三幕：优先读 quest-chain.js 的 arcs，缺失时用同数据兜底 */
  var QUEST_FALLBACK = {
    /* v4.06.0：合并三部曲九条主线为大世界六幕主线——开服→主城→秘境→跨服→觉醒→终局 */
    wangyou: {
      title: '寰宇纪元 · 从新手谷到王者权杖',
      st: [
        ['开服 · 新手谷', '完成一次转正'],
        ['主城立足', '拿下第一片驻地'],
        ['秘境首杀', '完成一次世界首领击杀'],
        ['跨服会战', '赢下一场跨服战场'],
        ['隐藏职业觉醒', '通过隐藏职业认证'],
        ['神域终局', '守住或夺取王者权杖']
      ]
    }
  };
  function questArc(g) {
    try { var a = window.QuestChain && window.QuestChain.arcs && window.QuestChain.arcs[g]; if (a && a.st && a.st.length) return a; } catch (e) {}
    return QUEST_FALLBACK[g] || QUEST_FALLBACK.wangyou;
  }
  var TABS = [
    ['role', '🎮', '角色'], ['bag', '🎒', '背包'], ['skill', '✨', '技能'],
    ['quest', '🧭', '任务'], ['map', '📍', '地图'], ['social', '👥', '社交'], ['battle', '⚔️', '战斗']
  ];

  /* ---------------- 数值引擎（纯函数，同输入恒同输出） ---------------- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function expToNext(lv) { return Math.round(62 * Math.pow(Math.max(1, lv), 1.32)); }
  function equipSum(equip) {
    var o = {};
    Object.keys(equip || {}).forEach(function (k) {
      var e = equip[k]; if (!e || typeof e !== 'object') return;
      Object.keys(e).forEach(function (f) {
        /* n/tier/lv/slot/enh 均为装备元数据（名字/品级/强化等级/槽位），不参与数值汇总 */
        if (f === 'n' || f === 'tier' || f === 'lv' || f === 'slot' || f === 'enh') return;
        o[f] = (Number(o[f]) || 0) + (Number(e[f]) || 0);
      });
    });
    return o;
  }
  function derive(st) {
    var c = CLASSES[st.cls] || CLASSES.warrior, lv = Number(st.lv) || 1;
    var e = equipSum(st.equip), attr = {}, i;
    for (i = 0; i < DIMS.length; i++) {
      var k = DIMS[i].k;
      attr[k] = (Number(st.base[k]) || 0) + Math.floor(lv * (c.growth[k] || 0)) + (Number(e[k]) || 0);
    }
    var maxHp = Math.round((100 + lv * 18 + attr.sta * 12 + (Number(e.hp) || 0)) * c.hpK);
    var maxMp = Math.round((50 + lv * 7 + attr.int * 9 + (Number(e.mp) || 0)) * c.mpK);
    var atk = Math.round((attr.str * 2.2 + attr.tac * 1.1 + lv * 3 + (Number(e.atk) || 0)) * c.atkK);
    var def = Math.round((attr.sta * 1.4 + lv * 1.6 + (Number(e.def) || 0)) * c.defK);
    var mdef = Math.round(attr.int * 1.2 + lv * 1.2 + (Number(e.mdef) || 0));
    var crit = Math.min(60, c.crit + attr.agi * 0.12 + attr.luk * 0.10 + (Number(e.crit) || 0));
    var spd = Math.round(100 + attr.agi * 0.6 + (Number(e.spd) || 0));
    /* 增益/减益、组队、宠物——确定性叠加，影响攻击或防御 */
    var ba = 0, bd = 0;
    if (Array.isArray(st.buffs)) for (i = 0; i < st.buffs.length; i++) { ba += Number(st.buffs[i].atk) || 0; bd += Number(st.buffs[i].def) || 0; }
    var psz = Math.max(1, Number(st.party && st.party.size) || 1);
    ba += (psz - 1) * 3; bd += (psz - 1) * 2;
    if (st.pet && st.pet.active) ba += 2 + Math.floor((Number(st.pet.growth) || 0) * 0.5);
    atk = Math.max(1, Math.round(atk + ba));
    def = Math.max(0, Math.round(def + bd));
    return { attr: attr, maxHp: maxHp, maxMp: maxMp, atk: atk, def: def, mdef: mdef, crit: Math.round(crit * 10) / 10, spd: spd };
  }
  /* 确定性伤害：同一 (seed) 恒得同一结果，便于单测与复现 */
  function damage(atk, foeDef, mult, critRate, seed) {
    var raw = Math.max(1, Math.round(atk * mult - (Number(foeDef) || 0) * 0.55));
    var roll = hash(seed) % 1000;
    var crit = roll < Math.round((Number(critRate) || 0) * 10);
    return { value: crit ? Math.round(raw * 1.6) : raw, crit: crit };
  }
  /* 确定性经验/升级结算 */
  function gainExp(st, n) {
    var lv = Number(st.lv) || 1, exp = (Number(st.exp) || 0) + Math.max(0, Math.round(Number(n) || 0));
    var ups = 0, guard = 0;
    while (exp >= expToNext(lv) && guard++ < 200) { exp -= expToNext(lv); lv++; ups++; }
    return { lv: lv, exp: exp, ups: ups, points: ups * 5 };
  }
  function makeEquip(name, tier, lv) {
    return { n: name, tier: tier, atk: Math.round(12 + lv * 2.4), str: Math.round(lv * 0.5), sta: Math.round(lv * 0.4), def: Math.round(lv * 0.8), hp: lv * 10, crit: Math.round(lv * 0.1) };
  }

  /* ---------------- v4.05.0 确定性实体与数值公式（纯函数，禁止 Math.random） ---------------- */
  /* 按槽位生成掉落物：slot 决定归属槽，lv 为强化等级（初始 +0）。数值口径与 makeEquip 一致。
     equipSum 会忽略 slot/lv 元数据，故多槽汇总不会把槽位名/强化等级误加成 NaN。 */
  function makeEquipFor(slot, name, tier, lv) {
    var e = makeEquip(name, tier, lv);
    e.slot = slot; e.lv = 0;
    return e;
  }
  function slotNameOf(k) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].k === k) return SLOTS[i].n;
    return '武器';
  }
  /* 装备展示名：强化 +N 时把等级拼到名字后（名字本身保持干净，便于掉落/出售文案复用） */
  function equipLabel(e) {
    if (!e || typeof e !== 'object') return '';
    var n = String(e.n || ''), lv = Math.max(0, Math.round(Number(e.lv) || 0));
    return n + (lv > 0 ? ' +' + lv : '');
  }
  /* 强化成功率：随当前强化等级 +N 递减，公式 70 − N×8（%），下限 15。 */
  function enhanceRate(enhLv) {
    var n = Math.max(0, Math.round(Number(enhLv) || 0));
    return Math.max(15, 70 - n * 8);
  }
  /* 强化费用：随角色等级与当前强化等级共同上涨（30 + 2×Lv + 12×N）。 */
  function enhanceCost(lv, enhLv) {
    var L = Math.max(1, Math.round(Number(lv) || 1)), n = Math.max(0, Math.round(Number(enhLv) || 0));
    return 30 + L * 2 + n * 12;
  }
  /* 主线每幕阈值：用幕数索引确定性定义，与竞技场胜场完全解耦。
     第 1 幕为新手引导（Lv.1 / 击杀 0），其后每幕 +4 级 / +3 击杀。 */
  function questNeed(i, arcLen) {
    var a = Math.max(0, Math.round(Number(i) || 0));
    var len = Math.max(1, Math.round(Number(arcLen) || 3));
    /* v4.06.0：主线从三幕扩到六幕后，原「每幕 +4 级 / +3 杀」会让第六幕要到 Lv.21，
       正常游玩长度内永远拿不到。按幕数摊平：3 幕时完全等价原值（+4/+3），6 幕时降为 +3/+2。 */
    var lvStep = Math.max(2, Math.min(4, Math.floor(20 / len)));
    var killStep = Math.max(1, Math.min(3, Math.floor(15 / len)));
    return { lv: 1 + a * lvStep, kills: a * killStep };
  }
  /* 单幕条件判定：等级门槛 + 击杀数 + 前一幕已领取；返回各项「当前/需求」进度与达成标记 */
  function questCond(st, i, arcLen) {
    var nd = questNeed(i, arcLen), done = Array.isArray(st.questDone) ? st.questDone : [];
    var lvCur = Math.max(1, Math.round(Number(st.lv) || 1));
    var killCur = Math.max(0, Math.round(Number(st.kills) || 0));
    var prevOK = i === 0 || (i < arcLen && done.indexOf(i - 1) >= 0);
    var lvOK = lvCur >= nd.lv, killOK = killCur >= nd.kills;
    return { need: nd, lvCur: lvCur, killCur: killCur, lv: lvOK, kills: killOK, prev: prevOK, ok: lvOK && killOK && prevOK };
  }
  /* 公会职位：按贡献晋升，返回 {rank, level}；确定性阈值表 */
  var GUILD_RANKS = [[0, '见习成员', 1], [50, '正式成员', 2], [120, '精英', 3], [250, '长老', 4], [500, '副会长', 5], [1000, '会长', 6]];
  function guildRank(contrib) {
    var c = Math.max(0, Math.round(Number(contrib) || 0)), r = GUILD_RANKS[0];
    for (var i = 0; i < GUILD_RANKS.length; i++) if (c >= GUILD_RANKS[i][0]) r = GUILD_RANKS[i];
    return { rank: r[1], level: r[2] };
  }
  /* 宠物出战攻击加成：与 derive 第 149 行口径完全一致（2 + ⌊成长值/2⌋）。
     等级/经验/忠诚度通过喂食提升成长值间接生效，不在此重复叠加，derive 仍只按 growth 加一次。 */
  function petBonus(pet) {
    if (!pet || !pet.active) return 0;
    return 2 + Math.floor((Number(pet.growth) || 0) * 0.5);
  }
  /* 确定性实体：队友（名字/职业 id/等级），按 seed 生成，最多补到队伍上限-1 名 */
  var PARTY_NAMES = ['风间', '落叶', '孤影', '听雨', '苍月', '墨白', '青羽', '无痕', '霜河', '星野', '铁牛', '小楼', '慕雪', '惊鸿'];
  var PARTY_CLASSES = ['warrior', 'archer', 'mage', 'priest', 'rogue', 'knight', 'beast', 'tactician'];
  function makePartyMember(seed) {
    var h = hash(seed);
    return { name: PARTY_NAMES[h % PARTY_NAMES.length], cls: PARTY_CLASSES[(h >>> 7) % PARTY_CLASSES.length], lv: 1 + ((h >>> 15) % 50) };
  }
  function memberLabel(m) {
    var cn = CLASSES[m.cls] ? CLASSES[m.cls].n : String(m.cls || '');
    return m.name + '·' + cn + '·Lv.' + m.lv;
  }
  /* 确定性实体：练级野怪（技能结算的目标），HP 由等级与 hash 决定 */
  var HUNT_NAMES = ['野狼', '山贼', '骷髅兵', '毒蛛', '荒原巨熊', '流寇', '石像鬼', '沼泽鳄', '风刃妖', '黑铁卫'];
  function makeHunt(g, lv, seq) {
    var s = Math.max(0, Math.round(Number(seq) || 0)), h = hash(g + '|hunt|' + s);
    var flv = Math.max(1, Math.round(Number(lv) || 1) + (h % 3) - 1);
    var maxHp = 95 + flv * 20 + ((h >>> 9) % 30);
    return { name: HUNT_NAMES[(h >>> 5) % HUNT_NAMES.length], lv: flv, hp: maxHp, maxHp: maxHp, seq: s };
  }
  /* 确定性实体：竞技场对手（名字/等级/战力/HP/攻防/暴击） */
  var FOE_NAMES = ['影刃·无名', '苍狼·破军', '铁面·镇岳', '追风·逐月', '霜刃·寒江', '孤鸿·断霞', '霸王·举鼎', '修罗·浴血', '无双·飞将', '寒星·坠落'];
  function makeFoe(seed, playerLv) {
    var h = hash(seed), h2 = hash(seed + '|p'), h3 = hash(seed + '|c');
    var plv = Math.max(1, Math.round(Number(playerLv) || 1));
    var lv = Math.max(1, plv + (h % 5) - 2);
    var power = 90 + lv * 20 + (h2 % 80);
    return {
      name: FOE_NAMES[h % FOE_NAMES.length], lv: lv, power: power,
      hp: Math.round(power * 1.6), atk: 18 + lv * 4 + (h3 % 12),
      def: 10 + Math.round(lv * 2.5) + ((h2 >>> 6) % 10), crit: 5 + ((h3 >>> 8) % 12)
    };
  }
  var Engine = {
    hash: hash, expToNext: expToNext, equipSum: equipSum, derive: derive, damage: damage, gainExp: gainExp,
    makeEquip: makeEquip, makeEquipFor: makeEquipFor, slotNameOf: slotNameOf, equipLabel: equipLabel,
    enhanceRate: enhanceRate, enhanceCost: enhanceCost, questNeed: questNeed, questCond: questCond,
    guildRank: guildRank, petBonus: petBonus, makePartyMember: makePartyMember, memberLabel: memberLabel,
    makeHunt: makeHunt, makeFoe: makeFoe, DIMS: DIMS, SLOTS: SLOTS, CLASSES: CLASSES
  };

  /* 结构化战斗日志（确定性写入） */
  function blog(st, o) {
    if (!Array.isArray(st.blog)) st.blog = [];
    st.blog = st.blog.slice(-11);
    st.blog.push({
      r: Number(st.round) || 0, a: String(o.a || ''), dmg: Math.max(0, Math.round(Number(o.dmg) || 0)),
      crit: !!o.crit, drop: String(o.drop || ''), res: String(o.res || ''),
      note: String(o.note || ''), t: String(o.t || '')
    });
  }
  /* 回合推进：技能冷却与 Buff 持续回合递减（确定性）
     v4.08.0 修复（无上限增长）：
     此前 st.buffs 只 push 不去重不截断 —— 玩家连续喝「力量药剂」或反复施加
     增益，buffs 数组单调增长且永不回收（tickBuffs 只在 tick 动作或回合推进时触发，
     不推进回合就一直涨）→ 存档 JSON 无限膨胀 → 撑爆 localStorage 配额，
     新内容静默丢失（叠加 B7 的静默写失败）。
     现在：① 同一 id 的 buff 刷新回合数而非叠加；② 总数硬上限，超出淘汰最旧的。 */
  var MAX_BUFFS = 24;
  function addBuff(st, b) {
    if (!Array.isArray(st.buffs)) st.buffs = [];
    var hit = null;
    for (var i = 0; i < st.buffs.length; i++) {
      if (st.buffs[i] && st.buffs[i].id === b.id) { hit = st.buffs[i]; break; }
    }
    if (hit) {
      /* 同 id 刷新：取更长的持续回合，不叠加数值（避免攻击力无限膨胀） */
      hit.turns = Math.max(Number(hit.turns) || 0, Number(b.turns) || 0);
    } else {
      st.buffs.push({
        id: b.id, n: b.n, i: b.i,
        atk: Number(b.atk) || 0, def: Number(b.def) || 0,
        turns: Number(b.turns) || 0, kind: b.kind
      });
    }
    /* 硬上限：超出时淘汰回合最少的（最先把失效的那个），再不行淘汰最早的 */
    if (st.buffs.length > MAX_BUFFS) {
      st.buffs.sort(function (x, y) { return (Number(x.turns) || 0) - (Number(y.turns) || 0); });
      st.buffs.splice(0, st.buffs.length - MAX_BUFFS);
    }
    return st.buffs;
  }
  function tickBuffs(st) {
    var chg = false;
    if (st.cd && typeof st.cd === 'object') Object.keys(st.cd).forEach(function (k) { if ((Number(st.cd[k]) || 0) > 0) { st.cd[k] = (Number(st.cd[k]) || 0) - 1; chg = true; } });
    if (Array.isArray(st.buffs) && st.buffs.length) {
      st.buffs = st.buffs.map(function (b) { var c = {}, k; for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) c[k] = b[k]; c.turns = (Number(c.turns) || 0) - 1; return c; }).filter(function (b) { return (Number(b.turns) || 0) > 0; });
      chg = true;
    }
    return chg;
  }

  /* ---------------- v4.07.0 委托系统桥 ----------------
     * 委托的生成、推进、时限全部由 js/rpg-quests.js 负责；rpg-core 只做落账。
     * 委托是「当下的世界实况」，不是写死的列表：世界日、分区、等级、玩家势力
     * 任一变化都会刷新委托板的内容。 */
  /* v4.07.0 委托引擎兜底：js/rpg-quests.js 是独立脚本，一旦某入口没加载成功，
     委托板会静默变空——整个大世界就不再「活着」。这里内联一份精简实现保底：
     板面非空、时限会走、推进可用；完整模板引擎就位后自动接管（RQ 优先取真的）。
     注：不写回 window.RpgQuests，避免顶掉真脚本。 */
  function questFallback() {
    var H = function (s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };
    var TPL = [
      { id: 'hunt', n: '讨伐委托', t: 'kills' },
      { id: 'gather', n: '采集委托', t: 'gather' },
      { id: 'scout', n: '侦察委托', t: 'reach' },
      { id: 'routine', n: '行会例行', t: 'kills' }
    ];
    return {
      _fallback: true,
      build: function (st, w, ctx) {
        ctx = ctx || {};
        var zone = ctx.zone || st.zone || 'dy';
        var lv = Math.max(1, Math.round(Number(st.lv) || 1));
        var maps = (w && w.maps) || [];
        var zm = maps.filter(function (m) { return !w.zoneOf || w.zoneOf[m] === zone; });
        if (!zm.length) zm = maps;
        var fs = (w && w.factions) || [];
        var day = ctx.day || 0;
        var out = [];
        for (var i = 0; i < 4; i++) {
          var sd = 'fb|' + zone + '|' + lv + '|' + day + '|' + i;
          var t = TPL[H(sd) % TPL.length];
          var place = zm[H(sd + '|p') % zm.length] || '未知之地';
          var fac = fs.length ? fs[H(sd + '|f') % fs.length] : null;
          var need = 2 + Math.floor(lv / 6);
          var due = 12 + Math.floor(lv * 0.9);
          out.push({
            id: 'fb' + H(sd).toString(36), t: t.t, tpl: t.id,
            title: t.n + ' · ' + place, note: '基础委托',
            giver: fac ? fac.n : '寰宇冒险者公会', giverZone: zone,
            place: place, foe: '', mat: '', lv: lv, need: need, cur: 0,
            gold: Math.round(18 + lv * 7), exp: Math.round(22 + lv * 11), rep: 3 + Math.floor(lv / 4),
            due: due, dueMax: due, src: 'routine', state: 'new', day: day, born: ctx.round || 0
          });
        }
        return out;
      },
      advance: function (q, kind, n, curMap) {
        if (!q || q.state !== 'active' || q.t !== kind) return q ? q.cur : 0;
        var step = Math.max(0, Number(n) || 0);
        if (!step) return q.cur;
        var at = curMap && q.place && String(curMap) === String(q.place);
        q.cur = Math.min(q.need, q.cur + (at ? step * 2 : step));
        if (q.cur >= q.need) q.state = 'done';
        return q.cur;
      },
      tick: function (st) {
        var n = 0;
        ((st.quests && st.quests.active) || []).forEach(function (q) {
          if (q.state !== 'active') return;
          q.due = Math.max(0, (Number(q.due) || 0) - 1);
          if (q.due <= 0) { q.state = 'expired'; n++; }
        });
        return n;
      },
      rollSituation: function (st, w, day, round) {
        var list = [];
        ((w && w.zones) || []).forEach(function (z) {
          list.push({ zone: z.id, sit: 'beast', sitN: '兽潮', foe: '游荡的野兽', mat: '兽皮', verb: '出没', day: day });
        });
        return { list: list, day: day, round: round };
      },
      situationOf: function (st) { return (st && st.situation) || { list: [] }; }
    };
  }
  function RQ() {
    if (window.RpgQuests && typeof window.RpgQuests.build === 'function') return window.RpgQuests;
    if (!window.__rpgQuestFallback) window.__rpgQuestFallback = questFallback();
    return window.__rpgQuestFallback;
  }
  /* 推进所有进行中委托；返回被推进的委托名数组（供文案提示） */
  function qprog(st, kind, n, curMap) {
    var rq = RQ(); if (!rq) return [];
    var moved = [];
    (st.quests && st.quests.active ? st.quests.active : []).forEach(function (q) {
      if (!q || q.state !== 'active' || q.t !== kind) return;
      var before = q.cur;
      rq.advance(q, kind, n, curMap);
      if (q.cur !== before) moved.push(q.title + '（' + q.cur + '/' + q.need + '）');
    });
    return moved;
  }
  /* 刷新委托板：世界日 / 分区 / 等级档位任一变化即换一批新委托（已接的不受影响） */
  function refreshBoard(st, force) {
    var rq = RQ(); if (!rq) return 0;
    var w = WORLD[st.genre] || WORLD.wangyou;
    var q = st.quests;
    var day = Math.max(0, Math.round(Number(st.worldDay) || 0));
    var lvBucket = Math.floor((Number(st.lv) || 1) / 5);
    if (!force && q.boardDay === day && q.boardZone === st.zone && q.boardLv === lvBucket) return 0;
    var offers = rq.build(st, w, {
      zone: st.zone, day: day, round: Number(st.round) || 0,
      mode: st.mode, visited: st.visited || {}
    });
    /* 已接委托从板面移除（避免重复接取同一条） */
    var taken = {};
    (q.active || []).forEach(function (a) { taken[a.id] = 1; });
    q.offers = offers.filter(function (o) { return !taken[o.id]; });
    q.boardDay = day; q.boardZone = st.zone; q.boardLv = lvBucket;
    return q.offers.length;
  }
  /* v4.07.0 玩家势力 → 世界实体 → 舆图据点
   * 链路：玩家在网游面板创建/加入势力 → 写入 variables.entities.factions（origin:"player"）
   *       → 调用 StoryAtlas.syncEntities → 按 territory 锚定到舆图对应位置并显示为势力节点。
   * 玩家势力的影响力随贡献与声望变化，节点深度会随之变化（由 syncEntities 的 infDepth 负责）。
   * 全程 try/catch：舆图脚本未就绪时静默跳过，绝不阻断数值流程。 */
  function seatOf(st) {
    var seat = (st.guild && st.guild.seat) || st.map || '';
    try {
      var A = window.StoryAtlas;
      if (A && A.data && A.data.wangyou) {
        var names = [];
        (A.data.wangyou.layers || []).forEach(function (L) {
          (L.nodes || []).forEach(function (n) { names.push(n.n); });
        });
        if (names.length && names.indexOf(seat) < 0) {
          /* 驻地不在舆图上（如设施名）→ 退回起始地，保证一定有个能落图的位置 */
          for (var i = 0; i < names.length; i++) if (/城|谷|原|岛/.test(names[i])) { seat = names[i]; break; }
        }
      }
    } catch (e) {}
    return seat;
  }
  function syncFactionToWorld(st) {
    try {
      var fw = window.storyFramework;
      if (!fw || !fw.storyState) return 0;
      var vars = fw.storyState.variables || (fw.storyState.variables = {});
      var ents = vars.entities || (vars.entities = {});
      var facs = ents.factions || (ents.factions = {});
      var nm = st.guild && st.guild.name;
      if (!nm) return 0;
      var contrib = Number(st.guild.contrib) || 0;
      var rep = Number(st.rep) || 0;
      var infl = Math.max(6, Math.min(100, Math.round(14 + contrib / 6 + rep / 10)));
      var members = 1 + Math.floor(contrib / 40);
      var key = '玩家势力·' + nm;
      facs[key] = {
        name: nm, type: 'faction', origin: 'player',
        members: members, influence: infl,
        territory: seatOf(st),
        ideology: '由玩家亲手立起的旗',
        desc: '玩家自建势力 · ' + (st.guild.rank || '会长') + ' · 贡献 ' + contrib,
        collapsed: false, status: 'active'
      };
      if (window.StoryAtlas && window.StoryAtlas.syncEntities) window.StoryAtlas.syncEntities(vars);
      return 1;
    } catch (e) { return 0; }
  }

  /* v4.07.0 世界时钟：read（剧情推进）与 tick（手动结束回合）都算一回合。
     统一由 worldTurn 计数，委托时限按它递减，跨 8 回合进入新的一天（局势轮换、委托板换批）。 */
  function advanceWorld(st) {
    st.worldTurn = (Number(st.worldTurn) || 0) + 1;
    var day = Math.floor(st.worldTurn / 8);
    if (day > (Number(st.worldDay) || 0)) {
      st.worldDay = day;
      refreshSituation(st);
      refreshBoard(st, true);
    } else {
      refreshBoard(st, false);
    }
    var rqT = RQ(); var e = 0;
    if (rqT) e = rqT.tick(st) || 0;
    if (e) {
      st.quests.expired = (Number(st.quests.expired) || 0) + e;
      st.quests.active = st.quests.active.filter(function (x) { return x.state !== 'expired'; });
    }
    return st.worldTurn;
  }

  /* 世界局势：每天一变，决定委托板上出现什么 */
  function refreshSituation(st) {
    var rq = RQ(); if (!rq) return 0;
    var w = WORLD[st.genre] || WORLD.wangyou;
    st.situation = rq.rollSituation(st, w, Math.max(0, Math.round(Number(st.worldDay) || 0)), Number(st.round) || 0);
    return (st.situation.list || []).length;
  }

  /* ---------------- 初始状态与老存档兼容 ---------------- */
  function initState(g) {
    var w = WORLD[g] || WORLD.wangyou;
    return {
      lv: 1, exp: 0, cls: w.classes[0], hidden: '', name: w.hid, title: '初入' + w.game,
      map: w.startMap, zone: (w.zones && w.zones[0] ? w.zones[0].id : 'dy'), hp: null, mp: null, gold: 50, rep: 0, points: 0,
      base: { str: 10, sta: 10, agi: 10, int: 10, tac: 8, luk: 5 },
      equip: { weapon: w.starter }, cd: {}, buffs: [], bag: [], kills: 0,
      lastRound: 0, log: [],
      /* v2 新增字段（老存档由 backfill/normalizeState 补默认值） */
      items: { hp: 0, mp: 0, buff: 0 }, enhSeq: 0,
      pet: { name: '', active: false, growth: 0, level: 1, exp: 0, loyalty: 50 },
      party: { size: 1, max: 5, members: [] },
      guild: { name: '', contrib: 0, level: 1, rank: '' },
      arenaWins: 0, arenaLoss: 0, arenaStreak: 0, arenaBest: 0, arenaLastFoe: null,
      hunt: null,
      blog: [], ach: [], questDone: [], round: 0, mapIdx: 0,
      /* v4.07.2：动作结算日志（供 directive 下发给 AI，防止 AI 依据旧快照编造数值） */
      actLog: [],
      /* v4.07.0 沙盒化：玩法路线（story 走三部曲主线 / sandbox 纯自由探索）、
         动态委托板、世界局势、世界日。默认 sandbox——大世界首先是一片可自由探索的旷野。 */
      mode: 'sandbox', genre: '',
      quests: { offers: [], active: [], done: 0, expired: 0, failed: 0, boardDay: -1, boardRound: -1 },
      /* v4.07.2 修 D-28：金币流水（余额与变动额混存） */
      goldTrail: [],
      situation: { list: [], day: 0, round: 0 },
      worldDay: 0, worldTurn: 0,
      visited: {}
    };
  }
  /* 字段级补齐：老存档缺字段 / 子字段 / 形状异常时一律补默认值，绝不崩 */
  function normalizeState(f, g) {
    var w = WORLD[g] || WORLD.wangyou, def = initState(g), i;
    ['items', 'pet', 'party', 'guild'].forEach(function (k) {
      f[k] = Object.assign({}, def[k], (f[k] && typeof f[k] === 'object' && !Array.isArray(f[k])) ? f[k] : {});
    });
    ['buffs', 'bag', 'log', 'blog', 'ach', 'questDone', 'actLog'].forEach(function (k) { if (!Array.isArray(f[k])) f[k] = def[k].slice(); });
    /* v4.07.2 修 D-28：金币流水补齐（余额与变动额混存，最多留 12 条） */
    f.goldTrail = (Array.isArray(f.goldTrail) ? f.goldTrail : [])
      .slice(-12).filter(function (x) { return isFinite(Number(x)); }).map(function (x) { return Math.round(Number(x)); });
    /* v4.07.0 沙盒字段：老存档一律补默认，保证切到新版本不崩 */
    if (f.mode !== 'story' && f.mode !== 'sandbox') f.mode = 'sandbox';
    f.mode = String(f.mode);
    f.genre = String(f.genre || g);
    if (!f.quests || typeof f.quests !== 'object' || Array.isArray(f.quests)) f.quests = {};
    f.quests.offers = Array.isArray(f.quests.offers) ? f.quests.offers : [];
    f.quests.active = Array.isArray(f.quests.active) ? f.quests.active : [];
    /* v4.10.0 修 P1-9 / P2（第三方审查「委托缺 gold 清零钱包 / 缺 need 永久卡死」）：
       老存档 / 外部脏数据里委托可能缺 gold、exp、rep、need、cur。缺 gold 在交付时
       会 `st.gold += undefined = NaN`，随后被本函数洗回默认金币（玩家余额被抹掉）；
       缺 need 则 `cur >= need` 恒为 false（NaN 比较），委托永远无法完成。
       这里对每条委托逐字段补最小合法值：need≥1、cur∈[0,need]、报酬字段≥0 且有限。
       rpg-quests.js 正常生成的委托都带齐字段，此逻辑对正常数据零影响（幂等）。 */
    ['offers', 'active'].forEach(function (arrKey) {
      f.quests[arrKey] = f.quests[arrKey].filter(function (q) {
        return q && typeof q === 'object' && !Array.isArray(q);
      }).map(function (q) {
        var need = Number(q.need);
        q.need = (isFinite(need) && need >= 1) ? Math.min(9999, Math.round(need)) : 1;
        var cur = Number(q.cur);
        q.cur = (isFinite(cur) && cur >= 0) ? Math.min(q.need, Math.round(cur)) : 0;
        ['gold', 'exp', 'rep'].forEach(function (k) {
          var n = Number(q[k]);
          q[k] = (isFinite(n) && n > 0) ? Math.min(1e9, Math.round(n)) : 0;
        });
        return q;
      });
    });
    ['done', 'expired', 'failed'].forEach(function (k) {
      var n2 = Number(f.quests[k]);
      f.quests[k] = (f.quests[k] == null || isNaN(n2)) ? 0 : Math.max(0, Math.round(n2));
    });
    /* v4.07.2 修 D-25（哨兵写法误伤合法 0）：原写法 Number(x) || -1，
       而 boardDay=0（第 0 天）、boardLv=0（Lv.1–4 档）都是合法值，
       0 被 || 短路成 -1（=「从未刷新」的哨兵）。
       后果：委托板每次比对都判定「板面已过期」→ refreshBoard 整块重建 offer，
       玩家刚点下的委托可能凭空消失，提示变成「这条委托已经不在板上了（世界局势变了）」。
       改为显式判有限数，只有真正的空值/NaN 才落到 -1。 */
    var bd = Number(f.quests.boardDay);
    f.quests.boardDay = isFinite(bd) ? Math.round(bd) : -1;
    var br = Number(f.quests.boardRound);
    f.quests.boardRound = isFinite(br) ? Math.round(br) : -1;
    f.quests.boardZone = f.quests.boardZone ? String(f.quests.boardZone) : '';
    var bl = Number(f.quests.boardLv);
    f.quests.boardLv = isFinite(bl) ? Math.round(bl) : -1;
    if (!f.situation || typeof f.situation !== 'object' || Array.isArray(f.situation)) f.situation = {};
    f.situation.list = Array.isArray(f.situation.list) ? f.situation.list : [];
    f.situation.day = Math.max(0, Math.round(Number(f.situation.day) || 0));
    f.situation.round = Math.max(0, Math.round(Number(f.situation.round) || 0));
    var wd = Number(f.worldDay);
    f.worldDay = (f.worldDay == null || isNaN(wd)) ? 0 : Math.max(0, Math.round(wd));
    var wt = Number(f.worldTurn);
    f.worldTurn = (f.worldTurn == null || isNaN(wt)) ? 0 : Math.max(0, Math.round(wt));
    if (!f.visited || typeof f.visited !== 'object' || Array.isArray(f.visited)) f.visited = {};
    if (!f.cd || typeof f.cd !== 'object' || Array.isArray(f.cd)) f.cd = {};
    if (!f.equip || typeof f.equip !== 'object' || Array.isArray(f.equip)) f.equip = { weapon: w.starter };
    f.base = Object.assign({}, def.base, (f.base && typeof f.base === 'object' && !Array.isArray(f.base)) ? f.base : {});
    /* 数值字段：缺/坏补默认，负数夹到 0（金币/HP/MP 绝不为负），等级至少 1。
       v4.10.0 修 P2「RPG 数值只有下限、没有上限」：旧版只有 Math.max(0,…)，
       lv=1e308 会让 maxHp/(100+lv*18+…) 溢出成 Infinity，gold=1e308 再 += 也成
       Infinity，一旦落盘整档损坏。统一加上限 NUM_CAP，lv 单独钳到 999。 */
    var NUM_CAP = 1e9;
    ['gold', 'rep', 'points', 'kills', 'lastRound', 'enhSeq', 'arenaWins', 'arenaLoss', 'round', 'mapIdx', 'exp'].forEach(function (k) {
      var n = Number(f[k]);
      f[k] = (f[k] == null || isNaN(n) || !isFinite(n)) ? def[k] : Math.min(NUM_CAP, Math.max(0, Math.round(n)));
    });
    var lvN = Number(f.lv);
    f.lv = (f.lv == null || isNaN(lvN) || !isFinite(lvN)) ? 1 : Math.min(999, Math.max(1, Math.round(lvN)));
    /* 基础属性同样钳上限，防止 base.* 极端值让派生属性溢出 */
    ['str', 'sta', 'agi', 'int', 'tac', 'luk'].forEach(function (k) {
      var b = Number(f.base[k]);
      f.base[k] = (isNaN(b) || !isFinite(b)) ? (def.base[k] || 0) : Math.min(1e6, Math.max(0, Math.round(b)));
    });
    if (f.hp != null && isNaN(Number(f.hp))) f.hp = null;
    if (f.mp != null && isNaN(Number(f.mp))) f.mp = null;
    if (f.cls == null) f.cls = def.cls;
    if (f.map == null) f.map = def.map;
    /* v4.06.0 分区：老存档无 zone 或 zone 非法时，按当前地图反查，仍失败则回落到首区 */
    if (f.zone == null) f.zone = def.zone;
    f.zone = String(f.zone);
    if (!w.zones.some(function (z) { return z.id === f.zone; })) {
      f.zone = (w.zoneOf && w.zoneOf[f.map]) ? w.zoneOf[f.map] : def.zone;
    }
    /* ---- v4.05.0 新增字段：老存档缺字段 / 形状异常一律补默认值（幂等，绝不崩） ---- */
    if (f.party && typeof f.party === 'object') {
      var mem = Array.isArray(f.party.members) ? f.party.members : [];
      mem = mem.filter(function (m) { return m && typeof m === 'object' && !Array.isArray(m); })
        .slice(0, 4).map(function (m) {
          return { name: String(m.name || ''), cls: String(m.cls || ''), lv: Math.max(1, Math.min(99, Math.round(Number(m.lv) || 1))) };
        });
      var psz = Number(f.party.size);
      if (f.party.size == null || isNaN(psz) || !isFinite(psz)) psz = 1;
      psz = Math.max(1, Math.min(5, Math.round(psz)));
      /* 老存档只有 size、没有名单时，按确定性种子补出 size-1 名队友（名单与 size 自洽） */
      if (!mem.length && psz > 1) { for (var mi = 0; mi < psz - 1; mi++) mem.push(makePartyMember(g + '|party|' + mi)); }
      f.party.members = mem;
      f.party.size = mem.length ? Math.min(5, mem.length + 1) : psz;
      var pmx = Number(f.party.max);
      f.party.max = (f.party.max == null || isNaN(pmx) || !isFinite(pmx)) ? 5 : Math.max(1, Math.min(5, Math.round(pmx)));
    }
    if (f.guild && typeof f.guild === 'object') {
      var gc = Number(f.guild.contrib);
      f.guild.contrib = (f.guild.contrib == null || isNaN(gc) || !isFinite(gc)) ? 0 : Math.min(1e9, Math.max(0, Math.round(gc)));
      var gr = guildRank(f.guild.contrib);
      f.guild.level = gr.level; f.guild.rank = gr.rank;   /* 按贡献重算，幂等 */
      if (f.guild.name == null) f.guild.name = '';
      f.guild.name = String(f.guild.name);
      /* v4.07.0 玩家自建势力标记与驻地 */
      f.guild.origin = f.guild.origin === 'player' ? 'player' : (f.guild.name ? 'npc' : '');
      f.guild.seat = f.guild.seat == null ? '' : String(f.guild.seat);
    }
    if (f.pet && typeof f.pet === 'object') {
      var pl = Number(f.pet.level);
      f.pet.level = (f.pet.level == null || isNaN(pl) || !isFinite(pl)) ? 1 : Math.max(1, Math.min(99, Math.round(pl)));
      var pe = Number(f.pet.exp);
      f.pet.exp = (f.pet.exp == null || isNaN(pe) || !isFinite(pe)) ? 0 : Math.max(0, Math.round(pe));
      var py = Number(f.pet.loyalty);
      f.pet.loyalty = (f.pet.loyalty == null || isNaN(py) || !isFinite(py)) ? 50 : Math.max(0, Math.min(100, Math.round(py)));
      var pg = Number(f.pet.growth);
      f.pet.growth = (f.pet.growth == null || isNaN(pg) || !isFinite(pg)) ? 0 : Math.max(0, Math.round(pg));
      f.pet.active = !!f.pet.active;
      if (f.pet.name == null) f.pet.name = '';
      f.pet.name = String(f.pet.name);
    }
    ['arenaStreak', 'arenaBest'].forEach(function (k) {
      var n = Number(f[k]);
      f[k] = (f[k] == null || isNaN(n) || !isFinite(n)) ? 0 : Math.max(0, Math.round(n));
    });
    if (f.arenaLastFoe != null) {
      var lf = f.arenaLastFoe;
      if (typeof lf !== 'object' || Array.isArray(lf)) f.arenaLastFoe = null;
      else f.arenaLastFoe = { name: String(lf.name || ''), lv: Math.max(1, Math.round(Number(lf.lv) || 1)), power: Math.max(0, Math.round(Number(lf.power) || 0)) };
    }
    /* 当前练级野怪：形状异常时按确定性种子重建；规范成固定字段形状，保证幂等 */
    if (!f.hunt || typeof f.hunt !== 'object' || Array.isArray(f.hunt) || !(Number(f.hunt.maxHp) > 0)) {
      f.hunt = makeHunt(g, f.lv, 0);
    } else {
      var hh = f.hunt, mh = Math.max(1, Math.round(Number(hh.maxHp) || 1)), hpv = Number(hh.hp);
      f.hunt = {
        name: String(hh.name || '野怪'), lv: Math.max(1, Math.round(Number(hh.lv) || 1)),
        hp: (isNaN(hpv) || !isFinite(hpv)) ? mh : Math.max(0, Math.min(mh, Math.round(hpv))),
        maxHp: mh, seq: Math.max(0, Math.round(Number(hh.seq) || 0))
      };
    }
    return f;
  }

  /* ---------------- 模块 ---------------- */
  function rpgModule(g) {
    var w = WORLD[g] || WORLD.wangyou;
    var maps = w.maps || [w.startMap];
    var E = function (st) { return Engine.derive(st); };
    /* v4.06.0 分区工具：分区决定第二资源名与品级叫法；地图→分区→资源三级同源 */
    function zoneObj(st) {
      var zs = w.zones || [];
      var id = st && st.zone ? String(st.zone) : '';
      var z = zs.filter(function (x) { return x.id === id; })[0];
      if (!z && st && st.map && w.zoneOf) {
        var mid = w.zoneOf[st.map];
        z = zs.filter(function (x) { return x.id === mid; })[0];
      }
      return z || zs[0] || { id: 'dy', n: '主城', short: '主城', res: w.res, tierNote: '', note: '' };
    }
    function resOf(st) { return zoneObj(st).res || w.res; }
    var esc = (WR && WR.H && WR.H.esc) ? WR.H.esc : function (x) { return String(x == null ? '' : x); };
    function note(st, txt) { st.log = (Array.isArray(st.log) ? st.log : []).slice(-6); st.log.push(String(txt)); }
    function clsName(st) { return st.hidden ? CLASSES[st.hidden].n : (CLASSES[st.cls] || CLASSES.warrior).n; }
    function clsCfg(st) { return st.hidden ? CLASSES[st.hidden] : (CLASSES[st.cls] || CLASSES.warrior); }
    function tierIdx(t) { var i = w.tiers.indexOf(t); return i < 0 ? 0 : i; }
    var R = null; /* 渲染上下文，html 时赋值 */

    return WR.module({
      id: 'wr_rpg', icon: '🎮', name: w.game + ' · 角色面板', type: 'console',
      tip: '等级／经验／HP·MP／六维／攻防暴击／装备槽／技能／任务／商店／传送／竞技场——网游数值由引擎结算',
      contract: '网游角色面板（等级、职业、HP/MP、六维、攻防、装备、金币、声望、当前地图）——正文数值须与面板一致',
      stats: { lv: { v: 1, max: 999, label: '等级', icon: '🎮' } },
      /* v4.07.2：显式声明动作清单。此前本模块不声明 actions，
         导致 WorldExt.moduleList() 读不到（actions 被 world-runtime 列进 RESERVED，
         只有原始蓝图才有），自动化功能探测无法触达这 20+ 个动作——等于没测。
         清单与下方 act() 的分支严格一致。 */
      actions: [
        { id: 'skill', label: '⚔️ 技能', desc: '释放技能' },
        { id: 'rest', label: '🛌 休整', desc: '回血回蓝' },
        { id: 'loot', label: '🎁 掉落', desc: '结算掉落' },
        { id: 'teleport', label: '📍 传送', desc: '切换地图' },
        { id: 'qaccept', label: '📋 接委托', desc: '接取委托' },
        { id: 'qturnin', label: '✅ 交委托', desc: '交付委托' },
        { id: 'qgiveup', label: '🗑 放弃委托', desc: '放弃在手委托' },
        { id: 'mode', label: '🔀 路线', desc: '主线/沙盒切换' },
        { id: 'enhance', label: '🔨 强化', desc: '强化装备' },
        { id: 'buy', label: '🛒 买', desc: '商店购买' },
        { id: 'sell', label: '💰 卖', desc: '商店出售' },
        { id: 'equipbag', label: '🎒 装备', desc: '装备背包物' },
        { id: 'usepotion', label: '🧪 用药', desc: '使用药剂' },
        { id: 'arena', label: '⚔️ 竞技', desc: '竞技场对战' },
        { id: 'party', label: '👥 队伍', desc: '组队' },
        { id: 'pet', label: '🐾 灵宠', desc: '灵宠出战' },
        { id: 'guild', label: '🏛 势力', desc: '建/入势力' },
        { id: 'setclass', label: '🎭 转职', desc: '转职' },
        { id: 'addpoint', label: '📊 加点', desc: '分配属性点' },
        { id: 'buff', label: '✨ 增益', desc: '查看增益' },
        { id: 'questclaim', label: '🏅 领奖', desc: '领取成就' },
        { id: 'achieveclaim', label: '🎖 成就', desc: '领取成就奖励' },
        { id: 'clearlog', label: '🧹 清日志', desc: '清理战报' },
        { id: 'tick', label: '⏱ 推进', desc: '推进一回合' },
      ],
      /* WR.module 把状态对象本身作为第二个参数传入（不是模块包裹），字段须直接写到 f 上 */
      backfill: function (o, f) {
        var d = initState(g);
        Object.keys(d).forEach(function (k) { if (o && o[k] !== undefined) d[k] = o[k]; f[k] = d[k]; });
        delete f.state;
        normalizeState(f, g);
        /* v4.07.0：界标识写入状态，供委托桥按本界取值；并首刷一次局势与委托板 */
        f.genre = g;
        refreshSituation(f);
        refreshBoard(f, true);
        var s = E(f);
        var hpRaw = Number(o && o.hp != null ? o.hp : s.maxHp);
        var mpRaw = Number(o && o.mp != null ? o.mp : s.maxMp);
        f.hp = Math.max(0, Math.min(isNaN(hpRaw) ? s.maxHp : hpRaw, s.maxHp));
        f.mp = Math.max(0, Math.min(isNaN(mpRaw) ? s.maxMp : mpRaw, s.maxMp));
      },
      hud: function (st) {
        var s = E(st), hp = Number(st.hp != null ? st.hp : s.maxHp), mp = Number(st.mp != null ? st.mp : s.maxMp);
        var need = Engine.expToNext(st.lv);
        var zn0 = zoneObj(st);
        return [
          { i: '🎮', v: 'Lv.' + st.lv, l: clsName(st).slice(0, 6), tone: '', mod: 'wr_rpg' },
          { i: '🗺️', v: zn0.short, l: '分区', tone: zn0.id === 'zy' ? 'warn' : '', mod: 'wr_rpg' },
          { i: '❤️', v: hp + '/' + s.maxHp, l: 'HP', tone: hp <= s.maxHp * 0.25 ? 'bad' : '', mod: 'wr_rpg' },
          { i: '🔵', v: mp + '/' + s.maxMp, l: resOf(st), tone: '', mod: 'wr_rpg' },
          { i: '✨', v: st.exp + '/' + need, l: '经验', tone: '', mod: 'wr_rpg' },
          { i: '💰', v: String(st.gold || 0), l: w.cur, tone: '', mod: 'wr_rpg' }
        ];
      },
      /* 常驻状态板走 summary 协议；与 hud 同一份数值，避免两处口径不一致 */
      summary: function (st) { return this.hud(st); },
      read: function (st, vars, round) {
        normalizeState(st, g);
        var r = Number(round) || (vars && Number(vars.chapter)) || 0;
        var roundApplied = false;
        if (r && r !== st.lastRound) {
          roundApplied = true;
          st.lastRound = r;
          /* 每轮确定性小额经验，保证面板始终在推进 */
          var gain = Engine.gainExp(st, 8 + st.lv * 2);
          if (gain.ups) { st.lv = gain.lv; st.exp = gain.exp; st.points = (Number(st.points) || 0) + gain.points; note(st, '⬆️ 升至 Lv.' + st.lv + '，获得 ' + gain.points + ' 属性点'); }
          else st.exp = gain.exp;
          tickBuffs(st);
          /* v4.07.0 剧情推进也算一个世界回合：局势、委托时限、委托板随之演进 */
          advanceWorld(st);
        }
        /* 从变量块里读模型写出的结算行（>>网游面板.exp: +120 等） */
        var changed = false;
        try {
          var blob = '';
          var walk = function (v, depth) {
            if (depth > 3 || v == null) return;
            if (typeof v === 'string') blob += v + '\n';
            else if (Array.isArray(v)) v.forEach(function (x) { walk(x, depth + 1); });
            else if (typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], depth + 1); });
          };
          walk(vars, 0);
          var re = />>\s*网游面板\s*[.．]\s*(exp|经验|hp|气血|mp|魔法|gold|金币|rep|声望|equip|装备)\s*[:：]\s*([+-]?\d+|[^\n]{2,30})/gi;
          var m;
          while ((m = re.exec(blob))) {
            var key = m[1].toLowerCase(), val = m[2].trim();
            if (key === 'exp' || key === '经验') { var g2 = Engine.gainExp(st, parseInt(val, 10) || 0); st.lv = g2.lv; st.exp = g2.exp; st.points = (Number(st.points) || 0) + g2.points; changed = true; }
            else if (key === 'hp' || key === '气血') { st.hp = Math.max(0, Math.min(E(st).maxHp, (Number(st.hp) || 0) + (parseInt(val, 10) || 0))); changed = true; }
            else if (key === 'mp' || key === '魔法') { st.mp = Math.max(0, Math.min(E(st).maxMp, (Number(st.mp) || 0) + (parseInt(val, 10) || 0))); changed = true; }
            else if (key === 'gold' || key === '金币') { st.gold = Math.max(0, (Number(st.gold) || 0) + (parseInt(val, 10) || 0)); changed = true; }
            else if (key === 'rep' || key === '声望') { st.rep = Math.max(0, (Number(st.rep) || 0) + (parseInt(val, 10) || 0)); changed = true; }
            else if (key === 'equip' || key === '装备') { st.bag = (st.bag || []).slice(-8); st.bag.push({ n: val, tier: w.tiers[0] }); changed = true; }
          }
        } catch (e) { /* 变量形状不可控，忽略解析失败 */ }
        return changed || roundApplied;
      },
      act: function (st, s, a, p) {
        normalizeState(st, g);
        var d = E(st), i;
        /* v4.07.2 修 D-32（技能冷却永不结束，玩家可见）：
           冷却只在 tickBuffs（tick 动作）里递减，而 wr_rpg 的 skill / loot / buy 等动作
           走本函数自己的分支，不经过 world-runtime 的 runPipeline（那里的通用递减管不到它们）。
           结果：玩家打完一次怪，技能就卡在「冷却中（1 轮）」——
           除非他翻到面板深处的「⏭ 结束回合」按钮点一下，否则再也放不出技能。
           实测连点 4 次基本斩击：第 1 次生效，后 3 次全是「冷却中」。
           改为：任何玩家动作执行前，先让所有技能冷却走一格（动作即回合）。
           世界时钟 st.round 不受影响，仍由 tick / 剧情推进。 */
        if (a !== 'tick' && st.cd && typeof st.cd === 'object') {
          Object.keys(st.cd).forEach(function (k) {
            if ((Number(st.cd[k]) || 0) > 0) st.cd[k] = (Number(st.cd[k]) || 0) - 1;
          });
        }
        /* v4.07.2 修 D-28（金币流水缺失）：正文里合法的历史收支会被误判成「编造金币」——
           判定器只认「当前金币数」与「委托报酬」，而引擎才是唯一知道真相的地方。
           在 act 入口记下动作前的金币，ok() 结算时把「结算后余额」与「本次变动额」一起留痕，
           让真实历史叙述（「你刚才花了 15 金币传送」）能被正确放行。 */
        var goldBefore = Number(st.gold) || 0;
        /* v4.07.2 修 D-18（核心）：动作结算结果必须回流给 AI。
           此前 ok() 只把文案返回给界面（toast / 面板 log），从不进入 directive（AI 提示词），
           于是引擎结算的真相——击杀掉落多少、经验加了多少、是否升级、掉了什么装备——
           只有玩家看得见，AI 看不见。AI 拿到的仍是「动作前」的快照（经验 0/62），
           只能靠猜：实测出现「经验+80。当前经验 80/62」（当前经验超过所需上限，自相矛盾）
           与「Lv.2了」（实际 Lv.1，一次战斗经验不足以升级）等编造。
           修法：ok() 统一把动作结果记入 st.actLog，directive 每轮把最近若干条送出，
           让 AI 看到的数值与引擎结算完全同源。 */
        function ok(m) {
          st.gold = Math.max(0, Math.round(Number(st.gold) || 0));
          st.rep = Math.max(0, Math.round(Number(st.rep) || 0));
          var dd = E(st);
          st.hp = st.hp == null ? dd.maxHp : Math.max(0, Math.min(dd.maxHp, Math.round(Number(st.hp) || 0)));
          st.mp = st.mp == null ? dd.maxMp : Math.max(0, Math.min(dd.maxMp, Math.round(Number(st.mp) || 0)));
          if (m) {
            st.actLog = (Array.isArray(st.actLog) ? st.actLog : []).slice(-5);
            st.actLog.push(String(m));
            /* v4.07.2 修 D-28：金币流水（余额 + 本次变动额），供判定与 AI 溯源。
               数组里两种值混存：结算后的余额（如 45）、本次金币变动额（如 15）。
               两者都是玩家在正文里可能如实提到的数字。 */
            var gv = Math.round(Number(st.gold) || 0);
            st.goldTrail = (Array.isArray(st.goldTrail) ? st.goldTrail : []).slice(-11);
            if (st.goldTrail.indexOf(gv) < 0) st.goldTrail.push(gv);
            var dv = Math.abs(gv - goldBefore);
            if (dv > 0 && st.goldTrail.indexOf(dv) < 0) st.goldTrail.push(dv);
          }
          return m;
        }
        p = (p == null ? '' : String(p));

        /* —— 原有 6 动作（保持行为，补结构化日志）—— */
        if (a === 'addpoint') {
          if ((Number(st.points) || 0) <= 0) return '没有可分配的属性点';
          if (!DIMS.some(function (x) { return x.k === p; })) return '未知属性';
          st.points--; st.base[p] = (Number(st.base[p]) || 0) + 1;
          return ok('✦ ' + (DIMS.filter(function (x) { return x.k === p; })[0].n) + ' +1（剩余 ' + st.points + ' 点）');
        }
        if (a === 'setclass') {
          if (!w.classes.includes(p) && !w.hidden.some(function (h) { return h.id === p; })) return '本界没有这个职业';
          var h = w.hidden.filter(function (x) { return x.id === p; })[0];
          if (h && (Number(st.lv) || 1) < h.lv) return '🔒 需要 Lv.' + h.lv + ' 才能转职「' + h.n + '」';
          /* v4.07.0 隐藏职业多维解锁：等级之外还要声望／击杀／竞技场胜场／行会贡献 */
          if (h) {
            var rq = h.req || {}, missH = [];
            if (rq.kills && (Number(st.kills) || 0) < rq.kills) missH.push('击杀 ' + (Number(st.kills) || 0) + '/' + rq.kills);
            if (rq.rep && (Number(st.rep) || 0) < rq.rep) missH.push('声望 ' + (Number(st.rep) || 0) + '/' + rq.rep);
            if (rq.arena && (Number(st.arenaWins) || 0) < rq.arena) missH.push('竞技场胜场 ' + (Number(st.arenaWins) || 0) + '/' + rq.arena);
            if (rq.contrib && (Number(st.guild && st.guild.contrib) || 0) < rq.contrib) missH.push('行会贡献 ' + (Number(st.guild && st.guild.contrib) || 0) + '/' + rq.contrib);
            if (missH.length) return '🔒 转职「' + h.n + '」尚缺：' + missH.join('、');
          }
          if (h) { st.hidden = p; st.title = h.n; } else { st.cls = p; st.hidden = ''; }
          note(st, '🎭 职业变更为「' + clsName(st) + '」');
          return ok('职业已设为「' + clsName(st) + '」，属性按新职业成长系数重算');
        }
        if (a === 'rest') {
          st.hp = E(st).maxHp; st.mp = E(st).maxMp;
          note(st, '🛌 回城休整——HP/MP 回满');
          return ok('🛌 回城休整——HP/MP 回满');
        }
        if (a === 'skill') {
          var sk = null, list = clsCfg(st).skills;
          for (i = 0; i < list.length; i++) if (list[i][0] === p) sk = list[i];
          if (!sk) return '未知技能';
          if ((st.cd[sk[0]] || 0) > 0) return '「' + sk[1] + '」冷却中（' + st.cd[sk[0]] + ' 轮）';
          if ((Number(st.mp) || 0) < sk[2]) return resOf(st) + '不足（' + (Number(st.mp) || 0) + '/' + sk[2] + '）';
          if ((Number(st.hp) || 0) <= 0) return '💀 气血耗尽——请先「休整」或使用生命药水';
          st.mp -= sk[2]; st.cd[sk[0]] = sk[3];
          /* 明确结算目标：当前确定性野怪（练级/打怪），不再打空气凭空掉金币 */
          /* v4.07.2 修 D-33（引擎自相矛盾）：结算文案原先带野怪等级（「毒蛛(Lv.1)」），
             而同一份 directive 明令「严禁给野怪标注具体等级或 HP 数字」——
             引擎自己就在提供违规素材，AI 照抄即判违规（实测正文出现「毒蛛(Lv.1)」）。
             面板「🎯 练级目标」卡仍向玩家显示等级与 HP，信息不丢；
             发给 AI 的结算只写名称与相对强弱。 */
          var hunt = st.hunt, huntName = hunt.name;
          var foeDef = Math.round(12 + hunt.lv * 2.2);
          var skSeed = st.lv + '|' + sk[0] + '|' + (st.kills || 0) + '|' + hunt.seq;
          var dm = Engine.damage(d.atk, foeDef, sk[4], d.crit, skSeed);
          hunt.hp = Math.max(0, (Number(hunt.hp) || 0) - dm.value);
          var killed = hunt.hp <= 0, coin = 0, repGain = 0;
          /* v4.05.1：野怪存活时反击，玩家气血真实受损（伤害高于 tick 的 5% 回血），药水/休整才有意义 */
          var counter = 0;
          if (!killed) {
            var huntAtk = 12 + hunt.lv * 4 + (Engine.hash(skSeed + '|c') % 8);
            var cm = Engine.damage(huntAtk, d.def, 1.0, 6, skSeed + '|c');
            counter = Math.max(1, Math.round(cm.value * 1.8));
            st.hp = Math.max(0, (Number(st.hp) || 0) - counter);
          }
          /* 战斗历练经验（来自对野怪造成的伤害）；金币/声望只在击杀野怪时由掉落结算 */
          var expGain = Math.max(1, Math.round(dm.value / 20));
          if (killed) {
            st.kills = (Number(st.kills) || 0) + 1;
            coin = Math.round(3 + hunt.lv * 0.7);   /* 野怪掉落金币（明确来源，v4.05.1 下调抑制通胀） */
            repGain = 1;                            /* 击杀声望 */
            st.gold += coin; st.rep += repGain;
            st.hunt = Engine.makeHunt(g, st.lv, (Number(hunt.seq) || 0) + 1);
            var qm1 = qprog(st, 'kills', 1, st.map);
            if (qm1.length) blog(st, { a: '委托推进', t: '委托', note: qm1.join('；') });
          }
          var ge = Engine.gainExp(st, expGain);
          st.lv = ge.lv; st.exp = ge.exp; st.points = (Number(st.points) || 0) + ge.points;
          note(st, sk[1] + ' 对「' + huntName + '」造成 ' + dm.value + (dm.crit ? '（暴击）' : '') + ' 点伤害' + (killed ? '，击杀掉落 ' + coin + ' ' + w.cur : '，未击杀'));
          blog(st, { a: sk[1], dmg: dm.value, crit: dm.crit, t: '技能',
            note: '目标「' + huntName + '」HP ' + hunt.hp + '/' + hunt.maxHp + ' · ' + (killed ? ('击杀掉落 ' + coin + ' ' + w.cur + '（野怪掉落）· 声望 +1') : ('未击杀 · 反击 -' + counter + ' HP · 仅经验 +' + expGain + '，' + w.cur + '无收益')) + ' · 耗 ' + resOf(st) + ' ' + sk[2] });
          /* v4.07.2：带上动作后的等级与经验。只说「经验 +35」不足以让 AI 判断是否升级，
             AI 就会自行脑补「Lv.2了」——实测已出现这类编造。
             同时明确：结算里的野怪等级/HP 是引擎内部口径，只供 AI 校准玩家自身数值，
             严禁写进正文（提示词本就禁止给野怪标注等级或 HP）。 */
          return ok('⚔️ ' + sk[1] + ' 对「' + huntName + '」造成 ' + dm.value + ' 点伤害' + (dm.crit ? ' 💥暴击' : '')
            + (killed ? '｜击杀！野怪掉落 ' + coin + ' ' + w.cur + '、声望 +' + repGain + '、经验 +' + expGain : '｜未击杀，受到反击 -' + counter + ' HP，仅经验 +' + expGain + '，' + w.cur + '无收益')
            + '，耗 ' + resOf(st) + ' ' + sk[2] + '，冷却 ' + sk[3] + ' 轮'
            + '｜当前 Lv.' + st.lv + ' 经验 ' + st.exp + '/' + Engine.expToNext(st.lv));
        }
        if (a === 'loot') {
          var tier = 0;
          for (i = 0; i < w.loot.length; i++) if (st.lv >= w.loot[i][2]) tier = i;
          var L = w.loot[tier];
          /* 确定性轮换槽位：按累计击杀数轮换 10 个装备槽（非随机，10 次覆盖全部槽） */
          var killN = Number(st.kills) || 0;
          var slot = SLOTS[killN % SLOTS.length].k;
          var eq = Engine.makeEquipFor(slot, L[0], L[1], st.lv);
          /* 掉落一律进背包（带 slot），由玩家在背包页按槽位「装备」；旧装退回见 equipbag */
          st.bag = (st.bag || []).slice(-8); st.bag.push(eq);
          st.kills = killN + 1;
          var coin = Math.round(8 + (Number(st.lv) || 1) * 1.5);
          st.gold += coin;
          var qm2 = qprog(st, 'gather', 1, st.map);
          if (qm2.length) blog(st, { a: '委托推进', t: '委托', note: qm2.join('；') });
          note(st, '🎁 掉落「' + L[0] + '」（' + L[1] + '·' + Engine.slotNameOf(slot) + '），' + w.cur + ' +' + coin);
          blog(st, { a: '结算掉落', drop: L[0] + '·' + L[1], t: '掉落', note: '落入「' + Engine.slotNameOf(slot) + '」槽 · 击杀数 ' + st.kills + ' · ' + w.cur + ' +' + coin });
          return ok('🎁 掉落「' + L[0] + '」· ' + L[1] + '｜' + Engine.slotNameOf(slot) + '槽｜攻 +' + eq.atk + '｜' + w.cur + ' +' + coin + '｜已入包（背包页按槽装备）');
        }
        if (a === 'equipbag') {
          var idx = parseInt(p, 10);
          if (isNaN(idx) || !st.bag || !st.bag[idx]) return '背包里没有这件装备';
          var it = st.bag.splice(idx, 1)[0];
          /* 老物品无 slot 时兜底为 weapon；非法 slot 也兜底，保证老存档可用 */
          var slot = (it && it.slot) || 'weapon';
          if (!SLOTS.some(function (x) { return x.k === slot; })) slot = 'weapon';
          var old = st.equip[slot];
          st.equip[slot] = it;
          if (old) st.bag.push(old);   /* 该槽旧装备退回背包 */
          var sn = Engine.slotNameOf(slot);
          blog(st, { a: '装备 ' + sn + '·' + ((it && it.n) || ''), drop: (it && it.n) || '', t: '装备',
            note: sn + '槽' + (old ? ' · 原「' + Engine.equipLabel(old) + '」退回背包' : '') });
          return ok('已把「' + Engine.equipLabel(it) + '」装备到「' + sn + '」' + (old ? '，原装备「' + Engine.equipLabel(old) + '」退回背包' : ''));
        }

        /* —— v2 新增动作 —— */
        if (a === 'buy') {
          var goods = null; for (i = 0; i < SHOP.length; i++) if (SHOP[i].k === p) goods = SHOP[i];
          if (!goods) return '商店没有这件商品';
          if ((Number(st.gold) || 0) < goods.price) return '💰 ' + w.cur + '不足（' + st.gold + '/' + goods.price + '）';
          st.gold -= goods.price; st.items[p] = (Number(st.items[p]) || 0) + 1;
          blog(st, { a: '购买 ' + goods.n, t: '商店', note: '-' + goods.price + ' ' + w.cur });
          return ok('🛒 买入「' + goods.n + '」×1，花费 ' + goods.price + ' ' + w.cur + '（库存 ' + st.items[p] + '）');
        }
        if (a === 'sell') {
          var si = parseInt(p, 10);
          if (isNaN(si) || !st.bag || !st.bag[si]) return '背包里没有这件物品';
          var sit = st.bag.splice(si, 1)[0];
          var price = 8 + tierIdx(sit && sit.tier) * 6 + Math.round((Number(sit && sit.atk) || 0) / 4);
          st.gold += price;
          blog(st, { a: '出售物品', drop: (sit && sit.n) || '', t: '商店', note: '+' + price + ' ' + w.cur });
          return ok('💰 卖出「' + (sit && sit.n || '') + '」，获得 ' + price + ' ' + w.cur);
        }
        if (a === 'usepotion') {
          var po = null; for (i = 0; i < SHOP.length; i++) if (SHOP[i].k === p) po = SHOP[i];
          if (!po || (Number(st.items[p]) || 0) <= 0) return '背包里没有这瓶药水';
          st.items[p]--;
          var dd2 = E(st);
          if (p === 'hp') { st.hp = (Number(st.hp) || 0) + Math.ceil(dd2.maxHp * 0.4); blog(st, { a: '饮用 ' + po.n, t: '药水', note: '+40% HP' }); return ok('🧪 饮用「' + po.n + '」——HP 回复 40%'); }
          if (p === 'mp') { st.mp = (Number(st.mp) || 0) + Math.ceil(dd2.maxMp * 0.4); blog(st, { a: '饮用 ' + po.n, t: '药水', note: '+40% MP' }); return ok('🔵 饮用「' + po.n + '」——' + resOf(st) + ' 回复 40%'); }
          /* 力量药剂 → 施加攻击增益 Buff */
          var bf = BUFFS.atk; addBuff(st, bf);
          blog(st, { a: '饮用 ' + po.n, t: '增益', note: '攻击 +' + bf.atk + ' / ' + bf.turns + ' 回合' });
          return ok('⚗️ 饮用「' + po.n + '」——攻击 +' + bf.atk + '（' + bf.turns + ' 回合）');
        }
        if (a === 'teleport') {
          var mi = parseInt(p, 10);
          if (isNaN(mi) || mi < 0 || mi >= maps.length) return '没有这个地名';
          if (mi === (Number(st.mapIdx) || 0)) return '已经身处此地';
          var cost = 10 + mi * 5;
          if ((Number(st.gold) || 0) < cost) return '💰 ' + w.cur + '不足（' + st.gold + '/' + cost + '）';
          st.gold -= cost; st.mapIdx = mi; st.map = maps[mi];
          /* v4.06.0：跨区传送同步切换分区——第二资源与品级叫法随之切换 */
          var zid = (w.zoneOf && w.zoneOf[maps[mi]]) ? w.zoneOf[maps[mi]] : st.zone;
          var zChanged = zid && zid !== st.zone;
          st.zone = zid || st.zone;
          var zn = zoneObj(st);
          st.visited = st.visited || {}; st.visited[maps[mi]] = 1;
          var qm3 = qprog(st, 'reach', 1, maps[mi]);
          if (qm3.length) blog(st, { a: '委托推进', t: '委托', note: qm3.join('；') });
          refreshBoard(st, false);
          blog(st, { a: '地图传送', res: maps[mi], t: '传送', note: '-' + cost + ' ' + w.cur + (zChanged ? ' · 进入 ' + zn.n : '') });
          return ok('📍 传送至「' + maps[mi] + '」，花费 ' + cost + ' ' + w.cur + (zChanged ? '（已进入 ' + zn.n + '，第二资源切换为 ' + zn.res + '）' : ''));
        }
        if (a === 'enhance') {
          var e0 = st.equip[p];
          if (!e0 || typeof e0 !== 'object') return '该槽位没有可强化的装备';
          var enhLv = Math.max(0, Math.round(Number(e0.lv) || 0));
          /* 成功率 70 − N×8（下限 15）随 +N 递减；费用随角色等级与 +N 上涨 */
          var rate = Engine.enhanceRate(enhLv);
          var ecost = Engine.enhanceCost(st.lv, enhLv);
          if ((Number(st.gold) || 0) < ecost) return '💰 ' + w.cur + '不足（' + st.gold + '/' + ecost + '）';
          st.gold -= ecost;
          st.enhSeq = (Number(st.enhSeq) || 0) + 1;
          /* 确定性成功率：hash(界|序列|槽|等级|+N)，同输入恒同结果 */
          var roll = Engine.hash(g + '|' + st.enhSeq + '|' + p + '|' + st.lv + '|' + enhLv) % 100;
          var success = roll < rate;
          if (success) {
            var up = Math.round(4 + (Number(st.lv) || 1) * 0.6);
            e0.atk = (Number(e0.atk) || 0) + up; e0.def = (Number(e0.def) || 0) + Math.round(2 + st.lv * 0.3);
            e0.hp = (Number(e0.hp) || 0) + (Number(st.lv) || 1) * 5; e0.lv = enhLv + 1;
            blog(st, { a: '强化 ' + Engine.equipLabel(e0), t: '强化', note: '成功 · 攻 +' + up + ' · +' + e0.lv + ' · 成功率 ' + rate + '%' });
            return ok('🔨 强化成功！「' + Engine.equipLabel(e0) + '」攻 +' + up + '（+' + e0.lv + '），成功率 ' + rate + '%，花费 ' + ecost + ' ' + w.cur);
          }
          /* 失败：扣金币、装备不毁、强化等级不变（绝不做碎装 / 掉级） */
          blog(st, { a: '强化 ' + Engine.equipLabel(e0), t: '强化', note: '失败 · 扣 ' + ecost + ' ' + w.cur + ' · 装备不毁 · +' + enhLv + ' 不变 · 成功率 ' + rate + '%' });
          return ok('🔨 强化失败（已扣 ' + ecost + ' ' + w.cur + '，装备不毁、+' + enhLv + ' 不变），本次成功率 ' + rate + '%；下次仍为 ' + rate + '%');
        }
        if (a === 'pet') {
          if (p === 'summon') {
            st.pet.active = !st.pet.active;
            if (st.pet.active && !st.pet.name) st.pet.name = w.petName;
            blog(st, { a: st.pet.active ? '召唤宠物' : '收回宠物', t: '宠物', note: w.petName + ' · 出战加成 ' + Engine.petBonus(st.pet) });
            return ok((st.pet.active ? '🐾 召唤「' + w.petName + '」——出战，攻击 +' + Engine.petBonus(st.pet) : '🐾 收回宠物——出战加成移除')
              + '（Lv.' + st.pet.level + ' 经验 ' + st.pet.exp + '/30 忠诚 ' + st.pet.loyalty + '）');
          }
          if (p === 'feed') {
            if ((Number(st.gold) || 0) < 15) return '💰 ' + w.cur + '不足（' + st.gold + '/15）';
            st.gold -= 15; st.pet.active = true;
            if (!st.pet.name) st.pet.name = w.petName;
            /* 忠诚度提高喂食效率；经验累积升级，升级额外提升成长值（出战加成仍只按 growth 算一次） */
            var loyalFactor = 1 + Math.floor((Number(st.pet.loyalty) || 0) / 25);
            var expGain = 12 * loyalFactor;
            st.pet.exp = (Number(st.pet.exp) || 0) + expGain;
            st.pet.loyalty = Math.min(100, (Number(st.pet.loyalty) || 0) + 2);
            var lv0 = Math.max(1, Math.round(Number(st.pet.level) || 1)), lv1 = lv0, guard = 0;
            while (st.pet.exp >= 30 && guard++ < 50) { st.pet.exp -= 30; lv1++; }
            st.pet.level = lv1;
            var growthGain = 2 + (lv1 - lv0);   /* 基础 +2，每升 1 级额外 +1 */
            st.pet.growth = (Number(st.pet.growth) || 0) + growthGain;
            blog(st, { a: '喂食宠物', t: '宠物', note: '经验 +' + expGain + ' · 忠诚 ' + st.pet.loyalty + ' · 成长值 +' + growthGain + ' → ' + st.pet.growth + (lv1 > lv0 ? ' · 升至 Lv.' + lv1 : '') });
            return ok('🍖 喂食「' + w.petName + '」——经验 +' + expGain + '、成长值 +' + growthGain + '（现 ' + st.pet.growth + '）、出战攻击 +' + Engine.petBonus(st.pet)
              + '（Lv.' + st.pet.level + ' 经验 ' + st.pet.exp + '/30 忠诚 ' + st.pet.loyalty + '）' + (lv1 > lv0 ? '，宠物升级！' : ''));
          }
          return '未知宠物操作';
        }
        if (a === 'party') {
          var mx = Math.max(1, Math.min(5, Math.round(Number(st.party.max) || 5)));
          if (!Array.isArray(st.party.members)) st.party.members = [];
          if (p === 'join') {
            if (st.party.members.length + 1 >= mx) return '队伍已满（上限 ' + mx + ' 人）';
            st.party.members.push(Engine.makePartyMember(g + '|party|' + st.party.members.length));
          } else if (p === 'leave') {
            if (!st.party.members.length) return '队伍里只有自己';
            st.party.members.pop();
          } else return '未知组队操作';
          st.party.size = 1 + st.party.members.length;   /* 与名单自洽；derive 仍仅按 size 加一次 */
          var pn = st.party.size;
          var names = st.party.members.map(Engine.memberLabel).join('、') || '仅自己';
          blog(st, { a: p === 'join' ? '组队' : '离队', t: '社交', note: '队伍 ' + pn + ' 人 · ' + names });
          return ok('👥 队伍 ' + pn + ' 人——攻 +' + ((pn - 1) * 3) + ' 防 +' + ((pn - 1) * 2) + '｜队友：' + names);
        }
        if (a === 'guild') {
          if (p === 'join') {
            if (st.guild.name) return ok('🏛 你已在「' + st.guild.name + '」（' + (st.guild.rank || '见习成员') + '），无需重复加入');
            st.guild.name = w.guildName;
            var jr = Engine.guildRank(Number(st.guild.contrib) || 0);
            st.guild.level = jr.level; st.guild.rank = jr.rank;
            st.rep += 5;
            /* v4.07.0 加入势力后立刻刷新委托板——玩家自己的势力会随即发布内务委托 */
            refreshBoard(st, true);
            blog(st, { a: '加入公会', t: '社交', note: w.guildName + ' · ' + jr.rank + ' · 声望 +5' });
            return ok('🏛 加入「' + w.guildName + '」——' + jr.rank + '（公会 Lv.' + jr.level + '），声望 +5');
          }
          if (p === 'found' || String(p).indexOf('found:') === 0) {
            if (st.guild.name) return '你已在「' + st.guild.name + '」——先离开才能另立门户';
            var fnm = String(p).indexOf('found:') === 0 ? String(p).slice(6).trim() : '';
            if (!fnm) {
              var fp = (window.KB_NAMES && window.KB_NAMES.wangyou && window.KB_NAMES.wangyou.playerFactions) || ['无名之旗'];
              fnm = fp[Engine.hash(g + '|found|' + (st.name || '玩家') + '|' + st.lv) % fp.length];
            }
            if (!fnm || fnm.length < 2) return '势力名至少 2 个字';
            st.guild.name = fnm; st.guild.origin = 'player'; st.guild.seat = st.map || w.startMap;
            var fr = Engine.guildRank(st.guild.contrib);
            st.guild.level = fr.level; st.guild.rank = fr.rank;
            syncFactionToWorld(st);
            blog(st, { a: '创建势力', t: '社交', note: fnm + ' · 驻地 ' + seatOf(st) + ' · 已上图' });
            return ok('🏴 你自立门户——「' + fnm + '」在' + seatOf(st) + '挂旗，已同步到舆图；先去任务板领第一份势力内务吧');
          }
          if (p === 'leave') {
            if (!st.guild.name) return '你还没有加入任何势力';
            var oldG = st.guild.name;
            st.guild.name = ''; st.guild.origin = ''; st.guild.seat = ''; st.guild.contrib = 0;
            st.guild.level = 1; st.guild.rank = '';
            try {
              var fw2 = window.storyFramework;
              if (fw2 && fw2.storyState && fw2.storyState.variables && fw2.storyState.variables.entities
                && fw2.storyState.variables.entities.factions) {
                delete fw2.storyState.variables.entities.factions['玩家势力·' + oldG];
                if (window.StoryAtlas && window.StoryAtlas.syncEntities) window.StoryAtlas.syncEntities(fw2.storyState.variables);
              }
            } catch (e) {}
            blog(st, { a: '离开势力', t: '社交', note: oldG + ' · 舆图据点已撤除' });
            return ok('🚪 你离开了「' + oldG + '」——舆图上的据点已撤除');
          }
          if (p === 'contrib') {
            if (!st.guild.name) return '先加入一个公会';
            if ((Number(st.gold) || 0) < 20) return '💰 ' + w.cur + '不足（' + st.gold + '/20）';
            var lvBefore = Math.max(1, Math.round(Number(st.guild.level) || 1));
            st.gold -= 20; st.guild.contrib = (Number(st.guild.contrib) || 0) + 10; st.rep += 8;
            syncFactionToWorld(st);
            var cr = Engine.guildRank(st.guild.contrib);
            st.guild.level = cr.level; st.guild.rank = cr.rank;
            var promoted = cr.level > lvBefore;
            blog(st, { a: '公会贡献', t: '社交', note: '贡献 +10 · 声望 +8 · ' + cr.rank + (promoted ? '（晋升！）' : '') });
            return ok('🏛 向「' + st.guild.name + '」贡献——贡献 +10（现 ' + st.guild.contrib + '）、声望 +8，职位「' + cr.rank + '」（公会 Lv.' + cr.level + '）' + (promoted ? '，晋升！' : ''));
          }
          return '未知公会操作';
        }
        if (a === 'arena') {
          if ((Number(st.hp) || 0) <= 0) return '💀 气血耗尽——请先「休整」或使用生命药水再挑战';
          var bouts = (Number(st.arenaWins) || 0) + (Number(st.arenaLoss) || 0);
          var seed = g + '|arena|' + bouts + '|' + st.lv + '|' + st.round;
          var foe = Engine.makeFoe(seed, st.lv);   /* 确定性对手实体：名字/等级/战力/HP/攻防/暴击 */
          /* v4.05.1 平衡：对手按玩家实际战力缩放，胜负接近五五开，失败要真掉血 */
          var foeScale = 0.92 + (Engine.hash(seed + '|s') % 22) / 100;
          foe.hp = Math.round(Math.max(foe.hp, d.atk * 3.4 * foeScale));
          foe.atk = Math.round(Math.max(foe.atk, d.atk * 0.82 * foeScale));
          foe.def = Math.round(Math.max(foe.def, d.def * 1.0));
          foe.power = Math.round(80 + foe.hp / 8 + foe.atk * 2);
          var myHp = Math.max(1, Number(st.hp) != null ? Number(st.hp) : d.maxHp);
          var foeHp = foe.hp, myTotal = 0, foeTotal = 0, t, m, f;
          /* 胜负与多回合累计伤害 / 双方 HP 挂钩：最多 3 回合，任一方 HP 归零提前结束 */
          for (t = 0; t < 3; t++) {
            m = Engine.damage(d.atk, foe.def, 1.0, d.crit, seed + '|m' + t);
            f = Engine.damage(foe.atk, d.def, 1.0, foe.crit, seed + '|f' + t);
            myTotal += m.value; foeTotal += f.value;
            foeHp -= m.value; myHp -= f.value;
            if (foeHp <= 0 || myHp <= 0) break;
          }
          var win = foeHp <= 0 ? true : myHp <= 0 ? false : myTotal >= foeTotal;
          /* 奖励随对手战力浮动（scale = 战力/100 取整，至少 1） */
          var scale = Math.min(8, Math.max(1, Math.round(foe.power / 100)));
          var goldWin = 6 + scale * 4, repWin = 3 + scale * 2, repLose = 1;
          st.arenaLastFoe = { name: foe.name, lv: foe.lv, power: foe.power };
          if (win) {
            st.arenaWins = (Number(st.arenaWins) || 0) + 1;
            st.arenaStreak = (Number(st.arenaStreak) || 0) + 1;
            st.arenaBest = Math.max(Number(st.arenaBest) || 0, st.arenaStreak);
            st.gold += goldWin; st.rep += repWin;
            /* v4.07.0 竞技场胜场推进「竞技场悬赏」类委托 */
            var qm4 = qprog(st, 'wins', 1, st.map);
            if (qm4.length) blog(st, { a: '委托推进', t: '委托', note: qm4.join('；') });
          } else {
            st.arenaLoss = (Number(st.arenaLoss) || 0) + 1;
            st.arenaStreak = 0; st.rep += repLose;
            st.hp = (Number(st.hp) != null ? Number(st.hp) : d.maxHp) - Math.max(1, Math.round(foeTotal * 0.28));
          }
          blog(st, { a: '竞技场 · 对阵 ' + foe.name, dmg: myTotal, crit: false, res: win ? '胜' : '负', t: 'PK',
            note: '对手 Lv.' + foe.lv + ' 战力 ' + foe.power + ' · 三回合累计 我方 ' + myTotal + ' / 对手 ' + foeTotal
              + ' · ' + (win ? ('声望 +' + repWin + ' ' + w.cur + ' +' + goldWin + ' · 连胜 ' + st.arenaStreak) : ('声望 +' + repLose + ' · 连胜中断')) });
          return ok((win ? '🏆 竞技场获胜' : '🛡 竞技场惜败') + '——对阵「' + foe.name + '」(Lv.' + foe.lv + ' 战力 ' + foe.power + ')'
            + '，三回合累计 我方 ' + myTotal + ' / 对手 ' + foeTotal
            + (win ? ('，声望 +' + repWin + '、' + w.cur + ' +' + goldWin + '、连胜 ' + st.arenaStreak + '（最高 ' + st.arenaBest + '）') : ('，声望 +' + repLose + '、连胜中断')));
        }
        if (a === 'buff') {
          var b0 = BUFFS[p];
          if (!b0) return '未知状态';
          addBuff(st, b0);
          blog(st, { a: (b0.kind === 'debuff' ? '受到减益 ' : '施加增益 ') + b0.n, t: '状态', note: '攻 ' + (b0.atk >= 0 ? '+' : '') + b0.atk + ' 防 ' + (b0.def >= 0 ? '+' : '') + b0.def + ' / ' + b0.turns + ' 回合' });
          return ok((b0.kind === 'debuff' ? '💀 ' : '✨ ') + b0.n + '——攻 ' + (b0.atk >= 0 ? '+' : '') + b0.atk + ' 防 ' + (b0.def >= 0 ? '+' : '') + b0.def + '，持续 ' + b0.turns + ' 回合');
        }
        if (a === 'tick') {
          st.round = (Number(st.round) || 0) + 1;
          tickBuffs(st);
          var dd3 = E(st);
          st.hp = (Number(st.hp) || 0) + Math.ceil(dd3.maxHp * 0.05);
          st.mp = (Number(st.mp) || 0) + Math.ceil(dd3.maxMp * 0.08);
          /* v4.07.0 世界在转：统一时钟推进（每 8 回合过一天；跨日则局势轮换、委托板换一批） */
          var prevDay = Number(st.worldDay) || 0;
          advanceWorld(st);
          /* 玩家势力的影响力随世界时钟演进，舆图据点随之变化 */
          if (st.guild && st.guild.name && st.guild.origin === 'player') syncFactionToWorld(st);
          blog(st, { a: '结束回合', t: '回合', res: '第 ' + st.round + ' 回合', note: 'Buff 回合 -1 · 回血蓝 · 世界第 ' + ((Number(st.worldDay) || 0) + 1) + ' 日' });
          return ok('⏭ 第 ' + st.round + ' 回合——Buff/冷却递减，HP/MP 小幅回复' + (st.worldDay === prevDay ? '' : '｜世界第 ' + ((Number(st.worldDay) || 0) + 1) + ' 日，局势已变'));
        }
        /* v4.07.0 玩法路线：剧情（走三部曲主线）↔ 沙盒（纯自由探索，无强制主线） */
        if (a === 'mode') {
          var nm = String(p || '');
          if (nm !== 'story' && nm !== 'sandbox') return '未知玩法路线（可选 story 剧情 / sandbox 沙盒）';
          if (st.mode === nm) return ok('🎭 当前已是「' + (nm === 'story' ? '剧情路线' : '沙盒路线') + '」');
          st.mode = nm;
          refreshBoard(st, true);
          var mm = nm === 'story' ? '剧情路线：主线章节照常推进，委托作为支线并行。' : '沙盒路线：没有强制主线，任务板完全由当下世界局势生成，随时可接可弃。';
          blog(st, { a: '切换玩法路线', t: '路线', note: mm });
          return ok('🎭 玩法路线 → ' + (nm === 'story' ? '剧情路线' : '沙盒路线') + '｜' + mm);
        }
        /* v4.07.0 委托：接取 */
        if (a === 'qaccept') {
          var qid = String(p || '');
          /* 优先在当前板面里找：若先刷新板面，玩家点下的一瞬可能凭空消失 */
          var of = (st.quests.offers || []).filter(function (o) { return o.id === qid; })[0];
          if (!of) {
            refreshBoard(st, false);
            of = (st.quests.offers || []).filter(function (o) { return o.id === qid; })[0];
          }
          if (!of) return '这条委托已经不在板上了（世界局势变了，或已被他人接走）';
          if (st.quests.active.length >= 8) return '📋 同时进行的委托已达 8 条上限，先完成或放弃一条';
          if ((Number(st.lv) || 1) < (Number(of.lv) - 4)) return '🔒 委托等级 Lv.' + of.lv + ' 超出你当前能力（Lv.' + st.lv + '）';
          of.state = 'active'; of.cur = 0;
          st.quests.active.push(of);
          st.quests.offers = st.quests.offers.filter(function (o) { return o.id !== qid; });
          blog(st, { a: '接取委托', t: '委托', note: of.title + ' · ' + of.giver + ' · 时限 ' + of.due + ' 回合' });
          return ok('📋 接取委托「' + of.title + '」——委托人 ' + of.giver + '｜目标 ' + of.need + '｜时限 ' + of.due + ' 回合｜完成后可得 ' + of.gold + ' ' + w.cur + ' + ' + of.exp + ' 经验 + ' + of.rep + ' 声望（**尚未到账**，交付后才会入账）');
        }
        /* v4.07.0 委托：交付 */
        if (a === 'qturnin') {
          var tid = String(p || '');
          var tq = (st.quests.active || []).filter(function (x) { return x.id === tid; })[0];
          if (!tq) return '没有这条进行中的委托';
          if (tq.state !== 'done') return '🔒 委托尚未完成（' + tq.cur + '/' + tq.need + '）';
          /* v4.10.0 修 P1-9：委托数据可能缺 gold/exp/rep（老存档 / 外部脏数据），
             直接 += undefined 会变 NaN，随后把整个钱包洗成默认金币。逐字段兜底为
             有限非负数，交付动作绝不污染玩家余额（normalizeState 已做第一层回填，
             这里是结算路径的第二层防御）。 */
          var qGold = Number(tq.gold); if (!isFinite(qGold) || qGold < 0) qGold = 0;
          var qRep = Number(tq.rep); if (!isFinite(qRep) || qRep < 0) qRep = 0;
          var qExp = Number(tq.exp); if (!isFinite(qExp) || qExp < 0) qExp = 0;
          st.gold = (Number(st.gold) || 0) + qGold;
          st.rep = (Number(st.rep) || 0) + qRep;
          var ge2 = Engine.gainExp(st, qExp);
          st.lv = ge2.lv; st.exp = ge2.exp; st.points = (Number(st.points) || 0) + ge2.points;
          st.quests.done = (Number(st.quests.done) || 0) + 1;
          st.quests.active = st.quests.active.filter(function (x) { return x.id !== tid; });
          blog(st, { a: '交付委托', t: '委托', note: tq.title + ' · ' + w.cur + ' +' + qGold + ' · 声望 +' + qRep + ' · 经验 +' + qExp });
          return ok('✅ 交付「' + tq.title + '」——' + w.cur + ' +' + qGold + '、声望 +' + qRep + '、经验 +' + qExp + '（' + (ge2.ups ? '升级至 Lv.' + ge2.lv + '！' : '当前 Lv.' + ge2.lv) + '）');
        }
        /* v4.07.0 委托：放弃 */
        if (a === 'qgiveup') {
          var gid = String(p || '');
          var gq = (st.quests.active || []).filter(function (x) { return x.id === gid; })[0];
          if (!gq) return '没有这条进行中的委托';
          st.quests.active = st.quests.active.filter(function (x) { return x.id !== gid; });
          st.quests.failed = (Number(st.quests.failed) || 0) + 1;
          st.rep = Math.max(0, (Number(st.rep) || 0) - 1);
          refreshBoard(st, true);
          blog(st, { a: '放弃委托', t: '委托', note: gq.title + ' · 声望 -1' });
          return ok('🗑 放弃「' + gq.title + '」——声望 -1，委托板会补上新任务');
        }
        if (a === 'achieveclaim') {
          var ac = null; for (i = 0; i < ACHS.length; i++) if (ACHS[i].id === p) ac = ACHS[i];
          if (!ac) return '没有这个成就';
          if (st.ach.indexOf(ac.id) >= 0) return '该成就奖励已领取';
          if (!ac.test(st, w)) return '🔒 尚未达成：' + ac.cond;
          st.ach.push(ac.id); st.gold += ac.gold; st.rep += ac.rep;
          blog(st, { a: '达成成就 ' + ac.n, t: '成就', note: w.cur + ' +' + ac.gold + ' · 声望 +' + ac.rep });
          return ok('🏅 成就「' + ac.n + '」达成——' + w.cur + ' +' + ac.gold + '，声望 +' + ac.rep);
        }
        if (a === 'questclaim') {
          var arc = questArc(g), stages = arc.st || [], nst = stages.length || 3;
          var qi = (p === '' ? -1 : parseInt(p, 10));
          /* 真实任务条件：等级门槛 + 击杀数 + 前一幕已领取（与竞技场胜场完全解耦） */
          if (qi < 0) { for (i = 0; i < nst; i++) if (st.questDone.indexOf(i) < 0 && Engine.questCond(st, i, nst).ok) { qi = i; break; } }
          if (isNaN(qi) || qi < 0 || qi >= nst) return '暂无可领取的主线奖励（需达成等级 / 击杀条件，并领完前置幕）';
          if (st.questDone.indexOf(qi) >= 0) return '该幕奖励已领取';
          var qc = Engine.questCond(st, qi, nst);
          if (!qc.ok) {
            var miss = [];
            if (!qc.prev) miss.push('先领取第 ' + qi + ' 幕');
            if (!qc.lv) miss.push('等级 Lv.' + qc.lvCur + '/' + qc.need.lv);
            if (!qc.kills) miss.push('击杀 ' + qc.killCur + '/' + qc.need.kills);
            return '🔒 第 ' + (qi + 1) + ' 幕未达成：' + miss.join('、');
          }
          var qgold = 40 + qi * 30, qrep = 10 + qi * 10;
          st.questDone.push(qi); st.gold += qgold; st.rep += qrep;
          blog(st, { a: '主线领奖 · 第 ' + (qi + 1) + ' 幕', t: '任务', note: w.cur + ' +' + qgold + ' · 声望 +' + qrep + ' · 等级/击杀条件达成' });
          return ok('🧭 领取第 ' + (qi + 1) + ' 幕「' + ((stages[qi] || [])[0] || '') + '」奖励——' + w.cur + ' +' + qgold + '，声望 +' + qrep);
        }
        if (a === 'clearlog') {
          st.blog = [];
          return ok('🧹 战斗日志已清空');
        }
        return null;
      },

      /* ---------------- 七标签 UI ---------------- */
      html: function (st, s) {
        var d = E(st), hp = Number(st.hp != null ? st.hp : d.maxHp), mp = Number(st.mp != null ? st.mp : d.maxMp);
        var need = Engine.expToNext(st.lv);
        var pct = function (v, m) { return Math.max(0, Math.min(100, Math.round((Number(v) || 0) / Math.max(1, m) * 100))); };
        R = { st: st, d: d, w: w, g: g, maps: maps, hp: hp, mp: mp, need: need, pct: pct, cur: (window && window.__rpgTabCur) || 'role' };
        var o = '<div class="rpg-panel" data-rpg-genre="' + esc(g) + '">';
        /* 顶部身份 + 资源 */
        o += '<div class="rpg-top">'
          + '<div class="rpg-id"><b class="rpg-lv">Lv.' + st.lv + '</b><span>' + esc(clsName(st)) + '</span><em>' + esc(st.title || '') + '</em></div>'
          + '<div class="rpg-cur"><span>' + esc(w.cur) + '</span><b>' + st.gold + '</b></div>'
          + '<div class="rpg-cur"><span>🏅 声望</span><b>' + st.rep + '</b></div>'
          + '</div>';
        /* 标签栏 */
        o += '<div class="rpg-tabs">';
        TABS.forEach(function (t) { o += '<button type="button" class="rpg-tab' + (t[0] === R.cur ? ' on' : '') + '" data-rpg-tab="' + t[0] + '"><i>' + t[1] + '</i>' + t[2] + '</button>'; });
        o += '</div>';
        /* 快捷栏导航 */
        o += '<div class="rpg-quick"><span>⚡ 快捷</span>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="rest" data-rpg-arg="">🛌 休整</button>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="loot" data-rpg-arg="">🎁 掉落</button>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="buy" data-rpg-arg="hp">🧪 买药</button>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="teleport" data-rpg-arg="1">📍 传送</button>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="arena" data-rpg-arg="">⚔️ PK</button>'
          + '<button type="button" class="rpg-btn q" data-rpg-act="tick" data-rpg-arg="">⏭ 回合</button>'
          + '</div>';
        o += '<div class="rpg-panes">'
          + pane('role', pRole()) + pane('bag', pBag()) + pane('skill', pSkill())
          + pane('quest', pQuest()) + pane('map', pMap()) + pane('social', pSocial())
          + pane('battle', pBattle())
          + '</div>';
        o += '<div class="rpg-tip">数值由引擎确定性结算：升级按 80×Lv^1.55 经验，伤害按 攻击×倍率−防御×0.55（hash(seed) 判暴击），强化/PK 用确定性种子。正文数值须与此面板一致。</div>';
        o += '</div>';
        return o;
      },
      directive: function (st) {
        var d = E(st), hp = Number(st.hp != null ? st.hp : d.maxHp), mp = Number(st.mp != null ? st.mp : d.maxMp);
        /* v4.07.0：把「当前路线 + 本区局势 + 手头委托」一并交给主笔，AI 才知道玩家在干什么 */
        var sitNow = ((st.situation && st.situation.list) || []).filter(function (x) { return x.zone === st.zone; })[0] || null;
        var actNow = (st.quests && st.quests.active) || [];
        var tier = (window.BaseModelMode && window.BaseModelMode.ctxTier) ? window.BaseModelMode.ctxTier() : 'normal';
        var eq = Object.keys(st.equip || {}).map(function (k) { var e = st.equip[k]; return e ? e.n + '(' + (e.tier || '') + ')' : ''; }).filter(Boolean).join('、');
        if (tier === 'tiny') {
          return '【网游面板】Lv.' + st.lv + ' ' + clsName(st) + '｜' + zoneObj(st).short + '｜HP ' + hp + '/' + d.maxHp + '｜' + resOf(st) + ' ' + mp + '/' + d.maxMp + '｜攻 ' + d.atk + ' 防 ' + d.def + '｜' + w.cur + ' ' + st.gold + '｜' + st.map
            + '。只准用这些数字，严禁自编等级、经验、装备或伤害数值；野怪与对手只写外形、名称与相对强弱（如「绿名怪」「高出一阶」），严禁给它们标注具体等级或 HP 数字；剧情要升级就写「经验条涨了一截」，不要写具体级数。'
            /* v4.07.2：低配档同样要带上一轮动作结算，否则低配玩家拿到的仍是「动作前」快照，AI 照样会编。 */
            + (st.actLog && st.actLog.length
              ? ('【上轮结算】' + st.actLog.slice(-2).join('；') + '（以引擎判定为准，正文数字须一致）')
              : '');
        }
        return '【网游角色面板·本轮快照】《' + w.game + '》｜' + clsName(st) + ' Lv.' + st.lv + '（经验 ' + st.exp + '/' + Engine.expToNext(st.lv) + '）｜HP ' + hp + '/' + d.maxHp + '｜' + resOf(st) + ' ' + mp + '/' + d.maxMp
          + '｜六维 ' + DIMS.map(function (x) { return x.n + d.attr[x.k]; }).join(' ')
          + '｜攻 ' + d.atk + ' 防 ' + d.def + ' 魔防 ' + d.mdef + ' 暴击 ' + d.crit + '%'
          + '｜装备 ' + (eq || '无') + '｜' + w.cur + ' ' + st.gold + ' 声望 ' + st.rep + '｜当前地图 ' + st.map
          + '。\n【数值契约】正文写到的等级、伤害、耗蓝、掉落、升级必须与本快照一致，只准引用快照里的数字；严禁自行编造等级、经验值、属性表或角色档案（例如凭空写「Lv.8」「经验 632/1200」）。'
          /* v4.08.0 修 D-34（模型对 HP/蓝量自行加法）：
             实测（wangyou 深度旅程 quest2 步）引擎真值 HP 304/403，
             正文写成「HP 346/403」「我现在的HP是346」——304+42（结算里的反击伤害）= 346，
             模型把「当前值 + 本次结算增量」自己加了一遍。
             这类错误比凭空编造更隐蔽：数字看着合理、且有来源，但算错了。
             修法：明确「当前值一律照抄快照，增量绝不参与当前值的计算」。 */
          + '当前值一律**照抄**本快照里的数字，绝不做任何加减乘除——本轮结算里的「-42 HP」是刚刚发生的变化，绝不可把它加回当前 HP（实测出现过把当前 304 加上反击 42 写成 346）。'
          + '野怪与对手的等级、HP 由引擎「练级目标」管理，正文只写外形、名称与相对强弱（如「绿名怪」「高出一阶」），严禁给它们标注具体等级或 HP 数字。剧情要升级就写「经验条涨了一截」，具体结算交给引擎。需变更时在 (variable_update) 块写 >>网游面板.exp: +120 等行。禁止编造本界品级序列（' + w.tiers.slice(0, 4).join('→') + '…）之外的装备品级。'
          + '\n【分区一致性】玩家当前所在分区是「' + zoneObj(st).n + '」，该区品级叫法为「' + (zoneObj(st).tierNote || w.tiers.join('→')) + '」，第二资源为「' + resOf(st) + '」。正文提到装备品级必须用本区的叫法；只有明确写「跨服／合流／中枢」时才允许出现他区品级与专名。'
          + '\n【玩法路线与委托】当前路线：' + (st.mode === 'story' ? '剧情路线（走失落叶网游三部曲主线章节）' : '沙盒路线（无强制主线，玩家自由探索、自行接活）') + '。'
          + '本区局势：' + (sitNow ? (sitNow.sitN + '·' + (sitNow.verb || '正在发生') + '，' + (sitNow.foe || '不明敌人') + '出没') : '暂时平静') + '。'
          + '手头委托：' + (actNow.length ? actNow.map(function (x) { return x.title + '（' + x.cur + '/' + x.need + '）'; }).join('；') : '暂无') + '。'
          + '【委托报酬尚未到账】上面委托的报酬只是预告数字，交付之前它没有真正入账——'
          + '正文不得写成「已获得」「到手」「领到」这些金币/经验/声望，也不得写因此升级；'
          + '只有引擎结算里明写了到账，正文才能写获得。'
          + '正文涉及委托时必须与上述一致，不得凭空出现未接取的委托；委托报酬与时限也照抄面板，不要自编数字。'
          + '\n【玩家势力】' + (st.guild && st.guild.name
            ? ('玩家已自立势力「' + st.guild.name + '」（职位：' + (st.guild.rank || '会长') + '，驻地：' + (st.guild.seat || st.map || '—') + '，行会贡献 ' + (st.guild.contrib || 0) + '，声望 ' + st.rep + '）。'
               + '正文提到玩家自己的势力时必须用这个名字，不得另起一个名字、不得把玩家写成加入别人的势力、不得写出本名之外的势力；'
               + '玩家势力已挂在舆图「' + (st.guild.seat || st.map || '—') + '」据点上。')
            : '玩家尚未建立或加入任何势力——正文不得让玩家凭空拥有公会、行会或势力；若剧情需要，可引导玩家自行创建。')
          /* v4.07.2 修 D-18（核心）：把玩家上一轮的动作结算结果送给 AI。
             此前引擎结算的真相（掉落多少、经验加了多少、是否升级、掉了什么装备）
             只有玩家在面板/提示里看得见，AI 拿到的永远是「动作前」的快照，
             于是只能靠猜——实测出现过「经验+80。当前经验 80/62」（当前经验超过上限，自相矛盾）
             与「Lv.2了」（实际 Lv.1）的编造。
             现在动作结果随 directive 下发，AI 与玩家看到同一份真相。
             v4.08.0 修 D-33（结算日志被照抄进正文）：
               原措辞「【上一轮动作结算 · 引擎已判定 · 必须照此写】」+「以上为引擎实际结算结果…
               正文写到的数字必须与之一致」——「必须照此写」被小模型理解为
               「把这段话抄进正文」。实测（wangyou 深度旅程 quest2 步）正文出现
               「⚔️ 基本斩击 对「雷阵守卫」造成 35 点伤害（受静电护盾减免）」
               「怒气消耗 4/96」「经验 +2（因对方为精英级NPC，经验溢出衰减）」
               ——引擎日志原文被逐行搬进正文，玩家看到的是系统日志而不是小说。
               修法：① 标题改为「判定依据 · 不得写进正文」；
                     ② 明确「这是给你判断对错的依据，不是可引用的素材」；
                     ③ 明确「正文不得出现结算日志的原文格式（动作名+伤害数值+结算语）」。 */
          + (st.actLog && st.actLog.length
            ? ('\n【上一轮动作结算 · 判定依据 · 不得写进正文】' + st.actLog.slice(-3).map(function (x) { return '· ' + x; }).join('\n')
               + '\n以上是引擎算给你的**内部判定依据**，作用是让你知道这一击到底打中了没有、掉了什么、涨了多少经验——'
               + '它不是正文素材，绝不可原文搬运、也绝不可改写成「⚔️ xxx 造成 NN 点伤害」「怒气消耗 N/N」「经验 +N」这类结算日志句式；'
               + '正文只写角色能感觉到的结果（一剑劈进骨头、伤口迸出血珠），不写日志格式、不写结算项名称。'
               + '数字口径：结算里的「+N」是**本次增量**，当前值一律照抄上方快照，绝不可自行相加'
               + '（实测出现过把「经验 +64」加到当前经验上，写出「68/62」这种自相矛盾的数字）；'
               + '若结算里没有的数值（等级、经验、掉落、金币）一律不得凭空出现，也不得说「升级了」除非结算里明写了。'
               + '结算里出现的怪物名不得在正文里加注等级、HP 或品级（如「毒蛛(Lv.1)」）——只写名称与相对强弱。')
            : '');
      }
    });

    /* ---------- 渲染小工具（读渲染上下文 R） ---------- */
    function pane(k, inner) { return '<section class="rpg-pane' + (k === R.cur ? ' on' : '') + '" data-rpg-pane="' + k + '">' + inner + '</section>'; }
    function sec(t, extra) { return '<div class="rpg-sec"><b>' + t + '</b>' + (extra ? '<span>' + extra + '</span>' : '') + '</div>'; }
    function kv(k, v) { return '<div class="rpg-kv2"><span>' + k + '</span><b>' + v + '</b></div>'; }
    function cell(sm, b, em) { return '<div class="rpg-cell"><small>' + sm + '</small><b>' + b + '</b>' + (em ? '<em>' + em + '</em>' : '') + '</div>'; }
    function empty(txt, sub) { return '<div class="rpg-empty"><i>◌</i><b>' + esc(txt) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
    function btn(label, a, p, cls, dis) { return '<button type="button" class="rpg-btn ' + (cls || '') + '"' + (dis ? ' disabled' : '') + ' data-rpg-act="' + esc(a) + '" data-rpg-arg="' + esc(p == null ? '' : String(p)) + '">' + label + '</button>'; }
    function bar(label, val, v, m, cls) { return '<div class="wr-kv rpg-kv"><span>' + label + '</span><b>' + val + '</b><i class="rpg-bar ' + cls + '" style="flex:1"><i style="width:' + R.pct(v, m) + '%"></i></i></div>'; }
    function tierSpan(t) { return '<span class="rpg-tier" data-t="' + tierIdx(t) + '">' + esc(t || '') + '</span>'; }

    /* ---------- 角色 ---------- */
    function pRole() {
      var st = R.st, d = R.d, w = R.w, o = '';
      /* v4.07.1 角色名片：与常驻状态栏错位——状态栏盯「正在变的数值」（Lv/HP/MP/经验/金币），
         名片只放「身份与上下文」（位置·称号·职业·金币·声望·世界日·委托），等级下移到六维属性标题，
         避免同一件事在两处各说一遍。 */
      var qs = st.quests || {};
      var nAct = (qs.active || []).filter(function (x) { return x && x.state === 'active'; }).length;
      var nOff = (qs.offers || []).length;
      var wDay = (Number(st.worldDay) || 0) + 1;
      o += '<div class="rpg-status rpg-namecard">'
        + '<div class="wr-stat"><span>📍 ' + esc(st.map || w.startMap) + '</span><b>' + esc(st.title || '') + '</b></div>'
        + '<div class="wr-stat"><span>🎭 职业</span><b>' + esc(clsName(st)) + '</b></div>'
        + '<div class="wr-stat"><span>💰 ' + esc(w.cur) + '</span><b>' + st.gold + '</b></div>'
        + '<div class="wr-stat"><span>🏅 声望</span><b>' + st.rep + '</b></div>'
        + '<div class="wr-stat"><span>🌐 世界</span><b>第 ' + wDay + ' 日 · 第 ' + (st.round || 0) + ' 回合</b></div>'
        + '<div class="wr-stat"><span>📜 委托</span><b>进行中 ' + nAct + ' · 可接 ' + nOff + '</b></div></div>';
      o += bar('❤️ HP', R.hp + ' / ' + d.maxHp, R.hp, d.maxHp, 'rpg-hp');
      var znR = zoneObj(R.st);
      o += '<div class="rpg-kv2"><span>所在分区</span><b>' + esc(znR.n) + '</b></div>';
      /* v4.07.0 玩法路线开关（角色页一处，任务页一处，两处都可改） */
      var isStoryR = st.mode === 'story';
      o += '<div class="rpg-kv2"><span>玩法路线</span><b>' + (isStoryR ? '🎬 剧情路线' : '🌐 沙盒路线') + '</b></div>';
      o += '<div class="rpg-chips">' + btn(isStoryR ? '转入沙盒路线' : '转入剧情路线', 'mode', isStoryR ? 'sandbox' : 'story', 'sm') + '</div>';
      o += '<div class="rpg-kv2"><span>本区品级叫法</span><b style="font-size:10.5px;line-height:1.5;">' + esc(znR.tierNote || '—') + '</b></div>';
      o += bar('🔵 ' + esc(resOf(R.st)), R.mp + ' / ' + d.maxMp, R.mp, d.maxMp, 'rpg-mp');
      o += bar('✨ 经验', st.exp + ' / ' + R.need, st.exp, R.need, 'rpg-exp');
      o += sec('六维属性', 'Lv.' + st.lv + ' · ' + (st.points ? '可分配 ' + st.points + ' 点' : '基础 + 等级成长 + 装备'));
      o += '<div class="rpg-grid">';
      DIMS.forEach(function (x) {
        var bonus = d.attr[x.k] - (Number(st.base[x.k]) || 0) - Math.floor((Number(st.lv) || 1) * ((clsCfg(st).growth[x.k]) || 0));
        o += cell(x.n, d.attr[x.k], bonus ? '+' + bonus : '');
      });
      o += '</div>';
      o += sec('战斗数值', 'Buff / 组队 / 宠物已计入');
      o += '<div class="rpg-grid">'
        + cell('攻击', d.atk) + cell('防御 / 魔防', d.def + ' / ' + d.mdef)
        + cell('暴击', d.crit + '%') + cell('攻速', d.spd)
        + cell('击杀', st.kills || 0) + cell('回合', st.round || 0)
        + '</div>';
      o += sec('装备槽', '品级：' + esc(w.tiers.slice(0, 3).join(' → ')) + ' …｜到「背包」页按槽位装备');
      o += '<div class="rpg-slots">';
      SLOTS.forEach(function (sl) {
        var e = st.equip[sl.k], mountPet = (sl.k === 'mount' && st.pet.active) ? w.petName : '';
        o += '<div class="rpg-slot ' + (e || mountPet ? 'on' : '') + '" title="' + (e ? esc(Engine.equipLabel(e)) + '｜' + esc(e.tier || '') : '空') + '"><i>' + sl.i + '</i>' + sl.n + '：'
          + (e ? esc(Engine.equipLabel(e)) + ' ' + tierSpan(e.tier) : mountPet ? esc(mountPet) + ' <span class="rpg-tier" data-t="1">出战</span>' : '<span style="opacity:.5">空</span>') + '</div>';
      });
      o += '</div>';
      o += sec('当前状态', '影响攻防');
      if (st.buffs && st.buffs.length) {
        o += '<div class="rpg-chips">';
        st.buffs.forEach(function (b) { o += '<span class="rpg-chip ' + (b.kind === 'debuff' ? 'bad' : '') + '">' + esc(b.i || '') + ' ' + esc(b.n) + ' · ' + (b.turns) + '回合</span>'; });
        o += '</div>';
      } else o += empty('暂无增益 / 减益', '去技能页施加一个状态试试');
      if (st.points > 0) {
        o += sec('分配属性点', '剩 ' + st.points + ' 点') + '<div class="rpg-chips">';
        DIMS.forEach(function (x) { o += btn(x.n + ' +1', 'addpoint', x.k, 'sm'); });
        o += '</div>';
      }
      o += sec('基础职业', '八大职业') + '<div class="rpg-chips">';
      w.classes.forEach(function (id) { o += btn(esc(CLASSES[id].n), 'setclass', id, 'sm' + (st.cls === id && !st.hidden ? ' on' : '')); });
      o += '</div>';
      /* v4.07.0 隐藏职业按分区分组（20 个），逐个列出解锁条件与达成状态 */
      var zOrder = (w.zones || []).map(function (z) { return z.id; });
      var zBy = {};
      w.hidden.forEach(function (h) { (zBy[h.zone] = zBy[h.zone] || []).push(h); });
      var zKeys = Object.keys(zBy).sort(function (a, b) {
        var ia = zOrder.indexOf(a), ib = zOrder.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      zKeys.forEach(function (zid) {
        var zn = (w.zones || []).filter(function (z) { return z.id === zid; })[0];
        o += sec('隐藏职业 · ' + (zn ? zn.short : zid), zBy[zid].length + ' 个 · ' + (zn ? zn.n : zid));
        o += '<div class="rpg-cards">';
        zBy[zid].forEach(function (h) {
          var rq = h.req || {}, need = [], okAll = (Number(st.lv) || 1) >= h.lv;
          if (rq.kills) { need.push('击杀 ' + (Number(st.kills) || 0) + '/' + rq.kills); if ((Number(st.kills) || 0) < rq.kills) okAll = false; }
          if (rq.rep) { need.push('声望 ' + (Number(st.rep) || 0) + '/' + rq.rep); if ((Number(st.rep) || 0) < rq.rep) okAll = false; }
          if (rq.arena) { need.push('竞技胜场 ' + (Number(st.arenaWins) || 0) + '/' + rq.arena); if ((Number(st.arenaWins) || 0) < rq.arena) okAll = false; }
          if (rq.contrib) { need.push('行会贡献 ' + (Number(st.guild && st.guild.contrib) || 0) + '/' + rq.contrib); if ((Number(st.guild && st.guild.contrib) || 0) < rq.contrib) okAll = false; }
          var isCur = st.hidden === h.id;
          o += '<div class="rpg-card ' + (isCur ? 'hot' : '') + '"><div class="rpg-card-hd"><b>' + esc(h.n) + (h.origin ? ' <i style="font-size:9px;opacity:.7;">原创</i>' : '') + '</b><span class="rpg-tag ' + (isCur ? 'ok' : okAll ? '' : 'bad') + '">' + (isCur ? '已转职' : (okAll ? '可转职' : '未达成')) + '</span></div>'
            + '<div class="rpg-card-bd">Lv.' + h.lv + '｜' + esc(need.join(' · ') || '仅需等级') + '</div>'
            + '<div class="rpg-card-ft">' + btn(isCur ? '当前职业' : '转职', 'setclass', h.id, 'sm', (!okAll && !isCur)) + '</div></div>';
        });
        o += '</div>';
      });
      if (st.log && st.log.length) o += '<div class="rpg-log">' + st.log.slice(-3).map(esc).join('<br>') + '</div>';
      return o;
    }

    /* ---------- 背包 / 商店 / 强化 ---------- */
    function pBag() {
      var st = R.st, w = R.w, o = '';
      o += sec('药水库存', '点击使用');
      o += '<div class="rpg-grid">';
      SHOP.forEach(function (it) { o += cell(esc(it.i + ' ' + it.n), '×' + (st.items[it.k] || 0), '') + ''; });
      o += '</div><div class="rpg-chips">';
      SHOP.forEach(function (it) { o += btn('🧪 用 ' + it.n, 'usepotion', it.k, 'sm', !(st.items[it.k] > 0)); });
      o += '</div>';
      o += sec('商店', '消耗 ' + esc(w.cur));
      o += '<div class="rpg-cards">';
      SHOP.forEach(function (it) {
        o += '<div class="rpg-card"><div class="rpg-card-hd"><i>' + it.i + '</i><b>' + esc(it.n) + '</b></div>'
          + '<div class="rpg-card-bd">' + esc(it.desc) + '</div>'
          + '<div class="rpg-card-ft"><span>' + it.price + ' ' + esc(w.cur) + '</span>' + btn('购买', 'buy', it.k, 'sm') + '</div></div>';
      });
      o += '</div>';
      o += sec('背包', (st.bag && st.bag.length ? st.bag.length + ' 件' : '空'));
      if (st.bag && st.bag.length) {
        o += '<div class="rpg-cards">';
        st.bag.forEach(function (it, ix) {
          var price = 8 + tierIdx(it && it.tier) * 6 + Math.round((Number(it && it.atk) || 0) / 4);
          var bslot = Engine.slotNameOf((it && it.slot) || 'weapon');
          o += '<div class="rpg-card"><div class="rpg-card-hd"><b>' + esc(Engine.equipLabel(it) || '未知物品') + '</b><span class="rpg-tag">' + esc(bslot) + '槽</span></div>'
            + '<div class="rpg-card-bd">攻 +' + (Number(it && it.atk) || 0) + ' · 防 +' + (Number(it && it.def) || 0) + ' · 售 ' + price + ' ' + esc(w.cur) + '</div>'
            + '<div class="rpg-card-ft">' + btn('装备', 'equipbag', ix, 'sm') + btn('出售', 'sell', ix, 'sm') + '</div></div>';
        });
        o += '</div>';
      } else o += empty('背包是空的，去打一次掉落', '点上方「掉落」或快捷栏结算一次');
      o += sec('装备强化', '成功率 70−N×8%（下限 15）· 费用随 +N 上涨 · 失败不毁装不掉级');
      var anyEquip = false;
      o += '<div class="rpg-cards">';
      SLOTS.forEach(function (sl) {
        var e = st.equip[sl.k]; if (!e || typeof e !== 'object') return;
        anyEquip = true;
        var n = Math.max(0, Math.round(Number(e.lv) || 0));
        var rate = Engine.enhanceRate(n), cost = Engine.enhanceCost(st.lv, n);
        o += '<div class="rpg-card"><div class="rpg-card-hd"><b>🔨 ' + esc(Engine.equipLabel(e)) + '</b>' + tierSpan(e.tier) + '</div>'
          + '<div class="rpg-card-bd">' + esc(sl.n) + '槽 · ' + (n ? '强化 +' + n : '未强化') + ' · 攻 ' + (Number(e.atk) || 0) + ' 防 ' + (Number(e.def) || 0)
          + '｜成功率 ' + rate + '% · 费用 ' + cost + ' ' + esc(w.cur) + '</div>'
          + '<div class="rpg-card-ft">' + btn('强化', 'enhance', sl.k, 'sm', (Number(st.gold) || 0) < cost) + '</div></div>';
      });
      o += '</div>';
      if (!anyEquip) o += empty('还没有可强化的装备', '先去结算掉落并装备');
      return o;
    }

    /* ---------- 技能 / Buff / 回合 ---------- */
    function pSkill() {
      var st = R.st, d = R.d, w = R.w, o = '';
      var list = clsCfg(st).skills;
      var hunt = st.hunt || {};
      o += sec('练级目标', '技能对该确定性野怪结算');
      o += '<div class="rpg-card hot"><div class="rpg-card-hd"><b>🎯 ' + esc(hunt.name || '野怪') + ' · Lv.' + (hunt.lv || 1) + '</b><span class="rpg-tag">HP ' + (hunt.hp || 0) + ' / ' + (hunt.maxHp || 0) + '</span></div>'
        + bar('野怪 HP', (hunt.hp || 0) + ' / ' + (hunt.maxHp || 0), hunt.hp || 0, hunt.maxHp || 1, 'rpg-hp')
        + '<div class="rpg-card-bd">每次技能对该野怪造成确定性伤害；HP 归零即击杀，' + esc(w.cur) + '/声望/经验来自野怪掉落，未击杀仅得历练经验，不凭空掉 ' + esc(w.cur) + '。</div></div>';
      o += sec('职业技能', esc(clsName(st)) + ' · ' + esc(resOf(R.st)) + ' ' + R.mp + '/' + d.maxMp);
      o += '<div class="rpg-cards">';
      list.forEach(function (sk) {
        var cd = st.cd[sk[0]] || 0, afford = (Number(st.mp) || 0) >= sk[2];
        o += '<div class="rpg-card"><div class="rpg-card-hd"><b>' + esc(sk[1]) + '</b><span class="rpg-tag">×' + sk[4] + '</span></div>'
          + '<div class="rpg-card-bd">耗 ' + esc(resOf(R.st)) + ' ' + sk[2] + ' · 冷却 ' + sk[3] + ' 轮' + (cd > 0 ? ' · <em class="rpg-cd">冷却中 ' + cd + '</em>' : '') + '</div>'
          + '<div class="rpg-card-ft">' + btn(cd > 0 ? '冷却中' : !afford ? '蓝不足' : '施展', 'skill', sk[0], 'sm', cd > 0 || !afford) + '</div></div>';
      });
      o += '</div>';
      o += sec('增益 / 减益', '状态会即时改写上方攻击与防御');
      o += '<div class="rpg-cards">';
      Object.keys(BUFFS).forEach(function (bk) {
        var b = BUFFS[bk];
        o += '<div class="rpg-card"><div class="rpg-card-hd"><i>' + b.i + '</i><b>' + esc(b.n) + '</b><span class="rpg-tag ' + (b.kind === 'debuff' ? 'bad' : '') + '">' + (b.kind === 'debuff' ? '减益' : '增益') + '</span></div>'
          + '<div class="rpg-card-bd">攻 ' + (b.atk >= 0 ? '+' : '') + b.atk + ' · 防 ' + (b.def >= 0 ? '+' : '') + b.def + ' · 持续 ' + b.turns + ' 回合</div>'
          + '<div class="rpg-card-ft">' + btn('施加', 'buff', bk, 'sm') + '</div></div>';
      });
      o += '</div>';
      o += sec('回合推进', '当前第 ' + (st.round || 0) + ' 回合');
      o += '<div class="rpg-chips">' + btn('⏭ 结束回合（Buff -1 回合 / 回血蓝）', 'tick', '', '') + '</div>';
      return o;
    }

    /* ---------- 任务 / 成就 ---------- */
    function pQuest() {
      var st = R.st, w = R.w, o = '';
      var arc = questArc(R.g), stages = arc.st || [], nst = stages.length || 3;
      var reached = 0;
      for (var ri = 0; ri < nst; ri++) if (st.questDone.indexOf(ri) >= 0) reached++;
      /* v4.07.0 玩法路线卡：玩家自由选择「走三部曲主线」或「纯沙盒探索」 */
      var isStory = st.mode === 'story';
      o += sec('玩法路线', isStory ? '剧情路线 · 主线章节为主轴' : '沙盒路线 · 无强制主线');
      o += '<div class="rpg-cards">';
      o += '<div class="rpg-card ' + (isStory ? 'hot' : '') + '"><div class="rpg-card-hd"><b>🎬 剧情路线</b><span class="rpg-tag ' + (isStory ? 'ok' : '') + '">' + (isStory ? '当前' : '可选') + '</span></div>'
        + '<div class="rpg-card-bd">按失落叶网游三部曲的既定剧情推进：' + esc(arc.title || '主线') + '，共 ' + nst + ' 章。委托作为支线并行，不打断主线节奏。</div>'
        + '<div class="rpg-card-ft">' + (isStory ? '<span class="rpg-mut">正在走这条路</span>' : btn('转入剧情路线', 'mode', 'story', 'sm')) + '</div></div>';
      o += '<div class="rpg-card ' + (isStory ? '' : 'hot') + '"><div class="rpg-card-hd"><b>🌐 沙盒路线</b><span class="rpg-tag ' + (isStory ? '' : 'ok') + '">' + (isStory ? '可选' : '当前') + '</span></div>'
        + '<div class="rpg-card-bd">纯自由探索：没有强制主线，委托板完全由当下的世界局势生成——局势变、委托换、时限到即失效。适合想自己找活干、组建势力、称霸一方的玩家。</div>'
        + '<div class="rpg-card-ft">' + (isStory ? btn('转入沙盒路线', 'mode', 'sandbox', 'sm') : '<span class="rpg-mut">正在走这条路</span>') + '</div></div>';
      o += '</div>';
      /* 世界局势摘要：委托板上出现什么，取决于此刻这片地方正在发生什么 */
      var sitL = (st.situation && st.situation.list) || [];
      var mySit = sitL.filter(function (x) { return x.zone === st.zone; })[0];
      if (mySit) {
        o += sec('当前局势 · ' + zoneObj(st).short, '世界第 ' + ((Number(st.worldDay) || 0) + 1) + ' 日');
        o += '<div class="rpg-card hot"><div class="rpg-card-hd"><b>⚠ ' + esc(mySit.sitN) + '</b><span class="rpg-tag bad">' + esc(zoneObj(st).short) + '</span></div>'
          + '<div class="rpg-card-bd">' + esc(mySit.sitN) + '·' + esc(mySit.verb || '正在发生') + '——' + esc(mySit.foe || '不明敌人') + '出没，收割' + esc(mySit.mat || '物资') + '的人手正在四处招募。</div></div>';
      }
      o += sec('主线章节', esc(arc.title || '主线') + ' · 已领 ' + reached + ' / ' + nst + (isStory ? '' : ' · 沙盒路线下为可选'));
      o += '<div class="rpg-kv"><span>领奖进度</span><b>' + reached + ' / ' + nst + '</b><i class="rpg-bar rpg-exp" style="flex:1"><i style="width:' + R.pct(reached, nst) + '%"></i></i></div>';
      o += '<div class="rpg-tip sm">主线条件：等级门槛 + 击杀数 + 前一幕已领取（与竞技场胜场解耦）。' + (isStory ? '逐幕显示「当前 / 需求」进度，✓ 已达成 / ✗ 未达成。' : '沙盒路线下主线不强制，可随时回来接着走。') + '</div>';
      o += '<div class="rpg-cards">';
      stages.forEach(function (sg, i) {
        var qc = Engine.questCond(st, i, nst), claimed = st.questDone.indexOf(i) >= 0;
        var state = claimed ? '✅ 已领奖' : qc.ok ? '🎯 可领取' : '🔒 未达成';
        var qgold = 40 + i * 30, qrep = 10 + i * 10;
        var cond = function (label, cur, need, okc) {
          return '<div class="rpg-cond ' + (okc ? 'ok' : 'no') + '"><span>' + label + '</span><b>' + cur + ' / ' + need + '</b><em>' + (okc ? '✓' : '✗') + '</em></div>';
        };
        o += '<div class="rpg-card ' + (qc.ok && !claimed ? 'hot' : '') + '"><div class="rpg-card-hd"><b>第 ' + (i + 1) + ' 幕 · ' + esc(sg[0]) + '</b><span class="rpg-tag ' + (claimed ? 'ok' : qc.ok ? '' : 'bad') + '">' + state + '</span></div>'
          + '<div class="rpg-card-bd">' + esc(sg[1]) + '｜奖励 ' + qgold + ' ' + esc(w.cur) + ' + ' + qrep + ' 声望'
          + '<div class="rpg-conds">'
          + cond('等级', 'Lv.' + qc.lvCur, 'Lv.' + qc.need.lv, qc.lv)
          + cond('击杀', qc.killCur, qc.need.kills, qc.kills)
          + cond('前置', i === 0 ? '无' : '第 ' + i + ' 幕', i === 0 ? '无' : '已领', qc.prev)
          + '</div></div>'
          + '<div class="rpg-card-ft">' + (qc.ok && !claimed ? btn('领取奖励', 'questclaim', i, 'sm') : '<span class="rpg-mut">' + state + '</span>') + '</div></div>';
      });
      if (!stages.length) o += empty('主线数据尚未载入', 'quest-chain.js 加载后自动显示三幕');
      o += '</div>';
      /* ---------- v4.07.0 委托板：随世界局势实时生成 ---------- */
      var TGT = { kills: '击杀', gather: '采集', reach: '抵达', wins: '竞技场胜场', craft: '提交锻造' };
      var SRC = { world: '局势', explore: '探索', bounty: '悬赏', guild: '势力', routine: '例行' };
      var qs = st.quests || { offers: [], active: [] };
      var actL = qs.active || [], offL = qs.offers || [];
      o += sec('委托板 · ' + (isStory ? '支线委托' : '全部任务'), '局势变则委托换 · 时限到即失效');
      o += '<div class="rpg-kv"><span>进行中 / 可接 / 已完成</span><b>' + actL.length + ' / ' + offL.length + ' / ' + (qs.done || 0) + '</b></div>';
      if (actL.length) {
        o += '<div class="rpg-cards">';
        actL.forEach(function (q) {
          var tgt = TGT[q.t] || '目标';
          var done = q.state === 'done';
          o += '<div class="rpg-card ' + (done ? 'hot' : '') + '"><div class="rpg-card-hd"><b>' + esc(q.title) + '</b><span class="rpg-tag ' + (done ? 'ok' : '') + '">' + (done ? '可交付' : esc(SRC[q.src] || '委托')) + '</span></div>'
            + '<div class="rpg-card-bd">委托人 ' + esc(q.giver) + '｜' + esc(q.place) + '｜Lv.' + q.lv + '<div class="rpg-conds">'
            + '<div class="rpg-cond ' + (q.cur >= q.need ? 'ok' : 'no') + '"><span>' + tgt + '</span><b>' + q.cur + ' / ' + q.need + '</b><em>' + (q.cur >= q.need ? '✓' : '✗') + '</em></div>'
            + '<div class="rpg-cond ' + (q.due > 3 ? 'ok' : 'no') + '"><span>时限</span><b>' + q.due + ' 回合</b><em>' + (q.due > 3 ? '✓' : '!') + '</em></div>'
            + '</div><div style="margin-top:5px;font-size:10px;opacity:.72;">报酬 ' + q.gold + ' ' + esc(w.cur) + ' + ' + q.exp + ' 经验 + ' + q.rep + ' 声望' + (q.note ? '｜' + esc(q.note) : '') + '</div></div>'
            + '<div class="rpg-card-ft">' + (done ? btn('交付领赏', 'qturnin', q.id, 'sm') : btn('放弃', 'qgiveup', q.id, 'sm')) + '</div></div>';
        });
        o += '</div>';
      }
      if (offL.length) {
        o += '<div class="rpg-cards">';
        offL.forEach(function (q) {
          var tgt = TGT[q.t] || '目标';
          o += '<div class="rpg-card"><div class="rpg-card-hd"><b>' + esc(q.title) + '</b><span class="rpg-tag">' + esc(SRC[q.src] || '委托') + '</span></div>'
            + '<div class="rpg-card-bd">委托人 ' + esc(q.giver) + '｜' + esc(q.place) + '｜Lv.' + q.lv + '<div class="rpg-conds">'
            + '<div class="rpg-cond no"><span>' + tgt + '</span><b>0 / ' + q.need + '</b><em>·</em></div>'
            + '<div class="rpg-cond ok"><span>时限</span><b>' + q.due + ' 回合</b><em>✓</em></div>'
            + '</div><div style="margin-top:5px;font-size:10px;opacity:.72;">报酬 ' + q.gold + ' ' + esc(w.cur) + ' + ' + q.exp + ' 经验 + ' + q.rep + ' 声望' + (q.note ? '｜' + esc(q.note) : '') + '</div></div>'
            + '<div class="rpg-card-ft">' + btn('接取', 'qaccept', q.id, 'sm') + '</div></div>';
        });
        o += '</div>';
      }
      if (!actL.length && !offL.length) {
        o += empty('板上暂无委托', '世界局势一变，新委托就会出现在这里');
      }
      o += sec('成就', '达成后领取 ' + esc(w.cur) + ' / 声望');
      o += '<div class="rpg-cards">';
      ACHS.forEach(function (ac) {
        var done = st.ach.indexOf(ac.id) >= 0, okc = ac.test(st, w);
        o += '<div class="rpg-card ' + (okc && !done ? 'hot' : '') + '"><div class="rpg-card-hd"><i>' + ac.i + '</i><b>' + esc(ac.n) + '</b><span class="rpg-tag ' + (done ? 'ok' : okc ? '' : 'bad') + '">' + (done ? '已领取' : okc ? '可领取' : '未达成') + '</span></div>'
          + '<div class="rpg-card-bd">' + esc(ac.cond) + '｜' + ac.gold + ' ' + esc(w.cur) + ' + ' + ac.rep + ' 声望</div>'
          + '<div class="rpg-card-ft">' + (okc && !done ? btn('领取', 'achieveclaim', ac.id, 'sm') : '<span class="rpg-mut">' + (done ? '✓' : esc(ac.cond)) + '</span>') + '</div></div>';
      });
      o += '</div>';
      return o;
    }

    /* ---------- 地图 ---------- */
    function pMap() {
      var st = R.st, w = R.w, o = '';
      var znM = zoneObj(st);
      o += sec('当前位置', esc(w.cur) + '传送');
      o += '<div class="rpg-card hot"><div class="rpg-card-hd"><b>📍 ' + esc(st.map || w.startMap) + '</b><span class="rpg-tag ok">' + esc(znM.n) + '</span></div>'
        + '<div class="rpg-card-bd">传送消耗随距离递增：第 n 个地名费用 = 10 + n×5 ' + esc(w.cur) + '。跨区传送会同步切换分区与第二资源（' + esc(znM.res) + '）。</div></div>';
      o += sec('寰宇大世界地名', '点击传送（消耗 ' + esc(w.cur) + '）');
      if (R.maps && R.maps.length) {
        /* v4.06.0：按四个分区分组显示，跨区目标一眼可辨 */
        var zs2 = w.zones || [];
        zs2.forEach(function (z) {
          var items = [];
          R.maps.forEach(function (mp, mi) {
            if ((w.zoneOf && w.zoneOf[mp]) === z.id) items.push([mp, mi]);
          });
          if (!items.length) return;
          o += '<div class="rpg-sec"><b>' + esc(z.n) + '</b><span>' + esc(z.short) + ' · ' + esc(z.res) + '</span></div>';
          o += '<div class="rpg-cards">';
          items.forEach(function (pair) {
            var mp = pair[0], mi = pair[1];
            var here = mi === (Number(st.mapIdx) || 0), cost = 10 + mi * 5;
            o += '<div class="rpg-card ' + (here ? 'hot' : '') + '"><div class="rpg-card-hd"><b>' + (mi + 1) + '. ' + esc(mp) + '</b>'
              + (here ? '<span class="rpg-tag ok">所在地</span>' : '') + '</div>'
              + '<div class="rpg-card-bd">费用 ' + cost + ' ' + esc(w.cur) + (here ? ' · 当前所在地' : '') + '</div>'
              + '<div class="rpg-card-ft">' + (here ? '<span class="rpg-mut">已在此地</span>' : btn('传送', 'teleport', mi, 'sm')) + '</div></div>';
          });
          o += '</div>';
        });
      } else o += empty('本界暂无地名数据', '');
      return o;
    }

    /* ---------- 社交：组队 / 公会 / 宠物 / 竞技场 ---------- */
    function pSocial() {
      var st = R.st, w = R.w, d = R.d, o = '';
      var psz = Number(st.party.size) || 1, mx = Number(st.party.max) || 5;
      var members = Array.isArray(st.party.members) ? st.party.members : [];
      o += sec('组队', psz + ' / ' + mx + ' 人 · 队友 ' + members.length + ' 名');
      o += '<div class="rpg-card"><div class="rpg-card-hd"><b>👥 队伍加成</b><span class="rpg-tag">攻 +' + ((psz - 1) * 3) + ' 防 +' + ((psz - 1) * 2) + '</span></div>'
        + '<div class="rpg-card-bd">每多 1 名队员，攻击 +3、防御 +2（derive 已按队伍人数计入角色页战斗数值，不重复叠加）</div>'
        + '<div class="rpg-mlist">'
        + (members.length ? members.map(function (m) { return '<span class="rpg-chip">' + esc(Engine.memberLabel(m)) + '</span>'; }).join('') : '<span class="rpg-mut">暂无队友，点「＋ 组队」确定性招募</span>')
        + '</div>'
        + '<div class="rpg-card-ft">' + btn('＋ 组队', 'party', 'join', 'sm', psz >= mx) + btn('－ 离队', 'party', 'leave', 'sm', psz <= 1) + '</div></div>';
      o += sec('势力', '加入行会，或自己立旗——自立的势力会实时出现在舆图对应位置');
      if (st.guild.name) {
        var isPlayerF = st.guild.origin === 'player';
        o += '<div class="rpg-card hot"><div class="rpg-card-hd"><b>' + (isPlayerF ? '🏴 ' : '🏛 ') + esc(st.guild.name) + '</b><span class="rpg-tag">' + (isPlayerF ? '自建势力' : '已加入') + ' · Lv.' + (st.guild.level || 1) + ' · ' + esc(st.guild.rank || '见习成员') + '</span></div>'
          + '<div class="rpg-card-bd">贡献 ' + (st.guild.contrib || 0) + '｜贡献 20 ' + esc(w.cur) + ' → 贡献值 +10、声望 +8；累计贡献按阈值晋升职位'
          + (isPlayerF ? '｜驻地 ' + esc(st.guild.seat || st.map || '—') + '，舆图上以势力据点显示，影响力随贡献与声望变化' : '') + '</div>'
          + '<div class="rpg-card-ft">' + btn('贡献', 'guild', 'contrib', 'sm') + btn('离开', 'guild', 'leave', 'sm') + '</div></div>';
      } else {
        o += empty('尚未加入任何势力', '加入行会可累积贡献与声望；也可自立门户，旗子会插在舆图上');
        o += '<div class="rpg-chips">' + btn('加入「' + esc(w.guildName) + '」', 'guild', 'join', 'sm') + btn('🏴 自立门户', 'guild', 'found', 'sm') + '</div>';
      }
      o += sec('宠物 / 坐骑', '等级 · 经验 · 忠诚度 · 出战加成');
      var pet = st.pet || {};
      o += '<div class="rpg-card"><div class="rpg-card-hd"><b>🐾 ' + esc(pet.name || w.petName) + '</b><span class="rpg-tag ' + (pet.active ? 'ok' : 'bad') + '">' + (pet.active ? '出战中' : '休息中') + '</span></div>'
        + '<div class="rpg-kv2"><span>等级 / 经验</span><b>Lv.' + (pet.level || 1) + ' · ' + (pet.exp || 0) + '/30</b></div>'
        + '<div class="rpg-kv2"><span>忠诚度</span><b>' + (pet.loyalty || 0) + ' / 100</b></div>'
        + '<div class="rpg-kv2"><span>成长值 / 出战攻击</span><b>' + (pet.growth || 0) + ' · +' + Engine.petBonus(pet) + '</b></div>'
        + '<div class="rpg-card-bd">出战攻击加成 = 2 + ⌊成长值/2⌋（与角色页一致）；喂食提升经验→升级→成长值，忠诚度提高喂食效率</div>'
        + '<div class="rpg-card-ft">' + btn(pet.active ? '收回' : '召唤', 'pet', 'summon', 'sm') + btn('🍖 喂食（15 ' + esc(w.cur) + '）', 'pet', 'feed', 'sm') + '</div></div>';
      o += sec('竞技场', '胜 ' + (st.arenaWins || 0) + ' / 负 ' + (st.arenaLoss || 0) + ' · 连胜 ' + (st.arenaStreak || 0) + '（最高 ' + (st.arenaBest || 0) + '）');
      var lf = st.arenaLastFoe;
      o += '<div class="rpg-card"><div class="rpg-card-hd"><b>⚔️ 挑战对手</b><span class="rpg-tag">攻 ' + d.atk + ' / 防 ' + d.def + '</span></div>'
        + '<div class="rpg-card-bd">' + (lf ? '最近对手「' + esc(lf.name) + '」Lv.' + lf.lv + ' 战力 ' + lf.power + '｜' : '尚无对战记录｜')
        + '三回合累计伤害 / 双方 HP 判胜负；奖励随对手战力浮动，连胜 / 最高连胜记录在此。</div>'
        + '<div class="rpg-card-ft">' + btn('🏆 挑战 PK', 'arena', '', 'sm') + '</div></div>';
      return o;
    }

    /* ---------- 战斗日志 ---------- */
    function pBattle() {
      var st = R.st, o = '';
      o += sec('战斗日志', '结构化记录 · 最近 ' + (Array.isArray(st.blog) ? st.blog.length : 0) + ' 条');
      if (!Array.isArray(st.blog)) {
        return o + '<div class="rpg-error"><b>⚠ 战斗日志数据异常</b><small>日志格式损坏，可清空后重建</small>' + btn('清空重建', 'clearlog', '', 'sm') + '</div>';
      }
      if (!st.blog.length) {
        o += empty('还没有战斗记录', '去施展一次技能、结算掉落或挑战竞技场');
      } else {
        o += '<div class="rpg-blog">';
        st.blog.slice().reverse().forEach(function (b) {
          o += '<div class="rpg-brow"><div class="rpg-bhd"><span class="rpg-btag">' + esc(b.t || '事件') + '</span><b>' + esc(b.a || '') + '</b><em>回合 ' + b.r + '</em></div>'
            + '<div class="rpg-bbd">'
            + (b.dmg ? '<span>伤害 <b>' + b.dmg + '</b>' + (b.crit ? ' <i class="rpg-crit">暴击</i>' : '') + '</span>' : '')
            + (b.res ? '<span>结果 <b>' + esc(b.res) + '</b></span>' : '')
            + (b.drop ? '<span>掉落 <b>' + esc(b.drop) + '</b></span>' : '')
            + (b.note ? '<span class="rpg-bnote">' + esc(b.note) + '</span>' : '')
            + '</div></div>';
        });
        o += '</div>';
      }
      o += sec('状态与操作', '当前第 ' + (st.round || 0) + ' 回合');
      if (st.buffs && st.buffs.length) {
        o += '<div class="rpg-chips">';
        st.buffs.forEach(function (b) { o += '<span class="rpg-chip ' + (b.kind === 'debuff' ? 'bad' : '') + '">' + esc(b.n) + ' · 余 ' + b.turns + ' 回合</span>'; });
        o += '</div>';
      } else o += empty('无生效中的状态', '技能页可施加增益 / 减益');
      o += '<div class="rpg-chips">' + btn('⚔️ 再来一战（PK）', 'arena', '', 'sm') + btn('⏭ 结束回合', 'tick', '', 'sm') + btn('🧹 清空日志', 'clearlog', '', 'sm') + '</div>';
      return o;
    }
  }

  /* ---------------- 注入 ---------------- */
  var genre = WR && WR.genre;
  if (!WORLD[genre]) { window.RPGCore = { Engine: Engine, WORLD: WORLD, module: rpgModule, SHOP: SHOP, BUFFS: BUFFS, ACHS: ACHS, TABS: TABS, QUEST_FALLBACK: QUEST_FALLBACK, questArc: questArc, tickBuffs: tickBuffs, blog: blog, normalizeState: normalizeState, questNeed: questNeed, questCond: questCond, guildRank: guildRank, petBonus: petBonus, makePartyMember: makePartyMember, memberLabel: memberLabel, makeHunt: makeHunt, makeFoe: makeFoe, makeEquipFor: makeEquipFor, slotNameOf: slotNameOf, equipLabel: equipLabel, enhanceRate: enhanceRate, enhanceCost: enhanceCost }; return; }
  var injected = false, mod = null;
  function inject() {
    if (injected) return true;
    if (!window.WorldExt || !window.WorldExt.hasModules || !window.WorldExt.hasModules()) return false;
    try {
      mod = rpgModule(genre);
      window.WorldExt.injectModules(genre, [mod]);
      mountFab();
      console.log('[RPGCore] ' + genre + ' 网游面板就位（v2 七标签）');
    } catch (e) { console.warn('[RPGCore]', e.message); }
    injected = true; return true;
  }

  /* 独立入口：沉浸套件是按需加载的，不能让玩家找不到个人面板。
     这里挂一个常驻浮标 + 抽屉，直接复用模块的 html() 渲染，数值口径唯一。 */
  function mountFab() {
    if (!document || !document.body || document.getElementById('rpgFab')) return;
    var w = WORLD[genre] || WORLD.wangyou;
    /* 共用皮肤：若静态 <link> 尚未注册（团队统一接线前），这里兜底注入，幂等不重复 */
    (function ensureSuiteCSS() {
      try {
        if (!document.head) return;
        if (document.querySelector('link[data-rpg-suite]')) return;
        var ls = document.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < ls.length; i++) if ((ls[i].href || '').indexOf('rpg-suite.css') >= 0) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = 'css/rpg-suite.css?v=4.14.0'; l.setAttribute('data-rpg-suite', '1');
        document.head.appendChild(l);
      } catch (e) {}
    })();
    var css = '#rpgFab{position:fixed;right:16px;bottom:96px;z-index:9200;border:1px solid var(--ip,#c9a86a)66;'
      + 'background:color-mix(in srgb,var(--ip,#c9a86a) 20%,#10161d);color:var(--itx,#e8dcc0);'
      + 'border-radius:22px;padding:9px 15px;font-size:12.5px;letter-spacing:1px;cursor:pointer;'
      + 'box-shadow:0 6px 22px rgba(0,0,0,.4);font-variant-numeric:tabular-nums}'
      + '#rpgFab:hover{background:color-mix(in srgb,var(--ip,#c9a86a) 34%,#10161d)}'
      + '#rpgDrawer{position:fixed;right:14px;bottom:146px;z-index:9201;width:min(440px,92vw);'
      + 'max-height:min(74vh,680px);overflow:auto;background:#0e141b;border:1px solid var(--ip,#c9a86a)44;'
      /* v4.08.0 修复（375px 小屏横向溢出 28px）：#rpgDrawer 是 content-box，
         width:calc(100vw - 16px) 之外还要加左右 padding（14px×2）→ 实际比视口宽 28px，
         面板内的快捷按钮（.rpg-btn.q）随之溢出屏幕右缘。改为 border-box。 */
      + 'box-sizing:border-box;'
      + 'border-radius:14px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);display:none;overflow-x:hidden}'
      + '#rpgDrawer.on{display:block}#rpgDrawer .rpg-hd{display:flex;align-items:center;gap:8px;'
      + 'margin-bottom:10px;font-size:13px;color:var(--ip,#c9a86a);letter-spacing:1px}'
      /* v4.08.0：关闭按钮此前无样式 → 退化成 13px 宽的小字符，手机上点不中 */
      + '#rpgDrawer .rpg-hd button{margin-left:auto;background:rgba(255,255,255,.05);'
      + 'border:1px solid var(--ip,#c9a86a)44;color:var(--imt,#9a8c6e);'
      + 'width:34px;height:34px;min-width:34px;border-radius:50%;display:inline-flex;'
      + 'align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer}'
      + '#rpgDrawer .rpg-hd button:hover{color:var(--ip,#c9a86a);border-color:var(--ip,#c9a86a)}'
      + '@media(max-width:640px){#rpgFab{right:10px;bottom:78px;padding:8px 12px}'
      + '#rpgDrawer{right:8px;bottom:126px;width:calc(100vw - 16px);max-height:66vh}'
      + '#rpgDrawer .rpg-hd button{width:38px;height:38px;min-width:38px;font-size:16px}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var fab = document.createElement('button');
    fab.id = 'rpgFab'; fab.type = 'button'; fab.textContent = '🎮 ' + w.game + ' · 角色面板';
    document.body.appendChild(fab);
    var dr = document.createElement('div'); dr.id = 'rpgDrawer'; document.body.appendChild(dr);

    var HD = '<div class="rpg-hd"><b>🎮 ' + w.game + ' · 角色面板</b><button type="button" id="rpgClose">✕</button></div>';
    var LOADING = '<div class="rpg-panel"><div class="rpg-state rpg-loading"><span class="rpg-spin"></span><b>正在同步网游数值…</b><small>加载中</small></div></div>';
    var ERROR = '<div class="rpg-panel"><div class="rpg-state rpg-error"><b>⚠ 面板数据异常</b><small>数值读取失败，可尝试休整重置</small>'
      + '<button type="button" class="rpg-btn sm" data-rpg-act="rest" data-rpg-arg="">休整重试</button></div></div>';

    /* 全局标签切换函数（data-rpg-tab + 一个函数，不传复杂对象） */
    window.RPGSuiteTab = function (key) {
      window.__rpgTabCur = key || 'role';
      if (!document) return;
      var box = document.getElementById('rpgDrawer'); if (!box) return;
      var bs = box.querySelectorAll('[data-rpg-tab]'), i;
      for (i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-rpg-tab') === window.__rpgTabCur);
      var ps = box.querySelectorAll('[data-rpg-pane]');
      for (i = 0; i < ps.length; i++) ps[i].classList.toggle('on', ps[i].getAttribute('data-rpg-pane') === window.__rpgTabCur);
    };
    function closest(el, sel) { while (el && el !== document) { if (el.nodeType === 1 && el.matches && el.matches(sel)) return el; el = el.parentNode; } return null; }
    /* 事件委托：标签 / 关闭 / 所有动作按钮，容器只绑一次 */
    dr.addEventListener('click', function (e) {
      var t = e.target;
      if (closest(t, '[data-rpg-tab]')) { var tb = closest(t, '[data-rpg-tab]'); window.RPGSuiteTab(tb.getAttribute('data-rpg-tab')); return; }
      if (closest(t, '#rpgClose')) { dr.classList.remove('on'); return; }
      var b = closest(t, '[data-rpg-act]');
      if (b && !b.disabled && window.WorldExt && window.WorldExt.act) { window.WorldExt.act('wr_rpg', b.getAttribute('data-rpg-act'), b.getAttribute('data-rpg-arg') || ''); return; }
    });

    function render() {
      if (!mod || !window.WorldExt) { dr.innerHTML = HD + LOADING; return; }
      var wrap = window.WorldExt.modState && window.WorldExt.modState('wr_rpg');
      if (!wrap || !wrap.state) { dr.innerHTML = HD + LOADING; return; }
      var inner;
      try { inner = mod.html(wrap); } catch (e) { inner = ERROR; }
      dr.innerHTML = HD + (inner || ERROR);
      if (window.RPGSuiteTab) window.RPGSuiteTab(window.__rpgTabCur || 'role');
    }
    fab.onclick = function () { var open = dr.classList.toggle('on'); if (open) render(); };
    /* 模块按钮 act 后刷新抽屉 + 状态栏（原 act 只刷新沉浸面板，不碰 #wxStrip） */
    if (window.WorldExt.act && !window.WorldExt.act.__rpg) {
      var orig = window.WorldExt.act;
      window.WorldExt.act = function (id) {
        var out = orig.apply(window.WorldExt, arguments);
        if (id === 'wr_rpg') {
          try { if (window.WorldExt.refreshStrip) window.WorldExt.refreshStrip(); } catch (e) {}
          if (dr.classList.contains('on')) render();
        }
        return out;
      };
      window.WorldExt.act.__rpg = true;
    }
    /* 每轮变量更新后同步（面板开着时） */
    if (window.WorldExt.onVars && !window.WorldExt.onVars.__rpg) {
      var origV = window.WorldExt.onVars;
      window.WorldExt.onVars = function () {
        var out = origV.apply(window.WorldExt, arguments);
        try { if (window.WorldExt.refreshStrip) window.WorldExt.refreshStrip(); } catch (e) {}
        if (dr.classList.contains('on')) render();
        return out;
      };
      window.WorldExt.onVars.__rpg = true;
    }
  }
  if (window.YJWait) window.YJWait.for(inject, null, { name: 'rpg-core', base: 160, max: 60 });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
  window.RPGCore = { Engine: Engine, WORLD: WORLD, module: rpgModule, initState: initState, mountFab: mountFab, SHOP: SHOP, BUFFS: BUFFS, ACHS: ACHS, TABS: TABS, CLASSES: CLASSES, DIMS: DIMS, SLOTS: SLOTS, QUEST_FALLBACK: QUEST_FALLBACK, questArc: questArc, tickBuffs: tickBuffs, blog: blog, normalizeState: normalizeState, questNeed: questNeed, questCond: questCond, guildRank: guildRank, petBonus: petBonus, makePartyMember: makePartyMember, memberLabel: memberLabel, makeHunt: makeHunt, makeFoe: makeFoe, makeEquipFor: makeEquipFor, slotNameOf: slotNameOf, equipLabel: equipLabel, enhanceRate: enhanceRate, enhanceCost: enhanceCost };
})();
