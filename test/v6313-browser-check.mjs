/**
 * 云境 v6.3.12 真浏览器 E2E：复杂世界（多时代/多体系/嵌套宇宙）在界面上的处理。
 * 运行前先起静态服务：python3 -m http.server 8935 --bind 127.0.0.1
 * 运行：node test/v6313-browser-check.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:8935';
const SHOTS = '/workspace/yunjing/shots-v6312';
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

async function openPanel(genre) {
  await page.goto(BASE + '/studio.html?dev=1&genre=' + genre, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.ComparePanel && window.CompareEngine && window.RealmRules), null, { timeout: 15000 });
  await page.evaluate(() => window.ComparePanel.open());
  await page.waitForSelector('#cp-cmp-ov.on', { timeout: 5000 });
}

console.log('\n### 1. 斗罗：多时代 + 4 套分部体系在面板可见');
await openPanel('douluodalu');
const dou = await page.evaluate(() => ({
  title: document.querySelector('#cp-cmp-hd h3')?.textContent || '',
  ladder: document.querySelector('[data-sec="ladder"]')?.textContent || '',
  sysOpts: Array.from(document.querySelectorAll('#cx-sys-from option')).map(o => o.textContent),
  nested: (document.querySelector('[data-sec="ladder"]')?.textContent || '').indexOf('嵌套世界观') >= 0
}));
ok(dou.title.indexOf('斗罗') >= 0, '面板标题为斗罗大陆：' + dou.title);
ok(dou.ladder.indexOf('原著分部体系') >= 0 && dou.ladder.indexOf('4 套并行') >= 0, '阶梯页展示 4 套分部体系');
ok(dou.sysOpts.length === 5, '体系选择器含主阶梯 + 4 副体系，共 5 项（实得 ' + dou.sysOpts.length + '）');
ok(dou.ladder.indexOf('第三部') >= 0 && dou.ladder.indexOf('神界崩塌') >= 0, '分部体系逐套列出且标注时代差异');
await page.screenshot({ path: SHOTS + '/v6312-douluo-ladder.png' });

console.log('\n### 2. 斗罗：跨体系选择在界面上触发硬拒绝');
await page.click('.cp-cmp-tab[data-tab="cross"]'); // 真实用户先切到比对页，否则报告在隐藏页里看不见
await page.evaluate(() => {
  const a = document.querySelector('#cx-sys-from');
  a.value = 'douluodalu_sub3';
  a.dispatchEvent(new Event('change', { bubbles: true }));
});
const afterSwitch = await page.evaluate(() => ({
  fromOpts: Array.from(document.querySelectorAll('#cx-from option')).map(o => o.textContent),
  first: document.querySelector('#cx-from').value
}));
ok(afterSwitch.fromOpts.some(t => t.indexOf('一字斗铠') >= 0), '切换体系后境界下拉同步为斗铠轴');
ok(!afterSwitch.fromOpts.some(t => t.indexOf('魂士') >= 0), '切换后不再混入主阶梯选项');
await page.evaluate(() => {
  document.querySelector('#cx-to').value = '封号斗罗';
  document.querySelector('#cx-go').click();
});
const reject = await page.evaluate(() => ({
  text: document.querySelector('#cx-out')?.textContent || '',
  cls: document.querySelector('#cx-out')?.className || ''
}));
ok(reject.text.indexOf('跨体系') >= 0 && reject.text.indexOf('禁止互比') >= 0, '界面给出明确跨体系拒绝报告');
ok(reject.cls.indexOf('bad') >= 0, '拒绝报告以警示态呈现');
await page.screenshot({ path: SHOTS + '/v6312-douluo-reject.png' });

console.log('\n### 3. 超神：嵌套宇宙层在界面可见并隔离');
await openPanel('chaoshenxueyuan');
const cs = await page.evaluate(() => ({
  ladder: document.querySelector('[data-sec="ladder"]')?.textContent || '',
  sysOpts: document.querySelectorAll('#cx-sys-from option').length
}));
ok(cs.ladder.indexOf('嵌套世界观层') >= 0 && cs.ladder.indexOf('2 层') >= 0, '阶梯页展示 2 层嵌套世界观');
ok(cs.ladder.indexOf('已知宇宙') >= 0 && cs.ladder.indexOf('未知宇宙') >= 0, '已知/未知宇宙两层分别标注');
ok(cs.ladder.indexOf('不可按序号互比') >= 0, '明示层间不可互比');
ok(cs.sysOpts === 1, '超神无副体系时体系选择器只有主阶梯');
await page.screenshot({ path: SHOTS + '/v6312-chaoshen-nested.png' });

console.log('\n### 4. 剑来：副体系不可与主阶梯互比（界面路径）');
await openPanel('jianlai');
await page.click('.cp-cmp-tab[data-tab="cross"]');
await page.evaluate(() => {
  const a = document.querySelector('#cx-sys-from');
  a.value = 'jianlai_sub1';
  a.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#cx-from').value = '金身';
  document.querySelector('#cx-to').value = '金丹';
  document.querySelector('#cx-go').click();
});
const jl = await page.evaluate(() => document.querySelector('#cx-out')?.textContent || '');
ok(jl.indexOf('纯粹武夫') >= 0 && jl.indexOf('禁止互比') >= 0, '武夫金身 vs 练气金丹被拒绝并点名体系');
await page.screenshot({ path: SHOTS + '/v6312-jianlai-reject.png' });

console.log('\n### 5. v6.3.13 跨层对敌：面板第 4 tab 真实交互');
await openPanel('swallowedstar');
const layerTab = await page.$('.cp-cmp-tab[data-tab="layer"]');
ok(!!layerTab, '吞噬星空面板显示「④ 跨层对敌」tab');
if (layerTab) {
  await page.click('.cp-cmp-tab[data-tab="layer"]');
  // 我方地球篇·战士级，对手浑源层·浑源领主，给缘由 + 高加成
  await page.evaluate(() => {
    document.querySelector('#ly-from').value = 'earth';
    document.querySelector('#ly-from').dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#ly-to').value = 'hunyuan';
    document.querySelector('#ly-to').dispatchEvent(new Event('change', { bubbles: true }));
  });
  const opts2 = await page.evaluate(() => ({
    fromTiers: Array.from(document.querySelectorAll('#ly-from-tier option')).map(o => o.textContent),
    toTiers: Array.from(document.querySelectorAll('#ly-to-tier option')).map(o => o.textContent)
  }));
  ok(opts2.fromTiers.indexOf('战士级') >= 0, '切换层后我方境界下拉为该层境界轴');
  ok(opts2.toTiers.indexOf('浑源领主') >= 0, '对手层境界下拉为浑源层境界');
  await page.evaluate(() => {
    document.querySelector('#ly-from-tier').value = '战士级';
    document.querySelector('#ly-to-tier').value = '浑源领主';
    document.querySelector('#ly-tj').value = '顶级天骄';
    document.querySelector('#ly-cb').value = '80';
    document.querySelector('#ly-nar').value = '神王跨界出手压制';
    document.querySelector('#ly-go').click();
  });
  const layerRep = await page.evaluate(() => ({
    text: document.querySelector('#ly-out')?.textContent || '',
    cls: document.querySelector('#ly-out')?.className || ''
  }));
  ok(layerRep.text.indexOf('层位') >= 0 && layerRep.text.indexOf('档') >= 0, '报告含层位折算信息');
  ok(layerRep.text.indexOf('估算') >= 0, '浑源层倍率标注为估算');
  ok(layerRep.text.indexOf('计算：') >= 0, '报告展示可追溯的计算公式');
  ok(layerRep.cls.indexOf('warn') >= 0, '估算折算以警示态呈现');
  await page.screenshot({ path: SHOTS + '/v6313-crosslayer.png' });
}
// 无嵌套层世界不应显示第 4 tab
await openPanel('doupocangqiong');
ok(!(await page.$('.cp-cmp-tab[data-tab="layer"]')), '无嵌套层的斗破苍穹不显示跨层 tab');

console.log('\n### 6. 控制台无错误');
ok(errors.length === 0, '无 console error / pageerror' + (errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''));

console.log('\nE2E 汇总：PASS ' + pass + ' / FAIL ' + fail);
await browser.close();
process.exit(fail ? 1 : 0);
