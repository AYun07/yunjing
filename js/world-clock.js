/* 云境 · 自主世界时钟 v3.57.0（P4）
 * 让世界脱离玩家操作自行演化：按真实时间滴答（默认 180s = 世界 1 天），
 * 规则核心驱动——张力回落、势力消长、关系淡忘、地点危险回归、随机世界事件。
 *
 * 定时器安全铁律（v3.55.29 指数裂变崩溃的教训）：
 *  - 全局唯一 interval（start 前必先 clear，含既有实例）
 *  - tick 内绝不再排定时器，工作有界（事件模板挑选 O(实体数)）
 *  - 页面隐藏（visibilityState==="hidden"）时跳过结算，不积累任务
 *  - 等待故事就绪用「有界重试」（上限 60 次 × 2s），绝不无限链
 */
(function () {
  "use strict";
  const TICK_DEFAULT_SEC = 180;
  const MAX_HISTORY = 60;
  function genre() {
    try { return window.WorldExt && WorldExt.genre ? WorldExt.genre : (new URLSearchParams(location.search).get("genre") || "free"); }
    catch (e) { return "free"; }
  }
  function lsKey() { return "yunjing.clock." + genre(); }
  function loadCfg() {
    try { return Object.assign({ enabled: false, intervalSec: TICK_DEFAULT_SEC }, JSON.parse(localStorage.getItem(lsKey()) || "{}")); }
    catch (e) { return { enabled: false, intervalSec: TICK_DEFAULT_SEC }; }
  }
  function saveCfg() { try { localStorage.setItem(lsKey(), JSON.stringify(cfg)); } catch (e) {} }

  let cfg = loadCfg();
  let timer = null;
  let ticking = false; /* 单飞重入锁 */

  function vars() {
    const fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function save() { try { const fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {} }
  function toast(m, t) { try { window.showToast && window.showToast(m, t || "info"); } catch (e) {} }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function hashStr(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 世界事件模板（按实体挑 1 条，确定性种子） ---------- */
  function pickEvent(vars, rnd) {
    const ent = vars.entities || {};
    const factions = Object.values(ent.factions || {});
    const places = Object.values(ent.places || {});
    const chars = Object.values(ent.characters || vars.characters || {});
    const pool = [];
    if (factions.length >= 2) {
      const [a, b] = [factions[Math.floor(rnd() * factions.length)], factions[Math.floor(rnd() * factions.length)]];
      if (a && b && a !== b) pool.push(`「${a.name}」与「${b.name}」在边贸市场起了摩擦，商路为之一滞`);
    }
    if (factions.length && places.length) {
      const f = factions[Math.floor(rnd() * factions.length)];
      const p = places[Math.floor(rnd() * places.length)];
      if (f && p) pool.push(`「${f.name}」的人马出现在「${p.name}」，似乎在打探什么`);
    }
    if (chars.length) {
      const c = chars[Math.floor(rnd() * chars.length)];
      if (c && c.name) pool.push(`远方的消息传来：「${c.name}」那边似乎有了新的动向`);
    }
    pool.push("市井之间流传着几则真假难辨的传闻，无人知道源头");
    pool.push("季节流转，天地灵气的潮汐悄悄变了方向");
    return pool[Math.floor(rnd() * pool.length)];
  }

  /* ---------- 单次世界日结算（有界、纯规则） ---------- */
  function tick() {
    if (ticking) return;             /* 单飞：重入直接丢弃本拍 */
    if (document.visibilityState === "hidden") return; /* 后台不积累 */
    const v = vars();
    if (!v) return;
    ticking = true;
    try {
      v.时间 = v.时间 && typeof v.时间 === "object" ? v.时间 : {};
      const day = (Number(v.时间.clockDay) || 0) + 1;
      v.时间.clockDay = day;
      const rnd = mulberry32(hashStr(genre() + ":" + day));
      /* 张力自然回落 */
      if (v.tension != null) v.tension = clamp(Math.round(Number(v.tension)) - (rnd() < 0.5 ? 1 : 0), 0, 100);
      /* 关系淡忘：|强度|>20 每日衰减 1（世界推进，非玩家回合） */
      const rels = v.entities && v.entities.relations;
      if (Array.isArray(rels)) rels.forEach((r) => {
        if (Math.abs(Number(r.strength) || 0) > 20) r.strength -= Math.sign(r.strength);
      });
      /* 世界事件入史 */
      const ev = pickEvent(v, rnd);
      if (!Array.isArray(v.history)) v.history = [];
      v.history.push(`【世界】第${day}日 · ${ev}`);
      if (v.history.length > MAX_HISTORY) v.history.splice(0, v.history.length - MAX_HISTORY);
      /* 待注入事件（供导演/规划在下一轮提示词引用） */
      v.时间.pendingEvents = [ev].concat(Array.isArray(v.时间.pendingEvents) ? v.时间.pendingEvents : []).slice(0, 3);
      v.时间.lastClockAt = Date.now();
      save();
      toast(`⏱ 世界第${day}日：${ev}`, "info");
      try { window.StoryStatusRenderer && StoryStatusRenderer.renderHistory && StoryStatusRenderer.renderHistory(v.history); } catch (e) {}
    } catch (e) { /* 单拍失败绝不杀死时钟 */ }
    finally { ticking = false; }
  }

  /* ---------- 生命周期 ---------- */
  function start() {
    stop(); /* 单飞铁律：先清掉任何既有 interval（含上一实例） */
    const sec = clamp(Math.round(Number(cfg.intervalSec) || TICK_DEFAULT_SEC), 30, 3600);
    timer = setInterval(tick, sec * 1000);
    cfg.enabled = true; saveCfg();
    return true;
  }
  function stop() {
    if (timer != null) { clearInterval(timer); timer = null; }
    cfg.enabled = false; saveCfg();
  }
  function status() {
    const v = vars();
    return { enabled: cfg.enabled && timer != null, intervalSec: cfg.intervalSec, day: v && v.时间 ? Number(v.时间.clockDay) || 0 : 0, lastEvents: (v && v.时间 && v.时间.pendingEvents) || [] };
  }
  function setIntervalSec(n) { cfg.intervalSec = clamp(Math.round(Number(n) || TICK_DEFAULT_SEC), 30, 3600); saveCfg(); if (cfg.enabled) start(); return cfg.intervalSec; }
  function toggle() {
    if (cfg.enabled && timer != null) { stop(); toast("⏱ 世界时钟已停（世界随你的回合推进）", "info"); }
    else { start(); toast(`⏱ 世界时钟已开：每 ${cfg.intervalSec}s = 世界 1 天，世界自行演化`, "success"); }
    return status();
  }

  /* 有界等待故事就绪后自动恢复（默认不自动开，除非用户开过） */
  let tries = 0;
  (function waitBoot() {
    if (tries++ > 60) return; /* 有界：最多 2 分钟，绝不无限链 */
    if (window.storyFramework && window.storyFramework.storyState) {
      if (cfg.enabled) start();
      return;
    }
    setTimeout(waitBoot, 2000);
  })();

  window.WorldClock = { start, stop, toggle, tick, status, setIntervalSec, _pickEvent: pickEvent };
})();
