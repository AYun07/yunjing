/* 云境 · 跨域守卫 v1.0.0（v4.15.0）
 *
 * 背景
 *   云境是**纯前端**应用：浏览器直接向 LLM 接口发请求。相当多官方端点
 *   （integrate.api.nvidia.com / api.openai.com / api.anthropic.com …）
 *   不返回 Access-Control-Allow-Origin，浏览器在预检阶段就拦掉，页面只会看到
 *   `TypeError: Failed to fetch`，玩家完全不知道自己是被同源策略挡了。
 *   这不是云境的 bug，但没有后端就绕不过——除非走本机代理。
 *
 * 本模块做三件事
 *   ① 预判：保存配置时对「已知不支持跨域」的主机给出预警与下一步；
 *   ② 探测：连通测试时用真请求区分「跨域被拦 / Key 错 / 模型名错 / 网络不通 / 超时」，
 *      而不是笼统地报一句请求失败；
 *   ③ 接入：把接口地址包成 / 还原自本地代理地址（tools/cors-proxy.mjs），
 *      让被 CORS 拦住的官方端点也能在纯前端里用起来。
 *
 * 纯函数 + 一个探测函数，不改任何业务逻辑，失败一律不阻断。
 */
(function () {
  'use strict';

  /* 已知「官方直连不给跨域」的主机（前缀/后缀匹配）。
     注意：这不是黑名单式的封杀，只是**提前提醒**——真有中转站用了同域名也能用，
     所以这里只用于「保存时提示 + 探测失败时给方向」，不阻止任何配置。 */
  var KNOWN_NO_CORS = [
    'integrate.api.nvidia.com', 'api.nvidia.com',
    'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
    'api.deepseek.com', 'api.moonshot.cn', 'open.bigmodel.cn',
    'api.mistral.ai', 'api.together.xyz', 'api.groq.com',
    'api.x.ai', 'api.perplexity.ai'
  ];
  /* 已知「通常允许跨域」的主机（只用于正向提示，不参与拦截） */
  var LIKELY_CORS_OK = ['api.siliconflow.cn', 'dashscope.aliyuncs.com', 'openrouter.ai', 'api.jina.ai'];

  var PROXY_DEFAULT = 'http://127.0.0.1:8799';

  function cleanUrl(u) { return String(u == null ? '' : u).trim().replace(/\s+/g, '').replace(/\/+$/, ''); }

  function hostOf(endpoint) {
    var s = cleanUrl(endpoint);
    if (!s) return '';
    try { return new URL(s).hostname.toLowerCase(); } catch (e) {}
    var m = /^https?:\/\/([^\/:]+)/i.exec(s);
    return m ? m[1].toLowerCase() : '';
  }

  function isKnownNoCors(endpoint) {
    var h = hostOf(endpoint);
    if (!h) return false;
    for (var i = 0; i < KNOWN_NO_CORS.length; i++) {
      var k = KNOWN_NO_CORS[i];
      if (h === k || h.endsWith('.' + k)) return true;
    }
    return false;
  }
  function isLikelyCorsOk(endpoint) {
    var h = hostOf(endpoint);
    if (!h) return false;
    for (var i = 0; i < LIKELY_CORS_OK.length; i++) {
      var k = LIKELY_CORS_OK[i];
      if (h === k || h.endsWith('.' + k)) return true;
    }
    return false;
  }

  /* ---- 代理地址互转 ----
     代理形式： <proxyBase>/<完整上游 URL>   例： http://127.0.0.1:8799/https://api.openai.com/v1 */
  function isProxied(endpoint) {
    var s = cleanUrl(endpoint);
    return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/https?:\/\//i.test(s);
  }
  function upstreamOf(endpoint) {
    var s = cleanUrl(endpoint);
    if (!isProxied(s)) return '';
    var m = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/(https?:\/\/.+)$/i.exec(s);
    return m ? m[1] : '';
  }
  function proxyBaseOf(endpoint) {
    var s = cleanUrl(endpoint);
    if (!isProxied(s)) return '';
    var m = /^(https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)\//i.exec(s);
    return m ? m[1] : '';
  }
  function toProxy(endpoint, proxyBase) {
    var base = cleanUrl(proxyBase) || PROXY_DEFAULT;
    var up = isProxied(endpoint) ? upstreamOf(endpoint) : cleanUrl(endpoint);
    if (!up) return endpoint;
    return base.replace(/\/+$/, '') + '/' + up;
  }
  function fromProxy(endpoint) {
    return isProxied(endpoint) ? upstreamOf(endpoint) : endpoint;
  }

  /* ---- 真探测：把「发不出去」细分成可执行原因 ----
     返回 { kind, http, ms, detail }
       ok         能拿到 HTTP 响应（无论 200/401/404 —— 跨域这一关已过）
       cors       网络通、但被同源策略拦下（证明该端点不给跨域头）
       auth       401/403
       notfound   404（多半模型名或路径不对）
       ratelimit  429
       server     5xx
       timeout    超时/被中止
       network    连不上（离线 / 地址写错 / 被防火墙拦）
       unknown    其它
  */
  function probeCors(endpoint, apiKey, opts) {
    opts = opts || {};
    var url = cleanUrl(endpoint);
    if (!url) return Promise.resolve({ kind: 'unknown', detail: '接口地址为空' });
    var ms = opts.timeout || 20000;
    var t0 = Date.now();
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);

    function finish(r) {
      clearTimeout(timer);
      r.ms = Date.now() - t0;
      return r;
    }

    /* 用最小代价探：优先打 /models（GET，不消耗生成额度）。
       v4.15.0 修：旧写法只在地址以 /chat/completions 结尾时才改写，而玩家在设置里
       通常只填到 `/v1`（应用自己再拼 /chat/completions）——于是探测去打裸 `/v1`，
       拿到 404 并把结论误判成「模型名不存在」。现在两种情况都正确落到 /models。 */
    var tryUrl = /\/chat\/completions\s*$/i.test(url)
      ? url.replace(/\/chat\/completions\s*$/i, '/models')
      : url.replace(/\/+$/, '') + '/models';
    var headers = {};
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

    return fetch(tryUrl, { method: 'GET', headers: headers, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        var k = res.status === 401 || res.status === 403 ? 'auth'
              : res.status === 404 ? 'notfound'
              : res.status === 429 ? 'ratelimit'
              : res.status >= 500 ? 'server' : 'ok';
        return finish({ kind: k, http: res.status, detail: 'HTTP ' + res.status });
      })
      .catch(function (e) {
        var name = String((e && e.name) || '');
        if (name === 'AbortError') return finish({ kind: 'timeout', detail: '超过 ' + Math.round(ms / 1000) + ' 秒无响应' });
        /* 到这里 CORS 与「真连不上」还分不开 —— 用 no-cors 再探一次：
           no-cors 请求不读响应（opaque），只要TCP能到就会 resolve。
           它 resolve 而上面 reject ⇒ 网络是通的，纯粹是被同源策略挡了。 */
        var ctrl2 = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var t2 = setTimeout(function () { try { ctrl2 && ctrl2.abort(); } catch (e2) {} }, Math.min(ms, 12000));
        return fetch(tryUrl, { method: 'GET', mode: 'no-cors', signal: ctrl2 ? ctrl2.signal : undefined })
          .then(function () { clearTimeout(t2); return finish({ kind: 'cors', detail: '网络可达，但该端点未返回跨域许可（Access-Control-Allow-Origin）' }); })
          .catch(function () { clearTimeout(t2); return finish({ kind: 'network', detail: String((e && e.message) || e).slice(0, 120) }); });
      });
  }

  /* 给玩家看的下一步（与探测结论一一对应） */
  function verdictHtml(kind) {
    switch (kind) {
      case 'ok': return '✅ 接口可达（跨域与网络都没问题）。';
      case 'cors':
        return '🛡 <b>被浏览器同源策略拦下了</b>：这个端点没有返回跨域许可，纯前端页面无法直连。<br>'
             + '两条路：<b>①（推荐）</b>向下滚动到「🛡 本地代理」，双击项目里的 <code>start-proxy-windows.bat</code>'
             + '（Mac 用 <code>start-proxy-mac.command</code>）后点【接入本地代理】；'
             + '<b>②</b>改用支持跨域的中转站地址。';
      case 'auth': return '🔑 Key 被拒绝（401/403）。核对 API Key 与地址是否属于同一家服务商。';
      case 'notfound': return '🔍 路径或模型名不存在（404）。试试点「拉取模型列表」选一个可用模型。';
      case 'ratelimit': return '⏳ 触发限流或额度不足（429）。等一分钟，或换一把 Key。';
      case 'server': return '🔧 服务端 5xx，是对方接口的问题。稍后重试或换模型/中转。';
      case 'timeout': return '⌛ 超时。到「接口设置」把超时秒数调大（长章建议 600），或换更快的模型。';
      case 'network': return '📡 连不上：地址写错 / 离线 / 被防火墙拦。确认地址以 <code>/v1</code> 结尾且外网可达。';
      default: return '❓ 未识别的失败原因，请看浏览器控制台的原始报错。';
    }
  }

  window.CorsGuard = {
    PROXY_DEFAULT: PROXY_DEFAULT,
    KNOWN_NO_CORS: KNOWN_NO_CORS,
    LIKELY_CORS_OK: LIKELY_CORS_OK,
    hostOf: hostOf,
    isKnownNoCors: isKnownNoCors,
    isLikelyCorsOk: isLikelyCorsOk,
    isProxied: isProxied,
    upstreamOf: upstreamOf,
    proxyBaseOf: proxyBaseOf,
    toProxy: toProxy,
    fromProxy: fromProxy,
    probeCors: probeCors,
    verdictHtml: verdictHtml
  };
})();
