/* ============================================================
   云境 · 角色塑造助手（CharacterStudio） v6.9.0
   ------------------------------------------------------------
   玩家原话：「创作角色时添加角色样貌、性格生成入口，然后玩家还要可以生成角色图标」
   设计：
   · 在身份设定台「主角设定」区挂一行：样貌生成 / 性格生成 / 生成角色图标。
   · 样貌、性格：优先调主笔模型（读 storyApiConfig，OpenAI 兼容 /chat/completions）；
     没配模型或失败时用本地模板库兜底，保证永远能出结果、离线可用。
   · 角色图标：纯前端 canvas 程序化生成（按姓名 + 性别 + 样貌关键词配色/剪影），
     dataURL 存 localStorage，随存档走，零网络零后端。
   · 生成结果写回 wiz_heroBio / 独立样貌字段，玩家仍可手动改。
   ============================================================ */
(function (G) {
  "use strict";
  var ICON_KEY = "yunjingHeroIcon";
  var LOOK_KEY = "yunjingHeroLook";
  var PERSONA_KEY = "yunjingHeroPersona";

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
  var PERSONAS = [
    "外冷内热，嘴上不饶人却总在关键时刻出手；重诺守信，恩怨分明；遇事冷静果决，唯独对在意的人毫无原则。",
    "性子跳脱，好奇心重，爱冒险也爱凑热闹；看似玩世不恭，实则心思缜密、重情重义；最见不得不平事。",
    "温和克制，善于倾听，凡事三思而后行；有轻微的完美主义，对自己要求极高；心里藏着一段不愿提起的往事。"
  ];

  function $(id) { return document.getElementById(id); }
  function read(key) { try { return localStorage.getItem(key) || ""; } catch (e) { return ""; } }
  function write(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

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

  /* 调主笔模型生成一段文字；失败返回 null */
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

  function genLook() {
    var n = name(), g = gender(), world = genreName();
    var pool = g === "女" ? LOOKS_F : LOOKS_M;
    var prompt = "为" + (world ? "《" + world + "》世界里的" : "") + "角色「" + n + "」（" + g +
      "）写一段外貌描写：包含眉眼、肤色、发型、衣着与整体气质，60 字以内，中文，符合该世界题材风格。";
    return aiText(prompt).then(function (t) {
      var look = t || pickLocal(pool);
      write(LOOK_KEY, look);
      mergeBio("【样貌】" + look);
      renderPreview();
      return look;
    });
  }

  function genPersona() {
    var n = name(), g = gender(), world = genreName();
    var prompt = "为" + (world ? "《" + world + "》世界里的" : "") + "角色「" + n + "」（" + g +
      "）写一段性格设定：包含外在表现、内在动机、待人处事方式与一个隐藏弱点，60 字以内，中文。";
    return aiText(prompt).then(function (t) {
      var persona = t || pickLocal(PERSONAS);
      write(PERSONA_KEY, persona);
      mergeBio("【性格】" + persona);
      renderPreview();
      return persona;
    });
  }

  function mergeBio(line) {
    var bio = $("wiz_heroBio");
    if (!bio) {
      /* roleplay / freeworld 模板没有小传框：在助手里动态建一个，
         用同名 id，让 StorySetupWizard.start() 里的 wiz_heroBio 读取自动生效 */
      var wrap = $("csWrap");
      if (!wrap) return;
      bio = document.createElement("textarea");
      bio.id = "wiz_heroBio"; bio.className = "wiz-input"; bio.rows = 3;
      bio.placeholder = "角色小传（AI 生成 / 可手改）：样貌、性格、来历…写多细，AI 执行多细";
      bio.style.cssText = "width:100%;margin-top:10px;font-size:12px;line-height:1.6";
      var label = document.createElement("div");
      label.className = "cs-biolabel"; label.textContent = "📖 角色小传（生成内容会写到这里，开局时注入主笔）";
      wrap.insertBefore(label, $("csStatus"));
      wrap.insertBefore(bio, $("csStatus"));
    }
    var old = bio.value.trim();
    if (old.indexOf(line) >= 0) return;
    bio.value = (old ? old + "\n" : "") + line;
  }

  /* 程序化生成角色图标：名字 hash 决定配色与发型/服饰剪影，纯 canvas，无网络 */
  function genIcon() {
    var n = name(), g = gender();
    var seed = 0; for (var i = 0; i < n.length; i++) seed = (seed * 31 + n.charCodeAt(i)) >>> 0;
    var rnd = (function (s) { return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(seed);
    var palettes = [["#2b3a67", "#d9b46a"], ["#3a2b52", "#c8a7e0"], ["#2b4a44", "#8fd6bd"],
                    ["#5a2b34", "#e0a08c"], ["#3d3a2b", "#e0d08c"], ["#2b3f5a", "#9fc4e8"]];
    var pal = palettes[seed % palettes.length];
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    var x = cv.getContext("2d");
    // 背景圆
    x.fillStyle = pal[0]; x.beginPath(); x.arc(64, 64, 64, 0, 6.2832); x.fill();
    // 光晕
    var grd = x.createRadialGradient(64, 50, 8, 64, 64, 64);
    grd.addColorStop(0, pal[1] + "55"); grd.addColorStop(1, "#00000000");
    x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
    // 肩身
    x.fillStyle = pal[1]; x.beginPath();
    x.moveTo(24, 128); x.quadraticCurveTo(30, 88, 64, 86); x.quadraticCurveTo(98, 88, 104, 128); x.closePath(); x.fill();
    // 脸
    x.fillStyle = "#f0d9c0"; x.beginPath(); x.ellipse(64, 60, 22, 27, 0, 0, 6.2832); x.fill();
    // 头发（按性别：女长发 / 男短发）
    x.fillStyle = pal[0]; x.beginPath();
    if (g === "女") { x.ellipse(64, 46, 26, 22, 0, 0, 6.2832); x.fill(); x.fillRect(38, 46, 12, 52); x.fillRect(78, 46, 12, 52); }
    else { x.ellipse(64, 45, 24, 18, 0, 0, 6.2832); x.fill(); }
    // 发簪 / 冠（随机）
    if (rnd() > .4) { x.fillStyle = pal[1]; x.fillRect(60, 30, 8, 6); }
    // 五官
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
    box.innerHTML = (icon ? '<img class="cs-avatar" src="' + icon + '" alt="角色图标">' : '<div class="cs-avatar cs-ph">🖼</div>') +
      '<div class="cs-info">' +
        (look ? '<div class="cs-line"><b>样貌</b>' + esc(look.slice(0, 46)) + '</div>' : "") +
        (persona ? '<div class="cs-line"><b>性格</b>' + esc(persona.slice(0, 46)) + '</div>' : "") +
        (!look && !persona ? '<div class="cs-empty">点上方按钮生成样貌 / 性格 / 图标</div>' : "") +
      '</div>';
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  /* 在主角设定区注入 UI（幂等） */
  function mount() {
    if ($("csWrap")) { renderPreview(); return; }
    var hero = $("wiz_heroSection");
    if (!hero) return;
    var wrap = document.createElement("div");
    wrap.id = "csWrap";
    wrap.className = "cs-wrap";
    wrap.innerHTML =
      '<div class="cs-title">🎨 角色塑造助手 <span>AI 生成样貌 / 性格 / 图标，也可手动改下方小传</span></div>' +
      '<div class="cs-btns">' +
        '<button type="button" id="csLook">✨ 生成样貌</button>' +
        '<button type="button" id="csPersona">🧠 生成性格</button>' +
        '<button type="button" id="csIcon">🖼 生成角色图标</button>' +
      '</div>' +
      '<div class="cs-preview" id="csPreview"></div>' +
      '<div class="cs-status" id="csStatus"></div>';
    hero.appendChild(wrap);
    $("csLook").onclick = function () {
      setStatus("生成中…"); genLook().then(function () { setStatus("✓ 样貌已写入小传"); });
    };
    $("csPersona").onclick = function () {
      setStatus("生成中…"); genPersona().then(function () { setStatus("✓ 性格已写入小传"); });
    };
    $("csIcon").onclick = function () { genIcon(); setStatus("✓ 角色图标已生成"); };
    renderPreview();
  }
  function setStatus(t) { var s = $("csStatus"); if (s) { s.textContent = t; clearTimeout(setStatus._t); setStatus._t = setTimeout(function () { s.textContent = ""; }, 2600); } }

  function boot() {
    mount();
    // 设定台是动态渲染的：观察 DOM 变化，heroSection 出现就挂
    if (window.MutationObserver && $("setupWrap")) {
      var mo = new MutationObserver(function () { if ($("wiz_heroSection")) mount(); });
      mo.observe($("setupWrap"), { childList: true, subtree: true });
    }
    [500, 1500, 3000].forEach(function (ms) { setTimeout(mount, ms); });
  }

  G.CharacterStudio = {
    version: "6.9.0", boot: boot, mount: mount, refresh: renderPreview,
    genLook: genLook, genPersona: genPersona, genIcon: genIcon,
    icon: function () { return read(ICON_KEY); },
    look: function () { return read(LOOK_KEY); },
    persona: function () { return read(PERSONA_KEY); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
