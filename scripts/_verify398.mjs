#!/usr/bin/env node
/* v3.98.0 综合验收：复刻 selftest 逻辑 + 扩展检查（config/ext/core/atlas/linkage/kb）。 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0, warn = 0;
const ok = (n, d) => { pass++; console.log(`  ✅ ${n} — ${d}`); };
const bad = (n, d) => { fail++; console.log(`  ❌ ${n} — ${d}`); };
const wn = (n, d) => { warn++; console.log(`  ⚠️  ${n} — ${d}`); };

function makeSandbox() {
  const win = {};
  const doc = { body: { classList: { add() {}, remove() {} } }, getElementById: () => null, addEventListener() {} };
  return { window: win, document: doc, console, KB_PRESETS: win.KB_PRESETS };
}
function loadInto(file, sandbox) {
  const code = read(file);
  vm.runInNewContext(code, sandbox, { filename: file });
}

/* ---------- 1. 四套 genre 集合一致性 ---------- */
console.log('\n[1] 四套 genre 集合一致性');
const swGenres = (read('sw.js').match(/const GENRES = \[([^\]]+)\]/) || [])[1]
  ? JSON.parse('[' + (read('sw.js').match(/const GENRES = \[([^\]]+)\]/)[1]) + ']') : [];
const stuValid = (read('studio.html').match(/validGenres = \[([^\]]+)\]/) || [])[1]
  ? JSON.parse('[' + (read('studio.html').match(/validGenres = \[([^\]]+)\]/)[1]) + ']') : [];
const idxCards = [...new Set([...read('index.html').matchAll(/genre=([a-z]+)/g)].map(m => m[1]))];
const selfGenres = (read('selftest.html').match(/const GENRES = \[([^\]]+)\]/) || [])[1]
  ? JSON.parse('[' + (read('selftest.html').match(/const GENRES = \[([^\]]+)\]/)[1]) + ']') : [];

const setEq = (a, b) => a.length === b.length && a.every(x => b.includes(x));
if (setEq(swGenres, stuValid) && setEq(swGenres, idxCards) && setEq(swGenres, selfGenres)) {
  ok('集合一致', `${swGenres.length} 界：sw=studio=index卡=selftest 完全一致`);
} else {
  bad('集合不一致', `sw:${swGenres.length} studio:${stuValid.length} index卡:${idxCards.length} selftest:${selfGenres.length}`);
  const all = new Set([...swGenres, ...stuValid, ...idxCards, ...selfGenres]);
  for (const g of all) {
    const inS = swGenres.includes(g), inV = stuValid.includes(g), inC = idxCards.includes(g), inF = selfGenres.includes(g);
    if (!(inS && inV && inC && inF)) wn('  差异项', `${g} sw=${inS} studio=${inV} 卡=${inC} selftest=${inF}`);
  }
}
const GENRES = swGenres;

/* ---------- 2. 资源四件套 + 引擎三注册 ---------- */
console.log('\n[2] 37 界资源四件套 + 引擎三注册');
const need = (g, f) => { try { return fs.existsSync(path.join(ROOT, f)); } catch { return false; } };
let fourOk = 0, regOk = 0;
for (const g of GENRES) {
  const miss = ['configs/' + g + '-config.js', 'js/world-ext/' + g + '-ext.js', 'css/' + g + '-style.css']
    .filter(f => !need(g, f));
  if (miss.length) bad('四件套 ' + g, '缺 ' + miss.join(','));
  else fourOk++;
  const c = read('js/combat-core.js'), q = read('js/quest-chain.js'), s = read('js/world-stage.js');
  const r = [c.includes(g + ':{'), q.includes(g + ':{'), s.includes(g + ':{')].filter(Boolean).length;
  if (r === 3) regOk++;
  else bad('引擎注册 ' + g, `combat/quest/worldstage 命中 ${r}/3`);
}
ok('四件套', `${fourOk}/${GENRES.length} 界 config/ext/css 齐全`);
ok('引擎三注册', `${regOk}/${GENRES.length} 界 combat/quest/worldstage 齐全`);

/* ---------- 3. forge 惰性构造 ---------- */
console.log('\n[3] module-forge 惰性构造');
const f = read('js/module-forge.js');
const eager = GENRES.filter(g => new RegExp(g + ':\\[').test(f.text || f));
// f 是字符串，上面正则用到 f.text 不存在，直接对字符串测
const eager2 = GENRES.filter(g => new RegExp(g + ':\\[').test(f));
if (eager2.length) bad('forge 惰性', `急切键:${eager2}`); else ok('forge 惰性', '全部为 function(){return} 工厂');

