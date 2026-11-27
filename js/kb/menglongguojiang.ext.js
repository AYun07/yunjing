/* menglongguojiang · 扩展知识库（云境整理） */
(function(){
  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});
  var a = KB["menglongguojiang"] || (KB["menglongguojiang"] = []);
  var add = [
    {"title":"猛龙过江·第二世界","content":"『第二世界』是由全球政府联合支持的虚拟网游，拥有全真模拟系统，货币可与现实国际币兑换，职业由DNA检测推荐。游戏与现实深度交织：主角在游戏中的成长映射现实中的崛起。玩家进入时，正文须写出全息拟真的沉浸感与虚实共生的社会氛围。","category":"地点","tags":["猛龙过江", "第二世界"],"alwaysInclude":false,"priority":""},
    {"title":"猛龙过江·新手村与主城","content":"新手村是所有玩家的原点，王钟在此从零起步；主城是行会林立、消息汇聚的核心城市，交易所、任务板、行会驻地构成网游社会的骨架。玩家在主城时，正文须写出行会纷争、行情波动与频道喊话的喧闹。","category":"地点","tags":["猛龙过江", "新手村", "主城"],"alwaysInclude":false,"priority":""},
    {"title":"猛龙过江·魔宫驻地","content":"魔宫佣兵团的驻地，是王钟建立的势力核心，也是行会纷争与驻地争夺的焦点。玩家涉及魔宫线时，正文须写出魔宫的组织层级、成员分工与王钟『魔王』威名的分量。","category":"地点","tags":["猛龙过江", "魔宫", "驻地"],"alwaysInclude":false,"priority":""},
    {"title":"猛龙过江·鉴定与炼金","content":"二愣子的鉴定冶炼天赋与永远的古魔法师的炼金道具制造，是魔宫后勤与技术核心：鉴定辨装备真伪词条、冶炼强化装备、炼金制造特殊道具。生活技能不是点缀，而是行会实力的组成部分。","category":"世界观设定","tags":["猛龙过江", "鉴定", "炼金", "二愣子"],"alwaysInclude":false,"priority":""},
    {"title":"猛龙过江·行会与佣兵团机制","content":"建帮、驻地经营、贡献点与公会义务、雇佣任务、行会战是『第二世界』的核心玩法。魔宫从一支佣兵团成长为帝国，靠的是任务积累、人才汇聚与领导者的战略。玩家参与行会线时，正文须写出组织运转的规则与代价。","category":"规则","tags":["猛龙过江", "行会", "佣兵团"],"alwaysInclude":false,"priority":""},
    {"title":"猛龙过江·现实古武界","content":"王钟现实中是古武传人，游戏成功后将势力延伸回现实古武界，最终成为现实巅峰与新秩序守护者。虚实双线是本书区别于普通网游文的核心——玩家若有现实古武背景，正文须写出古武界与游戏界的互相映照。","category":"世界观设定","tags":["猛龙过江", "现实", "古武"],"alwaysInclude":false,"priority":""}
];
  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });
  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });
  window.__KB_CODEX_OK__ = true;
})();
/* YJ_CODEX_END */
