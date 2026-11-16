/* 云境 · 世界专属状态预设 StatusPresets v1.0.0（v4.17.3）
 *
 * 为什么有它
 *   用户要求：「每个世界都有其专属的状态栏、主题、状态设定等等，每个世界都要不一样」。
 *   实际情况：`status-schema.js` 是一张**全宇宙通用**的字段总表（13 组 / 60+ 字段 + 组开关），
 *   全库搜 `genre` 一处都没有 —— 也就是说修仙世界和网游世界、都市世界和克苏鲁世界
 *   用的是**同一套状态栏**。这与「每个世界都要不一样」直接冲突。
 *
 * 设计（复用既有机制，不另造一套）
 *   status-schema 已经有两个可编程入口：
 *     · 组开关 K_OFF      —— 关掉的组既不渲染也不进上报契约（不浪费 token）
 *     · 自定义字段 K_CUSTOM —— 追加任意 {k,label,group} 字段
 *   本模块只做**按世界生成这两份配置**，外加一份字段改名表（relabel），
 *   于是：修真世界看到「境界/灵根/因果」，网游世界看到「等级/职业/公会」，
 *   克苏鲁看到「理智/污染度/途径」，都市看到「职业/资产/人脉」——**各自专属**。
 *
 * 三条纪律
 *   ① **不覆盖玩家的选择**：只在「这个世界第一次进入」时套用预设；
 *      玩家之后手动改过开关/自定义字段，就不再动他的配置。
 *   ② **可一键还原**：面板上给「恢复本界预设」按钮。
 *   ③ **失败不阻断**：任何异常都静默跳过，绝不让状态栏因为预设出错而消失。
 */
