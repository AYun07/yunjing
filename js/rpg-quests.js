/* 云境 v4.07.0 · 网游大世界《寰宇纪元》· 动态委托系统 RpgQuests
 * ---------------------------------------------------------------------------
 * 定位：把「任务」从固定数组改成「由当下世界实况即时生成」。
 *
 * 设计口径（与 v4.06.0 的固定六幕主线并存）：
 *   · 沙盒模式（mode=sandbox）：任务板完全由世界局势生成，无强制主线。
 *     委托只在你「接下之后」才存在，未接的随时会因局势变化而消失。
 *   · 剧情模式（mode=story）：三部曲主线章节照常推进，委托板作为支线并行。
 *   · 委托来源五类，全部确定性生成（同种子恒同结果，禁止 Math.random）：
 *       ① 局势委托  world   —— 当前分区正在发生的事（霜狼侵袭 / 矿脉塌方 / 商道断绝）
 *       ② 探索委托  explore —— 尚未踏足的地界，探索驱动
 *       ③ 悬赏委托  bounty  —— 追缉某个具体敌人
 *       ④ 势力委托  guild   —— 玩家自己创建或加入的势力发布的内务
 *       ⑤ 例行委托  routine —— 行会日常，永远有
 *   · 每个委托都有回合时限（due）。时限到则失效——世界在变，机会在关。
 *
 * 铁律：
 *   - 全部随机走 hash(seed)，同 seed 恒同输出，便于单测与复现。
 *   - 本模块不直接改玩家状态，只产出任务实例与推进结果，由 rpg-core 落账。
 *   - 老存档缺字段时由调用方 backfill，本模块对缺字段一律给默认值，绝不崩。
 */
