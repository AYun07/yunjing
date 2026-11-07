/* RPG Core v2.1.0 — 网游三部曲数值引擎 + 七标签角色面板（v4.05.0）
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
    deathmaster: { n: '死亡剑术宗师／神将', main: 'tac', growth: { str: 4.0, sta: 3.2, agi: 3.0, int: 2.4, tac: 3.4, luk: 1.2 }, hpK: 1.35, mpK: 1.30, atkK: 1.45, defK: 1.18, crit: 14, hidden: true, skills: [['blade', '斩龙刃', 8, 1, 1.25], ['seal', '上古符印', 16, 3, 2.10], ['wargod', '武神·轩辕斩', 24, 4, 2.90]] }
  };

  /* ---------------- 三界配置 ---------------- */
  var WORLD = {
    daobanshenhua: {
      game: '月恒', hero: '林凡', hid: '青菜白玉汤', startMap: '新手村 · 野狼谷',
      classes: ['warrior', 'archer', 'mage', 'priest', 'rogue', 'beast'],
      hidden: [{ id: 'darkmage', lv: 30, n: '暗火法师' }, { id: 'dragonknight', lv: 60, n: '龙骑士' }],
      tiers: ['绿色装备', '蓝色装备', '紫色装备', '圣器', '神器'],
      starter: { n: '松木林巨剑', tier: '绿色装备', atk: 24, str: 8, sta: 7 },
      loot: [['松木林巨剑', '绿色装备', 1], ['守墓人戒指', '蓝色装备', 12], ['赤银剑', '紫色装备', 30], ['月神链', '圣器', 55], ['霜之哀伤', '神器', 80]],
      cur: '金币', res: '怒气',
      maps: ['新手村 · 野狼谷', '银月城 · 城郊', '暮色森林 · 深处', '龙啸崖 · 崖顶', '月神殿 · 禁地'],
      guildName: '银月行会', petName: '灵狼'
    },
    zonghengtianxia: {
      game: '灵恸', hero: '丁舒升', hid: '轻狂书生', startMap: '暮光城 · 浅水沼泽',
      classes: ['archer', 'warrior', 'mage', 'priest', 'rogue', 'knight'],
      hidden: [{ id: 'elemental', lv: 30, n: '元素弓箭手' }, { id: 'dragonspeaker', lv: 60, n: '龙语者' }],
      tiers: ['粗糙品', '白色装', '黑铁器', '青铜器', '白银器', '黄金器', '暗金器', '地器', '天器', '鬼器', '仙器', '旷世圣器', '神器'],
      starter: { n: '黄金王者弓', tier: '白银器', atk: 32, agi: 6, luk: 2 },
      loot: [['黄金王者弓', '白银器', 1], ['骨灵之戒', '暗金器', 20], ['追魂之弓', '地神器', 45], ['冰川壁垒', '旷世圣器', 65], ['北冥剑', '太古神器', 90]],
      cur: '金币', res: '魔法值',
      maps: ['暮光城 · 浅水沼泽', '雪月城 · 冰原', '龙语冰川 · 裂隙', '黑暗大圣者 · 封印地', '浮空主城 · 天台'],
      guildName: '雪月同盟', petName: '雪鹰'
    },
    tianxiawushuang: {
      game: '天纵', hero: '陆尘', hid: '折戟沉沙', startMap: '天空之城 · 果林地',
      classes: ['deathblade', 'knight', 'mage', 'archer', 'rogue', 'tactician'],
      hidden: [{ id: 'deathmaster', lv: 60, n: '死亡剑术宗师／神将' }],
      tiers: ['白色', '黑石器', '青铜器', '玄铁器', '白银器', '黄金器', '暗金器', '紫金器', '灵器', '仙器', '圣器', '七十二鬼器', '神器', '十二神兵'],
      starter: { n: '新手长剑', tier: '黑石器', atk: 26, str: 6, tac: 3 },
      loot: [['青铜长剑', '青铜器', 1], ['逍遥吟', '七十二鬼器', 25], ['帝海盾', '中位神器', 50], ['轩辕剑', '十二神兵', 75], ['炼狱诸神的怜悯', '上古神器', 95]],
      cur: '金币', res: '神力值',
      maps: ['天空之城 · 果林地', '折戟沉沙 · 古战场', '帝海 · 城关', '轩辕 · 神兵冢', '王者权杖 · 王座'],
      guildName: '天下会', petName: '赤焰驹'
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
    daobanshenhua: { title: '从大茶壶到守城者', st: [['晋级任务', '完成一次转正'], ['行会立足', '拿下第一片驻地'], ['国战扬名', '守住银月城']] },
    zonghengtianxia: { title: '轻狂书生的建帮令', st: [['见习晋级', '首杀与转职'], ['雪月建帮', '夺下第一片领地'], ['龙语冰川', '封印黑暗大圣者']] },
    tianxiawushuang: { title: '折戟沉沙的天下名将', st: [['死灵剑士', '通过蜕变与认证'], ['名将争锋', '夺得领地'], ['王者权杖', '守住天空之城']] }
  };
  function questArc(g) {
    try { var a = window.QuestChain && window.QuestChain.arcs && window.QuestChain.arcs[g]; if (a && a.st && a.st.length) return a; } catch (e) {}
    return QUEST_FALLBACK[g] || QUEST_FALLBACK.daobanshenhua;
  }
  var TABS = [
    ['role', '🎮', '角色'], ['bag', '🎒', '背包'], ['skill', '✨', '技能'],
    ['quest', '🧭', '任务'], ['map', '📍', '地图'], ['social', '👥', '社交'], ['battle', '⚔️', '战斗']
  ];

  /* ---------------- 数值引擎（纯函数，同输入恒同输出） ---------------- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function expToNext(lv) { return Math.round(80 * Math.pow(Math.max(1, lv), 1.55)); }
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
  function questNeed(i) {
    var a = Math.max(0, Math.round(Number(i) || 0));
    return { lv: 1 + a * 4, kills: a * 3 };
  }
  /* 单幕条件判定：等级门槛 + 击杀数 + 前一幕已领取；返回各项「当前/需求」进度与达成标记 */
  function questCond(st, i, arcLen) {
    var nd = questNeed(i), done = Array.isArray(st.questDone) ? st.questDone : [];
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
    var maxHp = 40 + flv * 12 + ((h >>> 9) % 20);
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
  /* 回合推进：技能冷却与 Buff 持续回合递减（确定性） */
  function tickBuffs(st) {
    var chg = false;
    if (st.cd && typeof st.cd === 'object') Object.keys(st.cd).forEach(function (k) { if ((Number(st.cd[k]) || 0) > 0) { st.cd[k] = (Number(st.cd[k]) || 0) - 1; chg = true; } });
    if (Array.isArray(st.buffs) && st.buffs.length) {
      st.buffs = st.buffs.map(function (b) { var c = {}, k; for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) c[k] = b[k]; c.turns = (Number(c.turns) || 0) - 1; return c; }).filter(function (b) { return (Number(b.turns) || 0) > 0; });
      chg = true;
    }
    return chg;
  }

  /* ---------------- 初始状态与老存档兼容 ---------------- */
  function initState(g) {
    var w = WORLD[g] || WORLD.daobanshenhua;
    return {
      lv: 1, exp: 0, cls: w.classes[0], hidden: '', name: w.hid, title: '初入' + w.game,
      map: w.startMap, hp: null, mp: null, gold: 50, rep: 0, points: 0,
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
      blog: [], ach: [], questDone: [], round: 0, mapIdx: 0
    };
  }
  /* 字段级补齐：老存档缺字段 / 子字段 / 形状异常时一律补默认值，绝不崩 */
  function normalizeState(f, g) {
    var w = WORLD[g] || WORLD.daobanshenhua, def = initState(g), i;
    ['items', 'pet', 'party', 'guild'].forEach(function (k) {
      f[k] = Object.assign({}, def[k], (f[k] && typeof f[k] === 'object' && !Array.isArray(f[k])) ? f[k] : {});
    });
    ['buffs', 'bag', 'log', 'blog', 'ach', 'questDone'].forEach(function (k) { if (!Array.isArray(f[k])) f[k] = def[k].slice(); });
    if (!f.cd || typeof f.cd !== 'object' || Array.isArray(f.cd)) f.cd = {};
    if (!f.equip || typeof f.equip !== 'object' || Array.isArray(f.equip)) f.equip = { weapon: w.starter };
    f.base = Object.assign({}, def.base, (f.base && typeof f.base === 'object' && !Array.isArray(f.base)) ? f.base : {});
    /* 数值字段：缺/坏补默认，负数夹到 0（金币/HP/MP 绝不为负），等级至少 1 */
    ['gold', 'rep', 'points', 'kills', 'lastRound', 'enhSeq', 'arenaWins', 'arenaLoss', 'round', 'mapIdx', 'exp'].forEach(function (k) {
      var n = Number(f[k]);
      f[k] = (f[k] == null || isNaN(n)) ? def[k] : Math.max(0, Math.round(n));
    });
    var lvN = Number(f.lv);
    f.lv = (f.lv == null || isNaN(lvN)) ? 1 : Math.max(1, Math.round(lvN));
    if (f.hp != null && isNaN(Number(f.hp))) f.hp = null;
    if (f.mp != null && isNaN(Number(f.mp))) f.mp = null;
    if (f.cls == null) f.cls = def.cls;
    if (f.map == null) f.map = def.map;
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
      f.guild.contrib = (f.guild.contrib == null || isNaN(gc) || !isFinite(gc)) ? 0 : Math.max(0, Math.round(gc));
      var gr = guildRank(f.guild.contrib);
      f.guild.level = gr.level; f.guild.rank = gr.rank;   /* 按贡献重算，幂等 */
      if (f.guild.name == null) f.guild.name = '';
      f.guild.name = String(f.guild.name);
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
    var w = WORLD[g] || WORLD.daobanshenhua;
    var maps = w.maps || [w.startMap];
    var E = function (st) { return Engine.derive(st); };
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
      /* WR.module 把状态对象本身作为第二个参数传入（不是模块包裹），字段须直接写到 f 上 */
      backfill: function (o, f) {
        var d = initState(g);
        Object.keys(d).forEach(function (k) { if (o && o[k] !== undefined) d[k] = o[k]; f[k] = d[k]; });
        delete f.state;
        normalizeState(f, g);
        var s = E(f);
        var hpRaw = Number(o && o.hp != null ? o.hp : s.maxHp);
        var mpRaw = Number(o && o.mp != null ? o.mp : s.maxMp);
        f.hp = Math.max(0, Math.min(isNaN(hpRaw) ? s.maxHp : hpRaw, s.maxHp));
        f.mp = Math.max(0, Math.min(isNaN(mpRaw) ? s.maxMp : mpRaw, s.maxMp));
      },
      hud: function (st) {
        var s = E(st), hp = Number(st.hp != null ? st.hp : s.maxHp), mp = Number(st.mp != null ? st.mp : s.maxMp);
        var need = Engine.expToNext(st.lv);
        return [
          { i: '🎮', v: 'Lv.' + st.lv, l: clsName(st).slice(0, 6), tone: '', mod: 'wr_rpg' },
          { i: '❤️', v: hp + '/' + s.maxHp, l: 'HP', tone: hp <= s.maxHp * 0.25 ? 'bad' : '', mod: 'wr_rpg' },
          { i: '🔵', v: mp + '/' + s.maxMp, l: w.res, tone: '', mod: 'wr_rpg' },
          { i: '✨', v: st.exp + '/' + need, l: '经验', tone: '', mod: 'wr_rpg' },
          { i: '💰', v: String(st.gold || 0), l: w.cur, tone: '', mod: 'wr_rpg' }
        ];
      },
      /* 常驻状态板走 summary 协议；与 hud 同一份数值，避免两处口径不一致 */
      summary: function (st) { return this.hud(st); },
      read: function (st, vars, round) {
        normalizeState(st, g);
        var r = Number(round) || (vars && Number(vars.chapter)) || 0;
        if (r && r !== st.lastRound) {
          st.lastRound = r;
          /* 每轮确定性小额经验，保证面板始终在推进 */
          var gain = Engine.gainExp(st, 8 + st.lv * 2);
          if (gain.ups) { st.lv = gain.lv; st.exp = gain.exp; st.points = (Number(st.points) || 0) + gain.points; note(st, '⬆️ 升至 Lv.' + st.lv + '，获得 ' + gain.points + ' 属性点'); }
          else st.exp = gain.exp;
          tickBuffs(st);
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
        return changed || (r && r !== 0);
      },
      act: function (st, s, a, p) {
        normalizeState(st, g);
        var d = E(st), i;
        /* 所有成功动作统一收口：金币/声望/HP/MP 绝不为负，且不超过上限 */
        function ok(m) {
          st.gold = Math.max(0, Math.round(Number(st.gold) || 0));
          st.rep = Math.max(0, Math.round(Number(st.rep) || 0));
          var dd = E(st);
          st.hp = st.hp == null ? dd.maxHp : Math.max(0, Math.min(dd.maxHp, Math.round(Number(st.hp) || 0)));
          st.mp = st.mp == null ? dd.maxMp : Math.max(0, Math.min(dd.maxMp, Math.round(Number(st.mp) || 0)));
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
          if ((Number(st.mp) || 0) < sk[2]) return w.res + '不足（' + (Number(st.mp) || 0) + '/' + sk[2] + '）';
          st.mp -= sk[2]; st.cd[sk[0]] = sk[3];
          /* 明确结算目标：当前确定性野怪（练级/打怪），不再打空气凭空掉金币 */
          var hunt = st.hunt, huntName = hunt.name + '(Lv.' + hunt.lv + ')';
          var foeDef = Math.round(12 + hunt.lv * 2.2);
          var dm = Engine.damage(d.atk, foeDef, sk[4], d.crit, st.lv + '|' + sk[0] + '|' + (st.kills || 0) + '|' + hunt.seq);
          hunt.hp = Math.max(0, (Number(hunt.hp) || 0) - dm.value);
          var killed = hunt.hp <= 0, coin = 0, repGain = 0;
          /* 战斗历练经验（来自对野怪造成的伤害）；金币/声望只在击杀野怪时由掉落结算 */
          var expGain = Math.max(1, Math.round(dm.value / 20));
          if (killed) {
            st.kills = (Number(st.kills) || 0) + 1;
            coin = Math.round(6 + hunt.lv * 1.2);   /* 野怪掉落金币（明确来源） */
            repGain = 1;                            /* 击杀声望 */
            st.gold += coin; st.rep += repGain;
            st.hunt = Engine.makeHunt(g, st.lv, (Number(hunt.seq) || 0) + 1);
          }
          var ge = Engine.gainExp(st, expGain);
          st.lv = ge.lv; st.exp = ge.exp; st.points = (Number(st.points) || 0) + ge.points;
          note(st, sk[1] + ' 对「' + huntName + '」造成 ' + dm.value + (dm.crit ? '（暴击）' : '') + ' 点伤害' + (killed ? '，击杀掉落 ' + coin + ' ' + w.cur : '，未击杀'));
          blog(st, { a: sk[1], dmg: dm.value, crit: dm.crit, t: '技能',
            note: '目标「' + huntName + '」HP ' + hunt.hp + '/' + hunt.maxHp + ' · ' + (killed ? ('击杀掉落 ' + coin + ' ' + w.cur + '（野怪掉落）· 声望 +1') : ('未击杀 · 仅经验 +' + expGain + '，' + w.cur + '无收益')) + ' · 耗 ' + w.res + ' ' + sk[2] });
          return ok('⚔️ ' + sk[1] + ' 对「' + huntName + '」造成 ' + dm.value + ' 点伤害' + (dm.crit ? ' 💥暴击' : '')
            + (killed ? '｜击杀！野怪掉落 ' + coin + ' ' + w.cur + '、声望 +' + repGain + '、经验 +' + expGain : '｜目标 HP ' + hunt.hp + '/' + hunt.maxHp + '，未击杀，仅经验 +' + expGain + '，' + w.cur + '无收益')
            + '，耗 ' + w.res + ' ' + sk[2] + '，冷却 ' + sk[3] + ' 轮');
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
          if (p === 'mp') { st.mp = (Number(st.mp) || 0) + Math.ceil(dd2.maxMp * 0.4); blog(st, { a: '饮用 ' + po.n, t: '药水', note: '+40% MP' }); return ok('🔵 饮用「' + po.n + '」——' + w.res + ' 回复 40%'); }
          /* 力量药剂 → 施加攻击增益 Buff */
          var bf = BUFFS.atk; st.buffs.push({ id: bf.id, n: bf.n, i: bf.i, atk: bf.atk, def: bf.def, turns: bf.turns, kind: bf.kind });
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
          blog(st, { a: '地图传送', res: maps[mi], t: '传送', note: '-' + cost + ' ' + w.cur });
          return ok('📍 传送至「' + maps[mi] + '」，花费 ' + cost + ' ' + w.cur);
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
            st.guild.name = w.guildName;
            var jr = Engine.guildRank(Number(st.guild.contrib) || 0);
            st.guild.level = jr.level; st.guild.rank = jr.rank;
            st.rep += 5;
            blog(st, { a: '加入公会', t: '社交', note: w.guildName + ' · ' + jr.rank + ' · 声望 +5' });
            return ok('🏛 加入「' + w.guildName + '」——' + jr.rank + '（公会 Lv.' + jr.level + '），声望 +5');
          }
          if (p === 'contrib') {
            if (!st.guild.name) return '先加入一个公会';
            if ((Number(st.gold) || 0) < 20) return '💰 ' + w.cur + '不足（' + st.gold + '/20）';
            var lvBefore = Math.max(1, Math.round(Number(st.guild.level) || 1));
            st.gold -= 20; st.guild.contrib = (Number(st.guild.contrib) || 0) + 10; st.rep += 8;
            var cr = Engine.guildRank(st.guild.contrib);
            st.guild.level = cr.level; st.guild.rank = cr.rank;
            var promoted = cr.level > lvBefore;
            blog(st, { a: '公会贡献', t: '社交', note: '贡献 +10 · 声望 +8 · ' + cr.rank + (promoted ? '（晋升！）' : '') });
            return ok('🏛 向「' + st.guild.name + '」贡献——贡献 +10（现 ' + st.guild.contrib + '）、声望 +8，职位「' + cr.rank + '」（公会 Lv.' + cr.level + '）' + (promoted ? '，晋升！' : ''));
          }
          return '未知公会操作';
        }
        if (a === 'arena') {
          var bouts = (Number(st.arenaWins) || 0) + (Number(st.arenaLoss) || 0);
          var seed = g + '|arena|' + bouts + '|' + st.lv + '|' + st.round;
          var foe = Engine.makeFoe(seed, st.lv);   /* 确定性对手实体：名字/等级/战力/HP/攻防/暴击 */
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
          var scale = Math.max(1, Math.round(foe.power / 100));
          var goldWin = 15 + scale * 10, repWin = 5 + scale * 3, repLose = 1;
          st.arenaLastFoe = { name: foe.name, lv: foe.lv, power: foe.power };
          if (win) {
            st.arenaWins = (Number(st.arenaWins) || 0) + 1;
            st.arenaStreak = (Number(st.arenaStreak) || 0) + 1;
            st.arenaBest = Math.max(Number(st.arenaBest) || 0, st.arenaStreak);
            st.gold += goldWin; st.rep += repWin;
          } else {
            st.arenaLoss = (Number(st.arenaLoss) || 0) + 1;
            st.arenaStreak = 0; st.rep += repLose;
            st.hp = (Number(st.hp) != null ? Number(st.hp) : d.maxHp) - Math.max(1, Math.round(foeTotal * 0.15));
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
          st.buffs.push({ id: b0.id, n: b0.n, i: b0.i, atk: b0.atk, def: b0.def, turns: b0.turns, kind: b0.kind });
          blog(st, { a: (b0.kind === 'debuff' ? '受到减益 ' : '施加增益 ') + b0.n, t: '状态', note: '攻 ' + (b0.atk >= 0 ? '+' : '') + b0.atk + ' 防 ' + (b0.def >= 0 ? '+' : '') + b0.def + ' / ' + b0.turns + ' 回合' });
          return ok((b0.kind === 'debuff' ? '💀 ' : '✨ ') + b0.n + '——攻 ' + (b0.atk >= 0 ? '+' : '') + b0.atk + ' 防 ' + (b0.def >= 0 ? '+' : '') + b0.def + '，持续 ' + b0.turns + ' 回合');
        }
        if (a === 'tick') {
          st.round = (Number(st.round) || 0) + 1;
          tickBuffs(st);
          var dd3 = E(st);
          st.hp = (Number(st.hp) || 0) + Math.ceil(dd3.maxHp * 0.05);
          st.mp = (Number(st.mp) || 0) + Math.ceil(dd3.maxMp * 0.08);
          blog(st, { a: '结束回合', t: '回合', res: '第 ' + st.round + ' 回合', note: 'Buff 回合 -1 · 回血蓝' });
          return ok('⏭ 第 ' + st.round + ' 回合——Buff/冷却递减，HP/MP 小幅回复');
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
        var tier = (window.BaseModelMode && window.BaseModelMode.ctxTier) ? window.BaseModelMode.ctxTier() : 'normal';
        var eq = Object.keys(st.equip || {}).map(function (k) { var e = st.equip[k]; return e ? e.n + '(' + (e.tier || '') + ')' : ''; }).filter(Boolean).join('、');
        if (tier === 'tiny') {
          return '【网游面板】Lv.' + st.lv + ' ' + clsName(st) + '｜HP ' + hp + '/' + d.maxHp + '｜' + w.res + ' ' + mp + '/' + d.maxMp + '｜攻 ' + d.atk + ' 防 ' + d.def + '｜' + w.cur + ' ' + st.gold + '｜' + st.map
            + '。只准用这些数字，严禁自编等级、经验、装备或伤害数值；野怪与对手只写外形、名称与相对强弱（如「绿名怪」「高出一阶」），严禁给它们标注具体等级或 HP 数字；剧情要升级就写「经验条涨了一截」，不要写具体级数。';
        }
        return '【网游角色面板·本轮快照】《' + w.game + '》｜' + clsName(st) + ' Lv.' + st.lv + '（经验 ' + st.exp + '/' + Engine.expToNext(st.lv) + '）｜HP ' + hp + '/' + d.maxHp + '｜' + w.res + ' ' + mp + '/' + d.maxMp
          + '｜六维 ' + DIMS.map(function (x) { return x.n + d.attr[x.k]; }).join(' ')
          + '｜攻 ' + d.atk + ' 防 ' + d.def + ' 魔防 ' + d.mdef + ' 暴击 ' + d.crit + '%'
          + '｜装备 ' + (eq || '无') + '｜' + w.cur + ' ' + st.gold + ' 声望 ' + st.rep + '｜当前地图 ' + st.map
          + '。\n【数值契约】正文写到的等级、伤害、耗蓝、掉落、升级必须与本快照一致，只准引用快照里的数字；严禁自行编造等级、经验值、属性表或角色档案（例如凭空写「Lv.8」「经验 632/1200」）。野怪与对手的等级、HP 由引擎「练级目标」管理，正文只写外形、名称与相对强弱（如「绿名怪」「高出一阶」），严禁给它们标注具体等级或 HP 数字。剧情要升级就写「经验条涨了一截」，具体结算交给引擎。需变更时在 (variable_update) 块写 >>网游面板.exp: +120 等行。禁止编造本界品级序列（' + w.tiers.slice(0, 4).join('→') + '…）之外的装备品级。';
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
      o += '<div class="rpg-status">'
        + '<div class="wr-stat"><span>📍 ' + esc(st.map || w.startMap) + '</span><b>' + esc(st.title || '') + '</b></div>'
        + '<div class="wr-stat"><span>🎮 ' + esc(clsName(st)) + '</span><b>Lv.' + st.lv + '</b></div>'
        + '<div class="wr-stat"><span>💰 ' + esc(w.cur) + '</span><b>' + st.gold + '</b></div>'
        + '<div class="wr-stat"><span>🏅 声望</span><b>' + st.rep + '</b></div></div>';
      o += bar('❤️ HP', R.hp + ' / ' + d.maxHp, R.hp, d.maxHp, 'rpg-hp');
      o += bar('🔵 ' + esc(w.res), R.mp + ' / ' + d.maxMp, R.mp, d.maxMp, 'rpg-mp');
      o += bar('✨ 经验', st.exp + ' / ' + R.need, st.exp, R.need, 'rpg-exp');
      o += sec('六维属性', st.points ? '可分配 ' + st.points + ' 点' : '基础 + 等级成长 + 装备');
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
      o += sec('职业与转职') + '<div class="rpg-chips">';
      w.classes.forEach(function (id) { o += btn(esc(CLASSES[id].n), 'setclass', id, 'sm' + (st.cls === id && !st.hidden ? ' on' : '')); });
      w.hidden.forEach(function (h) { o += btn(esc(h.n) + '（Lv.' + h.lv + '）', 'setclass', h.id, 'sm' + (st.hidden === h.id ? ' on' : '')); });
      o += '</div>';
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
      o += sec('职业技能', esc(clsName(st)) + ' · ' + esc(w.res) + ' ' + R.mp + '/' + d.maxMp);
      o += '<div class="rpg-cards">';
      list.forEach(function (sk) {
        var cd = st.cd[sk[0]] || 0, afford = (Number(st.mp) || 0) >= sk[2];
        o += '<div class="rpg-card"><div class="rpg-card-hd"><b>' + esc(sk[1]) + '</b><span class="rpg-tag">×' + sk[4] + '</span></div>'
          + '<div class="rpg-card-bd">耗 ' + esc(w.res) + ' ' + sk[2] + ' · 冷却 ' + sk[3] + ' 轮' + (cd > 0 ? ' · <em class="rpg-cd">冷却中 ' + cd + '</em>' : '') + '</div>'
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
      o += sec('三幕主线', esc(arc.title || '主线') + ' · 已领 ' + reached + ' / ' + nst);
      o += '<div class="rpg-kv"><span>领奖进度</span><b>' + reached + ' / ' + nst + '</b><i class="rpg-bar rpg-exp" style="flex:1"><i style="width:' + R.pct(reached, nst) + '%"></i></i></div>';
      o += '<div class="rpg-tip sm">主线条件：等级门槛 + 击杀数 + 前一幕已领取（与竞技场胜场解耦）。逐幕显示「当前 / 需求」进度，✓ 已达成 / ✗ 未达成。</div>';
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
      o += sec('当前位置', esc(w.cur) + '传送');
      o += '<div class="rpg-card hot"><div class="rpg-card-hd"><b>📍 ' + esc(st.map || w.startMap) + '</b><span class="rpg-tag ok">所在地</span></div>'
        + '<div class="rpg-card-bd">传送消耗随距离递增：第 n 个地名费用 = 10 + n×5 ' + esc(w.cur) + '</div></div>';
      o += sec('本界地名', '点击传送（消耗 ' + esc(w.cur) + '）');
      if (R.maps && R.maps.length) {
        o += '<div class="rpg-cards">';
        R.maps.forEach(function (mp, mi) {
          var here = mi === (Number(st.mapIdx) || 0), cost = 10 + mi * 5;
          o += '<div class="rpg-card ' + (here ? 'hot' : '') + '"><div class="rpg-card-hd"><b>' + (mi + 1) + '. ' + esc(mp) + '</b></div>'
            + '<div class="rpg-card-bd">费用 ' + cost + ' ' + esc(w.cur) + (here ? ' · 当前所在地' : '') + '</div>'
            + '<div class="rpg-card-ft">' + (here ? '<span class="rpg-mut">已在此地</span>' : btn('传送', 'teleport', mi, 'sm')) + '</div></div>';
        });
        o += '</div>';
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
      o += sec('公会', '按贡献晋升职位');
      if (st.guild.name) {
        o += '<div class="rpg-card"><div class="rpg-card-hd"><b>🏛 ' + esc(st.guild.name) + '</b><span class="rpg-tag">Lv.' + (st.guild.level || 1) + ' · ' + esc(st.guild.rank || '见习成员') + '</span></div>'
          + '<div class="rpg-card-bd">贡献 ' + (st.guild.contrib || 0) + '｜贡献 20 ' + esc(w.cur) + ' → 贡献值 +10、声望 +8；累计贡献按阈值晋升职位</div>'
          + '<div class="rpg-card-ft">' + btn('贡献', 'guild', 'contrib', 'sm') + '</div></div>';
      } else o += empty('尚未加入任何公会', '加入后可累积贡献与声望') + '<div class="rpg-chips">' + btn('加入「' + esc(w.guildName) + '」', 'guild', 'join', 'sm') + '</div>';
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
    var w = WORLD[genre] || WORLD.daobanshenhua;
    /* 共用皮肤：若静态 <link> 尚未注册（团队统一接线前），这里兜底注入，幂等不重复 */
    (function ensureSuiteCSS() {
      try {
        if (!document.head) return;
        if (document.querySelector('link[data-rpg-suite]')) return;
        var ls = document.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < ls.length; i++) if ((ls[i].href || '').indexOf('rpg-suite.css') >= 0) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = 'css/rpg-suite.css?v=4.05.0'; l.setAttribute('data-rpg-suite', '1');
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
      + 'border-radius:14px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);display:none;overflow-x:hidden}'
      + '#rpgDrawer.on{display:block}#rpgDrawer .rpg-hd{display:flex;align-items:center;gap:8px;'
      + 'margin-bottom:10px;font-size:13px;color:var(--ip,#c9a86a);letter-spacing:1px}'
      + '#rpgDrawer .rpg-hd button{margin-left:auto;background:none;border:0;color:var(--imt,#9a8c6e);'
      + 'font-size:16px;cursor:pointer}'
      + '@media(max-width:640px){#rpgFab{right:10px;bottom:78px;padding:8px 12px}'
      + '#rpgDrawer{right:8px;bottom:126px;width:calc(100vw - 16px);max-height:66vh}}';
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
  window.RPGCore = { Engine: Engine, WORLD: WORLD, module: rpgModule, initState: initState, mountFab: mountFab, SHOP: SHOP, BUFFS: BUFFS, ACHS: ACHS, TABS: TABS, QUEST_FALLBACK: QUEST_FALLBACK, questArc: questArc, tickBuffs: tickBuffs, blog: blog, normalizeState: normalizeState, questNeed: questNeed, questCond: questCond, guildRank: guildRank, petBonus: petBonus, makePartyMember: makePartyMember, memberLabel: memberLabel, makeHunt: makeHunt, makeFoe: makeFoe, makeEquipFor: makeEquipFor, slotNameOf: slotNameOf, equipLabel: equipLabel, enhanceRate: enhanceRate, enhanceCost: enhanceCost };
})();
