/* 圣堂 · 界专属扩展（v7.4.1 校正）
   骷髅精灵《圣堂》：命痕（一至十层）/命器/圣像体系，按剧情变量追踪。旧版误用凝气→神王六阶，已废止。 */
(function () {
  "use strict";
  const TIERS = ["命痕一层", "命痕二层", "命痕三层", "命痕四层", "命痕五层", "命痕六层", "命痕七层", "命痕八层", "命痕九层", "命痕十层"];
  const realmMod = {
    id: "shengtangladder",
    icon: "🏯",
    name: "圣堂天梯 · 命痕进阶",
    tip: "命痕一至十层，命格为舟，命器为刃——王猛命痕二级亦可由凡入圣",
    contract: "命痕（命痕X层）；命器{名称}；圣像{名称}（高阶凝练）；堂战{场次,结果}",
    init: () => ({ tier: -1, artifacts: [], statues: [], trials: [] }),
    summary(s) {
      const items = [];
      if (s.tier >= 0) items.push({ i: "🏯", v: TIERS[s.tier] || "凡人", l: s.statues.length ? "圣像·" + s.statues.length : "" });
      if (s.artifacts.length) items.push({ i: "⚔", v: "命器·" + s.artifacts[0], l: s.artifacts.length > 1 ? "+" + (s.artifacts.length - 1) : "" });
      if (s.trials.length) items.push({ i: "🥊", v: "堂战", l: s.trials.length + "场" });
      return items;
    },
    read(s, vars, round) {
      let d = false;
      const raw = String(vars.境界 || vars.realm || vars.命痕 || "");
      const m = raw.match(/命痕\s*([一二三四五六七八九十1-9]+)\s*层/);
      let idx = -1;
      if (m) {
        const cn = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        idx = (cn[m[1]] || parseInt(m[1], 10) || 0) - 1;
      }
      if (idx >= 0 && idx <= 9 && idx !== s.tier) { s.tier = idx; d = true; }
      const arts = vars.命器 || vars.artifacts;
      if (Array.isArray(arts) && arts.join("|") !== s.artifacts.join("|")) { s.artifacts = arts.slice(); d = true; }
      const sts = vars.圣像 || vars.statues;
      if (Array.isArray(sts) && sts.join("|") !== s.statues.join("|")) { s.statues = sts.slice(); d = true; }
      const tl = vars.堂战 || vars.trials;
      if (Array.isArray(tl) && tl.length !== s.trials.length) { s.trials = tl.slice(); d = true; }
      return d;
    }
  };
  if (window.WorldExt) WorldExt.define("shengtang", [realmMod]);
})();
