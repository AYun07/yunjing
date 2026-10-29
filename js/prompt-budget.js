(function() {
  "use strict";
  const PromptBudget = {
    KEY: "storyPromptBudget",
    defaults: { enabled: true, limit: 11e4 },
    /** 上一次构建的账单（UI 展示用） */
    lastReport: null,
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
                    <b style="font-size:13px;color:${color};">${(r.total / 1e4).toFixed(1)} 万 / ${(cfg.limit / 1e4).toFixed(0)} 万字符</b>
                    ${r.trimmed && r.trimmed.length ? `<i style="font-style:normal;font-size:11px;color:#e0a04c;">上轮裁剪：${[...new Set(r.trimmed)].join("、")}</i>` : '<i style="font-style:normal;font-size:11px;color:#8fd9a8;">上轮未超预算</i>'}
                </div>
                <div style="height:6px;border-radius:3px;background:var(--ip,#c9a86a)1a;overflow:hidden;"><i style="display:block;height:100%;width:${pct}%;background:${color};"></i></div>
            </div>${bars}`;
    }
  };
  window.PromptBudget = PromptBudget;
})();
