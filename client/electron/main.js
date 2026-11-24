/**
 * 云境桌面客户端 · Electron 主进程 (v7.0.0 客户端打磨版)
 * 定位：独立桌面软件。有自己的窗口、图标、菜单、关于框，不依赖用户电脑上的任何浏览器，
 *       窗口内没有地址栏 / 标签页 / 书签栏等任何浏览器 UI，启动即电影片头 → 封面 → 游玩。
 * 实现：内置本地静态服务器（仅程序内部加载资源用，不对外、不弹浏览器），
 *       绕开 file:// 下的 ES module / fetch CORS 限制。零外部依赖：服务器用 Node 原生 http/fs。
 * 更新：内容层走清单增量热更新（可写 yj-content，缺失回源只读基线）；
 *       壳层 Windows 用免安装目录包 A/B 切换，失败一律降级到原安装包路径。零后端、可离线。
 */

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const contentSync = require('./content-sync.js');
const shellUpdate = require('./shell-update.js');

// 版本单一来源：client/electron/package.json 的 version，main.js 不再重复硬编码。
const VERSION = require('./package.json').version;
const HOME_URL = 'https://github.com/AYun07/yunjing';
const RELEASE_API = 'https://api.github.com/repos/AYun07/yunjing/releases/latest';
const RELEASE_PAGE = HOME_URL + '/releases/latest';
const UA = 'yunjing-desktop/' + VERSION;
// 首次落地用默认通道；之后以本地清单里的 sources 为准
const DEFAULT_SOURCES = [
  'https://cdn.jsdelivr.net/gh/AYun07/yunjing@main/',
  'https://raw.githubusercontent.com/AYun07/yunjing/main/'
];

/* ---------- 更新通道：零后端 / 可离线 / 匿名 GitHub Release ---------- */

// 版本比较交给 content-sync.js 单一实现，避免两处口径漂移
const parseVer = contentSync.parseVer;
const compareVer = contentSync.compareVer;

// 带超时 + 重定向 + 体积上限的 HTTPS JSON 请求；异常抛给上层转中文提示
function requestJson(url, { timeoutMs = 12000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^https:\/\//i.test(url)) return reject(new Error('BAD_URL'));
    let req;
    try {
      req = https.get(url, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': UA, 'Connection': 'close' },
        timeout: timeoutMs
      }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) return reject(new Error('REDIRECT_LOOP'));
          return resolve(requestJson(new URL(res.headers.location, url).toString(), { timeoutMs, redirects: redirects + 1 }));
        }
        if (code === 403 || code === 429) { res.resume(); return reject(new Error('RATE_LIMIT')); }
        if (code !== 200) { res.resume(); return reject(new Error('HTTP_' + code)); }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => {
          body += c;
          if (body.length > 2 * 1024 * 1024) req.destroy(new Error('TOO_LARGE'));
        });
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('BAD_JSON')); } });
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

// 底层错误翻成人话，绝不把堆栈/内部码弹给玩家
function updateErrorText(err) {
  const code = (err && err.message) ? err.message : String(err || '');
  if (code === 'TIMEOUT') return '连接超时，请检查网络后重试。';
  if (code === 'RATE_LIMIT') return '检查过于频繁（GitHub 接口限流），请稍后再试。';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENETUNREACH' || code === 'ECONNREFUSED')
    return '当前无法联网，离线不影响云境正常使用，联网后可再检查。';
  if (code === 'BAD_JSON' || code === 'TOO_LARGE') return '更新服务返回异常数据，请稍后重试。';
  if (code === 'REDIRECT_LOOP' || code === 'BAD_URL') return '更新服务地址异常，请稍后重试。';
  if (code.indexOf('DOWNLOAD_HTTP_') === 0) return '安装包下载失败（HTTP ' + code.slice(14) + '），请前往 Release 页手动下载。';
  if (code.indexOf('HTTP_') === 0) return '更新服务返回错误（HTTP ' + code.slice(5) + '），请稍后重试。';
  return '检查更新失败：' + code;
}

// 可配开关：userData/update-settings.json → { autoCheck:false, autoCheckDelayMs:8000 }
function updateSettings() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'update-settings.json'), 'utf8')) || {}; }
  catch (_) { return {}; }
}

// 拉取最新版本信息（tag_name / assets / release 页）
async function fetchRelease() {
  const data = await requestJson(RELEASE_API);
  if (!data || typeof data !== 'object' || !data.tag_name) throw new Error('BAD_JSON');
  const latest = String(data.tag_name).trim();
  return {
    latestVersion: latest,
    hasUpdate: compareVer(latest, VERSION) > 0,
    releasePage: (typeof data.html_url === 'string' && data.html_url) || RELEASE_PAGE,
    assets: Array.isArray(data.assets) ? data.assets : []
  };
}

