(function() {
  "use strict";
  const TIERS = ["一至二重·开辟", "三至四重·初蕴", "五至六重·中启", "七至八重·深凝", "九至十重·将满", "十一至十二重·圆满"];
  const relicMod = {
    id: "palacecompass",
    icon: "🏯",
    name: "命宫罗盘 · 万古见闻",
    tip: "命宫十二重循序而开，真命凝形自有其度；万古见闻录——纪元露出的每一角都值得记下",
    contract: "命宫层次（一重至十二重）；真命{凝形度,异象}（真命的凝实程度与显化之象）；万古见闻（秘辛/古史/帝藏线索的见闻记录）",
    init: () => ({ tier: -1, fate: 0, fateNote: "", log: [] }),
    /* v3.32.2 状态板摘要：🏯 五至六重 ·真命42% ·见闻3 */
    summary(s) {
      if (s.tier < 0 && !s.fate && !s.log.length) return [];
      const items = [];
      if (s.tier >= 0) items.push({ i: "🏯", v: TIERS[s.tier], l: s.log.length ? `见闻${s.log.length}` : "" });
      if (s.fate > 0) items.push({ i: "🪷", v: `${s.fate}%`, l: "真命凝形", tone: s.fate >= 80 ? "ok" : "" });
      return items;
    },
    read(s, vars, round) {
      var _a;
      let d = false;
      const raw = String(vars.命宫 || vars.命宫层次 || WXH.asObj(vars.境界).命宫 || vars.境界 || "");
      const m = raw.match(/([一二三四五六七八九十]{1,3})\s*重/);
      if (m) {
        const cn = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12 };
        const n = cn[m[1]] || 0;
        if (n) {
          const tier = Math.min(5, Math.floor((n - 1) / 2));
          if (tier !== s.tier) {
            s.tier = tier;
            d = true;
          }
        }
      } else {
        const idx = TIERS.findIndex((x) => raw.includes(x.split("·")[1]));
        if (idx >= 0 && idx !== s.tier) {
          s.tier = idx;
          d = true;
        }
      }
      const tf = WXH.asObj(vars.真命);
      const fd = (_a = WXH.pick(tf, ["凝形度", "凝形", "进度"])) != null ? _a : WXH.pick(vars, ["真命凝形度", "凝形度"]);
      if (fd != null) {
        const mm = String(fd).match(/(\d{1,3})/);
        if (mm) {
          const v = Math.min(100, Number(mm[1]));
          if (v !== s.fate) {
            s.fate = v;
            d = true;
          }
        }
      }
      const note = tf.异象 || tf.显化 || "";
      if (note && String(note) !== s.fateNote) {
        s.fateNote = String(note);
        d = true;
      }
      WXH.asArr(vars.万古见闻 || vars.见闻 || vars.秘辛).forEach((x) => {
        const str = String(x);
        if (str && !s.log.some((t) => t === str)) {
          s.log.unshift(str);
          d = true;
        }
      });
      if (s.log.length > 8) s.log.length = 8;
      return d;
    },
    html(s) {
      const compass = WXH.card("命宫六阶 · 十二重", `<div class="wx-stepper">
                ${TIERS.map((t, i) => `<div class="wx-step ${i === s.tier ? "on" : i < s.tier ? "done" : ""}">${i < s.tier ? "✓ " : ""}${t}</div>`).join("")}
            </div>`, {
        icon: "🏯",
        grow: true,
        tag: s.tier >= 0 ? "当前：" + TIERS[s.tier] : "命宫未开"
      });
      const fate = WXH.card(
        `真命凝形 · ${s.fate}%` + (s.fateNote ? ` · ${WXH.esc(s.fateNote)}` : ""),
        `
                <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${s.fate}%;background:#d8b46a;"></i></div><b style="color:#d8b46a;">${s.fate >= 80 ? "将成" : s.fate >= 40 ? "渐凝" : "初萌"}</b></div>`,
        { icon: "🪷", grow: true }
      );
      const log = s.log.length ? WXH.card("万古见闻录", `${s.log.map((t) => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">📜 ${WXH.esc(t)}</b></div>`).join("")}`, { icon: "📜", grow: true }) : "";
      return `${compass}${fate}${log}
            <div class="wx-banner">命宫十二重是修行的第一程：一重有一重的天地，十二重圆满方有资格叩问真命；真命凝形写意不写数——如活物苏醒、如天地初开；万古见闻录里记下的每一角秘辛，都可能是下一个纪元的伏笔。</div>`;
    },
    directive(s) {
      const t = [];
      if (s.tier >= 0) t.push(`命宫境·${TIERS[s.tier]}：修行描写须贴合当前层次的意象（开辟之艰/初蕴之生机/中启之气象/深凝之厚重/将满之圆满），进一重有一重的关口与代价`);
      if (s.fate > 0) t.push(`真命凝形 ${s.fate}%：真命的描写写意不写数（苏醒/悸动/共鸣），凝形推进须有历练与感悟作铺垫，不得平白暴涨`);
      if (s.log.length) t.push(`万古见闻已录 ${s.log.length} 条：行文中自然埋设或回收秘辛线索，见闻录是长线伏笔的家`);
      return t.join("；") || "";
    }
  };
  if (window.WorldExt) WorldExt.define("dibao", [relicMod]);
})();
