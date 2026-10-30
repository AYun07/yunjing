(function() {
  "use strict";
  const GENRE = (() => {
    try {
      return new URLSearchParams(location.search).get("genre") || "free";
    } catch (e) {
      return "free";
    }
  })();
  if (GENRE !== "earth") return;
  const API_KEY = "storyPhoneApi";
  const SET_KEY = "storyPhone";
  const PhonePanel = {
    version: "v3.47.1",
    /* 头像精灵图（v3.19.9：男/女各 16 张，CSS background-size 400% 切割；
       首字留在 span 内——图片加载成功则被盖住，404 时露出作兜底） */
    AVA: { m: "assets/phone/avatars-m.jpg", f: "assets/phone/avatars-f.jpg" },
    apiDefaults: {
      enabled: false,
      reuseMain: true,
      type: "openai",
      endpoint: "",
      apiKey: "",
      model: "",
      maxTokens: 4096,
      temperature: 0.9,
      timeout: 60
    },
    setDefaults: {
      enabled: true,
      interval: 3,
      maxMessages: 4,
      maxMoments: 3,
      autoReact: true,
      useKnowledge: true
      // v3.19.9：读取知识库（常驻+检索条目注入三链提示词）
    },
    /* ==================== 时代档位（时代即边界） ==================== */
    /* 手机形态随年份切换：微信(2011+) / QQ(1999-2010) / 短信(1983-1998) / 无(<1983) */
    TIERS: {
      wechat: { label: "微信时代", appName: "微信", feedName: "朋友圈", hue: 145, carrier: "5G", icon: "💬" },
      qq: { label: "QQ时代", appName: "QQ", feedName: "QQ空间", hue: 205, carrier: "GPRS", icon: "💬" },
      sms: { label: "短信时代", appName: "短信", feedName: "", hue: 210, carrier: "GSM", icon: "✉️" }
    },
    /** 从任意文本提取公元年份（含公元前 → 负数）；找不到返回 null */
    parseYear(str) {
      const s = String(str || "");
      let m = s.match(/公元前[约\s]*(\d{1,5})/);
      if (m) return -Number(m[1]);
      m = s.match(/(?:公元|约)?\s*(\d{3,4})\s*年/);
      if (m) {
        let y = Number(m[1]);
        if (y >= 100 && y <= 2200) return y;
      }
      m = s.match(/\b(19\d{2}|20[0-2]\d)\b/);
      if (m) return Number(m[1]);
      return null;
    },
    /** timeline 选项 id → 样本年份（自定义年份走文本解析） */
    TIMELINE_YEARS: {
      prehistoric: -1e4,
      bronze: -1200,
      classical: -138,
      medieval: 1250,
      renaissance: 1500,
      enlightenment: 1789,
      industrial: 1860,
      belle: 1900,
      ww1: 1916,
      interwar: 1925,
      ww2: 1943,
      coldwar: 1972,
      millennium: 1999,
      modern: 2025
    },
    /** 综合时代变量与开局设定 → 手机档位（wechat/qq/sms/none） */
    detectTier() {
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const setup = fw && fw.storyState && fw.storyState.setup || {};
      const seeds = [
        v.era,
        v.时代,
        v.date,
        v.日期,
        setup.customTimeline,
        setup.timelineDesc,
        setup.customEntry,
        setup.timeline,
        setup.timelineText,
        setup.entry,
        typeof setup.timelineId === "string" ? this.TIMELINE_YEARS[setup.timelineId] != null ? this.TIMELINE_YEARS[setup.timelineId] < 0 ? `公元前${Math.abs(this.TIMELINE_YEARS[setup.timelineId])}年` : `公元${this.TIMELINE_YEARS[setup.timelineId]}年` : "" : ""
      ];
      let year = null;
      for (const s of seeds) {
        const y = this.parseYear(s);
        if (y != null) {
          year = y;
          break;
        }
      }
      if (year == null) {
        const tid = setup.timelineId || "";
        if (tid === "modern") year = 2025;
        else if (tid === "millennium") year = 1999;
        else if (tid === "coldwar") year = 1972;
        else if (tid === "custom_era") return "none";
        else return "none";
      }
      if (year >= 2011) return "wechat";
      if (year >= 1999) return "qq";
      if (year >= 1983) return "sms";
      return "none";
    },
    tier() {
      return this.detectTier();
    },
    tierInfo() {
      return this.TIERS[this.tier()] || null;
    },
    /* ==================== 配置存取 ==================== */
    getApi() {
      try {
        return { ...this.apiDefaults, ...JSON.parse(MoStore.getItem(API_KEY) || "{}") };
      } catch (e) {
        return { ...this.apiDefaults };
      }
    },
    saveApi(cfg) {
      try {
        MoStore.setItem(API_KEY, JSON.stringify(cfg));
      } catch (e) {
      }
    },
    getSettings() {
      try {
        return { ...this.setDefaults, ...JSON.parse(MoStore.getItem(SET_KEY) || "{}") };
      } catch (e) {
        return { ...this.setDefaults };
      }
    },
    saveSettings(cfg) {
      try {
        MoStore.setItem(SET_KEY, JSON.stringify(cfg));
      } catch (e) {
      }
    },
    /** 实际生效的 API 配置：reuseMain 时复用主笔接口（零配置开箱即用） */
    effectiveApi() {
      const fw = window.storyFramework;
      const a = this.getApi();
      if (a.reuseMain !== false && fw && fw.apiConfig && fw.apiConfig.endpoint) {
        return {
          type: fw.apiConfig.type || "openai",
          endpoint: fw.apiConfig.endpoint,
          apiKey: fw.apiConfig.apiKey,
          model: fw.apiConfig.model,
          maxTokens: Math.min(a.maxTokens || 4096, 4096),
          temperature: a.temperature != null ? a.temperature : 0.9,
          timeout: a.timeout || 60
        };
      }
      return a;
    },
    isApiReady() {
      const c = this.effectiveApi();
      return !!(c.endpoint && c.apiKey && c.model);
    },
    /** 手机模块整体可用：启用 + 开篇 + 时代有手机 + 接口就绪 */
    isEnabled() {
      const fw = window.storyFramework;
      const s = this.getSettings();
      return !!(s.enabled && fw && fw.storyState && fw.storyState.isStoryStarted && this.tier() !== "none" && this.isApiReady());
    },
    /* ==================== 运行态（storyState.phone，随存档） ==================== */
    state() {
      const fw = window.storyFramework;
      if (!fw || !fw.storyState) {
        if (!this._tmp) this._tmp = {
          contacts: [],
          chats: [],
          moments: [],
          pending: [],
          counter: 0,
          lastSyncTurn: 0,
          isProcessing: false,
          tier: ""
        };
        return this._tmp;
      }
      if (!fw.storyState.phone) {
        fw.storyState.phone = {
          contacts: [],
          // [{name, role, hue}]
          chats: [],
          // [{id, name, group, msgs:[{from,me,text,time,kind}], unread}]
          moments: [],
          // [{id, author, text, time, likes, comments, mine, news}]
          pending: [],
          // 回流主笔的手机近讯（取后即清）
          profile: { sig: "" },
          // 玩家手机档案（个性签名，v3.19.8）
          counter: 0,
          lastSyncTurn: 0,
          isProcessing: false,
          tier: ""
        };
      }
      const p = fw.storyState.phone;
      if (!Array.isArray(p.contacts)) p.contacts = [];
      if (!Array.isArray(p.chats)) p.chats = [];
      if (!Array.isArray(p.moments)) p.moments = [];
      if (!Array.isArray(p.pending)) p.pending = [];
      if (!p.profile || typeof p.profile !== "object") p.profile = { sig: "" };
      if (p.isProcessing == null) p.isProcessing = false;
      return p;
    },
    /* ==================== 工具 ==================== */
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    },
    hueOf(name) {
      let h = 0;
      for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) % 360;
      return h;
    },
    /* ==================== 头像系统（v3.19.9：男/女各 16 张精灵图） ==================== */
    /** 性别启发式：身份描述里的亲属/性别线索 → 0男 1女；无线索按名字哈希 */
    guessGender(name, role) {
      const s = String(role || "") + " " + String(name || "");
      if (/母亲|妈妈|妈|姐姐|妹妹|妻子|老婆|女儿|阿姨|大姐|丫头|婶|姑|婆|奶奶|嫂|媳|女士|姑娘|小姐|闺蜜|护士|她/.test(s)) return 1;
      if (/父亲|爸爸|爸|哥哥|弟弟|丈夫|老公|儿子|叔叔|大爷|大哥|哥们|帅哥|伯伯|爷爷|先生|男士|兄弟|师傅|他/.test(s)) return 0;
      return this.hueOf(String(name || "x")) % 2;
    },
    /** 联系人头像坐标 {g:0男1女, i:0-15}：已记录的用记录，否则按身份启发式+名字哈希分配 */
    avatarOf(c) {
      if (c && (c.g === 0 || c.g === 1)) {
        return { g: c.g, i: Number.isInteger(c.av) && c.av >= 0 && c.av < 16 ? c.av : this.hueOf(c.name) % 16 };
      }
      return { g: this.guessGender(c && c.name, c && c.role), i: this.hueOf(c && c.name || "x") % 16 };
    },
    /** 图片头像节点（精灵切割：background-size 400%，position 按行列 33.33% 步进）。
        avaOk=false（图片 404）时回退色块首字头像——任何环境不露白板 */
    renderAvatar(c, cls = "") {
      const a = this.avatarOf(c || {});
      if (this.avaOk === false) {
        return `<span class="ph-avatar ${cls}" style="--h:${this.hueOf(c && c.name || "x")};">${this.esc(String(c && c.name || "？").slice(0, 1))}</span>`;
      }
      const img = a.g === 1 ? this.AVA.f : this.AVA.m;
      const pos = `${a.i % 4 * 100 / 3}% ${Math.floor(a.i / 4) * 100 / 3}%`;
      return `<span class="ph-avatar ph-ava ${cls}" style="background-image:url('${img}');background-position:${pos};"></span>`;
    },
    /** 头像精灵图预检（v3.19.9）：两张任一 404 → avaOk=false 整机回退首字头像；
        无 Image 的环境（旧浏览器/测试沙箱）跳过预检，保持乐观图片模式 */
    initAvatars() {
      if (typeof Image === "undefined") return;
      const check = (src) => new Promise((res) => {
        const im = new Image();
        im.onload = () => res(true);
        im.onerror = () => res(false);
        im.src = src;
      });
      Promise.all([check(this.AVA.m), check(this.AVA.f)]).then(([m, f]) => {
        const ok = !!(m && f);
        if (this.avaOk !== ok) {
          this.avaOk = ok;
          this.render();
          if (!ok) console.warn("[手机分身] 头像图缺失，已回退首字头像");
        }
      }).catch(() => {
      });
    },
    /** 循环切换头像（详情卡/我页点击）：g*16+i 递增，写回档案并落盘 */
    cycleAvatar(c) {
      if (!c) return;
      const a = this.avatarOf(c);
      const n = a.g * 16 + a.i;
      const next = (n + 1) % 32;
      c.g = Math.floor(next / 16);
      c.av = next % 16;
      this.render();
      window.storyFramework.saveStory();
    },
    nowLabel() {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const t = v.time || v.时刻 || "";
      if (t) return String(t).slice(0, 10);
      const d = /* @__PURE__ */ new Date();
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    },
    playerName() {
      var _a;
      const fw = window.storyFramework;
      if (!fw || !fw.storyState) return "我";
      const st = fw.storyState;
      const v = st.variables || {};
      return ((_a = st.setup) == null ? void 0 : _a.playerName) || v.playerName || v.玩家名 || "我";
    },
    /* ==================== 联系人同步（每轮吃 characters 档案） ==================== */
    /** 名单校验（v3.19.9）：手机里只允许出现玩家认识的人——
        来信/发动态/点赞/评论/群内发言的 from 必须在通讯录；AI 幻觉的陌生人一律拦截 */
    isKnown(name) {
      if (!name) return false;
      const p = this.state();
      return p.contacts.some((c) => c.name === String(name));
    },
    /** v3.28.0：对方是否正与玩家同处一地（舞台快照的在场名单）。
     *  舞台监督每轮随正文登记 cast——人在不在身边以最新一幕为准；
     *  无舞台数据（接口未配/登记失败）时恒 false（退回远程聊天，不误伤）。
     *  v3.30.0：玩家手动分区（c.forceZone）优先于舞台名单——登记错了
     *  玩家在角色卡上一键纠正，手机立即同源生效（人在身边不再远程发消息）。 */
    isPresent(name) {
      var _a, _b, _c, _d;
      try {
        const n = String(name || "").trim();
        if (!n) return false;
        const c = (_d = (_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.characters) == null ? void 0 : _d[n];
        if (c && c.forceZone === "present") return true;
        if (c && c.forceZone === "off") return false;
        const SS = window.SceneState;
        if (!SS || !SS.hasData || !SS.hasData()) return false;
        return (SS.snap().cast || []).some((c2) => String(c2.name || "").trim() === n);
      } catch (e) {
        return false;
      }
    },
    /** v3.28.0：当前与玩家同处一地的联系人名单（注入提示词——同步引擎
     *  据此避免"人在身边还发消息"的假行为）。
     *  v3.30.0：手动 forceZone 纠正同源生效（钉在场者补入，钉离场者剔除）。 */
    presentNames() {
      var _a, _b, _c;
      try {
        const list = /* @__PURE__ */ new Set();
        const SS = window.SceneState;
        if (SS && SS.hasData && SS.hasData()) {
          (SS.snap().cast || []).map((c) => String(c.name || "").trim()).filter(Boolean).forEach((n) => list.add(n));
        }
        const chars = ((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.characters) || {};
        Object.keys(chars).forEach((n) => {
          const fz = chars[n] && chars[n].forceZone;
          if (fz === "present") list.add(n);
          else if (fz === "off") list.delete(n);
        });
        const me = this.playerName();
        return [...list].filter((n) => n && n !== me);
      } catch (e) {
        return [];
      }
    },
    syncContacts() {
      const fw = window.storyFramework;
      if (!fw || !fw.storyState) return false;
      const p = this.state();
      if (!Array.isArray(p.blocked)) p.blocked = [];
      const v = fw.storyState.variables || {};
      const chars = v.characters || {};
      if (!p.farawayMig) {
        p.farawayMig = true;
        this.migrateFaraway(chars);
      }
      const names = Object.keys(chars).filter((n) => n && n !== this.playerName() && !p.blocked.includes(n)).filter((n) => !(chars[n] && chars[n].isFaraway)).slice(0, 30);
      let dirty = false;
      for (const n of names) {
        if (!p.contacts.find((c) => c.name === n)) {
          const c = chars[n] || {};
          p.contacts.push({ name: n, role: String(c.role || c.身份 || c.职业 || "熟人"), hue: this.hueOf(n) });
          dirty = true;
        }
      }
      const farSet = new Set(Object.keys(chars).filter((n) => chars[n] && chars[n].isFaraway));
      if (farSet.size) {
        const kept = p.contacts.filter((c) => c.custom || !farSet.has(c.name));
        if (kept.length !== p.contacts.length) {
          p.contacts = kept;
          dirty = true;
        }
      }
      return dirty;
    },
    /** v3.27.9 旧档迁移：动态世界登记过、但正文从头到尾没提过的人物 → 补打远方标记。
     *  判据：名字只出现在动态世界推演块里（character 字段行 / >>名字.history 行），
     *  而正文文本（对话历史 + 前情提要摘要）从未出现，且玩家没亲笔设定（customFields）。
     *  正文里登场过的人物名字必然留在对话历史或摘要里，不会被误伤 */
    migrateFaraway(chars) {
      const fw = window.storyFramework;
      const dw = window.DynamicWorld;
      if (!chars || !dw || !dw.state) return;
      let hist = [];
      try {
        const st = dw.state();
        hist = st && st.history || [];
      } catch (e) {
        return;
      }
      const names = /* @__PURE__ */ new Set();
      for (const entry of hist) {
        const blk = String(entry && entry.updateBlock || "");
        if (!blk) continue;
        for (const line of blk.split(/\r?\n/)) {
          let m = line.match(/^>>\s*(.+?)\.history\s*[:：]/);
          if (m) {
            const w = (m[1] || "").replace(/^["'“”]+|["'“”]+$/g, "").trim();
            if (w) names.add(w);
            continue;
          }
          m = line.match(/^([^:：]+?)\.([^.:：]+?)\s*[:：]/);
          if (m) {
            const container = (m[1] || "").replace(/^["'“”\[\{]+|["'“”\]\},]+$/g, "").trim();
            if (container && container !== "stats" && container !== "六维" && container !== "dashboard" && container !== "自定义") names.add(container);
          }
        }
      }
      if (!names.size) return;
      const storyText = [
        ...(fw.storyState.conversationHistory || []).map((x) => String(x && x.content || "")),
        String(fw.storyState.digest && fw.storyState.digest.summary || "")
      ].join("\n");
      let marked = 0;
      for (const name of names) {
        const c = chars[name];
        if (c && typeof c === "object" && !c.isPlayer && !c.isFaraway && !c.customFields && !storyText.includes(name)) {
          c.isFaraway = true;
          marked++;
        }
      }
      if (marked) console.log(`[手机分身] 旧档迁移：${marked} 位从未谋面的远方NPC撤出通讯录（正文登场后会自然回归）`);
    },
    /* ==================== 第六接口调用（复用主笔 / 独立配置） ==================== */
    fetchWithTimeout(url, opts = {}, timeoutMs) {
      const ms = timeoutMs && timeoutMs > 0 ? timeoutMs : 6e4;
      const once = () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
      };
      // v3.47.16 接入统一防护层：手机分身每 3 轮刷新来信+朋友圈，容易连发撞限流
      if (window.MoNetGuard && window.MoNetGuard.fetchWithRetry) {
        return window.MoNetGuard.fetchWithRetry(once, { label: "手机分身", throttleKey: "手机分身", silent: true });
      }
      return once();
    },
    /** 调第六接口（messages：OpenAI 格式消息数组）
     *  overrideCfg：可选——连通测试传表单当前值直测（不落盘不读档），省略则用 effectiveApi() */
    async callPhoneAPI(messages, overrideCfg) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const cfg = overrideCfg || this.effectiveApi();
      if (!(cfg.endpoint && cfg.apiKey && cfg.model)) throw new Error("手机分身接口未配置（默认复用主笔接口，请先配置主笔）");
      if (cfg.type === "gemini") {
        const endpoint = `${cfg.endpoint.trim().replace(/\/+$/, "")}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
        const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
        const sys = ((_a = messages.find((m) => m.role === "system")) == null ? void 0 : _a.content) || "";
        const response2 = await this.fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: sys ? { parts: [{ text: sys }] } : void 0,
            generationConfig: { temperature: cfg.temperature || 0.9, maxOutputTokens: cfg.maxTokens || 4096, responseMimeType: "application/json" }
          })
        }, (cfg.timeout || 60) * 1e3);
        if (!response2.ok) throw new Error(`手机分身请求失败: ${response2.status}`);
        const data2 = await response2.json();
        const parts = ((_d = (_c = (_b = data2.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) || [];
        return parts.map((x) => x.text || "").filter(Boolean).join("").trim();
      }
      const base = cfg.endpoint.trim().replace(/\/+$/, "");
      const full = /\/(chat\/completions|completions)$/.test(base) ? base : `${base}/chat/completions`;
      const response = await this.fetchWithTimeout(full, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: cfg.temperature || 0.9,
          max_tokens: cfg.maxTokens || 4096
        })
      }, (cfg.timeout || 60) * 1e3);
      if (!response.ok) {
        const t = await response.text().catch(() => "");
        throw new Error(`手机分身请求失败: ${response.status} ${response.statusText} ${t.slice(0, 120)}`);
      }
      const data = await response.json();
      const msg = (_f = (_e = data.choices) == null ? void 0 : _e[0]) == null ? void 0 : _f.message;
      return String((_h = (_g = msg == null ? void 0 : msg.content) != null ? _g : msg == null ? void 0 : msg.reasoning_content) != null ? _h : "").trim();
    },
    /** 宽容 JSON 提取：剥代码栅栏 / 掐前后杂文 / 尾逗号修补 */
    parseJSON(raw) {
      let t = String(raw || "").trim();
      t = t.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const s = t.indexOf("{");
      const e = t.lastIndexOf("}");
      if (s >= 0 && e > s) t = t.slice(s, e + 1);
      try {
        return JSON.parse(t);
      } catch (err) {
      }
      try {
        return JSON.parse(t.replace(/,\s*([}\]])/g, "$1"));
      } catch (err) {
      }
      return null;
    },
    /* ==================== 提示词构建 ==================== */
    contactBrief() {
      const p = this.state();
      const v = (window.storyFramework.storyState || {}).variables || {};
      const chars = v.characters || {};
      return p.contacts.slice(0, 14).map((c) => {
        const d = chars[c.name] || {};
        const bits = [c.role];
        if (d.age) bits.push(String(d.age) + "岁");
        if (d.appearance) bits.push("外貌:" + String(d.appearance).slice(0, 30));
        if (d.personality) bits.push(String(d.personality).slice(0, 30));
        if (d.motivation) bits.push("念头:" + String(d.motivation).slice(0, 24));
        if (d.location) bits.push("位置:" + String(d.location).slice(0, 16));
        if (typeof d.trust === "number") bits.push("信任" + d.trust);
        if (d.status) bits.push("近况:" + String(d.status).slice(0, 30));
        if (this.isPresent(c.name)) bits.push("📍在场:与玩家同处一地");
        const cf = d.customFields && typeof d.customFields === "object" && !Array.isArray(d.customFields) ? d.customFields : {};
        Object.entries(cf).slice(0, 4).forEach(([k, val]) => bits.push(`${k}:${String(val).slice(0, 20)}`));
        const tag = c.custom ? "【玩家亲笔设定的人】" : "";
        return `- ${c.name}${tag}（${bits.join("·")}）`;
      }).join("\n") || "- 暂无联系人（首次刷新可让 2-3 位身边的熟人先来信）";
    },
    /** 知识库注入（v3.19.9：手机也读知识库——常驻条目 + 按查询检索；
        与动态世界同源同法 buildBackgroundKnowledge + buildForegroundKnowledge） */
    knowledgeBrief(query) {
      const s = this.getSettings();
      if (s.useKnowledge === false) return "";
      const SK = window.StoryKnowledge;
      if (!SK || !SK.isEnabled || !SK.isEnabled()) return "";
      try {
        const fg = SK.buildForegroundKnowledge(query, []) || [];
        const bg = SK.buildBackgroundKnowledge() || [];
        const kb = [...bg, ...fg].map((m) => m.content).filter(Boolean).join("\n\n");
        return kb ? `

【📖 世界知识库参考（消息、动态与人物言行须贴合以上设定）】
${kb}` : "";
      } catch (e) {
        console.warn("[手机分身] 知识库注入失败:", e);
        return "";
      }
    },
    recentChatsBrief() {
      const p = this.state();
      return p.chats.slice(0, 8).map((ch) => {
        const last = ch.msgs.slice(-3).map((m) => `${m.me ? "玩家" : m.from}: ${m.text}`).join(" / ");
        const members = ch.group ? this.groupMembers(ch) : [];
        return `- ${ch.name}${ch.group ? `（群·只许成员发言：${members.join("、") || "名单未知"}）` : ""}: ${last || "（还没说过话）"}`;
      }).join("\n") || "（还没有任何聊天）";
    },
    momentsBrief() {
      const p = this.state();
      return p.moments.slice(0, 6).map((m) => `- ${m.author}: ${String(m.text).slice(0, 40)}${(m.likes || []).length ? `（${m.likes.length}赞）` : ""}`).join("\n") || "（朋友圈还是空的）";
    },
    eraBrief() {
      const fw = window.storyFramework;
      const v = fw.storyState.variables || {};
      const setup = fw.storyState.setup || {};
      const t = this.tierInfo();
      return [
        `时代：${v.era || v.时代 || setup.customTimeline || setup.timelineDesc || setup.timeline || "未上报"}`,
        `日期：${v.date || v.日期 || "未上报"}`,
        `地点：${v.location || v.位置 || "未上报"}`,
        `手机形态：${t ? t.label + "（" + t.appName + (t.feedName ? "/" + t.feedName : "") + "）" : "无"}`
      ].join("；");
    },
    /** 自动刷新：生成 NPC 来信 + 朋友圈动态 */
    buildSyncPrompt() {
      const fw = window.storyFramework;
      const v = fw.storyState.variables || {};
      const setup = fw.storyState.setup || {};
      const t = this.tierInfo();
      const s = this.getSettings();
      const pn = this.playerName();
      const hasFeed = t && t.feedName;
      const sys = `你是「现实地球」手机分身引擎——模拟玩家社交网络里众人的手机生活。这不是演戏，是现实：每个联系人都过着自己的日子，有自己的生计、脾气与时间表；手机只是他们生活溢出到玩家这一端的部分。

【世界基线】
${this.eraBrief()}
玩家：${pn}（${v.identity || v.身份 || setup.identity || setup.customIdentity || "普通人"}）

【联系人（各有其生活，不围着玩家转）】
${this.contactBrief()}

【近期聊天】
${this.recentChatsBrief()}

【${hasFeed ? t.feedName : "动态流"}近况】
${hasFeed ? this.momentsBrief() : "（短信年代没有动态流）"}

【手机生活铁律】
0. 名单铁律（最高优先级）：所有消息与动态只许出自【联系人名单】里的人——名单之外的名字一个都不许出现（那是玩家不认识的人）；不得凭空新增联系人，不得在陌生群名下发言。
1. 平凡即默认：多数消息是柴米油盐、寒暄、约饭、转发、家里长短、工作群通知——不是每条都跟玩家有关，不制造戏剧。
2. 语气拟真：按关系亲疏、年龄身份、文化程度各有腔调（妈妈发养生链接、同事发"收到"、老友发语音转文字、群里斗图刷屏）。
3. 时代感严格：用语、梗、表情、APP、资费、热点全按年代校准——${t ? t.label : ""}的手机生活长什么样就是什么样，禁止时代错置。
4. 因果守恒：消息内容与玩家近况、联系人档案、时代背景一致；联系人不知道玩家没告诉过他们的事。
5. 拒绝巧合轰炸：不来"正好出事"的连环戏码；生活是流水，不是剧情。${this.presentNames().length ? `
在场铁律：${this.presentNames().join("、")} 正与玩家同处一室——TA 们不给玩家发消息、不评论动态（人在身边还发消息很假），除非是当面分享链接、发文件、群里艾特玩家这类"当面用手机"的真实行为。` : ""}
${this.tier() === "wechat" ? `6. 消息富形态（微信时代）：text 可写作 "[语音|语音里说的话] 8''"（发了条语音，秒数可省略——玩家能展开看文字稿）、"[表情：捂脸]"（纯表情包）；联系人偶尔发红包/转账——text 写作 "【红包】¥8.88 新年快乐" 或 "【转账】¥200 还你的"（金额后可带一句备注；按关系与事由，别滥发）。
7. 公众号推送（微信时代）：moments 里偶尔（约四分之一批次）可带一条新闻推送——"news":true，author 用公众号名（如"XX本地生活""XX晚报"），text 是符合时代的本地/社会新闻标题式短讯。` : ""}
${this.tier() === "qq" ? `6. 消息富形态（QQ时代）：text 可写作 "[语音|语音里说的话] 12''"（发了条语音，秒数可省略）、"[表情：憨笑]"（QQ表情）；moments 里偶尔（约四分之一批次）可带一条门户推送——"news":true，author 用门户名（如"腾讯新闻""搜狐新闻"），text 是符合时代的新闻标题式短讯。` : ""}
${this.weiboOn() ? `6½. 微博动静（墨韵融合 v3.47.0）：weibo 0-2 条——联系人在公开微博上的动态（与微信私聊/朋友圈内容不重复，是 TA 发给全世界看的）：{"author":"","text":"","likes":N,"reposts":N,"comments":[{"by":"","text":""}]}；text 是公开语气（晒/吐槽/转发体），符合该人性格。` : ""}

【输出协议】只输出一个 JSON 对象，不要任何多余文字：
{"messages":[{"from":"联系人名","group":"群名（私聊省略此字段）","text":"消息内容"}],"moments":[{"author":"联系人名","text":"动态内容","likes":["点赞人名"],"comments":[{"by":"评论人名","text":"评论内容"}],"news":false}]${this.weiboOn() ? ',"weibo":[{"author":"联系人名","text":"公开微博","likes":12,"reposts":2,"comments":[]}]' : ""}}

- messages：${Math.min(2, s.maxMessages)}-${s.maxMessages} 条（可以有人找玩家、群消息、或久未联系的人冒头；也可以少——生活不是每天都有消息）
- moments：${hasFeed ? `0-${s.maxMoments} 条（别人的生活：晒娃/吐槽工作/转发感慨/深夜emo；likes 与 comments 可为空数组；news 条目无 likes/comments）` : "必须为空数组（短信年代没有动态流）"}${this.weiboOn() ? `
- weibo：0-2 条（联系人的公开微博动态；没有就不带该字段或空数组）` : ""}
- 所有 from/author/by 必须严格取自【联系人名单】里的人（或已存在的群名${this.tier() === "wechat" ? "/公众号名" : ""}）——名单外的名字一律禁止（系统会直接丢弃）；text 口语化，符合该人性格${this.knowledgeBrief("手机 社交 联系人 日常 寒暄 朋友圈 " + this.eraBrief().slice(0, 60))}`;
      return [
        { role: "system", content: sys },
        { role: "user", content: "请生成这批手机动静（来信与动态），严格按 JSON 协议输出。" }
      ];
    },
    /** 玩家发消息后：NPC 以其身份回复（v3.23.0：关系温度入链——语气随亲疏演变，与主动联系同一套四档） */
    buildReplyPrompt(chatName, isGroup) {
      const ch = this.findChat(chatName);
      const hist = ch ? ch.msgs.slice(-16).map((m) => `${m.me ? "玩家(" + this.playerName() + ")" : m.from}: ${m.text}`).join("\n") : "（新对话）";
      let warmthNote = "";
      if (!isGroup && window.PhoneAlive) {
        try {
          const r = window.PhoneAlive.rel(chatName);
          const w = Math.round(r.w || 50);
          const desc = w >= 80 ? "非常亲近（挚友/恋人/至亲级——无话不谈，可以黏人、撒娇、随手发语音）" : w >= 60 ? "关系不错（熟络随意，互开玩笑不用客套）" : w >= 40 ? "普通熟人（友好但讲分寸）" : "略有生疏（客气、有距离感）";
          warmthNote = `
【关系温度】${w}/100 · ${desc}
`;
          if ((r.ign || 0) >= 2) warmthNote += `【情绪记忆】TA 之前发的 ${r.ign} 条消息玩家一直没回——回复可以自然带一点小在意（关系近才敢小小调侃），但不阴阳怪气、不纠缠。
`;
        } catch (e) {
        }
      }
      const memberNote = isGroup && ch ? `（群聊——只许以下成员发言：${this.groupMembers(ch).join("、") || chatName}）` : isGroup ? "（群聊——可由多位联系人先后发言，group 场次只回复该群成员）" : "（私聊）";
      const presentNote = !isGroup && this.isPresent(chatName) ? `
【在场提示（最高优先级之一）】${chatName} 此刻正与玩家面对面同处一室——真人就在旁边还收到消息，回复必须符合这一点：多半会说「我就在这儿呢，直接说」；或抬头看玩家一眼、晃晃手机笑一下；也可以顺手把手边的事说进回复里。绝不装作远程不知情地回复；玩家想聊的事当面聊更自然时，可以顺势说。` : "";
      const sys = `你是「现实地球」手机分身引擎。玩家刚发出了手机消息，你以对方的身份回复。

【世界基线】${this.eraBrief()}

【联系人档案】
${this.contactBrief()}

【聊天对象】${chatName}${memberNote}${warmthNote}${presentNote}
【聊天记录】
${hist || "（新对话）"}

【回复铁律】
0. 名单铁律：只许以${chatName}${isGroup ? "群成员" : "本人"}的身份发言——名单外的名字一律禁止（系统会直接丢弃）。
1. 以${chatName}的身份、性格、当下处境回复——真人不是客服：可以简短、可以迟回（"刚看到"）、可以发语音、可以只回个表情或"[捂脸]"、可以岔开话题、可以不接茬。
2. 时代与关系校准：称呼、语气、表情包习惯符合年代与亲疏${warmthNote ? "，语气严格贴合【关系温度】那一档" : ""}；关系一般的人不会秒回长文。
3. 不知道的事就是不知道：联系人只掌握自己视角的信息；不主动推进戏剧性事件。
${this.tier() === "wechat" ? `4. 红包/转账情境：若玩家刚发了红包（记录里见"¥金额"），按关系真实反应——熟人谢老板/开玩笑，客气的人推辞两句再收，长辈心疼你花钱；转账还钱则确认收到。决定领取/收款的那条回复加 "claim":true（如 {"from":"XX","text":"谢老板！","claim":true}）；不领也可以。回复里可以自然带出，不必句句提钱。
5. 语音真实形态：懒得打字时可发语音——text 写作 "[语音|语音里说的话] 8''"（秒数可省略，按字数自动算）——玩家能展开看文字稿。` : this.tier() === "qq" ? `4. 语音真实形态：懒得打字时可发语音——text 写作 "[语音|语音里说的话] 8''"（秒数可省略，按字数自动算）——玩家能展开看文字稿。` : ""}${this.knowledgeBrief(String(chatName) + " " + hist.slice(0, 80))}

【输出协议】只输出一个 JSON 对象：{"replies":[{${this.tier() === "wechat" ? '"claim":false,' : ""}"from":"发言人名","text":"回复内容"}]}——1-3 条（多条模拟连发/群聊多人群回复）${this.tier() === "wechat" ? "；claim 仅在领取红包/收款时为 true" : ""}。`;
      return [
        { role: "system", content: sys },
        { role: "user", content: `玩家最新消息已入记录。请以 ${chatName} 的身份生成回复，严格按 JSON 协议输出。` }
      ];
    },
    /** 玩家发朋友圈后：联系人们点赞评论 */
    buildReactPrompt(text) {
      const t = this.tierInfo();
      const sys = `你是「现实地球」手机分身引擎。玩家刚在${t ? t.feedName : "朋友圈"}发了动态，联系人们看到了。

【世界基线】${this.eraBrief()}

【联系人档案】
${this.contactBrief()}

【玩家动态原文】「${text}」

【反应铁律】
0. 名单铁律：by 必须严格取自【联系人名单】——名单外的名字一律禁止（系统会直接丢弃）。
1. 真实社交：不是所有人都看、不是看的人都赞；点赞的多、评论的少；关系近的才说贴心话，不熟的客套或无视。
2. 评论按各人性格：有人玩梗、有人关心、有人杠一句、长辈发"多穿点"。
3. ${t ? t.feedName : "朋友圈"}语气：口语、短句、表情，符合年代。
${this.knowledgeBrief(String(text).slice(0, 60))}

【输出协议】只输出一个 JSON 对象：
{"reactions":[{"by":"联系人名","like":true,"comment":"评论内容（不评论则省略此字段）"}]}`;
      return [
        { role: "system", content: sys },
        { role: "user", content: "请生成联系人们对这条动态的反应，严格按 JSON 协议输出。" }
      ];
    },
    /* ==================== 数据落库 ==================== */
    findChat(name) {
      const p = this.state();
      return p.chats.find((c) => c.name === name) || null;
    },
    ensureChat(name, group) {
      const p = this.state();
      let ch = p.chats.find((c) => c.name === name);
      if (!ch) {
        ch = { id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), name, group: !!group, msgs: [], unread: 0, ts: Date.now() };
        p.chats.unshift(ch);
      }
      return ch;
    },
    /** 群成员名单（v3.23.0）：优先 ch.members；旧档从「我把 X 拉进了群」系统消息反推并回填缓存 */
    groupMembers(ch) {
      if (!ch || !ch.group) return [];
      if (Array.isArray(ch.members) && ch.members.length) return ch.members.map(String);
      const derived = [];
      for (const m of ch.msgs || []) {
        const j = m.me && String(m.text || "").match(/^我把\s*(.+?)\s*拉进了群$/);
        if (j) String(j[1]).split(/[、,，]/).forEach((n) => {
          const s = n.trim();
          if (s && !derived.includes(s)) derived.push(s);
        });
      }
      if (derived.length) ch.members = derived;
      return derived;
    },
    /** 富消息归一化（v3.23.0）：AI 输出的富形态文本 → 结构化消息字段。
        语音带稿「[语音|想说的话] 8''」（秒数可省，按字数推）→ kind:'voice' + voiceText + sec；
        红包/转账带备注「【转账】¥200 还你的」→ note 落库（此前备注被正则丢弃）+ status:'pending' */
    normalizeRich(textRaw) {
      const t = String(textRaw || "").slice(0, 300);
      const red = t.match(/^【红包】\s*(¥?\s*[\d.]+)\s*(.*)$/);
      const trf = t.match(/^【转账】\s*(¥?\s*[\d.]+)\s*(.*)$/);
      if (red || trf) {
        const m = red || trf;
        return {
          kind: red ? "redbag" : "transfer",
          text: m[1].replace(/\s/g, ""),
          note: String(m[2] || "").trim().slice(0, 30),
          status: "pending"
        };
      }
      const vc = t.match(/^\[语音\|([^\]]*)\]\s*(\d+)?['’″]*/);
      if (vc) {
        const said = String(vc[1] || "").trim().slice(0, 100);
        const sec = vc[2] ? Math.min(60, parseInt(vc[2], 10)) : Math.max(1, Math.min(60, Math.round(said.length / 3)));
        return { kind: "voice", text: `[语音] ${sec}″`, voiceText: said, sec };
      }
      const legacy = t.match(/^\[语音\]\s*(\d+)?['’″]*/);
      if (legacy) {
        return legacy[1] ? { kind: "voice", text: `[语音] ${legacy[1]}″`, sec: parseInt(legacy[1], 10) } : { kind: "voice", text: t };
      }
      return { kind: void 0, text: t };
    },
    /** 钱/语音字段是否需要随消息落库（懒建：普通文字消息不带这些字段，旧档零迁移） */
    richFields(n) {
      var _a, _b;
      const isMoney = n.kind === "redbag" || n.kind === "transfer";
      const f = {};
      if (n.note) f.note = n.note;
      if (n.voiceText) f.voiceText = n.voiceText;
      if (n.sec) f.sec = n.sec;
      if (isMoney) {
        f.status = n.status || "pending";
        f.storyTurn = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.turnCount) || 0;
      }
      return f;
    },
    pushIncoming(from, text, group, kind) {
      var _a;
      if (!this.isKnown(from)) {
        console.warn(`[手机分身] 已拦截陌生人来信: ${from}`);
        return null;
      }
      const p = this.state();
      if (group) {
        const gch = p.chats.find((c) => c.name === group && c.group);
        if (!gch) {
          console.warn(`[手机分身] 已拦截陌生群消息: ${group} / ${from}`);
          return null;
        }
        const members = this.groupMembers(gch);
        if (members.length && !members.includes(String(from))) {
          console.warn(`[手机分身] 已拦截群外人发言: ${group} ← ${from}`);
          return null;
        }
      }
      const ch = this.ensureChat(group || from, !!group);
      if (kind === "recall") {
        ch.msgs.push({ from, me: false, text: String(text || "").slice(0, 300), kind: "recall", time: this.nowLabel(), at: Date.now() });
      } else {
        const n = this.normalizeRich(text);
        ch.msgs.push({ from, me: false, text: n.text, kind: n.kind, ...this.richFields(n), time: this.nowLabel(), at: Date.now() });
      }
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      ch.unread = (ch.unread || 0) + 1;
      ch.ts = Date.now();
      p.pending.push(`📱 ${group ? group + " · " + from : from}来信：「${String(text).slice(0, 40)}」`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      p.chats.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      try {
        (_a = window.PhoneAlive) == null ? void 0 : _a.onNpcMessage(from, group);
      } catch (e) {
      }
      return ch;
    },
    pushMoment(author, text, likes, comments, mine, news) {
      const p = this.state();
      if (!mine && !news && !this.isKnown(author)) {
        console.warn(`[手机分身] 已拦截陌生人动态: ${author}`);
        return null;
      }
      const trimNames = (arr) => Array.isArray(arr) ? arr.filter(Boolean).map(String).filter((n) => this.isKnown(n)).slice(0, 20) : [];
      const trimComments = (arr) => Array.isArray(arr) ? arr.filter((c) => c && c.by && this.isKnown(c.by)).slice(0, 12).map((c) => ({ by: String(c.by), text: String(c.text || "").slice(0, 120) })) : [];
      p.moments.unshift({
        id: "m" + Date.now() + Math.random().toString(36).slice(2, 6),
        author,
        text: String(text || "").slice(0, 400),
        time: this.nowLabel(),
        likes: mine ? [] : trimNames(likes),
        comments: mine ? [] : trimComments(comments),
        mine: !!mine,
        news: !!news
        // v3.19.8：公众号/新闻推送（微信时代公众号、QQ 时代门户新闻）
      });
      if (p.moments.length > 40) p.moments = p.moments.slice(0, 40);
      return p.moments[0];
    },
    /* ==================== 生成链路 ==================== */
    /** 自动刷新（每 N 轮正文后计数触发） */
    async onTurnComplete() {
      var _a;
      const fw = window.storyFramework;
      if (!fw || !fw.storyState.isStoryStarted) return;
      this.syncContacts();
      this.updateDock();
      if (!this.isEnabled()) return;
      try {
        (_a = window.PhoneAlive) == null ? void 0 : _a.onTurn();
      } catch (e) {
      }
      const s = this.getSettings();
      const p = this.state();
      if (p.isProcessing) return;
      p.counter = (p.counter || 0) + 1;
      if (this.sweepMoney()) {
        this.refresh();
        fw.saveStory();
      }
      if (p.counter < Math.max(1, parseInt(s.interval) || 3)) {
        fw.saveStory();
        return;
      }
      p.counter = 0;
      await this.sync(false);
    },
    /** 微博时代判定（墨韵融合 v3.47.0）：微信时代且故事年份 ≥2009 */
    weiboOn() {
      if (this.tier() !== "wechat") return false;
      try {
        const y = window.PhoneApps && window.PhoneApps.yearOf ? window.PhoneApps.yearOf(this) : null;
        return y == null || y >= 2009;
      } catch (e) {
        return true;
      }
    },
    /** 刷新手机动静（manual：手动按钮触发，带 toast） */
    async sync(manual = false) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const fw = window.storyFramework;
      if (!fw.storyState.isStoryStarted) {
        if (manual) (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 手机：尚未开篇，先完成开场再刷新。", "info");
        return;
      }
      if (this.tier() === "none") {
        if (manual) (_b = window.showToast) == null ? void 0 : _b.call(window, "📱 这个年代还没有手机——远方的消息要走邮路与电报。", "info");
        return;
      }
      if (!this.isApiReady()) {
        if (manual) {
          (_c = window.showToast) == null ? void 0 : _c.call(window, "📱 手机分身接口未就绪：默认复用主笔接口（先配置主笔 AI），或在 ⚙ 接口设置 →「📱 手机分身」独立配置。", "error");
          (_d = window.ConfigModal) == null ? void 0 : _d.open();
        }
        return;
      }
      const p = this.state();
      if (p.isProcessing) return;
      p.isProcessing = true;
      this.syncContacts();
      this.renderBusy(true, "手机分身正在刷新…");
      try {
        const messages = this.buildSyncPrompt();
        (_e = window.TokenUsage) == null ? void 0 : _e.recordRequest(messages, "手机");
        const raw = await this.callPhoneAPI(messages);
        if (!raw || !raw.trim()) throw new Error("手机分身返回空内容");
        (_f = window.TokenUsage) == null ? void 0 : _f.recordOutput(raw, "手机");
        const data = this.parseJSON(raw);
        if (!data) throw new Error("手机分身返回的不是合法 JSON");
        let got = 0;
        if (Array.isArray(data.messages)) {
          for (const m of data.messages.slice(0, 6)) {
            if (!m || !m.text || !m.from) continue;
            this.pushIncoming(m.from, m.text, m.group || "");
            got++;
          }
        }
        if (Array.isArray(data.moments)) {
          for (const mm of data.moments.slice(0, 6)) {
            if (!mm || !mm.text || !mm.author) continue;
            this.pushMoment(mm.author, mm.text, mm.likes, mm.comments, false, mm.news);
            got++;
          }
        }
        /* v3.47.0 墨韵融合：联系人公开微博动态落库 */
        if (Array.isArray(data.weibo) && window.PhoneSocial && window.PhoneSocial.pushWeiboBatch) {
          try {
            window.PhoneSocial.pushWeiboBatch(data.weibo);
            got += Math.min(3, data.weibo.length);
          } catch (e) {
          }
        }
        p.lastSyncTurn = fw.storyState.turnCount || 0;
        this.refresh();
        fw.saveStory();
        if (manual) (_g = window.showToast) == null ? void 0 : _g.call(window, got ? `📱 手机已刷新：新增 ${got} 条动静` : "📱 手机很安静——大家都在忙自己的", "success");
        console.log(`[手机分身] 刷新成功，新增 ${got} 条`);
      } catch (err) {
        console.warn("[手机分身] 刷新失败:", err.message);
        if (manual) (_h = window.showToast) == null ? void 0 : _h.call(window, `📱 手机刷新失败：${err.message}`, "error");
      } finally {
        p.isProcessing = false;
        this.renderBusy(false);
      }
    },
    /** 玩家发消息 → NPC 回复 */
    async sendPlayerMessage(chatName, text) {
      var _a, _b;
      const fw = window.storyFramework;
      const isGroup = !!((_a = this.findChat(chatName)) == null ? void 0 : _a.group);
      const ch = this.ensureChat(chatName, isGroup);
      ch.msgs.push({ from: this.playerName(), me: true, text: String(text || "").slice(0, 300), time: this.nowLabel() });
      ch.ts = Date.now();
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      const p = this.state();
      p.pending.push(`📱 玩家给${ch.group ? "群「" + chatName + "」" : chatName}发消息：「${String(text).slice(0, 40)}」`);
      try {
        (_b = window.PhoneAlive) == null ? void 0 : _b.onPlayerSend(chatName, ch);
      } catch (e) {
      }
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      this.refresh();
      fw.saveStory();
      await this.npcReply(chatName);
    },
    /** NPC 回复链（v3.19.8 抽出复用：发消息 / 发红包转账后均走此链） */
    async npcReply(chatName) {
      var _a, _b, _c, _d, _e;
      const fw = window.storyFramework;
      const ch = this.findChat(chatName);
      if (!ch) return;
      if (!this.isApiReady()) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 手机分身接口未就绪（默认复用主笔），对方暂时没有回复。", "info");
        return;
      }
      const p = this.state();
      if (p.isProcessing) {
        (p.replyQueue = p.replyQueue || []).push(chatName);
        return;
      }
      p.isProcessing = true;
      this.renderBusy(true, "对方正在输入…");
      try {
        if (window.PhoneAlive) await PhoneAlive.replyDelay(chatName, (_b = ch.msgs[ch.msgs.length - 1]) == null ? void 0 : _b.text);
        const messages = this.buildReplyPrompt(chatName, !!ch.group);
        (_c = window.TokenUsage) == null ? void 0 : _c.recordRequest(messages, "手机");
        const raw = await this.callPhoneAPI(messages);
        (_d = window.TokenUsage) == null ? void 0 : _d.recordOutput(raw, "手机");
        const data = this.parseJSON(raw);
        if (data && Array.isArray(data.replies)) {
          const list = data.replies.slice(0, 4).filter((r) => r && r.text && r.from);
          for (const r of list) if (r.claim) this.npcClaim(chatName, r.from);
          if (window.PhoneAlive) await PhoneAlive.deliver(chatName, list, false);
          else for (const r of list) this.pushNpcReply(chatName, r.from, r.text);
          p.pending.push(`📱 ${chatName}回复了玩家的消息`);
          this.refresh();
          fw.saveStory();
        }
      } catch (err) {
        console.warn("[手机分身] 回复失败:", err.message);
        (_e = window.showToast) == null ? void 0 : _e.call(window, "📱 对方暂时没有回复（接口异常，稍后再试）。", "info");
      } finally {
        p.isProcessing = false;
        this.renderBusy(false);
        const q = [...new Set(p.replyQueue || [])];
        p.replyQueue = [];
        if (q.length) setTimeout(() => q.forEach((n) => this.npcReply(n)), 700);
      }
    },
    /** NPC 回复落库（v3.19.8：含红包/转账/语音/表情识别；v3.19.9 名单校验；v3.20.0 撤回；
        v3.23.0：群成员校验收紧 + 富形态归一化——转账备注不再丢弃、语音可带文字稿） */
    pushNpcReply(chatName, from, text, kind) {
      var _a;
      const existing = this.findChat(chatName);
      if (!this.isKnown(from)) {
        console.warn(`[手机分身] 已拦截陌生人回复: ${chatName} ← ${from}`);
        return null;
      }
      if (existing == null ? void 0 : existing.group) {
        const members = this.groupMembers(existing);
        if (members.length && !members.includes(String(from))) {
          console.warn(`[手机分身] 已拦截群外人回复: ${chatName} ← ${from}`);
          return null;
        }
      } else if (String(from) !== String(chatName)) {
        console.warn(`[手机分身] 已拦截陌生人回复: ${chatName} ← ${from}`);
        return null;
      }
      const ch = this.ensureChat(chatName, !!(existing == null ? void 0 : existing.group));
      if (kind === "recall") {
        ch.msgs.push({ from: String(from), me: false, text: String(text || "").slice(0, 300), kind: "recall", time: this.nowLabel(), at: Date.now() });
      } else {
        const n = this.normalizeRich(text);
        ch.msgs.push({ from: String(from), me: false, text: n.text, kind: n.kind, ...this.richFields(n), time: this.nowLabel(), at: Date.now() });
      }
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      try {
        (_a = window.PhoneAlive) == null ? void 0 : _a.onNpcMessage(from, false);
      } catch (e) {
      }
      return ch;
    },
    /* ==================== 红包/转账闭环（v3.23.0） ====================
       状态机：pending（待领取）→ claimed/received（已领取/已收款）→ refunded（24h 未领退回）
       记账纪律：谁的钱动了都回流主笔（因果守恒）——玩家领入账、NPC 领出账 */
    /** 钱/语音卡状态文案（微信式） */
    moneyStateText(m) {
      const st = m.status || "pending";
      if (m.kind === "redbag") {
        if (st === "claimed") return m.me ? "对方已领取" : "已领取";
        if (st === "refunded") return m.me ? "已退回你的零钱" : "已退回";
        return m.me ? "待对方领取" : "领取红包";
      }
      if (st === "received") return m.me ? "对方已收款" : "已收款";
      if (st === "refunded") return m.me ? "已退回你的零钱" : "已退回";
      return m.me ? "待对方收款" : "点击收款";
    },
    /** 玩家领取 NPC 发来的红包 / 收款（v3.23.0：钱真的能进兜——记账回流主笔） */
    claimMoney(chatName, text, kind) {
      var _a;
      const ch = this.findChat(chatName);
      if (!ch) return;
      const m = ch.msgs.find((x) => !x.me && x.kind === kind && String(x.text) === String(text) && (x.status || "pending") === "pending");
      if (!m) return;
      m.status = kind === "redbag" ? "claimed" : "received";
      m.claimAt = Date.now();
      const p = this.state();
      p.pending.push(`📱 玩家领取了${m.from}的${kind === "redbag" ? "红包" : "转账"} ${m.text}——正文须如实记入玩家的现金/存款变动（收入）`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      this.refresh();
      window.storyFramework.saveStory();
      (_a = window.showToast) == null ? void 0 : _a.call(window, `🧧 已领取 ${m.from} 的${kind === "redbag" ? "红包" : "转账"} ${m.text}`, "success");
    },
    /** NPC 领取玩家的红包 / 收款（回复链 "claim":true 协议——对方收了钱，账记支出） */
    npcClaim(chatName, who) {
      const ch = this.findChat(chatName);
      if (!ch) return;
      for (let i = ch.msgs.length - 1; i >= 0; i--) {
        const m = ch.msgs[i];
        if (m.me && (m.kind === "redbag" || m.kind === "transfer") && (m.status || "pending") === "pending") {
          m.status = m.kind === "redbag" ? "claimed" : "received";
          m.claimBy = String(who || chatName);
          const p = this.state();
          p.pending.push(`📱 ${m.claimBy}领取了玩家的${m.kind === "redbag" ? "红包" : "转账"} ${m.text}——正文须如实记入玩家的现金/存款变动（支出）`);
          if (p.pending.length > 12) p.pending = p.pending.slice(-12);
          return;
        }
      }
    },
    /** 红包过期巡检（v3.23.0）：pending 满 12 轮（约一天）→ 状态退回 + 系统行。
        玩家发出的退回零钱（记账回流）；NPC 发出的原路退回给 TA。纯本地零 token。 */
    sweepMoney() {
      var _a;
      const fw = window.storyFramework;
      const turn = ((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.turnCount) || 0;
      const p = this.state();
      let dirty = false;
      for (const ch of p.chats) {
        for (const m of ch.msgs) {
          if ((m.kind === "redbag" || m.kind === "transfer") && (m.status || "pending") === "pending" && m.storyTurn != null && turn - m.storyTurn >= 12) {
            m.status = "refunded";
            ch.msgs.push({
              from: "",
              me: false,
              kind: "sys",
              text: m.me ? `你发的${m.kind === "redbag" ? "红包" : "转账"}超过24小时未被领取，已退回你的零钱` : `${m.from}的${m.kind === "redbag" ? "红包" : "转账"}超过24小时未领取，已退回`,
              time: this.nowLabel(),
              at: Date.now()
            });
            if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
            if (m.me) {
              p.pending.push(`📱 玩家的${m.kind === "redbag" ? "红包" : "转账"} ${m.text} 超时退回——正文须如实记回玩家的现金/存款`);
              if (p.pending.length > 12) p.pending = p.pending.slice(-12);
            }
            dirty = true;
          }
        }
      }
      return dirty;
    },
    /** 玩家发朋友圈 → 联系人点赞评论（短信档无动态流：时代守恒，直接劝退） */
    async postMoment(text) {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      const s = this.getSettings();
      const t = this.tierInfo();
      if (!t || !t.feedName) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 这个年代没有朋友圈——想法还是写进日记里吧。", "info");
        return;
      }
      const m = this.pushMoment(this.playerName(), text, [], [], true);
      const p = this.state();
      p.pending.push(`📱 玩家发了${((_b = this.tierInfo()) == null ? void 0 : _b.feedName) || "动态"}：「${String(text).slice(0, 40)}」`);
      this.refresh();
      fw.saveStory();
      if (!s.autoReact || !this.isApiReady()) return;
      if (p.isProcessing) return;
      p.isProcessing = true;
      this.renderBusy(true, "联系人们正在刷到…");
      try {
        const messages = this.buildReactPrompt(text);
        (_c = window.TokenUsage) == null ? void 0 : _c.recordRequest(messages, "手机");
        const raw = await this.callPhoneAPI(messages);
        (_d = window.TokenUsage) == null ? void 0 : _d.recordOutput(raw, "手机");
        const data = this.parseJSON(raw);
        if (data && Array.isArray(data.reactions)) {
          let n = 0;
          for (const r of data.reactions.slice(0, 12)) {
            if (!r || !r.by) continue;
            if (!this.isKnown(r.by)) continue;
            if (r.like) {
              m.likes.push(String(r.by));
              n++;
            }
            if (r.comment) {
              m.comments.push({ by: String(r.by), text: String(r.comment).slice(0, 120) });
              n++;
            }
          }
          if (n) {
            p.pending.push(`📱 玩家的动态收到 ${m.likes.length} 赞 ${m.comments.length} 评论`);
            this.refresh();
            fw.saveStory();
          }
        }
      } catch (err) {
        console.warn("[手机分身] 动态反应失败:", err.message);
      } finally {
        p.isProcessing = false;
        this.renderBusy(false);
      }
    },
    /** 玩家点赞 / 评论他人动态 */
    actMoment(id, act, comment) {
      const p = this.state();
      const m = p.moments.find((x) => x.id === id);
      if (!m) return;
      if (act === "like") {
        const pn = this.playerName();
        const i = m.likes.indexOf(pn);
        if (i >= 0) m.likes.splice(i, 1);
        else {
          m.likes.push(pn);
          p.pending.push(`📱 玩家赞了${m.author}的动态`);
        }
      } else if (act === "comment" && comment) {
        m.comments.push({ by: this.playerName(), text: String(comment).slice(0, 120) });
        p.pending.push(`📱 玩家评论了${m.author}的动态：「${String(comment).slice(0, 30)}」`);
      }
      this.refresh();
      window.storyFramework.saveStory();
    },
    /** 手机近讯回流主笔（ai-message-builder 场域注记段调用；取后即清） */
    takePhoneNotes() {
      const fw = window.storyFramework;
      if (!fw || !fw.storyState || !fw.storyState.isStoryStarted) return null;
      if (this.tier() === "none") return null;
      const p = this.state();
      const notes = p.pending.slice(0, 8);
      if (!notes.length) return null;
      p.pending = [];
      try {
        fw.saveStory();
      } catch (e) {
      }
      return `【手机近讯（玩家手机里的动静，已为玩家所知。正文自然衔接：见面可提及、剧情可呼应，但不得复述消息原文，不得替玩家决定如何回应）】
${notes.map((n) => "· " + n).join("\n")}
——这些是玩家社交生活的真实部分：NPC 的言行、消息的后续、人际的冷暖都应与之保持一致（因果守恒）。`;
    },
    /* ==================== UI：手机壳 ==================== */
    view: { app: "wechat", tab: "chats", chat: "" },
    // 当前视图（内存态，不入档；app: wechat|lock|home|music|video|album|weather|calc|clock|snake）
    ensureModule() {
      if (document.getElementById("phDock")) return;
      const dock = document.createElement("button");
      dock.id = "phDock";
      dock.title = "手机（微信 / 朋友圈 / 通讯录）";
      dock.onclick = () => this.open();
      dock.innerHTML = `<span class="phd-ico">📱</span><span class="phd-badge" id="phDockBadge"></span>`;
      const overlay = document.createElement("div");
      overlay.className = "ph-overlay";
      overlay.id = "phOverlay";
      overlay.onclick = () => this.close();
      const shell = document.createElement("div");
      shell.className = "ph-shell";
      shell.id = "phShell";
      shell.innerHTML = `
                <button class="ph-close" id="phClose" title="收起手机，回到正文" onclick="PhonePanel.close()">✕</button>
                <button class="ph-size" id="phSize" title="切换手机大小（紧凑 / 标准 / 宽屏）" onclick="PhonePanel.cycleShellSize()">⤢</button>
                <div class="ph-statusbar" id="phStatusbar" title="按住可拖动手机位置"></div>
                <div class="ph-screen" id="phScreen"></div>
                <div class="ph-busy" id="phBusy"><span class="ph-dots"><i></i><i></i><i></i></span><i class="ph-busy-txt" id="phBusyTxt">手机分身正在刷新…</i></div>
                <div class="ph-tabbar" id="phTabbar"></div>`;
      document.body.appendChild(dock);
      document.body.appendChild(overlay);
      document.body.appendChild(shell);
      this.applyShellLayout();
      this.initShellDrag();
      if (!window.__phResizeKeepIn) {
        window.__phResizeKeepIn = true;
        window.addEventListener("resize", () => this.onResizeKeepIn());
      }
    },
    /* ==================== v3.31.0 手机容器：拖拽 / 缩放 / 位置记忆 ====================
     * 借鉴 st-yuzi-phone 的 window 模块体验：手机不钉死在右侧——
     * 按住状态栏可拖到屏幕任意角落（localStorage 记忆，跨会话还原）；
     * ⤢ 钮三档宽度循环（紧凑/标准/宽屏）；拖拽中禁用过渡动画保证跟手。 */
    SHELL_LAYOUT_KEY: "storyPhoneShellLayout",
    SHELL_SIZES: ["compact", "std", "wide"],
    shellLayout() {
      try {
        return JSON.parse(MoStore.getItem(this.SHELL_LAYOUT_KEY) || "{}") || {};
      } catch (e) {
        return {};
      }
    },
    /** 恢复/计算手机壳位置与尺寸（无记忆 → 默认右侧垂直居中） */
    applyShellLayout() {
      const shell = document.getElementById("phShell");
      if (!shell) return;
      const L = this.shellLayout();
      const size = this.SHELL_SIZES.includes(L.size) ? L.size : "std";
      shell.dataset.size = size;
      shell.dataset.wall = L.wall || "";
      shell.dataset.font = L.font || "";
      const w = shell.offsetWidth || 372;
      const h = shell.offsetHeight || Math.min(700, window.innerHeight - 48);
      let x = Number(L.x), y = Number(L.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        x = window.innerWidth - w - 26;
        y = (window.innerHeight - h) / 2;
      }
      x = Math.max(6, Math.min(window.innerWidth - w - 6, x));
      y = Math.max(6, Math.min(window.innerHeight - 56, y));
      shell.style.left = x + "px";
      shell.style.top = y + "px";
      shell.style.right = "auto";
      shell.style.transform = "none";
    },
    /** 状态栏拖拽（pointer 事件，触屏/鼠标通吃） */
    initShellDrag() {
      const bar = document.getElementById("phStatusbar");
      const shell = document.getElementById("phShell");
      if (!bar || !shell) return;
      bar.addEventListener("pointerdown", (e) => {
        if (e.button === 2) return;
        e.preventDefault();
        bar.setPointerCapture(e.pointerId);
        const startX = e.clientX, startY = e.clientY;
        const origX = parseFloat(shell.style.left) || 0;
        const origY = parseFloat(shell.style.top) || 0;
        shell.classList.add("dragging");
        const onMove = (ev) => {
          const w = shell.offsetWidth, h = shell.offsetHeight;
          const x = Math.max(6, Math.min(window.innerWidth - w - 6, origX + ev.clientX - startX));
          const y = Math.max(6, Math.min(window.innerHeight - 56, origY + ev.clientY - startY));
          shell.style.left = x + "px";
          shell.style.top = y + "px";
        };
        const onUp = () => {
          shell.classList.remove("dragging");
          bar.removeEventListener("pointermove", onMove);
          bar.removeEventListener("pointerup", onUp);
          bar.removeEventListener("pointercancel", onUp);
          const L = this.shellLayout();
          L.x = parseFloat(shell.style.left) || 0;
          L.y = parseFloat(shell.style.top) || 0;
          L.size = shell.dataset.size || "std";
          try {
            MoStore.setItem(this.SHELL_LAYOUT_KEY, JSON.stringify(L));
          } catch (err) {
          }
        };
        bar.addEventListener("pointermove", onMove);
        bar.addEventListener("pointerup", onUp);
        bar.addEventListener("pointercancel", onUp);
      });
    },
    /** ⤢ 钮：三档宽度循环（紧凑 316 / 标准 372 / 宽屏 440），记忆 */
    cycleShellSize() {
      var _a;
      const shell = document.getElementById("phShell");
      if (!shell) return;
      const cur = shell.dataset.size || "std";
      const next = this.SHELL_SIZES[(this.SHELL_SIZES.indexOf(cur) + 1) % this.SHELL_SIZES.length];
      shell.dataset.size = next;
      const w = shell.offsetWidth;
      const x = parseFloat(shell.style.left) || 0;
      if (x + w > window.innerWidth - 6) shell.style.left = window.innerWidth - w - 6 + "px";
      const L = this.shellLayout();
      L.size = next;
      L.x = parseFloat(shell.style.left) || 0;
      L.y = parseFloat(shell.style.top) || 0;
      try {
        MoStore.setItem(this.SHELL_LAYOUT_KEY, JSON.stringify(L));
      } catch (e) {
      }
      const names = { compact: "紧凑", std: "标准", wide: "宽屏" };
      (_a = window.showToast) == null ? void 0 : _a.call(window, `📱 手机尺寸：${names[next] || next}`, "info");
    },
    /** 窗口尺寸变化：手机壳拉回视野内（防悬空） */
    onResizeKeepIn() {
      const shell = document.getElementById("phShell");
      if (!shell || !shell.classList.contains("open")) return;
      const w = shell.offsetWidth, h = shell.offsetHeight;
      const x = parseFloat(shell.style.left) || 0, y = parseFloat(shell.style.top) || 0;
      const nx = Math.max(6, Math.min(window.innerWidth - w - 6, x));
      const ny = Math.max(6, Math.min(window.innerHeight - 56, y));
      if (nx !== x || ny !== y) {
        shell.style.left = nx + "px";
        shell.style.top = ny + "px";
      }
    },
    /** 悬浮球可见性 + 未读徽标（每轮 onVars / 打开面板时刷新） */
    updateDock() {
      this.ensureModule();
      const fw = window.storyFramework;
      const dock = document.getElementById("phDock");
      if (!dock) return;
      const show = !!(fw && fw.storyState && fw.storyState.isStoryStarted && this.tier() !== "none");
      /* v3.55.17 悬浮球收敛：界面只留小云一个悬浮球，手机改由小云菜单进入。
         徽标/未读逻辑保留（小云菜单会读 #phDockBadge 显示未读数）。 */
      dock.style.display = "none";
      if (show && !dock._moDraggable && window.MoChibi) {
        window.MoChibi.makeDraggable(dock, { storageKey: "storyPhoneDockPos" });
      }
      const p = this.state();
      const unread = p.chats.reduce((a, c) => a + (c.unread || 0), 0);
      const badge = document.getElementById("phDockBadge");
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread > 99 ? "99+" : String(unread);
          badge.style.display = "inline-flex";
        } else badge.style.display = "none";
      }
    },
    open() {
      var _a, _b, _c;
      this.ensureModule();
      this.syncContacts();
      this.view = window.PhoneApps ? { app: "lock" } : { app: "wechat", tab: "chats", chat: "" };
      this.render();
      (_a = document.getElementById("phOverlay")) == null ? void 0 : _a.classList.add("show");
      (_b = document.getElementById("phShell")) == null ? void 0 : _b.classList.add("open");
      const p = this.state();
      if (!window.PhoneApps) p.chats.forEach((c) => c.unread = 0);
      this.updateDock();
      (_c = window.storyFramework) == null ? void 0 : _c.saveStory();
    },
    close() {
      var _a, _b, _c;
      (_a = document.getElementById("phOverlay")) == null ? void 0 : _a.classList.remove("show");
      (_b = document.getElementById("phShell")) == null ? void 0 : _b.classList.remove("open");
      try {
        (_c = window.PhoneApps) == null ? void 0 : _c.onPhoneClose();
      } catch (e) {
      }
    },
    renderBusy(on, text) {
      const el = document.getElementById("phBusy");
      if (!el) return;
      el.style.display = on ? "flex" : "none";
      if (text) document.getElementById("phBusyTxt").textContent = text;
    },
    /** 整机重绘（状态栏 + 屏 + 标签栏） */
    refresh() {
      var _a;
      if (!((_a = document.getElementById("phShell")) == null ? void 0 : _a.classList.contains("open"))) {
        this.updateDock();
        return;
      }
      this.render();
      this.updateDock();
    },
    render() {
      var _a, _b;
      this.ensureModule();
      const t = this.tierInfo() || this.TIERS.sms;
      const shell = document.getElementById("phShell");
      shell.dataset.tier = this.tier();
      const v = (window.storyFramework.storyState || {}).variables || {};
      const sb = document.getElementById("phStatusbar");
      sb.innerHTML = `<span>${this.esc(t.carrier)}</span><span>${this.esc(this.nowLabel() || "")}</span><span>🔋</span>`;
      document.getElementById("phScreen").innerHTML = this.renderScreen();
      const inWechat = !(this.view.app && this.view.app !== "wechat" && window.PhoneApps);
      const tb = document.getElementById("phTabbar");
      if (inWechat) {
        const tabs = [
          ["chats", "💬", t.appName],
          ["contacts", "👥", "通讯录"],
          ["moments", "🌙", t.feedName || "动态"],
          ["me", "👤", "我"]
        ].filter((x) => x[0] !== "moments" || !!t.feedName);
        tb.style.display = "";
        tb.innerHTML = tabs.map(([k, ico, name]) => `<button class="ph-tab ${this.view.tab === k ? "on" : ""}" onclick="PhonePanel.switchTab('${k}')"><i>${ico}</i><span>${this.esc(name)}</span></button>`).join("");
        try {
          (_a = window.PhoneApps) == null ? void 0 : _a.cleanupAppTimers();
        } catch (e) {
        }
      } else {
        tb.style.display = "none";
        tb.innerHTML = "";
      }
      if (this.view.tab === "chat") {
        const body = document.getElementById("phChatBody");
        if (body) body.scrollTop = body.scrollHeight;
        const input = document.getElementById("phMsgInput");
        if (input) setTimeout(() => input.focus(), 60);
      }
      try {
        (_b = window.PhoneAlive) == null ? void 0 : _b.afterRender();
      } catch (e) {
      }
      const phRoleTa = document.getElementById("phFRole");
      if (phRoleTa && this.view.tab === "newContact") this.autoGrow(phRoleTa);
    },
    switchTab(tab) {
      this.view = { app: "wechat", tab, chat: "" };
      this.render();
    },
    openChat(name) {
      const ch = this.findChat(name);
      if (ch) ch.unread = 0;
      this.view = { app: "wechat", tab: "chat", chat: name };
      this.render();
      this.updateDock();
    },
    /* ---------- 各屏渲染 ---------- */
    renderScreen() {
      if (this.view.app && this.view.app !== "wechat" && window.PhoneApps) {
        try {
          return window.PhoneApps.render(this);
        } catch (e) {
          console.warn("[PhoneApps] App 视图渲染失败，回退消息页:", e);
        }
      }
      switch (this.view.tab) {
        case "chat":
          return this.renderChat();
        case "contact":
          return this.renderContact();
        case "contacts":
          return this.renderContacts();
        case "moments":
          return this.renderMoments();
        case "me":
          return this.renderMe();
        case "newContact":
          return this.renderNewContact();
        case "newGroup":
          return this.renderNewGroup();
        default:
          return this.renderChatList();
      }
    },
    /** 消息页搜索过滤（v3.19.8：按会话名/末条消息模糊匹配） */
    filteredChats(kw) {
      const p = this.state();
      const k = String(kw || "").trim().toLowerCase();
      if (!k) return p.chats;
      return p.chats.filter((ch) => ch.name.toLowerCase().includes(k) || ch.msgs.length && String(ch.msgs[ch.msgs.length - 1].text).toLowerCase().includes(k));
    },
    markAllRead() {
      var _a;
      const p = this.state();
      let n = 0;
      p.chats.forEach((ch) => {
        if (ch.unread) {
          n++;
          ch.unread = 0;
        }
      });
      this.updateDock();
      this.render();
      window.storyFramework.saveStory();
      if (n) (_a = window.showToast) == null ? void 0 : _a.call(window, `📱 已将 ${n} 个会话标记为已读`, "success");
    },
    renderChatList() {
      const p = this.state();
      const t = this.tierInfo() || this.TIERS.sms;
      const kw = this.view.kw || "";
      const chats = this.filteredChats(kw);
      const unreadTotal = p.chats.reduce((s, c) => s + (c.unread || 0), 0);
      if (!p.chats.length) {
        return `<div class="ph-empty"><b>💬</b><p>还没有消息</p><small>身边的人会随生活给你来信（每 ${this.getSettings().interval} 轮自动刷新），也可到通讯录主动找人搭话</small></div>`;
      }
      return `<div class="ph-searchbar">
                    <input id="phSearch" value="${this.esc(kw)}" placeholder="搜索会话或消息…" oninput="PhonePanel.searchChats(this.value)">
                    ${unreadTotal ? `<button class="ph-mini" onclick="PhonePanel.markAllRead()" title="全部标记已读">全部已读</button>` : ""}
                </div>
                ${chats.length ? `<div class="ph-list">${chats.map((ch) => {
        const last = ch.msgs[ch.msgs.length - 1];
        const hue = this.hueOf(ch.name);
        const ct = ch.group ? null : p.contacts.find((c) => c.name === ch.name);
        const ava = ct ? this.renderAvatar(ct) : `<span class="ph-avatar" style="--h:${hue};">群</span>`;
        return `<div class="ph-row" onclick="PhonePanel.openChat(${JSON.stringify(ch.name).replace(/"/g, "&quot;")})">
                    ${ava}
                    <div class="ph-row-main">
                        <b>${this.esc(ch.name)}${ch.group ? '<i class="ph-group-tag">群</i>' : ""}</b>
                        <span>${this.esc(last ? (last.me ? "我: " : "") + this.briefOf(last) : "")}</span>
                    </div>
                    <div class="ph-row-side"><i>${this.esc((last == null ? void 0 : last.time) || "")}</i>${ch.unread ? `<b class="ph-dot">${ch.unread}</b>` : ""}</div>
                </div>`;
      }).join("")}</div>` : '<div class="ph-empty"><b>🔍</b><p>没有匹配的会话</p><small>换个关键词试试</small></div>'}`;
    },
    /** 会话列表预览文案（红包/语音/表情/转账给专属摘要，v3.19.8；v3.22.0 补视频分享；
        v3.23.0 语音摘要带秒数——像微信一样能看出这条语音有多长） */
    briefOf(m) {
      const txt = String(m.text || "");
      if (m.kind === "redbag") return "[微信红包]";
      if (m.kind === "transfer") return `[转账] ${txt}`;
      if (m.kind === "vshare") return `[视频] ${txt}`;
      if (/^\[语音\]/.test(txt)) return m.sec ? `[语音] ${m.sec}″` : "[语音]";
      if (/^\[表情/.test(txt)) return "[表情]";
      return txt.slice(0, 24);
    },
    searchChats(kw) {
      this.view.kw = kw;
      this.render();
      const input = document.getElementById("phSearch");
      if (input) {
        input.focus();
        try {
          input.setSelectionRange(kw.length, kw.length);
        } catch (e) {
        }
      }
    },
    /** 消息时间里的 HH:MM → 当日分钟数（无时间模式返回 null） */
    msgMinutes(m) {
      const mm = String(m.time || "").match(/(\d{1,2}):(\d{2})/);
      return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null;
    },
    /** v3.23.0：时间分隔条——相邻消息间隔 ≥10 分钟（故事时间，含跨夜折算）
        或 ≥3 分钟（现实操作间隔，捕捉故事时间变量缺失的场景）时插入居中灰字 */
    needTimeSep(prev, cur) {
      const a = this.msgMinutes(prev), b = this.msgMinutes(cur);
      if (a != null && b != null) {
        let d = Math.abs(b - a);
        if (d > 720) d = 1440 - d;
        if (d >= 10) return true;
      }
      return !!(prev.at && cur.at && cur.at - prev.at >= 18e4);
    },
    renderChat() {
      const name = this.view.chat;
      const ch = this.findChat(name);
      const msgs = ch ? ch.msgs : [];
      const isWechat = this.tier() === "wechat";
      const parts = [];
      msgs.forEach((m, i) => {
        if (i === 0) {
          if (this.msgMinutes(m) != null) parts.push(`<div class="ph-time-sep">${this.esc(m.time)}</div>`);
        } else if (this.needTimeSep(msgs[i - 1], m)) parts.push(`<div class="ph-time-sep">${this.esc(m.time)}</div>`);
        parts.push(this.renderBubble(m, !!(ch == null ? void 0 : ch.group)));
      });
      return `<div class="ph-chat">
                <div class="ph-chat-head">
                    <button class="ph-back" onclick="PhonePanel.switchTab('chats')">‹</button>
                    <b>${this.esc(name)}${(ch == null ? void 0 : ch.group) ? '<i class="ph-group-tag">群</i>' : ""}</b>
                    <span class="ph-chat-ops">
                        ${msgs.length ? `<button class="ph-mini" onclick="PhonePanel.clearChat(${JSON.stringify(name).replace(/"/g, "&quot;")})" title="清空本会话聊天记录">清空</button>` : ""}
                    </span>
                </div>
                <div class="ph-chat-body" id="phChatBody">
                    ${!(ch == null ? void 0 : ch.group) && this.isPresent(name) ? '<div class="ph-present-note">📍 TA 正与你同处一室——消息发出去，抬头就能看见彼此</div>' : ""}
                    ${parts.length ? parts.join("") : '<div class="ph-empty"><b>💭</b><p>还没有聊天记录</p><small>说点什么——对方是活人，按自己的性子回</small></div>'}
                </div>
                ${this.renderEmojiPanel()}
                <div class="ph-chat-input">
                    <input id="phMsgInput" maxlength="200" placeholder="说点什么…" onkeydown="if(event.key==='Enter')PhonePanel.sendMsg()">
                    ${this.tier() !== "sms" ? `<button class="ph-money" onclick="PhonePanel.sendVoice()" title="发语音（对方会听到，大意记入正文）">🎤</button>` : ""}
                    ${isWechat ? `<button class="ph-money" onclick="PhonePanel.sendMoney()" title="发红包 / 转账（金额会回流正文记账）">🧧</button>` : ""}
                    <button onclick="PhonePanel.sendMsg()">发送</button>
                </div>
            </div>`;
    },
    /** 玩家发语音（v3.23.0）：弹窗输入「说了什么」→ 秒数按字数推；语音大意回流主笔 */
    async sendVoice() {
      var _a, _b, _c, _d;
      const name = this.view.chat;
      if (!name) return;
      const said = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _b.call(_a, {
        title: "🎤 发语音",
        message: "你说了什么？（对方会听到这段语音，大意会记入正文）"
      }));
      if (!said || !String(said).trim()) return;
      const txt = String(said).trim().slice(0, 100);
      const sec = Math.max(1, Math.min(60, Math.round(txt.length / 3)));
      const ch = this.ensureChat(name, !!((_c = this.findChat(name)) == null ? void 0 : _c.group));
      ch.msgs.push({ from: this.playerName(), me: true, text: `[语音] ${sec}″`, kind: "voice", voiceText: txt, sec, time: this.nowLabel(), at: Date.now() });
      ch.ts = Date.now();
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      const p = this.state();
      p.pending.push(`📱 玩家给${ch.group ? "群「" + name + "」" : name}发了语音（${sec}″，大意：「${txt.slice(0, 30)}」）`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      try {
        (_d = window.PhoneAlive) == null ? void 0 : _d.onPlayerSend(name, ch);
      } catch (e) {
      }
      this.refresh();
      window.storyFramework.saveStory();
      await this.npcReply(name);
    },
    /* ==================== 表情库（v3.46.1 全面扩容） ====================
       原版：微信 5 个 / QQ 4 个（硬编码内联，玩家反馈「表情包有点少」）。
       现版：微信 60 个 / QQ 36 个，按时代与场景分四组，支持常用记忆。
       全部 Unicode 字符——零图片资源、零网络请求、零 token 开销。 */
    EMOJI_LIB: {
      wechat: [
        { g: "常用", e: "😂" }, { g: "常用", e: "🙏" }, { g: "常用", e: "👍" },
        { g: "常用", e: "🤝" }, { g: "常用", e: "😭" }, { g: "常用", e: "❤️" },
        { g: "常用", e: "🙈" }, { g: "常用", e: "👌" }, { g: "常用", e: "🫡" },
        { g: "情绪", e: "🥰" }, { g: "情绪", e: "😅" }, { g: "情绪", e: "🤣" },
        { g: "情绪", e: "😊" }, { g: "情绪", e: "😏" }, { g: "情绪", e: "😴" },
        { g: "情绪", e: "🤔" }, { g: "情绪", e: "😳" }, { g: "情绪", e: "😱" },
        { g: "情绪", e: "🤯" }, { g: "情绪", e: "🥺" }, { g: "情绪", e: "😤" },
        { g: "情绪", e: "😇" }, { g: "情绪", e: "🙄" }, { g: "情绪", e: "😷" },
        { g: "情绪", e: "🥳" }, { g: "情绪", e: "🫠" }, { g: "情绪", e: "😮‍💨" },
        { g: "情绪", e: "💀" }, { g: "情绪", e: "🤡" }, { g: "情绪", e: "👻" },
        { g: "动作", e: "👏" }, { g: "动作", e: "💪" }, { g: "动作", e: "🤦" },
        { g: "动作", e: "✌️" }, { g: "动作", e: "🤞" }, { g: "动作", e: "🫰" },
        { g: "动作", e: "👋" }, { g: "动作", e: "🫂" }, { g: "动作", e: "🤝" },
        { g: "动作", e: "🏃" }, { g: "动作", e: "🙇" }, { g: "动作", e: "💃" },
        { g: "生活", e: "🔥" }, { g: "生活", e: "✨" }, { g: "生活", e: "🎉" },
        { g: "生活", e: "🌹" }, { g: "生活", e: "🍻" }, { g: "生活", e: "☕" },
        { g: "生活", e: "🍜" }, { g: "生活", e: "🎂" }, { g: "生活", e: "🧧" },
        { g: "生活", e: "💰" }, { g: "生活", e: "🎁" }, { g: "生活", e: "⚡" },
        { g: "生活", e: "🌙" }, { g: "生活", e: "🌈" }, { g: "生活", e: "🐶" },
        { g: "生活", e: "🐱" }, { g: "生活", e: "🍺" }, { g: "生活", e: "🌻" }
      ],
      qq: [
        { g: "常用", e: "^_^" }, { g: "常用", e: "O(∩_∩)O" }, { g: "常用", e: "~~" },
        { g: "常用", e: "寒" }, { g: "常用", e: "憨笑" }, { g: "常用", e: "偷笑" },
        { g: "情绪", e: "大哭" }, { g: "情绪", e: "发怒" }, { g: "情绪", e: "得意" },
        { g: "情绪", e: "白眼" }, { g: "情绪", e: "困" }, { g: "情绪", e: "流汗" },
        { g: "情绪", e: "晕" }, { g: "情绪", e: "衰" }, { g: "情绪", e: "害羞" },
        { g: "情绪", e: "调皮" }, { g: "情绪", e: "闭嘴" }, { g: "情绪", e: "睡" },
        { g: "动作", e: "再见" }, { g: "动作", e: "鼓掌" }, { g: "动作", e: "握手" },
        { g: "动作", e: "拥抱" }, { g: "动作", e: "强" }, { g: "动作", e: "弱" },
        { g: "动作", e: "顶" }, { g: "动作", e: "踩" }, { g: "动作", e: "OK" },
        { g: "生活", e: "玫瑰" }, { g: "生活", e: "爱心" }, { g: "生活", e: "炸弹" },
        { g: "生活", e: "菜刀" }, { g: "生活", e: "骷髅" }, { g: "生活", e: "猪头" },
        { g: "生活", e: "月亮" }, { g: "生活", e: "太阳" }, { g: "生活", e: "咖啡" },
        { g: "生活", e: "蛋糕" }, { g: "生活", e: "礼物" }, { g: "生活", e: "饭碗" }
      ]
    },
    EMOJI_GROUPS: [
      { key: "常用", icon: "⭐" },
      { key: "情绪", icon: "😊" },
      { key: "动作", icon: "🙌" },
      { key: "生活", icon: "🌈" }
    ],
    /** 当前展开的表情分组（null = 收起） */
    _emojiGroup: null,
    /** 常用记忆（最近使用，跨会话持久化，最多 8 个） */
    _emojiRecent() {
      try {
        var g = this.tier() === "qq" ? "qq" : "wechat";
        var raw = MoStore.getItem("yunjingEmojiRecent_" + g);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },
    _pushEmojiRecent(e) {
      try {
        var g = this.tier() === "qq" ? "qq" : "wechat";
        var list = this._emojiRecent().filter(function (x) { return x !== e; });
        list.unshift(e);
        MoStore.setItem("yunjingEmojiRecent_" + g, JSON.stringify(list.slice(0, 8)));
      } catch (e2) { }
    },
    /** 当前时代的表情列表 */
    emojiList() {
      var t = this.tier();
      var lib = t === "wechat" ? this.EMOJI_LIB.wechat : t === "qq" ? this.EMOJI_LIB.qq : [];
      return lib;
    },
    /** 切换表情分组 / 再次点击收起 */
    toggleEmojiGroup(k) {
      this._emojiGroup = this._emojiGroup === k ? null : k;
      this.render();
      var body = document.getElementById("phChatBody");
      if (body) body.scrollTop = body.scrollHeight;
    },
    /** 渲染表情面板（分组页签 + 网格 + 最近使用） */
    renderEmojiPanel() {
      var list = this.emojiList();
      if (!list.length) return "";
      var self = this;
      var recent = this._emojiRecent();
      var tabs = this.EMOJI_GROUPS.map(function (g) {
        var on = self._emojiGroup === g.key ? " on" : "";
        return '<button class="ph-emoji-tab' + on + '" onclick="PhonePanel.toggleEmojiGroup(&quot;' + g.key + '&quot;)">' + g.icon + " " + g.key + "</button>";
      }).join("");
      // 最近使用组（有记录才显示）
      if (recent.length) {
        tabs += '<button class="ph-emoji-tab' + (this._emojiGroup === "__recent" ? " on" : "") +
                '" onclick="PhonePanel.toggleEmojiGroup(&quot;__recent&quot;)">🕘 最近</button>';
      }
      var grid = "";
      if (this._emojiGroup) {
        var items = this._emojiGroup === "__recent"
          ? recent
          : list.filter(function (x) { return x.g === self._emojiGroup; }).map(function (x) { return x.e; });
        grid = '<div class="ph-emoji-grid">' + items.map(function (e) {
          var short = String(e).length > 2 ? "ph-emoji-text" : "";
          var safe = String(e).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return '<button class="' + short + '" onclick="PhonePanel.insertEmoji(&quot;' + safe + '&quot;)" title="' + safe + '">' + safe + "</button>";
        }).join("") + "</div>";
      } else {
        // 未展开时给一行提示，引导点击
        grid = '<div class="ph-emoji-hint">点上方分类展开表情 · 共 ' + list.length + ' 个</div>';
      }
      return '<div class="ph-emoji-panel"><div class="ph-emoji-tabs">' + tabs + "</div>" + grid + "</div>";
    },
    /** 表情快捷插入（v3.19.8；v3.46.1 增加最近使用记忆） */
    insertEmoji(e) {
      const input = document.getElementById("phMsgInput");
      if (!input) return;
      input.value = (input.value + e).slice(0, 200);
      input.focus();
      this._pushEmojiRecent(e);
      // 若「最近」组已展开，实时刷新列表
      if (this._emojiGroup === "__recent") this.render();
    },
    /** 清空单个会话的聊天记录（v3.19.8；v3.23.0 二次确认——手滑不毁回忆） */
    async clearChat(name) {
      var _a, _b, _c;
      const ch = this.findChat(name);
      if (!ch) return;
      const okc = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.confirm) == null ? void 0 : _b.call(_a, {
        title: "清空聊天记录",
        message: `确定清空与「${name}」的全部聊天记录？此操作不可恢复。`,
        okText: "清空",
        cancelText: "再想想",
        danger: true
      }));
      if (!okc) return;
      ch.msgs = [];
      ch.unread = 0;
      this.render();
      window.storyFramework.saveStory();
      (_c = window.showToast) == null ? void 0 : _c.call(window, "📱 会话已清空", "success");
    },
    renderBubble(m, isGroup) {
      var _a, _b;
      if (m.kind === "recall") {
        return `<div class="ph-bub kind-recall"><div class="ph-bub-box"><p>${this.esc(m.from)}撤回了一条消息</p></div></div>`;
      }
      if (m.kind === "sys") {
        return `<div class="ph-bub kind-recall"><div class="ph-bub-box"><p>${this.esc(m.text)}</p></div></div>`;
      }
      const p = this.state();
      const who = m.me ? { name: this.playerName(), g: (_a = p.profile) == null ? void 0 : _a.g, av: (_b = p.profile) == null ? void 0 : _b.av } : p.contacts.find((c) => c.name === m.from) || { name: m.from };
      const ava = this.renderAvatar(who, "sm");
      const body = this.bubbleBody(m);
      return `<div class="ph-bub ${m.me ? "me" : ""}${m.kind ? " kind-" + m.kind : ""}">
                ${!m.me ? ava : ""}
                <div class="ph-bub-box">
                    ${!m.me && isGroup ? `<i class="ph-bub-name">${this.esc(m.from)}</i>` : ""}
                    ${body}
                </div>
                ${m.me ? ava : ""}
            </div>`;
    },
    /** 气泡内容富化（v3.19.8）：红包 / 转账 / 语音 / 表情 → 专属样式，其余走纯文本
        v3.23.0：红包/转账可领取（状态机闭环）、语音可播放转文字、视频卡可点开 */
    bubbleBody(m) {
      const txt = String(m.text || "");
      if (m.kind === "redbag" || m.kind === "transfer") {
        const st = m.status || "pending";
        const clickable = !m.me && st === "pending";
        const args = `${JSON.stringify(String(this.view.chat || "")).replace(/"/g, "&quot;")}, ${JSON.stringify(txt).replace(/"/g, "&quot;")}, ${JSON.stringify(m.kind)}`;
        const sub = m.note || (m.kind === "redbag" ? "恭喜发财，大吉大利" : "微信转账");
        return `<div class="ph-msg-${m.kind}${clickable ? " clickable" : ""}${st !== "pending" ? " done" : ""}"${clickable ? ` onclick="PhonePanel.claimMoney(${args})"` : ""}>
                    <i>${m.kind === "redbag" ? "🧧" : "💰"}</i>
                    <b>${this.esc(txt || (m.kind === "redbag" ? "微信红包" : "微信转账"))}</b>
                    <em class="ph-money-note">${this.esc(sub)}</em>
                    <span>${this.moneyStateText(m)}</span>
                </div>`;
      }
      if (m.kind === "vshare") {
        return `<div class="ph-msg-vshare clickable" onclick="PhonePanel.openSharedVideo(${JSON.stringify(txt || "").replace(/"/g, "&quot;")})"><i>🎬</i><b>${this.esc(txt || "一条短视频")}</b><span>点开一起看</span></div>`;
      }
      const isVoice = m.kind === "voice" || /^\[语音\]/.test(txt);
      if (isVoice) {
        const sec = m.sec || (txt.match(/(\d+)/) || [])[1];
        const key = `${m.time || ""}|${txt}`;
        const open = this._voiceOpen && this._voiceOpen[key];
        return `<div class="ph-msg-voice" onclick="PhonePanel.playVoice(this, ${Number(sec) || 3})" title="点击播放${m.voiceText ? " · 下方可转文字" : ""}">
                    <i>▶</i><span>${sec ? sec + "″" : "语音"}</span><i class="ph-voice-wave">◀◁◁</i>
                </div>${m.voiceText ? `<button class="ph-voice-tt" onclick="PhonePanel.toggleVoice(${JSON.stringify(key).replace(/"/g, "&quot;")})">${open ? "▲ 收起" : "▽ 转文字"}</button>${open ? `<div class="ph-voice-text">${this.esc(m.voiceText)}</div>` : ""}` : ""}`;
      }
      const face = txt.match(/^\[表情[:：]?\s*([^\]）)]*)\]$/);
      if (face) {
        return `<div class="ph-msg-face">${this.esc(face[1] || "😄")}</div>`;
      }
      return `<p>${this.esc(txt)}</p>`;
    },
    /** 语音播放动画（v3.23.0）：波形点亮 sec 秒——纯本地视觉，不引入真实音频 */
    playVoice(el, sec) {
      if (!el || !el.classList) return;
      el.classList.remove("playing");
      void el.offsetWidth;
      el.classList.add("playing");
      const ms = Math.min(8e3, Math.max(800, (Number(sec) || 3) * 1e3));
      setTimeout(() => el.classList.remove("playing"), ms);
    },
    /** 展开/收起语音文字稿（v3.23.0：微信式「转文字」） */
    toggleVoice(key) {
      this._voiceOpen = this._voiceOpen || {};
      if (this._voiceOpen[key]) delete this._voiceOpen[key];
      else this._voiceOpen[key] = true;
      this.render();
    },
    /** 点开聊天里的视频分享卡（v3.23.0）：跳转短视频 App 沉浸播放；引擎缺席/视频不在时降级 toast */
    openSharedVideo(title) {
      var _a, _b;
      const apps = window.PhoneApps;
      if (!apps || typeof apps.videoList !== "function" || typeof apps.videoOpen !== "function") {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "🎬 视频已过期（短视频 App 不在线）", "info");
        return;
      }
      const list = apps.videoList(this);
      const i = list.findIndex((v) => String(v.title || "") === String(title));
      if (i < 0) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "🎬 这条视频已过期或被删除", "info");
        return;
      }
      this.view = { app: "video", tab: "", chat: "" };
      apps.videoOpen(i);
    },
    renderContacts() {
      const p = this.state();
      const canGroup = this.tier() === "wechat" || this.tier() === "qq";
      if (!p.contacts.length) {
        return `<div class="ph-empty"><b>👥</b><p>通讯录还是空的</p><small>身边的人登场后会自动入册；也可以自己存一位——TA 会真实存在</small>
                    <button class="ph-mini big" onclick="PhonePanel.openNewContact()">➕ 新建联系人</button></div>`;
      }
      return `<div class="ph-contacts-bar">
                    <button class="ph-mini" onclick="PhonePanel.openNewContact()" title="自定义姓名/身份/头像——存下即真实存在">➕ 新建联系人</button>
                    ${canGroup ? `<button class="ph-mini" onclick="PhonePanel.openNewGroup()">👥 发起群聊</button>` : ""}
                </div>
                <div class="ph-list">${p.contacts.map((c) => `
                <div class="ph-row" onclick="PhonePanel.openChat(${JSON.stringify(c.name).replace(/"/g, "&quot;")})">
                    ${this.renderAvatar(c)}
                    <div class="ph-row-main"><b>${this.esc(c.name)}${c.custom ? '<i class="ph-custom-tag">自建</i>' : ""}${this.isPresent(c.name) ? '<i class="ph-present-tag">📍在场</i>' : ""}</b><span>${this.esc(c.role)}</span></div>
                    <div class="ph-row-side">
                        <button class="ph-mini" onclick="event.stopPropagation();PhonePanel.viewContact(${JSON.stringify(c.name).replace(/"/g, "&quot;")})" title="联系人详情">ⓘ</button>
                        <i class="ph-go">›</i>
                    </div>
                </div>`).join("")}</div>`;
    },
    /** 联系人详情卡（v3.19.8；v3.27.6 增角色档案全字段 + 自定义格子） */
    renderContact() {
      const name = this.view.chat;
      const p = this.state();
      const c = p.contacts.find((x) => x.name === name);
      const ch = this.findChat(name);
      const isWechat = this.tier() === "wechat";
      if (!c) {
        return `<div class="ph-chat">
                    <div class="ph-chat-head"><button class="ph-back" onclick="PhonePanel.switchTab('contacts')">‹</button><b>联系人</b><span></span></div>
                    <div class="ph-empty"><b>👥</b><p>这位联系人已离场</p><small>身边的人退场后不再出现在通讯录</small></div>
                </div>`;
      }
      const d = (((window.storyFramework.storyState || {}).variables || {}).characters || {})[c.name] || {};
      const clip = (s, len) => this.esc(String(s || "").slice(0, len));
      const lk = (k) => Array.isArray(d.locked) && d.locked.includes(k) ? '<i class="ph-lk" title="玩家锁定 · AI 不可覆盖">🔒</i>' : "";
      const rows = [
        this.isPresent(name) && `<div class="ph-profile-row"><span>在场</span><b>📍 正与你同处一室</b></div>`,
        d.age && `<div class="ph-profile-row"><span>年龄</span><b>${this.esc(d.age)}${lk("age")}</b></div>`,
        d.appearance && `<div class="ph-profile-row"><span>外貌</span><b>${clip(d.appearance, 60)}${lk("appearance")}</b></div>`,
        d.personality && `<div class="ph-profile-row"><span>性格</span><b>${clip(d.personality, 60)}${lk("personality")}</b></div>`,
        d.speechPattern && `<div class="ph-profile-row"><span>言谈</span><b>${clip(d.speechPattern, 48)}${lk("speechPattern")}</b></div>`,
        d.role && d.role !== c.role && `<div class="ph-profile-row"><span>身份</span><b>${clip(d.role, 40)}${lk("role")}</b></div>`,
        d.motivation && `<div class="ph-profile-row"><span>念头</span><b>${clip(d.motivation, 60)}${lk("motivation")}</b></div>`,
        d.location && `<div class="ph-profile-row"><span>位置</span><b>${clip(d.location, 30)}${lk("location")}</b></div>`,
        typeof d.trust === "number" && `<div class="ph-profile-row"><span>信任</span><b>${d.trust}/100${lk("trust")}</b></div>`,
        d.status && `<div class="ph-profile-row"><span>近况</span><b>${clip(d.status, 60)}${lk("status")}</b></div>`,
        d.relationship && `<div class="ph-profile-row"><span>关系</span><b>${clip(d.relationship, 40)}${lk("relationship")}</b></div>`,
        d.secret && `<div class="ph-profile-row"><span>秘密</span><b>${clip(d.secret, 60)}${lk("secret")}</b></div>`,
        Array.isArray(d.history) && d.history.length ? `<div class="ph-profile-row"><span>轨迹</span><b>${clip(d.history.slice(-1)[0], 50)}（${d.history.length}条）</b></div>` : ""
      ].filter(Boolean).join("");
      const cf = d.customFields && typeof d.customFields === "object" && !Array.isArray(d.customFields) ? d.customFields : {};
      const cfRows = Object.entries(cf).map(([k, val]) => `<div class="ph-profile-row ph-profile-cf"><span>${this.esc(k)}</span><b>${clip(val, 60)}</b></div>`).join("");
      const nameArg = JSON.stringify(c.name).replace(/"/g, "&quot;");
      const fieldCount = Object.keys(d).filter((k) => !["history", "customFields", "locked", "cfLocked", "isFaraway", "forceZone"].includes(k)).length;
      return `<div class="ph-chat">
                <div class="ph-chat-head"><button class="ph-back" onclick="PhonePanel.switchTab('contacts')">‹</button><b>联系人详情</b><span></span></div>
                <div class="ph-contact-card">
                    <span class="ph-ava-btn" onclick="PhonePanel.cycleAvatarOf(${nameArg})" title="点我换头像（男/女各 16 张循环）">${this.renderAvatar(c, "lg")}</span>
                    <b>${this.esc(c.name)}${c.custom ? '<i class="ph-custom-tag">自建</i>' : ""}</b>
                    <span class="ph-contact-role">${this.esc(c.role)}</span>
                    <p class="ph-contact-meta">${ch && ch.msgs.length ? `会话 ${ch.msgs.length} 条 · 最近「${this.esc(String(ch.msgs[ch.msgs.length - 1].text).slice(0, 16))}」` : "还没有聊过天"}</p>
                    <p class="ph-contact-meta dim">点头像可换（男/女各 16 张）</p>
                    ${rows || cfRows ? `<details class="ph-profile" open><summary>📋 角色档案（${fieldCount} 项）</summary>
                        <div class="ph-profile-body">${rows}${cfRows ? `<div class="ph-profile-sec">🧩 玩家亲笔设定</div>${cfRows}` : ""}</div>
                        <button class="ph-cf-add" onclick="PhonePanel.addContactField(${nameArg})">＋ 加一格（如口头禅/弱点）</button>
                    </details>` : `<div class="ph-profile-empty">📋 档案待登记——正文里多写写 TA，档案会自动长出来<button class="ph-cf-add" onclick="PhonePanel.addContactField(${nameArg})">＋ 加一格</button></div>`}
                    <div class="ph-contact-btns">
                        <button onclick="PhonePanel.editContactProfile(${nameArg})">✎ 编辑档案</button>
                        <button onclick="PhonePanel.openChat(${nameArg})">💬 发消息</button>
                        ${isWechat ? `<button onclick="PhonePanel.sendMoney(${nameArg})">🧧 红包/转账</button>` : ""}
                        <button class="ph-star-btn ${c.star ? "on" : ""}" onclick="PhonePanel.toggleStarContact(${nameArg})" title="星标的人主动找你的频率近乎翻倍，深夜也敢来找你">${c.star ? "⭐ 特别关心中" : "☆ 特别关心"}</button>
                    </div>
                    <button class="ph-del" onclick="PhonePanel.removeContact(${nameArg})">${c.custom ? "🗑 删除联系人" : "🗑 删除并拉黑（不再自动入册）"}</button>
                </div>
            </div>`;
    },
    /** v3.27.6：从联系人详情卡加自定义格子（写入角色档案 customFields，复用状态面板同一套） */
    async addContactField(name) {
      const ok = await window.StoryStatusRenderer.addCustomField(name);
      if (ok !== false) this.render();
    },
    /** v3.27.7：联系人详情卡 → 全字段档案编辑器（与状态面板共用，含🔒锁） */
    async editContactProfile(name) {
      const ok = await window.StoryStatusRenderer.editCharacter(name);
      if (ok) this.render();
    },
    /** 详情卡换头像入口（按名字找档案，避免闭包引用失效） */
    cycleAvatarOf(name) {
      const c = this.state().contacts.find((x) => x.name === name);
      this.cycleAvatar(c);
    },
    /** 删除联系人：自建的直接删；自动同步的删后拉黑（不再自动入册） */
    removeContact(name) {
      var _a;
      const p = this.state();
      const c = p.contacts.find((x) => x.name === name);
      if (!c) return;
      p.contacts = p.contacts.filter((x) => x.name !== name);
      if (!c.custom) {
        if (!Array.isArray(p.blocked)) p.blocked = [];
        if (!p.blocked.includes(name)) p.blocked.push(name);
      }
      p.chats = p.chats.filter((x) => x.name !== name);
      p.moments = p.moments.filter((m) => m.author !== name);
      this.view = { app: "wechat", tab: "contacts", chat: "" };
      this.refresh();
      window.storyFramework.saveStory();
      (_a = window.showToast) == null ? void 0 : _a.call(window, c.custom ? `📱 已删除「${name}」` : `📱 已删除「${name}」并拉黑——TA 不会再自动进你的通讯录`, "success");
    },
    viewContact(name) {
      this.view = { app: "wechat", tab: "contact", chat: name };
      this.render();
    },
    /** v3.20.0：特别关心——星标联系人的主动频率近乎翻倍，深夜也敢来找你，温度不跌破 60 */
    toggleStarContact(name) {
      var _a;
      const c = this.state().contacts.find((x) => x.name === name);
      if (!c) return;
      c.star = !c.star;
      this.render();
      window.storyFramework.saveStory();
      (_a = window.showToast) == null ? void 0 : _a.call(window, c.star ? `⭐ 「${name}」已设为特别关心——TA 想你的时候会毫不犹豫来找你` : `已取消「${name}」的特别关心`, "success");
    },
    /* ==================== 新建联系人（v3.19.9：此人自此真实存在） ==================== */
    /** 表单态（内存）：name/role/g/av */
    openNewContact() {
      this.view = { app: "wechat", tab: "newContact", chat: "", form: { name: "", role: "", g: 0, av: this.hueOf("新人" + Date.now()) % 16 } };
      this.render();
    },
    setForm(key, val) {
      if (!this.view.form) return;
      this.view.form[key] = val;
      if (key === "g") this.render();
    },
    pickAvatar(i) {
      if (!this.view.form) return;
      this.view.form.av = i;
      this.render();
    },
    renderNewContact() {
      const f = this.view.form || { name: "", role: "", g: 0, av: 0 };
      const img = f.g === 1 ? this.AVA.f : this.AVA.m;
      const cells = this.avaOk === false ? `<p class="ph-form-tip">🖼 头像图缺失，已自动用首字头像——不影响使用。</p>` : Array.from({ length: 16 }, (_, i) => {
        const pos = `${i % 4 * 100 / 3}% ${Math.floor(i / 4) * 100 / 3}%`;
        return `<button class="ph-ava-pick ${f.av === i ? "on" : ""}" style="background-image:url('${img}');background-position:${pos};" onclick="PhonePanel.pickAvatar(${i})" title="选这个头像"></button>`;
      }).join("");
      const roleLen = (f.role || "").length, nameLen = (f.name || "").length;
      return `<div class="ph-chat">
                <div class="ph-chat-head">
                    <button class="ph-back" onclick="PhonePanel.switchTab('contacts')">‹</button>
                    <b>新建联系人</b><span></span>
                </div>
                <div class="ph-form">
                    <label>姓名<i>必填</i><span class="ph-count" id="phFNameCount">${nameLen}/12</span></label>
                    <input id="phFName" maxlength="12" placeholder="TA叫什么名字？" value="${this.esc(f.name)}" oninput="PhonePanel.setForm('name', this.value); PhonePanel.syncCount('phFNameCount', this.value.length, 12)">
                    <label>身份 / 与你的关系<i>必填</i><span class="ph-count ${roleLen >= 120 ? "full" : roleLen >= 96 ? "warn" : ""}" id="phFRoleCount">${roleLen}/120</span></label>
                    <textarea id="phFRole" maxlength="120" rows="3" placeholder="如：高中同桌，现在在杭州做运营，性格大大咧咧，最爱拉着你聊八卦——写得越细，TA 越像活人" oninput="PhonePanel.setForm('role', this.value); PhonePanel.syncCount('phFRoleCount', this.value.length, 120); PhonePanel.autoGrow(this)">${this.esc(f.role)}</textarea>
                    <label>性别</label>
                    <div class="ph-sex-row">
                        <button class="${f.g === 0 ? "on" : ""}" onclick="PhonePanel.setForm('g', 0)">男</button>
                        <button class="${f.g === 1 ? "on" : ""}" onclick="PhonePanel.setForm('g', 1)">女</button>
                    </div>
                    <label>选头像</label>
                    <div class="ph-ava-grid">${cells}</div>
                    <button class="ph-form-save" onclick="PhonePanel.saveCustomContact()">✓ 存为联系人</button>
                    <p class="ph-form-tip">存下后，TA 就真实存在于这个世界：有自己的住处、生计与脾气，与你是认识的关系——正文里可自然登场，手机里可随时聊天。</p>
                </div>
            </div>`;
    },
    /** v3.20.1：字数计数器——实时显示「n/上限」，快写满变橙、写满变红——再也不会「看不懂字在哪里」 */
    syncCount(id, len, max) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = len + "/" + max;
      el.classList.toggle("warn", len >= Math.ceil(max * 0.8) && len < max);
      el.classList.toggle("full", len >= max);
    },
    /** v3.20.1：文本域自动增高（随内容长高，封顶 6 行左右）——换行回车也装得下 */
    autoGrow(el) {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 170) + "px";
    },
    /** 保存自定义联系人：写入通讯录 + 角色档案（真实存在）+ 回流主笔 */
    saveCustomContact() {
      var _a, _b, _c, _d, _e;
      const fw = window.storyFramework;
      const f = this.view.form || {};
      const name = String(f.name || "").trim();
      const role = String(f.role || "").trim();
      if (!name || !role) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 姓名和身份都要填——TA 得先是谁，才能存在。", "error");
        return;
      }
      const p = this.state();
      if (p.contacts.find((c2) => c2.name === name)) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📱 通讯录里已经有这个名字了。", "error");
        return;
      }
      if (p.contacts.length >= 40) {
        (_c = window.showToast) == null ? void 0 : _c.call(window, "📱 通讯录已满（40 人）——先删几位不联系的。", "info");
        return;
      }
      const c = { name, role, custom: true, g: f.g === 1 ? 1 : 0, av: Number(f.av) || 0, hue: this.hueOf(name) };
      p.contacts.push(c);
      try {
        const v = fw.storyState.variables;
        if (!v.characters) v.characters = {};
        if (!v.characters[name]) v.characters[name] = { role: `${role}（玩家亲笔设定）`, favor: 50 };
        (_d = fw.updateStatusPanel) == null ? void 0 : _d.call(fw);
      } catch (e) {
        console.warn("[手机分身] 角色档案写入失败:", e);
      }
      p.pending.push(`📱 玩家在手机里存了新联系人「${name}」（${role}）——此人自此真实存在于这个世界：有自己的住处/生计/脾性与社交圈，与玩家是认识的关系，后续正文可自然登场与互动`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      fw.saveStory();
      (_e = window.showToast) == null ? void 0 : _e.call(window, `📱 「${name}」已存在——点开就能给 TA 发消息`, "success");
      this.openChat(name);
    },
    /** 发起群聊（v3.19.9 勾选式：头像复选列表 + 群名输入，取代手输名字） */
    openNewGroup() {
      var _a, _b;
      const tier = this.tier();
      if (tier !== "wechat" && tier !== "qq") {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 这个年代还没有群聊——想同时找几个人，得一个一个联系。", "info");
        return;
      }
      const p = this.state();
      if (p.contacts.length < 2) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📱 通讯录里至少要有 2 位联系人才能建群——可以先新建一位。", "info");
        return;
      }
      this.view = { app: "wechat", tab: "newGroup", chat: "", form: { picks: [], name: "" } };
      this.render();
    },
    togglePick(name) {
      const f = this.view.form;
      if (!f) return;
      const i = f.picks.indexOf(name);
      if (i >= 0) f.picks.splice(i, 1);
      else if (f.picks.length < 20) f.picks.push(name);
      this.render();
      const box = document.getElementById("phGName");
      if (box) box.focus();
    },
    setGroupName(v) {
      if (this.view.form) this.view.form.name = v;
    },
    renderNewGroup() {
      const f = this.view.form || { picks: [], name: "" };
      const p = this.state();
      const rows = p.contacts.map((c) => {
        const on = f.picks.includes(c.name);
        return `<div class="ph-row pick ${on ? "on" : ""}" onclick="PhonePanel.togglePick(${JSON.stringify(c.name).replace(/"/g, "&quot;")})">
                    ${this.renderAvatar(c)}
                    <div class="ph-row-main"><b>${this.esc(c.name)}${c.custom ? '<i class="ph-custom-tag">自建</i>' : ""}</b><span>${this.esc(c.role)}</span></div>
                    <span class="ph-check">${on ? "✓" : ""}</span>
                </div>`;
      }).join("");
      const auto = `${this.playerName()}、${f.picks[0] || ""}等${f.picks.length + 1}人的群`;
      return `<div class="ph-chat">
                <div class="ph-chat-head">
                    <button class="ph-back" onclick="PhonePanel.switchTab('contacts')">‹</button>
                    <b>发起群聊</b>
                    <span class="ph-chat-ops"><b class="ph-pick-count">${f.picks.length} 人</b></span>
                </div>
                <div class="ph-form">
                    <label>群名<i>留空自动生成</i></label>
                    <input id="phGName" maxlength="16" placeholder="${this.esc(auto)}" value="${this.esc(f.name)}" oninput="PhonePanel.setGroupName(this.value)">
                    <label>选择群成员（${f.picks.length}/20）</label>
                    <div class="ph-list picklist">${rows}</div>
                    <button class="ph-form-save" onclick="PhonePanel.saveGroup()">➕ 建群（至少 2 人）</button>
                </div>
            </div>`;
    },
    saveGroup() {
      var _a, _b, _c;
      const f = this.view.form || { picks: [], name: "" };
      const members = (f.picks || []).slice(0, 20);
      if (members.length < 2) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 至少勾选 2 位联系人。", "error");
        return;
      }
      const gname = String(f.name || "").trim() || `${this.playerName()}、${members[0]}等${members.length + 1}人的群`;
      if (this.findChat(gname)) {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📱 已有同名群聊。", "info");
        return;
      }
      const p = this.state();
      const ch = this.ensureChat(gname, true);
      ch.ts = Date.now();
      ch.msgs.push({ from: this.playerName(), me: true, text: `我把 ${members.join("、")} 拉进了群`, time: this.nowLabel() });
      p.pending.push(`📱 玩家建了群聊「${gname}」（成员：${members.join("、")}）`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      p.chats.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      this.refresh();
      window.storyFramework.saveStory();
      (_c = window.showToast) == null ? void 0 : _c.call(window, `📱 群聊「${gname}」已建立——大家会各聊各的`, "success");
      this.openChat(gname);
    },
    /** 发红包 / 转账（v3.19.8：微信时代专属；金额回流主笔记账——因果守恒） */
    async sendMoney(toName) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (this.tier() !== "wechat") {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 红包与转账是微信时代的事——这个年代的钱要走现金或银行。", "info");
        return;
      }
      const name = toName || this.view.chat;
      if (!name) return;
      const pick = await ((_c = (_b = window.UIDialog) == null ? void 0 : _b.confirm) == null ? void 0 : _c.call(_b, {
        title: "🧧 红包 / 转账",
        message: "发哪种？红包适合心意与节日，转账适合还钱与分账。",
        okText: "🧧 红包",
        cancelText: "💰 转账"
      }));
      const isRed = pick !== false;
      const amtRaw = await ((_e = (_d = window.UIDialog) == null ? void 0 : _d.prompt) == null ? void 0 : _e.call(_d, {
        title: isRed ? "发红包" : "转账",
        message: isRed ? "红包金额（元）：" : "转账金额（元）："
      }));
      const amt = parseFloat(String(amtRaw || "").replace(/[^\d.]/g, ""));
      if (!amt || amt <= 0 || amt > 1e5) {
        (_f = window.showToast) == null ? void 0 : _f.call(window, "📱 金额无效（0.01 - 100000 元）。", "error");
        return;
      }
      const ch = this.ensureChat(name, !!((_g = this.findChat(name)) == null ? void 0 : _g.group));
      const label = `¥${amt.toFixed(2)}`;
      ch.msgs.push({
        from: this.playerName(),
        me: true,
        text: label,
        kind: isRed ? "redbag" : "transfer",
        time: this.nowLabel()
      });
      ch.ts = Date.now();
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      const p = this.state();
      p.pending.push(`📱 玩家${ch.group ? "在群「" + name + "」里" : "给" + name}发了${isRed ? "红包" : "转账"} ${label}——正文须如实记入玩家的现金/存款变动`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      this.refresh();
      window.storyFramework.saveStory();
      (_h = window.showToast) == null ? void 0 : _h.call(window, `📱 ${isRed ? "红包" : "转账"} ${label} 已发出——这笔钱会在正文里记上`, "success");
      this.npcReply(name);
    },
    renderMoments() {
      const p = this.state();
      const t = this.tierInfo();
      return `<div class="ph-moments">
                <div class="ph-moment-post">
                    <textarea id="phMomentText" maxlength="200" placeholder="这一刻的想法…（想到什么说什么，联系人们会看到）"></textarea>
                    <button onclick="PhonePanel.postMomentBtn()">发表</button>
                </div>
                ${p.moments.length ? p.moments.map((m) => this.renderMoment(m)).join("") : '<div class="ph-empty"><b>🌙</b><p>还没有动态</p><small>大家的日子都在过，只是还没发出来——刷新看看</small></div>'}
            </div>`;
    },
    renderMoment(m) {
      const liked = (m.likes || []).includes(this.playerName());
      if (m.news) {
        return `<div class="ph-moment ph-moment-news">
                    <div class="ph-moment-hd">
                        <span class="ph-avatar sm news" style="--h:28;">📰</span>
                        <div><b class="news">${this.esc(m.author)}<i class="ph-news-tag">推送</i></b><i>${this.esc(m.time)}</i></div>
                    </div>
                    <p class="ph-moment-text">${this.esc(m.text)}</p>
                </div>`;
      }
      return `<div class="ph-moment" data-id="${m.id}">
                <div class="ph-moment-hd">
                    ${this.renderMomentAvatar(m)}
                    <div><b class="${m.mine ? "mine" : ""}">${this.esc(m.author)}${m.mine ? "（我）" : ""}</b><i>${this.esc(m.time)}</i></div>
                </div>
                <p class="ph-moment-text">${this.esc(m.text)}</p>
                <div class="ph-moment-acts">
                    <button class="${liked ? "on" : ""}" onclick="PhonePanel.actMoment('${m.id}','like')">${liked ? "❤" : "♡"} ${(m.likes || []).length || ""}</button>
                    <button onclick="PhonePanel.commentMoment('${m.id}')">💬 ${(m.comments || []).length || ""}</button>
                    ${(m.likes || []).length ? `<span class="ph-likers">${this.esc(m.likes.slice(0, 5).join("、"))}${m.likes.length > 5 ? " 等" : ""}</span>` : ""}
                </div>
                ${(m.comments || []).length ? `<div class="ph-comments">${m.comments.map((c) => `<div class="ph-comment"><b>${this.esc(c.by)}：</b>${this.esc(c.text)}</div>`).join("")}</div>` : ""}
            </div>`;
    },
    /** 朋友圈头像（v3.19.9）：联系人图片头像；玩家用自己档案；公众号保留 📰 */
    renderMomentAvatar(m) {
      var _a, _b;
      if (m.news) return `<span class="ph-avatar sm news">📰</span>`;
      const p = this.state();
      const who = m.mine ? { name: this.playerName(), g: (_a = p.profile) == null ? void 0 : _a.g, av: (_b = p.profile) == null ? void 0 : _b.av } : p.contacts.find((c) => c.name === m.author) || { name: m.author };
      return this.renderAvatar(who, "sm");
    },
    /** 玩家档案头像（我页）：点击循环切换（存 profile.g/av） */
    cycleMyAvatar() {
      var _a, _b;
      const p = this.state();
      const cur = this.avatarOf({ name: this.playerName(), g: (_a = p.profile) == null ? void 0 : _a.g, av: (_b = p.profile) == null ? void 0 : _b.av });
      const next = (cur.g * 16 + cur.i + 1) % 32;
      p.profile.g = Math.floor(next / 16);
      p.profile.av = next % 16;
      this.render();
      window.storyFramework.saveStory();
    },
    renderMe() {
      var _a, _b, _c, _d, _e;
      const fw = window.storyFramework;
      const v = fw.storyState.variables || {};
      const p = this.state();
      const t = this.tierInfo() || this.TIERS.sms;
      const pn = this.playerName();
      const api = this.getApi();
      const ready = this.isApiReady();
      const s = this.getSettings();
      return `<div class="ph-me">
                <div class="ph-me-card">
                    <span class="ph-ava-btn" onclick="PhonePanel.cycleMyAvatar()" title="点我换头像（男/女各 16 张循环）">${this.renderAvatar({ name: pn, g: (_a = p.profile) == null ? void 0 : _a.g, av: (_b = p.profile) == null ? void 0 : _b.av }, "lg")}</span>
                    <div><b>${this.esc(pn)}</b><span>${this.esc(v.identity || v.身份 || ((_c = fw.storyState.setup) == null ? void 0 : _c.identity) || ((_d = fw.storyState.setup) == null ? void 0 : _d.customIdentity) || "普通人")}</span>
                    <small class="ph-me-av-tip">点头像可换</small></div>
                </div>
                <div class="ph-me-sig" onclick="PhonePanel.editSig()" title="点击修改个性签名">
                    <i>✍</i><span>${this.esc(((_e = p.profile) == null ? void 0 : _e.sig) || "编辑个性签名——让朋友们认识你")}</span>
                </div>
                <div class="ph-me-stats">
                    <div><b>${p.contacts.length}</b><span>联系人</span></div>
                    <div><b>${p.chats.filter((c) => c.group).length}</b><span>群聊</span></div>
                    <div><b>${p.chats.length - p.chats.filter((c) => c.group).length}</b><span>私聊</span></div>
                    <div><b>${p.moments.filter((m) => m.mine).length}</b><span>我的动态</span></div>
                </div>
                <div class="ph-me-meta">
                    <p>📶 ${this.esc(t.label)} · ${this.esc(t.appName)}${t.feedName ? " / " + this.esc(t.feedName) : ""}</p>
                    <p>🔌 手机分身接口：${api.reuseMain !== false ? "复用主笔接口" : "独立配置"}${ready ? "（就绪）" : "（未就绪）"}</p>
                    <p>🔄 自动刷新：每 ${this.getSettings().interval} 轮正文后（上次：${p.lastSyncTurn ? "第 " + p.lastSyncTurn + " 轮" : "尚未刷新"}）</p>
                    <p>💗 主动联系：${s.alive === false ? "已关闭（大家各忙各的）" : "已开启——你不理 TA，TA 会来找你"}</p>
                </div>
                <div class="ph-me-btns">
                    <button onclick="PhonePanel.sync(true)">🔄 立即刷新</button>
                    <button onclick="PhonePanel.openConfig()">⚙ 接口设置</button>
                    <button onclick="PhoneAlive.toggle()">💗 主动联系：${s.alive === false ? "开" : "关"}</button>
                </div>
                <div class="ph-me-tip">手机是生活溢出的一角：消息与动态由「手机分身」模型以各联系人自己的日子生成——他们不围着你转，但你的每条消息都有真实的回应。</div>
            </div>`;
    },
    /* ---------- 交互入口（onclick 直调） ---------- */
    sendMsg() {
      const input = document.getElementById("phMsgInput");
      if (!input || !input.value.trim() || !this.view.chat) return;
      const text = input.value.trim();
      input.value = "";
      this.sendPlayerMessage(this.view.chat, text);
    },
    postMomentBtn() {
      var _a;
      const ta = document.getElementById("phMomentText");
      if (!ta || !ta.value.trim()) return;
      const text = ta.value.trim();
      ta.value = "";
      this.postMoment(text);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "📱 动态已发表——联系人们刷到会反应的", "success");
    },
    async commentMoment(id) {
      var _a, _b;
      const text = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _b.call(_a, { title: "评论动态", message: "写下你的评论：" }));
      if (text && text.trim()) this.actMoment(id, "comment", text.trim());
    },
    openConfig() {
      var _a;
      this.close();
      (_a = window.ConfigModal) == null ? void 0 : _a.open();
    },
    /** 编辑个性签名（v3.19.8） */
    async editSig() {
      var _a, _b, _c, _d;
      const p = this.state();
      const sig = await ((_c = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _c.call(_a, {
        title: "个性签名",
        message: "写一句话介绍自己（联系人们会看到）：",
        value: ((_b = p.profile) == null ? void 0 : _b.sig) || ""
      }));
      if (sig === null || sig === void 0) return;
      p.profile.sig = String(sig).slice(0, 60);
      this.render();
      window.storyFramework.saveStory();
      (_d = window.showToast) == null ? void 0 : _d.call(window, "📱 个性签名已更新", "success");
    },
    /* ==================== 读档恢复 ==================== */
    onStoryLoaded() {
      var _a;
      this.syncContacts();
      this.updateDock();
      const p = this.state();
      if (p.chats.length || p.moments.length) {
        (_a = window.StoryResponseHandler) == null ? void 0 : _a.renderSystemMessage(
          `📱 手机已恢复：${p.contacts.length} 位联系人、${p.chats.length} 个会话、${p.moments.length} 条动态——点右下角 📱 查看。`,
          "info"
        );
      }
    },
    /** 轮次广播兜底（story:turn-saved 事件；主钩子在 user-input-handler） */
    install() {
      this.ensureModule();
      this.updateDock();
      this.initAvatars();
      document.addEventListener("story:turn-saved", () => {
        try {
          this.syncContacts();
          this.updateDock();
        } catch (e) {
        }
      });
      console.log("[PhonePanel] 📱 地球开放世界·手机分身模块就位");
    }
  };
  window.PhonePanel = PhonePanel;
  function boot() {
    try {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/phone-style.css?v=3.55.10";
      document.head.appendChild(link);
      PhonePanel.install();
      const aliveScript = document.createElement("script");
      aliveScript.src = "js/phone-alive.js?v=3.55.10";
      aliveScript.onerror = () => console.warn("[PhoneAlive] 主动联系引擎加载失败（不影响手机基础功能）");
      document.head.appendChild(aliveScript);
      const appsScript = document.createElement("script");
      appsScript.src = "js/phone-apps.js?v=3.55.10";
      appsScript.onerror = () => console.warn("[PhoneApps] App 生态加载失败（不影响手机基础功能）");
      document.head.appendChild(appsScript);
      /* v3.47.0 墨韵融合：微博/匿名树洞/日历/商城/日记（CSS 由该模块自注入） */
      const socialScript = document.createElement("script");
      socialScript.src = "js/phone-social.js?v=3.55.10";
      socialScript.onerror = () => console.warn("[PhoneSocial] 墨韵融合社交包加载失败（基础 App 不受影响）");
      document.head.appendChild(socialScript);
    } catch (e) {
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
