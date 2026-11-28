import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791',OUT='/tmp/v764-r6-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|501/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,220)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript(()=>{localStorage.setItem('storyApiConfig',JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.6.3'}),getSyncStatus:()=>Promise.resolve({version:'7.6.3',lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};window.__rejections=[];window.addEventListener('unhandledrejection',e=>window.__rejections.push(String(e.reason).slice(0,150)));});
const p=await c.newPage();p.on('dialog',d=>d.accept().catch(()=>{}));
for(const g of ['shengtang','wangyou','scifi','mystery','free']){
  await p.goto(BASE+'/studio.html?genre='+g,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1800);
  // 打开工具箱点几项、切沉浸、切主题
  await p.evaluate(()=>window.Toolbox&&window.Toolbox.open()).catch(()=>{});
  await p.waitForTimeout(200);
  const items=await p.locator('#toolboxSheet [data-act]:visible, #toolboxSheet button:visible').all();
  for(let i=0;i<Math.min(items.length,15);i++){await items[i].click({timeout:200,force:true}).catch(()=>{});await p.waitForTimeout(20);}
  await p.keyboard.press('Escape').catch(()=>{});
}
const rej=await p.evaluate(()=>window.__rejections||[]);
log.push('未捕获rejection数='+rej.length);
rej.slice(0,10).forEach(r=>push('REJECTION',r));
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
console.log('LOG:\n'+log.join('\n'));
console.log('R6问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
