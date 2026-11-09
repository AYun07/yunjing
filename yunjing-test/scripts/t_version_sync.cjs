/* 云境 · 版本同源独立验收器（v4.11.0 新增）
 * 把 VERSIONS.md 自定的「版本同源」规则固化为可复跑测试，防发版漏改复发。
 * 用法：node yunjing-test/scripts/t_version_sync.cjs [期望版本，默认从 index.html YJ_VER 读]
 *
 * 规则（VERSIONS.md 第 8 行）：git tag / YJ_VER / SW_VER / 页面标题 /
 *   本文件条目四者必须同号；静态资源 ?v= 参数一律等于当前版本号。
 *
 * 保护（不算缺陷，明确豁免）：
 *   - changelog/index.html 历史条目正文里的旧版本号叙述（如 v3.96.1 提到 ?v=4.10.0）
 *   - libs/ 第三方库自身版本号（?v=1.7.3 等），历来不参与同源
 *   - js 注释里的「v4.10.0 修 XXX」历史修复记录
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let VER = process.argv[2];
if (!VER) {
  const m = read('index.html').match(/window\.YJ_VER = '([\d.]+)'/);
  VER = m ? m[1] : null;
}
if (!VER) { console.log('VERSION_SYNC_FAIL: 读不到期望版本'); process.exit(1); }

const esc = VER.replace(/\./g, '\\.');
const results = [];
function rec(name, ok, detail) { results.push({ name, ok, detail: detail || '' }); }

// ---- 1. 版本常量锚点（各文件唯一真值）----
const constChecks = [
  ['index.html  YJ_VER',        'index.html',    new RegExp(`window\\.YJ_VER = '${esc}'`)],
  ['studio.html YJ_VER',        'studio.html',   new RegExp(`window\\.YJ_VER = '${esc}'`)],
  ['index.html  页脚徽标',       'index.html',    new RegExp(`id="verBadge"[^>]*>v${esc}( 云境版)?`)],
  ['studio.html verDot',        'studio.html',   new RegExp(`id="verDot"[^>]*>v${esc}`)],
  ['sw.js       SW_VER',        'sw.js',         new RegExp(`const SW_VER = 'yunjing-v${esc}'`)],
  ['selftest    ENGINE_VER',    'selftest.html', new RegExp(`const ENGINE_VER = '${esc}'`)],
  ['number-scrubber 模块号',    'js/number-scrubber.js', new RegExp(`version: "${esc}"`)],
  ['index.html  页面标题',       'index.html',    new RegExp(`<title>云境 v${esc}`)],
  ['studio.html 页面标题',       'studio.html',   new RegExp(`<title>云境 v${esc}`)],
  ['QUICKSTART  抬头',           'QUICKSTART.txt',new RegExp(`云境工坊 v${esc}`)],
  ['README      当前版本',       'README.md',     new RegExp(`## 🆕 当前版本：v${esc}（`)],
  ['VERSIONS    计数区终点',     'VERSIONS.md',   new RegExp(`到 \\\`v${esc}\\\``)],
  ['VERSIONS    速查表首行',     'VERSIONS.md',   new RegExp(`\\| \\*\\*v${esc}\\*\\* \\|`)],
  ['VERSIONS    详情段',         'VERSIONS.md',   new RegExp(`^## v${esc} ·`, 'm')],
  ['README      逐版表首行',     'README.md',     new RegExp(`\\| \\*\\*v${esc}\\*\\* \\|`)],
  ['changelog   v 条目',         'changelog/index.html', new RegExp(`<span class="entry-ver">v${esc}</span>`)],
  ['changelog   CSS ?v=',        'changelog/index.html', new RegExp(`yunjing-theme\\.css\\?v=${esc}`)],
];
for (const [name, file, re] of constChecks) {
  let s = '';
  try { s = read(file); } catch (e) { rec(name, false, '文件缺失'); continue; }
  rec(name, re.test(s), re.test(s) ? '' : '未命中 ' + re.toString());
}

// ---- 2. ?v= 缓存参数：功能范围内必须全部等于当前版本 ----
function collect(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (['node_modules', '.git', 'libs', 'changelog', 'yunjing-test', '_shots_v398', '_shots_v399', 'scripts', 'test'].includes(e.name)) continue;
    if (e.isDirectory()) { collect(path.join(dir, e.name), out); continue; }
    if (!/\.(html|js)$/.test(e.name)) continue;
    out.push(rel);
  }
}
const files = [];
collect(ROOT, files);
let qvTotal = 0, qvBad = 0;
const badFiles = [];
for (const rel of files) {
  const s = read(rel);
  const all = s.match(/\?v=[\d.]+/g) || [];
  // 只统计「云境发版号世代」：x.y.z 且主版本号 >= 3（云境从 3.55.7 起，首位恒 >=3）。
  // 第三方库自身版本号（?v=0.1.18 / 1.7.3 / 1.4 / 1.12 等，首位 <3）历来不参与同源，天然豁免。
  const gen = all.filter((v) => {
    const m = v.match(/^\?v=(\d+)\.\d+\.\d+$/);
    return m && Number(m[1]) >= 3;
  });
  qvTotal += gen.length;
  const wrong = gen.filter((v) => v !== '?v=' + VER);
  if (wrong.length) { qvBad += wrong.length; badFiles.push(`${rel}:${[...new Set(wrong)].join(',')}`); }
}
rec(`?v= 缓存参数同源（${qvTotal} 处）`, qvBad === 0, badFiles.join(' '));

// ---- 3. sw.js 内不应残留旧世代缓存参数 ----
const sw = read('sw.js');
const swGen = (sw.match(/\?v=\d+\.\d+\.\d+/g) || []);
rec('sw.js 无旧世代 ?v=', swGen.every((v) => v === '?v=' + VER),
    swGen.filter((v) => v !== '?v=' + VER).join(','));

// ---- 汇总 ----
const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
console.log(`版本同源验收  期望版本 v${VER}  ->  ${pass}/${results.length} 通过`);
for (const r of fail) console.log(`  ✗ ${r.name}  ${r.detail}`);
if (fail.length === 0) console.log('VERSION_SYNC_OK ✓ 全部锚点同号');
else { console.log(`VERSION_SYNC_FAIL ✗ ${fail.length} 项不同源`); process.exit(1); }
