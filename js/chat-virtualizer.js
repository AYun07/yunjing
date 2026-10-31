/* 云境 · 聊天虚拟化器（v3.55.22 · 几千楼不卡顿）
   ------------------------------------------------------------------
   问题：几千轮对话时，replayHistory 把全部 conversationHistory 逐条 appendChild
   进 #chatMessages，意味着几千个真实 DOM 节点常驻 —— 首屏慢、滚动卡、内存炸。
   本模块让 #chatMessages 只渲染「可视窗口」（默认 60 楼）+ 顶部哨兵，上滚按需
   prepend 旧楼并锚定滚动位置。无论总楼数多少，DOM 节点数恒定有界（≈ WINDOW+BATCH）。

   设计：
   - floors[] 是完整楼层的【内存】镜像（与 conversationHistory 平行），含预解析部件
     {role, content, body, block, options, vars, label, turn}，重渲染时复用，避免重解析副作用。
   - 渲染只调用既有的 StoryResponseHandler.render*（单一卡片 HTML 来源），仅加 noScroll/turnOverride。
   - 实时轮：handler 照旧 append 单节点；虚拟器把该楼记入 floors[] 并做 DOM 上限裁剪。
   - 上滚到顶：切换为窗口重建（从 floors[] 重画 WINDOW 楼），滚动位置锚定。
   - 全程优雅降级：虚拟器未挂载时，handler 走原始 appendChild 路径，行为不变。 */
