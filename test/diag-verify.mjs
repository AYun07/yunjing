import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const out = {};
async function mkpage(path) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
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
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { ctx, page, errs };
}

// 随缘开局：扮演模式下点击看身份字段变化
{
  const { ctx, page, errs } = await mkpage('/studio.html?genre=fanrenxiuxian');
  const snap = () => page.evaluate(() => {
    const ids = ['wiz_playerName','wiz_heroName','wiz_background','wiz_heroBio','wiz_identity'];
    const o = {};
    ids.forEach(id => { const e = document.getElementById(id); if (e) o[id] = (e.value||'').slice(0,50); });
    o._filled = Array.from(document.querySelectorAll('#setupWrap input,#setupWrap textarea,#setupWrap select')).filter(e=>e.value&&e.value.trim()).length;
    return o;
  });
  const before = await snap();
  await page.click('.fate-btn').catch(e=>{});
  await page.waitForTimeout(500);
  const after = await snap();
  out.fate = { before, after, changed: JSON.stringify(before)!==JSON.stringify(after), errs };
  await ctx.close();
}

// 角色塑造助手挂载
{
  const { ctx, page, errs } = await mkpage('/studio.html?genre=fanrenxiuxian');
  const r = await page.evaluate(() => ({
    csWrap: !!document.getElementById('csWrap'),
    lookInput: !!document.getElementById('csLookInput'),
    traitList: !!document.getElementById('csTraitList'),
    traitCount: (document.getElementById('csTraitCount')||{}).textContent,
    traitBtns: document.querySelectorAll('.cs-trait').length,
    iconBtn: !!document.getElementById('csIcon'),
    codexLoaded: !!window.PersonalityCodex,
    imgGenLoaded: !!window.StoryImageGen
  }));
  // 点选一个性格
  let traitClick = null;
  if (r.traitBtns) {
    await page.click('.cs-trait').catch(e=>{traitClick='ERR:'+e.message.slice(0,80);});
    await page.waitForTimeout(200);
    traitClick = traitClick || await page.evaluate(()=>({count:document.getElementById('csTraitCount').textContent, persona:localStorage.getItem('yunjingHeroPersona')}));
  }
  out.character = { ...r, traitClick, errs };
  await ctx.close();
}

// 工坊落地
{
  const { ctx, page, errs } = await mkpage('/xiaoyun.html?goto=forge');
  const r = await page.evaluate(()=>({
    title: document.title,
    devOpen: !!(document.querySelector('.xy-dev') && document.querySelector('.xy-dev').classList.contains('on')),
    hasChatInput: !!(document.querySelector('.xy-dev textarea')||document.querySelector('.xy-dev input')),
    articleUI: /文章创作|写作台/.test(document.body.innerText),
    bodyHead: document.body.innerText.replace(/\s+/g,' ').slice(0,160)
  }));
  out.forge = {...r, errs};
  await ctx.close();
}

// 设置页全局开关逐一点
{
  const { ctx, page, errs } = await mkpage('/settings.html?goto=settings');
  const tiles = ['tileNight','tilePerf','tileCelebr'];
  const res = {};
  for (const id of tiles) {
    const before = await page.evaluate(()=>({n:localStorage.getItem('storyNightMode'),p:localStorage.getItem('yunjingLowSpec'),c:localStorage.getItem('storyCelebration')}));
    await page.click('#'+id).catch(()=>{});
    await page.waitForTimeout(150);
    const after = await page.evaluate(()=>({n:localStorage.getItem('storyNightMode'),p:localStorage.getItem('yunjingLowSpec'),c:localStorage.getItem('storyCelebration')}));
    res[id] = { changed: JSON.stringify(before)!==JSON.stringify(after), note: (await page.evaluate(()=>document.getElementById('switchNote').textContent)) };
  }
  out.switches = { res, errs };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
