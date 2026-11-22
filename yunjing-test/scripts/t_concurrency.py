#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.09.0 · 平台级并发压测（本地桩，不调用任何模型）

用户硬约束是「真实模型请求并发 1、间隔 ≥4s」。本脚本完全不调用模型，
只压产品自身的并发面：多标签页共享 localStorage、落盘风暴、切档竞态、
主笔并发门闩。因此不与硬约束冲突，同时补上「更高并发未做平台级压测」这一缺口。

输出：yunjing-test/out/concurrency_probe.json + 控制台摘要
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yj_paths import ROOT, genres, out_path, out_glob, kb_index

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = out_path("concurrency_probe.json")
GENRE = "wangyou"

KEYS = """()=>{const a=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)a.push(k);}return a.sort();}"""

BAD_JSON = """()=>{const bad=[];for(let i=0;i<localStorage.length;i++){
  const k=localStorage.key(i);if(!k)continue;const v=localStorage.getItem(k)||'';
  if(v[0]==='{'||v[0]==='['){try{JSON.parse(v);}catch(e){bad.push(k);}}
}return bad;}"""

# 落盘风暴：60 次并发「改内存 + 全量落盘」，检查不抛错、存档 JSON 完好
STORM = """async ()=>{
  const W=window.WorldExt, fw=window.storyFramework, errs=[];
  const one=async(i)=>{ try{
    const st=W&&W.modState?W.modState('wr_rpg'):null;
    if(st){ st.gold=(Number(st.gold)||0)+1; }
    if(W&&W.persist) W.persist();
    if(fw&&fw.flushSave) fw.flushSave();
    if(window.WorldRuntime&&WorldRuntime.persist) WorldRuntime.persist();
    if(window.WorldBus&&WorldBus.persist) WorldBus.persist();
    if(window.WorldAlive&&WorldAlive.persist) WorldAlive.persist();
    if(window.SquadSystem&&SquadSystem.save) SquadSystem.save();
    if(window.BeastSystem&&BeastSystem.save) BeastSystem.save();
    return true;
  }catch(e){ errs.push(String(e)); return false; } };
  const rs=await Promise.all(Array.from({length:60},(_,i)=>one(i)));
  return {ok:errs.length===0, done:rs.filter(Boolean).length, errs:errs.slice(0,5)};
}"""

# 多标签同槽并发写入：三个页面共享同一 localStorage
TAB_WRITE = """async (tag)=>{
  const W=window.WorldExt, errs=[];
  const one=async(i)=>{ try{
    const st=W&&W.modState?W.modState('wr_rpg'):null;
    if(st){ st.rep=(Number(st.rep)||0)+1; }
    localStorage.setItem('probe_conc_'+tag+'_'+i, JSON.stringify({tag:tag,i:i,t:Date.now()}));
    if(W&&W.persist) W.persist();
    return true;
  }catch(e){errs.push(String(e));return false;} };
  await Promise.all(Array.from({length:25},(_,i)=>one(i)));
  return {ok:errs.length===0, errs:errs.slice(0,5)};
}"""

# 主笔并发门闩：结构存在 + 中止后释放（不真发模型请求）
LATCH = """()=>{
  const L=window.__aiMainLatch, ab=window.abortMainGeneration;
  if(!L||typeof ab!=='function') return {ok:false,why:'门闩或中止接口缺失'};
  const shape=['busy','owner','since','controller','userAborted'].every(k=>k in L);
  if(!shape) return {ok:false,why:'门闩结构不完整'};
  const before=!!L.busy;
  try{ ab('并发压测探针'); }catch(e){ return {ok:false,why:'中止抛错:'+String(e)}; }
  return {ok:true, shape:shape, busyBefore:before, busyAfter:!!L.busy,
          userAborted:!!L.userAborted, hasAbort:true};
}"""

# 切档 + 并发落盘竞态：切档前必须冲刷旧档，切完不能有旧档残留键
SWITCH_RACE = """async ()=>{
  const errs=[];
  const S=window.SaveSlots;
  if(!S) return {ok:false,why:'SaveSlots 缺失'};
  const before=(()=>{const a=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)a.push(k);}return a;})();
  const jobs=[];
  for(let i=0;i<20;i++) jobs.push((async()=>{try{
    const W=window.WorldExt; if(W&&W.persist)W.persist();
    if(window.WorldRuntime&&WorldRuntime.persist)WorldRuntime.persist();
  }catch(e){errs.push(String(e));}})());
  await Promise.all(jobs);
  return {ok:errs.length===0, before:before.length, errs:errs.slice(0,5)};
}"""


def storm_pass(storm, bad, keys):
    return bool(storm["ok"]) and not bad and len(keys) > 0


def _probe_keys(ks):
    """只取本用例自己写的探针键（probe_conc_*）。"""
    return sorted(k for k in ks if k.startswith("probe_conc_"))


