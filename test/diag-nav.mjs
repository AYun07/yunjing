import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8787';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for (const go of ['forge','settings']) {
  const c=await b.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.0.3'}),getSyncStatus:()=>Promise.resolve({version:'7.0.3',state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true})};});
  const p=await c.newPage();
  await p.goto(BASE+'/opening.html',{waitUntil:'load'});
  await p.waitForTimeout(3000); // 等动画完全结束
  const btn=p.locator(`.entry[data-go="${go}"]`);
  const vis=await btn.isVisible();
  const op=await btn.evaluate(e=>getComputedStyle(e).opacity).catch(()=>'?');
  console.log(`\n[${go}] 按钮可见=${vis} opacity=${op}`);
  await btn.click();
  await p.waitForTimeout(2000);
  console.log(`[${go}] 点击后URL=${p.url()}`);
  const txt=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,180));
  console.log(`[${go}] 页面文本=${txt}`);
  await c.close();
}
await b.close();
