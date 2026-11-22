/* ============================================================
 * 云境 · 二创版块 v1.0（v6.4.0）
 * ------------------------------------------------------------
 * 玩家可见：浏览/下载二创作品（按时间倒序）、发布向导（确认→打包→上传）。
 * 依赖：ZipWriter、GithubClient、storyFramework（读本机二创内容）。
 * 数据不上传密钥：manifest 与包体经扫描确认无 token / apiKey。
 * 版权：云境独立实现，无第三方源码。
 * ============================================================ */
(function () {
  'use strict';

  var host = null;
  var CH = globalThis.StoryHub = {};

  function toast(t, type) { try { window.showToast && window.showToast(t, type || 'info'); } catch (e) { console.log('[CreationHub]', t); } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtTime(iso) {
    try { var d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    catch (e) { return iso || ''; }
  }

  /* ---------- 安全提醒（常驻） ---------- */
  function safetyBar() {
    return '<div style="background:rgba(220,80,80,.1);border:1px solid rgba(220,120,120,.4);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;line-height:1.8;color:#f0d7d7;">' +
      '<b style="color:#ff9b9b">⚠ 安全提醒</b> · 二创作品由玩家自行上传，云境开发者<b>不审核、不参与、不担责</b>。' +
      '下载与运行前请自行查看源码，谨防病毒或恶意代码；所有作品默认<b>开源、非盈利</b>，如发现违规内容请向 GitHub 仓库举报。' +
      '</div>';
  }

  /* ---------- 面板骨架 ---------- */
  function shell() {
    return '<div style="max-width:900px;margin:0 auto;padding:8px 4px 40px;font-family:inherit;">' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' +
        '<h2 style="margin:0;font-size:22px;color:#f4d896;font-family:' + "'Noto Serif CJK SC',serif" + ';">✦ 云境 · 二创版块</h2>' +
        '<span style="font-size:12px;color:#9a94c0;">玩家作品 · 按时间排列 · 开发者不参与</span>' +
        '<span style="flex:1"></span>' +
        '<button id="ch-publish" style="cursor:pointer;border:1px solid #f4d896;background:#f4d896;color:#1a1530;font-weight:700;border-radius:9px;padding:8px 16px;font-size:13px;">＋ 发布我的二创</button>' +
      '</div>' +
      safetyBar() +
      '<div id="ch-tokenbar" style="font-size:12px;color:#bfb9d4;margin-bottom:12px;"></div>' +
      '<div id="ch-list" style="display:grid;gap:12px;"><div style="color:#9a94c0;font-size:13px;">正在加载二创列表…</div></div>' +
      '<div id="ch-wizard" style="display:none;margin-top:22px;border-top:1px dashed rgba(244,216,150,.3);padding-top:18px;"></div>' +
      '</div>';
  }

  function tokenBar() {
    var GC = globalThis.GithubClient;
    if (!GC) return '（ GitHub 客户端未就绪 ）';
    if (GC.hasToken()) {
      return '✅ 已连接 GitHub' + (GC.getUser() ? '（' + esc(GC.getUser()) + '）' : '') +
        ' · <a href="#" id="ch-logout" style="color:#c9b6ff;">断开</a>';
    }
    return '未连接 GitHub — 浏览/下载无需连接；<b style="color:#c9b6ff">发布</b>需填自己的 token（只存本机）。';
  }

  /* ---------- 浏览列表 ---------- */
  async function renderList() {
    var box = document.getElementById('ch-list');
    if (!box) return;
    var tb = document.getElementById('ch-tokenbar');
    if (tb) tb.innerHTML = tokenBar();
    var lo = document.getElementById('ch-logout');
    if (lo) lo.onclick = function (e) { e.preventDefault(); if (confirm('断开 GitHub 连接？（仅清除本机 token，不影响作品）')) { globalThis.GithubClient.clearToken(); renderList(); } };
    var GC = globalThis.GithubClient;
    // v6.4.0：加载超时保护——国内 GitHub 常断，多线路重试最坏近百秒，
    // 这里 8 秒竞速，超时即给明确提示，不让玩家干等（后台请求仍继续，不取消）。
    var res;
    try {
      res = await Promise.race([
        GC.listFanworks(50),
        new Promise(function (r) { setTimeout(function () { r({ ok: false, error: '连接超时' }); }, 8000); })
      ]);
    } catch (e) { res = { ok: false, error: (e && e.message) || '网络错误' }; }
    if (!res.ok) {
      box.innerHTML = '<div style="color:#f0b0b0;font-size:13px;line-height:1.8;">二创列表加载失败：' + esc(res.error || '网络不通') +
        '<br>国内直连 GitHub 可能不稳定，请稍后重试（已内置多线路自动切换）。浏览不影响你的存档。</div>';
      return;
    }
    var items = res.items || [];
    if (!items.length) {
      box.innerHTML = '<div style="color:#9a94c0;font-size:13px;">暂无二创作品。成为第一个发布者吧 ✦</div>';
      return;
    }
    box.innerHTML = items.map(function (it) {
      var gist = parseGist(it.body);
      var note = parseNote(it.body);
      var dl = gist && gist.rawUrl
        ? '<a href="' + esc(gist.rawUrl) + '" target="_blank" rel="noopener" style="color:#8fd6a8;font-size:12px;text-decoration:none;">⬇ 下载作品包</a>'
        : (gist && gist.url ? '<a href="' + esc(gist.url) + '" target="_blank" rel="noopener" style="color:#8fd6a8;font-size:12px;text-decoration:none;">🔗 查看作品包</a>' : '<span style="color:#8f89a8;font-size:12px;">（包体见正文）</span>');
      return '<div style="background:rgba(24,20,48,.72);border:1px solid rgba(244,216,150,.28);border-radius:14px;padding:14px 16px;">' +
        '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">' +
          '<b style="color:#f4d896;font-size:15px;">' + esc(it.title) + '</b>' +
          '<span style="font-size:11px;color:#9a94c0;">by ' + esc(it.author) + ' · ' + fmtTime(it.createdAt) + '</span>' +
        '</div>' +
        (note ? '<div style="font-size:12.5px;color:#c6c0d6;line-height:1.7;margin:8px 0;white-space:pre-wrap;">' + esc(note) + '</div>' : '') +
        '<div style="display:flex;gap:14px;margin-top:6px;">' + dl +
          '<a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="color:#c9b6ff;font-size:12px;text-decoration:none;">💬 原帖</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* Issue body 里用约定标记解析 */
  function parseNote(body) {
    var m = String(body || '').match(/<!--YJ_NOTE-->([\s\S]*?)<!--\/YJ_NOTE-->/);
    return m ? m[1].trim() : '';
  }
  function parseGist(body) {
    var m = String(body || '').match(/<!--YJ_GIST-->([\s\S]*?)<!--\/YJ_GIST-->/);
    if (!m) return null;
    try { return JSON.parse(m[1].trim()); } catch (e) { return null; }
  }

  /* ---------- 收集本机二创内容（增量包，全平台可行） ---------- */
  function collectLocalContent() {
    var picked = [];
    var ls = window.localStorage;
    // 只收玩家创作类键，排除 token/接口密钥/存档大正文
    var SAFE = /^(yunjing(p personality|Regex|RegexCustom|Custom|Ext|KB|Knowledge|DLC|Forge|Creator|WorldBook)|yj_.*(dlc|forge|creation|worldbook|regex))/i;
    var BLOCK = /(token|apikey|api_key|secret|password|存档|storySave_|transcript|yunjing_.*_tr$)/i;
    var found = [];
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (!k || BLOCK.test(k)) continue;
        if (/^(xy_|yunjing|DLC|Creator|forge|storyKB|worldExt|regex)/i.test(k)) found.push(k);
      }
    } catch (e) {}
    // IDB 里的长文本/DLC 若可枚举，交给上层异步补；这里先收 localStorage
    found.slice(0, 200).forEach(function (k) {
      try { picked.push({ name: 'local/' + k.replace(/[^\w.\-]/g, '_') + '.json', data: ls.getItem(k) || '' }); } catch (e) {}
    });
    return picked;
  }

  /* ---------- 包体密钥扫描（硬门禁） ---------- */
  function scanSecrets(entries) {
    var bad = [];
    var PAT = /(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"][^'"]{12,}|Authorization\s*[:=])/i;
    entries.forEach(function (e) {
      var s = typeof e.data === 'string' ? e.data : '';
      if (s && PAT.test(s)) bad.push(e.name);
    });
    return bad;
  }

  /* ---------- 发布向导 ---------- */
  function openWizard() {
    var GC = globalThis.GithubClient;
    var w = document.getElementById('ch-wizard');
    if (!w) return;
    w.style.display = 'block';
    w.innerHTML =
      '<h3 style="color:#e7c899;font-size:17px;margin:0 0 12px;">发布二创作品</h3>' +
      '<div style="font-size:12.5px;color:#bfb9d4;line-height:1.8;margin-bottom:12px;">' +
        '作品以<b>增量包</b>形式打包：你在本机改动的设定/模块/DLC/正则等（从浏览器内部读取，全平台可用）。<b>不含</b>你的存档正文、API 密钥与 GitHub token。' +
      '</div>' +
      '<label style="display:block;font-size:12.5px;color:#c6c0d6;margin-bottom:6px;">作品名称</label>' +
      '<input id="wz-title" placeholder="例如：剑来·武夫境界增强版" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;margin-bottom:10px;">' +
      '<label style="display:block;font-size:12.5px;color:#c6c0d6;margin-bottom:6px;">与原版云境的区别 / 做了什么更新（必填）</label>' +
      '<textarea id="wz-note" rows="4" placeholder="例如：新增了武夫十一境的细化数值、调整了剑气长城地图……" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;resize:vertical;"></textarea>' +
      '<div style="background:rgba(220,80,80,.08);border:1px solid rgba(220,120,120,.3);border-radius:10px;padding:12px 14px;margin:12px 0;font-size:12.5px;color:#f0d7d7;line-height:1.9;">' +
        '<b style="color:#ff9b9b">发布前确认（四项必须全勾）</b>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我同意本作品以<b>开源、非盈利</b>方式公开分享</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我确认包内<b>不含</b>任何 API 密钥、密码或个人隐私</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我理解下载者需<b>自行承担风险</b>，谨防病毒/恶意代码，作者与云境开发者不担责</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我已如实注明本版本与原版云境的区别/更新内容</label>' +
      '</div>' +
      '<div id="wz-token" style="font-size:12.5px;color:#c6c0d6;margin-bottom:10px;"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button id="wz-go" style="cursor:pointer;border:1px solid #f4d896;background:#f4d896;color:#1a1530;font-weight:700;border-radius:9px;padding:9px 18px;font-size:13px;">确认并发布</button>' +
        '<button id="wz-cancel" style="cursor:pointer;border:1px solid rgba(244,216,150,.4);background:transparent;color:#e7c899;border-radius:9px;padding:9px 18px;font-size:13px;">取消</button>' +
      '</div>' +
      '<div id="wz-log" style="font-size:12.5px;color:#8fd6a8;margin-top:12px;line-height:1.8;"></div>';

    var tokBox = document.getElementById('wz-token');
    tokBox.innerHTML = GC.hasToken()
      ? '✅ 将用 GitHub 账号 <b style="color:#c9b6ff">' + esc(GC.getUser() || '已连接') + '</b> 发布'
      : '发布需 GitHub token：' +
        '<input id="wz-token-input" type="password" placeholder="粘贴 fine-grained token（只存本机）" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:8px 10px;font-size:12.5px;font-family:inherit;margin-top:6px;">' +
        '<div style="font-size:11px;color:#8f89a8;margin-top:4px;">' + esc(GC.scopeHint()) + '</div>';

    document.getElementById('wz-cancel').onclick = function () { w.style.display = 'none'; };
    document.getElementById('wz-go').onclick = doPublish;
    w.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function doPublish() {
    var GC = globalThis.GithubClient;
    var log = document.getElementById('wz-log');
    var title = (document.getElementById('wz-title').value || '').trim();
    var note = (document.getElementById('wz-note').value || '').trim();
    var cks = [].slice.call(document.querySelectorAll('.wz-ck'));
    if (!title) { log.style.color = '#ff9b9b'; log.textContent = '请填作品名称。'; return; }
    if (!note) { log.style.color = '#ff9b9b'; log.textContent = '请填写与原版的区别/更新内容。'; return; }
    if (cks.length < 4 || cks.some(function (c) { return !c.checked; })) { log.style.color = '#ff9b9b'; log.textContent = '请勾选全部四项确认。'; return; }
    var tin = document.getElementById('wz-token-input');
    if (!GC.hasToken() && tin && tin.value.trim()) GC.setToken(tin.value.trim());
    if (!GC.hasToken()) { log.style.color = '#ff9b9b'; log.textContent = '请先填写 GitHub token。'; return; }

    try {
      log.style.color = '#8fd6a8'; log.textContent = '① 正在收集本机二创内容…';
      var entries = collectLocalContent();
      entries.unshift({ name: 'manifest.json', data: JSON.stringify({
        app: 'yunjing-fanwork', schema: 1, title: title, note: note,
        baseVersion: (window.YJ_VER || 'unknown'), author: GC.getUser() || '',
        createdAt: new Date().toISOString(), license: '开源·非盈利',
        files: entries.map(function (e) { return e.name; })
      }, null, 2) });

      log.textContent = '② 正在扫描密钥/隐私…';
      var bad = scanSecrets(entries);
      if (bad.length) { log.style.color = '#ff9b9b'; log.textContent = '检测到疑似密钥/隐私字段，已中止：' + bad.join(', '); return; }

      log.textContent = '③ 正在打包…';
      var zip = await globalThis.ZipWriter.makeZip(entries);
      var b64 = bytesToBase64(zip);

      log.textContent = '④ 正在验证 GitHub 账号…';
      var who = await GC.whoami();
      if (!who.ok) { log.style.color = '#ff9b9b'; log.textContent = 'token 验证失败：' + (who.error || '请检查权限'); return; }
      GC.setUser(who.login);

      log.textContent = '⑤ 正在上传作品包（公开 Gist）…';
      var fname = 'yunjing-fanwork-' + Date.now() + '.zip.b64';
      var gist = await GC.createGist(fname, b64, '云境二创：' + title + '（开源非盈利）');
      if (!gist.ok) {
        // 断网：Gist 失败也记入队列提示（Issue 统一走队列）
        log.style.color = '#f0c98f'; log.textContent = '作品包上传失败（网络）：' + (gist.error || '') + '。将尝试排队稍后发布。';
      }

      var body = '<!--YJ_NOTE-->\n' + note + '\n<!--/YJ_NOTE-->\n' +
        (gist.ok ? '<!--YJ_GIST-->' + JSON.stringify({ url: gist.url, rawUrl: gist.rawUrl, id: gist.id }) + '<!--/YJ_GIST-->\n' : '') +
        '\n---\n由云境·二创版块自动发布 · 基于云境 v' + (window.YJ_VER || '?') + ' · 开源非盈利 · 风险自负';

      log.textContent = '⑥ 正在发布到版块…';
      var pub = await GC.publishOrQueue(title, body);
      if (pub.ok) {
        log.style.color = '#8fd6a8'; log.textContent = '✅ 发布成功！作品已出现在二创版块（按时间排列）。' + (pub.data && pub.data.html_url ? ' <a href="' + esc(pub.data.html_url) + '" target="_blank" rel="noopener" style="color:#c9b6ff;">查看</a>' : '');
        setTimeout(function () { document.getElementById('ch-wizard').style.display = 'none'; renderList(); }, 2200);
      } else if (pub.queued) {
        log.style.color = '#f0c98f'; log.textContent = '⚠ 网络不通，已存入本机待发队列（' + GC.queueSize() + ' 条）。联网后打开版块会提示重试。';
      } else {
        log.style.color = '#ff9b9b'; log.textContent = '发布失败：' + (pub.error || '未知错误');
      }
    } catch (e) {
      log.style.color = '#ff9b9b'; log.textContent = '发布异常：' + (e && e.message || e);
    }
  }

  function bytesToBase64(u8) {
    var chunk = 0x8000, parts = [];
    for (var i = 0; i < u8.length; i += chunk) parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + chunk)));
    return btoa(parts.join(''));
  }

  /* ---------- 打开/关闭 ---------- */
  function open(container) {
    host = container || document.body;
    var existed = document.getElementById('ch-root');
    if (existed) existed.remove();
    var root = document.createElement('div');
    root.id = 'ch-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(10,8,24,.97);overflow:auto;padding:20px;';
    root.innerHTML = '<div style="max-width:960px;margin:0 auto;display:flex;justify-content:flex-end;"><button id="ch-close" style="cursor:pointer;border:1px solid rgba(244,216,150,.4);background:transparent;color:#e7c899;border-radius:9px;padding:6px 14px;font-size:13px;">✕ 关闭</button></div>' + shell();
    host.appendChild(root);
    document.getElementById('ch-close').onclick = close;
    document.getElementById('ch-publish').onclick = openWizard;
    renderList();
    // 有队列则提示补发
    if (globalThis.GithubClient && globalThis.GithubClient.queueSize() > 0) {
      toast('有 ' + globalThis.GithubClient.queueSize() + ' 条待发作品，正在尝试补发', 'info');
      globalThis.GithubClient.flushQueue().then(function (r) { if (r.done) { toast('已补发 ' + r.done + ' 条', 'ok'); renderList(); } });
    }
  }
  function close() { var r = document.getElementById('ch-root'); if (r) r.remove(); host = null; }

  CH.open = open;
  CH.close = close;
  CH._renderList = renderList;
  CH._collectLocalContent = collectLocalContent;
  CH._scanSecrets = scanSecrets;
  globalThis.CreationHub = CH;
  if (typeof module !== 'undefined' && module.exports) module.exports = CH;
})();
