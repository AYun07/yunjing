#!/usr/bin/env node
/**
 * 云境 · 版本快照工具（v5.1.5 新增）
 * ---------------------------------------------------------------------------
 * 用途：把「以后拉新版本」这件事一键做完，并留下可回看的版本文件夹。
 *
 *   1) 拉取上游最新版本（可选 --pull）
 *   2) 在本地建一个该版本的文件夹：<项目根>\versions\vX.Y.Z\
 *   3) 把该版本的**完整文件**放进去（用 git archive 取提交内容，不带 .git）
 *   4) 附一份「版本信息.txt」：版本号 / 提交 / 日期 / 与上一版差异 / 下载链接
 *
 * 目录约定（本地布局）：
 *   云境\                      ← 项目根（就是仓库本身）
 *   云境\versions\v5.1.5\     ← 每个已拉取版本的完整快照
 *
 * 用法：
 *   node scripts/snapshot-version.mjs                 # 给当前版本建快照
 *   node scripts/snapshot-version.mjs --pull          # 先 git pull 再建快照
 *   node scripts/snapshot-version.mjs --version 5.1.6 # 指定版本号
 *   node scripts/snapshot-version.mjs --list          # 列出已有快照
 *   node scripts/snapshot-version.mjs --no-media      # 快照不含 assets/videos（体积小很多）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERS_DIR = path.join(ROOT, 'versions');
const args = process.argv.slice(2);
const PULL = args.includes('--pull');
const LIST = args.includes('--list');
const verArg = args.includes('--version') ? args[args.indexOf('--version') + 1] : null;

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}
function git(args2, opts = {}) {
  return execFileSync('git', args2, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}
function say(s) { console.log(s); }

if (LIST) {
  if (!fs.existsSync(VERS_DIR)) { say('还没有任何版本快照（versions/ 目录不存在）'); process.exit(0); }
  const rows = fs.readdirSync(VERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const info = path.join(VERS_DIR, d.name, '版本信息.txt');
      let head = '';
      if (fs.existsSync(info)) {
        const t = fs.readFileSync(info, 'utf8');
        head = (t.match(/提交：(\S+)/) || [])[1] || '';
      }
      return { v: d.name, commit: head };
    })
    .sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }));
  say(`已有 ${rows.length} 个版本快照：`);
  for (const r of rows) say(`  ${r.v}${r.commit ? '  ← ' + r.commit : ''}`);
  process.exit(0);
}

/* ---------- 1. 可选：拉取上游 ---------- */
if (PULL) {
  say('· 拉取上游最新版本…');
  try {
    sh('git pull --ff-only origin main');
  } catch (e) {
    say('  拉取失败（可能有本地改动或代理不通）：' + String(e.stdout || e.message).split('\n').slice(0, 2).join(' '));
    say('  已按当前工作区继续建快照。');
  }
}

/* ---------- 2. 定位版本 ---------- */
function readVersion() {
  const s = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
  return (s.match(/window\.YJ_VER = '([\d.]+)'/) || [])[1] || null;
}
const version = verArg || readVersion();
if (!version) { say('读不到版本号（studio.html 的 YJ_VER），请用 --version 指定'); process.exit(1); }
const tag = `v${version}`;
const dest = path.join(VERS_DIR, tag);

/* ---------- 3. 取提交内容 ---------- */
/* 版本已打 tag 就以 tag 为准（tag 才是发布出去的那一份），否则用 HEAD */
let ref = 'HEAD';
try { if (git('tag', '-l', tag).trim()) ref = tag; } catch (e) {}
let commit = '';
try { commit = sh(`git rev-parse --short ${ref}`); } catch (e) {}
let commitFull = '';
try { commitFull = sh(`git rev-parse ${ref}`); } catch (e) {}
const date = new Date().toISOString().slice(0, 10);

/* 已有同名快照：不覆盖，直接报告（除非 --force） */
if (fs.existsSync(dest) && !args.includes('--force')) {
  say(`版本文件夹已存在：versions\\${tag}`);
  say('（要覆盖请加 --force；要看已有快照请用 --list）');
  process.exit(0);
}
try {
  fs.rmSync(dest, { recursive: true, force: true });
} catch (e) {
  say(`✗ 无法清空旧快照：${dest}`);
  say('  原因：' + (e && e.code === 'EPERM' ? '该目录正被占用（可能有静态服务在快照目录里跑着，或文件被打开）——请先关掉再试。' : String(e.message)));
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });

/* git archive：只导出该提交的内容，不带 .git，也不带未跟踪文件。
   仓库近 1GB（图片+视频），不能整包读进内存 —— 直接把归档流写到文件。
   用 zip 而非 tar：Windows 的 tar 遇到仓库里的中文文件名会报「Error opening archive」，
   zip + Expand-Archive 对 UTF-8 文件名稳定得多。 */
try {
  const zipPath = path.join(dest, '__snapshot.zip');
  const fd = fs.openSync(zipPath, 'w');
  const archArgs = ['archive', '--format=zip', ref];
  /* --no-media：跳过体积最大的视频素材（assets/videos），其余照常 */
  if (args.includes('--no-media')) archArgs.splice(1, 0, '--exclude=assets/videos');
  try {
    execFileSync('git', archArgs, { cwd: ROOT, stdio: ['ignore', fd, 'pipe'] });
  } finally { fs.closeSync(fd); }
  if (process.platform === 'win32') {
    sh(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${dest}' -Force"`);
  } else {
    sh(`unzip -q -o "${zipPath}" -d "${dest}"`);
  }
  fs.unlinkSync(zipPath);
} catch (e) {
  say('  git archive 失败：' + String(e.message).slice(0, 140));
  say('  改为直接复制工作区文件（不含 .git / versions）。');
  const skip = new Set(['.git', 'versions', 'node_modules']);
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    fs.cpSync(path.join(ROOT, e.name), path.join(dest, e.name), { recursive: true });
  }
}

/* ---------- 4. 版本信息 ---------- */
let prev = '';
try {
  const tags = sh('git tag --sort=-v:refname').split('\n').filter(Boolean);
  const i = tags.indexOf(tag);
  /* 上一版 = 版本号排序里紧挨着的那一个（当前版在列表里就取它下面那个） */
  prev = i >= 0 ? (tags[i + 1] || '') : (tags[1] || '');
} catch (e) {}
const info = [
  `云境 ${tag} 版本快照`,
  '',
  `版本号：${version}`,
  `提交：${commit}${commitFull ? '（' + commitFull + '）' : ''}`,
  `生成时间：${date}`,
  prev ? `上一版：${prev}` : '',
  `与上一版差异：https://github.com/AYun07/yunjing/compare/${prev || 'v0.0.0'}...${tag}`,
  `发布页：https://github.com/AYun07/yunjing/releases/tag/${tag}`,
  `源码树：https://github.com/AYun07/yunjing/tree/${tag}`,
  '',
  '本文件夹是该版本的完整可用工程，直接用浏览器打开 index.html 即可运行。',
].filter(Boolean).join('\n');
fs.writeFileSync(path.join(dest, '版本信息.txt'), info, 'utf8');

const count = (function walk(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '版本信息.txt') continue;
    if (e.isDirectory()) n += walk(path.join(d, e.name)); else n++;
  }
  return n;
})(dest);

say(`✓ 已建立版本文件夹：versions\\${tag}`);
say(`  文件 ${count} 个 ｜ 提交 ${commit} ｜ ${date}`);
say(`  说明文件：versions\\${tag}\\版本信息.txt`);
