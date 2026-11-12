#!/usr/bin/env node
/* 云境 · 本地跨域代理 v1.0.0（v4.14.0）
 *
 * 为什么需要它
 *   云境是**纯前端**应用：浏览器直接向 LLM 接口发请求。而相当多官方端点
 *   （integrate.api.nvidia.com / api.openai.com / api.anthropic.com …）
 *   **不返回 Access-Control-Allow-Origin**，浏览器会在预检阶段就拦掉，
 *   表现为控制台 CORS 报错、页面拿到 `TypeError: Failed to fetch`。
 *   这不是云境的 bug，是浏览器的同源策略——任何纯前端页面都绕不过去。
 *
 * 它怎么解决
 *   在**本机**起一个有 CORS 头的转发服务。把接口地址写成
 *       http://127.0.0.1:8799/https://integrate.api.nvidia.com/v1
 *   云境会把 `/chat/completions` 接在后面，本代理识别出路径里的上游 URL，
 *   原样转发（含 Authorization 与请求体），再把响应连同 CORS 头回给页面。
 *   请求由 Node 发出，**不经过浏览器同源策略**，因此不会再被拦。
 *
 * 特点
 *   · 零依赖（只用 Node 内置模块），Node 18+ 即可
 *   · 不改动云境任何业务代码；不改动你的 API Key 用途，Key 只在本机转发时使用
 *   · 只监听 127.0.0.1（不对外网暴露）
 *   · 支持流式（SSE）逐块透传，打字机效果不受影响
 *   · 支持 GET/POST/PUT/PATCH/DELETE/OPTIONS
 *
 * 用法
 *   node tools/cors-proxy.mjs            # 默认端口 8799
 *   node tools/cors-proxy.mjs 9000       # 指定端口
 *   然后到云境「接口设置 → 🛡 本地代理」点「接入本地代理」。
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.argv[2]) || 8799;
const HOST = '127.0.0.1';
/* 允许被代理的上游主机白名单（前缀匹配）。留空数组 = 不限制（本机自用）。
   限制的意义：避免这个本机端口被当成开放代理去访问任意地址。 */
const ALLOW = [
  'integrate.api.nvidia.com', 'api.openai.com', 'api.anthropic.com',
  'generativelanguage.googleapis.com', 'api.deepseek.com', 'api.moonshot.cn',
  'dashscope.aliyuncs.com', 'open.bigmodel.cn', 'api.siliconflow.cn',
  'api.minimax.chat', 'ark.cn-beijing.volces.com', 'api.mistral.ai',
  'api.together.xyz', 'api.groq.com', 'openrouter.ai', 'api.x.ai',
  'api.perplexity.ai', 'api.jina.ai', 'ollama.com'
];

function corsHeaders(extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  }, extra || {});
}

function send(res, code, body, headers) {
  res.writeHead(code, corsHeaders(headers));
  res.end(body);
}

