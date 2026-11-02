/* =========================================================================
 * 云境 · 世界演化看板 WorldEvolutionUI（v3.78.0）
 * -------------------------------------------------------------------------
 * 演化引擎 WorldEvolution 的可视面板：时代阶段与演化度、势力格局（实力条+
 * 对你的态度）、区域态势（繁荣/动荡/归属）、演化中事件链、人物走向、演化日志。
 * 所有动态文本一律转义（势力名/区域名/事件文本来自 AI，防存储型 XSS）。
 * 纯展示 + 少量手动登记，不持有状态（状态归 WorldEvolution）。
 * ========================================================================= */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function EVO() { return window.WorldEvolution; }

  var STYLE_ID = "wevo-style";

  var CSS = `
.wevo-mask{position:fixed;inset:0;background:rgba(8,6,14,.62);backdrop-filter:blur(3px);z-index:9990;display:none;align-items:center;justify-content:center;padding:20px}
.wevo-mask.show{display:flex}
.wevo-panel{width:min(760px,96vw);max-height:86vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:linear-gradient(170deg,rgba(30,26,40,.98),rgba(20,18,28,.99));border:1px solid rgba(200,170,120,.22);
  box-shadow:0 24px 70px rgba(0,0,0,.6);color:#ece4d6}
.wevo-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.wevo-head h3{margin:0;font-size:15.5px;font-weight:600;letter-spacing:.4px}
.wevo-head .x{margin-left:auto;background:none;border:none;color:#b9ab96;font-size:19px;cursor:pointer;line-height:1;padding:2px 6px;border-radius:6px}
.wevo-head .x:hover{background:rgba(255,255,255,.08);color:#fff}
.wevo-body{overflow-y:auto;padding:14px 18px 20px;display:flex;flex-direction:column;gap:15px}
.wevo-era{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;
  background:linear-gradient(120deg,rgba(120,150,220,.16),rgba(200,170,120,.12));border:1px solid rgba(200,170,120,.2)}
.wevo-era .nm{font-size:14.5px;font-weight:600}
.wevo-era .sub{font-size:11.5px;opacity:.65;margin-top:2px}
.wevo-era .bar{margin-left:auto;width:190px}
.wevo-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}
.wevo-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#7fa8e8,#d8b878);transition:width .4s}
.wevo-sec-h{font-size:12px;letter-spacing:1.2px;opacity:.55;margin-top:2px}
.wevo-row{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.045);
  border:1px solid rgba(255,255,255,.055);font-size:12.5px}
.wevo-row .n{font-weight:600;min-width:88px}
.wevo-row .pw{width:96px;flex:0 0 auto}
.wevo-row .st{font-size:11.5px;opacity:.8}
.wevo-row .rel{margin-left:auto;font-size:11.5px;padding:2px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.14)}
.wevo-row .del{background:none;border:none;color:#8a7f70;cursor:pointer;font-size:13px;padding:0 3px}
.wevo-row .del:hover{color:#e07070}
.wevo-row .note{font-size:11px;opacity:.55;flex:1 1 100%;margin-top:-2px}
.rel-ally{color:#8fd9a8;border-color:rgba(143,217,168,.4)!important;background:rgba(143,217,168,.09)}
.rel-hostile{color:#e58181;border-color:rgba(229,129,129,.4)!important;background:rgba(229,129,129,.09)}
.rel-neutral{color:#c9bda6}
.wevo-ev{display:flex;gap:9px;padding:7px 11px;border-radius:9px;background:rgba(255,255,255,.04);font-size:12.5px;align-items:flex-start}
.wevo-ev .lv{flex:0 0 auto;font-size:11px;padding:1px 7px;border-radius:7px;background:rgba(255,255,255,.1)}
.wevo-ev.lv3 .lv{background:rgba(229,129,129,.22);color:#f0a0a0}
.wevo-ev.lv2 .lv{background:rgba(224,168,76,.2);color:#e8c07a}
.wevo-ev .rl{font-size:10.5px;opacity:.45;flex:0 0 auto}
.wevo-empty{font-size:12.5px;opacity:.5;padding:14px 6px;text-align:center}
.wevo-form{display:flex;gap:7px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(255,255,255,.07)}
.wevo-form input{flex:1 1 120px;padding:7px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:inherit;font-size:12.5px}
.wevo-form button{padding:7px 14px;border-radius:9px;border:none;background:#6d7fd8;color:#fff;cursor:pointer;font-size:12.5px}
.wevo-form button.ghost{background:rgba(255,255,255,.1)}
.wevo-log{font-size:11.5px;opacity:.62;line-height:1.9}
.wevo-tip{font-size:11.5px;opacity:.5;line-height:1.7}
`;

  var WorldEvolutionUI = {
    open: function () {
      if (!EVO()) { try { if (window.showToast) showToast("世界演化引擎未加载", "error"); } catch (e) {} return; }
      this._ensure();
      var m = document.getElementById("wevoMask");
      if (m) m.classList.add("show");
      this.render();
    },
    close: function () { var m = document.getElementById("wevoMask"); if (m) m.classList.remove("show"); },
    isOpen: function () { var m = document.getElementById("wevoMask"); return !!(m && m.classList.contains("show")); },
    toggle: function () { this.isOpen() ? this.close() : this.open(); },

    _ensure: function () {
      if (document.getElementById(STYLE_ID)) return;
      var s = document.createElement("style");
      s.id = STYLE_ID; s.textContent = CSS;
      document.head.appendChild(s);

      var mask = document.createElement("div");
      mask.id = "wevoMask"; mask.className = "wevo-mask";
      mask.innerHTML = '<div class="wevo-panel">' +
        '<div class="wevo-head"><h3>🌏 世界演化</h3><button class="x" onclick="WorldEvolutionUI.close()" aria-label="关闭">✕</button></div>' +
        '<div class="wevo-body" id="wevoBody"></div></div>';
      mask.addEventListener("click", function (e) { if (e.target === mask) window.WorldEvolutionUI.close(); });
      document.body.appendChild(mask);
    },

    render: function () {
      var box = document.getElementById("wevoBody");
      if (!box || !EVO()) return;
      var E = EVO();
      var s = E.state();
      var stage = E.stageNow();
      var evo = E.evolution();
      var out = [];

      /* 时代 */
      out.push('<div class="wevo-era">' +
        '<div><div class="nm">🕰 第 ' + stage + ' 阶段「' + esc(E.stageLabel(stage)) + '」</div>' +
        '<div class="sub">演化度 ' + evo + '/100 · 第 ' + num(s.round) + ' 回 · 阈值 34 / 67</div></div>' +
        '<div class="bar"><div class="wevo-bar"><i style="width:' + Math.max(0, Math.min(100, evo)) + '%"></i></div></div>' +
        '</div>');

      /* 势力 */
      out.push('<div class="wevo-sec-h">势力格局</div>');
      if (!s.factions.length) {
        out.push('<div class="wevo-empty">尚未探明势力——推演一轮或手动登记。</div>');
      } else {
        s.factions.forEach(function (f) {
          var rel = E.relationOf(f.name);
          var cls = rel >= 25 ? "rel-ally" : rel <= -25 ? "rel-hostile" : "rel-neutral";
          var arrow = num(f.trend) > 3 ? "↑" : num(f.trend) < -3 ? "↓" : "→";
          out.push('<div class="wevo-row">' +
            '<span class="n">' + esc(f.name) + '</span>' +
            '<span class="pw"><span class="wevo-bar"><i style="width:' + Math.max(0, Math.min(100, num(f.power))) + '%"></i></span></span>' +
            '<span class="st">' + Math.round(num(f.power)) + arrow + ' · ' + esc(f.status || "") + '</span>' +
            '<span class="rel ' + cls + '">对你 ' + esc(E.relationWord(rel)) + (rel ? "(" + (rel > 0 ? "+" : "") + rel + ")" : "") + '</span>' +
            '<button class="del" onclick="WorldEvolution.removeFaction(\'' + esc(f.name).replace(/'/g, "") + '\');WorldEvolutionUI.render()" title="移除">✕</button>' +
            (f.note ? '<span class="note">' + esc(f.note) + '</span>' : '') +
            '</div>');
        });
      }

      /* 区域 */
      out.push('<div class="wevo-sec-h">区域态势</div>');
      if (!s.regions.length) {
        out.push('<div class="wevo-empty">尚未探明区域——主笔回报或手动登记后开始演化。</div>');
      } else {
        s.regions.forEach(function (r) {
          var unrest = num(r.unrest);
          var tone = unrest >= 75 ? "#e58181" : unrest >= 45 ? "#e0a84c" : "#8fd9a8";
          out.push('<div class="wevo-row">' +
            '<span class="n">' + esc(r.name) + '</span>' +
            '<span class="st">' + (r.control ? esc(r.control) + ' 控制 · ' : '无主 · ') + '繁荣 ' + Math.round(num(r.prosperity)) +
            ' · 动荡 <b style="color:' + tone + '">' + Math.round(unrest) + '</b></span>' +
            '<button class="del" onclick="WorldEvolution.removeRegion(\'' + esc(r.name).replace(/'/g, "") + '\');WorldEvolutionUI.render()" title="移除">✕</button>' +
            (r.note ? '<span class="note">' + esc(r.note) + '</span>' : '') +
            '</div>');
        });
      }

      /* 事件链 */
      out.push('<div class="wevo-sec-h">演化中事件</div>');
      if (!s.events.length) {
        out.push('<div class="wevo-empty">暂无未了结事件。</div>');
      } else {
        s.events.slice(0, 8).forEach(function (e) {
          out.push('<div class="wevo-ev lv' + num(e.level, 1) + '">' +
            '<span class="lv">' + (num(e.level, 1) === 3 ? "震动" : num(e.level, 1) === 2 ? "要事" : "小事") + '</span>' +
            '<span>' + esc(e.text) + '</span>' +
            '<span class="rl">第' + num(e.r) + '回' + (e.resolved ? ' · 已了结' : '') + '</span>' +
            '</div>');
        });
      }

      /* 人物走向 */
      out.push('<div class="wevo-sec-h">人物走向</div>');
      if (!s.arcs.length) {
        out.push('<div class="wevo-empty">尚未记录人物弧。</div>');
      } else {
        s.arcs.slice(0, 10).forEach(function (a) {
          out.push('<div class="wevo-row">' +
            '<span class="n">' + esc(a.name) + '</span>' +
            '<span class="st">' + (a.role ? esc(a.role) + ' · ' : '') + (a.goal ? '目标 ' + esc(a.goal) : '') + '</span>' +
            (a.status ? '<span class="rel rel-neutral">' + esc(a.status) + '</span>' : '') +
            (a.note ? '<span class="note">' + esc(a.note) + '</span>' : '') +
            '</div>');
        });
      }

      /* 手动登记 */
      out.push('<div class="wevo-form">' +
        '<input id="wevoFactionName" placeholder="登记势力名（如 云岚宗）" maxlength="20">' +
        '<button onclick="WorldEvolutionUI.addFaction()">＋ 势力</button>' +
        '<input id="wevoRegionName" placeholder="登记区域名（如 乌坦城）" maxlength="20">' +
        '<button onclick="WorldEvolutionUI.addRegion()">＋ 区域</button>' +
        '<button class="ghost" onclick="WorldEvolution.syncStage();WorldEvolutionUI.render()">↻ 同步阶段</button>' +
        '</div>');

      /* 日志 */
      if (s.log && s.log.length) {
        out.push('<div class="wevo-sec-h">演化日志</div><div class="wevo-log">' +
          s.log.slice(0, 10).map(function (l) { return '· 第' + num(l.r) + '回 ' + esc(l.text); }).join("<br>") +
          '</div>');
      }

      out.push('<div class="wevo-tip">势力实力与区域动荡每回合自动推演；主笔按《演化回报契约》回报的剧情后果会直接落进这张表，并注入后续正文与前情。</div>');

      box.innerHTML = out.join("");
    },

    addFaction: function () {
      var el = document.getElementById("wevoFactionName");
      var n = el && el.value ? el.value.trim() : "";
      if (!n) { try { if (window.showToast) showToast("请先填势力名", "error"); } catch (e) {} return; }
      if (window.WorldEvolution) WorldEvolution.addFaction(n);
      if (el) el.value = "";
      this.render();
    },
    addRegion: function () {
      var el = document.getElementById("wevoRegionName");
      var n = el && el.value ? el.value.trim() : "";
      if (!n) { try { if (window.showToast) showToast("请先填区域名", "error"); } catch (e) {} return; }
      if (window.WorldEvolution) WorldEvolution.addRegion(n);
      if (el) el.value = "";
      this.render();
    }
  };

  window.WorldEvolutionUI = WorldEvolutionUI;
})();
