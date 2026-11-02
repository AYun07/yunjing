/* =========================================================================
 * 云境 · 玩家身份三态（v3.62.0）
 * -------------------------------------------------------------------------
 * 玩家「是谁」，三选一，开局选择、开局后仍可随时切换：
 *
 *   hero     原著主角 —— 你穿越/成为原著主角，亲历原著主线。
 *                       铁律：大势不可改（关键节点与因果锁死），小势可微调
 *                       （过程、支线、人际、细节由你把握）。
 *   side     原著配角 —— 你成为原著里的某个配角，按其原著定位
 *                       （身份 / 实力 / 处境 / 人脉 / 命运）展开属于他自己的人生线。
 *   original 完全原创 —— 你彻底自创一个角色，没有任何原著身份与宿命；
 *                       路径、际遇、立场全由你把控，大模型辅助推演交汇。
 *
 * 设计立场：默认 hero（绝大多数玩家的第一诉求是「走一遍原著主线」）。
 * 三态均保留「穿越者/土著」元认知边界（StoryIdentity）与「与原著主角关系」
 * （仅 side / original 有效，hero 即主角、关系失效）两层正交修饰。
 *
 * 每个世界可在 config 提供 canonMajorNodes（大势节点）与 canonSideChars
 * （原著配角表）；缺省走内置表与通用兜底，绝不臆造人名。
 * ========================================================================= */
