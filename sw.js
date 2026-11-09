/* 云境 · 离线服务 worker v3.46.1
   仅在 https:// 或 localhost 下注册；缓存优先 + 后台更新

   v3.46.1 修复：
     1. SW_VER 递增（v3.46.8 → v3.46.9）—— 否则 PWA 用户永远命中旧缓存，
        改了代码也看不到效果（本项目最易踩的坑）
     2. CORE2 清单补全 v3.46.0 新增模块（atlas-panel / immersive-suite /
        player-kit / world-runtime 全系等 60+ 文件），此前离线模式功能残缺
     3. 版本号体系与主版本 v3.46.0 对齐
*/
const SW_VER = 'yunjing-v4.12.0';  /* v3.73.0 大厅焕新「鎏金云海」：新增 css/lobby-refresh.css 作用域 html body.page-index——深夜金霞天幕、衬线大字门面(眉线+落影+暖金标语胶囊)、五大工坊门户大卡与33界世界卡按 --ws-hue 色相琉璃化(hover上浮发光+胶囊入场钮)、折叠分组暖金化(glyph方章/界数pill/圆框caret)、卷首语横幅电影化(衬线金标题+六feat玻璃块+金CTA)、初来乍到信息卡与版本徽标页脚统一暖金。v3.72.0 四套主界面板式可选(?theme=ink 水墨卷轴/star 星穹HUD/gold 鎏金殿阁/cloud 云白卡片Bento)+对照台style-lab.html，主题CSS作用域html body.page-studio默认不启用。v3.68.0 全项目审计修复：①串档三件套——身份三态/穿越者关系/界专属模块/资料库全部按存档槽隔离(主档裸键零迁移)，清档与删槽一并清灵宠/小队/三态/资料库，灵宠小队随存档导出导入(跨设备不再丢)；②核心循环——driftNotes 类型统一为数组(此前 TypeError 静默吞掉每轮全部场域注记)、JSON 变体路径 wordCount 走增量守卫(+1200 不再清零累计)、未闭合变量块只取协议行段不再把正文当指令、regenerate/rollback 等待期上锁防双击双发、温度 0 不再被 ||0.9 吞掉、章节保底仅在写了块漏 chapter 时推进、补协议请求与闭合自检统一为六类口径、coreContract 变量块改英文固定键协议、场域注记不再静默；③安全——行旅图鉴动态文本(AI 上报地标/大势事件/玩家名)全量转义防存储型 XSS、状态面板 esc 补引号转义、知识库 kb-item 禁用态类名拼接修复(真 bug)、存档导入加 20MB 防护；④SW——缓存命中 ignoreSearch 去参匹配(预缓存此前永不命中白做)、HTML 导航 network-first(版本更新即见新版)、预缓存清单补灵宠/小队/连接配置；⑤接线——灵宠/小队战斗块接入战斗提示词、applyEvent 接战斗受伤/疗伤、主笔灵宠去重(已入队不再重复注入)、立场缺省与新三态对齐(消除双轨矛盾)、灵宠养护/羁绊每轮限次、world-plus 中文数字解析(二十三级不再解析为 null)；⑥UI——studio 版本徽标对齐 v3.68.0 并砍掉 2 万字 title、AI 补记日记字段修正(t.userInput→t.user)、表情面板不再清空已输入文字、小云双 handler 去重、小云隐藏前先告别、队长徽标按队首判定、小队容量口径统一。v3.66.0 主界面焕新「天光玻璃」：极光天幕（青紫霞三色极光带+流云）+ 玻璃拟态卡片（毛玻璃+渐变描边+内高光）+ 工坊字徽彩色柔光底 + hover 抬升与光泽扫过 + 首屏渐入动效（stagger，respect prefers-reduced-motion），老内核 color-mix 静态回退。v3.65.0 属性引擎·实时事件化：受伤扣减/疗伤加回/突破精进事件化直接落表（值域0-100仍钳死），落 v.statLog 审计账本并派发 yj:stat-change 即时反馈（面板闪动+Δ浮标：受伤红/恢复绿）；每项数值按语义轴映射专长，实时块与面板同步凸显；主笔实时块新增「数值专长」与「近期数值变动」两行；时间跨越补涨同入账本。v3.64.0 小队系统：邀请同伴/灵宠入队、编队设队长、羁绊驱动协同技、接入主笔与战斗 prompt（与灵宠系统联动）。v3.63.0 灵宠·妖兽·伙伴系统：宠物/灵兽/妖兽/伙伴 四类随行存在，契约→养成→升级→羁绊→随队，按存档持久化，接入主笔 prompt。v3.62.0 身份三态重做：原著主角(大势不可改小势可调)/原著配角(按原著定位生成人生)/完全原创(玩家设定+模型辅助)；开局向导三态卡片+配角选择。v3.61.1 连招健壮性：外部动作打断未完成连招，避免姿态叠加覆盖。v3.61.0 动态小云·全态可交互动画引擎：12 态各 3 个动作姿态关键帧(挥手/战斗/开心)交叉淡入叠加 CSS 动效，待机随机秀动作，菜单「秀一下」编排。v3.60.1 御姐形态重绘：年轻时尚化（香槟金裙+白开衫+云朵耳坠），画风与全 12 态统一。v3.60.0 动态小云：行为引擎(蹦跳/转圈/闲逛/哼歌/真瞌睡)+亲密度+剧情感知+视线跟随+3张半身补全身。v3.59.1 小云十二形态（AI 生图 PNG，删 SVG）。v3.59.0 主界面换肤「晓云天光」+ 小云五形态换装。v3.58.0 世界自活（P6）：原创人物/势力/地点自动繁衍上图 + 自由人生。v3.57.0「让世界活起来」引擎全套（P2-P5）：
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
  './story-framework.js', './assets/yj-favicon.ico', './assets/yj-icon-192.png', './assets/yj-icon-512.png',
  './assets/yj-icon-apple.png', './css/ui-polish.css', './mobile-server.ps1',
  /* v3.55.3 小云长发可御可萝：离线时桌面宠物（萝/御双形态）与各处头像都要能显示。
     v3.55.3 资产瘦身：四张小云图压缩（2.3MB→170KB）后仍保质；旧版 xiaoyun-chibi.png/
     xiaoyun-face.png/mo-chibi.png 全库零引用（只有本清单在拉），一并移除——少下载 623KB */
  './assets/xiaoyun-chibi-luo.png', './assets/xiaoyun-chibi-yu.png',
  './assets/xiaoyun-face-luo.png', './assets/xiaoyun-face-yu.png',
  /* v3.55.3 手机分身头像雪碧图（压缩后 145KB）补入预缓存：离线也有头像，不再回退首字块 */
  './assets/phone/avatars-m.jpg', './assets/phone/avatars-f.jpg',
  /* v3.92.1 唯一小云（右下角全功能助手）默认立绘：install 阶段即缓存，离线不缺图 */
  './assets/xiaoyun-keai-happy.png',
  /* v4.04.0 舆图纹章：两张由 agnes-image-2.5-flash（免费档）生成的装饰素材，离线也要能显示 */
  './assets/atlas/compass-rose.png', './assets/atlas/rpg-hud-crest.png'
];

