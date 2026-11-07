/* 云境 v4.07.0 云境 v4.07.0 沙盒化动态委托系统验收（纯 Node vm，无浏览器依赖）
 * 覆盖：
 *  1 委托板可生成且数量合理、来源多样（局势/探索/悬赏/势力/例行）
 *  2 委托随世界日 / 分区 / 等级变化而变（同一世界日恒定，跨日轮换）
 *  3 委托有委托人与地点，地点必属本界地图
 *  4 接取 → 推进 → 交付闭环，金币/经验/声望按约定到账
 *  5 时限递减与过期（世界在变，机会会关）
 *  6 沙盒/剧情双轨：mode 可切换，切换后板面立即刷新
 *  7 玩家势力会发布专属委托
 *  8 委托推进钩子全覆盖（kills/gather/reach/wins）
 *  9 确定性：同种子连续两次生成完全一致；源码禁 Math.random
 * 10 委托板状态不崩：老存档缺字段 backfill 正常
 */
const fs = require('fs');
const vm = require('vm');
const ROOT = process.env.YJ_ROOT || '/workspace/yunjing';
const CORE = ROOT + '/js/rpg-core.js';
const QUESTS = ROOT + '/js/rpg-quests.js';
const coreCode = fs.readFileSync(CORE, 'utf8');
const questCode = fs.readFileSync(QUESTS, 'utf8');

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const ARCS = { wangyou: { title: '寰宇纪元 · 从新手谷到王者权杖', st: [
  ['开服 · 新手谷', '完成一次转正', () => true],
  ['主城立足', '拿下第一片驻地', () => true],
  ['秘境首杀', '完成一次世界首领击杀', () => true],
  ['跨服会战', '赢下一场跨服战场', () => true],
  ['隐藏职业觉醒', '通过隐藏职业认证', () => true],
  ['神域终局', '守住或夺取王者权杖', () => true]
] } };

let PASS = 0, FAIL = 0; const fails = [];
function assert(c, m) { if (!c) throw new Error(m); }
function T(label, fn) { try { fn(); PASS++; } catch (e) { FAIL++; fails.push(label + ' :: ' + e.message); console.log('  ✗ ' + label + ' :: ' + e.message); } }

