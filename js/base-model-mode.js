/* =====================================================================
   云境 · 基础小模型适配（v3.55.10 新增）
   ---------------------------------------------------------------------
   面向免费/基础级大模型（如 agnes-3.0-flash 一类小杯模型）的专项适配层。
   实测结论（2025-10 真机实测，凡人修仙传新档 6 轮+）：
   ① 温度 0.9 时小模型会"复读崩塌"——开篇一路同义堆砌到上万字；
   ② 输出上限 <8000 时正文被截断，续写泄漏格式自言自语；
   ③ 变量AI"主笔兜底登记"每轮额外发一次请求，免费档必 429；
   ④ 全量云起预设（数万字协议）小模型注意力扛不住，协议遵从率低。
   本模块提供四件事（接口设置勾选「基础小模型适配」后生效）：
   1. 参数安全锁：温度压到 ≤0.75、输出上限默认 8000（够装完整回合，
      又不给小模型跑飞的空间）；
   2. 提示词瘦身：咩咩全量预设 → 轻量核心协议块（云心人格精简版）；
      知识库背景注入与生图/沉浸指令暂停加载（前景检索保留）；
   3. 辅助AI静默：变量AI兜底登记与灵感引擎暂停额外请求，变量块改由
      主笔直接在正文输出、云境自带解析器照常解析（实测状态面板照满）；
   4. 复读自检：检测到复读崩塌自动降温重发一次，用户无感。
   强模型用户不需要开启——一切行为保持原样。
   ===================================================================== */
