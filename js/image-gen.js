window.StoryImageGen = {
  API_KEY: "storyImageApi",
  SET_KEY: "storyImageGen",
  /* ==================== 各界画风库（config.imageStyle 可覆盖） ==================== */
  GENRE_STYLES: {
    mystery: "电影感悬疑插画，低调布光，冷色阴影，雨夜霓虹，写实数字绘画",
    scifi: "硬科幻概念艺术，宏大太空场景，冷峻金属质感，体积光，高细节",
    wuxia: "国风水墨仙侠插画，工笔重彩，云雾山岚，飘逸衣袂，古意留白",
    cthulhu: "黑暗奇幻恐怖插画，黏湿有机质感，压抑暗色调，克苏鲁式不可名状之物",
    free: "高质量文学插画，电影感构图，氛围写实",
    swallowedstar: "现代都市与星际科幻插画，未来感装备，明亮锐利，热血战斗",
    shrouding: "东方玄幻史诗插画，洪荒大气，云海仙山，金乌荒古，鎏金点缀",
    quanzhigaoshou: "现代电竞插画，霓虹光影，赛场氛围，键鼠与屏幕流光",
    doupocangqiong: "热血玄幻插画，异火流光，少年意气，斗气化翼，浓烈色彩",
    wanmeishijie: "洪荒玄幻插画，太古苍茫，巨兽山巅，蛮荒辽阔",
    douluodalu: "魂环光效玄幻插画，魂技流光环绕，少年武魂觉醒",
    daoguiyixian: "诡谲民俗恐怖插画，纸灰朱红，疯癫质感，神鬼莫辨",
    zhongshengdushi: "都市修仙插画，霓虹夜色与灵气流光交融，现代与古意重叠",
    dibao: "万古帝威插画，帝金色调，浩瀚古意，帝兵镇世，苍茫岁月感",
    longzu: "青春都市奇幻插画，雨夜屠龙，龙影盘踞苍穹，孤独少年仰望",
    quanzhifashi: "现代魔法幻想插画，星轨法阵悬空，雷光与火焰交织，都市夜色下的年轻法师",
    limingzhijian: "蒸汽魔导工业幻想插画，符文齿轮与魔能蒸汽交织，晨光橙金色调，黎明地平线下的新纪元都市",
    lunhuileyuan: "冷冽无限流插画，血色数据环纹，任务简报光幕，孤身契约者步入陌生动漫战场",
    wulianfengdian: "热血武道玄幻插画，锻金剑气与玄铁山门，少年武者演武场递战书，熔金残阳",
    shengxu: "灵气复苏奇幻插画，幽蓝彼岸花海与青铜昆仑山影，现代都市上空神话异象初现",
    shenmifusu: "规则怪谈恐怖插画，冥纸青与鬼火冷色调，深夜旧宅与末班车的诡异光影，厉鬼只现轮廓不露真形",
    ditandali: "市井奇幻插画，夜市暖灯金与布幔红，霓虹地摊烟火气，瓶瓶罐罐里透出灵光",
    fanrenxiuxian: "古典修真插画，青衫修士与御剑流光，灵药古藤与坊市灯火，冷青月白主调配灵石微光，工笔与写意结合，凡人视角的仙路苍茫",
    xianni: "孤冷仙侠插画，苍凉古道残月孤星，黑袍独行者的剪影立于荒原，冷灰玄墨主调配一线血色与幽紫天光，宿命感构图",
    earth: "写实时代生活插画，考据级服饰器物与街景，自然光线与季节氛围，胶片颗粒质感，普通人的日常切片",
    quanqiubingfeng: "末世冰封电影感插画，冰蓝与霜白主色调，暴雪弥漫的死城街景与暖灯安全屋对峙，呵气成霜的幸存者剪影，堆积如山的物资与黑暗识海虚空微光，冷暖强对比，压抑中透一线生机",
    chaoshenxueyuan: "科幻军事史诗插画，圣光金与深空蓝黑主色调，天使圣光之翼与钢铁战机同框，战场上升起金色微虫洞光门，士兵持枪剪影仰望诸神级存在，能量光束划破天际，庄重史诗感构图",
    zhanhen: "都市神话悬疑插画，迷雾青灰与病院冷白主色调，霓虹都市被浓雾半掩，守夜人持刀剪影立于雾墙之前，远处精神病房透出温暖灯光，血月微光与雾中轮廓不明的神秘剪影对峙，冷暖对比的悬疑氛围感构图",
    jianlai: "国风仙侠水墨插画，青衫剑客与山水长卷同框，浩然清气与剑光交织，云海仙山之下一座小镇烟火人间，工笔与写意结合，读书人的一缕清气",
    guimi: "维多利亚蒸汽朋克神秘插画，雾都煤气灯与黄铜机械，灰雾暗紫主色调，占卜台、塔罗与古老仪式符号，古典油画质感，克制而优雅的恐怖氛围",
    guzhenren: "暗黑东方玄幻插画，幽绿蛊光与青铜虫纹，古寨山林与炼蛊秘境，妖异虫影盘旋夜空，血色与翠绿对撞，邪异诡谲氛围感构图",
    xuanjianxianzu: "家族修仙田园插画，灵田青翠与丹炉暖金，仙家府邸与坊市灯火遥相呼应，族学书声与演武晨光，温润恬淡的种田修仙气息，工笔细腻",
    _default: "高质量文学插画，电影感构图，氛围写实"
  },
  /* ==================== NovelAI 原生协议（v3.11.0 nai 模式） ==================== */
  /** 负面提示词默认值：NAI V4.5 官方 Heavy 预设 + 防文字/水印补强（正文插图不应出现文字） */
  NAI_NEGATIVE: "lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, text, watermark, signature, username",
  /** NAI 模型代号快捷表（配置卡按钮用；参数版本由 _naiParamsVersion 按代号推断） */
  NAI_MODELS: [
    "nai-diffusion-5-full",
    "nai-diffusion-5-curated",
    "nai-diffusion-4-5-full",
    "nai-diffusion-4-5-curated",
    "nai-diffusion-4-full",
    "nai-diffusion-4-curated-preview",
    "nai-diffusion-3"
  ],
  /* ==================== 文墨画师（v3.12.0 ink 模式） ==================== */
  /** 文墨画风库：注入画师系统提示词的 SVG 技法导向（config.inkStyle 可选） */
  INK_STYLES: {
    flat: "扁平插画风：简洁几何形状，明快有限色板（5-8 色），大色块分层，无描边或细描边",
    ink: "水墨国风：宣纸米白底，墨色浓淡干湿（黑灰渐进），朱砂红点缀，大量留白，毛笔笔触感路径",
    silhouette: "极简剪影风：渐变天空背景，全黑或深色剪影主体，黄昏或夜色氛围，强烈正负形对比",
    dark: "暗黑氛围风：深色底，低饱和冷色，单点光源，浓重阴影，神秘压抑",
    pastel: "柔彩绘本风：柔和粉彩色板，圆润形状，轻盈光晕，温暖治愈",
    neon: "霓虹夜色风：深蓝紫夜底，高饱和霓虹光晕（青、品红、暖黄），发光描边，雨夜地面反光"
  },
  /** 文墨调色板（v3.13.0）：逐画风锁定色值——文本模型自创配色必脏，锁色即提质 */
  INK_PALETTES: {
    flat: "米白底 #F4E9DA · 主蓝 #2B6CB0 · 浅蓝 #63B3ED · 暖橙 #F6AD55 · 点缀红 #E53E3E · 深灰蓝 #2D3748",
    ink: "宣纸米 #F5F0E6 · 浓墨 #1A1A1A · 中墨 #555555 · 淡墨 #9C9C9C · 朱砂 #B03A2E",
    silhouette: "剪影黑 #2D3436 · 落日橙 #FF7E5F · 暖黄 #FEB47B · 暮紫 #5C4A6E · 暗底 #1B1E28",
    dark: "底黑 #0D1117 · 面板灰 #161B22 · 冷光蓝 #58A6FF · 品红点缀 #F778BA · 高光白 #E6EDF3",
    pastel: "奶油底 #FDF6EC · 樱花粉 #F9C6D0 · 薄荷绿 #B5EAD7 · 杏黄 #FFDAC1 · 天空蓝 #A8D8EA · 线稿灰 #6D6875",
    neon: "夜空深蓝 #0B0F2A · 建筑暗面 #1A1F4E · 霓虹青 #00F0FF · 霓虹品红 #FF2E97 · 暖黄灯 #FFD166 · 光晕白 #E8F4FF"
  },
  /** SVG 体积上限（字符数）：超出视为模型失控输出，拒绝渲染 */
  INK_MAX_SVG: 2e5,
  /* ==================== 配置读写 ==================== */
  /** 第四接口配置（endpoint / apiKey / model / mode / size / timeout / provider） */
  get() {
    try {
      return JSON.parse(localStorage.getItem(this.API_KEY)) || {};
    } catch (e) {
      return {};
    }
  },
  save(cfg) {
    try {
      localStorage.setItem(this.API_KEY, JSON.stringify(cfg || {}));
    } catch (e) {
    }
  },
  /* ---- 首次自举默认值（v3.55.3）：预选 Agnes 生图厂商 ----
     接口地址/模型默认填好，Key 留空由使用者在设置里填自己的（不内置任何密钥）。
     自动插图（AI 协议注入 / 每章自动配图）默认关闭，需手动在设置里开启，避免每章自动烧图。 */
  DEFAULT_IMG_API: {
    provider: "agnes",
    type: "openai",
    mode: "images",
    endpoint: "https://apihub.agnes-ai.com/v1",
    apiKey: "",
    model: "agnes-image-2.5-flash",
    size: "1024x1024",
    timeout: 180
  },
  _seedDefaults() {
    try {
      if (!localStorage.getItem(this.API_KEY)) {
        localStorage.setItem(this.API_KEY, JSON.stringify(this.DEFAULT_IMG_API));
      }
      if (!localStorage.getItem(this.SET_KEY)) {
        localStorage.setItem(this.SET_KEY, JSON.stringify({ enabled: false, maxPerChapter: 1, promptLang: "zh", autoGen: true, styleSuffix: "" }));
      }
    } catch (e) {
    }
  },
  /** 行为配置（启用开关 / 每章上限 / 提示词语言 / 自动生成 / 画风补充） */
  getSettings() {
    const dft = { enabled: false, maxPerChapter: 1, promptLang: "zh", autoGen: true, styleSuffix: "" };
    try {
      const s = JSON.parse(localStorage.getItem(this.SET_KEY)) || {};
      return {
        enabled: !!s.enabled,
        maxPerChapter: Math.min(3, Math.max(1, parseInt(s.maxPerChapter) || 1)),
        promptLang: s.promptLang === "en" ? "en" : "zh",
        autoGen: s.autoGen !== false,
        styleSuffix: String(s.styleSuffix || "").trim()
      };
    } catch (e) {
      return dft;
    }
  },
  saveSettings(s) {
    try {
      localStorage.setItem(this.SET_KEY, JSON.stringify(s || {}));
    } catch (e) {
    }
  },
  isConfigured() {
    const c = this.get();
    if (c.mode === "ink" && c.inkUseMain !== false) {
      const m = this._inkMainCfg();
      return !!(m && m.endpoint && m.apiKey && m.model);
    }
    return !!(c.endpoint && c.apiKey && c.model);
  },
  /** 对外总开关：勾选启用 + 接口三件套配全（缺一即视为未启用，协议不注入） */
  isEnabled() {
    return this.getSettings().enabled && this.isConfigured();
  },
  /* ==================== 协议标记解析 ==================== */
  /**
   * 归一化各种容错形态 → 标准单行标记 (image: 提示词)
   * 容错：(image_gen)...(/image_gen) 成对块 / 【image: ...】/ 全角冒号 / (插图:) / (生图:)
   */
  normalizeMarkers(text) {
    let t = String(text || "");
    t = t.replace(/\(image_gen\)\s*([\s\S]*?)\(\/image_gen\)/gi, (m, p) => `(image: ${String(p).trim()})`);
    t = t.replace(/【(?:image|插图|生图)[:：]([^\n【】]{2,400}?)】/gi, (m, p) => `(image: ${String(p).trim()})`);
    return t;
  },
  /** 是否含插图标记（段落级快速判定） */
  hasMarker(text) {
    return /\((?:image|插图|生图)[:：][^\n)]{2,400}?\)/i.test(this.normalizeMarkers(text));
  },
  /**
   * 把一段文本按标记切片：[{isImage:false,text}, {isImage:true,prompt}, ...]
   * 段内内嵌与整行独占两种形态都支持
   */
  splitMarkers(text) {
    const t = this.normalizeMarkers(text);
    const re = /\((?:image|插图|生图)[:：]([^\n)]{2,400}?)\)/gi;
    const segs = [];
    let last = 0, m;
    while ((m = re.exec(t)) !== null) {
      if (m.index > last) segs.push({ isImage: false, text: t.slice(last, m.index) });
      const prompt = String(m[1]).trim().replace(/^["'“”]+|["'“”]+$/g, "");
      if (prompt) segs.push({ isImage: true, prompt });
      last = m.index + m[0].length;
    }
    if (last < t.length) segs.push({ isImage: false, text: t.slice(last) });
    return segs;
  },
  /** 剥离全部标记（朗读 / 字数统计等纯文本场景用） */
  stripMarkers(text) {
    return this.splitMarkers(text).map((s) => s.isImage ? "" : s.text).join("");
  },
  /* ==================== 提示词注入（主笔协议） ==================== */
  /**
   * 主笔系统提示词注入段（ai-message-builder.js 挂载，全部工坊/世界通用）
   * 仅在插图引擎启用时返回内容，否则返回空串（零开销）
   */
  buildDirective() {
    try {
      if (!this.isEnabled()) return "";
    } catch (e) {
      return "";
    }
    const st = this.getSettings();
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey || "";
    const style = fw && fw.config && fw.config.imageStyle || this.GENRE_STYLES[genre] || this.GENRE_STYLES._default;
    const langDesc = st.promptLang === "en" ? "英文（English）" : "中文";
    const lenDesc = st.promptLang === "en" ? "30-60 个英文单词" : "30-80 字";
    const max = st.maxPerChapter || 1;
    return `

【正文插图协议（插图引擎已启用，系统解析依赖）】
写正文的同时为本书配插图：在最适合配图的位置（场景全貌 / 关键场面 / 氛围特写），用单独一行的标记写出生图提示词，格式严格为：(image: 生图提示词)
- 每章最多 ${max} 张${max >= 2 ? "，只在真正值得配图的节点使用" : "，宁缺毋滥，无合适画面可不配"}
- 提示词为一句话画面描述（${lenDesc}），用${langDesc}书写，写清：画面主体与动作、环境场景、光线色调、构图视角、画风
- 本作画风基调：${style}——提示词须体现此画风
- 标记独占一行，置于所配图的段落之后；严禁出现在选项区或任何指令块内
- 提示词只描述画面，不得出现对白台词、字幕、文字、水印、logo 等元素
- 除该标记外，正文其余部分严禁出现图片链接、markdown 图片语法或其他括号指令`;
  },
  /* ==================== 渲染（正文插图卡） ==================== */
  esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  escAttr(s) {
    return this.esc(s).replace(/"/g, "&quot;");
  },
  /** 单段正文渲染：含标记则混排「文字段 + 插图占位」，纯文字按普通段落 */
  renderPara(p) {
    const segs = this.splitMarkers(p);
    return segs.map((seg) => {
      if (seg.isImage) return this.renderPlaceholder(seg.prompt);
      const t = seg.text.trim();
      return t ? `<p class="story-p">${this.esc(t)}</p>` : "";
    }).join("");
  },
  /** 插图占位卡：提示词常驻可见（用户要求"生图提示词在正文里输出"）+ 图片槽位 */
  renderPlaceholder(prompt) {
    return `
            <div class="story-illust" data-prompt="${this.escAttr(prompt)}">
                <div class="illust-caption">🖼 插图 · 生图提示词</div>
                <div class="illust-prompt-text">${this.esc(prompt)}</div>
                <div class="illust-slot illust-idle">🎨 插图待生成</div>
            </div>`;
  },
  /**
   * 渲染完一张正文卡后接线（ai-response-handler.renderStoryMessage 调用）
   * @param {HTMLElement} card 正文卡 DOM
   * @param {object} opts { live: 实时轮(true) / 回放(false)，turn: 绝对轮号 }
   *   - live 轮：前 maxPerChapter 张自动生成（autoGen 开启时），其余出「点击生成」
   *   - 回放：先查缓存（同轮同提示词 → 同提示词最新），命中直接显示，未命中出「点击生成」
   *     （回放绝不自动烧钱——刷新页面不应触发批量生图）
   */
  async processCard(card, opts = {}) {
    if (!card || !card.querySelectorAll) return;
    const nodes = Array.from(card.querySelectorAll(".story-illust"));
    if (!nodes.length) return;
    const enabled = this.isEnabled();
    const st = this.getSettings();
    const live = opts.live !== false;
    const turn = typeof opts.turn === "number" ? opts.turn : null;
    const autoBudget = live && st.autoGen ? st.maxPerChapter || 1 : 0;
    const PE = window.StoryPromptEngineer;
    if (live && enabled && PE && PE.isEnabled()) {
      const missing = [...new Set(nodes.map((el) => (el.getAttribute("data-prompt") || "").trim()).filter((p) => p && !PE.lookup(p)))];
      if (missing.length) {
        if (autoBudget > 0) {
          let n = 0;
          nodes.forEach((el) => {
            if (n >= autoBudget) return;
            const p = (el.getAttribute("data-prompt") || "").trim();
            if (!p || (this.lookupCache(turn, p) || {}).url) return;
            this.showLoading(el, "✍ 正在优化提示词…");
            n += 1;
          });
        }
        try {
          await PE.rewrite(missing, this._peContext());
        } catch (e) {
          console.warn("[插图引擎] 提示词批量改写失败，回退原始描述:", e);
        }
      }
    }
    let autoUsed = 0;
    nodes.forEach((el) => {
      const prompt = el.getAttribute("data-prompt") || "";
      const cached = this.lookupCache(turn, prompt);
      if (cached && cached.url) {
        this.showImage(el, cached);
        return;
      }
      if (!enabled) {
        this.showIdle(el, "生图接口未启用（⚙ 接口设置 → 🖼 插图引擎）");
        return;
      }
      if (autoUsed < autoBudget) {
        autoUsed += 1;
        this.queueGenerate(el, prompt, turn);
      } else {
        this.showIdle(el, live && st.autoGen ? "已达每章自动上限 · 点击手动生成" : "点击生成插图");
      }
    });
  },
  /* ---- 插图卡状态机（槽位填充） ---- */
  showLoading(el, text) {
    const slot = el.querySelector(".illust-slot");
    if (slot) {
      slot.className = "illust-slot illust-loading";
      slot.innerHTML = `<span class="illust-spin"></span>${this.esc(text || "正在生成插图…")}`;
    }
  },
  showIdle(el, text) {
    const slot = el.querySelector(".illust-slot");
    if (!slot) return;
    slot.className = "illust-slot illust-idle";
    slot.innerHTML = `🎨 ${this.esc(text || "点击生成插图")}`;
    slot.onclick = () => {
      const p = el.getAttribute("data-prompt") || "";
      const t = el.getAttribute("data-turn");
      this.queueGenerate(el, p, t != null && t !== "" ? Number(t) : null);
    };
  },
  showImage(el, entry) {
    const slot = el.querySelector(".illust-slot");
    if (!slot) return;
    const url = entry && entry.url;
    if (!url) {
      this.showIdle(el, "图片已过期 · 点击重绘");
      return;
    }
    slot.className = "illust-slot illust-done";
    slot.innerHTML = `
            <img class="illust-img" src="${this.escAttr(url)}" alt="插图" loading="lazy"
                 onclick="window.StoryImageGen.viewFull(this.src)" title="点击放大查看"
                 onerror="window.StoryImageGen.onImgError(this)">
            <div class="illust-acts">
                <button class="illust-btn" onclick="window.StoryImageGen.retryFromEl(this)" title="用同一提示词重新生成一张">↻ 重绘</button>
            </div>`;
    const finalP = entry && entry.finalPrompt;
    const rawP = el.getAttribute("data-prompt") || "";
    if (finalP && finalP.trim() && finalP !== rawP) {
      try {
        let box = el.querySelector(".illust-final");
        if (!box) {
          box = document.createElement("details");
          box.className = "illust-final";
          el.appendChild(box);
        }
        box.innerHTML = `<summary>✍ 实际生图提示词（工程师润色稿）</summary><div class="illust-final-text">${this.esc(finalP)}</div>`;
      } catch (e) {
      }
    }
  },
  showError(el, msg) {
    const slot = el.querySelector(".illust-slot");
    if (!slot) return;
    slot.className = "illust-slot illust-err";
    slot.innerHTML = `
            <span>✕ ${this.esc(String(msg || "生成失败").slice(0, 160))}</span>
            <div class="illust-acts">
                <button class="illust-btn" onclick="window.StoryImageGen.retryFromEl(this)">↻ 重试</button>
            </div>`;
  },
  /** <img> 加载失败（链接过期 / CORS）→ 转重绘态 */
  onImgError(img) {
    const el = img.closest(".story-illust");
    if (el) this.showIdle(el, "图片链接已过期 · 点击重绘");
  },
  /** v3.27.4 安卓适配：应用内全屏看图（替代 window.open——WebView 无法新开窗口，
   *  原方案在 APK 内点击无反应；且 https 外链会被桥接到系统浏览器跳出 App） */
  viewFull(src) {
    if (!src) return;
    let ov = document.getElementById("igLightbox");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "igLightbox";
    ov.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:999998",
      "background:rgba(5,5,9,.95)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px))",
      "cursor:zoom-out",
      "-webkit-tap-highlight-color:transparent"
    ].join(";");
    const img = document.createElement("img");
    img.src = src;
    img.alt = "插图";
    img.style.cssText = "max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.7);";
    const hint = document.createElement("div");
    hint.textContent = "轻触任意处关闭";
    hint.style.cssText = "position:absolute;bottom:calc(10px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);font-size:11px;letter-spacing:2px;color:rgba(232,228,216,.45);pointer-events:none;";
    ov.appendChild(img);
    ov.appendChild(hint);
    const close = () => {
      ov.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    ov.addEventListener("click", close);
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(ov);
  },
  /** 卡内按钮入口：重试 / 重绘 */
  retryFromEl(btn) {
    const el = btn.closest(".story-illust");
    if (!el) return;
    const p = el.getAttribute("data-prompt") || "";
    const t = el.getAttribute("data-turn");
    this.queueGenerate(el, p, t != null && t !== "" ? Number(t) : null);
  },
  /* ==================== 正文文生图（v3.55.3） ====================
     用户需求「可以直接在正文进行文生图」：
     · 选中正文文字 → 浮出「🎨 生图」按钮 → 用选区文字当提示词，就地插入插图并生成
     · /生图 描述 指令 → 直接在正文末尾插入一张插图（不走 AI 对话）
     复用既有插图卡（renderPlaceholder）与串行生成队列（queueGenerate）。 */
  initSelectToImage() {
    if (this._selInited) return;
    this._selInited = true;
    const btn = document.createElement("button");
    btn.id = "igSelBtn";
    btn.className = "ig-sel-btn";
    btn.type = "button";
    btn.innerHTML = "🎨 生图";
    btn.title = "用选中的文字作提示词，为正文就地生成一张插图";
    btn.style.display = "none";
    // 按下不抢焦点/不清选区，点击时仍能读到选中文本
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => this._doSelectImage());
    document.body.appendChild(btn);
    this._selBtn = btn;
    /* v3.55.4 拖选时 selectionchange 每个字符都触发，而本刷新含强制同步布局
       （getBoundingClientRect + offsetWidth）——改 rAF 合帧，每帧至多算一次 */
    const refresh = () => {
      if (this._selRaf) return;
      this._selRaf = requestAnimationFrame(() => {
        this._selRaf = 0;
        this._refreshSelBtn();
      });
    };
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("mouseup", () => setTimeout(refresh, 10));
    document.addEventListener("touchend", () => setTimeout(refresh, 120), { passive: true });
    // 滚动/点击空白即隐藏（v3.55.4：捕获滚动改 passive，不阻塞合成器）
    window.addEventListener("scroll", () => this._hideSelBtn(), { capture: true, passive: true });
    document.addEventListener("pointerdown", (e) => {
      if (this._selBtn && !this._selBtn.contains(e.target)) this._hideSelBtn();
    }, true);
  },
  _hideSelBtn() {
    if (this._selBtn) this._selBtn.style.display = "none";
  },
  _refreshSelBtn() {
    const btn = this._selBtn;
    if (!btn) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return this._hideSelBtn();
    const text = String(sel.toString() || "").trim();
    if (text.length < 2) return this._hideSelBtn();
    const range = sel.getRangeAt(0);
    const host = range.commonAncestorContainer;
    const hostEl = host.nodeType === 1 ? host : host.parentElement;
    const body = hostEl && hostEl.closest && hostEl.closest(".story-body");
    if (!body) return this._hideSelBtn();
    const rect = range.getBoundingClientRect();
    btn.style.display = "flex";
    const w = btn.offsetWidth || 92, h = btn.offsetHeight || 30;
    const x = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 8));
    const y = Math.max(8, rect.top - h - 10);
    btn.style.left = x + "px";
    btn.style.top = y + "px";
  },
  /** 选区按钮点击：用选中文本当提示词，在选区所在段落后插入插图 */
  _doSelectImage() {
    const sel = window.getSelection();
    const prompt = String(sel && sel.toString() || "").trim();
    this._hideSelBtn();
    if (!prompt) return;
    let anchorP = null;
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const host = range.commonAncestorContainer;
      const hostEl = host.nodeType === 1 ? host : host.parentElement;
      anchorP = hostEl && hostEl.closest && (hostEl.closest(".story-p") || hostEl.closest(".story-rich"));
    }
    this.insertIllustrationAfter(anchorP, prompt);
  },
  /**
   * 就地插入一张插图卡并排队生成
   * @param {HTMLElement|null} anchorEl 插入位置的参照段落（null → 追加到最新正文末尾）
   * @param {string} prompt 生图提示词
   */
  insertIllustrationAfter(anchorEl, prompt) {
    const p = String(prompt || "").trim();
    if (!p) return null;
    const wrap = document.createElement("div");
    wrap.innerHTML = this.renderPlaceholder(p).trim();
    const node = wrap.firstElementChild;
    if (!node) return null;
    let placed = false;
    if (anchorEl && anchorEl.parentNode) {
      anchorEl.parentNode.insertBefore(node, anchorEl.nextSibling);
      placed = true;
    } else {
      const body = document.querySelector(".story-body:last-of-type") || document.querySelectorAll(".story-body")[document.querySelectorAll(".story-body").length - 1];
      if (body) {
        body.appendChild(node);
        placed = true;
      }
    }
    if (!placed) {
      const host = document.getElementById("chatMessages") || document.getElementById("chatArea") || document.body;
      host.appendChild(node);
    }
    if (!this.isConfigured()) {
      this.showIdle(node, "生图接口未配全（⚙ 接口设置 → 🖼 插图引擎）");
      return node;
    }
    this.queueGenerate(node, p, null);
    return node;
  },
  /* ==================== 生成队列（串行，防限流） ==================== */
  _queue: [],
  _busy: false,
  queueGenerate(el, prompt, turn) {
    if (!el || !prompt) return;
    if (typeof turn === "number") el.setAttribute("data-turn", String(turn));
    this.showLoading(el);
    this._queue.push({ el, prompt, turn });
    this._pump();
  },
  _pump() {
    if (this._busy) return;
    const job = this._queue.shift();
    if (!job) return;
    this._busy = true;
    (async () => {
      try {
        let finalPrompt = null;
        const PE = window.StoryPromptEngineer;
        if (PE && PE.isEnabled()) {
          finalPrompt = PE.lookup(job.prompt) || null;
          if (!finalPrompt) {
            if (job.el.isConnected) this.showLoading(job.el, "✍ 正在优化提示词…");
            finalPrompt = (await PE.rewrite([job.prompt], this._peContext()))[0] || null;
          }
        }
        if (job.el.isConnected) this.showLoading(job.el, this._genLabel());
        const entry = await this.generate(job.prompt, { turn: job.turn, finalPrompt });
        if (job.el.isConnected) this.showImage(job.el, entry);
      } catch (err) {
        console.warn("[插图引擎] 生成失败:", err);
        if (job.el.isConnected) this.showError(job.el, err.message);
      } finally {
        this._busy = false;
        this._pump();
      }
    })();
  },
  /* ==================== 接口调用 ==================== */
  /**
   * 生成一张插图
   * @param {object} opts { turn, finalPrompt }——finalPrompt 为提示词工程师润色稿
   *   （_pump 预热线产出；直接调用且未传时，这里会按需单条改写）
   * @returns {Promise<{turn, prompt, finalPrompt, url, ts}>} entry（含完整 url，持久层自行做体积防御）
   */
  async generate(rawPrompt, opts = {}) {
    var _a;
    const cfg = this.get();
    if (!this.isConfigured()) {
      throw new Error("请先在「⚙ 接口设置 → 🖼 插图引擎」填全地址 / Key / 模型");
    }
    const st = this.getSettings();
    const prompt = String(rawPrompt || "").trim();
    if (!prompt) throw new Error("提示词为空");
    const PE = window.StoryPromptEngineer;
    let finalPrompt = typeof opts.finalPrompt === "string" && opts.finalPrompt.trim() ? opts.finalPrompt.trim() : null;
    if (!finalPrompt && PE && PE.isEnabled()) {
      finalPrompt = PE.lookup(prompt) || (await PE.rewrite([prompt], this._peContext()))[0] || null;
    }
    if (finalPrompt && finalPrompt === prompt) finalPrompt = null;
    let imgPrompt = finalPrompt || prompt;
    if (st.styleSuffix) imgPrompt = imgPrompt + "，" + st.styleSuffix;
    try {
      (_a = window.TokenUsage) == null ? void 0 : _a.recordRequest([{ role: "user", content: imgPrompt }], "插图");
    } catch (e) {
    }
    const url = cfg.mode === "nai" ? await this._genViaNai(cfg, imgPrompt) : cfg.mode === "chat" ? await this._genViaChat(cfg, imgPrompt) : cfg.mode === "ink" ? await this._genViaInk(cfg, imgPrompt) : await this._genViaImages(cfg, imgPrompt);
    const entry = {
      turn: typeof opts.turn === "number" ? opts.turn : null,
      prompt,
      // 原始描述（回放/导出按它命中缓存）
      finalPrompt: finalPrompt || void 0,
      // 润色稿（展示与导出用；未润色不存该字段）
      url,
      ts: Date.now()
    };
    this.saveIllust(entry);
    return entry;
  },
  /** 提示词工程师上下文：本作画风基调 + 提示词语言（画风补充词在生图前单独叠加，不进改写） */
  _peContext() {
    const st = this.getSettings();
    const fw = window.storyFramework;
    const genre = fw && fw.config && fw.config.genreKey || "";
    const style = fw && fw.config && fw.config.imageStyle || this.GENRE_STYLES[genre] || this.GENRE_STYLES._default;
    return { style, lang: st.promptLang };
  },
  /** 模式一：OpenAI 标准 images 接口（POST {endpoint}/images/generations） */
  async _genViaImages(cfg, prompt) {
    const base = String(cfg.endpoint || "").trim().replace(/\/+$/, "");
    const ep = /\/images\/generations$/.test(base) ? base : base + "/images/generations";
    const ms = secsToMs(cfg.timeout, 180);
    const body = { model: cfg.model, prompt, n: 1 };
    if (cfg.size) body.size = cfg.size;
    const res = await fetchWithTimeout(ep, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify(body)
    }, ms);
    if (!res.ok) throw new Error(await this._errText(res));
    const data = await withTimeoutMs(res.json(), ms);
    return this._pickImageUrl(data);
  },
  /** 模式二：对话式生图（chat/completions 回复解析图片链接，OpenRouter / gpt-4o 系中转常用） */
  async _genViaChat(cfg, prompt) {
    var _a, _b, _c, _d;
    const full = getFullEndpoint(cfg.endpoint, "openai");
    const ms = secsToMs(cfg.timeout, 180);
    const res = await fetchWithTimeout(full, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: `Generate an image: ${prompt}` }],
        temperature: 0.8,
        max_tokens: 4096
      })
    }, ms);
    if (!res.ok) throw new Error(await this._errText(res));
    const data = await withTimeoutMs(res.json(), ms);
    const msg = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message;
    const text = (_d = (_c = msg == null ? void 0 : msg.content) != null ? _c : msg == null ? void 0 : msg.reasoning_content) != null ? _d : "";
    let m = String(text).match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (m) return m[1];
    m = String(text).match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>]*)?/i);
    if (m) return m[0];
    m = String(text).match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/i);
    if (m) return m[0];
    m = String(text).match(/https?:\/\/[^\s"'<>]*image[^\s"'<>]*/i);
    if (m) return m[0];
    throw new Error(`对话式生图未在回复中找到图片链接（回复片段：${String(text).slice(0, 60)}…）`);
  },
  /** images 响应多格式兼容：data[0].url / b64_json / image_url / images[0].url */
  _pickImageUrl(data) {
    const item = data && data.data && data.data[0] || data && data.images && data.images[0] || Array.isArray(data) && data[0] || null;
    if (item && typeof item === "object") {
      if (item.url) return item.url;
      if (item.b64_json) return "data:image/png;base64," + item.b64_json;
      if (item.image_url) return typeof item.image_url === "string" ? item.image_url : item.image_url.url;
    }
    if (typeof item === "string" && item) return item;
    throw new Error("生图接口未返回可识别的图片数据（既无 url 也无 b64_json）");
  },
  /** 错误响应 → 可读文本（截断，附带服务端 message 提取；prefix 可按协议定制） */
  async _errText(res, prefix = "生图请求失败") {
    let reason = "";
    try {
      reason = (await readErrBody(res)).slice(0, 160);
      try {
        const j = JSON.parse(reason);
        reason = j.error && j.error.message || j.message || reason;
      } catch (e) {
      }
    } catch (e) {
    }
    return `${prefix}: ${res.status} ${res.statusText}${reason ? " - " + reason : ""}`;
  },
  /** 连通测试（生成一张小样图验证全链路）
   *  v3.46.2：NAI 模式测试走精简参数（steps 28→10），少烧一次额度 */
  async testApi(cfg) {
    const probe = "一只戴着斗笠打盹的橘猫，水墨国风，暖色背景";
    const url = cfg.mode === "nai" ? await this._genViaNai(cfg, probe, true) : cfg.mode === "chat" ? await this._genViaChat(cfg, probe) : cfg.mode === "ink" ? await this._genViaInk(cfg, probe) : await this._genViaImages(cfg, probe);
    return url.startsWith("data:") ? "（返回 base64 图片，链路正常）" : url;
  },
  /** 拉取模型列表
   *  v3.46.2 修复（玩家反馈「获取模型失败: 404 page not found」）：
   *  NAI 原生模式此前与其他模式一样请求 {地址}/models，而 NovelAI 官方/代理站
   *  根本没有 OpenAI 风格的 /models 列表接口 → 必然 404。现按模式分流：
   *  - nai 模式 → 直接返回内置 NAI_MODELS 代号表（V3-V5 全系，见快捷按钮）
   *  - ink 复用主笔 → 跟随主笔接口配置拉取（OpenAI / Gemini 双协议）
   *  - 其余（images / chat / ink 独立）→ 按本卡地址拉取；Gemini 类型走 /models?key= */
  async fetchModels(cfg) {
    cfg = cfg || {};
    if (cfg.mode === "nai") {
      return (this.NAI_MODELS || []).slice();
    }
    let target = cfg;
    if (cfg.mode === "ink" && cfg.inkUseMain !== false) {
      const m = this._inkMainCfg();
      if (!m) throw new Error("文墨模式当前复用主笔接口，但主笔尚未配置完整——请先到「🎭 主笔 AI」完成配置，或取消勾选复用后单独填写文本模型");
      target = m;
    }
    if (target.type === "gemini") {
      return await fetchGeminiModels(target.endpoint, target.apiKey);
    }
    return await fetchOpenAIModels(target.endpoint, target.apiKey);
  },
  /* ==================== NovelAI 原生协议实现（v3.11.0 nai 模式） ==================== */
  /** NAI 生图：POST {站点}/ai/generate-image → zip → PNG → dataURL
   *  官方端点为 image.novelai.net（api.novelai.net 会 400）；各 NAI 代理站填其根地址即可 */
  async _genViaNai(cfg, prompt, liteTest) {
    const base = String(cfg.endpoint || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("生图接口地址未配置");
    if (!cfg.apiKey) throw new Error("生图接口 API Key 未配置");
    if (!cfg.model) throw new Error("生图模型未配置（NovelAI 模型代号如 nai-diffusion-4-5-full）");
    const ep = /\/ai\/generate-image$/.test(base) ? base : base + "/ai/generate-image";
    const ms = secsToMs(cfg.timeout, 180);
    const clean = String(prompt || "").replace(/["“”‘’「」『』＂]+/g, "");
    const [w, h] = this._naiSize(cfg.size);
    const ver = this._naiParamsVersion(cfg.model);
    const neg = String(cfg.naiNegative || this.NAI_NEGATIVE).trim();
    const params = {
      params_version: ver,
      width: w,
      height: h,
      scale: 5,
      sampler: "k_euler_ancestral",
      steps: liteTest ? 10 : 28,
      n_samples: 1,
      ucPreset: 0,
      seed: Math.floor(Math.random() * 4294967295),
      negative_prompt: neg,
      qualityToggle: false,
      skip_cfg_above_sigma: null,
      cfg_rescale: 0,
      sm: false,
      sm_dyn: false,
      dynamic_thresholding: false,
      controlnet_strength: 1,
      legacy: false,
      add_original_image: true,
      uncond_scale: 1,
      noise_schedule: "karras",
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true
    };
    if (ver >= 3) {
      params.v4_prompt = { caption: { base_caption: clean, char_captions: [] }, use_coords: false, use_order: true };
      params.v4_negative_prompt = { caption: { base_caption: neg, char_captions: [] }, legacy_uc: false };
    }
    let res;
    try {
      res = await fetchWithTimeout(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + cfg.apiKey,
          // NAI 标准 Bearer（pst- 令牌）
          "x-api-key": cfg.apiKey
          // 部分中转站只认此头，双发不冲突
        },
        body: JSON.stringify({ input: clean, model: cfg.model, action: "generate", parameters: params })
      }, ms);
    } catch (err) {
      throw new Error("NovelAI 接口连接失败（地址应为 NAI 站点根地址，如 https://image.novelai.net）：" + (err && err.message));
    }
    if (!res.ok) throw new Error(await this._errText(res, "NovelAI 生图请求失败"));
    let buf;
    try {
      buf = new Uint8Array(await withTimeoutMs(res.arrayBuffer(), ms));
    } catch (err) {
      throw new Error("NovelAI 返回数据读取失败：" + (err && err.message));
    }
    if (buf.length && buf[0] === 123) {
      let txt = "";
      try {
        txt = new TextDecoder().decode(buf);
      } catch (e) {
      }
      let msg = String(txt || "").slice(0, 180);
      try {
        const j = JSON.parse(txt);
        msg = String(j.message || j.error && j.error.message || msg).slice(0, 180);
      } catch (e) {
      }
      throw new Error("NovelAI 接口返回 JSON 而非图片压缩包——请检查地址是否为 NAI 站点（需以 /ai/generate-image 结尾或填站点根地址）：" + msg);
    }
    const png = await this._naiUnzipPng(buf);
    return "data:image/png;base64," + this._toB64(png);
  },
  /** 尺寸 → NAI 合法宽高（64 的倍数，256-1536；1024x1792 这类超限值自动收敛） */
  _naiSize(size) {
    const m = String(size || "").match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/i);
    const w = m ? parseInt(m[1], 10) : 1024;
    const h = m ? parseInt(m[2], 10) : 1024;
    const snap = (v) => Math.max(256, Math.min(1536, Math.round(v / 64) * 64));
    return [snap(w), snap(h)];
  },
  /** 模型代号 → 参数版本（V3=1 / V4·V4.5=3 / V5=4；未知按 V4.5 系主流值） */
  _naiParamsVersion(model) {
    const m = String(model || "").toLowerCase();
    if (m.includes("diffusion-5")) return 4;
    if (m.includes("diffusion-4")) return 3;
    if (m.includes("diffusion-3")) return 1;
    return 3;
  },
  /** 从 NAI 返回的 zip 中提取 PNG（零依赖）
   *  ① 解析 zip 本地文件头：找到 .png 条目 → STORE 直接切 / DEFLATE 走 DecompressionStream
   *  ② v3.18.1 修复（审计低危⑨）：旧实现「扫到第一个 .png 条目就返回」——若包内还有
   *     缩略图/次要图排在主图前（部分代理与新版 NAI 会在主图外附带小图），会取到小图。
   *     现改为先收集全部候选再择优：标准命名 image_0.png 优先，否则取体积最大者
   *  ③ 兜底裸扫 PNG 签名（非标准包 / 前导杂文），截到 IEND 防夹带中央目录字节 */
  async _naiUnzipPng(u8) {
    if (!u8 || !u8.length) throw new Error("NovelAI 接口返回空数据");
    const candidates = [];
    for (let i = 0; i + 30 <= u8.length; i++) {
      if (u8[i] !== 80 || u8[i + 1] !== 75 || u8[i + 2] !== 3 || u8[i + 3] !== 4) continue;
      const method = u8[i + 8] | u8[i + 9] << 8;
      const csize = (u8[i + 18] | u8[i + 19] << 8 | u8[i + 20] << 16 | u8[i + 21] << 24) >>> 0;
      const nlen = u8[i + 26] | u8[i + 27] << 8;
      const elen = u8[i + 28] | u8[i + 29] << 8;
      const nameStart = i + 30;
      const dataStart = nameStart + nlen + elen;
      if (nlen > 500 || dataStart >= u8.length) continue;
      let name = "";
      for (let k = 0; k < nlen; k++) name += String.fromCharCode(u8[nameStart + k]);
      if (!/\.png$/i.test(name)) continue;
      if (method === 0 && csize > 0 && dataStart + csize <= u8.length) {
        const raw = u8.slice(dataStart, dataStart + csize);
        if (this._isPng(raw)) candidates.push({ name, bytes: this._clipPng(raw) });
        continue;
      }
      if (method === 8) {
        let pkEnd = u8.length;
        for (let j = dataStart + 2; j + 4 <= u8.length; j++) {
          if (u8[j] === 80 && u8[j + 1] === 75) {
            pkEnd = j;
            break;
          }
        }
        for (const end of [pkEnd, u8.length]) {
          try {
            const raw = await this._inflateRaw(u8.slice(dataStart, end));
            if (this._isPng(raw)) {
              candidates.push({ name, bytes: this._clipPng(raw) });
              break;
            }
          } catch (e) {
          }
        }
      }
    }
    if (candidates.length) {
      const named = candidates.find((c) => /^image_0\.png$/i.test(c.name));
      const best = named || candidates.reduce((a, b) => a.bytes.length >= b.bytes.length ? a : b);
      return best.bytes;
    }
    for (let i = 0; i + 8 <= u8.length; i++) {
      if (this._isPng(u8, i)) {
        const end = this._pngEnd(u8, i);
        return end ? u8.slice(i, end) : u8.slice(i);
      }
    }
    throw new Error("NovelAI 返回的压缩包中未找到 PNG 图片——可尝试更换浏览器（需支持 zip 解压的较新版本）或确认端点为 NAI 生图地址");
  },
  /** 浏览器原生 deflate-raw 解压（Chrome 80+ / Safari 16.4+ / Firefox 113+） */
  async _inflateRaw(u8) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持 zip 解压（DecompressionStream）");
    }
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },
  /** PNG 签名检测（off 起始位置，供裸扫） */
  _isPng(u8, off = 0) {
    return u8.length >= off + 8 && u8[off] === 137 && u8[off + 1] === 80 && u8[off + 2] === 78 && u8[off + 3] === 71 && u8[off + 4] === 13 && u8[off + 5] === 10 && u8[off + 6] === 26 && u8[off + 7] === 10;
  },
  /** PNG 结束位置（IEND 块尾；找不到返回 0） */
  _pngEnd(u8, from = 0) {
    for (let i = from; i + 8 <= u8.length; i++) {
      if (u8[i] === 73 && u8[i + 1] === 69 && u8[i + 2] === 78 && u8[i + 3] === 68) {
        return Math.min(u8.length, i + 8);
      }
    }
    return 0;
  },
  /** 从签名起截到 IEND（解压结果若夹带尾部杂字节，按 IEND 收口还原纯 PNG） */
  _clipPng(raw) {
    const end = this._pngEnd(raw, 0);
    return end && end <= raw.length ? raw.slice(0, end) : raw;
  },
  /** Uint8Array → base64（分块防超大数组爆栈） */
  _toB64(u8) {
    let s = "";
    const CH = 32768;
    for (let i = 0; i < u8.length; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CH, u8.length)));
    }
    return typeof btoa === "function" ? btoa(s) : Buffer.from(u8).toString("base64");
  },
  /* ==================== 文墨画师实现（v3.12.0 ink 模式） ==================== */
  /** 生成中状态文案：ink 模式换毛笔图标 */
  _genLabel() {
    try {
      return this.get().mode === "ink" ? "🖌 文墨挥毫中…" : "🎨 正在生成插图…";
    } catch (e) {
      return "🎨 正在生成插图…";
    }
  },
  /** 主笔接口配置（ink 模式默认复用；localStorage 优先，运行时兜底） */
  _inkMainCfg() {
    try {
      const raw = localStorage.getItem("storyApiConfig");
      if (raw) {
        const c = JSON.parse(raw);
        if (c && c.endpoint && c.apiKey && c.model) return c;
      }
    } catch (e) {
    }
    const fw = window.storyFramework;
    return fw && fw.apiConfig && fw.apiConfig.endpoint && fw.apiConfig.apiKey && fw.apiConfig.model ? fw.apiConfig : null;
  },
  /** 文墨生图：让纯文本模型手写 SVG 矢量插图 → 浏览器直接渲染（零生图 API 成本）
   *  v3.13.0 丹青精绘：两步构图（先规划后作画）+ 画后质量自检（不合格带反馈重画一次）
   *  文本模型可复用主笔接口（默认）或本卡独立配置（OpenAI / Gemini 双协议） */
  async _genViaInk(cfg, prompt) {
    var _a;
    const tcfg = cfg.inkUseMain !== false ? this._inkMainCfg() : { ...cfg };
    if (!(tcfg && tcfg.endpoint && tcfg.apiKey && tcfg.model)) {
      throw new Error(cfg.inkUseMain !== false ? "文墨模式复用主笔接口，但主笔尚未配置完整（⚙ 接口设置 → 🎭 主笔 AI）" : "文墨模式请填写文本模型的地址 / Key / 模型名，或勾选「复用主笔接口」");
    }
    const ms = secsToMs(cfg.timeout, 240);
    let plan = "";
    if (cfg.inkPlan !== false) {
      try {
        plan = await this._inkCallText(tcfg, [
          { role: "system", content: this._inkPlannerPrompt(cfg) },
          { role: "user", content: prompt }
        ], ms);
      } catch (e) {
        plan = "";
      }
    }
    const paintMsgs = [
      { role: "system", content: this._inkSystemPrompt(cfg) },
      { role: "user", content: plan ? `画面描述：${prompt}

构图规划（严格执行，可微调不可推翻）：
${plan}` : `请为以下画面手写一张 SVG 插图：
${prompt}` }
    ];
    let raw;
    try {
      raw = await this._inkCallText(tcfg, paintMsgs, ms);
    } catch (err) {
      throw new Error("文墨画师接口调用失败：" + (err && err.message));
    }
    let svg = this._inkExtractSvg(raw);
    if (!svg) svg = this._inkAsciiFallback(raw, cfg.size);
    if (!svg) {
      throw new Error("文墨画师未输出 SVG 代码（回复片段：" + String(raw || "").slice(0, 80) + "…）——可重试或换更强的文本模型");
    }
    svg = this._inkFixSvg(this._inkSanitizeSvg(svg), cfg.size);
    if (svg.length > this.INK_MAX_SVG) {
      throw new Error("文墨画师输出的 SVG 过大（" + Math.round(svg.length / 1024) + "KB）——请重试或降低提示词复杂度");
    }
    const issues = this._inkQualityCheck(svg);
    if (issues.length) {
      try {
        const retryRaw = await this._inkCallText(tcfg, paintMsgs.concat([
          { role: "assistant", content: String(raw || "").slice(0, 6e3) },
          { role: "user", content: "你上一稿存在这些问题：" + issues.join("；") + "。请修正后重新输出一张完整 SVG（仍然只输出代码，遵守全部硬性约束与调色板）。" }
        ]), ms);
        const retrySvg = this._inkExtractSvg(retryRaw);
        if (retrySvg) {
          const fixed2 = this._inkFixSvg(this._inkSanitizeSvg(retrySvg), cfg.size);
          if (fixed2.length <= this.INK_MAX_SVG && this._inkQualityCheck(fixed2).length < issues.length) {
            svg = fixed2;
          }
        }
      } catch (e) {
      }
    }
    try {
      (_a = window.TokenUsage) == null ? void 0 : _a.recordOutput(svg, "插图");
    } catch (e) {
    }
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  },
  /** 画师系统提示词：锁定色板 + 五层构图骨架 + 人物剪影铁律 + 范例标杆 + 硬性约束
   *  v3.13.0 针对三大通病：自创配色必脏 → 锁色板；构图松散 → 五层骨架；硬画五官必崩 → 剪影铁律 */
  _inkSystemPrompt(cfg) {
    const m = String(cfg.size || "").match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})/i);
    const w = m ? parseInt(m[1], 10) : 1024;
    const h = m ? parseInt(m[2], 10) : 1024;
    const style = this.INK_STYLES[cfg.inkStyle] || this.INK_STYLES.flat;
    const palette = this.INK_PALETTES[cfg.inkStyle] || this.INK_PALETTES.flat;
    return `你是一位专业 SVG 矢量插画师，为一部长篇小说绘制正文插图。用户给出画面描述，你输出一张完整的 SVG 代码，浏览器将直接渲染成图片。

画布：viewBox="0 0 ${w} ${h}"（宽 ${w} 高 ${h}，横竖构图按此执行）。
画风技法（必须体现）：${style}。

【调色板（只准用下列色值，可用 opacity 与渐变过渡做层次）】
${palette}
配色纪律：主色 1 个 + 辅助色 2-3 个；点缀色只出现在光源与视觉焦点上；严禁自创新色、严禁灰泥色。

【五层构图骨架（必须从后往前按序绘制，每层至少 1 个元素）】
1 背景：全幅 linearGradient 渐变铺底（天空 / 环境），定全图基调
2 远景：低透明度剪影层（opacity 0.3-0.6），拉开景深
3 中景：画面主体所在层，全图对比最强、元素最集中
4 前景：光源 glow（radialGradient 柔光）+ 少量点缀（灯 / 雨 / 飞鸟）
5 暗角：radialGradient 半透明黑 vignette 盖全幅，收拢视线

【人物铁律】
- 人物一律剪影或半剪影：纯色轮廓块，用发型轮廓 / 衣摆 / 姿态讲故事
- 严禁画五官（眼鼻嘴）——SVG 画脸必崩，剪影才高级
- 全图人物最多 3 个；严禁在画面边缘塞头像、圆脸或任何多余符号

【范例（结构与质量标杆——学它的五层结构与克制，严禁照抄内容）】
${this._inkExemplar()}

绘制要求：
- 形状语言：path / circle / ellipse / rect / polygon / line 组合，曲线用 Q / C 贝塞尔
- 形状元素 20-120 个为宜：太少空洞，太多浏览器卡顿
- 全图只有一个光源方向：高光在受光侧，暗部背光，所有色块明暗服从同一光源

硬性约束（违反即废图）：
- 只输出一个 <svg>...</svg> 代码块，不输出任何解释、前后缀或 markdown 代码围栏
- 图内严禁出现文字：不用 <text>、<tspan>、<textPath>（SVG 字体不可控，必翻车）
- 严禁外部资源：不用 <image>、外部 href 或 xlink:href、外部字体
- 严禁 <script>、<foreignObject>、事件属性（on 开头属性）等一切可执行内容
- xmlns="http://www.w3.org/2000/svg" 必须写在 <svg> 根标签上`;
  },
  /** 构图规划师提示词（精绘模式第一步）：先想清楚再动笔，产出紧凑 JSON 构图规划 */
  _inkPlannerPrompt(cfg) {
    const style = this.INK_STYLES[cfg.inkStyle] || this.INK_STYLES.flat;
    const palette = this.INK_PALETTES[cfg.inkStyle] || this.INK_PALETTES.flat;
    return `你是 SVG 插画的构图规划师。读画面描述，先想清楚再动笔——输出一份紧凑的构图规划，纯 JSON、无其他文字：
{"palette":["从调色板选的主色"],"light":"光源位置/颜色/照射方向","layers":[{"name":"背景|远景|中景|前景|暗角","what":"这一层画什么、在画布哪个区域"}],"subjects":["每个主体：位置 + 剪影要点 + 身份特征"],"mood":"一句话氛围"}
规则：固定五层（背景渐变 / 远景剪影 / 中景主体 / 前景光源 / 暗角）；人物一律剪影且最多 3 个、严禁五官；颜色只准取自：${palette}
画风：${style}`;
  },
  /** 范例 SVG（画师提示词内嵌标杆：五层结构 / 锁色 / 人物剪影 / 单一光源 / 暗角收拢） */
  _inkExemplar() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n  <defs>\n    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">\n      <stop offset="0" stop-color="#1a2547"/><stop offset="0.55" stop-color="#3d4f7a"/><stop offset="1" stop-color="#8a6d5c"/>\n    </linearGradient>\n    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">\n      <stop offset="0" stop-color="#fff7d6" stop-opacity="0.9"/><stop offset="0.4" stop-color="#ffe9a8" stop-opacity="0.3"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/>\n    </radialGradient>\n    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">\n      <stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/>\n    </radialGradient>\n  </defs>\n  <rect width="1024" height="1024" fill="url(#sky)"/>\n  <circle cx="760" cy="230" r="170" fill="url(#glow)"/>\n  <circle cx="760" cy="230" r="52" fill="#fdf3d0"/>\n  <path d="M0 620 Q140 520 280 600 T560 590 T840 610 T1024 580 V1024 H0 Z" fill="#232c47" opacity="0.55"/>\n  <path d="M0 700 Q180 640 360 700 T720 690 T1024 720 V1024 H0 Z" fill="#1b2340"/>\n  <path d="M0 820 Q220 760 480 820 T1024 800 V1024 H0 Z" fill="#12172b"/>\n  <path d="M492 820 l14-90 20-6 22 96 z" fill="#0d1122"/>\n  <path d="M470 740 q52-34 104 0 l-8 16 q-44-26-88 0 z" fill="#0d1122"/>\n  <rect x="440" y="818" width="144" height="6" fill="#0d1122"/>\n  <rect x="472" y="762" width="10" height="14" rx="2" fill="#e8dcc0" opacity="0.9"/>\n  <rect x="540" y="762" width="10" height="14" rx="2" fill="#e8dcc0" opacity="0.9"/>\n  <path d="M300 880 q6-46 30-64 q-4 34 10 50 q8-30 28-42 q-2 36 12 56 z" fill="#0a0e1c"/>\n  <path d="M322 802 q22-30 44-4 q-16 8-20 26 z" fill="#0a0e1c"/>\n  <rect width="1024" height="1024" fill="url(#vig)"/>\n</svg>';
  },
  /** 画后质量自检（v3.13.0）：元素数 / 纯色数 / 渐变缺失——软性指标，驱动带反馈重画 */
  _inkQualityCheck(svg) {
    const s = String(svg || "");
    const issues = [];
    const shapes = (s.match(/<(rect|circle|ellipse|path|polygon|polyline|line)\b/gi) || []).length;
    if (shapes < 5) issues.push("形状元素过少（" + shapes + " 个），画面空洞");
    if (shapes > 400) issues.push("形状元素过多（" + shapes + " 个），浏览器会卡顿");
    const colors = new Set((s.match(/fill="#([0-9a-fA-F]{3,8})"/g) || []).map((x) => x.toLowerCase()));
    if (colors.size < 3) issues.push("纯色只用 " + colors.size + " 种，画面平涂单调");
    if (colors.size > 24) issues.push("颜色多达 " + colors.size + " 种，违反调色板纪律");
    if (!/gradient/i.test(s)) issues.push("缺渐变层，背景平涂没有氛围");
    return issues;
  },
  /** 文本模型调用（OpenAI 兼容 / Gemini 原生双协议，非流式拿全量最好解析） */
  async _inkCallText(tcfg, messages, ms) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (tcfg.type === "gemini") {
      const ep = tcfg.endpoint.trim().replace(/\/+$/, "") + "/models/" + encodeURIComponent(tcfg.model) + ":generateContent?key=" + encodeURIComponent(tcfg.apiKey);
      const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const sys = ((_a = messages.find((m) => m.role === "system")) == null ? void 0 : _a.content) || "";
      const res2 = await fetchWithTimeout(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: sys ? { parts: [{ text: sys }] } : void 0,
          generationConfig: { temperature: 0.8, maxOutputTokens: tcfg.maxTokens || 16384 }
        })
      }, ms);
      if (!res2.ok) throw new Error(await this._errText(res2, "文墨画师请求失败"));
      const data2 = await withTimeoutMs(res2.json(), ms);
      const parts = ((_d = (_c = (_b = data2 == null ? void 0 : data2.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) || [];
      return parts.map((p) => p.text || "").filter(Boolean).join("").trim();
    }
    const full = typeof getFullEndpoint === "function" ? getFullEndpoint(tcfg.endpoint, "openai") : tcfg.endpoint.trim().replace(/\/+$/, "") + "/chat/completions";
    const res = await fetchWithTimeout(full, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tcfg.apiKey },
      body: JSON.stringify({
        model: tcfg.model,
        messages,
        temperature: 0.8,
        max_tokens: tcfg.maxTokens || 16384
      })
    }, ms);
    if (!res.ok) throw new Error(await this._errText(res, "文墨画师请求失败"));
    const data = await withTimeoutMs(res.json(), ms);
    const msg = (_f = (_e = data == null ? void 0 : data.choices) == null ? void 0 : _e[0]) == null ? void 0 : _f.message;
    return String((_h = (_g = msg == null ? void 0 : msg.content) != null ? _g : msg == null ? void 0 : msg.reasoning_content) != null ? _h : "").trim();
  },
  /** 从模型回复中提取 SVG：剥代码围栏后取首个 <svg 到末个 </svg>（容错前后杂文） */
  _inkExtractSvg(raw) {
    const t = String(raw || "").replace(/```(?:svg|xml|html)?\s*/gi, "").replace(/```/g, "").trim();
    const s = t.search(/<svg[\s>]/i);
    if (s === -1) return null;
    const e = t.toLowerCase().lastIndexOf("</svg>");
    if (e === -1 || e <= s) return null;
    const svg = t.slice(s, e + 6).trim();
    return svg.length > 30 ? svg : null;
  },
  /** SVG 消毒：剥 script / foreignObject / 事件属性 / 外部链接（dataURL 经 <img> 渲染本不执行脚本，纵深防御） */
  _inkSanitizeSvg(svg) {
    return String(svg || "").replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "").replace(/<script[\s\S]*?>/gi, "").replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "").replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "").replace(/\s(?:xlink:)?href\s*=\s*"([^"]*)"/gi, (m, v) => /^\s*#/.test(v) ? m : "").replace(/\s(?:xlink:)?href\s*=\s*'([^']*)'/gi, (m, v) => /^\s*#/.test(v) ? m : "");
  },
  /** 尺寸修正：缺 viewBox / width / height 时按配置尺寸补全（已有则不动，尊重画师构图） */
  _inkFixSvg(svg, size) {
    const m = String(size || "").match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})/i);
    const w = m ? parseInt(m[1], 10) : 1024;
    const h = m ? parseInt(m[2], 10) : 1024;
    return String(svg || "").replace(/<svg([^>]*)>/i, (whole, attrs) => {
      let a = String(attrs || "");
      if (!/\sviewBox\s*=/i.test(a)) a += ` viewBox="0 0 ${w} ${h}"`;
      if (!/\swidth\s*=/i.test(a)) a += ` width="${w}"`;
      if (!/\sheight\s*=/i.test(a)) a += ` height="${h}"`;
      return `<svg${a}>`;
    });
  },
  /** ASCII 画兜底：模型偶尔不写 SVG 改交字符画——包进等宽字体 SVG 照样成图；不像画则返回 null 走报错 */
  _inkAsciiFallback(raw, size) {
    const lines = String(raw || "").replace(/```[a-z]*\s*|```/gi, "").split(/\r?\n/).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
    if (lines.length < 3) return null;
    const artish = (lines.join("").match(/[/\\|_═─│┌┐└┘╱╲╳▁▂▃▄▅▆▇█░▒▓·:;*^vV<>=+~"'.()\[\]{}@#$%&?-]/g) || []).length;
    if (artish < Math.max(12, lines.length * 2)) return null;
    const m = String(size || "").match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})/i);
    const w = m ? parseInt(m[1], 10) : 1024;
    const shown = lines.slice(0, 48);
    const maxLen = Math.max(...shown.map((l) => l.length), 8);
    const fs = Math.max(6, Math.min(20, Math.floor(w * 0.94 / maxLen)));
    const lh = Math.round(fs * 1.28);
    const body = shown.map((l, i) => `<text x="${Math.round(w * 0.03)}" y="${lh * (i + 1)}" xml:space="preserve">${this.esc(l)}</text>`).join("");
    const totalH = lh * (shown.length + 1);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}"><rect width="100%" height="100%" fill="#101014"/><g fill="#d8d2c4" font-family="'Courier New',monospace" font-size="${fs}">${body}</g></svg>`;
  },
  /* ==================== 持久层（插图随存档） ==================== */
  /** 存档中的插图记录（storyState.illustrations） */
  illusts() {
    const s = window.storyFramework && window.storyFramework.storyState;
    return s && Array.isArray(s.illustrations) ? s.illustrations : [];
  },
  /** 缓存查询：同轮同提示词精确命中 → 同提示词全局最新（跨轮重绘复用） */
  lookupCache(turn, prompt) {
    if (!prompt) return null;
    const list = this.illusts().filter((x) => x && x.url && x.prompt === prompt);
    if (typeof turn === "number") {
      const hit = list.filter((x) => x.turn === turn).pop();
      if (hit) return hit;
    }
    return list[list.length - 1] || null;
  },
  /** 落一条插图记录（同轮同提示词覆盖；回退掉的"未来轮"记录一并清走） */
  saveIllust(entry) {
    const fw = window.storyFramework;
    const s = fw && fw.storyState;
    if (!s) return;
    if (!Array.isArray(s.illustrations)) s.illustrations = [];
    const persist = { ...entry };
    if (typeof persist.url === "string" && persist.url.startsWith("data:") && persist.url.length > 9e5) {
      persist.url = "";
    }
    s.illustrations = s.illustrations.filter((x) => !(x.turn === persist.turn && x.prompt === persist.prompt));
    const cur = typeof fw.currentTurnIndex === "function" ? fw.currentTurnIndex() : null;
    if (typeof cur === "number") {
      s.illustrations = s.illustrations.filter((x) => x.turn == null || x.turn <= cur);
    }
    s.illustrations.push(persist);
    if (s.illustrations.length > 60) s.illustrations = s.illustrations.slice(-60);
    this._trimHeavy();
    try {
      fw.saveStory();
    } catch (e) {
    }
  },
  /** 总量防御：dataUrl 合计超 2.5MB 时从最老的开始清空（保留记录骨架，可重绘） */
  _trimHeavy() {
    const s = window.storyFramework && window.storyFramework.storyState;
    if (!s || !Array.isArray(s.illustrations)) return;
    let total = 0;
    for (const it of s.illustrations) {
      if (typeof it.url === "string" && it.url.startsWith("data:")) total += it.url.length;
    }
    const LIMIT = 2.5 * 1024 * 1024;
    for (const it of s.illustrations) {
      if (total <= LIMIT) break;
      if (typeof it.url === "string" && it.url.startsWith("data:") && it.url.length > 6e4) {
        total -= it.url.length;
        it.url = "";
      }
    }
  },
  /* ==================== 导出与朗读辅助 ==================== */
  /**
   * 导出正文时处理标记：提示词转为一行文字；Markdown 且缓存有有效链接时附图
   * v3.10.0：润色稿存在且不同于一稿时，附一行「实际生图提示词」（txt / md 同规则）
   * @param {string} body extractBody 的结果（含 image 标记）
   * @param {string} fmt 'txt' | 'md'
   */
  formatForExport(body, fmt) {
    const segs = this.splitMarkers(String(body || ""));
    return segs.map((seg) => {
      if (!seg.isImage) return seg.text;
      let line = `〔插图 · 生图提示词〕${seg.prompt}`;
      const hit = this.lookupCache(null, seg.prompt);
      if (hit && hit.finalPrompt && hit.finalPrompt !== seg.prompt) {
        line += `
〔实际生图提示词〕${hit.finalPrompt}`;
      }
      if (fmt === "md" && hit && /^https?:/.test(hit.url)) {
        return `> ${line.replace(/\n/g, "\n> ")}

![插图](${hit.url})`;
      }
      return line;
    }).join("");
  }
};
/* v3.55.3 自举：正文选区「🎨 生图」浮钮就绪（defer 加载，DOM 已解析） */
(function bootImageGenSelect() {
  const run = () => {
    try {
      window.StoryImageGen && window.StoryImageGen._seedDefaults && window.StoryImageGen._seedDefaults();
      window.StoryImageGen && window.StoryImageGen.initSelectToImage();
    } catch (e) { }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
