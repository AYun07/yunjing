/* T4 内核验证：在最小 mock 环境下加载 npc-spawn.js，
 * 构造一个「与主角敌对(-40)」的 NPC，跑 30 个世界日，
 * 断言其 personality 落入冷硬簇、ambition 落入复仇簇（性格/理想自治演化）。 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "..", "..", "js", "npc-spawn.js"), "utf8");

const sandbox = { console, Math, Date, JSON, parseInt, isFinite, Array, Object, String, Number, Boolean };
sandbox.window = sandbox; // 使 window.X 与裸 X 同指向，满足 npc-spawn 的引用习惯
sandbox.storyFramework = { storyState: { setup: { playerName: "阿杰" } } };
sandbox.EntityStore = { bootstrap() {}, link() {}, upsert() { return {}; } };
sandbox.WorldRuntime = { NPC: { upsert() {} } };

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const NpcSpawn = sandbox.NpcSpawn;
if (!NpcSpawn || !NpcSpawn.driftWills) { console.error("FAIL: NpcSpawn.driftWills 未导出"); process.exit(1); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PERSO_WARM = ["外冷内热，重诺守义", "豪爽仗义，一诺千金", "温文尔雅，藏而不露", "散漫不羁，心却透亮"];
const PERSO_COLD = ["谨慎多疑，凡事先留三分", "沉默寡言，出手果断", "执拗认真，认死理"];
const AMBI_AVENGE = ["为亡友讨一个公道", "查清当年灭门一夜的真相"];

const v = {
  characters: {
    李青芜: {
      name: "李青芜",
      personality: "散漫不羁，心却透亮",          // 初始温热簇
      ambition: "攒够盘缠回一趟故乡",              // 初始安身簇
      emotion: "平静",
      goal: "求一份安稳的差事糊口",
      trust: 50,
      faction: "青岚盟",
      origin: "原创"
    }
  },
  entities: {
    relations: [{ a: "李青芜", b: "阿杰", kind: "敌对", strength: -40 }],
    factions: { f1: { name: "青岚盟", collapsed: false } }
  },
  history: ["【世界】第1日 · 青岚盟与黑水宗战事再起"]
};
v.众生 = {};

const rnd = mulberry32(20241108);
let drifted = 0;
for (let d = 1; d <= 30; d++) {
  const evs = NpcSpawn.driftWills(v, d, rnd);
  if (evs && evs.length) drifted += evs.length;
}
const c = v.characters["李青芜"];
const persoCold = PERSO_COLD.indexOf(c.personality) >= 0;
const ambiAvenge = AMBI_AVENGE.indexOf(c.ambition) >= 0;

console.log("演化信号条数:", drifted);
console.log("最终 personality:", c.personality, "→ 冷硬簇?", persoCold);
console.log("最终 ambition  :", c.ambition, "→ 复仇簇?", ambiAvenge);
console.log("最终 emotion   :", c.emotion, "| trust:", c.trust);

let ok = true;
if (!persoCold) { console.error("FAIL: personality 未演化进冷硬簇"); ok = false; }
if (!ambiAvenge) { console.error("FAIL: ambition 未演化进复仇簇"); ok = false; }
console.log(ok ? "DRIFT_OK ✓ 性格/理想随敌对 bond 自治演化" : "DRIFT_FAIL ✗");
process.exit(ok ? 0 : 1);
