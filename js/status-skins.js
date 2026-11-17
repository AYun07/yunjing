/* 云境 · 每界差异化状态栏皮肤 StatusSkins v7.0.0（v4.27.0）
 * ---------------------------------------------------------------------------
 * v5 大改：解决「状态栏太简单、没突出特色」——根因是 8 套皮肤换色换图标，
 *          但字段区（占最大面积）都是同一个两列文字网格。改为「一栏材质卡」+
 *          每套题材完全不同的材质语言（玉简/技能槽/档案表格/终端格/邪典手记/
 *          竹简/铜板仪表/证物标签）+ 头部纹章放大光环。结构性差异，非贴纸堆砌。
 * 用户诉求：「每个世界都得不一样、都有自己的特色」。
 * v4 大改：在 8 套题材骨架之上叠加「每界唯一身份层」——36 界各有独立主色
 *          （取自各界 css/*-style.css 的 --primary）+ 徽记字 + 题词 + 专属字段，
 *          同题材世界（如斗破/仙逆/凡人）也能一眼区分。字段读写零变化，不注入假数据。
 * v3 大改：从「换个颜色 + 小图标」升级为「整块氛围场景」——
 *   · 玄幻：青碧云海 + 金色灵光 + 太极八卦 + 朱砂道印 + 水墨远山。
 *   · 克苏鲁：彻底抛弃米黄羊皮纸，改为近黑暗紫 + 血污 + 触手暗纹 + 凝视之眼。
 *   · 科幻：深空黑 + 全息辉光 + 霓虹切角 + 数据流 + 旋转雷达 + 故障字。
 *   其余 5 套也各自叠加大面积背景氛围层，拉开「第一眼色块」差异。
 * 字段读写仍走 StatusSchema.readField/editField，功能零变化，不注入任何假数据。
 */
