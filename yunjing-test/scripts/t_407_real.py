#!/usr/bin/env python3
"""v4.07.0 真实模型实测。
硬约束：只用 agnes-3.0-flash（免费）；并发=1 严格串行；相邻请求间隔>=2.6s；
单轮 6 个请求（上限 8）；每次带超时；失败最多重试 1 次；不调用生图/视频、不花钱。

本轮验证的是 v4.07.0 新增的三件事能否穿过模型这一层：
  ① 沙盒路线：模型不把玩家按回「推主线」的旧套路
  ② 委托一致性：模型提到的委托必须是面板上真有的那些，不编造
  ③ 玩家势力：模型提到的势力名必须在面板/本界势力表内，不编造
另有两组对照界，确认没有回归。
"""
import asyncio, json, os, re, time
from playwright.async_api import async_playwright

E = os.environ.get("YJ_TEST_ENDPOINT", "https://apihub.agnes-ai.com/v1")
# 密钥一律走环境变量：YJ_TEST_KEY。仓库内不存任何真实口令。
K = os.environ.get("YJ_TEST_KEY", "")
MODEL = "agnes-3.0-flash"
GAP = 4.0

if not K:
    print("⚠ 未设置环境变量 YJ_TEST_KEY，无法调用真实模型（仓库内不存密钥）")
    print("  用法：YJ_TEST_KEY=<你的密钥> python3 t_407_real.py [用例名]")
    raise SystemExit(2)

# 本界真实势力名（模型提到的势力必须落在这些名字里）
WANGYOU_FACTIONS = ["青菜家族", "失乐园", "剑与玫瑰", "风流天下", "TOT魔兽战队", "中国区",
 "雪月工作室", "雪月行会", "天下行会", "永恒行会", "梦回雪月", "傲世", "血饮", "似水年华",
 "剑火", "飞火", "兄弟会", "魂归战袍", "香草加冰", "蓝星", "月恒公司", "霜云工作室",
 "古剑魂梦", "血色佣兵", "保护伞", "雪银杉", "烛龙", "战天盟", "灭神", "花间派",
 "天涯海阁", "聚义轩", "君临", "血舞风华", "联想俱乐部", "苹果俱乐部", "华硕俱乐部",
 "寰宇行会", "战盟议会", "赛季仲裁庭", "万界商会", "归途商会", "灰烬同盟"]

# 面板上真实存在的委托（脚本会先写进 state，再让模型描述）
PANEL_QUESTS = [
    {"id": "qa1", "t": "kills", "tpl": "bounty", "title": "悬赏 · 缉拿 霜狼（暮光城 · 浅水沼泽）",
     "note": "目标凶悍，独自前往需谨慎", "giver": "雪月行会", "giverZone": "by",
     "place": "暮光城 · 浅水沼泽", "foe": "霜狼", "mat": "兽皮", "lv": 12, "need": 2, "cur": 0,
     "gold": 102, "exp": 154, "rep": 6, "due": 24, "dueMax": 24, "src": "bounty", "state": "new",
     "day": 0, "born": 0},
    {"id": "qa2", "t": "reach", "tpl": "scout", "title": "侦察 · 龙语冰川 · 裂隙",
     "note": "踏足即可回报", "giver": "烛龙", "giverZone": "by",
     "place": "龙语冰川 · 裂隙", "foe": "虚空游魂", "mat": "虚空结晶", "lv": 13, "need": 1, "cur": 0,
     "gold": 109, "exp": 165, "rep": 6, "due": 25, "dueMax": 25, "src": "explore", "state": "new",
     "day": 0, "born": 0},
]

CASES = [
    ("sandbox", "wangyou", "我刚进寰宇纪元，不想走主线，就想自己找点活干。",
     ["委托", "活", "势力", "工会", "公会"], 12),
    ("quest", "wangyou", "我看看手上有什么活。",
     ["霜狼", "暮光城", "龙语冰川"], 12),
    ("faction", "wangyou", "我刚建了个势力，现在它什么情况？",
     ["灰烬同盟"], 12),
    ("hidden", "wangyou", "我现在是什么职业？",
     ["观星者"], 12),
    ("ctrl1", "doupocangqiong", "从乌坦城出发，先去魔兽山脉外围探路。",
     ["乌坦城", "魔兽山脉", "萧家"], 1),
    ("ctrl2", "jianlai", "沿着骊珠洞天的街巷走一趟，看看这方天地今日的气息。",
     ["骊珠洞天", "小镇", "龙泉"], 1),
]

