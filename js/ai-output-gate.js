/* 云境 · AI 输出统一校验闸门 v1.0.0（v4.17.0）
 *
 * 为什么有它
 *   本项目最要紧的一类缺陷，根因是同一个：**AI 的输出没有统一闸门就直接进了正文与存档**。
 *   已实际发生过的（都在本会话中定位并修复）：
 *     · 推理模型的 reasoning_content 被当正文与情节选项（8 处以上自己兜底）
 *     · 多语种 token 汤（Enemy capacité tanksせční…）被当正文渲染并入库
 *     · 登记官空返回 → 整轮状态不落库 → 世界停止生长
 *     · 截断续写产生的 (status) 圆括号块与未闭合 <selection> 漏进玩家正文
 *   而判定逻辑此前是**事后打补丁式地散在各处**：失控判定散在 4 个文件 23 处、
 *   提取正文散在 3 个文件 14 处。改一处规则要在多文件里找，且必然有漏网路径。
 *
 * 它做什么
 *   把「输出能不能用」的判定收敛为**唯一一处**，输出一个结构化裁决：
 *     { ok, severity, reasons[], action }
 *     action: 'accept'  直接采用
 *             'rewrite' 让模型重写一轮（附纠偏指令）
 *             'fallback' 走确定性兜底（例如保底登记），不放行但也不丢弃
 *             'error'   明确失败，给玩家可读原因
 *
 * 设计原则
 *   · **只判定，不改动**：本模块绝不修改传入的文本，避免又多一处隐式变换。
 *   · **不重复实现**：语种/失控判据复用 `window.BaseModelMode`（那里已是唯一实现）。
 *   · **可降级**：任何依赖缺失时退回保守判定，绝不因为闸门自身报错而阻断玩家。
 *   · **说话算数**：每条 reasons 都是玩家/开发者能看懂的具体理由。
 */
