// 云境 · 随行存在专属档案桥接回归（原创实现）
// 用法：node test/beast-profile-regression.mjs
// 零依赖 vm 沙箱：加载 beast-system + 四套角色系统 + 桥接层，验证档案/化形/性格/亲密/版权五组断言。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const G = (name) => console.log('\n### ' + name);
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ ' + msg); } };

function makeSandbox() {
  const mem = {};
  const ls = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem(k, v) { mem[k] = String(v); },
    removeItem(k) { delete mem[k]; },
    clear() { for (const k of Object.keys(mem)) delete mem[k]; }
  };
  const noopEl = () => ({
    style: { cssText: '' }, classList: { add() {}, remove() {} },
    setAttribute() {}, addEventListener() {}, appendChild() {},
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; },
    set textContent(v) { this._t = v; }, get textContent() { return this._t || ''; }
  });
  const sb = {
    console, Math, JSON, Date, Number, String, Object, Array, Set, isFinite, isNaN,
    localStorage: ls,
    setInterval: () => 99, clearInterval() {}, setTimeout: () => 99, clearTimeout() {},
    addEventListener() {}, showToast() {}, showMessage() {},
    storyFramework: { slotId: 'main', storyState: { turnCount: 3, world: 'default' } },
    document: {
      head: noopEl(), body: noopEl(),
      getElementById() { return null; },
      createElement() { return noopEl(); },
      querySelectorAll() { return []; }
    }
  };
  sb.window = sb; sb.globalThis = sb;
  sb.__mem = mem;
  sb.MoChibi = { say() {} };
  return sb;
}

function load(sb, withDeps = true) {
  vm.createContext(sb);
  if (withDeps) {
    vm.runInContext(read('js/npc-chronicle.js'), sb);
    vm.runInContext(read('js/psyche-model.js'), sb);
    vm.runInContext(read('js/personality-codex.js'), sb);
    vm.runInContext(read('js/intimacy-archive.js'), sb);
  }
  vm.runInContext(read('js/beast-system.js'), sb);
  vm.runInContext(read('js/beast-profile-bridge.js'), sb);
  return { BS: sb.BeastSystem, BP: sb.BeastProfileBridge, NC: sb.NPCChronicle, PC: sb.PersonalityCodex, PM: sb.PsycheModel, IA: sb.IntimacyArchive };
}

/* ============ 0. 加载 ============ */
G('0. 模块加载与版本');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  ok(!!BS && !!BP, 'BeastSystem 与 BeastProfileBridge 均已挂载');
  ok(BP.VERSION === '4.49.0', '桥接层版本号 4.49.0');
  const st = BP.stats();
  ok(st.deps.chronicle && st.deps.personality && st.deps.psyche && st.deps.intimacy && st.deps.beast, '五套依赖全部就绪');
}

/* ============ 1. 化形判定 ============ */
G('1. 化形：部分可、非全部');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  const spirit = BS.contract({ kind: 'spirit', name: '青羽鹤', species: '风属性灵禽', realmIdx: 6, trait: '灵动' });
  const lowDemon = BS.contract({ kind: 'demon', name: '赤焰狼', species: '火属性妖兽', realmIdx: 2, trait: '桀骜' });
  const pet = BS.contract({ kind: 'pet', name: '雪团', species: '绒耳貂', trait: '黏人' });
  const spiritPet = BS.contract({ kind: 'pet', name: '九尾崽', species: '灵狐', trait: '化形' });
  const companion = BS.contract({ kind: 'companion', name: '阿砚', species: '流浪剑客', trait: '重诺' });
  ok(BP.canTransform(spirit) === true, '高位阶灵兽可化形');
  ok(BP.canTransform(lowDemon) === false, '低位阶妖兽不可化形（需达通达位阶）');
  ok(BP.canTransform(pet) === false, '寻常宠物不可化形');
  ok(BP.canTransform(spiritPet) === true, '灵异血统宠物可化形');
  ok(BP.canTransform(companion) === true, '人形伙伴本相即人形');
  ok(BP.transformInfo(companion).transformed === true, '伙伴默认即人形');
  ok(BP.transformInfo(spirit).formName.indexOf('灵使') >= 0, '灵兽化形名含身份称谓');
}

/* ============ 2. 化形动作与还原 ============ */
G('2. 化形 / 还原动作');
{
  const sb = makeSandbox();
  const { BS } = load(sb);
  const spirit = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6 });
  ok(BS.canTransform(spirit.id) === true, '本体 canTransform 委托桥接层正确');
  const a = BS.transform(spirit.id, true);
  ok(a && a.transformed === true, '化形为true生效');
  ok(!!a.transformForm, '生成人形形态名');
  const b = BS.transform(spirit.id, false);
  ok(b && b.transformed === false, '还原本相生效');
  const lowDemon = BS.contract({ kind: 'demon', name: '赤焰狼', realmIdx: 1 });
  ok(BS.transform(lowDemon.id) === null, '未达位阶者化形被拒');
  const companion = BS.contract({ kind: 'companion', name: '阿砚' });
  ok(BS.transform(companion.id, false).transformed === true, '伙伴不可还原为兽形');
}

