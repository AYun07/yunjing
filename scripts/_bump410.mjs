/* v3.99.0 版本同源（仅改文件，不做 git/网络）。复刻 release.mjs 第 1-3 步替换规则。 */
/* v3.98.0 版本同源（仅改文件，不做 git/网络）。复刻 release.mjs 第 1-3 步替换规则。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'AYun07/yunjing';
const curVer = "4.00.1";
const nextVer = process.argv[2] || "4.01.0";
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
const title = process.argv[3] || '舆图重绘 · 专名铁律 · 三档模型预算';
const detailRaw = process.argv[4] || '舆图引擎重写：地形改为纹样铺陈＋多变体笔触，城池/宗门/秘境图标重绘，地名加引线标注与越界回拉，疆域做圆填充松弛与自动铺满，补录节点用力导向摊平——斗罗 11 片疆域不再互相穿插，单层可见地名从 7 个增至 30+|新增 35 界专名铁律表（2011 条人物/地名/势力/功法/境界链），作为最高优先级段注入，专门治小模型把「萧炎」写错、把「斗宗」跳「斗帝」、给原著不存在宗门编名字|低配档按上下文分三档：8K 模型请求体 7487→3915 字符、输出上限锁 1400，16K 档 7151，都留足输出空间；低配档不再砍掉生图与沉浸，改用 70 字精简协议|高配档历史窗口按窗口放开：32K→20 轮、64K→28 轮、128K→40 轮（原固定 16 轮），长线「过完一生」接得住；知识库前景预算上限 24000 字符|补录落位改为「描述命中区域→名称命中→哈希分摊」，斗破 38 条补录不再全堆在乌坦城一角';
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