// 启动静默检查只报告、不自动下载：弹窗默认停在「稍后再说」
function showFoundDialog(info, silent) {
  return dialog.showMessageBoxSync({
    type: 'info', title: '发现新版本',
    message: '云境 ' + info.latestVersion + ' 已发布',
    detail: '当前版本 v' + VERSION + '。\n可自动更新（重启后生效），或前往 Release 页面手动下载。',
    buttons: ['自动更新', '前往下载页', '稍后再说'], defaultId: silent ? 2 : 0, cancelId: 2
  });
}

// 壳层 A/B 更新：准备免安装目录包 → 提示重启生效；任何失败静默降级到原安装包路径
async function offerShellUpdate(info) {
  if (process.platform === 'win32' && shellUpdate.pickUnpackedAsset(info.assets)) {
    try {
      const prepared = await shellUpdate.prepareShellUpdate({
        assets: info.assets, latestVersion: info.latestVersion,
        exeDir: path.dirname(app.getPath('exe')), userData: app.getPath('userData'),
        tempDir: app.getPath('temp')
      });
      const choice = dialog.showMessageBoxSync({
        type: 'info', title: '更新已就绪',
        message: '云境 ' + info.latestVersion + ' 已下载完成',
        detail: '免安装完整目录包'
          + (prepared.verified ? '已通过 SHA-256 校验。' : '（发布未提供校验值，已跳过校验）。')
          + '\n重启后立即生效，旧版本目录会保留，不删除你的任何数据。',
        buttons: ['立即重启', '稍后再说', '前往下载页'], defaultId: 0, cancelId: 1
      });
      if (choice === 0) {
        const started = shellUpdate.restartToNext({ userData: app.getPath('userData') });
        if (started.ok) { app.quit(); return { ok: true, action: 'restart', latestVersion: info.latestVersion }; }
        shell.openExternal(info.releasePage);
        return { ok: true, action: 'open-page', reason: started.reason, releasePage: info.releasePage };
      }
      if (choice === 2) { shell.openExternal(info.releasePage); return { ok: true, action: 'open-page', releasePage: info.releasePage }; }
      return { ok: true, action: 'later', latestVersion: info.latestVersion };
    } catch (_) {
      // 下载 / 校验 / 解压失败：不弹错误框打扰用户，走原来的安装包路径
    }
  }
  return autoUpdate(info);
}

// 只挑 Windows setup exe（NSIS），排除便携版；无 setup 时退回任意 Windows exe
function pickSetupAsset(assets) {
  const list = assets.filter(a => a && typeof a.name === 'string' && /\.exe$/i.test(a.name) && /windows/i.test(a.name));
  return list.find(a => !/便携|portable/i.test(a.name)) || list[0] || null;
}

// GitHub 新 API 在 asset.digest 提供 sha256:xxx；没有则跳过校验
function expectedSha(asset) {
  const d = asset && asset.digest;
  const m = typeof d === 'string' && /^sha256:([0-9a-f]{64})$/i.exec(d);
  return m ? m[1].toLowerCase() : null;
}

// 带超时 + 重定向 + 落盘的 HTTPS 下载；失败清理残片
function downloadTo(url, dest, { timeoutMs = 180000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^https:\/\//i.test(url)) return reject(new Error('BAD_URL'));
    const tmp = dest + '.part';
    const clean = () => { try { fs.unlinkSync(tmp); } catch (_) {} };
    let req;
    try {
      req = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/octet-stream' }, timeout: timeoutMs }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) return reject(new Error('REDIRECT_LOOP'));
          return resolve(downloadTo(new URL(res.headers.location, url).toString(), dest, { timeoutMs, redirects: redirects + 1 }));
        }
        if (code !== 200) { res.resume(); return reject(new Error('DOWNLOAD_HTTP_' + code)); }
        const out = fs.createWriteStream(tmp);
        let size = 0;
        res.on('data', c => { size += c.length; });
        res.on('error', e => { out.destroy(); clean(); reject(e); });
        out.on('error', e => { res.destroy(); clean(); reject(e); });
        out.on('finish', () => out.close(() => {
          try { fs.renameSync(tmp, dest); resolve({ path: dest, size }); }
          catch (e) { clean(); reject(e); }
        }));
        res.pipe(out);
      });
      req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
      req.on('error', e => { clean(); reject(e); });
    } catch (e) { clean(); reject(e); }
  });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const rs = fs.createReadStream(file);
    rs.on('data', c => h.update(c));
    rs.on('error', reject);
    rs.on('end', () => resolve(h.digest('hex')));
  });
}

