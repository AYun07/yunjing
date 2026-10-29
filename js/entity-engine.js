(function() {
  "use strict";
  const VERSION = "v3.32.0";
  const MAX_FLOW = 50;
  const MAX_QUEUE = 2;
  const MAX_RESIDENTS = 12;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const nowRound = () => {
    var _a, _b, _c;
    try {
      const fw = window.storyFramework;
      return Number((_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.chapter) || Number((_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.turnCount) || 0;
    } catch (e) {
      return 0;
    }
  };
  function blank(defs) {
    return {
      ledger: { res: {}, flow: [] },
      // 账本：资源存量 + 流水
      projects: { queue: [], done: [] },
      // 工程：在建队列 + 完工履历
      residents: { list: [] },
      // 住户名册
      ops: { tickets: [], confirmed: [] },
      // 攒单：待确认 + 已发出凭证
      meta: { day: 0, lastRound: 0 }
      // 时间：累计天数 + 上次结算轮
    };
  }
  const Ledger = {
    /** 拿资源（不存在返回 0） */
    get(st, key) {
      return Number(st.ledger.res[key]) || 0;
    },
    /** 变动资源（d 可正可负；why 事由；source: 'player'|'engine'|'ai'） */
    move(st, key, d, why, source) {
      const n = Number(d) || 0;
      if (!n) return false;
      const cur = this.get(st, key);
      const next = Math.max(0, Math.min(99999, cur + n));
      if (next === cur) return false;
      st.ledger.res[key] = next;
      st.ledger.flow.unshift({ r: nowRound(), k: key, d: next - cur, why: String(why || "").slice(0, 24), s: source || "engine" });
      if (st.ledger.flow.length > MAX_FLOW) st.ledger.flow.length = MAX_FLOW;
      return true;
    },
    /** 批量扣（开工校验+结算一体：任一不足返回 {ok:false, lack}；全够则扣 */
    spend(st, cost, why) {
      const lack = [];
      for (const [k, v] of Object.entries(cost || {})) {
        if (this.get(st, k) < Number(v)) lack.push(`${k}${this.get(st, k)}/${v}`);
      }
      if (lack.length) return { ok: false, lack };
      for (const [k, v] of Object.entries(cost || {})) this.move(st, k, -Number(v), why, "player");
      return { ok: true };
    },
    /** 校验不动账（只看够不够） */
    can(st, cost) {
      return Object.entries(cost || {}).every(([k, v]) => this.get(st, k) >= Number(v));
    },
    /** AI 上报合并（引擎账优先：AI 只能补充引擎外资源，不能改写已有科目） */
    absorb(st, obj) {
      let d = false;
      for (const [k, v] of Object.entries(obj || {})) {
        if (k in st.ledger.res) continue;
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
          st.ledger.res[k] = Math.round(n);
          st.ledger.flow.unshift({ r: nowRound(), k, d: Math.round(n), why: "正文归账", s: "ai" });
          d = true;
        }
      }
      if (st.ledger.flow.length > MAX_FLOW) st.ledger.flow.length = MAX_FLOW;
      return d;
    },
    /** 首开盘点（v1 老档迁移：AI 上报的家底归账） */
    seed(st, start, absorbObj) {
      for (const [k, v] of Object.entries(start || {})) {
        if (!(k in st.ledger.res)) st.ledger.res[k] = Number(v) || 0;
      }
      if (absorbObj) this.absorb(st, absorbObj);
    },
    /** 渲染：资源常驻条 */
    html(st, defs, recentDelta) {
      const items = defs.map((d) => {
        const v = this.get(st, d.key);
        const delta = (recentDelta || {})[d.key];
        const flash = delta ? `<em class="ee-flash${delta < 0 ? " dec" : ""}">${delta > 0 ? "+" : ""}${delta}</em>` : "";
        return `<div class="ee-res" title="${esc(d.note || d.key)}"><span>${d.icon || "📦"} ${esc(d.key)}</span><b>${v}</b>${flash}</div>`;
      }).join("");
      return `<div class="ee-resbar">${items}</div>`;
    },
    /** 渲染：流水明细 */
    flowHTML(st) {
      if (!st.ledger.flow.length) return '<div class="ee-empty">尚无流水——第一笔进出账会记在这里</div>';
      return `<div class="ee-flow">${st.ledger.flow.slice(0, 30).map((f) => `<div class="ee-flow-row${f.d < 0 ? " dec" : ""}">
                    <i>第${f.r || "?"}轮</i><span>${esc(f.k)}</span>
                    <b>${f.d > 0 ? "+" : ""}${f.d}</b><em>${esc(f.why || "")}</em>
                </div>`).join("")}</div>`;
    }
  };
  const Projects = {
    /** 开工：校验（资源 + 队列上限）→ 扣资源 → 入队 */
    start(st, def, opsDefs) {
      const q = st.projects.queue;
      if (q.length >= MAX_QUEUE) return { ok: false, msg: `施工队列已满（${MAX_QUEUE} 项并行上限）` };
      if (q.some((p) => p.id === def.id)) return { ok: false, msg: "该工程已在建" };
      if (st.projects.done.some((p) => p.id === def.id)) return { ok: false, msg: "该工程已完工（不可重复）" };
      const spend = Ledger.spend(st, def.cost, `工程「${def.name}」开工`);
      if (!spend.ok) return { ok: false, msg: `资源不足：${spend.lack.join("、")}` };
      q.push({
        id: def.id,
        name: def.name,
        icon: def.icon || "🏗",
        days: def.days || 1,
        left: def.days || 1,
        startedRound: nowRound(),
        yield: def.yield || {}
      });
      return { ok: true };
    },
    /** 跨天 tick：工期 −1，归零即完工（返回完工列表供通知） */
    tick(st) {
      const finished = [];
      const q = st.projects.queue;
      for (let i = q.length - 1; i >= 0; i--) {
        q[i].left -= 1;
        if (q[i].left <= 0) {
          const p = q.splice(i, 1)[0];
          p.finishedRound = nowRound();
          st.projects.done.push(p);
          finished.push(p);
          const y = p.yield || {};
          if (y.res) for (const [k, v] of Object.entries(y.res)) Ledger.move(st, k, Number(v), `工程「${p.name}」完工产出`, "engine");
        }
      }
      return finished;
    },
    /** 渲染：在建队列 */
    queueHTML(st) {
      const q = st.projects.queue;
      if (!q.length) return "";
      return q.map((p) => {
        const pct = Math.round((1 - p.left / (p.days || 1)) * 100);
        return `<div class="ee-proj building">
                    <div class="ee-proj-ic">${p.icon}</div>
                    <div class="ee-proj-bd">
                        <div class="ee-proj-nm">${esc(p.name)} <i class="ee-dur on">在建 · 剩 ${p.left} 天</i></div>
                        <div class="ee-proj-bar"><span style="width:${pct}%"></span></div>
                    </div>
                    <button class="ee-btn ghost sm" onclick="WorldExt.act('${st._modId || ""}','eeCancel','${esc(p.id)}')">取消</button>
                </div>`;
      }).join("");
    },
    /** 渲染：可选工程卡列表（含锁定态/在建态） */
    listHTML(st, defs, modId) {
      const q = st.projects.queue;
      return defs.map((def) => {
        var _a;
        const inQ = q.find((p) => p.id === def.id);
        if (inQ) return "";
        const done = st.projects.done.find((p) => p.id === def.id);
        const afford = Ledger.can(st, def.cost);
        const lackChips = Object.entries(def.cost || {}).map(([k, v]) => {
          const have = Ledger.get(st, k);
          return `<span class="${have < Number(v) ? "lack" : ""}">${esc(k)} ${v}${have < Number(v) ? ` ✗缺${v - have}` : ""}</span>`;
        }).join("");
        const yNote = ((_a = def.yield) == null ? void 0 : _a.note) ? `<div class="ee-proj-yield">🎁 ${esc(def.yield.note)}</div>` : "";
        if (done) return `<div class="ee-proj done">
                    <div class="ee-proj-ic">${def.icon}</div>
                    <div class="ee-proj-bd"><div class="ee-proj-nm">${esc(def.name)} <i class="ee-dur ok">✓ 已完工</i></div></div>
                </div>`;
        return `<div class="ee-proj${afford ? " afford" : ""}">
                    <div class="ee-proj-ic">${def.icon || "🏗"}</div>
                    <div class="ee-proj-bd">
                        <div class="ee-proj-nm">${esc(def.name)} <i class="ee-dur">工期 ${def.days || 1} 天</i>${afford ? '<i class="ee-dur ok">✓ 资源充足</i>' : ""}</div>
                        <div class="ee-proj-ds">${esc(def.desc || "")}</div>
                        <div class="ee-cost">${lackChips}</div>${yNote}
                    </div>
                    <button class="ee-btn go" ${afford ? "" : "disabled"} onclick="WorldExt.act('${modId}','eeStart','${esc(def.id)}')">${afford ? "▶ 规划开工" : "资源不足"}</button>
                </div>`;
      }).join("");
    },
    /** 渲染：工程履历 */
    historyHTML(st) {
      const d = st.projects.done;
      if (!d.length) return "";
      return `<div class="ee-hist">${d.map((p) => `<div class="ee-flow-row"><i>第${p.finishedRound || "?"}轮</i><span>${esc(p.name)}</span><b class="ok">完工</b></div>`).join("")}</div>`;
    }
  };
  const Residents = {
    /** 接收住户（AI 上报或玩家收留） */
    add(st, { name, role, room, job }) {
      if (!name) return false;
      if (st.residents.list.length >= MAX_RESIDENTS) return false;
      if (st.residents.list.some((u) => u.name === name)) return false;
      st.residents.list.push({
        name: String(name).slice(0, 12),
        role: String(role || "").slice(0, 14),
        hp: 75 + Math.floor(Math.random() * 15),
        mood: 70 + Math.floor(Math.random() * 15),
        loyalty: 60 + Math.floor(Math.random() * 15),
        job: job || "待业",
        room: room || "",
        sinceRound: nowRound()
      });
      return true;
    },
    remove(st, name, why) {
      const i = st.residents.list.findIndex((u) => u.name === name);
      if (i < 0) return false;
      st.residents.list.splice(i, 1);
      st.residents.gone = st.residents.gone || [];
      st.residents.gone.unshift({ name, why: String(why || "").slice(0, 20), r: nowRound() });
      if (st.residents.gone.length > 8) st.residents.gone.length = 8;
      return true;
    },
    /** AI 上报合并：新住户入册 / 已有住户三态变化 */
    absorb(st, arr) {
      let d = false;
      (arr || []).forEach((x) => {
        var _a, _b;
        if (typeof x !== "object" || !x) {
          const nm2 = String(x).split(/[：:（(]/)[0].trim();
          if (nm2 && this.add(st, { name: nm2 })) d = true;
          return;
        }
        const nm = String(x.姓名 || x.name || "").trim();
        if (!nm) return;
        const exist = st.residents.list.find((u) => u.name === nm);
        if (!exist) {
          if (this.add(st, { name: nm, role: x.身份 || x.role, room: x.房间 || x.room, job: x.分工 || x.job })) d = true;
        } else {
          for (const [k, ak] of [["hp", "健康"], ["mood", "心情"], ["loyalty", "忠诚"]]) {
            const raw = (_a = x[ak]) != null ? _a : x[k];
            const n = Number((_b = String(raw != null ? raw : "").match(/-?\d+/)) == null ? void 0 : _b[0]);
            if (Number.isFinite(n) && n !== exist[k]) {
              exist[k] = clamp(n, 0, 100);
              d = true;
            }
          }
          if (x.状态 && typeof x.状态 === "string") {
            exist.status = x.状态.slice(0, 12);
            d = true;
          }
        }
      });
      return d;
    },
    /** 渲染：名册 */
    html(st, defs) {
      const L = st.residents.list;
      const beds = ((defs == null ? void 0 : defs.rooms) || []).length;
      const busy = L.filter((u) => u.job && u.job !== "待业").length;
      const head = `<div class="ee-resbar">
                <div class="ee-res"><span>🛏 床位</span><b>${L.length}/${beds || "∞"}</b></div>
                <div class="ee-res"><span>🔨 在岗</span><b>${busy}</b></div>
                <div class="ee-res"><span>💤 待业</span><b>${L.length - busy}</b></div>
            </div>`;
      if (!L.length) return head + `<div class="ee-empty"><b>🚪</b><p>尚无住户</p><small>正文里收留的幸存者会自动入住；也可在下方手动登记</small></div>`;
      const cards = L.map((u) => {
        const warn = u.loyalty < 40 ? `<div class="ee-npc-warn">⚠ 忠诚偏低${u.mood < 50 ? " + 心情不佳" : ""}——需要照看或提防</div>` : "";
        const jobDef = ((defs == null ? void 0 : defs.jobs) || []).find((j) => j.key === u.job);
        return `<div class="ee-npc${u.loyalty < 40 ? " risky" : ""}">
                    <div class="ee-npc-ava">${(jobDef == null ? void 0 : jobDef.icon) || "🙂"}</div>
                    <div class="ee-npc-bd">
                        <div class="ee-npc-nm"><b>${esc(u.name)}</b>
                            <i>${esc(u.role || "")} · 第${u.sinceRound || "?"}轮入住${u.room ? " · " + esc(u.room) : ""}</i>
                            <span class="ee-jobchip${u.job === "待业" ? " idle" : ""}">${u.job === "待业" ? "💤" : ""} ${esc(u.job)}</span>
                            ${u.status ? `<span class="ee-warnchip">${esc(u.status)}</span>` : ""}</div>
                        <div class="ee-npc-stats">
                            ${[["健康", u.hp, "#e0a04c"], ["心情", u.mood, "#6fb8d8"], ["忠诚", u.loyalty, u.loyalty < 40 ? "#e07856" : "#5fc47a"]].map(([l, v, c]) => `<div class="ee-stat"><b>${l}</b><div class="ee-bar"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div><span>${v}</span></div>`).join("")}
                        </div>${warn}
                    </div>
                    <div class="ee-npc-ops">
                        <select onchange="WorldExt.act('${st._modId || ""}','eeJob','${esc(u.name)}=' + this.value)" onclick="event.stopPropagation()">
                            ${((defs == null ? void 0 : defs.jobs) || [{ key: "待业" }]).map((j) => `<option value="${esc(j.key)}"${u.job === j.key ? " selected" : ""}>${esc(j.key)}</option>`).join("")}
                        </select>
                        <button class="ee-btn ghost sm" onclick="WorldExt.act('${st._modId || ""}','eeLeave','${esc(u.name)}')">请出</button>
                    </div>
                </div>`;
      }).join("");
      const gone = (st.residents.gone || []).length ? `<div class="ee-gone">${st.residents.gone.map((g) => `<span>${esc(g.name)}（${esc(g.why || "离开")}）</span>`).join("")}</div>` : "";
      return head + cards + gone;
    }
  };
  const Ops = {
    /** 玩家操作落地后：记一张待确认凭证 */
    add(st, text) {
      st.ops.tickets.push(String(text).slice(0, 90));
      return true;
    },
    /** 确认行动：打包全部待确认凭证（取后即清，转入已发送） */
    confirm(st) {
      const t = st.ops.tickets;
      if (!t.length) return null;
      st.ops.tickets = [];
      st.ops.confirmed.push({ r: nowRound(), items: t.slice() });
      if (st.ops.confirmed.length > 10) st.ops.confirmed.shift();
      return t;
    },
    /** 攒单栏渲染（待确认列表 + 确认按钮） */
    html(st, modId) {
      const t = st.ops.tickets;
      if (!t.length) return "";
      return `<div class="ee-opsbar">
                <div class="ee-ops-hd">📋 待确认行动（${t.length}）</div>
                ${t.map((x, i) => `<div class="ee-ops-item">· ${esc(x)} <button class="ee-x" onclick="WorldExt.act('${modId}','eeDropOp',${i})">✕</button></div>`).join("")}
                <button class="ee-btn main" onclick="WorldExt.act('${modId}','eeConfirm',1)">▶ 确认当前行动（${t.length}）</button>
                <small>确认后打包注入下一轮正文——AI 据此演绎，不得推翻已结算的账目</small>
            </div>`;
    },
    /** 凭证注入段（ai-message-builder 每轮取走，自动确认模式） */
    takeDirective(st, autoConfirm) {
      if (!st) return null;
      const items = autoConfirm ? this.confirm(st) : st.ops.tickets.length ? st.ops.tickets : null;
      if (!items || !items.length) return null;
      return `【玩家本轮行动（引擎已结算，正文据此演绎，账目神圣不得推翻）】
${items.map((x) => `· ${x}`).join("\n")}
演绎要求：写出这些行动的过程与动静（施工声响/邻里反应/住户心情），结果与数字以引擎账本为准，不得改写资源扣减与工程进度。`;
    }
  };
  function tick(st, cfg, events) {
    const r = nowRound();
    if (!st.meta.lastRound) {
      st.meta.lastRound = r;
      return;
    }
    const dr = r - st.meta.lastRound;
    if (dr <= 0) {
      st.meta.lastRound = r;
      return;
    }
    st.meta.lastRound = r;
    const rpd = Number(cfg == null ? void 0 : cfg.roundsPerDay) || 3;
    const dayNow = Math.floor(r / rpd);
    const dayPrev = Math.floor((r - dr) / rpd);
    if (dayNow > dayPrev) {
      st.meta.day = dayNow;
      const finished = Projects.tick(st);
      for (const [k, v] of Object.entries((cfg == null ? void 0 : cfg.daily) || {})) {
        Ledger.move(st, k, Number(v), "日耗/日产", "engine");
      }
      st.residents.list.forEach((u) => {
        const d = Math.floor(Math.random() * 11) - 5;
        u.mood = clamp(u.mood + d, 0, 100);
      });
      if (finished.length) {
        (events || (events = [])).push(...finished.map((p) => {
          var _a;
          return {
            icon: p.icon,
            text: `工程「${p.name}」完工${((_a = p.yield) == null ? void 0 : _a.note) ? "：" + p.yield.note : ""}`
          };
        }));
      }
    }
  }
  function timelineHTML(st) {
    const evts = [];
    (st.projects.done || []).forEach((p) => evts.push({ r: p.finishedRound, t: `🏗 ${p.name} 完工` }));
    (st.residents.list || []).forEach((u) => evts.push({ r: u.sinceRound, t: `👥 ${u.name} 入住` }));
    (st.ledger.flow || []).slice(0, 20).forEach((f) => evts.push({ r: f.r, t: `${f.d > 0 ? "📈" : "📉"} ${f.k} ${f.d > 0 ? "+" : ""}${f.d}（${f.why}）` }));
    evts.sort((a, b) => (b.r || 0) - (a.r || 0));
    if (!evts.length) return "";
    return `<div class="ee-timeline">${evts.slice(0, 12).map((e) => `<div class="ee-flow-row"><i>第${e.r || "?"}轮</i><span>${esc(e.t)}</span></div>`).join("")}</div>`;
  }
  window.EE = {
    version: VERSION,
    blank,
    Ledger,
    Projects,
    Residents,
    Ops,
    tick,
    timelineHTML,
    esc,
    clamp,
    MAX_QUEUE,
    MAX_RESIDENTS
  };
})();
