(function() {
  "use strict";
  const CardHub = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /* ==================== 导出：NPC → 标准卡 ==================== */
    /** 众生相 NPC 列表（带立绘标记） */
    npcList() {
      var _a, _b, _c, _d;
      const gallery = ((_b = (_a = window.ImmersiveSuite) == null ? void 0 : _a._state) == null ? void 0 : _b.gallery) || {};
      const portraits = ((_d = (_c = window.storyFramework) == null ? void 0 : _c.storyState) == null ? void 0 : _d.npcPortraits) || {};
      return Object.values(gallery).filter((g) => g && g.name).map((g) => {
        var _a2, _b2;
        return {
          name: g.name,
          role: g.role || "",
          desc: g.desc || g.desc || "",
          line: g.line || "",
          favor: (_a2 = g.favor) != null ? _a2 : 50,
          firstRound: (_b2 = g.firstRound) != null ? _b2 : 0,
          hasPortrait: !!(portraits[g.name] && portraits[g.name].url && !portraits[g.name].failed)
        };
      }).sort((a, b) => (b.favor || 0) - (a.favor || 0));
    },
    /**
     * NPC 生成卡正文描述：档案拼装（role + desc + relation + 台词）
     */
    npcDescription(n) {
      const parts = [];
      if (n.role) parts.push(`身份：${n.role}`);
      if (n.desc) parts.push(String(n.desc));
      if (n.line) parts.push(`标志性台词：「${n.line}」`);
      if (n.favor != null) {
        const hint = n.favor >= 80 ? "与主角关系极深" : n.favor >= 60 ? "与主角关系亲近" : n.favor >= 40 ? "与主角相识" : "与主角关系疏远";
        parts.push(`（好感 ${n.favor}/100，${hint}）`);
      }
      return parts.join("\n");
    },
    /** 从知识库捞出与该 NPC 相关的条目（标题/标签含名 或 内容高频提及），作世界书原料 */
    relatedKnowledge(npcName) {
      var _a;
      const kb = ((_a = window.StoryKnowledge) == null ? void 0 : _a.knowledgeBase) || [];
      const out = [];
      for (const item of kb) {
        const title = String(item.title || "");
        const content = String(item.content || "");
        const inTitle = title.includes(npcName);
        const cnt = content.split(npcName).length - 1;
        if (inTitle || cnt >= 2) {
          out.push({ item, weight: (inTitle ? 10 : 0) + cnt });
        }
      }
      return out.sort((a, b) => b.weight - a.weight).slice(0, 12);
    },
    /** 知识条目 → 世界书 entry（keys 取标题 + 名字变体） */
    toBookEntry(item, npcName) {
      const keys = /* @__PURE__ */ new Set();
      const title = String(item.title || "").trim();
      if (title) keys.add(title);
      if (npcName) keys.add(npcName);
      (item.tags || []).slice(0, 4).forEach((t) => {
        if (t) keys.add(String(t));
      });
      return {
        keys: [...keys].filter(Boolean).slice(0, 8),
        content: String(item.content || "").slice(0, 1200),
        insertionOrder: 100
      };
    },
    /**
     * 导出单个 NPC 为标准卡 PNG 并触发下载
     * @param {string} npcName 众生相角色名
     * @param {{withBook?:boolean, withPortrait?:boolean}} opts
     */
    async exportNPC(npcName, opts = {}) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const { withBook = true, withPortrait = true } = opts;
      const gallery = ((_b = (_a = window.ImmersiveSuite) == null ? void 0 : _a._state) == null ? void 0 : _b.gallery) || {};
      const g = gallery[npcName];
      if (!g) {
        (_c = window.showToast) == null ? void 0 : _c.call(window, `众生相中找不到「${npcName}」`, "error");
        return null;
      }
      let book = null;
      if (withBook) {
        const rel = this.relatedKnowledge(npcName);
        if (rel.length) {
          book = {
            name: `${npcName}的世界书`,
            description: "由云境知识库自动汇编（导出时勾选）",
            entries: rel.map((r) => this.toBookEntry(r.item, npcName))
          };
        }
      }
      const greetings = [];
      if (g.line) greetings.push(String(g.line).slice(0, 300));
      const card = window.CardIO.buildV3({
        name: npcName,
        description: this.npcDescription(g),
        personality: String(g.relation || ""),
        scenario: this._currentScenario(),
        first_mes: greetings[0] || "",
        mes_example: "",
        creator_notes: "由云境 AI 短篇小说创作室导出。该角色在原作品中随剧情成长，此处为其出场时刻的快照。",
        tags: ["yunjing", "云境", this._genreName()].filter(Boolean),
        creator: "云境",
        character_version: "1.0",
        alternate_greetings: greetings.slice(1),
        book
      });
      let basePng = null;
      if (withPortrait) {
        const p = (_f = (_e = (_d = window.storyFramework) == null ? void 0 : _d.storyState) == null ? void 0 : _e.npcPortraits) == null ? void 0 : _f[npcName];
        if (p && p.url && !p.failed) {
          try {
            basePng = await this._dataUrlToBytes(p.url);
          } catch (e) {
            basePng = null;
          }
        }
      }
      const bytes = await window.CardIO.writeCard(card, basePng);
      if (!bytes) {
        (_g = window.showToast) == null ? void 0 : _g.call(window, "角色卡生成失败（PNG 写入异常）", "error");
        return null;
      }
      const fname = `${npcName.replace(/[\\/:*?"<>|]/g, "_")}.png`;
      window.CardIO.download(bytes, fname);
      (_h = window.showToast) == null ? void 0 : _h.call(window, `✓ 「${npcName}」已导出为标准角色卡${book ? `（含世界书 ${book.entries.length} 条）` : ""}，可在 SillyTavern / RisuAI / Chub 使用`, "success");
      return bytes;
    },
    _currentScenario() {
      var _a, _b;
      const v = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.variables) || {};
      const t = [];
      if (v.title) t.push(`《${v.title}》`);
      if (v.chapter) t.push(`第${v.chapter}章`);
      return t.length ? `故事背景：${t.join(" · ")}（${this._genreName()}）` : "";
    },
    _genreName() {
      var _a;
      return ((_a = window.GenreStoryConfig) == null ? void 0 : _a.genreName) || "";
    },
    _dataUrlToBytes(dataUrl) {
      return new Promise((resolve, reject) => {
        fetch(dataUrl).then((r) => r.arrayBuffer()).then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      });
    },
    /* ==================== 导入：标准卡 → 云境 ==================== */
    /**
     * 解析卡文件（PNG 或 JSON）
     * @returns {Promise<{ok:boolean, msg:string, card?:object, norm?:object}>}
     */
    async parseFile(file) {
      try {
        if (/\.json$/i.test(file.name)) {
          const text = await file.text();
          const card = JSON.parse(text);
          if (!card || typeof card !== "object" || !(card.data || card.name)) {
            return { ok: false, msg: "JSON 不是角色卡结构（缺少 data 或 name 字段）" };
          }
          return { ok: true, msg: `已读取 JSON 卡（${window.CardIO.specVer(card) >= 3 ? "V3" : "V2"}）`, card, norm: window.CardIO.normalize(card) };
        }
        const bytes = await window.CardIO.readAsBytes(file);
        const hit = window.CardIO.readCard(bytes);
        if (!hit) {
          return { ok: false, msg: "未在这张 PNG 里找到角色卡数据（tEXt 块缺 ccv3/chara 标识）——请确认是角色卡而非普通图片" };
        }
        return { ok: true, msg: `已读取 PNG 卡（${hit.ver >= 3 ? "V3" : "V2"}）`, card: hit.card, norm: window.CardIO.normalize(hit.card) };
      } catch (e) {
        return { ok: false, msg: `读取失败：${e.message}` };
      }
    },
    /**
     * 导入卡 → 落地为 云境 数据
     * @param {object} norm CardIO.normalize 产物
     * @param {{gallery?:boolean, knowledge?:boolean, book?:boolean, greeting?:boolean}} what
     */
    importCard(norm, what = {}) {
      var _a, _b, _c, _d, _e, _f;
      const { gallery = true, knowledge = true, book = true, greeting = false } = what;
      if (!norm || !norm.name) return { ok: false, msg: "卡数据缺少角色名" };
      const results = [];
      if (gallery && ((_a = window.ImmersiveSuite) == null ? void 0 : _a._state)) {
        const st = window.ImmersiveSuite._state;
        const round = ((_c = (_b = window.storyFramework) == null ? void 0 : _b.storyState) == null ? void 0 : _c.turnCount) || 1;
        const g = st.gallery[norm.name] || { name: norm.name, firstRound: round, tags: [], line: "" };
        g.lastRound = round;
        if (!g.role) g.role = this._guessRole(norm);
        if (!g.desc) g.desc = String(norm.description).slice(0, 200);
        if (!g.line && norm.first_mes) g.line = String(norm.first_mes).slice(0, 120);
        if (g.favor == null) g.favor = 50;
        st.gallery[norm.name] = g;
        results.push("众生相已登记");
      }
      if (knowledge && window.StoryKnowledge) {
        const descParts = [norm.description];
        if (norm.personality) descParts.push(`性格/关系：${norm.personality}`);
        if (norm.scenario) descParts.push(`背景：${norm.scenario}`);
        const content = descParts.filter(Boolean).join("\n\n").slice(0, 3e3);
        if (content.length >= 20) {
          window.StoryKnowledge.addItem({
            title: `角色卡 · ${norm.name}`,
            content,
            category: "人物",
            tags: ["角色卡", "导入", ...norm.tags.slice(0, 4)],
            alwaysInclude: false,
            priority: "",
            source: "card"
          });
          results.push("知识库已建档（按需检索）");
        }
      }
      if (book && norm.book && ((_d = norm.book.entries) == null ? void 0 : _d.length) && window.StoryKnowledge) {
        let n = 0;
        for (const e of norm.book.entries.slice(0, 40)) {
          if (!e.content || e.content.length < 10) continue;
          window.StoryKnowledge.addItem({
            title: `世界书 · ${String(e.keys[0] || e.content.slice(0, 12))}`,
            content: e.content,
            category: "设定",
            tags: ["角色卡", "世界书"],
            keys: e.keys.slice(0, 12),
            alwaysInclude: false,
            priority: "",
            source: "card"
          });
          n++;
        }
        if (n) results.push(`世界书 ${n} 条已转为关键词触发条目`);
      }
      if (greeting && norm.first_mes && window.StoryResponseHandler) {
        window.StoryResponseHandler.renderSystemMessage(
          `🎭 ${norm.name} 登场

${norm.first_mes}`,
          "info"
        );
        results.push("登场白已发送到聊天流");
      }
      (_f = (_e = window.storyFramework) == null ? void 0 : _e.saveStory) == null ? void 0 : _f.call(_e);
      return { ok: true, msg: `「${norm.name}」导入完成：${results.join("；")}`, results };
    },
    /** 从描述猜身份（拿描述第一段 / 前 60 字） */
    _guessRole(norm) {
      const d = String(norm.description || "");
      const firstLine = d.split("\n").find((l) => l.trim()) || "";
      return firstLine.replace(/^身份[：:]\s*/, "").slice(0, 60);
    },
    /* ==================== UI：互通面板 ==================== */
    open() {
      var _a;
      (_a = document.getElementById("cardHubPanel")) == null ? void 0 : _a.remove();
      const html = this._shell(this._renderBody());
      document.body.appendChild(html);
    },
    close() {
      var _a;
      (_a = document.getElementById("cardHubPanel")) == null ? void 0 : _a.remove();
    },
    _shell(bodyHTML) {
      const w = document.createElement("div");
      w.id = "cardHubPanel";
      w.innerHTML = `
            <div class="chub-overlay" onclick="if(event.target===this)CardHub.close()">
                <div class="chub-modal">
                    <div class="chub-head"><b>🃏 角色卡互通</b><span class="chub-sub">Character Card V2/V3 · 与 SillyTavern / RisuAI / Chub 生态互通</span>
                        <button class="chub-x" onclick="CardHub.close()">✕</button></div>
                    <div class="chub-body">${bodyHTML}</div>
                </div>
            </div>`;
      if (!document.getElementById("cardHubStyle")) {
        const st = document.createElement("style");
        st.id = "cardHubStyle";
        st.textContent = `
.chub-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9995;display:flex;align-items:center;justify-content:center;padding:18px}
.chub-modal{width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:chubIn .3s ease both}
@keyframes chubIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.chub-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.chub-head b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.chub-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.chub-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.chub-x:hover{color:#e8dcc0}
.chub-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.chub-sec{font-size:12px;color:#c9a86a;letter-spacing:2px;margin:14px 0 10px;padding-bottom:6px;border-bottom:1px dashed #c9a86a30}
.chub-sec:first-child{margin-top:0}
.chub-row{display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,.035);border:1px solid #c9a86a2a;border-radius:11px;margin-bottom:7px;transition:border-color .2s}
.chub-row:hover{border-color:#c9a86a66}
.chub-name{color:#e8dcc0;font-size:13.5px;font-weight:600;min-width:88px}
.chub-meta{font-size:11px;color:#9a8c6e;flex:1;line-height:1.6}
.chub-btn{background:rgba(201,168,106,.14);border:1px solid #c9a86a44;color:#d8cba8;font-size:11.5px;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;transition:all .2s}
.chub-btn:hover{background:rgba(201,168,106,.26);border-color:#c9a86a88}
.chub-btn.primary{background:rgba(201,168,106,.24);border-color:#c9a86a88}
.chub-drop{border:2px dashed #c9a86a3d;border-radius:13px;padding:26px 16px;text-align:center;color:#9a8c6e;font-size:12.5px;line-height:2;cursor:pointer;transition:all .2s;background:rgba(0,0,0,.18)}
.chub-drop:hover{border-color:#c9a86a88;color:#d8cba8;background:rgba(201,168,106,.06)}
.chub-empty{font-size:12px;color:#8a7d63;text-align:center;padding:14px;line-height:2}
.chub-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:10px;padding-top:10px;border-top:1px dashed #c9a86a30}
.chub-res{font-size:12px;color:#a8d0a8;background:rgba(122,168,120,.1);border:1px solid #7aa87844;border-radius:9px;padding:10px 13px;margin-top:10px;line-height:1.8}
.chub-res.err{color:#d8a8a8;background:rgba(216,122,122,.08);border-color:#d87a7a44}`;
        document.head.appendChild(st);
      }
      return w;
    },
    _renderBody() {
      const npcs = this.npcList();
      const npcRows = npcs.length ? npcs.map((n) => `
                <div class="chub-row">
                    <span class="chub-name">${this.esc(n.name)}</span>
                    <span class="chub-meta">${this.esc(n.role || "身份未登记")} · 好感 ${n.favor} · ${n.hasPortrait ? "🖼 有立绘" : "无立绘（导出用占位底图）"}</span>
                    <button class="chub-btn primary" onclick="CardHub.exportNPC('${this.esc(n.name).replace(/'/g, "")}')">📤 导出卡</button>
                </div>`).join("") : '<div class="chub-empty">众生相还没有登记任何角色——写一段剧情，让角色登场后再来导出。</div>';
      return `
                <div class="chub-sec">📤 导出 · 众生相 NPC → 标准角色卡</div>
                ${npcRows}
                <div class="chub-note">导出内容：角色档案（身份/描述/关系/台词）+ 相关知识库条目打包为专属世界书${"+"}立绘作卡面底图。生成的 PNG 可直接导入 SillyTavern / RisuAI，或上传 Chub 分享。</div>
                <div class="chub-sec">📥 导入 · 标准角色卡 → 本工坊</div>
                <div class="chub-drop" onclick="document.getElementById('cardHubFile').click()">
                    <b style="color:#d8cba8">点击选择角色卡文件</b><br>
                    支持 PNG 角色卡（Chub / ST / RisuAI 导出）与 JSON 卡<br>
                    导入后：众生相登记角色 · 知识库建档 · 世界书转关键词触发条目
                </div>
                <input type="file" id="cardHubFile" accept=".png,.json,image/png,application/json" style="display:none" onchange="CardHub.onFile(this)">
                <div id="cardHubResult"></div>
                <div class="chub-note">导入只写入本地知识库与众生相，不动当前存档的正文与变量；登场白可在预览确认后手动发送。</div>`;
    },
    async onFile(input) {
      var _a, _b, _c;
      const file = input.files && input.files[0];
      if (!file) return;
      const resBox = document.getElementById("cardHubResult");
      const show = (html) => {
        if (resBox) resBox.innerHTML = html;
      };
      show(`<div class="chub-res">⏳ 正在解析「${this.esc(file.name)}」…</div>`);
      const parsed = await this.parseFile(file);
      if (!parsed.ok) {
        show(`<div class="chub-res err">✗ ${this.esc(parsed.msg)}</div>`);
        (_a = window.showToast) == null ? void 0 : _a.call(window, parsed.msg, "error");
        input.value = "";
        return;
      }
      const norm = parsed.norm;
      const bookN = ((_c = (_b = norm.book) == null ? void 0 : _b.entries) == null ? void 0 : _c.length) || 0;
      show(`<div class="chub-res">
                ✓ ${this.esc(parsed.msg)}<br>
                <b style="color:#e8dcc0">${this.esc(norm.name || "(未命名)")}</b>
                ${norm.creator ? ` · 作者 ${this.esc(norm.creator)}` : ""}${norm.character_version ? ` · v${this.esc(norm.character_version)}` : ""}<br>
                ${this.esc(String(norm.description).slice(0, 160) || "（无描述）")}${String(norm.description).length > 160 ? "…" : ""}<br>
                ${bookN ? `世界书 ${bookN} 条 · ` : ""}${norm.tags.length ? `标签：${this.esc(norm.tags.slice(0, 6).join("、"))}` : ""}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <button class="chub-btn primary" onclick="CardHub.confirmImport()">✓ 导入到本工坊</button>
                ${norm.first_mes ? `<button class="chub-btn" onclick="CardHub.confirmImport(true)">✓ 导入并发登场白</button>` : ""}
            </div>`);
      this._pending = norm;
      input.value = "";
    },
    confirmImport(withGreeting = false) {
      var _a;
      if (!this._pending) return;
      const res = this.importCard(this._pending, { greeting: !!withGreeting });
      const resBox = document.getElementById("cardHubResult");
      if (resBox) {
        resBox.innerHTML = res.ok ? `<div class="chub-res">✓ ${this.esc(res.msg)}</div>` : `<div class="chub-res err">✗ ${this.esc(res.msg)}</div>`;
      }
      (_a = window.showToast) == null ? void 0 : _a.call(window, res.msg, res.ok ? "success" : "error");
      if (res.ok) this._pending = null;
    }
  };
  window.CardHub = CardHub;
})();
