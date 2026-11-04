/* 云境大厅主题切换器 · v3.90.0
   8 套主题全部从 11-04 新设计稿提炼，真实作用于 index.html 的 33 界卡片 DOM。
   选择记忆在 localStorage，支持 ?theme=<id> 直达。无任何假链接、不跳新页面。 */
(function () {
  var THEMES = [
    { id: 'colorful',  name: '彩云主演', sw: 'linear-gradient(135deg,#283a8f,#c06fd0)' },
    { id: 'compass',   name: '幻海罗盘', sw: 'linear-gradient(135deg,#1a1530,#b9a7ff)' },
    { id: 'carousel',  name: '星轨轮播', sw: 'linear-gradient(135deg,#0c0a12,#7fd6c8)' },
    { id: 'film',      name: '胶片映画', sw: 'linear-gradient(135deg,#14111f,#e0a84c)' },
    { id: 'hero',      name: '巨幕主角', sw: 'linear-gradient(135deg,#14111f,#c9a7ff)' },
    { id: 'scroll',    name: '卷轴长廊', sw: 'linear-gradient(135deg,#23202e,#b9a7ff)' },
    { id: 'sidebar',   name: '侧栏书页', sw: 'linear-gradient(135deg,#171b22,#7fd6c8)' },
    { id: 'avatar',    name: '形象馆',   sw: 'linear-gradient(135deg,#16121f,#8ab4c8)' }
  ];
  var KEY = 'yunjingLobbyTheme';
  var DEFAULT = 'colorful';

  function valid(id) { return THEMES.some(function (t) { return t.id === id; }); }
  function read() {
    try {
      var u = new URLSearchParams(location.search).get('theme');
      if (valid(u)) return u;
      var s = localStorage.getItem(KEY);
      if (valid(s)) return s;
    } catch (e) {}
    return DEFAULT;
  }
  function apply(id) {
    document.documentElement.dataset.theme = id;
    if (document.body) document.body.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    var name = (THEMES.filter(function (t) { return t.id === id; })[0] || {}).name || '主题';
    var lbl = document.querySelector('.theme-switcher .ts-name-cur');
    if (lbl) lbl.textContent = name;
    var items = document.querySelectorAll('.theme-switcher .ts-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('on', items[i].getAttribute('data-theme') === id);
    }
  }

  function build() {
    if (!document.body || document.querySelector('.theme-switcher')) return;
    var wrap = document.createElement('div');
    wrap.className = 'theme-switcher';
    var btn = document.createElement('button');
    btn.className = 'ts-btn'; btn.type = 'button';
    btn.innerHTML = '<span class="ts-dot"></span><span>主题</span><span class="ts-name-cur"></span><span style="opacity:.6">▾</span>';
    var panel = document.createElement('div');
    panel.className = 'ts-panel';
    THEMES.forEach(function (t) {
      var it = document.createElement('button');
      it.className = 'ts-item'; it.type = 'button'; it.setAttribute('data-theme', t.id);
      it.innerHTML = '<span class="ts-sw" style="background:' + t.sw + '"></span>' +
                     '<span class="ts-name">' + t.name + '</span><span class="ts-tick">✓</span>';
      it.addEventListener('click', function () {
        apply(t.id);
        panel.classList.remove('on');
        var u = new URL(location.href); u.searchParams.set('theme', t.id);
        try { history.replaceState(null, '', u); } catch (e) {}
      });
      panel.appendChild(it);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('on');
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) panel.classList.remove('on');
    });
    wrap.appendChild(btn); wrap.appendChild(panel);
    document.body.appendChild(wrap);
    apply(read());
  }

  // 变量挂在 html(:root)，head 内同步执行即可生效，首屏不闪色
  document.documentElement.dataset.theme = read();
  if (document.body) document.body.dataset.theme = read();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  // 暴露给自检/测试
  window.YunjingLobbyThemes = { list: THEMES, apply: apply,
    current: function () { return document.documentElement.dataset.theme; } };
})();
