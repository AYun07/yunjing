// 云境 · NPC 编年史引擎回归（原创实现，机制层测试）
// 用法：node test/npc-chronicle-regression.mjs
// 零依赖，Node vm 沙箱加载 js/npc-chronicle.js，验证六项机制：
//   ①四轴态度 clamp+棘轮 ②经历时间线分层裁剪 ③只增不删档案库
//   ④离场确定性自治（零 API）⑤驱动力静滞闸门 ⑥认知边界
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/npc-chronicle.js'), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};

const sb = { console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const N = sb.NPCChronicle;

G('0. 模块加载与版权/接口');
ok(!!N, 'NPCChronicle 已挂载');
ok(N.VERSION === '1.0.0', '版本号正确');
ok(Array.isArray(N.AXES) && N.AXES.length === 4, '四轴态度定义存在');

G('1. 四轴态度：clamp 与棘轮');
{
  let r = N.ensure({ name: '甲' });
  ok(r.disposition.trust === 0 && r.disposition.guard === 0, '新档案四轴归零');
  let a = N.applyDisposition(r, { trust: 30, favor: 20, guard: 10 });
  ok(a.record.disposition.trust === 30 && a.record.disposition.guard === 10, '增量赋值生效');
  let b = N.applyDisposition(a.record, { trust: -15, favor: -99, guard: -5 });
  ok(b.record.disposition.trust === 30, '棘轮：正向轴不倒退（信任仍 30）');
  ok(b.record.disposition.favor === 20, '棘轮：好感不倒退');
  ok(b.record.disposition.guard === 5, '棘轮：戒备可下降（10→5）');
  let c = N.applyDisposition(r, { trust: 999 }, { ratchet: false });
  ok(c.record.disposition.trust === 100, '关闭棘轮时 clamp 到 100');
  let d = N.applyDisposition(r, { trust: -999 }, { ratchet: false });
  ok(d.record.disposition.trust === 0, '关闭棘轮时 clamp 到 0');
}

G('2. 经历时间线：分层留存上限');
{
  let minor = N.ensure({ name: '路人', importance: 'minor' });
  for (let i = 0; i < 12; i++) minor = N.addDeed(minor, { text: '事' + i }).record;
  ok(minor.deeds.length === 5, '路人只留最近 5 条');
  ok(minor.deeds[minor.deeds.length - 1].text === '事11', '保留的是最新条目');
  let core = N.ensure({ name: '挚友', isBond: true });
  for (let i = 0; i < 40; i++) core = N.addDeed(core, { text: '记' + i }).record;
  ok(core.deeds.length === 40, '羁绊角色留全生平（未超 60）');
  let normal = N.ensure({ name: '常客' });
  for (let i = 0; i < 30; i++) normal = N.addDeed(normal, { text: 'x' + i }).record;
  ok(normal.deeds.length === 12, '普通角色留 12 条');
}

G('3. 只增不删档案库');
{
  const before = N.vaultSize();
  let r = N.ensure({ name: '将离', disposition: { trust: 80 } });
  const ar = N.archive(r, 'dedupe');
  ok(ar.archived === true, '归档成功');
  ok(N.vaultSize() === before + 1, '库房条目 +1');
  const restored = N.restore('将离');
  ok(restored && restored.disposition.trust === 80, '可完整取回快照');
  N.archive(r, 'again');
  ok(N.vaultSize() === before + 1, '同 id 再归档不新增条目（覆盖快照）');
  ok(N.restore('不存在') === null, '不存在的 id 返回 null');
}

G('4. 离场自治：确定性 + 零 API + 有界成长');
{
  const mk = () => N.ensure({ name: '游侠', id: 'ranger', npcTag: 'contractor', tier: 'low', attr: 28 });
  const a = N.autonomyTick(mk(), { round: 5, seed: 'S' });
  const b = N.autonomyTick(mk(), { round: 5, seed: 'S' });
  ok(a.phase === b.phase && a.deed === b.deed && a.growthDelta === b.growthDelta, '同种子同回合结果完全一致（确定性）');
  ok(a.phase === 'mission' || a.phase === 'rest', '契约者相位在任务/休整间');
  let capped = N.ensure({ name: '满级', tier: 'low', attr: 30 });
  for (let i = 0; i < 50; i++) capped = N.autonomyTick(capped, { round: i, seed: 'X' }).record;
  ok(capped.attr <= 30, '低阶角色成长封顶不越档（≤30）');
  let native = N.autonomyTick(N.ensure({ name: '村夫', npcTag: 'native' }), { round: 1 }).record;
  ok(native.auto.phase === 'home', '土著留在故地相位');
}

G('5. 驱动力静滞闸门（省 token）');
{
  ok(N.driveGate(N.ensure({ name: '宠', npcTag: 'pet' }), {}).active === true, '随从恒有驱动');
  ok(N.driveGate(N.ensure({ name: '冻', frozenAt: 1 }), {}).active === false, '冻结者静滞');
  ok(N.driveGate(N.ensure({ name: '孤', npcTag: 'contractor' }), {}).active === false, '无驱动的契约者静滞');
  const ctx = { situation: { taskFor: { '孤': true } } };
  ok(N.driveGate(N.ensure({ name: '孤', npcTag: 'contractor' }), ctx).active === true, '有任务时契约者被激活');
  const natives = [N.ensure({ name: '甲', npcTag: 'native' }), N.ensure({ name: '乙', npcTag: 'native', isBond: true })];
  const adv = N.tickRoster(natives, { round: 1 });
  ok(adv.length === 1 && adv[0].id === '乙', '批量自治只推进有驱动者');
}

G('6. 认知边界');
{
  const r = N.ensure({ name: ' Alice ' });
  const rn = N.ensure({ name: 'Bob' });
  ok(N.canKnow(r, { visibility: 'known' }) === true, '公开事件人人可知');
  const secret = { visibility: 'hidden', knownBy: ['Alice'] };
  ok(N.canKnow(N.ensure({ name: 'Alice' }), secret) === true, '点名知情人可见');
  ok(N.canKnow(rn, secret) === false, '非知情人不可见私密事件');
}

console.log('\n========================================');
console.log(`NPC 编年史回归：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
