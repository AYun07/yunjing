#!/usr/bin/env node
/**
 * v3.99.0 常驻条目收敛（低参数模型专用）
 *
 * 问题：新四界的 core.js 由子代理生成时把绝大部分条目写成 alwaysInclude:true，
 * 大主宰 96 条 / 元尊 59 条，合计 2.4 万字常驻。极低参数模型（8k~32k 上下文）
 * 装不下，PromptBudget 只能压缩或丢弃，结果是人物档案与铁律被挤掉 → 严重 OOC。
 *
 * 做法：只让「非它不可」的条目常驻——
 *   · 所有 priority=top 的铁律（防八股、原著忠实、世界观总纲、境界阶梯）
 *   · OOC 红线清单 / GM 自检清单（这两条是防跑偏的核心）
 *   · 主角位档案 / 势力格局 / 世界观总纲 / 境界阶梯
 * 其余人物、关系、地点、道具、技能条目一律转为检索条目（alwaysInclude:false）——
 * 它们仍在 knowledgeBase 里，玩家聊到谁、走到哪，BM25 就会把对应条目捞出来。
 *
 * 注意：转检索不代表丢失。core.js 的条目会和 ext.js 一起并入检索池。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const KB_DIR = '/workspace/yunjing/js/kb';
const GENRES = process.argv.slice(2).length ? process.argv.slice(2) : ['dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];

/** 必须常驻的标题特征（除 top 之外） */
const MUST_KEEP = [
  /OOC\s*红线/i,
  /自检清单/,
  /主角位/,
  /世界观总纲/,
  /境界阶梯/,
  /势力格局/,
  /防八股/,
  /原著忠实/,
  /联动边界/,
  /字数调节|篇幅/
];

function run(g) {
  const p = path.join(KB_DIR, `${g}.core.js`);
  if (!fs.existsSync(p)) return console.log(`${g}: 文件不存在，跳过`);
  const src = fs.readFileSync(p, 'utf8');
  const win = {};
  try {
    vm.runInNewContext(src, { window: win, console }, { filename: p });
  } catch (e) {
    return console.log(`${g}: 载入失败 ${e.message}`);
  }
  const arr = (win.KB_PRESETS || {})[g] || [];
  if (!arr.length) return console.log(`${g}: 无条目，跳过`);

  /* 行与条目一一对应：条目行以 {"title" 开头 */
  const lines = src.split('\n');
  const itemLineIdx = [];
  lines.forEach((ln, i) => {
    if (/^\s*\{"title"/.test(ln)) itemLineIdx.push(i);
  });
  if (itemLineIdx.length !== arr.length) {
    return console.log(`${g}: 行数(${itemLineIdx.length})与条目数(${arr.length})不匹配，跳过以免误改`);
  }

  let kept = 0;
  let converted = 0;
  arr.forEach((it, i) => {
    const isTop = it.priority === 'top';
    const byTitle = MUST_KEEP.some((re) => re.test(it.title || ''));
    const keep = isTop || byTitle;
    const li = itemLineIdx[i];
    let line = lines[li];
    if (keep) {
      kept += 1;
      /* 标题命中的补成 high（若原来是 medium 或空） */
      if (!isTop && it.priority !== 'high') {
        line = /"priority":"[^"]*"/.test(line)
          ? line.replace(/"priority":"[^"]*"/, '"priority":"high"')
          : line.replace(/"alwaysInclude":(true|false)/, '"alwaysInclude":true,"priority":"high"');
      } else if (!/"alwaysInclude"/.test(line)) {
        line = line.replace(/"title"/, '"alwaysInclude":true,"title"');
      }
    } else {
      converted += 1;
      line = line.replace(/"alwaysInclude":true/, '"alwaysInclude":false');
      line = line.replace(/"priority":"(top|high|medium|low)"/, '"priority":""');
    }
    lines[li] = line;
  });

  fs.writeFileSync(p, lines.join('\n'));

  /* 校验 */
  const win2 = {};
  vm.runInNewContext(fs.readFileSync(p, 'utf8'), { window: win2, console }, { filename: p });
  const arr2 = (win2.KB_PRESETS || {})[g] || [];
  const always = arr2.filter((x) => x.alwaysInclude === true);
  const chars = always.reduce((s, x) => s + String(x.content || '').length, 0);
  console.log(
    `${g.padEnd(18)} 共 ${String(arr2.length).padStart(3)} 条 → 常驻 ${String(always.length).padStart(2)} 条（${String(chars).padStart(5)} 字），转检索 ${converted} 条`
  );
  always.forEach((x) => console.log(`      · ${x.priority || '?'}  ${x.title}`));
}

GENRES.forEach(run);
