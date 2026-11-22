import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:1366,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:9155/studio.html?dev=1');
await p.waitForFunction(()=>window.storyFramework,{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1500);
const g = await p.evaluate(()=>({
  ver: window.YJ_VER,
  storyFW: typeof window.storyFramework,
  fwGenre: window.storyFramework && window.storyFramework.genre,
  dlcMgr: typeof window.storyDLCManager,
  dlcCount: window.storyDLCManager && window.storyDLCManager.dlcPackages && window.storyDLCManager.dlcPackages.length,
  plugins: typeof window.YJPlugins,
  pluginList: window.YJPlugins && window.YJPlugins.list && (()=>{try{return window.YJPlugins.list().length}catch(e){return 'err:'+e.message}})(),
  patch: typeof window.PatchEngine,
  adapters: typeof window.ContentAdapters,
  fileBridge: typeof window.FileBridge,
  saveSlots: typeof window.SaveSlots || typeof window.saveSlots,
  lsKeys: Object.keys(localStorage).filter(k=>/dlc|save|plugin|preset|world|pack|kb|regex/i.test(k)).slice(0,30)
}));
console.log(JSON.stringify(g,null,2));
console.log('ERRS:',errs.slice(0,5));
await b.close();
