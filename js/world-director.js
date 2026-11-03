/* World Director v2.0.0 — GM 导演提示词（P2-2：从「一句话 tip」扩为「冲突焦点 + 本章节拍」的真导演）
 * 数据源与 WorldAlive 同源：world-state vars（势力/恩怨/阶段/张力）+ OpportunitySystem 机缘 + WorldBus 战绩。
 * 每回合依据世界状态挑一个冲突焦点，并给出本章节拍建议（起/承/转/合），而非只加一句泛泛之词。
 */
(function () {
  "use strict";
  function vars() { try { var fw = window.storyFramework; return (fw && fw.storyState && fw.storyState.variables) || null; } catch (e) { return null; } }
  function topFaction() {
    try { var v = vars(); var facs = Object.values((v.entities && v.entities.factions) || {}).filter(function (f) { return f && !f.collapsed; }); facs.sort(function (a, b) { return (Number(b.influence) || 0) - (Number(a.influence) || 0); }); return facs[0] || null; } catch (e) { return null; }
  }
  function activeOpp() {
    try { var l = (window.OpportunitySystem && OpportunitySystem.activeList) ? OpportunitySystem.activeList() : []; return l[0] || null; } catch (e) { return null; }
  }
  function boot() {
    if (!window.WorldExt || typeof WorldExt.takeDirective !== "function") return false;
    if (WorldExt.takeDirective.__directed) return true;
    var orig = WorldExt.takeDirective;
    WorldExt.takeDirective = function () {
      var out = orig.apply(WorldExt, arguments);
      try { var line = compose(); if (line) out = (out ? out + "\n\n" : "") + line; } catch (e) {}
      return out;
    };
    WorldExt.takeDirective.__directed = true;
    console.log("[WorldDirector] GM 导演提示词就位");
    return true;
  }
  function compose() {
    var W = window; if (!W.WorldRuntime) return "";
    var bits = [];
    var stage = W.WorldStage ? W.WorldStage.current() : 1;
    var sd = (W.WorldStage && W.WorldStage.data[W.WorldRuntime.genre]) || null;
    if (sd) bits.push("世界处于「" + sd.st[stage - 1] + "」阶段");
    var arc = (W.WorldExt && WorldExt.modState) ? WorldExt.modState("wr_arc") : null;
    if (arc) { if (arc.state.done) bits.push("主线三幕已达成"); else bits.push("主线第" + (Number(arc.state.stage) || 1) + "幕进行中"); }
    var c = W.WorldBus ? WorldBus.counters : {};
    if ((c.winStreak || 0) >= 2) bits.push("玩家连胜 " + c.winStreak + " 场");
    if ((c.lossStreak || 0) >= 2) bits.push("玩家连败 " + c.lossStreak + " 场");
    var tg = W.WorldBus ? WorldBus.topGrudge() : null;
    var ta = W.WorldBus ? WorldBus.topAlly() : null;
    if (tg && tg.favor <= -25) bits.push("「" + tg.name + "」敌意已深(" + tg.favor + ")");
    if (ta && ta.favor >= 25) bits.push("「" + ta.name + "」与玩家亲厚(" + ta.favor + ")");

    /* 冲突焦点：从世界状态里挑一个最该被本幕呈现的矛盾 */
    var focus = "";
    var tf = topFaction();
    var op = activeOpp();
    if (tg && tg.favor <= -25) focus = "与「" + tg.name + "」的宿怨（敌意 " + tg.favor + "，须在正文正面交锋或暗斗）";
    else if (tf && (Number(tf.influence) || 0) >= 70) focus = "「" + tf.name + "」的强势扩张（影响力 " + tf.influence + "，挤压各方生存空间）";
    else if (op) focus = "机缘「" + op.title + "」的取舍（代价：" + (op.cost || "未知") + "，余 " + Math.max(0, (op.expiryRound || 0) - (W.WorldRuntime.round ? W.WorldRuntime.round() : 0)) + " 回合）";
    else if (ta && ta.favor >= 25) focus = "与「" + ta.name + "」的同盟深化（可托付，但依附亦有代价）";
    else focus = "主线推进与人心向背";

    /* 本章节拍：起 / 承 / 转 / 合 */
    var beat;
    if (stage >= 3) beat = "合（收束伏线、推向终局，给玩家掷地一掷的高光抉择）";
    else if ((c.lossStreak || 0) >= 2) beat = "承（低谷蓄势，先喘息蛰伏，再图翻盘）";
    else if ((c.winStreak || 0) >= 3) beat = "转（盛极生变，荣耀引来觊觎，更大的敌人浮现）";
    else beat = "起（铺陈新局，抛出变数与钩子）";

    var tip;
    if ((c.lossStreak || 0) >= 2) tip = "切勿赶尽杀绝——让玩家休整、蓄力，再图反击。";
    else if ((c.winStreak || 0) >= 3) tip = "锋芒太露必招风——让荣耀引来更深的阴谋。";
    else if (stage >= 3) tip = "提高事件烈度，收束伏线，兑现此前埋下的因果。";
    else if ((c.breakthroughs || 0) > 0 && c._lastBt !== c.breakthroughs) { c._lastBt = c.breakthroughs; tip = "新境界新气象——让突破的余波自然涟漪：他人的侧目、机缘的门缝。"; }
    else tip = "按当前阶段基调稳步推进，留一线变数，勿平铺直叙。";

    if (!bits.length && !focus) return "";
    var head = "【导演提示】" + (bits.length ? bits.join(" · ") + "——" : "");
    return head + "冲突焦点：" + focus + "｜本章节拍建议：" + beat + "。" + tip;
  }
  /* v3.55.29：改为有界等待 */
  if (window.YJWait) YJWait.for(boot, null, { name: "world-director", base: 160, max: 60 });
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.WorldDirector = { compose: compose };
})();
