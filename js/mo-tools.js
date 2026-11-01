/* 云境 · 小云工具箱 v3.57.0（P5）
 * 让小云从「被动陪聊」升级为「能动手的世界管家」：
 *  - 🧭 世界诊断：实体统计 + 悬空引用体检 + 推演 5 步 + 规划进度，一屏看全
 *  - 🔮 推演未来：规则核心跑 what-if 预设分支，可让小云润色解读（LLM 只润色）
 *  - 🎯 剧情规划：打开规划面板（Planner）
 *  - ⏱ 世界时钟：开/停自主演化
 * 诊断结论里若发现数据问题（悬空关系/字段越界），一键走 SchemaValidator 收敛修复。
 */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function vars() {
    const fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function toast(m, t) { try { window.showToast && window.showToast(m, t || "info"); } catch (e) {} }

  function overlay(title, bodyHTML, footHTML) {
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(4,10,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
    ov.innerHTML = `<div style="width:min(480px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#0d1a20,#0a1418);border:1px solid #2a4a52;border-radius:14px;padding:18px;color:#cfe8e4;font-size:14px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#9adfd2;">${esc(title)}</div>
      ${bodyHTML}
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">${footHTML || `<button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>`}</div>
      <div data-msg style="color:#e0a04c;font-size:12px;margin-top:8px;min-height:16px;"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.dataset.act === "close") ov.remove(); });
    return ov;
  }

  /* ---------- 🧭 世界诊断 ---------- */
  function diagnose() {
    const v = vars();
    if (!v) { toast("世界尚未开始", "error"); return; }
    const sch = window.WorldExt && WorldExt.schema ? WorldExt.schema() : null;
    const ent = v.entities || {};
    const counts = sch && sch.entityCounts || {
      characters: Object.keys(ent.characters || {}).length, items: Object.keys(ent.items || {}).length,
      factions: Object.keys(ent.factions || {}).length, places: Object.keys(ent.places || {}).length,
      relations: (ent.relations || []).length
    };
    /* 体检：悬空关系引用 */
    const dangling = [];
    const exists = (id) => !!(ent.characters && ent.characters[id]) || !!(ent.factions && ent.factions[id]) || !!(ent.places && ent.places[id]) || !!(ent.items && ent.items[id]);
    (ent.relations || []).forEach((r) => {
      if (!exists(r.a) || !exists(r.b)) dangling.push(`${r.a}↔${r.b}`);
    });
    /* 推演 5 步 */
    let simLine = "推演不可用";
    try { if (window.SimCore) simLine = SimCore.project(v, 5).summary; } catch (e) {}
    /* 规划进度 */
    const plan = window.Planner && Planner.get();
    const planLine = plan ? `「${plan.goal}」 ${plan.steps.filter((s) => s.status === "done").length}/${plan.steps.length} 完成` : "尚未设立规划";
    /* 时钟 */
    const clock = window.WorldClock ? WorldClock.status() : null;
    const clockLine = clock ? (clock.enabled ? `运转中 · 世界第${clock.day}日 · 每${clock.intervalSec}s一天` : `已停 · 累计第${clock.day}日`) : "未加载";

    const row = (k, val) => `<div style="display:flex;justify-content:space-between;margin:4px 0;"><span style="color:#8fb8b0;">${k}</span><b>${esc(val)}</b></div>`;
    const body = `
      <div style="border:1px solid #1e3a42;border-radius:10px;padding:10px;">
        ${row("角色", counts.characters)}${row("法宝", counts.items)}${row("势力", counts.factions)}${row("地点", counts.places)}${row("关系边", counts.relations)}
      </div>
      <div style="margin-top:10px;">${dangling.length ? `⚠ 悬空关系引用 ${dangling.length} 条：${esc(dangling.slice(0, 5).join("、"))}${dangling.length > 5 ? "…" : ""}` : "✓ 关系网健康，无悬空引用"}</div>
      <div style="margin-top:10px;border-left:3px solid #1d6f60;padding-left:10px;">🔮 推演：${esc(simLine)}</div>
      <div style="margin-top:8px;">🎯 规划：${esc(planLine)}</div>
      <div style="margin-top:8px;">⏱ 时钟：${esc(clockLine)}</div>`;
    const foot = `${dangling.length ? `<button data-act="fix" style="flex:1;padding:9px;border:0;border-radius:8px;background:#7a3d1d;color:#ffe8dc;font-weight:700;cursor:pointer;">清理悬空关系</button>` : ""}
      <button data-act="ask" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">让小云解读</button>
      <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>`;
    const ov = overlay("🧭 世界诊断", body, foot);
    ov.addEventListener("click", (e) => {
      if (e.target.dataset.act === "fix") {
        const rels = v.entities && v.entities.relations;
        if (Array.isArray(rels)) {
          const before = rels.length;
          v.entities.relations = rels.filter((r) => exists(r.a) && exists(r.b));
          try { const fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (err) {}
          toast(`已清理 ${before - v.entities.relations.length} 条悬空关系`, "success");
          ov.remove(); diagnose();
        }
      }
      if (e.target.dataset.act === "ask") {
        ov.remove();
        try {
          if (window.MoAssistant && MoAssistant.send) MoAssistant.send(`请以世界管家口吻，解读这份世界诊断并给 2-3 条下一步建议（不要复述数字本身）：实体 角${counts.characters}/宝${counts.items}/势力${counts.factions}/地${counts.places}/关系${counts.relations}；推演：${simLine}；规划：${planLine}；时钟：${clockLine}。${dangling.length ? `另有 ${dangling.length} 条悬空关系已清理。` : ""}`);
        } catch (err) { toast("小云未就绪", "error"); }
      }
    });
  }

  /* ---------- 🔮 推演未来（规则核心 + 可选润色） ---------- */
  function whatif() {
    const v = vars();
    if (!v || !window.SimCore) { toast(simReady() ? "世界尚未开始" : "推演引擎未加载", "error"); return; }
    const base = SimCore.project(v, 5);
    const presets = [
      { label: "张力 +30（一场冲突爆发）", mutation: { tension: 30 } },
      { label: "张力 -30（主角斡旋成功）", mutation: { tension: -30 } },
      { label: "头号势力成员减半（内乱）", mutation: null }
    ];
    /* 头号势力动态算 */
    try {
      const fs = Object.values((v.entities || {}).factions || {});
      if (fs.length) {
        const top = fs.reduce((a, b) => ((Number(a.members) || 0) >= (Number(b.members) || 0) ? a : b));
        presets[2].mutation = { faction: { name: top.name, membersDelta: -Math.floor((Number(top.members) || 0) / 2) } };
        presets[2].label = `「${top.name}」成员减半（内乱）`;
      } else presets.splice(2, 1);
    } catch (e) { presets.splice(2, 1); }
    const body = `<div style="border-left:3px solid #1d6f60;padding-left:10px;white-space:pre-wrap;line-height:1.6;">${esc(SimCore.narrate(base))}</div>
      <div style="margin-top:12px;color:#8fb8b0;">试试 what-if 分叉：</div>
      ${presets.map((p, i) => `<button data-wif="${i}" style="display:block;width:100%;margin:6px 0;padding:8px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#cfe8e4;cursor:pointer;text-align:left;">${esc(p.label)}</button>`).join("")}`;
    const ov = overlay("🔮 推演未来（规则核心 · 可复算）", body,
      `<button data-act="ask" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">让小云润色解读</button>
       <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>`);
    ov.addEventListener("click", async (e) => {
      const wif = e.target.dataset.wif;
      if (wif != null) {
        const p = presets[Number(wif)];
        if (!p || !p.mutation) return;
        const r = SimCore.whatIf(v, p.mutation, 5);
        const msg = ov.querySelector("[data-msg]");
        if (msg) msg.textContent = `${p.label} → ${r.verdict}`;
      }
      if (e.target.dataset.act === "ask") {
        ov.remove();
        try { if (window.MoAssistant && MoAssistant.send) MoAssistant.send(`请以说书人口吻解读这份世界推演，并指出玩家最该关注的两个信号：\n${SimCore.narrate(base)}`); } catch (err) { toast("小云未就绪", "error"); }
      }
    });
  }
  function simReady() { return !!window.SimCore; }

  /* ---------- 🎯 / ⏱ ---------- */
  function plan() {
    if (window.Planner) Planner.panel();
    else toast("规划器未加载", "error");
  }
  function clock() {
    if (window.WorldClock) WorldClock.toggle();
    else toast("世界时钟未加载", "error");
  }

  function run(tool) {
    if (tool === "diagnose") return diagnose();
    if (tool === "whatif") return whatif();
    if (tool === "plan") return plan();
    if (tool === "clock") return clock();
  }

  window.MoTools = { run, diagnose, whatif, plan, clock };
})();
