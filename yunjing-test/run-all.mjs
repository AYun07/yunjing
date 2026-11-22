#!/usr/bin/env node
/* 云境 · 统一测试入口（v4.17.0）
 *
 * 为什么有它
 *   此前 yunjing-test/scripts 下 37 个测试脚本**没有统一入口**，只能一个一个人肉跑；
 *   没有入口就没有 CI，于是「版本号漏改」「资源引用不一致」「文件名写错」这类问题
 *   只能靠人记——本项目最近几次事故（漏打 tag、发版脚本写坏文档）都属于这一类。
 *
 * 用法
 *   node yunjing-test/run-all.mjs                  # 离线套件（快速，默认；CI 用这个）
 *   node yunjing-test/run-all.mjs --all            # 加上需要浏览器/接口的脚本
 *   node yunjing-test/run-all.mjs --filter 版本     # 只跑名字含「版本」的
 *   node yunjing-test/run-all.mjs --json           # 机器可读结果
 *   node yunjing-test/run-all.mjs --list           # 只列出会跑哪些
 *
 * 分级
 *   offline —— 纯 Node、不起浏览器、不调外部接口。秒级完成，适合每次提交都跑。
 *   browser —— 需要 Playwright + 若干本地服务（静态站/代理）。较慢，按需跑。
 *
 * 约定
 *   脚本以退出码表达结果：0 = 通过，非 0 = 失败。与既有 37 个脚本一致，无需改动它们。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCRIPTS = path.join(HERE, 'scripts');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : ''; };

const ONLY_ALL = has('--all');
const FILTER = valOf('--filter');
const AS_JSON = has('--json');
const LIST_ONLY = has('--list');

/* 需要浏览器/本地服务的脚本（其余按离线处理）。
   这些脚本自带 serve/playwright 依赖，离线跑会因端口或浏览器缺失而误报失败。 */
const BROWSER_PAT = /^t_(player|stress|soak|mobile|persist|slots|concurrency|funcprobe|final_audit|audit_browser|body_probe|rejudge|scrub_effect|registry|kb_load|truthdiff|version_browser|v4071_ui|407_real|atlas_406|model_adaptive_browser|shots|semantic)|^(sim|truthdiff|shots_4072|semantic_judge)/;

function discover() {
  if (!fs.existsSync(SCRIPTS)) return [];
  const out = [];
  for (const f of fs.readdirSync(SCRIPTS)) {
    if (f.startsWith('_') || f.startsWith('.')) continue;
    const ext = path.extname(f).toLowerCase();
    if (!['.cjs', '.js', '.mjs', '.py'].includes(ext)) continue;
    const base = f.replace(ext, '');
    /* 工具型脚本（不是测试，是给人用的生成/抽取器）跳过 */
    if (/^(kb_array_tool|trim_shots)$/.test(base)) continue;
    const level = BROWSER_PAT.test(base) ? 'browser' : 'offline';
    out.push({ file: f, base, ext, level, full: path.join(SCRIPTS, f) });
  }
  return out.sort((a, b) => a.level.localeCompare(b.level) || a.base.localeCompare(b.base));
}

function runnerFor(t) {
  if (t.ext === '.py') return { cmd: process.env.PYTHON || 'python', args: [t.full] };
  return { cmd: process.execPath, args: [t.full] };
}

function main() {
  let tests = discover();
  if (!ONLY_ALL) tests = tests.filter((t) => t.level === 'offline');
  if (FILTER) tests = tests.filter((t) => t.base.includes(FILTER) || t.file.includes(FILTER));

  if (LIST_ONLY) {
    console.log(`将运行 ${tests.length} 个脚本：`);
    for (const t of tests) console.log(`  [${t.level.padEnd(7)}] ${t.file}`);
    return 0;
  }

  const results = [];
  const t0 = Date.now();
  for (const t of tests) {
    const { cmd, args } = runnerFor(t);
    const s = Date.now();
    /* PYTHONIOENCODING=utf-8：Windows 控制台默认 GBK，而绝大多数测试脚本会打印
       ⚠/✓/中文，不设这一项就会以 UnicodeEncodeError 假失败（已在 semantic_judge.py
       上实测踩到）。这里统一兜住，不必逐个脚本改。 */
    const r = spawnSync(cmd, args, {
      cwd: ROOT, encoding: 'utf8', timeout: 20 * 60 * 1000,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' })
    });
    const ms = Date.now() - s;
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    const code = r.status == null ? -1 : r.status;
    /* 从输出里抓一行最能代表结论的（既有脚本都会打印 OK / 通过 / DEFECT / FAIL 之类） */
    const lines = out.split('\n').map((x) => x.trim()).filter(Boolean);
    const key = lines.filter((l) => /OK|✓|通过|DEFECT|FAIL|✗|汇总/.test(l)).slice(-1)[0] || lines.slice(-1)[0] || '';
    results.push({ ...t, code, ms, key: key.slice(0, 130), out });

    if (!AS_JSON) {
      const mark = code === 0 ? '\x1b[32m通过\x1b[0m' : '\x1b[31m失败\x1b[0m';
      console.log(`  ${mark}  ${(t.base + t.ext).padEnd(30)} ${String(ms + 'ms').padStart(7)}  ${key}`);
    }
  }

  const failed = results.filter((r) => r.code !== 0);
  const totalMs = Date.now() - t0;

  if (AS_JSON) {
    console.log(JSON.stringify({
      total: results.length, passed: results.length - failed.length, failed: failed.length,
      ms: totalMs,
      results: results.map(({ out, ...rest }) => rest),
      failures: failed.map((f) => ({ file: f.file, code: f.code, key: f.key, tail: out.split('\n').slice(-12).join('\n') })),
    }, null, 1));
  } else {
    console.log('');
    console.log('─'.repeat(78));
    console.log(`  合计 ${results.length} ｜ 通过 ${results.length - failed.length} ｜ 失败 ${failed.length} ｜ 耗时 ${(totalMs / 1000).toFixed(2)}s`);
    if (failed.length) {
      console.log('');
      console.log('  失败明细：');
      for (const f of failed) {
        console.log(`    ✗ ${f.file}（退出码 ${f.code}）`);
        for (const l of f.out.split('\n').slice(-8)) if (l.trim()) console.log(`        ${l.trim().slice(0, 140)}`);
      }
    }
    console.log('');
  }
  return failed.length ? 1 : 0;
}

process.exit(main());
