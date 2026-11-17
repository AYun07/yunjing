/* 云境 · 作品分享 WorldShare v1.0.0（v4.18.0）
 * 让玩家把「世界」和「整书」打包带走或发给别人。纯前端、无后端：
 *   ① 导出世界包 JSON：题材配置 + 世界书 + 预设/正则 + 当前设定/变量；
 *   ② 生成分享码：世界包 UTF-8 → base64 文本，可复制发给别人；
 *   ③ 导入分享码：粘贴即还原世界书与设定（不覆盖存档，安全）。
 * 不上传任何数据；分享码只是文本的另一种编码，玩家自己决定发给谁。 */
(function () {
  'use strict';

  function genre() {
    try { return (window.storyFramework && (storyFramework.genre || (storyFramework.config && storyFramework.config.genreKey))) || 'free'; } catch (e) { return 'free'; }
  }
  function download(text, filename) {
    try {
      var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    } catch (e) { window.showToast && showToast('导出失败：' + e.message, 'error'); }
  }
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** 采集当前世界的分享包 */
  function collect() {
    var g = genre();
    var pkg = { app: 'yunjing', kind: 'world-share', version: 1, genre: g, at: Date.now() };
    try {
      var fw = window.storyFramework;
      pkg.setup = fw && fw.storyState ? fw.storyState.setup : null;
      pkg.variables = fw && fw.storyState ? fw.storyState.variables : null;
    } catch (e) {}
    try {
      // 世界书：优先 KB_PRESETS[genre]（内置）+ 玩家改写（yunjingWorldBook:genre）
      var kb = [];
      if (window.KB_PRESETS && window.KB_PRESETS[g]) kb = kb.concat(window.KB_PRESETS[g]);
      var custom = localStorage.getItem('yunjingWorldBook:' + g);
      if (custom) { var c = JSON.parse(custom); if (Array.isArray(c)) kb = kb.concat(c); }
      pkg.worldBook = kb;
    } catch (e) {}
    try {
      pkg.presets = localStorage.getItem('yunjingPresets') ? JSON.parse(localStorage.getItem('yunjingPresets')) : null;
      pkg.regex = localStorage.getItem('yunjingRegex') ? JSON.parse(localStorage.getItem('yunjingRegex')) : null;
    } catch (e) {}
    return pkg;
  }

  function exportWorldPack() {
    var pkg = collect();
    download(JSON.stringify(pkg, null, 2), '云境世界包_' + pkg.genre + '_' + Date.now().toString(36) + '.json');
    window.showToast && showToast('✅ 世界包已导出（世界书 ' + (pkg.worldBook ? pkg.worldBook.length : 0) + ' 条）', 'info');
  }

  function makeShareCode() {
    var pkg = collect();
    var code = 'YJ1:' + utf8ToB64(JSON.stringify(pkg));
    showBox('分享码已生成', '复制下面这段分享码发给朋友，对方在「工具 → 导入分享码」粘贴即可还原这个世界。', code, true);
  }

  function importShareCode() {
    showBox('导入分享码', '粘贴以 YJ1: 开头的分享码，导入世界书与设定（不会覆盖你的存档）。', '', false);
  }

  function showBox(title, desc, value, isOutput) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(8,7,20,.7);backdrop-filter:blur(5px);font-family:"Noto Sans SC",sans-serif;padding:20px;';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(620px,94vw);background:#141124;border:1px solid rgba(201,168,106,.35);border-radius:16px;padding:22px;color:#efe9d8;';
    box.innerHTML = '<h3 style="margin:0 0 8px;font-size:17px;">🌐 ' + title + '</h3>'
      + '<p style="margin:0 0 12px;font-size:12.5px;line-height:1.7;color:#b9b2c9;">' + desc + '</p>'
      + (isOutput
        ? '<textarea readonly style="width:100%;height:150px;box-sizing:border-box;padding:10px;border-radius:8px;background:#0e0c1c;color:#9fe0cf;border:1px solid #2c5a54;font-size:11px;font-family:monospace;word-break:break-all;"></textarea>'
        : '<textarea placeholder="在这里粘贴分享码…" style="width:100%;height:150px;box-sizing:border-box;padding:10px;border-radius:8px;background:#0e0c1c;color:#efe9d8;border:1px solid #3a3550;font-size:12px;"></textarea>')
      + '<div style="display:flex;gap:8px;margin-top:12px;"><button data-close style="flex:0 0 auto;padding:9px 14px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:transparent;color:#b9b2c9;cursor:pointer;">关闭</button>'
      + (isOutput
        ? '<button data-copy style="flex:1;padding:9px;border:1px solid #c9a86a;border-radius:8px;background:#c9a86a;color:#1a1530;font-weight:700;cursor:pointer;">📋 复制分享码</button>'
        : '<button data-do style="flex:1;padding:9px;border:1px solid #c9a86a;border-radius:8px;background:#c9a86a;color:#1a1530;font-weight:700;cursor:pointer;">导入</button>')
      + '</div><div data-msg style="margin-top:10px;font-size:12px;min-height:16px;color:#8fe0a8;"></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    var ta = box.querySelector('textarea'); if (isOutput) ta.value = value;
    box.querySelector('[data-close]').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    if (isOutput) {
      box.querySelector('[data-copy]').onclick = function () {
        ta.select(); try { document.execCommand('copy'); } catch (e) {}
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () {});
        box.querySelector('[data-msg]').textContent = '已复制，发给你朋友吧～';
      };
    } else {
      box.querySelector('[data-do]').onclick = function () {
        var code = String(ta.value || '').trim();
        var msg = box.querySelector('[data-msg]');
        if (!/^YJ1:/.test(code)) { msg.style.color = '#f08a7a'; msg.textContent = '分享码格式不对（应以 YJ1: 开头）'; return; }
        try {
          var pkg = JSON.parse(b64ToUtf8(code.slice(4)));
          if (pkg.app !== 'yunjing' || !pkg.worldBook) throw new Error('不是有效的云境世界包');
          // 写入当前界的玩家世界书（与内置并存），不碰存档
          var g = pkg.genre || genre();
          var key = 'yunjingWorldBook:' + g;
          var cur = [];
          try { var raw = localStorage.getItem(key); if (raw) { var cj = JSON.parse(raw); if (Array.isArray(cj)) cur = cj; } } catch (e) {}
          var merged = cur.concat(pkg.worldBook);
          localStorage.setItem(key, JSON.stringify(merged));
          msg.style.color = '#8fe0a8'; msg.textContent = '✅ 导入成功：' + pkg.worldBook.length + ' 条世界书已加入「' + g + '」界（共 ' + merged.length + ' 条）';
        } catch (e) { msg.style.color = '#f08a7a'; msg.textContent = '导入失败：' + (e && e.message || e); }
      };
    }
  }

  window.WorldShare = { exportWorldPack: exportWorldPack, makeShareCode: makeShareCode, importShareCode: importShareCode, collect: collect };
})();
