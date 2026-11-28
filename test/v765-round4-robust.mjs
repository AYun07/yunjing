import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// 第四轮：健壮性/竞态专项——XSS、损坏配置、快速连点、注入窗口点遮罩(R4)、拒绝 Promise
const BASE='http://127.0.0.1:8791', VER='7.6.5';
const issues=[], log=[], seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|WebGL/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,240)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
async function mkctx(){
  const c=await b.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript((v)=>{
    window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};
    window.__rejections=0;
    window.addEventListener('unhandledrejection',()=>window.__rejections++);
  },VER);
  return c;
}
// 场景A：XSS 注入
{
  const c=await mkctx();const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('XSS:pageerror',e.message.slice(0,200)));
  await p.goto(BASE+'/studio.html?genre=wangyou',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1500);
  const inp=p.locator('#userInput');
  if(await inp.count()){
    await p.evaluate(()=>{const e=document.getElementById('userInput');e.style.display='block';});
    await inp.fill('<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>').catch(()=>{});
    await p.locator('#sendBtn').click({force:true}).catch(()=>{});await p.waitForTimeout(1500);
  }
  const xss=await p.evaluate(()=>({a:window.__xss||0,scripts:document.querySelectorAll('#chatMessages script').length,imgs:document.querySelectorAll('#chatMessages img[src=x]').length}));
  log.push('XSS: '+JSON.stringify(xss));
  if(xss.a||xss.scripts||xss.imgs)push('XSS','注入脚本/事件被执行');
  await c.close();
}
// 场景B：损坏配置
{
  const c=await mkctx();
  await c.addInitScript(()=>{localStorage.setItem('storyApiConfig','{{{坏JSON');localStorage.setItem('cfgViewMode','???');});
  const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('损坏配置:pageerror',e.message.slice(0,200)));
  await p.goto(BASE+'/settings.html?goto=settings',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);
  const title=await p.title();log.push('损坏配置后设置页标题='+title);
  const btns=p.locator('button:visible');const n=Math.min(await btns.count(),15);let clicked=0;
  for(let i=0;i<n;i++){try{await btns.nth(i).click({timeout:1000,force:true});clicked++;}catch(e){}}
  log.push('损坏配置下点击='+clicked+'/'+n);
  await c.close();
}
// 场景C：注入窗口内点遮罩（R4 竞态）
{
  const c=await mkctx();const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('R4竞态:pageerror',e.message.slice(0,200)));
  // 用 route 延迟 js/story-setup-wizard.js 制造注入窗口
  await p.route('**/js/story-setup-wizard.js*', async route=>{await new Promise(r=>setTimeout(r,900));await route.continue();});
  await p.goto(BASE+'/studio.html?genre=wangyou',{waitUntil:'domcontentloaded'});
  // 立刻尝试点两个遮罩
  for(const sel of ['#toolboxSheet','#snapSheet']){
    const el=p.locator(sel);
    if(await el.count()){await el.evaluate(e=>{e.style.display='block';e.click();}).catch(()=>{});}
  }
  await p.waitForTimeout(2000);
  log.push('注入窗口点遮罩完成');
  await c.close();
}
// 场景D：快速连点骰子(R3) + 形态按钮
{
  const c=await mkctx();const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('连点:pageerror',e.message.slice(0,200)));
  await p.goto(BASE+'/studio.html?genre=wangyou',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1500);
  const dice=p.locator('button.dice-btn:visible');
  const dn=Math.min(await dice.count(),8);
  for(let r=0;r<3;r++)for(let i=0;i<dn;i++){try{await dice.nth(i).click({timeout:800,force:true});}catch(e){}}
  log.push('骰子连点='+dn*3+'次');
  const rej=await p.evaluate(()=>window.__rejections);
  log.push('未捕获rejection='+rej);
  if(rej>0)push('连点','未捕获 Promise rejection='+rej);
  await c.close();
}
// 场景E：selftest 全量
{
  const c=await mkctx();const p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('自检:pageerror',e.message.slice(0,200)));
  await p.goto(BASE+'/selftest.html?view=selftest',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  const st=await p.evaluate(()=>({body:document.body.innerText.slice(0,600)}));
  log.push('自检页首段='+JSON.stringify(st.body.slice(0,200)));
  await c.close();
}
await b.close();
writeFileSync('/workspace/yunjing/test/v765-round4-result.json',JSON.stringify({issues,log},null,2));
console.log('LOG:\n'+log.join('\n'));
console.log('\n问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
