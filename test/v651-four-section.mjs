/* v6.5.1 四段式 + 唯一区域 · Node 纯函数回归 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PE = require('../js/patch-engine.js');
const GC = require('../js/github-client.js');

let p = 0, f = 0;
const ok = (n, c, x) => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ FAIL ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };

console.log('\n[1] 四段式编解码往返');
const pkg = { dir: 'community/packages', files: ['community/packages/x-1.zip.b64'], innerFiles: ['manifest.json', 'content/0.json'], rawUrl: 'https://raw/x', size: 3586 };
const body = PE.buildFourSectionBody({
  intro: '剑来·武夫十一境增强',
  feature: '数值细化；地图考据；新增词条',
  content: 'DLC×2\n存档×1\n· [DLC] dlc/storyDLC_free（add）',
  pkg: pkg
});
ok('含 YJ_V2 标记', body.indexOf('<!--YJ_V2-->') === 0);
ok('四段标题齐全', ['## 简介', '## 特点', '## 二创内容', '## 打包源码'].every(s => body.indexOf(s) >= 0));
const parsed = PE.parseFourSectionBody(body);
ok('解析非空', !!parsed);
ok('简介往返一致', parsed.intro === '剑来·武夫十一境增强', parsed.intro);
ok('特点往返一致', parsed.feature.indexOf('数值细化') >= 0);
ok('二创内容往返一致', parsed.content.indexOf('dlc/storyDLC_free') >= 0);
ok('打包源码解析为对象', parsed.pkg && parsed.pkg.dir === 'community/packages', parsed.pkg);
ok('打包源码文件数', parsed.pkg.files.length === 1);

console.log('\n[2] 四段顺序固定');
const i1 = body.indexOf('<!--YJ_INTRO-->'), i2 = body.indexOf('<!--YJ_FEATURE-->'), i3 = body.indexOf('<!--YJ_CONTENT-->'), i4 = body.indexOf('<!--YJ_PACKAGE-->');
ok('顺序 简介<特点<内容<源码', i1 < i2 && i2 < i3 && i3 < i4, { i1, i2, i3, i4 });

console.log('\n[3] 完整性校验');
ok('四段齐全 ok', PE.validateFourSection({ intro: 'a', feature: 'b', content: 'c', pkg: 'd' }).ok);
const v = PE.validateFourSection({ intro: '', feature: '', content: 'c', pkg: {} });
ok('缺失被列出', !v.ok && v.missing.length === 3, v);
ok('中文段名', v.missing.includes('简介') && v.missing.includes('特点') && v.missing.includes('打包源码'));

console.log('\n[4] 老作品回退');
const oldBody = '<!--YJ_NOTE-->老版单段说明<!--/YJ_NOTE-->\n<!--YJ_GIST-->{"rawUrl":"https://old"}<!--/YJ_GIST-->';
ok('老作品 parse 返回 null', PE.parseFourSectionBody(oldBody) === null);

console.log('\n[5] 特殊字符转义');
const weird = PE.buildFourSectionBody({ intro: '含 --> 箭头', feature: 'f', content: 'c', pkg: 'p' });
const wp = PE.parseFourSectionBody(weird);
ok('--> 被转义再还原', wp.intro === '含 --> 箭头', wp.intro);

console.log('\n[6] 唯一区域常量');
ok('LABEL=二创投稿', GC.LABEL === '二创投稿', GC.LABEL);
ok('PACKAGE_DIR=community/packages', GC.PACKAGE_DIR === 'community/packages', GC.PACKAGE_DIR);
ok('暴露 uploadPackageFile', typeof GC.uploadPackageFile === 'function');

console.log('\n========== 结果 ==========');
console.log('PASS=' + p + ' FAIL=' + f);
process.exit(f ? 1 : 0);
