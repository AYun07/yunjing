// 云境 · 统一加成层 + 装备词条 + 称号系统回归（原创实现）
// 用法：node test/bonus-title-regression.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ ' + msg); } };

function makeSandbox(equip, title) {
  const mem = {};
  const ls = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem(k, v) { mem[k] = String(v); },
    removeItem(k) { delete mem[k]; },
    clear() { for (const k of Object.keys(mem)) delete mem[k]; }
  };
  const v = Object.assign({ chapter: 5, stats: { 力量: 50, 神识: 40, 道心: 60, 谋略: 30, 悟性: 55, 气运: 20 } }, equip || {});
  const sb = {
    console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
    localStorage: ls,
    setInterval: () => 99, clearInterval() {}, setTimeout: () => 99, clearTimeout() {},
    addEventListener() {}, dispatchEvent() {}, showToast() {}, CustomEvent: function () {}, Event: function () {},
    storyFramework: { slotId: 'main', storyState: { turnCount: 3, variables: v } },
    document: { head: { appendChild() {} }, body: { appendChild() {} },
      getElementById() { return null; }, createElement() { return { style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, set innerHTML(x) { this._h = x; }, get innerHTML() { return this._h || ''; } }; } }
  };
  sb.window = sb; sb.globalThis = sb;
  sb.__mem = mem; sb.__vars = v;
  if (title) mem['yunjingTitles~main'] = JSON.stringify({ claimed: {}, worn: title });
  return sb;
}
function load(sb) {
  vm.createContext(sb);
  vm.runInContext(read('js/attribute-engine.js'), sb);
  vm.runInContext(read('js/semantic-engine.js'), sb);
  vm.runInContext(read('js/bonus-engine.js'), sb);
  vm.runInContext(read('js/title-system.js'), sb);
  return { BE: sb.BonusEngine, TS: sb.TitleSystem, AE: sb.AttributeEngine, SE: sb.SemanticEngine };
}

/* ============ 0. 加载 ============ */
G('0. 模块加载与版本');
{
  const sb = makeSandbox(); const { BE, TS } = load(sb);
  ok(!!BE, 'BonusEngine 已挂载');
  ok(!!TS, 'TitleSystem 已挂载');
  ok(BE.VERSION === '5.1.0' && TS.VERSION === '5.0.0', '加成引擎 5.1.0 / 称号 5.0.0');
  ok(BE.AFFIX_POOL.length >= 12, '词条库 >= 12 条（' + BE.AFFIX_POOL.length + '）');
  ok(BE.AFFIX_POOL.some(a => a.tone === 'debuff'), '词条库含减益词条');
  ok(TS.TITLES.length >= 6, '称号库 >= 6 个（' + TS.TITLES.length + '）');
}

/* ============ 1. 词条生成：确定性 + 按品级递增 ============ */
G('1. 装备词条生成');
{
  const sb = makeSandbox(); const { BE } = load(sb);
  const common = BE.affixesFor('普通包袱');       // 凡品（无稀有词）
  const rare = BE.affixesFor('九转灵宝剑');       // 高品
  /* v5.0.0 新范式：凡品不再硬性无词条——名字有明确语意可出弱异象（世界奇妙什么都可能发生）；
     且常量名仍无意义（如「乙」），保持克制。这里「普通包袱」的「通」命中修学，出 1 条弱词条属预期。 */
  ok(common.length <= 1, '凡品装备至多 1 条弱词条（语意异象）');
  ok(BE.affixesFor('乙').length === 0, '完全无语意的凡品名无词条（克制）');
  ok(rare.length >= 2, '高品装备词条 >= 2（' + rare.length + '）');
  const a1 = BE.affixesFor('九转灵宝剑').map(x => x.text).join('|');
  const a2 = BE.affixesFor('九转灵宝剑').map(x => x.text).join('|');
  ok(a1 === a2, '同名装备词条确定性（同输入同结果）');
  ok(rare.every(a => a.stat && a.value !== 0), '每条词条有 stat 与非零值');
}

/* ============ 2. 净加成即时计算：增益/减益都算 ============ */
G('2. 净加成计算（装备）');
{
  const sb = makeSandbox({ '装备': { '武器': '九转灵宝剑' } }); const { BE } = load(sb);
  const n = BE.recompute();
  ok(n.equipped.length === 1 && n.equipped[0] === '九转灵宝剑', '采集到佩戴装备');
  ok(n.sources.length >= 2, '汇总出词条来源（' + n.sources.length + '）');
  ok(n.buffs.length >= 1, '含增益词条');
  const sumAtk = n.sources.filter(s => s.stat === 'atk').reduce((a, b) => a + b.value, 0);
  ok(n.atk === sumAtk, '攻击净加成 = 各来源之和（即时计算正确）');
  ok(BE.describe().indexOf('攻击') >= 0 || BE.describe().indexOf('气血') >= 0, '可读摘要含加成');
}

