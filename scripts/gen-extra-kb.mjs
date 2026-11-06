#!/usr/bin/env node
/**
 * 云境 v3.98.0 · 扩展资料库合并（幂等，可反复跑）
 *
 * 背景：build-codex.mjs 从 config 的 `##` / `【】` 段抽取条目，抽多少取决于 config 写多细。
 *       新界往往只有 100 出头条，而老界在 550–800 条。资料库薄了，便宜小模型就只能靠自己的
 *       记忆瞎编。本脚本把 scripts/kb-extra/<genre>.json 里的原著百科条目合并进
 *       js/kb/<genre>.ext.js 的 YJ_EXTRA 段（标记包裹，重跑只替换不叠加）。
 *
 * 为什么不写进 config：config 的 fullSystemPrompt 是要整段塞进上下文的，扩到 500 条会撑爆
 *       小模型窗口；ext.js 走检索注入（BM25 命中才给），所以细粒度百科放这里更划算。
 *
 * 用法：node scripts/gen-extra-kb.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB_DIR = path.join(ROOT, 'js', 'kb');
const SRC_DIR = path.join(ROOT, 'scripts', 'kb-extra');
const START = '/* YJ_EXTRA_START */';
const END = '/* YJ_EXTRA_END */';
const VER = '3.98.0';

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.json')).sort();
if (!files.length) {
  console.log('scripts/kb-extra/ 下没有 json，跳过');
  process.exit(0);
}

let grand = 0;
const report = [];

for (const f of files) {
  const g = f.replace(/\.json$/, '');
  const extPath = path.join(KB_DIR, `${g}.ext.js`);
  if (!fs.existsSync(extPath)) {
    console.log(`✗ ${g}: ext.js 不存在，跳过`);
    continue;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
  } catch (e) {
    console.log(`✗ ${g}: json 解析失败 — ${e.message}`);
    continue;
  }
  if (!Array.isArray(raw)) raw = raw.items || [];

  /* 规范化 + 去重 + 去噪 */
  const seen = new Set();
  const items = [];
  let dropped = 0;
  for (const it of raw) {
    const title = String(it.title || it.t || '').trim();
    const content = String(it.content || it.c || '').trim().replace(/\s+/g, ' ');
    if (!title || content.length < 12) { dropped++; continue; }
    if (seen.has(title)) { dropped++; continue; }
    seen.add(title);
    const category = String(it.category || it.cat || '原著百科').trim();
    let tags = it.tags || it.g || [];
    if (typeof tags === 'string') tags = tags.split(/[,，\s]+/);
    tags = [...new Set([g, category, ...tags.filter(Boolean)])].slice(0, 8);
    items.push({
      title,
      content: content.length > 900 ? content.slice(0, 900) + '…' : content,
      category,
      tags,
      alwaysInclude: false,
      priority: '',
    });
  }

  const block =
    `${START}\n` +
    `/* 云境 v${VER} · ${g} 扩展资料库（原著百科 ${items.length} 条，由 scripts/gen-extra-kb.mjs 从 scripts/kb-extra/${g}.json 生成，勿手改本段）\n` +
    ` * 与 YJ_CODEX 段互补：YJ_CODEX 来自 config 的章节抽取，本段为逐项原著百科（人物/势力/地理/境界/功法器物/事件/专项设定）。 */\n` +
    `(function(){\n` +
    `  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});\n` +
    `  var a = KB[${JSON.stringify(g)}] || (KB[${JSON.stringify(g)}] = []);\n` +
    `  var add = ${JSON.stringify(items)};\n` +
    `  if (add && add.length) for (var i = 0; i < add.length; i++) a.push(add[i]);\n` +
    `})();\n` +
    `${END}`;

  let src = fs.readFileSync(extPath, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i !== -1 && j > i) {
    src = src.slice(0, i) + block + src.slice(j + END.length);
  } else {
    src = src.replace(/\s*$/, '\n\n') + block + '\n';
  }
  fs.writeFileSync(extPath, src);
  grand += items.length;
  report.push({ g, n: items.length, dropped });
}

report.sort((a, b) => b.n - a.n);
report.forEach((r) => console.log(`  ${r.g.padEnd(20)} +${String(r.n).padStart(4)} 条${r.dropped ? `（去重/过短丢弃 ${r.dropped}）` : ''}`));
console.log(`\n合计合并 ${grand} 条，覆盖 ${report.length} 界`);
