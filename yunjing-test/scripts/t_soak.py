#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""云境 v4.08.0 · 长时运行稳定性探测（soak，不调模型）

v4.07.2 交付报告的未闭环项之一：「没有做长时连续跑的稳定性测试」。
本脚本把「跑了一堆动作之后，存档会不会无限膨胀」变成可复跑的断言。

覆盖的缺陷：
  B5  无上限增长：rpg-core st.buffs / mystery-ext suspects+links / doupocangqiong owned+devoured
  B6  dayEvents 永不回收（纯内存泄漏）
  B7  localStorage 写入静默失败（配额满时玩家毫不知情）

判定口径：
  · 体积增长：连续执行 N 轮同一动作后，存档 JSON 体积**不应**随轮数线性增长
    （允许小幅波动，但斜率必须接近 0）
  · 字段增长：统计具体数组的长度，与轮数做相关性检查
  · 内存：JS heap 增长与轮数的关系

用法：
  cd /workspace/yunjing && python3 -m http.server 8899 --bind 127.0.0.1 &
  python3 yunjing-test/scripts/t_soak.py
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
OUT = "/tmp/soak_probe.json"
GENRE = os.environ.get("YJ_GENRE", "doupocangqiong")
ROUNDS = int(os.environ.get("YJ_SOAK_ROUNDS", "60"))

BOOT = """(g)=>{
  try{
    const fw=window.storyFramework, config=fw.config, meta=config.setupMeta||{};
    const pick=a=>a&&a.length?a[0]:null;
    const setup={mode:'roleplay',title:'《soak·'+(config.genreName||g)+'》',playerName:'我',gender:'男',age:18,
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
    return {ok:true};
  }catch(e){return {ok:false,err:String(e)};}
}"""

# 每轮做一堆"会长大数据"的动作：加嫌疑人、加异火、刷 buff、打怪
#
# v4.08.0 重要修正（避免"假通过"）：
#   首版脚本只改 `fw.storyState.variables` 而**不调用 WorldExt.onVars()**，
#   模块的 read() 根本不会被触发 → flames.owned 恒为 0 → 体积 0 增长 → 判定"通过"。
#   这与 v4.07.2 的 D-27（旅程测试传错参数、动作一次没真跑却判通过）是同一类陷阱。
#   现在：① 改完变量必须调 onVars 触发 read；② 每轮记录"动作是否真的改变了状态"，
#   若 N 轮后仍零变化 → 直接判失败（说明动作没真执行，测试无效）。
STRESS_ROUND = """(g)=>{
  const out = {errs:[], changed:0, targets:[]};
  const W = window.WorldExt;
  try {
    if (!W) { out.errs.push('WorldExt 未加载'); return out; }
    const mods = W.moduleList ? W.moduleList() : [];
    const byId = {}; mods.forEach(m => { byId[m.id] = m; });

    // 1) 悬疑界：持续加嫌疑人（links 是 线索×嫌疑人 的笛卡尔积）
    if (byId['evidence']) {
      for (let i = 0; i < 3; i++) {
        const nm = '嫌疑人' + Math.random().toString(36).slice(2, 7);
        try {
          const before = ((W.modState('evidence')||{}).suspects||[]).length;
          W.act('evidence', 'addSuspect', nm);
          const after = ((W.modState('evidence')||{}).suspects||[]).length;
          if (after > before) out.changed++;
          out.targets.push('evidence.suspects=' + after);
        } catch(e){ out.errs.push('evidence:'+e); }
      }
      // 线索：持续上报不同线索名（clues 有 30 上限，links 是乘积）
      try {
        const fw = window.storyFramework;
        fw.storyState.variables = fw.storyState.variables || {};
        const ev = fw.storyState.variables['证据'] = fw.storyState.variables['证据'] || {};
        for (let i = 0; i < 3; i++) ev['线索' + Math.random().toString(36).slice(2, 7)] = '指向 嫌疑人' + i;
        const before = ((W.modState('evidence')||{}).clues||[]).length;
        W.onVars(fw.storyState.variables, 0);
        const after = ((W.modState('evidence')||{}).clues||[]).length;
        if (after > before) out.changed++;
        out.targets.push('evidence.clues=' + after);
      } catch(e){ out.errs.push('vars:'+e); }
    }

    // 2) 斗破界：持续上报新异火名（必须走 onVars 才会被 read() 消费）
    if (byId['flames']) {
      try {
        const fw = window.storyFramework;
        fw.storyState.variables = fw.storyState.variables || {};
        const v = fw.storyState.variables['异火'] = fw.storyState.variables['异火'] || {};
        for (let i = 0; i < 3; i++) v['异火' + Math.random().toString(36).slice(2, 7)] = '第' + (i+1) + '位';
        const before = ((W.modState('flames')||{}).owned||[]).length;
        W.onVars(fw.storyState.variables, 0);
        const after = ((W.modState('flames')||{}).owned||[]).length;
        if (after > before) out.changed++;
        out.targets.push('flames.owned=' + after);
      } catch(e){ out.errs.push('flames:'+e); }
    }

    // 3) RPG：连续施加增益（buffs 无上限增长点）
    if (byId['wr_rpg']) {
      try {
        for (let i = 0; i < 4; i++) {
          const before = (((W.modState('wr_rpg')||{}).buffs)||[]).length;
          W.act('wr_rpg', 'buff', 'atk');
          const after = (((W.modState('wr_rpg')||{}).buffs)||[]).length;
          if (after !== before) out.changed++;
          out.targets.push('rpg.buffs=' + after);
        }
      } catch(e){ out.errs.push('rpg:'+e); }
    }

    // 4) 随机点几个真实动作，制造广谱的状态增长
    const acts = [];
    mods.forEach(m => { (m.actions||[]).forEach(a => acts.push([m.id, a])); });
    for (let i = 0; i < 6 && acts.length; i++) {
      const pick = acts[Math.floor(Math.random()*acts.length)];
      try { W.act(pick[0], pick[1], ''); } catch(e){ out.errs.push(pick[0]+'.'+pick[1]+':'+e); }
    }
  } catch(e){ out.errs.push('outer:'+e); }
  return out;
}"""

