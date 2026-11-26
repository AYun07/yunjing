/* 云境 · 境界数值比对面板 ComparePanel v1.0.0（v6.3.7）
 * 玩家可见的三块功能（全部基于 CompareEngine，纯查询不改存档）：
 *   ① 本世界原著境界阶梯（tiers + 极境 + 能级）
 *   ② 跨境界对敌比对（天骄/武魂/血脉/体质/极境/自创加成 → 结构化报告）
 *   ③ 玩家自创境界体系对标（输入自定义境界名 → 原著能级对照表）
 * 依赖：CompareEngine / RealmRules；浮层样式内联，零侵入。
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  function genre() {
    try {
      return (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey)
        || new URLSearchParams(location.search).get('genre') || 'free';
    } catch (e) { return 'free'; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function injectStyle() {
    if (document.getElementById('cp-cmp-style')) return;
    var css = [
      '#cp-cmp-ov{position:fixed;inset:0;z-index:99998;background:rgba(6,9,14,.82);display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}',
      '#cp-cmp-ov.on{display:flex}',
      '#cp-cmp-box{width:min(860px,96vw);max-height:88vh;overflow:auto;background:linear-gradient(160deg,#171d29,#10151e);border:1px solid #2b3648;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.6);color:#e7ecf3}',
      '#cp-cmp-hd{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #263043;position:sticky;top:0;background:#151b26;z-index:2}',
      '#cp-cmp-hd h3{margin:0;font-size:16px;flex:1}',
      '#cp-cmp-hd .cp-sub{color:#8fa0b8;font-size:12px}',
      '#cp-cmp-close{cursor:pointer;background:#222c3b;border:1px solid #36445a;color:#c8d4e4;border-radius:8px;padding:5px 12px;font-size:14px}',
      '#cp-cmp-close:hover{background:#2e3b4f}',
      '.cp-cmp-tabs{display:flex;gap:8px;padding:14px 20px 0;flex-wrap:wrap}',
      '.cp-cmp-tab{cursor:pointer;background:#1b2432;border:1px solid #2b3648;color:#93a4bb;border-radius:8px;padding:7px 14px;font-size:13px}',
      '.cp-cmp-tab.on{background:#23405e;color:#8fd0ff;border-color:#3d6b96}',
      '.cp-cmp-body{padding:16px 20px 24px}',
      '.cp-cmp-sec{display:none}.cp-cmp-sec.on{display:block}',
      '.cp-grade-row{margin:10px 0;font-size:12px;color:#aeb9c9}',
      '.cp-grade-row label{display:inline-block;min-width:96px;color:#8fa0b8}',
      '.cp-grade-row select,.cp-grade-row input{background:#0f151e;border:1px solid #2b3648;color:#e7ecf3;border-radius:6px;padding:5px 9px;font-size:12px;max-width:220px}',
      '#cx-sys-from,#cx-sys-to{max-width:330px}',
      '.cp-btn{cursor:pointer;background:linear-gradient(135deg,#2b6cb0,#22558c);border:1px solid #3d7fc4;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px;margin-top:10px}',
      '.cp-btn:hover{filter:brightness(1.12)}',
      '.cp-ladder{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}',
      '.cp-ladder span{background:#1c2635;border:1px solid #2e3c50;border-radius:20px;padding:4px 11px;font-size:12px;color:#c8d6e8}',
      '.cp-ladder span.peak{background:#3a2e18;border-color:#7a5a26;color:#ffcf7c}',
      '.cp-ladder em{color:#6f8098;font-style:normal;font-size:10px;margin-left:4px}',
      '.cp-rep{margin-top:14px;background:#111a26;border:1px solid #2a3a52;border-left:3px solid #4d9de0;border-radius:8px;padding:13px 15px;font-size:12.5px;line-height:1.75;color:#cfdbe9;white-space:pre-wrap}',
      '.cp-rep.warn{border-left-color:#e0a24d}',
      '.cp-rep.bad{border-left-color:#e05d5d}',
      '.cp-note{color:#7f8ea4;font-size:11.5px;margin:8px 0}',
      '.cp-subsys-hd{font-size:13px;color:#8fd0ff;margin:18px 0 6px;font-weight:600;border-top:1px solid #263043;padding-top:14px}',
      '.cp-subsys{background:#131c28;border:1px solid #26364b;border-radius:10px;padding:10px 13px;margin:9px 0}',
      '.cp-subsys-name{font-size:12.5px;color:#e7c98a;font-weight:600;margin-bottom:5px}',
      '.cp-ladder-sm span{font-size:11px;padding:3px 8px}',
      '.cp-worldnote{border-left:3px solid #4d9de0;padding-left:10px;color:#9fb0c6;line-height:1.7}',
      '.cp-cmp-title{font-size:13px;color:#8fd0ff;margin:16px 0 4px;font-weight:600}',
      '#cp-custom-out{width:100%;min-height:120px;background:#0f151e;border:1px solid #2b3648;color:#cfe0f2;border-radius:8px;padding:10px;font-size:12px;margin-top:10px}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'cp-cmp-style'; st.textContent = css; document.head.appendChild(st);
  }

  function html() {
    var g = genre();
    var R = window.RealmRules, C = window.CompareEngine;
    var rule = R ? R.getByGenre(g) : null;
    var worldName = rule ? rule.name : g;
    var ladderHtml = '';
    if (rule && rule.realmMode === 'ladder') {
      ladderHtml = '<div class="cp-ladder">' + rule.tiers.map(function (t) {
        return '<span' + (t.peak ? ' class="peak"' : '') + '>' + esc(t.name) + '<em>' + t.energy + '</em></span>';
      }).join(' → ') + '</div>' +
        (rule.numericNote ? '<div class="cp-note">主阶梯原著口径：' + esc(rule.numericNote) + '</div>' : '') +
        (rule.peaks.length ? '<div class="cp-note">★ 极境/特殊节点（仅这些计极境倍率，不得自拟）：' + esc(rule.peaks.join('、')) + '</div>' : '');
    } else {
      ladderHtml = '<div class="cp-note">本世界无原著境界阶梯（创作/现实/竞技类），数值仅按属性钳制规则处理。</div>';
    }
    /* v6.3.8 分部体系 + 世界设定口径：斗罗四部 / 超神多路径 / 星空副轴，明示不可混用 */
    var subs = (rule && rule.subSystems) ? rule.subSystems : [];
    if (subs.length) {
      ladderHtml += '<div class="cp-subsys-hd">原著分部体系（' + subs.length + ' 套并行·序号不可跨体系互比）</div>';
      subs.forEach(function (ss, i) {
        ladderHtml += '<div class="cp-subsys">' +
          '<div class="cp-subsys-name">' + (i + 1) + '. ' + esc(ss.name) + '</div>' +
          '<div class="cp-ladder cp-ladder-sm">' + ss.tiers.map(function (t) {
            return '<span>' + esc(t.name) + '<em>' + t.energy + '</em></span>';
          }).join(' → ') + '</div>' +
          '<div class="cp-note">' + esc(ss.note) + '</div>' +
          '</div>';
      });
    }
    /* v6.3.12 嵌套世界观：已知/未知宇宙、虚实层、蓝星/仙宫星空等，层间不可互比 */
    var nested = (rule && rule.nestedWorlds) ? rule.nestedWorlds : [];
    if (nested.length) {
      ladderHtml += '<div class="cp-subsys-hd">嵌套世界观层（' + nested.length + ' 层·层间战力不可按序号互比）</div>';
      nested.forEach(function (nw, i) {
        ladderHtml += '<div class="cp-subsys">' +
          '<div class="cp-subsys-name">' + (i + 1) + '. ' + esc(nw.name) + '</div>' +
          '<div class="cp-note">' + esc(nw.note) + '</div></div>';
      });
    }
    if (rule && rule.notes) ladderHtml += '<div class="cp-note cp-worldnote">本世界设定口径：' + esc(rule.notes) + '</div>';
    /* v6.3.13 跨层对敌：仅对含嵌套层的世界显示第 4 个 tab */
    var nestedNow = (rule && rule.nestedWorlds) ? rule.nestedWorlds : [];
    var hasLayer = nestedNow.length > 0;
    function opts(table) {
      var out = '';
      var keys = ['凡俗', '天才', '顶级天骄', '绝世妖孽', '普通', '稀有', '顶级', '神级'];
      keys.forEach(function (k) { out += '<option value="' + k + '">' + k + '</option>'; });
      return out;
    }
    var layerOptsHtml = layerOpts(rule);
    var layerFirstTiers = hasLayer ? layerTierOpts(rule, nestedNow[0].id) : '';
    var layerLastTiers = hasLayer ? layerTierOpts(rule, nestedNow[nestedNow.length - 1].id) : '';
    return '' +
      '<div id="cp-cmp-hd"><h3>⚔ 境界数值比对 · ' + esc(worldName) + '</h3>' +
      '<span class="cp-sub">原著设定钉死 · 例外走数值比对</span>' +
      '<button id="cp-cmp-close" title="关闭">✕</button></div>' +
      '<div class="cp-cmp-tabs">' +
      '<button class="cp-cmp-tab on" data-tab="ladder">① 本世界阶梯</button>' +
      '<button class="cp-cmp-tab" data-tab="cross">② 跨境界对敌</button>' +
      '<button class="cp-cmp-tab" data-tab="custom">③ 自创体系对标</button>' +
      (hasLayer ? '<button class="cp-cmp-tab" data-tab="layer">④ 跨层对敌</button>' : '') +
      '</div>' +
      '<div class="cp-cmp-body">' +
      '<div class="cp-cmp-sec on" data-sec="ladder">' + ladderHtml + '</div>' +

      '<div class="cp-cmp-sec" data-sec="cross">' +
      '<div class="cp-note">顶级天骄可跨境界对敌——按「能级差 + 天骄系数 + 武魂/血脉/体质 + 极境」算出可越几阶与代价，正文须交代缘由。原著无依据不自拟。</div>' +
      '<div class="cp-grade-row"><label for="cx-sys-from">挑战方体系</label><select id="cx-sys-from">' + sysOpts(rule) + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-from">挑战方境界</label><select id="cx-from">' + tierOpts(rule, 'main') + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-sys-to">对手体系</label><select id="cx-sys-to">' + sysOpts(rule) + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-to">对手境界</label><select id="cx-to">' + tierOpts(rule, 'main') + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-tj">天骄资质</label><select id="cx-tj">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-ms">武魂/功法</label><select id="cx-ms">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-bl">血脉</label><select id="cx-bl">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-ph">体质</label><select id="cx-ph">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="cx-pk">极境</label><select id="cx-pk"><option value="false">否</option><option value="true">处于原著明示极境</option></select></div>' +
      '<div class="cp-grade-row"><label for="cx-nar">越境缘由</label><input id="cx-nar" placeholder="如：双生武魂+燃烧魂骨强行越级"></div>' +
      '<button class="cp-btn" id="cx-go">开始比对</button>' +
      '<div class="cp-rep" id="cx-out" style="display:none"></div>' +
      '</div>' +

      '<div class="cp-cmp-sec" data-sec="custom">' +
      '<div class="cp-note">玩家自创的境界体系按序号线性映射到本世界原著能级，生成「对标XX境」对照表；若你的设定有特殊节奏（前慢后快等），以你的设定为准并在正文标注偏差。</div>' +
      '<div class="cp-grade-row"><label for="cu-names">自创境界名</label><input id="cu-names" placeholder="用逗号分隔，低→高，如：初觉,凝魂,御魂,魂君主,魂天极" style="width:100%;max-width:none"></div>' +
      '<button class="cp-btn" id="cu-go">生成对标表</button>' +
      '<div class="cp-rep" id="cu-out" style="display:none"></div>' +
      '</div>' +

      (hasLayer ? '<div class="cp-cmp-sec" data-sec="layer">' +
      '<div class="cp-note">嵌套世界各层共用一条主阶梯，层的差别是同一境界的战力倍率。跨层对敌须走折算：层位比=对手倍率÷我方倍率，层位差=round((层位比-1)×2) 档，叠加主阶梯档差为总需跨档；加成折算可跨档，代价按越档结算，正文必须交代跨层缘由。标注「估算」的倍率非原著明示，仅供校准。</div>' +
      '<div class="cp-grade-row"><label for="ly-from">我方层</label><select id="ly-from">' + layerOptsHtml + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-from-tier">我方境界</label><select id="ly-from-tier">' + layerFirstTiers + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-to">对手层</label><select id="ly-to">' + layerOptsHtml + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-to-tier">对手境界</label><select id="ly-to-tier">' + layerLastTiers + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-tj">天骄资质</label><select id="ly-tj">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-ms">武魂/功法</label><select id="ly-ms">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-bl">血脉</label><select id="ly-bl">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-ph">体质</label><select id="ly-ph">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label for="ly-pk">极境</label><select id="ly-pk"><option value="false">否</option><option value="true">处于原著明示极境</option></select></div>' +
      '<div class="cp-grade-row"><label for="ly-cb">额外加成</label><input id="ly-cb" type="number" value="0" placeholder="玩家特殊设计等效档数"></div>' +
      '<div class="cp-grade-row"><label for="ly-nar">跨层缘由</label><input id="ly-nar" style="width:100%;max-width:none" placeholder="如：虚空引擎跨界 / 坐忘道修假 / 宇宙海法则压制"></div>' +
      '<button class="cp-btn" id="ly-go">开始折算</button>' +
      '<div class="cp-rep" id="ly-out" style="display:none"></div>' +
      '</div>' : '') +
      '</div>';
  }

  function tierOpts(rule, sysId) {
    if (!rule || rule.realmMode !== 'ladder') return '<option value="">无境界阶梯</option>';
    var list = rule.tiers;
    if (sysId && sysId !== 'main') {
      var found = (rule.subSystems || []).filter(function (s) { return s.id === sysId; })[0];
      list = found ? found.tiers : [];
    }
    return list.map(function (t) { return '<option value="' + esc(t.name) + '">' + esc(t.name) + '（' + t.energy + '）</option>'; }).join('');
  }
  function layerOpts(rule) {
    var nested = (rule && rule.nestedWorlds) ? rule.nestedWorlds : [];
    return nested.map(function (l) {
      return '<option value="' + esc(l.id) + '">' + esc(l.name) + '（层位 ×' + (l.factor || 1) + '）</option>';
    }).join('');
  }
  function layerTierOpts(rule, layerId) {
    var nested = (rule && rule.nestedWorlds) ? rule.nestedWorlds : [];
    var l = nested.filter(function (x) { return x.id === layerId; })[0];
    if (!l || !rule) return '';
    var list;
    if (l.subSystemId) {
      var ss = (rule.subSystems || []).filter(function (x) { return x.id === l.subSystemId; })[0];
      list = ss ? ss.tiers : [];
    } else {
      list = rule.tiers;
    }
    return list.map(function (t) { return '<option value="' + esc(t.name) + '">' + esc(t.name) + '</option>'; }).join('');
  }
  function sysOpts(rule) {
    var out = '<option value="main">主阶梯' + (rule ? '（' + rule.tiers.length + ' 阶）' : '') + '</option>';
    if (rule && rule.subSystems) rule.subSystems.forEach(function (ss) {
      out += '<option value="' + esc(ss.id) + '">' + esc(ss.name) + '（' + ss.tiers.length + ' 阶）</option>';
    });
    return out;
  }

  function open() {
    injectStyle();
    var ov = document.getElementById('cp-cmp-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'cp-cmp-ov'; ov.className = 'cp-cmp-ov'; document.body.appendChild(ov); }
    ov.innerHTML = '<div id="cp-cmp-box">' + html() + '</div>';
    ov.classList.add('on');
    bind(ov);
  }
  function close() { var ov = document.getElementById('cp-cmp-ov'); if (ov) ov.classList.remove('on'); }

  function bind(ov) {
    ov.querySelector('#cp-cmp-close').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    ov.querySelectorAll('.cp-cmp-tab').forEach(function (tab) {
      tab.onclick = function () {
        ov.querySelectorAll('.cp-cmp-tab').forEach(function (t) { t.classList.remove('on'); });
        ov.querySelectorAll('.cp-cmp-sec').forEach(function (s) { s.classList.remove('on'); });
        tab.classList.add('on');
        ov.querySelector('.cp-cmp-sec[data-sec="' + tab.dataset.tab + '"]').classList.add('on');
      };
    });
    var g = genre();
    /* 切换体系时刷新该侧境界下拉，避免玩家选了副体系却用主阶梯境界名 */
    function bindSys(selSys, selTier) {
      var a = ov.querySelector(selSys), b = ov.querySelector(selTier);
      if (!a || !b) return;
      a.onchange = function () {
        var rule = window.RealmRules ? window.RealmRules.getByGenre(g) : null;
        b.innerHTML = tierOpts(rule, a.value);
      };
    }
    bindSys('#cx-sys-from', '#cx-from');
    bindSys('#cx-sys-to', '#cx-to');
    var cxGo = ov.querySelector('#cx-go');
    if (cxGo) cxGo.onclick = function () {
      if (!window.CompareEngine) return;
      var rep = window.CompareEngine.crossRealm(g,
        { systemId: ov.querySelector('#cx-sys-from').value, name: ov.querySelector('#cx-from').value },
        { systemId: ov.querySelector('#cx-sys-to').value, name: ov.querySelector('#cx-to').value }, {
          tianjiao: ov.querySelector('#cx-tj').value,
          martialSoul: ov.querySelector('#cx-ms').value,
          bloodline: ov.querySelector('#cx-bl').value,
          physique: ov.querySelector('#cx-ph').value,
          peak: ov.querySelector('#cx-pk').value === 'true',
          narrative: ov.querySelector('#cx-nar').value
        });
      var out = ov.querySelector('#cx-out');
      out.style.display = 'block';
      out.className = 'cp-rep' + (rep.allowed === false || rep.crossSystem || rep.ok === false ? ' bad' : (rep.crossCap > (rep.worldCap || 0) ? ' warn' : ''));
      out.textContent = window.CompareEngine.reportText(rep) +
        (rep.factors && rep.factors.length ? '\n\n加成明细：' + rep.factors.map(function (f) { return f.k + ' +' + f.v + ' 档'; }).join('；') : '') +
        (rep.numericNote ? '\n原著口径：' + rep.numericNote : '');
    };
    /* v6.3.13 跨层对敌：切换层时刷新该层境界下拉 */
    function bindLayer(selLayer, selTier) {
      var a = ov.querySelector(selLayer), b = ov.querySelector(selTier);
      if (!a || !b) return;
      a.onchange = function () {
        var rule = window.RealmRules ? window.RealmRules.getByGenre(g) : null;
        b.innerHTML = layerTierOpts(rule, a.value);
      };
    }
    bindLayer('#ly-from', '#ly-from-tier');
    bindLayer('#ly-to', '#ly-to-tier');
    var lyGo = ov.querySelector('#ly-go');
    if (lyGo) lyGo.onclick = function () {
      if (!window.CompareEngine) return;
      var rep = window.CompareEngine.crossLayer(g,
        { layer: ov.querySelector('#ly-from').value, tier: ov.querySelector('#ly-from-tier').value },
        { layer: ov.querySelector('#ly-to').value, tier: ov.querySelector('#ly-to-tier').value }, {
          tianjiao: ov.querySelector('#ly-tj').value,
          martialSoul: ov.querySelector('#ly-ms').value,
          bloodline: ov.querySelector('#ly-bl').value,
          physique: ov.querySelector('#ly-ph').value,
          peak: ov.querySelector('#ly-pk').value === 'true',
          customBonus: Number(ov.querySelector('#ly-cb').value) || 0,
          narrative: ov.querySelector('#ly-nar').value
        });
      var out = ov.querySelector('#ly-out');
      out.style.display = 'block';
      out.className = 'cp-rep' + (rep.allowed === false || rep.ok === false ? ' bad' : (rep.estimated ? ' warn' : ''));
      out.textContent = window.CompareEngine.reportText(rep) +
        (rep.formula ? '\n计算：' + rep.formula : '') +
        (rep.factors && rep.factors.length ? '\n加成明细：' + rep.factors.map(function (f) { return f.k + ' +' + f.v + ' 档'; }).join('；') : '') +
        (rep.estimateNote ? '\n\n' + rep.estimateNote : '');
    };
    var cuGo = ov.querySelector('#cu-go');
    if (cuGo) cuGo.onclick = function () {
      if (!window.CompareEngine) return;
      var raw = ov.querySelector('#cu-names').value || '';
      var names = raw.split(/[,，、\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var rep = window.CompareEngine.mapCustom(g, names);
      var out = ov.querySelector('#cu-out');
      out.style.display = 'block';
      out.className = 'cp-rep' + (rep.ok ? '' : ' warn');
      out.textContent = rep.ok
        ? rep.map.map(function (m) { return m.label; }).join('\n') + '\n\n' + rep.note
        : (rep.reason || '无法生成');
    };
  }

  window.ComparePanel = { VERSION: VERSION, open: open, close: close };
})();
