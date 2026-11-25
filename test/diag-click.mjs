import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const out = {};

async function mkpage(path, desktop = false) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  if (desktop) await ctx.addInitScript(() => {
    window.YunJingDesktop = {
      isDesktop: true,
      getInfo: () => Promise.resolve({ version: '7.0.2' }),
      getSyncStatus: () => Promise.resolve({ version: '7.0.2', lastSync: Date.now(), state: 'idle' }),
      checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
      minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
      isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
    };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  return { ctx, page, errs };
}

// 1. 封面四入口
{
  const { ctx, page, errs } = await mkpage('/opening.html');
  const entries = await page.evaluate(() => Array.from(document.querySelectorAll('.entry')).map(b => ({
    go: b.dataset.go, name: (b.querySelector('.name') || {}).textContent, title: b.title
  })));
  // 点造物，看跳到哪里（拦截导航）
  const forgeTarget = await page.evaluate(() => {
    const src = document.documentElement.outerHTML;
    const m = src.match(/forge:\s*'([^']+)'/);
    return m ? m[1] : null;
  });
  out.cover = { entries, forgeTarget, errs };
  await ctx.close();
}

// 2. 工坊落地页
{
  const { ctx, page, errs } = await mkpage('/xiaoyun.html?goto=forge');
  const r = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      title: document.title,
      hasDev: !!document.querySelector('.xy-dev.on'),
      hasArticle: /文章创作|写作台|正文创作/.test(txt),
      hasXiaoyunCfg: /小云配置|形象配置|情绪配置/.test(txt),
      bodySample: txt.replace(/\s+/g, ' ').slice(0, 300)
    };
  });
  out.forge = { ...r, errs };
  await ctx.close();
}

// 3. 设置页
{
  const { ctx, page, errs } = await mkpage('/settings.html?goto=settings', true);
  const r = await page.evaluate(() => ({
    sections: Array.from(document.querySelectorAll('.sec h2')).map(h => h.textContent.trim()),
    verCurrent: (document.getElementById('verCurrent') || {}).textContent,
    notes: (document.getElementById('notesList') || {}).textContent,
    tiles: Array.from(document.querySelectorAll('.tile')).map(t => t.id)
  }));
  // 点开公告
  await page.click('#toggleNotesBtn').catch(() => {});
  await page.waitForTimeout(800);
  const notesAfter = await page.evaluate(() => {
    const el = document.getElementById('notesList');
    const vers = el ? Array.from(el.querySelectorAll('.nv')).map(n => n.textContent) : [];
    return { vers, text: el ? el.textContent.slice(0, 120) : '' };
  });
  out.settings = { ...r, notesAfter, errs };
  await ctx.close();
}

// 4. 角色创建（随缘开局 + 样貌/性格/图标）
{
  const { ctx, page, errs } = await mkpage('/index.html?entry=new');
  const r = await page.evaluate(() => {
    const allText = document.body.innerText;
    const btns = Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim()).filter(Boolean);
    return {
      hasFate: /随缘开局/.test(allText),
      hasLook: /生成样貌|样貌/.test(allText),
      hasPersonality: /生成性格|性格/.test(allText),
      hasIcon: /生成角色图标|角色图标|头像/.test(allText),
      fateBtns: btns.filter(t => /随缘/.test(t)),
      lookBtns: btns.filter(t => /样貌|性格|图标|头像|生成/.test(t)),
      btnCount: btns.length
    };
  });
  out.create = { ...r, errs: errs.slice(0, 8) };
  await ctx.close();
}

// 5. 状态栏颜色（index）
{
  const { ctx, page } = await mkpage('/index.html?entry=new');
  const r = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('[class*="status"],[id*="status"],[class*="state"],[id*="state"]'));
    return cands.slice(0, 12).map(el => {
      const cs = getComputedStyle(el);
      return { cls: el.className || el.id, color: cs.color, bg: cs.backgroundColor, opacity: cs.opacity };
    });
  });
  out.statusbar = r;
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
