/* World Bus v1.2.0 — 事件总线/恩怨账本（v3.85.0 持久化+槽隔离+上行接通）
 * 修复（对照活世界整改工作单 P0-3）：
 *   · 此前 bus 为纯内存对象，刷新页面恩怨全清（L1 不满足）；现按「存档槽 + 界」落盘，节流写。
 *   · 阈值通知写入的 bus.facts 此前无人读取（死代码）；现导出 recent()，由 WorldAlive 上行注入主笔，
 *     并在阈值触发时给玩家一条可见系统消息。
 */
(function(){"use strict";

function slotId(){ try { return (window.storyFramework && window.storyFramework.slotId) || "main"; } catch(e){ return "main"; } }
function genreKey(){ try { if (window.WorldExt && WorldExt.genre) return WorldExt.genre; } catch(e){} try { return new URLSearchParams(location.search).get("genre") || "free"; } catch(e){ return "free"; } }
function STORE(){ return "yunjingWorldBus~" + slotId() + "~" + genreKey(); }

var bus={handlers:{},facts:[],history:[],counters:{},grudges:{},grudgeFlags:{}};
var saveTid=0;

function load(){
  try{
    var raw=localStorage.getItem(STORE());
    if(!raw) return;
    var d=JSON.parse(raw);
    if(d&&typeof d==="object"){
      if(d.grudges&&typeof d.grudges==="object") bus.grudges=d.grudges;
      if(d.grudgeFlags&&typeof d.grudgeFlags==="object") bus.grudgeFlags=d.grudgeFlags;
      if(d.counters&&typeof d.counters==="object") bus.counters=d.counters;
      if(Array.isArray(d.history)) bus.history=d.history;
    }
  }catch(e){}
}
function save(){ if(saveTid) return; saveTid=setTimeout(function(){ saveTid=0; try{ localStorage.setItem(STORE(), JSON.stringify({grudges:bus.grudges,grudgeFlags:bus.grudgeFlags,counters:bus.counters,history:bus.history})); }catch(e){} },150); }
load();

function emit(ev){if(!ev||!ev.type)return;ev.ts=Date.now();bus.history.unshift(ev);if(bus.history.length>24)bus.history.length=24;save();try{react(ev)}catch(e){}var l=bus.handlers[ev.type]||[];for(var i=0;i<l.length;i++){try{l[i](ev)}catch(e2){}}var a=bus.handlers["*"]||[];for(var j=0;j<a.length;j++){try{a[j](ev)}catch(e3){}}}
function on(t,f){(bus.handlers[t]=bus.handlers[t]||[]).push(f)}
function fact(t){if(!t)return;bus.facts.push(String(t).slice(0,180));if(bus.facts.length>8)bus.facts.shift()}
function recent(){ return bus.facts.slice(); }
function drainFacts(){return bus.facts.splice(0,bus.facts.length)}
function signal(type,text){ fact(text); try{ if(window.showToast) window.showToast(text, type==="ally"?"success":"warn"); }catch(e){} }
function grudge(n,d){n=String(n||"").trim();if(!n||!d)return;var v=bus.grudges[n]=Math.max(-100,Math.min(100,(bus.grudges[n]||0)+Number(d)));save();if(v<=-25&&!bus.grudgeFlags[n+":hostile"]){bus.grudgeFlags[n+":hostile"]=1;delete bus.grudgeFlags[n+":ally"];signal("hostile","「"+n+"」对你的敌意已经藏不住了——它们的名单上有你。")}else if(v>=25&&!bus.grudgeFlags[n+":ally"]){bus.grudgeFlags[n+":ally"]=1;delete bus.grudgeFlags[n+":hostile"];signal("ally","「"+n+"」已视你为可托付的自己人。")}}
function topGrudge(){var w=null;for(var k in bus.grudges){if(!bus.grudges.hasOwnProperty(k))continue;if(!w||bus.grudges[k]<w.favor)w={name:k,favor:bus.grudges[k]}}return w}
function topAlly(){var b=null;for(var k in bus.grudges){if(!bus.grudges.hasOwnProperty(k))continue;if(!b||bus.grudges[k]>b.favor)b={name:k,favor:bus.grudges[k]}}return b}
var BREAK_RE=/突破|升格|晋升|破关|破境|进化|蜕变|开辟|觉醒成功|凝丹成功|炼成|完工|告捷|瓶颈破开|更进一步|境界松动|晋阶|跃升|迈过|升到|提升到/;
function react(ev){if(ev.type==="combat.win"){bus.counters.lossStreak=0;bus.counters.winStreak=(bus.counters.winStreak||0)+1;var w=bus.counters.wins=(bus.counters.wins||0)+1;if(w===3)fact("三战三胜——你的名号开始在圈子里流传。");else if(w===10)fact("十场不败……如今提起你的名字，没人敢轻易接话。");else if(w>0&&w%10===0)fact("战绩累计 "+w+" 场——仇家名单上，你的位置越来越靠前。")}else if(ev.type==="combat.loss"){bus.counters.winStreak=0;var ls=bus.counters.lossStreak=(bus.counters.lossStreak||0)+1;if(ls===2)fact("连败两场——有人在私下传你的破绽。");else if(ls>=3)fact("再败下去，豺狼都要闻着血味找上门了。")}else if(ev.type==="breakthrough"){bus.counters.breakthroughs=(bus.counters.breakthroughs||0)+1;var cbt=window.WorldExt&&WorldExt.modState?WorldExt.modState("wr_combat"):null;if(cbt){cbt.state.growth=Math.min(60,(Number(cbt.state.growth)||0)+6);fact("境界精进——战斗潜能永久提升（血条上限 +6，当前 +"+(Number(cbt.state.growth)||0)+"）。")}}}
on("resolved",function(ev){if(BREAK_RE.test((ev.label||"")+" "+(ev.result||"")))emit({type:"breakthrough",from:ev.mod})});
on("custom",function(ev){if(BREAK_RE.test(ev.text||""))emit({type:"breakthrough",from:ev.mod})});
window.WorldBus={emit:emit,on:on,fact:fact,drainFacts:drainFacts,recent:recent,grudge:grudge,topGrudge:topGrudge,topAlly:topAlly,history:bus.history,counters:bus.counters,grudges:bus.grudges,save:save,reset:function(){bus.grudges={};bus.grudgeFlags={};bus.counters={};bus.history=[];save();}}})();
