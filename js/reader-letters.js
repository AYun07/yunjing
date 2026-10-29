const ReaderLetters = function() {
  "use strict";
  const EVERY = 5;
  let genre = "free";
  let sending = false;
  const KEY = () => "rl_" + genre;
  function loadSent() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY()) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function saveSent(a) {
    try {
      localStorage.setItem(KEY(), JSON.stringify(a.slice(-60)));
    } catch (e) {
    }
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const PERSONAS = [
    { name: "追更十年的老书虫", tone: "毒舌但真心，爱挑刺也爱夸，口头禅带网文黑话" },
    { name: "眼泪浅的学生党", tone: "情绪充沛，为角色担惊受怕，爱用感叹号和颜文字" },
    { name: "考据党大佬", tone: "痴迷设定与伏笔，爱长段推理猜测，语气认真" },
    { name: "潜水多年的白嫖党", tone: "第一次冒泡，话不多但句句戳心" },
    { name: "隔壁作者小同行", tone: "以创作者视角点评技法，既羡慕又暗暗较劲" }
  ];
  function pickPersona(chapter) {
    const idx = chapter / EVERY % PERSONAS.length;
    return PERSONAS[Math.floor(idx) % PERSONAS.length];
  }
  async function compose(chapter) {
    const fw = window.storyFramework;
    if (!fw) return null;
    const th = window.ImmersiveSuite && ImmersiveSuite.themes && (ImmersiveSuite.themes[genre] || ImmersiveSuite.themes.mystery) || null;
    const v = fw.storyState.variables || {};
    const hist = fw.storyState.conversationHistory || [];
    const recent = [];
    for (let i = hist.length - 1; i >= 0 && recent.length < 4; i--) {
      if (hist[i].role !== "assistant") continue;
      let t = String(hist[i].content || "").replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").trim();
      if (t) recent.unshift(t.slice(0, 400));
    }
    const fs = (v.foreshadowings || []).filter((f) => f.status !== "resolved").map((f) => f.name).slice(0, 6);
    const tension = Number(v.tension) || 50;
    const p = pickPersona(chapter);
    const book = fw.storyState.setup && fw.storyState.setup.bookTitle || "这本书";
    const sys = `你在扮演一位正在追读连载小说《${book}》的虚拟读者「${p.name}」，读到第 ${chapter} 章，忍不住给作者写信。
人设口吻：${p.tone}。
写作要求：
1. 150-260 字，像真实读者来信，可分段，不用敬语开头结尾的客套
2. 必须引用至少一处最近剧情的具体细节（证明真读了）
3. ${fs.length ? `要对伏笔做出猜测（候选：${fs.join("、")}），猜对猜错都行` : "要催更或追问后续"}
4. ${tension >= 70 ? "剧情正紧张：情绪激动，催更强烈" : tension <= 30 ? "剧情平缓：可以吐槽节奏慢，威胁弃书（口嫌体正直）" : "节奏正常：点评+期待"}
5. 绝不出现"AI/模型/设定集/指令"等词，你就是读者本人`;
    const user = `【你刚读到的最近剧情】
${recent.join("\n——\n") || "（开局不久）"}

【当前状态】第${chapter}章 · 紧张度${tension}/100${fs.length ? `
【未回收伏笔】${fs.join("、")}` : ""}

请写出你给作者的来信正文（只写正文，不要标题）。`;
    const msgs = [
      { role: "system", content: sys },
      { role: "user", content: user }
    ];
    const reply = window.ChannelHub && ChannelHub.canCall("troupe") ? await ChannelHub.call("troupe", msgs) : await window.callOpenAI(msgs, {});
    return (reply || "").trim().slice(0, 600) || null;
  }
  async function fire(chapter) {
    var _a;
    if (sending) return;
    sending = true;
    try {
      const body = await compose(chapter);
      if (!body) return;
      const p = pickPersona(chapter);
      const added = window.ImmersiveSuite && ImmersiveSuite.addLetter({
        from: p.name,
        title: `第${chapter}章读后 · 来信`,
        body,
        round: chapter,
        reader: true
      });
      if (added) {
        const sent = loadSent();
        sent.push(chapter);
        saveSent(sent);
        try {
          (_a = window.showToast) == null ? void 0 : _a.call(window, "📬 读者来信已送达传书匣", "info");
        } catch (e) {
        }
      }
    } catch (e) {
      console.warn("[ReaderLetters]", e.message);
    } finally {
      sending = false;
    }
  }
  const api = {
    onGenre(g) {
      genre = g || "free";
      return api;
    },
    onVars(vars) {
      const ch = Number(vars && vars.chapter) || 0;
      if (!ch || ch % EVERY !== 0) return;
      const sent = loadSent();
      if (sent.includes(ch)) return;
      const fw = window.storyFramework;
      if (!fw || !fw.isApiConfigured || !fw.isApiConfigured()) return;
      fire(ch);
    },
    /** 手动催一封（传书面板彩蛋入口） */
    poke() {
      var _a, _b;
      const ch = Number(window.storyFramework && storyFramework.storyState.variables.chapter) || 1;
      const sent = loadSent();
      if (sent.includes(-1)) {
        try {
          (_a = window.showToast) == null ? void 0 : _a.call(window, "读者刚写过啦，去传书匣看", "info");
        } catch (e) {
        }
        return;
      }
      sent.push(-1);
      saveSent(sent);
      const p = pickPersona(ch);
      window.ImmersiveSuite && ImmersiveSuite.addLetter({
        from: p.name,
        title: "被你戳出来的加急来信",
        round: ch,
        reader: true,
        body: `作者你居然戳我！既然你都开口了……那我就直说了：第${ch}章之后到底怎样了？我不睡可以，你不能烂尾！`
      });
      try {
        (_b = window.showToast) == null ? void 0 : _b.call(window, "📬 读者被你戳了一下，回信了", "success");
      } catch (e) {
      }
    },
    resetAll() {
      try {
        localStorage.removeItem(KEY());
      } catch (e) {
      }
    }
  };
  return api;
}();
window.ReaderLetters = ReaderLetters;
