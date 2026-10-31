const VariableInstructionParser = {
  /** 保留容器名：出现在 "xxx.字段" 前缀时按容器处理而非角色 */
  RESERVED_CONTAINERS: ["stats", "dashboard", "plotPoints", "characters", "foreshadowings", "items", "history", "gauges", "dimensions", "天赋", "时间"],
  /* v3.27.6：玩家自定义变量命名空间——「自定义.字段: 值」行式指令归此容器，
   * 严禁当作角色名建档（旧版把「自定义」建成幽灵角色卡，档案区常年挂一张空壳） */
  CUSTOM_NS: ["自定义", "自定义追踪", "customVars"],
  /* v3.32.0：实体玩法引擎命名空间——「安全屋住户.姓名: 身份」「资源异动.物资: 量级」
   * 归各自容器（vars.安全屋住户 / vars.资源异动），供 world-ext 实体引擎 eeAbsorb 消费；
   * 同样严禁当角色建档（否则「安全屋住户」成为幽灵角色卡） */
  EE_NS: ["安全屋住户", "资源异动", "工程进度", "基地住户", "门派弟子", "战队成员"],
  /**
   * 主入口：解析 AI 回复
   * @param {string} aiReply - AI 完整回复
   * @param {object} currentVars - 当前变量集
   * @param {object} [opts] - v3.27.9 选项
   *   opts.storyRegistration：正文登记路径（主笔变量块 / 登记官回执）传 true——
   *     块内被触碰的角色视为「已在正文登场」，自动解除 isFaraway 远方标记
   *     （动态世界路径不传：它只登记远方，标记由调用方对新建角色补打）
   * @returns {{newVariables: object, updateBlock: string|null}}
   */
  parse(aiReply, currentVars, opts) {
    const isStoryReg = !!(opts && opts.storyRegistration);
    this._storyReg = isStoryReg;
    /* v3.55.26 数值平衡：每轮属性增量预算在解析开始时重置
       v3.55.27：同时把本轮回复交给引擎解析时间跨度并预算各属性的时间成长额度 */
    const AE = window.AttributeEngine;
    if (AE) AE.beginTurn(aiReply, currentVars);
    let res;
    try {
      res = this._parseInner(aiReply, currentVars);
    } finally {
      this._storyReg = false;
    }
    /* v3.55.27 时间跨越成长结算：AI 未上报（或报不足）的成长由引擎按公式真实补涨。
       仅正文登记路径结算——动态世界的旁白推演不算玩家亲身经历的时间。 */
    if (AE && res && res.newVariables) {
      try { AE.settleTimeGrowth(res.newVariables, isStoryReg); } catch (e) { /* 不阻断 */ }
    }
    return res;
  },
  /** v3.27.9：解除角色的远方标记（正文登场 = 已遇见，通讯录可同步） */
  unmarkFaraway(charObj) {
    if (charObj && typeof charObj === "object" && charObj.isFaraway !== void 0) {
      delete charObj.isFaraway;
    }
  },
  /** v3.28.0：关系归类（家人/恋人/亲友；空串 = 无标签）。
   *  数据源：c.relation（登记官按「角色名.relation: 家人」行式指令归档，JSON 变体同）；
   *  旧档无此字段时按 relationship/role 文本推断（舅妈→家人、发小→亲友），
   *  推断为纯函数不改档——只影响展示与提示词标注，零迁移成本。 */
  relationOf(c) {
    if (!c || typeof c !== "object") return "";
    const r = String(c.relation || "").trim();
    if (r) {
      if (/家人|亲属|亲戚|血亲/.test(r)) return "家人";
      if (/恋人|伴侣|未婚|对象|情人/.test(r)) return "恋人";
      if (/亲友|挚友|朋友|发小|闺蜜/.test(r)) return "亲友";
      return "";
    }
    const text = `${c.relationship || ""} ${c.role || ""}`;
    if (/家人|亲属|亲戚|母亲|父亲|爸妈|妈妈|爸爸|岳母|岳父|公公|婆婆|妻子|丈夫|老公|老婆|哥哥|姐姐|弟弟|妹妹|儿子|女儿|舅舅|舅妈|外公|外婆|爷爷|奶奶|叔叔|婶婶|姑姑|姑父|伯伯|嫂子|姐夫|妹夫|弟妹|儿媳|女婿|孙子|孙女/.test(text)) return "家人";
    if (/恋人|女友|男友|未婚妻|未婚夫|对象|情人/.test(text)) return "恋人";
    if (/挚友|好友|发小|闺蜜|战友/.test(text)) return "亲友";
    return "";
  },
  _parseInner(aiReply, currentVars) {
    const block = this.extractUpdateBlock(aiReply);
    const newVariables = JSON.parse(JSON.stringify(currentVars || {}));
    this.normalizeContainers(newVariables);
    if (!block) return { newVariables, updateBlock: null };
    const jsonObj = this.tryParseJson(block);
    if (jsonObj && typeof jsonObj === "object" && !Array.isArray(jsonObj)) {
      this.mergeJsonObject(jsonObj, newVariables);
      return { newVariables, updateBlock: block };
    }
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      try {
        this.parseLine(line, newVariables);
      } catch (e) {
        console.warn("[VariableParser] 行解析失败:", line, e.message);
      }
    }
    return { newVariables, updateBlock: block };
  },
  /** 提取 (variable_update) ... (/variable_update) 块（兼容全角/尖括号/未闭合/代码围栏变体） */
  extractUpdateBlock(reply) {
    if (!reply) return null;
    const paired = [
      /\(variable_update\)([\s\S]*?)\(\/variable_update\)/gi,
      /【variable_update】([\s\S]*?)【\/variable_update】/gi,
      /<variable_update>([\s\S]*?)<\/variable_update>/gi
    ];
    const found = [];
    for (const p of paired) {
      /* v3.38.1 兼容：String.matchAll 需 Chrome 73+，旧内核无此方法会抛错——改用 exec 循环 */
      let m;
      p.lastIndex = 0;
      while ((m = p.exec(reply)) !== null) {
        const t = m[1] && m[1].trim();
        if (t) found.push(t);
      }
    }
    if (found.length) return found.join("\n");
    const openOnly = reply.match(/(?:\(variable_update\)|【variable_update】|<variable_update>)([\s\S]*)$/i);
    if (openOnly) {
      const rest = openOnly[1].replace(/```[a-zA-Z]*\r?\n?|```/g, "").replace(/【?\/?variable_update】?/gi, "").trim();
      if (rest) return rest;
    }
    const fence = reply.match(/```(?:json|variable_update)?\s*\r?\n([\s\S]*?)```/i);
    if (fence) {
      const inner = fence[1].trim();
      const looksLikeVars = /^\s*\{[\s\S]*\}$/.test(inner) || /^("?(chapter|wordCount|totalChapters)"?)\s*[:：]/i.test(inner) && /(^|\n)\s*[+-]|>>|[:：]/.test(inner);
      if (looksLikeVars) return inner;
    }
    return null;
  },
  /** 尝试把块内容解析为 JSON 对象（含宽松修正：全角标点/尾逗号） */
  tryParseJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    if (!t.startsWith("{")) return null;
    try {
      return JSON.parse(t);
    } catch (e) {
    }
    try {
      const fixed = t.replace(/，/g, ",").replace(/：/g, ":").replace(/，\s*([}\]])/g, "$1").replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch (e) {
      return null;
    }
  },
  // ==================== JSON 对象规范化合并 ====================
  mergeJsonObject(obj, vars) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const cfg = window.storyFramework && window.storyFramework.config || {};
    const gaugeMap = this.labelToKeyMap(cfg.gauges);
    const statMap = this.labelToKeyMap(cfg.statKeys);
    const title = this.pickStr(obj, ["title", "bookTitle", "书名"]);
    if (title) vars.title = title;
    const num = (v) => typeof v === "number" ? v : v && /^[+-]?\d+(\.\d+)?$/.test(String(v).trim()) ? parseFloat(v) : null;
    const chapter = this.applyChapter((_a = obj.chapter) != null ? _a : obj.章节, vars.chapter);
    if (chapter != null && String((_c = (_b = obj.chapter) != null ? _b : obj.章节) != null ? _c : "").trim() !== "") vars.chapter = chapter;
    const wordCount = this.extractInt((_e = (_d = obj.wordCount) != null ? _d : obj.字数) != null ? _e : obj.totalWords);
    if (wordCount != null) vars.wordCount = wordCount;
    const total = this.applyChapter((_f = obj.totalChapters) != null ? _f : obj.总章数, vars.totalChapters);
    if (total != null && String((_h = (_g = obj.totalChapters) != null ? _g : obj.总章数) != null ? _h : "").trim() !== "") vars.totalChapters = total;
    const dash = this.pickObj(obj, ["dashboard", "gauges", "仪表盘", "仪表"]);
    const gaugeSrc = dash || obj;
    Object.entries(gaugeSrc).forEach(([k, v]) => {
      const key = gaugeMap[k] || ((cfg.gauges || []).some((g) => g.key === k) ? k : null);
      const n = num(v);
      if (key && n != null) this.applyNumeric(vars, key, v);
    });
    const statsObj = this.pickObj(obj, ["stats", "dimensions", "六维", "创作六维"]);
    if (statsObj) {
      vars.stats = vars.stats || {};
      /* v3.55.26 数值平衡：JSON 变体路径同样经引擎钳制（AI 违规输出 JSON 时仍拦截跳变） */
      const AEJ = window.AttributeEngine;
      Object.entries(statsObj).forEach(([k, v]) => {
        const key = statMap[k] || k;
        const n = num(v);
        if (n == null) return;
        if (AEJ) AEJ.applyStatDelta(vars.stats, key, String(v));
        else this.applyNumeric(vars.stats, key, v);
      });
    }
    const charsObj = this.pickObj(obj, ["characters", "角色", "characterCards", "人物"]);
    if (charsObj) {
      vars.characters = vars.characters || {};
      Object.entries(charsObj).forEach(([rawName, fields]) => {
        const name = this.sanitizeCharName(rawName);
        if (!name || !fields || typeof fields !== "object") return;
        const cur = vars.characters[name] = vars.characters[name] || {};
        if (this._storyReg) this.unmarkFaraway(cur);
        this.mergeCharFields(cur, fields);
        if (Array.isArray(fields.history)) {
          cur.history = cur.history || [];
          fields.history.forEach((h) => {
            if (h) cur.history.push(this.timeStamp(vars) + " " + h);
          });
        }
      });
    }
    const plot = this.pickObj(obj, ["plotPoints", "plotPoint", "伏笔"]);
    const fsList = this.pickArr(obj, ["foreshadowings", "伏笔清单"]);
    vars.foreshadowings = vars.foreshadowings || [];
    if (plot || fsList) {
      const planted = (plot == null ? void 0 : plot.planted) || (plot == null ? void 0 : plot.埋设) || (fsList == null ? void 0 : fsList.filter((f) => this.fsStatus(f) !== "resolved")) || [];
      const resolved = (plot == null ? void 0 : plot.resolved) || (plot == null ? void 0 : plot.回收) || (fsList == null ? void 0 : fsList.filter((f) => this.fsStatus(f) === "resolved")) || [];
      planted.forEach((p) => this.addForeshadow(vars, this.fsName(p), "planted"));
      resolved.forEach((p) => this.addForeshadow(vars, this.fsName(p), "resolved"));
    }
    const items = this.pickArr(obj, ["items", "道具", "关键道具"]);
    if (items) {
      vars.items = vars.items || [];
      items.forEach((it) => {
        var _a2;
        if (!it) return;
        const name = typeof it === "string" ? it : it.name || it.名称;
        if (!name) return;
        const count = typeof it === "object" ? num((_a2 = it.count) != null ? _a2 : it.数量) || 1 : 1;
        const exist = vars.items.find((i) => i.name === name);
        if (exist) exist.count = count;
        else vars.items.push({ name, count });
      });
      vars.items = vars.items.filter((i) => i.count > 0);
    }
    const hist = this.pickArr(obj, ["history", "大事记", "编年史"]);
    if (hist) {
      vars.history = vars.history || [];
      hist.forEach((h) => {
        if (h) vars.history.push(this.timeStamp(vars) + " " + h);
      });
      if (vars.history.length > 60) vars.history = vars.history.slice(-60);
    }
  },
  /** v3.27.5 容器自愈：把被历史版本污染的 items/foreshadowings/history 修回数组。
   *  污染形态：字符串（"剑x1、丹药x3"——.length 可通过但 .map 崩溃）或
   *  普通对象（{剑: 2}）。解析规则：顿号/逗号/分号拆分，「名称x数量」计数。
   *  在 parse 入口与框架落地前调用，旧存档无需手动清理。 */
  normalizeContainers(vars) {
    if (!vars || typeof vars !== "object") return vars;
    const fixArr = (val, parseItem) => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string" && val.trim()) {
        return val.split(/[、,，;；\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => parseItem(s));
      }
      if (val && typeof val === "object") {
        return Object.entries(val).filter(([, v]) => v !== void 0 && v !== null).map(([k, v]) => parseItem(k, v));
      }
      return [];
    };
    vars.items = fixArr(vars.items, (s, v) => {
      var _a, _b;
      const m = String(s).match(/^(.+?)\s*[xX×]\s*(\d+)$/);
      if (m) return { name: m[1].trim(), count: parseInt(m[2], 10) || 1 };
      const c = v && typeof v === "object" ? Number((_b = (_a = v.count) != null ? _a : v.qty) != null ? _b : v.数量) : typeof v === "number" ? v : NaN;
      return { name: String(s).trim(), count: isFinite(c) && c > 0 ? Math.round(c) : 1 };
    });
    vars.foreshadowings = fixArr(vars.foreshadowings, (s, v) => {
      var _a;
      const st = v && typeof v === "object" ? String((_a = v.status) != null ? _a : "") : "";
      return { name: String(s).trim(), status: /resolved|回收/i.test(st) ? "resolved" : "planted", plantedAt: v && typeof v === "object" && v.plantedAt || "" };
    });
    if (typeof vars.history === "string" && vars.history.trim()) {
      vars.history = vars.history.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    } else if (!Array.isArray(vars.history)) {
      vars.history = [];
    }
    if (vars.characters && typeof vars.characters === "object") {
      const ghost = vars.characters["自定义"];
      if (ghost && typeof ghost === "object") {
        vars.自定义 = vars.自定义 && typeof vars.自定义 === "object" && !Array.isArray(vars.自定义) ? vars.自定义 : {};
        Object.entries(ghost).forEach(([k, v]) => {
          if (k === "history") return;
          if (v !== void 0 && v !== null && String(v).trim() !== "" && !(k in vars.自定义)) {
            vars.自定义[k] = v;
          }
        });
      }
      delete vars.characters["自定义"];
    }
    if (typeof vars.自定义 === "string" && vars.自定义.trim()) {
      const obj = {};
      vars.自定义.split(/[、,，;；\n]+/).forEach((p) => {
        const m = p.trim().match(/^([^:：]{1,12})[:：]\s*(.+)$/);
        if (m) obj[m[1].trim()] = this.coerceFieldValue(m[2].trim());
      });
      vars.自定义 = obj;
    } else if (Array.isArray(vars.自定义)) {
      const obj = {};
      vars.自定义.forEach((v, i) => {
        if (v) obj["字段" + (i + 1)] = v;
      });
      vars.自定义 = obj;
    } else if (!vars.自定义 || typeof vars.自定义 !== "object") {
      if (vars.自定义 === void 0 || vars.自定义 === null) {
      } else vars.自定义 = {};
    }
    if (vars.characters && typeof vars.characters === "object") {
      Object.values(vars.characters).forEach((c) => {
        if (!c || typeof c !== "object") return;
        const cf = c.customFields && typeof c.customFields === "object" && !Array.isArray(c.customFields) ? c.customFields : null;
        if (!cf) return;
        Object.keys(cf).forEach((k) => {
          const stdKey = this.CELL_ALIAS[String(k).trim()];
          if (!stdKey) return;
          if (this.isCfLocked(c, k)) return;
          const stdVal = c[stdKey];
          if (stdVal == null || String(stdVal).trim() === "") return;
          if (String(cf[k]) !== String(stdVal)) cf[k] = stdVal;
        });
      });
    }
    return vars;
  },
  /** 从 "第3章" / "Chapter 3" / "3" 这类值中提取整数
   *  v1.6.9 修复：旧版 chapter 只认纯数字字符串，"第3章"整串落库，
   *  面板进度条与终章压力判定全部失效 */
  extractInt(v) {
    if (v == null) return null;
    if (typeof v === "number" && isFinite(v)) return Math.round(v);
    const s = String(v).trim();
    if (!s) return null;
    const arabic = s.match(/\d+/);
    if (arabic) return parseInt(arabic[0], 10);
    const cn = s.match(/[一二三四五六七八九十]{1,3}/);
    if (cn) return this.cnNumToInt(cn[0]);
    return null;
  },
  /** 中文数字（一~九十九）转整数 */
  cnNumToInt(s) {
    const digit = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    if (s === "十") return 10;
    const m = s.match(/^([一二三四五六七八九]?)(十)([一二三四五六七八九]?)$/);
    if (m) return (m[1] ? digit[m[1]] : 1) * 10 + (m[3] ? digit[m[3]] : 0);
    if (/^[一二三四五六七八九]$/.test(s)) return digit[s];
    return null;
  },
  /** chapter/totalChapters 专用应用："+n"/"-n" 增量与绝对值（含"第3章"文本数字化） */
  applyChapter(rawValue, oldValue) {
    const s = String(rawValue != null ? rawValue : "").trim();
    if (!s) return oldValue;
    const inc = s.match(/^([+-])\s*(\d+)$/);
    if (inc) {
      const base = typeof oldValue === "number" && isFinite(oldValue) ? oldValue : 0;
      return Math.max(0, base + parseInt(inc[2], 10) * (inc[1] === "-" ? -1 : 1));
    }
    const n = this.extractInt(s);
    return n != null ? n : oldValue;
  },
  /** wordCount 专用应用：增量优先 + 累计误报守卫
   *  失败模式：提示词歧义时模型把"全书累计"当增量报（+N，N≈当前累计）→ 叠加后字数翻倍。
   *  守卫：增量超过 max(1600, 当前累计×90%) 时判为累计误报，按绝对值落表
   *  （单章正文 800-1600 字为协议上界，超限增量几乎必为累计值） */
  applyWordCount(rawValue, oldValue) {
    const old = typeof oldValue === "number" && isFinite(oldValue) ? oldValue : 0;
    const s = String(rawValue != null ? rawValue : "").trim();
    if (!s) return oldValue;
    const inc = s.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
    if (inc) {
      const delta = parseFloat(inc[2]) * (inc[1] === "-" ? -1 : 1);
      if (delta > Math.max(1600, old * 0.9)) return Math.max(0, Math.round(delta));
      return Math.max(0, Math.round(old + delta));
    }
    const n = this.extractInt(s);
    if (n != null) return Math.max(0, n);
    return oldValue;
  },
  /** 数值应用：支持绝对值与 "+n"/"-n" 增量 */
  applyNumeric(target, key, val) {
    if (typeof val === "number" && isFinite(val)) {
      target[key] = Math.round(val * 100) / 100;
      return;
    }
    const s = String(val).trim();
    const inc = s.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
    const old = target[key];
    if (inc) {
      const delta = parseFloat(inc[2]) * (inc[1] === "-" ? -1 : 1);
      target[key] = Math.round(((typeof old === "number" ? old : 0) + delta) * 100) / 100;
    } else if (/^\d+(?:\.\d+)?$/.test(s)) {
      target[key] = parseFloat(s);
    }
  },
  /** 字段值类型保真：number/boolean 直存；"true"/"false" 字符串转布尔；其余 trim 存字符串。
   *  v1.6.9 修复：旧版一律 String() 化，isCulprit: true 落库成 "true" 字符串，
   *  面板渲染与下游布尔判断全部失效 */
  coerceFieldValue(v) {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v;
    const s = String(v).trim();
    if (/^true$/i.test(s)) return true;
    if (/^false$/i.test(s)) return false;
    return s;
  },
  /* v3.27.7：角色字段标准别名表（玩家锁定判定用；mergeCharFields 同源）
   * locked 数组存标准键（role/personality/…）或未映射的裸键（口头禅等） */
  CHAR_ALIAS: {
    role: ["role", "身份", "职业"],
    age: ["age", "年龄"],
    personality: ["personality", "性格"],
    motivation: ["motivation", "动机", "核心动机"],
    secret: ["secret", "秘密"],
    status: ["status", "状态"],
    appearance: ["appearance", "外貌"],
    speechPattern: ["speechPattern", "语言习惯"],
    firstAppearance: ["firstAppearance", "首次出场"],
    trust: ["trust", "关系值"],
    arc: ["arc", "弧光"]
  },
  /** v3.27.7：字段是否被玩家锁定（rawKey 先归一化到标准键再比对） */
  isCharFieldLocked(c, rawKey) {
    if (!c || !Array.isArray(c.locked) || !c.locked.length || !rawKey) return false;
    const k = String(rawKey);
    if (c.locked.includes(k)) return true;
    for (const [field, keys] of Object.entries(this.CHAR_ALIAS)) {
      if (keys.includes(k) && c.locked.includes(field)) return true;
    }
    return false;
  },
  /* v3.29.1：自定义格子锁——c.cfLocked 存解锁交还 AI 的格子键，缺省（无数组/未收录）
   * = 锁定防 AI 覆盖（旧档 customFields 行为零变化）。与渲染器同款判定。 */
  isCfLocked(c, key) {
    if (!c || typeof c !== "object") return true;
    return !(Array.isArray(c.cfLocked) && c.cfLocked.includes(String(key)));
  },
  /* v3.31.3：格子名 → 标准字段同义表。玩家常给角色加「境界/身份/位置」这类与
   * 标准字段同名的格子——旧版两轨各存一份、各改各的（AI 改 realm 格子不动、
   * AI 改格子 realm 不动），卡片上两个值对不上（玩家反馈"数据有点混乱"）。
   * mergeCharFields 据此双向同步：任一轨被 AI 更新，另一轨（未锁定）跟着走。 */
  CELL_ALIAS: {
    "境界": "realm",
    "修为": "realm",
    "境界修为": "realm",
    "身份": "role",
    "职业": "role",
    "行当": "role",
    "年龄": "age",
    "岁数": "age",
    "外貌": "appearance",
    "长相": "appearance",
    "性格": "personality",
    "脾气": "personality",
    "言谈": "speechPattern",
    "言谈习惯": "speechPattern",
    "口头禅": "speechPattern",
    "动机": "motivation",
    "核心动机": "motivation",
    "目标": "goal",
    "近期目标": "goal",
    "秘密": "secret",
    "状态": "status",
    "近况": "status",
    "身心近况": "status",
    "位置": "location",
    "所在": "location",
    "所在位置": "location",
    "行踪": "location",
    "关系": "relationship",
    "与主角关系": "relationship",
    "信任": "trust",
    "信任度": "trust",
    "好感": "favor",
    "好感度": "favor",
    "印象": "impression",
    "对主角印象": "impression"
  },
  /** v3.31.3 同义双轨同步的落值助手：数字/增量走数值应用，其余类型保真 */
  _putSyncVal(target, key, v) {
    if (typeof v === "number" && isFinite(v)) {
      target[key] = v;
      return;
    }
    const s = String(v != null ? v : "").trim();
    if (!s) return;
    if (/^[+-]?\s*\d+(?:\.\d+)?$/.test(s)) this.applyNumeric(target, key, s);
    else target[key] = this.coerceFieldValue(s);
  },
  mergeCharFields(cur, fields) {
    const alias = this.CHAR_ALIAS;
    const cf = cur.customFields && typeof cur.customFields === "object" && !Array.isArray(cur.customFields) ? cur.customFields : null;
    const cfHit = /* @__PURE__ */ new Set();
    if (cf) {
      Object.entries(fields).forEach(([k, v]) => {
        if (!Object.prototype.hasOwnProperty.call(cf, k)) return;
        cfHit.add(k);
        if (this.isCfLocked(cur, k)) return;
        if (v === void 0 || v === null || String(v).trim() === "") return;
        if (typeof v === "number" && isFinite(v)) this.applyNumeric(cf, k, v);
        else if (typeof v === "boolean") cf[k] = v;
        else if (/^[+-]?\s*\d+(?:\.\d+)?$/.test(String(v).trim())) this.applyNumeric(cf, k, String(v).trim());
        else cf[k] = this.coerceFieldValue(v);
      });
    }
    Object.entries(alias).forEach(([field, keys]) => {
      if (this.isCharFieldLocked(cur, field)) return;
      for (const k of keys) {
        if (cfHit.has(k)) continue;
        const v = fields[k];
        if (v !== void 0 && v !== null && String(v).trim() !== "") {
          cur[field] = this.coerceFieldValue(v);
        }
      }
    });
    Object.entries(fields).forEach(([k, v]) => {
      if (cfHit.has(k)) return;
      if (this.isCharFieldLocked(cur, k)) return;
      const isPrim = typeof v === "string" || typeof v === "number" || typeof v === "boolean";
      const aliasFlat = [];
      Object.values(alias).forEach((arr) => Array.prototype.push.apply(aliasFlat, arr));
      if (isPrim && v !== void 0 && v !== null && String(v).trim() !== "" && aliasFlat.indexOf(k) === -1 && !["history", "locked"].includes(k)) {
        cur[k] = this.coerceFieldValue(v);
      }
    });
    if (cf) {
      Object.keys(cf).forEach((cellName) => {
        const stdKey = this.CELL_ALIAS[String(cellName).trim()];
        if (!stdKey) return;
        if (this.isCfLocked(cur, cellName)) return;
        const v = fields[stdKey];
        if (v === void 0 || v === null || String(v).trim() === "") return;
        this._putSyncVal(cf, cellName, v);
      });
      cfHit.forEach((k) => {
        const stdKey = this.CELL_ALIAS[String(k).trim()];
        if (!stdKey) return;
        if (this.isCfLocked(cur, k)) return;
        if (this.isCharFieldLocked(cur, stdKey)) return;
        const v = fields[k];
        if (v === void 0 || v === null || String(v).trim() === "") return;
        this._putSyncVal(cur, stdKey, v);
      });
    }
  },
  /** 角色名清洗：剔除 JSON 残渣（纯数字/符号/保留词/超长名） */
  sanitizeCharName(raw) {
    let n = String(raw || "").trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/[{}\[\]]/g, "").trim();
    if (!n) return null;
    if (!/[\u4e00-\u9fa5A-Za-z]/.test(n)) return null;
    if (this.RESERVED_CONTAINERS.includes(n)) return null;
    if (this.CUSTOM_NS.includes(n)) return null;
    if (this.EE_NS.includes(n)) return null;
    if (/^(planted|resolved|name|value|key|label|status)$/i.test(n)) return null;
    if (n.length > 12) return null;
    return n;
  },
  addForeshadow(vars, name, status) {
    if (!name) return;
    vars.foreshadowings = vars.foreshadowings || [];
    const exist = vars.foreshadowings.find((f) => f.name === name);
    if (exist) {
      exist.status = status;
      return;
    }
    vars.foreshadowings.push({ name, status, plantedAt: this.timeStamp(vars) });
  },
  fsName(p) {
    if (!p) return null;
    if (typeof p === "string") {
      return p.replace(/^["'+\-\s]+|["']+$/g, "").replace(/[（）()]\s*(埋设|回收|获得|失去|埋下|揭晓)\s*[（）()]/g, "").trim() || null;
    }
    return this.pickStr(p, ["name", "名称", "伏笔"]) || null;
  },
  fsStatus(p) {
    if (p && typeof p === "object") {
      const s = this.pickStr(p, ["status", "状态"]) || "";
      return /resolved|回收|已回收/i.test(s) ? "resolved" : "planted";
    }
    return "planted";
  },
  // ---- 取值工具 ----
  pickStr(obj, keys) {
    for (const k of keys) {
      const v = obj == null ? void 0 : obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  },
  pickObj(obj, keys) {
    for (const k of keys) {
      const v = obj == null ? void 0 : obj[k];
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    }
    return null;
  },
  pickArr(obj, keys) {
    for (const k of keys) {
      const v = obj == null ? void 0 : obj[k];
      if (Array.isArray(v)) return v;
    }
    return null;
  },
  /** config 列表 → {英文键:键, 中文标签:键} 双向映射 */
  labelToKeyMap(list) {
    const m = {};
    (list || []).forEach((s) => {
      if (s && s.key) {
        m[s.key] = s.key;
        if (s.label) m[s.label] = s.key;
      }
    });
    return m;
  },
  // ==================== 逐行指令解析（标准协议） ====================
  /** 解析单行指令 */
  parseLine(line, vars) {
    const cleanKey = (k) => k.replace(/^["'“”\[\{]+|["'“”\]\},]+$/g, "").trim();
    /* v3.47.1 兼容：AI 受旧模板/方言影响把「键: 值」写成「键=值」时，
     * 把首个 = 规范成冒号再走标准解析（否则整行静默丢弃 → 面板/档案不更新）。
     * 仅当整行无任何冒号才动手（值含冒号的行不碰）；+/‑ 列表行与 >> 轨迹行
     * 天然不含赋值 =；键长上限 64、前字符不为 <>=!，防把叙事长句/比较式误当指令 */
    if (line.includes("=") && !line.includes(":") && !line.includes("：")) {
      const eq = line.indexOf("=");
      if (eq > 0 && eq <= 64 && !/[<>=!]/.test(line[eq - 1])) {
        line = line.slice(0, eq).trim() + ": " + line.slice(eq + 1);
      }
    }
    /* v3.47.5：多键连写行展开——「仙路长梯: 凡人 / 灵石: 0 / 寿元: 约余六十载」整行按 /
     * 切段且段段都是「短键: 值」时拆成独立行逐段解析（否则整行被当成一个超长值，
     * 灵石/寿元/资质等字段全部丢失，只留下一个巨型垃圾字符串变量） */
    {
      const parts = line.split(/\s*[/／]\s*/).filter(Boolean);
      if (parts.length >= 2 && parts.every((p) => /^["“]?[\w\u4e00-\u9fa5.·]{1,24}["”]?\s*[:：]\s*\S/.test(p))) {
        parts.forEach((p) => this.parseLine(p, vars));
        return;
      }
    }
    let m = line.match(/^>>\s*(.+?)\.history\s*[:：]\s*(.+)$/);
    if (m) {
      const who = this.sanitizeCharName(cleanKey(m[1]));
      if (!who) return;
      const record = m[2].trim();
      vars.characters = vars.characters || {};
      vars.characters[who] = vars.characters[who] || {};
      if (this._storyReg) this.unmarkFaraway(vars.characters[who]);
      vars.characters[who].history = vars.characters[who].history || [];
      vars.characters[who].history.push(this.timeStamp(vars) + " " + record);
      if (vars.characters[who].history.length > 30) vars.characters[who].history.shift();
      return;
    }
    m = line.match(/^>>\s*(.+?)\s*[:：]\s*(.+)$/);
    if (m) {
      const topic = cleanKey(m[1]);
      const record = m[2].trim();
      if (topic === "大事记" || topic === "history" || topic === "编年史") {
        vars.history = vars.history || [];
        vars.history.push(this.timeStamp(vars) + " " + record);
        if (vars.history.length > 60) vars.history.shift();
        return;
      }
    }
    m = line.match(/^([+-])\s*(.+?)(?:\s*x\s*(\d+))?$/);
    if (m && !line.includes(":") && !line.includes("：")) {
      const sign = m[1];
      let name = m[2].trim().replace(/[（）()]\s*(埋设|回收|获得|失去|埋下|揭晓)\s*[（）()]/g, "").trim();
      const count = m[3] ? parseInt(m[3], 10) : 1;
      this.applyListOp(vars, sign, name, count, !!m[3]);
      return;
    }
    m = line.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
    if (m) {
      const rawKey = cleanKey(m[1]);
      const rawValue = m[2].trim();
      if (/^[\[\{\}\],\s]+$/.test(rawValue)) return;
      if (rawKey.includes(".")) {
        const dotIdx = rawKey.indexOf(".");
        const container = rawKey.slice(0, dotIdx).trim();
        const field = cleanKey(rawKey.slice(dotIdx + 1));
        const cfg = window.storyFramework && window.storyFramework.config || {};
        if (container === "stats" || container === "六维" || container === "dashboard") {
          const map = container === "stats" ? this.labelToKeyMap(cfg.statKeys) : this.labelToKeyMap(cfg.gauges);
          const key = map[field] || field;
          const target = container === "stats" ? vars.stats = vars.stats || {} : vars;
          /* v3.55.26 数值平衡：属性增量经属性引擎钳制（单项±6/轮、合计±10/轮、值域0-100），
             无正文依据的离谱跳变在此被真实拦截——不只靠提示词自觉 */
          const AE = window.AttributeEngine;
          if (AE && container === "stats" && /^[+-]?\s*\d+(?:\.\d+)?$/.test(rawValue)) {
            AE.applyStatDelta(target, key, rawValue);
          } else {
            this.applyNumeric(target, key, rawValue);
          }
          return;
        }
        /* v3.55.27 时间账本：跨度/纪元/期间状态，绝不建幽灵角色卡 */
        if (container === "时间" || container === "time") {
          if (window.AttributeEngine) window.AttributeEngine.absorbTime(vars, field, rawValue);
          return;
        }
        /* v3.55.26 天赋状态机：定档/暴露（单向）/名称，绝不建幽灵角色卡 */
        if (container === "天赋" || container === "talent") {
          if (window.AttributeEngine) window.AttributeEngine.absorbTalent(vars, field, rawValue);
          return;
        }
        if (this.CUSTOM_NS.includes(container)) {
          vars.自定义 = vars.自定义 && typeof vars.自定义 === "object" && !Array.isArray(vars.自定义) ? vars.自定义 : {};
          if (field && /^[+-]?\s*\d+(?:\.\d+)?$/.test(rawValue)) {
            this.applyNumeric(vars.自定义, field, rawValue);
          } else {
            vars.自定义[field] = this.coerceFieldValue(rawValue);
          }
          return;
        }
        if (this.EE_NS.includes(container)) {
          vars[container] = vars[container] && typeof vars[container] === "object" && !Array.isArray(vars[container]) ? vars[container] : {};
          if (field && /^[+-]?\s*\d+(?:\.\d+)?$/.test(rawValue)) {
            this.applyNumeric(vars[container], field, rawValue);
          } else {
            vars[container][field] = this.coerceFieldValue(rawValue);
          }
          return;
        }
        const charName = this.sanitizeCharName(container);
        if (!charName || !field) return;
        vars.characters = vars.characters || {};
        vars.characters[charName] = vars.characters[charName] || {};
        if (this._storyReg) this.unmarkFaraway(vars.characters[charName]);
        if (!this.isCharFieldLocked(vars.characters[charName], field)) {
          this.mergeCharFields(vars.characters[charName], { [field]: rawValue });
          const cfc = vars.characters[charName].customFields;
          const isCfKey = cfc && typeof cfc === "object" && Object.prototype.hasOwnProperty.call(cfc, field);
          if (/^[+-]?\s*\d+(?:\.\d+)?$/.test(rawValue) && !isCfKey) {
            this.applyNumeric(vars.characters[charName], field, rawValue);
          }
        }
        return;
      }
      if (rawKey === "chapter" || rawKey === "totalChapters") {
        vars[rawKey] = this.applyChapter(rawValue, vars[rawKey]);
        return;
      }
      if (rawKey === "wordCount") {
        vars.wordCount = this.applyWordCount(rawValue, vars.wordCount);
        return;
      }
      if (this.RESERVED_CONTAINERS.includes(rawKey) || this.CUSTOM_NS.includes(rawKey) || this.EE_NS.includes(rawKey) || ["道具", "关键道具", "伏笔", "伏笔清单", "大事记", "编年史", "六维", "仪表盘", "角色", "天赋"].includes(rawKey)) return;
      /* v3.47.5：增量清单值展开——「储物袋账簿: +召唤令 x1, +任意门 x1」把值按逗号/顿号
       * 拆成裸 +/- 行逐条入账（applyListOp 进 vars.items 喂背包模块）；
       * 防误拆：段首须是中文/字母/【[（纯数字增量「灵石: +30」仍走 parseValue 数值路径） */
      {
        const dsegs = rawValue.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
        if (dsegs.length >= 1 && dsegs.every((s) => /^[+-]\s*[\u4e00-\u9fa5A-Za-z【\[]/.test(s))) {
          dsegs.forEach((s) => this.parseLine(s, vars));
          return;
        }
      }
      /* v3.47.5：JSON 对象值——「法宝栏: {"护身":"空间法宝","飞行":"无"}」整值解析为
       * 对象落表（旧版 parseValue 只认 [...] 数组，{...} 会以字符串原样存档） */
      if (/^\{[\s\S]*\}$/.test(rawValue)) {
        const jo = this.tryParseJson(rawValue);
        if (jo && typeof jo === "object" && !Array.isArray(jo)) {
          vars[rawKey] = jo;
          return;
        }
      }
      vars[rawKey] = this.parseValue(rawValue, vars[rawKey]);
      return;
    }
  },
  /** 数值增减 / 直接赋值 */
  parseValue(rawValue, oldValue) {
    const inc = String(rawValue).match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
    if (inc && typeof oldValue === "number") {
      const delta = parseFloat(inc[2]) * (inc[1] === "-" ? -1 : 1);
      return Math.round((oldValue + delta) * 100) / 100;
    }
    if (inc && (oldValue === void 0 || oldValue === null)) {
      return parseFloat(inc[2]) * (inc[1] === "-" ? -1 : 1);
    }
    if (inc) {
      return parseFloat(inc[2]) * (inc[1] === "-" ? -1 : 1);
    }
    const num = String(rawValue).match(/^(\d+(?:\.\d+)?)$/);
    if (num) return parseFloat(num[1]);
    const bool = String(rawValue).toLowerCase();
    if (bool === "true") return true;
    if (bool === "false") return false;
    if (/^\[.*\]$/.test(rawValue)) {
      try {
        return JSON.parse(rawValue.replace(/'/g, '"'));
      } catch (e) {
      }
    }
    return rawValue;
  },
  /** 伏笔清单 / 关键道具操作
   *  分类规则：显式带数量(x1/x2…)或以"道具"开头 → 关键道具；其余默认登记为伏笔
   */
  applyListOp(vars, sign, name, count, hasCount) {
    vars.foreshadowings = vars.foreshadowings || [];
    vars.items = vars.items || [];
    const isItem = hasCount || /^(关键)?道具[:：]/.test(name);
    if (!isItem) name = name.replace(/^[伏线索谜坑]+[:：]/, "").trim();
    if (!this.sanitizeCharName(name)) return;
    if (sign === "+") {
      if (isItem) {
        const exist = vars.items.find((i) => i.name === name);
        if (exist) exist.count = (exist.count || 1) + count;
        else vars.items.push({ name, count });
      } else {
        if (!vars.foreshadowings.some((f) => f.name === name)) {
          vars.foreshadowings.push({ name, status: "planted", plantedAt: this.timeStamp(vars) });
        }
      }
    } else {
      if (isItem) {
        const exist = vars.items.find((i) => i.name === name);
        if (exist) {
          exist.count = (exist.count || 1) - count;
          if (exist.count <= 0) vars.items = vars.items.filter((i) => i !== exist);
        }
      } else {
        this.addForeshadow(vars, name, "resolved");
      }
    }
    vars.items = vars.items.filter((i) => i.count > 0);
  },
  /**
   * 章节时间戳：优先读取"正在解析中"的变量集（chapter: +1 已在本轮生效），
   * 避免回退到框架旧快照导致显示 [第?章]
   */
  timeStamp(vars) {
    var _a, _b, _c;
    const ch = vars && typeof vars.chapter === "number" ? vars.chapter : (_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.chapter;
    return `[第${ch || "?"}章]`;
  }
};
window.VariableInstructionParser = VariableInstructionParser;
