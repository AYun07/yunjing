/* v4.49.0 真浏览器验证：NSFW三态 + 装备词条 + 称号即时加成 */
import { chromium } from 'playwright-core';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } }

const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8931/studio.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000); // 等 batch 懒加载

console.log('\n===== 1. 三新模块加载 =====');
const mods = await p.evaluate(() => ({
  beast: !!window.BeastSystem, bridge: !!window.BeastProfileBridge,
  bonus: !!window.BonusEngine, title: !!window.TitleSystem,
  bonVer: window.BonusEngine && window.BonusEngine.VERSION,
  titleVer: window.TitleSystem && window.TitleSystem.VERSION
}));
ok(mods.beast && mods.bridge, '宠物系统 + 桥接层已加载');
ok(mods.bonus, 'BonusEngine 已加载');
ok(mods.title, 'TitleSystem 已加载');
ok(mods.bonVer === '4.49.0' && mods.titleVer === '4.49.0', '新模块版本 4.49.0');

console.log('\n===== 2. NSFW 三态 =====');
const r2 = await p.evaluate(() => {
  const BS = window.BeastSystem, BP = window.BeastProfileBridge, IA = window.IntimacyArchive;
  BS.list().forEach(x => BS.release(x.id));
  const pet = BS.contract({ kind: 'pet', name: '测试雪团', trait: '黏人' }); // 不可化形
  const states = [];
  states.push(BS.formStateOf(pet));
  const spirit = BS.contract({ kind: 'spirit', name: '测试青羽鹤', realmIdx: 6 });
  [ 'half', 'human', 'beast' ].forEach(s => { BS.transform(spirit.id, s); states.push(BS.formStateOf(BS.get(spirit.id))); });
  // NSFW：系统开 + 资格开，三态均可
  if (IA && IA.setEnabled) IA.setEnabled(true);
  BS.setNsfwEligible(spirit.id, true);
  BS.transform(spirit.id, 'beast');
  const gBeast = BP.eligibleNSFW(BS.get(spirit.id)).ok;
  BS.transform(spirit.id, 'half');
  const gHalf = BP.eligibleNSFW(BS.get(spirit.id)).ok;
  BS.transform(spirit.id, 'human');
  const gHuman = BP.eligibleNSFW(BS.get(spirit.id)).ok;
  // 不可化形宠物兽形也可
  BS.setNsfwEligible(pet.id, true);
  const gPet = BP.eligibleNSFW(BS.get(pet.id)).ok;
  // key 三态共用
  const k1 = BP.intimacyKey({ id: 'zz', name: 'zz' });
  const k2 = BP.intimacyKey({ id: 'zz', name: 'zz', formState: 'human', transformForm: '化形' });
  return { states, gBeast, gHalf, gHuman, gPet, keyShared: k1 === k2 };
});
ok(r2.states[0] === 'beast', '不可化形宠物恒兽形');
ok(r2.states.slice(1).join() === 'half,human,beast', '三态指定切换正确');
ok(r2.gBeast && r2.gHalf && r2.gHuman, '兽形/半兽形/人形三态均可建亲密档案');
ok(r2.gPet, '不可化形宠物兽形亦可建亲密档案');
ok(r2.keyShared, '三态共用一份亲密档案 key');

console.log('\n===== 3. 装备词条即时计算 =====');
const r3 = await p.evaluate(() => {
  const BE = window.BonusEngine;
  BE.setAffixOverride('测试灵宝剑', [ { id: 'sharp', value: 5 }, { id: 'blunt', value: -2 } ]);
  const v = window.storyFramework.storyState.variables;
  v['装备'] = { '武器': '测试灵宝剑' };
  BE.recompute();
  const net = BE.netMods();
  return { atk: net.atk, buffs: net.buffs.length, debuffs: net.debuffs.length,
    desc: BE.describe(), sources: net.sources.map(s => s.text) };
});
ok(r3.atk === 3, '攻击净值 +5-2=+3（增益减益即时结算）');
ok(r3.buffs >= 1 && r3.debuffs >= 1, '增益与减益都计入');
ok(r3.sources.length === 2, '逐条来源明细保留');
console.log('   净加成：' + r3.desc);

console.log('\n===== 4. 称号即时加成 + 同源叠加 =====');
const r4 = await p.evaluate(() => {
  const BE = window.BonusEngine, TS = window.TitleSystem;
  // 直接写 state 制造已佩戴称号（绕过解锁条件）
  localStorage.setItem('yunjingTitles~main', JSON.stringify({ claimed: { t_bulwark: true }, worn: 't_bulwark' }));
  TS.recompute();
  BE.recompute();
  const net = BE.netMods();
  return { title: net.title, atk: net.atk, hp: net.hp, cur: TS.current(),
    atkSources: net.sources.filter(s => s.stat === 'atk').length };
});
ok(r4.cur === '独当一面', '当前称号正确');
ok(r4.title === '独当一面', 'BonusEngine 读到称号');
ok(r4.atk === 8 && r4.hp === 10, '攻击净值=词条3+称号5=8、气血=10（同源叠加）');
ok(r4.atkSources === 3, '攻击三个独立来源（锋锐+钝锋+称号）均未丢失');

console.log('\n===== 5. 面板与 UI 无溢出/无报错 =====');
const r5 = await p.evaluate(() => {
  // 打开装备抽屉面板（若入口存在）与称号阁
  try { window.TitleSystem.openUI(); } catch (e) {}
  const ts = document.getElementById('tsMask');
  const panel = ts && ts.querySelector('.ts-panel');
  let overflow = false;
  if (panel) {
    const r = panel.getBoundingClientRect();
    overflow = r.right > window.innerWidth + 2 || r.bottom > window.innerHeight + 2 || r.left < -2;
  }
  return { tsOpen: !!(ts && ts.classList.contains('show')), cards: ts ? ts.querySelectorAll('.ts-card').length : 0, overflow };
});
ok(r5.tsOpen, '称号阁面板可打开');
ok(r5.cards >= 6, '称号阁含 ' + r5.cards + ' 个称号');
ok(!r5.overflow, '称号阁面板无越界溢出');
ok(errs.length === 0, '全程零 console error / pageerror' + (errs.length ? '：' + errs.slice(0,3).join(' | ') : ''));

console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
await b.close();
if (fail > 0) process.exit(1);
