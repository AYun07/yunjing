/* 云境 · 数值比对引擎 CompareEngine v1.0.0（v6.3.7）
 * ===========================================================================
 * 职责：把「境界/战力」与「属性点数」两套规则分开——
 *   · 属性点数 stats（0-100、每轮钳制 ≤6）仍由 attribute-engine 卡死，本引擎不碰；
 *   · 境界/战力走本引擎的「数值比对」：跨境界对敌、极境、玩家破例、玩家自创体系。
 *
 * 设计原则（对应用户 v6.3.7 要求）：
 *   V10 每世界境界带能级标尺，可算数值差；
 *   V11 极境按原著明示处标注，计入倍率，无依据不自拟；
 *   V12 顶级天骄可跨境界对敌——按「能级差 + 天骄系数 + 武魂/血脉/体质 + 极境」
 *       算出可越几阶与代价，输出结构化报告，绝非无条件放行，正文须有缘由；
 *   V13 玩家强指令破例：放行但生成「破例报告」标注偏离原著常规路径之处；
 *   V14 玩家自创境界体系：映射到原著基准能级，生成「对标XX境」对照表。
 *
 * 依赖：window.RealmRules（realm-rules.js）；缺失时全部降级为空报告，绝不抛错阻断游戏。
 * 所有函数纯查询、不改写任何存档状态。
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  function RR() { return (typeof window !== 'undefined') ? window.RealmRules : null; }
  function ruleOf(id) { var r = RR(); return r ? r.getByGenre(id) : null; }
  function tiers(id) { var r = RR(); return r ? r.tiersOf(id) : []; }

  /* ---------- 基础量 ---------- */
  /** 一个 tier 的平均能级间隔（跨世界自适应） */
  function stepOf(id) {
    var ts = tiers(id);
    if (ts.length < 2) return 8;
    return (ts[ts.length - 1].energy - ts[0].energy) / (ts.length - 1);
  }
  /** 取 tier（兼容名称/order/对象） */
  function resolveTier(id, ref) {
    var ts = tiers(id);
    if (!ts.length) return null;
    if (ref && typeof ref === 'object' && ref.energy != null) return ref;
    if (typeof ref === 'number') return ts[Math.max(0, Math.min(ts.length - 1, ref - 1))] || null;
    var r = RR();
    var t = r && r.tierByName ? r.tierByName(id, ref) : null;
    if (t) return t;
    /* 模糊：包含匹配 */
    var s = String(ref || '');
    for (var i = 0; i < ts.length; i++) if (ts[i].name.indexOf(s) >= 0 || s.indexOf(ts[i].name) >= 0) return ts[i];
    return null;
  }

  /* ---------- 加成档位表（等效能级点 = step × 系数） ---------- */
  var TIANJIAO = {
    '凡俗': 0, '普通': 0, '天才': 0.5, '顶尖天才': 1,
    '顶级天骄': 1.5, '绝世妖孽': 2, '万中无一': 2, '无双': 2.5
  };
  var QUALITY = {
    '普通': 0, '凡品': 0, '上乘': 0.3, '稀有': 0.5,
    '罕见': 0.6, '顶级': 0.9, '绝世': 1.2, '神级': 1.5, '传说': 1.8
  };
  var PHYSIQUE = QUALITY; // 体质/血脉复用品质系数
  var COST = [
    { level: 0, name: '无代价', desc: '同境或轻微优势，正面可接' },
    { level: 1, name: '轻伤', desc: '越一档，胜后带伤，正文须交代硬碰的代价' },
    { level: 2, name: '重伤', desc: '越两档，需动用底牌（武魂/血脉/秘法），战后重伤休整' },
    { level: 3, name: '濒死', desc: '越三档，燃烧根基或燃烧血脉方能一战，九死一生' },
    { level: 4, name: '身死道消', desc: '越四档及以上，原著逻辑下属极端越境，除非玩家明示例外，否则判负' }
  ];

  function coefOf(table, key) {
    if (key == null) return 0;
    if (typeof key === 'number') return key; // 直接给系数
    var s = String(key);
    if (table[s] != null) return table[s];
    /* 宽松命中 */
    for (var k in table) if (s.indexOf(k) >= 0 || k.indexOf(s) >= 0) return table[k];
    return 0;
  }

  /* ---------- V10：能级差（纯数值） ---------- */
  function gap(id, from, to) {
    var a = resolveTier(id, from), b = resolveTier(id, to);
    if (!a || !b) return null;
    return {
      id: id,
      from: { name: a.name, order: a.order, energy: a.energy, peak: !!a.peak },
      to: { name: b.name, order: b.order, energy: b.energy, peak: !!b.peak },
      energyDiff: Math.round((b.energy - a.energy) * 10) / 10,
      tierDiff: b.order - a.order,
      step: Math.round(stepOf(id) * 10) / 10
    };
  }

  /* ---------- V11+V12：跨境界对敌比对（核心） ----------
     opts: {
       tianjiao: '顶级天骄',        // 天骄档
       martialSoul: '神级',          // 武魂品质（斗罗）/功法品质
       bloodline: '稀有',            // 血脉品质
       physique: '顶级',             // 体质
       peak: true,                   // 是否处于极境节点（或 from 本身是 peak tier）
       customBonus: 0,               // 玩家特殊设计的额外系数（等效 tier 数）
       narrative: ''                 // 正文给出的越境缘由（用于报告提示）
     }
  */
  function crossRealm(id, from, to, opts) {
    opts = opts || {};
    var d = gap(id, from, to);
    var rule = ruleOf(id);
    if (!d || !rule) return { ok: false, reason: '世界或境界不存在，无法比对', id: id };

    var step = d.step;
    var factors = [];
    var bonusSteps = 0;

    /* 天骄系数 */
    var tj = coefOf(TIANJIAO, opts.tianjiao);
    if (tj) { bonusSteps += tj; factors.push({ k: '天骄·' + (opts.tianjiao || '—'), v: tj }); }

    /* 武魂 / 功法品质 */
    var ms = coefOf(QUALITY, opts.martialSoul);
    if (ms) { bonusSteps += ms; factors.push({ k: '武魂/功法·' + (opts.martialSoul || '—'), v: ms }); }

    /* 血脉 */
    var bl = coefOf(QUALITY, opts.bloodline);
    if (bl) { bonusSteps += bl; factors.push({ k: '血脉·' + (opts.bloodline || '—'), v: bl }); }

    /* 体质 */
    var ph = coefOf(PHYSIQUE, opts.physique);
    if (ph) { bonusSteps += ph; factors.push({ k: '体质·' + (opts.physique || '—'), v: ph }); }

    /* 极境（V11）：from 本身是极境 tier，或显式声明处于极境 */
    var peakOn = false;
    if (d.from.peak || opts.peak === true) {
      peakOn = true;
      var pv = 1; // 极境等效 1 个 tier 的压倒优势
      bonusSteps += pv;
      factors.push({ k: '极境·' + (d.from.peak ? d.from.name : '原著明示极境'), v: pv });
    }

    /* 玩家特殊设计 */
    if (opts.customBonus) {
      var cb = Number(opts.customBonus) || 0;
      bonusSteps += cb;
      factors.push({ k: '玩家特殊设计', v: cb });
    }

    var bonusEnergy = Math.round(bonusSteps * step * 10) / 10;
    var effective = Math.round((d.from.energy + bonusEnergy) * 10) / 10;

    /* 可跨越档数：effective 能压到第几个 tier。
       注意：天骄/极境/神级武魂/血脉/玩家特殊设计这些「例外因素」本就是用来突破基调的，
       所以 crossCap 由加成后的 effective 直接决定，不再用 worldCap 硬压。
       worldCap 只作为「本世界常规天骄参考档」写入报告，供主笔校准，不起拦截作用。 */
    var ts = tiers(id);
    var crossCap = 0;
    for (var i = d.from.order - 1; i < ts.length; i++) {
      if (ts[i].energy <= effective + 0.01) crossCap = (i + 1) - d.from.order;
    }
    var worldCap = rule.crossAllow || 0;
    var capNote = crossCap > worldCap
      ? '（已超越本世界常规天骄基调 ' + worldCap + ' 档，属例外越境，代价照计）' : '';

    var need = d.tierDiff; // 需跨越的档数
    var verdict, cost, allowed;
    if (need <= 0) {
      verdict = '同境或更低，无需越境';
      cost = COST[0]; allowed = true;
    } else if (need <= crossCap) {
      allowed = true;
      cost = COST[Math.min(COST.length - 1, need)];
      verdict = '可越境对敌（越 ' + need + ' 档）';
    } else {
      allowed = false;
      cost = COST[Math.min(COST.length - 1, need)];
      verdict = '越境失败（需越 ' + need + ' 档，能力上限 ' + crossCap + ' 档）';
    }

    var hasNarrative = !!(opts.narrative && String(opts.narrative).trim());
    var requirement = allowed && need > 0
      ? (hasNarrative ? '正文缘由已给，按代价结算' : '⚠ 正文必须交代越境缘由（武魂品质/血脉/秘法/燃烧根基），否则判为口胡')
      : (allowed ? '无需额外缘由' : '若玩家坚持越境，须走【破例报告】并承担身死道消级代价');

    return {
      ok: true, id: id, world: rule.name,
      from: d.from, to: d.to,
      energyDiff: d.energyDiff, tierDiff: need,
      bonusSteps: Math.round(bonusSteps * 100) / 100,
      bonusEnergy: bonusEnergy,
      effectiveEnergy: effective,
      crossCap: crossCap,
      worldCap: worldCap,
      factors: factors,
      peakApplied: peakOn,
      verdict: verdict + capNote,
      allowed: allowed,
      cost: { level: cost.level, name: cost.name, desc: cost.desc },
      requirement: requirement,
      numericNote: rule.numericNote || ''
    };
  }

  /* ---------- V13：玩家破例报告 ---------- */
  /** 玩家强指令要直接达到某境界时：不改数据，只输出「偏离原著路径」的报告 */
  function exceptionReport(id, current, requested, opts) {
    opts = opts || {};
    var d = gap(id, current, requested);
    var rule = ruleOf(id);
    if (!d || !rule) return { ok: false, reason: '世界或境界不存在' };
    var jumps = d.tierDiff;
    var severity = jumps >= 4 ? '重大破例' : jumps >= 2 ? '显著破例' : jumps >= 1 ? '破例' : '微调';
    var skipped = [];
    var ts = tiers(id);
    for (var i = Math.max(0, d.from.order); i < Math.min(ts.length, d.to.order - 1); i++) skipped.push(ts[i].name);
    return {
      ok: true, id: id, world: rule.name, severity: severity,
      from: d.from.name, to: d.to.name,
      jumpTiers: jumps,
      energyJump: d.energyDiff,
      skippedTiers: skipped,
      canonNote: rule.numericNote || '',
      verdict: severity + '：从「' + d.from.name + '」直达「' + d.to.name + '」，跳过 ' +
        (skipped.length ? skipped.join('、') : '无') + '，能级跳变 +' + d.energyDiff +
        '。按玩家意志放行，但正文须写明例外缘由（奇遇/神物/血脉觉醒/系统），并在后续承受境界不稳或根基虚浮的代价。',
      playerWill: true
    };
  }

  /* ---------- V14：玩家自创境界体系映射 ---------- */
  /** customNames: 玩家自定义境界名数组（低→高）；映射到本世界原著能级曲线，生成对标表 */
  function mapCustom(id, customNames) {
    var rule = ruleOf(id);
    if (!rule || !Array.isArray(customNames) || !customNames.length) return { ok: false, reason: '无自创体系或世界不存在' };
    if (rule.realmMode !== 'ladder') return { ok: false, reason: '该世界无原著境界阶梯，无法对标', world: rule.name };
    var ts = tiers(id);
    var n = customNames.length;
    var map = customNames.map(function (name, i) {
      var target = Math.round(((i + 1) / n) * 1000) / 10; // 自创在第 i 位 → 目标能级
      var best = ts[0], bestD = Infinity;
      for (var k = 0; k < ts.length; k++) {
        var dd = Math.abs(ts[k].energy - target);
        if (dd < bestD) { bestD = dd; best = ts[k]; }
      }
      return {
        order: i + 1,
        custom: String(name),
        energy: target,
        canonRef: best.name,
        canonEnergy: best.energy,
        label: '自创·' + String(name) + '（对标原著「' + best.name + '」·能级 ' + target + '）'
      };
    });
    return {
      ok: true, id: id, world: rule.name,
      canonAxis: ts.map(function (t) { return { name: t.name, energy: t.energy }; }),
      map: map,
      note: '对标为线性映射的参考值；若玩家自创体系有特殊设定（如前期极慢后期极快），以玩家设定为准并在此表标注偏差。'
    };
  }

  /* ---------- 契约注入：给 AI 的本世界境界比对规则（精简文本） ---------- */
  function contractLine(id) {
    var rule = ruleOf(id);
    if (!rule) return '';
    if (rule.realmMode !== 'ladder') return '【境界比对】本世界无原著境界阶梯，数值仅按属性钳制规则处理。';
    var peaks = rule.peaks.length ? '｜原著极境/特殊节点：' + rule.peaks.join('、') + '（仅这些可计极境倍率，不得自拟）' : '';
    return '【境界比对·' + rule.name + '】阶梯（低→高）：' + rule.tiers.map(function (t) {
      return t.name + (t.peak ? '★' : '');
    }).join(' → ') + '。' + (rule.numericNote || '') + peaks +
      '。跨境界对敌须按「能级差+天骄系数+武魂/血脉/体质+极境」比对，越境越大代价越重（轻伤→重伤→濒死→身死），正文必须给出越境缘由；' +
      '玩家明示例外可放行但须写明奇遇/神物缘由并承担根基虚浮代价；玩家自创境界按对标表折算能级。';
  }

  /** 供状态栏/时光轴展示的短报告文本 */
  function reportText(rep) {
    if (!rep || !rep.ok) return (rep && rep.reason) || '无法比对';
    if (rep.cost && rep.from && rep.to && typeof rep.from === 'object') {
      return rep.verdict + '｜' + rep.from.name + '→' + rep.to.name +
        ' 能级+' + rep.energyDiff + '，有效战力 ' + rep.effectiveEnergy +
        '，可越 ' + rep.crossCap + ' 档｜代价：' + rep.cost.name + '｜' + rep.requirement;
    }
    if (rep.severity) return rep.verdict;
    if (rep.map) return rep.map.map(function (m) { return m.label; }).join('；');
    return rep.verdict || '';
  }

  window.CompareEngine = {
    VERSION: VERSION,
    gap: gap,
    crossRealm: crossRealm,
    exceptionReport: exceptionReport,
    mapCustom: mapCustom,
    contractLine: contractLine,
    reportText: reportText,
    tierByName: function (id, name) { var r = RR(); return r ? r.tierByName(id, name) : null; },
    isLadder: function (id) { var r = RR(); return r ? r.isLadder(id) : false; }
  };
})();
