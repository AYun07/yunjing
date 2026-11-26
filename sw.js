/* 云境 · 离线服务 worker v3.46.1
   仅在 https:// 或 localhost 下注册；缓存优先 + 后台更新

   v3.46.1 修复：
     1. SW_VER 递增（v3.46.8 → v3.46.9）—— 否则 PWA 用户永远命中旧缓存，
        改了代码也看不到效果（本项目最易踩的坑）
     2. CORE2 清单补全 v3.46.0 新增模块（atlas-panel / immersive-suite /
        player-kit / world-runtime 全系等 60+ 文件），此前离线模式功能残缺
     3. 版本号体系与主版本 v3.46.0 对齐
*/
const SW_VER = 'yunjing-v7.0.9';
  /* v6.5.1 二创增量补丁：patch-engine（纯函数内核：FNV哈希/diff/三方plan/merge3/备份回滚/版本检查/分卷/密钥剔除）+ content-adapters（12类内容采集器）+ zip-writer 增解包 + github-client 增 Gist下载/私密Gist/分卷解析 + creation-hub 发布走"只打改动"、下载走"差异预览→同步/覆盖/合并/冲突→备份→安装→回滚"。文档：增量同步-需求回读确认单/设计契约 v6.5.1；决策 DR-049。v6.5.1 增四段式正文(简介/特点/二创内容/打包源码)+唯一区域(标签二创投稿/目录 community/packages)，决策 DR-050/051。v6.6.0：二创收敛为唯一总文件夹 community/works/（每件作品一个 <时间戳>-<slug>/ 子文件夹，README.md+meta.json+package.zip 同处，catalog.json 按时间倒序），云境内 listWorks/readWorkFile/publishWork 一站式浏览下载发布；修复 CI（版本同步器全站同步）；决策 DR-052/053。 */
  /* v6.3.13 跨层战力折算：嵌套世界各层加层位倍率factor与依据basis（基准层=1，全部标注估算/原著依据），compare-engine 新增 crossLayer()——层位比=对手÷我方倍率、层位差=round((比-1)×2)档叠加主阶梯档差，加成折可跨档、代价按档结算、必须写缘由、估算倍率显式标注；关联副体系层（地摊仙宫星空）从对应tier轴取境界；契约注入折算口径，面板加「④跨层对敌」tab。realm-rules/compare-engine/compare-panel ?v 升 6.3.13。 */
  /* v6.3.14 全量楼层快照与回档：新 js/floor-state.js——固定IDB键floorState/<档>覆盖写(绝不无限追加)、对话正文不进快照(只存histLen，正文走transcript)、差量+每20层锚点；rewindTo 优先走全量快照，回档到任意层时所有随剧情演化数据(storyState全字段+SlotRegistry全部旁路键)一起还原，全局持久项(传承/图鉴)排除；回档可撤销(上限5恢复点)，时光轴加撤销入口；老档无floorState自动降级turnArc。story-framework/time-axis/floor-state ?v 升 6.3.14。 */
  /* v6.3.12 复杂世界治理：①副体系从提示词软约束升级为引擎硬校验——境界名先判体系归属（主阶梯/5世界副体系/嵌套层），跨体系返回明确拒绝报告而非空结果，三入口(gap/crossRealm/exceptionReport)全覆盖；②新增嵌套世界观字段与隔离口径（超神已知/未知宇宙、道诡虚实层、地摊蓝星/仙宫星空、吞噬地球/宇宙海/浑源），契约与面板同步展示；③比对面板加体系选择器，切换体系同步刷新境界下拉；④显式体系对象 {systemId,name} 消除斗罗斗三/斗四同名斗铠歧义。realm-rules/compare-engine/compare-panel ?v 升 6.3.12。 */  /* v6.3.6 数值规则卡死：默认严格演算禁口胡（FillRule，本就如此）；新增①每轮发言自动识别玩家明确数值要求（"我直接突破到筑基"等强指令）按轮放行、②钳制可见提示条（请求+50→实际+6+原因）、③钳制回执回写下一轮AI上下文防重犯。fill-rule/attribute-engine/variable-parser ?v 升 6.3.6。 */  /* v6.3.5 对话时光轴：任意回合回档 / 重 roll——每轮快照全量落 IDB（突破40轮热栈），选定任意轮回到本轮前/保留本轮丢之后/原指令重写；变量/历史/摘要/DOM/虚拟滚动/transcript 全同步，刷新不复活；修归档并发写丢失。预缓存补 time-axis.js/css，story-framework 等改动模块 ?v 升 6.3.5。 */  /* v6.3.4 内存治理：存档体检面板新增「内存安全哨兵」——扫描变量/轮次快照里是否混入 base64 图片或 >60KB 大对象（「每轮复制整份状态树」的膨胀病根），绿/红两态提示；证实云境 turn 仅存变量且硬限 40 轮、插图走 IDB 独立仓，无此病。 */  /* v6.3.3 唯一启动界面+四入口语义对齐：子页守卫 entry-guard.js（单独打开子页弹回封面，?dev=1 豁免）；续梦改为跨世界读档浮层 resume-portal.js/css（选档→storyActiveSlot→studio）；世界选择页封面级底图；观星收口 studio?goto=settings（修旧大厅 config-modal 缺失）；造物→studio?goto=forge；新增手机端启动.html。 */  /* v6.3.2：封面即主界面——start_url 改 opening.html；无参访问 index.html/根路径跳封面；新增分类世界选择器 CoverPortal；首启引导只一次。 */  /* v6.3.1 审查修复：预缓存补齐动态势力上图三件套（atlas-faction-anchors.js / atlas-faction-layer.js / atlas-faction-layer.css），修复离线时动态势力旗标 404。 */  /* v6.3.0：世界舆图资料库进主程序——工具箱新入口「世界舆图·资料库」全屏overlay逐世界地点对照；玩家扩展数据层（补充/优化/删除地点、自建DLC大世界与内置38界并列、JSON导入导出、重置、schema校验、XSS转义）；合并结果写回ATLAS_VERIFIED供舆图/资料库共用；预缓存补齐深度舆图+校对数据+资料库模块。 */  /* v6.2.0：38世界原著地点校对（40子智能体并行联网查证/4499地点147时代层，每条含方位where+真实出处+五类分清；回归原著撤销天魂斗灵；适配层按4×4方位网格聚合L0区域节点；37世界专属壁纸底图；map-verified.html验收页） */  /* v6.1.0：三国并立（已撤销，见v6.2回归原著） */  /* v6.0.0：父子地理树+类别分清（根治"海神湖冒出圣魂村"：canon层退化给静态树上色，显示哪些点100%由静态树当前层children决定/dou1重建成70节点父子地理树，圣魂村挂法斯诺行省→诺丁城、海神殿挂东海→海神岛、史莱克回归索托城外删串戏海神湖内院/取消鼎与三足鼎立，国家·大型势力·宗门·地区·地点五类分清/武魂殿归大型势力非国家） */  /* v5.7.0：斗罗第一部原著五类归位（查证原著/势力国家宗门地点地区五类共56实体/坐标按官方地图设定方位/L0按类别分组标注+类别图例筛选/详情标类别与方位依据） */  /* v5.6.0：原著地点分层方位（85地点按lv0-4归位到五级地图/每级坐标按原著方位重排/详情标注层级/传灵塔与海神湖分层错位） */  /* v5.5.0：原著地点上图（85个权威地点固化/势力+地点美术徽记/密度切换/去重/详情出处） */  /* v5.4.1：原著势力权威锚定（位置按原著/跨时代区分/废弃随机散点） */  /* v5.4.0：动态势力上图（玩家+原著势力旗标/详情/分层/覆灭复兴）+25张底图增强 */  /* v5.2.0：全界视觉修复（遮挡/开局静止/太极移除/地图分层聚合）+ 生图状态栏接入 */  /* v3.73.0 大厅焕新「鎏金云海」：新增 css/lobby-refresh.css 作用域 html body.page-index——深夜金霞天幕、衬线大字门面(眉线+落影+暖金标语胶囊)、五大工坊门户大卡与33界世界卡按 --ws-hue 色相琉璃化(hover上浮发光+胶囊入场钮)、折叠分组暖金化(glyph方章/界数pill/圆框caret)、卷首语横幅电影化(衬线金标题+六feat玻璃块+金CTA)、初来乍到信息卡与版本徽标页脚统一暖金。v3.72.0 四套主界面板式可选(?theme=ink 水墨卷轴/star 星穹HUD/gold 鎏金殿阁/cloud 云白卡片Bento)+对照台style-lab.html，主题CSS作用域html body.page-studio默认不启用。v3.68.0 全项目审计修复：①串档三件套——身份三态/穿越者关系/界专属模块/资料库全部按存档槽隔离(主档裸键零迁移)，清档与删槽一并清灵宠/小队/三态/资料库，灵宠小队随存档导出导入(跨设备不再丢)；②核心循环——driftNotes 类型统一为数组(此前 TypeError 静默吞掉每轮全部场域注记)、JSON 变体路径 wordCount 走增量守卫(+1200 不再清零累计)、未闭合变量块只取协议行段不再把正文当指令、regenerate/rollback 等待期上锁防双击双发、温度 0 不再被 ||0.9 吞掉、章节保底仅在写了块漏 chapter 时推进、补协议请求与闭合自检统一为六类口径、coreContract 变量块改英文固定键协议、场域注记不再静默；③安全——行旅图鉴动态文本(AI 上报地标/大势事件/玩家名)全量转义防存储型 XSS、状态面板 esc 补引号转义、知识库 kb-item 禁用态类名拼接修复(真 bug)、存档导入加 20MB 防护；④SW——缓存命中 ignoreSearch 去参匹配(预缓存此前永不命中白做)、HTML 导航 network-first(版本更新即见新版)、预缓存清单补灵宠/小队/连接配置；⑤接线——灵宠/小队战斗块接入战斗提示词、applyEvent 接战斗受伤/疗伤、主笔灵宠去重(已入队不再重复注入)、立场缺省与新三态对齐(消除双轨矛盾)、灵宠养护/羁绊每轮限次、world-plus 中文数字解析(二十三级不再解析为 null)；⑥UI——studio 版本徽标对齐 v3.68.0 并砍掉 2 万字 title、AI 补记日记字段修正(t.userInput→t.user)、表情面板不再清空已输入文字、小云双 handler 去重、小云隐藏前先告别、队长徽标按队首判定、小队容量口径统一。v3.66.0 主界面焕新「天光玻璃」：极光天幕（青紫霞三色极光带+流云）+ 玻璃拟态卡片（毛玻璃+渐变描边+内高光）+ 工坊字徽彩色柔光底 + hover 抬升与光泽扫过 + 首屏渐入动效（stagger，respect prefers-reduced-motion），老内核 color-mix 静态回退。v3.65.0 属性引擎·实时事件化：受伤扣减/疗伤加回/突破精进事件化直接落表（值域0-100仍钳死），落 v.statLog 审计账本并派发 yj:stat-change 即时反馈（面板闪动+Δ浮标：受伤红/恢复绿）；每项数值按语义轴映射专长，实时块与面板同步凸显；主笔实时块新增「数值专长」与「近期数值变动」两行；时间跨越补涨同入账本。v3.64.0 小队系统：邀请同伴/灵宠入队、编队设队长、羁绊驱动协同技、接入主笔与战斗 prompt（与灵宠系统联动）。v3.63.0 灵宠·妖兽·伙伴系统：宠物/灵兽/妖兽/伙伴 四类随行存在，契约→养成→升级→羁绊→随队，按存档持久化，接入主笔 prompt。v3.62.0 身份三态重做：原著主角(大势不可改小势可调)/原著配角(按原著定位生成人生)/完全原创(玩家设定+模型辅助)；开局向导三态卡片+配角选择。v3.61.1 连招健壮性：外部动作打断未完成连招，避免姿态叠加覆盖。v3.61.0 动态小云·全态可交互动画引擎：12 态各 3 个动作姿态关键帧(挥手/战斗/开心)交叉淡入叠加 CSS 动效，待机随机秀动作，菜单「秀一下」编排。v3.60.1 御姐形态重绘：年轻时尚化（香槟金裙+白开衫+云朵耳坠），画风与全 12 态统一。v3.60.0 动态小云：行为引擎(蹦跳/转圈/闲逛/哼歌/真瞌睡)+亲密度+剧情感知+视线跟随+3张半身补全身。v3.59.1 小云十二形态（AI 生图 PNG，删 SVG）。v3.59.0 主界面换肤「晓云天光」+ 小云五形态换装。v3.58.0 世界自活（P6）：原创人物/势力/地点自动繁衍上图 + 自由人生。v3.57.0「让世界活起来」引擎全套（P2-P5）：
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
  './', './opening.html', './xiaoyun.html', './index.html', './studio.html', './manifest.webmanifest',
  /* v6.3.3 唯一启动界面 + 四入口：守卫/读档浮层/手机启动页离线也要可用 */
  './js/entry-guard.js', './js/resume-portal.js', './css/resume-portal.css', './手机端启动.html',
  /* v6.3.5 对话时光轴：任意回合回档 / 重 roll（离线可用） */
  /* v6.5.1 增量补丁四件套（顺序敏感）：内核 → 采集器 → 打包/解包 → GitHub → 版块 UI */
  './js/patch-engine.js', './js/content-adapters.js',
  './js/zip-writer.js', './js/github-client.js', './js/creation-hub.js',
  './js/time-axis.js', './css/time-axis.css',
  /* v6.3.14 全量楼层快照：离线也能回档到任意层（所有数据同步） */
  './js/floor-state.js',
  /* v6.3.7 境界数值比对：38界原著阶梯钉死 + 跨境界越级/极境/破例/自创比对（离线可用） */
  './js/realm-rules.js', './js/compare-engine.js', './js/compare-panel.js',
  /* v4.36.0 开场封面 + 入口分派：开场页与小云工坊离线也要能进 */
  './js/opening-entry.js', './上架素材/开场底图-横版.png', './上架素材/开场底图-竖版.png',
  /* v7.0 封面开场动画：用封面本身运镜，播完无缝接入封面页，可跳过（离线也要播） */
  './js/cover-intro.js', './css/cover-intro.css',
  // v7.0 封面全动态开场：透明女孩层 + 闭眼层（眨眼动画用，离线也要在）
  './assets/cover-anim/girl_land.png', './assets/cover-anim/girl_port.png',
  './assets/cover-anim/girl_land_blink.png', './assets/cover-anim/girl_port_blink.png',
  // v7.1 封面真动画：图生视频主画面（女孩真实眨眼/转头/衣袂飘动），离线也要能播
  './assets/cover-anim/girl_live.mp4',
  // v6.9.4 电影片头竖版封面：竖构图动态视频，离线竖屏也要能播
  './assets/cover-anim/girl_live_port.mp4',
  // v7.2 分层入场：透明活女孩视频（黑屏单独浮现→移动到场景），离线也要能播
  './assets/cover-anim/girl_live_alpha.webm',
  './story-framework.js', './assets/yj-favicon.ico', './assets/yj-icon-192.png', './assets/yj-icon-512.png',
  './assets/yj-icon-apple.png', './css/ui-polish.css', './mobile-server.ps1',
  /* v4.36.0 品牌资产 + 商业化占位：离线开场动画/授权占位/新图标都要能用 */
  './js/yj-splash.js', './css/yj-splash-anim.css', './js/yj-license.js',
  './assets/yj-maskable-512.png', './assets/yj-icon-1024.png',
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
});
/* 全界共用，只需一份。旧版放在 forEach 里重复 38 次，CORE2 445 条中 79 条是重复项，
   涓流预热白跑 76 次缓存查询，还可能同批并发 add 同一 URL。 */
