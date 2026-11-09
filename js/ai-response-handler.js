const StoryResponseHandler = {
  /** 处理一次完整的 AI 回复 */
  handle(rawReply) {
    const fw = window.storyFramework;
    const parser = window.VariableInstructionParser;
    let reply = window.stripAIThink ? window.stripAIThink(rawReply) : rawReply;
    /* v3.47.18 云起专用正则：在解析变量/选项/正文之前先过一遍，
       让 <selection> 变成【行动选项】（这样云境既有的选项按钮能直接接管），
       并让"去 AI 味"清理的结果贯穿变量解析、选项提取与存档。 */
    reply = window.YunqiPresetRegex && window.YunqiPresetRegex.enabled()
      ? window.YunqiPresetRegex.preParse(reply)
      : reply;
    const oldCh = Number(fw.storyState.variables && fw.storyState.variables.chapter) || 0;
    const { newVariables, updateBlock } = parser.parse(reply, fw.storyState.variables, { storyRegistration: true });
    /* v3.47.8 章节保底推进：模型输出了变量块却没让 chapter 进位（写坏块/漏 chapter 字段），
       或开局首章完全没有块——核心循环（选项推进/存档恢复判定）依赖 chapter，永不因模型手误卡死。 */
    try {
      const wroteBlock = /[(【<]\/?variable_update/i.test(reply);
      const newCh = Number(newVariables.chapter) || 0;
      const bodyLen = reply.replace(/\s/g, "").length;
      if (fw.storyState.isStoryStarted && wroteBlock && bodyLen > 400 && newCh === oldCh) {
        /* v3.68.0 收敛：仅当模型写了变量块却漏了 chapter 时才保底推进——
           此前无块也强推 +1，模型有意"同章跨多轮"或玩家锁章时章节数系统性虚高 */
        newVariables.chapter = oldCh + 1;
        /* v3.68.0 类型契约修复：driftNotes 统一为 {text} 数组（builder 侧 drift.map 期望数组，
           此前写成字符串拼接导致 TypeError 被吞、场域注记整轮静默丢失） */
        fw.storyState.driftNotes = (Array.isArray(fw.storyState.driftNotes) ? fw.storyState.driftNotes : [])
          .concat([{ text: `[v3.47.8] 第${newVariables.chapter}回章节号由保底逻辑推进（模型未正确上报 chapter）。`, at: Date.now() }]);
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
    /* v3.93.0 活世界势力实体化兜底：变量整体替换后确保本界势力实体仍在
       （seedFactions 幂等，已播种直接返回），随后 onVars 才能把势力状态同步上图。
       覆盖未经 buildStoryMessages 的路径（如载入旧存档后直接开图）。 */
    try {
      if (window.WorldAlive && window.WorldAlive.seedFactions) window.WorldAlive.seedFactions();
    } catch (e) {}
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
    // v3.70.0 性能：无 options 的跨模块重复调用（草稿/质检/场景态复用同一回复）直接命中缓存
    if (!options) {
      if (!this._bodyCacheNoOpt) this._bodyCacheNoOpt = new Map();
      const _hit = this._bodyCacheNoOpt.get(reply);
      if (_hit !== undefined) return _hit;
    }
    let body = reply;
    /* v3.55.19 机缘归属账本：先把 (claimed) 块吸收进世界账本（幂等），再从正文剥离——
       这块是给世界看的登记簿，不是给读者看的正文 */
    if (window.CanonLedger) {
      try {
        CanonLedger.parse(reply);
      } catch (e) {}
    }
    /* v4.10.0 修 P1-8：剥离无条件执行。
       canon-ledger / canon-timeline 在 studio.html 是 yj-lazy 懒加载（首屏未完成或
       懒加载失败时 window.CanonLedger / CanonTimeline 不存在）。旧版把 replace 写在
       if 内部，对象缺位时 (claimed)/(world) 登记块会原样泄漏进玩家正文。
       parse 留在 if 内（对象不存在时不该调），正文剥离与账本是否就绪解耦。 */
    body = body.replace(/\(claimed\)[\s\S]*?\(\/claimed\)/gi, "").replace(/【claimed】[\s\S]*?【\/claimed】/gi, "").replace(/<claimed>[\s\S]*?<\/claimed>/gi, "");
    /* v3.55.23 大势演化账本：把 (world) 块吸收进大势账本（幂等），再从正文剥离——
       诱因终结、大事改道、羁绊易主、新生事件，都从这里落账 */
    if (window.CanonTimeline) {
      try {
        CanonTimeline.parse(reply);
      } catch (e) {}
    }
    body = body.replace(/\(world\)[\s\S]*?\(\/world\)/gi, "").replace(/【world】[\s\S]*?【\/world】/gi, "").replace(/<world>[\s\S]*?<\/world>/gi, "");
    /* v3.53.0：先摘掉迷你状态协议（(: 名.字段: 值; …)），再走常规剥离 */
    body = this._stripMiniStatus(body);
    /* v3.46.2 纵深防御：自带 think 剥离（常规调用方均已预剥，此处兜底，
       防止推理模型思考过程混入正文/导出/朗读） */
    body = body.replace(/<think(?:\s[^>]*)?>[\s\S]*?<\/think\s*>/gi, "").replace(/<think(?:\s[^>]*)?>[\s\S]*$/i, "").replace(/<\/think\s*>/gi, "");
    /* v4.08.0 修 D-35（思维链泄漏进正文 · 玩家直接可见）：
       实测（wangyou 深度旅程 quest2 步）模型输出了整块英文推理：
         (Thinking process: The user wants me to continue the story from the exact
          point of interruption. Current state: - Character: "I" (18-year-old male,
          inheritor/Lin Fan/Qingshuai Baiyu Tang identity … Wait, the engine log says
          -16 HP. Wait, the engine log provided in the system …)
       玩家看到的是模型的内心戏 + 推理里的错误数字（「HP 346/403」就是从这里来的：
       模型在推理里自己把 304+42 加成 346，随后把这个错数写进正文）。
       此前只剥 <think> 标签，而本模型用的是 (Thinking process: …) 这类括号格式，
       于是整块泄漏。提示词侧同步加了硬约束（ai-message-builder.js 格式契约 4.3）。
       剥离口径：括号包裹的思维链块整体删除，直到出现「正文恢复信号」为止——
       优先匹配闭合块；未闭合时按「思维链特征行」逐行剥离，避免吃掉后面真正文。 */
    body = this._stripThinkingChain(body);
    body = body.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【variable_update】[\s\S]*?【\/variable_update】/gi, "").replace(/<variable_update>[\s\S]*?<\/variable_update>/gi, "");
    /* 真实模型实测（第 3 轮截断续写）：模型会自创圆括号/方括号状态块 (status)…(/status)，
       预设正则只认成对的 <status>（那类由 YunqiPresetRegex 抽成折叠卡片，此处不动），
       圆括号块内的「tension 45 / 执念[…]」等内部字段便原样泄漏进玩家正文。 */
    body = body.replace(/\(status\)[\s\S]*?\(\/status\)/gi, "")
               .replace(/【status】[\s\S]*?【\/status】/gi, "");
    /* 输出被 maxTokens 截断时 <selection> 常缺闭合标签，其后的残选项行已不属于正文 */
    if (/<selection>/i.test(body) && !/<\/selection>/i.test(body)) {
      body = body.replace(/<selection>[\s\S]*$/i, "");
    }
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
    /* v4.08.0 修 D-38（整块装备/属性面板抄进正文 · 玩家直接可见）：
       实测（wangyou 深度旅程 loot 步）模型把一整块装备卡片原样吐进正文：
           【新手木剑】
           品级：白装
           槽位：胸甲
           攻击：+17
           金币奖励：+11（已自动入账）
           当前总金币：99
       现有 panelDepth 只认「【状态栏】」这类固定标题，不认装备名标题；
       _isLeakedLine 只单行剥「字段:值」，带括号注记的行漏网，整块 UI 仍留在正文。
       这里按「装备名标题 + 其后连续 ≥3 行装备字段」整段剥离，严格判定防误伤
       （正文里正常的「【苍狼】」强调后面跟的是叙事，不会命中）。 */
    body = this._stripEquipPanel(body);
    /* v4.07.2 修 D-29：面板段深度标记（见下方 filter 里的说明） */
    let panelDepth = 0;
    body = body.split("\n").filter((line) => {
      const t = line.trim();
      if (!t) return true;
      /* v4.07.2 修 D-29（面板残骸入正文）：模型偶尔只吐面板不吐叙事，实测返回形如
         「【状态栏】\ntension: 25\n\n【行动选项】1. …」——
         「【状态栏】」这种面板标题行会原样留在正文里，玩家看到的是一句没头没尾的「【状态栏】」。
         这里把面板段落（标题行 + 其下直到空行为止的条目）整段剥掉。
         提示词侧也加了同款硬约束（ai-message-builder.js），这里是防御层。 */
      if (/^【(?:状态栏|状态面板|面板|状态|属性|数值|信息栏|当前状态|角色面板|战斗面板|属性面板|角色状态|战斗信息|当前状态栏|人物面板)】\s*$/.test(t)) { panelDepth = 1; return false; }
      if (panelDepth) { if (!t) panelDepth = 0; return false; }
      if (/^(chapter|wordCount|totalChapters|tension|sanity|revelation|crisis|danger|logic)\s*[:：=]\s*[+-]?\d/.test(t)) return false;
      /* v4.08.0 修 D-32（系统提示块漏进正文 · 玩家直接可见）：
         实测（v4.08.0 wangyou 深度旅程「faction」步）模型把引擎 directive 里的
         系统消息**照抄**成正文行：
             【恭喜玩家「在水一方」建立势力「灰烬同盟」。】
             【驻地：松木林·巨剑台。】
             【行会等级：1/120。】
             【成员人数：1/999999。】
         这些是界面自己画的系统提示，不是小说内容。提示词侧已加硬约束
         （ai-message-builder.js 格式契约 4.1），这里是防御层。
         判定口径（宁漏勿误伤）：整行**完全**被一对「【…】」包住，
         且内容含系统特征词（恭喜/等级/驻地/成员/提示/获得/任务/经验/等级 等），
         才剥离。正文里正常的方括号用法（书名号式强调、括号补充说明）不受影响。 */
      if (this._isSystemNoticeLine(t)) return false;
      /* v4.09.0 J-7（语义判定层追加告警查出的玩家可见残骸 · chaoshenxueyuan/act）：
         正文末尾出现一整组协议 / 状态条残骸，前面没有任何叙事引导句：
             （）
             威胁逼近: 15/100
             world_update: faction.饕餮文明.influence=+2
         _isSystemNoticeLine 只认【】/「」外壳，第 162 行只认固定英文键，
         都漏了这些「裸键 : 值」。口径收紧到「整行、短、无句读」三种确定形态：
           ① 已知内部协议键（world_update 等）—— 产品协议，绝不进正文；
           ② 短字段 + 冒号 + 纯数值 / N-M 进度条 —— 状态条字段；
           ③ 孤立空括号残骸。
         叙事里「屏幕上显示：」「他说：」这类带句读的引导句不命中；
         系统流世界把系统面板写进叙述句（ditandali「【怨气值 5/100…】」）
         也不命中，刻意保留以免误伤合法叙事。 */
      if (/^(?:world_update|world_state|variable_update|status|state|directive|actLog|snapshot)\s*[：:=]\s*\S/i.test(t)) return false;
      if (/^[\u4e00-\u9fa5A-Za-z_]{1,10}\s*[：:]\s*[+-]?\d{1,6}\s*(?:[/／]\s*\d{1,6})?\s*%?\s*$/.test(t)) return false;
      if (/^[（(]\s*[)）]\s*$/.test(t)) return false;
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
    /* v4.07.2 修 D-36（正文被整段吞掉 · 玩家直接可见）：
       原规则用 `【…行动选项…】[\s\S]*$` 一刀切到字符串结尾。
       绝大多数模型把行动选项放在**结尾**，切到结尾正好。
       但实测（38 界广度旅程 scifi 界）存在另一种排版：
           【行动选项】1. … 2. … （选项段在前）
           (variable_update) … /variable_update
           我站在中转站大厅的阴影边缘…（真正的正文）
       此时一刀切把「选项段 + 变量块 + 正文」全部删掉 —— 玩家看到的是一张空卡片，
       正文一个字都不剩（原文见 yunjing-test/DEFECTS-v4.07.2.md D-36）。
       修法：只剥「标题行 + 其后的选项条目行」，遇到非选项行即停；
       若选项段之后没有正文（rest 很短），仍按原行为整段删除。 */
    body = body.replace(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】([\s\S]*)$/i, (m, tail) => {
      const lines = String(tail || "").split("\n");
      let i = 0, ate = 0;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) { i++; continue; }
        if (this._isOptionItemLine(t)) { i++; ate++; continue; }
        break;
      }
      const rest = lines.slice(i).join("\n").replace(/\s/g, "");
      /* 后面没有正文（纯选项段）→ 整段删除，保持旧行为 */
      if (rest.length < 15) return "";
      /* 后面还有正文 → 只删掉选项条目，正文原样保留 */
      return lines.slice(i).join("\n");
    });
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
    /* v4.08.0 修 D-36（协议开标签残骸 · 玩家直接可见）：
       实测（wangyou 深度旅程 loot 步）正文末尾粘了一个孤立的 `<status>` ——
       模型写到状态栏开头就被 maxTokens 截断，`<status>` 开标签留下了、闭合标签没有。
       现有 YunqiPresetRegex.process 只抽**成对闭合**的协议块，孤立开标签会以裸 XML 留在正文里。
       这里兜底剥掉「独立成行、且后面没有对应闭合标签」的协议开/闭标签，
       不碰成对块（成对块由 process 抽成折叠卡片），也不碰正文里行内出现的尖括号。 */
    body = body.replace(/(?:^|\n)([ \t]*)(<\/?)(status|wlog|memory_log|npc_log|thinking|think|variable_update|selection|world|claimed)([ \t]*>)(?=[ \t]*(?:\n|$))/gi,
      (m, lead, slash, tag, tail, off, whole) => {
        const isClose = slash === "</";
        /* 开标签：往后找闭合标签；闭标签：往前找开标签。找得到 → 成对块，保留 */
        const mate = isClose
          ? new RegExp("<\\s*" + tag + "\\s*>", "i").test(whole.slice(0, off))
          : new RegExp("<\\/\\s*" + tag + "\\s*>", "i").test(whole.slice(off + m.length));
        return mate ? m : lead;   // 孤立残骸 → 只保留行首缩进，标签本身删掉
      });
    /* v4.09.0 · 数值真值白名单清洗（根除小模型自编经济 / 面板数值）：
       提示词压制与 UI 块剥离挡不住零散句式变体（「木剑才卖 5 金币」
       「HP 346/470」「经验 +10000」「目前 1/1」）。这里用 TruthSnapshot 的
       合法数值 / 进度对集合做确定性兜底：面板字段片段一律剥离，货币数量
       与进度对按真值白名单改写；拿不到快照时只做面板剥离，不误伤数字。 */
    if (window.NumberScrubber && window.NumberScrubber.scrub) {
      try {
        var _nsSnap = window.TruthSnapshot && window.TruthSnapshot.snapshot
          ? window.TruthSnapshot.snapshot() : null;
        var _nsTurns = window.TruthSnapshot && window.TruthSnapshot.turns
          ? window.TruthSnapshot.turns() : null;
        body = window.NumberScrubber.scrub(body, _nsSnap, _nsTurns);
      } catch (e) { /* 清洗异常不阻断正文交付 */ }
    }
    const out = body.trim();
    /* v3.46.2 防线：常规剥离后正文为空/过短 → 从原文打捞叙事段兜底
       （覆盖：正文整体被写进代码围栏、残缺标记连锁误剥、只吐变量块等情形） */
    if (out.replace(/\s/g, "").length < 15) {
      const rescued = this._rescueProse(reply);
      if (rescued) return rescued;
      /* v4.09.0 修广度旅程实测缺陷（doupocangqiong act2）：模型只吐整块英文思维链、
         一个中文叙事字都没写。清洗层把思维链全剥掉后 out 为空，_rescueProse 也救不回
         （英文推理段 CJK 不足），玩家看到的是一张空白卡片，像「点了没反应」。
         只改 extractBody 的返回值，不动 handle() 的章节推进 / 存档流程。

         v4.09.0 第二次探针实测（J-6）：这个 <15 分支会同时命中「正常短正文」与
         「清洗后变短的正文」——「三日后，他回到松木林。」「他摸了摸钱袋，转身进了酒馆。」
         一律返回降级提示，等于把玩家正文吞掉（修 A 坏 B）。
         因此降级只用于「清洗后连中文叙事字都不剩」的情形；短正文照常交付。 */
      const cjk = (out.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (cjk < 4) {
        return "（这一轮没有生成正文：模型只返回了推理或协议内容，请重新发送指令重试。）";
      }
    }
    if (!options) {
      if (this._bodyCacheNoOpt.size > 4) this._bodyCacheNoOpt.clear();
      this._bodyCacheNoOpt.set(reply, out);
    }
    return out;
  },
  /* ==================== v3.46.2 未闭合变量块安全剥离 ====================
   * 旧行为：遇到任何形如 (variable_update / 【variable_update / <variable_update
   * 的标记（含残缺闭合）就把其后全部内容删光——标记出现在回复开头时等于清空全章正文。
   * 新行为：从标记处逐行吞噬"协议行"（键值 / ±条目 / >>轨迹 / JSON / 短标签），
   * 一旦遇到叙事散文立即停止；若标记后紧跟的就不是协议行（正文里提到该词等情形），
   * 只删除标记本身，其后正文原样保留。 */
  /* v4.07.2 新增（配合 D-36）：判断一行是否是「行动选项条目」。
     支持：1. / 1、/ 1) / ① / A. / 【快进】 等六种常见编号形态。 */
  _isOptionItemLine(t) {
    return /^(?:\d{1,2}[.、:：)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[A-Za-z][.、:：)）]|【[^】]{1,16}】)/.test(String(t || ""));
  },
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
        /* v4.07.2 修 D-37：变量块的**结束标记常常缺左括号**（模型写 `/variable_update` 而非 `(/variable_update)`），
           这时结束标记会粘在正文首行开头（实测 scifi 界：
           「/variable_update我站在中转站大厅的阴影边缘…」），
           原实现既认不出它、也剥不掉，残骸就留在正文第一行。
           这里显式识别它：剥掉标记本身，保留同一行后面的正文。 */
        const bareEnd = t.match(/^\/?\(?【?<?\/?variable_update[)】>]?[ \t]*(.*)$/i);
        if (bareEnd) {
          const rest = bareEnd[1] || "";
          if (rest) { lines[i] = rest; break; }
          i++; break;
        }
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
  /** v4.08.0 修 D-35：剥离思维链泄漏块。
   *  覆盖格式（同一模型的不同轮次会用不同写法）：
   *    (Thinking process: …)  (Thought: …)  (Reasoning: …)  【思考过程】…  （思考：…）
   *  剥离策略（宁漏勿误伤 —— 吃掉正文比漏掉思维链更糟）：
   *    ① 有闭合括号 → 整块删
   *    ② 无闭合 → 逐行删「思维链特征行」，遇到像正文的行即停
   *  思维链特征行的判据：含英文推理口吻（Wait/Let me/Current state/Character:/Action:）
   *    或含「思考」「推理」「分析一下」等词且该行以结构化列表/键值形态出现。 */
  _stripThinkingChain(body) {
    if (!body) return body;
    var t = String(body);
    /* v4.08.0 修正一处误删事故：
       初版用 /\(…Thinking process…\)/ 的非贪婪闭合匹配整块删。
       但真实泄漏样本里，模型是在一句中文之后才开括号（「…只要它 (Thinking process: …」），
       非贪婪匹配吃到**中途第一个右括号**（推理正文自带括号），
       于是只删了前半段，后面的状态清单行失去上下文标记、原样漏进正文。
       修法：闭合块只在「整块都在一行内」时才整块删；
       跨行的思维链一律交给逐行策略（已验证能正确恢复中文正文）。 */
    t = t.replace(/[（(]\s*(?:Thinking\s*process|Thought|Reasoning)\s*[：:][^（）()\n]{0,600}[）)]/gi, "");
    t = t.replace(/[【\[]\s*(?:思考过程|思维链|推理过程|Thinking\s*process|Thought|Reasoning)\s*[】\]][:：]?[^\n]{0,600}/gi, "");
    /* 逐行剥（跨行思维链的主路径） */
    var lines = t.split("\n");
    var out = [];
    var inChain = false;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var trimmed = ln.trim();
      if (!trimmed) {
        /* 空行：思维链内部的空行继续剥离；不在链里则保留 */
        if (inChain) continue;
        out.push(ln);
        continue;
      }
      /* 进入思维链的起点：行内出现思维链标记即进入 */
      if (!inChain && /(?:Thinking\s*process|Thought|Reasoning)\s*[：:]|^\s*[（(]\s*(?:思考过程|思维链|推理过程)/i.test(trimmed)) {
        inChain = true;
        /* 该行若在标记之后还有中文正文，保留标记之后的部分 */
        var mk = trimmed.match(/^[\s\S]*?(?:Thinking\s*process|Thought|Reasoning)\s*[：:]/i);
        if (mk) {
          var rest = trimmed.slice(mk[0].length);
          if (/[一-鿿]{6,}/.test(rest) && !this._isThinkingLine(rest)) {
            inChain = false;
            out.push(rest);
          }
        }
        continue;
      }
      if (inChain) {
        /* 思维链特征行 → 继续剥 */
        if (this._isThinkingLine(trimmed)) continue;
        /* 结构化列表行（- Character: … / - Location: …）→ 继续剥 */
        if (/^[-*•]\s*[A-Za-z][A-Za-z ]{1,24}\s*[:：]/.test(trimmed)) continue;
        if (/^[-*•]\s/.test(trimmed) && /[A-Za-z]{3,}/.test(trimmed)) continue;
        /* 出现中文叙事句 → 认为是正文恢复，退出剥离状态 */
        if (/[一-鿿]{6,}/.test(trimmed) && !/[:：]\s*\S{0,60}$/.test(trimmed)) {
          inChain = false;
          out.push(ln);
          continue;
        }
        /* 其他英文行 → 仍属思维链 */
        if (/[A-Za-z]{3,}/.test(trimmed) && !/[一-鿿]{4,}/.test(trimmed)) continue;
        inChain = false;
        out.push(ln);
        continue;
      }
      out.push(ln);
    }
    return out.join("\n");
  },
  /** 判定一行是否属于思维链（英文推理口吻 / 结构化键值 / 中英文混合的推理句） */
  _isThinkingLine(s) {
    var t = String(s || "").trim();
    if (!t) return false;
    /* 英文推理口吻 */
    if (/^(?:Wait|Let me|Okay|So|Now|First|Also|Hmm|I need to|The user|Current state|Based on|According to|Next|But|However)/i.test(t)) return true;
    if (/\b(?:Wait|Let me'?(?:s)? think|Current state|Character|Enemy|Action|Location|Level \d|HP|rethink|actually|hmm)\b/i.test(t)) return true;
    /* 结构化键值行（思维链里的状态清单） */
    if (/^(?:[-*•]\s*)?[A-Z][A-Za-z ]{1,20}\s*[:：]\s*\S/.test(t)) return true;
    /* 中文推理口吻 */
    if (/^(?:等等|让我|我来|思考|推理|分析一下|注意|首先|用户想要)/.test(t)) return true;
    if (/(?:等等|让我想想|我需要|根据提示|根据系统|根据引擎|等等[，,]?\s*)/.test(t) && /[A-Za-z]{3,}/.test(t)) return true;
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
  /** v4.08.0 修 D-32：判定一行是否是「系统提示行」（模型照抄 UI 系统消息）。
   *  判定口径（宁漏勿误伤 —— 误伤会吃掉真正文）：
   *   ① 整行**完全**被一对「【…】」包住（行内不得有其他正文）
   *   ② 内容含系统特征词（恭喜/提示/等级/驻地/成员/经验/任务/获得/解锁/系统/操作/奖励）
   *   ③ 内容呈「字段: 值」或含数字 + 百分号/等级这类**系统消息体征**
   * 三条同时满足才剥离。
   *  正文里常见的「【他低声说】」「【注：此段为回忆】」不含系统特征词 → 不受影响。 */
  /* v4.08.0 D-38：剥离「【装备名】标题 + 连续装备字段行」整块 UI 面板。
     判定口径（宁漏勿误伤）：
       ① 标题行形如【…】，2~16 字，且不含系统/状态/频道等面板标题词；
       ② 其后连续 ≥3 行都是「装备字段：值」形态；
       ③ 字段白名单固定（品级/槽位/攻击/防御/金币奖励/…），叙事句不会命中。 */
  _stripEquipPanel(body) {
    if (!body) return body;
    const TITLE = /^【([^】]{2,16})】\s*$/;
    const TITLE_BAD = /(系统|状态|面板|提示|公告|频道|行动选项|行动|选项|章节|任务|委托)/;
    const FIELD = /^(?:品级|品质|品阶|槽位|部位|装备位|攻击|防御|魔防|生命|魔力|暴击|暴击率|耐久|等级需求|需求等级|绑定|属性|加成|金币奖励|当前总金币|总金币|金币|经验奖励|声望奖励|掉落|重量|镶孔|特效|套装|耗蓝|耗怒)[：:]\s*\S/;
    const lines = String(body).split("\n");
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const m = t.match(TITLE);
      if (m && !TITLE_BAD.test(m[1])) {
        let j = i + 1, hits = 0;
        while (j < lines.length && hits < 12) {
          const s = lines[j].trim();
          if (!s) break;
          if (!FIELD.test(s)) break;
          hits++; j++;
        }
        if (hits >= 3) { i = j - 1; continue; }   // 整块丢弃
      }
      out.push(lines[i]);
    }
    return out.join("\n");
  },

  _isSystemNoticeLine(s) {
    const t = String(s || "").trim();
    if (!t || t.length > 120) return false;
    /* v4.08.0：模型换了外壳绕过只认【】的判定——实测（wangyou 深度旅程 turnin 步）出现
         「委托完成：悬赏·缉拿雷阵守卫」
         「奖励：金币 x100，声望 +5」
         **「已购买：松木林巨剑（绿色装备）」**
         **「金币剩余：28」**
       先把 markdown 加粗壳（**…**）剥掉，再按外壳类型分流判定。
       关键：引号「」是正文对白的主要载体，绝不能沿用方括号的宽松口径，
       否则「我终于获得了自由！」这类台词会被误剥。 */
    var core = t.replace(/^\*{1,3}\s*/, "").replace(/\s*\*{1,3}$/, "").trim();
    var isBracket = /^【[\s\S]+】$/.test(core);
    var m = isBracket
      ? core.match(/^【([\s\S]+)】$/)
      : (core.match(/^[「『]([\s\S]+)[」』]$/) || core.match(/^[“"]([\s\S]+)[”"]$/));
    if (!m) return false;
    const inner = String(m[1] || "").trim();
    if (!inner) return false;

    if (!isBracket) {
      /* ── 引号外壳：只认「UI 字段:值」形态，且不得以句读收尾 ──
         白名单字段全部来自界面结算行（奖励/已购买/金币剩余/委托完成/…），
         正常对白不会以这些词开头带冒号；且系统 UI 行不带句号，对白带。 */
      if (/[。！？…]$/.test(inner)) return false;
      return /^(?:奖励|已购买|购买成功|金币剩余|剩余|余额|结算|到账|委托完成|任务完成|已获得|获得物品|系统提示|系统消息|行会等级|成员人数|驻地|经验|声望|掉落|已装备|已使用|已学习|已解锁)[：:]\s*\S/.test(inner);
    }

    /* ── 方括号外壳：沿用 v4.08.0 原口径（宽松，因为正文几乎不用【】包对白）── */
    /* ① 系统特征词 */
    if (!/(恭喜|提示|等级|驻地|成员|经验|任务|获得|解锁|系统|操作|奖励|状态|属性|金币|声望|等级别)/.test(inner)) return false;
    /* ② 系统消息体征：
     *   a) 「字段: 值」形态（驻地：… / 行会等级：1/120）
     *   b) 数字 + 分隔数值 / 百分比 / Lv.N
     *   c) **事件型系统播报**——「恭喜…建立…」「…已解锁」「…获得…」这类
     *      带事件动词的整句系统消息。它没有 kv 形态，但同样是界面自己画的。 */
    var kv = /[：:]/.test(inner) && /^[^\s：:]{1,12}[：:]\s*\S/.test(inner);
    var numPair = /\d+\s*[/／]\s*\d+|\d+\s*[:：]\s*\d+|\d+\s*%|Lv\.?\s*\d+/.test(inner);
    var event = /(恭喜|已解锁|解锁成功|获得|领取|创建成功|建立成功|加入成功|晋升|任务完成|系统提示|系统消息|操作成功|结算)/.test(inner);
    if (!kv && !numPair && !event) return false;
    return true;
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
  /** 提取结尾选项（v3.94.0 鲁棒化）
   *  真实评测暴露：模型用「1. … 6.」数字编号、无标题、或「⑥【成人】」无分隔符写法时，
   *  旧逻辑只在末尾 600 字里找「1.」开头，长回复里第 1 条常被切掉 → 选项 0 个（斗破界实测）。
   *  现改为：① 优先 <selection> 块 → ② 传统标题段 → ③ 全文扫描连续编号行块（取最长一组）。 */
  extractOptions(reply) {
    if (!reply) return [];
    const src = String(reply);
    let segment = "";
    const sel = src.match(/<selection>\s*([\s\S]*?)\s*<\/selection>/i);
    if (sel) segment = sel[1];
    if (!segment) {
      const tail = src.match(/【(?:情节走向|后续走向|剧情选项|下一步|行动选项|行动方案|可选行动|行动列表|你的选择|关键抉择|生死抉择|命运岔口|抉择)】([\s\S]*)$/i);
      if (tail) segment = tail[1];
    }
    if (!segment) {
      /* 编号行：①-⑳ 可不带分隔符；数字/字母必须带分隔符（避免 chapter: 2 这类变量行被误认） */
      const NUM = /^(?:[①-⑳]\s*[.、,，:：)）]?|[1-9１-９]\s*[.、,，:：)）]|[A-Da-d]\s*[.、,，:：)）]|选项\s*[一二三四五六七八九1-9])\s*(?:【[^】]{1,10}】)?\s*\S/;
      const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
      let block = [], best = [];
      for (const l of lines) {
        if (NUM.test(l)) block.push(l);
        else { if (block.length > best.length) best = block; block = []; }
      }
      if (block.length > best.length) best = block;
      if (best.length >= 2) segment = best.join("\n");
    }
    if (!segment) return [];
    const options = [];
    const lines = segment.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^<\/?(?:selection|status|variable_update|wlog|memory_log|npc_log)/i.test(line)) continue;
      let m = line.match(/^(?:[①-⑳]|[1-9１-９]|[A-Da-d]|选项\s*[一二三四五六七八九1-9])\s*[.、,，:：)）]\s*(.+)$/);
      if (!m) m = line.match(/^[①-⑳]\s*(.+)$/);
      if (!m) m = line.match(/^(?:【[^】]{1,10}】)\s*(.+)$/);
      if (!m) continue;
      const text = m[1].trim();
      /* 变量块键值行兜底：编号匹配成功也可能撞上「1. 灵石: +5」这类行 */
      if (/^[^:：]{1,20}[:：]/.test(text) && !/【/.test(text)) continue;
      if (text.length >= 2 && text.length <= 80) options.push(text);
    }
    return options.slice(0, 6);
  },
  /** v3.94.0 本地补齐：模型一条选项都没给时，按六类补中性方向（不编造具体剧情）。
   *  用于替代「格式守卫」为此多发的那次完整 system 请求——零额外费用。 */
  padOptions(reply) {
    if (this.extractOptions(reply || "").length > 0) return reply;
    const NEUTRAL = [
      "继续把眼前这件事往前推一步",
      "与在场的人说句话，或回应对方",
      "做一件出人意料的小事",
      "停下来细看片刻，不急着行动",
      "换一处地方，或略过一段时日",
      "若愿与某人更近一步（可选，忽略亦可）"
    ];
    const CATS = ["快进", "交互", "整活", "慢推", "时空", "成人"];
    const KEY = ["①", "②", "③", "④", "⑤", "⑥"];
    const lines = CATS.map((c, i) => `${KEY[i]}【${c}】${NEUTRAL[i]}`);
    return String(reply || "").replace(/\s+$/, "") + "\n\n【行动选项】\n" + lines.join("\n") + "\n";
  },
  /** 渲染时把 1~5 条真实选项按缺失类别补齐到 6 条；不改变 extractOptions 的返回值，
   *  因此不影响续写判断、回放存档与正文剥离。 */
  padOptionList(options) {
    const opts = (options || []).slice(0, 6);
    if (opts.length >= 6) return opts;
    const CATS = ["快进", "交互", "整活", "慢推", "时空", "成人"];
    const NEUTRAL = [
      "【快进】继续把眼前这件事往前推一步",
      "【交互】与在场的人说句话，或回应对方",
      "【整活】做一件出人意料的小事",
      "【慢推】停下来细看片刻，不急着行动",
      "【时空】换一处地方，或略过一段时日",
      "【成人】若愿与某人更近一步（可选，忽略亦可）"
    ];
    const have = new Set();
    opts.forEach((o) => { const m = String(o).match(/【(快进|交互|整活|慢推|时空|成人)】/); if (m) have.add(m[1]); });
    const need = 6 - opts.length;
    const fill = CATS.map((c, i) => ({ c, t: NEUTRAL[i] }))
      .filter((x) => !have.has(x.c)).slice(0, Math.max(0, need)).map((x) => x.t);
    return opts.concat(fill);
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
    /* v3.47.18 云起专用正则：把预设协议块（<status>/<wlog>/<memory_log>/<npc_log>…）
       从正文里抽出来渲染成折叠卡片 —— 否则它们会以裸 XML 落在正文里。
       v3.51.0：改为 always —— 即使玩家把「云起正则」总开关关掉，也只停用"去 AI 味"，
       协议块照旧收进卡片，绝不把 <status> 原样吐在正文里。 */
    let prose = body;
    let cardsHtml = "";
    if (window.YunqiPresetRegex && window.YunqiPresetRegex.process) {
      const rg = window.YunqiPresetRegex.process(body, { always: true });
      prose = rg.prose;
      cardsHtml = rg.cardsHtml || "";
    }
    const words2 = prose ? prose.replace(/\s/g, "").length : 0;
    /* v4.07.2 修 D-29（空正文无提示）：模型偶尔只吐状态面板不吐叙事，
       清洗后正文为空——旧版渲染出来是一张空卡片，玩家完全不知道发生了什么。
       这里给一条可读提示 + 重试引导（沿用 v3.94.0「时间跳变提示」的既有范式：不动正文，只加轻提示）。 */
    const emptyNote = (!words2) ? `<div class="yj-emptynote" style="margin:9px 0 0;padding:8px 11px;border-left:3px solid #b8875a;background:rgba(184,135,90,.09);font-size:11.5px;color:#b3a795;border-radius:0 6px 6px 0">⚠ 本轮模型只回了状态面板，没有生成正文。点「↻ 重新生成」再试一次；若反复出现，可在 ⚙ 接口设置里换一个更擅长长文的模型。</div>` : "";
    /* v3.94.0 未授权时间跳变可见提示：玩家实测里模型擅自写「这一年，你早把杂役活儿熬熟了」，
       而玩家并没有要求跳时间。这里不改动正文，只在卡片里给一条轻提示 + 可操作建议。 */
    const timeJumpNote = (() => {
      try {
        const st = window.storyFramework && window.storyFramework.storyState;
        const hist = (st && st.conversationHistory) || [];
        const lastUser = [...hist].reverse().find((h) => h && h.role === "user" && h.content);
        const asked = lastUser ? /(跳转|跳到|数日后|多年后|一年后|快进|时间跳跃|个月后|日后|过了[一二三四五六七八九十\d]+[年月日])/.test(String(lastUser.content)) : false;
        if (asked) return "";
        const head = String(prose || "").slice(0, 180);
        if (!/(这一年|一年后|一年过去|数月后|数日后|半年后|数年后|时光荏苒|一晃|转眼(?:间)?(?:已|便|就)?|几个月后|多年以后)/.test(head)) return "";
        return `<div class="yj-timejump-note" style="margin:9px 0 0;padding:7px 10px;border-left:3px solid #c9a86a;background:rgba(201,168,106,.08);font-size:11.5px;color:#a8a290;border-radius:0 6px 6px 0">⏳ 本轮正文出现时间跳跃，可能未按你的动作自然推进；若想按原节奏展开，可点「↻ 重新生成」或在下一条指令里写明。</div>`;
      } catch (e) { return ""; }
    })();
    let html = `
            <div class="ai-card-header">
                <span class="chapter-badge">✒ ${chapter}</span>
                <span class="word-badge">${words2} 字</span>
                <span class="ai-label">主笔 AI</span>
            </div>
            <div class="story-body">${this.formatProse(prose)}</div>
            ${cardsHtml ? `<div class="mm-card-area">${cardsHtml}</div>` : ""}
            ${emptyNote}
            ${timeJumpNote}
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
    const shownOptions = this.padOptionList(options || []);
    if (shownOptions.length) {
      const label = optionsLabel || "情节走向";
      const dramatic = !!(window.ImmersionPlus && window.ImmersionPlus.isDramatic && window.ImmersionPlus.isDramatic(label));
      /* v3.55.6 云起专属美化：行动选项美化开着 → 序号徽章 + yq-opts 皮肤；
         关闭时回退朴素按钮（纯文本序号）。 */
      const yqOptOn = !!(window.YunqiPresetRegex && window.YunqiPresetRegex.ruleOn && window.YunqiPresetRegex.ruleOn("云起·行动选项美化"));
      html += `<div class="options-area${dramatic ? " dramatic" : ""}${yqOptOn ? " yq-opts" : ""}"><div class="options-title">▸ ${this.escapeHtml(label)}</div>`;
      shownOptions.forEach((opt, i) => {
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
