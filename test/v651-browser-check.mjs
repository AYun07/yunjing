/* v6.5.1 真 Chromium E2E：四段式 + 唯一区域 + 表单字段 + 列表渲染 + 零报错 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && /undefined|not defined|ReferenceError|TypeError/.test(m.text())) errs.push(m.text()); });
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m, x !== undefined ? JSON.stringify(x) : ''); } };

try {
  console.log('\n【1】版本 + 模块 + 新接口');
  await p.goto(BASE + 'studio.html?dev=1');
  await p.waitForFunction(() => window.storyFramework && window.PatchEngine && window.CreationHub, { timeout: 20000 });
  await p.waitForTimeout(1000);
  const mods = await p.evaluate(() => ({
    ver: window.YJ_VER,
    fourBuild: typeof (window.PatchEngine && window.PatchEngine.buildFourSectionBody),
    fourParse: typeof (window.PatchEngine && window.PatchEngine.parseFourSectionBody),
    fourValid: typeof (window.PatchEngine && window.PatchEngine.validateFourSection),
    upload: typeof (window.GithubClient && window.GithubClient.uploadPackageFile),
    pkgDir: window.GithubClient && window.GithubClient.PACKAGE_DIR,
    label: window.GithubClient && window.GithubClient.LABEL,
    parseSections: typeof (window.CreationHub && window.CreationHub._parseSections)
  }));
  ok(mods.ver === '6.5.1', 'YJ_VER=6.5.1 (got ' + mods.ver + ')');
  ok(mods.fourBuild === 'function' && mods.fourParse === 'function' && mods.fourValid === 'function', '四段式编解码接口就绪');
  ok(mods.upload === 'function', '包体上传接口就绪');
  ok(mods.pkgDir === 'community/packages', '唯一包体目录正确');
  ok(mods.label === '二创投稿', '唯一标签正确');
  ok(mods.parseSections === 'function', '列表四段解析就绪');

  console.log('\n【2】浏览器内四段式编解码往返');
  const rt = await p.evaluate(() => {
    const PE = window.PatchEngine;
    const body = PE.buildFourSectionBody({ intro: '简介A', feature: '特点B', content: '内容C', pkg: { dir: 'community/packages', files: ['x.zip.b64'] } });
    const par = PE.parseFourSectionBody(body);
    const vfull = PE.validateFourSection({ intro: 'a', feature: 'b', content: 'c', pkg: { dir: 'x' } });
    const vmiss = PE.validateFourSection({ intro: '', feature: '', content: 'c', pkg: {} });
    return { intro: par.intro, feature: par.feature, content: par.content, pkgDir: par.pkg.dir, vfull: vfull.ok, vmissMissing: vmiss.missing };
  });
  ok(rt.intro === '简介A' && rt.feature === '特点B' && rt.content === '内容C', '四段往返一致', rt);
  ok(rt.pkgDir === 'community/packages', '打包源码段解析正确');
  ok(rt.vfull === true, '齐全校验通过');
  ok(rt.vmissMissing.length === 3, '缺段校验列出3项', rt.vmissMissing);

  console.log('\n【3】发布向导四段字段');
  await p.evaluate(() => { window.CreationHub.open(document.body); });
  await p.waitForTimeout(300);
  // 点"发布我的二创"按钮展开四段式表单
  await p.evaluate(() => { var b = document.getElementById('ch-publish'); if (b) b.click(); });
  await p.waitForTimeout(200);
  const wz = await p.evaluate(() => ({
    title: !!document.getElementById('wz-title'),
    intro: !!document.getElementById('wz-intro'),
    feature: !!document.getElementById('wz-feature'),
    noteGone: !document.getElementById('wz-note'),
    fourHint: (document.getElementById('ch-wizard') || document.body).innerHTML.indexOf('四段') >= 0,
    noJsClaim: (document.getElementById('ch-wizard') || document.body).innerHTML.indexOf('主程序') >= 0
  }));
  ok(wz.title && wz.intro && wz.feature, '作品名+简介+特点字段齐全', wz);
  ok(wz.noteGone, '旧单段 note 字段已移除');
  ok(wz.fourHint, '页面展示四段结构说明');
  ok(wz.noJsClaim, '页面如实披露打包源码边界');

  console.log('\n【4】列表渲染四段（mock 数据）');
  const list = await p.evaluate(() => {
    const CH = window.CreationHub;
    const fourBody = window.PatchEngine.buildFourSectionBody({ intro: 'I1', feature: 'F1', content: 'C1', pkg: { dir: 'community/packages', files: ['a', 'b'], innerFiles: ['1', '2', '3'] } });
    const oldBody = '<!--YJ_NOTE-->OLD<!--/YJ_NOTE-->';
    const s1 = CH._parseSections(fourBody), s2 = CH._parseSections(oldBody);
    return { s1v2: s1.v2, s1intro: s1.intro, s2v2: s2.v2, s2intro: s2.intro };
  });
  ok(list.s1v2 === true && list.s1intro === 'I1', '四段作品解析正确', list);
  ok(list.s2v2 === false && list.s2intro === 'OLD', '老作品回退正确', list);

  console.log('\n【5】零 JS 报错');
  ok(errs.length === 0, '无 console/page 错误', errs.slice(0, 4));

} catch (e) {
  fail++; console.log('  ✗ 异常:', e.message, e.stack?.split('\n')[1]);
} finally {
  await b.close();
}
console.log('\n========== 结果 ==========');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
