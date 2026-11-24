'use strict';
/**
 * 云境 · 内容层自更新引擎（纯 Node，不依赖 electron，便于单测注入）
 *
 * 职责：清单拉取 / 双通道回退 / sha256 校验 / 增量同步 / 自修复 / 原子切换 / 回滚 / state 记录。
 * 约束：所有网络与磁盘异常都转成中文错误信息写入 state，绝不弹窗打扰用户。
 * 关键设计：更新目录与基线用硬链接共享未变化文件；任何写入都走「临时文件 + rename」，
 *          因此不会写穿到只读基线，也不会让正在服务的旧文件读到半截内容。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const MANIFEST_NAME = 'content-manifest.json';
const STATE_NAME = 'selfupdate-state.json';
const CRITICAL_FILES = ['index.html', 'opening.html', 'studio.html', 'settings.html'];
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/* ---------- 版本：与 main.js 共用同一实现，避免两处口径漂移 ---------- */
function parseVer(v) {
  return String(v == null ? '' : v).trim().replace(/^v/i, '').split(/[.\-+]/)
    .map(n => { const i = parseInt(n, 10); return Number.isFinite(i) ? i : 0; });
}
// a 比 b 新返回 1，旧返回 -1，相等返回 0
function compareVer(a, b) {
  const A = parseVer(a), B = parseVer(b), n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function toChineseError(err) {
  const code = err && err.message ? err.message : String(err || '');
  if (code === 'TIMEOUT') return '连接超时，请检查网络后重试。';
  if (code === 'TOO_LARGE') return '下载内容超出大小上限，已跳过。';
  if (code === 'SHA_MISMATCH') return '文件校验不通过，已跳过该文件。';
  if (code === 'REDIRECT_LOOP' || code === 'BAD_URL') return '更新地址异常，请稍后重试。';
  if (code.indexOf('HTTP_') === 0) return '远端返回错误（HTTP ' + code.slice(5) + '），已切换通道。';
  if (code.indexOf('ALL_SOURCES_FAILED') === 0) return '所有更新通道均不可用，离线不影响正常使用。';
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ECONNRESET|EPIPE/.test(code)) return '当前无法联网，离线不影响正常使用。';
  if (/[\u4e00-\u9fa5]/.test(code)) return code;
  return '内容同步失败：' + code;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- 底层网络：http/https + 重定向 + 超时 + 体积上限 ---------- */
function requestBuffer(url, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, redirects = 0 } = opts;
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (_) { return reject(new Error('BAD_URL')); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return reject(new Error('BAD_URL'));
    const mod = parsed.protocol === 'https:' ? https : http;
    let req;
    try {
      req = mod.get(parsed, {
        headers: { 'User-Agent': 'yunjing-content-sync/1.0', 'Accept': '*/*', 'Connection': 'close' },
        timeout: timeoutMs
      }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) return reject(new Error('REDIRECT_LOOP'));
          return resolve(requestBuffer(new URL(res.headers.location, url).toString(), { timeoutMs, maxBytes, redirects: redirects + 1 }));
        }
        if (code !== 200) { res.resume(); return reject(new Error('HTTP_' + code)); }
        const chunks = [];
        let size = 0;
        res.on('data', c => {
          size += c.length;
          if (size > maxBytes) { req.destroy(new Error('TOO_LARGE')); return; }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('TIMEOUT')));
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

function joinURL(base, rel) {
  return String(base || '').replace(/\/+$/, '') + '/' + String(rel).replace(/^\/+/, '');
}

// 双通道：sources 顺序尝试，第一个成功即返回；全部失败抛出带每通道细节的错误
async function trySources(sources, rel, worker) {
  const list = Array.isArray(sources) ? sources.filter(s => typeof s === 'string' && s) : [];
  if (!list.length) throw new Error('ALL_SOURCES_FAILED_NO_SOURCE');
  const details = [];
  for (let i = 0; i < list.length; i++) {
    try {
      const value = await worker(joinURL(list[i], rel), i);
      return { value, sourceIndex: i };
    } catch (e) {
      details.push({ source: list[i], error: (e && e.message) || String(e) });
    }
  }
  const err = new Error('ALL_SOURCES_FAILED');
  err.details = details;
  throw err;
}

async function downloadText(sources, rel, opts = {}) {
  const r = await trySources(sources, rel, async (url) => {
    const buf = await requestBuffer(url, opts);
    return buf.toString('utf8');
  });
  return r.value;
}

// 下载到内存 → 校验 sha → 写临时文件 → rename 到 dest（原子，不写穿硬链接源）
async function downloadFile(sources, rel, dest, expectedSha, opts = {}) {
  const r = await trySources(sources, rel, async (url) => {
    const buf = await requestBuffer(url, opts);
    const sha = crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
    if (expectedSha && sha !== String(expectedSha).toLowerCase()) throw new Error('SHA_MISMATCH');
    const tmp = dest + '.part-' + process.pid;
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try { fs.unlinkSync(tmp); } catch (_) {}
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, dest);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (_) {}
      throw e;
    }
    return { size: buf.length, sha256: sha };
  });
  return Object.assign(r.value, { sourceIndex: r.sourceIndex });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const rs = fs.createReadStream(file);
    rs.on('data', c => h.update(c));
    rs.on('error', reject);
    rs.on('end', () => resolve(h.digest('hex').toLowerCase()));
  });
}

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