/* ---------- 4. config 结构 + ## 段 ---------- */
console.log('\n[4] 各 config 结构与 ## 原著段');
let cfgOk = 0;
for (const g of GENRES) {
  const sb = makeSandbox();
  try {
    loadInto('configs/' + g + '-config.js', sb);
    const c = sb.window.GenreStoryConfig;
    if (!c) { bad('config ' + g, '未注册 GenreStoryConfig'); continue; }
    const k = c.genreKey;
    if (k !== g) { bad('config ' + g, `genreKey=${k} 不一致`); }
    const fsp = c.fullSystemPrompt || '';
    const secs = (fsp.match(/^## /gm) || []).length;
    if (secs < 3) wn('config ' + g, `## 段仅 ${secs} 个`);
    cfgOk++;
  } catch (e) { bad('config ' + g, '加载异常：' + e.message); }
}
ok('config 加载', `${cfgOk}/${GENRES.length} 界 config 可加载且 genreKey 一致`);

/* ---------- 5. ext 知识库（KB_PRESETS） + 联动 ---------- */
console.log('\n[5] 各 ext 知识库（KB_PRESETS）');
const sb = makeSandbox();
for (const g of GENRES) loadInto('js/kb/' + g + '.ext.js', sb);
const KB = sb.window.KB_PRESETS || {};
let kbOk = 0; let minLen = 1e9, maxLen = 0;
for (const g of GENRES) {
  const arr = KB[g] || [];
  if (!arr.length) bad('KB ' + g, '0 条'); else { kbOk++; minLen = Math.min(minLen, arr.length); maxLen = Math.max(maxLen, arr.length); }
}
ok('KB 装载', `${kbOk}/${GENRES.length} 界有知识库；单界条目 ${minLen}~${maxLen}`);
// 联动：5 个土豆世界应有 5 条「同宇宙联动」类
const POTATO = ['doupocangqiong', 'wudongqiankun', 'dazhuzai', 'yuanzun', 'wanxiangzhiwang'];
for (const g of POTATO) {
  const arr = KB[g] || [];
  const link = arr.filter(x => (x.tags || []).includes('同宇宙联动'));
  if (link.length >= 5) ok('联动 ' + g, `${link.length} 条同宇宙联动`);
  else bad('联动 ' + g, `仅 ${link.length} 条（应≥5）`);
}

/* ---------- 6. atlas-potato 四界舆图 ---------- */
console.log('\n[6] atlas-potato 四界舆图');
const sb2 = makeSandbox();
loadInto('js/atlas-potato.js', sb2);
const POT = sb2.window.ATLAS_POTATO || {};
const want = ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];
let atlasOk = 0; const allIds = new Set(); let dupId = null;
for (const g of want) {
  const w = POT[g];
  if (!w || !Array.isArray(w.layers)) { bad('舆图 ' + g, '缺失或非 layers'); continue; }
  let starts = 0, badLayer = 0;
  for (const L of w.layers) {
    const st = (L.nodes || []).filter(n => n.t === 'start').length;
    starts += st;
    (L.nodes || []).forEach(n => { if (allIds.has(n.id)) dupId = n.id; allIds.add(n.id); });
  }
  if (starts === w.layers.length) { atlasOk++; ok('舆图 ' + g, `${w.layers.length} 层，每层 1 起点，节点 id 全局唯一`); }
  else bad('舆图 ' + g, `${w.layers.length} 层但起点 ${starts} 个`);
}
if (dupId) bad('舆图 id', `跨世界重复 id: ${dupId}`);
else if (atlasOk === 4) ok('舆图 id 唯一', '4 界节点 id 跨世界无冲突');

/* ---------- 7. atlas-eras 斗罗五部时代层 ---------- */
console.log('\n[7] atlas-eras 斗罗时代层');
const sb3 = makeSandbox();
loadInto('js/atlas-eras.js', sb3);
const ER = sb3.window.ATLAS_ERAS || {};
const dl = ER['douluodalu'];
if (dl && Array.isArray(dl)) {
  const eraIds = dl.map(e => e.id);
  const wantEras = ['dou2', 'dou3', 'dou4', 'dou5'];
  const miss = wantEras.filter(id => !eraIds.includes(id));
  if (miss.length) bad('斗罗时代层', `缺 era: ${miss}`);
  else ok('斗罗时代层', `${dl.length} 个时代层（含 dou2~dou5），base=斗罗1`);
  const ids = new Set(); let d = null;
  dl.forEach(L => (L.nodes || []).forEach(n => { if (ids.has(n.id)) d = n.id; ids.add(n.id); }));
  if (d) bad('斗罗 era id', `重复: ${d}`); else ok('斗罗 era id', '各时代层节点 id 唯一');
} else bad('斗罗时代层', 'ATLAS_ERAS.douluodalu.eras 缺失');

/* ---------- 8. _index.json 总量 ---------- */
console.log('\n[8] 知识库索引 _index.json');
try {
  const idx = JSON.parse(read('js/kb/_index.json'));
  const genres = idx.genres || {};
  const gcount = Object.keys(genres).length;
  const total = Object.values(genres).reduce((s, v) => s + (Number(v) || 0), 0);
  if (gcount) ok('索引', `${gcount} 界，合计 ${total} 条知识库`);
  else bad('_index.json', 'genres 字段缺失');
} catch (e) { bad('_index.json', e.message); }

/* ---------- 9. 资料库体量下限（v3.98.0 起：每界 ≥400 条，避免"资料太少"） ---------- */
console.log('\n[9] 资料库体量');
try {
  const idx = JSON.parse(read('js/kb/_index.json'));
  const g = idx.genres || {};
  const thin = Object.keys(g).filter(k => Number(g[k]) < 400);
  if (thin.length) warn('体量下限', `${thin.length} 界 <400 条：${thin.map(k => k + ':' + g[k]).join(', ')}`);
  else ok('体量下限', `${Object.keys(g).length} 界全部 ≥400 条`);
  const big4 = ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];
  const low4 = big4.filter(k => Number(g[k]) < 550);
  if (low4.length) warn('四界体量', `未达 550 条：${low4.map(k => k + ':' + g[k]).join(', ')}`);
  else ok('四界体量', `大主宰 ${g.dazhuzai} / 武动 ${g.wudongqiankun} / 元尊 ${g.yuanzun} / 万相 ${g.wanxiangzhiwang} 条，均 ≥550`);
} catch (e) { bad('体量下限', e.message); }

