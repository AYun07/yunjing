/* 大厅风格切换坞：六套设计一键切换，选择记忆在本机 */
(function () {
  var STYLES = [
    { n: '雲境·志', tag: '壹 · 杂志编辑', c: '#e0455a', file: 'lobby-demo-editorial.html' },
    { n: '拼贴手帐', tag: '贰 · Zine', c: '#e8896b', file: 'lobby-demo-zine.html' },
    { n: 'Y2K 未来', tag: '叁 · 复古未来', c: '#7fd4ff', file: 'lobby-demo-y2k.html' },
    { n: '国风水墨', tag: '肆 · 书卷', c: '#8a7a5c', file: 'lobby-demo-ink.html' },
    { n: '瑞士极简', tag: '伍 · Swiss', c: '#e63312', file: 'lobby-demo-swiss.html' },
    { n: '终端 Code', tag: '陆 · Terminal', c: '#3dff7c', file: 'lobby-demo-term.html' }
  ];
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  var path = location.pathname.split('/').pop();
  var cur = STYLES.findIndex(function (s) { return s.file === path; });
  try { localStorage.setItem('xy_style', cur >= 0 ? String(cur) : localStorage.getItem('xy_style') || '0'); } catch (e) {}

  var dock = el('div', 'ls-dock');
  var btn = el('button', 'ls-btn', '◑'); btn.title = '切换大厅风格';
  var panel = el('div', 'ls-panel');
  panel.appendChild(el('div', 'ls-cap', '大厅风格 · 共 ' + STYLES.length + ' 套'));
  STYLES.forEach(function (s, i) {
    var it = el('div', 'ls-item' + (i === cur ? ' on' : ''));
    it.innerHTML = '<i style="background:' + s.c + '"></i><b>' + s.n + '</b><span>' + s.tag + '</span>' + (i === cur ? '<em>当前</em>' : '');
    it.onclick = function () {
      try { localStorage.setItem('xy_style', String(i)); } catch (e) {}
      if (i !== cur) location.href = s.file;
    };
    panel.appendChild(it);
  });
  dock.appendChild(panel); dock.appendChild(btn);
  document.body.appendChild(dock);
  btn.addEventListener('click', function () { panel.classList.toggle('on'); });
  document.addEventListener('click', function (e) { if (!dock.contains(e.target)) panel.classList.remove('on'); });
})();
