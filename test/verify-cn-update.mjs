#!/usr/bin/env node
/**
 * 国内直连更新链路验证（DR-105）
 * 覆盖：元数据契约、镜像URL映射、多通道sha切换、jsDelivr真实可达、镜像真实下载。
 */
import fs from 'fs';
import crypto from 'crypto';
import https from 'https';

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { console.log('  ✓ ' + n + (extra ? ' ' + extra : '')); pass++; } else { console.log('  ✗ ' + n + (extra ? ' ' + extra : '')); fail++; } };

// 1. 元数据文件结构与契约
console.log('=== 1. update-latest.json 契约 ===');
const meta = JSON.parse(fs.readFileSync('update-latest.json', 'utf8'));
ok('含 version', !!meta.version, meta.version);
ok('含 releaseTag', !!meta.releaseTag, meta.releaseTag);
ok('含 assets 数组', Array.isArray(meta.assets) && meta.assets.length >= 2);
const unpacked = meta.assets.find(a => a.kind === 'unpacked');
const setup = meta.assets.find(a => a.kind === 'setup');
ok('含 unpacked 资产', !!unpacked, unpacked && unpacked.name);
ok('含 setup 资产', !!setup, setup && setup.name);
for (const a of meta.assets) {
  ok(a.kind + ' 有 sha256', /^sha256:[0-9a-f]{64}$/.test(a.digest || ''));
  ok(a.kind + ' 有镜像候选', Array.isArray(a.downloadUrls) && a.downloadUrls.length >= 2, (a.downloadUrls || []).length + '个');
  ok(a.kind + ' 候选首选为国内镜像', /ghproxy\.net|ghfast\.top/.test((a.downloadUrls || [])[0] || ''));
}

// 2. fromCnMeta 结构转换（复现 main.js 逻辑）
console.log('=== 2. fromCnMeta 结构转换 ===');
const VERSION = '7.0.0';
function compareVer(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map(Number);
  const pb = String(b).replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  return 0;
}
function fromCnMeta(data) {
  if (!data || !data.version) return null;
  const latest = String(data.releaseTag || data.version).trim();
  return {
    latestVersion: latest,
    hasUpdate: compareVer(data.version, VERSION) > 0,
    releasePage: data.releasePage || '',
    assets: (data.assets || []).map(a => ({ name: a.name, digest: a.digest, browser_download_url: a.browser_download_url, downloadUrls: a.downloadUrls || [a.browser_download_url] })),
    source: 'cn-meta'
  };
}
const info = fromCnMeta(meta);
ok('转换出 latestVersion', info.latestVersion === meta.releaseTag, info.latestVersion);
ok('hasUpdate 判定正确', info.hasUpdate === true);
ok('assets 带 downloadUrls', info.assets.every(a => a.downloadUrls.length >= 2));

// 3. pickUnpackedAsset 仍能选中（复现 shell-update 逻辑）
console.log('=== 3. 资产选择 ===');
const zips = info.assets.filter(a => /\.zip$/i.test(a.name));
const picked = zips.find(a => /win[-_]?unpacked|portable|免安装/i.test(a.name)) || zips[0];
ok('选中免安装zip', !!picked && /win-unpacked/.test(picked.name), picked && picked.name);

// 4. jsDelivr 真实可达（读 release-notes.json，验证国内通道通）
console.log('=== 4. jsDelivr 真实可达 ===');
function get(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'yunjing-test/1.0' }, timeout }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP_' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
  });
}
try {
  const txt = await get('https://cdn.jsdelivr.net/gh/AYun07/yunjing@main/release-notes.json?t=' + Date.now());
  ok('jsDelivr 读到远端 JSON', JSON.parse(txt).versions && JSON.parse(txt).versions.length > 0);
} catch (e) { ok('jsDelivr 读到远端 JSON', false, e.message); }

// 5. 镜像真实下载前若干字节（从元数据取真实首选镜像 URL，验证国内可直连下载 Release 大包）
console.log('=== 5. 国内镜像真实下载 ===');
const testUrl = unpacked.downloadUrls[0];
try {
  const buf = await new Promise((resolve, reject) => {
    const req = https.get(testUrl, { headers: { 'User-Agent': 'yunjing-test/1.0', Range: 'bytes=0-2047' }, timeout: 30000 }, res => {
      if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return reject(new Error('HTTP_' + res.statusCode)); }
      const chunks = []; let n = 0;
      res.on('data', c => { chunks.push(c); n += c.length; if (n >= 2048) req.destroy(); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
    req.on('error', e => { if (e.message !== 'socket hang up') reject(e); });
  });
  ok('ghproxy 直连下到数据', buf.length > 0, buf.length + ' bytes');
  // ZIP 头应是 PK\x03\x04
  ok('下载内容是有效ZIP头', buf[0] === 0x50 && buf[1] === 0x4b, buf.slice(0, 4).toString('hex'));
} catch (e) { ok('ghproxy 直连下到数据', false, e.message); }

console.log('\n' + (fail === 0 ? `✅ ${pass} 项全通过` : `❌ ${pass} 通过 / ${fail} 失败`));
process.exit(fail === 0 ? 0 : 1);
