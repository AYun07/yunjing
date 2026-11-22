import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:9155/studio.html?dev=1');
await p.waitForFunction(()=>window.storyDLCManager,{timeout:20000});
await p.waitForTimeout(800);
const r=await p.evaluate(()=>{
  const m=window.storyDLCManager;
  const info={ctor:m.constructor.name, hasCreate:typeof m.createDLC, hasActivate:typeof m.activateDLC, keys:Object.getOwnPropertyNames(Object.getPrototypeOf(m)).slice(0,20)};
  try{
    const d=m.createDLC('test','desc',[{title:'t',content:'c'}]);
    info.ret=typeof d; info.retVal=d?String(d.id):'null/undefined';
    info.count=m.dlcPackages&&m.dlcPackages.length;
    info.raw=(localStorage.getItem('storyDLC_free')||'').slice(0,80);
  }catch(e){info.err=e.message;info.stack=e.stack?.split('\n').slice(0,3)}
  return info;
});
console.log(JSON.stringify(r,null,2));
await b.close();
