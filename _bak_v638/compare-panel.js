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
        (rule.numericNote ? '<div class="cp-note">原著口径：' + esc(rule.numericNote) + '</div>' : '') +
        (rule.peaks.length ? '<div class="cp-note">★ 极境/特殊节点（仅这些计极境倍率，不得自拟）：' + esc(rule.peaks.join('、')) + '</div>' : '');
    } else {
      ladderHtml = '<div class="cp-note">本世界无原著境界阶梯（创作/现实/竞技类），数值仅按属性钳制规则处理。</div>';
    }
    function opts(table) {
      var out = '';
      var keys = ['凡俗', '天才', '顶级天骄', '绝世妖孽', '普通', '稀有', '顶级', '神级'];
      keys.forEach(function (k) { out += '<option value="' + k + '">' + k + '</option>'; });
      return out;
    }
    return '' +
      '<div id="cp-cmp-hd"><h3>⚔ 境界数值比对 · ' + esc(worldName) + '</h3>' +
      '<span class="cp-sub">原著设定钉死 · 例外走数值比对</span>' +
      '<button id="cp-cmp-close" title="关闭">✕</button></div>' +
      '<div class="cp-cmp-tabs">' +
      '<button class="cp-cmp-tab on" data-tab="ladder">① 本世界阶梯</button>' +
      '<button class="cp-cmp-tab" data-tab="cross">② 跨境界对敌</button>' +
      '<button class="cp-cmp-tab" data-tab="custom">③ 自创体系对标</button>' +
      '</div>' +
      '<div class="cp-cmp-body">' +
      '<div class="cp-cmp-sec on" data-sec="ladder">' + ladderHtml + '</div>' +

      '<div class="cp-cmp-sec" data-sec="cross">' +
      '<div class="cp-note">顶级天骄可跨境界对敌——按「能级差 + 天骄系数 + 武魂/血脉/体质 + 极境」算出可越几阶与代价，正文须交代缘由。原著无依据不自拟。</div>' +
      '<div class="cp-grade-row"><label>挑战方境界</label><select id="cx-from">' + tierOpts(rule) + '</select></div>' +
      '<div class="cp-grade-row"><label>对手境界</label><select id="cx-to">' + tierOpts(rule) + '</select></div>' +
      '<div class="cp-grade-row"><label>天骄资质</label><select id="cx-tj">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label>武魂/功法</label><select id="cx-ms">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label>血脉</label><select id="cx-bl">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label>体质</label><select id="cx-ph">' + opts() + '</select></div>' +
      '<div class="cp-grade-row"><label>极境</label><select id="cx-pk"><option value="false">否</option><option value="true">处于原著明示极境</option></select></div>' +
      '<div class="cp-grade-row"><label>越境缘由</label><input id="cx-nar" placeholder="如：双生武魂+燃烧魂骨强行越级"></div>' +
      '<button class="cp-btn" id="cx-go">开始比对</button>' +
      '<div class="cp-rep" id="cx-out" style="display:none"></div>' +
      '</div>' +

      '<div class="cp-cmp-sec" data-sec="custom">' +
      '<div class="cp-note">玩家自创的境界体系按序号线性映射到本世界原著能级，生成「对标XX境」对照表；若你的设定有特殊节奏（前慢后快等），以你的设定为准并在正文标注偏差。</div>' +
      '<div class="cp-grade-row"><label>自创境界名</label><input id="cu-names" placeholder="用逗号分隔，低→高，如：初觉,凝魂,御魂,魂君主,魂天极" style="width:100%;max-width:none"></div>' +
      '<button class="cp-btn" id="cu-go">生成对标表</button>' +
      '<div class="cp-rep" id="cu-out" style="display:none"></div>' +
      '</div>' +
      '</div>';
  }

  function tierOpts(rule) {
    if (!rule || rule.realmMode !== 'ladder') return '<option value="">无境界阶梯</option>';
    return rule.tiers.map(function (t) { return '<option value="' + esc(t.name) + '">' + esc(t.name) + '（' + t.energy + '）</option>'; }).join('');
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
    var cxGo = ov.querySelector('#cx-go');
    if (cxGo) cxGo.onclick = function () {
      if (!window.CompareEngine) return;
      var rep = window.CompareEngine.crossRealm(g,
        ov.querySelector('#cx-from').value, ov.querySelector('#cx-to').value, {
          tianjiao: ov.querySelector('#cx-tj').value,
          martialSoul: ov.querySelector('#cx-ms').value,
          bloodline: ov.querySelector('#cx-bl').value,
          physique: ov.querySelector('#cx-ph').value,
          peak: ov.querySelector('#cx-pk').value === 'true',
          narrative: ov.querySelector('#cx-nar').value
        });
      var out = ov.querySelector('#cx-out');
      out.style.display = 'block';
      out.className = 'cp-rep' + (rep.allowed === false ? ' bad' : (rep.crossCap > (rep.worldCap || 0) ? ' warn' : ''));
      out.textContent = window.CompareEngine.reportText(rep) +
        (rep.factors && rep.factors.length ? '\n\n加成明细：' + rep.factors.map(function (f) { return f.k + ' +' + f.v + ' 档'; }).join('；') : '') +
        (rep.numericNote ? '\n原著口径：' + rep.numericNote : '');
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
