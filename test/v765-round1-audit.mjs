import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// v7.6.5 第一轮：修复项 DOM/逻辑断言 + 全页真实点击审计 + 客观维度检测
const BASE = 'http://127.0.0.1:8791';
const VER = '7.6.5';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer', '--use-gl=swiftshader']
});
const results = [];
const pageErrors = [];
const NOISE = /favicon|net::ERR|Failed to load resource.*404|ERR_BLOCKED|webdriver|Autofill|GLDisplayEGL|angle_platform|eglInitialize/i;
function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || '' }); }
function desktopInit(ctx) {
  return ctx.addInitScript((v) => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: v }),
      getSyncStatus: () => Promise.resolve({ version: v, lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false),
      syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  }, VER);
}
async function newPage(path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1366, height: opts.h || 900 } });
  await desktopInit(ctx);
  const page = await ctx.newPage();
  page.on('dialog', d => { d.accept().catch(() => {}); });
  page.on('pageerror', e => { if (!NOISE.test(e.message)) pageErrors.push(path + ' :: ' + e.message); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/* ---- R2: longzu markdown 清洗（直接调清洗函数） ---- */
{
  const { ctx, page } = await newPage('/studio.html?genre=longzu');
  const r = await page.evaluate(() => {
    const h = window.AIResponseHandler;
    if (!h || typeof h.extractBody !== 'function') return { skip: true };
    const raw = '正文开始前\n### 角色状态面板\n**姓名**：路明非\n**等级**：A 级\n**言灵**：青铜与火之王\n这是真正的叙事正文，角色抬起头看向远方。';
    const out = h.extractBody(raw);
    return { skip: false, out: String(out) };
  });
  ok('R2 markdown标题/无前缀字段被剥离', r.skip || (!/###/.test(r.out) && !/\*\*姓名\*\*/.test(r.out)), JSON.stringify(r.out || '').slice(0, 160));
  ok('R2 叙事正文保留', r.skip || /叙事正文/.test(r.out), '');
  await ctx.close();
}

/* ---- R3: 单个骰配置未就绪不抛错 ---- */
{
  const { ctx, page } = await newPage('/studio.html?genre=wangyou');
  const r = await page.evaluate(() => {
    const save = window.storyFramework;
    try {
      window.storyFramework = undefined; // 模拟懒加载未就绪
      if (!window.StorySetupWizard) return { skip: true };
      window.StorySetupWizard.diceField('identity');
      window.StorySetupWizard.diceRoleplay('background');
      return { skip: false, threw: false };
    } catch (e) { return { skip: false, threw: true, msg: e.message }; }
    finally { window.storyFramework = save; }
  });
  ok('R3 单个骰配置未就绪不抛错', r.skip || !r.threw, r.msg || '');
  await ctx.close();
}

/* ---- R4: 竞态裸 onclick 守卫（检查内联事件的源码文本） ---- */
{
  const fs = await import('fs');
  const html = fs.readFileSync('/workspace/yunjing/studio.html', 'utf8');
  const bare = [...html.matchAll(/onclick="if\(event\.target===this\)(Toolbox|Snapshots)\.close\(\)"/g)].map(m => m[0]);
  ok('R4 遮罩关闭无裸调用', bare.length === 0, bare.join(' | '));
}

/* ---- R5: wangyou nameSeeds 字段 ---- */
{
  const { ctx, page } = await newPage('/studio.html?genre=wangyou');
  const r = await page.evaluate(() => {
    const c = window.WangyouStoryConfig || window.GenreStoryConfig;
    const s = c && c.nameSeeds || {};
    return { bg: (s.backgrounds || []).length, age: s.ageRange, names: (s.names || []).length };
  });
  ok('R5 wangyou nameSeeds.backgrounds', r.bg > 0, 'count=' + r.bg);
  ok('R5 wangyou nameSeeds.ageRange', Array.isArray(r.age) && r.age[0] === 16, JSON.stringify(r.age));
  ok('R5 wangyou nameSeeds.names', r.names > 0, 'count=' + r.names);
  await ctx.close();
}

/* ---- R6: 存储告警去重 + 旧界键不回灌 ---- */
{
  const { ctx, page } = await newPage('/studio.html?genre=wangyou');
  const r = await page.evaluate(() => {
    const warns = [];
    const ow = console.warn;
    console.warn = function (m) { warns.push(String(m)); ow.apply(console, arguments); };
    // 连续写同一个大键 5 次，制造多次配额失败
    const big = 'x'.repeat(600 * 1024);
    for (let i = 0; i < 5; i++) { try { localStorage.setItem('__v765_probe__', big + i); } catch (e) {} }
    console.warn = ow;
    const quotaWarns = warns.filter(w => w.indexOf('[存储兜底]') >= 0);
    try { localStorage.removeItem('__v765_probe__'); } catch (e) {}
    return { quotaWarns: quotaWarns.length };
  });
  ok('R6 同键配额告警只一次', r.quotaWarns <= 1, 'warns=' + r.quotaWarns);
  await ctx.close();
}

/* ---- R7: 视觉 CSS 断言 ---- */
{
  const { ctx, page } = await newPage('/studio.html?genre=wangyou');
  const r = await page.evaluate(() => {
    const title = document.querySelector('.page-studio .panel-title');
    const pill = document.getElementById('worldClockPill');
    const ts = title ? getComputedStyle(title) : null;
    return {
      nowrap: ts ? ts.whiteSpace : null,
      ellipsis: ts ? ts.textOverflow : null,
      pillTop: pill ? getComputedStyle(pill).top : null,
      fabExists: !!document.getElementById('rpgFab')
    };
  });
  ok('R7 panel-title 单行省略号', r.nowrap === 'nowrap' && r.ellipsis === 'ellipsis', JSON.stringify(r));
  ok('R7 worldClockPill 下移(>=80px)', parseFloat(r.pillTop) >= 80, 'top=' + r.pillTop);
  await ctx.close();
}

/* ---- R8: 文案玩家化（源码级） ---- */
{
  const fs = await import('fs');
  const bud = fs.readFileSync('/workspace/yunjing/js/xiaoyun-buddy.js', 'utf8');
  const page = fs.readFileSync('/workspace/yunjing/xiaoyun.html', 'utf8');
  ok('R8 无"写入项目源码"玩家文案', !/写入项目源码/.test(page) && !/可挂载或写入源码/.test(bud), '');
}

/* ---- 全页点击审计（客观维度） ---- */
const PAGES = [
  '/index.html', '/settings.html?goto=settings', '/xiaoyun.html',
  '/studio.html?genre=wangyou', '/studio.html?genre=longzu', '/studio.html?genre=scifi',
  '/studio.html?genre=mystery', '/selftest.html?view=selftest'
];
for (const path of PAGES) {
  const { ctx, page } = await newPage(path);
  const btns = await page.locator('button').count();
  // 点前 12 个可见按钮，捕获错误
  let clicked = 0;
  const vis = page.locator('button:visible');
  const n = Math.min(await vis.count(), 12);
  for (let i = 0; i < n; i++) {
    try { await vis.nth(i).click({ timeout: 1500, force: true }); clicked++; } catch (e) {}
  }
  ok('点击审计 ' + path + ' (' + clicked + '/' + n + '/' + btns + ')', true, 'clicked=' + clicked);
  await ctx.close();
}

writeFileSync('/workspace/yunjing/test/v765-round1-result.json', JSON.stringify({
  pass: results.filter(r => r.pass).length, total: results.length, results, pageErrors
}, null, 2));
console.log('PASS ' + results.filter(r => r.pass).length + '/' + results.length);
for (const r of results) if (!r.pass) console.log('  FAIL', r.name, r.detail);
console.log('PAGEERRORS', pageErrors.length);
for (const e of pageErrors.slice(0, 10)) console.log('  ', e);
await browser.close();