// 检查：比对版本并弹窗；silent 时不弹"已是最新"，发现新版只提示一次、不自动下载
async function checkForUpdate({ silent = false } = {}) {
  try {
    const info = await fetchRelease();
    const result = {
      ok: true, currentVersion: VERSION, latestVersion: info.latestVersion,
      hasUpdate: info.hasUpdate, releasePage: info.releasePage
    };
    if (!info.hasUpdate) {
      if (!silent) dialog.showMessageBoxSync({
        type: 'info', title: '检查更新', message: '当前已是最新版本',
        detail: '云境 v' + VERSION + '，无需更新。', buttons: ['好的']
      });
      return result;
    }
    // 启动静默检查只报告不下载；手动检查直接走免安装 A/B 更新（失败自动降级）
    if (silent) {
      const choice = showFoundDialog(info, true);
      if (choice === 1) { shell.openExternal(info.releasePage); return Object.assign(result, { openedPage: true }); }
      if (choice === 0) return offerShellUpdate(info);
      return result;
    }
    return offerShellUpdate(info);
  } catch (err) {
    const text = updateErrorText(err);
    if (!silent) dialog.showMessageBoxSync({
      type: 'warning', title: '检查更新', message: '暂时无法检查更新',
      detail: text, buttons: ['知道了']
    });
    return { ok: false, currentVersion: VERSION, latestVersion: null, hasUpdate: false, error: text };
  }
}

// 全自动：下载 setup exe → sha256 校验 → 提示 → 退出应用并启动安装器（不覆盖运行中的自身）
async function autoUpdate(info) {
  let target = info || null;
  try {
    if (!target) target = await fetchRelease();
    if (!target.hasUpdate) {
      return { ok: true, currentVersion: VERSION, latestVersion: target.latestVersion, hasUpdate: false, message: '当前已是最新版本' };
    }
    if (process.platform !== 'win32') {
      shell.openExternal(target.releasePage);
      return { ok: true, action: 'open-page', reason: '当前系统非 Windows，已打开下载页', releasePage: target.releasePage };
    }
    const asset = pickSetupAsset(target.assets);
    if (!asset || !asset.browser_download_url) throw new Error('NO_ASSET');
    const safeTag = String(target.latestVersion).replace(/[^0-9A-Za-z.\-]/g, '_');
    const dest = path.join(app.getPath('temp'), 'yunjing-setup-' + safeTag + '.exe');
    await downloadTo(asset.browser_download_url, dest);
    const expect = expectedSha(asset);
    if (expect) {
      const actual = await sha256File(dest);
      if (actual !== expect) {
        try { fs.unlinkSync(dest); } catch (_) {}
        throw new Error('SHA_MISMATCH');
      }
    }
    const choice = dialog.showMessageBoxSync({
      type: 'info', title: '更新已就绪',
      message: '新版安装包已下载完成',
      detail: '版本 ' + target.latestVersion + ' · ' + asset.name + '\n'
        + (expect ? '已通过 SHA-256 校验。' : '该发布未提供校验值，已跳过校验。')
        + '\n\n选择"立即安装"将退出云境并打开安装程序，按提示完成安装；不会覆盖正在运行的程序文件。',
      buttons: ['立即安装', '打开所在目录', '稍后再说'], defaultId: 0, cancelId: 2
    });
    const result = {
      ok: true, currentVersion: VERSION, latestVersion: target.latestVersion,
      downloadedTo: dest, verified: !!expect
    };
    if (choice === 1) { shell.showItemInFolder(dest); return Object.assign(result, { action: 'show-folder' }); }
    if (choice === 2) return Object.assign(result, { action: 'later' });
    // Electron 33 用 shell.openPath（旧 shell.openItem 已移除）；返回非空字符串即失败
    const openErr = await shell.openPath(dest);
    if (openErr) {
      dialog.showMessageBoxSync({
        type: 'warning', title: '自动更新', message: '无法自动打开安装包',
        detail: openErr + '\n安装包已保存在：' + dest, buttons: ['知道了']
      });
      shell.showItemInFolder(dest);
      return Object.assign(result, { ok: false, action: 'open-failed', error: openErr });
    }
    app.quit();
    return Object.assign(result, { action: 'install' });
  } catch (err) {
    const text = (err && err.message === 'NO_ASSET')
      ? '该版本暂未提供 Windows 安装包，已为你打开下载页。'
      : (err && err.message === 'SHA_MISMATCH')
        ? '安装包校验失败，已删除该文件，请重试或前往 Release 页手动下载。'
        : updateErrorText(err);
    if (err && err.message === 'NO_ASSET') shell.openExternal((target && target.releasePage) || RELEASE_PAGE);
    dialog.showMessageBoxSync({ type: 'warning', title: '自动更新', message: '自动更新未完成', detail: text, buttons: ['知道了'] });
    return { ok: false, error: text };
  }
}

