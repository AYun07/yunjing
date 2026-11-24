/* v4.47.0 真浏览器验证：心理模型面板 */
import { chromium } from 'playwright';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8931/studio.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4500);

console.log('\n===== 1. 模块加载 =====');
const mods = await p.evaluate(() => ({
  psyche: !!window.PsycheModel, codex: !!window.PersonalityCodex,
  ui: !!window.PersonalityCodexUI, ia: !!window.IntimacyArchive
}));
ok(mods.psyche, 'PsycheModel 已加载');
ok(mods.codex, 'PersonalityCodex 已加载');
ok(mods.ui, 'PersonalityCodexUI 已加载');
ok(mods.ia, 'IntimacyArchive 已加载');

console.log('\n===== 2. 数据层（浏览器内） =====');
const data = await p.evaluate(() => ({
  stats: window.PsycheModel.stats(),
  psyched: window.PersonalityCodex.stats().psyched
}));
ok(data.stats.psyches === 72, `心理档案 72 种（${data.stats.psyches}）`);
ok(data.psyched === 72, `性格世界书已接入心理模型（${data.psyched}）`);

console.log('\n===== 3. 角色档案面板渲染 =====');
await p.evaluate(() => {
  const ui = window.PersonalityCodexUI;
  // 通过内部行为打开并定位到凡人界韩立
  ui.open();
});
await p.waitForTimeout(400);
// 用界面控件切到 fanrenxiuxian + 韩立
await p.evaluate(() => {
  const sel = document.querySelector('.codex-world');
  if (sel) { sel.value = 'fanrenxiuxian'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await p.waitForTimeout(300);
await p.evaluate(() => {
  const inp = document.querySelector('.codex-role');
  if (inp) { inp.value = '韩立'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
});
await p.waitForTimeout(400);

const view = await p.evaluate(() => {
  const body = document.querySelector('.codex-body');
  const psy = body && body.querySelector('.psy-block');
  return {
    name: body && body.querySelector('.codex-name') ? body.querySelector('.codex-name').textContent : '',
    hasPsy: !!psy,
    fields: psy ? psy.querySelectorAll('.psy-field').length : 0,
    spectrum: psy ? psy.querySelectorAll('.psy-sp').length : 0,
    onStage: psy && psy.querySelector('.psy-sp.on') ? psy.querySelector('.psy-sp.on b').textContent : '',
    essence: psy && psy.querySelector('.psy-essence p') ? psy.querySelector('.psy-essence p').textContent : '',
    fear: psy && psy.querySelector('.psy-fear p') ? psy.querySelector('.psy-fear p').textContent : '',
    selfNamed: !!psy && ['本质','核心恐惧','特有机制'].every(k => psy.textContent.includes(k))
  };
});
ok(view.name === '韩立', `档案角色为韩立（${view.name}）`);
ok(view.hasPsy, '心理模型区已渲染');
ok(view.fields === 7, `七项心理档案齐全（${view.fields}）`);
ok(view.spectrum === 10, `关系光谱 10 阶段（${view.spectrum}）`);
ok(!!view.onStage, `当前关系阶段高亮（${view.onStage}）`);
ok(!!view.essence && !!view.fear, '本质与核心恐惧文本非空');
ok(view.selfNamed, '面板心理档案采用云境自有措辞');

console.log('\n===== 4. 切换角色无报错 =====');
await p.evaluate(() => {
  const inp = document.querySelector('.codex-role');
  if (inp) { inp.value = '墨大夫'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
});
await p.waitForTimeout(400);
const name2 = await p.evaluate(() => {
  const b = document.querySelector('.codex-body .codex-name');
  return b ? b.textContent : '';
});
ok(name2 === '墨大夫', `切换到墨大夫正常（${name2}）`);

await p.screenshot({ path: '/workspace/云境-心理模型面板-v4.47.0.png' });

console.log('\n===== 5. 控制台错误 =====');
ok(errs.length === 0, `0 报错${errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''}`);

await b.close();
console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
