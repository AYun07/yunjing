/* v4.09.0 · 数值真值白名单清洗
 * 玩家看到的正文里不允许出现引擎真值之外的经济 / 面板数值。
 * 小模型（agnes-3.0-flash）偶发把 UI 结算数字编进叙事（「HP 346/470」
 * 「总金币 99」「经验 +10000」「木剑才卖 5 金币」「目前 1/1」），
 * 提示词压制与 UI 块剥离都挡不住零散的句式变体，这里做确定性兜底。
 *
 * 口径：面板字段式片段一律剥离（本来就不该进正文）；货币 / 资源数量与
 * 进度对按 TruthSnapshot 真值白名单判定，非法者改写为模糊表述。
 * 合法数值来自当前快照 + 跨轮次历史，避免误伤真实结算数字。
 * 中文数字（「三十金币」「三日后」）不在受管范围，零误伤。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NumberScrubber = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* id / 标题 / 地名里的数字不是数值真值，不进白名单 */
  var SKIP_KEYS = /^(?:id|title|name|place|v|version|genre|slot)$/i;

  function collect(obj, acc, depth) {
    if (obj == null || depth > 6) return;
    if (typeof obj === "number") {
      if (isFinite(obj)) acc[String(obj)] = 1;
      return;
    }
    if (typeof obj === "string") {
      var m = obj.match(/\d{1,7}/g);
      if (m) for (var i = 0; i < m.length; i++) acc[String(Number(m[i]))] = 1;
      return;
    }
    if (Array.isArray(obj)) {
      for (var j = 0; j < obj.length; j++) collect(obj[j], acc, depth + 1);
      return;
    }
    if (typeof obj === "object") {
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k) || SKIP_KEYS.test(k)) continue;
        collect(obj[k], acc, depth + 1);
      }
    }
  }

  /* 合法数值集合：当前引擎数值 ∪ 结算流水 ∪ 委托报酬 ∪ 跨轮次历史 */
  function legalNumbers(snap, turns) {
    var acc = {};
    collect(snap && snap.nums ? snap.nums : null, acc, 0);
    var flat = snap && snap.flat;
    if (flat) {
      for (var k in flat) {
        if (k.charAt(0) === "$") collect(flat[k], acc, 0);
      }
    }
    if (turns && turns.length) {
      for (var i = 0; i < turns.length; i++) {
        collect(turns[i] && turns[i].nums, acc, 0);
        collect(turns[i] && turns[i].claims, acc, 0);
      }
    }
    return acc;
  }

  /* 金币真值子集：只认余额 / 流水 / 报酬 / 历史余额。
     不能把 nums 里所有数字都当合法——points:5、round:5、hp:5 会让
     编造的「木剑才卖 5 金币」蒙混过关（真实快照探针实测到的漏洞）。 */
  var MONEY_CTX = /(?:金币|赏钱|报酬|余额|入账)[^\d]{0,6}(\d{1,7})|(\d{1,7})\s*(?:枚|个|两)?\s*金币/g;
  function moneyFromText(s, acc) {
    var re = new RegExp(MONEY_CTX.source, "g"), m;
    while ((m = re.exec(String(s)))) {
      var v = m[1] || m[2];
      if (v) acc[String(Number(v))] = 1;
    }
  }
  function legalMoney(snap, turns) {
    var acc = {}, n = (snap && snap.nums) || {};
    if (typeof n.gold === "number") acc[String(n.gold)] = 1;
    collect(n.goldTrail, acc, 0);
    (Array.isArray(n.actLog) ? n.actLog : [n.actLog]).forEach(function (s) {
      if (typeof s === "string" && /金币|赏钱|报酬|余额|入账/.test(s)) moneyFromText(s, acc);
    });
    ["quests", "activeQuests", "questOffers"].forEach(function (k) {
      (n[k] || []).forEach(function (q) {
        if (q && typeof q.gold === "number") acc[String(q.gold)] = 1;
      });
    });
    var flat = snap && snap.flat;
    if (flat) for (var f in flat) if (/^\$gold/i.test(f)) collect(flat[f], acc, 0);
    if (turns && turns.length) turns.forEach(function (t) {
      if (t && t.nums) {
        if (typeof t.nums.gold === "number") acc[String(t.nums.gold)] = 1;
        collect(t.nums.goldTrail, acc, 0);
      }
      if (t && t.claims) collect(t.claims.gold, acc, 0);
    });
    return acc;
  }

  /* 合法进度对：委托 cur/need、经验条、血条、蓝条、世界阶段 */
  function legalPairs(snap) {
    var out = {}, n = (snap && snap.nums) || {};
    function pair(a, b) {
      if (typeof a === "number" && typeof b === "number") out[a + "/" + b] = 1;
    }
    ["quests", "activeQuests", "questOffers"].forEach(function (key) {
      (n[key] || []).forEach(function (q) { pair(q.cur, q.need); });
    });
    if (n.stage) pair(n.stage.current, n.stage.total);
    var d = n.derived || {};
    if (typeof n.hp === "number") pair(n.hp, d.maxHp);
    if (typeof n.mp === "number") pair(n.mp, d.maxMp);
    if (typeof n.exp === "number") pair(n.exp, d.expNext);
    return out;
  }

  /* A 类：面板字段片段。结算信息由 UI 卡片呈现，不该出现在小说正文里。
     连前导连接标点一起吃，避免删完留下「，。」。 */
  var PANEL_FRAG = /(?:[，,、；;]\s*)?(?:HP|MP|hp|mp|怒气|气力|体力|血条|蓝条|血量|法力|总金币|金币剩余|当前总金币|当前金币|余额|背包格数|格数)\s*[：:]?\s*[+＋]?\s*\d{1,7}(?:\s*[／/]\s*\d{1,7})?/gi;

  /* B 类：结算增量。数字无论真假都不该写进正文，改成中性叙述。 */
  var GAIN_WORD = {
    "经验": "经验略有增长", "声望": "声名渐起", "金币": "得了些赏钱",
    "灵石": "得了些灵石", "攻击": "攻势更盛", "防御": "守势更稳",
    "伤害": "伤势加重", "体力": "体力渐复", "气血": "气血渐复",
    "怒气": "战意翻涌", "生命": "气息稍定"
  };
  var GAIN_FRAG = /(经验|声望|金币|灵石|攻击|防御|伤害|体力|气血|怒气|生命)\s*[：:]?\s*[+＋]\s*\d{1,7}/g;

  /* C 类：货币 / 资源数量。合法数字保留，非法数字模糊化。 */
  var UNIT = "金币|灵石|银币|铜钱|元宝|晶石|贡献|声望点";
  var MONEY_PRE = new RegExp("(\\d{1,7})\\s*(枚|个|颗|块|锭|点)?\\s*(" + UNIT + ")", "g");
  var MONEY_POST = new RegExp("(" + UNIT + ")\\s*[：:]?\\s*(\\d{1,7})", "g");

  /* D 类：UI 进度对（阶段 1/3 是合法真值，已在 legalPairs 里）。 */
  var PROG_FRAG = /(?:背包|格数|进度|委托进度|任务进度|目前|当前)\s*[：:]?\s*(\d{1,4})\s*[／/]\s*(\d{1,4})/g;

  function tidy(s) {
    return s.replace(/[，,]\s*([。！？；;])/g, "$1")
      .replace(/[，,]{2,}/g, "，")
      .replace(/(^|\n)\s*[，,、；;]\s*/g, "$1")
      .replace(/([一-龥])\s+(些许)/g, "$1$2")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n[ \t]+/g, "\n");
  }

  function scrub(body, snap, turns) {
    if (typeof body !== "string" || !body) return body;
    var legal = legalMoney(snap, turns);
    var pairs = legalPairs(snap);
    var hasTruth = !!(snap && snap.nums && typeof snap.nums.gold === "number");

    var s = body.replace(PANEL_FRAG, "");
    s = s.replace(GAIN_FRAG, function (m, field) { return GAIN_WORD[field] || "略有所得"; });

    /* 没有真值快照时不做数量改写，避免误伤合法数字（A/B 类仍照常剥离） */
    if (hasTruth) {
      s = s.replace(MONEY_PRE, function (m, num, q, unit) {
        return legal[String(Number(num))] ? m : "些许" + unit;
      });
      s = s.replace(MONEY_POST, function (m, unit, num) {
        return legal[String(Number(num))] ? m : unit + "些许";
      });
    }
    s = s.replace(PROG_FRAG, function (m, a, b) {
      /* 背包格数与模糊前缀的 N/M 一律是 UI 残骸：
         不能因为引擎里恰好存在同数值的合法委托进度对（如 activeQuests 1/1）
         就放行「背包 1/1」——那是小模型「换壳」绕过白名单的同型漏洞。 */
      if (/^(?:背包|格数|目前|当前)/.test(m)) return "";
      return pairs[a + "/" + b] ? m : "";
    });
    return tidy(s);
  }

  return {
    version: "4.09.0",
    legalNumbers: legalNumbers,
    legalMoney: legalMoney,
    legalPairs: legalPairs,
    scrub: scrub,
    /* 测试脚本用：便于统计各类命中 */
    patterns: { PANEL_FRAG: PANEL_FRAG, GAIN_FRAG: GAIN_FRAG, PROG_FRAG: PROG_FRAG }
  };
});
