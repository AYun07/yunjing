import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:9144/';
const SHOT = '/workspace/';
// 一段"真实可用"的模块代码——等价于大模型 API 会返回的完整 HTML（有真实掷骰逻辑，非模板）
const REAL_MODULE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Noto Sans SC",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1a1530,#2d2450);color:#eae4ff;padding:24px}
.c{max-width:420px;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(244,216,150,.3);border-radius:20px;padding:28px;text-align:center}
h1{font-size:20px;color:#f4d896;margin-bottom:6px}.sub{font-size:12px;color:#a89fc8;margin-bottom:20px}
.dice{font-size:64px;margin:16px 0;min-height:76px}.btn{border:none;border-radius:12px;padding:13px 26px;font-size:15px;font-weight:700;color:#1a1530;cursor:pointer;background:linear-gradient(120deg,#f4d896,#e8b4d8)}
.res{margin-top:16px;font-size:14px;color:#cfc6ea;min-height:22px}</style></head><body>
<div class="c"><h1>🎲 随机世界骰子</h1><div class="sub">廿八界随机漫游 · API 真实生成版</div>
<div class="dice" id="d">⚄</div><button class="btn" onclick="roll()">掷一次 · 漫游廿八界</button>
<div class="res" id="r">点击下方按钮开始</div></div>
<script>var worlds=["云梦泽","赤炎岭","镜花谷","星陨海","青岚境","忘川渡","归一塔","万象渊"];
function roll(){var n=Math.floor(Math.random()*6)+1;var w=worlds[Math.floor(Math.random()*worlds.length)];
document.getElementById("d").textContent=["⚀","⚁","⚂","⚃","⚄","⚅"][n-1];
document.getElementById("r").textContent="掷出 "+n+" 点 → 抵达【"+w+"】";window.__lastRoll=n+"|"+w;}</script></body></html>`;

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('JS错误: ' + e.message));
const log = (...a) => console.log(...a);

try {
  // 拦截 chat/completions，模拟"大模型返回真实代码"
  await p.route('**/chat/completions', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: REAL_MODULE } }] })
    });
  });

  log('\n【API模式测试】模拟一个有效Key + API返回真实模块代码');
  await p.goto(BASE + 'xiaoyun.html');
  await p.waitForTimeout(700);
  await p.evaluate(() => { localStorage.removeItem('xy_modules'); localStorage.removeItem('xy_dev_cfg'); });
  await p.click('#grid .card button[data-i="0"]');
  await p.waitForTimeout(400);

  // 填入任意一个 base + key（请求被 mock 拦截，不会真发）
  await p.fill('.xy-dev input[placeholder="API 地址 (base url)"]', 'https://api.openai.com/v1');
  await p.fill('.xy-dev input[placeholder="模型名"]', 'gpt-4o-mini');
  await p.fill('.xy-dev input[type="password"]', 'sk-MOCK-KEY-FOR-TEST');
  await p.fill('.xy-dev textarea', '加一个「随机世界骰子」模块，廿八界随机漫游、命运三连抽、结果可回溯');
  await p.click('.xy-dev .go');
  await p.waitForTimeout(3000);

  const status = await p.$eval('.xy-dev .status', e => e.textContent);
  log('  生成状态:', status);
  const isDemo = /演示|内置模板/.test(status);
  log('  是否走了真实API分支:', isDemo ? '❌ 落到了演示回退' : '✅ 真实API代码');

  // 检查预览iframe里的真实交互
  const frame = p.frames().find(f => f !== p.mainFrame());
  let rollBefore = '', rollAfter = '';
  if (frame) {
    rollBefore = await frame.evaluate(() => document.getElementById('r')?.textContent || 'N/A');
    log('  模块初始文字:', rollBefore);
    // 真实点击"掷一次"按钮
    await frame.click('.btn');
    await p.waitForTimeout(200);
    rollAfter = await frame.evaluate(() => document.getElementById('r')?.textContent || 'N/A');
    log('  点击掷骰后:', rollAfter);
    log('  真实交互生效:', rollAfter !== rollBefore && /抵达/.test(rollAfter) ? '✅ 是' : '❌ 否');
  } else {
    log('  ⚠ 未找到预览iframe');
  }
  await p.screenshot({ path: SHOT + '实测7-API模式真实模块.png' });

  // 挂载
  await p.evaluate(() => { const t = [...document.querySelectorAll('.xy-dev .pbtn')].find(x => x.textContent.includes('挂载')); t && t.click(); });
  await p.waitForTimeout(300);
  const mods = await p.evaluate(() => JSON.parse(localStorage.getItem('xy_modules') || '[]'));
  log('  挂载模块:', JSON.stringify(mods.map(m => m.name)));
  log('  挂载代码含真实逻辑:', mods[0] && /function roll/.test(mods[0].html) ? '✅ 是' : '❌ 否');

  log('\n========== 汇总 ==========');
  log('JS错误数:', errs.length, errs.join(' | '));
  log('API模式分支:', isDemo ? '❌' : '✅', '| 真实交互:', /抵达/.test(rollAfter) ? '✅' : '❌', '| 挂载:', mods.length ? '✅' : '❌');

} catch (e) {
  log('!!! 异常:', e.message, e.stack);
} finally {
  await b.close();
}
