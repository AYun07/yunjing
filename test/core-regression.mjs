// 云境 · 核心引擎回归（v4.42.0）
// 用法：node test/core-regression.mjs
// 覆盖四块核心逻辑：①世界时钟驱动模式 ②多粒度时间量化与逐日演化
//                  ③AIGovernor 全局动态并发闸门 ④存档 gzip 纯 JS 兜底解压。
// 由 v4.39~4.42 四份散落 verify 脚本沉淀合并而来，统一相对路径与桩，
// 修正了旧脚本「桩只给 currentSpanDays、未给 currentSpanQ」导致的假失败。
// 零依赖（Node 内置 vm/fs），不联网、不开浏览器。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};

/* ============ 通用沙箱桩 ============ */
function baseSandbox(extra = {}) {
  const sb = {
    console, Math, JSON, Date, Number, String, Object, Array, Set, Map, RegExp,
    isNaN, isFinite, parseInt, parseFloat, Promise, Error,
    Uint8Array, ArrayBuffer, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      visibilityState: 'visible', addEventListener() {}, dispatchEvent() {},
      getElementById: () => null,
      createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
      body: { appendChild() {} },
    },
    location: { search: '' },
  };
  Object.assign(sb, extra);
  sb.window = sb; sb.globalThis = sb;
  return sb;
}
function loadModule(rel, sb) {
  vm.createContext(sb);
  vm.runInContext(read(rel), sb);
  return sb;
}

/* ============================================================
   1. 世界时钟驱动模式（回合驱动 / 跳时间 / 冻结 / 单飞排队）
   ============================================================ */
function makeClock({ spanQ = null, storedCfg = null } = {}) {
  const listeners = {};
  const sb = baseSandbox({
    setTimeout: (fn) => { fn(); return 0; },   // 回合钩子延后的 tick 在测试中立即执行
    localStorage: {
      getItem: (k) => (k.indexOf('.clock.') >= 0 ? storedCfg : null),
      setItem: (k, v) => { if (k.indexOf('.clock.') >= 0) storedCfg = v; },
    },
    document: {
      visibilityState: 'visible',
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); },
      getElementById: () => null,
      createElement: () => ({ style: { cssText: '' }, appendChild() {}, setAttribute() {}, set onclick(v) {} }),
      body: { appendChild() {} },
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    Event: class { constructor(t) { this.type = t; } },
    showToast: () => {},
  });
  sb.storyFramework = {
    slotId: 'main',
    storyState: { variables: { 时间: { clockDay: 0 }, history: [], entities: {} }, turnCount: 0 },
    saveStory() {},
  };
  // 正确的桩：同时提供 currentSpanQ（v4.40+ 优先）与 currentSpanDays（兼容）
  sb.AttributeEngine = {
    currentSpanQ: () => spanQ,
    currentSpanDays: () => (spanQ ? Math.round(spanQ.days) : 0),
  };
  loadModule('js/world-clock.js', sb);
  return { sb, listeners, day: () => sb.storyFramework.storyState.variables.时间.clockDay };
}
const fireTurn = (ctx) => ctx.sb.document.dispatchEvent(new ctx.sb.CustomEvent('story:turn-saved', { detail: { turn: 1 } }));

G('1. 世界时钟驱动模式');
{
  const c = makeClock();
  const st = c.sb.WorldClock.status();
  ok(st.mode === 'turn', '默认模式为回合驱动（turn）');
  ok(st.wallRunning === false, '默认墙钟 interval 未启动');
  ok(c.day() === 0, '初始世界日为 0');
  fireTurn(c);
  ok(c.day() === 1, '普通回合推进 1 日（0→1）');
}
{
  const c = makeClock({ spanQ: { minutes: 129600, days: 90, text: '三月', level: 'month' } });
  fireTurn(c);
  ok(c.day() === 90, '跳时间（跨度90）世界日推进到 90');
  ok(/跨90日/.test(c.sb.storyFramework.storyState.variables.history.join('|')), '历史日志记录「跨90日」');
}
{
  const c = makeClock();
  c.sb.WorldClock.setMode('off');
  fireTurn(c);
  ok(c.day() === 0, '冻结时回合不推进世界日');
  c.sb.WorldClock.toggle();
  ok(c.sb.WorldClock.status().mode === 'turn', 'toggle 从冻结恢复回合驱动');
}
{
  const c = makeClock({ storedCfg: JSON.stringify({ enabled: true, intervalSec: 180 }) });
  ok(c.sb.WorldClock.status().mode === 'turn', '旧配置(enabled:true)迁移为回合驱动');
  ok(c.sb.WorldClock.status().wallRunning === false, '迁移后墙钟不自启');
}

