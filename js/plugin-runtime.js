/* 云境 · 插件运行时 PluginRuntime v1.0.0（v4.17.3）
 *
 * 为什么有它
 *   用户要求：「玩家在游玩过程中发现 bug、有自己的想法要改进、或者想制作插件 / DLC /
 *   其他功能，全都要支持」。
 *
 *   查证结论：`FileBridge` 已经让小云**能写文件**（授权 / 白名单 / 备份 / 回滚 / 自检齐全），
 *   但全库**没有任何插件加载机制** —— 搜遍 `registerPlugin` / `loadPlugin` /
 *   `pluginRegistry` / `extensionPoint` 一处都没有。也就是说：
 *     小云能把插件文件写出来，**但没有任何东西会去加载并执行它**。
 *   这条链路是断的，本模块就是补上这一环。
 *
 * 它做什么
 *   1) 插件清单：`plugins/<id>/plugin.json` + 入口 js（也支持单文件插件）
 *   2) 扩展点（hooks）：插件在此挂载，而不是去魔改云境源码
 *        story:turn-start   一轮开始（可改写即将发送的上下文）
 *        story:turn-end     一轮结束（正文已落库，可做统计/联动/提醒）
 *        world:init         世界初始化完成
 *        prompt:inject      装配提示词时注入额外段落（做 DLC 设定最常用）
 *        status:extend      扩展状态栏字段（配合 StatusPresets）
 *        ui:panel           注册自己的面板入口
 *        world:var-change   变量发生变化
 *   3) 隔离与容错：插件抛错只记录并停用该插件，**绝不影响主流程**
 *   4) 权限声明：manifest 里声明要用的能力（读档 / 提示词 / 界面 / 网络），运行时校验
 *
 * 与 FileBridge 的关系
 *   FileBridge 负责「把文件写到玩家磁盘上」（含备份与回滚）；
 *   PluginRuntime 负责「把玩家磁盘上的插件读进来并跑起来」。
 *   小云在两者之间：用 yj-patch 产出插件文件 → 玩家确认落盘 → 插件出现在插件列表 → 启用。
 */
