// 云境 · 一键回归测试（v4.36.0）
// 用法：node test/regression.mjs  （或 npm test 同时跑本文件与 core-regression.mjs）
// 目标：把关键引擎 + 存档防丢 + 静态不变量串成一条「改完就能跑」的回归线，
//       替代散落的一次性 verify 脚本。零依赖（Node 内置 vm/fs），不联网、不开浏览器。
// v4.42.0：世界时钟/逐日演化/并发闸门/gzip 兜底的深度用例已沉淀到 test/core-regression.mjs，
//       由 npm test 一并执行；本文件保留静态不变量与快速冒烟。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let pass = 0, fail = 0, group = '';
const G = (name) => { group = name; console.log('\n### ' + name); };
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.error('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
};

/* ============ 通用 mock 环境 ============ */
function makeEnv() {
  const store = {};
  const idb = {}; // name -> { storeName -> { key: value } }
  const localStorage = {
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] ?? null; },
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const fakeIndexDB = {
    databases: async () => Object.keys(idb).map(name => ({ name })),
    open(name) {
      const req = {};
      Promise.resolve().then(() => {
        if (typeof req.onsuccess !== 'function') return;
        req.result = {
          objectStoreNames: Object.keys(idb[name] || {}),
          transaction(sn) {
            const data = idb[name]?.[sn] || {};
            const tx = {};
            let pending = 2;
            const done = () => { if (--pending === 0 && typeof tx.oncomplete === 'function') tx.oncomplete(); };
            const mkReq = (result) => {
              const r = { result };
              Object.defineProperty(r, 'onsuccess', {
                configurable: true,
                set(fn) { Promise.resolve().then(() => { fn(); done(); }); }
              });
              return r;
            };
            const os = {
              getAllKeys: () => mkReq(Object.keys(data)),
              getAll: () => mkReq(Object.values(data))
            };
            tx.objectStore = () => os;
            return tx;
          },
          close() {}
        };
        req.onsuccess();
      });
      return req;
    }
  };
  const storyFramework = {
    genre: 'free', slotId: 'main', genreKey: 'free',
    storyState: { variables: {}, setup: {}, isStoryStarted: false },
    config: { genreName: '自由创作', genre: 'free' },
    saveStory() {}, flushSave() {}
  };
  const noopEl = () => ({ style: {}, className: '', id: '', textContent: '', innerHTML: '',
    setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {}, click() {} });
  const win = {
    localStorage, indexedDB: fakeIndexDB, storyFramework, console,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    Blob: class { constructor(parts) { this.parts = parts; this.size = String(parts[0] || '').length; } },
    /* v4.36.0：存档编解码/回退明文路径用到 TextEncoder/TextDecoder，vm 沙箱需显式注入 */
    TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder,
    FileReader: class {
      readAsText(file) { queueMicrotask(() => { this.result = file._text; this.onload?.(); }); }
    },
    URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, requestAnimationFrame: (f) => setTimeout(f, 0),
    location: { search: '', href: 'http://localhost/studio.html', protocol: 'http:' },
    Math, Date, JSON, Promise, RegExp, String, Number, Array, Object,
    Set, Map, isFinite, parseInt, parseFloat,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    Event: class {}, dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
    YunjingID: { APP: 'yunjing', acceptApp: (a) => a === 'yunjing' || a === 'moshu', dbName: (n) => n.replace('moshu', 'yunjing') },
    YJ_VER: '4.36.0',
    showToast() {},
    SlotRegistry: {
      genre: () => 'free', slotId: () => 'main',
      // 模拟真实规则：主档裸键，副档带 ~sid 后缀
      keysOf: (sid, g) => {
        const sfx = (!sid || sid === 'main') ? '' : ('~' + sid);
        const gg = g || 'free';
        return ['storySave_' + gg + sfx, 'worldExt_' + gg + sfx, 'yunjingWorldBook:' + gg + sfx,
          'yunjingBeasts~' + (sid || 'main'),
          'yunjingWorldRuntime~' + (sid || 'main') + '~' + gg,
          'yunjingCanonLedger:' + (sid || 'main') + ':' + gg,
          'yunjing.clock.' + (sid || 'main') + '~' + gg];
      },
      scanKeysOf: () => []
    },
    StorageBoost: {
      async get(k) { return idb.yunjing?.media?.[k] ?? ''; },
      async put(k, v) { (idb.yunjing ||= {}).media ||= {}; idb.yunjing.media[k] = v; return true; },
      capacity: async () => ({ ok: true, used: 1024, quota: 1024 ** 3, pct: 0.1 })
    },
    localforage: {
      createInstance({ name, storeName }) {
        return {
          async setItem(k, v) { (idb[name] ||= {})[storeName] ||= {}; idb[name][storeName][k] = v; },
          async getItem(k) { return idb[name]?.[storeName]?.[k] ?? null; },
          async keys() { return Object.keys(idb[name]?.[storeName] || {}); }
        };
      }
    },
    document: {
      readyState: 'complete', addEventListener() {},
      createElement: noopEl, getElementById: () => null,
      head: { appendChild() {} }, body: { appendChild() {} },
      querySelectorAll: () => []
    }
  };
  win.window = win; win.globalThis = win;
  return { ctx: vm.createContext(win), win, store, idb };
}
function load(env, files) { for (const f of files) vm.runInContext(read('js/' + f), env.ctx, { filename: f }); }

