/* 云境 · 统一填表编辑器 v3.57.0（P2）
 * schema 驱动的结构化填表：法宝 / 势力 / 地点 / 关系 一统入 EntityStore。
 * - 字段与约束取自 SchemaRegistry（设计者改模板，表单即跟着变）
 * - 法宝仍回写 vars.items（旧路径零破坏），势力/地点/关系走统一实体库
 * - 编辑器暴露 _applySave 供测试；UI 为自包含浮层，不依赖运行时框架
 */
(function () {
  "use strict";
  const TYPES = {
    item:    { label: "法宝", icon: "⚔️" },
    faction: { label: "势力", icon: "🏛️" },
    place:   { label: "地点", icon: "🗺️" }
  };
  function vars() {
    const fw = window.storyFramework;
    return (fw && fw.storyState && fw.storyState.variables) || null;
  }
  function save() { try { const fw = window.storyFramework; fw && fw.saveStory && fw.saveStory(); } catch (e) {} }
  function toast(m, t) { try { window.showToast && window.showToast(m, t || "success"); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function fieldsOf(type) {
    const s = window.SchemaRegistry && window.SchemaRegistry.get();
    return (s && s.entities && s.entities[type] && s.entities[type].fields) || {};
  }
  function relationKinds() {
    const s = window.SchemaRegistry && window.SchemaRegistry.get();
    return (s && s.relationKinds) || ["敌对", "盟友", "同伴", "师徒", "从属", "情缘", "亲族", "陌路"];
  }

  /* ---------- 表单构建 ---------- */
  function fieldRow(key, def, val) {
    const label = esc(def.label || key);
    if (def.type === "enum") {
      const opts = (def.enumValues || []).map((o) => `<option value="${esc(o)}" ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("");
      return `<label class="ent-f"><span>${label}</span><select data-k="${esc(key)}">${opts}</select></label>`;
    }
    if (def.type === "int") {
      return `<label class="ent-f"><span>${label}</span><input data-k="${esc(key)}" type="number" value="${esc(val != null ? val : "")}" min="${def.min != null ? def.min : ""}" max="${def.max != null ? def.max : ""}" placeholder="${esc(def.label || key)}"></label>`;
    }
    return `<label class="ent-f"><span>${label}</span><input data-k="${esc(key)}" type="text" value="${esc(val != null ? val : "")}" maxlength="${def.max || 60}" placeholder="${esc(def.label || key)}"></label>`;
  }

  /** 收集表单 → 校验 → 应用保存。独立出来供测试与 UI 双用 */
  function _applySave(type, data, oldName) {
    const v = vars();
    if (!v) return { ok: false, msg: "世界尚未开始" };
    const fields = fieldsOf(type);
    if (!data.name || !String(data.name).trim()) return { ok: false, msg: "名称不能为空" };
    data.name = String(data.name).trim().slice(0, 20);
    /* 按模板收敛类型/范围（与 SchemaValidator 同源逻辑） */
    for (const [k, def] of Object.entries(fields)) {
      if (data[k] === undefined || data[k] === "") {
        if (def.type === "enum" && def.default != null) data[k] = def.default;
        else delete data[k];
        continue;
      }
      if (def.type === "int") {
        let n = Math.round(Number(data[k]));
        if (isNaN(n)) { delete data[k]; continue; }
        if (def.min != null) n = Math.max(def.min, n);
        if (def.max != null) n = Math.min(def.max, n);
        data[k] = n;
      } else if (def.type === "enum" && Array.isArray(def.enumValues) && !def.enumValues.includes(data[k])) {
        data[k] = def.default != null ? def.default : def.enumValues[0];
      } else if (typeof data[k] === "string" && def.max && data[k].length > def.max) {
        data[k] = data[k].slice(0, def.max);
      }
    }
    if (type === "item") {
      v.items = Array.isArray(v.items) ? v.items : [];
      const target = v.items.find((x) => x && x.name === (oldName || data.name));
      if (target) Object.assign(target, data);
      else if (oldName) { /* 改名：替换整项保序 */ const i = v.items.findIndex((x) => x && x.name === oldName); if (i >= 0) v.items[i] = data; else v.items.push(data); }
      else v.items.push(data);
      try { window.EntityStore && window.EntityStore.bootstrap(v); } catch (e) {}
    } else {
      if (!window.EntityStore) return { ok: false, msg: "实体库未加载" };
      const ents = window.EntityStore.list(type, v);
      const existing = oldName ? Object.values(ents).find((e) => e.name === oldName) : Object.values(ents).find((e) => e.name === data.name);
      if (existing) { Object.assign(existing, data, { id: existing.id }); }
      else window.EntityStore.upsert(type, data, v);
    }
    save();
    return { ok: true };
  }

  /** 关系保存：按名字解析实体 → link */
  function _applyRelation(aName, bName, kind, strength) {
    const v = vars();
    if (!v || !window.EntityStore) return { ok: false, msg: "实体库未就绪" };
    if (!aName || !bName) return { ok: false, msg: "两端实体都要选" };
    if (aName === bName) return { ok: false, msg: "两端不能是同一实体" };
    const byName = (n) => {
      const es = window.EntityStore;
      for (const t of ["characters", "factions", "places", "items"]) {
        const pool = es.list(t, v) || {};
        const hit = pool[n] || Object.values(pool).find((e) => e && e.name === n);
        if (hit) return hit.id || hit.name;
      }
      return n; /* 容错：以名字为端点（characters 引用镜像 id=name） */
    };
    window.EntityStore.link(byName(aName), kind, byName(bName), Number(strength) || 0, v);
    save();
    return { ok: true };
  }

  /* ---------- 浮层 UI ---------- */
  function overlay(title, innerHTML, onOk) {
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(4,10,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;";
    ov.innerHTML = `<div style="width:min(420px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#0d1a20,#0a1418);border:1px solid #2a4a52;border-radius:14px;padding:18px;color:#cfe8e4;font-size:14px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:12px;color:#9adfd2;">${esc(title)}</div>
      ${innerHTML}
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button data-act="ok" style="flex:1;padding:9px;border:0;border-radius:8px;background:#1d6f60;color:#eafff8;font-weight:700;cursor:pointer;">保存</button>
        <button data-act="cancel" style="flex:1;padding:9px;border:1px solid #2a4a52;border-radius:8px;background:transparent;color:#8fb8b0;cursor:pointer;">取消</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.dataset.act === "cancel") { ov.remove(); return; }
      if (e.target.dataset.act === "ok") { if (onOk(ov) !== false) ov.remove(); }
    });
    return ov;
  }
  const ROW_CSS = "display:flex;gap:8px;align-items:center;margin:8px 0;";
  const IN_CSS = "flex:1;padding:8px 10px;border:1px solid #2a4a52;border-radius:8px;background:#08121a;color:#dff5ef;font-size:14px;";

  function open(type, oldName) {
    if (!TYPES[type]) { toast("未知实体类型", "error"); return; }
    const v = vars();
    if (!v) { toast("世界尚未开始，先开启故事", "error"); return; }
    const fields = fieldsOf(type);
    /* 取旧值 */
    let old = null;
    if (type === "item") old = (Array.isArray(v.items) ? v.items : []).find((x) => x && x.name === oldName) || null;
    else {
      const ents = (window.EntityStore && window.EntityStore.list(type, v)) || {};
      old = oldName ? (ents[oldName] || Object.values(ents).find((e) => e && e.name === oldName)) || null : null;
    }
    const rows = [`<label class="ent-f" style="${ROW_CSS}"><span style="width:56px;">名称</span><input data-k="name" type="text" value="${esc(old ? old.name : "")}" maxlength="20" placeholder="如：青元剑" style="${IN_CSS}"></label>`];
    for (const [k, def] of Object.entries(fields)) rows.push(fieldRow(k, def, old ? old[k] : undefined).replace("<label class=\"ent-f\">", `<label class="ent-f" style="${ROW_CSS}">`).replace("<span>", "<span style=\"width:56px;\">").replace(/(input[^>]*?)(>)/, `$1 style="${IN_CSS}" $2`).replace("<select", `<select style="${IN_CSS}"`));
    overlay(`${TYPES[type].icon} ${old ? "编辑" : "登记"}${TYPES[type].label}`, rows.join(""), (ov) => {
      const data = {};
      ov.querySelectorAll("[data-k]").forEach((el) => { data[el.dataset.k] = el.value; });
      const r = _applySave(type, data, oldName);
      if (!r.ok) { toast(r.msg, "error"); return false; }
      toast(`${TYPES[type].label}「${data.name}」已${oldName ? "更新" : "登记"}`);
      try { window.StoryStatusRenderer && window.StoryStatusRenderer.renderItems(Array.isArray(v.items) ? v.items : []); } catch (e) {}
    });
  }

  function openRelation() {
    const v = vars();
    if (!v) { toast("世界尚未开始", "error"); return; }
    const names = [];
    try {
      const es = window.EntityStore;
      if (es) for (const t of ["characters", "factions", "places", "items"]) {
        Object.values(es.list(t, v) || {}).forEach((e) => { if (e && e.name && !names.includes(e.name)) names.push(e.name); });
      }
    } catch (e) {}
    if (names.length < 2) { toast("先登记至少两个实体再来连线", "error"); return; }
    const opt = (sel) => names.map((n) => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
    const kinds = relationKinds().map((k) => `<option>${esc(k)}</option>`).join("");
    overlay(`⛓ 关系连线`, `
      <label style="${ROW_CSS}"><span style="width:56px;">甲方</span><select id="relA" style="${IN_CSS}">${opt(names[0])}</select></label>
      <label style="${ROW_CSS}"><span style="width:56px;">关系</span><select id="relK" style="${IN_CSS}">${kinds}</select></label>
      <label style="${ROW_CSS}"><span style="width:56px;">强度</span><input id="relS" type="number" min="-100" max="100" value="40" style="${IN_CSS}"><span style="font-size:12px;color:#6f9a92;">-100 恩怨 … +100 亲密</span></label>
      <label style="${ROW_CSS}"><span style="width:56px;">乙方</span><select id="relB" style="${IN_CSS}">${opt(names[1] || names[0])}</select></label>`,
      (ov) => {
        const r = _applyRelation(ov.querySelector("#relA").value, ov.querySelector("#relB").value, ov.querySelector("#relK").value, ov.querySelector("#relS").value);
        if (!r.ok) { toast(r.msg, "error"); return false; }
        toast("关系已连入世界之网");
      });
  }

  /* renderItems 用的登记入口行（挂在物品区底部） */
  function addRowHTML() {
    return `<div class="char-add-row" style="margin-top:8px;"><button class="char-add-btn" onclick="EntityEditor.open('item')">＋法宝</button><button class="char-add-btn" onclick="EntityEditor.open('faction')">＋势力</button><button class="char-add-btn" onclick="EntityEditor.open('place')">＋地点</button><button class="char-add-btn" onclick="EntityEditor.openRelation()">⛓关系</button></div>`;
  }

  window.EntityEditor = { open, openRelation, addRowHTML, _applySave, _applyRelation, TYPES };
})();
