/* v6.3.14 全量楼层快照回归。纯 Node + mock StorageBoost，逐字段验证。
 * 跑法：node test/floor-state-regression.mjs  */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ---- mock 浏览器环境 ----
const mem = new Map();
globalThis.StorageBoost = {
  ready: () => true,
  get: async (k) => (mem.has(k) ? mem.get(k) : null),
  put: async (k, v) => { mem.set(k, String(v)); return true; },
  remove: async (k) => { mem.delete(k); return true; }
};
const ls = new Map();
globalThis.localStorage = {
  getItem: (k) => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => ls.set(k, String(v)),
  removeItem: (k) => ls.delete(k),
  key: (i) => Array.from(ls.keys())[i] || null,
  get length() { return ls.size; }
};
const SIDE_KEYS = [
  'yunjingWorldRuntime~main~test', 'yunjingWorldBus~main~test', 'yunjingWorldAlive~main~test',
  'yunjingCanonLedger:main:test', 'yunjingCanonTL:main:test', 'yunjing.clock.main~test',
  'yunjingBeasts~main', 'yunjingSquad~main', 'yunjingStoryStance~main', 'yunjingSideChar~main',
  'yunjingPlayerIdentity~main', 'yunjingHeroRelation~main', 'worldExt_test', 'yunjingWorldBook:test',
  'gl_test', 'rl_test', 'storyKnowledge_test'
];
globalThis.SlotRegistry = {
  keysOf: () => SIDE_KEYS.concat(['worldLegacyBank', 'worldLegacyGranted~main', 'storyAtlas_test'])
};

require('../js/floor-state.js');
const FS = globalThis.FloorState;

// ---- mock fw ----
function makeFw() {
  return {
    slotId: 'main', genre: 'test',
    storyState: { conversationHistory: [] },
    getSaveKey() { return 'storySave_test'; }
  };
}

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } }
function eqJSON(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' | got=' + JSON.stringify(a).slice(0,120)); }

// 字段清单（从模块读，保证测试与实现同步）
const FIELDS = FS.SS_FIELDS;

// 造某轮的完整状态：每个字段都放可区分的值
function stateAt(n) {
  const s = {};
  FIELDS.forEach((f, idx) => { s[f] = { tag: f + '@' + n, idx, n }; });
  return s;
}
function applyState(fw, n, histLen) {
  const st = stateAt(n);
  FIELDS.forEach(f => fw.storyState[f] = st[f]);
  fw.storyState.conversationHistory = new Array(histLen).fill(0).map((_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'L' + i }));
  // 全部旁路键随轮变化
  SIDE_KEYS.forEach(k => ls.set(k, JSON.stringify({ round: n, key: k })));
  ls.set('worldLegacyBank', JSON.stringify({ legacy: 'PERMA' })); // 全局项，不该进快照
  ls.set('worldLegacyGranted~main', JSON.stringify({ g: 'PERMA' }));
  ls.set('storyAtlas_test', JSON.stringify({ collected: 'PERMA' }));
  return st;
}