/* ================= 1. 存档防丢（P0 核心） ================= */
G('1. 存档两层备份 / 恢复 / 快照');
{
  const e = makeEnv();
  load(e, ['save-slots.js']);
  const S = e.win.SaveSlots;
  ok('SaveSlots 已加载', !!S);
  ok('新增 exportAll/importAll/undoLastImport', typeof S.exportAll === 'function' && typeof S.importAll === 'function' && typeof S.undoLastImport === 'function');

  // 造数据：localStorage 两层 + IDB 正文
  e.store['storyApiConfig'] = JSON.stringify({ key: 'sk-test' });
  e.store['storySave_free'] = '{正文占位}';
  e.store['worldExt_free'] = '{"stage":3}';
  e.idb.yunjing = { media: { 'img_001': 'data:image/png;base64,AAAA', 'txt_002': '一长段正文实体' } };

  const ls = S.collectLS('all');
  ok('collectLS(all) 收全 localStorage（含 API Key）', !!ls.storyApiConfig && !!ls.storySave_free);
  const scoped = S.collectLS('slot', 'main');
  ok('collectLS(slot) 收槽位散落键', !!scoped['storySave_free'] && !!scoped['worldExt_free']);

  const idb = await S.collectIDB();
  ok('collectIDB 收全 IndexedDB media 仓', !!idb.yunjing?.media?.['img_001'] && !!idb.yunjing?.media?.['txt_002'],
    JSON.stringify(idb).slice(0, 120));

  // 快照 → 改数据 → 撤销
  await S._snapshotBeforeImport();
  e.store['storyApiConfig'] = '被覆盖';
  await S.undoLastImport();
  ok('undoLastImport 恢复到导入前快照', e.store['storyApiConfig'] === JSON.stringify({ key: 'sk-test' }), e.store['storyApiConfig']);
}

/* ================= 2. 单档导出带正文 ================= */
G('2. 单档导出补齐散落键 + idb:// 正文');
{
  const e = makeEnv();
  load(e, ['save-slots.js']);
  const S = e.win.SaveSlots;
  e.store['storySave_free'] = JSON.stringify({ variables: { title: '测试书' }, scene: 'idb://txt_002 处' });
  e.store['worldExt_free'] = '{"stage":5}';
  e.idb.yunjing = { media: { 'txt_002': '被 idb:// 引用的正文实体' } };
  let captured = null;
  e.win.URL.createObjectURL = (blob) => { captured = blob; return 'blob:mock'; };
  await S.exportSlot('main');
  ok('exportSlot 产出 Blob', !!captured);
  let pkg = null;
  try {
    const part = captured.parts[0];
    const asText = (part instanceof Uint8Array) ? new TextDecoder().decode(part) : String(part);
    pkg = JSON.parse(asText);
  } catch (err) {}
  ok('导出包含 scoped 散落键', !!pkg?.scoped?.['worldExt_free']);
  ok('导出包含 idb:// 指向的 media 实体', pkg?.media?.['txt_002'] === '被 idb:// 引用的正文实体', JSON.stringify(pkg?.media));
}