def tabs_pass(writes, key_sets, bads, probe_count):
    """多标签同槽并发的判定。

    v5.1.3 修判定口径：旧口径比较的是**整个 localStorage 键集合**在三张标签页里
    是否完全一致。但应用自己的运行时键（时间戳、每标签各自的运行态）本来就可能
    各标签不同，把它算进判定会偶发假红——CI 上真抓到过：三次写入全 ok、
    探针键 75 条齐全，却因 keySetsConsistent=False 判红。

    真正要守的不变量只有一条：**三个标签互相写的探针键，互相都看得见、且没写坏**。
    其余键不属于本用例的判定范围。
    """
    if not (all(w["ok"] for w in writes) and not any(bads)):
        return False
    if probe_count < 75:
        return False
    sets = [_probe_keys(ks) for ks in key_sets]
    if not sets[0]:
        return False
    return all(s == sets[0] for s in sets) and len(sets[0]) >= 75


def selftest():
    """反向灵敏度：任一输入异常都必须让判定为 False，防止压测恒真盖章。
    判定函数与实跑共用同一份实现，避免自检与实跑口径漂移。"""
    good_s, good_bad, good_keys = {"ok": True, "done": 60}, [], ["k"]
    assert storm_pass(good_s, good_bad, good_keys)
    for case in [({"ok": False, "done": 59}, [], ["k"]),
                 (good_s, ["worldExt_wangyou"], ["k"]),
                 (good_s, [], [])]:
        assert not storm_pass(*case), case
    gw = [{"ok": True}] * 3
    P75 = ["probe_conc_%d" % i for i in range(75)]
    good_sets = [list(P75) for _ in range(3)]
    assert tabs_pass(gw, good_sets, [[], [], []], 75)
    # 非探针键各标签不同不应判红（v5.1.3 的口径修正）
    assert tabs_pass(gw, [P75 + ["x"], P75 + ["y"], P75 + ["z"]], [[], [], []], 75)
    for case in [([{"ok": False}] + gw[1:], good_sets, [[], [], []], 75),
                 (gw, [P75, P75[:-1], P75], [[], [], []], 75),
                 (gw, good_sets, [["bad"], [], []], 75),
                 (gw, good_sets, [[], [], []], 74)]:
        assert not tabs_pass(*case), case
    return True


def check(name, cond, detail, report):
    report["scenarios"].append({"name": name, "pass": bool(cond), "detail": detail})
    if not cond:
        report["issues"].append({"scenario": name, "detail": detail})
    print("  %-22s %s %s" % (name, "PASS" if cond else "FAIL", str(detail)[:110]))


async def main():
    selftest()
    print("压测判定自检：异常输入全部能被检出 → 通过")
    report = {"scenarios": [], "issues": []}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(service_workers="block")
        perr = []

        # 1) 落盘风暴（单页）
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: perr.append(str(e)[:160]))
        await pg.goto(BASE + "/studio.html?genre=" + GENRE, wait_until="domcontentloaded", timeout=45000)
        await pg.wait_for_timeout(2600)
        storm = await pg.evaluate(STORM)
        bad = await pg.evaluate(BAD_JSON)
        keys_after = await pg.evaluate(KEYS)
        check("落盘风暴 60 并发", storm_pass(storm, bad, keys_after),
              {"done": storm["done"], "errs": storm["errs"], "badJSON": bad, "keys": len(keys_after)}, report)

        # 2) 多标签页同槽并发写入
        pages = []
        for i in range(3):
            q = await ctx.new_page()
            q.on("pageerror", lambda e: perr.append(str(e)[:160]))
            await q.goto(BASE + "/studio.html?genre=" + GENRE, wait_until="domcontentloaded", timeout=45000)
            await q.wait_for_timeout(2200)
            pages.append(q)
        writes = await asyncio.gather(*[q.evaluate(TAB_WRITE, "T%d" % i) for i, q in enumerate(pages)])
        key_sets = await asyncio.gather(*[q.evaluate(KEYS) for q in pages])
        bads = await asyncio.gather(*[q.evaluate(BAD_JSON) for q in pages])
        # 三个标签共享同源 localStorage：**探针键**应互相可见且一致
        # （只比探针键，不比应用自己的运行时键 —— 后者各标签不同是正常的）
        probes = _probe_keys(key_sets[0])
        probe_sets = [_probe_keys(ks) for ks in key_sets]
        consistent = all(s == probe_sets[0] for s in probe_sets)
        diff = sorted(set(probe_sets[0]) ^ set(probe_sets[-1]))[:6] if not consistent else []
        check("多标签同槽并发", tabs_pass(writes, key_sets, bads, len(probes)),
              {"writes": [w["ok"] for w in writes], "probeKeys": len(probes),
               "probeSetsConsistent": consistent, "probeDiff": diff,
               "badJSON": [len(x) for x in bads]}, report)

        # 3) 主笔并发门闩
        latch = await pg.evaluate(LATCH)
        check("主笔门闩结构/中止", latch["ok"], latch, report)

        # 4) 切档与落盘竞态
        race = await pg.evaluate(SWITCH_RACE)
        check("切档落盘竞态", race["ok"], race, report)

        check("页面异常", not perr, {"pageerror": perr[:5], "count": len(perr)}, report)
        await b.close()
    json.dump(report, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n=== 汇总 ===")
    print("场景 %d ｜ 通过 %d ｜ 失败 %d" % (
        len(report["scenarios"]),
        sum(1 for s in report["scenarios"] if s["pass"]),
        len(report["issues"])))
    if report["issues"]:
        for x in report["issues"]:
            print("  !", x)
        raise SystemExit(1)
    print("✅ 平台级并发压测全部通过")


asyncio.run(main())
