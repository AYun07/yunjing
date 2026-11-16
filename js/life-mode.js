/* 云境 · 自由人生 v3.58.0（P6）
 * 玩家可以不参与主线、不扮演原著角色——创建一个原创人物过自己的人生百态：
 *  - 建档：姓名 / 出身 / 志向，写入 vars.characters 并标记 isPlayer（地图行迹跟随 TA）
 *  - 人生轨迹：世界时钟每日结算声望/财力漂移，三日记一笔人生大事
 *  - 提示词注入：包装 WorldExt.takeDirective，让主笔知道「玩家正走原创人生线」，
 *    主线人物可偶遇但勿强行绑定——人生线由世界为其提供际遇与波澜。
 * 数据存于 vars.人生（随存档持久化），规划可与之并行（Planner 管主线，LifeMode 管人生）。
 */
(function () {
  "use strict";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function hashStr(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function vars() {
    const fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function save() { try { const fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {} }
  function toast(m, t) { try { window.showToast && window.showToast(m, t || "success"); } catch (e) {} }

  const ORIGINS = ["寒门子弟", "落魄世家", "市井小民", "异乡来客", "山野猎户", "商队遗孤", "没入门派的散修", "官宦之后（家道中落）"];

  function profile(v) {
    v = v || vars();
    return (v && v.人生 && typeof v.人生 === "object") ? v.人生 : null;
  }

  /** 建档/重设：创建原创人生主角（不覆写已有同名角色，而是补档案+接管标记） */
  function setup(name, origin, ambition, location) {
    const v = vars();
    if (!v) return { ok: false, msg: "世界尚未开始" };
    name = String(name || "").trim().slice(0, 16);
    if (!name) return { ok: false, msg: "姓名不能为空" };
    if (!v.characters || typeof v.characters !== "object") v.characters = {};
    const c = v.characters[name] || { name };
    Object.assign(c, {
      role: c.role || "自由人",
      origin: "原创",
      isPlayer: true,
      profiled: true,
      ambition: String(ambition || "").trim().slice(0, 60) || c.ambition || "过自己想要的生活"
    });
    if (location) c.location = String(location).trim().slice(0, 60);
    v.characters[name] = c;
    v.人生 = {
      enabled: true,
      name,
      origin: String(origin || "寒门子弟").slice(0, 30),
      ambition: c.ambition,
      声望: Number(v.人生 && v.人生.声望) || 10,
      财力: Number(v.人生 && v.人生.财力) || 10,
      day: Number(v.人生 && v.人生.day) || 0,
      log: Array.isArray(v.人生 && v.人生.log) ? v.人生.log : []
    };
    try { window.EntityStore && window.EntityStore.bootstrap(v); } catch (e) {}
    save();
    return { ok: true, name };
  }

  const LIFE_EVENTS = [
    "在坊市帮人调解了一场纠纷，赚了些口碑",
    "夜里翻来覆去，想起「{amb}」，又添了几分劲头",
    "结识一位走南闯北的行商，听来不少外面的消息",
    "手头渐渐宽裕，盘算着置办些像样的行头",
    "一场急雨中躲进屋檐，与陌生人分了半块干粮",
    "旧识捎来口信：有人打听你的下落",
    "路过告示墙，把一张招人启事记在了心里",
    "起大早练了一个时辰的拳脚，筋骨舒畅"
  ];

  /** 世界时钟日结算：声望/财力漂移 + 三日记一笔人生 */
  function daily(v, day, rnd) {
    const life = profile(v);
    if (!life || !life.enabled) return [];
    const events = [];
    life.day = day;
    const t = clamp(Number(v.tension) || 0, 0, 100);
    const oldR = Math.round(life.声望), oldW = Math.round(life.财力);
    life.声望 = clamp(life.声望 + (rnd() * 2.4 - 1) + (t > 60 ? 0.6 : 0), 0, 100);
    life.财力 = clamp(life.财力 + (rnd() * 2 - 1.1), 0, 100);
    if (Math.floor(oldR / 25) !== Math.floor(life.声望 / 25))
      events.push(`「${life.name}」的名声${life.声望 > oldR ? "渐起" : "受损"}（声望 ${Math.round(life.声望)}/100）`);
    if (day % 3 === 0) {
      const tpl = LIFE_EVENTS[Math.floor(rnd() * LIFE_EVENTS.length)];
      const line = tpl.replace("{amb}", life.ambition || "心中的念想");
      life.log.push(`第${day}日 · ${line}`);
      if (life.log.length > 20) life.log.splice(0, life.log.length - 20);
      if (!Array.isArray(v.history)) v.history = [];
      v.history.push(`【人生】第${day}日 · ${life.name}${line}`);
      save();
    }
    void oldW;
    return events;
  }

  /** 提示词注入：主笔知道玩家正走原创人生线 */
  function directiveLine() {
    const v = vars();
    const life = profile(v);
    if (!life || !life.enabled) return "";
    return `【自由人生】玩家正以原创人物「${life.name}」（${life.origin}）过自己的人生，不参与原著主线。志向：${life.ambition}；声望 ${Math.round(life.声望)}/100，财力 ${Math.round(life.财力)}/100。请让世界为这条人生线提供际遇与波澜——原著人物可偶遇、可交易、可结怨，但勿强行把玩家绑进主线剧情。`;
  }
  let installed = false;
  function installDirective() {
    if (installed) return;
    if (!window.WorldExt || typeof WorldExt.takeDirective !== "function") { setTimeout(installDirective, 1500); return; }
    if (WorldExt.takeDirective.__life) { installed = true; return; }
    const orig = WorldExt.takeDirective;
    WorldExt.takeDirective = function () {
      const out = orig.apply(WorldExt, arguments);
      try { const line = directiveLine(); if (line) return (out ? out + "\n\n" : "") + line; } catch (e) {}
      return out;
    };
    WorldExt.takeDirective.__life = true;
    installed = true;
  }
  installDirective();

  /* ---------- 面板 ---------- */
  function panel() {
    const v = vars();
    if (!v) { toast("世界尚未开始，先开启故事", "error"); return; }
    const life = profile(v);
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(4,10,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
    const body = life && life.enabled ? `
      <div style="border:1px solid #1e3a42;border-radius:10px;padding:12px;">
        <div style="display:flex;justify-content:space-between;"><b style="color:#9adfd2;font-size:15px;">${esc(life.name)}</b><span style="color:#6f9a92;font-size:12px;">${esc(life.origin)}</span></div>
        <div style="margin-top:6px;color:#8fb8b0;font-size:13px;">志向：${esc(life.ambition)}</div>
        <div style="margin-top:8px;">声望 <b style="color:#e0c04c;">${Math.round(life.声望)}</b>/100　财力 <b style="color:#e0c04c;">${Math.round(life.财力)}</b>/100　<span style="color:#6f9a92;font-size:12px;">世界第 ${life.day} 日</span></div>
        <div style="margin-top:8px;"><div style="height:6px;border-radius:3px;background:#08121a;overflow:hidden;"><div style="width:${Math.round(life.声望)}%;height:100%;background:#1d6f60;"></div></div></div>
        ${life.log && life.log.length ? `<div style="margin-top:10px;font-size:12.5px;color:#8fb8b0;max-height:130px;overflow:auto;border-top:1px dashed #1e3a42;padding-top:8px;">${life.log.slice(-6).reverse().map((l) => `<div style="margin:3px 0;">· ${esc(l)}</div>`).join("")}</div>` : ""}
      </div>
      <div style="font-size:12px;color:#6f9a92;margin-top:8px;">开世界时钟后，人生随世界每日演化；志向已注入主笔提示词。</div>` : `
      <div style="color:#8fb8b0;font-size:13px;margin-bottom:8px;">创建一个原创人物，走一条不属于原著的人生。主线照常运转，你过你的日子——世界会为这条人生线安排际遇。</div>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0;"><span style="width:56px;">姓名</span><input id="lifeN" type="text" maxlength="16" placeholder="如：陈九思" style="flex:1;padding:8px 10px;border:1px solid #2a4a52;border-radius:8px;background:#08121a;color:#dff5ef;"></label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0;"><span style="width:56px;">出身</span><select id="lifeO" style="flex:1;padding:8px 10px;border:1px solid #2a4a52;border-radius:8px;background:#08121a;color:#dff5ef;">${ORIGINS.map((o) => `<option>${o}</option>`).join("")}</select></label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0;"><span style="width:56px;">志向</span><input id="lifeA" type="text" maxlength="60" placeholder="如：攒钱开一间自己的药铺" style="flex:1;padding:8px 10px;border:1px solid #2a4a52;border-radius:8px;background:#08121a;color:#dff5ef;"></label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0;"><span style="width:56px;">所在</span><input id="lifeL" type="text" maxlength="60" placeholder="留空则随剧情" style="flex:1;padding:8px 10px;border:1px solid #2a4a52;border-radius:8px;background:#08121a;color:#dff5ef;"></label>`;
    const foot = life && life.enabled
      ? `<button data-act="ask" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">让小云编织际遇</button>
         <button data-act="redo" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">重新设定</button>
         <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>`
      : `<button data-act="ok" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">踏上人生</button>
         <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>`;
    ov.innerHTML = `<div style="width:min(440px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#0d1a20,#0a1418);border:1px solid #2a4a52;border-radius:14px;padding:18px;color:#cfe8e4;font-size:14px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#9adfd2;">🎲 自由人生</div>${body}
      <div style="display:flex;gap:10px;margin-top:14px;">${foot}</div>
      <div data-msg style="color:#e0a04c;font-size:12px;margin-top:8px;min-height:16px;"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const act = e.target.dataset.act;
      if (e.target === ov || act === "close") { ov.remove(); return; }
      if (act === "ok") {
        const r = setup(ov.querySelector("#lifeN").value, ov.querySelector("#lifeO").value, ov.querySelector("#lifeA").value, ov.querySelector("#lifeL").value);
        if (!r.ok) { const m = ov.querySelector("[data-msg]"); if (m) m.textContent = r.msg; return; }
        toast(`人生开卷：「${r.name}」已入众生谱`);
        ov.remove(); panel();
      }
      if (act === "redo") { const v2 = vars(); if (v2) v2.人生 = Object.assign({}, profile(v2), { enabled: false }); ov.remove(); panel(); }
      if (act === "ask") {
        const life2 = profile(v);
        ov.remove();
        try {
          if (window.MoAssistant && MoAssistant.send) MoAssistant.send(`我正以原创人物「${life2.name}」（${life2.origin}）过自由人生，志向是「${life2.ambition}」，声望${Math.round(life2.声望)}、财力${Math.round(life2.财力)}。请不经过主线、直接为我的下一段人生编织一场具体的际遇（含地点、人物与一个小转折）。`);
        } catch (err) { toast("小云未就绪", "error"); }
      }
    });
  }

  window.LifeMode = { setup, daily, profile, directiveLine, panel, _ORIGINS: ORIGINS, _hashStr: hashStr, _mulberry32: mulberry32 };
})();
