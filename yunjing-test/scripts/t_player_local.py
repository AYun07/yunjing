#!/usr/bin/env python3
"""v5.1.3 端到端玩家闭环回归（**不需要任何 API Key**）。

为什么要有它：
    现有 26 个浏览器级用例里，主线闭环（建角 → 存档 → 切档 → 导出 → 导入 → 刷新恢复）
    没有任何一条完整覆盖；而需要真模型的用例又因为「密钥由玩家自配」不能进 CI。
    于是「玩家最常走的那条路」实际上没人守 —— 一次存档路径的改动就可能悄悄弄坏它。

本用例只走**纯本地**能力（不需要模型接口）：
    ① 大厅 → 进入某界（真实链接）→ 创作室就绪
    ② 未配 API 时点「开始创作」→ 必须给出**明确引导**（不能静默无反应）
    ③ 本地设定角色立场/身份（不调模型）
    ④ 写正文并落盘
    ⑤ 新建第二档 → 切档 → 切回主档 → 主档正文还在
    ⑥ 导出全量备份（真实下载，校验文件落地且是合法 JSON/gzip）
    ⑦ **先把存档改坏，再全量恢复** → 备份能把数据盖回来（备份的意义就在这儿）
    ⑧ 刷新页面 → 存档仍在
    ⑨ 全程零 pageerror

命名说明：叫 t_player_local 而不是 t_player —— 后者是需要真模型密钥的用例（CI 会跳过），
本用例**不需要任何密钥**，因此能在 CI 里跑。分层靠 run-all.mjs 的 BROWSER_PAT，
排除靠 KEY_NEEDED（两条正则都不带本用例名，故它会进 browser 层且不会被跳过）。

用法：python3 yunjing-test/scripts/t_player_local.py
"""
import asyncio, base64, gzip, json, os, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yj_paths import ROOT, OUT_DIR  # noqa: E402

from playwright.async_api import async_playwright  # noqa: E402

BASE = os.environ.get("YJ_BASE", "http://127.0.0.1:8899")
GENRE = os.environ.get("YJ_GENRE", "free")

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), str(detail)[:160]))
    print(f"  [{'OK ' if ok else 'FAIL'}] {name}  {str(detail)[:120]}")


