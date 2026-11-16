/**
 * 云境 v3.88.0 · 活世界端到端验收（真模块 / 真启动时序 / 真持久化）
 * 用法：node test/alive-v388-e2e.mjs
 *
 * 与 test/alive-acceptance.mjs 的区别（后者是逻辑级 + 打桩）：
 *   本测试只桩宿主环境（document/localStorage/定时器），业务对象一律加载真文件；
 *   并还原真实启动时序：DOMContentLoaded → YJWait 有界重试 → PlayerKit 就绪 → wr_stage 注册。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + '/';
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const exists = (p) => fs.existsSync(ROOT + p);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ok   : ' + n); } else { fail++; fails.push(n); console.log('  FAIL : ' + n + (e ? '  << ' + e : '')); } };
const sec = (t) => console.log('\n== ' + t + ' ==');

/* 确定性 PRNG，保证因果对比不受随机噪声干扰 */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fakeMath(seed) {
  const M = {}; for (const k of Object.getOwnPropertyNames(Math)) M[k] = Math[k];
  M.random = mulberry32(seed); return M;
}

function el() { return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, children: [], innerHTML: '', textContent: '', value: '', checked: false, disabled: false, setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false, appendChild(c) { return c; }, removeChild(c) { return c; }, remove() {}, insertBefore(c) { return c; }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, contains: () => false, focus() {}, blur() {}, click() {}, replaceChild() {}, scrollIntoView() {}, getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }), cloneNode() { return el(); }, animate: () => ({ finished: Promise.resolve(), cancel() {} }), firstChild: null, lastChild: null, parentNode: null, nextSibling: null }; }

function makeEnv(genre, store, slotId, seed) {
  const lc = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } };
  const listeners = {};
  const doc = { readyState: 'loading', hidden: false, visibilityState: 'visible', cookie: '', __listeners: listeners, addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener() {}, dispatchEvent() {}, createElement: () => el(), createDocumentFragment: () => el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [], head: el(), body: el(), documentElement: el(), execCommand() {}, createTextNode: (t) => ({ textContent: t }) };
  const timers = []; timers.id = 0;
  const M = fakeMath(seed || 12345);
  const win = {
    localStorage: lc, document: doc, console, _timerQueue: timers, Math: M,
    location: { search: '?genre=' + genre, href: 'http://x/s.html', hostname: 'localhost', pathname: '/s.html' },
    navigator: { userAgent: 'node-vm', language: 'zh-CN', clipboard: { writeText: async () => {} } },
    URLSearchParams,
    setTimeout: (f, ms) => { const id = ++timers.id; timers.push({ id, fn: f, ms }); return id; },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t && t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: (f) => { const id = ++timers.id; timers.push({ id, fn: f, ms: 16 }); return id; },
    cancelAnimationFrame() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {}, removeEventListener() {}, alert() {}, confirm: () => true, prompt: () => null,
    showToast() {}, fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    performance: { now: () => Date.now() },
    Date, JSON, Promise, RegExp, String, Number, Array, Object, Boolean, Error, isFinite, isNaN,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent, KB_PRESETS: {}, YJ_DEBUG: false
  };
  const VK = '__v__~' + slotId + '~' + genre;
  const vars = store[VK] ? JSON.parse(store[VK]) : { entities: { characters: {}, factions: {}, items: {}, places: {}, relations: [] }, characters: {}, items: [], foreshadowings: [], history: [], tension: 20, chapter: 1, wordCount: 0, 时间: { clockDay: 0, era: '练气期', date: '' } };
  win.storyFramework = { storyState: { variables: vars, setup: { playerName: '韩立', playerRole: 'hero' }, turnCount: 0, isStoryStarted: true, genre }, slotId, genre, storyVariables: vars, config: { genreName: 'g' }, saveStory() { try { store[VK] = JSON.stringify(vars); } catch (e) {} }, updateStatusPanel() {}, apiConfig: {} };
  win.window = win; win.globalThis = win; win.self = win; win.top = win; win.parent = win;
  return { ctx: vm.createContext(win), win, vars, store };
}

