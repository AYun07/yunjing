/* v6.5.0 真机打包：用 PatchEngine 对四类内容生成增量补丁 zip，导出 base64 到本地文件 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:1366,height:900}, storageState: '/tmp/e2e-storage.json' });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let pass=0, fail=0;
const ok=(c,m,x)=>{ if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL '+m+(x?' → '+JSON.stringify(x):''))} };

try {
  console.log('\n【1】打开云境（沿用已创建的四类内容数据）');
  await p.goto(BASE+'studio.html?dev=1');
  await p.waitForFunction(()=>window.PatchEngine && window.ContentAdapters && window.ZipWriter,{timeout:20000});
  await p.waitForTimeout(500);

  console.log('\n【2】用 ContentAdapters 采集 + PatchEngine.diff 算改动（空基线→全为add）');
  const built = await p.evaluate(async ()=>{
    const PE=window.PatchEngine, CA=window.ContentAdapters, ZW=window.ZipWriter;
    const collected=CA.collect({});
    const items=collected.items;
    // 基线为空 → 所有项视为 add（首次发布）
    const changes=items.map(it=>({op:'add',key:it.key,kind:it.kind,baseHash:'',newHash:it.hash}));
    const map={}; items.forEach(it=>map[it.key]=it);
    const entries=[];
    const mfChanges=changes.map((c,i)=>{
      const fn='content/'+i+'.json';
      const data=c.op==='delete'?PE.TOMB:(map[c.key]||{}).data||'';
      entries.push({name:fn,data:JSON.stringify({key:c.key,kind:c.kind,data})});
      return {op:c.op,key:c.key,kind:c.kind,baseHash:c.baseHash,newHash:c.newHash,file:fn};
    });
    const manifest={app:'yunjing-patch',schema:2,title:'二创实测·剑来武夫增强包',
      note:'真机实测：含DLC/插件/资源包/带对话存档',baseVersion:window.YJ_VER,
      author:'AYun07(e2e)',createdAt:new Date().toISOString(),license:'开源·非盈利',
      changes:mfChanges,volumes:1,containsSave:true,stripKeys:true,unscanned:collected.unscanned};
    entries.unshift({name:'manifest.json',data:JSON.stringify(manifest,null,2)});
    const zip=await ZW.makeZip(entries);
    // zip -> base64
    let bin=''; for(let i=0;i<zip.length;i+=0x8000) bin+=String.fromCharCode.apply(null,zip.subarray(i,i+0x8000));
    const b64=btoa(bin);
    return { b64, count:changes.length, kinds:mfChanges.map(c=>c.kind), manifestLen:JSON.stringify(manifest).length };
  });
  console.log('  改动项:',built.count,'| 类型:',JSON.stringify(built.kinds));
  ok(built.count>=4,'补丁含至少4项改动 (got '+built.count+')');
  ok(['dlc','plugin','save','pack'].every(k=>built.kinds.includes(k)),'四类内容都在补丁内');

  // 导出 base64 与 manifest 到临时文件供上传
  writeFileSync('/tmp/e2e-patch.zip.b64', built.b64);
  ok(built.b64.length>500,'补丁 base64 导出成功 ('+built.b64.length+' 字符)');

  // 同时把"本地基线"写入，供后续第二版比对（导出到文件）
  const baseline = await p.evaluate(()=>{
    const CA=window.ContentAdapters, PE=window.PatchEngine;
    const items=CA.collect({}).items;
    return PE.baseline(window.YJ_VER, items);
  });
  writeFileSync('/tmp/e2e-baseline.json', JSON.stringify(baseline));
  console.log('  基线项数:',baseline.items.length);

} catch(e) { fail++; console.log('  ✗ 异常:',e.message,e.stack?.split('\n')[1]); }
finally { await b.close(); }
console.log('\n========== 结果 ==========');
console.log('PASS='+pass+' FAIL='+fail);
process.exit(fail?1:0);
