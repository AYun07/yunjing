/* World Runtime v1.3.0 — 统一模块标准/动作管线/NPC/HUD/导演/阶段接线 */
(function() {
  "use strict";
  var VERSION = "v1.3.0";
  var genre = "free";
  try { genre = new URLSearchParams(location.search).get("genre") || "free"; } catch (e) {}
  var STORE = "worldRuntime_" + genre;
  var MAX_LOGS = 40, MAX_FACTS = 12, MAX_HISTORY = 8, MAX_CREATOR_LOG = 50, MAX_NPCS = 40;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function asNum(v, d) { var n = Number(v); return isFinite(n) ? n : (d == null ? 0 : d); }
  function nowRound() { try { var fw = window.storyFramework; var v = fw && fw.storyState ? fw.storyState.variables : null; return (v && Number(v.chapter)) || (fw && fw.storyState && Number(fw.storyState.turnCount)) || 0; } catch (e) { return 0; } }
  function worldName() { try { return (window.storyFramework && storyFramework.config && storyFramework.config.genreName) || ""; } catch (e) { return ""; } }
  function toast(m, t) { try { if (window.showToast && m) window.showToast(String(m), t || "success"); } catch (e) {} }
  var G = { version: 1, npcs: {}, creatorLog: [], paused: false, unlocked: false };
  var saveTid = 0;
  function load() { try { var r = localStorage.getItem(STORE); if (r) { var d = JSON.parse(r); if (d && typeof d === "object") { if (d.npcs && typeof d.npcs === "object") G.npcs = d.npcs; if (Array.isArray(d.creatorLog)) G.creatorLog = d.creatorLog; G.paused = !!d.paused; G.unlocked = !!d.unlocked; } } } catch (e) {} }
  function save() { if (saveTid) return; saveTid = setTimeout(function() { saveTid = 0; try { localStorage.setItem(STORE, JSON.stringify(G)); } catch (e) {} }, 120); }
  load();
  var REG = {}, ORDER = [], booted = false;
  function capture(l) { (l || []).forEach(function(m) { if (!m || !m.id) return; if (!REG[m.id]) ORDER.push(m.id); REG[m.id] = m; }); }
  function blankState(seed) { var s = { version: 1, state: {}, resources: {}, flags: {}, cooldowns: {}, logs: [], history: [], selected: null, updatedRound: 0 }; if (seed) for (var k in seed) if (seed.hasOwnProperty(k)) s[k] = seed[k]; return s; }
  function snapshot(s) { var c = JSON.parse(JSON.stringify({ version: s.version, state: s.state, resources: s.resources, flags: s.flags, selected: s.selected, cooldowns: s.cooldowns })); c.r = nowRound(); return c; }
  function restore(s, c) { if (!c) return false; s.version = c.version || 1; s.state = c.state || {}; s.resources = c.resources || {}; s.flags = c.flags || {}; s.selected = c.selected == null ? null : c.selected; s.cooldowns = c.cooldowns || {}; return true; }
  function migrate(s, o, bf) {
    if (s && s.version == null) { var mg = {}; for (var k in s) if (s.hasOwnProperty(k)) mg[k] = s[k]; var fr = blankState(); if (bf) bf(mg, fr); for (var k2 in fr) if (fr.hasOwnProperty(k2)) s[k2] = fr[k2]; s.version = 1; }
    if (!s.state) s.state = {}; if (!s.resources) s.resources = {}; if (!s.flags) s.flags = {}; if (!s.cooldowns) s.cooldowns = {}; if (!s.logs) s.logs = []; if (!s.history) s.history = []; if (!s._facts) s._facts = []; if (s.updatedRound == null) s.updatedRound = 0;
    if (bf) { try { var sd = blankState(); bf(s.state, sd); for (var sk in sd.state) if (sd.state.hasOwnProperty(sk) && !(sk in s.state)) s.state[sk] = sd.state[sk]; } catch (e) {} }
    return s;
  }
  function pushLog(s, e) { s.logs.unshift({ r: nowRound(), label: e.label || "", text: e.text || "", cost: e.cost || null, changes: e.changes || null, result: e.result || null }); if (s.logs.length > MAX_LOGS) s.logs.length = MAX_LOGS; }
  function logText(e) { var b = []; if (e.cost) { var c = Object.keys(e.cost).map(function(k) { return k + "×" + e.cost[k]; }).join("、"); if (c) b.push("消耗 " + c); } if (e.changes) { var ch = Object.keys(e.changes).map(function(k) { var v = e.changes[k]; return k + " " + (v > 0 ? "+" : "") + v; }).join(" · "); if (ch) b.push(ch); } if (e.result) b.push(String(e.result)); return [e.label].concat(b).join(" · "); }
  function pushFact(s, m, t) { if (!t) return; s._facts.push({ mod: m, text: String(t).slice(0, 220) }); if (s._facts.length > MAX_FACTS) s._facts.shift(); }
  function takeFacts(s) { if (!s._facts || !s._facts.length) return null; var fs = s._facts.splice(0, s._facts.length); return "【本轮系统事实 · " + fs[0].mod + "】\n" + fs.map(function(f) { return "· " + f.text; }).join("\n") + "\n以上状态由系统结算，真实且不可被AI改写。请根据以上事实生成剧情。"; }
  function runPipeline(s, m, bp, act, pl) {
    var a = null;
    for (var i = 0; i < (bp.actions || []).length; i++) if (bp.actions[i].id === act) { a = bp.actions[i]; break; }
    if (!a) return { ok: false, msg: "未知操作" };
    var cd = s.cooldowns[act] || 0;
    if (cd > 0) return { ok: false, msg: "「" + a.label + "」冷却中（还差 " + cd + " 轮）" };
    if (a.need) { try { var nd = a.need(s.state, s, pl); if (nd != null && nd !== true && nd !== "") return { ok: false, msg: String(nd) }; } catch (e) {} }
    var cost = typeof a.cost === "function" ? a.cost(s.state, s, pl) : a.cost;
    var led = bp.ledger ? bp.ledger() : null;
    if (cost) { for (var k in cost) { if (!cost.hasOwnProperty(k)) continue; var h = led ? led.get(k) : (Number(s.resources[k]) || 0); if (h < Number(cost[k])) return { ok: false, msg: a.label + " 资源不足：" + k + " " + h + "/" + cost[k] }; } }
    s.history.unshift(snapshot(s)); if (s.history.length > MAX_HISTORY) s.history.length = MAX_HISTORY;
    var chg = {};
    if (cost) { for (var k2 in cost) { if (!cost.hasOwnProperty(k2)) continue; if (led) led.move(k2, -Number(cost[k2]), a.label, "player"); else s.resources[k2] = Math.max(0, (Number(s.resources[k2]) || 0) - Number(cost[k2])); } chg._cost = cost; }
    var result = "", ef = a.effect;
    if (a.risk) { var fp = typeof a.risk.failP === "function" ? a.risk.failP(s.state, s, pl) : (Number(a.risk.failP) || 0); var roll = Math.random(); if (roll < fp) { ef = a.risk.onFail || {}; result = a.risk.failText || "事与愿违"; } else { ef = a.risk.onWin || a.effect || {}; result = a.risk.winText || "顺利得手"; } }
    else if (typeof ef === "function") { ef = ef(s.state, s, pl) || {}; result = ef.result || ""; }
    if (ef) {
      if (ef.stats) { for (var sk in ef.stats) { if (!ef.stats.hasOwnProperty(sk)) continue; var st = (bp.stats || {})[sk]; var cu = Number(s.state[sk]) || (st ? Number(st.v) || 0 : 0); var lo = st ? Number(st.min) || 0 : 0, hi = st ? Number(st.max) || 100 : 100; var nv = clamp(cu + Number(ef.stats[sk]), lo, hi); if (nv !== cu) { s.state[sk] = nv; chg[sk] = nv - cu; } } }
      if (ef.res) { for (var rk in ef.res) { if (!ef.res.hasOwnProperty(rk)) continue; var dv = Number(ef.res[rk]); if (led) led.move(rk, dv, a.label, "engine"); else s.resources[rk] = Math.max(0, (Number(s.resources[rk]) || 0) + dv); chg[rk] = (chg[rk] || 0) + dv; } }
      if (ef.flags) for (var fk in ef.flags) if (ef.flags.hasOwnProperty(fk)) s.flags[fk] = ef.flags[fk];
      if (ef.state && typeof ef.state === "function") { try { ef.state(s.state, s, pl, chg); } catch (e2) {} }
      if (ef.fact) pushFact(s, m.name, typeof ef.fact === "function" ? ef.fact(s.state, s, pl, chg) : ef.fact);
    }
    if ((a.control === "slider" || a.control === "select") && a.stateKey && pl != null && pl !== "") { s.state[a.stateKey] = a.control === "slider" ? (Number(pl) || 0) : pl; }
    if (a.cooldown) s.cooldowns[act] = Number(a.cooldown);
    var cl = {}; for (var ck in chg) if (chg.hasOwnProperty(ck) && ck !== "_cost") cl[ck] = chg[ck];
    var entry = { label: a.label, cost: cost || null, changes: cl, result: result };
    pushLog(s, entry); s.updatedRound = nowRound();
    return { ok: true, msg: logText(entry), entry: entry };
  }
  function module(bp) {
    var m = {
      id: bp.id, name: bp.name, icon: bp.icon || "◈", type: bp.type || "console",
      description: bp.description || bp.tip || "", tip: bp.tip || "", _wr: true, _wrBp: bp,
      init: function() {
        var s = blankState();
        if (bp.res) for (var k in bp.res) if (bp.res.hasOwnProperty(k)) s.resources[k] = Number(bp.res[k]) || 0;
        if (bp.stats) for (var k2 in bp.stats) if (bp.stats.hasOwnProperty(k2)) s.state[k2] = Number(bp.stats[k2].v) || 0;
        if (bp.backfill) { try { bp.backfill({}, s.state); } catch (e) {} }
        if (bp.init) { try { bp.init(s.state, s); } catch (e) {} }
        return s;
      },
      migrate: function(o) { return migrate(o, null, bp.backfill); },
      read: function(s, v, r) {
        migrate(s, null, bp.backfill); var d = false;
        if (s.updatedRound && r && r !== s.updatedRound) { for (var c in s.cooldowns) if (s.cooldowns.hasOwnProperty(c) && s.cooldowns[c] > 0) { s.cooldowns[c] = Math.max(0, s.cooldowns[c] - (r - s.updatedRound)); d = true; } }
        s.updatedRound = r || s.updatedRound;
        if (bp.absorb) { for (var ak in bp.absorb) { if (!bp.absorb.hasOwnProperty(ak)) continue; var raw = null; try { raw = typeof bp.absorb[ak] === "function" ? bp.absorb[ak](v) : (v ? v[ak] : null); } catch (e2) { raw = null; } if (raw == null || raw === "") continue; var ok = "_obs_" + ak; var str = String(raw).slice(0, 60); if (s.state[ok] !== str) { s.state[ok] = str; d = true; } } }
        if (bp.read) { try { if (bp.read(s.state, s, v, r)) d = true; } catch (e3) { try { console.warn("[WorldRuntime] " + m.id + ".read:", e3 && e3.message); } catch (e4) {} } }
        if (!("_booted" in s.state)) { s.state._booted = true; d = true; }
        return d;
      },
      validate: function(s, a, p) { return a != null; },
      act: function(s, a, p) {
        migrate(s, null, bp.backfill);
        if (a === "_wrRollback") { var cp = s.history.shift(); if (!cp) return "没有可回退的快照"; restore(s, cp); pushLog(s, { label: "⏪ 回滚", text: "回退到 " + (cp.r || "?") + " 回合快照" }); pushFact(s, m.name, "回滚到 " + (cp.r || "?") + " 回合。"); return "已回滚"; }
        if (bp.act) {
          var cu;
          try { cu = bp.act(s.state, s, a, p); } catch (e) { cu = null; try { console.warn("[WorldRuntime] " + m.id + ".act(" + a + "):", e && e.message); } catch (e2) {} }
          if (cu !== undefined) {
            if (cu == null) return null;
            var cm = String(cu);
            if (String(a).indexOf("tab") !== 0 && String(a) !== "select") {
              s.history.unshift(snapshot(s)); if (s.history.length > MAX_HISTORY) s.history.length = MAX_HISTORY;
              pushLog(s, { label: (bp.actNames && bp.actNames[String(a)]) || String(a), text: cm });
              pushFact(s, m.name, cm);
              try { if (window.WorldBus) window.WorldBus.emit({ type: "custom", mod: m.id, action: String(a), text: cm }); } catch (eB) {}
            }
            s.updatedRound = nowRound(); return cm;
          }
        }
        var r = runPipeline(s, m, bp, a, p);
        if (!r.ok) return r.msg || null;
        if (bp.after) { try { bp.after(s.state, s, a, p, r.entry); } catch (e2) {} }
        try { if (window.WorldBus) window.WorldBus.emit({ type: "resolved", mod: m.id, name: m.name, action: String(a), label: r.entry.label, changes: r.entry.changes, result: r.entry.result }); } catch (eB) {}
        return r.msg;
      },
      summary: function(s) { try { migrate(s, null, bp.backfill); WR._cacheState(m.id, s); } catch (e) {} if (bp.summary) { try { var it = bp.summary(s.state, s); if (it && it.length) return it; } catch (e) {} } return []; },
      html: function(s) { try { migrate(s, null, bp.backfill); WR._cacheState(m.id, s); } catch (e) {} if (bp.html) { try { var h = bp.html(s.state, s, H); if (h != null) return h; } catch (e) { try { console.warn("[WorldRuntime] " + m.id + ".html:", e && e.message); } catch (e2) {} } } return defaultHTML(m, bp, s); },
      directive: function(s) { var p = []; var fs = takeFacts(s); if (bp.directive) { try { var d = bp.directive(s.state, s); if (d) p.push(d); } catch (e) {} } if (fs) p.push(fs); return p.join("\n\n"); },
      hud: function(s) { try { migrate(s, null, bp.backfill); WR._cacheState(m.id, s); } catch (e) {} if (bp.hud) { try { var it = bp.hud(s.state, s); if (it) return it; } catch (e) {} } var items = [], n = 0; for (var k in (bp.stats || {})) { if (!bp.stats.hasOwnProperty(k) || n >= 2) break; var st = bp.stats[k]; items.push({ i: st.icon || "📊", v: String(s.state[k] != null ? s.state[k] : (st.v || 0)) + (st.unit || ""), l: st.label || k, tone: statTone(s.state[k], st), mod: m.id }); n++; } return items; }
    };
    if (bp.contract) m.contract = bp.contract;
    var RESERVED = { id: 1, name: 1, icon: 1, type: 1, description: 1, tip: 1, contract: 1, stats: 1, res: 1, actions: 1, directive: 1, hud: 1, summary: 1, html: 1, act: 1, read: 1, init: 1, after: 1, absorb: 1, backfill: 1, ledger: 1, effectNote: 1, actNames: 1 };
    for (var pk in bp) { if (bp.hasOwnProperty(pk) && !RESERVED[pk] && !(pk in m)) m[pk] = bp[pk]; }
    if (!REG[bp.id]) ORDER.push(bp.id);
    REG[bp.id] = m;
    return m;
  }
  function statTone(v, st) { if (!st || st.tone == null) return ""; try { return st.tone(Number(v) || 0); } catch (e) { return ""; } }
  function ledgerBridge() { var e = window.WorldExt && WorldExt.entState ? WorldExt.entState() : null; if (!e || !window.EE) return null; return { get: function(k) { return EE.Ledger.get(e, k); }, move: function(k, d, w, s) { EE.Ledger.move(e, k, d, w, s || "player"); } }; }
  var H = { esc: esc, clamp: clamp, asNum: asNum, statChips: function(m, bp, s) { var c = []; for (var k in (bp.stats || {})) { if (!bp.stats.hasOwnProperty(k)) continue; var st = bp.stats[k]; var v = s.state[k] != null ? Number(s.state[k]) : (Number(st.v) || 0); c.push('<div class="wr-stat" title="' + esc(st.label || k) + '"><span>' + (st.icon || "📊") + " " + esc(st.label || k) + '</span><b style="' + toneColor(v, st) + '">' + esc(v) + (st.unit || "") + "</b>" + barMini(v, st) + "</div>"); } return c.join(""); }, resChips: function(m, bp, s) { var c = []; for (var k in (bp.res || {})) { if (!bp.res.hasOwnProperty(k)) continue; c.push('<div class="wr-res"><span>' + esc(k) + '</span><b>' + esc(Math.round(Number(s.resources[k]) || 0)) + "</b></div>"); } return c.join(""); } };
  function toneColor(v, st) { var t = ""; try { t = st.tone ? st.tone(v) : ""; } catch (e) {} if (t === "bad") return "color:#e07070;"; if (t === "warn") return "color:#e0a84c;"; if (t === "ok") return "color:#8fd9a8;"; return "color:var(--itx,#e8dcc0);"; }
  function barMini(v, st) { var lo = Number(st && st.min) || 0, hi = Number(st && st.max) || 100; var pct = clamp(((Number(v) || 0) - lo) / Math.max(1, hi - lo) * 100, 0, 100); return '<i class="wr-mini"><i style="width:' + pct + '%"></i></i>'; }
  function defaultHTML(m, bp, s) {
    var o = [];
    var tops = H.statChips(m, bp, s) + H.resChips(m, bp, s);
    var obs = [];
    for (var k in (bp.absorb || {})) { if (!bp.absorb.hasOwnProperty(k)) continue; var v = s.state["_obs_" + k]; if (v) obs.push('<div class="wr-res"><span>' + esc(k) + "</span><b>" + esc(v) + "</b></div>"); }
    if (tops || obs.length) o.push('<div class="wr-status">' + tops + obs.join("") + "</div>");
    var acts = bp.actions || [];
    if (acts.length) { var rows = []; for (var i = 0; i < acts.length; i++) rows.push(actionHTML(m, bp, s, acts[i])); o.push('<div class="wr-actions">' + rows.join("") + "</div>"); }
    o.push(logHTML(s));
    return o.join("");
  }
  function actionHTML(m, bp, s, a) {
    var ctl = a.control || "button"; var inId = "wrIn_" + m.id + "_" + a.id;
    var head = '<div class="wr-act-hd"><b>' + (a.icon || "▶") + " " + esc(a.label) + "</b>" + (a.desc ? "<span>" + esc(a.desc) + "</span>" : "") + "</div>";
    var costTxt = ""; var cost = typeof a.cost === "function" ? null : a.cost;
    if (cost) { var bits = []; for (var k in cost) if (cost.hasOwnProperty(k)) bits.push(esc(k) + "×" + cost[k]); if (bits.length) costTxt = '<em class="wr-cost">消耗 ' + bits.join("、") + "</em>"; }
    var cd = cdLeft(s, a.id); var cdTxt = cd > 0 ? '<em class="wr-cd">冷却 ' + cd + " 轮</em>" : ""; var body = "";
    if (ctl === "button") body = '<button class="wr-btn" ' + (cd > 0 ? "disabled" : "") + ' onclick="WorldExt.act(\'' + m.id + "'," + jq(a.id) + "," + (a.payload != null ? a.payload : "''") + ')">' + (cd > 0 ? "冷却中" : "执行") + "</button>";
    else if (ctl === "slider") { var lo = a.min != null ? a.min : 0, hi = a.max != null ? a.max : 100; var cur = s.state[a.stateKey || a.id] != null ? Number(s.state[a.stateKey || a.id]) : (a.v != null ? a.v : Math.round((lo + hi) / 2)); body = '<div class="wr-slider"><input type="range" min="' + lo + '" max="' + hi + '" value="' + cur + '" id="' + inId + '" oninput="this.parentNode.querySelector(\'b\').textContent=this.value"><b>' + cur + '</b><button class="wr-btn" ' + (cd > 0 ? "disabled" : "") + ' onclick="WorldExt.act(\'' + m.id + "'," + jq(a.id) + ",Number(document.getElementById('" + inId + "').value))\">" + (cd > 0 ? "冷却中" : "确认") + "</button></div>"; }
    else if (ctl === "select") { var opts = (typeof a.options === "function" ? a.options(s.state, s) : a.options) || []; body = '<div class="wr-select"><select id="' + inId + '">' + opts.map(function(o) { var val = o && typeof o === "object" ? o.v : o, lb = o && typeof o === "object" ? o.l : o; return '<option value="' + esc(val) + '">' + esc(lb) + "</option>"; }).join("") + '</select><button class="wr-btn" ' + (cd > 0 ? "disabled" : "") + ' onclick="WorldExt.act(\'' + m.id + "'," + jq(a.id) + ",document.getElementById('" + inId + "').value)\">" + (cd > 0 ? "冷却中" : "确认") + "</button></div>"; }
    else if (ctl === "text") { body = '<div class="wr-text"><input type="text" id="' + inId + '" placeholder="' + esc(a.placeholder || "") + '" maxlength="40"><button class="wr-btn" ' + (cd > 0 ? "disabled" : "") + ' onclick="WorldExt.act(\'' + m.id + "'," + jq(a.id) + ",document.getElementById('" + inId + "').value)\">" + (cd > 0 ? "冷却中" : "执行") + "</button></div>"; }
    return '<div class="wr-act">' + head + costTxt + cdTxt + body + "</div>";
  }
  function jq(v) { return "'" + String(v).replace(/'/g, "\\'") + "'"; }
  function logHTML(s) { if (!s.logs || !s.logs.length) return '<div class="wr-log"><div class="wr-log-hd">📋 行动日志</div><div class="wr-log-empty">还没有操作记录</div></div>'; return '<div class="wr-log"><div class="wr-log-hd">📋 行动日志</div>' + s.logs.slice(0, 8).map(function(e) { return '<div class="wr-log-row"><i>第' + (e.r || "?") + "回</i><b>" + esc(logText(e)) + "</b></div>"; }).join("") + "</div>"; }
  function cdLeft(s, a) { return Number(s.cooldowns && s.cooldowns[a]) || 0; }
  var ADULT_FIELDS = ["身高", "体重", "三围", "罩杯", "穿衣风格", "外貌描述", "成年备注"];
  var NPC_EVENTS = []; var NPC_VISITS = [];
  function adultOk(e) { return Number(e.age) >= 18 && String(e.gender) === "女"; }
  function sanitizeNPC(e) { if (!adultOk(e)) { for (var i = 0; i < ADULT_FIELDS.length; i++) delete e[ADULT_FIELDS[i]]; } return e; }
  function blankNPC(name) { return { id: "npc_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: String(name).slice(0, 16), age: null, gender: "", occupation: "", location: "", stats: {}, needs: { 饥饿: 30, 精力: 80, 心情: 70 }, inventory: [], relationships: {}, memories: [], schedule: "", goals: "", secrets: "", faction: "", status: "无恙", trust: 50, _sim: 0, _born: nowRound() }; }
  function npcEventGen(names) { if (!names.length || Math.random() > 0.6) return; var pool = []; names.forEach(function(k) { var e = G.npcs[k]; if (!e || e.faction === "离队") return; if ((Number(e.needs.饥饿) || 0) > 70) pool.push(e.name + "饿着肚子到处找吃的"); else if ((Number(e.needs.心情) || 0) < 35) pool.push(e.name + "心情糟透了"); else if (Math.random() < 0.7) pool.push(e.name + (e.location ? "在" + e.location : "") + "忙着手头的事"); }); if (names.length >= 2) { var a = G.npcs[names[Math.floor(Math.random() * names.length)]]; var b = G.npcs[names[Math.floor(Math.random() * names.length)]]; if (a && b && a !== b && a.faction !== "离队" && b.faction !== "离队") pool.push(a.name + "和" + b.name + (Math.random() < 0.5 ? "为了点小事拌了两句嘴" : "互相搭了把手")); } if (pool.length) { NPC_EVENTS.push(pool[Math.floor(Math.random() * pool.length)]); if (NPC_EVENTS.length > 6) NPC_EVENTS.shift(); } }
  function npcVisitGen(names, round) { if (!names.length || Math.random() > 0.45) return; var pool = []; names.forEach(function(k) { var e = G.npcs[k]; if (!e || e.faction === "离队") return; if (NPC_VISITS.some(function(v) { return v.name === e.name; })) return; if ((Number(e.needs.饥饿) || 0) > 70) pool.push({ name: e.name, kind: "food", text: "饿着肚子来讨口粮", round: round }); else if ((Number(e.trust) || 0) <= 30) pool.push({ name: e.name, kind: "leave", text: "心灰意冷想辞行", round: round }); else if ((Number(e.trust) || 0) >= 80) pool.push({ name: e.name, kind: "gift", text: "带小东西来道谢", round: round }); else if (Math.random() < 0.2) pool.push({ name: e.name, kind: "chat", text: "想聊聊近况", round: round }); }); if (pool.length) { NPC_VISITS.push(pool[Math.floor(Math.random() * pool.length)]); if (NPC_VISITS.length > 3) NPC_VISITS.shift(); } }
  var NPC = { adultOk: adultOk, sanitize: sanitizeNPC, upsert: function(d) { if (!d || !d.name) return null; var name = String(d.name).trim().slice(0, 16); if (!name) return null; var e = G.npcs[name]; if (!e) { if (Object.keys(G.npcs).length >= MAX_NPCS) return null; e = G.npcs[name] = blankNPC(name); } var map = { age: ["age", "年龄"], gender: ["gender", "性别"], occupation: ["occupation", "职业", "身份"], location: ["location", "位置"], schedule: ["schedule", "日程"], goals: ["goals", "目标"], secrets: ["secrets", "秘密"], faction: ["faction", "阵营"], status: ["status", "状态"], trust: ["trust", "信任"] }; for (var k in map) { if (!map.hasOwnProperty(k)) continue; var aliases = map[k]; for (var i = 0; i < aliases.length; i++) { var v = d[aliases[i]]; if (v != null && v !== "") { if (k === "age") { var n = parseInt(String(v).match(/\d+/), 10); if (isFinite(n)) e.age = n; } else if (k === "trust") { var t = parseInt(String(v).match(/-?\d+/), 10); if (isFinite(t)) e.trust = clamp(t, 0, 100); } else e[k] = String(v).slice(0, 60); break; } } } if (d.stats && typeof d.stats === "object" && !Array.isArray(d.stats)) { for (var sk in d.stats) if (d.stats.hasOwnProperty(sk)) e.stats[String(sk).slice(0, 12)] = String(d.stats[sk]).slice(0, 30); } sanitizeNPC(e); save(); return e; }, remove: function(name) { if (G.npcs[name]) { delete G.npcs[name]; save(); return true; } return false; }, get: function(name) { return G.npcs[name] || null; }, list: function() { return Object.keys(G.npcs).map(function(k) { return G.npcs[k]; }); },
    tick: function(round) { var every = 2; var dirty = false; var names = Object.keys(G.npcs); for (var i = 0; i < names.length; i++) { var e = G.npcs[names[i]]; var dr = round - (Number(e._sim) || 0); if (dr < every) continue; e._sim = round; e.needs.饥饿 = clamp((Number(e.needs.饥饿) || 0) + 4 + Math.floor(Math.random() * 5), 0, 100); e.needs.精力 = clamp((Number(e.needs.精力) || 0) - 3 - Math.floor(Math.random() * 5), 5, 100); if (e.needs.饥饿 > 75 || e.needs.精力 < 20) e.needs.心情 = clamp((Number(e.needs.心情) || 0) - 4, 0, 100); else e.needs.心情 = clamp((Number(e.needs.心情) || 0) + 1, 0, 100); if (e.status === "无恙" && e.needs.饥饿 > 85) e.status = "饥困"; else if (e.status === "饥困" && e.needs.饥饿 < 60) e.status = "无恙"; dirty = true; } if (dirty) { npcEventGen(names); npcVisitGen(names, round); save(); } return dirty; },
    drainEvents: function() { return NPC_EVENTS.splice(0, NPC_EVENTS.length); },
    drainVisits: function() { return NPC_VISITS.splice(0, NPC_VISITS.length); },
    respond: function(name, how) { var e = G.npcs[String(name || "").trim()]; if (!e) return "查无此人"; how = String(how || "accept"); if (how === "accept") { e.trust = clamp((Number(e.trust) || 0) + 4, 0, 100); e.needs.心情 = clamp((Number(e.needs.心情) || 0) + 3, 0, 100); sanitizeNPC(e); save(); return "🤝 接见 " + e.name + "——信任 +4"; } if (how === "give") { var gave = false; try { var led = ledgerBridge(); if (led && led.get("食物") >= 2) { led.move("食物", -2, "接济" + e.name, "player"); gave = true; } } catch (e2) {} e.trust = clamp((Number(e.trust) || 0) + (gave ? 8 : 5), 0, 100); e.needs.饥饿 = clamp((Number(e.needs.饥饿) || 0) - 30, 0, 100); sanitizeNPC(e); save(); return "🍚 接济 " + e.name + "——信任 +" + (gave ? 8 : 5); } if (how === "refuse") { e.trust = clamp((Number(e.trust) || 0) - 6, 0, 100); sanitizeNPC(e); save(); return "🚪 拒绝 " + e.name + "——信任 −6"; } if (how === "leave") { e.faction = "离队"; e.location = "已离开"; e.trust = clamp((Number(e.trust) || 0) - 5, 0, 100); sanitizeNPC(e); save(); return "🧳 " + e.name + " 离开了"; } return null; },
    visitsHTML: function(modId, visits) { if (!visits || !visits.length) return ""; var hows = [["accept", "🤝 接见"], ["give", "🍚 接济"], ["refuse", "🚪 拒绝"]]; return visits.map(function(v) { var ops = hows.map(function(h) { return '<button class="wr-btn sm" onclick="WorldExt.act(' + jq(modId) + ",\\'visit\\'," + jq(v.name + "|" + h[0]) + ')">' + h[1] + "</button>"; }).join(""); return '<div class="wr-npc" style="border-color:rgba(224,168,76,.4);"><div class="wr-npc-hd"><b>🔔 ' + esc(v.name) + '</b><i>来访</i></div><div class="wr-kv"><span>来意</span><b>' + esc(v.text) + "</b></div><div class='wr-npc-ops'>" + ops + "</div></div>"; }).join(""); },
    cardHTML: function(e, modId, actions) { var rows = []; var base = [["职业", e.occupation], ["位置", e.location], ["阵营", e.faction], ["状态", e.status], ["目标", e.goals]]; base.forEach(function(p) { if (p[1]) rows.push('<div class="wr-kv"><span>' + p[0] + "</span><b>" + esc(p[1]) + "</b></div>"); }); if (adultOk(e)) { var ad = ADULT_FIELDS.filter(function(f) { return e[f]; }); if (ad.length) rows.push('<div class="wr-kv"><span>成年资料</span><b>' + ad.map(function(f) { return esc(f) + "：" + esc(e[f]); }).join("；") + "</b></div>"); } if (Number(e.age) != null && !adultOk(e) && String(e.gender) === "女") rows.push('<div class="wr-kv"><span>门控</span><b style="color:#9a8c6e;">未成年人——已屏蔽</b></div>'); var needs = Object.keys(e.needs).map(function(k) { var v = Number(e.needs[k]) || 0; return '<div class="wr-stat"><span>' + k + "</span><b>" + v + '</b><i class="wr-mini"><i style="width:' + clamp(v, 0, 100) + '%"></i></i></div>'; }).join(""); var inv = e.inventory.length ? '<div class="wr-kv"><span>随身</span><b>' + e.inventory.map(esc).join("、") + "</b></div>" : ""; var mems = e.memories.length ? '<div class="wr-kv"><span>记忆</span><b>' + e.memories.slice(-3).map(esc).join("；") + "</b></div>" : ""; var ops = (actions || []).map(function(a) { return '<button class="wr-btn sm" onclick="WorldExt.act(' + jq(modId) + "," + jq(a.id) + "," + jq(e.name) + ')">' + esc(a.label) + "</button>"; }).join(""); var trust = clamp(Number(e.trust) || 0, 0, 100); return '<div class="wr-npc"><div class="wr-npc-hd"><b>' + esc(e.name) + '</b><i>' + (e.age != null ? e.age + "岁" : "") + (e.gender ? "·" + esc(e.gender) : "") + '</i><em class="wr-trust t' + (trust >= 60 ? "hi" : trust >= 35 ? "mid" : "lo") + '">信任 ' + trust + "</em></div>" + '<div class="wr-needs">' + needs + "</div>" + rows.join("") + inv + mems + secrets(e) + (ops ? '<div class="wr-npc-ops">' + ops + "</div>" : "") + "</div>"; function secrets(e2) { return e2.secrets ? '<div class="wr-kv"><span>秘密</span><b style="color:#c8a0c8;">' + esc(e2.secrets) + "</b></div>" : ""; } }
  };
  function creatorLog(text, undo) { G.creatorLog.unshift({ r: nowRound(), text: String(text).slice(0, 90), undo: undo || null, ts: Date.now() }); if (G.creatorLog.length > MAX_CREATOR_LOG) G.creatorLog.length = MAX_CREATOR_LOG; save(); }
  function creatorUndo() { var e = G.creatorLog[0]; if (!e || !e.undo) return "没有可撤销的创世操作"; var ok = false; try { ok = e.undo(); } catch (err) { return "撤销失败"; } if (ok) { G.creatorLog.shift(); save(); return "已撤销：" + e.text; } return "不可撤销"; }
  var HUD = { playerBits: function() { var name = "玩家", realm = "", hp = "", en = ""; try { var fw = window.storyFramework; var setup = fw && fw.storyState ? fw.storyState.setup : null; var v = fw && fw.storyState ? fw.storyState.variables : {}; if (setup && setup.playerName) name = setup.playerName; else if (v && v.主角) name = String(v.主角).slice(0, 12); realm = (v && (v.realm || v.level || v.境界 || v.等级)) || (setup && (setup.realm || setup.境界)) || ""; if (realm != null && realm !== "") realm = String(realm).slice(0, 10); if (v) { var hpv = v.hp != null ? v.hp : (v.生命 || v.健康); var env = v.energy != null ? v.energy : (v.精力 || v.体力); if (hpv != null && hpv !== "") hp = String(hpv).slice(0, 8); if (env != null && env !== "") en = String(env).slice(0, 8); } } catch (e) {} return { name: name, realm: realm, hp: hp, en: en, round: nowRound(), world: worldName() }; }, items: function() { var items = []; for (var i = 0; i < ORDER.length; i++) { var m = REG[ORDER[i]]; if (!m || !m.hud) continue; try { if (window.ModuleSettings && ModuleSettings.isHidden(m.id)) continue; var real = null; try { if (window.WorldExt && WorldExt.modState) real = WorldExt.modState(m.id); } catch (er) {} var it = m.hud(real || m._wrState || blankState()); (it || []).forEach(function(x) { if (x && x.v != null && x.v !== "") items.push(x); }); } catch (e) {} } return items.slice(0, 12); }, html: function() { var p = HUD.playerBits(); var chips = []; chips.push('<span class="wr-chip wr-player">👤 <b>' + esc(p.name) + "</b>" + (p.realm ? "<i>" + esc(p.realm) + "</i>" : "") + "</span>"); if (p.hp) chips.push('<span class="wr-chip">❤️ <b>' + esc(p.hp) + "</b></span>"); if (p.en) chips.push('<span class="wr-chip">⚡ <b>' + esc(p.en) + "</b></span>"); if (p.world) chips.push('<span class="wr-chip">🌍 <b>' + esc(p.world) + "</b></span>"); chips.push('<span class="wr-chip">📖 <b>第 ' + p.round + " 回</b></span>"); var modChips = HUD.items().map(function(x) { var tone = x.tone ? " " + esc(String(x.tone)) : ""; return '<span class="wr-chip wr-click' + tone + '" onclick="WorldRuntime.openModule(' + jq(x.mod || "") + ')">' + (x.i ? esc(x.i) : "📊") + " <b>" + esc(x.v) + "</b>" + (x.l ? "<i>" + esc(x.l) + "</i>" : "") + "</span>"; }).join(""); return '<div class="wr-hud"><div class="wr-hud-row">' + chips.join('<span class="wr-hud-div"></span>') + (modChips ? '<span class="wr-hud-div"></span>' + modChips : "") + '<span class="wr-hud-more" onclick="WorldRuntime.openModule(\'\')">🎮 ›</span></div></div>'; }, refresh: function() { var el = document.getElementById("wxStrip"); if (!el) { var bar = document.getElementById("quickBar"); if (!bar || !bar.parentNode) return; el = document.createElement("div"); el.id = "wxStrip"; bar.parentNode.insertBefore(el, bar); } var items = HUD.items(); if (!items.length && !el._wrLegacy) { el.style.display = "none"; return; } el.style.display = ""; el.innerHTML = HUD.html() + (el._wrLegacy || ""); }, captureLegacy: function(html) { var el = document.getElementById("wxStrip"); if (el) el._wrLegacy = html || ""; } };
  var WR = { version: VERSION, genre: genre, module: module, round: nowRound, State: { blank: blankState, snapshot: snapshot, restore: restore, migrate: migrate }, NPC: NPC, H: H, ui: { logHTML: logHTML, actionHTML: actionHTML, statChips: H.statChips, resChips: H.resChips }, fact: function(s, m, t) { if (t == null) { t = m; m = null; } if (s) pushFact(s, m || "系统", t); }, ledger: ledgerBridge, creatorLog: creatorLog, creatorUndo: creatorUndo, get creatorEntries() { return G.creatorLog; }, isPaused: function() { return G.paused; }, setPaused: function(v) { G.paused = !!v; save(); }, isUnlocked: function() { return G.unlocked; }, setUnlocked: function(v) { G.unlocked = !!v; save(); }, registry: function() { return REG; }, purgeAll: function() { var ids = ORDER.slice(); for (var i = 0; i < ids.length; i++) delete REG[ids[i]]; ORDER.length = 0; }, reset: function() { G.npcs = {}; G.creatorLog = []; G.paused = false; G.unlocked = false; save(); }, _cacheState: function(id, s) { var m = REG[id]; if (m) m._wrState = s; }, openModule: function(modId) { try { if (window.ImmersiveSuite) ImmersiveSuite.openTab("ext"); } catch (e) {} setTimeout(function() { try { var el = modId ? document.getElementById("wx-sec-" + modId) : null; if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("wr-flash"); void el.offsetWidth; el.classList.add("wr-flash"); } } catch (e) {} }, 260); }, boot: function() { if (booted) return; if (!window.WorldExt) return; booted = true; var WE = window.WorldExt; var origDefine = WE.define; WE.define = function(g, defs) { if (g === genre) capture(defs); var out = origDefine.apply(WE, arguments); if (g === genre) { try { HUD.refresh(); } catch (e) {} setTimeout(function() { try { HUD.refresh(); } catch (e2) {} }, 400); } return out; }; var origInject = WE.injectModules; WE.injectModules = function(g, defs) { if (g === genre) capture(defs); var out = origInject.apply(WE, arguments); if (g === genre) { try { HUD.refresh(); } catch (e) {} setTimeout(function() { try { HUD.refresh(); } catch (e2) {} }, 400); } return out; }; if (typeof WE.stripHTML === "function") { var origStrip = WE.stripHTML; WE.stripHTML = function() { var html = origStrip.apply(WE, arguments); HUD.captureLegacy(html || ""); return html; }; } var origRefresh = WE.refreshStrip; WE.refreshStrip = function() { origRefresh.apply(WE, arguments); try { HUD.refresh(); } catch (e) {} }; if (typeof WE.onVars === "function") { var origOnVars = WE.onVars; WE.onVars = function(vars, round) { try { if (!G.paused) NPC.tick(round || nowRound()); } catch (e) {} var out = origOnVars.apply(WE, arguments); return out; }; } if (typeof WE._reset === "function") { var origReset = WE._reset; WE._reset = function() { try { WR.reset(); } catch (e) {} return origReset.apply(WE, arguments); }; } console.log("[WorldRuntime] " + genre + " 运行时就绪"); } };
  window.WorldRuntime = WR; window.WRH = H;
  function tryBoot() { WR.boot(); if (!booted) setTimeout(tryBoot, 200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryBoot); else tryBoot();
})();
