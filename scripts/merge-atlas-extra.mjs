#!/usr/bin/env node
/**
 * v3.99.0 舆图节点合并
 *
 * 背景：四界舆图每层只有 2-4 个节点，地图大片空白，既不美观也不像「资料详尽」。
 * 四个编纂任务各写了一份 scripts/atlas-extra/<genre>.json（只含新增节点与新增道路），
 * 这里把它们并回 js/atlas-potato.js 的对应层。
 *
 * 合并前做三道校验，任一不过就不写盘（避免把坏坐标带进地图）：
 *   ① 同层任意两节点距离 > 9（含原有节点），否则标签会压字；
 *   ② 每条 road 的两端都必须是真实存在的节点 id；
 *   ③ 节点 id 全局唯一。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = '/workspace/yunjing';
const ATLAS = path.join(ROOT, 'js/atlas-potato.js');
const EXTRA_DIR = path.join(ROOT, 'scripts/atlas-extra');
const GENRES = ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];

/* 载入现有舆图 */
const win = {};
vm.runInNewContext(fs.readFileSync(ATLAS, 'utf8'), { window: win, console }, { filename: ATLAS });
const DATA = win.ATLAS_POTATO || {};

const problems = [];
let addedNodes = 0;
let addedRoads = 0;

for (const g of GENRES) {
  const jf = path.join(EXTRA_DIR, `${g}.json`);
  if (!fs.existsSync(jf)) {
    console.log(`${g}: 无 extra 文件，跳过`);
    continue;
  }
  let extra;
  try {
    extra = JSON.parse(fs.readFileSync(jf, 'utf8'));
  } catch (e) {
    problems.push(`${g}: extra JSON 非法（${e.message}）`);
    continue;
  }
  const world = DATA[g];
  if (!world) {
    problems.push(`${g}: 舆图里没有这个世界`);
    continue;
  }
  for (const layer of world.layers) {
    const add = extra[layer.id];
    if (!add) continue;
    const nodes = layer.nodes || (layer.nodes = []);
    const roads = layer.roads || (layer.roads = []);
    const have = new Set(nodes.map((n) => n.id));
    for (const n of add.nodes || []) {
      if (have.has(n.id)) {
        problems.push(`${g}/${layer.id}: 节点 id 重复 ${n.id}`);
        continue;
      }
      nodes.push(n);
      have.add(n.id);
      addedNodes += 1;
    }
    for (const r of add.roads || []) {
      if (!Array.isArray(r) || r.length !== 2) continue;
      roads.push(r);
      addedRoads += 1;
    }
  }
}

/* 校验 */
for (const g of GENRES) {
  const world = DATA[g];
  if (!world) continue;
  const allIds = new Set();
  for (const layer of world.layers) {
    const nodes = layer.nodes || [];
    /* ③ 全局唯一 */
    for (const n of nodes) {
      if (allIds.has(n.id)) problems.push(`${g}: 全局 id 重复 ${n.id}`);
      allIds.add(n.id);
    }
    /* ① 距离 */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 9) problems.push(`${g}/${layer.id}: ${a.n}(${a.x},${a.y}) ↔ ${b.n}(${b.x},${b.y}) 距离仅 ${d.toFixed(1)}`);
      }
      const n = nodes[i];
      if (!(n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100)) problems.push(`${g}/${layer.id}: ${n.n} 坐标越界 (${n.x},${n.y})`);
      if (!n.n || !n.desc) problems.push(`${g}/${layer.id}: ${n.id} 缺名称或描述`);
    }
  }
  /* ② road 端点 */
  for (const layer of world.layers) {
    for (const r of layer.roads || []) {
      if (!allIds.has(r[0]) || !allIds.has(r[1])) problems.push(`${g}/${layer.id}: road 端点不存在 ${r.join('→')}`);
    }
  }
}

if (problems.length) {
  console.log('校验未通过，未写盘：');
  problems.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}

/* 写回：保持与原文件一致的结构 */
const body = JSON.stringify(DATA, null, 2);
const head = `/* 云境 v3.99.0 · 天蚕土豆宇宙四界舆图（大主宰/武动乾坤/元尊/万相之王）
 * 形状同 atlas-panel.js 的 ATLAS_DATA：{ name, flavor, layers:[{id,name,ico,hint,decor,regions,roads,nodes}] }
 * 由 atlas-panel.js init() 在 ATLAS_ERAS 合并之后、injectSupplement() 之前并入 ATLAS_DATA。
 * 地名一律按原著；坐标 0-100，节点 id 全局唯一（前缀 d_/w_/y_/wx_ 防冲突）。
 * v3.99.0：每层节点由 2-4 个补到 10-13 个（地名取自各界知识库「地理」条目，均可在原著溯源）。 */
window.ATLAS_POTATO = `;
fs.writeFileSync(ATLAS, head + body + ';\n');

console.log(`合并完成：新增节点 ${addedNodes} 个、道路 ${addedRoads} 条`);
for (const g of GENRES) {
  const w = DATA[g];
  if (!w) continue;
  const detail = w.layers.map((l) => `${l.name} ${(l.nodes || []).length}`).join(' / ');
  console.log(`  ${g.padEnd(16)} ${detail}`);
}
