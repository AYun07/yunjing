/* 云境 · 世界基座 v3.56.1
 * 统一实体模型 (Entity) + 变量模板 (Schema) + 校验器 (SchemaValidator)
 * ——「让世界活起来」P1 地基。零侵入现有 AI 自由生成链路：所有能力以
 *   后处理 / 模块钩子 / 暴露 API 方式叠加，旧档默认兼容。
 *
 * 设计要点：
 *  - Schema：设计者可预定义「本世界有哪些字段 + 类型 + 约束」，AI 仍自由生成，
 *    由 SchemaValidator 在解析出口做钳制 / 补默认 / 越界收敛（不否决 AI）。
 *  - Entity：一统 角色/法宝/势力/地点/关系 的概念，存于 vars.entities，并与
 *    vars.characters / vars.items 保持引用镜像（不改写旧路径，零破坏）。
 *  - 升级策略：P1 先做「收敛 + 镜像」，不搬迁旧数据结构；P2 的 entity-editor
 *    才在此之上长出统一填表 UI。
 */
(function () {
  "use strict";

  /* ---------- 基础工具 ---------- */
  function isObj(o) { return o && typeof o === "object" && !Array.isArray(o); }
  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }
  function deepMerge(base, patch) {
    if (!isObj(base) || !isObj(patch)) return patch === undefined ? base : patch;
    const out = clone(base);
    for (const k of Object.keys(patch)) {
      if (isObj(patch[k]) && isObj(out[k])) out[k] = deepMerge(out[k], patch[k]);
      else if (patch[k] !== undefined) out[k] = patch[k];
    }
    return out;
  }
  function clampNum(v, min, max) {
    let n = Number(v);
    if (isNaN(n)) return null;
    n = Math.round(n);
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  /* ---------- 默认变量模板（可被 per-genre 覆盖） ---------- */
  const DEFAULT_SCHEMA = {
    version: 1,
    /* 顶层标量约束：仅做越界收敛，不强行补默认值（避免注入噪声） */
    scalars: {
      chapter:      { type: "int", min: 0, max: 9999, label: "章节" },
      totalChapters:{ type: "int", min: 0, max: 9999, label: "总章数" },
      wordCount:    { type: "int", min: 0, max: 100000000, label: "字数" },
      tension:      { type: "int", min: 0, max: 100, label: "叙事张力" },
      cash:         { type: "string", max: 60, label: "资产" },
      savings:      { type: "string", max: 60, label: "积蓄" }
    },
    /* 实体字段约束（设计者可在 UI 扩写） */
    entities: {
      character: {
        required: ["name"],
        fields: {
          role:       { type: "string", max: 40, label: "身份" },
          age:        { type: "int", min: 0, max: 999, label: "年龄" },
          trust:      { type: "int", min: 0, max: 100, label: "信任度" },
          favor:      { type: "int", min: 0, max: 100, label: "好感度" },
          location:   { type: "string", max: 60, label: "位置" },
          relationship: { type: "string", max: 50, label: "关系" }
        }
      },
      item: {
        fields: {
          rarity: { type: "enum", enumValues: ["凡品", "灵品", "宝物", "仙器", "神器", "未知"], default: "未知", label: "品阶" },
          count:  { type: "int", min: 0, max: 999999, label: "数量" },
          owner:  { type: "ref", refType: "character", label: "持有者" }
        }
      },
      faction: {
        fields: {
          ideology: { type: "string", max: 80, label: "理念" },
          territory:{ type: "string", max: 80, label: "势力范围" },
          members:  { type: "int", min: 0, max: 1e9, label: "成员数" }
        }
      },
      place: {
        fields: {
          region: { type: "string", max: 40, label: "区域" },
          danger:{ type: "int", min: 0, max: 100, label: "危险度" },
          owner:  { type: "ref", refType: "faction", label: "归属" }
        }
      }
    },
    /* 中文别名 → 统一字段键（与 variable-parser 的 CHAR_ALIAS/CELL_ALIAS 互补，不重复） */
    aliases: {
      "年龄": "age", "外貌": "appearance", "信任": "trust", "好感": "favor",
      "位置": "location", "身份": "role", "关系": "relationship", "品阶": "rarity", "数量": "count"
    },
    relationKinds: ["敌对", "盟友", "同伴", "师徒", "从属", "情缘", "亲族", "陌路"]
  };

  /* ---------- SchemaRegistry：按 genre 存取模板 ---------- */
  const SchemaRegistry = {
    _cache: {},
    base() { return clone(DEFAULT_SCHEMA); },
    resolveGenre() {
      const fw = window.storyFramework;
      return (fw && fw.storyState && fw.storyState.genre) ||
             (window.WorldExt && window.WorldExt.genre) || "__default__";
    },
    get(genre) {
      genre = genre || this.resolveGenre();
      if (this._cache[genre]) return this._cache[genre];
      let s = this.base();
      try {
        const raw = localStorage.getItem("yunjing.schema." + genre);
        if (raw) s = deepMerge(s, JSON.parse(raw));
      } catch (e) { /* 损坏的覆盖档忽略 */ }
      this._cache[genre] = s;
      return s;
    },
    /** 设计者覆盖模板（运行时持久化到 localStorage，立即生效） */
    set(genre, patch) {
      genre = genre || this.resolveGenre();
      const merged = deepMerge(this.get(genre), patch);
      this._cache[genre] = merged;
      try { localStorage.setItem("yunjing.schema." + genre, JSON.stringify(merged)); } catch (e) {}
      return merged;
    },
    reset(genre) {
      genre = genre || this.resolveGenre();
      delete this._cache[genre];
      try { localStorage.removeItem("yunjing.schema." + genre); } catch (e) {}
      return this.base();
    }
  };

  /* ---------- EntityStore：统一实体存储 + 旧档幂等镜像 ---------- */
  const EntityStore = {
    TYPES: ["character", "item", "faction", "place", "relation"],
    /* v3.57.1 修复：单复数归一——此前 list("characters") 会拼出 "characterss" 恒 undefined，
       导致关系连线等依赖 list 的功能在角色池上静默失效。现接受单/复数两种入参。 */
    _norm(type) {
      const t = String(type || "");
      return ({ characters: "character", items: "item", factions: "faction", places: "place" })[t] || t;
    },
    /** 确保 vars.entities 结构存在（不破坏任何既有字段） */
    ensure(vars) {
      if (!vars || typeof vars !== "object") return null;
      if (!isObj(vars.entities)) vars.entities = {};
      ["characters", "items", "factions", "places"].forEach((t) => {
        if (!isObj(vars.entities[t])) vars.entities[t] = {};
      });
      if (!Array.isArray(vars.entities.relations)) vars.entities.relations = [];
      return vars.entities;
    },
    /** 幂等镜像：把 vars.characters / vars.items 的引用同步进 vars.entities（不改写旧路径） */
    bootstrap(vars) {
      this.ensure(vars);
      const ent = vars.entities;
      if (isObj(vars.characters)) {
        for (const [n, c] of Object.entries(vars.characters)) {
          if (isObj(c)) ent.characters[n] = c; // 同引用：编辑自动双向同步
        }
      }
      if (Array.isArray(vars.items)) {
        vars.items.forEach((it) => {
          if (it && it.name) ent.items[it.name] = Object.assign({ count: it.count || 1 }, it);
        });
      }
      return ent;
    },
    upsert(type, data, vars) {
      type = this._norm(type);
      if (!this.TYPES.includes(type) || !isObj(data)) return null;
      vars = vars || (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (!vars) return null;
      this.ensure(vars);
      const id = data.id || ("ent_" + type + "_" + (data.name || Math.random().toString(36).slice(2, 8)));
      const ent = Object.assign({ id, type, name: data.name || id, source: data.source || "schema" }, data);
      if (type === "relation") vars.entities.relations.push(ent);
      else vars.entities[type + "s"][id] = ent;
      return ent;
    },
    list(type, vars) {
      vars = vars || (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (!vars) return type === "relation" ? [] : {};
      this.ensure(vars);
      const t = this._norm(type);
      return t === "relation" ? (vars.entities.relations || []) : (vars.entities[t + "s"] || {});
    },
    get(id, vars) {
      vars = vars || (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (!vars || !vars.entities) return null;
      for (const t of ["characters", "items", "factions", "places"]) {
        if (isObj(vars.entities[t]) && vars.entities[t][id]) return vars.entities[t][id];
      }
      return null;
    },
    remove(id, vars) {
      vars = vars || (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (!vars || !vars.entities) return false;
      let ok = false;
      for (const t of ["characters", "items", "factions", "places"]) {
        if (isObj(vars.entities[t]) && vars.entities[t][id]) { delete vars.entities[t][id]; ok = true; }
      }
      if (Array.isArray(vars.entities.relations)) {
        /* v3.56.2 修复：删实体时级联清掉以其为端点的关系边（a/b 任一命中），
           否则关系网会残留悬空引用。 */
        const before = vars.entities.relations.length;
        vars.entities.relations = vars.entities.relations.filter((r) => r.id !== id && r.a !== id && r.b !== id);
        if (vars.entities.relations.length !== before) ok = true;
      }
      return ok;
    },
    /** 统一关系网：aId -[kind,strength]- bId */
    link(aId, kind, bId, strength, vars) {
      vars = vars || (window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables);
      if (!vars) return null;
      this.ensure(vars);
      const rel = { id: "rel_" + aId + "_" + bId, type: "relation", a: aId, b: bId, kind: kind || "陌路", strength: clampNum(strength, -100, 100) || 0, at: Date.now() };
      const arr = vars.entities.relations;
      const i = arr.findIndex((r) => r.a === aId && r.b === bId);
      if (i >= 0) arr[i] = rel; else arr.push(rel);
      return rel;
    }
  };

  /* ---------- SchemaValidator：解析出口收敛 ---------- */
  const SchemaValidator = {
    /** 对 AI 产出的变量集做后处理（钳制 / 越界收敛 / 锁定跳过），返回同一对象 */
    sanitize(vars, currentVars) {
      if (!isObj(vars)) return vars;
      const g = SchemaRegistry.resolveGenre();
      const sc = SchemaRegistry.get(g);
      EntityStore.bootstrap(vars);

      /* 顶层标量越界收敛 */
      for (const k of Object.keys(sc.scalars || {})) {
        if (vars[k] === undefined || vars[k] === null) continue;
        const def = sc.scalars[k];
        if (def.type === "int" || def.type === "number") {
          const n = clampNum(vars[k], def.min, def.max);
          if (n !== null) vars[k] = n;
        } else if (def.type === "string" && def.max && typeof vars[k] === "string" && vars[k].length > def.max) {
          vars[k] = vars[k].slice(0, def.max);
        }
      }

      /* 角色字段：数值钳制 + 跳过玩家锁定字段 */
      if (isObj(vars.characters)) {
        const cf = (sc.entities.character && sc.entities.character.fields) || {};
        for (const c of Object.values(vars.characters)) {
          if (!isObj(c)) continue;
          const locked = Array.isArray(c.locked) ? c.locked : [];
          for (const fk of Object.keys(cf)) {
            if (locked.includes(fk)) continue;            // 玩家锁定的字段 AI 永不覆盖（双保险）
            if (c[fk] === undefined) continue;
            const def = cf[fk];
            if (def.type === "int" || def.type === "number") {
              const n = clampNum(c[fk], def.min, def.max);
              if (n !== null) c[fk] = n;
            } else if (def.type === "string" && def.max && typeof c[fk] === "string" && c[fk].length > def.max) {
              c[fk] = c[fk].slice(0, def.max);
            }
          }
        }
      }

      /* 道具品阶枚举收敛：非法值回退默认 */
      if (Array.isArray(vars.items)) {
        const itemDef = (sc.entities.item && sc.entities.item.fields) || {};
        const rarityDef = itemDef.rarity;
        if (rarityDef && Array.isArray(rarityDef.enumValues)) {
          vars.items.forEach((it) => {
            if (it && it.rarity && !rarityDef.enumValues.includes(it.rarity)) it.rarity = rarityDef.default;
          });
        }
      }
      return vars;
    }
  };

  /* 全局暴露（window.* 兼顾脚本加载顺序；const 供同 realm 直接引用） */
  window.SchemaRegistry = SchemaRegistry;
  window.EntityStore = EntityStore;
  window.SchemaValidator = SchemaValidator;
  window.WorldSchema = { SchemaRegistry, EntityStore, SchemaValidator, DEFAULT_SCHEMA };
})();
