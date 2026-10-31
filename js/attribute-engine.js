/* =========================================================================
 * 云境 · 属性引擎 AttributeEngine（v3.55.26）
 *
 * 用户诉求：「六维属性不能只是个数字——每种属性对应强项偏向，属性数值要随
 *   游玩增长，且要做好数值平衡；只要玩家没要求，不得突然冒出离谱数值」
 * 「天赋社会反响要真的实现效果，不是看说明文档」
 *
 * 真实机制（全部引擎侧强制，非仅提示词约定）：
 * 1) 资质定档 classifyAptitude：按资质名/描述关键词自动定档 顶级/稀有/中平/低劣
 *    （自定义资质交主笔首轮定档）；档位随存档持久化（v.talent）。
 * 2) 天赋状态机 absorbTalent：解析「天赋.定档 / 天赋.暴露 / 天赋.名称」——
 *    档位归一化四档；暴露单向（hidden→exposed），已暴露不可改回隐藏
 *    （暴露过的事收不回去），归一化非法档位。
 * 3) 数值平衡钳制 applyStatDelta：变量块 stats.* 增量经此落表——
 *    · 单项单轮 |Δ| ≤ 6（超过按 6 钳制：无正文依据的离谱跳变被拦截）
 *    · 单轮全部属性合计 |Δ| ≤ 10（超预算部分丢弃，按序消耗）
 *    · 值域钳制 [0, 100]；绝对值写入视为「当前值→目标值」的增量再钳制
 * 4) 强项偏向 buildLiveBlock：每轮随状态面板注入当前六维值 + 强项（前二）
 *    的行为偏向语义（按语义轴归类，世界自适应——凡人的「神识」与都市的
 *    「精神力」同走感知轴），天赋档位/暴露状态同块注入。
 * 5) 懒种子 seed：老档/新档统一在首次读取时补种（v.stats ← setup.stats，
 *    v.talent ← 定档），旧档零迁移成本。
 * ========================================================================= */
