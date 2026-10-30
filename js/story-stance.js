/* =========================================================================
 * 云境 · 叙事立场（v3.55.19）
 * -------------------------------------------------------------------------
 * 玩家与原著主角的关系，三选一，可随时切换：
 *
 *   replace  取代主角 —— 玩家就是原著主角本人，原著主线由玩家亲历；
 *                       原著主角不再作为独立人物登场。
 *   cohabit  同行者   —— 玩家是自创角色，是这个世界的活生生一份子；
 *                       原著主角按自己的命运走完他的一生（不可因玩家改写）。
 *   freewill 搅局者   —— 玩家是自创角色，且可以偏转/改写原著大势。
 *
 * 设计立场：默认 cohabit。因为「替代原著主角一步步经历原著主线」不是创作，
 * 那只是复述；真正有意思的是——你在那个世界里活着，而主角的一生同时
 * 在他自己的轨道上展开，你们可能相交、可能错过、可能抢了同一份机缘。
 * ========================================================================= */
(function () {
  "use strict";

  var KEY = "yunjingStoryStance";

  var MODES = {
    replace: {
      id: "replace",
      ico: "👑",
      name: "取代主角",
      short: "取代",
      desc: "你就是原著主角本人——原著主线由你亲历，原著主角不再作为独立人物登场",
      hint: "想亲自走一遍原著主线、改写主角的选择时选它"
    },
    cohabit: {
      id: "cohabit",
      ico: "🧍",
      name: "同行者",
      short: "同行",
      desc: "你是这个世界里自己的人；原著主角按他自己的命运走完一生，不因你而改",
      hint: "默认。你想作为一个活生生的人存在于那个世界时选它"
    },
    freewill: {
      id: "freewill",
      ico: "🌪",
      name: "搅局者",
      short: "搅局",
      desc: "你是自创角色，且你的行动可以偏转、甚至改写原著大势与人物命运",
      hint: "想让世界因你而改道时选它（最自由，也最容易失去原著味道）"
    }
  };

  var ORDER = ["replace", "cohabit", "freewill"];

  /* 常见世界的原著主角名（世界配置可用 canonProtagonist 覆盖；查不到则用通称，
     绝不臆造人名——臆造的名字注入提示词比不写更糟） */
  var CANON_HEROES = {
    fanrenxiuxian: "韩立",
    doupocangqiong: "萧炎",
    douluodalu: "唐三",
    wanmeishijie: "石昊",
    shrouding: "叶凡",
    swallowedstar: "罗峰",
    quanzhigaoshou: "叶修",
    daoguiyixian: "李火旺",
    longzu: "路明非",
    quanzhifashi: "莫凡",
    lunhuileyuan: "苏晓",
    shengxu: "楚风",
    shenmifusu: "杨间",
    limingzhijian: "高文",
    xianni: "王林",
    guzhenren: "方源",
    jianlai: "陈平安"
  };

  /** 当前世界的原著主角名（配置优先 → 内置表 → 通称） */
  function canonHeroName() {
    var genre = "";
    var explicit = "";
    try {
      var fw = window.storyFramework;
      if (fw && fw.config) {
        genre = fw.config.genre || fw.config.genreKey || fw.config.id || "";
        explicit = fw.config.canonProtagonist || "";
      }
    } catch (e) {}
    return explicit || CANON_HEROES[genre] || "原著主角";
  }

  function read() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (e) {
      return "";
    }
  }

  var StoryStance = {
    KEY: KEY,
    MODES: MODES,
    ORDER: ORDER,

    /** 当前立场 id（缺省 cohabit） */
    get() {
      var v = read();
      return MODES[v] ? v : "cohabit";
    },
    info() {
      return MODES[this.get()];
    },
    set(id) {
      if (!MODES[id]) id = "cohabit";
      try {
        localStorage.setItem(KEY, id);
        /* 同步旧的两档开关（storyFreedom），让既有的「自由度指令 / 质量套件」逻辑不割裂：
           搅局者 = 自由；取代主角与同行者都走原著轨道 */
        localStorage.setItem("storyFreedom", id === "freewill" ? "free" : "canon");
      } catch (e) {}
      return id;
    },
    cycle() {
      var i = ORDER.indexOf(this.get());
      return this.set(ORDER[(i + 1) % ORDER.length]);
    },
    is(id) {
      return this.get() === id;
    },
    /** 当前世界的原著主角名 */
    canonHeroName: canonHeroName,

    /**
     * 生成注入主笔 system prompt 的立场铁律。
     * @param {string} heroName 玩家角色名
     * @param {string} canonHeroName 原著主角名（来自世界配置 canonProtagonist，可为 "原著主角"）
     * @param {boolean} isRP 是否 roleplay 模式
     */
    buildDirective(heroName, canonHeroName, isRP) {
      var m = this.get();
      var me = heroName || "玩家角色";
      var him = canonHeroName || "原著主角";
      if (!isRP) {
        return "\n【立场铁律】玩家角色是故事的核心，其余人物按其性格与逻辑自行行动，不得围绕玩家转。";
      }
      if (m === "replace") {
        return (
          "\n【立场铁律·取代主角（最高优先级）】" +
          "玩家" + me + "即原著主角本人——" + him + "这个名字所指的那条命，此刻由玩家来活；" +
          him + "不再作为独立人物登场（严禁出现" + him + "与玩家同台、对话、竞争或并存），" +
          "原著主线上的际遇、机缘、人物关系一律落到玩家身上，由玩家自己抉择如何走；" +
          "原著其余人物、势力仍按其原著性格与逻辑行动，不因玩家而失真；" +
          "玩家可以不按原著选择——取代的是位置，不是剧本；" +
          "资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
        );
      }
      if (m === "freewill") {
        return (
          "\n【立场铁律·搅局者（最高优先级）】" +
          "玩家" + me + "是这个世界中的自创角色，不是原著主角；你的职责是主持世界——" +
          "原著人物、势力按其性格与逻辑行动，但原著大势不是铁轨：玩家的行动可以影响、偏转、甚至改写原著主线与原著人物的命运；" +
          "你不得用原著剧情推着玩家走，也不得为「还原原著」而扭曲玩家的选择与际遇；" +
          "资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
        );
      }
      /* cohabit：默认 */
      return (
        "\n【立场铁律·同行者（最高优先级）】" +
        "玩家" + me + "是这个世界中活生生的一份子，是一个自创角色，不是原著主角；" +
        "你的职责是主持整个世界，而不是给玩家安排原著剧本：\n" +
        "1. " + him + "有他自己的一生——他按原著的性格、处境与命运继续走他的路，不因玩家而改写，也不因玩家的在场而绕道；" +
        "他不会因为玩家而突然出现、突然结交、突然让位，更不会把本属于他的机缘拱手相让。\n" +
        "2. 玩家不是世界的中心：玩家不出名、不被特殊对待、不享有主角光环；" +
        "世界不会因为玩家停下而停下，远方该发生的事照常发生。\n" +
        "3. 玩家只作用于自身际遇与身边支线：能改变的只有自己够得着的东西。\n" +
        "4. 唯一可以真正改动" + him + "的，是玩家亲手夺走本该属于他的东西——" +
        "一旦夺走，就不是「他仍然有」：他必须按「缺失这份机缘之后」的处境重新推演自己的路（见《机缘归属账本》）。\n" +
        "5. 资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。"
      );
    },

    /** 生成注入动态世界（远方推演）的立场条款 */
    buildWorldClause(canonHeroName) {
      var m = this.get();
      var him = canonHeroName || "原著主角";
      if (m === "replace") {
        return "- " + him + "本人不再登场（玩家已取代他）；推演时不得以他的名义安排远方事件";
      }
      if (m === "freewill") {
        return "- " + him + "的动向可被玩家影响而偏转，但须合乎其性格与处境的因果，不得凭空改命";
      }
      return (
        "- " + him + "有他自己的人生主线，正在玩家视线之外推进；他不会因玩家的在场而绕道、让位或提前登场\n" +
        "- 若玩家已夺走本属于他的机缘（见《机缘归属账本》），他必须按缺失该机缘后的处境推演，不得仍然拥有"
      );
    }
  };

  window.StoryStance = StoryStance;
})();
