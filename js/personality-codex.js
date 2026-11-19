/* ============================================================================
 * 云境 · 人物性格世界书（Personality Codex）  v4.46.0
 * ----------------------------------------------------------------------------
 * 三部结构：
 *   ① 性格类型辞典 TRAIT_CODEX：收录 6 大类 60+ 种性格，每种含特征/特色/
 *      行为倾向/说话方式/雷区/五维关系系数——这就是"性格世界书"本体。
 *   ② 原著性格锚点 CANON：25 个同人世界、80+ 位被 configs「原著人物独立意志」
 *      点名的角色，锚点逐字取自云境自有 configs，原著角色按本色行事。
 *   ③ 玩家覆盖层 PLAYER：玩家角色可动态增删性格，优先级高于锚点与算法。
 *
 * 生成原则：每个角色 traits ≥10 条，逐条带来源（canon 原著锚点 / lexicon
 * 辞典补益 / player 玩家自定）。原著角色先落锚点，再用同调性辞典补足到10+；
 * 非原著角色用确定性散列从辞典取 ≥10 条。行为演化由 behaviorOf(ctx) 依据
 * 性格 + 行为轨迹给出倾向，供世界时钟/NPC 引擎/AI 增强消费。
 *
 * 版权：锚点仅取自云境自有 configs 已有概括；辞典文案为云境原创通用性格
 * 原型（游戏设计通用概念）。未复制任何第三方项目表达，未引用原著原文台词。
 * 零依赖、原生 JS、挂 window.PersonalityCodex，纯函数可 Node vm 回归。
 * ========================================================================== */
