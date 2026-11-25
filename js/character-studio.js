/* ============================================================
   云境 · 角色塑造助手（CharacterStudio） v7.0.3
   ------------------------------------------------------------
   玩家原话（v7.0.3）：
     「下方的生成样貌、性格和角色图标，我说过要让玩家自己填；
       咱之前不是有性格世界书吗，再填性格那里让玩家自己选，不限个数；
       角色图标也就是头像，是要通过生图模型根据玩家设定生成的。」
   落地：
   · 挂载：小说模式(wiz_heroSection)与扮演模式(身份设定台)都挂，不再只找 heroSection。
   · 样貌：文本输入框，玩家自己填；「AI 润色」仅辅助，可不用。
   · 性格：从性格世界书 PersonalityCodex.TRAIT_CODEX 点选，不限个数；
     选中项以 chip 展示并可删除；也可手填补充。生成结果写入小传。
   · 角色图标(头像)：按玩家设定(姓名+样貌+性格+世界)拼 prompt，调生图模块
     StoryImageGen.generate() 真正生图；未配置绘图接口时明确提示去设置，
     canvas 程序化仅作离线兜底并在状态里说明，不再冒充"生图模型"。
   兼容：保留 v6.9 的 genLook/genPersona/genIcon/icon/look/persona 导出。
   ============================================================ */
