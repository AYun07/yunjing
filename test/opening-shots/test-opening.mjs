import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:9123';
const OUT = '/workspace';
const results = [];
function ok(name, pass, extra='') { results.push({name,pass,extra}); console.log((pass?'✓':'✗')+' '+name+(extra?' — '+extra:'')); }

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless: true, args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });

// ---------- 桌面开场页 ----------
let ctx = await browser.newContext({ viewport:{width:1440,height:900} });
let page = await ctx.newPage();
let errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if(m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(BASE+'/opening.html', {waitUntil:'networkidle'});
await page.waitForTimeout(600);
const bg = await page.getAttribute('#bg','class');
ok('开场页-横屏用横版封面', bg.includes('landscape'), bg);
const entries = await page.$$eval('.entry .name', els=>els.map(e=>e.textContent));
ok('开场页-四入口齐全', JSON.stringify(entries)===JSON.stringify(['踏云','续梦','观星','造物']), entries.join('/'));
await page.screenshot({path:OUT+'/开场封面-桌面验收.png'});
ok('开场页-无JS错误', errs.length===0, errs.slice(0,2).join(' | '));

// 点击造物 → 跳转 xiaoyun.html
await page.click('.entry[data-go="forge"]');
await page.waitForURL('**/xiaoyun.html', {timeout:5000}).catch(()=>{});
await page.waitForTimeout(500);
ok('造物入口-跳转到小云工坊', page.url().includes('xiaoyun.html'), page.url());

// 小云工坊：形态/动作按钮数量 + 播放情绪视频
const formsN = await page.$$eval('#forms button', els=>els.length);
const emoN = await page.$$eval('#emoActs button', els=>els.length);
const baseN = await page.$$eval('#baseActs button', els=>els.length);
ok('小云工坊-12形态', formsN===12, ''+formsN);
ok('小云工坊-8情绪+3基础', emoN===8 && baseN===3, emoN+'+'+baseN);
const abN = await page.$$eval('#abGrid .ab', els=>els.length);
ok('小云工坊-能力展陈>=10项', abN>=10, ''+abN);
// 点第一个情绪按钮，检查 video 播放
await page.click('#emoActs button');
await page.waitForTimeout(900);
const playState = await page.$eval('#stage', el=>el.classList.contains('playing'));
const vsrc = await page.$eval('#video', el=>el.getAttribute('src'));
ok('小云工坊-情绪视频触发播放', playState && !!vsrc, vsrc);
await page.screenshot({path:OUT+'/小云工坊-桌面验收.png'});
// 输入触发
await page.fill('#say','太好了！');
await page.press('#say','Enter');
await page.waitForTimeout(600);
const logHtml = await page.$eval('#log', el=>el.textContent);
ok('小云工坊-话语触发动作', /欢呼|命中|太好了/.test(logHtml), logHtml.slice(0,60));
await ctx.close();

// ---------- 移动端开场页 ----------
ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
page = await ctx.newPage();
errs = [];
page.on('pageerror', e=>errs.push(String(e)));
await page.goto(BASE+'/opening.html', {waitUntil:'networkidle'});
await page.waitForTimeout(600);
const bgM = await page.getAttribute('#bg','class');
ok('开场页-竖屏用竖版封面', bgM.includes('portrait'), bgM);
await page.screenshot({path:OUT+'/开场封面-移动端验收.png'});
ok('开场页移动端-无JS错误', errs.length===0, errs.slice(0,2).join(' | '));

// 造物 → 小云工坊移动端
await page.click('.entry[data-go="forge"]');
await page.waitForTimeout(600);
await page.screenshot({path:OUT+'/小云工坊-移动端验收.png'});
ok('小云工坊-移动端可打开', page.url().includes('xiaoyun.html'), '');
await ctx.close();

// ---------- 入口分派：续梦/观星 ----------
ctx = await browser.newContext({ viewport:{width:1280,height:800} });
page = await ctx.newPage();
page.on('pageerror', e=>{});
await page.goto(BASE+'/index.html?entry=continue', {waitUntil:'domcontentloaded'});
await page.waitForTimeout(3500);
const urlCleared = !page.url().includes('entry=');
ok('续梦入口-参数已消费(地址清理)', urlCleared, page.url());
await ctx.close();
await browser.close();

const pass = results.filter(r=>r.pass).length;
console.log('\n===== 结果 '+pass+'/'+results.length+' =====');
if(pass<results.length) process.exit(1);
