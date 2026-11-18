/**
 * 云境 · 商业化授权占位模块 (v4.36.0)
 * ------------------------------------------------------------------
 * 设计原则（重要）：
 *  1. 这是【占位】，不是真实授权系统。不联网、不校验真伪、不接支付。
 *  2. 界面明确标注"商业化预留 · 尚未启用"，绝不误导用户以为已购买/已授权。
 *  3. 仅预留 UI 与本地状态读写接口，未来接真实授权时替换 verify() 即可。
 *  4. 纯本地，零网络请求，不收集任何信息，不上传激活码。
 * ------------------------------------------------------------------
 * 对外接口：window.YJLicense = { open, status, verifyPlaceholder, version }
 */
(function () {
  'use strict';

  var LS_KEY = 'yj_license_placeholder_v1';
  var VERSION = '4.36.0';

  function readState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { activated: false, code: '', ts: 0 };
    } catch (e) { return { activated: false, code: '', ts: 0 }; }
  }
  function writeState(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /** 占位校验：只做格式检查 + 固定演示码，绝非真实授权。 */
  function verifyPlaceholder(code) {
    code = String(code || '').trim().toUpperCase();
    // 演示用固定码，界面会明确标注这是示例
    var DEMO = 'YUNJING-DEMO-2026';
    var okFormat = /^[A-Z0-9]{4}(-[A-Z0-9]{4,}).*$/.test(code);
    var ok = okFormat && code === DEMO;
    return { ok: ok, reason: ok ? '演示码通过（非真实授权）' : (okFormat ? '演示码不正确' : '格式应为 XXXX-XXXX-XXXX') };
  }

  function status() {
    var s = readState();
    return { activated: !!s.activated, since: s.ts || 0, isPlaceholder: true };
  }

  var modal = null;
  function ensureModal() {
    if (modal && document.body.contains(modal)) return modal;
    modal = document.createElement('div');
    modal.id = 'yj-license-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(6,8,20,.72);backdrop-filter:blur(6px);font-family:inherit;';
    modal.innerHTML =
      '<div style="width:min(440px,92vw);background:linear-gradient(180deg,#1e2246,#12142e);border:1px solid rgba(232,196,119,.35);border-radius:18px;padding:26px 26px 22px;color:#ece5d4;box-shadow:0 24px 80px rgba(0,0,0,.6);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<h3 style="margin:0;font-size:20px;letter-spacing:.08em;color:#f6ecd2;">授权 · 商业化预留</h3>' +
          '<button id="yj-lic-close" aria-label="关闭" style="background:none;border:none;color:#a89f8c;font-size:22px;cursor:pointer;line-height:1;">✕</button>' +
        '</div>' +
        '<p style="margin:14px 0 6px;font-size:13px;line-height:1.7;color:#c9c2b0;">' +
          '此处为<b style="color:#e8c477;">商业化授权系统的占位</b>：当前<b>尚未启用</b>，不联网、不校验真伪、不涉及支付，也不会上传你输入的任何内容。' +
          '云境目前<b>完全免费</b>，无需激活码即可使用全部功能。' +
        '</p>' +
        '<div id="yj-lic-state" style="margin:12px 0;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.05);font-size:13px;"></div>' +
        '<label style="display:block;font-size:12px;color:#8a94d0;margin:14px 0 6px;">演示激活码（示例：YUNJING-DEMO-2026）</label>' +
        '<input id="yj-lic-input" type="text" spellcheck="false" placeholder="XXXX-XXXX-XXXX" ' +
          'style="width:100%;box-sizing:border-box;padding:11px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.25);color:#f2effb;font-size:14px;letter-spacing:.06em;">' +
        '<div id="yj-lic-msg" style="min-height:20px;margin:10px 0 0;font-size:12.5px;"></div>' +
        '<div style="display:flex;gap:10px;margin-top:14px;">' +
          '<button id="yj-lic-verify" style="flex:1;padding:11px;border:none;border-radius:10px;background:linear-gradient(90deg,#d8a04c,#e8c477);color:#1a1512;font-weight:700;font-size:14px;cursor:pointer;">校验演示码</button>' +
          '<button id="yj-lic-clear" style="padding:11px 16px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:transparent;color:#c9c2b0;font-size:13px;cursor:pointer;">清除</button>' +
        '</div>' +
        '<p style="margin:16px 0 0;font-size:11px;color:#7d7a6e;line-height:1.6;">接入真实授权时，只需替换本模块的 verify() 实现为服务端校验；UI 与状态读写接口可复用。此为技术占位，不构成任何授权承诺。</p>' +
      '</div>';
    document.body.appendChild(modal);

    function refreshState() {
      var st = status();
      var box = document.getElementById('yj-lic-state');
      box.innerHTML = st.activated
        ? '<span style="color:#8fd9a8;">● 演示状态：已激活（非真实授权，仅本地演示）</span>'
        : '<span style="color:#c9a86a;">○ 当前状态：未启用 · 云境免费开放</span>';
    }
    refreshState();
    modal._refresh = refreshState;

    document.getElementById('yj-lic-close').onclick = close;
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.getElementById('yj-lic-verify').onclick = function () {
      var code = document.getElementById('yj-lic-input').value;
      var r = verifyPlaceholder(code);
      var msg = document.getElementById('yj-lic-msg');
      msg.style.color = r.ok ? '#8fd9a8' : '#e0a84c';
      msg.textContent = r.reason;
      if (r.ok) {
        writeState({ activated: true, code: code.trim().toUpperCase(), ts: Date.now() });
        refreshState();
      }
    };
    document.getElementById('yj-lic-clear').onclick = function () {
      writeState({ activated: false, code: '', ts: 0 });
      document.getElementById('yj-lic-input').value = '';
      document.getElementById('yj-lic-msg').textContent = '';
      refreshState();
    };
    return modal;
  }

  function open() {
    var m = ensureModal();
    m.style.display = 'flex';
    if (m._refresh) m._refresh();
  }
  function close() { if (modal) modal.style.display = 'none'; }

  /* v4.37.0 · 玩家反馈「授权占位」入口碍眼，已移除界面挂载。
     模块本体与 window.YJLicense API 完整保留（open/status/verifyPlaceholder），
     未来接入真实授权时可直接调用；仅不再自动往页面插入任何可见按钮。
     如需临时调试，可在控制台手动执行 YJLicense.open()。 */
  function mount() {
    // 默认不挂载任何可见入口。保留函数体以便未来按需开启。
    return;
  }

  window.YJLicense = {
    open: open, close: close, status: status,
    verifyPlaceholder: verifyPlaceholder, version: VERSION,
    isPlaceholder: true
  };
})();
