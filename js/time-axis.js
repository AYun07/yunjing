/* 云境 v6.3.5 · 对话时光轴 TimeAxis
   ------------------------------------------------------------------
   任意回合回档 / 重 roll 的可视入口。数据源 = story-framework 的全量轮次档案
   （IDB，突破 40 轮热栈）+ 内存热栈兜底（老档降级）。每个回合给出三种动作：
     ① 回到本轮前（丢弃本轮及之后）  ② 保留本轮只丢之后  ③ 从此轮重写（原指令重roll）
   回档核心全部走 fw.rewindTo(index, mode)，本模块只负责列表与交互。
   零侵入：删本文件 + 去掉 studio.html 的 2 行引用即回退。 */
(function () {
  'use strict';

  var OVERLAY = 'taOverlay';
  var selected = null;   // 当前选中的轮 index
  var rows = [];         // 当前渲染的轮次数据

  function fw() { return window.storyFramework; }
  function toast(m, t) { try { window.showToast && window.showToast(m, t || 'info'); } catch (e) { } }

  function ensureOverlay() {
    var host = document.getElementById(OVERLAY);
    if (host) return host;
    host = document.createElement('div');
    host.id = OVERLAY;
    host.className = 'ta-overlay';
    host.innerHTML =
      '<div class="ta-top">' +
        '<h2>对话时光轴</h2>' +
        '<span class="ta-sub">选定任意回合：回档 / 保留 / 重写</span>' +
        '<span class="ta-spacer"></span>' +
        '<button class="ta-btn ta-close-x" onclick="TimeAxis.close()">✕ 关闭</button>' +
      '</div>' +
      '<div class="ta-bar" id="taBar"></div>' +
      '<div class="ta-list" id="taList"></div>' +
      '<div class="ta-dock" id="taDock"></div>';
    document.body.appendChild(host);
    return host;
  }

  /** 打开时光轴：合并全量档案 + 热栈，渲染列表 */
  function open() {
    var f = fw();
    var host = ensureOverlay();
    if (!f) { toast('故事引擎未就绪，请刷新页面', 'error'); return; }
    host.classList.add('ta-open');
    render();
  }
  function close() {
    var host = document.getElementById(OVERLAY);
    if (host) host.classList.remove('ta-open');
  }

  /** 汇总可用轮次：以 IDB 全量档案为主，热栈补充缺失的，按 index 升序 */
  function collect(done) {
    var f = fw();
    var hot = (f.storyState.turns || []).slice();
    if (!f.loadTurnArchive) { done(hot, false); return; }
    f.loadTurnArchive().then(function (arc) {
      var map = {};
      (arc || []).forEach(function (x) { if (x && typeof x.index === 'number') map[x.index] = x; });
      hot.forEach(function (x) { if (x && typeof x.index === 'number' && !map[x.index]) map[x.index] = x; });
      var list = Object.keys(map).map(function (k) { return map[k]; });
      list.sort(function (a, b) { return a.index - b.index; });
      done(list, (arc && arc.length) > 0);
    }).catch(function () { done(hot, false); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  function render() {
    collect(function (list, hasArchive) {
      rows = list;
      var f = fw();
      var cur = f && f.currentTurnIndex();
      var bar = document.getElementById('taBar');
      var listEl = document.getElementById('taList');
      var dock = document.getElementById('taDock');
      if (!listEl || !bar || !dock) return;

      var hotOnly = !hasArchive;
      bar.innerHTML =
        '<span class="ta-hint">共 ' + list.length + ' 个可回档回合</span>' +
        (hotOnly
          ? '<span class="ta-warn">当前为老存档，仅有最近 40 轮快照可精确回档；继续游玩后会自动记录全部回合</span>'
          : '<span>本档已记录全部回合，可回档到任意一轮</span>') +
        '<span class="ta-warn">回档为覆盖式：所选回合之后的剧情会被丢弃，且不可撤销</span>';

      if (!list.length) {
        listEl.innerHTML = '<div class="ta-empty">还没有可回档的回合。<br>先和云境聊几轮，这里就会记录下每一个回合。</div>';
        dock.innerHTML = '<button class="ta-btn" onclick="TimeAxis.close()">返回故事</button>';
        return;
      }

      // 默认选中末轮
      if (selected == null || !list.some(function (x) { return x.index === selected; })) {
        selected = cur != null ? cur : list[list.length - 1].index;
      }

      var html = '';
      list.forEach(function (it) {
        var isCur = (it.index === cur);
        var isSel = (it.index === selected);
        var when = it.savedAt ? new Date(it.savedAt).toLocaleString('zh-CN', { hour12: false }) : '';
        html += '<div class="ta-row' + (isSel ? ' sel' : '') + (isCur ? ' cur' : '') + '" data-i="' + it.index + '" onclick="TimeAxis.select(' + it.index + ')">' +
          '<div class="ta-idx">第 ' + (it.index + 1) + ' 轮<small>#' + it.index + '</small></div>' +
          '<div class="ta-main">' +
            '<div class="ta-user"><span class="ta-lbl">你的指令：</span>' + esc(short(it.user || '（无指令）', 90)) + '</div>' +
            '<div class="ta-meta">' + (when ? '<span>🕒 ' + esc(when) + '</span>' : '') +
              (typeof it.histLen === 'number' ? '<span>📜 第 ' + it.histLen + ' 楼前</span>' : '') +
            '</div>' +
            '<div class="ta-acts">' +
              '<button class="ta-mini danger" onclick="event.stopPropagation();TimeAxis.act(' + it.index + ",'before'" + ')">↩ 回到本轮前</button>' +
              '<button class="ta-mini" onclick="event.stopPropagation();TimeAxis.act(' + it.index + ",'after'" + ')">✂ 保留本轮·丢之后</button>' +
              '<button class="ta-mini" onclick="event.stopPropagation();TimeAxis.roll(' + it.index + ')">↻ 从此轮重写</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      listEl.innerHTML = html;

      dock.innerHTML =
        '<span class="ta-sel">已选：第 ' + (selected + 1) + ' 轮</span>' +
        '<button class="ta-btn danger" onclick="TimeAxis.act(selected,\'before\')">↩ 回到本轮前</button>' +
        '<button class="ta-btn" onclick="TimeAxis.act(selected,\'after\')">✂ 保留本轮·丢之后</button>' +
        '<button class="ta-btn primary" onclick="TimeAxis.roll(selected)">↻ 从此轮重写</button>' +
        '<span class="ta-spacer" style="flex:1"></span>' +
        '<button class="ta-btn" onclick="TimeAxis.close()">返回故事</button>';
    });
  }

  function select(index) { selected = index; render(); }

  function guard() {
    var f = fw();
    if (f && f.isProcessing) { toast('✍ 正在创作中，等这段写完再操作哦～', 'info'); return false; }
    if (window.VariableAI && window.VariableAI.pending) { toast('⏳ 变量还在落定，稍等一下再操作', 'info'); return false; }
    return true;
  }

  /** 回档：mode='before' 回到本轮前；'after' 保留本轮只丢之后 */
  function act(index, mode) {
    if (!guard()) return;
    var f = fw();
    if (!f || !f.rewindTo) { toast('回档引擎未就绪，请刷新页面', 'error'); return; }
    var label = mode === 'after' ? '保留第 ' + (index + 1) + ' 轮、丢弃其后的全部剧情' : '删除第 ' + (index + 1) + ' 轮及其后的全部剧情';
    window.UIDialog.confirm({
      title: mode === 'after' ? '保留本轮 · 丢弃之后' : '回档到本轮前',
      message: '将' + label + '，故事状态回到对应节点。\n此操作不可撤销（覆盖式回档），确定继续？',
      danger: true, confirmText: '确定回档', cancelText: '再想想'
    }).then(function (ok) {
      if (!ok) return;
      return f.rewindTo(index, mode).then(function (rr) {
        if (!rr) { toast('该回合快照不可用', 'error'); return; }
        toast('↩ 已回档，故事已还原到所选节点', 'info');
        selected = null;
        close();
        try { window.StudioReplay && window.StudioReplay.replayHistory && window.StudioReplay.replayHistory(); } catch (e) { }
      });
    }).catch(function (e) { toast('回档失败：' + (e && e.message || '未知错误'), 'error'); });
  }

  /** 从此轮重写（原指令重 roll）：丢弃该轮及之后，用该轮原指令重新生成 */
  function roll(index) {
    if (!guard()) return;
    close();
    try { window.StoryInput && window.StoryInput.regenerate(index); }
    catch (e) { toast('重写失败：' + (e && e.message || '未知错误'), 'error'); }
  }

  window.TimeAxis = {
    open: open, close: close, select: select, act: act, roll: roll, render: render,
    _collect: collect
  };
})();
