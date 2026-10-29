(function() {
  "use strict";
  const FROST_ZONES = [
    { max: -0.01, label: "灾变前夜", color: "#c8c06a", hint: "反常暖冬、极光新闻——只有先知在数日子" },
    { max: 9, label: "初寒 -10~-20℃", color: "#8ab4c8", hint: "抢购潮、堵车、第一场像样的雪" },
    { max: 19, label: "深寒 -20~-40℃", color: "#6fb8d8", hint: "停水停电、燃油变稠、冻毙者出现" },
    { max: 29, label: "极寒 -40~-60℃", color: "#4f8fd8", hint: "死城、物资见底、人性绞杀期" },
    { max: 39, label: "酷寒 -60~-89℃", color: "#7a8ad8", hint: "幸存者据点时代、异能者浮现" },
    { max: 100, label: "第二波伽马冲击 -150℃", color: "#b7a8e8", hint: "百年沉睡计划、新蓝星空间的时代" }
  ];
  const frostMod = {
    id: "frost",
    icon: "❄️",
    name: "寒潮监测站",
    tip: "气温断崖下跌阶段表——五十万光年外的超新星，正在给蓝星降温",
    contract: "气温（当前摄氏度数值，灾变前如实报正值，如 -38 或 12）；暴雪（无/小雪/大雪/白毛风）；供电（正常/间歇/中断）；供水（正常/中断）——每轮必报气温，其余有变必报",
    init: () => ({ temp: null, storm: "", power: "", water: "" }),
    /* v3.32.2 状态板摘要：❄️ -38℃ ·大雪·电间歇 */
    summary(s) {
      if (s.temp == null) return [];
      const tone = s.temp <= -40 ? "cold" : s.temp <= -20 ? "warn" : "ok";
      const bits = [s.storm || "无雪", s.power].filter(Boolean).join("·");
      return [{ i: "❄️", v: `${s.temp}℃`, l: bits, tone }];
    },
    read(s, vars, round) {
      let d = false;
      const raw = WXH.pick(vars, ["气温", "温度", "室外温度", "temp", "temperature"]);
      if (raw != null && raw !== "") {
        const m = String(raw).match(/-?\d+(\.\d+)?/);
        if (m) {
          const t = Number(m[0]);
          if (t !== s.temp) {
            s.temp = t;
            d = true;
          }
        }
      }
      const st = WXH.pick(vars, ["暴雪", "降雪", "风雪"]);
      if (st != null && String(st) !== s.storm) {
        s.storm = String(st);
        d = true;
      }
      const pw = WXH.pick(vars, ["供电", "电力", "电源"]);
      if (pw != null && String(pw) !== s.power) {
        s.power = String(pw);
        d = true;
      }
      const wt = WXH.pick(vars, ["供水", "自来水", "水源"]);
      if (wt != null && String(wt) !== s.water) {
        s.water = String(wt);
        d = true;
      }
      return d;
    },
    act(s, action, payload) {
      if (action !== "setTemp") return;
      const m = String(payload).match(/-?\d+(\.\d+)?/);
      if (!m) return "温度格式不对";
      s.temp = Number(m[0]);
      return `气温 → ${s.temp}℃`;
    },
    html(s) {
      const cold = Math.max(0, -(Number(s.temp) || 0));
      let z = FROST_ZONES[FROST_ZONES.length - 1];
      for (const t of FROST_ZONES) {
        if (cold <= t.max) {
          z = t;
          break;
        }
      }
      const tempBig = `<div style="display:flex;align-items:baseline;gap:6px;">
                <b style="font-size:30px;color:${z.color};font-variant-numeric:tabular-nums;">${s.temp == null ? "—" : s.temp}℃</b>
                <em style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);">室外气温</em></div>`;
      const infra = WXH.kv([
        ["风雪", s.storm || "—"],
        ["供电", s.power || "—"],
        ["供水", s.water || "—"]
      ]);
      return `${WXH.card("气温读数", tempBig, { icon: "🌡", tag: z.label })}
                ${WXH.card("阶段提示", `<div style="font-size:12px;color:${z.color};line-height:1.7;">${z.hint}</div>
                    <div class="wx-gauge-zones" style="margin-top:8px;">${FROST_ZONES.map((t) => `<span style="flex:1;background:${t.color};opacity:${t === z ? 1 : 0.28};" title="${t.label}"></span>`).join("")}</div>`, { icon: "📉" })}
                ${WXH.card("城市生命线", infra, { icon: "🔌" })}
                <div class="wx-slot">
                    <input type="text" placeholder="手动修正气温，如 -38" id="wxTempInput">
                    <button class="wx-btn" onclick="WorldExt.act('frost','setTemp',document.getElementById('wxTempInput').value)">记录</button>
                </div>`;
    },
    directive(s) {
      const cold = Math.max(0, -(Number(s.temp) || 0));
      if (s.temp == null) return `气温尚未登记——本轮 (variable_update) 务必上报气温数值（灾变前为正数，灾变后为负数）。`;
      if (cold >= 60) return `气温${s.temp}℃·第二波伽马冲击级酷寒：暴露即死，正文须体现呼吸结冰、机械失效、庇护所依存；百年沉睡计划与新蓝星空间的时代命题应浮上台面。`;
      if (cold >= 40) return `气温${s.temp}℃·酷寒：幸存者据点时代——物资、地盘与忠诚的角力是主线，异能者传闻可入戏。`;
      if (cold >= 20) return `气温${s.temp}℃·极寒：死城基调，冻毙细节、燃料焦虑与人性绞杀（前世死期级威胁）应持续供血。`;
      if (cold >= 10) return `气温${s.temp}℃·深寒：停电停水的城市余温期——抢购、疏散、邻里试探，末日正在换挡。`;
      if (cold > 0) return `气温${s.temp}℃·初寒：抢购潮与首批异象，正常生活与末日崩塌交替呈现。`;
      return `气温${s.temp}℃·灾变前夜：世界表面如常——反常暖冬、极光新闻、含糊的气象预报；先知的倒计时在走。`;
    }
  };
  const HAVEN_STAGES = [
    { key: "毛坯住宅", color: "#a8a8b0" },
    { key: "加固宅邸", color: "#8ab4c8" },
    { key: "末日堡垒", color: "#6fb8d8" },
    { key: "超级安全屋", color: "#4f9fd8" },
    { key: "末日方舟", color: "#8ad8e8" }
  ];
  const EE_RES = [
    { key: "食物", icon: "🍚", note: "米面粮油罐头——嘴上功夫" },
    { key: "燃料", icon: "⛽", note: "柴油木炭气罐——温度就是命" },
    { key: "钢材", icon: "🔩", note: "钢筋钢板螺栓——工事骨架" },
    { key: "药品", icon: "💊", note: "退烧药抗生素——硬通货" },
    { key: "保温材料", icon: "🧱", note: "岩棉泡沫板——留住热量" },
    { key: "弹药", icon: "🔫", note: "子弹与霰弹——最后的讲道理" }
  ];
  const EE_OPS = [
    {
      id: "armor_door",
      icon: "🚪",
      name: "装甲门窗",
      days: 1,
      desc: "更换主门、窗框与锁具，降低闯入和失温风险。",
      cost: { 钢材: 80, 保温材料: 20 },
      yield: { note: "完工后防线 +15" }
    },
    {
      id: "insulate3",
      icon: "🧱",
      name: "三层保温工程",
      days: 2,
      desc: "墙体、窗体、管线整体保温，减少每日供暖消耗。",
      cost: { 保温材料: 120, 燃料: 20 },
      yield: { note: "完工后燃料日耗 −40%" }
    },
    {
      id: "geo_heat",
      icon: "🔥",
      name: "地热供暖",
      days: 3,
      desc: "建立独立供暖回路，寒潮时保持室内生命线。",
      cost: { 钢材: 70, 燃料: 60 },
      yield: { note: "完工后室温稳定 22℃+" }
    },
    {
      id: "backup_power",
      icon: "⚡",
      name: "备用发电系统",
      days: 3,
      desc: "柴油机组+蓄电池，停电后维持关键设备。",
      cost: { 钢材: 90, 燃料: 100 },
      yield: { note: "完工后供电自持" }
    },
    {
      id: "water_purify",
      icon: "💧",
      name: "净水循环系统",
      days: 2,
      desc: "融雪净化与蓄水回路，摆脱自来水依赖。",
      cost: { 钢材: 50, 药品: 10 },
      yield: { note: "完工后日得净水 +6" }
    },
    {
      id: "granary",
      icon: "🌾",
      name: "分区粮仓",
      days: 2,
      desc: "冷藏分区与防潮管理，囤粮再不怕邻里窥探。",
      cost: { 钢材: 60, 保温材料: 40 },
      yield: { note: "完工后食物保鲜损耗减半" }
    },
    {
      id: "medical_room",
      icon: "🏥",
      name: "医疗室",
      days: 2,
      desc: "隔离区与手术台，住户伤病有了去处。",
      cost: { 药品: 40, 钢材: 30 },
      yield: { note: "完工后住户健康日回复 +2" }
    },
    {
      id: "watchtower",
      icon: "👁",
      name: "警戒塔与监控",
      days: 3,
      desc: "外墙高点+摄像头网，来犯者无所遁形。",
      cost: { 钢材: 110, 弹药: 10 },
      yield: { note: "完工后防线 +25、觊觎风险 −" }
    },
    {
      id: "secret_tunnel",
      icon: "🕳",
      name: "逃生暗道",
      days: 5,
      desc: "通向地下车库的暗道——末日堡垒的最后底牌。",
      cost: { 钢材: 150, 保温材料: 30 },
      yield: { note: "完工后解锁「撤离」选项" }
    }
  ];
  const EE_JOBS = [
    { key: "值守", icon: "🛡" },
    { key: "种植", icon: "🥬" },
    { key: "医护", icon: "💊" },
    { key: "维修", icon: "🔧" },
    { key: "伙食", icon: "🍜" },
    { key: "待业", icon: "💤" }
  ];
  const EE_ROOMS = ["主卧", "南次卧", "北次卧", "书房", "客厅地铺", "阁楼"];
  function eeAbsorb(vars) {
    let residents = null;
    const ru = vars.安全屋住户;
    if (ru && typeof ru === "object" && !Array.isArray(ru)) {
      residents = Object.entries(ru).map(([name, val]) => {
        if (val && typeof val === "object") {
          return { 姓名: name, 身份: val.身份 || val.role, 心情: val.心情, 健康: val.健康, 忠诚: val.忠诚, 分工: val.分工, 房间: val.房间 };
        }
        return { 姓名: name, 身份: String(val || "") };
      });
    } else if (Array.isArray(ru)) residents = ru;
    let res = null;
    const rv = vars.资源异动;
    if (rv && typeof rv === "object" && !Array.isArray(rv)) {
      res = {};
      Object.entries(rv).forEach(([k, v]) => {
        var _a;
        const n = Number((_a = String(v).match(/-?\d+(\.\d+)?/)) == null ? void 0 : _a[0]);
        if (Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(String(v).trim())) res[k] = Math.abs(n);
      });
      if (!Object.keys(res).length) res = null;
    }
    return { res, residents };
  }
  function eeWrap(action, payload, result, s) {
    var _a, _b;
    if (action === "eeStart" && result.ok) {
      const def = EE_OPS.find((o) => o.id === payload);
      if (def && ((_b = (_a = def.yield) == null ? void 0 : _a.note) == null ? void 0 : _b.includes("防线"))) s.defense = Math.min(100, (s.defense || 0) + 15);
    }
  }
  const havenMod = {
    id: "haven",
    icon: "🏠",
    name: "安全屋中控",
    tip: "毛坯住宅→末日方舟五级 + 资源账本 + 工程队列 + 住户名册——堡垒是一砖一瓦建成的",
    contract: "安全屋等级（毛坯住宅/加固宅邸/末日堡垒/超级安全屋/末日方舟，升级当轮必报）；室温（屋内摄氏度，如 23）；设施[]（已建成设施：供暖/发电/净水/防御/粮仓/医疗/暗道…）；防线（0-100）；安全屋住户[{姓名,身份,健康,心情,忠诚,分工,房间}]（有人入住/离开/状态显著变化当轮必报）；资源异动{食物:…,燃料:…,钢材:…,药品:…}（正文发生拾获/被窃/消耗时上报新科目，玩家已操作的扣减严禁改写）",
    init: () => ({ stage: "", temp: null, facilities: [], defense: 0, tab: "overview" }),
    /* v3.32.2 状态板摘要：🏠 加固宅邸 ·室温22℃·防线35（资源/工程/住户在第二行引擎区） */
    summary(s) {
      if (!s.stage && s.temp == null && !s.defense) return [];
      const tone = s.defense >= 60 ? "ok" : s.defense >= 30 ? "warn" : "bad";
      const label = (s.temp != null ? `室温${s.temp}℃·` : "") + `防线${s.defense}`;
      return [{ i: "🏠", v: s.stage || "毛坯住宅", l: label, tone }];
    },
    /* 实体引擎挂载点 */
    eeLedger: { defs: EE_RES, start: { 食物: 120, 燃料: 80, 钢材: 150, 药品: 30, 保温材料: 60, 弹药: 20 } },
    eeOps: EE_OPS,
    eeRooms: EE_ROOMS,
    eeJobs: EE_JOBS,
    eeCfg: { roundsPerDay: 3, daily: { 食物: -2, 燃料: -1 } },
    eeAbsorb,
    eeWrap,
    read(s, vars, round) {
      let d = false;
      const v = WXH.asObj(vars.安全屋 || vars.安全屋中控);
      const stg = v.等级 || WXH.pick(vars, ["安全屋等级", "安全屋"]);
      if (stg != null && String(stg) && String(stg) !== s.stage) {
        const hit = HAVEN_STAGES.find((x) => String(stg).includes(x.key));
        s.stage = hit ? hit.key : String(stg).slice(0, 12);
        d = true;
      }
      const rt = v.室温 || WXH.pick(vars, ["室温", "屋内温度"]);
      if (rt != null && rt !== "") {
        const m = String(rt).match(/-?\d+(\.\d+)?/);
        if (m) {
          const t = Number(m[0]);
          if (t !== s.temp) {
            s.temp = t;
            d = true;
          }
        }
      }
      WXH.asArr(v.设施 || vars.设施 || vars.安全屋设施).forEach((x) => {
        const nm = String(x).split(/[：:（(]/)[0].trim();
        if (nm && !s.facilities.includes(nm)) {
          s.facilities.push(nm);
          d = true;
        }
      });
      if (s.facilities.length > 16) s.facilities.length = 16;
      const df = v.防线 || WXH.pick(vars, ["防线", "防御完整度"]);
      if (df != null) {
        const n = WXH.asNum(df, s.defense);
        if (n !== s.defense) {
          s.defense = n;
          d = true;
        }
      }
      if (s.tab == null) {
        s.tab = "overview";
        d = true;
      }
      return d;
    },
    act(s, action, payload) {
      if (action === "nudge") {
        const n = Math.max(0, Math.min(100, s.defense + Number(payload)));
        if (n === s.defense) return "已在端点";
        s.defense = n;
        return `防线 → ${n}`;
      }
      if (action === "addFac") {
        const nm = String(payload || "").trim();
        if (!nm) return "设施名为空";
        if (s.facilities.includes(nm)) return "已有该设施";
        s.facilities.push(nm.slice(0, 12));
        return `+设施「${nm}」`;
      }
      if (action === "tab") {
        s.tab = String(payload);
        return null;
      }
    },
    html(s, h) {
      const ent = window.WorldExt && WorldExt.entState ? WorldExt.entState() : null;
      if (!ent || !window.EE) return havenLegacyHTML(s);
      const T = s.tab || "overview";
      const tabs = [
        ["overview", "📊 总览"],
        ["build", "🔨 建造"],
        ["residents", "👥 住户"],
        ["archive", "📋 档案"]
      ].map(([k, n]) => `<button class="ee-tab${T === k ? " on" : ""}" onclick="WorldExt.act('haven','tab','${k}')">${n}</button>`).join("");
      let body = "";
      if (T === "overview") body = havenOverview(s, ent);
      else if (T === "build") body = havenBuild(s, ent);
      else if (T === "residents") body = havenResidents(s, ent);
      else body = havenArchive(s, ent);
      return `<div class="ee-ops"><div class="ee-tabs">${tabs}</div>${body}</div>`;
    },
    directive(s) {
      const ent = window.WorldExt && WorldExt.entState ? WorldExt.entState() : null;
      const queueN = ent ? ent.projects.queue.length : 0;
      const resN = ent ? ent.residents.list.length : 0;
      if (!s.stage) return `安全屋尚未立项——引导玩家把"住"提到日程上（加固门窗、囤燃料、控制灯光外泄），等级从「毛坯住宅」起步上报。`;
      if (s.defense < 30) return `安全屋「${s.stage}」防线${s.defense}·形同虚设：邻里窥探或试探性闯入的风险该具象化了——敲门声、脚印、业主群里的试探都是前奏。`;
      let extra = "";
      if (queueN) extra += `在建工程 ${queueN} 项——施工的动静与消耗是正文素材；`;
      if (resN) extra += `安全屋住着 ${resN} 人——柴米油盐与人心向背都该入戏；`;
      if (s.defense >= 60) return `安全屋「${s.stage}」防线${s.defense}·工事扎实：屋内恒温与屋外酷寒应持续对照书写；树大招风，高防线也意味着高价值目标。${extra}住户的忠诚与觊觎者的动向同样值得着墨。`;
      return `安全屋「${s.stage}」防线${s.defense}：可承一般性窥探，但扛不住有组织来犯——升级工事或建立外围警戒须提上日程。${extra}`;
    }
  };
  function havenOverview(s, ent) {
    const idx = HAVEN_STAGES.findIndex((x) => x.key === s.stage);
    const stepper = `<div class="wx-stepper">${HAVEN_STAGES.map((t, i) => `<div class="wx-step${i === idx ? " on" : idx >= 0 && i < idx ? " done" : ""}" title="${t.key}">${t.key.slice(0, 4)}</div>`).join("")}</div>`;
    const queueN = ent.projects.queue.length;
    const resN = ent.residents.list.length;
    const beds = EE_ROOMS.length;
    const risky = ent.residents.list.filter((u) => u.loyalty < 40).length;
    return `${EE.Ledger.html(ent, EE_RES)}
            ${WXH.card("等级升降梯", stepper, { icon: "🏗", tag: s.stage || "未开工" })}
            <div class="wx-grid">
                ${WXH.card("室温", `<div style="display:flex;align-items:baseline;gap:8px;">
                    <b style="font-size:24px;color:#e8a04c;font-variant-numeric:tabular-nums;">${s.temp == null ? "—" : s.temp}℃</b>
                    <em style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);">${s.temp != null && s.temp >= 18 ? "堡垒之内，末世之外" : ""}</em></div>`, { icon: "🔥" })}
                ${WXH.card("防线完整度", WXH.bar(s.defense, "#d8a04c", s.defense), { icon: "🛡", tag: s.defense >= 80 ? "固若金汤" : s.defense >= 50 ? "堪一击" : "形同虚设" })}
            </div>
            ${WXH.card("运转概况", EE.esc(`🔨 施工队列 ${queueN}/${EE.MAX_QUEUE} 项 · 🛏 住户 ${resN}/${beds} 床${risky ? ` · ⚠ ${risky} 人忠诚偏低` : ""}`), { icon: "📋" })}
            ${ent.projects.queue.length ? WXH.card("在建工程", EE.Projects.queueHTML(ent), { icon: "🏗" }) : ""}
            ${EE.Ops.html(ent, "haven")}
            ${WXH.card("事件时间线", EE.timelineHTML(ent) || '<div class="ee-empty">大事小情都会记在这条线上</div>', { icon: "📖" })}`;
  }
  function havenBuild(s, ent) {
    return `${EE.Ledger.html(ent, EE_RES)}
            <div class="ee-tip">🔨 选择工程 · 资源不足会禁止开工 · 施工队列 ${ent.projects.queue.length}/${EE.MAX_QUEUE}<br>点「规划开工」即刻扣料入队（不等 AI 回话）；完工结算发生在跨天时刻</div>
            ${ent.projects.queue.length ? `<div class="ee-queue-hd">在建（${ent.projects.queue.length}）</div>${EE.Projects.queueHTML(ent)}` : ""}
            <div class="ee-queue-hd">可选工程（${EE_OPS.length}）</div>
            ${EE.Projects.listHTML(ent, EE_OPS, "haven")}
            ${EE.Ops.html(ent, "haven")}`;
  }
  function havenResidents(s, ent) {
    return `${EE.Residents.html(ent, { rooms: EE_ROOMS, jobs: EE_JOBS })}
            <div class="wx-slot">
                <input type="text" placeholder="手动登记：姓名=身份，如 刘阿姨=小区楼长" id="eeResInput">
                <button class="wx-btn" onclick="WorldExt.act('haven','eeAddResident',document.getElementById('eeResInput').value)">入住</button>
            </div>
            <div class="wx-banner">收留要有算计：一张嘴一份口粮，一双手一份劳力，一颗心一份变数——善良是死因，但人心也是防线。</div>`;
  }
  function havenArchive(s, ent) {
    return `${WXH.card("物资明细账", EE.Ledger.flowHTML(ent), { icon: "💰", tag: `${ent.ledger.flow.length} 条流水` })}
            ${ent.projects.done.length ? WXH.card("工程履历", EE.Projects.historyHTML(ent), { icon: "🏗" }) : ""}
            ${WXH.card("资源手动入账", `<div class="wx-slot" style="margin:0;">
                <input type="text" placeholder="补账：钢材=50（负数填-）" id="eeLedgerInput">
                <button class="wx-btn" onclick="WorldExt.act('haven','eeAddRes',document.getElementById('eeLedgerInput').value)">入账</button></div>`, { icon: "✍" })}`;
  }
  function havenLegacyHTML(s) {
    const idx = HAVEN_STAGES.findIndex((x) => x.key === s.stage);
    const stepper = `<div class="wx-stepper">${HAVEN_STAGES.map((t, i) => `<div class="wx-step${i === idx ? " on" : idx >= 0 && i < idx ? " done" : ""}" title="${t.key}">${t.key.slice(0, 4)}</div>`).join("")}</div>`;
    const facChips = s.facilities.length ? `<div class="wx-chips">${s.facilities.map((f) => `<i style="--wc:#6fb8d8;">${WXH.esc(f)}</i>`).join("")}</div>` : WXH.empty("🧱", "尚无设施", "供暖/发电/净水/防御/粮仓……随改造逐一点亮");
    return `${WXH.card("等级升降梯", stepper, { icon: "🏗", tag: s.stage || "未开工" })}
            ${WXH.card("室温", `<div style="display:flex;align-items:baseline;gap:8px;"><b style="font-size:24px;color:#e8a04c;">${s.temp == null ? "—" : s.temp}℃</b><em style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);">屋内室温</em></div>`, { icon: "🔥" })}
            ${WXH.card("设施清单", facChips, { icon: "🧰", tag: s.facilities.length ? `${s.facilities.length} 项` : "" })}
            ${WXH.card("防线完整度", WXH.bar(s.defense, "#d8a04c", s.defense), { icon: "🛡" })}`;
  }
  const VOID_CATS = [
    { key: "食品", icon: "🍚", color: "#e0a04c" },
    { key: "燃料", icon: "⛽", color: "#d89030" },
    { key: "药品", icon: "💊", color: "#7ec8a0" },
    { key: "武器弹药", icon: "🔫", color: "#e07856" },
    { key: "工具器材", icon: "🔧", color: "#6fb8d8" },
    { key: "其他", icon: "📦", color: "#a8a8c0" }
  ];
  const voidMod = {
    id: "void",
    icon: "📦",
    name: "无限空间",
    tip: "识海里的黑暗虚空——意念收放万物，容量随使用成长，终点是新蓝星",
    contract: "空间容量（当前等级：初开虚空/百方/千方/万方/新蓝星…）；空间物资{食品:…,燃料:…,药品:…,武器弹药:…,工具器材:…,其他:…}（大类+量级，如 食品：米面三十吨、罐头两千箱）；空间异动（进化征兆：活物入眠、时间凝滞、边际拓宽……）",
    init: () => ({ capacity: "", stock: [], signs: [] }),
    /* v3.32.2 状态板摘要：📦 千方 ·32类物资（新蓝星级点亮 ok 色） */
    summary(s) {
      if (!s.capacity && !s.stock.length) return [];
      const cap = s.capacity || "初开虚空";
      const tone = cap.includes("新蓝星") ? "ok" : s.signs.length ? "warn" : "";
      return [{ i: "📦", v: cap, l: s.stock.length ? `${s.stock.length}类物资` : "", tone }];
    },
    read(s, vars, round) {
      let d = false;
      const v = WXH.asObj(vars.空间 || vars.无限空间 || vars.异能空间);
      const cap = v.容量 || v.容量等级 || WXH.pick(vars, ["空间容量", "空间等级"]);
      if (cap != null && String(cap) && String(cap) !== s.capacity) {
        s.capacity = String(cap).slice(0, 14);
        d = true;
      }
      const rawStock = v.物资 || v.空间物资 || vars.空间物资;
      if (rawStock && typeof rawStock === "object" && !Array.isArray(rawStock)) {
        Object.entries(rawStock).forEach(([k, val]) => {
          if (!val || val === "") return;
          const cat = VOID_CATS.find((c) => k.includes(c.key) || String(val).includes(c.key));
          const nm = String(k).slice(0, 16), note = String(val).slice(0, 40);
          if (!s.stock.some((u) => u.name === nm)) {
            s.stock.push({ name: nm, cat: cat ? cat.key : "其他", note, round });
            d = true;
          }
        });
      }
      WXH.asArr(WXH.pick(vars, ["空间异动", "空间进化"])).forEach((x) => {
        const nm = String(x).slice(0, 40);
        if (nm && !s.signs.includes(nm)) {
          s.signs.push(nm);
          d = true;
        }
      });
      if (s.stock.length > 30) s.stock.length = 30;
      if (s.signs.length > 8) s.signs.length = 8;
      return d;
    },
    act(s, action, payload) {
      if (action !== "addStock") return;
      const raw = String(payload || "").trim();
      if (!raw) return "格式：名称=明细，如 食品=米面三十吨";
      const [nm, note] = raw.split(/[=＝]/);
      const cat = VOID_CATS.find((c) => (nm || "").includes(c.key));
      const name = (nm || "").trim().slice(0, 16);
      if (!name) return "名称为空";
      if (s.stock.some((u) => u.name === name)) return "已入账";
      s.stock.push({ name, cat: cat ? cat.key : "其他", note: (note || "").trim().slice(0, 40), round: 0 });
      return `+空间入账「${name}」`;
    },
    html(s) {
      const byCat = VOID_CATS.map((c) => {
        const list = s.stock.filter((u) => u.cat === c.key);
        if (!list.length) return "";
        return WXH.card(`${c.icon} ${c.key} · ${list.length}`, list.map((u) => `<div class="wx-kv"><span>${u.round ? "第" + u.round + "回" : "手工"}</span><b>${WXH.esc(u.name)}${u.note ? ` <i style="font-style:normal;opacity:.6;font-size:11px;">${WXH.esc(u.note)}</i>` : ""}</b></div>`).join(""), {});
      }).join("");
      const signCard = s.signs.length ? WXH.card("空间异动", `<div class="wx-tip" style="margin:0;">${s.signs.map((x) => "· " + WXH.esc(x)).join("<br>")}</div>`, { icon: "🌀", tag: "进化征兆" }) : "";
      return `${WXH.card("当前容量", `<b style="font-size:16px;color:#b7a8e8;">${WXH.esc(s.capacity || "初开虚空（尚未登记）")}</b>
                <div class="wx-tip" style="margin:6px 0 0;">意念所至，收放随心——藏得住的底牌，才是真底牌</div>`, { icon: "🕳" })}
                ${byCat || WXH.empty("📦", "虚空空空如也", "随囤货入账自动归档——大类+量级，如：食品=米面三十吨")}
                ${signCard}
                <div class="wx-slot">
                    <input type="text" placeholder="手工入账：食品=米面三十吨" id="wxVoidInput">
                    <button class="wx-btn" onclick="WorldExt.act('void','addStock',document.getElementById('wxVoidInput').value)">入账</button>
                </div>`;
    },
    directive(s) {
      if (!s.capacity) return `空间异能已醒但容量未登记——本轮上报空间容量等级（初开虚空起步），大额收放须写出意念发动的细节与疲惫感。`;
      if (s.capacity.includes("新蓝星")) return `空间已进化至「${s.capacity}」——第二蓝星的尺度：山川、水域、生机的命题该进入正文；百年沉睡计划的容器已经就位。`;
      return `空间容量「${s.capacity}」：收放物体随容量限额走；异能是最大的底牌——目击者、异动痕迹都是暴露风险，藏得住才用得久。`;
    }
  };
  const oracleMod = {
    id: "oracle",
    icon: "⏳",
    name: "先知簿",
    tip: '重生者的前世记忆——灾变时间表、物资点位、仇人名单；还有那些"提前了六个小时"的变数',
    contract: "先知记忆[{事件,日期}]（本轮记起或兑现的前世情报，如：{事件:寒潮降临,日期:12月14日}）；仇人动态[]（前世仇人此刻的动向）；记忆偏差（现实与前世不同之处——时间提前/人物错位/新增变数）",
    init: () => ({ memories: [], foes: [], drift: "" }),
    /* v3.32.2 状态板摘要：⏳ 6 前世记忆 ·🗡 3 仇敌（记忆偏差亮 warn） */
    summary(s) {
      if (!s.memories.length && !s.foes.length) return [];
      const items = [];
      if (s.memories.length) items.push({ i: "⏳", v: String(s.memories.length), l: "前世记忆" + (s.drift ? "·有偏差" : ""), tone: s.drift ? "warn" : "" });
      if (s.foes.length) items.push({ i: "🗡", v: String(s.foes.length), l: "仇敌", tone: "bad" });
      return items;
    },
    read(s, vars, round) {
      let d = false;
      const v = WXH.asObj(vars.先知簿 || vars.先知记忆);
      const rawMem = v.记忆 || v.先知记忆 || vars.先知记忆;
      WXH.asArr(rawMem).forEach((x) => {
        if (typeof x === "object" && x) {
          const nm = String(x.事件 || x.name || x.title || "").slice(0, 20);
          const note = String(x.日期 || x.date || x.note || "").slice(0, 16);
          if (nm && !s.memories.some((u) => u.name === nm)) {
            s.memories.push({ name: nm, note, round });
            d = true;
          }
        } else {
          const nm = String(x).split(/[：:（(]/)[0].trim().slice(0, 20);
          if (nm && !s.memories.some((u) => u.name === nm)) {
            s.memories.push({ name: nm, note: "", round });
            d = true;
          }
        }
      });
      WXH.asArr(v.仇人动态 || vars.仇人动态).forEach((x) => {
        const nm = String(x).split(/[：:（(]/)[0].trim();
        if (nm && !s.foes.some((u) => u.name === nm)) {
          s.foes.push({ name: nm, note: String(x).includes("：") ? String(x).split("：")[1].slice(0, 30) : "", round });
          d = true;
        }
      });
      if (s.memories.length > 24) s.memories.length = 24;
      if (s.foes.length > 10) s.foes.length = 10;
      const dr = v.记忆偏差 || WXH.pick(vars, ["记忆偏差", "时间偏差"]);
      if (dr != null && String(dr) && String(dr) !== s.drift) {
        s.drift = String(dr).slice(0, 60);
        d = true;
      }
      return d;
    },
    act(s, action, payload) {
      if (action !== "addMem") return;
      const raw = String(payload || "").trim();
      if (!raw) return "格式：事件=日期，如 寒潮降临=12月14日";
      const [nm, note] = raw.split(/[=＝]/);
      const name = (nm || "").trim().slice(0, 20);
      if (!name) return "事件名为空";
      if (s.memories.some((u) => u.name === name)) return "已记录";
      s.memories.push({ name, note: (note || "").trim().slice(0, 16), round: 0 });
      return `+先知记忆「${name}」`;
    },
    html(s) {
      const memCard = s.memories.length ? WXH.card("前世记忆 · " + s.memories.length, s.memories.map((u) => `<div class="wx-kv"><span>${u.note || (u.round ? "第" + u.round + "回" : "—")}</span><b>${WXH.esc(u.name)}</b></div>`).join(""), { icon: "📖" }) : WXH.empty("⏳", "前尘封在死亡的痛楚里", "随剧情记起的前世情报自动归档——时间表、点位、人心，都是先知的本钱");
      const foeCard = s.foes.length ? WXH.card("仇人动态", s.foes.map((u) => `<div class="wx-kv"><span>${u.round ? "第" + u.round + "回" : "—"}</span><b>${WXH.esc(u.name)}${u.note ? `（${WXH.esc(u.note)}）` : ""}</b></div>`).join(""), { icon: "🗡" }) : "";
      const driftCard = s.drift ? WXH.card("记忆偏差", `<div class="wx-banner" style="margin:0;">⚠ ${WXH.esc(s.drift)}<br><small style="opacity:.7;">先知的优势在方向，不在秒表——变数即风险，也是机会</small></div>`, { icon: "🌀" }) : "";
      return `${memCard}${foeCard}${driftCard}
                <div class="wx-slot">
                    <input type="text" placeholder="补录记忆：寒潮降临=12月14日" id="wxOracleInput">
                    <button class="wx-btn" onclick="WorldExt.act('oracle','addMem',document.getElementById('wxOracleInput').value)">补录</button>
                </div>`;
    },
    directive(s) {
      if (s.drift) return `记忆偏差已现（${s.drift}）：本轮须让这处变数发酵——提前的霜冻、错位的人物，逼迫玩家临场应变，先知优势打折。`;
      if (s.memories.length) return `先知簿已录 ${s.memories.length} 条：兑现记忆时写出信息差带来的先手（抢在抢购潮前、断贷前、翻脸前）；同时让世界保留"提前六小时"式的变数余地。`;
      return `重生者的前世记忆尚未展开——开场应落实至少一条核心记忆（灾变日期或仇人面目），这是本界先知玩法的引擎。`;
    }
  };
  const ORDER_ZONES = [
    { max: 19, label: "豺狼当道", color: "#e07070" },
    { max: 39, label: "秩序崩解", color: "#e08858" },
    { max: 59, label: "人心浮动", color: "#e0a84c" },
    { max: 79, label: "强撑体面", color: "#c8c06a" },
    { max: 100, label: "末日前夜", color: "#8fd9a8" }
  ];
  const neighborMod = {
    id: "neighbor",
    icon: "🚪",
    name: "邻里罗盘",
    tip: "善良是死因，敲门声是倒计时——谁在打探、谁在求助、谁在磨刀",
    contract: "邻里动态[]（谁在打探/求助/结盟及动向）；觊觎者[]（对玩家物资起意的人及其算盘）；小区秩序（0-100：越高越安定，崩解时豺狼出笼）",
    init: () => ({ moves: [], coveters: [], order: 70 }),
    /* v3.32.2 状态板摘要：🚪 秩序 42 ·觊觎2人（崩解区亮红） */
    summary(s) {
      const tone = s.order <= 39 ? "bad" : s.order <= 59 ? "warn" : "ok";
      const l = s.coveters.length ? `觊觎${s.coveters.length}人` : s.moves.length ? `${s.moves.length}起动态` : "秩序";
      return [{ i: "🚪", v: String(s.order), l, tone }];
    },
    read(s, vars, round) {
      let d = false;
      const v = WXH.asObj(vars.邻里罗盘 || vars.邻里);
      WXH.asArr(v.动态 || v.邻里动态 || vars.邻里动态).forEach((x) => {
        const nm = String(x).split(/[：:（(]/)[0].trim();
        if (nm && !s.moves.some((u) => u.name === nm)) {
          s.moves.push({ name: nm, note: String(x).includes("：") ? String(x).split("：")[1].slice(0, 30) : "", round });
          d = true;
        }
      });
      WXH.asArr(v.觊觎者 || vars.觊觎者).forEach((x) => {
        const nm = String(x).split(/[：:（(]/)[0].trim();
        if (nm && !s.coveters.some((u) => u.name === nm)) {
          s.coveters.push({ name: nm, note: String(x).includes("：") ? String(x).split("：")[1].slice(0, 30) : "", round });
          d = true;
        }
      });
      if (s.moves.length > 12) s.moves.length = 12;
      if (s.coveters.length > 8) s.coveters.length = 8;
      const od = v.小区秩序 || WXH.pick(vars, ["小区秩序", "社区秩序"]);
      if (od != null) {
        const n = WXH.asNum(od, s.order);
        if (n !== s.order) {
          s.order = n;
          d = true;
        }
      }
      return d;
    },
    act(s, action, payload) {
      if (action === "nudge") {
        const n = Math.max(0, Math.min(100, s.order + Number(payload)));
        if (n === s.order) return "已在端点";
        s.order = n;
        return `小区秩序 → ${n}`;
      }
    },
    html(s) {
      const g = WXH.gauge(100 - s.order, ORDER_ZONES.map((z2) => ({ ...z2, max: 100 - (100 - z2.max) })));
      const z = g.zone;
      const movesCard = s.moves.length ? WXH.card("邻里动态", s.moves.map((u) => `<div class="wx-kv"><span>${u.round ? "第" + u.round + "回" : "—"}</span><b>${WXH.esc(u.name)}${u.note ? `（${WXH.esc(u.note)}）` : ""}</b></div>`).join(""), { icon: "👥" }) : "";
      const covCard = s.coveters.length ? WXH.card("觊觎者名单", s.coveters.map((u) => `<div class="wx-kv"><span>${u.round ? "第" + u.round + "回" : "—"}</span><b style="color:#e0a0a0;">${WXH.esc(u.name)}${u.note ? `（${WXH.esc(u.note)}）` : ""}</b></div>`).join(""), { icon: "👁", tag: "盯上你了" }) : "";
      return `${WXH.card("小区秩序", WXH.gauge(s.order, [
        { max: 19, label: "豺狼当道", color: "#e07070" },
        { max: 39, label: "秩序崩解", color: "#e08858" },
        { max: 59, label: "人心浮动", color: "#e0a84c" },
        { max: 79, label: "强撑体面", color: "#c8c06a" },
        { max: 100, label: "末日前夜", color: "#8fd9a8" }
      ]).html, { icon: "🏘", tag: z.label })}
                ${movesCard}${covCard}
                <div class="wx-slot">
                    <button class="wx-btn" onclick="WorldExt.act('neighbor','nudge',-10)">秩序 −10</button>
                    <button class="wx-btn" onclick="WorldExt.act('neighbor','nudge',10)">秩序 +10</button>
                    <small style="font-size:10.5px;color:var(--imt,#9a8c6e);">手动干预</small>
                </div>
                <div class="wx-banner">上辈子就是这样的敲门声要了张奕的命——施舍要有算计，开门要有戒备；真好人（尤大叔式）要认得，白眼狼更要认得。</div>`;
    },
    directive(s) {
      if (s.coveters.length >= 3) return `觊觎者已${s.coveters.length}人（${s.coveters.map((u) => u.name).slice(0, 3).join("、")}）：围攻的前奏该来了——试探、串联、里应外合步步推进，"强攻安全屋"式的危机须有铺垫有逻辑。`;
      if (s.order <= 39) return `小区秩序${s.order}·崩解：豺狼逻辑当道——敲门、撬锁、明抢按概率入戏；玩家的每一次露富都在喂养风险。`;
      if (s.order <= 59) return `小区秩序${s.order}·人心浮动：邻里在试探底线（借粮、打探、抱团排外），施舍与拒绝都各有后果。`;
      return `小区秩序${s.order}·尚存体面：末日的门面还撑着——业主群、物业、邻里寒暄照常运转，暗流在水面下走。`;
    }
  };
  if (window.WorldExt) WorldExt.define("quanqiubingfeng", [frostMod, havenMod, voidMod, oracleMod, neighborMod]);
})();
