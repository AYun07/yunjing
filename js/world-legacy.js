/* World Legacy v1.0.0 — 周目继承 */
(function(){"use strict";var BANK_KEY="worldLegacyBank";var GRANT_KEY="worldLegacyGranted";var life=0;
function bank(){if(life<=0)return;try{var cur=parseInt(localStorage.getItem(BANK_KEY),10)||0;localStorage.setItem(BANK_KEY,String(cur+life));console.log("[WorldLegacy] 本世积累 "+life+" 点已存入传承银行（合计 "+(cur+life)+"）")}catch(e){}life=0;try{localStorage.removeItem(GRANT_KEY)}catch(e){}}
function banked(){try{return parseInt(localStorage.getItem(BANK_KEY),10)||0}catch(e){return 0}}
function granted(){try{return localStorage.getItem(GRANT_KEY)==="1"}catch(e){return false}}
function markGranted(){try{localStorage.setItem(GRANT_KEY,"1")}catch(e){}}
function hookBus(){if(!window.WorldBus){setTimeout(hookBus,340);return}WorldBus.on("combat.win",function(){life+=1});WorldBus.on("breakthrough",function(){life+=2});WorldBus.on("stage.up",function(ev){life+=(ev.stage||1)*3})}
hookBus();
function hookReset(){if(!window.WorldExt||typeof WorldExt._reset!=="function"){setTimeout(hookReset,340);return}if(WorldExt._reset.__legacied)return;var orig=WorldExt._reset;WorldExt._reset=function(){bank();return orig.apply(WorldExt,arguments)};WorldExt._reset.__legacied=true}
hookReset();
function grant(){if(granted())return;var total=banked();if(total<20)return;markGranted();var tier=total>=50?2:1;var bonus=tier===2?24:12;try{var c=window.WorldExt.modState("wr_combat");if(c)c.state.growth=Math.min(60,(Number(c.state.growth)||0)+bonus);if(window.WorldBus&&window.WorldStage){var fa=(WorldStage.data[W__genre()]||{}).fa||[];for(var i=0;i<fa.length;i++)WorldBus.grudge(fa[i],tier===2?10:5)}if(window.WorldBus)WorldBus.fact("周目传承：上一世积累 "+total+" 点——本世开局战斗上限 +"+bonus+"，各势力对你另有旧账（亲厚）。");console.log("[WorldLegacy] 传承发放：tier"+tier)}catch(e){}}
function W__genre(){try{return window.WorldRuntime.genre}catch(e){return"free"}}
function hookGrant(){if(!window.WorldExt||typeof WorldExt.onVars!=="function"){setTimeout(hookGrant,340);return}if(WorldExt.onVars.__legacied)return;var orig=WorldExt.onVars;WorldExt.onVars=function(v,r){var out=orig.apply(WorldExt,arguments);try{grant()}catch(e){}return out};WorldExt.onVars.__legacied=true}
hookGrant();
window.WorldLegacy={banked:banked,life:function(){return life},bankNow:bank}})();
