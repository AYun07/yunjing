/* 云境 · 每轮请求预算 v1.0.0（v4.17.0）
 *
 * 为什么有它
 *   云境里对「同一次玩家操作」的重试散在**四个互不知情的层**：
 *     ① api-calling-functions.js  callOpenAI 内部：空正文时翻倍预算重试 1 次
 *     ② api-calling-functions.js  复读/退化自检：降温重发 1 次
 *     ③ user-input-handler.js     正文不合格：纠偏重写 1 次
 *     ④ MoNetGuard                被 max_tokens 截断：续写最多 2 次
 *   叠加之后，**一次点击最坏会向上游发 6 次以上请求**。后果是实打实的：
 *     · 玩家额度被快速吃掉（按 token 计费的中转站尤其明显）
 *     · 免费/低额度端点直接触发限流（本会话实测 503 / ECONNRESET 成片）
 *     · 越慢的模型越容易叠加重试，越慢越慢
 *   而每一层都以为自己只重试了「一次」。
 *
 * 它做什么
 *   给「一次玩家操作」设一个**上游请求总预算**（默认 6 次，可在接口设置里改）。
 *   每一层在重试前问一句 `window.YJTurnBudget.allow()`：
 *     · 还有额度 → 允许重试（并把这次算进去）
 *     · 用完了   → 拒绝，让调用方**停止重试并给出明确原因**，而不是继续打
 *   这不是「少重试」，而是「**别把同一个请求打到天荒地老**」：真正需要重试的场景
 *   （空正文、退化、截断）在前几次里基本都能救回，之后继续打只会烧额度。
 *
 * 用法
 *   YJTurnBudget.begin('主笔')        // 玩家发起一次操作时调用，重置本轮额度
 *   YJTurnBudget.spend('重试-空正文')  // 记录一次上游请求
 *   YJTurnBudget.allow()              // 还能不能再打？
 *   YJTurnBudget.explain()            // 给玩家看的说明（超预算时）
 */
(function () {
  'use strict';

  var DEFAULT_MAX = 6;
  var _turn = 0;
  var _used = 0;
  var _max = DEFAULT_MAX;
  var _log = [];

  function cfgMax() {
    try {
      var fw = window.storyFramework;
      var v = fw && fw.apiConfig && fw.apiConfig.turnBudget;
      if (typeof v === 'number' && v >= 1 && v <= 30) return v;
    } catch (e) { }
    return DEFAULT_MAX;
  }

  function begin(label) {
    _turn++;
    _used = 0;
    _max = cfgMax();
    _log = [];
    if (label) _log.push('开始：' + label);
  }

  function spend(why) {
    _used++;
    _log.push('#' + _used + ' ' + (why || '请求'));
    return _used <= _max;
  }

  function allow() { return _used < _max; }
  function used() { return _used; }
  function max() { return _max; }
  function remaining() { return Math.max(0, _max - _used); }

  function explain() {
    return '本轮已向上游发起 ' + _used + ' 次请求（上限 ' + _max + ' 次），已达到预算，停止继续重试。'
      + '模型可能确实无法完成这次输出——可尝试：①换更稳的模型 ②到「接口设置」把本轮预算调大'
      + ' ③把最大输出 token 调大，减少被截断的概率。';
  }

  /** 供诊断/测试查看本轮明细 */
  function trace() { return { turn: _turn, used: _used, max: _max, log: _log.slice() }; }

  window.YJTurnBudget = {
    DEFAULT_MAX: DEFAULT_MAX,
    begin: begin,
    spend: spend,
    allow: allow,
    used: used,
    max: max,
    remaining: remaining,
    explain: explain,
    trace: trace
  };
})();
