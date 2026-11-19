// v4.45.0 真浏览器验证：动态关系 + 性格世界书面板
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:8931/studio.html';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500); // 等 lazy batch 加载

const result = {};
result.globals = await page.evaluate(() => ({
  codex: !!window.PersonalityCodex,
  codexUI: !!window.PersonalityCodexUI,
  bridge: !!window.RelationCodexBridge,
  ia: !!window.IntimacyArchive,
  iaUI: !!window.IntimacyUI
}));

// 性格世界书面板
await page.evaluate(() => window.PersonalityCodexUI && window.PersonalityCodexUI.open());
await page.waitForTimeout(400);
result.codexVisible = await page.evaluate(() => {
  const ov = document.getElementById('codex-overlay');
  return !!ov && getComputedStyle(ov).display !== 'none';
});
result.codexProfile = await page.evaluate(() => {
  const p = document.querySelector('#codex-overlay .codex-profile');
  const name = document.querySelector('#codex-overlay .codex-name');
  const orient = document.querySelector('#codex-overlay .codex-orient');
  return { hasProfile: !!p, name: name ? name.textContent : '', orient: orient ? orient.textContent : '' };
});
// 切换角色查档
result.codexSwitch = await page.evaluate(() => {
  const chip = document.querySelectorAll('#codex-overlay .codex-chip')[3];
  if (chip) { chip.click(); return true; }
  return false;
});
await page.waitForTimeout(300);
result.codexAfterSwitch = await page.evaluate(() => {
  const n = document.querySelector('#codex-overlay .codex-name');
  return n ? n.textContent : '';
});
await page.evaluate(() => window.PersonalityCodexUI && window.PersonalityCodexUI.close());

// 动态关系面板
await page.evaluate(() => {
  const A = window.IntimacyArchive;
  if (A) {
    A.setEnabled(true);
    A.setRelation('测试角色', { favor: 55, trust: -30, closeness: 40 });
  }
  window.IntimacyUI && window.IntimacyUI.open();
});
await page.waitForTimeout(400);
result.iaVisible = await page.evaluate(() => {
  const ov = document.getElementById('intimacy-overlay');
  return !!ov && getComputedStyle(ov).display !== 'none';
});
result.iaAxes = await page.evaluate(() => document.querySelectorAll('#intimacy-overlay .ia-ax').length);
result.iaExprBtns = await page.evaluate(() => document.querySelectorAll('#intimacy-overlay .ia-expr').length);
result.iaStage = await page.evaluate(() => {
  const s = document.querySelector('#intimacy-overlay .ia-stage');
  return s ? s.textContent : '';
});
// 切换表达尺度到露骨
result.exprSwitch = await page.evaluate(() => {
  const btns = document.querySelectorAll('#intimacy-overlay .ia-expr');
  for (const b of btns) if (b.getAttribute('data-expr') === 'explicit') { b.click(); return true; }
  return false;
});
await page.waitForTimeout(300);
result.exprNow = await page.evaluate(() => window.IntimacyArchive ? window.IntimacyArchive.expressionInfo().current : '');
// 锁定按钮
result.lockBtn = await page.evaluate(() => document.querySelectorAll('#intimacy-overlay .ia-lock').length);

// 桥接状态
result.bridgeStatus = await page.evaluate(() => window.RelationCodexBridge ? window.RelationCodexBridge.status() : null);

result.errors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