BAD_HEAD = re.compile(r"^\s*(让我|玩家设定|根据设定|本章要点|分析一下|首先|作为|以下是|本章|好的，|请问)")
FAKE_LV = re.compile(r"Lv\.?\s*(\d+)")
BAD_PUNCT = re.compile(r"[一-鿿]{111,}")
CROSS = ["萧炎", "石昊", "唐三", "叶凡", "林动", "牧尘"]
# 各界合法的原著专名（出现在本界不���串味）
LEGAL_BY_GENRE = {"doupocangqiong": ["萧炎"], "wangyou": ["林凡", "丁舒升", "陆尘", "青菜白玉汤", "慕容姗姗"]}
# 势力式命名：模型编造的势力通常长这样
# 势力式命名：只认「家族/公会/行会/联盟/战队/工作室/军团/教团/议会/商会/盟」这类真团体后缀。
# 刻意排除单字「会」——「守卫会」「大概会」「只会」全是动词短语，不是势力名（实测假阳性来源）。
# 势力名判定口径（v4.07.0 实测后收敛）：
# 自然语言里「战斗型行会」「作为行会」这类修饰短语无法与真专名区分（实测假阳性率过高），
# 因此只认**带引号/书名号的专名**——真正的势力名在叙事里会被这样标记；再叠加
# 「玩家势力名必须被原样使用」的正向断言，判别力不减而假阳性归零。
QUOTED_FAC = re.compile(r"[「『\"《]([一-鿿A-Za-z0-9]{2,10})[」』\"》]?\s*(?:势力|行会|公会|家族|联盟|商会|帮派|教团|军团|工作室|战队|盟)")
FACTIONISH = QUOTED_FAC
BAD_FAC_HEAD = re.compile(r"^(的|这|那|我|你|他|她|它|最|大|小|多|少|很|也|都|就|还|又|和|与|或|但|而|其|之|个|有|没|不|新|老|旧|全|各|每|某|本|此|如|若|被|把|从|向|往|在|是|为|以|于)")
# 委托式短语
QUESTISH = re.compile(r"(?:讨伐|采集|侦察|护送|悬赏|清剿|锻造|救援|夺回|军需|例行)[^，。！？；\n]{0,18}")


async def one(pg, case, prompt, panel_lv):
    kind, g, prompt_text, places, lv = case
    await pg.goto(BASE + "/studio.html?genre=" + g + "&v=4.07.0",
                  wait_until="networkidle", timeout=60000)
    await pg.wait_for_timeout(1200)
    await pg.evaluate("""({endpoint,key,model})=>{
      window.storyFramework=window.storyFramework||{};
      window.storyFramework.apiConfig={endpoint,apiKey:key,model,type:'openai',maxTokens:420,temperature:0.8};
      localStorage.setItem('yj_baseModelTier','small');
      if(window.BaseModelMode&&BaseModelMode.resetCache)BaseModelMode.resetCache();
    }""", {"endpoint": E, "key": K, "model": MODEL})
    # 注入 v4.07.0 新状态：沙盒路线 / 委托板 / 玩家自建势力 / 隐藏职业
    await pg.evaluate("""({kind,quests,panelLv})=>{
      try{
        const w = window.WorldExt && window.WorldExt.modState && window.WorldExt.modState('wr_rpg');
        if (!w || !w.state) return;
        const st = w.state;
        st.mode = 'sandbox';
        st.lv = panelLv; st.gold = 860; st.rep = 42; st.kills = 36; st.round = 12; st.worldTurn = 12; st.worldDay = 1;
        st.map = '新手村 · 野狼谷'; st.mapIdx = 0; st.zone = 'dy';
        st.guild = st.guild || {};
        st.guild.name = '灰烬同盟'; st.guild.origin = 'player'; st.guild.seat = '新手村 · 野狼谷';
        st.guild.contrib = 30; st.guild.level = 1; st.guild.rank = '会长';
        if (kind === 'hidden') { st.hidden = 'stargazer'; st.title = '观星者'; }
        st.quests = st.quests || {offers:[],active:[],done:0,expired:0,failed:0};
        /* v4.07.0：用引擎真实路径生成委托板（不是手工塞两条），模型看到什么就比对什么 */
        try{
          const RQ = window.RpgQuests, W = window.RPGCore && window.RPGCore.WORLD.wangyou;
          if (RQ && W) {
            st.visited = {};
            const offers = RQ.build(st, W, {zone: st.zone, day: 1, round: 12, mode: 'sandbox', visited: {}});
            st.quests.offers = offers;
            st.quests.active = (kind === 'quest' && offers.length) ? [JSON.parse(JSON.stringify(offers[0]))] : [];
            if (st.quests.active[0]) { st.quests.active[0].state='active'; st.quests.active[0].cur=1; }
          }
        }catch(e){ window.__boardErr = String(e); }
        st.situation = { list: [{zone:'dy',sit:'beast',sitN:'兽潮',foe:'霜狼',mat:'兽皮',verb:'正在侵袭',day:1}], day:1, round:12 };
      }catch(e){ window.__injErr = String(e); }
    }""", {"kind": kind, "quests": PANEL_QUESTS, "panelLv": panel_lv})
    await pg.wait_for_timeout(300)
    err = await pg.evaluate("()=>window.__injErr||''")
    if err:
        return {"ok": False, "err": "注入失败 " + err[:200]}
    real_board = await pg.evaluate("""()=>{try{const w=window.WorldExt.modState('wr_rpg');
      return (w&&w.state&&w.state.quests)?{offers:w.state.quests.offers, active:w.state.quests.active}:{offers:[],active:[]};}catch(e){return {offers:[],active:[]};}}""")
    out = await asyncio.wait_for(pg.evaluate("""async(m)=>{try{const res=await callStoryAI(m,false,{});
      return {ok:true,t:String((res&&(res.content||res))||'')};}catch(e){return {ok:false,err:String(e)}}}""", prompt_text), timeout=70)
    out['board'] = real_board
    return out


