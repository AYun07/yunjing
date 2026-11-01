/* 云境 · 推演引擎 v3.57.0（P3）
 * 规则核心：确定性前向模拟——输入当前变量快照，按规则推演未来 N 步，
 * 可复算（种子化随机）、可 what-if（对比基线给出分叉差异）。
 * LLM 不参与推演本身，只负责润色解读（「规则核心 + LLM 润色」）。
 *
 * 模型要点：
 *  - 势力实力 = f(成员数, 地盘广度) → power
 *  - 关系边强度每步自然衰减（无强化则淡忘）；敌对边把 tension 推高
 *  - tension 自然回落；越过 70 预警「大事将起」，越过 90 预警「剧变」
 *  - 地点危险度向区域基线回归
 */
(function () {
  "use strict";

  /* ---------- 种子化 PRNG（可复算） ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- 状态快照 → 模拟态 ---------- */
  function snapshot(vars) {
    const v = vars || {};
    const ents = v.entities || {};
    const factions = {};
    Object.values(ents.factions || {}).forEach((f) => {
      factions[f.id || f.name] = {
        id: f.id || f.name, name: f.name || f.id || "无名势力",
        members: Math.max(0, Number(f.members) || 0),
        territory: String(f.territory || "").length,
        ideology: f.ideology || ""
      };
    });
    /* 角色按 faction 字段归属势力（弱归属：计数） */
    const roster = {};
    Object.values(ents.characters || v.characters || {}).forEach((c) => {
      if (!c || !c.faction) return;
      const fid = Object.values(factions).find((f) => f.name === c.faction || f.id === c.faction);
      if (fid) roster[fid.id] = (roster[fid.id] || 0) + 1;
    });
    for (const id of Object.keys(factions)) factions[id].roster = roster[id] || 0;
    return {
      tension: clamp(Math.round(Number(v.tension) || 0), 0, 100),
      chapter: Math.round(Number(v.chapter) || 0),
      factions,
      places: Object.values(ents.places || {}).map((p) => ({
        id: p.id || p.name, name: p.name || "无名地",
        danger: clamp(Math.round(Number(p.danger) || 0), 0, 100),
        region: p.region || ""
      })),
      relations: (ents.relations || []).map((r) => ({
        a: r.a, b: r.b, kind: r.kind || "陌路",
        strength: clamp(Math.round(Number(r.strength) || 0), -100, 100)
      }))
    };
  }
  function factionPower(f) {
    /* 成员为主，地盘与驻地角色为辅（对数压扁防天梯垄断） */
    return Math.round(
      Math.log2(1 + f.members) * 10 +
      Math.log2(1 + f.territory) * 3 +
      f.roster * 4
    );
  }

  /* ---------- 单步推演（纯函数：state → {state, events}） ---------- */
  function stepOnce(st, rnd) {
    const events = [];
    /* 1) 关系衰减 + 敌对升温 */
    const hostile = [];
    st.relations = st.relations.map((r) => {
      const decay = Math.abs(r.strength) > 20 ? Math.sign(r.strength) * (1 + Math.floor(rnd() * 2)) : 0;
      const s = clamp(r.strength - decay, -100, 100);
      if (r.kind === "敌对" && s >= 40) hostile.push(s);
      return Object.assign({}, r, { strength: s });
    });
    /* 2) 势力消长（小步漂移） */
    const ids = Object.keys(st.factions);
    ids.forEach((id, i) => {
      const f = st.factions[id];
      const drift = Math.round((rnd() * 2 - 1) * 3) + (f.roster ? 1 : -1);
      f.members = Math.max(0, f.members + drift * 3);
      f._power = factionPower(f);
      void i;
    });
    /* 强弱悬殊 → 吞并预警 */
    if (ids.length >= 2) {
      const sorted = ids.map((id) => st.factions[id]).sort((x, y) => y._power - x._power);
      if (sorted[0]._power >= sorted[sorted.length - 1]._power * 2 + 10 && rnd() < 0.35)
        events.push(`「${sorted[0].name}」声势已远超「${sorted[sorted.length - 1].name}」，吞并只在朝夕`);
    }
    /* 3) 张力演化 */
    let t = st.tension + hostile.length * 4 - 3 + Math.round((rnd() * 2 - 1) * 2);
    t = clamp(t, 0, 100);
    if (st.tension < 70 && t >= 70) events.push("⚔ 山雨欲来：多方矛盾叠加，大事将起");
    if (st.tension < 90 && t >= 90) events.push("🔥 剧变临界：一触即发，需主角决断");
    if (st.tension >= 70 && t < 70) events.push("🍃 危机暂缓：张力回落到可掌控区间");
    st.tension = t;
    /* 4) 地点危险度回归区域基线（按区域哈希定基线 20-60） */
    st.places.forEach((p) => {
      const base = 20 + (hashStr(p.region || p.name) % 41);
      p.danger = clamp(p.danger + Math.sign(base - p.danger) * (rnd() < 0.6 ? 1 : 0), 0, 100);
    });
    return events;
  }

  /* ---------- 投影 N 步 ---------- */
  function project(vars, steps, seed) {
    const st = snapshot(vars);
    const baseSeed = seed == null ? (hashStr(JSON.stringify(st.factions) + st.tension) ^ 0x9e3779b9) : seed;
    const rnd = mulberry32(baseSeed);
    const out = { steps: [], seed: baseSeed, startTension: st.tension };
    for (let i = 1; i <= (steps || 5); i++) {
      const events = stepOnce(st, rnd);
      out.steps.push({
        step: i,
        tension: st.tension,
        powers: Object.values(st.factions).map((f) => ({ name: f.name, power: f._power || factionPower(f) })),
        events
      });
    }
    out.endTension = st.tension;
    out.summary = summarize(out);
    return out;
  }
  function summarize(proj) {
    const bits = [];
    bits.push(`张力 ${proj.startTension} → ${proj.endTension}`);
    const evts = proj.steps.flatMap((s) => s.events);
    if (evts.length) bits.push(`${evts.length} 个推演事件`);
    const top = proj.steps[proj.steps.length - 1].powers.sort((a, b) => b.power - a.power)[0];
    if (top) bits.push(`最强势力「${top.name}」(实力${top.power})`);
    return bits.join("；");
  }

  /* ---------- what-if：与基线对比 ---------- */
  function whatIf(vars, mutation, steps, seed) {
    const base = project(vars, steps, seed);
    const v2 = JSON.parse(JSON.stringify(vars || {}));
    applyMutation(v2, mutation);
    const alt = project(v2, steps, seed == null ? undefined : seed);
    const diffs = [];
    if (base.endTension !== alt.endTension)
      diffs.push({ kind: "tension", from: base.endTension, to: alt.endTension, delta: alt.endTension - base.endTension });
    const eventsB = new Set(base.steps.flatMap((s) => s.events));
    const eventsA = alt.steps.flatMap((s) => s.events).filter((e) => !eventsB.has(e));
    if (eventsA.length) diffs.push({ kind: "events", added: eventsA });
    const verdict = diffVerdict(base, alt, diffs);
    return { baseline: base, alternative: alt, diffs, verdict, mutation: describeMutation(mutation) };
  }
  function applyMutation(v, m) {
    if (!m || typeof m !== "object") return;
    if (m.tension != null) v.tension = clamp((Number(v.tension) || 0) + Number(m.tension), 0, 100);
    if (m.relation && v.entities) {
      const rels = v.entities.relations = v.entities.relations || [];
      const i = rels.findIndex((r) => (r.a === m.relation.a && r.b === m.relation.b) || (r.a === m.relation.b && r.b === m.relation.a));
      const edge = i >= 0 ? rels[i] : { a: m.relation.a, b: m.relation.b, kind: m.relation.kind || "敌对", strength: 0 };
      edge.kind = m.relation.kind || edge.kind;
      edge.strength = clamp((Number(edge.strength) || 0) + (m.relation.strength != null ? Number(m.relation.strength) : 0), -100, 100);
      if (i < 0) rels.push(edge); else rels[i] = edge;
    }
    if (m.faction && m.faction.name && v.entities) {
      const f = Object.values(v.entities.factions || {}).find((x) => x.name === m.faction.name || x.id === m.faction.name);
      if (f) f.members = Math.max(0, (Number(f.members) || 0) + (m.faction.membersDelta || 0));
    }
  }
  function describeMutation(m) {
    if (!m) return "无";
    const bits = [];
    if (m.tension != null) bits.push(`张力${m.tension > 0 ? "+" : ""}${m.tension}`);
    if (m.relation) bits.push(`关系「${m.relation.a}↔${m.relation.b}」${m.relation.kind || ""}${m.relation.strength != null ? (m.relation.strength > 0 ? "+" : "") + m.relation.strength : ""}`);
    if (m.faction) bits.push(`势力「${m.faction.name}」成员${(m.faction.membersDelta || 0) > 0 ? "+" : ""}${m.faction.membersDelta || 0}`);
    return bits.join("，") || "无";
  }
  function diffVerdict(base, alt, diffs) {
    if (!diffs.length) return "与基线走向基本一致——此改动不改变大局。";
    const dt = alt.endTension - base.endTension;
    if (dt > 0) return `分叉：整体更动荡（终局张力 ${dt > 0 ? "+" : ""}${dt}）。${diffs.find((d) => d.kind === "events") ? "且衍生出基线没有的事件。" : ""}`;
    if (dt < 0) return `分叉：整体更平缓（终局张力 ${dt}）。适合作为缓冲手段。`;
    return "终局张力相同，但过程出现分叉事件。";
  }

  /* ---------- 规则叙事（不调 LLM，可直接展示 / 交小云润色） ---------- */
  function narrate(proj) {
    const lines = [`【推演 · ${proj.steps.length} 步】${proj.summary}`];
    proj.steps.forEach((s) => {
      const head = `第${s.step}步（张力${s.tension}）：`;
      lines.push(s.events.length ? head + s.events.join("；") : head + "风平浪静");
    });
    return lines.join("\n");
  }

  window.SimCore = { project, whatIf, narrate, snapshot, _mulberry32: mulberry32, _hashStr: hashStr };
})();
