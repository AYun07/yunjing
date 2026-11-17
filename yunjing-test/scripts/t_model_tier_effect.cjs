/* 云境 v4.12.0 · 档位对「真实体验」影响的集成验收（node vm 真加载模块）
 * 证明：自适应升到 full 后，玩家看到的确实是「全量世界设定 + 不锁参数」的最好效果；
 *       弱模型走 lite 时压缩生效但铁律句不丢（安全兜底仍在）。
 * 不臆造内部实现：直接调用模块公开的 isLite/clampParams/compactSystemPrompt/ctxTier。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const code = fs.readFileSync(path.join(ROOT, 'js/base-model-mode.js'), 'utf8');

const results = [];
function rec(name, ok, detail) { results.push({ name, ok, detail: detail || '' }); }

function makeEnv(cfg, tier, ctxTokens) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
  const win = {
    storyFramework: { apiConfig: Object.assign({ baseModelMode: tier || 'auto' }, cfg), saveApiConfig() {} },
    addEventListener() {},
    PromptBudget: { ctxTokens: () => ctxTokens || 0, lastReport: { total: 0 } }
  };
  const ctx = { window: win, console, Date, Math, setTimeout, localStorage };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'base-model-mode.js' });
  return win.BaseModelMode;
}

// 一段仿真的世界系统提示词（含段标题、铁律句、普通叙述），长度 > 2800 以触发压缩
const WORLD = [
  '## 世界观总纲',
  '青石镇位于大江南岸，是三州通衢的水陆码头，晨雾常年不散。镇上以渡口为中心，沿河三条长街，商贾与船工杂处。',
  '铁律：不得改动主角既有数值，境界体系严格遵循原著。',
  '## 境界体系',
  '此界修行分炼气、筑基、金丹、元婴、化神五境，每境九重，禁止越境跳写。镇上最高不过筑基后期。',
  '严禁编造原著不存在的宗门、功法与地名。',
  '## 势力',
  '渡口由「漕帮」与「巡检司」共管，另有隐世药铺一间。三方维持着脆弱的平衡，任何一方坐大都会引来其余两方联手。',
  '必须保持三方制衡，不得让主角一举吞并。',
  '## 风土',
  '每逢朔望，河灯顺流而下，家家在门前摆三碟粗点。船工忌讳说「沉」字，改口叫「落」。茶棚掌柜姓周，寡言，记得每个常客的口味。',
  '## 近期大事',
  '去岁秋汛冲垮了东石桥，至今只搭了木栈。上游松林里有人见过不该在此季出现的白鹭，镇里议论纷纷却无人深究。',
].join('\n');
const WORLD_LEN = WORLD.length;
// 补足到明显超过 2800，确保压缩路径真的会走（用不重复的合法叙述句填充）
let filler = '';
for (let i = 0; i < 60; i++) {
  filler += '\n第' + i + '条杂记：' + ['河埠','巷口','茶棚','渡船','石阶','柳堤','货栈','更夫'][i % 8] +
    '一带的' + ['晨市','夜柝','潮汐','风向','灯火','人声'][i % 6] + '随季节略有不同，老住户都习惯了。';
}
const LONG_WORLD = WORLD + filler;

// ① full 档：世界设定原文全保留（不压缩），参数不锁
{
  const m = makeEnv({ endpoint: 'https://my-proxy.example.com/v1', model: 'gpt-4o' }, 'auto', 32768);
  const isLite = m.isLite();
  const compacted = isLite ? m.compactSystemPrompt(LONG_WORLD, 2800) : LONG_WORLD;
  const params = isLite ? m.clampParams({ temperature: 1.0, maxTokens: 32000 }) : { temperature: 1.0, maxTokens: 32000 };
  rec('① full 档 世界设定原文全保留', !isLite && compacted === LONG_WORLD,
      'isLite=' + isLite + ' 原文=' + LONG_WORLD.length + ' 装配=' + compacted.length);
  rec('① full 档 尊重玩家参数不锁', params.temperature === 1.0 && params.maxTokens === 32000,
      'temp=' + params.temperature + ' max=' + params.maxTokens);
}

// ② 未知强模型：初判 lite，此时确实被压缩 + 锁参数（这是"保守起步"的代价）
{
  const m = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-v1' }, 'auto', 8192);
  const compacted = m.isLite() ? m.compactSystemPrompt(LONG_WORLD, 2800) : LONG_WORLD;
  rec('② 未知模型 lite 起步时压缩生效', m.isLite() && compacted.length <= 2800,
      'isLite=' + m.isLite() + ' 压后=' + compacted.length + '/' + LONG_WORLD.length);
}

// ③ 关键：连续 2 轮稳定输出升 full 后，压缩消失、参数解锁（体验真的变好）
{
  const m = makeEnv({ endpoint: 'https://unknown-gw.internal/api', model: 'mystery-v1' }, 'auto', 8192);
  // 结构与 t_model_adaptive.cjs 的 GOOD 同口径：>400 字、不崩塌、含完整协议块
  const GOOD = [
    '青石镇的晨雾还没散，他沿着被夜雨打湿的巷子往渡口走，',
    '檐角滴下的水落在肩头，凉意顺着衣领往里钻。街尾的茶棚刚支起来，',
    '炉火噼啪，掌柜的抬眼看了看天色，没多问，只把一碗热汤推到桌边。',
    '他端起碗，指节被烫得一缩，却没放下。远处传来渡船的橹声，一下，又一下，',
    '像谁在不紧不慢地数着时辰。他把铜钱压在碗底，起身时衣摆扫过凳脚，',
    '带起一点湿灰。河风迎面，带着水腥和上游松林的气味，他眯了眯眼，',
    '把怀里的信又按了按，确认没被雨浸透，这才朝石阶下走去。'
  ].join('') +
    Array.from({ length: 8 }, (_, i) =>
      '第' + i + '步' + ['拾阶','问路','登船','回望','拢衣','听橹','歇脚','解缆'][i] + '，' +
      ['风声渐紧','灯火摇动','雪落无声','远处犬吠'][i % 4] + '，' +
      '老柳的枝条在雾里忽明忽暗，像有人欲言又止。').join('') +
    '\n\n(variable_update)\n回合=回合+1\n位置=青石镇渡口\n(/variable_update)\n' +
    '【行动选项】\n1. 【快进】径直登船离镇\n2. 【交互】向掌柜打听时辰\n3. 【整活】替茶棚挑水\n' +
    '4. 【慢推】沿河看水势\n5. 【时空】回想离镇那日\n6. 【成人】与故人叙旧\n' +
    '<status>\n回合：2 ｜ 位置：青石镇渡口 ｜ 状态：清醒\n</status>';
  const before = m.isLite();
  m.noteStable(GOOD);
  m.noteStable(GOOD);
  const after = m.isLite();
  const compacted = after ? m.compactSystemPrompt(LONG_WORLD, 2800) : LONG_WORLD;
  const params = after ? m.clampParams({ temperature: 1.0, maxTokens: 32000 }) : { temperature: 1.0, maxTokens: 32000 };
  rec('③ 升 full 后 压缩消失（世界设定全量注入）', before === true && after === false && compacted === LONG_WORLD,
      `lite:${before}→${after} 装配字数 ${LONG_WORLD.length}→${compacted.length}`);
  rec('③ 升 full 后 参数解锁', params.temperature === 1.0 && params.maxTokens === 32000,
      'temp=' + params.temperature + ' max=' + params.maxTokens);
}

// ④ lite 压缩仍守住铁律句（安全兜底没被削掉）
{
  const m = makeEnv({ endpoint: 'https://x/v1', model: 'tiny-model' }, 'lite', 8192);
  const compacted = m.compactSystemPrompt(LONG_WORLD, 2800);
  const musts = ['铁律：不得改动主角既有数值', '严禁编造原著不存在的宗门', '必须保持三方制衡', '禁止越境跳写'];
  const kept = musts.filter((x) => compacted.indexOf(x) !== -1);
  rec('④ lite 压缩守住铁律句', compacted.length <= 2800 && kept.length === musts.length,
      `压后=${compacted.length} 铁律保留 ${kept.length}/${musts.length}`);
}

// ⑤ ctxTier 上下文窗口分档正确
{
  const a = makeEnv({ endpoint: 'https://x/v1', model: 'm' }, 'lite', 8192);
  const b = makeEnv({ endpoint: 'https://x/v1', model: 'm' }, 'lite', 16384);
  const c = makeEnv({ endpoint: 'https://x/v1', model: 'm' }, 'lite', 65536);
  rec('⑤ ctxTier 分档 tiny/small/normal', a.ctxTier() === 'tiny' && b.ctxTier() === 'small' && c.ctxTier() === 'normal',
      `${a.ctxTier()}/${b.ctxTier()}/${c.ctxTier()}`);
}

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
console.log(`档位对真实体验的影响验收 -> ${pass}/${results.length} 通过`);
for (const r of fail) console.log(`  ✗ ${r.name}  ${r.detail}`);
if (!fail.length) console.log('MODEL_TIER_EFFECT_OK ✓ 升 full 后全量设定/不锁参数；lite 压缩守铁律');
else process.exit(1);
