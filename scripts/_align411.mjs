/* 云境 v4.11.0 版本同源收口（仅改文件，不做 git/网络；可幂等复跑）
 * 背景：v4.11.0 首轮发版只改了 index.html + changelog 两个点就打了 tag，
 *       其余锚点（studio/sw/selftest/182 处 ?v=/README/VERSIONS/QUICKSTART）
 *       全部滞留 4.10.0，违背 VERSIONS.md 自定的「版本同源」规则，
 *       且 sw.js SW_VER 未变会导致 PWA 老客户端拿不到新代码。
 * 保护：changelog 历史叙述里的 ?v=4.10.0、第三方库自身版本号、
 *       js 注释里的「v4.10.0 修 XXX」历史修复记录，均不触碰。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = '4.10.0';
const NEW = '4.11.0';

// 精确替换：只处理「云境发版号」形态，绝不模糊匹配
const rules = [
  // 1) 顶层 HTML + 所有 js 模块里的 ?v= 缓存击穿参数（排除 changelog / libs / 测试 / scripts）
  { scope: 'qv', re: /\?v=4\.10\.0/g, rep: '?v=4.11.0' },
];

const qvTargets = [];
function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (['node_modules', '.git', 'libs', 'changelog', 'yunjing-test', '_shots_v398', '_shots_v399'].includes(e.name)) continue;
    if (e.isDirectory()) { collect(path.join(dir, e.name)); continue; }
    if (!/\.(html|js)$/.test(e.name)) continue;
    if (rel.startsWith('scripts' + path.sep) || rel.startsWith('test' + path.sep)) continue;
    qvTargets.push(rel);
  }
}
collect(ROOT);

let totalQv = 0;
const touchedQv = [];
for (const rel of qvTargets) {
  const p = path.join(ROOT, rel);
  const s = fs.readFileSync(p, 'utf8');
  const n = s.replace(/\?v=4\.10\.0/g, '?v=4.11.0');
  if (n !== s) {
    fs.writeFileSync(p, n);
    const c = (s.match(/\?v=4\.10\.0/g) || []).length;
    totalQv += c;
    touchedQv.push(`${rel}:${c}`);
  }
}

// 2) 精确版本常量（每条都是唯一锚点）
const constRules = [
  ['studio.html', /window\.YJ_VER = '4\.10\.0'/g, "window.YJ_VER = '4.11.0'", 'studio YJ_VER'],
  ['studio.html', /(id="verDot"[^>]*>)v4\.10\.0(<\/span>)/g, '$1v4.11.0$2', 'studio verDot'],
  ['sw.js', /const SW_VER = 'yunjing-v4\.10\.0'/g, "const SW_VER = 'yunjing-v4.11.0'", 'sw SW_VER'],
  ['selftest.html', /const ENGINE_VER = '4\.10\.0'/g, "const ENGINE_VER = '4.11.0'", 'selftest ENGINE_VER'],
  ['QUICKSTART.txt', /云境工坊 v4\.10\.0 · 使用说明/g, '云境工坊 v4.11.0 · 使用说明', 'QUICKSTART 抬头'],
];
const constHits = [];
for (const [rel, re, rep, label] of constRules) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { constHits.push(`${label}:文件缺失!`); continue; }
  const s = fs.readFileSync(p, 'utf8');
  const n = s.replace(re, rep);
  if (n !== s) { fs.writeFileSync(p, n); constHits.push(`${label}:OK`); }
  else { constHits.push(`${label}:已是目标值或未命中`); }
}

console.log(`?v= 对齐：${totalQv} 处 / ${touchedQv.length} 个文件`);
console.log('  ' + touchedQv.join('  '));
console.log('版本常量：' + constHits.join(' | '));
console.log('ALIGN411_DONE');
