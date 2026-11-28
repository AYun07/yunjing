import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791',VER='7.6.3',OUT='/tmp/v764-r4-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|501/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,220)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript((v)=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};},VER);
const p=await c.newPage();
p.on('dialog',d=>d.accept().catch(()=>{}));
p.on('pageerror',e=>push('WIZ:err',(e.stack||e.message).slice(0,250)));
for(const g of ['wangyou','freeworld','cthulhu','free','mystery','scifi','wuxia']){
  await p.goto(BASE+'/studio.html?genre='+g,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1500);
  const d=await p.evaluate(()=>{
    const box=document.getElementById('setupContainer');
    const txt=box?box.innerText:'';
    const btns=[...document.querySelectorAll('#setupContainer button')].map(x=>x.textContent.trim()).filter(Boolean);
    return {card:!!box?.querySelector('.wizard-card'),btnCount:btns.length,hasEnter:btns.some(x=>x.includes('踏入')),hasRandom:btns.some(x=>x.includes('随缘')||x.includes('随机')),snippet:txt.slice(0,100),undef:/undefined|NaN|\[object Object\]/.test(txt)};
  });
  log.push(g+' card='+d.card+' 按钮='+d.btnCount+' 踏入='+d.hasEnter+' 随机='+d.hasRandom+' undef='+d.undef);
  if(!d.card)push('WIZ:'+g,'创建角色台向导未渲染');
  if(!d.hasEnter)push('WIZ:'+g,'缺少「踏入世界」入口按钮');
  if(d.undef)push('WIZ:'+g,'向导首屏出现 undefined/NaN/[object Object]：'+d.snippet);
  // 点随机名字按钮，验证能生成符合题材候选名
  const rb=p.locator('#setupContainer button:has-text("随缘"), #setupContainer button:has-text("全部随机")').first();
  if(await rb.count()){
    await rb.click({force:true}).catch(()=>{});await p.waitForTimeout(300);
    const nameVal=await p.evaluate(()=>{const i=document.querySelector('#setupContainer input[placeholder*=名],#setupContainer .wiz-name');return i?(i.value||i.textContent||'').slice(0,30):null;});
    log.push('  '+g+' 随机后名字='+JSON.stringify(nameVal));
    if(nameVal===''||nameVal==='undefined')push('WIZ:'+g,'点随机后名字为空/undefined（nameSeeds 未被消费）');
  }
}
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
writeFileSync(OUT.replace('.json','.log.txt'),log.join('\n'));
console.log('LOG:\n'+log.join('\n'));
console.log('\nR4问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
