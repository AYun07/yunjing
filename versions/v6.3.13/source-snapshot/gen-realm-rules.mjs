#!/usr/bin/env node
/**
 * 境界规则档生成器 —— 合成三源，生成 js/realm-rules.js（window.RealmRules）
 *   ① scripts/realm-ladders.mjs  —— 人工审定的 tier 阶梯 / 极境 / 越境基调（权威锚）
 *   ② review-data.json           —— 各 config 境界体系原文（canonText，钉死原著、供 AI 契约）
 *   ③ js/world-rules.js          —— 每世界六维属性档（维度名/dpp/cap）
 * 重跑：node scripts/gen-realm-rules.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { LADDERS, LADDER_VERSION } from './realm-ladders.mjs';

const ROOT = process.cwd();
const REVIEW = '/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d59-9760f4f1c000/review-data.json';

const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
const reviewById = {};
for (const r of review) reviewById[r.id] = r;

// 载入 world-rules 维度档
globalThis.window = {};
(new Function(fs.readFileSync(path.join(ROOT, 'js/world-rules.js'), 'utf8')))();
const WR = globalThis.window.WorldRules.REGISTRY;

// 能级归一化：tier i(0-based) → 0-100。有数值档的世界以 numericNote 为准，此处给线性基准。
function energyOf(i, n) {
  if (n <= 1) return 100;
  return Math.round(((i + 1) / n) * 1000) / 10;
}

const registry = {};
for (const [id, L] of Object.entries(LADDERS)) {
  const rv = reviewById[id] || {};
  const axes = ((WR[id] || {}).axes || []).map(a => ({ id: a.id, name: a.name, dpp: a.dpp, cap: a.cap }));

  // 极境标注：peak 项形如「搬血极境·十万斤」「极限斗罗·99级」，tier 名形如「搬血境」。
  // 取 peak 核心词并去「极境/境/巅峰/圆满」等后缀，再与 tier 名互相包含判断，容忍措辞差异。
  function peakMatch(tierName, peakItem) {
    const core = String(peakItem).split('·')[0];
    if (tierName.indexOf(core) >= 0 || core.indexOf(tierName) >= 0) return true;
    const cand = core.replace(/(极境|圆满|巅峰|大圆满|境|期|级)$/, '');
    return cand.length >= 2 && tierName.indexOf(cand) >= 0;
  }
  const tiers = L.tiers.map((name, i) => ({
    order: i + 1,
    name,
    energy: energyOf(i, L.tiers.length),
    peak: (L.peaks || []).some(p => peakMatch(name, p))
  }));

  // canonText：拼接该世界所有境界章节原文（已滤人物志），作为原著锚点
  const canonText = (rv.realmSections || []).map(s => s.body).join('\n\n').trim();

  // 分部体系（v6.3.8）：斗罗四部/大地铁犁星空轴等并行战力体系。
  // 每套分部独立归一化能级，但不混入主阶梯 tiers 比对序号——避免跨部/跨轴误比。
  const subSystems = (L.subSystems || []).map((ss, si) => {
    const ssTiers = ss.tiers || [];
    return {
      id: id + '_sub' + (si + 1),
      name: ss.name,
      note: ss.note || '',
      tiers: ssTiers.map((name, i) => ({
        order: i + 1,
        name,
        energy: energyOf(i, ssTiers.length)
      }))
    };
  });

  registry[id] = {
    name: L.name,
    mode: L.mode,
    realmMode: L.realmMode,
    crossAllow: L.crossAllow,
    numericNote: L.numericNote || '',
    notes: L.notes || '',
    tiers,
    peaks: L.peaks || [],
    subSystems,
    nestedWorlds: L.nestedWorlds || [],
    canonText,
    axes
  };
}

const banner = `/* 云境 · 境界规则档 RealmRules v${LADDER_VERSION}（自动生成，勿手改 · v6.3.8）
 * 由 scripts/gen-realm-rules.mjs 合成 realm-ladders(人工审定) + config 境界原文 + world-rules 维度。
 * window.RealmRules.getByGenre(id) 取某世界境界档；compare-engine 据此做数值比对。
 * canonText 为该世界原著境界体系原文锚点，注入 AI 契约确保「原著设定钉死」。
 */
