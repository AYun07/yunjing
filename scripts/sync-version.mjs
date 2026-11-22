#!/usr/bin/env node
/* 云境 · 版本号单一来源同步器（v4.17.0）
 *
 * 为什么有它
 *   此前「一个版本号」要手工改到 33 个文件 / 258 处（studio.html 里光 ?v= 就有 150 处）。
 *   单一事实被复制几百份，**必然漏改** —— 本项目实际发生过：
 *     · QUICKSTART.txt 的版本号漏改（.txt 不在替换白名单里，142 处）
 *     · changelog / VERSIONS 的历史版本号被脚本误改（用全局 split/join 的后果）
 *     · v4.13.0 / v4.14.0 / v4.15.0 漏打 git tag 与 Release（发版步骤多、无兜底）
 *   现在把「版本号」收敛成**唯一来源**，其余全部由本脚本派生。
 *
 * 唯一来源
 *   studio.html 里的 `window.YJ_VER = 'x.y.z'`（沿用作者既有约定）
 *
 * 用法
 *   node scripts/sync-version.mjs            # 同步（把各处改成当前版本）
 *   node scripts/sync-version.mjs --check     # 只校验不修改；有不一致则退出码 1（CI 用）
 *   node scripts/sync-version.mjs --set 4.18.0  # 先改版本号再同步
 *
 * 覆盖的锚点
 *   · 静态资源引用   ?v=<版本>（全部 html/js/sw.js/tools）
 *   · sw.js          SW_VER = 'yunjing-v<版本>'
 *   · 页面标题        <title>云境 v<版本> · …</title>
 *   · 版本徽标        studio.html 的 verDot、index.html 的 verBadge（由 YJ_VER 驱动，无需改文本）
 *   · selftest.html  ENGINE_VER
 *   · QUICKSTART.txt 抬头「云境工坊 v<版本>」
 *   · VERSIONS.md    「到 `v<版本>`」「版本分层（v<版本> 口径）」「首行 **v<版本> 为当前版本**」
 *                    「当前口径（v<版本>）」与版本计数（总数 / 旧版本数）
 *   · changelog      仅当前版本条目与其资源引用；**历史条目绝不触碰**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const si = process.argv.indexOf('--set');
const SET_TO = si >= 0 ? process.argv[si + 1] : null;

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------- 1. 读唯一来源 ---------- */
if (SET_TO) {
  if (!/^\d+\.\d+\.\d+$/.test(SET_TO)) { console.error('版本号格式应为 x.y.z'); process.exit(2); }
  const sh = read('studio.html');
  const cur = (sh.match(/window\.YJ_VER = '([\d.]+)'/) || [])[1];
  if (!cur) { console.error('读不到 studio.html 的 YJ_VER'); process.exit(2); }
  write('studio.html', sh.replace(new RegExp(`window\\.YJ_VER = '${cur.replace(/\./g, '\\.')}'`), `window.YJ_VER = '${SET_TO}'`));
  console.log(`版本号：${cur} → ${SET_TO}`);
}
const VER = (read('studio.html').match(/window\.YJ_VER = '([\d.]+)'/) || [])[1];
if (!VER) { console.error('读不到 studio.html 的 window.YJ_VER'); process.exit(2); }
console.log(`唯一来源 studio.html window.YJ_VER = ${VER}`);

const problems = [];
const changes = [];
function fix(rel, transform, desc) {
  if (!exists(rel)) return;
  const before = read(rel);
  const after = transform(before);
  if (after === before) return;
  if (CHECK) problems.push(`${rel} —— ${desc}`);
  else { write(rel, after); changes.push(`${rel} —— ${desc}`); }
}
const esc = (v) => v.replace(/\./g, '\\.');

/* ---------- 2. 静态资源引用 ?v=（功能范围内全量扫描，与 t_version_sync.cjs 同口径）----------
   范围：仓库内所有 .html/.js/.mjs，排除 node_modules、.git、libs、changelog、
   yunjing-test、_shots_v398、_shots_v399、scripts、test、releases
   （changelog 单独处理，因为它只该同步自己的 CSS 引用）。 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'libs', 'yunjing-test',
  '_shots_v398', '_shots_v399', 'scripts', 'test', 'releases', '_ai-artifacts']);
function walkAssets(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (e.isDirectory()) { walkAssets(abs, out); continue; }
    if (!/\.(html|js|mjs)$/.test(e.name)) continue;
    out.push(rel);
  }
  return out;
}
const assetFiles = walkAssets(ROOT, []).filter((r) => !r.startsWith('changelog/'));
for (const rel of assetFiles) {
  fix(rel, (s) => s.replace(/\?v=[\d.]+/g, `?v=${VER}`), `静态资源引用 ?v= → ${VER}`);
}
/* changelog 自带一份 CSS 引用，也要同步（但历史条目的正文版本号绝不动） */
fix('changelog/index.html', (s) => s.replace(/\?v=[\d.]+/g, `?v=${VER}`), `changelog 资源引用 ?v= → ${VER}`);

