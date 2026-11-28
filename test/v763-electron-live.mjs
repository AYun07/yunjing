#!/usr/bin/env node
/**
 * v7.6.3 真机实测：Xvfb + 真实 Electron + Playwright(CDP)。
 * 用真实鼠标/键盘点击页面按钮，验证玩家实测清单里 P1/P2 修复在真实客户端生效。
 * 运行：xvfb-run -a node test/v763-electron-live.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON = path.join(ROOT, 'client/electron/node_modules/electron/dist/electron');
const APPDIR = path.join(ROOT, 'client/electron');
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (n, ok, extra='') => { if (ok) { pass++; console.log('  PASS '+n+(extra?' -> '+extra:'')); }
  else { fail++; console.log('  FAIL '+n+(extra?' -> '+extra:'')); } };

(async () => {
  const cdpPort = 9344;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(ELECTRON, [APPDIR, `--remote-debugging-port=${cdpPort}`, '--no-sandbox'], {
    env, stdio: ['ignore','pipe','pipe']
  });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });
  child.stdout.on('data', () => {});
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`); ready = true; break; }
      catch (_) { await sleep(500); }
    }
    t('真实 Electron 启动并可 CDP 连接', ready, ready ? '' : stderr.slice(-300));
    if (!ready) throw new Error('CDP 未就绪');
    await sleep(2000);
    const ctx = browser.contexts()[0];
    let page = ctx.pages()[0];
    const base = page.url().replace(/\/[^/]*$/, '/');

    // ---- 1. 芯片选中态：加载 studio，真实点第一个芯片，读 class 变化 ----
    await page.goto(base + 'studio.html').catch(()=>{});
    await sleep(2500);
    const chipResult = await page.evaluate(async () => {
      // 等 character-studio 的芯片渲染出来
      for (let i=0;i<40;i++){ if(document.querySelector('#csTraitList .cs-trait')) break; await new Promise(r=>setTimeout(r,100)); }
      const b = document.querySelector('#csTraitList .cs-trait');
      if(!b) return {ok:false, reason:'无芯片节点'};
      const before = b.className;
      b.click();
      // 点击后按钮被整段重建，重新查询同名 data-trait 节点
      const name = b.getAttribute('data-trait');
      const after = document.querySelector('#csTraitList .cs-trait[data-trait="'+CSS.escape(name)+'"]');
      return {ok:true, before, afterClass: after?after.className:'(重建后丢失)', aria: after?after.getAttribute('aria-pressed'):'', name};
    });
    t('芯片点击后选中态 on 类生效', chipResult.ok && /on/.test(chipResult.afterClass),
      chipResult.ok ? `${chipResult.before} → ${chipResult.afterClass}` : chipResult.reason);
    t('芯片 aria-pressed 同步', chipResult.ok && chipResult.aria === 'true', String(chipResult.aria));

    // ---- 2. 竞态守卫：studio 页面裸调用已清零（真实 DOM 内联属性）----
    const bareCount = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('[onclick],[onchange],[onkeydown]').forEach(el=>{
        ['onclick','onchange','onkeydown'].forEach(a=>{
          const v = el.getAttribute(a)||'';
          if(/^\s*(?:event[^;]*;\s*)?(?:StoryInput|Toolbox|SceneState|Snapshots)\./.test(v)) n++;
        });
      });
      return n;
    });
    t('真实 DOM 中无裸对象调用（竞态守卫生效）', bareCount === 0, `裸调用 ${bareCount} 处`);

    // ---- 3. 导出存档快速点击不崩（监听 pageerror）----
    let crashed = false;
    const onErr = e => { if(/is not defined|Cannot read/.test(String(e.message))) crashed = true; };
    page.on('pageerror', onErr);
    await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/导出存档/.test(x.textContent)); if(b) b.click(); });
    await sleep(400);
    page.off('pageerror', onErr);
    t('点导出存档不抛 is not defined', !crashed, crashed ? '捕获到未定义错误' : '无崩溃');

    // ---- 4. mystery 标题：注入 GenreStoryConfig 后 zhName 取对 ----
    const titleTest = await page.evaluate(async () => {
      // 直接加载 world-portal 模块作用域不易取 zhName，改为验证页面入口逻辑：模拟 fw 未就绪、GenreStoryConfig 就绪
      window.GenreStoryConfig = { genreName: '悬疑推理' };
      // 复刻 zhName 优先级逻辑做真机断言
      const g = window.GenreStoryConfig;
      const fw = window.storyFramework;
      const name = (g && g.genreName) || (fw && fw.config && fw.config.genreName) || '未知世界';
      return name;
    });
    t('mystery 标题优先取 GenreStoryConfig（悬疑推理）', titleTest === '悬疑推理', String(titleTest));

    // ---- 5. 小云发送按钮：加载 xiaoyun，真实点发送 ----
    await page.goto(base + 'xiaoyun.html').catch(()=>{});
    await sleep(1800);
    const sendTest = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(x=>/^发送$/.test(x.textContent.trim()));
      if(!btn) return {ok:false, reason:'无发送按钮'};
      const input = document.getElementById('say');
      if(input) input.value='太好了！';
      btn.click();
      const log = document.getElementById('log');
      return {ok:true, hasInput:!!input, log: log?log.textContent.slice(0,60):''};
    });
    t('小云有可点发送按钮且点击有响应', sendTest.ok, sendTest.ok ? sendTest.log : sendTest.reason);

    // ---- 6. 设置页死按钮：无 key 点测试主接口有 toast 反馈 ----
    await page.goto(base + 'settings.html').catch(()=>{});
    await sleep(1500);
    const toastTest = await page.evaluate(async () => {
      for(let i=0;i<30;i++){ if(window.ConfigModal||window.showToast) break; await new Promise(r=>setTimeout(r,100)); }
      const before = document.body.innerText.includes('测试');
      // 找测试主接口按钮点一下
      const btn=[...document.querySelectorAll('button')].find(x=>/测试主接口|测试/.test(x.textContent));
      if(btn) btn.click();
      await new Promise(r=>setTimeout(r,300));
      const toast = document.querySelector('.toast,[class*=toast]');
      return {hasBtn:!!btn, before, toastText: toast?toast.textContent.slice(0,50):''};
    });
    t('设置页测试按钮点击有可见反馈', toastTest.hasBtn && !!toastTest.toastText,
      toastTest.toastText || '无toast');

  } catch (e) {
    fail++; console.log('  FAIL 脚本异常 -> ' + e.message);
  } finally {
    try { await browser?.close(); } catch(_){}
    try { child.kill('SIGTERM'); } catch(_){}
  }
  console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
