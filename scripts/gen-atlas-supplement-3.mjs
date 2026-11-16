/* 云境 v3.95.0 · 舆图第三批大规模补录（严格审定 + 出处行校验）
 *
 * 背景：v3.94 覆盖率 20%（1510 专名只上图 306）。第二批只补 42 条，过于保守。
 * 本批把 configs 原著设定章节里「有明确出处、确实是机构/地理专名」的缺口尽量补齐，
 * 同时把 earth 界换成真实城市经纬度落点（不补虚构地名）。
 *
 * 审定规则：
 *   1. 沿用 atlas-accuracy.mjs 的专名抽取口径（章节限定 + 后缀 + BAD 词表）；
 *   2. 词干不含虚词/句法词，不含年份数字，不含提示词腔用语；
 *   3. 必须在 configs 里找到包含该专名的出处行（长度 ≥ 10），否则丢弃；
 *   4. 每界上限 50 条，按出处命中数降序（出现越多越可能是真专名）；
 *   5. earth 单独走真实城市表（lon/lat），抽象/类型世界不补。
 *
 * 用法：node gen-atlas-supplement-3.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = '/workspace/yunjing';
const DRY = process.argv.includes('--dry');

global.window = {};
require(path.join(ROOT, 'js/faction-atlas-data.js'));
require(path.join(ROOT, 'js/atlas-supplement.js'));
const FA = global.window.FACTION_ATLAS;
const SUPP = global.window.ATLAS_SUPPLEMENT || {};

const BAD = /(写作|伏笔|三幕|节奏|读者|视角|对白|爽点|描写|结构|弧光|塑造|运营|定稿|开篇|节拍|经济|经营|财政|产业|态度|困境|征兆|功能|布局|空间|划分|显性|隐性|传承|门规|仪轨|分野|读法|悟性|关系|互动|分析|研究|指南|手册|速造|原则|方法|技巧|如何|怎么|为何|浅析|漫谈|杂谈|考据|设定|时间线|世界观|生态|格局|体系|概况|简介|介绍|档案|名录|考|辨析|演变|流变|分类|种类|类型|特点|特征|意义|影响|作用|价值|逻辑|机制|原理|规律|现象|问题|误区|清单|盘点|汇总|整理|漕运|盐政|军政|军务|吏治|乡绅|宗族|大赦|逃犯|官场|朝堂|学$|论$|法$|志$|史$|的|者$|能力|等级|阶|体系|修炼|功法|法宝|丹药|符|阵|灵根|血脉|基因|科技|武器|货币|通货|语言|文字|历史|事件|战争|战役|人物|主角|配角|玩家)/;
const NAME_RE = /[\u4e00-\u9fa5A-Za-z0-9]{1,8}(?:宗|门派|宗门|门|派|教|殿|盟|会|阁|府|军|国|朝|族|帮|寺|观|司|局|廷|宫|城|谷|山|海|域|洲|大陆|镇|村|岛|峰|岭|原|荒漠|禁地|遗迹|圣地|学院|组织|集团|家族|议会|部落|兵团|联盟|帝国|王朝|世家|商队|镖局|公会|星域|位面|界|塔|楼|庄|堡|营|寨|驿|港|关|郡|州|府衙|神殿|教廷|神庭)/g;
const SEC_RE = /(?:^|\n)##[^\n]*(?:势力|地图|组织|阵营|格局|谱系|文明|种族)[^\n]*\n([\s\S]{0,4000}?)(?=\n##|\n#\s|$)/g;

/* 词干里的虚词/句法词：出现即判为「从句子里误切出来的片段」，不是专名 */
const STEM_BAD = /(?:不|没|无|只|应|该|会|肯|帮|是|有|的|与|却|将|把|被|让|从|对|为|以|于|之|其|这|那|又|亦|或|及|而|则|但|很|更|最|再|已|未|曾|可|要|能|得|着|过|还|就|都|也|又|并|且|虽|因|故|若|如|比|足|设|称|司|专|归|属|另|各|某|本|每|数|答应|熟人|选择|现实|还原|玩家|正文|输出|剧情|应该|自由开局|太少|跨国|邻里|对面|同乡|伤病|刚设|不钉)/;
/* 明显是通用名词而非原著专名 */
const GENERIC = new Set([
  '城堡', '草原', '乡村', '小国', '旧城', '首都', '行会', '钱庄', '断头台', '邻里营', '首都与大城', '同乡会', '大王城',
  '国', '朝', '族', '界', '城', '山', '海', '域', '洲', '镇', '村', '岛', '门', '派', '宗', '教', '殿', '盟', '会', '阁', '府', '军', '帮', '寺', '观', '司', '局', '廷', '宫', '塔', '楼', '庄', '堡', '营', '寨', '驿', '港', '关', '郡', '州',
  /* 泛指方位 / 通用机构 / 从句子里误切的片段 / 人名，都不是地图地标 */
  '世界', '中国', '朝廷', '学府', '至今城', '东域', '西域', '南域', '北域', '中域', '两界', '上国', '疆国',
  '人族', '妖族', '虫族', '魔族', '兽族', '神族', '龙族', '鬼族', '附庸族', '人皇界', '罗峰', '跨国',
  '自由开局', '现实还原', '选择太少', '熟人肯帮', '答应帮', '对面茶楼', '伤病会', '邻里营', '刚设郡',
  '不钉在一国', '只有部族', '没有固定营', '断头台与新大陆', '首都与大城',
]);
const SUFFIXES = ['门派', '宗门', '大陆', '荒漠', '禁地', '遗迹', '圣地', '学院', '组织', '集团', '家族', '议会', '部落', '兵团', '联盟', '帝国', '王朝', '世家', '商队', '镖局', '公会', '星域', '位面', '神殿', '教廷', '神庭', '府衙', '宗', '门', '派', '教', '殿', '盟', '会', '阁', '府', '军', '国', '朝', '族', '帮', '寺', '观', '司', '局', '廷', '宫', '城', '谷', '山', '海', '域', '洲', '镇', '村', '岛', '峰', '岭', '原', '界', '塔', '楼', '庄', '堡', '营', '寨', '驿', '港', '关', '郡', '州'];

