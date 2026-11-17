(function() {
  "use strict";
  const KEY = "storyCelebration";
  const THROTTLE_MS = 2500;
  const GOLD = ["#e8c97a", "#c9a86a", "#fff2c4", "#d4af37", "#a8842f"];
  const RED_GOLD = ["#e0a84c", "#ff6b81", "#e8c97a", "#c9a86a"];
  const Celebration = {
    _lastFire: {},
    /* ==================== 设置 ==================== */
    getSettings() {
      try {
        const o = JSON.parse(localStorage.getItem(KEY) || "{}");
        return { on: o.on !== false };
      } catch (e) {
        return { on: true };
      }
    },
    saveSettings(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ on: s.on !== false }));
      } catch (e) {
      }
    },
    toggle() {
      var _a;
      const s = this.getSettings();
      s.on = !s.on;
      this.saveSettings(s);
      (_a = window.showToast) == null ? void 0 : _a.call(window, s.on ? "🎉 庆典特效已开启：成就与金榜将有花雨" : "🎉 庆典特效已关闭", "info");
      if (s.on) this.fire("dice");
      return s.on;
    },
    isEnabled() {
      return this.getSettings().on;
    },
    /* ==================== 特效分发 ==================== */
    ready() {
      return typeof window.confetti === "function";
    },
    /** 主入口：fire('seal' | 'rank' | 'dice' | 'boost') */
    fire(kind) {
      if (!this.getSettings().on) return false;
      if (window.YJPerf && window.YJPerf.enabled) return false; /* v3.55.3 流畅模式停花雨 */
      if (!this.ready()) return false;
      const now = Date.now();
      if (now - (this._lastFire[kind] || 0) < THROTTLE_MS) return false;
      this._lastFire[kind] = now;
      try {
        (this["_fx_" + kind] || this._fx_dice).call(this);
        return true;
      } catch (e) {
        return false;
      }
    },
    /* ==================== 四种编排 ==================== */
    /** 成就解锁：座底金色花雨 + 0.15s 后第二波（跟印章落下同拍） */
    _fx_seal() {
      const c = window.confetti;
      c({ particleCount: 80, spread: 72, startVelocity: 42, origin: { x: 0.5, y: 0.72 }, colors: GOLD, scalar: 1.05, ticks: 230, zIndex: 9998 });
      setTimeout(() => c({ particleCount: 45, spread: 100, startVelocity: 34, origin: { x: 0.5, y: 0.78 }, colors: GOLD, scalar: 0.9, ticks: 200, zIndex: 9998 }), 150);
    },
    /** 金榜刷新：左右两侧三连发金红礼炮（落雷音效由 game-layer 自理） */
    _fx_rank() {
      const c = window.confetti;
      const shot = (x, angle) => c({ particleCount: 60, angle, spread: 58, startVelocity: 52, origin: { x, y: 0.8 }, colors: RED_GOLD, scalar: 1.1, ticks: 260, zIndex: 9998 });
      shot(0.12, 60);
      shot(0.88, 120);
      setTimeout(() => {
        shot(0.1, 60);
        shot(0.9, 120);
      }, 280);
      setTimeout(() => {
        shot(0.14, 60);
        shot(0.86, 120);
      }, 560);
    },
    /** 命运骰：一撮星屑（克制） */
    _fx_dice() {
      window.confetti({ particleCount: 26, spread: 55, startVelocity: 26, origin: { x: 0.5, y: 0.55 }, colors: GOLD, scalar: 0.7, ticks: 140, zIndex: 9998 });
    },
    /** 境界突破 / 大事件：全屏金色礼炮（world-seals 等外部调用） */
    _fx_boost() {
      const c = window.confetti;
      c({ particleCount: 130, spread: 110, startVelocity: 48, origin: { x: 0.5, y: 0.6 }, colors: GOLD, scalar: 1.15, ticks: 280, zIndex: 9998 });
      setTimeout(() => c({ particleCount: 70, spread: 150, startVelocity: 38, origin: { x: 0.5, y: 0.5 }, colors: GOLD, scalar: 1, ticks: 240, zIndex: 9998 }), 220);
      setTimeout(() => c({ particleCount: 60, spread: 160, startVelocity: 30, origin: { x: 0.5, y: 0.45 }, colors: RED_GOLD, scalar: 0.95, ticks: 240, zIndex: 9998 }), 460);
    }
  };
  window.Celebration = Celebration;
})();
