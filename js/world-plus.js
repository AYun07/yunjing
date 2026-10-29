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
  if (!window.WorldExt) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const jn = (s) => String(s).replace(/'/g, "");
  const OPT = (id, k, d) => window.ModuleSettings ? ModuleSettings.opt(id, k, d) : d;
  function curRound() {
    try {
      return Number(window.storyFramework.storyState.variables.chapter) || 0;
    } catch (e) {
      return 0;
    }
  }
  function vars() {
    try {
      return window.storyFramework.storyState.variables || {};
    } catch (e) {
      return {};
    }
  }
  function num(v) {
    if (v == null) return null;
    const m = String(v).match(/-?\d+/);
    return m ? Number(m[0]) : null;
  }
  function manualEdit(s, modId, title, message, apply) {
    window.UIDialog.prompt({ title, message, defaultValue: "" }).then((input) => {
      if (input == null || input === "") return;
      try {
        apply(String(input).trim());
        WorldExt.persist();
      } catch (e) {
      }
      const body = document.getElementById("immBody");
      if (body && body.dataset.wxTab === "1") body.innerHTML = WorldExt.panelHTML();
    }).catch(() => {
    });
  }
  const fenjue = {
    id: "fenjue",
    icon: "🔥",
    name: "焚决 · 异火融合",
    tip: "焚决吞噬异火而进化——每一分融合进度，都是烧在骨血里的痛",
    contract: "焚决（功法当前层数，如「焚决第四层」）；异火融合（焚决吞噬融合进度 0-100，有进展当轮必报）",
    init: () => ({ layers: null, fuse: null, logs: [] }),
    opts: [
      { key: "backlash", type: "number", label: "反噬高危线（融合进度）", dflt: 80, tip: "进度越过此线，正文必写焚身之痛与火毒反噬" }
    ],
    read(s, v) {
      var _a, _b, _c, _d;
      let d = false;
      const L = num((_b = (_a = v["焚决"]) != null ? _a : v["焚决层数"]) != null ? _b : v["功法"]);
      if (L != null && L !== s.layers) {
        s.layers = L;
        d = true;
      }
      const F = num((_d = (_c = v["融合"]) != null ? _c : v["异火融合"]) != null ? _d : v["吞噬融合"]);
      if (F != null && F !== s.fuse) {
        s.fuse = Math.max(0, Math.min(100, F));
        if (s.fuse >= OPT("fenjue", "backlash", 80)) {
          s.logs.unshift(`第${curRound()}回：融合度 ${s.fuse}%——焚身之痛灼烧经脉`);
          if (s.logs.length > 6) s.logs.length = 6;
        }
        d = true;
      }
      return d;
    },
    summary(s) {
      if (s.layers == null && s.fuse == null) return [];
      return [{ i: "🔥", v: s.layers != null ? `${s.layers}层` : "—", l: s.fuse != null ? `融合${s.fuse}%` : "焚决" }];
    },
    html(s, h) {
      const g = s.fuse != null ? h.gauge(s.fuse, [
        { max: 30, label: "初融", color: "#8fd9a8" },
        { max: 60, label: "火髓", color: "#e0c45c" },
        { max: OPT("fenjue", "backlash", 80), label: "焚骨", color: "#e0a84c" },
        { max: 100, label: "化炎·高危", color: "#ef6a6a" }
      ], "%") : "";
      const steps = ["焚决·初篇", "二篇", "三篇", "四篇", "五篇", "终篇"];
      const ladder = h.card("焚决功法", `<div class="wx-stepper">
                ${steps.map((t, i) => `<div class="wx-step ${s.layers === i + 1 ? "on" : s.layers != null && i + 1 < s.layers ? "done" : ""}">${i + 1}·${t.replace("焚决·", "")}</div>`).join("")}
            </div>`, { icon: "🔥", grow: true, tag: s.layers != null ? `当前第${s.layers}层` : "尚未修习" });
      const fuse = s.fuse != null ? h.card("异火融合度", g.html, { icon: "🌡", tag: "吞噬进度" }) : "";
      const nudge = s.fuse != null ? `<div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('fenjue','up','')">凝火 +5%</button>
                <button class="wx-btn" onclick="WorldExt.act('fenjue','down','')">散功 -5%</button>
                <button class="wx-btn" onclick="WorldExt.act('fenjue','set','fuse')">✎ 手动修正</button></div>` : "";
      const logs = s.logs.length ? h.card("焚身留痕", s.logs.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(""), { icon: "📈", grow: true }) : "";
      return `${ladder}${fuse}${nudge}${logs}
            <div class="wx-banner">焚决是萧家不传之功：吞噬异火则焚决进化，人也焚得半死——融合进度越高，斗气越霸烈，火毒反噬越凶；异火榜上的每一朵火，都要用命去换。</div>`;
    },
    act(s, action, payload) {
      if (action === "up") {
        s.fuse = Math.min(100, (s.fuse || 0) + 5);
        return `凝火苦修：融合度 ${s.fuse}%`;
      }
      if (action === "down") {
        s.fuse = Math.max(0, (s.fuse || 0) - 5);
        return `散功压火：融合度 ${s.fuse}%`;
      }
      if (action === "set" && payload === "fuse") {
        manualEdit(s, "fenjue", "✎ 手动修正融合度", "输入 0-100 的数字：", (v) => {
          const n = Number(v.replace(/[^\d]/g, ""));
          if (Number.isFinite(n)) s.fuse = Math.max(0, Math.min(100, n));
        });
        return "";
      }
      return "";
    },
    directive(s) {
      const t = [];
      const high = OPT("fenjue", "backlash", 80);
      if (s.layers != null) t.push(`焚决第${s.layers}层`);
      if (s.fuse != null) {
        t.push(`异火融合度 ${s.fuse}%${s.fuse >= high ? `——已过高危线(${high}%)，本轮必须写焚身之痛/火毒反噬，修炼急不得` : "，吞噬融合须写烧灼之苦与火毒隐患"}`);
      }
      return t.length ? t.join("；") : "";
    }
  };
  const soulhunt = {
    id: "soulhunt",
    icon: "🏹",
    name: "猎魂小队",
    tip: "魂力等级数着走，猎环年限配比是铁律——小队同行，猎环才有归途",
    contract: "魂力（当前魂力等级数字，如「二十三级」，升变当轮必报）；猎魂目标（正在猎取的魂环：年限+魂兽，如「千年·人面魔蛛」）；小队（同行同伴名单，可整表上报）",
    init: () => ({ level: null, target: "", team: [] }),
    read(s, v) {
      var _a, _b, _c;
      let d = false;
      const L = num((_a = v["魂力"]) != null ? _a : v["魂力等级"]);
      if (L != null && L !== s.level) {
        s.level = L;
        d = true;
      }
      const tg = (_b = v["猎魂目标"]) != null ? _b : v["目标魂环"];
      if (tg != null && String(tg) !== s.target) {
        s.target = String(tg).slice(0, 30);
        d = true;
      }
      const tm = (_c = v["小队"]) != null ? _c : v["猎魂小队"];
      if (tm != null) {
        const arr = Array.isArray(tm) ? tm.map((x) => typeof x === "object" ? x.name || x.名称 : x).filter(Boolean) : String(tm).split(/[、,，;；\n]/).map((x) => x.trim()).filter(Boolean);
        for (const n of arr) if (!s.team.includes(n)) {
          s.team.push(n);
          d = true;
        }
        if (s.team.length > 8) s.team.length = 8;
      }
      return d;
    },
    summary(s) {
      if (s.level == null && !s.target && !s.team.length) return [];
      return [{ i: "💠", v: s.level != null ? `${s.level}级` : "—", l: s.target ? "猎环中" : "魂力" }];
    },
    html(s, h) {
      if (s.level == null && !s.target && !s.team.length) {
        return h.empty("🏹", "尚未踏入猎魂之路", "魂力升级与猎环随 (variable_update) 上报自动入册");
      }
      const kvs = h.kv([
        ["魂力等级", s.level != null ? `${s.level}级` : null],
        ["猎魂目标", s.target || null]
      ]);
      const team = s.team.length ? h.card(
        "同行同伴",
        s.team.map((n, i) => `<div class="wx-task">
                <b>${esc(n)}</b>
                <button class="wx-del" title="离队" onclick="WorldExt.act('soulhunt','kick',${i})">✕</button></div>`).join(""),
        { icon: "👥", tag: `${s.team.length}人` }
      ) : "";
      const add = `<div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('soulhunt','add','')">＋ 同伴入队</button>
                <button class="wx-btn" onclick="WorldExt.act('soulhunt','set','target')">✎ 改猎魂目标</button></div>`;
      return `${kvs}${team}${add}
            <div class="wx-banner">猎环铁律：魂环年限配比决定生死——第一环最佳百年、第二环数百年、第三环千年；越年限吸收必遭反噬，猎杀→仪式→压制→抉择，一步都省不得。</div>`;
    },
    act(s, action, payload) {
      if (action === "kick") {
        const n = s.team.splice(Number(payload), 1)[0];
        return n ? `${n} 已离队` : "";
      }
      if (action === "add") {
        manualEdit(s, "soulhunt", "＋ 同伴入队", "同伴姓名（可附身份：张三=七宝琉璃宗）：", (v) => {
          const [n, role] = v.split(/[=＝]/);
          if (n && !s.team.includes(n.trim()) && s.team.length < 8) s.team.push(n.trim());
        });
        return "";
      }
      if (action === "set" && payload === "target") {
        manualEdit(s, "soulhunt", "✎ 猎魂目标", "年限+魂兽，如「千年·人面魔蛛」：", (v) => {
          s.target = v.slice(0, 30);
        });
        return "";
      }
      return "";
    },
    directive(s) {
      const t = [];
      if (s.level != null) t.push(`魂力${s.level}级`);
      if (s.target) t.push(`正猎「${s.target}」——年限压制与吸收仪式要写足：猎杀→仪式→压制→抉择`);
      if (s.team.length) t.push(`小队同行：${s.team.join("、")}——配合与分歧都是戏`);
      return t.join("；");
    }
  };
  const quantify = {
    id: "quantify",
    icon: "🥊",
    name: "武者量化",
    tip: "拳力、速度、念力——科武纪元，数字就是身份",
    contract: "拳力（拳力测试数字，如「3.2万kg」）；速度（移动/神经反应速度概况）；念力（精神念师强度或段位概况，非念师省略）",
    init: () => ({ punch: "", speed: "", mind: "" }),
    read(s, v) {
      var _a;
      let d = false;
      for (const [key, keys] of [["punch", ["拳力"]], ["speed", ["速度", "反应速度"]], ["mind", ["念力", "精神力", "念师强度"]]]) {
        const val = (_a = v[keys[0]]) != null ? _a : v[keys[1]];
        if (val != null && String(val) !== s[key]) {
          s[key] = String(val).slice(0, 20);
          d = true;
        }
      }
      return d;
    },
    summary(s) {
      if (!s.punch && !s.speed && !s.mind) return [];
      return [{ i: "🥊", v: s.punch || "—", l: "拳力" }];
    },
    html(s, h) {
      if (!s.punch && !s.speed && !s.mind) {
        return h.empty("🥊", "尚未测拳", "武馆测试与战斗成长随 (variable_update) 上报自动量化");
      }
      const card = (label, val, key, icon) => h.card(label, `<div class="wx-gauge-main"><b style="color:var(--ip,#c9a86a);font-size:16px;">${esc(val)}</b></div>
                <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('quantify','set','${key}')">✎ 手动修正</button></div>`, { icon });
      return `<div class="wx-grid">
                ${s.punch ? card("拳力", s.punch, "punch", "🥊") : ""}
                ${s.speed ? card("速度", s.speed, "speed", "💨") : ""}
                ${s.mind ? card("念力", s.mind, "mind", "🧠") : ""}
            </div>
            <div class="wx-banner">武者级拳力破两万，战神级百万起步——数字贴段位：报高一个档是找死也是爽点，测拳测试本身就能成一场戏。</div>`;
    },
    act(s, action, payload) {
      if (action === "set") {
        const label = { punch: "拳力（如 3.2万kg）", speed: "速度", mind: "念力" }[payload] || payload;
        manualEdit(s, "quantify", `✎ 修正${label}`, `输入${label}：`, (v) => {
          s[payload] = v.slice(0, 20);
        });
        return "";
      }
      return "";
    },
    directive(s) {
      const t = [];
      if (s.punch) t.push(`拳力${s.punch}`);
      if (s.speed) t.push(`速度${s.speed}`);
      if (s.mind) t.push(`念力${s.mind}`);
      return t.length ? `${t.join("；")}——实力数字必须贴段位，越级挑战要靠黑神套装/秘法/底蕴，硬凑数字即失格` : "";
    }
  };
  const garden = {
    id: "garden",
    icon: "🌱",
    name: "灵植园",
    tip: "一畦灵药一寸光阴——将熟的灵药，也是别人眼里的肥肉",
    contract: "灵植（药园灵植整表：「名(幼苗/成长/将熟,距可采N轮)」；新种/被毁/被偷当轮必报）",
    init: () => ({ plots: [] }),
    read(s, v) {
      var _a, _b, _c, _d;
      let d = false;
      const raw = (_b = (_a = v["灵植"]) != null ? _a : v["药园"]) != null ? _b : v["灵药园"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : String(raw).split(/[、,，;；\n]+/);
        for (const it of arr) {
          let name = "", left = null, stage = "";
          if (it && typeof it === "object") {
            name = String(it.name || it.名称 || "").slice(0, 16);
            left = num((_d = (_c = it.left) != null ? _c : it.剩余) != null ? _d : it.距成熟);
            stage = String(it.stage || it.长势 || "");
          } else {
            const m = String(it).match(/^([^（(]{1,16})/);
            if (!m) continue;
            name = m[1].trim();
            const lm = String(it).match(/(\d+)\s*轮/);
            left = lm ? Number(lm[1]) : null;
            stage = /将熟|可采/.test(it) ? "将熟" : /成长/.test(it) ? "成长" : /幼苗/.test(it) ? "幼苗" : "";
          }
          if (!name) continue;
          const cur = s.plots.find((p) => p.name === name);
          if (!cur) {
            if (s.plots.length >= 9) continue;
            s.plots.push({ name, stage: stage || (left != null && left <= 1 ? "将熟" : "幼苗"), left: left != null ? left : 3 });
            d = true;
          } else {
            const ns = stage || cur.stage;
            const nl = left != null ? left : cur.left;
            if (ns !== cur.stage || nl !== cur.left) {
              cur.stage = ns;
              cur.left = nl;
              d = true;
            }
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.plots.length) return [];
      const ready = s.plots.filter((p) => p.left <= 0 || p.stage === "将熟").length;
      return [{ i: "🌱", v: `${s.plots.length}畦`, l: ready ? `${ready}株将熟` : "灵植园", tone: ready ? "ok" : "" }];
    },
    html(s, h) {
      if (!s.plots.length) {
        return h.empty("🌱", "药园空空", "种下灵植后随 (variable_update) 上报自动入册；也可手动登记");
      }
      const rows = s.plots.map((p, i) => {
        const st = p.left <= 0 || p.stage === "将熟";
        return `<div class="wx-task">
                    <b>${esc(p.name)} <span class="st" style="color:${st ? "#8fd9a8" : "var(--imt,#9a8c6e)"};font-size:10.5px;">${esc(p.stage || "培育中")}${p.left > 0 ? `·余${p.left}轮` : ""}</span></b>
                    ${st ? `<button class="wx-btn" onclick="WorldExt.act('garden','harvest',${i})">采收</button>` : `<button class="wx-btn" onclick="WorldExt.act('garden','tend',${i})">培育</button>`}
                    <button class="wx-del" title="拔除/登记失误" onclick="WorldExt.act('garden','del',${i})">✕</button>
                </div>`;
      }).join("");
      return `${h.card("药园 · " + s.plots.length + "畦", rows, { icon: "🌱", grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('garden','add','')">＋ 手动登记灵植</button></div>
            <div class="wx-banner">灵植按轮成熟：培育一次推进一轮；将熟的灵药是剧情钩子——灵气外泄会引来妖兽与同行，护园也是戏。</div>`;
    },
    act(s, action, payload) {
      if (action === "tend") {
        const p = s.plots[Number(payload)];
        if (p && p.left > 0) {
          p.left--;
          if (p.left <= 0) p.stage = "将熟";
          return `${p.name} 长势又进一轮`;
        }
        return "";
      }
      if (action === "harvest") {
        const p = s.plots.splice(Number(payload), 1)[0];
        return p ? `${p.name} 已采收入囊——记得让 AI 记账「+${p.name}」` : "";
      }
      if (action === "del") {
        const p = s.plots.splice(Number(payload), 1)[0];
        return p ? `${p.name} 已移出药园` : "";
      }
      if (action === "add") {
        manualEdit(s, "garden", "＋ 登记灵植", "名称（可附长势：朱果=将熟）：", (v) => {
          const [n, st] = v.split(/[=＝]/);
          if (n && s.plots.length < 9) s.plots.push({ name: n.trim().slice(0, 16), stage: (st || "").trim() || "幼苗", left: 3 });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      const ready = s.plots.filter((p) => p.left <= 0 || p.stage === "将熟");
      if (ready.length) return `灵植园里 ${ready.map((p) => p.name).join("、")} 已将熟——灵气外泄藏不住：妖兽觊觎、同行眼红、坊市收购，都是自然随之而来的戏`;
      if (s.plots.length) return `药园 ${s.plots.length} 畦灵植培育中——时间流过时让它们悄悄长`;
      return "";
    }
  };
  const huntlog = {
    id: "huntlog",
    icon: "🐉",
    name: "凶兽猎录",
    tip: "每一头猎杀的凶兽都值得记一笔——宝骨是拓印宝术的本钱",
    contract: "凶兽猎录（每猎杀一头记一条：「凶兽名:战利品(宝骨/皮血/内丹)」；重大猎杀当轮必报）",
    init: () => ({ kills: [] }),
    read(s, v) {
      var _a, _b;
      let d = false;
      const raw = (_b = (_a = v["凶兽猎录"]) != null ? _a : v["猎杀"]) != null ? _b : v["战利品"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : String(raw).split(/[;；\n]+/);
        for (const it of arr) {
          let name = "", spoil = "";
          if (it && typeof it === "object") {
            name = String(it.name || it.凶兽 || it.名称 || "").slice(0, 16);
            spoil = String(it.spoil || it.战利品 || it.所得 || "").slice(0, 40);
          } else {
            const m = String(it).match(/^([^：:]{1,16})[：:]\s*(.+)$/);
            if (m) {
              name = m[1].trim();
              spoil = m[2].trim().slice(0, 40);
            }
          }
          if (!name) continue;
          if (!s.kills.some((k) => k.name === name && k.spoil === spoil)) {
            if (s.kills.length >= 12) continue;
            s.kills.push({ name, spoil, round: curRound() });
            d = true;
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.kills.length) return [];
      return [{ i: "🐉", v: `${s.kills.length}猎`, l: "凶兽猎录" }];
    },
    html(s, h) {
      if (!s.kills.length) {
        return h.empty("🐉", "猎录空白", "每猎杀一头凶兽随 (variable_update) 上报自动留痕；也可手动记猎");
      }
      const rows = s.kills.map((k, i) => `<div class="wx-task">
                <b>${esc(k.name)}${k.spoil ? `<span style="color:var(--imt,#9a8c6e);font-size:10.5px;"> · ${esc(k.spoil)}</span>` : ""}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);font-size:10px;">第${k.round}回</span>
                <button class="wx-del" onclick="WorldExt.act('huntlog','del',${i})">✕</button>
            </div>`).join("");
      return `${h.card("猎录 · " + s.kills.length + "猎", rows, { icon: "🐉", grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('huntlog','add','')">＋ 手动记猎</button></div>
            <div class="wx-banner">凶兽的宝骨是拓印宝术的本钱——猎录越厚，名头越响；太古遗种的猎杀，值得整整一章。</div>`;
    },
    act(s, action, payload) {
      if (action === "del") {
        const k = s.kills.splice(Number(payload), 1)[0];
        return k ? `已抹去「${k.name}」的猎录` : "";
      }
      if (action === "add") {
        manualEdit(s, "huntlog", "＋ 记猎", "凶兽名:战利品（如 狻猊:宝骨一段）：", (v) => {
          const [n, sp] = v.split(/[：:]/);
          if (n && s.kills.length < 12) s.kills.push({ name: n.trim().slice(0, 16), spoil: (sp || "").trim().slice(0, 40), round: curRound() });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.kills.length) return "";
      return `猎录在案：${s.kills.slice(-3).map((k) => k.name).join("、")} 等 ${s.kills.length} 猎——凶兽身上的宝骨与皮血，是拓印宝术、兑换修行资源的硬通货`;
    }
  };
  const forge = {
    id: "forge",
    icon: "⚒",
    name: "淬炼台",
    tip: "好兵器是淬出来的——每 +1 都是炉火、矿石与心神",
    contract: "淬炼（正在淬炼的兵器名与强化层数，如「赤炎枪 +3」；层数变动当轮必报）",
    init: () => ({ target: "", lv: null, logs: [] }),
    opts: [{ key: "danger", type: "number", label: "淬炼凶险层数", dflt: 7, tip: "+N 以上，失败可能碎兵伤身" }],
    read(s, v) {
      var _a, _b, _c, _d;
      let d = false;
      const raw = (_b = (_a = v["淬炼"]) != null ? _a : v["兵器淬炼"]) != null ? _b : v["强化"];
      if (raw != null) {
        if (typeof raw === "object" && !Array.isArray(raw)) {
          const nm = String(raw.name || raw.兵器 || Object.keys(raw)[0] || "");
          const lv = num((_d = (_c = raw.lv) != null ? _c : raw.层数) != null ? _d : raw[Object.keys(raw)[0]]);
          if (nm && nm !== s.target) {
            s.target = nm.slice(0, 16);
            d = true;
          }
          if (lv != null && lv !== s.lv) {
            s.lv = lv;
            d = true;
          }
        } else {
          const m = String(raw).match(/^(.{1,16}?)\s*[+＋]\s*(\d+)/);
          if (m) {
            if (m[1].trim() !== s.target) {
              s.target = m[1].trim();
              d = true;
            }
            if (Number(m[2]) !== s.lv) {
              s.lv = Number(m[2]);
              d = true;
            }
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.target && s.lv == null) return [];
      return [{ i: "⚒", v: s.lv != null ? `+${s.lv}` : "—", l: s.target || "淬炼" }];
    },
    html(s, h) {
      if (!s.target && s.lv == null) {
        return h.empty("⚒", "淬炼台冷着", "从装备栏佩上兵器后，随 (variable_update) 上报自动入炉；也可手动立靶");
      }
      const danger = OPT("forge", "danger", 7);
      const lv = s.lv != null ? s.lv : 0;
      const steps = h.card("淬炼 · " + (s.target || "未立靶"), `<div class="wx-stepper">
                ${Array.from({ length: 9 }, (_, i) => `<div class="wx-step ${i < lv ? "done" : ""} ${i + 1 === lv ? "on" : ""}" ${i + 1 >= danger ? `style="color:#e07070;" title="凶险层"` : ""}>+${i + 1}</div>`).join("")}
            </div>`, { icon: "⚒", grow: true, tag: lv >= danger ? `⚠ +${lv} 凶险层` : `+${lv}` });
      const ops = `<div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('forge','raise','')">开炉 +1（矿石由 AI 记账）</button>
                <button class="wx-btn" onclick="WorldExt.act('forge','set','target')">✎ 立靶/改兵器</button></div>`;
      const logs = s.logs.length ? h.card("炉录", s.logs.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(""), { icon: "📖", grow: true }) : "";
      return `${steps}${ops}${logs}
            <div class="wx-banner">淬炼写火候：每 +1 都要写炉火、矿石与心神消耗；+${danger} 以上凶险层，失败可能碎兵伤身——天劫般的赌局，才是武道的味道。</div>`;
    },
    act(s, action, payload) {
      if (action === "raise") {
        s.lv = (s.lv != null ? s.lv : 0) + 1;
        s.logs.unshift(`第${curRound()}回：${s.target || "兵器"} 淬炼至 +${s.lv}`);
        if (s.logs.length > 6) s.logs.length = 6;
        const danger = OPT("forge", "danger", 7);
        return s.lv >= danger ? `⚔ +${s.lv}！凶险层——下一炉可能碎兵` : `淬炼成功：+${s.lv}`;
      }
      if (action === "set" && payload === "target") {
        manualEdit(s, "forge", "✎ 立靶", "兵器名（可附层数：赤炎枪=3）：", (v) => {
          const [n, l] = v.split(/[=＝]/);
          if (n) s.target = n.trim().slice(0, 16);
          const ln = num(l);
          if (ln != null) s.lv = ln;
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.target && s.lv == null) return "";
      const danger = OPT("forge", "danger", 7);
      return `正在淬炼「${s.target || "兵器"}」+${s.lv != null ? s.lv : 0}：淬炼消耗矿石灵石由剧情如实承担（记账进行囊）${s.lv >= danger ? `——已过 +${danger} 凶险层，失败即碎兵伤身` : ""}`;
    }
  };
  const bead = {
    id: "bead",
    icon: "⟳",
    name: "天逆珠",
    tip: "珠内自成岁月，流速由我——替代王林者的独有底牌",
    contract: "天逆珠（仅当主角持有：内界时间流速与当前内界岁月，如「流速十日，内界已三年」；催熟/炼药动用当轮必报）",
    init: () => ({ ratio: "", age: "", logs: [] }),
    read(s, v) {
      var _a, _b, _c, _d, _e, _f;
      let d = false;
      const raw = v["天逆珠"];
      if (raw != null) {
        if (typeof raw === "object" && !Array.isArray(raw)) {
          const r = String((_b = (_a = raw.ratio) != null ? _a : raw.流速) != null ? _b : "").slice(0, 12);
          const a = String((_e = (_d = (_c = raw.age) != null ? _c : raw.岁月) != null ? _d : raw.内界岁月) != null ? _e : "").slice(0, 16);
          if (r && r !== s.ratio) {
            s.ratio = r;
            d = true;
          }
          if (a && a !== s.age) {
            s.age = a;
            d = true;
          }
        } else {
          const str = String(raw).slice(0, 40);
          if (str !== s.ratio + s.age) {
            const rm = str.match(/流速([^，,。]{1,8})/);
            const am = str.match(/(?:内界)?(?:已)?([^，,。]{1,10}(?:年|月|日))/);
            if (rm) {
              s.ratio = rm[1].trim();
              d = true;
            }
            if (am) {
              s.age = am[1].trim();
              d = true;
            }
          }
        }
      }
      const use = (_f = v["催熟"]) != null ? _f : v["天逆珠动用"];
      if (use != null && String(use) !== (s.logs[0] || "")) {
        s.logs.unshift(`第${curRound()}回：${String(use).slice(0, 30)}`);
        if (s.logs.length > 6) s.logs.length = 6;
        d = true;
      }
      return d;
    },
    summary(s) {
      if (!s.ratio && !s.age) return [];
      return [{ i: "⟳", v: s.ratio || "天逆珠", l: s.age ? `内界${s.age}` : "岁月由我" }];
    },
    html(s, h) {
      if (!s.ratio && !s.age) {
        return h.empty("⟳", "尚无天逆珠", "此珠唯「替代王林」者可得；共世模式下它属于原著里的那个王林");
      }
      const kvs = h.kv([["时间流速", s.ratio || null], ["内界岁月", s.age || null]]);
      const logs = s.logs.length ? h.card("动用留痕", s.logs.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(""), { icon: "📖", grow: true }) : "";
      return `${kvs}${logs}
            <div class="wx-banner">珠内岁月外界一日——催熟灵药、闭关推演、岁月杀人都用它；但珠内时光也会催白你的鬓角。底牌与定时炸弹，从来是同一件东西。</div>`;
    },
    directive(s) {
      if (!s.ratio && !s.age) return "";
      return `天逆珠在身：内界流速${s.ratio || "未知"}、岁月${s.age || "未知"}——催熟灵药/闭关推演等动用要写岁月代价，珠的存在是底牌也是杀机`;
    }
  };
  const bottle = {
    id: "bottle",
    icon: "🜄",
    name: "掌天瓶",
    tip: "一瓶绿液一滴一株——韩立的全部本钱，和全部杀机",
    contract: "掌天瓶（仅当主角持有：瓶中绿液现有滴数；每催熟一株记「+催熟:灵药名」）",
    init: () => ({ drops: null, logs: [] }),
    opts: [{ key: "cap", type: "number", label: "绿液上限（滴）", dflt: 9, tip: "攒满即封顶" }],
    read(s, v) {
      var _a, _b;
      let d = false;
      const raw = (_b = (_a = v["掌天瓶"]) != null ? _a : v["绿液"]) != null ? _b : v["绿液滴数"];
      if (raw != null) {
        const n = num(raw);
        if (n != null && n !== s.drops) {
          s.drops = Math.max(0, n);
          d = true;
        }
      }
      const use = v["催熟"];
      if (use != null && String(use) !== (s.logs[0] || "").replace(/^第\d+回：催熟[:：]?\s*/, "")) {
        s.logs.unshift(`第${curRound()}回：催熟：${String(use).slice(0, 24)}`);
        if (s.logs.length > 6) s.logs.length = 6;
        if (s.drops != null) s.drops = Math.max(0, s.drops - 1);
        d = true;
      }
      return d;
    },
    summary(s) {
      if (s.drops == null) return [];
      return [{ i: "🜄", v: `${s.drops}滴`, l: "绿液" }];
    },
    html(s, h) {
      if (s.drops == null) {
        return h.empty("🜄", "尚无掌天瓶", "此瓶唯「替代韩立」者可得；共世模式下它属于那个谨慎的韩跑跑");
      }
      const cap = OPT("bottle", "cap", 9);
      const g = h.gauge(Math.min(100, Math.round(s.drops / cap * 100)), [
        { max: 33, label: "见底", color: "#e07070" },
        { max: 66, label: "将满", color: "#e0c45c" },
        { max: 100, label: "充盈", color: "#8fd9a8" }
      ], "");
      const drops = h.card("绿液 · " + s.drops + " / " + cap + " 滴", g.html, { icon: "🜄", tag: "底牌" });
      const ops = `<div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('bottle','drip','')">凝一滴（+1）</button>
                <button class="wx-btn" onclick="WorldExt.act('bottle','use','')">催熟动用（-1）</button>
                <button class="wx-btn" onclick="WorldExt.act('bottle','set','drops')">✎ 修正</button></div>`;
      const logs = s.logs.length ? h.card("催熟留痕", s.logs.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(""), { icon: "📖", grow: true }) : "";
      return `${drops}${ops}${logs}
            <div class="wx-banner">小瓶每日凝一滴绿液，催熟灵药百试百灵——这是韩立（或你）的全部本钱；瓶口风声走漏，就是灭门之祸。</div>`;
    },
    act(s, action, payload) {
      const cap = OPT("bottle", "cap", 9);
      if (action === "drip") {
        if (s.drops != null) {
          s.drops = Math.min(cap, s.drops + 1);
          return `绿液 ${s.drops} 滴`;
        }
        return "";
      }
      if (action === "use") {
        if (s.drops == null) return "";
        if (s.drops <= 0) return "瓶已见底——等它再凝";
        s.drops--;
        s.logs.unshift(`第${curRound()}回：催熟动用（余${s.drops}滴）`);
        if (s.logs.length > 6) s.logs.length = 6;
        return `动用一滴（余 ${s.drops}）——灵药入囊记得让 AI 记账`;
      }
      if (action === "set" && payload === "drops") {
        manualEdit(s, "bottle", "✎ 修正绿液", `输入滴数（0-${cap}）：`, (v) => {
          const n = num(v);
          if (n != null) s.drops = Math.max(0, Math.min(cap, n));
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (s.drops == null) return "";
      return `掌天瓶绿液 ${s.drops} 滴——一滴催熟一株；动用要瞒过所有人：师兄的试探、坊市的耳目、深夜的脚印`;
    }
  };
  const mainquest = {
    id: "mainquest",
    icon: "🎯",
    name: "主线面板",
    tip: "乐园的主线不容跳章——步骤清单就是生死状",
    contract: "主线（当前主线任务：name=任务名，steps=[步骤…，已完成加✓前缀]，reward=奖励概况；接取/推进/完结当轮必报）",
    init: () => ({ name: "", steps: [], reward: "" }),
    read(s, v) {
      var _a, _b, _c, _d;
      let d = false;
      const raw = (_a = v["主线"]) != null ? _a : v["主线任务"];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const nm = String(raw.name || raw.名称 || raw.任务 || "").slice(0, 24);
        if (nm && nm !== s.name) {
          s.name = nm;
          d = true;
        }
        const rw = String((_c = (_b = raw.reward) != null ? _b : raw.奖励) != null ? _c : "").slice(0, 30);
        if (rw !== s.reward) {
          s.reward = rw;
          d = true;
        }
        const st = (_d = raw.steps) != null ? _d : raw.步骤;
        if (Array.isArray(st)) {
          const next = st.map((x) => {
            const done = /✓|完成/.test(String(x).slice(0, 3));
            return { t: String(x).replace(/^[✓√✔]\s*/, "").slice(0, 40), done };
          }).slice(0, 8);
          if (JSON.stringify(next) !== JSON.stringify(s.steps)) {
            s.steps = next;
            d = true;
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.name || !s.steps.length) return [];
      const done = s.steps.filter((x) => x.done).length;
      return [{ i: "🎯", v: `${done}/${s.steps.length}`, l: s.name, tone: done === s.steps.length ? "ok" : "" }];
    },
    html(s, h) {
      if (!s.name) {
        return h.empty("🎯", "暂无主线", "乐园派发主线后随 (variable_update) 上报自动立状");
      }
      const rows = s.steps.map((x, i) => `<div class="wx-task">
                <b style="${x.done ? "text-decoration:line-through;opacity:.6;" : ""}">${esc(x.t)}</b>
                <span class="st" style="color:${x.done ? "#8fd9a8" : "var(--imt,#9a8c6e)"};cursor:pointer;" onclick="WorldExt.act('mainquest','tick',${i})">${x.done ? "✓ 完成" : "○ 未完"}</span>
            </div>`).join("");
      return `${h.card("主线 · " + esc(s.name), rows, { icon: "🎯", grow: true, tag: s.reward ? "奖:" + esc(s.reward) : "" })}
            <div class="wx-banner">主线步骤未完不可跳章——乐园的契约不容含糊；奖励预览写在案，命换来的东西要兑现。</div>`;
    },
    act(s, action, payload) {
      if (action === "tick") {
        const x = s.steps[Number(payload)];
        if (x) {
          x.done = !x.done;
          return x.done ? "步骤勾销——进度如实回流正文" : "步骤重开";
        }
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.name) return "";
      const undone = s.steps.filter((x) => !x.done);
      return `主线「${s.name}」${s.steps.filter((x) => x.done).length}/${s.steps.length}${undone.length ? `——下一步未完成：${undone[0].t}；主线步骤未完不可跳章` : "——全部完成，写验收与奖励兑现"}`;
    }
  };
  const fudraw = {
    id: "fudraw",
    icon: "🪷",
    name: "符箓画案",
    tip: "一张符一道命——朱砂是念想，清醒是手稳，画符的人先问自己疯没疯",
    contract: "符箓（已画之符整表：「名(凡符/灵符/诡符)」；画符失败与诡异代价当轮也要报「画符失败:…」）；朱砂（余量概况）",
    init: () => ({ chars: [], sand: "" }),
    read(s, v) {
      var _a;
      let d = false;
      const raw = (_a = v["符箓"]) != null ? _a : v["画符"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : String(raw).split(/[、,，;；\n]+/);
        for (const it of arr) {
          let name = "", grade = "凡符";
          if (it && typeof it === "object") {
            name = String(it.name || it.名称 || "").slice(0, 16);
            grade = String(it.grade || it.品阶 || "凡符").slice(0, 4);
          } else {
            const m = String(it).match(/^(.{1,16}?)[（(]?(凡符|灵符|诡符)/);
            if (!m) continue;
            name = m[1].trim();
            grade = m[2];
          }
          if (!name) continue;
          if (!s.chars.some((c) => c.name === name)) {
            if (s.chars.length >= 12) continue;
            s.chars.push({ name, grade, round: curRound() });
            d = true;
          }
        }
      }
      const sand = v["朱砂"];
      if (sand != null && String(sand) !== s.sand) {
        s.sand = String(sand).slice(0, 14);
        d = true;
      }
      return d;
    },
    summary(s) {
      if (!s.chars.length) return [];
      return [{ i: "🪷", v: `${s.chars.length}张`, l: "符在身" }];
    },
    html(s, h) {
      if (!s.chars.length && !s.sand) {
        return h.empty("🪷", "画案空空", "画符随 (variable_update) 上报自动入册；也可手动记符");
      }
      const gradeColor = { "凡符": "#9aa0b4", "灵符": "#6fb0d8", "诡符": "#b48cf0" };
      const rows = s.chars.map((c, i) => `<div class="wx-task">
                <b style="color:${gradeColor[c.grade] || "#9aa0b4"};">● ${esc(c.name)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);font-size:10px;">${esc(c.grade)}·第${c.round}回</span>
                <button class="wx-del" title="用掉/失效" onclick="WorldExt.act('fudraw','del',${i})">✕</button>
            </div>`).join("");
      const sand = s.sand ? h.kv([["朱砂余量", s.sand]]) : "";
      return `${h.card("藏符 · " + s.chars.length + "张", rows, { icon: "🪷", grow: true })}${sand}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('fudraw','add','')">＋ 手动记符</button></div>
            <div class="wx-banner">画符先问清醒：手抖画歪的符会引来不该来的东西；诡符有效但都有代价——动符要写代价，失败要写异象。</div>`;
    },
    act(s, action, payload) {
      if (action === "del") {
        const c = s.chars.splice(Number(payload), 1)[0];
        return c ? `${c.name} 已动用/失效` : "";
      }
      if (action === "add") {
        manualEdit(s, "fudraw", "＋ 记符", "符名（可附品阶：镇尸符=灵符）：", (v) => {
          const [n, g] = v.split(/[=＝]/);
          if (n && s.chars.length < 12) s.chars.push({ name: n.trim().slice(0, 16), grade: (g || "").trim() || "凡符", round: curRound() });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.chars.length) return "";
      const gui = s.chars.filter((c) => c.grade === "诡符").map((c) => c.name);
      return `符在身：${s.chars.slice(-3).map((c) => c.name + "(" + c.grade + ")").join("、")}——动符写实效与代价${gui.length ? `；${gui.join("、")} 是诡符，用一次亏一次，但救命的从来是它们` : ""}`;
    }
  };
  const revenge = {
    id: "revenge",
    icon: "🗡",
    name: "复仇清单",
    tip: "前世欠的，这一世一笔一笔讨回来——清单上的每个名字都有日期",
    contract: "复仇清单（前世仇人整表：「名(恩怨简述,清算进度0-100)」；有清算行动当轮必报；新仇入册也要报）",
    init: () => ({ targets: [] }),
    opts: [{ key: "climax", type: "number", label: "清算高潮线", dflt: 80, tip: "进度越过此线，剧情应逼近总清算" }],
    read(s, v) {
      var _a, _b, _c, _d, _e, _f;
      let d = false;
      const raw = (_b = (_a = v["复仇"]) != null ? _a : v["仇人"]) != null ? _b : v["复仇清单"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.entries(raw).map(([k, x]) => ({ name: k, ...typeof x === "object" ? x : { note: x } })) : String(raw).split(/[；;\n]+/);
        for (const it of arr) {
          let name = "", note = "", prog = null;
          if (it && typeof it === "object") {
            name = String(it.name || it.名 || it.对象 || "").slice(0, 14);
            note = String((_e = (_d = (_c = it.note) != null ? _c : it.恩怨) != null ? _d : it.grudge) != null ? _e : "").slice(0, 30);
            prog = num((_f = it.progress) != null ? _f : it.进度);
          } else {
            const m = String(it).match(/^([^（(:：]{1,14})/);
            if (!m) continue;
            name = m[1].trim();
            const pm = String(it).match(/(\d+)\s*%/);
            prog = pm ? Number(pm[1]) : null;
          }
          if (!name) continue;
          const cur = s.targets.find((t) => t.name === name);
          if (!cur) {
            if (s.targets.length >= 9) continue;
            s.targets.push({ name, note, progress: prog != null ? prog : 0, round: curRound() });
            d = true;
          } else {
            const nn = note || cur.note;
            const np = prog != null ? prog : cur.progress;
            if (nn !== cur.note || np !== cur.progress) {
              cur.note = nn;
              cur.progress = np;
              d = true;
            }
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.targets.length) return [];
      const near = s.targets.filter((t) => t.progress >= OPT("revenge", "climax", 80)).length;
      return [{ i: "🗡", v: `${s.targets.length}仇`, l: near ? `${near}笔临清算` : "复仇清单", tone: near ? "bad" : "" }];
    },
    html(s, h) {
      if (!s.targets.length) {
        return h.empty("🗡", "清单空白", "前世恩怨随 (variable_update) 上报自动入册；也可手动记仇");
      }
      const climax = OPT("revenge", "climax", 80);
      const rows = s.targets.map((t, i) => {
        const g = h.gauge(t.progress, [
          { max: 30, label: "记下", color: "#9aa0b4" },
          { max: 60, label: "布局", color: "#e0c45c" },
          { max: climax, label: "收网", color: "#e0a84c" },
          { max: 100, label: "清算", color: "#ef6a6a" }
        ], "%");
        return `<div class="wx-card" style="margin-bottom:8px;">
                    <div class="wx-card-hd"><span>🗡</span><b>${esc(t.name)}</b><i class="wx-tag">${t.progress >= climax ? "临门" : t.progress + "%"}</i></div>
                    <div class="wx-card-bd">${t.note ? `<div style="font-size:11.5px;color:var(--imt,#9a8c6e);margin-bottom:5px;">${esc(t.note)} · 第${t.round}回入册</div>` : ""}${g.html}
                    <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('revenge','push',${i})">清算推进 +10%</button>
                    <button class="wx-del" title="恩怨了结/除名" onclick="WorldExt.act('revenge','del',${i})">✕</button></div></div>
                </div>`;
      }).join("");
      return `${rows}<div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('revenge','add','')">＋ 手动记仇</button></div>
            <div class="wx-banner">复仇不是抢银行：进度该有布局、试探、收网、清算的节奏；${climax}% 之后就是摊牌时刻——写代价，别写爽文流水账。</div>`;
    },
    act(s, action, payload) {
      if (action === "push") {
        const t = s.targets[Number(payload)];
        if (t) {
          t.progress = Math.min(100, t.progress + 10);
          return `${t.name} 清算推进至 ${t.progress}%`;
        }
        return "";
      }
      if (action === "del") {
        const t = s.targets.splice(Number(payload), 1)[0];
        return t ? `「${t.name}」恩怨了结，从清单除名` : "";
      }
      if (action === "add") {
        manualEdit(s, "revenge", "＋ 记仇", "仇人名（可附恩怨：王鹤檀=前世断我道途）：", (v) => {
          const [n, note] = v.split(/[=＝]/);
          if (n && s.targets.length < 9) s.targets.push({ name: n.trim().slice(0, 14), note: (note || "").trim().slice(0, 30), progress: 0, round: curRound() });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.targets.length) return "";
      const climax = OPT("revenge", "climax", 80);
      const near = s.targets.filter((t) => t.progress >= climax);
      if (near.length) return `复仇清单临清算：${near.map((t) => `${t.name}(${t.progress}%)`).join("、")}——本轮剧情应逼近摊牌：写对方的防备与你的底牌，清算要有代价`;
      return `复仇清单在案：${s.targets.slice(0, 3).map((t) => `${t.name}(${t.progress}%)`).join("、")}——布局要细水长流，恩怨要双线发酵`;
    }
  };
  const sbounty = {
    id: "sbounty",
    icon: "🎓",
    name: "学院任务板",
    tip: "执行部的大红印章——B级跑腿，A级搏命，S级写遗书",
    contract: "任务（学院任务整表：「名(等级B/A/S,佣金,状态:待命/执行中/已完成/失败)」；接取/完结当轮必报）",
    init: () => ({ jobs: [] }),
    read(s, v) {
      return mergeJobs(s, v, "任务", "学院任务");
    },
    summary(s) {
      const doing = s.jobs.filter((j) => /执行|进行/.test(j.status));
      if (!s.jobs.length) return [];
      return [{ i: "🎓", v: doing.length ? `${doing.length}单在身` : `${s.jobs.length}单`, l: "任务板", tone: doing.some((j) => j.rank === "S") ? "bad" : "" }];
    },
    html: jobsHtml("🎓", "任务板", "sbounty", "S级任务签收前先想退路：佣金按危险等级计，言灵暴走与龙类遭遇都是写进合同的死法。"),
    act: jobsAct("sbounty"),
    directive(s) {
      const doing = s.jobs.filter((j) => /执行|进行/.test(j.status));
      if (doing.length) return `执行部任务在身：${doing.map((j) => `${j.name}(${j.rank}级·${j.status})`).join("、")}——任务风险按等级写足，S级要写生死一线`;
      if (s.jobs.length) return `任务板挂着 ${s.jobs.length} 单：学院的任务总会在深夜找上门`;
      return "";
    }
  };
  const gold = {
    id: "gold",
    icon: "🪙",
    name: "黄金市场",
    tip: "黄金是驭鬼者的命——克数就是寿命，交易就是赌命",
    contract: "黄金（当前黄金克数，精确到克）；交易（「+/-N克:事由(与谁/换什么)」逐笔上报）",
    init: () => ({ grams: null, deals: [] }),
    read(s, v) {
      var _a;
      let d = false;
      const g = num((_a = v["黄金"]) != null ? _a : v["黄金克数"]);
      if (g != null && g !== s.grams) {
        s.grams = g;
        d = true;
      }
      d = mergeFlow(s, v["交易"], "deals") || d;
      return d;
    },
    summary(s) {
      if (s.grams == null) return [];
      return [{ i: "🪙", v: `${s.grams}克`, l: "黄金", tone: s.grams <= 10 ? "bad" : "" }];
    },
    html(s, h) {
      if (s.grams == null && !s.deals.length) {
        return h.empty("🪙", "尚无存金", "黄金克数与交易随 (variable_update) 上报自动入账");
      }
      const g = s.grams != null ? h.card("存金 · " + s.grams + " 克", h.gauge(Math.min(100, s.grams), [
        { max: 25, label: "命悬", color: "#ef6a6a" },
        { max: 60, label: "够用", color: "#e0c45c" },
        { max: 100, label: "雄厚", color: "#8fd9a8" }
      ], "").html, { icon: "🪙", tag: "命秤" }) : "";
      const rows = s.deals.map((t, i) => `<div class="wx-task">
                <b style="color:${/^\+/.test(t.text) ? "#a8d8a0" : "#e0a0a0"};font-weight:400;font-size:12px;">${esc(t.text)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);">第${t.round}回</span>
                <button class="wx-del" onclick="WorldExt.act('gold','deld',${i})">✕</button>
            </div>`).join("");
      const deals = s.deals.length ? h.card("交易流水", rows, { icon: "📖", grow: true }) : "";
      return `${g}${deals}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('gold','trade','')">± 手动记账</button></div>
            <div class="wx-banner">驭鬼者市场没有公平价：大宗交易必引人盯梢，来路不明的金子带鬼——写交易要写对方的眼色与斤两。</div>`;
    },
    act(s, action, payload) {
      if (action === "deld") {
        s.deals.splice(Number(payload), 1);
        return "流水已抹去";
      }
      if (action === "trade") {
        manualEdit(s, "gold", "± 黄金记账", "格式：+50 或 -30:事由（如 -30克:雇短工驭鬼人）：", (v) => {
          const m = v.match(/^([+-]?\d+)/);
          if (!m) return;
          const delta = Number(m[1]);
          const note = v.slice(m[0].length).replace(/^[：:]/, "").trim();
          s.deals.unshift({ round: curRound(), text: `${delta >= 0 ? "+" : ""}${delta}克${note ? ":" + note : ""}` });
          if (s.deals.length > 10) s.deals.length = 10;
          if (s.grams != null) s.grams = Math.max(0, s.grams + delta);
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (s.grams == null) return "";
      return `黄金 ${s.grams} 克——克数就是驭鬼者的寿数与底气；交易写市侩与警觉，动黄金前先看对方身后站没站着"人"`;
    }
  };
  const biz = {
    id: "biz",
    icon: "💢",
    name: "摊位经营",
    tip: "进货、出摊、数钱、跑城管——大力出奇迹，账本出生活",
    contract: "摆摊（摊位经营：cash=流动现金；heat=人气0-100；卖出记「+金额:货品」流水，进货记「-花费:货品」）；城管（城管警戒0-100，被盯上/突击检查当轮必报）",
    init: () => ({ cash: null, heat: null, cg: null, flow: [] }),
    opts: [{ key: "cgMax", type: "number", label: "城管突击线", dflt: 70, tip: "警戒越过此线，剧情安排突击检查" }],
    read(s, v) {
      var _a, _b, _c, _d, _e;
      let d = false;
      const raw = (_a = v["摆摊"]) != null ? _a : v["摊位"];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const c = num((_b = raw.cash) != null ? _b : raw.现金);
        if (c != null && c !== s.cash) {
          s.cash = c;
          d = true;
        }
        const ht = num((_c = raw.heat) != null ? _c : raw.人气);
        if (ht != null && ht !== s.heat) {
          s.heat = Math.max(0, Math.min(100, ht));
          d = true;
        }
      }
      d = mergeFlow(s, (_d = v["销售"]) != null ? _d : v["流水"], "flow") || d;
      const cg = num((_e = v["城管"]) != null ? _e : v["警戒"]);
      if (cg != null && cg !== s.cg) {
        s.cg = Math.max(0, Math.min(100, cg));
        d = true;
      }
      return d;
    },
    summary(s) {
      if (s.cash == null && s.heat == null) return [];
      return [{ i: "💢", v: s.cash != null ? "¥" + s.cash : "—", l: "摊上现金", tone: s.cg >= OPT("biz", "cgMax", 70) ? "warn" : "ok" }];
    },
    html(s, h) {
      if (s.cash == null && s.heat == null) {
        return h.empty("💢", "摊还没开张", "开张后随 (variable_update) 上报自动记账；也可手动记一笔");
      }
      const kvs = [];
      if (s.cash != null) kvs.push(["流动现金", "¥" + s.cash]);
      if (s.heat != null) kvs.push(["人气", s.heat + "/100"]);
      const cgMax = OPT("biz", "cgMax", 70);
      const cg = s.cg != null ? h.card("城管警戒", h.gauge(s.cg, [
        { max: 40, label: "太平", color: "#8fd9a8" },
        { max: cgMax, label: "被盯上", color: "#e0c45c" },
        { max: 100, label: "突击检查", color: "#ef6a6a" }
      ], "").html + `<div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('biz','cg','down')">消停 -10</button>
                <button class="wx-btn" onclick="WorldExt.act('biz','cg','up')">作死 +10</button></div>`, { icon: "🚨", tag: s.cg >= cgMax ? "⚠ 危" : "" }) : "";
      const rows = s.flow.map((t, i) => `<div class="wx-task">
                <b style="color:${/^\+/.test(t.text) ? "#a8d8a0" : "#e0a0a0"};font-weight:400;font-size:12px;">${esc(t.text)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);">第${t.round}回</span>
                <button class="wx-del" onclick="WorldExt.act('biz','delf',${i})">✕</button>
            </div>`).join("");
      return `${h.kvs(kvs)}${cg}${s.flow.length ? h.card("买卖流水", rows, { icon: "📖", grow: true }) : ""}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('biz','sell','')">＋ 卖出入账</button>
            <button class="wx-btn" onclick="WorldExt.act('biz','stock','')">－ 进货出账</button></div>
            <div class="wx-banner">小生意写细账：卖什么、赚几块、回头客是谁——人气与警戒此消彼长，暴富之前先跑得过城管。</div>`;
    },
    act(s, action, payload) {
      if (action === "delf") {
        s.flow.splice(Number(payload), 1);
        return "流水已抹去";
      }
      if (action === "cg") {
        if (s.cg == null) s.cg = 40;
        s.cg = Math.max(0, Math.min(100, s.cg + (payload === "up" ? 10 : -10)));
        return `城管警戒 ${s.cg}`;
      }
      if (action === "sell" || action === "stock") {
        const isIn = action === "sell";
        manualEdit(s, "biz", isIn ? "＋ 卖出入账" : "－ 进货出账", isIn ? "金额:货品（如 88:大力丸×10）" : "花费:货品（如 50:秘制药材一批）：", (v) => {
          const m = v.match(/^(\d+)/);
          if (!m) return;
          const amt = Number(m[1]);
          const note = v.slice(m[0].length).replace(/^[：:]/, "").trim();
          s.flow.unshift({ round: curRound(), text: `${isIn ? "+" : "-"}¥${amt}${note ? ":" + note : ""}` });
          if (s.flow.length > 10) s.flow.length = 10;
          if (s.cash != null) s.cash = Math.max(0, s.cash + (isIn ? amt : -amt));
        });
        return "";
      }
      return "";
    },
    directive(s) {
      const t = [];
      const cgMax = OPT("biz", "cgMax", 70);
      if (s.cash != null) t.push(`摊上现金 ¥${s.cash}——数字要具体地进正文`);
      if (s.cg >= cgMax) t.push(`城管警戒 ${s.cg}（已过${cgMax}）——本轮大概率突击检查：跑摊、藏货、罚没都是戏`);
      else if (s.heat != null) t.push(`人气 ${s.heat}/100${s.heat >= 70 ? "——回头客与同行眼红都会来" : ""}`);
      return t.join("；");
    }
  };
  const glory = {
    id: "glory",
    icon: "🎮",
    name: "荣耀角色卡",
    tip: "自建角色的技能栏就是打法——20格技能，点数永远不够",
    contract: "荣耀角色（自建荣耀角色：job=职业；skills=[「技能:等级」…]；技能点=剩余/上限；转职/洗点当轮必报）",
    init: () => ({ job: "", sp: null, spMax: null, skills: [] }),
    read(s, v) {
      var _a, _b, _c, _d, _e;
      let d = false;
      const raw = (_a = v["荣耀角色"]) != null ? _a : v["角色卡"];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const jb = String((_c = (_b = raw.job) != null ? _b : raw.职业) != null ? _c : "").slice(0, 8);
        if (jb && jb !== s.job) {
          s.job = jb;
          d = true;
        }
        const sp = num((_d = raw["技能点"]) != null ? _d : raw.sp);
        if (sp != null && sp !== s.sp) {
          s.sp = sp;
          d = true;
        }
        const sk = (_e = raw.skills) != null ? _e : raw.技能;
        if (Array.isArray(sk)) {
          const next = sk.map((x) => {
            var _a2, _b2, _c2, _d2, _e2;
            if (typeof x === "object") return { n: String((_b2 = (_a2 = x.name) != null ? _a2 : x.技能) != null ? _b2 : "").slice(0, 10), lv: (_e2 = num((_d2 = (_c2 = x.lv) != null ? _c2 : x.等级) != null ? _d2 : x[":"])) != null ? _e2 : 1 };
            const m = String(x).match(/^(.{1,10})[：:=]\s*(\d+)/);
            return m ? { n: m[1].trim(), lv: Number(m[2]) } : { n: String(x).slice(0, 10), lv: 1 };
          }).filter((x) => x.n).slice(0, 20);
          if (JSON.stringify(next) !== JSON.stringify(s.skills)) {
            s.skills = next;
            d = true;
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.job && !s.skills.length) return [];
      return [{ i: "🎮", v: s.job || "荣耀", l: s.sp != null ? `技能点${s.sp}` : `${s.skills.length}技能` }];
    },
    html(s, h) {
      if (!s.job && !s.skills.length) {
        return h.empty("🎮", "角色未建", "自建荣耀角色随 (variable_update) 上报自动建档：职业/技能栏/技能点");
      }
      const kvs = h.kv([["职业", s.job || null], ["技能点(剩余)", s.sp != null ? String(s.sp) : null]]);
      const grid = s.skills.length ? h.card("技能栏 · " + s.skills.length + "格", `<div class="wx-chips">${s.skills.map((x) => `<i style="--wc:${x.lv >= 5 ? "#e8a54f" : "#6fb0d8"};">${esc(x.n)} ${x.lv}</i>`).join("")}</div>`, { icon: "🎮", grow: true }) : "";
      return `${kvs}${grid}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('glory','add','')">＋ 技能入栏</button>
            <button class="wx-btn" onclick="WorldExt.act('glory','del','')">－ 移出技能</button></div>
            <div class="wx-banner">技能栏即打法：放招必须按已录技能来——没点的技能放不出，点了的技能就是你的招牌动作；技能点紧张时写取舍。</div>`;
    },
    act(s, action) {
      if (action === "add") {
        manualEdit(s, "glory", "＋ 技能入栏", "技能:等级（如 千机变:3）：", (v) => {
          const m = v.match(/^(.{1,10})[：:=]?\s*(\d*)/);
          if (m && s.skills.length < 20) {
            const n = m[1].trim();
            const ex = s.skills.find((x) => x.n === n);
            if (ex) ex.lv = Number(m[2]) || ex.lv;
            else s.skills.push({ n, lv: Number(m[2]) || 1 });
          }
        });
        return "";
      }
      if (action === "del") {
        manualEdit(s, "glory", "－ 移出技能", "输入要移出的技能名：", (v) => {
          s.skills = s.skills.filter((x) => x.n !== v);
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.job && !s.skills.length) return "";
      return `荣耀角色${s.job ? "(" + s.job + ")" : ""}：技能栏 ${s.skills.slice(0, 6).map((x) => x.n + x.lv).join("、")}${s.skills.length > 6 ? " 等" + s.skills.length + "格" : ""}——战斗描写必须使用已录技能，招牌连招要固定成型${s.sp != null ? `；剩余技能点 ${s.sp}` : ""}`;
    }
  };
  const disciples = {
    id: "disciples",
    icon: "🏯",
    name: "弟子名册",
    tip: "万古大教，桃李与祸根都从名册里长出来",
    contract: "弟子（门下弟子整表：「名(资质,忠诚0-100,当前境界)」；收徒/叛逃/晋升当轮必报）",
    init: () => ({ list: [] }),
    opts: [{ key: "betray", type: "number", label: "叛师警戒线", dflt: 30, tip: "忠诚低于此线，弟子可能生异心" }],
    read(s, v) {
      var _a, _b, _c, _d, _e, _f, _g;
      let d = false;
      const raw = (_b = (_a = v["弟子"]) != null ? _a : v["门徒"]) != null ? _b : v["弟子名册"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.entries(raw).map(([k, x]) => ({ name: k, ...typeof x === "object" ? x : { realm: x } })) : String(raw).split(/[、,，;；\n]+/);
        for (const it of arr) {
          let name = "", apt = "", loyal = null, realm = "";
          if (it && typeof it === "object") {
            name = String(it.name || it.名 || "").slice(0, 12);
            apt = String((_d = (_c = it.apt) != null ? _c : it.资质) != null ? _d : "").slice(0, 10);
            loyal = num((_e = it.loyal) != null ? _e : it.忠诚);
            realm = String((_g = (_f = it.realm) != null ? _f : it.境界) != null ? _g : "").slice(0, 12);
          } else {
            const m = String(it).match(/^([^（(]{1,12})/);
            if (!m) continue;
            name = m[1].trim();
          }
          if (!name) continue;
          const cur = s.list.find((x) => x.name === name);
          if (!cur) {
            if (s.list.length >= 9) continue;
            s.list.push({ name, apt, loyal: loyal != null ? loyal : 60, realm, round: curRound() });
            d = true;
          } else {
            const na = apt || cur.apt, nl = loyal != null ? loyal : cur.loyal, nr = realm || cur.realm;
            if (na !== cur.apt || nl !== cur.loyal || nr !== cur.realm) {
              Object.assign(cur, { apt: na, loyal: nl, realm: nr });
              d = true;
            }
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.list.length) return [];
      const betray = OPT("disciples", "betray", 30);
      const low = s.list.filter((x) => x.loyal < betray).length;
      return [{ i: "🏯", v: `${s.list.length}徒`, l: low ? `${low}人生异心` : "弟子名册", tone: low ? "bad" : "" }];
    },
    html(s, h) {
      if (!s.list.length) {
        return h.empty("🏯", "名册空空", "收徒随 (variable_update) 上报自动入册；也可手动录徒");
      }
      const betray = OPT("disciples", "betray", 30);
      const rows = s.list.map((x, i) => {
        const lc = x.loyal >= 70 ? "#8fd9a8" : x.loyal >= betray ? "#e0c45c" : "#ef6a6a";
        return `<div class="wx-task">
                    <b>${esc(x.name)}${x.apt ? ` <span style="font-size:10px;color:var(--imt,#9a8c6e);">${esc(x.apt)}${x.realm ? "·" + esc(x.realm) : ""}</span>` : ""}</b>
                    <span class="st" style="color:${lc};font-size:10.5px;">忠${x.loyal}</span>
                    <button class="wx-btn" style="padding:2px 8px;font-size:10.5px;" onclick="WorldExt.act('disciples','up',${i})">赏</button>
                    <button class="wx-btn" style="padding:2px 8px;font-size:10.5px;" onclick="WorldExt.act('disciples','down',${i})">敲</button>
                    <button class="wx-del" title="逐出师门" onclick="WorldExt.act('disciples','del',${i})">✕</button>
                </div>`;
      }).join("");
      return `${h.card("名册 · " + s.list.length + "人", rows, { icon: "🏯", grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('disciples','add','')">＋ 收徒入册</button></div>
            <div class="wx-banner">忠诚是万古最难修的功法：低忠者生异心，高资者惹觊觎——徒弟的境界涨得比你快的那天，想想兜里的丹方还保不保得住。</div>`;
    },
    act(s, action, payload) {
      const step = (d) => {
        const x = s.list[Number(payload)];
        if (x) {
          x.loyal = Math.max(0, Math.min(100, x.loyal + d));
          return `${x.name} 忠诚 ${x.loyal}`;
        }
        return "";
      };
      if (action === "up") return step(5);
      if (action === "down") return step(-5);
      if (action === "del") {
        const x = s.list.splice(Number(payload), 1)[0];
        return x ? `${x.name} 已逐出/离册` : "";
      }
      if (action === "add") {
        manualEdit(s, "disciples", "＋ 收徒入册", "姓名（可附资质：李慕白=上上之资）：", (v) => {
          const [n, a] = v.split(/[=＝]/);
          if (n && s.list.length < 9) s.list.push({ name: n.trim().slice(0, 12), apt: (a || "").trim().slice(0, 10), loyal: 60, realm: "", round: curRound() });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.list.length) return "";
      const betray = OPT("disciples", "betray", 30);
      const low = s.list.filter((x) => x.loyal < betray);
      if (low.length) return `弟子 ${low.map((x) => `${x.name}(忠${x.loyal})`).join("、")} 已生异心之相——忠诚不修，后方起火`;
      return `门下 ${s.list.length} 徒：${s.list.slice(0, 3).map((x) => x.name).join("、")}——弟子是臂膀也是软肋，高资弟子会引外人觊觎`;
    }
  };
  const hbounty = {
    id: "hbounty",
    icon: "📡",
    name: "猎者任务板",
    tip: "协会悬赏，魔物明码标价——结界外的世界，用命换佣金",
    contract: "任务（猎者任务整表：「名(危险等级D-C-B-A-S,佣金,状态:待命/执行中/已完成/失败)」；接取/完结当轮必报）",
    init: () => ({ jobs: [] }),
    read(s, v) {
      return mergeJobs(s, v, "任务", "猎者任务", "悬赏");
    },
    summary(s) {
      const doing = s.jobs.filter((j) => /执行|进行/.test(j.status));
      if (!s.jobs.length) return [];
      return [{ i: "📡", v: doing.length ? `${doing.length}单在身` : `${s.jobs.length}单`, l: "任务板", tone: doing.some((j) => j.rank === "S") ? "bad" : "" }];
    },
    html: jobsHtml("📡", "任务板", "hbounty", "猎者守则：危险等级是协会用命换来的经验——写讨伐要写元素克制、魔物习性与城市结界的边界。"),
    act: jobsAct("hbounty"),
    directive(s) {
      const doing = s.jobs.filter((j) => /执行|进行/.test(j.status));
      if (doing.length) return `猎者任务在身：${doing.map((j) => `${j.name}(${j.rank}级·${j.status})`).join("、")}——讨伐写元素克制与魔物凶性，佣金该入账`;
      return "";
    }
  };
  const manor = {
    id: "manor",
    icon: "⚙",
    name: "领地建设",
    tip: "魔导革命的每一块砖——工期、材料与领民的饭碗",
    contract: "领地（在建工程整表：「名(工期N天,余M天)」；开工/竣工当轮必报；材料消耗记账进行囊）",
    init: () => ({ builds: [], _lastRound: -1, _fp: "" }),
    read(s, v, round) {
      var _a, _b, _c, _d;
      let d = false;
      const raw = (_b = (_a = v["领地"]) != null ? _a : v["建设"]) != null ? _b : v["工程"];
      if (raw != null) {
        let fp = "";
        try {
          fp = JSON.stringify(raw);
        } catch (e) {
          fp = String(raw);
        }
        const changed = fp !== s._fp;
        s._fp = fp;
        if (changed) {
          const arr = Array.isArray(raw) ? raw : String(raw).split(/[、,，;；\n]+/);
          for (const it of arr) {
            let name = "", left = null, days = null;
            if (it && typeof it === "object") {
              name = String(it.name || it.名称 || "").slice(0, 14);
              left = num((_c = it.left) != null ? _c : it.剩余);
              days = num((_d = it.days) != null ? _d : it.工期);
            } else {
              const m = String(it).match(/^(.{1,14}?)[（(]?(?:工期?\d+天[，,]?)?余(\d+)天/);
              if (!m) continue;
              name = m[1].trim();
              left = Number(m[2]);
            }
            if (!name) continue;
            const cur = s.builds.find((b) => b.name === name);
            if (!cur) {
              if (s.builds.length >= 6) continue;
              s.builds.push({ name, days: days != null ? days : left != null ? left : 3, left: left != null ? left : 3 });
              d = true;
            } else if (left != null && left !== cur.left) {
              cur.left = left;
              d = true;
            }
          }
        }
      }
      if (round !== s._lastRound) {
        s._lastRound = round;
        for (const b of s.builds) if (b.left > 0) {
          b.left--;
          d = true;
        }
        const done = s.builds.filter((b) => b.left === 0);
        for (const b of done) {
          try {
            window.showToast && showToast(`⚙ 竣工：${b.name}`, "success");
          } catch (e) {
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.builds.length) return [];
      return [{ i: "⚙", v: `${s.builds.length}项`, l: "在建", tone: "" }];
    },
    html(s, h) {
      if (!s.builds.length) {
        return h.empty("⚙", "领地百业待兴", "开工随 (variable_update) 上报自动立项；工期随轮次自动推进");
      }
      const rows = s.builds.map((b, i) => `<div class="wx-task">
                <b>${esc(b.name)}</b>
                <span class="st" style="color:${b.left <= 0 ? "#8fd9a8" : "var(--imt,#9a8c6e)"};font-size:10.5px;">${b.left > 0 ? `余${b.left}天` : "已竣工 ✓"}</span>
                ${b.left <= 0 ? `<button class="wx-del" title="归档移除" onclick="WorldExt.act('manor','del',${i})">✕</button>` : ""}
            </div>`).join("");
      return `${h.card("在建 · " + s.builds.length + "项", rows, { icon: "⚙", grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('manor','add','')">＋ 立项开工</button></div>
            <div class="wx-banner">工期随轮次推进：开工扣料（记账进行囊）、竣工写实用——高炉、道路、魔导路灯，每一项都在改写废土的模样。</div>`;
    },
    act(s, action, payload) {
      if (action === "del") {
        const b = s.builds.splice(Number(payload), 1)[0];
        return b ? `${b.name} 已归档` : "";
      }
      if (action === "add") {
        manualEdit(s, "manor", "＋ 立项开工", "工程名=工期天数（如 炼铁高炉=5）：", (v) => {
          var _a;
          const [n, d0] = v.split(/[=＝]/);
          const dd = (_a = num(d0)) != null ? _a : 3;
          if (n && s.builds.length < 6) s.builds.push({ name: n.trim().slice(0, 14), days: dd, left: dd });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.builds.length) return "";
      const doing = s.builds.filter((b) => b.left > 0);
      return doing.length ? `领地在建：${doing.map((b) => `${b.name}(余${b.left}天)`).join("、")}——工期、材料、领民用工都要写实；竣工当轮写投用之利` : `领地工程均已竣工——写领地新貌与民气变化`;
    }
  };
  const fruit = {
    id: "fruit",
    icon: "🫐",
    name: "异果采摘录",
    tip: "山巅一枚果，人间百年身——药力与反噬总是同一口",
    contract: "异果（采摘异果整表：「名:药力/反噬」；服用心得当轮必报「服用:名(体感)」）",
    init: () => ({ picks: [] }),
    read(s, v) {
      var _a, _b, _c;
      let d = false;
      const raw = (_a = v["异果"]) != null ? _a : v["采摘"];
      if (raw != null) {
        const arr = Array.isArray(raw) ? raw : String(raw).split(/[；;\n]+/);
        for (const it of arr) {
          let name = "", effect = "";
          if (typeof it === "object") {
            name = String(it.name || it.名 || "").slice(0, 12);
            effect = String((_c = (_b = it.effect) != null ? _b : it.药力) != null ? _c : "").slice(0, 30);
          } else {
            const m = String(it).match(/^([^：:]{1,12})[：:]?\s*(.*)$/);
            if (!m) continue;
            name = m[1].trim();
            effect = (m[2] || "").trim().slice(0, 30);
          }
          if (!name) continue;
          if (!s.picks.some((p) => p.name === name && p.effect === effect)) {
            if (s.picks.length >= 12) continue;
            s.picks.push({ name, effect, round: curRound() });
            d = true;
          }
        }
      }
      return d;
    },
    summary(s) {
      if (!s.picks.length) return [];
      return [{ i: "🫐", v: `${s.picks.length}果`, l: "异果录" }];
    },
    html(s, h) {
      if (!s.picks.length) {
        return h.empty("🫐", "背篓空空", "采摘随 (variable_update) 上报自动入录；也可手动记果");
      }
      const rows = s.picks.map((p, i) => `<div class="wx-task">
                <b>${esc(p.name)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);font-size:10.5px;">${esc(p.effect || "药力未知")} · 第${p.round}回</span>
                <button class="wx-del" onclick="WorldExt.act('fruit','del',${i})">✕</button>
            </div>`).join("");
      return `${h.card("采摘录 · " + s.picks.length + "果", rows, { icon: "🫐", grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('fruit','add','')">＋ 手动记果</button></div>
            <div class="wx-banner">异果写体感不写面板：一果下肚，写呼吸、写心跳、写指尖的变化；反噬从不缺席——天地没白给的东西。</div>`;
    },
    act(s, action, payload) {
      if (action === "del") {
        const p = s.picks.splice(Number(payload), 1)[0];
        return p ? `${p.name} 已服用/记档移除` : "";
      }
      if (action === "add") {
        manualEdit(s, "fruit", "＋ 记果", "果名:药力（如 血珊瑚:温养经脉）：", (v) => {
          const [n, e] = v.split(/[：:]/);
          if (n && s.picks.length < 12) s.picks.push({ name: n.trim().slice(0, 12), effect: (e || "").trim().slice(0, 30), round: curRound() });
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.picks.length) return "";
      return `采摘录在案：${s.picks.slice(-3).map((p) => p.name).join("、")}——异果药力写生理变化，动辄脱胎换骨也要写脱胎换骨的疼`;
    }
  };
  const escort = {
    id: "escort",
    icon: "🧾",
    name: "镖局账本",
    tip: "走镖三分险，账本七分清——现银与恩怨都要笔笔分明",
    contract: "镖局（镖局账本：镖银=现银两；走镖记「+报酬:单子」流水，损耗记「-花费:事由」）",
    init: () => ({ cash: null, runs: [] }),
    read(s, v) {
      var _a, _b;
      let d = false;
      const c = num((_a = v["镖银"]) != null ? _a : v["现银"]);
      if (c != null && c !== s.cash) {
        s.cash = c;
        d = true;
      }
      d = mergeFlow(s, (_b = v["走镖"]) != null ? _b : v["镖局流水"], "runs") || d;
      return d;
    },
    summary(s) {
      if (s.cash == null && !s.runs.length) return [];
      return [{ i: "🧾", v: s.cash != null ? s.cash + "两" : "—", l: "镖局现银" }];
    },
    html(s, h) {
      if (s.cash == null && !s.runs.length) {
        return h.empty("🧾", "账本未开", "走镖随 (variable_update) 上报自动入账；也可手动记一笔");
      }
      const rows = s.runs.map((t, i) => `<div class="wx-task">
                <b style="color:${/^\+/.test(t.text) ? "#a8d8a0" : "#e0a0a0"};font-weight:400;font-size:12px;">${esc(t.text)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);">第${t.round}回</span>
                <button class="wx-del" onclick="WorldExt.act('escort','del',${i})">✕</button>
            </div>`).join("");
      return `${s.cash != null ? h.kv([["现银", s.cash + " 两"]]) : ""}${s.runs.length ? h.card("流水 · " + s.runs.length + "笔", rows, { icon: "📖", grow: true }) : ""}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('escort','in','')">＋ 收镖银</button>
            <button class="wx-btn" onclick="WorldExt.act('escort','out','')">－ 开销</button></div>
            <div class="wx-banner">走镖写路线、写客源、写劫道的——账本清楚，江湖才走得远；亏本的镖背后多半有恩怨。</div>`;
    },
    act(s, action, payload) {
      if (action === "del") {
        s.runs.splice(Number(payload), 1);
        return "流水已抹去";
      }
      if (action === "in" || action === "out") {
        const isIn = action === "in";
        manualEdit(s, "escort", isIn ? "＋ 收镖银" : "－ 开销", isIn ? "两数:单子（如 300:保镖杭州府）" : "两数:事由（如 40:打点关卡）：", (v) => {
          const m = v.match(/^(\d+)/);
          if (!m) return;
          const amt = Number(m[1]);
          const note = v.slice(m[0].length).replace(/^[：:]/, "").trim();
          s.runs.unshift({ round: curRound(), text: `${isIn ? "+" : "-"}${amt}两${note ? ":" + note : ""}` });
          if (s.runs.length > 10) s.runs.length = 10;
          if (s.cash != null) s.cash = Math.max(0, s.cash + (isIn ? amt : -amt));
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (s.cash == null) return "";
      return `镖局现银 ${s.cash} 两——账本贴身走江湖：接镖写行情与险要，亏空的镖里有恩怨`;
    }
  };
  const voyage = {
    id: "voyage",
    icon: "🚀",
    name: "星图航程",
    tip: "航线就是命运——目的地定了，路上的每一天都在消耗",
    contract: "航程（星图航程：dest=目的地，days=剩余航行日，route=航线概况；转向/抵达当轮必报）",
    init: () => ({ dest: "", route: "", days: null, _lastRound: -1, _fp: "" }),
    read(s, v, round) {
      var _a, _b, _c, _d, _e, _f;
      let d = false;
      const raw = (_a = v["航程"]) != null ? _a : v["星图"];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        let fp = "";
        try {
          fp = JSON.stringify(raw);
        } catch (e) {
          fp = String(raw);
        }
        const changed = fp !== s._fp;
        s._fp = fp;
        if (changed) {
          const de = String((_c = (_b = raw.dest) != null ? _b : raw.目的地) != null ? _c : "").slice(0, 14);
          const rt = String((_e = (_d = raw.route) != null ? _d : raw.航线) != null ? _e : "").slice(0, 24);
          const dd = num((_f = raw.days) != null ? _f : raw.剩余);
          if (de && de !== s.dest) {
            s.dest = de;
            d = true;
          }
          if (rt && rt !== s.route) {
            s.route = rt;
            d = true;
          }
          if (dd != null && dd !== s.days) {
            s.days = dd;
            d = true;
          }
        }
      }
      if (s.days != null && s.days > 0 && round !== s._lastRound) {
        s._lastRound = round;
        s.days--;
        d = true;
      }
      return d;
    },
    summary(s) {
      if (!s.dest && s.days == null) return [];
      return [{ i: "🚀", v: s.dest || "深空", l: s.days != null ? `余${s.days}日` : "航行中", tone: s.days != null && s.days <= 2 ? "warn" : "" }];
    },
    html(s, h) {
      if (!s.dest && s.days == null) {
        return h.empty("🚀", "尚未启航", "设定航线随 (variable_update) 上报自动入册；也可手动定目的地");
      }
      const kvs = h.kv([["目的地", s.dest || null], ["航线", s.route || null], ["剩余航行", s.days != null ? s.days + " 日" : null]]);
      return `${kvs}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('voyage','set','')">✎ 定航线/改目的地</button></div>
            <div class="wx-banner">航行日随轮次推进：深空的一天写日常与暗涌——氧气、燃料、船员的神经，抵达那章写星港第一眼。</div>`;
    },
    act(s, action) {
      if (action === "set") {
        manualEdit(s, "voyage", "✎ 定航线", "目的地=航行天数（如 土卫六=12）：", (v) => {
          const [d0, d1] = v.split(/[=＝]/);
          if (d0) s.dest = d0.trim().slice(0, 14);
          const dd = num(d1);
          if (dd != null) s.days = dd;
        });
        return "";
      }
      return "";
    },
    directive(s) {
      if (!s.dest && s.days == null) return "";
      return `航向 ${s.dest || "深空"}${s.days != null ? `，余 ${s.days} 航行日` : ""}——航行日推进写船务与人心，资源低于警戒线时危机自来`;
    }
  };
  const investigator = {
    id: "investigator",
    icon: "🕯",
    name: "调查员档案",
    tip: "生命值与职业——理智之外，身体也是会被拿走的",
    contract: "调查员（hp=生命值数字；job=职业；受伤=伤势概况；愈合成加重当轮必报）",
    init: () => ({ hp: null, job: "", wound: "" }),
    read(s, v) {
      var _a, _b, _c, _d, _e, _f, _g;
      let d = false;
      const raw = v["调查员"];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const hp = num((_a = raw.hp) != null ? _a : raw.生命);
        const jb = String((_c = (_b = raw.job) != null ? _b : raw.职业) != null ? _c : "").slice(0, 10);
        const w = String((_e = (_d = raw.受伤) != null ? _d : raw.wound) != null ? _e : "").slice(0, 20);
        if (hp != null && hp !== s.hp) {
          s.hp = hp;
          d = true;
        }
        if (jb && jb !== s.job) {
          s.job = jb;
          d = true;
        }
        if (w !== s.wound) {
          s.wound = w;
          d = true;
        }
      } else {
        const hp = num((_g = (_f = v["生命"]) != null ? _f : v["hp"]) != null ? _g : v["HP"]);
        if (hp != null && hp !== s.hp) {
          s.hp = hp;
          d = true;
        }
      }
      return d;
    },
    summary(s) {
      if (s.hp == null && !s.job) return [];
      return [{ i: "🕯", v: s.hp != null ? `HP${s.hp}` : s.job || "调查员", l: s.wound ? "带伤" : "调查中", tone: s.hp != null && s.hp <= 30 ? "bad" : "" }];
    },
    html(s, h) {
      if (s.hp == null && !s.job) {
        return h.empty("🕯", "档案未立", "生命值与职业随 (variable_update) 上报自动建档");
      }
      const g = s.hp != null ? h.card("生命值 · " + s.hp, h.gauge(s.hp, [
        { max: 25, label: "濒死", color: "#ef6a6a" },
        { max: 55, label: "重伤", color: "#e0a84c" },
        { max: 100, label: "无碍", color: "#8fd9a8" }
      ], "").html + `<div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('investigator','hp','down')">受创 -10</button>
                <button class="wx-btn" onclick="WorldExt.act('investigator','hp','up')">包扎 +10</button></div>`, { icon: "❤️", tag: s.hp <= 30 ? "⚠ 危" : "" }) : "";
      const kvs = h.kv([["职业", s.job || null], ["伤势", s.wound || null]]);
      return `${g}${kvs}
            <div class="wx-banner">肉体与理智一样会被拿走：hp 归零前每一点都写痛感；重伤的调查员跑不过任何东西。</div>`;
    },
    act(s, action, payload) {
      if (action === "hp") {
        if (s.hp == null) return "";
        s.hp = Math.max(0, Math.min(100, s.hp + (payload === "up" ? 10 : -10)));
        return `生命值 ${s.hp}`;
      }
      return "";
    },
    directive(s) {
      if (s.hp == null && !s.job) return "";
      const t = [];
      if (s.hp != null) t.push(`生命值 ${s.hp}${s.hp <= 30 ? "——濒死线上，本轮写体感与求生本能" : "，受伤要写实痛感"}`);
      if (s.job) t.push(`职业「${s.job}」——调查手段贴合职业本能`);
      return t.join("；");
    }
  };
  function mergeJobs(s, v, ...keys) {
    var _a, _b, _c, _d, _e, _f;
    let d = false;
    const raw = keys.map((k) => v[k]).find((x) => x != null);
    if (raw != null) {
      const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.entries(raw).map(([k, x]) => ({ name: k, ...typeof x === "object" ? x : { status: x } })) : String(raw).split(/[；;\n]+/);
      for (const it of arr) {
        let name = "", rank = "", pay = "", status = "待命";
        if (typeof it === "object") {
          name = String(it.name || it.任务 || "").slice(0, 18);
          rank = String((_b = (_a = it.rank) != null ? _a : it.等级) != null ? _b : "").slice(0, 3).toUpperCase();
          pay = String((_d = (_c = it.pay) != null ? _c : it.佣金) != null ? _d : "").slice(0, 12);
          status = String((_f = (_e = it.status) != null ? _e : it.状态) != null ? _f : "待命").slice(0, 6);
        } else {
          const m = String(it).match(/^([^（(]{1,18})/);
          if (!m) continue;
          name = m[1].trim();
        }
        if (!name) continue;
        const cur = s.jobs.find((j) => j.name === name);
        if (!cur) {
          if (s.jobs.length >= 8) continue;
          s.jobs.push({ name, rank, pay, status, round: curRound() });
          d = true;
        } else if (rank !== cur.rank || pay !== cur.pay || status !== cur.status) {
          Object.assign(cur, { rank, pay, status });
          d = true;
        }
      }
    }
    return d;
  }
  function jobsHtml(icon, boxName, modId, banner) {
    return function(s, h) {
      if (!s.jobs.length) {
        return h.empty(icon, boxName + "空着", "接单与完结随 (variable_update) 上报自动入板；也可手动挂单");
      }
      const rc = { "S": "#ef6a6a", "A": "#e8a54f", "B": "#b48cf0", "C": "#6fb0d8", "D": "#9aa0b4" };
      const rows = s.jobs.map((j, i) => `<div class="wx-task">
                <b><span style="color:${rc[j.rank] || "#9aa0b4"};font-weight:700;">${esc(j.rank || "·")}</span> ${esc(j.name)}${j.pay ? ` <span style="font-size:10px;color:var(--imt,#9a8c6e);">${esc(j.pay)}</span>` : ""}</b>
                <span class="st" style="color:${/执行|进行/.test(j.status) ? "#e0a84c" : /完成/.test(j.status) ? "#8fd9a8" : /失败/.test(j.status) ? "#e07070" : "var(--imt,#9a8c6e)"};font-size:10.5px;cursor:pointer;" onclick="WorldExt.act('${modId}','cycle',${i})">${esc(j.status)}</span>
                <button class="wx-del" onclick="WorldExt.act('${modId}','del',${i})">✕</button>
            </div>`).join("");
      return `${h.card(boxName + " · " + s.jobs.length + "单", rows, { icon, grow: true })}
            <div class="wx-slot"><button class="wx-btn" onclick="WorldExt.act('${modId}','add','')">＋ 手动挂单</button></div>
            <div class="wx-banner">${esc(banner)}</div>`;
    };
  }
  function jobsAct(modId) {
    return function(s, action, payload) {
      if (action === "cycle") {
        const j = s.jobs[Number(payload)];
        if (!j) return "";
        const flow = ["待命", "执行中", "已完成", "失败"];
        j.status = flow[(flow.indexOf(j.status) + 1) % flow.length];
        return `${j.name} → ${j.status}`;
      }
      if (action === "del") {
        const j = s.jobs.splice(Number(payload), 1)[0];
        return j ? `「${j.name}」已下板` : "";
      }
      if (action === "add") {
        manualEdit(s, modId, "＋ 挂单", "任务名（可附等级:佣金，如 护送商队=B:80两）：", (v) => {
          const m = v.match(/^(.{1,18}?)(?:[=＝]([A-Da-dSs]))?(?:[:：]([^：:]+))?$/);
          if (m && s.jobs.length < 8) s.jobs.push({ name: m[1].trim(), rank: (m[2] || "").toUpperCase(), pay: (m[3] || "").trim().slice(0, 12), status: "待命", round: curRound() });
        });
        return "";
      }
      return "";
    };
  }
  function mergeFlow(s, raw, key) {
    var _a, _b, _c;
    if (raw == null) return false;
    let d = false;
    const arr = Array.isArray(raw) ? raw : String(raw).split(/[；;\n]+/);
    for (const it of arr) {
      let text = "";
      if (typeof it === "object") text = String((_c = (_b = (_a = it.text) != null ? _a : it.事由) != null ? _b : it.note) != null ? _c : "").slice(0, 30);
      else text = String(it).trim().slice(0, 30);
      if (!text) continue;
      if (!s[key].some((x) => x.text === text)) {
        s[key].unshift({ round: curRound(), text });
        if (s[key].length > 10) s[key].length = 10;
        d = true;
      }
    }
    return d;
  }
  const MODS = {
    doupocangqiong: [fenjue],
    douluodalu: [soulhunt],
    swallowedstar: [quantify],
    shrouding: [garden],
    wanmeishijie: [huntlog],
    wulianfengdian: [forge],
    xianni: [bead],
    fanrenxiuxian: [bottle],
    lunhuileyuan: [mainquest],
    /* v3.35.0 第二批（B/C 队列 + 创作工坊） */
    daoguiyixian: [fudraw],
    zhongshengdushi: [revenge],
    longzu: [sbounty],
    shenmifusu: [gold],
    ditandali: [biz],
    quanzhigaoshou: [glory],
    dibao: [disciples],
    quanzhifashi: [hbounty],
    limingzhijian: [manor],
    shengxu: [fruit],
    wuxia: [escort],
    scifi: [voyage],
    cthulhu: [investigator]
  };
  const defs = MODS[genre];
  if (defs) {
    if (window.ModuleSettings) {
      for (const m of defs) if (m.opts) ModuleSettings.describe(m.id, m.opts);
    }
    WorldExt.injectModules(genre, defs);
  }
  window.WorldPlus = { version: VERSION };
})();
