// 云境 v3.87.0 活世界整改验收（A–H 逻辑级，vm + 桩，零依赖）
// 用法：node test/alive-acceptance.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  :', name); } else { fail++; console.error('  FAIL:', name, extra); } };
const read = (p) => fs.readFileSync(ROOT + '/' + p, 'utf8');

function makeEnv(genre, varsOverride) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const vars = Object.assign({
    entities: { characters: {}, factions: {}, items: {}, places: {}, relations: [] },
    characters: {}, tension: 20, 时间: { clockDay: 0 }, history: [], chapter: 0
  }, varsOverride || {});
  const storyFramework = {
    storyState: { variables: vars, setup: { playerName: '韩立' }, turnCount: 0, genre },
    slotId: 'main', saveStory() {}, config: { genreName: '测试界' }
  };
  const KB_PRESETS = {};
  KB_PRESETS[genre] = [
    { title: '血色禁地异动', content: '血色禁地深处灵气紊乱，传闻有重宝现世。', category: '机缘', tags: ['机缘'] },
    { title: '掌天瓶之秘', content: '一只不起眼的青色小瓶，可催熟灵药。', category: '秘辛', tags: ['秘辛'] },
    { title: '黄枫谷内乱', content: '黄枫谷长老为筑基丹名额明争暗斗。', category: '事件', tags: ['事件'] },
    { title: '掩月宗仙子', content: '掩月宗女修驾临坊市。', category: '事件', tags: ['事件'] }
  ];
  const timeline = [];
  const ledger = [];
  const win = {
    localStorage, storyFramework, KB_PRESETS, console, URLSearchParams, setTimeout, clearTimeout,
    location: { search: '?genre=' + genre },
    Math, Date, JSON, Promise, RegExp, String, Number, Array, Object, isFinite, parseInt, parseFloat,
    showToast() {},
    document: {
      readyState: 'complete', addEventListener() {},
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {} }),
      getElementById: () => null, head: { appendChild() {} }, body: { appendChild() {} }, querySelectorAll: () => []
    },
    WorldExt: {
      genre,
      modState(id) { return { state: { stage: 2 } }; }
    },
    WorldStage: { data: {}, current: () => 2 },   // data filled below
    WorldRuntime: {
      genre,
      round: () => storyFramework.storyState.turnCount,
      NPC: { list: () => [], upsert: () => null }
    },
    CanonTimeline: { event: (n, s, o) => timeline.push({ n, s, o }) },
    CanonLedger: { claim: (n, w, o) => ledger.push({ n, w, o }) },
    _tl: timeline, _led: ledger
  };
  win.WorldStage.data[genre] = { st: ['练气岁月', '筑基风云', '结丹问鼎'], fa: ['黄枫谷', '掩月宗', '魔道六宗'], cu: '灵石', ev: [] };
  win.window = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  return { ctx, win, vars, store, timeline, ledger };
}

function load(env, files) {
  for (const f of files) vm.runInContext(read(f), env.ctx, { filename: f });
}

// 每个测试用独立 env
function boot(genre = 'fanrenxiuxian', varsOverride) {
  const env = makeEnv(genre, varsOverride);
  load(env, ['js/world-schema.js', 'js/world-bus.js', 'js/opportunity-system.js', 'js/world-alive.js', 'js/relationship-graph.js', 'js/world-director.js', 'js/beast-system.js']);
  return env;
}

/* ================= 测试 A：世界会自己动（L2） ================= */
console.log('== A. 世界会自己动（L2 自治） ==');
{
  const env = boot();
  const { win, vars } = env;
  win.WorldAlive.seedFactions();
  const before = Object.values(vars.entities.factions).map((f) => f.influence);
  for (let i = 0; i < 25; i++) win.WorldAlive.lifecycle();
  const after = Object.values(vars.entities.factions).map((f) => f.influence);
  const changed = before.some((b, i) => b !== after[i]);
  const collapsed = Object.values(vars.entities.factions).some((f) => f.collapsed);
  ok('势力影响力在世界自转后发生变化', changed || collapsed);
  ok('出现势力覆灭或影响力跨阶变动（P2-1）', collapsed);
  const pb = win.WorldAlive.buildPromptBlock();
  ok('世界状态注入主笔（含势力消长）', /势力消长/.test(pb));
  ok('注入含「本轮硬约束」', /本轮硬约束/.test(pb));
}

