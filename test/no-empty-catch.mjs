/* v7.6.6 · 空 catch 门禁：禁止新增「静默吞异常」的 catch。
 * 背景：空 catch(){} 从 v7.6.4 的 698 涨到 v7.6.5 的 778（+80），
 * 是「不报错只空白」故障的温床。本门禁对源码 JS 扫描空 catch，发现即非零退出。
 * 允许豁免：js/mo-store.js、js/store-guard.js（存储兜底的静默是有意语义，且已单独告警），
 *          versions/ 历史快照、libs/ 第三方库、build-resources/dist 构建副本。
 * 用法：node test/no-empty-catch.mjs [项目根，默认脚本上两级]
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.argv[2] || path.resolve(import.meta.dirname, '..');
const files = execSync('git ls-files "*.js"', { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const skipFile = (f) => f.startsWith('versions/') || f.startsWith('libs/') || f.startsWith('client/')
  || f === 'js/mo-store.js' || f === 'js/store-guard.js';
// try-catch 空体，或 Promise .catch 空体
const patterns = [
  /catch\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{\s*\}/g,
  /\.catch\(\s*(?:function\s*\(\s*\)|[\w$]+\s*=>)\s*\{\s*\}\s*\)/g,
];
let bad = [];
for (const rel of files) {
  if (skipFile(rel)) continue;
  const s = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const re of patterns) {
    for (const m of s.matchAll(re)) {
      const line = s.slice(0, m.index).split('\n').length;
      bad.push(`${rel}:${line}`);
    }
  }
}
if (bad.length) {
  console.error('空 catch 门禁失败，发现 ' + bad.length + ' 处静默吞异常：');
  console.error(bad.slice(0, 30).join('\n'));
  process.exit(1);
}
console.log('✓ 空 catch 门禁通过：源码无静默吞异常');
