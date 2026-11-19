/* 云境 · 性格心理模型回归测试 (v4.47.0) */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function load(file) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  const ctx = { window: {}, module: { exports: {} }, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return ctx.module.exports;
}

const PM = load('js/psyche-model.js');
const PC = load('js/personality-codex.js');

console.log('\n===== 1. 数据规模与版权 =====');
const st = PM.stats();
ok(st.psyches === 72, `心理档案 72 种（${st.psyches}）`);
ok(st.stages === 10, `关系光谱 10 阶段（${st.stages}）`);
ok(st.triggerTiers === 3, `触发分级 3 档（${st.triggerTiers}）`);
const raw = fs.readFileSync(path.join(root, 'js/psyche-model.js'), 'utf8');
ok(raw.includes('essence') && raw.includes('drive') && raw.includes('fear') && raw.includes('breaking'), '心理字段为云境自有命名');

console.log('\n===== 2. 72种 × 七项全覆盖 =====');
let miss = [], unknown = [];
const FIELDS = ['essence', 'drive', 'fear', 'mechanism', 'contrast', 'breaking', 'voice'];
PC.TRAIT_CODEX.forEach(t => {
  const p = PM.of(t.name, t.cat);
  FIELDS.forEach(k => { if (!p[k] || String(p[k]).length < 2) miss.push(t.name + '.' + k); });
  if (!p.known) unknown.push(t.name);
});
ok(miss.length === 0, '全部 72 种七项非空' + (miss.length ? '：' + miss.join(',') : ''));
ok(unknown.length === 0, '全部 72 种均已建档' + (unknown.length ? '：' + unknown.join(',') : ''));

console.log('\n===== 3. 关系光谱差异化 =====');
PC.CAT_KEYS.forEach(cat => {
  ok(new Set(PM.SPECTRUM[cat]).size === 10, `${cat} 类 10 阶段表现互不相同`);
});
const sp1 = PM.spectrum('韩立', 'dark', '宿敌').text;
const sp2 = PM.spectrum('韩立', 'dark', '伴侣').text;
ok(sp1 !== sp2 && !!sp1 && !!sp2, '同性格不同关系阶段表现不同');
ok(PM.spectrum('仁厚', 'positive', '不存在的阶段').stage === '陌生', '非法阶段回落到陌生');

console.log('\n===== 4. 渐变曲线与触发分级 =====');
ok(PM.graduationAt(0).phase === '初期' && PM.graduationAt(30).phase === '中期' && PM.graduationAt(90).phase === '后期', '历时三阶段划分正确');
ok(PM.triggerTier('你杀了他').label === '致命', '极端事件判为致命');
ok(PM.triggerTier('他骗了我').label === '中度', '冒犯判为中度');
ok(PM.triggerTier('今天天气不错').label === '轻度', '日常判为轻度');
ok(PM.triggerTier('', 'critical').label === '致命', '显式强度可覆盖');

console.log('\n===== 5. 心理反应引擎 =====');
const r = PM.react('多疑', 'dark', { stage: '敌视', eventText: '他背叛了我', days: 70 });
ok(r.tier === '致命' && r.breaking === true && r.mood === '破防', '致命触发标记破防');
ok(r.stage === '敌视' && r.phase === '后期', '反应携带关系阶段与渐变期');
ok(!!r.surface && !!r.real && r.surface !== r.real, '表象行为与真实倾向分离');
ok(r.rationale.includes('心理') && r.rationale.includes('关系'), '反应给出可追溯依据');
const calm = PM.react('仁厚', 'positive', { stage: '熟悉', eventText: '一起吃饭', days: 3 });
ok(calm.breaking === false && calm.mood === '常态', '日常事件不破防');

console.log('\n===== 6. 性格世界书联动（共享上下文） =====');
ok(PC.TRAIT_CODEX.length === st.psyches, '辞典性格数与心理档案数一致');
// 把两个模块加载到同一 vm 上下文，验证真实联动注入
const sharedCtx = { window: {}, module: { exports: {} }, console };
sharedCtx.globalThis = sharedCtx;
vm.createContext(sharedCtx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/psyche-model.js'), 'utf8'), sharedCtx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/personality-codex.js'), 'utf8'), sharedCtx);
const PC2 = sharedCtx.module.exports;
const h = PC2.forRole('韩立', 'fanrenxiuxian');
ok(!!h.psychology, 'forRole 注入心理模型 psychology 字段');
ok(h.psychology && h.psychology.fear && h.psychology.essence, '心理档案含本质与核心恐惧');
ok(h.psychology && Object.keys(h.psychology.spectrum || {}).length === 10, '心理档案含10阶段关系光谱');
const b = PC2.behaviorOf('韩立', 'fanrenxiuxian', { stage: '敌视', events: [{ text: '他背叛了我' }], days: 70 });
ok(!!b.psychology && b.psychology.tier === '致命' && b.psychology.breaking, '行为引擎叠加心理破防');
ok(b.psychology && !!b.psychology.surface && !!b.psychology.real, '行为输出含表象与真实双层');
const br = PC2.brief('韩立', 'fanrenxiuxian');
ok(br.includes('心理') && br.includes('核心恐惧') && br.includes('行事机制'), 'AI速写注入心理模型');
ok(br.includes('本质') || br.includes('行事机制'), 'AI速写采用云境自有心理措辞');

console.log('\n===== 结果：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
