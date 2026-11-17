/* 云境 · 调用与消耗透明面板 v1.0.0（v4.19.0）
 *
 * 用户要求：「玩家在使用中会进行多少次调用以及消耗情况等等」要让玩家清楚知道。
 * 云境一局可能调用 6 个接口（主笔/世界推演/变量AI状态/插图/润色/手机分身），
 * 每次调用消耗 token、按厂商单价产生费用——但此前这些数据只有 TokenUsage 在后台记账，
 * 玩家看不到。本面板把「调用几次 / 各接口分别多少 / 多少 token / 大概花多少钱」摊开给玩家看。
 *
 * 数据来源：window.TokenUsage（只读），单价由玩家自填（各厂商价格常变，产品不硬编码，避免说假话）。
 * 纯展示，不改动任何记账逻辑。
 */
(function () {
  'use strict';

  var TAG_CN = {
    '主笔': '✍️ 主笔（正文）',
    '灵感': '💡 灵感（构思）',
    '变量AI': '📊 变量AI（状态）',
    '状态': '📊 状态登记',
    '世界': '🌍 世界推演',
    '推演': '🌍 世界推演',
    '插图': '🖼️ 插图',
    '润色': '✨ 润色',
    '手机': '📱 手机分身'
  };
  var RATE_KEY = 'yunjingTokenRates';
  var overlay = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (window.TokenUsage && TokenUsage.fmt) ? TokenUsage.fmt(n) : String(n || 0); }

  function modelName() {
    try {
      var fw = window.storyFramework || {};
      if (fw.apiConfig && fw.apiConfig.model) return fw.apiConfig.model;
      var raw = localStorage.getItem('storyApiConfig');
      if (raw) { var j = JSON.parse(raw); return (j && j.model) || '未命名'; }
    } catch (e) {}
    return '未配置';
  }
  function loadRates() {
    try { var r = JSON.parse(localStorage.getItem(RATE_KEY) || 'null'); if (r) return r; } catch (e) {}
    return { in: '', out: '' };
  }
  function saveRates(r) { try { localStorage.setItem(RATE_KEY, JSON.stringify(r)); } catch (e) {} }

  function build() {
    var st = (window.TokenUsage && TokenUsage.get) ? TokenUsage.get() : { last: null, byTag: {}, total: { inTok: 0, outTok: 0, requests: 0 } };
    var rates = loadRates();
    var cost = (window.TokenUsage && TokenUsage.estimateCost) ? TokenUsage.estimateCost({ in: rates.in, out: rates.out }) : { total: 0 };
    var byTag = st.byTag || {};
    var total = st.total || { inTok: 0, outTok: 0, requests: 0 };
    var tags = Object.keys(byTag);

    var rows = tags.length ? tags.map(function (t) {
      var a = byTag[t];
      return '<tr><td>' + esc(TAG_CN[t] || t) + '</td>'
        + '<td class="n">' + (a.requests || 0) + '</td>'
        + '<td class="n">' + fmt(a.inTok || 0) + '</td>'
        + '<td class="n">' + fmt(a.outTok || 0) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;opacity:.6;padding:18px;color:var(--text-muted,#a8a290)">还没有调用记录——开始一轮剧情后，这里会实时显示每个接口的调用与消耗</td></tr>';

    var hasRate = Number(rates.in) > 0 || Number(rates.out) > 0;

    return ''
      + '<div class="up-head">'
      + '  <div><div class="up-title">📊 调用与消耗</div><div class="up-sub">本局各接口调用次数与 token 用量，全程透明</div></div>'
      + '  <button class="up-x" title="关闭">✕</button>'
      + '</div>'
      + '<div class="up-body">'
      + '  <div class="up-cards">'
      + '    <div class="up-card"><div class="up-cv">' + (total.requests || 0) + '</div><div class="up-cl">总调用次数</div></div>'
      + '    <div class="up-card"><div class="up-cv">' + fmt(total.inTok + total.outTok) + '</div><div class="up-cl">总 Token</div></div>'
      + '    <div class="up-card"><div class="up-cv">' + fmt(total.inTok) + '</div><div class="up-cl">输入 Token</div></div>'
      + '    <div class="up-card"><div class="up-cv">' + fmt(total.outTok) + '</div><div class="up-cl">输出 Token</div></div>'
      + '  </div>'
      + '  <div class="up-model">当前模型：<b>' + esc(modelName()) + '</b> · 一局中云境可能调用多个接口协同（正文由主笔写，状态/推演/插图各司其职）</div>'
      + '  <div class="up-tbwrap"><table class="up-table">'
      + '    <thead><tr><th>接口</th><th>调用次数</th><th>输入</th><th>输出</th></tr></thead>'
      + '    <tbody>' + rows + '</tbody>'
      + '  </table></div>'
      + '  <div class="up-cost">'
      + '    <div class="up-cost-title">💰 花费估算</div>'
      + '    <div class="up-rate-row">'
      + '      <label>输入单价 <input class="up-rate" data-r="in" type="number" min="0" step="0.1" placeholder="元/百万token" value="' + esc(rates.in) + '"></label>'
      + '      <label>输出单价 <input class="up-rate" data-r="out" type="number" min="0" step="0.1" placeholder="元/百万token" value="' + esc(rates.out) + '"></label>'
      + '    </div>'
      + '    <div class="up-cost-val">' + (hasRate ? ('约 <b>¥' + cost.total.toFixed(4) + '</b>') : '填入你所用模型的单价，即可估算本局花费（各厂商价格不同，请以账单为准）') + '</div>'
      + '  </div>'
      + '  <div class="up-note">说明：Token 数为本地估算（中文约 1.6 字/token），实际以厂商账单为准；数据随存档保存，可在「工具箱 → 存档体检」清档时清零。</div>'
      + '  <div class="up-actions"><button class="up-reset" type="button">清空本次统计</button></div>'
      + '</div>';
  }

  function style() {
    if (document.getElementById('usagePanelStyle')) return;
    var s = document.createElement('style');
    s.id = 'usagePanelStyle';
    s.textContent = `
      #usageOverlay{position:fixed;inset:0;background:rgba(4,4,10,.6);backdrop-filter:blur(3px);z-index:9300;
        display:none;align-items:center;justify-content:center;padding:20px;}
      #usageOverlay.on{display:flex;}
      #usageBox{width:min(560px,96vw);max-height:88vh;overflow:auto;border-radius:16px;
        background:linear-gradient(160deg,var(--panel,#141a2a),color-mix(in srgb,var(--panel,#141a2a) 84%,#000));
        border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 34%,transparent);
        box-shadow:0 24px 70px rgba(0,0,0,.6);color:var(--text,#e8e4d8);font-family:inherit;}
      .up-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px 12px;
        border-bottom:1px solid color-mix(in srgb,var(--primary,#c9a86a) 20%,transparent);}
      .up-title{font-size:18px;font-weight:700;letter-spacing:1.5px;color:var(--primary,#c9a86a);}
      .up-sub{font-size:11px;color:var(--text-muted,#a8a290);margin-top:3px;letter-spacing:.4px;}
      .up-x{cursor:pointer;border:none;background:none;color:var(--text-muted,#a8a290);font-size:17px;padding:2px 6px;}
      .up-x:hover{color:var(--text);}
      .up-body{padding:16px 20px 20px;}
      .up-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
      .up-card{background:rgba(127,127,127,.07);border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 20%,transparent);
        border-radius:10px;padding:10px 6px;text-align:center;}
      .up-cv{font-size:19px;font-weight:700;color:var(--primary,#c9a86a);font-variant-numeric:tabular-nums;}
      .up-cl{font-size:10px;color:var(--text-muted,#a8a290);margin-top:3px;letter-spacing:.5px;}
      .up-model{font-size:11.5px;color:var(--text-muted,#a8a290);line-height:1.7;margin-bottom:12px;}
      .up-model b{color:var(--accent,#8ab0c8);}
      .up-tbwrap{border:1px solid var(--panel-border,rgba(200,170,110,.2));border-radius:10px;overflow:hidden;}
      .up-table{width:100%;border-collapse:collapse;font-size:12px;}
      .up-table th{background:rgba(127,127,127,.08);color:var(--text-muted,#a8a290);font-weight:500;
        padding:8px 10px;text-align:left;font-size:11px;letter-spacing:.5px;}
      .up-table td{padding:8px 10px;border-top:1px solid rgba(127,127,127,.1);}
      .up-table td.n,.up-table th:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums;}
      .up-cost{margin-top:14px;padding:12px 14px;border-radius:10px;
        background:linear-gradient(120deg,color-mix(in srgb,var(--primary,#c9a86a) 8%,transparent),transparent);
        border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 22%,transparent);}
      .up-cost-title{font-size:12px;color:var(--primary,#c9a86a);letter-spacing:1px;margin-bottom:9px;}
      .up-rate-row{display:flex;gap:10px;flex-wrap:wrap;}
      .up-rate-row label{font-size:11px;color:var(--text-muted,#a8a290);display:flex;align-items:center;gap:6px;flex:1;min-width:180px;}
      .up-rate{width:100%;min-width:0;background:rgba(0,0,0,.2);border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 28%,transparent);
        color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit;}
      .up-cost-val{margin-top:10px;font-size:13px;color:var(--text-muted,#a8a290);}
      .up-cost-val b{font-size:18px;color:#7fd6a8;}
      .up-note{font-size:10.5px;line-height:1.7;color:var(--text-muted,#a8a290);opacity:.8;margin-top:12px;}
      .up-actions{margin-top:14px;text-align:right;}
      .up-reset{cursor:pointer;font-family:inherit;font-size:11px;padding:5px 12px;border-radius:7px;
        border:1px solid rgba(224,119,119,.4);background:rgba(224,86,86,.08);color:#e08a8a;transition:.2s;}
      .up-reset:hover{background:rgba(224,86,86,.2);}
      @media(max-width:560px){.up-cards{grid-template-columns:repeat(2,1fr);}}
    `;
    document.head.appendChild(s);
  }

  function render() {
    if (!overlay) return;
    var box = overlay.querySelector('#usageBox');
    box.innerHTML = build();
    box.querySelector('.up-x').addEventListener('click', close);
    box.querySelectorAll('.up-rate').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var r = loadRates(); r[inp.getAttribute('data-r')] = inp.value; saveRates(r); render();
      });
    });
    box.querySelector('.up-reset').addEventListener('click', function () {
      if (window.TokenUsage && TokenUsage.reset) TokenUsage.reset();
      render();
    });
  }

  function ensure() {
    if (overlay) return;
    style();
    overlay = document.createElement('div');
    overlay.id = 'usageOverlay';
    overlay.innerHTML = '<div id="usageBox"></div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  function open() { ensure(); render(); overlay.classList.add('on'); }
  function close() { if (overlay) overlay.classList.remove('on'); }
  function toggle() { if (overlay && overlay.classList.contains('on')) close(); else open(); }

  window.UsagePanel = { open: open, close: close, toggle: toggle, render: render };
  /* 键盘 Esc 关闭 */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