function makeSandbox(genre) {
  const WorldExt = { hasModules() { return true; }, injectModules() {}, act() {}, onVars() {}, modState() { return null; }, refreshStrip() {} };
  const window = {
    WorldRuntime: { genre: genre, H: { esc }, module: bp => bp },
    WorldExt, QuestChain: { arcs: ARCS },
    YJWait: { for() {} },
    BaseModelMode: { ctxTier: () => 'normal' }
  };
  const document = { readyState: 'complete', head: { appendChild() {} }, body: {}, createElement() { return {}; }, getElementById() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  const sandbox = { window, document, console: { log() {}, warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(questCode, sandbox, { filename: QUESTS });
  vm.runInContext(coreCode, sandbox, { filename: CORE });
  return { RC: window.RPGCore, bp: window.RPGCore.module(genre), window, RQ: window.RpgQuests };
}
function fresh(bp) { const st = {}; bp.backfill({}, st); return st; }
function makeSandboxNoQuests(genre) {
  const WorldExt = { hasModules() { return true; }, injectModules() {}, act() {}, onVars() {}, modState() { return null; }, refreshStrip() {} };
  const window = {
    WorldRuntime: { genre: genre, H: { esc }, module: bp => bp },
    WorldExt, QuestChain: { arcs: ARCS },
    YJWait: { for() {} },
    BaseModelMode: { ctxTier: () => 'normal' }
  };
  const document = { readyState: 'complete', head: { appendChild() {} }, body: {}, createElement() { return {}; }, getElementById() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  const sandbox = { window, document, console: { log() {}, warn() {} } };
  vm.createContext(sandbox);
  /* 故意不加载 js/rpg-quests.js —— 模拟该脚本未就位/加载失败 */
  vm.runInContext(coreCode, sandbox, { filename: CORE });
  return { RC: window.RPGCore, bp: window.RPGCore.module(genre), window };
}

const g = 'wangyou';
const { bp, RC, RQ, window } = makeSandbox(g);
const W = RC.WORLD.wangyou;

/* ---- 1 委托板可生成 ---- */
T('1.1 委托板生成 4~6 条委托', () => {
  const st = fresh(bp);
  const n = st.quests.offers.length;
  assert(n >= 4 && n <= 6, '委托数量应为 4~6，实际 ' + n);
});
T('1.2 委托来源多样（含局势委托）', () => {
  const st = fresh(bp);
  const srcs = {};
  st.quests.offers.forEach(o => { srcs[o.src] = 1; });
  assert(srcs.world, '缺少局势来源委托');
  assert(Object.keys(srcs).length >= 3, '来源种类不足，实际 ' + Object.keys(srcs).join(','));
});
T('1.3 委托地点必属本界地图', () => {
  const st = fresh(bp);
  st.quests.offers.forEach(o => {
    assert(W.maps.indexOf(o.place) >= 0, '委托地点不在本界地图：' + o.place);
  });
});
T('1.4 委托人必是本界势力或玩家势力', () => {
  const st = fresh(bp);
  const facNames = W.factions.map(f => f.n);
  st.quests.offers.forEach(o => {
    assert(facNames.indexOf(o.giver) >= 0 || o.giver === '寰宇冒险者公会',
      '委托人既非本界势力也非默认公会：' + o.giver);
  });
});
T('1.5 委托字段完整（时限/奖励/等级/目标类型）', () => {
  const st = fresh(bp);
  st.quests.offers.forEach(o => {
    assert(typeof o.id === 'string' && o.id.length > 0, '缺 id');
    assert(o.need >= 1, '目标数应 ≥1');
    assert(o.due >= 1, '时限应 ≥1');
    assert(o.gold > 0 && o.exp > 0, '奖励应为正');
    assert(o.lv >= 1, '等级应 ≥1');
    assert(['kills', 'gather', 'reach', 'wins', 'craft'].indexOf(o.t) >= 0, '未知目标类型 ' + o.t);
  });
});

/* ---- 2 委托随世界状态变化 ---- */
T('2.1 同一世界日同一分区：板面稳定', () => {
  const st = fresh(bp);
  const a = JSON.stringify(st.quests.offers.map(o => o.id));
  const st2 = fresh(bp);
  const b = JSON.stringify(st2.quests.offers.map(o => o.id));
  assert(a === b, '同种子两次生成不一致');
});
T('2.2 跨世界日：板面轮换', () => {
  const st = fresh(bp);
  const a = JSON.stringify(st.quests.offers.map(o => o.id));
  st.worldDay = 5; st.round = 40;
  bp.act(st, { state: st }, 'tick', '');
  const b = JSON.stringify(st.quests.offers.map(o => o.id));
  assert(a !== b, '跨日后委托板未轮换');
});
T('2.3 换分区：板面随之改变', () => {
  const st = fresh(bp);
  const a = JSON.stringify(st.quests.offers.map(o => o.giver));
  let byIdx = -1;
  W.maps.forEach((m, i) => { if (W.zoneOf[m] === 'by' && byIdx < 0) byIdx = i; });
  st.gold = 99999;
  bp.act(st, { state: st }, 'teleport', String(byIdx));
  assert(st.zone === 'by', '未切到北境');
  const b = JSON.stringify(st.quests.offers.map(o => o.giver));
  assert(a !== b, '换区后委托人未变');
});
T('2.4 局势每天轮换且每区都有事态', () => {
  const st = fresh(bp);
  const l1 = JSON.stringify(st.situation.list);
  /* 世界时钟：read（剧情推进）与 tick（结束回合）都算一回合，每 8 回合一日 */
  for (let i = 0; i < 9; i++) bp.act(st, { state: st }, 'tick', '');
  const l2 = JSON.stringify(st.situation.list);
  assert(st.worldDay === 1, '世界日应为 1，实际 ' + st.worldDay);
  assert(l1 !== l2, '跨日局势未轮换');
  assert(st.situation.list.length >= 4, '每区应有事态，实际 ' + st.situation.list.length);
});
T('2.5 世界日只前进不回拨', () => {
  const st = fresh(bp);
  st.worldDay = 9;
  bp.act(st, { state: st }, 'tick', '');
  assert(st.worldDay === 9, '世界日被回拨，实际 ' + st.worldDay);
});

/* ---- 3 接取 → 推进 → 交付闭环 ---- */
T('3.1 接取后进入进行中列表并从板面移除', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  const id = q.id;
  const msg = bp.act(st, { state: st }, 'qaccept', id);
  assert(msg.indexOf('接取委托') >= 0, '接取反馈异常：' + msg);
  assert(st.quests.active.length === 1, '进行中应有 1 条');
  assert(!st.quests.offers.some(o => o.id === id), '板面未移除该委托');
});
T('3.2 未完成不可交付', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  const m = bp.act(st, { state: st }, 'qturnin', q.id);
  assert(m.indexOf('尚未完成') >= 0, '未完成却可交付：' + m);
});
T('3.3 推进到完成后可交付，奖励到账', () => {
  const st = fresh(bp);
  st.gold = 0; st.rep = 0;
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  const g0 = st.gold, r0 = st.rep;
  /* 直接把进度推满（用引擎内部推进函数走同一条路径） */
  window.RpgQuests.advance(st.quests.active[0], st.quests.active[0].t, 999, st.quests.active[0].place);
  assert(st.quests.active[0].state === 'done', '进度推满后未标记完成');
  const m = bp.act(st, { state: st }, 'qturnin', q.id);
  assert(m.indexOf('交付') >= 0, '交付反馈异常：' + m);
  assert(st.gold > g0, '金币未到账');
  assert(st.rep > r0, '声望未到账');
  assert(st.quests.done === 1, '完成计数未 +1');
  assert(st.quests.active.length === 0, '交付后仍在进行中列表');
});
T('3.4 放弃委托扣 1 声望', () => {
  const st = fresh(bp);
  st.rep = 10;
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  bp.act(st, { state: st }, 'qgiveup', q.id);
  assert(st.rep === 9, '声望应扣 1，实际 ' + st.rep);
  assert(st.quests.failed === 1, '放弃计数未 +1');
});
T('3.5 重复接取同一条被拒', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  const m = bp.act(st, { state: st }, 'qaccept', q.id);
  assert(m.indexOf('不在板上') >= 0, '重复接取应被拒：' + m);
});

/* ---- 4 推进钩子 ---- */
T('4.1 击杀推进 kills 类委托', () => {
  const st = fresh(bp);
  const q = st.quests.offers.filter(o => o.t === 'kills')[0];
  assert(q, '板上无 kills 类委托');
  bp.act(st, { state: st }, 'qaccept', q.id);
  const before = st.quests.active[0].cur;
  /* 打怪：连续施放技能直到击杀 */
  let guard = 0;
  while (guard++ < 40 && st.quests.active[0].cur === before) {
    st.hp = 99999; st.mp = 99999;
    bp.act(st, { state: st }, 'skill', 'slash');
    bp.act(st, { state: st }, 'tick', '');   // 冷却只在回合推进时递减
  }
  assert(st.quests.active[0].cur > before, '击杀未推进委托');
});
T('4.2 传送推进 reach 类委托', () => {
  const st = fresh(bp);
  const q = st.quests.offers.filter(o => o.t === 'reach')[0];
  assert(q, '板上无 reach 类委托');
  bp.act(st, { state: st }, 'qaccept', q.id);
  st.gold = 99999;
  const idx = W.maps.indexOf(q.place);
  bp.act(st, { state: st }, 'teleport', String(idx));
  assert(st.quests.active[0].cur > 0, '抵达未推进委托');
});
T('4.3 采集推进 gather 类委托', () => {
  const st = fresh(bp);
  const q = st.quests.offers.filter(o => o.t === 'gather')[0];
  assert(q, '板上无 gather 类委托');
  bp.act(st, { state: st }, 'qaccept', q.id);
  const before = st.quests.active[0].cur;
  bp.act(st, { state: st }, 'loot', '');
  assert(st.quests.active[0].cur > before, '掉落未推进采集委托');
});
T('4.4 竞技场推进 wins 类委托（跨日直到板面出现该类型）', () => {
  const st = fresh(bp);
  let q = null, g2 = 0;
  while (g2++ < 12 && !q) {
    q = st.quests.offers.filter(o => o.t === 'wins')[0] || null;
    /* v4.07.2 修正：原先写的是 st.round += 8 —— 但引擎的世界时钟是 st.worldTurn
       （advanceWorld 里 day = floor(worldTurn / 8)，与 round 无关）。
       所以这行从来没有真的跨日过，只是靠「板面每次都重建」才碰巧能抽到 wins 类委托。
       v4.07.2 修 D-25 后 boardLv 不再被误写成 -1，板面在同一世界日 / 分区 / 等级档下
       不再无故重建 —— 于是这个假依赖暴露出来，测试失败。
       现在改用真正的字段 worldTurn，测试才真的在验证「跨日会换一批委托」。 */
    if (!q) { st.worldTurn += 8; bp.act(st, { state: st }, 'tick', ''); }
  }
  assert(q, '多次跨日后板上仍无 wins 类委托');
  bp.act(st, { state: st }, 'qaccept', q.id);
  const before = st.quests.active[0].cur;
  let guard = 0;
  while (guard++ < 12 && st.quests.active[0].cur === before) {
    st.hp = 99999; st.mp = 99999;
    bp.act(st, { state: st }, 'arena', '');
  }
  assert(st.quests.active[0].cur > before, '竞技场未推进委托');
});

/* ---- 5 时限与过期 ---- */
T('5.1 时限随回合递减', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  const d0 = st.quests.active[0].due;
  bp.act(st, { state: st }, 'tick', '');
  assert(st.quests.active[0].due === d0 - 1, '时限未递减，实际 ' + st.quests.active[0].due + ' vs ' + d0);
});
T('5.2 超过时限则委托失效并移出列表', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  const D = q.due;                       // 先记下初始时限（due 会随回合递减，不能拿它当循环上界）
  for (let i = 0; i < D + 5; i++) bp.act(st, { state: st }, 'tick', '');
  assert(st.quests.active.length === 0, '过期委托仍在列表，实际 ' + st.quests.active.length);
  assert(st.quests.expired >= 1, '过期计数未增加');
});

