/* 云境 · 剧情规划器 v3.57.0（P5）
 * 持久化规划：目标 → 3-6 步计划（LLM 生成，规则解析入库），随写随存。
 * - 每轮经 WorldExt.takeDirective 把「当前规划」注入主笔提示词（规划→推进闭环）
 * - 步骤进度可手动勾选；规划按 genre 独立存储
 * - 生成走主叙事 API（callOpenAI，cfgOverride 缺省 = 主配置）
 */
(function () {
  "use strict";
  function key() { return "yunjing.plan." + ((window.WorldExt && WorldExt.genre) || "free"); }
  function load() { try { return JSON.parse(localStorage.getItem(key()) || "null") || null; } catch (e) { return null; } }
  function save(p) { try { localStorage.setItem(key(), JSON.stringify(p)); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  function get() { return load(); }

  /** 解析 LLM 输出：编号行 → 步骤（容错：破折号/序号变体） */
  function _parseSteps(text) {
    const steps = [];
    String(text || "").split(/\n+/).forEach((line) => {
      const m = line.match(/^\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*[\.、\)）:：]\s*(.{4,120})/) || line.match(/^\s*[-•·]\s*(.{4,120})/);
      if (m) steps.push({ id: "st_" + (steps.length + 1), text: m[1].trim().replace(/\s+$/, ""), status: "todo" });
    });
    return steps.slice(0, 6);
  }

  function _savePlan(goal, steps) {
    const p = { goal: String(goal || "").slice(0, 80), steps, createdAt: Date.now(), updatedAt: Date.now() };
    save(p);
    try { window.MoChibi && MoChibi.react && MoChibi.react("plan", { goal: p.goal }); } catch (e) {}
    return p;
  }

  /** LLM 生成规划（主叙事 API；失败抛错由调用方提示） */
  async function generate(goal) {
    if (!window.callOpenAI) throw new Error("主 API 未就绪（callOpenAI 未加载）");
    const v = (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables) || {};
    const ctx = [
      v.title ? `作品：《${v.title}》` : "",
      `当前章节：${v.chapter || 1}，张力：${v.tension != null ? v.tension : "?"}`,
      Array.isArray(v.history) && v.history.length ? `近况：${v.history.slice(-4).join("；")}` : ""
    ].filter(Boolean).join("\n");
    const out = await window.callOpenAI([
      { role: "system", content: "你是严密的剧情规划师。基于用户给出的现状与目标，输出 3-6 条推进步骤。每条一句话（15-50字），必须具体可检验（出现人物/地点/事件），按剧情因果排序。只输出编号步骤，不要其他内容。" },
      { role: "user", content: (ctx ? ctx + "\n\n" : "") + "规划目标：" + goal }
    ], { maxTokens: 600, temperature: 0.5 });
    const steps = _parseSteps(typeof out === "string" ? out : (out && out.text) || (out && out.content) || "");
    if (!steps.length) throw new Error("生成结果无法解析为步骤，请重试或换模型");
    return _savePlan(goal, steps);
  }

  function setStatus(stepId, status) {
    const p = load(); if (!p) return null;
    const s = p.steps.find((x) => x.id === stepId);
    if (s) { s.status = status === "done" ? "done" : status === "doing" ? "doing" : "todo"; p.updatedAt = Date.now(); save(p); }
    return p;
  }
  function reset() { try { localStorage.removeItem(key()); } catch (e) {} }

  /** 当前规划 → 指令行（doing 优先，其次第一个 todo） */
  function directiveLine() {
    const p = load();
    if (!p || !p.steps || !p.steps.length) return "";
    const doing = p.steps.find((s) => s.status === "doing");
    const next = p.steps.find((s) => s.status === "todo");
    const doneN = p.steps.filter((s) => s.status === "done").length;
    const bits = [`【当前规划 · 目标：${p.goal}】进度 ${doneN}/${p.steps.length}`];
    if (doing) bits.push(`正在推进：${doing.text}`);
    if (next) bits.push(`下一步：${next.text}`);
    else if (!doing && doneN === p.steps.length) bits.push("规划已全部达成——可向玩家揭示阶段性成果，并提议新目标。");
    return bits.join("\n");
  }

  /* 指令注入：包装 takeDirective（仿 world-director 范式，只包一次） */
  let installed = false;
  function installDirective() {
    if (installed) return;
    if (!window.WorldExt || typeof WorldExt.takeDirective !== "function") { setTimeout(installDirective, 1500); return; }
    if (WorldExt.takeDirective.__planned) { installed = true; return; }
    const orig = WorldExt.takeDirective;
    WorldExt.takeDirective = function () {
      const out = orig.apply(WorldExt, arguments);
      try { const line = directiveLine(); if (line) return (out ? out + "\n\n" : "") + line; } catch (e) {}
      return out;
    };
    WorldExt.takeDirective.__planned = true;
    installed = true;
  }
  installDirective();

  /* ---------- 规划面板（自包含浮层） ---------- */
  function panel() {
    const p = load();
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(4,10,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
    const body = !p ? `<div style="color:#8fb8b0;padding:8px 0;">还没有规划。点击下方「新规划」设立一个目标。</div>` :
      `<div style="margin-bottom:8px;"><b style="color:#9adfd2;">🎯 ${esc(p.goal)}</b> <span style="color:#6f9a92;font-size:12px;">${p.steps.filter((s) => s.status === "done").length}/${p.steps.length} 完成</span></div>` +
      p.steps.map((s) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0;">
        <button data-step="${esc(s.id)}" data-cur="${esc(s.status)}" style="width:30px;height:30px;border-radius:8px;border:1px solid #2a4a52;background:${s.status === "done" ? "#1d6f60" : s.status === "doing" ? "#7a5c1d" : "transparent"};color:#eafff8;cursor:pointer;flex:none;">${s.status === "done" ? "✓" : s.status === "doing" ? "▶" : "○"}</button>
        <span style="flex:1;${s.status === "done" ? "text-decoration:line-through;color:#6f9a92;" : ""}">${esc(s.text)}</span></div>`).join("");
    ov.innerHTML = `<div style="width:min(460px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#0d1a20,#0a1418);border:1px solid #2a4a52;border-radius:14px;padding:18px;color:#cfe8e4;font-size:14px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#9adfd2;">🎯 剧情规划</div>
      ${body}
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button data-act="new" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">新规划</button>
        <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>
      </div><div data-msg style="color:#e0a04c;font-size:12px;margin-top:8px;min-height:16px;"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", async (e) => {
      const stepBtn = e.target.closest("[data-step]");
      if (stepBtn) {
        const next = stepBtn.dataset.cur === "done" ? "todo" : stepBtn.dataset.cur === "doing" ? "done" : "doing";
        setStatus(stepBtn.dataset.step, next);
        ov.remove(); panel();
        return;
      }
      if (e.target.dataset.act === "close" || e.target === ov) { ov.remove(); return; }
      if (e.target.dataset.act === "new") {
        try {
          const goal = await (window.UIDialog && UIDialog.prompt ? UIDialog.prompt({ title: "新规划", message: "这一阶段的剧情目标？（例：让主角在魔道联盟站稳脚跟并夺回青元剑）", placeholder: "目标一句话" }) : null);
          if (!goal) return;
          const msg = ov.querySelector("[data-msg]");
          if (msg) msg.textContent = "正在生成规划…";
          await generate(goal);
          ov.remove(); panel();
          try { window.showToast && showToast("规划已生成并注入后续提示词", "success"); } catch (err) {}
        } catch (err) {
          const msg = ov.querySelector("[data-msg]");
          if (msg) msg.textContent = "生成失败：" + String(err && err.message || err);
        }
      }
    });
    return ov;
  }

  window.Planner = { get, generate, setStatus, reset, directiveLine, panel, _parseSteps, _savePlan };
})();
