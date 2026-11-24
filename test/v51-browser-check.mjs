// 云境 v5.1.0 真浏览器验证：本地+大模型双重解读
// 重点：真实调用一次 agnes-3.0-flash，验证大模型解读回填
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const KEY = fs.readFileSync('/root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d59-9760f4f1c000/llm_api_key.txt', 'utf8').trim();
const ENDPOINT = 'https://apihub.agnes-ai.com/v1';
const MODEL = 'agnes-3.0-flash';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://127.0.0.1:8931/studio.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

console.log('\n### 1. 模块加载与版本');
const mods = await page.evaluate(() => ({
  se: !!window.SemanticEngine, be: !!window.BonusEngine,
  seVer: window.SemanticEngine && window.SemanticEngine.VERSION,
  beVer: window.BonusEngine && window.BonusEngine.VERSION,
  yjVer: window.YJ_VER
}));
ok(mods.se && mods.be, '语义引擎 + 加成引擎均已挂载');
ok(mods.seVer === '5.1.0' && mods.beVer === '5.1.0', '版本 5.1.0（se=' + mods.seVer + ' be=' + mods.beVer + '）');
ok(mods.yjVer === '5.1.0', 'YJ_VER 5.1.0 同源');

console.log('\n### 2. 本地语意解读（保底）');
const local = await page.evaluate(() => {
  window.SemanticEngine.llmClear();
  const a = window.SemanticEngine.interpret('锋锐无双');
  return { len: a.length, stat: a[0] && a[0].stat, source: a[0] && a[0].source };
});
ok(local.len > 0 && local.stat === 'atk', '本地把「锋锐无双」解读为攻击');

console.log('\n### 3. 真实模型调用一次（agnes-3.0-flash）');
const real = await page.evaluate(async (cfg) => {
  // 注入真实模型配置到主 API
  window.storyFramework.apiConfig = { type: 'openai', endpoint: cfg.endpoint, apiKey: cfg.key, model: cfg.model };
  window.SemanticEngine.setLLMEnabled(true);
  window.SemanticEngine.llmClear();
  const text = '星陨灭世斩';
  // 先本地
  const before = window.SemanticEngine.interpret(text);
  const r = await window.SemanticEngine.enrich([text]);
  const after = window.SemanticEngine.interpret(text);
  return {
    beforeSource: before[0] && before[0].source,
    result: r,
    after: after.map(a => ({ stat: a.stat, value: a.value, source: a.source, by: a.by, desc: a.desc }))
  };
}, { endpoint: ENDPOINT, key: KEY, model: MODEL });
console.log('   真实返回：' + JSON.stringify(real.result) + ' 解读=' + JSON.stringify(real.after));
ok(real.beforeSource !== 'llm', '首次为本地解读');
ok(real.result.source === 'llm' || real.result.source === 'error', '发起真实模型请求（source=' + real.result.source + '）');
ok(real.result.done >= 1, '真实模型解读成功回填缓存（done=' + real.result.done + '）');
ok(real.after.length > 0 && real.after[0].source === 'llm', 'interpret 命中大模型缓存');
ok(real.after[0].by === MODEL, '记录真实模型名');

console.log('\n### 4. 加成层消费大模型结果');
const bonus = await page.evaluate(() => {
  window.BonusEngine.refresh();
  const net = window.BonusEngine.netMods();
  return {
    llmSources: window.BonusEngine.stats().llmSources,
    pending: window.BonusEngine.collectPendingTexts(),
    block: window.BonusEngine.buildPromptBlock()
  };
});
ok(Array.isArray(bonus.pending), 'collectPendingTexts 可用');

console.log('\n### 5. 开关与降级');
const toggle = await page.evaluate(async () => {
  window.SemanticEngine.setLLMEnabled(false);
  const off = window.SemanticEngine.llmEnabled();
  const r = await window.SemanticEngine.enrich(['全新文本abc']);
  window.SemanticEngine.setLLMEnabled(true);
  return { off, source: r.source };
});
ok(toggle.off === false && toggle.source === 'off', '关闭后不发请求（source=' + toggle.source + '）');

console.log('\n### 6. 零控制台报错');
ok(errors.length === 0, '无 console/page 报错（' + errors.length + '）' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));

await browser.close();
console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
if (fail > 0) process.exit(1);
