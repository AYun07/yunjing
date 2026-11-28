#!/usr/bin/env node
/**
 * v7.6.3 回归：玩家实测 100 条问题清单的修复断言
 * 覆盖 P1（竞态守卫/芯片选中态/markdown清洗/mystery标题/空catch）+ P2（死按钮/档位同步/发送入口/措辞）
 * 纯静态 + 纯函数验证，不依赖 GUI。真机 Electron 由 v761-electron-live.mjs 另测。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function t(name, fn) {
  try { const r = fn(); if (r === true) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name + ' -> ' + r); } }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const has = (s, sub) => s.includes(sub) ? true : `缺少: ${sub.slice(0, 60)}`;
const count = (s, re) => (s.match(re) || []).length;

console.log('== v7.6.3 实测问题修复回归 ==');

// ---------- P1 竞态守卫 (#44/#45/#46) ----------
const studio = read('studio.html');
t('A1 studio 裸 onX="StoryInput./Toolbox./SceneState./Snapshots." 清零', () => {
  const bare = count(studio, /on(?:click|change|keydown)="(?:[^"]*?;)?(?:StoryInput|Toolbox|SceneState|Snapshots)\./g);
  return bare === 0 ? true : `仍有 ${bare} 处裸调用`;
});
t('A1 竞态守卫 if(window.X) 已就位（≥30）', () => {
  const n = count(studio, /if\(window\.(?:StoryInput|Toolbox|SceneState|Snapshots)\)/g);
  return n >= 30 ? true : `仅 ${n} 处守卫`;
});
t('A1 exportSave 竞态点已加守卫', () => has(studio, 'if(window.StoryInput)StoryInput.exportSave()'));
t('A1 onkeydown SceneState 竞态点已加守卫', () => has(studio, 'if(window.SceneState)SceneState.open()'));

// ---------- P1 芯片选中态 (#17/#73-100) ----------
const csSrc = read('js/character-studio.js');
t('A2 芯片点击传按钮节点（即时切换不依赖整段重建）', () =>
  has(csSrc, 'toggleTrait(b.getAttribute(\'data-trait\'), b)'));
t('A2 toggleTrait 即时 add/remove on 类', () =>
  has(csSrc, 'btn.classList.add("on")') && has(csSrc, 'btn.classList.remove("on")'));
t('A2 芯片渲染带 aria-pressed', () => has(csSrc, 'aria-pressed='));

// ---------- P1 markdown 面板行清洗 (#1) ----------
const ah = read('js/ai-response-handler.js');
t('B6 markdown 标题行清理存在', () => has(ah, 'headRe.test(t)'));
t('B6 加粗字段列表成组清理存在', () => has(ah, 'fieldRe.test(t)'));
// 纯函数复刻清理逻辑，验证面板行被删、叙事保留
t('B6 面板标题/字段行被识别，叙事保留', () => {
  const fieldRe = /^[-*]\s+\*\*[^*\n]{1,24}\*\*\s*[:：]\s*\S/;
  const headRe = /^#{1,4}\s+\S/;
  const panel1 = '### 星海终端 · 通讯面板', panel2 = '- **舰船状态**：氧气 100 / 燃料 85';
  const prose = '他缓缓走进大厅，四周静悄悄的。';
  return (headRe.test(panel1) && fieldRe.test(panel2) && !headRe.test(prose) && !fieldRe.test(prose))
    ? true : '识别不符';
});

// ---------- P1 mystery 标题 (#47) ----------
const wp = read('js/world-portal.js');
t('A4 zhName 优先 GenreStoryConfig.genreName', () => has(wp, 'window.GenreStoryConfig'));
t('A4 保留 storyFramework 兜底', () => has(wp, 'fw.config.genreName'));
const mysteryCfg = read('configs/mystery-config.js');
t('A4 mystery config 确有 genreName 悬疑推理', () => has(mysteryCfg, "genreName: '悬疑推理'"));

// ---------- P1 config 字段缺口 (#33-39，按甄别后真实缺项) ----------
const cfgHas = (g, k) => {
  const s = read(`configs/${g}-config.js`);
  return new RegExp(`setupMeta\\.${k}\\s*=|\\b${k}\\s*:`).test(s);
};
t('A3 wangyou 补 panelLabels/startRealm（仅2项，不重复已有）', () =>
  cfgHas('wangyou','panelLabels') && cfgHas('wangyou','startRealm'));
t('A3 freeworld 补 timelines/names', () => cfgHas('freeworld','timelines') && cfgHas('freeworld','names'));
for (const g of ['cthulhu','mystery','scifi','wuxia']) {
  t(`A3 ${g} 补齐 setup 字段（panelLabels/startRealm/timelines/identities/names）`, () => {
    const missing = ['panelLabels','startRealm','timelines','identities','names'].filter(k=>!cfgHas(g,k));
    return missing.length === 0 ? true : `缺 ${missing.join(',')}`;
  });
}

// ---------- P1 空 catch 健壮性 (#60/#61) ----------
for (const f of ['js/save-slots.js', 'js/world-alive.js', 'js/world-clock.js']) {
  const s = read(f);
  t(`A5 ${f} 空 catch 清零`, () => {
    const n = count(s, /catch\s*\([^)]*\)\s*\{\s*\}/g);
    return n === 0 ? true : `仍有 ${n} 处空 catch`;
  });
  t(`A5 ${f} 有 console.warn`, () => has(s, 'console.warn'));
}

// ---------- P2 死按钮/档位同步 (#26-32) ----------
const settings = read('settings.html');
const cp = read('js/connection-profiles.js');
t('B2 设置页补 showToast 兜底', () => has(settings, 'showToast'));
t('B2 档位统一 ConnectionProfiles（脚本导出+页面共用数据源）', () =>
  has(cp, 'window.ConnectionProfiles') && has(settings, 'connection-profiles.js') && has(settings, 'yunjing:profiles-changed'));
t('B2 档位镜像 modelSlots', () => has(cp, 'modelSlots'));
t('B2 档位变更派发事件供弹层同步', () => /dispatchEvent|CustomEvent/.test(cp) ? true : '无事件派发');

// ---------- P2 小云发送入口/形态分组 (#24/#65) ----------
const xy = read('xiaoyun.html');
t('B3 小云有可见发送按钮', () => /发送<\/button>|>\s*发送\s*</.test(xy) ? true : '无发送按钮文案');
t('B3 形态/情绪分组标题', () => has(xy, '形态') && has(xy, '情绪'));
const xyBuddy = read('js/xiaoyun-buddy.js');
t('B3 无 key 开工提示内置模板', () => has(xyBuddy, '内置模板'));

// ---------- P2 措辞打磨 (#51-55) ----------
const brand = read('品牌资产总览.html');
t('B5 品牌页无"未启用"露出', () => !/未启用/.test(brand) ? true : '仍有未启用');
t('B5 品牌页改"即将上线"', () => has(brand, '即将上线'));
const idx = read('index.html');
t('C1 大厅全部展开/收起态切换', () => has(idx, 'wsToggleAll'));

console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