(function () {
  'use strict';

  var CN = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', '拾壹', '拾贰', '拾叁', '拾肆'];
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

  /* ===== 每界唯一身份表 WORLD_ID（v4.27.0）=====
     36 界各自独立：主色 c + 徽记 s + 题词 m + 专属卷册名 t + 副题 sub。
     t/sub 直接替换骨架里原本写死的「本命道册/深渊秘录/星舰终端…」，
     彻底消除同题材世界标题雷同。全部为通用意境词，非人物/宗门/招式专名。 */
  var WORLD_ID = {
    /* 玄幻修真 —— 每界一卷，卷名各异 */
    xianni:          { c:'#9d86d0', s:'逆', m:'逆天改命 · 一步一劫',     t:'逆 命 道 藏', sub:'问道纪' },
    doupocangqiong:  { c:'#e06a4a', s:'炎', m:'异火焚天 · 少年不屈',     t:'焚 天 炎 册', sub:'异火录' },
    wanmeishijie:    { c:'#7fd878', s:'古', m:'万古长河 · 一叶孤舟',     t:'万 古 荒 卷', sub:'太古纪' },
    douluodalu:      { c:'#8f9fe8', s:'魂', m:'武魂觉醒 · 百炼成神',     t:'魂 武 秘 录', sub:'武魂篇' },
    shrouding:       { c:'#c89a5a', s:'天', m:'遮天蔽日 · 大道漫漫',     t:'遮 天 古 卷', sub:'荒古纪' },
    fanrenxiuxian:   { c:'#5db8c8', s:'凡', m:'凡人逆道 · 步步为营',     t:'凡 人 仙 牒', sub:'求索录' },
    jianlai:         { c:'#d8b86a', s:'剑', m:'剑起江湖 · 问心无悔',     t:'问 心 剑 卷', sub:'剑修录' },
    xuanjianxianzu:  { c:'#6fc9b0', s:'族', m:'仙族传承 · 世代修真',     t:'仙 族 谱 牒', sub:'传承纪' },
    dazhuzai:        { c:'#9b6ad0', s:'主', m:'大千世界 · 谁主沉浮',     t:'大 千 主 册', sub:'主宰录' },
    wudongqiankun:   { c:'#3a9d8f', s:'武', m:'武极乾坤 · 逆境崛起',     t:'武 极 乾 坤', sub:'武道篇' },
    yuanzun:         { c:'#5a9bd4', s:'尊', m:'一元初始 · 万道归尊',     t:'元 初 尊 卷', sub:'本源纪' },
    wanxiangzhiwang: { c:'#c9a83a', s:'相', m:'万相森罗 · 王者归来',     t:'万 相 王 册', sub:'森罗录' },
    shengxu:         { c:'#4cb8a8', s:'墟', m:'圣墟古道 · 仙路迷踪',     t:'圣 墟 仙 卷', sub:'古道纪' },
    wulianfengdian:  { c:'#d89030', s:'炼', m:'武炼巅峰 · 永无止境',     t:'武 炼 道 碑', sub:'巅峰录' },
    guzhenren:       { c:'#5fb87a', s:'真', m:'返璞归真 · 问道自然',     t:'真 我 蛊 卷', sub:'问道篇' },
    /* 科幻 / 未来 */
    swallowedstar:   { c:'#6f9fe8', s:'星', m:'吞噬星海 · 强者如林',     t:'星 海 战 册', sub:'星域志' },
    scifi:           { c:'#6fc2b4', s:'宇', m:'星舰远征 · 未知边界',     t:'星 舰 远 征', sub:'深空志' },
    ditandali:       { c:'#e8a04c', s:'能', m:'能量核心 · 系统运转',     t:'能 量 核 心', sub:'系统志' },
    chaoshenxueyuan: { c:'#e8c478', s:'超', m:'基因觉醒 · 超凡之路',     t:'超 凡 基 因', sub:'觉醒志' },
    /* 网游 / 竞技 */
    quanzhifashi:    { c:'#9d8cf0', s:'法', m:'魔法觉醒 · 元素掌控',     t:'魔 法 图 鉴', sub:'元素篇' },
    quanzhigaoshou:  { c:'#5fc9d8', s:'战', m:'荣耀赛场 · 巅峰对决',     t:'荣 耀 战 册', sub:'竞技篇' },
    wangyou:         { c:'#6fc9d8', s:'游', m:'虚拟世界 · 真实征程',     t:'虚 拟 纪 元', sub:'网游志' },
    lunhuileyuan:    { c:'#e05858', s:'轮', m:'轮回万千 · 乐园法则',     t:'轮 回 契 约', sub:'乐园篇' },
    longzu:          { c:'#6a8ad8', s:'龙', m:'龙血觉醒 · 命运之途',     t:'龙 血 档 案', sub:'觉醒录' },
    /* 克苏鲁 / 诡秘 / 悬疑 */
    cthulhu:         { c:'#b7a8e8', s:'眸', m:'凝视深渊 · 理智成灰',     t:'深 渊 凝 视', sub:'疯癫录' },
    guimi:           { c:'#8a9ab0', s:'秘', m:'诡秘莫测 · 不可言说',     t:'诡 秘 手 记', sub:'非凡录' },
    daoguiyixian:    { c:'#c9584a', s:'诡', m:'真假难辨 · 道心难守',     t:'真 假 道 卷', sub:'心魔录' },
    mystery:         { c:'#8ab4c8', s:'谜', m:'迷雾重重 · 真相难寻',     t:'迷 雾 侦 档', sub:'推理录' },
    shenmifusu:      { c:'#7ab0a8', s:'灵', m:'灵异复苏 · 鬼影重现',     t:'灵 异 复 苏', sub:'鬼影录' },
    /* 武侠 / 蒸汽 */
    wuxia:           { c:'#9fbf8f', s:'侠', m:'快意恩仇 · 仗剑天涯',     t:'江 湖 剑 录', sub:'侠客行' },
    limingzhijian:   { c:'#d8a04c', s:'曦', m:'黎明破晓 · 魔导之光',     t:'魔 导 铭 册', sub:'黎明志' },
    /* 都市 / 现实 */
    earth:           { c:'#5a9e7f', s:'尘', m:'人生如局 · 现实为幕',     t:'尘 世 人 生', sub:'现世录' },
    zhongshengdushi: { c:'#c88ad8', s:'生', m:'重来一世 · 改写命运',     t:'重 生 之 书', sub:'逆命篇' },
    zhanhen:         { c:'#a8c4c8', s:'痕', m:'硝烟散尽 · 战痕犹存',     t:'战 痕 档 案', sub:'硝烟录' },
    quanqiubingfeng: { c:'#5fb8d8', s:'雪', m:'冰封全球 · 绝境求生',     t:'冰 封 纪 事', sub:'寒世纪' },
    dibao:           { c:'#d8b46a', s:'藏', m:'秘境寻宝 · 险中求财',     t:'秘 境 寻 宝', sub:'宝藏录' },
    /* 自定义 */
    free:            { c:'#e0a84c', s:'境', m:'随心所至 · 万象由心',     t:'自 由 之 境', sub:'随心录' },
    freeworld:       { c:'#b98fd8', s:'创', m:'自定义界 · 无限可能',     t:'创 世 之 书', sub:'无垠录' }
  };
  var WID = null; // 当前界身份，render() 时注入
  function hexA(hex, a) {
    var h = String(hex || '#e0a84c').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 224, g = parseInt(h.slice(2, 4), 16) || 168, b = parseInt(h.slice(4, 6), 16) || 76;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function read(f) {
    try { return window.StatusSchema ? window.StatusSchema.readField(f) : ''; } catch (e) { return ''; }
  }
  function editAttr(f) { return 'onclick="StatusSchema.editField(\'' + esc(f.k) + '\')"'; }
  /* v4.27.0 多值栏目渲染：单值原样；多值渲染成带序号的多行子项，点击整体进编辑器。
     每项独立成行、自动换行，不再被 nowrap 截断——九个魂环能全部显示。 */
  function isMulti(f) {
    try { return !!(window.StatusSchema && window.StatusSchema.fieldIsMulti && window.StatusSchema.fieldIsMulti(f)); }
    catch (e) { return !!f.multi; }
  }
  function valHTML(o, ph) {
    var f = o.f, val = o.val;
    var attr = editAttr(f);
    if (!isMulti(f)) return '<span class="' + ph.cls + (val ? '' : ' ph') + '" ' + attr + '>' + (val ? esc(val) : ph.empty) + '</span>';
    var list = Array.isArray(val) ? val : (val ? [val] : []);
    if (!list.length) return '<span class="' + ph.cls + ' ph yj-multi-empty" ' + attr + '>' + ph.empty + ' ＋</span>';
    var max = ph.max || 9;
    var items = list.slice(0, max).map(function (x, i) {
      return '<span class="yj-mi"><b>' + (i + 1) + '</b>' + esc(x) + '</span>';
    }).join('');
    if (list.length > max) items += '<span class="yj-mi-more">+' + (list.length - max) + ' 项</span>';
    return '<span class="' + ph.cls + ' yj-multi" ' + attr + '>' + items + '</span>';
  }
  function zhName(g) {
    try { var fw = window.storyFramework; return (fw && fw.config && fw.config.genreName) || g || '特色'; }
    catch (e) { return g || '特色'; }
  }
  function skinOf(g) {
    var arch = '';
    try { arch = (window.StatusPresets && window.StatusPresets.archOf) ? (window.StatusPresets.archOf(g) || '') : ''; } catch (e) {}
    return arch || 'xianxia';
  }
  function visibleFields(g) {
    var out = [];
    g.fields.forEach(function (f) {
      var val = read(f);
      if (!val && !(g.id === 'custom' || f.custom || g.exclusive)) return;
      out.push({ f: f, val: val });
    });
    return out;
  }
  function groupsOf(groups) { return groups.filter(function (gr) { return visibleFields(gr).length; }); }

  /* ============ 8 套渲染器 ============ */

  /* 1. 仙逆 · 云海道册：太极 + 祥云 + 朱砂道印 + 水墨远山 + 金色灵光 */
  function skinXianxia(groups, g) {
    return '<div class="ss1-sky" aria-hidden="true"><i class="ss1-mt"></i><i class="ss1-sun"></i><i class="ss1-crane">✦</i><i class="ss1-crane c2">✦</i></div>' +
      '<div class="ss1-head"><div class="ss1-taiji">☯</div>' +
      '<div class="ss1-title"><b>' + esc(WID.t) + '</b><small>' + esc(zhName(g)) + ' · ' + esc(WID.sub) + '</small>' +
      '<span class="ss1-cloud">☁ ~~~~~ ☁ ~~~~~ ☁</span></div>' +
      '<div class="ss1-seal">' + esc(WID.s) + '</div></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss1-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss1-gt"><span class="ss1-vol">' + CN[gi] + '</span><span class="ss1-gtn">' + esc(gr.name) + '</span><i></i><span class="ss1-rune">✧</span></div>' +
          '<div class="ss1-rows">' + visibleFields(gr).map(function (o, i) {
            return '<div class="ss1-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss1-no">' + (CN[i] || '·') + '</span>' +
              '<span class="ss1-k">' + esc(o.f.label) + '</span>' +
              '<span class="ss1-lead"></span>' +
              valHTML(o, { cls: 'ss1-v', empty: '待悟' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  /* 2. 网游 · 技能栏HUD：血条蓝条 + 技能槽卡片阵 + 等级星 */
  function skinYouxi(groups, g) {
    var glyphs = ['✦', '⚔', '✧', '◆', '◈', '❖', '⬢', '✶', '◉', '◇', '★', '✚', '☄', '⟡'];
    return '<div class="ss2-scan" aria-hidden="true"></div>' +
      '<div class="ss2-top"><span class="ss2-avatar">🎮</span>' +
      '<div class="ss2-id"><b>' + esc(zhName(g)) + ' · ' + esc(WID.t) + '</b><span class="ss2-lv">LV. 01 ★★★☆☆</span></div></div>' +
      '<div class="ss2-bars"><div class="ss2-bar hp"><i style="width:78%"></i><em>HP 780/1000</em></div>' +
      '<div class="ss2-bar mp"><i style="width:54%"></i><em>MP 270/500</em></div></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss2-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss2-gt"><span>▶ ' + esc(gr.name) + '</span><i></i></div>' +
          '<div class="ss2-slots">' + visibleFields(gr).map(function (o, i) {
            return '<div class="ss2-slot' + (o.val ? ' on' : '') + '" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss2-ico">' + glyphs[i % glyphs.length] + '</span>' +
              '<span class="ss2-nm">' + esc(o.f.label) + '</span>' +
              valHTML(o, { cls: 'ss2-val', empty: '空槽' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  /* 3. 都市 · 证件档案卡：头像框 + 证件编号 + 条形码 + 公章 */
  function skinDushi(groups, g) {
    var no = String(Math.abs(hashStr(g || 'x')) % 900000 + 100000);
    return '<div class="ss3-watermark" aria-hidden="true">CITY · FILE</div>' +
      '<div class="ss3-card">' +
      '<div class="ss3-photo">👤<small>PHOTO</small></div>' +
      '<div class="ss3-info"><div class="ss3-hd">' + esc(WID.t) + ' · FILE</div>' +
      '<b>' + esc(zhName(g)) + ' · ' + esc(WID.sub) + '</b>' +
      '<div class="ss3-meta"><span>档案号 <em>' + no + '</em></span><span>签发 CITY-BUREAU</span></div></div>' +
      '<div class="ss3-stamp">已核验</div></div>' +
      '<div class="ss3-barcode"></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss3-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss3-gt">▍' + esc(gr.name) + '</div>' +
          '<div class="ss3-rows">' + visibleFields(gr).map(function (o) {
            return '<div class="ss3-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss3-k">' + esc(o.f.label) + '</span><span class="ss3-lead"></span>' +
              valHTML(o, { cls: 'ss3-v', empty: '未填写' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  /* 4. 科幻 · 星舰终端：旋转雷达 + 数据流 + 故障标题 + 方括号读数 + 扫描线 */
  function skinKeji(groups, g) {
    return '<div class="ss4-grid" aria-hidden="true"></div><div class="ss4-stream" aria-hidden="true">01001101 10110 0110 11010 00101 11100 01101 1001</div>' +
      '<div class="ss4-top"><div class="ss4-radar"><b></b></div>' +
      '<div class="ss4-sys"><span class="ss4-glitch" data-txt="' + esc(WID.t) + ' / ' + esc(zhName(g)) + '">[ ' + esc(WID.t) + ' / ' + esc(zhName(g)) + ' ]</span>' +
      '<span class="ss4-online">● LINK STABLE &nbsp; 信号 98% &nbsp; ▮▮▮▮▮▯</span></div></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss4-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss4-gt"><span class="ss4-node"></span>// MODULE_' + String(gi + 1).padStart(2, '0') + ' :: ' + esc(gr.name).toUpperCase() + '</div>' +
          '<div class="ss4-rows">' + visibleFields(gr).map(function (o) {
            return '<div class="ss4-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss4-prompt">&gt;</span>' +
              '<span class="ss4-k">' + esc(o.f.label) + '</span>' +
              '<span class="ss4-br">[</span>' +
              valHTML(o, { cls: 'ss4-v', empty: 'N/A' }) +
              '<span class="ss4-br">]</span></div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  /* 5. 克苏鲁 · 深渊秘录：近黑暗紫 + 血污 + 触手暗纹 + 凝视之眼 + 诡异符文 */
  function skinKepfu(groups, g) {
    var runes = ['☾', '✦', '☽', '⚝', '⟡', '☿', '♄', '✧'];
    return '<div class="ss5-dark" aria-hidden="true"><i class="ss5-tent t1"></i><i class="ss5-tent t2"></i><i class="ss5-tent t3"></i><i class="ss5-blood"></i></div>' +
      '<div class="ss5-head"><div class="ss5-eye">👁</div>' +
      '<div class="ss5-t"><b>' + esc(WID.t) + '</b><small>' + esc(zhName(g)) + ' · ' + esc(WID.sub) + ' · 阅者慎之</small>' +
      '<span class="ss5-rune">☾ ✦ ⚝ ⟡ ☿ ✦ ☾</span></div>' +
      '<div class="ss5-wax">' + esc(WID.s) + '</div></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss5-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss5-gt">第 ' + ROMAN[gi] + ' 章 · ' + esc(gr.name) + ' <i>···</i></div>' +
          '<div class="ss5-rows">' + visibleFields(gr).map(function (o, i) {
            return '<div class="ss5-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss5-r">' + runes[i % runes.length] + '</span>' +
              '<span class="ss5-k">' + esc(o.f.label) + '</span><span class="ss5-lead"></span>' +
              valHTML(o, { cls: 'ss5-v', empty: '尚未窥知' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('') +
      '<div class="ss5-foot">“知晓越多，理智越少。” <span>⟡ ☾ ⟡</span></div>';
  }

  /* 6. 武侠 · 竹简卷轴：竹黄竖纹 + 卷轴轴头 + 大朱砂印 + 竖排标题 + 毛笔字 */
  function skinWuxia(groups, g) {
    return '<div class="ss6-scroll"><div class="ss6-rod top"></div>' +
      '<div class="ss6-body"><div class="ss6-head"><span class="ss6-bigseal">' + esc(WID.s) + '</span>' +
      '<span class="ss6-vtitle">' + vtitle(WID.t) + '</span><span class="ss6-sub">' + esc(zhName(g)) + '<br>' + esc(WID.sub) + '</span></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss6-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss6-gt">【卷' + CN[gi] + '】' + esc(gr.name) + '</div>' +
          '<div class="ss6-rows">' + visibleFields(gr).map(function (o) {
            return '<div class="ss6-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss6-k">' + esc(o.f.label) + '</span><span class="ss6-sep">· · ·</span>' +
              valHTML(o, { cls: 'ss6-v', empty: '未详' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('') + '<div class="ss6-rod bottom"></div></div></div>';
  }

  /* 7. 蒸汽 · 黄铜仪表盘：大齿轮 + 铆钉铭牌 + 压力表 + 仪表读数 */
  function skinZhengqi(groups, g) {
    return '<div class="ss7-gearbg" aria-hidden="true">⚙</div>' +
      '<div class="ss7-plate"><div class="ss7-gear">⚙</div>' +
      '<div class="ss7-name"><b>' + esc(WID.t) + ' / AETHER</b><small>' + esc(zhName(g)) + ' · ' + esc(WID.sub) + ' · A-' + String(Math.abs(hashStr(g || 'x')) % 90 + 10) + '</small></div>' +
      '<div class="ss7-gauge"><em>PSI</em></div></div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss7-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss7-gt"><span class="ss7-r"></span>' + esc(gr.name) + '<span class="ss7-r"></span></div>' +
          '<div class="ss7-rows">' + visibleFields(gr).map(function (o) {
            return '<div class="ss7-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss7-k">' + esc(o.f.label) + '</span>' +
              '<span class="ss7-dial">○════◉</span>' +
              valHTML(o, { cls: 'ss7-v', empty: '—' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  /* 8. 恐怖 · 证物档案：机密钢印 + CASE胶带 + 打字机 + 血手印 */
  function skinKongbu(groups, g) {
    var no = String(Math.abs(hashStr(g || 'x')) % 900 + 100);
    return '<div class="ss8-head"><span class="ss8-tape">CASE FILE</span>' +
      '<span class="ss8-confid">机 密</span><b>' + esc(WID.t) + ' · NO.' + no + '</b></div>' +
      '<div class="ss8-blood">✋</div>' +
      groupsOf(groups).map(function (gr, gi) {
        return '<div class="ss8-grp' + (gr.exclusive ? ' ex' : '') + '">' +
          '<div class="ss8-gt">▤ EXHIBIT ' + ROMAN[gi] + ' · ' + esc(gr.name) + '</div>' +
          '<div class="ss8-rows">' + visibleFields(gr).map(function (o) {
            return '<div class="ss8-row" data-fk="' + esc(o.f.k) + '">' +
              '<span class="ss8-k">' + esc(o.f.label) + '</span><span class="ss8-lead"></span>' +
              valHTML(o, { cls: 'ss8-v', empty: '？？？' }) + '</div>';
          }).join('') + '</div></div>';
      }).join('');
  }

  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
  /* 竖排标题：去掉分隔空格，逐字换行（武侠卷轴用） */
  function vtitle(t) { return esc(String(t || '').replace(/\s+/g, '')).split('').join('<br>'); }

  var RENDER = {
    xianxia: skinXianxia, youxi: skinYouxi, dushi: skinDushi, keji: skinKeji,
    kepfu: skinKepfu, wuxia: skinWuxia, zhengqi: skinZhengqi, kongbu: skinKongbu
  };

  /* 氛围标签条：固定的世界氛围词（非数值、非原著专名）。
     每个题材三个标签：领域 / 基调 / 处境。 */
  var AMBIENCE = {
    xianxia: ['☯ 修行界', '云海苍茫', '逆天改命'],
    youxi:   ['◈ 竞技场', '赛季进行中', '排位冲刺'],
    dushi:   ['▣ 都市', '身份档案', '实时更新'],
    keji:    ['[SYS] 星域', '链路稳定', '未知区域'],
    kepfu:   ['👁 深渊', '不可名状', '理智流失'],
    wuxia:   ['俠 江湖', '恩怨情仇', '快意恩仇'],
    zhengqi: ['⚙ 魔导', '齿轮运转', '能量稳定'],
    kongbu:  ['機 密', '调查进行中', '真相未明']
  };
  function ambienceHTML(skin) {
    var tags = AMBIENCE[skin] || AMBIENCE.xianxia;
    return '<div class="ss-amb ss-amb-' + skin + '">' +
      tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('<i>·</i>') +
      '</div>';
  }

  function currentGenreKey(g) {
    if (g && typeof g === 'string') return g;
    try {
      var q = new URLSearchParams(location.search).get('genre');
      if (q) return q;
      var fw = window.storyFramework;
      return (fw && (fw.genre || (fw.config && fw.config.genre))) || '';
    } catch (e) { return ''; }
  }
  function render(groups, g) {
    var skin = skinOf(g);
    var key = currentGenreKey(g);
    WID = WORLD_ID[key] || WORLD_ID.free;
    var sec = document.getElementById('yjStatusSection');
    if (sec) {
      sec.setAttribute('data-status-skin', skin);
      sec.setAttribute('data-world', key);
      /* 每界唯一主色注入为 CSS 变量：--wpri 主色 / --wpri-glow 辉光 / --wpri-dim 淡底 */
      sec.style.setProperty('--wpri', WID.c);
      sec.style.setProperty('--wpri-glow', hexA(WID.c, 0.42));
      sec.style.setProperty('--wpri-dim', hexA(WID.c, 0.14));
    }
    try {
      document.body.setAttribute('data-skin', skin);
      document.body.style.setProperty('--wpri', WID.c);
      document.body.style.setProperty('--wpri-glow', hexA(WID.c, 0.42));
    } catch (e) {}
    /* v4.27.0 减法：去掉状态栏里重复的「身份铭牌」——窄条里徽记/题词/名字重复三次太挤。
       世界身份改由主内容区「入世封面」承载（空间大、更好看）；状态栏只留一处徽记印章。 */
    try { return ambienceHTML(skin) + (RENDER[skin] || skinXianxia)(groups, g); }
    catch (e) { return '<div class="empty-hint">皮肤渲染异常，已回退。</div>'; }
  }

  /* ============ 8 套 CSS ============ */
  var CSS = `
/* 基础 */
#yjStatusSection[data-status-skin]{padding:13px 13px 15px;position:relative;overflow:hidden;border-radius:9px;isolation:isolate}
#yjStatusSection[data-status-skin] .section-title{color:inherit;opacity:.92}
#yjStatusSection[data-status-skin] .yj-st-cog{border-color:currentColor;color:inherit;opacity:.55}
#yjStatusSection[data-status-skin] .empty-hint{display:none}
#yjStatusSection[data-status-skin] > *{position:relative;z-index:2}

/* ===== 1 仙逆 · 云海道册（青碧云海 + 金光 + 太极 + 水墨远山） ===== */
#yjStatusSection[data-status-skin="xianxia"]{--p:#e8c877;background:
  radial-gradient(ellipse 70% 42% at 78% -6%,rgba(240,214,140,.28),transparent 62%),
  radial-gradient(ellipse 90% 46% at 20% 104%,rgba(150,205,185,.16),transparent 70%),
  linear-gradient(160deg,#0a1c1d 0%,#0d2423 46%,#091715 100%);
  border:1px solid #3c6357;color:#f0e6c4;box-shadow:inset 0 0 46px rgba(0,0,0,.36),0 0 0 1px rgba(232,200,119,.08) inset}
/* 云海 + 水墨远山 + 灵光 */
.ss1-sky{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.ss1-sky::before{content:"";position:absolute;inset:0;
  background:
    radial-gradient(ellipse 55% 18% at 18% 78%,rgba(190,225,210,.11),transparent 70%),
    radial-gradient(ellipse 48% 15% at 78% 86%,rgba(190,225,210,.09),transparent 70%),
    radial-gradient(ellipse 60% 14% at 45% 96%,rgba(200,232,218,.08),transparent 70%),
    repeating-linear-gradient(0deg,transparent 0 6px,rgba(232,200,119,.014) 6px 7px)}
.ss1-sky::after{content:"道";position:absolute;right:-10px;top:26%;font:700 190px "STKaiti","KaiTi",serif;color:rgba(232,200,119,.045);line-height:1}
.ss1-mt{position:absolute;left:-4%;bottom:-2%;width:70%;height:32%;
  background:linear-gradient(180deg,rgba(120,170,150,.16),transparent);
  clip-path:polygon(0 100%,8% 62%,18% 80%,30% 34%,42% 72%,55% 46%,68% 78%,82% 40%,100% 82%,100% 100%)}
.ss1-sun{position:absolute;right:16%;top:9%;width:58px;height:58px;border-radius:50%;
  background:radial-gradient(circle,rgba(240,215,140,.5),rgba(240,215,140,.05) 62%,transparent 70%);
  box-shadow:0 0 46px rgba(232,200,119,.28);animation:ss1glow 4s ease-in-out infinite}
@keyframes ss1glow{50%{opacity:.55;transform:scale(1.08)}}
.ss1-crane{position:absolute;color:rgba(232,200,119,.35);font-size:13px;top:20%;left:60%;animation:ss1fly 9s linear infinite}
.ss1-crane.c2{top:30%;left:40%;font-size:10px;animation-duration:12s;animation-delay:-4s}
@keyframes ss1fly{0%{transform:translate(0,0);opacity:0}20%{opacity:.5}80%{opacity:.5}100%{transform:translate(-160px,-30px);opacity:0}}
.ss1-head{display:flex;align-items:center;gap:12px;position:relative;z-index:2;margin-bottom:12px}
.ss1-taiji{width:46px;height:46px;display:grid;place-items:center;font-size:40px;line-height:1;color:#e8c877;
  text-shadow:0 0 16px rgba(232,200,119,.5);animation:ss1spin 12s linear infinite}
@keyframes ss1spin{to{transform:rotate(360deg)}}
.ss1-title b{display:block;font:700 20px "STKaiti","KaiTi",serif;letter-spacing:.28em;color:#f4d98f;text-shadow:0 0 16px rgba(232,200,119,.35)}
.ss1-title small{display:block;font-size:10px;color:#a9c4ae;letter-spacing:.16em;margin-top:4px}
.ss1-cloud{display:block;font-size:9px;color:rgba(232,200,119,.42);letter-spacing:.1em;margin-top:3px}
.ss1-seal{margin-left:auto;width:44px;height:44px;display:grid;place-items:center;border:3px double #c04536;color:#e0503a;
  font:700 25px "STKaiti","KaiTi",serif;border-radius:5px;transform:rotate(-9deg);
  box-shadow:0 0 0 3px rgba(192,69,54,.14) inset,0 3px 14px rgba(0,0,0,.4);text-shadow:0 0 8px rgba(224,80,58,.4)}
.ss1-grp{margin:0 0 11px;padding:9px 12px 11px;border:1px solid rgba(232,200,119,.24);border-radius:4px;
  background:linear-gradient(135deg,rgba(232,200,119,.06),rgba(120,170,150,.03) 55%,transparent);position:relative;z-index:2;
  box-shadow:0 2px 10px rgba(0,0,0,.14)}
.ss1-grp.ex{border-color:rgba(232,200,119,.55);box-shadow:0 0 22px rgba(232,200,119,.12) inset,0 0 0 1px rgba(232,200,119,.12)}
.ss1-grp::before,.ss1-grp::after{content:"❈";position:absolute;color:rgba(232,200,119,.4);font-size:11px;top:4px}
.ss1-grp::before{left:4px}.ss1-grp::after{right:4px;content:"❈"}
.ss1-gt{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.ss1-vol{width:25px;height:25px;display:grid;place-items:center;background:linear-gradient(145deg,#a8382a,#7d261c);color:#f6e3bd;
  font:14px "STKaiti","KaiTi",serif;border-radius:3px;transform:rotate(-4deg);box-shadow:0 2px 6px rgba(0,0,0,.3)}
.ss1-gtn{font:700 14px "STKaiti","KaiTi",serif;color:#f0d894;letter-spacing:.14em;text-shadow:0 0 8px rgba(232,200,119,.25)}
.ss1-gt i{flex:1;height:1px;background:linear-gradient(90deg,rgba(232,200,119,.5),transparent)}
.ss1-rune{color:rgba(232,200,119,.55);font-size:13px}
.ss1-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px}
.ss1-row{display:flex;align-items:baseline;gap:6px;font-size:12px;min-width:0}
.ss1-no{color:#c9a24a;font:13px "STKaiti","KaiTi",serif;opacity:.85;width:18px;flex:0 0 auto}
.ss1-k{color:#e6d5a6;flex:0 0 auto;letter-spacing:.05em}
.ss1-lead{flex:1;border-bottom:1px dotted rgba(232,200,119,.32);min-width:5px;transform:translateY(-3px)}
.ss1-v{color:#f6ecd0;cursor:pointer;text-align:right;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss1-v.ph{color:#7f947e;opacity:.75}.ss1-v:hover{color:#e8c877;text-shadow:0 0 8px rgba(232,200,119,.5)}

/* ===== 2 网游 · 技能栏HUD（深蓝黑 + 霓虹青 + 血蓝条 + 扫描线） ===== */
#yjStatusSection[data-status-skin="youxi"]{--p:#39e0c8;background:
  linear-gradient(rgba(57,224,200,.04) 1px,transparent 1px) 0 0/100% 22px,
  linear-gradient(90deg,rgba(57,224,200,.04) 1px,transparent 1px) 0 0/22px 100%,
  radial-gradient(circle at 50% 0%,rgba(57,224,200,.1),transparent 55%),#08131a;
  border:1px solid #1c4b50;color:#dff7f3;box-shadow:inset 0 0 40px rgba(0,0,0,.4)}
.ss2-scan{position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,transparent 0,rgba(57,224,200,.06) 50%,transparent 100%);
  background-size:100% 120px;animation:ss2scan 6s linear infinite;opacity:.7}
@keyframes ss2scan{to{background-position:0 240px}}
.ss2-top{display:flex;align-items:center;gap:11px;margin-bottom:10px}
.ss2-avatar{width:44px;height:44px;display:grid;place-items:center;font-size:24px;border:2px solid #39e0c8;border-radius:8px;
  background:rgba(57,224,200,.1);box-shadow:0 0 16px rgba(57,224,200,.3)}
.ss2-id b{display:block;font-size:13px;color:#8ff0dd;letter-spacing:.04em}
.ss2-lv{display:inline-block;margin-top:3px;font:11px ui-monospace,monospace;color:#ffd166}
.ss2-bars{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.ss2-bar{position:relative;height:14px;border:1px solid rgba(255,255,255,.15);border-radius:2px;background:#050c10;overflow:hidden}
.ss2-bar i{display:block;height:100%}.ss2-bar.hp i{background:linear-gradient(90deg,#c0392b,#e74c3c);box-shadow:0 0 10px rgba(231,76,60,.5)}
.ss2-bar.mp i{background:linear-gradient(90deg,#2980b9,#3498db);box-shadow:0 0 10px rgba(52,152,219,.5)}
.ss2-bar em{position:absolute;inset:0;font:9px ui-monospace,monospace;font-style:normal;color:#fff;text-align:center;line-height:14px;text-shadow:0 1px 2px #000}
.ss2-grp{margin:0 0 11px;position:relative}.ss2-grp.ex .ss2-gt span{color:#ffd166}
.ss2-gt{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.ss2-gt span{font:11px ui-monospace,monospace;color:#39e0c8;background:rgba(57,224,200,.12);padding:2px 8px;clip-path:polygon(0 0,100% 0,94% 100%,0 100%)}
.ss2-gt i{flex:1;height:1px;background:repeating-linear-gradient(90deg,rgba(57,224,200,.35) 0 5px,transparent 5px 9px)}
.ss2-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.ss2-slot{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid rgba(57,224,200,.18);border-radius:4px;background:rgba(6,20,24,.7);min-width:0}
.ss2-slot.on{border-color:rgba(57,224,200,.45);box-shadow:0 0 10px rgba(57,224,200,.12) inset}
.ss2-ico{width:22px;height:22px;display:grid;place-items:center;color:#39e0c8;border:1px solid rgba(57,224,200,.35);border-radius:4px;flex:0 0 auto;font-size:12px}
.ss2-nm{color:#a9cfc9;font-size:11px;flex:0 0 auto}
.ss2-val{margin-left:auto;color:#e9fffb;cursor:pointer;font:11px ui-monospace,monospace;max-width:50%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss2-slot:not(.on) .ss2-val{color:#4c6d69}.ss2-val:hover{color:#39e0c8}

/* ===== 3 都市 · 证件档案卡（米白 + 商务蓝 + 公章） ===== */
#yjStatusSection[data-status-skin="dushi"]{--p:#3f6fd8;background:linear-gradient(135deg,#f7f5ee,#ece8dc);
  border:1px solid #c9c4b4;color:#2b3242;box-shadow:inset 0 0 30px rgba(120,110,90,.08)}
.ss3-watermark{position:absolute;right:-6px;bottom:8%;font:800 34px ui-monospace,monospace;color:rgba(63,111,216,.05);
  transform:rotate(-90deg);transform-origin:right bottom;letter-spacing:.1em;z-index:0;pointer-events:none}
.ss3-card{display:flex;align-items:center;gap:12px;padding:11px;border:1px solid #b9c6de;border-radius:7px;background:#fff;position:relative;box-shadow:0 2px 8px rgba(40,60,100,.1);margin-bottom:6px}
.ss3-photo{width:52px;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;border:1px solid #c4ccd8;background:#eef1f6;border-radius:3px;flex:0 0 auto;color:#7f8ba0}
.ss3-photo small{font:8px ui-monospace,monospace;margin-top:3px}
.ss3-info{flex:1;min-width:0}
.ss3-hd{font:10px ui-monospace,monospace;letter-spacing:.12em;color:#3f6fd8;margin-bottom:4px}
.ss3-info b{display:block;font-size:15px;color:#26324a;letter-spacing:.05em}
.ss3-meta{display:flex;gap:14px;margin-top:6px;font-size:10px;color:#7a8496}
.ss3-meta em{font-style:normal;color:#3f6fd8;font-family:ui-monospace,monospace}
.ss3-stamp{position:absolute;right:12px;top:14px;border:2px solid #c0392b;color:#c0392b;font:700 12px "STKaiti","KaiTi",serif;padding:3px 6px;border-radius:3px;transform:rotate(-14deg);opacity:.72}
.ss3-barcode{height:20px;margin:0 0 12px;background:repeating-linear-gradient(90deg,#333 0 2px,transparent 2px 4px,#333 4px 5px,transparent 5px 9px);opacity:.6;width:70%;position:relative;z-index:2}
.ss3-grp{margin:0 0 10px;position:relative}
.ss3-gt{font-size:11px;color:#2f57ad;font-weight:700;margin-bottom:5px;padding:2px 0;border-bottom:2px solid #c9d6ee}
.ss3-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}
.ss3-row{display:flex;align-items:baseline;gap:5px;font-size:11px;min-width:0}
.ss3-k{color:#5b6577;flex:0 0 auto}.ss3-lead{flex:1;border-bottom:1px dotted #b7bfcc;min-width:5px;transform:translateY(-3px)}
.ss3-v{color:#20293a;cursor:pointer;text-align:right;max-width:54%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss3-v.ph{color:#a2a9b6}.ss3-v:hover{color:#3f6fd8}

/* ===== 4 科幻 · 星舰终端（深空黑 + 全息青 + 霓虹 + 数据流 + 故障字） ===== */
#yjStatusSection[data-status-skin="keji"]{--p:#48d6ff;background:
  radial-gradient(ellipse 70% 40% at 50% 0%,rgba(72,214,255,.12),transparent 60%),
  radial-gradient(ellipse 50% 30% at 90% 100%,rgba(200,60,255,.07),transparent 60%),#03080b;
  border:1px solid #155263;color:#cfeeff;box-shadow:inset 0 0 50px rgba(0,0,0,.6),0 0 22px rgba(72,214,255,.06)}
#yjStatusSection[data-status-skin="keji"]::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(72,214,255,.05) 0 1px,transparent 1px 4px)}
.ss4-grid{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(rgba(72,214,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(72,214,255,.09) 1px,transparent 1px);
  background-size:26px 26px;transform:perspective(200px) rotateX(0deg);
  -webkit-mask-image:linear-gradient(180deg,transparent,#000 30%,#000 100%);mask-image:linear-gradient(180deg,transparent,#000 30%,#000 100%)}
.ss4-stream{position:absolute;right:2px;top:16%;z-index:0;pointer-events:none;writing-mode:vertical-rl;
  font:9px ui-monospace,monospace;color:rgba(92,255,157,.16);letter-spacing:.2em;white-space:nowrap;overflow:hidden;max-height:70%}
.ss4-top{display:flex;align-items:center;gap:12px;margin-bottom:12px;position:relative;z-index:2}
.ss4-radar{width:46px;height:46px;border-radius:50%;border:1px solid #2b7d8e;position:relative;flex:0 0 auto;
  background:radial-gradient(circle,#0d323a 1px,transparent 2px),radial-gradient(circle,#0d323a 1px,transparent 2px);background-size:14px 14px;
  box-shadow:0 0 16px rgba(72,214,255,.24),inset 0 0 12px rgba(72,214,255,.12)}
.ss4-radar::before,.ss4-radar::after{content:"";position:absolute;background:#2b7d8e}
.ss4-radar::before{left:50%;top:0;bottom:0;width:1px}.ss4-radar::after{top:50%;left:0;right:0;height:1px}
.ss4-radar b{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(72,214,255,.6),transparent 25%);animation:ss4spin 3s linear infinite}
@keyframes ss4spin{to{transform:rotate(360deg)}}
.ss4-sys span{display:block;font:11px ui-monospace,monospace;color:#48d6ff;letter-spacing:.1em}
.ss4-glitch{position:relative;text-shadow:0 0 10px rgba(72,214,255,.4)}
.ss4-glitch::before{content:attr(data-txt);position:absolute;left:1px;top:0;color:#ff4fd8;opacity:.5;clip-path:inset(0 0 60% 0);animation:ss4glitch 3.2s steps(2) infinite}
@keyframes ss4glitch{0%,92%,100%{transform:none;opacity:0}93%{transform:translateX(-2px);opacity:.6}96%{transform:translateX(2px);opacity:.5}}
.ss4-online{color:#5cff9d!important;margin-top:4px;font-size:10px!important;animation:ss4blink 2.2s infinite;text-shadow:0 0 8px rgba(92,255,157,.4)}
@keyframes ss4blink{50%{opacity:.45}}
.ss4-grp{margin:0 0 11px;position:relative;z-index:2;padding:7px 10px;border:1px solid rgba(72,214,255,.2);
  background:linear-gradient(135deg,rgba(72,214,255,.05),transparent 60%);
  clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)}
.ss4-grp.ex{border-color:rgba(72,214,255,.5);box-shadow:0 0 16px rgba(72,214,255,.1) inset}
.ss4-gt{font:10px ui-monospace,monospace;color:#48d6ff;letter-spacing:.06em;margin-bottom:5px;display:flex;align-items:center;gap:6px;text-shadow:0 0 8px rgba(72,214,255,.3)}
.ss4-node{width:6px;height:6px;background:#5cff9d;border-radius:50%;box-shadow:0 0 8px #5cff9d}
.ss4-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 12px}
.ss4-row{display:flex;align-items:baseline;gap:4px;font:10px ui-monospace,monospace;min-width:0}
.ss4-prompt{color:#5cff9d}.ss4-k{color:#8fd8f0;flex:0 0 auto;letter-spacing:.03em}
.ss4-br{color:#48d6ff;opacity:.6}
.ss4-v{color:#d8f6ff;cursor:pointer;flex:1;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss4-v.ph{color:#48707e}.ss4-v:hover{color:#48d6ff;background:rgba(72,214,255,.14);text-shadow:0 0 8px rgba(72,214,255,.6)}

/* ===== 5 克苏鲁 · 深渊秘录（近黑暗紫 + 血污 + 触手 + 凝视之眼 + 诡符） ===== */
#yjStatusSection[data-status-skin="kepfu"]{--p:#a8322a;background:
  radial-gradient(ellipse 70% 50% at 82% 8%,rgba(120,40,150,.2),transparent 60%),
  radial-gradient(ellipse 80% 50% at 10% 96%,rgba(20,90,70,.16),transparent 65%),
  linear-gradient(155deg,#0a0710 0%,#100a16 52%,#08060c 100%);
  border:1px solid #3a2438;color:#d8c8d0;box-shadow:inset 0 0 60px rgba(0,0,0,.7)}
.ss5-dark{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.ss5-dark::before{content:"☾";position:absolute;right:4%;top:30%;font-size:170px;color:rgba(168,50,42,.06);
  text-shadow:0 0 40px rgba(120,40,150,.14);animation:ss5breath 6s ease-in-out infinite}
@keyframes ss5breath{50%{opacity:.55;transform:scale(1.05) rotate(4deg)}}
.ss5-tent{position:absolute;border:3px solid rgba(90,120,80,.09);border-radius:50%;filter:blur(1px)}
.ss5-tent.t1{width:180px;height:180px;left:-70px;bottom:-60px;border-right-color:transparent;border-top-color:transparent;transform:rotate(25deg)}
.ss5-tent.t2{width:150px;height:150px;right:-50px;top:24%;border-left-color:transparent;border-bottom-color:transparent;transform:rotate(-35deg)}
.ss5-tent.t3{width:120px;height:120px;left:30%;top:-70px;border-bottom-color:transparent;border-left-color:transparent;transform:rotate(60deg)}
.ss5-blood{position:absolute;right:8%;bottom:6%;width:110px;height:80px;border-radius:50% 40% 55% 45%;
  background:radial-gradient(ellipse at 40% 45%,rgba(140,25,20,.3),rgba(90,15,12,.12) 55%,transparent 72%);filter:blur(3px)}
.ss5-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;position:relative;z-index:2;
  border-bottom:1px solid rgba(168,50,42,.3);padding-bottom:9px}
.ss5-eye{width:48px;height:48px;display:grid;place-items:center;font-size:32px;flex:0 0 auto;
  filter:drop-shadow(0 0 10px rgba(168,50,42,.5));animation:ss5blink-eye 5s ease-in-out infinite}
@keyframes ss5blink-eye{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}97%{transform:scaleY(1)}}
.ss5-t b{display:block;font:700 19px "STKaiti","KaiTi",serif;letter-spacing:.28em;color:#b8443c;text-shadow:0 0 14px rgba(168,50,42,.45)}
.ss5-t small{display:block;font-size:10px;color:#8a7480;letter-spacing:.1em;margin-top:3px}
.ss5-rune{display:block;font-size:11px;color:rgba(150,190,120,.5);letter-spacing:.34em;margin-top:5px;text-shadow:0 0 10px rgba(120,180,90,.3)}
.ss5-wax{margin-left:auto;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#b83428,#5c1610);color:#f0c8b8;font:14px "STKaiti","KaiTi",serif;
  box-shadow:0 2px 10px rgba(0,0,0,.6),0 0 14px rgba(168,50,42,.3);transform:rotate(10deg)}
.ss5-grp{margin:0 0 10px;padding:8px 11px;border:1px solid rgba(150,110,90,.22);position:relative;z-index:2;
  background:linear-gradient(135deg,rgba(30,18,26,.7),rgba(12,8,14,.6));border-radius:3px;
  box-shadow:inset 0 0 20px rgba(0,0,0,.4)}
.ss5-grp.ex{border-color:rgba(168,50,42,.5);box-shadow:inset 0 0 22px rgba(120,25,20,.2),0 0 0 1px rgba(168,50,42,.12)}
.ss5-grp::after{content:"⚝";position:absolute;right:7px;top:5px;color:rgba(150,190,120,.35);font-size:11px;pointer-events:none}
.ss5-gt{font:13px "STKaiti","KaiTi",serif;color:#c25a4e;letter-spacing:.12em;margin-bottom:6px;text-shadow:0 0 8px rgba(168,50,42,.3)}
.ss5-gt i{font-style:normal;color:rgba(150,190,120,.4);font-size:10px}
.ss5-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px}
.ss5-row{display:flex;align-items:baseline;gap:5px;font-size:12px;min-width:0}
.ss5-r{color:rgba(150,190,120,.7);flex:0 0 auto;text-shadow:0 0 6px rgba(120,180,90,.3)}
.ss5-k{color:#b9a4ae;flex:0 0 auto;font-family:"STKaiti","KaiTi",serif}
.ss5-lead{flex:1;border-bottom:1px dotted rgba(168,50,42,.34);min-width:5px;transform:translateY(-3px)}
.ss5-v{color:#dcc6cf;cursor:pointer;text-align:right;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"STKaiti","KaiTi",serif}
.ss5-v.ph{color:#6d5a66;font-style:italic}.ss5-v:hover{color:#c25a4e;text-shadow:0 0 8px rgba(194,90,78,.5)}
.ss5-foot{text-align:center;font:11px "STKaiti","KaiTi",serif;color:rgba(150,120,130,.5);margin-top:12px;letter-spacing:.08em;position:relative;z-index:2}
.ss5-foot span{display:block;color:rgba(150,190,120,.35);font-size:13px;letter-spacing:.3em;margin-top:2px}

/* ===== 6 武侠 · 竹简卷轴（竹黄 + 卷轴轴 + 大朱砂印 + 竖排标题） ===== */
#yjStatusSection[data-status-skin="wuxia"]{--p:#8a2b1e;background:linear-gradient(90deg,rgba(140,110,60,.14) 0 2px,transparent 2px 22px),
  linear-gradient(160deg,#e5d6ac,#d3c08e);border:2px solid #a98a52;color:#2c2417;padding:0;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.ss6-scroll{position:relative}
.ss6-rod{height:12px;background:linear-gradient(180deg,#7a5a30,#4e3618,#7a5a30);border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,.3);position:relative}
.ss6-rod::before,.ss6-rod::after{content:"";position:absolute;top:-3px;width:14px;height:18px;border-radius:3px;background:linear-gradient(180deg,#8a6a3a,#3e2a12)}
.ss6-rod::before{left:8px}.ss6-rod::after{right:8px}
.ss6-body{padding:10px 14px 14px;background:repeating-linear-gradient(90deg,rgba(120,90,50,.09) 0 1px,transparent 1px 20px),
  radial-gradient(ellipse at 85% 10%,rgba(150,40,25,.06),transparent 45%)}
.ss6-head{display:flex;align-items:center;gap:14px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid rgba(120,80,40,.3)}
.ss6-bigseal{width:50px;height:50px;display:grid;place-items:center;background:#a32d1f;color:#f5e0bd;font:700 30px "STKaiti","KaiTi",serif;border-radius:4px;transform:rotate(-6deg);box-shadow:0 3px 10px rgba(120,25,15,.45)}
.ss6-vtitle{font:600 17px/1.05 "STKaiti","KaiTi",serif;letter-spacing:.15em;color:#3a2b18}
.ss6-sub{margin-left:auto;font:12px/1.5 "STKaiti","KaiTi",serif;color:#6b5434;text-align:right}
.ss6-grp{margin:0 0 9px;position:relative}
.ss6-gt{font:600 13px "STKaiti","KaiTi",serif;color:#7a2318;letter-spacing:.1em;margin-bottom:5px}
.ss6-grp.ex .ss6-gt{text-decoration:underline;text-decoration-color:rgba(122,35,24,.4)}
.ss6-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 14px}
.ss6-row{display:flex;align-items:baseline;gap:5px;font:13px "STKaiti","KaiTi",serif;min-width:0}
.ss6-k{color:#4b3a22;flex:0 0 auto}.ss6-sep{color:#9a7b48;flex:1;letter-spacing:.2em;overflow:hidden;white-space:nowrap}
.ss6-v{color:#2c2010;cursor:pointer;text-align:right;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss6-v.ph{color:#9a845c}.ss6-v:hover{color:#8a2b1e}

/* ===== 7 蒸汽 · 黄铜仪表（深棕 + 齿轮 + 铆钉 + 压力表） ===== */
#yjStatusSection[data-status-skin="zhengqi"]{--p:#d1a05e;background:radial-gradient(circle at 90% 5%,rgba(190,140,70,.18),transparent 45%),
  linear-gradient(160deg,#1d150d,#261b11);border:2px solid #7a5a34;color:#e9d3ad;box-shadow:inset 0 0 34px rgba(0,0,0,.5)}
.ss7-gearbg{position:absolute;right:-30px;bottom:-40px;font-size:200px;color:rgba(209,160,94,.04);z-index:0;pointer-events:none;animation:ss7spin 20s linear infinite}
@keyframes ss7spin{to{transform:rotate(360deg)}}
.ss7-plate{display:flex;align-items:center;gap:12px;padding:9px 12px;margin-bottom:12px;border:2px solid #7a5a34;border-radius:6px;
  background:linear-gradient(180deg,rgba(190,140,70,.18),rgba(0,0,0,.25));box-shadow:0 0 0 3px rgba(122,90,52,.25) inset;position:relative;z-index:2}
.ss7-plate::before,.ss7-plate::after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#b89060,#5a4024);top:6px}
.ss7-plate::before{left:6px}.ss7-plate::after{right:6px}
.ss7-gear{font-size:32px;color:#d1a05e;animation:ss7spin 14s linear infinite}
.ss7-name{flex:1;min-width:0}
.ss7-name b{display:block;font:600 12px ui-monospace,monospace;letter-spacing:.1em;color:#e8c48a}
.ss7-name small{font-size:10px;color:#a4885e}
.ss7-gauge{width:40px;height:40px;border-radius:50%;border:3px solid #8a6a3e;position:relative;flex:0 0 auto;
  background:conic-gradient(from 220deg,#d1a05e 0 130deg,#3a2a18 130deg 280deg,transparent 280deg)}
.ss7-gauge::after{content:"";position:absolute;left:50%;top:50%;width:2px;height:15px;background:#f0d9a8;transform-origin:bottom center;transform:translate(-50%,-100%) rotate(40deg)}
.ss7-gauge em{position:absolute;inset:auto 0 -2px;text-align:center;font:7px ui-monospace,monospace;color:#a4885e;font-style:normal}
.ss7-grp{margin:0 0 10px;border:1px solid rgba(192,138,74,.35);border-radius:4px;padding:7px 10px;background:rgba(0,0,0,.15);position:relative;z-index:2}
.ss7-grp.ex{border-color:rgba(209,160,94,.7)}
.ss7-gt{display:flex;align-items:center;gap:7px;font-size:11px;color:#e2bd83;font-weight:600;margin-bottom:6px}
.ss7-r{width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#b89060,#5a4024)}
.ss7-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}
.ss7-row{display:flex;align-items:baseline;gap:5px;font-size:11px;min-width:0}
.ss7-k{color:#cbb28a;flex:0 0 auto}.ss7-dial{color:#c08a4a;flex:1;min-width:10px;overflow:hidden;white-space:nowrap;letter-spacing:-1px;opacity:.8}
.ss7-v{color:#f0dcbc;cursor:pointer;text-align:right;max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss7-v.ph{color:#8a7350}.ss7-v:hover{color:#d1a05e}

/* ===== 8 恐怖 · 证物档案（冷灰纸 + 机密钢印 + 血手印 + 打字机） ===== */
#yjStatusSection[data-status-skin="kongbu"]{--p:#a8322a;background:radial-gradient(ellipse at 85% 90%,rgba(140,30,20,.1),transparent 45%),
  linear-gradient(135deg,#ded8c4,#cac2a6);border:1px solid #9f9878;color:#2b2a20;box-shadow:inset 0 0 40px rgba(60,50,30,.12)}
.ss8-head{display:flex;align-items:center;gap:9px;margin-bottom:10px;position:relative;padding-bottom:8px;border-bottom:1px solid rgba(120,60,40,.3)}
.ss8-tape{background:rgba(170,155,100,.8);color:#33301f;font:700 10px ui-monospace,monospace;padding:3px 9px;transform:rotate(-2deg);letter-spacing:.12em}
.ss8-confid{border:2px solid #a8322a;color:#a8322a;font:700 13px "STKaiti","KaiTi",serif;padding:2px 7px;transform:rotate(-8deg);opacity:.8}
.ss8-head b{font:12px "Courier New",monospace;color:#5a4a38;letter-spacing:.04em;margin-left:auto}
.ss8-blood{position:absolute;right:14px;top:60px;font-size:36px;color:rgba(150,30,20,.22);transform:rotate(-20deg);pointer-events:none;z-index:1}
.ss8-grp{margin:0 0 10px;padding:7px 10px;border:1px dashed rgba(120,70,50,.4);background:rgba(255,252,240,.25);position:relative;z-index:2}
.ss8-grp.ex{border-style:solid;border-color:rgba(168,50,42,.55)}
.ss8-gt{font:11px "Courier New",monospace;color:#7a3a30;margin-bottom:6px;letter-spacing:.05em}
.ss8-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px}
.ss8-row{display:flex;align-items:baseline;gap:5px;font:12px "Courier New",monospace;min-width:0}
.ss8-k{color:#5e5040;flex:0 0 auto}.ss8-lead{flex:1;border-bottom:1px solid rgba(120,70,50,.35);min-width:5px;transform:translateY(-3px)}
.ss8-v{color:#2b241d;cursor:pointer;text-align:right;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss8-v.ph{color:#9a6a5e;font-style:italic}.ss8-v:hover{color:#a8322a;background:rgba(168,50,42,.1)}

/* ===== 仪表盘皮肤：body[data-skin] 让叙事仪表盘吃同一套视觉语言 ===== */
body[data-skin] .panel-section:has(.gauge-row){margin:0 0 12px;padding:11px 13px;border-radius:8px;position:relative;overflow:hidden}
body[data-skin] .panel-section:has(.gauge-row) .section-title{margin-bottom:9px;padding-bottom:6px}
/* 1 仙逆 */
body[data-skin="xianxia"] .panel-section:has(.gauge-row){background:linear-gradient(150deg,rgba(13,36,35,.94),rgba(9,23,21,.94));border:1px solid #3c6357;color:#f0e6c4;box-shadow:inset 0 0 26px rgba(0,0,0,.35)}
body[data-skin="xianxia"] .panel-section:has(.gauge-row) .section-title{color:#f0d894!important;border-bottom:1px solid rgba(232,200,119,.3);font-family:"STKaiti","KaiTi",serif}
body[data-skin="xianxia"] .gauge-label{color:#e6d5a6!important;font-family:"STKaiti","KaiTi",serif}
body[data-skin="xianxia"] .gauge-bar{background:rgba(0,0,0,.5);border:1px solid rgba(232,200,119,.3)}
body[data-skin="xianxia"] .gauge-fill{background:linear-gradient(90deg,#8f2f24,#e8c877)!important;box-shadow:0 0 10px rgba(232,200,119,.5)}
body[data-skin="xianxia"] .gauge-num{color:#f4d98f!important;font-family:"STKaiti","KaiTi",serif}
/* 2 网游 */
body[data-skin="youxi"] .panel-section:has(.gauge-row){background:linear-gradient(rgba(57,224,200,.035) 1px,transparent 1px) 0 0/100% 20px,linear-gradient(90deg,rgba(57,224,200,.035) 1px,transparent 1px) 0 0/20px 100%,#08131a;border:1px solid #1c4b50;color:#dff7f3}
body[data-skin="youxi"] .panel-section:has(.gauge-row) .section-title{color:#39e0c8!important;font:11px ui-monospace,monospace;letter-spacing:.08em}
body[data-skin="youxi"] .gauge-label{color:#8ff0dd!important;font:10px ui-monospace,monospace}
body[data-skin="youxi"] .gauge-bar{background:#050c10;border:1px solid rgba(57,224,200,.3);border-radius:2px}
body[data-skin="youxi"] .gauge-fill{background:linear-gradient(90deg,#1a7a6a,#39e0c8)!important;box-shadow:0 0 8px rgba(57,224,200,.5)}
body[data-skin="youxi"] .gauge-num{color:#ffd166!important;font:11px ui-monospace,monospace}
/* 3 都市 */
body[data-skin="dushi"] .panel-section:has(.gauge-row){background:linear-gradient(135deg,#f7f5ee,#ece8dc);border:1px solid #c9c4b4;color:#2b3242}
body[data-skin="dushi"] .panel-section:has(.gauge-row) .section-title{color:#3f6fd8!important;border-bottom:2px solid #c9d6ee}
body[data-skin="dushi"] .gauge-label{color:#5b6577!important;font-size:11px}
body[data-skin="dushi"] .gauge-bar{background:#dfe4ec;border:1px solid #b7bfcc}
body[data-skin="dushi"] .gauge-fill{background:linear-gradient(90deg,#2f57ad,#3f6fd8)!important}
body[data-skin="dushi"] .gauge-num{color:#26324a!important;font-family:ui-monospace,monospace}
/* 4 科幻 */
body[data-skin="keji"] .panel-section:has(.gauge-row){background:radial-gradient(ellipse at 50% 0,rgba(72,214,255,.1),transparent 60%),#03080b;border:1px solid #155263;color:#cfeeff}
body[data-skin="keji"] .panel-section:has(.gauge-row) .section-title{color:#48d6ff!important;font:11px ui-monospace,monospace;letter-spacing:.1em;border-left:2px solid #48d6ff;padding-left:7px}
body[data-skin="keji"] .gauge-label{color:#8fd8f0!important;font:10px ui-monospace,monospace}
body[data-skin="keji"] .gauge-bar{background:#07161c;border:1px solid #2b7d8e;border-radius:1px}
body[data-skin="keji"] .gauge-fill{background:repeating-linear-gradient(90deg,#48d6ff 0 6px,#1a5f70 6px 9px)!important;box-shadow:0 0 9px rgba(72,214,255,.5)}
body[data-skin="keji"] .gauge-num{color:#5cff9d!important;font:11px ui-monospace,monospace;text-shadow:0 0 8px rgba(92,255,157,.4)}
/* 5 克苏鲁 */
body[data-skin="kepfu"] .panel-section:has(.gauge-row){background:linear-gradient(150deg,#100a16,#08060c);border:1px solid #3a2438;color:#d8c8d0;box-shadow:inset 0 0 26px rgba(0,0,0,.6)}
body[data-skin="kepfu"] .panel-section:has(.gauge-row) .section-title{color:#b8443c!important;border-bottom:1px solid rgba(168,50,42,.3);font-family:"STKaiti","KaiTi",serif;text-shadow:0 0 8px rgba(168,50,42,.3)}
body[data-skin="kepfu"] .gauge-label{color:#b9a4ae!important;font-family:"STKaiti","KaiTi",serif;font-style:italic}
body[data-skin="kepfu"] .gauge-bar{background:rgba(0,0,0,.5);border:1px solid rgba(168,50,42,.35)}
body[data-skin="kepfu"] .gauge-fill{background:linear-gradient(90deg,#5c1610,#c25a4e)!important;box-shadow:0 0 8px rgba(194,90,78,.45)}
body[data-skin="kepfu"] .gauge-num{color:#c25a4e!important;font-family:"STKaiti","KaiTi",serif}
/* 6 武侠 */
body[data-skin="wuxia"] .panel-section:has(.gauge-row){background:repeating-linear-gradient(90deg,rgba(120,90,50,.09) 0 1px,transparent 1px 20px),linear-gradient(160deg,#e5d6ac,#d3c08e);border:2px solid #a98a52;color:#2c2417}
body[data-skin="wuxia"] .panel-section:has(.gauge-row) .section-title{color:#7a2318!important;border-bottom:2px solid rgba(120,80,40,.3);font-family:"STKaiti","KaiTi",serif}
body[data-skin="wuxia"] .gauge-label{color:#4b3a22!important;font-family:"STKaiti","KaiTi",serif}
body[data-skin="wuxia"] .gauge-bar{background:rgba(120,90,50,.15);border:1px solid rgba(120,80,40,.4)}
body[data-skin="wuxia"] .gauge-fill{background:linear-gradient(90deg,#8a2b1e,#b8472e)!important}
body[data-skin="wuxia"] .gauge-num{color:#7a2318!important;font-family:"STKaiti","KaiTi",serif}
/* 7 蒸汽 */
body[data-skin="zhengqi"] .panel-section:has(.gauge-row){background:radial-gradient(circle at 90% 5%,rgba(190,140,70,.16),transparent 45%),linear-gradient(160deg,#1d150d,#261b11);border:2px solid #7a5a34;color:#e9d3ad!important;box-shadow:inset 0 0 26px rgba(0,0,0,.45)}
body[data-skin="zhengqi"] .panel-section:has(.gauge-row) .section-title{color:#e2bd83!important;font:600 12px ui-monospace,monospace;letter-spacing:.1em;border-bottom:1px solid rgba(192,138,74,.4)}
body[data-skin="zhengqi"] .gauge-label{color:#cbb28a!important;font:11px ui-monospace,monospace}
body[data-skin="zhengqi"] .gauge-bar{background:rgba(0,0,0,.4);border:1px solid #7a5a34;border-radius:8px}
body[data-skin="zhengqi"] .gauge-fill{background:linear-gradient(90deg,#8a6a3e,#d1a05e)!important;box-shadow:0 0 7px rgba(209,160,94,.4)}
body[data-skin="zhengqi"] .gauge-num{color:#f0dcbc!important;font:12px ui-monospace,monospace}
/* 8 恐怖 */
body[data-skin="kongbu"] .panel-section:has(.gauge-row){background:radial-gradient(ellipse at 85% 90%,rgba(140,30,20,.1),transparent 45%),linear-gradient(135deg,#ded8c4,#cac2a6);border:1px dashed rgba(120,70,50,.5);color:#2b2a20}
body[data-skin="kongbu"] .panel-section:has(.gauge-row) .section-title{color:#7a3a30!important;border-bottom:1px solid rgba(120,60,40,.3);font:11px "Courier New",monospace;letter-spacing:.05em}
body[data-skin="kongbu"] .gauge-label{color:#5e5040!important;font:11px "Courier New",monospace}
body[data-skin="kongbu"] .gauge-bar{background:rgba(120,70,50,.14);border:1px solid rgba(120,70,50,.4)}
body[data-skin="kongbu"] .gauge-fill{background:repeating-linear-gradient(45deg,#a8322a 0 5px,#7d231b 5px 10px)!important}
body[data-skin="kongbu"] .gauge-num{color:#a8322a!important;font:12px "Courier New",monospace}

/* ===== 配套区块皮肤（六维/角色/伏笔/道具/大事记/用量） ===== */
body[data-skin] .panel-section:has([id$="Area"]){margin:0 0 12px;padding:11px 13px;border-radius:8px;position:relative}
body[data-skin] .panel-section:has([id$="Area"]) .section-title{margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid rgba(128,128,128,.22)}
body[data-skin] .panel-section:has([id$="Area"]) .empty-hint{opacity:.62}
body[data-skin="xianxia"] .panel-section:has([id$="Area"]){background:linear-gradient(150deg,rgba(13,36,35,.9),rgba(9,23,21,.9));border:1px solid #3c6357;color:#e6d5a6}
body[data-skin="xianxia"] .panel-section:has([id$="Area"]) .section-title{color:#f0d894!important;font-family:"STKaiti","KaiTi",serif}
body[data-skin="youxi"] .panel-section:has([id$="Area"]){background:#08131a;border:1px solid #1c4b50;color:#a9cfc9}
body[data-skin="youxi"] .panel-section:has([id$="Area"]) .section-title{color:#39e0c8!important;font:11px ui-monospace,monospace;letter-spacing:.08em}
body[data-skin="dushi"] .panel-section:has([id$="Area"]){background:linear-gradient(135deg,#f7f5ee,#ece8dc);border:1px solid #c9c4b4;color:#5b6577}
body[data-skin="dushi"] .panel-section:has([id$="Area"]) .section-title{color:#3f6fd8!important}
body[data-skin="keji"] .panel-section:has([id$="Area"]){background:#03080b;border:1px solid #155263;color:#8fd8f0}
body[data-skin="keji"] .panel-section:has([id$="Area"]) .section-title{color:#48d6ff!important;font:11px ui-monospace,monospace;letter-spacing:.1em}
body[data-skin="kepfu"] .panel-section:has([id$="Area"]){background:linear-gradient(150deg,#100a16,#08060c);border:1px solid #3a2438;color:#b9a4ae}
body[data-skin="kepfu"] .panel-section:has([id$="Area"]) .section-title{color:#b8443c!important;font-family:"STKaiti","KaiTi",serif}
body[data-skin="wuxia"] .panel-section:has([id$="Area"]){background:repeating-linear-gradient(90deg,rgba(120,90,50,.07) 0 1px,transparent 1px 20px),linear-gradient(160deg,#e5d6ac,#d3c08e);border:2px solid #a98a52;color:#4b3a22}
body[data-skin="wuxia"] .panel-section:has([id$="Area"]) .section-title{color:#7a2318!important;font-family:"STKaiti","KaiTi",serif}
body[data-skin="zhengqi"] .panel-section:has([id$="Area"]){background:linear-gradient(160deg,#1d150d,#261b11);border:2px solid #7a5a34;color:#cbb28a}
body[data-skin="zhengqi"] .panel-section:has([id$="Area"]) .section-title{color:#e2bd83!important;font:600 12px ui-monospace,monospace;letter-spacing:.1em}
body[data-skin="kongbu"] .panel-section:has([id$="Area"]){background:linear-gradient(135deg,#ded8c4,#cac2a6);border:1px dashed rgba(120,70,50,.5);color:#5e5040}
body[data-skin="kongbu"] .panel-section:has([id$="Area"]) .section-title{color:#7a3a30!important;font:11px "Courier New",monospace}

/* ===== 氛围标签条 ===== */
.ss-amb{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 13px;padding:6px 10px;position:relative;z-index:2;border-radius:4px;font-size:10px;letter-spacing:.08em}
.ss-amb span{padding:2px 8px;border-radius:3px;white-space:nowrap}
.ss-amb i{font-style:normal;opacity:.45}
.ss-amb-xianxia{background:linear-gradient(90deg,rgba(143,47,36,.2),rgba(232,200,119,.07));border:1px solid rgba(232,200,119,.32)}
.ss-amb-xianxia span{color:#f0d894;border:1px solid rgba(232,200,119,.3);font-family:"STKaiti","KaiTi",serif}
.ss-amb-youxi{background:rgba(57,224,200,.06);border:1px solid rgba(57,224,200,.25)}
.ss-amb-youxi span{color:#8ff0dd;font:10px ui-monospace,monospace;background:rgba(57,224,200,.12)}
.ss-amb-dushi{background:rgba(63,111,216,.06);border:1px dashed #b9c6de}
.ss-amb-dushi span{color:#2f57ad;background:#fff;border:1px solid #c9d6ee}
.ss-amb-keji{background:rgba(72,214,255,.05);border:1px solid #155263}
.ss-amb-keji span{color:#48d6ff;font:10px ui-monospace,monospace;border:1px solid #1c5b6b}
.ss-amb-kepfu{background:rgba(168,50,42,.08);border:1px dashed rgba(168,50,42,.4)}
.ss-amb-kepfu span{color:#c25a4e;font-family:"STKaiti","KaiTi",serif;text-shadow:0 0 8px rgba(168,50,42,.3)}
.ss-amb-wuxia{background:rgba(122,35,24,.06);border-top:1px solid rgba(122,35,24,.3);border-bottom:1px solid rgba(122,35,24,.3)}
.ss-amb-wuxia span{color:#7a2318;font-family:"STKaiti","KaiTi",serif}
.ss-amb-zhengqi{background:rgba(209,160,94,.08);border:1px solid #7a5a34}
.ss-amb-zhengqi span{color:#e2bd83;font:10px ui-monospace,monospace;border:1px solid rgba(192,138,74,.4)}
.ss-amb-kongbu{background:rgba(168,50,42,.05);border:1px dashed rgba(120,70,50,.5)}
.ss-amb-kongbu span{color:#7a3a30;font:10px "Courier New",monospace;background:rgba(255,252,240,.5)}

/* ===== 仪表盘刻度带 + 空状态符号 ===== */
/* gauge-bar 必须定位，否则刻度线 ::after 的 inset:0 会相对 panel-section 铺满整块，出现贯穿竖线 */
body[data-skin] .gauge-bar{position:relative;overflow:hidden}
body[data-skin] .gauge-bar::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,transparent 24%,rgba(128,128,128,.3) 24% 24.5%,transparent 24.5%,transparent 49%,rgba(128,128,128,.3) 49% 49.5%,transparent 49.5%,transparent 74%,rgba(128,128,128,.3) 74% 74.5%,transparent 74.5%)}
body[data-skin] .panel-section:has([id$="Area"]) .empty-hint{position:relative;padding-left:32px;min-height:26px;display:flex;align-items:center}
body[data-skin] .panel-section:has([id$="Area"]) .empty-hint::before{position:absolute;left:2px;top:50%;transform:translateY(-50%);font-size:20px;opacity:.42}
body[data-skin="xianxia"] .empty-hint::before{content:"☯";color:#e8c877}
body[data-skin="youxi"] .empty-hint::before{content:"◈";color:#39e0c8}
body[data-skin="dushi"] .empty-hint::before{content:"▤";color:#3f6fd8}
body[data-skin="keji"] .empty-hint::before{content:"›";color:#48d6ff}
body[data-skin="kepfu"] .empty-hint::before{content:"👁";color:#a8322a}
body[data-skin="wuxia"] .empty-hint::before{content:"❖";color:#8a2b1e}
body[data-skin="zhengqi"] .empty-hint::before{content:"⚙";color:#d1a05e}
body[data-skin="kongbu"] .empty-hint::before{content:"✕";color:#a8322a}

/* ============================================================
   v4.21.0 每界唯一身份：身份铭牌 + 主色驱动
   --wpri 为各界 --primary 注入；同题材骨架靠主色 + 徽记 + 题词区分。
   ============================================================ */
/* --- 身份铭牌（每界徽记字 + 全称 + 题词） --- */
.ss-wbadge{display:flex;align-items:center;gap:10px;position:relative;z-index:2;
  margin:0 0 12px;padding:7px 11px;border-radius:6px;
  background:linear-gradient(90deg,var(--wpri-dim),transparent 72%);
  border-left:3px solid var(--wpri);
  box-shadow:inset 0 0 20px var(--wpri-dim)}
.ss-wbadge-sig{flex:0 0 auto;width:38px;height:38px;display:grid;place-items:center;
  font:700 22px "STKaiti","KaiTi","STSong",serif;line-height:1;
  color:#fff;border-radius:5px;
  background:linear-gradient(145deg,color-mix(in srgb,var(--wpri) 92%,#fff),color-mix(in srgb,var(--wpri) 78%,#000));
  border:1px solid color-mix(in srgb,var(--wpri) 60%,#fff);
  box-shadow:0 0 16px var(--wpri-glow),inset 0 0 0 2px rgba(255,255,255,.14);
  text-shadow:0 1px 3px rgba(0,0,0,.35)}
.ss-wbadge-meta{display:flex;flex-direction:column;gap:2px;min-width:0}
.ss-wbadge-meta b{font-size:13.5px;letter-spacing:.1em;color:var(--wpri);
  text-shadow:0 0 10px var(--wpri-glow);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-wbadge-meta i{font-style:normal;font-size:10.5px;letter-spacing:.08em;opacity:.72;color:inherit;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 浅色骨架里铭牌文字压深，避免 read不清 */
#yjStatusSection[data-status-skin="dushi"] .ss-wbadge-meta b,
#yjStatusSection[data-status-skin="wuxia"] .ss-wbadge-meta b,
#yjStatusSection[data-status-skin="kongbu"] .ss-wbadge-meta b{color:color-mix(in srgb,var(--wpri) 78%,#000);text-shadow:none}

/* --- 主色驱动：各骨架的印章/标题/徽记/进度条随本界主色变 --- */
/* 仙逆：朱砂印 → 本界徽记色；金光标题保持金，但印章/灵光点随主色 */
#yjStatusSection[data-status-skin="xianxia"] .ss1-seal{
  border-color:var(--wpri);color:var(--wpri);
  box-shadow:0 0 0 3px var(--wpri-dim) inset,0 3px 14px rgba(0,0,0,.4),0 0 14px var(--wpri-glow);
  text-shadow:0 0 8px var(--wpri-glow)}
#yjStatusSection[data-status-skin="xianxia"] .ss1-vol{
  background:linear-gradient(145deg,var(--wpri),color-mix(in srgb,var(--wpri) 62%,#000))}
#yjStatusSection[data-status-skin="xianxia"] .ss1-grp.ex{border-color:var(--wpri);box-shadow:0 0 22px var(--wpri-dim) inset}
/* 网游：头像框/技能图标/血条以外的强调 → 主色 */
#yjStatusSection[data-status-skin="youxi"] .ss2-avatar{border-color:var(--wpri);box-shadow:0 0 16px var(--wpri-glow);background:var(--wpri-dim)}
#yjStatusSection[data-status-skin="youxi"] .ss2-ico{color:var(--wpri);border-color:var(--wpri)}
#yjStatusSection[data-status-skin="youxi"] .ss2-gt span{color:var(--wpri);background:var(--wpri-dim)}
/* 都市：证件主色/公章/档案号 → 主色 */
#yjStatusSection[data-status-skin="dushi"] .ss3-hd,
#yjStatusSection[data-status-skin="dushi"] .ss3-meta em{color:color-mix(in srgb,var(--wpri) 76%,#1a2540)}
#yjStatusSection[data-status-skin="dushi"] .ss3-gt{color:color-mix(in srgb,var(--wpri) 74%,#1a2540)}
#yjStatusSection[data-status-skin="dushi"] .ss3-stamp{border-color:color-mix(in srgb,var(--wpri) 80%,#7a2018);color:color-mix(in srgb,var(--wpri) 80%,#7a2018)}
/* 科幻：全息强调色 → 主色（信号绿保留，标题/节点/边框走主色） */
#yjStatusSection[data-status-skin="keji"] .ss4-glitch,
#yjStatusSection[data-status-skin="keji"] .ss4-gt{color:var(--wpri);text-shadow:0 0 8px var(--wpri-glow)}
#yjStatusSection[data-status-skin="keji"] .ss4-glitch::before{color:color-mix(in srgb,var(--wpri) 55%,#ff4fd8)}
#yjStatusSection[data-status-skin="keji"] .ss4-node{background:var(--wpri);box-shadow:0 0 8px var(--wpri)}
#yjStatusSection[data-status-skin="keji"] .ss4-radar{border-color:var(--wpri);box-shadow:0 0 16px var(--wpri-glow)}
#yjStatusSection[data-status-skin="keji"] .ss4-radar b{background:conic-gradient(from 0deg,var(--wpri),transparent 25%)}
/* 克苏鲁：血色基调保留，但封蜡/章节/符文随主色（紫/灰/红各异） */
#yjStatusSection[data-status-skin="kepfu"] .ss5-wax{background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--wpri) 88%,#fff),color-mix(in srgb,var(--wpri) 70%,#1a0606));box-shadow:0 2px 10px rgba(0,0,0,.6),0 0 16px var(--wpri-glow)}
#yjStatusSection[data-status-skin="kepfu"] .ss5-gt{color:var(--wpri);text-shadow:0 0 8px var(--wpri-glow)}
#yjStatusSection[data-status-skin="kepfu"] .ss5-rune{color:var(--wpri)}
/* 武侠：大朱砂印 → 本界徽记色 */
#yjStatusSection[data-status-skin="wuxia"] .ss6-bigseal{background:linear-gradient(145deg,var(--wpri),color-mix(in srgb,var(--wpri) 68%,#000))}
#yjStatusSection[data-status-skin="wuxia"] .ss6-gt{color:color-mix(in srgb,var(--wpri) 72%,#3a1a10)}
/* 蒸汽：齿轮/压力表/铭牌强调 → 主色 */
#yjStatusSection[data-status-skin="zhengqi"] .ss7-gear,
#yjStatusSection[data-status-skin="zhengqi"] .ss7-name b{color:var(--wpri)}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-gauge{background:conic-gradient(from 220deg,var(--wpri) 0 130deg,#3a2a18 130deg 280deg,transparent 280deg)}
/* 恐怖：机密章/证物号 → 主色 */
#yjStatusSection[data-status-skin="kongbu"] .ss8-confid{color:color-mix(in srgb,var(--wpri) 82%,#4a1810);border-color:color-mix(in srgb,var(--wpri) 82%,#4a1810)}
#yjStatusSection[data-status-skin="kongbu"] .ss8-gt{color:color-mix(in srgb,var(--wpri) 74%,#3a2820)}
/* 氛围条：第一枚标签用主色描边，随界变色 */
.ss-amb span:first-child{border-color:var(--wpri)!important;color:var(--wpri)!important;box-shadow:0 0 8px var(--wpri-dim)}
/* 仪表盘填充/标题：跟随本界主色（保留各题材纹理底） */
body[data-skin] .panel-section:has(.gauge-row) .section-title{color:var(--wpri)!important;text-shadow:0 0 8px var(--wpri-glow)}
body[data-skin] .gauge-fill{
  background:linear-gradient(90deg,color-mix(in srgb,var(--wpri) 55%,#000),var(--wpri))!important;
  box-shadow:0 0 9px var(--wpri-glow)!important}

/* ============================================================
   v5.0.0 视觉增强层：字段区「一栏材质卡」+ 头部「纹章级」主符号
   解决「太简单、没特色」——窄条里两列挤字显廉价，改成一栏宽卡 +
   每套题材完全不同的材质语言（玉简/技能槽/档案表格/终端格/邪典手记/
   竹简/铜板仪表/证物标签）。这是结构性差异，不是贴字换色。
   字段读写零变化，不注入任何假数据。
   ============================================================ */

/* ---------- 1 玄幻 · 玉简灵牌 ---------- */
#yjStatusSection[data-status-skin="xianxia"] .ss1-head{padding:10px 8px 11px;margin-bottom:13px;border-radius:7px;
  background:linear-gradient(105deg,rgba(232,200,119,.12),rgba(120,170,150,.03) 70%,transparent);
  border:1px solid rgba(232,200,119,.2);border-left:3px solid var(--wpri);position:relative;overflow:hidden}
#yjStatusSection[data-status-skin="xianxia"] .ss1-head::after{content:"☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷";position:absolute;right:6px;bottom:2px;
  font:8px "STKaiti",serif;color:rgba(232,200,119,.3);letter-spacing:2px}
#yjStatusSection[data-status-skin="xianxia"] .ss1-taiji{width:56px;height:56px;font-size:50px;position:relative;flex:0 0 auto}
#yjStatusSection[data-status-skin="xianxia"] .ss1-taiji::before{content:"";position:absolute;inset:-7px;border:1px dotted rgba(232,200,119,.55);border-radius:50%;animation:ss1spin 26s linear infinite}
#yjStatusSection[data-status-skin="xianxia"] .ss1-rows{grid-template-columns:1fr!important;gap:6px!important}
#yjStatusSection[data-status-skin="xianxia"] .ss1-row{padding:6px 9px;border-radius:4px;border:1px solid rgba(232,200,119,.2);
  border-left:3px solid var(--wpri);background:linear-gradient(100deg,rgba(232,200,119,.1),rgba(120,170,150,.02) 62%,transparent);
  box-shadow:0 1px 6px rgba(0,0,0,.22)}
#yjStatusSection[data-status-skin="xianxia"] .ss1-no{font-size:15px;width:22px;color:var(--wpri)}
#yjStatusSection[data-status-skin="xianxia"] .ss1-lead{display:none}
#yjStatusSection[data-status-skin="xianxia"] .ss1-v{margin-left:auto;padding:1px 7px;border:1px solid rgba(232,200,119,.28);
  border-radius:3px;background:rgba(0,0,0,.3);flex:0 0 auto;max-width:56%}

/* ---------- 2 网游 · 技能槽强化 ---------- */
#yjStatusSection[data-status-skin="youxi"] .ss2-top{padding:9px 10px;margin-bottom:12px;border:1px solid rgba(57,224,200,.25);
  clip-path:polygon(0 0,100% 0,100% 70%,94% 100%,0 100%);background:rgba(57,224,200,.05)}
#yjStatusSection[data-status-skin="youxi"] .ss2-avatar{width:50px;height:50px;font-size:28px;animation:none;position:relative}
#yjStatusSection[data-status-skin="youxi"] .ss2-avatar::after{content:"";position:absolute;inset:-5px;border:1px dashed rgba(57,224,200,.45);border-radius:10px;animation:ss1spin 18s linear infinite}
#yjStatusSection[data-status-skin="youxi"] .ss2-slot{padding:8px 9px;min-height:40px}
#yjStatusSection[data-status-skin="youxi"] .ss2-ico{width:26px;height:26px;font-size:14px}
#yjStatusSection[data-status-skin="youxi"] .ss2-val{padding:2px 6px;background:rgba(57,224,200,.08);border:1px solid rgba(57,224,200,.2);border-radius:3px;font-size:11px}

/* ---------- 3 都市 · 档案表格 ---------- */
#yjStatusSection[data-status-skin="dushi"] .ss3-card{box-shadow:0 3px 12px rgba(40,60,100,.14);border:1px solid #9fb0cc}
#yjStatusSection[data-status-skin="dushi"] .ss3-rows{grid-template-columns:1fr!important;gap:0!important;border:1px solid #c2cbe0;border-radius:4px;overflow:hidden}
#yjStatusSection[data-status-skin="dushi"] .ss3-row{margin:0;padding:6px 9px;border-bottom:1px solid #dbe1ee;background:#fff}
#yjStatusSection[data-status-skin="dushi"] .ss3-row:nth-child(odd){background:#f4f7fc}
#yjStatusSection[data-status-skin="dushi"] .ss3-row:last-child{border-bottom:none}
#yjStatusSection[data-status-skin="dushi"] .ss3-k{min-width:74px;font-weight:600}
#yjStatusSection[data-status-skin="dushi"] .ss3-lead{display:none}
#yjStatusSection[data-status-skin="dushi"] .ss3-v{margin-left:auto;padding:1px 7px;background:#eef2fa;border:1px solid #d3dcee;border-radius:2px;flex:0 0 auto;max-width:55%;font-family:ui-monospace,monospace}

/* ---------- 4 科幻 · 终端数据格 ---------- */
#yjStatusSection[data-status-skin="keji"] .ss4-top{padding:9px 10px;margin-bottom:12px;border:1px solid rgba(72,214,255,.28);
  background:linear-gradient(90deg,rgba(72,214,255,.09),transparent);clip-path:polygon(0 0,100% 0,100% 75%,96% 100%,0 100%)}
#yjStatusSection[data-status-skin="keji"] .ss4-radar{width:52px;height:52px}
#yjStatusSection[data-status-skin="keji"] .ss4-rows{grid-template-columns:1fr!important;gap:4px!important}
#yjStatusSection[data-status-skin="keji"] .ss4-row{padding:5px 8px;background:linear-gradient(90deg,rgba(72,214,255,.07),transparent);
  border-left:2px solid rgba(72,214,255,.45)}
#yjStatusSection[data-status-skin="keji"] .ss4-k{min-width:76px}
#yjStatusSection[data-status-skin="keji"] .ss4-v{background:rgba(72,214,255,.06);border-top:1px solid rgba(72,214,255,.18);border-bottom:1px solid rgba(72,214,255,.18)}

/* ---------- 5 克苏鲁 · 邪典手记 ---------- */
#yjStatusSection[data-status-skin="kepfu"] .ss5-head{padding:10px 9px;margin-bottom:13px;position:relative;
  background:radial-gradient(ellipse at 20% 50%,rgba(168,50,42,.14),transparent 70%);
  border:1px solid rgba(168,50,42,.3);clip-path:polygon(0 0,98% 0,100% 12%,100% 100%,2% 100%,0 88%)}
#yjStatusSection[data-status-skin="kepfu"] .ss5-eye{width:54px;height:54px;font-size:38px}
#yjStatusSection[data-status-skin="kepfu"] .ss5-rows{grid-template-columns:1fr!important;gap:5px!important}
#yjStatusSection[data-status-skin="kepfu"] .ss5-row{padding:6px 8px;background:linear-gradient(100deg,rgba(30,18,26,.75),rgba(12,8,14,.4));
  border-left:2px solid rgba(168,50,42,.5);border-bottom:1px dashed rgba(168,50,42,.25);position:relative}
#yjStatusSection[data-status-skin="kepfu"] .ss5-row:nth-child(3n)::after{content:"";position:absolute;right:6px;top:-2px;width:9px;height:12px;
  background:radial-gradient(ellipse,rgba(140,25,20,.55),transparent 70%);border-radius:50%;pointer-events:none}
#yjStatusSection[data-status-skin="kepfu"] .ss5-lead{display:none}
#yjStatusSection[data-status-skin="kepfu"] .ss5-v{margin-left:auto;padding:1px 6px;background:rgba(168,50,42,.09);border:1px solid rgba(168,50,42,.25);flex:0 0 auto;max-width:56%}

/* ---------- 6 武侠 · 竹简片 ---------- */
#yjStatusSection[data-status-skin="wuxia"] .ss6-head{padding:10px 8px;background:linear-gradient(180deg,rgba(255,250,230,.3),transparent);
  border-bottom:2px solid rgba(120,80,40,.35)}
#yjStatusSection[data-status-skin="wuxia"] .ss6-bigseal{width:56px;height:56px;font-size:34px;position:relative}
#yjStatusSection[data-status-skin="wuxia"] .ss6-bigseal::after{content:"";position:absolute;inset:-5px;border:1px solid rgba(163,45,31,.4);transform:rotate(6deg)}
#yjStatusSection[data-status-skin="wuxia"] .ss6-rows{grid-template-columns:1fr!important;gap:4px!important}
#yjStatusSection[data-status-skin="wuxia"] .ss6-row{padding:6px 9px;background:linear-gradient(90deg,rgba(160,125,70,.14),rgba(160,125,70,.03));
  border-left:3px double rgba(122,35,24,.5);border-right:1px solid rgba(120,90,50,.25)}
#yjStatusSection[data-status-skin="wuxia"] .ss6-sep{display:none}
#yjStatusSection[data-status-skin="wuxia"] .ss6-v{margin-left:auto;padding:1px 8px;background:rgba(163,45,31,.1);border-radius:2px;flex:0 0 auto;max-width:56%;color:#7a2318}

/* ---------- 7 蒸汽 · 铜板仪表 ---------- */
#yjStatusSection[data-status-skin="zhengqi"] .ss7-plate{border:3px double #7a5a34;box-shadow:0 0 0 4px rgba(122,90,52,.2) inset,0 3px 10px rgba(0,0,0,.4)}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-gear{font-size:38px;text-shadow:0 0 12px var(--wpri-glow)}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-rows{grid-template-columns:1fr!important;gap:5px!important}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-row{padding:6px 9px;border:1px solid rgba(192,138,74,.32);border-radius:3px;
  background:linear-gradient(180deg,rgba(190,140,70,.12),rgba(0,0,0,.2));position:relative}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-row::before{content:"";position:absolute;left:3px;top:50%;transform:translateY(-50%);
  width:5px;height:5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#b89060,#5a4024)}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-k{margin-left:9px}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-dial{display:none}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-v{margin-left:auto;padding:1px 8px;background:rgba(0,0,0,.35);border:1px solid #7a5a34;
  border-radius:2px;font-family:ui-monospace,monospace;flex:0 0 auto;max-width:54%;color:var(--wpri)}

/* ---------- 8 恐怖 · 证物标签 ---------- */
#yjStatusSection[data-status-skin="kongbu"] .ss8-head{padding:9px 10px;background:rgba(255,252,240,.4);border:1px solid rgba(120,70,50,.3)}
#yjStatusSection[data-status-skin="kongbu"] .ss8-rows{grid-template-columns:1fr!important;gap:5px!important}
#yjStatusSection[data-status-skin="kongbu"] .ss8-row{padding:6px 9px;background:linear-gradient(90deg,rgba(255,250,225,.7),rgba(240,232,205,.5));
  border:1px solid rgba(120,70,50,.3);border-left:4px solid rgba(168,50,42,.55);position:relative;
  box-shadow:1px 2px 4px rgba(60,40,20,.12)}
#yjStatusSection[data-status-skin="kongbu"] .ss8-row:nth-child(even){transform:rotate(-.35deg)}
#yjStatusSection[data-status-skin="kongbu"] .ss8-row:nth-child(odd){transform:rotate(.3deg)}
#yjStatusSection[data-status-skin="kongbu"] .ss8-lead{display:none}
#yjStatusSection[data-status-skin="kongbu"] .ss8-v{margin-left:auto;padding:1px 7px;background:rgba(168,50,42,.08);
  border:1px dashed rgba(168,50,42,.4);flex:0 0 auto;max-width:56%;letter-spacing:.05em}

/* ============ v6 多值栏目子项样式（一份通吃8套骨架）============
   覆盖各皮肤值区域的 nowrap/ellipsis，让多个子项逐行完整显示。 */
/* 含多值栏目的整行改为纵向：label 独占一行，多值块占满整行宽度 */
#yjStatusSection .ss1-row:has(.yj-multi),
#yjStatusSection .ss2-slot:has(.yj-multi),
#yjStatusSection .ss3-row:has(.yj-multi),
#yjStatusSection .ss4-row:has(.yj-multi),
#yjStatusSection .ss5-row:has(.yj-multi),
#yjStatusSection .ss6-row:has(.yj-multi),
#yjStatusSection .ss7-row:has(.yj-multi),
#yjStatusSection .ss8-row:has(.yj-multi),
#yjStatusSection .yj-st-row.multi{
  flex-direction:column!important;align-items:stretch!important;gap:3px}
#yjStatusSection .yj-multi{
  display:flex!important;flex-direction:column;align-items:stretch;gap:4px;
  max-width:100%!important;width:100%!important;min-width:0;white-space:normal!important;
  overflow:visible!important;text-overflow:clip!important;text-align:left!important;
  cursor:pointer;padding:6px 8px;border-radius:6px;
  background:rgba(120,150,190,.08);border:1px solid rgba(150,180,220,.2)}
#yjStatusSection .yj-multi:hover{filter:brightness(1.25)}
#yjStatusSection .yj-mi{
  display:flex;align-items:baseline;gap:6px;font-size:11px;line-height:1.45;
  color:inherit;opacity:.94;word-break:break-all}
#yjStatusSection .yj-mi b{
  flex:0 0 auto;min-width:15px;height:15px;padding:0 3px;border-radius:4px;
  display:inline-grid;place-items:center;font:600 10px/1 ui-monospace,monospace;
  color:#0e1420;background:var(--wpri,#e8c877);opacity:.92}
#yjStatusSection .yj-mi-more{font-size:10px;opacity:.6;text-align:center;padding-top:2px}
#yjStatusSection .yj-multi-empty{
  white-space:nowrap!important;opacity:.6;font-size:11px}
/* 都市浅色骨架：多值块用浅底深字 */
#yjStatusSection[data-status-skin="dushi"] .ss3-v.yj-multi{background:#eef2fa;border-color:#c2cbe0}
#yjStatusSection[data-status-skin="dushi"] .yj-mi b{color:#fff;background:#3f6fd8}
/* 武侠竹简：多值块用竹黄底 */
#yjStatusSection[data-status-skin="wuxia"] .ss6-v.yj-multi{background:rgba(160,125,70,.14);border-color:rgba(122,35,24,.35)}
/* 克苏鲁/恐怖：多值块暗色半透明 */
#yjStatusSection[data-status-skin="kepfu"] .ss5-v.yj-multi,
#yjStatusSection[data-status-skin="kongbu"] .ss8-v.yj-multi{background:rgba(0,0,0,.28)}

/* ---------- 头部标题防换行（放大图标后空间收紧） ---------- */
#yjStatusSection[data-status-skin="xianxia"] .ss1-title{min-width:0;flex:1}
#yjStatusSection[data-status-skin="xianxia"] .ss1-title b{white-space:nowrap;font-size:18px;letter-spacing:.2em}
#yjStatusSection[data-status-skin="xianxia"] .ss1-title small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#yjStatusSection[data-status-skin="xianxia"] .ss1-seal{width:40px;height:40px;font-size:23px;flex:0 0 auto}
#yjStatusSection[data-status-skin="kepfu"] .ss5-t{min-width:0;flex:1}
#yjStatusSection[data-status-skin="kepfu"] .ss5-t b{white-space:nowrap;font-size:17px;letter-spacing:.2em}
#yjStatusSection[data-status-skin="kepfu"] .ss5-t small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-name{min-width:0}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-name b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
#yjStatusSection[data-status-skin="zhengqi"] .ss7-name small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#yjStatusSection[data-status-skin="youxi"] .ss2-id{min-width:0}
#yjStatusSection[data-status-skin="youxi"] .ss2-id b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

@media(max-width:560px){
  #yjStatusSection[data-status-skin] .ss1-rows,#yjStatusSection[data-status-skin] .ss3-rows,#yjStatusSection[data-status-skin] .ss4-rows,#yjStatusSection[data-status-skin] .ss5-rows,#yjStatusSection[data-status-skin] .ss6-rows,#yjStatusSection[data-status-skin] .ss7-rows,#yjStatusSection[data-status-skin] .ss8-rows{grid-template-columns:1fr}
  #yjStatusSection[data-status-skin] .ss2-slots{grid-template-columns:1fr}
}`;

  function injectCSS() {
    var el = document.getElementById('ss-skins-css');
    if (el) { el.textContent = CSS; return; } // 热更新
    var s = document.createElement('style');
    s.id = 'ss-skins-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  injectCSS();

  window.StatusSkins = {
    skinOf: skinOf, render: render, CSS: CSS,
    worldOf: function (k) { return WORLD_ID[k] || WORLD_ID.free; },
    worlds: WORLD_ID,
    skins: ['xianxia', 'youxi', 'dushi', 'keji', 'kepfu', 'wuxia', 'zhengqi', 'kongbu']
  };
})();