const LOAD = ['js/dep-wait.js', 'js/lazy-boot.js', 'js/canon-ledger.js', 'js/canon-timeline.js', 'js/beast-system.js', 'js/squad-system.js', 'js/world-schema.js', 'js/sim-core.js', 'js/world-clock.js', 'js/world-alive.js', 'js/npc-spawn.js', 'js/variable-parser.js', 'js/entity-engine.js', 'js/world-ext/world-ext-core.js', 'js/player-kit.js', 'js/gear-core.js', 'js/relationship-graph.js', 'js/world-runtime.js', 'js/world-bus.js', 'js/opportunity-system.js', 'js/world-stage.js', 'js/world-director.js'];
function pump(e, r = 220) { let n = 0; for (let i = 0; i < r; i++) { const q = e.win._timerQueue; if (!q || !q.length) break; const b = q.splice(0, q.length); for (const t of b) { try { t.fn(); n++; } catch (x) {} } } return n; }
function bootPage(e) { e.win.document.readyState = 'interactive'; (e.win.document.__listeners['DOMContentLoaded'] || []).slice().forEach((f) => { try { f(); } catch (x) {} }); pump(e); e.win.document.readyState = 'complete'; (e.win.document.__listeners['DOMContentLoaded'] || []).slice().forEach((f) => { try { f(); } catch (x) {} }); pump(e); }
function boot(genre, store = {}, slot = 'A', seed = 12345, kb = true) {
  const e = makeEnv(genre, store, slot, seed);
  const failed = [];
  for (const f of LOAD) { if (!exists(f)) { failed.push(f); continue; } try { vm.runInContext(read(f), e.ctx, { filename: f }); } catch (x) { failed.push(f + ':' + x.message.slice(0, 40)); } }
  if (kb) for (const s of ['core', 'ext']) { const kf = 'js/kb/' + genre + '.' + s + '.js'; if (exists(kf)) { try { vm.runInContext(read(kf), e.ctx, { filename: kf }); } catch (x) {} } }
  e.failed = failed; bootPage(e); return e;
}

console.log('################################################################');
console.log('# 云境 v3.88.0 活世界端到端验收（真模块）');
console.log('################################################################');

sec('1. 真加载 + 真实启动时序');
const E = boot('fanrenxiuxian');
console.log('  模块加载失败: ' + (E.failed.length ? E.failed.join(' | ') : '无'));
ok('全部模块加载成功', E.failed.length === 0, E.failed.join(','));
ok('WorldExt.hasModules() 为真（PlayerKit 链路通）', (() => { try { return E.win.WorldExt.hasModules(); } catch (x) { return false; } })());
ok('wr_stage 真注册', !!(E.win.WorldExt.modState && E.win.WorldExt.modState('wr_stage')));

sec('2. P2-1 修正：势力名来自本界真实知识库（各世界不同）');
const genres = ['fanrenxiuxian', 'douluodalu', 'free', 'wuxia'];
const facNames = {};
for (const g of genres) {
  const e = boot(g, {}, 'A', 777);
  const kb = e.win.KB_PRESETS[g] || [];
  e.win.WorldAlive.seedFactions();
  const names = Object.keys(e.vars.entities.factions).map((k) => e.vars.entities.factions[k].name);
  facNames[g] = names;
  console.log('  ' + g.padEnd(18) + ' KB=' + String(kb.length).padStart(4) + '  势力(' + names.length + '): ' + names.join('、'));
}
const allNames = Object.values(facNames);
const first = JSON.stringify(allNames[0]);
ok('每个界播种了 >=3 个势力', allNames.every((a) => a.length >= 3), JSON.stringify(allNames.map((a) => a.length)));
ok('不同界得到不同势力组合（不再是共用静态 3 名表）',
  new Set(allNames.map((a) => a.join('|'))).size >= 3,
  JSON.stringify(allNames));
ok('势力名不是旧静态表（剧情盟友/剧情对手/路人势力）',
  !allNames.some((a) => a.includes('剧情盟友') || a.includes('剧情对手') || a.includes('路人势力')),
  JSON.stringify(allNames));