// 云境打包基线（只读）：打包后位于 resources/yunjing（asar 之外），开发时为本项目的父级
function resolveSiteRoot() {
  const candidates = [
    path.join(__dirname, '..', '..'),
    path.join(process.resourcesPath || '', 'yunjing'),
    path.join(process.resourcesPath || '', 'app', 'yunjing')
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'index.html'))) return c; } catch (_) {}
  }
  return candidates[0];
}
const BASELINE_ROOT = resolveSiteRoot();

// 可写内容目录：热更新只改这里。HTTP 优先读它，缺失回源只读基线，保证永不白屏。
const contentDirPath = () => path.join(app.getPath('userData'), 'yj-content');
const stateFilePath = () => path.join(app.getPath('userData'), contentSync.STATE_NAME);

// 下载通道：首次用内置默认值，之后用本地清单里负责人配置的 sources
function readSources() {
  const s = contentSync.readLocalManifest(contentDirPath()).sources;
  const valid = Array.isArray(s) ? s.filter(x => typeof x === 'string' && /^https:\/\//.test(x)) : [];
  return valid.length ? valid : DEFAULT_SOURCES;
}

// 启动同步与手动同步共用；并发复用同一 Promise，避免两个流程同时切换目录
let syncInFlight = null;
function runContentSync({ startup = false } = {}) {
  if (syncInFlight) return syncInFlight;
  const opts = {
    contentDir: contentDirPath(), baselineDir: BASELINE_ROOT,
    stateFile: stateFilePath(), sources: readSources()
  };
  syncInFlight = (startup
    ? contentSync.runStartup(opts)
    : contentSync.repairContent(opts).then(() => contentSync.syncContent(opts)))
    .then(r => { syncInFlight = null; return r; })
    .catch(e => { syncInFlight = null; return { action: 'error', ok: false, errors: [contentSync.toChineseError(e)] }; });
  return syncInFlight;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf'
};

let server = null;
let serverPort = 0;
let mainWindow = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/opening.html';
        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        // 可写内容优先；文件缺失/损坏时回源只读基线，保证永不白屏
        const roots = [contentDirPath(), BASELINE_ROOT];
        let filePath = null;
        for (const root of roots) {
          const candidate = path.join(root, safe);
          if (candidate !== root && !candidate.startsWith(root + path.sep)) continue;
          try { if (fs.statSync(candidate).isFile()) { filePath = candidate; break; } } catch (_) {}
        }
        if (!filePath) { res.writeHead(404); return res.end('Not Found'); }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (e) { res.writeHead(500); res.end('Server Error'); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
  });
}

/* 记住窗口大小 / 位置 / 最大化状态——成熟软件的常规体验 */
function stateFile() { return path.join(app.getPath('userData'), 'window-state.json'); }
function readWindowState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (_) { return null; }
}
function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const b = mainWindow.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({
      x: b.x, y: b.y, width: b.width, height: b.height, maximized: mainWindow.isMaximized()
    }));
  } catch (_) {}
}

