/* 云境 v3.55.30 · 多连接配置（Connection Profiles）
 * 借鉴酒馆 Connection Profiles 的思路：把「主笔写正文」之外的机械活（状态登记、滚动摘要）
 * 拆给独立的廉价跟随模型，各存独立 API 地址 / Key / 模型，按需指派给不同副 AI 角色。
 * 主叙事（主笔）接口仍走 storyFramework.apiConfig，本模块只管「副 AI」侧的多连接。
 *
 * 存储：
 *   localStorage['yunjing.profiles']     = [{id,name,type,endpoint,apiKey,model,maxTokens,temperature,timeout}, ...]
 *   localStorage['yunjing.profileRoles'] = { varAI: <profileId|"__legacy__"|null>, summary: <profileId|"__main__"|null> }
 * 角色：
 *   varAI   —— 副AI变量 · 状态登记官（原第三接口）
 *   summary —— 副AI摘要 · 前情提要官（滚动摘要）
 * 解析优先级：assigned 且字段填全 → 用该连接；否则返回 null，调用方走各自兜底（legacy 单配置 / 主笔）。 */
(function () {
  "use strict";
  var LS_PROFILES = "yunjing.profiles";
  var LS_ROLES = "yunjing.profileRoles";
  var ROLES = ["varAI", "summary"];
  // 角色选择里的伪选项（非真实 profile id）
  var LEGACY = "__legacy__"; // varAI：沿用下方「变量AI」单配置
  var MAIN = "__main__";     // summary：复用主笔接口

  function read(key, dflt) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : dflt;
    } catch (e) { return dflt; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }
  function uid() {
    return "cp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function normType(t) { return t === "gemini" ? "gemini" : "openai"; }

  var ConnectionProfiles = {
    KEY_PROFILES: LS_PROFILES,
    KEY_ROLES: LS_ROLES,
    ROLES: ROLES,
    LEGACY: LEGACY,
    MAIN: MAIN,

    list: function () {
      var arr = read(LS_PROFILES, []);
      return Array.isArray(arr) ? arr : [];
    },
    get: function (id) {
      if (!id) return null;
      var all = this.list();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },
    /** 保存（新建或更新），返回保存后的对象 */
    upsert: function (profile) {
      var arr = this.list();
      var p = {};
      var k;
      for (k in profile) if (Object.prototype.hasOwnProperty.call(profile, k)) p[k] = profile[k];
      if (!p.id) p.id = uid();
      p.type = normType(p.type);
      p.maxTokens = Number(p.maxTokens) || 4096;
      p.temperature = (typeof p.temperature === "number") ? p.temperature : (Number(p.temperature) || 0.2);
      p.timeout = Number(p.timeout) || 90;
      var idx = -1;
      for (var i = 0; i < arr.length; i++) if (arr[i].id === p.id) { idx = i; break; }
      if (idx >= 0) arr[idx] = p; else arr.push(p);
      write(LS_PROFILES, arr);
      return p;
    },
    remove: function (id) {
      write(LS_PROFILES, this.list().filter(function (p) { return p.id !== id; }));
      var roles = this.roles();
      var changed = false;
      ROLES.forEach(function (r) {
        if (roles[r] === id) { roles[r] = null; changed = true; }
      });
      if (changed) write(LS_ROLES, roles);
    },
    roles: function () {
      var r = read(LS_ROLES, {});
      return { varAI: r.varAI || null, summary: r.summary || null };
    },
    assign: function (role, id) {
      if (ROLES.indexOf(role) < 0) return;
      if (id !== LEGACY && id !== MAIN && id !== null && !this.get(id)) return; // 只接受已知 profile 或伪选项
      var roles = this.roles();
      roles[role] = id || null;
      write(LS_ROLES, roles);
    },
    /** 该角色当前指派（含伪选项值）；未指派返回 null */
    roleValue: function (role) { return this.roles()[role] || null; },
    /** 该角色当前指派的真实连接对象（伪选项/未指派返回 null） */
    roleProfile: function (role) {
      var id = this.roles()[role];
      if (!id || id === LEGACY || id === MAIN) return null;
      return this.get(id);
    },
    /** 解析某角色要用的配置；未指派或连接缺字段返回 null（调用方走兜底） */
    resolve: function (role) {
      var p = this.roleProfile(role);
      if (!p || !p.endpoint || !p.apiKey || !p.model) return null;
      return {
        type: p.type, endpoint: p.endpoint, apiKey: p.apiKey, model: p.model,
        maxTokens: p.maxTokens || 4096, temperature: (p.temperature != null) ? p.temperature : 0.2,
        timeout: p.timeout || 90
      };
    },
    /** 下拉列表源：连接 + 两个伪选项（按角色给文案） */
    picklist: function (role) {
      var out = this.list().map(function (p) {
        return { id: p.id, name: p.name || p.model || p.endpoint || "(未命名)" };
      });
      if (role === "varAI") out.push({ id: LEGACY, name: "（沿用下方「变量AI」单配置）" });
      if (role === "summary") out.push({ id: MAIN, name: "（复用主笔接口兜底）" });
      out.unshift({ id: "", name: "（未指派）" });
      return out;
    },
    /** 首次运行：把已有的「变量AI 单配置」迁成一个默认连接并指派给 varAI 角色，
     *  老用户从既有配置平滑过渡；仅执行一次（哨兵标记）。 */
    migrateLegacy: function () {
      try {
        if (localStorage.getItem("yunjing.profilesMigrated") === "1") return;
        localStorage.setItem("yunjing.profilesMigrated", "1");
        if (this.list().length) return;
        var raw = null;
        try { raw = JSON.parse(localStorage.getItem("storyVarApi") || "{}"); } catch (e) { raw = null; }
        if (raw && raw.endpoint && raw.apiKey && raw.model) {
          var p = this.upsert({
            name: "变量AI（从旧配置迁移）",
            type: raw.type || "openai",
            endpoint: raw.endpoint, apiKey: raw.apiKey, model: raw.model,
            maxTokens: raw.maxTokens || 4096,
            temperature: (raw.temperature != null) ? raw.temperature : 0.2,
            timeout: raw.timeout || 90
          });
          this.assign("varAI", p.id);
        }
      } catch (e) { }
    }
  };

  // 模块加载即迁移一次（config-modal 打开前数据就绪，VariableAI 取值不踩空）
  try { ConnectionProfiles.migrateLegacy(); } catch (e) { }

  window.ConnectionProfiles = ConnectionProfiles;
})();
