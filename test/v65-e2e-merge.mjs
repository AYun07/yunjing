/* v6.5.0 第二版合并验证：第一版基线 + 玩家改动(ours) + 第二版(theirs) → 三方合并 */
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const PE=require('../js/patch-engine.js');
let pass=0,fail=0;
const ok=(c,m,x)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL '+m+(x?' → '+JSON.stringify(x):''))}};

console.log('\n【1】构造第一版基线（base）');
// 第一版装完后玩家的内容（作为共同基线）
const base=[
  PE.item('dlc/storyDLC_free', 'dlc', JSON.stringify({name:'剑来·武夫十一境',items:['九境气盛','十一境止境']})),
  PE.item('save/storySave_free', 'save', JSON.stringify({title:'剑来行',chapter:1,realm:'武夫九境',msgs:['第一句','第二句']})),
  PE.item('plugin/yj_plugin_manifest','plugin',JSON.stringify({name:'字数统计',version:'1.0.0'}))
];
const baseMap=PE.toMap(base);

console.log('\n【2】第二版作者改动（theirs）—— 以 base 为基础');
// 第二版：DLC 加一条；存档推进剧情；插件改版本
const theirs=[
  PE.item('dlc/storyDLC_free','dlc',JSON.stringify({name:'剑来·武夫十一境',items:['九境气盛','十一境止境','十二境宗师']})),
  PE.item('save/storySave_free','save',JSON.stringify({title:'剑来行',chapter:2,realm:'武夫九境',msgs:['第一句','第二句','第三句·第二版新增']})),
  PE.item('plugin/yj_plugin_manifest','plugin',JSON.stringify({name:'字数统计',version:'2.0.0'}))
];

console.log('\n【3】玩家本地改动（ours）—— 装了第一版后又自己改了些');
// 场景A：DLC 玩家没改 → 应直接采用第二版(overwrite)
// 场景B：存档玩家改了不同字段(realm=武夫十境)而第二版改了 chapter/msgs → 字段级 merge
// 场景C：插件玩家也改了 version=1.5.0，第二版改 version=2.0.0 → 同字段冲突(conflict)
const ours=[
  base[0], // DLC 未改
  PE.item('save/storySave_free','save',JSON.stringify({title:'剑来行',chapter:1,realm:'武夫十境·玩家自改',msgs:['第一句','第二句']})),
  PE.item('plugin/yj_plugin_manifest','plugin',JSON.stringify({name:'字数统计',version:'1.5.0'}))
];

const decisions=PE.plan(base,ours,theirs);
const byKey={}; decisions.forEach(d=>byKey[d.key]=d);
console.log('  处置:',JSON.stringify(PE.summarize(decisions)));

console.log('\n【4】验证三类处置正确');
ok(byKey['dlc/storyDLC_free'].action==='overwrite','DLC: 玩家没改 → 直接采用第二版(overwrite)');
ok(byKey['save/storySave_free'].action==='merge','存档: 双方改不同字段 → 自动合并(merge)');
ok(byKey['plugin/yj_plugin_manifest'].action==='conflict','插件: 双方改同一字段 version → 冲突(conflict)');

console.log('\n【5】验证合并结果内容正确');
if(byKey['save/storySave_free'].action==='merge'){
  const merged=JSON.parse(byKey['save/storySave_free'].merged);
  ok(merged.realm==='武夫十境·玩家自改','合并保留玩家的 realm 修改');
  ok(merged.chapter===2 && merged.msgs.length===3,'合并采纳第二版的 chapter/msgs');
}
// 冲突：人工裁决后采用 theirs
const resolved=PE.applyList(decisions,{'plugin/yj_plugin_manifest':'theirs'});
const plugOp=resolved.find(o=>o.key==='plugin/yj_plugin_manifest');
ok(plugOp && JSON.parse(plugOp.data).version==='2.0.0','冲突人工裁决采用第二版 version=2.0.0');
// 未裁决的冲突不落地
const unresolved=PE.applyList(decisions,{});
ok(!unresolved.some(o=>o.key==='plugin/yj_plugin_manifest'),'未裁决冲突保持原样（不乱覆盖）');

console.log('\n【6】备份/回滚在第二版合并场景');
const backup=PE.makeBackup(decisions,'merge-v2');
ok(backup.entries.some(e=>e.key==='dlc/storyDLC_free'),'备份含将被覆盖的 DLC');
ok(backup.entries.some(e=>e.key==='save/storySave_free'),'备份含将被合并的存档');
// 应用后回滚，DLC/存档应精确还原到 ours
const writerOps=PE.applyList(decisions,{'plugin/yj_plugin_manifest':'theirs'});
const store={}; [ours[0],ours[1],ours[2]].forEach(it=>store[it.key]=it.data);
const writer={write:(k,d)=>{ if(d===PE.TOMB)delete store[k]; else store[k]=d; }};
CA_apply(writerOps,writer);
ok(JSON.parse(store['dlc/storyDLC_free']).items.length===3,'应用后 DLC 有第二版新增条目');
CA_apply(PE.rollbackList(backup),writer);
ok(JSON.parse(store['dlc/storyDLC_free']).items.length===2,'回滚后 DLC 还原为2条');
ok(JSON.parse(store['save/storySave_free']).realm==='武夫十境·玩家自改','回滚后存档还原玩家 realm');

function CA_apply(ops,w){ops.forEach(o=>w.write(o.key,o.data));}

console.log('\n【7】存档对话内容合并的完整性（关键：不坏档）');
// 再单独验证：玩家和第二版都追加了不同对话，数组是原子值 → 应标冲突交人工（不做危险自动拼接）
const bArr=PE.item('save/x','save',JSON.stringify({msgs:['A']}));
const oArr=PE.item('save/x','save',JSON.stringify({msgs:['A','玩家追加']}));
const tArr=PE.item('save/x','save',JSON.stringify({msgs:['A','作者追加']}));
const dArr=PE.plan([bArr],[oArr],[tArr])[0];
ok(dArr.action==='conflict','对话数组双方都追加 → 标冲突交人工（不启发式拼接，符合DR-049）');

console.log('\n========== 结果 ==========');
console.log('PASS='+pass+' FAIL='+fail);
process.exit(fail?1:0);
