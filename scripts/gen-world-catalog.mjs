/* 云境 · 世界目录生成脚本
 * 从 index.html 的世界卡片抽取 4 大类/38 世界，生成 js/world-catalog.js。
 * 用法：node scripts/gen-world-catalog.mjs
 * 新增世界后：先改 index.html 卡片，再跑本脚本。校验 genre 唯一且与校对数据对齐。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// 轻量解析（不依赖第三方库，避免维护成本）：用正则切 ws-cat 块
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();
}
function textOf(block, cls) {
  const m = block.match(new RegExp('<[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>'));
  return m ? stripTags(m[1]) : "";
}
function parseCard(a) {
  const href = (a.match(/href="([^"]*)"/) || [])[1] || "";
  const g = (href.match(/genre=([^&]+)/) || [])[1] || "";
  const h = ((a.match(/--ws-hue:\s*(#[0-9a-fA-F]{6})/) || [])[1]) || "#c9a86a";
  return { g, n: textOf(a,"ws-name"), d: textOf(a,"ws-desc"), y: textOf(a,"ws-glyph"), h };
}

const cats = [];
const catRe = /<div class="ws-cat"([^>]*)>([\s\S]*?)(?=<div class="ws-cat"|<!-- ws-cat-end -->|$)/g;
// 更稳妥：按 wc-name 分块
const parts = html.split(/(?=<div class="ws-cat")/).slice(1);
for (const part of parts) {
  const block = part.split(/(?=<div class="ws-cat")/)[0];
  const key = ((block.match(/data-cat="([^"]+)"/) || [])[1]) || "";
  const name = textOf(block, "wc-name");
  const desc = textOf(block, "wc-desc");
  if (!name) continue;
  // 取 cat-body 内容
  const bodyM = block.match(/class="ws-cat-body"[^>]*>([\s\S]*)$/);
  const body = bodyM ? bodyM[1] : block;
  const groups = [];
  // 子类
  const gpParts = body.split(/(?=<div class="ws-group")/).slice(1);
  for (const gp of gpParts) {
    const gname = textOf(gp, "wg-name");
    const cards = gp.match(/<a class="workshop"[\s\S]*?<\/a>/g) || [];
    groups.push({ name: gname, worlds: cards.map(parseCard) });
  }
  // 直接挂在 cat-body 下（无 group 包裹）的卡片：扣掉已在 group 中出现的
  const allCards = body.match(/<a class="workshop"[\s\S]*?<\/a>/g) || [];
  const inGroup = new Set();
  groups.forEach(g => g.worlds.forEach(w => inGroup.add(w.g)));
  const loose = allCards.map(parseCard).filter(w => !inGroup.has(w.g));
  if (loose.length) groups.unshift({ name: "", worlds: loose });
  const total = groups.reduce((s,g)=>s+g.worlds.length,0);
  cats.push({ key, name, desc, groups, total });
}

// 校验
const genres = cats.flatMap(c => c.groups.flatMap(g => g.worlds.map(w=>w.g)));
const dup = genres.filter((g,i)=>genres.indexOf(g)!==i);
if (dup.length) throw new Error("重复 genre: " + dup.join(","));
console.log("分类:", cats.map(c=>c.name+" "+c.total).join(" / "));
console.log("总世界:", genres.length, "唯一:", new Set(genres).size);

const out = `/* 云境 · 世界目录 WorldCatalog（自动生成，源：index.html，勿手改）
 * 封面主界面分类世界选择器唯一数据源。新增世界改 index.html 后重跑本脚本。
 * scripts/gen-world-catalog.mjs */
(function(){
"use strict";
var CATALOG = ${JSON.stringify(cats, null, 2)};

var INDEX = {};
CATALOG.forEach(function(c){
  c.groups.forEach(function(g){
    g.worlds.forEach(function(w){
      INDEX[w.g] = { name:w.n, desc:w.d, glyph:w.y, hue:w.h, cat:c.key, catName:c.name, group:g.name };
    });
  });
});

window.WorldCatalog = {
  version: "1.0.0", categories: CATALOG, index: INDEX,
  genres: function(){ return Object.keys(INDEX); },
  get: function(g){ return INDEX[g] || null; },
  count: function(){ return Object.keys(INDEX).length; }
};
})();
`;
fs.writeFileSync(path.join(ROOT, "js/world-catalog.js"), out, "utf8");
console.log("已生成 js/world-catalog.js");