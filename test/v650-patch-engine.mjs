/* v6.5.0 增量补丁内核回归（Node，无浏览器依赖） */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PE = require('../js/patch-engine.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + JSON.stringify(extra) : '')); }
}
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b }); }

console.log('\n[1] hash 稳定且区分');
ok('hash 空串确定', PE.hash('') === PE.hash(''));
ok('hash 区分内容', PE.hash('abc') !== PE.hash('abd'));
ok('hash 8位十六进制', /^[0-9a-f]{8}$/.test(PE.hash('云境')));

console.log('\n[2] item / baseline');
const it1 = PE.item('preset/a', 'preset', 'hello');
eq('item.hash 一致', it1.hash, PE.hash('hello'));
const bl = PE.baseline('6.5.0', [it1]);
eq('baseline 结构', bl.items[0], { key: 'preset/a', kind: 'preset', hash: PE.hash('hello') });

console.log('\n[3] diff add/modify/delete');
{
  const base = [PE.item('k/a','preset','1'), PE.item('k/b','preset','2'), PE.item('k/c','preset','3')];
  const target = [PE.item('k/a','preset','1'), PE.item('k/b','preset','X'), PE.item('k/d','preset','4')];
  const d = PE.diff(base, target);
  eq('diff 三项', d.map(x=>x.op+':'+x.key).sort(), ['add:k/d','delete:k/c','modify:k/b']);
  ok('modify newHash 正确', d.find(x=>x.key==='k/b').newHash === PE.hash('X'));
}

console.log('\n[4] plan 四类处置');
{
  // base: a=1 b=2 c=3 d={x:1,y:2}
  // ours: a=1(未改) b=O(改) c=3(未改) d 删除
  // theirs:a=A(改) b=2(未改) c=T(改) d={y:2,z:3}(改)
  const base = [PE.item('a','p','1'),PE.item('b','p','2'),PE.item('c','p','3'),PE.item('d','p','{"x":1,"y":2}')];
  const ours = [PE.item('a','p','1'),PE.item('b','p','O'),PE.item('c','p','3')];
  const theirs= [PE.item('a','p','A'),PE.item('b','p','2'),PE.item('c','p','T'),PE.item('d','p','{"y":2,"z":3}')];
  const dec = PE.plan(base, ours, theirs);
  const byKey = {}; dec.forEach(x=>byKey[x.key]=x);
  eq('a: ours==base,theirs!=base → overwrite', byKey.a.action, 'overwrite');
  eq('b: theirs==base → keep', byKey.b.action, 'keep');
  eq('c: ours==base? no(ours=3=base, theirs=T!=base) → overwrite', byKey.c.action, 'overwrite');
  ok('d: 双方都改 → merge 或 conflict', ['merge','conflict'].includes(byKey.d.action), byKey.d);
}
{
  // sync：双方完全一致
  const base = [PE.item('a','p','1')];
  const ours = [PE.item('a','p','1')];
  const theirs= [PE.item('a','p','1')];
  eq('sync', PE.plan(base,ours,theirs)[0].action, 'sync');
}
{
  // conflict：两边都改同一标量且不同
  const base = [PE.item('a','p','1')];
  const ours = [PE.item('a','p','O')];
  const theirs= [PE.item('a','p','T')];
  eq('conflict 标量', PE.plan(base,ours,theirs)[0].action, 'conflict');
}

console.log('\n[5] merge3 字段级');
{
  const m = PE.merge3('{"x":1,"y":2}', '{"x":9,"y":2}', '{"x":1,"y":8}');
  ok('merge3 无冲突', m.ok, m);
  eq('merge3 结果合并两处改动', JSON.parse(m.value), { x: 9, y: 8 });
}
{
  const m = PE.merge3('{"x":1}', '{"x":9}', '{"x":8}');
  ok('merge3 同键三方不同 → 冲突', !m.ok && m.conflictKeys[0] === 'x', m);
}
{
  const m = PE.merge3('arr', 'ours', 'theirs');
  ok('非 JSON → 整体冲突', !m.ok, m);
}

