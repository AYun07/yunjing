import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791', VER='7.6.3', OUT='/tmp/v764-flow2-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,220)});}
const MOCK_TEXT = '圣堂的钟声在暮色里回荡，你推开古老的石门，踏入一片被月光照亮的中庭。\n\n一位白衣老者转过身来，目光平静地落在你身上。\n\n(variable_update)\n{"身份":"新入门的旅人","境界":"初入","好感":{"老者":10}}\n(/variable_update)\n\n1. 上前向老者行礼，恳请指点\n2. 悄然退到廊下，先观察四周\n3. 径直走向中庭中央的古碑';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript((v)=>{
  localStorage.setItem('storyApiConfig', JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock-key',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));
  window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};
},VER);
// 拦截 mock API
const p=await c.newPage();
p.on('dialog',d=>d.accept().catch(()=>{}));
p.on('pageerror',e=>push('FLOW2:pageerror',(e.stack||e.message).slice(0,400)));
p.on('console',m=>{if(m.type()==='error')push('FLOW2:console',m.text());});
await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2800);
log.push('apiConfig注入='+await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('storyApiConfig')).endpoint}catch(e){return 'ERR'}}));
// 踏入世界
const btn=p.locator('#setupContainer button:has-text("踏入")').first();
if(await btn.count()){
  await btn.click().catch(e=>push('FLOW2','点踏入失败:'+e.message.slice(0,80)));
  await p.waitForTimeout(3500);
}
const st=await p.evaluate(()=>({setup:getComputedStyle(document.getElementById('setupWrap')).display,chat:getComputedStyle(document.getElementById('chatArea')).display,msgs:document.getElementById('chatMessages')?.innerText.slice(0,400)||''}));
log.push('踏入后 setup='+st.setup+' chat='+st.chat);
log.push('正文首段='+JSON.stringify(st.msgs.slice(0,120)));
if(st.chat==='none')push('FLOW2','配好接口后点踏入仍未进入创作态');
else{
  if(!st.msgs.includes('圣堂的钟声'))push('FLOW2','创作态未渲染 mock 正文（正文缺失）');
  // 变量块是否被清洗掉（不应原样显示 variable_update 标签）
  if(st.msgs.includes('(variable_update)'))push('FLOW2','正文里残留未清洗的 (variable_update) 标签');
  // 选项按钮
  const opts=await p.locator('#chatMessages button, #chatMessages [class*=option], #chatMessages [class*=choice]').count();
  log.push('选项元素数='+opts);
  // 输入框
  const rect=await p.evaluate(()=>{const el=document.getElementById('userInput');const r=el.getBoundingClientRect();return{w:r.width,h:r.height};});
  log.push('输入框尺寸='+JSON.stringify(rect));
  if(rect.w>0){
    await p.locator('#userInput').fill('继续').catch(()=>{});
    const v=await p.locator('#userInput').inputValue().catch(()=>'');
    if(!v.includes('继续'))push('FLOW2','创作态输入框无法键入');
    await p.locator('#sendBtn').click({force:true}).catch(()=>{});
    await p.waitForTimeout(2500);
    const msgs2=await p.evaluate(()=>document.getElementById('chatMessages')?.innerText||'');
    log.push('发送后正文字数='+msgs2.length);
  }
}
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
writeFileSync(OUT.replace('.json','.log.txt'),log.join('\n'));
console.log('LOG:\n'+log.join('\n'));
console.log('\nFLOW2问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
