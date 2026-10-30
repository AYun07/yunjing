/* =========================================================================
 * 云境 · 机缘归属账本（v3.55.19 · 世界动态性的核心）
 * -------------------------------------------------------------------------
 * 解决的问题：世界是静态的复述，还是活的世界？
 *
 *   旧行为：原著主角永远拥有他该有的一切。玩家就算抢先一步拿到掌天瓶，
 *           下一轮韩立照样揣着瓶子登场——机缘被复制了，世界是假的。
 *
 *   新行为：机缘具唯一性。谁先拿到就是谁的。玩家夺走之后，原著主角
 *           必须按「缺失这份机缘」的处境重新推演自己的命运分岔——
 *           他可能走另一条路、可能死在某处、可能一辈子止步炼气。
 *
 * 数据来源三条：
 *   ① 主笔在正文后输出 (claimed) 块显式登记；
 *   ② 状态变量里的道具/物品自动比对（命中已登记机缘名即更新归属）；
 *   ③ 玩家在「剧情上下文」面板手动登记/改判。
 *
 * 输出：注入主笔 / 动态世界 / 变量 AI 的《机缘归属账本》条款。
 * ========================================================================= */
(function () {
  "use strict";

  var PREFIX = "yunjingCanonLedger:";
  var listeners = [];

  function genreKey() {
    try {
      var fw = window.storyFramework;
      return (fw && fw.config && (fw.config.genre || fw.config.id)) || "default";
    } catch (e) {
      return "default";
    }
  }

  function key() {
    return PREFIX + genreKey();
  }

  function load() {
    try {
      var raw = localStorage.getItem(key());
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function save(o) {
    try {
      localStorage.setItem(key(), JSON.stringify(o));
    } catch (e) {
      try {
        window.MoStore && MoStore.setItem(key(), JSON.stringify(o));
      } catch (e2) {}
    }
    emit();
  }

  function emit() {
    listeners.forEach(function (fn) {
      try {
        fn();
      } catch (e) {}
    });
  }

  /** 当前世界的原著主角名（与叙事立场共用一份判定，避免两处口径不一） */
  function canonHero() {
    if (window.StoryStance && window.StoryStance.canonHeroName) return window.StoryStance.canonHeroName();
    try {
      var fw = window.storyFramework;
      return (fw && fw.config && fw.config.canonProtagonist) || "原著主角";
    } catch (e) {
      return "原著主角";
    }
  }

  /** 归属归类：玩家 / 原著主角 / 其他 */
  function classify(who, heroName, canonName) {
    var w = String(who || "").trim();
    if (!w) return "other";
    if (/^(玩家|我|本人|自己)$/.test(w)) return "player";
    if (heroName && w === heroName) return "player";
    if (canonName && w === canonName) return "canon";
    if (canonName && w.indexOf(canonName) >= 0 && w.indexOf("（") < 0) return "canon";
    return "other";
  }

  var CanonLedger = {
    PREFIX: PREFIX,

    onChange(fn) {
      if (typeof fn === "function") listeners.push(fn);
    },

    /** 全部条目（数组，按登记顺序） */
    all() {
      var o = load();
      return Object.keys(o).map(function (k) {
        return o[k];
      });
    },

    /** 已被玩家夺走的机缘（世界动态性最关键的那一批） */
    takenByPlayer() {
      return this.all().filter(function (x) {
        return x.holder === "player";
      });
    },

    /**
     * 登记/更新一条机缘归属
     * @param {string} name  机缘名（掌天瓶、长春功…）
     * @param {string} who   归属者（玩家 / 玩家名 / 原著主角名 / 其他某人）
     * @param {object} opt   { note, round }
     */
    claim(name, who, opt) {
      name = String(name || "").trim();
      if (!name) return null;
      opt = opt || {};
      var o = load();
      var heroName = "";
      try {
        var fw = window.storyFramework;
        heroName = (fw && fw.storyState && fw.storyState.setup && fw.storyState.setup.playerName) || "";
      } catch (e) {}
      var holder = classify(who, heroName, canonHero());
      var prev = o[name];
      o[name] = {
        name: name,
        who: String(who || "").trim(),
        holder: holder,
        note: opt.note || (prev && prev.note) || "",
        round: opt.round || (prev && prev.round) || "",
        at: prev && prev.at ? prev.at : Date.now(),
        updatedAt: Date.now()
      };
      save(o);
      return o[name];
    },

    remove(name) {
      var o = load();
      if (!o[name]) return false;
      delete o[name];
      save(o);
      return true;
    },

    clear() {
      save({});
    },

    /**
     * 解析正文里的 (claimed) 块并登记。
     * 语法：
     *   (claimed)
     *   掌天瓶=玩家
     *   长春功=韩立（第12回合·黄枫谷）
     *   (/claimed)
     * 也接受「+掌天瓶」表示玩家取得。
     */
    parse(text) {
      if (!text) return [];
      var got = [];
      var re = /\(claimed\)\s*([\s\S]*?)\s*\(\/claimed\)/gi;
      var m;
      while ((m = re.exec(text)) !== null) {
        var lines = String(m[1] || "").split(/\n+/);
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln || ln.charAt(0) === "#") continue;
          var plus = ln.match(/^\+\s*(.+)$/);
          if (plus) {
            var nm = plus[1].replace(/[（(].*$/, "").trim();
            if (nm) got.push(this.claim(nm, "玩家", {}));
            continue;
          }
          var kv = ln.match(/^(.+?)\s*[=＝]\s*(.+)$/);
          if (!kv) continue;
          var name = kv[1].trim();
          var rest = kv[2].trim();
          var noteM = rest.match(/[（(]([^）)]*)[）)]/);
          var note = noteM ? noteM[1] : "";
          var who = noteM ? rest.replace(/[（(][^）)]*[）)]/g, "").trim() : rest;
          if (name && who) got.push(this.claim(name, who, { note: note }));
        }
      }
      return got.filter(Boolean);
    },

    /** 从状态变量里的道具自动比对（命中已登记机缘名 → 更新归属） */
    syncFromVariables() {
      var updated = [];
      try {
        var fw = window.storyFramework;
        var v = (fw && fw.storyState && fw.storyState.variables) || {};
        var o = load();
        var names = Object.keys(o);
        if (!names.length) return [];
        var pool = [];
        var push = function (s) {
          if (s) pool.push(String(s));
        };
        var items = v.items || v.道具 || v.物品 || v.持有 || {};
        if (Array.isArray(items)) {
          items.forEach(function (it) {
            push(typeof it === "string" ? it : it && (it.name || it.名));
          });
        } else if (items && typeof items === "object") {
          Object.keys(items).forEach(function (k) {
            push(k);
            var val = items[k];
            push(typeof val === "string" ? val : val && (val.name || val.holder));
          });
        }
        /* 平铺变量里形如「机缘·XX」「XX（得）」的键 */
        Object.keys(v).forEach(function (k) {
          if (/机缘|所得|持有|物品|道具|收获/.test(k)) push(k);
        });
        var blob = pool.join(" | ");
        var heroName = (fw.storyState.setup && fw.storyState.setup.playerName) || "";
        names.forEach(function (n) {
          if (blob.indexOf(n) >= 0) {
            var cur = o[n];
            if (!cur || cur.holder !== "player") {
              updated.push(CanonLedger.claim(n, heroName || "玩家", {}));
            }
          }
        });
      } catch (e) {}
      return updated.filter(Boolean);
    },

    /**
     * 生成注入提示词的《机缘归属账本》。
     * 这是「世界是动态的」能否成立的关键一段。
     */
    buildPromptBlock() {
      var all = this.all();
      if (!all.length) return "";
      var canonName = canonHero();
      var mine = all.filter(function (x) {
        return x.holder === "player";
      });
      var others = all.filter(function (x) {
        return x.holder !== "player";
      });
      var lines = [];
      lines.push("【机缘归属账本（世界动态性铁律——唯一性，不得复制）】");
      lines.push("以下事物具唯一性：谁先拿到就是谁的，同一份机缘不得同时存在于两人之手，也不得事后凭空补发。");
      if (mine.length) {
        lines.push("· 已被玩家夺走（" + canonName + "不得再拥有，须按「缺失此物之后」重新推演他的命运分岔——他可能另寻他法、可能止步、可能死在原本能活下来的地方；严禁让他仍然持有、仍然受益、或得到等价替代品）：");
        mine.forEach(function (x) {
          lines.push("    - " + x.name + " → " + (x.who || "玩家") + (x.note ? "（" + x.note + "）" : "") + (x.round ? " · 第" + x.round + "回合" : ""));
        });
      }
      if (others.length) {
        lines.push("· 已归属他人（玩家不得凭空获得，若要取得须在正文里亲自争取并写明过程）：");
        others.forEach(function (x) {
          lines.push("    - " + x.name + " → " + (x.who || "他人") + (x.note ? "（" + x.note + "）" : ""));
        });
      }
      lines.push("· 未列入此账本的原著机缘，仍按原著轨道归其原主；玩家若要染指，须由玩家在正文里亲身争取，得手后由你用 (claimed) 块登记。");
      return "\n" + lines.join("\n");
    },

    /** 主笔侧的输出协议说明（教模型怎么登记） */
    buildProtocol() {
      return (
        "\n【机缘登记协议】当一件具唯一性的原著机缘/重宝/席位/传承易主时（尤其是玩家从原著主角原本的命运里夺走了什么），" +
        "正文写完后另起一行输出登记块，供世界账本永久记录：\n" +
        "(claimed)\n" +
        "掌天瓶=玩家（墨大夫洞府·第3回合）\n" +
        "(/claimed)\n" +
        "登记后该物即归新主——原主不得再持有、不得事后补发；无易主则不输出此块，不要为凑格式而登记。"
      );
    }
  };

  window.CanonLedger = CanonLedger;
})();
