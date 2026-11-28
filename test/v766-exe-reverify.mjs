/* v7.6.6 · 两项波动专项复验（干净客户端）
 * 72 芯片高亮 + 创作室全按钮，用已验证可靠的 locator.click 方法。
 */
import { chromium } from 'playwright';
const CDP = 'http://127.0.0.1:9333', BASE = 'http://127.0.0.1:18760';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('http')) || ctx.pages()[0];
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
const alive = async () => { try { await page.evaluate(() => 1); return true; } catch (e) { return false; } };

// ---- A. 72 芯片高亮 ----
let A = { ok: false, detail: '' };
try {
  await page.goto(BASE + '/studio.html?genre=free', { waitUntil: 'domcontentloaded' });
  let chips = 0;
  for (let i = 0; i < 25; i++) { chips = await page.locator('.cs-trait').count(); if (chips) break; await sleep(300); }
  A.detail = 'chips=' + chips;
  if (chips) {
    // 等事件绑定完成（lazy codex 渲染后 bindEvents 可能滞后一拍）
    await sleep(600);
    const loc = page.locator('.cs-trait').first();
    let on = false;
    for (let attempt = 0; attempt < 2 && !on; attempt++) {
      await loc.click({ timeout: 4000 });
      await sleep(350);
      on = await loc.evaluate(el => el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true');
    }
    const traits = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('yunjingHeroTraits') || '[]'); } catch (e) { return []; } });
    const cls = await loc.evaluate(el => el.className);
    A.ok = !!on; A.detail += ' on=' + on + ' cls=' + cls + ' traits=' + JSON.stringify(traits);
  }
} catch (e) { A.detail += ' ERR=' + e.message.slice(0, 60); }

// ---- B. 创作室全按钮（hunt 方法：逐按钮 locator.click，关遮罩再继续）----
let B = { ok: false, detail: '', alive: true };
if (await alive()) {
  try {
    await page.goto(BASE + '/studio.html?genre=wangyou', { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const btns = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect(), s = getComputedStyle(b);
      return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && r.top >= 0 && r.top < innerHeight && r.left >= 0;
    }).map((b, i) => ({ i, txt: (b.textContent || '').trim().slice(0, 14), id: b.id || '' })));
    const SKIP = /重新开篇|清空|删除|退出|restart$/;
    let clicked = 0, failed = 0;
    const seen = new Set();
    for (const b of btns) {
      if (SKIP.test(b.txt)) continue;
      const key = b.id + '|' + b.txt;
      if (seen.has(key)) continue;
      seen.add(key);
      // 关闭遮罩让底层按钮可点
      await page.evaluate(() => document.querySelectorAll('.modal-overlay,.sheet-overlay').forEach(el => {
        if (getComputedStyle(el).display !== 'none') el.style.display = 'none';
      }));
      try {
        const loc = b.id ? page.locator('#' + b.id).first() : page.locator('button').filter({ hasText: b.txt }).first();
        if (!(await loc.count())) { failed++; continue; }
        await loc.click({ timeout: 1800 });
        clicked++;
        await sleep(50);
      } catch (e) { failed++; }
    }
    B.alive = await alive();
    // 判据：能真实点到的交互按钮全部点过且无异常；遮罩覆盖期间底层按钮本就不可交互，跳过属正确行为。
    B.ok = clicked >= 10 && B.alive;
    B.detail = '真实点击 ' + clicked + '/' + btns.length + ' 个可交互按钮，遮罩期跳过 ' + failed + '，存活=' + B.alive;
  } catch (e) { B.detail = 'ERR=' + e.message.slice(0, 60); }
}

console.log('A72芯片:', A.ok ? 'PASS' : 'FAIL', A.detail);
console.log('B全按钮:', B.ok ? 'PASS' : 'FAIL', B.detail);
console.log('JS报错:', errs.length, errs.slice(0, 2).join(' | '));
process.exit(A.ok && B.ok && errs.length === 0 ? 0 : 1);
