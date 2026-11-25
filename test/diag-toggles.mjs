import { chromium } from 'playwright';
const BASE='http://127.0.0.1:8787';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:1366,height:900}});
await c.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.0.3'}),getSyncStatus:()=>Promise.resolve({version:'7.0.3',state:'idle'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false}),minimizeWindow(){},maximizeWindow(){},closeWindow(){},isMaximized:()=>Promise.resolve(false),syncNow:()=>Promise.resolve({ok:true})};});
const p=await c.newPage();
await p.goto(BASE+'/settings.html?goto=settings',{waitUntil:'load'});
await p.waitForTimeout(1500);
console.log('=== 模块可用性 ===');
console.log(JSON.stringify(await p.evaluate(()=>({
  SystemGuard:!!window.SystemGuard, toggleNight:!!(window.SystemGuard&&window.SystemGuard.toggleNight),
  YJPerf:!!window.YJPerf, perfToggle:!!(window.YJPerf&&window.YJPerf.toggle),
  Celebration:!!window.Celebration, celebToggle:!!(window.Celebration&&window.Celebration.toggle),
  StoryInput:!!window.StoryInput, readAloud:!!(window.StoryInput&&window.StoryInput.readAloud)
}))));
for (const id of ['tileNight','tilePerf','tileCelebr','tileTts']) {
  const before=await p.evaluate(()=>({night:localStorage.getItem('storyNightMode'),perf:localStorage.getItem('yunjingLowSpec'),celebr:localStorage.getItem('storyCelebration')}));
  await p.locator('#'+id).click();
  await p.waitForTimeout(300);
  const note=await p.locator('#switchNote').textContent().catch(()=>'(无switchNote)');
  const after=await p.evaluate(()=>({night:localStorage.getItem('storyNightMode'),perf:localStorage.getItem('yunjingLowSpec'),celebr:localStorage.getItem('storyCelebration')}));
  console.log(`${id}: 提示="${note.trim()}" | 存储变化=${JSON.stringify(before)!==JSON.stringify(after)}`);
}
await b.close();
