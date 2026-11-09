/* 云境 v4.11.1 · 模型无关自适应专项验收（node vm 真加载 js/base-model-mode.js）
 *
 * 背景：玩家用任意厂商/中转/本地部署的模型。开发期测试用的 agnes-3.0-flash 只是夹具，
 * 不是产品型号约束。旧版 auto 只看 endpoint 域名（自建网关一律判 lite）且单向锁死，
 * 强模型被白白砍掉全功能。本验收证明修复后：
 *   ① 自定义域名 + 旗舰模型名 → 直接 full；
 *   ② 完全未知模型 → 保守 lite，但连续 2 轮结构完整输出 → 自动升 full；
 *   ③ 崩塌 → 立即降 lite；④ 手动档优先；⑤ 换模型缓存隔离；⑥ 连通测试短回复不升档。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const code = fs.readFileSync(path.join(ROOT, 'js/base-model-mode.js'), 'utf8');

const results = [];
function rec(name, ok, detail) { results.push({ name, ok, detail: detail || '' }); }

// 最小 mock：localStorage + window + fwApiConfig
function makeEnv(cfg, tier) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
  const listeners = {};
  const win = {
    storyFramework: { apiConfig: Object.assign({ baseModelMode: tier || 'auto' }, cfg), saveApiConfig() {} },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }
  };
  const ctx = { window: win, console, Date, Math, setTimeout, clearTimeout, localStorage };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'base-model-mode.js' });
  return { BMM: win.BaseModelMode, store, cfg: win.storyFramework.apiConfig };
}

// 一段「结构完整、不崩塌」的正常回复（>400字 + 6选项 + 变量块 + 状态栏）
const GOOD = [
  '青石镇的晨雾还没散，他沿着被夜雨打湿的巷子往渡口走，',
  '檐角滴下的水落在肩头，凉意顺着衣领往里钻。街尾的茶棚刚支起来，',
  '炉火噼啪，掌柜的抬眼看了看天色，没多问，只把一碗热汤推到桌边。',
  '他端起碗，指节被烫得一缩，却没放下。远处传来渡船的橹声，一下，又一下，',
  '像谁在不紧不慢地数着时辰。他把铜钱压在碗底，起身时衣摆扫过凳脚，',
  '带起一点湿灰。河风迎面，带着水腥和上游松林的气味，他眯了眯眼，',
  '把怀里的信又按了按，确认没被雨浸透，这才朝石阶下走去。'
].join('') +
  '\n\n(variable_update)\n回合=回合+1\n位置=青石镇渡口\n(/variable_update)\n' +
  '【行动选项】\n1. 【快进】径直登船离镇\n2. 【交互】向掌柜打听渡船时辰\n3. 【整活】顺手替茶棚挑两桶水\n4. 【慢推】沿河再走一段看水势\n5. 【时空】回想三年前离镇那日\n6. 【成人】与船上故人叙旧\n' +
  '<status>\n回合：2 ｜ 位置：青石镇渡口 ｜ 状态：清醒\n</status>';

// 一段「复读崩塌」回复（同句堆砌，触发 detectCollapse）
const COLLAPSE = ('他走向门前停下了脚步又退了回来，' .repeat(40));

// 连通测试短回复
const SHORT = '连接成功';

// ① 自定义域名 + 旗舰模型名 → full
{
  const { BMM } = makeEnv({ endpoint: 'https://my-proxy.example.com/v1', model: 'gpt-4o' });
  rec('① 自定义域名+旗舰模型名 初判 full', BMM.resolveTier() === 'full', 'tier=' + BMM.resolveTier());
}
// ①b 本地部署 70b 模型 → full
{
  const { BMM } = makeEnv({ endpoint: 'http://localhost:11434/v1', model: 'qwen2.5-72b-instruct' });
  rec('①b 本地部署 72b 模型 初判 full', BMM.resolveTier() === 'full', 'tier=' + BMM.resolveTier());
}
// ② 完全未知模型 → 保守 lite
{
  const { BMM } = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-model-v1' });
  rec('② 完全未知模型 保守 lite', BMM.resolveTier() === 'lite', 'tier=' + BMM.resolveTier());
}
// ③ 连续 2 轮结构完整 → 自动升 full（核心修复）
{
  const { BMM } = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-model-v1' });
  const before = BMM.resolveTier();
  BMM.noteStable(GOOD);
  const mid = BMM.resolveTier();
  BMM.noteStable(GOOD);
  const after = BMM.resolveTier();
  rec('③ 稳定 2 轮自动升 full', before === 'lite' && mid === 'lite' && after === 'full',
      `lite→${mid}→${after}`);
}
// ④ 崩塌 → 立即降 lite
{
  const { BMM } = makeEnv({ endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' });
  const before = BMM.resolveTier();
  BMM.noteCollapse();
  const after = BMM.resolveTier();
  rec('④ 崩塌立即降 lite', before === 'full' && after === 'lite', `${before}→${after}`);
}
// ⑤ 手动档优先：full 不受崩塌影响 / lite 不被升级
{
  const a = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-model-v1' }, 'full');
  a.BMM.noteCollapse();
  rec('⑤ 手动 full 不被降级', a.BMM.resolveTier() === 'full', 'tier=' + a.BMM.resolveTier());
  const b = makeEnv({ endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' }, 'lite');
  b.BMM.noteStable(GOOD); b.BMM.noteStable(GOOD);
  rec('⑤ 手动 lite 不被升级', b.BMM.resolveTier() === 'lite', 'tier=' + b.BMM.resolveTier());
}
// ⑥ 连通测试短回复不升档
{
  const { BMM } = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-model-v1' });
  BMM.noteStable(SHORT); BMM.noteStable(SHORT); BMM.noteStable(SHORT);
  rec('⑥ 短回复不误升档', BMM.resolveTier() === 'lite', 'tier=' + BMM.resolveTier());
}
// ⑦ 换模型缓存隔离：A 升到 full 后换到未知 B 应回 lite
{
  const { BMM, cfg } = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'model-A' });
  BMM.noteStable(GOOD); BMM.noteStable(GOOD);
  const aFull = BMM.resolveTier();
  cfg.model = 'model-B';
  const bTier = BMM.resolveTier();
  rec('⑦ 换模型缓存隔离', aFull === 'full' && bTier === 'lite', `A=${aFull} B=${bTier}`);
}
// ⑧ 质量探针本身：GOOD 判 capable / COLLAPSE 与 SHORT 判否
{
  const { BMM } = makeEnv({ endpoint: 'https://x.example/v1', model: 'm' });
  rec('⑧ 质量探针判据', BMM.looksCapable(GOOD) === true &&
      BMM.looksCapable(COLLAPSE) === false && BMM.looksCapable(SHORT) === false,
      `GOOD=${BMM.looksCapable(GOOD)} COLLAPSE=${BMM.looksCapable(COLLAPSE)} SHORT=${BMM.looksCapable(SHORT)}`);
}
// ⑨ detectCollapse 对 COLLAPSE 生效（确保④的降级信号真实）
{
  const { BMM } = makeEnv({ endpoint: 'https://x.example/v1', model: 'm' });
  rec('⑨ 崩塌检测对堆砌文本生效', BMM.detectCollapse(COLLAPSE) === true,
      'detectCollapse=' + BMM.detectCollapse(COLLAPSE));
}
// ⑩ clampParams 全档不锁用户参数（full）
{
  const { BMM } = makeEnv({ endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' });
  const c = BMM.clampParams({ temperature: 1.1, maxTokens: 32000 });
  rec('⑩ full 档尊重用户参数不锁', c.temperature === 1.1 && c.maxTokens === 32000,
      `temp=${c.temperature} max=${c.maxTokens}`);
}

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
console.log(`模型无关自适应验收 -> ${pass}/${results.length} 通过`);
for (const r of fail) console.log(`  ✗ ${r.name}  ${r.detail}`);
if (fail.length === 0) console.log('MODEL_ADAPTIVE_OK ✓ 双向升降 / 模型名识别 / 手动优先 / 缓存隔离 全部通过');
else process.exit(1);
