// 云境 · AI 增强接入桥回归（原创实现）
// 用法：node test/ai-augment-bridge-regression.mjs
// 零依赖 Node vm 沙箱。验证：包装接入、本地保底先产出、AI润色覆盖、
// AI失败不影响返回结果、四环节接线状态。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'js/ai-augment-bridge.js'), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};
const tick = () => new Promise(r => setTimeout(r, 0));

G('0. 模块加载');
const sb = {
  console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
  addEventListener: (evt, fn) => { (sb.__handlers[evt] = sb.__handlers[evt] || []).push(fn); },
  __handlers: {},
  AIAugment: {
    isTaskAvailable: (t) => sb.__on[t] !== false,
    enhance: async (tag, prompt, opts) => {
      (sb.__enhanced = sb.__enhanced || []).push(tag);
      if (sb.__aiFail) throw new Error('模拟失败');
      return { ok: true, text: '【AI润色】' + prompt.slice(0, 8) };
    }
  },
  __on: {},
  storyFramework: { storyState: { variables: { 时间: { pendingEvents: ['原始世界事件'] } } } }
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const B = sb.AIAugmentBridge;
ok(!!B, 'AIAugmentBridge 已挂载');
ok(B.VERSION === '1.0.0', '版本号正确');

G('1. 亲密互动包装：本地保底先产出、AI润色覆盖');
{
  let localCalls = 0;
  sb.IntimacyArchive = {
    recordInteraction: (name, text, opts) => { localCalls++; return { text, name }; },
    sanitize: (t) => t
  };
  B._hooks.hookIntimacy();
  const r = sb.IntimacyArchive.recordInteraction('甲', '两人对坐', { allowAI: true });
  ok(localCalls === 1 && r.text === '两人对坐', '本地结果同步先返回（不阻塞）');
  await tick();
  ok(/AI润色/.test(r.text), 'AI 异步润色覆盖了文本');
  ok((sb.__enhanced || []).includes('intimacy'), 'intimacy 增强被调用');
}

G('2. 亲密互动：AI失败不影响本地结果');
{
  sb.__aiFail = true;
  const r2 = sb.IntimacyArchive.recordInteraction('乙', '原始文本', { allowAI: true });
  await tick();
  ok(r2.text === '原始文本', 'AI 失败仍保留本地文本');
  sb.__aiFail = false;
}

G('3. NPC 演化包装');
{
  sb.NPCBridge = { driveOne: (name, ctx) => ({ name, active: true, deed: '本地动向', phase: 'mission' }) };
  B._hooks.hookNPC();
  const r = sb.NPCBridge.driveOne('丙', {});
  ok(r.deed === '本地动向', '本地 deed 先返回');
  await tick();
  ok(/AI润色/.test(r.deed), 'AI 润色覆盖 NPC 动向');
  ok((sb.__enhanced || []).includes('npc'), 'npc 增强被调用');
}

G('4. 世界事件监听润色');
{
  B._hooks.hookWorld();
  const hs = sb.__handlers['yj:world-tick'] || [];
  ok(hs.length === 1, '已监听 yj:world-tick');
  hs[0]({}); // 触发
  await tick();
  const ev = sb.storyFramework.storyState.variables.时间.pendingEvents[0];
  ok(/AI润色/.test(ev), 'AI 润色覆盖待注入世界事件');
  ok((sb.__enhanced || []).includes('world'), 'world 增强被调用');
}

G('5. 表格/推演既有通道识别（不重复调用）');
{
  sb.VariableAI = { isReady: () => true };
  sb.Planner = { generate: async () => {} };
  const st = B.status();
  ok(st.existingChannels.variable === true, '识别 VariableAI 已激活');
  ok(st.existingChannels.planner === true, '识别 Planner 通道存在');
}

G('6. boot 幂等');
{
  ok(B.boot() === true && B.boot() === true, 'boot 幂等');
  const st = B.status();
  ok(st.booted === true, '状态显示已接入');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