/* ---- 6 双轨路线 ---- */
T('6.1 mode 可切换为剧情路线', () => {
  const st = fresh(bp);
  const m = bp.act(st, { state: st }, 'mode', 'story');
  assert(st.mode === 'story', '路线未切换');
  assert(m.indexOf('剧情路线') >= 0, '切换反馈异常：' + m);
});
T('6.2 切回沙盒路线', () => {
  const st = fresh(bp);
  bp.act(st, { state: st }, 'mode', 'story');
  bp.act(st, { state: st }, 'mode', 'sandbox');
  assert(st.mode === 'sandbox', '未切回沙盒');
});
T('6.3 非法路线被拒', () => {
  const st = fresh(bp);
  const m = bp.act(st, { state: st }, 'mode', 'xxx');
  assert(m.indexOf('未知玩法路线') >= 0, '非法路线未被拒：' + m);
});
T('6.4 路线写入 directive 供 AI 遵守', () => {
  const st = fresh(bp);
  bp.act(st, { state: st }, 'mode', 'story');
  const d = bp.directive(st);
  assert(d.indexOf('剧情路线') >= 0, 'directive 未给出当前路线');
  assert(d.indexOf('玩法路线与委托') >= 0, 'directive 缺委托契约段');
});

/* ---- 7 玩家势力专属委托 ---- */
T('7.1 玩家加入势力后会发布专属委托', () => {
  const st = fresh(bp);
  const a = st.quests.offers.filter(o => o.src === 'guild').length;
  bp.act(st, { state: st }, 'guild', 'join');
  const b = st.quests.offers.filter(o => o.src === 'guild').length;
  assert(b > a, '加入势力后未出现势力委托');
});
T('7.2 势力委托的委托人是玩家自己的势力', () => {
  const st = fresh(bp);
  bp.act(st, { state: st }, 'guild', 'join');
  const gq = st.quests.offers.filter(o => o.src === 'guild')[0];
  assert(gq, '无势力委托');
  assert(gq.giver === st.guild.name, '势力委托人应为玩家势力，实际 ' + gq.giver);
});

