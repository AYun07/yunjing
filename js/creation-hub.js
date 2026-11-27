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
  /* 全局名统一为 CreationHub（与 studio.html 调用一致）；StoryHub 保留为兼容别名。
     在对象创建之初即注册，避免 IIFE 中途异常导致 CreationHub 缺失、入口走失败分支。 */
  var CH = globalThis.CreationHub = globalThis.StoryHub = {};

  function toast(t, type) { try { window.showToast && window.showToast(t, type || 'info'); } catch (e) { console.debug('[CreationHub]', t); } }
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
        '<h2 style="margin:0;font-size:22px;color:#f4d896;font-family:' + "'Noto Serif CJK SC',serif" + ';">✦ 云境 · 创意工坊</h2>' +
        '<span style="font-size:12px;color:#9a94c0;">唯一文件夹 community/works/ · 按时间排列 · 云境内下载安装 · 开发者不参与</span>' +
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

  /* ---------- 浏览列表（v6.6.0：数据源=唯一总文件夹 community/works 的清单） ---------- */
  var LIST_SEQ = 0; // 防止旧的异步渲染覆盖新的
  async function renderList() {
    var box = document.getElementById('ch-list');
    if (!box) return;
    var mySeq = ++LIST_SEQ;
    var tb = document.getElementById('ch-tokenbar');
    if (tb) tb.innerHTML = tokenBar();
    var lo = document.getElementById('ch-logout');
    if (lo) lo.onclick = function (e) { e.preventDefault(); if (confirm('断开 GitHub 连接？（仅清除本机 token，不影响作品）')) { globalThis.GithubClient.clearToken(); renderList(); } };
    var GC = globalThis.GithubClient;
    if (!GC || !GC.listWorks) { box.innerHTML = '<div style="color:#f0b0b0;font-size:13px;">创意工坊组件未就绪，请刷新页面。</div>'; return; }
    var res;
    try {
      res = await Promise.race([
        GC.listWorks(),
        new Promise(function (r) { setTimeout(function () { r({ ok: false, error: '连接超时' }); }, 14000); })
      ]);
    } catch (e) { res = { ok: false, error: (e && e.message) || '网络错误' }; }
    if (mySeq !== LIST_SEQ) return; // 已被新一次渲染取代
    // v7.4.0：网络/缓存/内置清单都失败时（含 Promise.race 超时），读随包基线清单显示正常空态，
    // 而不是让整个二创板块报「加载失败」——这是「二创无法加载」的根因修复。
    if (!res.ok) {
      try {
        var lr = await fetch('community/works/catalog.json?_=' + Date.now(), { cache: 'no-store' });
        if (lr && lr.ok) {
          var lo = await lr.json();
          res = { ok: true, items: (lo && Array.isArray(lo.items)) ? lo.items : [], local: true };
        }
      } catch (e) {}
    }
    if (!res.ok) {
      box.innerHTML = '<div style="color:#f0b0b0;font-size:13px;line-height:1.8;">创意工坊清单加载失败：' + esc(res.error || '网络不通') +
        '<br>浏览/下载在云境内完成（已内置多线路自动切换与本机缓存）；首次需联网，断网时读上次缓存。上传需填自己的 token。</div>';
      return;
    }
    var items = res.items || [];
    if (!items.length) {
      box.innerHTML = '<div style="color:#9a94c0;font-size:13px;">创意工坊还没有作品。成为第一个发布者吧 ✦<br><span style="font-size:12px;color:#8f89a8;">（作品统一存于仓库 community/works/ 单一文件夹，按时间排列）</span></div>'
        + (res.local ? '<div style="font-size:11px;color:#7f7a9a;margin-top:6px;">（当前离线 · 显示内置清单；联网后可看到社区最新作品）</div>' : '');
      return;
    }
    box.innerHTML = items.map(function (it, idx) {
      var sec = it._sec; // 由下方并发读取填充
      var rawUrl = GC.getPackageUrl(it.slug);
      var na = '';
      function row(label, val, color) {
        return '<div style="margin:5px 0;font-size:12.5px;line-height:1.65;color:' + (color || '#c6c0d6') + ';"><b style="color:#e7c899;">' + label + '：</b><span style="white-space:pre-wrap;">' + esc(val || na || '—') + '</span></div>';
      }
      var pkgDisp = (it.package || ('community/works/' + it.slug + '/package.zip')) +
        (it.size ? ' · ' + Math.round(it.size / 1024) + ' KB' : '') + ' · 真 zip 包体与说明同处';
      return '<div class="ch-work" data-idx="' + idx + '" style="background:rgba(24,20,48,.72);border:1px solid rgba(244,216,150,.28);border-radius:14px;padding:14px 16px;">' +
        '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">' +
          '<b style="color:#f4d896;font-size:15px;">' + esc(it.title) + '</b>' +
          '<span style="font-size:11px;color:#9a94c0;">by ' + esc(it.author || '匿名') + ' · ' + fmtTime(it.createdAt) + '</span>' +
        '</div>' +
        row('① 简介', (sec && sec.intro) || it.summary, '#c6c0d6') +
        row('② 特点', sec && sec.feature, '#bfb9d4') +
        row('③ 二创内容', sec && sec.content, '#c9bfe0') +
        row('📦 打包源码', pkgDisp, '#8fd6a8') +
        '<div style="font-size:11px;color:#7f7a9a;margin-top:4px;">作品路径：' + esc('community/works/' + it.slug + '/') + '</div>' +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:9px;flex-wrap:wrap;">' +
          '<button class="ch-install" data-idx="' + idx + '" style="cursor:pointer;border:1px solid #c9b6ff;background:rgba(201,182,255,.14);color:#d9c9ff;border-radius:8px;padding:6px 12px;font-size:12px;">⚡ 一键下载安装</button>' +
          '<a href="' + esc(rawUrl) + '" target="_blank" rel="noopener" style="color:#8fd6a8;font-size:12px;text-decoration:none;">⬇ 下载包体</a>' +
        '</div>' +
      '</div>';
    }).join('') + (res.cached ? '<div style="color:#f0c98f;font-size:12px;margin-top:10px;">⚠ 离线 · 显示上次缓存的清单</div>' : '');

    // 并发（上限 5）读每个作品的 README 解析四段，回填后再刷新文本（不影响已显示的时间/标题/下载）
    var queue = items.slice();
    async function worker() {
      while (queue.length) {
        var work = queue.shift();
        var i = items.indexOf(work);
        try {
          var r = await GC.readWorkFile(work.slug, 'README.md');
          if (r.ok) work._sec = parseSections(r.text);
        } catch (e) {}
        if (mySeq !== LIST_SEQ) return;
        // 就地更新该卡片的三段文本
        var card = box.querySelector('.ch-work[data-idx="' + i + '"]');
        if (card && work._sec) {
          var spans = card.querySelectorAll('span[style*="white-space"]');
          if (spans[0]) spans[0].textContent = work._sec.intro || work.summary || '—';
          if (spans[1]) spans[1].textContent = work._sec.feature || '—';
          if (spans[2]) spans[2].textContent = work._sec.content || '—';
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);

    [].slice.call(box.querySelectorAll('.ch-install')).forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        var it = items[i];
        if (!it) return;
        openInstall({ slug: it.slug, rawUrl: GC.getPackageUrl(it.slug) }, { title: it.title });
      };
    });
  }

  /* Issue body 里用约定标记解析 */
  function parseNote(body) {
    var m = String(body || '').match(/<!--YJ_NOTE-->([\s\S]*?)<!--\/YJ_NOTE-->/);
    return m ? m[1].trim() : '';
  }
  /** 四段式解析：有 YJ_V2 走四段，否则用老 note 回退（A7 兼容） */
  function parseSections(body) {
    var PE = globalThis.PatchEngine;
    var four = PE && PE.parseFourSectionBody ? PE.parseFourSectionBody(body) : null;
    if (four) return { v2: true, intro: four.intro, feature: four.feature, content: four.content, pkg: four.pkgText };
    // 老作品单段回退
    return { v2: false, intro: parseNote(body), feature: '', content: '', pkg: '' };
  }
  function parseGist(body) {
    var m = String(body || '').match(/<!--YJ_GIST-->([\s\S]*?)<!--\/YJ_GIST-->/);
    if (!m) return null;
    try { return JSON.parse(m[1].trim()); } catch (e) { return null; }
  }

  /* ---------- 增量安装（v6.5.0）：下载→解包→三方差异预览→选处置→备份→应用→回滚 ---------- */
  function b64ToBytes(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  async function fetchPackage(gist) {
    var GC = globalThis.GithubClient;
    if (!gist) return { ok: false, error: '该作品没有可用的包体链接' };
    // v6.6.0：works 作品优先走 contents API 取字节（无 raw CDN 缓存、始终最新、带 token 绕限流）
    if (gist.slug && GC.getWorkPackageBytes) {
      var wb = await GC.getWorkPackageBytes(gist.slug);
      if (wb.ok) return { ok: true, u8: wb.bytes, via: 'contents' };
      // contents 失败（如匿名限流）再回退 raw
    }
    if (!gist.rawUrl) return { ok: false, error: '该作品没有可用的包体链接' };
    var parts = gist.parts && gist.parts.length ? gist.parts : [{ rawUrl: gist.rawUrl }];
    var segs = [], rawBytes = [];
    for (var i = 0; i < parts.length; i++) {
      var r = await GC.downloadGistRaw(parts[i].rawUrl);
      if (!r.ok) return { ok: false, error: '下载第 ' + (i + 1) + '/' + parts.length + ' 卷失败：' + (r.error || '') };
      segs.push(r.text);
      rawBytes.push(r.bytes);
    }
    // v6.5.1 兼容：包体若以 zip 魔数 PK\x03\x04 开头 → GitHub 存的是原始二进制，直接用；
    // 否则是 b64 文本（旧版 Gist / 分卷片段），按 base64 解码。
    var first = String(segs[0] || '');
    if (first.charCodeAt(0) === 0x50 && first.charCodeAt(1) === 0x4b && first.charCodeAt(2) === 0x03) {
      var all = [], off = 0, k;
      for (k = 0; k < rawBytes.length; k++) {
        var b = rawBytes[k] || b64ToBytes(segs[k]);
        for (var j = 0; j < b.length; j++) all[off++] = b[j];
      }
      return { ok: true, u8: new Uint8Array(all) };
    }
    try { return { ok: true, u8: b64ToBytes(segs.join('')) }; }
    catch (e) { return { ok: false, error: '包体 base64 解码失败' }; }
  }

  async function openInstall(gist, meta) {
    var PE = globalThis.PatchEngine, ZW = globalThis.ZipWriter, CA = globalThis.ContentAdapters;
    var root = document.getElementById('ch-root');
    if (!PE || !ZW || !CA) { toast('补丁组件未就绪，请刷新', 'error'); return; }
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(8,6,20,.98);overflow:auto;padding:24px;';
    panel.innerHTML = '<div style="max-width:820px;margin:0 auto;font-family:inherit;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h2 style="color:#f4d896;font-size:20px;margin:0;">⚙ 增量安装 · ' + esc(meta.title || '二创作品') + '</h2>' +
        '<button id="ins-close" style="cursor:pointer;border:1px solid rgba(244,216,150,.4);background:transparent;color:#e7c899;border-radius:9px;padding:6px 14px;">✕ 关闭</button>' +
      '</div>' + safetyBar() +
      '<div id="ins-body" style="color:#c6c0d6;font-size:13px;line-height:1.9;">正在下载并解析补丁包…</div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('ins-close').onclick = function () { panel.remove(); };
    var body = document.getElementById('ins-body');
    try {
      var pkg = await fetchPackage(gist);
      if (!pkg.ok) { body.innerHTML = '<span style="color:#f0b0b0">下载失败：' + esc(pkg.error) + '</span>'; return; }
      var files = await ZW.unzip(pkg.u8);
      var mf = files.find(function (f) { return f.name === 'manifest.json'; });
      if (!mf) { body.innerHTML = '<span style="color:#f0b0b0">包内缺少 manifest.json，不是合法的增量补丁包。</span>'; return; }
      var manifest;
      try { manifest = JSON.parse(ZW.entryText(mf)); } catch (e) { body.innerHTML = '<span style="color:#f0b0b0">manifest.json 解析失败。</span>'; return; }
      // 还原 theirs 内容项
      var theirs = (manifest.changes || []).map(function (c) {
        var f = files.find(function (x) { return x.name === c.file; });
        var data = PE.TOMB;
        if (f) { try { data = JSON.parse(ZW.entryText(f)).data; } catch (e) {} }
        return { key: c.key, kind: c.kind, hash: c.newHash || PE.hash(data), data: data };
      });
      // 本机现状 + 基线
      var ours = CA.collect({}).items;
      var baseList = readLocalBaseline() || theirs.map(function (t) { return { key: t.key, kind: t.kind, hash: manifest.changes.find(function (c) { return c.key === t.key; }).baseHash || PE.TOMB }; });
      var decisions = PE.plan(baseList, ours, theirs);
      var sum = PE.summarize(decisions);
      var vc = PE.versionCheck(manifest.baseVersion, window.YJ_VER || 'unknown', manifest.baseVersion);

      // 密钥二次扫描（下载端也扫一遍，防发布端绕过）
      var bad = PE.scanSecrets(theirs);
      if (bad.length) {
        body.innerHTML = '<span style="color:#ff9b9b">安全拦截：包内检测到疑似密钥字段（' + bad.map(esc).join(', ') + '），已中止安装。</span>';
        return;
      }

      var vcColor = vc.level === 'ok' ? '#8fd6a8' : '#f0c98f';
      var rows = decisions.map(function (d, i) {
        var label = { sync:'已一致·跳过', overwrite:'直接覆盖', keep:'保留我的', merge:'自动合并', conflict:'冲突·需你选' }[d.action];
        var color = { sync:'#8f89a8', overwrite:'#8fd6a8', keep:'#bfb9d4', merge:'#c9b6ff', conflict:'#ff9b9b' }[d.action];
        var choice = d.action === 'conflict'
          ? ' <label style="color:#e7c899"><input type="radio" name="c' + i + '" value="ours" checked>保留我的</label> <label style="color:#e7c899"><input type="radio" name="c' + i + '" value="theirs">用作者的</label>'
          : '';
        return '<div style="border-bottom:1px solid rgba(255,255,255,.06);padding:5px 0;">' +
          '<span style="color:' + color + '">● ' + label + '</span> · ' + esc(d.key) +
          (d.conflictKeys && d.conflictKeys.length ? ' <span style="color:#f0b0b0">冲突字段:' + d.conflictKeys.map(esc).join(',') + '</span>' : '') +
          choice + '</div>';
      }).join('');

      body.innerHTML =
        '<div style="background:rgba(244,216,150,.08);border:1px solid rgba(244,216,150,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;">' +
          '<div style="color:' + vcColor + '">版本检查：' + esc(vc.msg) + '</div>' +
          '<div style="margin-top:6px;">改动统计：' + sum.total + ' 项 · 覆盖 ' + sum.overwrite + ' · 合并 ' + sum.merge + ' · 保留 ' + sum.keep + ' · 已同步 ' + sum.sync + ' · <b style="color:#ff9b9b">冲突 ' + sum.conflict + '</b></div>' +
          (manifest.unscanned && manifest.unscanned.length ? '<div style="color:#8f89a8;font-size:12px;margin-top:6px;">发布方未纳入的类型：' + manifest.unscanned.map(function(u){return esc(u.kind||'?')}).join(', ') + '</div>' : '') +
        '</div>' +
        '<div style="max-height:320px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 12px;margin-bottom:14px;">' + (rows || '（无改动项）') + '</div>' +
        '<div style="font-size:12.5px;color:#bfb9d4;margin-bottom:12px;">安装前会自动<b>备份</b>将被改动的原始内容；装完若不满意可<b>一键回滚</b>。冲突项未选择则保持原样。</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button id="ins-apply" style="cursor:pointer;border:1px solid #f4d896;background:#f4d896;color:#1a1530;font-weight:700;border-radius:9px;padding:9px 18px;">备份并安装</button>' +
          '<button id="ins-rollback" style="cursor:pointer;border:1px solid rgba(244,216,150,.4);background:transparent;color:#e7c899;border-radius:9px;padding:9px 18px;">↩ 回滚到安装前</button>' +
        '</div>' +
        '<div id="ins-log" style="color:#8fd6a8;font-size:12.5px;margin-top:12px;line-height:1.8;"></div>';

      var log = document.getElementById('ins-log');
      var lastBackup = null;
      document.getElementById('ins-apply').onclick = function () {
        // 收集冲突裁决
        var resolutions = {};
        decisions.forEach(function (d, i) {
          if (d.action === 'conflict') {
            var sel = panel.querySelector('input[name="c' + i + '"]:checked');
            if (sel) resolutions[d.key] = sel.value;
          }
        });
        var ops = PE.applyList(decisions, resolutions);
        if (!ops.length) { log.style.color = '#f0c98f'; log.textContent = '没有需要应用的操作（可能全部已同步/保留/冲突未选）。'; return; }
        lastBackup = PE.makeBackup(decisions, 'install ' + new Date().toLocaleString());
        // 备份入栈（固定上限）
        var stack = [];
        try { stack = JSON.parse((globalThis.MoStore || localStorage).getItem(K_BACKUPS) || '[]'); } catch (e) {}
        stack = PE.pushBackup(stack, lastBackup);
        try { (globalThis.MoStore || localStorage).setItem(K_BACKUPS, JSON.stringify(stack)); } catch (e) {}
        var res = CA.apply(ops, CA.localWriter());
        if (res.errors.length) { log.style.color = '#ff9b9b'; log.textContent = '部分写入失败：' + res.errors.map(function(e){return e.key}).join(', '); return; }
        log.style.color = '#8fd6a8'; log.textContent = '✅ 已应用 ' + res.done.length + ' 项。原始内容已备份；若有问题点"回滚到安装前"。';
      };
      document.getElementById('ins-rollback').onclick = function () {
        var stack = [];
        try { stack = JSON.parse((globalThis.MoStore || localStorage).getItem(K_BACKUPS) || '[]'); } catch (e) {}
        if (!stack.length) { log.style.color = '#f0c98f'; log.textContent = '没有可回滚的备份。'; return; }
        var bak = stack[stack.length - 1];
        var res = CA.apply(PE.rollbackList(bak), CA.localWriter());
        stack.pop();
        try { (globalThis.MoStore || localStorage).setItem(K_BACKUPS, JSON.stringify(stack)); } catch (e) {}
        log.style.color = res.errors.length ? '#ff9b9b' : '#8fd6a8';
        log.textContent = res.errors.length ? ('回滚部分失败：' + res.errors.map(function(e){return e.key}).join(', ')) : ('↩ 已回滚 ' + res.done.length + ' 项到安装前。');
      };
    } catch (e) {
      body.innerHTML = '<span style="color:#ff9b9b">安装异常：' + esc((e && e.message) || e) + '</span>';
    }
  }
  CH._openInstall = openInstall;

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

  /* ---------- 本地基线（v6.5.0） ---------- */
  var K_BASE = 'yj_patch_baseline';
  var K_BACKUPS = 'yj_patch_backups';
  function readLocalBaseline() {
    try {
      var raw = (globalThis.MoStore || localStorage).getItem(K_BASE);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return Array.isArray(o.items) ? o.items : null;
    } catch (e) { return null; }
  }
  function writeLocalBaseline(items) {
    try {
      var PE = globalThis.PatchEngine;
      (globalThis.MoStore || localStorage).setItem(K_BASE, JSON.stringify(PE.baseline(window.YJ_VER || 'unknown', items)));
    } catch (e) {}
  }
  CH._readLocalBaseline = readLocalBaseline;
  CH._writeLocalBaseline = writeLocalBaseline;

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
        '作品以<b>增量补丁包</b>形式打包：以当前云境为基线，<b>只打包你改动过的部分</b>（新增/修改/删除），未动的不传。' +
        '覆盖 DLC/插件/小云工具/预设/世界书/世界/新内容/资源包/图片/视频/文件等；存档默认<b>剔除密钥</b>。token 永不入包。' +
        '<br>发布后落到创意工坊<b>唯一总文件夹</b> <code>community/works/时间戳-作品名/</code>，四段式说明（README.md）和包体（package.zip）<b>同处一个文件夹</b>，其它玩家在云境内即可一键下载安装。' +
      '</div>' +
      '<label style="display:block;font-size:12.5px;color:#c6c0d6;margin-bottom:6px;">作品名称</label>' +
      '<input id="wz-title" placeholder="例如：剑来·武夫境界增强版" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;margin-bottom:10px;">' +
      '<div style="font-size:11.5px;color:#8f89a8;margin:2px 0 10px;">以下四段为作品正文固定结构（简介 / 特点 / 二创内容 / 打包源码），缺一不可发布。</div>' +
      '<label style="display:block;font-size:12.5px;color:#c6c0d6;margin-bottom:6px;">① 简介（一句话概述，必填）</label>' +
      '<textarea id="wz-intro" rows="2" placeholder="例如：为剑来世界补充武夫十一境的完整突破体系。" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;resize:vertical;margin-bottom:10px;"></textarea>' +
      '<label style="display:block;font-size:12.5px;color:#c6c0d6;margin-bottom:6px;">② 特点（亮点，必填）</label>' +
      '<textarea id="wz-feature" rows="3" placeholder="例如：十一境数值细化；剑气长城地图考据；新增 8 个 DLC 词条。" style="width:100%;box-sizing:border-box;background:#16132e;border:1px solid rgba(244,216,150,.3);color:#efeaf8;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;resize:vertical;margin-bottom:10px;"></textarea>' +
      '<div style="background:rgba(201,182,255,.07);border:1px solid rgba(201,182,255,.22);border-radius:10px;padding:10px 13px;margin-bottom:10px;font-size:12px;color:#c9bfe0;line-height:1.8;">' +
        '<b style="color:#d9c9ff;">③ 二创内容</b>：发布时由系统自动比对基线生成改动清单（改了哪些 DLC / 世界书 / 预设 / 存档等），只读、不可手填。<br>' +
        '<b style="color:#d9c9ff;">④ 打包源码</b>：发布时自动打包你改动过的内容层明文（manifest + 逐项 JSON）为 package.zip，与四段式 README.md 一起放进 <code>community/works/时间戳-作品名/</code>。这是"玩家可继续修改的源码"，<b>不是</b>云境主程序 .js（浏览器读不到，主程序归开发者）。' +
      '</div>' +
      '<div style="background:rgba(220,80,80,.08);border:1px solid rgba(220,120,120,.3);border-radius:10px;padding:12px 14px;margin:12px 0;font-size:12.5px;color:#f0d7d7;line-height:1.9;">' +
        '<b style="color:#ff9b9b">发布前确认（四项必须全勾）</b>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我同意本作品以<b>开源、非盈利</b>方式公开分享</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我确认包内<b>不含</b>任何 API 密钥、密码或个人隐私</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我理解下载者需<b>自行承担风险</b>，谨防病毒/恶意代码，作者与云境开发者不担责</label>' +
        '<label style="display:block"><input type="checkbox" class="wz-ck"> 我已如实填写简介、特点，并理解二创内容与打包源码由系统自动生成</label>' +
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
    var intro = (document.getElementById('wz-intro').value || '').trim();
    var feature = (document.getElementById('wz-feature').value || '').trim();
    var cks = [].slice.call(document.querySelectorAll('.wz-ck'));
    if (!title) { log.style.color = '#ff9b9b'; log.textContent = '请填作品名称。'; return; }
    if (!intro) { log.style.color = '#ff9b9b'; log.textContent = '请填写①简介。'; return; }
    if (!feature) { log.style.color = '#ff9b9b'; log.textContent = '请填写②特点。'; return; }
    if (cks.length < 4 || cks.some(function (c) { return !c.checked; })) { log.style.color = '#ff9b9b'; log.textContent = '请勾选全部四项确认。'; return; }
    var tin = document.getElementById('wz-token-input');
    if (!GC.hasToken() && tin && tin.value.trim()) GC.setToken(tin.value.trim());
    if (!GC.hasToken()) { log.style.color = '#ff9b9b'; log.textContent = '请先填写 GitHub token。'; return; }

    try {
      var PE = globalThis.PatchEngine, CA = globalThis.ContentAdapters;
      if (!PE || !CA) { log.style.color = '#ff9b9b'; log.textContent = '补丁引擎未就绪，请刷新页面重试。'; return; }

      log.style.color = '#8fd6a8'; log.textContent = '① 正在采集本机二创内容…';
      var collected = CA.collect({});
      var items = collected.items || [];
      if (!items.length) { log.style.color = '#f0c98f'; log.textContent = '没有检测到改动过的内容。请先在云境里创建/修改 DLC、预设、世界书等内容再发布。'; return; }

      log.textContent = '② 正在比对基线，只挑改动项…';
      // 基线：优先读本机记录的官方基线；无则把当前采集项整体视为 add（首次发布退化为整包，符合 DR-049 兜底）
      var baseList = readLocalBaseline() || [];
      var changes = PE.diff(baseList, items);
      if (!baseList.length) changes = items.map(function (it) { return { op: 'add', key: it.key, kind: it.kind, baseHash: '', newHash: it.hash }; });
      if (!changes.length) { log.style.color = '#f0c98f'; log.textContent = '与基线相比没有改动，无需发布。'; return; }
      var itemMap = {}; items.forEach(function (it) { itemMap[it.key] = it; });
      // 逐改动项生成内容文件；delete 项写 tombstone
      var entries = [];
      var manifestChanges = [];
      changes.forEach(function (c, idx) {
        var fn = 'content/' + idx + '.json';
        var payload = c.op === 'delete' ? { key: c.key, kind: c.kind, data: PE.TOMB }
          : { key: c.key, kind: c.kind, data: (itemMap[c.key] || {}).data || '' };
        entries.push({ name: fn, data: JSON.stringify(payload) });
        manifestChanges.push({ op: c.op, key: c.key, kind: c.kind, baseHash: c.baseHash, newHash: c.newHash, file: fn });
      });
      var fullSize = entries.reduce(function (s, e) { return s + (e.data ? new Blob([e.data]).size : 0); }, 0);
      var vols = PE.suggestVolumes(fullSize);
      var containsSave = changes.some(function (c) { return c.kind === 'save'; });
      // 二创内容摘要（③段）：由改动清单自动生成，逐项 kind + key
      var kindCount = {};
      changes.forEach(function (c) { kindCount[c.kind] = (kindCount[c.kind] || 0) + 1; });
      var kindLabel = { dlc:'DLC', plugin:'插件', tool:'小云工具', save:'存档', preset:'预设', worldbook:'世界书', world:'世界', content:'新内容', pack:'资源包', image:'图片', video:'视频', file:'文件' };
      var contentLines = Object.keys(kindCount).map(function (k) { return (kindLabel[k] || k) + '×' + kindCount[k]; });
      var contentSummary = contentLines.join('；') + '\n' + changes.map(function (c) {
        return '· [' + (kindLabel[c.kind] || c.kind) + '] ' + c.key + '（' + c.op + '）';
      }).join('\n');
      var manifest = {
        app: 'yunjing-patch', schema: 3, title: title, note: intro,
        intro: intro, features: feature, contentSummary: contentSummary,
        baseVersion: (window.YJ_VER || 'unknown'), author: GC.getUser() || '',
        createdAt: new Date().toISOString(), license: '开源·非盈利',
        changes: manifestChanges, volumes: vols.count, containsSave: containsSave, stripKeys: true,
        unscanned: collected.unscanned || []
      };
      entries.unshift({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });

      log.textContent = '③ 正在扫描密钥/隐私…';
      var bad = scanSecrets(entries);
      if (bad.length) { log.style.color = '#ff9b9b'; log.textContent = '检测到疑似密钥/隐私字段，已中止：' + bad.join(', '); return; }

      log.textContent = '④ 正在打包（' + changes.length + ' 项改动' + (vols.needSplit ? '，分 ' + vols.count + ' 卷' : '') + '）…';
      var zip = await globalThis.ZipWriter.makeZip(entries);
      var b64 = bytesToBase64(zip);

      log.textContent = '⑤ 正在验证 GitHub 账号…';
      var who = await GC.whoami();
      if (!who.ok) { log.style.color = '#ff9b9b'; log.textContent = 'token 验证失败：' + (who.error || '请检查权限'); return; }
      GC.setUser(who.login);

      // 超过总分卷上限 → 不静默失败，明确提示改用网盘链接
      if (vols.overCap) {
        log.style.color = '#f0c98f';
        log.textContent = '作品体积过大（约 ' + Math.round(fullSize / 1024 / 1024) + 'MB，需 ' + vols.count + ' 卷，超过上限 ' + vols.count + '>32）。请改用网盘链接发布：把包下载到本地后上传网盘，在说明里贴链接。本次未上传。';
        return;
      }

      // 超过分卷上限 → 明确提示（works 每件作品单包，超大走外链），不静默失败
      if (vols.count > 1) {
        log.style.color = '#f0c98f';
        log.textContent = '作品体积较大（约 ' + Math.round(fullSize / 1024 / 1024) + 'MB），单文件建议 < 20MB。请把大图片/视频改为网盘外链写在特点里后再发布（文本/metadata 仍可打包）。本次未上传。';
        return;
      }

      log.textContent = '⑥ 正在写入创意工坊 community/works/…';
      var ts = Date.now();
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var d = new Date(ts);
      var stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
      var slug = stamp + '-' + String(title || 'work').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 20);
      var hash = PE.hash(zip && zip.length ? String(zip.length) : String(fullSize));
      // ④ 打包源码段：可读文件清单 + 路径 + 哈希
      var pkgMeta = {
        dir: GC.WORKS_DIR + '/' + slug,
        files: ['package.zip'],
        innerFiles: entries.map(function (e) { return e.name; }),
        path: GC.WORKS_DIR + '/' + slug + '/package.zip',
        size: zip ? zip.length : fullSize,
        hash: hash,
        note: '内容层明文源码（manifest + 逐项 JSON），非云境主程序 .js'
      };
      // README.md = 四段式正文（玩家直接可读），与 package.zip 同处一个文件夹
      var readme = PE.buildFourSectionBody({ intro: intro, feature: feature, content: contentSummary, pkg: pkgMeta }) +
        '\n\n---\n由云境·二创版块自动发布 · 四段式(schema 3) · 基于云境 v' + (window.YJ_VER || '?') + ' · 唯一区域 community/works/ · 开源非盈利 · 风险自负\n' +
        (containsSave ? '> ⚠ 本作品含私密存档，密钥已剔除；如需完整存档请向作者另行索取。\n' : '');
      var meta = {
        title: title, author: GC.getUser() || '匿名', createdAt: new Date(ts).toISOString(),
        baseVersion: window.YJ_VER || 'unknown', license: '开源·非盈利',
        slug: slug, package: 'package.zip', size: zip ? zip.length : fullSize, hash: hash,
        changes: manifest.changes.length, containsSave: !!containsSave
      };
      var toB64 = function (textOrBytes) {
        var u8 = typeof textOrBytes === 'string' ? new TextEncoder().encode(textOrBytes) : textOrBytes;
        var chunk = 0x8000, ss = [];
        for (var i = 0; i < u8.length; i += chunk) ss.push(String.fromCharCode.apply(null, u8.subarray(i, i + chunk)));
        return btoa(ss.join(''));
      };
      var files = [
        { name: 'README.md', b64: toB64(readme) },
        { name: 'meta.json', b64: toB64(JSON.stringify(meta, null, 2)) },
        { name: 'package.zip', b64: bytesToBase64(zip) }
      ];
      var pub = await GC.publishWork(
        { slug: slug, title: title, author: GC.getUser() || '匿名', createdAt: meta.createdAt,
          summary: intro, size: meta.size, hash: hash },
        files
      );
      if (pub.ok) {
        log.style.color = '#8fd6a8'; log.textContent = '✅ 发布成功！作品已存入 community/works/' + slug + '/，四段式说明与包体同处，其它玩家可在云境内一键下载安装。';
        setTimeout(function () { document.getElementById('ch-wizard').style.display = 'none'; renderList(); }, 2200);
      } else {
        log.style.color = '#ff9b9b'; log.textContent = '发布失败：' + (pub.error || '未知错误') + '（token 需有 Contents 读写权限）。';
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
  CH._parseSections = parseSections;
  globalThis.CreationHub = CH;
  if (typeof module !== 'undefined' && module.exports) module.exports = CH;
})();