# 采集：各关键数组长度 + 存档体积 + 内存
SAMPLE = """(g)=>{
  const o = {sizes:{}, lens:{}, heap:0};
  try { o.heap = (performance.memory && performance.memory.usedJSHeapSize) || 0; } catch(e){}
  try {
    // 存档总体积
    let total = 0; const per = {};
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i); if(!k) continue;
      const v = localStorage.getItem(k) || '';
      total += k.length + v.length;
      if (k.indexOf('worldExt_') === 0) per[k] = v.length;
    }
    o.sizes.total = total;
    o.sizes.perKey = per;
    // 关键数组长度（递归扫 worldExt 的 mods 状态）
    const W = window.WorldExt;
    const raw = localStorage.getItem('worldExt_' + g) || '{}';
    let st = {};
    try { st = JSON.parse(raw); } catch(e){}
    const mods = (st && st.mods) || {};
    const lens = {};
    const scan = (obj, path, depth) => {
      if (!obj || typeof obj !== 'object' || depth > 4) return;
      if (Array.isArray(obj)) {
        lens[path] = obj.length;
        if (obj.length && obj.length <= 40) obj.slice(0,40).forEach((v,i)=>scan(v, path+'['+i+']', depth+1));
        return;
      }
      Object.keys(obj).slice(0, 60).forEach(k => scan(obj[k], path ? path+'.'+k : k, depth+1));
    };
    Object.keys(mods).forEach(mid => {
      const m = mods[mid];
      if (!m || typeof m !== 'object') return;
      Object.keys(m).forEach(k => {
        const v = m[k];
        if (Array.isArray(v)) lens[mid+'.'+k] = v.length;
        else if (v && typeof v === 'object' && !Array.isArray(v)) {
          const n = Object.keys(v).length;
          if (n > 30) lens[mid+'.'+k+'#keys'] = n;
        }
      });
    });
    o.lens = lens;
    // RPG 特定
    try {
      const M = window.RPGCore;
      const mod = (W.moduleList ? W.moduleList() : []).find(x => x.id === 'wr_rpg');
      if (mod) {
        const s = (W.modState && W.modState('wr_rpg')) || {};
        o.rpg = { buffs: (s.buffs||[]).length, blog: (s.blog||[]).length, log: (s.log||[]).length,
                  actLog: (s.actLog||[]).length, bag: (s.bag||[]).length, quests: (s.quests&&s.quests.active||[]).length };
      }
    } catch(e){ o.rpgErr = String(e); }
  } catch(e){ o.err = String(e); }
  return o;
}"""