/* ---- 8 确定性 ---- */
T('8.1 同种子连续两次生成完全一致', () => {
  const st1 = fresh(bp); const st2 = fresh(bp);
  assert(JSON.stringify(st1.quests.offers) === JSON.stringify(st2.quests.offers), '两次生成不一致');
});
T('8.2 源码禁止 Math.random', () => {
  const src = fs.readFileSync(QUESTS, 'utf8') + fs.readFileSync(CORE, 'utf8');
  const bad = src.split('\n').filter(l => /Math\.random/.test(l) && !/禁止|严禁|\/\/|\*/.test(l));
  assert(bad.length === 0, '发现 Math.random 调用：' + bad.slice(0, 2).join(' | '));
});
T('8.3 推进函数幂等（同输入同结果）', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  const q1 = JSON.parse(JSON.stringify(q));
  q1.state = 'active';                 // 推进只作用于进行中的委托
  window.RpgQuests.advance(q1, q.t, 3, q.place);
  window.RpgQuests.advance(q1, q.t, 3, q.place);
  assert(q1.cur === Math.min(q.need, 6), '推进不幂等，cur=' + q1.cur);
});

/* ---- 9 老存档兼容 ---- */
T('9.1 缺字段的旧存档 backfill 不崩', () => {
  const st = { lv: 5, gold: 10 };
  bp.backfill(st, st);
  assert(st.mode === 'sandbox', '缺省路线应为沙盒');
  assert(Array.isArray(st.quests.offers) && Array.isArray(st.quests.active), '委托字段未补齐');
  assert(st.quests.offers.length >= 4, '老存档首次进入应立刻有委托');
});
T('9.2 畸形委托字段被清洗', () => {
  const st = { lv: 3, quests: 'bad', situation: 5, mode: 99, visited: [] };
  bp.backfill(st, st);
  assert(Array.isArray(st.quests.offers), 'quests 未修正');
  assert(st.mode === 'sandbox', '非法 mode 未回落');
  assert(st.situation && Array.isArray(st.situation.list), 'situation 未修正');
});