(function () {
  'use strict';

  const LS_KEY = 'yj_baseModelMode';

  function fwApiConfig() {
    try {
      const fw = window.storyFramework;
      if (fw) return fw.apiConfig || (fw.apiConfig = {});
    } catch (e) {}
    return null;
  }

  function isEnabled() {
    install(); // 惰性安装辅助AI补丁（幂等）
    try {
      const cfg = fwApiConfig();
      if (cfg && typeof cfg.baseModelMode === 'boolean') return cfg.baseModelMode;
    } catch (e) {}
    try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
  }

  function setEnabled(on) {
    try {
      const cfg = fwApiConfig();
      if (cfg) {
        cfg.baseModelMode = !!on;
        if (window.storyFramework && window.storyFramework.saveApiConfig) window.storyFramework.saveApiConfig();
      }
    } catch (e) {}
    try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch (e) {}
  }

  /* ---------- 1. 参数安全锁 ---------- */
  function clampParams(cfg) {
    if (!cfg) return cfg;
    const c = Object.assign({}, cfg);
    // 温度：>0.75 一律压到 0.75（实测 0.9 是复读崩塌的直接诱因）
    if (typeof c.temperature !== 'number' || c.temperature > 0.75) c.temperature = 0.75;
    // 输出上限：实测 <8000 会截断泄漏、>16384 会跑飞；8000 恰好装下完整回合
    if (!c.maxTokens || c.maxTokens > 8000) c.maxTokens = 8000;
    return c;
  }

  /* ---------- 2. 轻量核心协议块（云心精简版，替代全量咩咩预设） ---------- */
  function buildLitePreset(playerName) {
    const hero = playerName || '主角';
    return `【云心·执笔人格（轻量版）】
你是"云心"——冷静、克制、老练的互动小说执笔人，为玩家（${hero}）主持这个世界。以第三人称贴着主角写，文风朴素具体：多写可看见、可听见、可摸到的细节，少用抽象形容。

【铁律（每一条都不可违反）】
1. 防抢话：主角（${hero}）的言语、决定、内心活动一律不代写，只写外部世界、环境与其他角色的言行反应，把选择权留给玩家。
2. 杀八股：禁用滥俗套路——"空气仿佛凝固""嘴角勾起一抹弧度""心中掀起惊涛骇浪""眼底闪过一丝精光"之类一律不准出现，改用具体的动作、表情或感官细节。
3. 篇幅：每轮正文严格 700~1100 字，写到一个自然的落点收笔，不注水、不复读、不同义堆砌。
4. 输出顺序固定为：正文 → 空一行 → (variable_update) 变量块 → 【行动选项】→ <status> 状态栏。顺序不可颠倒，正文永远是主体、不可省略。

【变量块】正文写完后输出一次，标签必须成对闭合：
(variable_update)
回合=回合+1
（每行一条 key=value，例如：灵石=灵石-5；位置=青牛镇；机缘=机缘+1）
(/variable_update)

【行动选项】变量块后给 3~4 条玩家可选行动，每条一行，格式：
1. 行动描述

【状态栏】最后输出，缺少 <status> 块的回复视为不完整输出：
<status>
回合：X ｜ 位置：X ｜ 状态：X
</status>`;
  }

  /* ---------- 4. 复读崩塌检测 ---------- */
  function detectCollapse(text) {
    if (!text || typeof text !== 'string' || text.length < 400) return false;
    const T = text.replace(/\s+/g, '');
    // ① 6字片段高频重复（同义堆砌的指纹）
    const grams = Object.create(null);
    const scan = Math.min(T.length, 5000);
    for (let i = 0; i + 6 <= scan; i++) {
      const g = T.substr(i, 6);
      grams[g] = (grams[g] || 0) + 1;
    }
    let max = 0;
    for (const k in grams) if (grams[k] > max) max = grams[k];
    if (max >= 10) return true;
    // ② 同一非空行重复 ≥4 次
    const lines = text.split('\n').map((s) => s.trim()).filter((s) => s.length > 4);
    const lc = Object.create(null);
    let lmax = 0;
    for (const l of lines) { lc[l] = (lc[l] || 0) + 1; if (lc[l] > lmax) lmax = lc[l]; }
    return lmax >= 4;
  }

  /* ---------- 3. 辅助AI静默补丁（惰性、幂等、可逆） ---------- */
  let installed = false;
  function install() {
    if (installed) return;
    const va = window.VariableAI;
    if (va && !va.__bmmPatched) {
      va.__bmmPatched = true;
      const oEnabled = va.isEnabled ? va.isEnabled.bind(va) : null;
      const oFallback = va.isFallbackActive ? va.isFallbackActive.bind(va) : null;
      va.isEnabled = function () { return isEnabledRaw() ? false : (oEnabled ? oEnabled() : false); };
      va.isFallbackActive = function () { return isEnabledRaw() ? false : (oFallback ? oFallback() : false); };
      /* recapReady 兜底是"主接口已配置即放行"，会放行每轮的记忆登记官/舞台监督
         小请求（免费档 429 噪音源之二），一并静默 */
      if (va.recapReady && !va.__bmmOrigRecapReady) {
        va.__bmmOrigRecapReady = va.recapReady.bind(va);
        va.recapReady = function () { return isEnabledRaw() ? false : va.__bmmOrigRecapReady(); };
      }
    }
    const si = window.StoryInspiration;
    if (si && !si.__bmmPatched && si.isEnabled) {
      si.__bmmPatched = true;
      const oSI = si.isEnabled.bind(si);
      si.isEnabled = function () { return isEnabledRaw() ? false : oSI(); };
    }
  }
  // install() 内部用原始开关判断，避免递归
  function isEnabledRaw() {
    try {
      const cfg = fwApiConfig();
      if (cfg && typeof cfg.baseModelMode === 'boolean') return cfg.baseModelMode;
    } catch (e) {}
    try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
  }

  // 启动后与关键时机各尝试安装一次（补丁需等 VariableAI 就绪）
  window.addEventListener('load', function () { install(); setTimeout(install, 3000); });

  window.BaseModelMode = {
    isEnabled,
    isEnabledRaw,
    setEnabled,
    clampParams,
    buildLitePreset,
    detectCollapse,
    install
  };
})();
