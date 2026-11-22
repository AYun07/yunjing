import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('http://127.0.0.1:9155/studio.html?dev=1');
await p.waitForFunction(()=>window.storyDLCManager,{timeout:20000});
await p.waitForTimeout(800);
const r=await p.evaluate(()=>{
  const m=window.storyDLCManager;
  const yj=window.YJPlugins;
  return {
    dlcTypeof:typeof m.dlcPackages, dlcIsArray:Array.isArray(m.dlcPackages), dlcVal:String(m.dlcPackages).slice(0,60),
    mKeys:Object.keys(m).slice(0,15),
    yjKeys:Object.keys(yj||{}), listType:typeof (yj&&yj.list),
    listRet:(()=>{try{const l=yj.list();return {isArr:Array.isArray(l),len:l&&l.length}}catch(e){return 'err:'+e.message}})()
  };
});
console.log(JSON.stringify(r,null,2));
await b.close();
