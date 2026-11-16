#!/usr/bin/env node
/* v3.98.0 版本同源（仅改文件，不做 git/网络）。复刻 release.mjs 第 1-3 步替换规则。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'AYun07/yunjing';
const curVer = '3.98.0';
const nextVer = process.argv[2] || '3.98.0';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

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
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) {
  sub(path.join('js', f), new RegExp(`\\?v=${esc}`, 'g'), `?v=${nextVer}`);
}
sub('studio.html', /window\.YJ_VER = '[\d.]+'/g, `window.YJ_VER = '${nextVer}'`);
sub('index.html', /window\.YJ_VER = '[\d.]+'/g, `window.YJ_VER = '${nextVer}'`);
sub('sw.js', /const SW_VER = 'yunjing-v[\d.]+'/g, `const SW_VER = 'yunjing-v${nextVer}'`);
sub('index.html', /(id="verBadge"[^>]*>)v[\d.]+( 云境版<\/a>)/g, `$1v${nextVer}$2`);
sub('studio.html', /(id="verDot"[^>]*>)v[\d.]+(<\/span>)/g, `$1v${nextVer}$2`);
sub('QUICKSTART.txt', /云境工坊 v[\d.]+ · 使用说明/g, `云境工坊 v${nextVer} · 使用说明`);
sub(path.join('changelog', 'index.html'), /\?v=[\d.]+/g, `?v=${nextVer}`);
sub('selftest.html', /const ENGINE_VER = '[\d.]+'/g, `const ENGINE_VER = '${nextVer}'`);

/* changelog 条目 */
const title = process.argv[3] || '天蚕土豆宇宙 · 四界拆分与同宇宙联动';
const detailRaw = process.argv[4] || '把《大主宰》从斗破续作段拆为独立世界，新增武动乾坤/大主宰/元尊/万相之王四界（全站共 37 界）；五界以大千世界宇宙联动，斗罗大陆一至五部按时代分层联动；四界专属舆图、主题皮肤、知识库（合计 21928 条）与战斗/主线/阶段注册全部就位。';
const detail = detailRaw.split('|').map((s) => s.trim()).filter(Boolean);
const cl = read('changelog/index.html');
const anchor = '<!-- ==================== 版本条目（新→旧） ==================== -->';
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entry = `${anchor}

        <article class="log-entry" data-tags="版本 发布" style="--entry-hue:#5a6ac0;">
            <div class="entry-head">
                <span class="entry-ver">v${nextVer}</span>
                <span class="entry-date">${today}</span>
            </div>
            <h3 class="entry-title">${escHtml(title)}</h3>
            <p class="entry-text">${escHtml(detail.join(' '))}</p>
        </article>`;
if (cl.includes(anchor)) { write('changelog/index.html', cl.replace(anchor, entry)); touched.push('changelog/index.html'); }

/* VERSIONS.md */
const tag = `v${nextVer}`;
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
  head = head.replace(
    /(\| 版本 \| 日期 \| 完整包（zip） \| 发布页 \|\n\|[-| ]+\|\n)/m,
    `$1| **${tag}** | ${today} | [下载](https://github.com/${REPO}/archive/refs/tags/${tag}.zip) | [查看](https://github.com/${REPO}/releases/tag/${tag}) |\n`
  );
  write('VERSIONS.md', head + block + vs.slice(firstH2));
  touched.push('VERSIONS.md');
}

/* README 同源 */
const readme = read('README.md');
let rm = readme.replace(/## 🆕 当前版本：v[\d.]+（[\d-]+）/, `## 🆕 当前版本：v${nextVer}（${today}）`);
const rmRow = `| **v${nextVer}** | ${today} | ${escHtml(detail.join(' '))} | [zip](https://github.com/${REPO}/archive/refs/tags/v${nextVer}.zip) · [发布页](https://github.com/${REPO}/releases/tag/v${nextVer}) |`;
const m = rm.match(/(\| \*\*v[\d.]+\*\* \| [\d-]+ \|.*\n)/);
if (m) { rm = rm.replace(m[1], m[1] + rmRow + '\n'); touched.push('README.md'); }
write('README.md', rm);

console.log(`版本号 ${curVer} → ${nextVer}，改动文件 ${[...new Set(touched)].length} 个`);
