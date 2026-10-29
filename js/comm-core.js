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
  const CFG = window.CommConfigs && CommConfigs.forGenre ? CommConfigs.forGenre(genre) : null;
  if (!CFG || !window.WorldExt) return;
  if (window.ModuleSettings) ModuleSettings.describe("comm", [
    { key: "autoReply", type: "bool", label: "发讯后 NPC 自动回信", dflt: true, tip: "关闭后只记录讯息，不调用 AI 回信" },
    { key: "delaySim", type: "bool", label: "拟真投递延迟", dflt: true, tip: "回信前模拟媒介传递的等待与打字时间" },
    { key: "sendCostOn", type: "bool", label: "发送消耗媒介", dflt: !!CFG.sendCost, tip: CFG.sendCost ? `每发一条扣「${CFG.sendCost.item}」×${CFG.sendCost.count}（记账进背包）` : "本界通讯无消耗" },
    { key: "proactive", type: "bool", label: "NPC 主动传讯指引", dflt: true, tip: "允许「世界近讯」引导主笔安排 NPC 主动传来讯息" },
    { key: "idleFloor", type: "number", label: "温度地板（0-100）", dflt: 30, tip: "闲置降温的最低温度——再冷的关系也留一点底" },
    { key: "idleDecay", type: "number", label: "几轮不联系开始降温", dflt: 10, tip: "超过此轮数，温度每轮向地板缓降" },
    { key: "histCap", type: "number", label: "每人历史条数上限", dflt: 60, tip: "超出自动淘汰最旧，防存储膨胀" }
  ]);
  const OPT = (k, d) => window.ModuleSettings ? ModuleSettings.opt("comm", k, d) : d;
  const $id = (i) => document.getElementById(i);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = h * 31 + s.charCodeAt(i) | 0;
    }
    return Math.abs(h);
  }
  const hueOf = (name) => hash(String(name)) % 360;
  function playerName() {
    try {
      return (window.storyFramework.storyState.setup || {}).playerName || "主角";
    } catch (e) {
      return "主角";
    }
  }
  function worldName() {
    try {
      const t = window.ImmersiveSuite && ImmersiveSuite.themes && ImmersiveSuite.themes[genre];
      return t && t.name || genre;
    } catch (e) {
      return genre;
    }
  }
  function themeVars() {
    let t = {};
    try {
      t = window.ImmersiveSuite && ImmersiveSuite.themes && ImmersiveSuite.themes[genre] || {};
    } catch (e) {
    }
    return `--ip:${t.primary || "#c9a86a"};--ia:${t.accent || "#a8d8e0"};--id:${t.deep || "#161410"};--ipn:${t.panel || "#1d1a16"};--itx:${t.text || "#e8dcc0"};--imt:${t.muted || "#9a8c6e"};`;
  }
  const jn = (name) => String(name).replace(/'/g, "");
  function curRound() {
    try {
      return Number(window.storyFramework.storyState.variables.chapter) || 0;
    } catch (e) {
      return 0;
    }
  }
  function seedTemp(s, name) {
    var _a;
    let favor = 50;
    try {
      const c = (window.storyFramework.storyState.variables.characters || {})[name];
      const f = c && ((_a = c.favor) != null ? _a : c.好感);
      if (Number.isFinite(Number(f))) favor = Number(f);
    } catch (e) {
    }
    s.temp[name] = { w: Math.max(0, Math.min(100, favor)), idle: 0, star: false };
  }
  function attitude(w) {
    return w >= 80 ? "极为亲近，讯里带着明显的信任与牵挂" : w >= 60 ? "友善熟络" : w >= 40 ? "客气而保留" : w >= 20 ? "冷淡提防" : "敌意明显，字字带刺";
  }
  function tempTick(s, round) {
    const floor = Math.max(0, Math.min(100, OPT("idleFloor", 30)));
    const after = Math.max(1, Math.round(OPT("idleDecay", 10)));
    for (const [name, t] of Object.entries(s.temp || {})) {
      t.idle = (t.idle || 0) + 1;
      if (t.idle > after) {
        const f = t.star ? Math.max(floor, 60) : floor;
        if (t.w > f) t.w = Math.max(f, t.w - 1);
      }
    }
  }
  function bumpTemp(s, name, d) {
    const t = s.temp[name];
    if (!t) return;
    t.w = Math.max(0, Math.min(100, t.w + d));
  }
  function syncContacts(s, vars) {
    let d = false;
    const chars = vars && vars.characters || {};
    const me = playerName();
    for (const [name, c] of Object.entries(chars)) {
      if (!name || name === me) continue;
      if (!s.contacts[name]) {
        s.contacts[name] = { role: String(c && (c.role || c.身份) || "") };
        seedTemp(s, name);
        s.chats[name] = { msgs: [], unread: 0 };
        d = true;
      } else {
        const role = String(c && (c.role || c.身份) || "");
        if (role && role !== s.contacts[name].role) {
          s.contacts[name].role = role;
          d = true;
        }
      }
    }
    const names = Object.keys(s.contacts);
    if (names.length > 30) {
      names.sort((a, b) => s.chats[b].msgs.length - s.chats[a].msgs.length);
      for (const n of names.slice(30)) {
        if (!s.chats[n].msgs.length) {
          delete s.contacts[n];
          delete s.chats[n];
          delete s.temp[n];
          d = true;
        }
      }
    }
    return d;
  }
  function ingestFeed(s, vars, round) {
    var _a, _b;
    let d = false;
    const raw = vars ? (_b = (_a = vars["通讯"]) != null ? _a : vars["传讯"]) != null ? _b : vars["comm"] : null;
    if (!raw) return d;
    let fp = "";
    try {
      fp = JSON.stringify(raw);
    } catch (e) {
      fp = String(raw);
    }
    if (fp === s._feedHash) return d;
    s._feedHash = fp;
    const cap = Math.max(10, Math.round(OPT("histCap", 60)));
    const list = Array.isArray(raw) ? raw : typeof raw === "object" ? [raw] : String(raw).split(/[；;\n]+/);
    for (const it of list) {
      let name = "", text = "";
      if (it && typeof it === "object") {
        name = String(it.对象 || it.name || it.from || "").trim();
        text = String(it.内容 || it.text || it.content || it.讯息 || "").trim();
      } else {
        const m = String(it).match(/^([^：:]{1,12})[：:]\s*(.+)$/);
        if (m) {
          name = m[1].trim();
          text = m[2].trim();
        }
      }
      if (!name || !text) continue;
      if (!s.contacts[name]) continue;
      const ch = s.chats[name];
      const last = ch.msgs[ch.msgs.length - 1];
      if (last && last.r === "npc" && last.t === text) continue;
      ch.msgs.push({ r: "npc", t: text.slice(0, 120), at: round });
      if (ch.msgs.length > cap) ch.msgs.splice(0, ch.msgs.length - cap);
      ch.unread = (ch.unread || 0) + 1;
      const t = s.temp[name];
      if (t) t.idle = 0;
      d = true;
      try {
        window.showToast && showToast(`${CFG.icon} ${name} 传讯抵达（${CFG.name}）`, "success");
      } catch (e) {
      }
      try {
        window.AudioBox && AudioBox.event("letter");
      } catch (e) {
      }
    }
    return d;
  }
  const commMod = {
    id: "comm",
    icon: CFG.icon,
    name: CFG.boxName,
    tip: CFG.tip,
    init: () => ({ contacts: {}, chats: {}, temp: {}, _order: [], lastRound: 0, _feedHash: "" }),
    read(s, vars, round) {
      let d = false;
      if (!s.contacts) {
        s.contacts = {};
        s.chats = {};
        s.temp = {};
      }
      if (s._feedHash == null) s._feedHash = "";
      if (syncContacts(s, vars)) d = true;
      if (ingestFeed(s, vars, round)) d = true;
      tempTick(s, round);
      if (round !== s.lastRound) {
        s.lastRound = round;
        d = true;
      }
      return d;
    },
    /* 状态板：只在有未读时上条（不占屏） */
    summary(s) {
      let n = 0;
      for (const ch of Object.values(s.chats || {})) n += ch.unread || 0;
      return n > 0 ? [{ i: CFG.icon, v: `未读×${n}`, l: CFG.name, tone: "warn" }] : [];
    },
    /* ---------- 抽屉内：通讯录 ---------- */
    html(s, h) {
      injectStyle();
      const round = curRound();
      const names = Object.keys(s.chats).sort((a, b) => {
        const la = (s.chats[a].msgs[s.chats[a].msgs.length - 1] || {}).at || 0;
        const lb = (s.chats[b].msgs[s.chats[b].msgs.length - 1] || {}).at || 0;
        return lb - la;
      });
      s._order = names;
      if (!names.length) {
        return h.empty(
          CFG.icon,
          `${CFG.boxName}·通讯录空空如也`,
          `开篇后随剧情认识的人物，都会出现在${CFG.boxName}里；` + (CFG.sendCost ? `每发一条${CFG.name}消耗「${CFG.sendCost.item}」×${CFG.sendCost.count}。` : "主动发一条讯，剧情就会顺着电波生长。")
        );
      }
      const rows = names.map((name, i) => {
        const ch = s.chats[name];
        const last = ch.msgs[ch.msgs.length - 1];
        const t = s.temp[name] || { w: 50, star: false };
        const prev = last ? `${last.r === "me" ? "我：" : ""}${last.t.slice(0, 26)}` : "尚无往来";
        const hue = hueOf(name);
        return `<div class="cm-row" onclick="WorldExt.act('comm','open',${i})">
                    <span class="cm-ava" style="--h:${hue};">${h.esc(name.slice(0, 1))}</span>
                    <span class="cm-mid">
                        <b>${h.esc(name)}${last && last.at >= round && last.r === "npc" ? '<i class="cm-new">new</i>' : ""}</b>
                        <em>${h.esc(prev)}</em>
                    </span>
                    <span class="cm-side">
                        ${ch.unread ? `<i class="cm-badge">${ch.unread}</i>` : ""}
                        <i class="cm-temp" title="关系温度 ${t.w}"><b style="width:${t.w}%;"></b></i>
                    </span>
                </div>`;
      }).join("");
      const cost = CFG.sendCost && OPT("sendCostOn", !!CFG.sendCost) ? `<div class="cm-note">${h.esc(`每发一条消耗「${CFG.sendCost.item}」×${CFG.sendCost.count}——${CFG.name}是要花钱的`)}</div>` : "";
      return `<div class="cm-list">${rows}</div>${cost}`;
    },
    /* ---------- 交互路由（WorldExt.act('comm',…)） ---------- */
    act(s, action, payload) {
      if (action === "open") {
        UI.open(s, Number(payload) || 0);
        return "";
      }
      if (action === "star") {
        const n = jn(payload);
        const t = s.temp[n];
        if (t) {
          t.star = !t.star;
          return t.star ? `已将「${n}」设为特别关心（温度保底 60）` : `已取消「${n}」的特别关心`;
        }
        return "";
      }
      if (action === "clear") {
        const n = jn(payload);
        if (s.chats[n]) {
          s.chats[n].msgs = [];
          s.chats[n].unread = 0;
          return `已清空与「${n}」的往来记录`;
        }
        return "";
      }
      return "";
    },
    /* ---------- 提示词回流：世界近讯（取后即读） + 主动传讯指引 ---------- */
    directive(s) {
      const unread = [];
      for (const [name, ch] of Object.entries(s.chats || {})) {
        let got = false;
        for (let k = ch.msgs.length - 1; k >= 0; k--) {
          const m = ch.msgs[k];
          if (m.r === "npc" && !m.seen) {
            unread.push({ name, t: m.t });
            m.seen = true;
            got = true;
            if (unread.length >= 3) break;
          } else if (m.seen) break;
        }
        if (got) ch.unread = 0;
        if (unread.length >= 3) break;
      }
      if (unread.length) {
        try {
          WorldExt.persist();
        } catch (e) {
        }
        return `【${CFG.name}·世界近讯】主角的${CFG.name}里有未读讯息：${unread.map((u) => `「${u.name}」：「${u.t}」`).join("；")}。下轮正文开头应自然衔接（主角收到讯息、被此事牵动），是否回复由剧情决定；讯息内容与其身份、当前关系相符。`;
      }
      if (OPT("proactive", true) && s.lastRound > 2) {
        let top = null;
        for (const [name, t] of Object.entries(s.temp || {})) {
          if (!top || t.w - t.idle > s.temp[top].w - s.temp[top].idle) top = name;
        }
        if (top) {
          const t = s.temp[top];
          return `【${CFG.name}】若本轮剧情自然，可让「${top}」主动通过${CFG.name}给主角传一条讯息——在 (variable_update) 上报 「通讯」:[{"对象":"${top}","内容":"讯息原文"}]（≤50字、以其身份口吻，当前关系温度${t.w}/100）；没有合适时机就省略，不强求每轮都有。`;
        }
      }
      return "";
    },
    /* ---------- 上报契约：教 AI 怎么递「通讯」 ---------- */
    contract(s) {
      const off = Object.keys(CFG.offline || {}).slice(0, 2).join("/");
      return `通讯（仅当本轮有 NPC 主动向主角传讯时上报：「通讯」:[{"对象":"NPC名","内容":"讯息原文"}]，内容≤50字、符合其身份与${CFG.name}的媒介感；主角主动发出的讯息与NPC正在${off}等离线状态时勿报；无则省略）`;
    }
  };
  const UI = {
    cur: null,
    s: null,
    busy: false,
    open(s, i) {
      injectStyle();
      const name = (s._order || [])[i];
      if (!name || !s.chats[name]) return;
      this.cur = name;
      this.s = s;
      s.chats[name].unread = 0;
      s.chats[name].msgs.forEach((m) => {
        if (m.r === "npc") m.seen = true;
      });
      try {
        WorldExt.persist();
      } catch (e) {
      }
      const t = s.temp[name] || { w: 50, star: false };
      const old = $id("commOv");
      if (old) old.remove();
      const ov = document.createElement("div");
      ov.id = "commOv";
      ov.className = "comm-ov";
      ov.setAttribute("data-carrier", CFG.carrier);
      ov.onclick = (e) => {
        if (e.target === ov) this.close();
      };
      const offlineHint = Object.entries(CFG.offline || {}).slice(0, 3).map(([k, v]) => `<i class="cm-off">${esc(k)}·${esc(v)}</i>`).join("");
      ov.innerHTML = `
                <div class="comm-box" style="${themeVars()}">
                    <div class="comm-head">
                        <span class="cm-ava big" style="--h:${hueOf(name)};">${esc(name.slice(0, 1))}</span>
                        <div class="cm-tt"><b>${esc(name)}</b>
                            <em>${esc(s.contacts[name].role || "")} · ${esc(CFG.name)} · 温度 ${t.w}</em>
                            ${offlineHint ? `<div class="cm-offs">${offlineHint}</div>` : ""}</div>
                        <button class="cm-star${t.star ? " on" : ""}" title="特别关心（温度保底）" onclick="CommCore.ui('star')">⭐</button>
                        <button class="cm-x" title="关闭" onclick="CommCore.ui('close')">✕</button>
                    </div>
                    <div class="comm-flow" id="commFlow"></div>
                    <div class="comm-input">
                        <input id="commText" maxlength="120" placeholder="以${esc(CFG.name)}对 ${esc(name)} 说点什么…（回车送出）"
                            onkeydown="if(event.key==='Enter')CommCore.send()">
                        <button id="commSend" onclick="CommCore.send()">送出</button>
                    </div>
                    <div class="comm-carrier">${esc(CFG.icon)} ${esc(CFG.name)} · ${esc(worldName())}</div>
                </div>`;
      document.body.appendChild(ov);
      setTimeout(() => {
        ov.classList.add("show");
        this.render();
        const inp = $id("commText");
        if (inp) inp.focus();
      }, 20);
      try {
        window.AudioBox && AudioBox.event("letter");
      } catch (e) {
      }
    },
    render(typing, streamText) {
      const flow = $id("commFlow");
      const s = this.s;
      if (!flow || !s || !this.cur) return;
      const list = (s.chats[this.cur] || { msgs: [] }).msgs;
      let html = list.map((m, i) => {
        const lastNpc = !typing && i === list.length - 1 && m.r === "npc";
        return m.r === "me" ? `<div class="cmsg me"><div class="cm-b">${esc(m.t)}</div></div>` : `<div class="cmsg npc"><span class="cm-ava" style="--h:${hueOf(this.cur)};">${esc(this.cur.slice(0, 1))}</span>
                        <div class="cm-b">${esc(m.t)}</div></div>`;
      }).join("");
      if (typing) {
        html += `<div class="cmsg npc typing" id="commTyping"><span class="cm-ava" style="--h:${hueOf(this.cur)};">${esc(this.cur.slice(0, 1))}</span>
                    <div class="cm-b">${streamText != null ? esc(streamText) : "<i></i><i></i><i></i>"}</div></div>`;
      }
      flow.innerHTML = html;
      flow.scrollTop = flow.scrollHeight;
    },
    close() {
      this.cur = null;
      this.s = null;
      const ov = $id("commOv");
      if (ov) {
        ov.classList.remove("show");
        setTimeout(() => ov.remove(), 220);
      }
    },
    /* ---------- 发送 → 消耗媒介 → 拟真延迟 → AI 回信 ---------- */
    async send() {
      const inp = $id("commText");
      const s = this.s;
      if (!inp || !s || !this.cur || this.busy) return;
      const name = this.cur;
      const text = inp.value.trim();
      if (!text) return;
      const fw = window.storyFramework;
      if (OPT("autoReply", true) && fw && fw.isApiConfigured && !fw.isApiConfigured()) {
        if (fw.guideToConfig) fw.guideToConfig();
        return;
      }
      inp.value = "";
      this.busy = true;
      const sendBtn = $id("commSend");
      if (sendBtn) sendBtn.disabled = true;
      const ch = s.chats[name];
      const cap = Math.max(10, Math.round(OPT("histCap", 60)));
      ch.msgs.push({ r: "me", t: text.slice(0, 120), at: curRound() });
      if (ch.msgs.length > cap) ch.msgs.splice(0, ch.msgs.length - cap);
      bumpTemp(s, name, 2.5);
      try {
        WorldExt.persist();
      } catch (e) {
      }
      this.render();
      if (CFG.sendCost && OPT("sendCostOn", !!CFG.sendCost)) {
        const vars = fw && fw.storyState && fw.storyState.variables || {};
        vars.items = vars.items || [];
        const it = vars.items.find((x) => String(x.name).includes(CFG.sendCost.item));
        if (!it || (it.count || 1) < CFG.sendCost.count) {
          ch.msgs.pop();
          try {
            WorldExt.persist();
          } catch (e) {
          }
          this.busy = false;
          if (sendBtn) sendBtn.disabled = false;
          this.render();
          try {
            window.showToast && showToast(CFG.costHint || `囊中没有${CFG.sendCost.item}`, "error");
          } catch (e) {
          }
          return;
        }
        it.count -= CFG.sendCost.count;
        if (it.count <= 0) vars.items = vars.items.filter((x) => x !== it);
        try {
          window.showToast && showToast(`${CFG.icon} 已耗去「${CFG.sendCost.item}」×${CFG.sendCost.count}`, "info");
        } catch (e) {
        }
      }
      if (!OPT("autoReply", true)) {
        this.busy = false;
        if (sendBtn) sendBtn.disabled = false;
        try {
          window.showToast && showToast(`${CFG.icon} 讯已发出（自动回信已关闭）`, "info");
        } catch (e) {
        }
        return;
      }
      if (OPT("delaySim", true)) {
        await sleep(600 + Math.random() * 1200);
        if (!this.cur) {
          this.busy = false;
          return;
        }
        this.render(true);
      }
      let reply = "";
      try {
        const msgs = replyMsgs(s, name, ch.msgs);
        const opts = {
          onDelta: (d) => {
            reply += d;
            const tp = $id("commTyping");
            if (tp) {
              tp.classList.remove("typing");
              tp.querySelector(".cm-b").textContent = reply;
            }
            const flow = $id("commFlow");
            if (flow) flow.scrollTop = flow.scrollHeight;
          }
        };
        const out = window.ChannelHub && ChannelHub.canCall("troupe") ? await ChannelHub.call("troupe", msgs, opts) : await window.callOpenAI(msgs, opts);
        const fin = String(out || reply || "……").trim();
        if (!fin || fin === "……") {
          ch.msgs.pop();
          try {
            WorldExt.persist();
          } catch (e) {
          }
        } else {
          const bubbles = fin.split(/[|\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
          for (const b of bubbles) {
            ch.msgs.push({ r: "npc", t: b.slice(0, 160), at: curRound(), seen: true });
          }
          ch.unread = 0;
          if (ch.msgs.length > cap) ch.msgs.splice(0, ch.msgs.length - cap);
          bumpTemp(s, name, 1);
          try {
            window.AudioBox && AudioBox.event("letter");
          } catch (e) {
          }
        }
      } catch (e) {
        const mi = ch.msgs.map((m) => m.r).lastIndexOf("me");
        if (mi >= 0) ch.msgs.splice(mi, 1);
        try {
          window.showToast && showToast("传讯失败：" + String(e.message || "网络异常").slice(0, 80), "error");
        } catch (e2) {
        }
      } finally {
        this.busy = false;
        if (sendBtn) sendBtn.disabled = false;
        try {
          WorldExt.persist();
        } catch (e) {
        }
        this.render();
        const i2 = $id("commText");
        if (i2) i2.focus();
      }
    },
    star() {
      const s = this.s;
      if (!s || !this.cur) return;
      const t = s.temp[this.cur];
      if (!t) return;
      t.star = !t.star;
      try {
        WorldExt.persist();
      } catch (e) {
      }
      const btn = document.querySelector("#commOv .cm-star");
      if (btn) btn.classList.toggle("on", t.star);
      try {
        window.showToast && showToast(t.star ? `已将「${this.cur}」设为特别关心` : `已取消特别关心`, "info");
      } catch (e) {
      }
    }
  };
  function replyMsgs(s, name, hist) {
    const t = s.temp[name] || { w: 50 };
    const c = s.contacts[name] || {};
    const histAll = window.storyFramework && storyFramework.storyState.conversationHistory || [];
    const recent = [];
    for (let i = histAll.length - 1; i >= 0 && recent.length < 2; i--) {
      if (histAll[i].role !== "assistant") continue;
      const txt = String(histAll[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
      if (txt) recent.unshift(txt.slice(0, 300));
    }
    const sys = `你正在扮演《${worldName()}》中的 NPC「${name}」，与主角「${playerName()}」通过「${CFG.name}」通讯。
这不是写小说，是隔着媒介发消息：只见文字，不见其人。

【角色速写】
- 身份：${c.role || "未知"}
- 现状：${c.status || "如常"}
- 与主角关系：${c.relation || "初识"}；关系温度 ${t.w}/100（${attitude(t.w)}）
- 秘密：${c.secret || "无"}——守口如瓶，可露破绽

【最近剧情（你亲历的事）】
${recent.join("\n——\n") || "（故事刚开始）"}

【腔调铁律】
1. 像${CFG.name}该有的样子：${CFG.bubbleNote}
2. 单条 ≤55 字；要连发就用竖线 | 分隔，最多 3 条
3. 态度必须符合温度：${attitude(t.w)}
4. ${CFG.tone}${CFG.degrade ? `
5. ${CFG.degrade}` : ""}
5. 你只知道角色该知道的事；被问剧情之外的问题，以角色口吻岔开或困惑
6. 绝不提及 AI/模型/设定/档案这些词`;
    const msgs = [{ role: "system", content: sys }];
    for (const m of hist.slice(-14, -1)) msgs.push({ role: m.r === "me" ? "user" : "assistant", content: m.t });
    const last = hist[hist.length - 1];
    if (last && last.r === "me") msgs.push({ role: "user", content: last.t });
    else msgs.push({ role: "user", content: "（回讯）" });
    return msgs;
  }
  function injectStyle() {
    if ($id("commStyle")) return;
    const st = document.createElement("style");
    st.id = "commStyle";
    st.textContent = `
/* ---------- 通讯录（界专属抽屉内） ---------- */
.cm-list{display:flex;flex-direction:column;gap:6px}
.cm-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;cursor:pointer;
    border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 16%,transparent);background:rgba(255,255,255,.02);transition:all .18s}
.cm-row:hover{border-color:color-mix(in srgb,var(--ip,#c9a86a) 55%,transparent);transform:translateY(-1px)}
.cm-ava{flex:0 0 34px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;color:#fff;background:linear-gradient(145deg,hsl(var(--h,40),45%,46%),hsl(var(--h,40),55%,30%));
    box-shadow:0 2px 8px rgba(0,0,0,.35)}
.cm-ava.big{flex-basis:42px;width:42px;height:42px;font-size:17px}
.cm-mid{flex:1;min-width:0}
.cm-mid b{display:block;font-size:13.5px;color:var(--itx,#e8dcc0);font-weight:600;letter-spacing:.5px}
.cm-mid b .cm-new{font-style:normal;font-size:9px;color:#e8a54f;border:1px solid #e8a54f88;border-radius:6px;padding:0 4px;margin-left:5px;vertical-align:1px}
.cm-mid em{display:block;font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-side{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:0 0 auto}
.cm-badge{font-style:normal;min-width:18px;height:18px;border-radius:9px;background:#d95c5c;color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;animation:cmPulse 1.6s infinite}
@keyframes cmPulse{0%,100%{box-shadow:0 0 0 0 #d95c5c66}50%{box-shadow:0 0 0 5px #d95c5c00}}
.cm-temp{width:46px;height:4px;border-radius:2px;background:rgba(255,255,255,.09);overflow:hidden;display:block}
.cm-temp b{display:block;height:100%;background:linear-gradient(90deg,#8fd9a8,#e0a84c);}
.cm-note{margin-top:9px;font-size:11px;color:var(--imt,#9a8c6e);line-height:1.7}
/* ---------- 聊天浮层 ---------- */
.comm-ov{position:fixed;top: 0; right: 0; bottom: 0; left: 0; inset: 0;z-index:9980;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
.comm-ov.show{opacity:1}
.comm-box{width:min(94vw,430px);height:min(78vh,620px);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;
    background:var(--id,#161410);border:1px solid color-mix(in srgb,var(--ip) 40%,transparent);
    box-shadow:0 22px 60px rgba(0,0,0,.55);transform:translateY(14px) scale(.98);transition:transform .22s}
.comm-ov.show .comm-box{transform:translateY(0) scale(1)}
.comm-head{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid color-mix(in srgb,var(--ip) 20%,transparent)}
.cm-tt{flex:1;min-width:0}
.cm-tt b{display:block;font-size:15px;color:var(--itx);letter-spacing:1px}
.cm-tt em{font-style:normal;font-size:10.5px;color:var(--imt)}
.cm-offs{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}
.cm-off{font-style:normal;font-size:9.5px;color:var(--imt);border:1px dashed color-mix(in srgb,var(--imt) 45%,transparent);border-radius:6px;padding:1px 6px}
.cm-star,.cm-x{background:none;border:none;cursor:pointer;font-size:15px;color:var(--imt);padding:2px 4px}
.cm-star{opacity:.45}
.cm-star.on{opacity:1;filter:drop-shadow(0 0 4px #e8c45c)}
.comm-flow{flex:1;overflow-y:auto;padding:14px 13px;display:flex;flex-direction:column;gap:9px}
.cmsg{display:flex;gap:8px;max-width:86%;animation:cmIn .25s ease}
@keyframes cmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.cmsg.me{align-self:flex-end;flex-direction:row-reverse}
.cm-b{padding:8px 12px;border-radius:13px;font-size:13px;line-height:1.65;word-break:break-word;white-space:pre-wrap}
.cmsg.npc .cm-b{background:color-mix(in srgb,var(--ipn) 88%,transparent);border:1px solid color-mix(in srgb,var(--ip) 22%,transparent);color:var(--itx);border-top-left-radius:4px}
.cmsg.me .cm-b{background:linear-gradient(135deg,color-mix(in srgb,var(--ip) 34%,transparent),color-mix(in srgb,var(--ip) 18%,transparent));border:1px solid color-mix(in srgb,var(--ip) 45%,transparent);color:var(--itx);border-top-right-radius:4px}
.cmsg.typing .cm-b i{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--imt);margin:0 1.5px;animation:cmDot 1.1s infinite}
.cmsg.typing .cm-b i:nth-child(2){animation-delay:.18s}
.cmsg.typing .cm-b i:nth-child(3){animation-delay:.36s}
@keyframes cmDot{0%,100%{opacity:.25}50%{opacity:1}}
.comm-input{display:flex;gap:8px;padding:11px 13px;border-top:1px solid color-mix(in srgb,var(--ip) 18%,transparent)}
.comm-input input{flex:1;background:rgba(0,0,0,.32);border:1px solid color-mix(in srgb,var(--ip) 32%,transparent);color:var(--itx);border-radius:10px;padding:9px 12px;font-size:13px;outline:none;min-width:0}
.comm-input input:focus{border-color:color-mix(in srgb,var(--ip) 65%,transparent)}
.comm-input button{flex:0 0 auto;border:1px solid color-mix(in srgb,var(--ip) 55%,transparent);background:color-mix(in srgb,var(--ip) 18%,transparent);color:var(--ip);border-radius:10px;padding:0 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.comm-input button:disabled{opacity:.5;cursor:wait}
.comm-carrier{text-align:center;font-size:9.5px;color:var(--imt);letter-spacing:2px;padding:0 0 7px;opacity:.7}
/* ---------- 载体皮肤 ---------- */
.comm-box[data-carrier=talisman] .comm-head{background:linear-gradient(135deg,#3a2c1a,#241a10)}
.comm-box[data-carrier=talisman] .cmsg.npc .cm-b{background:linear-gradient(160deg,#f0e3c2,#e6d3a4);color:#4a3a20;border-color:#b89a5e66}
.comm-box[data-carrier=talisman] .comm-flow{background-image:repeating-linear-gradient(0deg,transparent 0 26px,#8a6d3a0d 26px 27px)}
.comm-box[data-carrier=jade] .comm-head{background:linear-gradient(135deg,#0d2a22,#0a1f1a)}
.comm-box[data-carrier=jade] .cmsg.npc .cm-b{background:linear-gradient(160deg,#12312a,#0e2620);color:#d8f0e4;border-color:#7ad8b04d;box-shadow:0 0 12px #7ad8b01c}
.comm-box[data-carrier=jade] .comm-flow{background-image:radial-gradient(circle at 50% 0%,#7ad8b00f,transparent 60%)}
.comm-box[data-carrier=radio] .comm-head{background:linear-gradient(135deg,#1e2618,#141a10)}
.comm-box[data-carrier=radio] .comm-box,
.comm-box[data-carrier=radio] .cm-tt b{font-family:ui-monospace,Consolas,monospace;letter-spacing:.5px}
.comm-box[data-carrier=radio] .cmsg.npc .cm-b{background:#1b2415;color:#c8d8b8;border:1px dashed #8aa87466}
.comm-box[data-carrier=radio] .cmsg.me .cm-b{background:#3a3218;color:#e8dcae;border:1px dashed #b8a05e66}
.comm-box[data-carrier=radio] .comm-flow{background-image:repeating-linear-gradient(0deg,transparent 0 3px,#ffffff05 3px 4px)}
.comm-box[data-carrier=terminal] .comm-head{background:linear-gradient(135deg,#101826,#0a0f18)}
.comm-box[data-carrier=terminal] .cm-b{font-family:ui-monospace,Consolas,monospace;font-size:12.5px}
.comm-box[data-carrier=terminal] .cmsg.npc .cm-b{border-left:2px solid #6fb0d8}
.comm-box[data-carrier=phone] .comm-head{background:linear-gradient(135deg,#1a2230,#131926)}
.comm-box[data-carrier=phone] .comm-box{border-radius:24px}
.comm-box[data-carrier=phone] .cmsg .cm-b{border-radius:16px}
.comm-box[data-carrier=phone] .cmsg.npc .cm-b{background:rgba(255,255,255,.09);border:none;border-top-left-radius:5px}
.comm-box[data-carrier=phone] .cmsg.me .cm-b{background:linear-gradient(135deg,#3a6ea8,#2d5a8c);border:none;border-top-right-radius:5px;color:#eef4fb}
.comm-box[data-carrier=phone] .comm-input button{background:#3a6ea8;color:#fff;border:none}
.comm-box[data-carrier=mind]{background:#0d0b12;border-color:#6a4a8a66}
.comm-box[data-carrier=mind] .comm-head{background:linear-gradient(135deg,#1a1024,#120c1a)}
.comm-box[data-carrier=mind] .comm-flow{background-image:radial-gradient(circle at 50% 30%,#6a4a8a14,transparent 65%)}
.comm-box[data-carrier=mind] .cmsg .cm-ava{display:none}
.comm-box[data-carrier=mind] .cmsg{max-width:92%}
.comm-box[data-carrier=mind] .cmsg.npc .cm-b{background:none;border:none;color:#cdb8e8;text-shadow:0 0 10px #6a4a8a55;font-style:italic;letter-spacing:1px}
.comm-box[data-carrier=mind] .cmsg.me .cm-b{background:none;border:none;color:#b8c8e8;text-align:right;font-style:italic}
.comm-box[data-carrier=mind] .cmsg.npc{align-self:flex-start}
.comm-box[data-carrier=mind] .cmsg.me{align-self:flex-end}
@media(max-width:480px){.comm-box{width:96vw;height:82vh;border-radius:14px}}`;
    document.head.appendChild(st);
  }
  WorldExt.injectModules(genre, [commMod]);
  window.CommCore = {
    version: VERSION,
    ui(action) {
      if (action === "close") UI.close();
      else if (action === "star") UI.star();
    },
    send: () => UI.send(),
    get _ui() {
      return UI;
    }
  };
})();
