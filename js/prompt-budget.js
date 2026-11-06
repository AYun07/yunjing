(function() {
  "use strict";
  /* v3.55.17：预算不再写死 11 万字符，改为按「主接口模型的上下文窗口」自适应。
     原先 11 万字符 ≈ 7 万 token，对 8K/16K/32K 上下文的小模型是致命的——请求直接
     400 或被服务端静默截头，玩家看到的是"AI 突然失忆"。此处按模型名/显式配置推断
     上下文窗口，留 40% 给输出，超出的部分仍由原有的优先级裁剪兜住。 */
  const CTX_RULES = [
    [/gemini-1\.5|gemini-2|gemini-3|\b1m\b|1000k/i, 1000000],
    [/claude/i, 200000],
    [/gpt-4o|gpt-4\.1|gpt-5|\bo1-|\bo3-|nemotron|llama-3\.[13]|mistral-large|qwen3|128k/i, 128000],
    [/deepseek|64k/i, 64000],
    [/qwen|glm|32k/i, 32000],
    [/16k/i, 16000],
    [/8k/i, 8000]
  ];
  const PromptBudget = {
    KEY: "storyPromptBudget",
    CTX_KEY: "storyContextWindow",
    defaults: { enabled: true, limit: 11e4, auto: true },
    /** 上一次构建的账单（UI 展示用） */
    lastReport: null,
    /** 主接口模型的上下文窗口（tokens）；推断不出返回 0 */
    ctxTokens() {
      try {
        const api = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.api) || {};
        const explicit = Number(api.contextWindow || api.ctxWindow || api.context_length || 0);
        if (explicit > 0) return explicit;
        const model = String(api.model || "");
        if (model) {
          for (let i = 0; i < CTX_RULES.length; i++) if (CTX_RULES[i][0].test(model)) return CTX_RULES[i][1];
        }
      } catch (e) {}
      try {
        const v = Number(localStorage.getItem(this.CTX_KEY) || 0);
        if (v > 0) return v;
      } catch (e) {}
      return 0;
    },
    /** 按上下文窗口换算成字符上限：中文约 1 字 ≈ 1.2 token，留 40% 给输出与波动 */
    autoLimit() {
      const ctx = this.ctxTokens();
      if (!(ctx > 0)) return 0;
      const chars = Math.floor(ctx * 0.6 / 1.2);
      return Math.max(3000, Math.min(this.defaults.limit, chars));
    },
    /**
     * v3.99.0 低配档硬上限：极低参数模型的上下文常是 4k/8k/16k，而上面按模型名推断
     * 一旦推不出（自建端点、中转站、本地 ollama、名字里没有规格数字）就会退回 11 万字符，
     * 对它们是必爆。这里在 lite 档给一个不依赖推断的保守天花板。
     * 18000 字符 ≈ 1.5 万 token，落在 16k~32k 上下文的安全区；真 8k 的模型由
     * autoLimit() 推断出的 4000 字符接住，两者取小。 */
    LITE_LIMIT: 18000,
    /** v4.00.0 低配档上限随上下文分档：8K 模型按 18000 字符装配必爆（实测 8087 字符
     *  ≈ 6700 token，加上输出就超过 8192）。8K→5200、16K→9000、更高→18000。 */
    liteLimit() {
      const ctx = this.ctxTokens();
      if (ctx > 0 && ctx <= 8000) return 5200;
      if (ctx > 0 && ctx <= 16000) return 9000;
      return 18000;
    },
    isLite() {
      try {
        return !!(window.BaseModelMode && window.BaseModelMode.isLite && window.BaseModelMode.isLite());
      } catch (e) {
        return false;
      }
    },
    /** 粗略 token 估算（中文字 1.2、其余 0.3），仅用于展示，不参与裁剪判断 */
    estTokens(messages) {
      let t = 0;
      (messages || []).forEach((m) => {
        const s = String((m && m.content) || "");
        const cjk = (s.match(/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
        t += cjk * 1.2 + (s.length - cjk) * 0.3;
      });
      return Math.round(t);
    },
    /**
     * v3.99.0 超限自适应降级（最后的兜底）
     *
     * 模型名推断不出来的情况很常见（自建端点、中转站、本地 ollama、名字里不带规格数字），
     * 这时无论默认值设多少都可能踩空。真正可靠的信号只有一个：服务端报「上下文超限」。
     * 捕获到就把它记下来，上限立刻砍到 55%，下次装配按新上限走，并自动重试一次。
     * 玩家只会感觉「卡了一下就好了」，而不是看到一串英文报错。
     */
    OVERFLOW_KEY: "storyPromptOverflow",
    /** 是否为上下文超限类错误 */
    isOverflowError(err) {
      const s = String((err && (err.message || err.error || err)) || "").toLowerCase();
      if (!s) return false;
      return /context[_ ]?length|maximum context|too many tokens|reduce the length|prompt is too long|input is too long|exceed.*(token|context)|token.*exceed|上下文.*(超|长)|超出.*长度|内容过长/.test(s);
    },
    /** 记录一次超限：直接落到最保守档（约 6.7k token，8k 上下文的模型也能跑），
     *  已经比它还小就再砍 25%。玩家撞一次墙就到位，不必反复试。 */
    noteOverflow() {
      const cfg = this.get();
      const cur = Number(cfg.limit) || this.defaults.limit;
      const SAFE = 8000;
      const next = cur > SAFE ? SAFE : Math.max(3000, Math.round(cur * 0.75));
      try {
        localStorage.setItem(this.OVERFLOW_KEY, String(next));
      } catch (e) {}
      console.warn(`[PromptBudget] 服务端报告上下文超限，上限自动下调：${cur} → ${next} 字符`);
      return next;
    },
    clearOverflow() {
      try {
        localStorage.removeItem(this.OVERFLOW_KEY);
      } catch (e) {}
    },
    /**
     * v3.99.0 上下文窗口循环（玩家侧唯一的可操作项）
     *
     * 旧版给的是「预算上限 8万/11万/15万/20万字符」——**最小也是 8 万字符**，
     * 用便宜小模型的玩家根本调不下来，只能被动爆窗。而且玩家其实不知道自己要多少字符，
     * 只知道模型是 8K/32K/128K。所以改成直接循环「上下文窗口」，预算由它换算。
     * 顺序：自动 → 8K → 16K → 32K → 64K → 128K → 回到自动。
     */
    CTX_STEPS: [8000, 16000, 32000, 64000, 128000],
    /** 当前显式设定的窗口（0 = 自适应） */
    ctxExplicit() {
      try {
        return Number(localStorage.getItem(this.CTX_KEY) || 0) || 0;
      } catch (e) {
        return 0;
      }
    },
    setCtx(n) {
      try {
        if (n > 0) localStorage.setItem(this.CTX_KEY, String(n));
        else localStorage.removeItem(this.CTX_KEY);
      } catch (e) {}
    },
    /** 循环到下一档，返回 {ctx, label} */
    cycleContext() {
      const cur = this.ctxExplicit();
      let next;
      if (!cur) next = this.CTX_STEPS[0];
      else {
        const i = this.CTX_STEPS.indexOf(cur);
        next = i < 0 || i === this.CTX_STEPS.length - 1 ? 0 : this.CTX_STEPS[i + 1];
      }
      this.setCtx(next);
      /* 手动切过窗口后，之前的超限记录失效（玩家已经明确告知了真实窗口） */
      this.clearOverflow();
      this.KEY_MANUAL = true;
      try { localStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), auto: true })); } catch (e) {}
      return { ctx: next, label: next ? `${Math.round(next / 1000)}K 上下文` : "自适应" };
    },
    /** 被 noteOverflow 记录过的上限（没有则 0） */
    overflowLimit() {
      try {
        const v = Number(localStorage.getItem(this.OVERFLOW_KEY) || 0);
        return v > 0 ? v : 0;
      } catch (e) {
        return 0;
      }
    },
    get() {
      let saved = {};
      try {
        saved = JSON.parse(localStorage.getItem(this.KEY) || "{}") || {};
      } catch (e) {
        saved = {};
      }
      const cfg = { ...this.defaults, ...saved };
      /* 老玩家兼容：曾手动切过档位（存了 limit）但没有 auto 标记的，尊重手动值 */
      if (saved.auto === undefined && Object.prototype.hasOwnProperty.call(saved, "limit")) cfg.auto = false;
      cfg.autoLimitChars = 0;
      if (cfg.auto !== false) {
        const auto = this.autoLimit();
        if (auto > 0) {
          cfg.limit = auto;
          cfg.autoLimitChars = auto;
        }
      }
      /* v3.99.0 低配档兜底：推断不出窗口时不能留 11 万字符的默认值；
         即便推断出来了，小模型的真实安全线也远低于 0.6 系数理论值。 */
      cfg.lite = this.isLite();
      const LL = this.liteLimit();
      if (cfg.lite && cfg.limit > LL) {
        cfg.limit = LL;
        cfg.liteClamped = true;
      }
      /* 曾经被服务端判定超限的，按实测值继续收紧，避免每次都撞墙 */
      const of = this.overflowLimit();
      if (of > 0 && of < cfg.limit) {
        cfg.limit = of;
        cfg.overflowTightened = true;
      }
      /* 手动档位也不允许超过小模型可承受的范围之外的「人为抬高」——
         玩家自己设的更大值仍尊重，但给出标记供 UI 提示。 */
      cfg.ctxTokens = this.ctxTokens();
      return cfg;
    },
    save(cfg) {
      try {
        localStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), ...cfg }));
      } catch (e) {
      }
    },
    _chars(m) {
      return String((m == null ? void 0 : m.content) || "").length;
    },
    /**
     * 结算：messages 与 segs 平行（segs[i].idx 指向 messages 下标）。
     * 超预算时按优先级裁剪（splice 真删除，不产生空消息——空消息会被 API 拒收）。
     * @param {Array} messages 消息数组
     * @param {Array} segs 段账 [{idx, label, prio}] prio 越小越先丢；prio>=100 永不裁
     * @returns {Array} 处理后的 messages（可能变短）
     */
    finalize(messages, segs) {
      const cfg = this.get();
      let total = messages.reduce((s, m) => s + this._chars(m), 0);
      const segChars = {};
      segs.forEach((s) => {
        segChars[s.label] = (segChars[s.label] || 0) + this._chars(messages[s.idx]);
      });
      const report = {
        total,
        limit: cfg.limit,
        enabled: cfg.enabled,
        tokens: this.estTokens(messages),
        auto: cfg.auto !== false && cfg.autoLimitChars > 0,
        ctxTokens: cfg.ctxTokens,
        trimmed: [],
        segs: Object.entries(segChars).map(([label, chars]) => ({ label, chars })).sort((a, b) => b.chars - a.chars)
      };
      if (!cfg.enabled || total <= cfg.limit) {
        this.lastReport = report;
        return messages;
      }
      const alive = new Set(segs.map((s) => s.idx));
      const drop = (idx, why) => {
        alive.delete(idx);
        report.trimmed.push(why);
      };
      const HISTORY_FLOOR = 12;
      let guard = 200;
      while (total > cfg.limit && guard-- > 0) {
        const cand = segs.filter((s) => alive.has(s.idx) && s.prio < 100 && this._chars(messages[s.idx]) > 0).sort((a, b) => a.prio - b.prio || a.idx - b.idx);
        if (!cand.length) break;
        const pick = cand[0];
        if (pick.label === "历史") {
          const histAlive = segs.filter((s) => alive.has(s.idx) && s.label === "历史").map((s) => s.idx).sort((a, b) => a - b);
          if (histAlive.length <= HISTORY_FLOOR) {
            segs.forEach((s) => {
              if (s.label === "历史") s.prio = 100;
            });
            const next = segs.filter((s) => alive.has(s.idx) && s.prio < 100 && this._chars(messages[s.idx]) > 0);
            if (!next.length) break;
            const p2 = next.sort((a, b) => a.prio - b.prio || a.idx - b.idx)[0];
            total -= this._chars(messages[p2.idx]);
            drop(p2.idx, p2.label);
            continue;
          }
          const oldest = histAlive[0];
          total -= this._chars(messages[oldest]);
          drop(oldest, "历史（最旧一轮）");
          continue;
        }
        total -= this._chars(messages[pick.idx]);
        drop(pick.idx, pick.label);
      }
      const out = messages.filter((_, i) => alive.has(i) || !segs.some((s) => s.idx === i));
      report.final = out.reduce((s, m) => s + this._chars(m), 0);
      report.finalTokens = this.estTokens(out);
      this.lastReport = report;
      console.warn(`[PromptBudget] 超预算裁剪：${report.total} → ${report.final} 字符（裁掉：${[...new Set(report.trimmed)].join("、")}）`);
      return out;
    },
    /** 设置面板用的账单 HTML */
    meterHTML() {
      const r = this.lastReport;
      const cfg = this.get();
      if (!r) return `<div style="font-size:12px;color:var(--imt,#9a8c6e);">尚无账单——发送一轮创作后此处显示各段占比</div>`;
      const pct = Math.min(100, Math.round(r.total / cfg.limit * 100));
      const color = pct > 90 ? "#e07070" : pct > 70 ? "#e0a04c" : "#8fd9a8";
      const bars = r.segs.map((s) => {
        const w = Math.min(100, Math.round(s.chars / Math.max(1, r.total) * 100));
        return `<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;margin:3px 0;">
                    <span style="flex:0 0 92px;color:var(--imt,#9a8c6e);">${s.label}</span>
                    <div style="flex:1;height:4px;border-radius:2px;background:var(--ip,#c9a86a)1a;overflow:hidden;"><i style="display:block;height:100%;width:${w}%;background:var(--ip,#c9a86a);opacity:.8;"></i></div>
                    <b style="flex:0 0 64px;text-align:right;color:var(--itx,#d8cba8);font-weight:500;">${(s.chars / 1e3).toFixed(1)}k</b>
                </div>`;
      }).join("");
      return `<div style="margin:6px 0 10px;">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;">
                    <b style="font-size:13px;color:${color};">${(r.total / 1e4).toFixed(1)} 万 / ${(cfg.limit / 1e4).toFixed(1)} 万字符</b>
                    <i style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);">≈${((r.tokens || 0) / 1000).toFixed(1)}k token</i>
                    ${r.trimmed && r.trimmed.length ? `<i style="font-style:normal;font-size:11px;color:#e0a04c;">上轮裁剪：${[...new Set(r.trimmed)].join("、")}</i>` : '<i style="font-style:normal;font-size:11px;color:#8fd9a8;">上轮未超预算</i>'}
                </div>
                <div style="font-size:11px;color:var(--imt,#9a8c6e);margin-bottom:6px;">${r.auto ? `🔎 已按模型上下文自适应（${((r.ctxTokens || 0) / 1000).toFixed(0)}k 上下文 → ${(cfg.limit / 1e4).toFixed(1)} 万字符）` : '📌 使用手动档位（点下方「字符上限」可循环切换；想恢复自适应请关闭再开启预算）'}</div>
                <div style="height:6px;border-radius:3px;background:var(--ip,#c9a86a)1a;overflow:hidden;"><i style="display:block;height:100%;width:${pct}%;background:${color};"></i></div>
            </div>${bars}`;
    }
  };
  window.PromptBudget = PromptBudget;
})();
