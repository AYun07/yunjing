(function () {
  "use strict";
  /* ============================================================
   * 云境工坊 · 手机分身 · 墨韵融合社交包 v3.47.0
   * ------------------------------------------------------------
   * 灵感蓝本：墨韵手机（SillyTavern 扩展）的产品功能形态
   * 实现方式：按云境架构原生重写（存档/AI 调用/时代系统全兼容）
   *
   * 新增五 App：
   *  - 微博   weibo      2009+（联系人发博 · 热搜榜 · 发微博）
   *  - 匿名树洞 anonymous 2011+（陌生匹配 · 匿名聊天 · 防狼提示）
   *  - 日历   calendar   全时代（剧情大事记 · 月历 · 纪念日）
   *  - 商城   mall       全时代（供销社/百货/电商三形态 · 联动现金）
   *  - 日记   diary      全时代（手写日记 · AI 补记今日）
   *
   * 与引擎的接缝：
   *  - 数据全部落 storyState.phone.apps.*（随存档走，老档渐进初始化）
   *  - AI 走 PhonePanel.callPhoneAPI + parseJSON（复用主笔/独立接口）
   *  - 玩家行为经 p.pending 回流主笔（下轮正文世界知道你干了什么）
   * ============================================================ */
  const PhoneSocial = {
    version: "v3.47.0",

    /* ==================== 通用工具 ==================== */
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    },
    vh(n) {
      n = Number(n) || 0;
      return n >= 10000 ? (n / 10000).toFixed(1) + "万" : String(Math.round(n));
    },
    nowLabel() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    },
    save() {
      try { window.storyFramework && window.storyFramework.saveStory(); } catch (e) { }
    },
    /** 玩家现金（地球账本变量，读取顺序与主笔记账约定一致） */
    cashOf() {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const st = v.stats || {};
      const cand = [st["现金"], st["现金（元）"], v["现金"], st["存款"], v["存款"], st["钱"], v["钱"]];
      for (const c of cand) {
        const n = parseFloat(String(c).replace(/[^\d.+-]/g, ""));
        if (!isNaN(n)) return n;
      }
      return null; // 未知账本：不拦截下单，交给正文记账
    },

    /* ==================== 状态分区（storyState.phone.apps） ==================== */
    state(panel) {
      panel = panel || window.PhonePanel;
      const apps = window.PhoneApps.appsState(panel);
      if (!Array.isArray(apps.weiboPosts)) apps.weiboPosts = [];
      if (!Array.isArray(apps.weiboHot)) apps.weiboHot = [];
      if (!Array.isArray(apps.weiboLiked)) apps.weiboLiked = [];
      if (!apps.weiboView || !["feed", "hot", "post"].includes(apps.weiboView)) apps.weiboView = "feed";
      if (!apps.anon || typeof apps.anon !== "object") apps.anon = { current: null, history: [] };
      if (!Array.isArray(apps.anon.history)) apps.anon.history = [];
      if (!Array.isArray(apps.calMark)) apps.calMark = [];
      if (!Array.isArray(apps.mallGoods)) apps.mallGoods = [];
      if (!Array.isArray(apps.mallOrders)) apps.mallOrders = [];
      if (!Array.isArray(apps.diary)) apps.diary = [];
      return apps;
    },
    /** 回桌面时的轻量清理（不触发渲染，由调用方统一 render） */
    cleanup() {
      const P = window.PhonePanel;
      if (!P) return;
      const apps = this.state(P);
      apps.weiboView = "feed";
      this._wOpen = null;
      this._dWrite = false;
    },
    resetView() {
      const P = window.PhonePanel;
      if (!P) return;
      this.cleanup();
      P.render();
    },

    /* ============================================================
     * 🌤 微博（2009+ · 联系人的公开生活流）
     * ============================================================ */
    WTEMPLATES: [
      { text: "加班到现在，地铁末班赶得刚刚好。生活嘛，就是这样一点点熬出来的。", cat: "日常" },
      { text: "今天食堂的糖醋排骨居然是热的，值得发一条表扬。", cat: "吐槽" },
      { text: "深夜食堂第 38 夜：泡面加蛋，认真生活的人运气不会太差。", cat: "日常" },
      { text: "小区门口的桂花开了，下班路上闻到那一刻，突然就不累了。", cat: "生活" },
      { text: "转发抽奖又没中，但我怀疑这个奖根本不存在。", cat: "吐槽" },
      { text: "陪我妈逛了趟菜市场，她砍价的样子比我上班还专业。", cat: "家人" },
      { text: "今天被领导夸了一句，快乐得像捡到钱。成年人的快乐就是这么便宜。", cat: "职场" },
      { text: "立个 flag：这周不喝奶茶。……好吧现在是周二。", cat: "日常" }
    ],
    WHOT: ["秋天的第一杯奶茶", "本地晚高峰", "当代年轻人的睡眠", "公司楼下的流浪猫", "房租又要到期了", "周末去哪儿玩", "地铁上的早八人", "外卖红包互点", "今晚吃什么", "工位摸鱼图鉴"],
    /** 本地兜底微博（零 token）：联系人当博主，确定性种子 */
    localWeibo(panel) {
      const p = panel.state();
      const names = p.contacts.map((c) => c.name);
      const turn = window.storyFramework && window.storyFramework.storyState.turnCount || 0;
      const seed = (this._wSeed = (this._wSeed || 0) + 1 + turn);
      const out = [];
      for (let i = 0; i < 5; i++) {
        const h = panel.hueOf("w" + seed + "_" + i + (names[i % Math.max(1, names.length)] || ""));
        const tp = this.WTEMPLATES[(h + i * 5) % this.WTEMPLATES.length];
        const author = names.length ? names[(h + i * 3) % names.length] : "网友" + (1e3 + h % 9e3);
        out.push({
          author, text: tp.text, cat: tp.cat,
          likes: 3 + h * 13 % 260, reposts: h * 7 % 40,
          comments: [{ by: names.length ? names[(h + i + 1) % names.length] : "路人", text: "哈哈哈哈真实" }],
          mine: false, time: this.nowLabel()
        });
      }
      return out;
    },
    localHot() {
      const turn = window.storyFramework && window.storyFramework.storyState.turnCount || 0;
      return this.WHOT.map((w, i) => ({ word: w, heat: 12e4 - i * 9e3 - (turn * 37) % 5e3 })).slice(0, 8);
    },
    renderWeibo(panel) {
      const apps = this.state(panel);
      if (!apps.weiboPosts.length) apps.weiboPosts = this.localWeibo(panel);
      if (!apps.weiboHot.length) apps.weiboHot = this.localHot();
      if (this._wOpen != null) return this.renderWeiboDetail(panel);
      const tabs = [["feed", "关注"], ["hot", "热搜"], ["post", "✎ 发微博"]];
      const head = `<div class="ph-app ph-app-weibo">
        ${window.PhoneApps.appHead(panel, "微博", "熟人们的公开生活 · 140 字人生")}
        <div class="ph-vtabs">${tabs.map((t) => `<button class="${apps.weiboView === t[0] ? "on" : ""}" onclick="PhoneSocial.weiboTab('${t[0]}')">${t[1]}</button>`).join("")}</div>`;
      if (apps.weiboView === "post") {
        return head + `
          <div class="ph-wpost">
            <div class="ph-wpost-user">${this.esc(panel.playerName())} ·公开发布</div>
            <textarea id="phWbText" class="ph-wpost-ta" maxlength="140" placeholder="分享此刻的想法（140 字内，微博公开可见，熟人可能刷到你）"></textarea>
            <div class="ph-ffoot">
              <button class="ph-fnew" onclick="PhoneSocial.weiboSend()">发布</button>
              <button class="ph-frefresh" onclick="PhoneSocial.weiboTab('feed')">取消</button>
            </div>
          </div></div>`;
      }
      if (apps.weiboView === "hot") {
        const rows = apps.weiboHot.map((h, i) => `<button class="ph-whot" onclick="PhoneSocial.weiboHotClick('${this.esc(h.word).replace(/'/g, "")}')">
            <b class="ph-whot-rank ${i < 3 ? "top" : ""}">${i + 1}</b>
            <span class="ph-whot-word">${this.esc(h.word)}</span>
            <em class="ph-whot-heat">🔥${this.vh(h.heat)}</em>
          </button>`).join("") || '<div class="ph-vempty">暂无热搜</div>';
        return head + `<div class="ph-wlist">${rows}</div>
          <div class="ph-ffoot"><button class="ph-frefresh" onclick="PhoneSocial.weiboRefresh(true)">↻ 换一批热搜</button></div></div>`;
      }
      const cards = apps.weiboPosts.map((w, i) => {
        const hue = panel.hueOf(String(w.author || "x")) % 360;
        const key = "wb" + i + String(w.author);
        const liked = apps.weiboLiked.includes(key);
        return `<div class="ph-wcard" style="--fh:${hue}">
          <div class="ph-wcard-head">
            <span class="ph-wavatar">${this.esc(String(w.author || "?").slice(0, 1))}</span>
            <b>${this.esc(w.author)}${w.mine ? "（我）" : ""}</b>
            <time>${this.esc(w.time || "")}</time>
          </div>
          <p class="ph-wcard-text">${this.esc(w.text)}</p>
          <div class="ph-wcard-ops">
            <button class="${liked ? "on" : ""}" onclick="PhoneSocial.weiboLike(${i})">${liked ? "❤" : "♡"} ${this.vh((w.likes || 0) + (liked ? 1 : 0))}</button>
            <button onclick="PhoneSocial.weiboOpen(${i})">💬 ${w.comments && w.comments.length || 0}</button>
            <button disabled>🔁 ${this.vh(w.reposts || 0)}</button>
          </div>
        </div>`;
      }).join("") || '<div class="ph-vempty">时间线空空的，下拉刷新看看大家在干嘛</div>';
      return head + `<div class="ph-wlist">${cards}</div>
        <div class="ph-ffoot"><button class="ph-frefresh" onclick="PhoneSocial.weiboRefresh()">↻ 刷新时间线</button></div></div>`;
    },
    renderWeiboDetail(panel) {
      const apps = this.state(panel);
      const w = apps.weiboPosts[Math.min(this._wOpen || 0, apps.weiboPosts.length - 1)];
      if (!w) { this._wOpen = null; return this.renderWeibo(panel); }
      const comments = (w.comments || []).map((c) => `<div class="ph-floor"><b>${this.esc(c.by)}</b><p>${this.esc(c.text)}</p></div>`).join("");
      return `<div class="ph-app ph-app-weibo">
        ${window.PhoneApps.appHead(panel, "微博正文", "公开评论区")}
        <div class="ph-op">
          <b>${this.esc(w.author)}${w.mine ? "（我）" : ""}</b>
          <p class="ph-op-body">${this.esc(w.text)}</p>
          <small>❤ ${this.vh(w.likes || 0)} · 🔁 ${this.vh(w.reposts || 0)} · 💬 ${(w.comments || []).length}</small>
        </div>
        <div class="ph-floors">${comments || '<div class="ph-vempty">还没有评论，抢首评</div>'}</div>
        <div class="ph-ffoot">
          <button class="ph-fnew" onclick="PhoneSocial.weiboComment()">💬 评论一条</button>
          <button class="ph-frefresh" onclick="PhoneSocial.weiboClose()">‹ 返回时间线</button>
        </div>
      </div>`;
    },
    weiboTab(t) {
      const P = window.PhonePanel;
      this.state(P).weiboView = t;
      this._wOpen = null;
      P.render();
    },
    weiboOpen(i) { this._wOpen = i; window.PhonePanel.render(); },
    weiboClose() { this._wOpen = null; window.PhonePanel.render(); },
    weiboLike(i) {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const w = apps.weiboPosts[i];
      if (!w) return;
      const key = "wb" + i + String(w.author);
      const idx = apps.weiboLiked.indexOf(key);
      if (idx >= 0) apps.weiboLiked.splice(idx, 1); else apps.weiboLiked.push(key);
      if (!w.mine && idx < 0 && Math.random() < 0.35) {
        P.state().pending.push(`📱 玩家在微博给「${String(w.author).slice(0, 12)}」的动态点了个赞（TA 可能会注意到）`);
      }
      P.render(); this.save();
    },
    async weiboComment() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const w = apps.weiboPosts[this._wOpen || 0];
      if (!w) return;
      const said = await (window.UIDialog && window.UIDialog.prompt({ title: "💬 评论", message: `在「${String(w.author).slice(0, 12)}」的微博下评论什么？（公开可见）` }));
      if (!said || !String(said).trim()) return;
      const txt = String(said).trim().slice(0, 80);
      w.comments = w.comments || [];
      w.comments.push({ by: P.playerName(), text: txt });
      P.state().pending.push(`📱 玩家在微博「${String(w.author).slice(0, 12)}」的动态下评论了（「${txt.slice(0, 30)}」），博主可能回复`);
      P.render(); this.save();
      window.showToast && window.showToast("🌤 评论已发出，博主也许会回你", "success");
    },
    weiboSend() {
      const P = window.PhonePanel;
      const ta = document.getElementById("phWbText");
      const txt = ta ? String(ta.value || "").trim() : "";
      if (!txt) { window.showToast && window.showToast("写点什么再发布吧", "info"); return; }
      const apps = this.state(P);
      apps.weiboPosts.unshift({ author: P.playerName(), text: txt.slice(0, 140), cat: "生活", likes: 0, reposts: 0, comments: [], mine: true, time: this.nowLabel() });
      P.state().pending.push(`📱 玩家发了一条公开微博（「${txt.slice(0, 40)}」）——熟人们可能刷到、评论、或在微信里聊起它`);
      apps.weiboView = "feed";
      P.render(); this.save();
      window.showToast && window.showToast("🌤 已发布到公开时间线", "success");
    },
    weiboHotClick(word) {
      window.showToast && window.showToast(`🌤 搜「${word}」——大家都在聊这个`, "info");
    },
    buildWeiboPrompt(panel) {
      const sys = [
        "你在为玩家手机里的「微博App」生成内容。世界是玩家正在经历的故事世界，微博动态与热搜须与之一致。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录】\n${panel.contactBrief()}` : "",
        "【规则】",
        "1. posts 生成 5 条微博：联系人当博主，内容是他们公开的生活（吐槽/晒日常/感慨/转发体），语气各有个性",
        "2. 每条 likes 0-500、reposts 0-60；comments 0-2 条（by 可用其他联系人，text 要有评论味）",
        "3. hot 生成 8 条热搜：word 12 字内、紧扣时代与本地生活（社会新闻/天气/梗/民生），heat 2万-50万 从高到低",
        "4. 时代铁律：用语、梗、热点严格符合故事年代（2009 的微博是稚嫩的转播体，2024 是阴阳怪气体）",
        '【输出】只输出 JSON：{"posts":[{"author":"","text":"","likes":12,"reposts":3,"comments":[{"by":"","text":""}]}],"hot":[{"word":"","heat":350000}]}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "生成这批微博动态与热搜" }];
    },
    async weiboRefresh(hotOnly) {
      const P = window.PhonePanel;
      const apps = this.state(P);
      P.renderBusy && P.renderBusy(true, "正在刷新微博…");
      try {
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildWeiboPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const posts = (data && Array.isArray(data.posts) ? data.posts : []).filter((w) => w && w.author && w.text).slice(0, 8).map((w) => ({
            author: String(w.author).slice(0, 14),
            text: String(w.text).slice(0, 160),
            likes: Math.max(0, Math.min(99999, Math.round(Number(w.likes) || 0))),
            reposts: Math.max(0, Math.min(9999, Math.round(Number(w.reposts) || 0))),
            comments: (Array.isArray(w.comments) ? w.comments : []).slice(0, 3).map((c) => ({ by: String(c && c.by || "路人").slice(0, 12), text: String(c && c.text || "").slice(0, 60) })).filter((c) => c.text),
            mine: false, time: this.nowLabel()
          }));
          const hot = (data && Array.isArray(data.hot) ? data.hot : []).filter((h) => h && h.word).slice(0, 8).map((h, i) => ({ word: String(h.word).slice(0, 16), heat: Math.max(2e4, Math.round(Number(h.heat) || 5e5 - i * 4e4)) }));
          if (posts.length >= 3) {
            const mine = apps.weiboPosts.filter((w) => w.mine).slice(0, 6);
            apps.weiboPosts = mine.concat(posts);
          }
          if (hot.length >= 4) apps.weiboHot = hot;
        } else {
          if (!hotOnly) apps.weiboPosts = this.localWeibo(P);
          apps.weiboHot = this.localHot();
        }
        this._wOpen = null;
        window.showToast && window.showToast("🌤 微博刷新完毕", "success");
      } catch (e) {
        if (!hotOnly) apps.weiboPosts = this.localWeibo(P);
        apps.weiboHot = this.localHot();
        window.showToast && window.showToast("🌤 刷新失败，先看时间线", "info");
      } finally {
        P.renderBusy && P.renderBusy(false);
        P.render();
        this.save();
      }
    },
    /** 引擎 sync 落库入口：联系人发的微博批次（PhonePanel.sync 调用）
     *  玩家自己的微博始终置顶保留（与 weiboRefresh 的 AI 刷新同规则——
     *  发过的微博不被批次冲走，TA 还等着看谁点了赞）；
     *  批次内按 moments 惯例：数组末位最新、显示在最前 */
    pushWeiboBatch(list) {
      const P = window.PhonePanel;
      if (!P || !Array.isArray(list)) return;
      const apps = this.state(P);
      const batch = [];
      for (const w of list.slice(0, 3)) {
        if (!w || !w.author || !w.text) continue;
        batch.push({
          author: String(w.author).slice(0, 14),
          text: String(w.text).slice(0, 160),
          likes: Math.max(0, Math.round(Number(w.likes) || 0)),
          reposts: Math.max(0, Math.round(Number(w.reposts) || 0)),
          comments: (Array.isArray(w.comments) ? w.comments : []).slice(0, 2).map((c) => ({ by: String(c && c.by || "路人").slice(0, 12), text: String(c && c.text || "").slice(0, 60) })).filter((c) => c.text),
          mine: false, time: this.nowLabel()
        });
      }
      if (!batch.length) return;
      const mine = apps.weiboPosts.filter((w) => w.mine);
      apps.weiboPosts = mine.concat(batch.reverse(), apps.weiboPosts.filter((w) => !w.mine)).slice(0, 40);
    },

    /* ============================================================
     * 🕶 匿名树洞（2011+ · 陌生人的深夜电波）
     * ============================================================ */
    renderAnonymous(panel) {
      const apps = this.state(panel);
      const a = apps.anon;
      if (!a.current) {
        return `<div class="ph-app ph-app-anon">
          ${window.PhoneApps.appHead(panel, "匿名树洞", "随机匹配 · 谁也不知道你是谁")}
          <div class="ph-anon-hero">
            <div class="ph-anon-moon">🌙</div>
            <p class="ph-anon-slogan">白天是人，晚上是树洞。<br>系统随机匹配一位同样睡不着的人，聊聊就散。</p>
            ${a.history.length ? `<small class="ph-anon-stat">已认识过 ${a.history.length} 位陌生人</small>` : ""}
            <button class="ph-anon-go" onclick="PhoneSocial.anonMatch()">🎲 开始匹配</button>
            <p class="ph-anon-warn">⚠ 网络交友有风险：TA 说的可能全是假的，别转账、别透露住址与真名。</p>
          </div>
        </div>`;
      }
      const c = a.current;
      const hue = panel.hueOf(c.name) % 360;
      const msgs = (c.msgs || []).map((m) => `<div class="ph-bub ${m.me ? "me" : ""}">
          <div class="ph-bub-box"><p>${this.esc(m.text)}</p><time>${this.esc(m.time || "")}</time></div>
        </div>`).join("");
      return `<div class="ph-app ph-app-anon">
        <div class="ph-chat-head">
          <button class="ph-back" onclick="PhoneSocial.anonLeave()" title="退出匿名局">‹</button>
          <b><span class="ph-wavatar" style="--fh:${hue}">${this.esc(String(c.name).slice(0, 1))}</span>${this.esc(c.name)}</b>
          <span class="ph-app-sub">${this.esc(c.tag || "深夜路人")} · ${(c.msgs || []).length} 条</span>
        </div>
        <div class="ph-anon-intro">${this.esc(c.intro || "")}</div>
        <div class="ph-anon-msgs">${msgs || '<div class="ph-vempty">TA 还没说话</div>'}</div>
        <div class="ph-chat-input">
          <input id="phAnonText" placeholder="匿名聊聊（TA 不知道你是谁）…" maxlength="120"
            onkeydown="if(event.key==='Enter')PhoneSocial.anonSend()">
          <button class="ph-send" onclick="PhoneSocial.anonSend()">发送</button>
        </div>
        <div class="ph-ffoot">
          <button class="ph-fnew" onclick="PhoneSocial.anonNext()">🎲 换个人聊</button>
          <button class="ph-frefresh" onclick="PhoneSocial.anonLeave()">拉黑退出</button>
        </div>
      </div>`;
    },
    buildAnonMatchPrompt(panel) {
      const sys = [
        "你在为玩家手机里的「匿名树洞App」匹配一位陌生人。世界是玩家正在经历的故事世界，陌生人要与之一致。",
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        panel.contactBrief ? `【通讯录（严禁匹配出这些人或其熟人——匿名区遇到熟人就穿帮了）】\n${panel.contactBrief()}` : "",
        "【规则】",
        "1. name：陌生网名（8 字内，深夜感，禁止使用通讯录里的名字）",
        "2. tag：一句话签名（12 字内）；intro：TA 的开场白（40 字内，深夜树洞语气）",
        "3. TA 与玩家互不相识；性格随机（健谈/冷淡/心事重重/搞笑男或搞笑女），但都足够真实",
        "4. 时代感：用语符合故事年代的网络生态",
        '【输出】只输出 JSON：{"name":"","tag":"","intro":""}'
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "匹配一位匿名陌生人" }];
    },
    async anonMatch() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      P.renderBusy && P.renderBusy(true, "正在匹配陌生人…");
      try {
        let person = null;
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildAnonMatchPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          if (data && data.name && data.intro) {
            person = { name: String(data.name).slice(0, 10), tag: String(data.tag || "深夜路人").slice(0, 14), intro: String(data.intro).slice(0, 60), msgs: [] };
          }
        }
        if (!person) {
          const pool = [["夜航船", "今晚也别睡", "睡不着，随便聊聊？"], ["凌晨三点半", "失眠俱乐部 VIP", "睡不着的第 N 晚，你呢"], ["月亮邮递员", "代收深夜心事", "你也是夜猫子？"], ["风把云吹散了", "在的城市下雨了", "刚加完班，聊会儿？"]];
          const pick = pool[Math.floor(Math.random() * pool.length)];
          person = { name: pick[0], tag: pick[1], intro: pick[2], msgs: [] };
        }
        apps.anon.current = person;
        P.state().pending.push(`📱 玩家在匿名树洞匹配到一位陌生人「${person.name}」并开始聊天（双方匿名，正文可偶尔提起这种深夜消遣）`);
        window.showToast && window.showToast("🕶 匹配成功，对方不知道你是谁", "success");
      } catch (e) {
        window.showToast && window.showToast("🕶 匹配失败，再试一次", "info");
      } finally {
        P.renderBusy && P.renderBusy(false);
        P.render();
        this.save();
      }
    },
    buildAnonReplyPrompt(panel) {
      const c = this.state(panel).anon.current;
      const hist = (c.msgs || []).slice(-14).map((m) => `${m.me ? "玩家（匿名）" : c.name}: ${m.text}`).join("\n");
      const sys = `你是「现实地球」手机分身引擎。玩家正在「匿名树洞App」与一位陌生人聊天，你以陌生人的身份回复。

【世界基线】${panel.eraBrief ? panel.eraBrief() : ""}
【陌生人档案】${c.name} · ${c.tag}——你们互不相识，TA 只知道匿名对面的"玩家"此刻也醒着。
【聊天记录】
${hist || "（刚匹配，还没聊）"}

【规则】
1. 回复保持 TA 的性格与深夜树洞语气（不追问真名/住址/转账——正常陌生人不这样）
2. 玩家若表现可疑（要转账/索隐私），TA 会警惕或调侃
3. 1-2 条短回复（每条 60 字内），像真人打字
【输出】只输出 JSON：{"replies":[{"text":""}]}`
      return [{ role: "system", content: sys }, { role: "user", content: "陌生人回复玩家" }];
    },
    async anonSend() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const c = apps.anon.current;
      if (!c) return;
      const input = document.getElementById("phAnonText");
      const txt = input ? String(input.value || "").trim() : "";
      if (!txt) return;
      input.value = "";
      c.msgs = c.msgs || [];
      c.msgs.push({ me: true, text: txt.slice(0, 120), time: this.nowLabel() });
      P.render();
      const box = document.querySelector(".ph-anon-msgs");
      if (box) box.scrollTop = box.scrollHeight;
      if (P.isApiReady && P.isApiReady()) {
        try {
          const raw = await P.callPhoneAPI(this.buildAnonReplyPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const list = (data && Array.isArray(data.replies) ? data.replies : []).filter((r) => r && r.text).slice(0, 2);
          for (const r of list) c.msgs.push({ me: false, text: String(r.text).slice(0, 80), time: this.nowLabel() });
          if (!list.length) c.msgs.push({ me: false, text: "（对方好像走神了……）", time: this.nowLabel() });
        } catch (e) {
          c.msgs.push({ me: false, text: this.anonFallback(c), time: this.nowLabel() });
        }
      } else {
        c.msgs.push({ me: false, text: this.anonFallback(c), time: this.nowLabel() });
      }
      P.render();
      const box2 = document.querySelector(".ph-anon-msgs");
      if (box2) box2.scrollTop = box2.scrollHeight;
      this.save();
    },
    anonFallback(c) {
      const pool = ["嗯，懂你说的那种感觉。", "哈哈这个点还聊得动的人不多了。", "有点困了但还不想睡，你呢？", "（对方正在输入…然后停了）", "你说得对，明天再说吧。晚安？"];
      return pool[(c.msgs || []).length % pool.length];
    },
    anonNext() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const c = apps.anon.current;
      if (c) apps.anon.history.push(c.name);
      apps.anon.current = null;
      P.render(); this.save();
      this.anonMatch();
    },
    anonLeave() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const c = apps.anon.current;
      if (c) apps.anon.history.push(c.name);
      apps.anon.current = null;
      P.render(); this.save();
    },

    /* ============================================================
     * 📅 日历（全时代 · 剧情大事记 + 纪念日）
     * ============================================================ */
    /** 故事日期 → {y, m, d}，失败回退真实时间 */
    storyDate() {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const s = String(v.date || v.日期 || "");
      let m = s.match(/(\d{4})\s*[年\-/.](\d{1,2})\s*[月\-/.](\d{1,2})/);
      if (m) return { y: +m[1], m: +m[2], d: +m[3], ok: true };
      const d = new Date();
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), ok: false };
    },
    /** 剧情事件：变量里的大事记/伏笔 + 玩家纪念日 */
    calEvents() {
      const v = window.storyFramework && window.storyFramework.storyState.variables || {};
      const out = [];
      const push = (name, date, kind) => {
        if (!name) return;
        const s = String(date || "");
        const m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/) || s.match(/(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/);
        out.push({ name: String(name).slice(0, 24), when: s.slice(0, 12) || "近期", kind, mm: m ? +m[1] : null, dd: m ? +m[2] : null });
      };
      const evts = v["大事记"] || v.events || [];
      if (Array.isArray(evts)) evts.slice(-8).forEach((e) => {
        if (typeof e === "string") push(e, "", "event");
        else if (e && e.name) push(e.name, e.date || e.time || "", "event");
      });
      const fs = v.foreshadowings || [];
      if (Array.isArray(fs)) fs.slice(-4).forEach((f) => { if (f && f.name) push("伏笔 · " + f.name, f.date || "", "foreshadow"); });
      const P = window.PhonePanel;
      if (P) (this.state(P).calMark || []).forEach((c) => push(c.label, c.date, "mark"));
      return out;
    },
    renderCalendar(panel) {
      const sd = this.storyDate();
      const first = new Date(sd.y, sd.m - 1, 1);
      const days = new Date(sd.y, sd.m, 0).getDate();
      const lead = first.getDay();
      const evts = this.calEvents();
      const cell = (d) => {
        const isToday = d === sd.d;
        const hasEvt = evts.some((e) => e.mm === sd.m && e.dd === d);
        return `<span class="ph-cal-cell ${isToday ? "today" : ""} ${hasEvt ? "mark" : ""}">${d || ""}</span>`;
      };
      const grid = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => cell(i < lead || i >= lead + days ? 0 : i - lead + 1)).join("");
      const rows = evts.slice(0, 10).map((e) => `<div class="ph-cal-evt ${e.kind}">
          <b>${e.kind === "mark" ? "🌟" : e.kind === "foreshadow" ? "🧩" : "📌"} ${this.esc(e.when)}</b>
          <p>${this.esc(e.name)}</p>
        </div>`).join("") || '<div class="ph-vempty">还没有记录在案的日子——去正文里活出点值得记的事</div>';
      return `<div class="ph-app ph-app-calendar">
        ${window.PhoneApps.appHead(panel, "日历", sd.ok ? `${sd.y}年${sd.m}月 · 剧情时间` : "现实时间（剧情日期未登记）")}
        <div class="ph-cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div class="ph-cal-grid">${grid}</div>
        <div class="ph-cal-evts">${rows}</div>
        <div class="ph-ffoot">
          <button class="ph-fnew" onclick="PhoneSocial.calAdd()">🌟 记个日子</button>
        </div>
      </div>`;
    },
    async calAdd() {
      const P = window.PhonePanel;
      const label = await (window.UIDialog && window.UIDialog.prompt({ title: "🌟 纪念日", message: "记点什么？（如：她的生日 / 搬进新家）" }));
      if (!label || !String(label).trim()) return;
      const sd = this.storyDate();
      const apps = this.state(P);
      apps.calMark.push({ date: `${sd.m}月${sd.d}日`, label: String(label).trim().slice(0, 20) });
      P.state().pending.push(`📱 玩家在日历上记下了一个日子（「${String(label).trim().slice(0, 20)}”）`);
      P.render(); this.save();
      window.showToast && window.showToast("📅 已记下这个日子", "success");
    },

    /* ============================================================
     * 🛒 商城（全时代 · 供销社/百货/电商三形态 · 联动现金）
     * ============================================================ */
    mallName(tier) {
      return tier === "sms" ? "供销社" : tier === "qq" ? "百货大楼" : "手机商城";
    },
    MGOODS: {
      sms: [["暖水瓶", 8.5, "竹壳的，保温一整天"], ["的确良布料", 6.8, "做两件衬衫还剩"], ["搪瓷缸", 3.2, "印着劳动最光荣"], ["手电筒", 4.6, "两节一号电池"], ["缝纫机油", 1.2, "缝纫机保养必备"], ["钢笔", 5.0, "英雄牌，出水的"]],
      qq: [["随身听", 98, "英语听力用的（真的）"], ["BP机", 380, "呼我：129-8888"], ["磁带十盘装", 45, "流行金曲大合集"], ["电子表", 25, "夜光的，防水"], ["运动服", 88, "校服之外的第二套"], ["随身 CD 机", 220, "跳段保护，不卡碟"]],
      wechat: [["手机", 2999, "摄像头能拍月亮"], ["球鞋", 899, "限量配色，手慢无"], ["蓝牙耳机", 399, "降噪，通勤神器"], ["空气炸锅", 349, "万物皆可炸"], ["机械键盘", 459, "茶轴，敲字如飞"], ["扫地机器人", 1299, "猫都追着跑"]]
    },
    localGoods(panel) {
      const tier = panel.tier();
      return (this.MGOODS[tier] || this.MGOODS.wechat).map((g) => ({ name: g[0], price: g[1], desc: g[2] }));
    },
    renderMall(panel) {
      const apps = this.state(panel);
      const title = this.mallName(panel.tier());
      if (!apps.mallGoods.length) apps.mallGoods = this.localGoods(panel);
      const cash = this.cashOf();
      const cards = apps.mallGoods.slice(0, 12).map((g, i) => `<div class="ph-mall-card">
          <div class="ph-mall-name">${this.esc(g.name)}</div>
          <p class="ph-mall-desc">${this.esc(g.desc || "")}</p>
          <div class="ph-mall-foot">
            <b class="ph-mall-price">¥${Number(g.price || 0).toFixed(Number(g.price || 0) % 1 ? 1 : 0)}</b>
            <button class="ph-fnew" onclick="PhoneSocial.mallBuy(${i})">下单</button>
          </div>
        </div>`).join("");
      const orders = apps.mallOrders.slice(0, 6).map((o) => `<div class="ph-cal-evt"><b>${this.esc(o.time)}</b><p>${this.esc(o.name)} · ¥${o.price}</p></div>`).join("");
      return `<div class="ph-app ph-app-mall">
        ${window.PhoneApps.appHead(panel, title, panel.tier() === "wechat" ? "包邮到家 · 七天无理由" : "柜台提货 · 概不赊账")}
        ${cash != null ? `<div class="ph-mall-wallet">钱包：约 ¥${this.vh(cash)}（下单会从正文账本记账）</div>` : '<div class="ph-mall-wallet">钱包：账本未登记（下单金额交由正文记账）</div>'}
        <div class="ph-mall-grid">${cards}</div>
        ${orders ? `<div class="ph-mall-orders"><b>近期订单</b>${orders}</div>` : ""}
        <div class="ph-ffoot">
          <button class="ph-frefresh" onclick="PhoneSocial.mallRefresh()">↻ ${panel.tier() === "sms" ? "换一批货" : "上新"}</button>
        </div>
      </div>`;
    },
    buildMallPrompt(panel) {
      const tier = panel.tier();
      const name = this.mallName(tier);
      const sys = [
        `你在为玩家手机里的「${name}App」生成货架。世界是玩家正在经历的故事世界，商品须与时代一致。`,
        panel.eraBrief ? `【世界基线】${panel.eraBrief()}` : "",
        `【规则】`,
        `1. 生成 6-8 件商品：name（8 字内）、price（数字，符合该年代物价与收入水平）、desc（12 字内卖点）`,
        tier === "sms" ? "2. 供销社形态：日用品/布匹/文具/五金，价格按 70-80 年代（几毛到十几块）" :
        tier === "qq" ? "2. 百货大楼形态：随身听/磁带/电子表/运动服，价格按 90-00 年代（几十到几百）" :
        "2. 电商形态：数码/家居/服饰/潮玩，价格按当下（几百到几千）",
        `3. 商品贴合玩家所在城市与季节；可以偶尔出现一件与近期剧情呼应的小物件`,
        `【输出】只输出 JSON：{"goods":[{"name":"","price":99,"desc":""}]}`
      ].filter(Boolean).join("\n");
      return [{ role: "system", content: sys }, { role: "user", content: "生成这批货架商品" }];
    },
    async mallRefresh() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      P.renderBusy && P.renderBusy(true, "正在上新…");
      try {
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildMallPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          const goods = (data && Array.isArray(data.goods) ? data.goods : []).filter((g) => g && g.name && g.price > 0).slice(0, 10).map((g) => ({ name: String(g.name).slice(0, 10), price: Math.max(0.1, Math.min(999999, Number(g.price) || 0)), desc: String(g.desc || "").slice(0, 16) }));
          if (goods.length >= 4) apps.mallGoods = goods;
          else apps.mallGoods = this.localGoods(P);
        } else {
          apps.mallGoods = this.localGoods(P);
        }
        window.showToast && window.showToast("🛒 货架已上新", "success");
      } catch (e) {
        apps.mallGoods = this.localGoods(P);
        window.showToast && window.showToast("🛒 上新失败，看老货架", "info");
      } finally {
        P.renderBusy && P.renderBusy(false);
        P.render();
        this.save();
      }
    },
    async mallBuy(i) {
      const P = window.PhonePanel;
      const apps = this.state(P);
      const g = apps.mallGoods[i];
      if (!g) return;
      const cash = this.cashOf();
      if (cash != null && cash < Number(g.price)) {
        window.showToast && window.showToast(`🛒 钱不够——钱包约 ¥${this.vh(cash)}，这件 ¥${g.price}`, "error");
        return;
      }
      apps.mallOrders.unshift({ name: g.name, price: g.price, time: this.nowLabel() });
      apps.mallOrders = apps.mallOrders.slice(0, 20);
      P.state().pending.push(`📱 玩家在${this.mallName(P.tier())}买了「${g.name}」（¥${g.price}）——正文须如实记入玩家的现金/存款变动（支出），包裹/提货细节可自然融入生活`);
      P.render(); this.save();
      window.showToast && window.showToast(`🛒 已下单「${g.name}」，等世界回应`, "success");
    },

    /* ============================================================
     * 📓 日记（全时代 · 手写 + AI 补记）
     * ============================================================ */
    renderDiary(panel) {
      const apps = this.state(panel);
      if (this._dWrite) {
        return `<div class="ph-app ph-app-diary">
          ${window.PhoneApps.appHead(panel, "写日记", "只有你自己能看到")}
          <textarea id="phDiaryText" class="ph-wpost-ta ph-diary-ta" maxlength="600" placeholder="今天发生了什么？记下来，给未来的自己。"></textarea>
          <div class="ph-ffoot">
            <button class="ph-fnew" onclick="PhoneSocial.diarySave()">✓ 写完了</button>
            <button class="ph-frefresh" onclick="PhoneSocial.diaryCancel()">不写了</button>
          </div>
        </div>`;
      }
      const sd = this.storyDate();
      const rows = apps.diary.slice(0, 20).map((d) => `<div class="ph-diary-item ${d.ai ? "ai" : ""}">
          <b>${d.ai ? "✨ AI 补记" : "✍ 手写"} · ${this.esc(d.date)}</b>
          <p>${this.esc(String(d.text).slice(0, 120))}${String(d.text).length > 120 ? "…" : ""}</p>
        </div>`).join("") || '<div class="ph-vempty">日记本还是空的——今天值得记一笔吗？</div>';
      return `<div class="ph-app ph-app-diary">
        ${window.PhoneApps.appHead(panel, "日记本", "私密 · 不入正文")}
        <div class="ph-diary-list">${rows}</div>
        <div class="ph-ffoot">
          <button class="ph-fnew" onclick="PhoneSocial.diaryWrite()">✍ 写今日</button>
          <button class="ph-frefresh" onclick="PhoneSocial.diaryAI()">✨ AI 补记今日</button>
        </div>
      </div>`;
    },
    diaryWrite() { this._dWrite = true; window.PhonePanel.render(); },
    diaryCancel() { this._dWrite = false; window.PhonePanel.render(); },
    diarySave() {
      const P = window.PhonePanel;
      const ta = document.getElementById("phDiaryText");
      const txt = ta ? String(ta.value || "").trim() : "";
      if (!txt) { window.showToast && window.showToast("写点什么再合上本子吧", "info"); return; }
      const apps = this.state(P);
      const sd = this.storyDate();
      apps.diary.unshift({ date: `${sd.m}月${sd.d}日`, text: txt.slice(0, 600), ai: false });
      apps.diary = apps.diary.slice(0, 60);
      this._dWrite = false;
      P.render(); this.save();
      window.showToast && window.showToast("📓 已合上日记本", "success");
    },
    buildDiaryPrompt(panel) {
      const fw = window.storyFramework;
      const turns = (fw && fw.storyState.turns || []).slice(-3);
      const body = turns.map((t) => String(t && t.body || t && t.userInput || "")).join("\n—\n").slice(0, 2200);
      const sd = this.storyDate();
      const sys = `你在为玩家手机里的「日记本App」补记今日日记。以玩家第一人称写今天的事。

【世界基线】${panel.eraBrief ? panel.eraBrief() : ""}
【今日正文（近几轮摘要）】
${body || "（今天风平浪静）"}

【规则】
1. 第一人称、口语化、带点私人情绪（150 字内）——像真人在深夜合上日记本前写的
2. 只写玩家经历过的事与心情，不编造新事件；私密内容不外流（日记不入正文）
【输出】只输出 JSON：{"text":""}`
      return [{ role: "system", content: sys }, { role: "user", content: `补记 ${sd.m}月${sd.d}日 的日记` }];
    },
    async diaryAI() {
      const P = window.PhonePanel;
      const apps = this.state(P);
      P.renderBusy && P.renderBusy(true, "正在回忆今天…");
      try {
        const sd = this.storyDate();
        let text = null;
        if (P.isApiReady && P.isApiReady()) {
          const raw = await P.callPhoneAPI(this.buildDiaryPrompt(P));
          const data = P.parseJSON ? P.parseJSON(raw) : null;
          if (data && data.text) text = String(data.text).slice(0, 400);
        }
        if (!text) {
          const v = window.storyFramework && window.storyFramework.storyState.variables || {};
          text = `今天又是普通的一天。${String(v.location || v.位置 || "这座城市")}的天说变就变，人在城里走，心跟着晃。早点睡，明天的事明天再说。`;
        }
        apps.diary.unshift({ date: `${sd.m}月${sd.d}日`, text, ai: true });
        apps.diary = apps.diary.slice(0, 60);
        window.showToast && window.showToast("📓 今日已补记", "success");
      } catch (e) {
        window.showToast && window.showToast("📓 补记失败，稍后再试", "info");
      } finally {
        P.renderBusy && P.renderBusy(false);
        P.render();
        this.save();
      }
    }
  };

  window.PhoneSocial = PhoneSocial;

  /* 样式自注入（与 phone-panel 同模式：模块自治，studio 零改动） */
  if (!document.getElementById("phSocialCss")) {
    const link = document.createElement("link");
    link.id = "phSocialCss";
    link.rel = "stylesheet";
    link.href = "css/phone-social.css?v=3.55.8";
    document.head.appendChild(link);
  }
})();
