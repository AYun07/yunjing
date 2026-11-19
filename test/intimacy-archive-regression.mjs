// 云境 · 动态亲密关系档案回归（原创实现，机制层测试）v4.45.0
// 用法：node test/intimacy-archive-regression.mjs
// 验证：默认关闭/门禁、五维动态升降、负面关系阶段、玩家锁定、演化、
//       表达尺度、记忆分层、只增不删库房、认知边界、存档升级。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/intimacy-archive.js'), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ ' + msg); } };

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
ok(A.VERSION === '2.0.0', '版本号正确');
ok(A.isEnabled() === false, '默认关闭（需显式开启）');
ok(A.STAGES.length === 10, '十段双向关系阶段（宿敌→伴侣）');
ok(A.AXES.length === 5, '五维关系轴定义存在');
ok(A.gate('x') === false && A._state.stats.gated > 0, '关闭时门禁拦截并计数');

G('1. 开启与建档');
ok(A.setEnabled(true) === true && A.isEnabled() === true, 'setEnabled 开启生效');
ok(store['yunjing.intimacy.enabled.v1'] === '1', '开启状态持久化');
{
  const r = A.ensure('柳师姐');
  ok(r && r.name === '柳师姐', '建档成功');
  ok(r.stage === 4 && A.STAGES[4].label === '陌生', '新档案默认陌生');
  ok(r.axes.favor === 0 && r.axes.trust === 0 && r.locks.closeness === false, '五轴归零、无锁定');
  ok(A.ensure('') === null, '空名字拒绝建档');
}

G('2. 关系可升可降（拆除棘轮）');
{
  A.ensure('甲');
  let r = A.addCloseness('甲', 30, '同行');
  ok(r.stage > 4, '正向增量推进阶段');
  const up = r.stage;
  r = A.addCloseness('甲', -15, '争执');
  ok(r.stage < up || r.closeness < 30, '负向增量使关系回落（无棘轮）');
  ok(A.get('甲').history.some(h => h.source === 'legacy'), '变动留痕');
}

G('3. 负面关系');
{
  A.ensure('仇人');
  A.setRelation('仇人', { favor: -80, trust: -90, esteem: -60, closeness: -70, desire: -50 });
  const v = A.view('仇人', '玩家');
  ok(v.stage <= 2, `负值关系落入负面阶段（stage=${v.stage}）`);
  ok(['宿敌','敌视','厌恶'].indexOf(v.stageLabel) >= 0, `负面标签正确（${v.stageLabel}）`);
}

G('4. 五维独立增减与玩家锁定');
{
  A.ensure('乙');
  let x = A.adjustAxis('乙', 'trust', 20, { reason: '患难' });
  ok(x.value === 20 && x.label === '信任', '信任轴独立+20');
  x = A.adjustAxis('乙', 'favor', -10, { reason: '口角' });
  ok(x.value === -10, '好感轴独立-10（可降）');
  const s = A.setAxis('乙', 'closeness', 60, '玩家手动设定');
  ok(s.locked === true && A.get('乙').locks.closeness === true, '玩家设定打锁定标记');
  ok(A.lockAxis('乙', 'trust', true) === true, '可手动锁定信任轴');
  ok(A.expressionInfo().current === 'subtle', '默认表达尺度=含蓄');
}

G('5. 动态演化：时间/事件/因素/性格倾向');
{
  A.ensure('丙');
  A.setRelation('丙', { favor: 60, trust: 50, esteem: 40, closeness: 60, desire: 30 });
  const before = A.get('丙').total;
  let ev = A.evolve('丙', { days: 30 });
  ok(ev.after < before, `随时间自然回落（${before}→${ev.after}）`);
  ok(ev.detail.length > 0, '演化返回变动明细');

  const t0 = A.get('丙').total;
  ev = A.evolve('丙', { events: [{ axis: 'favor', delta: 20, reason: '救命之恩' }] });
  ok(ev.after > t0, '事件冲击使关系上升');

  A.setAxis('丙', 'trust', 40, '玩家锁定信任');   // setAxis 打锁定
  const trustBefore = A.get('丙').axes.trust;
  const evLocked = A.evolve('丙', { days: 30, events: [{ axis: 'trust', delta: 30, reason: '试图提升' }] });
  ok(A.get('丙').axes.trust === trustBefore, '玩家锁定的信任轴不被演化覆盖');
  ok(evLocked.lockedAxes.indexOf('trust') >= 0, '演化结果回报锁定轴清单');

  A.ensure('丁');
  A.setRelation('丁', { trust: 0 });
  const high = A.evolve('丁', { events: [{ axis: 'trust', delta: 20 }], personalityBias: { trust: 1.5 } });
  const highTrust = A.get('丁').axes.trust;   // 20*1.5 = 30
  A.setRelation('丁', { trust: 0 });
  const low = A.evolve('丁', { events: [{ axis: 'trust', delta: 20 }], personalityBias: { trust: 0.5 } });
  const lowTrust = A.get('丁').axes.trust;    // 20*0.5 = 10
  ok(highTrust > lowTrust, `性格倾向影响演化增益（高${highTrust} > 低${lowTrust}）`);
}

