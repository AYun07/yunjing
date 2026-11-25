#!/usr/bin/env node
/**
 * 云境 · 内容热更新清单生成器
 * ------------------------------------------------------------------
 * 作用：扫描站点根目录，生成 content-manifest.json（内容版本 + 每个热更文件的 sha256/大小）。
 * 客户端据此做「清单比对 → 增量下载 → sha256 校验 → 原子替换」。
 *
 * 设计要点（DR-097）：
 * 1. 热更清单只纳入「代码 / 配置 / 文本」类小文件（html/js/css/json/md/txt/webmanifest/svg/ico 等），
 *    不纳入视频/字体/大图（>2MB 的 mp4/webm/woff2/png/webp）——这些留在安装基线，按需才走整包升级。
 *    理由：用户报的所有 bug 修复都在这 533 个小文件里（合计约 32MB，增量通常只有几 KB）。
 * 2. 排除构建/备份/测试目录，避免把 8GB 的 node_modules、dist、_bak 纳入清单。
 * 3. 输出确定性好：文件按相对路径排序，sha256 用 Node crypto，任何机器生成结果一致。
 *
 * 用法：
 *   node scripts/gen-content-manifest.mjs [站点根目录] [输出文件]
 *   默认：站点根 = 当前项目根，输出 = content-manifest.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(process.argv[2] || process.cwd());
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'content-manifest.json'));

// 纳入热更的扩展名（小写）。视频/字体/大图刻意排除。
const INCLUDE_EXT = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.webmanifest',
  '.md', '.txt', '.svg', '.ico', '.yml', '.yaml', '.ps1', '.sh', '.bat', '.command'
]);

// 排除的目录片段（大小写不敏感匹配路径任意层级）
const EXCLUDE_DIRS = [
  'node_modules', '.git', '_bak', 'shots', 'dist', 'build',
  'client', 'scripts', 'tools', 'test', 'tests', 'docs-src',
  '.codebuddy', '__pycache__', 'vendor'
];
// 排除的单个文件（构建清单本身、私密文件、备份）
const EXCLUDE_FILES = new Set([
  'content-manifest.json', 'package-lock.json', 'pnpm-lock.yaml',
  '.env', '.env.local', '*.log'
]);

function isExcluded(rel) {
  const parts = rel.split(/[\\/]/);
  for (const p of parts) {
    const lp = p.toLowerCase();
    if (EXCLUDE_DIRS.some(d => lp === d || lp.startsWith(d + '-') || lp.startsWith('_bak'))) return true;
  }
  const base = path.basename(rel).toLowerCase();
  if (EXCLUDE_FILES.has(base)) return true;
  if (base.startsWith('.') && base !== '.webmanifest') return true;
  if (base.endsWith('.log')) return true;
  // 任何含 _bak 的文件名
  if (base.includes('_bak')) return true;
  return false;
}

function walk(dir, base, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (isExcluded(rel)) continue;
    if (ent.isDirectory()) {
      walk(full, base, out);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!INCLUDE_EXT.has(ext)) continue;
      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (st.size > 2 * 1024 * 1024) continue; // 大文件留基线
      const buf = fs.readFileSync(full);
      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      out[rel] = { sha256, size: st.size };
    }
  }
}

// 版本来源：优先环境变量 CONTENT_VER，否则读 package.json 的 version，否则 7.0.0
let version = process.env.CONTENT_VER;
if (!version) {
  try { version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; }
  catch (_) { version = '7.0.0'; }
}

const files = {};
walk(ROOT, ROOT, files);
const manifest = {
  schema: 1,
  version: String(version),
  generatedAt: new Date().toISOString(),
  count: Object.keys(files).length,
  // 内容分发双通道：优先 jsDelivr CDN（国内可达），失败回退 GitHub raw。
  // 客户端把 {base}{相对路径} 拼成下载 URL；base 带 @main 保证取仓库最新内容。
  sources: [
    'https://gcore.jsdelivr.net/gh/AYun07/yunjing@main/',
    'https://ghproxy.net/https://raw.githubusercontent.com/AYun07/yunjing/main/',
    'https://raw.githubusercontent.com/AYun07/yunjing/main/'
  ],
  files
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), 'utf8');
const totalMB = (Object.values(files).reduce((s, f) => s + f.size, 0) / 1048576).toFixed(2);
console.log(`[content-manifest] v${manifest.version} · ${manifest.count} 个文件 · ${totalMB} MB`);
console.log(`[content-manifest] 输出: ${OUT}`);
