(function() {
  "use strict";
  const VERSION = "v3.38.1";
  const genre = (() => {
    try {
      return new URLSearchParams(location.search).get("genre") || "free";
    } catch (e) {
      return "free";
    }
  })();
  if (!window.WorldExt) return;
  function rarityOf(name) {
    const s = String(name);
    if (/神|帝|圣|仙|准帝|十万年|异火|皇|本命/.test(s)) return 5;
    if (/灵宝|魂骨|魔核|源石|秘籍|皇级|史莱克|万年/.test(s)) return 4;
    if (/宝|丹|符|器|魂环|千年/.test(s)) return 3;
    if (/药|石|剑|刀|甲|书|信|币|卡/.test(s)) return 2;
    return 1;
  }
  const RARITY = [
    { n: "凡品", c: "#9aa0b4" },
    { n: "常见", c: "#8fb89a" },
    { n: "良品", c: "#6fb0d8" },
    { n: "珍品", c: "#b48cf0" },
    { n: "绝品", c: "#e8a54f" },
    { n: "神物", c: "#ef6a6a" }
  ];
  const GENERIC = {
    name: "随身装备",
    icon: "⚔",
    generic: true,
    tip: "通用装备槽—— battle 行路描写与佩戴联动；可在模块内增删槽位、从背包佩上",
    slots: [
      { key: "武器", icon: "⚔", fit: "剑|刀|枪|斧|棍|弓|杖|枪械|武器" },
      { key: "护身", icon: "🛡", fit: "甲|盾|袍|符|玉佩|护身|盔" },
      { key: "工具", icon: "🔧", fit: "包|绳|工具|灯|镜|钥匙" },
      { key: "载具", icon: "🚙", fit: "车|马|摩托|舟|船|梭|翼" }
    ]
  };
  const REG = {
    fanrenxiuxian: {
      name: "法宝栏",
      icon: "⚔",
      tip: "本命法宝以神识温养，离手则威力锐减；护身之物关乎道途长短",
      slots: [
        { key: "本命法宝", icon: "⚔", fit: "剑|刀|铛|印|幡|珠|扇|镜|钟|塔|鼎|尺|旗", note: "本命法宝：神识温养，人法宝合一" },
        { key: "护身", icon: "🛡", fit: "甲|护身|玉佩|符|袍|铃|镜" },
        { key: "飞行", icon: "🕊", fit: "梭|舟|翼|羽|遁|毯|雁" },
        { key: "傀儡", icon: "🤖", fit: "傀儡|偶人|木偶|尸偶", optional: true }
      ]
    },
    doupocangqiong: {
      name: "装备栏",
      icon: "⚔",
      tip: "斗气大陆以力证道——一杆好枪一具好甲，都是保命的底牌",
      slots: [
        { key: "武器", icon: "⚔", fit: "尺|剑|枪|杖|戟|鞭|矛|环" },
        { key: "护甲", icon: "🛡", fit: "甲|袍|衣|盾|铠" },
        { key: "飞行", icon: "🕊", fit: "翼|披风|羽|鹫|雕" }
      ]
    },
    quanqiubingfeng: {
      name: "随身装备",
      icon: "🧥",
      tip: "极寒里出门，防寒服就是第二条命——武器保你活，防寒保你不冻死",
      slots: [
        { key: "主武器", icon: "🔫", fit: "枪|刀|弩|斧|棍|剑|弓" },
        { key: "防寒", icon: "🧥", fit: "防寒|棉|皮|大衣|羽绒|服|帽|靴", note: "防寒装等级直接决定出门戏的生死" },
        { key: "背具", icon: "🎒", fit: "包|绳|工具|撬|盔|灯" },
        { key: "载具", icon: "🚙", fit: "车|摩托|雪橇|越野|皮卡" }
      ]
    },
    /* ===== v3.37.0 超神学院：军械装备栏 ===== */
    chaoshenxueyuan: {
      name: "军械装备",
      icon: "🎖",
      tip: "地球军的装备靠军功换——枪械打不穿神体，但能护住身后的平民；特殊装备各有来历",
      slots: [
        { key: "主武器", icon: "🔫", fit: "枪|狙|步枪|冲锋|手枪|刀|剑|斧", note: "军配枪械为主，圣器级武器另算" },
        { key: "作战服", icon: "🥋", fit: "作战服|军装|战术|铠|甲|服", note: "防弹插板扛得住流弹，扛不住神级能量" },
        { key: "战术背具", icon: "🎒", fit: "背|包|通讯|夜视|镜|绳|雷" },
        { key: "特殊装备", icon: "💠", fit: "微虫洞|圣剑|虚空|引擎|圣物|器", optional: true, note: "天使科技或虚空造物——来历与代价须写实" }
      ]
    },
    /* ===== v3.38.0 斩神：值夜装备栏 ===== */
    zhanhen: {
      name: "值夜装备",
      icon: "🌙",
      tip: "守夜人的装备靠编制配——枪械打不过高序列神秘，但能护住身后的市民；神兵级另有来历",
      slots: [
        { key: "主武器", icon: "⚔", fit: "枪|刀|斩神|星辰|祸津|剑|弩|棍", note: "制式武器为主，神兵级须有完整事件逻辑" },
        { key: "值夜服", icon: "🥋", fit: "值夜|制服|战术|甲|服", note: "实用为先，扛得住抓挠扛不住超高危" },
        { key: "夜行背具", icon: "🎒", fit: "背|包|手电|对讲|夜视|绳|急救" },
        { key: "神秘物件", icon: "💠", fit: "禁物|神秘|神|遗物|符|核", optional: true, note: "缴获或托付的神秘物件——来历与代价须写实" }
      ]
    },
    /* ===== v3.34.0 世界观化装备槽（17 界全覆盖） ===== */
    douluodalu: {
      name: "魂骨栏",
      icon: "💠",
      tip: "魂骨六位——头骨躯干四肢骨，猎自魂兽、吸收有仪式，一块魂骨一个魂技",
      slots: [
        { key: "头骨", icon: "💠", fit: "头骨|颅骨|头颅", note: "六位魂骨之首，最稀有" },
        { key: "躯干骨", icon: "💠", fit: "躯干|脊柱|躯干骨" },
        { key: "左臂骨", icon: "💠", fit: "左臂|左臂骨|左手" },
        { key: "右臂骨", icon: "💠", fit: "右臂|右臂骨|右手" },
        { key: "左腿骨", icon: "💠", fit: "左腿|左腿骨" },
        { key: "右腿骨", icon: "💠", fit: "右腿|右腿骨" },
        { key: "魂导器", icon: "🔧", fit: "魂导|水晶|储物", optional: true }
      ]
    },
    quanzhigaoshou: {
      name: "银装栏",
      icon: "🎮",
      tip: "荣耀角色 20 件银装——千机伞易主，形态即打法",
      slots: [
        { key: "武器", icon: "⚔", fit: "千机伞|伞|枪|剑|爪|拳套|杖|镰" },
        { key: "头肩", icon: "🎮", fit: "头|肩|冠|盔" },
        { key: "胸甲", icon: "🎮", fit: "胸|袍|甲|衣" },
        { key: "腰带", icon: "🎮", fit: "腰|带" },
        { key: "护腿", icon: "🎮", fit: "腿|靴|裤" },
        { key: "首饰", icon: "🎮", fit: "项链|戒指|手镯|坠|耳环" }
      ]
    },
    swallowedstar: {
      name: "武者装备",
      icon: "🥋",
      tip: "战刀战甲黑神套装——荒野区里，装备就是第二条命",
      slots: [
        { key: "战刀", icon: "⚔", fit: "刀|剑|枪|棍|戟" },
        { key: "战甲", icon: "🛡", fit: "甲|战衣|作战服|护具" },
        { key: "黑神套装", icon: "🌑", fit: "黑神", optional: true, note: "黑神套装：战神级的标志" },
        { key: "飞行器", icon: "🕊", fit: "梭|飞行器|黑神|翼", optional: true }
      ]
    },
    shrouding: {
      name: "法器栏",
      icon: "⚔",
      tip: "本命法器以精血神识温养——圣器动辄镇压一域",
      slots: [
        { key: "本命法器", icon: "⚔", fit: "剑|钟|塔|鼎|镜|幡|珠|炉", note: "本命法器：祭炼于心，离身则折损道行" },
        { key: "道衣", icon: "🛡", fit: "衣|袍|甲" },
        { key: "护身", icon: "🔮", fit: "符|玉|佩|坠" },
        { key: "坐骑", icon: "🐎", fit: "龙|鹤|鹿|舟|兽|辇", optional: true }
      ]
    },
    wanmeishijie: {
      name: "宝器栏",
      icon: "⚔",
      tip: "宝器以宝骨灵材炼就——石村少年的第一件宝器，多半来自某头凶兽",
      slots: [
        { key: "本命宝器", icon: "⚔", fit: "剑|鼎|塔|铃|珠|棍|斧", note: "本命宝器：以骨血祭炼" },
        { key: "战衣", icon: "🛡", fit: "衣|甲|袍|皮" },
        { key: "骨符", icon: "🦴", fit: "骨|符", optional: true }
      ]
    },
    xianni: {
      name: "法宝栏",
      icon: "⚔",
      tip: "法宝说话的界——一件好法宝，比一句道理管用",
      slots: [
        { key: "本命法宝", icon: "⚔", fit: "剑|刀|珠|幡|钟|镜|枪|钉" },
        { key: "护身", icon: "🛡", fit: "甲|符|玉|袍" },
        { key: "飞遁", icon: "🕊", fit: "舟|梭|羽|毯" },
        { key: "傀儡", icon: "🤖", fit: "傀儡|尸偶", optional: true }
      ]
    },
    dibao: {
      name: "帝装栏",
      icon: "🏛",
      tip: "仙帝兵镇世，命宫帝宝通神——万古以来，帝兵有灵",
      slots: [
        { key: "仙帝兵", icon: "⚔", fit: "剑|钟|塔|印|鼎|戟|幡", note: "仙帝兵：帝者之器，认主有灵" },
        { key: "帝甲", icon: "🛡", fit: "甲|袍|衣" },
        { key: "命宫帝宝", icon: "🔮", fit: "玺|灯|书|珠|炉", optional: true }
      ]
    },
    longzu: {
      name: "龙族装备",
      icon: "🐉",
      tip: "学院配装+言灵刻印——混血种的武器库里，刀和秘密一样多",
      slots: [
        { key: "主武器", icon: "⚔", fit: "刀|剑|枪|弓|匕" },
        { key: "龙文护符", icon: "🐉", fit: "护符|纹身|鳞|徽", note: "龙文刻印：言灵的载体" },
        { key: "潜入装备", icon: "🕶", fit: "目镜|耳机|绳|锁|终端" },
        { key: "载具", icon: "🏍", fit: "车|摩托|快艇|机", optional: true }
      ]
    },
    quanzhifashi: {
      name: "法器栏",
      icon: "✨",
      tip: "法器养星辉——一具好法器，够莫凡多放半个禁咒",
      slots: [
        { key: "法器", icon: "⚔", fit: "杖|护腕|铃|镜|剑" },
        { key: "魔具", icon: "🔮", fit: "魔具|晶石|卷轴|瓶" },
        { key: "飞行魔器", icon: "🕊", fit: "翼|毯|扫|羽", optional: true }
      ]
    },
    limingzhijian: {
      name: "魔导装备",
      icon: "⚙",
      tip: "魔导时代的随身武装——符文阵列轰鸣的地方，就是先驱者的脚步",
      slots: [
        { key: "魔导武器", icon: "⚔", fit: "枪|剑|弩|杖|铳" },
        { key: "魔导装置", icon: "⚙", fit: "装置|护盾|通讯器|灯|仪", note: "魔导装置：刚铎遗产的馈赠" },
        { key: "符文护符", icon: "🔮", fit: "符|徽|章|坠" },
        { key: "载具", icon: "🚂", fit: "车|飞艇|马|舟", optional: true }
      ]
    },
    lunhuileyuan: {
      name: "装备栏",
      icon: "⟳",
      tip: "乐园出品的装备带品级——契约者的身家，全在这一栏",
      slots: [
        { key: "武器", icon: "⚔", fit: "刀|剑|枪|弓|爪|匕" },
        { key: "防具", icon: "🛡", fit: "甲|盾|袍|衣" },
        { key: "饰品", icon: "💎", fit: "戒|链|坠|镯" },
        { key: "特殊", icon: "🧬", fit: "核心|芯片|结晶|碎片", optional: true }
      ]
    },
    wulianfengdian: {
      name: "法宝栏",
      icon: "⚔",
      tip: "武道征途上，法宝与拳头都要硬",
      slots: [
        { key: "本命法宝", icon: "⚔", fit: "枪|剑|刀|戟|锤|鞭" },
        { key: "护甲", icon: "🛡", fit: "甲|袍|衣" },
        { key: "飞遁", icon: "🕊", fit: "翼|舟|梭|羽" }
      ]
    },
    shengxu: {
      name: "神器栏",
      icon: "🜂",
      tip: "后神话时代的遗物——山神庙里捡的东西，可能镇着一方气运",
      slots: [
        { key: "神器", icon: "⚔", fit: "弩|剑|杖|钟|幡|珠|鼎", note: "神祇遗物：来历越古越凶" },
        { key: "护身", icon: "🛡", fit: "符|玉|甲|符纸" },
        { key: "飞行", icon: "🕊", fit: "翼|舟|毯|辇", optional: true }
      ]
    },
    shenmifusu: {
      name: "驭鬼装备",
      icon: "🕯",
      tip: "驭鬼者的命都拴在装备上——黄金锁链千年冷，锁得住鬼，锁不住命",
      slots: [
        { key: "驭鬼法器", icon: "⛓", fit: "锁链|铃|镜|剑|绳|钉", note: "驭鬼法器：禁锢厉鬼的本钱" },
        { key: "镇物", icon: "🕯", fit: "符|像|香|钟|镜" },
        { key: "护身", icon: "🛡", fit: "甲|玉|袍|牌", optional: true }
      ]
    },
    daoguiyixian: {
      name: "法器褡裢",
      icon: "🪷",
      tip: "一边是铜铃朱砂，一边是手电充电宝——两个世界各有各的保命物",
      slots: [
        { key: "法器", icon: "🔔", fit: "铃|锣|剑|镜|幡|签" },
        { key: "现代装备", icon: "🔦", fit: "手电|药|手机|打火机|充电", note: "现代造物在大傩世界未必好使" },
        { key: "护身", icon: "🛡", fit: "符|玉|佛|牌" }
      ]
    },
    zhongshengdushi: {
      name: "法器栏",
      icon: "⚔",
      tip: "红尘之中藏锋敛锷——法器要像名表一样，配得上你的马甲",
      slots: [
        { key: "法器", icon: "⚔", fit: "剑|镜|铃|印|扇" },
        { key: "灵器", icon: "🔮", fit: "玉|瓶|珠|壶" },
        { key: "座驾", icon: "🚗", fit: "车|艇|机", optional: true }
      ]
    },
    ditandali: {
      name: "灵武装备",
      icon: "💢",
      tip: "地摊少年的全部家当——大力出奇迹，装备保奇迹",
      slots: [
        { key: "武器", icon: "⚔", fit: "刀|剑|枪|棍|锤|鞭" },
        { key: "护具", icon: "🛡", fit: "甲|护腕|护膝|盔" }
      ]
    },
    jianlai: {
      name: "佩剑栏",
      icon: "🗡",
      tip: "山上人的体面全在佩物上——一剑一袍一枚印，走遍浩然天下",
      slots: [
        { key: "本命佩剑", icon: "🗡", fit: "剑|剑丸|剑胎|飞剑|剑匣", note: "本命剑：剑心温养，人剑合一" },
        { key: "袍服", icon: "👘", fit: "袍|氅|衣|裳|法衣|道袍" },
        { key: "印章信物", icon: "🪪", fit: "印|玉佩|符|牌|腰牌|簪|扇" },
        { key: "养剑葫", icon: "🍶", fit: "葫芦|养剑|酒|囊", optional: true }
      ]
    },
    guimi: {
      name: "随身物",
      icon: "🎩",
      tip: "非凡者的行头就是命——礼帽手杖封印物，一样都马虎不得",
      slots: [
        { key: "手杖武器", icon: "🗡", fit: "手杖|杖|剑|匕首|左轮|枪|刀" },
        { key: "正装", icon: "🎩", fit: "礼帽|大衣|外套|袍|披风|手套|马甲" },
        { key: "封印物", icon: "🔮", fit: "封印|卷轴|人偶|徽章|银牌|镜|怀表|瓶", note: "封印物：威能与代价并存——当心序列特性反噬" },
        { key: "仪式道具", icon: "🕯", fit: "蜡烛|香|水晶|塔罗|纸|粉|药剂", optional: true }
      ]
    },
    guzhenren: {
      name: "蛊窍",
      icon: "🐛",
      tip: "蛊虫即修为——一口一口喂出来的；虫越凶，路越险，窍越空",
      slots: [
        { key: "窍蛊", icon: "💠", fit: "空窍|本命|原石", note: "窍蛊：蛊师的立身根本，真元之容器" },
        { key: "战蛊", icon: "⚔", fit: "战蛊|刃|牙|爪|毒|杀|血|骨|刀|剑" },
        { key: "防蛊", icon: "🛡", fit: "防蛊|甲|壳|盾|障|皮|叶|护" },
        { key: "移蛊", icon: "🕊", fit: "移蛊|遁|翔|飞|行|驰|跳|舟", optional: true }
      ]
    },
    xuanjianxianzu: {
      name: "法器栏",
      icon: "⚔",
      tip: "族中弟子行走在外，法器便是族威——佩上族徽，莫堕家名",
      slots: [
        { key: "本命法器", icon: "⚔", fit: "剑|刀|印|钟|鼎|幡|塔|尺|枪|梭" },
        { key: "护身法衣", icon: "👘", fit: "衣|袍|氅|甲|裳|裙|冠" },
        { key: "族徽信物", icon: "🪪", fit: "族徽|徽|玉佩|令牌|符|牌|箓" },
        { key: "储物袋", icon: "💰", fit: "储物|袋|戒|乾坤|须弥", optional: true }
      ]
    }
  };
  const RP_WORLDS = /* @__PURE__ */ new Set([
    "swallowedstar",
    "shrouding",
    "quanzhigaoshou",
    "wanmeishijie",
    "douluodalu",
    "daoguiyixian",
    "zhongshengdushi",
    "dibao",
    "longzu",
    "quanzhifashi",
    "limingzhijian",
    "lunhuileyuan",
    "wulianfengdian",
    "shengxu",
    "shenmifusu",
    "ditandali",
    "fanrenxiuxian",
    "xianni",
    "quanqiubingfeng",
    "doupocangqiong",
    "chaoshenxueyuan",
    "zhanhen",
    "jianlai",
    "guimi",
    "guzhenren",
    "xuanjianxianzu"
  ]);
  function cfgOf() {
    return REG[genre] || (RP_WORLDS.has(genre) ? GENERIC : null);
  }
  const CFG = cfgOf();
  if (!CFG) return;
  if (window.ModuleSettings) ModuleSettings.describe("gear", [
    { key: "aiEquip", type: "bool", label: "允许 AI 直接改写佩戴", dflt: true, tip: "关闭后佩戴只由玩家手动操作" },
    { key: "showEmpty", type: "bool", label: "显示空槽位", dflt: true, tip: "空槽以虚线框提示可佩位置" }
  ]);
  const OPT = (k, d) => window.ModuleSettings ? ModuleSettings.opt("gear", k, d) : d;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const jn = (s) => String(s).replace(/'/g, "");
  function vars() {
    try {
      return window.storyFramework.storyState.variables || {};
    } catch (e) {
      return {};
    }
  }
  function bagList() {
    return vars().items || [];
  }
  const gearMod = {
    id: "gear",
    icon: CFG.icon,
    name: CFG.name,
    tip: CFG.tip,
    init: () => ({ equipped: {}, custom: [], log: [] }),
    /* 槽位总表 = 世界定义 + 玩家自建 */
    slots(s) {
      return (CFG.slots || []).concat(s.custom || []);
    },
    read(s, vars2, round) {
      var _a, _b;
      let d = false;
      if (!s.equipped) {
        s.equipped = {};
        s.custom = s.custom || [];
        s.log = s.log || [];
      }
      if (OPT("aiEquip", true)) {
        const raw = vars2 ? (_b = (_a = vars2["装备"]) != null ? _a : vars2["穿戴"]) != null ? _b : vars2["equip"] : null;
        if (raw) {
          const pairs = [];
          if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            Object.entries(raw).forEach(([k, v]) => pairs.push([k, typeof v === "object" ? v.name || v.名称 : v]));
          } else {
            const arr = Array.isArray(raw) ? raw : String(raw).split(/[；;\n]+/);
            arr.forEach((x) => {
              if (x && typeof x === "object") {
                pairs.push([x.slot || x.槽位 || "", x.name || x.名称 || ""]);
                return;
              }
              const m = String(x).match(/^([^：:]{1,8})[：:]\s*(.+)$/);
              if (m) pairs.push([m[1].trim(), m[2].trim()]);
            });
          }
          const slots = this.slots(s);
          for (const [slotKey, name] of pairs) {
            if (!name) continue;
            const nm = String(name).slice(0, 24);
            let target = slots.find((sl) => sl.key === String(slotKey).trim()) || slots.find((sl) => String(slotKey).trim() && sl.key.indexOf(String(slotKey).trim()) >= 0) || slots.find((sl) => {
              try {
                return new RegExp(sl.fit || ".").test(nm);
              } catch (e) {
                return false;
              }
            });
            if (!target) continue;
            const cur = s.equipped[target.key];
            if (!cur || cur.name !== nm) {
              s.equipped[target.key] = { name: nm, src: "ai", round };
              s.log.unshift(`第${round}回：${target.key} → ${nm}（随剧情更替）`);
              if (s.log.length > 8) s.log.length = 8;
              d = true;
            }
          }
        }
      }
      const bag = bagList();
      for (const [k, it] of Object.entries(s.equipped)) {
        const miss = it.src === "bag" && !bag.some((x) => String(x.name).includes(it.name));
        if (!!miss !== !!it.missing) {
          it.missing = miss;
          d = true;
        }
      }
      return d;
    },
    /* 状态板：佩戴件数 + 首件名 */
    summary(s) {
      const items = Object.entries(s.equipped || {});
      if (!items.length) return [];
      const miss = items.filter(([, it]) => it.missing).length;
      return [{
        i: CFG.icon,
        v: `${items.length}件在佩`,
        l: (miss ? `⚠缺${miss}件·` : "") + items[0][1].name,
        tone: miss ? "warn" : "ok"
      }];
    },
    /* ---------- 抽屉内：装备栏 ---------- */
    html(s, h) {
      injectStyle();
      const slots = this.slots(s);
      const bag = bagList();
      const equippedNames = new Set(Object.values(s.equipped).map((it) => it.name));
      const cards = slots.map((sl, si) => {
        const it = s.equipped[sl.key];
        const rc = it ? RARITY[rarityOf(it.name)] : null;
        let cands = bag.filter((x) => !equippedNames.has(String(x.name)));
        const fit = cands.filter((x) => {
          try {
            return new RegExp(sl.fit || ".").test(String(x.name));
          } catch (e) {
            return false;
          }
        });
        if (fit.length) cands = fit;
        cands = cands.slice(0, 24);
        const sel = cands.length ? `<div class="gr-fit"><select class="gr-sel" id="grSel_${si}">
                        ${cands.map((x, xi) => {
          const bi = bag.indexOf(x);
          const r = RARITY[rarityOf(x.name)];
          return `<option value="${bi}">${r.c ? "●" : ""}${esc(x.name)}${(x.count || 1) > 1 ? " ×" + x.count : ""}</option>`;
        }).join("")}</select>
                        <button class="wx-btn" onclick="WorldExt.act('gear','eq','${esc(sl.key)}|'+document.getElementById('grSel_${si}').value)">佩</button></div>` : `<div class="gr-fit"><em class="gr-none">囊中没有可佩之物</em></div>`;
        const body = it ? `<div class="gr-on" style="--rc:${rc.c};">
                        <b title="${rc.n}">● ${esc(it.name)}</b>
                        <i class="gr-src">${it.src === "ai" ? "随剧情" : "手动"}${it.missing ? " · ⚠不在囊中" : ""}</i>
                        <button class="gr-un" title="卸下" onclick="WorldExt.act('gear','un','${esc(sl.key)}')">✕</button></div>` : `<div class="gr-off">虚位以待</div>`;
        return `<div class="gr-slot${it ? "" : " empty"}" data-empty="${OPT("showEmpty", true)}">
                    <div class="gr-hd"><span>${sl.icon || "◈"}</span><b>${esc(sl.key)}</b>${sl.note ? `<i class="gr-note" title="${esc(sl.note)}">ⓘ</i>` : ""}</div>
                    ${body}${sel}</div>`;
      }).join("");
      const customMgr = `<div class="gr-mgr">
                <button class="wx-btn" onclick="WorldExt.act('gear','add','')">＋ 自建槽位</button>
                ${s.custom.length ? s.custom.map((sl) => `<button class="wx-btn danger" onclick="WorldExt.act('gear','del','${esc(sl.key)}')">－ ${esc(sl.key)}</button>`).join("") : ""}
            </div>`;
      const log = s.log && s.log.length ? WXH.card("佩换留痕", s.log.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(""), { icon: "📈", grow: true }) : "";
      return `<div class="gr-grid">${cards}</div>${customMgr}${log}
                <div class="wx-banner">佩戴与正文互相咬合：战斗/行路描写须与佩戴一致，本命级装备离手要写；AI 随剧情换装/失装也会落在此处——对不上的「⚠不在囊中」记得处理。</div>`;
    },
    /* ---------- 交互 ---------- */
    act(s, action, payload) {
      const slots = this.slots(s);
      if (action === "eq") {
        const [slotKey, idx] = String(payload).split("|");
        const sl = slots.find((x) => x.key === slotKey);
        const it = bagList()[Number(idx)];
        if (!sl || !it) return "";
        const nm = String(it.name).slice(0, 24);
        s.equipped[sl.key] = { name: nm, src: "bag", round: curRound() };
        s.log.unshift(`第${curRound()}回：${sl.key} → ${nm}（从行囊佩上）`);
        if (s.log.length > 8) s.log.length = 8;
        return `${nm} 已佩入「${sl.key}」`;
      }
      if (action === "un") {
        const it = s.equipped[payload];
        if (!it) return "";
        delete s.equipped[payload];
        s.log.unshift(`第${curRound()}回：卸下${it.name}（${payload}）`);
        if (s.log.length > 8) s.log.length = 8;
        return `已卸下「${payload}」的 ${it.name}`;
      }
      if (action === "add") {
        manualAddSlot(s);
        return "";
      }
      if (action === "del") {
        const i = (s.custom || []).findIndex((x) => x.key === payload);
        if (i >= 0) {
          const sl = s.custom.splice(i, 1)[0];
          delete s.equipped[sl.key];
          return `自建槽位「${sl.key}」已拆除`;
        }
        return "";
      }
      return "";
    },
    /* ---------- 提示词回流 ---------- */
    directive(s) {
      const items = Object.entries(s.equipped || {});
      if (!items.length) return `【${CFG.name}】主角尚无佩戴记录——按身份与家底，给主角一套合身的随身装备（在 (variable_update) 上报 「装备":{"槽位":"名称"}），贫寒有贫寒的穿法，不要凭空发神装。`;
      const miss = items.filter(([, it]) => it.missing);
      const t = [`当前佩戴：${items.map(([k, it]) => `${k}=${it.name}`).join("；")}——战斗/行路/危险描写须与佩戴一致，本命级装备离手要写代价`];
      if (miss.length) t.push(`注意：${miss.map(([k, it]) => `${it.name}`).join("、")}已不在行囊中——剧情里它丢了/被夺了/坏了，主角当有反应`);
      return t.join("；");
    },
    /* ---------- 上报契约 ---------- */
    contract(s) {
      const ex = this.slots(s).map((x) => `"${x.key}":"…"`).filter((x, i, a) => a.indexOf(x) === i).slice(0, 5).join(",");
      return `装备（主角当前佩戴，按槽位上报：「装备」:{${ex}}；空槽可省略；换装、失去装备当轮务必更新）`;
    }
  };
  function curRound() {
    try {
      return Number(window.storyFramework.storyState.variables.chapter) || 0;
    } catch (e) {
      return 0;
    }
  }
  async function manualAddSlot(s) {
    try {
      const input = await window.UIDialog.prompt({
        title: "＋ 自建槽位",
        message: "格式：槽位名|图标|匹配关键词(|分隔)\n例：义体|🦾|义体|机械臂",
        defaultValue: ""
      });
      if (!input) return;
      const [key, icon, fit] = String(input).split(/[|｜]/).map((x) => (x || "").trim());
      if (!key) {
        try {
          window.showToast && showToast("槽位名不能为空", "error");
        } catch (e) {
        }
        return;
      }
      if ((s.custom || []).some((x) => x.key === key) || CFG.slots.some((x) => x.key === key)) {
        try {
          window.showToast && showToast("已有同名槽位", "error");
        } catch (e) {
        }
        return;
      }
      s.custom.push({ key: key.slice(0, 8), icon: icon || "◈", fit: fit || "." });
      try {
        window.showToast && showToast(`自建槽位「${key}」已就位`, "success");
      } catch (e) {
      }
      WorldExt.persist();
      const body = document.getElementById("immBody");
      if (body && body.dataset.wxTab === "1") body.innerHTML = WorldExt.panelHTML();
    } catch (e) {
    }
  }
  function injectStyle() {
    if (document.getElementById("gearStyle")) return;
    const st = document.createElement("style");
    st.id = "gearStyle";
    st.textContent = `
.gr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
.gr-slot{border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 24%,transparent);border-radius:12px;padding:10px;background:rgba(255,255,255,.02);min-width:0}
.gr-slot.empty{border-style:dashed;opacity:.85}
.gr-hd{display:flex;align-items:center;gap:6px;margin-bottom:7px}
.gr-hd span{font-size:14px}
.gr-hd b{font-size:12px;color:var(--ip,#c9a86a);letter-spacing:1px}
.gr-note{font-style:normal;font-size:10px;color:var(--imt,#9a8c6e);cursor:help;margin-left:auto}
.gr-on{display:flex;align-items:baseline;gap:6px;margin-bottom:7px}
.gr-on b{color:var(--rc,#c9a86a);font-size:12.5px;font-weight:600;flex:1;min-width:0;word-break:break-all}
.gr-src{font-style:normal;font-size:9.5px;color:var(--imt,#9a8c6e);white-space:nowrap}
.gr-on .gr-un{background:none;border:none;color:#e0707099;cursor:pointer;font-size:12px;padding:0 2px}
.gr-on .gr-un:hover{color:#e07070}
.gr-off{font-size:11.5px;color:var(--imt,#9a8c6e);margin-bottom:7px;opacity:.7}
.gr-fit{display:flex;gap:5px;align-items:center}
.gr-sel{flex:1;min-width:0;background:rgba(0,0,0,.3);border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 30%,transparent);color:var(--itx,#e8dcc0);border-radius:8px;padding:5px 7px;font-size:11.5px;outline:none}
.gr-none{font-style:normal;font-size:10.5px;color:var(--imt,#9a8c6e);opacity:.7}
.gr-mgr{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}`;
    document.head.appendChild(st);
  }
  WorldExt.injectModules(genre, [gearMod]);
  /* v3.47.5：reg 暴露各界装备栏名（法宝栏/佩剑栏…）——供 ai-response-handler
     已知模块键收集，AI 把「法宝栏: {...}」这类状态行写进正文时精准识别剥离 */
  window.GearCore = { version: VERSION, reg: REG };
})();
