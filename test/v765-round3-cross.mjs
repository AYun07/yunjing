import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// 第三轮：跨界切换 + 存储配额实测（R6 端到端）+ 每界交互审计
const BASE='http://127.0.0.1:8791', VER='7.6.5';
const issues=[], log=[], seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|WebGL/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,240)});}
const GENRES=['wangyou','free','shengtang','fanrenxiuxian','scifi','mystery','cthulhu','longzu','daoguiyixian','quanzhi','wuxia','shrouding','swallowedstar','dibao','zhongshengdushi'];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
let totalClicks=0;
for(const g of GENRES){
  const c=await b.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript((v)=>{
    window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};
    window.__quotaWarns=0;
    const ow=console.warn;console.warn=function(m){if(String(m).indexOf('[存储兜底]')>=0)window.__quotaWarns++;ow.apply(console,arguments)};
  },VER);
  const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push(g+':pageerror',(e.message).slice(0,200)));
  await p.goto(BASE+'/studio.html?genre='+g,{waitUntil:'domcontentloaded',timeout:20000});
  await p.waitForTimeout(1200);
  // 每界真实点击 15 个可见按钮
  const vis=p.locator('button:visible');
  const n=Math.min(await vis.count(),15);
  let clicked=0;
  for(let i=0;i<n;i++){try{await vis.nth(i).click({timeout:1000,force:true});clicked++;}catch(e){}}
  totalClicks+=clicked;
  const warns=await p.evaluate(()=>window.__quotaWarns);
  const lsKeys=await p.evaluate(()=>{let n=0;try{for(let i=0;i<localStorage.length;i++)n++}catch(e){}return n});
  log.push(g+': 点击'+clicked+'/'+n+' 配额告警'+warns+' LS键'+lsKeys);
  if(warns>3)push(g+':存储','配额告警刷'+warns+'次');
  await c.close();
}
await b.close();
writeFileSync('/workspace/yunjing/test/v765-round3-result.json',JSON.stringify({issues,log,totalClicks},null,2));
console.log('LOG:\n'+log.join('\n'));
console.log('总真实点击='+totalClicks);
console.log('\n问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
