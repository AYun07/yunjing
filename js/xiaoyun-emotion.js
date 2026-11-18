/* 小云 · 动作驱动（v4.33.0 · 全预设 / 零 API / 全形态精细情绪）
   职责：监听玩家输入 → 匹配动作意图 → 把右下角小云从静态立绘切换为对应的
        「提前生成好」的本地预设动作视频，播放若干秒后回到默认立绘。

   设计约束（v4.32.0 起彻底收口，v4.33.0 全形态补齐）：
   · 纯前端、零后端；全部素材是 assets/videos/ 下提前生成好的透明 WebM。
   · 运行时不发起任何网络请求、不内置任何生图/生视频 API、不留"实时生成"接口。
   · 未命中预设 → 正常聊天不干预；命中但某形态情绪视频缺失（生成中）→ 精确回退
     到该形态最接近的基础动作（happy/wave/battle）→ 再不行回静态立绘。全程本地文件。
   · 不改动 xiaoyun-buddy.js 的对话逻辑，只做 DOM 层临时替换 + 输入监听。
   · 全局单例 window.XYEmotion，暴露 match/setEmotion/reset 供测试与调试。

   预设清单（磁盘实测 132 条透明 WebM）：
   · 精细情绪：全部 12 形态各 8 条（cheer/angry/pout/shy/surprised/think/sleep/proud）= 96 条
   · 基础动作：全部 12 形态各 3 条（happy 开心 / wave 挥手 / battle 战斗）= 36 条 */
