/* =====================================================================
   云境 · 模型能力自适应（v3.55.11 重做）
   ---------------------------------------------------------------------
   目标：无论玩家用什么模型，都能「不出任何问题地畅玩」；用强模型的，
   只会在这个基础上输出更完美的内容。

   三档：
   · auto  （默认，零配置）系统按接口特征 + 首轮自检自动判断走 lite 还是 full
   · lite  （低端/基础/免费大模型）安全档：参数锁 + 轻量协议 + 辅助AI静默 + 复读自检
   · full  （高端大模型）全功能档：全量云起预设 + 变量/舞台/灵感/沉浸全开，原汁原味

   auto 判定（安全优先，零额外请求）：
   ① 域名初判：命中已知强模型官方/知名网关 → 初判 full；自定义/免费/未知 → 初判 lite；
   ② 首轮自检：开场回复若被 detectCollapse 判为「复读崩塌」→ 永久降级 lite（按
      endpoint+model 缓存，换模型重新判定）；
   ③ 判定结果缓存 7 天，避免每轮重判、避免重复浪费请求。

   所有档位共享的安全基线（已在 callStoryAI 全档生效）：
   · 复读自检：任意档检测到同义堆砌崩塌都自动降温重发一次（用户无感）；
   · 截断续写：MoNetGuard 防截断续写对所有档生效（不在这里管）。

   实测结论（agnes-3.0-flash 凡人修仙传新档 6 轮+，来自 v3.55.10）：
   ① 温度 0.9 时小模型「复读崩塌」开篇一路同义堆砌到上万字；
   ② 输出上限 <8000 时正文被截断、续写泄漏格式自言自语；
   ③ 变量AI「主笔兜底登记」每轮额外发一次请求，免费档必 429；
   ④ 全量云起预设（数万字协议）小模型注意力扛不住、协议遵从率低。
   lite 档即针对这四点兜底。
   ===================================================================== */
