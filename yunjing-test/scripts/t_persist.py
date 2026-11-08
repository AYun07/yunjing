#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.07.2 · 存档持久化探测（不调模型）

玩家体验里最容易被忽略、但一旦出问题最伤的一种：
「我接了委托、打了怪、转了职，关掉页面再回来，全没了。」

口径：
  ① 进界 → 执行该界所有真实动作（走 UI 同款调用）→ 记录各模块状态指纹
  ② reload 页面 → 重新 boot → 记录同样指纹
  ③ 对比：动作确实改过状态的字段，reload 后是否还在
     - 「改了但没存」= 丢数据（缺陷）
     - 「改了、没存、但该字段本就是临时量」= 需人工确认（不直接判失败）

输出：/tmp/persist_probe.json + 控制台摘要
"""
import asyncio, glob, json, os, re
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/persist_probe.json"
GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob("/workspace/yunjing/js/kb/*.core.js"))

BOOT = """(g)=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《存档·'+(config.genreName||g)+'》',playerName:'我',gender:'男',age:18,
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

# 动作清单：与 t_funcprobe 相同的解析口径（读真实面板 HTML）
ACTS = r"""()=>{
  const W=window.WorldExt;
  const out={};
  try{
    let host=document.getElementById('immBody');
    if(!host){ host=document.createElement('div'); host.id='immBody'; document.body.appendChild(host); }
    host.dataset.wxTab='1';
    host.innerHTML=W.panelHTML?String(W.panelHTML()||''):'';
    const html=host.innerHTML;
    const push=(m,a)=>{out[m]=out[m]||[];if(out[m].indexOf(a)<0)out[m].push(a);};
    let m;
    const re1=/WorldExt\.act\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
    while((m=re1.exec(html))) push(m[1],m[2]);
    const re2=/data-mod="([^"]+)"[^>]*data-act="([^"]+)"/g;
    while((m=re2.exec(html))) push(m[1],m[2]);
    const re2b=/data-rpg-act="([^"]+)"/g;
    while((m=re2b.exec(html))) push('wr_rpg',m[1]);
    const ml=W.moduleList?W.moduleList():[];
    for(const x of ml){ if(x.actions&&x.actions.length) for(const a of x.actions) push(x.id,a); }
  }catch(e){}
  return out;
}"""

# 指纹：各模块状态里的「数值/字符串标量」，排除日志与时间戳类噪声
FINGER = r"""()=>{
  const W=window.WorldExt;
  const out={};
  try{
    const ml=W.moduleList?W.moduleList():[];
    const flat=(o,p)=>{
      const r={};
      const w=(x,pp)=>{ if(!x||typeof x!=='object') return;
        for(const k in x){ if(!Object.prototype.hasOwnProperty.call(x,k)) continue;
          const v=x[k]; const kp=pp?pp+'.'+k:k;
          if(k==='logs'||k==='history'||k==='_facts'||k==='updatedRound'||k==='_booted'||k==='version') continue;
          if(v&&typeof v==='object'&&!Array.isArray(v)) w(v,kp);
          else r[kp]=v; } };
      w(o,''); return r;
    };
    for(const x of ml){
      const st=W.modState(x.id);
      if(!st) continue;
      out[x.id]=flat(st);
    }
  }catch(e){}
  return out;
}"""

# v4.09.0：存档侧同口径扁平表，用于把「内存还没加载完」与「真没存」分开。
SAVE_FLAT = r"""(g)=>{
  const out={};
  try{
    const d=JSON.parse(localStorage.getItem('worldExt_'+g)||'{}');
    const mods=d.mods||{};
    const flat=(o)=>{
      const r={};
      const w=(x,pp)=>{ if(!x||typeof x!=='object') return;
        for(const k in x){ if(!Object.prototype.hasOwnProperty.call(x,k)) continue;
          const v=x[k]; const kp=pp?pp+'.'+k:k;
          if(k==='logs'||k==='history'||k==='_facts'||k==='updatedRound'||k==='_booted'||k==='version') continue;
          if(v&&typeof v==='object'&&!Array.isArray(v)) w(v,kp);
          else r[kp]=v; } };
      w(o,''); return r;
    };
    for(const mid in mods) out[mid]=flat(mods[mid]);
  }catch(e){}
  return out;
}"""

# 运行时派生槽：reload 后按设计重建 / 不落盘，不参与「字段消失」判定。
# 下划线开头的内部槽（_order / _feedHash / _lastRank / _lastRealm）与渲染轮次缓存。
DERIVED_PAT = re.compile(r"(?:^|\.)(?:_[A-Za-z]|lastRound$)")


