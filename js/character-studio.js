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
  function write(key, val) { try { localStorage.setItem(key, val); } catch(e){console.warn("[swallowed] character-studio",e)} }
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
  /* v7.6.6：性格选中态的唯一真源改为模块内 _traitState。
     v7.6.3/7.6.5 把 localStorage 当唯一真源，但配额满/隐私模式下 write() 静默失败，
     下一次 renderTraits 从 localStorage 回读到旧值 → 玩家看到「点了闪一下就没了」、
     检测脚本持有重建前旧节点更读不到高亮。改为内存态为真源，localStorage 仅作持久化，
     写失败时明确提示「本次仅会话有效」，不再让静默失败抹掉选中态。 */
  var _traitState = null;
  function getTraits() {
    if (_traitState) return _traitState.slice();
    try { var a = JSON.parse(read(TRAITS_KEY) || "[]"); _traitState = Array.isArray(a) ? a : []; }
    catch (e) { _traitState = []; }
    return _traitState.slice();
  }
  function setTraits(a) {
    _traitState = a.slice();
    try { localStorage.setItem(TRAITS_KEY, JSON.stringify(a)); }
    catch (e) {
      if (window.showToast) window.showToast("性格已选中，但本机存储写入失败（空间不足），刷新后可能不保留", "warn");
    }
  }

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

  /* 让玩家从性格世界书点选/取消，不限个数
   * v7.6.3：点击瞬间即在被点按钮上切换 on 类 + aria-pressed，
   * 不依赖 renderTraits 的整段 innerHTML 重建（重建会换掉按钮节点，
   * 令持有旧引用的检测/辅助工具读到 stateChanged:false 的假象）。 */
  function toggleTrait(tname, btn) {
    var a = getTraits();
    var idx = a.indexOf(tname);
    var nowOn = idx < 0;
    if (idx >= 0) a.splice(idx, 1); else a.push(tname);
    setTraits(a);
    if (btn && btn.classList) {
      if (nowOn) btn.classList.add("on"); else btn.classList.remove("on");
      btn.setAttribute("aria-pressed", nowOn ? "true" : "false");
    }
    renderTraits();
    genPersona(); // 同步刷新性格文本与小传
  }
  var _traitRetryTimer = null;
  function renderTraits() {
    var box = $("csTraitList");
    if (!box) return;
    var codex = (window.PersonalityCodex && window.PersonalityCodex.TRAIT_CODEX) || [];
    /* v7.6.6 真机 exe 实测：personality-codex.js 是 lazy 加载，常晚于本模块 mount。
       此前 renderTraits 读到空 codex 就直接渲染成「没有匹配」，且 v7.6.6 去掉定时重建后
       再无人重绘 → 玩家看到 72 芯片区永久空白（这才是「点了无高亮」的真正根因，
       上两版按「测试持旧节点」误判结案）。这里在 codex 未就绪时轮询等待并自动重绘；
       选中态以 _traitState 为真源，重绘不会丢失玩家已选。 */
    if (!codex.length) {
      if (!_traitRetryTimer) {
        _traitRetryTimer = setTimeout(function () {
          _traitRetryTimer = null;
          renderTraits();
        }, 300);
      }
      box.innerHTML = '<div style="opacity:.6;font-size:12px;padding:6px 0">性格库加载中…</div>';
      return;
    }
    var selected = getTraits();
    var cats = { positive: "正向", negative: "负向", neutral: "中性", complex: "复杂" };
    var kw = (($("csTraitSearch") && $("csTraitSearch").value) || "").trim().toLowerCase();
    var filter = ($("csTraitFilter") && $("csTraitFilter").value) || "";
    var html = "";
    var groups = {};
    codex.forEach(function (t) {
      if (filter && t.cat !== filter) return;
      if (kw && (String(t.name).toLowerCase().indexOf(kw) < 0 && String(t.feature || "").toLowerCase().indexOf(kw) < 0)) return;
      (groups[t.cat] = groups[t.cat] || []).push(t);
    });
    var shown = 0;
    Object.keys(groups).forEach(function (cat) {
      html += '<div class="cs-trait-cat">' + esc(cats[cat] || cat) + '</div><div class="cs-trait-row">';
      groups[cat].forEach(function (t) {
        shown++;
        var on = selected.indexOf(t.name) >= 0;
        html += '<button type="button" class="cs-trait' + (on ? ' on' : '') + '" data-trait="' + esc(t.name) +
          '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + esc(t.feature) + '">' + esc(t.name) + '</button>';
      });
      html += '</div>';
    });
    if (!shown) html = '<div style="opacity:.6;font-size:12px;padding:6px 0">没有匹配「' + esc(kw) + '」的性格点，换个词试试</div>';
    if (box.innerHTML !== html) box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.cs-trait'), function (b) {
      b.onclick = function () { toggleTrait(b.getAttribute('data-trait'), b); };
    });
    var cnt = $("csTraitCount");
    if (cnt) cnt.textContent = "已选 " + selected.length + " 项（不限个数）" + (kw || filter ? " · 显示 " + shown + " / " + codex.length : "");
  }
  /* 全选/清空：作用于当前搜索+筛选结果，避免误动看不见的项 */
  function setVisibleTraits(on) {
    var codex = (window.PersonalityCodex && window.PersonalityCodex.TRAIT_CODEX) || [];
    var kw = (($("csTraitSearch") && $("csTraitSearch").value) || "").trim().toLowerCase();
    var filter = ($("csTraitFilter") && $("csTraitFilter").value) || "";
    var visible = codex.filter(function (t) {
      if (filter && t.cat !== filter) return false;
      if (kw && (String(t.name).toLowerCase().indexOf(kw) < 0 && String(t.feature || "").toLowerCase().indexOf(kw) < 0)) return false;
      return true;
    }).map(function (t) { return t.name; });
    var a = getTraits().slice();
    if (on) { visible.forEach(function (n) { if (a.indexOf(n) < 0) a.push(n); }); }
    else { a = a.filter(function (n) { return visible.indexOf(n) < 0; }); }
    setTraits(a);
    renderTraits();
    genPersona();
  }

  /* 切换原著立场时，先清掉上一次写入的【原著…】行，避免主角/配角设定混在一处 */
  function clearCanonBioLines() {
    var bio = $("wiz_heroBio");
    if (!bio) return;
    var kept = bio.value.split(/\r?\n/).filter(function (l) { return !/^【原著[^】]*】/.test(l.trim()); });
    bio.value = kept.join("\n").replace(/^\n+/, "");
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

  /* ---------- 原著角色设定联动：选原著主角/配角后，其余设定跟着走 ---------- */
  function applyCanon(forceStance) {
    var SS = window.StoryStance;
    if (!SS) return false;
    var stance = forceStance || SS.get();
    var heroName = (typeof SS.canonHeroName === "function" ? SS.canonHeroName() : "") || "原著主角";
    var world = genreName();
    var bioLines = [];
    var look = "", persona = "", traits = [];
    clearCanonBioLines(); // 先清掉上一次立场写入的原著行

    if (stance === "hero") {
      // 原著主角：姓名=原著主角名；身份/来历按原著写，不臆造具体样貌
      var nm = $("wiz_playerName") || $("wiz_heroName");
      if (nm) nm.value = heroName;
      look = (world ? "《" + world + "》原著主角，" : "") + heroName + "，原著既定身份与际遇，样貌随原著设定。";
      persona = "原著主角本色，性格与行事严格遵循原著人设";
      bioLines.push("【原著身份】你就是" + heroName + "本人，亲历原著主线；大势不可改、小势可调。");
      bioLines.push("【原著设定】身份、来历、资质、羁绊与命运走向均以原著为准，AI 主笔按原著逻辑推演。");
    } else if (stance === "side") {
      // 原著配角：用完整配角数据填姓名/身份/性格/命运
      var info = (typeof SS.getSideCharInfo === "function" ? SS.getSideCharInfo() : null);
      if (!info) return false;
      var nm2 = $("wiz_playerName") || $("wiz_heroName");
      if (nm2) nm2.value = info.name || nm2.value;
      look = (info.role || "") + (info.realm ? "，" + info.realm : "") + "，原著既定身份与实力位阶。";
      persona = info.disposition || "";
      if (info.disposition) traits = info.disposition.split(/[、,，;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
      bioLines.push("【原著身份】" + info.name + " · " + (info.role || "") + (info.realm ? "（" + info.realm + "）" : ""));
      if (info.fate) bioLines.push("【原著命运】" + info.fate);
      if (info.rel) bioLines.push("【关系底子】" + info.rel);
      if (info.hook) bioLines.push("【人生钩子】" + info.hook);
    } else {
      return false; // 完全原创：不填，交给玩家
    }

    // 写入样貌/性格输入与本地存储
    var lookInput = $("csLookInput");
    if (lookInput) lookInput.value = look;
    write(LOOK_KEY, look);
    var personaInput = $("csPersonaInput");
    if (personaInput) personaInput.value = persona;
    write(PERSONA_KEY, persona);
    if (traits.length) setTraits(traits);
    // 写入小传（去重追加）
    bioLines.forEach(function (l) { mergeBio(l); });
    renderTraits(); renderPreview();
    setStatus("✓ 已按原著" + (stance === "hero" ? "主角" : "配角") + "设定填充其余字段，可继续手改");
    return true;
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
        '<input type="text" id="csLookInput" aria-label="角色外貌描述" placeholder="例：剑眉星目，玄色劲装，气质桀骜…" value="' + esc(read(LOOK_KEY)) + '">' +
        '<button type="button" id="csLook">✨ AI 润色</button></div>' +
      '<div class="cs-field"><label>性格（世界书点选，不限个数）</label>' +
        '<div class="cs-trait-tools">' +
          '<input type="text" id="csTraitSearch" aria-label="搜索性格点" placeholder="🔍 搜索性格点…" style="flex:1;min-width:120px">' +
          '<select id="csTraitFilter" style="max-width:96px"><option value="">全部分类</option><option value="positive">正向</option><option value="negative">负向</option><option value="neutral">中性</option><option value="complex">复杂</option></select>' +
          '<button type="button" id="csTraitAll" class="cs-mini">全选</button>' +
          '<button type="button" id="csTraitNone" class="cs-mini">清空</button>' +
        '</div>' +
        '<div class="cs-trait-count" id="csTraitCount"></div>' +
        '<div class="cs-trait-list" id="csTraitList"></div>' +
        '<input type="text" id="csPersonaInput" aria-label="补充性格" placeholder="补充性格（自己填，选填）" value=""></div>' +
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
    /* v7.6.6：无头像/无设定时「重生成」原本静默兜底生成，玩家看不出差别。
       先给出明确提示，避免被当成死按钮；仍允许继续生成兜底图。 */
    $("csIconAgain").onclick = function () {
      if (!read(ICON_KEY) && !read(LOOK_KEY) && !read(PERSONA_KEY)) {
        setStatus("还没有生成过头像，先点「用生图模型生成头像」再重生成");
        if (window.showToast) window.showToast("先生成一次头像，才能重生成", "info");
      }
      genIcon();
    };
    $("csApply").onclick = function () {
      genPersona();
      setStatus("✓ 已写入角色小传，性格已应用");
    };
    if ($("csTraitSearch")) $("csTraitSearch").oninput = function () { renderTraits(); };
    if ($("csTraitFilter")) $("csTraitFilter").onchange = function () { renderTraits(); };
    if ($("csTraitAll")) $("csTraitAll").onclick = function () { setVisibleTraits(true); };
    if ($("csTraitNone")) $("csTraitNone").onclick = function () { setVisibleTraits(false); };
    renderTraits();
    renderPreview();
  }
  function boot() {
    mount();
    if (window.MutationObserver && $("setupWrap")) {
      var mo = new MutationObserver(function () { if (findHost()) mount(); });
      mo.observe($("setupWrap"), { childList: true, subtree: true });
    }
    /* v7.6.6：codex/图库 lazy 加载晚于本脚本，延时补挂载即可；
       不再每次都裸调 renderTraits()——那会在玩家已点选后重建列表覆盖选中态（真源已在内存，
       但重建仍会换掉按钮节点，让手持旧引用的检测/辅助读到假象）。mount() 内部已渲染，
       且渲染读的是 _traitState，选中态稳定保留。 */
    [400, 1200, 2600].forEach(function (ms) {
      setTimeout(function () { mount(); }, ms);
    });
  }

  G.CharacterStudio = {
    version: "7.0.3", boot: boot, mount: mount, refresh: renderPreview,
    genLook: genLook, genPersona: genPersona, genIcon: genIcon,
    applyCanon: applyCanon,
    toggleTrait: toggleTrait, buildPortraitPrompt: buildPortraitPrompt,
    icon: function () { return read(ICON_KEY); },
    look: function () { return read(LOOK_KEY); },
    persona: function () { return read(PERSONA_KEY); },
    traits: getTraits
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
