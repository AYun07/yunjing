import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8791';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const realIssues=[];
const PAGES=[
 '/opening.html','/index.html','/settings.html?goto=settings','/xiaoyun.html?goto=forge','/xiaoyun.html',
 '/studio.html?genre=shengtang','/studio.html?genre=wangyou','/studio.html?genre=fanrenxiuxian',
 '/studio.html?genre=doupocangqiong','/studio.html?genre=free','/changelog/index.html','/selftest.html?view=selftest',
 '/map-preview.html','/map-verified.html'
];
const seen=new Set();
for(const path of PAGES){
  const ctx=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true});
  await ctx.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.5.0'}),getSyncStatus:()=>Promise.resolve({version:'7.5.0',lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};});
  const page=await ctx.newPage();
  page.on('dialog',d=>{d.accept().catch(()=>{});}); // 自动确认 alert/confirm，避免阻塞
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERROR:'+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|Failed to load resource: 404/.test(t))errs.push('CONSOLE:'+t.slice(0,180));}});
  await page.goto(BASE+path,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  const els=await page.locator('button:visible, [role=button]:visible, .lr-item:visible, .workshop:visible').all();
  let clicked=0;
  for(let i=0;i<els.length && i<35;i++){
    const el=els[i];
    try{
      const before=errs.length;
      const label=await el.getAttribute('aria-label')||await el.textContent().then(t=>t?.trim().slice(0,20)).catch(()=>'')||'?';
      await el.click({timeout:400,force:true}).catch(()=>{});
      await page.waitForTimeout(25);
      const ne=errs.slice(before);
      if(ne.length){
        const key=path+'|'+label+'|'+ne[0].slice(0,80);
        if(!seen.has(key)){seen.add(key);realIssues.push(path+' 点击「'+label+'」→ '+ne[0]);}
      }
      clicked++;
      // 关闭刚打开的浮层避免干扰后续点击
      if(i%8===7) await page.keyboard.press('Escape').catch(()=>{});
    }catch(_){}
  }
  // 页面级错误（非点击引起）
  if(errs.length && clicked===0){
    const key=path+'|page|'+errs[0].slice(0,80);
    if(!seen.has(key)){seen.add(key);realIssues.push(path+' 加载即报错 → '+errs[0]);}
  }
  console.log(path+' 元素'+els.length+' 点击'+clicked+' 错误'+errs.length);
  await ctx.close();
}
await browser.close();
console.log('\n===== 真实问题 ('+realIssues.length+') =====');
realIssues.forEach((x,i)=>console.log((i+1)+'. '+x));
