/* 云境 · 离线服务 worker v3.46.1
   仅在 https:// 或 localhost 下注册；缓存优先 + 后台更新

   v3.46.1 修复：
     1. SW_VER 递增（v3.46.8 → v3.46.9）—— 否则 PWA 用户永远命中旧缓存，
        改了代码也看不到效果（本项目最易踩的坑）
     2. CORE2 清单补全 v3.46.0 新增模块（atlas-panel / immersive-suite /
        player-kit / world-runtime 全系等 60+ 文件），此前离线模式功能残缺
     3. 版本号体系与主版本 v3.46.0 对齐
*/
const SW_VER = 'yunjing-v3.60.1';  /* v3.60.1 御姐形态重绘：年轻时尚化（香槟金裙+白开衫+云朵耳坠），画风与全 12 态统一。v3.60.0 动态小云：行为引擎(蹦跳/转圈/闲逛/哼歌/真瞌睡)+亲密度+剧情感知+视线跟随+3张半身补全身。v3.59.1 小云十二形态（AI 生图 PNG，删 SVG）。v3.59.0 主界面换肤「晓云天光」+ 小云五形态换装。v3.58.0 世界自活（P6）：原创人物/势力/地点自动繁衍上图 + 自由人生。v3.57.0「让世界活起来」引擎全套（P2-P5）：
   v3.57.1 修复：EntityStore 单复数归一（list("characters") 曾恒空，关系连线在角色池上静默失效）。
   ① entity-editor.js 统一填表（法宝/势力/地点/关系，schema 驱动）
   ② sim-core.js 推演引擎（规则核心·种子化可复算·what-if 分叉）
   ③ world-clock.js 自主世界时钟（单飞有界定时器·后台不积累·世界日结算）
   ④ planner.js 剧情规划（持久化 + LLM 生成 + 指令注入推进闭环）
   ⑤ mo-tools.js 小云工具箱（世界诊断/推演解读/规划/时钟，快捷指令直达）
   v3.56.2 修复：upsert/link 接受可选 vars、remove 级联清关系边。v3.56.1 世界基座：统一实体模型 + 变量模板 + 校验器：
   ① 新增 js/world-schema.js：SchemaRegistry（设计者预定义本世界字段+类型+约束）/ EntityStore（统一角色·法宝·势力·地点·关系）/ SchemaValidator（解析出口钳制收敛，不否决 AI）
   ② variable-parser 出口挂 SchemaValidator.sanitize；world-ext onVars 每轮同步实体镜像；WorldExt.schema() 暴露模板与实体统计
   逐版说明见 changelog/。改动必须递增 SW_VER */
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
  /* v3.55.28：世界书二次拆分——core 进界即挂（≤45KB），ext 空闲补齐；离线同样两批缓存 */
  GEN.push('js/kb/' + g + '.core.js', 'js/kb/' + g + '.ext.js');
  GEN.push('js/kb/_index.json');   /* 整包回退前的轻量索引（1KB），避免为无数据的界白下 9MB */
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
      opt#1 后 js/preset-knowledge.js（9.4MB 整包）已从仓库删除——世界书按界拆成
      js/kb/<界>.core.js + .ext.js（66 个分包在 GEN 预缓存，覆盖全部工坊），
      core 加载失败直接报错不再回退整包。预缓存总量 14.3MB → 5.3MB。 */
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
  /* v3.55.28：phone-alive/phone-apps/phone-social 全库零引用（仅本清单在拉），移除省 268KB；
     phone-panel.js 由 studio.html 在地球界动态注入，保留 */
  'js/phone-panel.js','css/phone-style.css',
  /* --- 安卓 WebView 桥 --- */
  'js/android-bridge.js',
  /* --- v3.55.28 补齐：这些脚本此前不在任何预缓存清单，离线模式必 404 --- */
  'js/lazy-boot.js','js/dep-wait.js','js/attribute-engine.js','js/base-model-mode.js',
  'js/mo-utils.js','js/mo-store.js','js/net-guard.js','js/content-scale.js',
  'js/chat-virtualizer.js','js/transcript-retrieval.js','js/world-book.js',
  'js/story-stance.js','js/story-identity.js','js/canon-ledger.js',
  'js/canon-timeline.js','js/context-panel.js'
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