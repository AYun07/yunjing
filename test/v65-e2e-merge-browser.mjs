/* v6.5.0 浏览器真机：已装第一版的档 → 装第二版 → 三方合并落位 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const BASE='http://127.0.0.1:9155/';
const V1_B64=readFileSync('/tmp/e2e-downloaded.zip.b64','utf-8').trim();
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1366,height:900}});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL '+m+(x?' → '+JSON.stringify(x):''))}};
try{
  console.log('\n【1】从 GitHub 包装上第一版（建立基线）');
  await p.goto(BASE+'studio.html?dev=1');
  await p.waitForFunction(()=>window.PatchEngine&&window.ContentAdapters&&window.ZipWriter,{timeout:20000});
  await p.waitForTimeout(500);
  await p.evaluate(async(b64)=>{
    const PE=window.PatchEngine,ZW=window.ZipWriter,CA=window.ContentAdapters;
    const bin=atob(b64);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const files=await ZW.unzip(u8);const mf=JSON.parse(ZW.entryText(files.find(f=>f.name==='manifest.json')));
    const theirs=mf.changes.map(c=>{const f=files.find(x=>x.name===c.file);const data=JSON.parse(ZW.entryText(f)).data;return{key:c.key,kind:c.kind,hash:c.newHash,data}});
    const decisions=PE.plan([],CA.collect({}).items,theirs);
    CA.apply(PE.applyList(decisions),CA.localWriter());
    localStorage.setItem('yj_patch_baseline',JSON.stringify(PE.baseline(window.YJ_VER,theirs)));
  }, V1_B64);
  const b0=await p.evaluate(()=>({hasBaseline:!!localStorage.getItem('yj_patch_baseline'),dlc:!!localStorage.getItem('storyDLC_free'),save:!!localStorage.getItem('storySave_free')}));
  ok(b0.hasBaseline&&b0.dlc&&b0.save,'第一版内容+基线都在');

  console.log('\n【2】在浏览器里构造第二版补丁（DLC改、存档改、新内容）');
  const built=await p.evaluate(async()=>{
    const PE=window.PatchEngine,ZW=window.ZipWriter;
    const base=JSON.parse(localStorage.getItem('yj_patch_baseline')||'{}');
    const baseMap={}; (base.items||[]).forEach(it=>baseMap[it.key]=it);
    // 第二版作者：改 DLC（加条目）、改存档（推进章节）、新增一个预设
    const dlc=JSON.parse(localStorage.getItem('storyDLC_free')||'{}');
    dlc.dlcPackages[0].knowledgeItems.push({id:'ki_3',title:'十二境·宗师',content:'第二版新增',category:'dlc',tags:['剑来'],alwaysInclude:false,priority:''});
    const save=JSON.parse(localStorage.getItem('storySave_free')||'{}');
    save.chapter=2; save.variables.chapter=2;
    save.conversationHistory.push({role:'assistant',content:'第二版新增：城墙上的风更冷了。'});
    const changesData=[
      {key:'dlc/storyDLC_free',kind:'dlc',data:JSON.stringify(dlc)},
      {key:'save/storySave_free',kind:'save',data:JSON.stringify(save)},
      {key:'preset/第二版新预设',kind:'preset',data:JSON.stringify({name:'剑来·新版文风'})}
    ];
    const entries=[],mfChanges=[];
    changesData.forEach((c,i)=>{
      const fn='content/'+i+'.json';
      entries.push({name:fn,data:JSON.stringify({key:c.key,kind:c.kind,data:c.data})});
      mfChanges.push({op:baseMap[c.key]?'modify':'add',key:c.key,kind:c.kind,baseHash:baseMap[c.key]?baseMap[c.key].hash:'',newHash:PE.hash(c.data),file:fn});
    });
    const manifest={app:'yunjing-patch',schema:2,title:'第二版·剑来增强',baseVersion:window.YJ_VER,changes:mfChanges,volumes:1,containsSave:true,stripKeys:true};
    entries.unshift({name:'manifest.json',data:JSON.stringify(manifest)});
    const zip=await ZW.makeZip(entries);
    let bin=''; for(let i=0;i<zip.length;i+=0x8000)bin+=String.fromCharCode.apply(null,zip.subarray(i,i+0x8000));
    return {b64:btoa(bin),count:mfChanges.length};
  });
  ok(built.count===3,'第二版含3项改动');

  console.log('\n【3】装第二版：解包→三方合并→备份→应用');
  const inst=await p.evaluate(async(b64)=>{
    const PE=window.PatchEngine,ZW=window.ZipWriter,CA=window.ContentAdapters;
    const bin=atob(b64);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    const files=await ZW.unzip(u8);const mf=JSON.parse(ZW.entryText(files.find(f=>f.name==='manifest.json')));
    const theirs=mf.changes.map(c=>{const f=files.find(x=>x.name===c.file);const data=JSON.parse(ZW.entryText(f)).data;return{key:c.key,kind:c.kind,hash:c.newHash,data}});
    const base=JSON.parse(localStorage.getItem('yj_patch_baseline')||'{}').items||[];
    const ours=CA.collect({}).items;
    const decisions=PE.plan(base,ours,theirs);
    const sum=PE.summarize(decisions);
    const backup=PE.makeBackup(decisions,'v2-install');
    let stack=[];try{stack=JSON.parse(localStorage.getItem('yj_patch_backups')||'[]')}catch(e){}
    stack=PE.pushBackup(stack,backup);try{localStorage.setItem('yj_patch_backups',JSON.stringify(stack))}catch(e){}
    const ops=PE.applyList(decisions);const res=CA.apply(ops,CA.localWriter());
    // 更新基线
    try{localStorage.setItem('yj_patch_baseline',JSON.stringify(PE.baseline(window.YJ_VER,theirs)))}catch(e){}
    const acts={};decisions.forEach(d=>acts[d.key]=d.action);
    return {sum,acts,applied:res.done.length,errors:res.errors};
  },built.b64);
  console.log('  处置:',JSON.stringify(inst.sum));
  ok(inst.errors.length===0,'写回无错误');
  ok(inst.acts['preset/第二版新预设']==='overwrite','新增预设被安装(overwrite)');

  console.log('\n【4】验证第二版落位 + 存档不坏');
  const after=await p.evaluate(()=>{
    const dlc=JSON.parse(localStorage.getItem('storyDLC_free')||'{}');
    const save=JSON.parse(localStorage.getItem('storySave_free')||'{}');
    const pre=JSON.parse(localStorage.getItem('第二版新预设')||'null');
    return {dlcItems:dlc.dlcPackages&&dlc.dlcPackages[0]&&dlc.dlcPackages[0].knowledgeItems.length,
      chapter:save.variables&&save.variables.chapter,msgs:save.conversationHistory&&save.conversationHistory.length,
      newLine:JSON.stringify(save.conversationHistory||'').includes('第二版新增'), preset:!!pre};
  });
  ok(after.dlcItems===3,'DLC 第二版条目就位(3条)');
  ok(after.chapter===2 && after.msgs===5,'存档推进到第2章/5条消息');
  ok(after.newLine,'第二版对话行保留');
  ok(after.preset,'新增预设就位');
  ok(errs.length===0,'无 JS 报错'+(errs.length?': '+errs.slice(0,2):''));

}catch(e){fail++;console.log('  ✗ 异常:',e.message,e.stack?.split('\n')[1]);}
finally{await b.close();}
console.log('\n========== 结果 ==========');
console.log('PASS='+pass+' FAIL='+fail);
process.exit(fail?1:0);
