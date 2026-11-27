/* 近战法师 · 界专属扩展（v7.4.1）
   蝴蝶蓝《网游之近战法师》：双轨成长（官方数值/玩家技能树）与极限操作，按剧情变量追踪。 */
(function () {
  "use strict";
  const mod = {
    id: "jinzhanbuild",
    icon: "⚔",
    name: "近战法师 · 极限操作",
    tip: "以功夫玩法师，精准发力与时机把控，把伤害压到理论极值",
    contract: "等级(Lv.X)；职业(法师/近战法师)；技能{名称}；极限操作{是否触发}",
    init: () => ({ lv: 0, skills: [], limit: false }),
    summary(s) {
      const items = [];
      if (s.lv > 0) items.push({ i: "⚔", v: "Lv." + s.lv, l: s.limit ? "极限" : "" });
      if (s.skills.length) items.push({ i: "✦", v: s.skills[0], l: s.skills.length > 1 ? "+" + (s.skills.length - 1) : "" });
      return items;
    },
    read(s, vars, round) {
      let d = false;
      const lvRaw = String(vars.等级 || vars.level || "");
      const m = lvRaw.match(/(\d+)/);
      const lv = m ? parseInt(m[1], 10) : 0;
      if (lv && lv !== s.lv) { s.lv = lv; d = true; }
      const sk = vars.技能 || vars.skills;
      if (Array.isArray(sk) && sk.join("|") !== s.skills.join("|")) { s.skills = sk.slice(); d = true; }
      const lim = !!(vars.极限操作 || vars.limit);
      if (lim !== s.limit) { s.limit = lim; d = true; }
      return d;
    }
  };
  if (window.WorldExt) WorldExt.define("jinzhanfashi", [mod]);
})();
