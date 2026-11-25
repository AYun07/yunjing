import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8787';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.0.3'}),getSyncStatus:()=>Promise.resolve({version:'7.0.3',state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};});
const p=await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/settings.html?goto=settings',{waitUntil:'load'});
await p.waitForTimeout(2000);
console.log('=== 设置页分区 ===');
console.log(JSON.stringify(await p.evaluate(()=>({
  secTitles: Array.from(document.querySelectorAll('.sec-title,.sec>h3,.sec-header,.card-title')).map(e=>e.textContent.trim()),
  allH2H3: Array.from(document.querySelectorAll('h2,h3')).map(e=>e.textContent.trim()),
  toggleEls: Array.from(document.querySelectorAll('[id*="toggle"],[id*="Toggle"],.switch,.toggle,[data-toggle]')).map(e=>({id:e.id||'',txt:(e.textContent||'').trim().slice(0,30),type:e.tagName})),
  bodyText: document.body.innerText.replace(/\s+/g,' ').slice(0,600)
})),null,2));
console.log('脚本错误:',JSON.stringify(errs.slice(0,5)));
await b.close();
