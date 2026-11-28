#!/usr/bin/env node
/**
 * v7.6.4 产物级回归（DR-118）：验证两件套内嵌 app.asar 都是 7.6.4 且含修复代码。
 * 这是 v7.6.1 缺失的门禁——setup.exe 曾沿用旧 7.3.0 外壳导致用户"装完仍旧版"。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = '/workspace/待发布v760';
const ASAR_BIN = path.join(ROOT, 'client/electron/node_modules/.bin/asar');
const TMP = '/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d59-9760f4f1c000/artifact-verify-v762';

let pass = 0, fail = 0;
function t(name, fn) {
  try { const r = fn(); if (r === true) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' -> ' + r); } }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const eq = (a, b) => (a === b) ? true : `期望 ${b}，实得 ${a}`;

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts });
}
function asarField(asar, file) {
  // extract-file 会把文件解到 cwd
  const d = path.join(TMP, 'x'); fs.mkdirSync(d, { recursive: true });
  sh(ASAR_BIN, ['extract-file', asar, file], { cwd: d, stdio: 'pipe' });
  return fs.readFileSync(path.join(d, file), 'utf8');
}

console.log('== v7.6.4 产物级回归（DR-118）==');

// 1. 两件套存在
const setup = path.join(PUB, 'YunJing-v7.6.4-Windows-setup-x64.exe');
const zip = path.join(PUB, 'YunJing-v7.6.4-win-unpacked-x64.zip');
t('setup.exe 存在且 >700MB', () => fs.existsSync(setup) && fs.statSync(setup).size > 700e6 ? true : '缺失或过小');
t('zip 存在且 >700MB', () => fs.existsSync(zip) && fs.statSync(zip).size > 700e6 ? true : '缺失或过小');

// 2. dist/win-unpacked 的 asar
const distAsar = path.join(ROOT, 'client/electron/dist/win-unpacked/resources/app.asar');
t('dist asar package.json 版本=7.6.4', () => {
  const p = JSON.parse(asarField(distAsar, 'package.json'));
  return eq(p.version, '7.6.4');
});
t('dist asar main.js 含 effectiveVersion 修复', () => {
  const n = (asarField(distAsar, 'main.js').match(/effectiveVersion/g) || []).length;
  return n >= 10 ? true : `计数=${n}`;
});

// 3. 从 setup.exe 解出内嵌文件，验证 asar
const sdir = path.join(TMP, 'setup'); fs.rmSync(sdir, { recursive: true, force: true }); fs.mkdirSync(sdir, { recursive: true });
try { sh('7z', ['x', '-y', '-o' + sdir, setup], { stdio: 'pipe' }); } catch (e) {}
const setupAsar = path.join(sdir, 'resources', 'app.asar');
t('setup.exe 内嵌 app.asar 可解出', () => fs.existsSync(setupAsar) ? true : '未解出');
if (fs.existsSync(setupAsar)) {
  t('setup 内嵌 asar 版本=7.6.4（决定性）', () => {
    const p = JSON.parse(asarField(setupAsar, 'package.json'));
    return eq(p.version, '7.6.4');
  });
  t('setup 内嵌 main.js 含修复代码（决定性）', () => {
    const n = (asarField(setupAsar, 'main.js').match(/effectiveVersion/g) || []).length;
    return n >= 10 ? true : `计数=${n}`;
  });
  t('setup 内嵌 asar 与 dist asar 字节一致', () => {
    const a = require('crypto').createHash('sha256').update(fs.readFileSync(setupAsar)).digest('hex');
    const b = require('crypto').createHash('sha256').update(fs.readFileSync(distAsar)).digest('hex');
    return eq(a, b);
  });
}

// 4. 从 zip 解出 asar，验证
const zdir = path.join(TMP, 'zip'); fs.rmSync(zdir, { recursive: true, force: true }); fs.mkdirSync(zdir, { recursive: true });
try { sh('7z', ['x', '-y', '-o' + zdir, zip, 'resources/app.asar', 'resources/yunjing/js/bonus-engine.js'], { stdio: 'pipe' }); } catch (e) {}
const zipAsar = path.join(zdir, 'resources', 'app.asar');
t('zip 内嵌 app.asar 可解出', () => fs.existsSync(zipAsar) ? true : '未解出');
if (fs.existsSync(zipAsar)) {
  t('zip 内嵌 asar 版本=7.6.4', () => {
    const p = JSON.parse(asarField(zipAsar, 'package.json'));
    return eq(p.version, '7.6.4');
  });
  t('zip 内嵌 asar 与 dist 字节一致', () => {
    const a = require('crypto').createHash('sha256').update(fs.readFileSync(zipAsar)).digest('hex');
    const b = require('crypto').createHash('sha256').update(fs.readFileSync(distAsar)).digest('hex');
    return eq(a, b);
  });
}

// 5. update-latest.json 声明与产物 SHA 对齐
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'update-latest.json'), 'utf8'));
t('元数据版本=7.6.4', () => eq(meta.version, '7.6.4'));
for (const a of meta.assets) {
  const f = path.join(PUB, a.name);
  t(`元数据 ${a.kind} SHA 对齐`, () => {
    if (!fs.existsSync(f)) return '文件缺失';
    const actual = require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    return eq(actual, a.digest.split(':')[1]);
  });
}

// 6. DR-120 决定性门禁：两件套内置站点内容含 silent 栈溢出修复（内容层，不在 asar 里）
if (fs.existsSync(setupAsar)) {
  const setupSiteBonus = path.join(sdir, 'resources', 'yunjing', 'js', 'bonus-engine.js');
  t('setup 内置站点含 silent 栈溢出修复（决定性）', () => {
    if (!fs.existsSync(setupSiteBonus)) return '内置站点 bonus-engine.js 缺失';
    const src = fs.readFileSync(setupSiteBonus, 'utf8');
    return src.includes('function recompute(silent)') && src.includes('if (!silent)') ? true : '未含 silent 修复';
  });
}
if (fs.existsSync(zipAsar)) {
  const zipSiteBonus = path.join(zdir, 'resources', 'yunjing', 'js', 'bonus-engine.js');
  t('zip 内置站点含 silent 栈溢出修复（决定性）', () => {
    if (!fs.existsSync(zipSiteBonus)) return '内置站点 bonus-engine.js 缺失';
    const src = fs.readFileSync(zipSiteBonus, 'utf8');
    return src.includes('function recompute(silent)') && src.includes('if (!silent)') ? true : '未含 silent 修复';
  });
}

console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
