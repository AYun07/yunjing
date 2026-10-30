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
  function customFields() {
    var v = jget(K_CUSTOM, []);
    return Array.isArray(v) ? v.filter(function (f) { return f && f.k && f.label; }) : [];
  }
  function setCustom(list) { jset(K_CUSTOM, list); }

  /** 当前生效的组（含成人组门禁与自定义组） */
  function activeGroups() {
    var out = GROUPS.filter(function (g) {
      if (isOff(g.id)) return false;
      if (g.adult && !(adultOn() && adultConfirmed())) return false;
      return true;
    }).map(function (g) { return { id: g.id, name: g.name, icon: g.icon, tip: g.tip, adult: !!g.adult, fields: g.fields.slice() }; });
    var cs = customFields();
    if (cs.length) {
      out.push({
        id: 'custom', name: '自定义', icon: '🧩', fields: cs.map(function (f) {
          return { k: f.k, label: f.label, keys: [f.k], custom: true };
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

  /** 从 variables / 主角角色卡 / 平铺「主角.字段」三处取值 */
  function readField(f) {
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
      v[key] = value;
      var pn = playerName();
      if (pn) {
        if (!v.characters || typeof v.characters !== 'object') v.characters = {};
        if (!v.characters[pn]) v.characters[pn] = {};
        v.characters[pn][key] = value;
        v[pn + '.' + key] = value;
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
        /* 成人向字段组：用户已通过成年确认并开启，就常驻显示（空则显示「—」）。
           否则模型不主动上报时整组会被折叠掉，状态栏里根本看不到 NSFW 字段。 */
        if (!val && !(g.adult && adultOn() && adultConfirmed()) && localStorage.getItem(K_SHOWEMPTY) !== '1') return '';
        return '<div class="yj-st-row" data-fk="' + esc(f.k) + '">' +
          '<span class="yj-st-k">' + esc(f.label) + '</span>' +
          '<span class="yj-st-v' + (val ? '' : ' empty') + '" onclick="StatusSchema.editField(\'' + esc(f.k) + '\')">' + esc(val || '—') + '</span>' +
          '</div>';
      }).join('');
      if (!rows) return '';
      return '<div class="yj-st-group' + (g.adult ? ' adult' : '') + '">' +
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
    var html = sectionHTML(gs);
    var flags = [];
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

  var StatusSchema = {
    GROUPS: GROUPS,
    mount: mount,
    render: render,
    activeGroups: activeGroups,
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
      var cur = readField(f);
      var nv = prompt('修改「' + f.label + '」（留空表示清空）：', cur);
      if (nv == null) return;
      if (writeField(f, nv)) { render(); if (window.showToast) window.showToast('已更新 ' + f.label, 'ok'); }
      else alert('写入失败：故事尚未初始化。');
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
        var others = g.fields.filter(function (f) { return CORE.indexOf(f.k) === -1; })
          .map(function (f) { return f.label + '(' + f.keys[0] + ')'; });
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
