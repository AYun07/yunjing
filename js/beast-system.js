/* =========================================================================
 * 云境 · 灵宠·妖兽·伙伴系统 BeastSystem（v3.63.0）
 * -------------------------------------------------------------------------
 * 统一管理四类随行存在：
 *   pet       宠物   —— 寻常伴宠，卖萌/侦察/小帮手
 *   spirit    灵兽   —— 可孵育、可修行、能成为坐骑与战力
 *   demon     妖兽   —— 野性难驯，需收服/镇压，可驯为战宠或敌对
 *   companion 伙伴   —— 人形同伴，可随队、可入小队协同作战
 *
 * 生命周期：契约(contract) → 养成(train/feed) → 成长升级(levelUp) → 羁绊(bond)
 *          → 随队(follow) / 入小队(squad) / 协同作战。
 * 全部 localStorage 按存档(slotId)持久化；接入主笔 prompt 与战斗 prompt。
 * ========================================================================= */
(function () {
  "use strict";

  var KINDS = {
    pet:       { id: "pet",       ico: "🐾", name: "宠物",   hint: "寻常伴宠：卖萌、侦察、小帮手" },
    spirit:    { id: "spirit",    ico: "🪶", name: "灵兽",   hint: "可孵育修行，能当坐骑与战力" },
    demon:     { id: "demon",     ico: "👹", name: "妖兽",   hint: "野性难驯，需收服镇压，可驯为战宠" },
    companion: { id: "companion", ico: "🤝", name: "伙伴",   hint: "人形同伴，可随队、可入小队协同作战" }
  };
  var KIND_ORDER = ["companion", "spirit", "demon", "pet"];

  /* 位阶（成长上限随位阶提升） */
  var REALMS = ["稚童", "入门", "小成", "通达", "登堂", "入微", "化境", "通神", "超凡", "问道"];

  /* v3.86.0 P2-4：伙伴的立场/目的/情绪（有意志，不再只是数值挂件） */
  var STANCES = ["忠诚", "敬慕", "依赖", "疏离", "动摇", "桀骜", "野心", "背弃"];
  var GOALS = ["守护主人", "追求力量", "寻回家园", "复仇雪恨", "求道问心", "攒钱赎身", "扬名立万", "只求温饱"];
  var MOODS = ["平静", "雀跃", "疲惫", "戒备", "不满", "愤懑", "亲近", "怅惘"];
  function pick(arr, k) { return arr[Math.abs(k) % arr.length]; }
  function defaultStance(kind) { return kind === "demon" ? "桀骜" : kind === "companion" ? "疏离" : "忠诚"; }
  function defaultGoal(kind) { return kind === "demon" ? "追求力量" : kind === "companion" ? "扬名立万" : "守护主人"; }

  function slotId() {
    try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch (e) { return "main"; }
  }
  function storeKey() { return "yunjingBeasts~" + slotId(); }

  function load() {
    try {
      var raw = localStorage.getItem(storeKey());
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function save(arr) {
    try { localStorage.setItem(storeKey(), JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  var uid = 0;
  function newId() { return "bst_" + Date.now().toString(36) + "_" + (uid++).toString(36); }

  /* 初始属性（按类型给倾向） */
  function baseStats(kind) {
    if (kind === "spirit" || kind === "demon") return { hp: 60, atk: 22, def: 16, spd: 18 };
    if (kind === "companion") return { hp: 50, atk: 20, def: 14, spd: 16 };
    return { hp: 30, atk: 8, def: 6, spd: 14 }; /* pet */
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var BeastSystem = {
    KINDS: KINDS, KIND_ORDER: KIND_ORDER, REALMS: REALMS,

    /** 当前存档下全部随行存在 */
    list() { return load(); },
    get(id) { return load().find(function (b) { return b.id === id; }) || null; },
    count() { return load().length; },

    /** 契约一只（玩家发起或世界事件掉落） */
    contract(opts) {
      opts = opts || {};
      var kind = KINDS[opts.kind] ? opts.kind : "pet";
      var st = baseStats(kind);
      var b = {
        id: newId(),
        name: opts.name || (KINDS[kind].name + "·无名"),
        kind: kind,
        species: opts.species || KINDS[kind].name,
        realmIdx: opts.realmIdx || 0,
        level: opts.level || 1,
        exp: 0,
        stats: st,
        skills: opts.skills || (kind === "pet" ? ["伴护"] : ["扑击"]),
        bond: opts.bond || 10,
        status: "active",          /* active 随队 / stable 寄养 / sealed 镇压 / left 已离队 */
        /* v3.86.0 P2-4：意志层——忠诚/立场/目的/情绪，会随世界状态与羁绊自发变化 */
        loyalty: opts.loyalty != null ? clamp(opts.loyalty, 0, 100) : clamp((opts.bond || 10) + 25, 0, 100),
        stance: opts.stance || defaultStance(kind),
        goal: opts.goal || defaultGoal(kind),
        mood: opts.mood || "平静",
        trait: opts.trait || "忠诚",
        note: opts.note || "",
        born: Date.now()
      };
      var arr = load(); arr.push(b); save(arr);
      return b;
    },

    /** 放归 / 解散 */
    release(id) {
      var arr = load().filter(function (b) { return b.id !== id; });
      save(arr); return true;
    },

    setName(id, name) {
      var b = this.get(id); if (!b) return false; b.name = name; var a = load();
      var i = a.findIndex(function (x) { return x.id === id; }); a[i] = b; save(a); return true;
    },

    /** 养成：喂饲/修行，提升经验与属性（事件驱动，真实落表） */
    _antiGrind(key, limit) {
      /* v3.68.0 防刷：每只每轮一次养护/羁绊——按钮可无限连点刷满 999 的失控点封死 */
      try {
        var fw = window.storyFramework;
        var round = (fw && fw.storyState && fw.storyState.turnCount) || 0;
        this._grind = this._grind || {};
        var k = key + "@" + round;
        if (this._grind[k] >= limit) return false;
        this._grind[k] = (this._grind[k] || 0) + 1;
        return true;
      } catch (e) { return true; }
    },

    train(id, opts) {
      opts = opts || {};
      var a = load(); var i = a.findIndex(function (x) { return x.id === id; }); if (i < 0) return null;
      var b = a[i];
      if (!opts.free && !this._antiGrind("train:" + id, 10)) { if (window.MoChibi) MoChibi.say("「" + b.name + "」这轮已经养护过啦，下轮再来～", 2400); return null; }
      var gain = opts.exp || 12;
      b.exp += gain;
      var grow = opts.statGain || { hp: 2, atk: 1, def: 1, spd: 1 };
      for (var k in grow) if (b.stats[k] != null) b.stats[k] = clamp(b.stats[k] + grow[k], 1, 999);
      while (b.exp >= 100) { b.exp -= 100; this._levelUp(b); }
      a[i] = b; save(a);
      return b;
    },

    _levelUp(b) {
      b.level += 1;
      /* 随位阶小幅放大成长幅度；绝对上限远高于基底，绝不回退 */
      var mult = 1 + b.realmIdx * 0.25;
      b.stats.hp = clamp(Math.round(b.stats.hp + 6 * mult), 1, 999);
      b.stats.atk = clamp(Math.round(b.stats.atk + 3 * mult), 1, 999);
      b.stats.def = clamp(Math.round(b.stats.def + 2 * mult), 1, 999);
      b.stats.spd = clamp(Math.round(b.stats.spd + 2 * mult), 1, 999);
      if (b.level % 4 === 0 && b.realmIdx < REALMS.length - 1) {
        b.realmIdx += 1;
      }
    },

    /** 羁绊增减（0-100） */
    bond(id, delta) {
      var a = load(); var i = a.findIndex(function (x) { return x.id === id; }); if (i < 0) return null;
      var b = a[i];
      if ((delta || 0) > 0 && !this._antiGrind("bond:" + id, 5)) { if (window.MoChibi) MoChibi.say("「" + b.name + "」这轮已经亲近过了，让TA歇歇～", 2400); return null; }
      b.bond = clamp(b.bond + (delta || 0), 0, 100); a[i] = b; save(a); return b;
    },

    /** 设置随队/寄养/镇压状态 */
    setStatus(id, status) {
      var a = load(); var i = a.findIndex(function (x) { return x.id === id; }); if (i < 0) return false;
      a[i].status = status; save(a); return true;
    },

    /** v3.86.0 P2-4：世界自转/事件驱动的意志漂移——羁绊低+危机 → 动摇/离队/叛变；否则情绪/立场缓慢回归 */
    driftAll(ctx) {
      ctx = ctx || {};
      var arr = load(); if (!arr.length) return [];
      var changes = [];
      var crisis = !!ctx.crisis;
      for (var i = 0; i < arr.length; i++) {
        var b = arr[i];
        if (!b || b.status === "left") continue;
        var bond = Number(b.bond) || 0;
        var mood = b.mood || "平静";
        if (bond >= 60) mood = crisis ? "戒备" : "亲近";
        else if (bond <= 20) mood = crisis ? "愤懑" : "不满";
        else if (crisis) mood = "戒备";
        else if (mood === "平静" && Math.random() < 0.3) mood = "疲惫";
        b.mood = mood;
        if (bond >= 70) b.stance = "敬慕";
        else if (bond <= 15) b.stance = "动摇";
        b.loyalty = clamp((Number(b.loyalty) || 0) + (bond >= 50 ? 1 : -2) + (crisis ? -3 : 0), 0, 100);
        var defected = false, left = false;
        if (b.kind === "companion" || b.kind === "demon") {
          var p = (bond <= 12 ? 0.55 : bond <= 22 ? 0.32 : bond <= 32 ? 0.14 : 0) + (crisis ? 0.25 : 0) + ((b.loyalty || 0) <= 20 ? 0.15 : 0);
          if (p > 0 && Math.random() < p) {
            if (bond <= 12 && (b.kind === "demon" || b.stance === "野心" || (b.loyalty || 0) <= 15) && Math.random() < 0.5) defected = true;
            else left = true;
          }
        }
        if (defected || left) {
          b.status = "left";
          if (defected) { b.stance = "背弃"; b.goal = "反噬旧主"; }
          changes.push({ name: b.name, kind: b.kind, mode: defected ? "叛变" : "离队" });
          var txt = "「" + b.name + "」" + (defected ? "背弃了玩家，反目成仇" : "心生去意，悄然离队") + "。";
          try { if (window.CanonTimeline && CanonTimeline.event) CanonTimeline.event("伙伴" + (defected ? "叛变" : "离队") + "·" + b.name, "changed", { kind: "companion", now: txt, round: this._round() }); } catch (e) {}
          try { if (window.WorldBus) { WorldBus.fact(txt); if (defected) WorldBus.grudge(b.name, -25); WorldBus.emit({ type: "beast." + (defected ? "defect" : "leave"), name: b.name }); } } catch (e) {}
          try { if (window.showToast) window.showToast("💔 " + txt, "warn"); } catch (e) {}
        }
      }
      save(arr);
      return changes;
    },
    _round() { try { var fw = window.storyFramework; return (fw && fw.storyState && Number(fw.storyState.turnCount)) || 0; } catch (e) { return 0; } },

    realmName(b) { return REALMS[b.realmIdx] || REALMS[0]; },

    /** 当前随队（active）的战力摘要，供战斗/小队调用 */
    battleRoster() {
      return load().filter(function (b) { return b.status === "active"; });
    },

    /* =====================================================================
     * 主笔 prompt：把随行存在写进世界设定，让 AI 真正记得它们
     * ===================================================================== */
    buildPromptBlock() {
      var arr = load();
      /* v3.68.0 去重：已入小队的灵宠由 SquadSystem 块负责呈现，这里跳过，
         防止同一只每轮被注入两遍（token 浪费且两处数值可能打架） */
      try {
        var sqIds = {};
        if (window.SquadSystem && SquadSystem.list) {
          SquadSystem.list().forEach(function (m) { if (m && m.beastId) sqIds[m.beastId] = 1; });
        }
        if (Object.keys(sqIds).length) arr = arr.filter(function (b) { return !sqIds[b.id]; });
      } catch (e) { }
      if (!arr.length) return "";
      arr = arr.filter(function (b) { return b.status !== "left"; });
      if (!arr.length) return "";
      var lines = ["【玩家随行存在（须始终记得、随剧情合理互动，不得凭空消失或遗忘）】"];
      arr.forEach(function (b) {
        var k = KINDS[b.kind];
        lines.push(
          "· " + b.name + "（" + k.name + "·" + b.species + "，位阶" + REALMS[b.realmIdx] + " Lv" + b.level +
          "，羁绊" + b.bond + "/100，状态：" + ({ active: "随队", stable: "寄养", sealed: "镇压", left: "已离队" }[b.status] || b.status) +
          "，立场" + (b.stance || "忠诚") + "｜目的" + (b.goal || "守护主人") + "｜情绪" + (b.mood || "平静") + "｜忠诚" + (b.loyalty != null ? b.loyalty : 50) +
          "）：属性 气血" + b.stats.hp + "/攻" + b.stats.atk + "/防" + b.stats.def + "/速" + b.stats.spd +
          "，技能【" + b.skills.join("、") + "】，特性「" + b.trait + "」" + (b.note ? "——" + b.note : "")
        );
      });
      lines.push("随行存在是玩家世界的一部分：会随玩家行动出场、成长、受伤与羁绊加深；它们不抢主角戏份，但要有自己的反应与命运。");
      return lines.join("\n");
    },

    /* =====================================================================
     * 战斗 prompt：随队者可协同作战
     * ===================================================================== */
    buildCombatBlock() {
      var r = this.battleRoster();
      if (!r.length) return "";
      return "【随队协同】玩家此战可召唤随行：" + r.map(function (b) {
        return b.name + "（" + KINDS[b.kind].name + " Lv" + b.level + "，攻" + b.stats.atk + "/速" + b.stats.spd + "，技能【" + b.skills.join("、") + "】)";
      }).join("；") + "。协同技按羁绊触发，羁绊越高配合越默契。";
    },

    /* =====================================================================
     * UI 面板
     * ===================================================================== */
    _ensureStyle() {
      if (document.getElementById("beast-style")) return;
      var css = `
.beast-mask{position:fixed;inset:0;z-index:120;background:rgba(8,12,20,.62);backdrop-filter:blur(3px);display:none}
.beast-mask.show{display:block}
.beast-panel{position:absolute;right:0;top:0;bottom:0;width:min(460px,94vw);background:#11161f;border-left:1px solid rgba(255,255,255,.08);
  box-shadow:-12px 0 40px rgba(0,0,0,.5);display:flex;flex-direction:column;color:#e9eef5;font-family:inherit}
.beast-head{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px}
.beast-head h3{margin:0;font-size:17px;flex:1}
.beast-head .x{cursor:pointer;font-size:20px;opacity:.7;background:none;border:none;color:inherit}
.beast-acts{padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)}
.beast-acts button{flex:1 1 120px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:12.5px}
.beast-acts button:hover{background:rgba(255,255,255,.12)}
.beast-list{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.beast-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:12px 13px}
.beast-card .top{display:flex;align-items:center;gap:10px}
.beast-card .ico{font-size:26px}
.beast-card .nm{font-size:15px;font-weight:600;flex:1}
.beast-card .kd{font-size:11px;opacity:.7}
.beast-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.1);margin:8px 0 4px;overflow:hidden}
.beast-bar>i{display:block;height:100%;background:linear-gradient(90deg,#7ec8ff,#b79bff)}
.beast-meta{font-size:11.5px;opacity:.78;line-height:1.6}
.beast-card .btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.beast-card .btns button{font-size:11px;padding:4px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;cursor:pointer}
.beast-empty{text-align:center;opacity:.6;padding:40px 10px;font-size:13px}
.beast-form{display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.beast-form select,.beast-form input{flex:1 1 100px;padding:7px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:inherit;font-size:12.5px}
.beast-form button{padding:7px 14px;border-radius:9px;border:none;background:#5b8def;color:#fff;cursor:pointer;font-size:12.5px}
`;
      var s = document.createElement("style"); s.id = "beast-style"; s.textContent = css; document.head.appendChild(s);
    },

    openUI() {
      this._ensureStyle();
      var mask = document.getElementById("beastMask");
      if (!mask) {
        mask = document.createElement("div"); mask.id = "beastMask"; mask.className = "beast-mask";
        mask.innerHTML = '<div class="beast-panel"><div class="beast-head"><h3>🐾 灵宠·妖兽·伙伴</h3><button class="x" onclick="BeastSystem.closeUI()">✕</button></div>' +
          '<div class="beast-acts"><button onclick="BeastSystem.demoContract()">＋ 邂逅一只（演示）</button><button onclick="BeastSystem.trainAll()">🍖 全体养护</button><button onclick="BeastSystem.closeUI()">收起</button></div>' +
          '<div class="beast-list" id="beastList"></div>' +
          '<div class="beast-form"><select id="bfKind">' + KIND_ORDER.map(function (k) { return '<option value="' + k + '">' + KINDS[k].name + '</option>'; }).join("") + '</select>' +
          '<input id="bfName" placeholder="名字（可空）"><button onclick="BeastSystem.contractFromForm()">契约</button></div></div>';
        mask.addEventListener("click", function (e) { if (e.target === mask) window.BeastSystem.closeUI(); });
        document.body.appendChild(mask);
      }
      mask.classList.add("show");
      this.render();
    },
    closeUI() { var m = document.getElementById("beastMask"); if (m) m.classList.remove("show"); },

    render() {
      var box = document.getElementById("beastList"); if (!box) return;
      var arr = this.list();
      if (!arr.length) { box.innerHTML = '<div class="beast-empty">尚未契约任何随行存在。<br>在冒险中邂逅灵兽、收服妖兽、结交伙伴，或点上方「邂逅一只」体验。</div>'; return; }
      box.innerHTML = arr.map(function (b) {
        var k = KINDS[b.kind];
        return '<div class="beast-card">' +
          '<div class="top"><span class="ico">' + k.ico + '</span><span class="nm">' + b.name + '</span><span class="kd">' + k.name + ' · ' + REALMS[b.realmIdx] + ' Lv' + b.level + '</span></div>' +
          '<div class="beast-bar"><i style="width:' + b.bond + '%"></i></div>' +
          '<div class="beast-meta">气血' + b.stats.hp + ' · 攻' + b.stats.atk + ' · 防' + b.stats.def + ' · 速' + b.stats.spd + ' · 技艺【' + b.skills.join("、") + '】 · 特性「' + b.trait + '」<br>羁绊 ' + b.bond + '/100 · ' + ({ active: "随队", stable: "寄养", sealed: "镇压" }[b.status] || b.status) + '</div>' +
          '<div class="btns">' +
          '<button onclick="BeastSystem.train(\'' + b.id + '\')">养护+成长</button>' +
          '<button onclick="BeastSystem.bond(\'' + b.id + '\',8)">增进羁绊</button>' +
          '<button onclick="BeastSystem.setStatus(\'' + b.id + '\',\'' + (b.status === "active" ? "stable" : "active") + '\')">' + (b.status === "active" ? "寄养" : "随队") + '</button>' +
          '<button onclick="BeastSystem.release(\'' + b.id + '\')">放归</button>' +
          '</div></div>';
      }).join("");
    },

    contractFromForm() {
      var k = document.getElementById("bfKind"); var n = document.getElementById("bfName");
      var b = this.contract({ kind: k ? k.value : "pet", name: n && n.value ? n.value.trim() : "" });
      if (n) n.value = "";
      this.render();
      if (window.MoChibi) MoChibi.say("已契约「" + b.name + "」（" + KINDS[b.kind].name + "）", 3200);
    },
    demoContract() {
      var pool = [
        { kind: "spirit", name: "青羽鹤", species: "风属性灵禽", trait: "灵动", skills: ["御风", "俯冲"] },
        { kind: "demon", name: "赤焰狼", species: "火属性妖兽", trait: "桀骜", skills: ["扑咬", "燎原"] },
        { kind: "pet", name: "雪团", species: "绒耳貂", trait: "黏人", skills: ["伴护", "寻物"] },
        { kind: "companion", name: "阿砚", species: "流浪剑客", trait: "重诺", skills: ["快剑", "格挡"] }
      ];
      var p = pool[Math.floor(Math.random() * pool.length)];
      var b = this.contract(p);
      this.render();
      if (window.MoChibi) MoChibi.say("邂逅了「" + b.name + "」——" + KINDS[b.kind].name + "已入随行！", 3400);
      return b;
    },
    trainAll() {
      var arr = this.list(); arr.forEach(function (b) { window.BeastSystem.train(b.id); });
      this.render();
      if (window.MoChibi) MoChibi.say("全员养护完成，羁绊更深了一分。", 3000);
    },

    /** 暴露给外部（战斗/小队/事件） */
    api() { return this; }
  };

  window.BeastSystem = BeastSystem;
})();
