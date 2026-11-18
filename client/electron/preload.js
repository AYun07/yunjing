/**
 * 云境桌面客户端 · 预加载桥 (v4.34.0)
 * 只暴露只读的客户端信息，不开放任何敏感能力。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('YunJingDesktop', {
  getInfo: () => ipcRenderer.invoke('client-info'),
  isDesktop: true
});