sec('3. P0 修正：世界自转是否真的被「玩家恩怨 / 张力」驱动（因果性）');
/* 同一初始状态、同一随机种子，只改"与玩家的恩怨方向"，比较 40 tick 后的影响力轨迹 */
function runTraj(grudgeVal, tension, seed) {
  const e = boot('fanrenxiuxian', {}, 'A', seed);
  const V = e.vars, W = e.win;
  W.WorldAlive.seedFactions();
  const keys = Object.keys(V.entities.factions);
  const target = keys[0];
  const tname = V.entities.factions[target].name;
  /* 固定所有势力到同一影响力，排除初始差异 */
  keys.forEach((k) => { V.entities.factions[k].influence = 50; V.entities.factions[k].collapsed = false; });
  V.tension = tension;
  try { W.WorldBus.grudge(tname, grudgeVal); } catch (x) { console.log('  grudge 异常:' + x.message); }
  const traj = [];
  for (let i = 0; i < 40; i++) { W.WorldAlive.lifecycle(); traj.push(Number(V.entities.factions[target].influence)); }
  return { traj, tname, final: traj[traj.length - 1], start: 50, gv: (() => { try { return W.WorldBus.grudges[tname]; } catch (x) { return null; } })() };
}
const asEnemy = runTraj(-60, 80, 2024);
const asAlly = runTraj(60, 80, 2024);
console.log('  目标势力: ' + asEnemy.tname);
console.log('  记为死敌(grudge=' + asEnemy.gv + ') 40 tick 轨迹: ' + asEnemy.traj.slice(0, 12).join(',') + ' … 终值 ' + asEnemy.final);
console.log('  记为盟友(grudge=' + asAlly.gv + ') 40 tick 轨迹: ' + asAlly.traj.slice(0, 12).join(',') + ' … 终值 ' + asAlly.final);
ok('同起点下，"玩家的敌人"比"玩家的盟友"衰减更多（恩怨真影响大势）',
  asEnemy.final < asAlly.final, 'enemy=' + asEnemy.final + ' ally=' + asAlly.final);
ok('两者终值有可观测差距（>=1.0）', Math.abs(asAlly.final - asEnemy.final) >= 1.0,
  'diff=' + Math.abs(asAlly.final - asEnemy.final).toFixed(2));

/* 张力对比 */
const lowT = runTraj(0, 5, 99);
const highT = runTraj(0, 95, 99);
console.log('  张力5  终值: ' + lowT.final + '   张力95 终值: ' + highT.final);
ok('高张力下势力规模被压制（张力真影响世界）', highT.final <= lowT.final + 0.001,
  'low=' + lowT.final + ' high=' + highT.final);

/* 强者不再恒不衰减 */
{
  const e = boot('fanrenxiuxian', {}, 'A', 555);
  const V = e.vars, W = e.win;
  W.WorldAlive.seedFactions();
  const keys = Object.keys(V.entities.factions);
  keys.forEach((k, i) => { V.entities.factions[k].influence = i === 0 ? 92 : 40; });
  const before = Number(V.entities.factions[keys[0]].influence);
  for (let i = 0; i < 15; i++) W.WorldAlive.lifecycle();
  const after = Number(V.entities.factions[keys[0]].influence);
  console.log('  独大势力 92 → ' + after + '（15 tick）');
  ok('独大势力会被制衡（修掉"最强恒不衰减"）', after < before, before + '→' + after);
}

sec('4. P0-1 闭环：上行注入 → AI 回报 → 解析 → 回写 → 下一轮注入');
{
  const e = boot('fanrenxiuxian', {}, 'A', 31);
  const V = e.vars, W = e.win;
  W.WorldAlive.seedFactions();
  const key = Object.keys(V.entities.factions)[0], nm = V.entities.factions[key].name;
  const i0 = Number(V.entities.factions[key].influence);
  const reply = '(world_update)\nstage=3\nfaction.' + nm + '.influence=+12\nfaction.鬼灵门.influence=-15\ngrudge.鬼灵门=-20\nnpcgoal.南宫婉=夺回血色禁地\nnpcemotion.南宫婉=暴怒\n(/world_update)';
  const blk = W.VariableInstructionParser.extractWorldBlock(reply);
  W.WorldAlive.applyAI(blk);
  const i1 = Number(V.entities.factions[key].influence);
  ok('extractWorldBlock 解析成功', !!blk && blk.trim().length > 0);
  ok('faction.influence 增量真写入', i1 === i0 + 12, i0 + '→' + i1);
  ok('stage 真写进 WorldExt 模块', Number(W.WorldExt.modState('wr_stage').state.stage) === 3);
  ok('AI 凭空创建新势力', !!Object.values(V.entities.factions).find((f) => f.name === '鬼灵门'));
  ok('人物目标/情绪真写入', !!(V.characters['南宫婉'] && V.characters['南宫婉'].goal === '夺回血色禁地' && V.characters['南宫婉'].emotion === '暴怒'));
  const pb = W.WorldAlive.buildPromptBlock();
  ok('闭环：新势力出现在下一轮注入', pb.indexOf('鬼灵门') >= 0);
  ok('闭环：人物目标出现在下一轮注入', pb.indexOf('夺回血色禁地') >= 0);
  ok('闭环：阶段推进出现在下一轮注入', pb.indexOf('第 3/3 阶段') >= 0 || pb.indexOf('结丹') >= 0, pb.slice(0, 120));
}

