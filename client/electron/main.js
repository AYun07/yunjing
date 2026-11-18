/**
 * 云境桌面客户端 · Electron 主进程 (v4.34.0)
 * 核心：内置本地静态服务器（绕开 file:// 的 ES module / fetch CORS 限制），
 *       窗口加载 http://127.0.0.1:<port>，行为与 start-*.command 启动器一致。
 * 零外部依赖：服务器用 Node 原生 http/fs，不引入 express。
 */
const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 云境站点根目录：打包后位于 resources/app/../../（asar 之外），开发时为本项目的父级
function resolveSiteRoot() {
  const candidates = [
    path.join(__dirname, '..', '..'),          // 开发：client/electron -> yunjing
    path.join(process.resourcesPath || '', 'yunjing'), // 打包：resources/yunjing
    path.join(process.resourcesPath || '', 'app', 'yunjing')
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'index.html'))) return c; } catch (_) {}
  }
  return candidates[0];
}
const SITE_ROOT = resolveSiteRoot();
const VERSION = '4.34.0';

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

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        // 防目录穿越
        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        let filePath = path.join(SITE_ROOT, safe);
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

function createWindow() {
  const iconPath = path.join(SITE_ROOT, 'assets', 'yj-icon-512.png');
  const win = new BrowserWindow({
    width: 1360, height: 860,
    minWidth: 900, minHeight: 600,
    title: '云境 · AI创作与开放世界扮演',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0b0c1c',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  // 外链用系统浏览器打开，不在客户端窗口里导航
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.loadURL(`http://127.0.0.1:${serverPort}/index.html`).catch(err => {
    dialog.showErrorBox('云境启动失败', '本地服务加载失败：' + err.message);
  });

  // 应用内菜单（精简）
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
      { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => win.reload() },
      { role: 'togglefullscreen', label: '全屏' },
      { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }
    ]},
    { label: '帮助', submenu: [
      { label: '云境官网', click: () => shell.openExternal('https://github.com/') }
    ]}
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

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
