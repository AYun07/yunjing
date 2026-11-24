import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

await p.goto('http://127.0.0.1:8931/studio.html?genre=fanrenxiuxian', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);

console.log('=== 模块加载 ===');
const mods = await p.evaluate(() => ({
  codex: !!window.PersonalityCodex, ui: !!window.PersonalityCodexUI,
  bridge: !!window.RelationCodexBridge, st: window.PersonalityCodex && window.PersonalityCodex.stats()
}));
ok(mods.codex && mods.ui && mods.bridge, '三个性格模块全局已加载');
ok(mods.st.traitTypes >= 60, `辞典≥60种（${mods.st.traitTypes}）`);
ok(mods.st.canonRoles >= 80, `原著角色≥80位（${mods.st.canonRoles}）`);

console.log('=== 角色档案面板 ===');
await p.evaluate(() => window.PersonalityCodexUI.open());
await p.waitForTimeout(400);
let view = await p.evaluate(() => {
  const el = document.querySelector('#codex-overlay');
  return { visible: el && el.style.display === 'flex', text: el ? el.innerText : '' };
});
ok(view.visible, '世界书面板打开');
ok(view.text.includes('原著'), '显示原著徽标/原著锚点区');
ok(view.text.includes('谨慎多疑'), '韩立原著性格锚点显示');
ok(view.text.includes('条性格'), '显示性格条数');
const faceCount = await p.evaluate(() => document.querySelectorAll('#codex-overlay .codex-face').length);
ok(faceCount >= 10, `角色≥10条性格（${faceCount}）`);
await p.screenshot({ path: '/workspace/云境-性格世界书-角色档案-v4.46.0.png' });

console.log('=== 性格辞典面板 ===');
await p.evaluate(() => document.querySelector('#codex-overlay .codex-tabs button[data-tab="dict"]').click());
await p.waitForTimeout(300);
const dict = await p.evaluate(() => ({
  cats: document.querySelectorAll('#codex-overlay .codex-dict-cat').length,
  items: document.querySelectorAll('#codex-overlay .codex-dict-item').length,
  text: document.querySelector('#codex-overlay .codex-body').innerText
}));
ok(dict.cats === 6, `辞典6大类（${dict.cats}）`);
ok(dict.items >= 60, `辞典≥60种条目（${dict.items}）`);
ok(['正面','负面','奇葩','阴暗','病态','复杂'].every(k => dict.text.includes(k)), '六类名称齐全');
await p.screenshot({ path: '/workspace/云境-性格辞典-v4.46.0.png' });

console.log('=== 玩家调性格面板 ===');
await p.evaluate(() => document.querySelector('#codex-overlay .codex-tabs button[data-tab="player"]').click());
await p.waitForTimeout(300);
await p.evaluate(() => {
  const inp = document.querySelector('#codex-overlay .codex-newface');
  inp.value = '阴暗';
  document.querySelector('#codex-overlay .codex-addface').click();
});
await p.waitForTimeout(300);
const player = await p.evaluate(() => {
  const txt = document.querySelector('#codex-overlay .codex-body').innerText;
  const faces = [...document.querySelectorAll('#codex-overlay .codex-face b')].map(x => x.textContent);
  return { txt, hasYinAn: faces.includes('阴暗'), count: faces.length };
});
ok(player.hasYinAn, '添加"阴暗"性格即时生效');
ok(player.count >= 10, `调整后仍≥10条（${player.count}）`);
await p.screenshot({ path: '/workspace/云境-玩家调性格-v4.46.0.png' });

console.log('=== 行为演化 ===');
const beh = await p.evaluate(() => {
  const BR = window.RelationCodexBridge;
  BR.resetStats();
  window.dispatchEvent(new CustomEvent('yj:world-tick', { detail: { day: 5, span: 2, ev: '敌人追杀' } }));
  const list = BR.behaviorsNow(20);
  return { n: list.length, hasHan: list.some(x => x.name === '韩立'), rationale: (list.find(x => x.name === '韩立') || {}).rationale };
});
ok(beh.n > 0 && beh.hasHan, '世界时钟驱动行为台账');
ok(beh.rationale && beh.rationale.includes('轨迹'), '行为含轨迹依据');

console.log('=== 报错检查 ===');
ok(errors.length === 0, `0 报错（${errors.length}）`);
if (errors.length) errors.slice(0, 5).forEach(e => console.log('   ', e));

await b.close();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
