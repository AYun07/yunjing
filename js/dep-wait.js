/* =============================================================================
   依赖等待器 YJWait —— 取代散落各处手写的「setTimeout 自递归轮询」
   v3.55.29

   背景（真实事故）：quest-chain / combat-core / module-forge / world-stage 四个模块
   原本都这样等依赖：

       function inject(){
         if(!window.WorldExt||!WorldExt.hasModules()){ setTimeout(tryInject,300); return; }  ← 排 A
         ... injected = true;
       }
       function tryInject(){ inject(); if(!injected) setTimeout(tryInject,320); }            ← 排 B

   inject() 失败时排一个、tryInject() 再排一个 —— 每次调用裂变成两条链，
   只要依赖迟迟不就绪就指数翻倍。实测静置 5 秒可累积 124 万次定时器，
   堆一路涨到 150MB 后渲染进程直接崩（连玩 4~8 轮必崩）。

   本模块的三条硬约束：
     ① 单飞：同一 name 全局只维护一条等待链，重复注册直接复用，绝不裂变；
     ② 有界：尝试次数上限（默认 80 次）+ 退避递增（120ms → 上限 2.5s），
        依赖永远不来就体面放弃并告警，而不是把用户内存吃干；
     ③ 停表：就绪或放弃后清掉句柄，不留悬挂定时器。

   用法：
     YJWait.for(checkFn, cb, { name:'quest-chain' })
       checkFn() 返回 truthy 视为就绪，其返回值会传给 cb；
       cb 收到值后执行真正的注入。返回 Promise，可链式。
     YJWait.cancel('name')  取消某条等待链（换世界/重开局时清理）。
   ============================================================================= */
(function () {
  'use strict';
  if (window.YJWait) return;

  var jobs = Object.create(null);
  var DEFAULTS = { base: 120, cap: 2500, max: 80, name: 'anon', factor: 1.35 };

  function assign(o, src) {
    for (var k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    if (src) for (var j in src) if (Object.prototype.hasOwnProperty.call(src, j)) o[j] = src[j];
    return o;
  }

  function waitFor(check, cb, opts) {
    var o = assign({}, opts);
    var key = o.name;

    /* 单飞：已经在等的，直接复用同一条链 */
    if (jobs[key]) {
      if (cb) jobs[key].promise.then(cb, function () { });
      return jobs[key].promise;
    }

    var resolve, reject;
    var promise = new Promise(function (res, rej) { resolve = res; reject = rej; });
    promise.catch(function () { });          /* 吞掉默认 rejection，避免控制台噪声 */
    var rec = jobs[key] = { promise: promise, tries: 0, timer: 0, done: false };

    function stop() {
      if (rec.timer) { clearTimeout(rec.timer); rec.timer = 0; }
      rec.done = true;
      delete jobs[key];
    }

    function step() {
      if (rec.done) return;
      rec.timer = 0;
      rec.tries++;
      var val = false;
      try { val = check(); } catch (e) { val = false; }
      if (val) {
        stop();
        resolve(val);
        if (cb) { try { cb(val); } catch (e2) { console.warn('[YJWait] ' + key + ' 回调异常：' + e2.message); } }
        return;
      }
      if (rec.tries >= o.max) {
        stop();
        console.warn('[YJWait] 「' + key + '」等待超时（已试 ' + o.max + ' 次），放弃等待——相关功能本次会话不启用');
        reject(new Error('YJWait timeout: ' + key));
        return;
      }
      var d = Math.min(o.cap, Math.round(o.base * Math.pow(o.factor, rec.tries - 1)));
      rec.timer = setTimeout(step, d);
    }

    step();
    return promise;
  }

  function cancel(name) {
    var rec = jobs[name];
    if (!rec) return false;
    if (rec.timer) clearTimeout(rec.timer);
    rec.done = true;
    delete jobs[name];
    return true;
  }

  window.YJWait = {
    for: waitFor,
    wait: waitFor,
    cancel: cancel,
    /* 排障用：列出仍在等待的链 */
    stats: function () {
      return Object.keys(jobs).map(function (k) { return { name: k, tries: jobs[k].tries }; });
    }
  };
})();
