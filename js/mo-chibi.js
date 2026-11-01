const MoChibi = {
  POS_KEY: "storyMoChibiPos",
  // 角色位置持久化
  HIDE_KEY: "storyMoChibiHide",
  // 收起状态
  _dragging: false,
  _talkTimer: null,
  _bubbleTimer: null,
  _face: "idle",
  /* ==================== 表情定义 ==================== */
  // 每种表情：嘴形 + 眼形 + 眉形（CSS 按 data-face 切换显示）
  faces: ["idle", "happy", "shy", "angry", "think", "sleepy", "surprise", "wink", "sing"],
  /* ==================== 形象(v3.59.1 · 小云 · 十二形态) ==================== */
  /* 「小云」——云精灵少女。十二形态（AI 生图 agnes-image-2.5-flash，白底泛洪抠图转透明）：
     萝莉 / 御姐 / 校花 / 清纯 / 邻家 / 酷飒 / 温柔 / 傲娇 / 可爱 / 搞怪 / 幼态 / 知性。
     默认随机一种；长按菜单「换形象」打开形象面板自由挑选（持久化）。 */
  STYLE_KEY: "moChibiStyle",
  STYLES: ["luo", "yu", "jiaohua", "qingchun", "linjia", "kusa", "wenrou", "aojiao", "keai", "gaoguai", "youtai", "zhixing"],
  IMGS: {
    luo: "assets/xiaoyun-chibi-luo.png", yu: "assets/xiaoyun-chibi-yu.png",
    jiaohua: "assets/xiaoyun-chibi-jiaohua.png", qingchun: "assets/xiaoyun-chibi-qingchun.png",
    linjia: "assets/xiaoyun-chibi-linjia.png", kusa: "assets/xiaoyun-chibi-kusa.png",
    wenrou: "assets/xiaoyun-chibi-wenrou.png", aojiao: "assets/xiaoyun-chibi-aojiao.png",
    keai: "assets/xiaoyun-chibi-keai.png", gaoguai: "assets/xiaoyun-chibi-gaoguai.png",
    youtai: "assets/xiaoyun-chibi-youtai.png", zhixing: "assets/xiaoyun-chibi-zhixing.png"
  },
  FACES: {
    luo: "assets/xiaoyun-face-luo.png", yu: "assets/xiaoyun-face-yu.png",
    jiaohua: "assets/xiaoyun-face-jiaohua.png", qingchun: "assets/xiaoyun-face-qingchun.png",
    linjia: "assets/xiaoyun-face-linjia.png", kusa: "assets/xiaoyun-face-kusa.png",
    wenrou: "assets/xiaoyun-face-wenrou.png", aojiao: "assets/xiaoyun-face-aojiao.png",
    keai: "assets/xiaoyun-face-keai.png", gaoguai: "assets/xiaoyun-face-gaoguai.png",
    youtai: "assets/xiaoyun-face-youtai.png", zhixing: "assets/xiaoyun-face-zhixing.png"
  },
  STYLE_LABEL: { luo: "萝莉", yu: "御姐", jiaohua: "校花", qingchun: "清纯", linjia: "邻家", kusa: "酷飒", wenrou: "温柔", aojiao: "傲娇", keai: "可爱", gaoguai: "搞怪", youtai: "幼态", zhixing: "知性" },
  STYLE_DESC: {
    luo: "云朵短发 · 可爱俏皮", yu: "银白直发 · 成熟从容",
    jiaohua: "学院西装 · 优雅自信", qingchun: "水手裙 · 羞涩纯真",
    linjia: "怀抱白猫 · 温柔治愈", kusa: "黑色皮衣 · 桀骜酷飒",
    wenrou: "淡紫长裙 · 恬静温婉", aojiao: "红蝶结 · 傲娇别扭",
    keai: "云朵卫衣 · 元气满满", gaoguai: "彩色拼衣 · 俏皮鬼脸",
    youtai: "毛绒裙 · 天真软萌", zhixing: "细框眼镜 · 知性书卷"
  },
  _style: null,
  _resolved: false,
  /** 解析当前形态：显式存了合法 key 就用它；'random' 或未设置则随机（五选一）。
      幂等：每会话只随机一次，保证宠物立绘与各处头像始终同一形态。 */
  resolveStyle() {
    if (this._resolved && this._style) return this._style;
    let s = "random";
    try { s = localStorage.getItem(this.STYLE_KEY) || "random"; } catch (e) { }
    if (!this.STYLES.includes(s)) s = this.STYLES[Math.floor(Math.random() * this.STYLES.length)];
    this._style = s;
    this._resolved = true;
    return s;
  },
  currentStyle() { return this.resolveStyle(); },
  chibiSrc() { return this.IMGS[this.currentStyle()] || this.IMGS.luo; },
  faceSrc() { return this.FACES[this.currentStyle()] || this.FACES.luo; },
  buildIMG() {
    return `<img class="mc-img" src="${this.chibiSrc()}?v=3.59.1" alt="小云" draggable="false" decoding="async" aria-label="小云">`;
  },
  /** 手动设定形态（合法 key），持久化并立刻刷新宠物与所有头像 */
  setStyle(s) {
    if (!this.STYLES.includes(s)) return;
    try { localStorage.setItem(this.STYLE_KEY, s); } catch (e) { }
    this._style = s;
    this._resolved = true;
    this.applyStyle();
  },
  toggleStyle() {
    const i = this.STYLES.indexOf(this.currentStyle());
    const next = this.STYLES[(i + 1) % this.STYLES.length];
    this.setStyle(next);
    this.setFace("happy", 1800);
    this.say(`换成「${this.STYLE_LABEL[next]}」形态啦～`, 2200);
  },
  /** 形象选择面板：五形态预览网格，点选即换（v3.59.0） */
  openStylePicker() {
    const old = document.getElementById("mcStylePicker");
    if (old) { old.remove(); return; }
    const cur = this.currentStyle();
    const ov = document.createElement("div");
    ov.id = "mcStylePicker";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(8,14,22,.66);display:flex;align-items:center;justify-content:center;padding:18px;";
    const card = (k) => `
      <button data-style="${k}" style="width:31%;min-width:96px;padding:10px 6px;border:2px solid ${k === cur ? "#7ab8e8" : "rgba(140,180,220,.28)"};border-radius:14px;background:linear-gradient(160deg,rgba(20,32,48,.92),rgba(14,22,34,.92));cursor:pointer;text-align:center;transition:transform .15s;">
        <img src="${this.IMGS[k]}?v=3.59.1" style="height:110px;max-width:100%;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4));" alt="${this.STYLE_LABEL[k]}">
        <div style="font-size:13.5px;font-weight:700;color:#cfe6f8;margin-top:6px;">${this.STYLE_LABEL[k]}</div>
        <div style="font-size:10.5px;color:#7e9ab4;margin-top:2px;">${this.STYLE_DESC[k] || ""}</div>
      </button>`;
    ov.innerHTML = `<div style="width:min(420px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(165deg,#101c2a,#0b141e);border:1px solid rgba(120,170,220,.32);border-radius:18px;padding:18px;">
      <div style="font-weight:700;font-size:15px;color:#a8d0ee;margin-bottom:4px;">💇 小云 · 形象换装</div>
      <div style="font-size:11.5px;color:#7e9ab4;margin-bottom:12px;">选一个你喜欢的形态，随时再来换～</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">${this.STYLES.map(card).join("")}</div>
      <button data-act="close" style="width:100%;margin-top:12px;padding:9px;border:1px solid rgba(120,170,220,.32);border-radius:10px;background:transparent;color:#8fb4d0;cursor:pointer;">关闭</button>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-style]");
      if (btn) {
        const k = btn.dataset.style;
        this.setStyle(k);
        this.setFace("happy", 1800);
        this.say(`换成「${this.STYLE_LABEL[k]}」形态啦～`, 2200);
        ov.remove();
        return;
      }
      if (e.target === ov || e.target.dataset.act === "close") ov.remove();
    });
  },
  /** 原地换图（不重建 DOM）：宠物立绘 + 抽屉/欢迎/消息三处头像一起换 */
  applyStyle() {
    const box = document.getElementById("moChibi");
    if (box) box.dataset.style = this.currentStyle();
    const img = document.querySelector("#moChibi .mc-img");
    if (img) img.src = this.chibiSrc() + "?v=3.59.1";
    const face = this.faceSrc() + "?v=3.59.1";
    document.querySelectorAll(".mo-avatar img, .mo-welcome-avatar img, .mo-msg-avatar img").forEach((el) => {
      el.src = face;
    });
  },
  /* ==================== DOM 自举 ==================== */
  ensureDOM() {
    if (document.getElementById("moChibi")) return;
    this._style = this.resolveStyle();
    const box = document.createElement("div");
    box.id = "moChibi";
    box.className = "mo-chibi";
    box.dataset.face = "idle";
    box.dataset.style = this.currentStyle();
    box.title = "小云 · 拖我到任意位置 / 单击聊天 / 长按菜单";
    box.innerHTML = `
            <div class="mc-shadow"></div>
            <div class="mc-float">${this.buildIMG()}</div>
            <span class="mc-badge" id="moDockBadge"></span>
            <div class="mc-bubble" id="mcBubble" role="status"></div>
            <div class="mc-hearts" id="mcHearts"></div>
            <div class="mc-zzz" id="mcZzz">💤</div>`;
    document.body.appendChild(box);
    const restore = document.createElement("button");
    restore.id = "moChibiRestore";
    restore.className = "mc-restore";
    restore.title = "唤醒小云";
    restore.textContent = "云";
    restore.onclick = () => this.show();
    document.body.appendChild(restore);
    const menu = document.createElement("div");
    menu.id = "mcMenu";
    menu.className = "mc-menu";
    document.body.appendChild(menu);
    this.bindInteractions(box);
    const saved = this._loadPos(this.POS_KEY);
    if (saved) this._applyPos(box, saved);
    if (this.isHidden()) this.hide(true);
    setTimeout(() => this.greet(), 1200);
  },
  bindInteractions(box) {
    this.makeDraggable(box, {
      storageKey: this.POS_KEY,
      // v1.8.1：不再吸附屏幕边缘，松手放哪停哪（旧版松手必飞向左右边缘）
      onClick: () => {
        var _a;
        if (this.isHidden()) return;
        (_a = window.MoAssistant) == null ? void 0 : _a.openPanel();
        this.setFace("happy", 1800);
      },
      onLongPress: (el, e) => this.openMenu(el, e),
      onDragStart: () => {
        this.setFace("surprise");
        box.classList.add("dragging");
        this.hideBubble(true);
      },
      onDragEnd: () => {
        box.classList.remove("dragging");
        this.setFace("happy", 1600);
        this.say("呀～飞过来啦！(≧▽≦)", 2600);
      }
    });
    box.addEventListener("dblclick", (e) => {
      e.preventDefault();
      Math.random() < 0.5 ? this.patHead() : this.poke();
    });
    box.addEventListener("pointerenter", () => { this._hoverRect = box.getBoundingClientRect(); });
    box.addEventListener("pointermove", (e) => {
      if (this._dragging) return;
      /* v3.55.3 性能：摸头判定不再逐事件 getBoundingClientRect（强制布局），
         指针进入时缓存一次包围盒即可——宠物在 hover 期间不会自己移动 */
      const r = this._hoverRect || (this._hoverRect = box.getBoundingClientRect());
      const y = (e.clientY - r.top) / r.height;
      if (y < 0.3) {
        box.classList.add("pat");
      } else {
        box.classList.remove("pat");
      }
    });
    box.addEventListener("pointerleave", () => { this._hoverRect = null; box.classList.remove("pat"); });
    box.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openMenu(box, e);
    });
    box.addEventListener("pointerenter", () => this.wake());
    box.addEventListener("pointerdown", () => this.wake());
  },
  /* ==================== 闲置避让（v1.9.0 解决"挡字"） ====================
     角色停在页面文字上方时会把文字盖住。现在闲置 6 秒自动降为 30% 透明度，
     底下文字清晰透出；指针靠近/按下/说话立即恢复。拖拽与菜单打开期间不降。 */
  startDimWatch() {
    this._dimTimer = null;
    this._armDim();
  },
  _armDim() {
    clearTimeout(this._dimTimer);
    this._dimTimer = setTimeout(() => {
      var _a;
      const box = document.getElementById("moChibi");
      if (!box || this._dragging) return this._armDim();
      if (box.classList.contains("hidden")) return;
      if (document.querySelector(".mc-menu.show")) return this._armDim();
      if ((_a = document.getElementById("mcBubble")) == null ? void 0 : _a.classList.contains("show")) return this._armDim();
      box.classList.add("dim");
    }, 6e3);
  },
  /** 唤醒：退出半透明并重新计时 */
  wake() {
    var _a;
    (_a = document.getElementById("moChibi")) == null ? void 0 : _a.classList.remove("dim");
    this._armDim();
  },
  /* ==================== 表情系统 ==================== */
  setFace(name, revertMs = 0) {
    const box = document.getElementById("moChibi");
    if (!box) return;
    if (!this.faces.includes(name)) name = "idle";
    this._face = name;
    box.dataset.face = name;
    clearTimeout(this._faceTimer);
    if (revertMs > 0) {
      this._faceTimer = setTimeout(() => {
        box.dataset.face = "idle";
        this._face = "idle";
      }, revertMs);
    }
  },
  face() {
    return this._face;
  },
  /* ==================== 眨眼循环 ==================== */
  startBlinkLoop() {
    if (this._blinkOn) return;
    this._blinkOn = true;
    const blink = () => {
      const box = document.getElementById("moChibi");
      if (box && !["sleepy", "happy", "sing"].includes(box.dataset.face)) {
        box.classList.add("blink");
        setTimeout(() => box == null ? void 0 : box.classList.remove("blink"), 140);
      }
      setTimeout(blink, 2200 + Math.random() * 3200);
    };
    setTimeout(blink, 1800 + Math.random() * 2e3);
  },
  /* ==================== 说话动画（嘴巴开合） ==================== */
  talk() {
    this.stopTalk();
    const box = document.getElementById("moChibi");
    if (!box) return;
    /* v3.55.3 流畅模式：嘴部开合是 150ms 级 class 翻转，低配机直接免掉（不影响气泡/表情） */
    if (document.documentElement.classList.contains("low-spec")) return;
    if (this._face === "idle") this.setFace("idle");
    let open = false;
    this._talkTimer = setInterval(() => {
      open = !open;
      box.classList.toggle("talking", open);
    }, 150);
  },
  stopTalk() {
    var _a;
    clearInterval(this._talkTimer);
    this._talkTimer = null;
    (_a = document.getElementById("moChibi")) == null ? void 0 : _a.classList.remove("talking");
  },
  /* ==================== 头顶气泡 ==================== */
  /** HTML 转义（v1.9.1：say() 文本可能来自 AI 回复摘要等外部内容，防止 XSS） */
  esc(str) {
    return String(str != null ? str : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  say(text, ms = 5e3) {
    var _a;
    const bubble = document.getElementById("mcBubble");
    if (!bubble) return;
    (_a = this.wake) == null ? void 0 : _a.call(this);
    clearTimeout(this._bubbleTimer);
    bubble.innerHTML = this.esc(text);
    bubble.classList.add("show");
    this.hideBubble = (force) => {
      if (force) clearTimeout(this._bubbleTimer);
      bubble.classList.remove("show");
    };
    this._bubbleTimer = setTimeout(() => bubble.classList.remove("show"), ms);
  },
  hideBubble() {
  },
  /** 气泡流式正文容器（MoAssistant 气泡模式聊天复用） */
  bubbleEl() {
    return document.getElementById("mcBubble");
  },
  /* ==================== 互动：摸头 / 戳脸 ==================== */
  patHead() {
    this.setFace("happy", 2400);
    this.spawnHearts(4);
    const lines = [
      "嘿嘿…主人在摸小云的头 (〃ω〃)",
      "呜哇…头发要乱啦～",
      "再摸就要长不高了哦！…才怪,继续摸也可以 (〃▽〃)",
      "主人的手好温暖呀…"
    ];
    this.say(lines[Math.floor(Math.random() * lines.length)], 3200);
  },
  poke() {
    this.setFace("shy", 2200);
    this.spawnHearts(2);
    const lines = [
      "呀!戳、戳哪里啦 >_<",
      "呜…小云不是布丁啦!",
      "哼,再戳就要生气了哦!(鼓脸)",
      "唔哇!吓小云一跳…"
    ];
    this.say(lines[Math.floor(Math.random() * lines.length)], 2800);
  },
  spawnHearts(n = 3) {
    const box = document.getElementById("mcHearts");
    if (!box) return;
    const glyphs = ["♥", "❤", "💗", "✨"];
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "mc-heart";
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      s.style.left = 30 + Math.random() * 45 + "%";
      s.style.animationDelay = i * 0.14 + "s";
      s.style.fontSize = 11 + Math.random() * 9 + "px";
      box.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }
  },
  /* ==================== 扇形菜单（长按 / 右键） ==================== */
  menuItems() {
    var _a, _b, _c;
    const ttsOn = (_c = (_b = (_a = window.MoAssistant) == null ? void 0 : _a.getCfg) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.tts;
    return [
      { ico: "💬", label: "聊天", act: () => {
        var _a2;
        return (_a2 = window.MoAssistant) == null ? void 0 : _a2.openPanel();
      } },
      { ico: "🗨️", label: "气泡聊", act: () => this.startBubbleChat() },
      { ico: "💡", label: "灵感", act: () => {
        var _a2;
        return (_a2 = window.MoAssistant) == null ? void 0 : _a2.runQuick({ text: "小云,结合现在的剧情给我来点新鲜的灵感吧!" });
      } },
      { ico: "🔧", label: "体检", act: () => {
        var _a2;
        return (_a2 = window.MoAssistant) == null ? void 0 : _a2.runHealthCheck();
      } },
      { ico: "🎭", label: "表情", act: () => this.cycleFace() },
      { ico: "💇", label: "换形象", act: () => this.openStylePicker() },
      { ico: ttsOn ? "🔊" : "🔇", label: ttsOn ? "语音开" : "语音关", act: () => {
        var _a2;
        (_a2 = window.MoAssistant) == null ? void 0 : _a2.toggleTTS();
        this.renderMenu();
      } },
      /* v3.55.19 悬浮球收敛：世界动态 / 手机 / 太虚阁 并入小云的「模块」二级面板。
         不直接摊在扇形菜单里——扇形 radius 110 / spread 150°，项数一多就互相压叠。 */
      { ico: "🧰", label: "模块", act: () => this.openModules() },
      { ico: "🌙", label: "收起", act: () => this.hide() }
    ];
  },
  /* ==================== 模块二级面板（收编的悬浮球功能） ==================== */
  _isEarth() {
    try { return (new URLSearchParams(location.search).get("genre") || "") === "earth"; } catch (e) { return false; }
  },
  /** 读（已隐藏的）原悬浮球徽标的未读数 */
  _dockUnread(id) {
    try {
      const b = document.getElementById(id);
      if (!b || b.style.display === "none") return "";
      return (b.textContent || "").trim();
    } catch (e) { return ""; }
  },
  moduleEntries() {
    const list = [];
    if (window.DynamicWorld) {
      const u = this._dockUnread("dwDockBadge");
      list.push({ ico: "🌍", name: "世界动态", note: u ? u + " 条未读" : "额外 AI 推演的远方事件", act: () => window.DynamicWorld.openPanel() });
    }
    try {
      if (window.PhonePanel && this._isEarth() && window.PhonePanel.tier && window.PhonePanel.tier() !== "none") {
        const u = this._dockUnread("phDockBadge");
        list.push({ ico: "📱", name: "手机分身", note: u ? u + " 条未读" : "聊天 / 朋友圈", act: () => window.PhonePanel.open() });
      }
    } catch (e) {}
    if (window.ImmersiveSuite && !this._isEarth()) {
      list.push({ ico: "⛩", name: "太虚阁 · 沉浸万象", note: "人物志 / 藏宝阁 / 编年史", act: () => window.ImmersiveSuite.toggle(true) });
    }
    /* v3.55.19 剧情上下文：人物 / 机缘归属 / 伏笔 / 大事记 聚成一屏，两种视图可切 */
    if (window.ContextPanel) {
      list.push({ ico: "📖", name: "剧情上下文", note: "人物 · 机缘归属 · 伏笔 · 大事记", act: () => window.ContextPanel.open() });
    }
    /* v3.55.20 本界资料库：每个世界自己的 lore 库，可看 / 增补 / 从故事抽取 */
    if (window.WorldBook) {
      list.push({ ico: "📚", name: "本界资料库", note: "点开看 · 增补缺失的世界书 / 从故事抽取", act: () => window.WorldBook.open() });
    }
    /* v3.55.23 大势演化账本：诱因可断、大事可改道、羁绊可易主、新事可生 */
    if (window.CanonTimeline) {
      const nEv = CanonTimeline.all().length, nBd = CanonTimeline.allBonds().length;
      list.push({ ico: "🌊", name: "大势演化账本", note: nEv + nBd ? "大事 " + nEv + " · 羁绊 " + nBd + " · 因果可改" : "原著大势可改 · 诱因亡则事亡", act: () => window.CanonTimeline.open() });
    }
    /* v3.55.23 行旅图鉴：可视化动态地图——足迹点亮、剧情地标、资料库地理上图 */
    if (window.StoryAtlas) {
      list.push({ ico: "🗺", name: "行旅图鉴 · 世界地图", note: "足迹走到哪 · 点亮到哪", act: () => window.StoryAtlas.toggle(true) });
    }
    /* v3.55.20 玩家身份（穿越者 / 土著）与主角关系（同伴 / 敌对 / 陌路） */
    if (window.StoryIdentity) {
      const idn = window.StoryIdentity.infoIdentity();
      list.push({ ico: idn.ico, name: "玩家身份：" + idn.name, note: "点按切换 · " + idn.desc, act: () => {
        const id = window.StoryIdentity.cycleIdentity();
        const info = window.StoryIdentity.infoIdentity();
        this.say("玩家身份已切到「" + info.name + "」——" + info.hint, 4200);
      } });
      const rel = window.StoryIdentity.infoRelation();
      if (rel) {
        list.push({ ico: rel.ico, name: "主角关系：" + rel.name, note: "点按切换 · " + rel.desc, act: () => {
          const id = window.StoryIdentity.cycleRelation();
          const info = window.StoryIdentity.infoRelation();
          if (!info) { this.say("取代主角立场下没有「关系」——你就是原著主角本人。", 3800); return; }
          this.say("主角关系已切到「" + info.name + "」——" + info.hint, 4200);
        } });
      }
    }
    /* v3.55.19 叙事立场：取代主角 / 同行者 / 搅局者 */
    if (window.StoryStance) {
      const st = window.StoryStance.info();
      list.push({ ico: st.ico, name: "叙事立场：" + st.name, note: "点按切换 · " + st.desc, act: () => {
        const id = window.StoryStance.cycle();
        const info = window.StoryStance.info();
        this.say("叙事立场已切到「" + info.name + "」——" + info.desc, 4200);
      } });
    }
    return list;
  },
  openModules() {
    let host = document.getElementById("mcModules");
    if (!host) {
      host = document.createElement("div");
      host.id = "mcModules";
      host.className = "mc-modules";
      document.body.appendChild(host);
    }
    const items = this.moduleEntries();
    if (!items.length) {
      this.say("这个题材没有可开的模块哦～", 2600);
      return;
    }
    host.innerHTML =
      '<div class="mcm-back" data-close="1"></div>' +
      '<div class="mcm-card">' +
        '<div class="mcm-title">🧰 模块</div>' +
        items.map((it, i) => '<button class="mcm-item" data-i="' + i + '">' +
          '<span class="mcm-ico">' + it.ico + '</span>' +
          '<span class="mcm-txt"><b>' + it.name + '</b><i>' + it.note + '</i></span></button>').join("") +
        '<div class="mcm-foot">点空白处关闭</div>' +
      '</div>';
    host.classList.add("show");
    host.querySelectorAll(".mcm-item").forEach((b) => {
      b.onclick = () => {
        const it = items[parseInt(b.dataset.i, 10)];
        host.classList.remove("show");
        try { if (it && it.act) it.act(); } catch (e) {}
      };
    });
    host.querySelectorAll("[data-close]").forEach((el) => { el.onclick = () => host.classList.remove("show"); });
  },
  renderMenu() {
    const menu = document.getElementById("mcMenu");
    if (!menu) return;
    menu.innerHTML = this.menuItems().map(
      (it, i) => `<button class="mc-menu-item" data-i="${i}" style="--i:${i}"><span class="mc-menu-ico">${it.ico}</span><span class="mc-menu-lb">${it.label}</span></button>`
    ).join("");
    menu.querySelectorAll(".mc-menu-item").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const it = this.menuItems()[parseInt(btn.dataset.i)];
        this.closeMenu();
        it == null ? void 0 : it.act();
      };
    });
  },
  openMenu(box, e) {
    var _a;
    (_a = e == null ? void 0 : e.preventDefault) == null ? void 0 : _a.call(e);
    const menu = document.getElementById("mcMenu");
    if (!menu) return;
    if (menu.classList.contains("show")) {
      this.closeMenu();
      return;
    }
    this.renderMenu();
    const r = box.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.45;
    const radius = Math.min(110, window.innerWidth * 0.28);
    const items = menu.querySelectorAll(".mc-menu-item");
    const spread = 150;
    const startDeg = 90 - spread / 2;
    items.forEach((btn, i) => {
      const deg = items.length === 1 ? 90 : startDeg + spread / (items.length - 1) * i;
      const rad = deg * Math.PI / 180;
      const x = Math.cos(rad) * radius;
      const y = -Math.sin(rad) * radius;
      btn.style.setProperty("--tx", x + "px");
      btn.style.setProperty("--ty", y + "px");
    });
    menu.style.left = cx + "px";
    menu.style.top = cy + "px";
    menu.classList.add("show");
    this.setFace("wink", 2400);
    setTimeout(() => {
      const closer = (ev) => {
        if (!menu.contains(ev.target)) {
          this.closeMenu();
          document.removeEventListener("pointerdown", closer);
        }
      };
      document.addEventListener("pointerdown", closer);
    }, 60);
  },
  closeMenu() {
    var _a;
    (_a = document.getElementById("mcMenu")) == null ? void 0 : _a.classList.remove("show");
  },
  cycleFace() {
    const cur = this.faces.indexOf(this._face);
    const next = this.faces[(cur + 1) % this.faces.length];
    this.setFace(next, 4e3);
    const names = { idle: "待机", happy: "开心", shy: "害羞", angry: "哼哼", think: "思考", sleepy: "瞌睡", surprise: "惊讶", wink: "眨眼", sing: "唱歌" };
    this.say(`换上「${names[next] || next}」表情啦～`, 2200);
  },
  /* ==================== 气泡模式聊天（桌面宠物式） ==================== */
  startBubbleChat() {
    var _a, _b;
    const MA = window.MoAssistant;
    if (!((_a = MA == null ? void 0 : MA.isReady) == null ? void 0 : _a.call(MA))) {
      this.setFace("angry", 2e3);
      this.say("呜…小云连不上接口,先到右上角 ⚙ 配置一下嘛 (´•̥ω•̥`)", 4200);
      (_b = window.ConfigModal) == null ? void 0 : _b.open();
      return;
    }
    const box = document.getElementById("moChibi");
    if (!box) return;
    const existing = document.getElementById("mcChat");
    if (existing) {
      const inner = existing.querySelector("#mcChatInput");
      if (inner) {
        inner.focus();
        return;
      }
      existing.remove();
    }
    const chat = document.createElement("div");
    chat.id = "mcChat";
    chat.className = "mc-chat";
    chat.innerHTML = `
            <input id="mcChatInput" type="text" placeholder="和小云说句话…" maxlength="300" />
            <button id="mcChatSend">➤</button>`;
    document.body.appendChild(chat);
    const place = () => {
      const r = box.getBoundingClientRect();
      const w = 260;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(x, window.innerWidth - w - 10));
      let y = r.top - 66;
      if (y < 10) y = r.bottom + 12;
      chat.style.left = x + "px";
      chat.style.top = y + "px";
    };
    place();
    chat._place = place;
    window.addEventListener("resize", place);
    let dismissTimer = null;
    const armDismiss = () => {
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        if (document.getElementById("mcChat")) {
          chat.remove();
          window.removeEventListener("resize", place);
        }
      }, 12e3);
    };
    const sendIt = () => {
      const val = input.value.trim();
      if (!val) return;
      clearTimeout(dismissTimer);
      chat.remove();
      window.removeEventListener("resize", place);
      this.setFace("happy", 1500);
      MA == null ? void 0 : MA.sendBubble(val);
    };
    const input = chat.querySelector("#mcChatInput");
    input.focus();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendIt();
    });
    input.addEventListener("input", armDismiss);
    chat.querySelector("#mcChatSend").onclick = sendIt;
    armDismiss();
  },
  /* ==================== 问候（时间感知） ==================== */
  greet() {
    if (this.isHidden()) return;
    const h = (/* @__PURE__ */ new Date()).getHours();
    let line, face = "happy";
    if (h >= 5 && h < 9) line = "早安,主人!新的一天也要好好写故事哦 (◕‿◕✿)";
    else if (h >= 9 && h < 12) line = "上午好呀～今天的文思泉涌了吗?";
    else if (h >= 12 && h < 14) line = "中午啦,主人吃过饭了吗?饿着肚子可写不出好故事哦!";
    else if (h >= 14 && h < 18) line = "下午好～要不要让小云给你来点灵感?长按我就好!";
    else if (h >= 18 && h < 23) line = "晚上好呀,今晚写点什么好呢?嘿嘿～";
    else {
      line = "都这个点了…主人再写一章就睡觉,好不好嘛 (¦3【▓▓】";
      face = "sleepy";
    }
    this.setFace(face, 4e3);
    this.say(line, 5e3);
  },
  /* ==================== 待机行为循环 ==================== */
  startIdleLoop() {
    if (this._idleOn) return;
    this._idleOn = true;
    const loop = () => {
      if (this.isHidden() || this._dragging || this._talkTimer) {
        setTimeout(loop, 8e3);
        return;
      }
      const roll = Math.random();
      if (roll < 0.3) {
        this.setFace("surprise", 2e3);
        const box = document.getElementById("moChibi");
        box == null ? void 0 : box.classList.add("tilt");
        setTimeout(() => box == null ? void 0 : box.classList.remove("tilt"), 1800);
      } else if (roll < 0.5) {
        this.setFace("sleepy", 2600);
        const z = document.getElementById("mcZzz");
        if (z) {
          z.classList.add("show");
          setTimeout(() => z.classList.remove("show"), 2400);
        }
      } else if (roll < 0.72) {
        const lines = [
          "主人在写什么呀?让小云瞄一眼嘛～",
          "小云在这里哦,随时待命!٩(๑•̀ω•́๑)۶",
          "嘿嘿,刚才那个情节写得好棒!",
          "要不要休息一下下?小云给你唱歌…才怪 (´,,•ω•,,)♡",
          "笔别停呀,小云等着看下文呢!",
          "悄悄说:知识库好久没喂新设定了哦…"
        ];
        this.say(lines[Math.floor(Math.random() * lines.length)], 3800);
        this.setFace("wink", 3e3);
      } else {
        const box = document.getElementById("moChibi");
        box == null ? void 0 : box.classList.add("wave");
        setTimeout(() => box == null ? void 0 : box.classList.remove("wave"), 2e3);
      }
      setTimeout(loop, 18e3 + Math.random() * 2e4);
    };
    setTimeout(loop, 9e3);
  },
  /* ==================== 显示 / 隐藏 ==================== */
  isHidden() {
    try {
      return localStorage.getItem(this.HIDE_KEY) === "1";
    } catch (e) {
      return false;
    }
  },
  hide(silent = false) {
    const box = document.getElementById("moChibi");
    box == null ? void 0 : box.classList.add("hidden");
    const restore = document.getElementById("moChibiRestore");
    restore == null ? void 0 : restore.classList.add("show");
    try {
      localStorage.setItem(this.HIDE_KEY, "1");
    } catch (e) {
    }
    if (!silent) this.say("小云先睡啦,想我就点小图标～", 2e3);
  },
  show() {
    var _a;
    const box = document.getElementById("moChibi");
    box == null ? void 0 : box.classList.remove("hidden");
    (_a = document.getElementById("moChibiRestore")) == null ? void 0 : _a.classList.remove("show");
    try {
      localStorage.setItem(this.HIDE_KEY, "0");
    } catch (e) {
    }
    this.setFace("happy", 2500);
    this.spawnHearts(3);
    this.say("小云回来啦!主人想我了没有呀 (≧▽≦)", 3e3);
  },
  /* ==================== 通用拖拽系统（小云 + 动态世界悬浮球共用） ==================== */
  /**
   * 让元素可自由拖拽：单击/长按/拖动自动区分,位置持久化,屏幕内约束
   * v1.8.1 修复：
   *   1) 拖拽状态闭包化——此前 _lastX/_lastY 挂在 MoChibi 上被角色与悬浮球共享,
   *      两个球交替拖动时指针差值串位,导致位置跳变/抽搐
   *   2) 默认不再强制吸附屏幕左右边缘,松手放哪停哪(旧版松手必飞向边缘,像拖不动)
   *   3) 拖动开始瞬间清空 transition——旧版吸附动画残留 340ms,期间再抓取跟手卡顿
   *   4) 长按菜单弹出后手指移动不再触发拖拽(旧版菜单开着角色还会被拖走)
   * v1.10.3 修复「不能灵活拖动」：
   *   5) 逐帧定位不再读 getBoundingClientRect——旧版以它为基准累计指针差值,而
   *      .dragging 的 rotate(-9deg) scale(1.06) 让包围盒每边比布局框大 ~10px,
   *      该偏移逐帧累加,角色刚被抓住就漂离指针并顶死屏幕左上角,表现即"拖不动/
   *      不跟手"(手机指针事件更密,症状尤甚)。现改为「拖拽开始时的布局基准位 +
   *      指针总位移」纯算术定位,指针在哪角色就在哪,且免去每帧强制重排
   *   6) 视口约束/边缘吸附/落点记忆统一改用布局尺寸(offsetWidth/Height)与
   *      style.left/top,松手时 .dragging 变换仍在生效也不会存偏位置
   * @param {HTMLElement} el 目标元素(position: fixed)
   * @param {object} opt { storageKey, edge:'x'|false, onClick, onLongPress, onDragStart, onDragEnd }
   */
  makeDraggable(el, opt = {}) {
    if (!el || el._moDraggable) return;
    el._moDraggable = true;
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    const saved = opt.storageKey ? this._loadPos(opt.storageKey) : null;
    if (saved) {
      this._applyPos(el, saved);
    } else {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.left = rect.left + "px";
        el.style.top = rect.top + "px";
      }
    }
    let startX = 0, startY = 0, baseX = 0, baseY = 0;
    let moved = false, active = false, dragging = false, longFired = false, pressTimer = null;
    const THRESHOLD = 6;
    const down = (e) => {
      var _a;
      if (e.button !== void 0 && e.button !== 0) return;
      if (el.classList.contains("hidden")) return;
      active = true;
      moved = false;
      dragging = false;
      longFired = false;
      startX = e.clientX;
      startY = e.clientY;
      try {
        (_a = el.setPointerCapture) == null ? void 0 : _a.call(el, e.pointerId);
      } catch (err) {
      }
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        var _a2;
        if (active && !moved) {
          longFired = true;
          (_a2 = opt.onLongPress) == null ? void 0 : _a2.call(opt, el, e);
        }
      }, 520);
    };
    const move = (e) => {
      var _a;
      if (!active || longFired) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      if (!moved) {
        moved = true;
        clearTimeout(pressTimer);
      }
      if (!dragging) {
        dragging = true;
        MoChibi._dragging = el;
        baseX = parseFloat(el.style.left);
        baseY = parseFloat(el.style.top);
        if (!isFinite(baseX) || !isFinite(baseY)) {
          const r0 = el.getBoundingClientRect();
          baseX = r0.left;
          baseY = r0.top;
        }
        el.style.transition = "none";
        (_a = opt.onDragStart) == null ? void 0 : _a.call(opt, el);
      }
      const w = el.offsetWidth || 1, h = el.offsetHeight || 1;
      let nx = Math.max(4, Math.min(baseX + (e.clientX - startX), window.innerWidth - w - 4));
      let ny = Math.max(4, Math.min(baseY + (e.clientY - startY), window.innerHeight - h - 4));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
      if (e.cancelable) e.preventDefault();
    };
    const up = (e) => {
      var _a, _b;
      if (!active) return;
      clearTimeout(pressTimer);
      const wasDragging = dragging;
      const wasLong = longFired;
      active = false;
      dragging = false;
      if (MoChibi._dragging === el) MoChibi._dragging = false;
      startX = startY = 0;
      if (!el.isConnected) return;
      if (wasDragging) {
        requestAnimationFrame(() => {
          el.style.transition = "";
        });
        this._snapAndSave(el, opt);
        (_a = opt.onDragEnd) == null ? void 0 : _a.call(opt, el);
        el._justDragged = true;
        setTimeout(() => {
          el._justDragged = false;
        }, 350);
      } else if (!wasLong && !moved) {
        (_b = opt.onClick) == null ? void 0 : _b.call(opt, el, e);
      }
    };
    el.addEventListener("click", (e) => {
      if (el._justDragged) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("resize", () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const w = el.offsetWidth || r.width || 1;
      const h = el.offsetHeight || r.height || 1;
      let nx = Math.max(4, Math.min(r.left, window.innerWidth - w - 4));
      let ny = Math.max(4, Math.min(r.top, window.innerHeight - h - 4));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
      if (opt.storageKey) this._snapAndSave(el, { ...opt, edge: false });
    });
  },
  /** 松手落点持久化；opt.edge='x' 时可选吸附左右边缘（v1.8.1 起默认关闭） */
  _snapAndSave(el, opt) {
    let x = parseFloat(el.style.left), y = parseFloat(el.style.top);
    if (!isFinite(x) || !isFinite(y)) {
      const r = el.getBoundingClientRect();
      x = r.left;
      y = r.top;
    }
    const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
    if (opt.edge === "x" && w > 0) {
      const centerX = x + w / 2;
      const toLeft = centerX < window.innerWidth / 2;
      x = toLeft ? 6 : window.innerWidth - w - 6;
      el.style.transition = "left .32s cubic-bezier(.22,.9,.3,1.2)";
      el.style.left = x + "px";
      setTimeout(() => {
        el.style.transition = "";
      }, 340);
    }
    if (opt.storageKey && w > 0) {
      try {
        localStorage.setItem(opt.storageKey, JSON.stringify({
          x: x / window.innerWidth,
          y: y / window.innerHeight
        }));
      } catch (e) {
      }
    }
  },
  _loadPos(key) {
    try {
      const p = JSON.parse(localStorage.getItem(key) || "null");
      if (p && typeof p.x === "number" && typeof p.y === "number") return p;
    } catch (e) {
    }
    return null;
  },
  _applyPos(el, p) {
    el.style.right = "auto";
    el.style.bottom = "auto";
    const w = el.offsetWidth || 100;
    const h = el.offsetHeight || 100;
    let x = p.x * window.innerWidth;
    let y = p.y * window.innerHeight;
    x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - h - 4));
    el.style.left = x + "px";
    el.style.top = y + "px";
  },
  /* ==================== 生命周期 ==================== */
  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this._boot());
    } else {
      this._boot();
    }
  },
  _boot() {
    this.ensureDOM();
    this.startBlinkLoop();
    this.startIdleLoop();
    this.startDimWatch();
    console.log("[小云] 桌面宠物形象已就位（可拖拽 / 长按菜单 / 双击互动 / 闲置自动避让）");
  }
};
window.MoChibi = MoChibi;
