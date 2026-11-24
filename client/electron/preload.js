/**
 * 云境桌面客户端 · 预加载桥 (v7.0.0)
 * 暴露只读客户端信息与更新契约；更新动作全部在主进程执行，渲染进程只发指令、拿结果。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('YunJingDesktop', {
  // 只读信息：getInfo 保留给既有 UI，getClientInfo 为契约新别名
  getInfo: () => ipcRenderer.invoke('client-info'),
  getClientInfo: () => ipcRenderer.invoke('client-info'),

  // checkUpdate({silent?}) → { ok, currentVersion, latestVersion, hasUpdate, releasePage, error? }
  checkUpdate: (options) => ipcRenderer.invoke('client-check-update', options || {}),

  // autoUpdate() → { ok, action:install|show-folder|later|open-page|open-failed, downloadedTo?, verified?, error? }
  autoUpdate: () => ipcRenderer.invoke('client-auto-update'),

  // 内容层热更新：getSyncStatus() → { version, lastSync, state }；syncNow() → { action, ok, version, downloaded, skipped, errors }
  getSyncStatus: () => ipcRenderer.invoke('content-sync-status'),
  syncNow: () => ipcRenderer.invoke('content-sync-now'),

  // 无边框窗口控制：与 main.js 的 win-* 通道一一对应，均返回 Promise
  minimizeWindow: () => ipcRenderer.invoke('win-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('win-maximize'),   // Promise<{maximized}>
  closeWindow: () => ipcRenderer.invoke('win-close'),
  isMaximized: () => ipcRenderer.invoke('win-is-maximized'),  // Promise<boolean>

  isDesktop: true
});