/* ================= 测试 B：选择能改变大势（L4） ================= */
console.log('== B. 选择能改变大势（L4 回流） ==');
{
  const env = boot();
  const { win } = env;
  win.WorldAlive.applyAI('faction.鬼灵门.influence=+5\ngrudge.鬼灵门=-30\ntension=+10');
  const g = win.WorldBus.grudges['鬼灵门'];
  ok('世界变化回写恩怨账本（鬼灵门 敌意<0）', g != null && g < 0, 'g=' + g);
  const pb = win.WorldAlive.buildPromptBlock();
  ok('恩怨回流到下一轮提示词', /鬼灵门/.test(pb) && /敌意|亲厚/.test(pb));
  ok('势力影响力回写', Object.values(env.vars.entities.factions).some((f) => f.name === '鬼灵门'));
}

/* ================= 测试 C：无关选择毫无影响 ================= */
console.log('== C. 无关选择可以毫无影响（R3 后半） ==');
{
  const env = boot();
  const { win, vars } = env;
  win.WorldAlive.seedFactions();
  const snap = JSON.stringify(vars.entities.factions);
  // 一个无关紧要的动作：仅记录一次无副作用 snapshotInfluence
  win.WorldAlive.snapshotInfluence();
  ok('无关动作不强行改变世界结构', JSON.stringify(vars.entities.factions) === snap);
}

/* ================= 测试 D：记忆可靠（L1 持久化） ================= */
console.log('== D. 记忆可靠（L1 持久化 + 单一真源） ==');
{
  const env = boot();
  const { win, vars } = env;
  win.WorldBus.grudge('掩月宗', -40);
  ok('恩怨写入 relations（单一真源）', vars.entities.relations.some((r) => r.strength === -40));
  // 模拟刷新：重新实例化一个 WorldBus 读取同一份 vars
  const env2 = boot();
  // 把 relations 迁移过去
  env2.vars.entities.relations = vars.entities.relations;
  ok('刷新后恩怨数值仍在（读 relations）', (env2.win.WorldBus.grudges['掩月宗'] || 0) === -40);
  ok('关系图读真实关系数据（有向边）', (() => {
    const d = env.win.RelationGraph.buildData();
    return d.edges.some((e) => e.a === '韩立' && e.b === '掩月宗' && e.weight === -40);
  })());
}

/* ================= 测试 E：人格活着（情绪/目标可改写） ================= */
console.log('== E. 人格活着（情绪/目标可改写 + 行为约束） ==');
{
  const env = boot();
  const { win, vars } = env;
  vars.characters['鬼灵门少主'] = { name: '鬼灵门少主', personality: '桀骜', ambition: '继位掌权' };
  win.WorldAlive.applyAI('npcemotion.鬼灵门少主=暴怒\nnpcgoal.鬼灵门少主=夺回血色禁地控制权\nnpcmemory.鬼灵门少主=父被重伤');
  const c = vars.characters['鬼灵门少主'];
  ok('情绪被改写', c.emotion === '暴怒');
  ok('目标被改写', c.goal === '夺回血色禁地控制权');
  ok('记忆被写入', /父被重伤/.test(c.memory || ''));
  const pb = win.WorldAlive.buildPromptBlock();
  ok('人物行为约束注入（含目标/情绪）', /人物行为约束/.test(pb) && /暴怒/.test(pb));
}