/* ============ 3. 专属 NPC 档案（beast: 隔离 + 六项机制） ============ */
G('3. 专属档案：前缀隔离与生平');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  const b = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6, trait: '灵动', bond: 60, loyalty: 75 });
  ok(BP.profileId(b).indexOf('beast:') === 0, '档案 id 以 beast: 前缀隔离');
  const rec = BP.syncChronicle(b);
  ok(rec && rec.id === BP.profileId(b), '建档成功');
  ok(rec.disposition.trust === 75, '忠诚映射为信任轴');
  ok(rec.disposition.favor === 60, '羁绊映射为好感轴');
  ok(Array.isArray(rec.deeds) && rec.deeds.length >= 1, '首次建档写入来历生平');
  BP.addDeed(b, '在战斗中救下玩家', {}, 'combat');
  const after = BS.profile(b.id).chronicle;
  ok(after.deeds.some(d => d.text.indexOf('救下玩家') >= 0), '生平经历可追加');
  // 放归转 vault，只增不删
  const beforeVault = BP.stats().vault;
  BS.release(b.id);
  ok(BP.stats().vault === beforeVault + 1, '放归后完整快照转 vault（只增不删）');
  ok(BS.profile(b.id) === null, '放归后活动档案移除');
}

/* ============ 4. 性格 + 心理 + 行为演化 ============ */
G('4. 性格世界书与行为演化');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  const b = BS.contract({ kind: 'demon', name: '赤焰狼', species: '火属性妖兽', realmIdx: 6, trait: '桀骜', loyalty: 20 });
  const p = BP.personalityOf(b, 'default');
  ok(p.traits && p.traits.length >= 3, '每只宠物有多条性格特质');
  ok(p.traits.indexOf('桀骜') >= 0, '宠物固有特性纳入性格');
  ok(typeof p.brief === 'string' && p.brief.length > 0, '生成性格速写 brief');
  ok(p.psychology !== null, '心理模型档案已挂载');
  const b2 = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6, trait: '灵动' });
  ok(BP.personalityOf(b2, 'default').traits.join() !== p.traits.join(), '不同宠物性格不同（按名字散列）');
  const beh = BP.behaviorOf(b, { events: [{ text: '被玩家救助' }], days: 20 });
  ok(beh.tendency.length > 0, '行为演化输出倾向');
  ok(beh.psychology !== undefined, '行为演化含心理字段');
  // 本体 behavior 委托
  ok(BS.behavior(b.id, {}).tendency.length > 0, '本体 behavior 委托桥接层正确');
}

/* ============ 5. 三态形态（兽形/半兽形/人形） ============ */
G('5. 三态形态：循环切换与三态判定');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  const spirit = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6 });
  ok(BS.formStateOf(spirit) === 'beast', '新契约默认本相兽形');
  ok(BS.transform(spirit.id, 'half') && BS.formStateOf(BS.get(spirit.id)) === 'half', '可切半兽形');
  BS.transform(spirit.id, 'human');
  ok(BS.formStateOf(BS.get(spirit.id)) === 'human', '可切完全人形');
  var t = BS.transform(spirit.id); // next → beast
  ok(BS.formStateOf(t) === 'beast', 'next 循环 human→beast');
  var t2 = BS.transform(spirit.id); // next → half
  ok(BS.formStateOf(t2) === 'half', 'next 循环 beast→half');
  var t3 = BS.transform(spirit.id); // next → human
  ok(BS.formStateOf(t3) === 'human', 'next 循环 half→human');
  // 兼容旧调用：true/false
  ok(BS.formStateOf(BS.transform(spirit.id, false)) === 'beast', '旧调用 false → 兽形');
  ok(BS.formStateOf(BS.transform(spirit.id, true)) === 'human', '旧调用 true → 人形');
  // 桥接层三态字段
  var info = BP.transformInfo(BS.get(spirit.id));
  ok(info.formState === 'human' && info.isHumanoid === true && info.isBeast === false, '桥接层 transformInfo 三态字段一致');
  var halfInfo = BP.transformInfo({ kind: 'spirit', formState: 'half', name: '半兽' });
  ok(halfInfo.isHalfBeast === true && halfInfo.formLabel === '半兽形', '半兽形标记正确');
  var pet = BS.contract({ kind: 'pet', name: '雪团', trait: '黏人' });
  ok(BS.transform(pet.id, 'human') === null, '不可化形者三态切换被拒（恒兽形）');
}

