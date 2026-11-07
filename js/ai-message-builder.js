/* v3.92.0 省流：只在开篇有用的整段，过了开篇就不再随每轮发送。
   做法是按标题切段（段首到下一个「【…】」或「## 」前），切不到就原样返回——
   宁可少省，也不能把正文规则切掉半截。 */
function stripSection(text, head) {
  const i = text.indexOf(head);
  if (i < 0) return text;
  const rest = text.slice(i + head.length);
  const m = rest.match(/\n(?=【|#{1,3} )/);
  const end = m ? i + head.length + m.index : text.length;
  return (text.slice(0, i) + text.slice(end)).replace(/\n{3,}/g, "\n\n");
}
function stripOpeningTemplate(text) {
  if (!text) return text;
  const stripped = String(text).replace(
    /【(?:开篇剧情|入场)指令[^】]*】[\s\S]*?(?=【极其重要】每[次轮]回复必须包含)/,
    ""
  );
  return stripped.trim();
}
function buildEndgamePressure(vars, isRP) {
  const ch = Number(vars == null ? void 0 : vars.chapter) || 0;
  const total = Number(vars == null ? void 0 : vars.totalChapters) || 0;
  if (!ch || !total || ch < total - 1) return "";
  const planted = ((vars == null ? void 0 : vars.foreshadowings) || []).filter((f) => f.status === "planted").map((f) => f.name);
  const plantedNote = planted.length ? `
当前仍未回收：${planted.join("、")}——按本章剧情择机了结，严禁新增无关支线。` : "";
  if (ch === total - 1) {
    return `

【收束预警（倒数第二章）】本书共 ${total} 章，本章已是倒数第二章：线索开始汇聚，${isRP ? "世界事件" : "各条伏笔"}进入回收准备阶段，节奏收紧，为终章揭晓蓄力。${plantedNote}`;
  }
  return `

【终章铁律（最后一章）】本章是全书最后一章：必须完成真解答与余韵收束${isRP ? "，本场冒险正式落幕" : ""}；所有未回收伏笔在本章全部了结，禁止留置新悬念，禁止"未完待续"式结尾；正文末尾以【全文完】标记收束。${plantedNote}`;
}
const StoryFreedom = {
  KEY: "storyFreedom",
  isFree() {
    /* v3.68.0 双轨修复：立场三态是唯一权威——original=自由，hero/side=原著轨道。
       此前旧开关缺省判"自由"，与 hero 态"大势锁死"铁律同时注入，两套矛盾约束并存；
       三态从未选过时跟随旧开关（老档兼容），选过则一律以三态为准。 */
    try {
      var stance = window.StoryStance && StoryStance.get ? StoryStance.get() : null;
      if (stance && window.StoryStance._hasExplicit && StoryStance._hasExplicit()) return stance === "original";
      return localStorage.getItem(this.KEY) !== "canon";
    } catch (e) {
      return true;
    }
  },
  toggle() {
    try {
      localStorage.setItem(this.KEY, this.isFree() ? "canon" : "free");
    } catch (e) {
    }
    return this.isFree();
  }
};
window.StoryFreedom = StoryFreedom;
function buildFreedomDirective(isRP) {
  if (!isRP || !StoryFreedom.isFree()) return "";
  return `

【剧情主导权·玩家至上（最高优先级，效力高于工坊提示词中与之冲突的一切条款——包括"原著大势不可改""按原作时间线推进""危机权重""每轮须有起伏"等）】
1. 玩家主导，世界回应：剧情只由玩家的所思所言所行驱动。每轮正文的主体是「玩家上一轮行动的后果 + 世界的真实回应」；你不是编剧，是世界本身——严禁主动塞入玩家没有招惹的新事件、新危机、新冲突、新钩子、"恰好发生"的巧合或戏剧性转折。
2. 不催不赶：不替玩家安排故事、不暗示"该做点什么"、不制造紧迫感；玩家想平淡度日，就认真把平淡日子写出质感。【行动选项】以中性口吻列当下处境可选的动作，不夹带推进剧情的诱导；但须按系统《行动选项协议》保留固定的六类（快进/交互/整活/慢推/时空/成人）各一条——六类只是供玩家自由挑选的方向，本身不构成催促；其中"时空""成人"两类即便当前情境暂不涉及，也必须以"可选的"中性措辞保留（如"若想跳过这段时日……""若愿与她更近一步……"），玩家完全可以全部忽略、自行输入任意行动。
3. 波澜有源：一切波澜只能来自——玩家此前行动埋下的后果、已登记伏笔的自然兑现、NPC 独立意志与玩家的碰撞；凭空天降的事件一律违规，连续两轮"突然/偏偏/恰好"即视为失控。
4. 原著是背景板不是铁轨（原著改编世界适用）：原著设定（体系/势力/人物性格/世界观）照旧为底，但原著剧情不是宿命——玩家的介入可以推迟、改变甚至阻止原著大事件；原著人物按其性格对玩家的行动做出合理反应，可被说服、影响、结交甚至反目，而不是按原著剧本走位。玩家不在场之处，世界才按原著惯性运转。
5. 不为收束赶进度：不凑章数、不强行收尾——故事在玩家走到的每一个当下自然展开，结局是活出来的，不是排出来的。`;
}
/* v3.94.0 玩家主导硬约束（真实评测的问题 1/2）：
   原 buildFreedomDirective 只在 roleplay + free 模式生效，创作模式的 33 界绝大多数没有
   「不可否决玩家 / 不可擅自快进」条款。实测凡人界「另立云岚盟」被门规否决并替玩家改了
   行动方向、斗破界借管家之口说「无异于找死」，还擅自写「这一年，你早把杂役活儿熬熟了」。
   这里独立注入、所有模式一律生效；已有 freedomRule 时跳过，避免重复堆叠 token。 */
function buildAgencyGuard() {
  return `
【玩家主导·不可越权（最高优先级，与任何预设或原著设定冲突时一律以本节为准）】
1. 玩家上一轮明确写下的动作、决定与立场，一律视为已经发生，并据此展开后果。严禁以门规、长辈训诫、NPC 劝阻、风险或"为你好"为由否决、搁置或替玩家改写行动方向，更不得替玩家宣布放弃；NPC 可以反对、惊讶、劝说，但不能让这件事「没做成」。
2. 未经玩家明确写出时间跳跃的请求，不得擅自快进（"这一年…""转眼数月""一年后"），不得自行更换场景、身份或关系状态；时间只按本轮动作自然流逝。
3. 不复述玩家输入，不替玩家写心理活动与台词；只写玩家行动之后世界的回应与后果。`;
}
async function buildStoryMessages(userMessage) {
  var _a;
  /* v3.55.4 云起预设数据懒加载：装配前确保 297KB 数据已就位（正常已在空闲期预热） */
  if (window.YJEnsureMiaoPreset) { try { await window.YJEnsureMiaoPreset(); } catch (e) { } }
  const fw = window.storyFramework;
  const config = fw.config;
  const state = fw.storyState;
  const messages = [];
  const segs = [];
  const push = (msg, label, prio = 100) => {
    segs.push({ idx: messages.length, label, prio });
    messages.push(msg);
  };
  const vaOn = !!(window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()));
  /* v3.55.10 基础小模型适配：轻量协议块替代全量云起预设，知识库背景与
     生图/沉浸指令暂停加载（强模型用户不受影响） */
  const bmmOn = !!(window.BaseModelMode && window.BaseModelMode.isLite());
  const rawSystem0 = typeof config.systemPrompt === "function" ? config.systemPrompt() : config.fullSystemPrompt || "";
  /* v3.99.0 低配档压缩世界提示词：原文 7~8.7k 字，小模型读不完设定、正文必崩。
     压到 ~2.8k 字（保段标题 + 首句 + 铁律句），信息骨架不丢，注意力留给写作本身。 */
  /* v4.00.0 按上下文再分档：8K 模型装不下 2800 字系统提示 + 知识库 + 专名段，
     实测 7489 字符 ≈ 6200 token，加输出直接超 8192。tiny 档压到 1500。 */
  const _ct = (window.BaseModelMode && window.BaseModelMode.ctxTier) ? window.BaseModelMode.ctxTier() : "normal";
  const _sysCap = _ct === "tiny" ? 950 : _ct === "small" ? 2400 : 2800;
  const rawSystem = (bmmOn && window.BaseModelMode.compactSystemPrompt)
    ? window.BaseModelMode.compactSystemPrompt(rawSystem0, _sysCap)
    : rawSystem0;
  const rawRule = config.defaultSystemPrompt || "";
  const chapterNow = Number((_a = state.variables) == null ? void 0 : _a.chapter) || 0;
  const rawRuleTrimmed = chapterNow > 1 ? stripOpeningTemplate(rawRule) : rawRule;
  const systemPrompt = vaOn ? window.VariableAI.sanitizePrompt(rawSystem) : rawSystem;
  const rulePrompt = vaOn ? window.VariableAI.sanitizePrompt(rawRuleTrimmed) : rawRuleTrimmed;
  const inspirationNote = state.inspirations && state.inspirations.length ? `

【已采纳的灵感支线（写作时应自然融入，勿生硬）】
${state.inspirations.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "";
  const varAIRule = vaOn ? `

【变量登记说明】状态登记（章节/字数/仪表盘/角色档案/伏笔/道具/大事记）由独立系统自动完成，你只负责写好正文与情节选项。严禁输出任何变量更新块、状态指令或键值清单，严禁在正文或结尾罗列任何状态、数值、面板内容——只写小说。` : `

【变量块格式（系统解析依赖）】
(variable_update) 与 (/variable_update) 之间逐行写"键: 值"，一行一条，禁止 JSON、禁止花括号。
【每轮必做】本轮正文里新登场或有变化的人物必须登记档案（新登场者至少报 角色名.role / .appearance / .personality / .motivation / .status 五项，有变化者报变化字段）；在场人物位置/状态/信任度变动须更新；如 >>角色名.history: 一句话轨迹。
正确示例：
(variable_update)
chapter: 2
wordCount: +1200
tension: +10
stats.张力: +5
+消失的怀表（埋设）
-生锈的钥匙 x1
许静.role: 邻居
许静.appearance: 三十来岁，眼下有淡淡乌青
许静.personality: 谨慎，话少，观察力强
许静.motivation: 弄清旧公寓夜里异响的来源
许静.location: 楼道
许静.trust: 40
>>许静.history: 与主角在楼道初次相遇
>>大事记: 许静搬进了旧公寓
(/variable_update)
错误示例（一律禁止）：{"chapter": 2, "wordCount": 1200}`;
  // v3.47.16 闭合自检：独立注入，变量AI 分流与否都必须生效
  // （结构闭合式防空回：让模型自己先确认协议块完整，比事后猜测"结尾有没有标点"更早更准）
  const closureCheck = vaOn
    ? `

【闭合自检（每轮输出完最后一件必做的事）】写完后回头检查三件事，任缺一项即为本轮失败：①正文是否写到一个自然的落点（不要停在半句话、半句引号或省略号悬空处）；②【行动选项】是否已输出且恰好 6 条（严格对应 快进/交互/整活/慢推/时空/成人 六类各一条，顺序固定，缺任一类即视为本轮失败）；③标点纪律：以句号断句，分号只用于并列从句且全章不超过句号的三分之一，禁止用「；」「——」把整段串成一句。若发现任何一项不合格或被长度上限截断，请立刻接着补完，不要重写已写正文、不要重新开头。`
    : `

【闭合自检（每轮输出完最后一件必做的事）】写完后回头检查四件事，任缺一项即为本轮失败：①正文是否写到一个自然的落点（不要停在半句话、半句引号或省略号悬空处）；②(variable_update) 与 (/variable_update) 是否成对闭合；③【行动选项】是否已输出且恰好 6 条（严格对应 快进/交互/整活/慢推/时空/成人 六类各一条，顺序固定，缺任一类即视为本轮失败）；④标点纪律：以句号断句，分号只用于并列从句且全章不超过句号的三分之一，禁止用「；」「——」把整段串成一句。若发现任何一项不合格或被长度上限截断，请立刻接着补完，不要重写已写正文、不要重新开头。`;
  const isRPMode = config.mode === "roleplay";
  const endgame = isRPMode && StoryFreedom.isFree() ? "" : buildEndgamePressure(state.variables, isRPMode);
  const freedomRule = buildFreedomDirective(isRPMode);
  const agencyGuard = freedomRule ? "" : buildAgencyGuard();
  /* v4.00.0 低配档不再直接砍掉生图与沉浸：那等于「小模型玩家没有配图功能」。
     生图指令原文 1040 字（含画风/语言/构图细则），小模型读完记不住还挤占额度；
     这里换成 70 字的精简协议，功能照用、标记格式不变。沉浸协议只 534 字且含
     tension 上报，原样保留。 */
  let imageRule = "";
  if (window.StoryImageGen && window.StoryImageGen.buildDirective) {
    const fullImg = window.StoryImageGen.buildDirective() || "";
    imageRule = fullImg
      ? (bmmOn
        ? "\n【配图协议·精简】在值得配图处单独占一行写 (image: 中文一句话画面描述，写清主体、场景、光影与画风)，每章最多 2 张，宁缺毋滥，严禁写在选项区。\n"
        : fullImg)
      : "";
  }
  let immerseRule = "";
  if (window.ImmersionPlus && window.ImmersionPlus.buildDirective) {
    const fullImm = window.ImmersionPlus.buildDirective() || "";
    immerseRule = fullImm
      ? (bmmOn ? "\n【演出协议·精简】正文后单独一行写 tension: 0-100（本轮紧张度，日常≤20，冲突60-80，生死90+）。\n" : fullImm)
      : "";
  }
  // v3.47.14 创作性质声明 + 内容尺度（由 content-scale.js 提供分级指令与硬底线）
  const fictionPreamble = `【创作性质声明】本次对话是合法的架空小说/互动文学创作平台内的虚构写作：所有世界观、人物与情节均为虚构，创作目的是文学表达。请以专业小说家的笔法处理题材内在的冲突、残酷、恐怖与悲剧——它们是叙事的养分，应忠实于世界设定地写出，而非回避或稀释；同时保持叙事张力服务于故事本身。`;
  const scaleDirective = window.MoContentScale && window.MoContentScale.buildDirective
    ? window.MoContentScale.buildDirective()
    : '';
  // v3.53.0 状态栏上报契约：只含用户开启的字段组（关掉的组不占 token）
  let statusRule = '';
  try {
    if (window.StatusSchema && window.StatusSchema.buildReportDirective) statusRule = window.StatusSchema.buildReportDirective() || '';
  } catch (e) { statusRule = ''; }
  /* v3.53.0 默认篇幅护栏：知识库里没有玩家自设的「字数调节」条目时兜一句。
     实测（agnes-3.0-flash）无约束时单轮可写到 1.3 万字——出稿慢、易截断、选项被挤掉。 */
  let lengthRule = '';
  try {
    const SK = window.StoryKnowledge;
    const wlen = SK && SK._wlenCurrent ? SK._wlenCurrent() : null;
    const range = (wlen && wlen.range) || '700~1100';
    /* 无论有没有玩家自设档位，都在贴近生成位置处再压一句硬约束——
       知识库条目在上下文里离得远，实测模型会忽略它写到上万字 */
    lengthRule = '\n【篇幅硬约束】本轮正文严格落在 ' + range + ' 字之间（变量块与行动选项不计）。写到位靠分层推进：场景、动作、对白、心理、感官细节各给一点，严禁复读原文、同义堆砌、注水凑字；一次只需要写出本轮该有的那一段，把后面的留给下一轮。明显超出上限即视为不合格。\n';
  } catch (e) { lengthRule = ''; }
  // v3.47.17 内嵌云起预设：整份预设渲染（含该世界的适配文风）作为第二段 system
  // 说明：不改预设任何 prompt 文本，只在渲染时按 genreKey 选中文风档、关掉出厂默认的日轻档
  let yunqiBlock = '';
  try {
    if (bmmOn && window.BaseModelMode && window.BaseModelMode.buildLitePreset) {
      /* v3.55.10 基础小模型适配：小模型注意力有限，全量预设（数万字协议）
         换成 ~1.4k 字的云心精简核心（实测协议遵从率反而更高） */
      yunqiBlock = window.BaseModelMode.buildLitePreset((state.setup && state.setup.playerName) || '主角');
    } else if (window.YunqiPresetBridge && window.YunqiPresetBridge.render) {
      yunqiBlock = window.YunqiPresetBridge.render({
        char: (state.setup && state.setup.playerName) || '主角',
        user: '你'
      }) || '';
    }
  } catch (e) {
    console.warn('[云起预设] 渲染失败，已跳过:', e);
    yunqiBlock = '';
  }
  /* v3.55.17 云境核心契约 · 预设解耦注入
     问题：玩家用「导入 SillyTavern 预设」整份替换内置预设后，那份预设里没有云境的
     六类行动选项 / 状态栏 / 变量块定义；而闭合自检只说"恰好 6 条·六类"却不说是哪
     六类 → 模型只能自由发挥（实测：选项退回 3-4 条、状态栏英文 key 复现、变量块缺失）。
     对策：本契约独立注入、不依赖任何预设文本。仅当当前渲染出的预设不含六类定义时
     才补（云起预设 / 小模型精简核心 / 内置云起预设均自带上文，不会重复注入）。 */
  let coreContract = '';
  try {
    const hasCoreOpts = /【快进】/.test(yunqiBlock) && /【成人】/.test(yunqiBlock);
    if (!hasCoreOpts) {
      coreContract = `
【云境核心契约（优先级高于上方一切预设；与之冲突时，一律以本节为准）】
1｜行动选项——正文写完后单独输出一个 <selection> 块，恰好 6 条，逐行以 ①②③④⑤⑥ 开头，顺序固定：
①【快进】把剧情向前推进一步的关键动作
②【交互】与在场某人说话、试探或回应
③【整活】出人意料、略带喜感或跳脱的举动
④【慢推】停下来细看、细想，或慢慢做完一件小事
⑤【时空】跳过一段时日，或动身去另一个地方
⑥【成人】若愿与某人更近一步（中性可选措辞，玩家完全可以忽略）
六条缺任一类即视为本轮失败；只输出一个 <selection> 块，禁止分两批、禁止另起第二套编号、禁止用 A/B/C 或 1/2/3 编号。
2｜状态栏——正文与选项之间输出 (status)…(/status)，每行「中文标签：值」，至少包含 时间 / 地点 / 在场 / 心境 / 目标；字段名一律中文，严禁 time/location/health/mood 一类英文 key。
3｜变量块——正文之后输出 (variable_update)…(/variable_update)，首尾成对闭合，每行 key=value；固定字段必须用英文键：chapter（章号，整数）与 wordCount（本轮新增字数，报 "+N" 增量形式），其余状态键用中文（位置/灵石/机缘…）。`;
    }
  } catch (e) { coreContract = ''; }
  const system = `${systemPrompt}
${yunqiBlock ? '\n' + yunqiBlock + '\n' : ''}${coreContract}
${fictionPreamble}
${scaleDirective ? '\n' + scaleDirective + '\n' : ''}
${rulePrompt}${inspirationNote}${freedomRule}${agencyGuard}${varAIRule}${closureCheck}${lengthRule}${imageRule}${immerseRule}${statusRule ? '\n' + statusRule + '\n' : ''}${endgame}`;
  /* v3.92.0 省流：入场指令只在开篇有效，档案示范只在前几轮有用；
     之后每轮仍带着它们，只是给账单加长。按回合数裁掉，规则一条不少。 */
  const turnNo = Number((state && (state.turnCount ?? (state.variables && state.variables.chapter))) || 0);
  let sysOut = system;
  if (turnNo >= 1) sysOut = stripSection(sysOut, "【入场指令");
  if (turnNo >= 5) sysOut = stripSection(sysOut, "【档案示例");
  /* v4.00.0 低配档二次压缩：sysOut 把世界设定 + 创作声明 + 变量契约 + 篇幅/生图/沉浸/
     状态栏协议全拼在一条里，实测 4348 字符——占满 8K 窗口一半。compactSystemPrompt
     按【】分段保标题+首句+铁律句，压到 2400/3400，语义骨架不丢。 */
  if (bmmOn && window.BaseModelMode.compactSystemPrompt && sysOut.length > 200) {
    const _cap = _ct === "tiny" ? 2400 : _ct === "small" ? 3400 : 3600;
    if (sysOut.length > _cap) sysOut = window.BaseModelMode.compactSystemPrompt(sysOut, _cap);
  }
  push({ role: "system", content: sysOut }, "系统提示词", 100);
  /* v3.93.0 接线修复（真实玩家实测发现）：活世界 / 灵宠 / 小队 / 战斗协同这四组上行注入
     原先只写在 buildPlayerIdentityCard 里，而该函数仅在 config.mode === "roleplay" 时调用。
     创作模式的世界（33 界中的绝大多数）因此从未执行：WorldAlive.seedFactions() 一次都没跑，
     vars.entities.factions 恒为空壳，主笔看不到势力消长，(world_update) 协议也从未送达，
     「势力动态演化 / 覆灭实时体现」对真实玩法等于没接上。此处提到主装配函数，所有模式统一生效。 */
  try {
    const liveParts = [];
    if (window.BeastSystem && BeastSystem.buildPromptBlock) { const _bs = BeastSystem.buildPromptBlock(); if (_bs) liveParts.push(_bs); }
    if (window.SquadSystem && SquadSystem.buildPromptBlock) { const _sq = SquadSystem.buildPromptBlock(); if (_sq) liveParts.push(_sq); }
    if (window.WorldAlive) {
      try { WorldAlive.seedFactions(); } catch (e) {}
      /* v3.94.0：玩家自己宣告「另立 X盟 / 灭掉 X帮」时，机械层直接落图，
         不等模型写 (world_update)，也不因模型在正文里否决而跟着失效。 */
      try { if (WorldAlive.applyPlayerDirective) WorldAlive.applyPlayerDirective(userMessage); } catch (e) {}
      const _wa = WorldAlive.buildPromptBlock();
      if (_wa) liveParts.push(_wa);
    }
    const _cst = window.WorldExt && window.WorldExt.modState ? window.WorldExt.modState("wr_combat") : null;
    if (_cst && _cst.inBattle) {
      if (window.BeastSystem && BeastSystem.buildCombatBlock) { const _bcb = BeastSystem.buildCombatBlock(); if (_bcb) liveParts.push(_bcb); }
      if (window.SquadSystem && SquadSystem.buildCombatBlock) { const _scb = SquadSystem.buildCombatBlock(); if (_scb) liveParts.push(_scb); }
    }
    if (liveParts.length) push({ role: "system", content: liveParts.join("\n") }, "活世界", 26);
  } catch (e) { if (window.YJ_DEBUG) console.warn("[MessageBuilder] 活世界上行装配失败:", e); }
  if (state.setup) {
    /* v4.00.0 补标签：这一段此前没写 label，账单里显示成 "undefined" 段，
       排查预算时看不出是哪块在吃字符。设定卡属于不可裁内容，prio=100。 */
    push({ role: "system", content: buildSetupCard(state.setup, config) }, "设定卡", 100);
  }
  const digest = buildStoryDigest();
  if (digest) {
    push({ role: "system", content: `【当前故事状态面板（必须严格延续，不得矛盾）】
${digest}` }, "状态面板", 100);
  }
  const storyKB = window.StoryKnowledge;
  if (storyKB && storyKB.getCount() > 0) {
    /* v3.99.0 低配档知识库策略重写。
       旧逻辑（v3.55.10）是 lite 档整包跳过背景知识——省 token，但代价是
       小模型完全拿不到世界地理/势力/设定骨架，人物开口就串戏，OOC 反而更严重。
       新逻辑：背景层照给，只按档位给预算；预算内超长的条目被压缩（保留铁律句）
       而不是丢弃，于是小模型拿到的是「薄但完整」的世界。 */
    let bgBudget = 0;
    try {
      const total = (window.PromptBudget && window.PromptBudget.get && window.PromptBudget.get().limit) || 0;
      /* lite 档背景预算随总预算收缩：8K 档总预算只有 5200 字符，固定 2000 会把前景挤没 */
      bgBudget = bmmOn
        ? (_ct === "tiny" ? 500 : _ct === "small" ? 1400 : 2000)
        : Math.max(4000, Math.round(total * 0.22));
    } catch (e) { bgBudget = bmmOn ? 1200 : 6000; }
    /* v3.99.0 prio=100：知识库已在源头按预算生成（薄但完整），不能再让 finalize 整段裁掉——
       它一被裁，小模型就彻底失去世界骨架，人物立刻串戏。让「历史」去当缓冲区。 */
    for (const m of storyKB.buildBackgroundKnowledge(bgBudget)) push(m, "知识库·背景", 100);
  }
  const recap = state.digest;
  if (recap && (recap.summary || (recap.blocks && recap.blocks.length))) {
    /* v3.55.22 分层记忆：滚动摘要（近章）+ 章节存档块（远章浓缩档案），两级都必须延续 */
    const arch = window.RecapEngine && RecapEngine.archiveBlock ? RecapEngine.archiveBlock() : "";
    push({ role: "system", content: `【前情提要（较早章节的自动摘要，剧情连贯性依据，必须严格延续）】
${recap.summary || "（近章暂无）"}${arch ? `

【更早章节存档（更远剧情的浓缩档案，其中的事实同样不得矛盾或遗忘）】
${arch}` : ""}` }, "前情提要", 60);
  }
  const memMsg = window.MemoryLayers && window.MemoryLayers.buildInjection ? window.MemoryLayers.buildInjection(userMessage, state.conversationHistory) : null;
  if (memMsg) push(memMsg, "长期记忆", 65);
  /* v3.55.22 双通道召回：全楼层 BM25（+可选向量精排）检索与本轮输入相关的旧楼原文，
     摘要保梗概、检索保细节——几千楼前的伏笔仍能被精确想起 */
  if (window.TranscriptRetrieval) {
    try {
      const retr = await TranscriptRetrieval.buildInjection(userMessage, state);
      if (retr) push({ role: "system", content: retr }, "旧章召回", 55);
    } catch (e) { console.warn("[长程召回] 失败（静默跳过）:", e && e.message); }
  }
  /* v3.99.0 低配档历史窗口减半：16 轮正文即便压缩后仍占 1.2 万~1.6 万字，
     是仅次于系统提示词的第二大头。8 轮足够维持连贯，把省下的额度留给世界骨架。
     v4.00.0 高配档按上下文窗口放开：旧版写死 16 轮，128K 上下文的强模型也只记得
     16 轮，玩家玩到中后期就「忘了几十章前的事」，所谓「在一个世界里过完一生」根本撑不住。
     现在 32K→20 轮、64K→28 轮、128K 及以上→40 轮，长线剧情才接得住。 */
  const _ctxTk = (window.PromptBudget && window.PromptBudget.ctxTokens && window.PromptBudget.ctxTokens()) || 0;
  const histRounds = bmmOn
    ? (_ct === "tiny" ? 2 : _ct === "small" ? 8 : 10)
    : (_ctxTk >= 128000 ? 40 : _ctxTk >= 64000 ? 28 : _ctxTk >= 32000 ? 20 : 16);
  const recent = state.conversationHistory.slice(-(histRounds + 1), -1);
  for (const msg of recent) {
    if (!msg || !msg.role || msg.content == null) continue;
    if (msg.role === "assistant") {
      push({ role: "assistant", content: compressAssistantMsg(msg.content) }, "历史", 40);
    } else {
      push({ role: "user", content: msg.content }, "历史", 40);
    }
  }
  if (storyKB && storyKB.getCount() > 0) {
    let fgBudget = 0;
    try {
      const total = (window.PromptBudget && window.PromptBudget.get && window.PromptBudget.get().limit) || 0;
      /* lite 档 4200：专名铁律段（约 550 字）已占一部分，3000 会把人物档案挤没；
         高配档上限 24000，避免 11 万字符预算下知识库独吞三分之一上下文。 */
      fgBudget = bmmOn
        ? (_ct === "tiny" ? 850 : _ct === "small" ? 2400 : 3400)
        : Math.max(8000, Math.min(24000, Math.round((total || 40000) * 0.3)));
    } catch (e) { fgBudget = bmmOn ? 2200 : 12000; }
    const fgList = (typeof storyKB.buildForegroundKnowledgeAsync === "function")
      ? await storyKB.buildForegroundKnowledgeAsync(userMessage, state.conversationHistory, fgBudget)
      : storyKB.buildForegroundKnowledge(userMessage, state.conversationHistory, null, fgBudget);
    /* 同上：源头已按预算生成，免疫最终裁剪，铁律与人物档案必须活着到模型手里 */
    for (const m of fgList) push(m, "知识库·前景", 100);
  }
  const antibagu = (!bmmOn && window.AntibaguGuard && window.AntibaguGuard.buildDirective()) || "";
  if (antibagu) {
    push({ role: "system", content: antibagu }, "反八股", 30);
  }
  try {
    const imm = window.ImmersiveSuite && ImmersiveSuite._state;
    const oracle = window.GameLayer ? GameLayer.takeOracle() : null;
    const intel = window.ImmersiveSuite ? ImmersiveSuite.takeIntel() : [];
    const notes = [];
    if (imm && (imm.time || imm.weather)) {
      notes.push(bmmOn
        ? `【场域】时辰：${imm.time || "未知"}｜天象：${imm.weather || "未知"}——环境描写须与此一致。`
        : `【场域氛围（当前场景的真实环境，正文环境描写必须与此一致）】时辰：${imm.time || "未知"}｜天象：${imm.weather || "未知"}${imm.day ? "｜历日：" + imm.day : ""}——环境细节（光影/温度/风声/衣着）应自然贴合此刻此景，不得写出矛盾的天象。`);
    }
    if (intel && intel.length) {
      notes.push(`【密谈所得（玩家与NPC私下对话获知的情报，本轮起自然生效）】
${intel.map((p) => `· ${p.name}私下透露：${p.text}`).join("\n")}
——这些信息已为玩家所知：可让NPC言行与之一致、让情报在剧情中兑现，但不要复述密谈原文。`);
    }
    if (oracle) {
      notes.push(`【天机批语（命运骰所指的隐性走向，本轮剧情应暗合其意）】「${oracle.text}」——只取其意象与走向，绝不逐字引用或解释这句批语。`);
    }
    const extDir = window.WorldExt && WorldExt.hasModules && WorldExt.hasModules() ? WorldExt.takeDirective() : null;
    if (extDir) notes.push(extDir);
    try {
      const phoneNote = window.PhonePanel && PhonePanel.takePhoneNotes ? PhonePanel.takePhoneNotes() : null;
      if (phoneNote) notes.push(phoneNote);
    } catch (e) {
    }
    /* v3.68.0 兼容老档：driftNotes 曾被写成字符串，统一归一化为 {text} 数组再消费 */
    let drift = state.driftNotes;
    if (typeof drift === "string" && drift.trim()) drift = [{ text: drift }];
    else if (!Array.isArray(drift)) drift = null;
    if (drift && drift.length) {
      notes.push(`【数值纠偏（上轮正文与状态面板存在矛盾，本轮必须消化，不得无视）】
${drift.map((d) => `· ${d.text.split("|").join(" —— ")}`).join("\n")}
——本轮二选一：要么在正文里写出数值回到面板水平的合理过程（从惊险回落/信任修补/伤势发作），要么让叙事严格按面板数值的克制程度展开；正文依旧严禁出现任何数值面板。`);
      state.driftNotes = [];
    }
    const qs = window.QualitySuite;
    if (qs) {
      const styleD = qs.styleDirective();
      if (styleD) notes.push(styleD);
      const bibD = qs.bibleDirective();
      if (bibD) notes.push(bibD);
      const pacD = qs.pacingDirective();
      if (pacD) notes.push(pacD);
      const fsD = qs.fsDirective();
      if (fsD) notes.push(fsD);
    }
    const rvn = state.reviewNotes;
    if (rvn && rvn.length) {
      notes.push(`【责编手记（上轮自审发现的问题，本轮写作必须规避）】
${rvn.map((x) => `· ${x}`).join("\n")}`);
      state.reviewNotes = [];
    }
    if (notes.length) push({ role: "system", content: notes.join("\n\n") }, "场域注记", 50);
  } catch (e) {
    /* v3.68.0 不再静默：任一注记子系统抛错至少留痕（此前整段空捕获，出错即无声丢注记） */
    if (window.YJ_DEBUG) console.warn("[MessageBuilder] 场域注记装配失败:", e);
  }
  const sceneMsg = window.SceneState && window.SceneState.buildInjection ? window.SceneState.buildInjection() : null;
  if (sceneMsg) push(sceneMsg, "舞台现状", 55);
  /* v3.55.22 格式契约：贴着生成位置重申输出骨架——几千楼后上下文变长，
     预设里的格式定义离得远、注意力稀释导致格式漂移（状态栏丢字段、选项缩水、
     变量块漏闭合），这条在末尾兜底，不依赖任何预设文本。
     变量块条款跟随 vaOn：变量AI 模式下变量登记由独立系统完成，正文严禁带块。 */
  /* v4.02.0 网游三界例外：数据流网游的正文本来就要写等级/伤害/掉落数字，
     全局「严禁数值面板」会把模型逼到自编 Lv.8 属性表或干脆复述设定。
     这里放宽为「可写少量与面板一致的数字 + 结算行，但不许整段罗列属性面板」。 */
  const _gKey = (window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey) || '';
  const rpgMode = ['wangyou'].indexOf(_gKey) >= 0;
  const fmtVarLine = rpgMode
    ? `2) 本界为数据流网游：正文可写少量与【网游角色面板】快照一致的数字（玩家等级、伤害、耗蓝、掉落品级），野怪与对手不得写具体等级或 HP 数字，并可在 (variable_update) 块里写 >>网游面板.exp: +120 一类结算行；严禁整段罗列属性面板、六维清单或自行编造与快照不符的数字；`
    : (vaOn
      ? `2) 严禁输出任何变量更新块、状态指令或数值面板——状态登记由独立系统完成；`
      : `2) 变量更新块（(variable_update)…(/variable_update)）与此前楼层格式完全一致，标签成对闭合；`);
  /* v4.01.0 tiny 档字数硬顶：实测 8K 窗口给 2000 token 输出（≈2700 字），
     模型仍会一路写到 2613 字被掐断在「不如先用这枚回气丹做个」这种半句上。
     篇幅护栏埋在几千字的长 system 段中部，小模型根本读不到；
     这条贴在生成位置（最后一条 system），且给的是「段数」这种可数的目标。 */
  const tinyLenLine = (window.BaseModelMode && window.BaseModelMode.ctxTier && window.BaseModelMode.ctxTier() === 'tiny')
    ? `\n6) 【本轮篇幅】正文 700–1000 字、最多 12 个自然段。写到一个完整的场景收束就停笔——宁可下一轮接着写，也绝不允许写到一半被截断。这一条优先于「充分展开」。`
    : '';
  push({ role: "system", content: `【格式契约（无论写到第几千楼，每一楼都必须完整遵守）】
