/* 网游之天下无双 · 世界扩展模块（v4.02.0） */
(function(){
  "use strict";
  var WR = window.WorldRuntime;
  if (!WR || !window.WorldExt || !WR.module) return;
  var mod = WR.module({
    id: "wr_patch_tianxiawushuang", icon: "🎮", name: "版本节点", type: "tracker",
    tip: "《天纵》版本推进：开服 → 主城 → 国战 → 终章",
    contract: "版本节点（当前处在哪个版本）——推进当轮必报",
    stats: { patch: { v: 1, max: 4, label: "版本", icon: "🎮" } },
    backfill: function(o,f){ f.state.patch = Number(o.patch)||1; },
    read: function(st,vars,round){
      var ch = Number(vars && vars.chapter) || Number(round) || 0;
      var want = ch>=24?4:ch>=12?3:ch>=5?2:1;
      if (want > (Number(st.patch)||1)) { st.patch = want; return true; }
      return false;
    },
    hud: function(st){ return [{ i:"🎮", v:"v"+(Number(st.patch)||1), l:"版本", tone:(Number(st.patch)||1)>=3?"warn":"", mod:"wr_patch_tianxiawushuang" }]; },
    html: function(st){
      var names=["公测开服 · 新手村","主城立足 · 行会与领地","国战与神级版本","终章 · 结局前后"];
      var cu=(Number(st.patch)||1);
      var rows=names.map(function(n,i){
        var mark=i<cu-1?"✅":i===cu-1?"🎯":"🔒";
        return '<div class="wr-kv"><span>'+mark+'</span><b>'+n+'</b></div>';
      }).join("");
      return '<div class="wr-status"><div class="wr-stat"><b>🎮 《天纵》当前版本</b><b>'+names[cu-1]+'</b></div></div>'+rows;
    },
    directive: function(st){
      var names=["公测开服 · 新手村","主城立足 · 行会与领地","国战与神级版本","终章 · 结局前后"];
      var cu=(Number(st.patch)||1);
      return "《天纵》处于「"+names[cu-1]+"」版本（"+cu+"/4）——怪物强度、装备品级、可开放地图与是否允许国战须与之匹配，不得提前放出后期内容。";
    }
  });
  try { WorldExt.define("tianxiawushuang", [mod]); } catch(e) { console.warn("[tianxiawushuang-ext]", e.message); }
})();