(function () {
  var FORM_KEY = ['wenrou', 'aojiao', 'keai', 'gaoguai', 'yu', 'qingchun',
    'luo', 'jiaohua', 'linjia', 'kusa', 'youtai', 'zhixing'];
  var FORM_CN2 = { wenrou: '温柔', aojiao: '傲娇', keai: '可爱', gaoguai: '高傲',
    yu: '雨', qingchun: '青春', luo: '萝莉', jiaohua: '校花', linjia: '邻家',
    kusa: '酷飒', youtai: '幼态', zhixing: '知性' };

  // 精细情绪动作：全 12 形态均已生成专属视频（v4.33.0 全量）。
  // 若某个形态的情绪视频尚未落盘（生成中），video.onerror 会自动回退到该形态基础动作。
  var EMO_FORMS = { wenrou: true, aojiao: true, keai: true, gaoguai: true,
    yu: true, qingchun: true, luo: true, jiaohua: true, linjia: true,
    kusa: true, youtai: true, zhixing: true };

  // 精细情绪 → 最接近的基础动作（情绪视频缺失时的回退兜底）
  var EMO_TO_BASE = {
    cheer: 'happy', angry: 'battle', pout: 'wave', shy: 'happy',
    surprised: 'battle', think: 'happy', sleep: 'happy', proud: 'battle'
  };

  // 基础动作（全 12 形态都有）
  var BASE_ACTIONS = { happy: true, wave: true, battle: true };

  // 情绪 → 关键词（按优先级从上到下匹配）
  var INTENTS = [
    { emo: 'sleep',     kw: ['困', '睡觉', '睡吧', '打哈欠', '累了', '想睡', '晚安', '眼皮'] },
    { emo: 'surprised', kw: ['惊讶', '震惊', '什么', '哇', '居然', '没想到', '惊呆', '吓'] },
    { emo: 'angry',     kw: ['生气', '愤怒', '气死', '讨厌', '可恶', '发火', '恼', '火大'] },
    { emo: 'shy',       kw: ['害羞', '脸红', '别这样', '羞', '不好意思', '害臊'] },
    { emo: 'pout',      kw: ['哼', '才不是', '不理你', '傲娇', '撇嘴', '才没有', '哼哼'] },
    { emo: 'think',     kw: ['想想', '思考', '让我想', '嗯…', '嗯...', '琢磨', '考虑', '怎么办'] },
    { emo: 'proud',     kw: ['得意', '本小姐', '嘿嘿', '骄傲', '厉害吧', '厉害的我', '得意洋洋'] },
    { emo: 'cheer',     kw: ['开心', '高兴', '太好了', '欢呼', ' yay', '庆祝', '哈哈', '好耶', '兴奋'] }
  ];

  // 基础动作 → 关键词（全形态通用，命中即播该形态基础动作视频）
  var BASE_INTENTS = [
    { act: 'battle', kw: ['战斗', '攻击', '出击', '冲啊', '上吧', '应战', '拳头', '打倒'] },
    { act: 'wave',   kw: ['挥手', '招手', '你好', '打招呼', '嗨', '再见', '拜拜', '哈喽'] },
    { act: 'happy',  kw: ['笑一个', '笑一下', '开心点', '高兴点', '转圈', '跳个舞', '跳舞', '表演'] }
  ];

  var KEEP_MS = 4200;
  var currentFormKey = 'aojiao';
  var video = null, playing = false, resetTimer = null, origSrc = null;
  var orb = null, img = null;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function ensureDom() {
    if (orb && img && img.isConnected) return true;
    orb = q('#xyBuddy .xy-orb');
    img = orb && q('img', orb);
    if (!orb || !img) return false;
    if (!origSrc) origSrc = img.getAttribute('src');
    return true;
  }
  function detectForm() {
    var head = q('#xyBuddy .xy-head b');
    var txt = head ? head.textContent : '';
    for (var i = 0; i < FORM_KEY.length; i++) {
      if (txt.indexOf(FORM_CN2[FORM_KEY[i]]) >= 0) return FORM_KEY[i];
    }
    return currentFormKey || 'aojiao';
  }

  function has(text, kws) {
    if (!text) return false;
    var s = String(text).toLowerCase();
    for (var i = 0; i < kws.length; i++) if (s.indexOf(kws[i].toLowerCase()) >= 0) return true;
    return false;
  }

  // 返回 {kind:'emo'|'base', emo?, act?}；未命中返回 null
  function match(text) {
    if (!text) return null;
    for (var i = 0; i < INTENTS.length; i++) {
      if (has(text, INTENTS[i].kw)) return { kind: 'emo', emo: INTENTS[i].emo };
    }
    for (var j = 0; j < BASE_INTENTS.length; j++) {
      if (has(text, BASE_INTENTS[j].kw)) return { kind: 'base', act: BASE_INTENTS[j].act };
    }
    return null;
  }

  // 把意图解析成本地预设视频路径（含形态回退）。返回 {src, desc} 或 null。
  function resolveSrc(intent, formKey) {
    if (intent.kind === 'emo') {
      if (EMO_FORMS[formKey]) {
        return { src: 'assets/videos/xiaoyun-' + formKey + '-emo-' + intent.emo + '.webm',
                 desc: formKey + '/' + intent.emo };
      }
      var base = EMO_TO_BASE[intent.emo] || 'happy';
      return { src: 'assets/videos/xiaoyun-' + formKey + '-' + base + '.webm',
               desc: formKey + '/' + base + '(回退自' + intent.emo + ')' };
    }
    if (intent.kind === 'base' && BASE_ACTIONS[intent.act]) {
      return { src: 'assets/videos/xiaoyun-' + formKey + '-' + intent.act + '.webm',
               desc: formKey + '/' + intent.act };
    }
    return null;
  }

  function reset(restoreImg) {
    clearTimeout(resetTimer);
    if (video) {
      try { video.pause(); } catch (e) {}
      if (video.parentNode) video.parentNode.removeChild(video);
      video = null;
    }
    playing = false;
    if (restoreImg && img) {
      img.style.display = '';
      try { if (window.XYBuddy && window.XYBuddy.currentImg) img.src = window.XYBuddy.currentImg(); } catch (e) {}
    }
  }

  // 统一播放入口：intent 为 {kind,emo/act}；opts.src 可覆盖（用于直接指定路径的测试）
  function setEmotion(intent, opts) {
    opts = opts || {};
    if (!ensureDom()) return false;
    currentFormKey = detectForm();
    var picked = opts.src ? { src: opts.src, desc: 'override' } : resolveSrc(intent, currentFormKey);
    if (!picked) return false;
    if (playing && video) reset(false);
    video = document.createElement('video');
    video.autoplay = true; video.loop = true; video.muted = true;
    video.playsInline = true; video.setAttribute('muted', '');
    video.className = 'xy-emo-video';
    video.src = picked.src;
    // 加载失败（该形态情绪视频尚未生成）→ 回退到该形态最接近的基础动作 → 再不行回静态图，全程本地
    video.onerror = function () {
      window.__emoErr = (video.error && video.error.code) || 'unknown';
      window.__emoSrc = video.currentSrc || video.src;
      if (!opts._retry && intent && intent.kind === 'emo') {
        var fbAct = EMO_TO_BASE[intent.emo] || 'happy';
        var fb = 'assets/videos/xiaoyun-' + currentFormKey + '-' + fbAct + '.webm';
        if (fb !== picked.src) { setEmotion({ kind: 'base', act: fbAct }, { _retry: true, src: fb }); return; }
      }
      reset(true);
    };
    img.style.display = 'none';
    orb.insertBefore(video, img);
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    playing = true;
    window.__emoPlaying = picked.desc;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () { reset(true); }, opts.keepMs || KEEP_MS);
    return true;
  }

  function onInput(text) {
    var intent = match(text);
    if (!intent) return false;          // 未命中：正常聊天，不干预、不弹任何提示
    return setEmotion(intent);          // 命中：一律播本地预设视频
  }

  var lastText = '';
  function install() {
    if (window.__xyEmotionInstalled) return;
    window.__xyEmotionInstalled = true;
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t && t.tagName === 'INPUT' && t.closest && t.closest('#xyBuddy .xy-form')) lastText = t.value;
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var t = e.target;
      if (t && t.tagName === 'INPUT' && t.closest && t.closest('#xyBuddy .xy-form')) {
        var txt = t.value || lastText;
        lastText = '';
        setTimeout(function () { onInput(txt); }, 0);
      }
    }, true);
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#xyBuddy .xy-form button')) {
        var txt = lastText; lastText = '';
        setTimeout(function () { onInput(txt); }, 0);
      }
      var qb = t.closest('.xy-quick button, .xy-mod');
      if (qb) onInput(qb.textContent || '');
    }, true);
    ensureDom();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  window.XYEmotion = {
    match: match,
    setEmotion: setEmotion,
    reset: function () { reset(true); },
    onInput: onInput,
    install: install,
    preset: { emoForms: EMO_FORMS, emoToBase: EMO_TO_BASE, baseActions: BASE_ACTIONS },
    version: '4.33.0-all-forms'
  };
})();
