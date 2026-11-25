import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8787';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let pass=0,fail=0;
const ok=(n,c,x='')=>{console.log((c?'  ✓ ':'  ✗ ')+n+(x?' → '+x:''));c?pass++:fail++;};

async function mkctx(){
  const c=await b.newContext({viewport:{width:1366,height:900}});
  await c.addInitScript(()=>{
    window.__progressEvents=[];
    window.YunJingDesktop={isDesktop:true,
      getInfo:()=>Promise.resolve({version:'7.0.4'}),
      getSyncStatus:()=>Promise.resolve({version:'7.0.4',state:'idle'}),
      checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),
      onUpdateProgress:(cb)=>{window.__emitProgress=(p)=>{window.__progressEvents.push(p);cb(p);};return()=>{};},
      minimizeWindow(){},maximizeWindow(){},closeWindow(){},
      isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};
  });
  return c;
}

// 1) 角色塑造唯一入口 + 原著联动
{
  const c=await mkctx();const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/studio.html?genre=fanrenxiuxian',{waitUntil:'load'});
  await p.waitForTimeout(2500);
  console.log('=== ① 角色塑造唯一入口 ===');
  const cnt=await p.locator('#csWrap').count();
  ok('角色塑造只有1个入口',cnt===1,'实际'+cnt);
  const titles=await p.locator('.cs-title').allTextContents();
  ok('标题为新UI(含"自己填样貌")',titles.some(t=>t.includes('自己填样貌')),JSON.stringify(titles));

  console.log('=== ② 原著主角联动 ===');
  // 扮演模式：点原著主角
  const heroBtn=p.locator('.wiz-stance-btn[data-stance="hero"]');
  if(await heroBtn.count()){
    await heroBtn.click();await p.waitForTimeout(500);
    const filled=await p.evaluate(()=>({
      name:(document.querySelector('#wiz_playerName')||{}).value||'',
      look:(document.querySelector('#csLookInput')||{}).value||'',
      bio:(document.querySelector('#wiz_heroBio')||{}).value||''
    }));
    ok('主角态填入姓名',!!filled.name,filled.name);
    ok('主角态填入样貌(原著)',filled.look.includes('原著')||filled.look.includes('韩立'),filled.look.slice(0,40));
    ok('主角态填入小传(原著身份)',filled.bio.includes('原著身份'),filled.bio.slice(0,50));
  } else ok('主角按钮存在',false,'未找到');

  console.log('=== ③ 原著配角联动 ===');
  const sideBtn=p.locator('.wiz-stance-btn[data-stance="side"]');
  if(await sideBtn.count()){
    await sideBtn.click();await p.waitForTimeout(600);
    const filled=await p.evaluate(()=>({
      name:(document.querySelector('#wiz_playerName')||{}).value||'',
      persona:(document.querySelector('#csPersonaInput')||{}).value||'',
      bio:(document.querySelector('#wiz_heroBio')||{}).value||''
    }));
    ok('配角态填入姓名',!!filled.name,filled.name);
    ok('配角态填入性格(disposition)',!!filled.persona,filled.persona.slice(0,30));
    ok('配角态小传含原著命运',filled.bio.includes('原著命运')||filled.bio.includes('原著身份'),filled.bio.slice(0,50));
  } else ok('配角按钮存在',false,'未找到');
  ok('角色流程无脚本错误',errs.length===0,JSON.stringify(errs.slice(0,2)));
  await c.close();
}

// 2) 设置页开关 + 进度条
{
  const c=await mkctx();const p=await c.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/settings.html?goto=settings',{waitUntil:'load'});
  await p.waitForTimeout(1500);
  console.log('=== ④ 设置页分区（应有5个）===');
  const hs=await p.locator('h2').allTextContents();
  ok('设置页含5个分区',hs.length>=5,JSON.stringify(hs));
  console.log('=== ⑤ 全局开关（4个可用）===');
  for(const id of ['tileNight','tilePerf','tileCelebr','tileTts']){
    const before=await p.evaluate(()=>JSON.stringify({n:localStorage.getItem('storyNightMode'),p:localStorage.getItem('yunjingLowSpec'),c:localStorage.getItem('storyCelebration')}));
    await p.locator('#'+id).click();await p.waitForTimeout(250);
    const note=(await p.locator('#switchNote').textContent().catch(()=>'')).trim();
    const after=await p.evaluate(()=>JSON.stringify({n:localStorage.getItem('storyNightMode'),p:localStorage.getItem('yunjingLowSpec'),c:localStorage.getItem('storyCelebration')}));
    const changed=before!==after;
    const good=id==='tileTts' ? !note.includes('模块未就绪') : (changed||note.includes('已'));
    ok(id+' 有效',good,'提示='+note+' 变化='+changed);
  }
  console.log('=== ⑥ 进度条事件 ===');
  await p.evaluate(()=>window.__emitProgress&&window.__emitProgress({phase:'files',percent:45,detail:'下载 studio.html'}));
  await p.waitForTimeout(200);
  const pr=await p.evaluate(()=>({
    visible:document.querySelector('#updateProgress').style.display,
    bar:document.querySelector('#upBar').style.width,
    detail:document.querySelector('#upDetail').textContent
  }));
  ok('进度条显示',pr.visible==='block',pr.visible);
  ok('进度条宽度更新',pr.bar==='45%',pr.bar);
  ok('进度详情显示',pr.detail.includes('studio.html'),pr.detail);
  await p.evaluate(()=>window.__emitProgress&&window.__emitProgress({phase:'error',percent:100,detail:'文件校验失败',error:true,errors:['studio.html：校验不通过']}));
  await p.waitForTimeout(200);
  const er=await p.evaluate(()=>({eb:document.querySelector('#upErrors').style.display,txt:document.querySelector('#upErrors').textContent}));
  ok('错误详情显示',er.eb==='block'&&er.txt.includes('studio.html'),er.txt.slice(0,60));
  ok('设置页无脚本错误',errs.length===0,JSON.stringify(errs.slice(0,2)));
  await c.close();
}

await b.close();
console.log('\n结果: '+pass+' PASS / '+fail+' FAIL');
process.exit(fail?1:0);
