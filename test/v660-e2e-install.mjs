/* v6.6.0 真机：云境内读真实 works 清单 → 一键下载 → 新档解包安装 → 不坏档 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const TOKEN = readFileSync('/root/.codebuddy/security/gh_token.txt', 'utf-8').trim();
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL ' + m + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
try {
  console.log('\n【1】全新档加载云境，注入 token（仅本机）');
  await p.goto(BASE + 'studio.html?dev=1');
  await p.waitForFunction(() => window.PatchEngine && window.ContentAdapters && window.ZipWriter && window.GithubClient && window.CreationHub, { timeout: 20000 });
  await p.evaluate(t => window.GithubClient.setToken(t), TOKEN);
  await p.waitForTimeout(500);

  console.log('\n【2】云境内读真实 works 清单（GitHub contents API）');
  const list = await p.evaluate(async () => {
    const r = await window.GithubClient.listWorks();
    return { ok: r.ok, cached: r.cached, items: (r.items || []).map(x => ({ slug: x.slug, title: x.title, createdAt: x.createdAt })) };
  });
  ok(list.ok && !list.cached, '读到真实远端清单（非缓存）', list);
  ok(list.items.length >= 1, '清单含作品', list.items.length);
  ok(list.items.some(x => x.slug.includes('剑来')), '含刚发布的剑来工坊版', list.items);
  const target = list.items.find(x => x.slug.includes('剑来'));

  console.log('\n【3】云境内读 README 四段（简介与包体同处的说明）');
  const rd = await p.evaluate(async (slug) => {
    const r = await window.GithubClient.readWorkFile(slug, 'README.md');
    if (!r.ok) return { ok: false, error: r.error };
    const s = window.CreationHub._parseSections(r.text);
    return { ok: true, v2: s.v2, intro: s.intro, feature: s.feature, content: s.content };
  }, target.slug);
  ok(rd.ok && rd.v2, 'README 可读且四段式', rd);
  ok(rd.intro && rd.intro.includes('武夫'), '① 简介内容正确', rd.intro);
  ok(rd.feature && rd.feature.includes('止境'), '② 特点内容正确', rd.feature);
  ok(rd.content && rd.content.includes('DLC'), '③ 二创内容正确', rd.content);

  console.log('\n【4】云境内一键下载 package.zip（raw 直链，编码中文路径）');
  const dl = await p.evaluate(async (slug) => {
    // 加时间戳绕过 raw CDN 缓存（刚发布时 raw 有传播延迟）
    const url = window.GithubClient.getPackageUrl(slug) + '?t=' + Date.now();
    const r = await window.GithubClient.downloadGistRaw(url);
    if (!r.ok) return { ok: false, error: r.error, url };
    const first = String(r.text || '');
    const isZip = first.charCodeAt(0) === 0x50 && first.charCodeAt(1) === 0x4b && first.charCodeAt(2) === 0x03;
    return { ok: true, isZip, bytes: r.bytes ? r.bytes.length : 0 };
  }, target.slug);
  ok(dl.ok, '包体下载成功', dl);
  ok(dl.isZip && dl.bytes > 0, '识别为原始 zip 字节（v6.5.1 魔数兼容）', dl);

  console.log('\n【5】解包 → 三方合并 → 新档安装（复用 openInstall 全流程）');
  const inst = await p.evaluate(async (slug) => {
    const PE = window.PatchEngine, ZW = window.ZipWriter, CA = window.ContentAdapters, GC = window.GithubClient;
    const d = await GC.getWorkPackageBytes(slug);
    if (!d.ok) return { err: 'download:' + d.error };
    const u8 = d.bytes;
    const files = await ZW.unzip(u8);
    const mf = JSON.parse(ZW.entryText(files.find(f => f.name === 'manifest.json')));
    const theirs = (mf.changes || []).map(c => {
      const f = files.find(x => x.name === c.file);
      const data = f ? JSON.parse(ZW.entryText(f)).data : PE.TOMB;
      return { key: c.key, kind: c.kind, hash: c.newHash || PE.hash(data), data };
    });
    const ours = CA.collect({}).items; // 新档：空/默认
    const base = ours.map(x => ({ key: x.key, kind: x.kind, hash: x.hash })); // 无基线→整包视角
    const decisions = PE.plan([], ours, theirs);
    const sum = PE.summarize(decisions);
    const ops = PE.applyList(decisions);
    const res = CA.apply(ops, CA.localWriter());
    // 验证 DLC 落位
    const raw = localStorage.getItem('storyDLC_free') || (localStorage.getItem('dlc/storyDLC_free') || '');
    let hasDlc = false, dlcTitle = '';
    try { const o = JSON.parse(raw); hasDlc = !!(o.dlcPackages && o.dlcPackages.length); dlcTitle = hasDlc ? o.dlcPackages[0].name : ''; } catch (e) {}
    return { sum, applied: res.done.length, errors: res.errors, hasDlc, dlcTitle, raw: raw.slice(0, 80) };
  }, target.slug);
  ok(inst.applied >= 1, '应用了改动项', inst.sum);
  ok(inst.errors && inst.errors.length === 0, '写回无错误', inst.errors);
  ok(inst.hasDlc, '★ DLC 在新档就位（不坏档）', inst);
  ok((inst.dlcTitle || '').includes('武夫'), 'DLC 内容正确（武夫十一境）', inst.dlcTitle);

  console.log('\n【6】零 JS 报错');
  ok(errs.length === 0, '零 JS 报错', errs.slice(0, 3));
} catch (e) {
  fail++; console.log('  ✗ FAIL 异常:', e.message, e.stack && e.stack.split('\n')[1]);
} finally {
  console.log('\n========== 结果 ==========');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  await b.close();
}
process.exit(fail ? 1 : 0);
