import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const PAGES = [
  {p:'/opening.html',name:'开场封面',go:'进入游戏'},
  {p:'/index.html',name:'云境大厅',go:'旧大厅'},
  {p:'/settings.html?goto=settings',name:'天地设置',go:'设置'},
  {p:'/xiaoyun.html?goto=forge',name:'万象工坊',go:'工坊'},
  {p:'/studio.html?genre=fanrenxiuxian',name:'创作室·扮演',go:'创作'},
  {p:'/studio.html?genre=free',name:'创作室·自由',go:'创作'}
];
const results = [];
for (const {p,name} of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    window.YunJingDesktop = { isDesktop:true,
      getInfo:()=>Promise.resolve({version:'7.0.3'}),
      getSyncStatus:()=>Promise.resolve({version:'7.0.3',lastSync:Date.now(),state:'idle'}),
      checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),
      minimizeWindow(){},maximizeWindow(){},closeWindow(){},
      isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0}) };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e=>errs.push(e.message));
  page.on('console', m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
  await page.goto(BASE+p,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1600);
  const btns = await page.locator('button:visible').all();
  const rows = [];
  for (const b of btns.slice(0,60)) {
    let label='', ok=true, reason='', btnId='';
    try {
      label = ((await b.innerText())||'').trim().replace(/\s+/g,' ').slice(0,22) || '(图标按钮)';
      const onclick = await b.getAttribute('onclick');
      btnId = (await b.getAttribute('id')) || '';
      if (onclick && /location|href=|clear|delete|remove|quit/.test(onclick)) { ok=true; reason='跳过(导航/危险)'; }
      else {
        const be = errs.length;
        await b.click({timeout:350,force:true}).catch(()=>{});
        await page.waitForTimeout(30);
        if (errs.length>be) { ok=false; reason=errs[be].slice(0,60); }
      }
    } catch(e){ ok=false; reason=(e.message||'').slice(0,60); }
    rows.push({label,ok,reason,id:btnId});
  }
  results.push({name,path:p,total:btns.length,tested:rows.length,errors:errs.length,rows});
  await ctx.close();
}
await browser.close();
fs.writeFileSync('/workspace/yunjing/test/click-audit-result.json', JSON.stringify(results,null,2));
const bad = results.reduce((a,r)=>a+r.rows.filter(x=>!x.ok).length,0);
console.log('审计完成：', results.reduce((a,r)=>a+r.tested,0), '个按钮，异常', bad, '个');
