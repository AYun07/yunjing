import { chromium } from '/workspace/yunjing/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8791';
const problems=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});

function attach(page,tag){
  page.on('pageerror',e=>problems.push(`[${tag}] PAGEERROR: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error') problems.push(`[${tag}] CONSOLE: ${m.text().slice(0,120)}`);});
  page.on('requestfailed',r=>{const u=r.url();const e=r.failure()?.errorText||'';if(!/favicon|data:/.test(u)&&e!=='net::ERR_ABORTED') problems.push(`[${tag}] REQFAIL: ${u.split('/').pop()} ${e}`);});
}

// 1. 三世界 config + atlas + KB 加载
for (const g of ['shengtang','jinzhanfashi','menglongguojiang']) {
  const ctx=await b.newContext({viewport:{width:1366,height:900}});
  await ctx.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false})};});
  const p=await ctx.newPage(); attach(p,g);
  await p.goto(`${BASE}/studio.html?genre=${g}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1800);
  await p.evaluate(async()=>{await new Promise((res)=>{const s=document.createElement('script');s.src='js/atlas-verified-all.js';s.onload=res;s.onerror=res;document.head.appendChild(s);});});
  await p.waitForTimeout(300);
  const r=await p.evaluate(()=>({
    cfgKey: window.storyFramework?.config?.genreKey||window.GenreStoryConfig?.genreKey||'none',
    genre: window.storyFramework?.genre||'none',
    theme: document.body.className,
    kbCount: (()=>{try{return (window.KB_PRESETS?.[window.storyFramework?.genre]||[]).length}catch(e){return -1}})(),
    atlasCount: (()=>{try{const a=window.ATLAS_VERIFIED?.[window.storyFramework?.genre];return a?.eras?.[0]?.places?.length||0}catch(e){return -1}})(),
    title: document.getElementById('gameTitle')?.textContent||''
  }));
  console.log(g,JSON.stringify(r));
  if(r.cfgKey!==g) problems.push(`[${g}] config未加载: cfgKey=${r.cfgKey}`);
  if(r.kbCount<10) problems.push(`[${g}] KB条目过少: ${r.kbCount}`);
  if(r.atlasCount<10) problems.push(`[${g}] atlas地点过少: ${r.atlasCount}`);
  await ctx.close();
}

// 2. 圣堂原著正名校验
{
  const ctx=await b.newContext(); const p=await ctx.newPage(); attach(p,'shengtang-canon');
  await p.goto(`${BASE}/studio.html?genre=shengtang`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1500);
  await p.evaluate(async()=>{await new Promise((res)=>{const s=document.createElement('script');s.src='js/atlas-verified-all.js';s.onload=res;s.onerror=res;document.head.appendChild(s);});});
  await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{
    const kb=window.KB_PRESETS?.shengtang||[];
    const titles=kb.map(x=>x.title||x.t).join('|');
    const atlas=window.ATLAS_VERIFIED?.shengtang?.eras?.[0]?.places||[];
    const names=atlas.map(x=>x.n||x.name).join('|');
    return {
      hasWangMing: titles.includes('王猛'), hasMingHen: titles.includes('命痕'),
      hasQinYang: titles.includes('主角秦阳')||titles.includes('秦阳为《圣堂》'), hasTangJia: titles.includes('唐家三少著'),
      atlasHasLeiguang: names.includes('雷光城'), atlasHasTianmeng: names.includes('天蒙'),
      atlasHasFeifeng: names.includes('飞凤堂')
    };
  });
  console.log('shengtang-canon',JSON.stringify(r));
  if(!r.hasWangMing||!r.hasMingHen) problems.push('[圣堂正名] 缺王猛/命痕锚点');
  if(r.hasQinYang||r.hasTangJia) problems.push('[圣堂正名] 仍有错误锚点秦阳/唐家三少');
  if(!r.atlasHasLeiguang||!r.atlasHasFeifeng) problems.push('[圣堂地图] 缺雷光城/飞凤堂');
  if(r.atlasHasTianmeng) problems.push('[圣堂地图] 仍有错误地点天蒙位面');
  await ctx.close();
}

// 3. 大厅卡片数量与白名单一致
{
  const ctx=await b.newContext(); const p=await ctx.newPage(); attach(p,'index');
  await p.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>({
    cards: document.querySelectorAll('.workshop').length,
    title: document.querySelector('.section-title')?.textContent||'',
    wangyouGroup: document.querySelector('[data-gkey="grp-wangyou"] .wg-count')?.textContent||'',
    hasJZ: document.body.innerHTML.includes('近战法师'),
    hasML: document.body.innerHTML.includes('猛龙过江')
  }));
  console.log('index',JSON.stringify(r));
  if(!r.hasJZ||!r.hasML) problems.push('[大厅] 缺近战法师/猛龙过江卡片');
  await ctx.close();
}

// 4. 全站错误扫描
const pages=['index.html','opening.html','settings.html?goto=settings','studio.html?genre=free','map-preview.html','map-verified.html','xiaoyun.html','changelog/index.html'];
for(const pg of pages){
  const ctx=await b.newContext();
  await ctx.addInitScript(()=>{window.YunJingDesktop={isDesktop:true,getInfo:()=>Promise.resolve({version:'7.4.1'}),checkUpdate:()=>Promise.resolve({ok:true,hasUpdate:false})};});
  const p=await ctx.newPage(); attach(p,pg.split('?')[0]);
  await p.goto(`${BASE}/${pg}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await p.waitForTimeout(900);
  await ctx.close();
}

await b.close();
console.log('\n=== 发现问题数:',problems.length,'===');
problems.slice(0,40).forEach((x,i)=>console.log((i+1)+'.',x));
