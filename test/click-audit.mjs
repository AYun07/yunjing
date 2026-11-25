import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const PAGES = [
  '/opening.html',
  '/index.html',
  '/settings.html?goto=settings',
  '/xiaoyun.html?goto=forge',
  '/studio.html?genre=fanrenxiuxian',
  '/studio.html?genre=free'
];
const results = [];
for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: '7.0.3' }),
      getSyncStatus: () => Promise.resolve({ version: '7.0.3', lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: '+m.text().slice(0,160)); });
  await page.goto(BASE+p, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  // 点击页面内所有可见且可点的 button（跳过会导航/提交的），抓点击瞬间错误
  const before = errs.length;
  const btns = await page.locator('button:visible').all();
  let clicked = 0;
  for (const b of btns.slice(0, 40)) {
    try {
      const attr = await b.getAttribute('onclick');
      // 跳过导航类和危险操作
      if (attr && /location|href|clear|delete|remove|quit|close\(\)/.test(attr)) continue;
      await b.click({ timeout: 400, force: true }).then(()=>clicked++).catch(()=>{});
      await page.waitForTimeout(40);
    } catch (_) {}
  }
  results.push({ page: p, buttons: btns.length, clicked, newErrors: errs.slice(before), totalErrors: errs.length });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
const bad = results.filter(r => r.totalErrors > 0);
console.log('\n==== 有脚本错误的页面:', bad.length, '/', results.length, '====');