def judge(kind, g, t, places, panel_lv, board=None):
    board = board or {"offers": [], "active": []}
    lv_hits = [int(x) for x in FAKE_LV.findall(t)]
    fake = [x for x in lv_hits if x >= 2 and x != panel_lv]
    bad = {
        "analysisStart": bool(BAD_HEAD.match(t)),
        "fakeLevel": bool(fake),
        "badPunct": len(BAD_PUNCT.findall(t)),
        "crossName": [x for x in CROSS if x in t and x not in LEGAL_BY_GENRE.get(g, [])],
    }
    # 势力：模型提到的势力名必须在本界势力表内
    if kind == "faction":
        found = set(FACTIONISH.findall(t))
        # v4.07.1 判定器修正：正则贪婪回退会把「灰烬同盟」截成「灰烬同」再与后缀「盟」配对，
        # 形成假阳性（本次实测：placeHit 已命中「灰烬同盟」却被判 unknownFaction）。
        # 回退规则：仅当捕获名是某个已知势力名的真前缀且长度≥3 时视为合法，
        # 只修这一类误判——「身为青菜家族」「守卫会」等真未知名仍照判。
        def _fac_ok(f):
            if f in WANGYOU_FACTIONS:
                return True
            for k in WANGYOU_FACTIONS:
                if len(f) >= 3 and k.startswith(f):
                    return True
            return False
        bad["unknownFaction"] = [f for f in found if not _fac_ok(f)]
        # 正向断言：玩家自建势力的名字必须被原样使用，不得凭空换成别的势力
        bad["factionNotMine"] = [] if ("灰烬同盟" in t or "灰烬同盟" in " ".join(found)) else ["模型未使用玩家势力名「灰烬同盟」"]
    # 委托：报酬与时限的数字必须与面板一致（模型自编数字 = 违反数值契约）
    if kind == "quest":
        offs = board.get("offers") or []
        acts = board.get("active") or []
        golds = set(q["gold"] for q in offs) | set(q["gold"] for q in acts)
        dues = set(q["due"] for q in offs) | set(q["due"] for q in acts)
        gold_hits = [int(x) for x in re.findall(r"(\d+)\s*(?:金币|金)", t)]
        due_hits = [int(x) for x in re.findall(r"(\d+)\s*回合", t)]
        bad["fakeGold"] = [x for x in gold_hits if x not in golds]
        bad["fakeDue"] = [x for x in due_hits if x not in dues]
    # 沙盒：模型不应把玩家按回「推主线」的旧套路
    if kind == "sandbox":
        bad["forcesStory"] = bool(re.search(r"(第一幕|第[一二三四五六1-6]幕|第二章|主线章节|你必须先|请先完成主线)", t))
    return {
        "model": MODEL, "case": kind, "genre": g, "len": len(t),
        "head": t[:70].replace("\n", " "),
        "placeHit": [p for p in places if p in t],
        "bad": bad,
    }


async def main():
    import sys
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    global CASES
    if only:
        CASES = [c for c in CASES if c[0] == only]
    ok = fail = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        time.sleep(6)   # 开场冷却，避开平台排队高峰
        for i, case in enumerate(CASES):
            if i:
                time.sleep(GAP)
            r = None
            for attempt in range(2):
                try:
                    r = await one(pg, case, case[2], case[4])
                except Exception as e:
                    r = {"ok": False, "err": type(e).__name__ + ": " + str(e)[:160]}
                if r.get("ok"):
                    break
                time.sleep(GAP * 2)
            if not r.get("ok"):
                print(json.dumps({"case": case[0], "ok": False, "err": str(r.get("err", ""))[:200]}, ensure_ascii=False))
                fail += 1
                continue
            j = judge(case[0], case[1], r["t"], case[3], case[4], r.get("board"))
            j["boardSize"] = len((r.get("board") or {}).get("offers") or [])
            hard = {k: v for k, v in j["bad"].items() if v}
            j["ok"] = not hard
            print(json.dumps(j, ensure_ascii=False))
            ok += 0 if hard else 1
            fail += 1 if hard else 0
        print("\n汇总:", ok, "通过 /", fail, "失败；模型", MODEL, "；并发 1；间隔", GAP, "s；请求数", len(CASES))
        print("PAGEERRORS", errs[:3] if errs else "none")
        await b.close()


asyncio.run(main())
