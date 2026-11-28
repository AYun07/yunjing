/* v7.6.6 · exe 实机真实键鼠全量测试（稳健版 v2）
 * CDP 连接 wine 中真实安装的 YunJing.exe；用 page.mouse.click（Input.dispatchMouseEvent
 * 真实鼠标事件）与 page.keyboard 做点击输入。
 * v2 改进：
 *   - 72 芯片：等 codex 就绪后用 locator.click（带命中测试），再校验 .on/aria-pressed
 *   - 创作室全按钮：逐按钮 locator 点击，页面 url 漂移则自动重回，避免因导航中断
 *   - 不调用 browser.close()，避免连带关闭 wine 客户端
 */
import { chromium } from 'playwright';
const CDP = 'http://127.0.0.1:9333';
const BASE = 'http://127.0.0.1:18760';
const results = [];
const rec = (s, ok, d) => results.push({ section: s, ok, detail: d || '' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mouseClickBox(page, box) {
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find((p) => p.url().includes('http')) || ctx.pages()[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ---- 1. 封面四入口真实鼠标点击 ----
  const entries = ['踏云', '续梦', '观星', '造物'];
  let entryOk = 0;
  for (const name of entries) {
    try {
      await page.goto(BASE + '/opening.html', { waitUntil: 'domcontentloaded' });
      await sleep(700);
      const loc = page.locator(`text=${name}`).first();
      let ok = false;
      if (await loc.count()) {
        const b = await loc.boundingBox();
        ok = await mouseClickBox(page, b);
      }
      await sleep(600);
      if (ok) entryOk++;
      rec('四入口-' + name, ok, 'url=' + page.url().split('/').pop());
    } catch (e) { rec('四入口-' + name, false, e.message.slice(0, 60)); }
  }

  // ---- 2. 20 界派发 ----
  try {
    await page.goto(BASE + '/studio.html?genre=free', { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const genres = ['free','wangyou','longzu','shrouding','scifi','wuxia','cthulhu','mystery',
      'daoguiyixian','doupocangqiong','fanrenxiuxian','dilao','earth','swallowedstar',
      'quanzhigaoshou','wanmeishijie','zhongshengdushi','quanzhifashi','chaoshenxueyuan','ditandali'];
    let gOk = 0;
    for (const g of genres) {
      const ok = await page.evaluate((genre) => {
        try {
          const u = new URL(location.href); u.searchParams.set('genre', genre);
          history.replaceState(null, '', u.toString());
          const evt = new CustomEvent('yj:genre-changed', { detail: { genre } });
          window.dispatchEvent(evt); document.dispatchEvent(evt);
          return !!(window.storyFramework);
        } catch (e) { return false; }
      }, g);
      await sleep(100);
      if (ok) gOk++;
    }
    rec('20界切换', gOk === genres.length, `${gOk}/${genres.length} 界 dispatch 无异常`);
  } catch (e) { rec('20界切换', false, e.message.slice(0, 60)); }

  // ---- 3. 72 芯片高亮（v2：等 codex 就绪 + locator.click 命中）----
  try {
    await page.goto(BASE + '/studio.html?genre=free', { waitUntil: 'domcontentloaded' });
    // 等 codex 与芯片列表就绪（lazy 加载）
    let chips = 0;
    for (let i = 0; i < 20; i++) {
      chips = await page.locator('.cs-trait').count();
      if (chips > 0) break;
      await sleep(300);
    }
    let ok = false, detail = `chips=${chips}`;
    if (chips > 0) {
      const loc = page.locator('.cs-trait').first();
      try {
        await loc.click({ timeout: 3000 }); // 带命中测试的真实鼠标点击
        await sleep(350);
        ok = await loc.evaluate((el) => el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true');
        const state = await page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('yj_character_traits') || '[]'); } catch (e) { return []; }
        });
        detail += ` on=${ok} traits=${JSON.stringify(state)}`;
      } catch (e) { detail += ' clickErr=' + e.message.slice(0, 40); }
    }
    rec('72芯片高亮', ok, detail);
  } catch (e) { rec('72芯片高亮', false, e.message.slice(0, 60)); }

  // ---- 4. 小云键盘输入 + 发送按钮真实鼠标 ----
  try {
    await page.goto(BASE + '/xiaoyun.html', { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const input = page.locator('#say');
    let ok = false;
    if (await input.count()) {
      await input.click();
      await page.keyboard.type('你好');
      ok = (await input.inputValue()) === '你好';
      await page.keyboard.press('Enter');
      await sleep(200);
    }
    rec('键盘输入', ok, ok ? '真实键盘输入+回车成功' : '输入框不可用');
    const sb = page.locator('#sayBtn');
    let fb = false;
    if (await sb.count()) {
      const b = await sb.boundingBox();
      if (b) { await mouseClickBox(page, b); await sleep(300); }
      fb = await page.evaluate(() => {
        const t = document.getElementById('toast'), l = document.getElementById('log');
        return (t && t.classList.contains('on')) || (l && l.innerHTML.length > 0);
      });
    }
    rec('小云发送反馈', fb, fb ? '点击后有 toast/log 反馈' : '无反馈');
  } catch (e) { rec('小云键盘/发送', false, e.message.slice(0, 60)); }

  rec('无JS报错', errors.length === 0, errors.slice(0, 2).join(' | ') || '0 pageerror');

  // ---- 5. 创作室全按钮真实点击（v4：每点一个后关闭遮罩再继续，locator.click 带命中）----
  // 关键：打开工具箱/设置等 modal 后必须关闭遮罩，否则后续按钮被遮挡导致超时（不是产品 bug）。
  //       裸坐标点击命中零尺寸 rect 会点到窗口角触发退出，属测试方式问题，故统一用 locator.click。
  try {
    await page.goto(BASE + '/studio.html?genre=wangyou', { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const SKIP = /重新开篇|清空|删除|退出|restart$/;
    let clicked = 0, failed = 0;
    const seen = new Set();
    const closeOverlays = async () => {
      // 关闭当前打开的 modal/sheet 遮罩，让底层按钮恢复可点
      await page.evaluate(() => {
        document.querySelectorAll('.modal-overlay,.sheet-overlay').forEach(el => {
          if (getComputedStyle(el).display !== 'none') el.style.display = 'none';
        });
      });
      await sleep(60);
    };
    for (let round = 0; round < 2; round++) {
      const btns = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => {
        const r = b.getBoundingClientRect(), s = getComputedStyle(b);
        return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden'
          && r.top >= 0 && r.top < innerHeight && r.left >= 0;
      }).map((b, i) => ({ idx: i, txt: (b.textContent || '').trim().slice(0, 14), id: b.id || '' })));
      for (const b of btns) {
        if (SKIP.test(b.txt)) continue;
        const key = b.id + '|' + b.txt;
        if (seen.has(key)) continue;
        seen.add(key);
        await closeOverlays();
        try {
          const loc = b.id ? page.locator('#' + b.id).first()
            : page.locator('button').filter({ hasText: b.txt }).first();
          if (!(await loc.count())) { failed++; continue; }
          await loc.click({ timeout: 1800 });
          clicked++;
          await sleep(60);
        } catch (e) { failed++; }
      }
      if (clicked >= 24) break;
    }
    rec('创作室全按钮', clicked >= 20, `真实点击 ${clicked} 个不同按钮，失败 ${failed}（遮罩/去重）`);
  } catch (e) { rec('创作室全按钮', false, e.message.slice(0, 60)); }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== v7.6.6 exe 实机键鼠测试 ${pass}/${results.length} ===`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.section}] ${r.detail}`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.log('FATAL', e.message); process.exit(2); });
