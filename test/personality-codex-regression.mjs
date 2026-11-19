// 云境 · 人物性格世界书回归（原创实现，机制层测试）
// 用法：node test/personality-codex-regression.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/personality-codex.js'), 'utf8');

let pass = 0, fail = 0;
const G = (n) => console.log('\n### ' + n);
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const sb = { console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const P = sb.PersonalityCodex;

G('0. 模块加载');
ok(!!P, 'PersonalityCodex 已挂载');
ok(P.VERSION === '1.0.0', '版本号正确');
ok(P.REL_AXES.length === 5, '五维关系轴定义存在');

G('1. 三类取向原型库');
ok(P.ARCHETYPES.positive.length >= 5, '正面原型 >=5 套');
ok(P.ARCHETYPES.negative.length >= 5, '负面原型 >=5 套');
ok(P.ARCHETYPES.eccentric.length >= 5, '奇葩原型 >=5 套');
ok(Object.keys(P.ORIENT_LABEL).length === 3, '三种取向标签齐全');

G('2. 确定性生成（同名同世界可复现）');
{
  const a = P.forRole('韩立', 'fanrenxiuxian');
  const b = P.forRole('韩立', 'fanrenxiuxian');
  ok(JSON.stringify(a) === JSON.stringify(b), '同角色两次生成完全一致');
  ok(a.name === '韩立' && a.world === 'fanrenxiuxian', '档案带角色名与世界');
  ok(a.seed === P.generate('韩立', 'fanrenxiuxian').seed, '直接生成与缓存种子一致');
}

G('3. 档案字段完整');
{
  const p = P.forRole('唐三', 'douluodalu');
  ok(['positive','negative','eccentric'].indexOf(p.orientation) >= 0, '取向合法');
  ok(typeof p.archetype === 'string' && p.archetype.length > 0, '原型名存在');
  ok(p.traits.length >= 4, '核心特质 >=4');
  ok(typeof p.speech === 'string' && p.speech.length > 0, '说话方式存在');
  ok(typeof p.habit === 'string' && p.habit.length > 0, '行为习惯存在');
  ok(Array.isArray(p.likes) && p.likes.length > 0, '喜好存在');
  ok(Array.isArray(p.dislikes) && p.dislikes.length > 0, '厌恶存在');
  ok(typeof p.bottomLine === 'string' && p.bottomLine.length > 0, '底线/雷区存在');
  ok(typeof p.quirk === 'string' && p.quirk.length > 0, '独特癖好存在');
  ok(Object.keys(p.relBias).length === 5, '五维关系影响系数齐全');
}

G('4. 每人独特（同世界不同人 / 同名不同世界）');
{
  const roster = P.roster('chaoshenxueyuan');
  const sigs = new Set();
  roster.forEach(n => sigs.add(JSON.stringify({ o: P.forRole(n,'chaoshenxueyuan').orientation, a: P.forRole(n,'chaoshenxueyuan').archetype, q: P.forRole(n,'chaoshenxueyuan').quirk })));
  ok(sigs.size >= Math.min(6, roster.length), `同世界角色性格签名多样（${sigs.size}/${roster.length}）`);
  const wa = P.forRole('萧炎', 'doupocangqiong');
  const wb = P.forRole('萧炎', 'fanrenxiuxian');
  ok(wa.seed !== wb.seed, '同名不同世界种子不同');
}

G('5. 三类取向全覆盖（批量抽样）');
{
  const seen = { positive: 0, negative: 0, eccentric: 0 };
  for (let i = 0; i < 120; i++) seen[P.forRole('角色' + i, 'testworld').orientation]++;
  ok(seen.positive > 0 && seen.negative > 0 && seen.eccentric > 0,
    `三类取向均出现（正${seen.positive}/负${seen.negative}/奇${seen.eccentric}）`);
}

G('6. 预置索引覆盖');
{
  ok(P.worlds().length >= 38, `覆盖世界 >=38（${P.worlds().length}）`);
  ok(P.countIndex() >= 200, `预置角色索引 >=200（${P.countIndex()}）`);
  ok(P.roster('fanrenxiuxian').indexOf('韩立') >= 0, '凡人世界含韩立');
  ok(typeof P.rosterNote('cthulhu') === 'string' && P.rosterNote('cthulhu').length > 0, '无索引世界有占位说明');
}

G('7. 联动系数与注入文本');
{
  const bias = P.biasFor('韩立', 'fanrenxiuxian', 'trust');
  ok(typeof bias === 'number' && bias > 0, '单轴倾向系数为数值');
  const all = P.biasFor('韩立', 'fanrenxiuxian');
  ok(Object.keys(all).length === 5, '不传轴返回全部系数');
  const br = P.brief('韩立', 'fanrenxiuxian');
  ok(br.indexOf('韩立') >= 0 && br.indexOf('雷区') >= 0, '提示词速写含角色与雷区');
}

G('8. 存档');
{
  const dump = P.exportAll();
  ok(dump.v === '1.0.0', 'exportAll 导出版本');
  P._cache['newkey'] = { test: 1 };
  ok(P.importAll(JSON.parse(JSON.stringify(dump))) === true, 'importAll 成功');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
