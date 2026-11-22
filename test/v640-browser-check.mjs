/* v6.4.0 真 Chromium E2E：二创版块 UI + 回档勾选 + 无报错 */
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
  console.log('\n【1】模块加载');
  await p.goto(BASE + 'studio.html?dev=1');
  await p.waitForFunction(() => window.storyFramework && window.FloorState, { timeout: 20000 });
  await p.waitForTimeout(1200);
  const mods = await p.evaluate(() => ({
    zip: typeof window.ZipWriter, gh: typeof window.GithubClient,
    hub: typeof window.CreationHub, ta: typeof window.TimeAxis,
    ver: window.YJ_VER
  }));
  ok(mods.zip === 'object', 'ZipWriter 已加载');
  ok(mods.gh === 'object', 'GithubClient 已加载');
  ok(mods.hub === 'object', 'CreationHub 已加载');
  ok(mods.ta === 'object', 'TimeAxis 已加载');
  ok(/^6\.(4|5)\./.test(mods.ver), 'YJ_VER>=6.4.0 (got ' + mods.ver + ')');

  console.log('\n【2】二创版块面板渲染');
  await p.evaluate(() => window.CreationHub.open());
  await p.waitForTimeout(400);
  const panel = await p.evaluate(() => ({
    root: !!document.getElementById('ch-root'),
    safety: (document.getElementById('ch-root') || {}).textContent?.includes('不审核、不参与、不担责'),
    publishBtn: !!document.getElementById('ch-publish'),
    hasTokenBar: !!document.getElementById('ch-tokenbar')
  }));
  ok(panel.root, '版块面板已打开');
  ok(panel.safety, '安全提醒常驻显示');
  ok(panel.publishBtn, '发布按钮存在');
  ok(panel.hasTokenBar, 'token 状态栏存在');

  console.log('\n【3】发布向导 + 四项确认弹窗');
  await p.click('#ch-publish');
  await p.waitForTimeout(300);
  const wizard = await p.evaluate(() => ({
    visible: document.getElementById('ch-wizard').style.display !== 'none',
    cks: document.querySelectorAll('.wz-ck').length,
    title: !!document.getElementById('wz-title'),
    note: !!document.getElementById('wz-note')
  }));
  ok(wizard.visible, '发布向导显示');
  ok(wizard.cks === 4, '四项确认勾选框 (got ' + wizard.cks + ')');
  ok(wizard.title && wizard.note, '标题/说明输入框存在');

  // 未勾选直接发布 → 应拦截
  await p.fill('#wz-title', '测试作品');
  await p.fill('#wz-note', '新增了某境界数值');
  await p.click('#wz-go');
  await p.waitForTimeout(200);
  const blocked = await p.evaluate(() => document.getElementById('wz-log').textContent);
  ok(/勾选全部四项/.test(blocked), '未勾选时拦截发布 (got: ' + blocked + ')');

  console.log('\n【4】密钥扫描拦截');
  const scan = await p.evaluate(() => {
    const CH = window.CreationHub;
    const withKey = [{ name: 'x.json', data: '{"apiKey":"sk-abcdefghijklmnopqrstuvwxyz"}' }];
    const clean = [{ name: 'x.json', data: '{"world":"测试世界"}' }];
    return { bad: CH._scanSecrets(withKey), good: CH._scanSecrets(clean) };
  });
  ok(scan.bad.length > 0, '含密钥的包被标记');
  ok(scan.good.length === 0, '干净的包通过');

  console.log('\n【5】浏览器内打包 zip 合法');
  const zipOk = await p.evaluate(async () => {
    const z = await window.ZipWriter.makeZip([{ name: 'manifest.json', data: '{"app":"yunjing-fanwork"}' }]);
    return { len: z.length, magic: [z[0], z[1], z[2], z[3]] };
  });
  ok(zipOk.len > 50 && zipOk.magic[0] === 0x50 && zipOk.magic[1] === 0x4b, '浏览器内打包 zip 魔数正确');

  console.log('\n【6】回档面板勾选框');
  await p.evaluate(() => window.CreationHub.close());
  await p.waitForTimeout(200);
  // 造几轮数据后开时光轴
  await p.evaluate(async () => {
    const fw = window.storyFramework;
    for (let i = 0; i < 3; i++) {
      fw.pushTurnSnapshot('指令' + i);
      if (fw._fsQueue) await fw._fsQueue;
      fw.storyState.variables = { round: i };
      fw.storyState.conversationHistory.push({ role: 'user', content: '指令' + i });
      fw.storyState.conversationHistory.push({ role: 'assistant', content: '正文' + i });
    }
  });
  await p.evaluate(() => window.TimeAxis.open());
  await p.waitForFunction(() => document.querySelectorAll('#taList .ta-row').length > 0, { timeout: 10000 });
  const ta = await p.evaluate(() => ({
    persistCb: !!document.getElementById('taPersist'),
    rows: document.querySelectorAll('#taList .ta-row').length,
    defaultOff: document.getElementById('taPersist') && !document.getElementById('taPersist').checked
  }));
  ok(ta.persistCb, '回档勾选框存在');
  ok(ta.rows > 0, '时光轴有回档层');
  ok(ta.defaultOff, '勾选框默认关闭');
  // 切换勾选
  await p.evaluate(() => window.TimeAxis.setPersistent(true));
  const toggled = await p.evaluate(() => window.TimeAxis._persistent());
  ok(toggled === true, '勾选状态可切换');

  console.log('\n【7】JS 错误');
  ok(errs.length === 0, '零 JS 错误 ' + (errs.length ? '→ ' + errs.slice(0, 3).join(' | ') : ''));

} catch (e) {
  fail++; console.log('  异常:', e.message, e.stack);
} finally {
  console.log('\n=== 结果: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  await b.close();
  process.exit(fail ? 1 : 0);
}