/* ---- 10 数值不崩 ---- */
T('10.1 遍历动作后委托状态保持合法', () => {
  const st = fresh(bp);
  const acts = ['tick', 'loot', 'skill', 'rest', 'questclaim', 'achieveclaim', 'buff'];
  acts.forEach(a => { try { bp.act(st, { state: st }, a, a === 'skill' ? 'slash' : ''); } catch (e) { throw new Error(a + ' 抛错：' + e.message); } });
  assert(Array.isArray(st.quests.active), 'active 非数组');
  assert(Array.isArray(st.quests.offers), 'offers 非数组');
  st.quests.active.forEach(q => {
    assert(q.cur >= 0 && q.cur <= q.need, '委托进度越界：' + q.cur + '/' + q.need);
    assert(q.due >= 0, '时限为负');
  });
});
T('10.2 委托系统整体数值有限非负', () => {
  const st = fresh(bp);
  const q = st.quests.offers[0];
  bp.act(st, { state: st }, 'qaccept', q.id);
  for (let i = 0; i < 40; i++) bp.act(st, { state: st }, 'tick', '');
  assert(st.gold >= 0 && isFinite(st.gold), '金币异常 ' + st.gold);
  assert(st.rep >= 0 && isFinite(st.rep), '声望异常 ' + st.rep);
  assert(st.lv >= 1, '等级异常');
});

/* ---- 11 兜底路径：不加载 rpg-quests.js 时委托板仍不可为空 ---- */
T('11.1 未加载 rpg-quests.js 时兜底引擎仍能生成委托', () => {
  const sb = makeSandboxNoQuests(g);
  const st = {};
  sb.bp.backfill({}, st);
  assert(st.quests.offers.length >= 4, '兜底板面应 ≥4 条，实际 ' + st.quests.offers.length);
  assert(st.quests.offers[0].title && st.quests.offers[0].need >= 1, '兜底委托字段不全');
});
T('11.2 兜底引擎同样支持接取/推进/交付/过期', () => {
  const sb = makeSandboxNoQuests(g);
  const st = {};
  sb.bp.backfill({}, st);
  const q = st.quests.offers[0];
  const m = sb.bp.act(st, { state: st }, 'qaccept', q.id);
  assert(m.indexOf('接取委托') >= 0, '兜底接取失败：' + m);
  const D = q.due;
  for (let i = 0; i < D + 5; i++) sb.bp.act(st, { state: st }, 'tick', '');
  assert(st.quests.active.length === 0, '兜底委托未按时失效');
});
T('11.3 真引擎就位时兜底不生效（不顶掉真实现）', () => {
  assert(window.RpgQuests && window.RpgQuests._fallback === undefined, '真引擎被兜底覆盖了');
});

console.log('\n通过 ' + PASS + ' / ' + (PASS + FAIL));
if (FAIL) { console.log('\n失败明细:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