(function () {
  'use strict';

  var K_APPLIED = 'yunjingStatusPresetApplied';   // { genre: true } 已套用过的世界
  var K_RELABEL = 'yunjingStatusRelabel';          // { 字段k: 显示名 }

  /* ---- 世界类型原型。每个原型给出：关掉的组、追加字段、字段改名 ---- */
  var ARCH = {
    /* 修真 / 玄幻：修炼体系是核心，战力与境界必须有，现代资源组反而多余 */
    xianxia: {
      off: ['adult'],
      relabel: { realm: '境界', health: '道体状态', injury: '伤势', resource: '随身财物' },
      fields: [
        { k: 'daoji', label: '道基/灵根', group: 'identity' },
        { k: 'gongfa', label: '主修功法', group: 'identity' },
        { k: 'lingshi', label: '灵石/资源', group: 'resource' },
        { k: 'faba', label: '法宝/本命物', group: 'resource' },
        { k: 'yinguo', label: '因果/业障', group: 'state' },
        { k: 'daoxin', label: '道心', group: 'mind' },
        { k: 'chongjing', label: '当前瓶颈', group: 'goal' }
      ]
    },
    /* 网游大世界：等级/职业/装备/公会/副本是骨架 */
    youxi: {
      off: ['adult'],
      relabel: { realm: '等级', role: '职业', health: 'HP/状态', resource: '金币' },
      fields: [
        { k: 'guild', label: '公会/阵营', group: 'relation' },
        { k: 'equip', label: '当前装备', group: 'resource' },
        { k: 'dungeon', label: '副本进度', group: 'goal' },
        { k: 'skillbar', label: '核心技能', group: 'combat' },
        { k: 'rep', label: '声望值', group: 'reputation' },
        { k: 'online', label: '在线/挂机状态', group: 'state' }
      ]
    },
    /* 都市 / 现代：职业、资产、人脉、手机是骨架 */
    dushi: {
      off: ['combat', 'adult'],
      relabel: { realm: '社会阶层', health: '身体状态', resource: '资产', location: '所在' },
      fields: [
        { k: 'job', label: '职业/单位', group: 'identity' },
        { k: 'income', label: '收入/资产', group: 'resource' },
        { k: 'renmai', label: '人脉/靠山', group: 'relation' },
        { k: 'phone', label: '手机/通讯', group: 'resource' },
        { k: 'fame', label: '社会名声', group: 'reputation' },
        { k: 'secret', label: '不为人知的秘密', group: 'secret' }
      ]
    },
    /* 科幻 / 星际：权限、舰船、能量、星域 */
    keji: {
      off: ['adult'],
      relabel: { realm: '权限等级', health: '生命体征', resource: '资源点数', location: '星域坐标' },
      fields: [
        { k: 'ship', label: '舰船/载具', group: 'resource' },
        { k: 'energy', label: '能量/燃料', group: 'resource' },
        { k: 'clearance', label: '权限等级', group: 'identity' },
        { k: 'faction', label: '所属势力', group: 'relation' },
        { k: 'tech', label: '掌握科技', group: 'state' },
        { k: 'signal', label: '通讯/信号状态', group: 'state' }
      ]
    },
    /* 克苏鲁 / 诡秘：理智与污染是命脉 */
    kepfu: {
      off: ['combat', 'adult'],
      relabel: { health: '身体状态', resource: '随身物品', realm: '途径/序列' },
      fields: [
        { k: 'sanity', label: '理智值', group: 'mind' },
        { k: 'corrupt', label: '污染/疯狂度', group: 'state' },
        { k: 'pathway', label: '途径·序列', group: 'identity' },
        { k: 'knowledge', label: '隐秘知识', group: 'secret' },
        { k: 'taboo', label: '已知禁忌', group: 'secret' },
        { k: 'ritual', label: '掌握的仪式', group: 'state' }
      ]
    },
    /* 武侠：内力、招式、江湖名望 */
    wuxia: {
      off: ['adult'],
      relabel: { realm: '内力境界', resource: '随身财物' },
      fields: [
        { k: 'neili', label: '内力/真气', group: 'combat' },
        { k: 'zhaoshi', label: '得意招式', group: 'combat' },
        { k: 'weaponx', label: '趁手兵器', group: 'resource' },
        { k: 'jianghu', label: '江湖名望', group: 'reputation' },
        { k: 'enmity', label: '恩怨', group: 'relation' },
        { k: 'menpai', label: '门派/师承', group: 'relation' }
      ]
    },
    /* 蒸汽魔导 / 近代工业：学派、造物、齿轮 */
    zhengqi: {
      off: ['adult'],
      relabel: { realm: '魔导等级', resource: '资财', location: '所在城邦' },
      fields: [
        { k: 'school', label: '所属学派', group: 'relation' },
        { k: 'contraption', label: '随身造物', group: 'resource' },
        { k: 'runeknow', label: '掌握的符文', group: 'state' },
        { k: 'rank_off', label: '官方身份', group: 'identity' },
        { k: 'steam', label: '魔能/蒸汽余量', group: 'resource' }
      ]
    },
    /* 恐怖 / 悬疑：恐惧、线索、真相 */
    kongbu: {
      off: ['combat', 'adult'],
      relabel: { health: '身心状态', resource: '随身物', location: '当前位置' },
      fields: [
        { k: 'fear', label: '恐惧值', group: 'mind' },
        { k: 'clue', label: '已知线索', group: 'secret' },
        { k: 'truth', label: '触到的真相', group: 'secret' },
        { k: 'missing', label: '缺失的信息', group: 'goal' },
        { k: 'pursuer', label: '追踪者/威胁', group: 'state' }
      ]
    }
  };

  /* ---- 38 界 → 原型 ---- */
  var MAP = {
    daoguiyixian: 'kongbu', mystery: 'kongbu',
    scifi: 'keji', ditandali: 'keji', chaoshenxueyuan: 'keji',
    doupocangqiong: 'xianxia', wanmeishijie: 'xianxia', douluodalu: 'xianxia', shrouding: 'xianxia',
    swallowedstar: 'keji', xianni: 'xianxia', fanrenxiuxian: 'xianxia', jianlai: 'xianxia',
    guzhenren: 'xianxia', xuanjianxianzu: 'xianxia', dazhuzai: 'xianxia', wudongqiankun: 'xianxia',
    yuanzun: 'xianxia', wanxiangzhiwang: 'xianxia', shengxu: 'xianxia', shenmifusu: 'xianxia',
    wulianfengdian: 'xianxia', quanzhifashi: 'youxi', quanzhigaoshou: 'youxi', wangyou: 'youxi',
    cthulhu: 'kepfu', guimi: 'kepfu',
    wuxia: 'wuxia',
    limingzhijian: 'zhengqi',
    earth: 'dushi', zhongshengdushi: 'dushi', zhanhen: 'dushi', longzu: 'dushi',
    quanqiubingfeng: 'dushi', dibao: 'dushi', lunhuileyuan: 'dushi'
    /* free / freeworld：玩家自定义世界，不套任何预设 */
  };

  var SLOTS_ZH = {
    identity: '身份', where: '时空', body: '身体', mind: '精神', resource: '资源',
    reputation: '声望', relation: '关系', goal: '目标', state: '状态效果',
    combat: '战力', secret: '隐秘', adult: '成人向', custom: '自定义'
  };

  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  function genre() {
    try {
      return new URLSearchParams(location.search).get('genre')
        || (window.storyFramework && window.storyFramework.genre) || 'free';
    } catch (e) { return 'free'; }
  }

  /** 本界用哪个原型 */
  function archOf(g) { return MAP[g || genre()] || null; }

  /** 该世界的预设（人可读，供面板展示） */
  function presetOf(g) {
    var a = archOf(g);
    if (!a) return null;
    var A = ARCH[a];
    return {
      arch: a, off: (A.off || []).slice(),
      fields: (A.fields || []).slice(), relabel: Object.assign({}, A.relabel || {}),
      offNames: (A.off || []).map(function (id) { return SLOTS_ZH[id] || id; })
    };
  }

  /** 套用本界预设（幂等；已套用过或玩家改过则跳过） */
  function applyIfNeeded(g, force) {
    try {
      g = g || genre();
      var p = presetOf(g);
      if (!p) return { applied: false, reason: '本界无预设（自由创作世界）' };
      var done = jget(K_APPLIED, {});
      if (done[g] && !force) return { applied: false, reason: '本界已套用过预设' };
      apply(g, force);
      done[g] = true; jset(K_APPLIED, done);
      return { applied: true, preset: p };
    } catch (e) {
      return { applied: false, reason: '预设应用失败：' + (e && e.message) };
    }
  }

  /** 强制套用（「恢复本界预设」按钮用，会覆盖玩家改动） */
  function apply(g, force) {
    g = g || genre();
    var p = presetOf(g);
    if (!p) return false;
    /* ① 组开关：关掉本原型不需要的组（只写 K_OFF，不碰别的） */
    try { jset('yunjingStatusGroupOff', p.off.slice()); } catch (e) { }
    /* ② 字段改名：只改本界声明过的键 */
    try { jset(K_RELABEL, Object.assign({}, p.relabel)); } catch (e) { }
    /* ③ 追加本界专属字段：带 genre 前缀存，切界时按前缀换成新界的
          （旧字段不删——玩家切回原世界时还在） */
    try {
      var all = jget('yunjingStatusCustom', []);
      if (!Array.isArray(all)) all = [];
      /* 分三类，缺一不可：
           mine       —— 本界专属字段（渲染时生效）
           playerOwn  —— 玩家自己手动加的（无 genre 标记，跨世界通用，永远生效）
           stash      —— 其它世界的专属字段（**保留但当前不生效**）
         修正记录：旧写法把 stash 也算进「生效集」，于是切界后上一个世界的字段仍在，
         越切越多（实测切到第 10 个世界时累积了 50+ 字段）。 */
      var mine = all.filter(function (f) { return f && String(f.genre || '') === g; });
      var playerOwn = all.filter(function (f) { return f && !f.genre; });
      var stash = all.filter(function (f) { return f && f.genre && String(f.genre) !== g; });
      if (force || !mine.length) {
        mine = p.fields.map(function (f) { return { k: f.k, label: f.label, group: f.group, genre: g }; });
      }
      jset('yunjingStatusCustom', playerOwn.concat(mine, stash));
    } catch (e) { }
    return true;
  }

  /** 当前生效的改名表（渲染层查它决定字段显示名） */
  function relabelOf() { return jget(K_RELABEL, {}); }

  /** 恢复本界面板预设（对外按钮） */
  function resetToPreset() {
    var g = genre();
    var r = applyIfNeeded(g, true);
    try {
      if (window.showToast) window.showToast(r.applied ? '已恢复本界专属状态预设' : ('恢复失败：' + (r.reason || '')), r.applied ? 'info' : 'error');
    } catch (e) { }
    try { if (window.StatusSchema && window.StatusSchema.render) window.StatusSchema.render(); } catch (e) { }
    return r;
  }

  /** 诊断：本界预设概览（排查用） */
  function diagnose() {
    var g = genre();
    var p = presetOf(g);
    if (!p) return '【' + g + '】自由创作世界，不套用预设（状态栏由玩家自己定义）。';
    return [
      '【' + g + '】状态预设',
      '  原型      : ' + p.arch,
      '  关闭的组  : ' + (p.offNames.join('、') || '（无）'),
      '  专属字段  : ' + p.fields.map(function (f) { return f.label; }).join('、'),
      '  字段改名  : ' + Object.keys(p.relabel).map(function (k) { return k + '→' + p.relabel[k]; }).join('、')
    ].join('\n');
  }

  window.StatusPresets = {
    ARCH: ARCH, MAP: MAP, SLOTS_ZH: SLOTS_ZH,
    genre: genre, archOf: archOf, presetOf: presetOf,
    applyIfNeeded: applyIfNeeded, apply: apply, resetToPreset: resetToPreset,
    relabelOf: relabelOf, diagnose: diagnose
  };

  /* 启动即套用（幂等，不打扰玩家） */
  try { applyIfNeeded(); } catch (e) { }
})();
