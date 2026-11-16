/* =========================================================================
 * 云境 · 全楼层检索（v3.55.22 · 几千楼不忘剧情——精确细节召回通道）
 *
 * v3.55.25 措辞盲区修复：此前只索引二字 bigram，玩家换措辞追问旧事
 *       （问「山坡/时辰」而原文写「落霞坡/戌时」）时零命中、召回失败。
 *       现补「稀有单字回退」：单字也入索引，但文档频率过高的常用字
 *       （df ≥ max(8, N·25%)，如「的」「山」）不入——既让「坡」「戌」这类
 *       稀有字能靠单字命中，又不撑爆索引。查询侧同步产出单字。
 *
 * 职责：对 conversationHistory 的每一楼建立 BM25 索引，玩家每轮输入时
 *       召回与当前剧情最相关的「旧楼层原文」，注入主笔——
 *       让几千楼之前的伏笔/人物/约定仍能被精确想起（摘要只保梗概，检索保细节）。
 *
 * 双通道：本地 BM25 恒可用（零配置、离线）；若 KBVector 已配置，
 *         则对 BM25 候选池做向量精排（embed 查询与候选，cosine 重排序）。
 * 性能：索引增量建（按已索引楼数缓存）；向量只算候选池（不索引全楼）；
 *       每轮最多一次、带超时守卫；任何失败静默回退纯 BM25。
 * ========================================================================= */
