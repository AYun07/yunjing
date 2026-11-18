import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:9144/';
const SHOT = '/workspace/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('JS错误: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errs.push('console错误: ' + m.text()); });
const log = (...a) => console.log(...a);

try {
  // ---------- 步骤1：从云境开场页进入 ----------
  log('\n【步骤1】打开云境开场页 opening.html');
  await p.goto(BASE + 'opening.html');
  await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.removeItem('xy_modules'); localStorage.removeItem('xy_dev_cfg'); });
  log('  开场页标题:', await p.title());
  log('  四个入口:', await p.$$eval('.entry .name', els => els.map(e => e.textContent).join(' / ')));
  await p.screenshot({ path: SHOT + '实测1-云境开场页.png' });

  // ---------- 步骤2：点"造物"入口 ----------
  log('\n【步骤2】点击"造物"入口，观察跳转');
  await p.click('.entry[data-go="forge"]');
  await p.waitForTimeout(900);
  log('  当前URL:', p.url());
  log('  到达页面标题:', await p.title());
  const cards = await p.$$eval('#grid .card h2', els => els.map(e => e.textContent));
  log('  造物中枢卡片:', cards.join(' / '));
  await p.screenshot({ path: SHOT + '实测2-造物中枢页.png', fullPage: true });

  // ---------- 步骤3：打开造物工坊 ----------
  log('\n【步骤3】点"造物工坊"卡片，打开小云开发面板');
  await p.click('#grid .card button[data-i="0"]');
  await p.waitForTimeout(500);
  const devOpen = await p.evaluate(() => !!document.querySelector('.xy-dev.on'));
  log('  造物工坊面板弹出:', devOpen);
  log('  大模型接入预设:', await p.$$eval('.xy-dev select option', els => els.map(e => e.textContent).join(' / ')));
  const keyVal = await p.$eval('.xy-dev input[type="password"]', e => e.value);
  log('  当前API Key:', keyVal ? '(有值)' : '(空 → 将走内置模板演示模式)');
  await p.screenshot({ path: SHOT + '实测3-造物工坊面板.png' });

  // ---------- 步骤4：填需求并让小云开工 ----------
  log('\n【步骤4】输入需求"随机世界骰子"，让小云开工生成模块');
  await p.fill('.xy-dev textarea', '加一个「随机世界骰子」模块，廿八界随机漫游、命运三连抽、结果可回溯，界面贴合云境世界观');
  await p.click('.xy-dev .go');
  log('  已点击"让小云开工"，等待生成 + 自检…');
  await p.waitForTimeout(3600);
  const status = await p.$eval('.xy-dev .status', e => e.textContent);
  log('  生成状态:', status);
  const srcdocLen = await p.evaluate(() => { const f = document.querySelector('.xy-dev .prev iframe'); return f && f.srcdoc ? f.srcdoc.length : 0; });
  log('  预览iframe代码长度:', srcdocLen, '字符');
  const prevHasContent = await p.evaluate(() => { const f = document.querySelector('.xy-dev .prev iframe'); return !!(f && f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText.trim()); });
  log('  预览区有渲染内容:', prevHasContent);
  const prevText = await p.evaluate(() => { const f = document.querySelector('.xy-dev .prev iframe'); try { return f.contentDocument.body.innerText.replace(/\s+/g, ' ').slice(0, 160); } catch (e) { return '(跨域不可读)'; } });
  log('  生成模块界面文字:', prevText);
  await p.screenshot({ path: SHOT + '实测4-生成模块预览.png' });

  // ---------- 步骤5：挂载到大厅 ----------
  log('\n【步骤5】点"挂载到大厅"');
  await p.evaluate(() => { const bs = [...document.querySelectorAll('.xy-dev .pbtn')]; const t = bs.find(x => x.textContent.includes('挂载')); t && t.click(); });
  await p.waitForTimeout(400);
  const mods = await p.evaluate(() => JSON.parse(localStorage.getItem('xy_modules') || '[]'));
  log('  挂载后模块库:', JSON.stringify(mods.map(m => ({ name: m.name, codeLen: m.html.length }))));
  await p.screenshot({ path: SHOT + '实测5-挂载成功.png' });

  // ---------- 步骤6：刷新验证不丢 ----------
  log('\n【步骤6】刷新页面，验证模块是否还在（刷新不丢）');
  await p.reload();
  await p.waitForTimeout(1000);
  const mods2 = await p.evaluate(() => JSON.parse(localStorage.getItem('xy_modules') || '[]'));
  log('  刷新后模块库:', JSON.stringify(mods2.map(m => m.name)));
  log('  刷新不丢:', mods2.length > 0 ? '✅ 是' : '❌ 否');

  // ---------- 步骤7：运行已装模块 ----------
  log('\n【步骤7】从"已装模块"点运行，验证真的能跑起来');
  await p.click('#grid .card button[data-i="0"]');
  await p.waitForTimeout(400);
  const installedBtns = await p.$$eval('.xy-dev .installed button', els => els.map(e => e.textContent));
  log('  已装模块列表按钮:', installedBtns.join(' / '));
  await p.evaluate(() => { const bs = [...document.querySelectorAll('.xy-dev .installed button')]; const t = bs.find(x => x.textContent === '运行'); t && t.click(); });
  await p.waitForTimeout(700);
  const layers = await p.$$eval('.xy-dev.on', els => els.length);
  log('  运行弹层数量:', layers);
  const runFrames = await p.$$eval('.xy-dev iframe', els => els.map(f => (f.srcdoc || '').length));
  log('  运行iframe代码长度:', JSON.stringify(runFrames));
  await p.screenshot({ path: SHOT + '实测6-模块运行.png' });

  log('\n========== 汇总 ==========');
  log('JS错误数:', errs.length);
  if (errs.length) log(errs.join('\n'));
  log('模块生成:', status.includes('自检通过') || status.includes('生成') ? '✅ 完成' : '⚠ 见状态');
  log('挂载:', mods.length > 0 ? '✅' : '❌', '| 刷新不丢:', mods2.length > 0 ? '✅' : '❌', '| 运行:', layers >= 1 ? '✅' : '❌');

} catch (e) {
  log('\n!!! 测试脚本异常:', e.message);
  log(e.stack);
} finally {
  await b.close();
}
