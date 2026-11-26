import { chromium } from 'playwright';
import fs from 'fs';

// 从本地服务（承载从线上拉取的最新版文件）做全功能全按钮视觉测试
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const OUT = process.argv[3] || '/workspace/视觉测试截图v705';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const PAGES = [
  { p: '/opening.html', name: '开场封面' },
  { p: '/index.html', name: '云境大厅' },
  { p: '/settings.html?goto=settings', name: '天地设置' },
  { p: '/xiaoyun.html?goto=forge', name: '万象工坊-造物' },
  { p: '/xiaoyun.html', name: '小云工坊' },
  { p: '/studio.html?genre=fanrenxiuxian', name: '创作室-凡人修仙' },
  { p: '/studio.html?genre=free', name: '创作室-自由' },
  { p: '/changelog/index.html', name: '更新公告' },
  { p: '/selftest.html?view=selftest', name: '运行自检' },
  { p: '/世界地图一览图-原著对照.html', name: '世界地图对照' }
];

const results = [];
for (const { p, name } of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: '7.0.5' }),
      getSyncStatus: () => Promise.resolve({ version: '7.0.5', lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  });
  const page = await ctx.newPage();
  const errors = [];       // 脚本错误
  const failed404 = [];     // 资源 404
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });
  page.on('response', r => { if (r.status() >= 400) failed404.push(r.status() + ' ' + r.url().replace(BASE, '')); });

  let loadOk = true, loadErr = '';
  try {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1600);
  } catch (e) { loadOk = false; loadErr = e.message.slice(0, 120); }

  // 视觉异常检测：可见元素超出视口右侧/底部（可能的遮挡/溢出）
  const overflow = await page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    document.querySelectorAll('button,input,a,h1,h2,[role=button]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
      // 只统计真正落在当前视口内、却被右侧/左侧裁切的元素；文档下方的长页内容不算遮挡
      const inViewport = r.top < vh && r.bottom > 0;
      if (inViewport && (r.right > vw + 4 || r.left < -4)) {
        const label = (el.innerText || el.getAttribute('title') || el.id || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24);
        out.push({ label, x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
      }
    });
    return out.slice(0, 12);
  }).catch(() => []);

  // 逐按钮点击，抓点击瞬间错误
  const btns = await page.locator('button:visible').all();
  let clicked = 0, clickErrors = [];
  for (const b of btns.slice(0, 60)) {
    try {
      const attr = await b.getAttribute('onclick');
      if (attr && /location|href=|clear|delete|remove|quit|close\(\)/.test(attr)) continue;
      const be = errors.length;
      await b.click({ timeout: 350, force: true }).then(() => clicked++).catch(() => {});
      await page.waitForTimeout(30);
      if (errors.length > be) clickErrors.push(errors[be].slice(0, 80));
    } catch (_) {}
  }

  // 截图（点击后状态可能变化，重新加载一次再截初始态）
  try {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + '/' + name.replace(/[^\w\u4e00-\u9fa5]/g, '_') + '.png', fullPage: false });
  } catch (_) {}

  results.push({
    name, path: p, loadOk, loadErr,
    buttons: btns.length, clicked,
    errors: [...new Set(errors)],
    failed404: [...new Set(failed404)],
    overflow,
    clickErrors: [...new Set(clickErrors)]
  });
  await ctx.close();
}
await browser.close();

console.log(JSON.stringify(results, null, 2));
const withErr = results.filter(r => !r.loadOk || r.errors.length || r.failed404.length || r.clickErrors.length || r.overflow.length);
console.log('\n==== 存在问题的页面: ' + withErr.length + '/' + results.length + ' ====');
