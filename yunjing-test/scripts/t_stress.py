#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.07.2 · 压力探测（不调模型，纯功能层）

t_funcprobe.py 的口径是「单次调用 + 合法参数」，漏掉了三类真实缺陷：
  ① 连点：同一动作连点 3 次，状态是否被写坏（NaN / 负数 / 越界）
  ② 非法/空输入：用户输入框留空就点按钮、或塞进非数字，是真实用户路径
  ③ 输入未校验致误操作：如 eeDropOp 原先 splice(Number(payload),1)
     在 payload 非数字时会误删第一张工单
另外补一项安全探测：动作把用户输入直接拼进 innerHTML 会造成注入。

每个场景之间把模块状态回滚到基线（ensureState 返回内部引用，可整体还原），
保证一个动作的副作用不会污染下一个场景的判定。

输出：/tmp/stress_probe.json + 控制台摘要
"""
import asyncio, glob, json, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/stress_probe.json"
GENRES = sorted(os.path.basename(f)[:-8] for f in glob.glob("/workspace/yunjing/js/kb/*.core.js"))

BOOT = """(g)=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《压测·'+(config.genreName||g)+'》',playerName:'我',gender:'男',age:18,
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

# 场景表：key -> payload 生成说明（在浏览器侧展开）
STRESS = r"""(opt)=>{
  const W=window.WorldExt;
  const out={cases:[],errs:[],xss:0};
  if(!W||!W.moduleList) return out;
  const PROBE_ARG="测试甲=乙";
  const RPG_ARG={buy:"hp",teleport:"1",skill:"slash",setclass:"warrior",guild:"found:测试公会",
    arena:"fight",enhance:"0",equipbag:"",usepotion:"hp",party:"",pet:"",addpoint:"str",
    mode:"sandbox",qaccept:"",qturnin:"",qgiveup:""};
  const legal=a=>RPG_ARG[a]!==undefined?RPG_ARG[a]:PROBE_ARG;

  // ① 渲染真实面板，解析全部可点动作
  let host=document.getElementById('immBody');
  if(!host){host=document.createElement('div');host.id='immBody';document.body.appendChild(host);}
  host.dataset.wxTab='1';
  try{host.innerHTML=W.panelHTML?String(W.panelHTML()||''):'';}catch(e){}
  const html=host.innerHTML||'';
  const acts={};
  const push=(m,a)=>{acts[m]=acts[m]||[];if(acts[m].indexOf(a)<0)acts[m].push(a);};
  let m;
  const re1=/WorldExt\.act\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  while((m=re1.exec(html))) push(m[1],m[2]);
  const re2=/data-mod="([^"]+)"[^>]*data-act="([^"]+)"/g;
  while((m=re2.exec(html))) push(m[1],m[2]);
  const re2b=/data-rpg-act="([^"]+)"/g;
  while((m=re2b.exec(html))) push('wr_rpg',m[1]);
  try{
    const ml=W.moduleList();
    for(const x of ml){ if(x.actions&&x.actions.length) for(const a of x.actions) push(x.id,a); }
  }catch(e){}

  const set=(id,v)=>{try{const el=document.getElementById(id);if(el)el.value=v;}catch(e){}};
  const fill=()=>{
    set('pkCvKey','测试字段');set('pkCvVal','测试值');
    set('pkBagName','测试物品');set('pkBagCnt','1');
    set('wxTempInput','常温');set('wxVoidInput','铁锭');set('wxOracleInput','预言');
    set('wxTempVal','20');set('wxVoidVal','10');set('wxOracleVal','1');
    set('eeResInput','测试客=房主');set('eeLedgerInput','测试账=1');
    set('wrNA','测试人=路人');set('wrCS','声望=1');set('wrCN','老周=警察');
    set('wrSayText','测试发言');
  };
  const snap=mid=>{try{const v=W.modState(mid);return v?JSON.stringify(v):null;}catch(e){return null;}};
  const restore=(mid,base)=>{
    try{
      const cur=W.modState(mid); if(!cur||!base) return;
      Object.keys(cur).forEach(k=>{delete cur[k];});
      const b=JSON.parse(JSON.stringify(base));
      Object.keys(b).forEach(k=>{cur[k]=b[k];});
    }catch(e){}
  };
  // 快照里的数字集合（用于找新增负数）
  // v4.07.2 修：初版用正则扫 JSON 字符串找 NaN，把字符串 "NaN"（NPC 名就叫 NaN）
  // 也当成数值 NaN —— 误报。改为按对象结构遍历：只有 typeof==='number' 且非有限的才算。
  const flat=o=>{
    const out={};
    const w=(x,p)=>{
      if(!x||typeof x!=='object') return;
      for(const k in x){
        if(!Object.prototype.hasOwnProperty.call(x,k)) continue;
        const v=x[k]; const kp=p?p+'.'+k:k;
        if(v&&typeof v==='object'&&!Array.isArray(v)) w(v,kp);
        else out[kp]=v;
      }
    };
    w(o,'');
    return out;
  };
  const nonFinite=(o)=>{
    const bad=[];
    for(const k in flat(o)){ const v=flat(o)[k]; if(typeof v==='number'&&!isFinite(v)) bad.push(k+'='+v); }
    return bad;
  };
  const nums=js=>{
    const out={};
    const f=flat(js?JSON.parse(js):null);
    for(const k in f){ const v=f[k]; if(typeof v==='number') out[k]=v; }
    return out;
  };
  const keys=js=>{try{return Object.keys(flat(js?JSON.parse(js):null));}catch(e){return [];}};

  const SCEN=[
    ['empty',''],              // 空输入：用户没填就点
    ['garbage','abc'],         // 非数字塞进数值位
    ['nan','NaN'],             // 字面 NaN
    ['neg','-999999'],         // 负数越界
    ['xss','<img src=x onerror=window.__xss=1>'],  // 注入
    ['long','A'.repeat(400)]   // 超长输入
  ];

  for(const mid in acts){
    const baseState=(function(){try{return W.modState(mid)?JSON.parse(JSON.stringify(W.modState(mid))):null;}catch(e){return null;}})();
    const baseSnap=snap(mid);
    const baseNums=nums(baseSnap);
    const baseKeys=keys(baseSnap);

    // ── 场景：连点 3 次（合法参数）
    try{
      fill();
      for(let i=0;i<3;i++){ try{W.act(mid,acts[mid][0],legal(acts[mid][0]));}catch(e){ out.errs.push({m:mid,a:acts[mid][0],sc:'triple',err:String(e).slice(0,120)});} }
      const after=snap(mid);
      const afNums=nums(after);
      const bad=[];
      const nf=nonFinite(W.modState(mid));
      if(nf.length) bad.push('状态含非法数值 '+nf.join(','));
      for(const k in afNums){ if(baseNums[k]!==undefined && baseNums[k]>=0 && afNums[k]<0) bad.push('字段 '+k+' 变负 '+afNums[k]+'（基线 '+baseNums[k]+'）'); }
      const lost=baseKeys.filter(k=>keys(after||'{}').indexOf(k)<0);
      if(lost.length) bad.push('字段丢失 '+lost.join(','));
      if(bad.length) out.cases.push({m:mid,a:acts[mid][0],sc:'triple',bad:bad});
    }catch(e){ out.errs.push({m:mid,sc:'triple',err:String(e).slice(0,120)}); }
    restore(mid,baseState);

    // ── 场景：非法/边界输入
    for(const [sc,payload] of SCEN){
      try{
        fill();
        if(sc==='xss'){ try{window.__xss=0;}catch(e){} }
        const before=snap(mid);
        let ret=null,err=null;
        try{ ret=W.act(mid,acts[mid][0],payload); }catch(e){ err=String(e).slice(0,140); }
        const after=snap(mid);
        const bad=[];
        if(err) bad.push('抛错 '+err);
        if(after===null && before!==null) bad.push('状态对象被清空');
        const nf=nonFinite(W.modState(mid));
        if(nf.length) bad.push('状态含非法数值 '+nf.join(','));
        const afNums=nums(after);
        for(const k in afNums){ if(baseNums[k]!==undefined && baseNums[k]>=0 && afNums[k]<0) bad.push('字段 '+k+' 变负 '+afNums[k]+'（基线 '+baseNums[k]+'）'); }
        const lost=baseKeys.filter(k=>keys(after||'{}').indexOf(k)<0);
        if(lost.length) bad.push('字段丢失 '+lost.join(','));
        if(ret!==null&&ret!==undefined&&typeof ret!=='string') bad.push('返回类型 '+typeof ret);
        if(sc==='xss'){
          try{ if(window.__xss) bad.push('注入被执行：用户输入被当 HTML 插入'); }catch(e){}
        }
        if(bad.length) out.cases.push({m:mid,a:acts[mid][0],sc:sc,bad:bad});
      }catch(e){ out.errs.push({m:mid,sc:sc,err:String(e).slice(0,120)}); }
      restore(mid,baseState);
    }
  }
  return out;
}"""


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
                mods = []
                for _ in range(60):
                    mods = await pg.evaluate("""()=>{try{return (window.WorldExt&&window.WorldExt.moduleList)?(window.WorldExt.moduleList()||[]):[];}catch(e){return [];}}""")
                    if mods:
                        break
                    await pg.wait_for_timeout(500)
                await pg.wait_for_timeout(600)
                r = await pg.evaluate(STRESS, {})
                for c in r.get("cases", []):
                    report["issues"].append({"genre": g, "type": c["sc"], "m": c["m"], "a": c["a"], "detail": " / ".join(c["bad"])[:180]})
                for e in r.get("errs", []):
                    report["issues"].append({"genre": g, "type": "harness-throw", "m": e.get("m"), "a": e.get("a", ""), "detail": e.get("err", "")[:180]})
                if errs:
                    report["issues"].append({"genre": g, "type": "pageerror", "detail": errs[:3]})
                report["genres"][g] = {"modules": len(mods), "cases": len(r.get("cases", [])), "errs": len(r.get("errs", []))}
                print("%-22s 模块 %2d  异常场景 %2d  探测抛错 %2d  页面错误 %2d" % (
                    g, len(mods), len(r.get("cases", [])), len(r.get("errs", [])), len(errs)))
            except Exception as e:
                report["issues"].append({"genre": g, "type": "crash", "detail": "%s: %s" % (type(e).__name__, str(e)[:140])})
                print("%-22s 崩溃 %s" % (g, str(e)[:90]))
        json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n=== 汇总 ===")
        print("界数", len(report["genres"]), "| 问题总数", len(report["issues"]))
        from collections import Counter
        c = Counter(x["type"] for x in report["issues"])
        print("分类:", dict(c))
        for x in report["issues"][:60]:
            print(" ", x.get("genre"), x.get("type"), x.get("m", ""), x.get("a", ""), str(x.get("detail"))[:130])
        await b.close()


asyncio.run(main())
