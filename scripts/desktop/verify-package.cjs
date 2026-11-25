#!/usr/bin/env node
/**
 * 打包前强制校验（DR-100）：防止「app.asar 漏文件」与「7z 带目录前缀」两类事故。
 * 用法：node scripts/desktop/verify-package.mjs [electron目录]
 * 退出码 0 = 全部通过；非 0 = 有致命问题，禁止打包发布。
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ELEC = path.resolve(process.argv[2] || 'client/electron');
const ASAR = path.join(ELEC, 'dist/win-unpacked/resources/app.asar');
const ASN = path.join(ELEC, 'node_modules/@electron/asar');
let fatal = 0;
const fail = (m) => { console.error('  ✗ ' + m); fatal++; };
const pass = (m) => console.log('  ✓ ' + m);

console.log('=== 1. app.asar 内容完整性 ===');
let asar;
try { asar = require(ASN); } catch (e) { fail('无法加载 @electron/asar: ' + e.message); process.exit(1); }
let pkg;
try { pkg = asar.listPackage(ASAR).map((p) => p.replace(/^\//, '')); } catch (e) { fail('app.asar 不存在或损坏: ' + e.message); process.exit(1); }

// main.js 里所有 require('./xxx') 目标都必须打进 asar
const mainSrc = asar.extractFile(ASAR, 'main.js').toString();
const reqs = [...mainSrc.matchAll(/require\(['"]\.\/(.*?)['"]\)/g)].map((m) => m[1]);
pass('main.js 本地依赖: ' + reqs.join(', '));
for (const r of reqs) {
  const hit = pkg.includes(r) || pkg.includes(r.replace(/\.js$/, ''));
  if (hit) pass('依赖已打包: ' + r);
  else fail('依赖缺失于 app.asar: ' + r + '（会导致 "Cannot find module" 启动崩溃）');
}
for (const must of ['main.js', 'preload.js', 'package.json']) {
  if (pkg.includes(must)) pass('核心文件存在: ' + must);
  else fail('核心文件缺失: ' + must);
}

console.log('=== 2. 源模块实际可加载（语法/依赖）===');
const Module = require('module');
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'electron') {
    const noop = () => {};
    return { app: { getPath: () => '/tmp', whenReady: () => Promise.resolve(), on: noop, quit: noop }, ipcMain: { handle: noop, on: noop }, BrowserWindow: function () {}, shell: { openExternal: noop }, Menu: { buildFromTemplate: noop, setApplicationMenu: noop }, nativeImage: {}, dialog: {}, screen: {} };
  }
  return origLoad.apply(this, arguments);
};
for (const r of reqs.filter((x) => x.endsWith('.js'))) {
  try { require(path.join(ELEC, r)); pass('模块可加载: ' + r); }
  catch (e) { fail('模块加载失败 ' + r + ': ' + e.message); }
}
Module._load = origLoad;

console.log('=== 3. 7z 包内路径无目录前缀（防 DR-099 复发）===');
const SEVENZ = path.join(ELEC, 'dist/yunjing-desktop-7.0.0-x64.nsis.7z');
if (fs.existsSync(SEVENZ)) {
  let listing = '';
  try { listing = execFileSync('7z', ['l', SEVENZ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); }
  catch (e) { fail('无法列出 7z: ' + e.message); }
  if (listing.includes('win-unpacked/YunJing.exe')) {
    fail('7z 内主程序带 win-unpacked/ 前缀——必须从 dist/win-unpacked 内部打点');
  } else if (listing.includes('YunJing.exe')) {
    pass('主程序在 7z 根目录（无前缀）');
  } else {
    fail('7z 内找不到 YunJing.exe');
  }
  if (listing.includes('resources/app.asar')) pass('7z 内含 resources/app.asar');
  else fail('7z 内缺 resources/app.asar');
} else {
  fail('找不到 7z: ' + SEVENZ);
}

console.log('=== 4. 站点资源关键文件 ===');
const SITE = path.join(ELEC, 'dist/win-unpacked/resources/yunjing');
for (const f of ['index.html', 'opening.html', 'studio.html', 'settings.html', 'js/desktop-shell.js', 'release-notes.json']) {
  if (fs.existsSync(path.join(SITE, f))) pass('站点文件存在: ' + f);
  else fail('站点文件缺失: ' + f);
}

console.log('\n' + (fatal === 0 ? '✅ 全部校验通过，可以打包发布' : `❌ ${fatal} 项致命问题，禁止发布`));
process.exit(fatal === 0 ? 0 : 1);
