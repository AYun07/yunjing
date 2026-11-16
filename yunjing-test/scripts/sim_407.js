/* 云境 v4.07.0 云境 v4.05.0 独立长程数值模拟（玩家视角，纯 Node vm，无外部 API）
 * 与既有单测的区别：既有单测是「单个动作 + 人为塞前置状态」，从不连续玩。
 * 本脚本从初始存档出发，按真实玩家策略连续跑 300 轮，记录数值曲线，找崩坏点。
 */
const fs = require('fs');
const vm = require('vm');
const ROOT = process.env.YJ_ROOT || '/workspace/yunjing';
const FILE = ROOT + '/js/rpg-core.js';
const code = fs.readFileSync(FILE, 'utf8');
const GENRES = ['wangyou'];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const ARCS = {
  wangyou: { title: '寰宇纪元 · 从新手谷到王者权杖', st: [
    ['开服 · 新手谷', '完成一次转正', () => true], ['主城立足', '拿下第一片驻地', () => true],
    ['秘境首杀', '完成一次世界首领击杀', () => true], ['跨服会战', '赢下一场跨服战场', () => true],
    ['隐藏职业觉醒', '通过隐藏职业认证', () => true], ['神域终局', '守住或夺取王者权杖', () => true]] }
};

function makeSandbox(genre) {
  const WorldExt = { hasModules() { return true; }, injectModules() {}, act() {}, onVars() {}, modState() { return null; }, refreshStrip() {} };
  const window = {
    WorldRuntime: { genre, H: { esc }, module: bp => bp }, WorldExt,
    QuestChain: { arcs: ARCS }, YJWait: { for() {} },
    BaseModelMode: { ctxTier: () => 'normal' }
  };
  const document = { readyState: 'complete', head: { appendChild() {} }, body: {}, createElement() { return {}; }, getElementById() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  const sandbox = { window, document, console: { log() {}, warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ROOT + '/js/rpg-quests.js','utf8'), sandbox, { filename: 'rpg-quests.js' });
  vm.runInContext(code, sandbox, { filename: FILE });
  return { RC: window.RPGCore, bp: window.RPGCore.module(genre) };
}

function num(v) { return typeof v === 'number' && isFinite(v); }
function bad(st, d) {
  const issues = [];
  ['lv', 'exp', 'gold', 'rep', 'points', 'hp', 'mp', 'kills', 'arenaWins', 'arenaLoss', 'arenaStreak', 'arenaBest'].forEach(k => {
    if (!num(st[k])) issues.push(k + '=' + String(st[k]));
    else if (st[k] < 0) issues.push(k + ' 为负 ' + st[k]);
  });
  if (num(st.hp) && num(d.maxHp) && st.hp > d.maxHp) issues.push('hp 超上限 ' + st.hp + '/' + d.maxHp);
  if (num(st.mp) && num(d.maxMp) && st.mp > d.maxMp) issues.push('mp 超上限 ' + st.mp + '/' + d.maxMp);
  if (Array.isArray(st.bag) && st.bag.length > 20) issues.push('背包膨胀 ' + st.bag.length);
  if (st.quests && Array.isArray(st.quests.active)) {
    if (st.quests.active.length > 8) issues.push('进行中委托超上限 ' + st.quests.active.length);
    st.quests.active.forEach(q => {
      if (!(Number(q.cur) >= 0 && q.cur <= q.need)) issues.push('委托进度越界 ' + q.title + ' ' + q.cur + '/' + q.need);
      if (!(Number(q.due) >= 0)) issues.push('委托时限为负 ' + q.title);
      if (q.state !== 'active' && q.state !== 'done') issues.push('委托状态异常 ' + q.title + ' ' + q.state);
    });
  }
  return issues;
}

const ROUNDS = 300;
for (const g of GENRES) {
  const { RC, bp } = makeSandbox(g);
  const st = {};
  bp.backfill({}, st);
  const E = RC.Engine;
  const W = RC.WORLD[g];
  const skills = RC.CLASSES[st.cls].skills;
  let skillFail = 0, skillOk = 0, lootN = 0, arenaN = 0, enhanceN = 0, questN = 0, restN = 0;
  let qAccept = 0, qTurn = 0, qFail = 0, qExpire = 0;
  const snaps = [], issues = new Set();
  let firstKillRound = -1, maxGold = 0, minGold = Infinity;

  for (let r = 1; r <= ROUNDS; r++) {
    // 每轮剧情推进（read 内部给经验 + tickBuffs 递减 CD）
    bp.read(st, {}, r);

    // 玩家主循环：放技能打怪
    const sk = skills[0][0];
    const before = JSON.stringify(st);
    const msg = String(bp.act(st, { state: st }, 'skill', sk));
    // 成功提示以 ⚔️ 开头；失败提示是「冷却中(...)」「XX不足(...)」「未知技能」。
    // 注意成功提示里也含「冷却 3 轮」字样，不能用 /冷却/ 正则判失败。
    if (msg.indexOf('⚔️') === 0) skillOk++; else skillFail++;

    // MP/HP 兜底：低了就休息（免费），模拟玩家会回城
    const d0 = E.derive(st);
    if ((Number(st.mp) || 0) < skills[0][2] * 2 || (Number(st.hp) || 0) < d0.maxHp * 0.35) {
      bp.act(st, { state: st }, 'rest', ''); restN++;
    }

    if (r % 5 === 0) { bp.act(st, { state: st }, 'loot', ''); lootN++; }
    if (r % 5 === 1 && Array.isArray(st.bag) && st.bag.length) {
      // 把背包第一件按槽装备
      bp.act(st, { state: st }, 'equipbag', '0');
    }
    if (r % 10 === 0) { bp.act(st, { state: st }, 'arena', ''); arenaN++; }
    if (r % 12 === 0) { bp.act(st, { state: st }, 'enhance', 'weapon'); enhanceN++; }
    if (r % 20 === 0) { bp.act(st, { state: st }, 'questclaim', ''); questN++; }
    if (r % 30 === 0) { bp.act(st, { state: st }, 'party', 'join'); }
    if (r % 40 === 0) { bp.act(st, { state: st }, 'guild', 'join'); bp.act(st, { state: st }, 'guild', 'contrib'); }
    /* v4.07.0 沙盒委托行为：接一条新的；已完成立刻交付；超时的放弃 */
    if (Array.isArray(st.quests.active)) {
      st.quests.active.slice().forEach(q => {
        if (q.state === 'done') { bp.act(st, { state: st }, 'qturnin', q.id); qTurn++; }
        else if (q.due <= 2) { bp.act(st, { state: st }, 'qgiveup', q.id); qExpire++; }
      });
    }
    if (r % 6 === 0 && st.quests.active.length < 5 && st.quests.offers.length) {
      const cand = st.quests.offers.filter(o => o.lv <= st.lv + 3)[0] || st.quests.offers[0];
      const rm = String(bp.act(st, { state: st }, 'qaccept', cand.id));
      if (rm.indexOf('接取委托') >= 0) qAccept++; else qFail++;
    }

    if (firstKillRound < 0 && (Number(st.kills) || 0) > 0) firstKillRound = r;
    maxGold = Math.max(maxGold, Number(st.gold) || 0);
    minGold = Math.min(minGold, Number(st.gold) || 0);

    const d = E.derive(st);
    bad(st, d).forEach(x => issues.add('R' + r + ': ' + x));

    if (r % 25 === 0 || r === 1) {
      snaps.push({ r, lv: st.lv, exp: st.exp, need: E.expToNext(st.lv), gold: st.gold,
        hp: st.hp + '/' + d.maxHp, mp: st.mp + '/' + d.maxMp, atk: d.atk, def: d.def,
        kills: st.kills, arena: st.arenaWins + '/' + st.arenaLoss, streak: st.arenaStreak,
        bag: Array.isArray(st.bag) ? st.bag.length : -1, huntHp: st.hunt && st.hunt.hp,
        enh: (st.equip && st.equip.weapon && st.equip.weapon.lv) || 0 });
    }
  }

  console.log('\n========== 界：' + g + ' ==========');
  console.log('轮数', ROUNDS, '技能成功', skillOk, '技能失败(CD/MP)', skillFail,
    '掉落', lootN, '竞技', arenaN, '强化', enhanceN, '任务领取尝试', questN, '休息', restN);
  console.log('首杀轮次', firstKillRound, '金币区间', minGold, '~', maxGold);
  console.log('最终 lv/exp', st.lv, st.exp, '需', E.expToNext(st.lv),
    'questDone', JSON.stringify(st.questDone), 'points', st.points);
  console.log('最终面板 hp/mp', st.hp, st.mp, 'atk/def', E.derive(st).atk, E.derive(st).def);
  console.log('竞技 胜/负/连胜/最高', st.arenaWins, st.arenaLoss, st.arenaStreak, st.arenaBest);
  console.log('委托 接取/交付/放弃/失败', qAccept, qTurn, qExpire, qFail,
    '| 板上', st.quests.offers.length, '| 进行中', st.quests.active.length,
    '| 完成', st.quests.done, '| 过期', st.quests.expired, '| 世界日', st.worldDay,
    '| 路线', st.mode);
  console.log('组队 size/members', st.party.size, st.party.members.length,
    '公会', st.guild.name, st.guild.contrib, st.guild.rank, '宠物', st.pet.level, st.pet.exp, st.pet.loyalty);
  console.log('--- 曲线快照 ---');
  snaps.forEach(s => console.log('  R' + String(s.r).padStart(3), 'Lv.' + s.lv, 'exp', s.exp + '/' + s.need,
    'gold', s.gold, 'hp', s.hp, 'mp', s.mp, 'atk', s.atk, 'def', s.def,
    'kills', s.kills, 'arena', s.arena, 'streak', s.streak, 'bag', s.bag, 'huntHp', s.huntHp, 'enh', s.enh));
  console.log('--- 数值异常 ---');
  if (!issues.size) console.log('  (无 NaN/负/超上限)');
  else [...issues].slice(0, 20).forEach(x => console.log('  !! ' + x));
}
