/* =========================================================================
 * 云境 · 玩家身份与原著主角关系（v3.55.20）
 * -------------------------------------------------------------------------
 * 在「叙事立场（取代主角 / 同行者 / 搅局者）」之外，再补两个正交维度：
 *
 *  ① 玩家身份 playerIdentity
 *       transmigrator 穿越者 —— 带着原著的记忆降临，对某些大势、关键机缘、
 *                              谁会死先知先觉，但预知有界。
 *       native        土著   —— 这个世界土生土长的人，对原著一无所知，
 *                              一切真相只能靠亲历、传闻与探索获得。
 *
 *  ② 与原著主角的关系 heroRelation（取代主角立场下关系失效，你即主角）
 *       ally      同伴 —— 你与原著主角同行，道路自然相交。
 *       enemy     敌对 —— 你与原著主角对立，是竞争者 / 对手。
 *       stranger  陌路 —— 你与主角此生可能毫无交集，他走他的人生你走你的；
 *                          世界不会硬把你们凑到一起——这是「世界是活的」最极致的体现。
 *
 * 设计立场：默认 穿越者 + 陌路。
 *   - 穿越者是最常见诉求（想用「我知道会发生什么」破局、抢先手）；
 *   - 陌路最能逼出世界的自主演化——主角在自己的人生轨道上自走一生，
 *     玩家可能终其一生都没见过「原著主角」一面。
 * ========================================================================= */