/* ---------- 3. sw.js 缓存版本 ---------- */
fix('sw.js', (s) => s.replace(/const SW_VER = 'yunjing-v[\d.]+'/, `const SW_VER = 'yunjing-v${VER}'`), 'SW_VER');
fix('sw.js', (s) => s.replace(/const SW_VER = "yunjing-v[\d.]+"/, `const SW_VER = "yunjing-v${VER}"`), 'SW_VER(双引号)');

/* ---------- 4. 页面标题 ---------- */
fix('index.html', (s) => s.replace(/<title>云境 v[\d.]+ ·/, `<title>云境 v${VER} ·`), '<title>');
fix('studio.html', (s) => s.replace(/<title>云境 v[\d.]+ ·/, `<title>云境 v${VER} ·`), '<title>');
fix('changelog/index.html', (s) => s.replace(/<title>([^<]*?)v[\d.]+([^<]*?)<\/title>/, (m, a, b) => `<title>${a}v${VER}${b}</title>`), '<title>');

/* ---------- 5. 其它锚点 ---------- */
fix('studio.html', (s) => s.replace(/(id="verDot"[^>]*>)v[\d.]+</, `$1v${VER}<`), 'verDot 徽标文本');
fix('selftest.html', (s) => s.replace(/ENGINE_VER\s*=\s*['"][\d.]+['"]/, `ENGINE_VER = '${VER}'`), 'ENGINE_VER');
fix('QUICKSTART.txt', (s) => s.replace(/云境工坊 v[\d.]+/, `云境工坊 v${VER}`), 'QUICKSTART 抬头');
fix('index.html', (s) => s.replace(/window\.YJ_VER = '[\d.]+'/, `window.YJ_VER = '${VER}'`), 'index.html YJ_VER');
/* 以下 4 处是「作者测试会查、而我第一版工具漏掉」的锚点——
   因为它们散落在徽标文本/模块常量/README 两处，不是明显的版本号样式。
   这是实测出来的回归：sync-version 说同源、t_version_sync 报 5 项不一致。 */
fix('index.html', (s) => s.replace(/(id="verBadge"[^>]*>)v[\d.]+/, `$1v${VER}`), 'index.html 页脚徽标文本');
fix('js/number-scrubber.js', (s) => s.replace(/version:\s*"[\d.]+"/, `version: "${VER}"`), 'number-scrubber 模块号');
fix('README.md', (s) => s.replace(/## 🆕 当前版本：v[\d.]+/, `## 🆕 当前版本：v${VER}`), 'README 当前版本标题');
fix('README.md', (s) => s.replace(/(\|\s*\*\*v)[\d.]+(\*\*\s*\|)/, `$1${VER}$2`), 'README 逐版表首行');

/* ---------- 6. VERSIONS.md（只动「当前版本」相关锚点，历史条目保持史实）---------- */
fix('VERSIONS.md', (s) => {
  let out = s
    .replace(/到 `v[\d.]+`/, `到 \`v${VER}\``)
    .replace(/版本分层（v[\d.]+ 口径）/, `版本分层（v${VER} 口径）`)
    .replace(/首行 \*\*v[\d.]+ 为当前版本\*\*/, `首行 **v${VER} 为当前版本**`)
    .replace(/当前口径（v[\d.]+）/, `当前口径（v${VER}）`);
  /* 版本计数：总数 = 速查表行数；旧版本数 = 总数 - 1 */
  const rows = (out.match(/^\| \*\*v[\d.]+\*\* \|/gm) || []).length;
  if (rows > 0) {
    out = out.replace(/共 \*\*\d+\*\* 个版本/, `共 **${rows}** 个版本`)
             .replace(/其余 \*\*\d+ 个版本均为旧版本\*\*/, `其余 **${rows - 1} 个版本均为旧版本**`)
             .replace(/\d+ 版全部有独立 git tag/, `${rows} 版全部有独立 git tag`)
             .replace(/其余 \d+ 版为旧版本/, `其余 ${rows - 1} 版为旧版本`);
  }
  return out;
}, 'VERSIONS 当前版本锚点与计数');

/* ---------- 7. changelog：只保证「存在当前版本条目」，不碰历史 ---------- */
{
  const rel = 'changelog/index.html';
  if (exists(rel)) {
    const s = read(rel);
    const has = new RegExp(`<span class="entry-ver">v${esc(VER)}</span>`).test(s);
    if (!has) {
      if (CHECK) problems.push(`${rel} —— 缺少 v${VER} 的版本条目`);
      else console.log(`  提示：${rel} 里还没有 v${VER} 条目（发版时需补，本脚本不代写正文）`);
    }
  }
}

/* ---------- 8. 结果 ---------- */
if (CHECK) {
  if (problems.length) {
    console.error(`\n✗ 版本号不同源，${problems.length} 处需要同步：`);
    for (const p of problems) console.error(`    ${p}`);
    console.error('\n  运行 node scripts/sync-version.mjs 即可全部修正。');
    process.exit(1);
  }
  console.log('\n✓ 版本号全站同源');
} else {
  if (changes.length) {
    console.log(`\n已同步 ${changes.length} 处：`);
    for (const c of changes) console.log(`    ${c}`);
  } else {
    console.log('\n无需改动，已是同源状态。');
  }
}