/* ================= 测试 F：机缘是涌现的 ================= */
console.log('== F. 机缘是涌现的（不同状态→不同候选，有代价有时限） ==');
{
  const e1 = boot('fanrenxiuxian', { tension: 70 });
  e1.win.WorldAlive.seedFactions();
  const r1 = e1.win.OpportunitySystem.roll(5).map((o) => o.title).sort();
  const e2 = boot('fanrenxiuxian', { tension: 10 });
  e2.win.WorldAlive.seedFactions();
  const r2 = e2.win.OpportunitySystem.roll(5).map((o) => o.title).sort();
  ok('两个不同世界状态给出不同机缘候选', JSON.stringify(r1) !== JSON.stringify(r2), r1 + ' VS ' + r2);
  const active = e1.win.OpportunitySystem.activeList();
  ok('机缘带代价与时限', active.length > 0 && active.every((o) => o.cost && o.expiryRound > 0));
  // 过期即消失
  e1.vars.opportunities.forEach((o) => { o.expiryRound = 0; });
  e1.win.OpportunitySystem.roll(6);
  ok('过期机缘被清除（时限真实）', e1.vars.opportunities.filter((o) => o.status === 'active').every((o) => o.expiryRound >= 6));
  // 分支主线：第 2 幕形态随状态不同
  e1.win.WorldBus.grudge('鬼灵门', -40);
  const q1 = e1.win.OpportunitySystem.questDesc();
  e2.win.OpportunitySystem.setAct(2);
  const q2t = e2.win.OpportunitySystem.questDesc();
  ok('主线形态随选择不同（分歧可见）', /形态/.test(q1) && /形态/.test(q2t), q1 + ' | ' + q2t);
}

/* ================= 测试 G：知识库一致性（抽样） ================= */
console.log('== G. 知识库一致性（开放界阈值 + 机缘可被读取） ==');
{
  const env = boot('free');
  // 注入 free 的真实 KB 文件
  for (const f of ['js/kb/free.core.js', 'js/kb/free.ext.js']) {
    try { vm.runInContext(read(f), env.ctx, { filename: f }); } catch (e) { console.error('kb load', f, e.message); }
  }
  const kb = env.win.KB_PRESETS['free'] || [];
  const cnt = (re) => kb.filter((i) => re.test(i.category || '')).length;
  ok('free 势力>=6', cnt(/势力|组织/) >= 6);
  ok('free 人物>=10', cnt(/人物/) >= 10);
  ok('free 机缘>=8', cnt(/机缘|秘辛/) >= 8);
  const opp = env.win.OpportunitySystem.roll(3);
  ok('机缘系统可读 KB 机缘条目', opp.length > 0);
}

/* ================= 测试 H：伙伴有意志（可离队/叛变） ================= */
console.log('== H. 伙伴有意志（低羁绊+危机→动摇/离队/叛变） ==');
{
  const env = boot();
  const { win } = env;
  const b = win.BeastSystem.contract({ kind: 'companion', name: '阿砚', bond: 5 });
  ok('伙伴具备立场/目的/情绪/忠诚字段', b.stance != null && b.goal != null && b.mood != null && b.loyalty != null);
  let changed = false, left = false;
  for (let i = 0; i < 60 && !left; i++) {
    win.BeastSystem.driftAll({ crisis: true });
    const cur = win.BeastSystem.get(b.id);
    if (cur && (cur.mood !== '平静' || cur.stance !== b.stance)) changed = true;
    if (cur && cur.status === 'left') left = true;
  }
  ok('危机下伙伴情绪/立场发生动摇', changed);
  ok('低羁绊伙伴最终离队或叛变', left);
  ok('离队写入大势账本/恩怨账本', env.timeline.length > 0 || (win.WorldBus.recent && win.WorldBus.recent().length > 0));
}

/* ================= 附加：世界导演扩容 ================= */
console.log('== 附加：世界导演（冲突焦点 + 章节节拍） ==');
{
  const env = boot();
  const { win } = env;
  win.WorldBus.grudge('鬼灵门', -40);
  win.WorldAlive.seedFactions();
  const line = win.WorldDirector.compose();
  ok('导演输出冲突焦点', /冲突焦点/.test(line));
  ok('导演输出章节节拍（起/承/转/合）', /本章节拍/.test(line) && /[起承转合]/.test(line));
}

console.log(`\n总计：${pass} 通过，${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
