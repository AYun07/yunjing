/* 云境 · 离线服务 worker v3.46.1
   仅在 https:// 或 localhost 下注册；缓存优先 + 后台更新

   v3.46.1 修复：
     1. SW_VER 递增（v3.46.8 → v3.46.9）—— 否则 PWA 用户永远命中旧缓存，
        改了代码也看不到效果（本项目最易踩的坑）
     2. CORE2 清单补全 v3.46.0 新增模块（atlas-panel / immersive-suite /
        player-kit / world-runtime 全系等 60+ 文件），此前离线模式功能残缺
     3. 版本号体系与主版本 v3.46.0 对齐
*/
const SW_VER = 'yunjing-v3.55.7';  /* v3.55.7 云端同步与开源：云起预设/正则上 GitHub（公开仓库「云境」），云境内新增 ☁ 云端同步（js/yunqi-sync.js，多源回退：jsDelivr/raw/ghproxy/gh-proxy，先比 470B 版本文件再决定拉不拉全量）——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。v3.55.6 云起专属美化：云起·XX美化 14 条正则 + 卡片专属皮肤/时徽章/行动选项徽章——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
   v3.55.5 云起预设：内置预设/正则换云境原创（230块+16条），第三方预设数据出清——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
   v3.55.4 轻量提速二期：存档合并写/面板签名缓存/预设数据懒加载/回放分帧——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
   v3.55.3 小云长发可御可萝 + 动态动效 + 正文文生图：SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
   v3.50.0 品牌更名与视觉精修：INDEX/STUDIO/CSS/JS 全量改动，SW_VER 从 moshu-v3.47.18 跃迁——旧 PWA 安装的 moshu-* 缓存在 activate 阶段整体清除并重灌，否则用户永远看到旧版（本项目最易踩的坑）。
   v3.50.0 另修：世界书改为 js/kb/<界>.js 分界装载，33 个分界文件补入预缓存清单，离线模式下换界仍能挂载对应世界书；补入 css/yunjing-theme.css 与 js/kb-vector.js（向量检索模块）。
   ——改动必须递增 SW_VER */
const CORE = [
  './', './index.html', './studio.html', './manifest.webmanifest',
  './story-framework.js', './favicon.ico', './icon-192.png', './icon-512.png',
  './apple-touch-icon.png', './css/ui-polish.css', './mobile-server.ps1',
  /* v3.55.3 小云长发可御可萝：离线时桌面宠物（萝/御双形态）与各处头像都要能显示。
     v3.55.3 资产瘦身：四张小云图压缩（2.3MB→170KB）后仍保质；旧版 xiaoyun-chibi.png/
     xiaoyun-face.png/mo-chibi.png 全库零引用（只有本清单在拉），一并移除——少下载 623KB */
  './assets/xiaoyun-chibi-luo.png', './assets/xiaoyun-chibi-yu.png',
  './assets/xiaoyun-face-luo.png', './assets/xiaoyun-face-yu.png',
  /* v3.55.3 手机分身头像雪碧图（压缩后 145KB）补入预缓存：离线也有头像，不再回退首字块 */
  './assets/phone/avatars-m.jpg', './assets/phone/avatars-f.jpg'
];

