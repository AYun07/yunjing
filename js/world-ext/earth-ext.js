/**
 * 地球开放世界 · 界专属扩展（v3.19.6）
 * 🌍 三件套——
 *   时空罗盘：era/date/location/time/weather 时代位置五项，世界坐标的命脉
 *   生计账本：cash/savings/income/expense 一分一厘都有来路去处
 *   时代校准：时代即边界——科技/交通/通讯/医疗/观念按年代划定，禁止时代错置
 */
(function () {
    'use strict';

    /* ==================== ① 时空罗盘 ==================== */
    const spacetimeMod = {
        id: 'spacetime', icon: '🧭', name: '时空罗盘',
        tip: '时代位置五项每轮必报——你在哪个年代、哪块土地、几点钟、什么天，罗盘说了算',
        contract: 'era（所处时代，保持玩家设定原文）；date（当前日期，史前写季节物候）；location（国家/地区·城市·具体场所）；time（时刻与天象）；weather（一词天象）',
        init: () => ({ era: '', date: '', location: '', time: '', weather: '', log: [] }),

        /* v3.32.2 状态板摘要：🧭 1937年8月 ·南京·阴（时代坐标常驻第一行） */
        summary(s) {
            if (!s.era && !s.date && !s.location) return [];
            return [{
                i: '🧭', v: String(s.date || s.era).slice(0, 12),
                l: [String(s.location || '').slice(0, 14), s.weather].filter(Boolean).join('·')
            }];
        },

        read(s, vars, round) {
            let d = false;
            const grab = (keys) => {
                for (const k of keys) {
                    const v = vars[k];
                    if (v != null && String(v).trim()) return String(v).trim();
                }
                return '';
            };
            const next = {
                era: grab(['era', '时代', '所处时代']),
                date: grab(['date', '日期', '当前日期']),
                location: grab(['location', '位置', '当前所在']),
                time: grab(['time', '时刻']),
                weather: grab(['weather', '天象', '天气'])
            };
            for (const k of Object.keys(next)) {
                if (next[k] && next[k] !== s[k]) { s[k] = next[k]; d = true; }
            }
            /* 日期跳变即记行程：跨月跨年的迁徙留痕 */
            if (d && next.date && next.date !== s.log[0]) {
                const stamp = `${next.date}${next.location ? ' · ' + next.location : ''}`;
                s.log.unshift(stamp);
                if (s.log.length > 8) s.log.length = 8;
            }
            return d;
        },

        html(s) {
            if (!s.era && !s.date && !s.location) {
                return WXH.empty('🧭', '罗盘尚未校准', '入场后 AI 每轮上报时代位置五项（era/date/location/time/weather），此处自动走针');
            }
            const kv = WXH.kv([
                ['所处时代', s.era],
                ['当前日期', s.date],
                ['当前所在', s.location],
                ['时刻天象', s.time],
                ['天象', s.weather]
            ]);
            const trail = s.log.length > 1
                ? WXH.card('行程留痕', s.log.slice(1).map(x => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;color:#7ab8c9;">📍 ${WXH.esc(x)}</b></div>`).join(''), { icon: '🗺️' })
                : '';
            return `${WXH.card('世界坐标 · 此刻', kv, { icon: '🧭', grow: true, tag: s.weather || '—' })}
            ${trail}
            <div class="wx-banner">罗盘即铁律：正文里每一件物品、每一种说法、每一个价钱都必须配得上这个年代——时代里没有的东西，谁也拿不出来；时间跨度按行动实情推进（一顿饭、一趟车、数月乃至数年），不服务于戏剧节奏。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.era) t.push(`当前时代「${s.era}」——一切器物、制度、物价、观念严格据此校准`);
            if (s.location) t.push(`玩家此刻在「${s.location}」，本地风物人情按真实地理呈现`);
            if (s.date) t.push(`日期推进至「${s.date}」，跨日跨月须在正文中可感（作息、光线、季节）`);
            t.push('时间跨度按行动实情伸缩：细密处从容铺陈，平淡岁月可数轮并过——这是生活的节奏，不是剧本的节奏');
            return t.join('；');
        }
    };

    /* ==================== ② 生计账本 ==================== */
    const ledgerMod = {
        id: 'ledger', icon: '💰', name: '生计账本',
        tip: 'cash/savings/income/expense——钱有数目、有来源、有去向；一分一厘都记着',
        contract: 'cash（随身现金，带时代货币单位）；savings（存款/积蓄）；income（收入来源与量级）；expense（近期大项支出）',
        init: () => ({ cash: '', savings: '', income: '', expense: '', notes: [] }),

        /* v3.32.2 状态板摘要：💰 随身 12块银元 ·积蓄/进项（生计常驻状态板） */
        summary(s) {
            if (!s.cash && !s.savings && !s.income) return [];
            return [{
                i: '💰', v: String(s.cash || '无现金').slice(0, 14),
                l: String(s.savings || s.income || '').slice(0, 16)
            }];
        },

        read(s, vars, round) {
            let d = false;
            const grab = (keys) => {
                for (const k of keys) {
                    const v = vars[k];
                    if (v != null && String(v).trim()) return String(v).trim();
                }
                return '';
            };
            const next = {
                cash: grab(['cash', '现金', '随身钱财']),
                savings: grab(['savings', '存款', '积蓄']),
                income: grab(['income', '收入']),
                expense: grab(['expense', '支出', '近期支出'])
            };
            for (const k of Object.keys(next)) {
                if (next[k] && next[k] !== s[k]) { s[k] = next[k]; d = true; }
            }
            if (d && next.cash) {
                const stamp = `${next.cash}${next.income ? ' · 进项：' + next.income : ''}`;
                if (s.notes[0] !== stamp) {
                    s.notes.unshift(stamp);
                    if (s.notes.length > 6) s.notes.length = 6;
                }
            }
            return d;
        },

        act(s, action, payload) {
            if (action === 'note') {
                const txt = String((payload && payload.t) || '').trim();
                if (!txt) return;
                s.notes.unshift(`✍ ${txt}`);
                if (s.notes.length > 6) s.notes.length = 6;
                return '账本已记一笔';
            }
            if (action === 'clear') { s.notes = []; return '流水已清空'; }
        },

        html(s) {
            if (!s.cash && !s.income && !s.savings) {
                return WXH.empty('💰', '账本空白', '入场后 AI 按 (variable_update) 上报 cash/savings/income/expense，此处自动记账；货币单位随时代（铜钱/纹银/银元/法币/人民币…）');
            }
            const rows = [
                ['💸 随身现金', s.cash, 'in'],
                ['🏦 存款积蓄', s.savings, 'in'],
                ['📈 进项来源', s.income, ''],
                ['📉 近期支出', s.expense, 'out']
            ].filter(r => r[1]).map(r => `<div class="ledger-row"><span style="color:var(--imt,#9a8c6e);">${r[0]}</span><b class="ledger-${r[2] === 'out' ? 'out' : 'in'}" style="font-weight:500;">${WXH.esc(r[1])}</b></div>`).join('');
            const flow = s.notes.length
                ? WXH.card(`流水 · 最近 ${s.notes.length} 笔`, s.notes.map(n => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">${WXH.esc(n)}</b></div>`).join('') +
                    `<button class="wx-btn danger" style="margin-top:7px;" onclick="WorldExt.act('ledger','clear')">清空流水</button>`, { icon: '📒' })
                : '';
            return `${WXH.card('家底盘点', `<div class="era-calib-box">${rows}</div>`, { icon: '💰', grow: true })}
            ${flow}
            <div class="wx-slot">
                <input id="wxLedgerNote" placeholder="手记一笔（如：交了房租）" maxlength="24" style="flex:1;">
                <button class="wx-btn" onclick="WorldExt.act('ledger','note',{t:document.getElementById('wxLedgerNote').value})">＋ 记账</button>
            </div>
            <div class="wx-banner">经济真实是世界的一条腿：衣食住行按时代实价计算；钱花完就是花完，赊账要还、欠情要还；收入差距如实呈现——不粉饰，也不猎奇。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.cash) t.push(`随身现金「${s.cash}」——涉及花钱的行动先看钱够不够，不够就是不够`);
            if (s.income) t.push(`收入水准「${s.income}」——生计压力须与收入量级匹配（吃了上顿没下顿的人不从容）`);
            t.push('每笔收支都落到具体数目与货币单位，账本与正文金额一致；大项开支（房租/医药/盘缠）须在 expense 留痕');
            return t.join('；');
        }
    };

    /* ==================== ③ 时代校准 ==================== */
    const ERAS = [
        { key: 'prehistory', name: '史前蒙昧', sample: '约公元前1万年', tech: '石器骨器·火·口头传承', travel: '徒步·独木舟', media: '结绳·岩画', medicine: '草药经验·巫祝', society: '部族血缘·万物有灵' },
        { key: 'classical', name: '古典帝国', sample: '约公元前138年', tech: '青铜铁器·造纸雏形', travel: '驿马·漕运·商队', media: '竹简绢帛·口信', medicine: '医典方剂·坐堂', society: '编户齐民·律法初成' },
        { key: 'medieval', name: '中古流转', sample: '约公元800年', tech: '水力风磨·雕版印刷', travel: '驿路·海船', media: '抄本·市集传闻', medicine: '药铺汤剂·疗养', society: '庄园行会·信仰纲常' },
        { key: 'renaissance', name: '大航海文艺复兴', sample: '约公元1500年', tech: '活字印刷·火器罗盘', travel: '远洋帆船·马车', media: '印刷品·商埠信件', medicine: '解剖学兴起· quarantine', society: '行商布尔乔亚·旧邦新学' },
        { key: 'industrial', name: '蒸汽工业', sample: '约公元1860年', tech: '蒸汽机·铁路电报', travel: '火车轮船·电报订票', media: '日报·电讯', medicine: '近代医院·疫苗接种', society: '工厂城市·劳工阶层' },
        { key: 'modern', name: '电气现代', sample: '约公元1925年', tech: '电灯电话·汽车广播', travel: '汽车电车·航线铁路', media: '广播报纸·电影', medicine: '现代医院·西药成体系', society: '都市摩登·新旧交替' },
        { key: 'contemporary', name: '信息当下', sample: '约公元2020年代', tech: '互联网·智能手机·高铁', travel: '高铁航班·网约车', media: '全网即时·人人发声', medicine: '现代医疗体系·医保', society: '全球化·原子化个体' }
    ];

    function guessEraKey(eraStr) {
        const s = String(eraStr || '');
        const m = s.match(/-?\d{1,4}/g);
        if (m) {
            let y = Number(m[0]);
            let bc = /公元前|前\d|BC|B\.C\./i.test(s);
            if (bc) y = -y;
            if (y <= -8000) return 'prehistory';
            if (y <= 400) return 'classical';
            if (y <= 1300) return 'medieval';
            if (y <= 1650) return 'renaissance';
            if (y <= 1900) return 'industrial';
            if (y <= 1960) return 'modern';
            return 'contemporary';
        }
        if (/史前|蒙昧/.test(s)) return 'prehistory';
        if (/古典|秦汉|罗马|帝国时代/.test(s)) return 'classical';
        if (/中古|中世/.test(s)) return 'medieval';
        if (/大航海|文艺复兴/.test(s)) return 'renaissance';
        if (/蒸汽|工业/.test(s)) return 'industrial';
        if (/现代|摩登|民国/.test(s)) return 'modern';
        if (/当代|当下|信息/.test(s)) return 'contemporary';
        return '';
    }

    const eraCalibMod = {
        id: 'eracalib', icon: '⚖️', name: '时代校准',
        tip: '时代即边界——科技/交通/通讯/医疗/观念按年代划定，时代里没有的东西，任何角色都拿不出来',
        contract: null,

        read(s, vars) {
            const era = String(vars.era || vars.时代 || '');
            if (era && era !== s.era) { s.era = era; s.key = guessEraKey(era); return true; }
            return false;
        },

        /* v3.32.2 状态板摘要：🕰️ 时代段位上板 */
        summary(s) {
            if (!s.era) return [];
            const cur = ERAS.find(e => e.key === s.key);
            return [{ i: '🕰️', v: cur ? cur.name : s.era.slice(0, 8), l: '时代' }];
        },

        html(s) {
            const cur = ERAS.find(e => e.key === s.key);
            const ladder = WXH.card('时代阶梯', `<div class="wx-stepper">
                ${ERAS.map(e => `<div class="wx-step ${e.key === s.key ? 'on' : ''}" title="${e.sample}">${e.name}</div>`).join('')}
            </div>`, { icon: '🕰️', grow: true, tag: s.era || '未定' });

            if (!cur) {
                return `${ladder}
                <div class="wx-banner">入场后罗盘上报 era，此处自动标定时代段位；玩家自定义任意年份（如「1912年的哈尔滨」）同样适用——按年代就近归档校准。</div>`;
            }
            const dims = WXH.kv([
                ['🔧 科技', cur.tech],
                ['🚞 交通', cur.travel],
                ['📡 通讯', cur.media],
                ['🏥 医疗', cur.medicine],
                ['🏛️ 社会观念', cur.society],
                ['📐 年代样本', cur.sample]
            ]);
            return `${ladder}
            ${WXH.card(`「${cur.name}」校准表`, `<div class="era-calib-box">${dims}</div>`, { icon: '⚖️', grow: true, tag: 'AI 每轮自检' })}
            <div class="wx-banner">校准表是正文的隐形边界：写任何场景前先过一遍——这个年代有没有这东西？该多少钱？人怎么称呼它？时代错置（不属于该年代的事物、说法、观念）即重大违规；史实事件按真实时间线照常推进，宏观历史不因一人轻易改写。</div>`;
        },

        directive(s) {
            const cur = ERAS.find(e => e.key === s.key);
            if (!cur) return '时代校准：正文涉及的每件物品、每种说法、每个价格、每项制度都须与玩家所选年代相符，出现时代错置即违规';
            return `当前校准段位「${cur.name}」（约${cur.sample}）：科技=${cur.tech}；交通=${cur.travel}；通讯=${cur.media}；医疗=${cur.medicine}——正文一切存在物不得越出此边界；史实事件按真实时间线发生，玩家可听闻、目击、身处其中，但宏观历史不因一人轻易改写`;
        }
    };

    if (window.WorldExt) WorldExt.define('earth', [spacetimeMod, ledgerMod, eraCalibMod]);
})();