/* ============ 3. 卸下即还原 ============ */
G('3. 卸下装备 → 加成归零');
{
  const sb = makeSandbox({ '装备': { '武器': '九转灵宝剑' } }); const { BE } = load(sb);
  BE.recompute();
  ok(Math.abs(BE.netMods().atk) > 0, '佩戴时有攻击加成');
  sb.__vars['装备'] = {};
  BE.recompute();
  ok(BE.netMods().sources.length === 0 && BE.netMods().atk === 0, '卸下后加成归零');
}

/* ============ 4. 玩家手动词条覆盖：增益+减益混合 ============ */
G('4. 手动词条覆盖（增益与减益并存）');
{
  const sb = makeSandbox({ '装备': { '武器': '测试剑' } }); const { BE } = load(sb);
  BE.setAffixOverride('测试剑', [
    { id: 'sharp', value: 5 },
    { id: 'blunt', value: -2 }
  ]);
  const n = BE.recompute();
  ok(n.buffs.length >= 1 && n.debuffs.length >= 1, '同时含增益与减益');
  ok(n.atk === 3, '攻击净值 = +5-2 = +3（即时结算）');
  ok(BE.netMods().debuffs[0].value === -2, '减益明细保留负值');
}

/* ============ 5. 称号解锁/佩戴/加成 ============ */
G('5. 称号系统');
{
  const sb = makeSandbox(); const { BE, TS } = load(sb);
  // chapter=5：初露锋芒(ch1)解锁，万众瞩目(ch20)未解锁
  ok(TS.TITLES.find(t => t.id === 't_begin') && TS.isUnlocked(TS.TITLES.find(t => t.id === 't_begin')), '初露锋芒已解锁');
  ok(!TS.isUnlocked(TS.TITLES.find(t => t.id === 't_famous')), '万众瞩目未解锁（章节不足）');
  ok(TS.claim('t_begin') === true, '可领取已解锁称号');
  ok(TS.claim('t_famous') === false, '不可领取未解锁称号');
  ok(TS.wear('t_begin') === true, '可佩戴已领取称号');
  ok(TS.current() === '初露锋芒', '当前称号正确');
  ok(BE.recompute().title === '初露锋芒', 'BonusEngine 读到当前称号');
  // all:+1 → 六维各 +1 → stats 各键 +1
  const eff = BE.effectiveStats();
  ok(eff['力量'] === 51, '全维称号使力量 50→51（叠加到真实属性键）');
  ok(sb.__vars.stats['力量'] === 50, '原始 stats 未被污染（只读叠加）');
}

/* ============ 6. 装备+称号叠加不重复 ============ */
G('6. 装备与称号叠加');
{
  const sb = makeSandbox({ '装备': { '武器': '测试剑' } }); const { BE, TS } = load(sb);
  BE.setAffixOverride('测试剑', [{ id: 'sharp', value: 5 }]); // 攻击 +5
  TS.claim('t_bulwark'); TS.wear('t_bulwark'); // 独当一面：攻击+5 气血+10
  // 需 wins>=30，direct claim 会因未解锁失败；改用直接写 state + 触发同步
  sb.__mem['yunjingTitles~main'] = JSON.stringify({ claimed: { t_bulwark: true }, worn: 't_bulwark' });
  TS.recompute(); // 把新 worn 名字同步进 variables + 重算
  const n = BE.recompute();
  ok(n.atk === 10, '攻击净值 = 装备+5 + 称号+5 = +10（两源正确叠加）');
  ok(n.hp === 10, '气血净值 = 称号+10');
  const sharpSources = n.sources.filter(s => s.stat === 'atk');
  ok(sharpSources.length === 2, '攻击有两个独立来源（未合并丢失）');
}

/* ============ 7. 战斗/检定接入口径 ============ */
G('7. 战斗与检定读加成');
{
  const sb = makeSandbox({ '装备': { '武器': '测试剑' } }); const { BE, TS } = load(sb);
  BE.setAffixOverride('测试剑', [{ id: 'sharp', value: 5 }, { id: 'fury', value: 10 }]);
  BE.recompute();
  const cm = BE.combatMods();
  ok(cm.atk === 5 && cm.atkPct === 10, 'combatMods 暴露攻击点与百分比');
  const eff = BE.effectiveStats();
  ok(typeof eff === 'object' && Object.keys(eff).length > 0, 'effectiveStats 返回有效六维对象');
  const block = BE.buildPromptBlock();
  ok(block.indexOf('加成') >= 0 && block.indexOf('锋锐') >= 0, 'prompt 块含词条明细');
}

