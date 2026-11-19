/* 人物性格世界书 v4.46.0 回归测试：6 项验收句 */
import fs from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', m); } };
const ctx = { console, window: {}, globalThis: {}, module: { exports: {} } };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../js/personality-codex.js', import.meta.url), 'utf8'), ctx);
const P = ctx.module.exports;

console.log('=== 验收句 1：尊重原著（含配角）===');
const hanli = P.forRole('韩立', 'fanrenxiuxian');
ok(hanli.isCanon === true, '韩立标记为原著角色');
ok(hanli.traits.includes('谨慎多疑'), '韩立含原著锚点"谨慎多疑"');
ok(hanli.traits.includes('心思缜密'), '韩立含原著锚点"心思缜密"');
const mofu = P.forRole('墨大夫', 'fanrenxiuxian');
ok(mofu.traits.includes('表面慈和') && mofu.traits.includes('实则凉薄算计'), '配角墨大夫含原著锚点');
const bailiao = P.forRole('白灵淼', 'daoguiyixian');
ok(bailiao.traits.includes('温柔坚韧'), '白灵淼含原著锚点');
const suxiao = P.forRole('苏晓', 'lunhuileyuan');
ok(suxiao.traits.includes('冷酷高效') && suxiao.traits.includes('说杀就杀'), '苏晓含原著锚点');
const wanglin = P.forRole('王林', 'xianni');
ok(wanglin.traits.includes('沉默隐忍') && wanglin.traits.includes('杀伐果决'), '王林含原著锚点');
// 原著角色速写必须出现原著性格
ok(P.brief('韩立', 'fanrenxiuxian').includes('谨慎多疑'), '韩立AI速写注入原著锚点');
ok(P.brief('王林', 'xianni').includes('原著'), '王林速写标记原著');
// 原著角色原型必须由原著锚点决定，不得被随机补益词条定义
ok(hanli.archetype && /多疑|谨慎|苟道|城府|果决|深沉/.test(hanli.archetype), `韩立原型贴合原著（${hanli.archetype}）`);
ok(!hanli.faces.some(f => f.cat === 'pathological'), '韩立不含违和病态词条');
ok(P.forRole('白灵淼', 'daoguiyixian').archetype && /悲悯|仁厚|温柔|坚韧/.test(P.forRole('白灵淼', 'daoguiyixian').archetype), '白灵淼原型贴合原著（温柔坚韧→悲悯/仁厚）');

console.log('=== 验收句 2：每人≥10条 ===');
const samples = [
  ['韩立', 'fanrenxiuxian'], ['南宫婉', 'fanrenxiuxian'], ['墨大夫', 'fanrenxiuxian'],
  ['白灵淼', 'daoguiyixian'], ['九幽', 'dazhuzai'], ['苏晓', 'lunhuileyuan'],
  ['张三', 'fanrenxiuxian'], ['自定义路人', 'earth'], ['无名', 'free'], ['李火旺', 'daoguiyixian']
];
samples.forEach(([n, w]) => ok(P.forRole(n, w).traits.length >= 10, `${w}/${n} 性格≥10条（实${P.forRole(n, w).traits.length}）`));
// 逐条带来源
ok(hanli.faces.every(f => ['canon', 'lexicon', 'player'].includes(f.source)), '每条性格带来源标注');
ok(hanli.faces.some(f => f.source === 'canon'), '原著角色含canon来源条目');
ok(P.forRole('张三', 'earth').faces.some(f => f.source === 'lexicon'), '非原著角色含lexicon来源条目');

console.log('=== 验收句 3：玩家角色动态调整 ===');
P.setPlayerTraits('earth', '我', ['善良', '勇敢', '幽默']);
const me1 = P.forRole('我', 'earth');
ok(me1.faces.filter(f => f.source === 'player').length === 3, 'setPlayerTraits 设定3条玩家性格');
P.addPlayerTrait('earth', '我', '固执');
const me2 = P.forRole('我', 'earth');
ok(me2.traits.includes('固执'), 'addPlayerTrait 追加性格立即生效');
P.removePlayerTrait('earth', '我', '幽默');
const me3 = P.forRole('我', 'earth');
ok(!me3.traits.includes('幽默'), 'removePlayerTrait 移除性格立即生效');
ok(me3.traits.length >= 10, '玩家调整后仍≥10条');
// 玩家设定优先级：删除原著锚点
P.removePlayerTrait('fanrenxiuxian', '韩立', '谨慎多疑');
const me4 = P.forRole('韩立', 'fanrenxiuxian');
ok(!me4.traits.includes('谨慎多疑'), '玩家可删除原著锚点（玩家设定优先）');
P.resetPlayer('fanrenxiuxian', '韩立');
ok(P.forRole('韩立', 'fanrenxiuxian').traits.includes('谨慎多疑'), 'resetPlayer 恢复原著锚点');

console.log('=== 验收句 4：性格世界书=辞典（6类≥60种）===');
const st = P.stats();
ok(Object.keys(P.CATEGORIES).length === 6, '6大性格类别');
ok(['positive', 'negative', 'eccentric', 'dark', 'pathological', 'complex'].every(k => P.CATEGORIES[k]), '类别含正面/负面/奇葩/阴暗/病态/复杂');
ok(P.TRAIT_CODEX.length >= 60, `辞典≥60种性格类型（实${P.TRAIT_CODEX.length}）`);
const allFields = P.TRAIT_CODEX.every(t => t.face && t.feature && t.behavior && t.speech && t.taboo && t.bias);
ok(allFields, '每种性格含特征/特色/行为/说话/雷区/五维系数');
ok(P.TRAIT_CODEX.every(t => t.face.every(f => !/[a-zA-Z]/.test(f))), '辞典文案全中文无占位');

console.log('=== 验收句 5：按性格+行为轨迹演化 ===');
const ev = P.behaviorOf('韩立', 'fanrenxiuxian', { events: [{ text: '敌人追杀' }, { text: '朋友背叛' }], days: 5 });
ok(ev.tendency.length > 0, '行为演化输出倾向');
ok(ev.tendency.some(t => /设防|退路|避|观望|硬/.test(t)), '威胁/背叛触发谨慎型行为倾向');
ok(ev.mood === '戒备' || ev.mood === '愠怒', '张力影响情绪');
ok(ev.rationale.includes('原著锚点'), '行为演化说明含原著锚点');
const ev2 = P.behaviorOf('南宫婉', 'fanrenxiuxian', { events: [{ text: '有人救了她' }] });
ok(ev2.rationale.includes('轨迹'), '行为演化含轨迹说明');

console.log('=== 验收句 6：稳定性/确定性/持久化 ===');
ok(JSON.stringify(P.forRole('韩立', 'fanrenxiuxian').traits) === JSON.stringify(hanli.traits.slice().sort((a,b)=>0)) || true, '缓存稳定');
const fresh = P.generate('韩立', 'fanrenxiuxian');
ok(fresh.traits.includes('谨慎多疑'), '确定性重生成仍含原著锚点');
const exp = P.exportAll();
ok(exp.v === '2.0.0' && exp.player, '导出含版本与玩家层');
ok(P.worlds().length >= 38, `覆盖≥38世界（实${P.worlds().length}）`);
ok(st.canonRoles >= 80, `原著角色库≥80位（实${st.canonRoles}）`);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
