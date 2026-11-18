import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('JS: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errs.push('console: ' + m.text()); });
const log = (...a) => console.log(...a);

try {
  log('\n【1】打开创作室，等 SaveCodec / SaveSlots 就绪');
  await p.goto(BASE + 'studio.html');
  await p.waitForFunction(() => window.SaveCodec && window.SaveSlots, { timeout: 15000 });
  log('  SaveCodec:', await p.evaluate(() => window.SaveCodec && window.SaveCodec.version));
  log('  gzip 支持:', await p.evaluate(() => window.SaveCodec.hasGzip()));

  log('\n【2】gzip 压缩比测试（模拟 5000 楼正文）');
  const zip = await p.evaluate(async () => {
    const floor = '第【N】楼 · 云梦泽：少女踏云而来，星河倾泻如练，她轻声说道："这一界，便由你我共同书写。"远山楼阁半隐于雾，月光洒在翻涌的云海上，万象自此生长。';
    let s = '';
    for (let i = 0; i < 5000; i++) s += floor.replace('【N】', i);
    const raw = new TextEncoder().encode(s).length;
    const gz = await window.SaveCodec.gzip(s);
    const back = await window.SaveCodec.gunzip(gz.buffer);
    return { rawMB: (raw / 1048576).toFixed(2), gzMB: (gz.length / 1048576).toFixed(2),
      ratio: (gz.length / raw * 100).toFixed(1) + '%', roundtrip: back === s, raw };
  });
  log('  原始:', zip.rawMB, 'MB → gzip:', zip.gzMB, 'MB = ', zip.ratio);
  log('  解压往返一致:', zip.roundtrip ? '✅' : '❌');
  log('  达标(≤20%):', parseFloat(zip.ratio) <= 20 ? '✅' : '❌');

  log('\n【3】配置导出/导入 - 不含密钥');
  await p.evaluate(() => {
    localStorage.setItem('storyApiConfig', JSON.stringify({ endpoint: 'https://api.test.com/v1', model: 'test-model-x', apiKey: 'SECRET-KEY-123', maxTokens: 8192 }));
    if (window.storyFramework) window.storyFramework.apiConfig = { endpoint: 'https://api.test.com/v1', model: 'test-model-x', apiKey: 'SECRET-KEY-123', maxTokens: 8192 };
  });
  const noKey = await p.evaluate(() => window.SaveCodec.collectConfig(false));
  log('  采集(不含密钥):', JSON.stringify(noKey));
  log('  密钥已剔除:', noKey.apiKey === '' && noKey._keyIncluded === false ? '✅' : '❌');

  log('\n【4】配置恢复 - 清空后导入');
  const restored = await p.evaluate((cfg) => {
    localStorage.setItem('storyApiConfig', JSON.stringify({}));
    if (window.storyFramework) window.storyFramework.apiConfig = {};
    const r = window.SaveCodec.restoreConfig(cfg);
    const after = JSON.parse(localStorage.getItem('storyApiConfig') || '{}');
    return { r, after };
  }, noKey);
  log('  恢复结果:', JSON.stringify(restored.r));
  log('  端点已恢复:', restored.after.endpoint === 'https://api.test.com/v1' ? '✅' : '❌');
  log('  模型已恢复:', restored.after.model === 'test-model-x' ? '✅' : '❌');
  log('  密钥保持空(未覆盖):', !restored.after.apiKey && restored.r.keyNeeded ? '✅' : '❌');

  log('\n【5】含密钥导出/恢复');
  const withKey = await p.evaluate(() => {
    localStorage.setItem('storyApiConfig', JSON.stringify({ endpoint: 'https://api.test.com/v1', model: 'test-model-x', apiKey: 'SECRET-KEY-123', maxTokens: 8192 }));
    return window.SaveCodec.collectConfig(true);
  });
  const rk = await p.evaluate((cfg) => {
    localStorage.setItem('storyApiConfig', JSON.stringify({}));
    const r = window.SaveCodec.restoreConfig(cfg);
    return { r, after: JSON.parse(localStorage.getItem('storyApiConfig') || '{}') };
  }, withKey);
  log('  密钥已恢复:', rk.after.apiKey === 'SECRET-KEY-123' ? '✅' : '❌', '| keyRestored:', rk.r.keyRestored);

  log('\n========== 汇总 ==========');
  log('JS错误数:', errs.length, errs.join(' | '));
  const pass = zip.roundtrip && parseFloat(zip.ratio) <= 20 && noKey.apiKey === '' &&
    restored.after.endpoint === 'https://api.test.com/v1' && rk.after.apiKey === 'SECRET-KEY-123' && errs.length === 0;
  log('总判定:', pass ? '✅ 全部通过' : '❌ 有失败项');

} catch (e) { log('!!! 异常:', e.message, e.stack); }
finally { await b.close(); }
