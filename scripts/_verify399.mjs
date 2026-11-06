#!/usr/bin/env node
/**
 * v3.99.0 专项验收：低参数模型适配 / OOC 防护 / 地图密度
 *
 * 这三件事是这一版的主体，各立一条可量化的判据：
 *   ① OOC 防护：37 界每一界都必须有一条「OOC 红线清单」常驻条目——
 *      小模型不会自己拼接分散规则，必须集中成一份「动笔前必查」。
 *   ② 常驻预算：每界常驻字数 ≤ 9000（约 7.5k token）。超了就说明小模型会被挤出窗口。
 *   ③ 地图密度：四界每层节点 ≥ 10（此前只有 2-4 个，地图大片空白）。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = '/workspace/yunjing';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const idx = JSON.parse(read('js/kb/_index.json')).genres;
const GENRES = Object.keys(idx);

let pass = 0;
let fail = 0;
const line = (okFlag, tag, msg) => {
  console.log(`  ${okFlag ? '✅' : '❌'} ${tag} — ${msg}`);
  if (okFlag) pass += 1;
  else fail += 1;
};

function loadKB(g) {
  const w = {};
  w.addEventListener = function () {};
  const ctx = {
    window: w,
    console,
    document: {},
    localStorage: { getItem: () => null, setItem() {} }
  };
  const p = path.join(ROOT, 'js/kb', `${g}.core.js`);
  if (!fs.existsSync(p)) return null;
  try {
    vm.runInNewContext(fs.readFileSync(p, 'utf8'), ctx, { filename: g });
  } catch (e) {
    return null;
  }
  return (w.KB_PRESETS || {})[g] || null;
}

/* ---------- 1. OOC 红线覆盖 ---------- */
console.log('\n[1] OOC 防护：37 界集中红线清单');
{
  const miss = [];
  const noHost = [];
  for (const g of GENRES) {
    const arr = loadKB(g);
    if (!arr) {
      miss.push(`${g}(无 core)`);
      continue;
    }
    const hasOOC = arr.some((x) => /OOC|红线/i.test(x.title || ''));
    /* 题材界（悬疑/科幻/武侠/克苏鲁/自由世界/现实地球）没有原著人物，
       有的是「人设谱」这类模板，不写「主持须知」是合理的，豁免。 */
    const THEME = ['mystery', 'scifi', 'wuxia', 'cthulhu', 'free', 'freeworld', 'earth'];
    const hasHost = arr.some((x) => /主持须知/.test(x.content || ''));
    if (!hasOOC) miss.push(g);
    if (!THEME.includes(g) && !hasHost) noHost.push(g);
  }
  if (miss.length) line(false, '红线清单覆盖', `缺 ${miss.length} 界：${miss.slice(0, 8).join(', ')}${miss.length > 8 ? ' …' : ''}`);
  else line(true, '红线清单覆盖', `${GENRES.length}/${GENRES.length} 界均有「OOC 红线清单」常驻条目`);
  if (noHost.length) line(false, '主持须知', `缺 ${noHost.length} 界`);
  else line(true, '主持须知', '全部界的人物条均带「主持须知」防跑偏提示');
}

/* ---------- 2. 常驻预算 ---------- */
console.log('\n[2] 常驻预算（小模型上下文）');
{
  const rows = [];
  for (const g of GENRES) {
    const arr = loadKB(g);
    if (!arr) continue;
    const al = arr.filter((x) => x.alwaysInclude === true);
    const chars = al.reduce((s, x) => s + String(x.content || '').length, 0);
    rows.push({ g, n: al.length, chars });
  }
  const over = rows.filter((r) => r.chars > 9000);
  const max = rows.reduce((a, b) => (b.chars > a.chars ? b : a), rows[0]);
  const min = rows.reduce((a, b) => (b.chars < a.chars ? b : a), rows[0]);
  const avg = Math.round(rows.reduce((s, r) => s + r.chars, 0) / rows.length);
  if (over.length) line(false, '常驻上限', `${over.length} 界超 9000 字：${over.map((r) => `${r.g}(${r.chars})`).join(', ')}`);
  else line(true, '常驻上限', `${rows.length} 界常驻均 ≤9000 字（最大 ${max.g} ${max.chars} 字，最小 ${min.g} ${min.chars} 字，均值 ${avg} 字）`);
  const tooFew = rows.filter((r) => r.n < 3);
  if (tooFew.length) line(false, '常驻下限', `${tooFew.length} 界常驻不足 3 条（会缺世界骨架）`);
  else line(true, '常驻下限', '每界常驻 ≥3 条，世界骨架与铁律都在场');
}

