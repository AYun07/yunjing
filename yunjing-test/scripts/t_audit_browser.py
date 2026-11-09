# -*- coding: utf-8 -*-
"""云境 v4.10.0 · 第三方审查缺陷「真浏览器」复现 / 回归资产
用 playwright 真 chromium 动态枚举全局符号（不信注释、不猜名字、不用正则数对象键）。
修复前建立基线，修复后重跑应全 PASS。
运行：python3 yunjing-test/scripts/t_audit_browser.py
"""
import sys, json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8899"
ALL_38 = ["shrouding","doupocangqiong","douluodalu","fanrenxiuxian","xianni","wanmeishijie",
          "swallowedstar","quanzhigaoshou","quanzhifashi","daoguiyixian","zhongshengdushi",
          "dibao","longzu","limingzhijian","lunhuileyuan","wulianfengdian","shengxu",
          "shenmifusu","ditandali","chaoshenxueyuan","zhanhen","jianlai","guimi",
          "guzhenren","xuanjianxianzu","quanqiubingfeng","cthulhu","earth","free",
          "freeworld","mystery","wuxia","scifi","dazhuzai","wangyou","wanxiangzhiwang",
          "wudongqiankun","yuanzun"]
NEW5 = ["dazhuzai","wangyou","wanxiangzhiwang","wudongqiankun","yuanzun"]