// 硬链接优先构建目录树（713MB 基线秒级完成），跨设备失败时回退为复制
function linkTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dst, ent.name);
    if (ent.isDirectory()) linkTree(s, d);
    else if (ent.isFile()) {
      try { fs.linkSync(s, d); }
      catch (_) { fs.copyFileSync(s, d); }
    }
  }
}

function relToAbs(root, rel) { return path.join(root, ...String(rel).split('/')); }

/* ---------- 清单与 state ---------- */
function readLocalManifest(contentDir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(contentDir, MANIFEST_NAME), 'utf8'));
    if (m && m.schema === 1 && typeof m.version === 'string'
      && m.files && typeof m.files === 'object' && !Array.isArray(m.files)) return m;
  } catch (_) {}
  return { schema: 1, version: '0.0.0', generatedAt: null, count: 0, sources: [], files: {} };
}

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('清单格式异常');
  if (m.schema !== 1) throw new Error('清单 schema 不兼容（需为 1）');
  if (typeof m.version !== 'string' || !m.version) throw new Error('清单缺少 version');
  if (!m.files || typeof m.files !== 'object' || Array.isArray(m.files)) throw new Error('清单缺少 files');
  for (const [rel, meta] of Object.entries(m.files)) {
    if (!meta || !/^[0-9a-f]{64}$/i.test(String(meta.sha256 || '')) || !Number.isFinite(meta.size))
      throw new Error('清单条目异常：' + rel);
  }
  return m;
}

function defaultState() {
  return {
    version: '0.0.0', lastSync: null, lastResult: null,
    bootPending: false, crashes: 0, rollbackCount: 0,
    lastRollbackVersion: null, errors: []
  };
}
function readState(stateFile) {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (s && typeof s === 'object') return Object.assign(defaultState(), s);
  } catch (_) {}
  return defaultState();
}
function writeState(stateFile, patch) {
  try {
    const cur = readState(stateFile);
    const next = Object.assign(cur, patch || {});
    if (!(next.errors instanceof Array)) next.errors = [];
    // 自修复的错误不能被随后的同步结果覆盖；去重后保留最近 20 条
    if (patch && patch.errors instanceof Array && cur.errors instanceof Array) {
      next.errors = Array.from(new Set(cur.errors.concat(patch.errors))).slice(-20);
    } else next.errors = next.errors.slice(-20);
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, stateFile);
    return next;
  } catch (_) { return null; }
}
function getStatus(stateFile, contentDir) {
  const s = readState(stateFile);
  return { version: s.version, lastSync: s.lastSync, state: s, contentDir: contentDir || null };
}

/* ---------- 首次落地：把打包基线硬链接到可写内容目录 ---------- */
async function ensureContentDir({ contentDir, baselineDir }) {
  if (fs.existsSync(path.join(contentDir, 'index.html'))) return { prepared: false };
  const tmp = contentDir + '.init';
  rmrf(tmp);
  fs.mkdirSync(tmp, { recursive: true });
  linkTree(baselineDir, tmp);
  for (const f of CRITICAL_FILES) {
    if (!fs.existsSync(path.join(tmp, f))) {
      rmrf(tmp);
      throw new Error('打包基线缺少关键文件：' + f);
    }
  }
  fs.renameSync(tmp, contentDir);
  return { prepared: true };
}

