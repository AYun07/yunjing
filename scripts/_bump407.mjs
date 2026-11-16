/* v3.99.0 版本同源（仅改文件，不做 git/网络）。复刻 release.mjs 第 1-3 步替换规则。 */
/* v3.98.0 版本同源（仅改文件，不做 git/网络）。复刻 release.mjs 第 1-3 步替换规则。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'AYun07/yunjing';
const curVer = "4.06.0";
const nextVer = process.argv[2] || "4.07.0";
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
const title = process.argv[3] || "沙盒大世界 · 动态委托 · 二十隐藏职业 · 超大世界地图";
const detailRaw = process.argv[4] || "沙盒化重构：网游大世界改为纯粹玩家自由沙盒，提供双轨玩法——「剧情路线」走失落叶网游三部曲主线章节，「沙盒路线」无强制主线；两者可随时切换，切换即刻刷新任务板|新增动态委托系统 js/rpg-quests.js：12 类委托模板（讨伐/采集/侦察/护送/悬赏/清剿/竞技/锻造/救援/夺回/军需/例行），委托由当下世界局势实时生成——每 8 回合过一天，跨日局势轮换、委托板换批，委托有时限、到期失效；推进钩子覆盖击杀、采集、抵达、竞技场胜场四条通路，在委托指定地点推进效率翻倍|世界时钟统一：剧情推进与手动结束回合都算一回合，跨 8 回合进入新的一天（此前世界日只挂在手动回合上，长程模拟 300 轮仍是第 0 日）|隐藏职业从 8 个扩到 20 个：新增 12 个全原创职业（织梦人/拾影者/观星者/逐风者/恒誓者/噬魂者/器灵师/影行者/音刃者/归墟行者/灵枢使/铸魂者），解锁条件从「只看等级」扩展为等级+声望+击杀+竞技场胜场+行会贡献五维门槛，每个分区都有专属隐藏职业|舆图重建为一整张超大世界地图：全境总览层 45 节点（一层装下三大区与中枢的全部地点），四大分区各一层放大视图，终局一层；全界节点 72 → 132，补入 22 个原创地点与 12 条原创隐藏职业设定入资料库，132 个节点全部补齐别名（详情页「亦作」可显示）|玩家势力实时上图：新增「自立门户」，玩家创建的势力写入世界实体并按驻地锚定到舆图对应位置，影响力随贡献与声望变化实时更新，离开势力则撤除据点|修复势力数据表结构缺陷：FACTION_ATLAS.wangyou 原为数组，anchors/names 取不到，导致新势力无法按位置落图；已改为对象结构（62 据点 / 132 地名 / 42 势力）|大厅维持四大分类：原著同人世界 30 界、真实地球世界 1 界、自由创作世界 6 界、网游大世界 1 界，全站 38 界";
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
