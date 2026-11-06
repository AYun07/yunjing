// 给 5 个天蚕土豆世界写入「大千世界宇宙」联动段（YJ_SEQUEL），让它们彼此可检索互引。
import fs from 'node:fs';
import path from 'node:path';
const KB_DIR = path.resolve(import.meta.dirname, '../js/kb');
const VER = 'v3.98.0';

const START = '/* YJ_SEQUEL_START */';
const END = '/* YJ_SEQUEL_END */';

// 五个世界的核心人物与定位（按原著核对，禁止编造血缘）
const HERO = {
  doupocangqiong: { 主角: '萧炎', 尊号: '炎帝', 境界: '斗帝', 定位: '斗气大陆崛起，晋斗帝，为炎帝，大千世界巅峰强者之一' },
  wudongqiankun: { 主角: '林动', 尊号: '武祖', 境界: '祖境', 定位: '自青阳镇崛起，吞八大祖符、战异魔皇，晋祖境，号武祖' },
  dazhuzai: { 主角: '牧尘', 尊号: '主宰', 境界: '主宰境', 定位: '大千世界第一人，牧府之主，曾率大千盟约迎战域外邪族之主天邪神' },
  yuanzun: { 主角: '周元', 尊号: '周元始祖', 境界: '神祇', 定位: '更早时代的先辈，成神祇号周元始祖，破圣族（圣神）之困，其时代远在斗破/武动/大主宰之前' },
  wanxiangzhiwang: { 主角: '李洛', 尊号: '（洛岚府/天王脉）', 境界: '称王/天王境', 定位: '大夏洛岚府遗孤，李太玄与澹台岚之子；为牧尘洛璃一脉同宇宙晚辈强者（非牧尘亲子）' },
};

const OVERVIEW = (g) => ({
  title: '天蚕土豆 · 大千世界宇宙总览（跨作品联动）',
  content: '天蚕土豆的《斗破苍穹》《武动乾坤》《大主宰》《元尊》《万相之王》同属一个宏大宇宙——大千世界。五作以「炎帝萧炎 / 武祖林动 / 主宰牧尘 / 周元始祖 / 洛岚府李洛」为各代之巅，人物与势力在大千世界的更高层面彼此呼应：牧尘主导的大千盟约曾邀炎帝、武祖等共抗域外邪族之主天邪神；元尊时代的圣神黑卵正是天邪神一脉的远祖祸源；万相之王则是大主宰之后的晚辈世代。本界知识库只载本作原著设定，跨作联动仅作「同宇宙背景呼应」，不把别作人物写入本作剧情。',
  category: '同宇宙联动',
  tags: ['同宇宙联动', '大千世界', '天蚕土豆', '炎帝', '武祖', '主宰', '周元始祖'],
});

const LINK = (g, other) => {
  const h = HERO[other];
  const map = {
    doupocangqiong: `《武动乾坤》《大主宰》的林动（武祖）、牧尘（主宰）与萧炎同列大千世界巅峰；萧炎曾以炎帝之身助牧尘迎战天邪神。`,
    wudongqiankun: `林动（武祖）与萧炎（炎帝）、牧尘（主宰）同列大千世界巅峰，曾跨界共抗域外邪族；其时代在元尊之后、大主宰之前。`,
    dazhuzai: `牧尘（主宰）主导大千盟约，邀炎帝萧炎、武祖林动共抗天邪神；其父牧锋源自大千世界，与元尊周元始祖、万相之王李洛同属一脉宇宙的后辈传奇。`,
    yuanzun: `周元（周元始祖）时代远早于其余四作，所破之圣神黑卵正是《大主宰》域外邪族之主天邪神一脉的远祖祸源；成神祇后号周元始祖，为后世大千世界的先辈根基。`,
    wanxiangzhiwang: `李洛为《大主宰》牧尘、洛璃一脉的同宇宙晚辈强者（其父李太玄、母澹台岚，非牧尘亲子），时代在牧尘之后；与炎帝、武祖、周元始祖同属大千世界宇宙的代际呼应。`,
  };
  return {
    title: `同宇宙联动 · ${h.主角}（${h.尊号}，《${worldName(other)}》`,
    content: `《${worldName(other)}》主角${h.主角}，尊号${h.尊号}，终至${h.境界}，定位：${h.定位}。本作与之的呼应：${map[other]}（仅作同宇宙背景，不写入本作剧情与人物卡）。`,
    category: '同宇宙联动',
    tags: ['同宇宙联动', worldName(other), h.主角, h.尊号],
  };
};

function worldName(g) {
  return { doupocangqiong: '斗破苍穹', wudongqiankun: '武动乾坤', dazhuzai: '大主宰', yuanzun: '元尊', wanxiangzhiwang: '万相之王' }[g];
}

const worlds = Object.keys(HERO);
for (const g of worlds) {
  const others = worlds.filter((x) => x !== g);
  const entries = [OVERVIEW(g), ...others.map((o) => LINK(g, o))];
  const payload = entries.map((e) => ({
    title: String(e.title || '').trim(),
    content: String(e.content || '').trim(),
    category: String(e.category || '同宇宙联动').trim(),
    tags: Array.from(new Set([...(e.tags || []), g, '同宇宙联动'])),
  })).filter((e) => e.title && e.content);

  const block = `${START}\n/* 云境 ${VER} · 大千世界宇宙联动（由 scripts/gen-universe-link.mjs 写入，幂等） */\n(function(){\n  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});\n  var a = KB[${JSON.stringify(g)}] || (KB[${JSON.stringify(g)}] = []);\n  var add = ${JSON.stringify(payload)};\n  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });\n  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });\n  window.__KB_SEQUEL_OK__ = true;\n})();\n${END}\n`;

  const extPath = path.join(KB_DIR, `${g}.ext.js`);
  let src = fs.readFileSync(extPath, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i !== -1 && j !== -1 && j > i) src = src.slice(0, i) + block + src.slice(j + END.length).replace(/^\r?\n/, '');
  else src = src.replace(/\s*$/, '\n\n') + block;
  fs.writeFileSync(extPath, src);
  console.log(`${g}: 写入 ${payload.length} 条联动（概览+${payload.length - 1} 部互引）`);
}
console.log('done');