(function () {
  "use strict";

  /* ---------- 语义轴：把各世界资质键归入六大行为轴（世界自适应） ---------- */
  var AXES = [
    { id: "body", name: "肉身", bias: "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
      kw: ["力量", "体魄", "体质", "气血", "肉身", "拳", "根骨", " constitution", "strength", "body", "体"] },
    { id: "sense", name: "感知", bias: "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
      kw: ["神识", "感知", "精神", "灵觉", "直觉", "眼力", "spirit", "sense", "perception"] },
    { id: "mind", name: "心志", bias: "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
      kw: ["心性", "意志", "道心", "坚韧", "temper", "will", "毅"] },
    { id: "wit", name: "谋算", bias: "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
      kw: ["谋略", "智计", "智慧", "智力", "心机", "wit", "intellect", "logic", "谋"] },
    { id: "learn", name: "修学", bias: "修炼进度快、功法武技学得快、举一反三融会贯通",
      kw: ["资质", "悟性", "修炼", "学习", "灵根", "root", "aptitude", "learn", "悟"] },
    { id: "luck", name: "机缘", bias: "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
      kw: ["气运", "运道", "幸运", "机缘", "fortune", "luck", "魅力", "亲和", "人缘", "charm", "缘"] }
  ];
  var GENERIC_AXIS = { id: "generic", name: "专精", bias: "该维度主导的同类行动天然占优" };

  function axisOf(key, label) {
    var t = String(key || "") + " " + String(label || "");
    var tl = t.toLowerCase();
    for (var i = 0; i < AXES.length; i++) {
      var kws = AXES[i].kw;
      for (var j = 0; j < kws.length; j++) {
        if (tl.indexOf(kws[j]) >= 0) return AXES[i];
      }
    }
    return GENERIC_AXIS;
  }

  /* ---------- 资质定档（关键词启发，世界自适应由主笔校准） ---------- */
  var TIER_NAMES = ["顶级", "稀有", "中平", "低劣"];
  function classifyAptitude(setup) {
    if (!setup) return "";
    /* 自定义资质：玩家亲笔，档位交主笔首轮按世界观定档（引擎不猜） */
    if (setup.customAptitude && !setup.aptitude) return "";
    var text = String(setup.aptitude || "") + " " + String(setup.aptitudeDesc || "") + " " + String(setup.customAptitude || "");
    if (/万中无一|百年难遇|千年难遇|冠绝|绝世|无双|顶尖|顶级|惊世|震古|盖世/.test(text)) return "顶级";
    if (/平庸|杂灵根|伪灵根|几乎无望|难望|低劣|愚钝|迟钝|缓慢如|凡人之姿|最难/.test(text)) return "低劣";
    if (/上等|极佳|出众|罕见|难得|天赋异禀|万里挑一|拔尖|过人|好苗子|香饽饽|胚子/.test(text)) return "稀有";
    return "中平";
  }
  function normalizeTier(s) {
    var t = String(s || "");
    if (/顶级|绝世|万中无一|盖世|震古/.test(t)) return "顶级";
    if (/稀有|争抢/.test(t)) return "稀有";
    if (/低劣|低下|垫底|废/.test(t)) return "低劣";
    if (/中平|普通|中等|中人之资/.test(t)) return "中平";
    return TIER_NAMES.indexOf(t) >= 0 ? t : "";
  }

  /* ---------- 懒种子：老档零迁移 ---------- */
  function seed(state) {
    try {
      if (!state || !state.variables) return;
      var v = state.variables;
      var ss = state.setup && state.setup.stats;
      if ((!v.stats || typeof v.stats !== "object" || !Object.keys(v.stats).length) && ss && Object.keys(ss).length) {
        v.stats = Object.assign({}, ss);
      }
      if (!v.talent || typeof v.talent !== "object") {
        v.talent = {
          name: String((state.setup && (state.setup.aptitude || state.setup.customAptitude)) || "").slice(0, 30) || "未定",
          tier: classifyAptitude(state.setup) || "待定档",
          exposure: "hidden"
        };
      }
      if (v.talent.exposure !== "exposed") v.talent.exposure = "hidden";
    } catch (e) { /* 种子失败不阻断 */ }
  }

  /* ---------- 数值平衡钳制 ---------- */
  var TURN = { total: 0 };
  function beginTurn() { TURN.total = 0; }
  var CAP_PER_STAT = 6;    /* 单项单轮硬上限：无正文依据的跳变在此拦截 */
  var CAP_PER_TURN = 10;   /* 单轮全部属性合计上限 */

  function clampStatDelta(cur, delta) {
    var d = delta;
    var clipped = false;
    if (d > CAP_PER_STAT) { d = CAP_PER_STAT; clipped = true; }
    if (d < -CAP_PER_STAT) { d = -CAP_PER_STAT; clipped = true; }
    var remain = CAP_PER_TURN - TURN.total;
    if (Math.abs(d) > Math.abs(remain)) { d = remain >= 0 ? Math.min(d, remain) : Math.max(d, remain); clipped = true; }
    if (d !== 0) TURN.total += Math.abs(d);
    var val = Math.max(0, Math.min(100, Math.round(((typeof cur === "number" ? cur : 0) + d) * 100) / 100));
    return { val: val, clipped: clipped, delta: d };
  }

  /** 变量块 stats.* 落表入口：rawValue 为 "+5"/"-3"/"42" */
  function applyStatDelta(target, key, rawValue) {
    try {
      var s = String(rawValue).trim();
      var cur = typeof target[key] === "number" ? target[key] : 0;
      var m = s.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
      var delta = m ? parseFloat(m[2]) * (m[1] === "-" ? -1 : 1)
        : (/^\d+(?:\.\d+)?$/.test(s) ? (parseFloat(s) - cur) : 0);
      if (!isFinite(delta)) return;
      var r = clampStatDelta(cur, delta);
      target[key] = r.val;
      if (r.clipped && window.YJ_DEBUG) console.log("[AttributeEngine] 数值平衡钳制:", key, "请求Δ" + delta, "→ 实际Δ" + r.delta);
    } catch (e) { /* 钳制失败退回直写由调用方处理 */ }
  }

  /* ---------- 天赋状态机 ---------- */
  function absorbTalent(vars, field, rawValue) {
    try {
      var v = vars;
      v.talent = v.talent && typeof v.talent === "object" ? v.talent : {};
      var val = String(rawValue == null ? "" : rawValue).trim();
      if (!val) return;
      if (/定档|档位|等级|评级/.test(field)) {
        var t = normalizeTier(val);
        if (t) v.talent.tier = t;
        else v.talent.tierRaw = val.slice(0, 20); /* 主笔自定义档位描述保真保留 */
      } else if (/暴露|曝光|公开|传开|reveal/.test(field)) {
        if (/已?暴露|公开|传开|人尽皆知|reveal/.test(val)) {
          if (v.talent.exposure !== "exposed") v.talent.exposedAt = Number(vars.chapter) || undefined;
          v.talent.exposure = "exposed"; /* 单向：暴露过就收不回 */
        }
        /* 请求改回「隐藏」：忽略（状态机拒绝），暴露状态不变 */
      } else if (/名称|名字|talent/.test(field)) {
        v.talent.name = val.slice(0, 30);
      }
    } catch (e) { /* 不阻断 */ }
  }

  /* ---------- 每轮注入：当前值 + 强项偏向 + 天赋状态 + 增长纪律 ---------- */
  function buildLiveBlock(fw) {
    try {
      fw = fw || window.storyFramework;
      if (!fw || !fw.storyState || !fw.storyState.variables) return "";
      if (fw.config && fw.config.mode !== "roleplay") return ""; /* 创作模式六维是文风权重，不适用 */
      var state = fw.storyState;
      seed(state);
      var v = state.variables;
      var cfg = fw.config || {};
      var labelMap = {};
      (cfg.statKeys || []).forEach(function (s) { if (s && s.key) labelMap[s.key] = s.label; });
      var stats = v.stats && typeof v.stats === "object" ? v.stats : {};
      var keys = Object.keys(stats).filter(function (k) { return typeof stats[k] === "number"; });
      if (!keys.length) return "";
      var vals = keys.map(function (k) { return { k: k, label: labelMap[k] || k, v: stats[k] }; });
      var line1 = "属性：" + vals.map(function (x) { return x.label + " " + x.v; }).join(" / ");
      /* 强项 = 值最高的前二（并列取靠前） */
      var sorted = vals.slice().sort(function (a, b) { return b.v - a.v; });
      var top = sorted.slice(0, 2).filter(function (x) { return x.v >= 55; });
      var lines = [line1];
      if (top.length) {
        var seenAxis = {};
        var biases = [];
        top.forEach(function (x) {
          var ax = axisOf(x.k, x.label);
          if (seenAxis[ax.id]) return;
          seenAxis[ax.id] = 1;
          biases.push("「" + x.label + "」（" + ax.name + "轴）——" + ax.bias);
        });
        if (biases.length) lines.push("强项偏向（强项场景行文天然占优、他人据此另眼相待；弱项场景可受阻）：\n· " + biases.join("\n· "));
      }
      var t = v.talent || {};
      var tierDesc = { "顶级": "顶级·万中无一（顶尖势力会为之惊动）", "稀有": "稀有·强宗名门争抢", "中平": "中平", "低劣": "低劣·被倨傲者轻视（温和者不以天赋取人）" };
      var tline = "天赋：" + (t.name || "未定") + " · 定档「" + (tierDesc[t.tier] ? t.tier + "——" + tierDesc[t.tier] : (t.tier || "待定档")) + "」· " + (t.exposure === "exposed" ? "已暴露（社会反响按档位发酵、口耳相传）" : "隐藏中（知情者仅限剧情已揭示者，不得未卜先知）");
      lines.push(tline);
      lines.push("属性增长纪律（引擎强制钳制，越界部分会被截掉）：每轮全部属性增减合计≤10、单项≤6；常规修炼每轮 0-2 点；突破/丹药/机缘单项≤6 且正文须有明确缘由；值域 0-100；无正文依据的跳变一律无效。");
      return lines.join("\n");
    } catch (e) {
      return "";
    }
  }

  function stats() {
    return { turnTotal: TURN.total, capPerStat: CAP_PER_STAT, capPerTurn: CAP_PER_TURN };
  }

  window.AttributeEngine = {
    classifyAptitude: classifyAptitude,
    normalizeTier: normalizeTier,
    seed: seed,
    beginTurn: beginTurn,
    applyStatDelta: applyStatDelta,
    absorbTalent: absorbTalent,
    buildLiveBlock: buildLiveBlock,
    axisOf: axisOf,
    stats: stats,
    TIER_NAMES: TIER_NAMES
  };
})();