(function () {
  "use strict";

  var KEY = "yunjingStoryStance";
  var KEY_SIDE = "yunjingSideChar";

  var MODES = {
    hero: {
      id: "hero",
      ico: "👑",
      name: "原著主角",
      short: "主角",
      desc: "穿越 / 成为原著主角，亲历原著主线——大势不可改，小势可微调",
      hint: "想替代韩立、萧炎……一步步走原著主线、亲手改写自己的选择时选它"
    },
    side: {
      id: "side",
      ico: "🎭",
      name: "原著配角",
      short: "配角",
      desc: "成为原著里的某个配角，按其原著定位（身份 / 实力 / 处境 / 人脉 / 命运）展开属于他自己的人生线",
      hint: "想体验「配角也有自己的剧本」、在主角的阴影里活出自我时选它"
    },
    original: {
      id: "original",
      ico: "✨",
      name: "完全原创",
      short: "原创",
      desc: "彻底自创角色，没有任何原著身份与宿命；路径与际遇全由你把控，大模型辅助推演交汇",
      hint: "想完全自由地活一个属于自己的角色、与原著人物随性相交时选它"
    }
  };
  var ORDER = ["hero", "side", "original"];

  /* 常见世界原著主角名（配置 canonProtagonist 优先；查不到用通称，绝不臆造） */
  var CANON_HEROES = {
    fanrenxiuxian: "韩立", doupocangqiong: "萧炎", douluodalu: "唐三",
    wanmeishijie: "石昊", shrouding: "叶凡", swallowedstar: "罗峰",
    quanzhigaoshou: "叶修", daoguiyixian: "李火旺", longzu: "路明非",
    quanzhifashi: "莫凡", lunhuileyuan: "苏晓", shengxu: "楚风",
    shenmifusu: "杨间", limingzhijian: "高文", xianni: "王林",
    guzhenren: "方源", jianlai: "陈平安"
  };

  /* ---------- 大势节点（hero 态锁死的「不可改」清单）---------- */
  var MAJOR_NODES = {
    fanrenxiuxian: [
      "七玄门墨大夫之死与乱星海机缘的开启",
      "血色试炼的生死与筑基之路",
      "天南六大魔道与越国灭国的大势走向",
      "坠魔谷探宝与化神机缘",
      "飞升灵界、乱星海至木族大乘的因果链"
    ],
    douluodalu: [
      "唐三觉醒蓝银草 / 昊天锤双生武魂",
      "史莱克七怪的结成与全大陆高级魂师学院精英赛",
      "武魂殿崛起与两大帝国、上三宗的对立",
      "嘉陵关决战与武魂帝国兴衰",
      "海神岛传承与成神之路"
    ],
    doupocangqiong: [
      "萧炎乌坦城天才陨落与药老唤醒",
      "迦南学院异火争夺与三年之约",
      "云岚宗恩怨与逐出师门之仇",
      "中州丹会、魂殿阴谋与双帝之战",
      "陀舍古帝玉与净莲妖火终局"
    ],
    wanmeishijie: [
      "石昊自石村走出、补天阁学艺",
      "虚神界与上界征战、至尊骨风波",
      "仙古遗地、边荒帝关抵御异域",
      "独断万古、以身为种的道途",
      "末法时代与成帝之途"
    ],
    xianni: [
      "王林恒岳派受辱与踏入修真",
      "司徒南之缘与古神之地",
      "朱雀星、罗天星域与昆极鞭之争",
      "七彩道尊因果与逆之因果一道",
      "踏天之境、本尊与分身归一"
    ],
    jianlai: [
      "陈平安小镇少年、齐先生启蒙",
      "骊珠洞天、送信路上一桩桩缘法",
      "山崖书院与山河剑派之争",
      "剑气长城抵御蛮荒大妖",
      "立教、问剑天下、自成一家"
    ],
    swallowedstar: [
      "罗峰地球的陨落与 RR 崛起",
      "雾岛争夺、金角巨兽之战",
      "宇宙佣兵、乾巫宇宙国修炼",
      "域外战场、鸿盟与界主之路",
      "宇宙尊者至称圣的因果"
    ],
    shrouding: [
      "叶凡泰山聚会、九龙拉棺至火星",
      "荒古禁地、苦苦海修源术",
      "姬家、摇光与各大圣地的恩怨",
      "成仙路、黑暗动乱与红尘成仙",
      "红尘仙之路、史上最强者之争"
    ],
    longzu: [
      "路明非衰小孩的卡塞尔学院录取",
      "屠龙任务、言灵觉醒与混血种宿命",
      "青铜城、龙王复活与白王之乱",
      "绘梨衣、诺诺与少年的羁绊",
      "末日真相与混血种的归处"
    ],
    quanzhigaoshou: [
      "叶修脱离嘉世、被迫退役",
      "兴欣网吧重建、第十区开荒",
      "挑战赛夺冠、重返联盟",
      "全明星与总决赛的恩怨",
      "荣耀不败的传说续写"
    ]
  };
  var GENERIC_NODES = [
    "主角命中注定的出身与觉醒契机",
    "贯穿全篇的核心冲突与最终敌人",
    "原著里决定世界走向的几桩大事",
    "原著主角的归宿与关键因果链"
  ];

  /* ---------- 原著配角表（side 态可选）---------- */
  /* 字段：id / name / role 身份 / realm 实力位阶 / disposition 性格 /
   *       fate 原著命运定位 / rel 与原著主角关系 / hook 可展开的人生钩子 */
  var SIDE_CHARS = {
    fanrenxiuxian: [
      { id: "mo", name: "墨彩环", role: "七玄门墨大夫之女", realm: "凡俗武者", disposition: "聪慧倔强、重情", fate: "原著里困于门派与父辈恩怨的旁支", rel: "与主角同门渊源", hook: "在门派倾轧里寻自己的出路，父仇与生存之间如何自处" },
      { id: "nan", name: "南宫婉", role: "掩月宗精英弟子", realm: "结丹期修士", disposition: "清冷孤高、外冷内热", fate: "原著里与主角亦敌亦友、纠缠半生", rel: "主角的宿命之交", hook: "宗门重任与一段不愿承认的情愫，如何在正魔夹缝里保全自身" },
      { id: "li", name: "厉飞雨", role: "七玄门弟子", realm: "凡俗武者", disposition: "义气豪爽、重兄弟", fate: "原著里早夭的旁支，死于门派倾轧", rel: "主角的早期挚友", hook: "能否挣脱既定的早夭命运，与主角共闯一条不同的路" },
      { id: "yan", name: "菡云芝", role: "黄枫谷女修", realm: "结丹期修士", disposition: "温婉大气、护短", fate: "原著里宗门衰败的见证者", rel: "主角的故交长辈", hook: "宗门式微时如何守住一脉香火，提携后辈还是明哲保身" }
    ],
    douluodalu: [
      { id: "xiao", name: "小舞", role: "史莱克学院学员 / 十万年魂兽化形", realm: "魂圣→封号斗罗", disposition: "灵动倔强、重情护短", fate: "原著里为爱献祭、与主角生死相依", rel: "主角的生死挚爱", hook: "魂兽身份暴露在即，如何在人与兽、爱与生存间抉择" },
      { id: "dai", name: "戴沐白", role: "史莱克七怪 / 星罗皇子", realm: "强攻系战魂帝", disposition: "傲骨多情、重袍泽", fate: "原著里争回皇位、七怪之盾", rel: "主角的兄弟与兄长", hook: "星罗王位之争里，兄弟情与家国责如何两全" },
      { id: "zhu", name: "朱竹清", role: "史莱克七怪 / 朱家嫡女", realm: "敏攻系魂帝", disposition: "清冷果决、外冷内热", fate: "原著里挣脱家族宿命的幽冥灵猫", rel: "主角团的核心战力", hook: "朱家姐妹相残的宿命，能否走出另一条路" }
    ],
    doupocangqiong: [
      { id: "xun", name: "萧薰儿", role: "古族大小姐", realm: "斗宗→斗圣", disposition: "温婉腹黑、护夫狂魔", fate: "原著里古族天之骄女，与主角青梅竹马", rel: "主角的青梅与挚爱", hook: "古族规矩与一颗凡心，如何替主角挡下族中重重阻力" },
      { id: "yao", name: "药老", role: "星陨阁创立者 / 骨灵冷火之主", realm: "斗尊→斗圣（残魂起步）", disposition: "亦师亦友、老谋深算", fate: "原著里魂殿追杀、夺舍危机", rel: "主角的引路人", hook: " resurrect 之路上，师徒情谊与各自执念的拉扯" },
      { id: "mei", name: "美杜莎女王", role: "蛇人族女王", realm: "斗皇→斗尊", disposition: "高傲冷艳、说一不二", fate: "原著里异火反噬、与主角纠葛", rel: "主角的强敌与羁绊", hook: "族群的存亡与一段被迫的姻缘，女王如何护住蛇人族" }
    ],
    wanmeishijie: [
      { id: "yun", name: "云曦", role: "天人族神女", realm: "尊者境", disposition: "温婉出尘、重情守诺", fate: "原著里与主角羁绊、天人族兴衰见证", rel: "主角的知己", hook: "天人族立场与一颗凡心，如何在两族之间周旋" },
      { id: "huo", name: "火灵儿", role: "火国小公主", realm: "列阵境", disposition: "天真娇憨、敢爱敢恨", fate: "原著里火国明珠、与主角青梅", rel: "主角的青梅", hook: "一国公主的成长，如何在乱世里护住自己的国与所爱" }
    ],
    xianni: [
      { id: "li", name: "李慕婉", role: "修真界女修", realm: "元婴期", disposition: "温柔坚韧、默默守护", fate: "原著里早逝、主角逆天相救", rel: "主角的挚爱", hook: "寿元将尽时，如何与那个逆天改命的男人走完一段路" }
    ],
    jianlai: [
      { id: "nie", name: "宁姚", role: "剑气长城宁家天骄", realm: "玉璞境剑修", disposition: "冷冽坚毅、护短", fate: "原著里剑气长城的守望者", rel: "主角的心上人", hook: "长城风雨欲来，一柄剑如何守一座城与一个人" }
    ],
    swallowedstar: [
      { id: "xu", name: "徐欣", role: "罗峰之妻", realm: "行星级", disposition: "温婉坚强、持家", fate: "原著里随主角走上宇宙之路", rel: "主角的伴侣", hook: "平凡妻子面对宇宙的洪流，如何与爱人并肩而非被保护" }
    ],
    shrouding: [
      { id: "ji", name: "姬紫月", role: "姬家圣女", realm: "仙台秘境", disposition: "娇俏率真、敢爱敢恨", fate: "原著里与主角纠缠半生的圣女", rel: "主角的红颜知己", hook: "圣地规矩与一颗凡心，如何在成仙路上护住所爱" }
    ],
    longzu: [
      { id: "nuo", name: "诺诺", role: "卡塞尔学院王牌", realm: "混血种 A 级", disposition: "飒爽张扬、藏尽孤独", fate: "原著里背负家族秘密的狮王", rel: "主角的学姐与羁绊", hook: "秘党与家族的夹缝里，如何替那个衰小孩挡下命运的刀" }
    ],
    quanzhigaoshou: [
      { id: "tang", name: "唐柔", role: "兴欣新人 / 战斗法师", realm: "全明星级", disposition: "冷静专注、外冷内热", fate: "原著里被叶修发掘的天才少女", rel: "主角的弟子", hook: "从被保护的新人到独当一面，如何走出自己的荣耀" }
    ]
  };
  var GENERIC_SIDE = [
    { id: "gen_a", name: "原著旁支甲", role: "主角身边的小角色", realm: "原著设定中游实力", disposition: "随原著设定", fate: "原著里无足轻重的过客", rel: "与主角的浅缘", hook: "一个本该是背景板的人，如何在世界缝隙里活出自己的故事" },
    { id: "gen_b", name: "原著同门乙", role: "主角师门 / 同窗", realm: "原著设定中上游实力", disposition: "随原著设定", fate: "原著里陪衬主角的配角", rel: "与主角的同门之谊", hook: "在主角光环旁，如何经营自己的一段人生与羁绊" }
  ];

  /* ---------- 读取当前世界配置 ---------- */
  function config() {
    try {
      var fw = window.storyFramework;
      if (fw && fw.config) return fw.config;
    } catch (e) {}
    return {};
  }
  function genreKey() {
    var c = config();
    return c.genre || c.genreKey || c.id || "";
  }
  function canonHeroName() {
    var c = config();
    return c.canonProtagonist || CANON_HEROES[genreKey()] || "原著主角";
  }

  function read() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }
  function readSide() {
    try { return localStorage.getItem(KEY_SIDE) || ""; } catch (e) { return ""; }
  }

  /* 取某世界的配角表（配置优先 → 内置 → 通用兜底） */
  function sideChars(genre) {
    var c = config();
    if (Array.isArray(c.canonSideChars) && c.canonSideChars.length) return c.canonSideChars;
    return SIDE_CHARS[genre] || GENERIC_SIDE;
  }
  function sideCharInfo(genre, id) {
    var list = sideChars(genre);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function majorNodes(genre) {
    var c = config();
    if (Array.isArray(c.canonMajorNodes) && c.canonMajorNodes.length) return c.canonMajorNodes;
    return MAJOR_NODES[genre] || GENERIC_NODES;
  }

  var StoryStance = {
    KEY: KEY, KEY_SIDE: KEY_SIDE,
    MODES: MODES, ORDER: ORDER,
    CANON_HEROES: CANON_HEROES,

    get() {
      var v = read();
      return MODES[v] ? v : "hero";
    },
    info() { return MODES[this.get()]; },
    set(id) {
      if (!MODES[id]) id = "hero";
      try {
        localStorage.setItem(KEY, id);
        /* 同步旧「自由度」开关（storyFreedom）：主角/配角走原著轨道，原创自由 */
        localStorage.setItem("storyFreedom", id === "original" ? "free" : "canon");
      } catch (e) {}
      return id;
    },
    cycle() {
      var i = ORDER.indexOf(this.get());
      return this.set(ORDER[(i + 1) % ORDER.length]);
    },
    is(id) { return this.get() === id; },
    canonHeroName: canonHeroName,

    /* —— side 配角选择 —— */
    sideCharId() { return this.get() === "side" ? readSide() : ""; },
    setSideChar(id) {
      try { localStorage.setItem(KEY_SIDE, id); } catch (e) {}
      return id;
    },
    getSideChars() { return sideChars(genreKey()); },
    getSideCharInfo() { return sideCharInfo(genreKey(), this.sideCharId()); },

    /* =====================================================================
     * 主笔 system prompt：身份铁律
     * ===================================================================== */
    buildDirective(heroName, canonHeroName, isRP) {
      var m = this.get();
      var me = heroName || "玩家角色";
      var him = canonHeroName || "原著主角";
      if (!isRP) {
        return "\n【立场铁律】玩家角色是故事的核心，其余人物按其性格与逻辑自行行动，不得围绕玩家转。";
      }
      if (m === "hero") {
        var nodes = majorNodes(genreKey());
        var lock = nodes.map(function (n, i) { return (i + 1) + ". " + n; }).join("；");
        return (
          "\n【身份铁律·原著主角（最高优先级）】" +
          "玩家" + me + "即原著主角" + him + "本人——" + him + "这个名字所指的那条命，此刻由玩家来活；" +
          him + "不再作为独立人物登场（严禁出现" + him + "与玩家同台、对话或并存）。\n" +
          "①【大势不可改】原著主线由玩家亲历；以下关键大势节点与因果链锁死、不可被改写或跳过：" + lock + "。" +
          "这些节点的「结果」必须发生，玩家不能凭选择让它们凭空消失。\n" +
          "②【小势可微调】上述节点之间的过程、支线、人际、细节、节奏由玩家把握——" +
          "同一节点可以有不同走法、不同际遇、不同人物关系与结局注脚，但不得颠覆节点的必然结果；" +
          "玩家可以不按原著选择，取代的是路径而非结局的必然。\n" +
          "③ 原著其余人物、势力仍按其原著性格与逻辑行动，不因玩家而失真；资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
        );
      }
      if (m === "side") {
        var sc = this.getSideCharInfo();
        if (!sc) {
          return (
            "\n【身份铁律·原著配角（最高优先级）】玩家是原著世界里的某个配角，按其原著定位展开属于自己的人生线；" +
            "原著主角" + him + "按自己的命运走完一生，不因你而改；资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
          );
        }
        return (
          "\n【身份铁律·原著配角（最高优先级）】玩家" + me + "即原著配角「" + sc.name + "」——" +
          sc.role + "（" + sc.realm + "），原著里的定位是：" + sc.fate + "。\n" +
          "① 玩家要按" + sc.name + "的原著定位（身份 / 实力 / 处境 / 人脉 / 命运）展开属于" + sc.name + "自己的人生线——" +
          sc.name + "不抢主角戏份，但" + sc.name + "自己的人生要完整、有起伏、有属于自己的羁绊与结局。\n" +
          "② " + sc.name + "与原著主角" + him + "的关系底子是：「" + sc.rel + "」，既有的恩怨与缘法照常，但玩家可在其中经营自己的路、走出与原著不同的注脚。\n" +
          "③ 主角" + him + "按原著走自己的人生，不因玩家绕道、让位或提前登场；世界因" + sc.name + "这个变量的介入而产生属于配角的涟漪与支线。\n" +
          "④ 可展开的人生钩子：" + sc.hook + "。资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
        );
      }
      /* original：完全原创 */
      return (
        "\n【身份铁律·完全原创（最高优先级）】玩家" + me + "是一个完全原创的角色——没有任何原著身份、宿命与因果，不依附于任何原著主线。\n" +
        "① 路径、际遇、立场、人际关系全由玩家把控；你（主笔）负责主持整个世界并辅助推演：玩家的选择会自然地与" + him +
        "等原著人物、势力、事件交汇，但这一切是「玩家主动走入」，而非被原著剧本推着走。\n" +
        "② 无原著约束：玩家可以自由相交原著人物、改写局部因果、开辟全新支线；世界因这个原创变量而产生的变化，须合乎其性格与处境的因果，不得凭空。\n" +
        "③ 资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
      );
    },

    /* =====================================================================
     * 动态世界（远方推演）立场条款
     * ===================================================================== */
    buildWorldClause(canonHeroName) {
      var m = this.get();
      var him = canonHeroName || "原著主角";
      if (m === "hero") {
        return (
          "- 玩家即" + him + "本人，远方事件不再以其名义另行安排（原著主角立场）\n" +
          "- 世界须照常自主演化：各方势力兴衰、NPC 按自身目标行动、旧事件因果涟漪扩散、时间照常流逝——即便玩家不行动，世界也要自己往前走"
        );
      }
      if (m === "side") {
        var sc = this.getSideCharInfo();
        var who = sc ? sc.name : "该配角";
        return (
          "- 原著主角" + him + "有他自己的人生主线，在玩家视线之外推进，不因玩家绕道、让位或提前登场\n" +
          "- 玩家扮演的配角「" + who + "」按原著定位自行演化其人生线，其际遇与世界事件自然相交、互不越界\n" +
          "- 若玩家已改变本属" + him + "的因果，须按改写后的处境推演，不得仍按原著原貌落笔"
        );
      }
      return (
        "- 原著主角" + him + "按原著走完一生，在玩家视线之外自走，不因玩家而改道\n" +
        "- 玩家是完全原创变量：世界的演化由这个原创角色与各方势力的真实互动驱动，无既定剧本兜底\n" +
        "- 世界必须自主演化：势力兴衰、NPC 自走、因果涟漪、时间流逝——玩家不行动，世界也照常往前"
      );
    }
  };

  window.StoryStance = StoryStance;
})();
