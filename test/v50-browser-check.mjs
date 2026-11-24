import { chromium } from 'playwright-core';
const URL = 'http://127.0.0.1:8931/studio.html';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000); // 等 lazy batch 加载

console.log('### v5.0.0 语义词缀引擎浏览器验证');
const r = await page.evaluate(() => {
  const out = {};
  out.se = !!window.SemanticEngine;
  out.be = !!window.BonusEngine;
  out.seVer = window.SemanticEngine && SemanticEngine.VERSION;
  out.beVer = window.BonusEngine && BonusEngine.VERSION;
  if (!out.se) return out;
  // 语意解读
  out.atk = SemanticEngine.interpret('锋锐无双')[0];
  out.def = SemanticEngine.interpret('坚壁')[0];
  out.explicit = SemanticEngine.interpret('裂空 +9攻击')[0];
  // 动态生成：异情境不同
  const c1 = SemanticEngine.contextOf({ genre: 'fanrenxiuxian', round: 5, diceSeed: 7, inBattle: false, ownerName: '玄铁剑' });
  const c2 = SemanticEngine.contextOf({ genre: 'fanrenxiuxian', round: 9, diceSeed: 42, inBattle: true, ownerName: '玄铁剑' });
  out.gen1 = SemanticEngine.generate(c1, 3, '玄铁剑').map(a => a.name).join(',');
  out.gen2 = SemanticEngine.generate(c2, 3, '玄铁剑').map(a => a.name).join(',');
  // 自定义入口 + 净值
  const v = window.storyFramework.storyState.variables;
  v['装备'] = { '武器': '玄铁重剑' };
  BonusEngine.recompute();
  out.before = BonusEngine.netMods().sources.filter(s => s.value === 9).length;
  BonusEngine.customAffix('gear:玄铁重剑', '裂空 +9攻击');
  BonusEngine.recompute();
  out.after = BonusEngine.netMods().sources.filter(s => s.value === 9 && s.stat === 'atk').length;
  out.editorFn = typeof BonusEngine.openAffixEditor === 'function';
  // 打开编辑器 UI，检查预览渲染
  BonusEngine.openAffixEditor('gear:玄铁重剑', { title: '测试' });
  const mask = document.getElementById('semAffixMask');
  const ta = document.getElementById('semAffixText');
  out.maskShown = !!(mask && mask.style.display === 'flex');
  if (ta) { ta.value = '锋锐 +5攻击 疾风步'; ta.oninput && ta.oninput(); }
  const prev = document.getElementById('semAffixPreview');
  out.previewHTML = prev ? prev.innerHTML : '';
  BonusEngine.closeAffixEditor();
  // 清理自定义
  BonusEngine.customAffix('gear:玄铁重剑', null);
  return out;
});

ok(r.se, '语义引擎全局挂载');
ok(r.be, '加成引擎全局挂载');
ok(r.seVer === '5.0.0' && r.beVer === '5.0.0', '版本均 5.0.0（' + r.seVer + '/' + r.beVer + '）');
ok(r.atk && r.atk.stat === 'atk', '「锋锐无双」语意→攻击');
ok(r.def && r.def.stat === 'def', '「坚壁」语意→防御');
ok(r.explicit && r.explicit.stat === 'atk' && r.explicit.value === 9 && r.explicit.source === 'explicit', '「+9攻击」显式优先');
ok(r.gen1 !== r.gen2, '异情境生成不同词条（动态涌现）');
ok(r.before === 0 && r.after === 1, '自定义词条进入净值、清除前正确结算');
ok(r.editorFn && r.maskShown, '自定义编辑器 UI 可打开');
ok(r.previewHTML.indexOf('攻击') >= 0 || r.previewHTML.indexOf('速度') >= 0, '编辑器实时预览显示语意解读');
ok(errors.length === 0, '零控制台报错（' + errors.length + '）');
if (errors.length) errors.slice(0, 5).forEach(e => console.error('    ! ' + e));

await browser.close();
console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
if (fail > 0) process.exit(1);
