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
  function slotId() { try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch (e) { return "main"; } }
  function lsKey() { return "yunjing.clock." + slotId() + "~" + genre(); }
  /* v4.39.0 世界自转改为「回合驱动」优先（玩家实测反馈）：
     旧版默认墙钟每 intervalSec 自转一次——玩家这一回合还没行动，世界就一直转，
     与叙事体感相悖。现在默认 mode='turn'：只有玩家推进叙事（story:turn-saved）
     世界日才前进；玩家跳时间（本轮跨度 N 日）则一次推进到对应天数。
     墙钟自转保留为可选模式（setMode('wall')），不再默认开启；'off' 为完全冻结。
     兼容：enabled 字段保留推导值（mode==='wall'），供旧调用读取。 */
  function loadCfg() {
    var base = { mode: "turn", enabled: false, intervalSec: TICK_DEFAULT_SEC };
    try {
      var raw = JSON.parse(localStorage.getItem(lsKey()) || "{}");
      /* 迁移旧配置：旧版只有 enabled、无 mode，统一落到 turn（关掉墙钟），
         尊重玩家「玩家不动世界不该转」的明确诉求。 */
      if (!raw.mode) { raw.mode = "turn"; raw.enabled = false; }
      if (raw.mode === "wall" && raw.enabled === false) raw.mode = "turn";
      return Object.assign(base, raw);
    } catch (e) { return base; }
  }
  function saveCfg() {
    try {
      cfg.enabled = (cfg.mode === "wall");
      localStorage.setItem(lsKey(), JSON.stringify(cfg));
    } catch (e) {}
  }

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

  /* ---------- 单次世界日结算（有界、纯规则） ----------
     v4.39.0：days 表示本次推进多少个世界日。普通回合=1；跳时间=本轮解析出的跨度天数。
     无论推进几天，结算只跑一拍（有界铁律不破），但 clockDay 直接落到目标日，
     使「跳三月后」世界日真正前进约 90 天，而非固定 +1。 */
  function tick(quiet, days) {
    if (ticking) return;             /* 单飞：重入直接丢弃本拍 */
    if (document.visibilityState === "hidden") return; /* 后台不积累 */
    const v = vars();
    if (!v) return;
    let step = Math.round(Number(days) || 1);
    if (step < 1) step = 1;
    if (step > 3650) step = 3650;     /* 有界：单次最多推进十年，防异常跨度 */
    ticking = true;
    try {
      v.时间 = v.时间 && typeof v.时间 === "object" ? v.时间 : {};
      const day = (Number(v.时间.clockDay) || 0) + step;
      v.时间.clockDay = day;
      const rnd = mulberry32(hashStr(genre() + ":" + day));
      /* v3.58.0 众生繁衍 + 自由人生日结算（先于事件抽取：新人物可入当日传闻；全部有界幂等） */
      let spawnEvents = [];
      try { if (window.NpcSpawn) spawnEvents = NpcSpawn.daily(v, day, rnd) || []; } catch (e) {}
      try { if (window.LifeMode) LifeMode.daily(v, day, rnd); } catch (e) {}
      /* v3.85.0 确保真实势力实体存在（首轮从世界阶段静态表初始化），供 SimCore 演化（P0-1/P1-3） */
      try { if (window.WorldAlive && WorldAlive.seedFactions) WorldAlive.seedFactions(); } catch (e) {}
      /* v4.10.0 修 F8（P2「张力只降不升」）：
         旧版每 tick `Math.round(tension) - (rnd<0.5?1:0)` 是**单向**且带取整偏差的衰减，
         lifecycle() 又完全不写 tension，导致张力长期单调下滑、矛盾无法自治积累。
         现在改为「向中值 50 的弱回归」：极高张力缓慢出清、极低张力缓慢回暖，
         用 rnd() 做 ±0.5 的无偏抖动（不再是恒 −0.5）。lifecycle() 已接管主要的
         因果双向演化，这里只做温和的均值回归，两者叠加不会把张力锁死在端点。 */
      if (v.tension != null) {
        var tv = clamp(Number(v.tension) || 20, 0, 100);
        var meanPull = (50 - tv) * 0.01;                 /* 向 50 的弱回归：±0.5 内 */
        var jitter = (rnd() - 0.5) * 0.6;               /* 无偏抖动，替代旧的恒递减 */
        v.tension = clamp(Math.round((tv + meanPull + jitter) * 10) / 10, 0, 100);
      }
      /* 关系淡忘：|强度|>20 每日衰减 1（世界推进，非玩家回合）。
         v4.39.0 跳时间按跨度天数折算，但衰减后不得跨过 ±20 的淡忘阈值（有界）。 */
      const rels = v.entities && v.entities.relations;
      if (Array.isArray(rels)) rels.forEach((r) => {
        const s = Number(r.strength) || 0;
        if (Math.abs(s) > 20) {
          const decay = Math.min(step, Math.abs(s) - 20);
          r.strength = s - Math.sign(s) * decay;
        }
      });
      /* 世界事件入史（跨度 >1 时标注「跨 N 日」，跳时间在日志里可查） */
      const ev = pickEvent(v, rnd);
      if (!Array.isArray(v.history)) v.history = [];
      const dayTag = step > 1 ? `第${day}日（跨${step}日）` : `第${day}日`;
      v.history.push(`【世界】${dayTag} · ${ev}`);
      spawnEvents.forEach((e) => v.history.push(`【众生】${dayTag} · ${e}`));
      if (v.history.length > MAX_HISTORY) v.history.splice(0, v.history.length - MAX_HISTORY);
      /* v3.58.0 新实体（人物/势力/地点）自动上图并随发展更新标注 */
      try { var _sa = window.StoryAtlas; var _fn = _sa && (_sa.syncFactions || _sa.syncEntities); if (_fn) _fn(v); } catch (e) {}
      /* v3.85.0 大势推演：调用 SimCore.advance 对真实状态演化（势力影响力消长 / 关系衰减 / 张力），使自转有方向性（P1-3） */
      try { if (window.SimCore && SimCore.advance) SimCore.advance(v, 1, rnd); } catch (e) {}
      /* v3.86.0 涌现式机缘：世界自转时按当前世界状态滚动机缘候选（P0-2，有代价有时限） */
      try { if (window.OpportunitySystem && OpportunitySystem.roll) OpportunitySystem.roll(day); } catch (e) {}
      /* v3.86.0 势力生命周期：弱者愈弱→覆灭、新势力崛起，并写入大势账本（P2-1） */
      try { if (window.WorldAlive && WorldAlive.lifecycle) WorldAlive.lifecycle(); } catch (e) {}
      /* v3.86.0 伙伴意志：羁绊低 + 队伍重创 → 动摇/离队/叛变，写入大势与恩怨账本（P2-4） */
      try {
        if (window.BeastSystem && BeastSystem.driftAll) {
          var _crisis = false;
          try { var _c = (window.WorldBus && WorldBus.counters) || {}; _crisis = (_c.lossStreak || 0) >= 2 || /重创|失守|告急|溃败|覆灭|洗劫|劫/.test(ev); } catch (e2) {}
          BeastSystem.driftAll({ crisis: _crisis, day: day });
        }
      } catch (e) {}
      /* v3.88.0 人物意志（P1）：不依赖 AI 上报——NPC 的情绪/目标/信任/记忆随世界自转自行演化；
         显著变化以「【众生】」入史，从而进入主笔提示词的「近期世界自行发生」（有界：每 tick ≤3 人） */
      try {
        if (window.NpcSpawn && NpcSpawn.driftWills) {
          var _wEv = NpcSpawn.driftWills(v, day, rnd) || [];
          _wEv.forEach(function (t) { v.history.push("【众生】第" + day + "日 · " + t); });
          if (v.history.length > MAX_HISTORY) v.history.splice(0, v.history.length - MAX_HISTORY);
        }
      } catch (e) {}
      /* 待注入事件（供导演/规划在下一轮提示词引用） */
      v.时间.pendingEvents = [ev].concat(Array.isArray(v.时间.pendingEvents) ? v.时间.pendingEvents : []).slice(0, 3);
      v.时间.lastClockAt = Date.now();
      save();
      try { if (window.WorldClock && window.WorldClock._syncPill) window.WorldClock._syncPill(); } catch (e) {}
      if (!quiet) toast(`⏱ 世界第${day}日：${ev}`, "info");
      /* v4.18.0：派发世界事件给即时反馈层，落「世界动态」常驻面板（此前只有一闪而过的 toast）。 */
      try {
        var _we = new (window.CustomEvent || window.Event)("yj:world-tick", {
          detail: { day: day, text: "第" + day + "日：" + ev, ev: ev, major: /灭|覆|陨|大战|突破|降临|剧变/.test(String(ev)) }
        });
        window.dispatchEvent(_we);
      } catch (e) {}
      try { window.StoryStatusRenderer && StoryStatusRenderer.renderHistory && StoryStatusRenderer.renderHistory(v.history); } catch (e) {}
      try { window.MoChibi && MoChibi.react && MoChibi.react("day", { day, ev }); } catch (e) {}
    } catch (e) { /* 单拍失败绝不杀死时钟 */ }
    finally { ticking = false; }
  }

  /* ---------- 生命周期（v4.39.0 回合驱动优先） ----------
     mode: 'turn'（默认，随玩家回合推进）| 'wall'（墙钟自转，玩家主动选）| 'off'（冻结）。
     墙钟 interval 仅在 wall 模式启动；单飞铁律照旧（start 前先 clear）。 */
  function clearTimer() { if (timer != null) { clearInterval(timer); timer = null; } }
  function startWallTimer() {
    clearTimer();
    const sec = clamp(Math.round(Number(cfg.intervalSec) || TICK_DEFAULT_SEC), 30, 3600);
    timer = setInterval(function () { tick(false, 1); }, sec * 1000);
  }
  function setMode(mode) {
    clearTimer();
    cfg.mode = (mode === "wall" || mode === "off") ? mode : "turn";
    if (cfg.mode === "wall") startWallTimer();
    saveCfg();
    try { if (window.WorldClock && window.WorldClock._syncPill) window.WorldClock._syncPill(); } catch (e) {}
    return status();
  }
  function start() { return setMode("wall"); }   /* 兼容旧 API：start 现等同切到墙钟模式 */
  function stop() { return setMode("off"); }     /* 兼容旧 API：stop 现等同冻结 */
  function status() {
    const v = vars();
    return {
      enabled: cfg.mode !== "off",       /* 世界推进是否启用（回合或墙钟） */
      mode: cfg.mode,                    /* turn | wall | off */
      wallRunning: cfg.mode === "wall" && timer != null,
      intervalSec: cfg.intervalSec,
      day: v && v.时间 ? Number(v.时间.clockDay) || 0 : 0,
      lastEvents: (v && v.时间 && v.时间.pendingEvents) || []
    };
  }
  function setIntervalSec(n) { cfg.intervalSec = clamp(Math.round(Number(n) || TICK_DEFAULT_SEC), 30, 3600); saveCfg(); if (cfg.mode === "wall") startWallTimer(); return cfg.intervalSec; }
  function toggle() {
    /* 药丸点击：在「回合驱动」与「冻结」之间切换（墙钟仅由 setMode('wall') 显式启用）。 */
    if (cfg.mode === "off") { setMode("turn"); toast("🌍 世界随时光推进：你的每一回合世界前进一天，跳时间则跨到对应天数", "success"); }
    else { setMode("off"); toast("⏸ 世界已冻结：你不推进剧情，世界就不会动", "info"); }
    return status();
  }

  /* 有界等待故事就绪后同步药丸（默认是回合驱动，不再自动开局墙钟） */
  let tries = 0;
  (function waitBoot() {
    if (tries++ > 60) return; /* 有界：最多 2 分钟，绝不无限链 */
    if (window.storyFramework && window.storyFramework.storyState) {
      if (cfg.mode === "wall") startWallTimer();   /* 仅墙钟模式恢复 interval */
      try { if (window.WorldClock && window.WorldClock._syncPill) window.WorldClock._syncPill(); } catch (e) {}
      return;
    }
    setTimeout(waitBoot, 2000);
  })();

  /* v4.39.0 世界自转改为回合驱动（玩家实测）：
     - 玩家本回合未行动 → 世界日不动（墙钟默认关，wall 模式才自转）；
     - 每轮叙事保存后（story:turn-saved）→ 推进一个世界日；
     - 玩家跳时间 → 读 AttributeEngine 本轮解析出的跨度天数，一次推进到对应日。
     tick 自带 ticking 单飞锁与后台跳过，直接调用安全；仅 off（冻结）模式不挂钩。 */
  try {
    document.addEventListener('story:turn-saved', function () {
      if (cfg.mode === "off") return;              /* 玩家主动冻结则完全静止 */
      let days = 1;
      try {
        const AE = window.AttributeEngine;
        if (AE && AE.currentSpanDays) {
          const sp = AE.currentSpanDays();
          if (sp > 1) days = sp;                    /* 跳时间：跨度 >1 时按跨度推进 */
        }
      } catch (e) {}
      /* 与可能存在的墙钟 tick 错峰：回合驱动延后一小段，避免抢同一拍 */
      setTimeout(function () { try { tick(true, days); } catch (e) {} }, 350);
    });
  } catch (e) {}

  /* v3.85.0 可视开关：世界时钟默认开启后，给玩家一个显眼且随时可暂停/恢复的入口（P0-4）。
     固定悬浮药丸，落在左上角避开水云伙伴（右下）与切换坞（左下）。 */
  function mountToggle() {
    if (document.getElementById("worldClockPill")) return;
    const pill = document.createElement("div");
    pill.id = "worldClockPill";
    pill.title = "世界时钟：随你的回合推进；跳时间则跨到对应天数。点击可冻结/恢复";
    /* 落点下移到顶栏之外：top:10px 会压住顶栏左侧品牌文字（实测「创作」被盖成「]作」）。
       --topbar-h 桌面 54px / 移动端 50px，用变量自适应。 */
    pill.style.cssText = "position:fixed;left:12px;top:calc(var(--topbar-h, 54px) + 6px);z-index:9000;display:none;align-items:center;gap:6px;" +
      "padding:5px 9px;border-radius:18px;cursor:pointer;font-size:12px;color:#e8dcc0;" +
      "background:rgba(20,16,30,.82);border:1px solid color-mix(in srgb, #c9a86a 22%, transparent);" +
      "box-shadow:0 2px 10px rgba(0,0,0,.4);user-select:none;backdrop-filter:blur(6px)";
    const dot = document.createElement("span");
    dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#8fd9a8;box-shadow:0 0 6px #8fd9a8";
    const label = document.createElement("span");
    pill.appendChild(dot); pill.appendChild(label);
    pill.onclick = function () {
      const st = toggle();
      if (!st.enabled) toast("⏱ 世界时钟已暂停（世界随你的回合推进）", "info");
      else toast("⏱ 世界时钟已恢复：每 " + st.intervalSec + "s = 世界 1 日，世界自行演化", "success");
    };
    function update() {
      const st = status();
      pill.style.display = "flex";
      const on = st.mode !== "off";
      dot.style.background = on ? "#8fd9a8" : "#9a8c6e";
      dot.style.boxShadow = on ? "0 0 6px #8fd9a8" : "none";
      const modeTxt = st.mode === "wall" ? "⏱ 自转" : (on ? "🌍 随回合" : "⏸ 冻结");
      label.textContent = modeTxt + " 第" + st.day + "日";
    }
    window.WorldClock && (window.WorldClock._syncPill = update);
    document.body.appendChild(pill);
    update();
    try { const fw = window.storyFramework; if (fw && fw.storyState) { (fw.storyState._clockPillSync = update); } } catch (e) {}
  }
  function tryMount() { try { if (document.body) mountToggle(); else setTimeout(tryMount, 300); } catch (e) {} }

  window.WorldClock = { start, stop, toggle, tick, status, setMode, setIntervalSec, mountToggle, _pickEvent: pickEvent };
  tryMount();
})();
