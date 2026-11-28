import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791',VER='7.6.3',OUT='/tmp/v764-r3-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|501/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,220)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
async function ctx(){const c=await b.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript((v)=>{localStorage.setItem('storyApiConfig',JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};},VER);return c;}
// === A. 创作态异常输入 + 快速连点竞态 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('INPUT:err',(e.stack||e.message).slice(0,300)));
  p.on('console',m=>{if(m.type()==='error')push('INPUT:console',m.text());});
  await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  await p.locator('#setupContainer button:has-text("踏入")').first().click().catch(()=>{});
  await p.waitForTimeout(3000);
  // XSS 输入（验证转义，不应执行）
  await p.evaluate(()=>{window.__xssFired=false;});
  const inp=p.locator('#userInput');
  if(await inp.count() && (await p.evaluate(()=>document.getElementById('userInput').getBoundingClientRect().width))>0){
    await inp.fill('<img src=x onerror="window.__xssFired=true"><script>window.__xssFired=true</script>').catch(()=>{});
    await p.locator('#sendBtn').click({force:true}).catch(()=>{});
    await p.waitForTimeout(2500);
    const xss=await p.evaluate(()=>window.__xssFired);
    log.push('XSS注入后 __xssFired='+xss);
    if(xss)push('SECURITY','用户输入 <img onerror>/<script> 被执行（XSS）');
    // 快速连点发送（竞态）
    for(let i=0;i<5;i++){await p.locator('#sendBtn').click({force:true}).catch(()=>{});await p.waitForTimeout(50);}
    await p.waitForTimeout(2000);
    log.push('快速连点5次后完成');
  } else log.push('创作态输入框不可见，跳过输入测试');
  await c.close();
}
// === B. 导入损坏存档 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('IMPORT:err',(e.stack||e.message).slice(0,300)));
  await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2200);
  // 直接调用 importSave 逻辑测试损坏数据不会崩
  const r=await p.evaluate(async()=>{
    const results=[];
    for(const bad of ['not json','{}','{"a":1}','null','[]']){
      try{
        // 模拟解析路径（若 SaveCodec.decode 存在）
        if(window.SaveCodec&&window.SaveCodec.decode){await window.SaveCodec.decode(bad);results.push(bad+':ok');}
        else results.push(bad+':no-decode');
      }catch(e){results.push(bad+':threw='+e.message.slice(0,40));}
    }
    return results;
  });
  log.push('损坏存档解析: '+r.join(' | '));
  await c.close();
}
// === C. localStorage 溢出/损坏配置容错 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('pageerror',e=>push('STORAGE:err',(e.stack||e.message).slice(0,300)));
  await c.addInitScript(()=>{localStorage.setItem('storyApiConfig','{broken json');localStorage.setItem('storyVarApi','not-json');});
  await p.goto(BASE+'/studio.html?genre=free',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);
  const ok=await p.evaluate(()=>({fw:!!window.storyFramework,title:document.title}));
  log.push('损坏配置后能否启动: '+JSON.stringify(ok));
  if(!ok.fw)push('STORAGE','storyApiConfig 损坏导致 storyFramework 未初始化');
  await c.close();
}
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
writeFileSync(OUT.replace('.json','.log.txt'),log.join('\n'));
console.log('LOG:\n'+log.join('\n'));
console.log('\nR3问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
