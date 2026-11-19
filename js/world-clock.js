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
  let pendingTick = null; /* v4.42.0：演化中若又来回合，记下最大跨度排队，批次末合并补跑，不再丢弃 */

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

  /* ---------- 单拍世界日结算（有界、纯规则、无副作用） ----------
     v4.40.0：抽离自旧 tick——只做一天的规则演化并把事件写入 v.history，
     不 save / 不 toast / 不派发 / 不渲染（这些由调度层在批次末统一做，
     否则「过去三年」逐日 1095 拍会 save/渲染上千次而卡死）。
     返回 { ev, spawnEvents, day } 供汇总。 */
  function advanceOneDay(v, day) {
    const rnd = mulberry32(hashStr(genre() + ":" + day));
    v.时间 = v.时间 && typeof v.时间 === "object" ? v.时间 : {};
    v.时间.clockDay = day;
    /* 众生繁衍 + 自由人生日结算（先于事件抽取：新人物可入当日传闻；有界幂等） */
    let spawnEvents = [];
    try { if (window.NpcSpawn) spawnEvents = NpcSpawn.daily(v, day, rnd) || []; } catch (e) {}
    try { if (window.LifeMode) LifeMode.daily(v, day, rnd); } catch (e) {}
    /* 确保真实势力实体存在，供 SimCore 演化 */
    try { if (window.WorldAlive && WorldAlive.seedFactions) WorldAlive.seedFactions(); } catch (e) {}
    /* 张力向中值 50 的弱回归（无偏抖动）——lifecycle() 接管主要因果演化，这里只做温和回归。
       注：太平生乱软地板放在本拍末尾（lifecycle 之后），避免被覆灭放血覆盖，见下方。 */
    if (v.tension != null) {
      var tv = clamp(Number(v.tension) || 20, 0, 100);
      var meanPull = (50 - tv) * 0.01;
      var jitter = (rnd() - 0.5) * 0.6;
      v.tension = clamp(Math.round((tv + meanPull + jitter) * 10) / 10, 0, 100);
    }
    /* 关系淡忘：|强度|>20 每日衰减 1，不越 ±20 阈值 */
    const rels = v.entities && v.entities.relations;
    if (Array.isArray(rels)) rels.forEach((r) => {
      const s = Number(r.strength) || 0;
      if (Math.abs(s) > 20) r.strength = s - Math.sign(s) * Math.min(1, Math.abs(s) - 20);
    });
    /* 世界事件入史 */
    const ev = pickEvent(v, rnd);
    if (!Array.isArray(v.history)) v.history = [];
    v.history.push(`【世界】第${day}日 · ${ev}`);
    spawnEvents.forEach((e) => v.history.push(`【众生】第${day}日 · ${e}`));
    /* 新实体自动上图 */
    try { var _sa = window.StoryAtlas; var _fn = _sa && (_sa.syncFactions || _sa.syncEntities); if (_fn) _fn(v); } catch (e) {}
    /* 大势推演（steps=1，逐日各演化一拍） */
    try { if (window.SimCore && SimCore.advance) SimCore.advance(v, 1, rnd); } catch (e) {}
    /* 涌现式机缘 */
    try { if (window.OpportunitySystem && OpportunitySystem.roll) OpportunitySystem.roll(day); } catch (e) {}
    /* 势力生命周期（弱者愈弱→覆灭、新势力崛起） */
    try { if (window.WorldAlive && WorldAlive.lifecycle) WorldAlive.lifecycle(); } catch (e) {}
    /* v4.42.0 逐日演化后置护栏（真实长跑实测后补）：
       子系统 lifecycle 是为「每回合一次」设计的，逐日连跑上千拍时有两个放大效应——
       ① 存活<3 时每天可能新生一个势力 → 三年累积几十个已覆灭壳子（实测 88 个）；
       ② 「覆灭=矛盾出清」每天放血 → 张力跌到 12、世界成死水。
       这里在 lifecycle 跑完后统一兜底：裁剪最老的已覆灭势力（全存活的一律保留）、
       张力低于软地板则回填（乱世潜流），均只作用于逐日演化层，不改子系统因果设计。 */
    {
      var facs = v.entities && v.entities.factions;
      if (facs && typeof facs === "object") {
        var allK = Object.keys(facs);
        var MAX_CORPSES = 12;   /* 最多留 12 个已覆灭壳子供追溯，其余裁掉 */
        var deadK = allK.filter(function (k) { return facs[k] && facs[k].collapsed; });
        if (deadK.length > MAX_CORPSES) {
          /* 按 collapsedRound 升序（最老的先删）；无该字段者视为最老 */
          deadK.sort(function (a, b) {
            var ra = Number(facs[a].collapsedRound) || -1, rb = Number(facs[b].collapsedRound) || -1;
            return ra - rb;
          });
          deadK.slice(0, deadK.length - MAX_CORPSES).forEach(function (k) { delete facs[k]; });
        }
      }
      if (v.tension != null) {
        var vt = clamp(Number(v.tension) || 20, 0, 100);
        if (vt < 30) vt += (30 - vt) * 0.35;   /* 乱世潜流：低张力缓慢回填，不锁死上限 */
        v.tension = clamp(Math.round(vt * 10) / 10, 0, 100);
      }
    }
    /* 伙伴意志 */
    try {
      if (window.BeastSystem && BeastSystem.driftAll) {
        var _crisis = false;
        try { var _c = (window.WorldBus && WorldBus.counters) || {}; _crisis = (_c.lossStreak || 0) >= 2 || /重创|失守|告急|溃败|覆灭|洗劫|劫/.test(ev); } catch (e2) {}
        BeastSystem.driftAll({ crisis: _crisis, day: day });
      }
    } catch (e) {}
    /* 人物意志（每拍 ≤3 人，按天幂等） */
    try {
      if (window.NpcSpawn && NpcSpawn.driftWills) {
        var _wEv = NpcSpawn.driftWills(v, day, rnd) || [];
        _wEv.forEach(function (t) { v.history.push("【众生】第" + day + "日 · " + t); });
      }
    } catch (e) {}
    if (v.history.length > MAX_HISTORY) v.history.splice(0, v.history.length - MAX_HISTORY);
    /* 待注入事件（供主笔「近期世界自行发生」） */
    v.时间.pendingEvents = [ev].concat(Array.isArray(v.时间.pendingEvents) ? v.时间.pendingEvents : []).slice(0, 3);
    return { ev: ev, spawnEvents: spawnEvents, day: day };
  }

  /* 短时演化（分钟/小时级，<1日）：不推进世界日，更新「时刻」并滚动轻量动态。
     轻量事件写入 pendingEvents（会注入下一轮主笔），世界日与势力演化完全不动。 */
  const SHICHEN = ["子时","丑时","寅时","卯时","辰时","巳时","午时","未时","申时","酉时","戌时","亥时"];
  function momentDrift(minutes) {
    const v = vars();
    if (!v) return;
    v.时间 = v.时间 && typeof v.时间 === "object" ? v.时间 : {};
    let mins = Math.round(Number(minutes) || 0);
    if (mins < 1) mins = 1;
    if (mins > 1440) mins = 1440;   /* 单次日内的短跨度上限 */
    /* 时刻推进：优先更新 v.time（变量块时辰），其次 SceneState 舞台快照 */
    let shichenTxt = "";
    try {
      const nowIdx = SHICHEN.findIndex((s) => String(v.time || "").indexOf(s) >= 0 || String(v.时间.shichen || "").indexOf(s) >= 0);
      if (nowIdx >= 0 || v.time) {
        const idx = ((nowIdx < 0 ? 0 : nowIdx) + Math.floor(mins / 120)) % 12;
        shichenTxt = SHICHEN[idx];
        if (typeof v.time === "string") v.time = shichenTxt;
        else if (v.time && typeof v.time === "object") v.time.shichen = shichenTxt;
        v.时间.shichen = shichenTxt;
      }
    } catch (e) {}
    /* 轻量短时动态：确定性种子，写 pendingEvents 注入下一轮主笔 */
    const rnd = mulberry32(hashStr(genre() + ":moment:" + mins + ":" + (v.时间.clockDay || 0) + ":" + Date.now()));
    const pool = [
      "檐下风铃轻响，街上行人换了几茬", "远处传来几声犬吠，随后归于平静",
      "茶楼里的说书人换了段新词，引来一阵哄笑", "天光微微偏转，影子挪了一寸",
      "一队商贩匆匆过街，骡铃声渐行渐远", "林间鸟雀惊起又落下，四周重归安宁",
      "巷口的灯换了新的，光晕比先前亮了些", "有熟人擦肩而过，只点了点头便各自走开"
    ];
    const ev = pool[Math.floor(rnd() * pool.length)];
    v.时间.pendingEvents = (shichenTxt ? [`${shichenTxt}时分，${ev}`] : [ev])
      .concat(Array.isArray(v.时间.pendingEvents) ? v.时间.pendingEvents : []).slice(0, 3);
    v.时间.lastClockAt = Date.now();
    save();
    try { if (window.WorldClock && window.WorldClock._syncPill) window.WorldClock._syncPill(); } catch (e) {}
    try {
      var _we = new (window.CustomEvent || window.Event)("yj:world-tick", {
        detail: { moment: true, minutes: mins, text: `${shichenTxt ? shichenTxt + "，" : ""}${ev}`, ev: ev, major: false }
      });
      window.dispatchEvent(_we);
    } catch (e) {}
    return { ev: ev, minutes: mins, shichen: shichenTxt };
  }

  /* ---------- 世界演化调度（v4.40.0 按正文时间规模逐日全量演化） ----------
     tick(quiet, days)：推进 days 个世界日，逐日各跑一拍完整结算（真·逐日全量）。
     长跨度分批 yield（每 BATCH 天让出主线程），避免界面卡死；批次末统一 save/渲染/派发。 */
  const BATCH = 20;   /* 每 20 天让出一次主线程 */
  /* v4.42.0：演化中若又收到回合推进请求，不再 silently 丢弃——记入 pendingTick，
     批次末合并补跑（取最大跨度），避免玩家连点/快速推进时世界少转。 */
  function queueTick(req) {
    if (!pendingTick) { pendingTick = Object.assign({}, req); return; }
    if (req.kind === "day" && pendingTick.kind !== "day") { pendingTick = Object.assign({}, req); return; }
    if (req.kind === "day" && pendingTick.kind === "day") {
      pendingTick.days = Math.max(pendingTick.days || 1, req.days || 1);
    }
    /* moment 请求：已被 day 覆盖时忽略；否则取较大分钟数 */
    if (req.kind === "moment" && pendingTick.kind === "moment") {
      pendingTick.minutes = Math.max(pendingTick.minutes || 0, req.minutes || 0);
    }
  }
  function tick(quiet, days) {
    if (ticking) { queueTick({ kind: "day", days: Math.round(Number(days) || 1), quiet: quiet }); return; }
    if (document.visibilityState === "hidden") return; /* 后台不积累 */
    const v = vars();
    if (!v) return;
    let step = Math.round(Number(days) || 1);
    if (step < 1) step = 1;
    if (step > 3650) step = 3650;     /* 有界：单次最多逐日演化十年 */
    ticking = true;
    v.时间 = v.时间 && typeof v.时间 === "object" ? v.时间 : {};
    const startDay = Number(v.时间.clockDay) || 0;
    const endDay = startDay + step;
    let done = 0, lastEv = "", batchStart = 0;
    const startedAt = Date.now();
    function runBatch() {
      try {
        const vv = vars() || v;
        const upto = Math.min(batchStart + BATCH, step);
        for (let i = batchStart; i < upto; i++) {
          const res = advanceOneDay(vv, startDay + i + 1);
          lastEv = res.ev;
        }
        done = upto;
        batchStart = upto;
      } catch (e) { /* 单拍失败不杀死整批 */ }
      if (done < step) {
        setTimeout(runBatch, 0);      /* 让出主线程，界面保持响应 */
      } else {
        finish(startDay, endDay, step, lastEv, quiet, startedAt);
      }
    }
    try { runBatch(); }
    catch (e) { ticking = false; }
  }

  /* 批次收尾：统一 save / 渲染 / 派发 / toast（只做一次，不随天数线性增长） */
  function finish(startDay, endDay, step, lastEv, quiet, startedAt) {
    try {
      const v = vars();
      save();
      try { if (window.WorldClock && window.WorldClock._syncPill) window.WorldClock._syncPill(); } catch (e) {}
      /* 舆图同步收口：逐拍 syncFactions 跑在 SimCore/lifecycle 之前，最后一拍的势力兴衰
         到批次末才定稿。收尾补一次同步（幂等，无变化不 render），让「演化全程舆图都开着」
         时最后一拍也即时上图，并与主存档里的势力状态保持一致。 */
      try { if (window.StoryAtlas && StoryAtlas.syncFactions && v) StoryAtlas.syncFactions(v); } catch (e) {}
      if (!quiet) toast(`⏱ 世界推进 ${step} 日至第${endDay}日：${lastEv}`, "info");
      /* 长跨度汇总一条入史（势力兴衰 / 众生增减可查） */
      if (step >= 30 && v) {
        let summary = `【世界】第${startDay}→${endDay}日（跨${step}日）间`;
        try {
          const facs = (v.entities && v.entities.factions) || {};
          const alive = Object.values(facs).filter((f) => f && !f.collapsed).length;
          const fallen = Object.values(facs).filter((f) => f && f.collapsed).length;
          const ppl = v.characters && typeof v.characters === "object" ? Object.keys(v.characters).length : 0;
          summary += `： extant势力${alive}、覆灭${fallen}、众生谱${ppl}人`;
        } catch (e) {}
        if (!Array.isArray(v.history)) v.history = [];
        v.history.push(summary);
        if (v.history.length > MAX_HISTORY) v.history.splice(0, v.history.length - MAX_HISTORY);
      }
      try {
        var _we = new (window.CustomEvent || window.Event)("yj:world-tick", {
          detail: { day: endDay, span: step, text: `第${endDay}日：${lastEv}`, ev: lastEv, major: /灭|覆|陨|大战|突破|降临|剧变/.test(String(lastEv)) }
        });
        window.dispatchEvent(_we);
      } catch (e) {}
      try { window.StoryStatusRenderer && StoryStatusRenderer.renderHistory && StoryStatusRenderer.renderHistory(v && v.history); } catch (e) {}
      try { window.MoChibi && MoChibi.react && MoChibi.react("day", { day: endDay, ev: lastEv }); } catch (e) {}
    } finally {
      ticking = false;
      /* v4.42.0：批次末排空排队请求（合并后的最大跨度），让连续推进不丢回合 */
      if (pendingTick) {
        const p = pendingTick; pendingTick = null;
        setTimeout(function () {
          try {
            if (p.kind === "moment") evolveByQuantum({ minutes: p.minutes, level: "moment" });
            else tick(p.quiet !== false, p.days);
          } catch (e) {}
        }, 16);
      }
    }
  }

  /* 量子演化入口：根据 AttributeEngine 解析出的正文时间量选择演化路径 */
  function evolveByQuantum(q) {
    if (!q || !(q.minutes > 0)) { tick(true, 1); return; }   /* 无跨度：普通回合 +1 日 */
    if (q.level === "moment") {
      if (ticking) { queueTick({ kind: "moment", minutes: q.minutes }); return; } /* 演化中：排队补跑短时动态 */
      momentDrift(q.minutes); return;
    }  /* 分钟/小时：不动世界日 */
    tick(true, Math.max(1, Math.round(q.days)));           /* 天/月/年：逐日全量演化 */
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

  /* v4.40.0 世界按正文时间规模演化（回合驱动）：
     - 玩家本回合未行动 → 世界日不动（墙钟默认关，wall 模式才自转）；
     - 每轮叙事保存后（story:turn-saved）读 AttributeEngine 本轮时间量：
       · 分钟/小时级（<1日）→ momentDrift：更新时刻 + 轻量动态，不动世界日；
       · 天/月/年级 → tick 逐日全量演化对应天数（几天跑几拍，几年跑几百上千拍）；
       · 无跨度 → 普通回合 +1 日。
     tick 自带 ticking 单飞锁与后台跳过，直接调用安全；仅 off（冻结）模式不挂钩。 */
  try {
    document.addEventListener('story:turn-saved', function () {
      if (cfg.mode === "off") return;              /* 玩家主动冻结则完全静止 */
      let q = null;
      try {
        const AE = window.AttributeEngine;
        if (AE && AE.currentSpanQ) q = AE.currentSpanQ();
      } catch (e) {}
      /* 与可能存在的墙钟 tick 错峰：回合驱动延后一小段，避免抢同一拍 */
      setTimeout(function () {
        try {
          if (q && q.minutes > 0) evolveByQuantum(q);
          else tick(true, 1);
        } catch (e) {}
      }, 350);
    });
  } catch (e) {}

  /* v3.85.0 可视开关：世界时钟默认开启后，给玩家一个显眼且随时可暂停/恢复的入口（P0-4）。
     固定悬浮药丸，落在左上角避开水云伙伴（右下）与切换坞（左下）。 */
  function mountToggle() {
    if (document.getElementById("worldClockPill")) return;
    const pill = document.createElement("div");
    pill.id = "worldClockPill";
    pill.title = "世界时钟：随正文时间演化——过去几天逐日演化几天，过去几年演化几年；短时辰只更新时刻。点击可冻结/恢复";
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

  window.WorldClock = { start, stop, toggle, tick, status, setMode, setIntervalSec, mountToggle, evolveByQuantum, momentDrift, _pickEvent: pickEvent };
  tryMount();
})();