`;
const body = `(function(){
"use strict";
var REGISTRY = ${JSON.stringify(registry, null, 1)};
function getByGenre(id){ return REGISTRY[id] || null; }
function isLadder(id){ var r = REGISTRY[id]; return !!(r && r.realmMode === 'ladder' && r.tiers && r.tiers.length); }
function tiersOf(id){ var r = REGISTRY[id]; return (r && r.tiers) ? r.tiers : []; }
function tierByName(id, name){
  var ts = tiersOf(id); var s = String(name||'');
  for (var i=0;i<ts.length;i++){ if (ts[i].name === s) return ts[i]; }
  /* 宽松匹配：去掉·后括号描述再比 */
  for (var j=0;j<ts.length;j++){ if (ts[j].name.indexOf(s.split('·')[0])>=0 && s.length>=2) return ts[j]; }
  return null;
}
function canonOf(id){ var r = REGISTRY[id]; return r ? r.canonText : ''; }
function subSystemsOf(id){ var r = REGISTRY[id]; return (r && r.subSystems) ? r.subSystems : []; }
/* v6.3.12：副体系归属解析——同名/近名 tier 可能落在多套分部，返回全部命中以便引擎判定歧义。
   匹配用「·」前核心词互相包含，容忍「武夫金身/金身」「初代种/初代种·君主」这类措辞差。 */
function subSystemTierHits(id, name){
  var r = REGISTRY[id]; if (!r || !r.subSystems) return [];
  var s = String(name || ''); var core = s.split('·')[0]; var hits = [];
  for (var i=0;i<r.subSystems.length;i++){
    var ss = r.subSystems[i];
    for (var j=0;j<ss.tiers.length;j++){
      var t = ss.tiers[j]; var tc = t.name.split('·')[0];
      var exact = (t.name === s);
      var fuzzy = core.length >= 2 && (t.name.indexOf(core) >= 0 || (tc.length >= 2 && core.indexOf(tc) >= 0));
      if (exact || fuzzy) hits.push({ systemId: ss.id, systemName: ss.name, tier: t, exact: exact });
    }
  }
  return hits;
}
function nestedWorldsOf(id){ var r = REGISTRY[id]; return (r && r.nestedWorlds) ? r.nestedWorlds : []; }
function nestedWorldByName(id, name){
  var list = nestedWorldsOf(id); var s = String(name || ''); var core = s.split('·')[0];
  for (var i=0;i<list.length;i++){
    if (list[i].name === s || list[i].id === s) return list[i];
    if (core.length >= 2 && list[i].name.indexOf(core) >= 0) return list[i];
  }
  return null;
}
window.RealmRules = {
  version: '${LADDER_VERSION}', worldCount: Object.keys(REGISTRY).length,
  REGISTRY: REGISTRY, getByGenre: getByGenre, isLadder: isLadder,
  tiersOf: tiersOf, tierByName: tierByName, canonOf: canonOf, subSystemsOf: subSystemsOf,
  subSystemTierHits: subSystemTierHits, nestedWorldsOf: nestedWorldsOf, nestedWorldByName: nestedWorldByName
};
})();\n`;

const out = path.join(ROOT, 'js', 'realm-rules.js');
fs.writeFileSync(out, banner + body, 'utf8');
const ladderCount = Object.values(registry).filter(r => r.realmMode === 'ladder').length;
console.log('已生成', out);
console.log('世界数:', Object.keys(registry).length, '| 有阶梯:', ladderCount, '| 无阶梯:', Object.keys(registry).length - ladderCount);
console.log('总 tier 数:', Object.values(registry).reduce((s, r) => s + r.tiers.length, 0));