async def main():
    download_dir = tempfile.mkdtemp(prefix="yj-e2e-")
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(service_workers="block", accept_downloads=True)
        page = await ctx.new_page()
        perr = []
        page.on("pageerror", lambda e: perr.append(str(e)[:200]))

        # ① 大厅 → 创作室
        await page.goto(BASE + "/index.html", wait_until="load", timeout=45000)
        await page.wait_for_timeout(2200)
        hrefs = await page.eval_on_selector_all("a[href*='studio.html']", "els => els.map(e => e.getAttribute('href'))")
        check("大厅有界入口", len(hrefs) > 0, f"{len(hrefs)} 个")
        target = next((h for h in hrefs if "genre=" in h), None)
        await page.goto(BASE + "/" + (target or f"studio.html?genre={GENRE}").lstrip("/"),
                        wait_until="load", timeout=45000)
        await page.wait_for_timeout(2800)
        ready = await page.evaluate("""() => ({
            title: document.title,
            fw: !!window.storyFramework,
            slots: !!window.SaveSlots,
            identity: !!window.StoryIdentity
        })""")
        check("创作室核心模块就绪", ready["fw"] and ready["slots"], json.dumps(ready, ensure_ascii=False))

        # ② 未配 API 时点「开始创作」必须有明确引导
        guide = await page.evaluate("""async () => {
            const fw = window.storyFramework;
            if (!fw) return { ok: false, why: 'storyFramework 缺失' };
            if (fw.isApiConfigured()) return { ok: true, why: '已配 API（本用例跳过此项）' };
            const before = document.body.innerText.length;
            try { fw.guideToConfig(); } catch (e) { return { ok: false, why: 'guideToConfig 抛错: ' + e.message }; }
            await new Promise(r => setTimeout(r, 900));
            const txt = document.body.innerText || '';
            const modalOpen = !!(document.querySelector('#configModal, .config-modal, [id*=config][class*=modal]'));
            const hasMsg = /尚未配置|接口设置|API/.test(txt);
            return { ok: hasMsg || modalOpen, why: '提示=' + hasMsg + ' 弹窗=' + modalOpen + ' 文本增量=' + (document.body.innerText.length - before) };
        }""")
        check("未配 API 有明确引导", guide["ok"], guide.get("why", ""))

        # ③ 本地设定角色立场/身份（不调模型）
        role = await page.evaluate("""() => {
            const W = window.StorySetupWizard;
            const out = {};
            try {
                if (W && typeof W.setStance === 'function') { W.setStance('hero'); out.stance = true; }
                if (W && typeof W.setIdentity === 'function') { W.setIdentity('transmigrator'); out.identity = true; }
                if (W && typeof W.setRelation === 'function') { W.setRelation('alone'); out.relation = true; }
            } catch (e) { out.err = e.message; }
            return out;
        }""")
        check("可本地设定角色", role.get("stance") and not role.get("err"), json.dumps(role, ensure_ascii=False))

        # ④ 写正文并落盘
        wrote = await page.evaluate("""() => {
            try {
                const fw = window.storyFramework;
                fw.storyState.conversationHistory = fw.storyState.conversationHistory || [];
                fw.storyState.conversationHistory.push({ role: 'assistant', content: '雨停了。城门口的灯亮了一整夜。' });
                fw.storyState.variables = fw.storyState.variables || {};
                fw.storyState.variables.title = '端到端压测档';
                fw.storyState.variables.chapter = 1;
                fw.saveStory();
                return 'wrote';
            } catch (e) { return 'err:' + e.message; }
        }""")
        await page.wait_for_timeout(1000)
        landed = await page.evaluate("""() => {
            try {
                const raw = localStorage.getItem('storySave_' + window.storyFramework.genre);
                if (!raw) return { ok: false, why: '主存档键为空' };
                const obj = JSON.parse(raw);
                const hist = (obj.conversationHistory || []).length;
                return { ok: (obj.variables || {}).title === '端到端压测档' && hist >= 1, why: 'hist=' + hist };
            } catch (e) { return { ok: false, why: '解析失败: ' + e.message }; }
        }""")
        check("正文落盘可读回", wrote == "wrote" and landed["ok"], landed.get("why", wrote))

        # ⑤ 新建第二档 → 切档 → 切回主档
        slot_ops = await page.evaluate("""() => {
            try {
                const S = window.SaveSlots;
                const id = S.create('第二卷');
                S.switchTo(id);
                const inSecond = S.activeId() === id;
                S.switchTo('main');
                return { ok: inSecond && S.activeId() === 'main', id, inSecond, back: S.activeId() };
            } catch (e) { return { ok: false, why: e.message }; }
        }""")
        await page.wait_for_timeout(1200)
        kept = await page.evaluate("""() => {
            const fw = window.storyFramework;
            const vars = (fw.storyState && fw.storyState.variables) || {};
            const hist = (fw.storyState && fw.storyState.conversationHistory) || [];
            return { title: vars.title || '', hist: hist.length, slot: (window.SaveSlots && SaveSlots.activeId()) || '' };
        }""")
        check("切档往返后主档正文还在",
              slot_ops.get("ok") and kept["title"] == "端到端压测档" and kept["hist"] >= 1,
              json.dumps(kept, ensure_ascii=False))

        # ⑥ 导出全量备份（真实下载）
        try:
            async with page.expect_download(timeout=30000) as dl_info:
                await page.evaluate("() => window.SaveSlots.exportAll()")
            dl = await dl_info.value
            path = os.path.join(download_dir, dl.suggested_filename)
            await dl.save_as(path)
            size = os.path.getsize(path) if os.path.exists(path) else 0
            ok_json = False
            kind = "-"
            if size:
                # 存档包默认 gzip 压缩（.json.gz，体积约 1/5），先按 gzip 解，再按明文 JSON 试
                raw = open(path, "rb").read()
                if raw[:2] == b"\x1f\x8b":
                    kind = "gzip"
                    try:
                        raw = gzip.decompress(raw)
                    except Exception:
                        raw = b""
                else:
                    kind = "明文"
                if raw:
                    try:
                        obj = json.loads(raw.decode("utf-8"))
                        ok_json = isinstance(obj, dict) and len(obj) > 0
                    except Exception:
                        ok_json = False
            check("导出全量备份（真实下载）", size > 0 and ok_json,
                  f"{dl.suggested_filename} {size}B {kind} 合法JSON={ok_json}")
        except Exception as e:
            check("导出全量备份（真实下载）", False, str(e)[:140])

        # ⑦ 全量恢复导入（走真实导入路径：读文件 → 解压 → 解析 → 确认 → 快照 → 还原 → 刷新）
        #    先把标题改坏，导入后应被备份里的旧值盖回来 —— 这一步才真的验证了「备份能救命」。
        try:
            await page.evaluate("""() => {
                const fw = window.storyFramework;
                fw.storyState.variables.title = '导入前被改坏的标题';
                fw.saveStory();
            }""")
            await page.wait_for_timeout(600)
            raw_bytes = open(path, "rb").read()
            payload_b64 = base64.b64encode(raw_bytes).decode()
            await page.evaluate("""(b64) => {
                const bin = atob(b64);
                const buf = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
                const file = new File([buf], 'backup.json.gz', { type: 'application/gzip' });
                window.__importResult = 'started';
                /* 不 await：importAll 会停在「确认恢复」弹窗上等用户点击，
                   这里只负责触发，确认由测试随后点掉（否则互等死锁）。 */
                window.__importPromise = window.SaveSlots.importAll(file)
                  .then(() => { window.__importResult = 'done'; })
                  .catch((e) => { window.__importResult = 'err:' + (e && e.message || e); });
            }""", payload_b64)
            # 确认弹窗（UIDialog 自绘，不是原生 confirm）
            confirm_btn = page.locator('.ui-dialog-btn[data-act="ok"]').last
            try:
                await confirm_btn.wait_for(state="visible", timeout=6000)
                await confirm_btn.click()
            except Exception:
                pass
            # importAll 完成后会刷新页面
            await page.wait_for_timeout(4000)
            try:
                await page.wait_for_load_state("load", timeout=20000)
            except Exception:
                pass
            await page.wait_for_timeout(2600)
            restored = await page.evaluate("""() => {
                const fw = window.storyFramework;
                const vars = (fw.storyState && fw.storyState.variables) || {};
                return { title: vars.title || '', slots: (window.SaveSlots && SaveSlots.list().length) || 0 };
            }""")
            check("全量恢复能把数据盖回来", restored.get("title") == "端到端压测档",
                  json.dumps(restored, ensure_ascii=False))
        except Exception as e:
            check("全量恢复能把数据盖回来", False, str(e)[:140])

        # ⑧ 刷新后存档仍在
        await page.reload(wait_until="load", timeout=45000)
        await page.wait_for_timeout(2800)
        after = await page.evaluate("""() => {
            try {
                const fw = window.storyFramework;
                const vars = (fw.storyState && fw.storyState.variables) || {};
                return { title: vars.title || '', slots: (window.SaveSlots && SaveSlots.list().length) || 0 };
            } catch (e) { return { title: 'err:' + e.message }; }
        }""")
        check("刷新后存档仍在", after.get("title") == "端到端压测档", json.dumps(after, ensure_ascii=False))

        # ⑨ 零 pageerror
        check("全程零 pageerror", len(perr) == 0, str(perr[:3]))

        await browser.close()

    bad = [c for c in CHECKS if not c[1]]
    print("-" * 56)
    print(f"检查 {len(CHECKS)} 项 ｜ 通过 {len(CHECKS) - len(bad)} ｜ 失败 {len(bad)}")
    if bad:
        for name, _, detail in bad:
            print(f"  ✗ {name}  {detail}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    asyncio.run(main())