function createWindow() {
  const st = readWindowState();
  const relIcon = path.join('assets', 'yj-icon-512.png');
  const iconPath = fs.existsSync(path.join(contentDirPath(), relIcon))
    ? path.join(contentDirPath(), relIcon) : path.join(BASELINE_ROOT, relIcon);
  const win = new BrowserWindow({
    width: st && st.width ? st.width : 1360,
    height: st && st.height ? st.height : 860,
    x: typeof st?.x === 'number' ? st.x : undefined,
    y: typeof st?.y === 'number' ? st.y : undefined,
    minWidth: 900, minHeight: 600,
    frame: false, // 去掉系统标题栏/边框，由页面自绘标题栏接管拖拽与按钮
    title: '云境 · AI创作与开放世界扮演',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0b0c1c',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: false
    }
  });
  mainWindow = win;

  if (st && st.maximized) win.maximize();

  // 屏蔽开发者工具 / 查看源码等快捷键，保持纯软件观感
  win.webContents.on('before-input-event', (event, input) => {
    const k = (input.key || '').toLowerCase();
    const devtools = input.key === 'F12'
      || (input.control && input.shift && k === 'i')
      || (input.control && input.shift && k === 'c')
      || (input.meta && input.alt && k === 'i');
    if (devtools) event.preventDefault();
  });

  // 页面里若有 http(s) 外链，交系统浏览器，不在软件窗口里导航
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  win.on('close', saveWindowState);
  win.on('closed', () => { mainWindow = null; });
  // 首屏真正显示后才清除启动观察标记：连续 2 次未清除视为启动异常，下次自动回滚
  win.once('ready-to-show', () => { win.show(); win.focus(); contentSync.markBootOk(stateFilePath()); });

  win.loadURL(`http://127.0.0.1:${serverPort}/opening.html`).catch(err => {
    dialog.showErrorBox('云境启动失败', '内部资源加载失败：' + err.message);
  });

  const menu = Menu.buildFromTemplate([
    { label: '云境', submenu: [
      { label: '关于云境', click: () => {
        const stt = contentSync.getStatus(stateFilePath(), contentDirPath());
        const choice = dialog.showMessageBoxSync({
          type: 'info', title: '关于云境',
          message: `云境 v${VERSION}`,
          detail: `壳版本 v${VERSION} · 内容版本 ${stt.version}\n万象入云 · 一念一世界\nAI 互动小说 + 开放世界扮演\n纯本地运行，故事与密钥只存本机。`,
          buttons: ['检查更新', '好的'], defaultId: 1, cancelId: 1
        });
        if (choice === 0) checkForUpdate();
      } },
      { label: '检查更新', click: () => checkForUpdate() },
      { type: 'separator' },
      { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]},
    { label: '视图', submenu: [
      { role: 'togglefullscreen', label: '全屏' },
      { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' },
      { role: 'resetZoom', label: '实际大小' }
    ]},
    { label: '帮助', submenu: [
      { label: '云境主页', click: () => shell.openExternal(HOME_URL) }
    ]}
  ]);
  Menu.setApplicationMenu(menu);
}

/* 单实例锁：重复双击图标只唤起同一个云境窗口，不开多个 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // 若这是 A/B 切换后的新进程，先收尾：旧目录改名保留，不删除
    try { shellUpdate.finalizeSwitch({ userData: app.getPath('userData') }); } catch (_) {}
    await startServer();
    createWindow();
    // 内容层：窗口已可加载本地内容后才在后台同步，不阻塞首屏开场动画
    setImmediate(() => { runContentSync({ startup: true }); });
    // 壳层：启动延时静默检查，默认 8 秒后执行；可在 userData/update-settings.json 关闭或改延时
    const cfg = updateSettings();
    if (cfg.autoCheck !== false) {
      const delay = Number(cfg.autoCheckDelayMs) > 1000 ? Number(cfg.autoCheckDelayMs) : 8000;
      setTimeout(() => { checkForUpdate({ silent: true }); }, delay);
    }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { if (server) server.close(); });

// 供 UI 读取客户端信息（授权占位模块会用到）；version 来自 package.json 单一来源
ipcMain.handle('client-info', () => ({
  platform: process.platform,
  version: VERSION,
  contentVersion: contentSync.getStatus(stateFilePath(), contentDirPath()).version,
  port: serverPort,
  isPackaged: app.isPackaged
}));

// 契约变更走流程：通道名与返回结构稳定，新增可选字段不算不兼容
// 检查更新：渲染进程可触发，返回结构化结果，错误已转中文，不把异常抛给渲染进程
ipcMain.handle('client-check-update', (_e, options) => checkForUpdate(options || {}));

// 全自动更新：下载 → 校验 → 提示 → 退出并启动安装器；作为壳层 A/B 失败时的降级路径保留
ipcMain.handle('client-auto-update', () => autoUpdate());

// 内容层同步状态：渲染层只读，返回 { version, lastSync, state }
ipcMain.handle('content-sync-status', () => contentSync.getStatus(stateFilePath(), contentDirPath()));

// 手动触发一次内容同步（先自修复再拉清单），结构化返回，不弹窗
ipcMain.handle('content-sync-now', () => runContentSync());

/* 无边框窗口控制：统一 handle/invoke 契约，渲染进程不直接持有 BrowserWindow。
   每个 handler 都防御窗口已关闭的情况，避免渲染进程拿到异常或操作悬空引用。 */
ipcMain.handle('win-minimize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.minimize();
});

// maximized 返回切换后的状态，渲染进程据此同步按钮图标，不必自己再查一次
ipcMain.handle('win-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { maximized: false };
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return { maximized: false };
  }
  mainWindow.maximize();
  return { maximized: true };
});

ipcMain.handle('win-close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.close();
});

ipcMain.handle('win-is-maximized', () => {
  return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized());
});