/* 抽象 / 类型世界：地图本就是抽象节点，没有原著专名，不补 */
const ABSTRACT = new Set(['free', 'freeworld', 'mystery', 'scifi', 'shenmifusu', 'lunhuileyuan']);
const MAX_PER_WORLD = 50;

/* earth 真实城市（经纬度），补进 ATLAS_SUPPLEMENT 走 geoXY 落点 */
const EARTH_CITIES = [
  /* 亚洲 */ ['成都', 104.07, 30.67], ['南京', 118.80, 32.06], ['杭州', 120.15, 30.27],
  ['洛阳', 112.45, 34.62], ['拉萨', 91.13, 29.65], ['中国香港', 114.17, 22.32], ['中国台北', 121.56, 25.04],
  ['东京', 139.69, 35.69], ['首尔', 126.98, 37.57], ['新加坡', 103.82, 1.35], ['曼谷', 100.50, 13.76],
  ['孟买', 72.88, 19.08], ['迪拜', 55.27, 25.20], ['德黑兰', 51.39, 35.69], ['耶路撒冷', 35.21, 31.77],
  /* 欧洲 */ ['雅典', 23.73, 37.98], ['马德里', -3.70, 40.42], ['里斯本', -9.14, 38.72],
  ['柏林', 13.40, 52.52], ['维也纳', 16.37, 48.21], ['布拉格', 14.44, 50.08], ['威尼斯', 12.33, 45.44],
  ['阿姆斯特丹', 4.90, 52.37], ['圣彼得堡', 30.34, 59.93], ['斯德哥尔摩', 18.07, 59.33],
  ['雷克雅未克', -21.94, 64.15],
  /* 非洲 */ ['亚历山大', 29.92, 31.20], ['内罗毕', 36.82, -1.29], ['拉各斯', 3.38, 6.52],
  ['约翰内斯堡', 28.05, -26.20],
  /* 美洲 */ ['波士顿', -71.06, 42.36], ['华盛顿', -77.04, 38.91], ['芝加哥', -87.63, 41.88],
  ['洛杉矶', -118.24, 34.05], ['多伦多', -79.38, 43.65], ['哈瓦那', -82.38, 23.11],
  ['波哥大', -74.07, 4.71], ['圣地亚哥', -70.67, -33.45], ['圣保罗', -46.63, -23.55],
  /* 大洋洲 */ ['墨尔本', 144.96, -37.81], ['奥克兰', 174.76, -36.85],
];

function typeOf(n) {
  if (/(?:宗|门|派|教|殿|盟|会|阁|府|军|族|帮|寺|观|司|局|廷|宫|学院|组织|集团|家族|议会|部落|兵团|联盟|帝国|王朝|世家|商队|镖局|公会|神殿|教廷|神庭)$/.test(n)) return 'sect';
  if (/(?:城|镇|村|岛|港|关|郡|州|堡|寨|营|驿|庄|楼|塔)$/.test(n)) return 'city';
  return 'wild';
}

function sourceLine(cfg, n) {
  const lines = cfg.split('\n');
  const hit = lines.find((l) => l.includes(n) && l.trim().length >= 10 && !/(?:应该|选择太少|玩家|正文输出|描写|剧情需要|设定里)/.test(l));
  return hit ? hit.trim().replace(/^\s*(?:\d+[.、)]\s*|[-•*]\s*)/, '').slice(0, 150) : '';
}

const genres = fs.readdirSync(path.join(ROOT, 'configs')).filter((f) => f.endsWith('-config.js')).map((f) => f.replace('-config.js', '')).sort();
/* 幂等：先剥掉上一次脚本写入的第三批 / 真实城市条目，再重新审定合并 */
const result = {};
for (const [g, arr] of Object.entries(SUPP)) {
  result[g] = (arr || []).filter((x) => !/第三批|真实世界城市 · 经纬度落点/.test(String((x && x.c) || '')));
}
let added = 0;
const report = [];

