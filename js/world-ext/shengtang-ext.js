/* 圣堂 · 界专属扩展（v7.5.0）
   由凡入圣：凝气→聚灵→结丹→化婴→神变→神王的试炼阶梯，随剧情变量追踪。 */
(function () {
  "use strict";
  const TIERS = ["凝气", "聚灵", "结丹", "化婴", "神变", "神王"];
  const realmMod = {
    id: "shengtangladder",
    icon: "🏯",
    name: "圣堂天梯 · 由凡入圣",
    tip: "凝气起步，聚灵成液，结丹化婴，神变登王——每一步都有代价与铺垫",
    contract: "境界（凝气→神王六阶）；试炼{场次,结果}（圣堂试炼的进度与胜负）",
    init: () => ({ tier: -1, trials: [] }),
    summary(s) {
      const items = [];
      if (s.tier >= 0) items.push({ i: "🏯", v: TIERS[s.tier] || "凡人", l: s.trials.length ? `试炼${s.trials.length}` : "" });
      return items;
    },
    read(s, vars, round) {
      let d = false;
      const raw = String(vars.境界 || vars.realm || "");
      const idx = TIERS.findIndex(t => raw.includes(t));
      if (idx >= 0 && idx !== s.tier) { s.tier = idx; d = true; }
      const tl = vars.试炼 || vars.trials;
      if (Array.isArray(tl) && tl.length !== s.trials.length) { s.trials = tl.slice(); d = true; }
      return d;
    }
  };
  if (window.WorldExt) WorldExt.define("shengtang", [realmMod]);
})();
