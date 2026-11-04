/* 小云伙伴 · 逻辑（v3.83.0 全能版）
   · 本地意图路由：灵感 / 卡文急救 / 世界书 / 存档 / 预设 / 正文急救 / 体检；
   · 全能力走技能中枢 XiaoyunOps（云境有的小云都会做）；
   · 接入大模型 API 后：小云获得完整对话与工具调用（⟦tool⟧ 协议，最多2轮），
     可自主增补世界书条目、修格式、查变量、管存档、换预设、开发新模块。 */
(function () {
  var FORMS = [
    { k: 'wenrou', n: '温柔', img: 'assets/xiaoyun-wenrou-happy.png', hi: '今天想写点什么呢？我在哦～', tips: ['需要帮忙吗？点我！', '卡文了？我可以急救～', '今天也要一起加油呀'] },
    { k: 'aojiao', n: '傲娇', img: 'assets/xiaoyun-aojiao-happy.png', hi: '哼、才不是特意等你的呢。想写什么？', tips: ['别磨蹭啦，点我！', '有本大小姐在，怕什么卡文', '快点开我啦！'] },
    { k: 'keai', n: '可爱', img: 'assets/xiaoyun-keai-happy.png', hi: '哇，你来啦！我们一起写故事吧！(๑•̀ㅂ•́)و✧', tips: ['嘿嘿，点我点我！', '今天灵感满满哦～', '一起写故事吧！'] },
    { k: 'gaoguai', n: '高傲', img: 'assets/xiaoyun-gaoguai-happy.png', hi: '哦？你来了。本小姐勉强陪你写一篇吧。', tips: ['本小姐在此，速来', '灵感？我有的是', '点我，别客气'] },
    { k: 'yu', n: '雨', img: 'assets/xiaoyun-yu-happy.png', hi: '下雨天，和写作最配了。想从哪界开始？', tips: ['雨天适合写作哦', '我在听着呢', '点我聊聊吧'] },
    { k: 'qingchun', n: '青春', img: 'assets/xiaoyun-qingchun-happy.png', hi: '元气满满！今天也要产出神作！', tips: ['冲呀！点我！', '灵感补给站在这里', '写起来写起来！'] }
  ];
  var INSPIRE = [
    '【灵感】深夜的旧书店里，每本书的第 137 页都写着同一个名字。',
    '【灵感】她发现自己每天做的梦，是另一个人遗失的日记。',
    '【灵感】江湖上传言：谁的刀最快，谁就记不住自己杀过的人。',
    '【灵感】飞船领航员收到了三十年前自己发出的求救信号。',
    '【灵感】小镇上所有镜子里的人，都比现实中的你慢半拍。',
    '【灵感】他在族谱最后一页，看到了自己明天的死讯。'
  ];
  var cur = 0, panelOn = false;
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }

  var root = el('div', 'xy-buddy'); root.id = 'xyBuddy';
  var panel = el('div', 'xy-panel');
  var orb = el('div', 'xy-orb');
  var img = el('img'); img.alt = '小云';
  var tip = el('span', 'xy-tip');
  orb.appendChild(img); orb.appendChild(tip);
  var head = el('div', 'xy-head');
  var chat = el('div', 'xy-chat'); var quick = el('div', 'xy-quick');
  var form = el('div', 'xy-form'); var forms = el('div', 'xy-forms');
  var modules = el('div', 'xy-modules');
  var input = el('input'); input.placeholder = '和小云说点什么…（可让我加世界书条目 / 修格式 / 管存档）';
  var send = el('button', null, '发送');
  form.appendChild(input); form.appendChild(send);
  panel.appendChild(head); panel.appendChild(chat); panel.appendChild(quick); panel.appendChild(modules); panel.appendChild(form); panel.appendChild(forms);
  root.appendChild(panel); root.appendChild(orb);
  document.body.appendChild(root);

  function face() { return FORMS[cur]; }
  function renderHead() {
    var f = face();
    head.innerHTML = '';
    var hImg = el('img'); hImg.src = f.img; hImg.alt = '';
    head.appendChild(hImg);
    head.appendChild(el('b', null, '小云 · ' + f.n + '模式'));
    head.appendChild(el('span', 'xy-mood', apiCfg() ? 'AI 管家 · 全能' : 'AI 管家'));
  }
  function renderForms() {
    forms.innerHTML = '';
    FORMS.forEach(function (f, i) {
      var b = el('button', 'xy-f' + (i === cur ? ' on' : ''), f.n);
      b.onclick = function () { setForm(i); };
      forms.appendChild(b);
    });
  }
  function setForm(i) {
    cur = i; var f = face();
    img.src = f.img; renderHead(); renderForms();
    bot(f.hi);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function bot(t) { var m = el('div', 'xy-msg bot', esc(t).replace(/\n/g, '<br>')); chat.appendChild(m); chat.scrollTop = chat.scrollHeight; }
  function botHTML(h) { var m = el('div', 'xy-msg bot', h); chat.appendChild(m); chat.scrollTop = chat.scrollHeight; }
  function me(t) {
    var m = el('div', 'xy-msg me', t); chat.appendChild(m); chat.scrollTop = chat.scrollHeight;
  }

  /* ---------- API 配置（与造物工坊共用） ---------- */
  function apiCfg() {
    try {
      var c = JSON.parse(localStorage.getItem('xy_dev_cfg') || '{}');
      return (c.k && c.u) ? { key: c.k, base: c.u.replace(/\/$/, ''), model: c.m || 'gpt-4o-mini' } : null;
    } catch (e) { return null; }
  }
  function runTool(name, args) {
    if (window.XiaoyunOps) return window.XiaoyunOps.call(name, args);
    return { ok: false, msg: '技能中枢未加载，稍后再试。' };
  }

  /* ---------- 大模型工具循环（⟦tool⟧ 协议，最多 2 轮） ---------- */
  function sysPrompt() {
    var tools = window.XiaoyunOps ? window.XiaoyunOps.manifest().join('\n') : '';
    return '你是「小云」，云境的 AI 管家与全能助手：聊天解闷、剧情灵感、卡文急救，同时能操作整个云境系统。'
      + '\n\n你可以使用以下工具（都在用户本机执行）：\n' + tools
      + '\n\n工具调用协议：当需要使用工具时，单独一行输出：⟦tool⟧{"tool":"工具名","args":{...}}'
      + '\n· 可以连续输出多行调用多个工具；调用后停住等结果，不要假装已执行。'
      + '\n· 不需要工具就直接回复。所有回复用简体中文，称呼玩家为「主人」会显得太生分，直接自然说话即可。'
      + '\n· 隐私红线：绝不把用户的任何内容发往别处；涉及玩家源码的操作只在本地目录进行。';
  }
  function llm(messages, cb) {
    var a = apiCfg();
    if (!a) { cb(null); return; }
    fetch(a.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + a.key },
      body: JSON.stringify({ model: a.model, temperature: 0.7, messages: messages })
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error && j.error.message || ('HTTP ' + r.status)); return j; }); })
      .then(function (j) { var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || ''; cb(String(c)); })
      .catch(function (e) { cb(null, e.message); });
  }
  function parseTools(text) {
    var out = [], re = /⟦tool⟧(\{[^\n⟦]*\})/g, m;
    while ((m = re.exec(text))) {
      try { var o = JSON.parse(m[1]); if (o && o.tool) out.push(o); } catch (e) {}
    }
    return out;
  }
  var thinking = false;
  function think(userText) {
    var a = apiCfg();
    if (!a) { localReply(userText); return; }
    if (thinking) return;
    thinking = true;
    var msgs = [{ role: 'system', content: sysPrompt() }, { role: 'user', content: userText }];
    var round = 0;
    function step(ind) {
      llm(msgs, function (text, err) {
        if (ind) ind.remove();
        thinking = false;
        if (text == null) { bot('大模型接口这会儿没通：' + (err || '未知错误') + '。先用我的本地技能顶着～'); localReply(userText); return; }
        var calls = parseTools(text);
        if (calls.length && round < 2) {
          round++;
          var results = calls.map(function (c) {
            var r = runTool(c.tool, c.args || {});
            return c.tool + ' → ' + (r && r.ok ? '成功：' + r.msg : '失败：' + (r && r.msg || '无返回'));
          }).join('\n');
          bot(text.replace(/⟦tool⟧\{[^\n⟦]*\}/g, '').trim() || '好，我来动手…');
          msgs.push({ role: 'assistant', content: text });
          msgs.push({ role: 'user', content: '工具执行结果：\n' + results + '\n\n请基于以上结果回复我；如还需工具可继续按协议调用。' });
          thinking = true;
          var st2 = el('div', 'xy-msg bot xy-typing', '小云正在干活…'); chat.appendChild(st2); chat.scrollTop = chat.scrollHeight;
          setTimeout(function () { step(st2); }, 120);
          return;
        }
        var clean = text.replace(/⟦tool⟧\{[^\n⟦]*\}/g, '').trim();
        if (clean) bot(clean);
        else bot(face().hi);
      });
    }
    var st = el('div', 'xy-msg bot xy-typing', '小云正在思考…'); chat.appendChild(st); chat.scrollTop = chat.scrollHeight;
    step(st);
  }

  /* ---------- 本地意图（未接 API 时的全技能直达） ---------- */
  function localReply(t) {
    setTimeout(function () {
      if (/加条目|补条目|世界书|资料库/.test(t)) {
        if (window.WorldBook) { bot('世界书面板这就打开——你可以手动加条目，也可以告诉我「加一条：XX」，我直接替你写进去。'); window.WorldBook.open(); }
        else bot('世界书系统在这个页面还没加载（去创作室里我就能直接操作）。');
      } else if (/存档|书档|存档管理/.test(t)) {
        var r = runTool('saves.ui');
        bot(r && r.ok ? r.msg : (window.SaveSlots ? '已帮你打开存档管理。' : (r && r.msg) || '存档系统未加载。'));
        if (r && !r.ok && window.SaveSlots) { try { SaveSlots.open(); } catch (e) {} }
      } else if (/预设|酒馆|第三方/.test(t)) {
        var p = runTool('preset.info'); var g = runTool('regex.info');
        bot((p && p.msg || '') + '\n' + (g && g.msg || '') + '\n想换成你自己的酒馆预设？创作室 → 云起预设面板 → 导入预设，或直接把 JSON 发给我（接入 API 后我自己导）。');
      } else if (/格式|排版乱|修复正文|AI腔/.test(t)) {
        var r2 = runTool('format.repair');
        if (r2 && r2.ok) {
          if (r2.applied && r2.changes && r2.changes.length) { bot(r2.msg + ' 要我直接把修复稿替换进正文吗？（接入 API 后我可以自动替换）'); }
          else bot(r2.msg);
        } else bot((r2 && r2.msg) || '没有可修复的正文。');
      } else if (/变量|数据异常/.test(t)) {
        var r3 = runTool('vars.check'); bot(r3 ? r3.msg : '变量系统未加载。');
      } else if (/灵感|没思路|写什么|点子/.test(t)) { bot(INSPIRE[Math.floor(Math.random() * INSPIRE.length)]); }
      else if (/卡文|卡住|写不下/.test(t)) { bot('卡文急救三步：① 回到上一幕的「钩子」 ② 让配角说一句反常的话 ③ 给场景换天气。还不行？<a href="studio.html" style="color:#b9c0ff">去创作室让我深度帮你 →</a>'); }
      else if (/体检|检查|问题/.test(t)) { var r4 = runTool('system.status'); bot(r4 ? r4.msg : '工坊体检：排版 ✅ · 存档 ✅ · 灵感库 ✅ · 主笔通道 ✅'); }
      else if (/工坊|创作|studio|写/.test(t)) { bot('这就带你去创作室～ <a href="studio.html" style="color:#b9c0ff">进入工坊 →</a>'); }
      else if (/界|世界|逛/.test(t)) { bot('廿八界任你挑：26 个原著小说世界 + 真实地球 + 自由世界。点击页面上方任一入口即可踏入。'); }
      else if (/你是谁|你好|hi|hello|嗨/.test(t)) { bot(face().n + '模式的小云，你的专属 AI 管家。聊天解闷、剧情灵感、卡文急救、世界书、存档、预设、格式急救、造物开发——云境有的我全都会，云境没有的我给你造。'); }
      else { bot(face().hi + ' （想深聊？<a href="studio.html" style="color:#b9c0ff">去创作室找我 →</a>）'); }
    }, 350);
  }
  function reply(text) {
    if (apiCfg()) { think(text); return; }
    localReply(text);
  }
  function buildQuick() {
    quick.innerHTML = '';
    [['💡 剧情灵感', function () { bot(INSPIRE[Math.floor(Math.random() * INSPIRE.length)]); }],
     ['📚 世界书', function () { var r = runTool('ui.worldbook'); bot(r && r.ok ? r.msg : ((r && r.msg) || '世界书未加载。')); }],
     ['🩹 正文急救', function () { var r = runTool('format.repair'); bot(r && r.ok ? r.msg : ((r && r.msg) || '没有可修复的正文。')); }],
     ['💾 存档管理', function () { var r = runTool('saves.ui'); if (r && r.ok) bot(r.msg); else { bot(r && r.msg || '存档系统未加载。'); if (window.SaveSlots) { try { SaveSlots.open(); } catch (e) {} } } }],
     ['🧩 预设/正则', function () { var p = runTool('preset.info'); var g = runTool('regex.info'); bot((p && p.msg || '') + '\n' + (g && g.msg || '')); }],
     ['🏥 工坊体检', function () { var r = runTool('system.status'); bot(r ? r.msg : '工坊体检：排版 ✅ · 存档 ✅ · 灵感库 ✅ · 主笔通道 ✅'); }],
     ['🛠 造物工坊', function () { window.XYDev && window.XYDev.open(); }],
     ['💬 AI 管家', function () { if (window.MoAssistant) window.MoAssistant.openPanel(); }],
     ['✍️ 进入工坊', function () { location.href = 'studio.html'; }]
    ].forEach(function (q) {
      var b = el('button', 'xy-q', q[0]); b.onclick = function () { me(q[0].replace(/^\S+\s/, '')); q[1](); };
      quick.appendChild(b);
    });
  }
  /* v3.89.0：统一对话出口——MoChibi.say 也路由到这里，保证全站只有一只云灵在说话 */
  function say(text, ms) {
    text = String(text == null ? "" : text);
    bot(text);
    flashTip(text, ms);
  }
  function flashTip(text, ms) {
    if (!tip) return;
    tip.textContent = String(text).slice(0, 60);
    tip.classList.add("on");
    clearTimeout(say._t);
    say._t = setTimeout(function () { tip.classList.remove("on"); }, ms || 4000);
  }
  function openPanel() {
    /* v3.89.0：已打开时也重建模块区，补齐懒加载完成后新出现的入口 */
    if (panelOn) { buildModules(); return; }
    panelOn = true; panel.classList.add("on"); tip.classList.remove("on");
    if (!chat.children.length) bot(face().hi);
    buildModules();
  }
  function closePanel() {
    if (!panelOn) return;
    panelOn = false; panel.classList.remove("on");
  }
  /* 模块区：复用 MoChibi.moduleEntries()（世界动态/手机/太虚阁/上下文/资料库/大势账本/
     行旅图鉴/灵宠/小队/身份/立场），让单只云灵也是「全功能」云灵 */
  function buildModules() {
    if (!modules) return;
    modules.innerHTML = '';
    var list = [];
    try {
      if (/studio\.html/.test(location.pathname) && window.MoChibi && typeof window.MoChibi.moduleEntries === "function") {
        list = window.MoChibi.moduleEntries() || [];
      }
    } catch (e) {}
    if (!list.length) { modules.style.display = "none"; return; }
    modules.style.display = "";
    modules.appendChild(el('div', 'xy-sec-title', '🧰 模块'));
    var grid = el('div', 'xy-mod-grid');
    list.forEach(function (it) {
      var b = el('button', 'xy-mod');
      b.innerHTML = '<span class="xy-mod-ico">' + it.ico + '</span>' +
        '<span class="xy-mod-name">' + it.name + '</span>' +
        '<span class="xy-mod-note">' + it.note + '</span>';
      /* v3.89.0 按钮紧凑化后说明文字不占位，改由悬浮提示承载，信息不丢 */
      b.title = it.name + (it.note ? ' · ' + it.note : '');
      b.onclick = function () { try { if (it.act) it.act(); } catch (e) {} };
      grid.appendChild(b);
    });
    modules.appendChild(grid);
  }
  send.onclick = function () { var v = input.value; if (!v) return; me(v); input.value = ''; reply(v); };
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send.onclick(); });
  /* v3.89.0：打开面板时按需重建「模块」区，反映当前题材已加载的子系统 */
  orb.addEventListener('click', function () {
    if (panelOn) closePanel(); else openPanel();
  });
  function rotateTips() {
    if (panelOn) return;
    var f = face(); tip.textContent = f.tips[Math.floor(Math.random() * f.tips.length)];
    tip.classList.add('on');
    setTimeout(function () { tip.classList.remove('on'); }, 3200);
  }
  setForm(0); buildQuick();
  if (modules) modules.style.display = "none";
  /* v3.89.0：创作室 demand 懒加载组约 8s 后才就绪；玩家若提前点开小云，模块入口会缺且
     此前永不回补。此处在懒加载落地后自动补齐（仅当模块区已渲染过才刷，不打扰未打开状态）。 */
  function refreshModulesWhenReady() {
    try {
      if (!modules || !/studio\.html/.test(location.pathname)) return;
      /* 主动拉起 demand 组：玩家提前打开时 window.MoChibi 仍是懒加载桩，模块区会是空的。
         不能用「已渲染过 grid」当门槛，否则空区永远补不回来。 */
      if (window.YJLazy && window.YJLazy.ensure) { try { window.YJLazy.ensure('MoChibi'); } catch (e) {} }
      if (!window.MoChibi || typeof window.MoChibi.moduleEntries !== "function") return;
      var n = (window.MoChibi.moduleEntries() || []).length;
      var cur = modules.querySelectorAll('.xy-mod').length;
      if (n > cur) buildModules();
    } catch (e) {}
  }
  if (/studio\.html/.test(location.pathname)) {
    setTimeout(refreshModulesWhenReady, 3000);
    setTimeout(refreshModulesWhenReady, 9000);
    setTimeout(refreshModulesWhenReady, 15000);
  }
  /* v3.89.0：暴露给 MoChibi 兼容层路由 say()，以及外部触发开关面板 */
  window.XYBuddy = { say: say, open: openPanel, close: closePanel };
  img.src = face().img;
  setTimeout(rotateTips, 900); setInterval(rotateTips, 7000);
})();