/* #12 全量预缓存:引擎 + 38界配置/扩展/主题 */
const GENRES = ["mystery","scifi","wuxia","cthulhu","free","swallowedstar","shrouding","quanzhigaoshou","doupocangqiong","wanmeishijie","douluodalu","daoguiyixian","zhongshengdushi","dibao","longzu","quanzhifashi","limingzhijian","lunhuileyuan","wulianfengdian","shengxu","shenmifusu","ditandali","fanrenxiuxian","xianni","earth","freeworld","quanqiubingfeng","chaoshenxueyuan","zhanhen","jianlai","guimi","guzhenren","xuanjianxianzu","dazhuzai","wudongqiankun","yuanzun","wanxiangzhiwang","wangyou"];
const GEN = [];
GENRES.forEach(g => {
  GEN.push('configs/' + g + '-config.js', 'js/world-ext/' + g + '-ext.js', 'css/' + g + '-style.css');
  /* v3.55.28：世界书二次拆分——core 进界即挂（≤45KB），ext 空闲补齐；离线同样两批缓存 */
  GEN.push('js/kb/' + g + '.core.js', 'js/kb/' + g + '.ext.js');
  GEN.push('js/kb/_index.json');   /* 整包回退前的轻量索引（1KB），避免为无数据的界白下 9MB */
  GEN.push('js/kb/_common.js');   /* v3.95.0 跨题材通用常识库：小参数模型的背景兜底，全界共用一份 */
});
const CORE2 = CORE.concat(GEN, [
  /* v3.93.0 势力舆图：静态据点表 + 原著补录 + 时代层（studio.html 同步脚本），离线也必须可用 */
  'js/faction-atlas-data.js','js/atlas-supplement.js','js/atlas-eras.js','js/atlas-potato.js',
  /* --- 基础样式 --- */
  'css/base-style.css','css/immersive-style.css','css/yunjing-theme.css','css/ui-refresh.css',
  'css/rpg-suite.css',   /* v4.04.0 网游多标签面板共用皮肤 */
  'css/rpg-polish-405.css',  /* v4.05.0 网游面板视觉增强（质感/交互反馈，独立文件） */
  'css/theme-ink.css','css/theme-star.css','css/theme-gold.css','css/theme-cloud.css',
  'css/fonts-local.css',
  'css/xiaoyun-buddy.css',
  /* v3.92.1 大厅基础版式 + 六套风格皮肤/骨架：切换器与离线都要能加载 */
  'css/lobby-xiaoyun.css','css/lobby-themes.css','css/lobby-layouts.css','js/lobby-themes.js',
  'assets/fonts/NotoSerifSC-700.woff2',
  'assets/fonts/NotoSerifSC-900.woff2',
  'assets/fonts/CormorantGaramond-500.woff2',
  'assets/fonts/CormorantGaramond-600.woff2',
  /* --- 引导与守卫 --- */
  'js/boot-error-guard.js','js/system-guard.js','js/store-guard.js','js/antibagu-guard.js',
  /* --- 核心引擎 --- */
  'js/api-calling-functions.js','js/variable-parser.js','js/ai-message-builder.js',
  'js/ai-response-handler.js','js/user-input-handler.js','js/story-status-renderer.js',
  'js/entity-engine.js','js/variable-ai.js','js/dynamic-world.js',
  'js/image-gen.js','js/prompt-engineer.js','js/prompt-budget.js',
  'js/faction-atlas-data.js','js/atlas-supplement.js','js/atlas-eras.js','js/atlas-potato.js','js/kb-vector.js',
  /* --- 云起预设（v3.55.5 内置原创） --- */
  'js/preset-yunqi.js','js/yunqi-engine.js','js/yunqi-bridge.js',
  'js/yunqi-regex-data.js','js/yunqi-regex.js',
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
     世界书已按界拆成 js/kb/<界>.core.js + .ext.js（66 个分包均在 GEN 预缓存，覆盖全部工坊），
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
  'js/world-runtime.js','js/world-bus.js','js/world-stage.js','js/world-alive.js','js/opportunity-system.js','js/sim-core.js','js/world-clock.js',
  'js/world-director.js','js/world-legacy.js','js/world-plus.js',
  'js/story-hooks.js','js/quest-chain.js','js/combat-core.js', 'js/rpg-quests.js', 'js/rpg-core.js',
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
  'js/chat-virtualizer.js','js/transcript-retrieval.js','js/world-book.js','js/worldbook-seeds.js','js/xiaoyun-ops.js','js/xiaoyun-buddy.js',
  'js/story-stance.js','js/story-identity.js','js/canon-ledger.js',
  'js/canon-timeline.js','js/context-panel.js',
  /* --- v3.68.0 补齐：灵宠/小队/连接配置此前漏在清单外，离线模式 404 --- */
  'js/beast-system.js','js/squad-system.js','js/connection-profiles.js',
  /* v3.92.1 离线完整性补齐：studio.html 静态引用了但此前未进任何缓存清单，离线模式必 404
     （world-schema.js 甚至在旧注释里被写作"已新增"，清单却一直漏掉——以实际引用为准） */
  'js/world-schema.js','js/entity-editor.js','js/planner.js','js/mo-tools.js','js/npc-spawn.js','js/life-mode.js',
  /* v4.08.0 补齐：存档槽隔离注册表与真值快照是 studio/index 静态引用的核心模块，
     不进清单则 PWA 离线打开必 404（slot-registry 缺失会让全部存档键名退回旧拼接口径） */
  'js/slot-registry.js','js/truth-snapshot.js','js/number-scrubber.js'
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
  /* v3.68.0 缓存键修复：
     1. ignoreSearch 命中——页面以 ?v=版本号 请求资源，此前与清单里不带参的
        预缓存条目永不命中，预缓存全部白做；现去参匹配并命中后回填带参 key。
     2. HTML 导航改 network-first——版本更新后首屏即见新版，不再要求二次刷新。 */
  const isHtml = req.mode === 'navigate' || /\.html?$/.test(url.pathname);
  e.respondWith(
    (isHtml
      ? fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SW_VER).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => caches.match(req, { ignoreSearch: true }).then((h) => h || caches.match(req)))
      : caches.match(req, { ignoreSearch: true }).then((hit) => {
          const fetching = fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SW_VER).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }).catch(() => hit);
          return hit || fetching;
        })
    )
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