import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791', VER='7.6.3', OUT='/tmp/v764-flow-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,200)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript((v)=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};},VER);
const p=await c.newPage();
p.on('dialog',d=>d.accept().catch(()=>{}));
p.on('pageerror',e=>push('FLOW:pageerror',e.message));
p.on('console',m=>{if(m.type()==='error')push('FLOW:console',m.text());});
await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
log.push('初始 view: setupWrap显示='+await p.evaluate(()=>getComputedStyle(document.getElementById('setupWrap')).display)+' chatArea显示='+await p.evaluate(()=>getComputedStyle(document.getElementById('chatArea')).display));
// 点踏入世界
const startBtn=p.locator('button:has-text("踏入")').first();
const hasStart=await startBtn.count();
log.push('开始创作按钮数='+hasStart);
if(hasStart){
  await startBtn.click({force:true}).catch(e=>push('FLOW','点踏入世界失败:'+e.message.slice(0,80)));
  await p.waitForTimeout(1500);
  const chatDisp=await p.evaluate(()=>getComputedStyle(document.getElementById('chatArea')).display);
  const setupDisp=await p.evaluate(()=>getComputedStyle(document.getElementById('setupWrap')).display);
  log.push('点后 setupWrap='+setupDisp+' chatArea='+chatDisp);
  if(chatDisp==='none'||setupDisp!=='none')push('FLOW','点踏入世界后未进入创作态(chatArea='+chatDisp+',setupWrap='+setupDisp+')');
  // 现在测输入框
  const inp=p.locator('#userInput');
  const rect=await p.evaluate(()=>{const el=document.getElementById('userInput');const r=el.getBoundingClientRect();return {w:r.width,h:r.height};});
  log.push('创作态输入框尺寸='+JSON.stringify(rect));
  if(rect.w>0){await inp.fill('测试输入ABC').catch(()=>{});const v=await inp.inputValue().catch(()=>'');log.push('输入框值='+JSON.stringify(v.slice(0,20)));if(!v.includes('测试输入ABC'))push('FLOW','创作态输入框仍无法键入');}
}
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
writeFileSync(OUT.replace('.json','.log.txt'),log.join('\n'));
console.log('LOG:\n'+log.join('\n'));
console.log('\nFLOW问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