G('6. 记忆分层留存 40/12/5');
{
  A.ensure('戊');
  for (let i = 0; i < 60; i++) A.remember('戊', '日常' + i, 0);
  for (let i = 0; i < 20; i++) A.remember('戊', '普通' + i, 1);
  for (let i = 0; i < 50; i++) A.remember('戊', '重要' + i, 2);
  const mem = A.get('戊').memories;
  const c0 = mem.filter(m => m.weight === 0).length, c1 = mem.filter(m => m.weight === 1).length, c2 = mem.filter(m => m.weight === 2).length;
  ok(c0 === 5 && c1 === 12 && c2 === 40, `分层裁剪 5/12/40（实得 ${c0}/${c1}/${c2}）`);
}

G('7. 表达尺度（含蓄/直白/露骨）');
{
  ok(A.setExpression('subtle') === 'subtle', '切含蓄档');
  ok(A.sanitize('性交描写') === '', '含蓄档拦截露骨词');
  ok(A.systemHint().indexOf('含蓄') >= 0, '含蓄档提示词含文学化约束');
  ok(A.setExpression('frank') === 'frank', '切直白档');
  ok(A.systemHint().indexOf('坦率') >= 0, '直白档提示词改为直接表达');
  ok(store['yunjing.intimacy.expression.v1'] === 'frank', '表达尺度持久化');
  ok(A.setExpression('explicit') === 'explicit', '切露骨档');
  ok(A.sanitize('性交描写') === '性交描写', '露骨档不拦截（交由玩家模型）');
  ok(A.systemHint().indexOf('无需回避') >= 0, '露骨档提示词移除硬禁令');
  A.setExpression('subtle'); // 复位
}

G('8. 只增不删库房');
{
  A.ensure('己');
  A.setPetName('己', '阿己');
  const before = A.vaultSize();
  ok(A.remove('己') === true && A.get('己') === null, 'remove 移出主库');
  ok(A.vaultSize() === before + 1, '快照进库房');
  ok(A.restore('己') === true && A.get('己').petName === '阿己', 'restore 恢复');
}

G('9. 称呼/边界/可信名单');
{
  A.ensure('庚');
  ok(A.setPetName('庚', '小庚') === '小庚', '称呼写入');
  ok(A.setBoundary('庚', 'touch', '仅牵手') === '仅牵手', '边界写入');
  ok(A.setBoundary('庚', 'bad', 'x') === null, '非法键拒绝');
  A.setTrusted('庚', '玩家');
  ok(A.get('庚').trusted.indexOf('玩家') >= 0, '可信名单加入');
  A.setTrusted('庚', '玩家', false);
  ok(A.get('庚').trusted.indexOf('玩家') < 0, '可信名单移除');
}

G('10. 本地互动确定性');
{
  const a = A.localInteraction('辛', 3), b = A.localInteraction('辛', 3);
  ok(a && b && a.text === b.text, '同种子同回合文本一致');
  ok(A.LOCAL_LINES.indexOf(a.text) >= 0, '文本来自原创语料库');
}

G('11. 认知边界');
{
  A.ensure('壬');
  A.setRelation('壬', { favor: 80, trust: 80, esteem: 70, closeness: 80, desire: 60 });
  const priv = A.remember('壬', '一封只给她的信', 2);
  ok(A.visibleTo('壬', '陌生人', priv) === true, '高关系阶段下私密记忆可见');
  const low = A.remember('壬', '秘密', { stage: 0 });
  ok(A.visibleTo('壬', '路人', { weight: 2, stage: 0 }) === false, '低阶段+非可信不可见');
  A.setTrusted('壬', '心腹');
  ok(A.visibleTo('壬', '心腹', { weight: 2, stage: 0 }) === true, '可信名单可见');
  ok(A.visibleTo('壬', 'x', { weight: 0 }) === true, '日常记忆公开');
}

G('12. 视图与存档升级');
{
  A.ensure('癸');
  A.adjustAxis('癸', 'favor', 30);
  A.setPetName('癸', '师兄');
  const v = A.view('癸', '玩家');
  ok(v.axes && v.axes.favor === 30 && v.petName === '师兄', 'view 输出五维与称呼');
  ok(Array.isArray(v.history), 'view 输出变动历史');
  const dump = A.exportAll();
  ok(dump.v === '2.0.0' && dump.records['癸'], 'exportAll 导出含档案');
  const snap = JSON.stringify(dump);
  A.remove('癸');
  ok(A.importAll(JSON.parse(snap)) === true && A.get('癸').petName === '师兄', 'importAll 恢复');
  // 老存档字段升级
  const legacy = { v: '1.0.0', records: { 老角色: { name: '老角色', closeness: 70, stage: 0 } } };
  ok(A.importAll(legacy) === true, '老存档可导入');
  ok(A.get('老角色').axes.closeness === 70 && Array.isArray(A.get('老角色').history), '老档案补齐五轴与历史字段');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
