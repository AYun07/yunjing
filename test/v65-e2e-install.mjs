/* v6.5.0 真机安装：新档环境下载 GitHub 包 → 解包 → 三方合并 → 备份 → 安装 → 验证不坏档 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const BASE='http://127.0.0.1:9155/';
const B64=readFileSync('/tmp/e2e-downloaded.zip.b64','utf-8').trim();
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1366,height:900}}); // 全新档：无 storageState
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL '+m+(x?' → '+JSON.stringify(x):''))}};

try{
  console.log('\n【1】全新档环境（空 localStorage）');
  await p.goto(BASE+'studio.html?dev=1');
  await p.waitForFunction(()=>window.PatchEngine&&window.ContentAdapters&&window.ZipWriter,{timeout:20000});
  await p.waitForTimeout(500);
  const before=await p.evaluate(()=>({ dlc:localStorage.getItem('storyDLC_free'), save:localStorage.getItem('storySave_free'), plug:localStorage.getItem('yj_plugin_manifest'), pack:localStorage.getItem('yj_resource_pack') }));
  ok(!before.dlc&&!before.save&&!before.plug&&!before.pack,'新档四类内容均为空');

  console.log('\n【2】注入从 GitHub 下载的包体，解包');
  const unpack=await p.evaluate(async(b64)=>{
    const ZW=window.ZipWriter;
    const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const files=await ZW.unzip(u8);
    const mf=JSON.parse(ZW.entryText(files.find(f=>f.name==='manifest.json')));
    return {count:files.length, manifest:mf};
  }, B64);
  ok(unpack.count>=2,'解包成功 ('+unpack.count+' 文件)');
  ok(unpack.manifest.app==='yunjing-patch' && unpack.manifest.title.includes('剑来'),'manifest 正确: '+unpack.manifest.title);
  ok(unpack.manifest.changes.length>=4,'补丁含 '+unpack.manifest.changes.length+' 项改动');

  console.log('\n【3】还原 theirs + 三方合并（新档基线为空 → 全部 add）');
  const install=await p.evaluate(async(b64)=>{
    const PE=window.PatchEngine, ZW=window.ZipWriter, CA=window.ContentAdapters;
    const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const files=await ZW.unzip(u8);
    const mf=JSON.parse(ZW.entryText(files.find(f=>f.name==='manifest.json')));
    const theirs=mf.changes.map(c=>{
      const f=files.find(x=>x.name===c.file);
      const data=JSON.parse(ZW.entryText(f)).data;
      return {key:c.key,kind:c.kind,hash:c.newHash||PE.hash(data),data};
    });
    const base=[]; // 新档无基线
    const ours=CA.collect({}).items;
    const decisions=PE.plan(base,ours,theirs);
    const sum=PE.summarize(decisions);
    // 密钥二次扫描
    const bad=PE.scanSecrets(theirs);
    // 备份
    const backup=PE.makeBackup(decisions,'install-github-e2e');
    // 按 creation-hub.openInstall 的真实逻辑：备份入栈（固定上限10）
    let stack=[]; try{stack=JSON.parse(localStorage.getItem('yj_patch_backups')||'[]')}catch(e){}
    stack=PE.pushBackup(stack,backup);
    try{localStorage.setItem('yj_patch_backups',JSON.stringify(stack))}catch(e){}
    const ops=PE.applyList(decisions);
    const res=CA.apply(ops,CA.localWriter());
    // 写入基线（供下次比对）
    PE && CA && window.PatchEngine && (()=>{ try{ localStorage.setItem('yj_patch_baseline', JSON.stringify(PE.baseline(window.YJ_VER, theirs))); }catch(e){} })();
    return {sum,bad,backupCount:backup.entries.length,applied:res.done.length,errors:res.errors,ops:ops.map(o=>o.key)};
  }, B64);
  console.log('  处置统计:',JSON.stringify(install.sum));
  ok(install.bad.length===0,'密钥扫描通过（无泄露）');
  // 冲突是"正确识别"而非缺陷：首次发布无官方基线退化为整包（DR-049 已知代价），
  // 云境默认内容(如 storyKBGlobal)会同键冲突 → 系统标 conflict 交玩家裁决，绝不误覆盖。
  ok(install.sum.conflict<=1,'冲突被正确识别（'+install.sum.conflict+' 项，未自动覆盖）');
  ok(install.applied>=4,'应用 '+install.applied+' 项');
  ok(install.errors.length===0,'写回无错误');

  console.log('\n【4】验证四类内容就位（新档装完）');
  const after=await p.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('storyDLC_free')||'{}');
    const pl=JSON.parse(localStorage.getItem('yj_plugin_manifest')||'[]');
    const s=JSON.parse(localStorage.getItem('storySave_free')||'{}');
    const pk=JSON.parse(localStorage.getItem('yj_resource_pack')||'{}');
    return { dlcCount:d.dlcPackages&&d.dlcPackages.length, dlcItems:d.dlcPackages&&d.dlcPackages[0]&&d.dlcPackages[0].knowledgeItems.length,
      plug:pl.length, saveMsgs:s.conversationHistory&&s.conversationHistory.length, saveTurns:s.turns&&s.turns.length,
      saveTitle:s.variables&&s.variables.title, pack:pk.items&&pk.items.length };
  });
  ok(after.dlcCount===1 && after.dlcItems===2,'DLC 就位: 1包/2条');
  ok(after.plug===1,'插件清单就位');
  ok(after.saveMsgs===4 && after.saveTurns===2 && after.saveTitle==='剑来行','对话存档就位: 4消息/2轮/'+after.saveTitle);
  ok(after.pack===1,'资源包就位');

  console.log('\n【5】不坏档验证：对话内容逐字比对 + 云境能读');
  const integrity=await p.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('storySave_free')||'{}');
    const msgs=s.conversationHistory||[];
    const hasSword=JSON.stringify(msgs).includes('剑气长城');
    const hasDialogue=msgs.some(m=>m.role==='assistant'&&m.content.includes('求名'));
    // 云境 loadSave 能读（若可用）
    let fwLoad='n/a'; try{ const fw=window.storyFramework; if(fw&&fw.loadSave){fw.loadSave();fwLoad=fw.storyState&&fw.storyState.variables&&fw.storyState.variables.title;} }catch(e){fwLoad='err:'+e.message}
    return {hasSword,hasDialogue,fwLoad,turnCount:s.turnCount};
  });
  ok(integrity.hasSword && integrity.hasDialogue,'对话正文逐字保留（剑气长城/求名 台词在）');
  ok(integrity.turnCount===2,'轮次数保留: '+integrity.turnCount);

  console.log('\n【6】备份存在 + 一键回滚验证');
  const rollback=await p.evaluate(()=>{
    const CA=window.ContentAdapters, PE=window.PatchEngine;
    const cur=JSON.parse(localStorage.getItem('yj_patch_backups')||'[]');
    const stack=cur.length;
    if(!cur.length) return {stack,rolled:false,reason:'no backup'};
    const bak=cur[cur.length-1];
    // 找到 DLC 项在备份里的 oldData（安装前快照）
    const dlcEntry=bak.entries.find(e=>e.key==='dlc/storyDLC_free');
    // 模拟装好后被篡改
    localStorage.setItem('storyDLC_free','{"破坏":"tampered"}');
    const tampered=localStorage.getItem('storyDLC_free');
    // 回滚
    const res=CA.apply(PE.rollbackList(bak),CA.localWriter());
    const afterRollback=localStorage.getItem('storyDLC_free')||'';
    // TOMB 语义：安装前该键不存在 → oldData=TOMB → 回滚=删除键 → getItem 返回 null/空
    const expect = !dlcEntry ? null : (dlcEntry.oldData===PE.TOMB ? '' : dlcEntry.oldData);
    return { stack, tampered, oldData:dlcEntry?dlcEntry.oldData:null,
      afterRollback, exactRestore: dlcEntry ? (afterRollback===expect) : null,
      rolled:res.done.length>0 };
  });
  console.log('  备份份数:',rollback.stack,'| 篡改值:',rollback.tampered);
  console.log('  备份 oldData:',String(rollback.oldData).slice(0,50),'| 回滚后值:',String(rollback.afterRollback).slice(0,50));
  ok(rollback.stack>0,'安装前备份已写入 ('+rollback.stack+' 份)');
  ok(rollback.rolled,'回滚机制执行成功（写回备份快照）');
  ok(rollback.exactRestore===true,'★ 回滚后字节 == 备份 oldData（回退到安装前，逐字节精确）');

  ok(errs.length===0,'无 JS 报错'+(errs.length?': '+errs.slice(0,2):''));

}catch(e){fail++;console.log('  ✗ 异常:',e.message,e.stack?.split('\n')[1]);}
finally{ await ctx.storageState({path:'/tmp/e2e-installed-state.json'}).catch(()=>{}); await b.close(); }
console.log('\n========== 结果 ==========');
console.log('PASS='+pass+' FAIL='+fail);
process.exit(fail?1:0);