/* ---------- 10. 同世界观联动矩阵（该联的联，不该联的不联） ---------- */
console.log('\n[10] 同世界观联动矩阵');
const LINK = [
  { name: '天蚕土豆 · 大千世界宇宙', members: ['doupocangqiong', 'wudongqiankun', 'dazhuzai', 'yuanzun', 'wanxiangzhiwang'], kw: ['武动', '大主宰', '元尊', '万相', '斗破'] },
  { name: '辰东 · 遮天三部曲', members: ['wanmeishijie', 'shrouding', 'shengxu'], kw: ['完美世界', '遮天', '圣墟'] },
  { name: '唐家三少 · 斗罗五部', members: ['douluodalu'], kw: ['绝世唐门', '龙王传说', '终极斗罗', '重生唐三'] },
];
for (const grp of LINK) {
  const miss = [];
  for (const m of grp.members) {
    let txt = '';
    try { txt = read(`js/kb/${m}.ext.js`); } catch (e) { miss.push(m + '(缺文件)'); continue; }
    const others = grp.kw.filter(k => txt.includes(k));
    if (others.length === 0) miss.push(m + '(无互引)');
  }
  if (miss.length) bad(grp.name, `联动不全：${miss.join(', ')}`);
  else ok(grp.name, `${grp.members.length} 界互相引用齐备`);
}
/* 跨组硬凑检查：土豆五部不应出现斗罗/遮天专名 */
const BAD_CROSS = ['唐三', '史莱克', '叶凡', '石昊', '楚风'];
const leaked = [];
for (const g of ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang']) {
  let txt = '';
  try { txt = read(`js/kb/${g}.ext.js`); } catch (e) { continue; }
  BAD_CROSS.filter(k => txt.includes(k)).forEach(k => leaked.push(`${g}:${k}`));
}
if (leaked.length) warn('跨组硬凑', `土豆四界出现他宇宙专名：${leaked.join(', ')}`);
else ok('跨组硬凑', '土豆四界未混入斗罗/辰东专名');

/* ---------- 总结 ---------- */
console.log(`\n========== 验收结果：通过 ${pass} / 失败 ${fail} / 警告 ${warn} ==========`);
process.exit(fail ? 1 : 0);
