const StoryStatusRenderer = {
  /** v3.55.4 分区签名缓存：每轮 refresh 会对各区全量重建 innerHTML，
   *  但多数轮次只有个别区变化（如只涨字数、角色区/道具区纹丝不动）。
   *  每个分区按输入数据算签名，未变即跳过重建——低配设备省去大段 DOM 解析与重排。
   *  面板骨架重建（generatePanelHTML）时清空签名，强制全量重绘。 */
  _sig: {},
  _same(name, payload) {
    try {
      const s = JSON.stringify(payload);
      if (this._sig[name] === s) return true;
      this._sig[name] = s;
    } catch (e) { /* 签名失败不缓存，下轮照常重绘 */ }
    return false;
  },
  /** 生成面板骨架 HTML（onInit 时插入 #statusPanelContainer）
   *  v3.30.0：面板标题与各分区标题可由 config.panelLabels 覆盖（地球等扮演
   *  界换"人生面板"皮肤）；spacetimePanel/ledgerPanel 开关追加时空坐标与账本
   *  两个生活化分区（渲染器 refresh 同名接线，其他界零变化）。 */
  generatePanelHTML() {
    this._sig = {};
    const fw = window.storyFramework;
    const g = fw.config.genreName || "创作";
    const pl = fw.config.panelLabels || {};
    const gauges = fw.config.gauges || [];
    const gaugeHTML = gauges.map((gg) => `
            <div class="gauge-row">
                <span class="gauge-label">${gg.icon || "◈"} ${gg.label}</span>
                <div class="gauge-bar"><div class="gauge-fill" id="gauge_${gg.key}" style="background:${gg.color || "var(--primary)"}; width:0%"></div></div>
                <span class="gauge-num" id="gaugeNum_${gg.key}">0</span>
            </div>`).join("");
    const spacetimeHTML = fw.config.spacetimePanel ? `
            <div class="panel-section">
                <div class="section-title">🧭 ${pl.spacetime || "时空坐标"}</div>
                <div id="spacetimeArea"><div class="empty-hint">入场后自动校准（时代/日期/所在/时刻/天象）</div></div>
            </div>` : "";
    const ledgerHTML = fw.config.ledgerPanel ? `
            <div class="panel-section">
                <div class="section-title">💰 ${pl.ledger || "账本"}</div>
                <div id="ledgerArea"><div class="empty-hint">开篇后按实况记账（现金/存款/收入/支出）</div></div>
            </div>` : "";
    return `
        <div class="panel status-panel">
            <div class="panel-header">
                <span class="panel-title">${pl.panelTitle || `📖 ${g} · 状态面板`}</span>
            </div>

            ${spacetimeHTML}

            <div class="panel-section">
                <div class="section-title">▤ ${pl.progress || "章节进度"}</div>
                <div class="progress-wrap">
                    <div class="progress-bar"><div class="progress-fill" id="chapterProgress"></div></div>
                    <div class="progress-text"><span id="chapterText">${pl.notStarted || "未开篇"}</span> · <span id="wordCountText">0 字</span></div>
                </div>
                <div class="book-title-line" id="bookTitleLine"></div>
            </div>

            <div class="panel-section">
                <div class="section-title">◈ ${pl.gauges || "叙事仪表盘"}</div>
                ${gaugeHTML || '<div class="empty-hint">本类型未定义仪表盘</div>'}
            </div>

            ${ledgerHTML}

            <div class="panel-section">
                <div class="section-title">✦ ${pl.stats || "创作六维"}</div>
                <div id="statsArea"></div>
            </div>

            <div class="panel-section">
                <div class="section-title">👤 ${pl.characters || "角色档案"}</div>
                <div id="charactersArea"><div class="empty-hint">尚无角色登场</div></div>
            </div>

            <div class="panel-section">
                <div class="section-title">🧵 ${pl.foreshadow || "伏笔清单"}</div>
                <div id="foreshadowArea"><div class="empty-hint">尚无伏笔登记</div></div>
            </div>

            <div class="panel-section">
                <div class="section-title">🎒 ${pl.items || "关键道具"}</div>
                <div id="itemsArea"><div class="empty-hint">尚无关键道具</div></div>
            </div>

            <div class="panel-section">
                <div class="section-title">📜 ${pl.history || "大事记"}</div>
                <div id="historyArea"><div class="empty-hint">故事尚未开始</div></div>
            </div>

            <div class="panel-section">
                <div class="section-title">📊 ${pl.token || "用量速览"}</div>
                <div id="tokenArea"><div class="empty-hint">开篇后按请求累计</div></div>
            </div>
        </div>`;
  },
  /** 每轮刷新（对应原框架 renderStatusPanel） */
  refresh(vars) {
    var _a;
    const v = vars || {};
    const fw = window.storyFramework;
    const pl = fw.config.panelLabels || {};
    const total = v.totalChapters || ((_a = fw.storyState.setup) == null ? void 0 : _a.totalChapters) || 10;
    const cur = v.chapter || 0;
    const pct = Math.min(100, Math.round(cur / Math.max(1, total) * 100));
    const prog = document.getElementById("chapterProgress");
    if (prog) prog.style.width = pct + "%";
    const chapterText = document.getElementById("chapterText");
    if (chapterText) chapterText.textContent = cur > 0 ? `第 ${cur}/${total} ${pl.unit || "章"}（${pct}%）` : pl.notStarted || "未开篇";
    const wordCountText = document.getElementById("wordCountText");
    if (wordCountText) wordCountText.textContent = `${v.wordCount || 0} 字`;
    const bookTitle = document.getElementById("bookTitleLine");
    if (bookTitle) bookTitle.textContent = v.title ? `《${v.title}》` : "";
    (fw.config.gauges || []).forEach((g) => {
      const fill = document.getElementById("gauge_" + g.key);
      const num = document.getElementById("gaugeNum_" + g.key);
      const val = typeof v[g.key] === "number" ? Math.max(0, Math.min(100, v[g.key])) : g.default || 50;
      if (fill) fill.style.width = val + "%";
      if (num) num.textContent = val;
    });
    this.renderSpacetime(v);
    this.renderLedger(v);
    this.renderStats(v.stats && typeof v.stats === "object" && !Array.isArray(v.stats) ? v.stats : {});
    const asArr = (x) => Array.isArray(x) ? x : [];
    this.renderCharacters(v.characters && typeof v.characters === "object" && !Array.isArray(v.characters) ? v.characters : {});
    this.renderForeshadowings(asArr(v.foreshadowings));
    this.renderItems(asArr(v.items));
    this.renderHistory(asArr(v.history));
    this.renderTokenUsage();
  },
  /**
   * Token 用量速览（v1.6.9 T2-⑩）
   * 最近一次主笔请求的上下文体量（系统层 / 历史层分计）+ 全书累计。
   * 数据由 window.TokenUsage 在三接口请求路径上记账，随存档持久化。
   */
  renderTokenUsage() {
    const area = document.getElementById("tokenArea");
    if (!area) return;
    const TU = window.TokenUsage;
    if (!TU) {
      if (this._same("token", "no-tu")) return;
      area.innerHTML = "";
      return;
    }
    const tu = TU.get();
    if (!tu || !tu.total || !tu.total.requests) {
      if (this._same("token", "empty")) return;
      area.innerHTML = '<div class="empty-hint">开篇后按请求累计</div>';
      return;
    }
    if (this._same("token", tu)) return;
    const F = (n) => TU.fmt(n);
    const last = tu.last;
    const lastLine = last ? `<div class="token-line">最近请求（${this.esc(last.tag)}）：输入 ≈<b>${F(last.inTok)}</b> tok（系统 ${F(last.sysTok)} + 历史 ${F(last.histTok)}）${last.outTok ? ` · 输出 ≈${F(last.outTok)}` : ""}</div>` : "";
    const tagParts = Object.entries(tu.byTag || {}).map(([k, v]) => `${this.esc(k)}×${v.requests}（入${F(v.inTok)}${v.outTok ? `/出${F(v.outTok)}` : ""}）`);
    area.innerHTML = `
            ${lastLine}
            <div class="token-line">全书累计：输入 ≈<b>${F(tu.total.inTok)}</b> · 输出 ≈<b>${F(tu.total.outTok)}</b> tok · ${tu.total.requests} 次请求</div>
            ${tagParts.length ? `<div class="token-line token-dim">${tagParts.join("　")}</div>` : ""}
            <div class="token-note">按中文 1 token ≈ 1.6 字估算，仅供体量参考</div>`;
  },
  /* ==================== v3.30.0 时空坐标 + 账本（面板地球化分区） ====================
   * 用户痛点：「这个状态栏不够地球化」——主状态面板此前只有小说概念分区（伏笔/
   * 道具/创作六维），生活模拟的核心数据（现在哪年哪月、身在何处、兜里几文）只能
   * 去扩展浮窗里翻。现直接进主面板：config.spacetimePanel/ledgerPanel 开关启用，
   * 数据读变量（era/date/location/time/weather、cash/savings/income/expense/
   * assets——地球协议每轮必报），位置/时刻/天象缺报时退舞台快照（SceneState）补位。 */
  /** 时空坐标：时代/日期/所在/时刻/天象（变量优先，舞台快照补位） */
  renderSpacetime(v) {
    const area = document.getElementById("spacetimeArea");
    if (!area) return;
    const SS = window.SceneState;
    const ss = SS && SS.hasData && SS.hasData() ? SS.snap() : {};
    const pick1 = (a, b) => a != null && String(a).trim() ? String(a).trim() : b || "";
    const chips = [
      ["🕰", "时代", pick1(v.era, "")],
      ["📅", "日期", pick1(v.date, "")],
      ["📍", "所在", pick1(v.location, ss.place)],
      ["🕐", "时刻", pick1(v.time, ss.time)],
      ["☁", "天象", pick1(v.weather, ss.weather)]
    ].filter((c) => c[2]);
    if (this._same("spacetime", chips)) return;
    area.innerHTML = chips.length ? `<div class="spacetime-grid">${chips.map((c) => `<span class="spacetime-chip">${c[0]} <i>${c[1]}</i><b>${this.esc(String(c[2]).slice(0, 26))}</b></span>`).join("")}</div>` : '<div class="empty-hint">入场后自动校准（时代/日期/所在/时刻/天象）</div>';
  },
  /** 账本：现金/存款/收入/支出/家当（货币单位随时代，字符串原样展示） */
  renderLedger(v) {
    const area = document.getElementById("ledgerArea");
    if (!area) return;
    const row = (label, x, cls) => {
      if (x == null || String(x).trim() === "") return "";
      return `<div class="acct-row"><span class="acct-label">${label}</span><span class="acct-val${cls ? " " + cls : ""}">${this.esc(String(x).slice(0, 42))}</span></div>`;
    };
    const html = [
      row("💸 随身现金", v.cash),
      row("🏦 存款积蓄", v.savings),
      row("📈 进项来源", v.income, "in"),
      row("📉 近期支出", v.expense, "out"),
      row("🎒 家当", v.assets)
    ].join("");
    if (this._same("ledger", html)) return;
    area.innerHTML = html || '<div class="empty-hint">开篇后按实况记账（现金/存款/收入/支出）</div>';
  },
  renderStats(stats) {
    const area = document.getElementById("statsArea");
    if (!area) return;
    const fw = window.storyFramework;
    const keys = Object.keys(stats);
    /* v3.55.26 天赋行（属性引擎状态：名称/档位/暴露） */
    let talentHTML = "";
    const t = fw && fw.storyState && fw.storyState.variables && fw.storyState.variables.talent;
    if (t && (t.name || t.tier)) {
      const tTier = t.tier || "待定档";
      const tExp = t.exposure === "exposed" ? "已暴露" : "隐藏中";
      const tCls = t.exposure === "exposed" ? "🔥" : "🙈";
      talentHTML = `<div class="stat-row" title="天赋档位与暴露状态（隐藏→已暴露单向，暴露后社会反响持续发酵）">
                <span class="stat-label">🎭 天赋</span>
                <div class="stat-bar" style="display:flex;align-items:center"><span style="font-size:11px">${this.esc(String(t.name || "未定"))} · ${this.esc(tTier)} · ${tCls}${tExp}</span></div>
            </div>`;
    }
    /* v3.55.27 时间账本行：世界时间推进 / 期间状态 / 上次跨越结算的成长 */
    let timeHTML = "";
    const tv = fw && fw.storyState && fw.storyState.variables && fw.storyState.variables.time;
    if (tv && (tv.days > 0 || tv.span)) {
      const AEW = window.AttributeEngine;
      const dTxt = AEW && AEW.daysText ? AEW.daysText : (d) => String(d);
      const parts = [];
      if (tv.era) parts.push(String(tv.era));
      parts.push("累计 " + dTxt(tv.days || 0));
      if (tv.span) parts.push("上次跨越 " + (tv.spanText || dTxt(tv.span)) + "·" + (tv.activity || "寻常度日"));
      if (tv.lastGrowthTotal > 0) parts.push("成长 +" + tv.lastGrowthTotal);
      timeHTML = `<div class="stat-row" title="世界时间账本：时间跨越时属性按公式结算成长（引擎侧真实落表）">
                <span class="stat-label">⏳ 时间</span>
                <div class="stat-bar" style="display:flex;align-items:center"><span style="font-size:11px">${this.esc(parts.join(" · "))}</span></div>
            </div>`;
    }
    if (!keys.length) {
      const emptyHTML = talentHTML + timeHTML || '<div class="empty-hint">开篇后自动生成</div>';
      if (this._same("stats", emptyHTML)) return;
      area.innerHTML = emptyHTML;
      return;
    }
    const labels = this.statLabelMap();
    /* v3.55.26 强项标记：值最高的前二（≥55）标 ★，与主笔提示词的强项偏向同源 */
    const sortedKeys = keys.slice().sort((a, b) => (stats[b] || 0) - (stats[a] || 0));
    const strongSet = new Set(sortedKeys.slice(0, 2).filter((k) => (stats[k] || 0) >= 55));
    const html = talentHTML + timeHTML + keys.map((k) => {
      const val = Math.max(0, Math.min(100, stats[k]));
      const color = this.statColor(val);
      const star = strongSet.has(k) ? ' <span title="强项：该维度主导的行动天然占优" style="color:#e8b339">★</span>' : "";
      return `<div class="stat-row">
                <span class="stat-label">${this.esc(labels[k] || k)}${star}</span>
                <div class="stat-bar"><div class="stat-fill" style="width:${val}%;background:${color}"></div></div>
                <span class="stat-num">${val}</span>
            </div>`;
    }).join("");
    if (this._same("stats", html)) return;
    area.innerHTML = html;
  },
  /**
   * 六维中文标签映射：statKeys（向导同源，必然存在）→ statLabels → 内置兜底
   * 修复：此前只读不存在的 statLabels，导致面板显示英文内部键名
   */
  statLabelMap() {
    const fw = window.storyFramework || {};
    const cfg = fw.config || {};
    const map = Object.assign({}, this.DEFAULT_STAT_LABELS, cfg.statLabels || {});
    (cfg.statKeys || []).forEach((s) => {
      if (s && s.key) map[s.key] = s.label || map[s.key];
    });
    return map;
  },
  DEFAULT_STAT_LABELS: {
    imagination: "想象",
    logic: "逻辑",
    prose: "文笔",
    pacing: "节奏",
    emotion: "情感",
    philosophy: "哲思",
    suspense: "悬念",
    depth: "深度",
    dread: "恐惧",
    madness: "疯狂",
    echo: "余韵",
    martial: "武戏",
    sentiment: "文戏",
    chivalry: "侠义",
    theme: "立意",
    tension: "张力",
    creativity: "创意"
  },
  statColor(val) {
    if (val >= 80) return "linear-gradient(90deg,#e07856,#e0a84c)";
    if (val >= 60) return "linear-gradient(90deg,#e0a84c,#e8c97a)";
    if (val >= 40) return "linear-gradient(90deg,#8ab4c8,#b8d4e2)";
    return "#565b6b";
  },
  renderCharacters(chars) {
    var _a, _b, _c, _d;
    const area = document.getElementById("charactersArea");
    if (!area) return;
    const isRP = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.mode) === "roleplay";
    const realmLbl = ((_d = (_c = window.storyFramework) == null ? void 0 : _c.config) == null ? void 0 : _d.genreKey) === "earth" ? "境遇" : "境界";
    const SS = window.SceneState;
    const castNames = SS && SS.hasData && SS.hasData() ? new Set((SS.snap().cast || []).map((x) => String(x.name || "").trim()).filter(Boolean)) : null;
    /* 签名含在场名单与模式：分区未变即跳过重建（顺带天然保留展开中的 details） */
    if (this._same("chars", [chars, castNames ? Array.from(castNames).sort() : null, isRP, realmLbl])) return;
    const names = Object.keys(chars);
    if (!names.length) {
      area.innerHTML = this._charAddRow() + '<div class="empty-hint">尚无角色登场</div>';
      return;
    }
    const openNames = new Set(
      Array.from(area.querySelectorAll("details.char-card[data-name][open]")).map((el) => el.getAttribute("data-name"))
    );
    const zones = this.charZones(chars, castNames);
    const cardHTML = (n) => {
      const c = chars[n] || {};
      const clip = (s, len) => this.esc(String(s || "").slice(0, len));
      const nameArg = JSON.stringify(n).replace(/"/g, "&quot;");
      const lk = Array.isArray(c.locked) ? c.locked : [];
      const lkBtn = (k) => lk.includes(k) ? `<button class="char-lk" title="玩家锁定中 · 点击交还 AI 管理" onclick="event.stopPropagation();StoryStatusRenderer.unlockField(${nameArg}, ${JSON.stringify(String(k)).replace(/"/g, "&quot;")})">🔒</button>` : "";
      const FR = (k, html) => `<div class="char-field">${html}${lkBtn(k)}</div>`;
      let badge = "";
      if (isRP) {
        if (c.isPlayer) badge = '<span class="char-badge player">你</span>';
        else if (c.isCanon) badge = '<span class="char-badge canon">原著</span>';
        else badge = '<span class="char-badge original">原创</span>';
      }
      if (c.isFaraway) badge = '<span class="char-badge faraway">🌍远方</span>';
      else {
        const P = window.VariableInstructionParser;
        const rel = P && P.relationOf ? P.relationOf(c) : "";
        if (rel) badge += `<span class="char-badge rel">${this.esc(rel)}</span>`;
      }
      const fields = [
        c.role && FR("role", `身份：${this.esc(c.role)}`),
        c.age && FR("age", `年龄：${this.esc(c.age)}`),
        c.appearance && FR("appearance", `外貌：${clip(c.appearance, 40)}`),
        c.personality && FR("personality", `性格：${clip(c.personality, 30)}`),
        c.speechPattern && FR("speechPattern", `言谈：${clip(c.speechPattern, 28)}`),
        isRP && c.mannerism && FR("mannerism", `习惯：${clip(c.mannerism, 24)}`),
        isRP && c.realm && FR("realm", `${realmLbl}：${this.esc(c.realm)}`),
        isRP && c.faction && FR("faction", `势力：${this.esc(c.faction)}`),
        isRP && c.location && FR("location", `行踪：${this.esc(c.location)}`),
        c.motivation && FR("motivation", `动机：${clip(c.motivation, 26)}`),
        isRP && c.goal && FR("goal", `近期目标：${clip(c.goal, 26)}`),
        c.secret && FR("secret", `<span class="char-secret">秘密：${clip(c.secret, 30)}</span>`),
        isRP && c.impression && FR("impression", `对你的印象：${clip(c.impression, 24)}`),
        isRP && c.relationship && FR("relationship", `与你的关系：${this.esc(c.relationship)}`),
        isRP && typeof c.trust === "number" && FR("trust", `信任度：${c.trust}/100`),
        typeof c.favor === "number" && FR("favor", `好感：${c.favor}/100`),
        c.status && FR("status", `状态：${this.esc(c.status)}`),
        c.arc && FR("arc", `弧光：${clip(c.arc, 30)}`),
        c.firstAppearance && FR("firstAppearance", `首场：${clip(c.firstAppearance, 24)}`)
      ].filter(Boolean).join("");
      const KNOWN = [
        "role",
        "age",
        "appearance",
        "personality",
        "speechPattern",
        "mannerism",
        "realm",
        "faction",
        "location",
        "motivation",
        "goal",
        "secret",
        "impression",
        "relationship",
        "trust",
        "status",
        "arc",
        "firstAppearance",
        "history",
        "isPlayer",
        "isCanon",
        "isCulprit",
        "customFields",
        "favor",
        "locked",
        "cfLocked",
        "isFaraway",
        "forceZone"
      ];
      const extra = Object.entries(c).filter(
        ([k, val]) => !KNOWN.includes(k) && (typeof val === "string" || typeof val === "number" || typeof val === "boolean") && String(val).trim() !== ""
      ).map(([k, val]) => FR(k, `${this.esc(k)}：${clip(val, 40)}`)).join("");
      const cf = c.customFields && typeof c.customFields === "object" && !Array.isArray(c.customFields) ? c.customFields : {};
      const cfHtml = Object.entries(cf).map(([k, val]) => {
        const locked = StoryStatusRenderer.isCfLocked(c, k);
        return `<div class="char-field char-cf"><span class="char-cf-text">🧩 ${this.esc(k)}：${clip(val, 60)}</span><button class="char-cf-lk${locked ? "" : " off"}" title="${locked ? "玩家亲笔 · 点击解锁，AI 可按剧情覆盖此格" : "AI 可按剧情覆盖 · 点击锁定，恢复玩家亲笔"}" onclick="event.stopPropagation();StoryStatusRenderer.toggleCfLock(${nameArg}, ${JSON.stringify(String(k)).replace(/"/g, "&quot;")})">${locked ? "🔒" : "🔓"}</button><button class="char-cf-del" title="删除这一格" onclick="event.stopPropagation();StoryStatusRenderer.removeCustomField(${nameArg}, ${JSON.stringify(String(k)).replace(/"/g, "&quot;")})">✕</button></div>`;
      }).join("");
      const histCount = (c.history || []).length;
      const isOpen = openNames.has(n) ? " open" : "";
      const fz = c.forceZone === "present" || c.forceZone === "off" ? c.forceZone : "";
      const zoneBtn = castNames === null ? "" : `<button class="char-zone-btn${fz ? " manual" : ""}" title="${fz ? "手动钉死中 · 点击切换（在场→离场→自动）" : "分区报错了？点击手动纠正（在场→离场→自动）"}" onclick="event.stopPropagation();StoryStatusRenderer.cycleZone(${nameArg})">${fz === "present" ? "📍手动·在场" : fz === "off" ? "🚪手动·离场" : "📍分区"}</button>`;
      return `<details class="char-card" data-name="${this.esc(n)}"${isOpen}>
                <summary class="char-name">◆ ${this.esc(n)} ${badge} ${c.status ? `<span class="char-status">${this.esc(c.status)}</span>` : ""} ${zoneBtn}<span class="hist-count">${histCount}条轨迹</span></summary>
                ${fields || '<div class="char-field">档案待补全</div>'}
                ${extra}
                ${cfHtml}
                <div class="char-cf-bar">
                    <button class="char-cf-add" onclick="event.stopPropagation();StoryStatusRenderer.addCustomField(${nameArg})">＋ 自定义格子</button>
                    <button class="char-cf-edit" onclick="event.stopPropagation();StoryStatusRenderer.editCharacter(${nameArg})">✎ 编辑档案</button>
                    <button class="char-del-btn" title="删除整张档案" onclick="event.stopPropagation();StoryStatusRenderer.deleteCharacter(${nameArg})">🗑</button>
                    <span class="char-cf-tip">🔒玩家亲笔 AI 不改 · 🔓AI 托管随剧情演化（随时点锁切换）</span>
                </div>
            </details>`;
    };
    area.innerHTML = this._charAddRow() + zones.map(
      (z) => (z.label ? `<div class="char-zone-head">${z.label}</div>` : "") + z.names.map(cardHTML).join("")
    ).join("");
  },
  /** v3.28.0 角色三分区（纯函数，供渲染与测试共用）：
   *  在场（cast 命中，玩家永远首位）→ 离场 → 远方·未遇见（isFaraway）。
   *  castNames 为 null（无舞台数据）时不分在场/离场——全部平铺成一个无标签区。
   *  v3.30.0：c.forceZone 手动覆盖优先——舞台监督登记错了（人在场却报离场/
   *  人已走却留名单）玩家可一键纠正，AI 名单被盖过不再生效。 */
  charZones(chars, castNames) {
    const far = [], present = [], off = [];
    Object.keys(chars || {}).forEach((n) => {
      const c = chars[n];
      if (c && c.isFaraway) {
        far.push(n);
        return;
      }
      const fz = c && (c.forceZone === "present" || c.forceZone === "off") ? c.forceZone : null;
      if (fz === "present") {
        present.push(n);
        return;
      }
      if (fz === "off") {
        off.push(n);
        return;
      }
      if (castNames && castNames.has(n)) {
        present.push(n);
        return;
      }
      off.push(n);
    });
    if (castNames !== null) {
      const pi = off.findIndex((n) => chars[n] && chars[n].isPlayer);
      if (pi >= 0) present.unshift(off.splice(pi, 1)[0]);
    }
    const zones = [];
    if (castNames !== null) {
      if (present.length) zones.push({ key: "present", label: `📍 在场（${present.length}）`, names: present });
      if (off.length) zones.push({ key: "off", label: `离场（${off.length}）`, names: off });
    } else if (off.length) {
      zones.push({ key: "off", label: "", names: off });
    }
    if (far.length) zones.push({ key: "faraway", label: `🌍 远方 · 未遇见（${far.length}）`, names: far });
    return zones;
  },
  /* ==================== v3.30.0 在场手动纠正 ====================
   * 用户痛点：「明明人物在场却显示离场，明明人物离场却显示在场」——舞台监督
   * 漏报/误报时玩家无处下手。c.forceZone = 'present'|'off' 手动钉死分区，
   * 覆盖舞台快照（手机在场感知同源尊重），下次 AI 报对了可再点回自动。 */
  /** 角色卡上切「在场/离场」：无 forceZone（自动）→ 钉在场 → 钉离场 → 回自动 */
  cycleZone(name) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c) return;
    const cur = c.forceZone === "present" || c.forceZone === "off" ? c.forceZone : "";
    if (!cur) {
      c.forceZone = "present";
      (_d = window.showToast) == null ? void 0 : _d.call(window, `📍 「${name}」手动标记为在场（覆盖舞台登记）`, "success");
    } else if (cur === "present") {
      c.forceZone = "off";
      (_e = window.showToast) == null ? void 0 : _e.call(window, `🚪 「${name}」手动标记为离场（覆盖舞台登记）`, "success");
    } else {
      delete c.forceZone;
      (_f = window.showToast) == null ? void 0 : _f.call(window, `🔁 「${name}」恢复自动分区（以舞台登记为准）`, "info");
    }
    (_g = fw.saveStory) == null ? void 0 : _g.call(fw);
    this.renderCharacters(((_h = fw.storyState.variables) == null ? void 0 : _h.characters) || {});
  },
  /* ==================== v3.27.6 玩家自定义格子（customFields） ==================== */
  /** 加一格：三连问（格子名 → 内容 → 交给谁管），写入 characters[name].customFields 并回流 AI 上下文
   *  v3.31.3：第三问显式选托管——旧版缺省🔒锁定且开关藏在卡片小按钮里，玩家以为
   *  "AI 可以改自定义表格"却永远等不到更新（玩家反馈"还是得手动"的 UX 根因） */
  async addCustomField(name) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c) return;
    const label = await window.UIDialog.prompt({
      title: `「${name}」加一格`,
      message: "格子名写什么？（如：口头禅 / 弱点 / 座驾 / 心上人）",
      placeholder: "格子名，建议 8 字以内"
    });
    if (label === null) return;
    const key = String(label).trim().slice(0, 10);
    if (!key) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "格子名不能为空", "error");
      return;
    }
    const value = await window.UIDialog.prompt({
      title: `「${name} · ${key}」`,
      message: "这一格里写什么？（会注入给 AI 作为人设依据）",
      defaultValue: ((_e = c.customFields) == null ? void 0 : _e[key]) || "",
      placeholder: "写得细一些，AI 会照着演"
    });
    if (value === null) return;
    const val = String(value).trim();
    if (!val) {
      if (c.customFields && key in c.customFields) {
        delete c.customFields[key];
        (_f = window.showToast) == null ? void 0 : _f.call(window, `已删除「${name}」的格子「${key}」`, "info");
      }
    } else {
      if (!c.customFields || typeof c.customFields !== "object" || Array.isArray(c.customFields)) c.customFields = {};
      c.customFields[key] = val;
      const aiManaged = await window.UIDialog.confirm({
        title: `「${key}」交给谁管？`,
        message: `🔓 AI 托管：随剧情自动演化——境界突破、好感涨落、库存增减，登记官每轮照看。
🔒 玩家亲笔：锁定不动，AI 严禁改写——适合"定了就不许变"的人设铁律。

会随剧情变化的状态（境界/好感/存粮）推荐 AI 托管。之后可随时点格子旁的锁切换。`,
        confirmText: "🔓 AI 托管（推荐）",
        cancelText: "🔒 玩家亲笔"
      });
      if (!Array.isArray(c.cfLocked)) c.cfLocked = [];
      if (aiManaged) {
        if (!c.cfLocked.includes(key)) c.cfLocked.push(key);
        (_g = window.showToast) == null ? void 0 : _g.call(window, `🔓 已为「${name}」记下「${key}」并交还 AI 管理：随剧情自动演化`, "success");
      } else {
        c.cfLocked = c.cfLocked.filter((k) => k !== key);
        if (!c.cfLocked.length) delete c.cfLocked;
        (_h = window.showToast) == null ? void 0 : _h.call(window, `🔒 已为「${name}」记下「${key}」：玩家亲笔，AI 不改写`, "success");
      }
      const P = window.VariableInstructionParser;
      const stdKey = P && P.CELL_ALIAS ? P.CELL_ALIAS[key] : null;
      if (stdKey) {
        (_i = window.showToast) == null ? void 0 : _i.call(window, `ℹ 「${key}」与档案字段「${stdKey}」同义：AI 更新任一处，另一处自动同步`, "info");
      }
    }
    fw.saveStory();
    this.renderCharacters(((_j = fw.storyState.variables) == null ? void 0 : _j.characters) || {});
  },
  /** 删一格 */
  async removeCustomField(name, key) {
    var _a, _b, _c, _d, _e;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c || !c.customFields || !(key in c.customFields)) return;
    delete c.customFields[key];
    if (Array.isArray(c.cfLocked)) {
      c.cfLocked = c.cfLocked.filter((k) => k !== String(key));
      if (!c.cfLocked.length) delete c.cfLocked;
    }
    fw.saveStory();
    this.renderCharacters(((_d = fw.storyState.variables) == null ? void 0 : _d.characters) || {});
    (_e = window.showToast) == null ? void 0 : _e.call(window, `已删除「${name}」的格子「${key}」`, "info");
  },
  /* ==================== v3.27.7 档案编辑器（全字段玩家可编 + 🔒锁防AI覆盖） ==================== */
  /** 编辑器字段表（key 与角色档案字段一一对应；num=数值 0-100，ta=多行文本） */
  EDIT_FIELDS: [
    { key: "role", label: "身份", ph: "如：制衣厂质检女工", max: 40 },
    { key: "age", label: "年龄", ph: "如：28", max: 10 },
    { key: "appearance", label: "外貌", ph: "身高体貌、衣着、辨识特征", max: 150, ta: true },
    { key: "personality", label: "性格", ph: "脾气秉性、行事风格", max: 100, ta: true },
    { key: "speechPattern", label: "言谈习惯", ph: "口音、口头禅、说话方式", max: 80 },
    { key: "motivation", label: "动机", ph: "TA 到底想要什么", max: 80 },
    { key: "goal", label: "近期目标", ph: "眼下在忙的事", max: 60 },
    { key: "location", label: "所在位置", ph: "如：城南旧公寓 302", max: 40 },
    { key: "status", label: "身心近况", ph: "当前状态一句话", max: 80 },
    { key: "secret", label: "秘密", ph: "TA 藏着的事（AI 知道，主角未必）", max: 100 },
    { key: "relationship", label: "与主角关系", ph: "如：若即若离的旧识", max: 50 },
    { key: "impression", label: "对主角印象", ph: "TA 眼中的主角", max: 50 },
    { key: "trust", label: "信任度 0-100", num: true },
    { key: "favor", label: "好感度 0-100", num: true }
  ],
  /** 「＋ 新增角色」入口行（角色区顶部常驻） */
  _charAddRow() {
    return `<div class="char-add-row"><button class="char-add-btn" onclick="StoryStatusRenderer.addCharacter()">＋ 新增角色</button><span class="char-cf-tip">玩家自建人物 · AI 按档案演出</span></div>`;
  },
  /** locked 数组维护（c.locked 存被玩家锁定的字段键） */
  _toggleLock(c, key, on) {
    if (!Array.isArray(c.locked)) c.locked = [];
    c.locked = c.locked.filter((k) => k !== key);
    if (on) c.locked.push(key);
    if (!c.locked.length) delete c.locked;
  },
  /* ==================== v3.29.1 自定义格子锁 ====================
   * 用户需求：「玩家自定义的格子也可以选择锁定，和解锁给AI根据剧情变量覆盖」。
   * c.cfLocked 数组存解锁交还 AI 的格子键；缺省（无数组/键不在数组）= 锁定防AI覆盖
   * ——旧档 customFields 行为零变化（原本就全防覆盖），玩家解锁哪格 AI 才能改哪格。 */
  /** 某自定义格子是否锁定中（缺省锁定：防AI覆盖，保持玩家亲笔） */
  isCfLocked(c, key) {
    if (!c || typeof c !== "object") return true;
    return !(Array.isArray(c.cfLocked) && c.cfLocked.includes(String(key)));
  },
  /** 角色卡上点 🔒/🔓：切换单个自定义格子的锁；解锁的格子 AI 可按剧情覆盖 */
  toggleCfLock(name, key) {
    var _a, _b, _c, _d, _e, _f;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c || c.customFields == null || !(key in c.customFields)) return;
    const k = String(key);
    if (!Array.isArray(c.cfLocked)) c.cfLocked = [];
    const wasLocked = !c.cfLocked.includes(k);
    c.cfLocked = c.cfLocked.filter((x) => x !== k);
    if (wasLocked) c.cfLocked.push(k);
    if (!c.cfLocked.length) delete c.cfLocked;
    (_d = fw.saveStory) == null ? void 0 : _d.call(fw);
    this.renderCharacters(((_e = fw.storyState.variables) == null ? void 0 : _e.characters) || {});
    (_f = window.showToast) == null ? void 0 : _f.call(window, wasLocked ? `🔓 「${k}」已交还 AI 管理：后续按剧情演化覆盖` : `🔒 「${k}」已锁定：恢复玩家亲笔，AI 不再覆盖`, "success");
  },
  /**
   * ✎ 档案编辑器：全部字段直接可编（身份/年龄/外貌/性格/言谈/动机/目标/位置/
   * 近况/秘密/关系/印象/信任/好感 + 自定义格子增删改）。
   * 玩家写下的字段自动🔒锁定——解析器三条 AI 更新路径均跳过，主笔上下文里
   * 标注为玩家亲笔。返回 Promise<boolean>（true=已保存）。
   * 微信联系人详情卡 / 玩家面板共用此入口。
   */
  editCharacter(name) {
    var _a, _b, _c, _d, _e;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "档案不可用", "error");
      return Promise.resolve(false);
    }
    if (!window.UIDialog || !document.createElement) {
      (_e = window.showToast) == null ? void 0 : _e.call(window, "编辑器未就绪", "error");
      return Promise.resolve(false);
    }
    const esc = (s) => this.esc(s);
    const locked = Array.isArray(c.locked) ? c.locked.slice() : [];
    const fieldRow = (f) => {
      var _a2;
      const val = (_a2 = c[f.key]) != null ? _a2 : "";
      const isLk = locked.includes(f.key);
      return `<div class="ce-field">
                <div class="ce-label"><span>${esc(f.label)}</span>
                    <button type="button" class="ce-lock${isLk ? " on" : ""}" data-lock="${esc(f.key)}" title="玩家锁定 = AI 不可覆盖此字段">${isLk ? "🔒 玩家锁定" : "🔓 AI 可更新"}</button>
                </div>
                ${f.ta ? `<textarea class="ce-input" data-f="${esc(f.key)}" rows="2" maxlength="${f.max}" placeholder="${esc(f.ph || "")}">${esc(val)}</textarea>` : `<input class="ce-input" data-f="${esc(f.key)}" maxlength="${f.max}" ${f.num ? 'type="number" min="0" max="100" inputmode="numeric"' : 'type="text"'} placeholder="${esc(f.ph || "")}" value="${esc(val)}">`}
            </div>`;
    };
    const cf = c.customFields && typeof c.customFields === "object" && !Array.isArray(c.customFields) ? c.customFields : {};
    const cfRow = (k, v) => `<div class="ce-cf-row" data-cf-key="${esc(k)}">
            <input class="ce-cf-key" maxlength="10" placeholder="格子名" value="${esc(k)}">
            <input class="ce-cf-val" maxlength="60" placeholder="内容（AI 会照着演）" value="${esc(v)}">
            <button type="button" class="ce-lock ce-cf-lock${this.isCfLocked(c, k) ? " on" : ""}" data-cflock="${esc(k)}" title="玩家锁定 = AI 不可覆盖此格；解锁 = AI 按剧情覆盖">${this.isCfLocked(c, k) ? "🔒 亲笔" : "🔓 AI可改"}</button>
            <button type="button" class="ce-cf-del" title="删除这一格">✕</button>
        </div>`;
    const root = document.createElement("div");
    root.className = "ce-overlay";
    root.innerHTML = `
            <div class="ce-box" role="dialog" aria-modal="true">
                <div class="ce-head"><b>✎ 编辑「${esc(name)}」</b><button type="button" class="ce-x" data-act="cancel" aria-label="关闭">✕</button></div>
                <div class="ce-tip">玩家写下的字段自动🔒锁定——AI 不可覆盖、正文须遵守；🔓 字段 AI 每轮照常更新。留空保存 = 清除该字段。🧩 自定义格子同样可点锁：🔓 后 AI 按剧情演化覆盖该格。</div>
                <div class="ce-body">
                    ${this.EDIT_FIELDS.map(fieldRow).join("")}
                    <div class="ce-cf-head">🧩 自定义格子（玩家亲笔设定）</div>
                    <div class="ce-cf-list">${Object.entries(cf).map(([k, v]) => cfRow(k, v)).join("")}</div>
                    <button type="button" class="ce-cf-add">＋ 加一格（如：口头禅 / 弱点 / 座驾）</button>
                </div>
                <div class="ce-foot">
                    <button type="button" class="ce-btn ghost" data-act="cancel">取消</button>
                    <button type="button" class="ce-btn primary" data-act="save">保存</button>
                </div>
            </div>`;
    document.body.appendChild(root);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let finish = null;
    const onKey = (e) => {
      if (e.key === "Escape" && finish) {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return new Promise((resolve) => {
      const close = () => {
        document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey, true);
        root.remove();
      };
      finish = (saved) => {
        close();
        resolve(saved);
      };
      const save = () => {
        var _a2, _b2;
        this.EDIT_FIELDS.forEach((f) => {
          const el = root.querySelector(`.ce-input[data-f="${f.key}"]`);
          if (!el) return;
          const val = String(el.value || "").trim().slice(0, f.max || 60);
          const lkBtn = root.querySelector(`.ce-lock[data-lock="${f.key}"]`);
          const wantLock = !!(lkBtn && lkBtn.classList.contains("on") && val);
          if (f.num) {
            if (val === "") delete c[f.key];
            else c[f.key] = Math.max(0, Math.min(100, Math.round(Number(val)) || 0));
          } else if (val) c[f.key] = val;
          else delete c[f.key];
          this._toggleLock(c, f.key, wantLock);
        });
        const ncf = {};
        const ncfLocked = [];
        root.querySelectorAll(".ce-cf-row").forEach((r) => {
          var _a3, _b3;
          const k = String(((_a3 = r.querySelector(".ce-cf-key")) == null ? void 0 : _a3.value) || "").trim().slice(0, 10);
          const v = String(((_b3 = r.querySelector(".ce-cf-val")) == null ? void 0 : _b3.value) || "").trim().slice(0, 60);
          if (!k || !v) return;
          ncf[k] = v;
          const lkBtn = r.querySelector(".ce-cf-lock");
          if (lkBtn && !lkBtn.classList.contains("on")) ncfLocked.push(k);
        });
        if (Object.keys(ncf).length) c.customFields = ncf;
        else delete c.customFields;
        if (ncfLocked.length) c.cfLocked = ncfLocked;
        else delete c.cfLocked;
        fw.saveStory();
        this.renderCharacters(((_a2 = fw.storyState.variables) == null ? void 0 : _a2.characters) || {});
        (_b2 = window.showToast) == null ? void 0 : _b2.call(window, `已保存「${name}」档案`, "success");
      };
      root.addEventListener("click", (e) => {
        var _a2, _b2, _c2, _d2;
        if (e.target === root) return finish(false);
        const t = e.target;
        if (t.classList.contains("ce-cf-del")) {
          (_a2 = t.closest(".ce-cf-row")) == null ? void 0 : _a2.remove();
          return;
        }
        if (t.classList.contains("ce-cf-add")) {
          root.querySelector(".ce-cf-list").insertAdjacentHTML("beforeend", cfRow("", ""));
          (_c2 = (_b2 = root.querySelector(".ce-cf-list").lastElementChild) == null ? void 0 : _b2.querySelector(".ce-cf-key")) == null ? void 0 : _c2.focus();
          return;
        }
        if (t.classList.contains("ce-lock")) {
          const on = t.classList.toggle("on");
          t.textContent = t.hasAttribute("data-cflock") ? on ? "🔒 亲笔" : "🔓 AI可改" : on ? "🔒 玩家锁定" : "🔓 AI 可更新";
          return;
        }
        const act = (_d2 = t.closest("[data-act]")) == null ? void 0 : _d2.getAttribute("data-act");
        if (act === "cancel") return finish(false);
        if (act === "save") {
          save();
          return finish(true);
        }
      });
      root.addEventListener("input", (e) => {
        var _a2, _b2;
        const key = (_b2 = (_a2 = e.target).getAttribute) == null ? void 0 : _b2.call(_a2, "data-f");
        if (!key) return;
        const btn = root.querySelector(`.ce-lock[data-lock="${key}"]`);
        if (btn && !btn.classList.contains("on")) {
          btn.classList.add("on");
          btn.textContent = "🔒 玩家锁定";
        }
      });
    });
  },
  /** v3.27.7：＋ 新增角色（玩家自建 NPC，AI 按档案演出） */
  async addCharacter() {
    var _a, _b, _c, _d, _e;
    const fw = window.storyFramework;
    if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || !window.UIDialog) return false;
    const nm = await window.UIDialog.prompt({
      title: "＋ 新增角色",
      message: "角色叫什么名字？（建卡后可补全资料，正文里 TA 会按档案登场演出）",
      placeholder: "如：许静"
    });
    if (nm === null) return false;
    const name = String(nm).trim().slice(0, 12);
    if (!name) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "名字不能为空", "error");
      return false;
    }
    if (!/[\u4e00-\u9fa5A-Za-z]/.test(name)) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "名字须包含文字", "error");
      return false;
    }
    const vars = fw.storyState.variables;
    vars.characters = vars.characters || {};
    if (vars.characters[name]) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "已有同名角色，直接打开 TA 的档案", "info");
      return this.editCharacter(name);
    }
    vars.characters[name] = { firstAppearance: "玩家手动建档" };
    fw.saveStory();
    this.renderCharacters(vars.characters);
    (_e = window.showToast) == null ? void 0 : _e.call(window, `已为「${name}」建档，接着补全资料`, "success");
    return this.editCharacter(name);
  },
  /** v3.27.7：删除整张角色档案（微信联系人、会话同步清理） */
  async deleteCharacter(name) {
    var _a, _b, _c;
    const fw = window.storyFramework;
    const chars = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters;
    if (!chars || !chars[name] || !window.UIDialog) return false;
    const ok = await window.UIDialog.confirm({
      title: `删除「${name}」`,
      message: "整张角色档案（含微信联系人、会话）将被移除，不可撤销。",
      danger: true
    });
    if (!ok) return false;
    delete chars[name];
    try {
      const PP = window.PhonePanel;
      const p = PP && PP.state && PP.state();
      if (p) {
        p.contacts = (p.contacts || []).filter((x) => x && x.name !== name);
        p.chats = (p.chats || []).filter((x) => x && x.name !== name);
        if (typeof PP.refresh === "function") PP.refresh();
      }
    } catch (e) {
    }
    fw.saveStory();
    this.renderCharacters(chars);
    (_c = window.showToast) == null ? void 0 : _c.call(window, `已删除「${name}」`, "info");
    return true;
  },
  /** v3.27.7：卡片上点 🔒 解锁——字段交还 AI 管理（当前值保留） */
  unlockField(name, key) {
    var _a, _b, _c, _d, _e;
    const fw = window.storyFramework;
    const c = (_c = (_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) == null ? void 0 : _c[name];
    if (!c || !Array.isArray(c.locked)) return;
    this._toggleLock(c, key, false);
    fw.saveStory();
    this.renderCharacters(((_d = fw.storyState.variables) == null ? void 0 : _d.characters) || {});
    (_e = window.showToast) == null ? void 0 : _e.call(window, `「${key}」已交还 AI 管理（当前值保留）`, "info");
  },
  renderForeshadowings(list) {
    var _a, _b;
    const area = document.getElementById("foreshadowArea");
    if (!area) return;
    const pl = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.panelLabels) || {};
    if (this._same("foreshadow", list)) return;
    if (!list.length) {
      area.innerHTML = `<div class="empty-hint">${pl.fsEmpty || "尚无伏笔登记"}</div>`;
      return;
    }
    area.innerHTML = list.map((f) => {
      const cls = f.status === "resolved" ? "resolved" : "planted";
      const tag = f.status === "resolved" ? pl.fsDone || "已回收" : pl.fsPending || "待回收";
      return `<div class="foreshadow-item ${cls}">
                <span class="fs-tag">${tag}</span> ${this.esc(f.name)}
            </div>`;
    }).join("");
  },
  renderItems(items) {
    var _a, _b;
    const area = document.getElementById("itemsArea");
    if (!area) return;
    const pl = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.panelLabels) || {};
    if (this._same("items", items)) return;
    if (!items.length) {
      area.innerHTML = `<div class="empty-hint">${pl.itemsEmpty || "尚无关键道具"}</div>`;
      return;
    }
    const icon = pl.itemIcon || "🔑";
    area.innerHTML = items.map((i) => `<div class="item-chip">${icon} ${this.esc(i.name)} ×${i.count || 1}</div>`).join("");
  },
  renderHistory(hist) {
    var _a, _b;
    const area = document.getElementById("historyArea");
    if (!area) return;
    const pl = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.panelLabels) || {};
    const tail = hist.slice(-12);
    if (this._same("history", tail)) return;
    if (!hist.length) {
      area.innerHTML = `<div class="empty-hint">${pl.historyEmpty || "故事尚未开始"}</div>`;
      return;
    }
    area.innerHTML = tail.reverse().map((h) => `<div class="history-item">${this.esc(h)}</div>`).join("");
  },
  esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
window.StoryStatusRenderer = StoryStatusRenderer;
