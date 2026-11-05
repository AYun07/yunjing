/* 云境大厅主题切换器 · v3.92.0
   只保留同一批原创的六种美术风格（原稿 v3.84.0 的 lobby-demo-*.html）：
   杂志·雲境志 / 拼贴手帐 / Y2K / 国风水墨 / 瑞士极简 / 终端 Code。
   旧 8 套深紫玻璃版式（colorful/compass/carousel/film/hero/scroll/sidebar/avatar）
   已全部删除——旧 localStorage / ?theme= 值若命中旧 id，一律回退到默认主题。
   选择记忆在 localStorage，支持 ?theme=<id> 直达。不跳新页面、不造假链接。 */
(function () {
  var THEMES = [
    { id: 'editorial', name: '壹 · 雲境志', sw: 'linear-gradient(135deg,#0d0e14,#e0455a)' },
    { id: 'zine',      name: '贰 · 拼贴手帐', sw: 'linear-gradient(135deg,#f4ecdc,#7ec98f)' },
    { id: 'y2k',       name: '叁 · Y2K 未来', sw: 'linear-gradient(135deg,#080828,#66d9ff)' },
    { id: 'ink',       name: '肆 · 国风水墨', sw: 'linear-gradient(135deg,#f7f3e9,#a83232)' },
    { id: 'swiss',     name: '伍 · 瑞士极简', sw: 'linear-gradient(135deg,#fbfbf9,#e63312)' },
    { id: 'term',      name: '陆 · 终端 Code', sw: 'linear-gradient(135deg,#040a05,#7dff9b)' }
  ];
  var KEY = 'yunjingLobbyTheme';
  var DEFAULT = 'zine';

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
