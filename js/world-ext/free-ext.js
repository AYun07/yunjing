/**
 * 自由工坊 · 界专属扩展（v3.67.0）
 * 🧩 万能自定义槽——已移交 PlayerKit 通用槽（js/player-kit.js customModule：
 *    id 'custom' 同名继承旧存档，开局设定台播种 + 中途增删 + 「自定义.字段」双轨上报）。
 *
 * v3.67.0 开放大世界配套设施补齐（P9：自由界不该只有随身三件套）：
 *    ①恩怨账 ②委托板 ③据点家业 ④势力谱 —— 与「自由创作·设施」世界书条目同源，
 *    AI 可经变量上报自动登记（恩怨·人名 / 势力·势力名 / 据点.所在），玩家面板可查可改。
 */
(function () {
    'use strict';

    var MAX_ITEMS = 24;

    /* ---------- ① 恩怨账（人际复利：恩/怨/盼） ---------- */
    var grudgeMod = {
        id: "grudges",
        icon: "🧾",
        name: "恩怨账",
        tip: "每个与你有过来往的人，恩、怨、盼三笔账——AI 按此决定故人重逢时的态度冷暖",
        init: function () { return { list: [] }; },
        read: function (s, vars) {
            var d = false;
            var keys = vars ? Object.keys(vars) : [];
            keys.forEach(function (k) {
                if (!/^恩怨·/.test(k)) return;
                var name = k.replace(/^恩怨·/, "").trim().slice(0, 14);
                if (!name) return;
                var raw = String(vars[k] || "").slice(0, 120);
                var cur = (s.list || []).filter(function (e) { return e.name === name; })[0];
                if (!cur) {
                    if ((s.list || []).length >= MAX_ITEMS) return;
                    s.list.push({ name: name, note: raw });
                    d = true;
                } else if (cur.note !== raw) {
                    cur.note = raw; d = true;
                }
            });
            return d;
        },
        act: function (s, action, payload) {
            s.list = s.list || [];
            if (action === "add") {
                var p = WXH.asObj(payload);
                var name = String(p.name || "").trim().slice(0, 14);
                if (!name) return "请填写人名";
                if (s.list.filter(function (e) { return e.name === name; }).length) return "此人已在账上";
                if (s.list.length >= MAX_ITEMS) return "账页已满（" + MAX_ITEMS + " 人）——先销几笔旧账";
                s.list.push({ name: name, note: String(p.note || "").slice(0, 120) });
                return "🧾 已记账：" + name;
            }
            if (action === "del") {
                var i = Number(payload);
                if (s.list[i]) return "已销账：「" + s.list.splice(i, 1)[0].name + "」";
                /* v4.07.2 修 D-22：原先是裸 return —— 点了没反应，调用方也拿不到任何反馈 */
                return "该条目已不在账上（可能已销过）";
            }
        },
        summary: function (s) {
            var n = (s.list || []).length;
            return n ? [{ i: "🧾", v: String(n), l: "笔恩怨" }] : [];
        },
        html: function (s) {
            s.list = s.list || [];
            if (!s.list.length) return WXH.empty("🧾", "尚无恩怨往来", "帮过谁、得罪过谁，都会记在这里——AI 重逢旧人时先翻此账");
            var rows = s.list.map(function (e, i) {
                return '<div style="display:flex;justify-content:space-between;gap:6px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.08);font-size:12px;">'
                    + '<span><b>' + WXH.esc(e.name) + '</b>' + (e.note ? '<small style="opacity:.6;margin-left:6px;">' + WXH.esc(e.note) + '</small>' : "") + '</span>'
                    + '<i class="wx-x" data-mod="grudges" data-act="del" data-i="' + i + '" title="销账">✕</i></div>';
            }).join("");
            return WXH.card("恩怨账（" + s.list.length + "）", rows, { icon: "🧾", grow: true });
        },
        directive: function (s) {
            s.list = s.list || [];
            if (!s.list.length) return "";
            var line = s.list.slice(-8).map(function (e) { return e.name + (e.note ? "（" + e.note + "）" : ""); }).join("；");
            return "恩怨账（历史资产负债表，重逢故人先翻账）：" + line + "——受过大恩者落难时雪中送炭，结过怨者背后可能有一刀；好感是当下情绪，恩怨是旧账。";
        }
    };

    /* ---------- ② 委托板（没有主线时的任务引擎） ---------- */
    var jobsMod = {
        id: "jobs",
        icon: "📋",
        name: "委托板",
        tip: "酒肆告示、熟人口信、行会悬红——接下的差事与其中蹊跷都挂在这",
        init: function () { return { list: [] }; },
        act: function (s, action, payload) {
            s.list = s.list || [];
            if (action === "add") {
                var p = WXH.asObj(payload);
                var title = String(p.title || "").trim().slice(0, 24);
                if (!title) return "请填写差事名目";
                if (s.list.length >= MAX_ITEMS) return "板已挂满——先了结几单";
                s.list.push({ title: title, from: String(p.from || "").slice(0, 12), detail: String(p.detail || "").slice(0, 80), done: false });
                return "📋 新委托：" + title;
            }
            if (action === "done") {
                var i = Number(payload);
                if (s.list[i]) { s.list[i].done = !s.list[i].done; return s.list[i].done ? "✅ 已了结：" + s.list[i].title : "↩ 重新挂起：" + s.list[i].title; }
                return "该委托已不在单上";
            }
            if (action === "del") {
                var j = Number(payload);
                if (s.list[j]) return "已揭下：" + s.list.splice(j, 1)[0].title;
                return "该委托已不在单上";
            }
        },
        summary: function (s) {
            var open = (s.list || []).filter(function (j) { return !j.done; }).length;
            return open ? [{ i: "📋", v: String(open), l: "单在身", tone: open >= 3 ? "bad" : "" }] : [];
        },
        html: function (s) {
            s.list = s.list || [];
            if (!s.list.length) return WXH.empty("📋", "板上暂无委托", "去酒肆告示板、行会或熟人口信处找活——十单三单有蹊跷");
            var rows = s.list.map(function (j, i) {
                return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.08);font-size:12px;">'
                    + '<i class="wx-x" data-mod="jobs" data-act="done" data-i="' + i + '" title="了结/挂起" style="color:' + (j.done ? "#7adc98" : "var(--text-faint)") + ';">' + (j.done ? "✓" : "○") + '</i>'
                    + '<span style="flex:1;' + (j.done ? "opacity:.45;text-decoration:line-through;" : "") + '"><b>' + WXH.esc(j.title) + '</b>'
                    + (j.from ? '<small style="opacity:.6;margin-left:6px;">' + WXH.esc(j.from) + '</small>' : "")
                    + (j.detail ? '<small style="display:block;opacity:.55;">' + WXH.esc(j.detail) + '</small>' : "") + '</span>'
                    + '<i class="wx-x" data-mod="jobs" data-act="del" data-i="' + i + '" title="揭下">✕</i></div>';
            }).join("");
            var open = s.list.filter(function (j) { return !j.done; }).length;
            return WXH.card("委托板（在身 " + open + "）", rows, { icon: "📋", grow: true });
        },
        directive: function (s) {
            s.list = s.list || [];
            var open = s.list.filter(function (j) { return !j.done; });
            if (!open.length) return "";
            var line = open.slice(-6).map(function (j) { return j.title + (j.from ? "（" + j.from + "委托）" : "") + (j.detail ? "：" + j.detail : ""); }).join("；");
            return "在身委托（每单了结后自然长出下一单钩子）： " + line + "——差事之间要有涟漪，旧委托的余波会追上玩家。";
        }
    };

    /* ---------- ③ 据点家业（玩家能回去的地方） ---------- */
    var baseMod = {
        id: "homebase",
        icon: "🏠",
        name: "据点家业",
        tip: "一间屋、一个山头、一艘船——所在、人、规矩、隐患，AI 会在你离开期间让它自己演化",
        init: function () { return { place: "", folks: "", rules: "", risk: "" }; },
        read: function (s, vars) {
            var d = false;
            var map = { "据点.所在": "place", "据点.人": "folks", "据点.规矩": "rules", "据点.隐患": "risk" };
            Object.keys(map).forEach(function (k) {
                if (vars && vars[k] != null && vars[k] !== "") {
                    var val = String(vars[k]).slice(0, 60);
                    if (s[map[k]] !== val) { s[map[k]] = val; d = true; }
                }
            });
            return d;
        },
        act: function (s, action, payload) {
            if (action === "set") {
                var p = WXH.asObj(payload);
                if (p.place != null) s.place = String(p.place).slice(0, 60);
                if (p.folks != null) s.folks = String(p.folks).slice(0, 60);
                if (p.rules != null) s.rules = String(p.rules).slice(0, 60);
                if (p.risk != null) s.risk = String(p.risk).slice(0, 60);
                return "🏠 据点已登记" + (s.place ? "：" + s.place : "");
            }
            if (action === "clear") { s.place = ""; s.folks = ""; s.rules = ""; s.risk = ""; return "已清空据点记录"; }
        },
        summary: function (s) {
            return s.place ? [{ i: "🏠", v: "有家", l: s.place.slice(0, 6) }] : [];
        },
        html: function (s) {
            if (!s.place && !s.folks && !s.rules && !s.risk) return WXH.empty("🏠", "尚无据点", "租间屋、占个山头——家是开放世界剧情的枢纽（朋友来投、仇家寻上门都从这里开始）");
            return WXH.card("据点家业", WXH.kv([["所在", s.place], ["同住", s.folks], ["门规", s.rules], ["隐患", s.risk]]), { icon: "🏠", grow: true });
        },
        directive: function (s) {
            if (!s.place) return "";
            var segs = [];
            if (s.place) segs.push("所在：" + s.place);
            if (s.folks) segs.push("同住：" + s.folks);
            if (s.rules) segs.push("门规：" + s.rules);
            if (s.risk) segs.push("隐患：" + s.risk);
            return "玩家据点（离开期间按各人日程自行演化，归来要有变化）： " + segs.join("；");
        }
    };

    /* ---------- ④ 势力谱（世界上的派系与玩家的名头） ---------- */
    var forcesMod = {
        id: "forces",
        icon: "⚔",
        name: "势力谱",
        tip: "世界上的派系与你在各家眼中的名头——AI 按利益逻辑让它们自行合纵连横",
        init: function () { return { vals: {} }; },
        read: function (s, vars) {
            var d = false;
            var keys = vars ? Object.keys(vars) : [];
            keys.forEach(function (k) {
                if (!/^势力·/.test(k)) return;
                var name = k.replace(/^势力·/, "").trim().slice(0, 12);
                if (!name) return;
                var v = WXH.asNum(vars[k], 30);
                if (s.vals[name] !== v) { s.vals[name] = v; d = true; }
            });
            return d;
        },
        act: function (s, action, payload) {
            s.vals = s.vals || {};
            if (action === "add") {
                var p = WXH.asObj(payload);
                var name = String(p.name || "").trim().slice(0, 12);
                if (!name) return "请填写势力名";
                s.vals[name] = WXH.asNum(p.rel, 30);
                return "⚔ 已入谱：" + name;
            }
            if (action === "del") {
                var nm = String(payload || "").trim();
                if (s.vals[nm] != null) { delete s.vals[nm]; return "已除名：" + nm; }
                return "「" + (nm || "该势力") + "」不在势力谱上";
            }
        },
        summary: function (s) {
            var keys = Object.keys(s.vals || {});
            if (!keys.length) return [];
            var sorted = keys.slice().sort(function (a, b) { return s.vals[b] - s.vals[a]; });
            return [{ i: "⚔", v: String(s.vals[sorted[0]]), l: sorted[0], tone: s.vals[sorted[0]] >= 70 ? "ok" : (s.vals[sorted[0]] <= 20 ? "bad" : "") }];
        },
        html: function (s) {
            var keys = Object.keys(s.vals || {});
            if (!keys.length) return WXH.empty("⚔", "谱上无名", "与任何一方打交道后自动登记——有名头没门路，人家也只当你耳闻");
            var tone = function (v) { return v >= 70 ? "备受敬重" : v >= 45 ? "有几分薄面" : v >= 20 ? "无名之辈" : "不受待见"; };
            var rows = keys.map(function (k) {
                var v = s.vals[k];
                return '<div style="margin:8px 0;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">'
                    + '<span>⚔ ' + WXH.esc(k) + '</span><b>' + v + ' · ' + tone(v) + '</b></div>'
                    + WXH.bar(v, "linear-gradient(90deg,#5a7ea8,#88b0d8)") + '</div>';
            }).join("");
            return WXH.card("势力谱（" + keys.length + " 家）", rows, { icon: "⚔", grow: true });
        },
        directive: function (s) {
            var keys = Object.keys(s.vals || {});
            if (!keys.length) return "";
            var list = keys.slice(-8).map(function (k) { return k + "=" + s.vals[k]; }).join("，");
            return "玩家在各势力的名头（0-100，涨落须有实质互动支撑，声望涨跌写进 NPC 的态度）： " + list;
        },
        contract: function (s) {
            return "势力谱[势力·<势力名>=0-100 名头值]（与该势力有实质互动才变动）";
        }
    };

    if (window.WorldExt) WorldExt.define('free', [grudgeMod, jobsMod, baseMod, forcesMod]);
})();
