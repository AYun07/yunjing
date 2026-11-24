/* v6.5.0 增量补丁端到端：发布→打包→解包→三方合并→安装→回滚 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PE = require('../js/patch-engine.js');
const CA = require('../js/content-adapters.js');
const ZW = require('../js/zip-writer.js');

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + (x ? ' → ' + JSON.stringify(x) : ''))); };

(async () => {
  console.log('\n[E2E-1] 发布方：基线 → 采集 → 只打改动');
  // 基线：3 项
  const baseline = [PE.item('preset/a','preset','v1'), PE.item('dlc/b','dlc','v1'), PE.item('worldbook/c','worldbook','v1')];
  // 发布方现状：改了 a，删了 c，新增 d
  const authorItems = [PE.item('preset/a','preset','v2'), PE.item('dlc/b','dlc','v1'), PE.item('content/d','content','new')];
  const changes = PE.diff(baseline, authorItems);
  ok('只识别3项改动', changes.length === 3, changes);
  ok('含 modify a / delete c / add d', JSON.stringify(changes.map(x=>x.op+':'+x.key).sort()) === JSON.stringify(['add:content/d','delete:worldbook/c','modify:preset/a']));

  console.log('\n[E2E-2] 打包成增量补丁 zip');
  const map = {}; authorItems.forEach(x=>map[x.key]=x);
  const entries = [];
  const mfChanges = changes.map((c,i) => {
    const fn = 'content/'+i+'.json';
    const data = c.op==='delete' ? PE.TOMB : (map[c.key]||{}).data||'';
    entries.push({name:fn, data:JSON.stringify({key:c.key,kind:c.kind,data})});
    return {op:c.op,key:c.key,kind:c.kind,baseHash:c.baseHash,newHash:c.newHash,file:fn};
  });
  const manifest = {app:'yunjing-patch',schema:2,title:'测试补丁',baseVersion:'6.5.0',changes:mfChanges,volumes:1,stripKeys:true};
  entries.unshift({name:'manifest.json',data:JSON.stringify(manifest)});
  const zip = await ZW.makeZip(entries);

  console.log('\n[E2E-3] 下载方：解包 → 还原 theirs');
  const files = await ZW.unzip(zip);
  ok('解包4文件', files.length === 4, files.map(f=>f.name));
  const mf = JSON.parse(ZW.entryText(files.find(f=>f.name==='manifest.json')));
  const theirs = mf.changes.map(c => {
    const f = files.find(x=>x.name===c.file);
    const data = JSON.parse(ZW.entryText(f)).data;
    return {key:c.key,kind:c.kind,hash:c.newHash||PE.hash(data),data};
  });
  ok('theirs 含删除项 tombstone', theirs.find(x=>x.key==='worldbook/c').data === PE.TOMB);

  console.log('\n[E2E-4] 三方合并：本地未改 → 直接覆盖；本地也改 → 合并/冲突');
  // 下载方现状：a 未改(=v1)、b 改成了 LOCAL、c 未改(=v1)、没有 d
  const ours = [PE.item('preset/a','preset','v1'), PE.item('dlc/b','dlc','LOCAL'), PE.item('worldbook/c','worldbook','v1')];
  const decisions = PE.plan(baseline, ours, theirs);
  const byKey = {}; decisions.forEach(d=>byKey[d.key]=d);
  ok('a: 本地没改 → overwrite 为 v2', byKey['preset/a'].action==='overwrite' && byKey['preset/a'].theirs==='v2');
  ok('b: 作者没改(theirs=base) → keep 本地LOCAL', byKey['dlc/b'].action==='keep');
  ok('c: 作者删了、本地没改 → overwrite 为 tombstone', byKey['worldbook/c'].action==='overwrite' && byKey['worldbook/c'].theirs===PE.TOMB);
  ok('d: 本地没有 → overwrite 新增', byKey['content/d'].action==='overwrite');
  const sum = PE.summarize(decisions);
  ok('统计: overwrite=3 keep=1', sum.overwrite===3 && sum.keep===1, sum);

  console.log('\n[E2E-5] 备份 → 应用 → 回滚');
  const backup = PE.makeBackup(decisions, 'e2e');
  ok('备份覆盖3个改动key(a/c/d)', backup.entries.length===3, backup.entries.map(e=>e.key));
  // 模拟写回：CA.apply 会把 "preset/a" 拆成原始存储键 "a" 再交给 writer（真实 localWriter 亦然）
  const rawKey = k => k.slice(k.indexOf('/') + 1);
  const store = {};
  // store 代表下载方"本机现状"(ours)：a=v1, b=LOCAL, c=v1
  ours.forEach(it=>store[rawKey(it.key)]=it.data);
  const writer = {write:(k,d)=>{ if(d===PE.TOMB) delete store[k]; else store[k]=d; }};
  CA.apply(PE.applyList(decisions), writer);
  ok('应用后 a=v2', store['a']==='v2', store);
  ok('应用后 c 被删除', !('c' in store));
  ok('应用后 d=new', store['d']==='new');
  ok('应用后 b 仍是本地LOCAL', store['b']==='LOCAL');
  CA.apply(PE.rollbackList(backup), writer);
  ok('回滚后 a=v1', store['a']==='v1', store);
  ok('回滚后 c 恢复', store['c']==='v1');
  ok('回滚后 d 移除', !('d' in store));

  console.log('\n[E2E-6] 版本检查 + 分卷');
  ok('同版本 ok', PE.versionCheck('6.5.0','6.5.0','6.5.0').level==='ok');
  ok('大包分卷', PE.suggestVolumes(200*1024*1024).count===3);

  console.log('\n========== 结果 ==========');
  console.log('PASS='+pass+' FAIL='+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
