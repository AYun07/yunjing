import { chromium } from 'playwright';
import { writeFileSync, existsSync, readFileSync } from 'fs';
// 通用真实实测探针：按传入页面组运行，每页增量落盘。用法：node v764-probe.mjs <outFile> <page1> <page2> ...
const [outFile, ...PAGES] = process.argv.slice(2);
const BASE = 'http://127.0.0.1:8791';
const VER = '7.6.3';
const issues = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : [];
const seen = new Set(issues.map(x => x.tag + '|' + x.text.slice(0, 90)));
const log = [];
function save() { writeFileSync(outFile, JSON.stringify(issues, null, 2)); }
function push(tag, text) {
  const clean = String(text || '').trim();
  if (!clean || NOISE.test(clean)) return;
  const key = tag + '|' + clean.slice(0, 90);
  if (seen.has(key)) return;
  seen.add(key); issues.push({ tag, text: clean.slice(0, 220) }); save();
}
const NOISE = /favicon|net::ERR|Failed to load resource.*404|ERR_BLOCKED|webdriver|Autofill|IPH_|SharedImageManager|GLDisplayEGL|angle_platform|eglInitialize|dbus|UPower/i;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
});
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((v) => {
    window.YunJingDesktop = {
      isDesktop: true, getInfo: () => Promise.resolve({ version: v }),
      getSyncStatus: () => Promise.resolve({ version: v, lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  }, VER);
  const page = await ctx.newPage();
  page.on('dialog', d => { d.accept().catch(() => {}); });
  page.on('pageerror', e => push(path + ' PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') push(path + ' CONSOLE', m.text()); });
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(700);
  } catch (e) { push(path + ' GOTO', e.message); await ctx.close(); continue; }
  // 图片加载失败
  const badImgs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) out.push(img.getAttribute('src').slice(0, 80));
    });
    return out;
  });
  badImgs.slice(0, 6).forEach(src => push(path + ' IMG_FAIL', '图片加载失败: ' + src));
  // 点击按钮（限 20）
  const els = await page.locator('button:visible, [role=button]:visible').all();
  let clicked = 0;
  for (let i = 0; i < els.length && i < 20; i++) {
    try {
      await els[i].click({ timeout: 250, force: true }).catch(() => {});
      await page.waitForTimeout(15);
      clicked++;
      if (i % 6 === 5) await page.keyboard.press('Escape').catch(() => {});
    } catch (_) {}
  }
  log.push(path + ' 按钮' + els.length + ' 点击' + clicked + ' 图片失败' + badImgs.length);
  await ctx.close();
}
await browser.close();
writeFileSync(outFile.replace('.json', '.log.txt'), log.join('\n'));
console.log('DONE ' + outFile + ' issues=' + issues.length + '\n' + log.join('\n'));
