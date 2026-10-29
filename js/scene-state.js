(function() {
  "use strict";
  const HISTORY_MAX = 12;
  const FIELDS = ["place", "time", "weather", "cast", "props", "tension"];
  const SceneState = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    /* ==================== 数据访问 ==================== */
    /** 当前舞台快照（无则空壳） */
    snap() {
      var _a, _b;
      const s = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.sceneState;
      if (s && typeof s === "object" && s.current && typeof s.current === "object") return s.current;
      return { place: "", time: "", weather: "", cast: [], props: "", tension: null, turn: 0 };
    },
    history() {
      var _a, _b;
      const s = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.sceneState;
      return s && Array.isArray(s.history) ? s.history : [];
    },
    hasData() {
      const s = this.snap();
      return !!(s.place || Array.isArray(s.cast) && s.cast.length || s.time);
    },
    /* ==================== 提取（变量AI 通道） ==================== */
    ready() {
      return !!(window.VariableAI && window.VariableAI.recapReady && window.VariableAI.recapReady());
    },
    /**
     * 每轮登记：读最新一段正文 → 输出舞台快照 JSON。
     * 与变量AI 的 extract 错峰（延迟 3 秒，登记官先跑，舞台官后跑）。
     */
    async track(reply, turnIdx = null) {
      var _a, _b, _c, _d;
      const fw = window.storyFramework;
      if (!((_a = fw == null ? void 0 : fw.storyState) == null ? void 0 : _a.isStoryStarted)) return false;
      if (!this.ready()) return false;
      if (this._busy) return false;
      const raw = String(reply || "");
      if (!raw.trim()) return false;
      let body = raw.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
      if ((_b = window.StoryResponseHandler) == null ? void 0 : _b.extractBody) {
        body = window.StoryResponseHandler.extractBody(raw).trim() || body;
      }
      if (!body) return false;
      this._busy = true;
      try {
        const prev = this.snap();
        const prevLine = prev.place ? `【上一幕】${prev.place}${prev.time ? " · " + prev.time : ""}${Array.isArray(prev.cast) && prev.cast.length ? " · 在场：" + prev.cast.map((c) => c.name).join("、") : ""}` : "";
        const out = await window.VariableAI.recapCall([
          {
            role: "system",
            content: `你是小说工坊的"舞台监督"。读完这段正文，登记当前场景状态，严格输出一个 JSON 对象（不要 markdown、不要解释）：
{
  "place": "当前地点（具体到可想象的程度，如「雾隐城·码头仓库」）",
  "time": "时辰（黎明/清晨/正午/黄昏/入夜/深夜 等）",
  "weather": "天气或氛围（若正文未提，沿用上一幕或留空）",
  "cast": [ {"name":"人物名","at":"位置（如「火炉旁」「门口」）","wear":"着装要点","mood":"情绪"} ],
  "props": "台面关键道具（没有则空串）",
  "tension": 50
}
规则：
1. 只登记"这段正文结束时"的状态（镜头推进到哪算哪）
2. cast 是全量覆盖名单——每轮从头清点本轮结束时与玩家同处一个空间、面对面可见的每一个人（主角也算），绝不沿用上一幕的名单：上轮在场但本轮已离开/远在别处的人必须移出；上轮不在但本轮到场的人必须列入
3. 判定只看空间与镜头：人在另一个房间/另一辆车/电话另一端/远处 = 不在 cast，无论 TA 与主角多亲密；本轮正文末尾正在离开（说走就走、转身出门）= 已离场，不列
4. 正文未提及的 place/time/weather 沿用上一幕（避免凭空发明）——但 cast 永远重新清点，不适用"沿用"
5. tension 是场面张力 0-100（平静=10，对峙=60，生死=90），凭正文判断
6. 上限 8 人，超出取戏份最重的`
          },
          {
            role: "user",
            content: `${prevLine ? prevLine + "\n\n" : ""}【正文】
${body.slice(0, 8e3)}`
          }
        ]);
        const parsed = this._parseJSON(out);
        if (!parsed) throw new Error("舞台快照不是合法 JSON");
        const cur = this._normalize(parsed, fw.storyState.turnCount);
        const st = fw.storyState.sceneState || { history: [] };
        const hist = Array.isArray(st.history) ? st.history : [];
        if (prev.place && prev.turn != null && prev.turn !== cur.turn) hist.push(prev);
        fw.storyState.sceneState = {
          current: cur,
          history: hist.slice(-HISTORY_MAX),
          _ts: Date.now()
        };
        (_c = fw.saveStory) == null ? void 0 : _c.call(fw);
        (_d = this.renderBadge) == null ? void 0 : _d.call(this);
        console.log(`[舞台] 第 ${cur.turn} 轮：${cur.place || "未名地点"} · ${cur.time || "时辰未定"} · 在场 ${cur.cast.length} 人`);
        return true;
      } catch (e) {
        console.error("[舞台] 登记失败:", e);
        return false;
      } finally {
        this._busy = false;
      }
    },
    _parseJSON(text) {
      let s = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        const o = JSON.parse(s.slice(start, end + 1));
        return o && typeof o === "object" ? o : null;
      } catch (e) {
        try {
          const fixed = s.slice(start, end + 1).replace(/'/g, '"').replace(/,\s*([}\]])/g, "$1");
          const o = JSON.parse(fixed);
          return o && typeof o === "object" ? o : null;
        } catch (e2) {
          return null;
        }
      }
    },
    _normalize(parsed, turn) {
      const cast = (Array.isArray(parsed.cast) ? parsed.cast : []).slice(0, 8).filter((c) => c && (c.name || c.at || c.mood)).map((c) => ({
        name: String(c.name || "").trim().slice(0, 16),
        at: String(c.at || "").trim().slice(0, 24),
        wear: String(c.wear || "").trim().slice(0, 40),
        mood: String(c.mood || "").trim().slice(0, 16)
      }));
      const tn = Number(parsed.tension);
      return {
        place: String(parsed.place || "").trim().slice(0, 40),
        time: String(parsed.time || "").trim().slice(0, 12),
        weather: String(parsed.weather || "").trim().slice(0, 20),
        cast,
        props: String(parsed.props || "").trim().slice(0, 60),
        tension: Number.isFinite(tn) && tn >= 0 ? Math.min(100, Math.round(tn)) : null,
        turn: Number(turn) || 0
      };
    },
    /* ==================== 注入（AI 上下文） ==================== */
    /** 紧凑状态块（拼进提示词；无数据返回 null） */
    buildInjection() {
      var _a, _b;
      if (!this.hasData()) return null;
      const s = this.snap();
      const line = [];
      const stamp = (_b = (_a = window.LunarStamp) == null ? void 0 : _a.storyStampLine) == null ? void 0 : _b.call(_a);
      if (stamp) line.push(`纪年：${stamp}`);
      if (s.place) line.push(`地点：${s.place}`);
      if (s.time) line.push(`时辰：${s.time}`);
      if (s.weather) line.push(`氛围：${s.weather}`);
      if (s.cast.length) {
        line.push(`在场：${s.cast.map((c) => `${c.name}${c.at ? "（" + c.at + "）" : ""}${c.mood ? "·" + c.mood : ""}`).join("、")}`);
      }
      if (s.props) line.push(`台面道具：${s.props}`);
      return {
        role: "system",
        content: `【舞台现状（本段动笔前先对齐，严禁无故换景/换人/换时辰；转场须由剧情推动）】
${line.join("\n")}`
      };
    },
    /** 状态面板分区 HTML（一行摘要） */
    panelHTML() {
      var _a, _b;
      if (!this.hasData()) return "";
      const s = this.snap();
      const stamp = (_b = (_a = window.LunarStamp) == null ? void 0 : _a.storyStampLine) == null ? void 0 : _b.call(_a);
      const castStr = s.cast.length ? s.cast.map((c) => `${this.esc(c.name)}${c.mood ? `<i>${this.esc(c.mood)}</i>` : ""}`).join(" ") : "";
      return `<div class="ss-row" onclick="SceneState.open()" title="点击查看舞台快照详情">
                <span class="ss-label">🎬 舞台</span>
                <span class="ss-val">${this.esc(s.place || "未名地点")}${s.time ? " · " + this.esc(s.time) : ""}${s.weather ? " · " + this.esc(s.weather) : ""}</span>
                ${stamp ? `<span class="ss-stamp" title="本书纪年（工具箱可调历法节奏）">${this.esc(stamp)}</span>` : ""}
                ${castStr ? `<span class="ss-cast">在场：${castStr}</span>` : ""}
            </div>`;
    },
    /* ==================== UI：详情面板 ==================== */
    open() {
      var _a, _b, _c;
      (_a = document.getElementById("scenePanel")) == null ? void 0 : _a.remove();
      const s = this.snap();
      const hist = this.history();
      const stamp = (_c = (_b = window.LunarStamp) == null ? void 0 : _b.storyStampLine) == null ? void 0 : _c.call(_b);
      const body = `
                <div class="ssc-cur">
                    <div class="ssc-place">${this.esc(s.place || "未名地点")}</div>
                    <div class="ssc-meta">${stamp ? `<b class="ssc-stamp">${this.esc(stamp)}</b> · ` : ""}${this.esc(s.time || "时辰未定")}${s.weather ? " · " + this.esc(s.weather) : ""}${s.turn ? ` · 第 ${s.turn} 轮登记` : ""}${s.tension != null ? ` · 张力 ${s.tension}` : ""}</div>
                    ${s.cast.length ? `<div class="ssc-cast-title">在场人物</div>
                    ${s.cast.map((c) => `<div class="ssc-member">
                        <b>${this.esc(c.name || "？")}</b>
                        ${c.at ? `<span>📍 ${this.esc(c.at)}</span>` : ""}
                        ${c.wear ? `<span>👔 ${this.esc(c.wear)}</span>` : ""}
                        ${c.mood ? `<span>💭 ${this.esc(c.mood)}</span>` : ""}
                    </div>`).join("")}` : ""}
                    ${s.props ? `<div class="ssc-props">🎁 台面：${this.esc(s.props)}</div>` : ""}
                </div>
                ${hist.length ? `<div class="ssc-hist-title">历幕（${hist.length}）</div>
                ${hist.slice().reverse().map((h) => `<div class="ssc-hist-row">
                    <span class="ssc-h-turn">第${h.turn || "?"}轮</span>
                    <span>${this.esc(h.place || "未名")}${h.time ? " · " + this.esc(h.time) : ""}${Array.isArray(h.cast) && h.cast.length ? " · " + this.esc(h.cast.map((c) => c.name).join("、")) : ""}</span>
                </div>`).join("")}` : ""}
                <div class="ssc-note">舞台快照由变量AI每轮顺手登记（摘要官 > 变量AI > 主笔兜底）；动笔前注入提示词对齐场景，防止无故换景。点「重登本幕」可手动重跑。</div>
                <div class="ssc-actions">
                    <button class="ssc-btn" onclick="SceneState.retrack()">↺ 重登本幕</button>
                </div>`;
      const w = document.createElement("div");
      w.id = "scenePanel";
      w.innerHTML = `
            <div class="ssc-overlay" onclick="if(event.target===this)SceneState.close()">
                <div class="ssc-modal">
                    <div class="ssc-top"><b>🎬 舞台快照</b><span class="ssc-sub">BlazeTracker 式场景状态追踪</span>
                        <button class="ssc-x" onclick="SceneState.close()">✕</button></div>
                    <div class="ssc-body">${body}</div>
                </div>
            </div>`;
      document.body.appendChild(w);
      if (!document.getElementById("sceneStateStyle")) {
        const st = document.createElement("style");
        st.id = "sceneStateStyle";
        st.textContent = `
.ssc-overlay{position:fixed;top: 0; right: 0; bottom: 0; left: 0; inset: 0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.ssc-modal{width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:sscIn .3s ease both}
@keyframes sscIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ssc-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.ssc-top b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.ssc-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.ssc-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.ssc-x:hover{color:#e8dcc0}
.ssc-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.ssc-cur{background:rgba(0,0,0,.22);border:1px solid #c9a86a30;border-radius:12px;padding:14px 16px}
.ssc-place{font-size:15px;color:#e8dcc0;font-weight:600;letter-spacing:1px}
.ssc-meta{font-size:11.5px;color:#9a8c6e;margin-top:4px;letter-spacing:.5px}
.ssc-cast-title{font-size:11px;color:#c9a86a;letter-spacing:2px;margin:12px 0 6px}
.ssc-member{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:#bdb08e;padding:5px 0;border-bottom:1px dashed rgba(201,168,106,.14)}
.ssc-member b{color:#d8cba8;min-width:56px}
.ssc-member span{font-size:11px;color:#9a8c6e}
.ssc-props{font-size:11.5px;color:#9a8c6e;margin-top:10px}
.ssc-hist-title{font-size:11px;color:#c9a86a;letter-spacing:2px;margin:16px 0 8px}
.ssc-hist-row{display:flex;gap:10px;font-size:11.5px;color:#9a8c6e;padding:5px 10px;background:rgba(255,255,255,.025);border-radius:7px;margin-bottom:4px}
.ssc-h-turn{color:#c9a86a;min-width:52px;flex-shrink:0}
.ssc-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:13px}
.ssc-actions{margin-top:10px}
.ssc-btn{background:rgba(201,168,106,.14);border:1px solid #c9a86a44;color:#d8cba8;font-size:12px;padding:7px 13px;border-radius:8px;cursor:pointer;transition:all .2s}
.ssc-btn:hover{background:rgba(201,168,106,.26)}`;
        document.head.appendChild(st);
      }
      if (!document.getElementById("ssStampStyle")) {
        const st2 = document.createElement("style");
        st2.id = "ssStampStyle";
        st2.textContent = `
.ss-stamp{color:#c9a86a;font-size:10.5px;letter-spacing:1px;background:rgba(201,168,106,.08);border:1px solid #c9a86a2e;border-radius:6px;padding:1px 7px;margin-top:3px;display:inline-block}
.ssc-stamp{color:#e0a84c;font-weight:600;letter-spacing:1.5px}`;
        document.head.appendChild(st2);
      }
    },
    close() {
      var _a;
      (_a = document.getElementById("scenePanel")) == null ? void 0 : _a.remove();
    },
    /** 手动重登：取最近一段正文重跑 */
    async retrack() {
      var _a, _b, _c, _d, _e;
      const hist = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.conversationHistory) || [];
      let body = "";
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].role !== "assistant") continue;
        body = String(hist[i].content || "");
        break;
      }
      if (!body) {
        (_c = window.showToast) == null ? void 0 : _c.call(window, "没有可重登的正文", "info");
        return;
      }
      (_d = window.showToast) == null ? void 0 : _d.call(window, "正在重新登记本幕舞台状态…", "info");
      const ok = await this.track(body);
      (_e = window.showToast) == null ? void 0 : _e.call(window, ok ? "✓ 本幕舞台已重新登记" : "登记失败（接口未就绪或输出异常）", ok ? "success" : "error");
      if (ok) this.open();
    },
    /** 状态面板上的小徽标刷新（挂在面板渲染后） */
    renderBadge() {
      const host = document.getElementById("ssPanelBadge");
      if (!host) return;
      host.innerHTML = this.panelHTML();
      host.style.display = this.hasData() ? "" : "none";
      if (!document.getElementById("ssBadgeStyle")) {
        const st = document.createElement("style");
        st.id = "ssBadgeStyle";
        st.textContent = `
#ssPanelBadge{margin:2px 15px 12px;border:1px dashed rgba(201,168,106,.28);border-radius:10px;padding:8px 12px;background:rgba(201,168,106,.05);cursor:pointer;transition:all .2s}
#ssPanelBadge:hover{background:rgba(201,168,106,.12)}
.ss-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:11.5px;line-height:1.7}
.ss-label{color:#c9a86a;flex-shrink:0;letter-spacing:1px}
.ss-val{color:#d8cba8}
.ss-cast{width:100%;color:#9a8c6e;font-size:11px;padding-top:2px}
.ss-cast i{font-style:normal;color:#8a7d63;margin-left:4px}`;
        document.head.appendChild(st);
      }
    },
    /* ==================== 安装 ==================== */
    install() {
      if (this._installed) return;
      this._installed = true;
      document.addEventListener("story:turn-saved", (ev) => {
        setTimeout(() => {
          var _a, _b;
          const hist = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.conversationHistory) || [];
          let body = "";
          for (let i = hist.length - 1; i >= 0; i--) {
            if (hist[i].role !== "assistant") continue;
            body = String(hist[i].content || "");
            break;
          }
          if (body) this.track(body).catch(() => {
          });
        }, 3e3);
      });
      setTimeout(() => this.renderBadge(), 1200);
      console.log("[舞台] 已安装（每轮自动登记场景状态）");
    }
  };
  window.SceneState = SceneState;
})();