(function () {
  'use strict';

  var SEV = { OK: 0, MINOR: 1, MAJOR: 2, FATAL: 3 };

  function countCJK(s) { return (String(s).match(/[\u4e00-\u9fff]/g) || []).length; }
  function countLetters(s) { return (String(s).match(/[A-Za-z\u0400-\u04FF\u3040-\u30ff\uac00-\ud7af]/g) || []).length; }

  /** 提取正文（优先用引擎既有的 StoryResponseHandler，保证与渲染口径一致） */
  function bodyOf(reply, opts) {
    opts = opts || {};
    try {
      var RH = window.StoryResponseHandler;
      if (RH && RH.extractBody) {
        return String(RH.extractBody(reply, RH.extractOptions ? RH.extractOptions(reply) : undefined) || '');
      }
    } catch (e) { }
    return String(reply || '')
      .replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, '')
      .replace(/<selection>[\s\S]*?<\/selection>/gi, '')
      .replace(/<status>[\s\S]*?<\/status>/gi, '')
      .trim();
  }

  /** 叙事长度：把**所有协议区域**剥掉之后还剩多少字。
      不能用 extractBody 的结果直接当「有没有正文」——它可能把变量块/选项也算进去，
      于是「只有协议、没有叙事」的回复会被误判为合格（实测到的误判）。 */
  function narrativeLen(raw) {
    var s = String(raw || '')
      .replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, '')
      .replace(/<selection>[\s\S]*?<\/selection>/gi, '')
      .replace(/<status>[\s\S]*?<\/status>/gi, '')
      .replace(/【行动选项】[\s\S]*$/m, '')
      .replace(/^(?:\s*[1-6][\.、．]\s*\S.*)$/gm, '')
      .replace(/\s/g, '');
    /* 残留的协议标签成对/未成对都要算掉 */
    s = s.replace(/<\/?(?:selection|status|variable_update|combat_driver)[^>]*>/gi, '');
    return s.length;
  }

  /** 协议块齐全度：选项 / 变量块 / 状态栏 各在不在 */
  function protocolOf(raw) {
    var s = String(raw || '');
    return {
      hasOptions: /【行动选项】|(?:^|\n)\s*[1-6][\.、．]\s*\S/m.test(s),
      hasVarBlock: /\(variable_update\)[\s\S]*?\(\/variable_update\)/i.test(s),
      hasStatus: /<status>[\s\S]*?<\/status>/i.test(s),
      /* 未闭合的标签：截断续写常见的泄漏形态 */
      unclosedSelection: /<selection>(?![\s\S]*<\/selection>)/i.test(s),
      unclosedStatus: /<status>(?![\s\S]*<\/status>)/i.test(s),
      /* 模型自创的圆括号状态块（截断时常见）。
         v4.17.0 修：正则必须排除**协议自身的块名**——(variable_update) 是合法指令块，
         旧写法把它当成「模型自创块」误报（实测：「只有协议没正文」的用例被误判成轻微协议瑕疵）。 */
      parenStatusBlock: /^\s*\((?!variable_update\b|status\b|selection\b|combat_driver\b)[a-z_]{3,20}\)\s*$/im.test(s)
    };
  }

  /**
   * 统一裁决。
   * @param {string} reply  模型原始回复
   * @param {object} [opts] { sample: 玩家最近的输入（推断期望语种）, minBody: 最小正文字数, isPlaceholder: bool }
   * @returns {{ok:boolean, severity:number, reasons:string[], action:string, detail:object}}
   */
  function evaluate(reply, opts) {
    opts = opts || {};
    var reasons = [];
    var sev = SEV.OK;
    var raw = String(reply == null ? '' : reply);
    var detail = {};

    /* ---- 1. 空回复 ---- */
    if (!raw.trim()) {
      return verdict(false, SEV.FATAL, ['模型返回了空内容'], 'error', { stage: 'empty' });
    }

    /* ---- 2. 思维链泄漏（provider 级 reasoning 被当正文） ----
       传入玩家语言样本：写英文小说的玩家不该被判成「思维链」。 */
    try {
      if (window.looksLikeRawReasoning && window.looksLikeRawReasoning(raw, opts.sample || '')) {
        reasons.push('正文看起来是原始思维链（reasoning_content 泄漏）');
        sev = Math.max(sev, SEV.FATAL);
      }
    } catch (e) { }

    var body = bodyOf(raw, opts);
    detail.bodyLen = body.replace(/\s/g, '').length;
    detail.narrativeLen = narrativeLen(raw);

    /* ---- 3. 正文空缺（只有协议块没有叙事） ----
       按**剥掉协议后的叙事长度**判，而不是 extractBody 的结果。 */
    var minBody = opts.minBody != null ? opts.minBody : 60;
    if (detail.narrativeLen < minBody) {
      reasons.push('没有可识别的正文叙事（只回了变量块/选项，或正文被格式标记吞掉）');
      sev = Math.max(sev, SEV.MAJOR);
    }

    /* ---- 4. 协议残缺 / 泄漏 ---- */
    var P = protocolOf(raw);
    detail.protocol = P;
    if (P.unclosedSelection) { reasons.push('有未闭合的 <selection> 标签漏进正文（通常是被输出上限截断）'); sev = Math.max(sev, SEV.MINOR); }
    if (P.unclosedStatus) { reasons.push('有未闭合的 <status> 标签'); sev = Math.max(sev, SEV.MINOR); }
    if (P.parenStatusBlock) { reasons.push('出现了模型自创的圆括号状态块 (xxx)'); sev = Math.max(sev, SEV.MINOR); }

    /* ---- 5. 语种健全性（按玩家输入推断期望语种，复用 BaseModelMode 的唯一实现） ---- */
    try {
      var BMM = window.BaseModelMode;
      if (BMM && BMM.detectDegeneration) {
        if (BMM.detectDegeneration(body, opts.sample || '')) {
          var ratio = BMM.cjkRatio ? BMM.cjkRatio(body.replace(/\s/g, '')) : null;
          reasons.push('正文疑似模型退化（多语种乱码）' + (ratio != null ? '，汉字占比 ' + (ratio * 100).toFixed(1) + '%' : ''));
          sev = Math.max(sev, SEV.MAJOR);
        }
      } else {
        var flat = body.replace(/\s/g, '');
        if (flat.length >= 240 && countCJK(flat) / (countCJK(flat) + countLetters(flat) || 1) < 0.55) {
          reasons.push('正文汉字占比过低（闸门降级判定）');
          sev = Math.max(sev, SEV.MAJOR);
        }
      }
    } catch (e) { }

    /* ---- 6. 复读崩塌（词表狂奔 / n-gram 复读） ---- */
    try {
      var BMM2 = window.BaseModelMode;
      if (BMM2 && BMM2.detectCollapse && BMM2.detectCollapse(raw)) {
        reasons.push('正文疑似解码失控（词表狂奔 / 复读循环）');
        sev = Math.max(sev, SEV.MAJOR);
      }
    } catch (e) { }

    /* ---- 7. 占位回复（连通测试等的短回复不算记录） ---- */
    if (opts.isPlaceholder) {
      return verdict(true, SEV.OK, [], 'accept', detail);
    }

    /* ---- 裁决 ---- */
    if (sev >= SEV.FATAL) return verdict(false, sev, reasons, 'error', detail);
    if (sev >= SEV.MAJOR) {
      /* 正文空缺/退化/失控：能重写就重写（保留语义比丢弃好），但绝不直接放行入档 */
      return verdict(false, sev, reasons, 'rewrite', detail);
    }
    if (sev >= SEV.MINOR) {
      return verdict(true, sev, reasons, 'accept', detail);   // 轻微协议瑕疵：放行，由渲染层兜
    }
    return verdict(true, SEV.OK, [], 'accept', detail);
  }

  function verdict(ok, severity, reasons, action, detail) {
    return { ok: ok, severity: severity, reasons: reasons, action: action, detail: detail || {} };
  }

  /** 给模型看的纠偏指令（与裁决结果一一对应，避免各处自己拼） */
  function rewriteHint(v, sample) {
    if (!v || !v.reasons || !v.reasons.length) return '';
    var hint = '\n\n（系统纠偏：你上一轮回复的正文不合格 —— ';
    hint += v.reasons.join('；') + '。';
    hint += '本轮必须重新完整输出小说正文：全文用通顺的简体中文（若玩家用其他语言则用该语言），'
      + '规范标点与完整句子，纯叙事散文、不要放进代码块；禁止夹带外文乱码与无意义字符，'
      + '禁止同义词罗列式推进，禁止省略标点。之后再按协议输出 (variable_update) 变量块与【行动选项】。）';
    return hint;
  }

  window.AIOutputGate = {
    SEV: SEV,
    evaluate: evaluate,
    bodyOf: bodyOf,
    narrativeLen: narrativeLen,
    protocolOf: protocolOf,
    rewriteHint: rewriteHint
  };
})();
