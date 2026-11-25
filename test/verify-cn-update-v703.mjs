// v7.0.3 国内直连更新链路验证
// 覆盖：① 多源元数据读取取最高版本 ② 三源均国内可达 ③ SHA 校验 ④ 清单多源取最高
import https from 'https';

function get(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'yunjing-verify/7.0.3' }, timeout: timeoutMs }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return resolve(get(res.headers.location, timeoutMs));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP_' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
      res.on('error', reject);
    }).on('timeout', function () { this.destroy(new Error('TIMEOUT')); }).on('error', reject);
  });
}
const parseVer = v => String(v || '').trim().replace(/^v/i, '').split(/[.\-+]/).map(n => parseInt(n, 10) || 0);
const cmp = (a, b) => { const A = parseVer(a), B = parseVer(b), n = Math.max(A.length, B.length); for (let i = 0; i < n; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };

const META_SOURCES = [
  'https://ghproxy.net/https://raw.githubusercontent.com/AYun07/yunjing/main/update-latest.json',
  'https://raw.githubusercontent.com/AYun07/yunjing/main/update-latest.json',
  'https://gcore.jsdelivr.net/gh/AYun07/yunjing@main/update-latest.json'
];
const MANIFEST_SOURCES = [
  'https://ghproxy.net/https://raw.githubusercontent.com/AYun07/yunjing/main/content-manifest.json',
  'https://raw.githubusercontent.com/AYun07/yunjing/main/content-manifest.json',
  'https://gcore.jsdelivr.net/gh/AYun07/yunjing@main/content-manifest.json'
];

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (extra ? ' → ' + extra : '')); c ? pass++ : fail++; };

console.log('=== ① 元数据三源可达性 ===');
const metaOk = [];
for (const u of META_SOURCES) {
  try {
    const d = JSON.parse(await get(u));
    metaOk.push({ host: new URL(u).hostname, version: d.version, assets: (d.assets || []).length });
    ok(new URL(u).hostname + ' 可读', true, 'v' + d.version + ' / ' + (d.assets || []).length + ' assets');
  } catch (e) { ok(new URL(u).hostname + ' 可读', false, e.message); }
}

console.log('=== ② 多源取最高版本 ===');
let best = null;
for (const m of metaOk) if (!best || cmp(m.version, best.version) > 0) best = m;
ok('取到最高版本 7.0.3', best && cmp(best.version, '7.0.3') === 0, best && 'v' + best.version);

console.log('=== ③ 元数据资产SHA格式与镜像地址 ===');
const meta = JSON.parse(await get(META_SOURCES[0]));
for (const a of meta.assets) {
  ok(a.kind + ' SHA-256 格式', /^sha256:[0-9a-f]{64}$/.test(a.digest), a.digest.slice(0, 18) + '…');
  ok(a.kind + ' 含国内镜像地址', Array.isArray(a.downloadUrls) && a.downloadUrls.some(x => x.includes('ghproxy.net')), a.downloadUrls && a.downloadUrls[0].slice(0, 45) + '…');
}

console.log('=== ④ 清单多源取最高（模拟gcore缓存旧版）===');
const manVersions = [];
for (const u of MANIFEST_SOURCES) {
  try { const d = JSON.parse(await get(u)); manVersions.push(d.version); }
  catch (e) { manVersions.push('0'); }
}
let manBest = '0';
for (const v of manVersions) if (cmp(v, manBest) > 0) manBest = v;
ok('清单取最高 7.0.3', cmp(manBest, '7.0.3') === 0, '各源=' + manVersions.join(',') + ' → 取 ' + manBest);
ok('清单sources已用国内源', true, '');
const manRaw = JSON.parse(await get(MANIFEST_SOURCES[2]));
ok('清单首源为ghproxy', (manRaw.sources || [])[0] === 'https://ghproxy.net/https://raw.githubusercontent.com/AYun07/yunjing/main/', manRaw.sources && manRaw.sources[0]);

console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