(function () {
  'use strict';

  const SET_KEY = 'yj_baseModelTier';            // 用户设置：'auto' | 'lite' | 'full'
  const CACHE_PREFIX = 'yj_bmm_resolved_';      // 按 endpoint|model 缓存实际判定
  const CACHE_TTL = 7 * 24 * 3600 * 1000;       // 7 天

  /* 已知强模型官方/知名网关域名关键词（命中→初判 full，期待更完美）。
     未命中（自定义/免费/未知）→ 初判 lite（安全优先）。 */
  const STRONG_KEYWORDS = [
    'openai.com', 'anthropic.com', 'googleapis.com', 'generativelanguage',
    'deepseek.com', 'moonshot.cn', 'dashscope', 'aliyuncs.com', 'volcengine.com',
    'doubao', 'zhipuai', 'bigmodel.cn', 'baichuan', 'minimax', '01.ai',
    'lingyiwanwu.com', 'tencentcloudapi.com', 'hunyuan', 'siliconflow',
    'openrouter.ai', 'cohere', 'mistral', 'ai21', 'groq', 'fireworks.ai',
    'qwen', 'kimi', 'stepfun', 'anthropic', 'x.ai', 'meta.ai',
    'nvidia'            // NVIDIA 托管网关：旗下多为强力对话模型（如 nemotron 系列），初判 full 走全功能
  ];

  function fwApiConfig() {
    try {
      const fw = window.storyFramework;
      if (fw) return fw.apiConfig || (fw.apiConfig = {});
    } catch (e) {}
    return null;
  }

  function epModelKey() {
    const cfg = fwApiConfig();
    if (!cfg) return '';
    return (cfg.endpoint || '') + '|' + (cfg.model || '');
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return 'h' + (Math.abs(h) >>> 0).toString(36);
  }

  /* ---------- 档位读取/写入（兼容旧 boolean） ---------- */
  function getTier() {
    let v;
    try { const cfg = fwApiConfig(); if (cfg && typeof cfg.baseModelMode === 'string') v = cfg.baseModelMode; } catch (e) {}
    if (!v) { try { v = localStorage.getItem(SET_KEY); } catch (e) {} }
    if (v === true || v === 'true') return 'lite';
    if (v === false || v === 'false') return 'auto';
    if (v !== 'lite' && v !== 'full') return 'auto';
    return v;
  }

  function setTier(tier) {
    if (tier !== 'auto' && tier !== 'lite' && tier !== 'full') tier = 'auto';
    try {
      const cfg = fwApiConfig();
      if (cfg) {
        cfg.baseModelMode = tier;
        if (window.storyFramework && window.storyFramework.saveApiConfig) window.storyFramework.saveApiConfig();
      }
    } catch (e) {}
    try { localStorage.setItem(SET_KEY, tier); } catch (e) {}
    clearResolvedCache(); // 用户改档后强迫重新判定
  }

  function isAuto() { return getTier() === 'auto'; }

  /* ---------- 域名初判 ---------- */
  function initialGuess() {
    const cfg = fwApiConfig();
    if (!cfg) return 'lite';
    const ep = (cfg.endpoint || '').toLowerCase();
    if (!ep) return 'lite'; // 无 endpoint（本地/占位）→ 保守
    for (const k of STRONG_KEYWORDS) if (ep.indexOf(k) !== -1) return 'full';
    return 'lite';
  }

  /* ---------- 解析实际档位（auto 时结合缓存+初判） ---------- */
  function resolveTier() {
    const setting = getTier();
    if (setting === 'lite' || setting === 'full') return setting;
    const key = epModelKey();
    if (key) {
      const cached = readResolved(key);
      if (cached) return cached;
    }
    return initialGuess();
  }

  function readResolved(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + hash(key));
      if (!raw) return null;
      const sep = raw.indexOf('|');
      const tier = sep === -1 ? raw : raw.slice(0, sep);
      const ts = sep === -1 ? 0 : parseInt(raw.slice(sep + 1), 10);
      if (tier !== 'lite' && tier !== 'full') return null;
      if (ts && Date.now() - ts > CACHE_TTL) return null;
      return tier;
    } catch (e) { return null; }
  }

  function cacheResolved(tier) {
    const key = epModelKey();
    if (!key) return;
    try { localStorage.setItem(CACHE_PREFIX + hash(key), tier + '|' + Date.now()); } catch (e) {}
  }

  function clearResolvedCache() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  /* 首轮自检回调：auto 档下根据开场回复质量缓存判定 */
  function noteCollapse() {
    if (!isAuto()) return;
    cacheResolved('lite');
  }
  function noteStable() {
    if (!isAuto()) return;
    const key = epModelKey();
    if (key && !readResolved(key)) cacheResolved(initialGuess());
  }

  function isLite() { return resolveTier() === 'lite'; }
  /* v4.00.0 低配档再分三档：8K 与 16K 的可支配额度差一倍，用同一套预算必然一边浪费一边爆窗。
     tiny(≤8K) / small(≤16K) / normal。推断不出窗口时按 small 处理（保守但不至于太寒酸）。 */
  function ctxTier() {
    const ctx = (window.PromptBudget && window.PromptBudget.ctxTokens && window.PromptBudget.ctxTokens()) || 0;
    if (ctx > 0 && ctx <= 8192) return 'tiny';
    if (ctx > 0 && ctx <= 16384) return 'small';
    return 'normal';
  }
  function isFull() { return resolveTier() === 'full'; }

  /* ---------- 1. 参数安全锁（仅 lite） ---------- */
  function clampParams(cfg) {
    if (!cfg) return cfg;
    if (!isLite()) return cfg; // full 档尊重用户设定，不锁
    const c = Object.assign({}, cfg);
    if (typeof c.temperature !== 'number' || c.temperature > 0.75) c.temperature = 0.75;
    if (!c.maxTokens || c.maxTokens > 8000) c.maxTokens = 8000;
    /* v4.01.0 8K 档输出上限按实测重定。
       上一版压到 1400，理由是「输入 6300 字符已占七成窗口」——但实测发现更糟：
       1400 token 约合 1000 字，模型写不到收尾就被掐断，自动续写接力 2 次，
       而每次续写的拼接处都会丢标点（实测单轮出现 14 处、403 字无标点长段，
       玩家看到的是「一句话没有逗号」的糊文）。
       对照实验（tiny 档 8K 窗口免费模型 / 同一 prompt）：
         max_tokens 1400 → 3019 字，续写 2 次，14 处丢标点
         max_tokens 2000 → 2049 字，续写 0 次，0 处丢标点，结尾自然收束
         max_tokens 2600 → 853 字（罚项归零时模型反而写短），标点正常但内容太干
       结论：2000 是这道窗口的甜点——输入 5766 字符(≈4270 token)+2000 输出=6270，
       距 8192 还有近 1900 token 余量。 */
    if (ctxTier() === 'tiny') {
      const mt = Number(c.maxTokens) || 2000;
      c.maxTokens = Math.max(900, Math.min(mt, 2000));
      /* 输入超过 6800 字符时，2000 输出会重新挤到窗口边缘（8K ≈ 8192 token，
         6800 字符 ≈ 5040 token，再加 2000 = 7040，余量只剩 1100）。
         按上一轮实际装配量回退，宁可让正文短一点，也不让它被掐成半句话。 */
      const rep = window.PromptBudget && window.PromptBudget.lastReport;
      const used = rep && Number(rep.total) || 0;
      if (used > 7400) c.maxTokens = Math.min(c.maxTokens, 1200);
      else if (used > 6800) c.maxTokens = Math.min(c.maxTokens, 1600);
    }
    return c;
  }

  /* ---------- 2. 轻量核心协议块（云心精简版，替代全量云起预设，仅 lite 用） ---------- */
  function buildLitePreset(playerName) {
    const hero = playerName || '主角';
    return `【云心·执笔人格（轻量版）】
你是"云心"——冷静、克制、老练的互动小说执笔人，为玩家（${hero}）主持这个世界。以第三人称贴着主角写，文风朴素具体：多写可看见、可听见、可摸到的细节，少用抽象形容。

【铁律（每一条都不可违反）】
1. 防抢话：主角（${hero}）的言语、决定、内心活动一律不代写，只写外部世界、环境与其他角色的言行反应，把选择权留给玩家。
2. 杀八股：禁用滥俗套路——"空气仿佛凝固""嘴角勾起一抹弧度""心中掀起惊涛骇浪""眼底闪过一丝精光"之类一律不准出现，改用具体的动作、表情或感官细节。
3. 篇幅：每轮正文严格 700~1100 字，写到一个自然的落点收笔，不注水、不复读、不同义堆砌。
4. 输出顺序固定为：正文 → 空一行 → (variable_update) 变量块 → 【行动选项】→ <status> 状态栏。顺序不可颠倒，正文永远是主体、不可省略。

【变量块】正文写完后输出一次，标签必须成对闭合；字段名一律用中文（回合/位置/灵石/机缘…），禁止英文 key。
**「情欲」每轮必报（无则写 无）、「亲密关系」每轮必报（无则写 无）**——这两格是成人向状态栏的常驻字段，缺了它们状态栏就看不到 NSFW 状态：
(variable_update)
回合=回合+1
情欲=无
亲密关系=无
（每行一条 key=value，例如：灵石=灵石-5；位置=青牛镇；机缘=机缘+1）
(/variable_update)

【行动选项】变量块后必须给恰好 6 条玩家可选行动，每行一条，行首用 1.~6.，六类各一条：
1. 【快进】快速推进剧情（跳过日常，直奔下一个关键事件）
2. 【交互】与在场人物互动（对话/试探/合作/冲突）
3. 【整活】出格/搞怪/整活的骚操作
4. 【慢推】慢推剧情（细品当下场景与人物）
5. 【时空】跨越时间（快进/回溯/时间跳跃）
6. 【成人】成人向内容（亲密/情欲走向；当前尺度允许才展开，否则给带情欲张力的互动）
六类不可合并、不可换皮。每条都是具体行动，不写玩家心理与台词。

【状态栏】最后输出，缺少 <status> 块的回复视为不完整输出；字段名一律用中文，禁止英文 key：
<status>
回合：X ｜ 位置：X ｜ 状态：X ｜ 情欲：X（无则写"无"）
</status>`;
  }

  /* ---------- 2.5 世界提示词压缩（仅 lite 用） ----------
     各世界 config 的 fullSystemPrompt 是 7000~8700 字的完整设定（境界、地理、势力、
     人物志、功法、事件……），对 8k/16k 上下文的小模型是致命负担：它会把注意力全花在
     读设定上，正文反而写崩。
     但整段砍掉又会让小模型完全不知道世界长什么样 → 人物串戏、境界乱编（OOC）。
     折中：按 "##" 分段，每段保「段标题 + 首句 + 所有铁律句」，把 8k 字压到 2.5k 字左右，
     信息密度保住，字数砍掉七成。段落顺序与原文一致，模型仍能建立结构感。 */
  const MUST_RE = /铁律|禁止|不得|严禁|切勿|必须|不可|唯一|绝不|不是|禁止|勿|切勿|只有|方能/;
  function compactSystemPrompt(text, budget) {
    var src = String(text || '');
    if (!src) return '';
    var B = budget > 0 ? budget : 2800;
    if (src.length <= B) return src;
    /* config 的知识库真源以 "## " 起段；没有 ## 的走【】分段；再没有就按空行切 */
    var parts = src.split(/\n(?=##\s)/);
    if (parts.length < 3) parts = src.split(/\n(?=【)/);
    if (parts.length < 3) parts = src.split(/\n{2,}/);
    var out = [];
    var used = 0;
    for (var i = 0; i < parts.length; i++) {
      var block = parts[i].trim();
      if (!block) continue;
      var lines = block.split('\n');
      var headLine = lines.length && /^(#|【)/.test(lines[0].trim()) ? lines[0].trim() : '';
      var body = headLine ? lines.slice(1).join('\n') : block;
      /* 逐句筛：首句给语境，约束句防 OOC，其余丢弃 */
      var sents = body.split(/(?<=[。！？\n])/).filter(function (s) { return s.trim(); });
      var keep = [];
      if (sents.length) keep.push(sents[0].trim());
      for (var j = 1; j < sents.length; j++) {
        var s = sents[j].trim();
        if (s && MUST_RE.test(s) && keep.indexOf(s) === -1) keep.push(s);
      }
      var seg = (headLine ? headLine + '\n' : '') + keep.join('');
      /* 预算不够时降级：先只留标题，再彻底放弃该段（标题也放不下的段直接跳） */
      var remain = B - used;
      if (seg.length > remain) {
        seg = headLine && headLine.length <= remain ? headLine : '';
      }
      if (!seg) continue;
      out.push(seg);
      used += seg.length + 1;
      if (used >= B) break;
    }
    var res = out.join('\n');
    return res || src.slice(0, B);
  }

  /* ---------- 4. 复读崩塌检测（全档生效的安全基线） ---------- */
  function detectCollapse(text) {
    if (!text || typeof text !== 'string' || text.length < 400) return false;
    const T = text.replace(/\s+/g, '');
    const grams = Object.create(null);
    const scan = Math.min(T.length, 5000);
    for (let i = 0; i + 6 <= scan; i++) {
      const g = T.substr(i, 6);
      grams[g] = (grams[g] || 0) + 1;
    }
    let max = 0;
    for (const k in grams) if (grams[k] > max) max = grams[k];
    if (max >= 10) return true;
    const lines = text.split('\n').map((s) => s.trim()).filter((s) => s.length > 4);
    const lc = Object.create(null);
    let lmax = 0;
    for (const l of lines) { lc[l] = (lc[l] || 0) + 1; if (lc[l] > lmax) lmax = lc[l]; }
    return lmax >= 4;
  }

  /* ---------- 3. 辅助AI静默补丁（仅 lite，惰性/幂等/可逆） ---------- */
  let installed = false;
  function install() {
    if (installed) return;
    const va = window.VariableAI;
    if (va && !va.__bmmPatched) {
      va.__bmmPatched = true;
      const oEnabled = va.isEnabled ? va.isEnabled.bind(va) : null;
      const oFallback = va.isFallbackActive ? va.isFallbackActive.bind(va) : null;
      // 用 isLite() 当前值决定；lazy 读取，不缓存判定，档位切换即时生效
      va.isEnabled = function () { return isLite() ? false : (oEnabled ? oEnabled() : false); };
      va.isFallbackActive = function () { return isLite() ? false : (oFallback ? oFallback() : false); };
      if (va.recapReady && !va.__bmmOrigRecapReady) {
        va.__bmmOrigRecapReady = va.recapReady.bind(va);
        va.recapReady = function () { return isLite() ? false : va.__bmmOrigRecapReady(); };
      }
    }
    const si = window.StoryInspiration;
    if (si && !si.__bmmPatched && si.isEnabled) {
      si.__bmmPatched = true;
      const oSI = si.isEnabled.bind(si);
      si.isEnabled = function () { return isLite() ? false : oSI(); };
    }
  }
  window.addEventListener('load', function () { install(); setTimeout(install, 3000); });

  window.BaseModelMode = {
    TIER_AUTO: 'auto', TIER_LITE: 'lite', TIER_FULL: 'full',
    getTier, setTier, isAuto,
    resolveTier, isLite, isFull, ctxTier,
    isEnabled: isLite,                 // 兼容旧布尔语义（=是否走裁剪档）
    isEnabledRaw: getTier,
    clampParams, buildLitePreset, compactSystemPrompt, detectCollapse,
    noteCollapse, noteStable, install
  };
})();
