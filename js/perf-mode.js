/**
 * YJPerf · 流畅模式（低配设备性能档）v3.55.3
 * ─ 目标：极低配置设备（1-2核 CPU / ≤2GB 内存 / 2G-3G 网络）无压力高速流畅运行。
 * ─ 做法：
 *   ① 自动检测低端设备（内存 / 核心数 / 省流慢网 / 系统减动效偏好）→ 自动开启；
 *   ② 手动开关（工具箱「⚡ 流畅模式」），localStorage 持久化，手动选择优先于自动检测；
 *   ③ 开启时全局降级：动画/过渡/毛玻璃/阴影/发光一键关停（CSS .low-spec），
 *      氛围粒子、庆典花雨等 JS 特效同步停摆——只留功能，不留负担。
 * ─ 理念：流畅模式不是"残缺模式"，是把预算全部留给内容与响应速度。
 */
(function () {
  "use strict";
  var KEY = "yunjingLowSpec"; // 'on' | 'off' | 未设置=自动检测

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  var YJPerf = {
    enabled: false,
    /** 低端设备探测：任一命中即视为低配 */
    detect() {
      var mem = navigator.deviceMemory || 0;            // GB，Chromium 系
      var cpu = navigator.hardwareConcurrency || 8;
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      var slowNet = !!(conn && (conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || "")));
      var lowMem = mem > 0 && mem <= 2;
      var lowCpu = cpu > 0 && cpu <= 2;
      return { lowMem: lowMem, lowCpu: lowCpu, slowNet: slowNet, hit: lowMem || lowCpu || slowNet };
    },
    /** 首次自举：手动选择 > 自动检测 */
    init() {
      var saved = lsGet(KEY);
      if (saved === "on") this.apply(true, true);
      else if (saved === "off") this.apply(false, true);
      else {
        var d = this.detect();
        if (d.hit) {
          this.apply(true, true);
          try {
            window.showToast && window.showToast("⚡ 检测到设备配置较低，已自动开启「流畅模式」（工具箱可关）", "info");
          } catch (e) { }
        }
      }
      return this;
    },
    /** 应用/解除降级（silent=true 不弹提示） */
    apply(on, silent) {
      this.enabled = !!on;
      var root = document.documentElement;
      if (root) root.classList.toggle("low-spec", this.enabled);
      /* 氛围粒子：关（开） */
      try {
        lsSet("ambParticle", this.enabled ? "off" : "on");
        if (window.Ambience) {
          if (this.enabled && window.Ambience.stop) window.Ambience.stop();
          else if (!this.enabled && window.Ambience.kick) window.Ambience.kick();
        }
      } catch (e) { }
      /* 庆典花雨：流畅模式下静默关闭（不覆盖用户已有偏好之外的恢复：仅在开启时关闭） */
      try {
        if (this.enabled && window.Celebration && window.Celebration.getSettings && window.Celebration.getSettings().on) {
          window.Celebration.saveSettings({ on: false });
        }
      } catch (e) { }
      if (!silent) {
        try {
          window.showToast && window.showToast(this.enabled
            ? "⚡ 流畅模式已开启：动效/毛玻璃/粒子全停，专攻速度"
            : "⚡ 流畅模式已关闭：视觉特效已恢复", "info");
        } catch (e) { }
      }
      try { window.dispatchEvent(new CustomEvent("yjperf", { detail: { on: this.enabled } })); } catch (e) { }
      return this.enabled;
    },
    /** 工具箱开关入口 */
    toggle() {
      var next = !this.enabled;
      lsSet(KEY, next ? "on" : "off");
      this.apply(next, false);
      try { window.Toolbox && window.Toolbox.syncPerfState && window.Toolbox.syncPerfState(); } catch (e) { }
      return next;
    }
  };

  window.YJPerf = YJPerf;

  /* 自举：DOM 就绪即生效（在首帧绘制前抢跑，避免低配机先渲染重特效再降级） */
  function boot() { try { YJPerf.init(); } catch (e) { } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
