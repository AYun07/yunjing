#!/usr/bin/env node
/**
 * 云境 · 国内直连更新元数据生成器
 * ------------------------------------------------------------------
 * 生成仓库根 update-latest.json：客户端从 jsDelivr/fastly 读取它替代 api.github.com，
 * 实现国内网络直连检查更新 + 走国内镜像下载大包（强制 sha256 校验）。
 *
 * 用法：
 *   node scripts/gen-update-meta.mjs <版本> <unpacked.zip路径> <setup.exe路径> [releaseTag]
 * 例：
 *   node scripts/gen-update-meta.mjs 7.0.2 \
 *     /workspace/YunJing-v7.0.2-win-unpacked-x64.zip \
 *     /workspace/YunJing-v7.0.2-Windows-setup-x64.exe
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const version = process.argv[2];
const unpackedPath = process.argv[3];
const setupPath = process.argv[4];
const tag = process.argv[5] || ('v' + version);
if (!version || !unpackedPath || !setupPath) {
  console.error('用法: node scripts/gen-update-meta.mjs <版本> <unpacked.zip> <setup.exe> [releaseTag]');
  process.exit(1);
}

const MIRRORS = ['https://ghproxy.net/', 'https://ghfast.top/'];
const RAW = 'https://github.com/AYun07/yunjing/releases/download/' + tag + '/';

function sha256(file) {
  const h = crypto.createHash('sha256');
  const buf = fs.readFileSync(file);
  h.update(buf);
  return h.digest('hex');
}
function asset(file, kind) {
  const name = path.basename(file);
  const digest = 'sha256:' + sha256(file);
  const size = fs.statSync(file).size;
  const rawUrl = RAW + name;
  return {
    name, kind, size, digest,
    browser_download_url: rawUrl,
    downloadUrls: MIRRORS.map(m => m + rawUrl).concat([rawUrl])
  };
}

const meta = {
  schema: 1,
  version,
  releaseTag: tag,
  releasePage: 'https://github.com/AYun07/yunjing/releases/latest',
  publishedAt: new Date().toISOString(),
  note: '国内直连更新元数据。downloadUrls 为国内可直连镜像候选，按序尝试并强制 SHA-256 校验。',
  mirrors: MIRRORS,
  assets: [asset(unpackedPath, 'unpacked'), asset(setupPath, 'setup')]
};

const out = path.resolve('update-latest.json');
fs.writeFileSync(out, JSON.stringify(meta, null, 2) + '\n');
console.log('✓ 已生成 ' + out);
console.log('  version:', version, '| tag:', tag);
for (const a of meta.assets) console.log('  ' + a.kind + ': ' + a.name + ' (' + Math.round(a.size / 1024 / 1024) + 'MB) ' + a.digest);
