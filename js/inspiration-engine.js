const StoryInspiration = {
  enabled: false,
  STORE_KEY: "storyInspirationEnabled",
  isEnabled() {
    return this.enabled;
  },
  /**
   * v1.6.9 T2-⑫：开关状态持久化——旧版 enabled 只存在内存里，
   * 刷新/重开页面后自动回到关闭态，用户每场都得手动再开。
   * 由 studio.html 初始化时调用（存在即恢复，无需确认框打扰）。
   */
  init() {
    try {
      if (localStorage.getItem(this.STORE_KEY) === "1") {
        this.enabled = true;
        const btn = document.getElementById("inspirationBtn");
        if (btn) btn.classList.add("active");
        const tbState = document.getElementById("tbInspState");
        if (tbState) {
          tbState.textContent = "开";
          tbState.classList.add("on");
        }
      }
    } catch (e) {
    }
  },
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(this.STORE_KEY, this.enabled ? "1" : "0");
    } catch (e) {
    }
    const btn = document.getElementById("inspirationBtn");
    if (btn) btn.classList.toggle("active", this.enabled);
    const tbState = document.getElementById("tbInspState");
    if (tbState) {
      tbState.textContent = this.enabled ? "开" : "关";
      tbState.classList.toggle("on", this.enabled);
    }
    window.StoryResponseHandler.renderSystemMessage(
      this.enabled ? "🌌 灵感引擎已开启：此后每 3 轮正文将自动送来 3 条支线灵感，点击即可采纳注入。" : "🌌 灵感引擎已关闭。",
      "info"
    );
    return this.enabled;
  },
  /** 生成灵感（manual=true 时由按钮触发；turnIdx：触发时刻捕获的轮号 T2-⑫） */
  async run(manual = true, turnIdx = null) {
    const fw = window.storyFramework;
    if (fw.isProcessing && manual) return;
    if (this._running) return;
    this._running = true;
    try {
      if (!fw.isApiConfigured()) {
        if (manual) fw.guideToConfig();
        return;
      }
      try {
        const reply = await callInspirationEngine();
        this.renderInspirations(reply, turnIdx);
      } catch (err) {
        if (manual) window.StoryResponseHandler.renderSystemMessage(`⚠ 灵感引擎调用失败：${err.message}`, "error");
      }
    } finally {
      this._running = false;
    }
  },
  /** 渲染灵感卡（turnIdx：卡片归属轮次——异步完成时用户可能已进入下一轮） */
  renderInspirations(reply, turnIdx = null) {
    var _a, _b;
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const lines = String(reply).split("\n").map((l) => l.trim()).filter(Boolean);
    const items = [];
    for (const l of lines) {
      const m = l.match(/^(?:\d+[.、)）]|[-•*])\s*(.+)/);
      if (m && m[1].length > 6) items.push(m[1].trim());
    }
    if (!items.length) items.push(reply.trim().slice(0, 80));
    const card = document.createElement("div");
    card.className = "message-card inspiration-card";
    card.innerHTML = `
            <div class="inspiration-title">🌌 灵感引擎 · 支线脉冲（远方正在发生…）</div>
            ${items.slice(0, 4).map((t, i) => `
                <button class="inspiration-item" onclick="StoryInspiration.adopt(this)" data-text="${window.StoryResponseHandler.escapeAttr(t)}">
                    ${i + 1}. ${window.StoryResponseHandler.escapeHtml(t)}
                    <span class="adopt-tag">采纳</span>
                </button>`).join("")}
            <div class="inspiration-note">点击任意灵感即采纳：后续章节将自然融入该支线（不采纳则忽略，不影响主线）。</div>
        `;
    (_b = (_a = window.StoryResponseHandler) == null ? void 0 : _a.tagTurnCard) == null ? void 0 : _b.call(_a, card, turnIdx != null ? turnIdx : void 0);
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  },
  /** 采纳灵感：写入 state.inspirations，后续构建上下文时注入 */
  adopt(btn) {
    var _a;
    const text = btn.getAttribute("data-text");
    const fw = window.storyFramework;
    fw.storyState.inspirations = fw.storyState.inspirations || [];
    fw.storyState.inspirations.push(text);
    if (fw.storyState.inspirations.length > 5) fw.storyState.inspirations.shift();
    fw.saveStory();
    btn.classList.add("adopted");
    (_a = btn.querySelector(".adopt-tag")) == null ? void 0 : _a.remove();
    window.StoryResponseHandler.renderSystemMessage(`✓ 灵感已采纳：${text.slice(0, 50)}…（将在后续章节自然融入）`, "success");
  }
};
window.StoryInspiration = StoryInspiration;