/* ================= 2b. 单档导入的键重映射（防污染，v4.28.0 修复） ================= */
G('2b. 单档导入散落键重映射（主档/副档/D冒号/E点号格式）');
{
  const e = makeEnv();
  load(e, ['save-slots.js']);
  const S = e.win.SaveSlots;
  // 主档裸键 → 新槽位：必须带新槽后缀，不能覆盖主档
  ok('主档裸键加新槽后缀', S.remapScopedKey('storySave_free', 'main', 'sNEW', 'free') === 'storySave_free~sNEW',
    S.remapScopedKey('storySave_free', 'main', 'sNEW', 'free'));
  // B 类 ~main
  ok('B类 ~main 重映射', S.remapScopedKey('yunjingBeasts~main', 'main', 'sNEW', 'free') === 'yunjingBeasts~sNEW',
    S.remapScopedKey('yunjingBeasts~main', 'main', 'sNEW', 'free'));
  // C 类 ~sid~genre
  ok('C类 ~sid~genre 重映射', S.remapScopedKey('yunjingWorldRuntime~sOLD~free', 'sOLD', 'sNEW', 'free') === 'yunjingWorldRuntime~sNEW~free',
    S.remapScopedKey('yunjingWorldRuntime~sOLD~free', 'sOLD', 'sNEW', 'free'));
  // D 类冒号
  ok('D类 :sid: 重映射', S.remapScopedKey('yunjingCanonLedger:sOLD:free', 'sOLD', 'sNEW', 'free') === 'yunjingCanonLedger:sNEW:free',
    S.remapScopedKey('yunjingCanonLedger:sOLD:free', 'sOLD', 'sNEW', 'free'));
  // E 类点号
  ok('E类 .sid~ 重映射', S.remapScopedKey('yunjing.clock.sOLD~free', 'sOLD', 'sNEW', 'free') === 'yunjing.clock.sNEW~free',
    S.remapScopedKey('yunjing.clock.sOLD~free', 'sOLD', 'sNEW', 'free'));

  // 完整导入流程：导入一个主档单档，当前主档数据必须保持不变
  const e2 = makeEnv();
  load(e2, ['save-slots.js']);
  const S2 = e2.win.SaveSlots;
  e2.store['storySave_free'] = '当前主档正文'; // 当前主档
  const pkg = {
    app: 'yunjing', ver: '4.28.0', genre: 'free', slotId: 'main',
    meta: { name: '导入档' }, save: { variables: { title: '导入的书' } },
    scoped: { storySave_free: '被导入的主档正文', worldExt_free: '{"stage":9}' }
  };
  // 模拟 FileReader.readAsText
  // v4.35+ _readSmart 用 file.arrayBuffer()（gzip 魔数识别），真实 File 都支持；
  // 旧桩只有 _text，这里补上 arrayBuffer 以匹配真实浏览器行为
  const pkgBytes = new TextEncoder().encode(JSON.stringify(pkg));
  const fakeFile = { _text: JSON.stringify(pkg), arrayBuffer: async () => pkgBytes.buffer };
  let imported = false;
  e2.win.UIDialog = null; // 走原生 confirm
  e2.win.confirm = () => true;
  e2.win.location.reload = () => { imported = true; };
  S2.importSlot(fakeFile);
  await new Promise(r => setTimeout(r, 30));
  ok('导入主档后当前主档正文未被覆盖', e2.store['storySave_free'] === '当前主档正文', e2.store['storySave_free']);
  // 导入的内容应落在新槽（~s...）键上
  const newKeys = Object.keys(e2.store).filter(k => k.startsWith('storySave_free~s'));
  ok('导入内容落到新槽键', newKeys.length === 1 && e2.store[newKeys[0]] === JSON.stringify(pkg.save), newKeys.join(','));
}

/* ================= 3. 填表规则双模式 ================= */
G('3. FillRule 严格演算 / 玩家自由双模式');
{
  const e = makeEnv();
  load(e, ['fill-rule.js']);
  const F = e.win.FillRule;
  ok('FillRule 已加载', !!F);
  F.setMode('strict');
  ok('strict 模式判定', F.isStrict() && !F.isFree());
  ok('strict 注入引擎钳制指令', /严格演算|禁止口胡/.test(F.directive()) && F.shouldEnforceEngine() === true);
  F.setMode('free');
  ok('free 模式判定', F.isFree() && !F.isStrict());
  ok('free 关闭钳制且玩家优先', /玩家说什么就是什么|玩家说了算/.test(F.directive()) && F.shouldEnforceEngine() === false);
  ok('模式写入 localStorage', e.store['yunjingFillMode'] === 'free');
}

