#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.07.2 · 功能全量探测（不调模型，纯功能层）
对 38 界逐界探测所有可用模块的每个动作：
  · 动作是否抛错 / 返回异常类型
  · 动作后模块状态是否出现 NaN / 负数 / 非法值
  · 动作是否为「死按钮」（既无提示也无任何状态变化）
输出：/tmp/func_probe.json + 控制台摘要
"""
import asyncio, glob, json, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/func_probe.json"

GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob("/workspace/yunjing/js/kb/*.core.js"))

# 通用 20 模块 + 各界专属
GEN_MODS = json.load(open("/tmp/mod_actions.json", encoding="utf-8"))
GEN_MODS["wr_rpg"] = ["skill", "rest", "loot", "teleport", "qaccept", "qturnin", "qgiveup",
                      "guild", "setclass", "mode", "enhance", "buy", "sell", "equipbag",
                      "usepotion", "arena", "party", "pet", "buff", "addpoint", "questclaim",
                      "achieveclaim", "clearlog", "tick"]
EXTRA = {
    "dibao": ["palacecompass"],
    "free": ["grudges", "jobs", "homebase", "forces"],
    "freeworld": ["code", "gauges", "factions"],
    "guimi": ["wr_occult", "divine", "sight", "record", "wr_case", "file", "walk"],
    "jianlai": ["wr_study", "recite", "copy", "note", "wr_fist", "walk", "pile", "spar"],
    "quanqiubingfeng": ["frost", "armor_door", "geo_heat", "backup_power", "water_purify",
                        "granary", "medical_room", "watchtower", "secret_tunnel", "haven",
                        "void", "oracle", "neighbor"],
    "wangyou": ["wr_patch_wangyou"],
}
# 专属模块的动作 id：v4.07.2 起不再从 ext 文件正则猜——运行时 moduleList() 会给出
# 每个模块真实的 actions 列表。这里保留 EXTRA 仅作「该界应有哪些专属模块」的对照表，
# 便于核验 moduleList 是否漏挂。
EXTRA = {
    "dibao": ["palacecompass"],
    "free": ["grudges", "jobs", "homebase", "forces"],
    "freeworld": ["code", "gauges", "factions"],
    "guimi": ["wr_occult", "divine", "sight", "record", "wr_case", "file", "walk"],
    "jianlai": ["wr_study", "recite", "copy", "note", "wr_fist", "walk", "pile", "spar"],
    "quanqiubingfeng": ["frost", "armor_door", "geo_heat", "backup_power", "water_purify",
                        "granary", "medical_room", "watchtower", "secret_tunnel", "haven",
                        "void", "oracle", "neighbor"],
    "wangyou": ["wr_patch_wangyou"],
}

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

BAD_NUM = re.compile(r'(?<![\w.])(NaN|Infinity|-Infinity)(?![\w])')
# 探测用参数：文本型动作（control:"text"）必须带值才能生效，
# 否则必然「无提示无变化」，被判成死按钮——那是探测方法的错，不是产品的错。
PROBE_ARG = "测试甲=乙"
# RPG 动作的合法参数（从 rpg-core.js 的 data-rpg-act 导出一致）
RPG_ARG = {"buy": "hp", "teleport": "1", "skill": "slash", "setclass": "warrior",
           "guild": "found:测试公会", "arena": "fight", "enhance": "0", "equipbag": "",
           "usepotion": "hp", "party": "", "pet": "", "addpoint": "str",
           "mode": "sandbox", "qaccept": "", "qturnin": "", "qgiveup": ""}


async def main():
    report = {"genres": {}, "issues": []}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        for g in GENRES:
            errs.clear()
            try:
                await pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(2500)
                boot = await pg.evaluate(BOOT, g)
                if not boot.get("ok"):
                    report["issues"].append({"genre": g, "type": "boot", "detail": boot.get("err")})
                    continue
                # 等模块注入就绪（懒加载 + YJWait 轮询，最多 30s）
                # v4.07.2：改用 WorldExt.moduleList() 读真实清单。
                # 原实现靠正则从 ext 文件里猜模块 id，而各 ext 的 id 写法不一
                # （单引号 id: 'spacetime' / 双引号 id: "wr_patch_wangyou"），
                # 正则只认双引号 → 34 界被误报成「0 模块」，真实覆盖根本没测到。
                ready = False
                mods = []
                for _ in range(60):
                    mods = await pg.evaluate("""()=>{
                      try{
                        if(!(window.WorldExt&&window.WorldExt.moduleList)) return [];
                        return window.WorldExt.moduleList()||[];
                      }catch(e){ return []; }
                    }""")
                    if mods:
                        ready = True
                        break
                    await pg.wait_for_timeout(500)
                await pg.wait_for_timeout(600)
                available = [m.get("id") for m in mods if m.get("id")]
                ginfo = {"modules": available, "ready": ready, "actions": 0, "dead": [], "badstate": [], "throws": [],
                         "noAction": []}
                # v4.07.2 动作发现改为「读真实面板 HTML」：
                # 34 个 ext 模块不声明 actions，交互全写在 html 的 onclick / data-act 里；
                # 只看 actions 会把这些界判成「0 动作」，等于根本没测。
                # 现在渲染 panelHTML，解析出全部真实可点动作，逐个调用——走的就是用户路径。
                acts_map = await pg.evaluate("""()=>{
                  const W=window.WorldExt;
                  const out={};
                  try{
                    /* v4.07.2：必须先把面板真正渲染进 DOM 再解析。
                       custom/gear 这类动作靠读输入框取值（document.getElementById('pkCvKey') 等），
                       面板不渲染就没有输入框，探测必然「无提示无变化」——那是探测环境不对，不是产品坏。 */
                    let host=document.getElementById('immBody');
                    if(!host){ host=document.createElement('div'); host.id='immBody'; document.body.appendChild(host); }
                    host.dataset.wxTab='1';
                    host.innerHTML=W.panelHTML?String(W.panelHTML()||''):'';
                    const html=host.innerHTML;
                    // ① onclick="WorldExt.act('mod','act',...)"
                    const re1=/WorldExt\\.act\\(\\s*'([^']+)'\\s*,\\s*'([^']+)'/g;
                    let m;
                    while((m=re1.exec(html))){ (out[m[1]]=out[m[1]]||[]); if(out[m[1]].indexOf(m[2])<0) out[m[1]].push(m[2]); }
                    // ② data-mod="mod" data-act="act"
                    const re2=/data-mod="([^"]+)"[^>]*data-act="([^"]+)"/g;
                    while((m=re2.exec(html))){ (out[m[1]]=out[m[1]]||[]); if(out[m[1]].indexOf(m[2])<0) out[m[1]].push(m[2]); }
                    // ②b data-rpg-act（网游大世界 RPG 面板专用）
                    const re2b=/data-rpg-act="([^"]+)"/g;
                    while((m=re2b.exec(html))){ (out['wr_rpg']=out['wr_rpg']||[]); if(out['wr_rpg'].indexOf(m[1])<0) out['wr_rpg'].push(m[1]); }
                    // ③ 模块自报 actions
                    const ml=W.moduleList?W.moduleList():[];
                    for(const x of ml){ if(x.actions&&x.actions.length){ out[x.id]=out[x.id]||[]; for(const a of x.actions){ if(out[x.id].indexOf(a)<0) out[x.id].push(a); } } }
                  }catch(e){}
                  return out;
                }""")
                modmap = {m.get("id"): m for m in mods}
                for mid in available:
                    acts = list(acts_map.get(mid) or [])
                    # 通用动作表补充（仅当面板里没解析出时才用）
                    if not acts:
                        acts = [a for a in GEN_MODS.get(mid, []) if a]
                    if not acts:
                        ginfo["noAction"].append(mid)
                        continue
                    for aid in acts:
                        r = await pg.evaluate("""(m)=>{
                          const W=window.WorldExt;
                          // 真实用户会先填输入框；不填，custom/gear 这类「读输入框取值」的动作必然失败。
                          try{
                            const set=(id,v)=>{const el=document.getElementById(id); if(el){el.value=v;}};
                            set('pkCvKey','测试字段'); set('pkCvVal','测试值');
                            set('pkBagName','测试物品'); set('pkBagCnt','1');
                            set('wxTempInput','常温'); set('wxVoidInput','铁锭'); set('wxOracleInput','预言');
                            set('wxTempVal','20'); set('wxVoidVal','10'); set('wxOracleVal','1');
                            set('eeResInput','测试客=房主'); set('eeLedgerInput','测试账=1');
                            set('wrNA','测试人=路人'); set('wrCS','声望=1'); set('wrCN','老周=警察');
                            set('wrSayText','测试发言');
                          }catch(e){}
                          const before=JSON.stringify(W.modState(m[0])||null);
                          let ret=null,err=null;
                          try{ ret=W.act(m[0],m[1],m[2]); }catch(e){ err=String(e); }
                          let after=null;
                          try{ after=JSON.stringify(W.modState(m[0])||null); }catch(e){}
                          return {err:err, retType:(ret===null?'null':typeof ret),
                                  retStr:(typeof ret==='string'?ret.slice(0,120):(ret==null?'':String(ret).slice(0,120))),
                                  changed:(before!==after), after:after||''};
                        }""", [mid, aid, RPG_ARG.get(aid, PROBE_ARG)])
                        ginfo["actions"] += 1
                        if r.get("err"):
                            ginfo["throws"].append({"m": mid, "a": aid, "err": r["err"][:140]})
                            report["issues"].append({"genre": g, "type": "throw", "m": mid, "a": aid, "detail": r["err"][:140]})
                            continue
                        if BAD_NUM.search(r.get("after") or ""):
                            ginfo["badstate"].append({"m": mid, "a": aid})
                            report["issues"].append({"genre": g, "type": "badstate", "m": mid, "a": aid,
                                                     "detail": (r.get("after") or "")[:160]})
                        if not r.get("changed") and not r.get("retStr"):
                            ginfo["dead"].append({"m": mid, "a": aid})
                            report["issues"].append({"genre": g, "type": "dead", "m": mid, "a": aid, "detail": "无提示无变化"})
                        elif not r.get("changed") and r.get("retStr"):
                            # 有提示但状态未变：可能是冷却中/需要前置，属正常，记为提示即可
                            ginfo.setdefault("hints", []).append({"m": mid, "a": aid, "msg": r.get("retStr")})
                if errs:
                    ginfo["pageerrors"] = errs[:3]
                    report["issues"].append({"genre": g, "type": "pageerror", "detail": errs[:3]})
                report["genres"][g] = ginfo
                print("%-22s 模块 %2d  动作 %3d  死按钮 %2d  异常状态 %2d  抛错 %2d" % (
                    g, len(available), ginfo["actions"], len(ginfo["dead"]), len(ginfo["badstate"]), len(ginfo["throws"])))
            except Exception as e:
                report["issues"].append({"genre": g, "type": "crash", "detail": "%s: %s" % (type(e).__name__, str(e)[:140])})
                print("%-22s 崩溃 %s" % (g, str(e)[:80]))
        json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n=== 汇总 ===")
        print("界数", len(report["genres"]), "| 问题总数", len(report["issues"]))
        from collections import Counter
        c = Counter(x["type"] for x in report["issues"])
        print("分类:", dict(c))
        for x in report["issues"][:40]:
            print(" ", x.get("genre"), x.get("type"), x.get("m", ""), x.get("a", ""), str(x.get("detail"))[:110])
        await b.close()


asyncio.run(main())