for (const g of genres) {
  if (ABSTRACT.has(g)) { report.push([g, 0, '抽象图·不适用']); continue; }
  const cfg = fs.readFileSync(path.join(ROOT, 'configs', `${g}-config.js`), 'utf8');

  if (g === 'earth') {
    const exist = new Set((result[g] || []).map((x) => x.n));
    const items = EARTH_CITIES.filter(([n]) => !exist.has(n)).map(([n, lon, lat]) => ({
      n, t: 'city', anchor: '', lon, lat,
      c: '真实世界城市 · 经纬度落点（v3.95.0）',
      desc: `${n}：真实世界城市，按经纬度 ${lon.toFixed(2)}° / ${lat.toFixed(2)}° 投影落到世界地图。`,
    }));
    result[g] = (result[g] || []).concat(items);
    added += items.length;
    report.push([g, items.length, '真实城市经纬度']);
    continue;
  }

  /* 章节限定抽取 */
  let sec = '', m;
  const secRe = new RegExp(SEC_RE.source, 'g');
  while ((m = secRe.exec(cfg))) sec += m[1] + '\n';
  if (!sec) sec = cfg;
  const terms = new Set();
  const re = new RegExp(NAME_RE.source, 'g');
  let t;
  while ((t = re.exec(sec))) {
    const n = t[0];
    if (n.length < 2 || n.length > 8 || BAD.test(n)) continue;
    if (/^[一二三四五六七八九十百千万数各某这那本全每]/.test(n)) continue;
    if (/\d|年|月|日/.test(n)) continue;
    if (GENERIC.has(n) || STEM_BAD.test(n)) continue;
    /* 词干必须干净：去掉后缀后不含虚词 */
    const suf = SUFFIXES.find((s) => n.endsWith(s)) || '';
    const stem = n.slice(0, n.length - suf.length);
    if (stem.length < 1 || stem.length > 6 || STEM_BAD.test(stem)) continue;
    terms.add(n);
  }
  const names = ((FA[g] && FA[g].names) || []).concat((result[g] || []).map((x) => x.n));
  const cand = [...terms].filter((n) => !names.some((x) => x === n || x.includes(n) || n.includes(x)));
  /* 出处命中数降序，取前 MAX_PER_WORLD */
  const scored = cand.map((n) => ({ n, hits: cfg.split(n).length - 1, desc: sourceLine(cfg, n) }))
    .filter((x) => x.desc && x.hits >= 1)
    .sort((a, b) => b.hits - a.hits || a.n.length - b.n.length)
    .slice(0, MAX_PER_WORLD);
  const items = scored.map((x) => ({
    n: x.n, t: typeOf(x.n), anchor: '',
    c: `原著设定补录·第三批 · configs/${g}-config.js`,
    desc: `${x.n}：${x.desc}`,
  }));
  result[g] = (result[g] || []).concat(items);
  added += items.length;
  report.push([g, items.length, `候选 ${cand.length} / 审定 ${items.length}`]);
}

console.log('=== 第三批补录审定 ===');
report.forEach(([g, n, note]) => console.log(`  ${g.padEnd(20)} +${String(n).padStart(3)}  ${note}`));
const total = Object.values(result).reduce((a, v) => a + v.length, 0);
console.log(`\n本批新增 ${added} 条，补录总量 ${total} 条，覆盖 ${Object.keys(result).length} 界`);
if (DRY) { console.log('[dry] 未写入'); process.exit(0); }

const head = `/* 云境 v3.95.0 · 33 界舆图补录（第一批 147 条 + 第二批审定 42 条 + 第三批严格审定 ${added} 条 / earth 真实城市经纬度）
 * 每条含：n 名称 / t 类型 / anchor 锚定到的本界已有地标 / desc 原著出处摘录 / c 来源；
 * earth 条目含 lon / lat 真实经纬度，由 atlas-panel.js 的 injectSupplement() 走 geoXY() 落点。
 * 第三批审定规则见 gen-atlas-supplement-3.mjs：章节限定抽取 + 词干虚词过滤 + 出处行校验 + 每界上限 50。
 * 运行时按锚点避让追加到对应层，不改动原始 ATLAS_DATA，可整体回滚。生成时间：${new Date().toISOString()}
 * 抽象/类型世界（free / freeworld / mystery / scifi / shenmifusu / lunhuileyuan）无原著专名，不补录。
 */
`;
const body = `(function () {\n  "use strict";\n  window.ATLAS_SUPPLEMENT = ${JSON.stringify(result)};\n})();\n`;
fs.writeFileSync(path.join(ROOT, 'js/atlas-supplement.js'), head + body);
console.log('已写入 js/atlas-supplement.js');