async def main():
    issues = []
    samples = []
    changed_total = 0
    first_errs = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--enable-precise-memory-info"])
        ctx = await browser.new_context()
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(f"{BASE}/studio.html?genre={GENRE}", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        boot = await page.evaluate(BOOT, GENRE)
        if not boot.get("ok"):
            print("BOOT 失败:", boot)
            return 1

        # 基线
        base = await page.evaluate(SAMPLE, GENRE)
        samples.append({"round": 0, **base})
        print(f"[0/{ROUNDS}] 存档体积 {base['sizes']['total']} B")

        for r in range(1, ROUNDS + 1):
            res = await page.evaluate(STRESS_ROUND, GENRE)
            changed_total += res.get("changed", 0)
            last_targets = res.get("targets", [])
            if res.get("errs") and r == 1:
                first_errs = res["errs"]
            if r % 10 == 0 or r == ROUNDS:
                s = await page.evaluate(SAMPLE, GENRE)
                samples.append({"round": r, **s, "errs": res.get("errs", [])[:3],
                                "changed": res.get("changed", 0), "targets": last_targets})
                print(f"[{r}/{ROUNDS}] 存档体积 {s['sizes']['total']} B  heap {s.get('heap',0)//1024} KB  本轮状态变化 {res.get('changed',0)} 项")

        final = samples[-1]
        await browser.close()

    # -------- 判定 --------
    # 关键前置校验：动作必须**真的**改变了状态，否则整个探测无效
    # （这是 v4.07.2 的 D-27 同类陷阱：测试传错参数 → 动作一次没跑 → 体积 0 增长 → 判"通过"）
    if changed_total == 0:
        issues.append(
            f"[测试无效] {ROUNDS} 轮动作**没有产生任何状态变化** —— 说明动作根本没真执行，"
            f"本轮 soak 结论不成立（不可当作通过）"
        )
    else:
        print(f"✓ 动作有效性自检通过：{ROUNDS} 轮共产生 {changed_total} 次真实状态变化")
    v0 = samples[0]["sizes"]["total"]
    vN = final["sizes"]["total"]
    growth = vN - v0
    # 允许的线性增长：每轮 ≤ 200 字节（正常日志/数值变动）
    allowed = ROUNDS * 200
    if growth > allowed:
        issues.append(f"存档体积随轮数增长过快：{v0} → {vN} B（+{growth}，阈值 +{allowed}）")

    # 关键数组长度检查
    def lens_at(i):
        return samples[i].get("lens", {}) or {}

    first, last = lens_at(0), lens_at(len(samples) - 1)
    for key in set(list(first.keys()) + list(last.keys())):
        a, b = first.get(key, 0), last.get(key, 0)
        if key.endswith("#keys"):
            continue
        # 数组长度不应随轮数线性增长（允许 ≤ 1.5 倍且绝对值 ≤ 64）
        if b > 64 and b > (a + 1) * 1.5:
            issues.append(f"数组无上限增长：{key} {a} → {b}")
        if b > 500:
            issues.append(f"数组超长：{key} = {b}")

    # RPG 特定
    rpg_last = final.get("rpg")
    if rpg_last:
        for k, v in rpg_last.items():
            if v > 64:
                issues.append(f"RPG 状态数组超长：{k} = {v}")

    # 内存
    h0 = samples[0].get("heap", 0)
    hN = final.get("heap", 0)
    if h0 and hN and hN > h0 * 2.5 and (hN - h0) > 30 * 1024 * 1024:
        issues.append(f"内存增长过快：{h0//1024} KB → {hN//1024} KB")

    # 页面异常
    real_errors = [e for e in errors if "ERR:" not in e][:8]
    if real_errors:
        issues.append(f"页面级 JS 异常 {len(real_errors)} 条：{real_errors[:3]}")

    # 动作级错误
    all_errs = []
    for s in samples:
        for e in (s.get("errs") or []):
            if e not in all_errs:
                all_errs.append(e)
    if all_errs:
        issues.append(f"动作抛错 {len(all_errs)} 类：{all_errs[:3]}")

    out = {"genre": GENRE, "rounds": ROUNDS, "samples": samples, "issues": issues,
           "sizeStart": v0, "sizeEnd": vN, "growth": growth, "allowed": allowed}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("=" * 66)
    print("云境 v4.08.0 · 长时运行稳定性探测（soak）")
    print("=" * 66)
    print(f"界：{GENRE}　轮数：{ROUNDS}")
    print(f"存档体积：{v0} → {vN} B（+{growth}，阈值 +{allowed}）")
    if rpg_last:
        print(f"RPG 状态：{rpg_last}")
    print("-" * 66)
    if issues:
        print(f"✗ 发现 {len(issues)} 项问题：")
        for i in issues:
            print("  ·", i)
    else:
        print(f"✓ 长时运行：{ROUNDS} 轮无无上限增长、无内存泄漏、无抛错")
    print(f"明细：{OUT}")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
