import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

async function ctx() {
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addInitScript(() => {
    window.YunJingDesktop = { isDesktop:true,
      getInfo:()=>Promise.resolve({version:'7.0.3'}),
      getSyncStatus:()=>Promise.resolve({version:'7.0.3',lastSync:Date.now(),state:'idle'}),
      checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),
      minimizeWindow(){},maximizeWindow(){},closeWindow(){},
      isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0}) };
  });
  return c;
}
function log(t){ console.log(t); }

// 1) 从封面真实点击"造物"
{
  const c = await ctx(); const p = await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/opening.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const nav = p.waitForEvent('framenavigated',{timeout:5000}).catch(()=>null);
  await p.locator('.entry[data-go="forge"]').click({force:true}).catch(()=>{});
  await nav; await p.waitForTimeout(1500);
  log('=== 造物入口真实跳转 ===');
  log('URL: '+p.url());
  const info = await p.evaluate(()=>({
    title: document.title,
    hasFreeCreate: document.body.innerText.includes('自由创作'),
    hasForgePanel: !!document.querySelector('.xydev-panel,#xyDevPanel,[id*="devPanel"]') || document.body.innerText.includes('造物工坊'),
    csWrapCount: document.querySelectorAll('#csWrap').length,
    bodyHead: document.body.innerText.replace(/\s+/g,' ').slice(0,220)
  }));
  log(JSON.stringify(info,null,2));
  log('脚本错误: '+JSON.stringify(errs.slice(0,5)));
  await c.close();
}

// 2) 从封面真实点击"观星"进设置
{
  const c = await ctx(); const p = await c.newPage();
  await p.goto(BASE+'/opening.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const nav = p.waitForEvent('framenavigated',{timeout:5000}).catch(()=>null);
  await p.locator('.entry[data-go="settings"]').click({force:true}).catch(()=>{});
  await nav; await p.waitForTimeout(1500);
  log('\n=== 观星设置页真实渲染 ===');
  log('URL: '+p.url());
  const info = await p.evaluate(()=>({
    sections: Array.from(document.querySelectorAll('.sec .sec-title,.sec-title,.sec>h3,.sec>summary')).map(e=>e.textContent.trim()).slice(0,30),
    allHeadings: Array.from(document.querySelectorAll('h2,h3,.sec-title')).map(e=>e.textContent.trim()).slice(0,30),
    toggles: Array.from(document.querySelectorAll('[data-toggle],input[type=checkbox],.toggle')).map(e=>e.id||e.getAttribute('data-toggle')||e.className).slice(0,30),
    hasUpdate: document.body.innerText.includes('更新'),
    hasAnnounce: document.body.innerText.includes('公告'),
    bodyLen: document.body.innerText.length
  }));
  log(JSON.stringify(info,null,2));
  await c.close();
}

// 3) 创作室：数角色塑造入口数量
{
  const c = await ctx(); const p = await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/studio.html?genre=fanrenxiuxian',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  log('\n=== 创作室角色塑造入口 ===');
  const info = await p.evaluate(()=>({
    csWrapCount: document.querySelectorAll('#csWrap').length,
    csTitles: Array.from(document.querySelectorAll('.cs-title')).map(e=>e.textContent.trim()),
    heroSection: !!document.querySelector('#wiz_heroSection'),
    playerName: !!document.querySelector('#wiz_playerName'),
    wizardVisible: !!document.querySelector('#setupWrap') && document.querySelector('#setupWrap').offsetHeight>0
  }));
  log(JSON.stringify(info,null,2));
  log('脚本错误: '+JSON.stringify(errs.slice(0,5)));
  await c.close();
}

await browser.close();
