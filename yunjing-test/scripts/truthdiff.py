#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.08.0 · 真值差分判定器（truth-diff judge）

背景
----
v4.07.2 的判定器是**规则式**的：正文里出现一个地名/势力名/数值，就去一份**静态名单**
里查，没查到 → 报「幻觉」。这条路的结构性缺陷：

  ① 静态名单追不上运行时真值。玩家本轮刚自建「灰烬同盟」、刚接了委托、刚打出掉落物
     —— 这些此刻确实存在的东西不在名单里 → **误报**（把玩家真实行为当幻觉）。
  ② 静态名单含不全合法专名。知识库正文里写过的名字未必收录 → **误报**。
  ③ 单轮判定看不出**倒退**。上一轮正文说 Lv.3，这一轮引擎里仍是 Lv.3，
     正文却写 Lv.1 —— 这是幻觉，任何单轮快照都判不出来。

v4.08.0 升级为**真值差分校验**，三个维度同时判定：

  A. 引擎真值差分（truth diff）
     每轮取两张引擎快照（动作前 / 生成后），逐项相减得到「本轮真实发生的变化」。
     正文里的任何数值，必须能落在：
       · 当前真值（引擎此刻的真实数值）
       · 本轮差分（引擎真的变了这么多）
       · 历史真值（引擎曾经是这个数）
     三者之一。落不进去 → 编造。
     这比「查名单」强得多：玩家刚打的 87 金币在差分里，合法；凭空冒出的 9999 不在。

  B. 知识库全文合法名单（KB full-text）
     判定「专名是否合法」时，除静态名单外，还把**知识库全文**作为子串兜底
     （口径从「仅势力」扩展到「全部类别」），并额外纳入**运行时真值**
     （玩家自建势力 / 已接委托 / 当前地点 / 背包物品 / NPC 名）。

  C. 跨轮次一致性（cross-turn consistency）
     记录历轮正文里模型声称过的等级/金币/进度，与引擎真值逐轮比对：
       · 倒退（声称等级 < 引擎等级且无升级事件）→ 幻觉
       · 无依据跳变（声称金币 > 引擎金币且差分里没有这笔收入）→ 幻觉

用法
----
  from truthdiff import TruthJudge
  j = TruthJudge(genre)
  snap_a = j.snapshot()          # 动作前
  ... 生成正文 ...
  snap_b = j.snapshot()          # 生成后
  issues = j.judge(text, snap_a, snap_b)

