#!/usr/bin/env node
/**
 * 云境 · 一次成型发版
 *
 * 一条命令做完：改版本号 → 全量资源参数对齐 → 写更新日志 → 写版本登记 → 提交打标签推送 → 建 GitHub Release（自动带完整包）
 *
 * 用法：
 *   GITHUB_TOKEN=xxx node scripts/release.mjs 3.88.0 "一句话标题" "详细说明，可多段用 | 分隔" [--dry]
 *
 * 前置：工作区干净（先提交你的改动），当前分支为 main。
 * 产物：https://github.com/AYun07/yunjing/releases/tag/v3.88.0
 *      其中 Assets 的 Source code (zip) 即该版本 100% 完整内容包。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.GITHUB_REPO || 'AYun07/yunjing';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const [nextVer, title, detailRaw] = args.filter((a) => a !== '--dry');
if (!nextVer || !/^\d+\.\d+\.\d+$/.test(nextVer)) {
  console.error('用法：node scripts/release.mjs 3.88.0 "标题" "说明" [--dry]');
  process.exit(1);
}
const sh = (c, opts = {}) => execSync(c, { cwd: ROOT, stdio: 'inherit', ...opts });
const shq = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' }).trim();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const today = new Date().toISOString().slice(0, 10);

/* ---------- 0. 环境检查 ---------- */
if (!DRY && shq('git status --porcelain')) {
  console.error('工作区不干净，请先提交改动再发版。');
  process.exit(1);
}
const curVer = (read('studio.html').match(/window\.YJ_VER = '([\d.]+)'/) || [])[1];
if (!curVer) { console.error('读不到当前版本号'); process.exit(1); }
const cmp = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
if (cmp(nextVer, curVer) <= 0) {
  console.error(`新版本号 ${nextVer} 必须大于当前 ${curVer}`);
  process.exit(1);
}
const detail = (detailRaw || '').split('|').map((s) => s.trim()).filter(Boolean);
const tag = `v${nextVer}`;

/* ---------- 1. 版本号与资源参数 ---------- */
const touched = [];
function sub(file, re, rep) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8');
  const n = s.replace(re, rep);
  if (n !== s) { fs.writeFileSync(p, n); touched.push(file); }
}
const esc = curVer.replace(/\./g, '\\.');
for (const f of fs.readdirSync(ROOT).filter((f) => /\.(html)$/.test(f))) {
  sub(f, new RegExp(`\\?v=${esc}`, 'g'), `?v=${nextVer}`);
  sub(f, new RegExp(`云境 v${esc}`, 'g'), `云境 v${nextVer}`);
}
// js 里写死的资源参数
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) {
  sub(path.join('js', f), new RegExp(`\\?v=${esc}`, 'g'), `?v=${nextVer}`);
}
sub('studio.html', /window\.YJ_VER = '[\d.]+'/g, `window.YJ_VER = '${nextVer}'`);
sub('index.html', /window\.YJ_VER = '[\d.]+'/g, `window.YJ_VER = '${nextVer}'`);
sub('sw.js', /const SW_VER = 'yunjing-v[\d.]+'/g, `const SW_VER = 'yunjing-v${nextVer}'`);

/* ---------- 2. 更新日志（changelog/index.html） ---------- */
const cl = read('changelog/index.html');
const anchor = '<!-- ==================== 版本条目（新→旧） ==================== -->';
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entry = `${anchor}

        <article class="log-entry" data-tags="版本 发布" style="--entry-hue:#5a6ac0;">
            <div class="entry-head">
                <span class="entry-ver">v${nextVer}</span>
                <span class="entry-date">${today}</span>
            </div>
            <h3 class="entry-title">${escHtml(title || `v${nextVer}`)}</h3>
            <p class="entry-text">${escHtml(detail.join(' ')) || escHtml(title || '')}</p>
        </article>`;
if (cl.includes(anchor)) { write('changelog/index.html', cl.replace(anchor, entry)); touched.push('changelog/index.html'); }

/* ---------- 3. 版本登记（VERSIONS.md） ---------- */
const vs = read('VERSIONS.md');
const firstH2 = vs.search(/^## v/m);
if (firstH2 > -1) {
  const block = `## ${tag} · ${today}

${detail.join('\n\n') || title || ''}

- [📂 该版文件（完整快照）](https://github.com/${REPO}/tree/${tag})  [🔍 与 v${curVer} 差异](https://github.com/${REPO}/compare/v${curVer}...${tag})  [⬇ 完整包 zip](https://github.com/${REPO}/archive/refs/tags/${tag}.zip)

`;
  let head = vs.slice(0, firstH2);
  head = head.replace(/从 `v[\d.]+` 到 `v[\d.]+`/, (m) => m.replace(/到 `v[\d.]+`/, `到 \`${tag}\``));
  head = head.replace(/共 \*\*\d+\*\* 个版本/, (m) => m.replace(/\d+/, String(Number(m.match(/\d+/)[0]) + 1)));
  write('VERSIONS.md', head + block + vs.slice(firstH2));
  touched.push('VERSIONS.md');
}

console.log(`版本号 ${curVer} → ${nextVer}，改动文件 ${[...new Set(touched)].length} 个`);
if (DRY) { console.log('[dry] 到此为止，未提交未推送'); process.exit(0); }

/* ---------- 4. 提交 / 打标签 / 推送 ---------- */
sh('git add -A');
sh(`git commit -q -m "release: v${nextVer} ${(title || '').replace(/"/g, "'")}"`);
sh(`git tag -f ${tag}`);
const remote = TOKEN ? `https://x-access-token:${TOKEN}@github.com/${REPO}.git` : 'origin';
sh(`git push "${remote}" HEAD:main`);
sh(`git push "${remote}" refs/tags/${tag} --force`);
console.log(`已推送 ${tag}`);

/* ---------- 5. GitHub Release（自动携带完整包） ---------- */
if (!TOKEN) { console.log('未提供 GITHUB_TOKEN，跳过建发布；补建可跑 scripts/sync-releases.mjs'); process.exit(0); }
const body = [
  detail.join('\n\n') || title || '',
  '',
  '---',
  '',
  '**完整内容包**：本页 Assets 里的 `Source code (zip)` 即该版本全部文件，下载解压即是一份可直接运行的完整工程。',
  '',
  `**与上一版差异**：https://github.com/${REPO}/compare/v${curVer}...${tag}`,
  '',
  `**在线预览该版源码**：https://github.com/${REPO}/tree/${tag}`,
].join('\n');
const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ tag_name: tag, name: `云境 ${tag}`, body, draft: false, prerelease: false, make_latest: 'true' }),
});
const ok = res.ok;
console.log(ok ? `发布已创建：https://github.com/${REPO}/releases/tag/${tag}` : `建发布失败：${res.status} ${await res.text()}`);
console.log(`完整包直链：https://github.com/${REPO}/archive/refs/tags/${tag}.zip`);