/* ============================================================
   2. 多粒度解析 + 逐日全量演化 + 单飞排队 + 张力地板 + 约数
   ============================================================ */
function loadAE() {
  return loadModule('js/attribute-engine.js', baseSandbox());
}
function loadClockEvo(spanQ, subs) {
  const listeners = {};
  const sb = baseSandbox({
    setTimeout: (fn) => { fn(); return 0; },
    document: {
      visibilityState: 'visible',
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); },
      getElementById: () => null,
      createElement: () => ({ style: { cssText: '' }, appendChild() {}, setAttribute() {}, set onclick(v) {} }),
      body: { appendChild() {} },
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    Event: class { constructor(t) { this.type = t; } },
    showToast: () => {},
  });
  sb.storyFramework = { slotId: 'main', storyState: { variables: { 时间: { clockDay: 0 }, time: '卯时', history: [], entities: { factions: {}, relations: [] } }, turnCount: 0 }, saveStory() {} };
  sb.AttributeEngine = { currentSpanQ: () => spanQ, currentSpanDays: () => (spanQ ? Math.round(spanQ.days) : 0) };
  sb.NpcSpawn = { daily: () => { subs.npc++; return []; }, driftWills: () => { subs.will++; return []; } };
  sb.LifeMode = { daily: () => { subs.life++; } };
  sb.WorldAlive = { seedFactions: () => { subs.seed++; }, lifecycle: () => { subs.lifecycle++; } };
  sb.SimCore = { advance: () => { subs.sim++; } };
  sb.OpportunitySystem = { roll: () => { subs.opp++; } };
  sb.BeastSystem = { driftAll: () => { subs.beast++; } };
  /* 舆图同步桩：记录每次 syncFactions 调用时的世界日，用于验证「批次末收口同步」。
     逐拍调用发生在 SimCore/lifecycle 之前，收口调用应在所有逐拍之后且世界日=终值。 */
  subs.atlasSyncDays = [];
  subs.atlasOrder = [];
  sb.StoryAtlas = { syncFactions: (vv) => {
    subs.atlasSyncDays.push(vv && vv.时间 ? vv.时间.clockDay : -1);
    subs.atlasOrder.push('sync');
  } };
  // 让 lifecycle 打点，验证最后一次 sync 在所有 lifecycle 之后
  sb.WorldAlive.lifecycle = () => { subs.lifecycle++; subs.atlasOrder.push('life'); };
  loadModule('js/world-clock.js', sb);
  return { sb, fire: () => sb.document.dispatchEvent(new sb.CustomEvent('story:turn-saved', { detail: {} })) };
}

G('2. 多粒度时间量化');
{
  const Q = loadAE().AttributeEngine.parseSpanQuantum;
  ok(Q('一顿饭功夫').level === 'moment' && Q('一顿饭功夫').minutes === 45, '「一顿饭」→45分钟 moment');
  ok(Q('两个时辰').minutes === 240, '「两个时辰」→240分钟');
  ok(Q('过去三天').level === 'day' && Math.round(Q('过去三天').days) === 3, '「过去三天」→3天');
  ok(Q('闭关三月').level === 'month' && Math.round(Q('闭关三月').days) === 90, '「闭关三月」→90天');
  ok(Q('一晃三年').level === 'year' && Math.round(Q('一晃三年').days) >= 1080, '「一晃三年」→≥1080天');
}
G('2b. 中文约数解析（v4.42 新增）');
{
  const C = loadAE().AttributeEngine.parseSpanQuantum;
  // 约数需带语境词（过去/过了/一晃）才被严格模式接受；也可走显式时间.跨度字段
  const ten = C('过去十余日');
  ok(ten.days >= 10 && ten.days <= 20, `「过去十余日」解析为十几日（${ten.days}天）`);
  const dozen = C('过了十数年');
  ok(dozen.days >= 3600 && dozen.days <= 7200, `「过了十数年」解析为十几年（${dozen.days}天≈15年）`);
  const twenty = C('过去二十余日');
  ok(twenty.days >= 20 && twenty.days <= 30, `「过去二十余日」解析为二十几日（${twenty.days}天）`);
  const field = C('时间.跨度: 数十日');
  ok(field.days >= 15, `「时间.跨度: 数十日」解析为约数十日（${field.days}天）`);
}