// 原子切换：live → bak，staging → live。Windows 文件占用时重试；失败则把 live 复原
async function atomicSwap(live, staging, bak, retries = 3) {
  for (let i = 0; i < retries; i++) {
    let moved = false;
    try {
      rmrf(bak);
      fs.renameSync(live, bak); moved = true;
      fs.renameSync(staging, live);
      return true;
    } catch (_) {
      if (moved && !fs.existsSync(live) && fs.existsSync(bak)) {
        try { fs.renameSync(bak, live); } catch (__) {}
      }
      await delay(300 * (i + 1));
    }
  }
  return false;
}

/* ---------- A1：增量同步 ---------- */
async function syncContent(opts) {
  const { contentDir, baselineDir, stateFile, sources } = opts;
  const netOpts = { timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes };
  const result = { action: 'none', version: '0.0.0', ok: false, downloaded: 0, reused: 0, skipped: [], errors: [] };
  const finish = () => writeState(stateFile, {
    version: result.version, lastSync: new Date().toISOString(), lastResult: result, errors: result.errors
  });
  try {
    await ensureContentDir({ contentDir, baselineDir });
    const local = readLocalManifest(contentDir);
    result.version = local.version;

    let remote;
    try {
      // 清单加时间戳绕开 jsDelivr 的 @main CDN 缓存；内容文件靠 sha 校验兜底
      const text = await downloadText(sources, MANIFEST_NAME + '?t=' + Date.now(), netOpts);
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('清单解析失败'); }
      remote = validateManifest(parsed);
    } catch (e) {
      throw new Error('远端清单拉取失败：' + toChineseError(e));
    }

    // 回滚后的版本冻结：避免下次启动又把同一批坏内容升回去，等下一版再更新
    const st = readState(stateFile);
    if (st.lastRollbackVersion && compareVer(remote.version, st.lastRollbackVersion) <= 0) {
      result.action = 'frozen'; result.ok = true; result.version = local.version;
      finish(); return result;
    }
    if (compareVer(remote.version, local.version) <= 0) {
      result.action = 'up-to-date'; result.ok = true; result.version = local.version;
      finish(); return result;
    }

    const staging = contentDir + '.staging';
    rmrf(staging);
    linkTree(contentDir, staging);

    let criticalFailure = false;
    for (const [rel, meta] of Object.entries(remote.files)) {
      // 本地已有且 sha 相同 → 直接复用 staging 中硬链接过来的文件，省一次下载
      let reuse = false;
      try {
        const localFile = relToAbs(contentDir, rel);
        if (fs.existsSync(localFile) && (await sha256File(localFile)) === String(meta.sha256).toLowerCase()) reuse = true;
      } catch (_) {}
      if (reuse) { result.reused++; continue; }

      try {
        await downloadFile(sources, rel, relToAbs(staging, rel), meta.sha256, netOpts);
        result.downloaded++;
      } catch (e) {
        const reason = toChineseError(e);
        result.skipped.push(rel);
        result.errors.push(rel + '：' + reason);
        if (CRITICAL_FILES.indexOf(rel) >= 0) criticalFailure = true;
      }
    }

    // 关键文件失败 → 整批回滚，绝不切换出白屏版本
    if (criticalFailure) {
      rmrf(staging);
      result.action = 'critical-failed';
      finish(); return result;
    }

    fs.writeFileSync(path.join(staging, MANIFEST_NAME), JSON.stringify(remote, null, 2));
    if (!await atomicSwap(contentDir, staging, contentDir + '.bak')) {
      rmrf(staging);
      result.action = 'swap-failed';
      result.errors.push('目录切换失败（文件可能被占用），下次启动重试');
      finish(); return result;
    }
    result.action = 'updated';
    result.ok = true;
    result.version = remote.version;
    finish();
    return result;
  } catch (e) {
    result.action = 'error';
    result.errors.push(toChineseError(e));
    finish();
    return result;
  }
}