def classify_lost(fp1, fp2, saved):
    """把 reload 后内存里消失的字段分成三类。
    真丢失 = 存档里也找不到，才是必须报的缺陷。"""
    real, derived, lazy = [], [], []
    for mid, f1 in (fp1 or {}).items():
        f2 = (fp2 or {}).get(mid) or {}
        sv = (saved or {}).get(mid) or {}
        for k in f1:
            if k in f2:
                continue
            path = "%s.%s" % (mid, k)
            if DERIVED_PAT.search(k):
                derived.append(path)
            elif k in sv:
                lazy.append(path)          # 数据已落盘，只是懒加载窗口没读完
            else:
                real.append(path)          # 存档里也没有 → 真丢失
    return {"real": real, "derived": derived, "lazy": lazy}


def selftest():
    """纯函数自检 + 反向灵敏度：分类逻辑不能把真丢失藏起来。"""
    fp1 = {"m": {"_order": [], "lastRound": 0, "resources.灵药": 1, "gold": 30}}
    fp2 = {"m": {"gold": 30}}
    saved_ok = {"m": {"resources.灵药": 1, "gold": 30}}
    saved_bad = {"m": {"gold": 30}}

    def checks(fn):
        r = fn(fp1, fp2, saved_ok)
        assert r["real"] == [], r
        assert "m._order" in r["derived"] and "m.lastRound" in r["derived"], r
        assert "m.resources.灵药" in r["lazy"], r
        r2 = fn(fp1, fp2, saved_bad)
        assert "m.resources.灵药" in r2["real"], r2   # 真丢失必须报
        return True

    assert checks(classify_lost), "当前实现自检失败"

    # 变异：把「存档无」也归类成懒加载 → 真丢失被吞掉 → 同一组断言必须失败
    def mutant(a, b, c):
        out = classify_lost(a, b, c)
        out["lazy"] = out["lazy"] + out["real"]
        out["real"] = []
        return out
    try:
        checks(mutant)
    except AssertionError:
        return True                      # 变异被检出
    raise AssertionError("变异体未被检出：分类自检形同虚设")


