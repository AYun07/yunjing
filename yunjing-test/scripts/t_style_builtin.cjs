/* T3 验证：模拟 YunqiPreset 出厂只带通用 🎨文风· 块（无 📕文风·{世界} 分档），
 * 遍历 GENRE_NAME 全部世界，断言 resolveStyleBlock 回退内置、render 返回「本世界文风适配」文本。 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "..", "..", "js", "yunqi-bridge.js"), "utf8");

const sandbox = { console, Math, Date, JSON, parseInt, isFinite, Array, Object, String, Number, Boolean, RegExp };
sandbox.window = sandbox;
sandbox.storyFramework = { config: { genreKey: "" } };
/* 模拟预设：只含通用 🎨文风· 块，无 📕文风·{世界} 分档 → 此前 38/38 空 */
sandbox.YunqiPreset = {
  renderWithOverrides() { return { system: "" }; },
  enabled() { return true; },
  preset() { return null; },
  getOverrides() { return {}; }
};
sandbox.YUNQI_PRESET = null;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const B = sandbox.YunqiPresetBridge;
if (!B) { console.error("FAIL: YunqiPresetBridge 未导出"); process.exit(1); }

const keys = Object.keys(B.GENRE_NAME);
const bad = [];
for (const k of keys) {
  sandbox.storyFramework.config.genreKey = k;
  const pick = B.resolveStyleBlock();
  const r = B.render({ char: "x", user: "y" });
  const ok = pick && pick.indexOf("BUILTIN:") === 0 && r && r.indexOf("【本世界文风适配】") >= 0;
  if (!ok) bad.push(k + " pick=" + pick + " renderLen=" + (r ? r.length : 0));
}
console.log("世界数:", keys.length, "| 失败:", bad.length);
if (bad.length) { console.error("FAIL:", bad.join(" | ")); process.exit(1); }
console.log("STYLE_OK ✓ 38 界全部回退内置文风档且 render 返回文本");
