import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const out = {};

async function mkpage(path) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: '7.0.2' }),
      getSyncStatus: () => Promise.resolve({ version: '7.0.2', lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 180)); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { ctx, page, errs };
}

// studio 创作室（扮演模式默认，free genre）
{
  const { ctx, page, errs } = await mkpage('/studio.html?genre=fanrenxiuxian');
  // 向导是否渲染
  const before = await page.evaluate(() => {
    const fate = document.querySelector('.fate-btn');
    const back = document.querySelector('.back-link');
    const clock = document.getElementById('worldClockPill');
    let backHit = null, backRect = null;
    if (back) {
      const r = back.getBoundingClientRect();
      backRect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      backHit = el ? (el.className || el.tagName) : null;
      backHit = typeof backHit === 'string' ? backHit.slice(0, 60) : backHit;
    }
    return {
      hasWizard: !!document.querySelector('#setupWrap'),
      fateBtn: !!fate,
      fateText: fate ? fate.textContent.trim() : null,
      backRect, backHit,
      clock: clock ? (() => { const r = clock.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), disp: getComputedStyle(clock).display }; })() : null,
      heroFields: {
        look: !!document.getElementById('wiz_heroLook'),
        persona: !!document.getElementById('wiz_heroPersona'),
        bio: !!document.getElementById('wiz_heroBio')
      },
      csBtns: ['csLook','csPersona','csIcon'].map(id => ({ id, exists: !!document.getElementById(id) }))
    };
  });
  // 点随缘开局，看是否有字段被填充
  let fateResult = null;
  if (before.fateBtn) {
    const nameBefore = await page.evaluate(() => { const e = document.getElementById('wiz_heroName'); return e ? e.value : null; });
    await page.click('.fate-btn').catch(e => { fateResult = 'CLICK_ERR: ' + e.message.slice(0, 100); });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const e = document.getElementById('wiz_heroName');
      return { name: e ? e.value : null, anyFilled: Array.from(document.querySelectorAll('#setupWrap input')).filter(i => i.value && i.value.trim()).length };
    });
    fateResult = fateResult || { nameBefore, ...after, changed: after.name !== nameBefore };
  }
  // 状态栏文字/底色取样
  const statusSample = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[id*="status"],[id*="Status"],[class*="yj-st"],[class*="status"]'));
    return els.slice(0, 15).map(el => {
      const cs = getComputedStyle(el);
      return { id: (el.id || el.className || '').toString().slice(0, 40), color: cs.color, bg: cs.backgroundColor, shadow: cs.textShadow.slice(0, 30) };
    }).filter(x => x.color || x.bg);
  });
  out.studio = { before, fateResult, statusSample, errs: errs.slice(0, 12) };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