async def main():
    selftest()
    print("分类自检：派生槽 / 懒加载窗口 / 真丢失 三分类 + 变异灵敏度 → 通过")
    report = {"genres": {}, "issues": [], "derived": 0, "lazyWindow": 0, "lostReal": 0}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        pg = await ctx.new_page()
        for g in GENRES:
            try:
                await pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(2600)
                await pg.evaluate(BOOT, g)
                for _ in range(50):
                    ok = await pg.evaluate("()=>{try{return !!(window.WorldExt&&window.WorldExt.moduleList&&window.WorldExt.moduleList().length);}catch(e){return false;}}")
                    if ok:
                        break
                    await pg.wait_for_timeout(400)
                acts = await pg.evaluate(ACTS)
                # 执行所有动作
                await pg.evaluate("""(acts)=>{
                  const W=window.WorldExt;
                  const set=(id,v)=>{try{const el=document.getElementById(id);if(el)el.value=v;}catch(e){}};
                  set('pkCvKey','存档字段'); set('pkCvVal','存档值');
                  set('pkBagName','存档物品'); set('pkBagCnt','1');
                  set('wxTempInput','常温'); set('wxVoidInput','铁锭'); set('wxOracleInput','预言');
                  set('wxTempVal','20'); set('wxVoidVal','10'); set('wxOracleVal','1');
                  set('eeResInput','测试客=房主'); set('eeLedgerInput','测试账=1');
                  set('wrNA','存档人=路人'); set('wrCS','声望=1'); set('wrCN','老周=警察');
                  const RPG={buy:'hp',teleport:'1',skill:'slash',setclass:'warrior',guild:'found:存档公会',arena:'fight',enhance:'0',usepotion:'hp',addpoint:'str',mode:'sandbox'};
                  for(const mid in acts){
                    for(const aid of acts[mid]){
                      try{ W.act(mid, aid, RPG[aid]!==undefined?RPG[aid]:'存档甲=乙'); }catch(e){}
                    }
                  }
                }""", acts)
                await pg.wait_for_timeout(900)
                fp1 = await pg.evaluate(FINGER)

                # reload：模拟玩家关掉页面再回来 —— 从存档恢复，**不能重跑 BOOT**。
                # v4.07.2 口径修正①：初版 reload 后又执行了一遍 BOOT，而 BOOT 会重建
                # storyState.variables 并触发 onVars —— 那等于「重新开一局」，
                # 测出来的是「重开档会清空」，不是「刷新页面会丢进度」，口径完全错了。
                # v4.07.2 口径修正②：reload 后必须等存档恢复窗口——界扩展脚本是懒加载的，
                # 存档随 define()/tryPlayerKit() 恢复，初版读得太早会误报「丢数据」
                # （实测：reload 后立即读，resources/cooldowns 是空的，3.5 秒后才恢复）。
                await pg.reload(wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(1200)
                fp2 = None
                # v4.07.2 口径修正③：不能只看「有模块就绪」——
                # 界扩展是懒加载的，通用模块（pkPanel 等）早于界专属模块就位，
                # 等到任意模块就绪就取指纹，会把「界专属模块还没加载」读成「数据丢了」。
                # 改为等模块集稳定（连续两次模块数与模块 id 集合相同）。
                last_sig = None
                stable = 0
                for _ in range(60):
                    fp2 = await pg.evaluate(FINGER)
                    sig = tuple(sorted((fp2 or {}).keys()))
                    if sig and sig == last_sig:
                        stable += 1
                        if stable >= 2:
                            break
                    else:
                        stable = 0
                    last_sig = sig
                    await pg.wait_for_timeout(500)
                if not fp2:
                    report["issues"].append({"genre": g, "type": "noRestore", "detail": "reload 后读不到模块状态，无法判定持久化"})
                    print("%-22s ! reload 后模块未就绪，无法判定" % g)
                    continue
                # 存档一致性：只报「存档里有、内存里完全没有」——
                # 内存比存档新是正常的（read() 会随回合衰减冷却），但内存不能比存档少。
                # v4.07.2 口径修正④：**只比较当前界的存档**。
                # localStorage 里每个界各有一份 worldExt_<genre> 存档，
                # 而内存里只有当前界的模块状态——跨界比较毫无意义，
                # 会把别的界的资源名（「金镑」「暗能量」「神圣结晶」…）全报成缺失。
                stMismatch = await pg.evaluate("""(g)=>{
                  const W=window.WorldExt;
                  const out=[];
                  try{
                    const key='worldExt_'+g;
                    const d=JSON.parse(localStorage.getItem(key)||'{}');
                    for(const mid in (d.mods||{})){
                      const mem=W.modState(mid);
                      if(!mem) continue;
                      const sv=d.mods[mid]||{};
                      const mr=mem.resources||{}, sc=mem.cooldowns||{};
                      /* v4.07.2 口径修正⑤：只报「真正丢了价值」的键。
                         存档里存在但内存里没有的键，若其值为 0 —— 丢了也不损失任何东西，
                         是模块定义差异（res 表按界不同）而非数据丢失，不能算不一致。
                         实测依据：wangyou 界存档与内存的 wr_combat.resources 完全一致
                         （12 个装备稀有度键全在），guimi 界同样一致（{"金镑":0,"非凡残液":0}）。 */
                      for(const rk of Object.keys(sv.resources||{})){
                        const v=Number(sv.resources[rk])||0;
                        if(!(rk in mr)){ if(v>0) out.push(mid+'.resources.'+rk+'='+v+'（内存缺失）'); }
                        else if(Number(mr[rk])<v) out.push(mid+'.resources.'+rk+' 存档'+v+'→内存'+Number(mr[rk]));
                      }
                      for(const ck of Object.keys(sv.cooldowns||{})){
                        if(!(ck in sc)) out.push(mid+'.cooldowns.'+ck+'（内存缺失）');
                      }
                    }
                  }catch(e){}
                  return out;
                }""", g)
                if stMismatch:
                    report["issues"].append({"genre": g, "type": "stateMismatch", "detail": stMismatch[:8]})
                    print("%-22s ! 业务数据与存档不一致：%s" % (g, stMismatch[:4]))

                # v4.09.0 口径修正：动作改过的字段 reload 后不在内存里，分三种情况：
                #   ① 运行时派生槽（_order / lastRound / _lastRank …）——设计如此不落盘
                #   ② 懒加载窗口——存档里存在，只是内存还没加载完
                #   ③ 真丢失——存档里也没有，才是必须报的缺陷
                # 业务数据是否持久化以「存档」为准，stateMismatch 仍逐项严格比对。
                saved = await pg.evaluate(SAVE_FLAT, g)
                cls = classify_lost(fp1, fp2, saved)
                lost = cls["real"]
                report["derived"] += len(cls["derived"])
                report["lazyWindow"] += len(cls["lazy"])
                report["lostReal"] += len(lost)
                ginfo = {"modules": len(fp1 or {}), "lost": lost,
                         "derived": cls["derived"], "lazyWindow": cls["lazy"]}
                report["genres"][g] = ginfo
                if lost:
                    report["issues"].append({"genre": g, "type": "lostReal", "detail": lost[:12]})
                print("%-22s 模块 %2d  真丢失 %d ｜ 派生槽 %d ｜ 懒加载窗口 %d %s" % (
                    g, len(fp1 or {}), len(lost), len(cls["derived"]), len(cls["lazy"]),
                    (lost[:3] if lost else "")))
            except Exception as e:
                report["issues"].append({"genre": g, "type": "crash", "detail": "%s: %s" % (type(e).__name__, str(e)[:120])})
                print("%-22s 崩溃 %s" % (g, str(e)[:80]))
        json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n=== 汇总 ===")
        print("界数 %d ｜ 真丢失 %d ｜ 运行时派生槽 %d ｜ 懒加载窗口 %d ｜ 问题总数 %d" % (
            len(report["genres"]), report["lostReal"], report["derived"],
            report["lazyWindow"], len(report["issues"])))
        for x in report["issues"][:30]:
            print(" ", x.get("genre"), x.get("type"), str(x.get("detail"))[:150])
        await b.close()


asyncio.run(main())
