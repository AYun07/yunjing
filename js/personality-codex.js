/* ============================================================================
 * 云境 · 人物性格世界书（Personality Codex）  v4.45.0
 * ----------------------------------------------------------------------------
 * 用途：为云境全部世界、全部角色（含玩家自定义、未来新世界）提供确定性的
 *       性格档案。任意「角色名 + 世界」无需预先录入即可即时生成一份完整、
 *       可复现、彼此不雷同的性格；并对 configs 抽取的真实角色建预置索引。
 *
 * 版权声明（重要）：
 *   本文件实现的是通用角色扮演游戏设计中的「性格原型 / 性格维度」机制思想，
 *   该类思想属游戏设计通用概念，不受著作权保护。本文件的字段命名、数据结构、
 *   散列算法（FNV-1a + mulberry32）、原型库文案、取向分类、状态逻辑均为
 *   云境项目组独立编写，未复制/改写/翻译任何第三方项目的源码、标识符、
 *   提示词或数据定义，也未引用任何原著作品的角色设定原文。
 *
 * 设计约束：零依赖、原生 JS、无构建；挂 window.PersonalityCodex；
 *           核心为纯函数/确定性计算，可在 Node vm 沙箱回归。
 * ========================================================================== */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var VERSION = '1.0.0';

  /* ---------- 确定性工具（原创实现） ---------- */
  function fnv1a(str) {
    var h = 2166136261;
    str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }
  function pickN(rnd, arr, n) {
    var pool = arr.slice(), out = [];
    while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }

  /* ---------- 五维关系轴（与关系模型共用命名，供性格影响系数使用） ---------- */
  var REL_AXES = ['favor', 'trust', 'esteem', 'closeness', 'desire'];

  /* ---------- 三类取向原型库（全部原创文案） ---------- */
  var ARCHETYPES = {
    positive: [
      { name: '仁厚长者', traits: ['宽和', '守信', '护短', '忍耐'], speech: '语缓而稳，先安人心再论是非', habit: '习惯替晚辈善后', likes: ['和睦', '旧友', '清茶'], dislikes: ['背信', '恃强凌弱'], bottomLine: '伤及无辜者', bias: { favor: 1.15, trust: 1.2, esteem: 1.1, closeness: 1.1, desire: 0.9 } },
      { name: '热血侠士', traits: ['直率', '重义', '急性', '坦荡'], speech: '声如洪钟，快人快语', habit: '路见不平先出手后问名', likes: ['痛饮', '知己', '快意恩仇'], dislikes: ['权谋', '吞吞吐吐'], bottomLine: '背弃同伴', bias: { favor: 1.25, trust: 1.05, esteem: 1.0, closeness: 1.2, desire: 1.05 } },
      { name: '清冷高士', traits: ['自持', '敏锐', '寡言', '洁身'], speech: '字句精炼，弦外有音', habit: '独坐时以指叩案', likes: ['静夜', '好书', '雪'], dislikes: ['喧哗', '谄媚'], bottomLine: '以强凌弱', bias: { favor: 0.9, trust: 1.15, esteem: 1.25, closeness: 0.95, desire: 0.85 } },
      { name: '温润良医', traits: ['细致', '悲悯', '耐心', '克制'], speech: '语气温和，常带宽慰', habit: '随手照料身边伤病', likes: ['草木', '秩序', '温粥'], dislikes: ['浪费生命', '鲁莽'], bottomLine: '见死不救', bias: { favor: 1.2, trust: 1.15, esteem: 1.05, closeness: 1.15, desire: 0.9 } },
      { name: '乐观乐天', traits: ['豁达', '幽默', '好奇', '健谈'], speech: '语调轻快，爱打趣', habit: '遇挫先笑再想办法', likes: ['热闹', '新鲜事', '美食'], dislikes: ['死气沉沉', '算计'], bottomLine: '出卖朋友', bias: { favor: 1.3, trust: 1.0, esteem: 0.95, closeness: 1.25, desire: 1.1 } },
      { name: '忠诚守护', traits: ['坚毅', '寡言', '尽责', '牺牲'], speech: '简短笃定，不多许诺', habit: '总是站在最危险的位置', likes: ['职责', '晴天', '旧甲'], dislikes: ['失职', '空谈'], bottomLine: '护主不力', bias: { favor: 1.1, trust: 1.25, esteem: 1.1, closeness: 1.1, desire: 0.85 } }
    ],
    negative: [
      { name: '阴鸷谋士', traits: ['多疑', '深沉', '记仇', '精算'], speech: '话留半句，常以反问试探', habit: '谈话时反复捻指', likes: ['掌控', '棋局', '深夜'], dislikes: ['失控', '坦诚到愚蠢'], bottomLine: '被人看穿底牌', bias: { favor: 0.85, trust: 0.6, esteem: 1.1, closeness: 0.8, desire: 1.0 } },
      { name: '倨傲贵胄', traits: ['傲慢', '挑剔', '自尊', '冷酷'], speech: '语调居高，字带轻蔑', habit: '以鼻息回应不屑之人', likes: ['尊崇', '珍馐', '名器'], dislikes: ['冒犯', '平庸'], bottomLine: '折损颜面', bias: { favor: 0.8, trust: 0.9, esteem: 0.7, closeness: 0.85, desire: 1.05 } },
      { name: '贪婪商侩', traits: ['逐利', '精明', '圆滑', '寡情'], speech: '笑面迎人，话里藏账', habit: '每笔往来都要记在心里', likes: ['金银', '契约', '便宜'], dislikes: ['吃亏', '讲义气到亏本'], bottomLine: '到手的利被夺', bias: { favor: 0.9, trust: 0.7, esteem: 0.9, closeness: 0.8, desire: 1.15 } },
      { name: '暴戾武夫', traits: ['暴躁', '好斗', '记仇', '直蛮'], speech: '声高气粗，动辄讥讽', habit: '不快时攥紧拳节', likes: ['角力', '烈酒', '征服'], dislikes: ['被轻视', '迂回'], bottomLine: '当众受辱', bias: { favor: 0.8, trust: 0.85, esteem: 0.8, closeness: 0.9, desire: 1.2 } },
      { name: '虚伪君子', traits: ['伪善', '算计', '体面', '凉薄'], speech: '满口道义，句句留余地', habit: '在人前格外和蔼', likes: ['名声', '体面', '拥护'], dislikes: ['被揭短', '真性情'], bottomLine: '伪面被撕破', bias: { favor: 0.95, trust: 0.65, esteem: 0.95, closeness: 0.85, desire: 1.0 } },
      { name: '孤僻复仇者', traits: ['隐忍', '冷厉', '专注', '不信任'], speech: '简短阴冷，极少谈笑', habit: '独处时反复擦拭旧物', likes: ['独处', '旧仇线索', '雨'], dislikes: ['善意', '被打扰'], bottomLine: '仇人被宽恕', bias: { favor: 0.6, trust: 0.5, esteem: 1.0, closeness: 0.6, desire: 1.1 } }
    ],
    eccentric: [
      { name: '古怪 inventor', traits: ['跳脱', '痴迷', '博杂', '健忘'], speech: '话题跳跃，常自言自语', habit: '随身带着奇奇怪怪的小物件', likes: ['奇想', '实验', '失败'], dislikes: ['循规蹈矩', '无聊'], bottomLine: '被阻止探索', bias: { favor: 1.1, trust: 1.0, esteem: 0.9, closeness: 1.0, desire: 0.95 } },
      { name: '絮叨学究', traits: ['博闻', '啰嗦', '较真', '迂腐'], speech: '引经据典，一件事讲三重', habit: '纠正旁人用词', likes: ['考据', '藏书', '冷知识'], dislikes: ['不求甚解', '错字'], bottomLine: '学问被质疑', bias: { favor: 1.05, trust: 1.0, esteem: 1.05, closeness: 0.95, desire: 0.8 } },
      { name: '偏执收藏家', traits: ['执着', '细腻', '挑剔', '孤僻'], speech: '谈到藏品才突然话多', habit: '定期清点珍藏', likes: ['孤品', '秩序', '旧物'], dislikes: ['被触碰藏品', '杂乱'], bottomLine: '藏品受损', bias: { favor: 0.95, trust: 0.9, esteem: 1.05, closeness: 0.85, desire: 1.0 } },
      { name: '胆小的勇者', traits: ['怯懦', '善良', '自嘲', '倔强'], speech: '声音发虚却硬撑场面', habit: '紧张时反复咽口水', likes: ['安稳', '被鼓励', '小动物'], dislikes: ['惊吓', '被催促'], bottomLine: '抛下弱者逃跑', bias: { favor: 1.2, trust: 0.95, esteem: 0.85, closeness: 1.15, desire: 0.9 } },
      { name: '自恋美人', traits: ['自恋', '娇矜', '敏锐', '寂寞'], speech: '句句离不开自己，语带娇嗔', habit: '时时整理仪容', likes: ['赞美', '华服', '镜子'], dislikes: ['被忽视', '平庸打扮'], bottomLine: '容貌被贬', bias: { favor: 1.1, trust: 0.9, esteem: 0.95, closeness: 1.05, desire: 1.2 } },
      { name: '反差萌怪才', traits: ['天真', '毒舌', '好奇', '护短'], speech: '前一刻甜软后一刻犀利', habit: '对喜欢的人突然变得话多', likes: ['稀奇食物', '恶作剧', '真心话'], dislikes: ['虚伪客套', '被冷落'], bottomLine: '朋友被欺负', bias: { favor: 1.2, trust: 1.05, esteem: 0.9, closeness: 1.2, desire: 1.0 } }
    ]
  };
  /* 修正一处占位（保持文案全中文） */
  ARCHETYPES.eccentric[0].name = '古怪发明家';

  var ORIENT_LABEL = { positive: '正面', negative: '负面', eccentric: '奇葩' };
  var ORIENT_KEYS = ['positive', 'negative', 'eccentric'];

  /* 跨类"隐藏特质"池：为每人再叠一层独特点，最大化区分度 */
  var QUIRKS = [
    '怕水却爱看海', '记得每个人的生辰', '紧张时会数数', '坚信某个荒诞传闻',
    '左耳戴一枚旧环', '逢阴天情绪低落', '对不同的人用不同称呼', '收藏别人的一句话',
    '走路先迈左脚', '讨厌某种气味到绕路', '嘴上说不在意其实记得最清', '一到夜里胃口大开',
    '把承诺刻在物件上', '笑点极高又极低', '对某种颜色格外执着', '习惯性晚到半刻'
  ];

  /* ---------- 预置角色索引：从 configs 抽取的真实角色名 ---------- */
  var ROSTER = {
    chaoshenxueyuan: ['葛小伦','杜蔷薇','琪琳','刘闯','赵信','程耀文','蕾娜','瑞萌萌','天使彦','炙心','凯莎','卡尔','孙悟空'],
    daoguiyixian: ['李火旺','诸葛渊','丹阳子','李岁','高志坚','杨娜'],
    dazhuzai: ['牧尘','洛璃','九幽','清衍静','牧锋','白龙至尊','萧潇','姬玄','血神族','天邪神','太苍','玄天老祖','西天战皇','天帝'],
    dibao: ['骄横仙帝','踏空仙帝','步怜香','李霜颜','南怀仁','叶倾城'],
    ditandali: ['江南','钟映雪','夏瑶','吴良','熊二','米拉','洛天虹','杨坚','萧吹火','奥丁·凯撒','陈道一','李鸣山','姜繁'],
    douluodalu: ['唐三','小舞','戴沐白','奥斯卡','马红俊','宁荣荣','朱竹清','弗兰德','唐昊','比比东','千仞雪','千道流','宁风致','波赛西'],
    doupocangqiong: ['萧炎','纳兰嫣然','云山','魂天帝','魂灭生','小医仙','紫妍','萧战','雅妃','邙天尺','韩枫','陀舍古帝'],
    fanrenxiuxian: ['韩立','南宫婉','厉飞雨','大衍神君','紫灵','银月'],
    guimi: ['克莱恩·莫雷蒂','阿蒙','亚当','真实造物主','罗塞尔·古斯塔夫'],
    guzhenren: ['古月方源','白凝冰','古月方正','黑楼兰','太白云生','影无邪','幽魂魔尊','紫山真君','凤九歌'],
    jianlai: ['陈平安','宁姚','齐静春','左右','崔东山','阿良','陈清都','老剑条','裴钱','李宝瓶','刘羡阳','顾璨','李槐','阮秀','宋集薪','马苦玄','宋长镜','陆沉','白也','曹慈','周密'],
    limingzhijian: ['高文·塞西尔','赫蒂·塞西尔','瑞贝卡·塞西尔','琥珀','罗佩妮·葛兰','维罗妮卡','卡迈尔·斯雷恩','皮特曼·劳伦','拜伦·柯克','贝蒂','提尔','菲尔姆'],
    longzu: ['路明非','楚子航','恺撒·加图索','上杉绘梨衣','芬格尔','源稚生'],
    lunhuileyuan: ['苏晓','白金使徒'],
    quanzhifashi: ['莫凡','叶心夏','穆宁雪','唐月','斩空','张小侯','穆白','赵满延','牧奴娇','艾图图','穆卓云','莫家兴'],
    shengxu: ['楚风','妖妖','黎龘','九道一','狗皇','黄牛','林诺依','秦珞音','武疯子'],
    wanmeishijie: ['柳神','火灵儿','云曦','曹雨生','孟天正'],
    wanxiangzhiwang: ['李洛','姜青娥','澹台岚','李太玄','蔡薇','吕清儿','沈金霄','秦莲','宫神钧'],
    wudongqiankun: ['林动','绫清竹','应欢欢','林琅天','周通','应玄子','慕灵珊','摩罗','慕芊芊','岩大师','异魔皇','符祖'],
    wulianfengdian: ['杨开','苏颜','夏凝裳','梦无涯','扇轻罗','雪月','祝晴','姬瑶'],
    xianni: ['王林','李慕婉','司徒南','拓森','清水','周武泰','天运子'],
    yuanzun: ['周元','夭夭','武瑶','苏幼微','绿萝','吞吞','苍玄老祖','圣元宫主','郗菁','赵牧神','苍渊','武煌','青阳掌教','李卿婵'],
    zhanhen: ['林七夜','赵空城','陈牧野','冷轩','李毅飞','安卿鱼','曹渊','迦蓝','江洱','沈青竹','王面','周平'],
    zhongshengdushi: ['弟子与袍泽']
  };
  /* 无明确人物段落的世界，给出占位说明（算法仍可对任意自定义角色生成档案） */
  var ROSTER_NOTE = {
    cthulhu: '克苏鲁式世界：调查员与旧日支配信徒', earth: '现世地球：自定义凡人众生', free: '自由模式：玩家自定义角色',
    freeworld: '自由世界：玩家自定义角色', mystery: '悬疑世界：侦探与嫌疑人', quanqiubingfeng: '全球冰封：幸存者与势力',
    quanzhigaoshou: '全球高武：武者与异兽', scifi: '科幻世界：星际众生', shenmifusu: '神秘复苏：驭鬼者',
    shrouding: '遮天式世界：修士与古族', swallowedstar: '吞噬星空：武者与宇宙强者', wangyou: '网游世界：玩家与NPC',
    wuxia: '武侠世界：江湖各派', xuanjianxianzu: '玄幻世界：各族天骄'
  };

  var cache = Object.create(null);

  /* ---------- 核心：为任意角色生成性格档案（确定性） ---------- */
  function generate(name, world) {
    name = String(name == null ? '' : name).trim() || '无名';
    world = String(world == null ? '' : world).trim();
    var seed = fnv1a(world + '\u0001' + name + '\u0001v45');
    var rnd = mulberry32(seed);

    // 取向：散列决定，保证三类都被覆盖
    var orient = ORIENT_KEYS[seed % 3];
    var pool = ARCHETYPES[orient];
    var arch = pick(rnd, pool);
    var extraTraits = pickN(rnd, pool.reduce(function (a, p) { return a.concat(p.traits); }, []), 2);
    var traits = arch.traits.slice();
    extraTraits.forEach(function (t) { if (traits.indexOf(t) < 0) traits.push(t); });

    // 关系倾向系数：以原型 bias 为基，叠加每人 ±8% 微扰
    var bias = {};
    REL_AXES.forEach(function (k) {
      var base = (arch.bias && arch.bias[k]) || 1;
      bias[k] = Math.round((base * (0.92 + rnd() * 0.16)) * 100) / 100;
    });

    return {
      key: world + '::' + name,
      name: name,
      world: world,
      orientation: orient,
      orientationLabel: ORIENT_LABEL[orient],
      archetype: arch.name,
      traits: traits,
      speech: arch.speech,
      habit: arch.habit,
      likes: arch.likes.slice(),
      dislikes: arch.dislikes.slice(),
      bottomLine: arch.bottomLine,
      quirk: QUIRKS[fnv1a(name) % QUIRKS.length],
      relBias: bias,
      seed: seed,
      generatedAt: 'v4.45.0-deterministic'
    };
  }

  function forRole(name, world) {
    var key = String(world || '') + '::' + String(name || '');
    if (!cache[key]) cache[key] = generate(name, world);
    return JSON.parse(JSON.stringify(cache[key]));
  }

  function worlds() {
    var set = {};
    Object.keys(ROSTER).forEach(function (k) { set[k] = 1; });
    Object.keys(ROSTER_NOTE).forEach(function (k) { set[k] = 1; });
    return Object.keys(set);
  }
  function roster(world) {
    if (world == null) return JSON.parse(JSON.stringify(ROSTER));
    return (ROSTER[world] || []).slice();
  }
  function rosterNote(world) { return ROSTER_NOTE[world] || ''; }
  function countIndex() {
    return Object.keys(ROSTER).reduce(function (n, k) { return n + ROSTER[k].length; }, 0);
  }

  /* 供关系演化使用：某角色对某关系轴的变更倍率 */
  function biasFor(name, world, axis) {
    var p = forRole(name, world);
    if (axis && p.relBias[axis] != null) return p.relBias[axis];
    return p.relBias;
  }

  /* 生成一段注入提示词的性格速写（供 AI 增强/NPC 演化参考） */
  function brief(name, world) {
    var p = forRole(name, world);
    return p.name + '（' + p.orientationLabel + '·' + p.archetype + '）：'
      + '特质' + p.traits.slice(0, 4).join('/') + '；' + p.speech + '；' + p.habit + '；雷区：' + p.bottomLine + '。';
  }

  function stats() {
    return {
      VERSION: VERSION,
      archetypes: Object.keys(ARCHETYPES).reduce(function (n, k) { return n + ARCHETYPES[k].length; }, 0),
      orientations: ORIENT_LABEL,
      indexedWorlds: worlds().length,
      indexedRoles: countIndex(),
      noteWorlds: Object.keys(ROSTER_NOTE).length,
      cached: Object.keys(cache).length,
      relAxes: REL_AXES.slice()
    };
  }

  function exportAll() { return { v: VERSION, cache: cache }; }
  function importAll(d) {
    if (d && d.cache && typeof d.cache === 'object') {
      Object.keys(d.cache).forEach(function (k) { cache[k] = d.cache[k]; });
    }
    return true;
  }

  var API = {
    VERSION: VERSION,
    REL_AXES: REL_AXES,
    ORIENT_LABEL: ORIENT_LABEL,
    ARCHETYPES: ARCHETYPES,
    ROSTER: ROSTER,
    generate: generate,
    forRole: forRole,
    worlds: worlds,
    roster: roster,
    rosterNote: rosterNote,
    countIndex: countIndex,
    biasFor: biasFor,
    brief: brief,
    stats: stats,
    exportAll: exportAll,
    importAll: importAll,
    _cache: cache
  };
  G.PersonalityCodex = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