GEN.push('js/kb/_index.json');   /* 整包回退前的轻量索引（1KB），避免为无数据的界白下 9MB */
GEN.push('js/kb/_common.js');   /* v3.95.0 跨题材通用常识库：小参数模型的背景兜底，全界共用一份 */
const CORE2 = CORE.concat(GEN, [
  /* v3.93.0 势力舆图：静态据点表 + 原著补录 + 时代层（studio.html 同步脚本），离线也必须可用
     v6.3.1 补齐：动态势力上图三件套（anchors/layer/css）此前漏进清单，离线时动态势力旗标 404 */
  'js/faction-atlas-data.js','js/atlas-supplement.js','js/atlas-eras.js','js/atlas-potato.js',
  'js/atlas-faction-anchors.js','js/atlas-faction-layer.js','css/atlas-faction-layer.css',
  /* v6.2/v6.3 五线深度舆图 + 38世界校对数据 + 玩家扩展层 + 资料库：离线也要能下钻与补充 */
  'js/atlas-drill-data.js','js/atlas-drilldown.js',
  'js/atlas-canon-places.js','js/atlas-canon-layer.js',
  'js/atlas-verified-all.js','js/atlas-verified-adapter.js',
  'js/atlas-userdata.js','js/atlas-library.js',
  'css/atlas-drilldown.css','css/atlas-canon-layer.css','css/atlas-library.css',
  /* v6.3.2 封面即主界面：世界目录 + 分类世界选择器（离线也要能从封面选世界） */
  'js/world-catalog.js','js/cover-portal.js','css/cover-portal.css',
  /* v6.7.0：封面/子页共用的 PWA 注册器与多模型档位（离线时也要在） */
  'js/pwa-register.js','js/model-slots.js',
  /* v6.8.0：左侧功能栏与字体切换（studio.html 直接引用，离线也要在） */
  'js/left-rail.js','css/left-rail.css','js/font-switcher.js','css/font-switcher.css',
  /* v6.9.0：角色塑造助手与遮挡修复（studio.html 直接引用，离线也要在） */
  'js/character-studio.js','css/character-studio.css','css/occlusion-fix.css',
  /* --- 基础样式 --- */
  'css/base-style.css','css/immersive-style.css','css/yunjing-theme.css','css/ui-refresh.css',
  /* v4.13.0 新增的移动端触控目标补丁（窄屏 44px 命中层）。它被 studio.html 与
     index.html 直接引用，但当时忘了同步本清单 —— 离线时该样式 404、窄屏命中层失效。
     由 scripts/sync-precache.mjs 的「HTML 引用但未预缓存」检查抓出。 */
  'css/touch-targets.css',
  'css/npc-chronicle.css',   /* v4.43.0 角色编年史面板 */
  'css/augment-ui.css',      /* v4.45.0 亲密档案+AI增强面板 */
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
  /* v4.17.0 AI 输出统一校验闸门（完整性/语种/协议/失控的唯一判定处） */
  'js/ai-output-gate.js',
  /* v4.17.0 每轮请求总预算（收敛四层互不知情的重试，防把同一请求打到天荒地老） */
  'js/turn-budget.js',
  /* v4.17.2 推理强度五档（跨厂商参数映射 + 不支持时自适应退回） */
  'js/reasoning-effort.js',
  /* v4.17.3 世界专属状态预设（每界不同的组开关 / 专属字段 / 字段改名） */
  'js/status-world-fields.js','js/status-presets.js','js/status-skins.js','js/world-portal.js','js/fill-rule.js','js/api-status-badge.js','js/usage-panel.js',
  /* v6.3.7 境界数值比对三件套 */
  'js/realm-rules.js','js/compare-engine.js','js/compare-panel.js',
  /* v4.17.3 插件运行时（扩展点 / 能力声明 / 插件发现与加载 / 出错自动停用） */
  'js/plugin-runtime.js',
  /* v4.17.0 提示词编译唯一入口（委托 ai-message-builder，额外记录编译组成快照） */
  'js/prompt-compiler.js',
  /* --- 核心引擎 --- */
  'js/api-calling-functions.js','js/cors-guard.js','js/variable-parser.js','js/ai-message-builder.js',
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
  'js/save-slots.js','js/save-codec.js','js/growth-ledger.js','js/card-io.js','js/card-hub.js',
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
  'js/lunar-stamp.js','js/inspiration-dice.js','js/action-check.js','js/celebration.js',
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
  /* --- NPC 编年史系统（v4.43.0 新增） --- */
  'js/npc-chronicle.js','js/npc-bridge.js','js/npc-chronicle-ui.js','js/ai-governor.js',
  /* v4.44.0 亲密档案 + AI 增强层 */
  'js/intimacy-archive.js','js/ai-augment.js','js/ai-augment-bridge.js','js/intimacy-ui.js','js/ai-augment-ui.js',
  /* v4.45.0 动态关系 + 性格世界书 */
  'js/personality-codex.js','js/relation-codex-bridge.js','js/personality-codex-ui.js',
  'css/personality-codex.css',
  /* v4.47.0 心理模型（须先于 personality-codex 加载） */
  'js/psyche-model.js',
  'js/world-director.js','js/world-legacy.js','js/world-plus.js',
  'js/story-hooks.js','js/quest-chain.js','js/combat-core.js', 'js/rpg-quests.js', 'js/rpg-core.js',
  'css/world-runtime.css',
  /* --- 通讯与装备 --- */
  'js/comm-configs.js','js/comm-core.js','js/gear-core.js',
  /* --- 助手与小宠 --- */
  'js/mo-assistant.js','js/mo-chibi.js','js/mo-devtools.js',
  /* --- v3.55.3 流畅模式 --- */
  'js/perf-mode.js',
  /* --- 存储 --- */
  'js/storage-boost.js','libs/localforage.min.js',
  /* --- 第三方库 --- */
  'libs/confetti.browser.min.js','libs/fantasy-names.min.js',
  /* --- 安卓 WebView 桥 --- */
  'js/android-bridge.js',
  /* --- v3.55.28 补齐：这些脚本此前不在任何预缓存清单，离线模式必 404 --- */
  'js/lazy-boot.js','js/dep-wait.js','js/world-rules.js','js/attribute-engine.js','js/base-model-mode.js',
  'js/mo-utils.js','js/mo-store.js','js/net-guard.js','js/content-scale.js',
  'js/chat-virtualizer.js','js/transcript-retrieval.js','js/world-book.js','js/worldbook-seeds.js','js/xiaoyun-ops.js','js/xiaoyun-buddy.js',
  /* --- v4.33.0 补齐：小云情绪动作路由脚本，离线模式必缓存 --- */
  'js/xiaoyun-emotion.js',
  'js/story-stance.js','js/story-identity.js','js/canon-ledger.js',
  'js/canon-timeline.js','js/context-panel.js',
  /* --- v3.68.0 补齐：灵宠/小队/连接配置此前漏在清单外，离线模式 404 --- */
  'js/beast-system.js','js/beast-profile-bridge.js','js/semantic-engine.js','js/bonus-engine.js','js/title-system.js','js/squad-system.js','js/connection-profiles.js',
  /* v3.92.1 离线完整性补齐：studio.html 静态引用了但此前未进任何缓存清单，离线模式必 404
     （world-schema.js 甚至在旧注释里被写作"已新增"，清单却一直漏掉——以实际引用为准） */
  'js/world-schema.js','js/entity-editor.js','js/planner.js','js/mo-tools.js','js/npc-spawn.js','js/life-mode.js',
  /* v4.08.0 补齐：存档槽隔离注册表与真值快照是 studio/index 静态引用的核心模块，
     不进清单则 PWA 离线打开必 404（slot-registry 缺失会让全部存档键名退回旧拼接口径） */
  'js/slot-registry.js','js/truth-snapshot.js','js/number-scrubber.js',
  /* v4.18.0 新增：新手引导 / 即时反馈 / 作品分享 / 提示词调试器，离线也要可用 */
  'js/first-run-guide.js','js/live-feedback.js','js/share-export.js','js/prompt-inspector.js'
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

/* v6.6.1 涓流预热（内存治理）：
   旧版激活 8 秒后即以 150ms 间隔全速抓取整个 CORE2（含 1.16MB atlas + 38 界知识库），
   玩家停在封面时预热已满负荷跑，实测封面进程内存净增约 112MB、开局明显卡顿。
   改为：①延迟 8s→25s（让玩家先进入并稳定在游戏内）；②间隔 150ms→500ms（降低瞬时并发与内存峰值）；
   ③一次只取 1 个（进一步削峰）。离线能力保留，只是缓存充满更久——用"稍慢充满"换"开局不卡"。 */
let _warmed = false;
function trickleWarmup() {
  if (_warmed) return; _warmed = true;
  caches.open(SW_VER).then((c) => {
    let i = 0;
    function next1() {
      if (i >= CORE2.length) return;
      const url = CORE2[i++];
      c.match(url).then(hit => hit ? null : c.add(url).catch(() => {}))
       .then(() => setTimeout(next1, 500));
    }
    setTimeout(next1, 1500);
  });
}
self.addEventListener('activate', (e) => { setTimeout(trickleWarmup, 25000); });