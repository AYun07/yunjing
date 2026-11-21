/* =========================================================================
 * 云境 · 语义词缀引擎 SemanticEngine（v5.1.0 · 本地 + 大模型双重解读）
 * -------------------------------------------------------------------------
 * 用户诉求：「词条不是只有那几条，而是应该动态生成，根据当时的情况、性质、
 *   骰子等等综合而成；玩家可以自定义词条；每种词条的加成除了玩家特殊说明，
 *   默认直接解读该词条的语意来附加效果；所有系统都是这样；世界很奇妙，
 *   什么都有可能发生，一定要遵循这一规律。」
 *
 * 这是一次范式转变：从「固定词库 + id 查表写死 stat/value」改为
 *   「任意文本 → 语意解读 → 加成」，叠加「情境动态生成 + 玩家自定义 + 显式优先」。
 *
 * 设计红线（DR-016）：
 *   ① 语意解读 interpret()：本地语素→属性倾向词典（攻/防/速/气血/暴击/六维），
 *      程度副词加权、否定词转减益；显式数值声明（+9攻击/防御-3/暴击+5%）优先覆盖。
 *   ② 动态生成 generate()：情境种子（世界genre/回合/骰子/战斗/装备性质/随机）从
 *      意象×倾向素材组合生成词条名，再经 interpret 解读。同种子可复现、异情境可
 *      产出不同词条、保留涌现通道（极端情境出 unusual 词条）。
 *   ③ 玩家自定义 setCustom()：对任意目标（装备名/称号名/随行id）写词条文本，
 *      持久化，刷新不丢；自定义优先于自动生成。
 *   ④ 零网络、纯函数、种子化 PRNG（可复现）、延迟解析依赖、老档兼容。
 *   ⑤ 版权：语素是自然语言的通用语义（锋=攻、坚=守），非任何项目专属词库；
 *      全局机制层沿用云境原创词。
 *
 * v5.1.0 · 本地 + 大模型双重解读（DR-017）：
 *   - 第一重「本地语素」：interpret() 同步纯函数，即时、离线、可复现——战斗/检定/
 *     面板直接调用，永远是零延迟的即时结果与降级保底。
 *   - 第二重「大模型语意」：llm 层异步解读任意文本，走已治理通道（MoNetGuard
 *     退避重试 + AIGovernor 并发闸门 + TokenUsage 记账 tag=语义解读），把大模型的
 *     深度语意解读写入缓存 yunjingSemanticLLM~slot；下次 interpret() 命中缓存即
 *     采用大模型结果（source=llm）。未配置/未开启/调用失败 → 完全回退本地。
 *   - 优先级（永不变）：玩家显式数值声明 > 大模型解读（有缓存时）> 本地语素 > 涌现。
 *   - 成本纪律：缓存 TTL + 批量去重 + inflight 去重 + 每次最多 N 条 + 全局开关，
 *     同一文本绝不重复解读；零网络环境下与 v5.0.0 行为逐字一致。
 * ========================================================================= */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});
  var VERSION = "5.1.0";

  /* ---------- 工具 ---------- */
  function slot() { try { return (G.storyFramework && G.storyFramework.slotId) || "main"; } catch (e) { return "main"; } }
  function lsGet(k, fb) { try { var raw = G.localStorage && G.localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch (e) { return fb; } }
  function lsSet(k, v) { try { if (G.localStorage) { G.localStorage.setItem(k, JSON.stringify(v)); return true; } } catch (e) {} return false; }
  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return n < lo ? lo : (n > hi ? hi : n); }
  function hash(str) {
    var h = 2166136261; str = String(str == null ? "" : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  /** 种子化伪随机（mulberry32）：同种子序列恒定，用于可复现的动态生成 */
  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

  /* =====================================================================
   * 〇、大模型解读层基础设施（v5.1.0）
   *   缓存持久化、TTL、开关、inflight 去重、批量上限——全部本地，零网络也能工作。
   * ===================================================================== */
  var LLM_KEY = "yunjingSemanticLLM~" + slot();
  var LLM_ON_KEY = "yunjingSemanticLLMOn~" + slot();
  var LLM_TTL = 7 * 24 * 3600 * 1000;   /* 7 天：语意解读不必反复花钱 */
  var LLM_BATCH_MAX = 8;                 /* 每次最多解读 8 条文本，控制单次成本 */
  var LLM_TIMEOUT_MS = 120000;           /* v5.1.1：大模型解读默认 120 秒无响应即判超时 */
  var llmInflight = {};                  /* 内存级去重：同一文本在途只发一次 */

  /* v5.1.1：自带截止时间的 fetch（拿不到全局 fetchWithTimeout 时的兜底：
     Node 沙箱 / 老缓存）。AbortController 在截止时刻 abort，
     响应头之后的正文流读取也会被打断，不会「头到了、正文卡死」。 */
  function timedFetch(url, opts, ms) {
    var timeoutMs = ms || LLM_TIMEOUT_MS;
    var ctrl = (typeof AbortController === "function") ? new AbortController() : null;
    var o = {};
    for (var k in (opts || {})) o[k] = opts[k];
    if (ctrl) o.signal = ctrl.signal;
    var p;
    try { p = Promise.resolve(G.fetch(url, o)); } catch (e) { p = Promise.reject(e); }
    if (!ctrl) return p;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        try { ctrl.abort(); } catch (e) {}
        reject(new Error("语义解读接口超时（" + Math.round(timeoutMs / 1000) + " 秒无响应）"));
      }, timeoutMs);
      p.then(function (r) { clearTimeout(timer); resolve(r); },
             function (e) { clearTimeout(timer); reject(e); });
    });
  }

  /** 大模型解读是否开启（默认开：用户明确要双重解读；可一键关回纯本地省钱） */
  function llmEnabled() {
    try { var v = G.localStorage && G.localStorage.getItem(LLM_ON_KEY); return v == null ? true : v !== "0" && v !== "false"; }
    catch (e) { return true; }
  }
  function setLLMEnabled(on) {
    try { if (G.localStorage) G.localStorage.setItem(LLM_ON_KEY, on ? "1" : "0"); } catch (e) {}
    try { if (G.dispatchEvent) { var C = G.CustomEvent || G.Event; G.dispatchEvent(new C("yj:bonus-change", { bubbles: false })); } } catch (e) {}
    return !!on;
  }
  function llmStore() { return lsGet(LLM_KEY, { items: {} }); }
  function llmGet(text) {
    var st = llmStore(), k = String(hash(text));
    var it = st.items && st.items[k];
    if (!it || !it.affixes || !it.affixes.length) return null;
    if (it.at && (Date.now() - it.at) > LLM_TTL) return null;   /* 过期：重新解读 */
    return it;
  }
  function llmPut(text, affixes, model) {
    var st = llmStore(); st.items = st.items || {};
    st.items[String(hash(text))] = { affixes: affixes, at: Date.now(), model: model || "" };
    lsSet(LLM_KEY, st);
  }
  function llmClear() { lsSet(LLM_KEY, { items: {} }); llmInflight = {}; }

  /* =====================================================================
   * 一、语素词典：自然语言语义 → 属性倾向（通用语义，非专属词库）
   *   每条 {stat, weight, words}。weight 为该语素命中时的倾向权重。
   *   stat 键与 BonusEngine 一致：战斗四维/暴击/百分比 + 六维语义轴。
   * ===================================================================== */
  var SEMEMES = [
    /* 攻击 */
    { stat: "atk", weight: 1.0, words: "锋 锐 利 斩 击 破 攻 伐 刺 杀 烈 猛 刚 雄 霸 刃 戈 矛 剑 刀 拳 掌 轰 焚 雷 霆 爆 裂 摧 毁 武 勇 悍 凶 戾 狂 荡 扫 劈 刺 穿 锋芒 杀伐 攻击 锋锐 锐利 凶猛 刚猛 狂暴 烈焰 雷霆 破军 斩击 锋刃 attack sharp blade sword fury power strike assault".split(" ") },
    /* 防御 */
    { stat: "def", weight: 1.0, words: "坚 固 壁 盾 甲 御 守 镇 磐 石 钢 铁 障 护 垒 城 垣 挡 拒 抗 不坏 金刚 金汤 铁壁 铜墙 坚守 稳固 护身 护体 防御 坚壁 defense guard shield armor iron steel wall protect".split(" ") },
    /* 气血 / 生命 */
    { stat: "hp", weight: 1.0, words: "血 生 命 魄 体 健 壮 寿 愈 疗 回 复 肉 身 息 养 滋养 回春 再生 愈合 生机 充血 强体 健魄 气血 生命 体魄 health life blood vitality vigor regen heal".split(" ") },
    /* 速度 */
    { stat: "spd", weight: 1.0, words: "疾 迅 速 影 风 闪 遁 轻 灵 捷 奔 驰 飞 掠 电 踪 步 疾风 迅捷 闪电 飞遁 轻灵 迅影 疾驰 身法 speed swift haste wind quick fleet".split(" ") },
    /* 暴击 / 命中 */
    { stat: "crit", weight: 1.0, words: "会心 暴 致命 要害 准 命中 洞 穿 击中要害 暴击 会心一击 洞穿 精准 致命一击 crit critical precise deadly".split(" ") },
    /* 攻击百分比（增幅类，语意里的『大增/暴涨』倾向） */
    { stat: "atkPct", weight: 0.5, words: "增幅 暴涨 大增 提升 增强 强化 威能 威力 增幅 倍 攻击提升 empower amplify boost".split(" ") },
    /* 防御百分比 */
    { stat: "defPct", weight: 0.5, words: "减免 减伤 坚韧 硬度 抗性 护佑 庇佑 守护 减伤 防御提升 resist reduce".split(" ") },
    /* 六维语义轴 */
    { stat: "body", weight: 1.0, words: "力量 体魄 体质 气血 肉身 根骨 筋骨 蛮力 膂力 炼体 肉身 strength body constitution".split(" ") },
    { stat: "sense", weight: 1.0, words: "神识 感知 精神 灵觉 直觉 眼力 洞察 观察 感知 感知力 明察 sense spirit perception insight".split(" ") },
    { stat: "mind", weight: 1.0, words: "心性 意志 道心 坚韧 定力 心志 毅力 忍 念 心境 不动 心魔 will mind determination".split(" ") },
    { stat: "wit", weight: 1.0, words: "谋略 智计 智慧 智力 心机 谋 计 策 略 算 谋算 智谋 诡 诈 wit intellect logic scheme".split(" ") },
    { stat: "learn", weight: 1.0, words: "资质 悟性 修炼 学习 灵根 悟 学 修 法 慧 通 融 会 参悟 领悟 aptitude learn root wisdom".split(" ") },
    { stat: "luck", weight: 1.0, words: "气运 运道 幸运 机缘 福 缘 祥 瑞 天眷 天命 造化 福缘 机缘 幸运 fortune luck charm fate".split(" ") }
  ];

  /* 程度副词：强度倍率（增益放大，减益同理放大负值） */
  var DEGREE = [
    { re: /无双|绝世|至尊|顶级|终极|极致|完美|盖世|无上|巅峰|至高|supreme|max|legendary/i, mul: 2.0 },
    { re: /大|巨|强|烈|狂|超|真|极|愈|非常|super|great|ultra/i, mul: 1.5 },
    { re: /微|小|略|稍|些|semi|slight/i, mul: 0.6 }
  ];

  /* 否定 / 减益语素：命中则整体转减益（如果同一词条也有增益倾向，取净） */
  var DEBUFF_WORDS = "钝 脆 滞 耗 衰 损 弱 虚 破败 腐蚀 迟缓 呆滞 虚弱 损耗 诅咒 衰败 迟滞 脆弱 钝化 削弱 weak slow brittle decay curse drain".split(" ");

  /* 属性中文/英文别名 → 内部 stat 键（用于显式声明解析） */
  var STAT_ALIAS = {
    "攻击": "atk", "攻": "atk", "攻击力": "atk", "伤害": "atk", "atk": "atk", "attack": "atk",
    "防御": "def", "防": "def", "防御力": "def", "护甲": "def", "def": "def", "defense": "def",
    "气血": "hp", "生命": "hp", "血量": "hp", "体魄": "body", "hp": "hp", "health": "hp", "life": "hp",
    "速度": "spd", "速": "spd", "身法": "spd", "spd": "spd", "speed": "spd",
    "暴击": "crit", "暴击率": "crit", "命中": "crit", "crit": "crit", "critical": "crit",
    "攻击%": "atkPct", "攻击百分比": "atkPct", "atkpct": "atkPct",
    "防御%": "defPct", "防御百分比": "defPct", "减伤": "defPct", "defpct": "defPct",
    "力量": "body", "肉身": "body", "体魄值": "body", "body": "body",
    "神识": "sense", "感知": "sense", "sense": "sense",
    "道心": "mind", "心志": "mind", "意志": "mind", "mind": "mind",
    "谋略": "wit", "智计": "wit", "wit": "wit",
    "悟性": "learn", "修学": "learn", "learn": "learn",
    "气运": "luck", "机缘": "luck", "luck": "luck", "fortune": "luck"
  };
  var STAT_LABEL = {
    hp: "气血", atk: "攻击", def: "防御", spd: "速度", crit: "暴击", atkPct: "攻击%", defPct: "防御%",
    body: "肉身", sense: "感知", mind: "心志", wit: "谋算", learn: "修学", luck: "机缘"
  };
  /* 语意推断的取值区间（与既有加成引擎口径一致；显式声明不受此限） */
  var BASE_RANGE = {
    hp: [6, 15], atk: [2, 5], def: [2, 5], spd: [2, 5], crit: [3, 8],
    atkPct: [5, 12], defPct: [5, 12],
    body: [1, 3], sense: [1, 3], mind: [1, 3], wit: [1, 3], learn: [1, 3], luck: [1, 3]
  };

  /* =====================================================================
   * 二、显式声明解析：玩家特殊说明优先
   *   支持：+9攻击 / 防御-3 / 暴击+5% / 攻击力 12 / atk -2 / 速度+3 防御+2
   *   返回 {found:bool, parts:[{stat,value}]}
   * ===================================================================== */
  function parseExplicit(text) {
    var s = String(text == null ? "" : text);
    var low = s.toLowerCase();
    /* 别名按长度降序，避免「攻」抢在「攻击」前命中；占位互斥防止子串重复 */
    var keys = Object.keys(STAT_ALIAS).sort(function (a, b) { return b.length - a.length; });
    var hits = [], occupied = [];
    keys.forEach(function (k) {
      var lk = k.toLowerCase(), from = 0, idx;
      while ((idx = low.indexOf(lk, from)) >= 0) {
        var st = idx, en = idx + lk.length, overlap = false;
        for (var o = 0; o < occupied.length; o++) {
          if (st < occupied[o][1] && en > occupied[o][0]) { overlap = true; break; }
        }
        if (!overlap) { hits.push({ start: st, end: en, stat: STAT_ALIAS[k] }); occupied.push([st, en]); }
        from = idx + lk.length;
      }
    });
    hits.sort(function (a, b) { return a.start - b.start; });
    var parts = [];
    hits.forEach(function (h) {
      var num = null, unit = "";
      /* 属性名在前：攻击+12 / 防御-3 / 暴击+5% */
      var after = /^\s*([+\-＋－]?\d+(?:\.\d+)?)\s*(%|％)?/.exec(s.slice(h.end));
      if (after) { num = after[1]; unit = after[2] || ""; }
      else {
        /* 数值在前：+9攻击 / 12 攻击力 */
        var before = /([+\-＋－]?\d+(?:\.\d+)?)\s*(%|％)?\s*$/.exec(s.slice(0, h.start));
        if (before) { num = before[1]; unit = before[2] || ""; }
      }
      if (num == null) return;
      var value = Number(String(num).replace(/＋/, "+").replace(/－/, "-"));
      if (!isFinite(value)) return;
      var stat = h.stat;
      if (unit && stat === "atk") stat = "atkPct";
      if (unit && stat === "def") stat = "defPct";
      parts.push({ stat: stat, value: value });
    });
    return { found: parts.length > 0, parts: parts };
  }

  /* =====================================================================
   * 三、语意解读：任意文本 → 词条加成
   *   @param text 词条文本（装备名/称号名/随行特性/玩家自定义）
   *   @param seed 可选种子（保证同输入同结果；不传则用文本 hash）
   *   @returns [{id,name,stat,value,tone,desc,text,source,confidence}]
   * ===================================================================== */
  function interpret(text, seed) {
    var s = String(text == null ? "" : text).trim();
    if (!s) return [];
    var baseSeed = (seed != null ? Number(seed) : 0) || 0;
    var rnd = prng(hash(s + "|" + baseSeed));

    /* ① 显式声明优先 */
    var ex = parseExplicit(s);
    if (ex.found) {
      return ex.parts.map(function (p, i) {
        return {
          id: "explicit_" + p.stat + "_" + i,
          name: s.slice(0, 12),
          stat: p.stat,
          value: p.value,
          tone: p.value >= 0 ? "buff" : "debuff",
          desc: "玩家显式声明",
          text: s.slice(0, 12) + " " + (p.value > 0 ? "+" : "") + p.value + " " + (STAT_LABEL[p.stat] || p.stat),
          source: "explicit",
          confidence: 1
        };
      }).filter(function (a) { return a.value !== 0; });
    }

    /* ①-b 大模型解读缓存优先（双重解读）：同一文本若已被大模型解读过且缓存有效，
       直接采用大模型结果，本地语素仅作降级保底。source 标记 llm 供 UI 展示来源。
       注意：显式声明(①) 优先级仍高于大模型——上面的 return 已保证。 */
    var cached = llmEnabled() ? llmGet(s) : null;
    if (cached) {
      return cached.affixes.map(function (a, i) {
        return {
          id: "llm_" + String(hash(s) % 100000) + "_" + i,
          name: a.name || s.slice(0, 12),
          stat: a.stat, value: Number(a.value),
          tone: Number(a.value) < 0 ? "debuff" : "buff",
          desc: a.desc || "大模型语意解读",
          text: a.text || (s.slice(0, 12) + " " + (Number(a.value) > 0 ? "+" : "") + a.value + " " + (STAT_LABEL[a.stat] || a.stat)),
          source: "llm",
          confidence: 1,
          by: cached.model || "大模型"
        };
      }).filter(function (a) { return a.stat && isFinite(a.value) && a.value !== 0; });
    }

    /* ② 语素命中：统计各属性倾向权重 */
    var low = s.toLowerCase();
    var scores = {};
    SEMEMES.forEach(function (grp) {
      var hit = 0;
      for (var i = 0; i < grp.words.length; i++) {
        var w = grp.words[i];
        if (!w) continue;
        if (low.indexOf(String(w).toLowerCase()) >= 0) hit++;
      }
      if (hit > 0) scores[grp.stat] = (scores[grp.stat] || 0) + grp.weight * Math.min(hit, 3);
    });

    /* ③ 程度副词倍率 */
    var mul = 1.0;
    for (var d = 0; d < DEGREE.length; d++) {
      if (DEGREE[d].re.test(s)) { mul = DEGREE[d].mul; break; }
    }
    /* ④ 减益判定 */
    var neg = false;
    for (var b = 0; b < DEBUFF_WORDS.length; b++) {
      if (low.indexOf(DEBUFF_WORDS[b].toLowerCase()) >= 0) { neg = true; break; }
    }

    /* ⑤ 无语素命中 → 涌现式弱词条（世界奇妙，什么都可能发生）：
       给一个随机的微弱倾向，保证任何自定义文本都有意义，但不喧宾夺主 */
    var stats = Object.keys(scores);
    if (!stats.length) {
      var all = ["atk", "def", "hp", "spd", "crit", "body", "sense", "mind", "wit", "learn", "luck"];
      var picked = pick(rnd, all);
      scores[picked] = 0.4; /* 弱倾向 */
      stats = [picked];
    }

    /* ⑥ 取权重最高的 1-2 个属性，生成词条 */
    stats.sort(function (a, b) { return scores[b] - scores[a]; });
    var top = stats.slice(0, stats.length > 1 && scores[stats[1]] >= scores[stats[0]] * 0.6 ? 2 : 1);
    var out = [];
    top.forEach(function (stat, i) {
      var range = BASE_RANGE[stat] || [1, 3];
      var span = range[1] - range[0];
      var base = range[0] + Math.floor(rnd() * (span + 1));
      var val = Math.round(base * mul * (scores[stat] > 1 ? 1.2 : 1) * 10) / 10;
      if (neg) val = -Math.abs(val);
      if (val === 0) val = 1;
      out.push({
        id: "sem_" + stat + "_" + (hash(s) % 100000) + "_" + i,
        name: s.slice(0, 12),
        stat: stat,
        value: val,
        tone: val < 0 ? "debuff" : "buff",
        desc: neg ? "语意：削弱" : "语意解读",
        text: s.slice(0, 12) + " " + (val > 0 ? "+" : "") + val + " " + (STAT_LABEL[stat] || stat),
        source: "semantic",
        confidence: Math.min(1, scores[stat] / 2)
      });
    });
    return out;
  }

  /* =====================================================================
   * 四、动态生成：情境种子 → 词条名 → 语意解读
   *   意象素材 × 倾向素材 组合，海量组合 + 情境权重 + 涌现通道。
   *   ctx: { genre, round, diceSeed, inBattle, nature, ownerName, ... }
   * ===================================================================== */
  var IMAGERY = "烈焰 寒霜 雷鸣 疾风 磐石 金刚 幽冥 星辉 赤血 玄铁 青木 沧浪 炽阳 太阴 天罡 地煞 苍雷 碧落 黄泉 紫电 银月 暗影 烈阳 玄冰".split(" ");
  var TENDENCY = "锋 壁 魄 影 心 谋 悟 缘 击 守 愈 闪 锐 甲 疾 识 定 运 芒 骨".split(" ");
  var RARE_TENDENCY = ["无双", "绝世", "至尊", "不坏", "罗刹", "修罗", "天罚", "湮灭"]; /* 涌现：极端情境 */

  function contextOf(opts) {
    var o = opts || {};
    var v = {};
    try { v = (G.storyFramework && G.storyFramework.storyState && G.storyFramework.storyState.variables) || {}; } catch (e) {}
    return {
      genre: o.genre || v.genre || (function () { try { return new URLSearchParams(G.location && G.location.search).get("genre") || "free"; } catch (e) { return "free"; } })(),
      round: o.round != null ? o.round : (Number(v.chapter) || 0),
      diceSeed: o.diceSeed != null ? o.diceSeed : 0,
      inBattle: !!o.inBattle,
      nature: o.nature || "",
      ownerName: o.ownerName || "",
      salt: o.salt || ""
    };
  }

  function seedOf(ctx, key) {
    var s = [ctx.genre, ctx.round, ctx.diceSeed, ctx.inBattle ? "battle" : "calm", ctx.nature, ctx.ownerName, key, ctx.salt].join("|");
    return hash(s);
  }

  /**
   * 动态生成词条（不写盘，纯函数）。
   * @param ctx 情境（contextOf 产出或自定义）
   * @param count 生成条数
   * @param key 目标标识（装备名/称号/随行id），参与种子
   */
  function generate(ctx, count, key) {
    ctx = ctx && ctx.genre != null ? ctx : contextOf(ctx);
    count = clamp(count, 1, 4);
    var rnd = prng(seedOf(ctx, key || ""));
    var out = [];
    for (var i = 0; i < count; i++) {
      var img = pick(rnd, IMAGERY);
      var end = pick(rnd, TENDENCY);
      /* 涌现通道：战斗/极端骰子种子下有几率出稀有词条 */
      var extreme = ctx.inBattle || (Math.abs(Number(ctx.diceSeed) || 0) % 13 === 0);
      var name;
      if (extreme && rnd() < 0.22) {
        name = pick(rnd, RARE_TENDENCY) + "·" + img + end;
      } else {
        name = img + end;
      }
      var afs = interpret(name, seedOf(ctx, (key || "") + "#" + i));
      if (afs.length) out.push(afs[0]);
    }
    /* 去重（同名不同属性保留属性不同的） */
    var seen = {};
    out = out.filter(function (a) {
      var k = a.name + "|" + a.stat;
      if (seen[k]) return false; seen[k] = 1; return true;
    });
    return out;
  }

  /* =====================================================================
   * 五、玩家自定义库（任意目标 → 词条文本）：持久化、优先于自动生成
   *   目标 key 约定：装备名用 "gear:"+名字，称号用 "title:"+名字，
   *   随行用 "beast:"+id。任意字符串均可，彼此隔离。
   * ===================================================================== */
  function customStore() { return lsGet("yunjingSemanticCustom~" + slot(), {}); }
  function setCustom(target, text) {
    var o = customStore(); o[String(target)] = String(text == null ? "" : text);
    lsSet("yunjingSemanticCustom~" + slot(), o);
    try { if (G.dispatchEvent) { var Ctor = G.CustomEvent || G.Event; G.dispatchEvent(new Ctor("yj:bonus-change", { bubbles: false })); } } catch (e) {}
    return o[String(target)];
  }
  function clearCustom(target) {
    var o = customStore(); delete o[String(target)];
    lsSet("yunjingSemanticCustom~" + slot(), o);
    try { if (G.dispatchEvent) { var Ctor = G.CustomEvent || G.Event; G.dispatchEvent(new Ctor("yj:bonus-change", { bubbles: false })); } } catch (e) {}
  }
  function getCustomText(target) { return customStore()[String(target)] || ""; }
  /** 取某目标的自定义词条（已解读）；无自定义返回 [] */
  function customAffixes(target, seed) {
    var t = getCustomText(target);
    if (!t) return [];
    /* 玩家可写多行，每行一条词条 */
    return String(t).split(/[；;\n、]+/).map(function (x) { return x.trim(); }).filter(Boolean)
      .reduce(function (acc, line) { return acc.concat(interpret(line, seed)); }, [])
      .map(function (a) { a.source = "custom"; return a; });
  }

  /* =====================================================================
   * 六、统一入口 resolve(target, opts)：
   *   玩家自定义（含显式声明）优先 → 否则情境动态生成。
   *   所有加成系统（装备/称号/随行）统一调用本入口，保证口径一致。
   *   opts: { name, genre, round, diceSeed, inBattle, nature, count, seed }
   * ===================================================================== */
  function resolve(target, opts) {
    opts = opts || {};
    var custom = customAffixes(target, opts.seed);
    if (custom.length) return custom;
    var ctx = {
      genre: opts.genre, round: opts.round, diceSeed: opts.diceSeed,
      inBattle: opts.inBattle, nature: opts.nature || opts.name || "",
      ownerName: opts.name || "", salt: opts.salt || ""
    };
    return generate(ctx, opts.count || 2, target);
  }

  /* =====================================================================
   * 七、大模型异步解读（第二重）v5.1.0
   *   把一组词条文本交给大模型做深度语意解读，结果写入缓存；下次 interpret()
   *   命中缓存即采用大模型结果。全程走已治理通道，零网络/未配置时静默降级。
   *   @param texts string[] 待解读文本
   *   @param opts  { force:bool } 忽略缓存强制重解（默认跳过已缓存文本）
   *   @returns Promise<{done, cached, failed, source}> 统计
   * ===================================================================== */
  function apiConfig() {
    try { return (G.storyFramework && G.storyFramework.apiConfig) || null; } catch (e) { return null; }
  }
  /** 把大模型回复解析为 affixes 数组：容错 JSON（fenced / 裸数组 / 含前后文字） */
  function parseLLMResult(reply) {
    var s = String(reply == null ? "" : reply).trim();
    if (!s) return [];
    /* 去掉 ```json ... ``` 围栏 */
    var f = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
    if (f) s = f[1].trim();
    /* 截取第一个 [ 到最后一个 ] */
    var a = s.indexOf("["), b = s.lastIndexOf("]");
    if (a < 0 || b <= a) return [];
    var arr;
    try { arr = JSON.parse(s.slice(a, b + 1)); } catch (e) { return []; }
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (item) {
      if (!item) return;
      /* 兼容两种返回：{text,items:[{stat,value}]} 或 直接 [{stat,value}] */
      var list = Array.isArray(item.items) ? item.items : [item];
      var owner = item.text || item.name || "";
      list.forEach(function (x) {
        if (!x) return;
        var stat = String(x.stat || "").toLowerCase();
        if (!(stat in STAT_LABEL)) return;            /* 只收内部认可的 stat 键 */
        var val = Number(x.value);
        if (!isFinite(val) || val === 0) return;
        val = clamp(val, -50, 50);                    /* 数值钳制，防大模型乱写 */
        out.push({ stat: stat, value: val, name: String(owner).slice(0, 12),
          desc: String(x.desc || x.why || "大模型语意解读").slice(0, 40),
          text: x.text || (String(owner).slice(0, 12) + " " + (val > 0 ? "+" : "") + val + " " + STAT_LABEL[stat]) });
      });
    });
    return out;
  }
  /** 构造极简 system prompt：只解读语意、只输出 JSON，不背故事协议（省 token） */
  function llmPrompt(texts) {
    var labels = Object.keys(STAT_LABEL).map(function (k) { return k + "(" + STAT_LABEL[k] + ")"; }).join("、");
    return "你是游戏词条的语意解读器。把每个词条文本按字面与引申含义解读为属性加成。\n"
      + "可选属性键：" + labels + "。\n"
      + "数值口径：普通 +1~5，较强 +6~12，极强 +13~25；减益用负数。每条文本给 1~2 个最贴切的属性。\n"
      + "只输出 JSON 数组，不要任何解释文字。格式：\n"
      + '[{"text":"原文","items":[{"stat":"atk","value":4,"desc":"锋=锐利进攻"}]}]';
  }

  async function enrich(texts, opts) {
    opts = opts || {};
    var result = { done: 0, cached: 0, failed: 0, source: "local" };
    if (!llmEnabled()) { result.source = "off"; return result; }
    var cfg = apiConfig();
    if (!cfg || !cfg.endpoint || !cfg.apiKey || !cfg.model) { result.source = "unconfigured"; return result; }
    if (typeof G.fetch !== "function") { result.source = "no-fetch"; return result; }  /* Node 沙箱无 fetch → 纯本地 */

    var uniq = [], seen = {};
    (Array.isArray(texts) ? texts : [texts]).forEach(function (t) {
      t = String(t == null ? "" : t).trim();
      if (!t || seen[t]) return; seen[t] = 1;
      uniq.push(t);
    });
    /* 跳过显式声明（玩家特殊说明已由本地精确解析，无需大模型）与有效缓存 */
    var todo = uniq.filter(function (t) {
      if (parseExplicit(t).found) { result.cached++; return false; }
      if (!opts.force && llmInflight[t]) { result.cached++; return false; }
      if (!opts.force && llmGet(t)) { result.cached++; return false; }
      return true;
    }).slice(0, LLM_BATCH_MAX);
    if (!todo.length) return result;

    todo.forEach(function (t) { llmInflight[t] = 1; });
    var messages = [
      { role: "system", content: llmPrompt(todo) },
      { role: "user", content: JSON.stringify(todo) }
    ];
    try { if (G.TokenUsage && G.TokenUsage.recordRequest) G.TokenUsage.recordRequest(messages, "语义解读"); } catch (e) {}

    var reply = "";
    try {
      var isGemini = cfg.type === "gemini";
      var reqUrl, reqBody;
      if (isGemini) {
        reqUrl = String(cfg.endpoint).replace(/\/+$/, "") + "/models/" + cfg.model + ":generateContent?key=" + cfg.apiKey;
        var contents = todo.map(function (t) { return { role: "user", parts: [{ text: t }] }; });
        contents.unshift({ role: "user", parts: [{ text: llmPrompt(todo) }] });
        reqBody = { contents: contents, generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } };
      } else {
        reqUrl = String(cfg.endpoint).replace(/\/+$/, "") + "/chat/completions";
        reqBody = { model: cfg.model, temperature: 0.2, max_tokens: 1024, messages: messages };
      }
      var reqOpts = { method: "POST", headers: { "Content-Type": "application/json" } };
      if (!isGemini) reqOpts.headers.Authorization = "Bearer " + cfg.apiKey;
      reqOpts.body = JSON.stringify(reqBody);
      var resp;
      /* v5.1.1 修 P1：语义解读的大模型请求过去是裸 fetch —— 接口挂死则
         await 永不返回，调用方（bonus-engine 的 enrich 链）整条挂起。
         现在统一走带超时的封装：有全局 fetchWithTimeout 就用它（自带
         AbortController + MoNetGuard 重试），否则用本地 timedFetch 兜底。 */
      if (typeof G.fetchWithTimeout === "function") {
        resp = await G.fetchWithTimeout(reqUrl, reqOpts, LLM_TIMEOUT_MS, { label: "语义解读", throttleKey: "语义解读", silent: true });
      } else if (G.MoNetGuard && G.MoNetGuard.fetchWithRetry) {
        resp = await G.MoNetGuard.fetchWithRetry(function () { return timedFetch(reqUrl, reqOpts, LLM_TIMEOUT_MS); },
          { label: "语义解读", throttleKey: "语义解读", silent: true });
      } else {
        resp = await timedFetch(reqUrl, reqOpts, LLM_TIMEOUT_MS);
      }
      var data = await resp.json();
      if (isGemini) {
        var cand = data && data.candidates && data.candidates[0];
        reply = cand && cand.content && cand.content.parts && cand.content.parts.map(function (p) { return p.text || ""; }).join("") || "";
      } else {
        reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "";
      }
      try { if (G.TokenUsage && G.TokenUsage.recordOutput) G.TokenUsage.recordOutput(reply, "语义解读"); } catch (e) {}

      var parsed = parseLLMResult(reply);
      /* 按 text 回填缓存：大模型可能漏条，未解读到的文本本次不写缓存（下次可重试） */
      var byText = {};
      parsed.forEach(function (af) {
        var owner = af.name || "";
        (byText[owner] = byText[owner] || []).push({ stat: af.stat, value: af.value, name: owner, desc: af.desc, text: af.text });
      });
      todo.forEach(function (t) {
        delete llmInflight[t];
        var hit = byText[t] || [];
        /* 兜底：若大模型没按 text 分组返回，但只解读了一条且总数与待办一致，按顺序认领 */
        if (!hit.length && todo.length === 1 && parsed.length) hit = parsed;
        if (hit.length) { llmPut(t, hit, cfg.model); result.done++; }
        else result.failed++;
      });
      if (result.done) {
        result.source = "llm";
        /* 通知加成引擎重算：面板/战斗/prompt 下次取数即命中新缓存 */
        try { if (G.dispatchEvent) { var C = G.CustomEvent || G.Event; G.dispatchEvent(new C("yj:bonus-change", { bubbles: false })); } } catch (e) {}
      }
    } catch (e) {
      todo.forEach(function (t) { delete llmInflight[t]; });
      result.failed = todo.length; result.source = "error";
    }
    return result;
  }

  function stats() {
    var st = llmStore();
    return { VERSION: VERSION, sememes: SEMEMES.length, degree: DEGREE.length,
      customTargets: Object.keys(customStore()).length,
      imagery: IMAGERY.length, tendency: TENDENCY.length,
      llm: { enabled: llmEnabled(), cached: Object.keys(st.items || {}).length, inflight: Object.keys(llmInflight).length } };
  }

  var API = {
    VERSION: VERSION,
    /* 语意解读 */
    interpret: interpret,
    parseExplicit: parseExplicit,
    /* 动态生成 */
    generate: generate,
    contextOf: contextOf,
    seedOf: seedOf,
    prng: prng,
    /* 自定义 */
    setCustom: setCustom,
    clearCustom: clearCustom,
    getCustomText: getCustomText,
    customAffixes: customAffixes,
    /* 统一入口 */
    resolve: resolve,
    /* 大模型双重解读（v5.1.0） */
    enrich: enrich,
    parseLLMResult: parseLLMResult,
    llmEnabled: llmEnabled,
    setLLMEnabled: setLLMEnabled,
    llmGet: llmGet,
    llmClear: llmClear,
    /* 元信息 */
    SEMEMES: SEMEMES,
    STAT_LABEL: STAT_LABEL,
    BASE_RANGE: BASE_RANGE,
    stats: stats
  };
  G.SemanticEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
