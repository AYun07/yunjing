/* v6.6.0 创意工坊单一文件夹 - 纯函数回归（Node，零依赖）
 * 验证：catalog 排序/去重、四段 README 构建与解析、路径唯一、作品文件夹命名。 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GC = require('../js/github-client.js');
const PE = require('../js/patch-engine.js');

let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}

console.log('\n[W1] 唯一文件夹常量与路径');
ok(GC.WORKS_DIR === 'community/works', 'WORKS_DIR=community/works');
ok(GC.PACKAGE_DIR === 'community/packages', '旧 PACKAGE_DIR 仍为兼容常量');
ok(GC.worksPath('20260101-a', 'package.zip') === 'community/works/20260101-a/package.zip', '作品包路径正确', GC.worksPath('20260101-a', 'package.zip'));
ok(GC.worksPath('bad/../x', 'README.md').indexOf('..') === -1, 'slug 被消毒，防目录穿越', GC.worksPath('bad/../x', 'README.md'));
ok(/^https:\/\/raw\.githubusercontent\.com\//.test(GC.getPackageUrl('s1')), 'getPackageUrl 生成 raw 直链');
ok(GC.getPackageUrl('s1').indexOf('/community/works/s1/package.zip') > 0, 'raw 直链指向 works 唯一文件夹');

console.log('\n[W2] 四段式 README 构建与解析（同处可读）');
const body = PE.buildFourSectionBody({
  intro: '为剑来补充武夫十一境',
  feature: '十一境数值细化\n剑气长城地图考据',
  content: 'DLC×2\n· [dlc] storyDLC_剑来（add）',
  pkg: { dir: 'community/works/20260101-a', files: ['package.zip'], innerFiles: ['manifest.json', 'content/0.json'], path: 'community/works/20260101-a/package.zip', size: 4096, hash: 'abc123', note: '内容层明文' }
});
ok(body.indexOf('<!--YJ_V2-->') >= 0, 'README 含四段式标记');
const parsed = PE.parseFourSectionBody(body);
ok(!!parsed, '四段 README 可被解析');
ok(parsed && parsed.intro.indexOf('武夫十一境') >= 0, '① 简介正确', parsed && parsed.intro);
ok(parsed && parsed.feature.indexOf('剑气长城') >= 0, '② 特点正确', parsed && parsed.feature);
ok(parsed && parsed.content.indexOf('DLC×2') >= 0, '③ 二创内容正确', parsed && parsed.content);
ok(parsed && parsed.pkgText.indexOf('community/works/') >= 0, '④ 打包源码含唯一文件夹路径', parsed && parsed.pkgText);
const valid = PE.validateFourSection(parsed);
ok(valid && valid.ok !== false, 'validateFourSection 不报缺失', valid);

console.log('\n[W3] catalog 清单：按时间倒序 + slug 去重（模拟 publishWork 的组装逻辑）');
function assemble(items, incoming) {
  items = items.filter(it => it.slug !== incoming.slug);
  items.push(incoming);
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return items;
}
let cat = [];
cat = assemble(cat, { slug: 'a', title: 'A', createdAt: '2026-01-01T10:00:00Z' });
cat = assemble(cat, { slug: 'b', title: 'B', createdAt: '2026-03-01T10:00:00Z' });
cat = assemble(cat, { slug: 'c', title: 'C', createdAt: '2026-02-01T10:00:00Z' });
ok(cat.map(x => x.slug).join(',') === 'b,c,a', '按时间倒序（新在前）', cat.map(x => x.slug));
cat = assemble(cat, { slug: 'b', title: 'B2', createdAt: '2026-03-01T10:00:00Z' });
ok(cat.length === 3 && cat[0].title === 'B2', '同 slug 覆盖不重复（CAS 语义）', cat);

console.log('\n[W4] 作品文件夹命名带时间戳（天然按时间排）');
function makeSlug(ts, title) {
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(ts);
  const stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  return stamp + '-' + String(title || 'work').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 20);
}
const s1 = makeSlug(new Date('2026-01-02T03:04:05Z').getTime(), '剑来·增强');
ok(/^\d{8}-\d{6}-/.test(s1), 'slug 前缀=时间戳', s1);
ok(s1.indexOf('剑来') >= 0, 'slug 含中文标题');
const sorted = ['20260101-a', '20260301-b', '20260201-c'].sort().reverse();
ok(sorted[0] === '20260301-b', '时间戳文件夹名字典序=时间序', sorted);

console.log('\n[W5] base64 编解码（中文正文不乱码）');
const txt = '四段式说明 · 中文正文 😀';
const enc = typeof Buffer !== 'undefined' ? Buffer.from(txt, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(txt)));
const dec = GC.decodeBase64Content(enc + '\n'); // 模拟 GitHub content 带换行
ok(dec.indexOf('四段式说明') >= 0 && dec.indexOf('😀') >= 0, 'contents API base64 解码中文正确', dec);

console.log('\n========== 结果 ==========');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
