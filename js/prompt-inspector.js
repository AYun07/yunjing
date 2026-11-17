/* 云境 · 提示词调试器 PromptInspector v1.0.0（v4.18.0）
 * 把 PromptCompiler 已经记录的编译快照可视化——玩家/作者能看到"这一轮模型到底
 * 收到了什么"：分层字符数、档位推断、上下文档、模型、系统提示全文、历史快照。
 * 对"适配各种模型"极有用：一眼看出提示词是否被裁剪、档位是否判对。
 * 纯粹读取 _last/_history，不发任何网络请求。 */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function open() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;background:rgba(6,6,16,.72);backdrop-filter:blur(5px);font-family:"Noto Sans SC",sans-serif;padding:18px;';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(820px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#141124;border:1px solid rgba(201,168,106,.35);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.6);color:#efe9d8;';
    var PC = window.PromptCompiler;
    var last = PC && PC.last ? PC.last() : null;
    var head = '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(201,168,106,.2);"><b style="font-size:16px;">🔬 提示词调试器</b><span style="font-size:11px;opacity:.6;">看这一轮模型到底收到了什么</span><button data-close style="margin-left:auto;padding:6px 12px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:transparent;color:#b9b2c9;cursor:pointer;">关闭 ✕</button></div>';
    var body = document.createElement('div');
    body.style.cssText = 'padding:16px 18px;overflow:auto;';
    if (!last) {
      body.innerHTML = '<p style="opacity:.7;line-height:1.8;">还没有编译记录。先和 AI 推进一轮剧情，再打开这里就能看到本轮提示词的完整构成。</p>';
    } else {
      var s = last.stats || {}, e = last.env || {};
      function row(k, v) { return '<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.07);"><span style="opacity:.6;min-width:110px;">' + k + '</span><span>' + esc(v) + '</span></div>'; }
      body.innerHTML = ''
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'
        +   '<button data-tab="stat" data-on="1" style="padding:7px 14px;border-radius:8px;border:1px solid #c9a86a;background:#c9a86a;color:#1a1530;font-weight:700;cursor:pointer;font-size:12px;">📊 组成概览</button>'
        +   '<button data-tab="sys" style="padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#cfc9dc;cursor:pointer;font-size:12px;">📜 系统提示全文</button>'
        +   '<button data-tab="hist" style="padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#cfc9dc;cursor:pointer;font-size:12px;">🕘 历史快照</button>'
        + '</div>'
        + '<div data-pane="stat" style="font-size:13px;">'
        +   row('编译时间', last.at) + row('耗时', last.ms + ' ms')
        +   row('消息条数', s.messages) + row('总字符数', s.total + '（≈ ' + Math.round((s.total || 0) / 1.6) + ' token）')
        +   row('系统层', s.systemChars + ' 字符 / ' + s.systemBlocks + ' 块')
        +   row('历史层', s.historyChars + ' 字符') + row('本轮输入', s.userChars + ' 字符')
        +   row('模型档位', e.tier + '（上下文档：' + e.ctxTier + '）')
        +   row('模型', (e.model || '未配置') + ' · maxTokens=' + (e.maxTokens == null ? '?' : e.maxTokens))
        +   row('世界 / 立场', (e.genre || '?') + ' / ' + (e.stance || '?'))
        +   row('变量AI / 向量', (e.varAI ? '开' : '关') + ' / ' + (e.kbVector ? '开' : '关'))
        + '</div>'
        + '<div style="margin-top:16px;padding:12px;border:1px solid rgba(201,168,106,.25);border-radius:10px;background:rgba(201,168,106,.05);">'
        +   '<div style="font-size:12px;font-weight:700;margin-bottom:8px;">💰 成本估算（按你自填的单价，产品不内置价格）</div>'
        +   '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;">'
        +     '<label>输入 <input data-rate-in type="number" min="0" step="0.1" placeholder="元/百万token" style="width:120px;padding:5px 8px;border-radius:6px;background:#0e0c1c;color:#efe9d8;border:1px solid #3a3550;"></label>'
        +     '<label>输出 <input data-rate-out type="number" min="0" step="0.1" placeholder="元/百万token" style="width:120px;padding:5px 8px;border-radius:6px;background:#0e0c1c;color:#efe9d8;border:1px solid #3a3550;"></label>'
        +     '<button data-cost style="padding:6px 12px;border:1px solid #c9a86a;border-radius:7px;background:#c9a86a;color:#1a1530;font-weight:700;cursor:pointer;">估算</button>'
        +   '</div>'
        +   '<div data-cost-out style="margin-top:8px;font-size:12px;line-height:1.7;opacity:.85;"></div>'
        + '</div>'
        + '<div data-pane="sys" style="display:none;"><pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.7;background:#0e0c1c;border:1px solid #2c5a54;border-radius:10px;padding:14px;max-height:56vh;overflow:auto;color:#bfe6dd;">' + esc(last.preview || '') + '</pre><p style="font-size:11px;opacity:.5;">（这里是最多 2000 字的预览节选；完整系统提示已实际发给模型）</p></div>'
        + '<div data-pane="hist" style="display:none;">' + renderHist(PC && PC.history ? PC.history() : []) + '</div>';
      // tab 切换
      var tabs = body.querySelectorAll('[data-tab]');
      tabs.forEach(function (t) {
        t.onclick = function () {
          tabs.forEach(function (x) { var on = x === t; x.style.background = on ? '#c9a86a' : 'transparent'; x.style.color = on ? '#1a1530' : '#cfc9dc'; x.style.fontWeight = on ? '700' : '400'; x.style.borderColor = on ? '#c9a86a' : 'rgba(255,255,255,.2)'; });
          body.querySelectorAll('[data-pane]').forEach(function (p) { p.style.display = p.getAttribute('data-pane') === t.getAttribute('data-tab') ? '' : 'none'; });
        };
      });
      // 成本估算
      var costBtn = body.querySelector('[data-cost]');
      if (costBtn) costBtn.onclick = function () {
        var rin = Number(body.querySelector('[data-rate-in]').value) || 0;
        var rout = Number(body.querySelector('[data-rate-out]').value) || 0;
        var out = body.querySelector('[data-cost-out]');
        if (!window.TokenUsage || !TokenUsage.estimateCost) { out.textContent = '当前版本不支持成本估算。'; return; }
        var r = TokenUsage.estimateCost({ in: rin, out: rout });
        var st = TokenUsage.get();
        var lines = ['本会话累计：输入 ' + (st.total.inTok || 0) + ' token / 输出 ' + (st.total.outTok || 0) + ' token / ' + (st.total.requests || 0) + ' 次请求'];
        lines.push('本次对话估算：<b style="color:#e0c04c;">¥' + r.total.toFixed(4) + '</b>（输入 ¥' + r.inCost.toFixed(4) + ' + 输出 ¥' + r.outCost.toFixed(4) + '）');
        var tags = Object.keys(r.byTag || {});
        if (tags.length) lines.push('按接口：' + tags.map(function (t) { return t + ' ¥' + r.byTag[t].toFixed(4); }).join(' · '));
        out.innerHTML = lines.join('<br>');
      };
    }
    box.innerHTML = head;
    box.appendChild(body);
    ov.appendChild(box); document.body.appendChild(ov);
    box.querySelector('[data-close]').onclick = function () { ov.remove(); };
    ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
  }
  function renderHist(hist) {
    if (!hist || !hist.length) return '<p style="opacity:.6;">暂无历史快照。</p>';
    return hist.slice().reverse().map(function (h) {
      return '<div style="padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.08);font-size:12px;">'
        + '<b>' + esc(h.at) + '</b> · ' + esc(h.stats && h.stats.total) + ' 字符 · ' + esc(h.env && h.env.tier) + ' 档 · ' + esc(h.env && h.env.model || '') + '</div>';
    }).join('');
  }
  window.PromptInspector = { open: open };
})();
