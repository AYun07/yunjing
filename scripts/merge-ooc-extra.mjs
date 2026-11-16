#!/usr/bin/env node
/**
 * v3.99.0 为 31 个世界补「OOC 红线清单」常驻条目
 *
 * 为什么需要：玩家多用便宜的小参数模型，模型不会自己去拼接分散在多处的规则。
 * core.js 里本来就有「开放世界主持要点」「主角替代协议」，但它们是分散的，
 * 小模型注意力有限，读不到就等于没有。这份清单把「本界最容易写错的 N 件事」
 * 集中成一条，标 alwaysInclude:true，每轮必在场。
 *
 * 合并方式：在每界 core.js 的数组末尾（`  ];` 之前）追加一行条目，
 * 不改动任何既有条目。幂等：已经存在同名条目就跳过。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/workspace/yunjing';
const KB_DIR = path.join(ROOT, 'js/kb');
const FILES = ['batch1.json', 'batch2.json', 'batch3.json'];

const all = {};
for (const f of FILES) {
  const p = path.join(ROOT, 'scripts/ooc-extra', f);
  if (!fs.existsSync(p)) {
    console.log(`缺少 ${f}，跳过`);
    continue;
  }
  Object.assign(all, JSON.parse(fs.readFileSync(p, 'utf8')));
}

let added = 0;
let skipped = 0;
const missing = [];

for (const [g, item] of Object.entries(all)) {
  const p = path.join(KB_DIR, `${g}.core.js`);
  if (!fs.existsSync(p)) {
    missing.push(g);
    continue;
  }
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('OOC红线清单')) {
    skipped += 1;
    continue;
  }
  /* 组装条目行：与文件既有风格一致（单行 JSON） */
  const entry = {
    title: item.title,
    content: item.content,
    category: item.category || '规则',
    tags: item.tags || ['OOC', '原著忠实'],
    alwaysInclude: true,
    priority: 'high'
  };
  const line = JSON.stringify(entry);
  /* 各界的数组结尾写法不统一：
     老界是 `...}];\n  window.__KB_SPLIT_OK__ = true;`（整个数组写在一行）
     新界是 `...},\n  ];\n})();`（每行一个条目）
     统一用「最后一个 ] 且其后紧跟 ;」作锚点，在它前面插一条。 */
  const i = src.lastIndexOf(']');
  if (i === -1 || src[i + 1] !== ';') {
    console.log(`${g}: 找不到数组结尾（最后一个 ] 后不是 ;），跳过`);
    missing.push(g);
    continue;
  }
  const head = src.slice(0, i).trimEnd();
  const needComma = head.endsWith('}');
  const out = head + (needComma ? ',' : '') + line + src.slice(i);
  /* 校验语法 */
  try {
    new Function(out);
  } catch (e) {
    console.log(`${g}: 合并后语法错误（${e.message}），已跳过`);
    missing.push(g);
    continue;
  }
  fs.writeFileSync(p, out);
  added += 1;
}

console.log(`合并完成：新增 ${added} 界，跳过已存在 ${skipped} 界`);
if (missing.length) console.log('未处理：', missing.join(', '));

/* 复核：每界 now 有多少条、常驻多少条多少字 */
import vm from 'node:vm';
const idx = JSON.parse(fs.readFileSync(path.join(KB_DIR, '_index.json'), 'utf8')).genres;
let over = [];
for (const g of Object.keys(idx)) {
  const p = path.join(KB_DIR, `${g}.core.js`);
  if (!fs.existsSync(p)) continue;
  const w = {};
  w.addEventListener = function () {};
  try {
    vm.runInNewContext(fs.readFileSync(p, 'utf8'), { window: w, console, document: {}, localStorage: { getItem: () => null, setItem() {} } }, { filename: g });
  } catch (e) {
    over.push(g + '(载入失败)');
    continue;
  }
  const arr = (w.KB_PRESETS || {})[g] || [];
  const al = arr.filter((x) => x.alwaysInclude === true);
  const chars = al.reduce((s, x) => s + String(x.content || '').length, 0);
  if (chars > 9000) over.push(`${g}(${chars}字)`);
}
console.log('常驻超 9000 字的界：', over.length ? over.join(', ') : '无');
