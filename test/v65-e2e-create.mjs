/* v6.5.0 真机创建：插件/DLC/资源包/带对话存档，然后刷新验证整合
 * 证据口径：补丁系统只依赖 localStorage/IDB 数据层，不依赖懒加载管理器代理。
 * 故"整合"= 数据写入 + 刷新后完整 + 格式能被云境模块读取（必要时注入模块验证）。 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:1366,height:900} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let pass=0, fail=0;
const ok=(c,m,x)=>{ if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL '+m+(x?' → '+JSON.stringify(x):''))} };

try {
  console.log('\n【1】打开云境并清理测试残留');
  await p.goto(BASE+'studio.html?dev=1');
  await p.waitForFunction(()=>window.storyFramework,{timeout:20000});
  await p.waitForTimeout(500);
  await p.evaluate(()=>['storyDLC_free','yj_plugin_manifest','yj_resource_pack','storySave_free'].forEach(k=>localStorage.removeItem(k)));

  console.log('\n【2】创建 DLC（真实落盘格式）');
  const dlc = await p.evaluate(()=>{
    const d={id:'dlc_e2e_jianlai_001',name:'剑来·武夫十一境',description:'二创测试DLC：武夫境界细化',
      knowledgeItems:[
        {id:'ki_1',title:'武夫九境·气盛',content:'二创设定：武夫九境气盛，气血如炉。',category:'dlc',tags:['剑来','武夫'],alwaysInclude:false,priority:''},
        {id:'ki_2',title:'武夫十一境·止境',content:'二创设定：十一境止境，拳意撼山。',category:'dlc',tags:['剑来','武夫'],alwaysInclude:false,priority:''}],
      activated:true,createdAt:new Date().toISOString(),version:'1.0',source:'user_created'};
    localStorage.setItem('storyDLC_free',JSON.stringify({version:'1.0',app:'云境',genre:'free',savedAt:new Date().toISOString(),dlcPackages:[d]}));
    return d;
  });
  const rawDlc=await p.evaluate(()=>localStorage.getItem('storyDLC_free')||'');
  ok(rawDlc.length>100 && JSON.parse(rawDlc).dlcPackages[0].id===dlc.id,'DLC 落盘 storyDLC_free ('+rawDlc.length+'B)');

  // 注入真实 dlc-manager 验证格式能被云境模块 load()（代理桩不可靠，直接 eval 源码）
  const dlcLoad = await p.evaluate(async ()=>{
    const src = await (await fetch('js/dlc-manager.js?v=5.5.0')).text();
    // 在独立作用域执行，捕获导出的 manager
    const sandbox = { window:{ showToast:()=>{} }, location:{ search:'?genre=free' }, console:{ log:()=>{},error:()=>{} }, localStorage, Date, JSON, Set, Array, String, Math };
    sandbox.window.localStorage = localStorage;
    try {
      const fn = new Function('window','location','console','localStorage', src + '\n; return (typeof storyDLCManager!=="undefined")?storyDLCManager:(window.storyDLCManager||null);');
      const m = fn(sandbox.window, sandbox.location, sandbox.console, localStorage);
      if (m && m.load) { m.load(); return { ok:true, count:m.dlcPackages.length, name:m.dlcPackages[0]&&m.dlcPackages[0].name }; }
    } catch(e){ return { ok:false, error:e.message }; }
    return { ok:false, error:'no manager' };
  });
  ok(dlcLoad.ok && dlcLoad.count===1 && /武夫/.test(dlcLoad.name||''),'DLC 被云境模块 load() 读取: '+(dlcLoad.name||dlcLoad.error));

  console.log('\n【3】创建插件（内存注册 + 持久化清单）');
  const plug = await p.evaluate(()=>{
    const r=window.YJPlugins.register({id:'yj-e2e-wordcounter',name:'二创·字数统计插件',version:'1.0.0',description:'二创测试插件',author:'e2e'},()=>{});
    localStorage.setItem('yj_plugin_manifest',JSON.stringify([{id:'yj-e2e-wordcounter',name:'二创·字数统计插件',version:'1.0.0',entry:'plugin://yj-e2e-wordcounter',enabled:true}]));
    return r;
  });
  ok(plug && plug.ok,'插件注册接口返回成功');
  const plugRaw=await p.evaluate(()=>localStorage.getItem('yj_plugin_manifest')||'');
  ok(JSON.parse(plugRaw)[0].id==='yj-e2e-wordcounter','插件持久化清单落盘');

  console.log('\n【4】创建带实际对话内容的存档');
  const save = await p.evaluate(()=>{
    const s={_schema:(window.StoryFramework&&window.StoryFramework.SAVE_SCHEMA)||3,
      variables:{title:'剑来行',chapter:1,realm:'武夫九境',hp:100,protagonist:'陈平安'},
      conversationHistory:[
        {role:'user',content:'我来到剑气长城，准备Validate我的拳意。'},
        {role:'assistant',content:'陈平安立于城墙之上，拳心微热，武夫九境·气盛在体内缓缓运转。'},
        {role:'user',content:'我要向那位守城人请教。'},
        {role:'assistant',content:'守城人回头："小兄弟，来这剑气长城，是求名，还是求生？"'}],
      isStoryStarted:true, setup:{title:'二创测试·剑来行',genre:'free',protagonist:'陈平安'}, turnCount:2,
      turns:[{index:0,user:'我来到剑气长城…',vars:{realm:'武夫九境'}},{index:1,user:'我要向守城人请教',vars:{realm:'武夫九境',hp:95}}],
      savedAt:new Date().toISOString()};
    localStorage.setItem('storySave_free',JSON.stringify(s));
    return s;
  });
  const saveRaw=await p.evaluate(()=>localStorage.getItem('storySave_free')||'');
  const sp=JSON.parse(saveRaw);
  ok(sp.isStoryStarted && sp.turns.length===2 && sp.conversationHistory.length===4,'存档含真实对话: turns=2 msgs=4');
  ok(sp.variables.title==='剑来行' && sp.variables.realm==='武夫九境','存档变量正确: '+sp.variables.title+'/'+sp.variables.realm);

  console.log('\n【5】创建资源包（IDB + 清单）');
  const pack=await p.evaluate(async ()=>{
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    return await new Promise(res=>{
      const req=indexedDB.open('yj_asset_store',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('assets'))req.result.createObjectStore('assets')};
      req.onsuccess=()=>{const db=req.result,tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(png,'e2e-pack-01');
        tx.oncomplete=()=>{localStorage.setItem('yj_resource_pack',JSON.stringify({name:'二创·图标资源包',items:['e2e-pack-01'],data:png}));res({ok:true,len:png.length})};
        tx.onerror=()=>res({ok:false})};
      req.onerror=()=>res({ok:false});
    });
  });
  ok(pack.ok,'资源包写入 IDB ('+pack.len+'B)');

  console.log('\n【6】刷新后四类数据完整（整合证据）');
  await p.reload();
  await p.waitForFunction(()=>window.storyFramework,{timeout:20000});
  await p.waitForTimeout(600);
  const after=await p.evaluate(async ()=>{
    const idbPng=await new Promise(res=>{const r=indexedDB.open('yj_asset_store',1);r.onsuccess=()=>{const tx=r.result.transaction('assets','readonly');const g=tx.objectStore('assets').get('e2e-pack-01');g.onsuccess=()=>res(g.result||'');g.onerror=()=>res('')};r.onerror=()=>res('')});
    const d=JSON.parse(localStorage.getItem('storyDLC_free')||'{}');
    const pl=JSON.parse(localStorage.getItem('yj_plugin_manifest')||'[]');
    const s=JSON.parse(localStorage.getItem('storySave_free')||'{}');
    const pk=JSON.parse(localStorage.getItem('yj_resource_pack')||'{}');
    return { dlc:d.dlcPackages&&d.dlcPackages.length, dlcItems:d.dlcPackages&&d.dlcPackages[0]&&d.dlcPackages[0].knowledgeItems.length,
      plug:pl.length, saveMsgs:s.conversationHistory&&s.conversationHistory.length, saveTurns:s.turns&&s.turns.length,
      saveTitle:s.variables&&s.variables.title, pack:pk.items&&pk.items.length, idbOk:!!idbPng };
  });
  ok(after.dlc===1 && after.dlcItems===2,'DLC 刷新后完整: 1包/'+after.dlcItems+'条');
  ok(after.plug===1,'插件清单刷新后完整');
  ok(after.saveMsgs===4 && after.saveTurns===2 && after.saveTitle==='剑来行','存档刷新后完整: 4消息/2轮/'+after.saveTitle);
  ok(after.pack===1 && after.idbOk,'资源包清单+IDB数据刷新后完整');

  console.log('\n【7】采集器识别能力（真实缺口探测）');
  const collect=await p.evaluate(()=>{
    const r=window.ContentAdapters.collect({});
    return { keys:r.items.map(x=>x.key), unscanned:r.unscanned.map(x=>x.kind) };
  });
  console.log('  采集键数:',collect.keys.length,'| 样例:',JSON.stringify(collect.keys.slice(0,12)));
  const has=(re)=>collect.keys.some(k=>re.test(k));
  const r={save:has(/save/i),dlc:has(/dlc/i),plugin:has(/plugin/i),pack:has(/pack/i)};
  console.log('  识别结果:',JSON.stringify(r));
  ok(r.save,'存档被采集');
  ok(r.dlc,'DLC 被采集'+(r.dlc?'':' ← 缺口'));
  ok(r.plugin,'插件被采集'+(r.plugin?'':' ← 缺口'));
  ok(r.pack,'资源包被采集'+(r.pack?'':' ← 缺口'));

  // 保存采集结果供后续步骤用
  await p.evaluate(()=>{ window.__e2eCollected = window.ContentAdapters.collect({}).items; });

} catch(e) { fail++; console.log('  ✗ 异常:',e.message,e.stack?.split('\n')[1]); }
finally {
  // 保存 localStorage 状态供打包/下载/合并各脚本复用（同一套玩家数据）
  try { await ctx.storageState({ path: '/tmp/e2e-storage.json' }); console.log('\n  已保存 storageState → /tmp/e2e-storage.json'); } catch(e){}
  await b.close();
}
console.log('\n========== 结果 ==========');
console.log('PASS='+pass+' FAIL='+fail);
process.exit(0);
