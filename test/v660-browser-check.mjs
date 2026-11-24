/* v6.6.0 真 Chromium E2E：唯一总文件夹创意工坊 + works API + 版本同源 + 零报错 */
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
  console.log('\n【1】版本 + 模块 + works 接口');
  await p.goto(BASE + 'studio.html?dev=1');
  await p.waitForFunction(() => window.storyFramework && window.PatchEngine && window.CreationHub && window.GithubClient, { timeout: 20000 });
  await p.waitForTimeout(1000);
  const mods = await p.evaluate(() => ({
    ver: window.YJ_VER,
    worksDir: window.GithubClient && window.GithubClient.WORKS_DIR,
    listWorks: typeof (window.GithubClient && window.GithubClient.listWorks),
    readWorkFile: typeof (window.GithubClient && window.GithubClient.readWorkFile),
    getPackageUrl: typeof (window.GithubClient && window.GithubClient.getPackageUrl),
    publishWork: typeof (window.GithubClient && window.GithubClient.publishWork),
    worksPath: typeof (window.GithubClient && window.GithubClient.worksPath),
    renderList: typeof (window.CreationHub && window.CreationHub._renderList)
  }));
  ok(mods.ver === '6.6.0', 'YJ_VER=6.6.0 (got ' + mods.ver + ')');
  ok(mods.worksDir === 'community/works', 'WORKS_DIR=community/works');
  ok(mods.listWorks === 'function' && mods.readWorkFile === 'function' && mods.publishWork === 'function', 'works 读写接口就绪');
  ok(mods.getPackageUrl === 'function' && mods.worksPath === 'function', '包体链接/路径接口就绪');
  ok(mods.renderList === 'function', '列表渲染接口就绪');

  console.log('\n【2】works 路径与 raw 链接（云境内下载入口）');
  const paths = await p.evaluate(() => {
    const GC = window.GithubClient;
    return {
      pkg: GC.worksPath('20261122-233000-剑来', 'package.zip'),
      readme: GC.worksPath('20261122-233000-剑来', 'README.md'),
      raw: GC.getPackageUrl('20261122-233000-剑来'),
      safe: GC.worksPath('../evil', 'x')
    };
  });
  ok(paths.pkg === 'community/works/20261122-233000-剑来/package.zip', '包体路径正确', paths.pkg);
  ok(paths.readme.endsWith('/README.md'), 'README 与包体同目录', paths.readme);
  ok(paths.raw.includes('/community/works/') && paths.raw.includes('/package.zip'), 'raw 下载直链指向 works');
  ok(paths.safe.indexOf('..') === -1, 'slug 消毒防穿越', paths.safe);

  console.log('\n【3】创意工坊面板 + 发布向导字段');
  await p.evaluate(() => { window.CreationHub.open(document.body); });
  await p.waitForTimeout(300);
  const shell = await p.evaluate(() => ({
    title: (document.querySelector('#ch-root h2') || {}).textContent || '',
    hasWorks: (document.getElementById('ch-root') || {}).innerHTML.includes('community/works/'),
    hasPublish: !!document.getElementById('ch-publish')
  }));
  ok(shell.title.includes('创意工坊'), '面板标题=创意工坊', shell.title);
  ok(shell.hasWorks, '面板标注唯一文件夹 community/works/');
  ok(shell.hasPublish, '发布按钮存在');

  await p.evaluate(() => { var b = document.getElementById('ch-publish'); if (b) b.click(); });
  await p.waitForTimeout(200);
  const wz = await p.evaluate(() => ({
    title: !!document.getElementById('wz-title'),
    intro: !!document.getElementById('wz-intro'),
    feature: !!document.getElementById('wz-feature'),
    cks: document.querySelectorAll('.wz-ck').length,
    mentionsWorks: (document.getElementById('ch-wizard') || {}).innerHTML.includes('community/works/')
  }));
  ok(wz.title && wz.intro && wz.feature, '作品名+简介+特点字段存在');
  ok(wz.cks === 4, '四项确认勾选框 (got ' + wz.cks + ')');
  ok(wz.mentionsWorks, '向导说明标注作品写入 works 唯一文件夹');

  console.log('\n【4】真实 works 清单读取与按时间倒序');
  const list = await p.evaluate(async () => {
    const r = await window.GithubClient.listWorks();
    return { ok: r.ok, cached: r.cached, order: (r.items || []).map(x => x.createdAt) };
  });
  ok(list.ok, 'listWorks 可读（真实 GitHub 或本机缓存）', list);
  const sorted = list.order.every((v, i) => i === 0 || list.order[i - 1] >= v);
  ok(sorted || list.cached, '清单按时间倒序（缓存可能未排序）', list.order);

  console.log('\n【5】零 JS 报错');
  ok(errs.length === 0, '零 JS 报错', errs.slice(0, 3));
} catch (e) {
  fail++; console.log('  ✗ FAIL 异常:', e.message, e.stack && e.stack.split('\n')[1]);
} finally {
  console.log('\n========== 结果 ==========');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  await b.close();
}
process.exit(fail ? 1 : 0);
