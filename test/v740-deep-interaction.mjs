import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8791';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const found=[]; const log=[];
async function ctx(){
  const c=await browser.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript(()=>{ window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.5.0'}),getSyncStatus:()=>Promise.resolve({version:'7.5.0',lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})}; });
  return c;
}
function watch(page,tag){ const e=[]; page.on('pageerror',x=>e.push('PAGEERROR:'+x.message)); page.on('console',m=>{if(m.type()==='error')e.push('CONSOLE:'+m.text().slice(0,140));}); return e; }

// A. 5 个世界切换 + 各打开一次沉浸抽屉/角色塑造/境界梯（真实点击）
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'worlds');
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1000);
  const worlds=['shengtang','wangyou','fanrenxiuxian','doupocangqiong','free'];
  for(const g of worlds){
    await page.goto(BASE+'/studio.html?genre='+g,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1400);
    const before=errs.length;
    // 真实点击左栏前 12 个可见项
    const items=await page.locator('.lr-item:visible, .left-rail button:visible').all();
    for(const it of items.slice(0,12)){ try{await it.click({timeout:250,force:true}).catch(()=>{}); await page.waitForTimeout(30);}catch(_){} }
    await page.waitForTimeout(200);
    // 关闭可能打开的浮层
    await page.keyboard.press('Escape').catch(()=>{});
    const ne=errs.slice(before);
    if(ne.length) found.push('世界'+g+' 交互错误: '+ne.slice(0,2).join(' | '));
    log.push('世界'+g+' 左栏项'+items.length+' 错误'+ne.length);
  }
  await c.close();
}

// B. 真实键盘输入到输入框 + 发送（不接 AI，只测输入不卡）
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'input');
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1600);
  const inp=page.locator('#userInput');
  if(await inp.count()){
    await inp.fill('测试输入：你好云心').catch(()=>{});
    const val=await inp.inputValue().catch(()=>'');
    if(!val.includes('测试输入')) found.push('输入框无法键入内容（fill 后为空）');
    // 可见性/可点性
    const info=await page.evaluate(()=>{const el=document.getElementById('userInput');const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {vis:getComputedStyle(el).visibility,pe:getComputedStyle(el).pointerEvents,hit:top?.id||top?.tagName};});
    if(info.vis!=='visible'||info.pe==='none') found.push('输入框被隐藏/禁点: '+JSON.stringify(info));
    if(info.hit && info.hit!=='userInput' && info.hit!=='INPUT') found.push('输入框中心被遮挡: '+JSON.stringify(info));
    log.push('输入框: '+JSON.stringify(info)+' val='+val.slice(0,20));
  } else { found.push('shengtang 页找不到 #userInput'); }
  await c.close();
}

// C. 快速连点随缘开局（竞态回归）
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'fate');
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  // 进入创世流程找到 fate-btn
  const btns=await page.locator('.fate-btn:visible, button:has-text("随缘"):visible').all();
  if(btns.length){
    for(const b of btns){ for(let i=0;i<5;i++){ await b.click({timeout:250,force:true}).catch(()=>{}); } }
    await page.waitForTimeout(400);
    if(errs.length) found.push('随缘开局连点报错: '+errs.slice(0,2).join(' | '));
    log.push('随缘开局连点 '+btns.length+' 按钮 x5 错误'+errs.length);
  } else { log.push('随缘开局按钮未在 index 首页（需进创世流程，跳过）'); }
  await c.close();
}

// D. 设置页全量卡片可见性（v7.3.1 回归）+ 保存配置不报错
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'settings');
  await page.goto(BASE+'/settings.html',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1500);
  const cards=await page.evaluate(()=>{const cs=document.querySelectorAll('.api-card');let hid=0;cs.forEach(x=>{if(getComputedStyle(x).display==='none')hid++;});return {total:cs.length,hidden:hid};});
  if(cards.hidden>0) found.push('设置页仍有隐藏接口卡: '+JSON.stringify(cards));
  // 真实点击保存全部配置
  const save=page.locator('button:has-text("保存全部配置"):visible');
  if(await save.count()){ await save.first().click({timeout:1500,force:true}).catch(()=>{}); await page.waitForTimeout(400); }
  if(errs.length) found.push('设置页保存报错: '+errs.slice(0,3).join(' | '));
  log.push('设置页卡片: '+JSON.stringify(cards)+' 错误'+errs.length);
  await c.close();
}

// E. 世界时钟拖拽全屏（v7.3.1 回归）
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'clock');
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1600);
  const pill=page.locator('#worldClockPill');
  if(await pill.count()){
    await page.evaluate(()=>{const p=document.getElementById('worldClockPill');p.style.display='flex';});
    const box=await pill.boundingBox();
    if(box){ await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+300,box.y+200,{steps:8}); await page.mouse.up(); await page.waitForTimeout(200);
      const nb=await pill.boundingBox();
      if(nb && Math.abs(nb.x-box.x)<50) found.push('世界时钟横向仍拖不动(x '+box.x.toFixed(0)+'→'+nb.x.toFixed(0)+')');
      log.push('时钟拖拽 x '+box.x.toFixed(0)+'→'+(nb?nb.x.toFixed(0):'?'));
    }
  }
  if(errs.length) found.push('时钟拖拽报错: '+errs.slice(0,2).join('|'));
  await c.close();
}

// F. 酒馆卡导出真实下载
{
  const c=await ctx(); const page=await c.newPage(); const errs=watch(page,'card');
  await page.goto(BASE+'/settings.html',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1500);
  await page.evaluate(()=>{try{ConfigModal.toggleMMSection(true);}catch(e){}}); await page.waitForTimeout(300);
  const dl=page.waitForEvent('download',{timeout:5000}).catch(()=>null);
  const btn=page.locator('button:has-text("导出为酒馆卡"):visible');
  if(await btn.count()){ await btn.first().click({timeout:1500,force:true}).catch(()=>{}); }
  const d=await dl;
  if(!d) found.push('酒馆卡导出未触发下载');
  else log.push('酒馆卡下载: '+d.suggestedFilename());
  if(errs.length) found.push('酒馆卡导出报错: '+errs.slice(0,2).join('|'));
  await c.close();
}

await browser.close();
console.log('===== 深度交互日志 ====='); log.forEach(x=>console.log(' - '+x));
console.log('\n===== 真实问题 ('+found.length+') ====='); found.forEach((x,i)=>console.log((i+1)+'. '+x));