/* ============ 造物工坊：小云独立开发模式 ============ */
(function () {
  var PRESETS = [
    { n: 'OpenAI', u: 'https://api.openai.com/v1', m: 'gpt-4o-mini' },
    { n: 'DeepSeek', u: 'https://api.deepseek.com/v1', m: 'deepseek-chat' },
    { n: '智谱 GLM', u: 'https://open.bigmodel.cn/api/paas/v4', m: 'glm-4-flash' },
    { n: '自定义兼容端点', u: '', m: '' }
  ];
  var SYS = '你是「小云」，云境项目的独立开发AI。根据用户需求，生成一个完整、可直接运行的单文件HTML模块（所有CSS/JS内联，无外部依赖，界面中文、风格精致美观、深浅自适应、移动端可用）。只输出HTML代码本身，不要markdown围栏、不要解释文字。';
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function cfg() { try { return JSON.parse(localStorage.getItem('xy_dev_cfg') || '{}'); } catch (e) { return {}; } }
  function saveCfg(c) { localStorage.setItem('xy_dev_cfg', JSON.stringify(c)); }
  function mods() { try { return JSON.parse(localStorage.getItem('xy_modules') || '[]'); } catch (e) { return []; } }
  function saveMods(m) { localStorage.setItem('xy_modules', JSON.stringify(m)); }

  var ov = el('div', 'xy-dev'); var box = el('div', 'xy-dev-box');
  ov.appendChild(box); document.body.appendChild(ov);
  var DEV = { html: '', wish: '', fix: 0, api: null, busy: false, st: null, varifr: null, ptitle: null, prev: null, tt: null };
  var CAP = '<script>window.addEventListener("error",function(e){try{parent.postMessage({xyerr:(e.message||"script error")+(e.lineno?" @line "+e.lineno:"")},"*")}catch(_){}},true)<\/script>';
  function mountHTML(html) {
    DEV.html = html;
    if (!DEV.varifr) return;
    var wrapped = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + CAP; }) : CAP + html;
    DEV.varifr.srcdoc = wrapped;
  }
  function handleErr(msg) {
    var st = DEV.st;
    if (!st || !DEV.html || DEV.busy) return;
    if (DEV.fix < 2 && DEV.api && DEV.api.key && DEV.api.base) {
      DEV.fix++; DEV.busy = true;
      st.className = 'status'; st.textContent = '⚠ 自检出运行错误，小云正在自修复（第 ' + DEV.fix + '/2 轮）…';
      fetch(DEV.api.base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEV.api.key },
        body: JSON.stringify({ model: DEV.api.model, temperature: 0.4, messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: DEV.wish },
          { role: 'assistant', content: DEV.html },
          { role: 'user', content: '该模块运行时发生错误：' + msg + '。请修复并重新输出完整可运行的HTML（仍然只输出代码本身，不要解释）。' }
        ] })
      }).then(function (r) { return r.json(); }).then(function (j) {
        DEV.busy = false;
        var html = j.choices && j.choices[0] && j.choices[0].message.content.replace(/^```[a-z]*\n?|```\n?$/g, '');
        if (html) { mountHTML(html); st.textContent = '🔧 修复完成，重新自检中…'; }
        else throw new Error('empty');
      }).catch(function () { DEV.busy = false; st.className = 'status err'; st.textContent = '修复请求未成功——错误详情已显示在预览中，可调整需求重新生成。'; });
    } else {
      st.className = 'status err';
      st.textContent = '⚠ 模块运行报错：' + String(msg).slice(0, 70) + '（接入 API 后小云可自动修复）';
    }
  }
  window.addEventListener('message', function (ev) { if (ev && ev.data && ev.data.xyerr) handleErr(ev.data.xyerr); });

  function build() {
    var c = cfg();
    box.innerHTML = '';
    var h = el('h3', null, '🛠 造物工坊 <small style="font-weight:400;color:#9a94c0">— 小云 · 独立开发模式</small><span class="x" title="关闭">×</span>');
    h.querySelector('.x').onclick = close;
    box.appendChild(h);
    box.appendChild(el('div', 'sub', '说出你想要的新模块 · 小云接入大模型 API 后独立完成开发'));

    var f1 = el('fieldset'); f1.appendChild(el('legend', null, '① 大模型接入'));
    var r1 = el('div', 'row'); var sel = el('select');
    PRESETS.forEach(function (p, i) { var o = el('option', null, p.n); o.value = i; sel.appendChild(o); });
    r1.appendChild(sel);
    f1.appendChild(r1);
    var r2 = el('div', 'row');
    var inU = el('input'); inU.placeholder = 'API 地址 (base url)'; inU.value = c.u || PRESETS[0].u;
    var inM = el('input'); inM.placeholder = '模型名'; inM.value = c.m || PRESETS[0].m;
    var inK = el('input'); inK.placeholder = 'API Key（仅存本机浏览器）'; inK.type = 'password'; inK.value = c.k || '';
    r2.appendChild(inU); r2.appendChild(inM);
    f1.appendChild(r2); f1.appendChild(el('div', 'row')).appendChild(inK);
    sel.onchange = function () { var p = PRESETS[sel.value]; if (p.u) { inU.value = p.u; inM.value = p.m; } };
    box.appendChild(f1);

    var f2 = el('fieldset'); f2.appendChild(el('legend', null, '② 想要什么模块？'));
    var ta = el('textarea'); ta.placeholder = '例：加一个「每日签到」模块，签到领灵感积分，有连续签到日历…';
    f2.appendChild(ta);
    var chips = el('div', 'chips');
    ['每日签到日历','专注写作番茄钟','随机世界骰子','灵感碎片收集罐','角色关系图谱','打字机小游戏'].forEach(function (s) {
      var cp = el('span', 'chip', s); cp.onclick = function () { ta.value = '加一个「' + s + '」模块，要求界面精致、交互完整、贴合云境世界观。'; };
      chips.appendChild(cp);
    });
    f2.appendChild(chips);
    var go = el('button', 'go', '⚡ 让小云开工');
    f2.appendChild(go);
    var st = el('div', 'status');
    f2.appendChild(st);
    box.appendChild(f2);

    var prev = el('div', 'prev');
    var pbar = el('div', 'bar');
    var ptitle = el('b', null, '模块预览');
    var bMount = el('button', 'pbtn', '挂载到大厅');
    var bDisk = el('button', 'pbtn', '写入项目源码');
    var bOpen = el('button', 'pbtn', '全屏运行');
    pbar.appendChild(ptitle); pbar.appendChild(bMount); pbar.appendChild(bDisk); pbar.appendChild(bOpen);
    DEV.varifr = el('iframe');
    prev.appendChild(pbar); prev.appendChild(DEV.varifr);
    box.appendChild(prev);

    var f3 = el('fieldset'); f3.appendChild(el('legend', null, '③ 已装模块'));
    var ul = el('ul', 'installed');
    function renderList() {
      ul.innerHTML = '';
      var ms = mods();
      if (!ms.length) ul.appendChild(el('li', null, '<span style="color:#8a84b0">还没有装上模块——让小云造第一个吧。</span>'));
      ms.forEach(function (m, i) {
        var li = el('li');
        li.appendChild(el('b', null, m.name));
        var b1 = el('button', 'pbtn', '运行'); b1.onclick = function () { run(m); };
        var b2 = el('button', 'pbtn', '移除'); b2.onclick = function () { var a = mods(); a.splice(i, 1); saveMods(a); renderList(); };
        li.appendChild(b1); li.appendChild(b2);
        ul.appendChild(li);
      });
    }
    renderList();
    f3.appendChild(ul);
    box.appendChild(f3);
    box.appendChild(el('div', 'hint', '·「挂载到大厅」：模块存入本机模块库，随时从这里运行（刷新不丢）。<br>·「写入项目源码」：授权项目文件夹后，小云把模块真实写入 modules/ 目录并更新 registry.json——相当于直接修改源码。<br>· 没填 Key 也能体验：小云用内置模板生成演示模块；接入 API 后可按任何需求独立开发，且会<b>自检运行错误并自动修复（最多2轮）</b>。<br><br>🔒 <b>隐私承诺：</b>模块与代码只保存在你的本机（浏览器模块库 / 你授权的本地目录），代码层<b>无任何上传、无任何 git/GitHub 操作</b>，且项目 .gitignore 已永久排除 modules/ 目录——玩家造的东西绝不会被同步到仓库。唯一的外发请求，是把需求文本发给你自己配置的大模型 API。'));

    var lastHTML = '', lastName = '';

    go.onclick = function () {
      var wish = ta.value.trim();
      if (!wish) { st.className = 'status err'; st.textContent = '先说说你想要什么模块～'; return; }
      go.disabled = true; st.className = 'status'; st.textContent = '小云正在开发中：分析需求 → 设计界面 → 编写代码…';
      saveCfg({ u: inU.value.trim(), m: inM.value.trim(), k: inK.value.trim() });
      var key = inK.value.trim(), base = inU.value.trim(), model = inM.value.trim();
      curAPI = (key && base) ? { key: key, base: base, model: model } : null;
      if (key && base) {
        fetch(base.replace(/\/$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: model, messages: [{ role: 'system', content: SYS }, { role: 'user', content: wish }], temperature: 0.7 })
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error && j.error.message || ('HTTP ' + r.status)); return j; }); })
          .then(function (j) {
            var html = j.choices[0].message.content.replace(/^```[a-z]*\n?|```\n?$/g, '');
            done(html, wish, false);
          })
          .catch(function (e) { st.className = 'status err'; st.textContent = 'API 调用失败：' + e.message + '（已改用内置模板生成演示模块）'; done(demo(wish), wish, true); });
      } else {
        setTimeout(function () { done(demo(wish), wish, true); }, 700);
      }
    };
    function done(html, wish, demoMode) {
      lastHTML = html; lastName = wish.replace(/^(加一个|做一个|添加)?[「"?]?([^\s，。,「"]{2,10})[」"?]?.*$/, '$2') || ('模块' + Date.now() % 1000);
      DEV.wish = wish; DEV.api = curAPI; DEV.fix = 0; DEV.busy = false;
      go.disabled = false;
      st.className = 'status';
      st.textContent = demoMode ? '✅ 演示模块已生成——自检中…' : '✅ 开发完成——自检中…';
      ptitle.textContent = '模块预览 · ' + lastName;
      mountHTML(html);
      prev.classList.add('on');
      clearTimeout(DEV.tt);
      DEV.tt = setTimeout(function () {
        if (DEV.html === html && !DEV.busy && st.className === 'status') {
          st.textContent = demoMode ? '✅ 自检通过（内置模板演示）——接入 API 后可按任意需求独立开发' : '✅ 自检通过，无运行错误——可挂载或写入源码';
        }
      }, 2200);
    }
    bMount.onclick = function () {
      if (!DEV.html) return;
      var a = mods(); a.unshift({ name: lastName, html: DEV.html, at: Date.now() }); saveMods(a);
      renderList(); st.textContent = '✅「' + lastName + '」已挂载到大厅模块库';
    };
    bOpen.onclick = function () { if (DEV.html) run({ name: lastName, html: DEV.html }); };
    bDisk.onclick = function () {
      if (!DEV.html) return;
      if (!window.showDirectoryPicker) { st.className = 'status err'; st.textContent = '当前浏览器不支持目录写入（需 Chrome/Edge 桌面版）。请用「挂载到大厅」或复制源码。'; return; }
      window.showDirectoryPicker({ mode: 'readwrite' }).then(function (dir) {
        return dir.getDirectoryHandle('modules', { create: true }).then(function (md) {
          var fname = 'xy-' + Date.now().toString(36) + '.html';
          return md.getFileHandle(fname, { create: true }).then(function (fh) {
            return fh.createWritable().then(function (w) { w.write(DEV.html); return w.close(); }).then(function () {
              return md.getFileHandle('registry.json', { create: true }).then(function (rh) {
                return rh.createWritable().then(function (w2) {
                  return w2.write(JSON.stringify({ modules: [{ file: 'modules/' + fname, name: lastName }] }, null, 2)).then(function () { return w2.close(); });
                });
              }).then(function () { st.textContent = '✅ 已写入项目源码：modules/' + fname + ' + registry.json —— 小云直接修改了源文件！'; });
            });
          });
        });
      }).catch(function (e) { if (e.name !== 'AbortError') { st.className = 'status err'; st.textContent = '写入失败：' + e.message; } });
    };
  }
  function run(m) {
    var r = el('div', 'xy-dev on'); r.style.zIndex = 9999;
    var b = el('div', 'xy-dev-box'); b.style.padding = '0'; b.style.overflow = 'hidden'; b.style.height = '82vh'; b.style.display = 'flex'; b.style.flexDirection = 'column';
    var bar = el('div', 'bar'); bar.style.cssText = 'padding:12px 16px;display:flex;gap:10px;align-items:center';
    bar.appendChild(el('b', null, '🧩 ' + m.name));
    var x = el('span', 'pbtn', '关闭'); x.style.marginLeft = 'auto'; x.onclick = function () { r.remove(); };
    bar.appendChild(x);
    var fr = el('iframe'); fr.srcdoc = m.html; fr.style.cssText = 'flex:1;border:none;width:100%;background:#fff';
    b.appendChild(bar); b.appendChild(fr); r.appendChild(b); document.body.appendChild(r);
  }
  function demo(wish) {
    var name = (wish.match(/[「"]?([^\s，。,"「"]{2,8})[」"]?$/) || [])[1] || '新模块';
    var feats = /签到|日历/.test(wish) ? ['连续签到日历','每日灵感积分','补签卡'] : /钟|专注/.test(wish) ? ['25 分钟专注','番茄统计','白噪音开关'] : /骰|随机/.test(wish) ? ['廿八界随机漫游','命运三连抽','结果回溯'] : ['条目收集','标签归类','灵感回顾'];
    var li = feats.map(function (f) { return '<li>✦ ' + f + '</li>'; }).join('');
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
      + '*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Noto Sans SC",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;'
      + 'background:linear-gradient(160deg,#eef1ff,#fdeef6);color:#33304a;padding:28px}'
      + '.c{max-width:420px;width:100%;background:#fff;border-radius:20px;padding:28px;box-shadow:0 18px 44px rgba(90,80,180,.18)}'
      + 'h1{font-size:22px;letter-spacing:.05em}h1 i{font-style:normal;color:#8a7bf0}'
      + 'ul{list-style:none;margin:18px 0}li{padding:11px 0;border-bottom:1px dashed #e4e0f4;font-size:14.5px}'
      + '.b{width:100%;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;'
      + 'background:linear-gradient(120deg,#7e8cff,#b78cff)}</style></head><body><div class="c">'
      + '<h1>🧩 ' + name + ' <i>· 小云演示版</i></h1>'
      + '<p style="font-size:12px;color:#9a94b8;margin-top:6px">需求：' + wish.slice(0, 60) + '</p>'
      + '<ul>' + li + '</ul>'
      + '<button class="b" onclick="this.textContent=\'✅ 已记录（演示交互）\'">开始使用</button>'
      + '<p style="font-size:11px;color:#b0aac8;margin-top:14px;line-height:1.7">内置模板演示 —— 接入大模型 API 后，小云将按完整需求独立编写真正可用的模块代码。</p>'
      + '</div></body></html>';
  }
  function open() { build(); ov.classList.add('on'); }
  function close() { ov.classList.remove('on'); }
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  window.XYDev = { open: open, close: close };
})();