/* #12 全量预缓存:引擎 + 33界配置/扩展/主题 */
const GENRES = ["mystery","scifi","wuxia","cthulhu","free","swallowedstar","shrouding","quanzhigaoshou","doupocangqiong","wanmeishijie","douluodalu","daoguiyixian","zhongshengdushi","dibao","longzu","quanzhifashi","limingzhijian","lunhuileyuan","wulianfengdian","shengxu","shenmifusu","ditandali","fanrenxiuxian","xianni","earth","freeworld","quanqiubingfeng","chaoshenxueyuan","zhanhen","jianlai","guimi","guzhenren","xuanjianxianzu"];
const GEN = [];
GENRES.forEach(g => {
  GEN.push('configs/' + g + '-config.js', 'js/world-ext/' + g + '-ext.js', 'css/' + g + '-style.css');
  GEN.push('js/kb/' + g + '.js');   /* v3.50.0 分界世界书：离线换界也能挂载对应世界书 */
});
const CORE2 = CORE.concat(GEN, [
  /* --- 基础样式 --- */
  'css/base-style.css','css/immersive-style.css','css/yunjing-theme.css',
  /* --- 引导与守卫 --- */
  'js/boot-error-guard.js','js/system-guard.js','js/store-guard.js','js/antibagu-guard.js',
  /* --- 核心引擎 --- */
  'js/api-calling-functions.js','js/variable-parser.js','js/ai-message-builder.js',
  'js/ai-response-handler.js','js/user-input-handler.js','js/story-status-renderer.js',
  'js/entity-engine.js','js/variable-ai.js','js/dynamic-world.js',
  'js/image-gen.js','js/prompt-engineer.js','js/prompt-budget.js',
  /* --- 云起预设（v3.55.5 内置原创） --- */
  'js/preset-yunqi.js','js/miaomiao-engine.js','js/miaomiao-bridge.js',
  'js/yunqi-regex-data.js','js/miaomiao-regex.js',
  'js/yunqi-sync.js',
  /* --- 设定与向导 --- */
  'js/story-setup-wizard.js','js/config-modal.js','js/ui-dialog.js',
  /* --- v3.53.0 主题工坊 + 保险箱 --- */
  'js/theme-studio.js','js/vault.js',
  /* v3.53.0 新增：原创设计工坊 / 状态栏字段全集 / 文件桥（离线也要能用） */
  'js/creator-forge.js','js/status-schema.js','js/file-bridge.js',
  'js/save-slots.js','js/card-io.js','js/card-hub.js',
  /* --- 知识库与 DLC ---
     v3.55.3 预缓存瘦身：js/preset-knowledge.js（9MB 整包）撤出预缓存——v3.53.0 起
     世界书已按界拆成 js/kb/<界>.js（33 个分包均在 GEN 预缓存，覆盖全部工坊），
     整包仅作「分包缺失时的回退」，几乎不会被加载；保留在包内供在线回退，
     但不再让低配设备一启动就背 9MB 下载与存储。预缓存总量 14.3MB → 5.3MB。 */
  'js/knowledge-manager.js','js/kb-enhance.js','js/kb-vector.js',
  'js/dlc-manager.js','js/st-import.js',
  /* --- 沉浸与展示（v3.46.0 新增，此前缺失） --- */
  'js/atlas-panel.js','js/immersive-suite.js','js/immersion-plus.js',
  'js/ambience-layer.js','js/game-layer.js','js/world-seals.js',
  'js/reader-letters.js','js/timeline-branch.js','js/relationship-graph.js',
  'js/lunar-stamp.js','js/inspiration-dice.js','js/celebration.js',
  /* --- 叙事增强 --- */
  'js/inspiration-engine.js','js/memory-layers.js','js/scene-state.js',
  'js/recap-engine.js','js/welcome-recap.js','js/quality-suite.js',
  'js/draft-lab.js','js/channel-hub.js','js/chapter-nav.js',
  'js/craft-meter.js','js/weekly-report.js','js/npc-portrait.js',
  /* --- 玩家随身套装与界扩展核 --- */
  'js/player-kit.js','js/world-ext/world-ext-core.js',
  'js/module-settings.js','js/module-forge.js','js/mobile-fit.js','js/id-migrate.js','js/preset-io.js','js/regex-io.js',
  /* --- 世界运行时（v3.46.0 新增，此前全缺） --- */
  'js/world-runtime.js','js/world-bus.js','js/world-stage.js',
  'js/world-director.js','js/world-legacy.js','js/world-plus.js',
  'js/story-hooks.js','js/quest-chain.js','js/combat-core.js',
  'css/world-runtime.css',
  /* --- 通讯与装备 --- */
  'js/comm-configs.js','js/comm-core.js','js/gear-core.js',
  /* --- 助手与小宠 --- */
  'js/mo-assistant.js','js/mo-chibi.js',
  /* --- v3.55.3 流畅模式 --- */
  'js/perf-mode.js',
  /* --- 存储 --- */
  'js/storage-boost.js','libs/localforage.min.js',
  /* --- 第三方库 --- */
  'libs/confetti.browser.min.js','libs/fantasy-names.min.js',
  /* --- 地球界手机分身（预缓存无害；v3.47.2 补 social 两件，离线模式不再缺模块） --- */
  'js/phone-panel.js','js/phone-alive.js','js/phone-apps.js','css/phone-style.css',
  'js/phone-social.js','css/phone-social.css',
  /* --- 安卓 WebView 桥 --- */
  'js/android-bridge.js'
]);
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SW_VER).then((c) =>
    c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))).catch(() => {})
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter(k => k !== SW_VER).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // AI 接口等跨域请求直连
  e.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SW_VER).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fetching;
    })
  );
});

/* 涓流预热:激活 8 秒后开始,每次只取 2 个,绝不阻塞页面 */
let _warmed = false;
function trickleWarmup() {
  if (_warmed) return; _warmed = true;
  caches.open(SW_VER).then((c) => {
    let i = 0;
    function next2() {
      if (i >= CORE2.length) return;
      const batch = CORE2.slice(i, i + 2); i += 2;
      Promise.all(batch.map(u => c.match(u).then(hit => hit ? null : c.add(u).catch(() => {})))).then(() => setTimeout(next2, 150));
    }
    next2();
  });
}
self.addEventListener('activate', (e) => { setTimeout(trickleWarmup, 8000); });