/* 从路径里解出上游 URL：/https://host/path…  或 /http://host/path… */
function parseTarget(pathname) {
  const m = /^\/(https?:\/\/.+)$/i.exec(pathname);
  if (!m) return null;
  try {
    const u = new URL(m[1]);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (ALLOW.length && !ALLOW.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return null;
    return u;
  } catch (e) { return null; }
}

const server = http.createServer((req, res) => {
  /* 预检：直接放行 */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  /* 根路径给个自检页，方便确认代理活着 */
  if (req.url === '/' || req.url.startsWith('/?')) {
    return send(res, 200, JSON.stringify({
      ok: true, service: 'yunjing-cors-proxy', version: '1.0.0',
      hint: '把接口地址写成 http://127.0.0.1:' + PORT + '/https://上游域名/路径',
      allow: ALLOW
    }, null, 1), { 'Content-Type': 'application/json; charset=utf-8' });
  }

  const target = parseTarget(req.url);
  if (!target) {
    return send(res, 404, JSON.stringify({
      ok: false,
      error: '路径里没有可识别的上游 URL（或被白名单拒绝）',
      hint: '正确形式：http://127.0.0.1:' + PORT + '/https://integrate.api.nvidia.com/v1',
      allow: ALLOW
    }, null, 1), { 'Content-Type': 'application/json; charset=utf-8' });
  }

  /* 收集请求体后转发 */
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      /* 去掉会干扰上游的主机类头；forwarded 类一律不传 */
      if (['host', 'origin', 'referer', 'connection', 'content-length',
           'accept-encoding', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-dest'].includes(lk)) continue;
      headers[k] = v;
    }
    if (body.length) headers['Content-Length'] = String(body.length);

    const mod = target.protocol === 'https:' ? https : http;
    const opt = {
      method: req.method,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      headers
    };
    const t0 = Date.now();

    /* v4.14.0：对上游的**瞬时故障**做带退避的重试。
       实测 NVIDIA 免费档在并发或高峰时会大量返回 503 / 直接 ECONNRESET
       （一次 100 请求里 52 次 reset、13 次 503），而这些请求根本没进模型，
       重试是安全的、也是玩家唯一能拿回结果的办法。
       只重试「连接层失败」与 502/503/504；一旦拿到正常响应就立刻透传，
       4xx（Key 错/模型名错）一律不重试，避免把明确错误拖成超时。 */
    const MAX_TRY = 3, BACKOFF = [1000, 3500];
    let attempt = 0;

    const RETRYABLE = [502, 503, 504];
    const backoff = () => new Promise((r) => setTimeout(r, BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)]));
    const canRetry = () => attempt < MAX_TRY;

    const doAttempt = () => {
      attempt++;
      const up = mod.request(opt, (ur) => {
        const code = ur.statusCode || 502;
        /* 可重试的状态码：先把错误体读完再退避重试，不能直接 pipe 出去 */
        if (RETRYABLE.includes(code) && canRetry()) {
          const bufs = [];
          ur.on('data', (c) => bufs.push(c));
          ur.on('end', async () => {
            const snippet = Buffer.concat(bufs).toString('utf8').slice(0, 160).replace(/\s+/g, ' ');
            console.log(`[proxy] ${req.method} ${target.hostname}${target.pathname}  ${code} 第${attempt}次 → 退避重试  ${Date.now() - t0}ms  ${snippet}`);
            await backoff();
            doAttempt();
          });
          ur.on('error', async () => { await backoff(); doAttempt(); });
          return;
        }
        /* 拿到可用响应（或已用尽重试）：原样透传，补上 CORS；流式靠 pipe 天然逐块传 */
        const out = {};
        for (const [k, v] of Object.entries(ur.headers)) {
          const lk = k.toLowerCase();
          if (['content-encoding', 'transfer-encoding', 'connection'].includes(lk)) continue;
          out[k] = v;
        }
        out['Access-Control-Allow-Origin'] = '*';
        out['Access-Control-Allow-Headers'] = '*';
        out['X-Yunjing-Proxy'] = '1';
        if (attempt > 1) out['X-Yunjing-Proxy-Retries'] = String(attempt - 1);
        res.writeHead(code, out);
        ur.pipe(res);
        ur.on('end', () => {
          console.log(`[proxy] ${req.method} ${target.hostname}${target.pathname}  ${code}${attempt > 1 ? ` (重试${attempt - 1}次后成功)` : ''}  ${Date.now() - t0}ms`);
        });
      });
      up.on('error', async (e) => {
        /* 连接层失败（ECONNRESET / ETIMEDOUT 等）：请求没进模型，可安全重试 */
        if (canRetry() && !res.headersSent) {
          console.log(`[proxy] ${req.method} ${target.hostname}${target.pathname}  ERR ${e.message} 第${attempt}次 → 退避重试`);
          await backoff();
          return doAttempt();
        }
        console.log(`[proxy] ${req.method} ${target.hostname}${target.pathname}  ERR ${e.message}`);
        if (!res.headersSent) {
          send(res, 502, JSON.stringify({
            ok: false, error: '上游请求失败: ' + e.message,
            hint: '已重试 ' + attempt + ' 次仍失败。可能是上游限流/过载/网络问题，稍后重试或更换模型/中转。'
          }, null, 1), { 'Content-Type': 'application/json; charset=utf-8' });
        } else {
          try { res.end(); } catch (e2) {}
        }
      });
      up.setTimeout(600000, () => { up.destroy(new Error('上游响应超时（600s）')); });
      if (body.length) up.write(body);
      up.end();
    };
    doAttempt();
  });
  req.on('error', () => { try { res.end(); } catch (e) {} });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n[!] 端口 ${PORT} 已被占用。换一个端口：node tools/cors-proxy.mjs 8800\n`);
  } else {
    console.error('[!] 启动失败：' + e.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║   云境 · 本地跨域代理已启动                          ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`    监听：http://${HOST}:${PORT}  （只对本机可见）`);
  console.log('');
  console.log('    在云境里怎么填：');
  console.log('      「接口设置 → 🛡 本地代理」点【接入本地代理】即可自动改写，');
  console.log('      或手动把接口地址写成：');
  console.log(`        http://${HOST}:${PORT}/https://你的上游域名/v1`);
  console.log('');
  console.log('    关闭本窗口即停止代理。');
  console.log('');
});
