import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// 第一轮：全页面真实点击审计 + 客观维度检测（死按钮/图片失败/输入框失效/遮挡）
const BASE = 'http://127.0.0.1:8791';
const VER = '7.6.3';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer', '--use-gl=swiftshader']
});
const issues = [];
const seen = new Set();
const log = [];
const PAGES = [
  '/opening.html', '/index.html', '/settings.html?goto=settings',
  '/xiaoyun.html', '/studio.html?genre=shengtang', '/studio.html?genre=wangyou',
  '/studio.html?genre=fanrenxiuxian', '/studio.html?genre=scifi', '/studio.html?genre=mystery',
  '/changelog/index.html', '/selftest.html?view=selftest', '/map-preview.html', '/map-verified.html'
];
const NOISE = /favicon|net::ERR|Failed to load resource.*404|ERR_BLOCKED|webdriver|Autofill|favicon.ico|IPH_|SharedImageManager|GLDisplayEGL|angle_platform|eglInitialize/i;
function push(tag, text) {
  const clean = String(text || '').trim();
  if (!clean || NOISE.test(clean)) return;
  const key = tag + '|' + clean.slice(0, 90);
  if (seen.has(key)) return;
  seen.add(key);
  issues.push({ tag, text: clean.slice(0, 220) });
}
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((v) => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: v }),
      getSyncStatus: () => Promise.resolve({ version: v, lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false),
      syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  }, VER);
  const page = await ctx.newPage();
  page.on('dialog', d => { d.accept().catch(() => {}); });
  page.on('pageerror', e => push(path + ' PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') push(path + ' CONSOLE', m.text()); });
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(900);
  } catch (e) { push(path + ' GOTO', e.message); await ctx.close(); continue; }

  // 客观维度：图片加载失败
  const badImgs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) out.push(img.getAttribute('src').slice(0, 80));
    });
    return out;
  });
  badImgs.slice(0, 8).forEach(src => push(path + ' IMG_FAIL', '图片加载失败: ' + src));

  // 客观维度：可见输入框无法键入
  const inputs = await page.locator('input:visible:not([type=hidden]),textarea:visible').all();
  for (let j = 0; j < Math.min(inputs.length, 8); j++) {
    const inp = inputs[j];
    const id = await inp.getAttribute('id').catch(() => '') || ('#' + j);
    const ro = await inp.getAttribute('readonly').catch(() => null);
    const dis = await inp.getAttribute('disabled').catch(() => null);
    if (ro !== null || dis !== null) continue; // 有意只读/禁用不算
    try {
      const old = await inp.inputValue().catch(() => '');
      await inp.fill('云境测试输入ABC', { timeout: 400 }).catch(() => {});
      const now = await inp.inputValue().catch(() => '');
      if (!String(now).includes('云境测试输入ABC')) push(path + ' INPUT', '输入框 #' + id + ' 无法键入 (fill后=' + String(now).slice(0,30) + ')');
    } catch (_) {}
  }

  // 真实点击所有可见按钮，捕获异常
  const els = await page.locator('button:visible, [role=button]:visible').all();
  let clicked = 0;
  for (let i = 0; i < els.length && i < 40; i++) {
    try {
      const el = els[i];
      const label = (await el.getAttribute('aria-label')) || (await el.textContent().then(t => t?.trim().slice(0, 16)).catch(() => '')) || ('#' + i);
      await el.click({ timeout: 300, force: true }).catch(() => {});
      await page.waitForTimeout(20);
      clicked++;
      if (i % 7 === 6) await page.keyboard.press('Escape').catch(() => {});
    } catch (_) {}
  }
  log.push(path + ' | 按钮' + els.length + ' 点击' + clicked + ' 图片失败' + badImgs.length + ' 输入框' + inputs.length);
  await ctx.close();
}
await browser.close();
writeFileSync('/tmp/round1-issues.json', JSON.stringify(issues, null, 2));
writeFileSync('/tmp/round1-log.txt', log.join('\n'));
console.log('LOG:\n' + log.join('\n'));
console.log('\n===== 第一轮真实问题 (' + issues.length + ') =====');
issues.forEach((x, i) => console.log((i + 1) + '. [' + x.tag + '] ' + x.text));
