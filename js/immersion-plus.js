const ImmersionPlus = function() {
  "use strict";
  const CFG_KEY = "immPlusCfg";
  const DEFAULTS = { page: true, dramatic: true, nextHook: true, echo: true, death: true, hotkeys: true };
  function cfg() {
    try {
      const o = JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
      return Object.assign({}, DEFAULTS, o && typeof o === "object" ? o : {});
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function setCfg(k) {
    const c = cfg();
    c[k] = !c[k];
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(c));
    } catch (e) {
    }
    return c[k];
  }
  function esc(s) {
    return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function firstSentence(text, max) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const m = t.match(/^[^。！？!?]{2,}[。！？!?]?/);
    const s = (m ? m[0] : t.slice(0, max)).trim();
    return s.length > max ? s.slice(0, max) + "…" : s;
  }
  function sfx(name) {
    try {
      window.ImmersiveSuite && ImmersiveSuite._audio && ImmersiveSuite._audio(name);
    } catch (e) {
    }
  }
  /* v3.53.0：模型常自作主张给标记加前缀（实测 agnes-3.0-flash 输出 "(cho: next: …)"），
     旧正则只认 "(next: …)" 于是整段标记落进正文。这里允许括号内 1~10 字符的任意前缀词。 */
  const PFX = '(?:[A-Za-z]{2,10}|[\u4e00-\u9fa5]{1,4})?\\s*[.:：]\\s*';
  const NEXT_RE = new RegExp('[(【]\\s*(?:' + PFX + ')?(?:next|下回|预告)\\s*[:：]\\s*([^\\n)】]{2,80}?)\\s*[)】]', 'i');
  const OVER_RE = new RegExp('[(【]\\s*(?:' + PFX + ')?(?:gameover|终局|殒命)\\s*[:：]\\s*([^\\n)】]{2,80}?)\\s*[)】]', 'i');
  const ECHO_RE = new RegExp('[(【]\\s*(?:' + PFX + ')?(?:echo|回响|追忆)\\s*[:：]\\s*([^\\n)】]{2,40}?)\\s*[)】]', 'gi');
  function extractHooks(reply) {
    const s = String(reply || "");
    const nm = s.match(NEXT_RE), om = s.match(OVER_RE);
    const echoes = [];
    let m;
    ECHO_RE.lastIndex = 0;
    while ((m = ECHO_RE.exec(s)) !== null) echoes.push(m[1].trim());
    return { next: nm ? nm[1].trim() : "", gameover: om ? om[1].trim() : "", echoes };
  }
  function stripHookMarkers(text) {
    let out = String(text || "");
    /* ① 带前缀的演出标记（(cho: next: …)）—— 与 extractHooks 同源，先剥 */
    out = out.replace(/[(【]\s*(?:[A-Za-z]{2,10}|[\u4e00-\u9fa5]{1,4})?\s*[.:：]\s*(?:next|下回|预告)\s*[:：]\s*[^\n)】]{0,80}?\s*[)】]/gi, "");
    out = out.replace(/[(【]\s*(?:[A-Za-z]{2,10}|[\u4e00-\u9fa5]{1,4})?\s*[.:：]\s*(?:gameover|终局|殒命)\s*[:：]\s*[^\n)】]{0,80}?\s*[)】]/gi, "");
    out = out.replace(/[(【]\s*(?:[A-Za-z]{2,10}|[\u4e00-\u9fa5]{1,4})?\s*[.:：]\s*(?:echo|回响|追忆)\s*[:：]\s*[^\n)】]{0,40}?\s*[)】]/gi, "");
    /* ② 其余整包 (cho: 任意内容) —— 模型把状态值也塞进了这种壳里 */
    out = out.replace(/[(【]\s*(?:cho|choice|opt|option)\s*[:：][^\n)】]{0,160}?[)】]/gi, "");
    /* ③ 括号包裹的张力标记（行内也会出现：正文结尾 "…先活着，再谈其他。 (tension: 15)"） */
    out = out.replace(/[(【]\s*(?:tension|张力)\s*[:：]\s*\d{1,3}\s*(?:\/\s*100)?\s*[)】]/gi, "");
    /* ④ 孤立的 tension: 45 行（无括号包裹时） */
    out = out.replace(/(^|\n)[ \t]*(?:tension|张力)\s*[:：]\s*\d{1,3}[ \t]*(?=\n|$)/gi, "$1");
    return out.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
  }
  function isDramatic(label) {
    return /关键抉择|生死抉择|命运岔口/.test(String(label || ""));
  }
  function buildDirective() {
    const c = cfg();
    if (!c.nextHook && !c.dramatic && !c.echo && !c.death) return "";
    return `

【沉浸演出协议（演出系统已启用，系统解析依赖）】
为强化演出效果，写正文时遵守以下轻量协议（标记独占一行，置于正文之后、选项区之前）：
- 张力上报：每轮在 (variable_update) 块内加一行 tension: 0-100 的整数（本轮剧情紧张度绝对值：日常闲叙≤20，暗流涌动30-50，正面冲突60-80，生死关头90+）
${c.dramatic ? "- 关键抉择：本轮若到达重大转折（生死攸关 / 立场抉择 / 不可逆事件），把选项区标题写成【关键抉择】——系统将启用聚光演出；普通回合沿用惯用标题格式" : ""}
${c.nextHook ? "- 下回预告：本章剧情将尽时，正文最后单独一行输出：(next: 25 字以内的悬念钩子，一句话吊住读者)" : ""}
${c.echo ? "- 记忆回响：正文明显回望或呼应早前的名场面 / 大事件时，在该段落之后单独一行输出：(echo: 那个名场面或大事的名称)" : ""}
${c.death ? "- 殒命标记：主角死亡或全书走向终结时，正文最后单独一行输出：(gameover: 一句话死因或结局)" : ""}
标记外的正文严禁出现这些括号指令；拿不准就不用标记，宁缺毋滥。`;
  }
  function maybeTitlePage(vars, body) {
    if (!cfg().page) return;
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey;
    if (!genre) return;
    const ch = Number(vars && vars.chapter);
    if (!Number.isFinite(ch) || ch < 1) return;
    const key = "immTitle_" + genre;
    let last = 0;
    try {
      last = Number(localStorage.getItem(key)) || 0;
    } catch (e) {
    }
    if (ch <= last) return;
    try {
      localStorage.setItem(key, String(ch));
    } catch (e) {
    }
    const title = String(vars && vars.chapterTitle || "").trim();
    const quote = firstSentence(body, 44);
    const bits = [];
    if (vars && vars.time) bits.push(String(vars.time));
    if (vars && vars.weather) bits.push(String(vars.weather));
    showTitlePage({ ch, title, quote, bits });
    sfx("page");
  }
  function showTitlePage({ ch, title, quote, bits }) {
    const old = document.getElementById("ipTitlePage");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "ipTitlePage";
    el.className = "ip-titlepage show";
    el.innerHTML = `
            <div class="ip-tp-inner">
                <div class="ip-tp-kicker">卷 · 第 ${esc(ch)} 章</div>
                <div class="ip-tp-rule"></div>
                <div class="ip-tp-title">${esc(title || "未题")}</div>
                ${bits && bits.length ? `<div class="ip-tp-bits">${bits.map((b) => `<span>${esc(b)}</span>`).join("")}</div>` : ""}
                ${quote ? `<div class="ip-tp-quote">「${esc(quote)}」</div>` : ""}
                <div class="ip-tp-enter">轻触 · 入卷</div>
            </div>`;
    el.addEventListener("click", () => dismissTitlePage());
    (document.body || document.documentElement).appendChild(el);
    clearTimeout(showTitlePage._t);
    showTitlePage._t = setTimeout(() => dismissTitlePage(), 4200);
  }
  function dismissTitlePage() {
    const el = document.getElementById("ipTitlePage");
    if (!el) return;
    clearTimeout(showTitlePage._t);
    el.classList.remove("show");
    setTimeout(() => el.remove(), 380);
  }
  function scanEcho(body, vars, reply) {
    if (!cfg().echo) return;
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey;
    const st = window.ImmersiveSuite && ImmersiveSuite._state;
    if (!genre || !st) return;
    const round = Number(vars && vars.chapter) || 0;
    const pool = [];
    (st.highlights || []).forEach((h) => {
      const t = String(h && h.title || "").trim();
      if (t.length >= 2) pool.push({ id: "H" + h.round + t.slice(0, 8), kw: t, title: t, text: String(h.excerpt || ""), round: Number(h.round) || 0 });
    });
    (st.events || []).forEach((ev) => {
      const t = String(ev && ev.name || "").trim();
      if (t.length >= 2 && ev.done) pool.push({ id: "E" + ev.round + t.slice(0, 8), kw: t, title: t, text: "", round: Number(ev.round) || 0 });
    });
    const hooks = extractHooks(reply || body);
    let hit = null;
    for (const name of hooks.echoes) {
      const p = pool.find((x) => x.kw === name || x.kw.includes(name) || name.includes(x.kw));
      if (p) {
        hit = p;
        break;
      }
    }
    if (!hit) {
      const text = String(body || "");
      hit = pool.find((p) => p.round && round - p.round >= 2 && text.includes(p.kw)) || null;
    }
    if (!hit) return;
    const key = "immFlash_" + genre;
    let shown = [];
    try {
      shown = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(shown)) shown = [];
    } catch (e) {
    }
    if (shown.includes(hit.id)) return;
    shown.push(hit.id);
    if (shown.length > 60) shown = shown.slice(-60);
    try {
      localStorage.setItem(key, JSON.stringify(shown));
    } catch (e) {
    }
    const container = document.getElementById("chatMessages");
    if (!container || !container.children || !container.children.length) return;
    let card = null;
    for (let i = container.children.length - 1; i >= 0; i--) {
      const el = container.children[i];
      if (el && String(el.className || "").indexOf("ai-card") >= 0) {
        card = el;
        break;
      }
    }
    if (!card) return;
    const div = document.createElement("div");
    div.className = "ip-echo-card";
    div.innerHTML = `
            <div class="ip-echo-head">🕯 记忆碎片${hit.round ? ` · 第 ${esc(hit.round)} 回` : ""}</div>
            <div class="ip-echo-title">${esc(hit.title)}</div>
            ${hit.text ? `<div class="ip-echo-text">${esc(hit.text.slice(0, 90))}</div>` : ""}`;
    card.appendChild(div);
    sfx("letter");
  }
  const DEATH_RE = /(死亡|身亡|陨落|战死|阵亡|殒命|气绝|香消玉殒)/;
  function checkGameOver(reply, vars) {
    if (!cfg().death) return;
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey;
    const ch = Number(vars && vars.chapter) || 0;
    const key = "immDeath_" + (genre || "g");
    let last = -1;
    try {
      last = Number(localStorage.getItem(key));
      if (!Number.isFinite(last)) last = -1;
    } catch (e) {
    }
    if (ch && last === ch) return;
    const hooks = extractHooks(reply);
    let cause = hooks.gameover || "";
    if (!cause) {
      const pn = fw && fw.storyState && fw.storyState.setup && fw.storyState.setup.playerName || "";
      for (const [k, v] of Object.entries(vars || {})) {
        const key2 = String(k), val = String(v != null ? v : "");
        if (!DEATH_RE.test(val)) continue;
        const isPlayer = /isPlayer|player/i.test(key2) || pn && key2 === pn || pn && key2.startsWith(pn + ".");
        if (isPlayer) {
          cause = val;
          break;
        }
      }
    }
    if (!cause) return;
    if (ch) {
      try {
        localStorage.setItem(key, String(ch));
      } catch (e) {
      }
    }
    showDeathCard(cause, ch);
  }
  function showDeathCard(cause, ch) {
    const old = document.getElementById("ipDeathCard");
    if (old) old.remove();
    const st = window.ImmersiveSuite && ImmersiveSuite._state;
    const relics = (st && Array.isArray(st.items) ? st.items : []).slice(-6).map((it) => `${it.name}${it.count > 1 ? " x" + it.count : ""}`);
    const el = document.createElement("div");
    el.id = "ipDeathCard";
    el.className = "ip-deathcard show";
    el.innerHTML = `
            <div class="ip-dc-inner">
                <div class="ip-dc-kicker">${ch ? `第 ${esc(ch)} 章 · ` : ""}殒命</div>
                <div class="ip-dc-cause">${esc(cause)}</div>
                ${relics.length ? `<div class="ip-dc-relics"><span class="ip-dc-rl">行囊遗物</span>${relics.map((r) => `<i>${esc(r)}</i>`).join("")}</div>` : ""}
                <div class="ip-dc-acts">
                    <button class="ip-dc-btn" onclick="ImmersionPlus.dismissDeath();if(window.StoryInput&&window.StoryInput.rollback)window.StoryInput.rollback()">↩ 回退本章（改写命运）</button>
                    <button class="ip-dc-btn ghost" onclick="ImmersionPlus.dismissDeath();if(window.Snapshots)Snapshots.open()">📜 读取快照</button>
                    <button class="ip-dc-btn ghost" onclick="ImmersionPlus.dismissDeath()">📖 继续观书</button>
                </div>
            </div>`;
    (document.body || document.documentElement).appendChild(el);
    sfx("defeat");
  }
  function dismissDeath() {
    const el = document.getElementById("ipDeathCard");
    if (el) el.remove();
  }
  function onTurnRendered(reply, body, vars) {
    try {
      const c = cfg();
      if (c.page) maybeTitlePage(vars, body);
      if (c.echo) scanEcho(body, vars, reply);
      if (c.death) checkGameOver(reply, vars);
    } catch (e) {
      console.warn("[沉浸演出] 故障（已忽略）:", e && e.message);
    }
  }
  function svgTension(tensions) {
    const pts = (Array.isArray(tensions) ? tensions : []).map((t) => ({ r: Number(t.round) || 0, v: Math.max(0, Math.min(100, Number(t.v) || 0)) })).filter((t) => t.r > 0);
    if (pts.length < 2) return "";
    const last = pts.slice(-24);
    const W = 272, H = 66, PAD = 8;
    const step = (W - PAD * 2) / Math.max(1, last.length - 1);
    const y = (v) => H - PAD - v / 100 * (H - PAD * 2);
    const xy = last.map((p, i) => [(PAD + i * step).toFixed(1), y(p.v).toFixed(1)]);
    const line = xy.map((p) => p.join(",")).join(" ");
    const area = `${PAD},${H - PAD} ${line} ${(PAD + (last.length - 1) * step).toFixed(1)},${H - PAD}`;
    const tip = last[last.length - 1];
    const warn = flatWarn(tensions);
    return `<div class="ip-tension">
            <div class="ip-ten-head"><span>⚡ 张力曲线</span><i>${esc(tip.r)} 回 · ${Math.round(tip.v)}</i></div>
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="ip-ten-svg">
                <polygon points="${area}" fill="var(--ip-ten-fill, rgba(224,168,76,.14))"/>
                <polyline points="${line}" fill="none" stroke="var(--ip-ten-line, #e0a84c)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
                <circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="2.6" fill="var(--ip-ten-line, #e0a84c)"/>
            </svg>
            <div class="ip-ten-axis"><span>第 ${esc(last[0].r)} 回</span><span>第 ${esc(last[last.length - 1].r)} 回</span></div>
            ${warn ? `<div class="ip-ten-warn">📉 ${esc(warn)}</div>` : ""}
        </div>`;
  }
  function flatWarn(tensions) {
    const pts = (Array.isArray(tensions) ? tensions : []).filter((t) => Number(t.round) > 0);
    if (pts.length < 3) return "";
    const tail = pts.slice(-3).map((t) => Number(t.v) || 0);
    if (Math.max(...tail) - Math.min(...tail) <= 6) return "近三章波澜不惊——不妨让命运掀一场风浪";
    return "";
  }
  function toggleReading() {
    var _a;
    const b = document.body;
    if (!b) return;
    const on = b.classList.toggle("reading");
    const old = document.getElementById("ipReadingExit");
    if (old) old.remove();
    if (on) {
      const chip = document.createElement("button");
      chip.id = "ipReadingExit";
      chip.className = "ip-reading-exit";
      chip.textContent = "✕ 退出阅读态";
      chip.addEventListener("click", () => exitReading());
      b.appendChild(chip);
    }
    try {
      (_a = window.showToast) == null ? void 0 : _a.call(window, on ? "📖 沉浸阅读态已开启（Esc / R 退出）" : "已退出沉浸阅读态");
    } catch (e) {
    }
    return on;
  }
  function exitReading() {
    if (document.body && document.body.classList.contains("reading")) document.body.classList.remove("reading");
    const chip = document.getElementById("ipReadingExit");
    if (chip) chip.remove();
  }
  function initHotkeys() {
    document.addEventListener("keydown", (e) => {
      var _a;
      try {
        if (!cfg().hotkeys) return;
        const t = e.target;
        const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (e.key === "Escape") {
          handleEsc();
          return;
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          if (typing) {
            e.preventDefault();
            (_a = window.StoryInput) == null ? void 0 : _a.send();
          }
          return;
        }
        if (typing) return;
        if (/^[1-9]$/.test(e.key)) {
          const btns = Array.from(document.querySelectorAll(".option-btn")).filter((b2) => !b2.disabled);
          const b = btns[Number(e.key) - 1];
          if (b) {
            e.preventDefault();
            b.click();
          }
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          toggleReading();
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          rollbackWithConfirm();
        }
      } catch (err) {
        console.warn("[快捷键] 故障:", err && err.message);
      }
    });
  }
  async function rollbackWithConfirm() {
    var _a;
    const fw = window.storyFramework;
    if (!fw || !fw.storyState || !fw.storyState.isStoryStarted) return;
    const ok = await window.UIDialog.confirm({
      title: "↩ 回退本轮？",
      message: "删除最近一轮正文与状态登记，故事回到该轮开始前。",
      danger: true
    });
    if (ok) (_a = window.StoryInput) == null ? void 0 : _a.rollback();
  }
  function handleEsc() {
    const tp = document.getElementById("ipTitlePage");
    if (tp && tp.classList.contains("show")) {
      dismissTitlePage();
      return;
    }
    const dc = document.getElementById("ipDeathCard");
    if (dc) {
      dismissDeath();
      return;
    }
    const sheet = document.querySelector(".sheet-overlay.show");
    if (sheet) {
      try {
        window.Toolbox && Toolbox.close();
      } catch (e) {
      }
      try {
        window.Snapshots && Snapshots.close();
      } catch (e) {
      }
      return;
    }
    const modal = document.querySelector(".modal-overlay.show");
    if (modal) {
      const btn = modal.querySelector('.modal-close, [class*="close"]');
      if (btn) {
        btn.click();
        return;
      }
    }
    exitReading();
  }
  function settingsPanel() {
    const c = cfg();
    const row = (k, name, note) => `
            <div class="st-row"><span>${name}</span>
                <button class="imm-mini big ${c[k] ? "on" : ""}" onclick="ImmersiveSuite.renderTab();ImmersionPlus.flip('${k}')">${c[k] ? "🎭 开（点击关）" : "关 · 开启"}</button></div>
            <div class="st-note">${note}</div>`;
    return `<div class="st-sec">
            <div class="st-title">🎭 沉浸演出 · 九艺</div>
            ${row("page", "章节扉页", "章号翻新时全屏扉页卡：章回标题 · 时辰天象 · 卷首引语")}
            ${row("dramatic", "抉择时刻", "选项标题带「关键抉择」时聚光演出：暗幕 + 逐个浮现 + 低鼓")}
            ${row("nextHook", "下回预告", "章末 (next: 钩子) 以悬念样式呈现在卡片底部")}
            ${row("echo", "记忆回响", "正文回望旧事时插「记忆碎片」毛玻璃卡（名场面 / 已了结大事）")}
            ${row("death", "殒命结算", "主角死亡时全屏结算卡：死因 + 遗物清单 + 回退改写命运")}
            ${row("hotkeys", "键盘快捷键", "1-9 选选项 · Ctrl+Enter 发送 · Esc 关浮层 · Backspace 回退本轮 · R 阅读态")}
        </div>`;
  }
  function flip(k) {
    var _a;
    const on = setCfg(k);
    try {
      (_a = window.showToast) == null ? void 0 : _a.call(window, on ? "已开启" : "已关闭");
    } catch (e) {
    }
  }
  function boot() {
    if (cfg().hotkeys) initHotkeys();
  }
  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
  return {
    cfg,
    setCfg,
    flip,
    settingsPanel,
    buildDirective,
    sfx,
    extractHooks,
    stripHookMarkers,
    isDramatic,
    onTurnRendered,
    maybeTitlePage,
    showTitlePage,
    dismissTitlePage,
    scanEcho,
    checkGameOver,
    showDeathCard,
    dismissDeath,
    svgTension,
    flatWarn,
    toggleReading,
    exitReading,
    initHotkeys
  };
}();
window.ImmersionPlus = ImmersionPlus;
