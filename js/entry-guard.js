/* 云境 · 唯一启动界面守卫 EntryGuard v1.0.0（v6.3.3）
 * 目的：保护不懂电脑的玩家——只有从封面（或启动程序打开的封面）进入才算正常启动；
 *       单独在浏览器打开 studio/index/xiaoyun 等子页时弹回封面，避免"玩了半天没保存"的误会。
 * 不针对懂代码的人：带功能参数、同源跳转、封面会话、?dev=1 / localStorage 开关 全部放行。
 * 零侵入：一个同步脚本，放在子页 <head> 最前；不参与任何业务逻辑。 */
(function () {
  "use strict";
  try {
    var q = location.search || "";
    // ① 开发者显式豁免：?dev=1 或本机一次性解锁开关（CLI/部署/第三方前端/智能体接入都走这条）
    if (/(?:^|[?&])dev=1(?:&|$)/.test(q)) { markDev(); return; }
    try { if (localStorage.getItem("yunjingDevUnlock") === "1") return; } catch(e){console.warn("[swallowed] entry-guard",e)}

    // ② 带功能参数的深链：entry/goto/view/genre/fromGuide/from —— 都是封面入口或内部跳转真实使用的
    if (/(?:^|[?&])(?:entry|goto|view|genre|fromGuide|from|slot)=/.test(q)) return;

    // ③ 封面会话令牌：凡在本标签先打开过封面（启动程序落地页）即写入，之后任意子页放行
    try {
      if (sessionStorage.getItem("yunjing_cover_seen") === "1") return;
    } catch(e){console.warn("[swallowed] entry-guard",e)}

    // ④ 同源 referrer：从站内页面点进来的（含从封面点入口），放行
    try {
      if (document.referrer && document.referrer.indexOf(location.origin) === 0) return;
    } catch(e){console.warn("[swallowed] entry-guard",e)}

    // 都不满足 = 单独直接打开子页 → 弹回封面
    location.replace("opening.html?denied=1");
  } catch (e) { /* 守卫自身异常一律放行，绝不把玩家锁死 */ }

  function markDev() {
    try { sessionStorage.setItem("yunjing_cover_seen", "1"); } catch(e){console.warn("[swallowed] entry-guard",e)}
  }
})();
