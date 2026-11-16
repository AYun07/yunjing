class StoryDLCManager {
  constructor() {
    const genre = new URLSearchParams(location.search).get("genre") || "free";
    this.genre = genre;
    this.storageKey = `storyDLC_${genre}`;
    this.dlcPackages = [];
    this.activatedDLCs = /* @__PURE__ */ new Set();
  }
  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        this.dlcPackages = Array.isArray(data == null ? void 0 : data.dlcPackages) ? data.dlcPackages : [];
      }
    } catch (e) {
      console.error("[StoryDLCManager] 读取 DLC 数据失败:", e);
      this.dlcPackages = [];
    }
    this.activatedDLCs = new Set(this.dlcPackages.filter((d2) => d2.activated).map((d2) => d2.id));
    console.log(`[StoryDLCManager] 已加载 ${this.dlcPackages.length} 个 DLC 知识包（${this.genre}）`);
  }
  save() {
    var _a;
    const data = {
      version: "1.0",
      app: "云境",
      genre: this.genre,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      dlcPackages: this.dlcPackages
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("[StoryDLCManager] 保存失败:", e);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "DLC 保存失败：可能超出浏览器本地存储容量", "error");
      return false;
    }
  }
  /** 规范化包内知识条目（剔除向量等运行时字段，对齐知识库条目结构） */
  _normalizeItem(raw, dlcId) {
    var _a;
    let id = String(raw.id || "").replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!id) id = "dlcitem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const always = raw.alwaysInclude === true;
    let priority = raw.priority;
    if (always && !["top", "high", "medium", "low"].includes(priority)) priority = "medium";
    const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : typeof raw.tags === "string" ? raw.tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean) : [];
    return {
      id,
      title: String(raw.title || "").trim(),
      content: String((_a = raw.content) != null ? _a : ""),
      category: raw.category || "dlc",
      tags,
      alwaysInclude: always,
      priority: always ? priority : "",
      ...dlcId ? { dlcId } : {}
    };
  }
  /** 创建 DLC 包（模仿原框架 createDLC：仅内存，需 save 持久化） */
  createDLC(name, description, knowledgeItems) {
    const dlc = {
      id: "dlc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      name,
      description: description || "",
      knowledgeItems: (knowledgeItems || []).map((i) => this._normalizeItem(i, null)),
      activated: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0",
      source: "user_created"
    };
    this.dlcPackages.push(dlc);
    this.save();
    console.log(`[StoryDLCManager] 创建 DLC 包: ${name} (${dlc.id})`);
    return dlc;
  }
  getDLCList() {
    return [...this.dlcPackages];
  }
  getActivatedDLCs() {
    return this.dlcPackages.filter((d2) => d2.activated);
  }
  getDLC(dlcId) {
    return this.dlcPackages.find((d2) => d2.id === dlcId) || null;
  }
  getStats() {
    const total = this.dlcPackages.length;
    const activated = this.activatedDLCs.size;
    const totalKnowledgeItems = this.dlcPackages.reduce((sum, d2) => sum + dlcCount(d2.knowledgeItems), 0);
    return { total, activated, inactive: total - activated, totalKnowledgeItems };
  }
  /**
   * 激活 DLC：把包内知识条目注入知识库（模仿原框架 activateDLC）
   * 同 id 条目已存在则跳过，避免重复注入
   */
  activateDLC(dlcId) {
    const dlc = this.getDLC(dlcId);
    if (!dlc) throw new Error("DLC 包不存在");
    if (dlc.activated) return dlc;
    const kb = window.StoryKnowledge;
    if (!kb) throw new Error("知识库模块未加载");
    let added = 0, skipped = 0;
    for (const raw of dlcCount(dlc.knowledgeItems) ? dlc.knowledgeItems : []) {
      const item = this._normalizeItem(raw, dlcId);
      if (!item.title || !item.content) {
        skipped++;
        continue;
      }
      if (kb.getById(item.id)) {
        skipped++;
        continue;
      }
      kb.addItem({ ...item, source: "dlc", dlcId });
      added++;
    }
    dlc.activated = true;
    this.activatedDLCs.add(dlcId);
    this.save();
    console.log(`[StoryDLCManager] 已激活 DLC「${dlc.name}」：注入 ${added} 条，跳过 ${skipped} 条`);
    return { dlc, added, skipped };
  }
  /** 停用 DLC：按 dlcId 反查并从知识库整体移除（模仿原框架 deactivateDLC） */
  deactivateDLC(dlcId) {
    const dlc = this.getDLC(dlcId);
    if (!dlc) throw new Error("DLC 包不存在");
    if (!dlc.activated) return dlc;
    const kb = window.StoryKnowledge;
    let removed = 0;
    if (kb) {
      removed = kb.knowledgeBase.filter((i) => i.dlcId === dlcId).length;
      kb.knowledgeBase = kb.knowledgeBase.filter((i) => i.dlcId !== dlcId);
      kb.save();
    }
    dlc.activated = false;
    this.activatedDLCs.delete(dlcId);
    this.save();
    console.log(`[StoryDLCManager] 已停用 DLC「${dlc.name}」：移除 ${removed} 条知识`);
    return { dlc, removed };
  }
  /** 更新包内知识条目（已激活时：停用 → 更新 → 重新激活，保证知识库同步，模仿原框架） */
  async updateDLCKnowledge(dlcId, knowledgeItems) {
    const dlc = this.getDLC(dlcId);
    if (!dlc) throw new Error("DLC 包不存在");
    const wasActivated = dlc.activated;
    if (wasActivated) this.deactivateDLC(dlcId);
    dlc.knowledgeItems = (knowledgeItems || []).map((i) => this._normalizeItem(i, null));
    dlc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    if (wasActivated) this.activateDLC(dlcId);
    return { dlc, reactivated: wasActivated };
  }
  /** 删除 DLC（已激活则先停用，模仿原框架 deleteDLC） */
  deleteDLC(dlcId) {
    const idx = this.dlcPackages.findIndex((d2) => d2.id === dlcId);
    if (idx === -1) throw new Error("DLC 包不存在");
    const dlc = this.dlcPackages[idx];
    if (dlc.activated) this.deactivateDLC(dlcId);
    this.dlcPackages.splice(idx, 1);
    this.activatedDLCs.delete(dlcId);
    this.save();
    console.log(`[StoryDLCManager] 已删除 DLC: ${dlc.name}`);
    return dlc;
  }
  /** 导入 DLC 包（按 id 去重：已存在则覆盖更新，强制 deactivated，模仿原框架 importDLC） */
  importDLC(dlcData) {
    if (!dlcData || !dlcData.id) throw new Error("无效的 DLC 数据（缺少 id）");
    if (!dlcData.name) throw new Error("无效的 DLC 数据（缺少 name）");
    const normalized = {
      id: String(dlcData.id).replace(/[^a-zA-Z0-9_\-]/g, ""),
      name: String(dlcData.name),
      description: String(dlcData.description || ""),
      knowledgeItems: (dlcData.knowledgeItems || []).map((i) => this._normalizeItem(i, null)),
      activated: false,
      createdAt: dlcData.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      version: dlcData.version || "1.0",
      source: dlcData.source || "imported"
    };
    const idx = this.dlcPackages.findIndex((d2) => d2.id === normalized.id);
    if (idx !== -1) {
      this.dlcPackages[idx] = { ...normalized, activated: false };
      this.activatedDLCs.delete(normalized.id);
      console.log(`[StoryDLCManager] 覆盖更新 DLC 包: ${normalized.name}`);
    } else {
      this.dlcPackages.push(normalized);
      console.log(`[StoryDLCManager] 导入 DLC 包: ${normalized.name}`);
    }
    this.save();
    return normalized;
  }
  /** 清空全部 DLC（逐个停用后清空，模仿原框架 clearAllDLCs） */
  clearAllDLCs() {
    for (const dlc of this.getActivatedDLCs()) {
      try {
        this.deactivateDLC(dlc.id);
      } catch (e) {
        console.warn(e.message);
      }
    }
    this.dlcPackages = [];
    this.activatedDLCs.clear();
    this.save();
  }
}
function dlcCount(items) {
  return Array.isArray(items) ? items.length : 0;
}
window.storyDLCManager = new StoryDLCManager();
window.storyDLCManager.load();
const StoryDLCUI = {
  /* ---------- 主面板：DLC 管理 ---------- */
  manage() {
    let modal = document.getElementById("dlcManageModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dlcManageModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.close();
      });
      document.body.appendChild(modal);
    }
    modal.innerHTML = this._buildManageHTML();
    modal.style.display = "flex";
  },
  close() {
    const modal = document.getElementById("dlcManageModal");
    if (modal) modal.style.display = "none";
  },
  /** 操作后重渲染主面板（避免弹窗叠加，模仿原框架 manageDLC 的先 remove 再重建） */
  _reRender() {
    const modal = document.getElementById("dlcManageModal");
    if (modal && modal.style.display !== "none") {
      modal.innerHTML = this._buildManageHTML();
    }
  },
  _buildManageHTML() {
    var _a;
    const m = window.storyDLCManager;
    const s = m.getStats();
    const cards = m.getDLCList().map((d2) => this._buildCardHTML(d2)).join("");
    return `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>📦 DLC 知识包 · ${((_a = window.GenreStoryConfig) == null ? void 0 : _a.genreName) || "当前工坊"}</span>
                <button class="modal-close" onclick="StoryDLCUI.close()">✕</button>
            </div>
            <div class="modal-body">
                <div class="kb-stats">
                    <div class="kb-stat"><b>${s.total}</b><i>DLC 总数</i></div>
                    <div class="kb-stat"><b>${s.activated}</b><i>已激活</i></div>
                    <div class="kb-stat"><b>${s.inactive}</b><i>未激活</i></div>
                    <div class="kb-stat"><b>${s.totalKnowledgeItems}</b><i>知识条目</i></div>
                </div>
                <div class="form-tip">DLC 知识包可将多个相关知识条目（如一整套世界观、系列人物设定）组合管理。激活后包内条目会注入知识库并参与 AI 写作（在 📚 知识库 中以 📦 标记显示）；停用则整体移出，不影响手动创建的条目。</div>
                <div class="kb-actions">
                    <button class="btn-solid btn-mini" onclick="StoryDLCUI.createNew()">📦 创建新 DLC</button>
                    <button class="btn-ghost btn-mini" onclick="StoryDLCUI.importFromFile()">📥 导入 DLC</button>
                    <button class="btn-ghost btn-mini" onclick="StoryDLCUI.exportAll()">📤 导出全部</button>
                </div>
                <div class="kb-list">
                    ${cards || `<div class="kb-empty">📦 暂无 DLC 知识包：可点击「创建新 DLC」用 JSON 组装，或「导入 DLC」加载分享的包文件（兼容原框架 DLC 与知识库格式）</div>`}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryDLCUI.close()">关闭</button>
            </div>
        </div>`;
  },
  _buildCardHTML(d2) {
    const m = window.storyDLCManager;
    const itemStats = {
      total: dlcCount(d2.knowledgeItems),
      always: dlcCount(d2.knowledgeItems) ? d2.knowledgeItems.filter((i) => i.alwaysInclude).length : 0
    };
    const sourceLabel = d2.source === "user_created" ? "本地创建" : d2.source === "imported_knowledge_base" ? "知识库转换" : "导入";
    return `
        <div class="dlc-card ${d2.activated ? "active" : ""}">
            <div class="dlc-card-head">
                <span class="dlc-name">${dlcEsc(d2.name)}</span>
                <span class="dlc-status ${d2.activated ? "on" : ""}">${d2.activated ? "✅ 已激活" : "⏸️ 未激活"}</span>
            </div>
            ${d2.description ? `<div class="dlc-desc">${dlcEsc(d2.description)}</div>` : ""}
            <div class="dlc-meta">
                <span>📚 ${itemStats.total} 条（常驻 ${itemStats.always} / 检索 ${itemStats.total - itemStats.always}）</span>
                <span>📅 ${dlcTime(d2.createdAt)}</span>
                <span>来源：${sourceLabel}</span>
            </div>
            <div class="dlc-btns">
                <button class="btn-mini ${d2.activated ? "btn-ghost" : "btn-solid"}" onclick="StoryDLCUI.toggle('${dlcEsc(d2.id)}')">${d2.activated ? "⏸️ 停用" : "▶️ 激活"}</button>
                <button class="btn-ghost btn-mini" onclick="StoryDLCUI.editKnowledge('${dlcEsc(d2.id)}')">✏️ 编辑条目</button>
                <button class="btn-ghost btn-mini" onclick="StoryDLCUI.exportOne('${dlcEsc(d2.id)}')">📤 导出</button>
                <button class="btn-ghost btn-mini danger" onclick="StoryDLCUI.confirmDelete('${dlcEsc(d2.id)}')">🗑 删除</button>
            </div>
        </div>`;
  },
  /* ---------- 激活 / 停用 ---------- */
  toggle(dlcId) {
    var _a, _b, _c, _d, _e, _f, _g;
    const m = window.storyDLCManager;
    const dlc = m.getDLC(dlcId);
    if (!dlc) return;
    try {
      if (dlc.activated) {
        const { removed } = m.deactivateDLC(dlcId);
        (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ DLC「${dlc.name}」已停用，${removed} 条知识已移出知识库`, "success");
        (_c = (_b = window.StoryResponseHandler) == null ? void 0 : _b.renderSystemMessage) == null ? void 0 : _c.call(_b, `📦 DLC 知识包「${dlc.name}」已停用：${removed} 条知识已从知识库移出，后续创作不再引用。`, "info");
      } else {
        const { added, skipped } = m.activateDLC(dlcId);
        (_d = window.showToast) == null ? void 0 : _d.call(window, `✓ DLC「${dlc.name}」已激活：注入 ${added} 条知识${skipped ? `（${skipped} 条 id 重复跳过）` : ""}`, "success");
        (_f = (_e = window.StoryResponseHandler) == null ? void 0 : _e.renderSystemMessage) == null ? void 0 : _f.call(_e, `📦 DLC 知识包「${dlc.name}」已激活：${added} 条知识已注入知识库（📚 知识库 中以 📦 标记显示），后续创作将自动引用。`, "success");
      }
    } catch (err) {
      (_g = window.showToast) == null ? void 0 : _g.call(window, `操作失败：${err.message}`, "error");
    }
    this._reRender();
  },
  async confirmDelete(dlcId) {
    var _a, _b;
    const m = window.storyDLCManager;
    const dlc = m.getDLC(dlcId);
    if (!dlc) return;
    const ok = await window.UIDialog.confirm({
      title: "删除 DLC 知识包",
      message: `确定删除 DLC「${dlc.name}」吗？
含 ${dlcCount(dlc.knowledgeItems)} 个知识条目，删除后不可恢复${dlc.activated ? "（已激活的条目将一并从知识库移除）" : ""}。`,
      danger: true,
      confirmText: "删除"
    });
    if (!ok) return;
    try {
      m.deleteDLC(dlcId);
      this._reRender();
      (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 已删除 DLC「${dlc.name}」`, "success");
    } catch (err) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, `删除失败：${err.message}`, "error");
    }
  },
  /* ---------- 创建新 DLC ---------- */
  createNew() {
    let modal = document.getElementById("dlcCreateModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dlcCreateModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeCreate();
      });
      document.body.appendChild(modal);
    }
    const example = JSON.stringify([
      {
        title: "条目标题（必填）",
        content: "条目内容（必填，至少20字）：人物写身份/性格/动机/秘密；地点写地理/氛围/势力；世界观写法则/历史/力量体系。",
        category: "世界观",
        tags: ["标签1", "标签2"],
        alwaysInclude: true,
        priority: "top"
      },
      {
        title: "检索型条目示例",
        content: "alwaysInclude 为 false 时为按需检索模式：仅当情节与本条目内容相关时，才会被自动检索注入（每次最多3条）。",
        category: "人物",
        tags: [],
        alwaysInclude: false
      }
    ], null, 2);
    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <span>📦 创建新 DLC 知识包</span>
                <button class="modal-close" onclick="StoryDLCUI.closeCreate()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <label>DLC 名称 *</label>
                    <input id="dlcNameInput" type="text" placeholder="例如：雾隐城世界观包 / 第二卷人物设定包">
                </div>
                <div class="form-row">
                    <label>描述</label>
                    <textarea id="dlcDescInput" rows="2" placeholder="这个知识包包含什么、适合什么题材的创作"></textarea>
                </div>
                <div class="form-row">
                    <label>知识条目（JSON 数组）*</label>
                    <textarea id="dlcKnowledgeInput" class="kb-json-editor" rows="12" placeholder='${dlcEscAttr(example)}'></textarea>
                    <div class="form-tip">字段：title 标题* / content 内容* / category 分类 / tags 标签数组 / alwaysInclude 常驻开关 / priority 常驻优先级（top / high / medium / low）。也可先用 📚 知识库 的「模板」生成结构再粘贴。</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryDLCUI.closeCreate()">取消</button>
                <button class="btn-solid" onclick="StoryDLCUI.confirmCreate()">创建 DLC</button>
            </div>
        </div>`;
    modal.style.display = "flex";
  },
  closeCreate() {
    const modal = document.getElementById("dlcCreateModal");
    if (modal) modal.style.display = "none";
  },
  confirmCreate() {
    var _a, _b, _c, _d, _e, _f, _g;
    const name = document.getElementById("dlcNameInput").value.trim();
    const description = document.getElementById("dlcDescInput").value.trim();
    const knowledgeText = document.getElementById("dlcKnowledgeInput").value.trim();
    if (!name) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "请填写 DLC 名称", "error");
      return;
    }
    if (!knowledgeText) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "请填写知识条目（JSON 数组）", "error");
      return;
    }
    let items;
    try {
      items = JSON.parse(knowledgeText);
    } catch (err) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, `JSON 解析失败：${err.message}（请检查逗号、引号是否完整）`, "error");
      return;
    }
    if (!Array.isArray(items)) {
      (_d = window.showToast) == null ? void 0 : _d.call(window, "知识条目必须是 JSON 数组 [ {...}, {...} ]", "error");
      return;
    }
    const valid = items.filter((i) => i && i.title && i.content);
    if (!valid.length) {
      (_e = window.showToast) == null ? void 0 : _e.call(window, "没有有效条目：每条至少需要 title 与 content 字段", "error");
      return;
    }
    if (valid.length < items.length) (_f = window.showToast) == null ? void 0 : _f.call(window, `已过滤 ${items.length - valid.length} 条缺少 title/content 的无效条目`, "info");
    const m = window.storyDLCManager;
    const dlc = m.createDLC(name, description, valid);
    this.closeCreate();
    this._reRender();
    (_g = window.showToast) == null ? void 0 : _g.call(window, `✓ DLC「${name}」已创建（${dlcCount(dlc.knowledgeItems)} 条知识），激活后即注入创作`, "success");
  },
  /* ---------- 编辑包内条目 ---------- */
  _editingDLCId: null,
  editKnowledge(dlcId) {
    const dlc = window.storyDLCManager.getDLC(dlcId);
    if (!dlc) return;
    this._editingDLCId = dlcId;
    let modal = document.getElementById("dlcEditModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "dlcEditModal";
      modal.className = "modal-overlay";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeEdit();
      });
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-box wide">
            <div class="modal-header">
                <span>✏️ 编辑 DLC 条目 · ${dlcEsc(d.name)}</span>
                <button class="modal-close" onclick="StoryDLCUI.closeEdit()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-tip">${dlc.activated ? "⚠️ 该 DLC 已激活：保存后将自动「停用 → 更新 → 重新激活」，知识库随之同步。" : "该 DLC 未激活：修改只保存到包内，激活时生效。"}</div>
                <div class="form-row">
                    <label>知识条目（JSON 数组）</label>
                    <textarea id="dlcEditKnowledgeInput" class="kb-json-editor" rows="14">${dlcEsc(JSON.stringify(dlc.knowledgeItems, null, 2))}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-ghost" onclick="StoryDLCUI.closeEdit()">取消</button>
                <button class="btn-solid" onclick="StoryDLCUI.saveEditedKnowledge()">保存修改</button>
            </div>
        </div>`;
    modal.style.display = "flex";
  },
  closeEdit() {
    const modal = document.getElementById("dlcEditModal");
    if (modal) modal.style.display = "none";
    this._editingDLCId = null;
  },
  saveEditedKnowledge() {
    var _a, _b, _c, _d, _e;
    const dlcId = this._editingDLCId;
    const dlc = window.storyDLCManager.getDLC(dlcId);
    if (!dlc) return;
    let items;
    try {
      items = JSON.parse(document.getElementById("dlcEditKnowledgeInput").value);
    } catch (err) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, `JSON 解析失败：${err.message}`, "error");
      return;
    }
    if (!Array.isArray(items)) {
      (_b = window.showToast) == null ? void 0 : _b.call(window, "知识条目必须是 JSON 数组", "error");
      return;
    }
    const valid = items.filter((i) => i && i.title && i.content);
    if (!valid.length) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "没有有效条目：每条至少需要 title 与 content", "error");
      return;
    }
    try {
      const { reactivated } = window.storyDLCManager.updateDLCKnowledge(dlcId, valid);
      this.closeEdit();
      this._reRender();
      (_d = window.showToast) == null ? void 0 : _d.call(window, `✓ DLC「${dlc.name}」条目已更新（${valid.length} 条）${reactivated ? "，并已重新激活同步知识库" : ""}`, "success");
    } catch (err) {
      (_e = window.showToast) == null ? void 0 : _e.call(window, `保存失败：${err.message}`, "error");
    }
  },
  /* ---------- 导入 / 导出 ---------- */
  exportOne(dlcId) {
    var _a;
    const dlc = window.storyDLCManager.getDLC(dlcId);
    if (!dlc) return;
    const payload = {
      version: "1.0",
      type: "dlc_package",
      app: "云境",
      exportTime: (/* @__PURE__ */ new Date()).toISOString(),
      dlc
    };
    this._download(JSON.stringify(payload, null, 2), `DLC_${dlc.name}_${Date.now()}.json`);
    (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 已导出 DLC「${dlc.name}」（${dlcCount(dlc.knowledgeItems)} 条知识）`, "success");
  },
  exportAll() {
    var _a, _b;
    const m = window.storyDLCManager;
    if (!m.dlcPackages.length) {
      (_a = window.showToast) == null ? void 0 : _a.call(window, "暂无 DLC 可导出", "error");
      return;
    }
    const payload = {
      version: "1.0",
      type: "dlc_collection",
      app: "云境",
      exportTime: (/* @__PURE__ */ new Date()).toISOString(),
      dlcPackages: m.dlcPackages
    };
    this._download(JSON.stringify(payload, null, 2), `云境DLC合集_${m.genre}_${Date.now()}.json`);
    (_b = window.showToast) == null ? void 0 : _b.call(window, `✓ 已导出全部 ${m.dlcPackages.length} 个 DLC 知识包`, "success");
  },
  /**
   * 导入文件（模仿原框架 importDLC 的多格式兼容）：
   *   - dlc_package（单包）/ dlc_collection（合集）：直接导入
   *   - 普通知识库文件 {knowledge:[...]} 或条目数组：自动转换为 DLC 包
   */
  importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      var _a;
      const file = (_a = input.files) == null ? void 0 : _a[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        var _a2, _b;
        let data;
        try {
          data = JSON.parse(e.target.result);
        } catch (err) {
          (_a2 = window.showToast) == null ? void 0 : _a2.call(window, `文件解析失败：${err.message}`, "error");
          return;
        }
        try {
          await this._importParsed(data, file.name);
        } catch (err) {
          (_b = window.showToast) == null ? void 0 : _b.call(window, `导入失败：${err.message}`, "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
  async _importParsed(data, filename = "") {
    var _a, _b, _c, _d;
    const m = window.storyDLCManager;
    if ((data == null ? void 0 : data.type) === "dlc_collection" && Array.isArray(data.dlcPackages)) {
      let count = 0;
      for (const d2 of data.dlcPackages) {
        m.importDLC(d2);
        count++;
      }
      this._reRender();
      (_a = window.showToast) == null ? void 0 : _a.call(window, `✓ 已导入 DLC 合集（${count} 个包，均未激活，请在面板中激活）`, "success");
      return;
    }
    if ((data == null ? void 0 : data.type) === "dlc_package" && data.dlc) {
      m.importDLC(data.dlc);
      this._reRender();
      (_b = window.showToast) == null ? void 0 : _b.call(window, `✓ 已导入 DLC「${data.dlc.name}」（未激活，请点击「激活」注入知识库）`, "success");
      return;
    }
    let items = null;
    if (Array.isArray(data)) items = data;
    else if (Array.isArray(data == null ? void 0 : data.knowledge)) items = data.knowledge;
    else if (Array.isArray(data == null ? void 0 : data.items)) items = data.items;
    if (!items) throw new Error("未识别的文件格式（支持 dlc_package / dlc_collection / 知识库文件）");
    const valid = items.filter((i) => i && i.title && i.content);
    if (!valid.length) throw new Error("文件中没有有效的知识条目（需要 title 与 content 字段）");
    const defaultName = (filename.replace(/\.json$/i, "") || "导入的知识包").slice(0, 30);
    const name = await window.UIDialog.prompt({
      title: "转换为 DLC 知识包",
      message: `检测到普通知识库文件（${valid.length} 条有效条目），将转换为 DLC 知识包。
请为转换后的 DLC 命名：`,
      defaultValue: defaultName,
      placeholder: "DLC 名称（30 字以内）",
      confirmText: "转换并导入"
    });
    if (!name || !name.trim()) {
      (_c = window.showToast) == null ? void 0 : _c.call(window, "已取消导入", "info");
      return;
    }
    const dlc = m.createDLC(name.trim(), (data == null ? void 0 : data.description) || `由知识库文件「${filename}」转换（${valid.length} 条）`, valid);
    dlc.source = "imported_knowledge_base";
    dlc.originalFile = filename;
    m.save();
    this._reRender();
    (_d = window.showToast) == null ? void 0 : _d.call(window, `✓ 已转换为 DLC「${dlc.name}」（${valid.length} 条知识，未激活）`, "success");
  },
  _download(content, filename) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};
function dlcEsc(s) {
  return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function dlcEscAttr(s) {
  return dlcEsc(s);
}
function dlcTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return String(iso);
  }
}
window.StoryDLCUI = StoryDLCUI;
