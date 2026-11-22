/* v6.5.0 真 Chromium E2E：增量补丁组件加载 + 打包/解包 + 三方合并 + 安装面板 + 无报错 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && /undefined|not defined|ReferenceError|TypeError/.test(m.text())) errs.push(m.text()); });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

try {
  console.log('\n【1】模块加载与版本同源');
  await p.goto(BASE + 'studio.html?dev=1');
  await p.waitForFunction(() => window.storyFramework && window.PatchEngine && window.ContentAdapters, { timeout: 20000 });
  await p.waitForTimeout(1000);
  const mods = await p.evaluate(() => ({
    pe: typeof window.PatchEngine, ca: typeof window.ContentAdapters,
    zip: typeof window.ZipWriter, gh: typeof window.GithubClient,
    hub: typeof window.CreationHub, ta: typeof window.TimeAxis,
    ver: window.YJ_VER,
    unzip: typeof (window.ZipWriter && window.ZipWriter.unzip),
    dlRaw: typeof (window.GithubClient && window.GithubClient.downloadGistRaw),
    install: typeof (window.CreationHub && window.CreationHub._openInstall)
  }));
  ok(mods.pe === 'object', 'PatchEngine 已加载');
  ok(mods.ca === 'object', 'ContentAdapters 已加载');
  ok(mods.zip === 'object' && mods.unzip === 'function', 'ZipWriter.unzip 就绪');
  ok(mods.gh === 'object' && mods.dlRaw === 'function', 'GithubClient.downloadGistRaw 就绪');
  ok(mods.hub === 'object' && mods.install === 'function', 'CreationHub 增量安装入口就绪');
  ok(mods.ta === 'object', 'TimeAxis 已加载');
  ok(mods.ver === '6.5.0', 'YJ_VER=6.5.0 (got ' + mods.ver + ')');

  console.log('\n【2】浏览器内打包 → 解包字节一致');
  const roundtrip = await p.evaluate(async () => {
    const zip = await window.ZipWriter.makeZip([
      { name: 'manifest.json', data: '{"app":"yunjing-patch"}' },
      { name: 'content/0.json', data: '{"key":"preset/测试","data":"中文✅"}' }
    ]);
    const out = await window.ZipWriter.unzip(zip);
    return { n: out.length, m: window.ZipWriter.entryText(out[0]), c: window.ZipWriter.entryText(out[1]) };
  });
  ok(roundtrip.n === 2, '解包2条目');
  ok(roundtrip.m.includes('yunjing-patch'), 'manifest 一致');
  ok(roundtrip.c.includes('中文✅'), '中文正文一致');

  console.log('\n【3】浏览器内三方合并（稀疏补丁语义）');
  const plan = await p.evaluate(() => {
    const PE = window.PatchEngine;
    const base = [PE.item('a','preset','1'), PE.item('b','dlc','1')];
    const ours = [PE.item('a','preset','1'), PE.item('b','dlc','LOCAL')];
    const theirs = [PE.item('a','preset','2')]; // 稀疏：只改 a，未涉及 b
    const d = PE.plan(base, ours, theirs);
    const m = {};
    d.forEach(x => m[x.key] = x.action);
    return m;
  });
  ok(plan['a'] === 'overwrite', 'a: 本地没改→覆盖');
  ok(plan['b'] === 'keep', 'b: 作者未涉及→保留本地 (got ' + plan['b'] + ')');

  console.log('\n【4】内容采集器（真实 localStorage，注入测试键）');
  const collected = await p.evaluate(() => {
    const k = 'statusPreset__e2e_test__';
    localStorage.setItem(k, '{"theme":"dark","apiKey":"sk-abcdefghijklmnop"}');
    const r = window.ContentAdapters.collect({});
    const found = r.items.find(x => x.key.indexOf(k) >= 0);
    localStorage.removeItem(k);
    return { found: !!found, stripped: found ? !/sk-abcdef/.test(found.data) : false, kind: found && found.kind };
  });
  ok(collected.found, '测试预设键被采集');
  ok(collected.kind === 'preset', '归类为预设');
  ok(collected.stripped, '存档/预设密钥被剥离');

  console.log('\n【5】二创版块面板 + 安装按钮');
  await p.evaluate(() => window.CreationHub.open());
  await p.waitForTimeout(300);
  const panel = await p.evaluate(() => ({
    root: !!document.getElementById('ch-root'),
    safety: (document.getElementById('ch-root') || {}).textContent?.includes('不审核、不参与、不担责'),
    publishBtn: !!document.getElementById('ch-publish')
  }));
  ok(panel.root, '版块面板打开');
  ok(panel.safety, '安全提醒常驻');
  ok(panel.publishBtn, '发布按钮存在');

  console.log('\n【6】无运行时报错');
  ok(errs.length === 0, '无 console/page 报错' + (errs.length ? ': ' + errs.slice(0,3).join(' | ') : ''));

} catch (e) {
  fail++; console.log('  ✗ 异常:', e.message);
} finally {
  await b.close();
}
console.log('\n========== 结果 ==========');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
