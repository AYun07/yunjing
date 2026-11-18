/* 云境 · 行动判定骰 action-check.js（v4.29.0）
 * ---------------------------------------------------------------------------
 * 定位：与「灵感骰子」（掷名词/功法/机缘卡，服务创作）不同，本模块负责
 *       「行动成败判定」——玩家要做一件不一定成功的事（撬锁、说服、偷袭、
 *       突破瓶颈…），用「骰点 + 角色属性 + 资质 + 装备/技能修正 + 难度」算出
 *       成功程度，让剧情有可追溯的变数，而不是主笔 AI 随口决定。
 *
 * 两种裁定口径（沿用云境「填表规则」的双模式哲学）：
 *   · 演算裁定（对应严格演算）：前端确定性计算，骰点 + 属性加值 + 修正 − 难度，
 *     结果按区间给出「大成功…大失败」，可复核、可迁移到弱模型（不依赖 AI）。
 *   · 口述裁定（对应玩家自由）：本模块只产出「判定建议 + 完整依据」送到输入框，
 *     最终成败由主笔 AI 结合剧情裁定，玩家/AI 说了算。
 *
 * 数据全部留在本机：草稿写 localStorage，绝不外发。判定只读当前故事变量，
 * 不改任何状态数值（判定结果作为文字送进输入框，由主笔照常结算）。
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'yunjingActionCheckDraft';
  var HISTORY_KEY = 'yunjingActionCheckHistory';
  var HISTORY_MAX = 20;

  /* 难度档：target = 达标线（骰点+加值需 ≥ 它）；d20  theatrics */
  var DIFFICULTY = [
    { id: 'trivial', name: '轻而易举', target: 6,  desc: '寻常小事，失败也无害' },
    { id: 'easy',    name: '略有小成', target: 9,  desc: '稍加努力可成' },
    { id: 'normal',  name: '寻常难关', target: 12, desc: '五五开，需认真对待' },
    { id: 'hard',    name: '棘手硬关', target: 15, desc: '占优才稳，莽撞必败' },
    { id: 'extreme', name: '几乎不可能', target: 18, desc: '除非天赋异禀或有奇物相助' }
  ];

  /* 结果档：margin = 总分 − 达标线 */
  var GRADES = [
    { min: 8,  key: 'critical', name: '大成功', ico: '🌟', hint: '远超预期，额外利好' },
    { min: 3,  key: 'great',    name: '显著成功', ico: '✅', hint: '漂亮达成，略有余裕' },
    { min: 0,  key: 'success',  name: '成功', ico: '✔️', hint: '堪堪达成目标' },
    { min: -3, key: 'fail',     name: '失利', ico: '⚠️', hint: '差之毫厘，需付代价或再试' },
    { min: -99,key: 'criticalfail', name: '大失败', ico: '💥', hint: '事与愿违，可能引出更糟局面' }
  ];

  /* 资质 → 加值 */
  function aptitudeBonus(tier) {
    return ({ '顶级': 4, '稀有': 3, '中平': 2, '低劣': 0 })[tier] || 2;
  }

  /* T05 · 世界自适应轴表：优先用 WorldRules 当前世界的专属维度，
   * 退回 AttributeEngine.axisOf（其本身也读 WorldRules），最后退回通用六轴。
   * 这样 38 界检定用的都是本世界的维度名（斗罗魂力/修仙神识/克苏鲁理智…）。 */
  var AX_FALLBACK = [
    { id: 'body', name: '肉身', kw: ['力量','体魄','体质','气血','肉身','根骨','strength','body','体'] },
    { id: 'sense', name: '感知', kw: ['神识','感知','精神','灵觉','直觉','眼力','sense','perception'] },
    { id: 'mind', name: '心志', kw: ['心性','意志','道心','坚韧','will','毅'] },
    { id: 'wit', name: '谋算', kw: ['谋略','智计','智慧','智力','心机','wit','intellect','谋'] },
    { id: 'learn', name: '修学', kw: ['资质','悟性','修炼','学习','灵根','root','aptitude','悟'] },
    { id: 'luck', name: '机缘', kw: ['气运','运道','幸运','机缘','fortune','luck','魅力','缘'] }
  ];
  function axisTable() {
    try {
      var WR = window.WorldRules;
      if (WR && typeof WR.currentAxes === 'function') {
        var ax = WR.currentAxes();
        if (ax && ax.length) return ax.map(function (a) {
          return { id: a.id, name: a.name, kw: (a.kw || []).concat([a.name]) };
        });
      }
    } catch (e) { }
    return AX_FALLBACK;
  }

  /* 从当前故事变量里抽属性，映射到当前世界的轴表，算每轴加值（0~6 的温和封顶） */
  function readAxes() {
    var stats = {};
    try {
      var st = window.storyFramework && window.storyFramework.storyState;
      stats = (st && st.variables && st.variables.stats) || {};
    } catch (e) { }
    var axes = [];
    var AX_IDS = axisTable();
    Object.keys(stats).forEach(function (k) {
      var v = stats[k];
      if (typeof v !== 'number') return;
      var label = k;
      /* 优先用属性引擎的世界自适应归类（它读 WorldRules）；失败再用本地关键词表 */
      var hit = null;
      try {
        var AE = window.AttributeEngine;
        if (AE && typeof AE.axisOf === 'function') {
          var ax = AE.axisOf(k, k);
          if (ax) hit = { id: ax.id, name: ax.name };
        }
      } catch (e) { }
      if (!hit) {
        for (var i = 0; i < AX_IDS.length && !hit; i++) {
          var a = AX_IDS[i];
          for (var j = 0; j < a.kw.length; j++) {
            if (String(k).indexOf(a.kw[j]) >= 0 || String(label).indexOf(a.kw[j]) >= 0) { hit = a; break; }
          }
        }
      }
      if (!hit) return;
      var ex = axes.filter(function (x) { return x.id === hit.id; })[0];
      if (!ex) { ex = { id: hit.id, name: hit.name, score: 0, keys: [] }; axes.push(ex); }
      ex.score += v;
      ex.keys.push(k + ' ' + v);
    });
    axes.forEach(function (a) { a.bonus = Math.max(0, Math.min(6, Math.round(a.score / 10))); });
    return axes.sort(function (x, y) { return y.score - x.score; });
  }

  function readAptitude() {
    try {
      var st = window.storyFramework && window.storyFramework.storyState;
      var setup = (st && st.variables && st.variables.setup) || {};
      var AE = window.AttributeEngine;
      var tier = AE && AE.classifyAptitude ? AE.classifyAptitude(setup) : '';
      return { tier: tier || '中平', text: String(setup.aptitude || setup.customAptitude || '') };
    } catch (e) { return { tier: '中平', text: '' }; }
  }

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveDraft(d) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { }
  }
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (e) { return []; }
  }
  function pushHistory(rec) {
    var h = loadHistory();
    h.unshift(rec);
    h = h.slice(0, HISTORY_MAX);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) { }
  }

  /* 核心判定：d20 骰点由调用方传入（演算用真随机，口述可给固定 10 作参考线） */
  function resolve(opts) {
    opts = opts || {};
    var die = Number(opts.die);
    if (!isFinite(die) || die < 1) die = 1 + Math.floor(Math.random() * 20);
    die = Math.max(1, Math.min(20, die));
    var diff = DIFFICULTY.filter(function (d) { return d.id === opts.difficulty; })[0] || DIFFICULTY[2];
    var axes = readAxes();
    var axis = axes.filter(function (a) { return a.id === opts.axis; })[0] || axes[0];
    var axisBonus = axis ? axis.bonus : 0;
    var apt = readAptitude();
    var aptBonus = aptitudeBonus(apt.tier);
    var gear = Math.max(-5, Math.min(5, Number(opts.gear) || 0));   // 装备/技能修正 −5~+5
    var total = die + axisBonus + aptBonus + gear;
    var margin = total - diff.target;
    var grade = GRADES.filter(function (g) { return margin >= g.min; })[0] || GRADES[GRADES.length - 1];
    var nat20 = die === 20, nat1 = die === 1;
    if (nat20 && grade.key !== 'critical') grade = GRADES[0];      // 天然 20 保底大成功
    if (nat1 && grade.key !== 'criticalfail') grade = GRADES[GRADES.length - 1]; // 天然 1 保底大失败
    /* T05 · 判定即入账本（成功/失败都留痕）：写进 v.statLog，字段含
       目标 act / DC diff.target / 结果 grade.name / 依据 basis / 时间 t。
       用 recordStatLog 复用引擎的滚动上限与持久化，type='check'，stat 记成「检定·行动」。 */
    var basis = 'd20=' + die + '，' + (axis ? axis.name : '专精') + '+' + axisBonus
      + '，资质' + apt.tier + '+' + aptBonus + '，修正' + (gear >= 0 ? '+' : '') + gear
      + ' = ' + total + '，DC' + diff.target + '（' + (margin >= 0 ? '+' : '') + margin + '）';
    try {
      var v = (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (v) {
        /* 直接 push 一条结构化 check 记录；recordStatLog 的签名装不下 DC/依据，
           故走同一 v.statLog 结构手写一条，保持字段对齐 + 80 条滚动。 */
        v.statLog = (v.statLog && Array.isArray(v.statLog)) ? v.statLog : [];
        v.statLog.push({
          t: Date.now(), chapter: Number(v.chapter) || 0,
          stat: '检定·' + String(opts.act || '未命名').slice(0, 14),
          delta: margin, value: total, type: 'check',
          reason: '目标=' + String(opts.act || '').slice(0, 24)
            + '｜DC=' + diff.target + '｜结果=' + grade.name + '｜依据=' + basis
        });
        if (v.statLog.length > 80) v.statLog = v.statLog.slice(-80);
      }
    } catch (e) { }
    return {
      act: String(opts.act || ' unspecified action').trim(),
      die: die, axis: axis || null, axes: axes,
      axisBonus: axisBonus, aptitude: apt, aptBonus: aptBonus, gear: gear,
      difficulty: diff, total: total, margin: margin, grade: grade,
      nat20: nat20, nat1: nat1,
      mode: opts.mode || 'calc',
      checkRecord: { t: Date.now(), target: String(opts.act || ''), dc: diff.target, result: grade.name, basis: basis }
    };
  }

  /* 生成送进输入框的文字：两种口径给出不同措辞 */
  function compose(r) {
    var basis = '骰点 d20=' + r.die + '（天然' + (r.nat20 ? '20' : r.nat1 ? '1' : String(r.die)) + '）'
      + ' + ' + (r.axis ? r.axis.name : '专精') + '加值' + r.axisBonus
      + ' + 资质「' + r.aptitude.tier + '」' + r.aptBonus
      + ' + 装备/技能修正' + (r.gear >= 0 ? '+' : '') + r.gear
      + ' = ' + r.total + '，对照难度「' + r.difficulty.name + '」达标线 ' + r.difficulty.target
      + '（差值 ' + (r.margin >= 0 ? '+' : '') + r.margin + '）。';
    if (r.mode === 'free') {
      return '【行动判定·口述裁定参考】行动：' + r.act + '\n' +
        '参考结果倾向：' + r.grade.ico + r.grade.name + '（' + r.grade.hint + '）。\n' +
        '演算依据：' + basis + '\n' +
        '（口述裁定：以上仅为参考，最终成败请主笔按剧情与玩家意愿裁定；若与本段情节冲突，以剧情为准。）';
    }
    return '【行动判定·演算裁定】行动：' + r.act + '\n' +
      '判定结果：' + r.grade.ico + r.grade.name + '——' + r.grade.hint + '\n' +
      '演算依据：' + basis + '\n' +
      '（请主笔严格按此结果续写：' + r.grade.name + '对应的后果与代价须如实呈现，不得随意改成其他结果。）';
  }

  function toInput() {
    var text = window.__acLast ? compose(window.__acLast) : '';
    if (!text) return;
    var el = document.getElementById('userInput');
    if (!el) return;
    el.value = (el.value ? el.value + '\n' : '') + text;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }
    el.focus();
  }

  function open() {
    var old = document.getElementById('actionCheckPanel');
    if (old) old.remove();
    var draft = loadDraft();
    var axes = readAxes();
    var apt = readAptitude();
    var mode = (window.FillRule && window.FillRule.isFree()) ? 'free' : 'calc';
    var w = document.createElement('div');
    w.id = 'actionCheckPanel';
    w.innerHTML =
      '<div class="ac-overlay" onclick="if(event.target===this)ActionCheck.close()">' +
        '<div class="ac-modal">' +
          '<div class="ac-top"><b>🎯 行动判定骰</b><span class="ac-sub">骰点 + 六轴属性 + 资质 + 难度 · ' +
            (mode === 'free' ? '口述裁定' : '演算裁定') + '</span>' +
            '<button class="ac-x" onclick="ActionCheck.close()">✕</button></div>' +
          '<div class="ac-body">' +
            '<label class="ac-lab">要做的行动</label>' +
            '<input id="acAct" class="ac-input" placeholder="例：撬开这把古锁 / 说服城主出兵" value="' +
              String(draft.act || '').replace(/"/g, '&quot;') + '">' +
            '<div class="ac-grid">' +
              '<div><label class="ac-lab">依凭属性</label><select id="acAxis" class="ac-sel">' +
                axes.map(function (a) { return '<option value="' + a.id + '"' + (draft.axis === a.id ? ' selected' : '') + '>' + a.name + ' +' + a.bonus + '（' + a.keys.join('/') + '）</option>'; }).join('') +
                (axes.length ? '' : '<option value="">未读到属性（仍可掷骰）</option>') +
              '</select></div>' +
              '<div><label class="ac-lab">难度</label><select id="acDiff" class="ac-sel">' +
                DIFFICULTY.map(function (d) { return '<option value="' + d.id + '"' + ((draft.difficulty || 'normal') === d.id ? ' selected' : '') + '>' + d.name + '（线' + d.target + '）</option>'; }).join('') +
              '</select></div>' +
            '</div>' +
            '<label class="ac-lab">装备 / 技能修正（−5 ~ +5）</label>' +
            '<input id="acGear" class="ac-input" type="number" min="-5" max="5" value="' + (draft.gear || 0) + '">' +
            '<div class="ac-mode">' +
              '<label><input type="radio" name="acMode" value="calc"' + (mode === 'calc' ? ' checked' : '') + '> 演算裁定（前端确定性，弱模型也稳）</label>' +
              '<label><input type="radio" name="acMode" value="free"' + (mode === 'free' ? ' checked' : '') + '> 口述裁定（只给参考，剧情/玩家说了算）</label>' +
            '</div>' +
            '<div class="ac-acts">' +
              '<button class="ac-btn main" onclick="ActionCheck.rollUI()">🎲 掷骰判定</button>' +
              '<button class="ac-btn" onclick="ActionCheck.sendToInput()">✍️ 送到输入框</button>' +
            '</div>' +
            '<div id="acResult" class="ac-result"></div>' +
            '<div class="ac-sec">判定留痕（最近 ' + HISTORY_MAX + ' 条）<button class="ac-mini" onclick="ActionCheck.clearHistory()">清空</button></div>' +
            '<div id="acHistory"></div>' +
            '<div class="ac-note">草稿自动保留，关页再开仍在。判定只读当前属性、不改状态数值；结果以文字送入输入框，由主笔照常结算。</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(w);
    _style();
    _renderHistory();
  }

  function close() {
    var el = document.getElementById('actionCheckPanel');
    if (el) el.remove();
  }

  function rollUI() {
    var act = (document.getElementById('acAct') || {}).value || '';
    var axis = (document.getElementById('acAxis') || {}).value || '';
    var diff = (document.getElementById('acDiff') || {}).value || 'normal';
    var gear = (document.getElementById('acGear') || {}).value || 0;
    var modeSel = document.querySelector('input[name="acMode"]:checked');
    var mode = modeSel ? modeSel.value : 'calc';
    saveDraft({ act: act, axis: axis, difficulty: diff, gear: gear });
    var r = resolve({ act: act, axis: axis, difficulty: diff, gear: gear, mode: mode });
    window.__acLast = r;
    pushHistory({ t: Date.now(), act: r.act, die: r.die, diff: r.difficulty.name, grade: r.grade.name, total: r.total, mode: mode });
    var box = document.getElementById('acResult');
    if (box) {
      box.innerHTML = '<div class="ac-grade ' + r.grade.key + '">' + r.grade.ico + ' ' + r.grade.name + '</div>' +
        '<div class="ac-hint">' + r.grade.hint + '</div>' +
        '<div class="ac-detail">d20=' + r.die + ' · ' + (r.axis ? r.axis.name : '专精') + '+' + r.axisBonus +
        ' · 资质' + r.aptitude.tier + '+' + r.aptBonus + ' · 修正' + (r.gear >= 0 ? '+' : '') + r.gear +
        ' = <b>' + r.total + '</b> ／ 达标线 ' + r.difficulty.target + '（' + (r.margin >= 0 ? '+' : '') + r.margin + '）</div>';
    }
    _renderHistory();
  }

  function _renderHistory() {
    var box = document.getElementById('acHistory');
    if (!box) return;
    var h = loadHistory();
    if (!h.length) { box.innerHTML = '<div class="ac-empty">尚无判定记录</div>'; return; }
    box.innerHTML = h.map(function (x) {
      var d = new Date(x.t);
      var ts = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return '<div class="ac-hitem"><span>' + ts + '</span> ' + String(x.act).slice(0, 22) + ' · ' + x.grade + '（' + x.total + '）</div>';
    }).join('');
  }
  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) { }
    _renderHistory();
  }

  function _style() {
    if (document.getElementById('acStyle')) return;
    var st = document.createElement('style');
    st.id = 'acStyle';
    st.textContent =
      '.ac-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9994;display:flex;align-items:center;justify-content:center;padding:18px}' +
      '.ac-modal{width:min(560px,94vw);max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#1b2029,#12161c);border:1px solid #6a9fb055;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:acIn .3s ease both}' +
      '@keyframes acIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
      '.ac-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #6a9fb025}' +
      '.ac-top b{color:#dcebf5;font-size:15px;letter-spacing:1px}.ac-sub{font-size:11px;color:#8fa6b5;margin-right:auto}.ac-x{background:none;border:none;color:#8fa6b5;font-size:16px;cursor:pointer;padding:4px 8px}' +
      '.ac-body{padding:16px 18px;overflow:auto}.ac-lab{display:block;font-size:12px;color:#9fb6c4;margin:10px 0 5px}' +
      '.ac-input,.ac-sel{width:100%;box-sizing:border-box;background:#0e1319;border:1px solid #6a9fb038;color:#dcebf5;border-radius:8px;padding:9px 11px;font-size:13px;outline:none}' +
      '.ac-input:focus,.ac-sel:focus{border-color:#6a9fb0aa}.ac-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.ac-mode{margin:14px 0 6px;font-size:12px;color:#b9cbd6;display:flex;flex-direction:column;gap:6px}.ac-mode label{cursor:pointer}' +
      '.ac-acts{display:flex;gap:10px;margin:14px 0}.ac-btn{flex:1;background:#1d2a33;border:1px solid #6a9fb044;color:#dcebf5;border-radius:9px;padding:10px;cursor:pointer;font-size:13px}.ac-btn.main{background:linear-gradient(135deg,#2b6a78,#1d4d58);border-color:#5fc0d0aa}.ac-btn:hover{filter:brightness(1.12)}' +
      '.ac-result{background:#0e1319;border:1px solid #6a9fb025;border-radius:10px;padding:14px;text-align:center;min-height:70px}.ac-grade{font-size:24px;font-weight:700;color:#eaf4fa}.ac-grade.critical,.ac-grade.great{color:#7fe0a8}.ac-grade.fail,.ac-grade.criticalfail{color:#ff8e8e}.ac-hint{font-size:12px;color:#9fb6c4;margin:4px 0 8px}.ac-detail{font-size:11px;color:#b9cbd6;line-height:1.7}' +
      '.ac-sec{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#8fa6b5;margin:16px 0 6px}.ac-mini{background:none;border:1px solid #6a9fb033;color:#8fa6b5;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px}' +
      '.ac-hitem{font-size:11px;color:#9fb6c4;padding:5px 8px;border-bottom:1px solid #6a9fb015}.ac-hitem span{color:#5f7787;margin-right:6px}.ac-empty{font-size:11px;color:#5f7787;padding:8px}.ac-note{font-size:11px;color:#6f8796;line-height:1.6;margin-top:12px}';
    document.head.appendChild(st);
  }

  window.ActionCheck = {
    DIFFICULTY: DIFFICULTY, GRADES: GRADES,
    resolve: resolve, compose: compose,
    open: open, close: close, rollUI: rollUI,
    sendToInput: toInput, clearHistory: clearHistory,
    loadDraft: loadDraft, loadHistory: loadHistory
  };
})();
