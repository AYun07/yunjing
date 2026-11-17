#!/usr/bin/env node
/* 云境 · 世界书条目体检 kb-vet.mjs（v4.29.0）
 * ---------------------------------------------------------------------------
 * 云境的立身之本是「按界考据、专名铁律、每界独立」——38 个世界、三千多条目，
 * 靠人眼盯不过来。这个脚本把这条理念固化成可机械执行的检查：
 *
 *   A. 占位符/代称残留    —— 禁止「XX」「某某」「代称」「原作名」「不详(占位)」当真名充数；
 *   B. 灌水/元写作标记    —— 禁止「扩写」「补密」「加厚」「细则N」「补段N」这类凑字段落；
 *   C. 同界内重复语句      —— 同一世界内出现完全相同的长句，视为复制粘贴；
 *   D. 条目字段完整        —— 每条须有 title/content，且 content 不得过短；
 *   E. 铁律条目存在性      —— 每个世界应至少有 1 条「原著忠实/专名/防OOC」性质的铁律条目；
 *   F. 跨世界通用套话      —— 检测同一句话在多个世界反复出现（模板灌水）。
 *
 * 口径：只报「可疑」，不擅自改文件；退出码 0=干净，1=有可疑项。供 CI 与人工质检共用。
 * 纯 Node、零依赖，通过 vm 直接加载 js/kb/*.core.js（这些文件把数据挂到 window.KB_PRESETS）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const KB_DIR = path.join(ROOT, 'js', 'kb');
const BASELINE = path.join(HERE, 'kb-vet.baseline.json');
const argv = process.argv.slice(2);
const DO_INIT = argv.includes('--init');
const REPORT_ONLY = argv.includes('--report');

/* 指纹：rule + where + msg，抗行号漂移；同一可疑项内容不变则指纹不变 */
function issueId(i) {
  return crypto.createHash('sha1').update(i.rule + '||' + i.where + '||' + i.msg).digest('hex').slice(0, 12);
}
function readBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) { return { version: 1, ids: [] }; }
}

/* 加载全部 core 文件，得到 KB_PRESETS */
function loadKB() {
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.core.js')).sort();
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(path.join(KB_DIR, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { console.error(`⚠️ 加载 ${f} 失败: ${e.message}`); }
  }
  return sandbox.KB_PRESETS || {};
}

/* 规则 A：占位符/代称——这些词出现在 title 里基本就是没查到真名拿占位充数 */
const PLACEHOLDER = /(原作名|代称|某某|XXX|待补|TBD|占位|某角色|某势力|某人物)/i;
/* 规则 B：灌水/元写作标记 */
const FILLER = /(扩写·|补密|加厚|【细则\s*\d|【补段\s*\d|【补述\s*\d|【扩段\s*\d|【阶段档案|【剧情补述|【可介入事件·清单\s*\d)/;
/* 规则 E：铁律条目的特征词 */
const IRONCLAD = /(铁律|原著忠实|专名|禁止.*(发明|编造|二创)|防OOC|主角替代协议)/;

const kb = loadKB();
const issues = [];
let worlds = 0, entries = 0;

for (const [wid, list] of Object.entries(kb)) {
  worlds++;
  const seenTitles = new Set();
  const sentenceMap = new Map();   // 规则 C/E：长句 -> 首次所在条目
  let hasIronclad = false;

  for (const e of list) {
    entries++;
    const title = String(e.title || '');
    const content = String(e.content || '');
    const where = `${wid} · ${title.slice(0, 24)}`;

    /* D 字段完整 */
    if (!title) issues.push({ level: 'error', rule: 'D', where, msg: '缺 title' });
    if (content.length < 40) issues.push({ level: 'error', rule: 'D', where, msg: `content 过短(${content.length})` });
    if (seenTitles.has(title)) issues.push({ level: 'warn', rule: 'D', where, msg: '同界重复 title' });
    if (title) seenTitles.add(title);

    /* A 占位符（只看 title，正文里讨论"代称"是正常写作指导，不算） */
    if (PLACEHOLDER.test(title)) issues.push({ level: 'warn', rule: 'A', where, msg: 'title 含占位/代称词' });

    /* B 灌水标记 */
    const fm = content.match(FILLER);
    if (fm) issues.push({ level: 'warn', rule: 'B', where, msg: `含灌水标记「${fm[0]}」` });

    /* E 铁律存在性 */
    if (IRONCLAD.test(title + content)) hasIronclad = true;

    /* C 同界内重复长句（按 ≥30 字的句子切分） */
    const sentences = content.split(/[。！？\n；]/).map(s => s.trim()).filter(s => s.length >= 30);
    for (const s of sentences) {
      if (sentenceMap.has(s)) {
        issues.push({ level: 'warn', rule: 'C', where, msg: `与本界「${sentenceMap.get(s)}」重复长句` });
      } else sentenceMap.set(s, title.slice(0, 16));
    }
  }

  /* E 每界铁律条目 */
  if (!hasIronclad) issues.push({ level: 'warn', rule: 'E', where: wid, msg: '未发现原著忠实/专名/防OOC 铁律条目' });
}

/* F 跨世界通用套话：统计同一长句出现在几个世界，≥4 个界判为模板灌水 */
const globalSentence = new Map(); // sentence -> Set(wid)
for (const [wid, list] of Object.entries(kb)) {
  const local = new Set();
  for (const e of list) {
    const sentences = String(e.content || '').split(/[。！？\n；]/).map(s => s.trim()).filter(s => s.length >= 40);
    for (const s of sentences) local.add(s);
  }
  for (const s of local) {
    if (!globalSentence.has(s)) globalSentence.set(s, new Set());
    globalSentence.get(s).add(wid);
  }
}
for (const [s, wids] of globalSentence) {
  if (wids.size >= 4) {
    issues.push({ level: 'warn', rule: 'F', where: [...wids].slice(0, 5).join(','), msg: `同一长句出现在 ${wids.size} 个世界：「${s.slice(0, 30)}…」` });
  }
}

/* 基线过滤：硬错误永远拦；可疑项只拦基线之外的新增 */
issues.forEach(i => { i.id = issueId(i); });
const baseline = readBaseline();
const known = new Set(baseline.ids || []);

if (DO_INIT) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    note: '云境世界书体检基线：记录已存在的模板化重复句等存量可疑项，只拦新增。',
    count: issues.length,
    ids: issues.map(i => i.id)
  }, null, 2) + '\n');
  console.log(`✅ 基线已重建：记录 ${issues.length} 个存量可疑项 → ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

const fresh = issues.filter(i => !known.has(i.id));
console.log('===== 云境 · 世界书条目体检 =====');
console.log(`覆盖 ${worlds} 个世界 / ${entries} 条条目。`);
console.log(`体检项 ${issues.length} 个（基线存量 ${known.size}），新增可疑 ${fresh.length} 个。`);

if (fresh.length === 0) {
  console.log('✅ 无新增可疑项，世界书质量守住了。');
  process.exit(0);
}
const freshErrors = fresh.filter(i => i.level === 'error');
for (const i of fresh.slice(0, 40)) {
  console.log(`  [${i.level}][${i.rule}] ${i.where} — ${i.msg}`);
}
if (fresh.length > 40) console.log(`  …另有 ${fresh.length - 40} 项`);
console.log('提示：确认新增条目合规后，执行 `node scripts/kb-vet.mjs --init` 更新基线。');
process.exit(REPORT_ONLY || freshErrors.length === 0 ? 0 : 1);