(function (G) {
  "use strict";
  var ICON_KEY = "yunjingHeroIcon";
  var LOOK_KEY = "yunjingHeroLook";
  var PERSONA_KEY = "yunjingHeroPersona";
  var TRAITS_KEY = "yunjingHeroTraits"; // JSON array of trait names

  var LOOKS_F = [
    "眉如远山，眸色清浅，肤色白皙，长发以一根素簪挽起，着一身月白长裙，气质清冷而疏离。",
    "眼尾微挑，顾盼生辉，乌发垂肩，常着淡青劲装，笑起来时有浅浅梨涡，灵动中藏着三分狡黠。",
    "面容温婉，眉目柔和，一袭素色长衫干净利落，腕间常缠一圈细银镯，举手投足间透着书卷气。"
  ];
  var LOOKS_M = [
    "剑眉星目，鼻梁挺直，一身玄色劲装束腰，长发以玉冠束起，肩背笔直，眉宇间自有股桀骜。",
    "相貌清俊，肤如玉，眉眼间带几分温润笑意，常着青衫，袖口绣暗纹，气质出尘而不失亲和。",
    "轮廓深邃，目光沉静，短发利落，着一身灰布长袍，腰间悬一枚旧玉佩，举手投足沉稳有力。"
  ];

  function $(id) { return document.getElementById(id); }
  function read(key) { try { return localStorage.getItem(key) || ""; } catch (e) { return ""; } }
  function write(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function name() {
    var n = $("wiz_heroName") || $("wiz_playerName");
    return (n && n.value.trim()) || "无名";
  }
  function gender() {
    var g = $("wiz_heroGender") || $("wiz_gender");
    return g ? g.value : "男";
  }
  function genreName() {
    try { var c = window.storyFramework && window.storyFramework.config; return (c && c.genreName) || ""; }
    catch (e) { return ""; }
  }
  function getTraits() {
    try { var a = JSON.parse(read(TRAITS_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function setTraits(a) { write(TRAITS_KEY, JSON.stringify(a)); }

  /* ---------- 文本 AI 辅助（主笔模型），失败返回 null ---------- */
  function aiText(prompt) {
    var cfg;
    try { cfg = JSON.parse(read("storyApiConfig") || "{}"); } catch (e) { cfg = {}; }
    if (!cfg.endpoint || !cfg.apiKey && cfg.provider !== "ollama") return Promise.resolve(null);
    var ep = String(cfg.endpoint).replace(/\/+$/, "") + "/chat/completions";
    var body = {
      model: cfg.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是角色设定助手。只输出设定文字本身，不要解释、不要加标题、不要引号。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.9, max_tokens: 260
    };
    var headers = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers.Authorization = "Bearer " + cfg.apiKey;
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    return fetch(ep, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctl && ctl.signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (timer) clearTimeout(timer);
        var t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        return t ? String(t).trim() : null;
      })
      .catch(function () { if (timer) clearTimeout(timer); return null; });
  }
  function pickLocal(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- 样貌：优先用玩家输入框的值；AI 润色仅辅助 ---------- */
  function genLook() {
    var input = $("csLookInput");
    var typed = input && input.value.trim();
    var n = name(), g = gender(), world = genreName();
    if (typed) { write(LOOK_KEY, typed); mergeBio("【样貌】" + typed); renderPreview(); return Promise.resolve(typed); }
    var pool = g === "女" ? LOOKS_F : LOOKS_M;
    var prompt = "为" + (world ? "《" + world + "》世界里的" : "") + "角色「" + n + "」（" + g +
      "）写一段外貌描写：眉眼、肤色、发型、衣着与气质，60 字以内，中文。";
    return aiText(prompt).then(function (t) {
      var look = t || pickLocal(pool);
      if (input) input.value = look;
      write(LOOK_KEY, look);
      mergeBio("【样貌】" + look);
      renderPreview();
      return look;
    });
  }

  /* ---------- 性格：玩家从世界书多选（不限个数）+ 手填补充 ---------- */
  function genPersona() {
    var traits = getTraits();
    var extra = ($("csPersonaInput") && $("csPersonaInput").value.trim()) || "";
    var parts = [];
    var codex = (window.PersonalityCodex && window.PersonalityCodex.TRAIT_CODEX) || [];
    traits.forEach(function (tname) {
      var t = null;
      for (var i = 0; i < codex.length; i++) if (codex[i].name === tname) { t = codex[i]; break; }
      parts.push(t ? (tname + "（" + t.feature + "）") : tname);
    });
    if (extra) parts.push(extra);
    var persona = parts.join("；") || "性格由玩家自行设定（尚未选择性格特质）";
    write(PERSONA_KEY, persona);
    mergeBio("【性格】" + persona);
    renderPreview();
    return Promise.resolve(persona);
  }

  /* 让玩家从性格世界书点选/取消，不限个数 */
  function toggleTrait(tname) {
    var a = getTraits();
    var idx = a.indexOf(tname);
    if (idx >= 0) a.splice(idx, 1); else a.push(tname);
    setTraits(a);
    renderTraits();
    genPersona(); // 同步刷新性格文本与小传
  }
  function renderTraits() {
    var box = $("csTraitList");
    if (!box) return;
    var codex = (window.PersonalityCodex && window.PersonalityCodex.TRAIT_CODEX) || [];
    var selected = getTraits();
    var cats = { positive: "正向", negative: "负向", neutral: "中性", complex: "复杂" };
    var html = "";
    var groups = {};
    codex.forEach(function (t) { (groups[t.cat] = groups[t.cat] || []).push(t); });
    Object.keys(groups).forEach(function (cat) {
      html += '<div class="cs-trait-cat">' + esc(cats[cat] || cat) + '</div><div class="cs-trait-row">';
      groups[cat].forEach(function (t) {
        var on = selected.indexOf(t.name) >= 0;
        html += '<button type="button" class="cs-trait' + (on ? ' on' : '') + '" data-trait="' + esc(t.name) +
          '" title="' + esc(t.feature) + '">' + esc(t.name) + '</button>';
      });
      html += '</div>';
    });
    if (box.innerHTML !== html) box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.cs-trait'), function (b) {
      b.onclick = function () { toggleTrait(b.getAttribute('data-trait')); };
    });
    var cnt = $("csTraitCount");
    if (cnt) cnt.textContent = "已选 " + selected.length + " 项（不限个数）";
  }

  function mergeBio(line) {
    var bio = $("wiz_heroBio");
    if (!bio) {
      var wrap = $("csWrap");
      if (!wrap) return;
      bio = document.createElement("textarea");
      bio.id = "wiz_heroBio"; bio.className = "wiz-input"; bio.rows = 3;
      bio.placeholder = "角色小传（可手改）：样貌、性格、来历…写多细，AI 执行多细";
      bio.style.cssText = "width:100%;margin-top:10px;font-size:12px;line-height:1.6";
      var label = document.createElement("div");
      label.className = "cs-biolabel"; label.textContent = "📖 角色小传（生成内容写到这里，开局注入主笔）";
      wrap.insertBefore(label, $("csStatus"));
      wrap.insertBefore(bio, $("csStatus"));
    }
    var old = bio.value.trim();
    if (old.indexOf(line) >= 0) return;
    bio.value = (old ? old + "\n" : "") + line;
  }

  /* ---------- 角色图标(头像)：生图模型按玩家设定生成 ---------- */
  function buildPortraitPrompt() {
    var n = name(), g = gender(), world = genreName();
    var look = ($("csLookInput") && $("csLookInput").value.trim()) || read(LOOK_KEY) || "";
    var traits = getTraits();
    var extra = ($("csPersonaInput") && $("csPersonaInput").value.trim()) || "";
    var personaText = traits.join("、") + (extra ? "，" + extra : "");
    return "角色肖像特写，正面半身，" + (world ? "《" + world + "》题材风格，" : "") +
      "角色名「" + n + "」，" + g + "性。" +
      (look ? "外貌：" + look + "。" : "") +
      (personaText ? "气质性格：" + personaText + "。" : "") +
      "精致五官，自然光影，居中构图，干净背景，头像肖像画。";
  }
  function genIcon() {
    var prompt = buildPortraitPrompt();
    var SG = window.StoryImageGen;
    setStatus("正在调用生图模型生成头像…");
    if (SG && typeof SG.generate === "function" && SG.isConfigured && SG.isConfigured()) {
      return Promise.resolve(SG.generate(prompt, { finalPrompt: prompt })).then(function (entry) {
        var url = entry && (entry.url || entry.dataURL || entry.image);
        if (!url) throw new Error("生图接口未返回图片");
        write(ICON_KEY, url);
        renderPreview();
        setStatus("✓ 已按设定生成头像（生图模型）");
        return url;
      }).catch(function (e) {
        setStatus("生图失败：" + ((e && e.message) || "未知错误") + "，已用离线头像兜底");
        var url = genIconFallback();
        return url;
      });
    }
    // 未配置生图接口：明确提示，仍给离线兜底头像，绝不谎称"生图模型生成"
    setStatus("未配置生图接口（设置→绘图引擎），当前用离线草稿头像；配置后可重新生成");
    return Promise.resolve(genIconFallback());
  }
  /* 离线兜底：程序化头像（仅在没有生图配置或生图失败时用） */
  function genIconFallback() {
    var n = name(), g = gender();
    var seed = 0; for (var i = 0; i < n.length; i++) seed = (seed * 31 + n.charCodeAt(i)) >>> 0;
    var rnd = (function (s) { return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(seed);
    var palettes = [["#2b3a67", "#d9b46a"], ["#3a2b52", "#c8a7e0"], ["#2b4a44", "#8fd6bd"],
                    ["#5a2b34", "#e0a08c"], ["#3d3a2b", "#e0d08c"], ["#2b3f5a", "#9fc4e8"]];
    var pal = palettes[seed % palettes.length];
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    var x = cv.getContext("2d");
    x.fillStyle = pal[0]; x.beginPath(); x.arc(64, 64, 64, 0, 6.2832); x.fill();
    var grd = x.createRadialGradient(64, 50, 8, 64, 64, 64);
    grd.addColorStop(0, pal[1] + "55"); grd.addColorStop(1, "#00000000");
    x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
    x.fillStyle = pal[1]; x.beginPath();
    x.moveTo(24, 128); x.quadraticCurveTo(30, 88, 64, 86); x.quadraticCurveTo(98, 88, 104, 128); x.closePath(); x.fill();
    x.fillStyle = "#f0d9c0"; x.beginPath(); x.ellipse(64, 60, 22, 27, 0, 0, 6.2832); x.fill();
    x.fillStyle = pal[0]; x.beginPath();
    if (g === "女") { x.ellipse(64, 46, 26, 22, 0, 0, 6.2832); x.fill(); x.fillRect(38, 46, 12, 52); x.fillRect(78, 46, 12, 52); }
    else { x.ellipse(64, 45, 24, 18, 0, 0, 6.2832); x.fill(); }
    if (rnd() > .4) { x.fillStyle = pal[1]; x.fillRect(60, 30, 8, 6); }
    x.fillStyle = "#3a2b22";
    x.fillRect(54, 60, 5, 3); x.fillRect(70, 60, 5, 3);
    x.strokeStyle = "#b07a68"; x.lineWidth = 2; x.beginPath(); x.arc(64, 70, 6, 0.2, Math.PI - 0.2); x.stroke();
    var url = cv.toDataURL("image/png");
    write(ICON_KEY, url);
    renderPreview();
    return url;
  }

  function renderPreview() {
    var box = $("csPreview");
    if (!box) return;
    var icon = read(ICON_KEY);
    var look = read(LOOK_KEY), persona = read(PERSONA_KEY);
    var traits = getTraits();
    var html = (icon ? '<img class="cs-avatar" src="' + icon + '" alt="角色图标">' : '<div class="cs-avatar cs-ph">🖼</div>') +
      '<div class="cs-info">' +
        (look ? '<div class="cs-line"><b>样貌</b>' + esc(look.slice(0, 46)) + '</div>' : "") +
        (traits.length ? '<div class="cs-line"><b>性格</b>' + esc(traits.join("、")) + '</div>' : "") +
        (persona && !traits.length ? '<div class="cs-line"><b>性格</b>' + esc(persona.slice(0, 46)) + '</div>' : "") +
        (!look && !traits.length ? '<div class="cs-empty">填样貌 / 选性格 / 生成头像，设定会写进小传</div>' : "") +
      '</div>';
    if (box.innerHTML === html) return;
    box.innerHTML = html;
  }

  function setStatus(t) {
    var s = $("csStatus");
    if (!s) return;
    s.textContent = t;
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(function () { s.textContent = ""; }, 4200);
  }

  /* ---------- 挂载：覆盖小说模式与扮演模式 ---------- */
  function findHost() {
    return $("wiz_heroSection")            // 小说模式主角设定区
      || ($("wiz_playerName") && $("wiz_playerName").closest(".wiz-section")) // 扮演模式身份区
      || ($("setupWrap"));                  // 兜底：整个设定台
  }
  function mount() {
    if ($("csWrap")) return;
    var host = findHost();
    if (!host) return;
    var wrap = document.createElement("div");
    wrap.id = "csWrap";
    wrap.className = "cs-wrap";
    wrap.innerHTML =
      '<div class="cs-title">🎨 角色塑造 <span>自己填样貌 / 从性格世界书选性格（不限个）/ 生图模型生成头像</span></div>' +
      '<div class="cs-field"><label>样貌（自己填）</label>' +
        '<input type="text" id="csLookInput" placeholder="例：剑眉星目，玄色劲装，气质桀骜…" value="' + esc(read(LOOK_KEY)) + '">' +
        '<button type="button" id="csLook">✨ AI 润色</button></div>' +
      '<div class="cs-field"><label>性格（世界书点选，不限个数）</label>' +
        '<div class="cs-trait-count" id="csTraitCount"></div>' +
        '<div class="cs-trait-list" id="csTraitList"></div>' +
        '<input type="text" id="csPersonaInput" placeholder="补充性格（自己填，选填）" value=""></div>' +
      '<div class="cs-field"><label>角色头像（按上面设定生图）</label>' +
        '<button type="button" id="csIcon">🖼 用生图模型生成头像</button>' +
        '<button type="button" id="csIconAgain" class="cs-mini">↻ 重生成</button></div>' +
      '<div class="cs-preview" id="csPreview"></div>' +
      '<div class="cs-status" id="csStatus"></div>' +
      '<button type="button" id="csApply" class="cs-apply">✓ 写进角色小传并应用性格</button>';
    host.appendChild(wrap);
    $("csLook").onclick = function () {
      setStatus("生成中…"); genLook().then(function () { setStatus("✓ 样貌已就绪"); });
    };
    $("csIcon").onclick = function () { genIcon(); };
    $("csIconAgain").onclick = function () { genIcon(); };
    $("csApply").onclick = function () {
      genPersona();
      setStatus("✓ 已写入角色小传，性格已应用");
    };
    renderTraits();
    renderPreview();
  }
  function boot() {
    mount();
    if (window.MutationObserver && $("setupWrap")) {
      var mo = new MutationObserver(function () { if (findHost()) mount(); });
      mo.observe($("setupWrap"), { childList: true, subtree: true });
    }
    // codex/image-gen 是 lazy 批量加载，晚于本脚本；延后重绘性格列表，确保点选可用
    [400, 1200, 2600].forEach(function (ms) {
      setTimeout(function () { mount(); renderTraits(); renderPreview(); }, ms);
    });
  }

  G.CharacterStudio = {
    version: "7.0.3", boot: boot, mount: mount, refresh: renderPreview,
    genLook: genLook, genPersona: genPersona, genIcon: genIcon,
    toggleTrait: toggleTrait, buildPortraitPrompt: buildPortraitPrompt,
    icon: function () { return read(ICON_KEY); },
    look: function () { return read(LOOK_KEY); },
    persona: function () { return read(PERSONA_KEY); },
    traits: getTraits
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
