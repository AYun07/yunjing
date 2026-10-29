const GameLayer = function() {
  "use strict";
  const MAX_DICE = 30, RANK_SIZE = 10;
  let genre = "free";
  const KEY = () => "gl_" + genre;
  const st = {
    seals: [],
    /* 已解锁成就 id[] */
    diceCount: 0,
    lastRankRound: 0,
    oracle: null
    /* 待注入的天机批语 {text, rolledAt} */
  };
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY()) || "{}");
      if (o && typeof o === "object") Object.assign(st, { seals: [], diceCount: 0, lastRankRound: 0, oracle: null }, o);
    } catch (e) {
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY(), JSON.stringify(st));
    } catch (e) {
    }
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const theme = () => window.ImmersiveSuite && ImmersiveSuite.themes && (ImmersiveSuite.themes[genre] || ImmersiveSuite.themes.mystery) || null;
  const DEFS = [
    { id: "first_win", icon: "⚔", name: "首战告捷", desc: "赢得第一场战斗", test: (s) => s.battles.some((b) => /胜/.test(b.result)) },
    { id: "ten_war", icon: "🛡", name: "百战之躯", desc: "累计十场战报", test: (s) => s.battles.length >= 10 },
    { id: "ten_loot", icon: "💎", name: "腰缠万贯", desc: "同时持有十件宝物", test: (s) => s.items.length >= 10 },
    { id: "ten_mail", icon: "✉", name: "鸿雁不绝", desc: "收到十封传书", test: (s) => s.letters.length >= 10 },
    { id: "first_realm", icon: "⛩", name: "破境初成", desc: "第一次境界跃升", test: (s) => s.realmIdx >= 1 },
    { id: "half_realm", icon: "🌠", name: "天梯过半", desc: "境界梯攀至半程", test: (s) => {
      const t = theme();
      return t && t.realms ? s.realmIdx >= Math.floor(t.realms.length / 2) : false;
    } },
    { id: "top_realm", icon: "👑", name: "登临绝顶", desc: "抵达境界梯末三阶", test: (s) => {
      const t = theme();
      return t && t.realms ? s.realmIdx >= t.realms.length - 3 : false;
    } },
    { id: "eight_npc", icon: "🎭", name: "群英荟萃", desc: "众生相识满八人", test: (s) => Object.keys(s.gallery).length >= 8 },
    { id: "five_scene", icon: "⭐", name: "名场面收藏家", desc: "收录五个名场面", test: (s) => s.highlights.length >= 5 },
    { id: "ten_chron", icon: "📜", name: "史官之笔", desc: "编年史录满十条", test: (s) => s.chronicle.length >= 10 },
    { id: "sworn", icon: "🕯", name: "肺腑之言", desc: "与一位角色完成密谈", test: (s) => Object.values(s.gallery).some((g) => g.whispers && g.whispers.length >= 2) },
    { id: "worldline", icon: "🌐", name: "一念千川", desc: "开辟第一条平行世界线", test: () => false },
    /* 由 TimelineBranch 通知解锁 */
    { id: "first_dice", icon: "🎲", name: "问天之人", desc: "第一次掷骰问天", test: () => false },
    /* 掷骰时解锁 */
    { id: "ten_dice", icon: "🌀", name: "天机常客", desc: "掷骰满十次", test: () => false }
  ];
  let EXT = [];
  function registerSeals(defs) {
    EXT = (Array.isArray(defs) ? defs : []).filter((d) => d && d.id && d.name && typeof d.test === "function");
    return EXT.length;
  }
  const findDef = (id) => DEFS.find((d) => d.id === id) || EXT.find((d) => d.id === id);
  function unlock(id, silentToast) {
    var _a;
    if (st.seals.includes(id)) return false;
    const def = findDef(id);
    if (!def) return false;
    st.seals.push(id);
    save();
    if (!silentToast) {
      sealFlash(def);
      try {
        (_a = window.showToast) == null ? void 0 : _a.call(window, `🏆 成就解锁 · ${def.icon} ${def.name}`, "success");
      } catch (e) {
      }
      try {
        window.ImmersiveSuite && ImmersiveSuite._audio ? ImmersiveSuite._audio("highlight") : null;
      } catch (e) {
      }
      try {
        window.Celebration && window.Celebration.fire("seal");
      } catch (e) {
      }
    }
    return true;
  }
  function sealFlash(def) {
    try {
      const ov = document.createElement("div");
      ov.className = "seal-flash";
      ov.innerHTML = `<div class="seal-stamp"><span class="ss-ico">${def.icon}</span><b>${esc(def.name)}</b><i>${esc(def.desc)}</i></div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add("go"));
      setTimeout(() => {
        ov.classList.remove("go");
        setTimeout(() => ov.remove(), 500);
      }, 2100);
    } catch (e) {
    }
  }
  function isEarth() {
    try {
      return !!(window.storyFramework && storyFramework.config && storyFramework.config.genreKey === "earth");
    } catch (e) {
      return false;
    }
  }
  function onVars(vars, immState) {
    var _a;
    const s = immState || window.ImmersiveSuite && ImmersiveSuite._state;
    if (isEarth()) {
      for (const d of EXT) {
        if (st.seals.includes(d.id)) continue;
        let hit = false;
        try {
          hit = d.test(vars || {}, s);
        } catch (e) {
        }
        if (hit) unlock(d.id);
      }
      return;
    }
    if (s) {
      for (const d of DEFS) {
        if (st.seals.includes(d.id)) continue;
        let hit = false;
        try {
          hit = d.test(s);
        } catch (e) {
        }
        if (hit) unlock(d.id);
      }
    }
    for (const d of EXT) {
      if (st.seals.includes(d.id)) continue;
      let hit = false;
      try {
        hit = d.test(vars || {}, s);
      } catch (e) {
      }
      if (hit) unlock(d.id);
    }
    const round = Number(vars && vars.chapter) || 0;
    if (round && round - st.lastRankRound >= 10 && rankData(s).length >= 3) {
      st.lastRankRound = round;
      save();
      try {
        (_a = window.showToast) == null ? void 0 : _a.call(window, `📜 天道金榜已刷新（第${round}章）`, "info");
      } catch (e) {
      }
      try {
        window.ImmersiveSuite && ImmersiveSuite._audio && ImmersiveSuite._audio("thunder");
      } catch (e) {
      }
      try {
        window.Celebration && window.Celebration.fire("rank");
      } catch (e) {
      }
    }
  }
  const ORACLES = {
    base: ["静水流深，宜观不宜动", "风起于青萍之末", "旧友重逢，一笑泯恩", "利刃当藏，锋芒毕露则折", "远行者归，宜备行装", "夜长梦多，速断速决", "逢七必变，宜遇故人", "假作真时真亦假", "置之死地而后生", "塞翁失马，焉知非福", "月满则亏，盛极宜敛", "无心插柳柳成荫"],
    shrouding: ["仙路尽头谁为峰", "源天师一脉再现，机缘藏于古矿", "帝兵将鸣，血月当空", "成仙路开，万灵朝拜", "苦海无边，回头非岸"],
    doupocangqiong: ["异火榜上有名之物在向你靠近", "三十年河东，三十年河西", "丹成七品，香气引贵人", "退婚之辱，雪之在后", "焚尽八荒，火中生莲"],
    douluodalu: ["魂环将现，猎杀宜速", "双生武魂，天骄觉醒", "封号之路始于足下", "海神九考，浪里求生", "史莱克只收怪物"],
    wanmeishijie: ["太古凶兽苏醒于荒原", "骨文闪烁，祭灵低语", "一粒尘可填海，一根草可斩日月", "登天路，白骨为阶", "仙古遗族在等你"],
    swallowedstar: ["怪兽级生命体在靠近", "合金刀锋出鞘，血染荒野", "训练营的考核没有仁慈", "星际之上，强者独行", "黑洞边缘藏着机缘"],
    quanzhigaoshou: ["荣耀不是一个人的游戏", "龙抬头，翻盘就在此局", "替补席上藏着未来之王", "千机伞变，打法再造", "兴欣之火可以燎原"],
    daoguiyixian: ["纸人抬轿，夜行莫回头", "分不清的时候，先攥住暖的东西", "香火越旺，殿里的东西越饿", "腊月十八，有人在找眼睛", "疯的未必是你，可能是这个世界"],
    zhongshengdushi: ["百年之后皆尘土，而你还在", "扮猪吃虎，锋芒后发", "灯会一遇，因果早定", "灵气将枯，机缘先至", "护住身边人，仙路才有滋味"],
    dibao: ["命宫十二重，一重一重地开", "帝兵将鸣，中域必有大事", "禁区现异象，天下不太平", "旧账到了账期，万古的棋子会自己走", "帝路千万人争渡，登顶的只有那一个"],
    longzu: ["先看简报最后一栏：生还率", "血统越纯，耳边的低语越近", "王在沉睡，梦在扩散", "雨夜里别回头，先把伞压低", "烫金的信封改变命运，也标记你"],
    quanzhifashi: ["雷系觉醒者，脚下自有雷霆", "黑教廷的名单上多了一个名字", "星辉落进左眼，灾变藏在右眼", "城墙之外，魔物在等灯灭", "双系天赋，天下皆敌——也皆友"],
    limingzhijian: ["黎明不是等来的，是一寸寸点亮的", "一台魔能灯厂，胜过一百个法师", "废土的风里有上一个纪元的声音", "旧骑士的剑挡不住新时代的列车", "魔潮在倒计时，文明在赶工期"],
    lunhuileyuan: ["机械音不解释条款，也不收尸", "属性面板不骗人，骗人的是队友", "一阶的命，别接三阶的单", "悬赏榜每天都有新名字，旧名字去哪了", "乐园的每一枚币，都标着风险价"],
    wulianfengdian: ["挑战台上无父子，战书递出无回头", "淬体九层通天地之桥，急不得", "坊市的行情比山里的天气变得还快", "功法残卷缺三成，悟的是自己", "邪地的规矩，是活下来的人定的"],
    shengxu: ["彼岸花开一夜谢，看见的人别声张", "呼吸吐纳三分练七分悟", "异果越奇，盯着它的眼睛越多", "枷锁断一道脱层皮，神通醒一分", "复苏的年代，知道得越多睡得越少"],
    shenmifusu: ["厉鬼杀人有规律，找到它就能活", "黄金克鬼，克数就是命", "深夜的敲门声，数清了再开", "档案越厚，命越长", "S级禁锢的价目表上，写的是感官和肢体"],
    ditandali: ["货在人先，人在祸前", "被坑得越惨，怨气越足", "大力药水十倍力气，三天三夜秃顶", "谢谢惠顾也是抽，抽了才有下次", "夜市的灯亮着，就有人来买命"],
    fanrenxiuxian: ["炼气十三层，一层数着走，急不得", "宝物现世的地方，死人比宝贝多", "修仙先修命：打不过就跑，跑不掉就藏", "坊市的行情，比灵脉的走向更难测", "寿元是大限——境界不至，寿元先尽"],
    xianni: ["顺为凡，逆则仙，只在心中一念间", "杀令悬着的日子，出门先看风向", "狠辣喂心魔，隐忍攒道心", "穷修士的储物袋，装得下全部家当也装得下催命符", "脚下的天地，永远是更大天地的一隅"],
    earth: ["日子是一天天过出来的", "乱世藏金，盛世置地", "出门看天色，进门看脸色", "人挪活，树挪死", "远亲不如近邻"],
    quanqiubingfeng: ["雪落之前囤的每一斤粮，都是雪落之后的一条命", "敲门的人未必是客人——先看猫眼再开灯", "空间在手，天下我有；藏不住，就是怀璧其罪", "钱在末世是废纸，但在倒计时里还是钱", "上一世欠的账，这一世要连本带利地收回来"],
    chaoshenxueyuan: ["一代扛枪弹，二代开异能，神体拆舰队——但防线上的每一寸都是人守的", "军礼不是仪式，是把命交出去之前的交代", "天使的圣光不免费，恶魔的虫门也不白开", "打不过神级就别硬扛——撤回来，人比阵地值钱", "饕餮在天上，你身后是万家灯火"],
    zhanhen: ["大夏境内，神明禁行——这八个字是拿命守的", "盏境看十米，川境定国战——境界不至，别硬接序列高的活", "雾里遇见的东西，先看规律再动手", "夜里的敲门声，数清了再开", "病院里的病人记得母亲的名字——疯不疯，两说"],
    jianlai: ["天底下的道理，书里都写着——读了未必懂，不读一定不懂", "拳头要硬，道理更要讲——山上山下都吃这一套", "一粒米吃出一个天下，一步路走出一座江湖", "欠人的要还，护人的要还——因果这东西，记性最好", "慢慢来，比较快"],
    guimi: ["扮演好你的序列，失控就慢一步", "不要指着月亮发誓，它一直在变", "雾都的雨里，撑伞的人未必是人", "敬畏不是软弱，是活得久的本事", "神秘汇聚到一处，就成了命运"],
    guzhenren: ["五百年一场空，重头再来才是真本事", "蛊要一只一只炼，路要一步一步走", "弱者才谈公平，强者只讲代价", "人心比蛊虫难养", "吃过的亏，都是将来的刀"],
    xuanjianxianzu: ["修仙如种田，急不得——一茬灵稻也要等四时", "家族不是枷锁，是你在世上的根", "灵石会花光，人情用不尽", "藏经阁的功法再好，不如族里多一个筑基", "君子报仇，修为到了不算晚"],
    freeworld: ["世界是你亲笔写的，日子得自己过", "宪法没写到的地方，就是你的余地", "因果不灭——做过的每件事都记在账上", "世界不围着谁转，机会也不等人", "把普通的日子过出滋味，才是真本事"]
  };
  function roll() {
    const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const sum = d[0] + d[1] + d[2];
    const pool = [...ORACLES[genre] || [], ...ORACLES.base];
    const text = pool[sum % pool.length];
    st.diceCount++;
    st.oracle = { text, dice: d.join("·"), sum, rolledAt: Date.now() };
    save();
    unlock("first_dice", true);
    if (st.diceCount >= 10) unlock("ten_dice");
    return st.oracle;
  }
  function takeOracle() {
    if (!st.oracle) return null;
    const o = st.oracle;
    st.oracle = null;
    save();
    return o;
  }
  function rankData(immState) {
    const s = immState || window.ImmersiveSuite && ImmersiveSuite._state;
    const gal = s && s.gallery ? Object.values(s.gallery) : [];
    const round = s ? s.titles && s.titles.length : 0;
    return gal.map((g) => ({
      name: g.name,
      favor: g.favor == null ? 50 : g.favor,
      span: Math.max(1, (g.lastRound || 1) - (g.firstRound || 1) + 1),
      role: g.role || ""
    })).sort((a, b) => b.favor * 100 + b.span - (a.favor * 100 + a.span)).slice(0, RANK_SIZE);
  }
  const MEDALS = ["🥇", "🥈", "🥉"];
  function radarData(vars, curRound) {
    const fs = vars && vars.foreshadowings || [];
    return fs.map((f, i) => {
      const planted = Number(f.plantedAt) || 0;
      const age = Math.max(0, (curRound || planted) - planted);
      return { name: f.name || "未名伏笔", resolved: f.status === "resolved", planted, age, i };
    });
  }
  const WARN_CHAPTERS = 8;
  function panelHTML(vars) {
    const gk = window.storyFramework && storyFramework.config && storyFramework.config.genreKey || null;
    if (gk && gk !== genre) onGenre(gk);
    const v = vars || window.storyFramework && storyFramework.storyState.variables || {};
    const curRound = Number(v.chapter) || 0;
    const th = theme();
    const sealHTML = DEFS.map((d) => {
      const got = st.seals.includes(d.id);
      return `<div class="seal-cell ${got ? "got" : ""}" title="${esc(d.desc)}">
                <span class="seal-ico">${got ? d.icon : "·"}</span>
                <b>${esc(d.name)}</b><i>${got ? esc(d.desc) : "？？？"}</i></div>`;
    }).join("");
    const rank = rankData();
    const radar = radarData(v, curRound);
    const open = radar.filter((r) => !r.resolved);
    const warned = open.filter((r) => r.age >= WARN_CHAPTERS);
    let dots = "", rings = "";
    for (let r = 1; r <= 3; r++) rings += `<circle cx="70" cy="70" r="${r * 18}" class="radar-ring"/>`;
    radar.forEach((p) => {
      const ang = p.i / Math.max(1, radar.length) * Math.PI * 2 - Math.PI / 2;
      const rad = p.resolved ? 8 + p.age % 10 : 20 + Math.min(46, p.age * 4.5);
      const x = 70 + Math.cos(ang) * rad, y = 70 + Math.sin(ang) * rad;
      const cls = p.resolved ? "ok" : p.age >= WARN_CHAPTERS ? "warn" : "open";
      dots += `<g class="radar-dot ${cls}"><circle cx="${x}" cy="${y}" r="3.4"/><title>${esc(p.name)} · ${p.resolved ? "已回收" : `埋设${p.age}章`}</title></g>`;
      if (!p.resolved) dots += `<line x1="70" y1="70" x2="${x}" y2="${y}" class="radar-beam ${p.age >= WARN_CHAPTERS ? "warn" : ""}"/>`;
    });
    return `
        <div class="gl-sec">
            <div class="gl-dice-row">
                <button class="gl-dice" onclick="GameLayer.rollUI()">🎲 掷骰问天</button>
                <div class="gl-dice-out" id="glDiceOut">${st.oracle ? `<b>「${esc(st.oracle.text)}」</b><i>骰 ${esc(st.oracle.dice)} = ${st.oracle.sum} · 下一轮生效</i>` : "<i>卡文时掷骰问天——批语将化入下一段正文的走向</i>"}</div>
            </div>
        </div>
        <div class="gl-sec">
            <div class="gl-title">🏆 成就印章册 <i>${st.seals.length} / ${DEFS.length + EXT.length}</i></div>
            <div class="seal-grid">${sealHTML}</div>
        </div>
        ${EXT.length ? `
        <div class="gl-sec">
            <div class="gl-title">🏮 本界专属成就 <i>${EXT.filter((d) => st.seals.includes(d.id)).length} / ${EXT.length}</i></div>
            <div class="seal-grid world">${EXT.map((d) => {
      const got = st.seals.includes(d.id);
      return `<div class="seal-cell ${got ? "got" : ""}" title="${esc(d.desc)}">
                    <span class="seal-ico">${got ? d.icon : "·"}</span>
                    <b>${esc(d.name)}</b><i>${got ? esc(d.desc) : "？？？"}</i></div>`;
    }).join("")}</div>
        </div>` : ""}
        <div class="gl-sec">
            <div class="gl-title">📜 天道金榜 <i>${rank.length ? `前十 · 第${Math.max(curRound, st.lastRankRound)}章榜` : "虚位以待"}</i></div>
            ${rank.length ? `<div class="rank-list">${rank.map((r, i) => `
                <div class="rank-row ${i < 3 ? "top" : ""}">
                    <span class="rk-medal">${MEDALS[i] || i + 1}</span>
                    <b class="rk-name">${esc(r.name)}</b>
                    <span class="rk-role">${esc(String(r.role).slice(0, 8))}</span>
                    <span class="rk-bar"><i style="width:${r.favor}%"></i></span>
                    <span class="rk-fav">${r.favor}</span>
                </div>`).join("")}</div>` : '<div class="gl-empty">结识 NPC 后，金榜自会排定名次</div>'}
        </div>
        <div class="gl-sec">
            <div class="gl-title">🕸 伏笔雷达 <i>${open.length} 未回收${warned.length ? ` · ${warned.length} 亮红灯` : ""}</i></div>
            ${radar.length ? `
            <div class="radar-wrap">
                <svg viewBox="0 0 140 140" class="radar-svg">
                    <defs><radialGradient id="glScan"><stop offset="0%" stop-color="var(--ip, #e8c477)" stop-opacity=".08"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>
                    <circle cx="70" cy="70" r="64" fill="url(#glScan)"/>
                    ${rings}${dots}
                    <circle cx="70" cy="70" r="2" class="radar-core"/>
                </svg>
                <div class="radar-legend"><span><i class="dot open"></i>埋设中</span><span><i class="dot warn"></i>${WARN_CHAPTERS}章未回收</span><span><i class="dot ok"></i>已回收</span></div>
            </div>
            ${warned.length ? `<div class="radar-warnbox">${warned.map((w) => `<div class="rw-line">⚠ <b>${esc(w.name)}</b> 已埋 ${w.age} 章未回收——考虑安排回收或明写放弃</div>`).join("")}</div>` : ""}` : '<div class="gl-empty">AI 登记伏笔后（+伏笔名 埋设），雷达自动追踪章龄</div>'}
        </div>`;
  }
  function rollUI() {
    var _a;
    const o = roll();
    const out = document.getElementById("glDiceOut");
    if (out) {
      out.innerHTML = `<b class="rolling">🎲🎲🎲</b>`;
      setTimeout(() => {
        out.innerHTML = `<b>「${esc(o.text)}」</b><i>骰 ${esc(o.dice)} = ${o.sum} · 下一轮生效</i>`;
      }, 420);
    }
    try {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "🎲 天机已批：" + o.text, "info");
    } catch (e) {
    }
    try {
      window.Celebration && window.Celebration.fire("dice");
    } catch (e) {
    }
  }
  const api = {
    onGenre(g) {
      genre = g || "free";
      load();
      return api;
    },
    onVars,
    panelHTML,
    rollUI,
    takeOracle,
    /** v3.16.0 界专属成就注册（js/world-seals.js 调用） */
    registerSeals,
    extCount() {
      return EXT.length;
    },
    /** 已解锁成就的展示标签（设定集导出用） */
    sealLabels() {
      return st.seals.map((id) => {
        const d = findDef(id);
        return d ? { icon: d.icon, name: d.name } : null;
      }).filter(Boolean);
    },
    /** 外部事件解锁（世界线/密谈等） */
    notify(evt) {
      if (evt === "worldline") unlock("worldline");
      refresh();
    },
    refresh() {
      const body = document.getElementById("immBody");
      if (body && window.ImmersiveSuite && ImmersiveSuite._tab === "dao") body.innerHTML = panelHTML();
    },
    resetAll() {
      try {
        localStorage.removeItem(KEY());
      } catch (e) {
      }
      Object.assign(st, { seals: [], diceCount: 0, lastRankRound: 0, oracle: null });
    }
  };
  return api;
}();
window.GameLayer = GameLayer;