/* ============ 8. 语义驱动：动态生成 + 自定义覆盖 + 称号语意 ============ */
G('8. 语义引擎接入加成引擎');
{
  const sb = makeSandbox({ '装备': { '武器': '玄铁重剑' } }); const { BE, SE } = load(sb);
  // 装备名语意：「剑」→ 攻击
  const afs = BE.affixesFor('玄铁重剑');
  ok(afs.some(a => a.stat === 'atk'), '「玄铁重剑」名字语意含攻击（剑→攻）');
  ok(afs.every(a => a.source === undefined || a.source === 'semantic'), '生成词条来自语义引擎');
  // 动态生成：不同情境不同结果（同一件装备）
  const ctx1 = SE.contextOf({ genre: 'fanrenxiuxian', round: 5, diceSeed: 7, inBattle: false, ownerName: '玄铁重剑' });
  const ctx2 = SE.contextOf({ genre: 'fanrenxiuxian', round: 9, diceSeed: 42, inBattle: true, ownerName: '玄铁重剑' });
  const g1 = SE.generate(ctx1, 3, '玄铁重剑').map(a => a.name).join(',');
  const g2 = SE.generate(ctx2, 3, '玄铁重剑').map(a => a.name).join(',');
  ok(g1 !== g2, '同装备在不同情境产出不同词条（动态涌现）');
  // 玩家自定义覆盖（特殊说明优先）：显式 +9攻击
  BE.customAffix('gear:玄铁重剑', '裂空 +9攻击');
  BE.recompute();
  ok(BE.netMods().sources.some(s => s.value === 9 && s.stat === 'atk'), '玩家自定义词条 +9攻击 进入净值');
  // 清除自定义 → 回到自动
  BE.customAffix('gear:玄铁重剑', null);
  BE.recompute();
  ok(!BE.netMods().sources.some(s => s.value === 9), '清除自定义后加成回到自动生成');
  // 称号无预设时走语意（模拟玩家自创称号写入 variables）
  sb.__vars['称号'] = '万法归宗';
  const tSem = (function () { const s = SE.interpret('万法归宗', 0); return s; })();
  ok(tSem.length > 0, '自创称号名可由语义引擎解读');
  ok(BE.stats().deps.semantic === true, '加成引擎报告语义引擎已接入');
}

/* ============ 9. 大模型双重解读接入加成层（v5.1.0） ============ */
G('9. 大模型补充器接入');
{
  // 无 fetch：scheduleEnrich 不排队、collectPending 仍能收集文本；行为纯本地
  const sb0 = makeSandbox({ '装备': { '武器': '九转灵宝剑' } });
  const M0 = load(sb0);
  const pending = M0.BE.collectPendingTexts();
  ok(Array.isArray(pending) && pending.indexOf('九转灵宝剑') >= 0, 'collectPendingTexts 收集到未解读装备名（' + pending.join(',') + '）');
  ok(M0.BE.scheduleEnrich() === false, '无 fetch 时 scheduleEnrich 跳过排队');
  const r0 = await M0.BE.enrichNow();
  ok(r0.source === 'unavailable', '无 fetch 时 enrichNow 直接降级');

  // 带 fetch：enrichNow 走通 → 缓存写入 → recompute 后 netMods 的 source 标记为 llm
  const sb = makeSandbox({ '装备': { '武器': '灭世星陨刃' } });
  sb.fetch = async (url, opts) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify([{ text: '灭世星陨刃', items: [{ stat: 'atk', value: 11, desc: '大模型解读' }] }]) } }] })
  });
  sb.storyFramework.apiConfig = { type: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'sk-t', model: 'big-model' };
  sb.TokenUsage = { recordRequest() {}, recordOutput() {} };
  const M = load(sb);
  M.BE.recompute();
  const rr = await M.BE.enrichNow();
  ok(rr.source === 'llm' && rr.done === 1, 'enrichNow 完成一次大模型解读（' + rr.source + '/' + rr.done + '）');
  const af = M.BE.affixesFor('灭世星陨刃');
  ok(af.some(a => a.source === 'llm' && a.by === 'big-model'), '缓存命中后 affixesFor 返回 llm 来源词条');
  M.BE.recompute();
  const net = M.BE.netMods();
  ok(net.sources.some(s => s.source === 'llm'), 'netMods 的 sources 带 llm 来源标记');
  ok(M.BE.stats().llmSources >= 1, 'stats 报告 llmSources 计数');
  ok(M.BE.buildPromptBlock().indexOf('深度解读') >= 0, 'prompt 块注入大模型深度解读标注');
  // 收敛：解读后 collectPending 不再包含该文本
  ok(M.BE.collectPendingTexts().indexOf('灭世星陨刃') < 0, '解读后该文本不再进入待办（防循环收敛）');
}

/* ============ 10. 版权词残留 ============ */
G('10. 版权红线');
{
  const files = ['js/bonus-engine.js', 'js/title-system.js', 'js/semantic-engine.js'];
  const banned = ['契约者', '土著', '随从'];
  files.forEach(f => {
    const src = read(f);
    banned.forEach(kw => ok(src.indexOf(kw) < 0, f + ' 无「' + kw + '」'));
  });
}

console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
if (fail > 0) process.exit(1);
