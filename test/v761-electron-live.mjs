#!/usr/bin/env node
/**
 * v7.6.1 真机实测：用 Xvfb + 真实 Electron + Playwright(CDP) 连接真实窗口，
 * 验证设置页版本号显示走"有效版本"，client-info 契约含 version/shellVersion/contentVersion。
 * 需在 Xvfb 环境下运行：xvfb-run -a node test/v761-electron-live.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON = path.join(ROOT, 'client/electron/node_modules/electron/dist/electron');
const APPDIR = path.join(ROOT, 'client/electron');
const expectVer = JSON.parse(require('node:fs').readFileSync(path.join(APPDIR, 'package.json'),'utf8')).version;
const { chromium } = require('playwright');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (n, ok, extra='') => { if (ok) { pass++; console.log('  PASS '+n+(extra?' -> '+extra:'')); }
  else { fail++; console.log('  FAIL '+n+(extra?' -> '+extra:'')); } };

(async () => {
  const cdpPort = 9333;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;   // 必须删除，否则 electron 以 node 模式跑 main.js，require('electron') 解构失败
  const child = spawn(ELECTRON, [APPDIR, `--remote-debugging-port=${cdpPort}`, '--no-sandbox'], {
    env, stdio: ['ignore','pipe','pipe']
  });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });
  child.stdout.on('data', () => {});

  let browser;
  try {
    // 等 CDP 起来
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
        ready = true; break;
      } catch (_) { await sleep(500); }
    }
    t('真实 Electron 启动并可 CDP 连接', ready, ready ? '' : stderr.slice(-300));
    if (!ready) throw new Error('CDP 未就绪');

    await sleep(2500); // 等首屏 + 内容同步启动
    const ctx = browser.contexts()[0];
    let page = ctx.pages().find(p => /127\.0\.0\.1/.test(p.url())) || ctx.pages()[0];
    t('客户端加载了本地页面', !!page && /127\.0\.0\.1/.test(page.url()), page ? page.url() : 'no page');

    // 真实读取 client-info 契约（经 preload 桥）
    const info = await page.evaluate(async () => {
      if (window.YunJingDesktop && window.YunJingDesktop.getInfo) return await window.YunJingDesktop.getInfo();
      return null;
    });
    t('preload 桥 getInfo 可用', !!info, info ? JSON.stringify(info) : 'null');
    if (info) {
      t('client-info.version = 当前版本（有效版本）', info.version === expectVer, String(info.version));
      t('client-info.shellVersion = 当前版本（新壳）', info.shellVersion === expectVer, String(info.shellVersion));
      t('client-info 含 contentVersion 字段', typeof info.contentVersion === 'string', String(info.contentVersion));
      t('isPackaged 为 false（源码运行）', info.isPackaged === false, String(info.isPackaged));
    }

    // 打开设置页，实测"当前版本"显示（真实鼠标/导航）
    await page.goto(page.url().split('#')[0].replace(/\/[^/]*$/, '/settings.html')).catch(()=>{});
    await sleep(1200);
    const verText = await page.evaluate(() => {
      const el = document.getElementById('verCurrent');
      return el ? el.textContent : '(no #verCurrent)';
    });
    t('设置页显示当前版本 v' + expectVer, verText.indexOf(expectVer) >= 0, verText);

    const contentText = await page.evaluate(() => {
      const el = document.getElementById('verContent');
      return el ? el.textContent : '(no #verContent)';
    });
    t('设置页显示内容版本', /内容版本/.test(contentText), contentText);

  } catch (e) {
    fail++; console.log('  FAIL 异常 -> ' + e.message);
  } finally {
    if (browser) await browser.close().catch(()=>{});
    try { child.kill('SIGTERM'); } catch (_) {}
    console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
  }
})();
