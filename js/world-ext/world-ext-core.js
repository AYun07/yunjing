(function() {
  "use strict";
  const VERSION = "v3.36.1";
  const genre = (() => {
    try {
      return new URLSearchParams(location.search).get("genre") || "free";
    } catch (e) {
      return "free";
    }
  })();
  const STORE = `worldExt_${genre}`;
  const $id = (i) => document.getElementById(i);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function asArr(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map((x) => typeof x === "object" && x ? x.name || x.title || x.名称 || JSON.stringify(x) : String(x)).filter(Boolean);
    if (typeof v === "string") return v.split(/[、,，;；\n]/).map((s) => s.trim()).filter(Boolean);
    if (typeof v === "object") return Object.keys(v).map((k) => `${k}${v[k] && typeof v[k] === "string" && v[k].length <= 20 ? "：" + v[k] : ""}`);
    return [];
  }
  function asObj(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const o = JSON.parse(v);
        return o && typeof o === "object" ? o : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }
  function asNum(v, dflt) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : dflt;
  }
  function pick(vars, keys) {
    if (!vars) return void 0;
    for (const k of keys) if (vars[k] != null && vars[k] !== "") return vars[k];
    return void 0;
  }
  function bar(v, color, label) {
    const n = Math.max(0, Math.min(100, Number(v) || 0));
    return `<div class="wx-bar"><i style="width:${n}%;background:${color};"></i></div>` + (label != null ? `<b class="wx-bar-num" style="color:${color};">${esc(label)}</b>` : "");
  }
  function gauge(v, zones, unit) {
    let n = Math.max(0, Math.min(100, Number(v) || 0));
    let z = zones[zones.length - 1];
    for (const t of zones) {
      if (n <= t.max) {
        z = t;
        break;
      }
    }
    return {
      zone: z,
      html: `<div class="wx-gauge">
                <div class="wx-gauge-zones">${zones.map((t) => `<span style="flex:${t.max - (t.min || 0)};background:${t.color};opacity:${t === z ? 1 : 0.28};" title="${esc(t.label)}"></span>`).join("")}</div>
                <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${n}%;background:${z.color};"></i></div>
                <b style="color:${z.color};">${n}${unit || ""}</b><em style="color:${z.color};">${esc(z.label)}</em></div>
            </div>`
    };
  }
  function kv(pairs) {
    return `<div class="wx-kvs">` + pairs.filter((p) => p && p[1] != null && p[1] !== "").map((p) => `<div class="wx-kv"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join("") + `</div>`;
  }
  function chips(arr, color) {
    const a = asArr(arr);
    return a.length ? `<div class="wx-chips">${a.map((x) => `<i style="--wc:${color || "var(--ip,#c9a86a)"};">${esc(x)}</i>`).join("")}</div>` : "";
  }
  function empty(icon, msg, hint) {
    return `<div class="wx-empty"><b>${icon}</b><p>${esc(msg)}</p><small>${esc(hint || "")}</small></div>`;
  }
  function card(title, inner, opts) {
    const o = opts || {};
    if (!inner) return "";
    return `<div class="wx-card${o.grow ? " grow" : ""}">
            <div class="wx-card-hd"><span>${o.icon || "◈"}</span><b>${esc(title)}</b>${o.tag ? `<i class="wx-tag">${esc(o.tag)}</i>` : ""}</div>
            <div class="wx-card-bd">${inner}</div></div>`;
  }
  const H = { esc, asArr, asObj, asNum, pick, bar, gauge, kv, chips, empty, card };
  let modules = [];
  let mods = {};
  let booted = false;
  let ent = null;
  let entMod = null;
  let dayEvents = [];
  let pending = [];
  function mergeDefs(base, extra) {
    const out = base.slice();
    for (const d of extra || []) {
      const i = out.findIndex((m) => m && m.id === d.id);
      if (i >= 0) out[i] = d;
      else out.push(d);
    }
    return out;
  }
  function visible(m) {
    try {
      return !(window.ModuleSettings && ModuleSettings.isHidden(m.id));
    } catch (e) {
      return true;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.mods) mods = d.mods;
        if (d && d.ent && d.ent.ledger) ent = d.ent;
      }
    } catch (e) {
      mods = {};
      ent = null;
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ version: VERSION, mods, ent: ent || void 0 }));
    } catch (e) {
    }
  }
  function ensureState(mod) {
    if (!(mod.id in mods)) {
      try {
        mods[mod.id] = mod.init ? mod.init() : {};
      } catch (e) {
        mods[mod.id] = {};
      }
    }
    if (!mods[mod.id] || typeof mods[mod.id] !== "object") mods[mod.id] = {};
    return mods[mod.id];
  }
  function injectStyle() {
    if ($id("wxStyle")) return;
    const st = document.createElement("style");
    st.id = "wxStyle";
    st.textContent = `
.wx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
.wx-card{background:rgba(255,255,255,.035);border:1px solid var(--ip,#c9a86a)30;border-radius:12px;padding:12px 14px;min-width:0}
.wx-card.grow{grid-column:1/-1}
.wx-card-hd{display:flex;align-items:center;gap:7px;margin-bottom:9px}
.wx-card-hd span{font-size:15px}
.wx-card-hd b{font-size:13.5px;color:var(--ip,#c9a86a);letter-spacing:1px}
.wx-tag{margin-left:auto;font-size:10.5px;padding:1px 8px;border-radius:8px;background:var(--ip,#c9a86a)22;color:var(--ip,#c9a86a);font-style:normal}
.wx-kvs{display:flex;flex-direction:column;gap:5px}
.wx-kv{display:flex;gap:8px;font-size:12.5px;align-items:baseline}
.wx-kv span{color:var(--imt,#9a8c6e);flex:0 0 62px}
.wx-kv b{color:var(--itx,#e8dcc0);font-weight:500;word-break:break-all}
.wx-bar{position:relative;height:6px;border-radius:3px;background:var(--ip,#c9a86a)1c;overflow:hidden;flex:1}
.wx-bar i{display:block;height:100%;border-radius:3px;transition:width .5s}
.wx-bar.big{height:10px}
.wx-bar-num{font-size:12px;font-variant-numeric:tabular-nums}
.wx-gauge{margin:4px 0}
.wx-gauge-zones{display:flex;gap:2px;height:4px;border-radius:2px;overflow:hidden;margin-bottom:5px}
.wx-gauge-zones span{display:block;height:100%}
.wx-gauge-main{display:flex;align-items:center;gap:9px}
.wx-gauge-main em{font-style:normal;font-size:11.5px;letter-spacing:1px}
.wx-chips{display:flex;flex-wrap:wrap;gap:5px}
.wx-chips i{font-style:normal;font-size:11.5px;padding:2px 9px;border-radius:9px;background:color-mix(in srgb,var(--wc) 15%,transparent);border:1px solid color-mix(in srgb,var(--wc) 45%,transparent);color:var(--wc,#c9a86a)}
.wx-empty{text-align:center;padding:26px 12px;color:var(--imt,#9a8c6e)}
.wx-empty b{font-size:26px;display:block;margin-bottom:8px;opacity:.7}
.wx-empty p{font-size:13px;margin-bottom:5px;color:var(--itx,#d8cba8)}
.wx-empty small{font-size:11px;opacity:.75;line-height:1.7;display:block}
.wx-mirror{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch}
.wx-mirror-side{border:1px dashed var(--ip,#c9a86a)38;border-radius:10px;padding:10px;min-width:0}
.wx-mirror-side h4{font-size:12.5px;color:var(--ip,#c9a86a);margin-bottom:7px;letter-spacing:1px}
.wx-mirror-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:34px}
.wx-mirror-mid b{font-size:17px}
.wx-reson{animation:wxPulse 1.6s infinite}
@keyframes wxPulse{0%,100%{opacity:.55}50%{opacity:1}}
.wx-matrix-wrap{overflow-x:auto}
table.wx-matrix{border-collapse:collapse;width:100%;font-size:12px;min-width:420px}
.wx-matrix th{color:var(--imt,#9a8c6e);font-weight:500;padding:5px 7px;text-align:left;white-space:nowrap}
.wx-matrix th.sus{color:var(--ip,#c9a86a);cursor:pointer;max-width:92px;overflow:hidden;text-overflow:ellipsis}
.wx-matrix td{padding:4px 7px;border-top:1px solid var(--ip,#c9a86a)1a}
.wx-matrix td.cell{width:26px;height:22px;cursor:pointer;text-align:center;color:var(--ip,#c9a86a);user-select:none}
.wx-matrix td.cell.on{background:var(--ip,#c9a86a)2e;border-radius:5px}
.wx-accuse{margin:10px 0 2px;width:100%;padding:8px;border-radius:9px;border:1px solid #e0707055;background:#e0707018;color:#e8a0a0;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.wx-accuse:hover{background:#e0707028}
.wx-banner{border:1px solid var(--ip,#c9a86a)45;border-radius:10px;padding:9px 12px;font-size:12.5px;background:var(--ip,#c9a86a)12;margin-top:9px;line-height:1.7}
.wx-rings{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.wx-ring{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;color:#111;font-weight:700;border:2px solid rgba(0,0,0,.35)}
.wx-ring.ghost{border:2px dashed var(--imt,#9a8c6e);color:var(--imt,#9a8c6e);background:none;font-weight:400}
.wx-slot{display:flex;gap:6px;align-items:center;margin-top:9px}
.wx-slot input,.wx-slot select{flex:1;background:rgba(0,0,0,.3);border:1px solid var(--ip,#c9a86a)38;color:var(--itx,#e8dcc0);border-radius:8px;padding:6px 9px;font-size:12px;outline:none;min-width:0}
.wx-btn{border:1px solid var(--ip,#c9a86a)55;background:var(--ip,#c9a86a)18;color:var(--ip,#c9a86a);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;letter-spacing:1px}
.wx-btn:hover{background:var(--ip,#c9a86a)2a}
.wx-btn.danger{border-color:#e0707055;background:#e0707018;color:#e8a0a0}
.wx-stepper{display:flex;gap:4px;align-items:center}
.wx-step{flex:1;text-align:center;font-size:11.5px;padding:6px 2px;border-radius:8px;border:1px solid var(--ip,#c9a86a)25;color:var(--imt,#9a8c6e);position:relative}
.wx-step.on{border-color:var(--ip,#c9a86a);color:var(--ip,#c9a86a);background:var(--ip,#c9a86a)16;font-weight:600}
.wx-step.done{color:var(--itx,#d8cba8);border-color:var(--ip,#c9a86a)45}
.wx-task{display:flex;gap:9px;align-items:baseline;border-top:1px dashed var(--imt,#9a8c6e)30;padding:8px 2px;font-size:12.5px}
.wx-task:first-child{border-top:none}
.wx-task b{color:var(--itx,#e8dcc0);font-weight:500;flex:1}
.wx-task .st{font-size:10.5px;padding:1px 8px;border-radius:8px;white-space:nowrap}
.wx-idx{display:inline-flex;width:22px;height:22px;border-radius:6px;background:var(--ip,#c9a86a)1e;color:var(--ip,#c9a86a);font-size:11px;align-items:center;justify-content:center;margin-right:3px}
.wx-fire{display:inline-flex;flex-direction:column;align-items:center;gap:3px;width:64px;padding:7px 2px;border-radius:9px;border:1px solid var(--ip,#c9a86a)22;color:var(--imt,#9a8c6e);font-size:10px}
.wx-fire.on{border-color:#e0707088;background:#e0707014;color:#e8b08a}
.wx-fire b{font-size:10.5px;color:inherit;line-height:1.3;text-align:center}
.wx-tip{font-size:11.5px;color:var(--imt,#9a8c6e);line-height:1.7;margin-bottom:10px}
.wx-del{background:none;border:none;color:#e0707099;cursor:pointer;font-size:13px;padding:0 3px}
/* v3.32.2 主界面常驻多模块状态板（ws-*）：第一行各界专属模块指标（summary 协议汇总），
   第二行实体引擎家底——点击整卡直开界专属操作台（玩家反馈：模块功能埋抽屉太深、布局要美观） */
#wxStrip{margin:0 0 8px}
.ws-board{display:flex;flex-direction:column;gap:8px;padding:10px 14px;border-radius:14px;cursor:pointer;
    border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 32%,transparent);
    background:linear-gradient(135deg,color-mix(in srgb,var(--ip,#c9a86a) 13%,transparent),color-mix(in srgb,var(--ip,#c9a86a) 4%,transparent));
    transition:border-color .25s,transform .15s;user-select:none}
.ws-board:hover{border-color:color-mix(in srgb,var(--ip,#c9a86a) 68%,transparent);transform:translateY(-1px)}
.ws-board:active{transform:translateY(0)}
.ws-mods{display:flex;flex-wrap:wrap;align-items:center;gap:10px;row-gap:6px}
.ws-grp{display:inline-flex;align-items:center;gap:5px;cursor:inherit}
.ws-gi{font-size:14px;line-height:1}
.ws-gv{font-size:13px;font-weight:700;color:var(--itx,#e8dcc0);font-variant-numeric:tabular-nums;letter-spacing:.3px}
.ws-gv.cold{color:#7ad8e8}
.ws-gv.warn{color:#e0a84c}
.ws-gv.bad{color:#e07070}
.ws-gv.ok{color:#8fd9a8}
.ws-gl{font-size:11px;color:var(--imt,#9a8c6e);letter-spacing:.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-div{width:1px;height:15px;background:color-mix(in srgb,var(--ip,#c9a86a) 26%,transparent);flex:0 0 auto}
.ws-more{margin-left:auto;font-size:11px;color:var(--ip,#c9a86a);opacity:.75;letter-spacing:1px;white-space:nowrap;flex:0 0 auto;transition:opacity .2s}
.ws-board:hover .ws-more{opacity:1}
.ws-ent{display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:6px;padding-top:8px;
    border-top:1px dashed color-mix(in srgb,var(--ip,#c9a86a) 20%,transparent)}
.ws-hd{font-size:13px;font-weight:700;color:var(--ip,#c9a86a);letter-spacing:1px;white-space:nowrap;display:flex;align-items:center;gap:5px}
.ws-reswrap{display:flex;gap:7px;flex-wrap:wrap;flex:1;min-width:0}
.ws-res{display:inline-flex;align-items:baseline;gap:4px;padding:2px 9px;border-radius:8px;font-size:11px;
    background:rgba(0,0,0,.32);border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 16%,transparent);white-space:nowrap}
.ws-res b{color:var(--itx,#e8dcc0);font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.ws-res.flash{animation:wsFlash .7s ease}
@keyframes wsFlash{0%{background:color-mix(in srgb,var(--ip,#c9a86a) 45%,transparent)}100%{background:rgba(0,0,0,.32)}}
.ws-tail{font-size:11.5px;color:var(--imt,#9a8c6e);white-space:nowrap;letter-spacing:.5px}
.ws-tail b{color:var(--itx,#d8cba8);font-weight:600}
@media(max-width:420px){.ws-board{gap:7px;padding:9px 11px}.ws-mods{gap:8px}.ws-res{padding:2px 7px}.ws-hd{font-size:12px}.ws-more{display:none}}`;
    document.head.appendChild(st);
  }
  function define(g, defs) {
    var _a;
    if (g !== genre) return;
    modules = (Array.isArray(defs) ? defs : []).filter((m) => m && m.id);
    if (pending.length) modules = mergeDefs(modules, pending);
    try {
      if (window.PlayerKit && typeof window.PlayerKit.augment === "function") {
        modules = window.PlayerKit.augment(g, modules);
      }
    } catch (e) {
    }
    load();
    modules.forEach(ensureState);
    entMod = modules.find((m) => m && (m.eeLedger || m.eeOps)) || null;
    if (entMod && window.EE) {
      if (!ent || !ent.ledger) ent = EE.blank();
      try {
        EE.Ledger.seed(ent, ((_a = entMod.eeLedger) == null ? void 0 : _a.start) || {}, null);
      } catch (e) {
      }
      ent._modId = entMod.id;
    }
    try {
      const fw = window.storyFramework;
      if (fw && fw.storyState && fw.storyState.variables) onVars(fw.storyState.variables, Number(fw.storyState.variables.chapter) || 0);
    } catch (e) {
    }
    console.log(`[WorldExt] ${genre} 界专属模块就位：${modules.map((m) => m.name).join(" / ")}${entMod ? "（实体引擎已挂载）" : ""}`);
    mountStrip();
  }
  /* v3.55.29：PlayerKit 不可用（尚未加载 / 加载失败）时，原逻辑「这次不在就永远算了」——
     界专属模块就此静默全废，外界只看到 hasModules() 恒 false。改为等到就绪再补挂。 */
  function tryPlayerKit() {
    var PK = window.PlayerKit;
    if (!PK || typeof PK.augment !== "function") return false;
    var got = PK.augment(genre, []);
    if (!Array.isArray(got)) return false;          /* 影子对象会返回 Promise，不能当数组用 */
    modules = got;
    load();
    modules.forEach(ensureState);
    console.log(`[WorldExt] ${genre} 界无扩展文件，仅挂随身器官：${modules.map((m) => m.name).join(" / ")}`);
    return true;
  }
  function init() {
    injectStyle();
    try {
      if (!modules.length) {
        if (!tryPlayerKit() && window.YJWait) {
          YJWait.for(tryPlayerKit, null, { name: "world-ext.playerkit", base: 150, max: 60 });
        }
      }
    } catch (e) {
    }
    try {
      if (pending.length) {
        const before = modules.length;
        modules = mergeDefs(modules, pending);
        if (modules.length !== before) {
          modules.forEach(ensureState);
          console.log(`[WorldExt] ${genre} 界注入模块合流：${modules.map((m) => m.name).join(" / ")}`);
          mountStrip();
        }
      }
    } catch (e) {
    }
    booted = true;
  }
  function hasModules() {
    return modules.length > 0;
  }
  function onVars(vars, round) {
    if (!modules.length || !vars) return;
    let dirty = false;
    for (const m of modules) {
      if (!visible(m)) continue;
      try {
        const s = ensureState(m);
        if (m.read) {
          if (m.read(s, vars, round)) dirty = true;
        }
      } catch (e) {
        console.warn(`[WorldExt:${m.id}]`, e.message);
      }
    }
    if (ent && entMod && window.EE) {
      try {
        const absorb = entMod.eeAbsorb ? entMod.eeAbsorb(vars) : null;
        if (absorb) {
          if (absorb.res && EE.Ledger.absorb(ent, absorb.res)) dirty = true;
          if (absorb.residents && EE.Residents.absorb(ent, absorb.residents)) dirty = true;
        }
        const before = dayEvents.length;
        EE.tick(ent, entMod.eeCfg, dayEvents);
        if (dayEvents.length > before) {
          dirty = true;
          dayEvents.slice(before).forEach((ev) => {
            var _a, _b, _c;
            try {
              (_a = window.showToast) == null ? void 0 : _a.call(window, `🏗 ${ev.text}`, "success");
              (_c = (_b = window.Celebration) == null ? void 0 : _b.fire) == null ? void 0 : _c.call(_b, "seal");
            } catch (e) {
            }
          });
        }
      } catch (e) {
        console.warn("[WorldExt:ent]", e.message);
      }
    }
    if (dirty) save();
    refreshStrip();
    try {
      const body = $id("immBody");
      if (body && body.dataset.wxTab === "1") {
        body.innerHTML = panelHTML();
      }
    } catch (e) {
    }
  }
  function panelHTML() {
    if (!modules.length) return empty("🧬", "本界暂无专属模块", "界专属扩展按世界定制——自由工坊可自定义追踪字段");
    injectStyle();
    const secs = [];
    for (const m of modules) {
      if (!visible(m)) continue;
      try {
        const s = ensureState(m);
        const inner = m.html ? String(m.html(s, H)) : "";
        const nm = window.ModuleSettings && ModuleSettings.aliasOf ? ModuleSettings.aliasOf(m.id, m.name) : m.name;
        const gearBtn = window.ModuleSettings && ModuleSettings.button ? ModuleSettings.button(m.id) : "";
        secs.push(`<section class="wx-sec" style="margin-bottom:16px;">
                    <div class="wx-sec-hd"><b>${m.icon || "◈"} ${esc(nm)}</b><span>${esc(m.tip || "")}</span>${gearBtn}</div>
                    ${m.tip ? "" : ""}${inner || empty(m.icon || "◈", "尚无数据", "开篇后随 (variable_update) 上报自动填充")}
                </section>`);
      } catch (e) {
        secs.push(empty("⚠️", `${m.name} 面板故障`, e.message));
      }
    }
    return `<div class="wx-tip">🧬 玩家随身（面板/背包）+ 本界专属机制——数值与剧情互相咬合，此写彼应；背包可手动增删，点击模块内按钮可干预；模块右上角 ⚙ 可改名/隐藏/自定义数值</div>` + secs.join("");
  }
  function act(modId, action, payload) {
    const m = modules.find((x) => x.id === modId);
    if (!m) return;
    try {
      const s = ensureState(m);
      if (action && String(action).startsWith("ee") && ent && window.EE) {
        entAct(action, payload, s, m);
        return;
      }
      const toast = m.act(s, action, payload);
      save();
      const body = $id("immBody");
      if (body) {
        body.dataset.wxTab = "1";
        body.innerHTML = panelHTML();
      } else {
      }
      if (toast && window.showToast) window.showToast(String(toast), "success");
    } catch (e) {
      console.warn(`[WorldExt:${modId}.act]`, e.message);
    }
  }
  function entAct(action, payload, s, m) {
    var _a, _b, _c, _d;
    let toast = "";
    try {
      switch (action) {
        case "eeStart": {
          const def = (m.eeOps || []).find((o) => o.id === payload);
          if (!def) return;
          const r = EE.Projects.start(ent, def);
          if (!r.ok) {
            toast = r.msg;
          } else {
            const cost = Object.entries(def.cost || {}).map(([k, v]) => `${k}${v}`).join("/");
            EE.Ops.add(ent, `启动工程「${def.name}」：消耗${cost}，工期${def.days || 1}天${((_a = def.yield) == null ? void 0 : _a.note) ? "，" + def.yield.note : ""}`);
            toast = `🏗 ${def.name} 已开工——资源已扣，工期 ${def.days || 1} 天`;
            try {
              (_b = m.eeWrap) == null ? void 0 : _b.call(m, action, payload, r, s);
            } catch (e) {
            }
          }
          break;
        }
        case "eeCancel": {
          const i = ent.projects.queue.findIndex((p2) => p2.id === payload);
          if (i < 0) return;
          const p = ent.projects.queue.splice(i, 1)[0];
          Object.entries(((_c = p.yield) == null ? void 0 : _c.refundCost) || {}).forEach(([k, v]) => EE.Ledger.move(ent, k, 0, "", "engine"));
          const half = {};
          Object.entries(((_d = (m.eeOps || []).find((o) => o.id === payload)) == null ? void 0 : _d.cost) || {}).forEach(([k, v]) => half[k] = -Math.floor(Number(v) / 2));
          Object.entries(half).forEach(([k, v]) => EE.Ledger.move(ent, k, v, `工程「${p.name}」取消退款`, "player"));
          toast = `已取消「${p.name}」（退回半数材料）`;
          break;
        }
        case "eeJob": {
          const [name, job] = String(payload).split("=");
          const u = ent.residents.list.find((x) => x.name === name);
          if (u) {
            u.job = job;
            EE.Ops.add(ent, `派工：${name} → ${job}`);
            toast = `${name} 的分工已改为「${job}」`;
          }
          break;
        }
        case "eeLeave": {
          if (EE.Residents.remove(ent, payload, "玩家请出")) {
            EE.Ops.add(ent, `将 ${payload} 请出安全屋`);
            toast = `${payload} 已离开安全屋`;
          }
          break;
        }
        case "eeDropOp": {
          ent.ops.tickets.splice(Number(payload), 1);
          break;
        }
        case "eeConfirm": {
          const items = EE.Ops.confirm(ent);
          if (items) toast = `已确认 ${items.length} 项行动——本轮正文将据此演绎`;
          break;
        }
        case "eeAddRes": {
          const raw = String(payload || "").trim();
          const [k, v] = raw.split(/[=＝]/);
          if (k && Number.isFinite(Number(v))) {
            EE.Ledger.move(ent, k.trim(), Math.round(Number(v)), "手工入账", "player");
            toast = `账本入账：${k.trim()} ${Number(v) > 0 ? "+" : ""}${Math.round(Number(v))}`;
          } else toast = "格式：资源名=数量，如 钢材=50";
          break;
        }
        case "eeAddResident": {
          const raw = String(payload || "").trim();
          const [name, role] = raw.split(/[=＝]/);
          if (name && EE.Residents.add(ent, { name: name.trim(), role: (role || "").trim() })) {
            EE.Ops.add(ent, `收留 ${name.trim()}入住安全屋`);
            toast = `${name.trim()} 已入住安全屋`;
          } else toast = name ? "名册已满或姓名重复" : "格式：姓名=身份，如 刘阿姨=小区楼长";
          break;
        }
      }
    } catch (e) {
      console.warn("[WorldExt:entAct]", e.message);
    }
    save();
    refreshStrip();
    const body = $id("immBody");
    if (body) {
      body.dataset.wxTab = "1";
      body.innerHTML = panelHTML();
    }
    if (toast && window.showToast) window.showToast(toast, "success");
  }
  function stripHTML() {
    const groups = [];
    for (const m of modules) {
      if (!m.summary) continue;
      if (!visible(m)) continue;
      try {
        const s = ensureState(m);
        const items = m.summary(s);
        if (!items || !items.length) continue;
        const cells = items.filter((it) => it && it.v != null && String(it.v) !== "").map(
          (it) => `${it.i ? `<span class="ws-gi">${esc(String(it.i))}</span>` : ""}<span class="ws-gv${it.tone ? " " + esc(String(it.tone)) : ""}">${esc(String(it.v))}</span>` + (it.l ? `<span class="ws-gl">${esc(String(it.l))}</span>` : "")
        ).join("");
        if (cells) groups.push(`<span class="ws-grp" title="${esc(m.name)}">${cells}</span>`);
      } catch (e) {
      }
    }
    let entRow = "";
    if (ent && entMod && window.EE) {
      try {
        const defs = entMod.eeLedger && entMod.eeLedger.defs || [];
        const res = defs.map((d) => `<span class="ws-res" title="${esc(d.note || d.key)}">${d.icon || "📦"}<b>${EE.Ledger.get(ent, d.key)}</b></span>`).join("");
        const q = ent.projects.queue;
        const qTxt = q.map((p) => `${p.icon || "🏗"}${esc(p.name)}·余${p.left}天`).join(" ");
        const people = ent.residents.list.length;
        const doneN = ent.projects.done.length;
        const tail = `${qTxt ? `<b>${qTxt}</b>` : ""}${people ? `${qTxt ? " " : ""}👥${people}人` : ""}${doneN ? ` ✅${doneN}` : ""} ›`;
        entRow = `<div class="ws-ent">
                    <span class="ws-hd">${entMod.icon || "🏠"} ${esc(entMod.name)}</span>
                    <span class="ws-reswrap">${res}</span>
                    <span class="ws-tail">${tail}</span>
                </div>`;
      } catch (e) {
      }
    }
    if (!groups.length && !entRow) return null;
    return `<div class="ws-board" onclick="ImmersiveSuite.openTab('ext')" title="打开界专属操作台">
            ${groups.length ? `<div class="ws-mods">${groups.join('<span class="ws-div"></span>')}<span class="ws-more">🧬 界专属操作台 ›</span></div>` : ""}
            ${entRow}
        </div>`;
  }
  function mountStrip() {
    const bar2 = $id("quickBar");
    if (!bar2) return;
    if (!$id("wxStrip")) {
      if (!stripHTML()) return;
      const el = document.createElement("div");
      el.id = "wxStrip";
      bar2.parentNode.insertBefore(el, bar2);
    }
    refreshStrip();
  }
  function refreshStrip() {
    const el = $id("wxStrip");
    if (!el) return;
    const html = stripHTML();
    if (html) {
      el.innerHTML = html;
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  }
  function takeDirective() {
    if (!modules.length) return null;
    const contracts = [];
    const directives = [];
    for (const m of modules) {
      if (!visible(m)) continue;
      try {
        const s = ensureState(m);
        const c = typeof m.contract === "function" ? m.contract(s) : m.contract;
        if (c) contracts.push(`· ${m.name}：${c}`);
        if (m.directive) {
          const d = m.directive(s);
          if (d) directives.push(`· ${m.name}——${d}`);
        }
      } catch (e) {
      }
    }
    let opsTicket = null;
    if (ent && entMod && window.EE && ent.ops.tickets.length) {
      opsTicket = EE.Ops.takeDirective(ent, true);
    }
    if (!contracts.length && !directives.length && !opsTicket) return null;
    const parts = [];
    if (opsTicket) parts.push(opsTicket);
    if (contracts.length) parts.push(`【本界专属机制 · 变量上报契约】每轮在 (variable_update) 中如实更新以下字段（无变化可省）：
${contracts.join("\n")}`);
    if (directives.length) parts.push(`【本界专属机制 · 当前状态指引】
${directives.join("\n")}
——以上机制是本界玩法的器官：正文事件应推动这些数值变化，数值变化也应反过来改写剧情走向（此写彼应，禁止脱节）；不要向玩家复述数值面板本身。`);
    return parts.join("\n\n");
  }
  function injectModules(g, defs) {
    if (g !== genre) return false;
    const list = (Array.isArray(defs) ? defs : []).filter((m) => m && m.id);
    if (!list.length) return false;
    pending = mergeDefs(pending, list);
    if (modules.length) {
      modules = mergeDefs(modules, list);
      modules.forEach(ensureState);
      save();
      refreshStrip();
      try {
        const body = $id("immBody");
        if (body && body.dataset.wxTab === "1") body.innerHTML = panelHTML();
      } catch (e) {
      }
    }
    return true;
  }
  window.WXH = H;
  window.WorldExt = {
    version: VERSION,
    genre,
    define,
    init,
    hasModules,
    onVars,
    panelHTML,
    act,
    takeDirective,
    /* v3.33.0 主界面常驻多模块状态板（快捷指令条上方，点击直开界专属操作台） */
    mountStrip,
    refreshStrip,
    stripHTML,
    injectModules,
    persist: save,
    /* v3.33.0 模块注入入口 + 异步落盘（通讯回信完成等场景） */
    /* v3.32.0 实体引擎透出（界扩展/调试用） */
    entState() {
      return ent;
    },
    entModule() {
      return entMod;
    },
    modState(id) {
      const m = modules.find((x) => x.id === id);
      return m ? ensureState(m) : null;
    },
    _reset() {
      var _a;
      mods = {};
      ent = null;
      modules.forEach(ensureState);
      if (entMod && window.EE) {
        ent = EE.blank();
        ent._modId = entMod.id;
        try {
          EE.Ledger.seed(ent, ((_a = entMod.eeLedger) == null ? void 0 : _a.start) || {}, null);
        } catch (e) {
        }
      }
      save();
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (e) {
    }
  });
})();
