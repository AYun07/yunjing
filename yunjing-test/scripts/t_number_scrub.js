/* v4.09.0 · 数值真值白名单清洗自检
 * 正向：编造数值必须被剥离 / 改写
 * 反向：合法数值与正常中文叙事必须零误伤
 * 变异：故意破坏每条清洗分支，测试必须立刻失败（反向灵敏度）
 */
"use strict";
const fs = require("fs");
const path = require("path");
const MODULE = path.join(__dirname, "../../js/number-scrubber.js");
const NS = require(MODULE);

const SNAP = {
  nums: {
    lv: 2, exp: 40, gold: 88, hp: 304, mp: 50, rep: 4,
    /* 非货币字段恰好含 5：用于验证「木剑才卖 5 金币」不会被宽松白名单放行 */
    points: 5, kills: 5, round: 5,
    goldTrail: ["+30", "+4"],
    actLog: ["交付委托：金币 +30、声望 +4、经验 +40"],
    derived: { maxHp: 320, maxMp: 60, expNext: 100 },
    quests: [{ id: "q_offer_1", cur: 2, need: 3, gold: 30 }],
    activeQuests: [{ id: "q_active_1", cur: 1, need: 1, gold: 30 }],
    questOffers: [],
    stage: { current: 1, total: 3 },
    guild: { level: 1, contrib: 0 }
  },
  flat: { "$gold": 88, "$lv": 2 }
};
const TURNS = [{ nums: { gold: 58, lv: 1, exp: 0 }, claims: { gold: [58] } }];

/* 每条：[名称, 输入, 断言函数] */
const POSITIVE = [
  ["总金币 99", "他摸了摸钱袋，总金币 99。", (o) => !/99/.test(o)],
  ["HP 346/470", "HP 346/470，他喘着粗气靠在墙上。", (o) => !/346|470/.test(o)],
  ["怒气 72/106", "怒气 72/106 在胸口翻涌。", (o) => !/72|106/.test(o)],
  ["经验 +10000", "经验 +10000，境界隐隐松动。", (o) => !/10000/.test(o) && /经验略有增长/.test(o)],
  ["声望 +50", "声望 +50，酒馆里有人抬头。", (o) => !/\+50/.test(o) && /声名渐起/.test(o)],
  ["攻击 +17", "攻击 +17，剑锋更利。", (o) => !/\+17/.test(o) && /攻势更盛/.test(o)],
  ["木剑才卖 5 金币", "木剑才卖 5 金币，他掂了掂。", (o) => !/5\s*金币/.test(o) && /些许金币/.test(o)],
  ["剩下 20 金币", "付过账，剩下 20 金币。", (o) => !/20\s*金币/.test(o)],
  ["金币：999", "金币：999，足够买下整条街。", (o) => !/999/.test(o) && /金币些许/.test(o)],
  ["目前 1/1", "目前 1/1，行囊再塞不下东西。", (o) => !/1\s*[/／]\s*1/.test(o)],
  ["背包 1/1", "背包 1/1，他只好丢掉药草。", (o) => !/1\s*[/／]\s*1/.test(o)],
  ["进度 7/9 编造", "任务进度 7/9，还差得远。", (o) => !/7\s*[/／]\s*9/.test(o)]
];

const NEGATIVE = [
  ["中文数字", "三十金币也不算多，他随手付了。"],
  ["中文序数", "三日后，他回到松木林。"],
  ["孤立数字", "两人对视一眼，第 5 层的风很冷。"],
  ["年份数字", "2026 年的冬天来得早。"],
  ["合法余额 88", "他数了数，一共 88 枚金币。"],
  ["合法报酬 30", "他递出 30 金币，换来一张药方。"],
  ["合法报酬 30 枚", "「给你 30 枚金币，别声张。」"],
  ["中文模糊量", "「给你几枚金币，别声张。」"],
  ["合法进度 2/3", "委托进度 2/3，还差最后一味药。"],
  ["合法阶段 1/3", "世界处于「初启」阶段（1/3），风雪渐起。"],
  ["正常对白", "「这柄剑，你开个价吧。」他笑了笑。"]
];

function run(mod, label) {
  let pass = 0, fail = 0;
  const bad = [];
  for (const [name, input, check] of POSITIVE) {
    const out = mod.scrub(input, SNAP, TURNS);
    if (check(out)) pass++;
    else { fail++; bad.push(`正向 ${name} → ${JSON.stringify(out)}`); }
  }
  for (const [name, input] of NEGATIVE) {
    const out = mod.scrub(input, SNAP, TURNS);
    if (out === input) pass++;
    else { fail++; bad.push(`反向 ${name} 被误改 → ${JSON.stringify(out)}`); }
  }
  return { pass, fail, bad, label };
}

console.log("=== 数值白名单清洗自检 ===");
const base = run(NS, "当前实现");
console.log(`样本 ${POSITIVE.length + NEGATIVE.length} 条 ｜ 通过 ${base.pass} ｜ 失败 ${base.fail}`);
base.bad.forEach((x) => console.log("  ✗ " + x));
if (base.fail) process.exit(1);

/* ---- 变异灵敏度：破坏任一分支，测试必须失败 ---- */
const src = fs.readFileSync(MODULE, "utf8");
const MUTANTS = [
  ["禁用面板片段剥离", 'var s = body.replace(PANEL_FRAG, "");', "var s = body;"],
  ["禁用增量改写", "s = s.replace(GAIN_FRAG, function (m, field) { return GAIN_WORD[field] || \"略有所得\"; });", ""],
  ["禁用货币数量改写", "s = s.replace(MONEY_PRE, function (m, num, q, unit) {", "s = s.replace(/__NEVER__/g, function (m, num, q, unit) {"],
  ["禁用进度对剥离", "s = s.replace(PROG_FRAG, function (m, a, b) {", "s = s.replace(/__NEVER__/g, function (m, a, b) {"]
];
console.log("\n=== 变异灵敏度反向验证 ===");
let detected = 0;
for (const [name, from, to] of MUTANTS) {
  if (!src.includes(from)) {
    console.log(`  ✗ 变异体「${name}」锚点未命中，测试脚本自身失效`);
    process.exit(2);
  }
  const code = src.replace(from, to);
  const fake = { exports: {} };
  new Function("module", "exports", "globalThis", code)(fake, fake.exports, {});
  const r = run(fake.exports, name);
  if (r.fail > 0) { detected++; console.log(`  ✓ ${name} → 被检出（${r.fail} 条样本失败）`); }
  else console.log(`  ✗ ${name} → 未被检出（测试形同虚设）`);
}
console.log(`变异检出 ${detected}/${MUTANTS.length}`);
if (detected !== MUTANTS.length) process.exit(3);
console.log("\n✅ 数值白名单清洗：正反样本全通过，全部变异分支可检出");
