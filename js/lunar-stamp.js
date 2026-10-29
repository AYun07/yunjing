(function() {
  "use strict";
  const KEY = "storyLunarStamp";
  const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
  const LIB = "libs/lunar.min.js?v=1.7.3";
  const HOUR_MAP = [
    [/黎明|拂晓|破晓|平旦/, "寅时"],
    [/清晨|早晨|晨光|日出/, "卯时"],
    [/上午|朝食/, "辰时"],
    [/近午|隅中/, "巳时"],
    [/正午|中午|日中|亭午/, "午时"],
    [/午后|日昳/, "未时"],
    [/午后偏晚|晡时/, "申时"],
    [/黄昏|傍晚|日落|夕暮/, "酉时"],
    [/入夜|薄暮|掌灯|黄昏后/, "戌时"],
    [/夜晚|夜深|深夜|子夜|夜半|午夜/, "子时"],
    [/半夜|鸡鸣|丑时/, "丑时"]
  ];
  const LunarStamp = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /* ==================== 设置 ==================== */
    getSettings() {
      let s = { on: true, turnsPerYear: 24, turnsPerMonth: 2 };
      try {
        s = { ...s, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
      } catch (e) {
      }
      const tpy = parseInt(s.turnsPerYear, 10), tpm = parseInt(s.turnsPerMonth, 10);
      s.turnsPerYear = Math.max(6, Math.min(240, Number.isFinite(tpy) ? tpy : 24));
      s.turnsPerMonth = Math.max(1, Math.min(12, Number.isFinite(tpm) ? tpm : 2));
      return s;
    },
    saveSettings(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...this.getSettings(), ...s }));
      } catch (e) {
      }
    },
    toggle() {
      var _a;
      const s = this.getSettings();
      s.on = !s.on;
      this.saveSettings(s);
      (_a = window.showToast) == null ? void 0 : _a.call(window, s.on ? "🏮 干支纪年已开启：正文注入与舞台面板显示纪年戳" : "🏮 干支纪年已关闭", "info");
      return s.on;
    },
    isEnabled() {
      return this.getSettings().on;
    },
    /* ==================== ① 本书纪年（故事世界干支历） ==================== */
    /** 当前轮数（无故事返回 0） */
    _turn() {
      var _a;
      const st = (_a = window.storyFramework) == null ? void 0 : _a.storyState;
      return Math.max(0, Number(st == null ? void 0 : st.turnCount) || 0);
    },
    /** 干支（序号 0-59 → 甲子…癸亥） */
    _ganzhi(i) {
      return GAN[i % 10] + ZHI[i % 12];
    },
    /** 时辰映射（快照 time → 十二时辰；识别不了返回 ''） */
    timeToHour(time) {
      const t = String(time || "");
      if (!t) return "";
      for (const [re, h] of HOUR_MAP) {
        if (re.test(t)) return h;
      }
      return "";
    },
    /**
     * 本书纪年戳（随轮推进）：
     *   turn 0/1 → 甲子年 · 正月 · 甲子日
     *   年 = floor((turn-1)/turnsPerYear)，月 = floor(轮内序/turnsPerMonth)，日 = 六十甲子逐轮
     * 时辰由调用方拼（舞台快照有值才带）。
     */
    storyStamp(withHour) {
      var _a, _b, _c;
      const s = this.getSettings();
      const turn = this._turn();
      if (!turn) return "";
      const y = Math.floor((turn - 1) / s.turnsPerYear);
      const inYear = (turn - 1) % s.turnsPerYear;
      const m = Math.min(11, Math.floor(inYear / s.turnsPerMonth));
      const d = (turn - 1) % 60;
      let stamp = `${this._ganzhi(y)}年${MONTHS[m]}${this._ganzhi(d)}日`;
      if (withHour !== false) {
        const hour = this.timeToHour((_c = (_b = (_a = window.SceneState) == null ? void 0 : _a.snap) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.time);
        if (hour) stamp += hour;
      }
      return stamp;
    },
    /** 面板 / 注入用单行（开篇前或开关关闭返回 ''） */
    storyStampLine() {
      if (!this.isEnabled()) return "";
      return this.storyStamp(true);
    },
    /* ==================== ② 今日黄历（真实世界，lunar 库懒加载） ==================== */
    async _ensureLib() {
      return window.loadLibOnce ? window.loadLibOnce(LIB, "Solar") : false;
    },
    /** 今日黄历卡数据（库加载失败返回 null） */
    async almanacToday() {
      var _a, _b;
      if (!await this._ensureLib()) return null;
      try {
        const lunar = window.Solar.fromDate(/* @__PURE__ */ new Date()).getLunar();
        const yi = String(lunar.getDayYi() || "").split(/\s+/).filter(Boolean).slice(0, 6);
        const ji = String(lunar.getDayJi() || "").split(/\s+/).filter(Boolean).slice(0, 6);
        return {
          ganzhi: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}日`,
          jieqi: lunar.getJieQi() || "",
          animal: lunar.getYearShengXiao(),
          yi,
          ji,
          dayOfYear: `第 ${(_b = (_a = lunar.getNongliDayOfYear) == null ? void 0 : _a.call(lunar)) != null ? _b : "?"} 天`
        };
      } catch (e) {
        return null;
      }
    },
    /* ==================== ③ 八字五行（角色命理卡） ==================== */
    /** 生辰 → 四柱八字与五行纳音（date: 1990-5-20；hour: 0-23 可空） */
    async bazi(dateStr, hour) {
      if (!await this._ensureLib()) return null;
      const m = String(dateStr || "").match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
      if (!m) return null;
      const h = Math.max(0, Math.min(23, Number(hour) || 12));
      try {
        const solar = window.Solar.fromYmdHms(+m[1], +m[2], +m[3], h, 0, 0);
        const ec = solar.getLunar().getEightChar();
        const pick = (fn) => {
          try {
            return ec[fn] ? String(ec[fn]()) : "";
          } catch (e) {
            return "";
          }
        };
        return {
          bazi: [pick("getYear"), pick("getMonth"), pick("getDay"), pick("getTime")].filter(Boolean),
          wuxing: [pick("getYearWuXing"), pick("getMonthWuXing"), pick("getDayWuXing"), pick("getTimeWuXing")].filter(Boolean),
          nayin: pick("getNaYin") || [pick("getYearNaYin"), pick("getMonthNaYin"), pick("getDayNaYin"), pick("getTimeNaYin")].filter(Boolean).join(" · "),
          shishen: pick("getShiShenGan")
        };
      } catch (e) {
        return null;
      }
    },
    /* ==================== 面板 ==================== */
    open() {
      var _a;
      (_a = document.getElementById("lunarPanel")) == null ? void 0 : _a.remove();
      const s = this.getSettings();
      const stamp = this.storyStamp(true);
      const w = document.createElement("div");
      w.id = "lunarPanel";
      w.innerHTML = `
            <div class="ls-overlay" onclick="if(event.target===this)LunarStamp.close()">
                <div class="ls-modal">
                    <div class="ls-top"><b>🏮 干支纪年</b><span class="ls-sub">故事世界历法 · 黄历 · 八字</span>
                        <button class="ls-x" onclick="LunarStamp.close()">✕</button></div>
                    <div class="ls-body">

                        <div class="ls-sec">本书纪年</div>
                        <div class="ls-stamp">${stamp ? this.esc(stamp) : "尚未开篇（开篇后自动从「甲子年正月」起算）"}</div>
                        <div class="ls-hint">每 ${s.turnsPerYear} 轮进一年 · 每 ${s.turnsPerMonth} 轮进一月 · 日按六十甲子循环；
                            时辰取自舞台快照。纪年随提示词注入，主笔下笔即知「今夕何夕」。</div>
                        <div class="ls-ctl">
                            <label>一年 = <input type="number" id="lsTpy" min="6" max="240" value="${s.turnsPerYear}"> 轮</label>
                            <label>一月 = <input type="number" id="lsTpm" min="1" max="12" value="${s.turnsPerMonth}"> 轮</label>
                            <button class="ls-btn" onclick="LunarStamp.applyPace()">保存历法节奏</button>
                            <button class="ls-btn ${s.on ? "" : "off"}" onclick="LunarStamp.toggle(); this.textContent = LunarStamp.isEnabled() ? '关闭纪年注入' : '开启纪年注入'">${s.on ? "关闭纪年注入" : "开启纪年注入"}</button>
                        </div>

                        <div class="ls-sec">今日黄历（真实世界）</div>
                        <div id="lsAlmanac" class="ls-loading">加载历法库…</div>

                        <div class="ls-sec">八字五行（角色命理卡）</div>
                        <div class="ls-bazi-form">
                            <input type="text" id="lsBaziDate" placeholder="公历生辰，如 1990-5-20" value="">
                            <select id="lsBaziHour">
                                <option value="">时辰未知</option>
                                ${Array.from({ length: 24 }, (_, i) => `<option value="${i}">${String(i).padStart(2, "0")} 时</option>`).join("")}
                            </select>
                            <button class="ls-btn" onclick="LunarStamp.calcBazi()">排盘</button>
                        </div>
                        <div id="lsBaziOut" class="ls-bazi-out"></div>

                        <div class="ls-note">历法库为 6tail/lunar-javascript（MIT）本地文件 libs/lunar.min.js，按需加载零外联。
                            八字五行仅供角色设定参考——命由己造，笔由心走。</div>
                    </div>
                </div>
            </div>`;
      document.body.appendChild(w);
      this._style();
      this.almanacToday().then((a) => {
        const host = document.getElementById("lsAlmanac");
        if (!host) return;
        if (!a) {
          host.innerHTML = '<div class="ls-empty">历法库加载失败（libs/lunar.min.js 缺失）</div>';
          return;
        }
        host.innerHTML = `
                    <div class="ls-alm">
                        <b>${this.esc(a.ganzhi)}${a.jieqi ? " · " + this.esc(a.jieqi) : ""}</b>
                        <i>${this.esc(a.animal)}年</i>
                        <div class="ls-yi"><span>宜</span>${a.yi.map((x) => this.esc(x)).join(" ") || "—"}</div>
                        <div class="ls-ji"><span>忌</span>${a.ji.map((x) => this.esc(x)).join(" ") || "—"}</div>
                    </div>`;
      });
    },
    applyPace() {
      var _a, _b, _c;
      const tpy = parseInt((_a = document.getElementById("lsTpy")) == null ? void 0 : _a.value, 10);
      const tpm = parseInt((_b = document.getElementById("lsTpm")) == null ? void 0 : _b.value, 10);
      this.saveSettings({ turnsPerYear: tpy, turnsPerMonth: tpm });
      (_c = window.showToast) == null ? void 0 : _c.call(window, "🏮 历法节奏已保存（下一轮起生效）", "success");
      this.open();
    },
    async calcBazi() {
      var _a, _b, _c, _d;
      const date = ((_b = (_a = document.getElementById("lsBaziDate")) == null ? void 0 : _a.value) == null ? void 0 : _b.trim()) || "";
      const hour = (_d = (_c = document.getElementById("lsBaziHour")) == null ? void 0 : _c.value) != null ? _d : "";
      const out = document.getElementById("lsBaziOut");
      if (!out) return;
      if (!date) {
        out.innerHTML = '<div class="ls-empty">请先填写公历生辰</div>';
        return;
      }
      out.innerHTML = '<div class="ls-loading">排盘中…</div>';
      const r = await this.bazi(date, hour);
      if (!r) {
        out.innerHTML = '<div class="ls-empty">日期格式应为 1990-5-20（历法库缺失也会如此）</div>';
        return;
      }
      out.innerHTML = `
                <div class="ls-bazi">
                    <div class="ls-pillars">${r.bazi.map((p) => `<span>${this.esc(p)}</span>`).join("")}</div>
                    ${r.wuxing.length ? `<div class="ls-wx">五行纳音：${r.wuxing.map((x) => this.esc(x)).join(" · ")}</div>` : ""}
                    ${r.nayin ? `<div class="ls-wx">${this.esc(r.nayin)}</div>` : ""}
                    ${r.shishen ? `<div class="ls-wx">十神（干）：${this.esc(r.shishen)}</div>` : ""}
                </div>`;
    },
    close() {
      var _a;
      (_a = document.getElementById("lunarPanel")) == null ? void 0 : _a.remove();
    },
    _style() {
      if (document.getElementById("lunarStampStyle")) return;
      const st = document.createElement("style");
      st.id = "lunarStampStyle";
      st.textContent = `
.ls-overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:9993;display:flex;align-items:center;justify-content:center;padding:18px}
.ls-modal{width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:linear-gradient(160deg,#211d17,#17140f);border:1px solid #c9a86a45;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;animation:lsIn .3s ease both}
@keyframes lsIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ls-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #c9a86a25}
.ls-top b{color:#e8dcc0;font-size:15px;letter-spacing:1px}
.ls-sub{font-size:11px;color:#9a8c6e;margin-right:auto}
.ls-x{background:none;border:none;color:#9a8c6e;font-size:16px;cursor:pointer;padding:4px 8px}
.ls-x:hover{color:#e8dcc0}
.ls-body{padding:16px 18px 18px;overflow-y:auto;flex:1}
.ls-sec{font-size:11px;color:#c9a86a;letter-spacing:2px;margin:14px 0 8px}
.ls-sec:first-child{margin-top:0}
.ls-stamp{font-size:17px;color:#e8dcc0;letter-spacing:2px;background:rgba(201,168,106,.08);border:1px solid #c9a86a30;border-radius:10px;padding:12px 14px;text-align:center}
.ls-hint{font-size:11px;color:#8a7d63;line-height:1.8;margin-top:8px}
.ls-ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#bdb08e}
.ls-ctl input{width:56px;background:rgba(0,0,0,.3);border:1px solid #c9a86a35;color:#d8cba8;border-radius:6px;padding:5px 7px;font-size:12px}
.ls-btn{background:rgba(201,168,106,.14);border:1px solid #c9a86a44;color:#d8cba8;font-size:12px;padding:7px 13px;border-radius:8px;cursor:pointer;transition:all .2s}
.ls-btn:hover{background:rgba(201,168,106,.26)}
.ls-btn.off{opacity:.55}
.ls-alm{background:rgba(0,0,0,.22);border:1px solid #c9a86a30;border-radius:12px;padding:13px 15px}
.ls-alm b{color:#e8dcc0;font-size:14px;letter-spacing:1px}
.ls-alm i{font-style:normal;color:#c9a86a;font-size:12px;margin-left:8px}
.ls-yi,.ls-ji{font-size:12px;margin-top:8px;color:#bdb08e;line-height:1.8}
.ls-yi span,.ls-ji span{display:inline-block;min-width:26px;text-align:center;border-radius:5px;margin-right:8px;padding:1px 5px;font-size:11px}
.ls-yi span{background:rgba(111,184,138,.16);color:#8fb89a;border:1px solid #8fb89a35}
.ls-ji span{background:rgba(224,120,110,.14);color:#d98a80;border:1px solid #d98a8035}
.ls-bazi-form{display:flex;gap:8px;flex-wrap:wrap}
.ls-bazi-form input{flex:1;min-width:160px;background:rgba(0,0,0,.3);border:1px solid #c9a86a35;color:#d8cba8;border-radius:8px;padding:8px 10px;font-size:13px}
.ls-bazi-form select{background:rgba(0,0,0,.3);border:1px solid #c9a86a35;color:#d8cba8;border-radius:8px;padding:8px;font-size:13px}
.ls-bazi-out{margin-top:10px}
.ls-bazi{background:rgba(0,0,0,.22);border:1px solid #c9a86a30;border-radius:12px;padding:14px}
.ls-pillars{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}
.ls-pillars span{font-size:18px;color:#e8dcc0;letter-spacing:3px;background:rgba(201,168,106,.1);border:1px solid #c9a86a35;border-radius:9px;padding:10px 14px}
.ls-wx{font-size:12px;color:#9a8c6e;margin-top:10px;text-align:center;letter-spacing:1px}
.ls-loading{font-size:12px;color:#8a7d63;padding:14px;text-align:center}
.ls-empty{font-size:12px;color:#8a7d63;padding:12px;background:rgba(0,0,0,.2);border-radius:10px;text-align:center}
.ls-note{font-size:11px;color:#8a7d63;line-height:1.9;margin-top:14px}`;
      document.head.appendChild(st);
    }
  };
  window.LunarStamp = LunarStamp;
})();
