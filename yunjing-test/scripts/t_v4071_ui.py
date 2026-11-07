#!/usr/bin/env python3
"""v4.07.1 定向回归：角色名片改造 + 局势文案 + 状态栏去歧义 + 委托/势力/隐藏职业。
每项打印 ✅/❌，末行给「通过 N / M」。全部走真实页面，不 mock。"""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899") + "/studio.html?genre=wangyou"
PASS, FAIL = [], []


def T(name, ok, detail=""):
    (PASS if ok else FAIL).append(name)
    print(("✅ " if ok else "❌ ") + name + (("  " + str(detail)[:220]) if detail else ""))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block",
                                  extra_http_headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        await pg.goto(BASE, wait_until="domcontentloaded", timeout=60000)
        # 等 rpg 模块真正就位（懒加载），再打开角色面板
        try:
            await pg.wait_for_function("()=>{try{return !!(window.WorldExt&&window.WorldExt.modState&&window.WorldExt.modState('wr_rpg'));}catch(e){return false;}}", timeout=45000)
        except Exception:
            print("⚠ rpg 模块未就位")
        await pg.evaluate("()=>{ try{ window.WorldExt.act('wr_rpg'); }catch(e){} }")
        # act 可能早于 rpg-core 注入完成，轮询重试直到面板真正渲染
        for _ in range(12):
            try:
                await pg.wait_for_selector(".rpg-namecard", timeout=4000)
                break
            except Exception:
                await pg.evaluate("()=>{ try{ window.WorldExt.act('wr_rpg'); }catch(e){} }")
        await pg.wait_for_timeout(1200)

        # 显式切到各 tab（面板默认只显示 role，隐藏 tab 的 innerText 为空）
        async def switch_tab(name):
            await pg.evaluate("""(n)=>{ const b=Array.from(document.querySelectorAll('.rpg-tab[data-rpg-tab]')).find(x=>(x.innerText||'').includes(n)); if(b) b.click(); }""", name)
            await pg.wait_for_timeout(600)
        await switch_tab("任务")
        await switch_tab("角色")

        # ---- 1. 角色名片 6 格 ----
        card = await pg.evaluate("""()=>{
          const c=document.querySelector('.rpg-namecard');
          if(!c) return null;
          const cells=Array.from(c.children).map(e=>e.innerText.replace(/\\n/g,'|'));
          const r=c.getBoundingClientRect();
          const over=Array.from(c.children).filter(e=>{const b=e.getBoundingClientRect();
            return b.right>r.right+1||b.left<r.left-1||e.scrollWidth>e.clientWidth+2;}).length;
          return {cells,over};
        }""")
        T("1.1 角色名片存在且为 6 格", bool(card) and len(card["cells"]) == 6, card and card["cells"])
        if card:
            joined = " ".join(card["cells"])
            T("1.2 名片含位置/称号", "野狼谷" in joined and "寰宇纪元" in joined, joined[:80])
            T("1.3 名片含职业（不含 Lv.）", "职业" in joined and not re.search(r"Lv\.?\d", joined), joined[:80])
            T("1.4 名片含金币/声望", "金币" in joined and "声望" in joined)
            T("1.5 名片含世界日", re.search(r"第\s*\d+\s*日", joined) is not None, joined[:120])
            T("1.6 名片含委托计数", "委托" in joined and "进行中" in joined and "可接" in joined, joined[:120])
            T("1.7 名片无溢出/截断", card["over"] == 0, "over=" + str(card["over"]))

        # ---- 2. 顶部不再重复 Lv，等级改挂六维属性标题 ----
        roleTxt = await pg.evaluate("()=>{const e=document.querySelector('[data-rpg-pane=role]');return e?e.innerText:'NA';}")
        head = roleTxt.split("六维属性")[0] if "六维属性" in roleTxt else ""
        T("2.1 角色页顶部卡片已无 Lv 文本", re.search(r"Lv\.?\d", head) is None, head[:110])
        after = roleTxt.split("六维属性")[1] if "六维属性" in roleTxt else ""
        T("2.2 等级改挂到六维属性标题", re.search(r"Lv\.?\d", after) is not None, after[:60])

        # ---- 3. 状态栏无同名货币歧义 ----
        strip = await pg.evaluate("()=>{const e=document.getElementById('wxStrip');return e?e.innerText.replace(/\\n+/g,' | '):'NA';}")
        hudGold = re.search(r"💰\s*(\d+)\s*金币", strip)
        mktGold = re.search(r"🏪\s*(\d+)\s*市集", strip)
        T("3.1 状态栏 rpg 金币仍可见", bool(hudGold), strip[:200])
        T("3.2 市集货币已改名「市集」不再与金币同名", bool(mktGold), strip[:200])

        # ---- 4. 局势文案无「正在正在」 ----
        questTxt = await pg.evaluate("()=>{const e=document.querySelector('[data-rpg-pane=quest]');return e?e.innerText:'NA';}")
        T("4.1 局势文案无「正在正在」重复", "正在正在" not in questTxt,
          (questTxt[questTxt.find("当前局势"):questTxt.find("当前局势") + 90] if "当前局势" in questTxt else "no-sit"))
        T("4.2 局势卡正常渲染", "当前局势" in questTxt)

        # ---- 5. 世界日从第 1 日起 ----
        T("5.1 世界日显示为第 1 日而非第 0 日", "世界第 1 日" in questTxt,
          questTxt[questTxt.find("当前局势"):questTxt.find("当前局势") + 60] if "当前局势" in questTxt else "")

        # ---- 6. 委托板与名片计数一致 ----
        board = await pg.evaluate("""()=>{
          const w=window.WorldExt&&window.WorldExt.modState('wr_rpg');
          const st=w&&w.state; if(!st) return null;
          return {offers:(st.quests&&st.quests.offers||[]).length,active:(st.quests&&st.quests.active||[]).length,
                  day:st.worldDay,turn:st.worldTurn,mode:st.mode,
                  guild:(st.guild&&st.guild.name)||null};
        }""")
        T("6.1 委托板非空（沙盒即生成）", bool(board) and board["offers"] >= 4, board)
        if card:
            m = re.search(r"进行中\s*(\d+)\s*·\s*可接\s*(\d+)", " ".join(card["cells"]))
            T("6.2 名片委托计数与状态一致", bool(m) and board and int(m.group(1)) == board["active"] and int(m.group(2)) == board["offers"],
              m.groups() if m else "no-match")
        T("6.3 沙盒路线默认开启", bool(board) and board["mode"] == "sandbox", board and board["mode"])

        # ---- 7. 玩家自立门户 → 势力上图 ----
        gf = await pg.evaluate("""async ()=>{
          const w=window.WorldExt&&window.WorldExt.modState('wr_rpg'); if(!w) return {err:'nostate'};
          const before=Object.keys((window.storyFramework&&window.storyFramework.storyState&&window.storyFramework.storyState.variables&&window.storyFramework.storyState.variables.entities&&window.storyFramework.storyState.variables.entities.factions)||{}).length;
          window.WorldExt.act('wr_rpg','guild','found:灰烬同盟');
          await new Promise(r=>setTimeout(r,500));
          const vars=(window.storyFramework&&window.storyFramework.storyState&&window.storyFramework.storyState.variables)||{};
          const facs=(vars.entities&&vars.entities.factions)||{};
          const key=Object.keys(facs).find(k=>/玩家势力/.test(k));
          return {before,after:Object.keys(facs).length,key:key||null,
                  origin:key?(facs[key].origin||''):null,territory:key?(facs[key].territory||''):null};
        }""")
        T("7.1 自立门户后势力写入世界实体", bool(gf) and bool(gf.get("key")), gf)
        T("7.2 势力 origin 标记为 player", gf and gf.get("origin") == "player", gf)

        # ---- 8. 隐藏职业 20 个按分区展示 ----
        hid = await pg.evaluate("""()=>{
          const w=window.WorldExt&&window.WorldExt.modState('wr_rpg');
          const st=w&&w.state; if(!st) return null;
          return {count:(window.RPGCore&&window.RPGCore.WORLD)?Object.keys(window.RPGCore.WORLD.wangyou.hidden||{}).length:null};
        }""")
        htxt = await pg.evaluate("()=>{const e=document.querySelector('[data-rpg-pane=role]');return e?e.innerText:'NA';}")
        zones = len(re.findall(r"隐藏职业 ·", htxt))
        T("8.1 隐藏职业按分区分组展示（≥4 组）", zones >= 4, "zones=" + str(zones))
        T("8.2 原创隐藏职业出现在面板", "原创" in htxt)
        T("8.3 12 个原创隐藏职业名齐全",
          all(n in htxt for n in ["织梦人", "拾影者", "观星者", "逐风者", "恒誓者", "噬魂者",
                                  "器灵师", "影行者", "音刃者", "归墟行者", "灵枢使", "铸魂者"]),
          [n for n in ["织梦人", "拾影者", "观星者", "逐风者", "恒誓者", "噬魂者",
                       "器灵师", "影行者", "音刃者", "归墟行者", "灵枢使", "铸魂者"] if n not in htxt])

        # ---- 9. 沙盒/剧情双轨切换 ----
        sw = await pg.evaluate("""async ()=>{
          const r={};
          window.WorldExt.act('wr_rpg','mode','story'); await new Promise(x=>setTimeout(x,350));
          const w=window.WorldExt&&window.WorldExt.modState('wr_rpg');
          r.story=w&&w.state?w.state.mode:null;
          window.WorldExt.act('wr_rpg','mode','sandbox'); await new Promise(x=>setTimeout(x,350));
          const w2=window.WorldExt&&window.WorldExt.modState('wr_rpg');
          r.back=w2&&w2.state?w2.state.mode:null;
          return r;
        }""")
        T("9.1 剧情路线可切且可切回", sw.get("story") == "story" and sw.get("back") == "sandbox", sw)

        T("9.2 无页面错误", not errs, errs[:3])
        print("\n汇总: %d 通过 / %d 失败" % (len(PASS), len(FAIL)))
        if FAIL:
            print("失败项: " + "; ".join(FAIL))
        await b.close()
        sys.exit(1 if FAIL else 0)


asyncio.run(main())
