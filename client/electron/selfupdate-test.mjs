/**
 * 云境自更新引擎自测（纯 Node，无需 electron / 无外网）
 * 用本地 http 服务模拟双通道 CDN，验证四条核心逻辑 + 关键文件整批回滚 + 崩溃回滚。
 * 独立跑法：node client/electron/selfupdate-test.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cs = require('./content-sync.js');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const V1 = {
  'index.html': 'INDEX_V1', 'opening.html': 'OPEN_V1', 'studio.html': 'STUDIO_V1',
  'settings.html': 'SET_V1', 'js/app.js': 'APP_V1', 'js/other.js': 'OTHER_V1'
};
const V2 = Object.assign({}, V1, { 'js/app.js': 'APP_V2', 'js/new.js': 'NEW_V2' });

function manifest(version, contents) {
  const files = {};
  for (const [rel, body] of Object.entries(contents)) {
    files[rel] = { sha256: sha(body), size: Buffer.byteLength(body) };
  }
  return { schema: 1, version, generatedAt: '2026-01-01T00:00:00.000Z', count: Object.keys(files).length, sources: [], files };
}

// 简易可控远端：routes 的 key 为 '/相对路径'，value 为 {status, body, delayMs}
async function serve(routes) {
  const srv = http.createServer((req, res) => {
    const key = (req.url || '/').split('?')[0];
    const r = routes[key];
    const send = () => {
      if (!r) { res.writeHead(404); return res.end('NOT_FOUND'); }
      res.writeHead(r.status || 200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(r.body == null ? '' : r.body);
    };
    if (r && r.delayMs > 0) setTimeout(send, r.delayMs); else send();
  });
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  return { srv, url: 'http://127.0.0.1:' + srv.address().port + '/' };
}
const routesFor = contents => {
  const r = {};
  for (const [rel, body] of Object.entries(contents)) r['/' + rel] = { body };
  return r;
};
const close = s => new Promise(resolve => s.srv.close(resolve));

async function makeEnv(root) {
  const baselineDir = path.join(root, 'baseline');
  const contentDir = path.join(root, 'content');
  const stateFile = path.join(root, 'selfupdate-state.json');
  for (const [rel, body] of Object.entries(V1)) {
    const p = path.join(baselineDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  const prep = await cs.ensureContentDir({ contentDir, baselineDir });
  assert.equal(prep.prepared, true, '首次应落地基线');
  fs.writeFileSync(path.join(contentDir, cs.MANIFEST_NAME), JSON.stringify(manifest('7.0.0', V1)));
  return { baselineDir, contentDir, stateFile };
}
const replaceFile = (p, body) => { fs.unlinkSync(p); fs.writeFileSync(p, body); }; // 不写穿硬链接
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

async function oneRound(round) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-selfupdate-' + round + '-'));
  const remotes = [];
  try {
    /* ---- 1. 增量下载：版本升级 → 只下载变化文件，旧版留在 .bak ---- */
    {
      const env = await makeEnv(path.join(root, 't1'));
      const m2 = manifest('7.0.1', V2);
      const r = await serve(Object.assign(routesFor(V2), {
        '/content-manifest.json': { body: JSON.stringify(m2) }
      }));
      remotes.push(r);
      const out = await cs.syncContent({ ...env, sources: [r.url], timeoutMs: 1000 });
      assert.equal(out.action, 'updated', 'T1 应完成增量切换');
      assert.equal(out.downloaded, 2, 'T1 应只下载 app.js 与 new.js');
      assert.equal(out.reused, 5, 'T1 其余 5 个文件应复用硬链接');
      assert.equal(read(env.contentDir, 'js/app.js'), 'APP_V2', 'T1 内容应更新');
      assert.equal(read(env.contentDir + '.bak', 'js/app.js'), 'APP_V1', 'T1 旧版应保留在 .bak');
      assert.equal(cs.readLocalManifest(env.contentDir).version, '7.0.1', 'T1 清单版本应更新');
      await close(r); remotes.pop();
    }

    /* ---- 2. sha 校验失败回退：通道1 内容损坏 → 自动试通道2 ---- */
    {
      const dest = path.join(root, 't2', 'bad.js');
      const r1 = await serve({ '/bad.js': { body: 'CORRUPT' } });
      const r2 = await serve({ '/bad.js': { body: 'GOOD' } });
      remotes.push(r1, r2);
      const ok = await cs.downloadFile([r1.url, r2.url], 'bad.js', dest, sha('GOOD'));
      assert.equal(read(path.dirname(dest), 'bad.js'), 'GOOD', 'T2 应落到通道2 的正确内容');
      assert.equal(ok.sourceIndex, 1, 'T2 应记录使用了第二通道');
      const r3 = await serve({ '/bad.js': { body: 'CORRUPT' } });
      remotes.push(r3);
      await assert.rejects(
        cs.downloadFile([r1.url, r3.url], 'bad.js', path.join(root, 't2', 'none.js'), sha('GOOD')),
        e => e.message === 'ALL_SOURCES_FAILED' && e.details.length === 2,
        'T2 双通道都坏时应明确失败并留下两条细节'
      );
      assert.equal(fs.existsSync(path.join(root, 't2', 'none.js')), false, 'T2 失败不应留下残片');
      await close(r1); await close(r2); await close(r3); remotes.splice(0, 3);
    }

    /* ---- 3. 损坏修复：联网优先，离线走打包基线兜底 ---- */
    {
      const env = await makeEnv(path.join(root, 't3'));
      replaceFile(path.join(env.contentDir, 'js/app.js'), 'BROKEN');
      const r = await serve(routesFor(V1));
      remotes.push(r);
      const out = await cs.repairContent({ ...env, sources: [r.url], timeoutMs: 1000 });
      assert.equal(out.fixed, 1, 'T3 应联网修复 1 个文件');
      assert.equal(read(env.contentDir, 'js/app.js'), 'APP_V1', 'T3 修复后内容应正确');
      await close(r); remotes.pop();

      // 再次损坏，切断所有远端 → 必须从只读基线兜底，且不写穿基线
      replaceFile(path.join(env.contentDir, 'js/app.js'), 'BROKEN_AGAIN');
      const dead = 'http://127.0.0.1:1/';
      const out2 = await cs.repairContent({ ...env, sources: [dead], timeoutMs: 300 });
      assert.equal(out2.baselineFixed, 1, 'T3 离线时应从基线兜底');
      assert.equal(read(env.contentDir, 'js/app.js'), 'APP_V1', 'T3 兜底后内容应恢复');
      assert.equal(read(env.baselineDir, 'js/app.js'), 'APP_V1', 'T3 基线不得被写穿');
    }

    /* ---- 4. 双通道切换：通道1 超时 → 通道2 完成同步 ---- */
    {
      const env = await makeEnv(path.join(root, 't4'));
      const m2 = manifest('7.0.2', V2);
      const slow = await serve(Object.assign(routesFor(V2), {
        '/content-manifest.json': { body: JSON.stringify(m2), delayMs: 500 }
      }));
      const good = await serve(Object.assign(routesFor(V2), {
        '/content-manifest.json': { body: JSON.stringify(m2) }
      }));
      remotes.push(slow, good);
      const out = await cs.syncContent({ ...env, sources: [slow.url, good.url], timeoutMs: 100 });
      assert.equal(out.action, 'updated', 'T4 通道1 超时应切到通道2');
      assert.equal(out.version, '7.0.2', 'T4 版本应更新');
      assert.equal(read(env.contentDir, 'js/new.js'), 'NEW_V2', 'T4 内容应来自通道2');
    }

    /* ---- 5. 关键文件校验失败 → 整批回滚，不切换 ---- */
    {
      const env = await makeEnv(path.join(root, 't5'));
      // 清单声明一个「变化过」的 index.html 且 sha 正确，但远端实际返回被篡改的内容 → 校验必然失败
      const declared = Object.assign({}, V2, { 'index.html': 'INDEX_V3' });
      const m2 = manifest('7.0.3', declared);
      const routes = routesFor(V2);
      routes['/index.html'] = { body: 'CORRUPT' };
      const r = await serve(Object.assign(routes, {
        '/content-manifest.json': { body: JSON.stringify(m2) }
      }));
      remotes.push(r);
      const out = await cs.syncContent({ ...env, sources: [r.url], timeoutMs: 1000 });
      assert.equal(out.action, 'critical-failed', 'T5 关键文件坏时应整批回滚');
      assert.equal(read(env.contentDir, 'index.html'), 'INDEX_V1', 'T5 线上内容不得被替换');
      assert.equal(cs.readLocalManifest(env.contentDir).version, '7.0.0', 'T5 版本不得被推进');
    }

    /* ---- 6. 连续两次启动异常 → 自动回滚到 .bak ---- */
    {
      const env = await makeEnv(path.join(root, 't6'));
      // 造出一个「已升级」的当前版本与 .bak，再模拟第二次异常启动
      replaceFile(path.join(env.contentDir, 'js/app.js'), 'APP_V2');
      fs.mkdirSync(env.contentDir + '.bak', { recursive: true });
      for (const [rel, body] of Object.entries(V1)) {
        const p = path.join(env.contentDir + '.bak', rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
      }
      fs.writeFileSync(path.join(env.contentDir, cs.MANIFEST_NAME), JSON.stringify(manifest('7.0.1', V2)));
      fs.writeFileSync(path.join(env.contentDir + '.bak', cs.MANIFEST_NAME), JSON.stringify(manifest('7.0.0', V1)));
      cs.writeState(env.stateFile, { bootPending: true, crashes: 1, version: '7.0.1' });
      const dead = 'http://127.0.0.1:1/';
      const out = await cs.runStartup({ ...env, sources: [dead], timeoutMs: 300 });
      assert.equal(out.rollback && out.rollback.action, 'rolled-back', 'T6 应自动回滚');
      assert.equal(read(env.contentDir, 'js/app.js'), 'APP_V1', 'T6 应恢复到上一版');
      assert.equal(cs.readState(env.stateFile).bootPending, true, 'T6 回滚后应继续保持启动观察');
      assert.equal(cs.readState(env.stateFile).lastRollbackVersion, '7.0.1', 'T6 应冻结被回滚掉的坏版本');
      // 远端若仍是同一个坏版本，应冻结，不把坏内容升回去
      const m2 = manifest('7.0.1', V2);
      const r = await serve(Object.assign(routesFor(V2), {
        '/content-manifest.json': { body: JSON.stringify(m2) }
      }));
      remotes.push(r);
      const frozen = await cs.syncContent({ ...env, sources: [r.url], timeoutMs: 1000 });
      assert.equal(frozen.action, 'frozen', 'T6 同一坏版本应被冻结');
      assert.equal(read(env.contentDir, 'js/app.js'), 'APP_V1', 'T6 冻结后内容仍是回滚版');
    }
  } finally {
    for (const r of remotes) { try { await close(r); } catch (_) {} }
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('  第 ' + round + ' 轮：6 组断言全部通过');
}

console.log('云境自更新引擎自测开始（无外网，本地模拟双通道）');
for (let i = 1; i <= 3; i++) await oneRound(i); // 网络/时间因素同条件跑 3 次，结果须一致
console.log('✅ 自测通过：增量下载 / sha 回退 / 损坏修复 / 双通道切换 / 关键文件回滚 / 崩溃回滚（各 3 轮一致）');