G('3. 按时间规模逐日全量演化');
{
  const subs = { npc: 0, life: 0, sim: 0, will: 0, seed: 0, lifecycle: 0, opp: 0, beast: 0 };
  const c = loadClockEvo({ minutes: 45, days: 0.031, level: 'moment' }, subs);
  c.fire();
  ok(c.sb.storyFramework.storyState.variables.时间.clockDay === 0, '短时辰后世界日不变');
  ok(subs.sim === 0 && subs.lifecycle === 0, '短时辰不触发势力/大势演化');
  ok(c.sb.storyFramework.storyState.variables.时间.pendingEvents.length > 0, '短时辰产生轻量动态');
}
{
  const subs = { npc: 0, life: 0, sim: 0, will: 0, seed: 0, lifecycle: 0, opp: 0, beast: 0 };
  const c = loadClockEvo({ minutes: 4320, days: 3, level: 'day' }, subs);
  c.fire();
  ok(c.sb.storyFramework.storyState.variables.时间.clockDay === 3, '过去三天 → 世界日 0→3');
  ok(subs.sim === 3 && subs.lifecycle === 3 && subs.npc === 3, '逐日各跑一拍（sim/lifecycle/npc 均=3）');
}
{
  const subs = { npc: 0, life: 0, sim: 0, will: 0, seed: 0, lifecycle: 0, opp: 0, beast: 0 };
  const c = loadClockEvo({ minutes: 1555200, days: 1080, level: 'year' }, subs);
  c.fire();
  ok(subs.sim === 1080, '过去三年 → SimCore 逐日调用 1080 次（真·逐日全量）');
  ok(c.sb.storyFramework.storyState.variables.history.some(x => /跨1080日/.test(x)), '长跨度汇总日志含「跨1080日」');
}
{
  const subs = { npc: 0, life: 0, sim: 0, will: 0, seed: 0, lifecycle: 0, opp: 0, beast: 0 };
  const c = loadClockEvo({ minutes: 99999999, days: 99999, level: 'year' }, subs);
  c.fire();
  ok(c.sb.storyFramework.storyState.variables.时间.clockDay === 3650, '异常超大跨度封顶 3650 日（十年）');
}
G('3a. 舆图随世界演化同步（最后一拍收口，防「地图慢一拍」）');
{
  const subs = { npc: 0, life: 0, sim: 0, will: 0, seed: 0, lifecycle: 0, opp: 0, beast: 0 };
  const c = loadClockEvo({ minutes: 4320, days: 3, level: 'day' }, subs);
  c.fire();
  // 逐拍 3 次 + 批次收口 1 次 = 4 次
  ok(subs.atlasSyncDays.length === 4,
    `3 日演化触发舆图同步 4 次（逐拍3 + 收口1），实际=${subs.atlasSyncDays.length}`);
  const last = subs.atlasSyncDays[subs.atlasSyncDays.length - 1];
  ok(last === 3, `最后一次同步在世界终值日（第${last}日），最后一拍势力变化能上图`);
  // 顺序断言：最后两个打点必须是 life 然后 sync（收口在最后一个 lifecycle 之后）
  const tail = subs.atlasOrder.slice(-2);
  ok(tail[0] === 'life' && tail[1] === 'sync',
    `收口同步发生在最后一个 lifecycle 之后（尾部顺序=${tail.join('→')}）`);
}
G('3b. 单飞锁排队不丢回合（v4.42 新增）');
{
  // 用真实 setTimeout（异步分批）制造「演化中又来一回合」的重入，验证不丢跨度
  const listeners = {};
  const sb = baseSandbox({
    document: {
      visibilityState: 'visible',
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); },
      getElementById: () => null,
      createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
      body: { appendChild() {} },
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    showToast: () => {},
  });
  sb.storyFramework = { slotId: 'main', storyState: { variables: { 时间: { clockDay: 0 }, history: [], entities: {} }, turnCount: 0 }, saveStory() {} };
  let q = { minutes: 4320, days: 3, level: 'day' };
  sb.AttributeEngine = { currentSpanQ: () => q, currentSpanDays: () => 3 };
  loadModule('js/world-clock.js', sb);
  const fire = () => sb.document.dispatchEvent(new sb.CustomEvent('story:turn-saved', { detail: {} }));
  fire(); // 触发 3 日演化（异步分批，ticking=true）
  fire(); // 演化中又来一回合 → 应排队，不丢弃
  // 等待：回合钩子本身延后 350ms + 分批让出 + 排空 16ms，留足余量
  setTimeout(() => {
    const day = sb.storyFramework.storyState.variables.时间.clockDay;
    ok(day === 6, `重入回合被排队补跑：两轮各3日 → 世界日=${day}（应为6）`);
    finishAsync();
  }, 700);
}

