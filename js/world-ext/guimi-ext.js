/* 诡秘之主 · 界专属扩展 */
(function(){"use strict";var WR=window.WorldRuntime;var WXH=window.WXH;if(!WR||!WXH||!window.WorldExt)return;function esc(s){return WR.H.esc(s)}
var occult=WR.module({id:"wr_occult",icon:"🔮",name:"灰雾占卜",type:"console",tip:"占卜、灵视与仪式——灵性是本钱，失控是代价",actNames:{divine:"🔮 灵性占卜",sight:"👁 灵视巡查"},stats:{insight:{v:0,max:100,label:"占卜造诣",icon:"🔮"}},res:{金镑:15},read:function(){return false},
act:function(st,s,a,p){if(a==="record"){var line=String(p||"").trim().slice(0,40);if(!line)return"写一条占卜结论";st.records=st.records||[];st.records.unshift(line);if(st.records.length>12)st.records.length=12;return"🔮 存档：「"+line+"」"}return undefined},
actions:[{id:"divine",label:"灵性占卜",icon:"🔮",desc:"占一个问题",cooldown:2,control:"text",placeholder:"占卜的问题",effect:{stats:{insight:8},fact:"进行灵性占卜。"}},{id:"sight",label:"灵视巡查",icon:"👁",desc:"查看痕迹",cooldown:3,effect:{stats:{insight:6},fact:"灵视巡查。"}},{id:"record",label:"存档结论",icon:"🧵",desc:"结论",control:"text",placeholder:"结论",effect:{}}],
hud:function(st){return[{i:"🔮",v:String(st.insight||0),l:"占卜造诣",tone:(st.insight||0)>=60?"ok":"",mod:"wr_occult"}]},
directive:function(st){var v=st.insight||0;if(v>=60)return"占卜造诣已深——被「注视」的风险加重。";return"占卜造诣 "+v+"——初学者的启示是模糊的。"}});
var casenotes=WR.module({id:"wr_case",icon:"🗂",name:"值夜者手记",type:"tracker",tip:"非凡案件的档案与调查",actNames:{file:"🗂 记录案件",walk:"👣 走访调查"},stats:{solved:{v:0,max:100,label:"案件进度",icon:"🗂",unit:"%"}},res:{},read:function(){return false},
act:function(st,s,a,p){if(a==="file"){var line=String(p||"").trim().slice(0,40);if(!line)return"格式：案件名";st.files=st.files||[];if(st.files.some(function(u){return u===line}))return"已在手记";st.files.unshift(line);if(st.files.length>12)st.files.length=12;return"🗂 已记录「"+line+"」"}return undefined},
actions:[{id:"file",label:"记录案件",icon:"🗂",desc:"案件名",control:"text",placeholder:"失踪的更夫",effect:{}},{id:"walk",label:"走访调查",icon:"👣",desc:"进度+12",cooldown:2,risk:{failP:0.4,winText:"关键证词",failText:"打草惊蛇",onWin:{stats:{solved:12},fact:"调查进展。"},onFail:{fact:"打草惊蛇。"}}}],
hud:function(st){return[{i:"🗂",v:(st.solved||0)+"%",l:"案件",tone:(st.solved||0)>=60?"ok":"",mod:"wr_case"}]},
directive:function(st){var v=st.solved||0;if(v>=60)return"案件接近真相——代价也该上桌了。";return"案件进度 "+v+"%。"}});
WorldExt.define("guimi",[occult,casenotes]);console.log("[WorldExt] 诡秘之主 界专属扩展就位")})();
