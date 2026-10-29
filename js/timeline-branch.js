const TimelineBranch = function() {
  "use strict";
  const MAX_NODES = 10, HIST_CAP = 50, TURNS_CAP = 20;
  let genre = "free";
  const KEY = () => window.claimSlotKey ? window.claimSlotKey("tl_" + genre, genre) : "tl_" + genre;
  function load() {
    try {
      const r = localStorage.getItem(KEY());
      if (!r) return null;
      const o = JSON.parse(r);
      return o && Array.isArray(o.nodes) ? o : null;
    } catch (e) {
      return null;
    }
  }
  function save(db2) {
    var _a;
    try {
      localStorage.setItem(KEY(), JSON.stringify(db2));
      return true;
    } catch (e) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "世界线档案写满（浏览器存储配额）——删几条旧线再试", "error");
      return false;
    }
  }
  const uid = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function db() {
    return load() || { nodes: [], activeId: null };
  }
  const fw = () => window.storyFramework;
  function takeSnap() {
    const f = fw();
    if (!f) return null;
    const s = f.storyState || {};
    let imm = null;
    const immK = window.ImmersiveSuite && window.ImmersiveSuite.immKey ? window.ImmersiveSuite.immKey(genre) : "imm_" + genre;
    try {
      imm = localStorage.getItem(immK) || null;
    } catch (e) {
    }
    return {
      story: {
        variables: s.variables || {},
        conversationHistory: (s.conversationHistory || []).slice(-HIST_CAP),
        turnCount: s.turnCount || 0,
        turns: (s.turns || []).slice(-TURNS_CAP),
        isStoryStarted: !!s.isStoryStarted,
        setup: s.setup || null,
        digest: s.digest || void 0
      },
      imm
    };
  }
  function anchorInto(nodeId) {
    const d = db();
    const id = nodeId || d.activeId;
    const n = d.nodes.find((x) => x.id === id);
    if (!n) return false;
    const s = takeSnap();
    if (!s) return false;
    n.live = s;
    const v = s.story.variables || {};
    n.chapter = v.chapter || n.chapter;
    n.words = v.wordCount || v.totalWords || n.words;
    n.anchoredAt = Date.now();
    return save(d);
  }
  function mark(label) {
    var _a, _b, _c;
    const d = db();
    if (d.nodes.length >= MAX_NODES) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, `界点已达上限（${MAX_NODES}），删去旧线再立`, "error");
      return null;
    }
    const snap = takeSnap();
    if (!snap) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "创作框架未就绪，暂不能立界点", "error");
      return null;
    }
    const v = snap.story.variables || {};
    const n = {
      id: uid(),
      parent: d.activeId || null,
      label: String(label || "").trim() || `第${v.chapter || "?"}章·${shortScene()}`,
      at: Date.now(),
      chapter: v.chapter || 0,
      words: v.wordCount || v.totalWords || 0,
      snap
    };
    d.nodes.push(n);
    d.activeId = n.id;
    save(d);
    try {
      window.GameLayer && GameLayer.notify("worldline");
    } catch (e) {
    }
    (_c = window.showToast) == null ? void 0 : _c.call(window, "🌐 已立界点：" + n.label, "success");
    return n.id;
  }
  function shortScene() {
    const f = fw();
    const v = f && f.storyState && f.storyState.variables || {};
    const t = v.chapterTitle || v.title || v.time || "此刻";
    return String(t).slice(0, 8);
  }
  function forkFrom(nodeId, label) {
    var _a, _b;
    let d = db();
    if (!d.nodes.find((x) => x.id === nodeId)) return false;
    if (d.nodes.length >= MAX_NODES) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, `世界线已达上限（${MAX_NODES}）`, "error");
      return false;
    }
    if (d.activeId) anchorInto(d.activeId);
    d = db();
    const src = d.nodes.find((x) => x.id === nodeId);
    if (!src || !src.snap) return false;
    const n = {
      id: uid(),
      parent: src.id,
      label: String(label || "").trim() || src.label + "·岔",
      at: Date.now(),
      chapter: src.chapter,
      words: src.words,
      snap: JSON.parse(JSON.stringify(src.snap)),
      live: src.live ? JSON.parse(JSON.stringify(src.live)) : void 0
    };
    d.nodes.push(n);
    d.activeId = n.id;
    save(d);
    if (!switchTo(n.id, true)) return false;
    (_b = window.showToast) == null ? void 0 : _b.call(window, "✦ 已开辟新世界线：" + n.label, "success");
    return true;
  }
  function switchTo(nodeId, silent, useSnap) {
    var _a;
    let d = db();
    const n = d.nodes.find((x) => x.id === nodeId);
    if (!n) return false;
    if (d.activeId && d.activeId !== nodeId) anchorInto(d.activeId);
    const d2 = db();
    d2.activeId = nodeId;
    save(d2);
    const snap = (useSnap ? n.snap : n.live || n.snap) || n.snap;
    if (!applySnap(snap)) return false;
    if (!silent) (_a = window.showToast) == null ? void 0 : _a.call(window, useSnap ? "⏮ 已重临界点：" + n.label : "↯ 已切入世界线：" + n.label, "success");
    return true;
  }
  async function rewind(nodeId) {
    var _a;
    const msg = "重临界点：回到立界点那一刻，这条线此后写下的进度将被推翻。确定？";
    if ((_a = window.UIDialog) == null ? void 0 : _a.confirm) {
      const ok = await window.UIDialog.confirm({ title: "重临界点", message: msg, danger: true, confirmText: "重临" });
      if (!ok) return false;
    } else if (!confirm(msg)) return false;
    const done = switchTo(nodeId, false, true);
    refresh();
    return done;
  }
  function applySnap(snap) {
    var _a, _b, _c;
    const f = fw();
    if (!f || !snap) return false;
    try {
      f.storyState = {
        variables: snap.story.variables || {},
        conversationHistory: (snap.story.conversationHistory || []).slice(),
        isStoryStarted: !!snap.story.isStoryStarted,
        setup: snap.story.setup || null,
        lastVariables: {},
        turnCount: snap.story.turnCount || 0,
        turns: (snap.story.turns || []).slice(),
        digest: snap.story.digest
      };
      f.saveStory();
      try {
        const immK = window.ImmersiveSuite && window.ImmersiveSuite.immKey ? window.ImmersiveSuite.immKey(genre) : "imm_" + genre;
        if (snap.imm != null) localStorage.setItem(immK, snap.imm);
        else localStorage.removeItem(immK);
      } catch (e) {
      }
      if (window.ImmersiveSuite) {
        try {
          (_b = (_a = window.ImmersiveSuite).reload) == null ? void 0 : _b.call(_a);
        } catch (e) {
        }
      }
      const box = document.getElementById("chatMessages");
      if (box) box.innerHTML = "";
      const R = window.StudioReplay;
      if (snap.story.isStoryStarted && R && R.enterChatMode && R.replayHistory) {
        R.enterChatMode();
        R.replayHistory();
      }
      f.updateStatusPanel();
      if (window.TimelineBranch) (_c = TimelineBranch.refresh) == null ? void 0 : _c.call(TimelineBranch);
      return true;
    } catch (e) {
      console.warn("[Timeline] 切换失败:", e.message);
      return false;
    }
  }
  async function remove(nodeId) {
    var _a, _b;
    const d = db();
    const n = d.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const msg = `抹去世界线「${n.label}」？（其所有岔路一并消散）`;
    if ((_a = window.UIDialog) == null ? void 0 : _a.confirm) {
      const ok = await window.UIDialog.confirm({ title: "抹去世界线", message: msg, danger: true, confirmText: "抹去" });
      if (!ok) return;
    } else if (!confirm(msg)) return;
    const doomed = /* @__PURE__ */ new Set([nodeId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const x of d.nodes) if (x.parent && doomed.has(x.parent) && !doomed.has(x.id)) {
        doomed.add(x.id);
        grew = true;
      }
    }
    d.nodes = d.nodes.filter((x) => !doomed.has(x.id));
    if (doomed.has(d.activeId)) d.activeId = d.nodes.length ? d.nodes[0].id : null;
    save(d);
    refresh();
    (_b = window.showToast) == null ? void 0 : _b.call(window, "已抹去 " + doomed.size + " 条世界线", "info");
  }
  async function rename(nodeId, label) {
    var _a;
    const d = db();
    const n = d.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    let v;
    if ((_a = window.UIDialog) == null ? void 0 : _a.prompt) {
      v = await window.UIDialog.prompt({ title: "命名世界线", message: "为这条世界线命名：", defaultValue: n.label, placeholder: "输入名称" });
    } else {
      v = prompt("为这条世界线命名：", n.label);
    }
    if (v == null) return;
    n.label = String(v).trim().slice(0, 24) || n.label;
    save(d);
    refresh();
  }
  function layout(d) {
    const kids = /* @__PURE__ */ new Map();
    for (const n of d.nodes) {
      const k = n.parent || "__";
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(n);
    }
    const placed = [], seen = /* @__PURE__ */ new Set();
    let leafY = 0;
    (function dfs(node, depth) {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      const ch = kids.get(node.id) || [];
      if (!ch.length) {
        placed.push({ n: node, x: depth, y: leafY++ });
        return;
      }
      const ys = [];
      for (const c of ch) {
        dfs(c, depth + 1);
        const p = placed.find((p2) => p2.n.id === c.id);
        if (p) ys.push(p.y);
      }
      const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : leafY++;
      placed.push({ n: node, x: depth, y });
    })({ id: "__" }, -1);
    for (const n of d.nodes) if (!seen.has(n.id)) placed.push({ n, x: 0, y: leafY++ });
    return placed;
  }
  function lastProse(node) {
    const st = (node.live || node.snap || {}).story || {};
    const h = st.conversationHistory || [];
    for (let i = h.length - 1; i >= 0; i--) if (h[i].role === "assistant") {
      let t = h[i].content || "";
      t = t.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【[^】]*】[:：][^\n]*/g, "").trim();
      return t.slice(0, 320) || "（该线尚无正文）";
    }
    return "（该线尚无正文）";
  }
  const fmtT = (ts) => {
    try {
      return new Date(ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };
  let selId = null, cmpA = null, cmpB = null;
  function panelHTML() {
    const gk = window.storyFramework && storyFramework.config && storyFramework.config.genreKey || null;
    if (gk && gk !== genre) onGenre(gk);
    const d = db();
    if (!selId || !d.nodes.find((n2) => n2.id === selId)) selId = d.activeId;
    if (!d.nodes.length) {
      return `<div class="imm-empty"><b>🌐</b><div class="ie-t">万象未分</div>
                <div class="ie-d">走到命运的岔口前，点下方「立界点」封存此刻——此后任一分岔、任一改写，都可回到这一念之前。原著的每次“如果当初”，现在归你执笔。</div></div>
                <button class="tl-mark" onclick="TimelineBranch.mark()">✦ 立界点 · 封存此刻</button>`;
    }
    const pts = layout(d);
    const CW = 30, RH = 46, PAD = 26;
    const maxD = Math.max(...pts.map((p) => p.x)), maxY = Math.max(...pts.map((p) => p.y));
    const w = PAD * 2 + (maxD + 1) * CW + 60, h = PAD * 2 + (maxY + 1) * RH;
    const byId = {};
    pts.forEach((p) => byId[p.n.id] = p);
    const px = (p) => PAD + p.x * CW + 4, py = (p) => PAD + p.y * RH + 8;
    let edges = "", dots = "";
    for (const p of pts) {
      if (p.n.parent && byId[p.n.parent]) {
        const q = byId[p.n.parent];
        const x1 = px(q) + 7, y1 = py(q) + 7, x2 = px(p), y2 = py(p) + 7;
        edges += `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}"
                    fill="none" stroke="${p.n.id === d.activeId ? "var(--ip)" : "rgba(150,150,170,.3)"}"
                    stroke-width="${p.n.id === d.activeId ? 1.8 : 1}" ${p.n.id === d.activeId ? 'class="tl-edge-on"' : ""}/>`;
      }
    }
    for (const p of pts) {
      const on = p.n.id === d.activeId, sel = p.n.id === selId;
      dots += `<g class="tl-node ${on ? "on" : ""} ${sel ? "sel" : ""}" transform="translate(${px(p)},${py(p)})" onclick="TimelineBranch.select('${p.n.id}')">
                <circle r="7" class="tl-dot"/>
                ${on ? '<circle r="12" class="tl-halo"><animate attributeName="r" values="9;13;9" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.6s" repeatCount="indefinite"/></circle>' : ""}
                <text x="14" y="4" class="tl-nlabel">${esc(String(p.n.label || "无名之线").slice(0, 10))}</text>
                <text x="14" y="15" class="tl-nmeta">第${p.n.chapter || "?"}章 · ${fmtT(p.n.at)}</text>
            </g>`;
    }
    const n = d.nodes.find((x) => x.id === selId);
    if (!n) {
      selId = d.activeId;
      return panelHTML();
    }
    const isOn = selId === d.activeId;
    return `
        <div class="tl-wrap">
            <div class="tl-toolbar">
                <button class="tl-mark" onclick="TimelineBranch.mark()">✦ 立界点</button>
                <button class="tl-btn" onclick="TimelineBranch.anchor()" title="把当前写作进度写入所选世界线">⚓ 锚定进度</button>
            </div>
            <div class="tl-canvas"><svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
                ${edges}${dots}</svg></div>
            <div class="tl-card ${isOn ? "on" : ""}">
                <div class="tl-c-head">
                    <b>${isOn ? "◆ 当前线" : "◇ 世界线"} · ${esc(n.label)}</b>
                    <span class="tl-c-meta">第${n.chapter || "?"}章 · 约${n.words ? n.words + "字" : "?"} · ${fmtT(n.at)}</span>
                </div>
                <div class="tl-c-prose">${esc(lastProse(n)).slice(0, 120)}…</div>
                <div class="tl-c-ops">
                    ${!isOn ? `<button class="tl-op main" onclick="TimelineBranch.switchTo('${n.id}')">↯ 切入此线</button>` : '<span class="tl-live">你正在此线书写</span>'}
                    <button class="tl-op" onclick="TimelineBranch.forkFrom('${n.id}')">✦ 从此岔路</button>
                    <button class="tl-op" onclick="TimelineBranch.rewind('${n.id}')" title="回到立界点那一刻，推翻此后进度">⏮ 重临界点</button>
                    <button class="tl-op" onclick="TimelineBranch.ren('${n.id}')">✎ 改名</button>
                    <button class="tl-op warn" onclick="TimelineBranch.remove('${n.id}')">✕ 抹去</button>
                    <button class="tl-op" onclick="TimelineBranch.pickCmp('${n.id}')">⇄ 对照</button>
                </div>
            </div>
            ${cmpHTML(d)}
        </div>`;
  }
  function cmpHTML(d) {
    if (!cmpA) return "";
    const a = d.nodes.find((x) => x.id === cmpA), b = cmpB ? d.nodes.find((x) => x.id === cmpB) : null;
    if (!a) return "";
    return `<div class="tl-cmp">
            <div class="tl-cmp-head">⇄ 双线对照 <button class="tl-cmp-x" onclick="TimelineBranch.clearCmp()">✕</button></div>
            <div class="tl-cmp-cols">
                <div class="tl-cmp-col"><b>A · ${esc(a.label)}</b><div class="tl-cmp-text">${esc(lastProse(a))}</div></div>
                ${b ? `<div class="tl-cmp-col"><b>B · ${esc(b.label)}</b><div class="tl-cmp-text">${esc(lastProse(b))}</div></div>` : `<div class="tl-cmp-col dim">再点一条线的「⇄ 对照」<br>两个宇宙将并排呈现</div>`}
            </div></div>`;
  }
  function refresh() {
    const body = document.getElementById("immBody");
    if (body && window.ImmersiveSuite && window.ImmersiveSuite._tab === "lines") body.innerHTML = panelHTML();
  }
  const api = {
    onGenre(g) {
      genre = g || "free";
      selId = null;
      cmpA = cmpB = null;
      return api;
    },
    panelHTML,
    mark,
    forkFrom,
    switchTo,
    rewind,
    remove,
    anchor() {
      var _a, _b;
      const ok = anchorInto();
      if (ok) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "⚓ 当前进度已锚定", "success");
        refresh();
      } else (_b = window.showToast) == null ? void 0 : _b.call(window, "没有活动世界线——先「立界点」", "error");
    },
    select(id) {
      selId = id;
      refresh();
    },
    ren: rename,
    pickCmp(id) {
      if (!cmpA || cmpA === id) {
        cmpA = id;
        cmpB = null;
      } else if (!cmpB && id !== cmpA) cmpB = id;
      else {
        cmpA = id;
        cmpB = null;
      }
      refresh();
    },
    clearCmp() {
      cmpA = cmpB = null;
      refresh();
    },
    refresh,
    /** 创作开新档/清档时同步清空世界线 */
    resetAll() {
      try {
        localStorage.removeItem(KEY());
      } catch (e) {
      }
      selId = cmpA = cmpB = null;
    }
  };
  return api;
}();
window.TimelineBranch = TimelineBranch;
