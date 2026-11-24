/**
 * 云境 · 数值比对与复杂世界回归测试（v6.3.12 起）
 * 运行：node test/compare-regression.mjs
 * 覆盖：主阶梯正常比对、5 个世界副体系跨体系拒绝、嵌套宇宙字段、异常输入不崩。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const f of ['js/realm-rules.js', 'js/compare-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const CE = sandbox.window.CompareEngine;
const RR = sandbox.window.RealmRules;

let pass = 0, fail = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r === true) { pass++; console.log('  PASS  ' + name); }
    else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(r)); }
  } catch (e) {
    fail++; console.log('  FAIL  ' + name + '  →  EXCEPTION ' + e.message);
  }
}
const isReject = (r) => !!(r && r.ok === false && r.crossSystem === true && r.reason);
const hasText = (r, s) => !!(r && typeof r.reason === 'string' && r.reason.indexOf(s) >= 0);

console.log('=== A. 主阶梯正常比对（保护既有能力） ===');
check('剑来主阶梯 铜皮→草根 能级差为负向可比对', () => {
  const d = CE.gap('jianlai', '铜皮', '草根');
  return d && d.tierDiff === 1 && d.energyDiff > 0 ? true : d;
});
check('斗罗主阶梯 魂士→封号斗罗 可跨档报告', () => {
  const r = CE.crossRealm('douluodalu', '魂士', '封号斗罗', { tianjiao: '顶级天骄', customBonus: 6 });
  return r && r.ok && typeof r.crossCap === 'number' ? true : r;
});
check('完美世界 搬血境→搬血极境 极境倍率生效', () => {
  const r = CE.crossRealm('wanmeishijie', '搬血境', '洞天境', { peak: true });
  return r && r.ok && r.peakApplied === true ? true : r;
});

console.log('=== B. 五世界副体系跨体系硬拒绝（本版新增核心） ===');
const CROSS = [
  ['剑来', 'jianlai', '武夫金身', '金丹', '纯粹武夫十一境'],
  ['斩神', 'zhanhen', '王墟', '海境', '禁墟'],
  ['龙族', 'longzu', '初代种·君主', 'S级混血', '龙类按代'],
  ['斗罗', 'douluodalu', '一字斗铠', '封号斗罗', '斗铠'],
  ['地摊大力', 'ditandali', '炼气', '黑铁', '仙宫星空']
];
for (const [label, id, from, to, keyword] of CROSS) {
  check(label + '：副体系「' + from + '」不得与主阶梯「' + to + '」互比', () => {
    const r = CE.gap(id, from, to);
    return isReject(r) && hasText(r, keyword) ? true : r;
  });
}
check('跨体系拒绝同时覆盖 crossRealm 入口', () => {
  const r = CE.crossRealm('jianlai', '武夫金身', '金丹', { tianjiao: '顶级天骄' });
  return isReject(r) ? true : r;
});
check('跨体系拒绝覆盖 exceptionReport 入口', () => {
  const r = CE.exceptionReport('jianlai', '武夫金身', '金丹');
  return isReject(r) ? true : r;
});
check('同一副体系内部仍可比对（不得一律拒绝）', () => {
  const r = CE.gap('jianlai', '泥胚', '武胆');
  return r && r.tierDiff > 0 && !r.crossSystem ? true : r;
});
check('显式体系对象：同体系内比对可用（面板体系选择器路径）', () => {
  const r = CE.gap('jianlai', { systemId: 'jianlai_sub1', name: '泥胚' }, { systemId: 'jianlai_sub1', name: '武胆' });
  return r && r.tierDiff === 5 && !r.crossSystem ? true : r; // 泥胚序1→武胆序6，原著十一境顺序手算
});
check('显式体系对象：跨体系仍硬拒绝（同名斗铠消歧）', () => {
  const r = CE.gap('douluodalu', { systemId: 'douluodalu_sub3', name: '一字斗铠' }, { systemId: 'douluodalu_sub4', name: '六字斗铠' });
  return isReject(r) ? true : r;
});

console.log('=== C. 异常输入给人话提示，不崩不静默 ===');
check('不存在的境界名返回可读提示', () => {
  const r = CE.gap('jianlai', '完全不存在的境界xyz', '金丹');
  return hasText(r, '找不到') || hasText(r, '不存在') ? true : r;
});
check('空输入不崩', () => CE.gap('jianlai', '', '金丹') !== undefined ? true : 'undefined');
check('超长输入不崩', () => {
  const r = CE.gap('jianlai', '境'.repeat(5000), '金丹');
  return r && r.ok === false ? true : r;
});
check('数字带千分位格式异常不崩', () => {
  const r = CE.gap('jianlai', '1,000', '金丹');
  return r !== undefined ? true : 'undefined';
});

console.log('=== D. 嵌套宇宙数据结构（本版新增） ===');
const NESTED = ['chaoshenxueyuan', 'daoguiyixian', 'ditandali', 'swallowedstar'];
for (const id of NESTED) {
  check(id + ' 具备嵌套世界观字段且非空', () => {
    const list = typeof CE.nestedWorldsOf === 'function' ? CE.nestedWorldsOf(id) : null;
    return Array.isArray(list) && list.length > 0 ? true : list;
  });
}
check('契约文本注入嵌套宇宙隔离口径', () => {
  const line = CE.contractLine('chaoshenxueyuan');
  return line && line.indexOf('嵌套') >= 0 ? true : (line || '').slice(0, 80);
});
check('嵌套层之间不可直接互比', () => {
  const r = CE.gap('chaoshenxueyuan', '未知宇宙·虚空', '神体');
  return isReject(r) || hasText(r, '嵌套世界观') ? true : r;
});

console.log('=== E. 跨层对敌折算（v6.3.13 新增） ===');
check('同层对敌：无层位差，按主阶梯档差算', () => {
  const r = CE.crossLayer('swallowedstar', { layer: '地球篇', tier: '战士级' }, { layer: '地球篇', tier: '战将级' }, { narrative: '星球内切磋', tianjiao: '顶级天骄' });
  // ratio=1 → layerGap=0，baseNeed=1 → totalNeed=1；顶级天骄 1.5 档→crossCap=1，放行
  return r && r.layerGap === 0 && r.totalNeed === 1 && r.crossCap === 1 && r.allowed ? true : r;
});
check('高维层对低维层：层位差为正、代价计入', () => {
  const r = CE.crossLayer('swallowedstar', { layer: '地球篇', tier: '战神级' }, { layer: '浑源空间·界海之上', tier: '混沌主宰' }, { narrative: '神王出手', customBonus: 40 });
  // factor 1→1.6, ratio=1.6, layerGap=round(0.6*2)=1；baseNeed 为正
  return r && r.layerGap === 1 && r.totalNeed === r.baseNeed + 1 && r.estimated === true ? true : r;
});
check('跨层不给缘由一律判口胡（不做无条件放行）', () => {
  const r = CE.crossLayer('ditandali', { layer: '蓝星', tier: '黑铁' }, { layer: '仙宫星空世界', tier: '炼气' }, { tianjiao: '顶级天骄' });
  return r && r.allowed === false && /缘由|口胡/.test(r.requirement) ? true : r;
});
check('给了缘由 + 足够加成可放行', () => {
  const r = CE.crossLayer('ditandali', { layer: '蓝星', tier: '黑铁' }, { layer: '仙宫星空世界', tier: '炼气' }, { narrative: '仙宫血脉觉醒跨界', customBonus: 20 });
  return r && r.allowed === true ? true : r;
});
check('非明示倍率强制标注估算与依据', () => {
  const r = CE.crossLayer('chaoshenxueyuan', { layer: '已知宇宙', tier: '神体' }, { layer: '未知宇宙·虚空', tier: '凡人' }, { narrative: '接触虚空' });
  return r && r.estimated === true && /估算/.test(r.estimateNote) && /科技理论无法理解/.test(r.estimateNote) ? true : r;
});
check('跨层折算公式与档数自洽（可追溯）', () => {
  const r = CE.crossLayer('daoguiyixian', { layer: '现实层', tier: '凡人' }, { layer: '大傩世界·虚境', tier: '学法' }, { narrative: '坐忘道修假' });
  // real 1 → danuo 1.2，ratio=1.2，layerGap=round(0.2*2)=0；baseNeed=1
  return r && r.layerRatio === 1.2 && r.layerGap === 0 && r.totalNeed === 1 ? true : r;
});
check('嵌套层名不存在给人话提示', () => {
  const r = CE.crossLayer('swallowedstar', { layer: '不存在的层', tier: '战士级' }, { layer: '地球篇', tier: '战神级' }, {});
  return r && r.ok === false && /层不存在/.test(r.reason) ? true : r;
});
check('跨层报告文本可读且无 undefined（reportText 分支优先级）', () => {
  const r = CE.crossLayer('swallowedstar', { layer: '地球篇', tier: '战士级' }, { layer: '宇宙海篇', tier: '行星级' }, { narrative: '进入宇宙海' });
  const t = CE.reportText(r);
  return t && t.indexOf('需') >= 0 && t.indexOf('档') >= 0 && t.indexOf('undefined') < 0 ? true : t;
});
check('跨层折算不影响原跨体系硬拒绝', () => {
  const r = CE.gap('jianlai', '武夫金身', '金丹');
  return isReject(r) ? true : r;
});

console.log('=== 汇总 ===');
console.log('PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