sec('5. P0-3：持久化 / 刷新恢复 / 串档隔离');
{
  const store = {};
  const e = boot('fanrenxiuxian', store, 'A', 41);
  const V = e.vars, W = e.win;
  W.WorldAlive.seedFactions();
  W.WorldAlive.applyAI('faction.测试盟.influence=+9\nnpcgoal.甲=复仇\ngrudge.乙=-40');
  pump(e, 80); W.storyFramework.saveStory(); pump(e, 80);
  const keys = Object.keys(store);
  console.log('  localStorage 键: ' + JSON.stringify(keys));
  ok('WorldAlive 键含 slotId 与 genre', keys.some((k) => k.indexOf('yunjingWorldAlive~A~') === 0), JSON.stringify(keys));
  const r = boot('fanrenxiuxian', store, 'A', 41);
  ok('刷新后势力仍在', Object.keys(r.vars.entities.factions).length > 0);
  ok('刷新后人物目标仍在', !!(r.vars.characters['甲'] && r.vars.characters['甲'].goal));
  ok('刷新后恩怨仍在', (() => { try { return Object.keys(r.win.WorldBus.grudges).length > 0; } catch (x) { return false; } })());
  const b = boot('fanrenxiuxian', store, 'B', 41);
  ok('slot B 读不到 slot A 的世界（串档隔离）', Object.keys(b.vars.entities.factions).length === 0);
}

sec('6. P2 修正：drainFacts 死 API 已被消费 + 阶段兜底');
{
  const e = boot('free', {}, 'A', 61);
  const W = e.win;
  W.WorldBus.fact('验收信号·灵脉异动');
  const rc = (() => { try { return W.WorldBus.recent(); } catch (x) { return []; } })();
  const pb = W.WorldAlive.buildPromptBlock();
  console.log('  WorldBus.recent(): ' + JSON.stringify(rc).slice(0, 150));
  console.log('  注入块含该信号: ' + (pb.indexOf('灵脉异动') >= 0));
  ok('WorldBus.fact → 上行注入可见', pb.indexOf('灵脉异动') >= 0);
  /* 阶段兜底：模拟 WorldExt 不可用 */
  const saved = W.WorldExt;
  W.WorldExt = null;
  W.WorldAlive.applyAI('stage=3');
  const pb2 = W.WorldAlive.buildPromptBlock();
  W.WorldExt = saved;
  console.log('  WorldExt 缺失时注入块阶段行: ' + (pb2.split('\n').find((l) => l.indexOf('阶段') >= 0) || '(无)').trim());
  ok('WorldExt 缺失时阶段不丢（走 mem.stageFallback）', pb2.indexOf('第 3/3 阶段') >= 0 || pb2.indexOf('结丹') >= 0, pb2.slice(0, 140));
}

sec('7. 涌现式机缘（真 KB）');
{
  const e = boot('free', {}, 'A', 71);
  const O = e.win.OpportunitySystem, V = e.vars, W = e.win;
  const kb = e.win.KB_PRESETS['free'] || [];
  ok('真 KB 已加载', kb.length > 100, '条数=' + kb.length);
  W.WorldAlive.seedFactions();
  O.ensureState();
  const r = O.roll();
  console.log('  roll() 候选: ' + (Array.isArray(r) ? r.map((x) => x.title).join(' | ') : 'n/a'));
  ok('roll() 产出候选', Array.isArray(r) && r.length > 0);
  const act = O.activeList();
  ok('机缘带代价与时限', act.length > 0 && 'cost' in act[0] && 'expiryRound' in act[0], JSON.stringify(Object.keys(act[0] || {})));
  /* 过期 */
  const st = O.ensureState(); const before = O.activeList().length;
  st.opportunities[0].expiryRound = -1; st.opportunities[0].status = 'active';
  O.roll(999999);
  const after = O.activeList().length;
  console.log('  过期前活跃 ' + before + ' → 推进后 ' + after + '，该条状态=' + st.opportunities[0].status);
  ok('过期机缘真被清除', after < before || st.opportunities[0].status === 'expired');
}

console.log('\n################################################################');
console.log('# 小计: ' + pass + ' 通过 / ' + fail + ' 失败');
if (fails.length) console.log('# 失败项: ' + fails.join(' ; '));
console.log('################################################################');
process.exit(fail ? 1 : 0);
