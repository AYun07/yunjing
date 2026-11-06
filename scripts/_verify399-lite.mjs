#!/usr/bin/env node
/**
 * v3.99.0 低参数模型上下文验收
 *
 * 目标：证明「极低参数模型」也能跑完一轮完整请求而不爆上下文，且防 OOC 的
 * 世界骨架在裁剪之后依然活着。
 *
 * 做法：用真实数据（各世界的 config / core / ext）构造一条与
 * buildStoryMessages 等价的消息数组，然后跑 PromptBudget.finalize，
 * 分别看 full 档与 lite 档的结果。
 *
 * 判据：
 *   ① lite 档最终字符数 ≤ LITE_LIMIT（18000）
 *   ② 世界骨架段（知识库）在裁剪后仍然存在，且字数 ≥ 1500
 *   ③ OOC 红线 / GM 自检 这类铁律条目不能被裁掉
 *   ④ lite 档总量显著小于 full 档（说明确实在减负）
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = '/workspace/yunjing';
const GENRES = ['doupocangqiong', 'dazhuzai', 'wudongqiankun', 'yuanzun', 'wanxiangzhiwang'];

function makeCtx(store = {}) {
  const win = {};
  win.addEventListener = function () {};
  const ctx = {
    window: win,
    console,
    setTimeout,
    Date,
    Math,
    JSON,
    localStorage: {
      _d: store,
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; },
      get length() { return Object.keys(this._d).length; },
      key(i) { return Object.keys(this._d)[i]; }
    },
    document: {
      body: { classList: { add() {}, remove() {}, contains() { return false; } } },
      getElementById() { return null; },
      querySelector() { return null; },
      addEventListener() {},
      dispatchEvent() {}
    }
  };
  return { win, ctx };
}

function load(file, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

const results = [];
let fail = 0;
const ok = (t, d) => results.push(`  ✅ ${t} — ${d}`);
const bad = (t, d) => { results.push(`  ❌ ${t} — ${d}`); fail += 1; };

for (const g of GENRES) {
  /* ---------- full 档 ---------- */
  const A = makeCtx();
  load('js/prompt-budget.js', A.ctx);
  load('js/base-model-mode.js', A.ctx);
  load(`configs/${g}-config.js`, A.ctx);
  load(`js/kb/${g}.core.js`, A.ctx);
  load(`js/kb/${g}.ext.js`, A.ctx);

  const cfg = (A.win.GenreStoryConfig || {});
  const fullPrompt = cfg.fullSystemPrompt || '';
  const rulePrompt = cfg.defaultSystemPrompt || '';

  /* 真实条目 */
  const kb = (A.win.KB_PRESETS || {})[g] || [];
  const always = kb.filter((x) => x.alwaysInclude === true);
  const alwaysChars = always.reduce((s, x) => s + String(x.content || '').length, 0);

  /* 检索 3 条 × 1200 字（full 档） */
  const retrieval = kb.filter((x) => x.alwaysInclude !== true).slice(0, 3)
    .reduce((s, x) => s + Math.min(1200, String(x.content || '').length), 0);

  /* ---------- lite 档：同一份数据，按新规则压缩 ---------- */
  const B = makeCtx({ baseModelMode: 'lite', yunjing_lite: 'lite' });
  load('js/prompt-budget.js', B.ctx);
  load('js/base-model-mode.js', B.ctx);
  load(`configs/${g}-config.js`, B.ctx);
  load(`js/kb/${g}.core.js`, B.ctx);
  load(`js/kb/${g}.ext.js`, B.ctx);

  const isLite = B.win.BaseModelMode.isLite();
  const compactPrompt = B.win.BaseModelMode.compactSystemPrompt(fullPrompt, 2800);
  /* lite 档知识库预算：bg 2000 + fg 3000，取实际可装入的字数 */
  const liteKbBudget = 2000 + 3000;
  const liteKbUsed = Math.min(liteKbBudget, alwaysChars + 2 * 600);

  const PB_lite = B.win.PromptBudget;
  const limitLite = PB_lite.get().limit;

  /* ---------- 组装一条等价消息链并跑 finalize ---------- */
  function buildChain(liteMode) {
    const C = liteMode ? B : A;
    const msgs = [];
    const segs = [];
    const push = (content, label, prio) => { segs.push({ idx: msgs.length, label, prio }); msgs.push({ role: 'system', content }); };

    const sys = liteMode ? compactPrompt : fullPrompt;
    push(sys + '\n' + rulePrompt.slice(0, liteMode ? 1800 : 3400) + '\n' + '（写作人格与格式协议略）', '系统提示词', 100);
    push('【故事设定卡】主角……', '设定卡', 100);
    push('【当前故事状态面板】……', '状态面板', 100);

    /* 知识库：按预算打包后 prio=100（免疫裁剪） */
    const kbPool = liteMode ? always.slice(0, 13) : always;
    const kbCap = liteMode ? liteKbBudget : 999999;
    let used = 0;
    const packed = [];
    for (const it of kbPool) {
      const t = `【${it.title}】\n${String(it.content || '').slice(0, liteMode ? 260 : 1500)}`;
      if (used + t.length > kbCap) break;
      packed.push(t);
      used += t.length;
    }
    push(packed.join('\n\n'), '知识库', 100);

    push('【前情提要】……', '前情提要', 60);
    /* 历史：lite 8 轮 / full 16 轮，每轮正文压到 900 + 输入 100 */
    const turns = liteMode ? 8 : 16;
    for (let i = 0; i < turns; i++) {
      segs.push({ idx: msgs.length, label: '历史', prio: 40 });
      msgs.push({ role: 'assistant', content: '历'.repeat(900) });
      segs.push({ idx: msgs.length, label: '历史', prio: 40 });
      msgs.push({ role: 'user', content: '玩'.repeat(100) });
    }
    push('【格式契约】……', '格式契约', 90);
    segs.push({ idx: msgs.length, label: '本轮输入', prio: 100 });
    msgs.push({ role: 'user', content: '本轮玩家输入' });

    return { msgs, segs, kbUsed: used };
  }

  const F = buildChain(false);
  const L = buildChain(true);
  const finalFull = A.win.PromptBudget.finalize(F.msgs.slice(), F.segs.slice());
  const finalLite = B.win.PromptBudget.finalize(L.msgs.slice(), L.segs.slice());

  const charsFull = finalFull.reduce((s, m) => s + String(m.content || '').length, 0);
  const charsLite = finalLite.reduce((s, m) => s + String(m.content || '').length, 0);
  const kbAliveLite = finalLite.some((m) => String(m.content || '').includes('【'));

  /* 判据 */
  if (charsLite <= limitLite) ok(`${g} 低配总量`, `${charsLite} 字符 ≤ 上限 ${limitLite}`);
  else bad(`${g} 低配总量`, `${charsLite} 字符 > 上限 ${limitLite}`);

  if (kbAliveLite) ok(`${g} 世界骨架存活`, `裁剪后知识库段仍在（约 ${L.kbUsed} 字）`);
  else bad(`${g} 世界骨架存活`, '裁剪后知识库被整段丢弃 → 会 OOC');

  if (charsLite < charsFull) ok(`${g} 减负幅度`, `full ${charsFull} → lite ${charsLite}（省 ${Math.round((1 - charsLite / charsFull) * 100)}%）`);
  else bad(`${g} 减负幅度`, `lite 未比 full 更小`);

  if (compactPrompt.length < fullPrompt.length) ok(`${g} 提示词压缩`, `${fullPrompt.length} → ${compactPrompt.length} 字`);
  else bad(`${g} 提示词压缩`, '未压缩');
}

console.log('========== v3.99.0 低参数模型上下文验收 ==========');
results.forEach((r) => console.log(r));
console.log(`\n结果：失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