results = []
def rec(tag, ok, detail):
    results.append((tag, ok, detail))
    print(("  [OK]     " if ok else "  [DEFECT] ") + tag + "  ::  " + detail)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(service_workers="block")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.goto(BASE + "/studio.html?genre=free", wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(2200)

        # ---------- F9 / F11：动态枚举真实符号，逐界真加载 ----------
        print("\n=== F9 装备模块逐界真加载（15 代表界）===")
        check_genres = ["fanrenxiuxian","doupocangqiong","guimi","guzhenren","free",
                        "earth","mystery","wuxia","scifi","freeworld"] + NEW5
        gear_missing = []
        for g in check_genres:
            pg.goto(BASE + "/studio.html?genre=" + g, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_timeout(900)
            t = pg.evaluate("()=>typeof window.GearCore")
            if t == "undefined":
                gear_missing.append(g)
        rec("F9 装备模块在抽查 15 界均须加载", len(gear_missing) == 0,
            "缺失 " + str(len(gear_missing)) + "/15" + (": " + ",".join(gear_missing) if gear_missing else ""))

        # F11：ImmersiveSuite 是工厂函数，调用后取 .themes 的 Object.keys
        pg.goto(BASE + "/studio.html?genre=free", wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(1500)
        # demand 组：页面初始是占位 function，注入真身脚本覆盖后再取 themes（不信占位符）
        pg.add_script_tag(url=BASE + "/js/immersive-suite.js")
        pg.wait_for_timeout(300)
        th = pg.evaluate("""()=>{
          const I = window.ImmersiveSuite;
          const o = (typeof I==='function') ? I() : I;
          const keys = (o && o.themes) ? Object.keys(o.themes) : [];
          return {keys, hasFree: keys.indexOf('free')>=0, hasMystery: keys.indexOf('mystery')>=0,
                  missing5: %s.filter(g=>keys.indexOf(g)<0)};
        }""" % json.dumps(NEW5))
        rec("F11 默认界 free 不得套用悬疑主题", th["hasFree"] is True,
            "themes 键数 " + str(len(th["keys"])) + " ｜ 含 free " + str(th["hasFree"]) +
            " ｜ 五新界缺失 " + ",".join(th["missing5"]))
        rec("F11 五新界主题注册", len(th["missing5"]) == 0, "缺失 " + str(len(th["missing5"])) + " 界")

        # ---------- F7：五新界在 WORLDBOOK_SEEDS ----------
        wb = pg.evaluate("""()=>{
          const W = window.WORLDBOOK_SEEDS || {};
          return %s.filter(g=>!(g in W));
        }""" % json.dumps(NEW5))
        rec("F7 五新界世界书种子", len(wb) == 0, "缺失 " + ",".join(wb) if wb else "全部就位")

        # ---------- F8：张力双向演化（真加载 world-alive，只调 lifecycle）----------
        print("\n=== F8 张力演化（真加载 world-alive.js，注入状态源）===")
        tension = pg.evaluate("""()=>{
          // 构造最小状态真源：多势力 + 敌对边，反复 tick
          function mkState(t0){
            return { config:{genreKey:'wangyou'}, slotId:'main',
              storyState:{ turnCount:0, variables:{
                tension:t0,
                entities:{ factions:{
                  A:{name:'苍岚宗',influence:55,members:100,collapsed:false},
                  B:{name:'赤炎盟',influence:48,members:80,collapsed:false},
                  C:{name:'玄水阁',influence:40,members:60,collapsed:false}
                }, relations:{} }
              } } };
          }
          window.storyFramework = mkState(5);
          let out={start5:5,end5:null,start95:null,end95:null};
          try{
            for(let i=0;i<40;i++) window.WorldAlive.lifecycle();
            out.end5 = Number(window.storyFramework.storyState.variables.tension);
          }catch(e){out.err5=String(e);}
          window.storyFramework = mkState(95);
          try{
            for(let i=0;i<40;i++) window.WorldAlive.lifecycle();
            out.end95 = Number(window.storyFramework.storyState.variables.tension);
          }catch(e){out.err95=String(e);}
          return out;
        }""")
        up = tension.get("end5")
        # 验收口径：低张力须能自治上行（>+2 即视为已上行；5 轮稳定性测试已排除随机偶然）
        rec("F8 低张力(5)须能自治上行", (isinstance(up,(int,float)) and up > 5 + 2),
            "5 → " + str(up) + ((" err=" + tension["err5"]) if tension.get("err5") else ""))
        dn = tension.get("end95")
        rec("F8 高张力(95)须能回落", (isinstance(dn,(int,float)) and dn < 95 - 3),
            "95 → " + str(dn) + ((" err=" + tension["err95"]) if tension.get("err95") else ""))

        # F8 稳定性 + 因果内核不被改坏（报告基线：死敌 50→7.3 覆灭）
        f8extra = pg.evaluate("""()=>{
          function mk(t0,dead){
            window.storyFramework={config:{genreKey:'wangyou'},slotId:'main',storyState:{turnCount:0,variables:{
              tension:t0,entities:{factions:{
                A:{name:'苍岚宗',influence:50,members:100,collapsed:false},
                B:{name:'赤炎盟',influence:48,members:80,collapsed:false},
                C:{name:'玄水阁',influence:40,members:60,collapsed:false}},
                relations:dead?[{a:'苍岚宗',b:'赤炎盟',kind:'死敌',strength:50}]:[]}}}};
          }
          const ups=[];
          for(let i=0;i<5;i++){mk(5,false);for(let j=0;j<40;j++)window.WorldAlive.lifecycle();
            ups.push(Number(window.storyFramework.storyState.variables.tension));}
          mk(50,true);for(let j=0;j<40;j++)window.WorldAlive.lifecycle();
          const fs=window.storyFramework.storyState.variables.entities.factions;
          const infl=Object.keys(fs).map(k=>Number(fs[k].influence));
          return {ups,minInfl:Math.min.apply(null,infl),
                  allFinite:infl.every(x=>isFinite(x)&&x>=0&&x<=100)};
        }""")
        ups = f8extra.get("ups", [])
        rec("F8 低张力 5 轮独立实验均上行（非随机偶然）", len(ups)==5 and all(u>5 for u in ups),
            "5 轮末张力 " + str(ups))
        rec("F8 因果内核未坏（死敌覆灭低点≈7.3、数值全有限/不越界）",
            f8extra.get("allFinite") is True and 0 <= f8extra.get("minInfl", 0) <= 15,
            "势力 influence 最低 " + str(f8extra.get("minInfl")) + "（报告基线 7.3，可接受 0~15 有限低位）")

        # ---------- P1-8：登记块剥离移出 if（模拟懒加载未完成）----------
        print("\n=== P1-8 登记块在 CanonLedger/CanonTimeline 缺失时仍须剥离 ===")
        leak = pg.evaluate("""()=>{
          const H = window.StoryResponseHandler;
          const savedL = window.CanonLedger, savedT = window.CanonTimeline;
          let out={};
          try{
            delete window.CanonLedger; delete window.CanonTimeline;
            if(H._bodyCacheNoOpt) H._bodyCacheNoOpt.clear();
            const s = '他走进院子。(claimed) 掌天瓶=玩家 (/claimed)(world) 大事：血色试炼 occurred (/world)尾巴收束。';
            out.claimed = String(H.extractBody(s,[])||'');
            if(H._bodyCacheNoOpt) H._bodyCacheNoOpt.clear();
            const s2 = '风起。(world) 诱因终结：旧盟解散 (/world)他握紧了剑。';
            out.world = String(H.extractBody(s2,[])||'');
          } finally { window.CanonLedger=savedL; window.CanonTimeline=savedT; }
          return out;
        }""")
        rec("P1-8 (claimed) 块不泄漏", "掌天瓶=玩家" not in leak.get("claimed","") and "(claimed)" not in leak.get("claimed",""),
            repr(leak.get("claimed",""))[:90])
        rec("P1-8 (world) 块不泄漏", "旧盟解散" not in leak.get("world","") and "(world)" not in leak.get("world",""),
            repr(leak.get("world",""))[:90])

        # ---------- P1-10：vault 导出含 worldExt_ / yunjingWorldRuntime~ ----------
        print("\n=== P1-10 保险箱整机导出须含 RPG 数值键 ===")
        pg.add_script_tag(url=BASE + "/js/vault.js")   # demand 组真身
        pg.wait_for_timeout(300)
        vault = pg.evaluate("""()=>{
          try{
            localStorage.setItem('worldExt_wangyou','{"wr_rpg":{"lv":9,"gold":500}}');
            localStorage.setItem('yunjingWorldRuntime~main~wangyou','{"t":1}');
            const V = window.YunjingVault;
            const pkg = V.pack('all');
            const all = Object.assign({}, pkg.saves, pkg.config, pkg.data);
            const keys = Object.keys(all);
            return { total:keys.length, hasWorldExt: keys.some(k=>k.indexOf('worldExt_')===0),
                     hasRuntime: keys.some(k=>k.indexOf('yunjingWorldRuntime')===0) };
          }catch(e){ return {error:String(e)}; }
        }""")
        rec("P1-10 导出含 worldExt_ 键", vault.get("hasWorldExt") is True, str(vault))
        rec("P1-10 导出含 yunjingWorldRuntime~ 键", vault.get("hasRuntime") is True, str(vault))

        # ---------- P1-9 / P2：委托缺 gold / need，RPG 数值上限 ----------
        print("\n=== P1-9 / P2 委托与数值健壮性 ===")
        rpg = pg.evaluate("""()=>{
          const C = window.RPGCore; let out={};
          if(!C) return {noRPGCore:true};
          // 委托交付缺 gold → 走引擎真实 act('qturnin') 链路（不手工 += undefined）
          try{
            let st = C.initState ? C.initState('wangyou') : {};
            st.gold = 500;
            st.quests = { offers:[], active:[{id:'q1',state:'done',title:'测试',t:'kill',cur:1,need:1}], done:0,expired:0,failed:0,boardDay:-1,boardRound:-1 };
            const mod = C.module('wangyou');
            mod.act(st, {}, 'qturnin', 'q1');   // 缺 gold/exp/rep 的完成委托交付
            out.goldAfterNaN = st.gold;
          }catch(e){out.e1=String(e);}
          // 缺 need 的委托：cur 是否 NaN 卡死
          try{
            let st2 = C.initState ? C.initState('wangyou') : {};
            st2.quests = { offers:[], active:[{id:'q2',state:'active',title:'无need',t:'kill',cur:0}], done:0,expired:0,failed:0,boardDay:-1,boardRound:-1 };
            if(C.normalizeState) st2 = C.normalizeState(st2,'wangyou') || st2;
            const q = (st2.quests && st2.quests.active[0])||{};
            out.need = q.need; out.cur = q.cur;
          }catch(e){out.e2=String(e);}
          // 数值上限：lv 极大 → maxHp 不应 Infinity
          try{
            let st3 = C.initState ? C.initState('wangyou') : {};
            st3.lv = 1e308; st3.gold = 1e308;
            if(C.normalizeState) st3 = C.normalizeState(st3,'wangyou') || st3;
            out.lv = st3.lv; out.gold = st3.gold;
          }catch(e){out.e3=String(e);}
          return out;
        }""")
        rec("P1-9 交付缺 gold 委托后钱包须保持 500", rpg.get("goldAfterNaN") == 500,
            "gold=" + str(rpg.get("goldAfterNaN")) + " (期望 500；被洗成默认值即缺陷) " + str({k:v for k,v in rpg.items() if k.startswith("e")}))
        need = rpg.get("need")
        need_ok = isinstance(need,(int,float)) and need == need and need > 0
        rec("P2 委托缺 need 须回填为正整数", need_ok,
            "need=" + str(need) + " cur=" + str(rpg.get("cur")))
        rec("P2 RPG 数值须有上限（lv/gold 非 1e308）",
            (isinstance(rpg.get("lv"),(int,float)) and rpg["lv"] < 1e6) and (isinstance(rpg.get("gold"),(int,float)) and rpg["gold"] < 1e15),
            "lv=" + str(rpg.get("lv")) + " gold=" + str(rpg.get("gold")))

        # ---------- P2 world-ext STORE 惰性求值（切档写新槽）----------
        print("\n=== P2 切档后 worldExt_ 写新槽 ===")
        slotsw = pg.evaluate("""()=>{
          try{
            window.storyFramework.slotId='main';
            window.WorldExt.persist();
            const m=Object.keys(localStorage).filter(k=>k.indexOf('worldExt_')===0);
            window.storyFramework.slotId='sB';
            window.WorldExt.persist();
            const k=Object.keys(localStorage).filter(k=>k.indexOf('worldExt_')===0);
            return {hasB:k.some(x=>x.indexOf('~sB')>=0), bKeys:k.filter(x=>x.indexOf('~sB')>=0)};
          }catch(e){return {error:String(e)};}
        }""")
        rec("P2 切档后 worldExt_ 落进新槽键（非旧主档裸键）", slotsw.get("hasB") is True, str(slotsw))

        b.close()

    print("\n=== 汇总 ===")
    bad = [r for r in results if not r[1]]
    print("检查 " + str(len(results)) + " 项 ｜ [DEFECT] " + str(len(bad)) + " ｜ [OK] " + str(len(results)-len(bad)))
    if bad:
        print("待修:")
        for r in bad: print("  - " + r[0])
    print("pageerror:", errs[:5])

if __name__ == "__main__":
    main()