(function () {
  "use strict";

  /* ---------- 停用词（极简中文表 + 单字符） ---------- */
  var STOP = new Set("的了是在我有和不人都一个也上到说要去你会着看好这那它他她它们么呢吧啊呀哦把被让给从对向着就还很但而是与及其或如果因为所以虽然然后于是于是之乎者什么的吗呢啊".split(""));
  function tokenize(s) {
    var out = [];
    var str = String(s || "");
    /* 中英混排：连续字母数字为一个词，汉字逐字（bigram 提精度 + 单字回退提召回） */
    var latin = str.match(/[A-Za-z0-9]{2,}/g) || [];
    for (var i = 0; i < latin.length; i++) out.push(latin[i].toLowerCase());
    var han = str.replace(/[^\u4e00-\u9fa5]/g, "");
    for (var j = 0; j < han.length; j++) {
      var ch = han[j];
      if (!STOP.has(ch)) out.push(ch);
    }
    for (var k = 0; k < han.length - 1; k++) {
      var bg = han.slice(k, k + 2);
      if (!STOP.has(bg)) out.push(bg);
    }
    return out;
  }

  /* 常用字不入索引的文档频率阈值：df 达到该值视为「无区分度」，跳过。
     max(8,·) 防止前期楼层少时误杀；单字与 bigram 共用同一 df 表。 */
  function dfTooHigh(w) {
    return (_idx.df[w] || 0) >= Math.max(8, _idx.N * 0.25);
  }

  /* ---------- BM25 增量索引 ---------- */
  var _idx = { key: "", upto: 0, df: {}, docs: [], avgdl: 1, N: 0 };
  var K1 = 1.4, B = 0.72;
  var _lastQuery = { q: "", at: 0 };

  function floorText(m) {
    if (!m) return "";
    var role = m.role === "user" ? "指令" : "正文";
    return role + "：" + String(m.content || "").replace(/\s+/g, " ").slice(0, 400);
  }

  function ensureIndex(state) {
    var hist = (state && state.conversationHistory) || [];
    var key = String((hist.length || 0)) + ":" + String(state && state.setup && state.setup.world || "");
    if (_idx.key !== key) { _idx = { key: key, upto: 0, df: {}, docs: [], avgdl: 1, N: 0 }; }
    for (var i = _idx.upto; i < hist.length; i++) {
      var toks = tokenize(floorText(hist[i]));
      var tf = {};
      for (var t = 0; t < toks.length; t++) {
        var w = toks[t];
        if (tf[w] !== undefined) { tf[w]++; continue; }
        if (dfTooHigh(w)) continue; /* 高频词无区分度，不入索引（该文档不计其 df） */
        tf[w] = 1;
      }
      for (var w2 in tf) _idx.df[w2] = (_idx.df[w2] || 0) + 1;
      _idx.docs.push({ tf: tf, len: toks.length || 1 });
      _idx.N++;
    }
    _idx.upto = hist.length;
    var total = 0;
    for (var d = 0; d < _idx.docs.length; d++) total += _idx.docs[d].len;
    _idx.avgdl = _idx.N ? total / _idx.N : 1;
  }

  function bm25(query, poolSize) {
    var qtoks = tokenize(query);
    if (!qtoks.length || !_idx.N) return [];
    var scores = [];
    for (var i = 0; i < _idx.N; i++) {
      var doc = _idx.docs[i], score = 0;
      var seen = {}, matched = 0, multi = false;
      for (var q = 0; q < qtoks.length; q++) {
        var w = qtoks[q];
        if (seen[w]) continue;
        seen[w] = 1;
        var f = doc.tf[w];
        if (!f) continue;
        if (w.length >= 2) multi = true; else matched++;
        var df = _idx.df[w] || 1;
        var idf = Math.log(1 + (_idx.N - df + 0.5) / (df + 0.5));
        score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * doc.len / _idx.avgdl));
      }
      /* v3.55.25 命中质量守卫：只有零散单字（<2 个不同字）或无二字词命中的文档视为噪音 */
      if (score > 0 && (multi || matched >= 2)) scores.push([i, score]);
    }
    scores.sort(function (a, b) { return b[1] - a[1]; });
    return scores.slice(0, poolSize || 40);
  }

  /* ---------- 向量精排（KBVector 可用时） ---------- */
  async function vectorRerank(query, cands, state) {
    try {
      var kb = window.KBVector;
      if (!kb || !kb.isOn || !kb.isOn() || !kb.embed || !kb.rerank) return cands;
      var hist = state.conversationHistory || [];
      var texts = [];
      for (var i = 0; i < cands.length; i++) texts.push(floorText(hist[cands[i][0]]).slice(0, 320));
      var vecs = await kb.embed([query.slice(0, 320)].concat(texts), 8000);
      if (!vecs || vecs.length !== texts.length + 1) return cands;
      var qv = vecs[0];
      var rescored = [];
      for (var j = 0; j < cands.length; j++) {
        var sim = cosine(qv, vecs[j + 1]);
        rescored.push([cands[j][0], cands[j][1] * 0.4 + sim * 6]); /* BM25 与相似度融合 */
      }
      rescored.sort(function (a, b) { return b[1] - a[1]; });
      return rescored;
    } catch (e) {
      console.warn("[TranscriptRetrieval] 向量精排失败，回退 BM25：", e && e.message);
      return cands;
    }
  }

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
  }

  /* ---------- 对外 API ---------- */
  async function search(query, state, topK) {
    if (!query || !String(query).trim()) return [];
    /* 同输入 60s 内不重复检索（防重试抖动） */
    var q = String(query).trim();
    if (_lastQuery.q === q && Date.now() - _lastQuery.at < 60000) return [];
    _lastQuery = { q: q, at: Date.now() };
    try {
      ensureIndex(state);
      var cands = bm25(q, 40);
      if (!cands.length) return [];
      cands = await vectorRerank(q, cands, state);
      /* v3.55.25 相对得分线：低于最高分 32% 的候选是弱相关，不注入（防噪音灌进主笔） */
      var top = cands.length ? cands[0][1] : 0;
      cands = cands.filter(function (c) { return c[1] >= top * 0.32; });
      var hist = state.conversationHistory || [];
      var k = topK || 5;
      var out = [];
      for (var i = 0; i < cands.length && out.length < k; i++) {
        var idx = cands[i][0];
        var m = hist[idx];
        if (!m || !m.content) continue;
        out.push({
          idx: idx,
          role: m.role || "assistant",
          score: cands[i][1],
          text: String(m.content).replace(/\s+/g, " ").slice(0, 260)
        });
      }
      return out;
    } catch (e) {
      console.warn("[TranscriptRetrieval] 检索失败（静默跳过）：", e && e.message);
      return [];
    }
  }

  function buildInjection(query, state) {
    return search(query, state, 5).then(function (hits) {
      if (!hits.length) return "";
      var lines = hits.map(function (h) {
        return "· 第" + (h.idx + 1) + "楼（" + (h.role === "user" ? "玩家指令" : "正文") + "）：" + h.text;
      });
      return "【旧章检索（全文检索命中的早年剧情原文，与本轮输入相关；如与当前剧情衔接，必须延续这些事实，不得矛盾或遗忘）】\n" + lines.join("\n");
    });
  }

  function stats() {
    return { indexed: _idx.N, upto: _idx.upto, lastQuery: _lastQuery.q.slice(0, 30) };
  }

  window.TranscriptRetrieval = { search: search, buildInjection: buildInjection, stats: stats };
})();
