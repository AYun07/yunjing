/* Quest Chain v1.0.0 — 31界三幕主线 */
(function(){"use strict";var WR=window.WorldRuntime;if(!WR||!window.WorldExt)return;function st(id){try{var m=window.WorldExt.modState(id);return m?m.state:null}catch(e){return null}}
var P={win:function(n){return function(){var c=st("wr_combat");return c&&(Number(c.wins)||0)>=n}},gte:function(id,k,v){return function(){var s=st(id);return s&&(Number(s[k])||0)>=v}},lte:function(id,k,v){return function(){var s=st(id);return s&&(Number(s[k])||0)<=v}},ne:function(id,k,v){return function(){var s=st(id);return s&&s[k]!==v}},list:function(id,k,n){return function(){var s=st(id);return s&&((s[k]||[]).length)>=n}}};
function chk(p){try{return p()}catch(e){return false}}
var A={
mystery:{title:"迷雾之下",st:[["现场初勘","钉上第一件证物",P.list("wr_evidence","cards",1)],["推理成形","完成度到30%",P.gte("wr_deduce","progress",30)],["真相大白","对峙两胜",P.win(2)]]},
scifi:{title:"星海远征",st:[["武装舰船","改装度12%",P.gte("wr_retrofit","refit",12)],["绘制星图","探索一处",P.gte("wr_starmap","explored",12)],["舰队王牌","三胜",P.win(3)]]},
wuxia:{title:"侠路初行",st:[["踏出山门","探访一处",P.gte("wr_jhmap","visited",1)],["立足门派","贡献10",P.gte("wr_sect","contrib",10)],["扬名立万","三胜",P.win(3)]]},
cthulhu:{title:"深渊回响",st:[["初窥禁忌","知识5",P.gte("wr_mythos","lore",5)],["抽丝剥茧","调查15%",P.gte("wr_invest","progress",15)],["活着回来","两胜",P.win(2)]]},
free:{title:"笔下的世界",st:[["定义属性","立一项",P.list("wr_attr2","attrs",1)],["世界有规则","浓度变了",P.ne("wr_rules","magic",50)],["冲突落幕","三胜",P.win(3)]]},
swallowedstar:{title:"武者之路",st:[["踏入荒野","探索8%",P.gte("wr_wildmap","wild",8)],["武馆立足","贡献6",P.gte("wr_dojo","dkarma",6)],["猎杀成名","三胜",P.win(3)]]},
shrouding:{title:"苦海渡身",st:[["淬体见异","觉醒10%",P.gte("wr_physique","awaken",10)],["经文入耳","参悟10%",P.gte("wr_sutra","comprehend",10)],["斗战证道","三胜",P.win(3)]]},
quanzhigaoshou:{title:"重返巅峰",st:[["阵容成形","签一人",P.list("wr_team","roster",1)],["苦练手活","技能点4",P.gte("wr_skltree","sp",4)],["联赛扬威","三胜",P.win(3)]]},
doupocangqiong:{title:"三年之约",st:[["丹炉重燃","炉温异动",P.ne("wr_alchemy","temp",400)],["斗气积蓄","积累50%",P.gte("wr_realm","breaching",50)],["崭露头角","三胜",P.win(3)]]},
wanmeishijie:{title:"石村少年",st:[["目击遗种","录一头",P.gte("wr_relic","tracked",1)],["宝具初鸣","温养灵性20",P.gte("wr_relicgear","spirit2",20)],["狩猎英豪","三胜",P.win(3)]]},
douluodalu:{title:"魂师启蒙",st:[["魂技上手","演练8%",P.gte("wr_soultech","prof5",8)],["宗门当差","贡献10",P.gte("wr_zongmen","gongxian",10)],["猎魂成名","三胜",P.win(3)]]},
daoguiyixian:{title:"疯与醒之间",st:[["两界有差","记一处差异",P.list("wr_mirror","diffs",1)],["心素动摇","清醒度偏离",P.ne("wr_xinsu","clear",70)],["了断诡异","两胜",P.win(2)]]},
zhongshengdushi:{title:"重生第一桶金",st:[["马甲上身","立一层",P.list("wr_vest","vests",1)],["公司起步","估值8",P.gte("wr_company","valuation",8)],["暗斗立威","三胜",P.win(3)]]},
dibao:{title:"万古一粟",st:[["结识群星","记一人",P.gte("wr_figures","known",1)],["淬体开脉","觉醒10%",P.gte("wr_dbbody","dbAwaken",10)],["争渡立身","三胜",P.win(3)]]},
ditandali:{title:"摆摊还债",st:[["留住回头客","攀交情",P.gte("wr_cust","repeat",6)],["摊位有名","客流见涨",P.gte("wr_booth","customers",1)],["赶走捣乱的","两胜",P.win(2)]]},
longzu:{title:"血统觉醒",st:[["龙类在侧","录一头",P.gte("wr_drake","drakes",1)],["权限提升","窃档升权",P.gte("wr_archives","clearance",2)],["龙裔交锋","三胜",P.win(3)]]},
quanzhifashi:{title:"双系天才",st:[["铭刻星辰","铭一个星座",P.list("wr_skymap2","constels",1)],["元素亲和","掌控45%",P.gte("wr_majors","control3",45)],["猎魔成名","三胜",P.win(3)]]},
limingzhijian:{title:"魔导革命之火",st:[["技术破冰","解锁一项",P.gte("wr_tech2","unlocked",1)],["兵强马壮","战备45%",P.gte("wr_army","readiness",45)],["守土安民","三胜",P.win(3)]]},
lunhuileyuan:{title:"轮回契约",st:[["装备成型","登记一件",P.list("wr_gear2","gears",1)],["探索世界","10%",P.gte("wr_explore2","exploreRate",10)],["任务必达","三胜",P.win(3)]]},
wulianfengdian:{title:"武道登阶",st:[["功法入囊","录一部",P.list("wr_gfbag","gfbag",1)],["炉火纯青","成器45%",P.gte("wr_forge2","forgeRate",45)],["武技服人","三胜",P.win(3)]]},
shengxu:{title:"灵气复苏",st:[["血脉有兆","记异象",P.list("wr_blood2","bloodOmens",1)],["药性入体","适应15%",P.gte("wr_fruit","adapt",15)],["禁区生还","两胜",P.win(2)]]},
shenmifusu:{title:"驭鬼之路",st:[["摸到规律","破解15%",P.gte("wr_ghost","solve2",15)],["黄金入柜","库存异动",P.ne("wr_gold","goldStore",10)],["灵异对峙","两胜",P.win(2)]]},
earth:{title:"普通人的战斗",st:[["认得这座城","记一处",P.list("wr_citymap","spots",1)],["看清新闻","记一条",P.list("wr_news","feeds",1)],["守住底线","两胜",P.win(2)]]},
freeworld:{title:"创世亲笔",st:[["立宪","颁一条",P.list("wr_const","clauses",1)],["世界有脉搏","两根量表",P.list("wr_gauge3","gauges",2)],["规则之战","两胜",P.win(2)]]},
quanqiubingfeng:{title:"撑过这个冬天",st:[["加固堡垒","维修防线",P.gte("haven","defense",8)],["寒潮深入","气温-20℃",P.lte("frost","_temp",-20)],["守卫安全屋","两胜",P.win(2)]]},
chaoshenxueyuan:{title:"超级基因",st:[["基因激化","25%",P.gte("wr_gene","gene",25)],["阵前立功","军功15",P.gte("wr_merit","merit",15)],["诸神战场","三胜",P.win(3)]]},
zhanhen:{title:"大夏境内",st:[["病院羁绊","结一份",P.list("wr_hospital","bonds",1)],["禁墟熟练","25",P.gte("wr_xu","prof4",25)],["执刀之人","两胜",P.win(2)]]},
fanrenxiuxian:{title:"凡人问仙",st:[["瓶中聚灵","绿液3滴",function(){var m=window.WorldExt.modState("wr_bottle");return m&&(Number(m.resources.绿液)||0)>=3}],["洞府安身","灵气36%",P.gte("wr_cave","qi2",36)],["斗法护道","两胜",P.win(2)]]},
xianni:{title:"逆之开局",st:[["法宝有灵","灵性10",P.gte("wr_refine","spirit3",10)],["道心稳固","40",P.gte("wr_enlight","dao",40)],["杀劫了断","三胜",P.win(3)]]},
guzhenren:{title:"青茅山风云",st:[["蛊师入门","真元50",P.gte("wr_guaperture","essence",50)],["毒蛊初成","毒性造诣15",P.gte("wr_gupoison","toxic",15)],["猎杀成名","三胜",P.win(3)]]},xuanjianxianzu:{title:"家族崛起",st:[["灵田起步","在种灵田3块",P.gte("wr_xjfield","planted",3)],["炼丹入门","成功率60%",P.gte("wr_xjalchemy","success",60)],["家族扬威","三胜",P.win(3)]]},jianlai:{title:"走出小镇",st:[["小镇立足","名声24",P.gte("wr_town","fame",24)],["学武双修","拳法20",P.gte("wr_fist","fist",20)],["行路见世面","远行3站+两胜",function(){var a=st("wr_walk"),c=st("wr_combat");return a&&(Number(a.miles)||0)>=3&&c&&(Number(c.wins)||0)>=2}]]},
guimi:{title:"非凡初触",st:[["占卜入门","造诣10",P.gte("wr_occult","insight",10)],["卷入非凡","委托12%",P.gte("wr_clue","progress4",12)],["灰雾之名","两胜",P.win(2)]]}
};
function esc(x){return WR.H.esc(String(x==null?"":x))}
function arcModule(g){var c=A[g];if(!c)return null;return WR.module({id:"wr_arc",icon:"🧭",name:"主线 · "+c.title,type:"tracker",tip:"三幕主线——读真实状态判定",contract:"主线阶段推进当轮必报",stats:{stage:{v:1,max:3,label:"主线幕数",icon:"🧭"}},backfill:function(o,f){f.state.stage=Number(o.stage)||1;f.state.done=!!o.done},read:function(st,s){var d=false;var g=0;while(!st.done&&g++<3){var idx=(Number(st.stage)||1)-1;if(idx<0||idx>=c.st.length)break;if(chk(c.st[idx][2])){st.stage=idx+2;if(st.stage>c.st.length){st.done=true;st.stage=c.st.length;WR.fact(s,"🧭 主线「"+c.title+"」三幕全部达成。")}else WR.fact(s,"🧭 主线推进——第"+(idx+2)+"幕「"+c.st[idx+1][0]+"」。");d=true}else break}return d},html:function(st,s){var cu=st.done?c.st.length:(Number(st.stage)||1);var rows=c.st.map(function(sg,i){var stat=st.done||i<cu-1?"✅":i===cu-1?"🎯":"🔒";var col=st.done||i<cu-1?"#8fd9a8":i===cu-1?"#e0a84c":"#9a8c6e";return'<div class="wr-kv"><span style="color:'+col+';">'+stat+' 第'+(i+1)+"幕</span><b>"+esc(sg[0])+' <i style="font-style:normal;color:var(--imt,#9a8c6e);font-size:11px;">'+esc(sg[1])+"</i></b></div>"}).join("");return'<div class="wr-status"><div class="wr-stat" style="flex:2 1 100%;"><b style="font-size:14px;">🧭 '+esc(c.title)+"</b>"+(st.done?'<em style="font-style:normal;font-size:11px;color:#8fd9a8;"> — 本卷完成 ✓</em>':'<em style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);"> — 第'+cu+"幕</em>")+"</div></div>"+rows+WR.ui.logHTML(s)},hud:function(st){var cu=st.done?c.st.length:(Number(st.stage)||1);return[{i:"🧭",v:st.done?"✓":cu+"/3",l:c.title.slice(0,4),tone:st.done?"ok":"",mod:"wr_arc"}]},directive:function(st){if(st.done)return"主线「"+c.title+"」三幕达成——后续自由展开。";var cu=(Number(st.stage)||1)-1;var sg=c.st[cu];if(!sg)return"";return"主线「"+c.title+"」第"+(cu+1)+"幕「"+sg[0]+"」进行中（"+sg[1]+"）。"}})}
var genre=WR.genre;var injected=false;
function inject(){if(injected)return true;if(!window.WorldExt||!window.WorldExt.hasModules||!window.WorldExt.hasModules())return false;var m=arcModule(genre);if(!m){injected=true;return true}try{WorldExt.injectModules(genre,[m]);console.log("[QuestChain] "+genre+" 就位")}catch(e){console.warn("[QuestChain]",e.message)}injected=true;return true}
/* v3.55.29：改用 YJWait 统一等待器（单飞 + 尝试上限）。
   旧写法 inject 失败排一个、tryInject 再排一个，每次裂变两条链 → 定时器指数翻倍 → 渲染进程崩溃 */
if(window.YJWait)YJWait.for(inject,null,{name:"quest-chain",base:140,max:60});
else if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",inject);else inject();
window.QuestChain={arcs:A,module:arcModule}})();
