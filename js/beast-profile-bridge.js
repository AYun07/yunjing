/* =========================================================================
 * 云境 · 随行存在专属档案桥接层 BeastProfileBridge（v4.49.0）
 * -------------------------------------------------------------------------
 * 把 beast-system.js 的四类随行存在（宠物/灵兽/妖兽/伙伴）接进云境已有的
 * 四套角色系统，让它们像真正的 NPC 一样有档案、有性格、有心理、有命运：
 *   1) NPCChronicle  —— 六项机制（四轴态度/生平/只增不删/离场自治/认知边界/驱动力节流）
 *   2) PersonalityCodex + PsycheModel —— 专属性格与七项心理档案、行为演化
 *   3) IntimacyArchive —— 亲密档案（玩家显式开启 + 系统开启；v4.49.0 起兽形/半兽形/人形三态均可，受三档尺度控制）
 *   4) 主笔 prompt —— 汇总注入，让大模型真正记得并本色演绎随行存在
 *
 * 设计红线：
 *   - 档案 id 一律 "beast:" 前缀，与普通 NPC 名册隔离，绝不串档；
 *   - 全局机制层沿用云境原创词（行者/本地人/随侍），单世界题材词不在此层出现；
 *   - 亲密默认关闭，须 beast.nsfwEligible && IntimacyArchive 已开启；三态形态不限（v4.49.0）；
 *   - 零网络调用、纯函数、延迟解析依赖，可在 Node vm 沙箱完整回归。
 * 版权：本项目独立编写，仅调用自有模块公开接口，未引用任何第三方代码。
 * ========================================================================= */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});
  var VERSION = "4.49.0";

  /* ---------- 内部工具（独立实现） ---------- */
  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) n = lo; return n < lo ? lo : (n > hi ? hi : n); }
  function hash(str) {
    var h = 2166136261;
    str = String(str == null ? "" : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }

  /* 延迟解析依赖（调用时才取，避免加载顺序耦合） */
  function NC() { return G.NPCChronicle || null; }
  function PC() { return G.PersonalityCodex || null; }
  function PM() { return G.PsycheModel || null; }
  function IA() { return G.IntimacyArchive || null; }
  function BS() { return G.BeastSystem || null; }

  /* ---------------------------------------------------------------------
   * 随行档案库：NPCChronicle 是纯函数、自身不存档，档案由调用方持有。
   * 本层按存档(slot)自建一份 profile store，落 localStorage，只增不删：
   * 放归/离队时把完整快照转入 vault，再从活动视图移除。与普通 NPC 名册隔离。
   * --------------------------------------------------------------------- */
  function slotId() {
    try { return (G.storyFramework && G.storyFramework.slotId) || "main"; } catch (e) { return "main"; }
  }
  function storeKey() { return "yunjingBeastProfiles~" + slotId(); }
  function loadStore() {
    try {
      var raw = G.localStorage && G.localStorage.getItem(storeKey());
      var d = raw ? JSON.parse(raw) : null;
      if (d && typeof d === "object") {
        if (!d.records || typeof d.records !== "object") d.records = {};
        if (!Array.isArray(d.vault)) d.vault = [];
        return d;
      }
    } catch(e){console.warn("[swallowed] beast-profile-bridge",e)}
    return { records: {}, vault: [] };
  }
  function saveStore(d) {
    try { if (G.localStorage) { G.localStorage.setItem(storeKey(), JSON.stringify(d)); return true; } }
    catch(e){console.warn("[swallowed] beast-profile-bridge",e)}
    return false;
  }
  function getProfile(id) { return loadStore().records[id] || null; }
  function putProfile(rec) {
    var d = loadStore(); d.records[rec.id] = rec; saveStore(d); return rec;
  }

  /* 化形人形称谓：按随行类型给一个确定性的身份名 */
  var FORM_TITLES = {
    spirit: "灵使", demon: "妖将", companion: "本相", pet: "灵童"
  };
  function worldOf() {
    try {
      var fw = G.storyFramework;
      var w = fw && (fw.worldKey || (fw.storyState && (fw.storyState.world || fw.storyState.worldKey)));
      return String(w || "default");
    } catch (e) { return "default"; }
  }

  /* =====================================================================
   * 一、化形判定与形态
   * ===================================================================== */

  /** 是否可化形：一部分随行存在具备人形形态，不是全部。 */
  function canTransform(b) {
    if (!b) return false;
    /* 玩家/系统显式覆盖优先（存档字段） */
    if (b.canTransform != null) return !!b.canTransform;
    var k = b.kind;
    if (k === "companion") return true;                 /* 人形伙伴，本相即人形 */
    if (k === "spirit" || k === "demon") return (Number(b.realmIdx) || 0) >= 4;  /* 灵兽/妖兽：通达位阶以上 */
    /* 寻常宠物：仅带灵异血统者（特性/种类线索）可化形 */
    return /化形|灵|仙|妖|魅|狐|猫|蛇|九尾/.test(String(b.trait || "") + String(b.species || ""));
  }

  /** v4.49.0 三态形态标签 */
  var FORM_LABEL = { beast: "本相兽形", half: "半兽形", human: "完全人形" };
  function formStateOf(b) {
    var s = b && b.formState;
    if (s === "beast" || s === "half" || s === "human") return s;
    if (b && b.kind === "companion") return "human";
    return (b && b.transformed) ? "human" : "beast";
  }

  /** 化形形态详情（确定性，同输入必得同结果）
   *  v4.49.0：三态 beast/half/human；isHumanoid 保留但语义放宽为"非纯兽形"，
   *  亲密门槛已不再依赖它（见 eligibleNSFW），仅保留字段兼容旧调用方。 */
  function transformInfo(b) {
    var can = canTransform(b);
    var title = FORM_TITLES[b && b.kind] || "化形";
    var base = String((b && b.name) || "无名").replace(/[·•].*$/, "");
    var humanName = (b && b.transformForm) || (base + "·" + title);
    var st = formStateOf(b);
    return {
      canTransform: can,
      formState: st,
      formLabel: FORM_LABEL[st],
      transformed: st === "human",     /* 兼容旧字段：仅完全人形为真 */
      isHumanoid: st !== "beast",      /* 兼容字段：半兽形/人形为真 */
      isHalfBeast: st === "half",
      isBeast: st === "beast",
      formName: humanName,
      formTitle: title,
      realmRequired: (b && (b.kind === "spirit" || b.kind === "demon")) ? 4 : 0
    };
  }

  /* =====================================================================
   * 二、专属 NPC 档案（NPCChronicle 六项机制，beast: 前缀隔离）
   * ===================================================================== */

  function profileId(b) { return "beast:" + (b && b.id ? b.id : hash(b && b.name)); }
  function tierOf(b) {
    var r = Number(b && b.realmIdx) || 0;
    if (r >= 8) return "epic";
    if (r >= 5) return "high";
    if (r >= 2) return "mid";
    return "low";
  }
  /** 四轴态度映射：把宠物的意志层（忠诚/羁绊/立场）投射到编年史四轴 */
  function dispositionOf(b) {
    var loyalty = clamp(b && b.loyalty != null ? b.loyalty : (Number(b && b.bond) || 10) + 25, 0, 100);
    var bond = clamp(b && b.bond != null ? b.bond : 10, 0, 100);
    var stance = String((b && b.stance) || "忠诚");
    var guard = /桀骜|动摇|背弃|戒备/.test(stance) ? clamp(100 - loyalty, 30, 90) : clamp(100 - bond, 0, 40);
    var esteem = clamp(Math.round((Number(b && b.realmIdx) || 0) * 8 + (bond / 4)), 0, 100);
    return { trust: loyalty, favor: bond, esteem: esteem, guard: guard };
  }

  /** 把一只随行存在登记/同步进 NPC 编年史，返回档案记录（无 Chronicle 时返回规范对象） */
  function syncChronicle(b, ctx) {
    if (!b) return null;
    var rec = {
      id: profileId(b),
      name: (b.name || "无名") + "·" + (FORM_TITLES[b.kind] || "随行"),
      npcTag: (b.kind === "pet" ? "pet" : "companion"),  /* 内部英文标识符沿用，存档兼容 */
      tier: tierOf(b),
      importance: "core",
      isBond: true,
      attr: clamp(Number(b.stats && b.stats.atk) || 20, 0, 100),
      disposition: dispositionOf(b),
      beastId: b.id,
      beastKind: b.kind
    };
    var existing = getProfile(rec.id);
    var chron = NC();
    var out = (chron && chron.ensure) ? chron.ensure(existing ? Object.assign({}, existing, rec) : rec) : (existing || rec);
    /* 生平：首次登记写一条来历；之后由世界时钟/事件追加 */
    if (!out.deeds || !out.deeds.length) {
      var intro = "与玩家缔结羁绊的" + ({ pet: "伴宠", spirit: "灵兽", demon: "妖兽", companion: "伙伴" }[b.kind] || "随行")
        + "「" + (b.name || "无名") + "」，特性「" + (b.trait || "忠诚") + "」，立场「" + (b.stance || "忠诚") + "」。";
      if (chron && chron.addDeed) { try { out = chron.addDeed(out, { text: intro, kind: "origin", weight: 2 }, ctx || {}).record; } catch(e){console.warn("[swallowed] beast-profile-bridge",e)} }
      else out.deeds = [{ text: intro, kind: "origin", weight: 2, at: "某时" }];
    }
    return putProfile(out);
  }

  /** 追加一条生平经历到随行档案（供战斗/世界事件/玩家互动调用） */
  function addDeed(b, text, ctx, kind) {
    if (!b) return null;
    var chron = NC();
    var rec = getProfile(profileId(b)) || syncChronicle(b, ctx);
    if (!chron || !chron.addDeed) return rec;
    var out = chron.addDeed(rec, { text: text, kind: kind || "event", weight: 1 }, ctx || {}).record;
    return putProfile(out);
  }

  /** 放归/离队：完整快照转 vault（只增不删），从活动视图移除 */
  function archive(b, reason) {
    if (!b) return false;
    var rec = getProfile(profileId(b)); if (!rec) return false;
    var d = loadStore();
    var snap = JSON.parse(JSON.stringify(rec));
    snap.archivedAt = Date.now();
    snap.archiveReason = String(reason || "release");
    d.vault.push(snap);
    delete d.records[rec.id];
    return saveStore(d);
  }

  /* =====================================================================
   * 三、专属性格与心理（PersonalityCodex + PsycheModel）
   * ===================================================================== */

  /** 汇总一只随行存在的性格档案。宠物非原著角色，按名字散列 + 特性生成原型。 */
  function personalityOf(b, world) {
    var codex = PC();
    world = world || worldOf();
    var name = (b && b.name) || "无名";
    var out = { name: name, world: world, traits: [], brief: "", psychology: null, isCanon: false };
    if (!codex || !codex.forRole) {
      /* 依赖未加载时的确定性兜底，保证纯函数始终可用 */
      var pool = ["忠诚", "机敏", "坚韧", "好奇", "护主", "桀骜", "温顺", "狡黠"];
      out.traits = [pick(pool, hash(name)), pick(pool, hash(name + world) + 3), String(b && b.trait || "忠诚")];
      out.brief = name + "：特性「" + (b && b.trait || "忠诚") + "」，立场「" + (b && b.stance || "忠诚") + "」。";
      return out;
    }
    var role = codex.forRole(name, world);
    out.traits = (role.traits || []).slice(0, 12);
    if (b && b.trait && out.traits.indexOf(b.trait) < 0) out.traits.push(b.trait);
    out.primaryLabel = role.primaryLabel;
    out.archetype = role.archetype;
    out.isCanon = !!role.isCanon;
    out.psychology = role.psychology || null;
    out.primaryCat = role.primaryCat;
    try { out.brief = codex.brief(name, world); } catch (e) { out.brief = name + "：特性「" + (b && b.trait || "忠诚") + "」。"; }
    return out;
  }

  /** 行为演化：性格原型 × 意志层 × 行为轨迹 → 一贯的行为倾向（复用 behaviorOf + 心理模型） */
  function behaviorOf(b, ctx) {
    ctx = ctx || {};
    var codex = PC();
    var name = (b && b.name) || "无名";
    var world = ctx.world || worldOf();
    var evs = ctx.events || [];
    /* 把宠物的立场/情绪/忠诚并入情境，让演化反映其意志 */
    var enriched = evs.slice();
    if (b && b.stance === "背弃") enriched = enriched.concat([{ text: "立场：背弃旧主" }]);
    if (b && b.mood === "愤懑") enriched = enriched.concat([{ text: "情绪：愤懑" }]);
    var days = Number(ctx.days || 0);
    var stage = ctx.stage || "陌生";
    var out = { name: name, tendency: [], mood: (b && b.mood) || "平静", rationale: "", psychology: null };
    if (codex && codex.behaviorOf) {
      var r = codex.behaviorOf(name, world, {
        events: enriched, days: days, stage: stage,
        intensity: ctx.intensity
      });
      out.tendency = (r.tendency || []).slice();
      out.mood = r.mood || out.mood;
      out.rationale = r.rationale || "";
      out.psychology = r.psychology || null;
    }
    /* 意志层兜底倾向：羁绊/忠诚决定亲近或疏离，绝不与既有人设打架 */
    var loyalty = clamp(b && b.loyalty != null ? b.loyalty : 50, 0, 100);
    if (b && b.status === "left") out.tendency.push("已离队，按各自命运行事");
    else if (loyalty >= 70) out.tendency.push("护主、随玩家行动出场");
    else if (loyalty <= 25) out.tendency.push("各行其是，关键时刻或生变数");
    if (!out.tendency.length) out.tendency.push("按既有轨迹行事");
    return out;
  }

  /* =====================================================================
   * 四、亲密档案门槛（NSFW：默认关，须显式开启 + 系统开启；三态不限）
   * ===================================================================== */

  /**
   * 是否可建亲密档案。v4.49.0 起两个条件同时满足即可：
   *   ① 玩家对该只显式开启 nsfwEligible（逐只、显式、可撤销）；
   *   ② 亲密档案系统本身已开启（玩家全局开关）。
   *   兽形 / 半兽形 / 人形三态均可，不再要求化形——尊重玩家对"兽形/半兽形也亲密"的诉求。
   * 表达尺度走 IntimacyArchive 的全局三档（含蓄/直白/露骨），不另起炉灶。
   */
  function eligibleNSFW(b) {
    if (!b || !b.nsfwEligible) return { ok: false, reason: "玩家未对该随行开启亲密档案" };
    var ia = IA();
    if (!ia || (ia.isEnabled && !ia.isEnabled())) return { ok: false, reason: "亲密档案系统未开启" };
    return { ok: true, reason: "", formState: formStateOf(b) };
  }

  /** 亲密档案 key：按随行 id 生成，三态共用同一份档案（兽形/半兽形/人形不各建、不串档） */
  function intimacyKey(b) {
    return "灵宠·" + profileId(b);
  }

  /** 汇总亲密视图（仅 eligible 时；否则返回 null，绝不泄露） */
  function intimacyOf(b) {
    var gate = eligibleNSFW(b);
    if (!gate.ok) return null;
    var ia = IA(); if (!ia || !ia.view) return null;
    var key = intimacyKey(b);
    var rec = null;
    try { rec = ia.get ? ia.get(key) : (ia.ensure ? ia.ensure(key) : null); } catch(e){console.warn("[swallowed] beast-profile-bridge",e)}
    if (!rec && ia.ensure) { try { rec = ia.ensure(key); } catch(e){console.warn("[swallowed] beast-profile-bridge",e)} }
    if (!rec) return null;
    var view = ia.view(key, "玩家");
    return view ? Object.assign({ key: key }, view) : { key: key, stageLabel: "陌生", stage: 0 };
  }

  /* =====================================================================
   * 五、总档案与主笔 prompt
   * ===================================================================== */

  /** 一只随行存在的完整专属档案 */
  function profileOf(b, ctx) {
    if (!b) return null;
    ctx = ctx || {};
    return {
      id: profileId(b),
      name: b.name,
      kind: b.kind,
      form: transformInfo(b),
      chronicle: getProfile(profileId(b)),
      personality: personalityOf(b, ctx.world),
      intimacy: intimacyOf(b),
      nsfwGate: eligibleNSFW(b)
    };
  }

  /**
   * 汇总注入主笔的 prompt 块：让大模型记得随行存在的三态形态、性格、心理、
   * 羁绊阶段；亲密阶段仅在玩家显式开启且系统开启时注入（三态均可），避免越界。
   */
  function buildPromptBlock(beasts, ctx) {
    var arr = Array.isArray(beasts) ? beasts : (function () {
      var bs = BS(); return bs && bs.list ? bs.list() : [];
    })();
    if (!arr.length) return "";
    ctx = ctx || {};
    var kinds = { pet: "宠物", spirit: "灵兽", demon: "妖兽", companion: "伙伴" };
    var lines = ["【玩家随行存在·专属档案（须随剧情本色演绎，不得遗忘或凭空消失）】"];
    arr.forEach(function (b) {
      if (!b || b.status === "left") return;
      var form = transformInfo(b);
      var pers = personalityOf(b, ctx.world);
      var seg = "· " + b.name + "（" + (kinds[b.kind] || "随行") + "·" + (b.species || "")
        + "，位阶" + (b.realmIdx || 0) + " Lv" + (b.level || 1) + "，羁绊" + (b.bond || 0) + "/100"
        + "，立场" + (b.stance || "忠诚") + "｜情绪" + (b.mood || "平静") + "｜忠诚" + (b.loyalty != null ? b.loyalty : 50) + "）";
      if (form.formState === "human") seg += " 现为完全人形「" + form.formName + "」（" + form.formTitle + "），以人形参与社交与对话。";
      else if (form.formState === "half") seg += " 现为半兽形（半人半兽，保留兽类特征）——可直立言语，兽性与人性并存。";
      else seg += (form.canTransform ? " 现为本相兽形，保留化形潜力（可转为半兽形/人形）。" : " 本相兽形，不具化形能力。");
      if (pers.brief) seg += " 性格：" + pers.brief;
      if (pers.psychology && pers.psychology.fear) seg += " 核心恐惧：" + pers.psychology.fear + "，据此推导其未明情境下的一贯反应。";
      var gate = eligibleNSFW(b);
      if (gate.ok) {
        var inti = intimacyOf(b);
        if (inti) seg += " 与玩家的亲密阶段：" + (inti.stageLabel || "陌生") + "（按玩家设定的表达尺度演绎）。";
      }
      lines.push(seg);
    });
    if (lines.length === 1) return "";
    lines.push("以上随行存在是玩家世界的一部分：会出场、成长、受伤、化形、与人相处并加深羁绊；不抢主角戏份，但有自己的反应与命运。");
    return lines.join("\n");
  }

  var API = {
    VERSION: VERSION,
    canTransform: canTransform,
    transformInfo: transformInfo,
    formStateOf: formStateOf,
    FORM_LABEL: FORM_LABEL,
    profileId: profileId,
    syncChronicle: syncChronicle,
    addDeed: addDeed,
    archive: archive,
    personalityOf: personalityOf,
    behaviorOf: behaviorOf,
    eligibleNSFW: eligibleNSFW,
    intimacyKey: intimacyKey,
    intimacyOf: intimacyOf,
    profileOf: profileOf,
    buildPromptBlock: buildPromptBlock,
    /** 一次性同步所有随行存在进编年史 */
    syncAll: function (ctx) {
      var bs = BS(); var arr = bs && bs.list ? bs.list() : [];
      var n = 0;
      arr.forEach(function (b) { try { if (syncChronicle(b, ctx)) n++; } catch(e){console.warn("[swallowed] beast-profile-bridge",e)} });
      return n;
    },
    stats: function () {
      var d = loadStore();
      return {
        VERSION: VERSION,
        profiles: Object.keys(d.records).length,
        vault: d.vault.length,
        deps: { chronicle: !!NC(), personality: !!PC(), psyche: !!PM(), intimacy: !!IA(), beast: !!BS() }
      };
    }
  };

  G.BeastProfileBridge = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