零模型调用即可自检（见 t_truthdiff.py）。
"""
import json
import re

# ── 正则（口径继承 v4.07.2 已收紧的版本，不回退）───────────────
FAKE_LV = re.compile(r"Lv\.?\s*(\d+)")
PLAYER_LV = re.compile(r"(?:我|我方|主角|本人|自身)[^。！\n]{0,12}?Lv\.?\s*(\d+)")
PLAYER_LV2 = re.compile(r"(?:升至|升到|晋级|突破|转正|已经是|已是)\s*Lv\.?\s*(\d+)|Lv\.?\s*(\d+)\s*(?:了|啦)")
PLAYER_LV_OTHER = re.compile(
    r"(?:他|她|它|他们|她们|对方|那人|此人|老兵|守卫|队长|导师|NPC|敌人|怪物|野怪|对手)[^。！\n]{0,8}?Lv\.?\s*(\d+)")
# v4.08.0：玩家等级主张的**宽口径**提取。
# v4.07.2 的 PLAYER_LV 要求显式主语（我/我方/主角/本人/自身），
# 于是「你还是那个 Lv.3 的新手剑士」「我如今是 Lv.5」这类**省略主语**的
# 玩家自述被漏掉 —— 等级倒退因此判不出来（自检样本⑤即此例）。
# 口径修正：
#   ① 显式玩家主语（沿用 v4.07.2）
#   ② 叙述式升级（沿用 v4.07.2）
#   ③ **第二人称**（你/您）——正文对玩家说话时，Lv.N 指的就是玩家
#   ④ **零主语的玩家自述**：句子里出现「Lv.N」且其最近的第三人称主语不在前 12 字内
#      （即没有明确说是别人）
PLAYER_LV_WIDE = re.compile(r"(?:你|您)[^。！\n]{0,12}?Lv\.?\s*(\d+)")
# 明确是他人的主语：命中则该处 Lv.N 不算玩家等级
_OTHER_SUBJ = re.compile(
    r"(?:他|她|它|他们|她们|对方|那人|此人|老兵|守卫|队长|导师|NPC|敌人|怪物|野怪|对手|玩家|少女|少年|男人|女人|老人|弟子|门人|侍卫|侍者|商贩|摊主|掌柜)[^。！\n]{0,10}$")
MONSTER_LV = re.compile(r"[「『\"《【]([^」』\"》】]{1,10})[」』\"》]\s*[（(]\s*Lv\.?\s*(\d+)\s*[）)]")
# v4.08.0 修判定器自身缺陷：原 `\s*` 会跨换行，把装备面板里的
#   「攻击：+17\n金币奖励：+11」拼成「17 金币」→ 把攻击力加成误报成金币幻觉。
# 商品价/攻击加成与「金币」二字必须**同一行相邻**才算金币主张。
GOLD = re.compile(r"(?<![\d.])(\d{1,4})[ \t]*(?:枚|个|颗)?[ \t]*金币")
PROG = re.compile(r"(?<![\d.])(\d{1,4})\s*/\s*(\d{1,4})")
QUOTED = re.compile(r"[「『\"《]([^」』\"》]{2,16})[」』\"》]")
GEO_QUOTED = re.compile(
    r"[「『\"《]([^」』\"》]{2,12}?(?:村|城|镇|山|谷|林|塔|殿|宫|阁|海|河|原|岛|岭|域|界|道|街|坊|市|港|关|塞|窟|渊|墓|墟|滩|岸|峰|津|埠|坞|堡))[」』\"》]")
FAC_SUFFIX = re.compile(r"[一-鿿A-Za-z0-9]{2,14}(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
FAC_PARTS = re.compile(r"([一-鿿A-Za-z0-9]{2,14}?)(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
QUOTED_FAC = re.compile(
    r"[「『\"《]([一-鿿A-Za-z0-9]{2,14})[」』\"》]\s*(?:家族|公会|行会|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
PLAYER_FAC = re.compile(
    r"(?:自建|创立|创建|成立|建立|加入|自立|新建|招兵买马|拉起)\s*[了过]?\s*[「『\"《]([一-鿿A-Za-z0-9]{2,14})[」』\"》]")
FAC_VAGUE_HEAD = re.compile(
    r"^(?:那个|这个|这些|那些|某个|某些|每个|各|从|向|到|在|把|被|让|给|对|为|以|按|据|由|用|是|有|无|所有|别的|其他|其它|或|还|还有|再|才|只|都|更|最)")
FAC_VAGUE_HEAD2 = re.compile(r"^(?:跟|和|与)(?:我|你|他|她|它|那|这|某|各|每|别|其|众)")
FAC_POS_SUB = re.compile(
    r"(?:身后|身前|面前|眼前|手头|头顶|心中|身侧|身上|手中|脚下|背后|旁边|面前|周边|附近|里头|当中)")
FAC_BAD_SUB = re.compile(
    r"(?:被|把|让|给|往|朝|据|刚才|方才|原本|此刻|此时|眼下|其中|其间|从此|自此"
    r"|带着|拿着|握着|揣着|背着|披着|留着|拖着|忍着|盯着|望着|盼着|求着|追着|赶着"
    r"|[0-9一二三四五六七八九十两百千万]+[个大位只条名所群家]"
    r"|几个|若干|许多|不少|大批|大量|众多|多方|无数|好几)")
FAC_VAGUE_ANY = re.compile(
    r"(?:那个|这个|这些|那些|某个|某些|每个|所有|别的|其他|其它|这种|那种|哪个|哪些|这样|那样"
    r"|你的|我的|他的|她的|它的|我们的|他们的|正经|老牌|随着|换个|不少|许多|好多|几个"
    r"|不仅|不但|不能|不可|可以|应该|想要|打算|需要|必须|能够|或许|也许|大概|可能|似乎|仿佛|好像"
    r"|能否|是否|多少|即使|哪怕|要是|如果|其实|当然|显然|的确|反正|另外|此外|关于|对于|按照|根据"
    r"|由于|因为|所以|于是|然后|接着|最后|拿到|得到|成为|变成"
    # v4.08.0 新增：**存在性否定 / 量词短语**。
    # 实测误报样本：「没有任何行会的庇护意味着什么都得靠双手去挣」——
    # FAC_PARTS 抓到「没有任何行会」，前缀「没有任何」不在虚词表里，
    # 于是这个否定陈述被当成了编造的势力专名。
    # 否定/存在性词（没有任何/没有任何一个/没有/无/尚无/并无/不存在/未加入/暂未/从未）
    # 出现在专名前缀时，那一定不是专名。
    r"|没有任何|没有任何一个|没有|尚无|并无|不存在|未加入|暂未|从未|不曾|未曾在"
    # v4.08.0 实测误报（wangyou 深度旅程 class2/shop/arena 三步）：
    #   「代价：需分心助盟友一臂」→ FAC_PARTS 抓「需分心助盟」，前缀「需分心助」是动词短语；
    #   「那是…船工的标识，而非任何行会的徽记」→ 抓「而非任何行会」，前缀「而非任何」是连词短语。
    # 这两类都是**语法性短语**，不是专名。补进虚词表（只加组合词，不加单字，避免误杀真实势力名）。
    r"|需分心助|分心|一臂|而非|任何|绝非|并不|尚未|凡是|宁可|索性"
    r"|[的这那哪你他她它被把让给向往朝够随换挺更很])")

# v4.08.0 新增：**语义触发词表**。
# 上一版靠「后缀词法」识别势力——只认 家族/公会/行会/联盟/商会/帮派/教团/军团/工作室/战队/盟。
# 于是「寒鸦九司」「铁算盘商会以外的暗桩」这类**无标准后缀**的组织名压根进不了候选列表，
# 判定器连看都没看 → 结构性漏报（自检样本④正是此例）。
# 修法：加一层**语义触发**——引号内的专名若紧邻「成员身份词」（密探/会长/盟主/…），
# 它就是一个组织名候选，必须能在真值名单里找到。
# 这是「识别候选」与「判定合法性」两件事分开：
#   识别候选 = 形态（后缀）+ 语义（成员身份词）+ 句式（玩家自建）
#   判定合法性 = 静态名单 ∪ 运行时真值 ∪ 知识库全文
MEMBER_ROLE = (
    "密探|探子|探子头|眼线|暗桩|内应|成员|会员|会众|帮众|门人|弟子|门生|长老|执事|管事|"
    "会长|盟主|门主|教主|主教|堂主|舵主|帮主|首领|头领|掌门|宗主|族长|家主|城主|楼主|"
    "掌柜|账房|使者|客卿|供奉|护法|亲卫|卫队|护卫|精英|干部|高管|师兄|师姐|前辈"
)
# 「X的密探」「X的会长」形态：引号内名字 + 成员身份词
FAC_ROLE = re.compile(
    r"[「『\"《]([一-鿿A-Za-z0-9]{2,12})[」』\"》]\s*(?:的)?\s*(?:%s)" % MEMBER_ROLE)
# 「密探X」反向形态（身份词在前）：少见但存在
FAC_ROLE_PRE = re.compile(
    r"(?:%s)\s*[「『\"《]([一-鿿A-Za-z0-9]{2,12})[」』\"》]" % MEMBER_ROLE)
# 玩家自建句式（强约束：名字必须等于引擎里玩家自建的那个势力名）
PLAYER_FAC2 = re.compile(
    r"(?:自建|创立|创建|成立|建立|自立|新建|招兵买马|拉起|组建|组建起|打下)\s*[了过]?\s*"
    r"[「『\"《]([一-鿿A-Za-z0-9]{2,14})[」』\"》]")
BAD_HEAD = re.compile(r"^\s*(让我|玩家设定|根据设定|本章要点|分析一下|首先|作为|以下是|本章|好的，|请问|抱歉|作为AI)")
BAD_PUNCT = re.compile(r"[一-鿿]{111,}")
LEAK = re.compile(
    r"(\(variable_update\)|\[variable_update\]|【variable_update】|数值契约|角色面板·本轮快照|【网游角色面板】|【网游面板】)")
CROSS = ["萧炎", "石昊", "唐三", "叶凡", "林动", "牧尘", "楚风", "陈平安", "赵钱孙"]

# 金币 / 进度 的语境词——v4.08.0 新增：区分「金币」与别的量词
GOLD_CTX = re.compile(r"金币|金幣|金币数|钱袋|积蓄")


def _isField(key, name):
    """扁平表里的键是否指向字段 name。
    引擎数值在 flat 里的键是 "$gold" / "$lv"（collectEngineNumbers 用 "$" 前缀），
    模块状态里的字段是 "xxx.gold"。两种前缀都要认——
    v4.08.0 初版只判 ".gold" 结尾，于是差分分支**一条都匹配不到**，
    差分判定形同虚设（自检样本①的误报把它抓了出来）。"""
    if not key:
        return False
    if key == "$" + name:
        return True
    return key.endswith("." + name)


def _de_prefix_is_place(pre, places):
    """「地名 + 的 + 专名」结构：若「的」前那截是合法地名，整个词组是正当写法。"""
    if not places:
        return False
    m = re.search(r"([^的]{2,10})的", pre or "")
    if not m:
        return False
    cand = m.group(1)
    for p in places:
        if p and (cand == p or cand in p or p in cand):
            return True
    return False


def extract_factions(text, places=None):
    """提取正文中的势力名（口径与 v4.07.2 一致，不放宽也不收紧）。

    v4.08.0 新增两条识别路径（**识别候选**，不是判定合法性）：
      · FAC_ROLE     「X的密探」——引号内专名 + 成员身份词
      · FAC_ROLE_PRE 「密探X」——身份词在前
      · PLAYER_FAC2  「我自建了X」——玩家自建句式（强约束）
    没有标准后缀的专名（如「寒鸦九司」）靠后缀词法永远进不了候选，
    判定器连看都没看 —— 那是结构性漏报，不是口径宽窄问题。
    """
    fac = set(QUOTED_FAC.findall(text))
    fac |= {q for q in QUOTED.findall(text) if FAC_SUFFIX.fullmatch(q)}
    for _m in FAC_PARTS.finditer(text):
        fac.add(_m.group(0))
    fac |= set(PLAYER_FAC.findall(text))
    fac |= set(FAC_ROLE.findall(text))
    fac |= set(FAC_ROLE_PRE.findall(text))
    fac |= set(PLAYER_FAC2.findall(text))
    FAC_VERB_TAIL = re.compile(r"[了着过地得起开来去出上下完没有那个此从当被让使给对就都也很更最是为]$")
    out = set()
    for x in fac:
        if len(x) > 8:
            continue
        pre = x
        for _s in ("工作室", "公会", "家族", "联盟", "行会", "商会", "帮派", "教团", "军团", "战队", "盟"):
            if pre.endswith(_s):
                pre = pre[:-len(_s)]
                break
        # v4.08.0：成员身份词触发的候选**不做虚词剔除**——
        # 「寒鸦九司」的前缀「寒鸦九」不含虚词，「霜狼谷的白骨教团」经地名判定放行，
        # 但若前缀含虚词（如「这个的密探」），仍应剔除。用同样的规则但不误伤专名。
        role_triggered = bool(FAC_ROLE.fullmatch("「%s」的密探" % x) or
                              FAC_ROLE_PRE.fullmatch("密探「%s」" % x) or
                              PLAYER_FAC2.search("自建「%s」" % x))
        if len(x) > 4 and FAC_VERB_TAIL.search(pre[-2:]):
            continue
        if FAC_VAGUE_HEAD.match(pre) or FAC_VAGUE_HEAD2.match(pre):
            continue
        if FAC_VAGUE_ANY.search(pre):
            if not _de_prefix_is_place(pre, places):
                continue
        if FAC_BAD_SUB.search(pre):
            continue
        if FAC_POS_SUB.search(pre):
            continue
        if len(pre) > 1 and re.search(r"(?:与|和|及|或|而|却|但|则|所|为)$", pre):
            continue
        out.add(x)
    return out


class TruthJudge:
    """真值差分判定器。

    一个实例对应一次旅程（一个界）。judge() 每轮调用一次。
    """

    def __init__(self, genre):
        self.genre = genre
        # 历轮引擎真值（用于「历史真值」白名单与倒退检测）
        self._num_history = []   # [{lv,gold,rep,exp,...}]
        self._claims = []        # [{lv: [...], gold: [...], prog: [...]}]

    # ── A. 差分 ────────────────────────────────────────────────
    @staticmethod
    def diff(snap_a, snap_b):
        """两张引擎快照的差分。返回 {added, changed, removed}。"""
        a = (snap_a or {}).get("flat") or {}
        b = (snap_b or {}).get("flat") or {}
        added, changed, removed = {}, {}, {}
        for k, v in b.items():
            if k not in a:
                added[k] = v
                continue
            va = a[k]
            if isinstance(va, (int, float)) and isinstance(v, (int, float)) and not isinstance(va, bool):
                if va != v:
                    changed[k] = {"from": va, "to": v, "delta": v - va}
            elif str(va) != str(v):
                changed[k] = {"from": va, "to": v}
        for k, v in a.items():
            if k not in b:
                removed[k] = v
        return {"added": added, "changed": changed, "removed": removed}

    @staticmethod
    def _numeric_values(snap):
        """快照里所有数值（含数组内的数值），作为「历史真值」候选。"""
        vals = set()
        flat = (snap or {}).get("flat") or {}
        for v in flat.values():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                vals.add(int(v))
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, (int, float)) and not isinstance(x, bool):
                        vals.add(int(x))
                    elif isinstance(x, str):
                        for m in re.finditer(r"(?<![\d.])(\d{1,6})", x):
                            vals.add(int(m.group(1)))
        return vals

    # ── 数值白名单 ────────────────────────────────────────────
    def _gold_allow(self, snap_a, snap_b):
        """合法金币值 = 当前余额 ∪ 差分新增的余额/变动额 ∪ 历史余额 ∪ 委托报酬 ∪ 金币流水"""
        allow = set()
        for snap in (snap_a, snap_b):
            nums = (snap or {}).get("nums") or {}
            g = nums.get("gold")
            if isinstance(g, (int, float)):
                allow.add(int(g))
            for t in (nums.get("goldTrail") or []):
                if isinstance(t, (int, float)):
                    allow.add(int(t))
            for q in (nums.get("quests") or []):
                if isinstance(q, dict) and isinstance(q.get("gold"), (int, float)):
                    allow.add(int(q["gold"]))
        # 差分里的金币变化额
        d = self.diff(snap_a, snap_b)
        for k, ch in d["changed"].items():
            if _isField(k, "gold") and isinstance(ch.get("delta"), (int, float)):
                allow.add(int(abs(ch["delta"])))
                allow.add(int(ch["to"]))
        # 历史真值里的金币
        for h in self._num_history:
            if isinstance(h.get("gold"), (int, float)):
                allow.add(int(h["gold"]))
        return allow

    def _prog_pairs(self, snap_a, snap_b):
        """合法的「当前/上限」对：委托进度、经验条、血条、蓝条。
        v4.08.0 扩展：委托的 need 与 due 都算上限；任务完成度（cur==need）也算。"""
        pairs = set()
        for snap in (snap_a, snap_b):
            nums = (snap or {}).get("nums") or {}
            for q in (nums.get("quests") or []):
                if not isinstance(q, dict):
                    continue
                if isinstance(q.get("cur"), (int, float)) and isinstance(q.get("need"), (int, float)):
                    pairs.add((int(q["cur"]), int(q["need"])))
            der = nums.get("derived") or {}
            exp, expn = nums.get("exp"), der.get("expNext")
            if isinstance(exp, (int, float)) and isinstance(expn, (int, float)):
                pairs.add((int(exp), int(expn)))
            hp, hpm = nums.get("hp"), der.get("maxHp")
            if isinstance(hp, (int, float)) and isinstance(hpm, (int, float)):
                pairs.add((int(hp), int(hpm)))
            mp, mpm = nums.get("mp"), der.get("maxMp")
            if isinstance(mp, (int, float)) and isinstance(mpm, (int, float)):
                pairs.add((int(mp), int(mpm)))
            # v4.08.0 补 D-35 真值缺口：世界阶段（独立于 RPG 引擎的真值）
            # 「世界处于「开服合流」阶段（1/3）」会进正文，
            # 此前快照不采集它 → 判定器把合法的「1/3」当成编造进度（假阳性）。
            sg = nums.get("stage")
            if isinstance(sg, dict) and isinstance(sg.get("current"), (int, float)) \
                    and isinstance(sg.get("total"), (int, float)):
                pairs.add((int(sg["current"]), int(sg["total"])))
        return pairs

    # ── 正文主张解析 ──────────────────────────────────────────
    def _parse_claims(self, text):
        """解析正文里模型**声称**的数值（用于跨轮次一致性）。"""
        lv = []
        for m in PLAYER_LV.finditer(text):
            lv.append(int(m.group(1)))
        # v4.08.0：第二人称「你还是 Lv.3」——正文对玩家说话时 Lv.N 指玩家
        for m in PLAYER_LV_WIDE.finditer(text):
            lv.append(int(m.group(1)))
        for m in PLAYER_LV2.finditer(text):
            pre = text[max(0, m.start() - 14):m.start()]
            if _OTHER_SUBJ.search(pre):
                continue
            lv.append(int(m.group(1) or m.group(2)))
        # v4.08.0：零主语兜底——句中出现 Lv.N 且前面 12 字内无明确他人主语
        for m in FAKE_LV.finditer(text):
            pre = text[max(0, m.start() - 12):m.start()]
            if _OTHER_SUBJ.search(pre):
                continue
            if re.search(r"(?:我|你|您|主角|本人|自身)[^。！\n]{0,12}$", pre):
                continue   # 已被上面两条覆盖
            lv.append(int(m.group(1)))
        gold = [int(x) for x in GOLD.findall(text)]
        prog = [(int(a), int(b)) for a, b in PROG.findall(text)]
        return {"lv": lv, "gold": gold, "prog": prog}

    # ── B. 专名合法性 ─────────────────────────────────────────
    @staticmethod
    def _in_list(word, pool):
        if not word:
            return True
        for p in pool:
            if p and (p == word or word in p or p in word):
                return True
        return False

    def _legal_name(self, word, cat, legal):
        """专名合法性：
        ① 静态名单（地图/知识库/世界书/势力表）
        ② 运行时真值（玩家自建势力/已接委托/当前地点/背包/NPC）
        ③ 知识库全文子串兜底
        """
        pool = list(legal.get(cat) or [])
        if cat == "places":
            pool += list(legal.get("titles") or [])
        if self._in_list(word, pool):
            return True
        kb = legal.get("kbText") or ""
        if kb and word and word in kb:
            return True
        # 运行时真值单独再查一遍（名字可能不在分类里，如委托标题里的地名）
        if self._in_list(word, list(legal.get("places") or [])):
            return True
        if self._in_list(word, list(legal.get("factions") or [])):
            return True
        # v4.08.0：运行时真值**独立**字段。玩家自建势力属于运行时真值，
        # 它不该被塞进静态 factions 池（那会让「静态名单」不再静态，
        # 也让本模块的测试无法区分两条路径）。这里单列。
        if self._in_list(word, list(legal.get("runtimeFactions") or [])):
            return True
        if self._in_list(word, list(legal.get("runtimePlaces") or [])):
            return True
        return False

    # ── C. 跨轮次一致性 ───────────────────────────────────────
    def _cross_turn(self, text, snap_b, claims):
        """跨轮次一致性：检测正文声称值与引擎真值的倒退/无依据跳变。"""
        issues = {}
        nums = (snap_b or {}).get("nums") or {}
        real_lv = nums.get("lv")
        real_gold = nums.get("gold")
        if real_lv is not None:
            # 声称的等级若**低于**引擎等级，且引擎本轮没有升级痕迹 → 倒退
            for v in claims["lv"]:
                if v < int(real_lv):
                    issues.setdefault("levelRegression", []).append(
                        {"claimed": v, "engine": int(real_lv)})
        if real_gold is not None:
            for v in claims["gold"]:
                if v > int(real_gold):
                    # 声称比引擎余额还多：若历史余额里也没有这个数 → 无依据
                    hist = {int(h["gold"]) for h in self._num_history
                            if isinstance(h.get("gold"), (int, float))}
                    if v not in hist:
                        issues.setdefault("goldOverclaim", []).append(
                            {"claimed": v, "engine": int(real_gold)})
        return issues

    # ── 主判定 ────────────────────────────────────────────────
    def judge(self, text, snap_a, snap_b, legal=None):
        """判定一段正文。

        snap_a / snap_b : 引擎真值快照（动作前 / 生成后）
        legal            : 合法名表（由页面侧 TruthSnapshot.legalNames 提供）
        返回 {issueType: detail}
        """
        bad = {}
        legal = legal or {}
        if not text or len(text.strip()) < 20:
            bad["empty"] = True
            return bad

        if BAD_HEAD.match(text):
            bad["metaStart"] = text[:40]
        if BAD_PUNCT.search(text):
            bad["badPunct"] = True
        m = LEAK.search(text)
        if m:
            bad["directiveLeak"] = m.group(0)[:40]

        # v4.08.0 修 D-35（整段英文正文 · 玩家直接可见）：
        #   实测（wangyou 深度旅程 quest2 步）模型输出了一整段英文：
        #       "The current HP is 346/403. Before this hit, it was 362/403. …"
        #   正文必须中文，这是硬约束（格式契约第 1 条）。
        #   判定口径：英文**单词序列**（3 个及以上连续英文词）成段出现即判。
        #   单个英文专名/缩写（如 HP、MP、NPC、RPG、Lv）不误报。
        eng = re.findall(r"[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){2,}", text)
        if eng:
            bad["nonChineseBody"] = eng[0][:60]

        claims = self._parse_claims(text)

        # ── A. 等级：真值差分 ─────────────────────────────────
        real_lv = ((snap_b or {}).get("nums") or {}).get("lv")
        hidden_lvs = set()
        try:
            for h in ((legal.get("hiddenLvs")) or []):
                hidden_lvs.add(int(h))
        except Exception:
            pass
        if real_lv is not None:
            # 合法等级 = 当前等级 ∪ 本轮差分里出现过的等级 ∪ 历史等级 ∪ 隐藏职业门槛
            allow_lv = {int(real_lv)} | hidden_lvs
            d = self.diff(snap_a, snap_b)
            for k, ch in d["changed"].items():
                if _isField(k, "lv") and isinstance(ch.get("to"), (int, float)):
                    allow_lv.add(int(ch["to"]))
                if _isField(k, "lv") and isinstance(ch.get("from"), (int, float)):
                    allow_lv.add(int(ch["from"]))
            for h in self._num_history:
                if isinstance(h.get("lv"), (int, float)):
                    allow_lv.add(int(h["lv"]))
            # v4.08.0 语义分层（重要）：
            #   「正文写了一个从来不是玩家等级的数」→ fakeLevel（编造）
            #   「正文写的是玩家**曾经**有过的等级、现在倒退了」→ levelRegression（状态倒退）
            # 两者都判，但分开报——前者是凭空编造，后者是与引擎真值矛盾，
            # 修复方向完全不同（前者查提示词，后者查状态回流）。
            hist_lv = {int(h["lv"]) for h in self._num_history
                        if isinstance(h.get("lv"), (int, float))}
            f = [x for x in claims["lv"] if x not in allow_lv]
            reg = [x for x in claims["lv"]
                   if x in hist_lv and x < int(real_lv)]
            if reg:
                bad["levelRegression"] = [{"claimed": x, "engine": int(real_lv)} for x in sorted(set(reg))]
            f = [x for x in f if x not in set(reg)]
            if f:
                bad["fakeLevel"] = sorted(set(f))

        # 野怪被标注等级：违反提示词约束，单列一项
        mon = ["%s(Lv.%s)" % (a, b) for a, b in MONSTER_LV.findall(text)]
        if mon:
            bad["monsterLevel"] = mon[:5]

        # ── A. 金币：真值差分 ─────────────────────────────────
        if ((snap_b or {}).get("nums") or {}).get("gold") is not None:
            allow_gold = self._gold_allow(snap_a, snap_b)
            f = [x for x in claims["gold"] if x not in allow_gold]
            if f:
                bad["fakeGold"] = f[:5]

        # ── A. 进度对：真值差分 ───────────────────────────────
        # v4.08.0 修一处真漏洞：原口径是 `if pairs:` 才判——
        # 引擎此刻**没有任何委托**（pairs 为空）时，整段判定被跳过，
        # 于是正文凭空写出的「2/3」进度对永远不会被拦下。
        # 正确语义：pairs 为空 ≠ 免检，而是「本轮不存在任何合法的进度对」，
        # 因此正文里的任何进度对都是编造。改为始终判定。
        pairs = self._prog_pairs(snap_a, snap_b)
        pr = [(int(a), int(b)) for a, b in PROG.findall(text)]
        f = [p for p in pr if p not in pairs and not (p[0] == 0 and p[1] == 0)]
        if f:
            bad["fakeProgress"] = f[:5]

        # ── B. 专名合法性 ─────────────────────────────────────
        fac = extract_factions(text, list(legal.get("places") or []))
        f = [x for x in fac if not self._legal_name(x, "factions", legal)]
        if f:
            bad["unknownFaction"] = f[:5]

        geo = set(GEO_QUOTED.findall(text))
        f = [x for x in geo if not self._legal_name(x, "places", legal)]
        if f:
            bad["unknownPlace"] = f[:5]

        # ── 跨作品专名 ────────────────────────────────────────
        people = list(legal.get("people") or [])
        cross = [x for x in CROSS if x in text and x not in people]
        if cross:
            bad["crossName"] = cross

        return bad

    # ── 轮次记录（供下一轮做跨轮判定）────────────────────────
    def commit(self, snap_b, text):
        """把本轮引擎真值与正文主张记入历史，供下一轮做倒退检测。"""
        nums = (snap_b or {}).get("nums") or {}
        self._num_history.append({
            "lv": nums.get("lv"),
            "gold": nums.get("gold"),
            "exp": nums.get("exp"),
            "rep": nums.get("rep"),
        })
        if len(self._num_history) > 40:
            self._num_history.pop(0)
        self._claims.append(self._parse_claims(text or ""))
        if len(self._claims) > 40:
            self._claims.pop(0)

    def reset(self):
        self._num_history = []
        self._claims = []


# ── 判定器自检样本 ─────────────────────────────────────────────
# 每条 = (正文, 引擎真值, 期望命中的 issue 类型 or None)
# 期望 None = 不应命中任何 issue（防「为了通过而放宽口径」）
SELF_TEST = [
    # ① 差分放行：本轮真的掉了 87 金币 → 正文写 87 金币合法
    # v4.08.0 修正：**这条样本原先是无效样本**——正文写成「87 枚落进你掌心」，
    # 「金币」在数字之前，GOLD 正则（数字+金币相邻）压根不命中，
    # 于是差分分支从未被执行，灵敏度变异测不出来。
    # 教训与 v4.07.2 的 D-27 同类：测试跑了，但被测代码没真跑。
    # 现在数字与「金币」相邻，且正文明确指向本轮掉落。
    {
        "name": "本轮差分掉落金币合法",
        "text": "霜狼倒下时掉落的战利品里，87 金币落进你掌心，钱袋沉得坠手。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 137, "lv": 3}, "flat": {"$gold": 137, "$lv": 3}},
        "expect": None,
    },
    # ①-b 差分拦截：引擎差分是 +30（50→80），正文却写 87 → 必须判编造
    # 这条是「差分必须精确匹配」的强样本：87 既不是当前余额也不是差分额。
    {
        "name": "与差分不符的金币被判编造",
        "text": "霜狼倒下时掉落的战利品里，87 金币落进你掌心，钱袋沉得坠手。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 80, "lv": 3}, "flat": {"$gold": 80, "$lv": 3}},
        "expect": "fakeGold",
    },
    # ② 差分拦截：引擎没这笔钱 → 9999 编造
    {
        "name": "凭空金币被判编造",
        "text": "对方抛下 9999 金币的长袍，转身没入雾里，像什么都没发生过。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "fakeGold",
    },
    # ②-b GOLD 正则不得跨行（v4.08.0 判定器自身缺陷，灵敏度反向验证用）
    #   装备面板里「攻击：+17」换行后接「金币奖励：+11」，
    #   旧 \s* 会跨换行拼成「17 金币」→ 把攻击加成误报成金币幻觉。
    #   商品价/攻击加成与「金币」二字必须同一行相邻才算金币主张。
    {
        "name": "跨行数字不算金币主张",
        "text": "他把新剑掂了掂，剑身上刻着一行小字，转身走向铺子门口。\n攻击：+17\n金币奖励：+11（已自动入账）\n这把剑分量趁手，握在掌心沉甸甸的，够撑过新手谷的头几场硬仗。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": None,
    },
    # ②-b 历史金币：上一轮余额仍可被正文提及（「你刚才还有 300 金币」）
    #   撤掉历史金币分支必须被检出
    {
        "name": "历史金币放行",
        "text": "你想起方才袋里还有 300 金币，那是你攒了半年的家底。",
        "a": {"nums": {"gold": 120, "lv": 3}, "flat": {"$gold": 120, "$lv": 3}},
        "b": {"nums": {"gold": 120, "lv": 3}, "flat": {"$gold": 120, "$lv": 3}},
        "history": [{"lv": 3, "gold": 300}],
        "expect": None,
    },
    # ②-c 历史金币缺失时必须拦下
    {
        "name": "历史金币缺失被判幻觉",
        "text": "你想起方才袋里还有 300 金币，那是你攒了半年的家底。",
        "a": {"nums": {"gold": 120, "lv": 3}, "flat": {"$gold": 120, "$lv": 3}},
        "b": {"nums": {"gold": 120, "lv": 3}, "flat": {"$gold": 120, "$lv": 3}},
        "expect": "fakeGold",
    },
    # ③ 运行时真值放行：玩家自建势力必须合法
    {
        "name": "玩家自建势力合法",
        "text": "你拉起「灰烬同盟」不到三天，会众已经聚了三十余人。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": ["灰烬同盟"]},
        "expect": None,
    },
    # ③-c 运行时真值（分类之外）：玩家自建势力只出现在运行时真值里，
    #   静态名单与 KB 全文都没有它 —— 这条路径必须能放行
    {
        "name": "运行时真值独立放行",
        "text": "「玄夜司」的密探敲了三下梆子，提醒你宵禁已过。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        # 只放在 runtimeFactions（运行时真值），静态 factions 为空
        "legal": {"factions": [], "kbText": "", "runtimeFactions": ["玄夜司"]},
        "expect": None,
    },
    # ③-d 运行时真值（地名）：当前所在地点由引擎给出，正文提到它必须合法
    {
        "name": "运行时真值地名放行",
        "text": "你在「玄霜城」的西市转了半日，始终没找到那家铺子。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"places": [], "kbText": "", "runtimePlaces": ["玄霜城"]},
        "expect": None,
    },
    # ③-e 运行时真值地名缺失时必须拦下（撤掉 runtimePlaces 分支应被检出）
    {
        "name": "运行时地名缺失被判幻觉",
        "text": "你在「玄霜城」的西市转了半日，始终没找到那家铺子。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"places": [], "kbText": ""},
        "expect": "unknownPlace",
    },
    # ③-b 玩家自建句式：即使运行时真值里**没有**它，正文自称自建也仍需参与判定
    #   （这测的是 PLAYER_FAC2 这条识别路径本身）
    {
        "name": "自建句式识别路径生效",
        "text": "我组建起「霜牙同盟」，第一件事就是往北推进了三里地。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": [], "kbText": ""},
        "expect": "unknownFaction",
    },
    # ④ 编造势力：既不在名单也不在运行时真值
    {
        "name": "编造势力被判幻觉",
        "text": "「寒鸦九司」的密探就站在檐角，披风压得极低。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": ["灰烬同盟"], "kbText": ""},
        "expect": "unknownFaction",
    },
    # ⑤ 等级倒退（跨轮次）：引擎 Lv.5，正文写 Lv.3 → 倒退
    {
        "name": "等级倒退被判幻觉",
        "text": "你还是那个 Lv.3 的新手剑士，站在校场边上，看着同窗的背影，插不上话。",
        "a": {"nums": {"gold": 50, "lv": 5}, "flat": {"$gold": 50, "$lv": 5}},
        "b": {"nums": {"gold": 50, "lv": 5}, "flat": {"$gold": 50, "$lv": 5}},
        # 上一轮玩家还是 Lv.3（历史真值），这一轮引擎已升到 Lv.5，
        # 正文却退回 Lv.3 —— 是「状态倒退」，不是「凭空编造」。
        "history": [{"lv": 3, "gold": 50}],
        "expect": "levelRegression",
    },
    # ⑥ 等级一致：不报
    {
        "name": "等级一致不报",
        "text": "你如今是 Lv.5 的剑士，校场上再没人敢小看你。",
        "a": {"nums": {"gold": 50, "lv": 5}, "flat": {"$gold": 50, "$lv": 5}},
        "b": {"nums": {"gold": 50, "lv": 5}, "flat": {"$gold": 50, "$lv": 5}},
        "expect": None,
    },
    # ⑦ 进度对合法：经验条 = 引擎真值
    {
        "name": "经验条真值合法",
        "text": "状态栏上写着 4/62，那是这一身本事攒下的全部家当。",
        "a": {"nums": {"gold": 50, "lv": 3, "exp": 4}, "flat": {"$gold": 50, "$lv": 3, "$exp": 4}},
        "b": {"nums": {"gold": 50, "lv": 3, "exp": 4, "derived": {"expNext": 62}},
               "flat": {"$gold": 50, "$lv": 3, "$exp": 4}},
        "expect": None,
    },
    # ⑦-b 血条真值：气血 394/403 是引擎真值，不是编造
    {
        "name": "血条真值合法",
        "text": "气血 394/403，你咬着牙把最后半口气咽回喉咙里。",
        "a": {"nums": {"gold": 50, "lv": 3, "hp": 394}, "flat": {"$gold": 50, "$lv": 3, "$hp": 394}},
        "b": {"nums": {"gold": 50, "lv": 3, "hp": 394, "derived": {"maxHp": 403}},
               "flat": {"$gold": 50, "$lv": 3, "$hp": 394}},
        "expect": None,
    },
    # ⑦-c 血条真值缺失时必须拦下（撤掉 hp 分支应被检出）
    {
        "name": "假血条被判幻觉",
        "text": "气血 394/403，你咬着牙把最后半口气咽回喉咙里。",
        "a": {"nums": {"gold": 50, "lv": 3, "hp": 120}, "flat": {"$gold": 50, "$lv": 3, "$hp": 120}},
        "b": {"nums": {"gold": 50, "lv": 3, "hp": 120, "derived": {"maxHp": 260}},
               "flat": {"$gold": 50, "$lv": 3, "$hp": 120}},
        "expect": "fakeProgress",
    },
    # ⑧ 进度对编造
    {
        "name": "假进度被判幻觉",
        "text": "委托进度条停在 7/19，你盯着那串数字看了很久。",
        "a": {"nums": {"gold": 50, "lv": 3, "exp": 4}, "flat": {"$gold": 50, "$lv": 3, "$exp": 4}},
        "b": {"nums": {"gold": 50, "lv": 3, "exp": 4, "derived": {"expNext": 62}},
               "flat": {"$gold": 50, "$lv": 3, "$exp": 4}},
        "expect": "fakeProgress",
    },
    # ⑧-b 委托进度真值：在手委托的 cur/need 是引擎真值，正文可如实引用
    #   撤掉委托进度分支必须被检出
    {
        "name": "委托进度真值合法",
        "text": "悬赏的进度条推到 2/3，最后一头霜狼就卡在林子深处。",
        "a": {"nums": {"gold": 50, "lv": 3, "quests": [
            {"id": "q1", "title": "悬赏 · 缉拿霜狼", "cur": 2, "need": 3, "gold": 102}]},
            "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3, "quests": [
            {"id": "q1", "title": "悬赏 · 缉拿霜狼", "cur": 2, "need": 3, "gold": 102}]},
            "flat": {"$gold": 50, "$lv": 3}},
        "expect": None,
    },
    # ⑧-c 委托进度真值缺失时必须拦下
    {
        "name": "假委托进度被判幻觉",
        "text": "悬赏的进度条推到 2/3，最后一头霜狼就卡在林子深处。",
        "a": {"nums": {"gold": 50, "lv": 3, "quests": []}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3, "quests": []}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "fakeProgress",
    },
    # ⑧-d 世界阶段进度：合法真值（第 1/3 阶段）
    #   撤掉 stage 分支必须被检出
    #   注意正文必须真的含「N/M」形态，否则 PROG 不命中 → 样本无效
    #   （与 v4.08.0 修过的样本①同类陷阱）
    {
        "name": "世界阶段进度合法",
        "text": "世界还停在第 1/3 阶段，开服合流尚未结束，街上都是新面孔。",
        "a": {"nums": {"gold": 50, "lv": 3, "stage": {"current": 1, "total": 3}},
               "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3, "stage": {"current": 1, "total": 3}},
               "flat": {"$gold": 50, "$lv": 3}},
        "expect": None,
    },
    # ⑧-e 世界阶段真值缺失时必须拦下
    {
        "name": "假世界阶段被判幻觉",
        "text": "世界还停在第 1/3 阶段，开服合流尚未结束，街上都是新面孔。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "fakeProgress",
    },
    # ⑨ 知识库全文兜底：名字在 KB 正文里 → 合法
    {
        "name": "知识库全文兜底放行",
        "text": "「铁算盘商会」的老账房抬眼看了你一下，手里的算盘没停。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": [], "kbText": "自由世界有铁算盘商会，专做情报买卖。"},
        "expect": None,
    },
    # ⑩ 编造地名
    {
        "name": "编造地名被判幻觉",
        "text": "他一路向北，进了「血月城」的城门，风里有铁锈和干草的气味。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"places": ["霜狼谷"], "kbText": ""},
        "expect": "unknownPlace",
    },
    # ⑪ 编造等级（既不是当前也不是差分也不是历史）
    {
        "name": "编造等级被判幻觉",
        "text": "你一边啃着干粮，一边盘算何时能突破 Lv.88。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "fakeLevel",
    },
    # ⑫ 零主语等级主张：句中直接出现 Lv.N，无主语也无他人主语
    #   （测 FAKE_LV 兜底路径；撤掉它必须被检出）
    {
        "name": "零主语等级兜底生效",
        "text": "眼下是 Lv.31 的修为，离那个门槛还差着一整条山脉。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "fakeLevel",
    },
    # ⑬ 他人等级不误报：明确是「守卫 Lv.12」→ 不是玩家等级，不该报 fakeLevel
    {
        "name": "他人等级不误报",
        "text": "门口的守卫是 Lv.12，你默默记下这个数字，退回阴影里。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": None,
    },
    # ⑭ 跨作品专名：正文提到别部作品主角 → 幻觉
    #   撤掉 crossName 分支必须被检出
    {
        "name": "跨作品专名被判幻觉",
        "text": "你想起萧炎当年也是从这种地方一步步走上来的。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"people": []},
        "expect": "crossName",
    },
    # ⑭-b 本界确有同名人物时不该误报
    {
        "name": "本界同名人物不误报",
        "text": "你想起萧炎当年也是从这种地方一步步走上来的。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"people": ["萧炎"]},
        "expect": None,
    },
    # ⑮ 否定陈述里的势力后缀不是专名（v4.08.0 实测误报修正）
    #   「没有任何行会的庇护」里的「行会」是普通词组，不是编造的势力名
    {
        "name": "否定陈述不误报",
        "text": "在这个开服合流的敏感时期，没有任何行会的庇护意味着什么都得靠双手去挣。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": [], "kbText": ""},
        "expect": None,
    },
    # ⑯ 英文正文：模型整段输出英文（v4.08.0 实测缺陷 D-35）
    #   正文必须中文，出现成段英文即判缺陷
    {
        "name": "英文正文被判缺陷",
        "text": "The current HP is 346/403. Before this hit, it was 362/403. You swing again and the shield flickers.",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": "nonChineseBody",
    },
    # ⑯-b 正常中文正文不误报
    {
        "name": "中文正文不误报",
        "text": "这一击落下时，你的血只剩一线，气力几乎被抽空，盾牌的灵光也晃了一下。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "expect": None,
    },
    # ⑰ 动词/连词短语里的「盟」「行会」不是势力专名（v4.08.0 实测误报修正）
    #   wangyou 深度旅程 class2/shop/arena 三步各报了一次，均为判定器误报：
    #   「代价：需分心助盟友一臂」→「需分心助盟」
    #   「标识，而非任何行会的徽记」→「而非任何行会」
    {
        "name": "动词短语含盟字不误报",
        "text": "那个标签此刻在脑海中浮现：代价：需分心助盟友一臂，他一时拿不定主意。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": [], "kbText": ""},
        "expect": None,
    },
    {
        "name": "连词短语含行会不会误报",
        "text": "那身粗布短褐上挂着河水的湿汽，腰间铜牌是东境漕帮外围船工的标识，而非任何行会的徽记。",
        "a": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "b": {"nums": {"gold": 50, "lv": 3}, "flat": {"$gold": 50, "$lv": 3}},
        "legal": {"factions": [], "kbText": ""},
        "expect": None,
    },
]


def run_selftest():
    """判定器自检。返回失败列表（空 = 全通过）。"""
    fails = []
    for case in SELF_TEST:
        j = TruthJudge("selftest")
        legal = case.get("legal") or {}
        # 历史真值（跨轮次）：先注入，再判定
        for h in (case.get("history") or []):
            j._num_history.append(h)
        bad = j.judge(case["text"], case["a"], case["b"], legal)
        exp = case.get("expect")
        if exp is None:
            if bad:
                fails.append("误报：%s → %s" % (case["name"], json.dumps(bad, ensure_ascii=False)[:140]))
        else:
            if exp not in bad:
                fails.append("漏报：%s（期望 %s，实得 %s）" % (
                    case["name"], exp, json.dumps(bad, ensure_ascii=False)[:140]))
    return fails


if __name__ == "__main__":
    fs = run_selftest()
    if fs:
        print("⚠ 判定器自检未通过：")
        for f in fs:
            print("   ", f)
        raise SystemExit(3)
    print("判定器自检：%d 条样本，全通过" % len(SELF_TEST))