/* ================= 4. 多值字段全界覆盖 ================= */
G('4. 多值栏目全界识别');
{
  const e = makeEnv();
  load(e, ['status-world-fields.js']);
  const W = e.win.StatusWorldFields;
  ok('StatusWorldFields 已加载', !!W);
  const isMulti = W.isMulti;
  ok('导出 isMulti 判定函数', typeof isMulti === 'function');
  if (typeof isMulti === 'function') {
    const labels = Object.keys(W.MULTI_LABELS || {});
    ok('多值语义表非空（' + labels.length + ' 项）', labels.length >= 40, String(labels.length));
    const hit = labels.filter(isMulti).length;
    ok('多值标签全部可被 isMulti 识别', hit === labels.length, hit + '/' + labels.length);
    // 36 界字段表规模（每界独立字段）
    ok('覆盖 36 界字段表', Object.keys(W.W || {}).length >= 36, String(Object.keys(W.W || {}).length));
  }
  // 专名零残留：只看实际数据行（排除 * 注释里「已剔除…」的说明举例）
  const src = read('js/status-world-fields.js');
  const banned = ['药老之师', '萧家族人', '佛怒火莲', '天逆珠', '魂殿', '李慕婉'];
  const codeLines = src.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  const leaked = banned.filter(b => codeLines.includes(b));
  ok('状态字段零原著专名残留（排除注释说明）', leaked.length === 0, leaked.join(','));
}

/* ================= 5. 静态不变量（版本同源 / 语法） ================= */
G('5. 静态不变量');
{
  const idx = read('index.html');
  const studio = read('studio.html');
  /* 版本号不写死：从唯一来源 studio.html 派生，避免每次升版都要改测试 */
  const verM = studio.match(/window\.YJ_VER\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
  const CUR = verM ? verM[1] : '';
  ok('能从唯一来源读到版本号', !!CUR, CUR);
  const idxVerM = idx.match(/YJ_VER\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
  ok('index.html YJ_VER 与唯一来源同源', !!idxVerM && idxVerM[1] === CUR, (idxVerM && idxVerM[1]) + ' vs ' + CUR);
  /* DR-007：旧实现只扫 idx+studio 两个 HTML，JS 内 ?v= 参数（真实加载路径）全部漏检，
     造成「测试全绿但 46 处旧戳残留」的假阳性。改为扫描全部 JS + 全部根 HTML（排除 .ext 数据）。 */
  let scanAll = idx + studio;
  try {
    const jsDir = path.join(ROOT, 'js');
    for (const f of fs.readdirSync(jsDir)) {
      if (!f.endsWith('.js') || f.endsWith('.ext.js')) continue;
      scanAll += '\n' + fs.readFileSync(path.join(jsDir, f), 'utf8');
    }
    for (const f of fs.readdirSync(ROOT)) {
      if (!f.endsWith('.html') || f === 'selftest.html') continue;
      scanAll += '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');
    }
  } catch (e) {}
  const cacheParams = scanAll.match(/\?v=\d+\.\d+\.\d+/g) || [];
  const stale = cacheParams.filter(v => v !== '?v=' + CUR);
  ok('缓存参数无旧版本残留(全JS+HTML)', stale.length === 0, [...new Set(stale)].slice(0, 5).join(','));
  ok('sw.js 预缓存含 save-slots.js', read('sw.js').includes('save-slots.js'));
  ok('studio.html 加载 save-slots.js', read('studio.html').includes('save-slots.js'));
  // 全量 JS 语法（借 node --check 通过子进程太重，这里做括号配平的粗检 + 关键模块可加载）
  const critical = ['save-slots.js', 'fill-rule.js', 'attribute-engine.js', 'status-world-fields.js', 'xiaoyun-ops.js', 'xiaoyun-buddy.js'];
  let loadOk = true;
  for (const f of critical) {
    try { const e = makeEnv(); load(e, [f]); } catch (err) { loadOk = false; console.error('    加载失败:', f, err.message); }
  }
  ok('关键模块全部可在沙箱加载', loadOk);
}

/* ================= 汇总 ================= */
console.log('\n' + '='.repeat(46));
console.log(`回归测试：${pass} 通过 / ${fail} 失败`);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
