/* ============================================================================
 * NPC 编年史面板 · npc-chronicle-ui.js
 * ----------------------------------------------------------------------------
 * 云境自有视觉的独立浮层面板，读取 NPCBridge / NPCChronicle 的真实数据渲染：
 *   - 角色列表 + 四轴态度条
 *   - 生平经历时间线
 *   - 只增不删档案库统计
 *   - 离场自治状态与驱动力判定
 * 只调用自有模块的公开只读接口 / 桥接 API，不改任何核心运行时。
 * 版权：本项目独立编写，视觉与文案均为云境自有风格。
 * ========================================================================== */
(function () {
  "use strict";
  var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function NC() { return G.NPCChronicle || null; }
  function B() { return G.NPCBridge || null; }
  function WR() { return G.WorldRuntime || null; }

  function axisBar(label, v, color) {
    var w = Math.max(0, Math.min(100, Number(v) || 0));
    return '<div class="nc-ax"><span>' + label + '</span>' +
      '<div class="nc-ax-track"><i style="width:' + w + '%;background:' + color + '"></i></div>' +
      '<b>' + w + '</b></div>';
  }

  function rosterHTML() {
    var WRx = WR(), NCx = NC();
    if (!WRx || !WRx.NPC || !NCx) return '<p class="nc-empty">角色运行时尚未就绪</p>';
    var list = WRx.NPC.list ? WRx.NPC.list() : [];
    if (!list.length) return '<p class="nc-empty">还没有登场角色。剧情推进后，角色会在此建档。</p>';
    return list.map(function (e) {
      var rec = NCx.ensure({
        name: e.name,
        npcTag: e.npcTag || 'contractor',
        disposition: {
          trust: Number(e.trust) || 0,
          favor: Number(e.好感) || 0,
          esteem: Number(e.敬重) || 0,
          guard: Number(e.戒备) || 0
        }
      });
      if (Array.isArray(e.chronicleDeeds)) rec.deeds = e.chronicleDeeds;
      var d = rec.disposition;
      var deeds = (rec.deeds || []).slice(-4).reverse().map(function (x) {
        return '<li><i>' + esc(x.at || '') + '</i>' + esc(x.text) + '</li>';
      }).join('') || '<li class="nc-empty">暂无生平记录</li>';
      var tagLabel = { contractor: '契约者', native: '土著', companion: '同伴', pet: '随从' }[rec.npcTag] || rec.npcTag;
      return '<div class="nc-card">' +
        '<div class="nc-hd"><b>' + esc(e.name) + '</b><em>' + esc(tagLabel) + (e.isBond ? ' · 羁绊' : '') + '</em></div>' +
        '<div class="nc-axes">' +
          axisBar('信任', d.trust, '#7fd6a8') + axisBar('好感', d.favor, '#c9a86a') +
          axisBar('敬重', d.esteem, '#8fb8d8') + axisBar('戒备', d.guard, '#e08a8a') +
        '</div>' +
        '<ul class="nc-deeds">' + deeds + '</ul>' +
      '</div>';
    }).join('');
  }

  function vaultHTML() {
    var NCx = NC();
    if (!NCx) return '';
    var size = NCx.vaultSize();
    return '<div class="nc-vault">📚 只增不删档案库：<b>' + size + '</b> 份快照' +
      (B() ? ' · 本轮自治 ' + B().stats().autonomyTicks + ' 次 / 静滞拦截 ' + B().stats().gated + ' 次' : '') + '</div>';
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'nc-overlay';
    wrap.id = 'ncOverlay';
    wrap.innerHTML =
      '<div class="nc-panel" role="dialog" aria-label="角色编年史">' +
        '<div class="nc-top"><h2>📜 角色编年史</h2>' +
          '<button class="nc-close" id="ncClose" aria-label="关闭">✕</button></div>' +
        '<p class="nc-sub">四轴态度 · 生平经历 · 离场动向 · 只增不删档案</p>' +
        vaultHTML() +
        '<div class="nc-list" id="ncList">' + rosterHTML() + '</div>' +
        '<div class="nc-foot">数据来自当前存档的角色运行时 · 云境原生实现</div>' +
      '</div>';
    return wrap;
  }

  var API = {
    open: function () {
      if (document.getElementById('ncOverlay')) return;
      var el = build();
      document.body.appendChild(el);
      var close = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
      var btn = document.getElementById('ncClose');
      if (btn) btn.addEventListener('click', close);
      // 打开时先同步一次最新数据
      try { if (B()) B().syncAll(); } catch (e) {}
      var list = document.getElementById('ncList');
      if (list) {
        try {
          var fresh = build().querySelector('#ncList');
          if (fresh) list.innerHTML = fresh.innerHTML;
        } catch (e) {}
      }
    },
    close: function () {
      var el = document.getElementById('ncOverlay');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  };

  G.NPCChronicleUI = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