(function () {
  "use strict";

  var KEY_ID = "yunjingPlayerIdentity";
  var KEY_REL = "yunjingHeroRelation";

  var IDENTITY = {
    transmigrator: {
      id: "transmigrator", ico: "🌀", name: "穿越者", short: "穿越",
      desc: "你带着原著的记忆降临——对某些大势、关键机缘、谁会死先知先觉，但预知有界",
      hint: "想用「我知道会发生什么」破局、抢先手时选它"
    },
    native: {
      id: "native", ico: "🌱", name: "土著", short: "土著",
      desc: "你就是这个世界土生土长的人，对原著一无所知；所有真相只能靠亲历、传闻与探索获得",
      hint: "想要最纯粹的沉浸、不被剧透时选它"
    }
  };
  var ID_ORDER = ["transmigrator", "native"];

  var RELATION = {
    ally: {
      id: "ally", ico: "🤝", name: "同伴", short: "同伴",
      desc: "你与原著主角同行——你们的道路自然相交，他是你身边的伙伴或同路人",
      hint: "想和原著主角并肩同行、共享主线时选它"
    },
    enemy: {
      id: "enemy", ico: "⚔", name: "敌对", short: "敌对",
      desc: "你与原著主角对立——你们是竞争者、对手，甚至你站到了他的对立面",
      hint: "想与主角为敌、改写他的命运轨迹时选它"
    },
    stranger: {
      id: "stranger", ico: "🌫", name: "陌路", short: "陌路",
      desc: "你与原著主角此生可能毫无交集——他走他的人生，你走你的；世界不会硬把你们凑到一起",
      hint: "想要最彻底的世界自主演化、主角在视线外自走一生时选它（推荐体验「世界是活的」）"
    }
  };
  var REL_ORDER = ["ally", "enemy", "stranger"];

  /* ---------- 存储（带 MoStore 兜底） ---------- */
  function readRaw(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function writeRaw(k, v) {
    try { localStorage.setItem(k, v); return true; }
    catch (e) {
      try { if (window.MoStore) return window.MoStore.setItem(k, v); } catch (e2) {}
      return false;
    }
  }

  function stanceId() {
    return window.StoryStance ? window.StoryStance.get() : "cohabit";
  }
  function canonName() {
    return window.StoryStance ? window.StoryStance.canonHeroName() : "原著主角";
  }
  /** 关系是否在当前立场下失效（取代主角 = 你即主角，谈不上关系） */
  function relationDisabled() {
    return stanceId() === "replace";
  }

  function getIdentity() {
    var v = readRaw(KEY_ID);
    return IDENTITY[v] ? v : "transmigrator";
  }
  function getRelation() {
    var v = readRaw(KEY_REL);
    var r = RELATION[v] ? v : "stranger";
    return relationDisabled() ? null : r;
  }

  var StoryIdentity = {
    KEY_ID: KEY_ID, KEY_REL: KEY_REL,
    IDENTITY: IDENTITY, RELATION: RELATION,
    ID_ORDER: ID_ORDER, REL_ORDER: REL_ORDER,

    getIdentity: getIdentity,
    getRelation: getRelation,
    infoIdentity() { return IDENTITY[getIdentity()]; },
    infoRelation() {
      var r = getRelation();
      return r ? RELATION[r] : null;
    },
    /** 关系在「取代主角」立场下失效 */
    relationDisabled: relationDisabled,

    setIdentity(id) {
      if (!IDENTITY[id]) id = "transmigrator";
      writeRaw(KEY_ID, id);
      return id;
    },
    setRelation(id) {
      /* 取代主角立场下不允许设置关系（你即主角） */
      if (relationDisabled()) return null;
      if (!RELATION[id]) id = "stranger";
      writeRaw(KEY_REL, id);
      return id;
    },
    cycleIdentity() {
      var i = ID_ORDER.indexOf(getIdentity());
      return this.setIdentity(ID_ORDER[(i + 1) % ID_ORDER.length]);
    },
    cycleRelation() {
      if (relationDisabled()) return null;
      var cur = getRelation() || "stranger";
      var i = REL_ORDER.indexOf(cur);
      return this.setRelation(REL_ORDER[(i + 1) % REL_ORDER.length]);
    },
    isIdentity(id) { return getIdentity() === id; },
    isRelation(id) { var r = getRelation(); return r != null && r === id; },

    /* =====================================================================
     * 主笔提示词：玩家身份的「元认知边界」
     * 穿越者允许凭预知行动，但预知有界、不倾倒全文；
     * 土著严禁剧透与全知，知识只能来源于体验 / 传闻 / 探索。
     * ===================================================================== */
    buildIdentityDirective() {
      var m = getIdentity();
      if (m === "native") {
        return (
          "\n【身份铁律·土著（最高优先级）】玩家角色是这个世界土生土长的人，对原著剧情、主角命运、隐藏机缘与未来事件一无所知——" +
          "他没有任何「上帝视角」的记忆。因此：\n" +
          "1. 严禁以任何形式向玩家剧透尚未在故事内发生的事：不得点破「这是原著里 XX 的宿命」「你不知道后面会……」「其实他后来……」；" +
          "不得写只有预知者才懂的伏笔式预告；不得让任何角色用「你将来会明白」之类的话泄露未来。\n" +
          "2. 所有世界观、秘辛、人物底细、机缘线索，只能由玩家亲历、打听、探索、传闻、典籍逐步揭开——" +
          "信息不对称是这个世界真实的模样，不要让玩家比他该知道的更多。\n" +
          "3. 玩家角色的判断只基于他此时此刻所知，他的恐慌、误判、后知后觉都要写得真实可信。"
        );
      }
      /* 默认 transmigrator 穿越者 */
      return (
        "\n【身份铁律·穿越者（最高优先级）】玩家角色带着原著的记忆降临，对某些大势走向、关键机缘的所在、某些人的结局先知先觉——但预知有界，须严守：\n" +
        "1. 他「知道」的是粗线条的因果（某秘境将启、某物是重宝、某人日后了不得、某条路凶险），而非精确时机、细节与自己能否改变它；" +
        "不要让他凭空说出尚未发生的对话、未现身的细节或精确的日期。\n" +
        "2. 把预知化作角色的判断与行动——抢先手、规避风险、布局谋篇，而不是写成「你突然想起原著里……」式的 OOC 说明书；" +
        "正文里不要出现「作为穿越者」「按照原著剧情」这类出戏字眼。\n" +
        "3. 他的预知会随世界偏离原著（见立场铁律）而逐渐失效——当玩家搅动了大势，旧记忆不再可靠，误判同样真实。"
      );
    },

    /* =====================================================================
     * 主笔提示词：与原著主角的关系铁律（与立场联动）
     * ===================================================================== */
    buildRelationDirective() {
      if (relationDisabled()) return ""; /* 取代主角：你即主角，无关系可言 */
      var r = getRelation();
      var him = canonName();
      if (r === "ally") {
        return (
          "\n【关系铁律·同伴（最高优先级）】你与原著主角" + him + "同行：你们的道路会自然相交，" + him +
          "可能成为你的同伴、引路人或同路人。但他的人生主线仍按立场铁律照常推进（不因你绕道 / 让位），" +
          "你们的相交是自然的、有因果的——不要为「必须结伴」而强制绑定，但允许并鼓励在共同目标、共同敌人与际遇里并肩。"
        );
      }
      if (r === "enemy") {
        return (
          "\n【关系铁律·敌对（最高优先级）】你与原著主角" + him + "立场相左或目标相冲：你们是竞争者、对手，甚至你主动站到了他的对立面。" +
          him + "的人生主线仍按立场铁律照常推进，但你的存在让他面对一个「原著里没有的变量」——" +
          "你可以在正文中让他以对手 / 竞争者的身份登场、与你交锋，但不得因此扭曲他的核心性格与既定因果。"
        );
      }
      /* stranger 陌路：最彻底的世界自主演化 */
      return (
        "\n【关系铁律·陌路（最高优先级）】你与原著主角" + him + "各走各路——他的整个人生都在你视线之外展开，你们可能终其一生都不再相遇。" +
        "严禁为了「让玩家见到主角」而强行制造巧遇、引荐、任务交集或命运邂逅；他活着、奋斗、遭遇、抉择、结局，都只作为远方世界的回声存在（若动态世界推演到），" +
        "而非闯入玩家当下场景。你要主持的是整个鲜活的世界，不是一个围着玩家转的剧本。"
      );
    },

    /* =====================================================================
     * 动态世界（远方推演）条款：让主角的独立人生 + 玩家身份边界 + 关系，
     * 一并进入「远方事件」的生成约束。
     * 这是「世界一定要活过来」的关键一脚——即便玩家与主角陌路，
     * 主角的命运也照常自行展开。
     * ===================================================================== */
    buildWorldClause() {
      var him = canonName();
      var lines = [];
      /* —— 主角独立人生（始终成立，与立场铁律呼应） —— */
      lines.push("- 原著主角" + him + "有他自己独立、完整的人生主线，正在玩家视线之外自行展开：他奋斗、结交、遭遇、抉择、崛起或陨落，都按他自己的性格与因果推进，不等待玩家、不绕道、不提前登场。");
      lines.push("- 若玩家已夺走本属于" + him + "的机缘（见《机缘归属账本》），他必须按缺失该机缘后的处境推演，不得仍然拥有；世界不会因为玩家停在他身边而替他停滞。");

      /* —— 玩家身份边界 —— */
      if (getIdentity() === "native") {
        lines.push("- 远方事件不得泄露只有「预知者」才懂的剧透：所有信息都须是故事内角色可感知的（传闻、公告、战报、异象、市井流言），不得用全知旁白口吻预告尚未发生的原著转折。");
      } else {
        lines.push("- 远方事件可包含公开层面的大势动向（如「某秘境将启」「某势力异动」「某强者陨落传闻」），但须写成世界内人人可察的表象，而非对原著的剧透式剧透。");
      }

      /* —— 关系 —— */
      if (!relationDisabled()) {
        var r = getRelation();
        if (r === "ally") {
          lines.push("- 因你与" + him + "同行，远方事件里可写他与同路人的行迹、并肩或相互照应的场面，但只作为远方回声，不直接闯入玩家当下场景。");
        } else if (r === "enemy") {
          lines.push("- 因你与" + him + "敌对，远方事件里" + him + "可作为对手 / 竞争者登场，写他如何应对这个「原著没有的变量」；可写他的应对与布局，但不得扭曲其核心性格与既定因果。");
        } else {
          lines.push("- 你与" + him + "是陌路：严禁在远方事件里硬造玩家与主角的相遇、引荐或交集——" + him + "只作为远方世界的独立回声出现，二者不必相见，他的人生照样完整。");
        }
      } else {
        lines.push("- 玩家即" + him + "本人，远方事件不再以其名义另行安排（取代主角立场）。");
      }

      /* —— 世界自主演化（让世界真正活过来） —— */
      lines.push(
        "- 世界必须自主演化：在玩家视线之外，各方势力会兴衰起落，NPC 按自己的目标与欲望行动，旧事件的因果会涟漪般扩散，时间照常流逝。" +
        "主动推演出有延续性的变化（新的冲突、被搅动的利益、悄然改变的格局），而不仅是罗列离散的见闻；" +
        "让玩家感受到——即便他什么都不做，这个世界也在自己往前走。"
      );
      return lines.join("\n");
    }
  };

  window.StoryIdentity = StoryIdentity;
})();