/* ============================================================
   4. AIGovernor 全局动态并发闸门
   ============================================================ */
async function governorTests() {
  G('4. AIGovernor 全局动态并发闸门');
  const sb = baseSandbox();
  loadModule('js/ai-governor.js', sb);
  const Ag = sb.window.AIGovernor;
  ok(Ag.getPref() === 'balanced', '默认偏好=balanced');
  let st = Ag.status();
  ok(st.limit === 2 && st.min === 2 && st.max === 3, `起点上限=2（区间2~3），实际=${st.limit}`);
  await Ag.acquire('A'); await Ag.acquire('B');
  ok(Ag.status().inflight === 2, '在途=2');
  let resolved = false;
  const p3 = Ag.acquire('C').then(() => { resolved = true; });
  await new Promise(r => setTimeout(r, 20));
  ok(!resolved && Ag.status().queued === 1, '第3路被排队（未立即放行），闸门生效');
  Ag.release('A');
  await new Promise(r => setTimeout(r, 20));
  ok(resolved, '释放名额后排队请求被放行（不丢弃）');
  Ag.release('B'); Ag.release('C');
  ok(Ag.status().inflight === 0, '全部释放后在途归零');
  Ag.setPref('balanced'); await Ag.acquire('x'); Ag.release('x');
  for (let i = 0; i < 4; i++) Ag.reward();
  ok(Ag.status().limit === 3, '连续顺畅回升到上限3');
  Ag.penalize();
  ok(Ag.status().limit === 2 && Ag.status().penalized === true, '撞限流收紧到下限2并进入冷静期');
  for (let i = 0; i < 10; i++) Ag.reward();
  ok(Ag.status().limit === 2, '冷静期内不回升');
  ok(Ag.setPref('frugal') === true && Ag.status().limit === 1, '保守档起点1，切换即时生效');
  ok(Ag.setPref('bogus') === false, '拒绝非法档位');
  Ag.setPref('balanced');
  const r = await Ag.run('t', async () => 42);
  ok(r === 42 && Ag.status().inflight === 0, 'run() 成功路径返回并释放');
  let threw = false;
  try { await Ag.run('t', async () => { throw new Error('x'); }); } catch (e) { threw = true; }
  ok(threw && Ag.status().inflight === 0, 'run() 异常路径抛出且释放（无泄漏）');
}

/* ============================================================
   5. 存档 gzip 纯 JS 兜底解压（v4.42 新增）
   ============================================================ */
async function gzipTests() {
  G('5. 存档 gzip 纯 JS 兜底解压');
  const sb = baseSandbox({ Blob, Response });
  const patched = read('js/save-codec.js').replace('    gzip: gzip,', '    gzip: gzip,\n    _inflateGzip: inflateGzip,');
  vm.createContext(sb);
  vm.runInContext(patched, sb);
  const inflate = sb.SaveCodec._inflateGzip;
  const samples = [
    'hello world',
    '云境存档测试：六维数值与天赋档位',
    JSON.stringify({ a: 1, b: 'x'.repeat(5000), c: [1, 2, 3] }),
    JSON.stringify({ history: Array.from({ length: 200 }, (_, i) => `【世界】第${i}日 · 势力消长 ${i}`) }),
    'AB'.repeat(20000),
    Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join(''),
  ];
  for (let i = 0; i < samples.length; i++) {
    const gz = zlib.gzipSync(Buffer.from(samples[i], 'utf8'));
    try {
      const out = Buffer.from(inflate(new Uint8Array(gz))).toString('utf8');
      ok(out === samples[i], `gzip 样本${i + 1} 解压一致（${gz.length}B→${samples[i].length}字）`);
    } catch (e) { ok(false, `gzip 样本${i + 1} 解压失败：${e.message}`); }
  }
}

/* ============ 汇总（单飞排队测试是异步的，需等它完成） ============ */
let asyncClockDone = false;
function finishAsync() {
  asyncClockDone = true;
  if (asyncDone) report();
}
let asyncDone = false;

function report() {
  console.log('\n==============================================');
  console.log(`核心引擎回归：${pass} 通过 / ${fail} 失败`);
  console.log('==============================================');
  process.exit(fail ? 1 : 0);
}

(async () => {
  await governorTests();
  await gzipTests();
  asyncDone = true;
  if (asyncClockDone) report();
})().catch(e => { console.error(e); process.exit(2); });
