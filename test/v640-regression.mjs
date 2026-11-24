/* v6.4.0 回归：ZIP 打包 / 密钥扫描 / 持久项快照 / 二创包结构
 * 纯 Node，无浏览器依赖。 */
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got=${JSON.stringify(a)} exp=${JSON.stringify(b)})`); }

/* ---- mock 浏览器全局（供 floor-state 用） ---- */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  get length() { return mem.size; },
  key: i => [...mem.keys()][i] || null
};
globalThis.SlotRegistry = {
  keysOf: () => [
    'yunjingWorldRuntime~main~free',
    'worldLegacyBank',              // 持久项
    'worldLegacyGranted~main',      // 持久项
    'storyAtlas_free',              // 持久项
    'storyKB_free',
    'worldExt_free'
  ]
};
let idb = new Map();
globalThis.StorageBoost = {
  ready: () => true,
  get: k => Promise.resolve(idb.get(k) || null),
  put: (k, v) => { idb.set(k, v); return Promise.resolve(true); },
  remove: k => { idb.delete(k); return Promise.resolve(true); }
};

const ZipWriter = require('/workspace/yunjing/js/zip-writer.js');
require('/workspace/yunjing/js/floor-state.js');
const FS = globalThis.FloorState;

console.log('\n=== 1. ZIP 打包器 ===');
const entries = [
  { name: 'manifest.json', data: JSON.stringify({ app: 'yunjing-fanwork', schema: 1, title: '测试' }) },
  { name: 'content/世界书.json', data: '测试中文内容'.repeat(100) }
];
const zip = await ZipWriter.makeZip(entries);
ok(zip instanceof Uint8Array, 'makeZip 返回 Uint8Array');
ok(zip.length > 100, 'zip 有内容');
// 验证 zip 魔数
ok(zip[0] === 0x50 && zip[1] === 0x4b && zip[2] === 0x03 && zip[3] === 0x04, '本地文件头魔数 PK\\x03\\x04');
fs.writeFileSync('/tmp/yj-v640-test.zip', Buffer.from(zip));
// 用系统 unzip 校验
try {
  const out = execFileSync('unzip', ['-t', '/tmp/yj-v640-test.zip'], { encoding: 'utf8' });
  ok(/No errors detected/.test(out), 'unzip -t CRC 校验通过');
  const listing = execFileSync('unzip', ['-Z1', '/tmp/yj-v640-test.zip'], { encoding: 'utf8' });
  ok(listing.indexOf('manifest.json') >= 0, 'zip 含 manifest.json');
  ok(listing.indexOf('世界书') >= 0 || listing.indexOf('content/') >= 0, 'zip 含中文路径条目');
} catch (e) { ok(false, 'unzip 校验: ' + e.message); }

console.log('\n=== 2. floor-state 持久项采集 ===');
const fakeFw = {
  getSaveKey: () => 'test-slot',
  slotId: 'main', genre: 'free',
  storyState: { variables: { round: 1 }, conversationHistory: [{ role: 'user', content: 'hi' }] }
};
mem.set('yunjingWorldRuntime~main~free', '{"round":1}');
mem.set('worldLegacyBank', '42');
mem.set('worldLegacyGranted~main', '1');
mem.set('storyAtlas_free', '{"visits":["a"]}');
mem.set('storyKB_free', '{"kb":1}');
const cap = FS.capture(fakeFw);
ok('worldLegacyBank' in cap.persist, 'persist 采集到 worldLegacyBank');
ok('storyAtlas_free' in cap.persist, 'persist 采集到 storyAtlas_free（前缀扫描）');
ok('worldLegacyGranted~main' in cap.persist, 'persist 采集到 worldLegacyGranted');
ok('yunjingWorldRuntime~main~free' in cap.sk, '旁路键进 sk');
ok(!('worldLegacyBank' in cap.sk), '持久项不进 sk');
ok(cap.histLen === 1, 'histLen 正确');

console.log('\n=== 3. restore 按开关还原持久项 ===');
// 改变持久项当前值
mem.set('worldLegacyBank', '99');
mem.set('storyAtlas_free', '{"visits":["b","c"]}');
fakeFw.storyState.variables = { round: 9 };
// 不勾选：持久项保持当前
FS.restore(fakeFw, cap, false);
eq(mem.get('worldLegacyBank'), '99', '不勾选时传承保持当前值');
eq(JSON.parse(mem.get('storyAtlas_free')).visits, ['b', 'c'], '不勾选时足迹保持当前值');
eq(fakeFw.storyState.variables, { round: 1 }, 'storyState 仍还原');
// 勾选：持久项还原到快照值
FS.restore(fakeFw, cap, true);
eq(mem.get('worldLegacyBank'), '42', '勾选时传承还原到快照值');
eq(JSON.parse(mem.get('storyAtlas_free')).visits, ['a'], '勾选时足迹还原到快照值');

console.log('\n=== 4. 差量含 persist（版本兼容） ===');
const cap2 = FS.capture(fakeFw);
cap2.persist['worldLegacyBank'] = '55';
const d = FS.diff(cap2, cap);
ok('worldLegacyBank' in d.persist, 'diff 捕获持久项变化');
// 老快照无 persist 时 diff/apply 不崩
const oldSnap = { ss: { variables: { round: 1 } }, sk: {}, histLen: 1, user: 'x' };
const d2 = FS.diff(cap2, oldSnap);
ok(true, '老快照(无persist) diff 不崩');
const rebuilt = FS.apply(JSON.parse(JSON.stringify(oldSnap)), d2);
ok(rebuilt.persist && 'worldLegacyBank' in rebuilt.persist, '老快照 apply 后补出 persist');

console.log('\n=== 结果: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
