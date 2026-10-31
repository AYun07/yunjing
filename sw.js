/* 云境 · 离线服务 worker v3.46.1
   仅在 https:// 或 localhost 下注册；缓存优先 + 后台更新

   v3.46.1 修复：
     1. SW_VER 递增（v3.46.8 → v3.46.9）—— 否则 PWA 用户永远命中旧缓存，
        改了代码也看不到效果（本项目最易踩的坑）
     2. CORE2 清单补全 v3.46.0 新增模块（atlas-panel / immersive-suite /
        player-kit / world-runtime 全系等 60+ 文件），此前离线模式功能残缺
     3. 版本号体系与主版本 v3.46.0 对齐
*/
const SW_VER = 'yunjing-v3.55.26';  /* v3.55.26 属性引擎·真实机制：六维属性不再是静态数字——①数值平衡引擎侧强制钳制(不只是提示词自觉)：变量块属性增量经 attribute-engine 真实落表，单项单轮±6硬上限、全部属性合计±10、值域0-100，无正文依据的离谱跳变被真实拦截(AI违规输出JSON变体同样钳制)；②强项偏向：资质键按语义轴归类(肉身/感知/心志/谋算/修学/机缘，世界自适应——凡人的「神识」与都市的「精神力」同走感知轴)，每轮注入当前值+前二强项的行为偏向语义(强项场景占优、弱项受阻)，面板数值条前二≥55标★；③天赋社会反响状态机：资质自动定档(顶级/稀有/中平/低劣，自定义资质交主笔首轮定档)落 v.talent 随档持久化，天赋.暴露单向门(隐藏→已暴露，暴露过收不回、不得未卜先知)，每轮把档位+暴露状态注入主笔，登记官协议补天赋.定档/暴露两行，状态面板新增🎭天赋行；④懒种子：老档零迁移自动补种。逻辑测试19项+真机探针全绿。 v3.55.25 记忆措辞盲区修复+天赋社会反响：(1)旧楼层检索此前只索引二字词，玩家换措辞追问旧事（问「山坡/时辰」原文写「落霞坡/戌时」）零命中——百楼压测 R100 实锤。现补稀有单字回退索引（高频常用字按文档频率自动剔除防爆索引），换措辞也能靠「坡」「戌」等稀有字召回。(2)资质天赋不再是无人在意的静态标签——按本世界世界观自动定档，顶级/稀有天赋已暴露即招抢收徒/资源倾斜/高好感（开局顶级天赋不得仍按普通弟子剧本开局），低劣天赋被倨傲者轻视而温和者如常，刻意藏拙则无人未卜先知、暴露后反响持续发酵，反响用具体言行呈现并同步进好感/际遇。 v3.55.24 刷新丢档修复：v3.51.0 品牌库迁移(moshu→yunjing)单次快照复制的缺陷——标记完成时本会话 localforage 仍握旧库连接继续写入，刷新后切读的新库只是复制发起时刻的快照，升级后第一次刷新即丢「迁移后的全部写入」(实测全量对话 transcript 104 楼退回 1 楼快照、几千楼机制失效退回 80 楼)。现迁移完成不删旧库、派发事件由 storage-boost 收尾——旧库(含本会话最新写入)整库补写进新库后再切换，任何时刻无丢失窗口；逻辑测试 16 项+真机 100 楼压测复现并验证修复。 v3.55.23 大势可改·地图落实：①大势演化账本(诱因铁律/蝴蝶铁律/羁绊铁律,world块登记+面板改判,主笔与远方推演均按账本执行)；②行旅图鉴每轮实时追踪+资料库地理自动上图+大事「风云」条+双入口；③资料库8界地理/势力种子(SEED_FLAG v2)。v3.55.22 千楼长卷：①聊天虚拟化(几千楼只渲可视窗口,DOM有界不卡)；②全量对话落IndexedDB(upTo元数据+尾对齐合并,刷新不丢楼)；③分层记忆(前情提要超440字降级为章节存档块,摘要链两级不塌缩)；④双通道旧章召回(全楼层BM25+可选向量精排,旧楼原文按需注入主笔)；⑤格式契约(贴生成位置重申输出骨架,长对话格式不漂移)；⑥长程记忆体检面板。v3.55.21 修复：本界资料库注入失效——genreKey 字段误读导致种子词条不落库（config 以 genreKey 登记而非 genre/id，world-book.js 此前取错字段、永远落到 "default"）。现优先读 genreKey，8 大主流世界种子词条(掌天瓶/韩立/修炼体系…)已能正确注入主笔，提升设定一致性。v3.55.20 世界是活的·续：①玩家身份双轨——穿越者(带着原著记忆降临,先知先觉但预知有界,不许倾倒全文/不许OOC说明书)/土著(对原著一无所知,严禁剧透与全知,知识只来自亲历/传闻/探索);②与原著主角关系三态(取代主角立场下失效)——同伴(道路自然相交)/敌对(竞争者/对手)/陌路(此生可能毫无交集,严禁强行制造相遇,主角在视线外自走一生);③世界自主演化强约束(远方事件须让势力兴衰/NPC自有目标/因果涟漪/时间流逝自行推进);④本界资料库——每界一份 lore 库(人物/势力/机缘/地理/设定/事件),内置主流世界种子词条、可增补缺失条目、可从当前故事抽取、可注入主笔提升设定一致性;入口在小云「🧰 模块」。v3.55.19 世界是活的:①叙事立场三选一——同行者(默认,玩家是世界里活生生的一份子,原著主角有自己的人生主线,不因玩家绕道让位)/取代主角(玩家即原著主角本人,原著主角不再独立登场)/搅局者(可改写原著大势),开局可挑、开局后可切;原著主角名按世界自动识别(17 界内置,配置 canonProtagonist 可覆盖,识别不出用通称不臆造);②机缘归属账本——机缘具唯一性,谁先拿到就是谁的,玩家夺走后原著主角按「缺失之后」重新推演命运分岔,禁止仍然持有/受益/等价替代;登记来源三路((claimed) 块 / 变量道具比对 / 面板手动),注入主笔+动态世界+变量AI,正文剥离不显示;③剧情上下文面板——人物/机缘/物品/伏笔/大事记/回合轨迹聚成一屏,分门别类与时间线两视图互切,纯本地零 API。v3.55.18 酒馆正则导入防护:导入第三方(酒馆SillyTavern)正则时,正文渲染链路此前只看开关、不看 promptOnly——酒馆里靠 placement 限定只作用于历史楼层的「隐藏不发送」类规则(整段通配+空替换,如点星通配 s 模式)落到云境正文就是整章清空;现加两道防护:promptOnly 且不标记 markdownOnly 的规则不碰显示正文;整段通配且替换串为空的规则一律跳过并告警。经实测:导入「三合一数据库配套正则」(4条,含 1 条 find 为点星通配 s 模式、替换为空)后正文 42 字完整保留,修复前会被清空;另经评估:该套「SP·数据库 VII」核心为 AI 自动填结构化表+向量RAG召回+面板可视化+老楼层不发送,云境已有等价实现且更强(变量AI+状态快照+众生相 / 知识库 BM25+bge-m3 向量+reranker 三路检索 / 状态面板+众生相+舞台快照+行旅图鉴 / PromptBudget 裁剪且记忆层读完整历史不丢信息),其配套正则依赖脚本喂数据与酒馆主题变量,直接导入不可用;v3.55.17 稳固三修:①云境核心契约与预设解耦（导入酒馆预设不再丢六类选项/中文状态栏/变量块）②上下文预算按模型上下文自适应（8k→4千 / 32k→1.6万 / 64k→3.2万 / 128k→6.4万字符，识别不出仍 11 万）+ token 估算 ③存储配额兜底（Storage.prototype 兜一层，48 个直写点零改造，超配额自动转 IndexedDB 并补预热）。SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
   v3.55.7 云端同步与开源：云起预设/正则上 GitHub（公开仓库「云境」），云境内新增 ☁ 云端同步（js/yunqi-sync.js，多源回退：jsDelivr/raw/ghproxy/gh-proxy，先比 470B 版本文件再决定拉不拉全量）——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。v3.55.6 云起专属美化：云起·XX美化 14 条正则 + 卡片专属皮肤/时徽章/行动选项徽章——SW_VER 递增，否则 PWA 永远命中旧缓存（本项目最易踩的坑）。
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