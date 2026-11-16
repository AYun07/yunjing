/* Story Hooks v1.0.0 — 叙事意图识别 */
(function(){"use strict";function tryBoot(fn){if(!window.StoryResponseHandler||!window.WorldRuntime){setTimeout(fn,300);return}fn()}
tryBoot(function boot(){var H=window.StoryResponseHandler;if(H.__storyHooks)return;var origHandle=H.handle;var lastNotice={};
var BATTLE_RE=/(扑|袭|杀|砍|轰|射|劈|刺|砸)(了)?过来|[短贴]身相接|交手|开战|大战一场|动了手|拔剑|开枪|拔刀|出招|迎战|围了上来|恶战|厮杀|搏杀|枪声大作|刀光|剑气|炮火/;
var HURT_RE=/(重伤|负伤|挂彩|鲜血|血流|倒下|昏迷)/;
function turnNo(){try{return window.storyFramework&&window.storyFramework.storyState?(window.storyFramework.storyState.turnCount||0):0}catch(e){return 0}}
function oncePerTurn(key){var t=turnNo();if(lastNotice[key]===t)return false;lastNotice[key]=t;return true}
function notice(text){try{H.renderSystemMessage(text,"info")}catch(e){}}
function scan(body){if(!body||String(body).length<12)return;var text=String(body);var genre=window.WorldRuntime.genre;var reg=window.WorldRuntime.registry();
if(reg.wr_combat&&BATTLE_RE.test(text)&&oncePerTurn("battle")){try{var st=window.WorldExt.modState("wr_combat");if(st&&!st.state.inBattle){st.state.pending=true;window.WorldBus&&window.WorldBus.emit({type:"story.battleIntent"});notice("⚔️ 正文出现战斗——战斗系统已备好遭遇战，打开沉浸面板「"+((window.WRCombat.rosters[genre]||{}).name||"战斗")+"」即可接战结算。")}}catch(e){}}
if(reg.wr_combat&&HURT_RE.test(text)&&oncePerTurn("hurt")){try{var st2=window.WorldExt.modState("wr_combat");if(st2&&(Number(st2.state.hp)||0)<45)notice("🤕 正文有负伤描写——当前气血偏低，记得在战斗系统「休整」回血。")}catch(e){}}
var links=(window.WRForgeLinks||{})[genre]||[];for(var i=0;i<links.length;i++){var objName=links[i].obj;if(objName&&objName.length>=2&&text.indexOf(objName)>=0&&oncePerTurn("obj:"+objName)){var target=reg[links[i].id];if(target)notice("📎 本章涉及「"+objName+"」——沉浸面板「"+target.name+"」可登记与结算。");break}}}
H.handle=function(){var out=origHandle.apply(this,arguments);try{scan(out&&out.body)}catch(e){}return out};H.handle.__orig=origHandle;H.__storyHooks=true;console.log("[StoryHooks] 叙事意图识别就位")})})();
