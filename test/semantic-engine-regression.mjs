// 云境 · 语义词缀引擎回归（原创实现）
// 用法：node test/semantic-engine-regression.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const G = (n) => console.log('\n### ' + n);
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

function makeSandbox(genre, round) {
  const mem = {};
  const ls = { getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem(k, v) { mem[k] = String(v); }, removeItem(k) { delete mem[k]; } };
  const v = { chapter: round || 5, genre: genre || 'fanrenxiuxian', stats: { 力量: 50, 神识: 40 } };
  const sb = { console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
    localStorage: ls, addEventListener() {}, dispatchEvent() {}, CustomEvent: function () {}, Event: function () {},
    storyFramework: { slotId: 'main', storyState: { variables: v } },
    location: { search: '?genre=' + (genre || 'fanrenxiuxian') } };
  sb.window = sb; sb.globalThis = sb; sb.__mem = mem; sb.__vars = v;
  return sb;
}
function load(sb) { vm.createContext(sb); vm.runInContext(read('js/semantic-engine.js'), sb); return sb.SemanticEngine; }

/* ==== 0. 加载 ==== */
G('0. 加载与元信息');
let SE = load(makeSandbox());
ok(!!SE, '语义引擎已挂载');
ok(SE.VERSION === '5.1.0', '版本 5.1.0');
ok(SE.SEMEMES.length >= 10, '语素词典 >= 10 组（' + SE.SEMEMES.length + '）');
ok(SE.stats().customTargets === 0, '初始无自定义目标');

