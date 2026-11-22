/* 云境 · 原创设计工坊 CreatorForge v1.0.0（v3.53.0）
   ---------------------------------------------------------------------------
   用户诉求：「如果我有原创设计，想要添加自设势力或者人物、道具技能等等的，
             也得支持对应的世界书条目创建」
   解决：把"脑子里有设定但写不成条目"这件事变成填表。

   设计要点
   1) 八类结构化模板：势力 / 人物 / 道具 / 技能 / 地点 / 血脉·种族 / 事件 / 关系·伏笔，
      外加「自定义」自由字段行——任何一类东西都能落进世界书。
   2) 表单 → 条目正文：按模板拼成 AI 好读的 Markdown（标题 + 分节 + 要点），
      不做花哨排版，保证注入上下文后模型能准确取用。
   3) 关联自动入标签：所属势力、核心成员、敌对、掌握者等关联字段会同时写进 tags
      ——世界书的关键词触发靠 tags 兜底，填了关联就能被提及时自动召回。
   4) 注入方式默认给建议（势力/世界观默认常驻，道具/事件默认检索），可现场改。
   5) AI 补稿：填了骨架点「让 AI 补完」，用当前接口把字段扩写成完整条目正文（可反复）。
   6) 原创包导入导出：只导自己设计的条目（source=forge），换设备/换世界可搬家。
   7) 双存域：可存「本界」或「🌐 全局」（全局条目 33 界通用）。
*/
(function () {
  'use strict';

  var KEY_TPL = 'yunjingForgeTemplates';   // 用户自存模板
  var SRC = 'forge';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lines(v) {
    return String(v || '').split(/[\n,，、;；]/).map(function (x) { return String(x).trim(); })
      .filter(function (x) { return x && x.length <= 40; }).slice(0, 40);
  }
  function val(v) { return String(v == null ? '' : v).trim(); }

  /* ==================== 模板定义 ==================== */
  /* field: {k, label, ph, type: text|textarea|tags|select|num, opts?, req?, half?} */
  var TYPES = {
    faction: {
      name: '势力', icon: '🏛', cat: '势力', prio: 'high',
      tip: '有地盘、有立场、有旗号的一方力量（宗门 / 家族 / 帝国 / 财团 / 隐秘结社）',
      keys: ['alias', 'tier', 'align', 'territory', 'leader', 'members', 'power', 'resource', 'rule', 'foe', 'secret', 'motto'],
      fields: [
        { k: 'name', label: '势力名', type: 'text', req: true, ph: '例：北溟剑宗' },
        { k: 'alias', label: '别称 / 代号', type: 'text', ph: '例：北溟、雪中十三楼（外界叫法）' },
        { k: 'tier', label: '规模层级', type: 'select', opts: ['独行者/小队', '地方门派', '一流宗门', '顶级势力', '隐秘结社', '国家机器', '跨世界组织'] },
        { k: 'align', label: '立场倾向', type: 'select', opts: ['正道', '中立', '邪道', '灰色', '立场不明', '随利益摇摆'] },
        { k: 'territory', label: '地盘 / 据点', type: 'text', ph: '例：北溟三岛、山门「沉雪台」' },
        { k: 'leader', label: '首脑', type: 'text', ph: '例：宗主 沈负雪' },
        { k: 'members', label: '核心成员', type: 'tags', ph: '每行或逗号一个：大师兄 裴照 / 长老 枯木' },
        { k: 'power', label: '招牌手段', type: 'textarea', ph: '镇派功法、独门兵器、看家阵法…' },
        { k: 'resource', label: '资源与产业', type: 'textarea', ph: '灵矿、商路、情报网、钱庄…' },
        { k: 'rule', label: '内部规矩 / 禁忌', type: 'textarea', ph: '入门试炼、不可背叛、违者如何…' },
        { k: 'foe', label: '敌对 / 盟友', type: 'tags', ph: '敌：血河教；友：江南沈家' },
        { k: 'secret', label: '隐秘与软肋', type: 'textarea', ph: '外人不知道的事、一击即溃之处' },
        { k: 'motto', label: '信条 / 口号', type: 'text', ph: '例：剑出无悔，雪落无声' }
      ]
    },
    character: {
      name: '人物', icon: '👤', cat: '人物', prio: 'high',
      tip: '角色卡：长得怎样、想要什么、怕什么、说话什么味儿',
      keys: ['alias', 'faction', 'role', 'age', 'appearance', 'personality', 'motive', 'fear', 'ability', 'item', 'relation', 'secret', 'arc', 'tone'],
      fields: [
        { k: 'name', label: '姓名', type: 'text', req: true, ph: '例：裴照' },
        { k: 'alias', label: '称号 / 化名', type: 'text', ph: '例：雪中一刀、裴七' },
        { k: 'faction', label: '所属势力', type: 'text', ph: '例：北溟剑宗' },
        { k: 'role', label: '身份 / 职位', type: 'text', ph: '例：大师兄 / 刑名捕头 / 御前侍卫' },
        { k: 'age', label: '年龄 / 外表年龄', type: 'text', ph: '例：二十七（看着像三十五）' },
        { k: 'appearance', label: '外貌特征', type: 'textarea', ph: '身量、疤、手、眼神、身上常带的气味' },
        { k: 'personality', label: '性格内核', type: 'textarea', ph: '两三个能互相对冲的词，别写成好人坏人' },
        { k: 'motive', label: '欲望 / 目标', type: 'textarea', ph: '他此刻最想要的那件事' },
        { k: 'fear', label: '恐惧 / 底线', type: 'textarea', ph: '他绝不松口的东西' },
        { k: 'ability', label: '能力 / 技能', type: 'textarea', ph: '会什么、到什么程度、有什么代价' },
        { k: 'item', label: '随身之物', type: 'tags', ph: '例：断刀「霜降」、半块玉佩' },
        { k: 'relation', label: '关系网', type: 'tags', ph: '师：沈负雪；妹：裴晚；仇：血河教左使' },
        { k: 'secret', label: '秘密', type: 'textarea', ph: '不能让别人知道的事' },
        { k: 'arc', label: '成长弧线', type: 'textarea', ph: '从哪来、要变成什么样' },
        { k: 'tone', label: '说话方式', type: 'text', ph: '例：话少，急了才骂人，从不解释' }
      ]
    },
    item: {
      name: '道具', icon: '🎁', cat: '道具', prio: '',
      tip: '拿在手上的东西：来历、能做什么、要付什么代价',
      keys: ['tier', 'kind', 'origin', 'effect', 'cost', 'owner', 'place', 'secret'],
      fields: [
        { k: 'name', label: '名称', type: 'text', req: true, ph: '例：霜降（断刀）' },
        { k: 'tier', label: '品阶', type: 'select', opts: ['凡品', '常见', '良品', '珍品', '绝品', '神物'] },
        { k: 'kind', label: '类型', type: 'select', opts: ['兵器', '防具', '丹药', '符咒', '典籍', '信物', '钥匙', '消耗品', '载具', '材料', '其它'] },
        { k: 'origin', label: '来历', type: 'textarea', ph: '谁铸的、怎么流传到今天' },
        { k: 'effect', label: '效果 / 用途', type: 'textarea', ph: '具体能做什么，触发条件是什么' },
        { k: 'cost', label: '代价 / 限制', type: 'textarea', ph: '每次使用的损耗、反噬、次数上限' },
        { k: 'owner', label: '持有者', type: 'text', ph: '当前在谁手上' },
        { k: 'place', label: '所在 / 封存处', type: 'text', ph: '例：沉雪台剑冢第三层' },
        { k: 'secret', label: '隐藏属性', type: 'textarea', ph: '未觉醒的第二形态、封印的东西' }
      ]
    },
    skill: {
      name: '技能 / 功法', icon: '✦', cat: '技能', prio: '',
      tip: '长在人身上的本事：招式、法术、天赋、被动',
      keys: ['level', 'kind', 'owner', 'cost', 'effect', 'require', 'drawback', 'origin'],
      fields: [
        { k: 'name', label: '名称', type: 'text', req: true, ph: '例：覆雪十三式' },
        { k: 'level', label: '品级 / 层级', type: 'text', ph: '例：地阶中品 / 第三层' },
        { k: 'kind', label: '类型', type: 'select', opts: ['攻击', '防御', '身法', '辅助', '感知', '炼制', '领域', '被动天赋', '禁咒'] },
        { k: 'owner', label: '掌握者', type: 'tags', ph: '谁会、谁创的' },
        { k: 'cost', label: '消耗', type: 'text', ph: '例：三成真元，每日一次' },
        { k: 'effect', label: '效果', type: 'textarea', ph: '具体表现、命中判定、威力边界' },
        { k: 'require', label: '前置条件', type: 'text', ph: '例：需先修《北溟心法》第五层' },
        { k: 'drawback', label: '反噬 / 破绽', type: 'textarea', ph: '用多了会怎样，怎么被破' },
        { k: 'origin', label: '传承', type: 'text', ph: '例：北溟剑宗不传之秘' }
      ]
    },
    place: {
      name: '地点', icon: '🗺', cat: '地点', prio: 'medium',
      tip: '故事发生的那块地方：什么味儿、谁说了算、藏着什么',
      keys: ['kind', 'region', 'faction', 'feature', 'danger', 'resource', 'secret'],
      fields: [
        { k: 'name', label: '名称', type: 'text', req: true, ph: '例：沉雪台' },
        { k: 'kind', label: '类型', type: 'select', opts: ['城池', '村落', '山门', '荒野', '秘境', '建筑', '街区', '交通线', '异空间'] },
        { k: 'region', label: '所属地域', type: 'text', ph: '例：北溟三岛·中岛' },
        { k: 'faction', label: '控制势力', type: 'text', ph: '例：北溟剑宗' },
        { k: 'feature', label: '地貌与氛围', type: 'textarea', ph: '一眼望去是什么、什么声音、什么气味' },
        { k: 'danger', label: '危险', type: 'textarea', ph: '这里会要人命的东西' },
        { k: 'resource', label: '产出 / 资源', type: 'text', ph: '例：寒铁、雪莲' },
        { k: 'secret', label: '隐藏之处', type: 'textarea', ph: '密室、地道、被封的东西' }
      ]
    },
    bloodline: {
      name: '血脉 / 种族', icon: '🧬', cat: '血脉', prio: '',
      tip: '天生的东西：传承方式、天赋、诅咒、弱点',
      keys: ['kind', 'origin', 'inherit', 'rank', 'trait', 'weakness', 'famous'],
      fields: [
        { k: 'name', label: '名称', type: 'text', req: true, ph: '例：霜寒之血' },
        { k: 'kind', label: '类型', type: 'select', opts: ['血脉', '种族', '体质', '天赋', '诅咒'] },
        { k: 'origin', label: '起源', type: 'textarea', ph: '怎么来的，第一位是谁' },
        { k: 'inherit', label: '传承方式', type: 'text', ph: '例：母系单传，隔代觉醒' },
        { k: 'rank', label: '阶位划分', type: 'text', ph: '例：初醒 / 凝霜 / 覆雪 / 绝境' },
        { k: 'trait', label: '天赋表现', type: 'textarea', ph: '觉醒后能做什么' },
        { k: 'weakness', label: '代价 / 弱点', type: 'textarea', ph: '反噬、克星、寿命损耗' },
        { k: 'famous', label: '知名持有者', type: 'tags', ph: '例：沈负雪、裴照' }
      ]
    },
    event: {
      name: '事件', icon: '📜', cat: '事件', prio: '',
      tip: '已经发生或将要发生的事：谁干的、影响了什么',
      keys: ['time', 'place', 'actors', 'cause', 'process', 'result', 'impact'],
      fields: [
        { k: 'name', label: '事件名', type: 'text', req: true, ph: '例：雪夜围杀' },
        { k: 'time', label: '时间', type: 'text', ph: '例：开篇前十九年 / 第三卷冬' },
        { k: 'place', label: '地点', type: 'text', ph: '例：沉雪台' },
        { k: 'actors', label: '参与者', type: 'tags', ph: '谁在场、谁动的手' },
        { k: 'cause', label: '起因', type: 'textarea', ph: '为什么会发生' },
        { k: 'process', label: '经过', type: 'textarea', ph: '关键转折与顺序' },
        { k: 'result', label: '结果', type: 'textarea', ph: '谁活下来、谁背了锅' },
        { k: 'impact', label: '后续影响', type: 'textarea', ph: '至今还在生效的后果' }
      ]
    },
    thread: {
      name: '关系 / 伏笔', icon: '🪢', cat: '关系', prio: '',
      tip: '两人之间的线，或埋下去等着响的那把枪',
      keys: ['kind', 'from', 'to', 'nature', 'evolution', 'payoff', 'deadline'],
      fields: [
        { k: 'name', label: '名称', type: 'text', req: true, ph: '例：裴照 × 沈负雪 / 玉佩的第二块' },
        { k: 'kind', label: '类型', type: 'select', opts: ['人物关系', '伏笔', '债务', '约定', '仇恨', '误解'] },
        { k: 'from', label: '甲方', type: 'text', ph: '例：裴照' },
        { k: 'to', label: '乙方', type: 'text', ph: '例：沈负雪' },
        { k: 'nature', label: '性质', type: 'textarea', ph: '师徒？救命恩？杀父仇？说不清的那种' },
        { k: 'evolution', label: '变化轨迹', type: 'textarea', ph: '从什么变成什么' },
        { k: 'payoff', label: '回收方式', type: 'textarea', ph: '打算在哪儿、怎么响' },
        { k: 'deadline', label: '回收期限', type: 'text', ph: '例：最迟第五卷，过时不候' }
      ]
    },
    custom: {
      name: '自定义', icon: '🧩', cat: '通用', prio: '',
      tip: '上面都不合适时，自己加字段行——键 / 值对，照样落进世界书',
      keys: [],
      fields: [
        { k: 'name', label: '条目标题', type: 'text', req: true, ph: '例：本界的货币与物价' },
        { k: 'summary', label: '概要', type: 'textarea', ph: '先写两句，剩下的用下面自定义字段补' }
      ]
    }
  };

  var ORDER = ['faction', 'character', 'item', 'skill', 'place', 'bloodline', 'event', 'thread', 'custom'];

  /* ==================== 状态 ==================== */
  var S = { type: 'faction', editingId: null, extra: [] };

  /* ==================== 正文生成 ==================== */
  function buildContent(type, v) {
    var t = TYPES[type];
    var out = [];
    function sec(label, body) {
      var b = val(body);
      if (b) out.push('**' + label + '**：' + b.replace(/\n/g, '\n> '));
    }
    function secLines(label, body) {
      var ls = lines(body);
      if (ls.length) out.push('**' + label + '**：' + ls.join('、'));
    }
    out.push('## ' + (val(v.name) || '未命名'));
    t.fields.forEach(function (f) {
      if (f.k === 'name') return;
      var raw = val(v[f.k]);
      if (!raw) return;
      if (f.type === 'tags') secLines(f.label, raw);
      else sec(f.label, raw);
    });
    (S.extra || []).forEach(function (ex) {
      if (val(ex.k) && val(ex.v)) sec(val(ex.k), ex.v);
    });
    return out.join('\n\n');
  }

  function buildTags(type, v) {
    var tags = [];
    var push = function (x) { x = val(x); if (x && tags.indexOf(x) === -1) tags.push(x); };
    push(val(v.name));
    push(TYPES[type].cat);
    // 关联字段入标签：提及时能被关键词触发召回
    ['alias', 'faction', 'leader', 'territory', 'region', 'owner', 'place', 'from', 'to', 'actors', 'members', 'foe', 'relation', 'famous'].forEach(function (k) {
      lines(v[k]).forEach(push);
    });
    (S.extra || []).forEach(function (ex) {
      if (val(ex.k) && val(ex.v) && /势力|成员|敌|友|持有|掌握|所在/.test(ex.k)) push(ex.v.split(/[\n,，、]/)[0]);
    });
    return tags.slice(0, 30);
  }

  /* ==================== 用户模板 ==================== */
  function loadTpls() {
    try { return JSON.parse(localStorage.getItem(KEY_TPL) || '[]'); } catch (e) { return []; }
  }
  function saveTpls(list) {
    try { localStorage.setItem(KEY_TPL, JSON.stringify(list.slice(-30))); } catch (e) {}
  }

  /* ==================== 导入导出 ==================== */
  function exportPack() {
    var KB = window.StoryKnowledge;
    if (!KB) return;
    var list = (KB.knowledgeBase || []).filter(function (i) { return i.source === SRC; });
    if (!list.length) {
      alert('还没有原创条目可导出。先用上面的模板建一个吧。');
      return;
    }
    var pkg = {
      app: '云境', kind: 'forge-pack', version: 1,
      genre: KB.genre, exportedAt: new Date().toISOString(), entries: list
    };
    var blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '云境-原创设定-' + KB.genre + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function importPack(file) {
    var KB = window.StoryKnowledge;
    if (!KB || !file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var pkg;
      try { pkg = JSON.parse(String(fr.result)); } catch (e) { alert('不是合法的 JSON 文件'); return; }
      var list = Array.isArray(pkg) ? pkg : (pkg.entries || pkg.knowledge || []);
      if (!list.length) { alert('文件里没有条目'); return; }
      var n = 0;
      list.forEach(function (e) {
        if (!e || !e.title) return;
        KB.addItem({
          title: e.title, content: e.content || '', category: e.category || '通用',
          tags: e.tags || [], keys: e.keys || [], alwaysInclude: e.alwaysInclude === true,
          priority: e.priority || '', source: SRC, isGlobal: e.isGlobal === true
        });
        n++;
      });
      alert('已导入 ' + n + ' 条原创设定。');
      CreatorForge.close();
      if (KB.open) KB.open();
    };
    fr.readAsText(file);
  }

  /* ==================== 弹窗 ==================== */
  function ensure() {
    var m = document.getElementById('forgeModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'forgeModal';
      m.className = 'modal-overlay';
      m.addEventListener('click', function (e) { if (e.target === m) CreatorForge.close(); });
      document.body.appendChild(m);
    }
    return m;
  }

  function typeStripHTML() {
    return ORDER.map(function (k) {
      var t = TYPES[k];
      return '<button class="fg-type' + (S.type === k ? ' on' : '') + '" onclick="CreatorForge.pick(\'' + k + '\')" title="' + esc(t.tip) + '">' +
        '<span class="fg-ticon">' + t.icon + '</span><span>' + t.name + '</span></button>';
    }).join('');
  }

  function fieldHTML(f, v) {
    var cur = val(v[f.k]);
    var lab = '<label>' + esc(f.label) + (f.req ? ' <i class="fg-req">*</i>' : '') + '</label>';
    var body;
    if (f.type === 'textarea') {
      body = '<textarea class="fg-in" data-k="' + f.k + '" rows="3" placeholder="' + esc(f.ph || '') + '">' + esc(cur) + '</textarea>';
    } else if (f.type === 'select') {
      body = '<select class="fg-in" data-k="' + f.k + '">' +
        '<option value="">（未填）</option>' +
        f.opts.map(function (o) { return '<option' + (cur === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
        '</select>';
    } else if (f.type === 'tags') {
      body = '<textarea class="fg-in" data-k="' + f.k + '" rows="2" placeholder="' + esc(f.ph || '') + '">' + esc(cur) + '</textarea>' +
        '<div class="fg-hint">一行一个（或逗号分隔），会自动变成召回关键词</div>';
    } else {
      body = '<input class="fg-in" type="text" data-k="' + f.k + '" placeholder="' + esc(f.ph || '') + '" value="' + esc(cur) + '">';
    }
    return '<div class="fg-row' + (f.type === 'textarea' ? ' wide' : '') + '">' + lab + body + '</div>';
  }

  function bodyHTML() {
    var t = TYPES[S.type];
    var v = readForm();
    return `
        <div class="modal-box forge-box">
            <div class="modal-header">
                <span>🧬 原创设计工坊 · ${esc(t.name)}</span>
                <button class="modal-close" onclick="CreatorForge.close()">✕</button>
            </div>
            <div class="modal-body fg-body">
                <div class="fg-strip">${typeStripHTML()}</div>
                <div class="fg-tip">${esc(t.tip)}</div>
                <div class="fg-grid" id="fgGrid">
                    ${t.fields.map(function (f) { return fieldHTML(f, v); }).join('')}
                    <div class="fg-row wide fg-extra-wrap">
                        <label>自定义字段（可选）</label>
                        <div id="fgExtra">
                            ${(S.extra || []).map(function (ex, i) {
                              return '<div class="fg-extra"><input class="fg-in short" placeholder="字段名" value="' + esc(ex.k) + '" data-ex="k" data-i="' + i + '"><input class="fg-in" placeholder="内容" value="' + esc(ex.v) + '" data-ex="v" data-i="' + i + '"><button class="fg-del" onclick="CreatorForge.delExtra(' + i + ')">✕</button></div>';
                            }).join('')}
                        </div>
                        <button class="btn-ghost btn-mini" onclick="CreatorForge.addExtra()">＋ 加一行字段</button>
                    </div>
                </div>
                <div class="fg-foot">
                    <div class="fg-row">
                        <label>存到哪里</label>
                        <select class="fg-in" id="fgScope">
                            <option value="local"${S.scope !== 'global' ? ' selected' : ''}>本界（${esc((window.StoryKnowledge && window.StoryKnowledge.genre) || '')}）</option>
                            <option value="global"${S.scope === 'global' ? ' selected' : ''}>🌐 全局（33 界通用）</option>
                        </select>
                    </div>
                    <div class="fg-row">
                        <label>注入方式</label>
                        <select class="fg-in" id="fgPrio">
                            <option value=""${(S.prio || t.prio) === '' ? ' selected' : ''}>🔎 按需检索（提及时才注入）</option>
                            <option value="key"${S.prio === 'key' ? ' selected' : ''}>🗝 关键词触发</option>
                            <option value="top"${(S.prio || t.prio) === 'top' ? ' selected' : ''}>👑 核心常驻（每轮最高优先）</option>
                            <option value="high"${(S.prio || t.prio) === 'high' ? ' selected' : ''}>⭐ 重点常驻</option>
                            <option value="medium"${(S.prio || t.prio) === 'medium' ? ' selected' : ''}>📌 次重点常驻</option>
                            <option value="low"${(S.prio || t.prio) === 'low' ? ' selected' : ''}>📋 一般常驻</option>
                        </select>
                    </div>
                </div>
                <div class="fg-preview-wrap">
                    <div class="fg-prev-head">
                        <span>条目正文预览（可直接手改）</span>
                        <button class="btn-ghost btn-mini" id="fgAiBtn" onclick="CreatorForge.aiDraft()">✨ 让 AI 补完</button>
                    </div>
                    <textarea class="fg-in fg-preview" id="fgPreview" rows="9" placeholder="填完上面的字段，点「生成正文」即可预览；也可以直接在这里手写。"></textarea>
                </div>
            </div>
            <div class="modal-footer fg-actions">
                <button class="btn-ghost btn-mini" onclick="CreatorForge.gen()">🔄 生成正文</button>
                <button class="btn-ghost btn-mini" onclick="CreatorForge.exportPack()">📤 导出原创包</button>
                <button class="btn-ghost btn-mini" onclick="document.getElementById('fgFile').click()">📥 导入原创包</button>
                <input type="file" id="fgFile" accept=".json" style="display:none" onchange="CreatorForge.importPack(this.files[0])">
                <span class="fg-spacer"></span>
                <button class="btn-solid btn-mini" onclick="CreatorForge.save()">💾 存入世界书</button>
            </div>
        </div>`;
  }

  function readForm() {
    var v = {};
    var grid = document.getElementById('fgGrid');
    if (grid) {
      grid.querySelectorAll('[data-k]').forEach(function (el) { v[el.getAttribute('data-k')] = el.value; });
    }
    return v;
  }
  function readExtra() {
    var out = [];
    var box = document.getElementById('fgExtra');
    if (!box) return S.extra || [];
    var rows = box.querySelectorAll('.fg-extra');
    var map = {};
    rows.forEach(function (r) {
      var ki = r.querySelector('[data-ex="k"]'), vi = r.querySelector('[data-ex="v"]');
      if (!ki || !vi) return;
      var idx = ki.getAttribute('data-i');
      map[idx] = { k: ki.value, v: vi.value };
    });
    Object.keys(map).forEach(function (i) { out.push(map[i]); });
    return out;
  }

  var CreatorForge = {
    TYPES: TYPES,
    open: function (type) {
      S.type = TYPES[type] ? type : 'faction';
      S.editingId = null;
      S.extra = [];
      S.cache = {};
      S.scope = 'local';
      S.prio = TYPES[S.type].prio;
      var m = ensure();
      m.innerHTML = bodyHTML();
      m.style.display = 'flex';
      this.gen();
    },
    close: function () {
      var m = document.getElementById('forgeModal');
      if (m) m.style.display = 'none';
    },
    pick: function (k) {
      /* 累积缓存：切走再切回不丢内容（各类型字段不同，只回填同名字段会漏掉
         上一个类型独有的输入，例如填了势力成员再切人物、切回来成员就没了） */
      S.cache = Object.assign(S.cache || {}, readForm());
      S.extra = readExtra();
      S.type = k;
      S.prio = TYPES[k].prio;
      var v = S.cache;
      var m = ensure();
      m.innerHTML = bodyHTML();
      m.style.display = 'flex';
      var grid = document.getElementById('fgGrid');
      if (grid && v) {
        grid.querySelectorAll('[data-k]').forEach(function (el) {
          var kk = el.getAttribute('data-k');
          if (v[kk]) el.value = v[kk];
        });
      }
      this.gen();
    },
    addExtra: function () {
      S.extra = readExtra();
      S.extra.push({ k: '', v: '' });
      var box = document.getElementById('fgExtra');
      if (!box) return;
      var i = S.extra.length - 1;
      var d = document.createElement('div');
      d.className = 'fg-extra';
      d.innerHTML = '<input class="fg-in short" placeholder="字段名" data-ex="k" data-i="' + i + '">' +
        '<input class="fg-in" placeholder="内容" data-ex="v" data-i="' + i + '">' +
        '<button class="fg-del" onclick="CreatorForge.delExtra(' + i + ')">✕</button>';
      box.appendChild(d);
    },
    delExtra: function (i) {
      S.extra = readExtra();
      S.cache = Object.assign(S.cache || {}, readForm());
      S.extra.splice(i, 1);
      var m = ensure();
      var v = S.cache;
      m.innerHTML = bodyHTML();
      m.style.display = 'flex';
      var grid = document.getElementById('fgGrid');
      if (grid) grid.querySelectorAll('[data-k]').forEach(function (el) {
        var kk = el.getAttribute('data-k');
        if (v[kk]) el.value = v[kk];
      });
    },
    gen: function () {
      S.extra = readExtra();
      var v = readForm();
      var pv = document.getElementById('fgPreview');
      if (pv) pv.value = buildContent(S.type, v);
    },
    aiDraft: function () {
      var self = this;
      S.extra = readExtra();
      var v = readForm();
      var t = TYPES[S.type];
      var btn = document.getElementById('fgAiBtn');
      var skeleton = buildContent(S.type, v);
      if (!val(v.name)) { alert('先填一个名称，AI 才知道要给谁写。'); return; }
      var prompt = '你要为一条网络小说的世界书（设定库）写条目。\n\n' +
        '【条目类型】' + t.name + '\n【已有字段（作者填的骨架，不要改写事实，只做补全与润色）】\n' + skeleton +
        '\n\n【要求】\n1. 输出纯条目正文，Markdown，第一行是「## 名称」；\n2. 保留上面已有字段的全部信息，空缺处按设定合理补全（自己编，但要自洽）；\n3. 用「**字段名**：内容」分节，语言精炼，总分不超过 600 字；\n4. 不写任何与设定无关的说明、客套、前后缀；\n5. 不写性内容，不涉及未成年人。\n\n直接输出条目正文：';
      if (btn) { btn.disabled = true; btn.textContent = '✍️ AI 补写中…'; }
      var done = function (txt) {
        var pv = document.getElementById('fgPreview');
        var clean = String(txt || '').replace(/^[\s\S]*?(?=##\s)/, '');
        if (!/^##\s/.test(clean)) clean = String(txt || '').trim();
        if (pv && clean) pv.value = clean;
        if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 补完'; }
      };
      try {
        var p = window.callStoryAI ? window.callStoryAI(prompt, false, { maxTokens: 1200 }) : null;
        if (p && p.then) p.then(done).catch(function (e) {
          if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 补完'; }
          alert('AI 补写失败：' + (e && e.message ? e.message : e));
        });
        else { alert('未配置可用的 AI 接口，或接口调用不可用。可以先手填，或到「⚙ 接口」配好再来。'); if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 补完'; } }
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = '✨ 让 AI 补完'; }
        alert('AI 补写失败：' + (e && e.message ? e.message : e));
      }
    },
    save: function () {
      var KB = window.StoryKnowledge;
      if (!KB) { alert('知识库尚未就绪，请稍后再试。'); return; }
      S.extra = readExtra();
      var v = readForm();
      var name = val(v.name);
      if (!name) { alert('名称是必填的。'); return; }
      var pv = document.getElementById('fgPreview');
      var content = pv ? pv.value.trim() : '';
      if (!content) content = buildContent(S.type, v);
      var scopeEl = document.getElementById('fgScope');
      var prioEl = document.getElementById('fgPrio');
      var prio = prioEl ? prioEl.value : '';
      var always = ['top', 'high', 'medium', 'low'].indexOf(prio) !== -1;
      var entry = {
        title: name,
        content: content,
        category: TYPES[S.type].cat,
        tags: buildTags(S.type, v),
        keys: buildTags(S.type, v).slice(0, 20),
        alwaysInclude: always,
        priority: always ? prio : (prio === 'key' ? '' : ''),
        source: SRC,
        isGlobal: scopeEl && scopeEl.value === 'global'
      };
      if (prio === 'key') { entry.alwaysInclude = false; entry.priority = ''; }
      KB.addItem(entry);
      if (window.showToast) window.showToast('已存入世界书：' + name, 'ok');
      this.close();
      if (KB.open) KB.open();
    },
    exportPack: exportPack,
    importPack: importPack,
    /** 统计：本界原创条目数 */
    count: function () {
      var KB = window.StoryKnowledge;
      if (!KB) return 0;
      return (KB.knowledgeBase || []).filter(function (i) { return i.source === SRC; }).length;
    }
  };

  window.CreatorForge = CreatorForge;
})();
