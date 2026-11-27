import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8791';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const issues = []; // 本轮发现的真实问题
const notes = [];

function newCtx() {
  return browser.newContext({ viewport: { width: 1366, height: 900 } }).then(async ctx => {
    await ctx.addInitScript(() => {
      // 模拟云境桌面壳，禁用 SW 保证读源码最新文件
      window.YunJingDesktop = {
        isDesktop: true,
        getInfo: () => Promise.resolve({ version: '7.5.0' }),
        getSyncStatus: () => Promise.resolve({ version: '7.5.0', lastSync: Date.now(), state: 'idle' }),
        checkUpdate: () => Promise.resolve({ ok: true, hasUpdate: false }),
        minimizeWindow(){}, maximizeWindow(){}, closeWindow(){},
        isMaximized: () => Promise.resolve(false), syncNow: () => Promise.resolve({ ok: true, downloaded: 0 })
      };
      if ('serviceWorker' in navigator) { /* 不注册，避免缓存旧代码 */ }
    });
    return ctx;
  });
}

// ---- 1. 圣堂世界加载 ----
{
  const ctx = await newCtx(); const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERROR:'+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE:'+m.text().slice(0,160)); });
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2200);
  // atlas-verified-all 是 lazy demand 组，主动等待其就绪
  await page.waitForFunction(()=>!!(window.ATLAS_VERIFIED&&window.ATLAS_VERIFIED['shengtang']),null,{timeout:8000}).catch(()=>{});
  const cfg = await page.evaluate(()=>({
    key: window.GenreStoryConfig && window.GenreStoryConfig.genreKey,
    name: window.GenreStoryConfig && window.GenreStoryConfig.genreName,
    title: document.getElementById('gameTitle')?.textContent||'',
    atlas: !!(window.ATLAS_VERIFIED && window.ATLAS_VERIFIED['shengtang']),
    places: window.ATLAS_VERIFIED?.['shengtang']?.eras?.[0]?.places?.length||0,
    kb: (window.KB_PRESETS?.['shengtang']||[]).length
  }));
  if(cfg.key!=='shengtang'||cfg.name!=='圣堂') issues.push('圣堂 config 未加载: '+JSON.stringify(cfg));
  if(!cfg.atlas||cfg.places<15) issues.push('圣堂 atlas 地点不足15: '+cfg.places);
  if(cfg.kb<10) issues.push('圣堂 KB 条目不足: '+cfg.kb);
  if(errs.length) issues.push('圣堂页脚本错误: '+errs.join(' | '));
  notes.push('圣堂: '+JSON.stringify(cfg)+' errs='+errs.length);
  await ctx.close();
}

// ---- 2. 网游补两书 ----
{
  const ctx=await newCtx(); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(BASE+'/studio.html?genre=wangyou',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2200);
  await page.waitForFunction(()=>!!(window.ATLAS_VERIFIED&&window.ATLAS_VERIFIED['wangyou']),null,{timeout:8000}).catch(()=>{});
  const wy=await page.evaluate(()=>{
    const kb=(window.KB_PRESETS?.['wangyou']||[]).map(x=>x.title||'').join('|');
    const at=JSON.stringify(window.ATLAS_VERIFIED?.['wangyou']||{});
    return {jg:kb.includes('近战法师'), ml:kb.includes('猛龙过江'), atJG:at.includes('近战法师'), atML:at.includes('猛龙过江')};
  });
  if(!wy.jg||!wy.ml||!wy.atJG||!wy.atML) issues.push('网游补书缺失: '+JSON.stringify(wy));
  if(errs.length) issues.push('网游页脚本错误: '+errs.join('|'));
  notes.push('网游补书: '+JSON.stringify(wy));
  await ctx.close();
}