async function main() {
  console.log('=== v6.3.14 全量楼层快照回归 ===\n');

  const fw = makeFw();
  // 记录 0..59 层（跨 3 个锚点：0,20,40）
  const snapshots = {}; // index -> 期望的完整快照
  for (let i = 0; i <= 59; i++) {
    applyState(fw, i, 2 * i + 2);
    snapshots[i] = FS.capture(fw);
    await FS.record(fw, i);
  }
  console.log('【1】已记录 60 层，跨锚点', Object.keys((await FS._dbg?.() || {})).length ? '' : '(锚点0/20/40)');

  // V1: 回档到若干层，逐字段比对 capture
  console.log('\n【2】V1 逐字段还原（抽查 10 层，但每层逐字段全比）');
  const probes = [0, 1, 7, 19, 20, 21, 33, 40, 41, 59];
  for (const idx of probes) {
    const loaded = await FS.load(fw, idx);
    ok(loaded !== null, `load(${idx}) 非空`);
    if (!loaded) continue;
    // 逐字段比对 ss
    FIELDS.forEach(f => {
      eqJSON(loaded.ss[f], snapshots[idx].ss[f], `层${idx} 字段 ${f}`);
    });
    ok(loaded.histLen === snapshots[idx].histLen, `层${idx} histLen=${snapshots[idx].histLen} got=${loaded.histLen}`);
    // 全部旁路键逐个验证（不抽查）
    SIDE_KEYS.forEach(k => eqJSON(loaded.sk[k], snapshots[idx].sk[k], `层${idx} 旁路 ${k}`));
    ['worldLegacyBank', 'worldLegacyGranted~main', 'storyAtlas_test'].forEach(k =>
      ok(!(k in loaded.sk), `层${idx} 全局项 ${k} 未进快照`));
  }

  // V3: 体积有界
  console.log('\n【3】V3 体积有界');
  const docRaw = mem.get(FS._key(fw));
  const doc = JSON.parse(docRaw);
  const bytes = docRaw.length;
  const deltas = Object.keys(doc.deltas).length, anchors = Object.keys(doc.anchors).length;
  console.log(`  60层: floorState=${(bytes/1024).toFixed(1)}KB, deltas=${deltas}, anchors=${anchors}`);
  ok(anchors === 3, `锚点数=3 (0/20/40) got=${anchors}`);
  // 层0存在 base 里，不产生 delta → 60层应有59个差量
  ok(deltas === 59, `差量数=59 (层0在base) got=${deltas}`);
  // 放大倍数口径（契约§2/§5-V3）：快照体积 / 真实状态变化量 ≤3。
  // 本测试每层每字段都变=最坏情况，真实变化量≈60份全量快照。
  const oneFull = JSON.stringify(snapshots[0]).length;
  const rawTotal = oneFull * 60;
  const ratio = bytes / rawTotal;
  console.log(`  最坏情况放大倍数: ${ratio.toFixed(3)} (契约要求 ≤3)`);
  ok(ratio <= 3, '最坏情况放大倍数 ≤3（契约 V3）');

  // V5: 重写已存在的层（index<=tip）应清掉后续
  console.log('\n【4】重写层 30 后，31+ 应被清除');
  applyState(fw, 999, 2 * 30 + 2);
  const rewriteSnap = FS.capture(fw);
  await FS.record(fw, 30);
  const loaded30 = await FS.load(fw, 30);
  FIELDS.forEach(f => eqJSON(loaded30.ss[f], rewriteSnap.ss[f], `重写层30 字段 ${f}`));
  const doc2 = JSON.parse(mem.get(FS._key(fw)));
  ok(Object.keys(doc2.deltas).every(k => Number(k) <= 30), '重写后无 >30 的差量');
  ok(Object.keys(doc2.anchors).every(k => Number(k) <= 30), '重写后无 >30 的锚点');

  // 撤销点
  console.log('\n【5】撤销点 pushUndo/popUndo');
  await FS.pushUndo(fw, { ss: { variables: { a: 1 } }, sk: {}, histLen: 10, fullHistory: [{role:'user',content:'X'}] });
  await FS.pushUndo(fw, { ss: { variables: { a: 2 } }, sk: {}, histLen: 20, fullHistory: [] });
  const u = await FS.popUndo(fw);
  eqJSON(u.ss.variables, { a: 2 }, 'popUndo 拿到最后一次');
  const u2 = await FS.popUndo(fw);
  eqJSON(u2.fullHistory, [{role:'user',content:'X'}], 'popUndo 拿到倒数第二次的 fullHistory');

  // restore 到运行时
  console.log('\n【6】restore 写回 storyState + 旁路键，不碰全局项');
  const fw2 = makeFw();
  applyState(fw2, 5, 12);
  const target = await FS.load(fw, 20); // 从 fw 的档读层20
  // 注意：fw2 用同一个 saveKey，共享快照；target 是层20状态
  FS.restore(fw2, target);
  eqJSON(fw2.storyState.variables, snapshots[20].ss.variables, 'restore variables');
  eqJSON(fw2.storyState.memoryLayers, snapshots[20].ss.memoryLayers, 'restore memoryLayers');
  SIDE_KEYS.forEach(k => eqJSON(JSON.parse(ls.get(k)), { round: 20, key: k }, `restore 旁路 ${k}`));
  eqJSON(JSON.parse(ls.get('worldLegacyBank')), { legacy: 'PERMA' }, 'restore 不动全局项 worldLegacyBank');
  eqJSON(JSON.parse(ls.get('storyAtlas_test')), { collected: 'PERMA' }, 'restore 不动全局项 storyAtlas');

  // V3 补充：真实场景（每轮只有 variables 变）差量必须显著小于全量快照
  console.log('\n【7】V3补充 真实玩法：每轮只变 variables，差量应远小于全量');
  mem.clear();
  const fw3 = makeFw();
  for (let i = 0; i <= 99; i++) {
    // 只有 variables 变，其他字段恒定
    FIELDS.forEach(f => { fw3.storyState[f] = { big: 'x'.repeat(2000), tag: f }; });
    fw3.storyState.variables = { round: i, hp: 100 - i };
    fw3.storyState.conversationHistory = new Array(2*i+2).fill(0).map((_,j)=>({role:'user',content:'L'+j}));
    await FS.record(fw3, i);
  }
  const doc3raw = mem.get(FS._key(fw3));
  const oneFullBig = JSON.stringify(FS.capture(fw3)).length;
  console.log(`  100层每轮只变variables: floorState=${(doc3raw.length/1024).toFixed(1)}KB, 单份全量≈${(oneFullBig/1024).toFixed(1)}KB, 全量×100≈${(oneFullBig*100/1048576).toFixed(1)}MB`);
  ok(doc3raw.length < oneFullBig * 100 * 0.2, '真实玩法差量存储 < 全量快照×100 的20%（省空间生效）');
  const loaded99 = await FS.load(fw3, 99);
  eqJSON(loaded99.ss.variables, { round: 99, hp: 1 }, '真实场景层99 variables 精确');

  console.log(`\n=== 结果: ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('异常:', e); process.exit(1); });
