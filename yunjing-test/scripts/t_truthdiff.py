#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.08.0 · 真值差分实测（真实模型玩家旅程）

与 v4.07.2 的 t_player.py 的关键差异：
  旧版判定：正文里的数值/专名 → 查**静态名单** → 不在即报幻觉
  本版判定：正文里的数值/专名 → 与**引擎真值快照差分**比对
             · 数值必须在「当前真值 ∪ 本轮差分 ∪ 历史真值」里
             · 专名必须在「静态名单 ∪ 运行时真值 ∪ 知识库全文」里
             · 跨轮次检测等级倒退 / 金币无依据跳变

判定器：truthdiff.py（零依赖纯 Python，26 条自检样本 + 17 项灵敏度反向验证）

硬约束：只用 agnes-3.0-flash（免费）；并发 = 1 严格串行；相邻请求间隔 ≥ 4s；
单界请求数上限可调；每次带超时；不调用生图/视频、不花钱。

用法：
  YJ_TEST_KEY=<key> python3 t_truthdiff.py wangyou        # 深度旅程（13 步）
  YJ_TEST_KEY=<key> python3 t_truthdiff.py all            # 全界广度
  YJ_TEST_KEY=<key> python3 t_truthdiff.py wangyou free   # 指定若干界
"""
import asyncio, glob, io, json, os, sys, time
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import truthdiff
from truthdiff import TruthJudge

E = os.environ.get("YJ_TEST_ENDPOINT", "https://apihub.agnes-ai.com/v1")
K = os.environ.get("YJ_TEST_KEY", "")
MODEL = "agnes-3.0-flash"
BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
GAP = float(os.environ.get("YJ_GAP", "4.0"))
TIMEOUT = int(os.environ.get("YJ_TIMEOUT", "180"))
MAXTOK = int(os.environ.get("YJ_MAXTOK", "420"))

if not K:
    print("⚠ 未设置 YJ_TEST_KEY（仓库内不存密钥）")
    raise SystemExit(2)

ALL_GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob("/workspace/yunjing/js/kb/*.core.js"))

# ── 页面侧：引擎真值快照 ─────────────────────────────────────
# 直接调用产品里的 TruthSnapshot 模块（js/truth-snapshot.js），
# 不在测试侧重写一份——否则两边口径会漂移，那正是本轮要消灭的问题。
SNAPSHOT = """()=>{
  try{
    if(!window.TruthSnapshot) return {err:'TruthSnapshot 未加载'};
    const s = window.TruthSnapshot.snapshot();
    return {v:s.v, genre:s.genre, slot:s.slot, flat:s.flat, nums:s.nums, modules:s.modules};
  }catch(e){ return {err:String(e)}; }
}"""

LEGAL = """(g)=>{
  try{
    if(!window.TruthSnapshot) return {err:'TruthSnapshot 未加载'};
    const L = window.TruthSnapshot.legalNames(g);
    /* 隐藏职业解锁门槛（正文可如实复述「需要 Lv.18 才能转职观星者」） */
    let hiddenLvs = [];
    try{
      const W=(window.RPGCore&&window.RPGCore.WORLD&&window.RPGCore.WORLD[g])||null;
      hiddenLvs=((W&&W.hidden)||[]).map(function(h){return Number(h.lv)||0;}).filter(Boolean);
    }catch(e){}
    /* 运行时真值单独成列，便于测试区分「静态名单」与「运行时真值」两条路径 */
    const RT = window.TruthSnapshot.collectRuntimeNames(g);
    return {
      places: L.places||[], factions: L.factions||[], people: L.people||[],
      items: L.items||[], titles: L.titles||[], kbText: L.kbText||'',
      runtimeFactions: RT.factions||[], runtimePlaces: RT.places||[],
      hiddenLvs: hiddenLvs
    };
  }catch(e){ return {err:String(e)}; }
}"""

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

# 深度旅程：动作要带**模块 id**，参数取引擎真实值（v4.07.2 的 D-24 教训）
DEEP = [
    ("open",      None,                          "我睁开眼，先打量四周。"),
    ("combat",    [("wr_rpg", "skill", "slash")], "我拔剑，冲上去。"),
    ("quest",     [("wr_rpg", "qaccept", "@killOffer")], "我去接个活干。"),
    ("quest2",    [("wr_rpg", "skill", "slash")] * 5, "我按委托的要求做。"),
    ("turnin",    [("wr_rpg", "qturnin", "@active0")], "委托完成了，我去交差。"),
    ("loot",      [("wr_rpg", "loot", "")],        "看看刚才打出来的东西。"),
    ("travel",    [("wr_rpg", "teleport", "@map1")], "我动身，往别处去。"),
    ("faction",   [("wr_rpg", "guild", "found:灰烬同盟")], "我自建了个势力，看看现在什么状况。"),
    ("class",     [("wr_rpg", "setclass", "warrior")],   "我要正式转职，走剑士这条路。"),
    ("class2",    [("wr_rpg", "setclass", "stargazer")], "我听说观星者很厉害，想转过去。"),
    ("arena",     [("wr_rpg", "arena", "fight")],        "我去竞技场比试一场。"),
    ("shop",      [("wr_rpg", "buy", "hp")],             "我买点补给。"),
    ("rest",      [("wr_rpg", "rest", "")],              "我找个地方歇一歇。"),
]
GENERIC = [
    ("open",   None,   "我睁开眼，先打量四周。"),
    ("act",    None,   "我往前走一步，看看有什么。"),
    ("act2",   None,   "我四下留意，注意周围动静。"),
]


def resolve_payload(spec, snap):
    if not isinstance(spec, str):
        return spec
    s = spec
    if s.startswith("@"):
        snap = snap or {}
        # v4.08.0 修 D-27 同类缺陷：此前 @active0 从合并的 quests[0] 取 id，
        # 那是「可接委托」第一条，qturnin 传过去必然报「没有这条进行中的委托」，
        # 交付动作从未真跑，模型在无结算依据下整段脑补报酬数字。
        # 现在严格分流：接委托只认 offers，交付只认 activeQuests。
        off = [q for q in (snap.get("questOffers") or snap.get("quests") or []) if isinstance(q, dict)]
        act = [q for q in (snap.get("activeQuests") or []) if isinstance(q, dict)]
        if s == "@map1":
            return "1"
        if s == "@killOffer":
            pool = snap.get("questOffers") or [q for q in off if q.get("id") not in {a.get("id") for a in act}]
            for q in pool:
                if "悬赏" in str(q.get("title", "")) or "kill" in str(q.get("id", "")):
                    return q.get("id", "")
            return pool[0].get("id", "") if pool else ""
        if s == "@active0":
            # 交付必须取「进行中委托」；若快照未提供该字段，退回旧口径但明确留痕
            return act[0].get("id", "") if act else ""
    return s


async def main():
    argv = sys.argv[1:]
    mode = argv[0] if argv else "all"
    if mode == "all":
        genres = ALL_GENRES
    else:
        genres = argv if argv else ["wangyou"]
    plan = DEEP if (mode == "wangyou" or (len(genres) == 1 and genres[0] == "wangyou")) else GENERIC

    print("模式 %s ｜ 界 %d ｜ 每界 %d 步 ｜ 预计请求 %d ｜ 间隔 %.1fs" % (
        mode, len(genres), len(plan), len(genres) * len(plan), GAP))
    # 判定器自检（口径自检，不是模型调用）
    sf = truthdiff.run_selftest()
    if sf:
        print("⚠ 判定器自检未通过：")
        for x in sf:
            print("   ", x)
        raise SystemExit(3)
    print("判定器自检：%d 条样本，全通过" % len(truthdiff.SELF_TEST))

    issues = []
    results = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        pg = await ctx.new_page()
        perr = []
        pg.on("pageerror", lambda e: perr.append(str(e)[:160]))
        for gi, g in enumerate(genres):
            judge = TruthJudge(g)
            try:
                await pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                issues.append({"genre": g, "step": "goto", "bad": {"goto": str(e)[:120]}})
                continue
            await pg.wait_for_timeout(2500)
            boot = await pg.evaluate(BOOT, g)
            if not boot.get("ok"):
                issues.append({"genre": g, "step": "boot", "bad": {"boot": boot.get("err")}})
                continue
            await pg.evaluate("""({endpoint,apiKey,model,maxTokens})=>{
              window.storyFramework=window.storyFramework||{};
              window.storyFramework.apiConfig={endpoint,apiKey,model,type:'openai',maxTokens:maxTokens,temperature:0.8};
              localStorage.setItem('yj_baseModelTier','small');
              if(window.BaseModelMode&&BaseModelMode.resetCache)BaseModelMode.resetCache();
            }""", {"endpoint": E, "apiKey": K, "model": MODEL, "maxTokens": MAXTOK})
            # v4.08.0 修测试器自身缺陷（v4.07.2 的 t_player.py 也有同一个坑）：
            #   BaseModelMode.resetCache() 内部会走 setTier → saveApiConfig()，
            #   把**当时的内存配置**写进 localStorage。若此刻配置还没设好，
            #   空配置就被持久化，后续 loadApiConfig() 读回来依然是空 →
            #   每一步都报「请先配置并保存 AI 接口」。
            # 修法：先落盘 + 落内存，再 resetCache（顺序不可颠倒），
            # 最后再写一次内存，确保任何异步重载都拿得到完整配置。
            await pg.evaluate("""({endpoint,apiKey,model,maxTokens})=>{
              const cfg={endpoint,apiKey,model,type:'openai',maxTokens:maxTokens,temperature:0.8,stream:true};
              try{ localStorage.setItem('storyApiConfig', JSON.stringify(cfg)); }catch(e){}
              window.storyFramework.apiConfig=Object.assign({}, window.storyFramework.apiConfig||{}, cfg);
            }""", {"endpoint": E, "apiKey": K, "model": MODEL, "maxTokens": MAXTOK})
            for _ in range(40):
                ok = await pg.evaluate("()=>{try{return !!(window.WorldExt&&window.WorldExt.hasModules&&window.WorldExt.hasModules());}catch(e){return false;}}")
                if ok:
                    break
                await pg.wait_for_timeout(400)
            # 等知识库加载稳定（分批懒加载，采集太早会漏条目）
            last, stable, kb = -1, 0, -1
            for _ in range(40):
                cur = await pg.evaluate("(g)=>{ const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[]; return K.length; }", g)
                kb2 = await pg.evaluate("(g)=>{ const K=(window.KB_PRESETS&&window.KB_PRESETS[g])||[]; return K.reduce((n,e)=>n+String(e.content||'').length,0); }", g)
                if cur == last and cur > 0 and kb2 == kb and kb2 > 0:
                    stable += 1
                    if stable >= 3:
                        break
                else:
                    stable = 0
                last, kb = cur, kb2
                await pg.wait_for_timeout(600)
            legal = await pg.evaluate(LEGAL, g)
            if legal.get("err"):
                issues.append({"genre": g, "step": "legal", "bad": {"legal": legal["err"]}})
                continue
            for si, (sname, act, prompt) in enumerate(plan):
                if gi or si:
                    await asyncio.sleep(GAP)
                # ── 动作执行前取快照（真值差分的「前」）──
                snap_pre = await pg.evaluate(SNAPSHOT)
                if act:
                    try:
                        acts = act if isinstance(act, list) else [act]
                        noops, badmods = [], []
                        for a in acts:
                            payload = resolve_payload(a[2] if len(a) > 2 else "", snap_pre.get("nums") or {})
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
                            print("  %-16s %-9s ✗ 模块未找到 %s" % (g, sname, badmods))
                            continue
                        if noops:
                            issues.append({"genre": g, "step": sname, "bad": {"actNoop": noops}})
                            print("  %-16s %-9s ! 动作未生效 %s" % (g, sname, noops))
                    except Exception as e:
                        issues.append({"genre": g, "step": sname, "bad": {"actCrash": str(e)[:120]}})
                        continue
                # ── 生成前再取一次快照（动作已执行，差分 = 本轮真值变化）──
                snap_pre = await pg.evaluate(SNAPSHOT)
                try:
                    out = await asyncio.wait_for(pg.evaluate("""async(m)=>{try{const res=await callStoryAI(m,false,{});
                      const raw=String((res&&(res.content||res))||'');
                      let shown=raw;
                      try{ if(window.StoryResponseHandler&&window.StoryResponseHandler.extractBody) shown=String(window.StoryResponseHandler.extractBody(raw,{})||''); }catch(e){}
                      return {ok:true,t:shown,raw:raw,cleaned:(shown!==raw)};}catch(e){return {ok:false,err:String(e)}}}""", prompt), timeout=TIMEOUT)
                except Exception as e:
                    issues.append({"genre": g, "step": sname, "bad": {"timeout": type(e).__name__}})
                    print("  %-16s %-9s ✗ 超时" % (g, sname))
                    continue
                if not out.get("ok"):
                    issues.append({"genre": g, "step": sname, "bad": {"modelErr": out.get("err", "")[:120]}})
                    print("  %-16s %-9s ✗ 模型错误 %s" % (g, sname, str(out.get("err"))[:60]))
                    continue
                # ── 生成后取快照（真值差分的「后」）──
                snap_post = await pg.evaluate(SNAPSHOT)
                # v4.08.0 修测试器自身缺陷：legal 在开篇采一次就用了整场，
                # 但**运行时真值是随玩法变化的**——玩家本轮刚自建的势力、
                # 刚接的委托、刚到的地点，开篇时根本不存在。
                # 于是「玩家真实行为」被误判成「AI 编造势力」。
                # 修法：每轮重新采集运行时真值（静态名单不变，不必重采）。
                legal = await pg.evaluate(LEGAL, g)
                if legal.get("err"):
                    legal = {"places": [], "factions": [], "people": [], "items": [],
                             "titles": [], "kbText": "", "runtimeFactions": [], "runtimePlaces": []}
                txt = out["t"]
                # 真值差分判定
                bad = judge.judge(txt, snap_pre, snap_post, legal)
                # 面板异常
                for k in ("lv", "gold", "hp", "mp", "rep", "round"):
                    v = (snap_post.get("nums") or {}).get(k)
                    if isinstance(v, (int, float)) and (v != v or v < 0):
                        bad["panelNaN"] = "%s=%r" % (k, v)
                if bad:
                    issues.append({"genre": g, "step": sname, "bad": bad,
                                   "snap": {k: (snap_post.get("nums") or {}).get(k)
                                            for k in ("lv", "gold", "hp", "round", "mode")}})
                    print("  %-16s %-9s ✗ %s" % (g, sname, json.dumps(bad, ensure_ascii=False)[:170]))
                else:
                    print("  %-16s %-9s ✓ (%d字)" % (g, sname, len(txt)))
                results.append({"genre": g, "step": sname, "len": len(txt), "bad": bad})
                # 记录本轮真值与主张，供下一轮做跨轮次倒退检测
                judge.commit(snap_post, txt)
                try:
                    io.open("/tmp/yj_td_%s_%s.txt" % (g, sname), "w", encoding="utf-8").write(txt)
                except Exception:
                    pass
            if perr:
                issues.append({"genre": g, "step": "pageerror", "bad": {"pageerror": perr[:3]}})
                perr.clear()
    json.dump({"results": results, "issues": issues},
              open("/tmp/yj_truthdiff.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 汇总 ===")
    print("请求 %d ｜ 有问题 %d" % (len(results), len(issues)))
    from collections import Counter
    c = Counter()
    for x in issues:
        for k in x["bad"]:
            c[k] += 1
    print("问题分类:", dict(c))
    for x in issues[:60]:
        print(" ", x.get("genre"), x.get("step"), json.dumps(x.get("bad"), ensure_ascii=False)[:180])
    await b.close()


asyncio.run(main())
