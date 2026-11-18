import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const log = (...a) => console.log(...a);

try {
  log('\n【1】打开创作室，建一个测试存档 + 配置');
  await p.goto(BASE + 'studio.html');
  await p.waitForFunction(() => window.SaveSlots && window.SaveCodec, { timeout: 15000 });
  await p.evaluate(() => {
    localStorage.setItem('storyApiConfig', JSON.stringify({ endpoint: 'https://e2e.test/v1', model: 'e2e-model', apiKey: 'E2E-SECRET', maxTokens: 4096 }));
    if (window.storyFramework) window.storyFramework.apiConfig = { endpoint: 'https://e2e.test/v1', model: 'e2e-model', apiKey: 'E2E-SECRET', maxTokens: 4096 };
    localStorage.setItem('storySave_free', JSON.stringify({ variables: { title: 'E2E测试书', chapter: 3 }, conversationHistory: [
      { role: 'user', content: '测试正文1' }, { role: 'assistant', content: '测试正文2' }
    ], isStoryStarted: true }));
  });
  // 造一条槽位注册表
  await p.evaluate(() => { if (window.SaveSlots && window.SaveSlots.list) window.SaveSlots.list(); });

  log('\n【2】不勾选含密钥，导出单档');
  await p.evaluate(() => window.SaveSlots.setIncludeKey(false));
  const dl1 = p.waitForEvent('download', { timeout: 10000 });
  await p.evaluate(() => window.SaveSlots.exportSlot('main'));
  const d1 = await dl1;
  const f1 = '/tmp/e2e_nok.json.gz';
  await d1.saveAs(f1);
  const b1 = fs.readFileSync(f1);
  log('  下载文件名:', d1.suggestedFilename());
  log('  文件魔数(应1f8b=gzip):', b1[0].toString(16), b1[1].toString(16));
  log('  文件大小:', (b1.length / 1024).toFixed(1), 'KB');

  log('\n【3】解压检查包内 config');
  const cfg1 = await p.evaluate(async (buf) => {
    const txt = await window.SaveCodec.gunzip(new Uint8Array(buf).buffer);
    const pkg = JSON.parse(txt);
    return { config: pkg.config, hasSave: !!pkg.save, keys: Object.keys(pkg) };
  }, Array.from(b1));
  log('  包字段:', cfg1.keys.join(','));
  log('  包内config:', JSON.stringify(cfg1.config));
  log('  不含密钥:', cfg1.config.apiKey === '' && cfg1.config._keyIncluded === false ? '✅' : '❌');

  log('\n【4】清空配置后用 importSlot 导入 → 恢复端点/模型');
  await p.evaluate(() => { localStorage.setItem('storyApiConfig', JSON.stringify({})); if (window.storyFramework) window.storyFramework.apiConfig = {}; });
  // 用 DataTransfer 构造 File 塞进 input，触发真实 onchange
  await p.evaluate(async (buf) => {
    const bytes = new Uint8Array(buf);
    const file = new File([bytes], 'restore.json.gz', { type: 'application/gzip' });
    const dt = new DataTransfer(); dt.items.add(file);
    window.__e2eFile = file;
    await window.SaveSlots.importSlot(file);
  }, Array.from(b1));
  await p.waitForTimeout(1000);
  const cfg2 = await p.evaluate(() => JSON.parse(localStorage.getItem('storyApiConfig') || '{}'));
  log('  导入后配置:', JSON.stringify(cfg2));
  log('  端点恢复:', cfg2.endpoint === 'https://e2e.test/v1' ? '✅' : '❌');
  log('  模型恢复:', cfg2.model === 'e2e-model' ? '✅' : '❌');
  log('  密钥未覆盖(空):', !cfg2.apiKey ? '✅' : '❌');

  log('\n========== 汇总 ==========');
  log('JS错误数:', errs.length, errs.join(' | '));
  const ok = b1[0] === 0x1f && b1[1] === 0x8b && cfg1.config.apiKey === '' &&
    cfg2.endpoint === 'https://e2e.test/v1' && cfg2.model === 'e2e-model' && !cfg2.apiKey && errs.length === 0;
  log('端到端判定:', ok ? '✅ 全部通过' : '❌ 有失败项');

} catch (e) { log('!!! 异常:', e.message, e.stack); }
finally { await b.close(); }
