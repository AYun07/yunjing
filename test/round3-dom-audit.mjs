import { chromium } from '/workspace/yunjing/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8791';
const issues=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
async function mkctx(){
  const ctx=await b.newContext({viewport:{width:1366,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem('yj_first_run_done','1');localStorage.setItem('yjOnboarded','1');}catch(e){}window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false)};});
  return ctx;
}
const pages=[
  ['index.html?goto=index','大厅'],
  ['studio.html?genre=shengtang','圣堂工坊'],
  ['studio.html?genre=jinzhanfashi','近战法师工坊'],
  ['studio.html?genre=menglongguojiang','猛龙过江工坊'],
  ['settings.html?goto=settings','设置'],
  ['map-verified.html?genre=shengtang','舆图'],
  ['xiaoyun.html','小云'],
  ['changelog/index.html','更新日志']
];
for(const [pg,label] of pages){
  const ctx=await mkctx(); const p=await ctx.newPage();
  p.on('pageerror',e=>issues.push(`[${label}] JS错误 ${e.message.slice(0,80)}`));
  await p.goto(`${BASE}/${pg}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{
    const out={};
    // 1. 空按钮（无文字无title无aria-label，可见）
    out.emptyButtons=Array.from(document.querySelectorAll('button')).filter(x=>{
      const cs=getComputedStyle(x); return x.offsetWidth>0&&cs.visibility!=='hidden'&&
      !(x.textContent||'').trim()&&!x.title&&!x.getAttribute('aria-label');
    }).length;
    // 2. undefined/NaN 文本
    const txt=document.body.innerText;
    out.undefinedCount=(txt.match(/undefined/g)||[]).length;
    out.nanCount=(txt.match(/NaN/g)||[]).length;
    // 3. 重复 id
    const ids=Array.from(document.querySelectorAll('[id]')).map(x=>x.id);
    out.dupIds=ids.filter((v,i)=>ids.indexOf(v)!==i).slice(0,5);
    // 4. 图片加载失败
    out.brokenImgs=Array.from(document.querySelectorAll('img')).filter(x=>x.complete&&x.naturalWidth===0&&x.src).map(x=>x.src.split('/').pop()).slice(0,5);
    // 5. 空链接 href
    out.emptyLinks=Array.from(document.querySelectorAll('a')).filter(x=>!x.getAttribute('href')||x.getAttribute('href')==='#').length;
    // 6. 标题为空
    out.emptyTitles=Array.from(document.querySelectorAll('h1,h2,h3')).filter(x=>!(x.textContent||'').trim()).length;
    // 7. 不可点击但带 onclick 的元素（pointer-events none）
    out.deadClick=Array.from(document.querySelectorAll('[onclick]')).filter(x=>getComputedStyle(x).pointerEvents==='none'&&x.offsetWidth>0).length;
    return out;
  });
  console.log(label,JSON.stringify(r));
  if(r.emptyButtons>0) issues.push(`[${label}] 空按钮 ${r.emptyButtons} 个`);
  if(r.undefinedCount>0) issues.push(`[${label}] 页面含 undefined ×${r.undefinedCount}`);
  if(r.nanCount>0) issues.push(`[${label}] 页面含 NaN ×${r.nanCount}`);
  if(r.dupIds.length) issues.push(`[${label}] 重复id: ${r.dupIds.join(',')}`);
  if(r.brokenImgs.length) issues.push(`[${label}] 坏图: ${r.brokenImgs.join(',')}`);
  if(r.emptyLinks>0) issues.push(`[${label}] 空链接 ${r.emptyLinks} 个`);
  if(r.emptyTitles>0) issues.push(`[${label}] 空标题 ${r.emptyTitles} 个`);
  if(r.deadClick>0) issues.push(`[${label}] 死点击元素 ${r.deadClick} 个`);
  await ctx.close();
}
await b.close();
console.log('\n=== DOM审计问题:',issues.length,'===');
issues.forEach((x,i)=>console.log((i+1)+'.',x));
