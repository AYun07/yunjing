// T2 专项验证：ATLAS_ERAS 注入 6 个多时代界后，真实合并逻辑是否正确追加时代层。
// 复用 atlas-panel.js init() 中「v3.97.0 时代地图层」的真实合并代码段。
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

// v4.14.0 修：原用 process.cwd() 当仓库根，只有在仓库根目录启动才跑得起来
// （从别处执行会 ENOENT 找 …/js/atlas-eras.js，看起来像产品缺陷，其实是脚手架脆弱）。
// 现改为按脚本自身位置解析：yunjing-test/scripts/ → 上两级 = 仓库根。
const ROOT = path.resolve(__dirname, "..", "..");
const erasSrc = fs.readFileSync(path.join(ROOT, "js", "atlas-eras.js"), "utf8");

// 1) 加载真实 ATLAS_ERAS
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(erasSrc, sandbox);
const ATLAS_ERAS = sandbox.window.ATLAS_ERAS;

const NEW6 = ["xianni", "daoguiyixian", "zhongshengdushi", "lunhuileyuan", "quanqiubingfeng", "dibao"];
for (const g of NEW6) {
  assert(ATLAS_ERAS[g] && ATLAS_ERAS[g].length >= 1, `ATLAS_ERAS.${g} 应存在且至少 1 层`);
}

// 2) 构造最小 ATLAS_DATA（含 6 界真实存在的 layers 容器），跑真实合并逻辑
const ATLAS_DATA = {};
NEW6.forEach((g) => { ATLAS_DATA[g] = { layers: [{ id: "base_" + g, nodes: [], roads: [] }] }; });

function realMerge() {
  const ERAS = ATLAS_ERAS;
  Object.keys(ERAS).forEach((g) => {
    const cfg = ATLAS_DATA[g];
    if (!cfg || !Array.isArray(cfg.layers) || !Array.isArray(ERAS[g])) return;
    ERAS[g].forEach((l) => {
      if (!l || !l.id) return;
      const copy = JSON.parse(JSON.stringify(l));
      copy.id = "era_" + l.id;
      if (cfg.layers.some((x) => x.id === copy.id)) return;
      const P = copy.id + "__";
      (copy.nodes || []).forEach((n) => { n.id = P + n.id; });
      (copy.roads || []).forEach((r) => { r[0] = P + r[0]; r[1] = P + r[1]; });
      cfg.layers.push(copy);
    });
  });
}
realMerge();

// 3) 断言
let fail = 0;
for (const g of NEW6) {
  const cfg = ATLAS_DATA[g];
  const baseCount = 1;
  assert(cfg.layers.length === baseCount + ATLAS_ERAS[g].length,
    `${g} 层数量应为 ${baseCount + ATLAS_ERAS[g].length}，实得 ${cfg.layers.length}`);
  for (const L of ATLAS_ERAS[g]) {
    const merged = cfg.layers.find((x) => x.id === "era_" + L.id);
    if (!merged) { console.log(`  ✗ ${g} 缺时代层 era_${L.id}`); fail++; continue; }
    // 节点 id 前缀
    const allPrefixed = (merged.nodes || []).every((n) => n.id.startsWith("era_" + L.id + "__"));
    if (!allPrefixed) { console.log(`  ✗ ${g}/era_${L.id} 存在未前缀化的节点`); fail++; }
    // 道路端点全部指向已前缀化节点
    const ids = new Set((merged.nodes || []).map((n) => n.id));
    const roadsOk = (merged.roads || []).every((r) => ids.has(r[0]) && ids.has(r[1]));
    if (!roadsOk) { console.log(`  ✗ ${g}/era_${L.id} 道路端点指向不存在的节点`); fail++; }
    // 节点无 t:"start"（不污染补录链路）
    const hasStart = (merged.nodes || []).some((n) => n.t === "start");
    if (hasStart) { console.log(`  ✗ ${g}/era_${L.id} 节点不应带 t:"start"`); fail++; }
  }
  console.log(`  ✓ ${g}: +${ATLAS_ERAS[g].length} 时代层, 共 ${cfg.layers.length} 层`);
}

// 4) 全量层 id 唯一性
const idSet = new Set();
let dup = 0;
Object.values(ATLAS_DATA).forEach((cfg) => cfg.layers.forEach((L) => {
  if (idSet.has(L.id)) dup++; idSet.add(L.id);
}));
if (dup) { console.log(`  ✗ 存在 ${dup} 个重复层 id`); fail++; }

if (fail === 0) {
  console.log("\nATLAS_ERAS_OK ✓  6 界时代层合并正确（前缀/道路/无 start/无冲突）");
  process.exit(0);
} else {
  console.log(`\nATLAS_ERAS_FAIL ✗ ${fail} 项`);
  process.exit(1);
}
