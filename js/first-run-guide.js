/* 云境 · 首次进入引导 FirstRunGuide v1.0.0（v4.18.0）
 * 目的：新玩家打开大厅后，用 3 步轻引导告诉他「云境是什么 / 先配接口 / 怎么开局」。
 * 纪律：
 *   ① 只在第一次进入显示，localStorage 记忆，老玩家零打扰；
 *   ② 配置接口按钮深链到创作室的接口设置（携带 fromGuide 标记）；
 *   ③ 随时可跳过；不阻断、不改世界卡片、不影响小云；
 *   ④ 自包含样式，避免改动大厅主题 CSS。 */
(function () {
  'use strict';
  var KEY = 'yunjingFirstRunGuideDone';

  function done() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markDone() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }

  var STEPS = [
    {
      icon: '🌌',
      title: '欢迎来到云境',
      body: '这里把「和 AI 一起写小说」和「跑一个会自己演化的世界」缝在同一个网页。38 个世界任选，故事与数据只留你这台设备，不上传、不要账号。'
    },
    {
      icon: '⚙️',
      title: '先接一路 AI',
      body: '云境不自带模型——填上你自己的 API（任意 OpenAI 兼容端点都行，官方/中转/本地皆可）。填一次，全程通用。'
    },
    {
      icon: '📖',
      title: '选个世界开局',
      body: '点开任意世界卡，捏一个身份踏进去。世界时钟会自转，NPC、势力、机缘会自己演化，你的选择会写回世界。玩得开心！'
    }
  ];

  function show() {
    // v7.0 幂等守卫：开场动画承担欢迎职责后会标记 done()；已排队延时回调到这里再拦一道，
    // 避免动画播完/跳过后引导框突然盖住封面页，破坏无缝接入。正常新玩家 done()=false 不受影响。
    if (done()) return;
    if (!document.body || document.getElementById('yjFirstGuide')) return;
    var step = 0;
    var wrap = document.createElement('div');
    wrap.id = 'yjFirstGuide';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;background:rgba(8,7,20,.66);backdrop-filter:blur(6px);font-family:"Noto Sans SC","PingFang SC",sans-serif;padding:20px;';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(460px,94vw);background:linear-gradient(165deg,rgba(32,27,58,.98),rgba(18,16,34,.99));border:1px solid rgba(201,168,106,.35);border-radius:20px;box-shadow:0 30px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);color:#f2efe4;overflow:hidden;';
    wrap.appendChild(box);

    function render() {
      var s = STEPS[step];
      box.innerHTML = ''
        + '<div style="padding:26px 28px 8px;display:flex;align-items:center;gap:12px;">'
        +   '<div style="font-size:38px;line-height:1;">' + s.icon + '</div>'
        +   '<div style="font-size:12px;letter-spacing:.18em;color:#c9a86a;">新手引导 · ' + (step + 1) + '/' + STEPS.length + '</div>'
        + '</div>'
        + '<h2 style="margin:6px 28px 10px;font-size:22px;letter-spacing:.04em;">' + s.title + '</h2>'
        + '<p style="margin:0 28px 20px;font-size:14px;line-height:1.85;color:#cfc9dc;min-height:78px;">' + s.body + '</p>'
        + '<div style="display:flex;gap:8px;justify-content:center;margin:0 0 12px;">'
        +   STEPS.map(function (_, i) { return '<i style="width:7px;height:7px;border-radius:50%;display:inline-block;background:' + (i === step ? '#c9a86a' : 'rgba(255,255,255,.2)') + ';"></i>'; }).join('')
        + '</div>'
        + '<div style="display:flex;gap:10px;padding:0 28px 26px;">'
        +   '<button data-skip style="flex:0 0 auto;padding:11px 14px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:transparent;color:#9a94b0;cursor:pointer;font-size:13px;">跳过</button>'
        +   '<button data-next style="flex:1;padding:11px;border:1px solid #c9a86a;border-radius:10px;background:linear-gradient(135deg,#c9a86a,#a8863f);color:#1a1530;font-weight:700;cursor:pointer;font-size:14px;">' + (step === STEPS.length - 1 ? '开始探索 →' : '下一步 →') + '</button>'
        + '</div>';
      box.querySelector('[data-skip]').onclick = close;
      box.querySelector('[data-next]').onclick = function () {
        if (step < STEPS.length - 1) { step++; render(); return; }
        close();
        // 走到最后一步：跳到创作室并打开接口设置
        try { location.href = 'studio.html?v=7.6.2&fromGuide=1'; } catch (e) {}
      };
    }

    function close() {
      try { markDone(); } catch (e) {}
      /* v7.0.0 组1-T04：引导层 z-index:10060，关闭瞬间先撤掉层级与命中再移除节点；
         若节点残留会整页吞点击。老内核 remove 不可用时用 removeChild 兜底。 */
      try { wrap.style.pointerEvents = 'none'; wrap.style.zIndex = '-1'; } catch (e) {}
      try {
        if (wrap.remove) wrap.remove();
        else if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      } catch (e) {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    }
    render();
    document.body.appendChild(wrap);
  }

  // splash 消失后（约 0.6s）再弹引导，避免与开屏动画打架；用点击/计时双触发取先到者。
  function boot() {
    if (done()) return;
    var fired = false;
    function once() { if (fired) return; fired = true; setTimeout(show, 400); }
    document.addEventListener('click', once, { once: true });
    setTimeout(once, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FirstRunGuide = { show: show, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} } };
})();
