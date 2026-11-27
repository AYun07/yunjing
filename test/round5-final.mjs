import { chromium } from '/workspace/yunjing/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8791';
const issues=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:1366,height:900}});
await ctx.addInitScript(()=>{try{localStorage.setItem('yj_first_run_done','1');localStorage.setItem('yjOnboarded','1');}catch(e){}window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false})};});
const p=await ctx.newPage();
p.on('pageerror',e=>issues.push('JS: '+e.message.slice(0,90)));
await p.goto(`${BASE}/studio.html?genre=shengtang`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1800);
await p.evaluate(async()=>{await new Promise(r=>{const s=document.createElement('script');s.src='js/atlas-verified-all.js';s.onload=r;s.onerror=r;document.head.appendChild(s);});});
await p.waitForTimeout(400);

// 1. 41 世界 atlas 完整性
const atlas=await p.evaluate(()=>{
  const A=window.ATLAS_VERIFIED||{};
  const keys=Object.keys(A);
  const empty=keys.filter(k=>!A[k]?.eras?.length||!A[k]?.eras[0]?.places?.length);
  return {total:keys.length,empty,hasST:!!A.shengtang,hasJZ:!!A.jinzhanfashi,hasML:!!A.menglongguojiang};
});
console.log('atlas:',JSON.stringify(atlas));
if(atlas.total<41) issues.push('atlas世界数不足:'+atlas.total);
if(atlas.empty.length) issues.push('空atlas:'+atlas.empty.join(','));

// 2. 三世界原著锚点正确性（无交叉污染）
// 逐世界采集 KB 与 config（因为按 genre 懒加载）
const collected={};
for(const g of ['shengtang','jinzhanfashi','menglongguojiang']){
  await p.goto(`${BASE}/studio.html?genre=${g}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  collected[g]=await p.evaluate((g)=>{
    const kb=window.KB_PRESETS?.[g]||[];
    const cfgname=g==='shengtang'?'ShengtangStoryConfig':g==='jinzhanfashi'?'JinzhanfashiStoryConfig':'MenglongguojiangStoryConfig';
    const c=window[cfgname];
    const req=['fullSystemPrompt','defaultSystemPrompt','defaultDynamicWorldPrompt','setupMeta','openings','techniques','statKeys','gauges','nameSeeds','buildOpeningInstruction','onInit'];
    return {kbText:kb.map(x=>(x.title||'')+(x.content||'')).join('|'),kbCount:kb.length,missing:c?req.filter(k=>!c[k]):['CONFIG_MISSING']};
  },g);
}
console.log('collected:',JSON.stringify(Object.fromEntries(Object.entries(collected).map(([k,v])=>[k,{kb:v.kbCount,missing:v.missing}]))));
const canon=await p.evaluate((collected)=>{
  const out={};
  for(const [g,expect,forbid] of [
    ['shengtang',['王猛','命痕','杨颖','张小江','胡静','马甜儿','明人','莫山','妄天'],['秦阳','唐家三少','凝气聚灵']],
    ['jinzhanfashi',['顾飞','千里一醉','蝴蝶蓝','公子精英团','韩家公子','席小天','云端城'],['云天空']],
    ['menglongguojiang',['王钟','噬魂','骷髅精灵','冯雪','陆小雪','魔宫','暗黑金字塔'],[]]
  ]){
    const all=collected[g]?.kbText||'';
    out[g]={expect:expect.filter(e=>!all.includes(e)),forbid:forbid.filter(f=>all.includes(f)),kb:collected[g]?.kbCount||0};
  }
  return out;
},collected);
console.log('canon:',JSON.stringify(canon));
for(const g of Object.keys(canon)){
  if(canon[g].expect.length) issues.push(`[${g}] 缺原著锚点:${canon[g].expect.join(',')}`);
  if(canon[g].forbid.length) issues.push(`[${g}] 仍有错误锚点:${canon[g].forbid.join(',')}`);
}

// 3. 地图自引用/越界复核
const mapcheck=await p.evaluate(()=>{
  let selfref=0,oob=0,total=0;
  const A=window.ATLAS_VERIFIED||{};
  for(const k of Object.keys(A)){
    for(const era of (A[k]?.eras||[])){
      for(const pl of (era.places||[])){
        total++;
        if(pl.rg===pl.n&&pl.n) selfref++;
        if(pl.x>100||pl.y>100||pl.x<0||pl.y<0) oob++;
      }
    }
  }
  return {total,selfref,oob};
});
console.log('mapcheck:',JSON.stringify(mapcheck));
if(mapcheck.selfref) issues.push('地图自引用:'+mapcheck.selfref);
if(mapcheck.oob) issues.push('坐标越界:'+mapcheck.oob);

// 4. 三世界创建配置字段完整
const cfgcheck=Object.fromEntries(Object.entries(collected).map(([g,v])=>[g,v.missing.length?v.missing:'OK']));
console.log('cfg:',JSON.stringify(cfgcheck));
for(const g of Object.keys(cfgcheck)){
  if(cfgcheck[g]==='MISSING') issues.push(`[${g}] config未暴露`);
  else if(Array.isArray(cfgcheck[g])&&cfgcheck[g].length) issues.push(`[${g}] 缺字段:${cfgcheck[g].join(',')}`);
}

await b.close();
console.log('\n=== 终轮问题:',issues.length,'===');
issues.forEach((x,i)=>console.log((i+1)+'.',x));