/* ==== 1. 语意解读：自然语言词条 → 属性倾向 ==== */
G('1. 语意解读 interpret()');
{
  const atk = SE.interpret('锋锐无双');
  ok(atk.length > 0 && atk[0].stat === 'atk', '「锋锐无双」解读为攻击（' + (atk[0] && atk[0].stat) + '）');
  const def = SE.interpret('坚壁');
  ok(def.length > 0 && def[0].stat === 'def', '「坚壁」解读为防御');
  const spd = SE.interpret('疾风步');
  ok(spd.length > 0 && spd[0].stat === 'spd', '「疾风步」解读为速度');
  const hp = SE.interpret('回春');
  ok(hp.length > 0 && hp[0].stat === 'hp', '「回春」解读为气血');
  const mind = SE.interpret('道心通明');
  ok(mind.length > 0 && mind.some(a => a.stat === 'mind' || a.stat === 'learn'), '「道心通明」解读为心志/修学');
  const luck = SE.interpret('福缘深厚');
  ok(luck.length > 0 && luck[0].stat === 'luck', '「福缘深厚」解读为机缘');
}
/* ==== 2. 程度副词与减益 ==== */
G('2. 程度副词与减益语素');
{
  const weak = SE.interpret('锋锐');
  const strong = SE.interpret('锋锐无双');
  ok(Math.abs(strong[0].value) > Math.abs(weak[0].value), '「无双」强化强度（' + weak[0].value + '→' + strong[0].value + '）');
  const debuff = SE.interpret('钝锋');
  ok(debuff[0].value < 0 && debuff[0].tone === 'debuff', '「钝锋」解读为攻击减益');
}
/* ==== 3. 显式声明优先 ==== */
G('3. 玩家特殊说明（显式声明）优先');
{
  const ex1 = SE.interpret('烈焰焚天 +9攻击');
  ok(ex1.length > 0 && ex1[0].stat === 'atk' && ex1[0].value === 9 && ex1[0].source === 'explicit', '「+9攻击」显式覆盖为攻击+9');
  const ex2 = SE.interpret('玄铁盾 防御-3');
  ok(ex2.length > 0 && ex2[0].stat === 'def' && ex2[0].value === -3, '「防御-3」显式覆盖为防御-3');
  const ex3 = SE.interpret('星芒 暴击+5%');
  ok(ex3.length > 0 && ex3[0].stat === 'crit' && ex3[0].value === 5, '「暴击+5%」显式覆盖为暴击5');
  const ex4 = SE.interpret('攻击+12 速度+3');
  ok(ex4.length === 2 && ex4.some(a => a.stat === 'atk' && a.value === 12) && ex4.some(a => a.stat === 'spd' && a.value === 3), '多属性显式声明全部解析');
  const ex5 = SE.interpret('攻击力 12');
  ok(ex5.length > 0 && ex5[0].stat === 'atk' && ex5[0].value === 12, '「攻击力 12」（空格分隔）可解析');
}
/* ==== 4. 涌现：任意文本都有意义 ==== */
G('4. 涌现通道（无已知语素也有弱加成）');
{
  const weird = SE.interpret('咕噜咕噜');
  ok(weird.length > 0 && weird[0].source === 'semantic', '无已知语素的文本也产出弱词条');
  ok(Math.abs(weird[0].value) <= 3, '涌现词条强度微弱（<=3）');
}
/* ==== 5. 动态生成：情境种子 ==== */
G('5. 动态生成 generate()');
{
  const ctx = SE.contextOf({ genre: 'fanrenxiuxian', round: 5, diceSeed: 7, inBattle: true, ownerName: '玄铁剑' });
  const g1 = SE.generate(ctx, 2, '玄铁剑').map(a => a.name + '|' + a.stat).join(',');
  const g2 = SE.generate(ctx, 2, '玄铁剑').map(a => a.name + '|' + a.stat).join(',');
  ok(g1 === g2, '同情境种子结果可复现');
  const ctx2 = SE.contextOf({ genre: 'fanrenxiuxian', round: 6, diceSeed: 8, inBattle: false, ownerName: '玄铁剑' });
  const g3 = SE.generate(ctx2, 2, '玄铁剑').map(a => a.name + '|' + a.stat).join(',');
  ok(g1 !== g3, '不同情境产出不同词条（动态涌现）');
  const gen = SE.generate(ctx, 3, '玄铁剑');
  ok(gen.length >= 1 && gen.every(a => a.stat && a.value !== 0), '生成的词条结构完整');
}
/* ==== 6. 玩家自定义：持久化 + 优先 ==== */
G('6. 玩家自定义 setCustom()');
{
  const sb = makeSandbox(); const S = load(sb);
  const target = 'gear:烈焰剑';
  S.setCustom(target, '锋锐无双 回春');
  ok(S.getCustomText(target) === '锋锐无双 回春', '自定义文本已存储');
  const afs = S.customAffixes(target);
  ok(afs.length >= 2, '自定义多行文本解读为多条词条（' + afs.length + '）');
  ok(afs.every(a => a.source === 'custom'), '来源标记为 custom');
  const resolved = S.resolve(target, { name: '烈焰剑' });
  ok(resolved.every(a => a.source === 'custom'), 'resolve 优先返回自定义而非动态生成');
  ok(!!sb.__mem['yunjingSemanticCustom~main'], '自定义写入 localStorage');
  S.clearCustom(target);
  ok(S.getCustomText(target) === '', '清除自定义生效');
}
/* ==== 7. 大模型双重解读（v5.1.0）==== */
G('7. 大模型双重解读 enrich()');
{
  // 构造带 fetch / 治理通道 / API 配置的沙箱
  const sb = makeSandbox();
  let fetchCalls = 0, lastBody = null;
  const replies = {};
  sb.fetch = async (url, opts) => {
    fetchCalls++;
    lastBody = JSON.parse(opts.body);
    const texts = JSON.parse(lastBody.messages.find(m => m.role === 'user').content);
    const arr = texts.map(t => replies[t] || { text: t, items: [{ stat: 'atk', value: 7, desc: '大模型解读' }] });
    return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n' + JSON.stringify(arr) + '\n```' } }] }) };
  };
  sb.storyFramework.apiConfig = { type: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'sk-test', model: 'test-model' };
  let bonusChanges = 0;
  sb.dispatchEvent = () => { bonusChanges++; };
  sb.TokenUsage = { recordRequest() {}, recordOutput() {} };
  const S = load(sb);

  ok(S.llmEnabled() === true, '大模型解读默认开启');
  const text = '星陨灭世斩';
  // 本地先解读（无缓存 → 本地语素）
  const before = S.interpret(text);
  ok(before.every(a => a.source !== 'llm'), '无缓存时 interpret 用本地语素');
  // 设定大模型专门解读该文本为暴击
  replies[text] = { text, items: [{ stat: 'crit', value: 15, desc: '毁灭一击必中要害' }] };
  await S.enrich([text]);
  ok(fetchCalls === 1, 'enrich 只发 1 次请求（' + fetchCalls + '）');
  ok(lastBody.model === 'test-model', '走玩家配置的模型');
  ok(bonusChanges >= 1, '解读完成派发 yj:bonus-change 触发重算');
  const after = S.interpret(text);
  ok(after.length > 0 && after[0].stat === 'crit', '缓存命中后 interpret 采用大模型解读（crit）');
  ok(after[0].source === 'llm', '来源标记为 llm');
  ok(after[0].by === 'test-model', '记录解读模型名');

  // 去重：再 enrich 一次同一文本，不再发请求
  const fc = fetchCalls;
  await S.enrich([text]);
  ok(fetchCalls === fc, '已缓存文本不再重复请求（成本纪律）');

  // 显式声明优先：即使有大模型缓存，显式数值声明仍覆盖
  const explicit = S.interpret('攻击+99');
  ok(explicit.some(a => a.source === 'explicit' && a.stat === 'atk' && a.value === 99), '显式声明优先于大模型/本地');
  const explicitEnrich = await S.enrich(['攻击+42']);
  ok(explicitEnrich.cached === 1, '显式声明文本跳过大模型解读');

  // JSON 解析容错
  ok(S.parseLLMResult('前后文字 [{"stat":"def","value":6}] 尾巴').length === 1, 'parseLLMResult 容错裸数组');
  ok(S.parseLLMResult('```json\n[{"stat":"hp","value":9}]```')[0].value === 9, '解析围栏 JSON');
  const clamped = S.parseLLMResult('[{"stat":"atk","value":9999}]')[0];
  ok(clamped.value === 50, '异常数值被钳制到上限 50');
  const badStat = S.parseLLMResult('[{"stat":"unknown","value":3}]');
  ok(badStat.length === 0, '非法 stat 被过滤');

  // 开关：关闭后 enrich 不请求，interpret 不读缓存
  S.setLLMEnabled(false);
  ok(S.llmEnabled() === false, '可关闭大模型解读');
  const fc2 = fetchCalls;
  await S.enrich(['全新文本xyz']);
  ok(fetchCalls === fc2, '关闭后 enrich 不发请求');
  S.setLLMEnabled(true);
  S.llmClear();
  ok(S.stats().llm.cached === 0, '清空缓存生效');
}

/* ==== 8. 无 fetch / 未配置降级（Node 纯本地）==== */
G('8. 降级保底');
{
  const S = load(makeSandbox());  // 无 fetch、无 apiConfig
  const r = await S.enrich(['烈焰剑']);
  ok(r.source === 'unconfigured' || r.source === 'no-fetch', '无配置/无 fetch 时静默降级（' + r.source + '）');
  ok(S.interpret('锋锐').length > 0, '降级后本地语意仍正常工作');
}

/* ==== 9. 版权词 ==== */
G('9. 版权红线');
{
  const src = read('js/semantic-engine.js');
  ['契约者', '土著', '随从', '轮回乐园'].forEach(kw =>
    ok(src.indexOf(kw) < 0, '语义引擎无「' + kw + '」'));
}

console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
if (fail > 0) process.exit(1);
