#!/usr/bin/env node
/**
 * v7.6.1 回归：更新死循环修复（DR-117）
 * 覆盖 A1/A2/A3 + 对 main.js 改动点的静态断言。
 * 不依赖 electron（沙箱无 GUI），用 content-sync 的真实 compareVer 模拟判断。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cs = require(path.join(ROOT, 'client/electron/content-sync.js'));
const mainSrc = fs.readFileSync(path.join(ROOT, 'client/electron/main.js'), 'utf8');

let pass = 0, fail = 0;
function t(name, fn) {
  try { const r = fn(); if (r === true) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' -> ' + r); } }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const eq = (a, b) => (a === b) ? true : `期望 ${b}，实得 ${a}`;

console.log('== v7.6.1 更新死循环修复回归 ==');

// A1：有效版本 = max(壳, 内容)
const effectiveVersion = (shell, content) =>
  (content && cs.compareVer(content, shell) > 0) ? content : shell;

t('A1 壳7.3.0/内容7.6.0 → 有效版本7.6.0', () =>
  eq(effectiveVersion('7.3.0', '7.6.0'), '7.6.0'));
t('A1 壳7.6.1/内容7.6.0 → 有效版本7.6.1', () =>
  eq(effectiveVersion('7.6.1', '7.6.0'), '7.6.1'));
t('A1 内容读不到 → 回退壳版本', () =>
  eq(effectiveVersion('7.3.0', null), '7.3.0'));

// A2：内容已到最新版时 hasUpdate 为假（死循环核心）
t('A2 远端7.6.1/有效7.6.1 → hasUpdate=false（不再提示）', () => {
  const eff = effectiveVersion('7.3.0', '7.6.1');
  return eq(cs.compareVer('7.6.1', eff) > 0, false);
});
t('A2 死循环旧逻辑复现：壳7.3.0对比远端7.6.1 → hasUpdate=true', () => {
  return eq(cs.compareVer('7.6.1', '7.3.0') > 0, true);
});
t('A2 真正有新版时仍提示：远端7.7.0/有效7.6.1 → hasUpdate=true', () => {
  const eff = effectiveVersion('7.6.1', '7.6.1');
  return eq(cs.compareVer('7.7.0', eff) > 0, true);
});

// A3：静态断言 main.js 改动点
t('A3 main.js 定义 effectiveVersion', () =>
  /function effectiveVersion\(\)/.test(mainSrc) ? true : '缺 effectiveVersion 定义');
t('A3 client-info.version 用 effectiveVersion', () =>
  /version:\s*effectiveVersion\(\)/.test(mainSrc) ? true : 'client-info.version 未改');
t('A3 client-info 保留 shellVersion', () =>
  /shellVersion:\s*VERSION/.test(mainSrc) ? true : '缺 shellVersion');
t('A3 hasUpdate 判断用 effectiveVersion（两处 fromCnMeta/API）', () => {
  const hits = (mainSrc.match(/compareVer\([^,]+,\s*effectiveVersion\(\)\)\s*>\s*0/g) || []).length;
  return hits >= 2 ? true : `期望>=2处，实得${hits}`;
});
t('A3 当前版本显示用 effectiveVersion', () =>
  /'当前版本 v'\s*\+\s*effectiveVersion\(\)/.test(mainSrc) ? true : '显示未改');
t('A3 hasUpdate 判断已无裸 VERSION 比较（排除 effectiveVersion 内部）', () => {
  // 剥掉 effectiveVersion 函数体（其内部 compareVer(cv,VERSION) 是合法的取最大值逻辑）
  const stripped = mainSrc.replace(/function effectiveVersion\(\)\s*\{[\s\S]*?\n\}/, '');
  return /compareVer\([^,]+,\s*VERSION\)\s*>\s*0/.test(stripped) ? '仍有裸VERSION比较' : true;
});

console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