1) 正文为中文小说体，台词用「」，段落充分展开，严禁因楼层变多而缩短篇幅或改写概括式流水账；
${fmtVarLine}
3) 正文后必须输出【行动选项】，六类（快进/交互/整活/慢推/时空/成人）各一条、顺序固定、格式照旧，严禁省略或合并；
4) ${rpgMode ? '除上述骨架外，不得输出整段属性面板、六维清单、系统日志或 OOC 说明。' : '除上述骨架外，不得输出任何状态面板、数值清单或 OOC 说明。'}
5) 【直出正文】第一个字就是具体场景或动作，严禁以「让我分析」「玩家设定」「根据设定」「本章要点」开头，严禁输出思路、大纲、设定复述、创作说明或任何分析过程——你是世界本身，不是解说员。${tinyLenLine}` }, "格式契约", 90);
  /* v4.00.0 补标签：本轮指令是最后一条 user 消息，永远不裁（prio=100），
     此前没 label，账单里剩下唯一的 "undefined" 段就是它。 */
  push({ role: "user", content: userMessage }, "本轮指令", 100);
  return window.PromptBudget && PromptBudget.finalize(messages, segs) || messages;
}
function buildSetupCard(setup, config) {
  if (config.mode === "roleplay") return buildPlayerIdentityCard(setup, config);
  const parts = [`【故事设定卡（最高优先级，全程锁定）】`];
  if (setup.title) parts.push(`书名：《${setup.title}》`);
  if (setup.premise) parts.push(`核心梗概/一句话故事：${setup.premise}`);
  if (setup.playerName) {
    parts.push(`主角（玩家钦定，全程锁定，不得改名换人）：${setup.playerName}（${setup.gender || "男"}${setup.age ? `，${setup.age}岁` : ""}）`);
    if (setup.heroBio) {
      parts.push(`主角小传（玩家亲笔，性格/来历/所求按此执行，际遇与抉择须与之自洽）：`);
      parts.push(setup.heroBio);
    }
  }
  if (setup.customPerspective) parts.push(`叙事视角：自定义视角——玩家亲笔设定（严格执行）：${setup.customPerspective}`);
  else if (setup.perspective) parts.push(`叙事视角：${setup.perspective}${setup.perspectiveDesc ? `（${setup.perspectiveDesc}）` : ""}`);
  if (setup.customStyle) parts.push(`文风基调：自定义文风——玩家亲笔设定（严格执行，正文全程贯彻）：${setup.customStyle}`);
  else if (setup.style) parts.push(`文风基调：${setup.style}${setup.styleDesc ? `（${setup.styleDesc}）` : ""}`);
  if (setup.customLength) parts.push(`目标篇幅：自定义篇幅——玩家亲笔设定（章数与节奏按此把握，终章须完成收束）：${setup.customLength}`);
  else if (setup.length) parts.push(`目标篇幅：${setup.length}${setup.lengthDesc ? `（${setup.lengthDesc}）` : ""}`);
  if (setup.customEra) parts.push(`时代背景：自定义时代——玩家亲笔设定（严格执行，行文自始至终浸润其中）：${setup.customEra}`);
  else if (setup.era) parts.push(`时代背景：${setup.era}${setup.eraDesc ? `（${setup.eraDesc}）` : ""}`);
  if (setup.customMotif) parts.push(`主题母题：自定义母题——玩家亲笔设定（全书题眼，行文自始至终浸润其中）：${setup.customMotif}`);
  else if (setup.motif) parts.push(`主题母题：${setup.motif}${setup.motifDesc ? `（${setup.motifDesc}）` : ""}`);
  if (setup.opening === "custom" && setup.customEntry) {
    parts.push(`开篇模式：自定义开篇——玩家亲笔的第一幕（最高优先级，开场场景与事件逐条按此执行）：`);
    parts.push(setup.customEntry);
  } else {
    const opening = (config.openings || []).find((o) => o.id === setup.opening);
    if (opening) parts.push(`开篇模式：${opening.name}（${opening.description}）`);
  }
  const techs = (config.techniques || []).filter((t) => (setup.techniques || []).includes(t.id) && t.id !== "custom");
  if (techs.length || setup.customTechnique) {
    const techParts = [];
    if (techs.length) techParts.push(techs.map((t) => `${t.name}（${t.description}）`).join("；"));
    if (setup.customTechnique) techParts.push(`自定义技法（玩家亲笔，必须贯彻）：${setup.customTechnique}`);
    parts.push(`写作技法（必须贯彻）：${techParts.join("；")}`);
  }
  const stats = setup.stats || {};
  const statKeys = Object.keys(stats);
  if (statKeys.length) {
    parts.push(`创作六维权重：${statKeys.map((k) => `${k} ${stats[k]}`).join(" / ")}`);
  }
  const cvs = Array.isArray(setup.customVars) ? setup.customVars.filter((p) => p && p.key) : [];
  if (cvs.length) {
    const vaSplit = !!(window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()));
    parts.push(vaSplit ? `自定义变量（玩家指定追踪，独立登记系统会随剧情逐轮更新，数值变化须真实影响剧情走向，正文不得与之矛盾）：${cvs.map((p) => `${p.key}=${p.val || "未定"}`).join("，")}` : `自定义变量（玩家指定追踪，每轮在 variable_update 中以「自定义.字段名: 值」如实更新，数值变化须真实影响剧情走向）：${cvs.map((p) => `${p.key}=${p.val || "未定"}`).join("，")}`);
  }
  parts.push(`【提醒】六维数值是行文权重导向，数值越高该项越浓墨重彩；时代背景与主题母题是底色约束，行文须自始至终浸润其中；正文严禁出现任何变量、面板、系统字样。`);
  return parts.join("\n");
}
function buildPlayerIdentityCard(setup, config) {
  const free = StoryFreedom.isFree();
  const parts = [`【玩家身份卡（最高优先级，全程锁定）】`];
  /* v3.55.19 世界描述随叙事立场变化（旧文案只有「玩家主导 / 禁止二创」两档，
     没有「玩家取代原著主角」这一档） */
  const _stance = window.StoryStance ? StoryStance.get() : free ? "original" : "hero";
  const _canon = window.StoryStance ? StoryStance.canonHeroName() : "原著主角";
  parts.push(
    _stance === "hero"
      ? `世界：《${config.genreName}》原著世界（玩家即原著主角${_canon}——${_canon}不再作为独立人物登场，原著主线由玩家亲历，大势不可改、小势可调）`
      : _stance === "side"
        ? `世界：《${config.genreName}》原著世界（玩家是原著配角，按该配角的原著定位展开属于自己的人生线；${_canon}有他自己的一生）`
        : `世界：《${config.genreName}》原著世界（玩家是完全原创角色，无任何原著身份；路径与际遇全由玩家把控，大模型辅助推演交汇）`
  );
  if (setup.playerName) parts.push(`玩家角色：${setup.playerName}（${setup.gender || "男"}，${setup.age || 18}岁）`);
  /* v3.47.18 玩家亲笔的主角小传：这是「我是这个世界的一份子」最核心的自定义内容。
     创作模式原本就有，扮演模式此前漏了 —— 玩家写了小传却没进提示词。 */
  if (setup.heroBio) {
    parts.push(`主角小传（玩家亲笔，性格/来历/所求按此执行，际遇与抉择须与之自洽）：`);
    parts.push(setup.heroBio);
  }
  if (setup.customIdentity) {
    parts.push(`身份出身：自定义身份——玩家亲笔设定（最高优先级，逐条落实到开局与后续际遇，不得违背）：`);
    parts.push(setup.customIdentity);
  } else if (setup.identity) {
    parts.push(`身份出身：${setup.identity}${setup.identityDesc ? `（${setup.identityDesc}）` : ""}`);
  }
  if (setup.customTimeline) parts.push(`时代节点：自定义时代节点——玩家亲笔设定（严格执行，世界须按此时间点运转）：${setup.customTimeline}`);
  else if (setup.timeline) parts.push(`时代节点：${setup.timeline}${setup.timelineDesc ? `（${setup.timelineDesc}）` : ""}`);
  if (setup.customAptitude) parts.push(`资质天赋：自定义资质——玩家亲笔设定（严格执行，成长际遇按此倾向展开）：${setup.customAptitude}`);
  else if (setup.aptitude) parts.push(`资质天赋：${setup.aptitude}${setup.aptitudeDesc ? `（${setup.aptitudeDesc}）` : ""}`);
  /* v3.55.25 天赋社会反响（世界自适应）：资质不是静态标签，而是这个世界里
     被人掂量、被人争夺的社会事实——顶级天赋不该再默默无闻当外门弟子。 */
  if (setup.customAptitude || setup.aptitude) {
    parts.push(
      `【天赋社会反响（世界自适应，必须执行）】\n` +
      `· 先定档：按本世界世界观与世界书，评估玩家资质在本世界的稀有度——顶级（万中无一，足以惊动顶尖势力）/ 稀有（强宗名门争抢）/ 中平 / 低劣（被认为前途有限）。定档以本世界的共识为准，不由现实常识决定。\n` +
      `· 顶级/稀有且已暴露：知情者必须给出相称的对待——高层亲自过问、势力抢着收徒、稀缺资源与功法主动倾斜、旁观者另眼相看、好感与重视度显著更高；同时也招来嫉妒、拉拢与算计。玩家开局即为顶级天赋时，不得仍按普通弟子剧本安排其起点。\n` +
      `· 低劣天赋：倨傲、势利、以天赋论人的角色会轻视、冷落、克扣；但温和厚道或阅历深的角色不以天赋取人，照常相待甚至暗中扶持——世界不只有一个腔调，白眼与善意并存。\n` +
      `· 隐瞒有效：玩家刻意藏拙时，不知情者一律按表面表现对待，任何人不得未卜先知；一旦暴露（测试、出手、传开），上述反响按规则补上并持续发酵、口耳相传。\n` +
      `· 反响写进剧情：用具体人物的具体言行呈现（谁改了口、谁递了什么、谁皱了眉），同步体现在变量块的好感/态度与后续际遇分配上，不得只在旁白空喊。`
    );
  }
  if (setup.customPerspective) parts.push(`叙述视角：自定义视角——玩家亲笔设定（严格执行）：${setup.customPerspective}`);
  else if (setup.perspective) parts.push(`叙述视角：${setup.perspective}${setup.perspectiveDesc ? `（${setup.perspectiveDesc}）` : ""}`);
  if (setup.customScale) parts.push(`游玩规模：自定义规模——玩家亲笔设定（节奏与长度按此把握）：${setup.customScale}`);
  else if (setup.scale) parts.push(`游玩规模：${setup.scale}${setup.scaleDesc ? `（${setup.scaleDesc}）` : ""}`);
  if (setup.background) parts.push(`身世自述：${setup.background}`);
  /* v3.47.18 文风基调：扮演模式此前也漏了。内嵌云起预设开启时由预设的本土文风块承载
     （更细），这里作为兜底——预设关闭时玩家选的文风仍要生效。 */
  if (setup.customStyle) parts.push(`文风基调：自定义文风——玩家亲笔设定（严格执行，正文全程贯彻）：${setup.customStyle}`);
  else if (setup.style) parts.push(`文风基调：${setup.style}${setup.styleDesc ? `（${setup.styleDesc}）` : ""}`);
  if (setup.customEntry) {
    parts.push(`入场事件：自定义入场——玩家亲笔的第一幕（最高优先级，开场场景与处境逐条按此执行）：`);
    parts.push(setup.customEntry);
  } else {
    const entry = (config.openings || []).find((o) => o.id === setup.entryEvent);
    if (entry) parts.push(`入场事件：${entry.name}（${entry.description}）`);
  }
  const boons = (config.techniques || []).filter((t) => (setup.boons || setup.techniques || []).includes(t.id));
  if (boons.length || setup.customBoon) {
    const boonParts = [];
    if (boons.length) boonParts.push(boons.map((b) => `${b.name}（${b.description}）`).join("；"));
    if (setup.customBoon) boonParts.push(`自定义机缘（玩家亲笔，须按原著逻辑兑现，强度与内容相称）：${setup.customBoon}`);
    parts.push(`起始机缘（已生效，须按原著逻辑兑现）：${boonParts.join("；")}`);
  }
  const stats = setup.stats || {};
  const statKeys = Object.keys(stats);
  if (statKeys.length) {
    const labelMap = {};
    (config.statKeys || []).forEach((s) => {
      labelMap[s.key] = s.label;
    });
    parts.push(`角色资质：${statKeys.map((k) => `${labelMap[k] || k} ${stats[k]}`).join(" / ")}`);
  }
  /* v3.62.0 身份三态：原著主角 / 原著配角 / 完全原创。
     旧逻辑只有「取代主角 / 同行者 / 搅局者」三档，且与玩家身份（穿越者/土著）耦合；
     现收敛为「你是谁」三态，主角态锁定大势节点、配角态按原著定位生成人生、原创态全自由。 */
  if (window.StoryStance) {
    const isRP = config && config.mode === "roleplay";
    parts.push(StoryStance.buildDirective(setup.playerName || "", StoryStance.canonHeroName(), isRP));
  } else {
    parts.push(free ? `【铁律】玩家是这个世界中的自定义角色；你的职责是主持世界——原著人物、势力按其性格与逻辑行动；原著设定是世界观底色，但原著剧情不是铁轨：玩家的行动可以影响、偏转、甚至改写原著大势与原著人物的命运；你不得用原著剧情推着玩家走，也不得为"还原原著"而扭曲玩家的选择与际遇；资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。` : `【铁律】玩家是原著世界中的普通自定义角色，不是原著主角；你的职责是主持世界——原著人物、势力按其性格与逻辑行动；原著大事不是写死的剧本，而是有诱因链的因果：玩家终结其诱因则该事不发生或换形态，玩家的际遇会生出原著没有的新事件（见《大势演化账本》），但走向偏移必须合乎因果，不得凭空；玩家不享有主角光环；资质数值是际遇倾向导向而非战力数值；正文严禁出现任何变量、面板、系统字样。`);
  }
  /* v3.55.19 机缘归属账本：让世界真正动态——夺走的东西不会失而复得 */
  if (window.CanonLedger) {
    const led = CanonLedger.buildPromptBlock();
    if (led) parts.push(led);
    parts.push(CanonLedger.buildProtocol());
  }
  /* v3.55.23 大势演化账本：原著大势可改——诱因终结则大事不生，涟漪可生新事，羁绊可易主 */
  if (window.CanonTimeline) {
    const tl = CanonTimeline.buildPromptBlock();
    if (tl) parts.push(tl);
    parts.push(CanonTimeline.buildProtocol());
  }
  /* v3.55.20 玩家身份（穿越者 / 土著）与原著主角关系（同伴 / 敌对 / 陌路）：
     补上「元认知边界」与「相处铁律」，让穿越者不会全知、土著不被剧透、
     陌路时世界照样在主角视线外自走一生 */
  if (window.StoryIdentity) {
    parts.push(StoryIdentity.buildIdentityDirective());
    const _rel = StoryIdentity.buildRelationDirective();
    if (_rel) parts.push(_rel);
  }
  /* v3.55.20 本界资料库：注入相关设定锚点，提升设定一致性与世界真实感 */
  if (window.WorldBook) {
    try { WorldBook.ensureSeed(); } catch (e) {}
    const _wb = WorldBook.buildPromptBlock();
    if (_wb) parts.push(_wb);
  }
  /* v3.93.0：活世界 / 灵宠 / 小队 / 战斗协同的上行注入已统一移到 buildStoryMessages
     主装配函数（原先只在本 roleplay 分支生效，创作模式整组丢失），此处不再重复注入。 */
  return parts.join("\n");
}
function buildStoryDigest() {
  var _a, _b;
  const fw = window.storyFramework;
  if (!fw || !fw.storyState) return "";
  const v = fw.storyState.variables;
  if (!v || Object.keys(v).length === 0) return "";
  const lines = [];
  const isRP = fw.config.mode === "roleplay";
  if (v.title) lines.push(`书名：《${v.title}》`);
  lines.push(isRP ? `游戏回合：第 ${v.chapter || 0} / ${v.totalChapters || "?"} 回合` : `章节进度：第 ${v.chapter || 0} / ${v.totalChapters || "?"} 章`);
  lines.push(`累计字数：${v.wordCount || 0}`);
  if (v.era || v.date || v.location || v.time || v.weather) {
    const spacetime = [v.era, v.date, v.location, v.time, v.weather].filter((x) => x != null && String(x) !== "").map((x) => String(x).slice(0, 40));
    if (spacetime.length) lines.push(`时空：${spacetime.join("｜")}`);
  }
  if (v.cash != null && String(v.cash) !== "") lines.push(`随身现金：${String(v.cash).slice(0, 30)}`);
  if (v.savings != null && String(v.savings) !== "") lines.push(`积蓄：${String(v.savings).slice(0, 30)}`);
  (fw.config.gauges || []).forEach((g) => {
    if (typeof v[g.key] === "number") lines.push(`${g.label}：${v[g.key]}/100`);
  });
  const stats = v.stats || {};
  const statLabel = {};
  (fw.config.statKeys || []).forEach((s) => {
    statLabel[s.key] = s.label;
  });
  /* v3.55.26 属性引擎：扮演模式下用实盘块取代静态行——当前值+强项偏向+天赋
     档位/暴露状态+增长纪律（数值平衡由引擎在解析侧真实钳制，见 attribute-engine.js） */
  let liveBlock = "";
  if (isRP && window.AttributeEngine) liveBlock = window.AttributeEngine.buildLiveBlock(fw);
  if (liveBlock) {
    lines.push(liveBlock);
  } else {
    const statStr = Object.entries(stats).map(([k, val]) => `${statLabel[k] || k} ${val}`).join(" / ");
    if (statStr) lines.push(isRP ? `角色资质：${statStr}` : `创作六维：${statStr}`);
  }
  const customSrc = {};
  if (v.自定义 && typeof v.自定义 === "object" && !Array.isArray(v.自定义)) {
    Object.entries(v.自定义).forEach(([k, val]) => {
      const key = String(k).trim().slice(0, 10);
      if (key && val != null && String(val) !== "") customSrc[key] = val;
    });
  }
  Object.keys(v).forEach((k) => {
    const m = String(k).match(/^自定义[.:：]?\s*(.+)$/);
    const key = m ? m[1].trim() : "";
    if (key && !(key in customSrc) && v[k] != null && String(v[k]) !== "") customSrc[key] = v[k];
  });
  const seedArr = Array.isArray((_b = (_a = fw.storyState) == null ? void 0 : _a.setup) == null ? void 0 : _b.customVars) ? fw.storyState.setup.customVars : [];
  seedArr.forEach((p) => {
    const key = p && String(p.key || "").trim().slice(0, 10);
    if (key && !(key in customSrc)) customSrc[key] = p.val || "未定";
  });
  const customEntries = Object.entries(customSrc).slice(0, 12).map(([k, val]) => `${k}=${String(val).slice(0, 24)}`);
  if (customEntries.length) {
    lines.push(`玩家自定义追踪（玩家点名要照看的状态：正文里这些字段确凿变化时，必须以「自定义.字段名: 新值」登记新值，数值可带 +/- 增量）：${customEntries.join("，")}`);
  }
  const chars = v.characters && typeof v.characters === "object" && !Array.isArray(v.characters) ? v.characters : {};
  const charNames = Object.keys(chars).slice(0, 12);
  if (charNames.length) {
    const charStr = charNames.map((n) => {
      var _a2;
      const c = chars[n];
      const role = c.role ? `(${c.role}${isRP && c.realm ? "·" + c.realm : ""})` : "";
      const trust = isRP && typeof c.trust === "number" ? `[信任${c.trust}]` : "";
      const rel = isRP && c.relationship ? `[关系:${c.relationship}]` : "";
      const st = c.status ? `[${c.status}]` : "";
      const relOf = ((_a2 = window.VariableInstructionParser) == null ? void 0 : _a2.relationOf) ? window.VariableInstructionParser.relationOf(c) : "";
      let tag = "";
      if (isRP) {
        if (c.isPlayer) tag = "玩家";
        else if (c.isCanon) tag = "原著";
        else tag = "原创";
      }
      if (relOf) tag = tag ? `${tag}·${relOf}` : relOf;
      if (tag) tag = `{${tag}}`;
      if (c.isFaraway) tag = "{远方·未遇见}";
      return `${n}${tag}${role}${trust}${rel}${st}`;
    }).join("、");
    lines.push(isRP ? `已登场人物：${charStr}` : `已登场角色：${charStr}`);
    const detailNames = charNames.slice(0, 6);
    const detailLines = detailNames.map((n) => {
      const c = chars[n] || {};
      const seg = [];
      if (c.age) seg.push(`${c.age}岁`);
      if (c.appearance) seg.push(`外貌:${String(c.appearance).slice(0, 40)}`);
      if (c.personality) seg.push(`性格:${String(c.personality).slice(0, 30)}`);
      if (c.speechPattern) seg.push(`言谈:${String(c.speechPattern).slice(0, 24)}`);
      if (c.motivation) seg.push(`动机:${String(c.motivation).slice(0, 26)}`);
      if (c.goal) seg.push(`目标:${String(c.goal).slice(0, 22)}`);
      if (!isRP && c.location) seg.push(`位置:${String(c.location).slice(0, 16)}`);
      if (c.secret) seg.push(`秘密:${String(c.secret).slice(0, 24)}`);
      if (!seg.length) return "";
      const lk = Array.isArray(c.locked) ? c.locked.filter((k) => c[k] != null && String(c[k]) !== "") : [];
      if (lk.length) seg.push(`🔒玩家锁定(${lk.map((k) => `${k}=${String(c[k]).slice(0, 20)}`).join("、")})须严格遵守`);
      const cf = c.customFields && typeof c.customFields === "object" && !Array.isArray(c.customFields) ? c.customFields : {};
      const cfLockedEntries = [], cfFreeEntries = [];
      Object.entries(cf).slice(0, 6).forEach(([k, val]) => {
        const free = Array.isArray(c.cfLocked) && c.cfLocked.includes(String(k));
        (free ? cfFreeEntries : cfLockedEntries).push(`${k}=${String(val).slice(0, 30)}`);
      });
      let cfNote = "";
      if (cfLockedEntries.length) cfNote += `
    玩家亲笔设定（正文须严格遵守）：${cfLockedEntries.join("；")}`;
      if (cfFreeEntries.length) cfNote += `
    玩家已交还AI管理（此栏随剧情演化，正文情节推进后以「角色名.格子名: 新值」登记新状态）：${cfFreeEntries.join("；")}`;
      return `  - ${n}：${seg.join("｜")}${cfNote}`;
    }).filter(Boolean);
    if (detailLines.length) lines.push(`重点人物档案（人设一致性依据）：
