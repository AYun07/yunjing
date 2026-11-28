import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE='http://127.0.0.1:8791',VER='7.6.3',OUT='/tmp/v764-r2-issues.json';
const issues=[],log=[],seen=new Set();
function push(t,x){const c=String(x||'').trim();if(!c||/favicon|net::ERR|404|IPH_|dbus|GPU|501 Unsupported/i.test(c))return;const k=t+'|'+c.slice(0,80);if(seen.has(k))return;seen.add(k);issues.push({tag:t,text:c.slice(0,220)});}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
async function ctx(){const c=await b.newContext({viewport:{width:1366,height:900},acceptDownloads:true});
  await c.addInitScript((v)=>{localStorage.setItem('storyApiConfig',JSON.stringify({endpoint:'http://127.0.0.1:8792/v1',apiKey:'mock',model:'mock-model',type:'openai',maxTokens:4096,temperature:0.9,stream:false}));window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:v}),getSyncStatus:()=>Promise.resolve({version:v,lastSync:Date.now(),state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true,downloaded:0})};},VER);return c;}
// === A. 工具箱全菜单点击 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('dialog',d=>d.accept().catch(()=>{}));
  p.on('pageerror',e=>push('TOOLBOX:err',(e.stack||e.message).slice(0,300)));
  p.on('console',m=>{if(m.type()==='error')push('TOOLBOX:console',m.text());});
  await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  // 打开工具箱
  await p.evaluate(()=>window.Toolbox&&window.Toolbox.open()).catch(()=>{});
  await p.waitForTimeout(300);
  const sheet=await p.locator('#toolboxSheet.show').count();
  log.push('工具箱打开='+sheet);
  // 点工具箱内所有可点项
  const items=await p.locator('#toolboxSheet [data-act], #toolboxSheet .tb-item, #toolboxSheet button:visible, #toolboxSheet [role=button]:visible').all();
  log.push('工具箱菜单项='+items.length);
  for(let i=0;i<items.length&&i<40;i++){
    try{await items[i].click({timeout:250,force:true}).catch(()=>{});await p.waitForTimeout(30);
      if(i%5===4)await p.keyboard.press('Escape').catch(()=>{});
      // 关闭可能打开的子层再继续
      await p.evaluate(()=>{const s=document.getElementById('toolboxSheet');if(s)s.classList.add('show');}).catch(()=>{});
    }catch(_){}
  }
  log.push('工具箱点击完成, 问题='+issues.length);
  await c.close();
}
// === B. 世界切换状态隔离 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('pageerror',e=>push('WORLD:err',(e.stack||e.message).slice(0,300)));
  await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);
  // 切换多个世界，检查 config 与状态是否串界
  for(const g of ['shengtang','wangyou','scifi','mystery','free','wuxia','cthulhu']){
    await p.evaluate((gg)=>{const fw=window.storyFramework;if(fw)fw.switchGenre&&fw.switchGenre(gg);},g).catch(()=>{});
    await p.goto(BASE+'/studio.html?genre='+g,{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);
    const d=await p.evaluate(()=>({genre:window.storyFramework?.config?.genreKey||window.storyFramework?.genre,name:window.GenreStoryConfig?.genreName||null,bad:/未知世界|undefined/.test(document.body.innerText.slice(0,2000))}));
    log.push('世界'+g+' -> config.genre='+d.genre+' name='+d.name+' bad='+d.bad);
    if(d.genre&&d.genre!==g&&d.genre!=='free')push('WORLD','切到'+g+'后config.genre='+d.genre+'（串界）');
    if(d.bad)push('WORLD',g+'首屏出现未知世界/undefined');
  }
  await c.close();
}
// === C. 键盘快捷键 ===
{
  const c=await ctx(),p=await c.newPage();
  p.on('pageerror',e=>push('KEY:err',(e.stack||e.message).slice(0,300)));
  await p.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});await p.waitForTimeout(2200);
  for(const key of ['r','R','Escape','?','/','n']){await p.keyboard.press(key).catch(()=>{});await p.waitForTimeout(120);}
  log.push('键盘快捷键测试完成');
  await c.close();
}
await b.close();
writeFileSync(OUT,JSON.stringify(issues,null,2));
writeFileSync(OUT.replace('.json','.log.txt'),log.join('\n'));
console.log('LOG:\n'+log.join('\n'));
console.log('\nR2问题('+issues.length+'):');issues.forEach((x,i)=>console.log((i+1)+'.['+x.tag+'] '+x.text));
