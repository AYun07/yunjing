/* 云境 · 主题工坊 v1.0.0（v3.53.0）
   ────────────────────────────────────────────────────────────────
   解决一件事：33 界皮肤管「世界是什么味道」，这里管「这本书怎么读」。
   · 内置 6 套阅读外观（跟随世界 / 宣纸墨韵 / 深宵青瓷 / 霓虹夜航 / 森野苔痕 / 琥珀暖灯 / 极简白纸）
   · 每套只给一组 CSS 变量 + 一条结构规则，换肤零重排（不重建 DOM，不掉状态）
   · 支持导入导出：JSON 主题包可只带变量，也可附一段自定义 CSS（仅视觉规则，自动过滤危险写法）
   · 首屏同步生效：head 里加载本文件即立刻 apply，不会先闪一下默认配色
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var KEY = 'yunjingTheme';
  var CSS_ID = 'yjThemeVars';
  var CUSTOM_CSS_ID = 'yjThemeCustomCss';

  /* 质感变量（yunjing-theme.css 里的结构规则消费它们）：
     主题只赋值，结构只写一次 —— 新增主题不需要动 CSS */
  var BUILTIN = [
    {
      id: 'auto', name: '跟随世界', icon: '🌏', base: 'auto',
      desc: '保留 33 界原有配色与纹理，只叠加排版精修。换世界就换味道。',
      swatch: ['#e0a84c', '#1c2030', '#12141d'],
      vars: {}
    },
    {
      id: 'ink', name: '宣纸墨韵', icon: '📜', base: 'light',
      desc: '米白纸面、宋体正文、细墨线。白天读长篇最不费眼。',
      swatch: ['#8a6a3b', '#fffdf6', '#f3ecdd'],
      vars: {
        '--bg': '#f3ecdd', '--bg-soft': '#efe6d4', '--panel': '#fffdf6', '--panel-2': '#f7f1e3',
        '--panel-border': 'rgba(122, 92, 46, .22)', '--line': 'rgba(70, 56, 34, .13)',
        '--text': '#2a2620', '--text-muted': '#6b6253', '--text-faint': '#9a917f',
        '--primary': '#8a6a3b', '--primary-dim': 'rgba(138, 106, 59, .1)', '--primary-glow': 'rgba(138, 106, 59, .22)',
        '--secondary': '#6d8570', '--accent': '#a06a3c', '--danger': '#a8443a', '--ok': '#4d7a5c',
        '--paper-text': '#fdfaf2',
        '--yj-body-bg': 'radial-gradient(ellipse 900px 520px at 50% -10%, rgba(160, 130, 80, .07), transparent 65%), #f3ecdd',
        '--yj-card-bg': 'linear-gradient(180deg, #fffdf6, #fbf5e7)',
        '--yj-card-border': '1px solid rgba(122, 92, 46, .2)',
        '--yj-card-shadow': '0 1px 0 rgba(255,255,255,.9) inset, 0 6px 18px rgba(90, 70, 40, .07)',
        '--yj-radius-card': '4px', '--yj-radius-btn': '3px',
        '--yj-title-space': '.14em', '--yj-line-height': '2.18', '--yj-motion': '.8',
        '--yj-btn-bg': 'linear-gradient(180deg, #8a6a3b, #75582f)',
        '--yj-font-body': "var(--serif)"
      }
    },
    {
      id: 'midnight', name: '深宵青瓷', icon: '🌙', base: 'dark',
      desc: '近黑的夜蓝配青瓷釉，低对比、低存在感，凌晨三点也不刺眼。',
      swatch: ['#7fb3a8', '#151b23', '#0d1117'],
      vars: {
        '--bg': '#0d1117', '--bg-soft': '#111720', '--panel': '#151b23', '--panel-2': '#1a222c',
        '--panel-border': 'rgba(127, 179, 168, .14)', '--line': 'rgba(200, 214, 224, .07)',
        '--text': '#c9d4dd', '--text-muted': '#8b98a4', '--text-faint': '#5d6874',
        '--primary': '#7fb3a8', '--primary-dim': 'rgba(127, 179, 168, .1)', '--primary-glow': 'rgba(127, 179, 168, .22)',
        '--secondary': '#7f97b3', '--accent': '#a98f6a',
        '--paper-text': '#0f141a',
        '--yj-body-bg': 'radial-gradient(ellipse 820px 500px at 20% -8%, rgba(127, 179, 168, .07), transparent 62%), #0d1117',
        '--yj-card-bg': 'linear-gradient(180deg, rgba(21,27,35,.96), rgba(17,23,32,.96))',
        '--yj-card-border': '1px solid rgba(127, 179, 168, .13)',
        '--yj-card-shadow': '0 10px 30px rgba(0, 0, 0, .45)',
        '--yj-radius-card': '14px', '--yj-radius-btn': '10px',
        '--yj-title-space': '.2em', '--yj-line-height': '2.12', '--yj-motion': '1',
        '--yj-btn-bg': 'linear-gradient(135deg, #8fc4b8, #6fa398)'
      }
    },
    {
      id: 'cyber', name: '霓虹夜航', icon: '🌆', base: 'dark',
      desc: '深紫夜色、青粉双霓虹、玻璃拟态。赛博与废土世界的本命皮肤。',
      swatch: ['#21d4fd', '#140d24', '#0a0714'],
      vars: {
        '--bg': '#0a0714', '--bg-soft': '#0e0a1c', '--panel': '#140d24', '--panel-2': '#1b1230',
        '--panel-border': 'rgba(33, 212, 253, .2)', '--line': 'rgba(160, 190, 255, .1)',
        '--text': '#e6e9f5', '--text-muted': '#9aa3c0', '--text-faint': '#666e8c',
        '--primary': '#21d4fd', '--primary-dim': 'rgba(33, 212, 253, .12)', '--primary-glow': 'rgba(33, 212, 253, .38)',
        '--secondary': '#ff4ecd', '--accent': '#9d6cff',
        '--paper-text': '#08050f',
        '--yj-body-bg': 'radial-gradient(ellipse 700px 460px at 10% -10%, rgba(33,212,253,.16), transparent 60%), radial-gradient(ellipse 700px 460px at 95% 110%, rgba(255,78,205,.14), transparent 60%), #0a0714',
        '--yj-card-bg': 'linear-gradient(160deg, rgba(33,212,253,.06), rgba(255,78,205,.04) 55%, rgba(20,13,36,.9))',
        '--yj-card-border': '1px solid rgba(33, 212, 253, .22)',
        '--yj-card-shadow': '0 0 0 1px rgba(33,212,253,.06), 0 12px 34px rgba(0, 0, 0, .5), 0 0 40px rgba(33,212,253,.07)',
        '--yj-radius-card': '16px', '--yj-radius-btn': '12px',
        '--yj-title-space': '.22em', '--yj-line-height': '2.06', '--yj-motion': '1.25',
        '--yj-btn-bg': 'linear-gradient(135deg, #21d4fd, #7b5cff)'
      }
    },
    {
      id: 'verdant', name: '森野苔痕', icon: '🌿', base: 'dark',
      desc: '墨绿与苔色，柔和的圆角与纸感。武侠、田园、治愈向长文很配。',
      swatch: ['#9dbb7a', '#1a211a', '#121712'],
      vars: {
        '--bg': '#121712', '--bg-soft': '#151b15', '--panel': '#1a211a', '--panel-2': '#20291f',
        '--panel-border': 'rgba(157, 187, 122, .16)', '--line': 'rgba(210, 224, 190, .08)',
        '--text': '#dfe6d6', '--text-muted': '#a3ad96', '--text-faint': '#6d7864',
        '--primary': '#9dbb7a', '--primary-dim': 'rgba(157, 187, 122, .1)', '--primary-glow': 'rgba(157, 187, 122, .24)',
        '--secondary': '#8aa7a0', '--accent': '#c0a06a',
        '--paper-text': '#111710',
        '--yj-body-bg': 'radial-gradient(ellipse 780px 480px at 15% -8%, rgba(157,187,122,.08), transparent 60%), #121712',
        '--yj-card-bg': 'linear-gradient(180deg, rgba(26,33,26,.97), rgba(20,26,20,.97))',
        '--yj-card-border': '1px solid rgba(157, 187, 122, .15)',
        '--yj-card-shadow': '0 8px 26px rgba(0, 0, 0, .38)',
        '--yj-radius-card': '18px', '--yj-radius-btn': '14px',
        '--yj-title-space': '.18em', '--yj-line-height': '2.16', '--yj-motion': '1',
        '--yj-btn-bg': 'linear-gradient(135deg, #a9c988, #86a869)'
      }
    },
    {
      id: 'amber', name: '琥珀暖灯', icon: '🕯', base: 'dark',
      desc: '琥珀与旧铜，像台灯下的旧书。冬夜、悬疑、年代文的首选。',
      swatch: ['#e8b46a', '#241a11', '#1a120b'],
      vars: {
        '--bg': '#1a120b', '--bg-soft': '#1f160e', '--panel': '#241a11', '--panel-2': '#2d2116',
        '--panel-border': 'rgba(232, 180, 106, .18)', '--line': 'rgba(240, 220, 190, .08)',
        '--text': '#f0e4d2', '--text-muted': '#b9a68d', '--text-faint': '#7d6d5a',
        '--primary': '#e8b46a', '--primary-dim': 'rgba(232, 180, 106, .12)', '--primary-glow': 'rgba(232, 180, 106, .3)',
        '--secondary': '#b08d6a', '--accent': '#c98b4b',
        '--paper-text': '#1a120b',
        '--yj-body-bg': 'radial-gradient(ellipse 760px 460px at 50% -12%, rgba(232,180,106,.13), transparent 62%), #1a120b',
        '--yj-card-bg': 'linear-gradient(180deg, rgba(36,26,17,.97), rgba(28,20,13,.97))',
        '--yj-card-border': '1px solid rgba(232, 180, 106, .17)',
        '--yj-card-shadow': '0 10px 28px rgba(0, 0, 0, .45), 0 0 60px rgba(232,180,106,.05)',
        '--yj-radius-card': '12px', '--yj-radius-btn': '9px',
        '--yj-title-space': '.24em', '--yj-line-height': '2.14', '--yj-motion': '.95',
        '--yj-btn-bg': 'linear-gradient(135deg, #f0c684, #d09b52)'
      }
    },
    {
      id: 'paper', name: '极简白纸', icon: '📄', base: 'light',
      desc: '纯白、无阴影、无渐变、无花纹。只留下字，适合校对与打印。',
      swatch: ['#3a3a3a', '#ffffff', '#fafafa'],
      vars: {
        '--bg': '#fafafa', '--bg-soft': '#f4f4f4', '--panel': '#ffffff', '--panel-2': '#f7f7f7',
        '--panel-border': 'rgba(0, 0, 0, .1)', '--line': 'rgba(0, 0, 0, .08)',
        '--text': '#16181d', '--text-muted': '#5c6068', '--text-faint': '#9aa0a8',
        '--primary': '#33373d', '--primary-dim': 'rgba(51, 55, 61, .07)', '--primary-glow': 'rgba(51, 55, 61, .14)',
        '--secondary': '#5c6068', '--accent': '#33373d', '--danger': '#b03a2e', '--ok': '#3d7a52',
        '--paper-text': '#ffffff',
        '--yj-body-bg': '#fafafa',
        '--yj-card-bg': '#ffffff',
        '--yj-card-border': '1px solid rgba(0, 0, 0, .09)',
        '--yj-card-shadow': 'none',
        '--yj-radius-card': '2px', '--yj-radius-btn': '2px',
        '--yj-title-space': '.06em', '--yj-line-height': '2.1', '--yj-motion': '.5',
        '--yj-btn-bg': '#33373d'
      }
    }
  ];

  var DEFAULT_VARS = {
    '--yj-radius-card': '14px', '--yj-radius-btn': '10px',
    '--yj-title-space': '.22em', '--yj-line-height': '2.12', '--yj-motion': '1'
  };

  var _customs = [];   // 用户导入的主题
  var _warned = {};

  function warnOnce(k, msg) {
    if (_warned[k]) return;
    _warned[k] = 1;
    try { console.warn('[主题工坊] ' + msg); } catch (e) { }
  }

  function safeParse(s, d) {
    try { return JSON.parse(s) || d; } catch (e) { return d; }
  }

  /* ---------------- 存储 ---------------- */
  function state() {
    var st = safeParse(localStorage.getItem(KEY), {});
    if (!st || typeof st !== 'object') st = {};
    if (!st.id) st.id = 'auto';
    if (!Array.isArray(st.customs)) st.customs = [];
    return st;
  }
  function persist(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); return true; }
    catch (e) {
      try { window.showToast && window.showToast('主题保存失败：本地存储已满', 'error'); } catch (e2) { }
      return false;
    }
  }

  function all() {
    return BUILTIN.concat(state().customs || []);
  }
  function get(id) {
    var list = all();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return BUILTIN[0];
  }
  function current() {
    return get(state().id);
  }

  /* ---------------- 安全校验 ----------------
     危险写法清单：外部资源加载（隐私/外联）、脚本执行、脱离视口定位（挡住操作层） */
  var BAD_VALUE = /url\s*\(\s*['"]?(?!#|data:image\/(?:png|jpe?g|gif|webp|svg\+xml))/i,
    BAD_CSS = /(@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding|position\s*:\s*fixed|<script|<\/style)/i;

  function sanitizeVars(input) {
    var out = {}, n = 0, bad = 0;
    if (!input || typeof input !== 'object') return { vars: out, dropped: 0 };
    for (var k in input) {
      if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
      if (!/^--[A-Za-z0-9_-]{1,60}$/.test(k)) { bad++; continue; }
      var v = String(input[k] == null ? '' : input[k]).trim();
      if (!v || v.length > 400 || BAD_VALUE.test(v)) { bad++; continue; }
      out[k] = v; n++;
    }
    return { vars: out, dropped: bad };
  }
  function sanitizeCss(css) {
    var s = String(css || '');
    if (!s) return '';
    if (s.length > 24000) s = s.slice(0, 24000);
    if (BAD_CSS.test(s)) {
      /* 逐行剔除而不是整段丢弃：用户多半只误用了一条 */
      s = s.split(/\n/).filter(function (line) { return !BAD_CSS.test(line); }).join('\n');
    }
    return s;
  }

  /* ---------------- 应用 ---------------- */
  function applyVars(theme) {
    var host = document.getElementById(CSS_ID);
    if (!host) {
      host = document.createElement('style');
      host.id = CSS_ID;
      (document.head || document.documentElement).appendChild(host);
    }
    var vars = Object.assign({}, DEFAULT_VARS, theme && theme.vars || {});
    /* 关键：变量必须落在 body 上，且特异性要高过 33 界皮肤的 body{...}。
       写在 :root 不行——世界皮肤在 body 上重定义同名变量，body 及其后代一律取近的那份，
       html 上的声明会被彻底遮蔽（浅色主题只改了最外层底色，卡片仍是深棕）。
       html[data-yj-theme]:not([data-yj-theme="auto"]) body → (0,2,2)，压过 body.theme-xxx (0,1,1)。 */
    var sel = theme && theme.id && theme.id !== 'auto'
      ? 'html[data-yj-theme]:not([data-yj-theme="auto"]) body'
      : ':root';
    var css = sel + '{';
    for (var k in vars) {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) continue;
      css += k + ':' + vars[k] + ';';
    }
    css += '}';
    /* 只在非「跟随世界」时压掉世界皮肤写死的 body 背景 */
    if (theme && theme.id && theme.id !== 'auto') {
      if (vars['--yj-body-bg']) {
        css += 'html[data-yj-theme] body{background:' + vars['--yj-body-bg'] + ' !important;background-attachment:fixed;}';
      }
      css += 'html[data-yj-theme] body{color:var(--text);font-family:var(--yj-font-body,var(--serif));}';
    }
    host.textContent = css;
  }
  function applyCustomCss(theme) {
    var host = document.getElementById(CUSTOM_CSS_ID);
    var css = theme && theme.css ? sanitizeCss(theme.css) : '';
    if (!css) {
      if (host) host.textContent = '';
      return;
    }
    if (!host) {
      host = document.createElement('style');
      host.id = CUSTOM_CSS_ID;
      (document.head || document.documentElement).appendChild(host);
    }
    host.textContent = css;
  }
  function apply(id, opts) {
    var st = state();
    var theme = get(id || st.id || 'auto');
    st.id = theme.id;
    document.documentElement.setAttribute('data-yj-theme', theme.id);
    document.documentElement.setAttribute('data-yj-base', theme.base || 'dark');
    applyVars(theme);
    applyCustomCss(theme);
    if (!opts || opts.persist !== false) persist(st);
    try {
      document.dispatchEvent(new CustomEvent('yunjing:theme', { detail: { id: theme.id, name: theme.name } }));
    } catch (e) { }
    return theme;
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function normalizePkg(raw) {
    var pkg = raw;
    if (typeof pkg === 'string') pkg = safeParse(pkg, null);
    if (!pkg || typeof pkg !== 'object') throw new Error('不是有效的 JSON');
    /* 兼容几种常见写法：{theme:{...}} / {vars:{...}} / 裸变量表 */
    if (pkg.theme && typeof pkg.theme === 'object') pkg = pkg.theme;
    if (!pkg.vars && pkg.colors && typeof pkg.colors === 'object') pkg.vars = pkg.colors;
    if (!pkg.vars) {
      var looksFlat = false;
      for (var k in pkg) if (/^--/.test(k)) { looksFlat = true; break; }
      if (looksFlat) pkg = { vars: pkg };
    }
    var sv = sanitizeVars(pkg.vars);
    if (!Object.keys(sv.vars).length) throw new Error('主题里没有任何可用的 CSS 变量（应以 -- 开头）');
    var name = String(pkg.name || '导入的主题').slice(0, 24);
    var id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return {
      id: id, name: name, icon: String(pkg.icon || '🎨').slice(0, 4),
      base: pkg.base === 'light' ? 'light' : 'dark',
      desc: String(pkg.desc || '用户导入的主题').slice(0, 80),
      swatch: [sv.vars['--primary'] || '#888', sv.vars['--panel'] || '#222', sv.vars['--bg'] || '#111'],
      vars: sv.vars, css: sanitizeCss(pkg.css),
      custom: true, dropped: sv.dropped, importedAt: Date.now()
    };
  }

  function importFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('没有选择文件'));
      if (file.size > 512 * 1024) return reject(new Error('主题包过大（上限 512KB）'));
      var r = new FileReader();
      r.onerror = function () { reject(new Error('文件读取失败')); };
      r.onload = function () {
        try {
          var t = normalizePkg(r.result);
          var st = state();
          st.customs = (st.customs || []).filter(function (x) { return x.name !== t.name; });
          st.customs.push(t);
          /* 只保留最近 20 套，防止 localStorage 塞满 */
          if (st.customs.length > 20) st.customs = st.customs.slice(-20);
          st.id = t.id;
          persist(st);
          apply(t.id);
          resolve(t);
        } catch (e) { reject(e); }
      };
      r.readAsText(file);
    });
  }

  function exportTheme(id) {
    var t = get(id || state().id);
    var pkg = {
      app: 'yunjing-theme', ver: 1, name: t.name, icon: t.icon, base: t.base,
      desc: t.desc, vars: t.vars || {}, css: t.css || '',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(pkg, null, 2);
  }

  function download(id) {
    var t = get(id || state().id);
    var blob = new Blob([exportTheme(t.id)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '云境主题_' + String(t.name).replace(/[\\/:*?"<>|]/g, '_') + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function removeCustom(id) {
    var st = state();
    st.customs = (st.customs || []).filter(function (x) { return x.id !== id; });
    if (st.id === id) st.id = 'auto';
    persist(st);
    apply(st.id);
  }

  /* ---------------- 快捷微调（不新建主题，直接改当前的自定义主题） ---------------- */
  function tweak(patch) {
    var st = state();
    var t = get(st.id);
    if (!t.custom) {
      /* 内置主题不允许就地改：复制一份再改，原版永远可回 */
      var copy = normalizePkg({ name: t.name + '（我的）', base: t.base, vars: Object.assign({}, t.vars, patch || {}), css: t.css, icon: t.icon });
      st.customs.push(copy);
      st.id = copy.id;
      persist(st);
      apply(copy.id);
      return copy;
    }
    t.vars = Object.assign({}, t.vars, patch || {});
    var idx = st.customs.findIndex(function (x) { return x.id === t.id; });
    if (idx >= 0) st.customs[idx] = t;
    persist(st);
    apply(t.id);
    return t;
  }

  /* ---------------- 面板 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function panelHTML() {
    var st = state();
    var list = all();
    var cards = list.map(function (t) {
      var on = t.id === st.id;
      var sw = (t.swatch || ['#888', '#333', '#111']).map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join('');
      /* 预览块用「该主题自己的」三色，而不是当前主题的——否则 6 张卡长得一模一样 */
      var tv = t.vars || {};
      var pv = '--pv-bg:' + esc(tv['--bg'] || 'transparent')
        + ';--pv-panel:' + esc(tv['--panel'] || 'transparent')
        + ';--pv-pri:' + esc(tv['--primary'] || 'var(--primary)')
        + ';--pv-fg:' + esc(tv['--text-muted'] || 'var(--text-muted)');
      return '<button class="yj-th-card' + (on ? ' on' : '') + '" data-id="' + esc(t.id) + '" style="' + pv + '" onclick="ThemeStudio.pick(\'' + esc(t.id) + '\')">'
        + '<span class="yj-th-preview" data-base="' + esc(t.base || 'dark') + '">'
        + '<span class="yj-th-pv-bar"></span><span class="yj-th-pv-line"></span><span class="yj-th-pv-line s"></span>'
        + '<span class="yj-th-pv-chip"></span></span>'
        + '<span class="yj-th-meta"><b>' + esc(t.icon || '🎨') + ' ' + esc(t.name) + (t.custom ? ' <i class="yj-th-tag">导入</i>' : '') + '</b>'
        + '<span class="yj-th-desc">' + esc(t.desc || '') + '</span>'
        + '<span class="yj-th-swatch">' + sw + '</span></span>'
        + (on ? '<i class="yj-th-on">✓ 使用中</i>' : '')
        + '</button>';
    }).join('');
    return ''
      + '<div class="yj-th-wrap">'
      + '<div class="yj-th-head">'
      + '<div><h3>🎨 主题工坊</h3><p>选一套读起来舒服的外观；也可以把自己调好的主题导出，换设备、送朋友都只需一个 JSON。</p></div>'
      + '<div class="yj-th-acts">'
      + '<button class="btn-ghost" onclick="ThemeStudio.importPick()">📥 导入主题</button>'
      + '<button class="btn-ghost" onclick="ThemeStudio.download()">⤓ 导出当前</button>'
      + '</div></div>'
      + '<div class="yj-th-grid">' + cards + '</div>'
      + '<div class="yj-th-tune">'
      + '<div class="yj-th-tune-col"><label>主色</label><input type="color" id="yjTunePrimary" value="' + esc((current().vars || {})['--primary'] || '#e0a84c') + '" oninput="ThemeStudio.liveTweak()"></div>'
      + '<div class="yj-th-tune-col"><label>底色</label><input type="color" id="yjTuneBg" value="' + esc((current().vars || {})['--bg'] || '#12141d') + '" oninput="ThemeStudio.liveTweak()"></div>'
      + '<div class="yj-th-tune-col grow"><label>正文行高 <b id="yjTuneLhVal">' + esc((current().vars || {})['--yj-line-height'] || '2.12') + '</b></label><input type="range" min="1.8" max="2.6" step="0.02" id="yjTuneLh" value="' + esc((current().vars || {})['--yj-line-height'] || '2.12') + '" oninput="ThemeStudio.liveTweak()"></div>'
      + '<div class="yj-th-tune-col grow"><label>卡片圆角 <b id="yjTuneRVal">' + esc(parseInt((current().vars || {})['--yj-radius-card'] || '14', 10)) + 'px</b></label><input type="range" min="0" max="26" step="1" id="yjTuneR" value="' + esc(parseInt((current().vars || {})['--yj-radius-card'] || '14', 10)) + '" oninput="ThemeStudio.liveTweak()"></div>'
      + '<button class="btn-ghost" onclick="ThemeStudio.resetTune()">恢复该主题原样</button>'
      + '</div>'
      + '<p class="yj-th-note">微调会把你正在用的主题复制成「我的」版本，原主题不会被改坏；「跟随世界」保持 33 界原色。导入的主题文件只接受 CSS 变量（<code>--primary</code> 这类）和视觉规则，外部图片、脚本、固定定位会被自动剔除。</p>'
      + '</div>';
  }

  var _savedVars = null;

  function open() {
    if (window.ConfigModal && ConfigModal.openPanel) {
      /* 已在设置面板内：滚到主题区即可 */
    }
    var host = document.getElementById('yjThemeModal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'yjThemeModal';
      host.className = 'yj-th-modal';
      host.innerHTML = '<div class="yj-th-box"><button class="modal-close" onclick="ThemeStudio.close()">✕</button><div id="yjThemeBody"></div></div>';
      host.addEventListener('click', function (e) { if (e.target === host) ThemeStudio.close(); });
      document.body.appendChild(host);
    }
    document.getElementById('yjThemeBody').innerHTML = panelHTML();
    host.classList.add('show');
  }
  function close() {
    var host = document.getElementById('yjThemeModal');
    if (host) host.classList.remove('show');
  }
  function refresh() {
    var body = document.getElementById('yjThemeBody');
    if (body && body.offsetParent !== null) body.innerHTML = panelHTML();
    if (window.ConfigModal && ConfigModal.refreshThemeSection) { try { ConfigModal.refreshThemeSection(); } catch (e) { } }
  }

  function pick(id) {
    _savedVars = null;
    apply(id);
    refresh();
  }
  function importPick() {
    var inp = document.getElementById('yjThemeFile');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file';
      inp.id = 'yjThemeFile';
      inp.accept = '.json,application/json';
      inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        importFile(f).then(function (t) {
          refresh();
          window.showToast && window.showToast('已导入主题「' + t.name + '」' + (t.dropped ? '（剔除了 ' + t.dropped + ' 条非法样式）' : ''), 'success');
        }).catch(function (e) {
          window.showToast && window.showToast('导入失败：' + e.message, 'error');
        });
      });
      document.body.appendChild(inp);
    }
    inp.click();
  }
  function liveTweak() {
    var p = document.getElementById('yjTunePrimary'), bg = document.getElementById('yjTuneBg');
    var lh = document.getElementById('yjTuneLh'), r = document.getElementById('yjTuneR');
    var patch = {};
    if (p) patch['--primary'] = p.value;
    if (bg) patch['--bg'] = bg.value;
    if (lh) patch['--yj-line-height'] = lh.value;
    if (r) patch['--yj-radius-card'] = r.value + 'px';
    var lhv = document.getElementById('yjTuneLhVal'), rv = document.getElementById('yjTuneRVal');
    if (lhv && lh) lhv.textContent = lh.value;
    if (rv && r) rv.textContent = r.value + 'px';
    /* 拖动时不落盘不复制主题，只做视觉预览；松手（change）再固化 */
    var theme = current();
    var preview = Object.assign({}, theme, { vars: Object.assign({}, theme.vars, patch) });
    applyVars(preview);
    document.documentElement.setAttribute('data-yj-theme', theme.id);
    _savedVars = preview.vars;
  }
  function commitTweak() {
    if (!_savedVars) return;
    var theme = current();
    if (!theme.custom) {
      var copy = normalizePkg({ name: theme.name + '（我的）', base: theme.base, vars: _savedVars, css: theme.css, icon: theme.icon, desc: '基于「' + theme.name + '」微调' });
      var st = state();
      st.customs.push(copy);
      st.id = copy.id;
      persist(st);
      apply(copy.id);
    } else {
      theme.vars = _savedVars;
      var st2 = state();
      var i = st2.customs.findIndex(function (x) { return x.id === theme.id; });
      if (i >= 0) st2.customs[i] = theme;
      persist(st2);
      apply(theme.id);
    }
    _savedVars = null;
    refresh();
  }
  function resetTune() {
    var t = current();
    if (t.custom) {
      var st = state();
      st.customs = st.customs.filter(function (x) { return x.id !== t.id; });
      persist(st);
    }
    apply('auto');
    refresh();
  }

  /* 拖动结束固化（input 事件负责预览，change 负责落盘） */
  document.addEventListener('change', function (e) {
    var id = e.target && e.target.id;
    if (id === 'yjTuneLh' || id === 'yjTuneR' || id === 'yjTunePrimary' || id === 'yjTuneBg') commitTweak();
  });

  window.ThemeStudio = {
    list: all, get: get, current: current, apply: apply, open: open, close: close,
    pick: pick, importPick: importPick, importFile: importFile, exportTheme: exportTheme,
    download: download, removeCustom: removeCustom, tweak: tweak, refresh: refresh,
    liveTweak: liveTweak, commitTweak: commitTweak, resetTune: resetTune,
    normalizePkg: normalizePkg, sanitizeVars: sanitizeVars, panelHTML: panelHTML,
    BUILTIN: BUILTIN
  };

  /* 首屏立刻生效 */
  try { apply(state().id, { persist: false }); } catch (e) { warnOnce('boot', e && e.message); }
})();
