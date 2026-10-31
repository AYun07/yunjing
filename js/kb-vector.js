/* 云境 · 向量增强检索 v1.1.0（v3.51.1）
   链路：BM25 候选池 → 向量（默认 BAAI/bge-m3）→ 精排（默认 BAAI/bge-reranker-v2-m3）
   接口全自定义：Base URL / API Key / 向量模型 / 重排模型都由使用者自己填，
   默认值只是「硅基流动」的一套常见组合，任何 OpenAI 兼容的 /embeddings + /rerank 都能用。
   失败/超时/未配置 → 逐级降级（重排失败用向量序、向量失败用 BM25），绝不阻断写作。 */
(function () {
  'use strict';

  var CFG_KEY = 'storyKBVectorCfg';

  /* 默认值：仅作初始填充，用户可随意改（不再强制锁定） */
  var DEF_BASE = 'https://api.siliconflow.cn/v1';
  var DEF_EMBED = 'BAAI/bge-m3';
  var DEF_RERANK = 'BAAI/bge-reranker-v2-m3';

  var DEF = {
    enabled: false, apiKey: '',
    baseUrl: DEF_BASE,
    embedModel: DEF_EMBED, rerankModel: DEF_RERANK,
    mode: 'hybrid', candidates: 20, rerankPool: 16, timeout: 8000
  };

  /* 常见可选项：只是输入框的联想，不是白名单 */
  var BASE_TIPS = [
    'https://api.siliconflow.cn/v1',
    'https://api.openai.com/v1',
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    'https://api.jina.ai/v1',
    'http://127.0.0.1:11434/v1'
  ];
  var EMBED_TIPS = [
    'BAAI/bge-m3',
    'BAAI/bge-large-zh-v1.5',
    'netease-youdao/bce-embedding-base_v1',
    'text-embedding-3-small',
    'text-embedding-3-large',
    'jina-embeddings-v3'
  ];
  var RERANK_TIPS = [
    'BAAI/bge-reranker-v2-m3',
    'BAAI/bge-reranker-v2-minicpm-layerwise',
    'netease-youdao/bce-reranker-base_v1',
    'jina-reranker-v2-base-multilingual'
  ];

  var _embCache = new Map(); // id|len -> vector（内存缓存，不落盘）
  var _last = { ms: 0, count: 0, mode: '-', err: '' };

  function trimBase(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    s = s.replace(/\s+/g, '');
    s = s.replace(/\/+$/, '');
    /* 允许只填域名：自动补 /v1 */
    if (!/\/(v\d+|openai|compatible-mode.*)$/i.test(s)) {
      if (/^https?:\/\/[^/]+$/i.test(s)) s += '/v1';
    }
    return s;
  }

  function load() {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { cfg = {}; }
    cfg = Object.assign({}, DEF, cfg);
    /* 不再强制锁定模型；只做「空值回落默认」和格式规整 */
    cfg.baseUrl = trimBase(cfg.baseUrl) || DEF_BASE;
    cfg.embedModel = String(cfg.embedModel || '').trim() || DEF_EMBED;
    cfg.rerankModel = String(cfg.rerankModel || '').trim() || DEF_RERANK;
    cfg.apiKey = String(cfg.apiKey || '').trim();
    cfg.candidates = Math.max(8, Math.min(40, Number(cfg.candidates) || 20));
    cfg.rerankPool = Math.max(4, Math.min(30, Number(cfg.rerankPool) || 16));
    cfg.timeout = Math.max(2000, Math.min(20000, Number(cfg.timeout) || 8000));
    if (['hybrid', 'rerank', 'vector'].indexOf(cfg.mode) < 0) cfg.mode = 'hybrid';
    return cfg;
  }
  function save(patch) {
    var cfg = Object.assign(load(), patch || {});
    cfg.baseUrl = trimBase(cfg.baseUrl) || DEF_BASE;
    cfg.embedModel = String(cfg.embedModel || '').trim() || DEF_EMBED;
    cfg.rerankModel = String(cfg.rerankModel || '').trim() || DEF_RERANK;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    return cfg;
  }
  function isOn() {
    var c = load();
    return !!(c.enabled && c.apiKey);
  }
  function hasRerank() {
    var c = load();
    return !!(c.mode !== 'vector' && c.rerankModel);
  }

  function docText(e) {
    var t = String(e.title || '');
    var g = Array.isArray(e.tags) ? e.tags.join('，') : '';
    var c = typeof e.content === 'object' && e.content !== null ? JSON.stringify(e.content) : String(e.content || '');
    return (t + '。' + g + '。' + c).slice(0, 700);
  }
  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  async function _req(method, path, body, timeout) {
    var cfg = load();
    if (!cfg.apiKey) throw new Error('未填写 API Key');
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, timeout || cfg.timeout);
    try {
      var res = await fetch(cfg.baseUrl + path, {
        method: method,
        headers: {
          'Authorization': 'Bearer ' + cfg.apiKey,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ac.signal
      });
      if (!res.ok) {
        var txt = '';
        try { txt = (await res.text()).slice(0, 200); } catch (e) {}
        throw new Error('HTTP ' + res.status + (txt ? ' ' + txt : ''));
      }
      return await res.json();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('请求超时（' + ((timeout || cfg.timeout) / 1000) + 's）');
      throw e;
    } finally { clearTimeout(timer); }
  }
  function _post(path, body, timeout) { return _req('POST', path, body, timeout); }

  async function embed(texts, timeout) {
    if (!texts.length) return [];
    var cfg = load(), out = [];
    for (var i = 0; i < texts.length; i += 32) {
      var batch = texts.slice(i, i + 32);
      var j = await _post('/embeddings', { model: cfg.embedModel, input: batch }, timeout || cfg.timeout);
      var data = (j && j.data) || [];
      data.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
      for (var k = 0; k < data.length; k++) out.push(data[k].embedding);
    }
    return out;
  }

  async function rerank(query, documents, topN, timeout) {
    if (!documents.length) return [];
    var cfg = load();
    var j = await _post('/rerank', {
      model: cfg.rerankModel,
      query: String(query).slice(0, 500),
      documents: documents,
      top_n: Math.min(topN || 3, documents.length),
      return_documents: false
    }, timeout || cfg.timeout);
    return (j && j.results) || [];
  }

  /**
   * 增强检索：返回条目数组（含 similarity），或 null 表示「应回退 BM25」
   * mode: rerank = BM25→重排；hybrid = BM25+向量(RRF)→重排；vector = BM25候选内向量精排
   * 逐级降级：重排失败 → 用向量/BM25 顺序；向量失败 → 仍可重排；全失败 → null → 纯 BM25
   */
  async function retrieve(sk, query, maxCount) {
    var cfg = load();
    if (!cfg.enabled || !cfg.apiKey) return null;
    if (!query || !String(query).trim()) return null;
    if (!sk || typeof sk._bm25Rank !== 'function') return null;
    var pool = sk._bm25Rank(query, cfg.candidates);
    if (!pool.length) return null;
    var t0 = Date.now();
    var errs = [];
    var ordered = pool.slice();

    if (cfg.mode === 'hybrid' || cfg.mode === 'vector') {
      try {
        var docs = pool.map(docText);
        var texts = [String(query).slice(0, 500)];
        var need = [];
        for (var i = 0; i < pool.length; i++) {
          var key = (pool[i].id || '') + '|' + String(pool[i].content || '').length;
          if (_embCache.has(key)) { texts.push(null); } else { texts.push(docs[i]); need.push(i); }
        }
        var vecs = await embed([texts[0]].concat(need.map(function (i2) { return docs[i2]; })), cfg.timeout);
        if (vecs && vecs.length === need.length + 1) {
          var qv = vecs[0], got = {};
          for (var n = 0; n < need.length; n++) got[need[n]] = vecs[n + 1];
          var sims = pool.map(function (e, idx) {
            var k2 = (e.id || '') + '|' + String(e.content || '').length;
            var v = _embCache.get(k2) || got[idx];
            if (v && !_embCache.get(k2)) _embCache.set(k2, v);
            return v ? cosine(qv, v) : 0;
          });
          var vIdx = pool.map(function (_, i3) { return i3; }).sort(function (a, b) { return sims[b] - sims[a]; });
          var vRank = {};
          vIdx.forEach(function (idx, r) { vRank[idx] = r + 1; });
          ordered = pool.map(function (e, idx) {
            return { e: e, rrf: 1 / (60 + (idx + 1)) + 1 / (60 + (vRank[idx] || 999)) };
          }).sort(function (a, b) { return b.rrf - a.rrf; }).map(function (x) { return x.e; });
        } else {
          errs.push('向量返回条数不符');
        }
      } catch (e) {
        errs.push('向量：' + ((e && e.message) || e));
        console.warn('[KBVector] 向量检索失败，继续用 BM25/重排：', e && e.message);
      }
    }

    if (cfg.mode !== 'vector') {
      try {
        var cand = ordered.slice(0, Math.min(ordered.length, cfg.rerankPool));
        var rr = await rerank(query, cand.map(docText), maxCount || 3, cfg.timeout);
        if (rr && rr.length) {
          var top = rr[0].relevance_score || 1;
          var out = rr.map(function (r) {
            var e = Object.assign({}, cand[r.index]);
            e.similarity = Math.max(0, Math.min(1, (r.relevance_score || 0) / (top || 1)));
            e.via = cfg.mode;
            return e;
          }).filter(function (e) { return e && e.title; });
          if (out.length) {
            _last = { ms: Date.now() - t0, count: out.length, mode: cfg.mode, err: errs.join(' / ') };
            return out;
          }
        }
        errs.push('重排无结果');
      } catch (e) {
        errs.push('重排：' + ((e && e.message) || e));
        console.warn('[KBVector] 重排失败，沿用当前顺序：', e && e.message);
      }
    }

    var plain = ordered.slice(0, maxCount || 3).map(function (e, i4) {
      var o = Object.assign({}, e);
      o.similarity = e.similarity != null ? e.similarity : Math.max(0.3, 1 - i4 * 0.2);
      o.via = cfg.mode;
      return o;
    });
    _last = { ms: Date.now() - t0, count: plain.length, mode: cfg.mode, err: errs.join(' / ') };
    return plain;
  }

  /** 连通性测试：向量与重排各自独立判定（很多中转只有 /embeddings，没有 /rerank） */
  async function test() {
    var cfg = load();
    if (!cfg.apiKey) throw new Error('请先填写 API Key');
    var out = { dim: 0, embedMs: 0, rerankMs: 0, rerank: [], embedErr: '', rerankErr: '' };
    var t0 = Date.now();
    try {
      var v = await embed(['测试：陈平安走进泥瓶巷'], cfg.timeout);
      out.dim = v && v[0] ? v[0].length : 0;
      if (!out.dim) out.embedErr = '向量接口返回空数据';
    } catch (e) { out.embedErr = (e && e.message) || String(e); }
    out.embedMs = Date.now() - t0;

    var t1 = Date.now();
    try {
      var r = await rerank('陈平安在泥瓶巷', ['骊珠洞天泥瓶巷的地理与住户', '唐三的蓝银草武魂觉醒', '剑气长城的守御体系'], 3, cfg.timeout);
      out.rerank = r || [];
      if (!out.rerank.length) out.rerankErr = '重排接口返回空结果（该服务可能不支持 /rerank）';
    } catch (e) { out.rerankErr = (e && e.message) || String(e); }
    out.rerankMs = Date.now() - t1;

    if (out.embedErr && out.rerankErr) {
      throw new Error('向量失败（' + out.embedErr + '）；重排失败（' + out.rerankErr + '）');
    }
    return out;
  }

  /** 拉取该服务商可用模型（GET /models），按名字粗筛，填进输入框联想 */
  async function fetchModels() {
    var cfg = load();
    if (!cfg.apiKey) throw new Error('请先填写 API Key 并保存');
    var j = await _req('GET', '/models', null, cfg.timeout);
    var arr = (j && (j.data || j.models)) || [];
    var ids = arr.map(function (m) { return (m && (m.id || m.name)) || ''; }).filter(Boolean);
    var emb = ids.filter(function (s) { return /embed|bge|vec|gte|m3/i.test(s); });
    var rer = ids.filter(function (s) { return /rerank|reranker/i.test(s); });
    return { total: ids.length, embed: emb, rerank: rer, all: ids.slice(0, 300) };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function opts(list) { return list.map(function (s) { return '<option value="' + esc(s) + '"></option>'; }).join(''); }
  var IN_STYLE = 'padding:8px 10px;border-radius:8px;border:1px solid rgba(232,228,216,.16);background:#141722;color:#e8e4d8;font-size:13px;width:100%;box-sizing:border-box';
  var LBL = 'font-size:11.5px;color:#a8a290;margin-bottom:3px;display:block';

  function buildPanelHTML(pfx, opt) {
    var p = pfx || 'kbVec';
    var openByDefault = (typeof opt === 'boolean') ? opt : !!(opt && opt.open);
    var flat = !!((opt && typeof opt === 'object') && opt.flat);
    var c = load();
    var on = c.enabled && c.apiKey;
    var st = _last.mode === '-' ? '' : ('上次：' + _last.ms + 'ms · ' + _last.count + ' 条 · ' + _last.mode + (_last.err ? ' · ' + _last.err : ''));
    var summaryHtml = '<summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 13px;user-select:none">'
      + '<span><b style="color:#e0a84c">🧠 向量增强检索</b> <span style="font-size:12px;color:#a8a290">BM25 → 向量 → 重排（接口自定义）</span></span>'
      + '<span style="font-size:12px;color:' + (on ? '#8fbf9f' : '#a8a290') + '">' + (on ? '已启用' : '未启用') + ' ▾</span>'
      + '</summary>';
    var bodyHtml = '<div style="padding:' + (flat ? '0' : '0 13px 12px') + '">'
      + '<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 10px;padding:8px 11px;border-radius:8px;background:rgba(224,168,76,.06);border:1px solid rgba(224,168,76,.16);font-size:13px;color:#e8e4d8;cursor:pointer;user-select:none">'
      + '<span>启用向量增强<span style="font-size:11.5px;color:#8f897c;margin-left:8px">关掉即回到纯关键词，零开销</span></span>'
      + '<input type="checkbox" id="' + p + 'Enabled" ' + (c.enabled ? 'checked' : '') + ' style="width:16px;height:16px;margin:0;flex:0 0 auto;accent-color:#c8a25c"></label>'

      /* ① 地址 */
      + '<label style="' + LBL + '">接口地址（OpenAI 兼容，含 /v1）　<span style="color:#6e6a5e">只填域名会自动补 /v1</span></label>'
      + '<input id="' + p + 'Base" type="text" list="' + p + 'BaseList" autocomplete="off" value="' + esc(c.baseUrl) + '" placeholder="' + esc(DEF_BASE) + '" style="' + IN_STYLE + '">'
      + '<datalist id="' + p + 'BaseList">' + opts(BASE_TIPS) + '</datalist>'

      /* ② Key + 模式 */
      + '<div class="kb-vec-grid2" style="display:grid;grid-template-columns:1.55fr 1fr;gap:8px;margin-top:8px">'
      + '<div><label style="' + LBL + '">API Key（只存本机）</label>'
      + '<input id="' + p + 'Key" type="password" autocomplete="off" placeholder="sk-…" value="' + esc(c.apiKey) + '" style="' + IN_STYLE + '"></div>'
      + '<div><label style="' + LBL + '">检索模式</label>'
      + '<select id="' + p + 'Mode" style="' + IN_STYLE + '">'
      + '<option value="hybrid"' + (c.mode === 'hybrid' ? ' selected' : '') + '>向量 + 重排</option>'
      + '<option value="rerank"' + (c.mode === 'rerank' ? ' selected' : '') + '>只重排（快）</option>'
      + '<option value="vector"' + (c.mode === 'vector' ? ' selected' : '') + '>只向量</option>'
      + '</select></div>'
      + '</div>'

      /* ③ 两个模型名 */
      + '<div class="kb-vec-grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'
      + '<div><label style="' + LBL + '">向量模型</label>'
      + '<input id="' + p + 'Embed" type="text" list="' + p + 'EmbedList" autocomplete="off" value="' + esc(c.embedModel) + '" placeholder="' + esc(DEF_EMBED) + '" style="' + IN_STYLE + '">'
      + '<datalist id="' + p + 'EmbedList">' + opts(EMBED_TIPS) + '</datalist></div>'
      + '<div><label style="' + LBL + '">重排模型　<span style="color:#6e6a5e">留空＝不做重排</span></label>'
      + '<input id="' + p + 'Rerank" type="text" list="' + p + 'RerankList" autocomplete="off" value="' + esc(c.rerankModel) + '" placeholder="' + esc(DEF_RERANK) + '" style="' + IN_STYLE + '">'
      + '<datalist id="' + p + 'RerankList">' + opts(RERANK_TIPS) + '</datalist></div>'
      + '</div>'

      /* ④ 候选 + 动作 */
      + '<div style="display:flex;gap:8px;margin-top:9px;align-items:center;flex-wrap:wrap">'
      + '<span style="font-size:12px;color:#a8a290">候选</span>'
      + '<input id="' + p + 'Cand" type="number" min="8" max="40" value="' + c.candidates + '" style="width:64px;padding:6px 8px;border-radius:8px;border:1px solid rgba(232,228,216,.16);background:#141722;color:#e8e4d8">'
      + '<button class="btn-ghost btn-mini" onclick="KBVector.saveFromUI(\'' + p + '\')">保存</button>'
      + '<button class="btn-ghost btn-mini" onclick="KBVector.testFromUI(this,\'' + p + '\')">测试连接</button>'
      + '<button class="btn-ghost btn-mini" onclick="KBVector.fetchFromUI(this,\'' + p + '\')">拉取模型列表</button>'
      + '</div>'
      + '<div id="' + p + 'Status" style="font-size:12px;color:#a8a290;margin-top:6px;line-height:1.7">' + esc(st) + '</div>'
      + '<div style="font-size:11px;color:#6e6a5e;margin-top:7px;line-height:1.8">'
      + '默认 <b>BAAI/bge-m3</b> + <b>BAAI/bge-reranker-v2-m3</b>（硅基流动有）；换服务商、换模型都行，'
      + '只要接口是 OpenAI 兼容的 <code>/embeddings</code> 与 <code>/rerank</code>。Key 只存本机，不随存档导出。<br>'
      + '降级：重排挂 → 用向量序；向量挂 → 仍可重排；都挂 → 纯 BM25。'
      + '</div>'
      + '</div>';
    if (flat) return bodyHtml;
    return '<details class="kb-vec"' + (openByDefault ? ' open' : '') + ' style="margin:10px 0;padding:0;border:1px solid rgba(224,168,76,.2);background:rgba(224,168,76,.05);border-radius:10px">'
      + summaryHtml + bodyHtml + '</details>';
  }

  function readUI(pfx) {
    var p = pfx || 'kbVec';
    function v(k) { var el = document.getElementById(p + k); return el ? el.value : ''; }
    return {
      enabled: !!(document.getElementById(p + 'Enabled') || {}).checked,
      apiKey: v('Key').trim(),
      baseUrl: v('Base'),
      embedModel: v('Embed'),
      rerankModel: v('Rerank'),
      mode: v('Mode') || 'hybrid',
      candidates: Number(v('Cand')) || 20
    };
  }

  function saveFromUI(pfx, silent) {
    var p = pfx || 'kbVec';
    var patch = readUI(p);
    save(patch);
    var s = document.getElementById(p + 'Status');
    if (s) {
      s.textContent = isOn()
        ? '已保存 · 已启用（' + load().embedModel + ' / ' + (load().rerankModel || '仅向量') + '）'
        : '已保存 · 未启用（需勾选并填写 Key）';
    }
    if (!silent && window.showToast) window.showToast('✓ 向量增强检索设置已保存', 'success');
  }

  async function testFromUI(btn, pfx) {
    var p = pfx || 'kbVec';
    var s = document.getElementById(p + 'Status');
    var old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
    if (s) s.textContent = '正在调用向量与重排接口…';
    try {
      saveFromUI(p, true);
      var r = await test();
      var parts = [];
      if (!r.embedErr) parts.push('✓ 向量 ' + r.dim + ' 维 / ' + r.embedMs + 'ms');
      else parts.push('✕ 向量：' + r.embedErr);
      if (!r.rerankErr) parts.push('✓ 重排 ' + r.rerankMs + 'ms / 命中 ' + (r.rerank || []).length + ' 条');
      else parts.push('✕ 重排：' + r.rerankErr);
      var msg = parts.join('　｜　');
      if (s) s.textContent = msg;
      if (window.showToast) window.showToast(msg.slice(0, 110), r.embedErr && r.rerankErr ? 'error' : 'success');
    } catch (e) {
      if (s) s.textContent = '✕ ' + ((e && e.message) || '测试失败');
      if (window.showToast) window.showToast('接口测试失败：' + ((e && e.message) || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  async function fetchFromUI(btn, pfx) {
    var p = pfx || 'kbVec';
    var s = document.getElementById(p + 'Status');
    var old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '拉取中…'; }
    try {
      saveFromUI(p, true);
      var r = await fetchModels();
      var dlE = document.getElementById(p + 'EmbedList');
      var dlR = document.getElementById(p + 'RerankList');
      if (dlE && r.embed.length) {
        dlE.innerHTML = opts(r.embed.concat(EMBED_TIPS.filter(function (x) { return r.embed.indexOf(x) < 0; })));
      }
      if (dlR && r.rerank.length) {
        dlR.innerHTML = opts(r.rerank.concat(RERANK_TIPS.filter(function (x) { return r.rerank.indexOf(x) < 0; })));
      }
      var msg = '该服务商共 ' + r.total + ' 个模型 · 向量候选 ' + r.embed.length + ' · 重排候选 ' + r.rerank.length
        + '（已填进输入框的联想列表，点输入框即可选）';
      if (s) s.textContent = msg;
      if (window.showToast) window.showToast(msg.slice(0, 110), 'success');
    } catch (e) {
      var m = '拉取失败：' + ((e && e.message) || '');
      if (s) s.textContent = '✕ ' + m;
      if (window.showToast) window.showToast(m.slice(0, 110), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  window.KBVector = {
    CFG_KEY: CFG_KEY,
    DEF_EMBED: DEF_EMBED, DEF_RERANK: DEF_RERANK,
    load: load, save: save, isOn: isOn, hasRerank: hasRerank,
    retrieve: retrieve, test: test, fetchModels: fetchModels,
    /* v3.55.22 长程召回：把底层 embed/rerank 开放给 transcript 检索复用 */
    embed: embed, rerank: rerank,
    buildPanelHTML: buildPanelHTML,
    saveFromUI: saveFromUI, testFromUI: testFromUI, fetchFromUI: fetchFromUI,
    last: function () { return Object.assign({}, _last); }
  };
})();
