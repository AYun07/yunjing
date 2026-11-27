import { chromium } from '/workspace/yunjing/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8791';
const found=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});

async function mkctx(){
  const ctx=await b.newContext({viewport:{width:1366,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem('yj_first_run_done','1');localStorage.setItem('yjOnboarded','1');}catch(e){}window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false)};});
  return ctx;
}
function watch(p,tag){
  p.on('pageerror',e=>found.push(`[${tag}] JS错误: ${e.message.slice(0,100)}`));
  p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))found.push(`[${tag}] 控制台: ${m.text().slice(0,100)}`);});
}

// 逐世界真实创建流程
for(const g of ['shengtang','jinzhanfashi','menglongguojiang']){
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,g);
  await p.goto(`${BASE}/studio.html?genre=${g}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  // 收集 setup 界面所有可点元素
  const setup=await p.evaluate(()=>({
    inSetup:document.body.classList.contains('in-setup'),
    buttons:Array.from(document.querySelectorAll('button')).filter(x=>x.offsetWidth>0).map(x=>(x.textContent||'').trim()).filter(Boolean).slice(0,30),
    techCards:document.querySelectorAll('.tech-item').length,
    techDescUndefined:Array.from(document.querySelectorAll('.tech-desc')).filter(x=>x.textContent.includes('undefined')).length,
    techCostZero:Array.from(document.querySelectorAll('.tech-item[data-cost]')).filter(x=>x.getAttribute('data-cost')==='0').length,
    selects:Array.from(document.querySelectorAll('select')).length,
    inputs:Array.from(document.querySelectorAll('input[type=text],textarea')).length
  }));
  console.log(g+' setup:',JSON.stringify({inSetup:setup.inSetup,techCards:setup.techCards,techDescUndefined:setup.techDescUndefined,selects:setup.selects,inputs:setup.inputs,buttons:setup.buttons.slice(0,8)}));
  if(setup.techCards>0&&setup.techDescUndefined>0) found.push(`[${g}] 功法描述渲染undefined ×${setup.techDescUndefined}`);
  if(g==='shengtang'&&setup.techCostZero>1) found.push(`[${g}] 多个功法cost=0（原价应>0）`);
  await ctx.close();
}

// 圣堂真实创建：填名字→选身份→点入场
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'shengtang-create');
  await p.goto(`${BASE}/studio.html?genre=shengtang`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  // 找玩家名输入
  const nameInput=p.locator('input[type=text]').first();
  let nameOk=false;
  if(await nameInput.count()){try{await nameInput.fill('测试修行者');nameOk=true;}catch(e){}}
  // 点所有"入场/开始/创建"按钮
  const startBtns=p.locator('button:has-text("入场"),button:has-text("开始"),button:has-text("创建"),button:has-text("启程")');
  const cnt=await startBtns.count();
  console.log('nameOk',nameOk,'startButtons',cnt);
  if(cnt===0) found.push('[圣堂创建] 找不到入场/开始按钮');
  else{
    await startBtns.first().click({force:true}).catch(e=>found.push('[圣堂创建] 点击按钮失败:'+e.message.slice(0,60)));
    await p.waitForTimeout(800);
    const after=await p.evaluate(()=>({inSetup:document.body.classList.contains('in-setup'),invokes:window.storyFramework?.storyState?.isStoryStarted}));
    console.log('after start:',JSON.stringify(after));
  }
  await ctx.close();
}

// 左栏所有入口真实点击（用 free 世界避免世界特定依赖）
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'leftrail');
  await p.goto(`${BASE}/index.html?goto=index`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  const before=found.length;
  // 点击左栏项（若存在）
  const items=p.locator('.lr-item,.left-rail-item,[data-lr-entry]');
  const n=await items.count();
  console.log('leftrail items:',n);
  for(let i=0;i<Math.min(n,20);i++){
    await items.nth(i).click({force:true,timeout:1500}).catch(()=>{});
    await p.waitForTimeout(60);
  }
  if(found.length>before) console.log('leftrail induced',found.length-before,'errors');
  await ctx.close();
}

// 地图页真实切换（各世界 atlas）
{
  const ctx=await mkctx(); const p=await ctx.newPage(); watch(p,'map');
  await p.goto(`${BASE}/map-verified.html?genre=shengtang`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  const r=await p.evaluate(()=>({
    hasCanvas:!!document.querySelector('canvas'),
    nodes:document.querySelectorAll('.map-node,.atlas-node,[data-node]').length,
    bodyLen:document.body.innerHTML.length,
    err:document.body.innerText.slice(0,100)
  }));
  console.log('map:',JSON.stringify(r));
  await ctx.close();
}

await b.close();
console.log('\n=== 深度审计发现问题:',found.length,'===');
found.slice(0,40).forEach((x,i)=>console.log((i+1)+'.',x));
