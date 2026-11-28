#!/usr/bin/env node
/** 第五轮：Xvfb + 真实 Electron + CDP，走完整创作流程，验证栈溢出修复在真实客户端生效。 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON = path.join(ROOT, 'client/electron/node_modules/electron/dist/electron');
const APPDIR = path.join(ROOT, 'client/electron');
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass=0,fail=0; const issues=[];
const t=(n,ok,x='')=>{if(ok){pass++;console.log('  PASS '+n+(x?' -> '+x:''));}else{fail++;console.log('  FAIL '+n+(x?' -> '+x:''));issues.push(n+' ' +x);}};

(async()=>{
  const cdpPort=9355;
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(ELECTRON,[APPDIR,`--remote-debugging-port=${cdpPort}`,'--no-sandbox'],{env,stdio:['ignore','pipe','pipe']});
  let stderr=''; child.stderr.on('data',d=>stderr+=d.toString()); child.stdout.on('data',()=>{});
  let browser;
  try{
    let ready=false;
    for(let i=0;i<40;i++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);ready=true;break;}catch(_){await sleep(500);}}
    t('真实 Electron 启动并可 CDP 连接',ready,ready?'':stderr.slice(-300));
    if(!ready)throw new Error('CDP未就绪');
    await sleep(2000);
    const ctx=browser.contexts()[0]; let page=ctx.pages()[0];
    const base=page.url().replace(/\/[^/]*$/,'/');
    const pageErrs=[];
    page.on('pageerror',e=>pageErrs.push((e.stack||e.message).slice(0,200)));

    // 注入 mock 接口配置（覆盖热更新目录里的配置）
    await page.goto(base+'studio.html?genre=shengtang',{waitUntil:'domcontentloaded'}).catch(()=>{});
    await page.waitForTimeout(2500);
    await page.evaluate(()=>{
      localStorage.setItem('storyApiConfig',JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));
    });
    await page.reload({waitUntil:'domcontentloaded'}); await sleep(2500);
    // 点踏入世界
    const clicked=await page.evaluate(()=>{const b=[...document.querySelectorAll('#setupContainer button')].find(x=>x.textContent.includes('踏入'));if(b){b.click();return true;}return false;});
    t('创作台踏入按钮存在并可点',clicked);
    await sleep(4000);
    // 检查创作态
    const st=await page.evaluate(()=>({setup:getComputedStyle(document.getElementById('setupWrap')).display,chat:getComputedStyle(document.getElementById('chatArea')).display,text:document.getElementById('chatMessages')?.innerText.slice(0,100)||''}));
    t('配接口后进入创作态',st.chat==='flex'&&st.setup==='none',`setup=${st.setup} chat=${st.chat}`);
    // 核心：栈溢出是否消失
    const stackErrs=pageErrs.filter(x=>/call stack size exceeded/i.test(x));
    t('创作流程无栈溢出(bonus-engine递归修复)',stackErrs.length===0,stackErrs[0]||'0个');
    t('创作流程无其它pageerror',pageErrs.length===0,pageErrs[0]||'0个');
    // 变量块是否解析（正文渲染）
    t('正文正常渲染',st.text.length>10,st.text.slice(0,40));
    // bonus事件语义（原功能保留）
    const ev=await page.evaluate(()=>{let n=0;window.addEventListener('yj:bonus-change',()=>n++);window.BonusEngine&&window.BonusEngine.recompute();const a=n;window.BonusEngine&&window.BonusEngine.recompute(true);return{a,b:n};});
    t('装备变更事件仍派发/静默不派发',ev.a>=1&&ev.b===ev.a,`无参=${ev.a} 静默后=${ev.b}`);
  }catch(e){t('第五轮执行异常',false,e.message.slice(0,200));}
  finally{try{if(browser)browser.close();}catch(_){}try{child.kill('SIGTERM');}catch(_){}}
  fs.writeFileSync('/tmp/v764-r5-issues.json',JSON.stringify(issues,null,2));
  console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
  process.exit(fail?1:0);
})();
