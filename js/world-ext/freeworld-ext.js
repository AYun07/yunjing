(function() {
  "use strict";
  function code() {
    try {
      return window.FreeWorldForge.worldCodeOf(window.storyFramework) || null;
    } catch (e) {
      return null;
    }
  }
  function save() {
    try {
      window.storyFramework && window.storyFramework.saveStory();
    } catch (e) {
    }
  }
  const codeMod = {
    id: "code",
    icon: "📜",
    name: "世界宪法卡",
    tip: "玩家亲笔创造的世界法则——运行途中可随时增补新法，即刻生效",
    init: () => ({}),
    read() {
      return false;
    },
    // 宪法是玩家主权，不由 AI 变量改写
    act(s, action, payload) {
      const wc = code();
      if (!wc) return "尚无世界宪法（未开篇或旧档）";
      if (action === "amend") {
        const text = String(payload || "").trim().slice(0, 60);
        if (!text) return;
        if (!Array.isArray(wc.amendments)) wc.amendments = [];
        if (wc.amendments.length >= 12) return "增补已达上限（12 条）——先废止几条旧法";
        wc.amendments.push(text);
        save();
        return `🧾 新法已立：${text}`;
      }
      if (action === "repeal") {
        const i = Number(payload);
        if (!Array.isArray(wc.amendments) || !wc.amendments[i]) return;
        const t = wc.amendments.splice(i, 1)[0];
        save();
        return `已废止：「${t}」`;
      }
    },
    html(s) {
      const wc = code();
      if (!wc) return WXH.empty("📜", "尚无世界宪法", "本卡在自由世界开篇后点亮——创世台写下的法则都会在此陈列");
      const F = window.FreeWorldForge;
      const laws = [];
      if (wc.power) laws.push(["力量体系", wc.power]);
      if (wc.death) laws.push(["生死法则", wc.death]);
      if (wc.era) laws.push(["时代历法", wc.era]);
      if (wc.geo) laws.push(["舞台地理", wc.geo]);
      if (wc.comm) laws.push(["通讯形态", F.commRule(wc.comm)]);
      const lawRows = laws.map(([k, v]) => `<div class="wx-kv"><span>${k}</span><b style="max-width:210px;text-align:right;">${WXH.esc(String(v).slice(0, 60))}</b></div>`).join("");
      const facRows = Array.isArray(wc.factions) && wc.factions.length ? wc.factions.map((f) => `<div class="wx-kv"><span>${WXH.esc(f.name)}</span><b style="max-width:200px;text-align:right;">${WXH.esc(f.stance || "立场未述")}</b></div>`).join("") : "";
      const amends = Array.isArray(wc.amendments) ? wc.amendments : [];
      const amendRows = amends.map((a, i) => `<div class="wx-task">
                <b>§${i + 1} ${WXH.esc(a)}</b>
                <button class="wx-del" title="废止此条" onclick="WorldExt.act('code','repeal',${i})">✕</button>
            </div>`).join("");
      return `
            ${WXH.card("世界之魂", `<p style="margin:0;font-size:12.5px;line-height:1.7;color:var(--it,#d8cdb8);">${WXH.esc(wc.soul || "—")}</p>`, { icon: "🌀", grow: true })}
            ${lawRows ? WXH.card("世界法则", lawRows, { icon: "⚖" }) : ""}
            ${facRows ? WXH.card("势力版图", facRows, { icon: "⚔" }) : ""}
            ${WXH.card(`运行时增补 · ${amends.length}/12`, amendRows || '<p style="margin:0;font-size:11.5px;opacity:.6;">玩法中途立的新法——与创世法则同等效力，即刻生效</p>', { icon: "🧾" })}
            <div class="wx-slot">
                <input id="wxAmend" placeholder="立一条新法（≤60字）——例：此界铁器稀有，一把好剑值一座宅子" maxlength="60" style="flex:1;">
                <button class="wx-btn" onclick="WorldExt.act('code','amend',document.getElementById('wxAmend').value)">＋ 立法</button>
            </div>`;
    },
    /* 宪法全文已由 config.systemPrompt() 每轮实时注入（含增补），此处不再重复注入 */
    directive: () => "",
    contract: () => null
  };
  const gaugesMod = {
    id: "gauges",
    icon: "📊",
    name: "本世量表",
    tip: "创世台自定量表（名称/配色/初值全由玩家定义）——AI 每轮按处境如实增减",
    init: () => ({ vals: {} }),
    read(s, vars) {
      let d = false;
      const gs = window.FreeWorldForge.gaugesOf(window.storyFramework);
      gs.forEach((g) => {
        const v = vars && vars[g.key] != null ? WXH.asNum(vars[g.key], g.default) : g.default;
        if (s.vals[g.key] !== v) {
          s.vals[g.key] = v;
          d = true;
        }
      });
      return d;
    },
    /* v3.32.2 状态板摘要：自定量表逐枚上板（≤4枚防挤） */
    summary(s) {
      const gs = window.FreeWorldForge.gaugesOf(window.storyFramework);
      return gs.slice(0, 4).map((g) => {
        var _a;
        return { i: g.icon || "◈", v: String((_a = s.vals[g.key]) != null ? _a : g.default), l: g.label };
      });
    },
    html(s) {
      const gs = window.FreeWorldForge.gaugesOf(window.storyFramework);
      const rows = gs.map((g) => {
        var _a, _b;
        return `
                <div style="margin:7px 0;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                        <span>${g.icon || "◈"} ${WXH.esc(g.label)}</span>
                        <b style="color:${g.color.includes("gradient") ? "var(--ip,#c9a86a)" : g.color};">${(_a = s.vals[g.key]) != null ? _a : g.default}</b>
                    </div>
                    ${WXH.bar((_b = s.vals[g.key]) != null ? _b : g.default, g.color)}
                </div>`;
      }).join("");
      return WXH.card(`本世量表 · ${gs.length} 枚`, rows, { icon: "📊", grow: true, tag: "玩家自定" });
    },
    directive(s) {
      const gs = window.FreeWorldForge.gaugesOf(window.storyFramework);
      const list = gs.map((g) => {
        var _a;
        return `${g.label}=${(_a = s.vals[g.key]) != null ? _a : g.default}`;
      }).join("，");
      return `本世量表现状：${list}——增减必须有处境因果，禁止无故跳变`;
    },
    contract: (s) => {
      const gs = window.FreeWorldForge.gaugesOf(window.storyFramework);
      return gs.length ? `自定量表[${gs.map((g) => g.key).join(",")}]（玩家创世台定义的人生度量，0-100，每轮按处境如实增减）` : null;
    }
  };
  const factionsMod = {
    id: "factions",
    icon: "⚔",
    name: "势力版图",
    tip: "创世台定义的势力格局——玩家的所作所为会累积各家的声望",
    init: () => ({ vals: {} }),
    read(s, vars) {
      let d = false;
      const fs = window.FreeWorldForge.factionsOf(window.storyFramework);
      fs.forEach((f) => {
        const key = "声望·" + f.name;
        const v = vars && vars[key] != null ? WXH.asNum(vars[key], 30) : 30;
        if (s.vals[f.name] !== v) {
          s.vals[f.name] = v;
          d = true;
        }
      });
      return d;
    },
    /* v3.32.2 状态板摘要：声望最高与最低的两家上板 */
    summary(s) {
      const fs = window.FreeWorldForge.factionsOf(window.storyFramework);
      if (!fs.length) return [];
      const sorted = fs.map((f) => {
        var _a;
        return { n: f.name, v: (_a = s.vals[f.name]) != null ? _a : 30 };
      }).sort((a, b) => b.v - a.v);
      const hi = sorted[0];
      const lo = sorted.length > 1 ? sorted[sorted.length - 1] : null;
      const items = [{ i: "⚔", v: String(hi.v), l: hi.n, tone: hi.v >= 70 ? "ok" : "" }];
      if (lo && lo.n !== hi.n) items.push({ i: "⚔", v: String(lo.v), l: lo.n, tone: lo.v <= 20 ? "bad" : "" });
      return items;
    },
    html(s) {
      const fs = window.FreeWorldForge.factionsOf(window.storyFramework);
      if (!fs.length) return WXH.empty("⚔", "本世界没有登记在册的势力", "创世台未定义势力——一个安静的世界也很好；或开新档时在「势力版图」里写上几家");
      const tone = (v) => v >= 70 ? "备受敬重" : v >= 45 ? "有几分薄面" : v >= 20 ? "无名之辈" : "不受待见";
      const rows = fs.map((f) => {
        var _a, _b, _c;
        return `
                <div style="margin:8px 0;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
                        <span>⚔ ${WXH.esc(f.name)}<small style="opacity:.55;margin-left:6px;">${WXH.esc(f.stance || "")}</small></span>
                        <b>${(_a = s.vals[f.name]) != null ? _a : 30} · ${tone((_b = s.vals[f.name]) != null ? _b : 30)}</b>
                    </div>
                    ${WXH.bar((_c = s.vals[f.name]) != null ? _c : 30, "linear-gradient(90deg,#a8745a,#d8b088)")}
                </div>`;
      }).join("");
      return WXH.card("势力声望", rows, { icon: "⚔", grow: true });
    },
    directive(s) {
      const fs = window.FreeWorldForge.factionsOf(window.storyFramework);
      if (!fs.length) return "";
      const list = fs.map((f) => {
        var _a;
        return `${f.name}=${(_a = s.vals[f.name]) != null ? _a : 30}`;
      }).join("，");
      return `玩家在各势力的声望：${list}——声望是交往的积累，涨落须有实质互动支撑`;
    },
    contract: (s) => {
      const fs = window.FreeWorldForge.factionsOf(window.storyFramework);
      return fs.length ? `势力声望[${fs.map((f) => "声望·" + f.name).join(",")}]（0-100，与该势力有实质互动才变动）` : null;
    }
  };
  if (window.WorldExt) WorldExt.define("freeworld", [codeMod, gaugesMod, factionsMod]);
})();
