#!/usr/bin/env node
/**
 * 密钥泄露扫描（CI 闸门）：全仓扫描疑似真实 API Key，发现即 fail。
 * 规则：sk- 后跟 20+ 位字母数字视为可疑；放行常见假占位符（test/demo/placeholder/your/xxx/abc 等）。
 * 不回显完整 Key，只报文件:行号 + 脱敏前缀。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'release-assets']);
const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.py', '.json', '.html', '.css', '.md', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.env', '.txt']);

// 明显假占位符（小写后包含这些片段即放行）
const PLACEHOLDERS = ['sk-abc', 'sk-xxx', 'sk-your', 'sk-test', 'sk-demo', 'sk-placeholder', 'sk-example', 'sk-0000', 'sk-1111', 'sk-replace', 'sk-here', 'sk-key', 'sk-none', 'changeme', 'your_api', 'your-api'];

const REAL_KEY = /sk-[A-Za-z0-9]{20,}/g;
const hits = [];
let scanned = 0;

function walk(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.git')) continue;
      walk(path.join(dir, e.name));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!SCAN_EXT.has(ext) && e.name !== 'Dockerfile') continue;
      const full = path.join(dir, e.name);
      let txt;
      try { txt = fs.readFileSync(full, 'utf8'); } catch { continue; }
      scanned++;
      const lines = txt.split(/\r?\n/);
      lines.forEach((ln, i) => {
        let m;
        REAL_KEY.lastIndex = 0;
        while ((m = REAL_KEY.exec(ln)) !== null) {
          const low = m[0].toLowerCase();
          if (PLACEHOLDERS.some(p => low.startsWith(p) || low.includes(p))) continue;
          const mask = m[0].slice(0, 6) + '…' + m[0].slice(-4);
          hits.push(`${path.relative(ROOT, full)}:${i + 1}  ${mask}`);
        }
      });
    }
  }
}

walk(ROOT);
console.log(`[scan-secrets] 扫描 ${scanned} 个文件`);
if (hits.length) {
  console.error(`[scan-secrets] ✗ 发现 ${hits.length} 处疑似真实密钥：`);
  hits.slice(0, 30).forEach(h => console.error('  ' + h));
  process.exit(1);
}
console.log('[scan-secrets] ✓ 未发现真实密钥');