/* ============ 6. 亲密档案：默认关 + 两门槛 + 三态均可 ============ */
G('6. NSFW 亲密档案：默认关 + 两门槛 + 三态均可');
{
  const sb = makeSandbox();
  const { BS, BP, IA } = load(sb);
  const spirit = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6 });
  // 门槛1：默认关
  ok(BP.eligibleNSFW(spirit).ok === false, '默认未开启亲密资格');
  BS.setNsfwEligible(spirit.id, true);
  // 门槛2：系统未开
  if (IA && IA.setEnabled) IA.setEnabled(false);
  ok(BP.eligibleNSFW(BS.get(spirit.id)).ok === false, '开资格但系统未开启仍不可');
  if (IA && IA.setEnabled) IA.setEnabled(true);
  // 两门槛满足：兽形即可建（v4.49.0 核心诉求）
  var beastNow = BS.get(spirit.id);
  ok(BS.formStateOf(beastNow) === 'beast', '当前处于兽形');
  ok(BP.eligibleNSFW(beastNow).ok === true, '兽形 + 资格 + 系统开启 → 可建亲密档案');
  // 半兽形
  BS.transform(spirit.id, 'half');
  ok(BP.eligibleNSFW(BS.get(spirit.id)).ok === true, '半兽形 + 资格 + 系统开启 → 可建亲密档案');
  // 人形
  BS.transform(spirit.id, 'human');
  ok(BP.eligibleNSFW(BS.get(spirit.id)).ok === true, '人形 + 资格 + 系统开启 → 可建亲密档案');
  // 三态共用一份档案 key（不各建、不串档）
  var keyBeast = BP.intimacyKey({ id: 'x', name: 'x' });
  var keyHuman = BP.intimacyKey({ id: 'x', name: 'x', formState: 'human', transformForm: '化形' });
  ok(keyBeast === keyHuman, '亲密档案 key 三态共用（按 id，不按形态名）');
  ok(keyBeast.indexOf('灵宠·') === 0, '亲密档案 key 灵宠前缀隔离');
  // 不可化形宠物：v4.49.0 起兽形也可亲密
  const pet = BS.contract({ kind: 'pet', name: '雪团', trait: '黏人' });
  BS.setNsfwEligible(pet.id, true);
  ok(BP.eligibleNSFW(BS.get(pet.id)).ok === true, '不可化形宠物兽形 + 资格 + 系统开启 → 可建亲密档案');
  // 表达尺度沿用玩家三档
  const scales = IA.expressionInfo ? IA.expressionInfo().options.map(o => o.key || o.id || o.value) : [];
  ok(Array.isArray(scales) && scales.length === 3, '表达尺度沿用玩家三档设置');
}

/* ============ 7. 存档兼容 ============ */
G('6. 存档兼容：老宠物记录缺新字段');
{
  const sb = makeSandbox();
  // 直接塞一条老格式（无 canTransform/transformed/nsfwEligible 等字段）到 localStorage
  sb.__mem['yunjingBeasts~main'] = JSON.stringify([
    { id: 'old1', name: '老雪团', kind: 'pet', species: '绒耳貂', realmIdx: 0, level: 1,
      stats: { hp: 30, atk: 8, def: 6, spd: 14 }, skills: ['伴护'], bond: 30, status: 'active',
      loyalty: 50, stance: '忠诚', goal: '守护主人', mood: '平静', trait: '黏人', born: 1 }
  ]);
  const { BS, BP } = load(sb);
  const list = BS.list();
  ok(list.length === 1, '老存档可读取');
  ok(BP.canTransform(list[0]) === false, '老记录缺字段时化形判定走兜底');
  ok(BP.profileId(list[0]).indexOf('beast:') === 0, '老记录可正常建档');
  ok(typeof BS.profile(list[0].id) === 'object', '老记录可正常查看专属档案');
}

/* ============ 8. prompt 注入 ============ */
G('7. 主笔 prompt 注入');
{
  const sb = makeSandbox();
  const { BS, BP } = load(sb);
  const b = BS.contract({ kind: 'spirit', name: '青羽鹤', realmIdx: 6, trait: '灵动' });
  const block = BP.buildPromptBlock([b]);
  ok(block.indexOf('青羽鹤') >= 0, 'prompt 含随行存在名');
  ok(block.indexOf('性格') >= 0 || block.indexOf('特性') >= 0, 'prompt 含性格/特性');
  const combined = BS.buildPromptBlock();
  ok(combined.indexOf('专属档案') >= 0 || combined.indexOf('性格') >= 0, '本体 prompt 叠加专属档案块');
}

/* ============ 9. 版权红线回归 ============ */
G('8. 版权：专属词与项目名零残留');
{
  const bridge = read('js/beast-profile-bridge.js');
  const beast = read('js/beast-system.js');
  const banned = ['SillyTavern', 'st-yuzi', 'Connection Profiles', 'zhushen-space', '契约者', '土著', '随从'];
  for (const kw of banned) {
    ok(bridge.indexOf(kw) < 0, '桥接层无「' + kw + '」');
    ok(beast.indexOf(kw) < 0, '本体无「' + kw + '」');
  }
}

console.log('\n================ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ================');
if (fail > 0) process.exit(1);
