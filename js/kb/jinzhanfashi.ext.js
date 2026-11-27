/* jinzhanfashi · 扩展知识库（云境整理） */
(function(){
  var KB = window.KB_PRESETS || (window.KB_PRESETS = {});
  var a = KB["jinzhanfashi"] || (KB["jinzhanfashi"] = []);
  var add = [
    {"title":"近战法师·云端城","content":"云端城是《平行世界》的新玩家集散地，建筑风格融合蒸汽朋克与东方元素，是顾飞起步与公子精英团活动的核心主城。玩家在云端城时，正文须写出新玩家云集、世界频道喧闹、任务看板前挤满人的气氛。","category":"地点","tags":["近战法师", "云端城"],"alwaysInclude":false,"priority":""},
    {"title":"近战法师·月夜城","content":"月夜城具哥特式教堂与狼人传说，是游戏中风格鲜明的主城之一；顾飞在此经历月夜城游记等情节。玩家在月夜城时，正文须写出哥特氛围与狼人传闻，禁止与云端城一个腔调。","category":"地点","tags":["近战法师", "月夜城", "狼人"],"alwaysInclude":false,"priority":""},
    {"title":"近战法师·霞雾城与林荫城","content":"霞雾城终年大雾、地形混沌不可测；林荫城密林纵横，是陷阱与潜行战术的核心区。两城是顾飞式战术（预判、伏击、地形利用）大展身手的舞台。玩家在此类地形时，正文须体现地形对战术的影响。","category":"地点","tags":["近战法师", "霞雾城", "林荫城"],"alwaysInclude":false,"priority":""},
    {"title":"近战法师·唐刀九连与分流三式","content":"顾飞把现实功夫转化为游戏技能：唐刀九连（预判NPC攻击节奏制定的连击套路）、分流三式等功夫流派衍生技，与职业技能（鉴定术、附法攻击、电流墙壁）并行。技能须靠练习与理解获得，不得白给。","category":"修炼体系","tags":["近战法师", "唐刀九连", "技能"],"alwaysInclude":false,"priority":""},
    {"title":"近战法师·不正当竞争与规则漏洞","content":"小说核心冲突之一：顾飞代表的『现实能力者』证明当人类身体经验深度介入，任何数值模型都将失效；叶小五代表的游戏平衡实验线则试图修补漏洞。从初期PK保护漏洞到后期效率练级法剿灭，本质是『可计算的规则』与『不可量化的劲与意』两种文明范式的碰撞。","category":"世界观设定","tags":["近战法师", "规则漏洞", "叶小五"],"alwaysInclude":false,"priority":""},
    {"title":"近战法师·装备与紫字金字","content":"游戏装备有紫字、金字等品阶，公子精英团通过对抗赛与任务链累计多件紫字、金字装备；顾飞持暗夜流光剑。装备是实力的一部分但非决定因素——顾飞的胜利从不靠装备碾压。","category":"世界观设定","tags":["近战法师", "装备", "暗夜流光剑"],"alwaysInclude":false,"priority":""}
];
  var have = {}; a.forEach(function(x){ have[String(x&&x.title||'').trim()] = 1; });
  add.forEach(function(x){ var t=String(x&&x.title||'').trim(); if(!have[t]){ have[t]=1; a.push(x); } });
  window.__KB_CODEX_OK__ = true;
})();
/* YJ_CODEX_END */
