/**
 * 玩家随身套装 PlayerKit（v1.1.0 · 随 v3.26.1）
 * ---------------------------------------------------------------------------
 * 用户反馈：「没有玩家面板和背包——道具拿了就忘、状态记不住」
 *          （v3.26.1 追加反馈：创作五工坊状态栏不更新、开局没有自定义变量）
 * 解决：每个模块世界自动获得三个随身器官（26 界各有各的皮）：
 *   🪪 pkPanel  玩家面板——主角身份卡：境界/所在/近况/伤势/势力/本界专属字段，
 *        跃升留痕、所在未报点名、每轮契约教 AI 如实上报
 *   🎒 pkBag    背包——随身物件账房：物品分类入格、数量进出记账、入手轮留痕、
 *        囤积点名（N 轮没动过的东西会提醒 AI 别让道具睡死）、支持手动增删
 *   🧩 pkCustom 万能自定义槽（v1.1.0，承自 free 界旧槽全界接管）——开局设定台
 *        播种（setup.customVars）+ 中途增删 + 每轮「自定义.字段: 值」双轨上报
 *
 * 架构（寄生 WorldExt，同 TimelineBranch/GameLayer 委托模式）：
 *   - studio.html 静态装载本 kit（world-ext-core.js 之后、界扩展之前）
 *   - world-ext-core v3.5.0 define() 内调 PlayerKit.augment(genre, modules)
 *     → 三器官插到界专属模块列表最前（随身器官每界都有，其余是各界的特色）
 *   - WORLDS 定制表：26 界各配面板皮（名称/境界称谓/货币/附加字段/横幅）
 *     与背包皮（名称/品类格/来源键/囤积阈值/横幅）
 *
 * 数据来源（全部只读镜像 + 手动档回写）：
 *   主角识别：storyState.setup.playerName → characters[k].isPlayer →
 *             vars.主角 / characters[k].role 命中主角称谓（工坊模式）→
 *             平铺键「某.location」兜底（与 immersive-suite 玩家定位同源）
 *   状态字段：characters[主角][status/location/状态/伤势/role/faction…]（嵌套）
 *             与「主角.字段」平铺键双轨兼容
 *   背包主账本：vars.items[]（variable-parser 权威账本，+品名 xN / items[] 整表）
 *   界专属清单：vars[行囊/储物袋/随身之物…]（只增补，不删）
 *   账簿流水：characters[主角].history / vars.history 里的 +/- 账目行
 *   自定义槽：setup.customVars（开局种子）→ vars.自定义{}/「自定义.字段」双轨
 */
