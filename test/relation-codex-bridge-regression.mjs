// 云境 · 动态关系×性格桥接回归（原创实现）v4.45.0
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
const G = (n) => console.log('\n### ' + n);
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const store = {};
const listeners = {};
const sb = {
  console, Math, JSON, Date, Number, String, Object, Array, Set, URLSearchParams, isFinite, isNaN,
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); } },
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  location: { search: '?genre=fanrenxiuxian' }
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(load('js/personality-codex.js'), sb);
vm.runInContext(load('js/intimacy-archive.js'), sb);
// mock NPCBridge
const npcCalls = [];
sb.NPCBridge = { applyDisposition: function (name, patch, opts) { npcCalls.push({ name, patch: JSON.parse(JSON.stringify(patch)), opts }); return { patch }; } };
vm.runInContext(load('js/relation-codex-bridge.js'), sb);

const IA = sb.IntimacyArchive, PC = sb.PersonalityCodex, BR = sb.RelationCodexBridge;

G('0. 加载');
ok(!!IA && !!PC && !!BR, '三模块已挂载');

G('1. 世界识别');
ok(BR.worldKey() === 'fanrenxiuxian', '从 URL 参数识别当前世界');

G('2. 事件→关系轴映射');
{
  const imp = BR.eventsToImpacts(['他救了我一命']);
  ok(imp.some(i => i.axis === 'trust' && i.delta > 0), '救命事件→信任上升');
  const bad = BR.eventsToImpacts(['他背叛出卖了我']);
  ok(bad.some(i => i.axis === 'trust' && i.delta < 0), '背叛事件→信任下降');
  ok(BR.eventsToImpacts(['天气不错']).length === 0, '无关事件不映射');
}

G('3. 世界时钟驱动关系演化');
{
  IA.setEnabled(true);
  IA.setRelation('韩立', { favor: 50, trust: 50, closeness: 50 });
  const before = IA.get('韩立').total;
  BR.boot();
  ok(!!listeners['yj:world-tick'] && listeners['yj:world-tick'].length > 0, '已监听世界时钟事件');
  listeners['yj:world-tick'][0]({ detail: { day: 10, span: 5, ev: '他救了我一命', major: false } });
  ok(BR.status().stats.relationsEvolved > 0, '时钟触发关系演化计数');
  const after = IA.get('韩立').total;
  ok(typeof after === 'number' && BR.status().stats.lastSpan === 5, `演化后总分有效、跨度记录正确（span=5）`);
}

G('4. 玩家锁定优先');
{
  IA.setAxis('韩立', 'trust', 55, '玩家设定');
  const tb = IA.get('韩立').axes.trust;
  listeners['yj:world-tick'][0]({ detail: { day: 11, span: 10, ev: '他背叛了我' } });
  ok(IA.get('韩立').axes.trust === tb, '玩家锁定的信任轴不被世界事件覆盖');
}

G('5. NPC 态度叠加性格倾向');
{
  BR._hooks.hookNPC();
  ok(sb.NPCBridge.__relationBiased === true, 'NPCBridge.applyDisposition 已包装');
  sb.NPCBridge.applyDisposition('韩立', { favor: 10 });
  const last = npcCalls[npcCalls.length - 1];
  ok(last.patch.favor !== undefined, '态度变更透传');
  const cnt = npcCalls.length;
  sb.NPCBridge.applyDisposition('韩立', { favor: 10 }, { playerSet: true });
  ok(npcCalls.length === cnt + 1, '玩家显式设定仍调用原方法');
  ok(BR.status().stats.npcBiased > 0, '性格倾向叠加计数');
}

G('6. 状态');
{
  const s = BR.status();
  ok(s.booted === true && typeof s.world === 'string', '状态含引导标志与世界');
}

G('7. 按性格+行为轨迹演化（v4.46）');
{
  BR.resetStats();
  ok(BR.status().stats.ticks === 0, '统计可重置');
  listeners['yj:world-tick'][0]({ detail: { day: 20, span: 3, ev: '敌人追杀，朋友背叛' } });
  const bh = BR.behaviorsNow(30);
  ok(bh.length > 0, `时钟驱动产生行为台账（${bh.length}条）`);
  const han = bh.find(x => x.name === '韩立');
  ok(!!han, '台账含韩立');
  ok(han && han.tendency && han.tendency.length > 0, '韩立按性格+轨迹输出行为倾向');
  ok(han && han.rationale && han.rationale.includes('轨迹'), '行为倾向含轨迹依据');
  ok(han && han.rationale && han.rationale.includes('原著锚点'), '原著角色行为含原著锚点依据');
  ok(BR.status().stats.behaviors > 0, '行为演化计数');
  // 未建档的世界角色也应纳入演化
  const hasRoster = bh.some(x => ['南宫婉','厉飞雨','大衍神君'].includes(x.name));
  ok(hasRoster, '同世界未建档角色也按性格演化');
}

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail === 0 ? 0 : 1);
