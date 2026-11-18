/**
 * 云境 · 诗意云开场动画注入器 (v4.36.0)
 * 纯本地，零网络请求。把动画场景注入到 #splash 背后，不改动原有跳过/淡出逻辑。
 * 在 #splash 存在时自动运行；重复调用幂等。
 */
(function () {
  'use strict';
  var ID = 'yj-splash-scene';
  function mount() {
    var splash = document.getElementById('splash');
    if (!splash || document.getElementById(ID)) return;
    // 生成星点
    var stars = '';
    var pts = [
      [12,18,2.4,0],[26,12,3.1,.6],[78,16,2.7,1.2],[88,28,2.2,.3],
      [8,42,3.4,1.8],[94,52,2.6,.9],[18,68,2.1,1.5],[70,10,2.8,2.1],
      [40,8,2.3,.4],[58,20,2.9,1.7],[84,74,2.4,1.1],[6,30,2.7,2.4]
    ];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      stars += '<i style="left:' + p[0] + '%;top:' + p[1] + '%;--dur:' + p[2] + 's;--delay:' + p[3] + 's"></i>';
    }
    var scene = document.createElement('div');
    scene.id = ID;
    scene.className = 'yj-splash-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML =
      '<div class="yj-splash-stars">' + stars + '</div>' +
      '<div class="yj-splash-halo"></div>' +
      '<div class="yj-splash-mist"></div>' +
      '<div class="yj-splash-mist m2"></div>' +
      '<div class="yj-splash-cloud">' +
        '<div class="base"></div><div class="puff a"></div><div class="puff b"></div><div class="puff c"></div>' +
        '<div class="yj-splash-charm"><div class="mini"></div><div class="bow"></div></div>' +
      '</div>';
    splash.insertBefore(scene, splash.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  window.YJSplash = { mount: mount, version: '4.36.0' };
})();
