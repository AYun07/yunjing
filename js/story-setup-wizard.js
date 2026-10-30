const StorySetupWizard = {
  state: null,
  /** 渲染向导（未开篇时显示；roleplay 模式渲染身份设定台） */
  render() {
    var _a, _b, _c, _d;
    const fw = window.storyFramework;
    const config = fw.config;
    this.state = {
      playerName: "",
      gender: "男",
      age: 18,
      perspective: "",
      style: "",
      identity: "",
      timeline: "",
      aptitude: "",
      scale: "",
      opening: "",
      techniques: [],
      stats: {},
      remainingPoints: config.maxPoints || 100
    };
    const savedTitle = document.getElementById("bookTitleLine");
    if (savedTitle) savedTitle.textContent = "";
    if (config.mode === "roleplay") return config.worldForge ? this.renderFreeworld() : this.renderRoleplay();
    const meta = config.setupMeta || {};
    const hasEra = (meta.eras || []).length > 0;
    const hasMotif = (meta.motifs || []).length > 0;
    this.state = {
      title: "",
      premise: "",
      perspective: ((_a = (meta.perspectives || [])[0]) == null ? void 0 : _a.id) || "",
      style: ((_b = (meta.styles || [])[0]) == null ? void 0 : _b.id) || "",
      length: ((_c = (meta.lengths || [])[1]) == null ? void 0 : _c.id) || "",
      era: hasEra ? meta.eras[0].id : "",
      motif: hasMotif ? meta.motifs[0].id : "",
      opening: ((_d = (config.openings || [])[0]) == null ? void 0 : _d.id) || "",
      techniques: [],
      stats: { ...config.baseAttributes || {} },
      customVars: [],
      /* v3.26.1 ⑪ 自定义变量模板（pkCustom 开局种子） */
      remainingPoints: config.maxPoints || 100
    };
    const container = document.getElementById("setupContainer");
    if (!container) return;
    container.innerHTML = `
        <div class="wizard-card">
            <div class="wizard-title">✒ ${config.genreName} · 故事设定台</div>
            <div class="wizard-sub">完成设定后，AI 主笔将按你的配置落笔开篇 —— 每个选项都会注入创作指令，六维即行文权重，点数越高，笔下该气质越浓</div>

            <div class="wiz-section">
                <div class="wiz-label">① 书名 <button class="dice-btn" onclick="StorySetupWizard.dice('title')">🎲 随机</button></div>
                <input id="wiz_title" class="wiz-input" type="text" maxlength="20" placeholder="为这篇小说起一个名字…">
            </div>

            <div class="wiz-section">
                <div class="wiz-label">② 一句话梗概 <button class="dice-btn" onclick="StorySetupWizard.dice('premise')">🎲 随机</button></div>
                <input id="wiz_premise" class="wiz-input" type="text" maxlength="80" placeholder="想写一个怎样的故事？（留空则由开篇模式决定）">
            </div>

            <!-- v3.31.4 主角设定（选填）：玩家亲手立角——填了姓名即全程锁定，留空则 AI 主笔自塑主角 -->
            <div class="wiz-section" id="wiz_heroSection">
                <div class="wiz-label">✦ 主角设定 <span class="wiz-hint">（选填——留空由 AI 主笔塑造主角；姓名一填即锁定为本书主角，行旅图鉴也将随之记行踪）</span>
                    <button class="dice-btn" onclick="StorySetupWizard.dice('heroName')">🎲 随机姓名</button>
                </div>
                <div class="wiz-inline">
                    <input id="wiz_heroName" class="wiz-input" style="flex:1;" type="text" maxlength="12" placeholder="主角姓名…（留空 = 交给 AI 塑造）">
                    <select id="wiz_heroGender" class="wiz-select slim">
                        <option value="男">男</option>
                        <option value="女">女</option>
                    </select>
                    <input id="wiz_heroAge" class="wiz-input slim" style="width:86px;" type="number" min="8" max="90" placeholder="年龄">
                </div>
                <textarea id="wiz_heroBio" class="wiz-input" rows="2" maxlength="600" style="margin-top:8px;" placeholder="主角小传（选填）：性格 / 来历 / 所求 / 秘密…写多细，AI 执行多细——例：铁剑门弃徒，因师门蒙冤背负污名，性子外冷内热，一心查清旧案"></textarea>
            </div>

            <div class="wiz-row three-col">
                <div class="wiz-section">
                    <div class="wiz-label">③ 叙事视角</div>
                    <select id="wiz_perspective" class="wiz-select" onchange="StorySetupWizard.updateDesc('perspective');StorySetupWizard.toggleCustomField('perspective')">
                        ${(meta.perspectives || []).map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
                        <option value="custom">✎ 自定义</option>
                    </select>
                    <div class="wiz-desc" id="wiz_desc_perspective"></div>
                    <textarea id="wiz_custom_perspective" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="✎ 自定义视角——例：第一人称日记体，每章一篇，只写「我」看到的与心里想的"></textarea>
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">④ 文风基调</div>
                    <select id="wiz_style" class="wiz-select" onchange="StorySetupWizard.updateDesc('style');StorySetupWizard.toggleCustomField('style')">
                        ${(meta.styles || []).map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
                        <option value="custom">✎ 自定义</option>
                    </select>
                    <div class="wiz-desc" id="wiz_desc_style"></div>
                    <textarea id="wiz_custom_style" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="✎ 自定义文风——例：冷硬侦探风，短句为主，环境白描克制，偶用比喻点睛"></textarea>
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">⑤ 目标篇幅</div>
                    <select id="wiz_length" class="wiz-select" onchange="StorySetupWizard.updateDesc('length');StorySetupWizard.toggleCustomField('length')">
                        ${(meta.lengths || []).map((l) => `<option value="${l.id}">${l.name}（约${l.words}字 / ${l.chapters}章）</option>`).join("")}
                        <option value="custom">✎ 自定义</option>
                    </select>
                    <div class="wiz-desc" id="wiz_desc_length"></div>
                    <textarea id="wiz_custom_length" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="✎ 自定义篇幅——例：九章短篇，每章约两千字（写清章数，AI 按此收束）"></textarea>
                </div>
            </div>

            ${hasEra || hasMotif ? `
            <div class="wiz-row ${hasEra && hasMotif ? "two-col" : "three-col"}">
                ${hasEra ? `
                <div class="wiz-section">
                    <div class="wiz-label">⑥ 时代背景</div>
                    <select id="wiz_era" class="wiz-select" onchange="StorySetupWizard.updateDesc('era');StorySetupWizard.toggleCustomField('era')">
                        ${meta.eras.map((e) => `<option value="${e.id}">${e.name}</option>`).join("")}
                        <option value="custom">✎ 自定义</option>
                    </select>
                    <div class="wiz-desc" id="wiz_desc_era"></div>
                    <textarea id="wiz_custom_era" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="✎ 自定义时代——例：千禧年前夜的小城，BP 机与录像厅还未退场"></textarea>
                </div>` : ""}
                ${hasMotif ? `
                <div class="wiz-section">
                    <div class="wiz-label">⑦ 主题母题</div>
                    <select id="wiz_motif" class="wiz-select" onchange="StorySetupWizard.updateDesc('motif');StorySetupWizard.toggleCustomField('motif')">
                        ${meta.motifs.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}
                        <option value="custom">✎ 自定义</option>
                    </select>
                    <div class="wiz-desc" id="wiz_desc_motif"></div>
                    <textarea id="wiz_custom_motif" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="✎ 自定义母题——例：谎言的代价——每个善意谎言都会滚成雪球"></textarea>
                </div>` : ""}
            </div>` : ""}

            <div class="wiz-section">
                <div class="wiz-label">⑧ 开篇模式 <span class="wiz-hint">（对应游戏框架的"出身"，影响初始叙事参数；可选 ✎ 自定义）</span></div>
                <div class="opening-grid">
                    ${(config.openings || []).map((o, i) => `
                        <div class="opening-item ${i === 0 ? "selected" : ""}" data-id="${o.id}" onclick="StorySetupWizard.selectOpening(this)">
                            <div class="opening-name">${o.name} <span class="pm ${o.pointsModifier >= 0 ? "plus" : "minus"}">${o.pointsModifier >= 0 ? "+" : ""}${o.pointsModifier}</span></div>
                            <div class="opening-desc">${o.description}</div>
                            ${o.effectsText ? `<div class="opening-effects">${o.effectsText}</div>` : ""}
                        </div>`).join("")}
                    <div class="opening-item custom-card" data-id="custom" onclick="StorySetupWizard.selectOpening(this)">
                        <div class="opening-name">✎ 自定义开篇 <span class="pm plus">+0</span></div>
                        <div class="opening-desc">开篇由你亲笔：场景 / 事件 / 切入点，AI 按你写的开场并据此定初始参数</div>
                    </div>
                </div>
                <textarea id="wiz_custom_entry" class="wiz-input custom-field-input" rows="3" maxlength="400" style="display:none" placeholder="✎ 自定义开篇——例：深夜末班地铁，主角捡到一部还在通话中的手机，对面的人正逐个描述车厢里的乘客…（写清开场场景与事件，AI 按此开篇）"></textarea>
            </div>

            <div class="wiz-section">
                <div class="wiz-label">⑨ 写作技法 <span class="wiz-hint">（对应"天赋"，最多选 ${config.maxTechniques || 2} 项，每项消耗采纳点；可选 ✎ 自定义）</span></div>
                <div class="tech-grid">
                    ${(config.techniques || []).map((t) => `
                        <div class="tech-item" data-id="${t.id}" data-cost="${t.cost || 0}" onclick="StorySetupWizard.toggleTechnique(this)">
                            <div class="tech-name">${t.name} <span class="cost">-${t.cost || 0}</span></div>
                            <div class="tech-desc">${t.description}</div>
                        </div>`).join("")}
                    <div class="tech-item custom-card" data-id="custom" data-cost="10" onclick="StorySetupWizard.toggleTechnique(this)">
                        <div class="tech-name">✎ 自定义技法 <span class="cost">-10</span></div>
                        <div class="tech-desc">技法由你亲笔（消耗 10 点）——想让它怎么写，就写什么</div>
                    </div>
                </div>
                <textarea id="wiz_custom_boon" class="wiz-input custom-field-input" rows="2" maxlength="300" style="display:none" placeholder="✎ 自定义技法——例：每章以一句倒叙的「事后追忆」开头再回正叙；对话不超过三行必切动作"></textarea>
            </div>

            <div class="wiz-section">
                <div class="wiz-label">⑩ 创作六维分配
                    <span class="points-remain">剩余点数：<b id="wiz_remain">100</b></span>
                    <button class="dice-btn" onclick="StorySetupWizard.randomStats()">🎲 随机</button>
                </div>
                <div class="stats-grid" id="wiz_statsGrid"></div>
            </div>

            <div class="wiz-section">
                <div class="wiz-label">⑪ 自定义变量 <span class="wiz-hint">（选填，最多 6 条——想盯什么就填什么：身高/好感/存粮/理智…开局播种，AI 每轮照看并让它真实影响剧情）</span></div>
                <div id="wizCustomList" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input id="wizCvKey" class="wiz-input" style="flex:1;" type="text" maxlength="10" placeholder="变量名（如：身高）">
                    <input id="wizCvVal" class="wiz-input" style="flex:1;" type="text" maxlength="16" placeholder="初始值（如：170cm）">
                    <button class="dice-btn" onclick="StorySetupWizard.addCustomVar()">＋ 添加</button>
                </div>
                <div style="margin-top:8px;font-size:12px;color:var(--imt,#9a8c6e);">
                    快速模板：${this.customPresets().map((p) => `<a href="javascript:void(0)" style="margin-right:10px;text-decoration:underline dotted;" onclick="StorySetupWizard.presetCustomVar('${p[0]}','${p[1]}')">${p[0]}</a>`).join("")}
                </div>
            </div>

            <div class="wizard-actions">
                <button class="btn-ghost wiz-exit" onclick="location.href='index.html'">🏠 返回大厅</button>
                <button class="btn-ghost" onclick="StorySetupWizard.diceAll()">🎲 全部随机</button>
                <button class="btn-solid big" onclick="StorySetupWizard.start()">📖 开始创作 · 落笔开篇</button>
            </div>
        </div>`;
    const wrapEl = document.getElementById("setupWrap");
    if (wrapEl) wrapEl.style.display = "";
    const chatRestore = document.getElementById("chatArea");
    if (chatRestore) chatRestore.style.display = "none";
    container.style.display = "block";
    this.renderStatsGrid();
    this.renderCustomVars();
    ["perspective", "style", "length", "era", "motif"].forEach((f) => this.updateDesc(f));
  },
  /* ================================================================
     ⑪ 自定义变量模板（v3.26.1）：开局播种 pkCustom 万能自定义槽
     ================================================================ */
  customPresets() {
    const g = window.storyFramework && storyFramework.config && storyFramework.config.genreKey || "";
    const P = {
      mystery: [["嫌疑度", "50"], ["线索数", "0"], ["心理压力", "低"]],
      scifi: [["氧气", "100%"], ["能源", "75%"], ["信用点", "500"]],
      wuxia: [["内力", "三成"], ["江湖声望", "无名小卒"], ["盘缠", "十两"]],
      cthulhu: [["理智", "100"], ["禁忌知识", "0"], ["恐惧度", "10"]],
      free: [["身高", "170cm"], ["好感", "50"], ["存粮", "3天"]]
    };
    return P[g] || P.free;
  },
  renderCustomVars() {
    const el = document.getElementById("wizCustomList");
    if (!el) return;
    const list = this.state && this.state.customVars || [];
    el.innerHTML = list.map((p, i) => `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--ip,#c9a86a)45;border-radius:14px;font-size:12px;color:var(--it,#d8cdb8);background:var(--ip,#c9a86a)12;">
            📌 ${p.key} = ${p.val || "—"}
            <a href="javascript:void(0)" style="color:#e07070;" onclick="StorySetupWizard.delCustomVar(${i})">✕</a>
        </span>`).join("");
  },
  addCustomVar() {
    const kEl = document.getElementById("wizCvKey"), vEl = document.getElementById("wizCvVal");
    if (!kEl) return;
    const key = kEl.value.trim().slice(0, 10), val = (vEl ? vEl.value.trim() : "").slice(0, 16);
    if (!key) {
      kEl.focus();
      return;
    }
    this.state.customVars = this.state.customVars || [];
    if (this.state.customVars.some((p) => p.key === key)) return;
    if (this.state.customVars.length >= 6) {
      try {
        window.showToast && window.showToast("最多 6 条自定义变量", "warn");
      } catch (e) {
      }
      return;
    }
    this.state.customVars.push({ key, val });
    kEl.value = "";
    if (vEl) vEl.value = "";
    this.renderCustomVars();
  },
  presetCustomVar(key, val) {
    const kEl = document.getElementById("wizCvKey"), vEl = document.getElementById("wizCvVal");
    if (kEl) kEl.value = key;
    if (vEl) vEl.value = val || "";
    this.addCustomVar();
  },
  delCustomVar(i) {
    if (this.state && this.state.customVars) {
      this.state.customVars.splice(i, 1);
      this.renderCustomVars();
    }
  },
  /** v3.27.0 自定义篇幅解析：亲笔文字 → { chapters, words }
   *  认得「九章 / 12回 / 二十四章」（中文数字一~九十九）、「两万字 / 3.5万」、
   *  「每章约两千字 / 每章3000字」（章数 × 每章字数）；解析不出用预设兜底 */
  parseCustomLength(text, fallbackChapters, fallbackWords) {
    const t = String(text || "");
    let chapters = fallbackChapters || 6, words = fallbackWords || 6e3;
    const CN = { "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    const cnNum = (s) => {
      if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
      if (s === "十") return 10;
      if (/^十[一二两三四五六七八九]$/.test(s)) return 10 + (CN[s[1]] || 0);
      if (/^[一二两三四五六七八九]十$/.test(s)) return (CN[s[0]] || 0) * 10;
      if (/^[一二两三四五六七八九]十[一二两三四五六七八九]$/.test(s)) return (CN[s[0]] || 0) * 10 + (CN[s[2]] || 0);
      return CN[s] || 0;
    };
    let hasCh = false;
    const mCh = t.match(/(\d{1,3}|[一二两三四五六七八九十]{1,3})\s*[章回]/);
    if (mCh) {
      const n = cnNum(mCh[1]);
      if (n) {
        chapters = Math.min(60, Math.max(1, n));
        hasCh = true;
      }
    }
    const mWd = t.match(/(\d{1,3}(?:\.\d)?|[一二两三四五六七八九十]{1,3})\s*万/);
    if (mWd) {
      const n = cnNum(mWd[1]);
      if (n) words = Math.round(n * 1e4);
    } else if (hasCh) {
      const mPerK = t.match(/每章[约莫]?(\d{1,3}|[一二两三四五六七八九十]{1,3})千/);
      const mPerW = t.match(/每章[约莫]?(\d{3,6})\s*字/);
      let per = 0;
      if (mPerK) per = (cnNum(mPerK[1]) || 0) * 1e3;
      else if (mPerW) per = parseInt(mPerW[1], 10) || 0;
      if (per) words = per * chapters;
    }
    return { chapters, words };
  },
  /** 更新下拉选中项的说明文字（perspective/style/length/era/motif/identity/timeline/aptitude/scale） */
  updateDesc(field) {
    const fw = window.storyFramework;
    const meta = fw.config.setupMeta || {};
    const map = { perspective: "perspectives", style: "styles", length: "lengths", era: "eras", motif: "motifs", identity: "identities", timeline: "timelines", region: "regions", aptitude: "aptitudes", scale: "lengths" };
    const sel = document.getElementById("wiz_" + field);
    const descEl = document.getElementById("wiz_desc_" + field);
    if (!sel) return;
    const id = sel.value;
    const item = (meta[map[field]] || []).find((x) => x.id === id);
    if (descEl) descEl.textContent = (item == null ? void 0 : item.desc) || (id === "custom" ? "✎ 已选自定义：请在下方亲笔书写，写多细，AI 执行多细" : "");
    if (this.state && field in this.state) this.state[field] = id || "";
  },
  /* ================================================================
     开放世界扮演模式（roleplay）· 身份设定台
     ================================================================ */
  renderRoleplay() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const fw = window.storyFramework;
    const config = fw.config;
    const meta = config.setupMeta || {};
    const seeds = config.nameSeeds || {};
    this.state = {
      playerName: "",
      gender: "男",
      age: 18,
      background: "",
      perspective: ((_a = (meta.perspectives || [])[0]) == null ? void 0 : _a.id) || "",
      style: ((_b = (meta.styles || [])[0]) == null ? void 0 : _b.id) || "",
      identity: ((_c = (meta.identities || [])[0]) == null ? void 0 : _c.id) || "",
      timeline: ((_d = (meta.timelines || [])[0]) == null ? void 0 : _d.id) || "",
      region: ((_e = (meta.regions || [])[0]) == null ? void 0 : _e.id) || "",
      aptitude: ((_f = (meta.aptitudes || [])[0]) == null ? void 0 : _f.id) || "",
      scale: ((_g = (meta.lengths || [])[1]) == null ? void 0 : _g.id) || ((_h = (meta.lengths || [])[0]) == null ? void 0 : _h.id) || "",
      opening: ((_i = (config.openings || [])[0]) == null ? void 0 : _i.id) || "",
      techniques: [],
      stats: { ...config.baseAttributes || {} },
      remainingPoints: config.maxPoints || 100
    };
    const container = document.getElementById("setupContainer");
    if (!container) return;
    let _s = 0;
    const num = () => "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮".charAt(_s++) || "";
    const sel = (field, label, arr, hint, ph2, long) => arr && arr.length ? `
            <div class="wiz-section">
                <div class="wiz-label">${num()} ${label} <button class="dice-btn" onclick="StorySetupWizard.diceField('${field}')" title="随机一项" aria-label="随机一项">🎲 随机</button>${hint ? ` <span class="wiz-hint">（${hint}）</span>` : ""}</div>
                <select id="wiz_${field}" class="wiz-select" onchange="StorySetupWizard.updateDesc('${field}');StorySetupWizard.toggleCustomField('${field}')">
                    ${arr.map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}
                    ${arr.some((x) => x.id === "custom") ? "" : '<option value="custom">✎ 自定义</option>'}
                </select>
                <div class="wiz-desc" id="wiz_desc_${field}"></div>
                <textarea id="wiz_custom_${field}" class="wiz-input custom-field-input" rows="${long ? 7 : 3}" maxlength="${long ? 1200 : 400}" style="display:none" placeholder="${ph2 || "✎ 自定义：亲笔书写，写多细 AI 执行多细"}"></textarea>
            </div>` : "";
    const ph = config.roleplayPlaceholders || {};
    const subIntro = config.roleplayIntro || "自定义身份，踏入原著世界开放漫游 —— 你不是原著主角，而是这个世界里自己的人：AI 主持整个世界，所有原著人物按原著性格与命运行动，你只能凭自己的身份与际遇活出一条路";
    const idPh = ph.identity || "自定义身份详述（家世/师承/技能/财产/目标/秘密/人际关系皆可写）——例：我姓陈，江南基地市旧城区人。父亲是退役军士长，教过我三年军体拳；母亲在武馆街区开小饭馆。白天在训练营做陪练，夜里自学监考资料。拳力已过900公斤，就差神经反应一关。家里欠着债，我必须考上武者——写多细，开局就多细";
    const tlPh = ph.timeline || "自定义时代节点：写清时间点与背景——例：大涅槃爆发前半年，旧秩序尚未崩塌，怪兽还只是市井传言";
    const rgPh = ph.region || "自定义地区：亲笔指定国家/城市/街区——例：1930年代的上海法租界；或 1969 年的底特律黑人区";
    const entryPh = ph.entry || "自定义入场事件——例：我蹲在武馆街区后巷数这个月的房租，电台里正播武者考核报名通知，巷口收材料的老教官瞥了我一眼……（写清场景与处境，AI 按此开场）";
    container.innerHTML = `
        <div class="wizard-card">
            <div class="wizard-title">✦ ${config.genreName} · 身份设定台</div>
            <div class="wizard-sub">${subIntro}</div>

            <div class="wiz-section wiz-stance-sec">
                <div class="wiz-label">✦ 叙事立场 <span class="wiz-hint">（你与原著主角的关系——开局后仍可随时切换）</span></div>
                <div class="wiz-stance">
                    <button type="button" class="wiz-stance-btn" data-stance="replace" onclick="StorySetupWizard.setStance('replace')">
                        <b>👑 取代主角</b><i>你就是原著主角本人</i>
                    </button>
                    <button type="button" class="wiz-stance-btn on" data-stance="cohabit" onclick="StorySetupWizard.setStance('cohabit')">
                        <b>🧍 同行者</b><i>你是世界的一份子（推荐）</i>
                    </button>
                    <button type="button" class="wiz-stance-btn" data-stance="freewill" onclick="StorySetupWizard.setStance('freewill')">
                        <b>🌪 搅局者</b><i>可改写原著大势</i>
                    </button>
                </div>
                <div class="wiz-desc" id="wiz_stanceHint"></div>
            </div>

            <div class="fate-hero">
                <div class="fate-copy"><b>随缘开局</b><span>不想逐项设置？一键随机全套身份 —— 姓名/身世/出身/时代/资质/入场事件/机缘/点数全帮你掷好，不满意可重掷，也可掷完再微调单项</span></div>
                <button class="fate-btn" onclick="StorySetupWizard.diceAll()">🎲 随缘开局</button>
            </div>

            <div class="wiz-row two-col">
                <div class="wiz-section">
                    <div class="wiz-label">${num()} 姓名 <button class="dice-btn" onclick="StorySetupWizard.dice('playerName')">🎲 随机</button></div>
                    <input id="wiz_playerName" class="wiz-input" type="text" maxlength="12" placeholder="你在原著世界的名字…">
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">${num()} 性别与年龄</div>
                    <div class="wiz-inline">
                        <select id="wiz_gender" class="wiz-select slim" onchange="StorySetupWizard.state.gender=this.value">
                            <option value="男">男</option>
                            <option value="女">女</option>
                        </select>
                        <input id="wiz_age" class="wiz-input slim" type="number" min="8" max="70" value="18" oninput="StorySetupWizard.state.age=parseInt(this.value)||18">
                    </div>
                </div>
            </div>

            <div class="wiz-section" id="wiz_backgroundSection">
                <div class="wiz-label">${num()} 身世自述 <button class="dice-btn" onclick="StorySetupWizard.dice('background')">🎲 随机</button></div>
                <textarea id="wiz_background" class="wiz-input" rows="2" maxlength="120" placeholder="你是谁？从哪来？为何踏上这条路…（留空则由身份与时代补全）"></textarea>
            </div>

            <div class="wiz-row two-col">
                ${sel("identity", "身份出身", meta.identities, config.identityHint || "决定你的起点与资源", idPh, true)}
                ${sel("timeline", "时代节点", meta.timelines, config.timelineHint || "", tlPh)}
            </div>

            ${sel("region", "国家/地区", meta.regions, config.regionHint || "在哪片土地上过日子——风土人情由此校准", rgPh)}

            <div class="wiz-row three-col">
                ${sel("aptitude", "资质天赋", meta.aptitudes, config.aptitudeHint || "", "自定义资质天赋：写清方向与程度——例：精神力异常敏锐远超常人，但筋骨平庸，拳力难涨")}
                ${sel("perspective", "叙述视角", meta.perspectives, "", "自定义叙述视角——例：第二人称「你」，冷静旁白，关键抉择前插入内心独白")}
                ${sel("style", "文风基调", meta.styles, config.styleHint || "正文按此味道落笔", "自定义文风——例：贴近原著的热血爽文风，短段落快节奏，战斗招式名目朗朗上口")}
            </div>

            ${sel("scale", "游玩规模", meta.lengths, "", "自定义游玩规模：写清回合量级与节奏——例：约 60 回合的中长途漫游，前慢后快，允许长期支线")}

            <div class="wiz-section">
                <div class="wiz-label">${num()} 入场事件 <span class="wiz-hint">（你踏入这个世界的第一幕，影响初始状态；可选 ✎ 自定义）</span></div>
                <div class="opening-grid">
                    ${(config.openings || []).map((o, i) => `
                        <div class="opening-item ${i === 0 ? "selected" : ""}" data-id="${o.id}" onclick="StorySetupWizard.selectOpening(this)">
                            <div class="opening-name">${o.name} <span class="pm ${o.pointsModifier >= 0 ? "plus" : "minus"}">${o.pointsModifier >= 0 ? "+" : ""}${o.pointsModifier}</span></div>
                            <div class="opening-desc">${o.description}</div>
                            ${o.effectsText ? `<div class="opening-effects">${o.effectsText}</div>` : ""}
                        </div>`).join("")}
                    <div class="opening-item custom-card" data-id="custom" onclick="StorySetupWizard.selectOpening(this)">
                        <div class="opening-name">✎ 自定义入场 <span class="pm plus">+0</span></div>
                        <div class="opening-desc">第一幕由你亲笔：场景 / 处境 / 事件，AI 按你写的开场并据此定初始状态</div>
                    </div>
                </div>
                <textarea id="wiz_custom_entry" class="wiz-input custom-field-input" rows="4" maxlength="500" style="display:none" placeholder="${entryPh}"></textarea>
            </div>

            <div class="wiz-section">
                <div class="wiz-label">${num()} 起始机缘 <span class="wiz-hint">（最多选 ${config.maxTechniques || 2} 项，每项消耗点数；可选 ✎ 自定义）</span></div>
                <div class="tech-grid">
                    ${(config.techniques || []).map((t) => `
                        <div class="tech-item" data-id="${t.id}" data-cost="${t.cost || 0}" onclick="StorySetupWizard.toggleTechnique(this)">
                            <div class="tech-name">${t.name} <span class="cost">-${t.cost || 0}</span></div>
                            <div class="tech-desc">${t.description}</div>
                        </div>`).join("")}
                    <div class="tech-item custom-card" data-id="custom" data-cost="10" onclick="StorySetupWizard.toggleTechnique(this)">
                        <div class="tech-name">✎ 自定义机缘 <span class="cost">-10</span></div>
                        <div class="tech-desc">机缘由你亲笔（消耗 10 点），AI 按原著逻辑定价与兑现</div>
                    </div>
                </div>
                <textarea id="wiz_custom_boon" class="wiz-input custom-field-input" rows="3" maxlength="400" style="display:none" placeholder="自定义起始机缘——例：祖传一枚不起眼的旧怀表，据说曾在废墟区救过人一命…（合理性由 AI 按原著逻辑校验兑现）"></textarea>
            </div>

            <div class="wiz-section">
                <div class="wiz-label">${num()} ${config.statsLabel || "角色资质"}
                    <span class="points-remain">剩余点数：<b id="wiz_remain">100</b></span>
                    <button class="dice-btn" onclick="StorySetupWizard.randomStats()">🎲 随机</button>
                </div>
                <div class="stats-grid" id="wiz_statsGrid"></div>
            </div>

            <div class="wizard-actions">
                <button class="btn-ghost wiz-exit" onclick="location.href='index.html'">🏠 返回大厅</button>
                <button class="btn-ghost" onclick="StorySetupWizard.diceAll()">🎲 全部随机</button>
                <button class="btn-solid big" onclick="StorySetupWizard.start()">${config.enterBtn || `🌏 踏入 ${config.genreName} 世界`}</button>
            </div>
        </div>`;
    const wrapEl = document.getElementById("setupWrap");
    if (wrapEl) wrapEl.style.display = "";
    const chatRestore = document.getElementById("chatArea");
    if (chatRestore) chatRestore.style.display = "none";
    container.style.display = "block";
    this.renderStatsGrid();
    ["identity", "timeline", "region", "aptitude", "perspective", "scale"].forEach((f) => {
      const selEl = document.getElementById("wiz_" + f);
      if (selEl && selEl.value === "custom") {
        const firstReal = [...selEl.options].find((o) => o.value !== "custom");
        if (firstReal) selEl.value = firstReal.value;
      }
    });
    ["perspective", "identity", "timeline", "region", "aptitude", "scale"].forEach((f) => this.updateDesc(f));
    ["identity", "timeline", "region", "aptitude", "perspective", "scale"].forEach((f) => this.toggleCustomField(f));
  },
  /** 扮演模式：任意选择项切「✎ 自定义」时展开亲笔输入框；身份自定义时隐藏身世自述（避免冲突） */
  toggleCustomField(field) {
    const selEl = document.getElementById("wiz_" + field);
    const ta = document.getElementById("wiz_custom_" + field);
    if (!ta) return;
    const isCustom = !!selEl && selEl.value === "custom";
    ta.style.display = isCustom ? "block" : "none";
    if (field === "identity") {
      const bgSec = document.getElementById("wiz_backgroundSection");
      if (bgSec) bgSec.style.display = isCustom ? "none" : "block";
    }
  },
  /** 任意下拉字段单独随机（identity/timeline/aptitude/perspective/scale/style…）
   *  避开「✎ 自定义」，且与当前选中值不同（薄池时最多试 8 次取异值） */
  diceField(field) {
    const fw = window.storyFramework;
    const meta = fw.config.setupMeta || {};
    const map = {
      identity: meta.identities,
      timeline: meta.timelines,
      region: meta.regions,
      aptitude: meta.aptitudes,
      perspective: meta.perspectives,
      scale: meta.lengths,
      style: meta.styles,
      era: meta.eras,
      motif: meta.motifs,
      length: meta.lengths
    };
    const arr = map[field];
    const el = document.getElementById("wiz_" + field);
    if (!arr || !arr.length || !el) return;
    const pool = arr.filter((x) => x.id !== "custom" && x.id !== el.value);
    const use = pool.length ? pool : arr.filter((x) => x.id !== "custom");
    if (!use.length) return;
    el.value = this.NameForge.pick(use).id;
    if (this.updateDesc) this.updateDesc(field);
    if (this.toggleCustomField) this.toggleCustomField(field);
  },
  /** 兼容旧调用（v1.4.1） */
  toggleCustomIdentity() {
    this.toggleCustomField("identity");
  },
  /* ==================== 姓名锻炉（组合式生成，万级变化） ====================
   * 旧版每世界只有 16 个固定姓名，随机几轮必重复 → 改为「姓氏 × 名字字符」组合引擎：
   *   - 通用姓氏池（单姓+复姓）+ 各世界风味名池（config.nameSeeds.flavor 覆写/叠加）
   *   - 性别联动：女性自动从女名池取字；复姓低概率出现更有仙侠味
   *   - 防重复：与上一次结果不同；2字名与3字名交替（避免全是同长度） */
  NameForge: {
    SURNAMES: ["陈", "秦", "林", "楚", "苏", "韩", "沈", "顾", "白", "江", "赵", "周", "许", "方", "程", "柳", "叶", "陆", "宋", "唐", "孟", "萧", "段", "云", "燕", "洛", "池", "岑", "温", "裴", "谢", "卓", "邵", "闻", "岳", "殷", "祁", "阮", "虞", "简"],
    COMPOUND: ["慕容", "上官", "欧阳", "司马", "独孤", "南宫", "西门", "东方", "公孙", "令狐"],
    GIVEN_M: ["玄", "岳", "渊", "寒", "澈", "霜", "浪", "远", "拓", "衍", "铮", "岸", "辰", "昭", "明", "夜", "尘", "霄", "烨", "珩", "黎", "朔", "砚", "樾", "澹", "珣", "翊", "旻", "洵", "屹", "川", "衡", "岸", "聿", "昀", "戈", "岑", "晏", "恪", "驰"],
    GIVEN_F: ["晚", "潼", "瑶", "璃", "月", "芷", "若", "素", "绾", "清", "婉", "离", "曼", "音", "阑", "黛", "汀", "汐", "璇", "泠", "鸢", "棠", "蕖", "滟", "蘅", "笙", "茴", "楹", "姒", "绡", "眠", "禾", "棠", "绫", "翎", "湄", "簌", "令", "鸾", "婴"],
    _last: null,
    pick(a) {
      return a[Math.floor(Math.random() * a.length)];
    },
    /** 生成一个名字：gender='男'|'女'；flavor={surname:[],m:[],f:[]} 世界风味覆写 */
    make(gender, flavor) {
      const f = flavor || {};
      const sur = [].concat(f.surname || [], this.SURNAMES);
      const comp = this.COMPOUND;
      const pool = gender === "女" ? [].concat(f.f || [], this.GIVEN_F) : [].concat(f.m || [], this.GIVEN_M);
      for (let i = 0; i < 8; i++) {
        const sn = Math.random() < 0.12 && comp.length ? this.pick(comp) : this.pick(sur);
        const g1 = this.pick(pool);
        let name = sn + g1;
        if (Math.random() < 0.45) {
          const g2 = this.pick(pool);
          if (g2 !== g1) name = sn + g1 + g2;
        }
        if (name !== this._last) {
          this._last = name;
          return name;
        }
      }
      return this._last || "无名";
    }
  },
  /** 扮演模式：随机姓名/身世 */
  diceRoleplay(field) {
    var _a;
    const fw = window.storyFramework;
    const seeds = fw.config.nameSeeds || {};
    if (field === "playerName") {
      const genderEl = document.getElementById("wiz_gender");
      const g = genderEl && genderEl.value || ((_a = this.state) == null ? void 0 : _a.gender) || "男";
      const v = this.NameForge.make(g, seeds.flavor);
      document.getElementById("wiz_playerName").value = v;
    } else if (field === "background") {
      const bs = seeds.backgrounds || [];
      const v = bs.length ? bs[Math.floor(Math.random() * bs.length)] : "";
      document.getElementById("wiz_background").value = v;
    } else if (field === "gender") {
      const el = document.getElementById("wiz_gender");
      if (el) el.value = Math.random() > 0.5 ? "女" : "男";
      this.state.gender = (el == null ? void 0 : el.value) || "男";
    }
  },
  /** 扮演模式：一键全随机 */
  diceAllRoleplay() {
    const fw = window.storyFramework;
    const seeds = fw.config.nameSeeds || {};
    const meta = fw.config.setupMeta || {};
    this.diceRoleplay("gender");
    this.diceRoleplay("playerName");
    this.diceRoleplay("background");
    const ageEl = document.getElementById("wiz_age");
    if (ageEl) {
      const r = seeds.ageRange || [14, 27];
      ageEl.value = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
      this.state.age = parseInt(ageEl.value);
    }
    const pick = (arr, id) => {
      if (!arr || !arr.length) return;
      const pool = arr.filter((x) => x.id !== "custom");
      if (!pool.length) return;
      const el = document.getElementById(id);
      if (el) el.value = pool[Math.floor(Math.random() * pool.length)].id;
    };
    pick(meta.identities, "wiz_identity");
    pick(meta.timelines, "wiz_timeline");
    pick(meta.regions, "wiz_region");
    pick(meta.aptitudes, "wiz_aptitude");
    pick(meta.perspectives, "wiz_perspective");
    pick(meta.lengths, "wiz_scale");
    ["identity", "timeline", "region", "aptitude", "perspective", "scale", "entry", "boon"].forEach((f) => {
      const ta = document.getElementById("wiz_custom_" + f);
      if (ta) {
        ta.style.display = "none";
        ta.value = "";
      }
    });
    ["perspective", "identity", "timeline", "region", "aptitude", "scale"].forEach((f) => this.updateDesc(f));
    const bgSec = document.getElementById("wiz_backgroundSection");
    if (bgSec) bgSec.style.display = "block";
    const openings = [...document.querySelectorAll(".opening-item")].filter((o) => o.getAttribute("data-id") !== "custom");
    if (openings.length) this.selectOpening(openings[Math.floor(Math.random() * openings.length)]);
    const customTech = document.querySelector('.tech-item[data-id="custom"]');
    if (customTech && customTech.classList.contains("selected")) this.toggleTechnique(customTech);
    const techItems = [...document.querySelectorAll(".tech-item")].filter((t) => t.getAttribute("data-id") !== "custom");
    techItems.forEach((t) => {
      if (t.classList.contains("selected")) this.toggleTechnique(t);
    });
    const shuffled = techItems.sort(() => Math.random() - 0.5);
    const max = fw.config.maxTechniques || 2;
    for (const t of shuffled) {
      if (this.state.techniques.length >= max) break;
      const cost = parseInt(t.getAttribute("data-cost")) || 0;
      if (cost <= this.state.remainingPoints) this.toggleTechnique(t);
    }
    this.randomStats();
  },
  /** 扮演模式：收集身份并入场 */
  /** v3.55.19 叙事立场：开局即选「取代主角 / 同行者 / 搅局者」——
      旧版没有这一项，想替代原著主角只能在自定义身份里手写，AI 常常认不出来 */
  setStance(id) {
    if (window.StoryStance && !StoryStance.MODES[id]) id = "cohabit";
    document.querySelectorAll(".wiz-stance-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.stance === id);
    });
    if (!window.StoryStance) return;
    StoryStance.set(id);
    const info = StoryStance.info();
    const canon = StoryStance.canonHeroName();
    const hint = document.getElementById("wiz_stanceHint");
    if (hint) {
      hint.textContent = id === "replace"
        ? "你就是" + canon + "本人——原著主线由你亲历，" + canon + "不再作为独立人物登场。"
        : id === "freewill"
          ? "你是自创角色，行动可以偏转甚至改写原著大势与" + canon + "的命运。"
          : "你是这世界里活生生的一份子；" + canon + "有他自己的人生主线，不因你而改道——除非你亲手夺走本属于他的东西。";
    }
  },
  async startRoleplay() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const fw = window.storyFramework;
    const config = fw.config;
    if (fw.isProcessing) return;
    if (!fw.isApiConfigured()) {
      fw.guideToConfig();
      return;
    }
    const meta = config.setupMeta || {};
    /* v3.55.19 落定叙事立场（取代主角 / 同行者 / 搅局者） */
    {
      const on = document.querySelector(".wiz-stance-btn.on");
      const sid = on && on.dataset.stance ? on.dataset.stance : "cohabit";
      if (window.StoryStance) StoryStance.set(sid);
    }
    const selVal = (field) => {
      var _a2;
      return ((_a2 = document.getElementById("wiz_" + field)) == null ? void 0 : _a2.value) || "";
    };
    const val = (field, arr) => (arr || []).find((x) => x.id === selVal(field)) || null;
    const customText = (field) => {
      const ta = document.getElementById("wiz_custom_" + field);
      return ta && ta.style.display !== "none" ? ta.value.trim() || "" : "";
    };
    const isCustomSel = (field) => selVal(field) === "custom";
    const customIdentityText = customText("identity");
    const customTimelineText = customText("timeline");
    const customRegionText = customText("region");
    const customAptitudeText = customText("aptitude");
    const customPerspectiveText = customText("perspective");
    const customStyleText = customText("style");
    const customScaleText = customText("scale");
    const customEntryText = customText("entry");
    const customBoonText = customText("boon");
    const identity = isCustomSel("identity") ? { id: "custom", name: "自定义身份", desc: "" } : val("identity", meta.identities) || ((_a = meta.identities) == null ? void 0 : _a[0]) || null;
    const timeline = isCustomSel("timeline") ? { id: "custom", name: "自定义时代节点", desc: "" } : val("timeline", meta.timelines) || ((_b = meta.timelines) == null ? void 0 : _b[0]) || null;
    const region = isCustomSel("region") ? { id: "custom", name: "自定义地区", desc: "" } : val("region", meta.regions) || null;
    const aptitude = isCustomSel("aptitude") ? { id: "custom", name: "自定义资质", desc: "" } : val("aptitude", meta.aptitudes) || ((_c = meta.aptitudes) == null ? void 0 : _c[0]) || null;
    const perspective = isCustomSel("perspective") ? { id: "custom", name: "自定义视角", desc: "" } : val("perspective", meta.perspectives) || ((_d = meta.perspectives) == null ? void 0 : _d[0]) || null;
    const style = isCustomSel("style") ? { id: "custom", name: "自定义文风", desc: "" } : val("style", meta.styles) || ((_e = meta.styles) == null ? void 0 : _e[0]) || null;
    const scale = isCustomSel("scale") ? { name: "自定义规模", chapters: 60, words: 0, desc: "" } : val("scale", meta.lengths) || { name: "开放漫游", chapters: 40, words: 0, desc: "" };
    const playerName = ((_f = document.getElementById("wiz_playerName")) == null ? void 0 : _f.value.trim()) || "";
    if (!playerName) {
      (_g = window.UIDialog) == null ? void 0 : _g.alert({ title: "缺少姓名", message: "请为你的角色起一个名字（或点 🎲 随机）" });
      /* v3.53.0：告警关掉后把光标送回姓名框，别让玩家在长表单里自己找 */
      setTimeout(function () {
        var el = document.getElementById("wiz_playerName");
        if (el) { el.focus(); el.classList.add("yj-shake"); setTimeout(function () { el.classList.remove("yj-shake"); }, 900); }
      }, 60);
      return;
    }
    const customChecks = [
      { field: "identity", label: "身份出身", text: customIdentityText, min: 10 },
      { field: "timeline", label: "时代节点", text: customTimelineText, min: 4 },
      { field: "region", label: "国家/地区", text: customRegionText, min: 4 },
      { field: "aptitude", label: "资质天赋", text: customAptitudeText, min: 4 },
      { field: "perspective", label: "叙述视角", text: customPerspectiveText, min: 4 },
      { field: "style", label: "文风基调", text: customStyleText, min: 4 },
      { field: "scale", label: "游玩规模", text: customScaleText, min: 4 }
    ];
    if (this.state.opening === "custom") customChecks.push({ field: "entry", label: "入场事件", text: customEntryText, min: 4 });
    if (this.state.techniques.includes("custom")) customChecks.push({ field: "boon", label: "起始机缘", text: customBoonText, min: 4 });
    const missing = customChecks.filter((c) => isCustomSel(c.field) || c.field === "entry" && this.state.opening === "custom" || c.field === "boon" && this.state.techniques.includes("custom")).filter((c) => c.text.length < c.min).map((c) => c.label);
    if (missing.length) {
      (_h = window.UIDialog) == null ? void 0 : _h.alert({ title: "自定义未填写", message: `以下选择了「✎ 自定义」但尚未填写：${missing.join("、")}。请在展开的输入框亲笔书写（写多细，AI 执行多细），或改选预设项。` });
      const first = customChecks.find((c) => c.label === missing[0]);
      if (first) (_i = document.getElementById("wiz_custom_" + first.field)) == null ? void 0 : _i.focus();
      return;
    }
    const setup = {
      mode: "roleplay",
      title: `《${playerName}·${config.genreName}》`,
      playerName,
      gender: ((_j = document.getElementById("wiz_gender")) == null ? void 0 : _j.value) || "男",
      age: parseInt((_k = document.getElementById("wiz_age")) == null ? void 0 : _k.value) || 18,
      background: isCustomSel("identity") ? "" : ((_l = document.getElementById("wiz_background")) == null ? void 0 : _l.value.trim()) || "",
      identity: (identity == null ? void 0 : identity.name) || "",
      identityDesc: (identity == null ? void 0 : identity.desc) || "",
      customIdentity: isCustomSel("identity") ? customIdentityText : "",
      timeline: (timeline == null ? void 0 : timeline.name) || "",
      timelineDesc: (timeline == null ? void 0 : timeline.desc) || "",
      customTimeline: isCustomSel("timeline") ? customTimelineText : "",
      region: (region == null ? void 0 : region.name) || "",
      regionDesc: (region == null ? void 0 : region.desc) || "",
      customRegion: isCustomSel("region") ? customRegionText : "",
      aptitude: (aptitude == null ? void 0 : aptitude.name) || "",
      aptitudeDesc: (aptitude == null ? void 0 : aptitude.desc) || "",
      customAptitude: isCustomSel("aptitude") ? customAptitudeText : "",
      perspective: (perspective == null ? void 0 : perspective.name) || "",
      perspectiveDesc: (perspective == null ? void 0 : perspective.desc) || "",
      customPerspective: isCustomSel("perspective") ? customPerspectiveText : "",
      style: (style == null ? void 0 : style.name) || "",
      styleDesc: (style == null ? void 0 : style.desc) || "",
      customStyle: isCustomSel("style") ? customStyleText : "",
      scale: scale.name,
      scaleDesc: scale.desc || "",
      customScale: isCustomSel("scale") ? customScaleText : "",
      totalChapters: scale.chapters || 40,
      targetWords: scale.words || 0,
      entryEvent: this.state.opening,
      customEntry: this.state.opening === "custom" ? customEntryText : "",
      boons: [...this.state.techniques],
      techniques: [...this.state.techniques],
      customBoon: this.state.techniques.includes("custom") ? customBoonText : "",
      stats: { ...this.state.stats }
    };
    fw.storyState.setup = setup;
    fw.storyState.isStoryStarted = true;
    (_n = (_m = window.DynamicWorld) == null ? void 0 : _m.updateDock) == null ? void 0 : _n.call(_m);
    const initVars = {
      title: setup.title,
      chapter: 0,
      totalChapters: setup.totalChapters,
      wordCount: 0,
      stats: { ...setup.stats },
      characters: {
        [playerName]: {
          role: isCustomSel("identity") ? "自定义身份（AI 将按详述建档补全）" : setup.identity || "自定义身份",
          status: config.startRealm || "初入世界",
          firstAppearance: "入场事件",
          isPlayer: true
        }
      },
      foreshadowings: [],
      items: [],
      history: []
    };
    (config.gauges || []).forEach((g) => {
      initVars[g.key] = g.default != null ? g.default : 50;
    });
    fw.storyState.variables = initVars;
    const setupWrap = document.getElementById("setupWrap");
    if (setupWrap) setupWrap.style.display = "none";
    const setupBox = document.getElementById("setupContainer");
    if (setupBox) setupBox.style.display = "none";
    const chatEl = document.getElementById("chatArea");
    if (chatEl) chatEl.style.display = "flex";
    fw.updateStatusPanel();
    fw.saveStory();
    const entryInstruction = config.buildOpeningInstruction ? config.buildOpeningInstruction(setup) : `【入场】玩家角色「${playerName}」（${setup.identity}）踏入《${config.genreName}》原著世界（${setup.timeline}）。请主持世界开场：呈现时代氛围与主角处境，引入首批原著人物或事件，结尾附(variable_update)变量块（玩家角色卡+登场NPC卡）与3-4个行动选项。`;
    const safeEntry = window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()) ? window.VariableAI.sanitizePrompt(entryInstruction) : entryInstruction;
    await window.StoryInput.send(safeEntry);
  },
  /* ================================================================
     自由世界 · 四步创世台（worldForge 模式，v3.24.0）
     壹 世界之魂 → 贰 世界法则 → 叁 社会与势力 → 肆 我的身份
     全字段亲笔自由 + 🎲 灵感池；系统唯一强制的只有防八股（知识库）
     ================================================================ */
  renderFreeworld() {
    var _a, _b, _c, _d, _e, _f;
    const fw = window.storyFramework;
    const config = fw.config;
    const meta = config.setupMeta || {};
    const seeds = config.nameSeeds || {};
    const ph = config.roleplayPlaceholders || {};
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    this.state = {
      playerName: "",
      gender: "男",
      age: 18,
      background: "",
      perspective: ((_a = (meta.perspectives || [])[0]) == null ? void 0 : _a.id) || "",
      style: ((_b = (meta.styles || [])[0]) == null ? void 0 : _b.id) || "",
      identity: "custom",
      aptitude: ((_c = (meta.aptitudes || [])[0]) == null ? void 0 : _c.id) || "",
      scale: ((_d = (meta.lengths || [])[1]) == null ? void 0 : _d.id) || ((_e = (meta.lengths || [])[0]) == null ? void 0 : _e.id) || "",
      opening: ((_f = (config.openings || [])[0]) == null ? void 0 : _f.id) || "",
      techniques: [],
      stats: { ...config.baseAttributes || {} },
      remainingPoints: config.maxPoints || 100
    };
    const container = document.getElementById("setupContainer");
    if (!container) return;
    const sel = (field, label, arr, hint, phText, long) => arr && arr.length ? `
            <div class="wiz-section">
                <div class="wiz-label">${label} <button class="dice-btn" onclick="StorySetupWizard.diceField('${field}')" title="随机一项">🎲</button>${hint ? ` <span class="wiz-hint">（${hint}）</span>` : ""}</div>
                <select id="wiz_${field}" class="wiz-select" onchange="StorySetupWizard.updateDesc('${field}');StorySetupWizard.toggleCustomField('${field}')">
                    ${arr.map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}
                    ${arr.some((x) => x.id === "custom") ? "" : '<option value="custom">✎ 自定义</option>'}
                </select>
                <div class="wiz-desc" id="wiz_desc_${field}"></div>
                <textarea id="wiz_custom_${field}" class="wiz-input custom-field-input" rows="${long ? 7 : 3}" maxlength="${long ? 1200 : 400}" style="display:none" placeholder="${phText || "✎ 自定义：亲笔书写，写多细 AI 执行多细"}"></textarea>
            </div>` : "";
    const lawSel = (field, label, arr) => `
            <div class="wiz-section">
                <div class="wiz-label">${label} <button class="dice-btn" onclick="StorySetupWizard.diceFreeworld('${field}')">🎲</button></div>
                <select id="fw_${field}" class="wiz-select" onchange="StorySetupWizard.toggleFwCustom('${field}')">
                    ${arr.map((x) => `<option value="${x}">${x}</option>`).join("")}
                    <option value="custom">✎ 自定义</option>
                </select>
                <textarea id="fw_custom_${field}" class="wiz-input custom-field-input" rows="2" maxlength="200" style="display:none" placeholder="${ph[field] || "✎ 亲笔书写这条法则"}"></textarea>
            </div>`;
    const colorOpts = Object.entries({ jade: "翡翠", gold: "鎏金", azure: "青蓝", rose: "胭脂", violet: "紫电" }).map(([k, n]) => `<option value="${k}">${n}</option>`).join("");
    const gaugeRow = (i, label, color, val) => `
            <div class="fw-gauge-row">
                <input id="fw_gauge_label_${i}" class="wiz-input slim" type="text" maxlength="6" placeholder="量表名（如：${["修为", "伤势", "理智"][i]}）" value="${label}">
                <select id="fw_gauge_color_${i}" class="wiz-select slim">${colorOpts.replace(`value="${color}"`, `value="${color}" selected`)}</select>
                <input id="fw_gauge_val_${i}" class="wiz-input slim" type="number" min="0" max="100" value="${val}" title="初始值 0-100">
            </div>`;
    const facRow = (i) => `
            <div class="fw-fac-row">
                <input id="fw_fac_name_${i}" class="wiz-input slim" type="text" maxlength="6" placeholder="势力名（如：${pick(seeds.factionNames || ["黑风寨"])}）">
                <input id="fw_fac_stance_${i}" class="wiz-input" type="text" maxlength="24" placeholder="一句话立场（可空）">
                <button class="dice-btn" onclick="StorySetupWizard.diceFreeworld('faction${i}')" title="随机一组">🎲</button>
            </div>`;
    container.innerHTML = `
        <div class="wizard-card fw-forge">
            <div class="wizard-title">🔨 ${config.genreName} · 创世台</div>
            <div class="wizard-sub">${config.roleplayIntro || ""}</div>

            <div class="fate-hero">
                <div class="fate-copy"><b>随缘创世</b><span>不想逐项落笔？一键随机一个世界 —— 之魂/法则/历法/地理/势力/量表/身份全帮你掷好，掷完再逐项微调</span></div>
                <button class="fate-btn" onclick="StorySetupWizard.diceAllFreeworld()">🎲 随缘创世</button>
            </div>

            <div class="fw-rail">
                <div class="fw-rail-node" onclick="document.getElementById('fwMile1').scrollIntoView({behavior:'smooth',block:'start'})"><i>壹</i><span>世界之魂</span></div>
                <div class="fw-rail-node" onclick="document.getElementById('fwMile2').scrollIntoView({behavior:'smooth',block:'start'})"><i>贰</i><span>世界法则</span></div>
                <div class="fw-rail-node" onclick="document.getElementById('fwMile3').scrollIntoView({behavior:'smooth',block:'start'})"><i>叁</i><span>社会与势力</span></div>
                <div class="fw-rail-node" onclick="document.getElementById('fwMile4').scrollIntoView({behavior:'smooth',block:'start'})"><i>肆</i><span>我的身份</span></div>
            </div>

            <div class="fw-mile" id="fwMile1">
                <div class="fw-mile-head">
                    <span class="fw-mile-no">壹</span>
                    <div class="fw-mile-title"><b>世界之魂</b><span>这是个什么世界——一句话也行，一段话更好；这是创世台唯一必填的一笔</span></div>
                    <button class="dice-btn" onclick="StorySetupWizard.diceFreeworld('soul')">🎲 灵感</button>
                </div>
                <textarea id="fw_soul" class="wiz-input fw-soul-input" rows="4" maxlength="600" placeholder="${ph.soul || "一句话或一段话，说清这是一个什么世界……写多细，世界就执行多细"}"></textarea>
            </div>

            <div class="fw-mile" id="fwMile2">
                <div class="fw-mile-head">
                    <span class="fw-mile-no">贰</span>
                    <div class="fw-mile-title"><b>世界法则</b><span>力量怎么算、人怎么死、日子怎么数——都可留空，留空则按世界之魂自行推导</span></div>
                </div>
                <div class="wiz-row two-col">
                    ${lawSel("power", "力量体系", seeds.powers || [])}
                    ${lawSel("death", "生死法则", seeds.deaths || [])}
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">时代与历法 <button class="dice-btn" onclick="StorySetupWizard.diceFreeworld('era')">🎲</button></div>
                    <input id="fw_era" class="wiz-input" type="text" maxlength="80" placeholder="${ph.era || "例：玄历三年，新朝立国不久；或无历法，以物候记年"}">
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">通讯形态 <span class="wiz-hint">（决定这个世界的人怎么联络——AI 严格照此约束一切消息往来）</span></div>
                    <select id="fw_comm" class="wiz-select" onchange="document.getElementById('fw_desc_comm').textContent=this.selectedOptions[0].dataset.d||''">
                        <option value="" data-d="未约定——按世界之魂的质感与时代常识自行校准">未约定（按世界质感推导）</option>
                        <option value="none" data-d="没有远距通讯——消息靠腿、靠吼、靠烽烟与驿站，重要的话要当面说">无远距通讯（消息靠腿）</option>
                        <option value="letter" data-d="书信/信使为主——慢是常态，一封信走数日，急事靠捎口信">书信与信使</option>
                        <option value="instant" data-d="存在即时通讯（聊天软件/传讯法阵/心灵网络）——消息即生活的一部分">即时通讯（类微信）</option>
                        <option value="mixed" data-d="新旧并存（电报与信使并存/法阵与飞鸽并用）——按场景与阶层如实区分">新旧并存</option>
                    </select>
                    <div class="wiz-desc" id="fw_desc_comm"></div>
                </div>
            </div>

            <div class="fw-mile" id="fwMile3">
                <div class="fw-mile-head">
                    <span class="fw-mile-no">叁</span>
                    <div class="fw-mile-title"><b>社会与势力</b><span>舞台在哪、谁说了算——势力最多四家，也可以一家不填（世界不因势力而必须喧闹）</span></div>
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">舞台地理 <button class="dice-btn" onclick="StorySetupWizard.diceFreeworld('geo')">🎲</button></div>
                    <textarea id="fw_geo" class="wiz-input" rows="2" maxlength="200" placeholder="${ph.geo || "例：云梦泽南岸的水镇，三条街一座桥……"}"></textarea>
                </div>
                <div class="wiz-section">
                    <div class="wiz-label">势力版图 <span class="wiz-hint">（可留空；留空的行自动忽略）</span></div>
                    ${facRow(0)}${facRow(1)}${facRow(2)}
                </div>
            </div>

            <div class="fw-mile" id="fwMile4">
                <div class="fw-mile-head">
                    <span class="fw-mile-no">肆</span>
                    <div class="fw-mile-title"><b>我的身份</b><span>你是谁、有什么本事、从哪一天醒来——写多细，开局就多细</span></div>
                </div>

                <div class="wiz-row two-col">
                    <div class="wiz-section">
                        <div class="wiz-label">姓名 <button class="dice-btn" onclick="StorySetupWizard.diceRoleplay('playerName')">🎲 随机</button></div>
                        <input id="wiz_playerName" class="wiz-input" type="text" maxlength="12" placeholder="你在这个世界的名字…">
                    </div>
                    <div class="wiz-section">
                        <div class="wiz-label">性别与年龄</div>
                        <div class="wiz-inline">
                            <select id="wiz_gender" class="wiz-select slim" onchange="StorySetupWizard.state.gender=this.value">
                                <option value="男">男</option>
                                <option value="女">女</option>
                            </select>
                            <input id="wiz_age" class="wiz-input slim" type="number" min="8" max="70" value="18" oninput="StorySetupWizard.state.age=parseInt(this.value)||18">
                        </div>
                    </div>
                </div>

                <div class="wiz-section" id="wiz_backgroundSection" style="display:none">
                    <div class="wiz-label">身世自述 <button class="dice-btn" onclick="StorySetupWizard.diceRoleplay('background')">🎲 随机</button></div>
                    <textarea id="wiz_background" class="wiz-input" rows="2" maxlength="120" placeholder="你是谁？从哪来？为何在此……（选了自定义身份时无需填写，写进身份里更细）"></textarea>
                </div>

                ${sel("identity", "身份出身", meta.identities, "自由世界推荐亲笔详述", ph.identity, true)}

                <div class="wiz-row two-col">
                    ${sel("aptitude", "资质天赋", meta.aptitudes, "上天赏的那碗饭（或没赏）", "自定义资质天赋：写清方向与程度——例：天生神力但五感迟钝")}
                    ${sel("perspective", "叙述视角", meta.perspectives, "", "自定义叙述视角——例：第二人称「你」，冷静旁白，关键抉择前插入内心独白")}
                </div>

                <div class="wiz-row two-col">
                    ${sel("style", "文风基调", meta.styles, "正文按此味道落笔", "自定义文风——例：市井烟火，短段落，对话密，旁白省")}
                    ${sel("scale", "游玩规模", meta.lengths, "", "自定义游玩规模：写清回合量级与节奏——例：约 60 回合的中长途人生")}
                </div>

                <div class="wiz-section">
                    <div class="wiz-label">本世量表 <span class="wiz-hint">（这个世界怎么度量你的人生——最多 3 枚，留空则用通用的 状态/生计）</span></div>
                    ${gaugeRow(0, "", "jade", 70)}${gaugeRow(1, "", "gold", 50)}${gaugeRow(2, "", "azure", 50)}
                </div>

                <div class="wiz-section">
                    <div class="wiz-label">入场事件 <span class="wiz-hint">（你踏入这个世界的第一幕；可选 ✎ 自定义）</span></div>
                    <div class="opening-grid">
                        ${(config.openings || []).map((o, i) => `
                            <div class="opening-item ${i === 0 ? "selected" : ""}" data-id="${o.id}" onclick="StorySetupWizard.selectOpening(this)">
                                <div class="opening-name">${o.name} <span class="pm ${o.pointsModifier >= 0 ? "plus" : "minus"}">${o.pointsModifier >= 0 ? "+" : ""}${o.pointsModifier}</span></div>
                                <div class="opening-desc">${o.description}</div>
                            </div>`).join("")}
                        <div class="opening-item custom-card" data-id="custom" onclick="StorySetupWizard.selectOpening(this)">
                            <div class="opening-name">✎ 自定义入场 <span class="pm plus">+0</span></div>
                            <div class="opening-desc">第一幕由你亲笔：场景 / 处境 / 事件，AI 按你写的开场并据此定初始状态</div>
                        </div>
                    </div>
                    <textarea id="wiz_custom_entry" class="wiz-input custom-field-input" rows="4" maxlength="500" style="display:none" placeholder="${ph.entry || "自定义入场第一幕……（写清场景与处境，AI 按此开场）"}"></textarea>
                </div>

                <div class="wiz-section">
                    <div class="wiz-label">起始机缘 <span class="wiz-hint">（最多选 ${config.maxTechniques || 3} 项，每项消耗点数；可选 ✎ 自定义）</span></div>
                    <div class="tech-grid">
                        ${(config.techniques || []).map((t) => `
                            <div class="tech-item" data-id="${t.id}" data-cost="${t.cost || 0}" onclick="StorySetupWizard.toggleTechnique(this)">
                                <div class="tech-name">${t.name} <span class="cost">-${t.cost || 0}</span></div>
                                <div class="tech-desc">${t.description}</div>
                            </div>`).join("")}
                        <div class="tech-item custom-card" data-id="custom" data-cost="10" onclick="StorySetupWizard.toggleTechnique(this)">
                            <div class="tech-name">✎ 自定义机缘 <span class="cost">-10</span></div>
                            <div class="tech-desc">机缘由你亲笔（消耗 10 点），AI 按这个世界的逻辑定价与兑现</div>
                        </div>
                    </div>
                    <textarea id="wiz_custom_boon" class="wiz-input custom-field-input" rows="3" maxlength="400" style="display:none" placeholder="自定义起始机缘——例：祖传一枚不起眼的旧物，据说曾在要紧时候救过人一命…（合理性由 AI 按世界宪法校验兑现）"></textarea>
                </div>

                <div class="wiz-section">
                    <div class="wiz-label">${config.statsLabel || "角色资质"}
                        <span class="points-remain">剩余点数：<b id="wiz_remain">100</b></span>
                        <button class="dice-btn" onclick="StorySetupWizard.randomStats()">🎲 随机</button>
                    </div>
                    <div class="stats-grid" id="wiz_statsGrid"></div>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="btn-ghost wiz-exit" onclick="location.href='index.html'">🏠 返回大厅</button>
                <button class="btn-ghost" onclick="StorySetupWizard.diceAllFreeworld()">🎲 随缘创世</button>
                <button class="btn-solid big" onclick="StorySetupWizard.startFreeworld()">${config.enterBtn || "🔨 落笔成世，开始生活"}</button>
            </div>
        </div>`;
    const wrapEl = document.getElementById("setupWrap");
    if (wrapEl) wrapEl.style.display = "";
    const chatRestore = document.getElementById("chatArea");
    if (chatRestore) chatRestore.style.display = "none";
    container.style.display = "block";
    this.renderStatsGrid();
    const idSel = document.getElementById("wiz_identity");
    if (idSel) {
      idSel.value = "custom";
      this.state.identity = "custom";
    }
    ["identity", "aptitude", "perspective", "scale", "style"].forEach((f) => this.updateDesc(f));
    ["identity", "aptitude", "perspective", "scale", "style"].forEach((f) => this.toggleCustomField(f));
  },
  /** 法则下拉（力量/生死）切「✎ 自定义」时展开亲笔框 */
  toggleFwCustom(field) {
    const selEl = document.getElementById("fw_" + field);
    const ta = document.getElementById("fw_custom_" + field);
    if (!ta || !selEl) return;
    ta.style.display = selEl.value === "custom" ? "block" : "none";
  },
  /** 创世台灵感骰：soul/power/death/era/geo/factionN/gauges */
  diceFreeworld(field) {
    var _a, _b;
    const seeds = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.config) == null ? void 0 : _b.nameSeeds) || {};
    const F = window.FreeWorldForge;
    const pick = (a) => a && a.length ? a[Math.floor(Math.random() * a.length)] : "";
    const setSel = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    if (field === "soul") {
      const el = document.getElementById("fw_soul");
      if (el) el.value = pick(seeds.souls);
    } else if (field === "power" || field === "death") {
      const pool = field === "power" ? seeds.powers || [] : seeds.deaths || [];
      const v = pick(pool);
      if (v) {
        setSel("fw_" + field, v);
        this.toggleFwCustom(field);
      }
    } else if (field === "era") {
      const el = document.getElementById("fw_era");
      if (el) el.value = pick(seeds.eras);
    } else if (field === "geo") {
      const el = document.getElementById("fw_geo");
      if (el) el.value = pick(seeds.geos);
    } else if (/^faction\d$/.test(field)) {
      const i = field.slice(-1);
      setSel("fw_fac_name_" + i, pick(seeds.factionNames));
      setSel("fw_fac_stance_" + i, pick(seeds.factionStances));
    } else if (field === "gauges") {
      const trios = [
        [["修为", "jade", 20], ["伤势", "rose", 10], ["银钱", "gold", 30]],
        [["理智", "azure", 65], ["污染度", "violet", 5], ["物资", "gold", 40]],
        [["体力", "jade", 70], ["心情", "rose", 60], ["人望", "gold", 20]],
        [["境界", "violet", 5], ["灵石", "azure", 15], ["仇怨", "rose", 10]]
      ];
      const trio = pick(trios) || [];
      trio.forEach((g, i) => {
        setSel("fw_gauge_label_" + i, g[0]);
        setSel("fw_gauge_color_" + i, g[1]);
        setSel("fw_gauge_val_" + i, String(g[2]));
      });
    }
  },
  /** 一键随缘创世：世界四步 + 身份全套全掷 */
  diceAllFreeworld() {
    const fw = window.storyFramework;
    const seeds = fw.config.nameSeeds || {};
    const meta = fw.config.setupMeta || {};
    this.diceRoleplay("gender");
    this.diceRoleplay("playerName");
    const ageEl = document.getElementById("wiz_age");
    if (ageEl) {
      const r = seeds.ageRange || [16, 42];
      ageEl.value = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
      this.state.age = parseInt(ageEl.value);
    }
    this.diceFreeworld("soul");
    this.diceFreeworld("power");
    this.diceFreeworld("death");
    this.diceFreeworld("era");
    this.diceFreeworld("geo");
    this.diceFreeworld("faction0");
    this.diceFreeworld("faction1");
    const fn2 = document.getElementById("fw_fac_name_2");
    if (fn2) fn2.value = "";
    this.diceFreeworld("gauges");
    const idEl = document.getElementById("wiz_identity");
    if (idEl) {
      const pool = (meta.identities || []).filter((x) => x.id !== "custom");
      if (pool.length) idEl.value = pool[Math.floor(Math.random() * pool.length)].id;
      this.state.identity = idEl.value;
      this.updateDesc("identity");
      this.toggleCustomField("identity");
    }
    const idTa = document.getElementById("wiz_custom_identity");
    if (idTa) {
      idTa.value = "";
    }
    const bgTa = document.getElementById("wiz_background");
    if (bgTa) bgTa.value = "";
    ["aptitude", "perspective", "scale", "style"].forEach((f) => this.diceField(f));
    const openings = [...document.querySelectorAll(".opening-item")].filter((o) => o.getAttribute("data-id") !== "custom");
    if (openings.length) this.selectOpening(openings[Math.floor(Math.random() * openings.length)]);
    const customTech = document.querySelector('.tech-item[data-id="custom"]');
    if (customTech && customTech.classList.contains("selected")) this.toggleTechnique(customTech);
    const techItems = [...document.querySelectorAll(".tech-item")].filter((t) => t.getAttribute("data-id") !== "custom");
    techItems.forEach((t) => {
      if (t.classList.contains("selected")) this.toggleTechnique(t);
    });
    const shuffled = techItems.sort(() => Math.random() - 0.5);
    const max = fw.config.maxTechniques || 3;
    for (const t of shuffled) {
      if (this.state.techniques.length >= max) break;
      const cost = parseInt(t.getAttribute("data-cost")) || 0;
      if (cost <= this.state.remainingPoints) this.toggleTechnique(t);
    }
    this.randomStats();
  },
  /** 创世台落笔：收集四步 → 校验 → 世界宪法落库 → 入场 */
  async startFreeworld() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t;
    const fw = window.storyFramework;
    const config = fw.config;
    if (fw.isProcessing) return;
    if (!fw.isApiConfigured()) {
      fw.guideToConfig();
      return;
    }
    const F = window.FreeWorldForge;
    const meta = config.setupMeta || {};
    const selVal = (f) => {
      var _a2;
      return ((_a2 = document.getElementById("wiz_" + f)) == null ? void 0 : _a2.value) || "";
    };
    const customText = (f) => {
      const ta = document.getElementById("wiz_custom_" + f);
      return ta && ta.style.display !== "none" ? ta.value.trim() || "" : "";
    };
    const isCustomSel = (f) => selVal(f) === "custom";
    const fwVal = (f) => {
      const selEl = document.getElementById("fw_" + f);
      if (!selEl) return "";
      if (selEl.value === "custom") {
        const ta = document.getElementById("fw_custom_" + f);
        return ta && ta.value.trim() ? ta.value.trim() : "";
      }
      return selEl.value;
    };
    const playerName = ((_a = document.getElementById("wiz_playerName")) == null ? void 0 : _a.value.trim()) || "";
    if (!playerName) {
      (_b = window.UIDialog) == null ? void 0 : _b.alert({ title: "缺少姓名", message: "请为你的角色起一个名字（或点 🎲 随机）" });
      return;
    }
    const soul = ((_c = document.getElementById("fw_soul")) == null ? void 0 : _c.value.trim()) || "";
    if (soul.length < 10) {
      (_d = window.UIDialog) == null ? void 0 : _d.alert({ title: "世界之魂尚未落笔", message: "「这是个什么世界」是创世的根基，请至少写 10 个字（一句话也行）——写多细，世界就执行多细。或点 🎲 灵感掷一个再改。" });
      (_e = document.getElementById("fw_soul")) == null ? void 0 : _e.focus();
      return;
    }
    const lawMissing = [];
    ["power", "death"].forEach((f) => {
      const selEl = document.getElementById("fw_" + f);
      const ta = document.getElementById("fw_custom_" + f);
      if (selEl && selEl.value === "custom" && (!ta || (ta.value.trim() || "").length < 4)) {
        lawMissing.push(f === "power" ? "力量体系" : "生死法则");
      }
    });
    if (lawMissing.length) {
      (_f = window.UIDialog) == null ? void 0 : _f.alert({ title: "法则未填写", message: `以下法则选了「✎ 自定义」但尚未亲笔：${lawMissing.join("、")}。请写清内容，或改选预设项。` });
      return;
    }
    const customChecks = [
      { field: "identity", label: "身份出身", text: customText("identity"), min: 10 },
      { field: "aptitude", label: "资质天赋", text: customText("aptitude"), min: 4 },
      { field: "perspective", label: "叙述视角", text: customText("perspective"), min: 4 },
      { field: "style", label: "文风基调", text: customText("style"), min: 4 },
      { field: "scale", label: "游玩规模", text: customText("scale"), min: 4 }
    ];
    if (this.state.opening === "custom") customChecks.push({ field: "entry", label: "入场事件", text: customText("entry"), min: 4 });
    if (this.state.techniques.includes("custom")) customChecks.push({ field: "boon", label: "起始机缘", text: customText("boon"), min: 4 });
    const missing = customChecks.filter((c) => isCustomSel(c.field) || c.field === "entry" && this.state.opening === "custom" || c.field === "boon" && this.state.techniques.includes("custom")).filter((c) => c.text.length < c.min).map((c) => c.label);
    if (missing.length) {
      (_g = window.UIDialog) == null ? void 0 : _g.alert({ title: "自定义未填写", message: `以下选择了「✎ 自定义」但尚未填写：${missing.join("、")}。请在展开的输入框亲笔书写，或改选预设项。` });
      const first = customChecks.find((c) => c.label === missing[0]);
      if (first) (_h = document.getElementById("wiz_custom_" + first.field)) == null ? void 0 : _h.focus();
      return;
    }
    const factions = F.sanitizeFactions([0, 1, 2].map((i) => {
      var _a2, _b2;
      return {
        name: ((_a2 = document.getElementById("fw_fac_name_" + i)) == null ? void 0 : _a2.value.trim()) || "",
        stance: ((_b2 = document.getElementById("fw_fac_stance_" + i)) == null ? void 0 : _b2.value.trim()) || ""
      };
    }));
    const gauges = F.sanitizeGauges([0, 1, 2].map((i) => {
      var _a2, _b2, _c2;
      return {
        label: ((_a2 = document.getElementById("fw_gauge_label_" + i)) == null ? void 0 : _a2.value.trim()) || "",
        color: ((_b2 = document.getElementById("fw_gauge_color_" + i)) == null ? void 0 : _b2.value) || "jade",
        default: parseInt((_c2 = document.getElementById("fw_gauge_val_" + i)) == null ? void 0 : _c2.value, 10)
      };
    }));
    const worldCode = {
      soul,
      power: fwVal("power"),
      death: fwVal("death"),
      era: ((_i = document.getElementById("fw_era")) == null ? void 0 : _i.value.trim()) || "",
      geo: ((_j = document.getElementById("fw_geo")) == null ? void 0 : _j.value.trim()) || "",
      comm: ((_k = document.getElementById("fw_comm")) == null ? void 0 : _k.value) || "",
      factions,
      gauges,
      amendments: []
      // 运行时增补（世界宪法卡可随时立新法）
    };
    const val = (field, arr) => (arr || []).find((x) => x.id === selVal(field)) || null;
    const identity = isCustomSel("identity") ? { id: "custom", name: "自定义身份", desc: "" } : val("identity", meta.identities) || ((_l = meta.identities) == null ? void 0 : _l[0]) || null;
    const aptitude = isCustomSel("aptitude") ? { id: "custom", name: "自定义资质", desc: "" } : val("aptitude", meta.aptitudes) || ((_m = meta.aptitudes) == null ? void 0 : _m[0]) || null;
    const perspective = isCustomSel("perspective") ? { id: "custom", name: "自定义视角", desc: "" } : val("perspective", meta.perspectives) || ((_n = meta.perspectives) == null ? void 0 : _n[0]) || null;
    const style = isCustomSel("style") ? { id: "custom", name: "自定义文风", desc: "" } : val("style", meta.styles) || ((_o = meta.styles) == null ? void 0 : _o[0]) || null;
    const scale = isCustomSel("scale") ? { name: "自定义规模", chapters: 60, words: 0, desc: "" } : val("scale", meta.lengths) || { name: "一季光阴", chapters: 40, words: 0, desc: "" };
    const worldShort = soul.slice(0, 6);
    const setup = {
      mode: "roleplay",
      title: `《${playerName}·${worldShort}》`,
      playerName,
      gender: ((_p = document.getElementById("wiz_gender")) == null ? void 0 : _p.value) || "男",
      age: parseInt((_q = document.getElementById("wiz_age")) == null ? void 0 : _q.value) || 18,
      background: isCustomSel("identity") ? "" : ((_r = document.getElementById("wiz_background")) == null ? void 0 : _r.value.trim()) || "",
      identity: (identity == null ? void 0 : identity.name) || "",
      identityDesc: (identity == null ? void 0 : identity.desc) || "",
      customIdentity: isCustomSel("identity") ? customText("identity") : "",
      timeline: worldCode.era || "玩家自定世界",
      timelineDesc: "",
      customTimeline: "",
      aptitude: (aptitude == null ? void 0 : aptitude.name) || "",
      aptitudeDesc: (aptitude == null ? void 0 : aptitude.desc) || "",
      customAptitude: isCustomSel("aptitude") ? customText("aptitude") : "",
      perspective: (perspective == null ? void 0 : perspective.name) || "",
      perspectiveDesc: (perspective == null ? void 0 : perspective.desc) || "",
      customPerspective: isCustomSel("perspective") ? customText("perspective") : "",
      style: (style == null ? void 0 : style.name) || "",
      styleDesc: (style == null ? void 0 : style.desc) || "",
      customStyle: isCustomSel("style") ? customText("style") : "",
      scale: scale.name,
      scaleDesc: scale.desc || "",
      customScale: isCustomSel("scale") ? customText("scale") : "",
      totalChapters: scale.chapters || 40,
      targetWords: scale.words || 0,
      entryEvent: this.state.opening,
      customEntry: this.state.opening === "custom" ? customText("entry") : "",
      boons: [...this.state.techniques],
      techniques: [...this.state.techniques],
      customBoon: this.state.techniques.includes("custom") ? customText("boon") : "",
      stats: { ...this.state.stats },
      worldCode,
      // 世界宪法（本世界最高法则，随档保存）
      comm: worldCode.comm
    };
    fw.storyState.setup = setup;
    fw.storyState.isStoryStarted = true;
    (_t = (_s = window.DynamicWorld) == null ? void 0 : _s.updateDock) == null ? void 0 : _t.call(_s);
    const initVars = {
      title: setup.title,
      chapter: 0,
      totalChapters: setup.totalChapters,
      wordCount: 0,
      stats: { ...setup.stats },
      characters: {
        [playerName]: {
          role: isCustomSel("identity") ? "自定义身份（AI 将按详述建档补全）" : setup.identity || "自定义身份",
          status: config.startRealm || "初来乍到",
          firstAppearance: "入场事件",
          isPlayer: true
        }
      },
      foreshadowings: [],
      items: [],
      history: []
    };
    gauges.forEach((g) => {
      initVars[g.key] = g.default;
    });
    factions.forEach((f) => {
      initVars["声望·" + f.name] = 30;
    });
    fw.storyState.variables = initVars;
    if (typeof config.applyGauges === "function") {
      config.applyGauges(fw, gauges);
    } else {
      config.gauges = gauges;
      config.statusFields = gauges.map((g) => g.key);
    }
    const setupWrap = document.getElementById("setupWrap");
    if (setupWrap) setupWrap.style.display = "none";
    const setupBox = document.getElementById("setupContainer");
    if (setupBox) setupBox.style.display = "none";
    const chatEl = document.getElementById("chatArea");
    if (chatEl) chatEl.style.display = "flex";
    fw.updateStatusPanel();
    fw.saveStory();
    const entryInstruction = config.buildOpeningInstruction ? config.buildOpeningInstruction(setup) : `【创世入场】玩家角色「${playerName}」降生于玩家亲笔创造的世界。请主持世界开场：按世界宪法呈现生活切片，结尾附(variable_update)变量块与3-4个【行动选项】。`;
    const safeEntry = window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()) ? window.VariableAI.sanitizePrompt(entryInstruction) : entryInstruction;
    await window.StoryInput.send(safeEntry);
  },
  renderStatsGrid() {
    const fw = window.storyFramework;
    const config = fw.config;
    const grid = document.getElementById("wiz_statsGrid");
    if (!grid) return;
    grid.innerHTML = (config.statKeys || []).map((s) => {
      var _a;
      return `
            <div class="stat-alloc">
                <span class="sa-label">${s.label}</span>
                <button class="sa-btn" onclick="StorySetupWizard.statChange('${s.key}', -5)">−</button>
                <span class="sa-num" id="sa_${s.key}">${(_a = this.state.stats[s.key]) != null ? _a : 10}</span>
                <button class="sa-btn" onclick="StorySetupWizard.statChange('${s.key}', 5)">+</button>
            </div>`;
    }).join("");
    this.updateRemain();
  },
  statChange(key, delta) {
    var _a;
    const val = ((_a = this.state.stats[key]) != null ? _a : 0) + delta;
    if (delta > 0 && this.state.remainingPoints < delta) return;
    if (val < 0 || val > 60) return;
    if (delta > 0) this.state.remainingPoints -= delta;
    else this.state.remainingPoints += -delta;
    this.state.stats[key] = val;
    const el = document.getElementById("sa_" + key);
    if (el) el.textContent = val;
    this.updateRemain();
  },
  updateRemain() {
    const el = document.getElementById("wiz_remain");
    if (el) el.textContent = this.state.remainingPoints;
  },
  randomStats() {
    const fw = window.storyFramework;
    const keys = fw.config.statKeys || [];
    const opening = (fw.config.openings || []).find((o) => o.id === this.state.opening);
    const base = {};
    keys.forEach((s) => base[s.key] = 10);
    let pool = (fw.config.maxPoints || 100) + (opening ? opening.pointsModifier || 0 : 0);
    const mainKey = keys[Math.floor(Math.random() * keys.length)].key;
    keys.forEach((s) => {
      base[s.key] = 10;
      pool -= 10;
    });
    while (pool >= 5) {
      const k = keys[Math.floor(Math.random() * keys.length)].key;
      const give = Math.min(pool, Math.random() > 0.5 ? 10 : 5, 50 - base[k]);
      base[k] += give;
      pool -= give;
      if (give === 0) break;
    }
    base[mainKey] += 0;
    this.state.stats = base;
    this.state.remainingPoints = pool;
    keys.forEach((s) => {
      const el = document.getElementById("sa_" + s.key);
      if (el) el.textContent = base[s.key];
    });
    this.updateRemain();
  },
  selectOpening(el) {
    document.querySelectorAll(".opening-item").forEach((o) => o.classList.remove("selected"));
    el.classList.add("selected");
    this.state.opening = el.getAttribute("data-id");
    const ta = document.getElementById("wiz_custom_entry");
    if (ta) ta.style.display = this.state.opening === "custom" ? "block" : "none";
  },
  toggleTechnique(el) {
    var _a, _b;
    const fw = window.storyFramework;
    const max = fw.config.maxTechniques || 2;
    const id = el.getAttribute("data-id");
    const cost = parseInt(el.getAttribute("data-cost")) || 0;
    const idx = this.state.techniques.indexOf(id);
    if (idx >= 0) {
      this.state.techniques.splice(idx, 1);
      el.classList.remove("selected");
      this.state.remainingPoints += cost;
    } else {
      if (this.state.techniques.length >= max) {
        (_a = window.UIDialog) == null ? void 0 : _a.alert({ title: "写作技法", message: `最多选择 ${max} 项写作技法` });
        return;
      }
      if (this.state.remainingPoints < cost) {
        (_b = window.UIDialog) == null ? void 0 : _b.alert({ title: "点数不足", message: "剩余点数不足，请先调整其他分配" });
        return;
      }
      this.state.techniques.push(id);
      el.classList.add("selected");
      this.state.remainingPoints -= cost;
    }
    if (id === "custom") {
      const ta = document.getElementById("wiz_custom_boon");
      if (ta) ta.style.display = this.state.techniques.includes("custom") ? "block" : "none";
    }
    this.updateRemain();
  },
  /** 随机书名/梗概/姓名/身世（从 config.nameSeeds 抽取） */
  dice(field) {
    const fw = window.storyFramework;
    const seeds = fw.config.nameSeeds || {};
    if (fw.config.mode === "roleplay") return this.diceRoleplay(field);
    if (field === "heroName") {
      const genderEl = document.getElementById("wiz_heroGender");
      const g = genderEl && genderEl.value || "男";
      const el = document.getElementById("wiz_heroName");
      if (el) el.value = this.NameForge.make(g, seeds.flavor);
      return;
    }
    let value = "";
    if (field === "title") {
      const t = seeds.titles || [];
      value = t.length ? t[Math.floor(Math.random() * t.length)] : `无题之书${Math.floor(Math.random() * 99)}`;
      document.getElementById("wiz_title").value = value;
    } else {
      const p = seeds.premises || [];
      value = p.length ? p[Math.floor(Math.random() * p.length)] : "一个普通人在非常境遇中的抉择";
      document.getElementById("wiz_premise").value = value;
    }
  },
  diceAll() {
    const fw = window.storyFramework;
    if (fw.config.mode === "roleplay") {
      return fw.config.worldForge ? this.diceAllFreeworld() : this.diceAllRoleplay();
    }
    this.dice("title");
    this.dice("premise");
    const meta = fw.config.setupMeta || {};
    const pick = (arr, id) => {
      if (!arr || !arr.length) return;
      const v = arr[Math.floor(Math.random() * arr.length)].id;
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    pick(meta.perspectives, "wiz_perspective");
    pick(meta.styles, "wiz_style");
    pick(meta.lengths, "wiz_length");
    if ((meta.eras || []).length) pick(meta.eras, "wiz_era");
    if ((meta.motifs || []).length) pick(meta.motifs, "wiz_motif");
    ["perspective", "style", "length", "era", "motif"].forEach((f) => this.updateDesc(f));
    ["perspective", "style", "length", "era", "motif", "entry", "boon"].forEach((f) => {
      const ta = document.getElementById("wiz_custom_" + f);
      if (ta) {
        ta.style.display = "none";
        ta.value = "";
      }
    });
    const openings = [...document.querySelectorAll(".opening-item")].filter((o) => o.getAttribute("data-id") !== "custom");
    if (openings.length) this.selectOpening(openings[Math.floor(Math.random() * openings.length)]);
    const customTech = document.querySelector('.tech-item[data-id="custom"]');
    if (customTech && customTech.classList.contains("selected")) this.toggleTechnique(customTech);
    const techItems = [...document.querySelectorAll(".tech-item")].filter((t) => t.getAttribute("data-id") !== "custom");
    techItems.forEach((t) => {
      if (t.classList.contains("selected")) this.toggleTechnique(t);
    });
    const shuffled = techItems.sort(() => Math.random() - 0.5);
    const max = fw.config.maxTechniques || 2;
    for (const t of shuffled) {
      if (this.state.techniques.length >= max) break;
      const cost = parseInt(t.getAttribute("data-cost")) || 0;
      if (cost <= this.state.remainingPoints) this.toggleTechnique(t);
    }
    this.randomStats();
  },
  /** 收集表单并开始创作（roleplay 模式走身份入场） */
  async start() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const fw = window.storyFramework;
    const config = fw.config;
    if (fw.isProcessing) return;
    if (config.mode === "roleplay") return config.worldForge ? this.startFreeworld() : this.startRoleplay();
    if (!fw.isApiConfigured()) {
      fw.guideToConfig();
      return;
    }
    const meta = config.setupMeta || {};
    const selVal = (f) => {
      var _a2;
      return ((_a2 = document.getElementById("wiz_" + f)) == null ? void 0 : _a2.value) || "";
    };
    const customText = (f) => {
      var _a2;
      return (((_a2 = document.getElementById("wiz_custom_" + f)) == null ? void 0 : _a2.value) || "").trim();
    };
    const isCustom = (f) => selVal(f) === "custom";
    const customChecks = [
      { f: "perspective", label: "叙事视角", min: 4 },
      { f: "style", label: "文风基调", min: 4 },
      { f: "length", label: "目标篇幅", min: 4 },
      { f: "era", label: "时代背景", min: 4 },
      { f: "motif", label: "主题母题", min: 4 }
    ];
    if (this.state.opening === "custom") customChecks.push({ f: "entry", label: "开篇模式", min: 4 });
    if (this.state.techniques.includes("custom")) customChecks.push({ f: "boon", label: "写作技法", min: 4 });
    const missing = customChecks.filter((c) => c.f === "entry" && this.state.opening === "custom" || c.f === "boon" && this.state.techniques.includes("custom") || isCustom(c.f)).filter((c) => customText(c.f).length < c.min).map((c) => c.label);
    if (missing.length) {
      (_a = window.UIDialog) == null ? void 0 : _a.alert({ title: "自定义未填写", message: `以下选择了「✎ 自定义」但尚未填写：${missing.join("、")}。请在展开的输入框亲笔书写（写多细，AI 执行多细），或改选预设项。` });
      const first = customChecks.find((c) => c.label === missing[0]);
      if (first) (_b = document.getElementById("wiz_custom_" + first.f)) == null ? void 0 : _b.focus();
      return;
    }
    const length = (meta.lengths || []).find((l) => l.id === selVal("length")) || (meta.lengths || [])[1] || (meta.lengths || [])[0] || { name: "中篇", chapters: 6, words: 6e3 };
    const perspective = isCustom("perspective") ? null : (meta.perspectives || []).find((p) => p.id === selVal("perspective")) || (meta.perspectives || [])[0];
    const style = isCustom("style") ? null : (meta.styles || []).find((s) => s.id === selVal("style")) || (meta.styles || [])[0];
    const era = isCustom("era") ? null : (meta.eras || []).find((e) => e.id === selVal("era")) || null;
    const motif = isCustom("motif") ? null : (meta.motifs || []).find((m) => m.id === selVal("motif")) || null;
    let lengthName = `${length.name}（约${length.words}字 / ${length.chapters}章）`;
    let totalChapters = length.chapters, targetWords = length.words;
    if (isCustom("length")) {
      const parsed = this.parseCustomLength(customText("length"), totalChapters, targetWords);
      totalChapters = parsed.chapters;
      targetWords = parsed.words;
      lengthName = "自定义篇幅";
    }
    const setup = {
      title: ((_c = document.getElementById("wiz_title")) == null ? void 0 : _c.value.trim()) || "",
      premise: ((_d = document.getElementById("wiz_premise")) == null ? void 0 : _d.value.trim()) || "",
      perspective: isCustom("perspective") ? "自定义视角" : (perspective == null ? void 0 : perspective.name) || "第三人称有限视角",
      perspectiveDesc: isCustom("perspective") ? "" : (perspective == null ? void 0 : perspective.desc) || "",
      customPerspective: isCustom("perspective") ? customText("perspective") : "",
      style: isCustom("style") ? "自定义文风" : (style == null ? void 0 : style.name) || "默认文风",
      styleDesc: isCustom("style") ? "" : (style == null ? void 0 : style.desc) || "",
      customStyle: isCustom("style") ? customText("style") : "",
      length: lengthName,
      lengthDesc: isCustom("length") ? "" : (length == null ? void 0 : length.desc) || "",
      customLength: isCustom("length") ? customText("length") : "",
      era: isCustom("era") ? "自定义时代" : (era == null ? void 0 : era.name) || "",
      eraDesc: isCustom("era") ? "" : (era == null ? void 0 : era.desc) || "",
      customEra: isCustom("era") ? customText("era") : "",
      motif: isCustom("motif") ? "自定义母题" : (motif == null ? void 0 : motif.name) || "",
      motifDesc: isCustom("motif") ? "" : (motif == null ? void 0 : motif.desc) || "",
      customMotif: isCustom("motif") ? customText("motif") : "",
      totalChapters,
      targetWords,
      opening: this.state.opening,
      customEntry: this.state.opening === "custom" ? customText("entry") : "",
      techniques: [...this.state.techniques],
      customTechnique: this.state.techniques.includes("custom") ? customText("boon") : "",
      stats: { ...this.state.stats },
      /* v3.26.1 自定义变量模板：开局播种 pkCustom（ai-message-builder 每轮注入） */
      customVars: (this.state.customVars || []).filter((p) => p && p.key).map((p) => ({ key: String(p.key).slice(0, 10), val: String(p.val || "").slice(0, 16) }))
    };
    if (!setup.title) setup.title = `无题之书 · ${config.genreName}`;
    const heroName = ((_e = document.getElementById("wiz_heroName")) == null ? void 0 : _e.value.trim()) || "";
    if (heroName) {
      setup.playerName = heroName;
      setup.gender = ((_f = document.getElementById("wiz_heroGender")) == null ? void 0 : _f.value) || "男";
      const heroAge = parseInt((_g = document.getElementById("wiz_heroAge")) == null ? void 0 : _g.value);
      setup.age = heroAge >= 8 && heroAge <= 90 ? heroAge : 18;
      setup.heroBio = ((_h = document.getElementById("wiz_heroBio")) == null ? void 0 : _h.value.trim()) || "";
    }
    fw.storyState.setup = setup;
    fw.storyState.isStoryStarted = true;
    (_j = (_i = window.DynamicWorld) == null ? void 0 : _i.updateDock) == null ? void 0 : _j.call(_i);
    const initVars = {
      title: setup.title,
      chapter: 0,
      totalChapters: setup.totalChapters,
      wordCount: 0,
      stats: { ...setup.stats },
      characters: {},
      foreshadowings: [],
      items: [],
      history: []
    };
    if (setup.playerName) {
      initVars.characters[setup.playerName] = {
        role: setup.heroBio ? "主角（玩家钦定，详见小传）" : "主角（玩家钦定）",
        status: "开篇待落笔",
        firstAppearance: "第一章",
        isPlayer: true
      };
    }
    (config.gauges || []).forEach((g) => {
      initVars[g.key] = g.default != null ? g.default : 50;
    });
    fw.storyState.variables = initVars;
    const setupWrap = document.getElementById("setupWrap");
    if (setupWrap) setupWrap.style.display = "none";
    const setupBox = document.getElementById("setupContainer");
    if (setupBox) setupBox.style.display = "none";
    const chatEl = document.getElementById("chatArea");
    if (chatEl) chatEl.style.display = "flex";
    fw.updateStatusPanel();
    fw.saveStory();
    let openingInstruction = config.buildOpeningInstruction ? config.buildOpeningInstruction(setup) : `【开始创作】请根据故事设定卡写出第一章（约${Math.round(setup.targetWords / setup.totalChapters)}字），严格遵守开局模板与全部写作规范，结尾附(variable_update)变量块与3-4个情节走向选项。`;
    if (setup.playerName) {
      const heroInfo = `${setup.gender || "男"}${setup.age ? `，${setup.age}岁` : ""}`;
      openingInstruction += `

【主角钦定（最高优先级，效力高于开局模板中与之冲突的条款）】本书主角就是「${setup.playerName}」（${heroInfo}）：开篇即以其为主角落笔，性格、来历、行事动机与小传设定严格执行；全书不得改名、不得换角、不得中途视角外移成配角传记。${setup.heroBio ? `
主角小传（玩家亲笔，际遇与抉择须与之自洽）：${setup.heroBio}` : ""}`;
    }
    const safeOpening = window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()) ? window.VariableAI.sanitizePrompt(openingInstruction) : openingInstruction;
    await window.StoryInput.send(safeOpening);
  }
};
window.StorySetupWizard = StorySetupWizard;