(function () {
  'use strict';

  var HOOKS = [
    'story:turn-start', 'story:turn-end', 'world:init',
    'prompt:inject', 'status:extend', 'ui:panel', 'world:var-change'
  ];
  var CAPS = ['read-save', 'write-save', 'prompt', 'ui', 'net', 'kb'];

  var _plugins = [];        // { manifest, hooks:{}, enabled, error }
  var _byId = {};
  var _log = [];

  function log(msg, level) {
    _log.push({ at: Date.now(), level: level || 'info', msg: String(msg) });
    if (_log.length > 200) _log.shift();
    try { if (window.YJ_DEBUG) console.log('[Plugin]', msg); } catch (e) { }
  }

  function validate(manifest) {
    if (!manifest || typeof manifest !== 'object') return '插件清单不是对象';
    if (!manifest.id || !/^[a-z0-9][a-z0-9\-_.]{1,48}$/i.test(manifest.id)) return '插件 id 非法（只允许字母数字与 - _ .）';
    if (!manifest.name) return '插件缺少 name';
    if (manifest.apiVersion && Number(manifest.apiVersion) > 1) return '插件要求的 apiVersion 高于本运行时（' + manifest.apiVersion + ' > 1）';
    if (manifest.capabilities) {
      var bad = (Array.isArray(manifest.capabilities) ? manifest.capabilities : []).filter(function (c) { return CAPS.indexOf(c) < 0; });
      if (bad.length) return '声明了未知能力：' + bad.join('、') + '（可用：' + CAPS.join(' / ') + '）';
    }
    return null;
  }

  /** 插件注册自己。plugin.js 里调用 YJPlugins.register({...}) 或直接传 manifest。 */
  function register(manifest, setup) {
    var err = validate(manifest);
    if (err) { log('注册被拒：' + err, 'error'); return { ok: false, error: err }; }
    if (_byId[manifest.id]) {
      /* 重复注册（例如热重载）→ 覆盖旧的，但保留禁用状态 */
      _plugins = _plugins.filter(function (p) { return p.manifest.id !== manifest.id; });
      log('插件 ' + manifest.id + ' 重复注册，已替换');
    }
    var rec = {
      manifest: manifest,
      enabled: manifest.enabled !== false,
      hooks: {},
      error: null,
      registeredAt: Date.now()
    };
    _byId[manifest.id] = rec;
    _plugins.push(rec);
    /* 执行插件自己的 setup（拿到的 api 是受能力约束的） */
    try {
      if (typeof setup === 'function') setup(apiFor(rec));
      else if (typeof window['__yjPluginSetup_' + manifest.id] === 'function') window['__yjPluginSetup_' + manifest.id](apiFor(rec));
    } catch (e) {
      rec.error = String((e && e.message) || e);
      log('插件 ' + manifest.id + ' 初始化失败：' + rec.error, 'error');
    }
    log('已注册插件 ' + manifest.id + '（' + manifest.name + '）');
    return { ok: true, id: manifest.id };
  }

  /** 给插件的受限 API：按 manifest.capabilities 放行 */
  function apiFor(rec) {
    var caps = Array.isArray(rec.manifest.capabilities) ? rec.manifest.capabilities : [];
    var has = function (c) { return caps.indexOf(c) >= 0; };
    return {
      id: rec.manifest.id,
      version: rec.manifest.version || '0.0.0',
      /** 挂扩展点 */
      on: function (hook, fn) {
        if (HOOKS.indexOf(hook) < 0) { log('插件 ' + rec.manifest.id + ' 挂了未知扩展点 ' + hook, 'error'); return false; }
        if (typeof fn !== 'function') return false;
        (rec.hooks[hook] = rec.hooks[hook] || []).push(fn);
        return true;
      },
      /** 读存档（需 read-save） */
      getState: function () {
        if (!has('read-save')) { log('插件 ' + rec.manifest.id + ' 未声明 read-save', 'error'); return null; }
        try { return window.storyFramework ? window.storyFramework.storyState : null; } catch (e) { return null; }
      },
      /** 写存档（需 write-save） */
      setVar: function (k, v) {
        if (!has('write-save')) { log('插件 ' + rec.manifest.id + ' 未声明 write-save', 'error'); return false; }
        try {
          var st = window.storyFramework.storyState;
          if (!st || !st.variables) return false;
          st.variables[k] = v;
          window.storyFramework.saveStory && window.storyFramework.saveStory();
          return true;
        } catch (e) { return false; }
      },
      /** 查知识库（需 kb） */
      kb: function (q, n) {
        if (!has('kb')) { log('插件 ' + rec.manifest.id + ' 未声明 kb', 'error'); return []; }
        try { return window.StoryKnowledge && window.StoryKnowledge.search ? window.StoryKnowledge.search(q, n || 5) : []; } catch (e) { return []; }
      },
      /** 提示（总是允许：只是 UI 反馈） */
      toast: function (m, t) { try { window.showToast && window.showToast('【' + rec.manifest.name + '】' + m, t || 'info'); } catch (e) { } },
      log: function (m) { log('[' + rec.manifest.id + '] ' + m); }
    };
  }

  /** 触发扩展点：返回所有非 undefined 的结果数组 */
  function emit(hook, payload) {
    var out = [];
    for (var i = 0; i < _plugins.length; i++) {
      var rec = _plugins[i];
      if (!rec.enabled || rec.error) continue;
      var list = rec.hooks[hook];
      if (!list) continue;
      for (var j = 0; j < list.length; j++) {
        try {
          var r = list[j](payload, apiFor(rec));
          if (r !== undefined) out.push(r);
        } catch (e) {
          /* 容错：插件出错只停用它，不影响主流程 */
          rec.error = String((e && e.message) || e);
          log('插件 ' + rec.manifest.id + ' 在 ' + hook + ' 抛错，已停用：' + rec.error, 'error');
          try { window.showToast && window.showToast('插件「' + rec.manifest.name + '」出错已停用：' + rec.error, 'error'); } catch (e2) { }
        }
      }
    }
    return out;
  }

  /** 汇总所有插件要注入的提示词段落（prompt:inject） */
  function collectPromptInjections(ctx) {
    var parts = emit('prompt:inject', ctx || {}).filter(function (x) { return typeof x === 'string' && x.trim(); });
    return parts.length ? parts.join('\n\n') : '';
  }

  /** 汇总所有插件要扩展的状态字段（status:extend） */
  function collectStatusFields() {
    var out = [];
    emit('status:extend', {}).forEach(function (x) {
      if (Array.isArray(x)) out = out.concat(x.filter(function (f) { return f && f.k && f.label; }));
      else if (x && x.k && x.label) out.push(x);
    });
    return out;
  }

  /** 从 URL 列表加载插件（每个 URL 指向一个 plugin.js，它自己调用 register） */
  function loadFromUrls(urls) {
    var list = Array.isArray(urls) ? urls : [urls];
    return Promise.all(list.map(function (u) {
      return new Promise(function (res) {
        try {
          var s = document.createElement('script');
          s.src = u;
          s.onload = function () { log('已加载插件文件 ' + u); res(true); };
          s.onerror = function () { log('插件文件加载失败 ' + u, 'error'); res(false); };
          document.head.appendChild(s);
        } catch (e) { res(false); }
      });
    }));
  }

  /** 从 FileBridge 已授权的目录里发现插件：扫 plugins/ 下的 plugin.json
   *  v4.18.0 统一造物工坊：旧版造物工坊把模块写进 modules/ + registry.json，而本加载器
   *  只读 plugins/_index.json —— 两套注册表互不相通，造出来的模块永远接不进系统。
   *  现在两套都认：plugins/ 走原生插件，modules/registry.json 里的 HTML 造物被包装成
   *  一个 ui 插件（提供「打开造物」入口），让"创造→生效"真正闭环。 */
  async function discoverFromFileBridge() {
    try {
      var FB = window.FileBridge;
      if (!FB || !FB.hasRoot || !FB.hasRoot()) return { ok: false, reason: '未授权项目文件夹' };
      var ids = [], count = 0, sources = [];
      /* --- 原生插件：plugins/_index.json --- */
      var idx = null;
      try { idx = await FB.read('plugins/_index.json'); } catch (e) { idx = null; }
      if (idx && idx.text) {
        var pids = [];
        try { pids = JSON.parse(idx.text); } catch (e) { pids = []; }
        if (Array.isArray(pids)) {
          ids = ids.concat(pids.map(function (id) { return 'plugins/' + id + '/plugin.js'; }));
          count += pids.length; sources = sources.concat(pids);
        }
      }
      /* --- 造物工坊：modules/registry.json → 包装成 ui 插件 --- */
      var reg = null;
      try { reg = await FB.read('modules/registry.json'); } catch (e) { reg = null; }
      if (reg && reg.text) {
        var manifest;
        try { manifest = JSON.parse(reg.text); } catch (e) { manifest = null; }
        var mods = (manifest && Array.isArray(manifest.modules)) ? manifest.modules : [];
        mods.forEach(function (m, i) {
          var file = String(m.file || m.path || '');
          var name = String(m.name || ('造物' + (i + 1)));
          if (!file) return;
          var pid = 'xy-created-' + (file.replace(/[^\w]/g, '_').slice(-24) || i);
          if (_byId[pid]) return; // 已注册过（热重载保幂等）
          register({
            id: pid, name: name, version: '1.0.0', apiVersion: 1,
            author: '小云造物工坊', desc: '由造物工坊生成并写入源码的模块',
            capabilities: ['ui']
          }, function (api) {
            api.on('ui:panel', function () {
              return { id: pid, label: '🧩 ' + name, kind: 'created-module', file: file, name: name };
            });
          });
          count++; sources.push(pid);
        });
      }
      if (ids.length) await loadFromUrls(ids);
      if (!count) return { ok: false, reason: '没有 plugins/_index.json，也没有 modules/registry.json' };
      return { ok: true, count: count, ids: sources };
    } catch (e) {
      return { ok: false, reason: '发现失败：' + (e && e.message) };
    }
  }

  function list() {
    return _plugins.map(function (p) {
      return {
        id: p.manifest.id, name: p.manifest.name, version: p.manifest.version || '0.0.0',
        author: p.manifest.author || '', desc: p.manifest.desc || '',
        capabilities: p.manifest.capabilities || [],
        enabled: p.enabled, error: p.error,
        hooks: Object.keys(p.hooks).map(function (h) { return h + '×' + p.hooks[h].length; })
      };
    });
  }

  function setEnabled(id, on) {
    var p = _byId[id];
    if (!p) return false;
    p.enabled = !!on;
    if (p.enabled && p.error) p.error = null;   // 重新启用时给它一次机会
    log('插件 ' + id + (p.enabled ? ' 已启用' : ' 已停用'));
    return true;
  }

  /** 给小云看的插件开发规范（它据此产出插件文件） */
  function authoringGuide() {
    return [
      '【插件开发规范 · 云境 PluginRuntime v1】',
      '目录：plugins/<插件id>/plugin.json（清单） + plugins/<id>/plugin.js（入口）',
      '清单示例：{"id":"my-plugin","name":"我的插件","version":"1.0.0","apiVersion":1,',
      '  "author":"玩家","desc":"一句话说明","capabilities":["read-save","prompt","ui"]}',
      '入口里调用 YJPlugins.register(manifest, api => { ... }) 来挂扩展点：',
      '  api.on("story:turn-end", ({turn, body, vars}) => {...})',
      '  api.on("prompt:inject", () => "额外要注入的设定段落")  ← 做 DLC 设定最常用',
      '  api.on("status:extend", () => [{k:"myfield",label:"我的字段",group:"state"}])',
      '  api.on("world:init", ({genre}) => {...})',
      '可用扩展点：' + HOOKS.join(' / '),
      '可用能力：' + CAPS.join(' / ') + '（要用哪个就必须在 capabilities 里声明）',
      '约束：插件抛错会被自动停用且不影响主流程；不要直接改云境源码，优先用扩展点。',
      '新增插件后，把 id 追加到 plugins/_index.json，云境启动时会自动加载。'
    ].join('\n');
  }

  window.PluginRuntime = {
    HOOKS: HOOKS, CAPS: CAPS,
    register: register, emit: emit, list: list, setEnabled: setEnabled,
    collectPromptInjections: collectPromptInjections, collectStatusFields: collectStatusFields,
    loadFromUrls: loadFromUrls, discoverFromFileBridge: discoverFromFileBridge,
    authoringGuide: authoringGuide,
    log: function () { return _log.slice(); }
  };
  /* 插件在自身文件里用这个更顺手 */
  window.YJPlugins = {
    register: register,
    api: { hooks: HOOKS, capabilities: CAPS },
    version: 1
  };

  /* 启动时若已授权，自动发现插件（失败静默，不打扰） */
  try {
    setTimeout(function () {
      try { discoverFromFileBridge().then(function (r) { if (r && r.ok) log('自动发现插件 ' + r.count + ' 个'); }); } catch (e) { }
    }, 3500);
  } catch (e) { }
})();
