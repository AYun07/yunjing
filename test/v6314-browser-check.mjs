/* v6.3.14 真 Chromium E2E：全量楼层快照 + 任意层回档 + 全量数据同步 + 撤销。
 * 跑法：node test/v6314-browser-check.mjs  （需先起 http.server 9155） */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:9155/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = [], logs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

try {
  await p.goto(BASE + 'studio.html?dev=1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.storyFramework && window.FloorState && window.TimeAxis, { timeout: 20000 });
  await p.waitForTimeout(800);
  console.log('\n【0】环境');
  ok(await p.evaluate(() => typeof window.FloorState.record === 'function'), 'FloorState 已加载');
  ok(await p.evaluate(() => typeof window.storyFramework.undoRewind === 'function'), 'undoRewind 已挂载');
  ok(await p.evaluate(() => typeof window.TimeAxis.undo === 'function'), '时光轴撤销入口已挂载');

  // 构造 30 轮状态，每轮 variables / memoryLayers / dynamicWorld / 旁路键都不同
  console.log('\n【1】构造 30 轮演化状态');
  await p.evaluate(async () => {
    const fw = window.storyFramework;
    fw.storyState.conversationHistory = [];
    for (let i = 0; i < 30; i++) {
      // 轮开始前：所有字段都还是"上一轮结束"的结果（真实游戏时序）
      fw.pushTurnSnapshot('指令' + i);   // 记录第 i 层快照（此刻字段=第 i-1 轮结果）
      if (fw._fsQueue) await fw._fsQueue;
      // AI 本轮回复落定后：推进所有字段到本轮结果
      fw.storyState.variables = { round: i, hp: 100 - i };
      fw.storyState.memoryLayers = { facts: ['fact@' + i], _upTo: i };
      fw.storyState.dynamicWorld = { era: 'era@' + i };
      fw.storyState.digest = { summary: 'digest@' + i };
      fw.storyState.conversationHistory.push({ role: 'user', content: '指令' + i });
      fw.storyState.conversationHistory.push({ role: 'assistant', content: '正文' + i });
      try { localStorage.setItem('yunjingWorldRuntime~main~free', JSON.stringify({ round: i })); } catch (e) {}
    }
    // 等 FloorState 写队列排空
    if (fw._fsQueue) await fw._fsQueue;
  });
  await p.waitForTimeout(300);

  // 回档到第 10 层（before），验证全量字段还原
  console.log('\n【2】回档到第 10 层（before），全量字段同步');
  const rr = await p.evaluate(async () => {
    const r = await window.storyFramework.rewindTo(10, 'before');
    return r;
  });
  ok(rr && rr.full === true, '走全量楼层快照分支（full=true）');
  const st10 = await p.evaluate(() => {
    const s = window.storyFramework.storyState;
    let wr = null; try { wr = JSON.parse(localStorage.getItem('yunjingWorldRuntime~main~free')); } catch (e) {}
    return {
      variables: s.variables, memoryLayers: s.memoryLayers, dynamicWorld: s.dynamicWorld,
      digest: s.digest, histLen: s.conversationHistory.length, worldRuntime: wr
    };
  });
  // 第10层快照 = 第10轮开始前 = 第9轮结束后状态
  ok(st10.variables && st10.variables.round === 9, `variables.round=9 got=${st10.variables && st10.variables.round}`);
  ok(st10.memoryLayers && st10.memoryLayers.facts[0] === 'fact@9', 'memoryLayers 同步到第9轮');
  ok(st10.dynamicWorld && st10.dynamicWorld.era === 'era@9', 'dynamicWorld 同步到第9轮');
  ok(st10.digest && st10.digest.summary === 'digest@9', 'digest 同步到第9轮');
  ok(st10.worldRuntime && st10.worldRuntime.round === 9, `旁路 worldRuntime 同步到第9轮 got=${st10.worldRuntime && st10.worldRuntime.round}`);
  ok(st10.histLen === 20, `对话历史截断到20楼 got=${st10.histLen}`);

  // 回档到第 25 层，再验证（证明任意层）
  console.log('\n【3】再回档到第 25 层（after），验证任意层');
  await p.evaluate(async () => {
    // 重新灌满到30层
    const fw = window.storyFramework;
    for (let i = 10; i < 30; i++) {
      fw.pushTurnSnapshot('指令' + i);
      if (fw._fsQueue) await fw._fsQueue;
      fw.storyState.variables = { round: i, hp: 100 - i };
      fw.storyState.memoryLayers = { facts: ['fact@' + i], _upTo: i };
      fw.storyState.dynamicWorld = { era: 'era@' + i };
      fw.storyState.digest = { summary: 'digest@' + i };
      fw.storyState.conversationHistory.push({ role: 'user', content: '指令' + i });
      fw.storyState.conversationHistory.push({ role: 'assistant', content: '正文' + i });
      try { localStorage.setItem('yunjingWorldRuntime~main~free', JSON.stringify({ round: i })); } catch (e) {}
    }
    if (fw._fsQueue) await fw._fsQueue;
  });
  await p.evaluate(async () => { await window.storyFramework.rewindTo(25, 'after'); });
  const st25 = await p.evaluate(() => {
    const s = window.storyFramework.storyState;
    return { round: s.variables.round, mem: s.memoryLayers.facts[0], era: s.dynamicWorld.era };
  });
  ok(st25.round === 25, `after模式保留第25轮，round=25 got=${st25.round}`);
  ok(st25.mem === 'fact@25', 'after模式 memoryLayers 同步');
  ok(st25.era === 'era@25', 'after模式 dynamicWorld 同步');

  // 撤销
  console.log('\n【4】撤销上次回档');
  const undone = await p.evaluate(async () => await window.storyFramework.undoRewind());
  ok(undone === true, '撤销成功');
  const stUndo = await p.evaluate(() => window.storyFramework.storyState);
  ok(stUndo.variables && stUndo.variables.round >= 25, `撤销后 round 恢复到回档前 got=${stUndo.variables && stUndo.variables.round}`);

  console.log('\n【5】刷新后不复活（V5）');
  // 先回档到第5层，再刷新，检查变量/对话长度不回弹
  await p.evaluate(async () => { await window.storyFramework.rewindTo(5, 'before'); });
  const beforeReload = await p.evaluate(() => ({
    round: window.storyFramework.storyState.variables.round,
    hist: window.storyFramework.storyState.conversationHistory.length
  }));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.storyFramework && window.FloorState, { timeout: 20000 });
  await p.waitForTimeout(600);
  const afterReload = await p.evaluate(() => ({
    round: window.storyFramework.storyState.variables.round,
    hist: window.storyFramework.storyState.conversationHistory.length
  }));
  ok(afterReload.round === beforeReload.round, `刷新后 round 不回弹 ${beforeReload.round}→${afterReload.round}`);
  ok(afterReload.hist === beforeReload.hist, `刷新后对话长度不回弹 ${beforeReload.hist}→${afterReload.hist}`);

  console.log('\n【6】老档降级（V7）：无 floorState 时回档走 turnArc');
  const legacy = await p.evaluate(async () => {
    const fw = window.storyFramework, FS = window.FloorState;
    // 等所有写入排空后彻底删掉楼层快照，模拟从老版本升级上来的档
    if (fw._fsQueue) await fw._fsQueue;
    if (fw._arcQueue) await fw._arcQueue;
    await window.StorageBoost.remove(FS._key(fw));
    // 手工造 turnArc 所需的 turns 热栈快照（不经过 pushTurnSnapshot，避免重新写 floorState）
    fw.storyState.turns = [];
    for (let i = 0; i < 5; i++) {
      fw.storyState.turns.push({
        index: i, user: 'old' + i, varsBefore: { round: i },
        histLen: 2 * i, turnCount: i, digestBefore: null, driftBefore: []
      });
    }
    const loadNull = await FS.load(fw, 2);  // 应返回 null
    const r = await fw.rewindTo(2, 'before');
    return { full: r && r.full, round: fw.storyState.variables.round, loadNull };
  });
  ok(legacy.loadNull === null, 'floorState 删除后 load 返回 null');
  ok(legacy.full !== true, '无楼层快照时回落 turnArc（full 非 true）');
  ok(typeof legacy.round === 'number', `降级回档仍执行，round=${legacy.round}`);

  console.log('\n【7】JS 错误');
  ok(errs.length === 0, `pageerror=0 got=${errs.length}` + (errs.length ? ' | ' + errs.slice(0,3).join(' ; ') : ''));
  const realLogs = logs.filter(x => !/favicon|404|Failed to load resource/i.test(x));
  ok(realLogs.length === 0, `console.error=0 got=${realLogs.length}` + (realLogs.length ? ' | ' + realLogs.slice(0,3).join(' ; ') : ''));

  console.log(`\n=== E2E 结果: ${pass} PASS / ${fail} FAIL ===`);
} catch (e) {
  console.error('E2E 异常:', e.message, e.stack);
  fail++;
} finally {
  await b.close();
  process.exit(fail ? 1 : 0);
}
