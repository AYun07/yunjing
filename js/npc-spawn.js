/* 云境 · 众生谱 v3.58.0（P6）
 * 让世界自己长出血肉：原创人物/势力/地点自动繁衍 + 全员档案完善。
 *  - 原创人物（origin:"原创"）：确定性名字库 + 志向/性格/外貌模板，与现有实体自动结缘（关系边）
 *  - 原创势力/地点：命名模板生成，落实体库并自动上图（StoryAtlas.syncEntities）
 *  - 势力动态：世界时钟每日结算驱动成员/影响力消长（玩家自创势力 origin:"player" 同样演化）
 *  - enrich()：给所有角色/物品补全档案缺项（只补空缺，绝不覆盖 AI/玩家已写内容）
 *  - 人物意志（v3.88.0 P1）：driftWills() 由世界时钟每日驱动——情绪回归 / 目标推进 / 信任漂移 / 记忆沉淀，
 *    不依赖 AI 上报；每 tick ≤3 人、每人冷却 2 日、显著变化以「【众生】」入史。
 * 有界性：人物 ≤24、原创势力 ≤8、原创地点 ≤10，绝不无限膨胀；全部确定性种子可复算。
 */
(function () {
  "use strict";

  function hashStr(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)] || arr[0];

  /* ---------- 名字库（通用仙侠/武侠风味，适配各题材兜底） ---------- */
  const SURNAMES = ["李", "王", "张", "陈", "林", "苏", "沈", "顾", "秦", "萧", "陆", "叶", "宋", "唐", "韩", "慕", "崔", "白", "程", "赵"];
  const GIVEN = ["青芜", "若尘", "惊鸿", "听雪", "无涯", "拂衣", "望舒", "疏影", "凌霄", "寒山", "孤鸿", "采薇", "星阑", "云深", "暮雨", "长歌", "照野", "归鸿", "辞秋", "扶摇", "青崖", "寒潭", "月澄", "江晚", "临渊", "藏锋", "流苏", "既明", "南絮", "九思"];
  const ROLES = ["散修", "游侠", "药师", "铁匠", "书生", "商队护卫", "茶馆掌柜", "猎户", "说书人", "船夫", "绣娘", "账房先生", "镖师", "采药人", "落魄世家子", "云游道人"];
  const APPEARANCES = ["身形清瘦，目光如炬", "面容普通，唯双目有神", "剑眉星目，气度沉静", "鬓发斑白，步履沉稳", "风尘仆仆，腰间悬一柄旧刀", "眉眼含笑，袖口绣着暗纹", "青衫落拓，指节有厚茧", "身量高大，嗓音洪亮"];
  const PERSONALITIES = ["外冷内热，重诺守义", "圆滑世故，八面玲珑", "执拗认真，认死理", "散漫不羁，心却透亮", "谨慎多疑，凡事先留三分", "豪爽仗义，一诺千金", "沉默寡言，出手果断", "温文尔雅，藏而不露"];
  const AMBITIONS = ["攒够盘缠回一趟故乡", "寻访失传的半卷残谱", "为亡友讨一个公道", "在坊市盘下一间小铺", "练成祖传的那一式刀法", "查清当年灭门一夜的真相", "护住家族仅存的一点香火", "走出这片山，去看看传说中的大城", "找到二十年前失散的妹妹", "赚一笔大的，从此归隐"];
  /* v3.86.0 活世界 P1-2：人物当下目标池——与 ambition（长期志向）区分，是可被剧情/世界状态改写的短期目的 */
  const GOALS = ["求一份安稳的差事糊口", "攒够盘缠回乡探亲", "把欠的债还清", "寻一门手艺傍身", "护住身边的人", "查清一桩旧事", "熬过这个难关", "替恩人寻一味药", "守住祖传的一点基业", "等一个下落不明的亲人消息", "在乱世里保全名节", "替亡友完成未竟之事"];
  const EMOTIONS = ["平静", "警惕", "隐忍", "焦灼", "惶惑", "欣慰", "愤懑", "倦怠", "期盼"];
  const FAC_PREFIX = ["青岚", "黑水", "赤霄", "百兽", "万宝", "天工", "流云", "铁衣", "幽篁", "沧澜", "断岳", "白鹭"];
  const FAC_SUFFIX = ["盟", "宗", "阁", "坊", "会", "帮", "寨", "商行"];
  const PLACE_PREFIX = ["落霞", "孤鹜", "断剑", "残碑", "迷雾", "赤石", "寒泉", "古藤", "青石", "野渡"];
  const PLACE_SUFFIX = ["山", "谷", "坊", "渡", "镇", "泽", "岭", "集"];
  const IDEOLOGIES = ["以利聚义，童叟无欺", "强者为尊，胜者说话", "守一亩三分地，不问世事", "广结善缘，消息灵通", "替天行道，赏善罚恶", "只认钱，不认人", "传承旧统，规矩大过天"];

  const CAPS = { chars: 24, factions: 8, places: 10 };

  function vars() {
    const fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function counters(v) {
    v.众生 = v.众生 && typeof v.众生 === "object" ? v.众生 : {};
    return v.众生;
  }
  function spawnedCount(v, kind) { const c = counters(v); return Number(c[kind]) || 0; }
  function bump(v, kind) { const c = counters(v); c[kind] = spawnedCount(v, kind) + 1; }

  /* ---------- 原创人物 ---------- */
  function _unusedName(rnd, taken) {
    for (let i = 0; i < 40; i++) {
      const n = pick(SURNAMES, rnd) + pick(GIVEN, rnd);
      if (!taken[n]) return n;
    }
    return null;
  }
  function spawnOne(v, rnd) {
    if (!v || typeof v !== "object") return null;
    const ES = window.EntityStore;
    if (!ES) return null;
    if (spawnedCount(v, "chars") >= CAPS.chars) return null;
    if (!v.characters || typeof v.characters !== "object") v.characters = {};
    const name = _unusedName(rnd, v.characters);
    if (!name) return null;
    const places = Object.values((v.entities && v.entities.places) || {});
    const factions = Object.values((v.entities && v.entities.factions) || {});
    const c = {
      name,
      role: pick(ROLES, rnd),
      age: 16 + Math.floor(rnd() * 50),
      appearance: pick(APPEARANCES, rnd),
      personality: pick(PERSONALITIES, rnd),
      ambition: pick(AMBITIONS, rnd),
      emotion: pick(EMOTIONS, rnd),
      goal: pick(GOALS, rnd),
      memory: "",
      location: places.length ? pick(places, rnd).name : (v.人生 && v.人生.location) || "行踪不定",
      faction: factions.length && rnd() < 0.5 ? pick(factions, rnd).name : "",
      trust: 30 + Math.floor(rnd() * 41),
      favor: 25 + Math.floor(rnd() * 41),
      origin: "原创",
      profiled: true
    };
    v.characters[name] = c;
    try { ES.bootstrap(v); } catch (e) {}
    /* 自动结缘：与 1-2 个既有实体连关系边 */
    const kinds = ["陌路", "盟友", "敌对", "同乡", "旧识"];
    const linked = [];
    try {
      const others = Object.keys(v.characters).filter((n) => n !== name);
      if (others.length && rnd() < 0.75) {
        const o = pick(others, rnd);
        ES.link(name, pick(kinds, rnd), o, Math.round(rnd() * 60 - 20), v);
        linked.push(o);
      }
      if (factions.length && rnd() < 0.5) {
        const f = pick(factions, rnd);
        ES.link(name, rnd() < 0.5 ? "从属" : "敌对", f.id || f.name, Math.round(rnd() * 50 + 10), v);
        linked.push(f.name);
      }
    } catch (e) {}
    bump(v, "chars");
    return { name, c, linked };
  }

  /* ---------- 原创势力 / 地点 ---------- */
  function _spawnName(rnd, taken, prefixes, suffixes) {
    for (let i = 0; i < 40; i++) {
      const n = pick(prefixes, rnd) + pick(suffixes, rnd);
      if (!taken[n]) return n;
    }
    return null;
  }
  function spawnFaction(v, rnd) {
    const ES = window.EntityStore;
    if (!ES || !v || spawnedCount(v, "factions") >= CAPS.factions) return null;
    const taken = {};
    Object.values((v.entities && v.entities.factions) || {}).forEach((f) => { taken[f.name] = 1; });
    const name = _spawnName(rnd, taken, FAC_PREFIX, FAC_SUFFIX);
    if (!name) return null;
    const places = Object.values((v.entities && v.entities.places) || {});
    const others = Object.values((v.entities && v.entities.factions) || {});
    const ent = ES.upsert("faction", {
      name,
      ideology: pick(IDEOLOGIES, rnd),
      territory: places.length ? pick(places, rnd).name : "游走四方",
      members: 40 + Math.floor(rnd() * 700),
      influence: 10 + Math.floor(rnd() * 31),
      origin: "原创",
      source: "spawn"
    }, v);
    if (!ent) return null;
    try {
      if (others.length) ES.link(name, rnd() < 0.5 ? "敌对" : "盟友", pick(others, rnd).name, Math.round(rnd() * 60), v);
    } catch (e) {}
    bump(v, "factions");
    return ent;
  }
  function spawnPlace(v, rnd) {
    const ES = window.EntityStore;
    if (!ES || !v || spawnedCount(v, "places") >= CAPS.places) return null;
    const taken = {};
    Object.values((v.entities && v.entities.places) || []).forEach((p) => { taken[p.name] = 1; });
    const name = _spawnName(rnd, taken, PLACE_PREFIX, PLACE_SUFFIX);
    if (!name) return null;
    const regions = Object.values((v.entities && v.entities.places) || {}).map((p) => p.region).filter(Boolean);
    const ent = ES.upsert("place", {
      name,
      region: regions.length ? pick(regions, rnd) : "边荒",
      danger: 10 + Math.floor(rnd() * 70),
      desc: pick(["商旅偶经，时有异闻", "地僻人稀，却藏着旧年的传说", "三教九流汇聚之处", "山高林密，易守难攻", "近年渐渐聚起了人气"], rnd),
      origin: "原创",
      source: "spawn"
    }, v);
    if (!ent) return null;
    bump(v, "places");
    return ent;
  }

  /* ---------- 势力动态演化（世界时钟每日结算调用） ---------- */
  function driftFactions(v, rnd, events) {
    const fs = Object.values((v.entities && v.entities.factions) || {});
    fs.forEach((f) => {
      /* 未填影响力的势力按规模推导基线（否则动态恒 0 没有演化感） */
      if (f.influence === undefined || f.influence === null || isNaN(Number(f.influence)))
        f.influence = clamp(Math.round(Math.log2(1 + (Number(f.members) || 0)) * 6), 5, 60);
      const inf = clamp((Number(f.influence) || 0) + Math.round(rnd() * 4 - 2), 0, 100);
      const oldInf = Number(f.influence) || 0;
      const memDrift = Math.round((rnd() * 2 - 1) * Math.max(2, (Number(f.members) || 0) * 0.02)) + (f.origin === "player" ? 1 : 0);
      f.members = Math.max(0, (Number(f.members) || 0) + memDrift);
      f.influence = inf;
      if (Math.floor(oldInf / 20) !== Math.floor(inf / 20) && rnd() < 0.6)
        events.push(`「${f.name}」声势${inf > oldInf ? "渐涨" : "渐衰"}（影响力 ${inf}/100）`);
    });
  }

  /* ---------- 档案完善：只补空缺，绝不覆盖 ---------- */
  function enrich(v) {
    if (!v || typeof v !== "object") return 0;
    let filled = 0;
    if (v.characters && typeof v.characters === "object") {
      for (const [name, c] of Object.entries(v.characters)) {
        if (!c || typeof c !== "object") continue;
        const rnd = mulberry32(hashStr("profile:" + name));
        if (!c.appearance) { c.appearance = pick(APPEARANCES, rnd); filled++; }
        if (!c.personality) { c.personality = pick(PERSONALITIES, rnd); filled++; }
        if (!c.ambition) { c.ambition = pick(AMBITIONS, rnd); filled++; }
        if (!c.emotion) { c.emotion = "平静"; filled++; }
        if (!c.goal) { c.goal = pick(GOALS, rnd); filled++; }
        if (c.memory === undefined) c.memory = "";
        if (!c.role) { c.role = pick(ROLES, rnd); filled++; }
        if (c.origin === undefined) c.origin = "原著"; filled++;
      }
    }
    if (Array.isArray(v.items)) {
      v.items.forEach((it) => {
        if (!it || it.desc) return;
        const rnd = mulberry32(hashStr("item:" + (it.name || "")));
        it.desc = { "凡品": "寻常手艺，胜在耐用", "灵品": "隐隐有灵光流转", "宝物": "久经岁月，气韵内敛", "仙器": "寒光湛湛，非凡俗之物", "神器": "传说之物，无人得见其全貌", "未知": "来历成谜" }[it.rarity] || "来历各异，姑且记下一笔";
        void rnd; filled++;
      });
    }
    return filled;
  }

  /* ---------- 人物意志漂移 v3.88.0（P1）：不依赖 AI 上报，人物自己也会行动 ---------- */
  /* 世界自转每天驱动一次（world-clock 的 tick 显式调用；daily() 内保留兜底调用，按世界日幂等）。
     四个维度全部只读真实状态、有界、可复算：
       ① 情绪回归：极端态（暴怒/狂喜/绝望…）按概率回到 平静/警惕/隐忍；常态小概率轻微波动
       ② 目标推进：结合 ambition（长期志向）、所在地 location、所属势力 faction、与玩家的恩怨值改写 goal
       ③ 信任漂移：向 v.entities.relations 中「该人物 ↔ 主角」关系强度推导的目标值靠拢（关系恶化 → 信任下降）
       ④ 记忆沉淀：把 v.history 里最新【世界】/【众生】大事按概率写入 memory，硬截断 220 字
     节流：每 tick 最多处理 WILL_PER_TICK=3 人（按世界日轮转，长期公平覆盖每个人），
           每人每 WILL_COOLDOWN=2 日才可能再发生一次显著改写；每 tick 最多回传 WILL_SIGNAL_MAX=3 条信号。 */
  const WILL_PER_TICK = 3, WILL_COOLDOWN = 2, WILL_SIGNAL_MAX = 3, WILL_MEM_MAX = 220;
  const EXTREME_MOODS = ["暴怒", "狂喜", "绝望", "癫狂", "嗜血", "暴戾", "大怒", "大喜", "崩溃", "疯狂", "亢奋", "惊惧", "悲恸"];
  const CALM_MOODS = ["平静", "警惕", "隐忍"];
  /* v4.11.0 性格三轴聚类：让 personality 能在同 PERSONALITIES 池内按因果平滑迁移（不臆造新标签） */
  const PERSO_WARM = ["外冷内热，重诺守义", "豪爽仗义，一诺千金", "温文尔雅，藏而不露", "散漫不羁，心却透亮"];
  const PERSO_COLD = ["谨慎多疑，凡事先留三分", "沉默寡言，出手果断", "执拗认真，认死理"];
  /* v4.11.0 理想因果聚类：ambition 按 bond/势力覆灭/记忆事件，在同 AMBITIONS 池内迁移 */
  const AMBI_AVENGE = ["为亡友讨一个公道", "查清当年灭门一夜的真相"];
  const AMBI_PROTECT = ["护住家族仅存的一点香火", "替亡友完成未竟之事", "在乱世里保全名节"];
  const AMBI_LOYAL = ["护住身边的人", "替恩人寻一味药"];

  function _playerName(v) {
    try {
      const s = window.storyFramework && window.storyFramework.storyState;
      return (s && s.setup && s.setup.playerName) || (v.主角 && String(v.主角)) || "主角";
    } catch (e) { return "主角"; }
  }
  function _setMood(c, m) { c.emotion = m; if (c.mood !== undefined) c.mood = m; }
  function driftWills(v, day, rnd) {
    const events = [];
    if (!v || typeof v !== "object") return events;
    const d = Number(day) || 0;
    if (!v.众生 || typeof v.众生 !== "object") v.众生 = {};
    const ctr = v.众生;
    if (d > 0 && Number(ctr.willDay) === d) return events;  /* 幂等：同一世界日只漂移一次 */
    ctr.willDay = d;
    const chars = (v.characters && typeof v.characters === "object") ? Object.values(v.characters) : [];
    if (!chars.length) return events;
    const rnd2 = rnd || mulberry32(hashStr("will:" + d));
    const rels = (v.entities && Array.isArray(v.entities.relations) && v.entities.relations) || [];
    const factions = (v.entities && v.entities.factions) || {};
    const me = _playerName(v);
    /* 轮转节流：以世界日为步长取连续 N 人，单 tick 有界、长期人人有份 */
    const n = Math.min(WILL_PER_TICK, chars.length);
    const start = chars.length ? (d * (WILL_PER_TICK + 1)) % chars.length : 0;
    for (let i = 0; i < n && events.length < WILL_SIGNAL_MAX; i++) {
      const c = chars[(start + i) % chars.length];
      if (!c || typeof c !== "object" || c.origin === "玩家" || c.isPlayer) continue;
      if (d - (Number(c._willDay) || -999) < WILL_COOLDOWN) continue;  /* 每人每 2 日才显著改写一次 */
      const rel = rels.find((r) => r && ((r.a === c.name && r.b === me) || (r.b === c.name && r.a === me)));
      const bond = rel ? clamp(Math.round(Number(rel.strength) || 0), -100, 100) : null;
      const sig = [];
      let changed = false;

      /* ① 情绪回归 */
      const mood = String(c.emotion || c.mood || "平静");
      if (EXTREME_MOODS.indexOf(mood) >= 0) {
        if (rnd2() < 0.6) {
          const base = (bond != null && bond <= -20) ? "警惕" : pick(CALM_MOODS, rnd2);
          _setMood(c, base);
          sig.push(`「${c.name}」的${mood}渐渐平息，转为${base}。`);
          changed = true;
        }
      } else if (rnd2() < 0.12) {
        const nx = pick(EMOTIONS, rnd2);
        if (nx !== mood) { _setMood(c, nx); changed = true; }
      }
      /* ①b 事件感染：所属势力已覆灭时，近期大事牵动情绪（有界小概率，不覆盖既有极端态回归） */
      if (c.faction && rnd2() < 0.3) {
        const _f = Object.values(factions).find((x) => x && x.name === c.faction);
        if (_f && _f.collapsed && Array.isArray(v.history)) {
          const _recent = v.history.slice(-6).join(" ");
          if (/覆灭|失守|洗劫/.test(_recent) && ["愤懑", "焦灼", "警惕"].indexOf(mood) < 0 && rnd2() < 0.6) {
            _setMood(c, pick(["愤懑", "焦灼"], rnd2));
            sig.push(`「${c.name}」闻旧主基业倾覆，心头翻涌。`); changed = true;
          }
        }
      }

      /* ② 信任漂移：关系恶化 → 目标信任下降 */
      const target = bond != null ? clamp(Math.round(50 + bond / 2), 0, 100) : 50;
      const cur = clamp(Math.round(Number(c.trust != null ? c.trust : 50)), 0, 100);
      if (cur !== target) {
        const step = Math.abs(target - cur) >= 20 ? 2 : 1;
        c.trust = clamp(cur + (target > cur ? step : -step), 0, 100);
        changed = true;
        if (bond != null && bond <= -30 && c.trust <= 35 && !c._wary) { c._wary = 1; sig.push(`「${c.name}」对你心存芥蒂，信任降到 ${c.trust}。`); }
        if (bond != null && bond >= 30 && c.trust >= 65 && !c._close) { c._close = 1; sig.push(`「${c.name}」渐渐信重你，信任升到 ${c.trust}。`); }
      }

      /* ③ 目标推进（因果优先：与玩家恩怨 → 所属势力覆灭 → 所在地 → 长期志向）。
         有强因果的改写一定上报「【众生】」；纯长期志向/所在地的自然推进多数静默，避免刷屏。 */
      const fac = c.faction ? Object.values(factions).find((x) => x && x.name === c.faction) : null;
      let ng = null, sigGoal = false;
      if (bond != null && bond <= -25) {
        if (rnd2() < 0.7) { ng = pick([`向「${me}」讨还旧账`, `躲开「${me}」的眼线`, `联络人手提防「${me}」`], rnd2); sigGoal = true; }
      } else if (fac && fac.collapsed) {
        if (rnd2() < 0.5) { ng = pick(["在乱局里自保", "寻一条新的出路", "替旧主了却未竟之事", "另投一个能容身的势力"], rnd2); sigGoal = true; }
      } else if (bond != null && bond >= 25) {
        if (rnd2() < 0.5) { ng = pick([`替「${me}」办妥一件难事`, `为「${me}」打探一处消息`, `把「${me}」的托付放在心上`], rnd2); sigGoal = true; }
      } else if (rnd2() < 0.4) {
        if (c.location && rnd2() < 0.5) ng = pick([`在${c.location}谋一条出路`, `打点行装离开${c.location}`, `守住${c.location}的一亩三分地`, `打听${c.location}近日的风声`], rnd2);
        else if (c.ambition) ng = pick([`继续${c.ambition}`, `为「${c.ambition}」攒下第一笔本钱`, `打听与「${c.ambition}」有关的消息`], rnd2);
        else ng = pick(GOALS, rnd2);
        sigGoal = rnd2() < 0.3;
      }
      if (ng && ng !== String(c.goal || "")) { c.goal = ng; if (sigGoal) sig.push(`「${c.name}」改了主意：${ng}。`); changed = true; }

      /* ④ 记忆沉淀：最新世界大事写进 memory（硬截断 220）；排除他人意志噪声，只沉淀世界真事 */
      if (Array.isArray(v.history) && v.history.length && rnd2() < 0.4) {
        const recent = v.history.slice(-8).filter((t) => typeof t === "string" &&
          (t.indexOf("【世界】") >= 0 || t.indexOf("【众生】") >= 0) &&
          !/改了主意|渐渐平息|信任(降|升)到/.test(t));
        if (recent.length) {
          const line = String(pick(recent, rnd2)).replace(/【(?:世界|众生)】/, "").trim();
          const cur2 = String(c.memory || "");
          if (line && cur2.indexOf(line.slice(0, 12)) < 0) {
            c.memory = (line + (cur2 ? "；" + cur2 : "")).slice(0, WILL_MEM_MAX);
            changed = true;
          }
        }
      }

      /* ⑤ 性格演化（极慢，受 bond/势力/经历因果牵引；同 PERSONALITIES 池迁移，不臆造） */
      const _persoNow = String(c.personality || "");
      const _persoCluster = (p) => PERSO_WARM.indexOf(p) >= 0 ? "warm" : (PERSO_COLD.indexOf(p) >= 0 ? "cold" : "neutral");
      let _persoTgt = null;
      if (bond != null && bond <= -30) _persoTgt = "cold";
      else if (bond != null && bond >= 30) _persoTgt = "warm";
      else if (fac && fac.collapsed) _persoTgt = "cold";
      if (_persoTgt && _persoCluster(_persoNow) !== _persoTgt && (d - (Number(c._persoDay) || -999) >= 4) && rnd2() < 0.3) {
        const _ppool = _persoTgt === "warm" ? PERSO_WARM : PERSO_COLD;
        const _pt = pick(_ppool, rnd2);
        if (_pt && _pt !== _persoNow) { c.personality = _pt; c._persoDay = d; sig.push(`「${c.name}」历经恩怨，性情渐渐转作${_pt}。`); changed = true; }
      }

      /* ⑥ 理想演化（低频，受 bond/势力覆灭/记忆事件因果牵引；同 AMBITIONS 池迁移） */
      const _ambiNow = String(c.ambition || "");
      let _ambiTgt = null;
      if (bond != null && bond <= -25) _ambiTgt = AMBI_AVENGE;
      else if (fac && fac.collapsed) _ambiTgt = AMBI_PROTECT;
      else if (bond != null && bond >= 25) _ambiTgt = AMBI_LOYAL;
      else if (c.memory && /覆灭|失守|背叛|灭门|洗劫/.test(c.memory) && rnd2() < 0.4) _ambiTgt = AMBI_PROTECT;
      if (_ambiTgt && !_ambiTgt.includes(_ambiNow) && (d - (Number(c._ambiDay) || -999) >= 5) && rnd2() < 0.35) {
        const _at = pick(_ambiTgt, rnd2);
        if (_at && _at !== _ambiNow) { c.ambition = _at; c._ambiDay = d; sig.push(`「${c.name}」的念想变了：如今心里只悬着——${_at}。`); changed = true; }
      }

      if (changed) {
        c._willDay = d;
        /* 镜像到 WorldRuntime.NPC，保持 NPC 面板与主笔人物真源一致 */
        try {
          if (window.WorldRuntime && WorldRuntime.NPC && WorldRuntime.NPC.upsert)
            WorldRuntime.NPC.upsert({ name: c.name, emotion: c.emotion, goals: c.goal, trust: c.trust, memory: c.memory });
        } catch (e) {}
      }
      for (let s = 0; s < sig.length && events.length < WILL_SIGNAL_MAX; s++) events.push(sig[s]);
    }
    return events;
  }

  /* ---------- 世界时钟日结算入口（有界，返回事件文案数组） ---------- */
  function daily(v, day, rnd) {
    const events = [];
    try { driftFactions(v, rnd, events); } catch (e) {}
    try {
      if (rnd() < 0.5) {
        const r = spawnOne(v, rnd);
        if (r) events.push(`「${r.name}」初入众生谱：${r.c.role}，现居${r.c.location}${r.linked.length ? `，与「${r.linked[0]}」有些渊源` : ""}`);
      }
      if (day % 3 === 0 && rnd() < 0.55) {
        const f = spawnFaction(v, rnd);
        if (f) events.push(`新势力「${f.name}」悄然立起（${f.ideology}）`);
      }
      if (day % 2 === 0 && rnd() < 0.45) {
        const p = spawnPlace(v, rnd);
        if (p) events.push(`「${p.name}」出现在行旅的传闻里（${p.region}）`);
      }
      /* 人物意志漂移由 world-clock 的 tick 显式调用 NpcSpawn.driftWills()（v3.88.0 P1），此处不重复 */
      enrich(v);
    } catch (e) {}
    return events;
  }

  /* ---------- 人物志（全员档案一览） ---------- */
  function roster(v) {
    v = v || vars();
    if (!v || !v.characters) return [];
    return Object.values(v.characters).filter((c) => c && c.name).map((c) => ({
      name: c.name, role: c.role || "—", age: c.age || "—", faction: c.faction || "—",
      location: c.location || "—", origin: c.origin || "原著",
      personality: c.personality || "—", ambition: c.ambition || "—"
    }));
  }
  function rosterPanel() {
    const v = vars();
    if (!v) { try { window.showToast && showToast("世界尚未开始", "error"); } catch (e) {} return; }
    enrich(v);
    const list = roster(v);
    const orig = list.filter((r) => r.origin === "原创");
    const canon = list.filter((r) => r.origin !== "原创");
    const card = (r) => `<div style="border:1px solid #1e3a42;border-radius:10px;padding:10px;margin:6px 0;">
      <div style="display:flex;justify-content:space-between;"><b style="color:#9adfd2;">${String(r.name).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]))}</b>
      <span style="font-size:12px;color:#6f9a92;">${r.origin} · ${String(r.age).replace(/</g, "&lt;")}岁 · ${String(r.role).replace(/</g, "&lt;")}</span></div>
      <div style="font-size:12.5px;color:#8fb8b0;margin-top:4px;">${String(r.personality).replace(/</g, "&lt;")} · 志在${String(r.ambition).replace(/</g, "&lt;")}</div>
      <div style="font-size:12px;color:#5f8880;margin-top:2px;">${String(r.location).replace(/</g, "&lt;")}${r.faction !== "—" ? " · " + String(r.faction).replace(/</g, "&lt;") : ""}</div></div>`;
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(4,10,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
    ov.innerHTML = `<div style="width:min(480px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#0d1a20,#0a1418);border:1px solid #2a4a52;border-radius:14px;padding:18px;color:#cfe8e4;font-size:14px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:#9adfd2;">👥 众生谱 · ${list.length} 人（原创 ${orig.length} / 原著 ${canon.length}）</div>
      <div style="font-size:12px;color:#6f9a92;margin-bottom:6px;">世界时钟运转时，原创人物会自行繁衍、势力动态消长；档案缺项已自动补全。</div>
      ${orig.map(card).join("") || `<div style="color:#6f9a92;font-size:13px;padding:6px;">还没有原创人物——开一段世界时钟，或点下方「生一人」。</div>`}
      ${canon.map(card).join("")}
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button data-act="spawn" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">＋ 生一人</button>
        <button data-act="ask" style="flex:1;padding:9px;border:0;border-radius:8px;background:#7a5c1d;color:#fff3dc;font-weight:700;cursor:pointer;">让小云点评众生</button>
        <button data-act="close" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">关闭</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.dataset.act === "close") { ov.remove(); return; }
      if (e.target.dataset.act === "spawn") {
        const r = spawnOne(v, mulberry32((Date.now() ^ 0x5f3759df) >>> 0));
        try { const fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (err) {}
        try { window.showToast && showToast(r ? `「${r.name}」已入众生谱` : "众生谱已满（24 人上限）", r ? "success" : "info"); } catch (err) {}
        ov.remove(); rosterPanel();
      }
      if (e.target.dataset.act === "ask") {
        ov.remove();
        try {
          const brief = list.slice(0, 10).map((r) => `${r.name}（${r.origin}·${r.role}，志在${r.ambition}）`).join("；");
          if (window.MoAssistant && MoAssistant.send) MoAssistant.send(`这是本世界的众生谱节选：${brief}。请以说书人口吻点评这群人物，并指出哪两位之间最可能起故事（不要复述档案）。`);
        } catch (err) {}
      }
    });
  }

  window.NpcSpawn = { spawnOne, spawnFaction, spawnPlace, daily, enrich, roster, rosterPanel, CAPS, driftWills, WILL_PER_TICK, WILL_COOLDOWN, _driftFactions: driftFactions };
})();
