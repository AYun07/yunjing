// 云境 · NPC 编年史桥接层回归（原创实现）
// 用法：node test/npc-bridge-regression.mjs
// 零依赖 vm 沙箱：先载 npc-chronicle.js 再载 npc-bridge.js，验证 B2/B3/B5 桥接逻辑。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ ' + msg); } };

function makeSandbox(npcs) {
  const sb = {
    console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
    setInterval: () => 99, clearInterval() {}, addEventListener() {},
    showToast() {},
    storyFramework: { storyState: { turnCount: 7 } },
  };
  sb.window = sb; sb.globalThis = sb;
  // 模拟 WorldRuntime.NPC
  const store = Object.assign({}, npcs);
  sb.WorldRuntime = {
    NPC: {
      list: () => Object.keys(store).map(k => store[k]),
      get: (n) => store[n] || null,
      upsert(e) { store[e.name] = e; return e; },
      remove(n) { if (store[n]) { delete store[n]; return true; } return false; },
    }
  };
  sb.__store = store;
  return sb;
}

function load(sb) {
  vm.createContext(sb);
  vm.runInContext(read('js/npc-chronicle.js'), sb);
  vm.runInContext(read('js/npc-bridge.js'), sb);
  return { NC: sb.NPCChronicle, B: sb.NPCBridge };
}

G('0. 桥接层加载');
{
  const sb = makeSandbox({});
  const { NC, B } = load(sb);
  ok(!!NC && !!B, 'Chronicle 与 Bridge 均已挂载');
  ok(B.VERSION === '1.0.0', '桥接层版本号正确');
}

G('1. B2 数据桥接与棘轮写回');
{
  const sb = makeSandbox({
    '甲': { id: 'n1', name: '甲', trust: 50, 好感: 40, npcTag: 'contractor', tier: 'mid' }
  });
  const { B } = load(sb);
  B.syncAll();
  ok(sb.__store['甲'].trust === 50, 'syncAll 写回信任');
  const disp = B.applyDisposition('甲', { trust: 20, 好感: -100 });
  ok(disp.trust === 70, '增量经桥接写回（50+20=70）');
  ok(disp.favor === 40, '棘轮：好感 40 不被 -100 拉回');
  ok(sb.__store['甲'].trust === 70 && sb.__store['甲'].好感 === 40, '写回已持久化到 NPC 记录');
  ok(Array.isArray(sb.__store['甲'].chronicleDeeds), '经历数组字段已建立');
}

G('2. B2 归档（只增不删）');
{
  const sb = makeSandbox({ '乙': { id: 'n2', name: '乙', trust: 60 } });
  const { NC, B } = load(sb);
  const before = NC.vaultSize();
  B.archiveBeforeRemove('乙');
  ok(NC.vaultSize() === before + 1, '删除前已归档快照');
  ok(NC.restore('n2') && NC.restore('n2').name === '乙', '档案可取回');
}

G('3. B5 驱动力闸门 + B3 自治');
{
  const sb = makeSandbox({
    '宠': { id: 'p', name: '宠', npcTag: 'pet', trust: 50 },
    '孤': { id: 'g', name: '孤', npcTag: 'contractor', trust: 10, isBond: false }
  });
  const { B } = load(sb);
  const a = B.driveOne('宠', {});
  ok(a.active === true && /随侍/.test(a.reason), '随侍恒有驱动');
  const b = B.driveOne('孤', {});
  ok(b.active === false && /静滞/.test(b.reason), '无驱动行者静滞（省 token）');
  const c = B.driveOne('孤', { situation: { taskFor: { '孤': true } } });
  ok(c.active === true && /任务/.test(c.reason), '有任务时行者被激活');
}

G('4. B3 认知边界过滤');
{
  const sb = makeSandbox({});
  const { B } = load(sb);
  const events = [
    { text: '公开', visibility: 'known' },
    { text: '秘密', visibility: 'hidden', knownBy: ['甲'] }
  ];
  ok(B.visibleEventsFor('甲', events).length === 2, '知情人看到 2 条');
  ok(B.visibleEventsFor('乙', events).length === 1, '非知情人只看到 1 条');
}

G('4b. 中文键态度 patch 与角色标记（真浏览器发现的缺口）');
{
  const sb = makeSandbox({
    '丁': { id: 'd', name: '丁', trust: 30, npcTag: 'contractor' }
  });
  const { B } = load(sb);
  B.syncAll();
  const disp = B.applyDisposition('丁', { 好感: 25, 信任: 10 });
  ok(disp.favor === 25 && disp.trust === 40, '中文键「好感/信任」被正确归一化写入');
  const role = B.setRole('丁', 'pet', { bond: true });
  ok(role.npcTag === 'pet' && role.isBond === true, 'setRole 标记类型与羁绊');
  ok(sb.__store['丁'].npcTag === 'pet', '类型写入自定义属性（绕开 upsert 白名单）');
  const drive = B.driveOne('丁', {});
  ok(drive.active === true && /随侍/.test(drive.reason), '标记后随侍恒有驱动');
}

G('5. onWorldTick 批量驱动');
{
  const sb = makeSandbox({
    '宠': { id: 'p', name: '宠', npcTag: 'pet', trust: 50, isBond: true }
  });
  const { B } = load(sb);
  const adv = B.onWorldTick({});
  ok(Array.isArray(adv), 'onWorldTick 返回数组');
  ok(adv.some(x => x.name === '宠'), '随侍本轮被推进');
}

console.log('\n========================================');
console.log(`NPC 桥接层回归：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
