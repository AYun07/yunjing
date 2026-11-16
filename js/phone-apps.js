(function() {
  "use strict";
  const PhoneApps = {
    version: "v3.47.1",
    /* ==================== App 注册表（时代即边界） ====================
       tiers: 可见档位；year: 最低年份（如短视频 2016+ 才有抖音）；
       dock: 是否常驻底部 Dock
       v3.47.0 墨韵融合：+微博(2009+) / +匿名树洞(2011+) / +日历 / +商城 / +日记 */
    APPS: [
      { id: "chat", name: "微信", icon: "💬", hue: 145, tiers: ["wechat", "qq", "sms"], dock: true },
      { id: "weibo", name: "微博", icon: "🌤", hue: 30, tiers: ["wechat", "qq"], year: 2009 },
      { id: "music", name: "音乐", icon: "🎵", hue: 335, tiers: ["wechat", "qq"], dock: true },
      { id: "video", name: "短视频", icon: "🎬", hue: 22, tiers: ["wechat"], year: 2016 },
      { id: "forum", name: "论坛", icon: "📋", hue: 190, tiers: ["wechat", "qq"], year: 2005 },
      { id: "anonymous", name: "匿名树洞", icon: "🕶", hue: 260, tiers: ["wechat"], year: 2011 },
      { id: "mall", name: "商城", icon: "🛒", hue: 15, tiers: ["wechat", "qq", "sms"] },
      { id: "calendar", name: "日历", icon: "📅", hue: 205, tiers: ["wechat", "qq", "sms"] },
      { id: "diary", name: "日记", icon: "📓", hue: 45, tiers: ["wechat", "qq", "sms"] },
      { id: "live", name: "直播", icon: "📺", hue: 340, tiers: ["wechat"], year: 2016 },
      { id: "album", name: "相册", icon: "🖼️", hue: 262, tiers: ["wechat", "qq"], dock: true },
      { id: "weather", name: "天气", icon: "🌤️", hue: 200, tiers: ["wechat", "qq", "sms"], dock: true },
      { id: "clock", name: "时钟", icon: "⏰", hue: 35, tiers: ["wechat", "qq", "sms"] },
      { id: "calc", name: "计算器", icon: "🧮", hue: 120, tiers: ["wechat", "qq", "sms"] },
      { id: "snake", name: "贪吃蛇", icon: "🐍", hue: 95, tiers: ["wechat", "qq", "sms"] },
      { id: "settings", name: "设置", icon: "⚙️", hue: 210, tiers: ["wechat", "qq", "sms"] }
    ],
    /* ==================== 状态分区（storyState.phone.apps） ==================== */
    appsState(panel) {
      const p = panel.state();
      if (!p.apps || typeof p.apps !== "object") p.apps = {};
      if (!p.apps.music) p.apps.music = { idx: 0, playing: false, pos: 0 };
      if (!Array.isArray(p.apps.videos)) p.apps.videos = [];
      if (!Array.isArray(p.apps.videoLiked)) p.apps.videoLiked = [];
      if (!p.apps.videoTab || !["rec", "follow", "local"].includes(p.apps.videoTab)) p.apps.videoTab = "rec";
      if (!Array.isArray(p.apps.videoFollows)) p.apps.videoFollows = [];
      if (!p.apps.videoCmts || typeof p.apps.videoCmts !== "object") p.apps.videoCmts = {};
      if (!p.apps.videoShares || typeof p.apps.videoShares !== "object") p.apps.videoShares = {};
      if (typeof p.apps.snakeBest !== "number") p.apps.snakeBest = 0;
      if (!p.apps.calc) p.apps.calc = { expr: "", last: "" };
      if (!Array.isArray(p.apps.forumThreads)) p.apps.forumThreads = [];
      if (!Array.isArray(p.apps.forumLiked)) p.apps.forumLiked = [];
      if (!p.apps.forumTab || !["hot", "local", "life", "work"].includes(p.apps.forumTab)) p.apps.forumTab = "hot";
      if (!Array.isArray(p.apps.liveRooms)) p.apps.liveRooms = [];
      if (!Array.isArray(p.apps.liveFollows)) p.apps.liveFollows = [];
      if (!p.apps.appearance || typeof p.apps.appearance !== "object") p.apps.appearance = {};
      /* v3.47.0 墨韵融合分区（详细初始化在 PhoneSocial.state，此处保证结构存在防旧档报错） */
      if (!Array.isArray(p.apps.weiboPosts)) p.apps.weiboPosts = [];
      if (!Array.isArray(p.apps.weiboHot)) p.apps.weiboHot = [];
      if (!Array.isArray(p.apps.weiboLiked)) p.apps.weiboLiked = [];
      if (!p.apps.weiboView) p.apps.weiboView = "feed";
      if (!p.apps.anon || typeof p.apps.anon !== "object") p.apps.anon = { current: null, history: [] };
      if (!Array.isArray(p.apps.calMark)) p.apps.calMark = [];
      if (!Array.isArray(p.apps.mallGoods)) p.apps.mallGoods = [];
      if (!Array.isArray(p.apps.mallOrders)) p.apps.mallOrders = [];
      if (!Array.isArray(p.apps.diary)) p.apps.diary = [];
      return p.apps;
    },
    /** 外观三件套实际值（缺省回退） */
    appearance() {
      const a = (window.PhonePanel ? this.appsState(window.PhonePanel) : {}).appearance || {};
      return {
        wall: a.wall || "default",
        font: a.font || "m"
      };
    },
    /** 外观挂到手机壳（data-attr 驱动 CSS）+ 同步记忆到 localStorage（布局记忆同库） */
    applyAppearance() {
      const shell = document.getElementById("phShell");
      if (!shell) return;
      const a = this.appearance();
      shell.dataset.wall = a.wall;
      shell.dataset.font = a.font;
      try {
        const L = JSON.parse(localStorage.getItem("storyPhoneShellLayout") || "{}") || {};
        L.wall = a.wall;
        L.font = a.font;
        localStorage.setItem("storyPhoneShellLayout", JSON.stringify(L));
      } catch (e) {
      }
    },
    /* ==================== 通用工具 ==================== */
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    },
    /** 故事年份（与面板 detectTier 同源种子链）——短视频等按年门控用 */
    yearOf(panel) {
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const setup = fw && fw.storyState && fw.storyState.setup || {};
      const seeds = [
        v.era,
        v.时代,
        v.date,
        v.日期,
        setup.customTimeline,
        setup.timelineDesc,
        setup.customEntry,
        setup.timeline
      ];
      for (const s of seeds) {
        const y = panel.parseYear ? panel.parseYear(s) : null;
        if (y != null) return y;
      }
      return null;
    },
    /** 当前时代可见的 App 列表（含年份门控与 Dock 拆分） */
    appsFor(tier, year) {
      return this.APPS.filter((a) => a.tiers.includes(tier) && (!a.year || year != null && year >= a.year));
    },
    /** 故事时间（可解析则用故事时间，否则真实时间） */
    timeParts(panel) {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const t = String(v.time || v.时刻 || "");
      const m = t.match(/(\d{1,2})[:：时点](\d{1,2})/);
      if (m) return { h: Number(m[1]) % 24, m: Number(m[2]) % 60, story: true };
      const d = /* @__PURE__ */ new Date();
      return { h: d.getHours(), m: d.getMinutes(), story: false };
    },
    /** 日期标签（故事日期优先，含星期） */
    dateLabel(panel) {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const d = v.date || v.日期 || "";
      if (d) return String(d).slice(0, 18);
      const n = /* @__PURE__ */ new Date();
      const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][n.getDay()];
      return `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日 ${wd}`;
    },
    /* ==================== 视图分发 ==================== */
    render(panel) {
      this.cleanupAppTimers();
      this.applyAppearance();
      const app = panel.view && panel.view.app || "home";
      switch (app) {
        case "lock":
          return this.renderLock(panel);
        case "home":
          return this.renderHome(panel);
        case "music":
          return this.renderMusic(panel);
        case "video":
          return this.renderVideo(panel);
        case "forum":
          return this.renderForum(panel);
        case "live":
          return this.renderLive(panel);
        case "album":
          return this.renderAlbum(panel);
        case "weather":
          return this.renderWeather(panel);
        case "calc":
          return this.renderCalc(panel);
        case "clock":
          return this.renderClock(panel);
        case "snake":
          return this.renderSnake(panel);
        case "settings":
          return this.renderSettings(panel);
        /* v3.47.0 墨韵融合五 App：渲染转发给 PhoneSocial（模块缺失时回桌面，老档不炸） */
        case "weibo":
          return window.PhoneSocial ? window.PhoneSocial.renderWeibo(panel) : this.renderHome(panel);
        case "anonymous":
          return window.PhoneSocial ? window.PhoneSocial.renderAnonymous(panel) : this.renderHome(panel);
        case "calendar":
          return window.PhoneSocial ? window.PhoneSocial.renderCalendar(panel) : this.renderHome(panel);
        case "mall":
          return window.PhoneSocial ? window.PhoneSocial.renderMall(panel) : this.renderHome(panel);
        case "diary":
          return window.PhoneSocial ? window.PhoneSocial.renderDiary(panel) : this.renderHome(panel);
        default:
          return this.renderHome(panel);
      }
    },
    /* ==================== 🔒 锁屏 ==================== */
    renderLock(panel) {
      const t = panel.tierInfo() || { carrier: "5G" };
      const tp = this.timeParts(panel);
      const hh = String(tp.h).padStart(2, "0"), mm = String(tp.m).padStart(2, "0");
      const p = panel.state();
      const rows = p.chats.filter((c) => c.unread > 0).slice(0, 3).map((c) => `<div class="ph-lock-msg">💬 ${this.esc(c.name)} · ${c.unread} 条新消息</div>`).join("");
      return `<div class="ph-lock" onclick="PhoneApps.unlock()">
                <div class="ph-lock-carrier">${this.esc(t.carrier || "")}</div>
                <div class="ph-lock-time">${hh}:${mm}</div>
                <div class="ph-lock-date">${this.esc(this.dateLabel(panel))}</div>
                <div class="ph-lock-msgs">${rows}</div>
                <button class="ph-lock-unlock" onclick="event.stopPropagation();PhoneApps.unlock()">⌃&nbsp;&nbsp;上滑解锁&nbsp;&nbsp;⌃</button>
            </div>`;
    },
    unlock() {
      var _a;
      this.goHome();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    /* ==================== 🏠 桌面 ==================== */
    renderHome(panel) {
      const tier = panel.tier();
      const t = panel.tierInfo() || {};
      const year = this.yearOf(panel);
      const apps = this.appsFor(tier, year);
      const p = panel.state();
      const unread = p.chats.reduce((a, c) => a + (c.unread || 0), 0);
      const tp = this.timeParts(panel);
      const hh = String(tp.h).padStart(2, "0"), mm = String(tp.m).padStart(2, "0");
      const w = this.weatherOf(panel);
      const icon = (a) => {
        const isChat = a.id === "chat";
        const name = isChat ? t.appName || "微信" : a.name;
        const badge = isChat && unread > 0 ? `<i class="ph-icon-badge">${unread > 99 ? "99+" : unread}</i>` : "";
        return `<button class="ph-app-icon" onclick="PhoneApps.openApp('${a.id}')" title="${this.esc(name)}">
                    <span class="ph-icon-squircle" style="--ih:${a.hue}">${a.icon}${badge}</span>
                    <label>${this.esc(name)}</label>
                </button>`;
      };
      const grid = apps.filter((a) => !a.dock).map(icon).join("");
      const dock = apps.filter((a) => a.dock).map(icon).join("");
      return `<div class="ph-home">
                <div class="ph-home-widget" onclick="PhoneApps.openApp('weather')" title="看天气">
                    <div class="ph-hw-time">${hh}:${mm}</div>
                    <div class="ph-hw-date">${this.esc(this.dateLabel(panel))}</div>
                    <div class="ph-hw-weather">${w.icon} ${this.esc(w.city)} ${w.temp}° · ${this.esc(w.cond)}</div>
                </div>
                <div class="ph-home-grid">${grid}</div>
                <div class="ph-home-dock">${dock}</div>
            </div>`;
    },
    /* ==================== 导航 ==================== */
    openApp(id) {
      var _a;
      const P = window.PhonePanel;
      if (!P) return;
      if (id === "chat") {
        P.view = { app: "wechat", tab: "chats", chat: "" };
      } else {
        P.view = { app: id };
      }
      P.render();
      (_a = P.updateDock) == null ? void 0 : _a.call(P);
    },
    goHome() {
      var _a;
      const P = window.PhonePanel;
      if (!P) return;
      this._fOpen = null;
      this._lOpen = null;
      this.stopDanmaku();
      /* v3.47.0 墨韵融合：回桌面时清掉新 App 的临时视图（微博详情/日记编辑） */
      if (window.PhoneSocial) {
        try { window.PhoneSocial.cleanup(); } catch (e) { }
      }
      P.view = { app: "home" };
      P.render();
      (_a = P.updateDock) == null ? void 0 : _a.call(P);
    },
    /** App 头部（返回桌面 + 标题 + 副题） */
    appHead(panel, title, sub) {
      return `<div class="ph-chat-head">
                <button class="ph-back" onclick="PhoneApps.goHome()" title="回到桌面">‹</button>
                <b>${this.esc(title)}</b><span class="ph-app-sub">${this.esc(sub || "")}</span>
            </div>`;
    },
    /* ==================== 🎵 音乐（年代歌单 · 纯本地零 token） ==================== */
    SONGS: {
      wechat: [
        { t: "晴天", a: "周杰伦" },
        { t: "起风了", a: "买辣椒也用券" },
        { t: "孤勇者", a: "陈奕迅" },
        { t: "平凡之路", a: "朴树" },
        { t: "成都", a: "赵雷" },
        { t: "泡沫", a: "邓紫棋" },
        { t: "消愁", a: "毛不易" },
        { t: "年少有为", a: "李荣浩" },
        { t: "光年之外", a: "邓紫棋" },
        { t: "如果可以", a: "韦礼安" },
        { t: "不要慌太阳下山有月光", a: "GooGoo" },
        { t: "像鱼", a: "王贰浪" }
      ],
      qq: [
        { t: "老鼠爱大米", a: "杨臣刚" },
        { t: "两只蝴蝶", a: "庞龙" },
        { t: "青花瓷", a: "周杰伦" },
        { t: "童话", a: "光良" },
        { t: "江南", a: "林俊杰" },
        { t: "Super Star", a: "S.H.E" },
        { t: "遇见", a: "孙燕姿" },
        { t: "月亮之上", a: "凤凰传奇" },
        { t: "秋天不回来", a: "王强" },
        { t: "北京欢迎你", a: "群星" },
        { t: "香水有毒", a: "胡杨林" },
        { t: "想唱就唱", a: "张含韵" }
      ]
    },
    songList(panel) {
      return this.SONGS[panel.tier()] || this.SONGS.qq;
    },
    songOf(panel, i) {
      const list = this.songList(panel);
      return list[(i % list.length + list.length) % list.length];
    },
    /** 拟真时长（同曲恒定）：180-259 秒 */
    durOf(s) {
      let h = 0;
      for (const ch of String(s && s.t || "x")) h = (h * 31 + ch.charCodeAt(0)) % 997;
      return 180 + h % 80;
    },
    fmt(sec) {
      sec = Math.max(0, Math.floor(sec));
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    },
    mstate(panel) {
      return this.appsState(panel).music;
    },
    renderMusic(panel) {
      const m = this.mstate(panel);
      const list = this.songList(panel);
      const s = this.songOf(panel, m.idx);
      const dur = this.durOf(s);
      const pct = Math.min(100, m.pos / dur * 100);
      const rows = list.map((x, i) => `<button class="ph-song ${i === m.idx ? "on" : ""}" onclick="PhoneApps.musicPick(${i})">
                    <span class="ph-song-idx">${i === m.idx ? "♪" : i + 1}</span>
                    <span class="ph-song-name">${this.esc(x.t)}</span>
                    <span class="ph-song-artist">${this.esc(x.a)}</span>
                    <span class="ph-song-dur">${this.fmt(this.durOf(x))}</span>
                </button>`).join("");
      return `<div class="ph-app ph-app-music">
                ${this.appHead(panel, "音乐", panel.tier() === "qq" ? "MP3 播放列表" : "本地歌单")}
                <div class="ph-music-stage">
                    <div class="ph-disc ${m.playing ? "spin" : ""}"><span>🎵</span></div>
                    <div class="ph-music-meta"><b>${this.esc(s.t)}</b><span>${this.esc(s.a)}</span></div>
                </div>
                <div class="ph-music-bar">
                    <i id="phMusicPos">${this.fmt(m.pos)}</i>
                    <div class="ph-music-track"><div class="ph-music-fill" style="width:${pct}%"></div></div>
                    <i>${this.fmt(dur)}</i>
                </div>
                <div class="ph-music-ctrl">
                    <button onclick="PhoneApps.musicPrev()" title="上一首">⏮</button>
                    <button class="ph-music-play" onclick="PhoneApps.musicToggle()">${m.playing ? "⏸" : "▶"}</button>
                    <button onclick="PhoneApps.musicNext()" title="下一首">⏭</button>
                    <button class="ph-music-shuffle" onclick="PhoneApps.musicShuffle()" title="随便听听">🔀</button>
                </div>
                <div class="ph-playlist">${rows}</div>
            </div>`;
    },
    musicToggle() {
      var _a;
      const P = window.PhonePanel;
      const m = this.mstate(P);
      m.playing = !m.playing;
      if (m.playing) this.musicTick();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    musicPick(i) {
      var _a;
      const P = window.PhonePanel;
      const m = this.mstate(P);
      m.idx = Number(i) || 0;
      m.pos = 0;
      m.playing = true;
      this.musicTick();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    musicNext(silent) {
      var _a;
      const P = window.PhonePanel;
      const m = this.mstate(P);
      m.idx = (m.idx + 1) % this.songList(P).length;
      m.pos = 0;
      if (!silent) {
        this.musicTick();
        P.render();
      }
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    musicPrev() {
      var _a;
      const P = window.PhonePanel;
      const m = this.mstate(P);
      const len = this.songList(P).length;
      m.idx = (m.idx - 1 + len) % len;
      m.pos = 0;
      this.musicTick();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    musicShuffle() {
      var _a;
      const P = window.PhonePanel;
      const m = this.mstate(P);
      const len = this.songList(P).length;
      if (len > 1) {
        let n = m.idx;
        while (n === m.idx) n = Math.floor(Math.random() * len);
        m.idx = n;
      }
      m.pos = 0;
      m.playing = true;
      this.musicTick();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    /** 播放计时（轻量直更 DOM，不整屏重绘——列表滚动位置不丢） */
    musicTick() {
      if (typeof document === "undefined") return;
      clearInterval(this._musicTimer);
      this._musicTimer = setInterval(() => {
        const P = window.PhonePanel;
        if (!P || !P.view || P.view.app !== "music") return;
        const shell = document.getElementById("phShell");
        if (!shell || !shell.classList.contains("open")) return;
        const m = this.mstate(P);
        if (!m.playing) return;
        const dur = this.durOf(this.songOf(P, m.idx));
        m.pos += 1;
        if (m.pos >= dur) {
          this.musicNext(true);
          P.render();
          return;
        }
        const fill = document.querySelector(".ph-music-fill");
        if (fill) fill.style.width = Math.min(100, m.pos / dur * 100) + "%";
        const tEl = document.getElementById("phMusicPos");
        if (tEl) tEl.textContent = this.fmt(m.pos);
      }, 1e3);
    },
    /* ==================== 🎬 短视频（2016+ · 本地兜底 + AI 缓存） ==================== */
    VTEMPLATES: [
      { title: "凌晨两点的便利店，关东煮还冒着热气", tag: "深夜食堂" },
      { title: "加班到十一点，地铁末班车只剩我一个人", tag: "都市夜归人" },
      { title: "猫把我键盘踩出了乱码，但我不敢生气", tag: "吸猫日常" },
      { title: "今天的天空是橘子味的", tag: "随手拍" },
      { title: "挑战连续吃辣七天，第二天就投降了", tag: "美食挑战" },
      { title: "第一次给自己做生日蛋糕，卖相丑但很甜", tag: "厨房小白" },
      { title: "公司楼下的桂花开了，秋天真的来了", tag: "季节限定" },
      { title: "把出租屋改造成小书房，花了三个周末", tag: "改造日记" },
      { title: "周末去菜场砍价，阿姨多送了我两根葱", tag: "生活气" },
      { title: "健身卡办了三个月，今天终于去了第一次", tag: "自律人生" },
      { title: "下班绕远路走回家，晚风真的很舒服", tag: "散步治愈" },
      { title: "楼顶看到的落日，治愈了整个星期", tag: "落日收藏家" }
    ],
    VEMOJI: ["🌃", "🍜", "🐱", "🌅", "🌶️", "🎂", "🍂", "📚", "🥬", "🏃", "🌆", "🚇", "🎸", "🌙"],
    VMUSIC: ["轻快钢琴曲", "City Pop 混剪", "夏日汽水感 BGM", "Lo-fi 学习频道", "温柔吉他弹唱", "国风纯音乐", "深夜电台白噪音"],
    /* ==================== 🎬 短视频（v3.22.0 拟真抖音 · 2016+） ====================
       推荐/关注/同城三页签 · 双列瀑布流 · 全屏沉浸播放 · AI 评论区（本地兜底）
       · 分享到聊天（近讯回流）· 作者主页与关注 —— 全部复用第六接口 */
    /** 播放量人性化（1.2w / 856） */
    vh(n) {
      n = Math.max(0, Math.round(Number(n) || 0));
      return n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, "") + "w" : String(n);
    },
    /** 本地模板视频（零 token 兜底）：联系人当作者，确定性种子；v3.22.0 补 views/city/tag */
    localVideos(panel, reseed) {
      const p = panel.state();
      const names = p.contacts.map((c) => c.name);
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const city = String(v.location || v.位置 || "这座城市").slice(0, 12);
      const turn = fw && fw.storyState && fw.storyState.turnCount || 0;
      const seed = reseed ? this._vSeed = (this._vSeed || 0) + 1 + turn : this._vSeed || 0;
      const out = [];
      for (let i = 0; i < 6; i++) {
        const h = panel.hueOf("v" + seed + "_" + i + (names[i % Math.max(1, names.length)] || ""));
        const tp = this.VTEMPLATES[(h + i * 5) % this.VTEMPLATES.length];
        const author = names.length ? names[(h + i) % names.length] : "路人博主";
        const likes = 80 + h * 37 % 9e3;
        out.push({
          author,
          title: tp.title,
          music: this.VMUSIC[h % this.VMUSIC.length],
          likes,
          comments: 3 + h * 13 % 600,
          views: likes * (3 + h % 9),
          // v3.22.0：播放量
          city: h % 2 ? city : "远方",
          // 一半同城
          tag: tp.tag
        });
      }
      return out;
    },
    vkey(v) {
      return String(v.author || "") + "|" + String(v.title || "");
    },
    /** 当前页签的视频列表（关注页过滤已关注作者 · 同城页过滤故事城市，空则本地补齐） */
    videoList(panel) {
      const apps = this.appsState(panel);
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const city = String(v.location || v.位置 || "").slice(0, 12);
      let list = apps.videos;
      if (apps.videoTab === "follow") {
        const follows = new Set(apps.videoFollows);
        const f = list.filter((x) => follows.has(String(x.author)));
        if (f.length) list = f;
        else list = this.localFollowVideos(panel);
      } else if (apps.videoTab === "local") {
        const l = list.filter((x) => String(x.city || "") === city);
        if (l.length) list = l;
        else list = this.localCityVideos(panel);
      }
      return list;
    },
    /** 关注页本地兜底：已关注作者每人一条（确定性） */
    localFollowVideos(panel) {
      const apps = this.appsState(panel);
      const src = this.localVideos(panel);
      return apps.videoFollows.slice(0, 6).map((name, i) => ({
        ...src[i % src.length],
        author: name
      }));
    },
    /** 同城页本地兜底：全部标故事城市 */
    localCityVideos(panel) {
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const city = String(v.location || v.位置 || "这座城市").slice(0, 12);
      return this.localVideos(panel).slice(0, 4).map((x) => ({ ...x, city }));
    },
    /** 双列瀑布流 + 三页签（v3.22.0 拟真抖音首页形态） */
    renderVideo(panel) {
      const apps = this.appsState(panel);
      if (!apps.videos.length) apps.videos = this.localVideos(panel);
      if (this._vProfile) return this.renderVideoProfile(panel);
      if (this._vOpen != null) return this.renderVideoPlay(panel);
      const tabs = [["rec", "推荐"], ["follow", "关注"], ["local", "同城"]];
      const list = this.videoList(panel);
      const cards = list.map((v, i) => {
        const em = this.VEMOJI[panel.hueOf(String(v.title || "x")) % this.VEMOJI.length];
        const hue = panel.hueOf(String(v.author || "x")) % 360;
        return `<button class="ph-vcard" style="--vh:${hue}" onclick="PhoneApps.videoOpen(${i})">
                    <span class="ph-vcard-cover"><i>${em}</i></span>
                    <p>${this.esc(v.title)}</p>
                    <small><b>▶ ${this.vh(v.views || (v.likes || 100) * 5)}</b> @${this.esc(v.author)}</small>
                </button>`;
      }).join("") || '<div class="ph-vempty">这个页签暂时没有内容，先去推荐页逛逛</div>';
      return `<div class="ph-app ph-app-video">
                ${this.appHead(panel, "短视频", "刷不停 · 点开沉浸看")}
                <div class="ph-vtabs">${tabs.map((t) => `<button class="${apps.videoTab === t[0] ? "on" : ""}" onclick="PhoneApps.videoTab('${t[0]}')">${t[1]}</button>`).join("")}
                </div>
                <div class="ph-vfalls">${cards}</div>
                <button class="ph-vrefresh" onclick="PhoneApps.videoRefresh()" title="换一批">↻</button>
            </div>`;
    },
    videoTab(t) {
      const P = window.PhonePanel;
      this.appsState(P).videoTab = t;
      this._vOpen = null;
      P.render();
    },
    /* ---------- 全屏沉浸播放 ---------- */
    videoOpen(i) {
      var _a;
      this._vOpen = i;
      this._vCmt = false;
      this._vShare = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    videoStep(d) {
      var _a, _b;
      const P = window.PhonePanel;
      const list = this.videoList(P);
      let i = (this._vOpen || 0) + d;
      if (i < 0) {
        (_a = window.showToast) == null ? void 0 : _a.call(window, "已经是第一条了", "info");
        return;
      }
      if (i >= list.length) {
        this._vOpen = null;
        P.render();
        (_b = window.showToast) == null ? void 0 : _b.call(window, "🎬 刷完了，回到首页", "info");
        return;
      }
      this._vOpen = i;
      this._vCmt = false;
      this._vShare = false;
      P.render();
    },
    /** 全屏播放页：一条一屏 + 右侧操作栏 + 底部作者栏；评论区/分享面板为底部弹层 */
    renderVideoPlay(panel) {
      const apps = this.appsState(panel);
      const list = this.videoList(panel);
      const i = Math.min(this._vOpen || 0, list.length - 1);
      this._vOpen = i;
      const v = list[i];
      if (!v) {
        this._vOpen = null;
        return this.renderVideo(panel);
      }
      const k = this.vkey(v);
      const liked = apps.videoLiked.includes(k);
      const em = this.VEMOJI[panel.hueOf(String(v.title || "x")) % this.VEMOJI.length];
      const cmtCount = this.cmtCountOf(panel, v);
      const shares = apps.videoShares[k] || 0;
      return `<div class="ph-app ph-vplay-app">
                <div class="ph-vplay" style="--vh:${panel.hueOf(String(v.author || "x")) % 360}">
                    <div class="ph-vplay-top">
                        <button onclick="PhoneApps.videoClose()" title="返回">‹</button>
                        <span>${apps.videoTab === "follow" ? "关注" : apps.videoTab === "local" ? "同城" : "推荐"}</span>
                        <i>${i + 1}/${list.length}</i>
                    </div>
                    <div class="ph-vplay-screen" ondblclick="PhoneApps.videoLike(${i})">
                        <span class="ph-vplay-em">${em}</span>
                        <em class="ph-vplay-hint">双击点赞 · 上下切换</em>
                    </div>
                    <div class="ph-vplay-nav">
                        <button onclick="PhoneApps.videoStep(-1)" title="上一条">↑</button>
                        <button onclick="PhoneApps.videoStep(1)" title="下一条">↓</button>
                    </div>
                    <div class="ph-vplay-side">
                        <button class="ph-vact ${liked ? "on" : ""}" onclick="PhoneApps.videoLike(${i})">❤️<b>${this.vh((v.likes || 0) + (liked ? 1 : 0))}</b></button>
                        <button class="ph-vact" onclick="PhoneApps.videoCmtOpen()">💬<b>${this.vh(cmtCount)}</b></button>
                        <button class="ph-vact" onclick="PhoneApps.videoShareOpen()">↗️<b>${this.vh(shares)}</b></button>
                        <button class="ph-vact" onclick="PhoneApps.videoProfileOpen(${JSON.stringify(String(v.author)).replace(/"/g, "&quot;")})">👤<b>主页</b></button>
                    </div>
                    <div class="ph-vplay-info">
                        <b onclick="PhoneApps.videoProfileOpen(${JSON.stringify(String(v.author)).replace(/"/g, "&quot;")})">@${this.esc(v.author)}</b>
                        <p>${this.esc(v.title)}</p>
                        <span>🎵 ${this.esc(v.music || "轻音乐")} · ▶ ${this.vh(v.views || (v.likes || 100) * 5)} 次播放</span>
                    </div>
                    ${this._vShare ? this.renderVideoShare(panel, v) : ""}
                    ${this._vCmt ? this.renderVideoCmts(panel, v) : ""}
                </div>
            </div>`;
    },
    videoClose() {
      var _a;
      this._vOpen = null;
      this._vCmt = false;
      this._vShare = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /* ---------- 评论区（抖音的灵魂） ---------- */
    /** 本地模板评论（零 token 兜底）：确定性哈希选文案 + 熟人乱入 */
    localCmts(panel, v) {
      const p = panel.state();
      const h = panel.hueOf(this.vkey(v));
      const pool = [
        "哈哈哈哈这也太真实了",
        "蹲一个后续",
        "拍得也太有生活气了",
        "这就是平凡日子里的小确幸吧",
        "看到一半居然笑了",
        "保存了，心情不好就拿出来看",
        "评论区怎么都是人才",
        "这条视频治好了我的精神内耗",
        "太有共鸣了，谁懂啊",
        "随手一拍就是电影感"
      ];
      const out = [];
      for (let i = 0; i < 4; i++) {
        const t = pool[(h + i * 3) % pool.length];
        out.push({ name: `路人${(h + i * 7) % 99}号`, text: t, likes: 3 + h * (i + 2) % 900 });
      }
      const names = p.contacts.map((c) => c.name);
      if (names.length) {
        const c = names[h % names.length];
        out.splice(1, 0, { name: c, text: ["刷到你了哈哈", "这也拍得也太好了吧", "哈哈哈哈是你吗", "同款生活"][h % 4], likes: 50 + h % 300 });
      }
      return out;
    },
    /** 评论数：缓存评论条数 or 视频自带数 */
    cmtCountOf(panel, v) {
      const apps = this.appsState(panel);
      const c = apps.videoCmts[this.vkey(v)];
      return c && c.length ? c.length : v.comments != null ? v.comments : Math.floor((v.likes || 100) / 12);
    },
    videoCmtOpen() {
      var _a;
      this._vCmt = true;
      this._vShare = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 评论区弹层：本地评论即时可见，AI 生成一次缓存（点开才调，成本可控） */
    renderVideoCmts(panel, v) {
      const apps = this.appsState(panel);
      const k = this.vkey(v);
      let cmts = apps.videoCmts[k];
      if (!cmts) {
        cmts = apps.videoCmts[k] = this.localCmts(panel, v);
        this.videoCmtGen(v);
      }
      const rows = cmts.map((c) => `<div class="ph-vcmt ${c.me ? "me" : ""}">
                <i class="ph-vcmt-ava">${this.esc(String(c.name || "?").slice(0, 1))}</i>
                <div><b>${this.esc(c.name)}${c.me ? "（我）" : ""}</b><p>${this.esc(c.text)}</p><small>❤ ${this.vh(c.likes || 0)}</small></div>
            </div>`).join("");
      return `<div class="ph-vcmts">
                <div class="ph-vcmts-head"><b>评论 ${cmts.length}</b>
                    <button onclick="PhoneApps.videoCmtClose()">✕</button></div>
                <div class="ph-vcmts-list">${rows}</div>
                <div class="ph-vcmt-bar">
                    <input id="phVcInput" maxlength="60" placeholder="说点什么…" onkeydown="if(event.key==='Enter')PhoneApps.videoCmtSend()">
                    <button onclick="PhoneApps.videoCmtSend()">发送</button>
                </div>
            </div>`;
    },
    videoCmtClose() {
      var _a;
      this._vCmt = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** AI 生成该视频的评论（一次生成缓存，复看零 token） */
    async videoCmtGen(v) {
      var _a;
      const P = window.PhonePanel;
      try {
        if (!P.isApiReady || !P.isApiReady()) return;
        const raw = await P.callPhoneAPI(this.buildVideoCmtPrompt(P, v));
        const data = P.parseJSON ? P.parseJSON(raw) : null;
        const apps = this.appsState(P);
        const k = this.vkey(v);
        const mine = apps.videoCmts[k] || [];
        const cmts = (data && Array.isArray(data.comments) ? data.comments : []).filter((c) => c && c.name && c.text).slice(0, 10).map((c) => ({
          name: String(c.name).slice(0, 10),
          text: String(c.text).slice(0, 80),
          likes: Math.max(0, Math.round(Number(c.likes) || 5))
        }));
        if (cmts.length >= 3) apps.videoCmts[k] = [...mine.filter((x) => x.me), ...cmts];
        if (this._vCmt) P.render();
        (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
      } catch (e) {
      }
    },
    buildVideoCmtPrompt(panel, v) {
      const sys = [
        "你在为玩家手机短视频App里的一条视频生成评论区。世界是玩家正在经历的故事世界，评论须与之一致。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录】
${panel.contactBrief()}` : "",
        `【视频】@${v.author} 发的：「${v.title}」`,
        "【规则】",
        "1. 生成 6-8 条评论：网友口吻、玩梗自然、有杠精有共情有抖机灵——像真评论区",
        "2. 其中 1-2 条来自通讯录里的熟人（更亲切、像认识的人在评论区偶遇）",
        "3. 时代铁律：用语与梗严格符合时代；拒绝戏剧化，平凡即默认",
        '【输出】只输出 JSON：{"comments":[{"name":"","text":"","likes":12}]}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: `生成「${v.title}」的评论区` }];
    },
    /** 玩家发评论：置顶标记 me，随档保存（text 可直传，DOM 读取为兜底——便于无环境测试） */
    videoCmtSend(text) {
      var _a, _b;
      const P = window.PhonePanel;
      let t = String(text || "").trim();
      if (!t) {
        const el = document.getElementById("phVcInput");
        t = String(el ? el.value || "" : "").trim();
      }
      if (!t) return;
      const list = this.videoList(P);
      const v = list[this._vOpen || 0];
      if (!v) return;
      const apps = this.appsState(P);
      const k = this.vkey(v);
      if (!apps.videoCmts[k]) apps.videoCmts[k] = this.localCmts(P, v);
      apps.videoCmts[k].unshift({ name: P.playerName ? P.playerName() : "我", text: t.slice(0, 60), likes: 0, me: true });
      (_a = window.showToast) == null ? void 0 : _a.call(window, "💬 评论已发出", "success");
      P.render();
      (_b = window.storyFramework) == null ? void 0 : _b.saveStory();
    },
    /* ---------- 分享到聊天（近讯回流闭环） ---------- */
    videoShareOpen() {
      var _a;
      this._vShare = true;
      this._vCmt = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    renderVideoShare(panel, v) {
      const p = panel.state();
      const rows = p.contacts.slice(0, 12).map((c) => `<button class="ph-vshare-row" onclick="PhoneApps.videoShareTo(${JSON.stringify(String(c.name)).replace(/"/g, "&quot;")})">
                    <i class="ph-vcmt-ava">${this.esc(String(c.name).slice(0, 1))}</i>
                    <span>${this.esc(c.name)}<small>${this.esc(c.role || "")}</small></span><b>发送</b>
                </button>`).join("");
      return `<div class="ph-vshare">
                <div class="ph-vcmts-head"><b>分享给…</b><button onclick="PhoneApps.videoShareClose()">✕</button></div>
                ${rows || '<p class="ph-vempty">通讯录还没有人，先去认识几个朋友吧</p>'}
                <p class="ph-vshare-tip">分享会作为视频卡片发进聊天，对方会真的刷到</p>
            </div>`;
    },
    videoShareClose() {
      var _a;
      this._vShare = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 分享落卡：vshare 消息进会话 + 近讯回流主笔 + 分享计数（三重闭环） */
    videoShareTo(name) {
      var _a, _b, _c;
      const P = window.PhonePanel;
      const list = this.videoList(P);
      const v = list[this._vOpen || 0];
      if (!v || !name) return;
      const p = P.state();
      const ch = P.ensureChat ? P.ensureChat(name, !!(P.findChat && ((_a = P.findChat(name)) == null ? void 0 : _a.group))) : null;
      if (!ch) return;
      ch.msgs.push({
        from: P.playerName ? P.playerName() : "我",
        me: true,
        text: String(v.title || "").slice(0, 40),
        kind: "vshare",
        time: P.nowLabel ? P.nowLabel() : ""
      });
      ch.ts = Date.now();
      if (ch.msgs.length > 60) ch.msgs = ch.msgs.slice(-60);
      const apps = this.appsState(P);
      const k = this.vkey(v);
      apps.videoShares[k] = (apps.videoShares[k] || 0) + 1;
      p.pending.push(`📱 玩家给${name}分享了一条短视频「${String(v.title).slice(0, 30)}」（@${v.author}的作品）`);
      if (p.pending.length > 12) p.pending = p.pending.slice(-12);
      this._vShare = false;
      (_b = window.showToast) == null ? void 0 : _b.call(window, `↗️ 已分享给 ${name}`, "success");
      P.render();
      (_c = window.storyFramework) == null ? void 0 : _c.saveStory();
    },
    /* ---------- 作者主页与关注 ---------- */
    videoProfileOpen(name) {
      var _a;
      this._vProfile = String(name || "");
      this._vCmt = false;
      this._vShare = false;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 作者主页：确定性粉丝数 + 作品墙（推荐流内作品 + 本地补齐）+ 关注按钮 */
    renderVideoProfile(panel) {
      const apps = this.appsState(panel);
      const name = this._vProfile;
      const h = panel.hueOf("pf" + name);
      const fans = 120 + h * 997 % 98e3;
      const followed = apps.videoFollows.includes(name);
      const works = apps.videos.filter((v) => String(v.author) === name);
      const show = works.length ? works : this.localVideos(panel).slice(0, 2).map((x) => ({ ...x, author: name }));
      const cards = show.map((v) => {
        const em = this.VEMOJI[panel.hueOf(String(v.title || "x")) % this.VEMOJI.length];
        return `<div class="ph-vcard mini" style="--vh:${panel.hueOf(name) % 360}">
                    <span class="ph-vcard-cover"><i>${em}</i></span>
                    <p>${this.esc(v.title)}</p>
                    <small>▶ ${this.vh(v.views || (v.likes || 100) * 5)}</small>
                </div>`;
      }).join("");
      return `<div class="ph-app ph-vprofile">
                ${this.appHead(panel, "@" + name, "作者主页")}
                <div class="ph-vprofile-hero">
                    <i class="ph-vcmt-ava big">${this.esc(name.slice(0, 1))}</i>
                    <div><b>@${this.esc(name)}</b><span>粉丝 ${this.vh(fans)} · 获赞 ${this.vh(fans * 3 + 7)}</span></div>
                    <button class="${followed ? "on" : ""}" onclick="PhoneApps.videoFollow(${JSON.stringify(name).replace(/"/g, "&quot;")})">${followed ? "已关注" : "＋ 关注"}</button>
                </div>
                <div class="ph-vprofile-works"><b>作品 ${show.length}</b><div class="ph-vfalls">${cards}</div></div>
                <button class="ph-vprofile-back" onclick="PhoneApps.videoProfileClose()">‹ 返回短视频</button>
            </div>`;
    },
    videoProfileClose() {
      var _a;
      this._vProfile = null;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 关注/取关：关注后其作品进「关注」页签 */
    videoFollow(name) {
      var _a, _b, _c;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      const i = apps.videoFollows.indexOf(name);
      if (i >= 0) {
        apps.videoFollows.splice(i, 1);
        (_a = window.showToast) == null ? void 0 : _a.call(window, `已取消关注 @${name}`, "info");
      } else {
        apps.videoFollows.push(name);
        (_b = window.showToast) == null ? void 0 : _b.call(window, `✅ 已关注 @${name}，TA 的更新会出现在「关注」页`, "success");
      }
      P.render();
      (_c = window.storyFramework) == null ? void 0 : _c.saveStory();
    },
    buildVideoPrompt(panel) {
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const city = String(v.location || v.位置 || "这座城市").slice(0, 12);
      const sys = [
        "你在为玩家手机里的「短视频App」生成信息流。世界是玩家正在经历的故事世界，视频内容须与之一致。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录】
${panel.contactBrief()}` : "",
        "【规则】",
        "1. 生成 6 条短视频：平凡生活碎片（美食/宠物/通勤/天气/小确幸/小烦恼），拒绝戏剧化与巧合轰炸",
        "2. author 可以是通讯录里的熟人（更亲切），也可以是陌生博主；title 25 字内、口语化带点网感；music 是 BGM 名；likes 50-9999 整数；views 是播放量（likes 的 2-10 倍）；city 为视频拍摄城市（约一半写「" + city + "」，其余随意）",
        "3. 时代铁律：用语、梗、场景、科技严格符合时代——2016 年前没有短视频App本身，既然它在，就是当下",
        '【输出】只输出 JSON：{"videos":[{"author":"","title":"","music":"","likes":123,"views":456,"city":""}]}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "生成 6 条短视频信息流" }];
    },
    /** 点赞 / 取消赞（v3.22.0：按当前页签列表索引，双击画面同效） */
    videoLike(i) {
      var _a;
      const P = window.PhonePanel;
      const v = this.videoList(P)[i];
      if (!v) return;
      const apps = this.appsState(P);
      const k = this.vkey(v);
      const idx = apps.videoLiked.indexOf(k);
      if (idx >= 0) apps.videoLiked.splice(idx, 1);
      else apps.videoLiked.push(k);
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    async videoRefresh() {
      var _a, _b, _c, _d, _e;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      (_a = P.renderBusy) == null ? void 0 : _a.call(P, true, "正在刷短视频…");
      try {
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildVideoPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const vids = (data && Array.isArray(data.videos) ? data.videos : []).filter((v) => v && v.author && v.title).slice(0, 8).map((v) => ({
            author: String(v.author).slice(0, 12),
            title: String(v.title).slice(0, 40),
            music: String(v.music || "").slice(0, 20),
            likes: Math.max(0, Math.min(99999, Math.round(Number(v.likes) || 100))),
            comments: Math.max(0, Math.round(Number(v.comments) || (Number(v.likes) || 100) / 12)),
            views: Math.max(0, Math.round(Number(v.views) || (Number(v.likes) || 100) * (3 + Math.floor(Math.random() * 7)))),
            city: String(v.city || "").slice(0, 12)
          }));
          if (vids.length >= 3) {
            apps.videos = vids;
            apps.videoLiked = [];
          } else apps.videos = this.localVideos(P, true);
        } else {
          apps.videos = this.localVideos(P, true);
        }
        (_b = window.showToast) == null ? void 0 : _b.call(window, "🎬 刷到一批新视频", "success");
      } catch (e) {
        apps.videos = this.localVideos(P, true);
        (_c = window.showToast) == null ? void 0 : _c.call(window, "🎬 刷新失败，先看缓存视频", "info");
      } finally {
        (_d = P.renderBusy) == null ? void 0 : _d.call(P, false);
        P.render();
        (_e = window.storyFramework) == null ? void 0 : _e.saveStory();
      }
    },
    /* ==================== 📋 论坛（v3.31.0 玉子小剧场之贴吧/天涯 · 2005+） ====================
       板块页签 · 帖子流 · 点开看楼层 · 我也要发一帖（回流主笔近讯）
       · AI 刷新（复用第六接口）+ 本地模板零 token 兜底 —— 全拟真老论坛气质 */
    FTEMPLATES: [
      { title: "深夜睡不着，聊聊你们这座城市最治愈的一个角落", board: "生活" },
      { title: "求助：房东突然要涨租，合同还有八个月，怎么办", board: "职场" },
      { title: "今天在菜市场被一位阿姨上了一课（关于人情世故）", board: "生活" },
      { title: "记录：坚持晨跑第 47 天，身体和心态的变化", board: "生活" },
      { title: "你们工作的第一份工资都花在哪了？我先说", board: "职场" },
      { title: "本地人才知道的老馆子集合，别让好店消失", board: "同城" },
      { title: "被楼下早餐摊的老板记住了口味，有点感动", board: "同城" },
      { title: "成年人的崩溃都是从哪一刻开始的？", board: "生活" },
      { title: "想辞职回老家，有没有过来人说说利弊", board: "职场" },
      { title: "相亲对象聊了三个月，见家长前突然说算了", board: "生活" },
      { title: "这个城市的雨季什么时候是个头啊", board: "同城" },
      { title: "工资到账那一刻，先还了花呗，剩下的沉默了", board: "职场" }
    ],
    FREPLIES: [
      "楼主说得对，我也是这么想的。",
      "蹲一个后续，别太监。",
      "这有啥，我比你惨多了，回头开个帖细说。",
      "人间真实，看哭了。",
      "楼主人间清醒，顶一个。",
      "十年前我要是看到这帖子，能少走多少弯路。",
      "笑死，评论区比帖子精彩。",
      "路过，留个爪印。",
      "什么年代了还有人纠结这个？",
      "同城+1，改天组个局？",
      "楼主加油，日子会好的。",
      "别劝了，劝不住的，都懂的。"
    ],
    fkey(t) {
      return String(t.author || "") + "|" + String(t.title || "");
    },
    /** 本地帖子（零 token 兜底）：联系人当楼主，确定性种子 */
    localThreads(panel) {
      const p = panel.state();
      const names = p.contacts.map((c) => c.name);
      const fw = window.storyFramework;
      const v = fw && fw.storyState && fw.storyState.variables || {};
      const city = String(v.location || v.位置 || "这座城市").slice(0, 12);
      const turn = fw && fw.storyState && fw.storyState.turnCount || 0;
      const seed = this._fSeed = (this._fSeed || 0) + 1 + turn;
      const out = [];
      for (let i = 0; i < 6; i++) {
        const h = panel.hueOf("f" + seed + "_" + i + (names[i % Math.max(1, names.length)] || ""));
        const tp = this.FTEMPLATES[(h + i * 7) % this.FTEMPLATES.length];
        const author = names.length ? names[(h + i * 3) % names.length] : "ID_" + (1e3 + h % 9e3);
        out.push({
          author,
          title: tp.title,
          board: tp.board,
          replies: 3 + h * 17 % 180,
          views: 200 + h * 91 % 9800,
          body: tp.title + "。想听听大家的看法——生活里这些事，说出来就好受多了。",
          floors: Array.from({ length: 4 }, (_, f) => ({
            who: names.length ? names[(h + f) % names.length] : "ID_" + (1e3 + (h * f + 3) % 9e3),
            text: this.FREPLIES[(h + f * 5) % this.FREPLIES.length]
          }))
        });
      }
      return out;
    },
    /** 当前页签的帖子列表 */
    threadList(panel) {
      const apps = this.appsState(panel);
      let list = apps.forumThreads;
      const tab = apps.forumTab;
      if (tab === "local") {
        const l = list.filter((t) => String(t.board || "").includes("同城"));
        if (l.length) list = l;
      } else if (tab === "life" || tab === "work") {
        const kw = tab === "life" ? "生活" : "职场";
        const l = list.filter((t) => String(t.board || "").includes(kw));
        if (l.length) list = l;
      }
      return list;
    },
    renderForum(panel) {
      const apps = this.appsState(panel);
      if (!apps.forumThreads.length) apps.forumThreads = this.localThreads(panel);
      if (this._fOpen != null) return this.renderThreadFloors(panel);
      const tabs = [["hot", "热点"], ["local", "同城"], ["life", "生活"], ["work", "职场"]];
      const list = this.threadList(panel);
      const cards = list.map((t, i) => {
        const hue = panel.hueOf(String(t.author || "x")) % 360;
        const liked = apps.forumLiked.includes(this.fkey(t));
        return `<button class="ph-fcard" style="--fh:${hue}" onclick="PhoneApps.forumOpen(${i})">
                    <div class="ph-fcard-board">${this.esc(t.board || "综合")}</div>
                    <p class="ph-fcard-title">${this.esc(t.title)}</p>
                    <small><b>${this.esc(t.author)}</b> · 回复 ${this.vh(t.replies)} · 浏览 ${this.vh(t.views)}${liked ? " · ❤" : ""}</small>
                </button>`;
      }).join("") || '<div class="ph-vempty">这个板块暂时没有帖子，先去热点逛逛</div>';
      return `<div class="ph-app ph-app-forum">
                ${this.appHead(panel, "论坛", "本地人的帖子 · 点开看楼层")}
                <div class="ph-vtabs">${tabs.map((t) => `<button class="${apps.forumTab === t[0] ? "on" : ""}" onclick="PhoneApps.forumTab('${t[0]}')">${t[1]}</button>`).join("")}
                </div>
                <div class="ph-flist">${cards}</div>
                <div class="ph-ffoot">
                    <button class="ph-fnew" onclick="PhoneApps.forumNewPost()">✎ 发一帖</button>
                    <button class="ph-frefresh" onclick="PhoneApps.forumRefresh()" title="换一批">↻</button>
                </div>
            </div>`;
    },
    forumTab(t) {
      const P = window.PhonePanel;
      this.appsState(P).forumTab = t;
      this._fOpen = null;
      P.render();
    },
    forumOpen(i) {
      var _a;
      this._fOpen = i;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    forumClose() {
      var _a;
      this._fOpen = null;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 楼层视图：LZ 正文 + 逐楼跟帖 */
    renderThreadFloors(panel) {
      const list = this.threadList(panel);
      const i = Math.min(this._fOpen || 0, list.length - 1);
      const t = list[i];
      if (!t) {
        this._fOpen = null;
        return this.renderForum(panel);
      }
      const apps = this.appsState(panel);
      const liked = apps.forumLiked.includes(this.fkey(t));
      const floors = (t.floors || []).map((f, fi) => `<div class="ph-floor">
                    <b>${fi + 2}楼 · ${this.esc(f.who)}</b>
                    <p>${this.esc(f.text)}</p>
                </div>`).join("");
      return `<div class="ph-app ph-app-thread">
                ${this.appHead(panel, "帖子", t.board || "")}
                <div class="ph-op">
                    <b>楼主 · ${this.esc(t.author)}</b>
                    <p class="ph-op-title">${this.esc(t.title)}</p>
                    <p class="ph-op-body">${this.esc(t.body || t.title)}</p>
                </div>
                <div class="ph-floors">${floors || '<div class="ph-vempty">还没有人跟帖，抢沙发</div>'}</div>
                <div class="ph-ffoot">
                    <button class="ph-fnew ${liked ? "on" : ""}" onclick="PhoneApps.forumLike()">${liked ? "❤ 已赞" : "♡ 赞帖子"}</button>
                    <button class="ph-fnew" onclick="PhoneApps.forumReply()">💬 跟一帖</button>
                    <button class="ph-frefresh" onclick="PhoneApps.forumClose()">‹ 返回列表</button>
                </div>
            </div>`;
    },
    forumLike() {
      var _a;
      const P = window.PhonePanel;
      const t = this.threadList(P)[this._fOpen || 0];
      if (!t) return;
      const apps = this.appsState(P);
      const k = this.fkey(t);
      const idx = apps.forumLiked.indexOf(k);
      if (idx >= 0) apps.forumLiked.splice(idx, 1);
      else apps.forumLiked.push(k);
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    /** 跟帖：弹输入 → 落到楼层 + 回流主笔（AI 下轮知道你跟了帖） */
    async forumReply() {
      var _a, _b, _c, _d;
      const P = window.PhonePanel;
      const t = this.threadList(P)[this._fOpen || 0];
      if (!t) return;
      const said = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _b.call(_a, {
        title: "💬 跟帖",
        message: `在「${String(t.title).slice(0, 24)}」下说什么？（楼主与跟帖人会看到）`
      }));
      if (!said || !String(said).trim()) return;
      const txt = String(said).trim().slice(0, 80);
      t.floors = t.floors || [];
      t.floors.push({ who: P.playerName(), text: txt });
      const p = P.state();
      p.pending.push(`📱 玩家在论坛「${String(t.title).slice(0, 30)}」跟帖（「${txt.slice(0, 30)}」）`);
      P.render();
      (_c = window.showToast) == null ? void 0 : _c.call(window, "📋 跟帖已发，等楼主和楼层里的人回你", "success");
      (_d = window.storyFramework) == null ? void 0 : _d.saveStory();
    },
    /** 我也要发一帖：落帖 + 回流 */
    async forumNewPost() {
      var _a, _b, _c, _d;
      const P = window.PhonePanel;
      const said = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _b.call(_a, {
        title: "✎ 发一帖",
        message: "帖子标题？（本地论坛的人会来跟帖，AI 也会让世界回应你）"
      }));
      if (!said || !String(said).trim()) return;
      const title = String(said).trim().slice(0, 40);
      const apps = this.appsState(P);
      apps.forumThreads.unshift({
        author: P.playerName(),
        title,
        board: "生活",
        replies: 0,
        views: 12,
        body: title,
        floors: []
      });
      const p = P.state();
      p.pending.push(`📱 玩家在本地论坛发了新帖「${title}」（等世界回应）`);
      P.render();
      (_c = window.showToast) == null ? void 0 : _c.call(window, "📋 帖子已发出去，看看有没有人回", "success");
      (_d = window.storyFramework) == null ? void 0 : _d.saveStory();
    },
    buildForumPrompt(panel) {
      const sys = [
        "你在为玩家手机里的「论坛App」生成帖子列表。世界是玩家正在经历的故事世界，帖子须与之一致。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录】
${panel.contactBrief()}` : "",
        "【规则】",
        "1. 生成 6 个帖子：本地人的真实烦恼与闲谈（房租/通勤/婚恋/职场/家长里短/城市吐槽），拒绝戏剧化",
        "2. author 可用通讯录熟人或网名（形如 ID_9527）；title 30 字内口语化；board ∈ 热点/同城/生活/职场；replies 3-200；views 200-9999",
        "3. body 是楼主正文（80 字内）；floors 是 3-5 条跟帖（who+text，跟帖要有跟帖味：抬杠/安慰/跑题/接梗）",
        "4. 时代铁律：用语、梗、关注点严格符合时代（2005 天涯贴吧味，2024 贴吧味不变）",
        '【输出】只输出 JSON：{"threads":[{"author":"","title":"","board":"","replies":12,"views":345,"body":"","floors":[{"who":"","text":""}]}]}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "生成 6 个论坛帖子" }];
    },
    async forumRefresh() {
      var _a, _b, _c, _d, _e;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      (_a = P.renderBusy) == null ? void 0 : _a.call(P, true, "正在刷新论坛…");
      try {
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildForumPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const ts = (data && Array.isArray(data.threads) ? data.threads : []).filter((t) => t && t.author && t.title).slice(0, 8).map((t) => ({
            author: String(t.author).slice(0, 14),
            title: String(t.title).slice(0, 46),
            board: String(t.board || "综合").slice(0, 6),
            replies: Math.max(0, Math.min(9999, Math.round(Number(t.replies) || 10))),
            views: Math.max(0, Math.round(Number(t.views) || 500)),
            body: String(t.body || t.title).slice(0, 120),
            floors: (Array.isArray(t.floors) ? t.floors : []).slice(0, 6).map((f) => ({
              who: String(f && f.who || "路人").slice(0, 14),
              text: String(f && f.text || "").slice(0, 80)
            })).filter((f) => f.text)
          }));
          if (ts.length >= 3) {
            apps.forumThreads = ts;
            apps.forumLiked = [];
          } else apps.forumThreads = this.localThreads(P);
        } else {
          apps.forumThreads = this.localThreads(P);
        }
        this._fOpen = null;
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📋 刷新出一批新帖子", "success");
      } catch (e) {
        apps.forumThreads = this.localThreads(P);
        (_c = window.showToast) == null ? void 0 : _c.call(window, "📋 刷新失败，先看缓存帖子", "info");
      } finally {
        (_d = P.renderBusy) == null ? void 0 : _d.call(P, false);
        P.render();
        (_e = window.storyFramework) == null ? void 0 : _e.saveStory();
      }
    },
    /* ==================== 📺 直播（v3.31.0 玉子小剧场之直播 · 2016+） ====================
       直播间列表 · 点进看直播（弹幕自动滚动 · 礼物横幅 · 关注主播）
       · 发弹幕回流主笔近讯 · AI 刷新 + 本地模板兜底 */
    LTITLETEMPLATES: [
      "深夜聊天局，今天说说你们的心事",
      "弹唱点歌，会的都唱",
      "做饭直播，今天炖排骨",
      "陪你自习到十二点",
      "刚下班，随便聊聊",
      "游戏双排上分，稳住别浪",
      "户外：夜市逛吃逛吃",
      "唱歌，跑调也唱",
      "聊天局：你最近还好吗",
      "手工刺绣，慢慢做不着急",
      "减肥打卡第 30 天",
      "猫咪出镜，主人背景板"
    ],
    LCATS: ["聊天", "音乐", "美食", "游戏", "户外", "陪伴"],
    LDANMAKU: [
      "主播今天状态不错啊",
      "来了来了",
      "前排",
      "沙发！",
      "这歌单可以",
      "主播吃饭了没",
      "哈哈哈哈哈",
      "刚下夜班赶上了",
      "礼物走一个",
      "宝宝们把关注点一点",
      "这背景音乐叫什么",
      "蹲一个点歌",
      "主播声音好听",
      "路过留个爪",
      "连麦吗主播",
      "今天人好多",
      "上班摸鱼看直播",
      "支持下",
      "主播注意嗓子",
      "又见面了老位置"
    ],
    LGIFTS: ["小心心", "棒棒糖", "星星", "火箭", "跑车", "比心"],
    lkey(r) {
      return String(r.anchor || "") + "|" + String(r.title || "");
    },
    /** 本地直播间（零 token 兜底） */
    localRooms(panel) {
      var _a, _b;
      const p = panel.state();
      const names = p.contacts.map((c) => c.name);
      const turn = ((_b = (_a = window.storyFramework) == null ? void 0 : _a.storyState) == null ? void 0 : _b.turnCount) || 0;
      const seed = this._lSeed = (this._lSeed || 0) + 1 + turn;
      const out = [];
      for (let i = 0; i < 6; i++) {
        const h = panel.hueOf("l" + seed + "_" + i + (names[i % Math.max(1, names.length)] || ""));
        out.push({
          anchor: names.length ? names[(h + i * 3) % names.length] : "主播_" + (100 + h % 900),
          title: this.LTITLETEMPLATES[(h + i * 5) % this.LTITLETEMPLATES.length],
          cat: this.LCATS[h % this.LCATS.length],
          hot: 300 + h * 137 % 97e3,
          watching: 30 + h * 29 % 4200
        });
      }
      return out;
    },
    renderLive(panel) {
      const apps = this.appsState(panel);
      if (!apps.liveRooms.length) apps.liveRooms = this.localRooms(panel);
      if (this._lOpen != null) return this.renderLiveRoom(panel);
      const cards = apps.liveRooms.map((r, i) => {
        const hue = panel.hueOf(String(r.anchor || "x")) % 360;
        const em = this.VEMOJI[hue % this.VEMOJI.length];
        const followed = apps.liveFollows.includes(String(r.anchor));
        return `<button class="ph-lcard" style="--lh:${hue}" onclick="PhoneApps.liveOpen(${i})">
                    <span class="ph-lcard-cover"><i>${em}</i><em class="ph-lcard-live">LIVE</em></span>
                    <div class="ph-lcard-info">
                        <p>${this.esc(r.title)}</p>
                        <small><b>@${this.esc(r.anchor)}</b> · ${this.esc(r.cat || "聊天")}${followed ? " · ❤已关注" : ""}</small>
                        <small>🔥 ${this.vh(r.hot)} · 👀 ${this.vh(r.watching)}</small>
                    </div>
                </button>`;
      }).join("") || '<div class="ph-vempty">暂时没有开播的房间</div>';
      return `<div class="ph-app ph-app-live">
                ${this.appHead(panel, "直播", "正在开播 · 点进看")}
                <div class="ph-llist">${cards}</div>
                <button class="ph-vrefresh" onclick="PhoneApps.liveRefresh()" title="换一批">↻</button>
            </div>`;
    },
    liveOpen(i) {
      var _a;
      this._lOpen = i;
      this._lDan = [];
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
      this.startDanmaku();
    },
    liveClose() {
      var _a;
      this.stopDanmaku();
      this._lOpen = null;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /** 弹幕滚动：本地弹幕池定时追加（DOM 局部更新，不整机重绘防闪） */
    startDanmaku() {
      this.stopDanmaku();
      this._lTimer = setInterval(() => {
        const box = document.getElementById("phDanmaku");
        if (!box || this._lOpen == null) {
          this.stopDanmaku();
          return;
        }
        const p = window.PhonePanel.state();
        const names = p.contacts.map((c) => c.name);
        const who = names.length ? names[Math.floor(Math.random() * names.length)] : "路人" + Math.floor(Math.random() * 90 + 10);
        const txt = this.LDANMAKU[Math.floor(Math.random() * this.LDANMAKU.length)];
        const el = document.createElement("div");
        el.className = "ph-dm";
        el.textContent = `${who}：${txt}`;
        box.appendChild(el);
        while (box.children.length > 14) box.removeChild(box.firstChild);
        box.scrollTop = box.scrollHeight;
        if (Math.random() < 0.12) {
          const g = this.LGIFTS[Math.floor(Math.random() * this.LGIFTS.length)];
          const from = names.length ? names[Math.floor(Math.random() * names.length)] : "路人";
          const bar = document.createElement("div");
          bar.className = "ph-dm-gift";
          bar.textContent = `🎁 ${from} 送出 ${g}`;
          box.appendChild(bar);
        }
      }, 1800);
    },
    stopDanmaku() {
      clearInterval(this._lTimer);
      this._lTimer = null;
    },
    /** 直播间：画面区 + 弹幕流 + 操作栏 */
    renderLiveRoom(panel) {
      const apps = this.appsState(panel);
      const list = apps.liveRooms;
      const i = Math.min(this._lOpen || 0, list.length - 1);
      const r = list[i];
      if (!r) {
        this._lOpen = null;
        return this.renderLive(panel);
      }
      const hue = panel.hueOf(String(r.anchor || "x")) % 360;
      const em = this.VEMOJI[hue % this.VEMOJI.length];
      const followed = apps.liveFollows.includes(String(r.anchor));
      requestAnimationFrame(() => {
        if (this._lOpen != null) this.startDanmaku();
      });
      return `<div class="ph-app ph-app-liveroom">
                <div class="ph-lroom" style="--lh:${hue}">
                    <div class="ph-lroom-top">
                        <button onclick="PhoneApps.liveClose()" title="返回列表">‹</button>
                        <span>🔴 ${this.esc(r.title)}</span>
                        <i>👀 ${this.vh(r.watching)}</i>
                    </div>
                    <div class="ph-lroom-screen"><span class="ph-lroom-em">${em}</span></div>
                    <div class="ph-lroom-info">
                        <b>@${this.esc(r.anchor)}</b>
                        <span>· ${this.esc(r.cat || "聊天")} · 🔥 ${this.vh(r.hot)}</span>
                    </div>
                    <div class="ph-danmaku" id="phDanmaku"></div>
                    <div class="ph-lroom-foot">
                        <button class="ph-dm-send" onclick="PhoneApps.liveDanmaku()">💬 发弹幕</button>
                        <button class="ph-dm-send ${followed ? "on" : ""}" onclick="PhoneApps.liveFollow()">${followed ? "❤ 已关注" : "＋ 关注"}</button>
                        <button class="ph-dm-send" onclick="PhoneApps.liveGift()">🎁 送礼物</button>
                    </div>
                </div>
            </div>`;
    },
    /** 发弹幕：本地追加 + 回流主笔 */
    async liveDanmaku() {
      var _a, _b, _c, _d;
      const P = window.PhonePanel;
      const r = this.appsState(P).liveRooms[this._lOpen || 0];
      if (!r) return;
      const said = await ((_b = (_a = window.UIDialog) == null ? void 0 : _a.prompt) == null ? void 0 : _b.call(_a, {
        title: "💬 发弹幕",
        message: `在「${String(r.anchor).slice(0, 12)}」的直播间说什么？（主播和其他观众会看到）`
      }));
      if (!said || !String(said).trim()) return;
      const txt = String(said).trim().slice(0, 40);
      const box = document.getElementById("phDanmaku");
      if (box) {
        const el = document.createElement("div");
        el.className = "ph-dm me";
        el.textContent = `${P.playerName()}：${txt}`;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
      }
      const p = P.state();
      p.pending.push(`📱 玩家在「${String(r.anchor).slice(0, 12)}」的直播间发了弹幕（「${txt.slice(0, 24)}」）`);
      (_c = window.showToast) == null ? void 0 : _c.call(window, "📺 弹幕已飞出去", "success");
      (_d = window.storyFramework) == null ? void 0 : _d.saveStory();
    },
    liveFollow() {
      var _a;
      const P = window.PhonePanel;
      const r = this.appsState(P).liveRooms[this._lOpen || 0];
      if (!r) return;
      const apps = this.appsState(P);
      const name = String(r.anchor);
      const idx = apps.liveFollows.indexOf(name);
      if (idx >= 0) apps.liveFollows.splice(idx, 1);
      else apps.liveFollows.push(name);
      P.render();
      this.startDanmaku();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    /** 送礼物：落横幅 + 回流（钱要记账——地球模块的钱不是数字） */
    async liveGift() {
      var _a, _b;
      const P = window.PhonePanel;
      const r = this.appsState(P).liveRooms[this._lOpen || 0];
      if (!r) return;
      const g = this.LGIFTS[Math.floor(Math.random() * this.LGIFTS.length)];
      const box = document.getElementById("phDanmaku");
      if (box) {
        const bar = document.createElement("div");
        bar.className = "ph-dm-gift me";
        bar.textContent = `🎁 ${P.playerName()} 送出 ${g}`;
        box.appendChild(bar);
        box.scrollTop = box.scrollHeight;
      }
      const p = P.state();
      p.pending.push(`📱 玩家在「${String(r.anchor).slice(0, 12)}」的直播间送了${g}（钱花出去了）`);
      (_a = window.showToast) == null ? void 0 : _a.call(window, "🎁 礼物已送出", "success");
      (_b = window.storyFramework) == null ? void 0 : _b.saveStory();
    },
    buildLivePrompt(panel) {
      const sys = [
        "你在为玩家手机里的「直播App」生成直播间列表。世界是玩家正在经历的故事世界。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录】
${panel.contactBrief()}` : "",
        "【规则】",
        "1. 生成 6 个直播间：小主播的真实日常（聊天/唱歌/做饭/游戏/陪伴），不是顶流大场",
        "2. anchor 可用通讯录熟人或普通网名；title 18 字内口语化；cat ∈ 聊天/音乐/美食/游戏/户外/陪伴；hot 300-99999；watching 30-4999",
        "3. 时代铁律：2016+ 才有直播；用语、礼物名、玩法符合时代",
        '【输出】只输出 JSON：{"rooms":[{"anchor":"","title":"","cat":"","hot":1234,"watching":456}]}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "生成 6 个直播间" }];
    },
    async liveRefresh() {
      var _a, _b, _c, _d, _e;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      (_a = P.renderBusy) == null ? void 0 : _a.call(P, true, "正在刷新直播间…");
      try {
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildLivePrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const rs = (data && Array.isArray(data.rooms) ? data.rooms : []).filter((r) => r && r.anchor && r.title).slice(0, 8).map((r) => ({
            anchor: String(r.anchor).slice(0, 14),
            title: String(r.title).slice(0, 24),
            cat: String(r.cat || "聊天").slice(0, 6),
            hot: Math.max(0, Math.min(999999, Math.round(Number(r.hot) || 1e3))),
            watching: Math.max(0, Math.min(99999, Math.round(Number(r.watching) || 200)))
          }));
          if (rs.length >= 3) apps.liveRooms = rs;
          else apps.liveRooms = this.localRooms(P);
        } else {
          apps.liveRooms = this.localRooms(P);
        }
        this._lOpen = null;
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📺 刷新出一批直播间", "success");
      } catch (e) {
        apps.liveRooms = this.localRooms(P);
        (_c = window.showToast) == null ? void 0 : _c.call(window, "📺 刷新失败，先看缓存房间", "info");
      } finally {
        (_d = P.renderBusy) == null ? void 0 : _d.call(P, false);
        P.render();
        (_e = window.storyFramework) == null ? void 0 : _e.saveStory();
      }
    },
    /* ==================== ⚙️ 设置（v3.31.0 外观定制：壁纸/字号 · 玉子式外观能力） ==================== */
    WALLS: [
      { id: "default", name: "默认", desc: "时代原味" },
      { id: "aurora", name: "极光", desc: "青绿流光" },
      { id: "dusk", name: "暮色", desc: "暖橙晚霞" },
      { id: "mint", name: "薄荷", desc: "清浅凉意" },
      { id: "ink", name: "水墨", desc: "灰白留白" },
      { id: "night", name: "深空", desc: "夜里看手机" }
    ],
    renderSettings(panel) {
      const a = this.appearance();
      const wallBtns = this.WALLS.map((w) => `<button class="ph-set-btn ${a.wall === w.id ? "on" : ""}" onclick="PhoneApps.setWall('${w.id}')">
                    <i class="ph-set-swatch" data-w="${w.id}"></i><b>${this.esc(w.name)}</b><small>${this.esc(w.desc)}</small>
                </button>`).join("");
      const fontBtns = [["s", "小"], ["m", "标准"], ["l", "大"]].map(([id, name]) => `<button class="ph-set-btn slim ${a.font === id ? "on" : ""}" onclick="PhoneApps.setFont('${id}')">${name}</button>`).join("");
      return `<div class="ph-app ph-app-settings">
                ${this.appHead(panel, "设置", "手机外观")}
                <div class="ph-set-group">
                    <p class="ph-set-title">🖼 壁纸（锁屏与桌面）</p>
                    <div class="ph-set-grid">${wallBtns}</div>
                </div>
                <div class="ph-set-group">
                    <p class="ph-set-title">🔢 字号（聊天与 App 内容）</p>
                    <div class="ph-set-row">${fontBtns}</div>
                </div>
                <div class="ph-set-group">
                    <p class="ph-set-title">📱 容器</p>
                    <p class="ph-set-hint">按住顶部状态栏可拖动手机位置；<b>⤢</b> 钮切换紧凑/标准/宽屏三档大小——位置与尺寸都会记住。</p>
                </div>
            </div>`;
    },
    setWall(id) {
      var _a;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      apps.appearance = apps.appearance || {};
      apps.appearance.wall = id;
      this.applyAppearance();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    setFont(id) {
      var _a;
      const P = window.PhonePanel;
      const apps = this.appsState(P);
      apps.appearance = apps.appearance || {};
      apps.appearance.font = id;
      this.applyAppearance();
      P.render();
      (_a = window.storyFramework) == null ? void 0 : _a.saveStory();
    },
    /* ==================== 📷 相册（正文插图即相机胶卷） ==================== */
    renderAlbum(panel) {
      const s = window.storyFramework && window.storyFramework.storyState || {};
      const list = (Array.isArray(s.illustrations) ? s.illustrations : []).filter((x) => x && x.url).slice(-24).reverse();
      if (!list.length) {
        return `<div class="ph-app">
                    ${this.appHead(panel, "相册", "相机胶卷")}
                    <div class="ph-empty"><b>🖼️</b><p>还没有照片</p><small>正文生成插图后，会像相机胶卷一样存进这里——那是你亲历过的画面</small></div>
                </div>`;
      }
      const idx = this._photoIdx;
      const cells = list.map((x, i) => `<button class="ph-photo" onclick="PhoneApps.photoView(${i})">
                    <img src="${this.esc(x.url)}" loading="lazy" alt="插图" onerror="this.parentNode.classList.add('broken')">
                    <span>第 ${x.turn != null ? x.turn : "?"} 轮</span>
                </button>`).join("");
      let viewer = "";
      if (idx != null && list[idx]) {
        const x = list[idx];
        viewer = `<div class="ph-photo-viewer" onclick="PhoneApps.photoClose()">
                    <img src="${this.esc(x.url)}" alt="照片" onerror="this.style.display='none'">
                    <div class="ph-photo-cap">${this.esc(String(x.prompt || "").slice(0, 60))}</div>
                    <button class="ph-photo-close">✕</button>
                </div>`;
      }
      return `<div class="ph-app">
                ${this.appHead(panel, "相册", `相机胶卷 · ${list.length} 张`)}
                <div class="ph-photo-grid">${cells}</div>
                ${viewer}
            </div>`;
    },
    photoView(i) {
      var _a;
      this._photoIdx = i;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    photoClose() {
      var _a;
      this._photoIdx = null;
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    /* ==================== 🌤 天气（确定性推演 · 零 token） ==================== */
    WTABLE: {
      spring: [["多云", "⛅", 18], ["小雨", "🌧️", 16], ["晴", "☀️", 22], ["阴", "☁️", 17]],
      summer: [["晴", "☀️", 33], ["雷阵雨", "⛈️", 28], ["多云", "⛅", 30], ["晴热", "🔥", 36]],
      autumn: [["晴", "☀️", 24], ["多云", "⛅", 21], ["小雨", "🌧️", 18], ["雾", "🌫️", 17]],
      winter: [["晴", "☀️", 6], ["小雪", "🌨️", -2], ["阴", "☁️", 3], ["大风", "💨", 1]]
    },
    seasonOf(month) {
      if (month >= 3 && month <= 5) return "spring";
      if (month >= 6 && month <= 8) return "summer";
      if (month >= 9 && month <= 11) return "autumn";
      return "winter";
    },
    /** 同日同城 → 同天气（确定性哈希，不靠接口） */
    weatherOf(panel) {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const city = String(v.location || v.位置 || "这座城市").slice(0, 12);
      const dstr = String(v.date || v.日期 || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).slice(0, 16);
      const mISO = dstr.match(/\d{4}[年/-](\d{1,2})/);
      const mCN = dstr.match(/(\d{1,2})月/);
      const month = mISO ? Number(mISO[1]) : mCN ? Number(mCN[1]) : (/* @__PURE__ */ new Date()).getMonth() + 1;
      const season = this.seasonOf(month);
      const h = panel.hueOf(dstr + "@" + city);
      const row = this.WTABLE[season][h % 4];
      return {
        city,
        dstr,
        month,
        season,
        cond: row[0],
        icon: row[1],
        temp: row[2] + h % 5 - 2
      };
    },
    renderWeather(panel) {
      const w = this.weatherOf(panel);
      const SEASON = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
      const fc = [1, 2, 3].map((i) => {
        const h = panel.hueOf(w.dstr + "@" + w.city + "#" + i);
        const r = this.WTABLE[w.season][h % 4];
        return { icon: r[1], cond: r[0], hi: r[2] + h % 4 - 1, lo: r[2] - 6 + h % 3 };
      });
      const idx = [];
      if (/雨/.test(w.cond)) idx.push(["☂️ 带伞", "有降水，出门包里塞把伞"]);
      else idx.push(["🧴 防晒", /晴|热/.test(w.cond) ? "紫外线不弱，防晒安排上" : "紫外线弱，无需特别防护"]);
      idx.push(["👔 穿衣", w.temp >= 26 ? "短袖短裤，怎么凉快怎么来" : w.temp >= 15 ? "长袖薄外套刚刚好" : w.temp >= 5 ? "外套或薄羽绒，护住脚踝" : "厚羽绒全副武装，帽子围巾都戴上"]);
      idx.push(["🚗 洗车", /雨|雪|雾/.test(w.cond) ? "近两天有降水，先忍忍" : "天气不错，想洗就洗"]);
      return `<div class="ph-app ph-app-weather">
                ${this.appHead(panel, "天气", w.dstr)}
                <div class="ph-w-hero">
                    <div class="ph-w-main">
                        <span class="ph-w-icon">${w.icon}</span>
                        <div><b class="ph-w-temp">${w.temp}°</b><span class="ph-w-cond">${this.esc(w.cond)} · ${SEASON[w.season]}</span></div>
                    </div>
                    <div class="ph-w-city">${this.esc(w.city)}</div>
                </div>
                <div class="ph-w-fc">${fc.map((f) => `<div class="ph-w-day"><span>${f.icon}</span><b>${f.hi}°</b><i>${f.lo}°</i><label>${this.esc(f.cond)}</label></div>`).join("")}</div>
                <div class="ph-w-idx">${idx.map((x) => `<div class="ph-w-item"><b>${this.esc(x[0])}</b><span>${this.esc(x[1])}</span></div>`).join("")}</div>
            </div>`;
    },
    /* ==================== 🧮 计算器 ==================== */
    renderCalc(panel) {
      const c = this.appsState(panel).calc;
      const KEYS = [
        ["C", "⌫", "%", "÷"],
        ["7", "8", "9", "×"],
        ["4", "5", "6", "−"],
        ["1", "2", "3", "+"],
        ["0", ".", "="]
      ];
      const pad = KEYS.map((row) => `<div class="ph-calc-row">${row.map((k) => `<button class="ph-calc-key ${/^[0-9.]$/.test(k) ? "num" : k === "=" ? "eq" : "op"} ${k === "0" ? "wide" : ""}" onclick="PhoneApps.calcPress('${k}')">${k}</button>`).join("")}</div>`).join("");
      return `<div class="ph-app ph-app-calc">
                ${this.appHead(panel, "计算器", "面板全功能")}
                <div class="ph-calc-display">
                    <i>${this.esc(c.last)}</i>
                    <b>${this.esc(c.expr) || "0"}</b>
                </div>
                <div class="ph-calc-pad">${pad}</div>
            </div>`;
    },
    calcPress(key) {
      const P = window.PhonePanel;
      const c = this.appsState(P).calc;
      if (key === "C") {
        c.expr = "";
        c.last = "";
      } else if (key === "⌫") {
        c.expr = String(c.expr).slice(0, -1);
      } else if (key === "=") {
        const r = this.calcEval(c.expr);
        c.last = c.expr;
        c.expr = r === null ? "错误" : String(r);
      } else {
        if (String(c.expr).length < 24 && c.expr !== "错误") c.expr = String(c.expr) + key;
        else if (c.expr === "错误") {
          c.expr = /^[0-9.]$/.test(key) ? key : "";
        }
      }
      P.render();
    },
    /** 安全求值：白名单字符集前置校验 + MoUtils.safeEval 调度场算法（去除 Function() 动态执行，兼容 CSP，绝不执行任意代码） */
    calcEval(expr) {
      const s = String(expr || "").replace(/[×✕]/g, "*").replace(/[÷]/g, "/").replace(/[−–]/g, "-").replace(/，/g, "");
      if (!s || !/^[0-9+\-*/.()%\s]+$/.test(s)) return null;
      const r = MoUtils.safeEval(s);
      return r === null ? null : Math.round(r * 1e8) / 1e8;
    },
    /* ==================== ⏰ 时钟（表盘 + 秒表） ==================== */
    renderClock(panel) {
      const tp = this.timeParts(panel);
      const now = /* @__PURE__ */ new Date();
      const degH = (tp.h % 12 + tp.m / 60) * 30;
      const degM = tp.m * 6;
      const degS = now.getSeconds() * 6;
      const hh = String(tp.h).padStart(2, "0"), mm = String(tp.m).padStart(2, "0");
      const sw = this._sw || (this._sw = { running: false, base: 0, elapsed: 0 });
      return `<div class="ph-app ph-app-clock">
                ${this.appHead(panel, "时钟", this.dateLabel(panel))}
                <div class="ph-clock-face">
                    <svg viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="56" class="ph-ck-ring"/>
                        ${Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 * Math.PI / 180;
        const x1 = 60 + Math.sin(a) * 47, y1 = 60 - Math.cos(a) * 47;
        const x2 = 60 + Math.sin(a) * 52, y2 = 60 - Math.cos(a) * 52;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="ph-ck-tick"/>`;
      }).join("")}
                        <line id="phCkH" x1="60" y1="60" x2="60" y2="34" class="ph-ck-h" transform="rotate(${degH.toFixed(1)} 60 60)"/>
                        <line id="phCkM" x1="60" y1="60" x2="60" y2="22" class="ph-ck-m" transform="rotate(${degM.toFixed(1)} 60 60)"/>
                        <line id="phCkS" x1="60" y1="66" x2="60" y2="16" class="ph-ck-s" transform="rotate(${degS.toFixed(1)} 60 60)"/>
                        <circle cx="60" cy="60" r="3" class="ph-ck-pin"/>
                    </svg>
                    <div class="ph-clock-digital" id="phCkDigi">${hh}:${mm}</div>
                </div>
                <div class="ph-sw">
                    <b class="ph-sw-display" id="phSwDisp">${this.swFmt(sw.elapsed)}</b>
                    <div class="ph-sw-btns">
                        <button onclick="PhoneApps.swToggle()">${sw.running ? "⏸ 暂停" : "▶ 开始"}</button>
                        <button onclick="PhoneApps.swReset()">↺ 重置</button>
                    </div>
                </div>
            </div>`;
    },
    swFmt(ms) {
      const t = Math.max(0, ms);
      const m = Math.floor(t / 6e4), s = Math.floor(t / 1e3) % 60, cs = Math.floor(t / 10) % 100;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    },
    swToggle() {
      var _a;
      const sw = this._sw || (this._sw = { running: false, base: 0, elapsed: 0 });
      if (sw.running) {
        sw.elapsed += Date.now() - sw.base;
        sw.running = false;
      } else {
        sw.base = Date.now();
        sw.running = true;
      }
      this.swTick();
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    swReset() {
      var _a;
      this._sw = { running: false, base: 0, elapsed: 0 };
      clearInterval(this._swTimer);
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    swTick() {
      if (typeof document === "undefined") return;
      clearInterval(this._swTimer);
      this._swTimer = setInterval(() => {
        const P = window.PhonePanel;
        if (!P || !P.view || P.view.app !== "clock") return;
        const sw = this._sw;
        if (!sw || !sw.running) return;
        const el = document.getElementById("phSwDisp");
        if (el) el.textContent = this.swFmt(sw.elapsed + (Date.now() - sw.base));
      }, 50);
    },
    /* ==================== 🐍 贪吃蛇（诺基亚之魂） ==================== */
    SG: 13,
    // 网格 13×13
    snakeInit() {
      this._snake = {
        body: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
        dir: { x: 1, y: 0 },
        pendingDir: { x: 1, y: 0 },
        food: { x: 9, y: 6 },
        score: 0,
        alive: false,
        running: false,
        speed: 240
      };
      return this._snake;
    },
    snakeState() {
      return this._snake || this.snakeInit();
    },
    renderSnake(panel) {
      const apps = this.appsState(panel);
      const s = this.snakeState();
      const best = apps.snakeBest || 0;
      return `<div class="ph-app ph-app-snake">
                ${this.appHead(panel, "贪吃蛇", "诺基亚之魂 · 方向键/滑动")}
                <div class="ph-snake-top">
                    <span>本局 <b id="phSkScore">${s.score}</b> 分</span>
                    <span>最佳 <b>${best}</b> 分</span>
                </div>
                <div class="ph-snake-wrap">
                    <canvas id="phSnakeCv" width="234" height="234"></canvas>
                    ${!s.alive ? `<div class="ph-snake-over"><b>🐍 贪吃蛇</b><p>${s.score > 0 ? `本局 ${s.score} 分` : "经典永不过时"}</p><button onclick="PhoneApps.snakeStart()">开始游戏</button></div>` : ""}
                </div>
                <div class="ph-snake-pad">
                    <button onclick="PhoneApps.snakeDir('up')">▲</button>
                    <div>
                        <button onclick="PhoneApps.snakeDir('left')">◀</button>
                        <button onclick="PhoneApps.snakeDir('down')">▼</button>
                        <button onclick="PhoneApps.snakeDir('right')">▶</button>
                    </div>
                </div>
            </div>`;
    },
    snakeStart() {
      var _a;
      const s = this.snakeState();
      s.body = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
      s.dir = { x: 1, y: 0 };
      s.pendingDir = { x: 1, y: 0 };
      s.food = this.snakeFood();
      s.score = 0;
      s.alive = true;
      s.running = true;
      s.speed = 240;
      this.snakeLoop();
      (_a = window.PhonePanel) == null ? void 0 : _a.render();
    },
    snakeDir(name) {
      const s = this.snakeState();
      if (!s.alive) return;
      const D = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      const d = D[name];
      if (!d) return;
      if (d.x === -s.dir.x && d.y === -s.dir.y) return;
      s.pendingDir = d;
    },
    snakeSpeed(s) {
      return Math.max(110, 240 - s.score * 10);
    },
    snakeLoop() {
      if (typeof document === "undefined") return;
      clearInterval(this._snakeTimer);
      this._snakeTimer = setInterval(() => {
        const P = window.PhonePanel;
        if (!P || !P.view || P.view.app !== "snake") return;
        this.snakeTick();
      }, this.snakeSpeed(this.snakeState()));
    },
    /** 单帧逻辑（纯逻辑可测）：移动 → 吃食 → 撞检 */
    snakeTick() {
      var _a, _b;
      const s = this.snakeState();
      if (!s.alive || !s.running) return null;
      s.dir = s.pendingDir;
      const G = this.SG;
      const head = { x: (s.body[0].x + s.dir.x + G) % G, y: (s.body[0].y + s.dir.y + G) % G };
      if (s.body.some((p) => p.x === head.x && p.y === head.y)) {
        s.alive = false;
        s.running = false;
        clearInterval(this._snakeTimer);
        const P = window.PhonePanel;
        if (P) {
          const apps = this.appsState(P);
          if (s.score > (apps.snakeBest || 0)) {
            apps.snakeBest = s.score;
            (_a = window.showToast) == null ? void 0 : _a.call(window, `🐍 新纪录：${s.score} 分！`, "success");
          }
          (_b = window.storyFramework) == null ? void 0 : _b.saveStory();
          P.render();
        }
        return "dead";
      }
      s.body.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        s.score += 1;
        s.food = this.snakeFood();
        if (typeof document !== "undefined") {
          clearInterval(this._snakeTimer);
          this.snakeLoop();
        }
      } else {
        s.body.pop();
      }
      if (typeof document !== "undefined") {
        this.snakeDraw();
        const el = document.getElementById("phSkScore");
        if (el) el.textContent = s.score;
      }
      return "ok";
    },
    snakeFood() {
      const s = this.snakeState();
      let f, guard = 0;
      do {
        f = { x: Math.floor(Math.random() * this.SG), y: Math.floor(Math.random() * this.SG) };
        guard++;
      } while (s.body.some((p) => p.x === f.x && p.y === f.y) && guard < 200);
      return f;
    },
    snakeDraw() {
      if (typeof document === "undefined") return;
      const cv = document.getElementById("phSnakeCv");
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d");
      const cell = cv.width / this.SG;
      ctx.fillStyle = "#101d12";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      for (let i = 1; i < this.SG; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, cv.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(cv.width, i * cell);
        ctx.stroke();
      }
      const s = this.snakeState();
      ctx.fillStyle = "#ff5b5b";
      ctx.beginPath();
      ctx.arc((s.food.x + 0.5) * cell, (s.food.y + 0.5) * cell, cell * 0.34, 0, Math.PI * 2);
      ctx.fill();
      s.body.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? "#8ef58e" : `rgba(78, 200, 90, ${Math.max(0.35, 1 - i * 0.04)})`;
        const r = 3;
        const x = p.x * cell + 1, y = p.y * cell + 1, w = cell - 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, w, r) : ctx.rect(x, y, w, w);
        ctx.fill();
      });
    },
    /* ==================== 计时器治理 ==================== */
    /** 清各 App 计时器（钟表/秒表/贪吃蛇/弹幕）——音乐计时器独立常驻（真手机背景放歌） */
    cleanupAppTimers() {
      clearInterval(this._swTimer);
      clearInterval(this._snakeTimer);
      this.stopDanmaku();
    },
    /** 手机关屏：全部计时器歇业 */
    onPhoneClose() {
      clearInterval(this._swTimer);
      clearInterval(this._snakeTimer);
      clearInterval(this._musicTimer);
      this.stopDanmaku();
    },
    /* ==================== 自举 ==================== */
    init() {
      if (typeof document !== "undefined") {
        document.addEventListener("keydown", (e) => {
          const P = window.PhonePanel;
          if (!P || !P.view || P.view.app !== "snake") return;
          const K = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
          const d = K[e.key];
          if (d) {
            e.preventDefault();
            this.snakeDir(d);
          }
        });
        document.addEventListener("touchstart", (e) => {
          const P = window.PhonePanel;
          if (!P || !P.view || P.view.app !== "snake") return;
          const t = e.touches[0];
          this._tsX = t.clientX;
          this._tsY = t.clientY;
        }, { passive: true });
        document.addEventListener("touchend", (e) => {
          const P = window.PhonePanel;
          if (!P || !P.view || P.view.app !== "snake") return;
          const t = e.changedTouches[0];
          const dx = t.clientX - (this._tsX || 0), dy = t.clientY - (this._tsY || 0);
          if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
          this.snakeDir(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
        }, { passive: true });
      }
      console.log("[PhoneApps] 🏠 手机分身·App 生态就位（锁屏 / 桌面 / 音乐 / 短视频 / 相册 / 天气 / 计算器 / 时钟 / 贪吃蛇）");
    }
  };
  window.PhoneApps = PhoneApps;
  PhoneApps.init();
})();