${detailLines.join("\n")}`);
  }
  const fs = Array.isArray(v.foreshadowings) ? v.foreshadowings : [];
  if (fs.length) {
    const planted = fs.filter((f) => f.status === "planted").map((f) => f.name);
    const resolved = fs.filter((f) => f.status === "resolved").map((f) => f.name);
    if (planted.length) lines.push(isRP ? `未解之事（须择机了结）：${planted.join("、")}` : `未回收伏笔（须择机回收）：${planted.join("、")}`);
    if (resolved.length) lines.push(isRP ? `已了结之事：${resolved.join("、")}` : `已回收伏笔：${resolved.join("、")}`);
  }
  const items = Array.isArray(v.items) ? v.items : [];
  if (items.length) lines.push(`关键道具：${items.map((i) => `${i.name}x${i.count}`).join("、")}`);
  const hist = (Array.isArray(v.history) ? v.history : []).slice(-5);
  if (hist.length) lines.push(`近期大事记：
${hist.join("\n")}`);
  return lines.join("\n");
}
function compressAssistantMsg(content) {
  if (!content) return content;
  if (window.VariableAI && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive())) {
    /* v3.46.2：旧版对未闭合 variable_update 标记一律"删到结尾"——标记写在回复开头
       （常见）且闭合不规范时，整轮历史被清空成空消息；模型看到连续的空助手轮，
       会强化"只吐变量块/正文缺失"倾向，长局（200+ 回合）越玩越容易坏即此元凶。
       改用与 extractBody 同源的安全剥离：只吞协议行段，遇叙事即停；判空再打捞兜底。 */
    const RH = window.StoryResponseHandler;
    let body2 = content.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "").replace(/【variable_update】[\s\S]*?【\/variable_update】/gi, "").replace(/<variable_update>[\s\S]*?<\/variable_update>/gi, "");
    if (RH && RH._stripUnclosedVarBlock) body2 = RH._stripUnclosedVarBlock(body2);
    body2 = body2.replace(/\(?\/?variable_update\)?/gi, "").trim();
    if (!body2 && RH && RH._rescueProse) body2 = RH._rescueProse(content);
    if (body2.length > 900) {
      body2 = body2.slice(0, 500) + "\n……（中略）……\n" + body2.slice(-300);
    }
    return body2;
  }
  const parser = window.VariableInstructionParser;
  const block = parser ? parser.extractUpdateBlock(content) : null;
  let body = content.replace(/\(variable_update\)[\s\S]*?\(\/variable_update\)/gi, "[变量已记录]").trim();
  if (body.length > 900) {
    body = body.slice(0, 500) + "\n……（中略）……\n" + body.slice(-300);
  }
  return block ? `${body}
(variable_update)
${block.slice(0, 600)}
(/variable_update)` : body;
}
