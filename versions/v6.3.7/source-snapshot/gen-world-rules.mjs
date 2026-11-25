#!/usr/bin/env node
/**
 * 规则档生成器 —— 从 38 个世界的 config 中抽取 statKeys/baseAttributes，
 * 生成 js/world-rules.js（window.WorldRules）。
 *
 * 用途：新增世界后重跑 `node scripts/gen-world-rules.mjs`，
 *       该世界的专属维度档会自动加入；已有世界数值不受影响。
 * 生成内容：每世界 name / mode / axes[{id,name,dpp,cap,bias,kw}] / baseAttributes。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CFG_DIR = path.join(ROOT, 'configs');
const OUT = path.join(ROOT, 'js', 'world-rules.js');

// 语义平衡模板：继承 attribute-engine 已验证的 6 轴数值，按维度名归类
const ARCHETYPES = [
  { id:'body',  dpp:40,  cap:18, bias:'对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风',
    kw:['力量','体魄','体质','根骨','体能','身手','体术','战力','武戏','气血','肉身','strength','body','constitution'] },
  { id:'sense', dpp:30,  cap:19, bias:'危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优',
    kw:['神识','感知','精神','洞察','灵觉','直觉','灵感','灵性','sense','perception','spirit'] },
  { id:'mind',  dpp:70,  cap:13, bias:'抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱',
    kw:['心性','意志','道心','胆魄','心智','狠劲','心态','胆识','坚韧','will','mind'] },
  { id:'wit',   dpp:90,  cap:11, bias:'谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步',
    kw:['悟性','智计','智慧','谋略','算计','逻辑','机变','言辞','口才','灵慧','wit','intellect','logic'] },
  { id:'learn', dpp:18,  cap:26, bias:'修炼进度快、功法武技学得快、举一反三融会贯通',
    kw:['资质','悟性','修炼','学习','学识','文笔','创意','深度','立意','root','aptitude','learn'] },
  { id:'luck',  dpp:300, cap:5,  bias:'机缘造遇频度高、险中得宝、贵人相助、绝处逢生',
    kw:['气运','运道','机缘','福缘','幸运','人脉','声望','名气','名望','人缘','缘分','fortune','luck','charm'] }
];

const CN_ARCH = { body:'肉身', sense:'感知', mind:'心志', wit:'谋算', learn:'修学', luck:'机缘' };

function archetypeOf(label) {
  const l = String(label||'').toLowerCase();
  // '悟性' 同时命中 wit/learn，优先 wit（与现有引擎 axisOf 顺序一致：body,sense,mind,wit,learn,luck）
  for (const a of ARCHETYPES) for (const k of a.kw) if (l.includes(k.toLowerCase())) return a;
  return { id:'generic', dpp:50, cap:15, bias:'该维度主导的同类行动天然占优', kw:[] };
}

function worldNameOf(id) {
  const NAMES = {
    chaoshenxueyuan:'超神学院', cthulhu:'克苏鲁', daoguiyixian:'道诡异仙', dazhuzai:'大主宰',
    dibao:'盗墓', ditandali:'大地铁犁', douluodalu:'斗罗大陆', doupocangqiong:'斗破苍穹',
    earth:'地球', fanrenxiuxian:'凡人修仙', free:'自由创作', freeworld:'自由世界', guimi:'诡秘',
    guzhenren:'古真人', jianlai:'剑来', limingzhijian:'黎明之剑', longzu:'龙族',
    lunhuileyuan:'轮回乐园', mystery:'悬疑创作', quanqiubingfeng:'全球冰封', quanzhifashi:'全知法师',
    quanzhigaoshou:'全职高手', scifi:'科幻创作', shengxu:'圣墟', shenmifusu:'神秘复苏',
    shrouding:'遮天', swallowedstar:'吞噬星空', wangyou:'网游创作', wanmeishijie:'完美世界',
    wanxiangzhiwang:'万象之王', wudongqiankun:'武动乾坤', wulianfengdian:'武炼巅峰',
    wuxia:'武侠创作', xianni:'仙逆', xuanjianxianzu:'玄鉴仙族', yuanzun:'元尊',
    zhanhen:'战痕', zhongshengdushi:'重生都市'
  };
  return NAMES[id] || id;
}

const rules = {};
const files = fs.readdirSync(CFG_DIR).filter(f => f.endsWith('-config.js')).sort();
for (const file of files) {
  const id = file.replace(/-config\.js$/, '');
  const t = fs.readFileSync(path.join(CFG_DIR, file), 'utf8');
  const m = t.match(/const statKeys\s*=\s*\[([\s\S]*?)\];/);
  const keys = [];
  if (m) for (const mm of m[1].matchAll(/\{\s*key:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]/g)) keys.push({ key:mm[1], label:mm[2] });
  const bm = t.match(/baseAttributes\s*:\s*\{([^}]*)\}/);
  const base = {};
  if (bm) for (const mm of bm[1].matchAll(/([A-Za-z_][\w]*)\s*:\s*([\d.]+)/g)) base[mm[1]] = Number(mm[2]);
  const mode = /mode\s*:\s*['"](roleplay|creation|write)['"]/.test(t)
    ? t.match(/mode\s*:\s*['"](roleplay|creation|write)['"]/)[1] : 'creation';

  const axes = keys.map(({key,label}) => {
    const a = archetypeOf(label);
    return { id:key, name:label, dpp:a.dpp, cap:a.cap, bias:a.bias, kw:[label, ...a.kw.filter(k=>k.length>1)].slice(0,8) };
  });
  // 指纹必须含 label：多世界 key 序列相同（如斗罗/遮天），仅 label 不同；只用 key 会误匹配
  rules[id] = { name:worldNameOf(id), mode, axes, baseAttributes:base,
    fingerprint: keys.map(k=>k.key+'|'+k.label).join(',') };
}

const banner = `/* 云境 · 世界规则档 WorldRules（自动生成，勿手改）\n * 由 scripts/gen-world-rules.mjs 从 configs/*.js 抽取 statKeys/baseAttributes 生成。\n * 新增世界后重跑该脚本即可自动纳入；已生成的世界数值不受影响。\n * window.WorldRules.currentAxes() 供 attribute-engine 读取每世界专属维度。\n */\n`;
const body = `(function(){
"use strict";
var REGISTRY = ${JSON.stringify(rules, null, 1)};
var FP_MAP = {};
Object.keys(REGISTRY).forEach(function(id){ FP_MAP[REGISTRY[id].fingerprint] = id; });

function configOf(cfg){
  cfg = cfg || (window.GenreStoryConfig || {});
  return cfg;
}
function fingerprintOf(cfg){
  cfg = configOf(cfg);
  if (!cfg || !Array.isArray(cfg.statKeys) || !cfg.statKeys.length) return '';
  /* key|label 联合指纹：多世界共用同一套 key（body/comprehension...），仅 label 区分 */
  return cfg.statKeys.map(function(k){ return k.key + '|' + (k.label||''); }).join(',');
}
function current(){
  var fp = fingerprintOf();
  var id = FP_MAP[fp];
  return id ? REGISTRY[id] : null;
}
/* 动态发现：新世界只要有 statKeys，即使未重跑生成器也能即时生成维度档 */
function derive(cfg){
  cfg = configOf(cfg);
  if (!cfg || !Array.isArray(cfg.statKeys)) return null;
  var ARCH = ${JSON.stringify(ARCHETYPES)};
  var axes = cfg.statKeys.map(function(s){
    var key = s.key, label = s.label || key, l = String(label).toLowerCase(), a = {id:'generic',dpp:50,cap:15,bias:'该维度主导的同类行动天然占优',kw:[]};
    outer: for (var i=0;i<ARCH.length;i++) for (var j=0;j<ARCH[i].kw.length;j++)
      if (l.indexOf(ARCH[i].kw[j].toLowerCase())>=0){ a=ARCH[i]; break outer; }
    return {id:key,name:label,dpp:a.dpp,cap:a.cap,bias:a.bias,kw:[label].concat(a.kw.slice(0,6))};
  });
  return {name:'新世界',mode:cfg.mode||'roleplay',axes:axes,baseAttributes:cfg.baseAttributes||{},fingerprint:fingerprintOf(cfg),derived:true};
}
function currentAxes(){
  var r = current();
  if (r && r.axes && r.axes.length) return r.axes;
  var d = derive();
  return d && d.axes && d.axes.length ? d.axes : null;
}
function axesFor(cfg){
  r = current(); if (r && r.axes && r.axes.length) return r.axes;
  var fp = fingerprintOf(cfg); var id = FP_MAP[fp];
  if (id) return REGISTRY[id].axes;
  var d = derive(cfg); return d ? d.axes : null;
}
window.WorldRules = {
  version: '1.0.0', worldCount: Object.keys(REGISTRY).length,
  REGISTRY: REGISTRY, current: current, currentAxes: currentAxes,
  axesFor: axesFor, fingerprintOf: fingerprintOf, derive: derive
};
})();\n`;

fs.writeFileSync(OUT, banner + body, 'utf8');
console.log('已生成', OUT);
console.log('世界数:', Object.keys(rules).length);
for (const [id,r] of Object.entries(rules)) console.log('  ' + id.padEnd(22) + r.axes.map(a=>a.name).join('/'));