(function () {
  'use strict';

  /* ---------------- 确定性工具 ---------------- */
  function hash(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function pick(arr, seed) { return arr[hash(seed) % arr.length]; }
  function pickN(arr, seed, n) {
    var out = [], i, pool = arr.slice();
    for (i = 0; i < n && pool.length; i++) {
      var idx = hash(seed + '|' + i) % pool.length;
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- 委托模板库 ----------------
   * 每条模板说明：可出现的分区、适用模式、目标种类、生成规则、奖励规则。
   * t（目标种类）与 rpg-core 的推进钩子一一对应：
   *   kills(在指定地点击杀) / gather(采集) / reach(抵达) / wins(竞技场胜场) / craft(锻造提交)
   */
  var TEMPLATES = [
    {
      id: 'hunt', n: '讨伐委托', t: 'kills', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 3 + Math.floor(lv / 6); },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '讨伐 · ' + ctx.foe + '（' + ctx.place + '）', foe: ctx.foe };
      }
    },
    {
      id: 'gather', n: '采集委托', t: 'gather', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 2 + Math.floor(lv / 8); },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '采集 · ' + ctx.mat + '（' + ctx.place + '）', mat: ctx.mat };
      }
    },
    {
      id: 'scout', n: '侦察委托', t: 'reach', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function () { return 1; },
      place: 'unvisited', make: function (st, w, ctx, s) {
        return { title: '侦察 · ' + ctx.place, note: '踏足即可回报' };
      }
    },
    {
      id: 'escort', n: '护送委托', t: 'reach', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function () { return 1; },
      place: 'city', make: function (st, w, ctx, s) {
        return { title: '护送商队至 ' + ctx.place, note: '商队已在路上，抵达交割' };
      }
    },
    {
      id: 'bounty', n: '悬赏通缉', t: 'kills', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 1 + Math.floor(lv / 12); },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '悬赏 · 缉拿 ' + ctx.foe, foe: ctx.foe, note: '目标凶悍，独自前往需谨慎' };
      }
    },
    {
      id: 'clear', n: '清剿巢穴', t: 'kills', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 4 + Math.floor(lv / 5); },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '清剿 · ' + ctx.place + '巢穴', foe: ctx.foe };
      }
    },
    {
      id: 'arena', n: '竞技场悬赏', t: 'wins', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 1 + Math.floor(lv / 10); },
      place: 'none', make: function (st, w, ctx, s) {
        return { title: '竞技场 · 连胜 ' + (1 + Math.floor(st.lv / 10)) + ' 场', note: '连胜或败场即结' };
      }
    },
    {
      id: 'forge', n: '锻造委托', t: 'craft', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 1 + Math.floor(lv / 15); },
      place: 'city', make: function (st, w, ctx, s) {
        return { title: '锻造 · 委托铸炼 ' + ctx.mat, mat: ctx.mat };
      }
    },
    {
      id: 'rescue', n: '救援委托', t: 'reach', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function () { return 1; },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '救援 · ' + ctx.place + '受困者', note: '生还者正在等援手' };
      }
    },
    {
      id: 'territory', n: '夺回驻地', t: 'reach', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt'],
      need: function () { return 1; },
      place: 'city', make: function (st, w, ctx, s) {
        return { title: '夺回 · ' + ctx.place + '驻地', note: '失守之地，等你收复' };
      }
    },
    {
      id: 'supply', n: '军需运输', t: 'reach', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function () { return 1; },
      place: 'city', make: function (st, w, ctx, s) {
        return { title: '军需 · 送达 ' + ctx.place, note: '前线急件，误期扣声望' };
      }
    },
    {
      id: 'routine', n: '行会例行', t: 'kills', modes: ['story', 'sandbox'], zones: ['dy', 'by', 'zt', 'zy'],
      need: function (lv) { return 2 + Math.floor(lv / 8); },
      place: 'wild', make: function (st, w, ctx, s) {
        return { title: '例行 · 巡猎 ' + ctx.place, foe: ctx.foe, note: '例行差事，报酬稳定' };
      }
    }
  ];

  /* ---------------- 世界局势：任务板的源头 ----------------
   * 局势不是装饰，它直接决定这一轮任务板上会出现什么。
   * 每区最多两条活跃事态，事态随时间轮换（seed 含世界日），因此世界是活的。
   */
  var SITUATIONS = [
    { id: 'beast', n: '兽潮', foe: '霜狼', verb: '正在侵袭', mat: '兽皮' },
    { id: 'mine', n: '矿难', foe: '穴居盗', verb: '劫掠矿脉', mat: '玄铁矿石' },
    { id: 'caravan', n: '商道断绝', foe: '拦路匪', verb: '截断商道', mat: '商队凭证' },
    { id: 'plague', n: '瘟疫', foe: '疫化兽', verb: '污染水源', mat: '净心草' },
    { id: 'revolt', n: '内乱', foe: '叛军斥候', verb: '起兵叛乱', mat: '军令残页' },
    { id: 'rift', n: '裂隙', foe: '虚空游魂', verb: '渗出裂隙', mat: '虚空结晶' },
    { id: 'frost', n: '寒潮', foe: '冰甲兽', verb: '南下寒潮', mat: '霜纹晶' },
    { id: 'curse', n: '诅咒', foe: '怨灵', verb: '缠绕诅咒', mat: '净咒符' }
  ];

  /* 局势对象：{ zone, sit, day, round } —— 由 rpg-core 的 tick 推进 */
  function situationOf(st, world) {
    var s = st.situation;
    if (!s || typeof s !== 'object' || !Array.isArray(s.list)) return { list: [], day: 0, round: 0 };
    return s;
  }

  /* 生成/轮换局势：以「世界日」为种子，同一天内局势稳定，跨日自然轮换 */
  function rollSituation(st, world, day, round) {
    var zones = (world && world.zones) || [];
    if (!zones.length) return { list: [], day: day, round: round };
    var seedBase = (st.genre || 'wangyou') + '|sit|' + day;
    var list = [];
    /* 每个分区都有一条常驻事态：这是「世界在动」的基础，不依赖玩家行为 */
    zones.forEach(function (z, zi) {
      var s = pick(SITUATIONS, seedBase + '|' + z.id);
      list.push({ zone: z.id, sit: s.id, sitN: s.n, foe: s.foe, mat: s.mat, verb: s.verb, day: day });
    });
    /* 中枢额外多一条（合流赛季的跨服事态） */
    return { list: list, day: day, round: round };
  }

  /* ---------------- 地点/委托人/材料 选取 ---------------- */
  function mapsOf(world) { return (world && world.maps) || []; }
  function zoneMaps(world, zone) {
    var ms = mapsOf(world), out = [];
    if (!world || !world.zoneOf) return ms;
    ms.forEach(function (m) { if (world.zoneOf[m] === zone) out.push(m); });
    return out.length ? out : ms;
  }
  function factionsOf(world, zone) {
    var fs = (world && world.factions) || [];
    var out = fs.filter(function (f) { return !zone || !f.zone || f.zone === zone; });
    return out.length ? out : fs;
  }
  function foeNameOf(st, world, seed) {
    var pool = (world && world.monsters) || [];
    if (!pool.length) return '游荡的野兽';
    return pick(pool, seed);
  }
  function matNameOf(st, world, seed) {
    var pool = (world && world.materials) || [];
    if (!pool.length) return '未知素材';
    return pick(pool, seed);
  }

  /* ---------------- 委托生成 ----------------
   * opts: { st, world, ctx }
   * ctx: { visited: {mapName:1}, zone, day, round, mode, events: [] }
   */
  function build(st, world, ctx) {
    ctx = ctx || {};
    var zone = ctx.zone || st.zone || 'dy';
    var mode = ctx.mode || st.mode || 'sandbox';
    var lv = Math.max(1, Math.round(Number(st.lv) || 1));
    var visited = ctx.visited || {};
    var allMaps = mapsOf(world);
    var zMaps = zoneMaps(world, zone);
    var facs = factionsOf(world, zone);
    var sit = situationOf(st, world);
    var sitOfZone = null;
    (sit.list || []).forEach(function (x) { if (x.zone === zone) sitOfZone = x; });

    /* 探索候选：优先玩家没去过的地界（沙盒探索驱动） */
    var unvisited = zMaps.filter(function (m) { return !visited[m]; });
    var visitedMaps = zMaps.filter(function (m) { return visited[m]; });
    var cityMaps = zMaps.filter(function (m) { return /城|都|中枢|广场|关|冢|要塞/.test(m); });
    if (!cityMaps.length) cityMaps = zMaps;

    var seed = (st.genre || 'wangyou') + '|board|' + zone + '|' + lv + '|' + (ctx.day || 0) + '|' + (ctx.round || 0);
    var out = [];
    var usedTpl = {};

    function mk(tpl, src, tag) {
      var s = seed + '|' + tpl.id + '|' + (out.length);
      var placePool, place;
      if (tpl.place === 'unvisited') placePool = unvisited.length ? unvisited : zMaps;
      else if (tpl.place === 'city') placePool = cityMaps;
      else if (tpl.place === 'none') placePool = zMaps;
      else placePool = zMaps;
      place = pick(placePool, s + '|p');

      var fac = facs.length ? pick(facs, s + '|f') : null;
      /* 势力内务委托的委托人是玩家自己的势力；其余委托由本界势力发布 */
      var giver = src === 'guild'
        ? ((st.guild && st.guild.name) || '寰宇冒险者公会')
        : (fac ? fac.n : '寰宇冒险者公会');
      var foe = foeNameOf(st, world, s + '|m');
      var mat = matNameOf(st, world, s + '|t');
      /* 局势驱动：委托目标优先用当前事态的怪物与材料，标题带事态词 */
      if (sitOfZone && (src === 'world' || src === 'routine')) {
        foe = sitOfZone.foe;
        mat = sitOfZone.mat;
      }
      var made = tpl.make(st, world, { foe: foe, mat: mat, place: place }, s) || {};
      var need = Math.max(1, Math.round(tpl.need(lv)));
      /* 等级微调：委托等级围绕玩家等级浮动，但不超过 +3，避免越级劝退 */
      var qlv = clamp(lv + (hash(s + '|lv') % 3) - 1, 1, 99);
      /* 奖励：随委托等级与来源浮动；局势委托与势力委托更丰厚 */
      var mult = src === 'world' ? 1.45 : src === 'guild' ? 1.3 : src === 'bounty' ? 1.2 : 1;
      var gold = Math.round((18 + qlv * 7) * mult);
      var exp = Math.round((22 + qlv * 11) * mult);
      var rep = Math.round((3 + Math.floor(qlv / 4)) * mult);
      var due = 10 + Math.floor(qlv * 0.9) + (src === 'world' ? 4 : 0);
      out.push({
        id: 'q' + hash(s).toString(36) + out.length.toString(36),
        t: tpl.t, tpl: tpl.id, title: made.title || (tpl.n + ' · ' + place),
        note: made.note || '', giver: giver, giverZone: fac ? fac.zone : zone,
        place: place, foe: made.foe || foe, mat: made.mat || mat,
        lv: qlv, need: need, cur: 0, gold: gold, exp: exp, rep: rep,
        due: due, dueMax: due, src: src, state: 'new',
        day: ctx.day || 0, born: ctx.round || 0
      });
      usedTpl[tpl.id] = 1;
    }

    function tplOf(id) { for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i]; return null; }

    /* ① 局势委托：当前分区正在发生的事，永远有且优先 */
    if (sitOfZone) {
      var wt = tplOf(sitOfZone.sit === 'caravan' ? 'supply' : sitOfZone.sit === 'revolt' ? 'clear' : 'hunt');
      if (wt) { wt = Object.assign({}, wt); mk(wt, 'world'); }
    }
    /* ② 势力委托：玩家自己的势力发布的内务（有势力才有） */
    if (st.guild && st.guild.name) {
      var gt = tplOf('supply');
      if (gt) { gt = Object.assign({}, gt); mk(gt, 'guild'); }
    }
    /* ③ 悬赏委托：永远一条 */
    var bt = tplOf('bounty'); if (bt) { bt = Object.assign({}, bt); mk(bt, 'bounty'); }
    /* ④ 探索委托：未踏足之地越多越多 */
    if (unvisited.length) {
      var et = tplOf('scout'); if (et) { et = Object.assign({}, et); mk(et, 'explore'); }
    }
    /* ⑤ 例行委托：补足到 4~6 条 */
    var fillers = ['hunt', 'gather', 'clear', 'arena', 'forge', 'rescue', 'escort', 'territory', 'routine'];
    var fi = 0;
    while (out.length < 4 + (hash(seed + '|n') % 3) && fi < 24) {
      var cand = fillers[(hash(seed + '|f' + fi) + fi) % fillers.length];
      fi++;
      if (usedTpl[cand]) continue;
      var ft = tplOf(cand); if (!ft) continue;
      ft = Object.assign({}, ft); mk(ft, 'routine');
    }
    /* 沙盒模式下主线不生成；剧情模式也不由本模块出主线（主线走 quest-chain） */
    return out;
  }

  /* ---------------- 推进 ----------------
   * progress(q, kind, n, curMap) → 新的 cur 值（可能不变）
   * 规则：在委托指定地点推进效率翻倍（引导玩家真的跑一趟），其余地点只算 1 点。
   */
  function advance(q, kind, n, curMap) {
    if (!q || q.state !== 'active') return q ? q.cur : 0;
    if (q.t !== kind) return q.cur;
    var step = Math.max(0, Number(n) || 0);
    if (!step) return q.cur;
    var atPlace = curMap && q.place && String(curMap) === String(q.place);
    q.cur = Math.min(q.need, q.cur + (atPlace ? step * 2 : step));
    if (q.cur >= q.need) q.state = 'done';
    return q.cur;
  }

  /* 回合推进：时限递减 + 过期 */
  function tick(st) {
    var qs = st.quests;
    if (!qs || !Array.isArray(qs.active)) return 0;
    var chg = 0;
    qs.active.forEach(function (q) {
      if (q.state !== 'active') return;
      q.due = Math.max(0, (Number(q.due) || 0) - 1);
      if (q.due <= 0) { q.state = 'expired'; chg++; }
    });
    qs.active = qs.active.filter(function (q) { return q.state === 'active' || q.state === 'done'; });
    return chg;
  }

  /* 供 rpg-core 直接使用 */
  window.RpgQuests = {
    TEMPLATES: TEMPLATES,
    SITUATIONS: SITUATIONS,
    hash: hash,
    rollSituation: rollSituation,
    situationOf: situationOf,
    build: build,
    advance: advance,
    tick: tick,
    mapOf: function (q) { return q ? q.place : ''; }
  };
})();
