/* 寰宇纪元 · 网游大世界 世界扩展模块（v4.06.0）
 *
 * 由三部曲三界的「版本节点」模块合并而来：三界各 4 段版本推进 → 大世界 6 段，
 * 与六幕主线一一对应（开服 → 主城 → 秘境首杀 → 跨服会战 → 隐藏职业觉醒 → 神域终局）。
 *
 * 推进判定优先读「网游角色面板」的主线完成数（真实推进），读不到时退回章节数兜底，
 * 两条路都不会凭空推进版本。
 */
(function(){
  "use strict";
  var WR = window.WorldRuntime;
  if (!WR || !window.WorldExt || !WR.module) return;

  var NAMES = [
    '开服 · 新手谷',
    '主城立足 · 行会与驻地',
    '秘境首杀 · 副本与深渊',
    '跨服会战 · 国战与合流',
    '隐藏职业觉醒 · 传承与认证',
    '神域终局 · 王者权杖'
  ];
  var HINTS = [
    '低等级地图，初阶装备，练级与转正',
    '转职、建帮令、驻地争夺与行会义务',
    '限时副本、世界首领首杀与材料产出',
    '三服合流，寰宇中枢开放，国战与主城攻防',
    '隐藏职业转职与跨服传承，稀有词条与自造装备',
    '战盟争霸、赛季收官与王者权杖归属'
  ];
  /* 各阶段的章节兜底门槛（主线未推进时用章节号判断，避免版本永远停在第一段） */
  var CH_GATE = [0, 8, 16, 26, 36, 48];

  function arcDone() {
    try {
      var wrap = window.WorldExt.modState('wr_rpg');
      var s = wrap && wrap.state ? wrap.state : wrap;
      if (s && Array.isArray(s.questDone)) return s.questDone.length;
    } catch (e) { /* 面板未就绪时按章节兜底 */ }
    return -1;
  }

  var mod = WR.module({
    id: "wr_patch_wangyou", icon: "🎮", name: "赛季版本", type: "tracker",
    tip: "《寰宇纪元》赛季推进：开服 → 主城 → 秘境 → 跨服 → 觉醒 → 终局",
    contract: "赛季版本（当前处在哪个版本节点）——推进当轮必报",
    stats: { patch: { v: 1, max: 6, label: "版本", icon: "🎮" } },
    backfill: function(o,f){ f.state.patch = Math.max(1, Math.min(6, Number(o.patch)||1)); },
    read: function(st,vars,round){
      var ch = Number(vars && vars.chapter) || Number(round) || 0;
      var done = arcDone();
      var want = 1;
      for (var i = 0; i < NAMES.length; i++) {
        var ok = (done >= 0) ? (done >= i) : (ch >= CH_GATE[i]);
        if (ok) want = i + 1; else break;
      }
      if (want > (Number(st.patch)||1)) { st.patch = want; return true; }
      return false;
    },
    hud: function(st){
      var cu = Math.max(1, Math.min(6, Number(st.patch)||1));
      return [{ i:"🎮", v:"v"+cu+"/6", l:"赛季", tone:(cu>=4?"warn":""), mod:"wr_patch_wangyou" }];
    },
    html: function(st){
      var cu = Math.max(1, Math.min(6, Number(st.patch)||1));
      var rows = NAMES.map(function(n,i){
        var mark = i<cu-1 ? "✅" : i===cu-1 ? "🎯" : "🔒";
        return '<div class="wr-kv"><span>'+mark+'</span><b>'+n+'</b></div>';
      }).join("");
      return '<div class="wr-status"><div class="wr-stat"><b>🎮 《寰宇纪元》当前赛季</b><b>'+NAMES[cu-1]+'</b></div></div>'+rows
        + '<div class="wr-status"><div class="wr-stat"><b>📌 本阶段要点</b><b>'+HINTS[cu-1]+'</b></div></div>';
    },
    directive: function(st){
      var cu = Math.max(1, Math.min(6, Number(st.patch)||1));
      return "《寰宇纪元》处于「"+NAMES[cu-1]+"」赛季节点（"+cu+"/6）——怪物强度、装备品级、可开放地图、可用隐藏职业与是否允许跨服国战须与之匹配，不得提前放出后期内容。";
    }
  });
  try { WorldExt.define("wangyou", [mod]); } catch(e) { console.warn("[wangyou-ext]", e.message); }
})();