/* ---------- A2：自修复（版本相同也跑；联网优先，离线用基线兜底） ---------- */
async function repairContent(opts) {
  const { contentDir, baselineDir, stateFile, sources } = opts;
  const netOpts = { timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes };
  const result = { action: 'clean', ok: true, checked: 0, fixed: 0, baselineFixed: 0, failed: [], errors: [] };
  const finish = () => writeState(stateFile, { lastResult: result, errors: result.errors });
  try {
    await ensureContentDir({ contentDir, baselineDir });
    const local = readLocalManifest(contentDir);
    const entries = Object.entries(local.files || {});
    result.checked = entries.length;
    const broken = [];
    for (const [rel, meta] of entries) {
      const f = relToAbs(contentDir, rel);
      let ok = false;
      try { ok = fs.existsSync(f) && (await sha256File(f)) === String(meta.sha256).toLowerCase(); } catch (_) {}
      if (!ok) broken.push([rel, meta]);
    }
    if (!broken.length) { finish(); return result; }

    result.action = 'repaired';
    for (const [rel, meta] of broken) {
      const dst = relToAbs(contentDir, rel);
      try {
        await downloadFile(sources, rel, dst, meta.sha256, netOpts);
        result.fixed++;
      } catch (_) {
        // 基线兜底：先 unlink 再复制，避免写穿硬链接到只读基线目录
        try {
          const base = relToAbs(baselineDir, rel);
          if (!fs.existsSync(base)) throw new Error('基线也无此文件');
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          try { fs.unlinkSync(dst); } catch (__) {}
          fs.copyFileSync(base, dst);
          result.baselineFixed++;
          result.errors.push(rel + '：联网修复失败，已用打包基线兜底');
        } catch (e2) {
          result.failed.push(rel);
          result.errors.push(rel + '：联网与基线均不可用，修复失败');
        }
      }
    }
    if (result.failed.length) result.ok = false;
    finish();
    return result;
  } catch (e) {
    result.action = 'error'; result.ok = false;
    result.errors.push(toChineseError(e));
    finish();
    return result;
  }
}

/* ---------- A3：回滚到上一版 ---------- */
async function rollbackToBackup(opts) {
  const { contentDir, stateFile } = opts;
  const bak = contentDir + '.bak';
  const discard = contentDir + '.rollback';
  const result = { ok: false, action: 'none', errors: [] };
  // 记录「被回滚掉的坏版本」，用于冻结同一版本，防止下次启动又升回去
  const badVersion = fs.existsSync(path.join(contentDir, MANIFEST_NAME))
    ? readLocalManifest(contentDir).version : null;
  if (!fs.existsSync(path.join(bak, 'index.html'))) {
    result.errors.push('没有可用的上一版本备份');
  } else {
    for (let i = 0; i < 3; i++) {
      let moved = false;
      try {
        rmrf(discard);
        fs.renameSync(contentDir, discard); moved = true;
        fs.renameSync(bak, contentDir);
        result.ok = true; result.action = 'rolled-back';
        break;
      } catch (_) {
        if (moved && !fs.existsSync(contentDir) && fs.existsSync(discard)) {
          try { fs.renameSync(discard, contentDir); } catch (__) {}
        }
        await delay(300 * (i + 1));
      }
    }
    if (!result.ok) result.errors.push('回滚时目录被占用，下次启动重试');
  }
  const patch = { lastResult: result, errors: result.errors, crashes: 0, bootPending: true };
  if (result.ok) {
    patch.rollbackCount = (readState(stateFile).rollbackCount || 0) + 1;
    patch.lastRollbackVersion = badVersion;
  }
  writeState(stateFile, patch);
  return result;
}

// 启动总入口：崩溃检测 → 回滚判定 → 落地基线 → 自修复 → 拉清单增量同步
async function runStartup(opts) {
  const st0 = readState(opts.stateFile);
  const crashes = st0.bootPending ? (st0.crashes || 0) + 1 : 0;
  let rollback = null;
  if (crashes >= 2) rollback = await rollbackToBackup(opts);
  writeState(opts.stateFile, { bootPending: true, crashes: rollback ? 0 : crashes });

  const prep = await ensureContentDir(opts);
  const repair = await repairContent(opts);
  const sync = await syncContent(opts);
  return { prep, repair, sync, rollback };
}

function markBootOk(stateFile) { return writeState(stateFile, { bootPending: false }); }

module.exports = {
  parseVer, compareVer, toChineseError, requestBuffer, downloadText, downloadFile,
  sha256File, readLocalManifest, validateManifest, readState, writeState, getStatus,
  ensureContentDir, atomicSwap, syncContent, repairContent, rollbackToBackup,
  runStartup, markBootOk,
  MANIFEST_NAME, STATE_NAME, CRITICAL_FILES, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BYTES
};
