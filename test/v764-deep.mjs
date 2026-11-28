import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// 深度交互实测：验证操作后状态真的变化（不是只看不崩）
const BASE = 'http://127.0.0.1:8791', VER = '7.6.3';
const OUT = '/tmp/v764-deep-issues.json';
const issues = [], log = [], seen = new Set();
function push(tag, text) {
  const clean = String(text || '').trim();
  if (!clean || /favicon|net::ERR|404|IPH_|dbus|GPU/i.test(clean)) return;
  const key = tag + '|' + clean.slice(0, 80);
  if (seen.has(key)) return; seen.add(key);
  issues.push({ tag, text: clean.slice(0, 200) });
}
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
async function ctx() {
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addInitScript((v) => { window.YunJingDesktop = {
    isDesktop: true, getInfo: () => Promise.resolve({ version: v }),
    getSyncStatus: () => Promise.resolve({ version: v, lastSync: Date.now(), state: 'idle' }),
    checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
    minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
    isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
  }; }, VER);
  return c;
}
// === 设置页深度 ===
{
  const c = await ctx(), page = await c.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(BASE + '/settings.html?goto=settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  // 字号 A±：label 是否变化
  const fs0 = await page.locator('#fontScaleLabel').textContent().catch(() => null);
  await page.locator('#fontPlus').click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
  const fs1 = await page.locator('#fontScaleLabel').textContent().catch(() => null);
  log.push('字号label: ' + JSON.stringify(fs0) + ' -> ' + JSON.stringify(fs1));
  // 状态栏缩放
  const ss0 = await page.locator('#statusScaleLabel').textContent().catch(() => null);
  await page.locator('#statusScalePlus').click({ force: true }).catch(() => {});
  await page.waitForTimeout(120);
  const ss1 = await page.locator('#statusScaleLabel').textContent().catch(() => null);
  log.push('状态栏缩放label: ' + JSON.stringify(ss0) + ' -> ' + JSON.stringify(ss1));
  if (ss0 !== null && ss0 === ss1) push('SETTINGS', '点状态栏放大A＋后标签未变化（' + ss1 + '），反馈可能不生效');
  await page.locator('#statusScaleReset').click({ force: true }).catch(() => {});
  await page.waitForTimeout(120);
  const ss2 = await page.locator('#statusScaleLabel').textContent().catch(() => null);
  log.push('状态栏复位label: ' + JSON.stringify(ss2));
  // 版本显示
  const vc = await page.locator('#verCurrent').textContent().catch(() => null);
  const vcnt = await page.locator('#verContent').textContent().catch(() => null);
  log.push('版本 verCurrent=' + JSON.stringify(vc) + ' verContent=' + JSON.stringify(vcnt));
  if (vc && !vc.includes('7.6.3')) push('SETTINGS', '设置页显示版本=' + vc + ' 期望含7.6.3');
  // 主题切换（tileNight）
  const night0 = await page.evaluate(() => localStorage.getItem('storyNightMode'));
  await page.locator('#tileNight').click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  const night1 = await page.evaluate(() => localStorage.getItem('storyNightMode'));
  log.push('夜间模式存储: ' + night0 + ' -> ' + night1);
  if (night0 === night1) push('SETTINGS', '点击深夜护眼后 localStorage.storyNightMode 未变化（无反馈）');
  await c.close();
}
// === studio 输入与发送 ===
{
  const c = await ctx(), page = await c.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(BASE + '/studio.html?genre=shengtang', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const inp = page.locator('#userInput');
  if (await inp.count()) {
    await inp.fill('测试：今晚月色真美').catch(() => {});
    const val = await inp.inputValue().catch(() => '');
    log.push('studio输入框填入=' + JSON.stringify(val.slice(0, 20)));
    if (!val.includes('今晚月色真美')) push('STUDIO', '主输入框无法键入文字');
  } else push('STUDIO', '找不到主输入框 #userInput');
  // 主题按钮
  const th = page.locator('#themeBtn');
  if (await th.count()) { const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme')); await th.click({ force: true }).catch(() => {}); await page.waitForTimeout(200); const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme')); log.push('主题: ' + before + ' -> ' + after); }
  await c.close();
}
// === 世界切换一致性 ===
{
  const c = await ctx(), page = await c.newPage();
  for (const g of ['wangyou', 'scifi', 'mystery', 'cthulhu', 'free']) {
    await page.goto(BASE + '/studio.html?genre=' + g, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const title = await page.title().catch(() => '');
    // 检查页面可见 genreName 是否为空/未知
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    if (/未知世界|undefined|NaN/.test(bodyText)) push('WORLD:' + g, '页面首屏出现 未知世界/undefined/NaN：' + (bodyText.match(/.{0,30}(未知世界|undefined|NaN).{0,30}/) || [''])[0]);
    log.push('世界' + g + ' title=' + title.slice(0, 20));
  }
  await c.close();
}
await browser.close();
writeFileSync(OUT, JSON.stringify(issues, null, 2));
writeFileSync(OUT.replace('.json', '.log.txt'), log.join('\n'));
console.log('LOG:\n' + log.join('\n'));
console.log('\n===== 深度实测问题 (' + issues.length + ') =====');
issues.forEach((x, i) => console.log((i + 1) + '. [' + x.tag + '] ' + x.text));
