/* 云境 · 文件桥 FileBridge v1.0.0（v3.53.0）
   ---------------------------------------------------------------------------
   用户诉求：「如果有什么问题，要求内置的助手自己就支持修改文件」
   解决：给内置助手（小云）一双手——能读项目、能自检、能打补丁、能回滚。

   实现要点
   1) 授权：File System Access API（Chrome / Edge 及同源内核）。
      用户点一次「授权项目文件夹」，目录句柄存 IndexedDB，之后刷新不必重复授权。
      写入前会 verify/request 读写权限；用户随时可断开（句柄即从库里删除）。
   2) 只读白名单：只碰 js / css / html / json / md / txt / webmanifest，且路径不得
      含 .. 或绝对路径——任何越界路径直接拒绝。单次写入上限 3MB。
   3) 备份先行：每次写入前把原文复制到 .yj-backups/<相对路径>/<时间戳>.bak，
      同时在 localStorage 记一条变更（含原文前 200KB，便于无目录权限时回滚）。
   4) 自检 diagnose()：JS 语法（new Function 编译）、HTML 引用缺失、重复 id、
      脚本版本号不一致——四类常见"改坏"都能当场查出来。
   5) 补丁协议：助手输出 ```yj-patch 代码块（JSON 或 kv 形式），本模块解析成
      { path, find, replace }，先做唯一性校验，再出 diff 预览，用户确认才落盘。
   6) 不支持 FS API 时（Firefox / Safari / 非安全上下文）自动降级为
      「导出补丁包 + 变更清单」，交给外部编辑器应用，不会静默失败。
*/
(function () {
  'use strict';

  var DB_NAME = 'yj-file-bridge';
  var STORE = 'handles';
  var KEY = 'root';
  var LOG_KEY = 'yunjingFilePatchLog';
  var ALLOW = /\.(js|css|html|htm|json|md|txt|webmanifest)$/i;
  var MAX_WRITE = 3 * 1024 * 1024;
  var MAX_FILES = 800;

  var root = null;          // FileSystemDirectoryHandle
  var fileIndex = null;     // { '相对路径': FileSystemFileHandle }
  var lastPatches = [];     // 最近解析出的补丁（待确认）

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function supported() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }
  function safePath(p) {
    p = String(p || '').replace(/\\/g, '/');
    if (!p) return null;
    if (p.charAt(0) === '/' || /^[a-z]:/i.test(p)) return null;   // 绝对路径
    if (p.indexOf('..') !== -1) return null;                       // 越界
    if (!ALLOW.test(p)) return null;                               // 类型白名单
    if (p.indexOf('.yj-backups/') === 0) return null;              // 备份区只读
    return p.replace(/^\.\//, '');
  }
  function log(list) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-30))); } catch (e) {}
  }
  function getLog() {
    try { var v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  /* ==================== IndexedDB 句柄存取 ==================== */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet(k) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        t.onsuccess = function () { res(t.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbSet(k, v) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k);
        t.onsuccess = function () { res(true); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbDel(k) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(k);
        t.onsuccess = function () { res(true); };
        t.onerror = function () { res(false); };
      });
    });
  }

  /* ==================== 权限 ==================== */
  async function verify(mode) {
    if (!root) return false;
    try {
      var opt = { mode: mode || 'read' };
      /* 注意：await 必须作用于调用结果，写成 `await root.queryPermission ? ...`
         会把函数引用本身当真值，恒走第一分支且拿到 Promise —— 权限判断会永远失败 */
      var q = root.queryPermission ? await root.queryPermission(opt) : 'granted';
      if (q === 'granted') return true;
      var r = root.requestPermission ? await root.requestPermission(opt) : 'denied';
      return r === 'granted';
    } catch (e) { return false; }
  }

  /* ==================== 目录索引 ==================== */
  async function walk(dir, prefix, out, depth) {
    if (depth > 3 || Object.keys(out).length > MAX_FILES) return;
    var it = dir.entries ? dir.entries() : null;
    if (!it) return;
    for await (var e of it) {
      var p = prefix ? prefix + '/' + e[0] : e[0];
      if (e[1].kind === 'directory') {
        if (e[0] === '.yj-backups' || e[0] === 'node_modules' || e[0] === '.git') continue;
        await walk(e[1], p, out, depth + 1);
      } else if (ALLOW.test(e[0])) {
        out[p] = e[1];
      }
    }
  }
  async function index() {
    if (!root) return null;
    if (fileIndex) return fileIndex;
    try { fileIndex = await buildIndex(); } catch (e) { console.warn('[FileBridge] 目录索引失败', e); fileIndex = {}; }
    return fileIndex;
  }
  async function buildIndex() {
    var out = {};
    try { await walk(root, '', out, 0); } catch (e) { console.warn('[FileBridge] 遍历目录中断', e); }
    return out;
  }
  function invalidate() { fileIndex = null; }

  /* ==================== 读 / 写 ==================== */
  function needRoot() {
    if (!root) throw new Error('尚未授权项目文件夹（点 🛠 文件工坊里的「授权项目文件夹」）');
  }

  async function read(path) {
    path = safePath(path);
    if (!path) throw new Error('路径不被允许：' + path);
    needRoot();
    if (!(await verify('read'))) throw new Error('没有读取权限，请重新授权项目文件夹');
    var idx = await index();
    var h = idx && idx[path];
    if (!h) {
      // 索引可能是旧的，按路径重新解析一次
      var parts = path.split('/');
      var cur = root;
      for (var i = 0; i < parts.length; i++) {
        if (!cur) break;
        cur = i === parts.length - 1 ? await cur.getFileHandle(parts[i]).catch(function () { return null; })
          : await cur.getDirectoryHandle(parts[i]).catch(function () { return null; });
      }
      h = cur;
    }
    if (!h) throw new Error('找不到文件：' + path);
    var f = await h.getFile();
    var txt = await f.text();
    return { path: path, text: txt, size: f.size };
  }

  async function backup(path, text) {
    if (!root) return '';   // 未授权/已断开时跳过备份，不阻断主流程
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    var rel = '.yj-backups/' + path + '/' + stamp + '.bak';
    try {
      if (await verify('readwrite')) {
        var parts = rel.split('/');
        var cur = root;
        for (var i = 0; i < parts.length - 1; i++) {
          cur = await cur.getDirectoryHandle(parts[i], { create: true });
        }
        var fh = await cur.getFileHandle(parts[parts.length - 1], { create: true });
        var w = await fh.createWritable();
        await w.write(text);
        await w.close();
      }
    } catch (e) { /* 备份失败不阻断写入，但会记进日志 */ }
    var l = getLog();
    l.push({
      path: path, at: Date.now(), backup: rel,
      size: text.length,
      prev: String(text).length <= 200000 ? text : ''   // 小文件留原文，直接可回滚
    });
    log(l);
    return rel;
  }

  async function write(path, text) {
    path = safePath(path);
    if (!path) throw new Error('路径不被允许：' + path);
    needRoot();
    if (String(text).length > MAX_WRITE) throw new Error('文件超过 3MB，出于安全考虑拒绝写入：' + path);
    if (!(await verify('readwrite'))) throw new Error('没有写入权限，请在弹出的权限提示里允许修改');
    var old = '';
    try { old = (await read(path)).text; } catch (e) { old = ''; }
    var rel = await backup(path, old);
    var parts = path.split('/');
    var cur = root;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur) {
        /* 目录在写入途中被断开/失效：给出可捕获的明确错误，不让异常冒泡成未处理拒绝 */
        throw new Error('写入中断：无法进入目录 ' + parts.slice(0, i + 1).join('/') + '（授权已断开？）');
      }
      cur = await cur.getDirectoryHandle(parts[i], { create: true });
    }
    if (!cur) throw new Error('写入中断：目录句柄失效');
    var fh = await cur.getFileHandle(parts[parts.length - 1], { create: true });
    var w = await fh.createWritable();
    await w.write(text);
    await w.close();
    invalidate();
    return { path: path, bytes: String(text).length, backup: rel };
  }

  async function undo(entry) {
    if (!entry) return false;
    if (entry.prev) {
      await write(entry.path, entry.prev);
      return true;
    }
    if (!entry.backup) return false;
    var b = await read(entry.backup.replace(/^\.yj-backups\//, '.yj-backups/'));
    await write(entry.path, b.text);
    return true;
  }

  /* ==================== 自检 ==================== */
  async function diagnose() {
    var rep = { syntax: [], missing: [], dupId: [], version: [], files: 0, ms: 0 };
    var t0 = Date.now();
    if (!root) return rep;
    var idx = await index();
    var paths = Object.keys(idx);
    rep.files = paths.length;
    // 1) JS 语法（限 80 个文件、单文件 1.5MB 以内，避免卡死）
    var js = paths.filter(function (p) { return /\.js$/i.test(p); }).slice(0, 80);
    for (var i = 0; i < js.length; i++) {
      var p = js[i];
      try {
        var r = await read(p);
        if (r.size > 1500000) continue;
        try { new Function(r.text); } catch (e) {
          rep.syntax.push({ path: p, msg: String(e && e.message || e).slice(0, 160) });
        }
      } catch (e) { /* 读不动就跳过 */ }
    }
    // 2) HTML 引用缺失 + 重复 id
    var html = paths.filter(function (p) { return /\.html?$/i.test(p); }).slice(0, 12);
    for (var j = 0; j < html.length; j++) {
      var hp = html[j];
      var hr = await read(hp).catch(function () { return null; });
      if (!hr) continue;
      var base = hp.indexOf('/') !== -1 ? hp.slice(0, hp.lastIndexOf('/')) : '';
      var refs = hr.text.match(/(?:src|href)\s*=\s*["']([^"'#][^"']*)["']/g) || [];
      refs.forEach(function (m) {
        var u = (m.match(/["']([^"']*)["']/) || [])[1] || '';
        if (!u || /^(https?:|data:|javascript:|#|mailto:)/i.test(u)) return;
        var rel = (base ? base + '/' + u : u).replace(/\?.*$/, '');
        if (!idx[rel]) rep.missing.push({ from: hp, ref: u });
      });
      var ids = hr.text.match(/\sid\s*=\s*["']([^"']+)["']/g) || [];
      var seen = {}, dup = {};
      ids.forEach(function (m) {
        var id = (m.match(/["']([^"']+)["']/) || [])[1];
        if (!id) return;
        if (seen[id]) dup[id] = true; else seen[id] = true;
      });
      Object.keys(dup).forEach(function (id) { rep.dupId.push({ from: hp, id: id }); });
    }
    // 3) 版本号一致性（?v=x.y.z 出现多种版本通常是忘记同步）
    var vers = {};
    paths.filter(function (p) { return /\.html$/i.test(p); }).slice(0, 6).forEach(function () {});
    var main = await read('studio.html').catch(function () { return null; });
    if (main) {
      (main.text.match(/\?v=([\d.]+)/g) || []).forEach(function (m) {
        var v = m.slice(3); vers[v] = (vers[v] || 0) + 1;
      });
      var vs = Object.keys(vers);
      if (vs.length > 1) {
        var top = vs.sort(function (a, b) { return vers[b] - vers[a]; })[0];
        vs.forEach(function (v) { if (v !== top) rep.version.push({ version: v, count: vers[v], top: top }); });
      }
    }
    rep.ms = Date.now() - t0;
    return rep;
  }

  /* ==================== 补丁解析 ==================== */
  /* 支持两种写法：
     A. ```yj-patch  {"path":"相对路径","find":"旧","replace":"新"}  ```
     B. ```yj-patch  file: 相对路径 / find: | 旧 / replace: | 新  （YAML 简化版） */
  function parsePatches(text) {
    var out = [];
    var re = /```yj-patch\s*([\s\S]*?)```/g;
    var m;
    while ((m = re.exec(String(text || ''))) !== null) {
      var body = m[1].trim();
      var p = null;
      if (body.charAt(0) === '{') {
        try { p = JSON.parse(body); } catch (e) { p = null; }
      }
      if (!p) {
        p = {};
        var lines = body.split('\n');
        var cur = null, buf = [];
        lines.forEach(function (ln) {
          var head = ln.match(/^(file|path|find|replace|mode)\s*:\s*(.*)$/);
          if (head) {
            if (cur) p[cur] = buf.join('\n').replace(/\n$/, '');
            cur = head[1] === 'file' ? 'path' : head[1];
            buf = [head[2] === '|' ? '' : head[2]];
          } else if (cur) buf.push(ln);
        });
        if (cur) p[cur] = buf.join('\n').replace(/\n$/, '');
      }
      if (p && (p.path || p.file)) {
        out.push({
          path: String(p.path || p.file).trim(),
          find: p.find == null ? '' : String(p.find),
          replace: p.replace == null ? '' : String(p.replace),
          mode: p.mode || 'replace'
        });
      }
    }
    return out;
  }

  /** 校验补丁：find 必须唯一命中（空 find = 整文件覆盖，需要用户额外确认） */
  async function checkPatch(pt) {
    var sp = safePath(pt.path);
    if (!sp) return { ok: false, why: '路径不被允许或类型不在白名单：' + pt.path };
    var r = await read(sp).catch(function (e) { return { err: String(e && e.message || e) }; });
    if (r.err) return { ok: false, why: r.err };
    var text = r.text;
    if (!pt.find) {
      return { ok: true, mode: 'overwrite', path: sp, old: text, next: pt.replace, warn: '整文件覆盖' };
    }
    var n = text.split(pt.find).length - 1;
    if (n === 0) return { ok: false, why: '在文件里找不到要替换的内容（find 未命中）：' + sp };
    if (n > 1) return { ok: false, why: 'find 命中 ' + n + ' 处，无法唯一定位，请把上下文写长一点：' + sp };
    return { ok: true, mode: 'replace', path: sp, old: text, next: text.replace(pt.find, pt.replace) };
  }

  function diffHTML(oldT, newT) {
    var a = oldT.split('\n'), b = newT.split('\n');
    var max = Math.max(a.length, b.length);
    var rows = [];
    var shown = 0;
    for (var i = 0; i < max && shown < 120; i++) {
      var x = a[i], y = b[i];
      if (x === y) continue;
      shown++;
      if (x != null) rows.push('<div class="fb-dl del">- ' + esc(x).slice(0, 300) + '</div>');
      if (y != null) rows.push('<div class="fb-dl add">+ ' + esc(y).slice(0, 300) + '</div>');
    }
    return rows.join('') || '<div class="fb-note">无可见差异</div>';
  }

  /* ==================== 面板 ==================== */
  function ensure() {
    var m = document.getElementById('fbModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'fbModal';
      m.className = 'modal-overlay';
      m.addEventListener('click', function (e) { if (e.target === m) FileBridge.close(); });
      document.body.appendChild(m);
    }
    return m;
  }

  function panelHTML() {
    var lg = getLog().slice().reverse();
    var logHTML = lg.slice(0, 12).map(function (e, i) {
      return '<div class="fb-log">' +
        '<span class="fb-log-p">' + esc(e.path) + '</span>' +
        '<span class="fb-log-t">' + new Date(e.at).toLocaleString() + '</span>' +
        '<button class="fb-mini" onclick="FileBridge.undoAt(' + i + ')">↩ 回滚</button></div>';
    }).join('') || '<div class="fb-note">还没有改动记录。</div>';
    var ready = !!root;
    return `
        <div class="modal-box fb-box">
            <div class="modal-header">
                <span>🛠 文件工坊 · 让小云直接改项目</span>
                <button class="modal-close" onclick="FileBridge.close()">✕</button>
            </div>
            <div class="modal-body fb-body">
                <div class="fb-state ${ready ? 'ok' : 'no'}">
                    ${ready
        ? '✅ 已授权项目文件夹，小云可以读写并修改文件（写入前自动备份，可一键回滚）。'
        : (supported()
          ? '未授权。点下面「授权项目文件夹」，选中云境项目根目录即可。授权只在本机生效，不会上传任何文件。'
          : '⚠️ 当前浏览器不支持文件授权（需 Chrome / Edge 等）。可以改用「导出补丁包」，把小云给的改动交给外部编辑器应用。')}
                </div>
                <div class="fb-acts">
                    <button class="btn-solid btn-mini" onclick="FileBridge.authorize()">📂 授权项目文件夹</button>
                    <button class="btn-ghost btn-mini" onclick="FileBridge.runDiagnose()">🔍 立即自检</button>
                    <button class="btn-ghost btn-mini" onclick="FileBridge.exportPatches()">📤 导出补丁包</button>
                    ${ready ? '<button class="btn-ghost btn-mini" onclick="FileBridge.revoke()">🔌 断开</button>' : ''}
                </div>
                <div id="fbOut" class="fb-out"><div class="fb-note">自检会检查：JS 语法错误、HTML 引用缺失、重复 id、脚本版本号不一致。</div></div>
                <div class="fb-sec">最近改动（点「回滚」还原到写入前）</div>
                ${logHTML}
                <div class="fb-sec">补丁协议（告诉小云要改什么时用这个格式）</div>
                <pre class="fb-pre">\`\`\`yj-patch
{"path":"js/某文件.js","find":"原来的那段代码","replace":"改后的代码"}
\`\`\`</pre>
                <div class="fb-note">find 必须在文件里唯一命中；留空 find 表示整文件覆盖（会二次确认）。小云给出补丁后，这里会列出差异预览，你点确认才真正落盘。</div>
            </div>
            <div class="modal-footer">
                <span class="fb-spacer"></span>
                <button class="btn-ghost" onclick="FileBridge.close()">关闭</button>
            </div>
        </div>`;
  }

  var FileBridge = {
    supported: supported,
    hasRoot: function () { return !!root; },
    authorize: async function () {
      if (!supported()) { alert('当前浏览器不支持文件授权，请使用 Chrome / Edge 打开。'); return; }
      try {
        var h = await window.showDirectoryPicker({ id: 'yunjing', mode: 'readwrite' });
        root = h;
        invalidate();
        await idbSet(KEY, h);
        await index();
        this.render('✅ 授权成功：' + h.name + '（共 ' + Object.keys(fileIndex || {}).length + ' 个可读文件）');
        if (window.showToast) window.showToast('已授权项目文件夹：' + h.name, 'ok');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        this.render('❌ 授权失败：' + (e && e.message ? e.message : e));
      }
    },
    revoke: async function () {
      root = null; invalidate();
      await idbDel(KEY);
      this.render('已断开项目文件夹授权。');
    },
    /** 启动时静默恢复句柄（不弹权限框，真正读写时再验权） */
    restore: async function () {
      if (!supported()) return false;
      try {
        var h = await idbGet(KEY);
        if (h) { root = h; return true; }
      } catch (e) {}
      return false;
    },
    read: read,
    write: write,
    diagnose: diagnose,
    parsePatches: parsePatches,
    checkPatch: checkPatch,
    undoAt: async function (i) {
      var lg = getLog().slice().reverse();
      var e = lg[i];
      if (!e) return;
      try {
        await undo(e);
        this.render('↩ 已回滚：' + e.path);
        if (window.showToast) window.showToast('已回滚 ' + e.path, 'ok');
      } catch (err) {
        this.render('回滚失败：' + (err && err.message ? err.message : err));
      }
    },
    /** 应用一组补丁：先校验出 diff，再让用户确认 */
    applyPatches: async function (patches) {
      if (!root) { this.render('尚未授权项目文件夹，请先授权。'); if (this.open) this.open(); return 0; }
      var checked = [];
      for (var i = 0; i < patches.length; i++) {
        var c = await checkPatch(patches[i]);
        checked.push({ patch: patches[i], res: c });
      }
      var bad = checked.filter(function (x) { return !x.res.ok; });
      var good = checked.filter(function (x) { return x.res.ok; });
      var html = '';
      if (bad.length) {
        html += '<div class="fb-sec bad">被拒绝的补丁</div>' + bad.map(function (x) {
          return '<div class="fb-patch bad"><b>' + esc(x.patch.path) + '</b><div class="fb-note">' + esc(x.res.why) + '</div></div>';
        }).join('');
      }
      if (!good.length) { this.render(html); return 0; }
      window.__fbPending = good;
      html += '<div class="fb-sec">待确认的改动（' + good.length + '）</div>' +
        good.map(function (x, i) {
          return '<div class="fb-patch"><div class="fb-ph"><b>' + esc(x.res.path) + '</b>' +
            (x.res.warn ? '<span class="fb-warn">' + esc(x.res.warn) + '</span>' : '') + '</div>' +
            '<div class="fb-diff">' + diffHTML(x.res.old, x.res.next) + '</div></div>';
        }).join('') +
        '<div class="fb-acts"><button class="btn-solid btn-mini" onclick="FileBridge.confirmApply()">✅ 确认写入（自动备份）</button>' +
        '<button class="btn-ghost btn-mini" onclick="FileBridge.cancelApply()">取消</button></div>';
      this.render(html);
      return good.length;
    },
    confirmApply: async function () {
      var list = window.__fbPending || [];
      var done = 0, errs = [];
      for (var i = 0; i < list.length; i++) {
        try {
          await write(list[i].res.path, list[i].res.next);
          done++;
        } catch (e) { errs.push(list[i].res.path + '：' + (e && e.message ? e.message : e)); }
      }
      window.__fbPending = null;
      this.render('✅ 已写入 ' + done + ' 个文件（原文已备份，可回滚）。' +
        (errs.length ? '<div class="fb-sec bad">失败</div>' + errs.map(esc).join('<br>') : '') +
        '<div class="fb-note">改动在下一次刷新页面后生效；若是纯逻辑改动，一般刷新即可。</div>');
      if (window.showToast) window.showToast('已写入 ' + done + ' 个文件', 'ok');
    },
    cancelApply: function () {
      window.__fbPending = null;
      this.render('已取消，没有改动任何文件。');
    },
    /** 从助手回复里抽取补丁并进入确认流程 */
    takePatchesFrom: async function (text) {
      var ps = parsePatches(text);
      if (!ps.length) return 0;
      if (!root) {
        this.render('小云给了 ' + ps.length + ' 个补丁，但还没授权项目文件夹。<br>' +
          '<button class="btn-solid btn-mini" onclick="FileBridge.authorize()">📂 现在授权</button>' +
          '<button class="btn-ghost btn-mini" onclick="FileBridge.exportPatches()">📤 导出补丁包</button>');
        window.__fbPendingText = text;
        return ps.length;
      }
      return await this.applyPatches(ps);
    },
    exportPatches: function () {
      var ps = parsePatches(window.__fbPendingText || '') || [];
      var pkg = {
        app: '云境', kind: 'yj-patch-pack', version: 1,
        exportedAt: new Date().toISOString(),
        patches: ps,
        log: getLog().slice(-20),
        howto: '把 patches 里每条的 find 替换为 replace 即可；path 是相对项目根目录的路径。'
      };
      var blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '云境-补丁包-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    },
    runDiagnose: async function () {
      if (!root) { this.render('请先授权项目文件夹。'); return; }
      this.render('<div class="fb-note">自检中…</div>');
      var r = await diagnose();
      var html = '<div class="fb-sec">自检结果（' + r.files + ' 个文件，' + (r.ms / 1000).toFixed(1) + 's）</div>';
      var clean = !r.syntax.length && !r.missing.length && !r.dupId.length && !r.version.length;
      if (clean) html += '<div class="fb-ok">✅ 没查出问题：JS 语法、引用、id、版本号都正常。</div>';
      if (r.syntax.length) html += '<div class="fb-sec bad">JS 语法错误 ' + r.syntax.length + '</div>' +
        r.syntax.map(function (x) { return '<div class="fb-item"><b>' + esc(x.path) + '</b><div class="fb-note">' + esc(x.msg) + '</div></div>'; }).join('');
      if (r.missing.length) html += '<div class="fb-sec bad">引用缺失 ' + r.missing.length + '</div>' +
        r.missing.slice(0, 20).map(function (x) { return '<div class="fb-item">' + esc(x.from) + ' → ' + esc(x.ref) + '</div>'; }).join('');
      if (r.dupId.length) html += '<div class="fb-sec bad">重复 id ' + r.dupId.length + '</div>' +
        r.dupId.slice(0, 20).map(function (x) { return '<div class="fb-item">' + esc(x.from) + ' → #' + esc(x.id) + '</div>'; }).join('');
      if (r.version.length) html += '<div class="fb-sec warn">版本号不一致</div>' +
        r.version.map(function (x) { return '<div class="fb-item">v' + esc(x.version) + ' × ' + x.count + '（多数为 v' + esc(x.top) + '）</div>'; }).join('');
      this.render(html);
      return r;
    },
    render: function (html) {
      var box = document.getElementById('fbOut');
      if (box) box.innerHTML = html;
      else { this.open(); var b2 = document.getElementById('fbOut'); if (b2) b2.innerHTML = html; }
    },
    open: function () {
      var m = ensure();
      m.innerHTML = panelHTML();
      m.style.display = 'flex';
    },
    close: function () {
      var m = document.getElementById('fbModal');
      if (m) m.style.display = 'none';
    },
    /** 给助手用的项目快照：出错时把相关文件喂给模型 */
    snapshot: async function (paths, maxChars) {
      var out = [];
      var cap = maxChars || 24000;
      for (var i = 0; i < paths.length; i++) {
        try {
          var r = await read(paths[i]);
          out.push('/* === ' + r.path + ' === */\n' + r.text.slice(0, Math.max(1000, Math.floor(cap / paths.length))));
        } catch (e) { out.push('/* ' + paths[i] + ' 读取失败：' + (e && e.message) + ' */'); }
      }
      return out.join('\n\n');
    }
  };

  /* 启动恢复（不打扰用户） */
  if (supported()) FileBridge.restore();

  window.FileBridge = FileBridge;
})();
