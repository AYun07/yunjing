#!/usr/bin/env node
/**
 * 云境 · README 更新记录同步（幂等，可反复跑）
 *
 * 从 VERSIONS.md 解析「每版做了什么」，在 README 顶部生成：
 *   1) 当前版本卡片（本版亮点 + 完整包/发布页/差异链接）
 *   2) 逐版更新记录表（最近 12 版默认展开，其余历史版本折叠）
 *
 * 用 <!-- YJ_CHANGELOG_START --> / <!-- YJ_CHANGELOG_END --> 标记包裹，
 * 以后每次发版跑一次即可，不会重复插入。
 *
 * 用法：node scripts/update-readme.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'AYun07/yunjing';
const GH = `https://github.com/${REPO}`;
const START = '<!-- YJ_CHANGELOG_START -->';
const END = '<!-- YJ_CHANGELOG_END -->';
const RECENT = 12;

const vs = fs.readFileSync(path.join(ROOT, 'VERSIONS.md'), 'utf8');
const segs = vs.split(/(?=^## v\d+\.\d+\.\d+)/m);
const rows = [];
for (const seg of segs) {
  const m = seg.match(/^## (v[\d.]+)(?:\s+`\*`)? · (\d{4}-\d{2}-\d{2})\n/);
  if (!m) continue;
  const lines = seg.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  let one = lines.find((l) => !l.startsWith('-') && !l.startsWith('[') && !l.startsWith('>') && !l.startsWith('|') && l.length > 4) || '';
  if (one.length > 110) one = one.slice(0, 110).trim() + '…';
  const bullets = lines.filter((l) => l.startsWith('- ') && !l.startsWith('- [')).map((l) => l.replace(/^- /, ''));
  rows.push({ ver: m[1], date: m[2], one, bullets });
}
if (!rows.length) throw new Error('VERSIONS.md 里没解析到版本段');

const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const links = (v) => `[zip](${GH}/archive/refs/tags/${v}.zip) · [发布页](${GH}/releases/tag/${v})`;
const table = (list) => [
  '| 版本 | 日期 | 这一版做了什么 | 完整包 / 发布页 |',
  '|---|---|---|---|',
  ...list.map((r) => `| **${r.ver}** | ${r.date} | ${esc(r.one)} | ${links(r.ver)} |`),
].join('\n');

const cur = rows[0];
const prev = rows[1] ? rows[1].ver : '';
const highlights = cur.bullets.slice(0, 7);
const recent = rows.slice(0, RECENT);
const history = rows.slice(RECENT);

const block = [
  START,
  '',
  `## 🆕 当前版本：${cur.ver}（${cur.date}）`,
  '',
  `> **${esc(cur.one)}**`,
  '',
  highlights.length ? `**这一版做了什么**\n\n${highlights.map((b) => `- ${b}`).join('\n')}\n` : '',
  `**立即获取**：[⬇ 完整包 zip](${GH}/archive/refs/tags/${cur.ver}.zip) · [📄 发布页](${GH}/releases/tag/${cur.ver})` +
    (prev ? ` · [🔍 与 ${prev} 的差异](${GH}/compare/${prev}...${cur.ver})` : '') +
    ` · [📚 全部版本](VERSIONS.md) · [🗞 更新日志](changelog/index.html)`,
  '',
  '> 本仓库是完整源码，下载 zip 解压即可运行，无需构建、无需后端。',
  '> 玩家用便宜的小参数模型也能玩：云境自带 33 界完整资料库（世界观 / 地理 / 势力 / 人物 / 境界 / 器物 / 年表 + 跨题材通用常识），按剧情检索注入，不依赖模型自身记忆。',
  '',
  `## 📋 逐版更新记录（新 → 旧，共 ${rows.length} 版）`,
  '',
  '<details open>',
  `<summary><b>最近 ${recent.length} 版</b>（默认展开，完整历史见下方折叠区）</summary>`,
  '',
  table(recent),
  '',
  '</details>',
  '',
  history.length ? [
    '<details>',
    `<summary><b>全部历史版本（${history[history.length - 1].ver} → ${history[0].ver}，共 ${history.length} 版）</b></summary>`,
    '',
    table(history),
    '',
    '</details>',
    '',
  ].join('\n') : '',
  `> 每版的完整说明、验收数据与差异对比见 [VERSIONS.md](VERSIONS.md)；本板块由 \`scripts/update-readme.mjs\` 从 VERSIONS.md 自动生成，发版跑一次即同步。`,
  '',
  END,
].filter((x) => x !== undefined).join('\n');

const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a !== -1 && b !== -1 && b > a) {
  readme = readme.slice(0, a) + block + readme.slice(b + END.length);
  console.log('已替换既有更新记录板块');
} else {
  const titleEnd = readme.indexOf('\n', readme.indexOf('# 云境'));
  readme = readme.slice(0, titleEnd + 1) + '\n' + block + '\n' + readme.slice(titleEnd + 1);
  console.log('已在标题下方插入更新记录板块');
}
fs.writeFileSync(readmePath, readme);
console.log(`当前版本 ${cur.ver} · 共 ${rows.length} 版 · 最近 ${recent.length} 版展开 / 历史 ${history.length} 版折叠`);
