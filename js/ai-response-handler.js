const StoryResponseHandler = {
  /** 处理一次完整的 AI 回复 */
  handle(rawReply) {
    const fw = window.storyFramework;
    const parser = window.VariableInstructionParser;
    let reply = window.stripAIThink ? window.stripAIThink(rawReply) : rawReply;
    /* v3.47.18 咩咩专用正则：在解析变量/选项/正文之前先过一遍，
       让 <selection> 变成【行动选项】（这样云境既有的选项按钮能直接接管），
       并让"去 AI 味"清理的结果贯穿变量解析、选项提取与存档。 */
    reply = window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.enabled()
      ? window.MoMiaomiaoRegex.preParse(reply)
      : reply;
    const oldCh = Number(fw.storyState.variables && fw.storyState.variables.chapter) || 0;
    const { newVariables, updateBlock } = parser.parse(reply, fw.storyState.variables, { storyRegistration: true });
    /* v3.47.8 章节保底推进：模型输出了变量块却没让 chapter 进位（写坏块/漏 chapter 字段），
       或开局首章完全没有块——核心循环（选项推进/存档恢复判定）依赖 chapter，永不因模型手误卡死。 */
    try {
      const wroteBlock = /[(【<]\/?variable_update/i.test(reply);
      const newCh = Number(newVariables.chapter) || 0;
      const bodyLen = reply.replace(/\s/g, "").length;
      if (fw.storyState.isStoryStarted && bodyLen > 400 && newCh === oldCh) {
        newVariables.chapter = oldCh + 1;
        fw.storyState.driftNotes = (fw.storyState.driftNotes || "") + `[v3.47.8] 第${newVariables.chapter}回章节号由保底逻辑推进（模型未正确上报 chapter）。`;
      }
      if (fw.storyState.isStoryStarted && bodyLen > 0) {
        const oldW = Number(fw.storyState.variables && fw.storyState.variables.wordCount) || 0;
        const newW = Number(newVariables.wordCount) || 0;
        /* v3.53.0：模型常把累计字数写成「本章字数」（实测 "wordCount: 780" 盖掉 2509），
           导致字数条越写越少。判据：报上来的值没体现出「在旧值之上增长」就以实测正文为准。 */
        if (!(newW > 0)) newVariables.wordCount = oldW + bodyLen;
        else if (newW < oldW + Math.max(120, bodyLen * 0.35)) newVariables.wordCount = oldW + bodyLen;
      }
    } catch (e) { /* 保底不干扰主解析 */ }
    fw.storyState.variables = newVariables;
    /* v3.55.23 行旅图鉴实时追踪：每轮变量落地即上报——AI 报了玩家新位置，
       地图足迹与剧情地标立刻生成，不再等到打开面板才补读 */
    try {
      if (window.StoryAtlas && StoryAtlas.onVars) StoryAtlas.onVars(fw.storyState.variables);
    } catch (e) {}
    const options = this.extractOptions(reply);
    const body = this.extractBody(reply, options);
    const IP = window.ImmersionPlus;
    const hooks = IP && IP.extractHooks ? IP.extractHooks(reply) : { next: "", gameover: "", echoes: [] };
    this.renderStoryMessage(body, updateBlock, options, newVariables, this.detectOptionsLabel(reply), { live: true, hook: hooks.next });
    fw.updateStatusPanel();
    fw.storyState.turnCount += 1;
    fw.saveStory();
    try {
      document.dispatchEvent(new CustomEvent("story:turn-saved", { detail: { turn: fw.storyState.turnCount } }));
    } catch (e) {
    }
    if (IP && IP.onTurnRendered) IP.onTurnRendered(reply, body, newVariables);
    if (window.NpcPortrait && NpcPortrait.onTurnRendered) {
      try {
        const box = document.getElementById("chatMessages");
        NpcPortrait.onTurnRendered(newVariables, box ? box.lastElementChild : null);
      } catch (e) {
      }
    }
    return { body, updateBlock, options };
  },
  /** 选项区标题关键词（工坊正文的选项段；扮演模式输出【行动选项】，创作模式输出【情节走向】）
   *  v3.14.0 新增「关键抉择 / 生死抉择」——沉浸演出协议的重大转折标记，触发聚光演出 */
  OPT_HEADER_RE: /【(情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】/i,
  /** 提取小说正文（去掉变量块与选项区，尽量兼容各家模型的"不守格式"输出）
   *  options：已提取的选项文本数组（可选）——用于剥离无标题的结尾选项行，确保正文纯叙事
   *  v3.46.2 修复「正文缺失」：
   *  - 旧版对未闭合/括号混用的 variable_update 一刀切"删到结尾"，模型把变量块写在
   *    回复开头（相当常见）且没规范闭合时，整章正文被连带清空，且存档重放依旧为空
   *    （玩家反馈"刷新后还是这样"）。现改为只吞噬"协议行段"，遇叙事即停；
   *  - 常规剥离意外清空正文时，启动 _rescueProse 本地打捞兜底（老存档同样受益）。 */
  extractBody(reply, options) {
    if (!reply) return "";
    let body = reply;
    /* v3.55.19 机缘归属账本：先把 (claimed) 块吸收进世界账本（幂等），再从正文剥离——
       这块是给世界看的登记簿，不是给读者看的正文 */
    if (window.CanonLedger) {
      try {
        CanonLedger.parse(reply);
      } catch (e) {}
      body = body.replace(/\(claimed\)[\s\S]*?\(\/claimed\)/gi, "").replace(/【claimed】[\s\S]*?【\/claimed】/gi, "").replace(/<claimed>[\s\S]*?<\/claimed>/gi, "");
    }
    /* v3.55.23 大势演化账本：把 (world) 块吸收进大势账本（幂等），再从正文剥离——
       诱因终结、大事改道、羁绊易主、新生事件，都从这里落账 */
    if (window.CanonTimeline) {
      try {
        CanonTimeline.parse(reply);
      } catch (e) {}
      body = body.replace(/\(world\)[\s\S]*?\(\/world\)/gi, "").replace(/【world】[\s\S]*?【\/world】/gi, "").replace(/<world>[\s\S]*?<\/world>/gi, "");
    }
    /* v3.53.0：先摘掉迷你状态协议（(: 名.字段: 值; …)），再走常规剥离 */
    body = this._stripMiniStatus(body);
    /* v3.46.2 纵深防御：自带 think 剥离（常规调用方均已预剥，此处兜底，
       防止推理模型思考过程混入正文/导出/朗读） */
    body = body.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "").replace(/<think(?:\s[^>]*)?>[\s\S]*$/i, "").replace(/<\/think\s*>/gi, "");
    body = body.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【variable_update】[\s\S]*?【\/variable_update】/gi, "").replace(/<variable_update>[\s\S]*?<\/variable_update>/gi, "");
    body = this._stripUnclosedVarBlock(body);
    if (window.ImmersionPlus && window.ImmersionPlus.stripHookMarkers) {
      body = window.ImmersionPlus.stripHookMarkers(body);
    }
    body = body.replace(/```[a-zA-Z]*\r?\n[\s\S]*?```/g, (fence) => {
      if (/variable_update/i.test(fence)) return "";
      const inner = fence.replace(/```[a-zA-Z]*\r?\n?/, "").replace(/```$/, "");
      const isVarDump = /^[\s\S]*?"(chapter|wordCount|stats|characters|foreshadowings|totalChapters|title)"\s*:/i.test(inner) || /^[\s\S]*?\b(chapter|wordCount|tension|sanity|revelation|crisis|danger)\s*[:：]/i.test(inner);
      return isVarDump ? "" : fence;
    });
    body = body.split("\n").filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(chapter|wordCount|totalChapters|tension|sanity|revelation|crisis|danger|logic)\s*[:：=]\s*[+-]?\d/.test(t)) return false;
      if (/^[+-]\S.{0,23}(\s*x\s*\d+)?（(埋设|回收|获得|失去|埋下|揭晓)）$/.test(t)) return false;
      /* v3.47.1：剥离误写进正文的「容器.字段=值 / 容器.字段: 值」行式指令
         （旧 player-kit 模板教 AI 用「=」，这些行曾以字面量留在正文里）。
         防误伤：整行 ≤80 字符且不以句读收尾——真叙事不会是短促的键值形态 */
      if (/^["“]?[\u4e00-\u9fa5A-Za-z_][\w\u4e00-\u9fa5]{0,15}(?:\.[\w\u4e00-\u9fa5]{1,16})+["”]?\s*[：:=]\s*\S/.test(t) && t.length <= 80 && !/[。！？…]["'”」』]?$/.test(t)) return false;
      /* v3.47.5：剥离误写进正文的「模块名: 值」自由格式状态行（玩家实锤的正文漏数据）——
         增量清单值 / JSON 值 / 多键连写 / 已知模块键四形态，句读守卫防误伤叙事对白 */
      if (this._isLeakedLine(t)) return false;
      return true;
    }).join("\n");
    body = body.replace(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】[\s\S]*$/i, "");
    body = body.replace(/(?:^|\n)[ \t]*(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)[ \t]*[:：]([\s\S]*)$/i, (m, tail) => {
      if (tail.length > 800) return m;
      if (!/(?:^|\n)\s*(?:[ABCDabcd1-9１-９][.、:：)）]|[①②③④⑤])/.test(tail)) return m;
      return m.startsWith("\n") ? "\n" : "";
    });
    if (options && options.length) {
      const optSet = new Set(options.map((o) => String(o).trim()));
      const lines = body.split("\n");
      let i = lines.length;
      while (i > 0) {
        const t = lines[i - 1].trim();
        if (!t) {
          i--;
          continue;
        }
        const stripped = t.replace(/^(?:[ABCDabcd1-9１-９]|[选项]+\s*[一二三四1-4])\s*[.、:：)）]?\s*/, "").trim();
        if (optSet.has(stripped) || optSet.has(t)) {
          i--;
          continue;
        }
        break;
      }
      if (i < lines.length) body = lines.slice(0, i).join("\n");
    }
    body = body.replace(/\(?\/?variable_update\)?/gi, "").replace(/\n{3,}/g, "\n\n");
    const out = body.trim();
    /* v3.46.2 防线：常规剥离后正文为空/过短 → 从原文打捞叙事段兜底
       （覆盖：正文整体被写进代码围栏、残缺标记连锁误剥、只吐变量块等情形） */
    if (out.replace(/\s/g, "").length < 15) {
      const rescued = this._rescueProse(reply);
      if (rescued) return rescued;
    }
    return out;
  },
  /* ==================== v3.46.2 未闭合变量块安全剥离 ====================
   * 旧行为：遇到任何形如 (variable_update / 【variable_update / <variable_update
   * 的标记（含残缺闭合）就把其后全部内容删光——标记出现在回复开头时等于清空全章正文。
   * 新行为：从标记处逐行吞噬"协议行"（键值 / ±条目 / >>轨迹 / JSON / 短标签），
   * 一旦遇到叙事散文立即停止；若标记后紧跟的就不是协议行（正文里提到该词等情形），
   * 只删除标记本身，其后正文原样保留。 */
  _stripUnclosedVarBlock(body) {
    const MARKER = /[(【<]\/?variable_update[)】>]?/i;
    let m;
    let guard = 12;
    while ((m = body.match(MARKER)) && guard-- > 0) {
      const head = body.slice(0, m.index);
      const tail = body.slice(m.index + m[0].length);
      /* 标记独立成行（真正的块开头）→ 首行允许歧义协议行（「身份: 天才修士」类字段）；
         标记内联在句中（正文提到这个词）→ 首行必须是确定协议行，否则视为叙事保留 */
      const standalone = (head === "" || /\n\s*$/.test(head)) && (tail === "" || /^\s*(?:\r?\n|[)】>]\s*\r?\n)/.test(tail));
      const lines = tail.split("\n");
      let i = 0, ate = 0;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) { i++; continue; }
        if (this._isVarProtocolLine(t, ate > 0 || standalone)) { i++; ate++; continue; }
        break;
      }
      body = ate > 0 ? head + lines.slice(i).join("\n") : head + tail;
    }
    /* v3.53.0：剥掉正文开头的章节标题行（"第一章·雪落泥瓶巷" / "### 第 3 章 雪夜" / "**第2章**"）。
       模型有时把标题当正文第一段写进来，渲染后像一句孤零零的话；只处理开头一行，正文中间不动。
       v3.55.30 修复：标题段内不得含句读（：，。！？…）——否则会误吞「第X回合：叙事正文…」这类
       以「第N回」起头的正常叙事首段（本作 genre 里「第N回合：…」是标准开场白），把整段正文当标题删空，
       进而触发空正文自动重写、凭空多发一次请求。判别式收紧为「无句读的真标题」才剥。 */
    body = body.replace(/^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*第\s*[零一二三四五六七八九十百千0-9]{1,6}\s*[章回节卷][^\n：，。！？…]{0,40}?(?:\*\*)?\s*\n+/, '');
    return body;
  },
  /** 从 tail 开头逐行收集协议行，返回"仅协议行"文本（供变量解析器切割未闭合块，正文截断丢弃） */
  _splitProtocolRun(tail) {
    const lines = String(tail || "").split("\n");
    let i = 0, ate = 0, consumedAny = false;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) { i++; continue; }
      if (this._isVarProtocolLine(t, consumedAny)) { i++; ate++; consumedAny = true; continue; }
      break;
    }
    return ate > 0 ? lines.slice(0, i).join("\n") : "";
  },
  /* ==================== v3.47.5 泄漏键值行识别（正文漏数据修复） ====================
   *  病灶：AI 受各模块横幅/面板文案影响，把状态汇报写成自由格式中文键值行直接混进正文——
   *  「储物袋账簿: +召唤令 x1, +任意门 x1」「仙路长梯: 凡人 / 灵石: 0 / 寿元: 六十载」
   *  「法宝栏: {"护身":"空间法宝"}」「万能市集: 青牛镇凡俗行价」「世界阶段: 练气岁月(1/3)」
   *  旧剥离只认英文键/纯数字值/带点容器键，这些行全部漏网（玩家截图实锤）。
   *  四形态判定 + 已知模块键（运行时从 PlayerKit/GearCore/ImmersiveSuite 收集） */
  /** 已知模块键缓存（PlayerKit 面板/背包名 · GearCore 装备栏名 · ImmersiveSuite 境域标签） */
  _knownProtocolKeys() {
    if (this._kpKeys) return this._kpKeys;
    const set = new Set(["万能市集", "世界阶段", "法宝栏", "装备栏", "储物袋", "储物袋账簿", "行囊", "名牌", "状态面板", "属性面板", "资产", "六维", "仪表盘", "境界", "境界长梯", "仙路长梯", "修行境界", "伏笔", "未解之事", "大事记", "编年史", "状态卡", "主角状态卡", "佩剑栏", "随身物", "蛊窍", "法器栏"]);
    const grab = (obj, pick) => {
      try { Object.values(obj || {}).forEach(pick); } catch (e) { }
    };
    grab(window.PlayerKit && window.PlayerKit.config, (w) => {
      if (w && w.panel && typeof w.panel === "object" && w.panel.name) set.add(String(w.panel.name));
      if (w && w.bag && typeof w.bag === "object" && w.bag.name) set.add(String(w.bag.name));
    });
    grab(window.GearCore && window.GearCore.reg, (g) => { if (g && g.name) set.add(String(g.name)); });
    grab(window.ImmersiveSuite && window.ImmersiveSuite.themes, (t) => { if (t && t.realmLabel) set.add(String(t.realmLabel)); });
    this._kpKeys = set;
    return set;
  },
  /** 泄漏键值行·形态判定（键值已拆出后调用；不含句读守卫，供块内协议行判定复用）
   *  ① 增量清单值：键: +物品 x1, +物品 x2（逗号/顿号分段，段段以 +/- 开头）
   *  ② JSON 值：法宝栏: {"护身":"…","飞行":"无"}
   *  ③ 多键连写：整行按 / 切段 ≥2 段且段段都是「短键: 值」
   *  ④ 已知模块键：万能市集/世界阶段/储物袋账簿…（精准白名单，对白永不可能命中） */
  _leakedKVShape(key, val, line) {
    const v = String(val || "").trim();
    if (!v) return false;
    const segs = v.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    if (segs.length && segs.every((s) => /^[+-]\s*[\u4e00-\u9fa5A-Za-z【\[]/.test(s))) return true;
    const v2 = v.replace(/^["']+|["']+$/g, "");
    if (/^[{[][\s\S]*[}\]]$/.test(v2)) return true;
    const parts = String(line).split(/\s*[/／]\s*/).filter(Boolean);
    if (parts.length >= 2 && parts.every((p) => /^["“]?[\w\u4e00-\u9fa5.·]{1,24}["”]?\s*[:：]\s*\S/.test(p))) return true;
    if (key && this._knownProtocolKeys().has(String(key).trim())) return true;
    return false;
  },
  /** 行级判定（正文语境用——句读守卫 + ≤100 字符，防止误伤叙事与对白） */
  _isLeakedLine(s) {
    const t = String(s || "").trim();
    if (!t || t.length > 100 || /[。！？…]["'”」』]?$/.test(t)) return false;
    const cm = t.match(/^([^:：=]{1,24})\s*[：:=]\s*(.+)$/);
    if (!cm) return false;
    const key = cm[1].trim().replace(/^["'“”]+|["'“”]+$/g, "");
    return this._leakedKVShape(key, cm[2], t);
  },
  /** 判定一行是否"变量协议行"（而非叙事散文）
   *  allowAmbiguous：短中文键+短文本值（如「身份: 天才修士」）存在与对白（「许静：你好」）
   *  的歧义，仅当上一行已是确定协议行时才认可（首行出现一律按叙事处理） */
  _isVarProtocolLine(t, allowAmbiguous) {
    if (!t) return true;
    if (t.length > 150) return false;
    /* 选项与插图标记永远不是协议行 */
    if (this.OPT_HEADER_RE.test(t)) return false;
    if (/^(?:[A-Za-zＡ-Ｚ1-5１-５①②③④⑤])\s*[.、:：)）]\s*\S/.test(t)) return false;
    if (/^\((?:image|插图|生图)[:：]/i.test(t)) return false;
    if (/^[-+]/.test(t)) return true;
    if (/^>>/.test(t)) return true;
    if (/^```/.test(t)) return true;
    if (/^[#\/]/.test(t)) return true;
    if (/^[{\[（(【<]/.test(t)) return true;
    let cm = t.match(/^([^:：]{1,32})[:：](.*)$/);
    if (!cm) {
      /* v3.47.1：「键=值」变体（旧模板遗留格式）。键尾是 <>=! 的比较式（x >= 5）不算 */
      const em = t.match(/^([^:=]{1,32})=(.*)$/);
      if (em && !/[<>=!]$/.test(em[1].trim())) cm = em;
    }
    if (cm) {
      const key = cm[1].trim().replace(/^["'“”]+|["'“”]+$/g, "");
      const val = cm[2].trim().replace(/^["'“”]+|["'“”]+$/g, "");
      if (!key) return false;
      if (/^[a-zA-Z_][\w.\u4e00-\u9fa5]*$/i.test(key)) return true;
      if (key.includes(".")) return true;
      if (/^[+-]?\d+(\.\d+)?$/.test(val)) return true;
      if (val === "") return true;
      /* v3.47.5：自由格式状态行四形态（增量清单/JSON值/多键连写/已知模块键）——
         未闭合块吞噬与协议段切割从此认得这些行 */
      if (this._leakedKVShape(key, val, t)) return true;
      if (allowAmbiguous && val.length <= 24 && !/[。！？…；]["'”」』]?$/.test(val)) return true;
      return false;
    }
    return false;
  },
  /** v3.46.2 最后防线：常规剥离判空时，从原始回复打捞最长的连续叙事段
   *  打分规则：中文汉字密度；协议特征行（键值/±/>>/代码围栏/选项）不参与；
   *  连续叙事段合计 ≥60 个汉字才认定打捞成功（阈值内的小段视为噪声放弃） */
  _rescueProse(reply) {
    if (!reply) return "";
    let t = String(reply);
    if (window.stripAIThink) t = window.stripAIThink(t);
    t = t.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "\n");
    t = t.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "\n");
    t = t.replace(/【variable_update】[\s\S]*?【\/variable_update】/gi, "\n");
    t = t.replace(/<variable_update>[\s\S]*?<\/variable_update>/gi, "\n");
    t = t.replace(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】[\s\S]*$/i, "\n");
    const paras = t.split(/\n+/).map((p) => p.trim().replace(/^[>\s-]+/, "").replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "")).filter(Boolean);
    const cjkOf = (p) => (p.match(/[\u4e00-\u9fa5]/g) || []).length;
    const isNoise = (p) => {
      const s = p.trim();
      if (!s || s.length < 12) return true;
      if (/^\(?\/?variable_update\)?$/i.test(s)) return true;
      if (/^[-+>]/.test(s)) return true;
      if (/^[a-zA-Z_][\w.]*\s*[:：]/.test(s) && cjkOf(s) < s.length * 0.5) return true;
      if (/^[\[{]/.test(s)) return true;
      if (/^(?:[A-Za-zＡ-Ｚ1-5１-５①②③④⑤])\s*[.、:：)）]\s*\S/.test(s)) return true;
      /* v3.47.5：泄漏键值行不打捞——防止正文判空兜底把这些行从原文里捞回来 */
      if (this._isLeakedLine(s)) return true;
      return false;
    };
    let best = "", bestScore = 0;
    let i = 0;
    while (i < paras.length) {
      if (isNoise(paras[i]) || cjkOf(paras[i]) < 20) { i++; continue; }
      let j = i, acc = [], accScore = 0;
      while (j < paras.length && !isNoise(paras[j]) && cjkOf(paras[j]) >= 12) {
        acc.push(paras[j]);
        accScore += cjkOf(paras[j]);
        j++;
      }
      if (accScore > bestScore) { bestScore = accScore; best = acc.join("\n"); }
      i = j > i ? j : i + 1;
    }
    return bestScore >= 60 ? best.trim() : "";
  },
  /** 剥离模型自创的「迷你状态协议」行：(: 名.字段: 值; …) / (名.字段: 值, …)
   *  这条协议不是云境教的（提示词里无此格式），是模型参照 (variable_update) 自行推出来的
   *  变体；旧代码认不出，曾以「: 陈平安.location: 廷根市·旧城区, …)」的形态糊在正文里
   *  （诡秘/龙族实测命中）。这里做整段剥离，变量解析不受影响（它扫的是原 reply）。 */
  _stripMiniStatus(text) {
    let t = String(text == null ? "" : text);
    if (!t) return t;
    const KV = "[\\u4e00-\\u9fa5A-Za-z_][\\w\\u4e00-\\u9fa5]{0,15}\\.[\\w\\u4e00-\\u9fa5]{1,16}\\s*[:：]";
    /* ① 括号包裹（含左括号已被前序剥离吃掉、只剩 ": …)" 的残骸） */
    t = t.replace(new RegExp("\\(\\s*[:：]?[ \\t]*(?=[^)\\n]*" + KV + ")[^)\\n]*\\)", "g"), "");
    /* ② 没有右括号、只剩一行 ": 名.字段: 值" 的残骸 */
    t = t.replace(new RegExp("(?:^|\\n)[ \\t]*[:：][ \\t]*[^\\n]*" + KV + "[^\\n]*", "g"), "\n");
    return t;
  },
  /** 提取结尾选项 */
  extractOptions(reply) {
    if (!reply) return [];
    let tail = reply.match(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】([\s\S]*)$/i);
    let segment = tail ? tail[1] : "";
    if (!segment) {
      const tailZone = String(reply).slice(-600);
      const m = tailZone.match(/(?:^|\n)\s*[1１][.、:：]\s*(.+)/);
      if (m) segment = tailZone.slice(tailZone.indexOf(m[0]));
    }
    if (!segment) return [];
    const options = [];
    const lines = segment.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      /* v3.53.0 修复：旧正则 /^(?:[ABCDabcd1234…])\s*[.、:：)）]?\s*(.+)/ 的分隔符是可选的，
         于是「chapter: 1」「characters: 陈平安…」这类变量块键值行会被误当选项——
         首个字母被吃掉，按钮上直接显示「hapter: 1」（龙族实测命中）。现在：
         ① 分隔符必选（A. / 1、/ ① ...）② 无分隔号时只认「字母数字+空格」且限大写/数字圈码
         ③ 变量协议行一律跳过（模型把变量块写在选项区之后时会连坐）。 */
      let skip = false;
      try { skip = this._isVarProtocolLine(line, true); } catch (e) { skip = false; }
      if (skip) continue;
      let m = line.match(/^(?:[ABCDabcd]|[1-9１-９]|[①②③④⑤⑥⑦⑧⑨]|(?:选项|选)\s*[一二三四五六七八九1-9])\s*[.、,，:：)）]\s*(.+)/);
      if (!m) m = line.match(/^(?:[A-D]|[1-9]|[①②③④])\s+(?=\S)(.+)/);
      if (m) {
        let text = m[1].trim();
        if (text.length >= 2 && text.length <= 80) options.push(text);
      }
    }
    return options.slice(0, 6);
  },
  /** 侦测本轮选项区标题（扮演模式「行动选项」/ 创作模式「情节走向」），供按钮区显示 */
  detectOptionsLabel(reply) {
    const m = String(reply || "").match(this.OPT_HEADER_RE);
    return m ? m[1] : "情节走向";
  },
  /** 渲染一条小说正文卡片（optionsLabel：按钮区标题，扮演模式显示「行动选项」）
   *  v3.9.0 opts：{ live }——实时轮（handle 调用，默认 true）插图自动生成；
   *  回放轮（studio.html replayHistory 传 live:false）只查缓存，绝不自动烧钱 */
  renderStoryMessage(body, updateBlock, options, vars, optionsLabel, opts = {}) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const card = document.createElement("div");
    card.className = "message-card ai-card";
    const chapter = vars && vars.chapter != null && String(vars.chapter).trim() ? `第 ${this.escapeHtml(vars.chapter)} 章` : "正文";
    const IG = window.StoryImageGen;
    const bodyForCount = IG && IG.stripMarkers ? IG.stripMarkers(body) : body;
    const words = bodyForCount ? bodyForCount.replace(/\s/g, "").length : 0;
    /* v3.47.18 咩咩专用正则：把预设协议块（<status>/<wlog>/<memory_log>/<npc_log>…）
       从正文里抽出来渲染成折叠卡片 —— 否则它们会以裸 XML 落在正文里。
       v3.51.0：改为 always —— 即使玩家把「咩咩正则」总开关关掉，也只停用"去 AI 味"，
       协议块照旧收进卡片，绝不把 <status> 原样吐在正文里。 */
    let prose = body;
    let cardsHtml = "";
    if (window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.process) {
      const rg = window.MoMiaomiaoRegex.process(body, { always: true });
      prose = rg.prose;
      cardsHtml = rg.cardsHtml || "";
    }
    const words2 = prose ? prose.replace(/\s/g, "").length : 0;
    let html = `
            <div class="ai-card-header">
                <span class="chapter-badge">✒ ${chapter}</span>
                <span class="word-badge">${words2} 字</span>
                <span class="ai-label">主笔 AI</span>
            </div>
            <div class="story-body">${this.formatProse(prose)}</div>
            ${cardsHtml ? `<div class="mm-card-area">${cardsHtml}</div>` : ""}
        `;
    if (updateBlock) {
      const chips = this.translateChanges(updateBlock);
      if (chips.length) {
        html += `
                    <details class="var-details">
                        <summary>📊 本轮状态变更（${chips.length} 项）</summary>
                        <div class="chip-area">${chips.map(
          (c) => `<span class="chip ${c.cls || ""}">${c.icon || "·"} ${this.escapeHtml(c.text)}</span>`
        ).join("")}</div>
                        <details class="raw-details"><summary>查看原始指令（调试用）</summary>
                            <pre class="var-block">${this.escapeHtml(updateBlock)}</pre>
                        </details>
                    </details>
                `;
      }
    }
    if (options && options.length) {
      const label = optionsLabel || "情节走向";
      const dramatic = !!(window.ImmersionPlus && window.ImmersionPlus.isDramatic && window.ImmersionPlus.isDramatic(label));
      /* v3.55.6 云起专属美化：行动选项美化开着 → 序号徽章 + yq-opts 皮肤；
         关闭时回退朴素按钮（纯文本序号）。 */
      const yqOptOn = !!(window.MoMiaomiaoRegex && window.MoMiaomiaoRegex.ruleOn && window.MoMiaomiaoRegex.ruleOn("云起·行动选项美化"));
      html += `<div class="options-area${dramatic ? " dramatic" : ""}${yqOptOn ? " yq-opts" : ""}"><div class="options-title">▸ ${this.escapeHtml(label)}</div>`;
      options.forEach((opt, i) => {
        const delay = dramatic ? ` style="animation-delay:${(0.18 + i * 0.35).toFixed(2)}s"` : "";
        const key = ["①", "②", "③", "④", "⑤", "⑥"][i] || i + 1;
        const keyHtml = yqOptOn ? `<span class="opt-key">${key}</span>` : `${key}. `;
        html += `<button class="option-btn" onclick="window.StoryInput.chooseOption(this)" data-text="${this.escapeAttr(this.mdPlain(opt))}"${delay}>${keyHtml}${this.mdInline(opt)}</button>`;
      });
      html += `</div>`;
      if (dramatic && opts.live !== false) {
        try {
          window.ImmersionPlus && window.ImmersionPlus.sfx("drum");
        } catch (e) {
        }
      }
    }
    if (opts.hook && opts.live !== false) {
      const hookOn = !window.ImmersionPlus || !window.ImmersionPlus.cfg || window.ImmersionPlus.cfg().nextHook;
      if (hookOn) {
        html += `<div class="next-hook"><span class="nh-tag">下回</span><span class="nh-text">${this.escapeHtml(opts.hook)}</span></div>`;
      }
    }
    html += `
            <div class="turn-actions">
                <button class="turn-act-btn" onclick="window.StoryInput.regenerate()" title="删除本轮并用原指令重新生成（换一种写法）">↻ 重新生成</button>
                <button class="turn-act-btn warn" onclick="window.StoryInput.rollback()" title="删除本轮正文与登记，故事回到该轮开始前">↩ 回退本轮</button>
            </div>
        `;
    card.innerHTML = html;
    this.tagTurnCard(card, opts && opts.turnOverride);
    container.appendChild(card);
    if (window.StoryImageGen && window.StoryImageGen.processCard) {
      const fw = window.storyFramework;
      let turn = null;
      if (fw) {
        if (fw.replayTurnCursor != null) {
          const snap = (fw.storyState.turns || [])[fw.replayTurnCursor];
          turn = snap && typeof snap.index === "number" ? snap.index : null;
        } else if (opts && opts.turnOverride != null) {
          turn = opts.turnOverride;
        } else {
          turn = fw.currentTurnIndex();
        }
      }
      window.StoryImageGen.processCard(card, { live: opts.live !== false, turn });
    }
    /* v3.55.22 聊天虚拟化：虚拟器激活时，把新楼同步给它（状态同步 + DOM 上限裁剪），
       卡片已由本方法挂到 #chatMessages；窗口化重建（fromVirtualizer）时仅追加不重复登记 */
    if (window.ChatVirtualizer && ChatVirtualizer.active) {
      if (!(opts && opts.noScroll)) this.scrollToBottom();
      if (!opts || !opts.fromVirtualizer) {
        ChatVirtualizer.onAppendLive({
          role: "assistant", content: body, body, block: updateBlock,
          options, vars, label: optionsLabel, turn: (opts && opts.turnOverride)
        });
      }
    } else {
      this.scrollToBottom();
    }
  },
  /**
   * 给聊天流卡片打上当前轮次标签（data-turn）
   * 「↻ 重新生成 / ↩ 回退本轮」按标签整轮删除卡片：
   *   - 回放态：标签 = 回放游标（replayTurnCursor，由 studio.html 回放时设置）
   *   - 调用方显式传入 turnOverride：用捕获值（v1.6.9 T2-⑫——变量AI/灵感/动态世界
   *     等旁路系统异步完成时，用户可能已发出下一轮指令，实时读快照栈会标到新轮，
   *     回退时删错卡/删不掉。触发时刻捕获的轮号才是卡片真正的归属轮）
   *   - 实时游玩（默认）：标签 = 已压入快照的末轮序号
   *   - 未开局（无快照）不打标签，卡片常驻
   * 供 variable-ai / dynamic-world / inspiration 等附属卡片复用
   */
  tagTurnCard(card, turnOverride) {
    const fw = window.storyFramework;
    if (!card || !fw) return card;
    let cur = null;
    if (fw.replayTurnCursor != null) {
      cur = fw.replayTurnCursor;
    } else if (typeof turnOverride === "number") {
      cur = turnOverride;
    } else if (Array.isArray(fw.storyState.turns) && fw.storyState.turns.length) {
      const last = fw.storyState.turns[fw.storyState.turns.length - 1];
      cur = last && typeof last.index === "number" ? last.index : fw.storyState.turns.length - 1;
    }
    if (cur != null) card.setAttribute("data-turn", String(cur));
    return card;
  },
  /** v3.53.0 行内 Markdown：实测模型经常在正文与选项里写 **粗体** 与 `代码`，
      旧版直接 escapeHtml 后原样显示成星号，读者看到的是「**收拢心神**」。
      这里只认四种最保守的行内标记，且先转义再包标签，不会引入注入面。 */
  mdInline(s) {
    let t = this.escapeHtml(s);
    t = t.replace(/\*\*(?=\S)([\s\S]{1,120}?)\*\*/g, "<b>$1</b>");
    t = t.replace(/(^|[^*])\*(?=\S)([^*\n]{1,60}?)\*(?!\*)/g, "$1<i>$2</i>");
    t = t.replace(/~~(?=\S)([^~\n]{1,60}?)~~/g, "<del>$1</del>");
    t = t.replace(/`([^`\n]{1,80})`/g, "<code>$1</code>");
    return t;
  },
  /** 去掉行内标记，得到可回传 AI 的纯文本（选项按钮的 data-text 用） */
  mdPlain(s) {
    return String(s == null ? "" : s).replace(/\*\*|~~|`/g, "").replace(/(^|[^*])\*([^*\n]{1,60})\*(?!\*)/g, "$1$2");
  },
  /** 小说排版：段首缩进、空行分段
   *  v3.9.0：段落含 (image: 提示词) 标记时混排「文字段 + 插图占位卡」
   *  v3.51.0：受控富文本——模型不守「纯 XML」约定、直接吐 HTML 美化状态栏时，
   *           白名单结构原样渲染（不再被 escapeHtml 成裸标签），危险内容一律剥离。 */
  formatProse(text) {
    if (!text) return '<p class="story-p muted">（本章正文缺失：模型本轮没有输出可识别的正文叙事。可点击下方「↻ 重新生成」用原指令重写，或直接输入指令继续）</p>';
    const IG = window.StoryImageGen;
    const segs = this._segmentProse(text) || [{ type: "text", text: text }];
    const out = [];
    segs.forEach((s) => {
      if (s.type === "br") { out.push('<div class="story-gap"></div>'); return; }
      if (s.type === "el") {
        const safe = this._sanitizeRich(s.html);
        if (safe && safe.replace(/<[^>]+>/g, "").trim().length) {
          out.push(`<div class="story-rich">${safe}</div>`);
        }
        return;
      }
      /* v3.53.0 段落归一：模型常在每句后换行（中文模型尤其常见），旧版把整段连同 \n 塞进
         一个 <p>，配合 pre-line 就变成「一句一行」的诗歌版式。这里按空行分段、
         段内单换行直接抹掉（中文不需要空格接续），恢复正常小说段落流。 */
      const chunks = String(s.text || "").split(/\n{2,}/);
      chunks.forEach((chunk) => {
        const p = chunk.replace(/\n/g, "").trim();
        if (!p) return;
        if (/^第[一二三四五六七八九十百千0-9]+[章节卷幕回]|^[楔序终尾声]+[子章]?$|^【.+】$/.test(p) && p.length < 20) {
          out.push(`<h4 class="story-chapter-title">${this.mdInline(p)}</h4>`);
          return;
        }
        if (IG && IG.hasMarker && IG.hasMarker(p)) {
          out.push(IG.renderPara(p));
          return;
        }
        out.push(`<p class="story-p">${this.mdInline(p)}</p>`);
      });
    });
    return out.join("");
  },
  /* ---------------- v3.51.0 受控富文本 ---------------- */
  /** 允许直通的标签（块级结构用于判定"这是 HTML 美化块"，其余作内联） */
  RICH_TAGS: {
    DIV: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1,
    DETAILS: 1, SUMMARY: 1, SECTION: 1, ARTICLE: 1, ASIDE: 1, HEADER: 1, FOOTER: 1,
    UL: 1, OL: 1, LI: 1, DL: 1, DT: 1, DD: 1, P: 1, PRE: 1, CODE: 1, BLOCKQUOTE: 1,
    FIGURE: 1, FIGCAPTION: 1, HR: 1, BR: 1, CENTER: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, SMALL: 1, MARK: 1, SUB: 1, SUP: 1,
    SPAN: 1, FONT: 1, KBD: 1, LABEL: 1, ABBR: 1, CITE: 1, Q: 1, TIME: 1
  },
  RICH_BLOCK: {
    DIV: 1, TABLE: 1, DETAILS: 1, SECTION: 1, ARTICLE: 1, ASIDE: 1, HEADER: 1, FOOTER: 1,
    UL: 1, OL: 1, DL: 1, P: 1, PRE: 1, BLOCKQUOTE: 1, FIGURE: 1, CENTER: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HR: 1
  },
  /** 把正文切成 text/el/br 段：HTML 结构走富文本，纯文字走原有小说排版 */
  _segmentProse(text) {
    if (!/[<][a-zA-Z][^>]*>/.test(text)) return null;
    let doc;
    try {
      doc = new DOMParser().parseFromString('<div id="__yj_seg">' + text + "</div>", "text/html");
    } catch (e) { return null; }
    const root = doc && doc.getElementById("__yj_seg");
    if (!root) return null;
    const segs = [];
    let sawEl = false;
    const pushText = (t) => {
      /* 空行 = 分段；段内单换行留着，由 formatProse 统一抹平 */
      String(t || "").split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).forEach((x) => segs.push({ type: "text", text: x }));
    };
    const walk = (node) => {
      if (node.nodeType === 3) { pushText(node.nodeValue); return; }
      if (node.nodeType !== 1) return;
      const tag = String(node.tagName || "").toUpperCase();
      /* 脚本/样式/内嵌页一律整段丢弃，防止源码被当正文显示 */
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "EMBED" || tag === "NOSCRIPT") return;
      if (tag === "BR") { segs.push({ type: "br" }); return; }
      /* 判定"这是结构块"：带 class/style 或含子元素，或本身就是容器类标签。
         裸 <p>纯文字</p> 不算 —— 交给小说排版（首行缩进 / 两端对齐）。 */
      const CONTAINERS = { TABLE: 1, DIV: 1, DETAILS: 1, SECTION: 1, ARTICLE: 1, ASIDE: 1, HEADER: 1, FOOTER: 1, UL: 1, OL: 1, DL: 1, PRE: 1, HR: 1, FIGURE: 1, BLOCKQUOTE: 1, CENTER: 1 };
      const hasMarkup = node.children.length > 0 || node.hasAttribute("class") || node.hasAttribute("style");
      const isRich = !!this.RICH_TAGS[tag] && (hasMarkup || !!CONTAINERS[tag]);
      if (!isRich) {
        if (node.children.length === 0) { pushText(node.textContent); return; }
        Array.from(node.childNodes).forEach(walk);
        return;
      }
      sawEl = true;
      segs.push({ type: "el", html: node.outerHTML });
    };
    Array.from(root.childNodes).forEach(walk);
    if (!sawEl) return null;
    return segs;
  },
  /** 白名单净化：只留安全标签/属性，剥脚本、事件、javascript: 与 fixed 定位 */
  _sanitizeRich(html) {
    let doc;
    try {
      doc = new DOMParser().parseFromString('<div id="__yj_root">' + String(html || "") + "</div>", "text/html");
    } catch (e) { return ""; }
    const root = doc && doc.getElementById("__yj_root");
    if (!root) return "";
    const DROP_TAG = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1, FORM: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, BUTTON: 1, SVG: 1, MATH: 1 };
    const out = document.createElement("div");
    const copy = (src, dst) => {
      Array.from(src.childNodes).forEach((node) => {
        if (node.nodeType === 3) { dst.appendChild(document.createTextNode(node.nodeValue)); return; }
        if (node.nodeType !== 1) return;
        const tag = String(node.tagName || "").toUpperCase();
        if (DROP_TAG[tag]) return;
        if (!this.RICH_TAGS[tag]) { copy(node, dst); return; }   // 未知标签脱壳，保留文字
        const el = document.createElement(tag.toLowerCase());
        Array.from(node.attributes).forEach((a) => {
          const n = String(a.name || "").toLowerCase();
          let v = String(a.value == null ? "" : a.value);
          if (/^on/.test(n) || n === "srcdoc" || n === "srcset") return;
          if (n === "href" || n === "src" || n === "xlink:href") {
            if (/^\s*(javascript|vbscript|data)\s*:/i.test(v)) return;
            el.setAttribute(n, v); return;
          }
          if (n === "style") {
            v = v
              .replace(/expression\s*\(/gi, "")
              .replace(/url\s*\(\s*['"]?\s*(javascript|vbscript|data)\s*:/gi, "url(")
              .replace(/behavior\s*:/gi, "")
              .replace(/@import/gi, "");
            if (/position\s*:\s*(fixed|sticky)/i.test(v)) return;
            el.setAttribute("style", v); return;
          }
          if (n === "class" || n === "title" || n === "align" || n === "colspan" || n === "rowspan" || n === "width" || n === "height") {
            el.setAttribute(n, v); return;
          }
        });
        copy(node, el);
        dst.appendChild(el);
      });
    };
    copy(root, out);
    return out.innerHTML;
  },
  /**
   * 把变量指令块翻译成中文可读变更标签
   * 双格式兼容：JSON 对象（部分模型习惯）与逐行指令（标准协议）
   */
  translateChanges(block) {
    const parser = window.VariableInstructionParser;
    const jsonObj = parser ? parser.tryParseJson(block) : null;
    if (jsonObj && typeof jsonObj === "object" && !Array.isArray(jsonObj)) {
      return this.chipsFromJson(jsonObj);
    }
    return this.chipsFromLines(block);
  },
  /** JSON 格式 → 中文标签 */
  chipsFromJson(obj) {
    const cfg = window.storyFramework && window.storyFramework.config || {};
    const labelMap = {};
    (cfg.gauges || []).forEach((g) => {
      labelMap[g.key] = g.label;
    });
    (cfg.statKeys || []).forEach((s) => {
      labelMap[s.key] = s.label;
    });
    Object.assign(labelMap, {
      chapter: "章节",
      wordCount: "累计字数",
      totalChapters: "总章数",
      title: "书名",
      bookTitle: "书名"
    });
    const labelOf = (k) => labelMap[k] || k;
    const clip = (s, n) => {
      s = String(s != null ? s : "");
      return s.length > n ? s.slice(0, n) + "…" : s;
    };
    const chips = [];
    const push = (icon, text, cls) => chips.push({ icon, text, cls: cls || "info" });
    if (obj.title || obj.bookTitle) push("📕", `书名定为《${clip(obj.title || obj.bookTitle, 16)}》`);
    if (obj.chapter != null) push("📖", `推进到第 ${obj.chapter} 章`);
    if (obj.wordCount != null) push("✒", `累计 ${obj.wordCount} 字`);
    const dash = obj.dashboard || obj.gauges || obj.仪表盘;
    Object.entries(dash || {}).forEach(([k, v]) => {
      if (typeof v === "number") push("⚡", `${labelOf(k)} → ${v}`);
    });
    const stats = obj.stats || obj.dimensions || obj.六维;
    if (stats && typeof stats === "object") {
      Object.entries(stats).forEach(([k, v]) => {
        if (typeof v === "number") push("✦", `六维 · ${labelOf(k)} → ${v}`);
      });
    }
    const chars = obj.characters || obj.角色 || obj.characterCards;
    if (chars && typeof chars === "object") {
      Object.entries(chars).forEach(([name, f]) => {
        if (!f || typeof f !== "object") return;
        const nm = clip(String(name).replace(/["'“”]/g, ""), 8);
        const role = f.role || f.身份 || "";
        const st = f.status || f.状态 || "";
        const extra = role ? `（${clip(role, 10)}）` : st ? `（${clip(st, 8)}）` : "";
        push("👤", `角色档案 · ${nm}${extra} 已建档`);
      });
    }
    const plot = obj.plotPoints || obj.伏笔;
    if (plot && typeof plot === "object") {
      (plot.planted || plot.埋设 || []).forEach((p) => push("🧵", `埋下伏笔：${clip(typeof p === "string" ? p : (p == null ? void 0 : p.name) || "", 14)}`, "pos"));
      (plot.resolved || plot.回收 || []).forEach((p) => push("✅", `回收伏笔：${clip(typeof p === "string" ? p : (p == null ? void 0 : p.name) || "", 14)}`, "pos2"));
    }
    if (Array.isArray(obj.foreshadowings)) {
      obj.foreshadowings.forEach((p) => {
        const nm = typeof p === "string" ? p : (p == null ? void 0 : p.name) || "";
        const resolved = typeof p === "object" && /resolved|回收/.test(String((p == null ? void 0 : p.status) || ""));
        push(resolved ? "✅" : "🧵", `${resolved ? "回收" : "埋下"}伏笔：${clip(nm, 14)}`, resolved ? "pos2" : "pos");
      });
    }
    if (Array.isArray(obj.items)) {
      obj.items.forEach((it) => {
        const nm = typeof it === "string" ? it : (it == null ? void 0 : it.name) || "";
        const ct = typeof it === "object" && (it == null ? void 0 : it.count) ? ` ×${it.count}` : "";
        push("🎒", `获得道具：${clip(nm, 14)}${ct}`, "pos");
      });
    }
    if (Array.isArray(obj.history)) {
      obj.history.slice(-3).forEach((h) => push("📜", `大事记：${clip(h, 20)}`));
    }
    if (!chips.length) {
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v !== "object") push("▸", `${labelOf(k)} → ${clip(v, 16)}`);
      });
    }
    return chips.slice(0, 24);
  },
  /** 逐行指令格式 → 中文标签 */
  chipsFromLines(block) {
    const cfg = window.storyFramework && window.storyFramework.config || {};
    const labelMap = {};
    (cfg.gauges || []).forEach((g) => {
      labelMap[g.key] = g.label;
    });
    (cfg.statKeys || []).forEach((s) => {
      labelMap[s.key] = s.label;
    });
    Object.assign(labelMap, {
      chapter: "章节",
      wordCount: "累计字数",
      totalChapters: "总章数",
      title: "书名",
      tension: "叙事张力",
      sanity: "理智值",
      /* v3.55.14 变量块嵌套键全中文：此前面板直接吐 characters/name/state… 英文，
         玩家投诉"状态栏出现其他语言"。这里把容器与子字段一律映射成中文。 */
      characters: "角色",
      character: "角色",
      characterCards: "角色",
      name: "名字",
      role: "身份",
      age: "年龄",
      personality: "性格",
      motivation: "动机",
      secret: "秘密",
      appearance: "外貌",
      speechPattern: "语言习惯",
      trust: "信任度",
      arc: "弧光",
      firstAppearance: "首次出场",
      state: "状态",
      status: "状态",
      location: "位置",
      items: "道具",
      item: "道具",
      holder: "持有者",
      count: "数量",
      foreshadowings: "伏笔",
      foreshadowing: "伏笔",
      content: "内容",
      plotPoints: "伏笔",
      history: "轨迹",
      dashboard: "仪表盘",
      gauges: "仪表",
      stats: "六维",
      dimensions: "六维",
      time: "时间",
      mood: "情绪",
      money: "金钱",
      goal: "目标",
      realm: "境界",
      health: "健康",
      injury: "伤势",
      lust: "情欲",
      intimacy: "亲密"
    });
    const labelOf = (k) => labelMap[k] || k;
    const clip = (s, n) => {
      s = String(s || "");
      return s.length > n ? s.slice(0, n) + "…" : s;
    };
    const chips = [];
    const lines = String(block).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    let curContainer = "";
    for (const line of lines) {
      let m;
      if (m = line.match(/^>>\s*(.+?)\.history\s*[:：]\s*(.+)$/)) {
        chips.push({ icon: "🧭", text: `角色轨迹 · ${clip(m[1], 8)}：${clip(m[2], 18)}`, cls: "info" });
        continue;
      }
      if (m = line.match(/^>>\s*(大事记|history|编年史)\s*[:：]\s*(.+)$/i)) {
        chips.push({ icon: "📜", text: `大事记：${clip(m[2], 20)}`, cls: "info" });
        continue;
      }
      if ((m = line.match(/^([+-])\s*(.+?)(?:\s*x\s*(\d+))?$/)) && !line.match(/[:：]/)) {
        const name = m[2].replace(/[（）()]\s*(埋设|回收|获得|失去|埋下|揭晓)\s*[（）()]/g, "").replace(/^[伏线索谜坑道具]+[:：]/, "").trim();
        if (m[3]) {
          chips.push({ icon: m[1] === "+" ? "🎒" : "💨", text: `${m[1] === "+" ? "获得" : "失去"}道具：${clip(name, 14)} ×${m[3]}`, cls: m[1] === "+" ? "pos" : "neg" });
        } else {
          chips.push({ icon: m[1] === "+" ? "🧵" : "✅", text: `${m[1] === "+" ? "埋下伏笔" : "回收伏笔"}：${clip(name, 14)}`, cls: m[1] === "+" ? "pos" : "pos2" });
        }
        continue;
      }
      if (m = line.match(/^([^:：]+?)\.([^:：]+?)\s*[:：]\s*(.+)$/)) {
        const c1 = m[1].trim().replace(/^["'“”]+|["'“”]+$/g, "");
        const c2 = m[2].trim().replace(/^["'“”]+|["'“”]+$/g, "");
        const c3 = m[3].trim().replace(/^["'“”]+|["'“”,]+$/g, "");
        if (c1 === "stats" || c1 === "六维") {
          chips.push({ icon: "✦", text: `六维 · ${labelOf(c2)} ${c3}`, cls: "info" });
        } else if (c1 === "自定义" || c1 === "自定义追踪") {
          chips.push({ icon: "🧩", text: `自定义 · ${c2} → ${clip(c3, 16)}`, cls: "pos" });
        } else {
          const fieldLabel = { role: "身份", age: "年龄", personality: "性格", motivation: "动机", secret: "秘密", status: "状态", appearance: "外貌", speechPattern: "语言习惯", trust: "信任度", arc: "弧光", firstAppearance: "首次出场", history: "轨迹" };
          chips.push({ icon: "👤", text: `${clip(c1, 8)} · ${fieldLabel[c2] || c2} → ${clip(c3, 16)}`, cls: "info" });
        }
        continue;
      }
      /* v3.55.14 容器标题行（characters: / items: / foreshadowings: 冒号后无值）→ 中文小标题，杜绝英文裸奔 */
      if (m = line.match(/^([A-Za-z\u4e00-\u9fa5_]+)\s*[:：]\s*$/)) {
        curContainer = labelOf(m[1]);
        chips.push({ icon: "▸", text: `【${curContainer}】`, cls: "" });
        continue;
      }
      /* v3.55.14 列表子项（- name: 陆尘 / - content: … / - status: …）→ 去掉前缀并译成中文 */
      if (m = line.match(/^[-•*·]\s*([A-Za-z\u4e00-\u9fa5_]+)\s*[:：]\s*(.+)$/)) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["'“”]+|["'“”,]+$/g, "");
        if (v) {
          const isName = /^(name|名字)$/i.test(k);
          const prefix = curContainer || "角色";
          const text = isName ? `${prefix} · ${clip(v, 12)}` : `${labelOf(k)} → ${clip(v, 16)}`;
          chips.push({ icon: isName ? "·" : "✒", text, cls: "info" });
        }
        continue;
      }
      if (m = line.match(/^([^:：]+?)\s*[:：]\s*(.+)$/)) {
        const key = m[1].trim().replace(/^["'“”\[\{]+|["'“”\]\},]+$/g, "");
        const val = m[2].trim().replace(/^["'“”]+|["'“”,]+$/g, "");
        if (!key || /^[\[\{\}\],\s]*$/.test(val)) continue;
        if (/^[+-]\s*\d+(?:\.\d+)?$/.test(val)) {
          const up = val.trim().startsWith("+");
          chips.push({ icon: up ? "📈" : "📉", text: `${labelOf(key)} ${val}`, cls: up ? "pos" : "neg" });
        } else if (key === "title") {
          chips.push({ icon: "📕", text: `书名定为《${clip(val, 16)}》`, cls: "info" });
        } else {
          chips.push({ icon: "✒", text: `${labelOf(key)} → ${clip(val, 18)}`, cls: "info" });
        }
        continue;
      }
      chips.push({ icon: "▸", text: clip(line, 26), cls: "" });
    }
    return chips.slice(0, 24);
  },
  /* v3.53.0 轻提示：纠偏/补齐这类"过程状态"不再塞进正文流
     （旧版把「正在自动补全一轮…」渲染成正文卡片，读者会以为故事里冒出旁白）。
     现改为顶部悬浮状态条：不占正文、不进存档、不进历史，4 秒后自动淡出。 */
  notice(text, type = "info", ttl = 4200) {
    try {
      let host = document.getElementById("yjNoticeHost");
      if (!host) {
        host = document.createElement("div");
        host.id = "yjNoticeHost";
        host.className = "yj-notice-host";
        (document.getElementById("chatArea") || document.body).appendChild(host);
      }
      const el = document.createElement("div");
      el.className = "yj-notice " + type;
      el.innerHTML = `<span class="yj-notice-dot"></span><span class="yj-notice-txt">${this.escapeHtml(text)}</span>`;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add("in"));
      const kill = () => {
        el.classList.remove("in");
        setTimeout(() => { try { el.remove(); } catch (e) { } }, 320);
      };
      setTimeout(kill, ttl);
      el.addEventListener("click", kill);
      return el;
    } catch (e) {
      return null;
    }
  },
  /* v3.53.0 协议补丁合并：把"只补协议块"的第二次输出拼回原回复。
     只取 (variable_update) 块与【行动选项】段，正文一律丢弃——
     这样既不会出现两段正文，也不会因补块把已写好的章节重写一遍（旧版就是这么超时的）。 */
  mergeProtocolPatch(reply, patch) {
    let out = String(reply || "");
    const p = String(patch || "");
    if (!p.trim()) return out;
    if (!/[(【<]\/?variable_update/i.test(out)) {
      const vb = p.match(/(?:\(variable_update\)|【variable_update】|<variable_update>)[\s\S]*?(?:\(\/variable_update\)|【\/variable_update】|<\/variable_update>)/i);
      if (vb) out += "\n\n" + vb[0].trim();
    }
    if (this.extractOptions(out).length < 2) {
      const om = p.match(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】[\s\S]*$/i);
      if (om) out += "\n\n" + om[0].trim();
    }
    return out;
  },
  renderSystemMessage(text, type = "info", opts) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const chatArea = document.getElementById("chatArea");
    if (chatArea && chatArea.offsetParent === null && window.showToast) {
      window.showToast(text, type);
    }
    const card = document.createElement("div");
    card.className = `message-card system-card ${type}`;
    card.innerHTML = `<div class="system-inner">${this.escapeHtml(text)}</div>`;
    this.tagTurnCard(card, opts && opts.turnOverride);
    container.appendChild(card);
    if (!(opts && opts.noScroll)) this.scrollToBottom();
  },
  renderUserMessage(text, opts) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const card = document.createElement("div");
    card.className = "message-card user-card";
    card.innerHTML = `<div class="user-inner"><span class="user-tag">☞ 你的指令</span>${this.escapeHtml(text)}</div>`;
    this.tagTurnCard(card, opts && opts.turnOverride);
    container.appendChild(card);
    /* v3.55.22 聊天虚拟化：激活时把新楼同步给虚拟器（仅追加，不重复登记窗口化重建） */
    if (window.ChatVirtualizer && ChatVirtualizer.active) {
      if (!(opts && opts.noScroll)) this.scrollToBottom();
      if (!opts || !opts.fromVirtualizer) {
        ChatVirtualizer.onAppendLive({ role: "user", content: text, turn: (opts && opts.turnOverride) });
      }
    } else {
      this.scrollToBottom();
    }
  },
  scrollToBottom() {
    const container = document.getElementById("chatMessages");
    if (container) container.scrollTop = container.scrollHeight;
  },
  escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  escapeAttr(s) {
    return this.escapeHtml(s).replace(/"/g, "&quot;");
  }
};
window.StoryResponseHandler = StoryResponseHandler;
