/* World Bus v2.0.0 — 事件总线/恩怨账本（P1-4：与 v.entities.relations 合一，单一真源）
 * 修复（对照活世界整改工作单 P0-3 / P1-4）：
 *   · 此前 bus 为内存对象，恩怨与关系图是两套互不读取的数据（P1-4）。
 *   · 现 WorldBus.grudges 改为 v.entities.relations 中「玩家 ↔ 他者」有向边的视图/缓存：
 *       - grudge() 写入 relations（写穿），threshold 信号照旧；
 *       - 读取时实时从 relations 计算（与关系图共享同一份数据，双向同步）；
 *       - 持久化交给 storyFramework.saveStory（relations 随存档落盘，L1 满足、按槽隔离）。
 *   · 仅换底层存储，保留全部公开 API 签名（grudge / topGrudge / topAlly / emit / on / recent / fact /
 *     drainFacts / signal / history / counters / save / reset），33 界既有调用零改动。
 */
(function(){"use strict";

function slotId(){ try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch(e){ return "main"; } }
function genreKey(){ try { if (window.WorldExt && WorldExt.genre) return WorldExt.genre; } catch(e){} try { return new URLSearchParams(location.search).get("genre") || "free"; } catch(e){ return "free"; } }
function STORE(){ return "yunjingWorldBus~" + slotId() + "~" + genreKey(); }

/* 玩家名：与关系图/众生相同源逻辑 */
function playerName(){
  try{
    var fw=window.storyFramework, st=fw&&fw.storyState;
    var pn=st&&st.setup&&st.setup.playerName;
    if(pn) return String(pn);
    var vars=(st&&st.variables)||{};
    for(var k in (vars.characters||{})){ var c=vars.characters[k]; if(c&&(c.isPlayer||k==="玩家"||k==="主角")) return k; }
  }catch(e){}
  return "主角";
}
/* relations 真源：v.entities.relations（随存档持久化、按槽隔离） */
function relStore(){
  try{
    var fw=window.storyFramework, vars=fw&&fw.storyState&&fw.storyState.variables;
    if(!vars) return null;
    vars.entities=vars.entities||{};
    if(!Array.isArray(vars.entities.relations)) vars.entities.relations=[];
    return vars.entities.relations;
  }catch(e){ return null; }
}
function findRel(me,n){
  var rels=relStore(); if(!rels||!me||!n) return null;
  for(var i=0;i<rels.length;i++){ var r=rels[i]; if(!r)continue; if(r.a===me&&r.b===n) return r; if(r.a===n&&r.b===me) return r; }
  return null;
}
function grudgeKind(v){ return v<=-10?"敌意":v>=10?"亲厚":"中立"; }
/* 实时视图：玩家参与的边 → { 对方名: strength } */
function grudgesView(){
  var me=playerName(), rels=relStore(), out={};
  if(!rels) return out;
  for(var i=0;i<rels.length;i++){ var r=rels[i]; if(!r)continue;
    if(r.a===me) out[r.b]=Math.round(Number(r.strength)||0);
    else if(r.b===me) out[r.a]=Math.round(Number(r.strength)||0);
  }
  return out;
}

var bus={handlers:{},facts:[],history:[],counters:{},grudgeFlags:{}};
var saveTid=0;

function load(){
  try{
    var raw=localStorage.getItem(STORE());
    if(!raw) return;
    var d=JSON.parse(raw);
    if(d&&typeof d==="object"){
      if(d.grudgeFlags&&typeof d.grudgeFlags==="object") bus.grudgeFlags=d.grudgeFlags;
      if(d.counters&&typeof d.counters==="object") bus.counters=d.counters;
      if(Array.isArray(d.history)) bus.history=d.history;
      /* 旧版内存 grudges → 迁移进 relations（只做一次，避免老玩家丢档） */
      if(d.grudges&&typeof d.grudges==="object"){
        var me=playerName(), rels=relStore();
        if(rels){ for(var k in d.grudges){ if(!d.grudges.hasOwnProperty(k))continue; var v=Math.round(Number(d.grudges[k])||0); if(!findRel(me,k)) rels.push({id:"rel_"+me+"_"+k,type:"relation",a:me,b:k,kind:grudgeKind(v),strength:v,at:Date.now()}); } }
      }
    }
  }catch(e){}
}
function save(){ if(saveTid) return; saveTid=setTimeout(function(){ saveTid=0; try{ localStorage.setItem(STORE(), JSON.stringify({grudgeFlags:bus.grudgeFlags,counters:bus.counters,history:bus.history})); }catch(e){} },150); }
load();

function emit(ev){if(!ev||!ev.type)return;ev.ts=Date.now();bus.history.unshift(ev);if(bus.history.length>24)bus.history.length=24;save();try{react(ev)}catch(e){}var l=bus.handlers[ev.type]||[];for(var i=0;i<l.length;i++){try{l[i](ev)}catch(e2){}}var a=bus.handlers["*"]||[];for(var j=0;j<a.length;j++){try{a[j](ev)}catch(e3){}}}
function on(t,f){(bus.handlers[t]=bus.handlers[t]||[]).push(f)}
function fact(t){if(!t)return;bus.facts.push(String(t).slice(0,180));if(bus.facts.length>8)bus.facts.shift()}
function recent(){ return bus.facts.slice(); }
function drainFacts(){return bus.facts.splice(0,bus.facts.length)}
function signal(type,text){ fact(text); try{ if(window.showToast) window.showToast(text, type==="ally"?"success":"warn"); }catch(e){} }
function grudge(n,d){n=String(n||"").trim();if(!n||!d)return;var me=playerName();var rels=relStore();if(!rels)return;var r=findRel(me,n);if(!r){r={id:"rel_"+me+"_"+n,type:"relation",a:me,b:n,kind:"中立",strength:0,at:Date.now()};rels.push(r);}r.strength=Math.max(-100,Math.min(100,(Number(r.strength)||0)+Number(d)));r.kind=grudgeKind(r.strength);r.at=Date.now();r.hist=r.hist||[];r.hist.push({t:Date.now(),v:r.strength,why:(d<0?"敌意加深":"亲厚加深")});if(r.hist.length>12)r.hist.shift();save();if(r.strength<=-25&&!bus.grudgeFlags[n+":hostile"]){bus.grudgeFlags[n+":hostile"]=1;delete bus.grudgeFlags[n+":ally"];signal("hostile","「"+n+"」对你的敌意已经藏不住了——它们的名单上有你。")}else if(r.strength>=25&&!bus.grudgeFlags[n+":ally"]){bus.grudgeFlags[n+":ally"]=1;delete bus.grudgeFlags[n+":hostile"];signal("ally","「"+n+"」已视你为可托付的自己人。")}try{if(window.storyFramework&&storyFramework.saveStory)storyFramework.saveStory();}catch(e){}}
function topGrudge(){var w=null,g=grudgesView();for(var k in g){if(!g.hasOwnProperty(k))continue;if(!w||g[k]<w.favor)w={name:k,favor:g[k]}}return w}
function topAlly(){var b=null,g=grudgesView();for(var k in g){if(!g.hasOwnProperty(k))continue;if(!b||g[k]>b.favor)b={name:k,favor:g[k]}}return b}
var BREAK_RE=/突破|升格|晋升|破关|破境|进化|蜕变|开辟|觉醒成功|凝丹成功|炼成|完工|告捷|瓶颈破开|更进一步|境界松动|晋阶|跃升|迈过|升到|提升到/;
function react(ev){if(ev.type==="combat.win"){bus.counters.lossStreak=0;bus.counters.winStreak=(bus.counters.winStreak||0)+1;var w=bus.counters.wins=(bus.counters.wins||0)+1;if(w===3)fact("三战三胜——你的名号开始在圈子里流传。");else if(w===10)fact("十场不败……如今提起你的名字，没人敢轻易接话。");else if(w>0&&w%10===0)fact("战绩累计 "+w+" 场——仇家名单上，你的位置越来越靠前。")}else if(ev.type==="combat.loss"){bus.counters.winStreak=0;var ls=bus.counters.lossStreak=(bus.counters.lossStreak||0)+1;if(ls===2)fact("连败两场——有人在私下传你的破绽。");else if(ls>=3)fact("再败下去，豺狼都要闻着血味找上门了。")}else if(ev.type==="breakthrough"){bus.counters.breakthroughs=(bus.counters.breakthroughs||0)+1;var cbt=window.WorldExt&&WorldExt.modState?WorldExt.modState("wr_combat"):null;if(cbt){cbt.state.growth=Math.min(60,(Number(cbt.state.growth)||0)+6);fact("境界精进——战斗潜能永久提升（血条上限 +6，当前 +"+(Number(cbt.state.growth)||0)+"）。")}}}
on("resolved",function(ev){if(BREAK_RE.test((ev.label||"")+" "+(ev.result||"")))emit({type:"breakthrough",from:ev.mod})});
on("custom",function(ev){if(BREAK_RE.test(ev.text||""))emit({type:"breakthrough",from:ev.mod})});

var API={
  emit:emit,on:on,fact:fact,drainFacts:drainFacts,recent:recent,grudge:grudge,topGrudge:topGrudge,topAlly:topAlly,
  history:bus.history,counters:bus.counters,save:save,
  reset:function(){ try{ var me=playerName(), rels=relStore(); if(rels){ for(var i=rels.length-1;i>=0;i--){ var r=rels[i]; if(r&&(r.a===me||r.b===me)) rels.splice(i,1); } } }catch(e){} bus.grudgeFlags={};bus.counters={};bus.history=[];save(); }
};
Object.defineProperty(API,"grudges",{ get:function(){ return grudgesView(); }, enumerable:true, configurable:true });
window.WorldBus=API;
})();
