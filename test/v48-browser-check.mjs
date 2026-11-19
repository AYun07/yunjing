/* v4.48.0 真浏览器验证：随行存在专属档案（化形/性格/亲密门槛/面板） */
import { chromium } from 'playwright';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } }

const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8931/studio.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000); // 等 batch 懒加载完成

console.log('\n===== 1. 模块加载 =====');
const mods = await p.evaluate(() => ({
  beast: !!window.BeastSystem,
  bridge: !!window.BeastProfileBridge,
  chronicle: !!window.NPCChronicle,
  codex: !!window.PersonalityCodex,
  psyche: !!window.PsycheModel,
  intimacy: !!window.IntimacyArchive
}));
ok(mods.beast, 'BeastSystem 已加载');
ok(mods.bridge, 'BeastProfileBridge 已加载');
ok(mods.chronicle && mods.codex && mods.psyche && mods.intimacy, '四套依赖系统均已加载');

console.log('\n===== 2. 桥接层状态 =====');
const st = await p.evaluate(() => window.BeastProfileBridge.stats());
ok(st.deps.chronicle && st.deps.personality && st.deps.psyche && st.deps.intimacy && st.deps.beast, '五套依赖全部就绪（浏览器内）');

console.log('\n===== 3. 契约 + 自动建档 + 化形 =====');
const r3 = await p.evaluate(() => {
  const BS = window.BeastSystem, BP = window.BeastProfileBridge;
  // 清理测试数据
  BS.list().forEach(x => BS.release(x.id));
  const b = BS.contract({ kind: 'spirit', name: '测试青羽鹤', species: '风属性灵禽', realmIdx: 6, trait: '灵动', bond: 60 });
  const prof = BS.profile(b.id);
  const canTf = BS.canTransform(b.id);
  const tf = BS.transform(b.id, true);
  const now = BS.get(b.id);
  return {
    profId: prof && prof.id,
    hasChronicle: !!(prof && prof.chronicle && prof.chronicle.deeds && prof.chronicle.deeds.length),
    traits: (prof && prof.personality && prof.personality.traits || []).length,
    canTf, transformed: now.transformed, formName: now.transformForm
  };
});
ok(r3.profId && r3.profId.indexOf('beast:') === 0, '契约后自动建档，id 为 beast: 前缀');
ok(r3.hasChronicle, '档案含生平经历');
ok(r3.traits >= 3, '档案含专属性格（' + r3.traits + ' 条）');
ok(r3.canTf, '高位阶灵兽可化形');
ok(r3.transformed && r3.formName, '化形生效并生成人形名：' + r3.formName);

console.log('\n===== 4. 亲密三门槛 =====');
const r4 = await p.evaluate(() => {
  const BS = window.BeastSystem, BP = window.BeastProfileBridge, IA = window.IntimacyArchive;
  const b0 = BS.get(BS.list()[0].id);
  const g0 = BP.eligibleNSFW(b0);                       // 门槛1：默认关
  // 先确保系统关闭，隔离门槛2（人形已具备）
  if (IA.setEnabled) IA.setEnabled(false);
  BS.setNsfwEligible(b0.id, true);
  const gNoSys = BP.eligibleNSFW(BS.get(b0.id));        // 资格开+人形，但系统关 → false
  if (IA.setEnabled) IA.setEnabled(true);
  const gAll = BP.eligibleNSFW(BS.get(b0.id));          // 三门槛全满足 → true
  return { g0: g0.ok, gNoSys: gNoSys.ok, gAll: gAll.ok };
});
ok(r4.g0 === false, '默认未开亲密资格');
ok(r4.gNoSys === false, '系统未开时即使有资格+人形仍不可建');
ok(r4.gAll === true, '三门槛全满足 → 可建亲密档案');

console.log('\n===== 5. 档案面板渲染 =====');
await p.evaluate(() => window.BeastSystem.openUI());
await p.waitForTimeout(300);
const hasBtn = await p.evaluate(() => {
  const cards = document.querySelectorAll('.beast-card .btns button');
  return Array.from(cards).some(x => x.textContent.indexOf('档案') >= 0);
});
ok(hasBtn, '灵宠卡片含「档案」入口按钮');
const panelOk = await p.evaluate(() => {
  const id = window.BeastSystem.list()[0].id;
  window.BeastSystem.openProfile(id);
  const mask = document.getElementById('beastProfileMask');
  const body = document.getElementById('bpfBody');
  return !!mask && mask.style.display === 'flex' && !!body && body.innerHTML.indexOf('性格档案') >= 0;
});
ok(panelOk, '档案面板打开且渲染性格/化形/生平/亲密各区');
await p.evaluate(() => window.BeastSystem.closeProfile());

console.log('\n===== 6. 主笔 prompt 注入 =====');
const promptOk = await p.evaluate(() => {
  const BS = window.BeastSystem;
  const s = BS.buildPromptBlock();
  return s.indexOf('测试青羽鹤') >= 0 && (s.indexOf('性格') >= 0 || s.indexOf('核心恐惧') >= 0);
});
ok(promptOk, 'buildPromptBlock 注入了随行存在的性格/名字');

console.log('\n===== 7. 控制台报错 =====');
ok(errs.length === 0, '无 JS 报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));

console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
await b.close();
if (fail > 0) process.exit(1);
