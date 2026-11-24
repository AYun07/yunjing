/**
 * 云境桌面客户端 · Electron 主进程 (v6.9.4 客户端打磨版)
 * 定位：独立桌面软件。有自己的窗口、图标、菜单、关于框，不依赖用户电脑上的任何浏览器，
 *       窗口内没有地址栏 / 标签页 / 书签栏等任何浏览器 UI，启动即电影片头 → 封面 → 游玩。
 * 实现：内置本地静态服务器（仅程序内部加载资源用，不对外、不弹浏览器），
 *       绕开 file:// 下的 ES module / fetch CORS 限制。零外部依赖：服务器用 Node 原生 http/fs。
 */

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const VERSION = '6.9.4';
const HOME_URL = 'https://github.com/AYun07/yunjing';

// 云境站点根目录：打包后位于 resources/yunjing（asar 之外），开发时为本项目的父级
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
const SITE_ROOT = resolveSiteRoot();

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
        const filePath = path.join(SITE_ROOT, safe);
        if (!filePath.startsWith(SITE_ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
        fs.stat(filePath, (err, st) => {
          if (err || !st.isFile()) { res.writeHead(404); return res.end('Not Found'); }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(filePath).pipe(res);
        });
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
  const iconPath = path.join(SITE_ROOT, 'assets', 'yj-icon-512.png');
  const win = new BrowserWindow({
    width: st && st.width ? st.width : 1360,
    height: st && st.height ? st.height : 860,
    x: typeof st?.x === 'number' ? st.x : undefined,
    y: typeof st?.y === 'number' ? st.y : undefined,
    minWidth: 900, minHeight: 600,
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
  win.once('ready-to-show', () => { win.show(); win.focus(); });

  win.loadURL(`http://127.0.0.1:${serverPort}/opening.html`).catch(err => {
    dialog.showErrorBox('云境启动失败', '内部资源加载失败：' + err.message);
  });

  const menu = Menu.buildFromTemplate([
    { label: '云境', submenu: [
      { label: '关于云境', click: () => dialog.showMessageBox({
        type: 'info', title: '关于云境',
        message: `云境 v${VERSION}`,
        detail: '万象入云 · 一念一世界\nAI 互动小说 + 开放世界扮演\n纯本地运行，故事与密钥只存本机。'
      }) },
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
    await startServer();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { if (server) server.close(); });

// 供 UI 读取客户端信息（授权占位模块会用到）
ipcMain.handle('client-info', () => ({
  platform: process.platform,
  version: VERSION,
  port: serverPort,
  isPackaged: app.isPackaged
}));
