#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.07.2 · 真实模型玩家旅程（以玩家视角走完整交互链路）
用 agnes-3.0-flash 真实生成正文，逐步校验：
  ① 模型输出非空、不泄漏系统标记、不以元评论开头
  ② 数值契约：等级 / 金币 / 委托进度 与当前面板快照一致
  ③ 防幻觉：正文里的地名、势力名必须落在本界合法名表内
  ④ 功能态：动作执行后面板状态是否合理推进（无 NaN / 负数 / 倒退）

用法：
  YJ_TEST_KEY=<key> python3 t_player.py wangyou      # 深度旅程（网游大世界全功能）
  YJ_TEST_KEY=<key> python3 t_player.py all          # 全 38 界广度旅程
  YJ_TEST_KEY=<key> python3 t_player.py <genre> ...  # 指定若干界
"""
import asyncio, glob, io, json, os, re, sys
from playwright.async_api import async_playwright

E = os.environ.get("YJ_TEST_ENDPOINT", "https://apihub.agnes-ai.com/v1")
K = os.environ.get("YJ_TEST_KEY", "")
MODEL = "agnes-3.0-flash"
BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
# v4.07.2 实测：agnes-3.0-flash 端到端延迟波动很大（实测 5.8s ~ 62.8s，
# 且长正文（420 tokens）比短问答明显更慢）。初版超时设 80s 导致 12 步里 8 步假超时，
# 把「平台慢」误报成「产品坏」。放宽到 180s，并把超时如实标注为平台侧而非产品缺陷。
GAP = float(os.environ.get("YJ_GAP", "4.0"))
TIMEOUT = int(os.environ.get("YJ_TIMEOUT", "180"))
MAXTOK = int(os.environ.get("YJ_MAXTOK", "420"))

if not K:
    print("⚠ 未设置 YJ_TEST_KEY（仓库内不存密钥）")
    raise SystemExit(2)

ALL_GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob("/workspace/yunjing/js/kb/*.core.js"))

# ── 校验用正则 ───────────────────────────────────────────────
# v4.07.2 收紧：初版口径过宽，把「领口的粗布衣襟」误判成金币 62、把「红名不能在主城」
# 误判成编造地名，把真实缺陷淹没在噪声里。收紧后宁可漏报也不误报——误报会让真实
# 缺陷看不见，而漏报只会多跑一次确认。
FAKE_LV = re.compile(r"Lv\.?\s*(\d+)")
# v4.07.2：Lv. 数字既可能是玩家等级，也可能是 NPC/野怪的等级。
# 「我是 Lv.3 的剑士」说的是别人，不是玩家——初版把它算成玩家编造等级（误报）。
# 判定口径：只看「与玩家相关的 Lv.」——
#   ① 玩家自称（我/我方/主角/我这一身）
#   ② 系统提示/任务目标里给玩家的等级（玩家方的等级快照）
# 其余（NPC 自述、他人等级、野怪等级）不判。
PLAYER_LV = re.compile(r"(?:我|我方|主角|本人|自身)[^。！\n]{0,12}?Lv\.?\s*(\d+)")
# 叙述式升级（「经验条满格转了一圈——Lv.2了」「升至 Lv.3」）也是玩家等级，须计入。
# 主语须是玩家或无主语：NPC 自述（「他升到 Lv.9」「老兵是 Lv.20」）不算玩家等级。
PLAYER_LV2 = re.compile(r"(?:升至|升到|晋级|突破|转正|已经是|已是)\s*Lv\.?\s*(\d+)|Lv\.?\s*(\d+)\s*(?:了|啦)")
PLAYER_LV_OTHER = re.compile(r"(?:他|她|它|他们|她们|对方|那人|此人|老兵|守卫|队长|导师|NPC|敌人|怪物|野怪|对手)[^。！\n]{0,8}?Lv\.?\s*(\d+)")
# 野怪/NPC 被标注等级：违反提示词「不得给野怪与对手标注具体等级或 HP」，单列一项
MONSTER_LV = re.compile(r"[「『\"《【]([^」』\"》】]{1,10})[」』\"》】]\s*[（(]\s*Lv\.?\s*(\d+)\s*[）)]")
# 金币：必须「数字 + 金币/金币」紧密相邻（允许中间一个空格），且不能是别的量词
GOLD = re.compile(r"(?<![\d.])(\d{1,4})\s*(?:枚|个|颗)?\s*金币")
PROG = re.compile(r"(?<![\d.])(\d{1,4})\s*/\s*(\d{1,4})")
QUOTED = re.compile(r"[「『\"《]([^」』\"》]{2,16})[」』\"》]")
# 地名：只认「引号内的地理专名」。
# v4.07.2 口径修正：初版用宽松正则扫全文，误报率极高（实测把「我站在原野上」「那边的深渊」
# 「转身便往村口走」「压下心头那丝关于…」全判成编造地名）——这类误报会把真缺陷淹没。
# 改为只查引号内词组：AI 编造具体地名时几乎总会加引号（「霜狼谷」「血月城」），
# 而叙述里的泛称（村口、谷底、深渊）不会加引号——正好把两类区分开。
GEO_QUOTED = re.compile(r"[「『\"《]([^」』\"》]{2,12}?(?:村|城|镇|山|谷|林|塔|殿|宫|阁|海|河|原|岛|岭|域|界|道|街|坊|市|港|关|塞|窟|渊|墓|墟|滩|岸|峰|津|埠|坞|堡))[」』\"》]")
# 势力：捕获组必须紧跟闭合引号（初版跨引号截断，把「灰烬同盟」截成「灰烬同」）
FAC_SUFFIX = re.compile(r"[一-鿿A-Za-z0-9]{2,14}(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
# 拆分「前缀 + 势力后缀」，便于单独判断前缀是否像专名修饰语
FAC_PARTS = re.compile(r"([一-鿿A-Za-z0-9]{2,14}?)(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
QUOTED_FAC = re.compile(r"[「『\"《]([一-鿿A-Za-z0-9]{2,14})[」』\"》]\s*(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
# v4.07.2：玩家自建势力名未必带势力后缀（「青竹会」「苍狼团」都是常见命名），
# 但只有出现在「自建/创立/加入/创建…势力名」的句式里才算势力——
# 否则「够了不起行会」这种定语+普通词会被误判成编造势力。
PLAYER_FAC = re.compile(r"(?:自建|创立|创建|成立|建立|加入|自立|新建|招兵买马|拉起)\s*[了过]?\s*[「『\"《]([一-鿿A-Za-z0-9]{2,14})[」』\"》]")
# 虚词/指示词开头 → 是普通词组而非势力专名（那个行会 / 从我行会 / 这些公会）
# v4.07.2 口径修正：「和/与/跟」单独开头会误伤真实专名（「和风盟」「与天盟」），
# 改为必须紧跟代词/指示词才算泛指（和我行会 / 和那个行会）。
FAC_VAGUE_HEAD = re.compile(r"^(?:那个|这个|这些|那些|某个|某些|每个|各|从|向|到|在|把|被|让|给|对|为|以|按|据|由|用|是|有|无|所有|别的|其他|其它|或|还|还有|再|才|只|都|更|最)")
FAC_VAGUE_HEAD2 = re.compile(r"^(?:跟|和|与)(?:我|你|他|她|它|那|这|某|各|每|别|其|众)")
# v4.07.2 新增：前缀含「方位/部位」修饰语 → 那是「被修饰的普通词组」，不是专名。
# 实测误报样本：「还有身后家族」（身前身后的普通说法）、「手里攥着的公会徽记」类。
# 专名修饰语是名词性的，不会带身体部位或方位词。
FAC_POS_SUB = re.compile(r"(?:身后|身前|面前|眼前|手头|头顶|心中|身侧|身上|手中|脚下|背后|旁边|面前|周边|附近|里头|当中)")
# v4.07.2 新增：前缀内部出现强介词/被动标记/数量词 → 那是「被修饰的普通词组」，不是专名。
# 实测误报样本：「刚才被几个大行会」（含「被」+「几个」）、「许多大帮派」（数量词）、
# 「三个大行会」（数词+量词）。专名修饰语是名词性的，不会含介词被动标记，也不会以数量词起头。
FAC_BAD_SUB = re.compile(
    r"(?:被|把|让|给|往|朝|据|刚才|方才|原本|此刻|此时|眼下|其中|其间|从此|自此"
    r"|带着|拿着|握着|揣着|背着|披着|留着|拖着|忍着|盯着|望着|盼着|求着|追着|赶着"
    r"|[0-9一二三四五六七八九十两百千万]+[个大位只条名所群家]"
    r"|几个|若干|许多|不少|大批|大量|众多|多方|无数|好几)")
# v4.07.2 新增：虚词出现在前缀**任意位置**即判定为普通词组。
# 实测误报样本：「胸口的公会」（衣襟上的徽章）、「这种老牌行会」「换个正经行会」
# 「你的行会」「随着行会」——全是被修饰的普通词组，不是编造的势力专名。
# 注意口径：单字虚词只收高置信子集。「由/用/为/以/和/与/从/向/到/在」等常用字会出现在
# 真实专名里（「自由公会」「和风盟」），不能进任意位置集，只能留在开头的 FAC_VAGUE_HEAD。
FAC_VAGUE_ANY = re.compile(
    r"(?:那个|这个|这些|那些|某个|某些|每个|所有|别的|其他|其它|这种|那种|哪个|哪些|这样|那样"
    r"|你的|我的|他的|她的|它的|我们的|他们的|正经|老牌|随着|换个|不少|许多|好多|几个"
    # 虚词短语（连词/副词/介词短语）——不可能是势力专名的修饰语
    r"|不仅|不但|不能|不可|可以|应该|想要|打算|需要|必须|能够|或许|也许|大概|可能|似乎|仿佛|好像"
    r"|能否|是否|多少|即使|哪怕|要是|如果|其实|当然|显然|的确|反正|另外|此外|关于|对于|按照|根据"
    r"|由于|因为|所以|于是|然后|接着|最后|拿到|得到|成为|变成"
    r"|[的这那哪你他她它被把让给向往朝够随换挺更很])")
# 判定器自检样本：收紧口径后必须仍然能抓住真缺陷
FAC_SAMPLES = [
    ("「灰烬同盟」行会", "灰烬同盟", True),
    ("「雪月工作室」公会", "雪月工作室", True),
    ("玩家自建「青竹会」", "青竹会", True),
    ("野狼谷外围", None, False),
    ("「开服合流」", None, False),
    ("够了不起行会", None, False),
    ("此刻没有行会", None, False),
    ("那个行会", None, False),
    ("从我行会", None, False),
    ("藏在中天某个行会", None, False),
    ("ID后缀确实带着东境月恒服的家族", None, False),
    # v4.07.2 新增：数量词/泛指前缀型误报（实测「刚才被几个大行会」被判成编造势力）
    ("刚才被几个大行会", None, False),
    ("许多大帮派", None, False),
    ("三个大行会", None, False),
    ("被大公会盯上", None, False),
    ("各方军团蠢蠢欲动", None, False),
    # v4.07.2 第二轮实测新增：虚词出现在前缀任意位置（定语 + 普通词组）
    ("胸口的公会", None, False),
    ("这种老牌行会", None, False),
    ("换个正经行会", None, False),
    ("你的行会", None, False),
    ("随着行会", None, False),
    ("不仅能拿到行会", None, False),
    ("明面上是盟", None, False),
    # 反向保护：常用字在真实专名里不能被误伤
    # （提取阶段应保留，是否合法由名单比对环节判定 —— 同「霜狼谷的白骨教团」）
    ("自由公会", "自由公会", True),
    ("和风盟", "和风盟", True),
    ("「铁血军团」", "铁血军团", True),
    # 「地点定语 + 专名」结构：提取阶段应保留（是否合法由名单比对环节判定，
    # in_list 的双向包含会让「霜狼谷的白骨教团」与名单里的「白骨教团」对上）
    ("霜狼谷的白骨教团", "霜狼谷的白骨教团", True),
]

# 自检用的合法地名样本：让「地名 + 的 + 专名」这条规则在自检里也能被验证
SELF_TEST_PLACES = ["霜狼谷", "野狼谷", "东境", "月恒服", "青竹村"]
BAD_HEAD = re.compile(r"^\s*(让我|玩家设定|根据设定|本章要点|分析一下|首先|作为|以下是|本章|好的，|请问|抱歉|作为AI)")
BAD_PUNCT = re.compile(r"[一-鿿]{111,}")
# v4.07.2 收紧：初版 LEAK 把正文里所有【…】都当泄漏，连「【叮！】」「【狼牙 x1】」
# 这种正常的游戏内提示也误报。只保留「确属内部协议」的标记。
LEAK = re.compile(r"(\(variable_update\)|\[variable_update\]|【variable_update】|数值契约|角色面板·本轮快照|【网游角色面板】|【网游面板】|角色面板·本轮快照)")
CROSS = ["萧炎", "石昊", "唐三", "叶凡", "林动", "牧尘", "楚风", "陈平安", "赵钱孙"]

# ── 深度旅程（wangyou：网游大世界全功能）────────────────────
DEEP = [
    ("open",      None,                         "我睁开眼，先打量四周。"),
    # v4.07.2 修 D-24（测试器自身致命缺陷）：原计划写成 ("skill","斩")，
    # 而 WorldExt.act 的签名是 (模块id, 动作id, 参数) —— 第一参传的是动作名，
    # 于是 act 去找名为「skill」的模块，找不到就静默 return。
    # 结果：13 步里 10 步的动作一个都没真执行（快照恒为 lv=1/gold=50/round=0 即为铁证），
    # AI 从未收到任何引擎结算，「结算回流」这项修复其实从未被真正验证过。
    # 修正：补上模块 id 'wr_rpg'，payload 改为引擎真实要求的格式
    # （skill=技能id / teleport=地图索引 / qaccept、qturnin=委托id），并支持动态占位符。
    ("combat",    [("wr_rpg", "skill", "slash")], "我拔剑，冲上去。"),
    ("quest",     [("wr_rpg", "qaccept", "@killOffer")], "我去接个活干。"),
    ("quest2",    [("wr_rpg", "skill", "slash")] * 5, "我按委托的要求做。"),
    ("turnin",    [("wr_rpg", "qturnin", "@active0")], "委托完成了，我去交差。"),
    ("loot",      [("wr_rpg", "loot", "")],        "看看刚才打出来的东西。"),
    ("travel",    [("wr_rpg", "teleport", "@map1")], "我动身，往别处去。"),
    ("faction",   [("wr_rpg", "guild", "found:灰烬同盟")], "我自建了个势力，看看现在什么状况。"),
    # v4.07.2：原动作 setclass=stargazer（观星者）在 Lv.1 必然被引擎锁住（需 Lv.18+200杀+200声望），
    # 测出来的是「锁定提示」而非「转职成功」，不是玩家真会走的路。
    # 改为两步：① 转职基础职业（可达，测成功路径）；② 试隐藏职业（测锁定提示是否清晰）。
    ("class",     [("wr_rpg", "setclass", "warrior")],   "我要正式转职，走剑士这条路。"),
    ("class2",    [("wr_rpg", "setclass", "stargazer")], "我听说观星者很厉害，想转过去。"),
    ("arena",     [("wr_rpg", "arena", "fight")],        "我去竞技场比试一场。"),
    ("shop",      [("wr_rpg", "buy", "hp")],             "我买点补给。"),
    ("rest",      [("wr_rpg", "rest", "")],              "我找个地方歇一歇。"),
]


def resolve_payload(spec, snap):
    """把动态占位符换成引擎真实需要的参数值。
    占位符来自动作前的真实快照——玩家看到什么按钮就点什么，不会凭空知道委托 id。"""
    if not isinstance(spec, str):
        return spec
    s = spec
    if s.startswith("@"):
        off = (snap or {}).get("offers") or []
        act = (snap or {}).get("active") or []
        if s == "@map1":
            return "1"
        if s == "@offer0":
            return off[0].get("id", "") if off else ""
        if s == "@killOffer":
            # 优先接「击杀」类委托：进度由打怪推进，测试路径最短且是玩家最常走的路
            for q in off:
                if q.get("k") == "kills":
                    return q.get("id", "")
            return off[0].get("id", "") if off else ""
        if s == "@active0":
            return act[0].get("id", "") if act else ""
    return s

# ── 广度旅程（每界通用三步）────────────────────────────────
GENERIC = [
    ("open",   None,   "我睁开眼，先打量四周。"),
    ("act",    None,   "我往前走一步，看看有什么。"),
    ("act2",   None,   "我四下留意，注意周围动静。"),
]

BOOT = """(g)=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《测试·'+(config.genreName||g)+'》',playerName:'我',gender:'男',age:18,
      background:'',identity:(pick(meta.identities)||{}).name||'普通人',identityDesc:'',
      timeline:(pick(meta.timelines)||{}).name||'',timelineDesc:'',
      region:(pick(meta.regions)||{}).name||'',regionDesc:'',
      aptitude:(pick(meta.aptitudes)||{}).name||'',aptitudeDesc:'',
      perspective:(pick(meta.perspectives)||{}).name||'',perspectiveDesc:'',
      style:(pick(meta.styles)||{}).name||'',styleDesc:'',
      scale:(pick(meta.lengths)||{}).name||'',scaleDesc:'',customScale:'',
      totalChapters:((pick(meta.lengths)||{}).chapters)||40,targetWords:0,
      entryEvent:'standard',customEntry:'',boons:[],techniques:[],customBoon:'',
      stats:{...(config.baseAttributes||{})}};
    fw.storyState.setup=setup; fw.storyState.isStoryStarted=true;
    fw.storyState.variables={title:setup.title,chapter:0,totalChapters:setup.totalChapters,wordCount:0,
      stats:{...setup.stats},
      characters:{'我':{role:setup.identity||'普通人',status:config.startRealm||'初入世界',firstAppearance:'入场事件',isPlayer:true}},
      foreshadowings:[],items:[],history:[]};
    (config.gauges||[]).forEach(x=>{fw.storyState.variables[x.key]=x.default!=null?x.default:50;});
    try{fw.saveStory&&fw.saveStory();}catch(e){}
    try{window.WorldExt&&window.WorldExt.onVars&&window.WorldExt.onVars(fw.storyState.variables,0);}catch(e){}
    return {ok:true};
  }catch(e){return {ok:false,err:String(e)};}
}"""

# 采集本界合法专名集（防幻觉基准）
COLLECT = """(g)=>{
  const out={places:[],factions:[],items:[],chars:[]};
  try{
    const A=window.ATLAS_DATA&&window.ATLAS_DATA[g];
    if(A) (A.layers||[]).forEach(L=>{(L.nodes||[]).forEach(n=>{
      out.places.push(n.n); (n.aliases||[]).forEach(x=>out.places.push(x));});});
  }catch(e){}
  try{
    const W=window.RPGCore&&window.RPGCore.WORLD&&window.RPGCore.WORLD[g];
    if(W){ (W.factions||[]).forEach(f=>out.factions.push(f.n||f));
           (W.monsters||[]).forEach(m=>out.items.push(m));
           (W.materials||[]).forEach(m=>out.items.push(m));
           (W.classes||[]).forEach(c=>out.items.push(c));
           (W.hidden||[]).forEach(c=>out.chars.push(c.n)); }
  }catch(e){}
  try{
    const N=window.KB_NAMES&&window.KB_NAMES[g];
    if(N){ (N.places||[]).forEach(x=>out.places.push(x));
            (N.factions||[]).forEach(x=>out.factions.push(x));
            (N.arts||[]).forEach(x=>out.items.push(x));
            (N.people||[]).forEach(x=>out.chars.push(x)); }
  }catch(e){}
  try{
    const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[];
    K.slice(0,4000).forEach(e=>{
      const t=String(e.title||''); const parts=t.split('·');
      const last=parts[parts.length-1]||'';
      if(parts.length>=3){ if(/人物|角色|NPC/i.test(parts[1])) out.chars.push(last); else out.places.push(last); }
    });
    /* v4.07.2 口径修正⑥：知识库正文里出现的势力专名同样是「合法设定」。
       此前合法池只取 KB_NAMES.factions，而那是一份人工精选的短名单，
       覆盖面不全 —— 实测 free 界「铁算盘商会」（见 js/kb/free.ext.js）、
       guzhenren 界「古月家族」（见 js/kb/guzhenren.core.js / world-seals.js）
       都在知识库里，却因不在短名单里被误判成「AI 编造势力」。
       这里补扫知识库正文，取「X+组织后缀」形态的专名作为合法基准。 */
    const FAC_RE=/([一-鿿A-Za-z0-9]{2,12}(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟))/g;
    K.slice(0,1200).forEach(e=>{
      const txt=String(e.title||'')+' '+String(e.content||'').slice(0,3000);
      let mm; FAC_RE.lastIndex=0;
      while((mm=FAC_RE.exec(txt))) if(mm[1]) out.factions.push(mm[1]);
    });
    /* v4.07.2 口径修正⑦（兜底）：把本界知识库正文整体带出去。
       名单抽取有覆盖盲区（KB 分批懒加载、条目形态各异），
       实测「铁算盘商会」正是 KB 条目标题，却因采集时 free 界 KB 尚未加载完而漏掉。
       判定时直接做「候选名是否出现在 KB 正文里」的子串检查，覆盖面最全、也最不易误判。 */
    let kb='';
    K.forEach(e=>{ kb += String(e.title||'')+' '+String(e.content||'')+'\\n'; });
    out.kbText=kb.slice(0,400000);
  }catch(e){}
  return out;
}"""

# 面板快照
SNAP = """()=>{
  const o={};
  try{
    const w=window.WorldExt&&window.WorldExt.modState&&window.WorldExt.modState('wr_rpg');
    const st=w&&w.state;
    if(st){ o.lv=st.lv; o.gold=st.gold; o.rep=st.rep; o.kills=st.kills; o.round=st.round;
            o.hp=st.hp; o.mp=st.mp; o.map=st.map; o.cls=st.cls; o.hidden=st.hidden; o.mode=st.mode;
            o.guild=(st.guild&&st.guild.name)||null;
            /* v4.07.2 修 D-28：把引擎真值接进判定器——经验条（exp/expNext）与金币流水。
               此前判定器只认「当前金币」与「委托进度」，于是正文里合法的历史收支
               （「你刚才花了 15 金币传送」）与经验条（「经验 4/62」）全被误判成编造。 */
            o.exp=st.exp; o.points=st.points;
            try{ o.expNext=(window.RPGCore&&window.RPGCore.Engine&&window.RPGCore.Engine.expToNext)?window.RPGCore.Engine.expToNext(st.lv):null; }catch(e){}
            /* v4.07.2 修 D-29：把「血条 / 蓝条 / 隐藏职业解锁门槛」也接进判定器真值。
               正文里写「气血 394/403」「需要 Lv.18 才能转职观星者」都是引擎真值，
               不是编造——此前判定器只认委托进度，于是把这些全判成假进度 / 假等级。 */
            try{ const d=(window.RPGCore&&window.RPGCore.Engine&&window.RPGCore.Engine.derive)?window.RPGCore.Engine.derive(st):null; o.hpMax=d&&d.maxHp; o.mpMax=d&&d.maxMp; }catch(e){}
            try{
              const gg=(new URLSearchParams(location.search).get('genre'))||'wangyou';
              const W=(window.RPGCore&&window.RPGCore.WORLD&&window.RPGCore.WORLD[gg])||null;
              o.hiddenLvs=((W&&W.hidden)||[]).map(function(h){return Number(h.lv)||0;}).filter(Boolean);
            }catch(e){}
            o.goldTrail=(st.goldTrail||[]).slice();
            o.worldDay=st.worldDay; o.worldTurn=st.worldTurn;
            o.offers=((st.quests&&st.quests.offers)||[]).map(q=>({id:q.id,t:q.title,g:q.gold,d:q.due,c:q.cur,n:q.need,p:q.place,k:q.t}));
            o.active=((st.quests&&st.quests.active)||[]).map(q=>({id:q.id,t:q.title,g:q.gold,d:q.due,c:q.cur,n:q.need,p:q.place,k:q.t}));
            o.questTitles=o.offers.concat(o.active).map(x=>x.t);
            o.questGolds=o.offers.concat(o.active).map(x=>x.g).filter(x=>x!=null);
            o.questDues=o.offers.concat(o.active).map(x=>x.d).filter(x=>x!=null);
          }
  }catch(e){ o.err=String(e); }
  try{ const s=window.WorldExt&&window.WorldExt.stripHTML&&window.WorldExt.stripHTML(); o.strip=(s&&s.length)||0; }catch(e){}
  return o;
}"""


def in_list(word, pool):
    if not word:
        return True
    for p in pool:
        if not p:
            continue
        if p == word or word in p or p in word:
            return True
    return False


def _de_prefix_is_place(pre, places):
    """「地名 + 的 + 专名」结构判定：若「的」前的那截是本界合法地名，
    则整个词组是正当的专名写法，不该因「的」被当成普通词组剔除。"""
    if not places:
        return False
    m = re.search(r"([^的]{2,10})的", pre or "")
    if not m:
        return False
    cand = m.group(1)
    for p in places:
        if not p:
            continue
        if cand == p or cand in p or p in cand:
            return True
    return False


def extract_factions(text, places=None):
    """提取正文中的势力名。judge 与自检共用同一套逻辑——
    两处各写一套是隐患：自检过了不代表 judge 的口径一致。
    places：本界合法地名名单。用于区分「地名 + 的 + 专名」（霜狼谷的白骨教团，正当）
    与「衣物 + 的 + 普通词」（胸口的公会，虚词修饰）——两者都含「的」，只能靠真值区分。"""
    fac = set(QUOTED_FAC.findall(text))
    fac |= {q for q in QUOTED.findall(text) if FAC_SUFFIX.fullmatch(q)}
    # 裸后缀词组：拆成「前缀 + 后缀」，前缀不像专名修饰语的直接剔除
    for _m in FAC_PARTS.finditer(text):
        fac.add(_m.group(0))
    fac |= set(PLAYER_FAC.findall(text))
    # 「定语+普通词」型误报剔除（如「够了不起行会」「此刻没有行会」「那个行会」「从我行会」
    #   以及 v4.07.2 新增的「刚才被几个大行会」「许多大帮派」「三个大行会」）：
    # 势力后缀前的定语部分若以虚词/动词/指示词收尾，或内部含强介词/数量词，
    # 说明那是被修饰的普通词组，不是专名。
    FAC_VERB_TAIL = re.compile(r"[了着过地得起开来去出上下完没有那个此从当被让使给对就都也很更最是为]$")
    out = set()
    for x in fac:
        # 真正的势力专名通常 2–6 字；超过 8 字基本是「定语+普通词」的句子片段
        if len(x) > 8:
            continue
        # 前缀 = 去掉势力后缀的部分
        pre = x
        for _s in ("工作室", "公会", "家族", "联盟", "行会", "商会", "帮派", "教团", "军团", "战队", "盟"):
            if pre.endswith(_s):
                pre = pre[:-len(_s)]
                break
        if len(x) > 4 and FAC_VERB_TAIL.search(pre[-2:]):
            continue
        # 前缀是指示词/介词/代词等虚词时，是普通词组而非专名（那个行会 / 从我行会）
        if FAC_VAGUE_HEAD.match(pre) or FAC_VAGUE_HEAD2.match(pre):
            continue
        # 前缀任意位置出现虚词 → 也是普通词组（胸口的公会 / 这种老牌行会 / 你的行会）
        # 例外：「地名 + 的 + 专名」是正当写法（霜狼谷的白骨教团），用地名名单真值区分
        if FAC_VAGUE_ANY.search(pre):
            if not _de_prefix_is_place(pre, places):
                continue
        # 前缀内部含强介词/被动标记/数量词 → 也是普通词组（刚才被几个大行会 / 许多大帮派）
        if FAC_BAD_SUB.search(pre):
            continue
        # 前缀含方位/部位修饰语 → 普通词组（还有身后家族）
        if FAC_POS_SUB.search(pre):
            continue
        # 前缀以连接词收尾且长度 > 1 → 普通词组（言灵代价与家族）。
        # 单字连接词前缀（和风盟 / 与天盟）是真实专名，放行。
        if len(pre) > 1 and re.search(r"(?:与|和|及|或|而|却|但|则|所|为)$", pre):
            continue
        out.add(x)
    return out


def judge_selftest():
    """判定器自检：口径收紧后必须仍然能抓住真编造势力名，且不误报普通词组。
    防止「为了让测试通过而放宽口径」——那是把问题藏起来，不是修问题。"""
    fails = []
    for text, expect, should_hit in FAC_SAMPLES:
        hit = extract_factions(text, SELF_TEST_PLACES)
        got = bool(hit)
        if should_hit:
            if not got:
                fails.append("漏报：%s → %s" % (text, expect))
            elif expect and expect not in hit:
                fails.append("截断：%s 期望 %s 实得 %s" % (text, expect, hit))
        else:
            if got:
                fails.append("误报：%s → %s" % (text, hit))
    # 金币正则：只认「数字+金币」，不吃「领口的」这类
    for t, want in [("出价 62 金币买首杀", True), ("行囊里有 1200 金币", True),
                    ("滴在领口的粗布衣襟", False), ("城南有座塔", False)]:
        got = bool(GOLD.search(t))
        if got != want:
            fails.append("金币正则：%s 期望 %s 实得 %s" % (t, want, got))
    # 地名口径：必须抓住「引号内的编造地名」，不得误报叙述泛称
    for t, want in [("他去了「霜狼谷」", True), ("那是「血月城」", True),
                    ("我站在原野上", False), ("转身便往村口走", False),
                    ("那边的深渊", False), ("或者是在黑市", False),
                    ("压下心头那丝关于「先知先觉」的冲突感", False)]:
        got = bool(GEO_QUOTED.findall(t))
        if got != want:
            fails.append("地名正则：%s 期望 %s 实得 %s" % (t, want, GEO_QUOTED.findall(t)))
    return fails


def judge(text, snap, names, genre):
    bad = {}
    if not text or len(text.strip()) < 20:
        bad["empty"] = True
        return bad, text
    if BAD_HEAD.match(text):
        bad["metaStart"] = text[:40]
    if BAD_PUNCT.search(text):
        bad["badPunct"] = True
    if LEAK.search(text):
        bad["directiveLeak"] = LEAK.search(text).group(0)[:40]
    # 玩家等级：只判与玩家相关的 Lv.（NPC 自述等级不算，见 PLAYER_LV 定义处说明）
    # 做法：逐个匹配点看它前面的主语是不是他人——是他人则跳过，不是则计入。
    other_pre = re.compile(r"(?:他|她|它|他们|她们|对方|那人|此人|老兵|守卫|队长|导师|敌人|怪物|野怪|对手|玩家|少女|少年|男人|女人|老人)[^。！\n]{0,10}$")
    lv = [int(x) for x in PLAYER_LV.findall(text)]
    for m in PLAYER_LV2.finditer(text):
        pre = text[max(0, m.start() - 14):m.start()]
        if other_pre.search(pre):
            continue          # 主语是他人，不算玩家等级
        lv.append(int(m.group(1) or m.group(2)))
    if snap.get("lv") is not None:
        # 合法等级 = 当前等级 ∪ 本界隐藏职业的解锁门槛（AI 如实复述「需要 Lv.18 才能转职观星者」不是编造）
        allowed_lv = {int(snap["lv"])} | {int(x) for x in (snap.get("hiddenLvs") or [])}
        f = [x for x in lv if x not in allowed_lv]
        if f:
            bad["fakeLevel"] = sorted(set(f))
    # 野怪被标注等级：违反提示词约束，单列一项（不与玩家等级混在一起）
    mon = ["%s(Lv.%s)" % (a, b) for a, b in MONSTER_LV.findall(text)]
    if mon:
        bad["monsterLevel"] = mon[:5]
    g = [int(x) for x in GOLD.findall(text)]
    if snap.get("gold") is not None:
        # 合法金币值 = 当前余额 ∪ 委托报酬 ∪ 引擎记录的金币流水（余额与变动额）
        allowed = {int(snap["gold"])} | {int(x) for x in (snap.get("questGolds") or [])}
        allowed |= {int(x) for x in (snap.get("goldTrail") or [])}
        f = [x for x in g if x not in allowed]
        if f:
            bad["fakeGold"] = f[:5]
    # 委托进度 cur/need 必须与在手委托一致
    if snap.get("active"):
        pairs = {(int(q["c"]), int(q["n"])) for q in snap["active"] if q.get("c") is not None}
        # v4.07.2 修 D-28：经验条「4/62」不是委托进度。
        # 用引擎真值（当前经验 / 升级所需）把它排除，而不是靠正则猜语境。
        if snap.get("exp") is not None and snap.get("expNext") is not None:
            pairs.add((int(snap["exp"]), int(snap["expNext"])))
        # 血条 / 蓝条也是「当前/上限」形态，正文写「气血 394/403」是引擎真值
        if snap.get("hp") is not None and snap.get("hpMax") is not None:
            pairs.add((int(snap["hp"]), int(snap["hpMax"])))
        if snap.get("mp") is not None and snap.get("mpMax") is not None:
            pairs.add((int(snap["mp"]), int(snap["mpMax"])))
        pr = [(int(a), int(b)) for a, b in PROG.findall(text)]
        f = [p for p in pr if p not in pairs and not (p[0] == 0 and p[1] == 0)]
        if f and pairs:
            bad["fakeProgress"] = f[:5]
    # 势力名：统一走 extract_factions（与自检同一套逻辑）
    # v4.07.2：传入本界合法地名名单，用于区分「地名+的+专名」与「衣物+的+普通词」
    fac = extract_factions(text, list(names.get("places") or []))
    pool = list(names.get("factions") or [])
    if snap.get("guild"):
        pool.append(snap["guild"])
    f = [x for x in fac if not in_list(x, pool) and x not in (names.get("kbText") or "")]
    if f:
        bad["unknownFaction"] = f[:5]
    # 地名（v4.07.2：只查引号内的地理专名，口径见 GEO_QUOTED 定义处说明）
    geo = set(GEO_QUOTED.findall(text))
    pl = list(names.get("places") or [])
    if snap.get("map"):
        pl.append(snap["map"])
    f = [x for x in geo if not in_list(x, pl)]
    if f:
        bad["unknownPlace"] = f[:5]
    # 跨作品专名
    cross = [x for x in CROSS if x in text and x not in (names.get("chars") or [])]
    if cross:
        bad["crossName"] = cross
    return bad, text


async def main():
    argv = sys.argv[1:]
    mode = argv[0] if argv else "all"
    genres = ALL_GENRES if mode == "all" else ([mode] if mode != "wangyou" else ["wangyou"])
    if mode == "wangyou":
        plan = DEEP
    else:
        plan = GENERIC
    print("模式 %s ｜ 界 %d ｜ 每界 %d 步 ｜ 预计请求 %d ｜ 间隔 %.1fs" % (
        mode, len(genres), len(plan), len(genres) * len(plan), GAP))
    # 判定器自检：口径收紧后必须仍然能抓住真编造势力名，且不误报普通词组。
    # 防止「为了让测试通过而放宽口径」——那是把问题藏起来，不是修问题。
    sf = judge_selftest()
    if sf:
        print("⚠ 判定器自检未通过：")
        for x in sf:
            print("   ", x)
        raise SystemExit(3)
    print("判定器自检：%d 条样本，全通过" % len(FAC_SAMPLES))
    issues = []
    results = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        pg = await ctx.new_page()
        perr = []
        pg.on("pageerror", lambda e: perr.append(str(e)[:160]))
        for gi, g in enumerate(genres):
            await pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
            await pg.wait_for_timeout(2500)
            boot = await pg.evaluate(BOOT, g)
            if not boot.get("ok"):
                issues.append({"genre": g, "step": "boot", "bad": {"boot": boot.get("err")}})
                continue
            await pg.evaluate("""({endpoint,key,model,maxTokens})=>{
              window.storyFramework=window.storyFramework||{};
              window.storyFramework.apiConfig={endpoint,apiKey:key,model,type:'openai',maxTokens:maxTokens,temperature:0.8};
              localStorage.setItem('yj_baseModelTier','small');
              if(window.BaseModelMode&&BaseModelMode.resetCache)BaseModelMode.resetCache();
            }""", {"endpoint": E, "key": K, "model": MODEL, "maxTokens": MAXTOK})
            # v4.08.0 修测试器自身缺陷（与 t_truthdiff.py 同源）：
            #   BaseModelMode.resetCache() → setTier() → saveApiConfig()，
            #   会把**当时的内存配置**持久化到 localStorage。
            #   若此刻配置尚未就位，空配置被写盘，之后 loadApiConfig() 读回仍是空，
            #   于是每一步都报「请先配置并保存 AI 接口」。
            #   修法：先写 localStorage + 内存，再 resetCache，顺序不可颠倒。
            await pg.evaluate("""({endpoint,key,model,maxTokens})=>{
              const cfg={endpoint,apiKey:key,model,type:'openai',maxTokens:maxTokens,temperature:0.8,stream:true};
              try{ localStorage.setItem('storyApiConfig', JSON.stringify(cfg)); }catch(e){}
              window.storyFramework.apiConfig=Object.assign({}, window.storyFramework.apiConfig||{}, cfg);
            }""", {"endpoint": E, "key": K, "model": MODEL, "maxTokens": MAXTOK})
            # 等模块就绪
            for _ in range(40):
                ok = await pg.evaluate("()=>{try{return !!(window.WorldExt&&window.WorldExt.hasModules&&window.WorldExt.hasModules());}catch(e){return false;}}")
                if ok:
                    break
                await pg.wait_for_timeout(400)
            names = await pg.evaluate(COLLECT, g)
            snap0 = await pg.evaluate(SNAP)
            for si, (sname, act, prompt) in enumerate(plan):
                if gi or si:
                    await asyncio.sleep(GAP)
                if act:
                    try:
                        # v4.07.2 修 D-24：动作必须带正确的模块 id，且参数要取引擎真实值。
                        # 原实现把「动作名」当模块 id 传（act("skill","斩")）→ 模块找不到 → 静默 return，
                        # 13 步里 10 步的动作一个都没真执行，全程零报错，还误以为「结算回流」已验证。
                        # 现在：① 动作前取真实快照解析占位符；② 逐个执行；③ 校验返回值——
                        # 返回空 = 动作没生效（actNoop）；返回「未找到模块」= 测试器自己传错了（actBadModule）。
                        pre = await pg.evaluate(SNAP)
                        acts = act if isinstance(act, list) else [act]
                        noops, badmods = [], []
                        for a in acts:
                            payload = resolve_payload(a[2] if len(a) > 2 else "", pre)
                            ret = await pg.evaluate(
                                """(m)=>{ try{ return {v: window.WorldExt.act(m[0],m[1],m[2])}; }catch(e){ return {err:String(e)}; } }""",
                                [a[0], a[1], payload])
                            if ret.get("err"):
                                raise RuntimeError(str(ret["err"])[:120])
                            v = ret.get("v")
                            if isinstance(v, str) and "未找到模块" in v:
                                badmods.append("%s/%s" % (a[0], a[1]))
                            elif v is None:
                                noops.append("%s/%s" % (a[0], a[1]))
                        if badmods:
                            issues.append({"genre": g, "step": sname, "bad": {"actBadModule": badmods}})
                            print("  %-18s %-9s ✗ 模块未找到 %s" % (g, sname, badmods))
                            continue
                        if noops:
                            # 不中断：继续跑完模型调用，好看清这一轮正文的完整表现
                            issues.append({"genre": g, "step": sname, "bad": {"actNoop": noops}})
                            print("  %-18s %-9s ! 动作未生效 %s" % (g, sname, noops))
                    except Exception as e:
                        issues.append({"genre": g, "step": sname, "bad": {"actCrash": str(e)[:120]}})
                        continue
                snap = await pg.evaluate(SNAP)
                try:
                    out = await asyncio.wait_for(pg.evaluate("""async(m)=>{try{const res=await callStoryAI(m,false,{});
                      const raw=String((res&&(res.content||res))||'');
                      /* v4.07.2：用户实际看到的是清洗后的正文，不是模型原始返回。
                         初版直接判 raw，把 (variable_update) 块与提示词残骸当成产品缺陷，
                         那是测试口径错了——真实渲染链路会经 StoryResponseHandler.extractBody 清洗。
                         现在同时取 raw 与 shown，缺陷判定一律以 shown 为准，raw 仅用于诊断。 */
                      let shown=raw;
                      try{ if(window.StoryResponseHandler&&window.StoryResponseHandler.extractBody) shown=String(window.StoryResponseHandler.extractBody(raw,{})||''); }catch(e){}
                      return {ok:true,t:shown,raw:raw,cleaned:(shown!==raw)};}catch(e){return {ok:false,err:String(e)}}}""", prompt), timeout=TIMEOUT)
                except Exception as e:
                    issues.append({"genre": g, "step": sname, "bad": {"timeout": type(e).__name__}})
                    print("  %-18s %-9s ✗ 超时" % (g, sname))
                    continue
                if not out.get("ok"):
                    issues.append({"genre": g, "step": sname, "bad": {"modelErr": out.get("err", "")[:120]}})
                    print("  %-18s %-9s ✗ 模型错误 %s" % (g, sname, str(out.get("err"))[:60]))
                    continue
                txt = out["t"]
                bad, _ = judge(txt, snap, names, g)
                # 面板异常
                for k in ("lv", "gold", "hp", "mp", "rep", "round"):
                    v = snap.get(k)
                    if isinstance(v, (int, float)) and (v != v or v < 0):
                        bad["panelNaN"] = "%s=%r" % (k, v)
                if bad:
                    issues.append({"genre": g, "step": sname, "bad": bad, "snap": {k: snap.get(k) for k in ("lv", "gold", "hp", "round", "mode", "guild")}})
                    print("  %-18s %-9s ✗ %s" % (g, sname, json.dumps(bad, ensure_ascii=False)[:160]))
                else:
                    print("  %-18s %-9s ✓ (%d字)" % (g, sname, len(txt)))
                results.append({"genre": g, "step": sname, "len": len(txt), "bad": bad})
                try:
                    # 落盘两份：shown=用户所见正文；raw=模型原始返回（仅供诊断泄漏）
                    io.open("/tmp/yj_journey_%s_%s.txt" % (g, sname), "w", encoding="utf-8").write(txt)
                    if out.get("raw") and out.get("raw") != txt:
                        io.open("/tmp/yj_journey_%s_%s.raw.txt" % (g, sname), "w", encoding="utf-8").write(out["raw"])
                except Exception:
                    pass
            if perr:
                issues.append({"genre": g, "step": "pageerror", "bad": {"pageerror": perr[:3]}})
                perr.clear()
    json.dump({"results": results, "issues": issues}, open("/tmp/yj_journey.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 汇总 ===")
    print("请求 %d ｜ 有问题 %d" % (len(results), len(issues)))
    from collections import Counter
    c = Counter()
    for x in issues:
        for k in x["bad"]:
            c[k] += 1
    print("问题分类:", dict(c))
    for x in issues[:60]:
        print(" ", x.get("genre"), x.get("step"), json.dumps(x.get("bad"), ensure_ascii=False)[:170])
    await b.close()


asyncio.run(main())
