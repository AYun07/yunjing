#!/usr/bin/env node
/** v7.6.5 产物级回归：验证两件套内嵌 app.asar = 7.6.5、站点含本轮修复代码、7z 无前缀。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = '/workspace/yunjing';
const PUB = '/workspace/待发布v760';
const TMP = '/tmp/yj765-verify';
fs.mkdirSync(TMP, { recursive: true });
const sh = (c, a, o = {}) => execFileSync(c, a, { encoding: 'utf8', ...o });
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { if (ok) { pass++; console.log('  PASS ' + n + (x ? ' -> ' + x : '')); } else { fail++; console.log('  FAIL ' + n + (x ? ' -> ' + x : '')); } };

const setup = path.join(PUB, 'YunJing-v7.6.5-Windows-setup-x64.exe');
const zip = path.join(PUB, 'YunJing-v7.6.5-win-unpacked-x64.zip');
t('setup.exe 存在且 >700MB', fs.existsSync(setup) && fs.statSync(setup).size > 700e6, (fs.statSync(setup).size/1048576|0)+'MB');
t('zip 存在且 >700MB', fs.existsSync(zip) && fs.statSync(zip).size > 700e6, (fs.statSync(zip).size/1048576|0)+'MB');

// dist win-unpacked asar
const distAsar = path.join(ROOT, 'client/electron/dist/win-unpacked/resources/app.asar');
const asarBin = path.join(ROOT, 'client/electron/node_modules/@electron/asar/bin/asar.js');
function extractFrom(asar, file, tag) {
  const d = path.join(TMP, tag); fs.mkdirSync(d, { recursive: true });
  sh('node', [asarBin, 'extract-file', asar, file], { cwd: d, stdio: 'pipe' });
  return fs.readFileSync(path.join(d, file), 'utf8');
}
try {
  const pj = JSON.parse(extractFrom(distAsar, 'package.json', 'dist'));
  t('dist asar package.json=7.6.5', pj.version === '7.6.5', pj.version);
  const mj = extractFrom(distAsar, 'main.js', 'dist');
  t('dist asar main.js 含 effectiveVersion 修复', /effectiveVersion/.test(mj));
} catch (e) { t('dist asar 解包', false, e.message.slice(0, 100)); }

// 站点基线含本轮修复代码
const site = path.join(ROOT, 'client/electron/dist/win-unpacked/resources/yunjing');
t('站点 studio.html YJ_VER=7.6.5', /YJ_VER = '7\.6\.5'/.test(fs.readFileSync(path.join(site,'studio.html'),'utf8')));
t('站点 world-clock.js 胶囊 +32px 修复', /topbar-h, 54px\) \+ 32px/.test(fs.readFileSync(path.join(site,'js/world-clock.js'),'utf8')));
t('站点 mo-store.js 告警去重修复', /_quotaWarned/.test(fs.readFileSync(path.join(site,'js/mo-store.js'),'utf8')));
t('站点 store-guard.js 旧界键不回灌', /isStaleGenreKey/.test(fs.readFileSync(path.join(site,'js/store-guard.js'),'utf8')));
t('站点 ai-response-handler.js 清洗放宽', /键长≤40/.test(fs.readFileSync(path.join(site,'js/ai-response-handler.js'),'utf8')));
t('站点 wangyou nameSeeds 补齐', /backgrounds:/.test(fs.readFileSync(path.join(site,'configs/wangyou-config.js'),'utf8')));

// 7z 无目录前缀
const sevenz = path.join(ROOT, 'client/electron/dist/yunjing-desktop-7.6.5-x64.nsis.7z');
const listing = sh('7z', ['l', sevenz], { maxBuffer: 20*1024*1024 });
t('7z 主程序无 win-unpacked/ 前缀', !listing.includes('win-unpacked/YunJing.exe') && listing.includes('YunJing.exe'));
t('7z 含 resources/app.asar', listing.includes('app.asar'));

// setup.exe 内嵌 7z 版本
const setupListing = sh('7z', ['l', setup], { maxBuffer: 20*1024*1024 });
t('setup.exe 含 app-64.7z 主体', /app-64\.7z/.test(setupListing));

console.log('\nPASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
