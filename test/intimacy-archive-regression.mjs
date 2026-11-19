// 云境 · 亲密关系档案回归（原创实现，机制层测试）
// 用法：node test/intimacy-archive-regression.mjs
// 零依赖 Node vm 沙箱。验证：默认关闭/门禁、阶段门槛、只增不删、
// 记忆分层、本地互动确定性、内容护栏、认知边界、存档。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/intimacy-archive.js'), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};

const store = {};
const sb = {
  console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); } }
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const A = sb.IntimacyArchive;

G('0. 模块加载与默认关闭');
ok(!!A, 'IntimacyArchive 已挂载');
ok(A.VERSION === '1.0.0', '版本号正确');
ok(A.isEnabled() === false, '默认关闭（R18 需显式开启）');
ok(A.STAGES.length === 6, '六段关系阶段定义存在');
ok(A.gate('x') === false && A._state.stats.gated > 0, '关闭时门禁拦截并计数');

G('1. 开启与建档');
ok(A.setEnabled(true) === true && A.isEnabled() === true, 'setEnabled 开启生效');
ok(store['yunjing.intimacy.enabled.v1'] === '1', '开启状态持久化到 localStorage');
{
  const r = A.ensure('柳师姐');
  ok(r && r.name === '柳师姐', '建档成功');
  ok(r.stage === 0 && r.closeness === 0, '新档案阶段/亲密度归零');
  ok(r.boundaries.display === '谨慎', '默认边界偏好就位');
  ok(A.ensure('') === null, '空名字拒绝建档');
}

G('2. 亲密度门槛驱动阶段推进（只升不降）');
{
  A.ensure('甲');
  let r = A.addCloseness('甲', 12, '初次同行');
  ok(r.stage === 1 && r.promoted === true, '亲密度12 → 相识，触发晋升');
  r = A.addCloseness('甲', -5);
  ok(r.closeness === 7 && r.stage === 1, '亲密度下降但阶段不倒退（棘轮）');
  r = A.addCloseness('甲', 40);
  ok(r.stage === 3 && r.label === '亲近', '累计52 → 亲近');
  ok(A.get('甲').closeness === 47, '亲密度数值正确累计（12-5+40=47）');
  A.addCloseness('甲', 500);
  ok(A.get('甲').closeness === 100 && A.get('甲').stage === 5, '亲密度封顶100、阶段封顶伴侣');
}

G('3. 记忆分层留存 40/12/5');
{
  A.ensure('乙');
  for (let i = 0; i < 60; i++) A.remember('乙', '日常' + i, 0);
  for (let i = 0; i < 20; i++) A.remember('乙', '普通' + i, 1);
  for (let i = 0; i < 50; i++) A.remember('乙', '重要' + i, 2);
  const mem = A.get('乙').memories;
  const c0 = mem.filter(m => m.weight === 0).length;
  const c1 = mem.filter(m => m.weight === 1).length;
  const c2 = mem.filter(m => m.weight === 2).length;
  ok(c0 === 5 && c1 === 12 && c2 === 40, `分层裁剪正确 5/12/40（实得 ${c0}/${c1}/${c2}）`);
  ok(mem.some(m => m.text === '日常59'), '日常仅保留最新（日常59在）');
  ok(!mem.some(m => m.text === '日常0'), '旧日常被裁掉（日常0不在）');
}

G('4. 只增不删档案库');
{
  A.ensure('丙');
  A.addCloseness('丙', 70, '结伴多年');
  A.setPetName('丙', '阿丙');
  const before = A.vaultSize();
  ok(A.remove('丙') === true, 'remove 执行');
  ok(A.get('丙') === null, '主库已移除');
  ok(A.vaultSize() === before + 1, '快照进库房（只增不删）');
  ok(A.restore('丙') === true && A.get('丙').petName === '阿丙', 'restore 恢复全量档案');
}

G('5. 称呼/边界/可信名单');
{
  A.ensure('丁');
  ok(A.setPetName('丁', '小丁') === '小丁', '专属称呼写入');
  ok(A.setBoundary('丁', 'touch', '仅牵手') === '仅牵手', '边界偏好写入');
  ok(A.setBoundary('丁', 'badkey', 'x') === null, '非法边界键拒绝');
  A.setTrusted('丁', '玩家');
  ok(A.get('丁').trusted.indexOf('玩家') >= 0, '可信名单加入');
  A.setTrusted('丁', '玩家', false);
  ok(A.get('丁').trusted.indexOf('玩家') < 0, '可信名单移除');
}

G('6. 本地互动确定性 + 内容护栏');
{
  const a = A.localInteraction('戊', 3);
  const b = A.localInteraction('戊', 3);
  ok(a && b && a.text === b.text, '同种子同回合 → 文本确定一致');
  ok(A.LOCAL_LINES.indexOf(a.text) >= 0, '文本来自原创含蓄模板库');
  ok(A.sanitize('两人并肩坐廊下') !== '', '正常文本通过');
  ok(A.sanitize('性交描写') === '', '露骨词被护栏拦截（空返回）');
  ok(A.recordInteraction('戊', '性交描写') === null, '露骨互动不入档');
}

G('7. 认知边界');
{
  A.ensure('己');
  A.addCloseness('己', 70);
  const priv = A.remember('己', '一封只给她的信', 2);
  ok(A.visibleTo('己', '陌生人', priv) === true, '高关系阶段(≥65)下私密记忆对玩家可见');
  A.addCloseness('己', -70); // 亲密度降但阶段不降，验证 trusted 通道
  const rec = A.get('己');
  ok(A.visibleTo('己', '无处', { weight: 2, stage: 0 }) === false, '低阶段+非可信 → 不可见');
  A.setTrusted('己', '心腹');
  ok(A.visibleTo('己', '心腹', { weight: 2, stage: 0 }) === true, '可信名单可见');
  ok(A.visibleTo('己', 'x', { weight: 0 }) === true, '日常记忆公开可见');
}

G('8. 视图与存档');
{
  A.ensure('庚');
  A.addCloseness('庚', 30);
  A.setPetName('庚', '师兄');
  A.remember('庚', '一起看过海', 2);
  const v = A.view('庚', '玩家');
  ok(v && v.stageLabel === '熟悉' && v.petName === '师兄', 'view 输出阶段/称呼');
  ok(Array.isArray(v.memories), 'view 输出记忆列表');
  const dump = A.exportAll();
  ok(dump.v === '1.0.0' && dump.records['庚'], 'exportAll 导出含档案');
  const snap = JSON.stringify(dump);
  A.remove('庚');
  ok(A.importAll(JSON.parse(snap)) === true && A.get('庚').petName === '师兄', 'importAll 恢复');
}

G('9. 统计');
{
  const s = A.stats();
  ok(s.records > 0 && s.vault > 0, 'stats 含档案数与库房数');
  ok(typeof s.stats.interactions === 'number', 'stats 含互动计数');
  ok(s.stageLabels.length === 6, 'stats 含阶段标签');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
