// 云境 · 统一 AI 增强调度层回归（原创实现）
// 用法：node test/ai-augment-regression.mjs
// 零依赖 Node vm 沙箱。验证：默认关闭/分项开关、采样策略、成本累计、
// 失败降级、不重复 acquire（复用 callOpenAI）、强制调用。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/ai-augment.js'), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};

const store = {};
let callsSeen = [];
const sb = {
  console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); } },
  TokenUsage: {
    recordRequest: (m, t) => callsSeen.push(['req', t]),
    recordOutput: (x, t) => callsSeen.push(['out', t])
  },
  AIGovernor: { reward: () => callsSeen.push(['reward']) },
  callOpenAI: async (messages, opts) => {
    callsSeen.push(['call', messages[0].content.slice(0, 10), opts.maxTokens]);
    return '润色后的含蓄文本';
  }
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const AI = sb.AIAugment;

const tick = () => new Promise(r => setTimeout(r, 0));

G('0. 模块加载与默认关闭');
ok(!!AI, 'AIAugment 已挂载');
ok(AI.VERSION === '1.0.0', '版本号正确');
ok(AI.isEnabled() === false, '总开关默认关闭');
ok(Object.keys(AI.TASKS).length === 5, '五项增强任务定义存在');
ok(AI.status().total.calls === 0, '初始成本为空');

G('1. 总开关关闭时不调用');
{
  const r = await AI.enhance('npc', '测试', { force: true });
  ok(r.fallback === true && r.reason === 'not-sampled' || r.fallback === true, '关闭时降级、不调用');
  ok(callsSeen.length === 0, '未发起任何真实调用');
}

G('2. 开启总开关 + 分项开关');
{
  ok(AI.setEnabled(true) === true && AI.isEnabled(), '总开关开启');
  ok(AI.isTaskAvailable('npc') === false, '分项默认仍关（精准控制）');
  ok(AI.setTask('npc', true) === true, '开启 NPC 分项');
  ok(AI.isTaskAvailable('npc') === true, '分项可用');
  ok(AI.isTaskAvailable('world') === false, '其它分项仍关');
}

G('3. 采样策略（每 N 次触发一次）');
{
  AI.resetStats();
  const every = AI.TASKS.npc.every; // 3
  const results = [];
  for (let i = 0; i < every; i++) { results.push(await AI.enhance('npc', '演化' + i)); await tick(); }
  const hit = results.filter(r => r.ok).length;
  ok(hit === 1, `每${every}次仅1次真实调用（实得${hit}）`);
  ok(results.filter(r => r.reason === 'not-sampled').length === every - 1, '其余为采样跳过降级');
}

G('4. 强制调用 + 成本累计');
{
  AI.resetStats();
  const r = await AI.enhance('npc', '关键演化', { force: true });
  ok(r.ok === true && r.text === '润色后的含蓄文本', '强制调用成功并返回文本');
  const st = AI.status();
  ok(st.cost.npc.calls === 1, '调用数累加');
  ok(st.cost.npc.tokIn > 0 && st.cost.npc.tokOut > 0, 'token 输入/输出均记账');
  ok(st.total.calls === 1, '总量汇总正确');
}

G('5. 复用 callOpenAI，不重复 acquire');
{
  AI.resetStats();
  // 沙箱里 AIGovernor 没有 acquire，若本层重复 acquire 会直接报错——能成功即证明复用
  const r = await AI.enhance('npc', 'x', { force: true });
  ok(r.ok === true, '直接复用 callOpenAI 成功（本层未自行 acquire）');
  ok(callsSeen.some(c => c[0] === 'reward'), '成功后通知闸门 reward');
}

G('6. TokenUsage 记账 tag 正确');
{
  ok(callsSeen.some(c => c[0] === 'req' && c[1] === '增强·npc'), 'recordRequest 用增强分项 tag');
  ok(callsSeen.some(c => c[0] === 'out' && c[1] === '增强·npc'), 'recordOutput 用增强分项 tag');
}

G('7. parse 解析回调');
{
  const r = await AI.enhance('npc', '给JSON', { force: true, parse: (t) => ({ len: t.length }) });
  ok(r.parsed && r.parsed.len > 0, 'parse 回调产出结构化结果');
}

G('8. 失败降级不阻塞');
{
  const orig = sb.callOpenAI;
  sb.callOpenAI = async () => { throw new Error('模拟限流'); };
  ABORT: {
    const r = await AI.enhance('npc', 'x', { force: true });
    ok(r.ok === false && r.fallback === true, 'AI 失败 → 降级标记');
    ok(/模拟限流/.test(r.error || ''), '错误信息透传');
  }
  sb.callOpenAI = orig;
  ok(AI.status().errors === 1, '错误计数 +1');
}

G('9. 持久化与重置');
{
  ok(store['yunjing.ai-augment.v1'] && JSON.parse(store['yunjing.ai-augment.v1']).enabled === true, '开关状态持久化');
  ok(AI.resetStats() === true && AI.status().total.calls === 0, 'resetStats 清零成本');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
