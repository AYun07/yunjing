/* 云境 v6.7.0 · PWA 离线注册（统一入口）
 * 修复（全量审查 P1-6）：旧版三处注册条件都写死 `location.protocol === 'https:'`，
 * 于是 localhost / 127.0.0.1 这些**本来就是安全上下文**的本地部署一律不注册，离线能力在本地完全不可用；
 * 且新封面 opening.html 压根没有注册代码，玩家在封面阶段断网就什么都没有。
 * 现在：https / localhost / 127.0.0.1 / [::1] 都注册；file:// 与局域网 http（非安全上下文）跳过。
 * 零侵入：一段独立脚本，注册失败静默，不影响任何业务逻辑。
 */
(function () {
  "use strict";
  try {
    if (!("serviceWorker" in navigator)) return;
    var p = location.protocol;
    var h = location.hostname || "";
    var secure = p === "https:" || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
    if (!secure) return;               // file:// 或局域网 http：非安全上下文，注册必然失败，直接跳过
    var reg = function () {
      try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
    };
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg);
  } catch (e) { /* 注册器自身异常一律吞掉，绝不影响开局 */ }
})();
