/* 猛龙过江 · 界专属扩展（v7.4.1）
   骷髅精灵《猛龙过江》：等级/职业（法师→魔武骑士）/神器，按剧情变量追踪。 */
(function () {
  "use strict";
  const mod = {
    id: "menglongbuild",
    icon: "🐉",
    name: "猛龙过江 · 魔武进阶",
    tip: "从全服第一法师到魔武骑士，幸运与神器伴你走上塔尖",
    contract: "等级(Lv.X)；职业(法师/魔武骑士)；神器{名称}；行会{名称}",
    init: () => ({ lv: 0, job: "", artifacts: [], guild: "" }),
    summary(s) {
      const items = [];
      if (s.lv > 0) items.push({ i: "🐉", v: "Lv." + s.lv, l: s.job || "" });
      if (s.artifacts.length) items.push({ i: "★", v: "神器·" + s.artifacts[0], l: "" });
      if (s.guild) items.push({ i: "⚑", v: s.guild, l: "" });
      return items;
    },
    read(s, vars, round) {
      let d = false;
      const lvRaw = String(vars.等级 || vars.level || "");
      const m = lvRaw.match(/(\d+)/);
      const lv = m ? parseInt(m[1], 10) : 0;
      if (lv && lv !== s.lv) { s.lv = lv; d = true; }
      const job = String(vars.职业 || vars.job || "");
      if (job && job !== s.job) { s.job = job; d = true; }
      const arts = vars.神器 || vars.artifacts;
      if (Array.isArray(arts) && arts.join("|") !== s.artifacts.join("|")) { s.artifacts = arts.slice(); d = true; }
      const guild = String(vars.行会 || vars.guild || "");
      if (guild && guild !== s.guild) { s.guild = guild; d = true; }
      return d;
    }
  };
  if (window.WorldExt) WorldExt.define("menglongguojiang", [mod]);
})();
