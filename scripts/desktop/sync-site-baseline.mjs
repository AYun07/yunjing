#!/usr/bin/env node
/**
 * 把仓库根的最新站点内容同步到 Electron 打包基线（build-resources/yunjing）。
 * 用于发版前刷新内置离线基线，避免"版本号升了但内置内容是旧的"假更新。
 *
 * 规则：
 * - 排除开发/构建/备份/测试快照目录与文件（与 gen-content-manifest 口径一致，另加媒体大包例外）
 * - 只覆盖"源存在"的文件；不删除基线里源没有的旧文件（保守，防误删历史素材）
 * - 复制后打印每个变更文件，并校验关键文件存在
 * 用法：node scripts/desktop/sync-site-baseline.mjs [源根] [目标基线]
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(process.argv[2] || process.cwd());
const DST = path.resolve(process.argv[3] || path.join(SRC, 'client/electron/build-resources/yunjing'));

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.codebuddy', '_bak', 'shots', 'shots-v6312', 'shots-v6314',
  'shots-v640', 'shots-v700', 'dist', 'build', 'client', 'scripts', 'tools', 'test',
  'tests', 'docs-src', '__pycache__', 'vendor', 'android-sdk'
]);
const EXCLUDE_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', '.env', '.env.local'
]);

function excluded(rel) {
  const parts = rel.split(/[\\/]/);
  for (const p of parts) {
    const lp = p.toLowerCase();
    if (EXCLUDE_DIRS.has(p) || EXCLUDE_DIRS.has(lp)) return true;
    if (lp.startsWith('_bak') || lp.startsWith('shots')) return true;
  }
  const base = path.basename(rel);
  if (EXCLUDE_FILES.has(base)) return true;
  if (/\.log$/i.test(base)) return true;
  if (/\.(apk|zip|7z|exe|dmg)$/i.test(base)) return true;
  return false;
}

let copied = 0, skipped = 0, bytes = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(SRC, abs).split(path.sep).join('/');
    if (excluded(rel)) { skipped++; continue; }
    if (ent.isDirectory()) { walk(abs); continue; }
    if (ent.isSymbolicLink()) { skipped++; continue; }
    const dst = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const st = fs.statSync(abs);
    fs.copyFileSync(abs, dst);
    fs.utimesSync(dst, st.atime, st.mtime);
    copied++; bytes += st.size;
  }
}

console.log('源:', SRC);
console.log('目标:', DST);
walk(SRC);
console.log(`复制 ${copied} 个文件（${(bytes / 1024 / 1024).toFixed(1)}MB），跳过 ${skipped} 项`);

// 关键文件校验
const CRITICAL = [
  'index.html', 'opening.html', 'studio.html', 'settings.html', 'xiaoyun.html', 'sw.js',
  'release-notes.json', 'content-manifest.json', 'manifest.webmanifest',
  'js/config-modal.js', 'js/status-skins.js', 'js/desktop-shell.js', 'css/occlusion-fix.css'
];
let bad = 0;
for (const f of CRITICAL) {
  if (!fs.existsSync(path.join(DST, f))) { console.error('✗ 关键文件缺失: ' + f); bad++; }
}
if (bad) { console.error(`基线校验失败：${bad} 个关键文件缺失`); process.exit(1); }
const sw = fs.readFileSync(path.join(DST, 'sw.js'), 'utf8').match(/SW_VER = '([^']+)'/);
const mf = JSON.parse(fs.readFileSync(path.join(DST, 'content-manifest.json'), 'utf8'));
console.log('✓ 基线 SW_VER:', sw ? sw[1] : '?');
console.log('✓ 基线 content-manifest version:', mf.version);
console.log('✅ 基线同步完成');
