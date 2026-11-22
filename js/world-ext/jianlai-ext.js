/* 剑来 · 界专属扩展 */
(function(){"use strict";var WR=window.WorldRuntime;var WXH=window.WXH;if(!WR||!WXH||!window.WorldExt)return;function esc(s){return WR.H.esc(s)}
var study=WR.module({id:"wr_study",icon:"📖",name:"学问簿",type:"console",tip:"读书明理——圣贤书是一切言出法随的底子",actNames:{recite:"📖 诵读",copy:"✍ 抄书"},stats:{learning:{v:0,max:100,label:"学问",icon:"📖",unit:"%"}},res:{铜钱:30},read:function(){return false},
act:function(st,s,a,p){if(a==="note"){var line=String(p||"").trim().slice(0,40);if(!line)return"写一句心得";st.notes=st.notes||[];st.notes.unshift(line);if(st.notes.length>12)st.notes.length=12;st.learning=Math.min(100,(Number(st.learning)||0)+3);return"✍ 记「"+line+"」——学问+3"}return undefined},
actions:[{id:"recite",label:"诵读圣贤书",icon:"📖",desc:"学问+8",cooldown:1,effect:{stats:{learning:8},fact:"诵读圣贤书，学问见长。"}},{id:"copy",label:"抄书换润笔",icon:"✍",desc:"铜钱+5",cooldown:2,effect:{res:{铜钱:5},fact:"抄书挣润笔。"}},{id:"note",label:"记心得",icon:"🧵",desc:"心得一句",control:"text",placeholder:"写一句读书心得",effect:{}}],
hud:function(st){return[{i:"📖",v:(st.learning||0)+"%",l:"学问",tone:(st.learning||0)>=60?"ok":"",mod:"wr_study"}]},
directive:function(st){var v=st.learning||0;if(v>=60)return"学问已通——言出法随的底蕴到了。";return"学问 "+v+"%——读书明理是慢路也是最正的路。"}});
var fist=WR.module({id:"wr_fist",icon:"🥊",name:"拳桩功课",type:"console",tip:"武道炼体——六步走桩、挨拳桩，一拳一拳打出来的底子",actNames:{walk:"🚶 六步走桩",pile:"🥊 挨拳桩"},stats:{fist:{v:0,max:100,label:"拳法",icon:"🥊"}},res:{},read:function(){return false},
actions:[{id:"walk",label:"六步走桩",icon:"🚶",desc:"拳法+7",cooldown:1,effect:{stats:{fist:7},fact:"走桩练拳。"}},{id:"pile",label:"上挨拳桩",icon:"🥊",desc:"进境快",cooldown:3,risk:{failP:0.4,winText:"筋骨硬了一分",failText:"挨狠了",onWin:{stats:{fist:12},fact:"上桩喂招，拳法大进。"},onFail:{stats:{fist:4},fact:"挨了狠的。"}}},{id:"spar",label:"与人切磋",icon:"🤼",desc:"胜负皆有得",cooldown:4,risk:{failP:0.45,winText:"得胜",failText:"落败赢得尊重",onWin:{stats:{fist:15},fact:"切磋得胜。"},onFail:{fact:"切磋落败，拳理更明。"}}}],
hud:function(st){return[{i:"🥊",v:String(st.fist||0),l:"拳法",tone:(st.fist||0)>=60?"ok":"",mod:"wr_fist"}]},
directive:function(st){var v=st.fist||0;if(v>=60)return"拳法有成——肉身就是最好的兵器。";return"拳法 "+v+"——武道没有捷径只有汗。"}});
WorldExt.define("jianlai",[study,fist]);console.log("[WorldExt] 剑来 界专属扩展就位")})();
