/* ============================================================
 * 云境 · GitHub 多线路客户端 v1.0（v6.4.0 二创版块）
 * ------------------------------------------------------------
 * 用途：二创投稿（公开 Gist 存包 + Issue 列表/创建）、存档云同步底座。
 * 国内直连 api.github.com 常断 → 多线路镜像 + 指数退避重试 + 断网本地队列。
 * token 只存本地 localStorage，绝不写入任何包体或 Issue 正文。
 * 版权：云境独立实现，无第三方源码。
 * ============================================================ */
(function () {
  'use strict';

  var K_TOKEN = 'yj_fanwork_gh_token';
  var K_USER = 'yj_fanwork_gh_user';
  var K_REPO = 'yj_fanwork_repo';
  var K_QUEUE = 'yj_fanwork_queue';
  var DEF_REPO = { owner: 'AYun07', repo: 'yunjing' };
  var LABEL = '二创投稿';

  /* 多线路：官方 + 常见国内镜像（镜像仅用于 GET 列表，写操作必须官方直连） */
  var READ_BASES = [
    'https://api.github.com',
    'https://ghproxy.net/https://api.github.com',
    'https://gh-proxy.com/https://api.github.com',
    'https://api.github.com'   // 末尾再给官方一次机会
  ];
  var WRITE_BASE = 'https://api.github.com';

  function store() { return window.MoStore || window.localStorage; }
  function getToken() { try { return store().getItem(K_TOKEN) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { store().setItem(K_TOKEN, String(t || '').trim()); } catch (e) {} }
  function getUser() { try { return store().getItem(K_USER) || ''; } catch (e) { return ''; } }
  function setUser(u) { try { store().setItem(K_USER, String(u || '').trim()); } catch (e) {} }
  function repo() {
    try { var r = JSON.parse(store().getItem(K_REPO) || 'null'); if (r && r.owner && r.repo) return r; } catch (e) {}
    return DEF_REPO;
  }
  function setRepo(owner, name) {
    try { store().setItem(K_REPO, JSON.stringify({ owner: String(owner).trim(), repo: String(name).trim() })); } catch (e) {}
  }
  function hasToken() { return !!getToken(); }
  function clearToken() { try { store().removeItem(K_TOKEN); store().removeItem(K_USER); } catch (e) {} }

  function headers(json) {
    var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** 单条 fetch，带超时 */
  async function once(url, opt, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 12000) : null;
    try {
      var r = await fetch(url, Object.assign({}, opt, ctl ? { signal: ctl.signal } : {}));
      return r;
    } finally { if (timer) clearTimeout(timer); }
  }

  /** 读操作：多线路 + 重试，返回 {ok,data,status,line} */
  async function read(path) {
    var lastErr = null;
    for (var li = 0; li < READ_BASES.length; li++) {
      var base = READ_BASES[li];
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          var r = await once(base + path, { method: 'GET', headers: headers(false) }, 12000);
          if (r.ok) {
            var data = await r.json();
            return { ok: true, data: data, status: r.status, line: base };
          }
          if (r.status === 403 || r.status === 404) {
            var txt = ''; try { txt = await r.text(); } catch (e) {}
            return { ok: false, status: r.status, error: txt.slice(0, 200), line: base };
          }
          lastErr = 'HTTP ' + r.status;
        } catch (e) { lastErr = (e && e.message) || '网络错误'; }
        await sleep(400 * (attempt + 1));
      }
    }
    return { ok: false, error: lastErr || '所有线路均失败' };
  }

  /** 写操作：官方直连 + 指数退避重试 */
  async function write(url, method, body) {
    var lastErr = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var r = await once(url, {
          method: method,
          headers: headers(!!body),
          body: body ? JSON.stringify(body) : undefined
        }, 15000);
        if (r.ok || r.status === 201) return { ok: true, data: await r.json(), status: r.status };
        if (r.status === 401 || r.status === 403) {
          return { ok: false, status: r.status, error: 'token 无效或权限不足' };
        }
        if (r.status === 422) {
          return { ok: false, status: 422, error: (await r.text()).slice(0, 300) };
        }
        lastErr = 'HTTP ' + r.status;
      } catch (e) { lastErr = (e && e.message) || '网络错误'; }
      await sleep(600 * Math.pow(2, attempt));
    }
    return { ok: false, error: lastErr || '写入失败' };
  }

  /* ---------- Gist：存包体 ---------- */
  /** 创建公开 gist 存 zip 的 base64；返回 {ok,url,rawUrl,id} */
  async function createGist(filename, base64, description) {
    var body = {
      description: description || '云境二创作品包',
      public: true,
      files: {}
    };
    body.files[filename] = { content: base64 };
    var r = await write(WRITE_BASE + '/gists', 'POST', body);
    if (!r.ok) return r;
    var files = r.data.files || {};
    var f = files[filename] || Object.values(files)[0] || {};
    return { ok: true, id: r.data.id, url: r.data.html_url, rawUrl: f.raw_url || '', data: r.data };
  }

  /* ---------- Gist 下载 / 私密 Gist（v6.5.0 增量补丁） ---------- */
  /** 下载 Gist raw 文本（包体 base64）；走多线路镜像把 raw.githubusercontent.com / gist.githubusercontent.com 也可达 */
  async function downloadGistRaw(rawUrl) {
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return { ok: false, error: '非法下载地址' };
    var bases = [
      rawUrl,
      'https://ghproxy.net/' + rawUrl,
      'https://gh-proxy.com/' + rawUrl
    ];
    var lastErr = null;
    for (var i = 0; i < bases.length; i++) {
      try {
        var r = await once(bases[i], { method: 'GET', headers: { 'Accept': '*/*' } }, 20000);
        if (r.ok) {
          // v6.5.1：包体可能存为原始 zip 二进制（contents API 解码 b64 后所得），
          // 也可能存为 b64 文本（旧版 Gist）。同时返回文本与字节，由上层按魔数判定。
          var ab = null;
          try { ab = await r.arrayBuffer(); } catch (e) {}
          var text = ab ? (function (u8) { var s = ''; for (var j = 0; j < u8.length; j++) s += String.fromCharCode(u8[j]); return s; })(new Uint8Array(ab)) : await r.text();
          return { ok: true, text: text, bytes: ab ? new Uint8Array(ab) : null, line: bases[i] };
        }
        lastErr = 'HTTP ' + r.status;
      } catch (e) { lastErr = (e && e.message) || '网络错误'; }
    }
    return { ok: false, error: lastErr || '下载失败' };
  }

  /** 创建私密 Gist（含密钥的存档专用；public=false） */
  async function createPrivateGist(filename, content, description) {
    var body = { description: description || '云境私密存档包（含密钥，仅本人可见）', public: false, files: {} };
    body.files[filename] = { content: content };
    var r = await write(WRITE_BASE + '/gists', 'POST', body);
    if (!r.ok) return r;
    var files = r.data.files || {};
    var f = files[filename] || Object.values(files)[0] || {};
    return { ok: true, id: r.data.id, url: r.data.html_url, rawUrl: f.raw_url || '', data: r.data };
  }

  /** 解析作品 Issue body 里的分卷清单标记 <!--YJ_VOLUMES-->{"parts":[...]}<!--/YJ_VOLUMES--> */
  function parseVolumes(body) {
    var m = String(body || '').match(/<!--YJ_VOLUMES-->([\s\S]*?)<!--\/YJ_VOLUMES-->/);
    if (!m) return null;
    try { return JSON.parse(m[1].trim()); } catch (e) { return null; }
  }

  /* ---------- Issues：版块列表 / 投稿 ---------- */
  /** 列出二创投稿（按创建时间倒序） */
  async function listFanworks(perPage) {
    var r = repo();
    var path = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/issues?state=open&labels=' + encodeURIComponent(LABEL) +
      '&per_page=' + (perPage || 50) + '&sort=created&direction=desc';
    var res = await read(path);
    if (!res.ok) return res;
    var items = (res.data || []).map(function (it) {
      return {
        number: it.number, title: it.title, body: it.body || '',
        author: it.user ? it.user.login : '匿名',
        createdAt: it.created_at, url: it.html_url,
        labels: (it.labels || []).map(function (l) { return typeof l === 'string' ? l : l.name; })
      };
    });
    return { ok: true, items: items, line: res.line };
  }

  /** 发一条二创投稿 Issue */
  async function postFanwork(title, body) {
    var r = repo();
    return write(WRITE_BASE + '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) + '/issues',
      'POST', { title: title, body: body, labels: [LABEL] });
  }

  /* ---------- 唯一创意工坊总文件夹（v6.6.0）：community/works/ ----------
     DR-053：全部二创集中到这一个总文件夹；每件作品一个 <时间戳>-<slug>/ 子文件夹，
     README.md(四段式) + meta.json + package.zip 同处；catalog.json 按时间倒序。
     community/packages/ 与「二创投稿」Issues 仅历史只读，不再写入、不删除。 */
  var WORKS_DIR = 'community/works';
  var PACKAGE_DIR = 'community/packages'; // 兼容常量：历史只读，不再作为写入目标
  var K_WORKS_CACHE = 'yj_works_cache';
  /** 把作品包 base64 传到唯一包体目录（contents API：存在则带 sha 覆盖，不存在则新建）。
   *  返回 {ok,path,html_url,rawUrl,error}。文件名由调用方给（含时间戳，唯一不撞）。 */
  async function uploadPackageFile(fileName, b64, commitMsg) {
    var r = repo();
    var path = PACKAGE_DIR + '/' + fileName;
    var base = WRITE_BASE + '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) + '/contents/' +
      path.split('/').map(encodeURIComponent).join('/');
    // 先查现有 sha（覆盖写需要）；404 属正常（新文件）
    var sha = null;
    try {
      var g = await once(base + '?ref=main', { method: 'GET', headers: headers(false) }, 15000);
      if (g.ok) { var gj = await g.json(); sha = gj.sha || null; }
    } catch (e) {}
    var payload = { message: commitMsg || ('二创包体：' + fileName), content: String(b64 || ''), branch: 'main' };
    if (sha) payload.sha = sha;
    var put = await write(base, 'PUT', payload);
    if (!put.ok) return { ok: false, error: put.error, path: path };
    var c = put.data && put.data.content || {};
    return { ok: true, path: path, html_url: c.html_url || '', rawUrl: c.download_url || '', sha: c.sha || '' };
  }

  /* ---------- 唯一创意工坊总文件夹 API（v6.6.0 / DR-053） ---------- */
  function sanitizeSlug(s) {
    // 只保留 字母数字_中文-，去掉点（杜绝 .. 穿越）、斜杠与空白
    return String(s || '').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
  }
  function worksPath(slug, file) {
    var base = WORKS_DIR + '/' + sanitizeSlug(slug);
    return file ? base + '/' + file : base;
  }
  function worksCacheGet() { try { return JSON.parse(store().getItem(K_WORKS_CACHE) || 'null'); } catch (e) { return null; } }
  function worksCacheSet(items) { try { store().setItem(K_WORKS_CACHE, JSON.stringify({ at: Date.now(), items: items || [] })); } catch (e) {} }

  /** 列作品清单：读 catalog.json（多线路），按 createdAt 倒序；失败回退本机缓存。
   *  返回 {ok, items, cached, error}。 */
  async function listWorks() {
    var r = repo();
    var path = worksPath('', 'catalog.json').replace(/\/$/, ''); // community/works/catalog.json
    path = WORKS_DIR + '/catalog.json';
    var apiPath = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var res = await read(apiPath);
    if (res.ok && res.data && res.data.content) {
      try {
        var txt = decodeBase64Content(res.data.content);
        var obj = JSON.parse(txt);
        var items = Array.isArray(obj) ? obj : (Array.isArray(obj.items) ? obj.items : []);
        items.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
        worksCacheSet(items);
        return { ok: true, items: items, cached: false };
      } catch (e) { /* JSON 损坏 → 落缓存 */ }
    }
    var c = worksCacheGet();
    if (c && c.items) {
      c.items.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      return { ok: true, items: c.items, cached: true, error: res.error || '清单解析失败，显示本机缓存' };
    }
    // v7.4.0：网络与本机缓存都没有时，读随包内置的基线清单（同源静态文件，断网/客户端均可读），
    // 让创意工坊板块正常打开（哪怕是空态），不再因 GitHub 超时而整个板块报错。
    try {
      var lr = await fetch('community/works/catalog.json?_=' + Date.now(), { cache: 'no-store' });
      if (lr && lr.ok) {
        var lo = await lr.json();
        var litems = Array.isArray(lo) ? lo : (Array.isArray(lo.items) ? lo.items : []);
        return { ok: true, items: litems, cached: false, local: true };
      }
    } catch (e) {}
    return { ok: false, error: res.error || '无法读取作品清单', items: [] };
  }

  /** 读作品子文件夹里的文本文件（README.md / meta.json） */
  async function readWorkFile(slug, file) {
    var r = repo();
    var path = worksPath(slug, file);
    var apiPath = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var res = await read(apiPath);
    if (!res.ok || !res.data || !res.data.content) return { ok: false, error: res.error || '文件不存在' };
    return { ok: true, text: decodeBase64Content(res.data.content), sha: res.data.sha || '' };
  }

  /** package.zip 的 raw 下载地址（供云境内 fetch，无需打开网页）
   *  注意：raw.githubusercontent 有 CDN 缓存，刚发布有传播延迟；安装优先用 getWorkPackageBytes。 */
  function getPackageUrl(slug) {
    var r = repo();
    return 'https://raw.githubusercontent.com/' + encodeURIComponent(r.owner) + '/' +
      encodeURIComponent(r.repo) + '/main/' + worksPath(slug, 'package.zip').split('/').map(encodeURIComponent).join('/');
  }

  /** 通过 contents API 读 package.zip 字节（无 CDN 缓存、始终最新、带 token 绕限流）。
   *  返回 {ok, bytes(Uint8Array), error}。安装器优先走此路径。 */
  async function getWorkPackageBytes(slug) {
    var r = repo();
    var path = worksPath(slug, 'package.zip');
    var apiPath = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var res = await read(apiPath);
    if (!res.ok || !res.data || !res.data.content) return { ok: false, error: res.error || '包体不存在' };
    var b64 = String(res.data.content).replace(/\s/g, '');
    try {
      var bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { ok: true, bytes: u8 };
    } catch (e) { return { ok: false, error: '包体解码失败' }; }
  }

  /** decode contents API 的 base64 content（可能含换行；兼容 UTF-8 中文） */
  function decodeBase64Content(b64) {
    var s = String(b64 || '').replace(/\s/g, '');
    if (typeof atob === 'function') {
      var bin = atob(s), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8);
      return bin;
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    return s;
  }

  /** 写单个作品文件到 works/<slug>/<file>（contents API：存在带 sha 覆盖） */
  async function putWorkFile(slug, file, contentB64, commitMsg) {
    var r = repo();
    var path = worksPath(slug, file);
    var apiPath = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var sha = null;
    try {
      var g = await once(apiPath + '?ref=main', { method: 'GET', headers: headers(false) }, 15000);
      if (g.ok) { var gj = await g.json(); sha = gj.sha || null; }
    } catch (e) {}
    var payload = { message: commitMsg || ('二创作品：' + path), content: String(contentB64 || ''), branch: 'main' };
    if (sha) payload.sha = sha;
    var put = await write(apiPath, 'PUT', payload);
    if (!put.ok) return { ok: false, error: put.error, path: path };
    var c = put.data && put.data.content || {};
    return { ok: true, path: path, html_url: c.html_url || '', sha: c.sha || '' };
  }

  /** 发布一件作品：写 README/meta/package 到子文件夹 + CAS 更新 catalog。
   *  files: [{name:'README.md',b64:'...'}, {name:'meta.json',...}, {name:'package.zip',...}]
   *  info:  {slug,title,author,createdAt,summary,size,hash} */
  async function publishWork(info, files) {
    var slug = sanitizeSlug(info.slug);
    if (!slug) return { ok: false, error: '作品标识为空' };
    for (var i = 0; i < (files || []).length; i++) {
      var f = files[i];
      var up = await putWorkFile(slug, f.name, f.b64, '二创作品[' + (info.title || slug) + ']：' + f.name);
      if (!up.ok) return { ok: false, error: '写入 ' + f.name + ' 失败：' + (up.error || '网络'), path: up.path };
    }
    // catalog CAS 写回：读当前 sha → 追加/替换本作品条目 → 带 sha 写回（冲突则报错，不静默丢）
    var r = repo();
    var catPath = WORKS_DIR + '/catalog.json';
    var catApi = '/repos/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.repo) +
      '/contents/' + catPath.split('/').map(encodeURIComponent).join('/');
    var items = [], catSha = null;
    try {
      var g = await once(catApi + '?ref=main', { method: 'GET', headers: headers(false) }, 15000);
      if (g.ok) {
        var gj = await g.json();
        catSha = gj.sha || null;
        var obj = JSON.parse(decodeBase64Content(gj.content));
        items = Array.isArray(obj) ? obj : (Array.isArray(obj.items) ? obj.items : []);
      }
    } catch (e) {}
    items = items.filter(function (it) { return it.slug !== slug; });
    items.push({
      slug: slug, title: info.title || slug, author: info.author || '',
      createdAt: info.createdAt || new Date().toISOString(),
      summary: info.summary || '', size: info.size || 0, hash: info.hash || '',
      readme: worksPath(slug, 'README.md'), package: worksPath(slug, 'package.zip')
    });
    items.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    var catB64;
    if (typeof btoa === 'function') {
      var txt = JSON.stringify({ schema: 1, items: items }, null, 2);
      var bytes = new TextEncoder ? new TextEncoder().encode(txt) : null;
      if (bytes) { var bs = ''; for (var k = 0; k < bytes.length; k++) bs += String.fromCharCode(bytes[k]); catB64 = btoa(bs); }
      else catB64 = btoa(unescape(encodeURIComponent(txt)));
    } else catB64 = Buffer.from(JSON.stringify({ schema: 1, items: items }, null, 2), 'utf8').toString('base64');
    var catPayload = { message: '更新二创清单：' + (info.title || slug), content: catB64, branch: 'main' };
    if (catSha) catPayload.sha = catSha;
    var cres = await write(catApi, 'PUT', catPayload);
    if (!cres.ok) return { ok: false, error: '更新清单失败（可能并发冲突，请重发）：' + cres.error };
    worksCacheSet(items);
    return { ok: true, path: worksPath(slug), catalogSha: cres.data && cres.data.content && cres.data.content.sha || '' };
  }

  /* ---------- 断网队列 ---------- */
  function queueGet() { try { return JSON.parse(store().getItem(K_QUEUE) || '[]'); } catch (e) { return []; } }
  function queueSet(q) { try { store().setItem(K_QUEUE, JSON.stringify(q)); } catch (e) {} }
  function queueAdd(job) { var q = queueGet(); q.push(job); queueSet(q); return q.length; }
  /** 发布：优先直接发，失败入队；返回 {ok,queued,data} */
  async function publishOrQueue(title, body) {
    var r = await postFanwork(title, body);
    if (r.ok) return { ok: true, data: r.data };
    queueAdd({ title: title, body: body, at: Date.now() });
    return { ok: false, queued: true, error: r.error };
  }
  async function flushQueue() {
    var q = queueGet(), left = [], done = 0;
    for (var i = 0; i < q.length; i++) {
      var r = await postFanwork(q[i].title, q[i].body);
      if (r.ok) done++; else left.push(q[i]);
    }
    queueSet(left);
    return { done: done, left: left.length };
  }
  function queueSize() { return queueGet().length; }

  /** 验证 token 是否有效（读当前用户） */
  async function whoami() {
    var r = await read('/user');
    if (r.ok && r.data && r.data.login) { setUser(r.data.login); return { ok: true, login: r.data.login }; }
    return { ok: false, error: r.error || '无法读取用户信息' };
  }

  /** 校验 token 范围提示（v6.5.1：包体走仓库 community/packages/，需 Contents + Issues 写） */
  function scopeHint() {
    return '需要 fine-grained token，勾选 Contents(读+写)；或 classic token 的 public_repo 权限。作品统一存仓库 community/works/ 唯一文件夹，浏览/下载无需 token，仅发布需要。';
  }

  globalThis.GithubClient = {
    getToken: getToken, setToken: setToken, hasToken: hasToken, clearToken: clearToken,
    getUser: getUser, setUser: setUser, repo: repo, setRepo: setRepo,
    createGist: createGist, listFanworks: listFanworks, postFanwork: postFanwork,
    publishOrQueue: publishOrQueue, flushQueue: flushQueue, queueSize: queueSize,
    whoami: whoami, scopeHint: scopeHint, LABEL: LABEL,
    downloadGistRaw: downloadGistRaw, createPrivateGist: createPrivateGist, parseVolumes: parseVolumes,
    uploadPackageFile: uploadPackageFile, PACKAGE_DIR: PACKAGE_DIR,
    WORKS_DIR: WORKS_DIR, worksPath: worksPath, listWorks: listWorks, readWorkFile: readWorkFile,
    getPackageUrl: getPackageUrl, putWorkFile: putWorkFile, publishWork: publishWork,
    getWorkPackageBytes: getWorkPackageBytes, decodeBase64Content: decodeBase64Content,
    _read: read, _write: write
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.GithubClient;
})();
