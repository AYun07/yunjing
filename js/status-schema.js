/* 云境 · 状态栏字段全集 StatusSchema v1.0.0（v3.53.0）
   ---------------------------------------------------------------------------
   用户诉求：「关于状态栏一定要全面，包括 NSFW 内容和破限内容都要支持」
   解决：把"状态栏能记什么"从各世界各自写死的几个字段，改成一张可开关的字段总表。

   设计要点
   1) 13 个字段组 / 60+ 字段，覆盖身份·时空·身体·精神·资源·声望·关系·目标·
      状态效果·隐秘·战力·成人向·自定义。每字段带多个别名键（中文 + 英文），
      兼容各世界 AI 的历史上报习惯。
   2) 组级开关：默认开核心 9 组，其余（战力 / 成人向 / 自定义）默认关。
      关掉的组既不渲染也不进上报契约——不浪费 token。
   3) 成人向组（18+）：需先过成年确认（MoContentScale.adultConfirmed）才能开；
      字段本身只是中性的状态槽位（关系/状态/记号/禁忌/处境/余韵），
      写什么由作者与模型决定，程序不预置任何文案。
   4) 破限开关（storyBreakLimit）：开后关闭前端软性审查、system 层不再自我审查
      （见 MoContentScale.buildDirective），五条硬底线仍在（见 HARD_LIMITS）。
   5) 字段可点改：面板上点值即改写，同时落到 variables 与主角角色卡。
   6) 上报契约 buildReportDirective()：只含启用字段，交给提示词装配层注入。
*/
(function () {
  'use strict';

  var K_OFF = 'yunjingStatusGroupOff';     // 关闭的组 id 数组
  var K_CUSTOM = 'yunjingStatusCustom';    // 用户自定义字段 [{k,label,group}]
  var K_ADULT = 'yunjingAdultFields';      // 成人向字段组开关
  var K_SHOWEMPTY = 'yunjingStatusShowEmpty'; // 是否显示空字段
  var K_BREAK = 'storyBreakLimit';         // 破限开关

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function jget(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; }
  }
  function jset(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  /* ==================== 字段总表 ==================== */
  /* group: 组 id；keys: 读取别名（按优先级）；adult: 属成人向组 */
  var GROUPS = [
    {
      id: 'identity', name: '身份', icon: '🪪', on: true,
      fields: [
        { k: 'name', label: '姓名', keys: ['name', '姓名', '名字'] },
        { k: 'alias', label: '代号', keys: ['alias', '代号', '称号', '化名'] },
        { k: 'role', label: '身份', keys: ['role', '身份', '职业', '职位'] },
        { k: 'realm', label: '境界/等级', keys: ['realm', '境界', '等级', '修为', '段位'] },
        { k: 'race', label: '种族/血脉', keys: ['race', '种族', '血脉', '体质'] },
        { k: 'age', label: '年龄', keys: ['age', '年龄'] },
        { k: 'gender', label: '性别', keys: ['gender', '性别'] }
      ]
    },
    {
      id: 'where', name: '时空', icon: '🧭', on: true,
      fields: [
        { k: 'location', label: '所在', keys: ['location', '所在', '位置', '地点'] },
        { k: 'time', label: '时刻', keys: ['time', '时刻', '时辰'] },
        { k: 'date', label: '日期', keys: ['date', '日期'] },
        { k: 'weather', label: '天象', keys: ['weather', '天象', '天气'] },
        { k: 'era', label: '时代/纪元', keys: ['era', '时代', '纪元'] }
      ]
    },
    {
      id: 'body', name: '身体', icon: '🩹', on: true,
      fields: [
        { k: 'health', label: '身体状况', keys: ['health', '身体状况', '健康', '体征'] },
        { k: 'injury', label: '伤势', keys: ['injury', '伤势', '伤', '创伤'] },
        { k: 'stamina', label: '体力', keys: ['stamina', '体力', '精力'] },
        { k: 'poison', label: '中毒/异常', keys: ['poison', '中毒', '异常状态', '诅咒'] },
        { k: 'appearance', label: '外貌变化', keys: ['appearance', '外貌', '外形', '容貌'] }
      ]
    },
    {
      id: 'mind', name: '精神', icon: '🧠', on: true,
      fields: [
        { k: 'mood', label: '情绪', keys: ['mood', '情绪', '心情'] },
        { k: 'will', label: '意志', keys: ['will', '意志', '决心'] },
        { k: 'sanity', label: '理智/神志', keys: ['sanity', '理智', '神志', '精神状态'] },
        { k: 'obsession', label: '执念/心魔', keys: ['obsession', '执念', '心魔'] },
        { k: 'memory', label: '记忆', keys: ['memory', '记忆', '失忆'] }
      ]
    },
    {
      id: 'resource', name: '资源', icon: '💠', on: true,
      fields: [
        { k: 'money', label: '钱财', keys: ['money', '钱财', '现金', '资产', '存款'] },
        { k: 'energy', label: '能量', keys: ['energy', '能量', '真元', '灵力', '魔力', '魂力'] },
        { k: 'supply', label: '物资', keys: ['supply', '物资', '补给'] }
      ]
    },
    {
      id: 'fame', name: '声望', icon: '📣', on: true,
      fields: [
        { k: 'fame', label: '名望', keys: ['fame', '名望', '声望', '名声'] },
        { k: 'faction_rep', label: '阵营声望', keys: ['faction_rep', '阵营声望', '势力声望'] },
        { k: 'wanted', label: '通缉度', keys: ['wanted', '通缉', '悬赏'] },
        { k: 'credit', label: '信誉', keys: ['credit', '信誉', '信用'] }
      ]
    },
    {
      id: 'relation', name: '关系', icon: '🪢', on: true,
      fields: [
        { k: 'bonds', label: '羁绊', keys: ['bonds', '羁绊', '关系'] },
        { k: 'favor', label: '好感', keys: ['favor', '好感', '好感度'] },
        { k: 'hostile', label: '敌对', keys: ['hostile', '敌对', '仇敌'] }
      ]
    },
    {
      id: 'quest', name: '目标', icon: '🎯', on: true,
      fields: [
        { k: 'goal', label: '当前目标', keys: ['goal', '目标', '任务'] },
        { k: 'deadline', label: '时限', keys: ['deadline', '时限', '期限'] },
        { k: 'obstacle', label: '阻碍', keys: ['obstacle', '阻碍', '困境'] }
      ]
    },
    {
      id: 'effect', name: '状态效果', icon: '✨', on: true,
      fields: [
        { k: 'buffs', label: '增益', keys: ['buffs', '增益', '加持'] },
        { k: 'debuffs', label: '负面', keys: ['debuffs', '负面', '减益'] },
        { k: 'duration', label: '持续', keys: ['duration', '持续', '剩余'] }
      ]
    },
    {
      id: 'secret', name: '隐秘', icon: '🗝', on: true,
      fields: [
        { k: 'disguise', label: '伪装身份', keys: ['disguise', '伪装', '马甲'] },
        { k: 'secret', label: '秘密', keys: ['secret', '秘密', '隐情'] },
        { k: 'leverage', label: '把柄', keys: ['leverage', '把柄', '弱点'] }
      ]
    },
    {
      id: 'combat', name: '战力', icon: '⚔️', on: false,
      fields: [
        { k: 'power', label: '战力值', keys: ['power', '战力', '战力值'] },
        { k: 'equip', label: '装备', keys: ['equip', '装备', '武器', '防具'] },
        { k: 'skill', label: '已掌握技能', keys: ['skill', '技能', '功法', '招式'] }
      ]
    },
    /* ---- 成人向字段组（18+，默认关闭；字段为中性槽位，不预置任何文案） ---- */
    {
      id: 'adult', name: '成人向（18+）', icon: '🔞', on: false, adult: true,
      tip: '仅供成年作者在自己的虚构作品里记录角色状态。开启需通过成年确认，且只在本地生效。',
      fields: [
        { k: 'intimate', label: '亲密关系', keys: ['intimate', '亲密关系', '关系状态'] },
        { k: 'arousal', label: '情欲状态', keys: ['arousal', '情欲', '欲望状态'] },
        { k: 'marks', label: '身体记号', keys: ['marks', '记号', '痕迹'] },
        { k: 'desire', label: '欲望与禁忌', keys: ['desire', '欲望', '禁忌', '偏好'] },
        { k: 'situation', label: '处境/姿态', keys: ['situation', '处境', '姿态', '状态'] },
        { k: 'aftermath', label: '事后余韵', keys: ['aftermath', '余韵', '事后'] },
        { k: 'consent', label: '双方意愿', keys: ['consent', '意愿', '同意'] }
      ]
    }
  ];

  /* ==================== 开关状态 ==================== */
  function offList() {
    var v = jget(K_OFF, null);
    if (Array.isArray(v)) return v;
    return GROUPS.filter(function (g) { return !g.on; }).map(function (g) { return g.id; });
  }
  function setOff(list) { jset(K_OFF, list); }
  function isOff(id) { return offList().indexOf(id) !== -1; }
  function toggleGroup(id) {
    var l = offList();
    var i = l.indexOf(id);
    if (i === -1) l.push(id); else l.splice(i, 1);
    setOff(l);
    return i === -1;
  }
  function adultOn() { return localStorage.getItem(K_ADULT) === '1'; }
  function setAdult(v) {
    if (v) {
      try { localStorage.setItem(K_ADULT, '1'); } catch (e) {}
    } else {
      try { localStorage.removeItem(K_ADULT); } catch (e) {}
    }
  }
  function breakOn() { return localStorage.getItem(K_BREAK) === '1'; }
  function setBreak(v) {
    if (v) { try { localStorage.setItem(K_BREAK, '1'); } catch (e) {} }
    else { try { localStorage.removeItem(K_BREAK); } catch (e) {} }
  }
  /* v4.17.3：自定义字段按世界过滤。
     世界专属预设会给字段打上 `genre` 标记；**只有本界的（或玩家自己加的、无标记的）
     才生效**，其它世界的保留在库里但不渲染——玩家切回原世界时自动重现。
     旧写法不过滤，导致换世界后字段不断累积（实测切 10 个世界累积 50+ 个）。 */
  function currentGenre() {
    try {
      return new URLSearchParams(location.search).get('genre')
        || (window.storyFramework && window.storyFramework.genre) || '';
    } catch (e) { return ''; }
  }

  /* v4.17.5：中文 label → 可读取的 key 候选（顺序即优先级）。
     模型按契约用中文 label 上报，所以要能把 label 本身当 key 找；
     再容忍「/」拆开的简称（`道基/灵根` → 也认 `道基`、`灵根`）
     与去标点写法（`途径·序列` → 也认 `途径序列`），最后才落到英文 k 兜底。 */
  function keysForLabel(label, k) {
    var out = [];
    var L = String(label || '').trim();
    if (L) {
      out.push(L);
      var noPunct = L.replace(/[\/·、,，\s]/g, '');
      if (noPunct && noPunct !== L) out.push(noPunct);
      if (L.indexOf('/') >= 0) {
        L.split('/').forEach(function (p) { p = p.trim(); if (p && out.indexOf(p) < 0) out.push(p); });
      }
      if (L.indexOf('·') >= 0) {
        L.split('·').forEach(function (p) { p = p.trim(); if (p && out.indexOf(p) < 0) out.push(p); });
      }
    }
    if (k && out.indexOf(k) < 0) out.push(k);
    return out;
  }
  function customFields() {
    var v = jget(K_CUSTOM, []);
    if (!Array.isArray(v)) v = [];
    var g = currentGenre();
    /* v4.17.5 修一个真 bug（用户追问「填表会不会出错」时查出来的）：
       自定义字段的 keys 此前只放了英文 key（如 'daoji'），而 buildReportDirective()
       明确要求模型「一律使用中文 label，严禁英文 key」。于是模型写的是
       `道基/灵根：天灵根`，读取器却去找 `daoji` —— **永远读不到，状态栏永远空白**。
       更矛盾的是契约本身还渲染成 `道基/灵根(daoji)`，等于直接叫模型用英文 key。
       现改为：keys 里**中文 label 优先**，并容忍「/」两边的简称（道基、灵根都认），
       英文 k 仅作兜底兼容。 */
    var base = v.filter(function (f) {
      if (!f || !f.k || !f.label) return false;
      if (!f.genre) return true;              // 玩家自己加的：跨世界通用
      return !g || String(f.genre) === g;     // 世界预设：只认本界
    }).map(function (f) {
      var keys = Array.isArray(f.keys) && f.keys.length ? f.keys.slice() : [];
      keysForLabel(f.label, f.k).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
      return Object.assign({}, f, { keys: keys, custom: true });
    });
    /* v4.17.3：插件通过 status:extend 扩展点贡献的字段（去重，不覆盖已有键） */
    try {
      var P = window.PluginRuntime;
      if (P && P.collectStatusFields) {
        var have = {};
        base.forEach(function (f) { have[f.k] = true; });
        P.collectStatusFields().forEach(function (f) {
          if (!f || !f.k || !f.label || have[f.k]) return;
          have[f.k] = true;
          base.push({ k: f.k, label: f.label, group: f.group || 'custom', keys: keysForLabel(f.label, f.k), custom: true, fromPlugin: true });
        });
      }
    } catch (e) { }
    return base;
  }
  function setCustom(list) { jset(K_CUSTOM, list); }

  /** v4.17.3 字段改名表：由 StatusPresets 按**当前世界**给出
   *  （修真世界把 realm 显示为「境界」、网游世界显示为「等级」、克苏鲁显示为「途径序列」…）。
   *  取不到预设模块时返回空表，行为与旧版完全一致。 */
  function relabelMap() {
    try {
      var P = window.StatusPresets;
      return (P && P.relabelOf) ? (P.relabelOf() || {}) : {};
    } catch (e) { return {}; }
  }
  /** 应用改名：只改显示名 label，不动键 k（上报契约仍用 k，AI 侧无需感知） */
  function applyRelabel(fields) {
    var m = relabelMap();
    if (!m || !Object.keys(m).length) return fields;
    return fields.map(function (f) {
      var n = m[f.k];
      return n ? Object.assign({}, f, { label: n, _baseLabel: f.label }) : f;
    });
  }

  /** 当前生效的组（含成人组门禁与自定义组） */
  function activeGroups() {
    var out = GROUPS.filter(function (g) {
      if (isOff(g.id)) return false;
      if (g.adult && !(adultOn() && adultConfirmed())) return false;
      return true;
    }).map(function (g) { return { id: g.id, name: g.name, icon: g.icon, tip: g.tip, adult: !!g.adult, fields: applyRelabel(g.fields.slice()) }; });
    var cs = customFields();
    if (cs.length) {
      /* v4.19.0b：专属字段是本界招牌，标题带世界名且加 exclusive 标记（渲染层据此高亮+开局可见）。 */
      var isExclusiveGrp = cs.some(function (f) { return f.genre; });
      var zhName = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreName) || currentGenre() || '特色';
      out.push({
        /* v4.17.5：**保留** customFields() 已经算好的 keys，不要覆盖成 [f.k]。
           旧写法在这一步把 label 键全丢了，导致「模型按中文 label 上报、读取器只认英文 key」，
           状态栏里 14 个自定义字段永远读不出值（实测「按中文 label 上报后读到 = {}」）。 */
        id: 'custom', name: isExclusiveGrp ? '本界专属 · ' + zhName : '自定义', icon: isExclusiveGrp ? '✦' : '🧩',
        exclusive: isExclusiveGrp, fields: cs.map(function (f) {
          return { k: f.k, label: f.label, keys: (f.keys && f.keys.length ? f.keys : keysForLabel(f.label, f.k)), custom: true, genre: f.genre };
        })
      });
    }
    return out;
  }

  function adultConfirmed() {
    try { return window.MoContentScale ? window.MoContentScale.adultConfirmed() : localStorage.getItem('storyAdultConfirmed') === '1'; } catch (e) { return false; }
  }

  /* ==================== 取值 ==================== */
  function playerName() {
    try {
      var fw = window.storyFramework;
      var s = fw && fw.storyState;
      return (s && s.setup && s.setup.playerName) || '';
    } catch (e) { return ''; }
  }
  /** 值清洗：模型常把值写成 `"张三",` / `'无'` / `""`，这里去掉成对引号与尾随标点 */
  function cleanVal(x) {
    var s = String(x == null ? '' : x).trim();
    /* 引号与尾随标点会互相遮挡（`"草鞋匠铺学徒",` 去引号后还剩逗号，去逗号后又剩引号），
       所以交替剥两轮再收工 */
    for (var i = 0; i < 3; i++) {
      var before = s;
      s = s.replace(/^["'“”‘’《【\[]+/, '').replace(/["'“”‘’》】\]]+$/, '');
      s = s.replace(/[,，;；、。]+$/, '').trim();
      if (s === before) break;
    }
    if (!s) return '';
    if (/^(null|undefined|nan|—|-)$/i.test(s)) return '';
    return s;
  }

  /* ============ 多值栏目 v4.27.0 ============
     有些状态维度天生可同时存在多项（斗罗九枚魂环、多块魂骨、多位队友…）。
     单值字符串写不下也显示不出。多值栏目统一用数组存；同时兼容模型上报的
     「用 / 、 , ；分隔的一行文本」，自动拆成数组，老存档/老模型都不会失效。 */
  function fieldIsMulti(f) {
    if (!f) return false;
    if (f.multi) return true;
    /* 专属字段来自 StatusWorldFields.parse 已带 multi；自定义字段按 label 判定 */
    try {
      var SW = window.StatusWorldFields;
      if (SW && SW.isMulti && SW.isMulti(f.label)) return true;
    } catch (e) {}
    return false;
  }
  /* 把任意值规整成字符串数组：数组直接用；字符串按常见分隔符拆；空→[] */
  function toList(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map(function (x) { return cleanVal(typeof x === 'string' ? x : (x && (x.v || x.name || x.text)) || ''); })
        .filter(function (x) { return !!x; });
    }
    var s = cleanVal(raw);
    if (!s) return [];
    /* 优先按换行拆；否则按 / 、 , ; ； 拆；都不含则单项 */
    var parts = s.split(/\n+|[\/、,，;；]+/).map(function (x) { return cleanVal(x); }).filter(function (x) { return !!x; });
    return parts.length ? parts : [s];
  }
  /** 多值栏目读取：始终返回字符串数组 */
  function readList(f) {
    try {
      var fw = window.storyFramework;
      var v = (fw && fw.storyState && fw.storyState.variables) || {};
      var pn = playerName();
      var c = v.characters && typeof v.characters === 'object' ? v.characters[pn] : null;
      for (var i = 0; i < f.keys.length; i++) {
        var key = f.keys[i];
        var pool = [v[key], c ? c[key] : null, pn ? v[pn + '.' + key] : null];
        for (var j = 0; j < pool.length; j++) {
          var list = toList(pool[j]);
          if (list.length) return list;
        }
      }
    } catch (e) {}
    return [];
  }

  /** 从 variables / 主角角色卡 / 平铺「主角.字段」三处取值 */
  function readField(f) {
    if (fieldIsMulti(f)) return readList(f);
    try {
      var fw = window.storyFramework;
      var v = (fw && fw.storyState && fw.storyState.variables) || {};
      var pn = playerName();
      /* 姓名这一格永远代表玩家本人：优先用开局设定里的名字，
         否则模型上报的顶层 name 很可能是某个 NPC（实测出现过「姓名 老周头」） */
      if (f.k === 'name' && pn) return pn;
      var c = v.characters && typeof v.characters === 'object' ? v.characters[pn] : null;
      for (var i = 0; i < f.keys.length; i++) {
        var key = f.keys[i];
        var a = cleanVal(v[key]);
        if (a) return a;
        if (c) { var b = cleanVal(c[key]); if (b) return b; }
        if (pn) { var flat = cleanVal(v[pn + '.' + key]); if (flat) return flat; }
      }
    } catch (e) {}
    return '';
  }
  function writeField(f, value) {
    try {
      var fw = window.storyFramework;
      if (!fw || !fw.storyState) return false;
      var v = fw.storyState.variables || (fw.storyState.variables = {});
      var key = f.keys[0];
      /* 多值栏目落库为数组（保持顺序）；单值维持原样 */
      var store = fieldIsMulti(f) ? toList(value) : value;
      v[key] = store;
      var pn = playerName();
      if (pn) {
        if (!v.characters || typeof v.characters !== 'object') v.characters = {};
        if (!v.characters[pn]) v.characters[pn] = {};
        v.characters[pn][key] = store;
        v[pn + '.' + key] = store;
      }
      if (fw.saveStory) fw.saveStory();
      return true;
    } catch (e) { return false; }
  }

  /* ==================== 渲染 ==================== */
  function sectionHTML(gs) {
    return gs.map(function (g) {
      var rows = g.fields.map(function (f) {
        var val = readField(f);
        /* 开局可见性（v4.19.0b）：
           ① 本界专属字段（custom 组）——永远显示，空值给「—」。玩家一进场就能看到
              本世界 14 个招牌字段，这正是「每界状态栏都不同」的承诺所在；若沿用旧的
              「空值折叠」，真实玩家开局一个专属字段都看不到（只有一句提示），等于白做。
           ② 成人向字段组：已确认成年并开启则常驻。
           ③ 通用空字段：仍折叠，避免面板被几十个英文槽位撑爆。
           showEmpty 全开时则一律显示。 */
        var isExclusive = g.id === 'custom' || f.custom;
        var alwaysShow = isExclusive || (g.adult && adultOn() && adultConfirmed())
          || localStorage.getItem(K_SHOWEMPTY) === '1';
        if (!val && !alwaysShow) return '';
        var vHTML;
        if (fieldIsMulti(f)) {
          var ml = Array.isArray(val) ? val : (val ? [val] : []);
          vHTML = ml.length
            ? '<span class="yj-st-v yj-multi" onclick="StatusSchema.editField(\'' + esc(f.k) + '\')">' +
              ml.slice(0, 9).map(function (x, i) { return '<span class="yj-mi"><b>' + (i + 1) + '</b>' + esc(x) + '</span>'; }).join('') +
              (ml.length > 9 ? '<span class="yj-mi-more">+' + (ml.length - 9) + ' 项</span>' : '') + '</span>'
            : '<span class="yj-st-v empty yj-multi-empty" onclick="StatusSchema.editField(\'' + esc(f.k) + '\')">— ＋</span>';
        } else {
          vHTML = '<span class="yj-st-v' + (val ? '' : ' empty') + '" onclick="StatusSchema.editField(\'' + esc(f.k) + '\')">' + esc(val || '—') + '</span>';
        }
        return '<div class="yj-st-row' + (isExclusive ? ' exclusive' : '') + (fieldIsMulti(f) ? ' multi' : '') + '" data-fk="' + esc(f.k) + '">' +
          '<span class="yj-st-k">' + esc(f.label) + '</span>' + vHTML +
          '</div>';
      }).join('');
      if (!rows) return '';
      return '<div class="yj-st-group' + (g.adult ? ' adult' : '') + (g.exclusive ? ' exclusive' : '') + '">' +
        '<div class="yj-st-gname">' + g.icon + ' ' + esc(g.name) + '</div>' +
        '<div class="yj-st-rows">' + rows + '</div></div>';
    }).join('');
  }

  /** 确保分区已插入面板（面板可能比本模块先渲染，也可能还没渲染） */
  function ensureSection() {
    if (document.getElementById('yjStatusSection')) return true;
    var host = document.querySelector('#statusPanelContainer .status-panel') || document.getElementById('statusPanelContainer');
    if (!host) return false;
    var d = document.createElement('div');
    d.className = 'panel-section';
    d.id = 'yjStatusSection';
    d.innerHTML = '<div class="section-title">◈ 完整状态栏' +
      '<button class="yj-st-cog" onclick="StatusSchema.openSettings()" title="字段组开关 / 自定义字段 / 成人向 / 破限">⚙ 设置</button>' +
      '</div><div id="yjStatusBody"></div>';
    var first = host.querySelector('.panel-section');
    if (first && first.parentNode === host) {
      if (first.nextSibling) host.insertBefore(d, first.nextSibling);
      else host.appendChild(d);
    } else host.appendChild(d);
    return true;
  }

  function render() {
    ensureSection();
    var host = document.getElementById('yjStatusBody');
    if (!host) return;
    var gs = activeGroups();
    /* v4.19.3：8 套题材皮肤。有专属字段（本界预设）时按皮肤渲染器出差异化结构，
       每个世界主题结构/装饰/字体全不同；无专属字段（自由世界/未套预设）回退通用表格。
       无论走哪条路，字段读写都还是本模块的 readField/editField，功能零变化。 */
    var hasExclusive = gs.some(function (g) { return g.exclusive; });
    var html;
    if (hasExclusive && window.StatusSkins && window.StatusSkins.render) {
      html = window.StatusSkins.render(gs, currentGenre());
    } else {
      var sec = document.getElementById('yjStatusSection');
      if (sec) sec.removeAttribute('data-status-skin');
      html = sectionHTML(gs);
    }
    var flags = [];
    /* v4.27.0 填表规则标记：让玩家随时看清当前是严格演算还是玩家自由 */
    try { if (window.FillRule && window.FillRule.flagHTML) flags.push(window.FillRule.flagHTML()); } catch (e) {}
    if (adultOn() && adultConfirmed()) flags.push('<span class="yj-st-flag adult">🔞 成人字段已开</span>');
    if (breakOn()) flags.push('<span class="yj-st-flag brk">⛓ 破限已开</span>');
    host.innerHTML = (flags.length ? '<div class="yj-st-flags">' + flags.join('') + '</div>' : '') +
      (html || '<div class="empty-hint">开篇后按上报自动点亮；也可点「⚙ 设置」打开更多字段组，或直接点字段手写。</div>');
  }

  function mount() {
    var SSR = window.StoryStatusRenderer;
    if (!SSR) return false;
    if (SSR.__yjStatusHooked) return true;
    SSR.__yjStatusHooked = true;
    var origRefresh = SSR.refresh.bind(SSR);
    SSR.refresh = function (vars) {
      try { origRefresh(vars); } catch (e) { console.warn('[StatusSchema] refresh 外层异常', e); }
      try { render(); } catch (e) {}
    };
    var origGen = SSR.generatePanelHTML.bind(SSR);
    SSR.generatePanelHTML = function () {
      var html = '';
      try { html = origGen(); } catch (e) {}
      var sec = '<div class="panel-section" id="yjStatusSection">' +
        '<div class="section-title">◈ 完整状态栏' +
        '<button class="yj-st-cog" onclick="StatusSchema.openSettings()" title="字段组开关 / 自定义字段 / 成人向 / 破限">⚙ 设置</button>' +
        '</div>' +
        '<div id="yjStatusBody"><div class="empty-hint">开篇后按上报自动点亮</div></div>' +
        '</div>';
      /* 插到「章节进度」之后；找不到位置就追加到面板末尾 */
      var anchor = '<div class="panel-section">\n                <div class="section-title">◈';
      if (html.indexOf(anchor) !== -1) return html.replace(anchor, sec + anchor);
      var i = html.lastIndexOf('</div>');
      return i > 0 ? html.slice(0, i) + sec + html.slice(i) : html + sec;
    };
    render();
    return true;
  }

  /* ==================== 设置面板 ==================== */
  function settingsHTML() {
    var gs = GROUPS.map(function (g) {
      var on = !isOff(g.id);
      var lock = g.adult && !adultConfirmed();
      return '<div class="yj-set-row' + (lock ? ' locked' : '') + '">' +
        '<label><input type="checkbox" ' + (on ? 'checked' : '') + (lock ? ' disabled' : '') +
        ' onchange="StatusSchema.toggleGroup(\'' + g.id + '\', this.checked)">' +
        '<span>' + g.icon + ' ' + esc(g.name) + '</span>' +
        '<i>' + g.fields.length + ' 字段' + (g.adult ? ' · 18+' : '') + '</i></label></div>';
    }).join('');
    var cs = customFields();
    var customHTML = cs.map(function (f, i) {
      return '<div class="yj-set-cus">' +
        '<input class="yj-set-in short" value="' + esc(f.k) + '" onchange="StatusSchema.editCustom(' + i + ',\'k\',this.value)" placeholder="字段键（英文/拼音）">' +
        '<input class="yj-set-in" value="' + esc(f.label) + '" onchange="StatusSchema.editCustom(' + i + ',\'label\',this.value)" placeholder="显示名">' +
        '<button class="yj-set-del" onclick="StatusSchema.delCustom(' + i + ')">✕</button></div>';
    }).join('');
    return `
        <div class="modal-box">
            <div class="modal-header">
                <span>⚙ 状态栏设置</span>
                <button class="modal-close" onclick="StatusSchema.closeSettings()">✕</button>
            </div>
            <div class="modal-body yj-set-body">
                <div class="yj-set-sec">字段组（关掉的组不渲染、也不进上报契约，省 token）</div>
                ${gs}
                <div class="yj-set-sec">成人向字段（18+）</div>
                <div class="yj-set-row">
                    <label><input type="checkbox" ${adultOn() && adultConfirmed() ? 'checked' : ''} ${adultConfirmed() ? '' : 'disabled'} onchange="StatusSchema.setAdult(this.checked)">
                    <span>🔞 启用成人向字段组</span><i>${adultConfirmed() ? '' : '需先在「⚙ 接口 → 内容尺度」确认已成年'}</i></label>
                </div>
                <div class="yj-set-note">字段只是中性的状态槽位（关系 / 状态 / 记号 / 禁忌 / 处境 / 余韵），写什么完全由你和模型决定，程序不预置任何文案。硬底线始终有效：仅成年虚构角色、不写真实人物、不美化性暴力。</div>
                ${window.FillRule && window.FillRule.settingsHTML ? window.FillRule.settingsHTML() : ''}
                <div class="yj-set-sec">破限模式</div>
                <div class="yj-set-row">
                    <label><input type="checkbox" ${breakOn() ? 'checked' : ''} onchange="StatusSchema.askBreak(this.checked)">
                    <span>⛓ 破限（关闭软性审查与自我审查）</span><i>极端题材 / 道德灰暗</i></label>
                </div>
                <div class="yj-set-note">开启后：前端不再做套话与敏感词拦截，提示词层明确要求模型不因题材敏感而拒写、不切黑、不加免责声明与说教。未成年人、真实人物、违法操作指南三条硬底线仍然保留。</div>
                <div class="yj-set-sec">自定义字段</div>
                ${customHTML || '<div class="yj-set-note">还没有自定义字段。加了之后，AI 会在每轮末尾按契约上报它。</div>'}
                <button class="btn-ghost btn-mini" onclick="StatusSchema.addCustom()">＋ 加字段</button>
                <div class="yj-set-sec">显示</div>
                <div class="yj-set-row">
                    <label><input type="checkbox" ${localStorage.getItem(K_SHOWEMPTY) === '1' ? 'checked' : ''} onchange="StatusSchema.setShowEmpty(this.checked)">
                    <span>显示空字段（方便手写补值）</span></label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StatusSchema.closeSettings()">关闭</button>
            </div>
        </div>`;
  }

  /* ============ 多值栏目编辑器 v4.27.0 ============
     一栏可填多项（九个魂环、多块魂骨、多位队友…），支持逐项增删排序 + 批量粘贴。 */
  var _multiF = null;
  function openMultiEditor(f) {
    _multiF = f;
    var list = readList(f);
    if (!list.length) list = [''];
    var m = document.getElementById('yjMultiEditor');
    if (!m) {
      m = document.createElement('div');
      m.id = 'yjMultiEditor';
      m.className = 'modal-overlay';
      m.addEventListener('click', function (e) { if (e.target === m) closeMultiEditor(); });
      document.body.appendChild(m);
    }
    m.innerHTML =
      '<div class="yj-me-box">' +
        '<div class="yj-me-hd"><b>✎ ' + esc(f.label) + '</b>' +
          '<i>多值栏目 · 可填多项，每行一项</i>' +
          '<button class="yj-me-x" onclick="StatusSchema.closeMultiEditor()" title="关闭">✕</button></div>' +
        '<div class="yj-me-tip">此栏目可同时记录多个内容（如九枚魂环逐条列出）。拖动顺序可用右侧 ↑↓ 调整。</div>' +
        '<div class="yj-me-list" id="yjMeList">' + list.map(function (v, i) { return multiRowHTML(v); }).join('') + '</div>' +
        '<button class="yj-me-add" onclick="StatusSchema.multiAdd()">＋ 添加一项</button>' +
        '<div class="yj-me-bulk">' +
          '<div class="yj-me-bulk-t">批量粘贴（多行，或用 / 、 分隔一次导入多项）</div>' +
          '<textarea id="yjMeBulk" rows="3" placeholder="例：\n第一魂环：百年曼陀罗蛇\n第二魂环：千年大力猩猩\n第三魂环：万年…"></textarea>' +
          '<button class="yj-me-import" onclick="StatusSchema.multiImport()">⇩ 导入为多项</button>' +
        '</div>' +
        '<div class="yj-me-ft">' +
          '<button class="btn-ghost" onclick="StatusSchema.closeMultiEditor()">取消</button>' +
          '<button class="btn-primary" onclick="StatusSchema.multiSave()">保存</button>' +
        '</div>' +
      '</div>';
    m.style.display = 'flex';
    injectMultiCSS();
  }
  function multiRowHTML(v) {
    return '<div class="yj-me-row">' +
      '<span class="yj-me-idx">•</span>' +
      '<input type="text" value="' + esc(v) + '" placeholder="输入一项内容">' +
      '<button class="yj-me-mv" onclick="StatusSchema.multiMove(this,1)" title="上移">↑</button>' +
      '<button class="yj-me-mv" onclick="StatusSchema.multiMove(this,-1)" title="下移">↓</button>' +
      '<button class="yj-me-del" onclick="StatusSchema.multiDel(this)" title="删除">✕</button>' +
      '</div>';
  }
  function multiValues() {
    var box = document.getElementById('yjMeList');
    if (!box) return [];
    return [].map.call(box.querySelectorAll('input'), function (inp) { return inp.value.trim(); })
      .filter(function (x) { return !!x; });
  }
  function closeMultiEditor() {
    var m = document.getElementById('yjMultiEditor');
    if (m) m.style.display = 'none';
    _multiF = null;
  }
  function injectMultiCSS() {
    if (document.getElementById('yj-me-css')) return;
    var st = document.createElement('style');
    st.id = 'yj-me-css';
    st.textContent =
      '#yjMultiEditor .yj-me-box{width:min(560px,94vw);max-height:90vh;overflow:auto;background:linear-gradient(160deg,#16202e,#0e1420);' +
        'border:1px solid #2f4460;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.6);color:#e6edf7;font-family:inherit}' +
      '#yjMultiEditor .yj-me-hd{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #273650;position:relative}' +
      '#yjMultiEditor .yj-me-hd b{font-size:17px;color:#e8c877;letter-spacing:.08em}' +
      '#yjMultiEditor .yj-me-hd i{font-size:11px;color:#8496ad;font-style:normal;margin-left:auto;margin-right:26px}' +
      '#yjMultiEditor .yj-me-x{position:absolute;right:14px;top:14px;background:none;border:none;color:#8496ad;cursor:pointer;font-size:16px}' +
      '#yjMultiEditor .yj-me-tip{padding:10px 18px 0;font-size:12px;color:#8496ad;line-height:1.6}' +
      '#yjMultiEditor .yj-me-list{padding:12px 18px;display:flex;flex-direction:column;gap:8px}' +
      '#yjMultiEditor .yj-me-row{display:flex;align-items:center;gap:6px}' +
      '#yjMultiEditor .yj-me-idx{width:16px;color:#e8c877;font-weight:700;flex:0 0 auto}' +
      '#yjMultiEditor .yj-me-row input{flex:1;min-width:0;padding:8px 10px;background:#0d1420;border:1px solid #32445f;border-radius:7px;color:#e6edf7;font-family:inherit;font-size:13px;outline:none}' +
      '#yjMultiEditor .yj-me-row input:focus{border-color:#e8c877;box-shadow:0 0 0 2px rgba(232,200,119,.15)}' +
      '#yjMultiEditor .yj-me-mv,#yjMultiEditor .yj-me-del{flex:0 0 auto;width:28px;height:28px;border-radius:6px;border:1px solid #32445f;background:#182337;color:#aebdd0;cursor:pointer;font-size:13px}' +
      '#yjMultiEditor .yj-me-mv:hover{background:#22304a;color:#e8c877}' +
      '#yjMultiEditor .yj-me-del:hover{background:#4a2323;color:#ff9a8a;border-color:#6a3030}' +
      '#yjMultiEditor .yj-me-add{margin:2px 18px;padding:9px;border:1px dashed #465b78;background:transparent;color:#9fc4e8;border-radius:8px;cursor:pointer;font-size:13px}' +
      '#yjMultiEditor .yj-me-add:hover{background:#16263a;border-color:#e8c877;color:#e8c877}' +
      '#yjMultiEditor .yj-me-bulk{margin:14px 18px 4px;padding:12px;background:#0c121d;border:1px solid #263650;border-radius:9px}' +
      '#yjMultiEditor .yj-me-bulk-t{font-size:12px;color:#8496ad;margin-bottom:7px}' +
      '#yjMultiEditor .yj-me-bulk textarea{width:100%;box-sizing:border-box;padding:9px 10px;background:#0d1420;border:1px solid #32445f;border-radius:7px;color:#e6edf7;font-family:inherit;font-size:12px;resize:vertical;outline:none}' +
      '#yjMultiEditor .yj-me-import{margin-top:8px;padding:7px 12px;background:#1e3a52;border:1px solid #3a6a8a;color:#9fd8f0;border-radius:7px;cursor:pointer;font-size:12px}' +
      '#yjMultiEditor .yj-me-import:hover{background:#274b6a}' +
      '#yjMultiEditor .yj-me-ft{display:flex;justify-content:flex-end;gap:10px;padding:14px 18px 18px}' +
      '#yjMultiEditor .yj-me-ft button{padding:9px 22px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit}' +
      '#yjMultiEditor .btn-ghost{background:transparent;border:1px solid #3a4a63;color:#aebdd0}' +
      '#yjMultiEditor .btn-primary{background:linear-gradient(135deg,#c9a24c,#a8342a);border:none;color:#fff;font-weight:600}';
    document.head.appendChild(st);
  }

  var StatusSchema = {
    GROUPS: GROUPS,
    mount: mount,
    render: render,
    activeGroups: activeGroups,
    readField: readField,
    readList: readList,
    fieldIsMulti: fieldIsMulti,
    keysForLabel: keysForLabel,
    isOff: isOff,
    toggleGroup: function (id, on) {
      var cur = !isOff(id);
      if (cur === !!on) return;
      toggleGroup(id);
      render();
      this.openSettings();
    },
    setAdult: function (on) {
      if (on && !adultConfirmed()) {
        alert('请先在「⚙ 接口 → 内容尺度」里确认已成年，再来开启。');
        render(); this.openSettings(); return;
      }
      setAdult(on);
      /* 字段组开关与成人开关联动：开成人字段即打开该组，关掉时收回该组 */
      var l = offList();
      var i = l.indexOf('adult');
      if (on && i !== -1) l.splice(i, 1);
      else if (!on && i === -1) l.push('adult');
      setOff(l);
      render(); this.openSettings();
    },
    askBreak: function (on) {
      var self = this;
      if (!on) { setBreak(false); render(); this.openSettings(); return; }
      var ok = confirm(
        '破限模式会关掉软性审查，并要求模型不再因题材敏感而拒写、切黑或加免责声明。\n\n' +
        '保留的三条硬底线：不写未成年人的性内容、不写真实在世人物、不提供现实违法操作指南。\n\n' +
        '确认开启？'
      );
      if (!ok) { render(); this.openSettings(); return; }
      setBreak(true);
      render(); this.openSettings();
    },
    breakOn: breakOn,
    setBreak: setBreak,
    setShowEmpty: function (on) {
      try { if (on) localStorage.setItem(K_SHOWEMPTY, '1'); else localStorage.removeItem(K_SHOWEMPTY); } catch (e) {}
      render();
    },
    addCustom: function () {
      var l = customFields();
      l.push({ k: '', label: '' });
      setCustom(l);
      this.openSettings();
    },
    editCustom: function (i, key, v) {
      var l = customFields();
      if (!l[i]) return;
      l[i][key] = String(v || '').trim();
      setCustom(l);
    },
    delCustom: function (i) {
      var l = customFields();
      l.splice(i, 1);
      setCustom(l);
      this.openSettings();
    },
    editField: function (k) {
      var f = null;
      activeGroups().forEach(function (g) {
        g.fields.forEach(function (x) { if (x.k === k) f = x; });
      });
      if (!f) return;
      /* 多值栏目：打开可视化的多值编辑器（增删/排序/批量粘贴） */
      if (fieldIsMulti(f)) { openMultiEditor(f); return; }
      var cur = readField(f);
      var nv = prompt('修改「' + f.label + '」（留空表示清空）：', cur);
      if (nv == null) return;
      if (writeField(f, nv)) { render(); if (window.showToast) window.showToast('已更新 ' + f.label, 'ok'); }
      else alert('写入失败：故事尚未初始化。');
    },
    closeMultiEditor: closeMultiEditor,
    multiAdd: function () {
      var box = document.getElementById('yjMeList');
      if (!box) return;
      var d = document.createElement('div');
      d.innerHTML = multiRowHTML('');
      box.appendChild(d.firstChild);
      var ins = box.lastElementChild.querySelector('input');
      if (ins) ins.focus();
    },
    multiDel: function (btn) {
      var box = document.getElementById('yjMeList');
      var row = btn.closest('.yj-me-row');
      if (box && row && box.children.length > 1) row.remove();
      else if (row) row.querySelector('input').value = '';
    },
    multiMove: function (btn, dir) {
      var row = btn.closest('.yj-me-row');
      if (!row) return;
      if (dir > 0 && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
      else if (dir < 0 && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
    },
    multiImport: function () {
      var ta = document.getElementById('yjMeBulk');
      var box = document.getElementById('yjMeList');
      if (!ta || !box || !ta.value.trim()) return;
      var items = ta.value.split(/\n+|[\/、,，;；]+/).map(function (x) { return x.trim(); }).filter(function (x) { return !!x; });
      if (!items.length) return;
      box.innerHTML = items.map(function (v) { return multiRowHTML(v); }).join('');
      ta.value = '';
      if (window.showToast) window.showToast('已导入 ' + items.length + ' 项，检查后保存', 'ok');
    },
    multiSave: function () {
      if (!_multiF) { closeMultiEditor(); return; }
      var vals = multiValues();
      if (writeField(_multiF, vals)) {
        closeMultiEditor(); render();
        if (window.showToast) window.showToast('已保存 ' + vals.length + ' 项到「' + _multiF.label + '」', 'ok');
      } else alert('写入失败：故事尚未初始化。');
    },
    openSettings: function () {
      var m = document.getElementById('yjStatusSettings');
      if (!m) {
        m = document.createElement('div');
        m.id = 'yjStatusSettings';
        m.className = 'modal-overlay';
        m.addEventListener('click', function (e) { if (e.target === m) StatusSchema.closeSettings(); });
        document.body.appendChild(m);
      }
      m.innerHTML = settingsHTML();
      m.style.display = 'flex';
    },
    closeSettings: function () {
      var m = document.getElementById('yjStatusSettings');
      if (m) m.style.display = 'none';
    },
    /** 给提示词装配用的上报契约（只含启用字段；分「必报」与「选报」两级，遵循率更高） */
    buildReportDirective: function () {
      var gs = activeGroups();
      if (!gs.length) return '';
      /* 必报八项：状态栏不空、读者有实感的最小集合 */
      var CORE = ['name', 'location', 'time', 'health', 'injury', 'mood', 'goal', 'money'];
      var core = [];
      var rest = [];
      gs.forEach(function (g) {
        g.fields.forEach(function (f) {
          var tag = f.label;
          if (CORE.indexOf(f.k) !== -1) core.push(tag);
        });
        /* v4.17.5：自定义字段只写中文 label，**不再附英文 key**。
           旧写法对自定义字段会渲染成 `道基/灵根(daoji)`，与本契约自己的
           「一律使用中文 label，严禁英文 key」直接矛盾 —— 等于叫模型填英文。
           内置字段保留 (key) 提示（它们的 key 是稳定的英文别名，有兼容价值）。 */
        var others = g.fields.filter(function (f) { return CORE.indexOf(f.k) === -1; })
          .map(function (f) { return (f.custom ? f.label : (f.label + '(' + f.keys[0] + ')')) + (fieldIsMulti(f) ? '〔可多项〕' : ''); });
        if (others.length) rest.push('· ' + g.name + '：' + others.join(' / '));
      });
      var out = '【状态栏上报契约（每轮必报）】本轮结束时，在 (variable_update) 块内按下列字段如实上报；' +
        '未变化的也照报（状态栏要连续），确实没有的填「无」。一律使用中文 label（如 所在：骊珠洞天），严禁英文 key（location: 之类）。\n' +
        '必报八项：' + core.join(' / ') + '\n';
      /* 成人向常驻字段：默认归在「选报」会被模型整轮跳过 → 值为空 → 状态栏里整组不显示。
         这里提升为必报，并写明 readField 认得的键名（情欲/亲密关系），无则填「无」。 */
      if (adultOn() && adultConfirmed()) {
        out += '成人向必报（每轮必报，无则填「无」，键名照抄）：情欲 / 亲密关系\n';
      }
      if (rest.length) out += '选报（与情节相关就报，能显著提升状态栏的信息量）：\n' + rest.join('\n') + '\n';
      out += '每项一行，形如 `所在：骊珠洞天`（严禁英文 key）。成人向状态（情欲状态/亲密关系/事后余韵/双方意愿）按当前内容尺度如实上报：尺度允许时写清，不允许时填「无」，且绝不涉及未成年人。';
      /* v4.27.0 多值栏目：告诉模型这些字段可报多项，逐条列出。 */
      var multiLabels = [];
      gs.forEach(function (g) { g.fields.forEach(function (f) { if (fieldIsMulti(f)) multiLabels.push(f.label); }); });
      if (multiLabels.length) {
        out += '\n【多值栏目】' + multiLabels.join('、') + ' 可同时有多项：请逐项分行列出，形如 `魂环配置：第一魂环·百年曼陀罗蛇 / 第二魂环·千年大力猩猩`（用 / 分隔多项；只有一项就写一项，确实没有填「无」）。';
      }
      /* v4.27.0 填表规则分叉：严格演算 / 玩家自由两套行为准则，随模式注入。 */
      try { if (window.FillRule && window.FillRule.directive) out += window.FillRule.directive(); } catch (e) {}
      return out;
    },
    /** 自检用：当前启用字段数 */
    count: function () {
      return activeGroups().reduce(function (s, g) { return s + g.fields.length; }, 0);
    }
  };

  /* 安装：等 StoryStatusRenderer 就位（脚本顺序 / 懒加载都可能晚） */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (mount() || tries > 40) clearInterval(timer);
  }, 150);

  window.StatusSchema = StatusSchema;
})();
