/* =========================================================================
 * 云境 · 小队系统 SquadSystem（v3.64.0）
 * -------------------------------------------------------------------------
 * 玩家可邀请 NPC / 伙伴 / 灵宠妖兽入队，编成一支小队，协同作战、共历冒险。
 *   - 成员来源：同伴(companion) / 人形 NPC / 灵宠·妖兽(来自 BeastSystem)
 *   - 编队：设队长、排序、最多 MAX 人（含玩家）
 *   - 协同技：随成员羁绊/关系自动推演，由大模型在战斗中触发
 *   - 持久化：按存档(slotId) 存 localStorage；接入主笔与战斗 prompt
 * ========================================================================= */
(function () {
  "use strict";

  var MAX = 6;            /* 含玩家在内最多 6 人 */
  var KEY_PREF = "yunjingSquad~";

  function slotId() {
    try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch (e) { return "main"; }
  }
  function storeKey() { return KEY_PREF + slotId(); }

  function load() {
    try { var a = JSON.parse(localStorage.getItem(storeKey()) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function save(arr) { try { localStorage.setItem(storeKey(), JSON.stringify(arr)); return true; } catch (e) { return false; } }
  var uid = 0;
  function newId() { return "sq_" + Date.now().toString(36) + "_" + (uid++).toString(36); }

  /* 玩家自己始终在队中（不限定位置，队长是首位元素） */
  function ensurePlayer() {
    var a = load();
    if (!a.some(function (x) { return x.type === "player"; })) {
      a.unshift({ id: "sq_player", type: "player", name: "你", role: "队长（玩家）", stats: { hp: 100, atk: 25, def: 20, spd: 22 }, bond: 100, relation: "self" });
    }
    return a;
  }

  var SquadSystem = {
    MAX: MAX,

    list() {
      var a = load();
      if (!a.some(function (x) { return x.type === "player"; })) a = ensurePlayer();
      return a;
    },
    /** 不含玩家的可邀请名额 */
    slotsLeft() { return MAX - load().length; },
    isFull() { return load().length >= MAX; },

    /** 邀请一名同伴 / NPC（玩家主动或剧情收入） */
    invite(opts) {
      opts = opts || {};
      var a = ensurePlayer();
      if (a.length >= MAX) return null;
      var m = {
        id: newId(),
        type: opts.type || "npc",
        name: opts.name || "无名同伴",
        role: opts.role || "同行者",
        stats: opts.stats || { hp: 60, atk: 18, def: 14, spd: 16 },
        bond: opts.bond || 20,
        relation: opts.relation || "同伴",
        skill: opts.skill || "各展所长",
        note: opts.note || ""
      };
      a.push(m); save(a);
      return m;
    },

    /** 把一只随行灵宠/妖兽拉进小队 */
    addBeast(beastId) {
      if (!window.BeastSystem) return null;
      var b = window.BeastSystem.get(beastId); if (!b) return null;
      var a = ensurePlayer();
      if (a.length >= MAX) return null;
      if (a.some(function (x) { return x.beastId === beastId; })) return null;
      var m = {
        id: newId(), type: "beast", beastId: beastId,
        name: b.name, role: b.species,
        stats: { hp: b.stats.hp, atk: b.stats.atk, def: b.stats.def, spd: b.stats.spd },
        bond: b.bond, relation: "随行", skill: (b.skills || ["扑击"]).join("/"), note: "灵宠·妖兽"
      };
      a.push(m); save(a); return m;
    },

    remove(id) {
      if (id === "sq_player") return false;
      var a = load().filter(function (x) { return x.id !== id; });
      save(a); return true;
    },
    setLeader(id) {
      var a = load(); var i = a.findIndex(function (x) { return x.id === id; }); if (i <= 0) return false;
      var [m] = a.splice(i, 1); m.role = "队长"; a.unshift(m); save(a); return true;
    },
    /** 增进某成员羁绊 */
    bond(id, delta) {
      var a = load(); var m = a.find(function (x) { return x.id === id; }); if (!m) return null;
      m.bond = Math.max(0, Math.min(100, (m.bond || 0) + delta)); save(a); return m;
    },

    /** 协同技：依据成员关系/羁绊推演（给大模型参考，由其在战斗中触发） */
    cooperativeSkills() {
      var a = load().filter(function (x) { return x.type !== "player"; });
      if (a.length < 1) return [];
      var skills = [];
      a.forEach(function (m) {
        if (m.bond >= 60) skills.push(m.name + "的「" + (m.skill || "各展所长") + "」因默契可打出连携");
        else if (m.bond >= 30) skills.push(m.name + "可配合玩家进行基础协攻");
      });
      if (a.length >= 2) skills.push("多人合击：按队形触发范围/控制类协同技（羁绊越高威力越强）");
      return skills;
    },

    /* ---------- 主笔 prompt ---------- */
    buildPromptBlock() {
      var a = load().filter(function (x) { return x.type !== "player"; });
      if (!a.length) return "";
      var lines = ["【玩家小队（须始终记得他们是玩家的同行者，随剧情合理互动、共同历险）】"];
      a.forEach(function (m) {
        lines.push(
          "· " + m.name + "（" + (m.role || m.type) + "，关系：" + (m.relation || "同伴") + "，羁绊" + (m.bond || 0) + "/100）：" +
          "战力 气血" + m.stats.hp + "/攻" + m.stats.atk + "/防" + m.stats.def + "/速" + m.stats.spd +
          "，擅长【" + (m.skill || "各展所长") + "】" + (m.note ? "——" + m.note : "")
        );
      });
      lines.push("小队成员是玩家世界的一部分：会与玩家一同进退、各有性格与命运；不得让他们的行动脱离其性格，也不得无故让队员凭空消失。");
      return lines.join("\n");
    },
    buildCombatBlock() {
      var a = load().filter(function (x) { return x.type !== "player"; });
      if (!a.length) return "";
      var co = this.cooperativeSkills();
      return "【小队协同】本战玩家可携小队成员：" + a.map(function (m) {
        return m.name + "（" + (m.role || m.type) + " 攻" + m.stats.atk + "/速" + m.stats.spd + " 羁绊" + (m.bond || 0) + "）";
      }).join("；") + (co.length ? "。协同技：" + co.join("；") + "。" : "。");
    },

    /* ---------- UI ---------- */
    _style() {
      if (document.getElementById("squad-style")) return;
      var css = `
.squad-mask{position:fixed;inset:0;z-index:121;background:rgba(8,12,20,.62);backdrop-filter:blur(3px);display:none}
.squad-mask.show{display:block}
.squad-panel{position:absolute;right:0;top:0;bottom:0;width:min(460px,94vw);background:#11161f;border-left:1px solid rgba(255,255,255,.08);box-shadow:-12px 0 40px rgba(0,0,0,.5);display:flex;flex-direction:column;color:#e9eef5;font-family:inherit}
.squad-head{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px}
.squad-head h3{margin:0;font-size:17px;flex:1}
.squad-head .x{cursor:pointer;font-size:20px;opacity:.7;background:none;border:none;color:inherit}
.squad-acts{padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)}
.squad-acts button{flex:1 1 120px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:12.5px}
.squad-acts button:hover{background:rgba(255,255,255,.12)}
.squad-list{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.squad-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:11px 13px}
.squad-card .top{display:flex;align-items:center;gap:9px}
.squad-card .nm{font-size:15px;font-weight:600;flex:1}
.squad-card .rl{font-size:11px;opacity:.7}
.squad-card .lb{font-size:11px;opacity:.8;margin-top:3px}
.squad-card .btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.squad-card .btns button{font-size:11px;padding:4px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;cursor:pointer}
.squad-empty{text-align:center;opacity:.6;padding:40px 10px;font-size:13px}
.squad-form{display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.squad-form input,.squad-form select{flex:1 1 100px;padding:7px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:inherit;font-size:12.5px}
.squad-form button{padding:7px 14px;border-radius:9px;border:none;background:#5b8def;color:#fff;cursor:pointer;font-size:12.5px}
`;
      var s = document.createElement("style"); s.id = "squad-style"; s.textContent = css; document.head.appendChild(s);
    },
    openUI() {
      this._style();
      var mask = document.getElementById("squadMask");
      if (!mask) {
        mask = document.createElement("div"); mask.id = "squadMask"; mask.className = "squad-mask";
        mask.innerHTML = '<div class="squad-panel"><div class="squad-head"><h3>🛡 小队编成</h3><button class="x" onclick="SquadSystem.closeUI()">✕</button></div>' +
          '<div class="squad-acts"><button onclick="SquadSystem.demoInvite()">＋ 结识同伴（演示）</button><button onclick="SquadSystem.addFirstBeast()">🐾 拉灵宠入队</button><button onclick="SquadSystem.closeUI()">收起</button></div>' +
          '<div class="squad-list" id="squadList"></div>' +
          '<div class="squad-form"><input id="sqName" placeholder="同伴名字"><input id="sqRole" placeholder="身份/职阶（可空）"><button onclick="SquadSystem.inviteFromForm()">邀请入队</button></div></div>';
        mask.addEventListener("click", function (e) { if (e.target === mask) window.SquadSystem.closeUI(); });
        document.body.appendChild(mask);
      }
      mask.classList.add("show");
      this.render();
    },
    closeUI() { var m = document.getElementById("squadMask"); if (m) m.classList.remove("show"); },
    render() {
      var box = document.getElementById("squadList"); if (!box) return;
      var a = this.list();
      if (a.length <= 1) { box.innerHTML = '<div class="squad-empty">小队暂时只有你一人。<br>结识同伴、收服灵宠，把空位填满——最多 ' + MAX + ' 人（含你）。</div>'; return; }
      box.innerHTML = a.map(function (m) {
        return '<div class="squad-card">' +
          '<div class="top"><span class="nm">' + m.name + (m.id === "sq_player" ? " 👑" : "") + '</span><span class="rl">' + (m.role || m.type) + '</span></div>' +
          '<div class="lb">气血' + m.stats.hp + ' · 攻' + m.stats.atk + ' · 防' + m.stats.def + ' · 速' + m.stats.spd + ' · 关系「' + (m.relation || "同伴") + '」 · 羁绊' + (m.bond || 0) + '/100 · 擅长【' + (m.skill || "各展所长") + '】</div>' +
          (m.id === "sq_player" ? "" : '<div class="btns"><button onclick="SquadSystem.setLeader(\'' + m.id + '\')">设为队长</button><button onclick="SquadSystem.bond(\'' + m.id + '\',8)">增进羁绊</button><button onclick="SquadSystem.remove(\'' + m.id + '\')">请离</button></div>') +
          '</div>';
      }).join("");
    },
    inviteFromForm() {
      var n = document.getElementById("sqName"); var r = document.getElementById("sqRole");
      if (!n || !n.value.trim()) { if (window.MoChibi) MoChibi.say("先给同伴起个名字～", 2600); return; }
      var m = this.invite({ name: n.value.trim(), role: r && r.value.trim() ? r.value.trim() : "同行者" });
      if (n) n.value = ""; if (r) r.value = "";
      if (!m) { if (window.MoChibi) MoChibi.say("小队已满（最多 " + MAX + " 人）。", 2600); return; }
      this.render();
      if (window.MoChibi) MoChibi.say(m.name + " 加入了小队！", 3000);
    },
    demoInvite() {
      var pool = [
        { name: "凌霜", role: "冰系剑修", skill: "寒霜斩", stats: { hp: 70, atk: 24, def: 16, spd: 26 } },
        { name: "铁牛", role: "体修盾卫", skill: "撼地盾", stats: { hp: 120, atk: 18, def: 34, spd: 12 } },
        { name: "苏沐", role: "丹道医师", skill: "回春术", stats: { hp: 55, atk: 10, def: 12, spd: 20 } }
      ];
      var p = pool[Math.floor(Math.random() * pool.length)];
      var m = this.invite(p);
      if (!m) { if (window.MoChibi) MoChibi.say("小队已满（最多 " + MAX + " 人）。", 2600); return; }
      this.render();
      if (window.MoChibi) MoChibi.say(m.name + "（" + m.role + "）入队！", 3200);
      return m;
    },
    addFirstBeast() {
      if (!window.BeastSystem) { if (window.MoChibi) MoChibi.say("还没有随行灵宠，先去「灵宠·妖兽·伙伴」契约一只。", 3200); return; }
      var beasts = window.BeastSystem.list();
      if (!beasts.length) { if (window.MoChibi) MoChibi.say("还没有随行灵宠，先去契约一只。", 3200); return; }
      var m = this.addBeast(beasts[0].id);
      if (!m) { if (window.MoChibi) MoChibi.say(this.isFull() ? "小队已满。" : "该灵宠已在队中。", 2600); return; }
      this.render();
      if (window.MoChibi) MoChibi.say(m.name + " 进入小队随行出战！", 3000);
      return m;
    }
  };

  window.SquadSystem = SquadSystem;
})();
