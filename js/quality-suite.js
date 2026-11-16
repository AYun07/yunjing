(function() {
  "use strict";
  const QualitySuite = {
    KEY: "storyQuality",
    defaults: { styleOn: true, bibleOn: true, pacingOn: true, fsOn: true },
    /* ==================== 配置 / 工具 ==================== */
    get() {
      try {
        return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.KEY) || "{}") };
      } catch (e) {
        return { ...this.defaults };
      }
    },
    save(cfg) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), ...cfg }));
      } catch (e) {
      }
    },
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /** 正文提取（与 StoryResponseHandler.extractBody 同义，缺失时本地兜底） */
    extractBody(raw) {
      const h = window.StoryResponseHandler;
      if (h && h.extractBody) return String(h.extractBody(raw) || "");
      return String(raw || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
    },
    /* ================================================================ */
    /* ① 文风画像 StyleProfile                                          */
    /* ================================================================ */
    /**
     * 正文统计：句均字数 / 对话占比% / 段落均字数。
     * 剔除变量块与选项段；<80 字正文不具统计意义返回 null（开场指令轮防御）
     */
    analyzeBody(text) {
      const t = String(text || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【?下章预告[\s\S]*$/, "").replace(/【?(?:情节选项|接下来的选择|你可以选择)[\s\S]*$/, "").trim();
      const total = t.replace(/\s/g, "").length;
      if (total < 80) return null;
      const sents = t.split(/[。！？…!?]+/).map((s) => s.trim()).filter(Boolean);
      const sent = sents.length ? Math.round(total / sents.length) : 0;
      const dlgs = t.match(/[「『“"][^」』”"]{2,}[」』”"]/g) || [];
      const dlg = Math.round(dlgs.reduce((s, d) => s + d.length, 0) / total * 100);
      const paras = t.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 2);
      const para = paras.length ? Math.round(t.length / paras.length) : 0;
      return { sent, dlg, para };
    },
    /** 最近一个 assistant 正文（供画像分析） */
    lastBody() {
      var _a, _b, _c;
      const hist = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.conversationHistory) || [];
      for (let i = hist.length - 1; i >= 0; i--) {
        if (((_c = hist[i]) == null ? void 0 : _c.role) === "assistant") return this.extractBody(hist[i].content);
      }
      return "";
    },
    /** 每轮（变量落库后）记录本章画像；满 3 章定基线 */
    styleOnTurn() {
      var _a, _b;
      if (!this.get().styleOn) return;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
      const st = this.analyzeBody(this.lastBody());
      if (!st) return;
      const ch = Number((_b = fw.storyState.variables) == null ? void 0 : _b.chapter) || 0;
      if (!ch) return;
      const log = fw.storyState.styleLog || {};
      log[ch] = st;
      const keys = Object.keys(log).map(Number).sort((a, b) => a - b);
      while (keys.length > 40) delete log[keys.shift()];
      fw.storyState.styleLog = log;
      if (!fw.storyState.styleBaseline && keys.length >= 3) {
        const first3 = keys.slice(0, 3).map((k) => log[k]);
        const avg = (f) => Math.round(first3.reduce((s, x) => s + (x[f] || 0), 0) / first3.length);
        fw.storyState.styleBaseline = { sent: avg("sent"), dlg: avg("dlg"), para: avg("para") };
      }
      fw.saveStory();
      if (this.stylistReady() && this.styleDeepDue()) {
        this.styleDeep().catch((e) => console.warn("[质检·文风道] 自动诊断失败:", e));
      }
    },
    /** 文风锚指令（持续性注入：基线在场，漂移时附警报；不足 4 章不定论） */
    styleDirective() {
      var _a, _b, _c;
      if (!this.get().styleOn) return "";
      const fw = window.storyFramework;
      const base = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.styleBaseline;
      if (!base) return "";
      const log = ((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.styleLog) || {};
      const ks = Object.keys(log).map(Number).sort((a, b) => a - b);
      if (ks.length < 4) return "";
      const cur = log[ks[ks.length - 1]];
      const hints = [];
      if (base.sent > 0 && cur.sent > base.sent * 1.35) hints.push(`句均 ${cur.sent} 字比开篇的 ${base.sent} 字明显偏长——拆解长句`);
      else if (base.sent > 0 && cur.sent < base.sent * 0.65) hints.push(`句均 ${cur.sent} 字比开篇的 ${base.sent} 字偏碎——放缓节奏`);
      if (base.dlg >= 15 && cur.dlg < base.dlg * 0.6) hints.push(`对话占比 ${cur.dlg}% 远低于开篇的 ${base.dlg}%——多用对话推进`);
      else if (base.dlg <= 40 && cur.dlg > base.dlg * 1.8 && cur.dlg > 30) hints.push(`对话占比 ${cur.dlg}% 过高——补足叙述与描写`);
      const deep = (_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.styleDeepNote;
      const deepLine = (deep == null ? void 0 : deep.text) ? `
【深度诊断（文笔医师）】${deep.text}` : "";
      return `【文风锚（依本书开篇笔法定档，本轮行文须贴合此基调）】句均约 ${base.sent} 字｜对话占比约 ${base.dlg}%｜段落均约 ${base.para} 字。${hints.length ? `漂移警报：${hints.join("；")}。` : ""}${deepLine}`;
    },
    /* ---------- 文风道（v3.7.0）：AI 深度诊断（可选，通道就绪才可用） ---------- */
    /** 文风道是否可用（通道链任一节点就绪） */
    stylistReady() {
      return !!(window.ChannelHub && window.ChannelHub.canCall("stylist"));
    },
    /**
     * 深度文风诊断：本地统计只看表层（句长/对话占比），AI 能看深层——
     * 意象重复 / 词汇复用 / 视角漂移 / 高频套话。诊断结论（≤80字）存
     * styleDeepNote 持久注入文风锚，直到下次诊断覆盖。
     * 触发：每 5 章自动（styleOnTurn 内 fire-and-forget）+ 面板手动按钮
     */
    async styleDeep() {
      var _a, _b, _c, _d, _e;
      const fw = window.storyFramework;
      if (!this.stylistReady() || !((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
      const body = this.lastBody();
      if (body.replace(/\s/g, "").length < 300) return;
      const base = fw.storyState.styleBaseline;
      try {
        const out = await window.ChannelHub.call("stylist", [
          { role: "system", content: `你是文笔诊断师。基于给出的章节正文与本书文风基线，找出最深层的文风问题（意象重复/词汇复用/视角漂移/高频套话任选最严重的一项），用不超过80字给出可执行的修正指令。只输出指令本身，不要客套。` },
          { role: "user", content: `【文风基线】句均 ${(_b = base == null ? void 0 : base.sent) != null ? _b : "?"} 字 · 对话 ${(_c = base == null ? void 0 : base.dlg) != null ? _c : "?"}%
【本章正文】
${body.slice(0, 5e3)}` }
        ]);
        const note = String(out || "").trim().slice(0, 90);
        if (note) {
          fw.storyState.styleDeepNote = { text: note, at: Date.now() };
          fw.saveStory();
          (_e = window.StoryResponseHandler) == null ? void 0 : _e.renderSystemMessage(`🎨 文风深度诊断（第 ${((_d = fw.storyState.variables) == null ? void 0 : _d.chapter) || "?"} 章）：${note}`, "info");
        }
      } catch (e) {
        console.warn("[质检·文风道] 诊断失败:", e.message);
      }
    },
    /** 深度诊断是否到周期（每 5 章） */
    styleDeepDue() {
      var _a, _b;
      const fw = window.storyFramework;
      const ch = Number((_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.chapter) || 0;
      return ch > 0 && ch % 5 === 0;
    },
    /* ================================================================ */
    /* ② 角色圣经 CharacterBible                                        */
    /* ================================================================ */
    /** 不可变字段：外貌/身份/年龄/口癖——变更必须出于剧情，否则视为提取污染 */
    IMMUTABLE: ["appearance", "role", "age", "speechPattern"],
    FIELD_CN: { appearance: "外貌", role: "身份", age: "年龄", speechPattern: "语言习惯" },
    /** 每轮（变量落库后）比对快照；无故变更出警（取后即清，下一轮回流纠偏） */
    bibleObserve() {
      var _a, _b;
      if (!this.get().bibleOn) return;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
      const chars = ((_b = fw.storyState.variables) == null ? void 0 : _b.characters) || {};
      const snap = fw.storyState.bibleSnap || {};
      const alerts = fw.storyState.bibleAlerts || [];
      let alerted = false;
      Object.entries(chars).forEach(([name, c]) => {
        if (!c || typeof c !== "object") return;
        const old = snap[name];
        if (old) {
          this.IMMUTABLE.forEach((f) => {
            var _a2, _b2;
            const nv = String((_a2 = c[f]) != null ? _a2 : "").trim();
            const ov = String((_b2 = old[f]) != null ? _b2 : "").trim();
            if (nv && ov && nv !== ov && nv.length < 60 && ov.length < 60) {
              alerts.push({ text: `${name}的${this.FIELD_CN[f]}从「${ov.slice(0, 20)}」被改为「${nv.slice(0, 20)}」`, at: Date.now() });
              alerted = true;
            }
          });
        }
        snap[name] = {
          appearance: c.appearance,
          role: c.role,
          age: c.age,
          speechPattern: c.speechPattern,
          firstAppearance: c.firstAppearance,
          trust: c.trust
        };
      });
      fw.storyState.bibleSnap = snap;
      if (alerted) {
        fw.storyState.bibleAlerts = alerts.slice(-3);
        console.warn("[质检·角色圣经] 不可变字段变更：", fw.storyState.bibleAlerts.map((a) => a.text));
      }
      fw.saveStory();
    },
    /** 人物一致性指令（取后即清，只压一轮——玩家若放行变更即视为新正典） */
    bibleDirective() {
      var _a;
      const fw = window.storyFramework;
      const a = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.bibleAlerts) || [];
      if (!a.length) return "";
      const out = `【人物一致性警报（下述设定与既有档案冲突，除非剧情明确需要，本轮必须纠正）】
${a.map((x) => `· ${x.text}`).join("\n")}
——若确属剧情演变（受伤/易容/成长），正文须写明缘由；否则恢复原设定。`;
      fw.storyState.bibleAlerts = [];
      return out;
    },
    /* ================================================================ */
    /* ③ 节奏伏笔雷达 PacingRadar                                       */
    /* ================================================================ */
    /** 主仪表：配置仪表盘首个数值字段；缺失时兜底扫描常见张力类字段 */
    primaryGauge() {
      var _a, _b;
      const fw = window.storyFramework;
      const vars = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || {};
      const gauges = ((_b = fw == null ? void 0 : fw.config) == null ? void 0 : _b.gauges) || [];
      for (const g of gauges) {
        if ((g == null ? void 0 : g.key) && typeof vars[g.key] === "number") return g.key;
      }
      for (const k of ["tension", "crisis", "张力", "危机", "danger", "suspense"]) {
        if (typeof vars[k] === "number") return k;
      }
      return null;
    },
    /** 每轮（变量落库后）快照本章仪表值；平坦/高张疲劳检测 */
    pacingOnTurn() {
      var _a, _b;
      if (!this.get().pacingOn) return;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return;
      const vars = fw.storyState.variables || {};
      const ch = Number(vars.chapter) || 0;
      if (!ch) return;
      const pk = this.primaryGauge();
      if (!pk) return;
      const snapVals = { [pk]: vars[pk] };
      let extra = 0;
      for (const g of ((_b = fw.config) == null ? void 0 : _b.gauges) || []) {
        if (extra >= 5) break;
        if ((g == null ? void 0 : g.key) && g.key !== pk && typeof vars[g.key] === "number") {
          snapVals[g.key] = vars[g.key];
          extra++;
        }
      }
      const log = fw.storyState.pacingLog || {};
      log[ch] = snapVals;
      const keys = Object.keys(log).map(Number).sort((a, b) => a - b);
      while (keys.length > 40) delete log[keys.shift()];
      fw.storyState.pacingLog = log;
      const series = keys.slice(-5).map((k) => Number(log[k][pk]));
      if (series.length >= 4) {
        const mx = Math.max(...series), mn = Math.min(...series);
        const notes = fw.storyState.pacingNotes || [];
        if (mx - mn < 6) notes.push({ text: `主仪表「${pk}」连续 ${series.length} 章停在 ${mn}~${mx} 区间纹丝不动`, at: Date.now() });
        else if (mn >= 85) notes.push({ text: `主仪表「${pk}」连续 ${series.length} 章维持 ${mn}+ 高位不回落——张力拉满不松弦，读者会疲劳`, at: Date.now() });
        if (notes.length) fw.storyState.pacingNotes = notes.slice(-2);
      }
      fw.saveStory();
    },
    /** 节奏预警指令（取后即清——但失律未解下轮会再检出，形成持续施压）
     *  v3.29.0 自由扮演：扮演模式 + 玩家主导形态下跳过——"必须制造起伏"会逼着 AI
     *  凭空造事推玩家，与玩家至上铁律相悖；平淡度日是玩家的生活方式，不是失律 */
    pacingDirective() {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      const n = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.pacingNotes) || [];
      if (!n.length) return "";
      if (((_c = (_b = window.StoryFreedom) == null ? void 0 : _b.isFree) == null ? void 0 : _c.call(_b)) && ((_d = fw == null ? void 0 : fw.config) == null ? void 0 : _d.mode) === "roleplay") {
        fw.storyState.pacingNotes = [];
        return "";
      }
      const out = `【节奏预警（本书节奏已失律，本轮必须制造起伏）】
${n.map((x) => `· ${x.text}`).join("\n")}
——本章要么安排一次明确的升压事件（冲突/反转/危机逼近），要么安排一段减压呼吸（日常/温情/喘息），严禁继续平铺直叙。`;
      fw.storyState.pacingNotes = [];
      return out;
    },
    /* ---------- 伏笔回收排期（持续性条件注入：临期才出现，回收即消失） ---------- */
    /** 预估回收窗口：max(4, 总章数×35%)——短篇 12 章约 4 章，长篇 30 章约 10 章 */
    fsWindow(total) {
      return Math.max(4, Math.round((Number(total) || 12) * 0.35));
    },
    /** 临期（剩 ≤2 章）与逾期伏笔清单（≤4 条） */
    fsDue() {
      var _a;
      if (!this.get().fsOn) return [];
      const fw = window.storyFramework;
      const vars = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) || {};
      const ch = Number(vars.chapter) || 0;
      if (!ch) return [];
      const win = this.fsWindow(vars.totalChapters);
      const out = [];
      (vars.foreshadowings || []).forEach((f) => {
        if (!f || f.status === "resolved" || !f.name) return;
        const remain = (Number(f.plantedAt) || 0) + win - ch;
        if (remain < 0) out.push({ name: f.name, remain, overdue: true });
        else if (remain <= 2) out.push({ name: f.name, remain, overdue: false });
      });
      return out.slice(0, 4);
    },
    /** 伏笔排期指令（持续性：每轮按实时状态重建，回收后自然消失，不取后即清） */
    fsDirective() {
      const due = this.fsDue();
      if (!due.length) return "";
      const lines = due.map((d) => d.overdue ? `· 「${d.name}」已逾期 ${-d.remain} 章未回收——必须尽快安排回收，或明写放弃（让角色亲口否定）` : `· 「${d.name}」预估回收窗口还剩 ${d.remain} 章——从本章起铺设回收线索`);
      return `【伏笔回收排期（本书伏笔管理进度，本轮剧情应有所顾及）】
${lines.join("\n")}`;
    },
    /* ==================== 每轮总钩子（user-input-handler 接线） ==================== */
    /** 变量落库后观察：三面各自独立防护，单件故障不连坐 */
    onVarsMerged() {
      try {
        this.styleOnTurn();
      } catch (e) {
        console.warn("[质检·文风] 观察失败:", e);
      }
      try {
        this.bibleObserve();
      } catch (e) {
        console.warn("[质检·角色] 观察失败:", e);
      }
      try {
        this.pacingOnTurn();
      } catch (e) {
        console.warn("[质检·节奏] 观察失败:", e);
      }
    },
    /* ==================== 统一面板（页签可注册） ==================== */
    _tabs: [],
    /** 外部模块挂页签（draft-lab 的责编自审/多候选即挂此）
     *  v3.8.2 修复：渲染函数归一存为 html（兼容保留 htmlFn 别名）——
     *  此前存成 htmlFn 而 open() 调 cur.html()，外挂页签一点开就 TypeError
     *  （v3.8.1 前更是未捕获直接炸掉整个面板，"质检点不开"元凶之一） */
    registerTab(id, icon, title, htmlFn) {
      if (!this._tabs.find((t) => t.id === id)) this._tabs.push({ id, icon, title, html: htmlFn, htmlFn });
    },
    _switchHTML(key, label, on) {
      return `<label class="qs-switch"><input type="checkbox" ${on ? "checked" : ""} onchange="QualitySuite.toggle('${key}',this.checked)"><i></i><span>${label}</span></label>`;
    },
    toggle(key, on) {
      var _a;
      this.save({ [key]: on });
      this.open(this._curTab || "style");
      (_a = window.showToast) == null ? void 0 : _a.call(window, `${on ? "已开启" : "已关闭"}——下一轮正文生效`, "info");
    },
    /* ---------- 文风页签 ---------- */
    _styleHTML() {
      var _a, _b, _c;
      const fw = window.storyFramework;
      const cfg = this.get();
      const log = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.styleLog) || {};
      const base = (_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.styleBaseline;
      const deep = (_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.styleDeepNote;
      const ks = Object.keys(log).map(Number).sort((a, b) => a - b);
      const cur = ks.length ? log[ks[ks.length - 1]] : null;
      const rows = ks.slice(-10).reverse().map((k) => {
        const v = log[k];
        const drift = (f) => base && base[f] > 0 && Math.abs(v[f] - base[f]) / base[f] > 0.35;
        return `<tr class="${base && (drift("sent") || drift("dlg")) ? "qs-drift" : ""}">
                    <td>第 ${k} 章</td><td>${v.sent} 字</td><td>${v.dlg}%</td><td>${v.para} 字</td></tr>`;
      }).join("");
      return `
            ${this._switchHTML("styleOn", "文风锚注入（开篇笔法定档，逐轮锚定）", cfg.styleOn)}
            <p class="qs-tip">统计每章正文的句均字数 / 对话占比 / 段落节奏。前 3 章自动定基线（本书的"笔法契约"），
            之后每轮注入提示词锚定文风；单项偏离基线 35% 以上出漂移警报。<b>纯本地计算，零接口成本。</b>
            ${this.stylistReady() ? `文风道已就绪（${window.ChannelHub.resolveUsed("stylist").name}）：每 5 章自动 AI 深度诊断（意象重复 / 视角漂移 / 高频套话）。` : "配置「文风道」通道后可开启 AI 深度诊断（顶栏 · 🔌 通道）。"}</p>
            ${this.stylistReady() ? `<button class="qs-deep-btn" onclick="QualitySuite.styleDeep().then(()=>QualitySuite.open('style'))">🎨 立即深度诊断本章</button>` : ""}
            ${deep ? `<div class="qs-base">🎨 深度诊断（${new Date(deep.at).toLocaleString()}）：${this.esc(deep.text)}</div>` : ""}
            ${base ? `<div class="qs-base">📌 基线（开篇定档）：句均 <b>${base.sent}</b> 字 · 对话 <b>${base.dlg}%</b> · 段落 <b>${base.para}</b> 字${cur ? `｜当前：句均 ${cur.sent} 字 · 对话 ${cur.dlg}%` : ""}</div>` : '<div class="qs-base qs-dim">开写满 3 章后自动定档基线</div>'}
            ${ks.length ? `<table class="qs-table"><thead><tr><th>章节</th><th>句均</th><th>对话占比</th><th>段落均</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="qs-empty">尚无画像——发送一轮正文后自动记录</div>'}`;
    },
    /* ---------- 角色页签 ---------- */
    _bibleHTML() {
      var _a, _b, _c;
      const fw = window.storyFramework;
      const cfg = this.get();
      const chars = ((_b = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.variables) == null ? void 0 : _b.characters) || {};
      const alerts = ((_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.bibleAlerts) || [];
      const names = Object.keys(chars);
      const cards = names.slice(0, 30).map((n) => {
        const c = chars[n] || {};
        const hist = (Array.isArray(c.history) ? c.history : []).slice(-3).reverse();
        return `<div class="qs-char">
                    <div class="qs-char-name">${this.esc(n)}${typeof c.trust === "number" ? `<i>关系 ${c.trust}</i>` : ""}</div>
                    <div class="qs-char-facts">
                        ${c.role ? `<span>身份：${this.esc(String(c.role).slice(0, 30))}</span>` : ""}
                        ${c.age != null && c.age !== "" ? `<span>年龄：${this.esc(String(c.age).slice(0, 10))}</span>` : ""}
                        ${c.appearance ? `<span>外貌：${this.esc(String(c.appearance).slice(0, 40))}</span>` : ""}
                        ${c.speechPattern ? `<span>口癖：${this.esc(String(c.speechPattern).slice(0, 40))}</span>` : ""}
                    </div>
                    ${hist.length ? `<div class="qs-char-hist">${hist.map((h) => `· ${this.esc(String(h).slice(0, 44))}`).join("<br>")}</div>` : ""}
                </div>`;
      }).join("");
      return `
            ${this._switchHTML("bibleOn", "人物一致性守卫（不可变字段变更即出警）", cfg.bibleOn)}
            <p class="qs-tip">人物外貌 / 身份 / 年龄 / 口癖为不可变字段——变量登记无故改动（黑发改红发）即出警，
            纠偏指令下一轮回流。若变更确属剧情（受伤/易容），放行一轮即成新正典。<b>纯本地比对，零接口成本。</b></p>
            ${alerts.length ? `<div class="qs-alertbox">${alerts.map((a) => `⚠ ${this.esc(a.text)}`).join("<br>")}</div>` : ""}
            ${names.length ? `<div class="qs-char-grid">${cards}</div>` : '<div class="qs-empty">尚无角色档案——AI 登记角色后自动成册</div>'}`;
    },
    /* ---------- 节奏伏笔页签 ---------- */
    _pacingHTML() {
      var _a, _b, _c;
      const fw = window.storyFramework;
      const cfg = this.get();
      const log = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.pacingLog) || {};
      const vars = ((_b = fw == null ? void 0 : fw.storyState) == null ? void 0 : _b.variables) || {};
      const ks = Object.keys(log).map(Number).sort((a, b) => a - b);
      const pk = this.primaryGauge();
      const notes = ((_c = fw == null ? void 0 : fw.storyState) == null ? void 0 : _c.pacingNotes) || [];
      const due = this.fsDue();
      const win = this.fsWindow(vars.totalChapters);
      let chart = '<div class="qs-empty">尚无曲线——发送正文后逐章自动记录</div>';
      if (pk && ks.length >= 2) {
        const W = 560, H = 150, P = 26;
        const vals = ks.map((k) => Number(log[k][pk]) || 0);
        const vmax = Math.max(100, ...vals) * 1.08;
        const x = (i) => P + (W - P * 2) * (i / Math.max(1, ks.length - 1));
        const y = (v) => H - P - (H - P * 2) * (Math.max(0, v) / vmax);
        const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
        const dots = vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"><title>第 ${ks[i]} 章 · ${v}</title></circle>`).join("");
        const flat = ks.length >= 4 && Math.max(...vals.slice(-4)) - Math.min(...vals.slice(-4)) < 6;
        chart = `<svg viewBox="0 0 ${W} ${H}" class="qs-chart">
                    <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" class="qs-axis"/>
                    <line x1="${P}" y1="${P}" x2="${P}" y2="${H - P}" class="qs-axis"/>
                    <line x1="${P}" y1="${y(85)}" x2="${W - P}" y2="${y(85)}" class="qs-hot" ${vmax < 90 ? 'style="display:none"' : ""}/>
                    <polyline points="${pts}" class="qs-line${flat ? " flat" : ""}"/>
                    ${dots}
                    <text x="${P}" y="${P - 8}" class="qs-lab">${this.esc(pk)}</text>
                    <text x="${P}" y="${H - 8}" class="qs-lab">第 ${ks[0]} 章</text>
                    <text x="${W - P}" y="${H - 8}" text-anchor="end" class="qs-lab">第 ${ks[ks.length - 1]} 章</text>
                </svg>${flat ? '<div class="qs-alertbox">⚠ 最近章节曲线近乎水平——已注入节奏预警，本章应制造起伏</div>' : ""}`;
      }
      const fsRows = (vars.foreshadowings || []).filter((f) => f && f.status !== "resolved" && f.name).slice(0, 10).map((f) => {
        const planted = Number(f.plantedAt) || 0;
        const remain = planted + win - (Number(vars.chapter) || 0);
        const cls = remain < 0 ? "over" : remain <= 2 ? "near" : "";
        return `<tr class="${cls}"><td>${this.esc(f.name)}</td><td>第 ${planted} 章</td><td>${remain < 0 ? `逾期 ${-remain} 章` : `剩 ${remain} 章`}</td></tr>`;
      }).join("");
      return `
            ${this._switchHTML("pacingOn", "节奏曲线与失律预警（平坦/高张疲劳）", cfg.pacingOn)}
            ${this._switchHTML("fsOn", `伏笔回收排期（窗口 = max(4, 总章数×35%) ≈ ${win} 章）`, cfg.fsOn)}
            ${notes.length ? `<div class="qs-alertbox">${notes.map((n) => `⚠ ${this.esc(n.text)}`).join("<br>")}</div>` : ""}
            ${chart}
            ${fsRows ? `<table class="qs-table"><thead><tr><th>未回收伏笔</th><th>埋设</th><th>排期</th></tr></thead><tbody>${fsRows}</tbody></table>
                        <p class="qs-tip">灰=窗口充裕 · 黄=临期（剩≤2章，开始铺回收线索） · 红=逾期（必须回收或明写放弃）。
                        临期/逾期项每轮注入提示词，回收后自然消失。</p>` : '<div class="qs-empty">尚无未回收伏笔——AI 埋设伏笔（+伏笔名 埋设）后自动排期</div>'}`;
    },
    _curTab: "style",
    open(tab) {
      try {
        const cfg = this.get();
        this._curTab = tab || this._curTab || "style";
        const own = [
          { id: "style", icon: "🖋", title: "文风画像", html: () => this._styleHTML() },
          { id: "bible", icon: "📖", title: "角色圣经", html: () => this._bibleHTML() },
          { id: "pacing", icon: "📈", title: "节奏伏笔", html: () => this._pacingHTML() }
        ];
        const tabs = [...own, ...this._tabs];
        const cur = tabs.find((t) => t.id === this._curTab) || tabs[0];
        const nav = tabs.map((t) => `<button class="qs-tab ${t.id === cur.id ? "on" : ""}" onclick="QualitySuite.open('${t.id}')">${t.icon} ${t.title}</button>`).join("");
        let bodyHTML;
        const renderFn = cur.html || cur.htmlFn;
        try {
          bodyHTML = renderFn ? renderFn() : "";
        } catch (e) {
          console.warn("[质检] 页签渲染故障:", e.message);
          bodyHTML = `<div class="qs-empty">「${cur.title}」页签渲染故障：${this.esc(e.message || e)}<br><span style="font-size:11px;color:#6e6a5e">其余页签不受影响；多为某章统计或角色字段的格式异常所致</span></div>`;
        }
        const html = `
                <div class="qs-overlay" onclick="if(event.target===this)QualitySuite.close()">
                    <div class="qs-modal">
                        <div class="qs-head">
                            <b>🔬 质检中心 · 长局质量防线</b>
                            <button class="qs-x" onclick="QualitySuite.close()">✕</button>
                        </div>
                        <div class="qs-nav">${nav}</div>
                        <div class="qs-body">${bodyHTML}</div>
                    </div>
                </div>`;
        const old = document.getElementById("qsModal");
        if (old) old.remove();
        const wrap = document.createElement("div");
        wrap.id = "qsModal";
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
      } catch (e) {
        console.warn("[质检] 面板打开故障:", e.message);
        const wrap = document.createElement("div");
        wrap.id = "qsModal";
        wrap.innerHTML = `<div class="qs-overlay" onclick="if(event.target===this)QualitySuite.close()">
                    <div class="qs-modal"><div class="qs-head"><b>🔬 质检中心</b>
                    <button class="qs-x" onclick="QualitySuite.close()">✕</button></div>
                    <div class="qs-body"><div class="qs-empty">质检面板打开异常：${this.esc(e.message || e)}<br><span style="font-size:11px;color:#6e6a5e">可点「⚙ 接口」旁按钮继续游玩，本异常不影响正文创作</span></div></div></div></div>`;
        document.body.appendChild(wrap);
      }
    },
    close() {
      var _a;
      (_a = document.getElementById("qsModal")) == null ? void 0 : _a.remove();
    }
  };
  if (!document.getElementById("qsStyle")) {
    const st = document.createElement("style");
    st.id = "qsStyle";
    st.textContent = `
.qs-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9988;display:flex;align-items:center;justify-content:center;padding:18px}
.qs-modal{width:min(720px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#1d1a15,#141210);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden}
.qs-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.qs-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.qs-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.qs-x:hover{color:#e8dcc0}
.qs-nav{display:flex;gap:4px;padding:10px 14px 0;border-bottom:1px solid #c9a86a18;overflow-x:auto}
.qs-tab{background:none;border:none;border-bottom:2px solid transparent;color:#9a8c6e;font-size:12.5px;cursor:pointer;padding:7px 12px;white-space:nowrap;letter-spacing:.5px}
.qs-tab:hover{color:#d8cba8}
.qs-tab.on{color:#c9a86a;border-bottom-color:#c9a86a}
.qs-body{padding:16px 18px;overflow-y:auto;flex:1}
.qs-tip{font-size:12px;line-height:1.8;color:#9a8c6e;margin:10px 0}
.qs-tip b{color:#d8cba8}
.qs-base{font-size:12.5px;color:#d8cba8;background:#c9a86a12;border:1px solid #c9a86a30;border-radius:9px;padding:9px 12px;margin:8px 0}
.qs-base b{color:#c9a86a}
.qs-base.qs-dim{color:#6e6a5e}
.qs-table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0}
.qs-table th{text-align:left;color:#9a8c6e;font-weight:500;padding:6px 8px;border-bottom:1px solid #c9a86a25}
.qs-table td{padding:6px 8px;color:#d8cba8;border-bottom:1px solid #c9a86a12}
.qs-table tr.qs-drift td{color:#e0a04c}
.qs-table tr.near td:last-child{color:#e0a04c}
.qs-table tr.over td{color:#e07070}
.qs-empty{font-size:12.5px;color:#6e6a5e;padding:26px 0;text-align:center}
.qs-alertbox{font-size:12px;line-height:1.9;color:#e0a04c;background:#e0a04c10;border:1px solid #e0a04c35;border-radius:9px;padding:9px 12px;margin:8px 0}
.qs-chart{width:100%;height:auto;margin:10px 0}
.qs-axis{stroke:#c9a86a30;stroke-width:1}
.qs-hot{stroke:#e0707050;stroke-width:1;stroke-dasharray:4 4}
.qs-line{fill:none;stroke:#c9a86a;stroke-width:2;stroke-linejoin:round}
.qs-line.flat{stroke:#e0a04c;stroke-dasharray:6 3}
.qs-chart circle{fill:#c9a86a;cursor:pointer}
.qs-chart circle:hover{fill:#e8dcc0}
.qs-lab{fill:#9a8c6e;font-size:10px}
.qs-char-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:10px 0}
.qs-char{background:#c9a86a0d;border:1px solid #c9a86a25;border-radius:10px;padding:10px 12px}
.qs-char-name{font-size:13.5px;color:#e8dcc0;margin-bottom:6px}
.qs-char-name i{font-style:normal;font-size:11px;color:#c9a86a;margin-left:8px}
.qs-char-facts{display:flex;flex-direction:column;gap:3px}
.qs-char-facts span{font-size:11.5px;color:#9a8c6e;line-height:1.5}
.qs-char-hist{font-size:11px;color:#6e6a5e;line-height:1.7;margin-top:7px;padding-top:6px;border-top:1px dashed #c9a86a20}
.qs-switch{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#d8cba8;background:#c9a86a12;border:1px solid #c9a86a30;border-radius:20px;padding:6px 14px;margin:0 8px 10px 0;cursor:pointer;user-select:none}
.qs-switch input{display:none}
.qs-switch i{width:30px;height:16px;border-radius:9px;background:#3a352b;position:relative;transition:background .2s;flex:none}
.qs-switch i::after{content:'';position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#9a8c6e;transition:all .2s}
.qs-switch input:checked+i{background:#8a744a}
.qs-switch input:checked+i::after{left:16px;background:#e8dcc0}
.qs-switch span{line-height:1.4}
.qs-deep-btn{background:#c9a86a18;border:1px solid #c9a86a55;color:#c9a86a;border-radius:9px;padding:8px 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px;margin-bottom:10px}
.qs-deep-btn:hover{background:#c9a86a2a}`;
    document.head.appendChild(st);
  }
  window.QualitySuite = QualitySuite;
})();
