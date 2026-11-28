import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
// 第二轮：longzu 界真实创作流程（mock API），验证 markdown 清洗端到端 + 创作交互
const BASE='http://127.0.0.1:8791', VER='7.6.5';
const issues=[], log=[], seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|WebGL/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,240)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript((v)=>{
  localStorage.setItem('storyApiConfig', JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock-key',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));
  window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};
},VER);
const p=await c.newPage();
p.on('dialog',d=>d.accept().catch(()=>{}));
p.on('pageerror',e=>push('pageerror',(e.stack||e.message).slice(0,400)));
p.on('console',m=>{if(m.type()==='error')push('console',m.text());});
await p.goto(BASE+'/studio.html?genre=longzu',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
log.push('genre标题='+await p.title());
// 交互1：配置检查
const ep=await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('storyApiConfig')).endpoint}catch(e){return 'ERR'}});
log.push('端点='+ep);
// 交互2：踏入世界
const enter=p.locator('#setupContainer button:has-text("踏入")').first();
if(await enter.count()){await enter.click().catch(e=>push('踏入','点失败:'+e.message.slice(0,80)));await p.waitForTimeout(3500);}
// 交互3：正文检查
const st=await p.evaluate(()=>({
  setup:getComputedStyle(document.getElementById('setupWrap')).display,
  chat:getComputedStyle(document.getElementById('chatArea')).display,
  msgs:document.getElementById('chatMessages')?.innerText||''
}));
log.push('踏入后 setup='+st.setup+' chat='+st.chat);
log.push('正文='+JSON.stringify(st.msgs.slice(0,200)));
// R2 端到端断言
if(st.chat==='none')push('R2','配接口后点踏入仍未进创作态');
else{
  if(/###\s|\*\*姓名\*\*\s*[:：]|\*\*等级\*\*\s*[:：]|\*\*言灵\*\*\s*[:：]/.test(st.msgs))push('R2','正文残留 markdown 面板标记（清洗未生效）');
  if(!/路明非|钟楼/.test(st.msgs))push('R2','正文叙事主体缺失');
  if(/\(variable_update\)/.test(st.msgs))push('R2','残留未清洗变量标签');
}
// 交互4：选项按钮
const opts=p.locator('#chatMessages button:visible');
const no=await opts.count(); log.push('选项数='+no);
if(no>0){await opts.first().click({force:true}).catch(()=>{});await p.waitForTimeout(2500);}
// 交互5：输入框键入 + 发送
const inp=p.locator('#userInput');
const rect=await p.evaluate(()=>{const e=document.getElementById('userInput');const r=e.getBoundingClientRect();return{w:r.width,h:r.height}});
log.push('输入框='+JSON.stringify(rect));
if(rect.w>0){
  await inp.fill('继续调查钟楼').catch(()=>{});
  const v=await inp.inputValue().catch(()=>'');
  if(!v.includes('继续'))push('交互','输入框无法键入');
  await p.locator('#sendBtn').click({force:true}).catch(()=>{});
  await p.waitForTimeout(2500);
  const msgs2=await p.evaluate(()=>document.getElementById('chatMessages')?.innerText||'');
  log.push('二次发送后字数='+msgs2.length);
}
// 交互6-15：创作态各类按钮真实点击
const clickables=p.locator('button:visible');
const total=await clickables.count();
let clicked=0;
for(let i=0;i<Math.min(total,25);i++){
  try{await clickables.nth(i).click({timeout:1200,force:true});clicked++;}catch(e){}
}
log.push('创作态额外点击='+clicked+'/'+Math.min(total,25));
await b.close();
writeFileSync('/workspace/yunjing/test/v765-round2-result.json',JSON.stringify({issues,log},null,2));
console.log('LOG:\n'+log.join('\n'));
console.log('\n问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
