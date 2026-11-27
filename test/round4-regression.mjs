import { chromium } from '/workspace/yunjing/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8791';
const issues=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
async function mkctx(dl=false){
  const ctx=await b.newContext({viewport:{width:1366,height:900},acceptDownloads:dl});
  await ctx.addInitScript(()=>{try{localStorage.setItem('yj_first_run_done','1');localStorage.setItem('yjOnboarded','1');}catch(e){}window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};});
  return ctx;
}
function watch(p,tag){p.on('pageerror',e=>issues.push(`[${tag}] JS: ${e.message.slice(0,90)}`));}

// 1. 二创板块加载（studio 页真实点击入口）
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'二创');
  await p.goto(`${BASE}/studio.html?genre=free`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(async()=>{await new Promise(r=>{const s=document.createElement('script');s.src='js/creation-hub.js';s.onload=r;s.onerror=r;document.head.appendChild(s);});}).catch(()=>{});
  const r=await p.evaluate(()=>{
    const hasHub=!!window.CreationHub;
    const btn=Array.from(document.querySelectorAll('button,a,[onclick]')).find(x=>(x.textContent||'').includes('创意工坊')||(x.getAttribute('onclick')||'').includes('CreationHub'));
    return {hasHub,hasEntry:!!btn};
  });
  console.log('二创:',JSON.stringify(r));
  if(!r.hasEntry&&!r.hasHub) issues.push('[二创] 无入口且模块未加载');
  await ctx.close();
}

// 2. 对话框可输入（开局后 input 可见可聚焦）
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'输入');
  await p.goto(`${BASE}/studio.html?genre=free`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  // 尝试真实触发开局：点击含"踏入/开始/进入/启程"的元素
  const start=p.locator('button:has-text("踏入"),button:has-text("开始"),button:has-text("启程"),button:has-text("进入"),.wiz-start-btn,#startBtn').first();
  let clicked=false;
  if(await start.count()){try{await start.click({force:true,timeout:2000});clicked=true;}catch(e){}}
  await p.waitForTimeout(1000);
  const r=await p.evaluate(()=>{
    const el=document.getElementById('userInput')||document.querySelector('.input-area textarea,.input-area input,#chatInput');
    if(!el) return {exists:false};
    const rect=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return {exists:true,w:Math.round(rect.width),h:Math.round(rect.height),vis:cs.visibility,pe:cs.pointerEvents,
      topEl:(()=>{const t=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return t?.id||t?.className||t?.tagName;})()};
  });
  console.log('输入:',JSON.stringify(r));
  if(r.exists&&r.w>0&&r.vis==='hidden') issues.push('[输入] 输入框可见宽>0但visibility:hidden');
  await ctx.close();
}

// 3. 世界时钟可横向拖动
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'时钟');
  await p.goto(`${BASE}/index.html?goto=index`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1800);
  const pill=p.locator('#worldClockPill');
  if(await pill.count()){
    // 强制显示后拖
    const before=await pill.evaluate(x=>({left:x.style.left,disp:getComputedStyle(x).display})).catch(()=>({}));
    await pill.evaluate(x=>{x.style.display='flex';}).catch(()=>{});
    const box=await pill.boundingBox().catch(()=>null);
    if(box){
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await p.mouse.down();
      await p.mouse.move(box.x+box.width/2+120,box.y+box.height/2,{steps:6});
      await p.mouse.up();
      await p.waitForTimeout(200);
      const after=await pill.evaluate(x=>x.style.left).catch(()=>'');
      console.log('时钟:',JSON.stringify({before:before.left,after}));
      if(after===before.left) issues.push('[时钟] 拖动后left未变化');
    } else console.log('时钟: 无boundingBox');
  } else console.log('时钟: 无元素(index页可能不显示)');
  await ctx.close();
}

// 4. 小云面板不吞点击（透明时不拦截）
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'小云');
  await p.goto(`${BASE}/index.html?goto=index`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  const r=await p.evaluate(()=>{
    const panels=Array.from(document.querySelectorAll('.xy-panel'));
    return panels.map(x=>({on:x.classList.contains('on'),pe:getComputedStyle(x).pointerEvents,op:getComputedStyle(x).opacity})).slice(0,8);
  });
  console.log('小云:',JSON.stringify(r));
  const bad=r.filter(x=>!x.on&&x.pe!=='none'&&parseFloat(x.op)<0.1);
  if(bad.length) issues.push(`[小云] ${bad.length}个透明面板仍拦截点击`);
  await ctx.close();
}

// 5. 酒馆卡导出真实下载
{
  const ctx=await mkctx(true); const p=await ctx.newPage(); watch(p,'酒馆卡');
  await p.goto(`${BASE}/settings.html?goto=settings`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{try{ConfigModal.toggleMMSection&&ConfigModal.toggleMMSection(true);}catch(e){}}).catch(()=>{});
  await p.waitForTimeout(300);
  const btn=p.locator('button:has-text("导出为酒馆卡"):visible');
  const cnt=await btn.count();
  console.log('酒馆卡按钮:',cnt);
  if(cnt){
    const dl=p.waitForEvent('download',{timeout:6000}).catch(()=>null);
    await btn.first().click({force:true}).catch(()=>{});
    const d=await dl;
    console.log('酒馆卡下载:',d?d.suggestedFilename():'NONE');
    if(!d) issues.push('[酒馆卡] 点击后无下载');
  } else issues.push('[酒馆卡] 设置页无导出按钮');
  await ctx.close();
}

// 6. 三个新世界地图底图加载
for(const g of ['shengtang','jinzhanfashi','menglongguojiang']){
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'底图'+g);
  await p.goto(`${BASE}/map-verified.html?genre=${g}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>Array.from(document.querySelectorAll('img')).filter(x=>x.complete&&x.naturalWidth===0&&x.src).map(x=>x.src.split('/').pop()));
  console.log('底图'+g+':',JSON.stringify(r));
  if(r.length) issues.push(`[${g}底图] 坏图: ${r.join(',')}`);
  await ctx.close();
}

await b.close();
console.log('\n=== 回归问题:',issues.length,'===');
issues.forEach((x,i)=>console.log((i+1)+'.',x));
