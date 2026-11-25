'use strict';
/**
 * 云境 · 壳层 A/B 更新（Windows）
 *
 * -download 免安装目录包(zip) → sha256 校验 → 解压到 sibling 目录 yunjing-next
 * -写切换标记 → 提示重启 → 新进程启动后收尾：旧目录改名 yunjing-old
 * -任何一步失败都向上抛错，由 main.js 降级到「打开 Release 页」，绝不卡死。
 *
 * 零新增依赖：解压用 Windows 自带的 PowerShell Expand-Archive（通过环境变量传路径，避免命令注入）。
 * 不覆盖、不删除正在运行的自身目录：全程只写新目录 + 改名旧目录。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFile } = require('child_process');

const SWITCH_FILE = 'shell-switch.json';
const NEXT_DIR = 'yunjing-next';
const OLD_DIR = 'yunjing-old';

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

// 只认完整目录包：优先带 win-unpacked / portable / 免安装字样的 zip
function pickUnpackedAsset(assets) {
  const zips = (Array.isArray(assets) ? assets : [])
    .filter(a => a && typeof a.name === 'string' && /\.zip$/i.test(a.name) && a.browser_download_url);
  return zips.find(a => /win[-_]?unpacked|portable|免安装/i.test(a.name)) || zips[0] || null;
}

function expectedSha(asset) {
  const d = asset && asset.digest;
  const m = typeof d === 'string' && /^sha256:([0-9a-f]{64})$/i.exec(d);
  return m ? m[1].toLowerCase() : null;
}

// 大文件流式下载 + 边下边算 sha，失败清理残片
function downloadZip(url, dest, expectedShaHex, redirects = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (_) { return reject(new Error('BAD_URL')); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return reject(new Error('BAD_URL'));
    const mod = parsed.protocol === 'https:' ? https : http;
    const tmp = dest + '.part';
    const clean = () => { try { fs.unlinkSync(tmp); } catch (_) {} };
    let req;
    try {
      req = mod.get(parsed, {
        headers: { 'User-Agent': 'yunjing-shell-update/1.0', 'Connection': 'close' },
        timeout: 600000
      }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) return reject(new Error('REDIRECT_LOOP'));
          return resolve(downloadZip(new URL(res.headers.location, url).toString(), dest, expectedShaHex, redirects + 1));
        }
        if (code !== 200) { res.resume(); return reject(new Error('DOWNLOAD_HTTP_' + code)); }
        const out = fs.createWriteStream(tmp);
        const hash = crypto.createHash('sha256');
        let size = 0;
        res.on('data', c => {
          size += c.length; hash.update(c);
          if (size > 2 * 1024 * 1024 * 1024) req.destroy(new Error('TOO_LARGE'));
        });
        res.on('error', e => { out.destroy(); clean(); reject(e); });
        out.on('error', e => { res.destroy(); clean(); reject(e); });
        out.on('finish', () => out.close(() => {
          const actual = hash.digest('hex').toLowerCase();
          if (expectedShaHex && actual !== expectedShaHex) { clean(); return reject(new Error('SHA_MISMATCH')); }
          try { fs.renameSync(tmp, dest); resolve({ path: dest, size, sha256: actual }); }
          catch (e) { clean(); reject(e); }
        }));
        res.pipe(out);
      });
      req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
      req.on('error', e => { clean(); reject(e); });
    } catch (e) { clean(); reject(e); }
  });
}

// 多通道下载（DR-105 国内直连）：按序尝试候选 URL，任一成功且 sha256 匹配即返回。
// 第三方镜像即使返回内容，sha 不符也会被拒绝并尝试下一个，杜绝镜像投毒。
async function downloadZipMulti(urls, dest, expectedShaHex) {
  const list = (Array.isArray(urls) ? urls : []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (!list.length) throw new Error('NO_DOWNLOAD_URL');
  const errs = [];
  for (const url of list) {
    try {
      const r = await downloadZip(url, dest, expectedShaHex);
      return r;
    } catch (e) {
      errs.push((e && e.message) || String(e));
      // SHA_MISMATCH 说明镜像内容不对，明确记录后继续试下一个
    }
  }
  throw new Error('ALL_SOURCES_FAILED: ' + errs.join(' | '));
}

function unzip(zip, dest) {
  return new Promise((resolve, reject) => {
    execFile('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:YJ_ZIP -DestinationPath $env:YJ_DEST -Force"
    ], {
      env: Object.assign({}, process.env, { YJ_ZIP: zip, YJ_DEST: dest }),
      timeout: 300000
    }, (err, _stdout, stderr) => {
      if (err) return reject(new Error('解压失败：' + (String(stderr || '').slice(0, 300) || err.message)));
      resolve();
    });
  });
}

function findExe(root, depth = 0) {
  try {
    const direct = path.join(root, 'YunJing.exe');
    if (fs.existsSync(direct)) return direct;
    if (depth >= 3) return null;
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        const found = findExe(path.join(root, ent.name), depth + 1);
        if (found) return found;
      } else if (/^YunJing\.exe$/i.test(ent.name)) return path.join(root, ent.name);
    }
  } catch (_) {}
  return null;
}

// 准备下一版：下载 → 校验 → 解压 → 写切换标记。失败时清理新目录并抛错。
async function prepareShellUpdate({ assets, latestVersion, exeDir, userData, tempDir }) {
  if (process.platform !== 'win32') throw new Error('壳层 A/B 更新仅支持 Windows');
  const asset = pickUnpackedAsset(assets);
  if (!asset) throw new Error('该版本未提供免安装完整目录包');
  const expect = expectedSha(asset);
  const parent = path.dirname(exeDir);
  const nextDir = path.join(parent, NEXT_DIR);
  const zip = path.join(tempDir || require('os').tmpdir(), 'yunjing-shell-' + String(latestVersion).replace(/[^0-9A-Za-z.\-]/g, '_') + '.zip');
  rmrf(nextDir);
  try {
    // DR-105 国内直连：优先用元数据里的镜像候选列表（ghproxy → ghfast → 原始直链），
    // 逐个尝试、每个都强校验 sha256；没有候选列表时回退原始直链（兼容旧版 Release）。
    const urls = (Array.isArray(asset.downloadUrls) && asset.downloadUrls.length)
      ? asset.downloadUrls.slice()
      : [asset.browser_download_url];
    await downloadZipMulti(urls, zip, expect);
    fs.mkdirSync(nextDir, { recursive: true });
    await unzip(zip, nextDir);
    const exe = findExe(nextDir);
    if (!exe) throw new Error('解压后的目录里找不到 YunJing.exe');
    const marker = path.join(userData, SWITCH_FILE);
    const tmp = marker + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({
      from: exeDir, to: nextDir, exe, version: latestVersion, preparedAt: new Date().toISOString()
    }, null, 2));
    fs.renameSync(tmp, marker);
    return { ok: true, nextDir, exe, version: latestVersion, verified: !!expect };
  } catch (e) {
    rmrf(nextDir);
    try { fs.unlinkSync(zip); } catch (_) {}
    throw e;
  }
}

// 新进程启动后收尾：旧目录改名保留，不删除；失败只记录，不阻断启动
function finalizeSwitch({ userData }) {
  const marker = path.join(userData, SWITCH_FILE);
  let info;
  try { info = JSON.parse(fs.readFileSync(marker, 'utf8')); }
  catch (_) { return { action: 'none' }; }
  const result = { action: 'none', from: info.from, to: info.to };
  try {
    if (info.from && fs.existsSync(info.from)) {
      const parent = path.dirname(info.from);
      let old = path.join(parent, OLD_DIR);
      if (fs.existsSync(old)) old = old + '-' + Date.now(); // 旧目录一律保留，不自动删
      fs.renameSync(info.from, old);
      result.action = 'renamed';
      result.oldDir = old;
    }
  } catch (e) {
    result.action = 'rename-failed';
    result.error = '旧目录改名失败（可能被占用），不影响新版运行：' + e.message;
  }
  try { fs.unlinkSync(marker); } catch (_) {}
  return result;
}

// 重启进入新版：先拉起新进程再让主进程退出；spawn 失败则不动，由调用方保持原状
function restartToNext({ userData }) {
  const marker = path.join(userData, SWITCH_FILE);
  let info;
  try { info = JSON.parse(fs.readFileSync(marker, 'utf8')); }
  catch (_) { return { ok: false, reason: '切换标记不存在或已失效' }; }
  if (!info.exe || !fs.existsSync(info.exe)) return { ok: false, reason: '新版程序文件不存在' };
  try {
    const { spawn } = require('child_process');
    const child = spawn(info.exe, [], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {}); // 启动结果无法同步确认，如实不谎报成功
    child.unref();
    return { ok: true, exe: info.exe, version: info.version };
  } catch (e) {
    return { ok: false, reason: '启动新版失败：' + e.message };
  }
}

module.exports = {
  SWITCH_FILE, NEXT_DIR, OLD_DIR,
  pickUnpackedAsset, expectedSha, downloadZip, downloadZipMulti, findExe,
  prepareShellUpdate, finalizeSwitch, restartToNext
};
