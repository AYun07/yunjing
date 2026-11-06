/* RPG Core v1.0.0 — 网游三部曲数值引擎 + 角色面板（v4.02.0）
 *
 * 复用 WorldExt 模块协议：stats/hud 进常驻状态栏，html 出个人面板，
 * directive 每轮把数值快照送进模型，read 按轮次与变量块结算。
 * 所有数值计算集中在 Engine（纯函数，同输入恒同输出），UI 只负责呈现。
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
      cur: '金币', res: '怒气'
    },
    zonghengtianxia: {
      game: '灵恸', hero: '丁舒升', hid: '轻狂书生', startMap: '暮光城 · 浅水沼泽',
      classes: ['archer', 'warrior', 'mage', 'priest', 'rogue', 'knight'],
      hidden: [{ id: 'elemental', lv: 30, n: '元素弓箭手' }, { id: 'dragonspeaker', lv: 60, n: '龙语者' }],
      tiers: ['粗糙品', '白色装', '黑铁器', '青铜器', '白银器', '黄金器', '暗金器', '地器', '天器', '鬼器', '仙器', '旷世圣器', '神器'],
      starter: { n: '黄金王者弓', tier: '白银器', atk: 32, agi: 6, luk: 2 },
      loot: [['黄金王者弓', '白银器', 1], ['骨灵之戒', '暗金器', 20], ['追魂之弓', '地神器', 45], ['冰川壁垒', '旷世圣器', 65], ['北冥剑', '太古神器', 90]],
      cur: '金币', res: '魔法值'
    },
    tianxiawushuang: {
      game: '天纵', hero: '陆尘', hid: '折戟沉沙', startMap: '天空之城 · 果林地',
      classes: ['deathblade', 'knight', 'mage', 'archer', 'rogue', 'tactician'],
      hidden: [{ id: 'deathmaster', lv: 60, n: '死亡剑术宗师／神将' }],
      tiers: ['白色', '黑石器', '青铜器', '玄铁器', '白银器', '黄金器', '暗金器', '紫金器', '灵器', '仙器', '圣器', '七十二鬼器', '神器', '十二神兵'],
      starter: { n: '新手长剑', tier: '黑石器', atk: 26, str: 6, tac: 3 },
      loot: [['青铜长剑', '青铜器', 1], ['逍遥吟', '七十二鬼器', 25], ['帝海盾', '中位神器', 50], ['轩辕剑', '十二神兵', 75], ['炼狱诸神的怜悯', '上古神器', 95]],
      cur: '金币', res: '神力值'
    }
  };

  /* ---------------- 数值引擎（纯函数） ---------------- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function expToNext(lv) { return Math.round(80 * Math.pow(Math.max(1, lv), 1.55)); }
  function equipSum(equip) {
    var o = {};
    Object.keys(equip || {}).forEach(function (k) {
      var e = equip[k]; if (!e || typeof e !== 'object') return;
      Object.keys(e).forEach(function (f) {
        if (f === 'n' || f === 'tier') return;
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
  var Engine = { hash: hash, expToNext: expToNext, equipSum: equipSum, derive: derive, damage: damage, gainExp: gainExp, makeEquip: makeEquip, DIMS: DIMS, SLOTS: SLOTS, CLASSES: CLASSES };

  /* ---------------- 初始状态 ---------------- */
  function initState(g) {
    var w = WORLD[g] || WORLD.daobanshenhua;
    return {
      lv: 1, exp: 0, cls: w.classes[0], hidden: '', name: w.hid, title: '初入' + w.game,
      map: w.startMap, hp: null, mp: null, gold: 50, rep: 0, points: 0,
      base: { str: 10, sta: 10, agi: 10, int: 10, tac: 8, luk: 5 },
      equip: { weapon: w.starter }, cd: {}, buffs: [], bag: [], kills: 0,
      lastRound: 0, log: []
    };
  }

  /* ---------------- 模块 ---------------- */
  function rpgModule(g) {
    var w = WORLD[g] || WORLD.daobanshenhua;
    var E = function (st) { return Engine.derive(st); };
    function note(st, txt) { st.log = (st.log || []).slice(-6); st.log.push(txt); }
    function clsName(st) { return st.hidden ? CLASSES[st.hidden].n : (CLASSES[st.cls] || CLASSES.warrior).n; }
    function clsCfg(st) { return st.hidden ? CLASSES[st.hidden] : (CLASSES[st.cls] || CLASSES.warrior); }
    function tierIdx(t) { var i = w.tiers.indexOf(t); return i < 0 ? 0 : i; }

    return WR.module({
      id: 'wr_rpg', icon: '🎮', name: w.game + ' · 角色面板', type: 'console',
      tip: '等级／经验／HP·MP／六维／攻防暴击／装备槽／技能——网游数值由引擎结算',
      contract: '网游角色面板（等级、职业、HP/MP、六维、攻防、装备、金币、声望、当前地图）——正文数值须与面板一致',
      stats: { lv: { v: 1, max: 999, label: '等级', icon: '🎮' } },
      /* WR.module 把状态对象本身作为第二个参数传入（不是模块包裹），字段须直接写到 f 上 */
      backfill: function (o, f) {
        var d = initState(g), i;
        for (i = 0; i < Object.keys(d).length; i++) {
          var k = Object.keys(d)[i];
          if (o && o[k] !== undefined) d[k] = o[k];
          f[k] = d[k];
        }
        delete f.state;
        var s = E(f);
        f.hp = Math.min(Number(o && o.hp != null ? o.hp : s.maxHp), s.maxHp);
        f.mp = Math.min(Number(o && o.mp != null ? o.mp : s.maxMp), s.maxMp);
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
        var r = Number(round) || (vars && Number(vars.chapter)) || 0;
        if (r && r !== st.lastRound) {
          st.lastRound = r;
          /* 每轮确定性小额经验，保证面板始终在推进 */
          var gain = Engine.gainExp(st, 8 + st.lv * 2);
          if (gain.ups) { st.lv = gain.lv; st.exp = gain.exp; st.points = (Number(st.points) || 0) + gain.points; note(st, '⬆️ 升至 Lv.' + st.lv + '，获得 ' + gain.points + ' 属性点'); }
          else st.exp = gain.exp;
          Object.keys(st.cd || {}).forEach(function (k) { if (st.cd[k] > 0) st.cd[k]--; });
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
            else if (key === 'equip' || key === '装备') { st.bag = (st.bag || []).slice(-8); st.bag.push({ n: val, tier: w.tiers[Math.min(tierIdx(w.tiers[0]), w.tiers.length - 1)] }); changed = true; }
          }
        } catch (e) { /* 变量形状不可控，忽略解析失败 */ }
        return changed || (r && r !== 0);
      },
      act: function (st, s, a, p) {
        var d = E(st), i;
        if (a === 'addpoint') {
          if ((Number(st.points) || 0) <= 0) return '没有可分配的属性点';
          if (!DIMS.some(function (x) { return x.k === p; })) return '未知属性';
          st.points--; st.base[p] = (Number(st.base[p]) || 0) + 1;
          return '✦ ' + (DIMS.filter(function (x) { return x.k === p; })[0].n) + ' +1（剩余 ' + st.points + ' 点）';
        }
        if (a === 'setclass') {
          if (!w.classes.includes(p) && !w.hidden.some(function (h) { return h.id === p; })) return '本界没有这个职业';
          var h = w.hidden.filter(function (x) { return x.id === p; })[0];
          if (h && (Number(st.lv) || 1) < h.lv) return '🔒 需要 Lv.' + h.lv + ' 才能转职「' + h.n + '」';
          if (h) { st.hidden = p; st.title = h.n; } else { st.cls = p; st.hidden = ''; }
          note(st, '🎭 职业变更为「' + clsName(st) + '」');
          return '职业已设为「' + clsName(st) + '」，属性按新职业成长系数重算';
        }
        if (a === 'rest') {
          st.hp = d.maxHp; st.mp = d.maxMp;
          return '🛌 回城休整——HP/MP 回满';
        }
        if (a === 'skill') {
          var sk = null, list = clsCfg(st).skills;
          for (i = 0; i < list.length; i++) if (list[i][0] === p) sk = list[i];
          if (!sk) return '未知技能';
          if ((st.cd[sk[0]] || 0) > 0) return '「' + sk[1] + '」冷却中（' + st.cd[sk[0]] + ' 轮）';
          if ((Number(st.mp) || 0) < sk[2]) return w.res + '不足（' + (Number(st.mp) || 0) + '/' + sk[2] + '）';
          st.mp -= sk[2]; st.cd[sk[0]] = sk[3];
          var foeDef = Math.round(12 + st.lv * 2.2);
          var dm = Engine.damage(d.atk, foeDef, sk[4], d.crit, st.lv + '|' + sk[0] + '|' + (st.kills || 0));
          st.gold += Math.round(dm.value / 12); st.rep += 1;
          note(st, sk[1] + ' 造成 ' + dm.value + (dm.crit ? '（暴击）' : '') + ' 点伤害');
          return '⚔️ ' + sk[1] + '——' + dm.value + ' 点伤害' + (dm.crit ? ' 💥暴击' : '') + '，耗 ' + w.res + ' ' + sk[2] + '，冷却 ' + sk[3] + ' 轮';
        }
        if (a === 'loot') {
          var tier = 0;
          for (i = 0; i < w.loot.length; i++) if (st.lv >= w.loot[i][2]) tier = i;
          var L = w.loot[tier], eq = Engine.makeEquip(L[0], L[1], st.lv);
          var slot = 'weapon';
          if (tierIdx(L[1]) > tierIdx((st.equip.weapon || {}).tier || w.tiers[0])) {
            st.bag = (st.bag || []).slice(-8); st.bag.push(st.equip.weapon); st.equip[slot] = eq;
          } else { st.bag = (st.bag || []).slice(-8); st.bag.push(eq); }
          st.kills = (Number(st.kills) || 0) + 1;
          note(st, '🎁 掉落「' + L[0] + '」（' + L[1] + '）');
          return '🎁 掉落「' + L[0] + '」· ' + L[1] + '｜攻 +' + eq.atk + '｜已' + (st.equip.weapon === eq ? '装备' : '入包');
        }
        if (a === 'equipbag') {
          var idx = parseInt(p, 10);
          if (isNaN(idx) || !st.bag || !st.bag[idx]) return '背包里没有这件装备';
          var it = st.bag.splice(idx, 1)[0];
          var old = st.equip.weapon; st.equip.weapon = it;
          if (old) st.bag.push(old);
          return '已装备「' + it.n + '」';
        }
        return null;
      },
      html: function (st, s) {
        var d = E(st), hp = Number(st.hp != null ? st.hp : d.maxHp), mp = Number(st.mp != null ? st.mp : d.maxMp);
        var need = Engine.expToNext(st.lv);
        var pct = function (v, m) { return Math.max(0, Math.min(100, Math.round(v / Math.max(1, m) * 100))); };
        var esc = WR.H.esc;
        var o = '<div class="rpg-panel">';
        /* 状态栏 */
        o += '<div class="wr-status"><div class="wr-stat"><span>🎮 ' + esc(clsName(st)) + '</span><b>Lv.' + st.lv + '</b></div>'
          + '<div class="wr-stat"><span>📍 ' + esc(st.map || w.startMap) + '</span><b>' + esc(st.title || '') + '</b></div>'
          + '<div class="wr-stat"><span>💰 ' + w.cur + '</span><b>' + st.gold + '</b></div>'
          + '<div class="wr-stat"><span>🏅 声望</span><b>' + st.rep + '</b></div></div>';
        o += '<div class="wr-kv"><span>❤️ HP</span><b>' + hp + ' / ' + d.maxHp + '</b><i class="rpg-bar rpg-hp" style="flex:1"><i style="width:' + pct(hp, d.maxHp) + '%"></i></i></div>';
        o += '<div class="wr-kv"><span>🔵 ' + esc(w.res) + '</span><b>' + mp + ' / ' + d.maxMp + '</b><i class="rpg-bar rpg-mp" style="flex:1"><i style="width:' + pct(mp, d.maxMp) + '%"></i></i></div>';
        o += '<div class="wr-kv"><span>✨ 经验</span><b>' + st.exp + ' / ' + need + '</b><i class="rpg-bar rpg-exp" style="flex:1"><i style="width:' + pct(st.exp, need) + '%"></i></i></div>';
        /* 六维 */
        o += '<div class="wr-creator-sec">六维属性' + (st.points ? ' · 可分配 ' + st.points + ' 点' : '') + '</div><div class="rpg-grid">';
        DIMS.forEach(function (x) {
          var bonus = d.attr[x.k] - (Number(st.base[x.k]) || 0) - Math.floor((Number(st.lv) || 1) * ((clsCfg(st).growth[x.k]) || 0));
          o += '<div class="rpg-cell"><small>' + x.n + '</small><b>' + d.attr[x.k] + '</b>' + (bonus ? '<em>+' + bonus + '</em>' : '') + '</div>';
        });
        o += '</div>';
        o += '<div class="wr-creator-sec">战斗数值</div><div class="rpg-grid">'
          + '<div class="rpg-cell"><small>攻击</small><b>' + d.atk + '</b></div>'
          + '<div class="rpg-cell"><small>防御 / 魔防</small><b>' + d.def + ' / ' + d.mdef + '</b></div>'
          + '<div class="rpg-cell"><small>暴击</small><b>' + d.crit + '%</b></div>'
          + '<div class="rpg-cell"><small>攻速</small><b>' + d.spd + '</b></div></div>';
        /* 装备槽 */
        o += '<div class="wr-creator-sec">装备槽（品级：' + esc(w.tiers.slice(0, 4).join(' → ')) + ' …）</div><div class="rpg-slots">';
        SLOTS.forEach(function (sl) {
          var e = st.equip[sl.k];
          o += '<div class="rpg-slot ' + (e ? 'on' : '') + '" title="' + (e ? esc(e.n) + '｜' + esc(e.tier || '') : '空') + '"><i>' + sl.i + '</i>' + sl.n + '：' + (e ? esc(e.n) + ' <span class="rpg-tier">' + esc(e.tier || '') + '</span>' : '<span style="opacity:.5">空</span>') + '</div>';
        });
        o += '</div>';
        /* 技能 */
        var list = clsCfg(st).skills;
        o += '<div class="wr-actions">';
        list.forEach(function (sk) {
          var cd = st.cd[sk[0]] || 0, afford = (Number(st.mp) || 0) >= sk[2];
          o += '<div class="wr-act"><div class="wr-act-hd"><b>' + esc(sk[1]) + '</b><span>×' + sk[4] + ' 倍率</span></div>'
            + '<em class="wr-cost">耗 ' + esc(w.res) + '×' + sk[2] + '</em>' + (cd > 0 ? '<em class="wr-cd">冷却 ' + cd + '</em>' : '')
            + '<button class="wr-btn" ' + (cd > 0 || !afford ? 'disabled' : '') + ' onclick="WorldExt.act(\'wr_rpg\',\'skill\',\'' + sk[0] + '\')">' + (cd > 0 ? '冷却中' : !afford ? '蓝不足' : '施展') + '</button></div>';
        });
        o += '<div class="wr-act"><div class="wr-act-hd"><b>🎁 结算一次掉落</b><span>按等级给本界品级装备</span></div><button class="wr-btn" onclick="WorldExt.act(\'wr_rpg\',\'loot\',\'\')">掉落</button></div>';
        o += '<div class="wr-act"><div class="wr-act-hd"><b>🛌 回城休整</b><span>HP/MP 回满</span></div><button class="wr-btn" onclick="WorldExt.act(\'wr_rpg\',\'rest\',\'\')">休整</button></div>';
        o += '</div>';
        /* 加点 / 转职 */
        if (st.points > 0) {
          o += '<div class="wr-creator-sec">分配属性点（剩 ' + st.points + '）</div><div class="wr-actions">';
          DIMS.forEach(function (x) { o += '<div class="wr-act"><div class="wr-act-hd"><b>' + x.n + ' +1</b></div><button class="wr-btn sm" onclick="WorldExt.act(\'wr_rpg\',\'addpoint\',\'' + x.k + '\')">加点</button></div>'; });
          o += '</div>';
        }
        o += '<div class="wr-creator-sec">职业与转职</div><div class="wr-chips">';
        w.classes.forEach(function (id) { o += '<button class="wr-btn sm" onclick="WorldExt.act(\'wr_rpg\',\'setclass\',\'' + id + '\')">' + esc(CLASSES[id].n) + '</button>'; });
        w.hidden.forEach(function (h) { o += '<button class="wr-btn sm" onclick="WorldExt.act(\'wr_rpg\',\'setclass\',\'' + h.id + '\')">' + esc(h.n) + '（Lv.' + h.lv + '）</button>'; });
        o += '</div>';
        /* 背包 */
        if (st.bag && st.bag.length) {
          o += '<div class="wr-creator-sec">背包</div><div class="wr-chips">';
          st.bag.forEach(function (it, i2) { o += '<button class="wr-btn sm" onclick="WorldExt.act(\'wr_rpg\',\'equipbag\',\'' + i2 + '\')">' + esc(it.n) + ' · 装备</button>'; });
          o += '</div>';
        }
        if (st.log && st.log.length) o += '<div class="wx-banner" style="margin-top:9px;">' + st.log.slice(-3).map(esc).join('<br>') + '</div>';
        o += '<div class="wr-tip">数值由引擎确定性结算：升级按 80×Lv^1.55 经验，伤害按 攻击×倍率−防御×0.55，暴击按六维计算。正文里的数值须与此面板一致。</div>';
        o += '</div>';
        return o;
      },
      directive: function (st) {
        var d = E(st), hp = Number(st.hp != null ? st.hp : d.maxHp), mp = Number(st.mp != null ? st.mp : d.maxMp);
        var tier = (window.BaseModelMode && window.BaseModelMode.ctxTier) ? window.BaseModelMode.ctxTier() : 'normal';
        var eq = Object.keys(st.equip || {}).map(function (k) { var e = st.equip[k]; return e ? e.n + '(' + (e.tier || '') + ')' : ''; }).filter(Boolean).join('、');
        if (tier === 'tiny') {
          return '【网游面板】Lv.' + st.lv + ' ' + clsName(st) + '｜HP ' + hp + '/' + d.maxHp + '｜' + w.res + ' ' + mp + '/' + d.maxMp + '｜攻 ' + d.atk + ' 防 ' + d.def + '｜' + w.cur + ' ' + st.gold + '｜' + st.map
            + '。只准用这些数字，严禁自编等级、经验、装备或伤害数值；剧情要升级就写「经验条涨了一截」，不要写具体级数。';
        }
        return '【网游角色面板·本轮快照】《' + w.game + '》｜' + clsName(st) + ' Lv.' + st.lv + '（经验 ' + st.exp + '/' + Engine.expToNext(st.lv) + '）｜HP ' + hp + '/' + d.maxHp + '｜' + w.res + ' ' + mp + '/' + d.maxMp
          + '｜六维 ' + DIMS.map(function (x) { return x.n + d.attr[x.k]; }).join(' ')
          + '｜攻 ' + d.atk + ' 防 ' + d.def + ' 魔防 ' + d.mdef + ' 暴击 ' + d.crit + '%'
          + '｜装备 ' + (eq || '无') + '｜' + w.cur + ' ' + st.gold + ' 声望 ' + st.rep + '｜当前地图 ' + st.map
          + '。\n【数值契约】正文写到的等级、伤害、耗蓝、掉落、升级必须与本快照一致，只准引用快照里的数字；严禁自行编造等级、经验值、属性表或角色档案（例如凭空写「Lv.8」「经验 632/1200」）。剧情要升级就写「经验条涨了一截」，具体结算交给引擎。需变更时在 (variable_update) 块写 >>网游面板.exp: +120 等行。禁止编造本界品级序列（' + w.tiers.slice(0, 4).join('→') + '…）之外的装备品级。';
      }
    });
  }

  /* ---------------- 注入 ---------------- */
  var genre = WR && WR.genre;
  if (!WORLD[genre]) { window.RPGCore = { Engine: Engine, WORLD: WORLD, module: rpgModule }; return; }
  var injected = false, mod = null;
  function inject() {
    if (injected) return true;
    if (!window.WorldExt || !window.WorldExt.hasModules || !window.WorldExt.hasModules()) return false;
    try {
      mod = rpgModule(genre);
      window.WorldExt.injectModules(genre, [mod]);
      mountFab();
      console.log('[RPGCore] ' + genre + ' 网游面板就位');
    } catch (e) { console.warn('[RPGCore]', e.message); }
    injected = true; return true;
  }

  /* 独立入口：沉浸套件是按需加载的，不能让玩家找不到个人面板。
     这里挂一个常驻浮标 + 抽屉，直接复用模块的 html() 渲染，数值口径唯一。 */
  function mountFab() {
    if (!document || !document.body || document.getElementById('rpgFab')) return;
    var w = WORLD[genre] || WORLD.daobanshenhua;
    var css = '#rpgFab{position:fixed;right:16px;bottom:96px;z-index:9200;border:1px solid var(--ip,#c9a86a)66;'
      + 'background:color-mix(in srgb,var(--ip,#c9a86a) 20%,#10161d);color:var(--itx,#e8dcc0);'
      + 'border-radius:22px;padding:9px 15px;font-size:12.5px;letter-spacing:1px;cursor:pointer;'
      + 'box-shadow:0 6px 22px rgba(0,0,0,.4);font-variant-numeric:tabular-nums}'
      + '#rpgFab:hover{background:color-mix(in srgb,var(--ip,#c9a86a) 34%,#10161d)}'
      + '#rpgDrawer{position:fixed;right:14px;bottom:146px;z-index:9201;width:min(440px,92vw);'
      + 'max-height:min(74vh,680px);overflow:auto;background:#0e141b;border:1px solid var(--ip,#c9a86a)44;'
      + 'border-radius:14px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);display:none}'
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
    function render() {
      if (!mod || !window.WorldExt) return;
      var wrap = window.WorldExt.modState && window.WorldExt.modState('wr_rpg');
      if (!wrap) return;
      /* WR.module 包装后的 html 接收完整模块状态包裹，内部自行拆 .state */
      var html = '<div class="rpg-hd"><b>🎮 ' + w.game + ' · 角色面板</b><button type="button" id="rpgClose">✕</button></div>'
        + (mod.html ? mod.html(wrap) : '');
      dr.innerHTML = html;
      var c = document.getElementById('rpgClose'); if (c) c.onclick = function () { dr.classList.remove('on'); };
    }
    fab.onclick = function () {
      var open = dr.classList.toggle('on');
      if (open) render();
    };
    /* 模块按钮 act 后刷新抽屉（原 act 只刷新状态栏与沉浸面板） */
    if (window.WorldExt.act && !window.WorldExt.act.__rpg) {
      var orig = window.WorldExt.act;
      window.WorldExt.act = function (id) {
        var out = orig.apply(window.WorldExt, arguments);
        if (id === 'wr_rpg' && dr.classList.contains('on')) render();
        return out;
      };
      window.WorldExt.act.__rpg = true;
    }
    /* 每轮变量更新后同步（面板开着时） */
    if (window.WorldExt.onVars && !window.WorldExt.onVars.__rpg) {
      var origV = window.WorldExt.onVars;
      window.WorldExt.onVars = function () {
        var out = origV.apply(window.WorldExt, arguments);
        if (dr.classList.contains('on')) render();
        return out;
      };
      window.WorldExt.onVars.__rpg = true;
    }
  }
  if (window.YJWait) window.YJWait.for(inject, null, { name: 'rpg-core', base: 160, max: 60 });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
  window.RPGCore = { Engine: Engine, WORLD: WORLD, module: rpgModule, initState: initState, mountFab: mountFab };
})();
