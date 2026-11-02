/**
 * 小云动态引擎 v3.61.0（chibi-anim.js）
 * 三层架构：idle 视频循环（主）→ 关键动作帧动画（叠加）→ 静图回退（兜底）
 * 资源目录：assets/chibi/（idle-<style>.mp4 + <action>.json 帧列表 + manifest.json）
 * 设计原则：
 *   1. 零侵入：不改动 mo-chibi.js 现有 DOM 结构与交互，只替换 .mc-float 内的
 *      <img> 为 <video>/<img> 混合层；manifest 缺失时自动回退到原静图
 *   2. 性能守卫：document.hidden 时暂停 video；low-spec 模式禁用视频；
 *      同形态视频只建一个 <video> 元素，切换形态才重建
 *   3. 帧动画：jump/spell 等关键动作用帧序列播放（CSS opacity 切换），
 *      播放期间暂停 idle 视频，播完回 idle
 * 由 lazy-boot demand 组加载；依赖 window.MoChibi（mo-chibi.js batch 组先于它）
 */
(function () {
  "use strict";
  if (window.ChibiAnim) return;

  var CHIBI_DIR = "assets/chibi/";
  var VER = "3.61.0";

  var ChibiAnim = {
    VERSION: VER,
    _manifest: null,
    _manifestTried: false,
    _video: null,
    _videoStyle: null,
    _frames: {},
    _framesLoading: {},
    _actionTimers: {},
    _frameImg: null,

    /** 拉 manifest（一次）：{idle:{style:"idle-x.mp4"},actions:{jump:"jump.json"}} */
    manifest() {
      if (this._manifest) return Promise.resolve(this._manifest);
      if (this._manifestTried) return Promise.resolve(this._manifest || {});
      this._manifestTried = true;
      return fetch(CHIBI_DIR + "manifest.json?v=" + VER)
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (m) {
          ChibiAnim._manifest = m || {};
          return ChibiAnim._manifest;
        });
    },

    _lowSpec() {
      return document.documentElement.classList.contains("low-spec");
    },

    /** 某形态是否有 idle 视频 */
    hasIdle(style) {
      var m = this._manifest;
      return !!(m && m.idle && m.idle[style]);
    },

    /**
     * 给 #moChibi 的 .mc-float 挂上动态层。
     * 幂等：同形态重复调用不重建；换形态时重建 video。
     * 回退：无 manifest / 无视频 / low-spec → 保持原 <img>（静图 + CSS 漂浮）
     */
    mount() {
      var box = document.getElementById("moChibi");
      if (!box) return;
      var float = box.querySelector(".mc-float");
      if (!float) return;
      var style = (window.MoChibi && MoChibi.currentStyle()) || "luo";

      if (this._lowSpec()) return; // 低配机：保持静图
      var self = this;
      this.manifest().then(function (m) {
        if (!m.idle || !m.idle[style]) return; // 无视频 → 静图兜底
        self._ensureVideo(float, style, m.idle[style]);
      });
    },

    /** 重建/更新 idle 视频（形态切换时调用） */
    _ensureVideo(float, style, file) {
      var self = this;
      // 同形态且视频还在 → 不重建
      if (this._video && this._videoStyle === style && this._video.isConnected) return;
      // 旧视频摘掉
      if (this._video) {
        try { this._video.pause(); } catch (e) {}
        this._video.remove();
        this._video = null;
      }
      var img = document.createElement("video");
      img.className = "mc-video";
      img.muted = true;
      img.loop = true;
      img.playsInline = true;
      img.autoplay = true;
      img.setAttribute("playsinline", "true");
      img.preload = "auto";
      img.src = CHIBI_DIR + file + "?v=" + VER;
      // 加载失败 → 移除，回退静图
      img.addEventListener("error", function () {
        if (self._video === img) {
          img.remove();
          self._video = null;
        }
      });
      img.addEventListener("loadeddata", function () {
        try {
          if (!document.hidden) img.play().catch(function () {});
        } catch (e) {}
      });
      float.insertBefore(img, float.firstChild);
      this._video = img;
      this._videoStyle = style;
      // 隐藏静图（保留在 DOM 里作回退）
      var still = float.querySelector(".mc-img");
      if (still) still.style.display = "none";
      // 页面隐藏时暂停（省电）；恢复时播放
      if (!this._visHandler) {
        this._visHandler = function () {
          var v = self._video;
          if (!v) return;
          if (document.hidden) { v.pause(); }
          else { v.play().catch(function () {}); }
        };
        document.addEventListener("visibilitychange", this._visHandler);
      }
      try { if (!document.hidden) img.play().catch(function () {}); } catch (e) {}
    },

    /** 形态切换时调（MoChibi.setStyle 钩子） */
    onStyleChange(style) {
      var box = document.getElementById("moChibi");
      if (!box) return;
      var float = box.querySelector(".mc-float");
      if (!float) return;
      var self = this;
      this.manifest().then(function (m) {
        if (m.idle && m.idle[style]) {
          self._ensureVideo(float, style, m.idle[style]);
        } else if (self._video) {
          // 新形态无视频 → 回退静图
          self._video.remove();
          self._video = null;
          var still = float.querySelector(".mc-img");
          if (still) still.style.display = "";
        }
      });
    },

    /**
     * 播放关键动作帧动画（jump/spell...）
     * 帧文件 <action>.json = ["action-f0.png","action-f1.png",...]
     * 播放期间暂停 idle 视频，逐帧切换 overlay <img>，播完回 idle
     */
    playAction(name) {
      var self = this;
      var box = document.getElementById("moChibi");
      if (!box || this._lowSpec()) {
        // 无动态资源时回退原 CSS 动画
        if (box && window.MoChibi) MoChibi.playAnim("mc-hop", 700);
        return;
      }
      var float = box.querySelector(".mc-float");
      if (!float) return;
      if (this._actionTimers[name]) return; // 同动作不重入

      // 首次拉帧列表
      var loader = this._framesLoading[name] || this.manifest().then(function (m) {
        var f = m.actions && m.actions[name];
        if (!f) return null;
        return fetch(CHIBI_DIR + f + "?v=" + VER).then(function (r) { return r.ok ? r.json() : null; });
      });
      this._framesLoading[name] = loader;
      loader.then(function (files) {
        if (!files || !files.length) {
          // 无帧 → 回退 CSS 动画
          if (window.MoChibi) MoChibi.playAnim(name === "jump" ? "mc-hop" : "mc-twirl", 800);
          return;
        }
        self._playFrames(float, files, name);
      }).catch(function () {});
    },

    _playFrames(float, files, name) {
      var self = this;
      // 暂停 idle 视频
      if (this._video) { try { this._video.pause(); } catch (e) {} }
      // 帧 overlay
      var overlay = float.querySelector(".mc-frame");
      if (!overlay) {
        overlay = document.createElement("img");
        overlay.className = "mc-frame";
        overlay.setAttribute("draggable", "false");
        float.appendChild(overlay);
      }
      this._frameImg = overlay;
      var i = 0;
      var FPS = 8; // 8fps 手感
      var step = function () {
        if (i < files.length) {
          overlay.src = CHIBI_DIR + files[i] + "?v=" + VER;
          i++;
          self._actionTimers[name] = setTimeout(step, 1000 / FPS);
        } else {
          // 播完：隐藏 overlay，恢复 idle
          overlay.style.display = "none";
          if (self._video && !document.hidden) {
            try { self._video.play().catch(function () {}); } catch (e) {}
          }
          delete self._actionTimers[name];
        }
      };
      overlay.style.display = "";
      step();
    }
  };

  // ---- 接钩子：MoChibi.setStyle 后自动换动态层 ----
  function hookMoChibi() {
    var M = window.MoChibi;
    if (!M) return;
    if (M._animHooked) return;
    M._animHooked = true;
    var origApply = M.applyStyle;
    M.applyStyle = function () {
      if (origApply) origApply.call(this);
      try { ChibiAnim.onStyleChange(this.currentStyle()); } catch (e) {}
    };
    var origPlay = M.playAnim;
    M.playAnim = function (cls, ms) {
      // 动作类 CSS 动画 → 优先帧动画
      var map = { "mc-hop": "jump", "mc-twirl": "spell" };
      if (map[cls] && ChibiAnim.hasIdle(this.currentStyle ? this.currentStyle() : "luo")) {
        try { ChibiAnim.playAction(map[cls]); } catch (e) {}
      }
      if (origPlay) origPlay.call(this, cls, ms);
    };
  }

  window.ChibiAnim = ChibiAnim;

  // 启动：等 MoChibi 的 DOM 建好（batch 组先于 demand 组，这里只是双保险）
  function boot() {
    hookMoChibi();
    ChibiAnim.mount();
    // 形态随机变化也监听（setStyle 已钩，这里补 toggleStyle 路径）
    setInterval(function () {
      if (!document.hidden) ChibiAnim.mount(); // 幂等
    }, 15000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    setTimeout(boot, 300); // 给 mo-chibi ensureDOM 一点时间
  }
})();
