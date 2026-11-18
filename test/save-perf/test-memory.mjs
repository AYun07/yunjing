import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const log = (...a) => console.log(...a);

async function heapMB() {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  await p.waitForTimeout(200);
  return await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : -1);
}

try {
  log('\n【1】打开创作室，基线内存');
  await p.goto(BASE + 'studio.html');
  await p.waitForFunction(() => window.storyFramework && window.ChatVirtualizer, { timeout: 15000 });
  await p.waitForTimeout(800);
  await cdp.send('Performance.enable');
  const baseHeap = await heapMB();
  log('  基线 JS 堆:', baseHeap.toFixed(1), 'MB');

  log('\n【2】构造 5000 楼正文并走虚拟器 mount');
  const result = await p.evaluate(async () => {
    const N = 5000;
    const content = '少女踏云而来，星河倾泻如练，她轻声说道："这一界，便由你我共同书写。"远山楼阁半隐于雾，月光洒在翻涌的云海上，万象自此生长。';
    const history = [];
    for (let i = 0; i < N; i++) {
      history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: '【第' + i + '楼】' + content });
    }
    const fw = window.storyFramework;
    fw.storyState.conversationHistory = history;
    // 确保 chatMessages 容器存在
    let box = document.getElementById('chatMessages');
    if (!box) { box = document.createElement('div'); box.id = 'chatMessages'; document.body.appendChild(box); }
    const t0 = performance.now();
    window.ChatVirtualizer.mount(history, [], fw);
    const mountMs = performance.now() - t0;
    return { n: N, mountMs: mountMs.toFixed(0), totalMB: (JSON.stringify(history).length / 1048576).toFixed(2) };
  });
  log('  楼数:', result.n, '| 数据总量:', result.totalMB, 'MB | mount耗时:', result.mountMs, 'ms');

  await p.waitForTimeout(600);
  const afterHeap = await heapMB();
  log('  挂载后 JS 堆:', afterHeap.toFixed(1), 'MB | 增量:', (afterHeap - baseHeap).toFixed(1), 'MB');

  log('\n【3】DOM 节点数（应恒定有界 ≈106）');
  const dom = await p.evaluate(() => {
    const box = document.getElementById('chatMessages');
    let nodes = 0; box && box.querySelectorAll('*').forEach(() => nodes++);
    return { children: box ? box.children.length : -1, allDesc: nodes,
      floorsCached: window.ChatVirtualizer.floors.length };
  });
  log('  #chatMessages 直接子元素(楼层卡):', dom.children, '| 后代节点:', dom.allDesc, '| floors缓存:', dom.floorsCached);
  log('  楼层DOM有界(≤106):', dom.children <= 106 ? '✅' : '❌', '(后代节点含卡片内部结构，非楼层膨胀)');

  log('\n【4】上滚加载旧楼（模拟浏览几千楼）');
  const scrollMs = await p.evaluate(async () => {
    const box = document.getElementById('chatMessages');
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) { box.scrollTop = 0; await new Promise(r => setTimeout(r, 20)); }
    return (performance.now() - t0).toFixed(0);
  });
  log('  连续20次触顶加载耗时:', scrollMs, 'ms');
  const scrollHeap = await heapMB();
  log('  滚动后 JS 堆:', scrollHeap.toFixed(1), 'MB');
  const domAfter = await p.evaluate(() => document.getElementById('chatMessages').children.length);
  log('  滚动后楼层卡数:', domAfter, '(应仍≤106，不随浏览累积)');

  log('\n【5】达标判定');
  const memOK = afterHeap < 400 && scrollHeap < 400;
  const domOK = dom.children <= 106 && domAfter <= 106;
  const speedOK = parseFloat(result.mountMs) < 3000;
  log('  运行时内存 <400MB:', memOK ? '✅' : '❌', '(峰值 ' + Math.max(afterHeap, scrollHeap).toFixed(1) + 'MB)');
  log('  DOM有界:', domOK ? '✅' : '❌');
  log('  加载 <3s:', speedOK ? '✅' : '❌');
  log('  JS错误:', errs.length, errs.join(' | '));
  log('  总判定:', memOK && domOK && speedOK && errs.length === 0 ? '✅ 全部通过' : '❌ 有失败项');

} catch (e) { log('!!! 异常:', e.message, e.stack); }
finally { await b.close(); }
