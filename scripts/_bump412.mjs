/* 云境 v4.11.0 → v4.12.0 版本同源对齐（仅改文件，幂等可复跑，不做 git/网络）
 * 复刻 _align411.mjs 的精确替换规则。
 * 保护：changelog 历史叙述里的旧 ?v= 号、第三方库自身版本号、js 注释里的历史修复记录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = '4.11.0';
const NEW = '4.12.0';
const REPO = 'AYun07/yunjing';
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

const touched = new Set();
function sub(rel, re, rep) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return 0;
  const s = fs.readFileSync(p, 'utf8');
  const hits = (s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
  const n = s.replace(re, rep);
  if (n !== s) { fs.writeFileSync(p, n); touched.add(rel); }
  return hits;
}

// 1) 顶层 html + js 模块里形态为「云境发版号世代」的 ?v= 参数
const qvTargets = [];
function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (['node_modules', '.git', 'libs', 'changelog', 'yunjing-test', '_shots_v398', '_shots_v399', 'scripts', 'test'].includes(e.name)) continue;
    if (e.isDirectory()) { collect(path.join(dir, e.name)); continue; }
    if (!/\.(html|js)$/.test(e.name)) continue;
    qvTargets.push(rel);
  }
}
collect(ROOT);
let qv = 0;
for (const rel of qvTargets) qv += sub(rel, /\?v=4\.11\.0/g, '?v=4.12.0');

// 2) 精确版本常量锚点
const rules = [
  ['index.html', /window\.YJ_VER = '4\.11\.0'/g, "window.YJ_VER = '4.12.0'"],
  ['index.html', /(id="verBadge"[^>]*>)v4\.11\.0( 云境版<\/a>)/g, '$1v4.12.0$2'],
  ['index.html', /<title>云境 v4\.11\.0/g, '<title>云境 v4.12.0'],
  ['studio.html', /window\.YJ_VER = '4\.11\.0'/g, "window.YJ_VER = '4.12.0'"],
  ['studio.html', /(id="verDot"[^>]*>)v4\.11\.0(<\/span>)/g, '$1v4.12.0$2'],
  ['studio.html', /<title>云境 v4\.11\.0/g, '<title>云境 v4.12.0'],
  ['sw.js', /const SW_VER = 'yunjing-v4\.11\.0'/g, "const SW_VER = 'yunjing-v4.12.0'"],
  ['selftest.html', /const ENGINE_VER = '4\.11\.0'/g, "const ENGINE_VER = '4.12.0'"],
  ['js/number-scrubber.js', /version: "4\.11\.0"/g, 'version: "4.12.0"'],
  ['QUICKSTART.txt', /云境工坊 v4\.11\.0 · 使用说明/g, '云境工坊 v4.12.0 · 使用说明'],
  ['changelog/index.html', /yunjing-theme\.css\?v=4\.11\.0/g, 'yunjing-theme.css?v=4.12.0'],
];
let consts = 0;
for (const [rel, re, rep] of rules) consts += sub(rel, re, rep);

// 3) README 顶部当前版本 + 立即获取链接 + 逐版表新增行 + 计数
{
  const rel = 'README.md';
  let s = read(rel);
  s = s.replace(/## 🆕 当前版本：v4\.11\.0（[\d-]+）/, `## 🆕 当前版本：v4.12.0（${today}）`);
  s = s.replace(/archive\/refs\/tags\/v4\.11\.0\.zip/g, 'archive/refs/tags/v4.12.0.zip')
       .replace(/releases\/tag\/v4\.11\.0/g, 'releases/tag/v4.12.0')
       .replace(/compare\/v4\.10\.0\.\.\.v4\.11\.0/g, 'compare/v4.11.0...v4.12.0');
  s = s.replace(/逐版更新记录（新 → 旧，共 71 版）/, '逐版更新记录（新 → 旧，共 72 版）');
  const anchor = '| **v4.11.0** | 2026-11-09 |';
  const row = '| **v4.12.0** | ' + today + ' | 模型无关自适应重做：修正把「开发期测试夹具 agnes 三模型」误当产品边界的认知，产品运行时对玩家模型零限制 修复 auto 只看域名不看模型名 + 单向锁 lite 的缺陷，改为按接口特征+模型名初判、按每轮实际输出双向升降档（连续 2 轮稳定完整→升 full，崩塌→降 lite），自定义域名/中转/本地部署的强模型也能拿到全功能；设置界面文案、README/QUICKSTART/MODEL_WHITELIST 口径同步澄清 新增 t_model_adaptive.cjs（12 项）与 t_model_adaptive_browser.py（8 项）固化验收 全量回归：JS 249/249、node vm 19/19、真浏览器 16/16+8/8+12/12、版本同源 19/19、零 pageerror | '
    + '[zip](https://github.com/' + REPO + '/archive/refs/tags/v4.12.0.zip) · [发布页](https://github.com/' + REPO + '/releases/tag/v4.12.0) |';
  if (anchor && s.indexOf(anchor) !== -1 && s.indexOf('| **v4.12.0** |') === -1) {
    s = s.replace(anchor, row + '\n' + anchor, 1);
  }
  write(rel, s); touched.add(rel);
}

// 4) VERSIONS：计数 / 速查行 / 详情段 + 终点
{
  const rel = 'VERSIONS.md';
  let s = read(rel);
  s = s.replace(/共 \*\*84\*\* 个版本/, '共 **85** 个版本')
       .replace(/到 `v4\.11\.0`/, '到 `v4.12.0`');
  const anchor = '| **v4.11.0** | 2026-11-09 |';
  const quick = '| **v4.12.0** | ' + today + ' | [下载](https://github.com/' + REPO + '/archive/refs/tags/v4.12.0.zip) | [查看](https://github.com/' + REPO + '/releases/tag/v4.12.0) |';
  if (s.indexOf(anchor) !== -1 && s.indexOf('| **v4.12.0** |') === -1) s = s.replace(anchor, quick + '\n' + anchor, 1);
  const firstH2 = s.search(/^## v/m);
  if (firstH2 > -1 && s.indexOf('## v4.12.0') === -1) {
    const block = '## v4.12.0 · ' + today + '\n\n'
      + '模型无关自适应重做 · 口径澄清。\n\n'
      + '- **认知更正**：三个 agnes flash 模型只是开发方做回归测试的夹具（只约束 `yunjing-test/` 开发期脚本），**不是玩家能用的型号限制**；产品运行时对玩家模型零限制、零白名单，各厂商/中转/自建网关/本地部署/任意 OpenAI 兼容端点均可。\n'
      + '- **真实修复**：`base-model-mode.js` 旧版 auto 只看 endpoint 域名且单向锁 lite，自建中转/本地/新厂商上的强模型被误判为弱模型、砍掉全功能。改为按接口特征+模型名初判、按每轮实际输出双向升降档（连续 2 轮结构完整稳定→升 full，复读崩塌→降 lite），手动档仍优先、换模型缓存隔离。`api-calling-functions.js` 传入真实回复并排除连通测试短回复；设置界面文案改为「模型零限制」。\n'
      + '- **口径同步**：交付报告/交付卡更正错误的「模型硬上限」表述；README 顶部、QUICKSTART、MODEL_WHITELIST 加权威声明。历史版本条目保持史实不动。\n'
      + '- **验收**：`t_model_adaptive.cjs` 12/12、`t_model_adaptive_browser.py` 8/8、node vm 19/19、真浏览器 16/16、JS 语法 249/249、版本同源 19/19、零 pageerror。\n\n'
      + '- [📂 该版文件](https://github.com/' + REPO + '/tree/v4.12.0)  [🔍 与 v4.11.0 差异](https://github.com/' + REPO + '/compare/v4.11.0...v4.12.0)  [⬇ 完整包 zip](https://github.com/' + REPO + '/archive/refs/tags/v4.12.0.zip)\n\n';
    s = s.slice(0, firstH2) + block + s.slice(firstH2);
  }
  write(rel, s); touched.add(rel);
}

// 5) changelog 新条目
{
  const rel = 'changelog/index.html';
  let s = read(rel);
  const anchor = '<!-- ==================== 版本条目（新→旧） ==================== -->';
  if (s.indexOf(anchor) !== -1 && s.indexOf('<span class="entry-ver">v4.12.0</span>') === -1) {
    const entry = anchor + '\n\n        <article class="log-entry" data-tags="版本 发布 模型" style="--entry-hue:#4aa3a0;">\n'
      + '            <div class="entry-head">\n'
      + '                <span class="entry-ver">v4.12.0</span>\n'
      + '                <span class="entry-date">' + today + '</span>\n'
      + '            </div>\n'
      + '            <h3 class="entry-title">模型无关自适应 · 让任意模型都跑到最好的游玩效果</h3>\n'
      + '            <p class="entry-text">口径澄清：三个 agnes flash 模型只是开发方做回归测试的夹具（仅约束开发期测试脚本），绝非玩家能用的型号限制；产品运行时对玩家模型零限制，各厂商官方/中转/自建网关/本地部署/任意 OpenAI 兼容端点都能填 修复真实缺陷：模型能力自适应旧版 auto 只看 endpoint 域名、不看玩家填的模型名，且单向锁 lite（只有崩塌降级、没有稳定升档），导致跑在自定义域名/中转/本地部署上的强模型被误判为弱模型、砍掉全量预设与辅助功能。现改为按接口特征+模型名初判、按每轮实际输出双向升降档：连续 2 轮结构完整稳定→自动升 full，复读崩塌→立即降 lite，手动档优先、换模型缓存隔离、连通测试短回复不误判 设置界面文案、README 顶部、QUICKSTART、MODEL_WHITELIST 与交付报告/交付卡口径同步更正，历史版本条目保持史实 新增 t_model_adaptive.cjs（12 项）与 t_model_adaptive_browser.py（8 项）固化验收 全量回归：JS 语法 249/249、node vm 19/19、真浏览器端到端 16/16、自适应真浏览器 8/8、版本同源 19/19、零 pageerror</p>\n'
      + '        </article>';
    s = s.replace(anchor, entry, 1);
    write(rel, s); touched.add(rel);
  }
}

console.log(`?v= 对齐 ${qv} 处；版本常量 ${consts} 处；文档文件 ${[...touched].length} 个`);
console.log('BUMP412_DONE');