console.log('\n[6] summarize');
{
  const base=[], ours=[PE.item('a','p','1')], theirs=[PE.item('a','p','1')];
  eq('summarize sync=1', PE.summarize(PE.plan(base,ours,theirs)), {sync:1,overwrite:0,keep:0,merge:0,conflict:0,total:1});
}

console.log('\n[7] 备份 / 应用 / 回滚');
{
  const base=[PE.item('a','p','old')], ours=[PE.item('a','p','old')], theirs=[PE.item('a','p','new')];
  const dec = PE.plan(base,ours,theirs); // overwrite
  const bak = PE.makeBackup(dec, 'install#1');
  eq('备份收录旧值', bak.entries[0].oldData, 'old');
  const ops = PE.applyList(dec);
  eq('应用写新值', ops[0].data, 'new');
  const rb = PE.rollbackList(bak);
  eq('回滚写旧值', rb[0].data, 'old');
  // 冲突未裁决不落地
  const cdec = PE.plan([PE.item('a','p','1')],[PE.item('a','p','O')],[PE.item('a','p','T')]);
  ok('冲突未裁决不产生写操作', PE.applyList(cdec).length === 0);
  const resolved = PE.applyList(cdec, { a: 'theirs' });
  eq('裁决后采用 theirs', resolved[0].data, 'T');
}
{
  let stack = [];
  for (let i=0;i<15;i++) stack = PE.pushBackup(stack, {tag:'b'+i, entries:[]});
  ok('备份栈上限10', stack.length === 10 && stack[0].tag === 'b5' && stack[9].tag === 'b14', stack.map(x=>x.tag));
}

console.log('\n[8] versionCheck');
{
  ok('同版本 ok', PE.versionCheck('6.5.0','6.5.0','6.5.0').level === 'ok');
  ok('旧版补丁 warn', PE.versionCheck('6.3.0','6.5.0','6.3.0').level === 'warn');
  ok('目标版本高很多 warn', PE.versionCheck('7.0.0','6.5.0','7.0.0').level === 'warn');
}

console.log('\n[9] 分卷建议');
{
  const r = PE.suggestVolumes(180*1024*1024);
  ok('180MB 需分卷2', r.needSplit && r.count === 2, r);
  const big = PE.suggestVolumes(40*90*1024*1024);
  ok('超32卷提示 overCap', big.overCap, big);
}

console.log('\n[10] 密钥扫描与剔除');
{
  const bad = PE.scanSecrets([PE.item('save/a','save','{"k":"sk-abcdefghijklmnop"}')]);
  ok('扫描命中 sk-', bad.length === 1, bad);
  const clean = PE.stripSecrets('{"name":"存档","apiKey":"sk-abcdefghijklmnop","story":"正文"}');
  const o = JSON.parse(clean);
  ok('剔除 apiKey 字段', !('apiKey' in o), o);
  eq('保留 story', o.story, '正文');
  ok('正文里的 sk- 被 REDACTED', !/sk-abcdef/.test(JSON.stringify(o)), o);
  ok('非密钥 JSON 原样保留', PE.stripSecrets('{"a":1}') === '{"a":1}');
}

console.log('\n[11] tombstone 删除');
{
  // base 有 a，theirs 删除 a（tombstone），ours 未改
  const base=[PE.item('a','p','1')], ours=[PE.item('a','p','1')];
  const theirs=[{key:'a',kind:'p',hash:PE.hash(PE.TOMB),data:PE.TOMB}];
  const dec = PE.plan(base,ours,theirs);
  eq('删除项 ours==base → overwrite 为 tombstone', dec[0].action, 'overwrite');
  ok('theirs 是 tombstone', dec[0].theirs === PE.TOMB);
}

console.log('\n========== 结果 ==========');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