(function () {
  'use strict';
  var G = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var VERSION = '2.1.0';

  /* 心理模型软引用：浏览器由 psyche-model.js 先注入 G.PsycheModel；
     Node vm 测试里若未加载则优雅降级（心理字段留空，不影响既有行为）。 */
  function PM() { return G.PsycheModel || (typeof require === 'function' ? null : null); }

  /* ---------- 确定性工具（原创） ---------- */
  function fnv1a(str) {
    var h = 2166136261; str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickN(rnd, arr, n) {
    var pool = arr.slice(), out = [];
    while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }
  function uniqPush(arr, x) { if (x && arr.indexOf(x) < 0) arr.push(x); }

  var REL_AXES = ['favor', 'trust', 'esteem', 'closeness', 'desire'];

  /* ==========================================================================
   * ① 性格类型辞典（世界书本体）
   * 字段：id / name / cat / face(特征词数组) / feature(特色描述) /
   *       behavior(行为倾向) / speech(说话方式) / taboo(雷区) / bias(五维系数)
   * ======================================================================== */
  var CATEGORIES = {
    positive: { label: '正面', desc: '利他、建设性、令人信赖的性格', hue: '#5aa06f' },
    negative: { label: '负面', desc: '损人、破坏性、令人戒备的性格', hue: '#c05a55' },
    eccentric: { label: '奇葩', desc: '反常、跳脱、出人意料的性格', hue: '#b07fc0' },
    dark: { label: '阴暗', desc: '隐忍、算计、背光的性格', hue: '#6a6f96' },
    pathological: { label: '病态', desc: '偏执、扭曲、失衡的性格', hue: '#8a4a5a' },
    complex: { label: '复杂', desc: '多面、矛盾、难以一言蔽之的性格', hue: '#a8894a' }
  };
  var CAT_KEYS = ['positive', 'negative', 'eccentric', 'dark', 'pathological', 'complex'];

  /* 每条：name, face[特征词], feature, behavior, speech, taboo, bias */
  var TRAIT_CODEX = [
    /* —— 正面 12 —— */
    { name: '仁厚', cat: 'positive', face: ['宽和', '护短', '悲悯', '守信'], feature: '把他人的安危放在自己之前，施恩不望报。', behavior: '调解纷争、庇护弱者、替人善后', speech: '语缓而稳，先安人心再论是非', taboo: '伤及无辜', bias: { favor: 1.2, trust: 1.2, esteem: 1.1, closeness: 1.15, desire: 0.9 } },
    { name: '侠义', cat: 'positive', face: ['重义', '直率', '急公好义', '坦荡'], feature: '路见不平必出手，情义大于利害。', behavior: '仗义出手、为朋友两肋插刀、快意恩仇', speech: '声如洪钟，快人快语', taboo: '背弃同伴', bias: { favor: 1.25, trust: 1.1, esteem: 1.0, closeness: 1.2, desire: 1.05 } },
    { name: '忠诚', cat: 'positive', face: ['坚毅', '尽责', '牺牲', '笃定'], feature: '认准一人一事后不离不弃，可托后背。', behavior: '守职尽责、以身护主、说到做到', speech: '简短笃定，不多许诺', taboo: '护主不力', bias: { favor: 1.1, trust: 1.3, esteem: 1.1, closeness: 1.15, desire: 0.85 } },
    { name: '清正', cat: 'positive', face: ['自持', '敏锐', '洁身', '寡言'], feature: '守得住底线，不随波逐流，清醒而疏离。', behavior: '独善其身、秉公断事、不结党', speech: '字句精炼，弦外有音', taboo: '以强凌弱', bias: { favor: 0.95, trust: 1.2, esteem: 1.25, closeness: 0.95, desire: 0.85 } },
    { name: '乐观', cat: 'positive', face: ['豁达', '幽默', '好奇', '健谈'], feature: '遇挫先笑，总能从困境里找出亮色。', behavior: '活跃气氛、鼓励他人、化险为夷', speech: '语调轻快，爱打趣', taboo: '出卖朋友', bias: { favor: 1.3, trust: 1.0, esteem: 0.95, closeness: 1.25, desire: 1.1 } },
    { name: '悲悯', cat: 'positive', face: ['细致', '耐心', '克制', '温柔'], feature: '见苦即生恻隐，愿意做那些琐碎的善事。', behavior: '照料伤病、收留孤弱、以德报怨', speech: '语气温和，常带宽慰', taboo: '见死不救', bias: { favor: 1.2, trust: 1.15, esteem: 1.05, closeness: 1.15, desire: 0.9 } },
    { name: '勤勉', cat: 'positive', face: ['刻苦', '自律', '务实', '坚韧'], feature: '相信笨功夫，日拱一卒不投机。', behavior: '埋头苦练、守拙深耕、脚踏实地', speech: '朴素务实，少说多做', taboo: '投机取巧', bias: { favor: 1.05, trust: 1.15, esteem: 1.1, closeness: 1.0, desire: 0.9 } },
    { name: '谦和', cat: 'positive', face: ['谦逊', '低调', '包容', '内敛'], feature: '有本事而不张扬，能容不同意见。', behavior: '虚怀纳谏、礼让他人、不争虚名', speech: '温声细语，多用商量口吻', taboo: '恃才傲物', bias: { favor: 1.15, trust: 1.15, esteem: 1.0, closeness: 1.1, desire: 0.85 } },
    { name: '守信', cat: 'positive', face: ['重诺', '一诺千金', '方正', '可靠'], feature: '承诺比性命重，说到必然做到。', behavior: '履约赴约、以信立身、不欺暗室', speech: '一是一二是二，不含糊', taboo: '背信弃义', bias: { favor: 1.1, trust: 1.35, esteem: 1.1, closeness: 1.05, desire: 0.85 } },
    { name: '赤诚', cat: 'positive', face: ['真诚', '热忱', '纯粹', '坦白'], feature: '不设防的真心，喜怒哀乐都写在脸上。', behavior: '坦诚相待、掏心掏肺、以诚感人', speech: '直抒胸臆，不加掩饰', taboo: '虚与委蛇', bias: { favor: 1.25, trust: 1.1, esteem: 0.95, closeness: 1.3, desire: 1.0 } },
    { name: '担当', cat: 'positive', face: ['负责', '硬朗', '不屈', '扛事'], feature: '天塌下来先顶上去，不推诿不甩锅。', behavior: '主动担责、迎难而上、护住众人', speech: '斩钉截铁，富有号召力', taboo: '临阵脱逃', bias: { favor: 1.1, trust: 1.2, esteem: 1.2, closeness: 1.1, desire: 0.95 } },
    { name: '睿智', cat: 'positive', face: ['睿智', '从容', '远见', '明达'], feature: '看得远、想得透，遇大事而能定。', behavior: '运筹布局、点醒他人、临危不乱', speech: '寥寥数语切中要害', taboo: '短视躁进', bias: { favor: 1.05, trust: 1.15, esteem: 1.3, closeness: 1.0, desire: 0.9 } },

    /* —— 负面 12 —— */
    { name: '傲慢', cat: 'negative', face: ['傲慢', '自负', '居高临下', '自尊'], feature: '目中无人，把尊严看得比什么都重。', behavior: '轻视他人、拒绝建议、处处摆架子', speech: '语调居高，字带轻蔑', taboo: '折损颜面', bias: { favor: 0.8, trust: 0.9, esteem: 0.7, closeness: 0.85, desire: 1.05 } },
    { name: '贪婪', cat: 'negative', face: ['逐利', '贪财', '精明', '寡情'], feature: '利益当前寸步不让，永不满足。', behavior: '锱铢必较、见利忘义、囤积居奇', speech: '笑面迎人，话里藏账', taboo: '到手的利被夺', bias: { favor: 0.9, trust: 0.7, esteem: 0.9, closeness: 0.8, desire: 1.15 } },
    { name: '虚伪', cat: 'negative', face: ['伪善', '算计', '体面', '凉薄'], feature: '满口道义，背地里全是算盘。', behavior: '人前和蔼、背后使绊、道貌岸然', speech: '满口道义，句句留余地', taboo: '伪面被撕破', bias: { favor: 0.95, trust: 0.65, esteem: 0.95, closeness: 0.85, desire: 1.0 } },
    { name: '暴戾', cat: 'negative', face: ['暴躁', '好斗', '凶狠', '直蛮'], feature: '一言不合就动手，以暴力解决问题。', behavior: '动辄讥讽、拔刀相向、以力压人', speech: '声高气粗，出言不逊', taboo: '当众受辱', bias: { favor: 0.8, trust: 0.85, esteem: 0.8, closeness: 0.9, desire: 1.2 } },
    { name: '记仇', cat: 'negative', face: ['记仇', '报复', '睚眦必报', '隐忍'], feature: '旧账一笔笔记得清楚，必伺机讨还。', behavior: '暗中报复、翻旧账、以牙还牙', speech: '话里有刺，绵里藏针', taboo: '仇人被宽恕', bias: { favor: 0.6, trust: 0.55, esteem: 1.0, closeness: 0.6, desire: 1.1 } },
    { name: '狡诈', cat: 'negative', face: ['诡诈', '多疑', '深沉', '精算'], feature: '话留半句，永远在试探与设局。', behavior: '以反问试探、设圈套、话里埋伏', speech: '话留半句，常以反问试探', taboo: '被人看穿底牌', bias: { favor: 0.85, trust: 0.6, esteem: 1.1, closeness: 0.8, desire: 1.0 } },
    { name: '自私', cat: 'negative', face: ['自私', '自利', '护己', '薄情'], feature: '凡事先算自己得失，他人皆可牺牲。', behavior: '损人利己、见危先跑、独吞好处', speech: '处处以"我"为先，推卸责任', taboo: '自身利益受损', bias: { favor: 0.7, trust: 0.7, esteem: 0.9, closeness: 0.7, desire: 1.1 } },
    { name: '势利', cat: 'negative', face: ['势利', '圆滑', '攀附', '现实'], feature: '谁强就向谁低头，谁弱就踩谁一脚。', behavior: '趋炎附势、欺软怕硬、见风使舵', speech: '对不同人两套口吻', taboo: '站错队失势', bias: { favor: 0.9, trust: 0.75, esteem: 0.85, closeness: 0.85, desire: 1.0 } },
    { name: '凉薄', cat: 'negative', face: ['凉薄', '冷漠', '寡情', '算计'], feature: '表面慈和，内里没有一丝温度。', behavior: '利用完即抛弃、视人如棋子、不动声色', speech: '温言软语，内里冰冷', taboo: '被人看懂真面目', bias: { favor: 0.75, trust: 0.6, esteem: 1.0, closeness: 0.6, desire: 1.0 } },
    { name: '专横', cat: 'negative', face: ['霸道', '专制', '控制欲', '强势'], feature: '我说了算，不容置疑与反抗。', behavior: '独断专行、强令服从、排除异己', speech: '命令式口吻，不容置喙', taboo: '权威被挑战', bias: { favor: 0.85, trust: 0.8, esteem: 0.9, closeness: 0.9, desire: 1.15 } },
    { name: '怯懦', cat: 'negative', face: ['怯懦', '胆小', '软弱', '犹豫'], feature: '遇事先怕三分，缺乏承担的底气。', behavior: '逃避冲突、随大流、关键时刻掉链', speech: '声音发虚，话说到一半', taboo: '被逼到必须抉择', bias: { favor: 1.0, trust: 0.9, esteem: 0.7, closeness: 0.95, desire: 0.85 } },
    { name: '嫉妒', cat: 'negative', face: ['嫉妒', '不服', '计较', '阴暗'], feature: '见不得别人好，尤其是身边人的好。', behavior: '暗中比较、拆台、贬低他人成就', speech: '话里带酸，阴阳怪气', taboo: '被比下去', bias: { favor: 0.75, trust: 0.7, esteem: 0.8, closeness: 0.8, desire: 1.05 } },

    /* —— 奇葩 12 —— */
    { name: '古怪发明家', cat: 'eccentric', face: ['跳脱', '痴迷', '博杂', '健忘'], feature: '脑子里永远有奇怪点子，为实验可以废寝忘食。', behavior: '鼓捣奇物、突然冒出新想法、无视常理', speech: '话题跳跃，常自言自语', taboo: '被阻止探索', bias: { favor: 1.1, trust: 1.0, esteem: 0.9, closeness: 1.0, desire: 0.95 } },
    { name: '反差萌', cat: 'eccentric', face: ['天真', '毒舌', '好奇', '护短'], feature: '前一刻甜软后一刻犀利，反差极大。', behavior: '突然变脸、对喜欢的人格外多话', speech: '前一刻甜软后一刻犀利', taboo: '朋友被欺负', bias: { favor: 1.2, trust: 1.05, esteem: 0.9, closeness: 1.2, desire: 1.0 } },
    { name: '絮叨学究', cat: 'eccentric', face: ['博闻', '啰嗦', '较真', '迂腐'], feature: '一件事能讲三重，动不动引经据典。', behavior: '纠正用词、考据细节、长篇大论', speech: '引经据典，一件事讲三重', taboo: '学问被质疑', bias: { favor: 1.05, trust: 1.0, esteem: 1.05, closeness: 0.95, desire: 0.8 } },
    { name: '偏执收藏', cat: 'eccentric', face: ['执着', '细腻', '挑剔', '孤僻'], feature: '对某类物件有近乎虔诚的收集癖。', behavior: '清点珍藏、摩挲旧物、对藏品如数家珍', speech: '谈到藏品才突然话多', taboo: '藏品受损', bias: { favor: 0.95, trust: 0.9, esteem: 1.05, closeness: 0.85, desire: 1.0 } },
    { name: '胆小勇者', cat: 'eccentric', face: ['怯懦', '善良', '自嘲', '倔强'], feature: '怕得要死却硬撑着不跑，嘴上怂身体诚实。', behavior: '硬着头皮上、紧张时碎碎念、事后后怕', speech: '声音发虚却硬撑场面', taboo: '抛下弱者逃跑', bias: { favor: 1.2, trust: 0.95, esteem: 0.85, closeness: 1.15, desire: 0.9 } },
    { name: '自恋美人', cat: 'eccentric', face: ['自恋', '娇矜', '敏锐', '寂寞'], feature: '时刻在意自身形象，句句离不开自己。', behavior: '整理仪容、期盼赞美、暗中寂寞', speech: '句句离不开自己，语带娇嗔', taboo: '容貌被贬', bias: { favor: 1.1, trust: 0.9, esteem: 0.95, closeness: 1.05, desire: 1.2 } },
    { name: '毒舌', cat: 'eccentric', face: ['刻薄', '机敏', '犀利', '嘴硬'], feature: '一张嘴能把人噎死，却常一语中的。', behavior: '犀利吐槽、一针见血、话不留情', speech: '夹枪带棒，句句戳痛点', taboo: '被反问到哑口', bias: { favor: 0.95, trust: 1.0, esteem: 1.1, closeness: 0.95, desire: 1.0 } },
    { name: '天然呆', cat: 'eccentric', face: ['天真', '迟钝', '单纯', '直白'], feature: '对人情世故一窍不通，常无意戳破真相。', behavior: '答非所问、直言不讳、茫然不知处境', speech: '慢半拍，问非所答', taboo: '被复杂算计', bias: { favor: 1.15, trust: 1.1, esteem: 0.9, closeness: 1.1, desire: 0.85 } },
    { name: '中二', cat: 'eccentric', face: ['夸张', '戏剧化', '热血', '自我'], feature: '把日常过成史诗，动不动就"封印解除"。', behavior: '摆夸张姿势、自称称号、把小事说成宿命', speech: '戏剧腔，中二台词连篇', taboo: '被当普通人', bias: { favor: 1.05, trust: 0.95, esteem: 1.0, closeness: 1.05, desire: 1.0 } },
    { name: '傲娇', cat: 'eccentric', face: ['别扭', '口是心非', '傲气', '害羞'], feature: '明明在意却偏说不在意，别扭得可爱。', behavior: '嘴上嫌弃行动诚实、害羞时转移话题', speech: '"才不是""哼"，口是心非', taboo: '被看穿心意', bias: { favor: 1.05, trust: 1.0, esteem: 0.95, closeness: 1.15, desire: 1.05 } },
    { name: '跳脱', cat: 'eccentric', face: ['活泼', '好动', '随性', '散漫'], feature: '坐不住、闲不住，走到哪儿热闹到哪儿。', behavior: '到处乱跑、插科打诨、兴致来了一发不可收', speech: '语速快，话题飘忽', taboo: '被拘束', bias: { favor: 1.2, trust: 0.95, esteem: 0.9, closeness: 1.2, desire: 1.0 } },
    { name: '护短', cat: 'eccentric', face: ['偏心', '护短', '讲义气', '六亲不认'], feature: '自己人可以欺负，外人碰一下就翻脸。', behavior: '偏袒自家、对外强硬、护起短来不讲理', speech: '对自己人软，对外人硬', taboo: '自家被外人欺负', bias: { favor: 1.1, trust: 1.1, esteem: 0.95, closeness: 1.25, desire: 1.0 } },

    /* —— 阴暗 12 —— */
    { name: '阴鸷', cat: 'dark', face: ['深沉', '记仇', '精算', '莫测'], feature: '心里有一盘下不完的棋，谁也看不透。', behavior: '暗中布局、话留三分、以退为进', speech: '低声慢语，意味深长', taboo: '底牌被看穿', bias: { favor: 0.8, trust: 0.55, esteem: 1.1, closeness: 0.75, desire: 1.0 } },
    { name: '城府', cat: 'dark', face: ['隐忍', '深沉', '权衡', '手腕'], feature: '喜怒不形于色，能忍常人不能忍。', behavior: '隐忍待机、权衡利弊、后发制人', speech: '不轻易表态，话留余地', taboo: '布局被打乱', bias: { favor: 0.9, trust: 0.6, esteem: 1.15, closeness: 0.7, desire: 0.95 } },
    { name: '孤僻', cat: 'dark', face: ['孤僻', '沉默', '疏离', '自守'], feature: '习惯独来独往，对人始终隔着一层。', behavior: '避开人群、独处、拒绝深交', speech: '惜字如金，答非所问', taboo: '被打扰或勉强', bias: { favor: 0.85, trust: 0.7, esteem: 1.0, closeness: 0.6, desire: 0.85 } },
    { name: '复仇者', cat: 'dark', face: ['隐忍', '冷厉', '专注', '不信任'], feature: '活着只为一件旧事，其余皆可抛。', behavior: '追查线索、隐忍蛰伏、冷酷执行', speech: '简短阴冷，极少谈笑', taboo: '仇人被宽恕', bias: { favor: 0.6, trust: 0.5, esteem: 1.0, closeness: 0.6, desire: 1.1 } },
    { name: '冷漠', cat: 'dark', face: ['淡漠', '无情', '疏离', '克制'], feature: '情绪像结了冰，很难被触动。', behavior: '袖手旁观、按章办事、不为所动', speech: '平淡无波，不带感情', taboo: '被强加感情', bias: { favor: 0.7, trust: 0.8, esteem: 1.0, closeness: 0.55, desire: 0.8 } },
    { name: '多疑', cat: 'dark', face: ['多疑', '警惕', '谨慎', '算计'], feature: '谁都不信，事事都要留一手退路。', behavior: '反复试探、预设最坏、处处设防', speech: '话里藏问，旁敲侧击', taboo: '被人算计', bias: { favor: 0.85, trust: 0.5, esteem: 1.0, closeness: 0.7, desire: 0.9 } },
    { name: '隐秘', cat: 'dark', face: ['神秘', '深藏', '不露', '莫测'], feature: '来历成谜，永远只露出想让你看到的一面。', behavior: '隐藏身份、话说到一半、神龙见首不见尾', speech: '顾左右而言他，深藏不露', taboo: '底细被揭', bias: { favor: 0.9, trust: 0.6, esteem: 1.1, closeness: 0.7, desire: 1.0 } },
    { name: '厌世', cat: 'dark', face: ['悲观', '麻木', '消极', '疏离'], feature: '对一切提不起劲，觉得什么都没意思。', behavior: '敷衍了事、独处发呆、缺乏行动力', speech: '有气无力，兴味索然', taboo: '被强行打鸡血', bias: { favor: 0.8, trust: 0.8, esteem: 0.85, closeness: 0.6, desire: 0.7 } },
    { name: '苟道', cat: 'dark', face: ['谨慎', '隐忍', '多疑', '务实'], feature: '打得过就打，打不过就跑，先保命再谈其他。', behavior: '先想退路、隐藏实力、绝不逞强', speech: '低调度日，不露锋芒', taboo: '暴露底牌惹祸', bias: { favor: 0.95, trust: 0.6, esteem: 1.0, closeness: 0.8, desire: 0.85 } },
    { name: '锋芒', cat: 'dark', face: ['锋利', '傲气', '好胜', '边缘'], feature: '锋芒毕露，宁折不弯，锋利得扎人。', behavior: '迎难而上、寸步不让、以锋芒慑人', speech: '话带锋芒，寸土必争', taboo: '锋芒被挫', bias: { favor: 0.9, trust: 0.85, esteem: 1.2, closeness: 0.8, desire: 1.05 } },
    { name: '算计', cat: 'dark', face: ['精明', '算计', '权衡', '冷静'], feature: '凡事都算得清清楚楚，绝不做亏本买卖。', behavior: '精确计算、趋利避害、把人当资源', speech: '话里藏数，处处权衡', taboo: '算漏一步', bias: { favor: 0.85, trust: 0.6, esteem: 1.1, closeness: 0.7, desire: 1.05 } },
    { name: '枯槁', cat: 'dark', face: ['孤高', '清冷', '厌世', '执着'], feature: '形容枯槁而意志如铁，近乎苦行。', behavior: '苦修自虐、断绝享乐、心如死灰', speech: '声音沙哑，字字沉重', taboo: '信念动摇', bias: { favor: 0.8, trust: 0.85, esteem: 1.15, closeness: 0.6, desire: 0.7 } },

    /* —— 病态 12 —— */
    { name: '偏执妄想', cat: 'pathological', face: ['偏执', '妄想', '固执', '扭曲'], feature: '认定一个念头就再难回头，与现实脱节。', behavior: '执着于幻觉、反复确认、拒绝反驳', speech: '逻辑自洽却脱离现实', taboo: '信念被证伪', bias: { favor: 0.8, trust: 0.5, esteem: 1.0, closeness: 0.6, desire: 1.1 } },
    { name: '人格撕裂', cat: 'pathological', face: ['矛盾', '撕裂', '反复', '失控'], feature: '像有几个人住在身体里，前后判若两人。', behavior: '情绪骤变、前后矛盾、事后失忆', speech: '前后口吻判若两人', taboo: '被戳破断裂处', bias: { favor: 0.75, trust: 0.5, esteem: 0.9, closeness: 0.65, desire: 1.15 } },
    { name: '占有欲', cat: 'pathological', face: ['占有', '偏执', '嫉妒', '控制'], feature: '把在意的人或物当成私产，容不得分享。', behavior: '监视控制、排除异己、寸步不离', speech: '处处追问，语气紧逼', taboo: '所爱脱离掌控', bias: { favor: 0.9, trust: 0.55, esteem: 0.9, closeness: 1.1, desire: 1.3 } },
    { name: '自毁', cat: 'pathological', face: ['自毁', '麻木', '消极', '冲动'], feature: '隐隐盼着事情变糟，对自己毫不怜惜。', behavior: '冒险透支、拒绝求助、把日子过坏', speech: '自嘲自贬，满不在乎', taboo: '被强行拯救', bias: { favor: 0.75, trust: 0.7, esteem: 0.7, closeness: 0.65, desire: 0.8 } },
    { name: '快感缺失', cat: 'pathological', face: ['麻木', '冷漠', '淡漠', '空'], feature: '感受不到快乐，只剩程序和责任在驱动。', behavior: '照章办事、毫无热情、情感迟钝', speech: '平淡乏味，没有起伏', taboo: '被要求"有点反应"', bias: { favor: 0.7, trust: 0.8, esteem: 0.9, closeness: 0.5, desire: 0.7 } },
    { name: '洁癖控制', cat: 'pathological', face: ['洁癖', '控制', '挑剔', '秩序'], feature: '对秩序和洁净有强迫般的要求。', behavior: '反复整理、纠正细节、无法容忍混乱', speech: '不断挑剔，要求精确', taboo: '秩序被打破', bias: { favor: 0.9, trust: 0.9, esteem: 1.05, closeness: 0.8, desire: 0.85 } },
    { name: '依赖', cat: 'pathological', face: ['依赖', '软弱', '黏人', '不安'], feature: '离了某个依靠就无法正常运转。', behavior: '寸步不离、反复确认、害怕被弃', speech: '不断寻求保证，语气不安', taboo: '被冷落抛弃', bias: { favor: 1.1, trust: 0.7, esteem: 0.7, closeness: 1.3, desire: 1.05 } },
    { name: '反社会', cat: 'pathological', face: ['无情', '残忍', '操控', '无恻隐'], feature: '理解规则却毫无共情，把人当工具。', behavior: '冷酷利用、毫无愧疚、享受掌控', speech: '表面斯文，内里冰冷', taboo: '被识破真面目', bias: { favor: 0.6, trust: 0.45, esteem: 1.0, closeness: 0.5, desire: 1.1 } },
    { name: '受虐', cat: 'pathological', face: ['隐忍', '自贬', '受虐', '逆来顺受'], feature: '把吃苦受难当成应得，甚至从中得到满足。', behavior: '逆来顺受、自我牺牲、拒绝反抗', speech: '自轻自贱，逆来顺受', taboo: '被善待到不习惯', bias: { favor: 0.95, trust: 0.7, esteem: 0.6, closeness: 0.8, desire: 0.9 } },
    { name: '施虐', cat: 'pathological', face: ['残忍', '控制', '施虐', '冷酷'], feature: '从他人的痛苦与屈服中获得快感。', behavior: '折辱他人、制造恐惧、以刑立威', speech: '阴冷的愉悦，话带威胁', taboo: '猎物不再屈服', bias: { favor: 0.55, trust: 0.5, esteem: 0.95, closeness: 0.5, desire: 1.2 } },
    { name: '情绪失衡', cat: 'pathological', face: ['情绪化', '极端', '易怒', '脆弱'], feature: '情绪大起大落，一点小事就能掀翻。', behavior: '暴怒或崩溃、喜怒无常、事后懊悔', speech: '语气剧烈起伏', taboo: '被激怒', bias: { favor: 0.85, trust: 0.65, esteem: 0.8, closeness: 0.85, desire: 1.1 } },
    { name: '妄想宏大', cat: 'pathological', face: ['自大', '妄想', '伟大', '偏执'], feature: '坚信自己肩负神圣使命，不可一世。', behavior: '发表宏论、以救世主自居、无视现实', speech: '高谈阔论，自比英雄', taboo: '被证明平凡', bias: { favor: 0.9, trust: 0.6, esteem: 1.0, closeness: 0.85, desire: 1.05 } },

    /* —— 复杂中性 12 —— */
    { name: '外冷内热', cat: 'complex', face: ['清冷', '重情', '别扭', '护短'], feature: '表面拒人千里，心里把在意的人看得很重。', behavior: '嘴上嫌弃行动照料、默默守护', speech: '冷淡的关心，藏得很深', taboo: '在意之人受委屈', bias: { favor: 1.0, trust: 1.1, esteem: 1.0, closeness: 1.1, desire: 1.0 } },
    { name: '嘴硬心软', cat: 'complex', face: ['倔强', '善良', '口是心非', '柔弱'], feature: '话说得硬，心却比谁都软。', behavior: '嘴上不饶人、背地里心软帮忙', speech: '嘴硬，末了还是软下来', taboo: '被人真的伤害', bias: { favor: 1.1, trust: 1.0, esteem: 0.95, closeness: 1.1, desire: 0.95 } },
    { name: '大智若愚', cat: 'complex', face: ['睿智', '低调', '从容', '藏拙'], feature: '看透一切却装作不懂，大巧若拙。', behavior: '藏锋守拙、点到为止、后发制人', speech: '看似寻常，实则字字珠玑', taboo: '被迫露锋', bias: { favor: 1.05, trust: 1.1, esteem: 1.2, closeness: 1.0, desire: 0.9 } },
    { name: '亦正亦邪', cat: 'complex', face: ['复杂', ' duality', '随机', '自由'], feature: '不走正道也不入邪道，全凭自己心意。', behavior: '按喜好行事、不站队、亦敌亦友', speech: '亦庄亦谐不按常理', taboo: '被道德绑架', bias: { favor: 0.95, trust: 0.85, esteem: 1.05, closeness: 0.95, desire: 1.05 } },
    { name: '浪子回头', cat: 'complex', face: ['风流', '悔悟', '重情', '担当'], feature: '走过弯路后幡然醒悟，倍加珍惜。', behavior: '痛改前非、守护所爱、弥补过错', speech: '感慨良多，语气沉 real', taboo: '重蹈覆辙', bias: { favor: 1.05, trust: 0.95, esteem: 0.95, closeness: 1.1, desire: 1.0 } },
    { name: '威严吐槽', cat: 'complex', face: ['威严', '幽默', '沉稳', '反差'], feature: '人前威严端着，私下爱吐槽起怪名词。', behavior: '外表稳重、私下吐槽、反差鲜明', speech: '对外庄重，对内毒舌幽默', taboo: '威严被当众拆台', bias: { favor: 1.05, trust: 1.05, esteem: 1.1, closeness: 1.05, desire: 0.95 } },
    { name: '桀骜驯服', cat: 'complex', face: ['桀骜', '骄傲', '归属', '成长'], feature: '一身反骨，唯独对认下的人俯首。', behavior: '对外桀骜、对内忠诚、在碰撞中成长', speech: '对外带刺，对内罕见柔软', taboo: '骄傲被当众践踏', bias: { favor: 0.95, trust: 1.05, esteem: 1.1, closeness: 1.1, desire: 1.0 } },
    { name: '谨慎果决', cat: 'complex', face: ['谨慎', '果决', '隐忍', '狠厉'], feature: '平时步步算计，一旦出手便毫不留情。', behavior: '谋定后动、该狠时狠、绝不犹豫', speech: '平时低调，决断时斩钉截铁', taboo: '犹豫误事', bias: { favor: 0.95, trust: 0.7, esteem: 1.15, closeness: 0.85, desire: 0.95 } },
    { name: '赤子野心', cat: 'complex', face: ['纯粹', '野心', '执着', '热烈'], feature: '怀着赤子之心，却也有吞天的野心。', behavior: '全力以赴、光明争夺、热烈追求', speech: '坦荡而充满力量', taboo: '理想被质疑', bias: { favor: 1.1, trust: 1.0, esteem: 1.1, closeness: 1.0, desire: 1.1 } },
    { name: '通透疏离', cat: 'complex', face: ['通透', '疏离', '温和', '清醒'], feature: '看透世事却仍温柔待人，保持恰当距离。', behavior: '点到为止、温和有礼、不越界', speech: '温和得体，分寸极佳', taboo: '被强求交心', bias: { favor: 1.1, trust: 1.05, esteem: 1.05, closeness: 1.0, desire: 0.9 } },
    { name: '韧劲不屈', cat: 'complex', face: ['坚韧', '隐忍', '乐观', '硬朗'], feature: '越是逆境越倔强，打不垮压不弯。', behavior: '迎难而上、屡败屡战、苦中作乐', speech: '朴实有力，带点自嘲', taboo: '被用于认输', bias: { favor: 1.05, trust: 1.05, esteem: 1.15, closeness: 1.05, desire: 0.95 } },
    { name: '多面似妖', cat: 'complex', face: ['多变', '聪慧', '迷人', '危险'], feature: '在不同人面前是不同模样，难以捉摸。', behavior: '见人说人话、切换自如、亦幻亦真', speech: '因对象而异，百变', taboo: '被看穿真面', bias: { favor: 1.0, trust: 0.75, esteem: 1.1, closeness: 1.05, desire: 1.15 } }
  ];
  /* 修正两处占位英文（保持全中文文案） */
  TRAIT_CODEX.forEach(function (t) {
    t.face = t.face.map(function (f) { return f === ' duality' ? '多面' : f; });
    if (t.speech === '感慨良多，语气沉 real') t.speech = '感慨良多，语气沉郁';
    t.id = t.name;
  });

  var BY_CAT = {};
  CAT_KEYS.forEach(function (k) { BY_CAT[k] = TRAIT_CODEX.filter(function (t) { return t.cat === k; }); });
  var BY_NAME = {};
  TRAIT_CODEX.forEach(function (t) { BY_NAME[t.name] = t; });

  /* ==========================================================================
   * ② 原著性格锚点库（逐字取自云境自有 configs，尊重原著，含配角）
   * 结构：'world::角色名' -> { faces:[原著性格词], note:原著定位一句话 }
   * 覆盖 25 个同人世界的点名角色；未点名角色由同世界基调 + 辞典生成。
   * ======================================================================== */
  var CANON = {
    /* 凡人修仙传 */
    'fanrenxiuxian::韩立': { faces: ['谨慎多疑', '心思缜密', '从不把命运交到别人手里', '利益当前寸步不让', '无关之事绝不多管'], note: '苟道求长生，先想退路再想好处' },
    'fanrenxiuxian::南宫婉': { faces: ['清冷自持', '重诺重情'], note: '掩月宗结丹女修' },
    'fanrenxiuxian::墨大夫': { faces: ['表面慈和', '实则凉薄算计'], note: '传长春功意在夺舍' },
    'fanrenxiuxian::大衍神君': { faces: ['豪爽狂放', '守信重义'], note: '天才型人物，与韩立亦师亦友' },
    'fanrenxiuxian::厉飞雨': { faces: ['豪爽', '重义气'], note: '韩立七玄门至交' },
    'fanrenxiuxian::紫灵': { faces: ['清冷', '深情', '独立'], note: '妙音门红颜知己' },
    'fanrenxiuxian::银月': { faces: ['聪慧', '忠诚', '日久生情'], note: '韩立器灵' },
    /* 道诡异仙 */
    'daoguiyixian::白灵淼': { faces: ['温柔坚韧'], note: '惨烈底色下执拗的暖' },
    'daoguiyixian::丹阳子': { faces: ['偏执', '残暴'], note: '坐忘道/' },
    'daoguiyixian::狗娃': { faces: ['憨直', '忠诚'], note: '憨笑护主' },
    'daoguiyixian::诸葛渊': { faces: ['智谋', '悲悯'], note: '智谋悲悯' },
    'daoguiyixian::静心师太': { faces: ['深不可测'], note: '深不可测' },
    'daoguiyixian::骰子': { faces: ['诡诈'], note: '诡诈' },
    'daoguiyixian::无生老母': { faces: ['慈悲', '可怖'], note: '慈悲与可怖并存' },
    'daoguiyixian::杨娜': { faces: ['坚韧', '等待'], note: '执拗的等待' },
    /* 大主宰 */
    'dazhuzai::清衍静': { faces: ['深沉护子'], note: '牧尘之母' },
    'dazhuzai::洛璃': { faces: ['清冷', '坚毅'], note: '洛神族' },
    'dazhuzai::九幽': { faces: ['傲娇', '直率'], note: '九幽雀' },
    'dazhuzai::曼荼罗': { faces: ['女王威仪'], note: '女王' },
    'dazhuzai::姬玄': { faces: ['骄傲'], note: '天骄' },
    'dazhuzai::域外邪族': { faces: ['阴狠'], note: '域外邪族' },
    /* 斗罗大陆 */
    'douluodalu::大师': { faces: ['执着', '博学'], note: '玉小刚' },
    'douluodalu::比比东': { faces: ['威仪', '野心'], note: '武魂殿教皇' },
    'douluodalu::戴沐白': { faces: ['领袖气度'], note: '白虎' },
    'douluodalu::宁荣荣': { faces: ['娇蛮蜕变'], note: '七宝琉璃塔' },
    'douluodalu::奥斯卡': { faces: ['插科打诨'], note: '香肠' },
    /* 斗破苍穹 */
    'doupocangqiong::药老': { faces: ['毒舌', '深沉'], note: '药尘' },
    'doupocangqiong::薰儿': { faces: ['清冷', '温柔'], note: '古族' },
    'doupocangqiong::美杜莎': { faces: ['女王威仪'], note: '蛇人女王' },
    'doupocangqiong::纳兰嫣然': { faces: ['骄傲'], note: '纳兰' },
    'doupocangqiong::魂殿': { faces: ['阴狠'], note: '魂殿' },
    /* 地摊大力 */
    'ditandali::江南': { faces: ['贫嘴群嘲', '损人招数全开', '嘴上说对钱不感兴趣', '真章从不含糊'], note: '地摊摊主，嘴贫心细' },
    'ditandali::夏瑶': { faces: ['跳脱爱炸毛', '外号大狼灭', '护短起来六亲不认'], note: '灵武少女' },
    'ditandali::钟映雪': { faces: ['温柔知性', '青梅竹马的分寸感'], note: '知性青梅' },
    'ditandali::山猫': { faces: ['粗中有细', '带兵的老江湖做派'], note: '老江湖' },
    /* 黎明之剑 */
    'limingzhijian::高文': { faces: ['对外沉稳威严', '私下爱吐槽起怪名词'], note: '塞西尔公爵' },
    'limingzhijian::赫蒂': { faces: ['攻击性法术全打不中'], note: '高文侄女' },
    'limingzhijian::琥珀': { faces: ['见了老粽子会喊妈耶', '机灵'], note: '盗贼' },
    /* 轮回乐园 */
    'lunhuileyuan::苏晓': { faces: ['冷酷高效', '说杀就杀', '从不多废话', '谈判桌上只谈利益'], note: '轮回者' },
    /* 全职高手 */
    'quanzhigaoshou::韩文清': { faces: ['硬朗不屈'], note: '拳皇' },
    'quanzhigaoshou::黄少天': { faces: ['滔滔不绝'], note: '剑圣，话痨' },
    'quanzhigaoshou::王杰希': { faces: ['深不可测'], note: '魔剑士' },
    'quanzhigaoshou::周泽楷': { faces: ['沉默寡言'], note: '枪王' },
    'quanzhigaoshou::张新杰': { faces: ['精确如钟'], note: '牧师' },
    /* 圣墟 */
    'shengxu::楚风': { faces: ['嘴贱心热', '遇事先吐槽再拼命', '对朋友护短到底'], note: '楚风' },
    'shengxu::大黑牛': { faces: ['牛皮糙嘴更糙', '吹牛不上税'], note: '大黑牛' },
    'shengxu::林诺依': { faces: ['清冷自持', '话少而准'], note: '林诺依' },
    /* 神秘复苏 */
    'shenmifusu::杨间': { faces: ['冷静缜密', '观察入微', '把自身异化为对抗灵异的精密仪器', '拒绝廉价的英雄主义'], note: '驭鬼者' },
    'shenmifusu::王小明': { faces: ['看似不着调', '重情重义', '关键时刻从不含糊'], note: '王小明' },
    'shenmifusu::周正': { faces: ['以鬼婴禁锢撑起大昌市', '临终愧疚'], note: '周正' },
    /* 完美世界 */
    'wanmeishijie::柳神': { faces: ['深不可测'], note: '柳神' },
    'wanmeishijie::石毅': { faces: ['倨傲', '执念'], note: '石毅' },
    /* 万相之王 */
    'wanxiangzhiwang::姜青娥': { faces: ['清冷凌厉', '重剑湛蓝'], note: '姜青娥' },
    'wanxiangzhiwang::澹台岚': { faces: ['强势护短'], note: '澹台岚' },
    'wanxiangzhiwang::李惊蛰': { faces: ['沉稳威严'], note: '李惊蛰' },
    'wanxiangzhiwang::沈金霄': { faces: ['阴狠算计'], note: '沈金霄' },
    'wanxiangzhiwang::宫神钧': { faces: ['隐忍城府'], note: '宫神钧' },
    /* 武动乾坤 */
    'wudongqiankun::林琅天': { faces: ['傲气', '偏执'], note: '林琅天' },
    'wudongqiankun::应欢欢': { faces: ['灵动', '冰主宿命'], note: '应欢欢' },
    'wudongqiankun::小貂': { faces: ['鬼马狂傲'], note: '小貂' },
    'wudongqiankun::绫清竹': { faces: ['清冷出尘'], note: '绫清竹' },
    'wudongqiankun::元门三掌教': { faces: ['霸道', '阴狠'], note: '元门' },
    /* 武炼巅峰 */
    'wulianfengdian::杨开': { faces: ['话不多但说一不二', '认死理', '护短', '逆境里越挫越勇'], note: '杨开' },
    'wulianfengdian::苏颜': { faces: ['冰清玉洁', '外冷内热'], note: '苏颜' },
    'wulianfengdian::夏凝裳': { faces: ['清冷坚韧', '惜字如金'], note: '夏凝裳' },
    /* 仙逆 */
    'xianni::王林': { faces: ['沉默隐忍', '心思深藏', '杀伐果决', '对认下的人一诺千金'], note: '逆天而上，深情执念' },
    'xianni::司徒南': { faces: ['傲慢毒舌', '动辄骂人', '实则亦师亦友', '关键时刻从不掉链子'], note: '司徒南' },
    'xianni::李慕婉': { faces: ['温婉坚韧', '深情'], note: '王林道侣，红颜早逝' },
    /* 元尊 */
    'yuanzun::苍渊': { faces: ['沉稳如渊'], note: '苍渊' },
    'yuanzun::夭夭': { faces: ['清冷疏离'], note: '夭夭' },
    'yuanzun::武瑶': { faces: ['孤高骄傲'], note: '武瑶' },
    'yuanzun::苏幼微': { faces: ['温婉坚韧'], note: '苏幼微' },
    'yuanzun::圣元宫主': { faces: ['阴鸷', '野心'], note: '圣元宫主' },
    'yuanzun::赵牧神': { faces: ['桀骜'], note: '赵牧神' },
    /* 重生都市 */
    'zhongshengdushi::方琼': { faces: ['清丽高洁', '仙胎宿命'], note: '方琼' },
    'zhongshengdushi::陆燕雪': { faces: ['冰封心防'], note: '陆燕雪' },
    'zhongshengdushi::姜初然': { faces: ['傲气', '别扭'], note: '姜初然' },
    'zhongshengdushi::许蓉妃': { faces: ['明艳', '脆弱'], note: '许蓉妃' },
    'zhongshengdushi::阿秀': { faces: ['温顺坚韧'], note: '阿秀' },
    'zhongshengdushi::华云峰': { faces: ['坦荡识势', '宗师气度'], note: '天榜第四' },
    'zhongshengdushi::谢言': { faces: ['爽利重义'], note: '谢言' },
    'zhongshengdushi::沈君文': { faces: ['阴鸷狠毒'], note: '沈君文' },
    'zhongshengdushi::王城': { faces: ['骄横狠辣'], note: '王城' },
    'zhongshengdushi::叶擎苍': { faces: ['铁腕深谋'], note: '叶擎苍' },
    'zhongshengdushi::青龙': { faces: ['冷面'], note: '青龙' },
    'zhongshengdushi::朱雀': { faces: ['飒爽'], note: '朱雀' },
    /* 斩痕 / 超神 / 遮天 / 吞噬 / 龙族 / 全职法师（点名但未细分者，用通用定位） */
    'zhanhen::林七夜': { faces: ['守夜人', '重责', '隐忍'], note: '守夜人，有自己要守的夜' },
    'chaoshenxueyuan::凯莎': { faces: ['威严', '王者气度', '决断'], note: '天使女王，有自己的战争' },
    'chaoshenxueyuan::彦': { faces: ['忠诚', '果决'], note: '天使战士' },
    'chaoshenxueyuan::莫甘娜': { faces: ['反叛', '强大', '桀骜'], note: '恶魔女王' },
    'longzu::路明非': { faces: ['怯懦', '善良', '自嘲'], note: '卡塞尔学生' },
    'longzu::楚子航': { faces: ['沉默', '坚毅', '执着'], note: '卡塞尔学生' },
    'longzu::恺撒': { faces: ['骄傲', '领袖气度'], note: '卡塞尔学生' },
    'shrouding::叶凡': { faces: ['坚毅', '锋芒', '重情'], note: '遮天修士' },
    'swallowedstar::罗峰': { faces: ['坚韧', '果决', '重情'], note: '武者' }
  };

  /* 各世界的"性格基调"（无点名角色时按此+辞典生成，仍尊重世界氛围） */
  var WORLD_TONE = {
    fanrenxiuxian: ['谨慎', '隐忍', '多疑', '务实'], daoguiyixian: ['诡谲', '坚韧', '偏执', '悲悯'],
    xianni: ['隐忍', '深情', '杀伐', '执着'], guzhenren: ['算计', '冷酷', '执着', '智谋'],
    doupocangqiong: ['骄傲', '热血', '重义', '锋芒'], wudongqiankun: ['傲气', '执着', '灵动', '霸道'],
    douluodalu: ['热血', '重义', '执着', '领袖'], shengxu: ['嘴贱心热', '护短', '乐观', '坚韧'],
    lunhuileyuan: ['冷酷', '高效', '务实', '警惕'], zhongshengdushi: ['傲气', '别扭', '温顺', '阴鸷'],
    quanzhigaoshou: ['专注', '骄傲', '幽默', '精确'], shenmifusu: ['冷静', '缜密', '重情', '警惕'],
    jianlai: ['讲道理', '守序', '坚韧', '温厚'], guimi: ['理性', '谨慎', '神秘', '缜密'],
    limingzhijian: ['沉稳', '吐槽', '担当', '好奇'], chaoshenxueyuan: ['热血', '威严', '反叛', '忠诚'],
    longzu: ['骄傲', '沉默', '自嘲', '坚毅'], shrouding: ['锋芒', '坚韧', '重情', '深不可测'],
    swallowedstar: ['坚韧', '果决', '理性', '重情'], wanmeishijie: ['锋芒', '深不可测', '执着', '傲气'],
    yuanzun: ['沉稳', '清冷', '骄傲', '坚韧'], wanxiangzhiwang: ['清冷', '强势', '隐忍', '威严'],
    wulianfengdian: ['坚毅', '外冷内热', '护短', '果决'], dazhuzai: ['清冷', '傲娇', '深沉', '锋芒'],
    ditandali: ['贫嘴', '跳脱', '知性', '护短'], dibao: ['城府', '傲慢', '算计', '深沉'],
    quanzhifashi: ['骄傲', '热血', '唠叨', '神秘'], zhanhen: ['责任', '隐忍', '重义', '守夜']
  };

  /* 预置角色名索引（沿用上一版从 configs 抽取的 25 世界真实角色） */
  var ROSTER = {
    chaoshenxueyuan: ['葛小伦','杜蔷薇','琪琳','刘闯','赵信','程耀文','蕾娜','瑞萌萌','天使彦','炙心','凯莎','卡尔','孙悟空'],
    daoguiyixian: ['李火旺','诸葛渊','丹阳子','李岁','高志坚','杨娜','白灵淼','狗娃','静心师太','骰子','无生老母'],
    dazhuzai: ['牧尘','洛璃','九幽','清衍静','牧锋','萧潇','姬玄','曼荼罗'],
    dibao: ['骄横仙帝','踏空仙帝','步怜香','李霜颜','南怀仁','叶倾城','李七夜'],
    ditandali: ['江南','钟映雪','夏瑶','吴良','熊二','米拉','山猫'],
    douluodalu: ['唐三','小舞','戴沐白','奥斯卡','马红俊','宁荣荣','朱竹清','弗兰德','唐昊','比比东','千仞雪','大师'],
    doupocangqiong: ['萧炎','纳兰嫣然','云山','魂天帝','小医仙','紫妍','萧战','雅妃','药老','薰儿','美杜莎'],
    fanrenxiuxian: ['韩立','南宫婉','厉飞雨','大衍神君','紫灵','银月','墨大夫'],
    guimi: ['克莱恩·莫雷蒂','阿蒙','亚当','罗塞尔·古斯塔夫'],
    guzhenren: ['古月方源','白凝冰','古月方正','黑楼兰','太白云生','影无邪','幽魂魔尊'],
    jianlai: ['陈平安','宁姚','齐静春','左右','崔东山','阿良','陈清都','裴钱','李宝瓶','刘羡阳','顾璨'],
    limingzhijian: ['高文·塞西尔','赫蒂·塞西尔','瑞贝卡·塞西尔','琥珀','维罗妮卡','罗塞塔'],
    longzu: ['路明非','楚子航','恺撒·加图索','上杉绘梨衣','芬格尔','源稚生'],
    lunhuileyuan: ['苏晓','白金使徒'],
    quanzhifashi: ['莫凡','叶心夏','穆宁雪','唐月','张小侯','穆白','赵满延'],
    shengxu: ['楚风','妖妖','林诺依','秦珞音','武疯子','大黑牛'],
    wanmeishijie: ['柳神','火灵儿','云曦','曹雨生','孟天正','石毅'],
    wanxiangzhiwang: ['李洛','姜青娥','澹台岚','李太玄','吕清儿','沈金霄','宫神钧'],
    wudongqiankun: ['林动','绫清竹','应欢欢','林琅天','周通','应玄子','小貂','元门三掌教'],
    wulianfengdian: ['杨开','苏颜','夏凝裳','梦无涯','扇轻罗','雪月','祝晴'],
    xianni: ['王林','李慕婉','司徒南','拓森','清水','天运子'],
    yuanzun: ['周元','夭夭','武瑶','苏幼微','苍渊','圣元宫主','赵牧神'],
    zhanhen: ['林七夜','赵空城','陈牧野','冷轩','安卿鱼','迦蓝'],
    zhongshengdushi: ['方琼','陆燕雪','姜初然','许蓉妃','阿秀','华云峰','谢言','沈君文','王城','叶擎苍']
  };
  var ROSTER_NOTE = {
    cthulhu: '克苏鲁式世界：调查员与旧日支配信徒', earth: '现世地球：自定义凡人众生', free: '自由模式：玩家自定义角色',
    freeworld: '自由世界：玩家自定义角色', mystery: '悬疑世界：侦探与嫌疑人', quanqiubingfeng: '全球冰封：幸存者与势力',
    quanzhigaoshou: '全球高武：武者与异兽', scifi: '科幻世界：星际众生', shenmifusu: '神秘复苏：驭鬼者',
    shrouding: '遮天式世界：修士与古族', swallowedstar: '吞噬星空：武者与宇宙强者', wangyou: '网游世界：玩家与NPC',
    wuxia: '武侠世界：江湖各派', xuanjianxianzu: '玄幻世界：各族天骄'
  };

  /* 玩家覆盖层：'world::name' -> { faces:[...], added:[...], removed:[...], locked:bool } */
  var PLAYER = Object.create(null);
  var cache = Object.create(null);
  var LS_PLAYER = 'yunjing.personality.player.v46';

  /* 玩家层自动持久化：随 localStorage 保存/恢复，跨会话保留玩家自定义性格 */
  function savePlayer() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(LS_PLAYER, JSON.stringify(PLAYER));
      }
    } catch (e) {}
  }
  function loadPlayer() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        var raw = localStorage.getItem(LS_PLAYER);
        if (raw) {
          var d = JSON.parse(raw);
          if (d && typeof d === 'object') Object.keys(d).forEach(function (k) { PLAYER[k] = d[k]; });
        }
      }
    } catch (e) {}
  }
  loadPlayer();

  /* ---------- 原著性格词 → 辞典类别/条目的映射 ---------- */
  function classifyFace(face) {
    var f = String(face || '');
    var table = [
      /* 病态：真·病态词优先，避免"偏执"这类被谨慎误吞 */
      [/病态|疯癫|癫狂|扭曲|妄想|人格分裂|施虐|受虐|自毁|占有欲|反社会|情绪失衡/, 'pathological'],
      /* 阴暗：谨慎、隐忍、算计、深藏——含原著长短语 */
      [/谨慎|多疑|缜密|心思深藏|隐忍|城府|深沉|深不可测|算计|城府|沉默|寡言|深藏|深谋|不露|退路|寸步不让|不多管|从不把命运|惜字如金|外冷内热|清冷自持|话少而准|说一不二|认死理|越挫越勇/, 'dark'],
      /* 负面：贪婪/倨傲/狠辣/凉薄 */
      [/逐利|利益当前|贪|傲|骄|野心|凉薄|专横|霸道|狠辣|阴狠|桀骜|毒舌|倨傲|嘴贱|势利|冷酷|高效|说杀就杀/, 'negative'],
      /* 奇葩：古怪跳脱毒舌 */
      [/古怪|跳脱|贫嘴|插科|自嘲|傲娇|别扭|毒舌|吹牛|鬼马|滔滔不绝|炸毛|群嘲|贫|嘴硬|鬼机灵|灵动/, 'eccentric'],
      /* 正面：温柔重义坚韧 */
      [/温柔|仁|善|义|重情|守信|忠诚|坚韧|温婉|担当|热血|护短|爽利|坦荡|知性|悲悯|重诺|深情|一诺千金|亦师亦友|重义|温厚|坦荡识势/, 'positive']
    ];
    for (var i = 0; i < table.length; i++) if (table[i][0].test(f)) return table[i][1];
    return 'complex';
  }

  /* ---------- 核心生成 ---------- */
  function buildTraits(name, world) {
    var key = world + '::' + name;
    var canon = CANON[key];
    var rnd = mulberry32(fnv1a(key + '|v46'));
    var faces = [];        // 逐条 { text, source, cat }
    var primaryCat = null;

    // ① 原著锚点（最高优先，逐字来自 configs）
    if (canon && canon.faces && canon.faces.length) {
      canon.faces.forEach(function (f) {
        faces.push({ text: f, source: 'canon', cat: classifyFace(f) });
      });
      // 主类别：锚点中出现最多的类
      var cnt = {};
      canon.faces.forEach(function (f) { var c = classifyFace(f); cnt[c] = (cnt[c] || 0) + 1; });
      primaryCat = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
    }

    // ② 玩家覆盖（最高优先：可删锚点、加自定义）
    var pv = PLAYER[key];
    if (pv) {
      if (pv.removed && pv.removed.length) {
        faces = faces.filter(function (x) { return pv.removed.indexOf(x.text) < 0; });
      }
      if (pv.faces && pv.faces.length) {
        pv.faces.forEach(function (f) { faces.push({ text: f, source: 'player', cat: classifyFace(f) }); });
      }
    }

    // ③ 辞典补足到 ≥10 条（原著角色只从"同调性类别"补，绝不引入违和词条如病态）
    var MIN = 10;
    if (faces.length < MIN) {
      var need = MIN - faces.length;
      var AFFINITY = {
        dark: ['dark', 'negative', 'complex'], negative: ['negative', 'dark', 'complex'],
        positive: ['positive', 'complex', 'eccentric'], eccentric: ['eccentric', 'complex', 'positive'],
        pathological: ['pathological', 'dark', 'negative'], complex: ['complex', 'positive', 'dark', 'eccentric']
      };
      var pool;
      if (canon && primaryCat) {
        // 原著角色：严格同调性类别；病态角色才允许病态补益
        var cats = AFFINITY[primaryCat] || [primaryCat];
        pool = TRAIT_CODEX.filter(function (t) { return cats.indexOf(t.cat) >= 0; });
      } else {
        // 非原著角色：全辞典
        pool = primaryCat ? (BY_CAT[primaryCat] || []).concat(TRAIT_CODEX.filter(function (t) { return t.cat !== primaryCat; })) : TRAIT_CODEX;
      }
      var chosen = pickN(rnd, pool, Math.min(need, pool.length));
      chosen.forEach(function (t) {
        if (faces.length >= MIN) return;
        // 用辞典条目的特征词补入，逐条带来源
        t.face.slice(0, 2).forEach(function (f) {
          if (faces.length < MIN && !faces.some(function (x) { return x.text === f; })) {
            faces.push({ text: f, source: 'lexicon', cat: t.cat, fromTrait: t.name });
          }
        });
      });
    }
    // 仍不足（极端情况）：从全集特征词补
    if (faces.length < MIN) {
      var allFaces = TRAIT_CODEX.reduce(function (a, t) { return a.concat(t.face); }, []);
      pickN(rnd, allFaces, MIN - faces.length).forEach(function (f) {
        if (!faces.some(function (x) { return x.text === f; })) faces.push({ text: f, source: 'lexicon', cat: 'complex' });
      });
    }
    return faces;
  }

  /* 计算关系倾向系数：由性格条目累加，原著锚点权重更高 */
  function buildBias(faces) {
    var bias = {}, wsum = {};
    REL_AXES.forEach(function (k) { bias[k] = 0; wsum[k] = 0; });
    faces.forEach(function (x) {
      var t = BY_NAME[x.fromTrait] || findByFace(x.text);
      if (!t || !t.bias) return;
      var w = x.source === 'canon' ? 2 : (x.source === 'player' ? 2.5 : 1);
      REL_AXES.forEach(function (k) { bias[k] += (t.bias[k] || 1) * w; wsum[k] += w; });
    });
    REL_AXES.forEach(function (k) {
      bias[k] = wsum[k] ? Math.round((bias[k] / wsum[k]) * 100) / 100 : 1;
    });
    return bias;
  }
  function findByFace(face) {
    for (var i = 0; i < TRAIT_CODEX.length; i++) {
      if (TRAIT_CODEX[i].face.indexOf(face) >= 0) return TRAIT_CODEX[i];
    }
    return null;
  }

  /* 生成完整档案 */
  function generate(name, world) {
    name = String(name == null ? '' : name).trim() || '无名';
    world = String(world == null ? '' : world).trim();
    var faces = buildTraits(name, world);
    var canon = CANON[world + '::' + name];
    var primaryCat = null, cnt = {};
    faces.forEach(function (x) { if (x.source === 'canon') { cnt[x.cat] = (cnt[x.cat] || 0) + 2; } else cnt[x.cat] = (cnt[x.cat] || 0) + 1; });
    primaryCat = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0] || 'complex';
    /* 代表原型：原著角色只由原著锚点决定（绝不用随机补益词条定义人物）
       先在主类别里找与锚点最接近的辞典条目，再退到全类别锚点匹配，最后用主类别首个 */
    var rep = null;
    var canonTexts = (canon && canon.faces) ? canon.faces : [];
    // ① 主类别里找与任一原著锚点同调的代表
    var mainPool = BY_CAT[primaryCat] || [];
    for (var a = 0; a < canonTexts.length && !rep; a++) {
      rep = mainPool.filter(function (t) {
        return t.face.some(function (ff) { return canonTexts[a].indexOf(ff) >= 0 || ff.indexOf(canonTexts[a]) >= 0; })
          || canonTexts[a].indexOf(t.name) >= 0;
      })[0] || null;
    }
    // ② 全辞典按锚点类别匹配
    if (!rep) {
      for (var b = 0; b < canonTexts.length && !rep; b++) {
        var cat = classifyFace(canonTexts[b]);
        rep = (BY_CAT[cat] || []).filter(function (t) {
          return t.face.some(function (ff) { return canonTexts[b].indexOf(ff) >= 0 || ff.indexOf(canonTexts[b]) >= 0; });
        })[0] || null;
      }
    }
    // ③ 主类别代表；非原著角色才用 faces 的补益词条找
    if (!rep) rep = mainPool[0] || null;
    if (!rep) {
      for (var i = 0; i < faces.length && !rep; i++) rep = BY_NAME[faces[i].fromTrait] || findByFace(faces[i].text);
    }
    if (!rep) rep = TRAIT_CODEX[0];

    return {
      key: world + '::' + name, name: name, world: world,
      isCanon: !!canon,
      canonNote: canon ? canon.note : '',
      primaryCat: primaryCat,
      primaryLabel: CATEGORIES[primaryCat].label,
      archetype: rep.name,
      faces: faces,                                   // 逐条带来源
      traits: faces.map(function (x) { return x.text; }), // 兼容：纯字符串数组，长度≥10
      speech: rep.speech,
      behavior: rep.behavior,
      feature: rep.feature,
      taboo: rep.taboo,
      relBias: buildBias(faces),
      seed: fnv1a(world + '::' + name),
      /* v4.47.0 心理模型：七项心理档案 + 10 阶段关系光谱
         代表原型 rep 已由原著锚点/主类别决定，故用 rep.name 取心理档案，
         让原著角色（如墨大夫→凉薄/城府）拿到贴合本色的心理模型，而非通用兜底。 */
      psychology: (function () {
        var pm = PM();
        if (!pm || !pm.of) return null;
        try {
          /* 原著角色：用 canon 锚点文本挑最贴切的心理档案（byCanon），
             避免 lexicon 补益把负面角色（如苏晓"冷酷高效"）带偏到 complex。 */
          var psyCat = primaryCat, psyRep = rep && rep.name ? rep.name : name;
          if (canon && canon.faces && canon.faces.length) {
            var anchorStr = canon.faces.map(function (x) { return (x && x.text) ? x.text : String(x); }).join('、');
            if (pm.byCanon) {
              var bc = pm.byCanon(anchorStr, primaryCat);
              if (bc && bc.rep) { psyRep = bc.rep; psyCat = bc.cat; }
            }
          }
          var psy = pm.of(psyRep, psyCat);
          var spect = {};
          (pm.STAGES || []).forEach(function (s) { spect[s] = pm.spectrum(name, psyCat, s).text; });
          psy.spectrum = spect;
          psy.archetype = rep.name;
          psy.basedOn = psyRep;     // 心理档案实际取自哪个性格原型（原著角色经 byCanon 校正）
          /* 原著锚点叠加：让核心恐惧与行事机制带上原著本色 */
          var canonTexts = (canon && canon.faces) ? canon.faces.map(function (f) { return f.text || f; }) : [];
          if (canonTexts.length) {
            psy.canonAnchor = canonTexts.join('、');
            psy.fear = canonTexts.slice(0, 2).join('、') + '；' + psy.fear;
            psy.essence = '（原著：' + canonTexts.slice(0, 2).join('、') + '）' + psy.essence;
          }
          return psy;
        } catch (e) { return null; }
      })(),
      generatedAt: 'v4.47.0'
    };
  }

  function forRole(name, world) {
    var key = String(world || '') + '::' + String(name || '');
    if (!cache[key]) cache[key] = generate(name, world);
    return JSON.parse(JSON.stringify(cache[key]));
  }
  function invalidate(name, world) { delete cache[String(world || '') + '::' + String(name || '')]; }

  /* ---------- 玩家角色动态调整（优先级最高，随存档持久化） ---------- */
  function playerKey(world, name) { return String(world || '') + '::' + String(name || ''); }
  function getPlayer(world, name) {
    var k = playerKey(world, name);
    return PLAYER[k] ? JSON.parse(JSON.stringify(PLAYER[k])) : null;
  }
  function ensurePlayer(world, name) {
    var k = playerKey(world, name);
    if (!PLAYER[k]) PLAYER[k] = { faces: [], removed: [], locked: false };
    return PLAYER[k];
  }
  function addPlayerTrait(world, name, face) {
    face = String(face || '').trim(); if (!face) return false;
    var p = ensurePlayer(world, name);
    if (p.removed.indexOf(face) >= 0) p.removed = p.removed.filter(function (x) { return x !== face; });
    if (p.faces.indexOf(face) < 0) { p.faces.push(face); invalidate(name, world); savePlayer(); return true; }
    return false;
  }
  function removePlayerTrait(world, name, face) {
    var p = ensurePlayer(world, name);
    p.removed.push(String(face));
    p.faces = p.faces.filter(function (x) { return x !== String(face); });
    invalidate(name, world); savePlayer(); return true;
  }
  function setPlayerTraits(world, name, faces) {
    var p = ensurePlayer(world, name);
    p.faces = Array.isArray(faces) ? faces.map(String).filter(Boolean) : [];
    invalidate(name, world); savePlayer(); return true;
  }
  function resetPlayer(world, name) {
    delete PLAYER[playerKey(world, name)]; invalidate(name, world); savePlayer(); return true;
  }
  function setPlayerLock(world, name, locked) { ensurePlayer(world, name).locked = !!locked; savePlayer(); return true; }

  /* ---------- 行为演化：性格 + 行为轨迹(context) ---------- */
  function behaviorOf(name, world, ctx) {
    var p = forRole(name, world);
    ctx = ctx || {};
    var out = { name: name, world: world, tendency: [], mood: '平静', rationale: '' };
    // 由行为轨迹提取情境张力
    var events = ctx.events || [];
    var threat = 0, kindness = 0, betrayal = 0;
    var eventText = '';
    events.forEach(function (e) {
      var s = String((e && (e.text || e.reason)) || '');
      eventText += s + ' ';
      if (/敌|攻|杀|危|威胁|追|斗/.test(s)) threat++;
      if (/助|救|赠|谢|善|帮/.test(s)) kindness++;
      if (/背|叛|骗|欺|算计|害/.test(s)) betrayal++;
    });
    var days = Number(ctx.days || 0);
    // 性格决定对情境的反应倾向
    var faces = p.traits.join(' ');
    if (/多疑|谨慎|警惕|算计|城府/.test(faces)) out.tendency.push(threat > 0 || betrayal > 0 ? '先设防留退路' : '按兵不动');
    if (/重情|护短|忠|义|善良/.test(faces)) out.tendency.push(kindness > 0 ? '投桃报李、护其周全' : '守望相助');
    if (/暴戾|霸道|狠|果决/.test(faces)) out.tendency.push(threat > 0 ? '以硬碰硬、先发制人' : '强势推进');
    if (/温柔|仁|悲悯|包容/.test(faces)) out.tendency.push('以缓和方式化解');
    if (/傲慢|骄傲|威/.test(faces)) out.tendency.push('维持体面与强硬姿态');
    if (/怯懦|软弱|苟|隐忍/.test(faces)) out.tendency.push(threat > 0 ? '避其锋芒、暂退' : '低调行事');
    if (/乐观|幽默|跳脱/.test(faces)) out.tendency.push('以轻松姿态应对');
    if (!out.tendency.length) out.tendency.push(days > 0 ? '沿既有轨迹行事' : '观望');
    // 情绪：由张力与性格综合
    if (threat > 0 && /多疑|警惕|谨慎/.test(faces)) out.mood = '戒备';
    else if (betrayal > 0 && /记仇|狠|复仇/.test(faces)) out.mood = '愠怒';
    else if (kindness > 0 && /重情|温柔/.test(faces)) out.mood = '温和';
    else if (days > 30 && /隐忍|深沉/.test(faces)) out.mood = '沉静';
    out.rationale = '性格〔' + p.traits.slice(0, 5).join('、') + '〕'
      + ' × 轨迹〔事件' + events.length + '起/威胁' + threat + '/善意' + kindness + '/背叛' + betrayal + '/历时' + days + '日〕'
      + (p.isCanon ? ' × 原著锚点' : '');

    /* ---- v4.47.0 心理模型叠加：关系光谱 × 触发分级 × 破防 × 表里反差 ---- */
    var pm = PM();
    if (pm && pm.react) {
      try {
        var stageLabel = ctx.stage || '陌生';
        var reaction = pm.react(name, p.primaryCat, {
          stage: stageLabel, eventText: eventText, intensity: ctx.intensity, days: days
        });
        out.psychology = {
          essence: p.psychology ? p.psychology.essence : '',
          fear: p.psychology ? p.psychology.fear : '',
          stage: reaction.stage,
          tier: reaction.tier,
          phase: reaction.phase,
          surface: reaction.surface,        // 表象行为（对关系阶段的表现）
          real: reaction.real,              // 真实倾向（机制/破防时暴露核心恐惧）
          contrast: reaction.contrast,      // 表里反差
          mechanism: reaction.mechanism,
          breaking: reaction.breaking,
          mood: reaction.mood,
          rationale: reaction.rationale
        };
        // 破防时把表象纳入倾向，让行为引擎真正"按心理机制行事"
        if (reaction.breaking) out.tendency.push('破防：' + reaction.real);
        else if (reaction.tier === '中度') out.tendency.push('心理波动：' + reaction.mechanism);
        // 破防会覆盖情绪标记（原 mood 保留在 out.mood，心理情绪单列）
      } catch (e) {}
    }
    return out;
  }

  function worlds() {
    var set = {};
    Object.keys(ROSTER).forEach(function (k) { set[k] = 1; });
    Object.keys(ROSTER_NOTE).forEach(function (k) { set[k] = 1; });
    Object.keys(WORLD_TONE).forEach(function (k) { set[k] = 1; });
    Object.keys(CANON).forEach(function (k) { set[k.split('::')[0]] = 1; });
    return Object.keys(set);
  }
  function roster(world) { if (world == null) return JSON.parse(JSON.stringify(ROSTER)); return (ROSTER[world] || []).slice(); }
  function rosterNote(world) { return ROSTER_NOTE[world] || ''; }
  function countIndex() { return Object.keys(ROSTER).reduce(function (n, k) { return n + ROSTER[k].length; }, 0); }
  function biasFor(name, world, axis) {
    var p = forRole(name, world);
    if (axis && p.relBias[axis] != null) return p.relBias[axis];
    return p.relBias;
  }
  function brief(name, world) {
    var p = forRole(name, world);
    var anchor = p.faces.filter(function (x) { return x.source === 'canon'; }).map(function (x) { return x.text; });
    var s = p.name + '（' + p.primaryLabel + '·' + p.archetype + (p.isCanon ? '·原著' : '') + '）：'
      + (anchor.length ? '原著性格〔' + anchor.join('/') + '〕；' : '')
      + '特质〔' + p.traits.slice(0, 10).join('/') + '〕；' + p.speech + '；' + p.behavior + '；雷区：' + p.taboo + '。';
    /* v4.47.0：附加心理模型速写，逼大模型按角色心理机制本色行事（不含任何原文台词） */
    if (p.psychology) {
      s += ' 心理：本质〔' + p.psychology.essence + '〕；核心恐惧〔' + p.psychology.fear + '〕；'
        + '行事机制〔' + p.psychology.mechanism + '〕；表里〔' + p.psychology.contrast + '〕；'
        + '破防条件〔' + p.psychology.breaking + '〕；语调〔' + p.psychology.voice + '〕。'
        + ' 请据此角色的心理机制推导其在未明情境下的反应，不要写成通用腔调。';
    }
    return s;
  }
  function stats() {
    return {
      VERSION: VERSION,
      categories: CATEGORIES,
      traitTypes: TRAIT_CODEX.length,
      canonRoles: Object.keys(CANON).length,
      canonWorlds: (function () { var s = {}; Object.keys(CANON).forEach(function (k) { s[k.split('::')[0]] = 1; }); return Object.keys(s).length; })(),
      indexedWorlds: worlds().length,
      indexedRoles: countIndex(),
      playerOverrides: Object.keys(PLAYER).length,
      cached: Object.keys(cache).length,
      relAxes: REL_AXES.slice(),
      psyched: (function () { var pm = PM(); return pm && pm.stats ? pm.stats().psyches : 0; })()
    };
  }
  function exportAll() { return { v: VERSION, cache: cache, player: PLAYER, canonKeys: Object.keys(CANON) }; }
  function importAll(d) {
    if (!d) return false;
    if (d.cache && typeof d.cache === 'object') Object.keys(d.cache).forEach(function (k) { cache[k] = d.cache[k]; });
    if (d.player && typeof d.player === 'object') Object.keys(d.player).forEach(function (k) { PLAYER[k] = d.player[k]; });
    return true;
  }

  var API = {
    VERSION: VERSION, REL_AXES: REL_AXES, CATEGORIES: CATEGORIES, CAT_KEYS: CAT_KEYS,
    TRAIT_CODEX: TRAIT_CODEX, CANON: CANON, ROSTER: ROSTER,
    generate: generate, forRole: forRole, invalidate: invalidate,
    addPlayerTrait: addPlayerTrait, removePlayerTrait: removePlayerTrait, setPlayerTraits: setPlayerTraits,
    resetPlayer: resetPlayer, setPlayerLock: setPlayerLock, getPlayer: getPlayer,
    behaviorOf: behaviorOf, worlds: worlds, roster: roster, rosterNote: rosterNote, countIndex: countIndex,
    biasFor: biasFor, brief: brief, stats: stats, exportAll: exportAll, importAll: importAll,
    /* 兼容 v4.45 旧字段 */
    ORIENT_LABEL: (function () { var o = {}; CAT_KEYS.forEach(function (k) { o[k] = CATEGORIES[k].label; }); return o; })(),
    ARCHETYPES: BY_CAT,
    _cache: cache, _player: PLAYER
  };
  G.PersonalityCodex = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
