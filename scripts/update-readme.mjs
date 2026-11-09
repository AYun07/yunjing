#!/usr/bin/env node
/**
 * 云境 · README 当前版本卡片同步（幂等，可反复跑）
 *
 * 口径（v4.12.1 起）：主页 README 只介绍项目本身（致敬 / 特色 / 大致介绍 / 能做什么），
 * **不再展开任何版本列表或历史沿革**。逐版「做了什么」与「相比上一版的变化」
 * 统一由 VERSIONS.md（GitHub 版本页）与 changelog/index.html（产品内创作日志）维护。
 *
 * 本脚本只从 VERSIONS.md 读当前版本，在 README 的
 *   <!-- YJ_CHANGELOG_START --> / <!-- YJ_CHANGELOG_END -->
 * 之间生成一张极简「当前版本」卡片 + 去版本页的导航链接。
 * 每次发版跑一次即可，不会重复插入，也不会把 85 版清单灌回主页。
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

const vs = fs.readFileSync(path.join(ROOT, 'VERSIONS.md'), 'utf8');
const segs = vs.split(/(?=^## v\d+\.\d+\.\d+)/m);
const rows = [];
for (const seg of segs) {
  const m = seg.match(/^## (v[\d.]+)(?:\s+`\*`)?\s*·\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) continue;
  const lines = seg.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  let one = lines.find((l) =>
    !l.startsWith('-') && !l.startsWith('[') && !l.startsWith('>') && !l.startsWith('|') &&
    l !== '**本版做了什么**' && l.length > 4) || '';
  one = one.replace(/\*\*/g, '').replace(/`/g, '');
  if (one.length > 110) one = one.slice(0, 110).trim() + '…';
  rows.push({ ver: m[1], date: m[2], one });
}
if (!rows.length) throw new Error('VERSIONS.md 里没解析到版本段');

const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const cur = rows[0];
const prev = rows[1] ? rows[1].ver : '';
const links = `[zip](${GH}/archive/refs/tags/${cur.ver}.zip) · [发布页](${GH}/releases/tag/${cur.ver})`;

const block = [
  START,
  '',
  `## 🆕 当前版本：${cur.ver}（${cur.date} · 唯一当前版）`,
  '',
  '| 版本 | 日期 | 状态 | 这一版做了什么 | 完整包 / 发布页 |',
  '|---|---|---|---|---|',
  `| **${cur.ver}** | ${cur.date} | **当前** | ${esc(cur.one)} | ${links} |`,
  '',
  `**看版本**：[📚 版本页（${rows.length} 版 · 最新版永远在最上方 · 每版含「做了什么」与「和上一版的区别」)](VERSIONS.md)` +
    ` · [🗞 产品内创作日志](changelog/index.html)` +
    (prev ? ` · [🔍 与 ${prev} 的差异](${GH}/compare/${prev}...${cur.ver})` : '') +
    ` · [📄 发布页](${GH}/releases/tag/${cur.ver})`,
  '',
  '> 逐版沿革、历史功能说明与验收数据统一由 [VERSIONS.md](VERSIONS.md) 维护；本板块由 `scripts/update-readme.mjs` 自动生成，**主页不再展开版本列表**。新增版本请插到 VERSIONS.md 最上方。',
  '',
  END,
].join('\n');

const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a !== -1 && b !== -1 && b > a) {
  readme = readme.slice(0, a) + block + readme.slice(b + END.length);
  console.log('已替换既有当前版本卡片');
} else {
  const titleEnd = readme.indexOf('\n', readme.indexOf('# 云境'));
  readme = readme.slice(0, titleEnd + 1) + '\n' + block + '\n' + readme.slice(titleEnd + 1);
  console.log('已在标题下方插入当前版本卡片');
}
fs.writeFileSync(readmePath, readme);
console.log(`当前版本 ${cur.ver} · 共 ${rows.length} 版 · 主页保持精简（版本沿革全部在 VERSIONS.md）`);
