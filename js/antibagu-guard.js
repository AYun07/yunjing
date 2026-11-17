const AntibaguGuard = {
  /** 内置套话库：AI 高频空洞表达（程序层扩充，与 config 条令互补） */
  BAN_PHRASES: [
    "眸中闪过一丝",
    "眼底闪过一丝",
    "眼中精光一闪",
    "瞳孔骤然收缩",
    "空气仿佛凝固",
    "时间仿佛静止",
    "仿佛过了一个世纪",
    "不知过了多久",
    "嘴角勾起一抹",
    "嘴角噙着一抹",
    "唇角勾起",
    "勾起一抹弧度",
    "心脏漏跳一拍",
    "心跳漏了半拍",
    "呼吸一滞",
    "喉头发紧",
    "声音不大却",
    "轻飘飘的一句话",
    "如遭雷击",
    "杀气腾腾",
    "森然的笑意",
    "说不清道不明",
    "复杂的情绪",
    "意味深长地",
    "缓缓开口道",
    "沉声道",
    "幽幽说道",
    "闻言",
    "此言一出"
  ],
  /** 防八股 2 号·用户禁词库（短语级，命中即列入本回合禁用清单；
   *  单字/超高频词如「石」「投入」「一丝」不入检测层——误报会淹没清单，
   *  它们由知识库条目软约束 + 专名豁免条款兜底） */
  CLICHE_PHRASES: [
    "生理性",
    "精致人偶",
    "投入心湖",
    "荡起涟漪",
    "泛起涟漪",
    "像一根针",
    "一丝不易察觉",
    "难以察觉的",
    "不容置疑",
    "不容置喙",
    "精密仪器",
    "磨人的小妖精",
    "要我的命",
    "一折就断",
    "轻描淡写",
    "嘴角上扬",
    "露出一丝微笑",
    "眼里闪过",
    "眼中闪过",
    "眼里显现",
    "指尖泛白",
    "下意识",
    "无意识",
    "流露出温柔",
    "漾起柔和",
    "带着天真的微笑",
    "声音比寒冰",
    "比寒冰更冰冷",
    "眼眶泛红",
    "晶莹的泪珠",
    "泪水模糊了视线",
    "攥紧拳头",
    "手指微微颤抖",
    "眼神变冷",
    "语气骤然下沉",
    "周身气压",
    "空气骤然"
  ],
  /** 明喻标记词（禁比喻句式的可检测面） */
  SIMILE_MARKERS: ["宛如", "犹如", "恰似", "酷似", "仿佛", "如同"],
  /** 句式级检测（正则命中即列入禁用清单） */
  CLICHE_PATTERNS: [
    { re: /——/, label: "破折号（——）" },
    { re: /不是[^，。！？；:\n]{1,14}而是/, label: "「不是……而是……」先否后肯句式" },
    { re: /像(小兔子|小鹿|小猫|小兽|幼兽)一样/, label: "小动物比喻" }
  ],
  /** 滑动窗口：分析最近 N 条 assistant 正文 */
  WINDOW: 6,
  /** 5-gram 跨轮重复阈值（窗口内出现 ≥ 此值即列入避免清单） */
  NGRAM_THRESHOLD: 2,
  isEnabled() {
    try {
      return localStorage.getItem("antibaguGuard") !== "off";
    } catch (e) {
      return true;
    }
  },
  /** 主入口：生成注入文本（无复读特征时返回空串，不注入） */
  buildDirective() {
    var _a;
    if (!this.isEnabled()) return "";
    const fw = window.storyFramework;
    const history = (_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.conversationHistory;
    if (!Array.isArray(history)) return "";
    const bodies = [];
    for (let i = history.length - 1; i >= 0 && bodies.length < this.WINDOW; i--) {
      const m = history[i];
      if (m && m.role === "assistant" && m.content) {
        const body = this._cleanBody(m.content);
        if (body.length >= 80) bodies.push(body);
      }
    }
    if (bodies.length < 2) return "";
    const repeated = this._findRepeatedNgrams(bodies);
    const banned = this._findBannedHits(bodies);
    const cliche = this._findClicheHits(bodies);
    const opener = this._checkOpeners(bodies);
    const parts = [];
    if (repeated.length || banned.length || cliche.length || opener) {
      parts.push("【本回合反八股检测（程序自动分析近几轮正文生成，必须执行）】");
    } else {
      return "";
    }
    if (repeated.length) {
      parts.push(`以下短语近几轮已重复出现，本回合严禁再次出现或写出近似变体：${repeated.join("、")}。`);
    }
    if (banned.length) {
      parts.push(`以下套话已在近几轮出现（属AI空洞表达），本回合彻底禁用：${banned.join("、")}。`);
    }
    if (cliche.length) {
      parts.push(`以下禁词/禁句式已在近几轮正文出现（套话禁词总库红线，详见知识库「防八股·套话禁词总库」），本回合彻底禁用并改为直接叙述：${cliche.join("、")}。禁词判定不适用于专有名词与实指名词——地名/人名/设定术语/真实实体（石村、灵石、野兽、火焰等实指）照常使用。`);
    }
    if (opener) {
      parts.push(opener);
    }
    parts.push("本回合开头起笔方式、句式节奏须与上一轮明显不同；正文中同一修辞不得复用。");
    return parts.join("\n");
  },
  /** 剔除变量块 / 行动选项段 / 代码围栏，只留叙事正文 */
  _cleanBody(content) {
    return String(content).replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/[(【<]\/?variable_update[)】>]?[\s\S]*$/i, "").replace(/【(?:行动选项|情节走向|后续走向|剧情选项|下一步|可选行动|行动方案|你的选择|抉择)】[\s\S]*$/i, "").replace(/```[a-zA-Z]*\r?\n[\s\S]*?```/g, "").trim();
  },
  /**
   * 5-gram 跨轮重复检测
   * 只统计「跨不同轮次」出现的片段（同轮内的自然重复不算八股），
   * 并过滤常见虚词结构，取频次最高的前 6 条。
   */
  _findRepeatedNgrams(bodies, limit = 6) {
    const perRound = bodies.map((b) => {
      const text = b.replace(/[\s\n\r，。！？；：、"''「」『』（）()…—·《》<>]/g, "");
      const set = /* @__PURE__ */ new Set();
      for (let i = 0; i + 5 <= text.length; i++) set.add(text.slice(i, i + 5));
      return set;
    });
    const freq = /* @__PURE__ */ new Map();
    for (const set of perRound) {
      for (const g of set) freq.set(g, (freq.get(g) || 0) + 1);
    }
    const VIRTUAL = ["的时候", "这一个", "自己的", "一个", "什么", "已经", "还是", "就是", "他们", "她们", "我们", "然后", "但是", "如果", "这样", "那样", "不会", "没有", "可以", "出来", "起来", "过去", "下来", "之间", "之后", "之前"];
    const hits = [];
    for (const [g, n] of freq) {
      if (n < this.NGRAM_THRESHOLD) continue;
      if (VIRTUAL.some((v) => g.includes(v))) continue;
      hits.push([g, n]);
    }
    hits.sort((a, b) => b[1] - a[1]);
    const merged = this._mergeOverlapping(hits.map((h) => h[0]).slice(0, 24));
    return merged.slice(0, limit).map((g) => {
      const n = Math.max(...hits.filter((h) => g.includes(h[0]) || h[0].includes(g)).map((h) => h[1]));
      return `「${g}」(近${n}轮)`;
    });
  },
  /** 合并头部/尾部重叠（≥3字）或互为子串的 n-gram 片段 */
  _mergeOverlapping(grams) {
    const merged = [];
    for (const g of grams) {
      let absorbed = false;
      for (let i = 0; i < merged.length && !absorbed; i++) {
        const m = merged[i];
        if (m.includes(g) || g.includes(m)) {
          merged[i] = m.length >= g.length ? m : g;
          absorbed = true;
          break;
        }
        for (let ov = Math.min(4, m.length - 1, g.length - 1); ov >= 3; ov--) {
          if (m.slice(-ov) === g.slice(0, ov)) {
            merged[i] = m + g.slice(ov);
            absorbed = true;
            break;
          }
          if (g.slice(-ov) === m.slice(0, ov)) {
            merged[i] = g + m.slice(ov);
            absorbed = true;
            break;
          }
        }
      }
      if (!absorbed) merged.push(g);
    }
    return merged;
  },
  /** 套话库命中检测（窗口内出现过即列入） */
  _findBannedHits(bodies) {
    const all = bodies.join("\n");
    return this.BAN_PHRASES.filter((p) => all.includes(p)).slice(0, 8);
  },
  /** 防八股2号·禁词/明喻标记/禁句式命中检测（窗口内出现过即列入；
   *  与内置套话分开报告，避免合并截断丢命中） */
  _findClicheHits(bodies) {
    const all = bodies.join("\n");
    const hits = this.CLICHE_PHRASES.filter((p) => all.includes(p)).slice(0, 8).map((p) => `「${p}」`);
    for (const m of this.SIMILE_MARKERS) if (all.includes(m)) hits.push(`明喻词「${m}」`);
    for (const { re, label } of this.CLICHE_PATTERNS) if (re.test(all)) hits.push(label);
    return hits.slice(0, 14);
  },
  /**
   * 开头同构检测：连续轮次起笔方式指纹
   * 指纹 = 对话型（首句含引号）/ 叙事型（其余）；
   * 连续 ≥3 轮同型 → 强制换起法；连续 2 轮且首 4 字有重复 → 报警。
   */
  _checkOpeners(bodies) {
    const openers = bodies.map((b) => {
      const head = b.slice(0, 60);
      const isDialog = /["「『"']/.test(head.slice(0, 20));
      return { type: isDialog ? "对话" : "叙事", head: head.replace(/\s/g, "").slice(0, 12) };
    });
    const last = openers[openers.length - 1];
    let streak = 1;
    for (let i = openers.length - 2; i >= 0; i--) {
      if (openers[i].type === last.type) streak++;
      else break;
    }
    if (streak >= 3) {
      return `最近 ${streak} 轮全部以${last.type}方式起笔——本回合必须换起法（${last.type === "对话" ? "改用环境、动作或心理切入" : "改用一句对话、一个动作或结果倒叙直入"}）。`;
    }
    if (streak === 2 && openers.length >= 2) {
      const a = openers[openers.length - 1].head.slice(0, 4);
      const b = openers[openers.length - 2].head.slice(0, 4);
      if (a === b && a.length === 4) {
        return `最近两轮开头雷同（均以「${a}…」起笔）——本回合开头必须完全不同。`;
      }
    }
    return "";
  }
};
window.AntibaguGuard = AntibaguGuard;
