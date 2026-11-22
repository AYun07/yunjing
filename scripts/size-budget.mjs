#!/usr/bin/env node
/**
 * 云境 · 首屏载荷闸门（v5.1.2 新增）
 * ---------------------------------------------------------------------------
 * 为什么要有它：
 *   首屏**时序**指标（FCP/LCP）随机器与网络波动很大，做成 CI 闸门必然变成红绿灯噪声；
 *   但「首屏静态载荷」是确定的——某个模块被不小心从懒加载挪回静态、或有人往
 *   index.html 塞了一个大文件，都会让首屏字节数悄悄膨胀，而没人察觉。
 *   所以这里锁**字节**不锁**毫秒**：
 *     · 大厅（index.html）：静态 CSS + JS 总量
 *     · 创作室（studio.html）：静态 CSS + JS 总量 + 静态脚本个数
 *   预算文件：scripts/size-budget.json（带余量，超了直接失败并说明差多少）。
 *
 * 用法：
 *   node scripts/size-budget.mjs          # 校验（有超预算则退出码 1）
 *   node scripts/size-budget.mjs --json   # 机器可读
 *   node scripts/size-budget.mjs --init   # 按当前值重写预算（确认是有意为之时再用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_FILE = path.join(ROOT, 'scripts', 'size-budget.json');
const AS_JSON = process.argv.includes('--json');
const INIT = process.argv.includes('--init');

const PAGES = [
  { file: 'index.html', label: '大厅' },
  { file: 'studio.html', label: '创作室' },
];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function sizeOf(rel) {
  const clean = rel.split('?')[0].replace(/^\.?\//, '');
  const p = path.join(ROOT, clean);
  try { return fs.statSync(p).size; } catch (e) { return 0; }
}

/** 统计某页面的**静态**（非懒加载）CSS/JS 载荷 */
function measure(pageFile) {
  const html = read(pageFile);
  const statics = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const lazies = [...html.matchAll(/data-src="([^"]+)"/g)].map(m => m[1]);
  const links = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map(m => m[1]);
  const cssBytes = links.reduce((a, h) => a + sizeOf(h), 0);
  const jsBytes = statics.reduce((a, s) => a + sizeOf(s), 0);
  const missing = [...links, ...statics].filter(h => sizeOf(h) === 0);
  return {
    staticCss: cssBytes,
    staticJs: jsBytes,
    staticJsCount: statics.length,
    lazyCount: lazies.length,
    lazyBytes: lazies.reduce((a, s) => a + sizeOf(s), 0),
    missing,
  };
}

const current = {};
for (const p of PAGES) {
  current[p.file] = measure(p.file);
}

if (INIT) {
  const out = {};
  for (const p of PAGES) {
    const m = current[p.file];
    out[p.file] = {
      label: p.label,
      staticCssKB: Math.ceil(m.staticCss / 1024),
      staticJsKB: Math.ceil(m.staticJs / 1024),
      staticJsCount: m.staticJsCount,
    };
  }
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('预算已重写：', path.relative(ROOT, BUDGET_FILE));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

let budget = {};
try { budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')); } catch (e) {
  console.error('读不到预算文件 scripts/size-budget.json（可先跑 --init 生成）');
  process.exit(1);
}

const problems = [];
const rows = [];
for (const p of PAGES) {
  const m = current[p.file];
  const b = budget[p.file] || {};
  const cssKB = Math.ceil(m.staticCss / 1024);
  const jsKB = Math.ceil(m.staticJs / 1024);
  const totalKB = cssKB + jsKB;
  rows.push({
    page: p.label,
    staticCssKB: cssKB, staticJsKB: jsKB, totalKB,
    lazyCount: m.lazyCount, lazyMB: +(m.lazyBytes / 1048576).toFixed(1),
  });
  if (b.staticCssKB != null && cssKB > b.staticCssKB) {
    problems.push(`${p.label} 静态 CSS ${cssKB}KB > 预算 ${b.staticCssKB}KB（多 ${cssKB - b.staticCssKB}KB）`);
  }
  if (b.staticJsKB != null && jsKB > b.staticJsKB) {
    problems.push(`${p.label} 静态 JS ${jsKB}KB > 预算 ${b.staticJsKB}KB（多 ${jsKB - b.staticJsKB}KB）`);
  }
  if (b.staticJsCount != null && m.staticJsCount > b.staticJsCount) {
    problems.push(`${p.label} 静态脚本 ${m.staticJsCount} 个 > 预算 ${b.staticJsCount} 个`);
  }
  if (m.missing.length) {
    problems.push(`${p.label} 有 ${m.missing.length} 个静态引用指向不存在的文件：${m.missing.slice(0, 5).join(', ')}`);
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ rows, problems }, null, 2));
} else {
  console.log('=== 首屏载荷（静态，不含懒加载） ===');
  for (const r of rows) {
    console.log(`  ${r.page}：静态 CSS ${r.staticCssKB}KB + JS ${r.staticJsKB}KB = ${r.totalKB}KB ｜ 懒加载 ${r.lazyCount} 个 / ${r.lazyMB}MB`);
  }
  if (problems.length) {
    console.error('\n✗ 首屏载荷超预算：');
    for (const p of problems) console.error('    ' + p);
    console.error('\n  确认是有意为之的话，跑 node scripts/size-budget.mjs --init 重写预算。');
  } else {
    console.log('\n✓ 首屏载荷在预算内');
  }
}
process.exit(problems.length ? 1 : 0);