(function () {
    'use strict';

    const PK_VERSION = 'v1.1.0';

    /* ==================== 自持助手集（不依赖 WXH，Node 冒烟可用） ==================== */
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* v3.33.0 稀有度圆点（与 immersive-suite 藏宝阁同源五档，凡品兜底）：品名一眼见贵贱 */
    const RARITY = [
        { n: '凡品', c: '#9aa0b4' }, { n: '常见', c: '#8fb89a' }, { n: '良品', c: '#6fb0d8' },
        { n: '珍品', c: '#b48cf0' }, { n: '绝品', c: '#e8a54f' }, { n: '神物', c: '#ef6a6a' }
    ];
    function rarityOf(name) {
        const s = String(name);
        if (/神|帝|圣|仙|准帝|十万年|异火|皇|本命/.test(s)) return 5;
        if (/灵宝|魂骨|魔核|源石|秘籍|皇级|史莱克|万年/.test(s)) return 4;
        if (/宝|丹|符|器|魂环|千年/.test(s)) return 3;
        if (/药|石|剑|刀|甲|书|信|币|卡/.test(s)) return 2;
        return 1;
    }

    function asList(v) {
        if (v == null) return null;
        if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' ? (x.name || x.名称 || x.title) : String(x))).filter(x => x && String(x).trim());
        if (typeof v === 'string') return v.split(/[、,，;；\n]/).map(x => x.trim()).filter(Boolean);
        return null;
    }

    function empty(icon, msg, hint) {
        return `<div class="wx-empty"><b>${icon}</b><p>${esc(msg)}</p><small>${esc(hint || '')}</small></div>`;
    }

    function card(title, inner, opts) {
        const o = opts || {};
        if (!inner) return '';
        return `<div class="wx-card${o.grow ? ' grow' : ''}">
            <div class="wx-card-hd"><span>${o.icon || '◈'}</span><b>${esc(title)}</b>${o.tag ? `<i class="wx-tag">${esc(o.tag)}</i>` : ''}</div>
            <div class="wx-card-bd">${inner}</div></div>`;
    }

    /* 样式（一次性注入；document 缺席时静默跳过） */
    function injectStyle() {
        try {
            if (typeof document === 'undefined' || !document.head) return;
            if (document.getElementById('pkStyle')) return;
            const st = document.createElement('style');
            st.id = 'pkStyle';
            st.textContent = `
.pk-idcard{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:9px}
.pk-idcard b.name{font-size:16px;color:var(--ip,#c9a86a);letter-spacing:2px}
.pk-idcard .role{font-size:11.5px;padding:2px 10px;border-radius:9px;background:var(--ip,#c9a86a)1c;border:1px solid var(--ip,#c9a86a)45;color:var(--itx,#d8cba8)}
.pk-wound{color:#e8a0a0!important}
.pk-cat{font-size:11px;letter-spacing:2px;margin:10px 0 3px;display:flex;align-items:center;gap:6px}
.pk-cat::before{content:'';width:3px;height:11px;border-radius:2px;background:currentColor}
.pk-item{display:flex;align-items:baseline;gap:7px;padding:4px 2px;border-top:1px dashed var(--ip,#c9a86a)18;font-size:12.5px}
.pk-item i.rdot{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:var(--rc,#9aa0b4);align-self:center;box-shadow:0 0 5px color-mix(in srgb,var(--rc,#9aa0b4) 55%,transparent)}
.pk-item b{color:var(--itx,#e8dcc0);font-weight:500;flex:1;min-width:0;word-break:break-all}
.pk-item .cnt{font-variant-numeric:tabular-nums;color:var(--ip,#c9a86a);font-weight:600}
.pk-item .meta{font-size:10.5px;color:var(--imt,#9a8c6e);white-space:nowrap}
.pk-item .stale{font-size:10.5px;color:#e8a04c;white-space:nowrap}
.pk-form{display:flex;gap:6px;align-items:center;margin-top:10px}
.pk-form input{flex:1;background:rgba(0,0,0,.3);border:1px solid var(--ip,#c9a86a)38;color:var(--itx,#e8dcc0);border-radius:8px;padding:6px 9px;font-size:12px;outline:none;min-width:0}
.pk-form input.cnt{flex:0 0 58px}`;
            document.head.appendChild(st);
        } catch (e) { /* 注入失败不影响渲染 */ }
    }

    /* ==================== 主角识别（与 immersive-suite 玩家定位同源） ====================
       通道① storyState.setup.playerName（扮演模式设定台）
       通道② characters[k].isPlayer（AI 建档标记；玩家面板契约首轮会教 AI 打标）
       通道③ 工坊模式兜底：vars.主角（名字）或 characters 中 role 精确命中主角称谓
       通道④ 平铺键「某.location」（最弱，可能抓到配角——只作最后兜底） */
    function who(vars) {
        try {
            const st = (typeof window !== 'undefined' && window.storyFramework && window.storyFramework.storyState) || {};
            if (st.setup && st.setup.playerName) return st.setup.playerName;
        } catch (e) { }
        const cs = (vars && vars.characters) || {};
        for (const k of Object.keys(cs)) { const v = cs[k]; if (v && (v.isPlayer || k === '玩家' || k === '主角')) return k; }
        /* 通道③：工坊模式（创作五工坊无 playerName/isPlayer）——
           role 精确匹配主角称谓（不做子串匹配，避免「主角之友」误中） */
        if (vars && typeof vars.主角 === 'string' && vars.主角.trim()) return vars.主角.trim();
        const PROTAG = /^(主角|男主角|女主角|叙述者|第一人称|主人公)$/;
        for (const k of Object.keys(cs)) {
            const v = cs[k];
            const r = String((v && (v.role || v.身份 || v.identity)) || '').trim();
            if (r && PROTAG.test(r)) return k;
        }
        if (vars) for (const k of Object.keys(vars)) { if (/\.location$/.test(k)) return k.split('.')[0]; }
        return null;
    }

    /** 取主角字段：嵌套 characters[主角][键] 与平铺「主角.键」双轨 */
    function fld(vars, pn, keys) {
        if (!vars || !pn) return undefined;
        const ch = vars.characters && vars.characters[pn];
        for (const k of keys) {
            if (ch && ch[k] != null && ch[k] !== '') return ch[k];
            const flat = vars[pn + '.' + k];
            if (flat != null && flat !== '') return flat;
        }
        return undefined;
    }

    /** 顶层多候选键 */
    function pick(vars, keys) {
        if (!vars) return undefined;
        for (const k of keys) if (vars[k] != null && vars[k] !== '') return vars[k];
        return undefined;
    }

    /** 手动档回写主账本（藏宝阁同源可见；失败静默） */
    function syncMainItems(name, count, sign) {
        try {
            const v = (typeof window !== 'undefined' && window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables) || null;
            if (!v) return;
            if (!Array.isArray(v.items)) v.items = [];
            const ex = v.items.find(i => i && i.name === name);
            if (sign > 0) { if (ex) ex.count = (ex.count || 1) + count; else v.items.push({ name, count }); }
            else if (ex) { ex.count = (ex.count || 1) - count; if (ex.count <= 0) v.items = v.items.filter(i => i !== ex); }
        } catch (e) { }
    }

    /* ==================== 标准字段键位 ==================== */
    const K_REALM = ['status', 'realm', '境界', '修为', '实力', '段位', '等级'];
    const K_LOC = ['location', '所在', '位置', '行踪', '当前行踪', '地点', 'loc'];
    const K_COND = ['状态', '近况', '身心', '身心近况', '状况', 'condition', 'cond'];
    const K_WOUND = ['伤势', '伤情', '伤病', '伤', 'wound', 'injury'];
    const K_ROLE = ['role', '身份', 'identity'];
    const K_FAC = ['faction', '势力', '阵营', '所属', '门派', '组织', '所属势力'];

    const DEFAULT_PANEL = {
        name: '玩家面板', icon: '🪪', tip: '主角身份卡：境界/所在/近况/伤势逐轮留痕',
        realm: true, realmLabel: '境界', realmKeys: K_REALM,
        currency: true, currencyLabel: '钱囊', currencyKeys: ['cash', '现金', '金钱', '资产', '银两', '金币', '钱财', '钱'],
        extra: [],
        emptyTitle: '主角卡还空着', emptyHint: '开篇建档后（AI 逐轮上报 status/location/状态/伤势）自动点亮'
    };

    /* ==================== 模块一：玩家面板（pkPanel） ==================== */
    function panelModule(cfg) {
        const P = Object.assign({}, DEFAULT_PANEL, (cfg && cfg.panel) || {});
        const extras = P.extra || [];

        return {
            id: 'pkPanel', icon: P.icon, name: P.name, tip: P.tip,

            contract(s) {
                const locked = !!(s && s.name);
                const n = locked ? s.name : '主角名';
                const parts = [];
                /* v3.47.1 修复（用户反馈：正文冒出「姜凡.location=…」字面量、面板不更新）：
                   旧模板用「=」作键值分隔，AI 照抄输出，而行式指令协议只认「:」——
                   这些行整条被解析器丢弃（面板读不到新值），还以字面量残留进正文。
                   统一改回标准冒号协议（与 isPlayer 标记及全站行式指令同格式）。 */
                if (P.realm !== false) parts.push(`${n}.status: 当前${P.realmLabel}（跃升当轮必更）`);
                parts.push(`${n}.location: 所在（每轮必报）`);
                parts.push(`${n}.状态: 身心近况一句话`);
                parts.push(`${n}.伤势: 有伤必报（痊愈即清空）`);
                parts.push(`${n}.role: 身份`);
                parts.push(`${n}.faction: 所属势力`);
                for (const e of extras) parts.push(`${n}.${e.keys[0]}: ${e.label}`);
                /* v1.1.0 未锁定主角（工坊模式首轮）：教 AI 打 isPlayer 标记，此后通道②精准锁定 */
                if (!locked) {
                    return `主角状态卡（全书核心人物/第一视角者，逐轮如实上报，无变化可省）：主角首次建档时加一行「主角名.isPlayer: true」标记身份，之后逐轮更新：${parts.join('、')}`;
                }
                return `主角状态卡（${n}本人，逐轮如实上报，无变化可省）：${parts.join('、')}`;
            },

            init: () => ({ name: '', realm: '', loc: '', cond: '', wound: '', role: '', faction: '', currency: '', extras: {}, log: [], _lastRealm: '', _lastRound: 0 }),

            read(s, vars, round) {
                let d = false;
                s._lastRound = round;
                const pn = who(vars);
                if (pn && pn !== s.name) { s.name = pn; d = true; }
                if (!pn) return d;

                const grab = (keys) => { const v = fld(vars, pn, keys); return (v == null || v === '') ? undefined : String(v).slice(0, 60); };

                if (P.realm !== false) {
                    let realm = grab(P.realmKeys);
                    if (realm == null) { const top = pick(vars, P.realmKeys); if (top != null) realm = String(top).slice(0, 60); }
                    if (realm != null && realm !== s.realm) { s.realm = realm; d = true; }
                }
                const loc = grab(K_LOC); if (loc != null && loc !== s.loc) { s.loc = loc; d = true; }
                const cond = grab(K_COND); if (cond != null && cond !== s.cond) { s.cond = cond; d = true; }
                const wound = grab(K_WOUND); if (wound != null && wound !== s.wound) { s.wound = wound; d = true; }
                const role = grab(K_ROLE); if (role != null && role !== s.role) { s.role = role; d = true; }
                const fac = grab(K_FAC); if (fac != null && fac !== s.faction) { s.faction = fac; d = true; }
                if (P.currency !== false) {
                    const cur = pick(vars, P.currencyKeys);
                    if (cur != null && String(cur) !== s.currency) { s.currency = String(cur).slice(0, 40); d = true; }
                }
                for (const e of extras) {
                    const v = grab(e.keys);
                    if (v != null && v !== s.extras[e.label]) { s.extras[e.label] = v; d = true; }
                }

                /* 跃升留痕：境界变化记账（凡人的每一步都值得记） */
                if (s.realm && s.realm !== s._lastRealm) {
                    if (s._lastRealm) {
                        s.log.unshift(`第${round}回：${s._lastRealm} → ${s.realm}`);
                        if (s.log.length > 8) s.log.length = 8;
                    }
                    s._lastRealm = s.realm;
                }
                return d;
            },

            html(s) {
                injectStyle();
                if (!s.name && !s.realm && !s.loc && !s.cond && !s.wound) {
                    return empty(P.icon, P.emptyTitle, P.emptyHint);
                }
                const badges = [];
                if (s.role) badges.push(`<span class="role">${esc(s.role)}</span>`);
                if (s.faction) badges.push(`<span class="role">${esc(s.faction)}</span>`);
                /* v3.27.7：玩家档案全字段可编——同一套档案编辑器（含🔒锁防AI覆盖） */
                const pkNameArg = s.name ? JSON.stringify(String(s.name)).replace(/"/g, '&quot;') : '';
                const pkEditBtn = s.name
                    ? `<button style="margin-left:auto;font-size:11px;padding:3px 10px;border-radius:99px;border:1px dashed rgba(201,168,106,.5);background:rgba(201,168,106,.08);color:var(--ip,#c9a86a);cursor:pointer;min-height:26px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;" onclick="StoryStatusRenderer.editCharacter(${pkNameArg})">✎ 编辑档案</button>`
                    : '';
                const head = `<div class="pk-idcard"><b class="name">${esc(s.name || '无名者')}</b>${badges.join('')}${pkEditBtn}</div>`;

                const rows = [];
                if (P.realm !== false && s.realm) rows.push([P.realmLabel, s.realm, 'hi']);
                if (s.loc) rows.push(['所在', s.loc]);
                if (s.cond) rows.push(['近况', s.cond]);
                if (s.wound) rows.push(['伤势', s.wound, 'wound']);
                if (P.currency !== false && s.currency) rows.push([P.currencyLabel, s.currency, 'gold']);
                for (const e of extras) if (s.extras[e.label]) rows.push([e.label, s.extras[e.label]]);
                const kvs = rows.map(([k, v, cls]) => `<div class="wx-kv"><span>${esc(k)}</span><b${cls === 'wound' ? ' class="pk-wound"' : cls === 'gold' ? ' style="color:#e8c45c;"' : cls === 'hi' ? ' style="color:var(--ip,#c9a86a);"' : ''}>${esc(v)}</b></div>`).join('');

                const log = s.log.length ? card('跃升留痕', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${esc(t)}</b></div>`).join(''), { icon: '📈' }) : '';
                const banner = P.banner ? `<div class="wx-banner">${esc(P.banner)}</div>` : '';
                return `${head}<div class="wx-kvs">${kvs}</div>${log}${banner}`;
            },

            directive(s) {
                const t = [];
                if (P.realm !== false && s.realm) t.push(`当前${P.realmLabel}「${s.realm}」：实力表现与际遇须贴合此阶段，跃升须有铺垫不得白给`);
                if (s.wound) t.push(`伤势「${s.wound}」未愈：行动与战力如实受限，痊愈当轮上报清空伤势`);
                if (s.loc) t.push(`所在「${s.loc}」：场景细节与在场人物与此一致，转场须报新所在`);
                else if (s.name) t.push(`所在未报：本轮补报 ${s.name}.location`);
                if (s.cond) t.push(`身心近况「${s.cond}」：言行状态与此呼应`);
                if (P.currency !== false && s.currency) t.push(`${P.currencyLabel}：${s.currency}（花销与进账都要写实的代价）`);
                for (const e of extras) if (s.extras[e.label]) t.push(`${e.label}：${s.extras[e.label]}`);
                return t.join('；');
            }
        };
    }

    /* ==================== 模块三：万能自定义槽（pkCustom，v1.1.0） ====================
       id 沿用旧 free/freeworld 界 'custom'（localStorage 态无缝继承，test-worldext 兼容）
       数据来源（双轨）：
       · 开局种子：storyState.setup.customVars（设定台「自定义变量」步骤收集）
       · 每轮上报：vars.自定义{字段:值}（嵌套/JSON）与平铺「自定义.字段: 值」双轨
       · 中途增删：面板交互（add/del/setVal），与旧 free 槽同交互 */
    function customModule() {
        const MAXF = 12;   /* 字段上限（防 AI 滥报刷屏） */

        /* 对象宽松解析：对象直通 / JSON 字符串尝试 / 其余空对象 */
        function asObjX(v) {
            if (v && typeof v === 'object' && !Array.isArray(v)) return v;
            if (typeof v === 'string') {
                try { const o = JSON.parse(v); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e) { }
            }
            return {};
        }

        /* 开局种子：setup.customVars（设定台收集，只种一次） */
        function seedFromSetup(s) {
            try {
                const st = (typeof window !== 'undefined' && window.storyFramework && window.storyFramework.storyState) || {};
                const arr = st.setup && st.setup.customVars;
                if (!Array.isArray(arr) || !arr.length) return false;
                let d = false;
                for (const p of arr) {
                    const key = String((p && p.key) || '').trim().slice(0, 10);
                    if (!key || s.fields.some(f => f.key === key)) continue;
                    s.fields.push({ key, val: String((p && p.val) || '').trim().slice(0, 16), note: '开局设定' });
                    d = true;
                }
                return d;
            } catch (e) { return false; }
        }

        return {
            id: 'custom', icon: '🧩', name: '万能自定义槽',
            tip: '想盯什么就加什么——开局种子 + 随时增删，AI 每轮照看',

            init: () => ({ fields: [], seeded: false }),

            read(s, vars, round) {
                let d = false;
                if (!s.seeded) { s.seeded = true; if (seedFromSetup(s)) d = true; }
                if (!vars) return d;
                /* 双轨：嵌套 自定义{} + 平铺「自定义.字段」键（嵌套优先） */
                const src = asObjX(vars.自定义 || vars.自定义追踪);
                const flat = {};
                for (const k of Object.keys(vars)) {
                    const m = k.match(/^自定义[.:：]?\s*(.+)$/);
                    if (m) { const fk = m[1].trim(); if (fk) flat[fk] = vars[k]; }
                }
                for (const [k, v] of Object.entries(flat)) {
                    const key = String(k).trim().slice(0, 10);
                    if (!key || key in src) continue;
                    src[key] = v;
                }
                for (const [k, v] of Object.entries(src)) {
                    const key = String(k).trim().slice(0, 10);
                    if (!key) continue;
                    const val = String(v).slice(0, 24);
                    const f = s.fields.find(x => x.key === key);
                    if (!f) {
                        if (s.fields.length < MAXF) { s.fields.push({ key, val, note: '' }); d = true; }
                    } else if (f.val !== val) { f.val = val; d = true; }
                }
                return d;
            },

            act(s, action, payload) {
                if (action === 'add') {
                    let key = '', val = '';
                    if (payload && typeof payload === 'object') { key = String(payload.key || '').trim(); val = String(payload.val || '').trim(); }
                    else {
                        try {
                            const ek = (typeof document !== 'undefined') && document.getElementById('pkCvKey');
                            const ev = (typeof document !== 'undefined') && document.getElementById('pkCvVal');
                            if (ek) { key = String(ek.value || '').trim(); val = String(ev && ev.value || '').trim(); }
                        } catch (e) { }
                    }
                    if (!key) return '字段名不能为空';
                    key = key.slice(0, 10);
                    if (s.fields.some(f => f.key === key)) return '字段已存在';
                    if (s.fields.length >= MAXF) return `最多 ${MAXF} 条——先删几条旧的`;
                    s.fields.push({ key, val: val.slice(0, 16), note: '' });
                    return `已追踪「${key}」`;
                }
                if (action === 'del') {
                    const i = Number(payload);
                    if (s.fields[i]) { const k = s.fields[i].key; s.fields.splice(i, 1); return `已移除「${k}」`; }
                }
                if (action === 'setVal') {
                    const i = Number(payload && payload.i);
                    if (s.fields[i]) { s.fields[i].val = String(payload.v || '').trim().slice(0, 24); return `「${s.fields[i].key}」已更新`; }
                }
            },

            html(s) {
                const rows = s.fields.map((f, i) => `<div class="wx-task">
                    <b>📌 ${esc(f.key)}</b>
                    <i style="font-style:normal;font-size:11.5px;color:var(--ip,#c9a86a);">${esc(f.val || '—')}</i>
                    ${f.note ? `<span class="st" style="color:var(--imt,#9a8c6e);">${esc(f.note)}</span>` : ''}
                    <button class="wx-del" title="移除" onclick="WorldExt.act('custom','del',${i})">✕</button>
                </div>`).join('');
                return `${s.fields.length ? card(`追踪中 · ${s.fields.length} 项`, rows, { icon: '🧩', grow: true }) : empty('🧩', '尚无自定义字段', '想盯什么就加什么：身高、人脉、好感、存粮、理智……开局设定台可播种，此处也可随时增删')}
                <div class="pk-form">
                    <input id="pkCvKey" placeholder="字段名（如：身高）" maxlength="10">
                    <input id="pkCvVal" placeholder="当前值（如：170cm）" maxlength="16">
                    <button class="wx-btn" onclick="WorldExt.act('custom','add')">＋ 追踪</button>
                </div>
                <div class="wx-banner">自定义字段会注入提示词，AI 每轮随剧情更新其值并让它真实影响走向——GTS、系统流、无限流等任何题材的私货变量都能挂。</div>`;
            },

            directive(s) {
                if (!s.fields.length) return '';
                /* v3.31.3：登记官分流期（默认架构）主笔被禁止输出变量块——旧文案
                 * 「在 variable_update 中逐轮更新」给主笔看是自相矛盾的死指令；
                 * 分流期改为告知主笔"独立登记系统在照看"，主笔只负责让变化真实影响走向 */
                const vaSplit = !!(typeof window !== 'undefined' && window.VariableAI
                    && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()));
                return vaSplit
                    ? `玩家自定义追踪字段（独立登记系统随剧情逐轮更新，数值变化须真实影响剧情走向，正文不得与当前值矛盾）：${s.fields.map(f => `${f.key}=${f.val || '未定'}`).join('，')}`
                    : `玩家自定义追踪字段（每轮如实更新，数值变化须真实影响剧情走向）：${s.fields.map(f => `${f.key}=${f.val || '未定'}`).join('，')}`;
            },

            /** 契约随当前字段动态生成（核心支持函数式 contract）
             *  v3.31.3：分流期措辞同样自适应（登记官协议已收录「自定义.字段名: 值」） */
            contract: (s) => (s && s.fields && s.fields.length)
                ? (() => {
                    const vaSplit = !!(typeof window !== 'undefined' && window.VariableAI
                        && (window.VariableAI.isEnabled() || window.VariableAI.isFallbackActive()));
                    return vaSplit
                        ? `自定义[${s.fields.map(f => f.key).join(',')}]（玩家自定的追踪字段，登记官在剧情变化时以「自定义.字段名: 值」更新）`
                        : `自定义[${s.fields.map(f => f.key).join(',')}]（玩家自定的追踪字段，在 variable_update 中以「自定义.字段名: 值」逐轮更新）`;
                })()
                : null
        };
    }

    /* ==================== 通用品类兜底 ==================== */
    const GENERIC_CATS = [
        ['武器兵刃', '#d89858', ['剑', '刀', '枪', '弓', '弩', '矛', '棍', '鞭', '锤', '斧', '匕']],
        ['丹药补品', '#7ec8a0', ['丹', '药', '丸', '散', '汤', '膏', '参', '剂']],
        ['法器符物', '#a08ad8', ['符', '箓', '镜', '铃', '幡', '印', '盘', '炉', '鼎', '玉', '珠', '晶']],
        ['书卷文书', '#6aa8d8', ['书', '卷', '经', '信', '图', '册', '笺', '纸', '契', '帖']],
        ['衣食钱财', '#e8c45c', ['银', '钱', '币', '衣', '袍', '鞋', '帽', '粮', '米', '水']]
    ];

    const DEFAULT_BAG = {
        name: '随身背包', icon: '🎒', tip: '随身物件进出记账——囤久了点名',
        voc: '随身物件', sourceKeys: [], threshold: 12, cap: 60,
        cats: GENERIC_CATS, banner: '',
        emptyTitle: '背包还空着', emptyHint: '获得物件后（AI 记「+品名 x数量」账或上报 items[] 清单）自动入格；也可在下方手动记账'
    };

    /* ==================== 模块二：背包（pkBag） ==================== */
    function bagModule(cfg) {
        const B = Object.assign({}, DEFAULT_BAG, (cfg && cfg.bag) || {});
        const TH = B.threshold || 12;
        const CAP = B.cap || 60;
        const cats = (B.cats && B.cats.length) ? B.cats : GENERIC_CATS;

        /* 品名规整：剥尾部括号注释「神风舟（法器）」→ { name:'神风舟', tag:'法器' }
           tag 供品类匹配与小字展示，不污染品名本体（手动增删/对账去重都用净名） */
        function splitName(raw) {
            const s = String(raw).trim();
            const m = s.match(/^(.{1,32}?)\s*[（(]([^（）()]{1,12})[)）]$/);
            if (m && m[1].trim()) return { name: m[1].trim(), tag: m[2].trim() };
            return { name: s, tag: '' };
        }

        function catOf(name, tag) {
            const s = String(name) + (tag ? '·' + tag : '');
            for (const [label, color, kws] of cats) {
                if (kws.some(kw => s.indexOf(kw) >= 0)) return { label, color };
            }
            return { label: '杂物', color: '#9a8c6e' };
        }

        return {
            id: 'pkBag', icon: B.icon, name: B.name, tip: B.tip,

            contract: `${B.name}（${B.voc}）：物品进出用「+品名 x数量」（获得）与「-品名 x数量」（用掉/耗尽/遗失）逐笔记账（必须带 x数量，不带会被记成伏笔）；亦可整表上报 items[]（当前实持清单：品名+数量）${B.sourceKeys && B.sourceKeys.length ? `或 ${B.sourceKeys[0]}[] 清单` : ''}——获得即入、失去即出，账实相符`,

            init: () => ({ items: [], log: [], _lastRound: 0 }),

            read(s, vars, round) {
                let d = false;
                s._lastRound = round;

                /* A) 主账本 items[]（权威：非空整表增删对账；空整表=明说清空；无键不动） */
                if (Array.isArray(vars.items)) {
                    if (vars.items.length) {
                        const seen = new Set();
                        for (const raw of vars.items) {
                            if (!raw) continue;
                            const r = splitName((typeof raw === 'object') ? String(raw.name || raw.名称 || '') : String(raw));
                            const name = r.name;
                            if (!name || name.length > 48) continue;
                            const count = (typeof raw === 'object') ? Math.max(1, Math.round(Number(raw.count != null ? raw.count : (raw.qty != null ? raw.qty : raw.数量)) || 1)) : 1;
                            seen.add(name);
                            const it = s.items.find(x => x.name === name);
                            if (it) {
                                if (it.count !== count) { it.count = count; it.touch = round; d = true; }
                                if (r.tag && it.tag !== r.tag) { it.tag = r.tag; d = true; }
                            } else {
                                s.items.push({ name, count, got: round, touch: round, src: 'ledger', tag: r.tag });
                                d = true;
                            }
                        }
                        const before = s.items.length;
                        /* 对账只清「账本档」：清单档（src=list，界专属只增）与手动档（src=m）不随整表出入，
                           仅在空整表（明说清空）时一并清掉 */
                        s.items = s.items.filter(it => it.src !== 'ledger' || seen.has(it.name));
                        if (s.items.length !== before) d = true;
                    } else if (s.items.some(it => it.src !== 'm')) {
                        s.items = s.items.filter(it => it.src === 'm');
                        d = true;
                    }
                }

                /* B) 界专属来源清单（行囊/储物袋…）：只增补不删除 */
                for (const key of (B.sourceKeys || [])) {
                    const arr = asList(vars[key]);
                    if (!arr) continue;
                    for (const name of arr) {
                        const r = splitName(name);
                        if (!r.name || r.name.length > 48 || s.items.some(x => x.name === r.name)) continue;
                        s.items.push({ name: r.name, count: 1, got: round, touch: round, src: 'list', note: key, tag: r.tag });
                        d = true;
                    }
                }

                /* C) 账目流水：主角 history / 大事记 里的 +/- 行 → 账簿 + 触碰时间校准 */
                const pn = who(vars);
                const hists = [];
                const ch = pn && vars.characters && vars.characters[pn];
                if (ch && Array.isArray(ch.history)) hists.push(...ch.history);
                if (Array.isArray(vars.history)) hists.push(...vars.history.slice(-30));
                for (const h of hists) {
                    const str = String(h);
                    const m = str.match(/[＋+－-]\s*([^\sx×:：，。；]{2,24}?)\s*[x×]\s*(\d{1,4})/);
                    if (!m) continue;
                    const gain = (m[0][0] === '+' || m[0][0] === '＋');
                    const name = m[1].trim();
                    const text = `${gain ? '＋' : '－'}${name} x${m[2]}`;
                    if (!s.log.some(l => l.text === text)) {
                        s.log.unshift({ text, gain, round });
                        if (s.log.length > 12) s.log.length = 12;
                        d = true;
                        /* 只有「新账目」才算动过——history 是累积数组，
                           旧账目行每轮重读若也刷新 touch，囤积点名永远不触发 */
                        const it = s.items.find(x => x.name === name);
                        if (it) it.touch = round;
                    }
                }

                if (s.items.length > CAP) { s.items.length = CAP; d = true; }
                return d;
            },

            act(s, action, payload) {
                if (action === 'add') {
                    let name = '', count = 1;
                    if (payload && typeof payload === 'object') { name = String(payload.name || '').trim(); count = Math.max(1, Math.round(Number(payload.count) || 1)); }
                    else {
                        try {
                            const el = (typeof document !== 'undefined') && document.getElementById('pkBagName');
                            const ce = (typeof document !== 'undefined') && document.getElementById('pkBagCnt');
                            if (el) { name = String(el.value || '').trim(); count = Math.max(1, Math.round(Number(ce && ce.value) || 1)); }
                        } catch (e) { }
                    }
                    if (!name || name.length > 48) return '品名不能为空';
                    const it = s.items.find(x => x.name === name);
                    if (it) { it.count += count; it.touch = s._lastRound || 0; }
                    else { s.items.push({ name, count, got: s._lastRound || 0, touch: s._lastRound || 0, src: 'm' }); }
                    s.log.unshift({ text: `＋${name} x${count}`, gain: true, round: s._lastRound || 0 });
                    if (s.log.length > 12) s.log.length = 12;
                    syncMainItems(name, count, 1);
                    return `已入袋：${name} ×${count}`;
                }
                if (action === 'out') {
                    let it = null;
                    if (typeof payload === 'number') it = s.items[payload];
                    else if (payload && typeof payload === 'object') it = s.items.find(x => x.name === payload.name);
                    else if (typeof payload === 'string') it = s.items.find(x => x.name === payload);
                    if (!it) return '没找到这件物件';
                    const name = it.name, count = it.count;
                    s.items = s.items.filter(x => x !== it);
                    s.log.unshift({ text: `－${name} x${count}`, gain: false, round: s._lastRound || 0 });
                    if (s.log.length > 12) s.log.length = 12;
                    syncMainItems(name, count, -1);
                    return `已出袋：${name}${count > 1 ? ' ×' + count : ''}`;
                }
            },

            html(s) {
                injectStyle();
                const cur = s._lastRound || 0;
                if (!s.items.length && !s.log.length) {
                    return empty(B.icon, B.emptyTitle, B.emptyHint);
                }
                /* 分类入格 */
                const groups = new Map();
                for (const it of s.items) {
                    const c = catOf(it.name, it.tag);
                    if (!groups.has(c.label)) groups.set(c.label, { color: c.color, items: [] });
                    groups.get(c.label).items.push(it);
                }
                const listHtml = [...groups.entries()].map(([label, g]) => `
                    <div class="pk-cat" style="color:${g.color};">${esc(label)} · ${g.items.length}</div>
                    ${g.items.map((it, i) => {
                    const idx = s.items.indexOf(it);
                    const stale = cur - (it.touch || 0);
                    return `<div class="pk-item">
                            <i class="rdot" style="--rc:${RARITY[rarityOf(it.name)].c};" title="${RARITY[rarityOf(it.name)].n}"></i>
                            <b>${esc(it.name)}</b>
                            ${it.count > 1 ? `<span class="cnt">×${it.count}</span>` : ''}
                            <span class="meta">${it.tag ? esc(it.tag) + ' · ' : ''}第${it.got || 0}回入</span>
                            ${stale >= TH ? `<span class="stale">⏳${stale}轮未动</span>` : ''}
                            <button class="wx-del" title="记一笔：用掉/遗失" onclick="WorldExt.act('pkBag','out',${idx})">✕</button>
                        </div>`;
                }).join('')}`).join('');

                const listCard = s.items.length ? card(`${B.listTitle || '清单'} · ${s.items.length}件`, listHtml, { icon: B.icon, grow: true, tag: s.items.length ? `${s.items.reduce((a, x) => a + (x.count || 1), 0)}件计` : '' }) : '';
                const form = `<div class="pk-form">
                    <input id="pkBagName" placeholder="品名（如：回气丹）" maxlength="24">
                    <input id="pkBagCnt" class="cnt" type="number" min="1" max="999" value="1">
                    <button class="wx-btn" onclick="WorldExt.act('pkBag','add')">＋ 入袋</button>
                </div>`;
                const log = s.log.length ? card('进出账簿', s.log.map(l => `<div class="wx-task">
                    <b style="color:${l.gain ? '#a8d8a0' : '#e0a0a0'};font-weight:400;font-size:12px;">${esc(l.text)}</b>
                    <span class="st" style="color:var(--imt,#9a8c6e);">第${l.round}回</span>
                </div>`).join(''), { icon: '📖' }) : '';
                const banner = B.banner ? `<div class="wx-banner">${esc(B.banner)}</div>` : '';
                return `${listCard}${form}${log}${banner}`;
            },

            directive(s) {
                const t = [];
                const cur = s._lastRound || 0;
                if (s.items.length) {
                    t.push(`行囊 ${s.items.length} 件在账：动用其中物件须写实效与代价，用掉即记「-品名 x数量」`);
                    const stale = s.items.filter(it => (cur - (it.touch || 0)) >= TH);
                    if (stale.length) {
                        t.push(`囤积点名：${stale.slice(0, 3).map(it => `「${it.name}」${cur - it.touch}轮未动`).join('、')}——适时让它们派上用场、遗失或被觊觎，别让道具睡死`);
                    }
                } else {
                    t.push('行囊空空：获得物件当轮记「+品名 x数量」入账');
                }
                return t.join('；');
            }
        };
    }

    /* ==================== 26 界专属定制表 ====================
       panel: { name/icon/tip, realm:false|{label,keys}, currency:false|{label,keys},
                extra:[{label,keys}], banner, emptyTitle/emptyHint }
       bag:   { name/icon/tip/voc, sourceKeys, cats:[[品名,色,关键词]], threshold, banner } */
    const WORLDS = {
        daoguiyixian: {
            panel: {
                name: '身份名牌', icon: '🎫', tip: '真身是谁、两边各自怎么活——身份与近况逐轮留痕',
                realmLabel: '道行', realmKeys: ['status', 'realm', '道行', '境界', '修为'],
                currencyLabel: '资产', currencyKeys: ['资产', '现金', '钱', '身家'],
                banner: '两个世界两套身体：白塔医院的病人，大傩世界的道童——都真，也都假；哪边吃药哪边遭殃，名牌上见分晓。',
                emptyTitle: '名牌还空着', emptyHint: '主角卡建档后（AI 逐轮上报 status/location/状态/伤势）此处自动点亮'
            },
            bag: {
                name: '随身之物', icon: '🎒', tip: '两个世界各带各的物件——品名分格、进出记账，囤久了会点名', voc: '随身物件',
                sourceKeys: ['随身之物', '行囊'],
                cats: [
                    ['药与方', '#7ec8a0', ['药', '方', '丹', '汤', '丸', '片', '绷带']],
                    ['法器符物', '#a08ad8', ['符', '铃', '幡', '剑', '镜', '印', '罗盘', '法器']],
                    ['现代物件', '#6aa8d8', ['手机', '病历', '约束带', '刀片', '钥匙', '硬币', '身份证']]
                ],
                banner: '跨界的物件要留神：白塔的药片在大傩是别的什么，反过来也一样——用错了世界的东西，会出大事。'
            }
        },
        mystery: {
            panel: {
                name: '身份档案', icon: '🪪', tip: '你是谁、在哪、带着什么伤——查案人自己的档案也要留痕',
                realm: false, currency: false,
                extra: [{ label: '秘密', keys: ['secret', '秘密', '隐情'] }],
                banner: '查案者也在局中：你的身份、行踪与伤势都是剧情的变量——档案替你记着，别以为自己只是读者。'
            },
            bag: {
                name: '随身物件', icon: '🧰', tip: '口袋里有什么、哪件是证据——查案人的百宝囊', voc: '随身物件', threshold: 8,
                sourceKeys: ['随身物件', '行囊'],
                cats: [
                    ['证据线索', '#d88a9a', ['证据', '线索', '照片', '录音', '笔记', '胶带', '血样', '当票']],
                    ['证件钥匙', '#6aa8d8', ['证', '钥匙', '卡', '门禁', '护照', '身份证']],
                    ['工具杂物', '#9a8c6e', ['手电', '刀', '绳', '撬', '锁', '镊', '手套', '地图', '烟']]
                ],
                banner: '查案的铁则：证据要链，物件要账——哪件东西什么时候到过谁的手里，都可能是翻案的钥匙。'
            }
        },
        douluodalu: {
            panel: {
                name: '魂师名牌', icon: '🪪', tip: '魂力段位、武魂、所在——魂师的随身铭牌',
                realmLabel: '魂力', realmKeys: ['status', 'realm', '魂力', '境界'],
                currencyLabel: '金魂币', currencyKeys: ['金魂币', '金魂', '金币', '钱', '资产'],
                extra: [{ label: '武魂', keys: ['soul', '武魂'] }],
                banner: '魂师的立身之本：武魂定方向，魂环定强弱，魂力段位一步一个脚印——越级挑战是天才的专利。'
            },
            bag: {
                name: '魂师行囊', icon: '🎒', tip: '魂导器、丹药、魂骨——随身物件分类入格，囤久了点名', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物'],
                cats: [
                    ['魂导器', '#d89858', ['魂导', '导器', '炮', '弩', '机关']],
                    ['丹药物资', '#7ec8a0', ['丹', '药', '丸', '剂', '粮']],
                    ['魂骨魂环', '#a08ad8', ['魂骨', '魂环', '外附']]
                ],
                banner: '斗罗大陆的硬通货：魂骨有价无市，魂导器看工时——东西从哪来、到哪去，账要记清。'
            }
        },
        doupocangqiong: {
            panel: {
                name: '斗者名牌', icon: '🪪', tip: '斗气段位、所在、近况——斗气大陆的随身铭牌',
                realmLabel: '斗气', realmKeys: ['status', 'realm', '斗气', '境界', '修为'],
                currencyLabel: '金币', currencyKeys: ['金币', '金票', '钱', '资产'],
                banner: '斗之气三段到斗帝，路是一段段斗上去的——段位即话语权；废柴与天才，往往只差一个药老。'
            },
            bag: {
                name: '纳戒账簿', icon: '💍', tip: '纳戒里的丹药功法斗技——品名入格、进出记账', voc: '纳戒物件',
                sourceKeys: ['纳戒', '行囊', '随身之物'],
                cats: [
                    ['丹药', '#7ec8a0', ['丹', '药', '丸', '散', '液']],
                    ['功法斗技', '#a08ad8', ['功法', '斗技', '诀', '卷']],
                    ['武器装备', '#d89858', ['剑', '刀', '枪', '甲', '袍', '重剑']],
                    ['火种异宝', '#e07858', ['异火', '火', '魂', '精', '核', '魔核']]
                ],
                banner: '纳戒是斗者的身家：丹药救急，异火镇宅——东西越贵，惦记的人越多；账要记清，底牌要藏好。'
            }
        },
        wanmeishijie: {
            panel: {
                name: '少年铭牌', icon: '🪪', tip: '搬血洞天、所在、近况——荒古少年的随身铭牌',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '修为'],
                currencyLabel: '灵石', currencyKeys: ['灵石', '源石', '资产', '钱'],
                banner: '搬血到尊者到神火，荒古路远：境界是底气，凶兽是磨刀石——石村的规矩是活着比什么都大。'
            },
            bag: {
                name: '兽皮行囊', icon: '🎒', tip: '兽皮袋里的凶兽材料、丹药、兵器——入格记账', voc: '兽皮袋物件',
                sourceKeys: ['行囊', '兽皮袋', '随身之物'],
                cats: [
                    ['凶兽材料', '#d89858', ['凶兽', '兽骨', '兽皮', '血', '角', '爪', '核']],
                    ['丹药灵药', '#7ec8a0', ['丹', '药', '灵药', '草', '参', '果']],
                    ['兵器法器', '#a08ad8', ['剑', '刀', '甲', '塔', '鼎', '幡']]
                ],
                banner: '荒古的物物交换：凶兽材料是硬通货，宝术拓印看机缘——少年离家，行囊就是全部家当。'
            }
        },
        quanzhigaoshou: {
            panel: {
                name: '选手卡', icon: '🎮', tip: '职业、位置、状态——电竞选手的随身卡片',
                realm: false,
                currencyLabel: '资金', currencyKeys: ['资金', '现金', '存款', '钱'],
                extra: [{ label: '职业', keys: ['职业', 'profession', '位置', 'position'] }],
                banner: '荣耀十年：职业选手的黄金年龄就那几年——手速、状态、战队席位，一样都不能松。'
            },
            bag: {
                name: '账号装备仓', icon: '🎒', tip: '银武、装备、材料图纸——账号仓库的随身账', voc: '装备物件',
                sourceKeys: ['装备', '仓库', '行囊'],
                cats: [
                    ['银武装备', '#d89858', ['银武', '武器', '伞', '枪', '甲', '装备']],
                    ['技能书卷', '#a08ad8', ['技能书', '卷', '秘籍', '图']],
                    ['材料图纸', '#6aa8d8', ['材料', '图纸', '矿', '晶', '卡']]
                ],
                banner: '千机伞是一件件材料堆出来的：装备要养，材料要攒——网管的工资和战队的赞助，都是仓库里的柴米。'
            }
        },
        zhongshengdushi: {
            panel: {
                name: '双面身份卡', icon: '🎭', tip: '明面是学生，暗地是修士——两副面孔一副卡',
                realmLabel: '修为', realmKeys: ['status', 'realm', '修为', '境界'],
                currencyLabel: '现金', currencyKeys: ['现金', 'cash', '存款', '钱', '资产'],
                banner: '重生一世：明面要稳（高考、家人、同学），暗地要狠（灵石、功法、仇家）——两头都不能露馅。'
            },
            bag: {
                name: '随身储物', icon: '🎒', tip: '书包里的课本、袖里的法宝——两套家当一本账', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物', '储物'],
                cats: [
                    ['修真之物', '#a08ad8', ['法宝', '符', '丹', '灵石', '法器', '玉', '剑']],
                    ['凡俗物件', '#6aa8d8', ['手机', '课本', '卡', '钱', '证', '书']]
                ],
                banner: '双面人生的收纳学：法宝不能被同学看见，试卷不能被修士看见——分清楚，活长久。'
            }
        },
        swallowedstar: {
            panel: {
                name: '武者档案', icon: '🪪', tip: '武者等阶、所在、近况——极限武馆的随身档案',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '等级'],
                currencyLabel: '资金', currencyKeys: ['现金', '存款', '资金', '钱', '资产'],
                banner: '地球时代：武者是人类的脊梁——学徒到战神到行星级，每一步都是拿命拼出来的；贡献点比钱值钱。'
            },
            bag: {
                name: '武者装备包', icon: '🎒', tip: '兵刃、护甲、药剂——武者的随身装备账', voc: '装备物件',
                sourceKeys: ['行囊', '装备'],
                cats: [
                    ['武器', '#d89858', ['刀', '剑', '枪', '盾', '棍', '斧']],
                    ['护甲装备', '#6aa8d8', ['甲', '衣', '靴', '护', '头盔']],
                    ['药剂物资', '#7ec8a0', ['药剂', '药', '血', '血清', '粮', '水']]
                ],
                banner: '武者的命门在装备：怪兽材料换钱，钱换装备，装备换命——轮回的逻辑要记牢。'
            }
        },
        shrouding: {
            panel: {
                name: '修士名牌', icon: '🪪', tip: '轮海道宫、所在、近况——修士的随身铭牌',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '修为'],
                currencyLabel: '源石', currencyKeys: ['源石', '灵石', '源', '资产'],
                banner: '修行路远：苦海初辟到仙台红尘，一步一重天；源是硬通货，古经是无价宝——财不露白，法不轻传。'
            },
            bag: {
                name: '乾坤袋', icon: '⚗', tip: '乾坤袋里的法器古宝、圣药灵物——入格记账', voc: '乾坤袋物件',
                sourceKeys: ['乾坤袋', '行囊', '随身之物'],
                cats: [
                    ['法器古宝', '#d89858', ['鼎', '塔', '剑', '印', '钟', '幡', '甲']],
                    ['圣药灵药', '#7ec8a0', ['圣药', '药', '参', '果', '芝', '花', '液']],
                    ['功法古经', '#a08ad8', ['经', '诀', '卷', '功法', '拓印']],
                    ['源石矿料', '#6aa8d8', ['源', '石', '矿', '玉', '精']]
                ],
                banner: '遮天的财富观：一小块神源能让一个教派发狂——东西越神，越要捂着；装备再好，不如跑得快。'
            }
        },
        wuxia: {
            panel: {
                name: '江湖名帖', icon: '📜', tip: '门派、功力、行踪——行走江湖的名帖',
                realmLabel: '功力', realmKeys: ['status', 'realm', '功力', '境界', '修为'],
                currencyLabel: '盘缠', currencyKeys: ['银两', '银子', '银', '盘缠', '钱', '现金'],
                banner: '人在江湖：名帖就是脸面——门派是靠山，功力是底气，盘缠是腿；三样齐了，才敢走远路。'
            },
            bag: {
                name: '行囊包袱', icon: '🎒', tip: '包袱里的兵刃暗器、伤药银票——入格记账', voc: '包袱物件',
                sourceKeys: ['包袱', '行囊', '随身之物'],
                cats: [
                    ['兵刃暗器', '#d89858', ['剑', '刀', '枪', '匕', '镖', '刺', '鞭']],
                    ['伤药', '#7ec8a0', ['药', '丹', '膏', '散', '丸']],
                    ['信物文书', '#6aa8d8', ['信', '书', '令', '帖', '图', '契', '令牌']],
                    ['钱财衣物', '#e8c45c', ['银', '票', '钱', '衣', '袍', '鞋', '干粮']]
                ],
                banner: '江湖的规矩：兵器谱上排座次，包袱里面见身家——金创药要常备，银票要藏好。'
            }
        },
        cthulhu: {
            panel: {
                name: '调查员卡', icon: '🕯', tip: '身份、行踪、伤病——调查员的随身档案',
                realm: false,
                currencyLabel: '现金', currencyKeys: ['现金', 'cash', '钱', '存款'],
                banner: '调查员须知：你的身体和精神都是消耗品——伤要治，觉要睡，可疑的书别乱翻；活得久才算赢。'
            },
            bag: {
                name: '随身提包', icon: '🧳', tip: '提包里的证件、武器、禁忌书籍——入格记账', voc: '提包物件', threshold: 10,
                sourceKeys: ['提包', '行囊', '随身物品'],
                cats: [
                    ['禁忌书籍', '#a08ad8', ['书', '卷', '抄本', '手记', '死灵', '禁书']],
                    ['武器防具', '#d89858', ['枪', '刀', '棍', '甲', '护']],
                    ['调查工具', '#6aa8d8', ['手电', '绳', '撬', '镜', '相机', '放大镜', '药瓶']],
                    ['补给药品', '#7ec8a0', ['药', '绷带', '粮', '水', '烟']]
                ],
                banner: '理智守则：每件遗物都有来历，每本书都有代价——用之前想清楚，值不值一条理智。'
            }
        },
        scifi: {
            panel: {
                name: '船员证', icon: '🛰', tip: '职位、所在、状态——船员的随身证件',
                realm: false,
                currencyLabel: '信用点', currencyKeys: ['信用点', 'credits', '货币', '钱', '资金'],
                extra: [{ label: '义体', keys: ['义体', '植入体', 'implant', '改造'] }],
                banner: '深空生存法则：氧气和信用点一样金贵——证件、装备、补给，缺一样都出不了港。'
            },
            bag: {
                name: '装备舱清单', icon: '📦', tip: '装备舱里的武器、模组、补给——入格记账', voc: '舱内物资',
                sourceKeys: ['装备舱', '物资', '行囊'],
                cats: [
                    ['武器弹药', '#d89858', ['枪', '炮', '刃', '弹药', '弹', '雷']],
                    ['科技装备', '#6aa8d8', ['模组', '芯片', '探测器', '终端', '无人机', '甲']],
                    ['医疗补给', '#7ec8a0', ['药', '医疗', '绷带', '氧', '粮', '水']],
                    ['数据核心', '#a08ad8', ['数据', '核心', '密钥', '卡', '盘']]
                ],
                banner: '舰船物资管理：弹药会打光，氧气会耗尽——清单要常对，补给要提前订；深空不赊账。'
            }
        },
        earth: {
            panel: {
                name: '身份户籍', icon: '📇', tip: '姓名、营生、行踪、家底——时代里安身立命的名片',
                realm: false, currency: false,
                extra: [{ label: '营生', keys: ['营生', '生计', '职业', 'occupation', 'job', '差事'] }, { label: '家当', keys: ['assets', '家当', '家底', '资产'] }],
                banner: '一世人生：营生是饭碗，行踪是命运——时代不会等人，户籍上每一笔都是活过的证据。'
            },
            bag: {
                name: '随身家当', icon: '🧳', tip: '身上的证件、钱财、物件——家当入格记账', voc: '随身家当',
                sourceKeys: ['家当', '行囊', '随身物品'],
                cats: [
                    ['证件文书', '#6aa8d8', ['证', '文书', '信', '契', '状', '照', '票']],
                    ['钱财细软', '#e8c45c', ['钱', '币', '银', '元', '票', '金']],
                    ['工具物件', '#9a8c6e', ['刀', '绳', '灯', '锁', '书', '图', '衣', '表']],
                    ['粮药杂物', '#7ec8a0', ['粮', '米', '药', '膏', '盐', '布', '水']]
                ],
                banner: '持家之道：一文钱难倒英雄汉——进账出账要记，家当细软要清；乱世里，家当就是命。'
            }
        },
        longzu: {
            panel: {
                name: '血统档案', icon: '🐉', tip: '血统、言灵、行踪——卡塞尔学院的学籍档案',
                realmLabel: '血统', realmKeys: ['status', 'realm', '血统', '等级', '阶段'],
                currencyLabel: '零花钱', currencyKeys: ['现金', '存款', '零花钱', '钱'],
                extra: [{ label: '言灵', keys: ['言灵', '言灵等级', 'word'] }],
                banner: '混血种的宿命：血统是天赋也是诅咒——言灵要练，功课要交，狮心会的账单和龙类的杀意一样准时。'
            },
            bag: {
                name: '随身书包', icon: '🎒', tip: '书包里的装备、卡牌、课本——入格记账', voc: '随身物件',
                sourceKeys: ['书包', '行囊', '装备'],
                cats: [
                    ['装备道具', '#d89858', ['装备', '剑', '枪', '甲', '风衣', '道具']],
                    ['卡牌契约', '#a08ad8', ['卡', '牌', '契约', '卷轴']],
                    ['药品物资', '#7ec8a0', ['药', '血清', '绷带', '粮', '水']],
                    ['课本杂物', '#6aa8d8', ['书', '课本', '笔记', '证']]
                ],
                banner: '学院的生存包：屠龙要有装备，考试要带课本——两样都别落下，学费很贵。'
            }
        },
        lunhuileyuan: {
            panel: {
                name: '轮回者面板', icon: '☠', tip: '等级、所在副本、近况——轮回者的随身面板',
                realmLabel: '等级', realmKeys: ['status', '等级', 'level', '轮回者等级', '境界'],
                currencyLabel: '乐园币', currencyKeys: ['乐园币', '乐园点', '钱', '货币'],
                banner: '轮回铁则：副本里死亡即真死——等级是护身符，乐园币是命，装备是胆；杀戮世界不养闲人。'
            },
            bag: {
                name: '轮回背包', icon: '🎒', tip: '装备、卷轴、消耗品——轮回者的求生背包', voc: '背包物资',
                sourceKeys: ['背包', '行囊', '装备'],
                cats: [
                    ['装备', '#d89858', ['装备', '剑', '刀', '枪', '甲', '靴']],
                    ['技能卷轴', '#a08ad8', ['卷轴', '技能', '书', '图']],
                    ['消耗品', '#7ec8a0', ['药', '剂', '粮', '水', '绷带', '血清']],
                    ['材料', '#6aa8d8', ['材料', '矿', '晶', '核', '骨', '皮']]
                ],
                banner: '乐园的物价：副本里一瓶药能救命，出来后一文不值——什么时候用、什么时候囤，是活人的学问。'
            }
        },
        shenmifusu: {
            panel: {
                name: '驭鬼人档案', icon: '🕯', tip: '身份、行踪、伤病——驭鬼人的随身档案',
                realm: false, currency: false,
                banner: '灵异世界的保命符：鬼有规律，人有档案——你的身份与行踪，决定哪只鬼先找上门；驭鬼先驭己。'
            },
            bag: {
                name: '随身百宝囊', icon: '🧳', tip: '灵异遗物、黄金器物、镇邪法器——入格记账', voc: '随身物件', threshold: 10,
                sourceKeys: ['百宝囊', '行囊', '随身之物'],
                cats: [
                    ['灵异遗物', '#a08ad8', ['遗物', '残页', '人皮', '镜', '铃']],
                    ['黄金器物', '#e8c45c', ['金', '黄金', '克']],
                    ['镇邪法器', '#d89858', ['符', '剑', '印', '香', '烛', '铜']],
                    ['杂物补给', '#9a8c6e', ['水', '粮', '药', '绳', '灯', '手机']]
                ],
                banner: '驭鬼人的家底：黄金能定惊，遗物能索命——哪件东西救过你、哪件害过人，账要记清；鬼比人有记性。'
            }
        },
        shengxu: {
            panel: {
                name: '进化档案', icon: '🧬', tip: '境界、所在、近况——后文明时代的随身档案',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '段位'],
                currencyLabel: '资产', currencyKeys: ['资产', '现金', '钱'],
                banner: '后文明时代：觉醒到枷锁到逍遥——每断一道枷锁多一种神通；异果是机缘也是靶子，吃下去就没了回头路。'
            },
            bag: {
                name: '随身行囊', icon: '🎒', tip: '异果、上古遗物、武器——入格记账', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物'],
                cats: [
                    ['异果灵材', '#7ec8a0', ['果', '参', '芝', '草', '菌', '花']],
                    ['上古遗物', '#a08ad8', ['遗物', '上古', '残', '碑', '玉', '镜']],
                    ['武器装备', '#d89858', ['剑', '刀', '枪', '甲', '弓', '弩']]
                ],
                banner: '残破昆仑的馈赠：异果一口吞是莽夫，留着换命是智者——行囊里的每一样，都可能是下一段进化的钥匙。'
            }
        },
        dibao: {
            panel: {
                name: '修士名牌', icon: '🪪', tip: '命宫真命、所在、近况——帝霸世界的随身铭牌',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '命宫', '真命'],
                currencyLabel: '道金', currencyKeys: ['道金', '粗石', '精石', '灵石', '资产', '钱'],
                banner: '帝霸之世：命宫是根基，真命是造化——十万载出一个仙帝；宝物认主，因果随身，账要记清。'
            },
            bag: {
                name: '命宫宝库', icon: '⚗', tip: '兵器帝宝、丹药功法——命宫里的随身宝库', voc: '命宫藏品',
                sourceKeys: ['命宫', '宝库', '行囊'],
                cats: [
                    ['兵器帝宝', '#d89858', ['剑', '刀', '鼎', '钟', '印', '塔', '甲', '宝']],
                    ['丹药', '#7ec8a0', ['丹', '药', '丸', '液']],
                    ['功法', '#a08ad8', ['功法', '经', '诀', '卷', '术']],
                    ['矿料灵物', '#6aa8d8', ['石', '矿', '玉', '精', '草', '木']]
                ],
                banner: '宝物有灵：帝宝认主，兵器择主——得之是缘，守之是命；怀璧其罪的账，帝霸世界记得最清。'
            }
        },
        wulianfengdian: {
            panel: {
                name: '武者名牌', icon: '🪪', tip: '所在、近况、伤势——武者的随身铭牌',
                realm: false, currency: false,
                banner: '武炼长路：淬体到开天十四境，一步一重天——境界与灵石另有账房（武道阶梯），这块名牌只管你是谁、在哪、伤没伤。'
            },
            bag: {
                name: '储物袋', icon: '⚗', tip: '丹药兵刃、妖兽材料——储物袋里的随身账', voc: '储物袋物件',
                sourceKeys: ['储物袋', '行囊'],
                cats: [
                    ['丹药', '#7ec8a0', ['丹', '药', '丸', '散']],
                    ['兵刃', '#d89858', ['剑', '刀', '枪', '棍', '鞭', '甲']],
                    ['功法武技', '#a08ad8', ['功法', '武技', '诀', '卷']],
                    ['妖兽材料', '#6aa8d8', ['妖兽', '兽', '骨', '皮', '核', '血', '筋']]
                ],
                banner: '武者的家当：功法武技靠机缘，丹药灵石靠攒——妖兽材料是武者的钱袋子，猎一头吃三个月。'
            }
        },
        fanrenxiuxian: {
            panel: {
                name: '修士名牌', icon: '🪪', tip: '所在、近况、伤势——修士的随身铭牌',
                realm: false, currency: false,
                banner: '凡人流铁则：苟字当头——境界长梯与灵石身家另有账房（仙路长梯），这块名牌只管你是谁、在哪、伤没伤；低调做人是第一要务。'
            },
            bag: {
                name: '储物袋账簿', icon: '⚗', tip: '法宝丹药功法灵虫建档入册——机缘的进出都记着价码', voc: '储物袋物件',
                sourceKeys: ['行囊', '储物袋'], threshold: 12,
                cats: [
                    ['法器', '#d89858', ['法器', '剑', '铃', '幡', '鼎', '塔', '印', '舟', '甲']],
                    ['丹药', '#7ec8a0', ['丹', '药', '丸', '散']],
                    ['功法', '#a08ad8', ['功法', '秘籍', '诀', '卷', '经']],
                    ['灵药灵材', '#6aa8d8', ['灵草', '灵药', '灵芝', '参', '矿', '石', '玉', '木', '乳']],
                    ['符箓阵盘', '#d88a9a', ['符', '禁', '阵', '盘']]
                ],
                banner: '苟道铁则：财不露白，底牌比明牌多——机缘都标着价码，本命法宝损毁伤本，弃宝保命是至痛抉择；账，要笔笔算清。'
            }
        },
        xianni: {
            panel: {
                name: '逆修名牌', icon: '🪪', tip: '所在、近况、伤势——逆修者的随身铭牌',
                realm: false, currency: false,
                banner: '逆天改命：凝气十五层数着走，踏天四步是尽头——境界与灵石另有账房（仙路长梯）；这块名牌只记你是谁、在哪、伤没伤。'
            },
            bag: {
                name: '储物袋', icon: '⚗', tip: '法宝丹药功法古物——储物袋里的随身账', voc: '储物袋物件',
                sourceKeys: ['行囊', '储物袋'],
                cats: [
                    ['法宝', '#d89858', ['法宝', '锏', '剑', '印', '幡', '鼎', '塔']],
                    ['丹药', '#7ec8a0', ['丹', '药', '丸', '散']],
                    ['功法玉简', '#a08ad8', ['功法', '玉简', '诀', '卷', '经']],
                    ['古物材料', '#6aa8d8', ['古', '残', '矿', '石', '玉', '木', '灵草']]
                ],
                banner: '仙逆的生存学：能用命换的绝不用钱，能捡的绝不买——东西从哪来，仇就从哪来。'
            }
        },
        limingzhijian: {
            panel: {
                name: '法师登记证', icon: '✨', tip: '阶位、所在、近况——帝国法师的登记证件',
                realmLabel: '法师阶位', realmKeys: ['status', 'realm', '法师', '阶位', '等级', '境界'],
                currencyLabel: '金币', currencyKeys: ['金币', '金', '钱', '资金', '货币'],
                banner: '魔导时代：奥术是生产力，魔法是工程学——阶位是饭碗，魔导科技是时代的火车头；细节即真实。'
            },
            bag: {
                name: '随身法器包', icon: '🎒', tip: '魔导装置、卷轴、材料——法师的随身工具包', voc: '法器包物件',
                sourceKeys: ['法器包', '行囊', '随身之物'],
                cats: [
                    ['魔导装置', '#6aa8d8', ['魔导', '装置', '核心', '终端', '模块', '傀儡']],
                    ['法术卷轴', '#a08ad8', ['卷轴', '法术', '符文', '图纸']],
                    ['材料药剂', '#7ec8a0', ['药', '剂', '矿', '晶', '草', '粉尘']]
                ],
                banner: '魔导师的行规：装置要保养，卷轴要备份——战场上没电的魔导枪不如一根烧火棍。'
            }
        },
        quanzhifashi: {
            panel: {
                name: '法师名牌', icon: '⚡', tip: '修为、系别、所在——魔法世界的随身名牌',
                realmLabel: '修为', realmKeys: ['status', 'realm', '修为', '等级', '境界'],
                currencyLabel: '现金', currencyKeys: ['现金', '钱', '金币', '资产', '存款'],
                extra: [{ label: '系别', keys: ['系别', '魔法系', '双系'] }],
                banner: '魔法觉醒：一系立身，双系天才，三系妖孽——修为是梯子，系别是赛道；城市猎妖队不养闲人。'
            },
            bag: {
                name: '魔法行囊', icon: '🎒', tip: '魔具、魔石、卷轴——法师的随身行囊', voc: '行囊物件',
                sourceKeys: ['行囊', '随身之物'],
                cats: [
                    ['魔具法器', '#d89858', ['魔具', '法器', '杖', '剑', '甲', '翼']],
                    ['魔石药剂', '#7ec8a0', ['魔石', '药', '剂', '丸']],
                    ['卷轴契约', '#a08ad8', ['卷轴', '契约', '书', '图']],
                    ['妖魔材料', '#6aa8d8', ['妖魔', '魔核', '骨', '皮', '血', '鳞']]
                ],
                banner: '猎魔人的账本：魔核按阶论价，妖魔材料看品相——下水道里的老鼠也有一颗能换饭钱的魔核。'
            }
        },
        ditandali: {
            panel: {
                name: '练摊身份证', icon: '🧢', tip: '身份、所在、近况——小摊主的随身证件',
                realm: false,
                currencyLabel: '现金', currencyKeys: ['现金', '存款', '钱', '资金', '资产'],
                banner: '小人物的发家史：摊位是门面，怨气是燃料，大力药水是硬通货——先苟住，再起飞。'
            },
            bag: {
                name: '随身货箱', icon: '📦', tip: '摊位货品、异兽材料、随身物件——入格记账', voc: '货箱物件',
                sourceKeys: ['货箱', '行囊'],
                cats: [
                    ['系统道具', '#a08ad8', ['药水', '系统', '灵果', '黄豆', '布丁']],
                    ['货品商品', '#e8c45c', ['货', '商品', '玩具', '零食', '小玩意']],
                    ['异兽材料', '#d89858', ['内丹', '兽', '骨', '皮', '核', '血']],
                    ['杂物', '#9a8c6e', ['绳', '布', '灯', '工具']]
                ],
                banner: '地摊经济学：进货要看流量，出货要看嘴皮——货箱里的每件东西都是本钱，赔了要记账。'
            }
        },
        quanqiubingfeng: {
            panel: {
                name: '幸存者身份卡', icon: '❄️', tip: '异能、身家、所在、近况——末世幸存者的随身档案',
                realmLabel: '异能', realmKeys: ['status', 'realm', '异能', '境界', '状态'],
                currencyLabel: '现金', currencyKeys: ['现金', '存款', '钱', '资产', '资金'],
                extra: [{ label: '职业', keys: ['职业', '身份', 'job'] }, { label: '安全屋', keys: ['安全屋', '安全屋等级', '住所'] }],
                banner: '灾变两套账：灾变前——存款是本金，职业是渠道，身份越普通越好；灾变后——物资是命，异能是底牌，谁都不知道你有空间。'
            },
            bag: {
                name: '无限空间账本', icon: '📦', tip: '识海虚空里的物资进出流水——囤货流的随身账房', voc: '空间物资',
                sourceKeys: ['空间物资', '行囊', '物品', '物资'],
                cats: [
                    ['食品储备', '#e8c45c', ['米', '面', '粮', '罐头', '食品', '油', '盐', '糖', '压缩', '冻', '水']],
                    ['燃料能源', '#d89858', ['柴油', '汽油', '煤', '燃料', '油桶', '电池', '光伏', '发电机', '柴']],
                    ['药品医疗', '#7ec8a0', ['药', '抗生素', '退烧', '冻伤', '医疗', '纱布', '口罩']],
                    ['武器弹药', '#d88a6a', ['枪', '弹', '刀', '弩', '弹药', '独头弹', '钢管']],
                    ['工具器械', '#6aa8d8', ['工具', '焊', '机', '绳', '保暖', '睡袋', '军大衣', '滤芯', '净水']]
                ],
                banner: '囤货流的账本哲学：清单即安全感，数字即命——三十吨大米、两千箱罐头、四百桶柴油；空间的每一方容量，都是拿灾变前的钱换的。'
            }
        },
        /* ===== v3.37.0 超神学院：战士军籍卡 + 军用背囊 ===== */
        chaoshenxueyuan: {
            panel: {
                name: '战士军籍卡', icon: '🎖', tip: '基因等阶、军衔战功、编制所在——诸神时代一兵的随身档案',
                realmLabel: '基因觉醒', realmKeys: ['status', 'realm', '基因觉醒', '基因等阶', '境界', '状态'],
                currencyLabel: '战功', currencyKeys: ['战功', '军功', '功勋', '积分', 'cash', '现金', '钱'],
                extra: [{ label: '军衔', keys: ['军衔', '军阶', 'rank'] }, { label: '编制', keys: ['编制', '部队', '所属', '单位'] }],
                banner: '军籍卡的哲学：基因等阶是天赋也是枷锁——一代扛枪弹，二代有异能，神体拆舰队；军衔与战功是地球文明给你的定价，攒够了才换得来更强的装备与信任。'
            },
            bag: {
                name: '军用背囊', icon: '🎒', tip: '随队装备与缴获物资进出记账——战场上的账要记清', voc: '随身装备',
                sourceKeys: ['行囊', '随身装备', '物品', '装备'],
                cats: [
                    ['枪械弹药', '#d88a6a', ['枪', '弹', '狙', '步枪', '弹药', '手雷', '雷']],
                    ['军需补给', '#e8c45c', ['口粮', '粮', '水', '罐头', '压缩', '急救', '药']],
                    ['战术装具', '#6aa8d8', ['通讯', '夜视', '镜', '绳', '插板', '背心', '头盔', '服']],
                    ['特殊物品', '#b48cf0', ['微虫洞', '圣', '虚空', '神', '核心', '引擎', '装置']]
                ],
                banner: '背囊里的账本哲学：地球军的装备按军功配发，缴获各有来历——每一件特殊物品背后，都该有一段写得出细节的战场故事。'
            }
        },
        /* ===== v3.38.0 斩神：守夜人值勤卡 + 夜行背囊 ===== */
        zhanhen: {
            panel: {
                name: '守夜人值勤卡', icon: '🌙', tip: '精神力境界、禁墟档案、病院羁绊——迷雾时代一员的随身档案',
                realmLabel: '精神力境界', realmKeys: ['status', 'realm', '精神力境界', '精神力', '境界'],
                currencyLabel: '军功', currencyKeys: ['军功', '战功', '功勋', '积分', 'cash', '现金', '钱'],
                extra: [{ label: '禁墟', keys: ['禁墟', '禁墟能力', 'ruin'] }, { label: '编制', keys: ['编制', '所属小队', '小队', '单位'] }],
                banner: '值勤卡的哲学：精神力六境是天赋也是责任——盏境觉醒，川境国家级战力，克莱因境破维度；禁墟是超凡的根，编制是守夜人给你的信任——夜里出门，卡上写的都是要还的。'
            },
            bag: {
                name: '夜行背囊', icon: '🎒', tip: '值夜装备与缴获神秘物件进出记账——雾里的账要记清',
                voc: '随身装备',
                sourceKeys: ['行囊', '随身装备', '物品', '装备'],
                cats: [
                    ['值夜装备', '#a8c4c8', ['手电', '对讲', '夜视', '绳', '口粮', '水', '急救']],
                    ['武器弹药', '#d88a6a', ['枪', '弹', '刀', '斩神', '星辰', '祸津', '剑', '弩']],
                    ['防护装具', '#6aa8d8', ['服', '甲', '插板', '背心', '头盔', '靴']],
                    ['神秘物件', '#b48cf0', ['禁物', '神秘', '神', '遗物', '符', '核']]
                ],
                banner: '背囊里的账本哲学：守夜人的装备按编制配发，缴获的神秘物件各有来历——每一件神兵背后，都该有一段写得出细节的雾夜故事。'
            }
        },
        /* ===== v3.47.2 剑来：修士名帖 + 山水行囊 ===== */
        jianlai: {
            panel: {
                name: '修士名帖', icon: '🗡', tip: '境界、师承、山头——浩然天下行走的名帖',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '修为', '练气', '武夫', '境'],
                currencyLabel: '神仙钱', currencyKeys: ['谷雨钱', '小暑钱', '神仙钱', '铜钱', '银两', 'cash', '钱'],
                extra: [{ label: '师承', keys: ['师承', '师门', '先生', '传承'] }, { label: '山头', keys: ['山头', '所属', '宗门', '书院'] }],
                banner: '名帖的哲学：练气士登高望远，武夫一步一个脚印——洞府到飞升十四境天差地别；师承是根脚，山头是招牌，行走江湖先递名帖，礼数到了路才宽。'
            },
            bag: {
                name: '山水行囊', icon: '🎒', tip: '法袍剑器、符箓丹药进出记账——山高水长，行囊要清',
                voc: '随身之物',
                sourceKeys: ['行囊', '随身装备', '物品', '装备'],
                cats: [
                    ['法袍剑器', '#a8c4d8', ['剑', '袍', '甲', '拂尘', '印', '镜', '钟']],
                    ['符箓丹药', '#e8c45c', ['符', '丹', '药', '膏', '丸', '散']],
                    ['神仙钱物', '#d8b86a', ['谷雨钱', '小暑钱', '神仙钱', '铜钱', '银两', '金精']],
                    ['书帖信物', '#b48cf0', ['书', '帖', '信', '印章', '玉佩', '扇', '簪']]
                ],
                banner: '行囊的哲学：读书人的书、练剑人的剑、有钱人的神仙钱——契诃夫之枪在山水间同样成立，背进去的物件，迟早要在故事里响。'
            }
        },
        /* ===== v3.47.2 诡秘之主：演绎法手册 + 旅行皮箱 ===== */
        guimi: {
            panel: {
                name: '演绎法手册', icon: '📜', tip: '序列、途径、非凡身份——非凡者的私人笔记',
                realmLabel: '序列', realmKeys: ['status', 'realm', '序列', '途径', '境界', '位阶'],
                currencyLabel: '金镑', currencyKeys: ['金镑', '英镑', '苏', '便士', 'cash', '现金', '钱'],
                extra: [{ label: '途径', keys: ['途径', '非凡途径', '序列途径'] }, { label: '组织', keys: ['组织', '教会', '隶属', '值夜者', '代行者'] }],
                banner: '手册的哲学：序列不是力量是诅咒——9 到 0 每一步都在人性与神性之间走钢丝；扮演法是缰绳，失控是深渊；演绎法告诉你：知道得越多，越要装作不知道。'
            },
            bag: {
                name: '旅行皮箱', icon: '🧳', tip: '仪式材料、封印物、证件文书进出记账——非凡者的行李要过安检',
                voc: '随身物品',
                sourceKeys: ['行囊', '随身装备', '物品', '皮箱', '装备'],
                cats: [
                    ['仪式材料', '#b48cf0', ['烛', '香', '符', '草药', '水晶', '粉末', '圣油']],
                    ['药剂与封印', '#6fb0d8', ['药剂', '魔药', '封印', '特性', '卷轴']],
                    ['武器火器', '#d88a6a', ['左轮', '枪', '弹', '杖', '刀', '剑', '匕首']],
                    ['信件证件', '#e8c45c', ['信', '证件', '名片', '徽章', '报纸', '笔记']]
                ],
                banner: '皮箱的哲学：非凡者的行李每件都有来历——仪式材料按配方备齐，封印物分级收好；被值夜者查箱的时候，希望每样东西你都解释得清楚。'
            }
        },
        /* ===== v3.47.2 蛊真人：蛊师腰牌 + 储物皮囊 ===== */
        guzhenren: {
            panel: {
                name: '蛊师腰牌', icon: '🐛', tip: '转数、本命蛊、势力归属——蛊修界的身份凭证',
                realmLabel: '转数', realmKeys: ['status', 'realm', '转数', '境界', '蛊师', '修为'],
                currencyLabel: '元石', currencyKeys: ['元石', '元精', '石币', '蛊虫', 'cash', '钱'],
                extra: [{ label: '本命蛊', keys: ['本命蛊', '命蛊', '本命'] }, { label: '势力', keys: ['势力', '家族', '宗门', '山寨', '阵营'] }],
                banner: '腰牌的哲学：一转到九转，转转都是拿命垫的——蛊师炼蛊，蛊亦炼人；本命蛊是第二性命，元石是硬通货；这方天地只认两样东西：实力，和算计。'
            },
            bag: {
                name: '储物皮囊', icon: '🎒', tip: '蛊虫、蛊材、元石进出记账——蛊师的账本就是命本',
                voc: '随身之物',
                sourceKeys: ['行囊', '随身装备', '物品', '装备'],
                cats: [
                    ['蛊虫', '#8fd89a', ['蛊', '虫', '蝉', '蝶', '蚁', '蜂', '蛇']],
                    ['药材蛊材', '#b8d88a', ['药', '草', '芝', '花', '果', '髓', '血', '骨']],
                    ['元石财物', '#d8b86a', ['元石', '元精', '石', '币', '钱']],
                    ['凶器杂物', '#d88a6a', ['刀', '剑', '骨', '刺', '牌', '符', '图']]
                ],
                banner: '皮囊的哲学：蛊虫分一转到九转，材料按年份论价——收进囊中的每只蛊都要能报出来历；记不清账的蛊师，坟头草已经三丈高。'
            }
        },
        /* ===== v3.47.2 玄鉴仙族：家族度牒 + 家族行囊 ===== */
        xuanjianxianzu: {
            panel: {
                name: '家族度牒', icon: '🪪', tip: '修为、房支、职司——仙族子弟的身份牒文',
                realmLabel: '修为', realmKeys: ['status', 'realm', '修为', '境界', '炼气', '筑基', '金丹'],
                currencyLabel: '灵石', currencyKeys: ['灵石', '灵晶', '仙石', 'cash', '钱', '资产'],
                extra: [{ label: '房支', keys: ['房支', '家族', '门第', '出身'] }, { label: '职司', keys: ['职司', '差事', '职务', '执掌'] }],
                banner: '度牒的哲学：炼气是门楣，筑基是栋梁，金丹是祖宗——修为就是家族里的座次；灵田要人种，丹房要人守，子弟的修为上不去，家业就守不住。'
            },
            bag: {
                name: '家族行囊', icon: '🎒', tip: '法器符箓、丹药灵植进出记账——族产出入要有账',
                voc: '随身之物',
                sourceKeys: ['行囊', '随身装备', '物品', '装备'],
                cats: [
                    ['法器符箓', '#a8c4d8', ['符', '剑', '镜', '铃', '鼎', '印', '幡']],
                    ['丹药灵植', '#8fd89a', ['丹', '药', '灵草', '灵植', '种', '苗', '米', '谷']],
                    ['灵石财物', '#d8b86a', ['灵石', '灵晶', '币', '钱', '券']],
                    ['族务文书', '#e8c45c', ['信', '文书', '账', '册', '印', '令']]
                ],
                banner: '行囊的哲学：族产公用、私产分明——族里配的法器要登记，自己挣的灵石才硬气；账本清白，在族老面前才说得上话。'
            }
        },
        freeworld: {
            panel: {
                name: '本世身份卡', icon: '🪪', tip: '你是谁、在哪、近况如何——自定义世界的随身名片',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '修为', '等级'],
                currencyLabel: '钱囊', currencyKeys: ['cash', '现金', '钱', '货币', '资产', '银两', '金币'],
                banner: '世界是你亲手定的，命运也是——身份卡替你记着：你在哪、你有什么、你伤没伤。'
            },
            bag: {
                name: '行囊', icon: '🎒', tip: '随身物件进出记账——囤久了点名', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物', '物品'],
                banner: '行囊是你与世界讨价还价的本钱——记清账，走远路。'
            }
        },
        free: {
            panel: {
                name: '主角卡', icon: '🪪', tip: '主角是谁、在哪、近况——创作过程中的随身档案',
                realmLabel: '状态', realmKeys: ['status', 'realm', '境界', '状态', '修为'],
                currencyLabel: '钱囊', currencyKeys: ['cash', '现金', '钱', '资产', '银两'],
                banner: '写作须知：主角的状态是读者的锚点——档案替你记着，别让人物失忆。'
            },
            bag: {
                name: '随身背包', icon: '🎒', tip: '主角的随身物件——进出记账、囤积点名', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物', '物品'],
                banner: '契诃夫之枪：挂在墙上的枪终要响——背包里的东西，迟早要派上用场。'
            }
        },

        /* 未知界兜底皮（用户自建新世界也有面板+背包） */
        _generic: {
            panel: {
                name: '玩家面板', icon: '🪪', tip: '主角身份卡：境界/所在/近况/伤势逐轮留痕',
                realmLabel: '境界', realmKeys: ['status', 'realm', '境界', '修为', '实力', '段位', '等级'],
                currencyLabel: '钱囊', currencyKeys: ['cash', '现金', '钱', '货币', '资产', '银两', '金币']
            },
            bag: {
                name: '随身背包', icon: '🎒', tip: '随身物件进出记账——囤久了点名', voc: '随身物件',
                sourceKeys: ['行囊', '随身之物', '物品']
            }
        }
    };

    /* 界定制取值：未配置的界走通用皮（用户自建世界不裸奔） */
    function cfgOf(genre) { return WORLDS[genre] || WORLDS._generic; }

    /* ==================== 公开 API ==================== */
    window.PlayerKit = {
        version: PK_VERSION,
        config: WORLDS,

        /** WorldExt.define 钩子：面板+背包+自定义槽插到界专属模块列表最前
            （幂等；未知界走通用皮；滤除界扩展旧 'custom' 模块——pkCustom 全界接管，无双槽） */
        augment(genre, modules) {
            const cfg = cfgOf(genre);
            const rest = (modules || []).filter(m => m && m.id !== 'pkPanel' && m.id !== 'pkBag' && m.id !== 'custom');
            const out = [];
            if (cfg.panel !== false) out.push(panelModule(cfg));
            if (cfg.bag !== false) out.push(bagModule(cfg));
            if (cfg.custom !== false) out.push(customModule());
            return out.concat(rest);
        },

        /* 测试与界扩展可单独取用 */
        panel: panelModule,
        bag: bagModule,
        custom: customModule,
        who, fld: (vars, pn, keys) => fld(vars, pn, keys)
    };
})();