// ---- 3. C批：左栏去重/境界梯/酒馆卡/性格世界书 ----
{
  const ctx=await newCtx(); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  const c=await page.evaluate(()=>{
    // C8 酒馆卡导出方法存在
    const card=typeof window.ConfigModal?.exportTavernCard==='function';
    // C10 预设含身份/立场
    const yq=JSON.stringify(window.YUNQI_PRESET||{});
    return { card, yqIdentity:yq.includes('yq-identity'), yqStance:yq.includes('yq-stance') };
  });
  if(!c.card) issues.push('C8 酒馆卡导出方法不存在');
  if(!c.yqIdentity||!c.yqStance) issues.push('C10 云起预设缺身份/立场块: '+JSON.stringify(c));
  notes.push('C批: '+JSON.stringify(c));
  await ctx.close();
}

// ---- 4. C9 性格世界书跟随当前世界 ----
{
  const ctx=await newCtx(); const page=await ctx.newPage();
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{ try{PersonalityCodexUI.open();}catch(e){} });
  await page.waitForTimeout(600);
  const sel=await page.evaluate(()=>document.querySelector('.codex-world')?.value||'');
  if(sel && sel!=='shengtang') issues.push('C9 性格世界书未跟随当前世界: '+sel+'(应为 shengtang)');
  notes.push('C9 性格世界书当前世界: '+sel);
  await ctx.close();
}

// ---- 5. 二创加载（离线兜底）----
{
  const ctx=await newCtx(); const page=await ctx.newPage();
  await ctx.route('**/api.github.com/**', r=>r.abort());
  await ctx.route('**/ghproxy.net/**', r=>r.abort());
  await ctx.route('**/gh-proxy.com/**', r=>r.abort());
  await page.goto(BASE+'/studio.html?genre=shengtang',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>!!window.CreationHub,null,{timeout:8000}).catch(()=>{});
  // 真实打开创意工坊
  await page.evaluate(()=>{ try{window.CreationHub.open(document.body);}catch(e){window.__chErr=e.message;} });
  await page.waitForTimeout(16000); // 等 14s 超时 + 兜底
  const ch=await page.evaluate(()=>{
    const box=document.getElementById('ch-list');
    return { err: window.__chErr||'', text: (box?.textContent||'').slice(0,100) };
  });
  if(ch.err) issues.push('二创 open 抛错: '+ch.err);
  if(ch.text.includes('加载失败')) issues.push('二创离线仍显示加载失败: '+ch.text);
  notes.push('二创离线: '+JSON.stringify(ch));
  await ctx.close();
}

// ---- 6. 全站遍历找脚本/点击错误 ----
const PAGES=['/opening.html','/index.html','/settings.html','/xiaoyun.html','/studio.html?genre=shengtang','/studio.html?genre=fanrenxiuxian','/studio.html?genre=wangyou','/studio.html?genre=free','/selftest.html','/map-preview.html'];
for(const p of PAGES){
  const ctx=await newCtx(); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERROR:'+e.message));
  page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE:'+m.text().slice(0,140));});
  await page.goto(BASE+p,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  // 真实鼠标点击可见按钮（跳过危险/导航）
  const btns=await page.locator('button:visible').all(); let clicked=0;
  for(const b of btns.slice(0,30)){
    try{ const oc=await b.getAttribute('onclick')||'';
      if(/location|href|clear|delete|remove|quit|close\(\)|confirm/.test(oc))continue;
      await b.click({timeout:300,force:true}).then(()=>clicked++).catch(()=>{});
      await page.waitForTimeout(30);
    }catch(_){}
  }
  if(errs.length) issues.push('页面 '+p+' 错误('+clicked+'点击): '+errs.slice(0,3).join(' | '));
  notes.push('页面 '+p+' 按钮'+btns.length+'点击'+clicked+'错误'+errs.length);
  await ctx.close();
}

await browser.close();
console.log('===== 实测备注 ====='); notes.forEach(n=>console.log(' - '+n));
console.log('\n===== 发现的真实问题 ('+issues.length+') ====='); issues.forEach((x,i)=>console.log((i+1)+'. '+x));
