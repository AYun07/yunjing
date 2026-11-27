/* 圣堂 · 扩展知识库（云境原创整理） */
(function(){
  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});
  var a = KB["shengtang"] || (KB["shengtang"] = []);
  var add = [
    {"title":"圣堂·天蒙位面风物志","content":"天蒙位面是圣堂世界的起始位面：凡俗城镇与修炼宗门并存，灵气浓度随地域而异。小镇流淌着凡人的烟火气，城里有市集与世家府邸，野外有低阶妖兽与遗迹。玩家自天蒙位面起步时，正文须写出仙凡之别——修士在凡人眼中的敬畏与距离，凡人仰望圣堂的向往。","category":"世界观设定","tags":["shengtang", "天蒙位面", "风物"],"alwaysInclude":false,"priority":""},
    {"title":"圣堂·圣堂山门与内门外门","content":"圣堂山门巍峨，是天下修士心中的圣地。外门弟子杂役与基础功法起步，须经试炼方可晋内门；内门弟子享资源与传承，也承担更重的争斗与任务。遴选三年一度，测灵台上决定无数少年的命运。玩家拜入圣堂后，正文须体现门规、辈分与同门竞争的规矩。","category":"世界观设定","tags":["shengtang", "圣堂山门", "内门", "外门"],"alwaysInclude":false,"priority":""},
    {"title":"圣堂·密云城","content":"密云城是圣堂世界中重要的城市舞台：商贾云集、修士往来，是消息与交易的集散地。城中各色人等混杂——世家子弟、散修、圣堂弟子与凡俗商贩，暗流与机会并存。玩家在密云城时，正文可展开市集议价、酒楼听闻、暗巷冲突等场景。","category":"地点","tags":["shengtang", "密云城", "城市"],"alwaysInclude":false,"priority":""},
    {"title":"圣堂·神界诸神与布局","content":"神界是圣堂世界的更高舞台，诸神各执一端、互相博弈，与下界圣堂隐隐相连。神界之物下沉往往引发下界震荡。涉及神界内容须按玩家阶段给出，不得提前倒出诸神布局或结局；玩家触及神界前，神界只作传闻与背景。","category":"世界观设定","tags":["shengtang", "神界", "诸神"],"alwaysInclude":false,"priority":""},
    {"title":"圣堂·圣堂试炼规矩","content":"圣堂试炼是选拔与晋升的核心机制：名额有限、淘汰残酷、功法与危险同在。试炼按顺序展开——测资质、过关斩将、心力考验，每一环都有人掉落。玩家参与试炼时，正文须给出明确规则、对手与代价，胜负有铺垫、不突然处刑，也不白送名额。","category":"规则","tags":["shengtang", "试炼", "淘汰"],"alwaysInclude":false,"priority":""},
    {"title":"圣堂·丹药法器与功法分阶","content":"圣堂世界丹药按品阶递升，疗伤、突破、增益各有其用；法器分阶，材质与铭文决定威力；功法分层，基础、进阶、高阶各有门槛。炼丹炼器需材料、火候与手艺，非随手可得。正文写炼制与斗法时须体现阶位差异与消耗，严禁写成无代价的数值播报。","category":"世界观设定","tags":["shengtang", "丹药", "法器", "功法"],"alwaysInclude":false,"priority":""}
];
  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });
  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });
  window.__KB_CODEX_OK__ = true;
})();
/* YJ_CODEX_END */
