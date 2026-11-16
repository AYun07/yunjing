(function() {
  "use strict";
  const BM_MAX = 30;
  const ChapterNav = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /** 高亮关键词（先转义再包标记，防 XSS） */
    mark(text, kw) {
      const safe = this.esc(text);
      if (!kw) return safe;
      const e = this.esc(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        return safe.replace(new RegExp(e, "g"), (m) => `<mark class="cn-mark">${m}</mark>`);
      } catch (err) {
        return safe;
      }
    },
    /* ==================== 目录数据（扫描 DOM） ==================== */
    /**
     * 扫描聊天流全部正文卡 → [{ch, words, excerpt, el, turn}]
     * 章号取 .chapter-badge 文本（"第 N 章"）；无章号的归入上一章
     */
    scan() {
      const box = document.getElementById("chatMessages");
      if (!box) return [];
      const out = [];
      let lastCh = 0;
      box.querySelectorAll(".ai-card").forEach((el) => {
        var _a;
        const badge = el.querySelector(".chapter-badge");
        const body = el.querySelector(".story-body");
        if (!badge || !body) return;
        const m = String(badge.textContent || "").match(/第\s*([0-9一二三四五六七八九十百]+)\s*章/);
        let ch = m ? this.cnNum(m[1]) : lastCh;
        if (!ch) ch = lastCh;
        lastCh = ch;
        const wm = String(((_a = el.querySelector(".word-badge")) == null ? void 0 : _a.textContent) || "").match(/(\d+)/);
        const words = wm ? Number(wm[1]) : 0;
        const text = String(body.textContent || "").replace(/\s+/g, " ").trim();
        out.push({
          ch,
          words,
          excerpt: text.slice(0, 60),
          turn: el.getAttribute("data-turn"),
          density: window.CraftMeter && CraftMeter.densityOf ? CraftMeter.densityOf(text) : null,
          el
        });
      });
      return out;
    },
    /** 中文数字 → 阿拉伯（章节徽标可能是"第十二章"；'零'跳过） */
    cnNum(s) {
      const n = Number(s);
      if (!Number.isNaN(n) && s.trim() !== "") return n;
      const map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "百": 100 };
      let total = 0, cur = 0;
      for (const c of String(s)) {
        if (c === "零") continue;
        const v = map[c];
        if (v == null) return 0;
        if (v === 10 || v === 100) {
          total += (cur || 1) * v;
          cur = 0;
        } else cur = v;
      }
      return total + cur;
    },
    /* ==================== 书签（随档保存） ==================== */
    bookmarks() {
      var _a, _b;
      const b = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.bookmarks;
      return Array.isArray(b) ? b : [];
    },
    addBookmark(item) {
      var _a, _b;
      const fw = window.storyFramework;
      if (!fw) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "尚未开篇，无档可存书签", "error");
        return;
      }
      const list = this.bookmarks().filter((b) => b.turn !== item.turn);
      list.push(item);
      if (list.length > BM_MAX) list.splice(0, list.length - BM_MAX);
      fw.storyState.bookmarks = list;
      try {
        fw.saveStory();
      } catch (e) {
      }
      (_b = window.showToast) == null ? void 0 : _b.call(window, `🔖 已收藏名场面（第 ${item.chapter} 章）`, "success");
      this.render();
    },
    removeBookmark(turn) {
      const fw = window.storyFramework;
      if (!fw) return;
      fw.storyState.bookmarks = this.bookmarks().filter((b) => String(b.turn) !== String(turn));
      try {
        fw.saveStory();
      } catch (e) {
      }
      this.render();
    },
    /* ==================== 跳转 ==================== */
    /** 滚到卡片并高亮闪烁；找不到（已回退）给可读提示 */
    jumpTo(el, fallbackTurn) {
      var _a;
      const target = el || (fallbackTurn != null ? document.querySelector(`#chatMessages [data-turn="${String(fallbackTurn).replace(/[^0-9]/g, "")}"]`) : null);
      if (!target) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "该轮卡片已不存在（可能被「回退本轮」删除）", "info");
        return;
      }
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        target.scrollIntoView();
      }
      target.classList.remove("cn-flash");
      void target.offsetWidth;
      target.classList.add("cn-flash");
      setTimeout(() => target.classList.remove("cn-flash"), 1800);
      this.close();
    },
    /* ==================== 全文搜索 ==================== */
    /**
     * @param kw 关键词（≥2 字才检索）
     * @returns {prose:[{ch,excerpt,el}], people:[{name,role,desc}], plots:[{name,status}]}
     */
    search(kw) {
      var _a, _b;
      const res = { prose: [], people: [], plots: [] };
      if (!kw || kw.length < 2) return res;
      const cards = this.scan();
      cards.forEach((c) => {
        var _a2;
        const text = String(((_a2 = c.el.querySelector(".story-body")) == null ? void 0 : _a2.textContent) || "");
        if (text.includes(kw)) {
          const i = text.indexOf(kw);
          res.prose.push({
            ch: c.ch,
            excerpt: text.slice(Math.max(0, i - 18), i + 42).replace(/\s+/g, " ").trim(),
            el: c.el
          });
        }
      });
      const imm = window.ImmersiveSuite && ImmersiveSuite._state || {};
      Object.values(imm.gallery || {}).forEach((g) => {
        const blob = `${g.name || ""} ${g.role || ""} ${g.desc || g.description || ""}`;
        if (blob.includes(kw)) res.people.push({ name: g.name, role: g.role, desc: g.desc || g.description });
      });
      const v = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) || {};
      (Array.isArray(v.foreshadowings) ? v.foreshadowings : []).forEach((p) => {
        const name = typeof p === "object" ? p.name || p.desc || "" : String(p);
        if (name.includes(kw)) res.plots.push({ name, status: typeof p === "object" ? p.status : "" });
      });
      return res;
    },
    /* ==================== 主面板 ==================== */
    open() {
      var _a;
      (_a = document.getElementById("cnDrawer")) == null ? void 0 : _a.remove();
      const wrap = document.createElement("div");
      wrap.id = "cnDrawer";
      wrap.innerHTML = `
            <div class="cn-overlay" onclick="if(event.target===this)ChapterNav.close()">
                <div class="cn-drawer">
                    <div class="cn-head">
                        <b>📑 章节目录</b>
                        <span class="cn-sub" id="cnSub"></span>
                        <button class="cn-x" onclick="ChapterNav.close()">✕</button>
                    </div>
                    <div class="cn-search-row">
                        <input id="cnSearch" type="text" placeholder="全文搜索：正文 / 角色 / 伏笔…"
                            oninput="ChapterNav.onSearch(this.value)">
                    </div>
                    <div class="cn-body" id="cnBody"></div>
                </div>
            </div>`;
      document.body.appendChild(wrap);
      this.render();
      const inp = document.getElementById("cnSearch");
      if (inp && !(document.body.classList && document.body.classList.contains("mobile"))) {
        setTimeout(() => {
          try {
            inp.focus();
          } catch (e) {
          }
        }, 60);
      }
    },
    close() {
      var _a;
      (_a = document.getElementById("cnDrawer")) == null ? void 0 : _a.remove();
    },
    /** 主渲染：无关键词出目录+书签墙；有关键词出搜索结果 */
    render() {
      var _a;
      const body = document.getElementById("cnBody");
      const kw = String(((_a = document.getElementById("cnSearch")) == null ? void 0 : _a.value) || "").trim();
      if (!body) return;
      if (kw.length >= 2) {
        body.innerHTML = this.searchHTML(kw);
        return;
      }
      body.innerHTML = this.tocHTML();
      const sub = document.getElementById("cnSub");
      if (sub) {
        const cards = this.scan();
        const chs = new Set(cards.map((c) => c.ch));
        sub.textContent = `${chs.size} 章 · ${cards.reduce((s, c) => s + c.words, 0).toLocaleString()} 字 · ${this.bookmarks().length} 书签`;
      }
    },
    /** 目录 + 书签墙 */
    tocHTML() {
      var _a, _b, _c;
      const cards = this.scan();
      if (!cards.length) {
        return `<div class="cn-empty">尚无正文——开篇写起来，目录会随章节自动生长。</div>`;
      }
      const groups = /* @__PURE__ */ new Map();
      cards.forEach((c) => {
        if (!groups.has(c.ch)) groups.set(c.ch, []);
        groups.get(c.ch).push(c);
      });
      const curCh = Number((_c = (_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) == null ? void 0 : _c.chapter) || 0;
      const bms = this.bookmarks();
      const rows = [...groups.entries()].map(([ch, list]) => {
        const words = list.reduce((s, c) => s + c.words, 0);
        const first = list[0];
        const dens = window.CraftMeter && CraftMeter.densityOf ? CraftMeter.densityOf(list.map((c) => {
          var _a2;
          return String(((_a2 = c.el.querySelector(".story-body")) == null ? void 0 : _a2.textContent) || "");
        }).join(" ")) : null;
        const densHTML = dens != null ? `<span class="cn-dens" title="本章对话密度 ${Math.round(dens * 100)}%（黄金区间 30%-60%）">💬 ${Math.round(dens * 100)}%</span>` : "";
        const isCur = ch === curCh;
        return `<div class="cn-row${isCur ? " cur" : ""}" onclick="ChapterNav.jumpTo(null, ${Number(first.turn) || 0})">
                    <span class="cn-ch">${isCur ? "▶ " : ""}第 ${ch} 章${isCur ? " <i>连载中</i>" : ""}</span>
                    <span class="cn-exc">${this.esc(first.excerpt)}</span>
                    <span class="cn-meta">${words.toLocaleString()} 字${densHTML}</span>
                    <button class="cn-bm" title="收藏本章名场面" onclick="event.stopPropagation();ChapterNav.bmHere(${ch}, ${Number(first.turn) || 0})">🔖</button>
                </div>`;
      }).join("");
      const bmHTML = bms.length ? `
                <div class="cn-sec">🔖 名场面书签（${bms.length}）</div>
                ${[...bms].reverse().map((b) => `
                <div class="cn-row bm" onclick="ChapterNav.jumpTo(null, ${Number(b.turn) || 0})">
                    <span class="cn-ch">第 ${b.chapter} 章</span>
                    <span class="cn-exc">${this.esc(b.excerpt)}</span>
                    <span class="cn-meta">${this.ago(b.ts)}</span>
                    <button class="cn-bm del" title="删除书签" onclick="event.stopPropagation();ChapterNav.removeBookmark('${this.esc(String(b.turn))}')">✕</button>
                </div>`).join("")}` : "";
      return bmHTML + `<div class="cn-sec">📖 章节目录（${groups.size} 章）</div>` + rows;
    },
    /** 从章首卡快速打书签 */
    bmHere(ch, turn) {
      const cards = this.scan();
      const c = cards.find((x) => Number(x.turn) === Number(turn)) || cards.find((x) => x.ch === ch);
      this.addBookmark({
        turn: String(turn),
        chapter: ch,
        excerpt: c ? c.excerpt : `第 ${ch} 章`,
        ts: Date.now()
      });
    },
    /** 搜索结果渲染 */
    searchHTML(kw) {
      const r = this.search(kw);
      const total = r.prose.length + r.people.length + r.plots.length;
      if (!total) {
        return `<div class="cn-empty">「${this.esc(kw)}」在正文 / 角色 / 伏笔中均无命中。</div>`;
      }
      const parts = [];
      if (r.prose.length) {
        parts.push(`<div class="cn-sec">📖 正文命中（${r.prose.length}）</div>` + r.prose.slice(0, 40).map((p, i) => `
                    <div class="cn-row hit" onclick="ChapterNav.jumpTo(ChapterNav._hits[${i}])">
                        <span class="cn-ch">第 ${p.ch} 章</span>
                        <span class="cn-exc">…${this.mark(p.excerpt, kw)}…</span>
                    </div>`).join(""));
      }
      if (r.people.length) {
        parts.push(`<div class="cn-sec">👥 角色命中（${r.people.length}）</div>` + r.people.slice(0, 20).map((p) => `
                    <div class="cn-row">
                        <span class="cn-ch">🎭 ${this.mark(p.name, kw)}</span>
                        <span class="cn-exc">${this.esc(p.role || "")} ${this.esc(String(p.desc || "").slice(0, 50))}</span>
                    </div>`).join(""));
      }
      if (r.plots.length) {
        parts.push(`<div class="cn-sec">🧵 伏笔命中（${r.plots.length}）</div>` + r.plots.slice(0, 20).map((p) => `
                    <div class="cn-row">
                        <span class="cn-ch">🪢 ${this.mark(p.name, kw)}</span>
                        <span class="cn-exc">${this.esc(String(p.status || "未回收"))}</span>
                    </div>`).join(""));
      }
      this._hits = r.prose.map((p) => p.el);
      return parts.join("");
    },
    onSearch() {
      this.render();
    },
    /** 相对时间 */
    ago(ts) {
      const d = Date.now() - (Number(ts) || 0);
      if (d < 36e5) return "刚刚";
      if (d < 864e5) return `${Math.floor(d / 36e5)} 小时前`;
      if (d < 6048e5) return `${Math.floor(d / 864e5)} 天前`;
      return new Date(ts).toLocaleDateString("zh-CN");
    }
  };
  if (!document.getElementById("chapterNavStyle")) {
    const st = document.createElement("style");
    st.id = "chapterNavStyle";
    st.textContent = `
.cn-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);z-index:9990;display:flex;justify-content:flex-end}
.cn-drawer{width:min(480px,94vw);height:100vh;display:flex;flex-direction:column;background:linear-gradient(170deg,#211d17,#17140f);border-left:1px solid #c9a86a45;box-shadow:-18px 0 54px rgba(0,0,0,.5);animation:cnSlide .3s cubic-bezier(.22,.9,.36,1) both}
@keyframes cnSlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
.cn-head{display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid #c9a86a28}
.cn-head b{color:#e8dcc0;font-size:15px;letter-spacing:1.5px}
.cn-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.cn-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.cn-x:hover{color:#e8dcc0}
.cn-search-row{padding:12px 16px;border-bottom:1px solid #c9a86a20}
#cnSearch{width:100%;box-sizing:border-box;background:rgba(0,0,0,.32);border:1px solid #c9a86a40;border-radius:10px;color:#e0d6bc;font-size:13px;padding:9px 13px;outline:none}
#cnSearch:focus{border-color:#c9a86a80}
#cnSearch::placeholder{color:#8a7d63}
.cn-body{flex:1;overflow-y:auto;padding:10px 12px 20px}
.cn-empty{font-size:12.5px;color:#9a8c6e;background:rgba(0,0,0,.2);border:1px dashed #c9a86a38;border-radius:10px;padding:18px 14px;text-align:center;line-height:1.9}
.cn-sec{font-size:11px;color:#c9a86a;letter-spacing:2px;margin:14px 6px 7px;display:flex;align-items:center;gap:6px}
.cn-sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#c9a86a33,transparent)}
.cn-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;cursor:pointer;border:1px solid transparent;transition:background .15s,border-color .15s;margin-bottom:3px}
.cn-row:hover{background:#c9a86a12;border-color:#c9a86a35}
.cn-row.cur{background:#c9a86a16;border-color:#c9a86a55}
.cn-row.cur .cn-ch{color:#e8c87a}
.cn-ch{flex:0 0 auto;font-size:12px;color:#d8cba8;letter-spacing:.5px;white-space:nowrap}
.cn-ch i{font-style:normal;font-size:10px;color:#c9a86a;margin-left:3px}
.cn-exc{flex:1;min-width:0;font-size:11.5px;color:#9a8c6e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn-row.hit .cn-exc{color:#bdb08e}
.cn-meta{flex:0 0 auto;font-size:10.5px;color:#8a7d63;display:flex;gap:8px;align-items:center}
.cn-dens{color:#a8b8c8}
.cn-bm{flex:0 0 auto;background:#c9a86a14;border:1px solid #c9a86a44;color:#c9a86a;border-radius:7px;padding:2px 8px;font-size:11px;cursor:pointer;opacity:.75}
.cn-bm:hover{opacity:1;background:#c9a86a26}
.cn-bm.del{border-color:#e0707055;background:#e0707014;color:#e8a0a0;font-size:10px;padding:2px 7px}
.cn-mark{background:#e8c87a40;color:#f0e2b8;border-radius:3px;padding:0 1px}
.cn-flash{animation:cnFlash 1.6s ease}
@keyframes cnFlash{0%,60%{box-shadow:0 0 0 2px #c9a86a99,0 0 34px #c9a86a55}100%{box-shadow:none}}
@media (max-width:760px){.cn-drawer{width:100vw}.cn-exc{font-size:11px}.cn-meta .cn-dens{display:none}}`;
    document.head.appendChild(st);
  }
  window.ChapterNav = ChapterNav;
})();
