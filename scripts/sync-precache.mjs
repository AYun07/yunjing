#!/usr/bin/env node
/* 云境 · 预缓存清单守卫（v4.17.0）
 *
 * 为什么有它
 *   sw.js 的离线预缓存清单是**手工维护**的，而它与文件系统之间没有任何同步机制。
 *   实际发生过：js/phone-alive.js / phone-apps.js / phone-social.js / css/phone-social.css
 *   被注释声称「全库零引用」而从清单移除，实际 phone-panel.js 确实会动态加载它们 ——
 *   结果离线时这几个模块必然 404。同类漏项会反复出现，因为「清单 vs 文件系统」靠人眼对齐。
 *
 * 它查三类问题
 *   ① GENRES 漂移   —— sw.js 里手写的界名数组 与 configs/*-config.js 实际文件不一致
 *   ② 死条目        —— 清单里写了、但磁盘上不存在的文件（白下载 / 静默失败）
 *   ③ 漏预缓存      —— studio.html / index.html 直接引用的 js/css 不在清单里（离线必坏）
 *
 * 用法
 *   node scripts/sync-precache.mjs            # 只检查（CI 用；有问题退出码 1）
 *   node scripts/sync-precache.mjs --write    # 自动修 GENRES 漂移（②③ 仍只报告，由人决定）
 *   node scripts/sync-precache.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const AS_JSON = process.argv.includes('--json');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const sw = read('sw.js');

/* ---------- ① GENRES 漂移 ---------- */
const realGenres = fs.readdirSync(path.join(ROOT, 'configs'))
  .filter((f) => f.endsWith('-config.js'))
  .map((f) => f.replace('-config.js', '')).sort();
const swGenres = (() => {
  const m = sw.match(/const GENRES = \[([^\]]*)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
})();
const genreMissing = swGenres ? realGenres.filter((g) => !swGenres.includes(g)) : [];
const genreExtra = swGenres ? swGenres.filter((g) => !realGenres.includes(g)) : [];

/* ---------- ② 死条目 ---------- */
/* 把清单里的字面量路径抽出来：既含 CORE/CORE2 的直接字面量，也含 GEN 推导出来的 */
/* 注意：sw.js 里有 `'configs/' + g + '-config.js'` 这类**拼接片段**，
   字面量 '-config.js' 也会被正则匹配到，但它不是路径。剔除「以 - 或 . 开头」的片段，
   并要求：含 '/' 的目录路径，或属于根目录下的已知文件。 */
const ROOT_FILES = new Set(['index.html', 'studio.html', 'sw.js', 'story-framework.js',
  'selftest.html', 'manifest.webmanifest', 'mobile-server.ps1', 'offline.html', 'changelog.html']);
const literalPaths = [...sw.matchAll(/'((?:\.\/)?[\w./@-]+\.(?:js|css|json|html|png|ico|woff2|webmanifest|ps1))'/g)]
  .map((m) => m[1].replace(/^\.\//, ''))
  .filter((p) => !/^[-.]/.test(p))
  .filter((p) => p.includes('/') || ROOT_FILES.has(p));
const genPaths = [];
for (const g of realGenres) {
  genPaths.push(`configs/${g}-config.js`, `js/world-ext/${g}-ext.js`, `css/${g}-style.css`,
    `js/kb/${g}.core.js`, `js/kb/${g}.ext.js`);
}
const allListed = [...new Set([...literalPaths, ...genPaths])];
const dead = allListed.filter((p) => !exists(p));

/* ---------- ③ 漏预缓存：HTML 直接引用的 js/css 必须在清单里 ---------- */
const htmlRefs = new Set();
for (const h of ['studio.html', 'index.html']) {
  if (!exists(h)) continue;
  const s = read(h);
  for (const m of s.matchAll(/(?:src|href)="((?:js|css|assets|configs)\/[\w./@-]+?)(?:\?v=[\d.]+)?"/g)) {
    htmlRefs.add(m[1]);
  }
}
/* 懒加载模块（text/yj-lazy 的 data-src）也必须在清单里，否则离线点开就 404 */
for (const h of ['studio.html', 'index.html']) {
  if (!exists(h)) continue;
  const s = read(h);
  for (const m of s.matchAll(/data-src="((?:js|css)\/[\w./@-]+?)(?:\?v=[\d.]+)?"/g)) {
    htmlRefs.add(m[1]);
  }
}
const notPrecached = [...htmlRefs].filter((p) => !allListed.includes(p) && exists(p)).sort();

/* ---------- 输出 ---------- */
const problems = [];
if (genreMissing.length) problems.push(`GENRES 缺 ${genreMissing.length} 个界：${genreMissing.join(', ')}`);
if (genreExtra.length) problems.push(`GENRES 多 ${genreExtra.length} 个界：${genreExtra.join(', ')}`);
if (dead.length) problems.push(`清单里有 ${dead.length} 个死条目（磁盘上不存在）`);
if (notPrecached.length) problems.push(`HTML 引用了 ${notPrecached.length} 个文件但清单里没有`);

if (AS_JSON) {
  console.log(JSON.stringify({
    realGenres: realGenres.length, swGenres: swGenres ? swGenres.length : null,
    genreMissing, genreExtra, dead, notPrecached,
    listedTotal: allListed.length, problems,
  }, null, 1));
} else {
  console.log(`界数：configs 实际 ${realGenres.length} ｜ sw.js GENRES ${swGenres ? swGenres.length : '?'} ｜ 清单条目 ${allListed.length}`);
  console.log('');
  if (genreMissing.length) console.log(`  ✗ GENRES 缺失：${genreMissing.join(', ')}`);
  if (genreExtra.length) console.log(`  ✗ GENRES 多余：${genreExtra.join(', ')}`);
  if (dead.length) {
    console.log(`  ✗ 死条目 ${dead.length} 个：`);
    dead.slice(0, 20).forEach((p) => console.log(`      ${p}`));
    if (dead.length > 20) console.log(`      … 另有 ${dead.length - 20} 个`);
  }
  if (notPrecached.length) {
    console.log(`  ✗ 漏预缓存 ${notPrecached.length} 个（HTML 引用了但清单没有）：`);
    notPrecached.slice(0, 20).forEach((p) => console.log(`      ${p}`));
    if (notPrecached.length > 20) console.log(`      … 另有 ${notPrecached.length - 20} 个`);
  }
  if (!problems.length) console.log('  ✓ 预缓存清单与文件系统一致');
}

/* ---------- --write：只自动修 GENRES（安全、纯机械）---------- */
if (WRITE && swGenres && (genreMissing.length || genreExtra.length)) {
  const next = realGenres.map((g) => `"${g}"`).join(',');
  const out = sw.replace(/const GENRES = \[[^\]]*\]/, `const GENRES = [${next}]`);
  if (out !== sw) {
    fs.writeFileSync(path.join(ROOT, 'sw.js'), out);
    console.log(`\n  已把 sw.js 的 GENRES 修正为 ${realGenres.length} 个界。`);
    console.log('  （②③ 未自动修：删除死条目可能删掉将来要加的文件，补清单要人确认归属，故只报告。）');
  }
}

const fatal = genreMissing.length || genreExtra.length || dead.length || notPrecached.length;
if (!WRITE && fatal) {
  console.log('');
  console.log('  提示：node scripts/sync-precache.mjs --write 可自动修正 GENRES；②③ 需人工确认。');
  process.exit(1);
}
process.exit(0);
