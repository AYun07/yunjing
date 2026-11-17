#!/usr/bin/env node
/* 云境 · 网络韧性体检 net-vitals.mjs（v4.29.0）
 * ---------------------------------------------------------------------------
 * 自己设计的一套静态扫描，目的是防止「请求挂死 / 按钮转圈不停 / 停止无效」
 * 这类问题在迭代中被重新引入。它检查三类信号：
 *
 *   ① 裸 fetch      —— 业务代码里直接 fetch(...) 而没有走带超时/信号的外壳；
 *   ② 无中止信号    —— fetch 选项里既没有 signal，附近也没有 AbortController；
 *   ③ 无超时约束    —— 既不是 fetchWithTimeout/withTimeoutMs 封装，附近也看不到超时字眼。
 *
 * 设计原则（云境自己的口径）：
 *   · 存量不阻塞：当前代码里已有的调用全部记进基线，只有「新增违规」才让 CI 失败。
 *     这样既不会一上来讲不清楚就卡住所有提交，又能保证今后不再新增裸调用。
 *   · 指纹抗漂移：用「文件路径 + 归一化后的源码行」做指纹，而不是行号，
 *     所以在文件中间插几行不会导致误报。
 *   · 纯 Node、零依赖、秒级完成，可挂进 CI 每次提交都跑。
 *
 * 用法：
 *   node scripts/net-vitals.mjs             # 体检：只拦基线之外的新增违规
 *   node scripts/net-vitals.mjs --init      # 重建基线（确认存量合规后手动执行）
 *   node scripts/net-vitals.mjs --report    # 只打印报告，不改基线、不影响退出码
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BASELINE = path.join(HERE, 'net-vitals.baseline.json');
const SCAN_DIRS = ['js', 'js/kb', 'js/world-ext'];
const argv = process.argv.slice(2);
const DO_INIT = argv.includes('--init');
const REPORT_ONLY = argv.includes('--report');

/* 归一化为指纹：去掉行首尾空白与连续空格，缓解纯格式改动造成的误报 */
function norm(line) {
  return String(line).replace(/\s+/g, ' ').trim();
}
function fp(file, line) {
  return crypto.createHash('sha1').update(file + '||' + norm(line)).digest('hex').slice(0, 12);
}

/* 收集待扫描的 JS 文件 */
function collectFiles() {
  const out = [];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith('.js')) continue;
      out.push(path.posix.join(d, name));
    }
  }
  return out;
}

/* 判断某个 fetch 调用是否「有护栏」：
   向上/向下各看若干行，出现超时封装、signal、AbortController 即认为受控。 */
const GUARD = /(fetchWithTimeout|withTimeoutMs|fetchWithProxy|AbortController|signal\s*:|timeoutMs|setTimeout|abort)/;
function hasGuard(lines, i) {
  const lo = Math.max(0, i - 6), hi = Math.min(lines.length, i + 9);
  for (let j = lo; j < hi; j++) {
    if (j === i) continue;
    if (GUARD.test(lines[j])) return true;
  }
  return false;
}

/* 扫描所有裸 fetch：整行是注释、或直接位于带护栏的上下文，都跳过 */
function scan() {
  const findings = [];
  for (const file of collectFiles()) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/\bfetch\s*\(/.test(line)) return;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (hasGuard(lines, i)) return;
      findings.push({ file, line: i + 1, code: trimmed.slice(0, 120), id: fp(file, line) });
    });
  }
  return findings;
}

function readBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
  catch (e) { return { version: 1, ids: [] }; }
}

const findings = scan();
const ids = findings.map(f => f.id);
const baseline = readBaseline();
const known = new Set(baseline.ids || []);

if (DO_INIT) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    note: '云境网络韧性体检基线：记录已存在的 fetch 调用指纹，只拦新增。',
    ids
  }, null, 2) + '\n');
  console.log(`✅ 基线已重建：记录 ${ids.length} 个存量调用 → ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

const fresh = findings.filter(f => !known.has(f.id));
console.log('===== 云境 · 网络韧性体检 =====');
console.log(`扫描到 fetch 调用 ${findings.length} 处，基线存量 ${known.size} 处。`);
if (fresh.length === 0) {
  console.log('✅ 无新增裸调用，网络护栏守住了。');
  process.exit(0);
}
console.log(`⚠️  发现 ${fresh.length} 个基线之外的新增调用：`);
for (const f of fresh) console.log(`   · ${f.file}:${f.line}  ${f.code}`);
console.log('提示：若确认这些调用已有超时/中止保护，核对后执行 `node scripts/net-vitals.mjs --init` 更新基线。');
process.exit(REPORT_ONLY ? 0 : 1);