(function () {
  'use strict';

  const WINDOW = 60;   // 可视窗口楼数
  const BATCH = 40;    // 每次上滚加载的旧楼数
  const MAX_DOM = WINDOW + BATCH + 6; // DOM 节点硬上限（含哨兵）

  const ChatVirtualizer = {
    container: null,
    floors: [],
    turns: [],
    fw: null,
    start: 0,         // 当前窗口首楼下标
    active: false,
    _scrolling: false,
    _sentinel: null,

    /* ============ 挂载（读档恢复时调用，替代全量 replayHistory） ============ */
    mount(history, turns, fw) {
      this.fw = fw || window.storyFramework;
      this.turns = turns || (this.fw && this.fw.storyState.turns) || [];
      this.container = document.getElementById('chatMessages');
      if (!this.container) return;
      // 还原 turns[].histLen（旧档可能未持久化该字段），供 _turnForFloor 正确打轮次标签
      let cursor = 0;
      const hist = history || [];
      for (let i = 0; i < hist.length; i++) {
        if (hist[i] && hist[i].role === 'user') {
          const t = this.turns[cursor];
          if (t && t.histLen == null) t.histLen = i;
          cursor++;
        }
      }
      this.floors = hist.map((m, i) => this._cache(i, m));
      this.start = Math.max(0, this.floors.length - WINDOW);
      this.active = true;
      // 先清回放游标再渲染：tagTurnCard 优先读 replayTurnCursor，
      // 不清会让窗口内所有卡片被打成同一（陈旧）轮次标签
      if (this.fw) this.fw.replayTurnCursor = null;
      this._renderWindow();
      this._bindScroll();
      document.dispatchEvent(new Event('chat-virtualizer:mounted'));
    },

    /* 把一条消息预解析成缓存条目（首次渲染时调用，之后窗口化重渲染直接复用） */
    _cache(i, m) {
      const role = m.role;
      const content = m.content;
      const turn = this._turnForFloor(i);
      const entry = { role, content, turn };
      if (role === 'assistant') {
        const H = window.StoryResponseHandler;
        const parser = window.VariableInstructionParser;
        const raw = (window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.preParse)
          ? window.MoMiaomiaoRegex.preParse(content) : content;
        entry.block = parser && parser.extractUpdateBlock ? parser.extractUpdateBlock(raw) : null;
        entry.options = H && H.extractOptions ? H.extractOptions(raw) : [];
        entry.label = H && H.detectOptionsLabel ? H.detectOptionsLabel(raw) : '情节走向';
        entry.body = H && H.extractBody ? H.extractBody(raw, entry.options) : raw;
        entry.vars = (this.fw && this.fw.storyState.variables) || {};
      }
      return entry;
    },

    /* 由 turns[].histLen 推断第 i 楼归属的轮次（用于卡片 turn 标签 / 回退） */
    _turnForFloor(i) {
      const turns = this.turns;
      if (!turns || !turns.length) return null;
      let t = null;
      for (let k = 0; k < turns.length; k++) {
        const hl = turns[k] && typeof turns[k].histLen === 'number' ? turns[k].histLen : null;
        if (hl === null) continue;
        if (hl <= i) t = k;
        else break;
      }
      return t;
    },

    /* ============ 窗口渲染 ============ */
    _renderWindow(scrollToBottom) {
      const c = this.container;
      if (!c) return;
      c.innerHTML = '';
      // 顶部哨兵（上滚加载旧楼 / 提示）
      const sent = document.createElement('div');
      sent.className = 'cv-sentinel cv-top';
      sent.id = 'cvTopSentinel';
      this._sentinel = sent;
      c.appendChild(sent);
      const end = Math.min(this.floors.length, this.start + WINDOW);
      for (let i = this.start; i < end; i++) this._renderFloor(i);
      this._updateSentinel();
      // 仅挂载时定位到底部；上滚重建时由调用方锚定，不跳底
      if (scrollToBottom !== false) c.scrollTop = c.scrollHeight;
    },

    _renderFloor(i) {
      const f = this.floors[i];
      if (!f) return;
      const H = window.StoryResponseHandler;
      if (!H) return;
      const opts = { live: false, noScroll: true, turnOverride: f.turn, fromVirtualizer: true };
      if (f.role === 'user') {
        H.renderUserMessage(f.content, opts);
      } else if (f.role === 'assistant') {
        H.renderStoryMessage(f.body, f.block, f.options, f.vars, f.label, opts);
      } else if (f.role === 'system') {
        H.renderSystemMessage(f.content, 'info', opts);
      }
    },

    _updateSentinel() {
      const s = this._sentinel;
      if (!s) return;
      const older = this.start;
      if (older > 0) {
        s.style.display = '';
        s.innerHTML = `↑ 上方还有 ${older} 楼未显示 · 点击或滚动到顶加载更早`;
        s.onclick = () => this._loadOlder();
      } else {
        s.style.display = 'none';
        s.onclick = null;
      }
    },

    /* ============ 上滚加载旧楼（锚定滚动位置） ============ */
    _loadOlder() {
      if (this.start <= 0) return;
      const c = this.container;
      const prevScroll = c.scrollHeight - c.scrollTop; // 距底距离
      this.start = Math.max(0, this.start - BATCH);
      this._renderWindow(false); // 不跳底，由下方锚定
      // 锚定：保持视口内容不跳变（按距底距离还原）
      c.scrollTop = c.scrollHeight - prevScroll;
    },

    /* ============ 实时追加（handler 在生成新楼、自己 appendChild 之后调用） ============
       约定：卡片已由 handler 挂到 #chatMessages 底部，本方法只做「状态同步 + DOM 上限裁剪」。
       entry 含预解析部件，供上滚窗口重建时复用，避免重解析副作用。 */
    onAppendLive(entry) {
      if (!this.active || !this.container) return;
      const c = this.container;
      const i = this.floors.length;
      this.floors.push(entry || this._cache(i, { role: 'assistant', content: '' }));
      // 仅跟随态（停在底部）才裁剪顶部旧楼 + 滚到底；阅读历史时不打扰视口
      if (this._atBottom()) {
        c.scrollTop = c.scrollHeight;
        this._capDom();
      }
      this._updateSentinel();
    },

    _atBottom() {
      const c = this.container;
      if (!c) return true;
      return c.scrollHeight - c.scrollTop - c.clientHeight < 80;
    },

    /* DOM 硬上限裁剪：超出 MAX_DOM 时从顶部（哨兵之后）删节点，floors[] 不丢。
       仅在跟随态（底部）调用，绝不裁掉正在阅读的旧楼。
       start 同步推进：DOM 首楼已变成 start+被裁数，窗口重建时不能错位。 */
    _capDom() {
      const c = this.container;
      if (!c) return;
      let capped = 0;
      while (c.children.length > MAX_DOM) {
        if (c.children[1]) { c.removeChild(c.children[1]); capped++; }
        else break;
      }
      if (capped) this.start = Math.min(this.start + capped, this.floors.length);
    },

    _bindScroll() {
      const c = this.container;
      if (!c || this._scrolling) return;
      this._scrolling = true;
      let ticking = false;
      c.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        setTimeout(() => {
          ticking = false;
          if (c.scrollTop < 90 && this.start > 0) this._loadOlder();
        }, 120);
      }, { passive: true });
    },

    /* 由外部（如读档恢复竞态）触发整体重挂 */
    remount() {
      if (this.fw) this.mount(this.fw.storyState.conversationHistory, this.fw.storyState.turns, this.fw);
    },

    /* 取当前 DOM 子节点数（测试/诊断用） */
    domCount() {
      return this.container ? this.container.children.length : 0;
    },

    /* 当前总楼数 */
    total() { return this.floors.length; }
  };

  window.ChatVirtualizer = ChatVirtualizer;
})();