/* ---------- 3. 地图密度 ---------- */
console.log('\n[3] 四界舆图节点密度');
{
  const w = {};
  w.addEventListener = function () {};
  vm.runInNewContext(read('js/atlas-potato.js'), { window: w, console }, { filename: 'atlas-potato' });
  const POT = w.ATLAS_POTATO || {};
  const WANT = ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];
  let thin = [];
  let total = 0;
  let layers = 0;
  let minGap = 999;
  for (const g of WANT) {
    const world = POT[g];
    if (!world) {
      thin.push(`${g}(缺失)`);
      continue;
    }
    for (const L of world.layers) {
      const nodes = L.nodes || [];
      total += nodes.length;
      layers += 1;
      if (nodes.length < 10) thin.push(`${g}/${L.name}(${nodes.length})`);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < minGap) minGap = d;
        }
      }
    }
  }
  if (thin.length) line(false, '节点密度', `偏薄：${thin.join(', ')}`);
  else line(true, '节点密度', `${layers} 层共 ${total} 个节点，每层均 ≥10（此前 2-4 个）`);
  if (minGap >= 9) line(true, '标签不重叠', `同层最近两点距离 ${minGap.toFixed(1)} > 9`);
  else line(false, '标签不重叠', `最近两点仅 ${minGap.toFixed(1)}，会压字`);
}

/* ---------- 4. 四界配色 ---------- */
console.log('\n[4] 四界舆图专属配色');
{
  const src = read('js/atlas-panel.js');
  const miss = ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'].filter(
    (g) => !new RegExp(`\\n\\s*${g}: \\{ primary:`).test(src)
  );
  if (miss.length) line(false, '配色登记', `缺 ${miss.join(', ')}（会退回兜底色，与世界观不符）`);
  else line(true, '配色登记', '四界均有专属配色（大主宰赤金/武动苍青/元尊天青/万相相紫）');
}

/* ---------- 5. 低配档机制在位 ---------- */
console.log('\n[5] 低配档机制接线');
{
  const pb = read('js/prompt-budget.js');
  const kbm = read('js/knowledge-manager.js');
  const amb = read('js/ai-message-builder.js');
  const acf = read('js/api-calling-functions.js');
  const bmm = read('js/base-model-mode.js');
  const checks = [
    ['上下文窗口循环', /cycleContext\s*\(/.test(pb)],
    ['超限自动降级', /noteOverflow\s*\(/.test(pb) && /isOverflowError/.test(pb)],
    ['降级后自动重试', /isOverflowError/.test(acf)],
    ['系统提示词压缩', /compactSystemPrompt/.test(bmm) && /compactSystemPrompt/.test(amb)],
    ['知识库按预算打包', /_packLayer/.test(kbm)],
    ['超长条目压缩而非丢弃', /_squeezeItem/.test(kbm)],
    ['知识库免疫最终裁剪', /知识库·背景", 100\)/.test(amb) && /知识库·前景", 100\)/.test(amb)],
    ['低配档历史窗口减半', /bmmOn \? -9 : -17/.test(amb)]
  ];
  for (const [name, okFlag] of checks) line(okFlag, name, okFlag ? '已接线' : '缺失');
}

console.log(`\n========== v3.99.0 专项验收：通过 ${pass} / 失败 ${fail} ==========`);
process.exit(fail ? 1 : 0);
