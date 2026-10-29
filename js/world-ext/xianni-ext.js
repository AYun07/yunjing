/**
 * 仙逆 · 界专属扩展（v3.25.0）
 * ✵ 逆道长梯——凝气十五层数着走，四步之路（第一步九境→涅槃三境→空劫→踏天）一路登临；杀劫留痕
 * ☾ 心魔之镜——心魔侵蚀度与执念档案同盘追踪：狠辣喂心魔、隐忍攒道心、执念双刃
 */
(function () {
    'use strict';

    /* 原著四步之路阶梯：凝气→筑基→结丹→元婴→化神→婴变→问鼎→阴虚→阳实（第一步）
       →窥涅→净涅→碎涅（第二步涅槃三境）→空劫（第三步）→踏天（第四步） */
    const RANKS = ['凝气', '筑基', '结丹', '元婴', '化神', '婴变', '问鼎', '阴虚', '阳实', '窥涅', '净涅', '碎涅', '空劫', '踏天'];
    const STAGE = ['初期', '中期', '后期', '大圆满'];
    /* 中文数字（一至十五：凝气层数用） */
    function cnNum(str) {
        const CN = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
        if (!str) return 0;
        if (/^十$/.test(str)) return 10;
        if (/^十./.test(str)) return 10 + (CN[str[1]] || 0);
        if (/^.十/.test(str)) return (CN[str[0]] || 1) * 10 + (CN[str[2]] || 0);
        return CN[str] || 0;
    }
    /* 心魔分区（仙逆特色刻度：杀气与执念对道心的侵蚀） */
    const DEMON_ZONES = [
        { max: 30, label: '道心清明', color: '#8fb8a8' },
        { max: 60, label: '心魔蚀痕', color: '#c8a858' },
        { max: 85, label: '心魔低语', color: '#c87858' },
        { max: 100, label: '道心濒崩', color: '#d85868' }
    ];

    /* ==================== 模块一：逆道长梯 ==================== */
    const ladderMod = {
        id: 'ladder', icon: '✵', name: '逆道长梯 · 杀劫留痕',
        tip: '凝气十五层数着走，四步之路拾级而上——跨一步如换一界，第一步的绝世天才在第二步面前仍是蝼蚁；破境的每一步都伴杀劫',
        contract: '境界（当前境界含层数与期段，如「凝气五层」「筑基中期」「元婴后期」；境界跃升当轮务必更新）；灵石（当前灵石余额数字）；杀劫（近期遭遇的杀伐凶险一句话概要，如「藤家追杀令未消」）',
        init: () => ({ rank: -1, layer: 0, stage: '', stones: null, peril: '', log: [] }),

        /* v3.32.2 状态板摘要：✵ 筑基中期 ·杀劫在身 ·灵石900 */
        summary(s) {
            if (s.rank < 0 && s.stones == null && !s.peril) return [];
            const items = [];
            if (s.rank >= 0) {
                const sub = s.rank === 0 && s.layer ? `${s.layer}层` : (s.rank > 0 && s.stage ? s.stage : '');
                items.push({ i: '✵', v: RANKS[s.rank], l: sub });
            }
            if (s.peril) items.push({ i: '⚔', v: '杀劫', l: String(s.peril).slice(0, 8), tone: 'warn' });
            if (s.stones != null) items.push({ i: '◈', v: s.stones.toLocaleString(), l: '灵石' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.realm || vars.修为 || vars.status || '');
            /* 长名先匹配（自尾向头）：「婴变」须先于「元婴」试探、「阳实」先于「实」类干扰 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 凝气层数：「凝气十五层」→15；十五层圆满按15计 */
            const lm = raw.match(/([一二三四五六七八九十]{1,3})层/);
            const layer = lm ? cnNum(lm[1]) : 0;
            if (idx === 0 && layer !== s.layer) { s.layer = layer; d = true; }
            /* 期段 */
            let stage = '';
            for (const st of STAGE) { if (raw.indexOf(st) >= 0) { stage = st; break; } }
            if (stage !== s.stage) { s.stage = stage; d = true; }
            /* 灵石 */
            const stones = WXH.pick(vars, ['灵石', '灵石余额', '下品灵石']);
            if (stones != null) {
                const m = String(stones).match(/(\d{1,9})/);
                if (m) { const v = Number(m[1]); if (v !== s.stones) { s.stones = v; d = true; } }
            }
            /* 杀劫概要 */
            const peril = WXH.pick(vars, ['杀劫', '凶险', '追杀']);
            if (peril != null && String(peril) !== s.peril) { s.peril = String(peril).slice(0, 40); d = true; }
            /* 破境留痕（逆水行舟，一步一重天） */
            if (d && idx > (s._lastRank || -1)) {
                s.log.unshift(`第${round}回：${s._lastRank >= 0 ? RANKS[s._lastRank] : '凡人'} → ${RANKS[idx]}${idx > 0 && stage ? stage : idx === 0 && layer ? '·' + layer + '层' : ''}`);
                if (s.log.length > 6) s.log.length = 6;
            }
            s._lastRank = idx;
            return d;
        },

        html(s) {
            const cur = s.rank >= 0 ? RANKS[s.rank] + (s.rank === 0 && s.layer ? '·' + s.layer + '层' : (s.rank > 0 && s.stage ? s.stage : '')) : null;
            /* 四步分段渲染：第一行第一步九境（0-8），第二行涅槃三境+空劫+踏天（9-13） */
            const row1 = RANKS.slice(0, 9).map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('');
            const row2 = RANKS.slice(9).map((r, i) => `<div class="wx-step ${i + 9 === s.rank ? 'on' : i + 9 < s.rank ? 'done' : ''}">${i + 9 < s.rank ? '✓ ' : ''}${r}</div>`).join('');
            const ladder = WXH.card('逆道四步', `<div class="wx-stepper">${row1}</div>
                <div class="wx-stepper" style="margin-top:4px;">${row2}</div>`, {
                icon: '✵', grow: true, tag: cur ? `当前：${cur}` : '凡人·未启灵窍'
            });
            const stones = s.stones != null
                ? WXH.card('灵石', `<div class="wx-gauge-main"><b style="color:#e8c45c;font-size:18px;">◈ ${s.stones.toLocaleString()}</b><em style="color:#a89878;">穷字当头的硬通货</em></div>`, { icon: '◈', tag: '身家' })
                : WXH.empty('◈', '身无灵石', '坊市、鬼市、月例、杀令悬赏都是来钱路——为一枚灵石搏命的修士比比皆是，穷是散修的常态');
            const peril = s.peril ? WXH.card('当前杀劫', `<div class="wx-kv"><b style="font-weight:400;color:#e0a0a0;font-size:12.5px;">${WXH.esc(s.peril)}</b></div>`, { icon: '⚔', grow: true }) : '';
            const log = s.log.length ? WXH.card('破境留痕', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📈', grow: true }) : '';
            return `${ladder}${peril}${stones}${log}
            <div class="wx-banner">顺为凡，逆则仙：四步是天堑——跨一步如换一界；突破逆水行舟，资质不够者以寿元硬耗，心志不坚者困死瓶颈；破境常伴杀劫与心魔之劫，一步一重天，机缘必压着代价。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank >= 0) {
                t.push(`当前境界${RANKS[s.rank]}${s.rank === 0 && s.layer ? '第' + s.layer + '层' : (s.rank > 0 && s.stage ? s.stage : '')}：实力表现须贴合境界（凝气是吐纳入门的低阶修士，筑基可御器远行，结丹寿五百载，元婴可夺舍重生，化神已是人间巨擘），越阶硬撼必付代价`);
            } else {
                t.push('尚未踏入道途：只是一介凡人——测灵台的冷眼是这方天地给凡人的第一道秤');
            }
            if (s.peril) t.push(`当前杀劫「${s.peril}」：杀机未消，风头正紧——隐忍蛰伏还是以杀止杀，抉择写实`);
            if (s.stones != null) t.push(`灵石余额 ${s.stones.toLocaleString()}：修炼烧钱，入不敷出是常态剧情，横财背后常挂催命符`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：心魔之镜 ==================== */
    const demonMod = {
        id: 'demon', icon: '☾', name: '心魔之镜 · 执念簿',
        tip: '杀气与执念对道心的侵蚀——狠辣喂心魔、隐忍攒道心；执念是道心之根也是心魔之种，突破关口心魔高位必生变数',
        contract: '心魔（心魔侵蚀度 0-100 数值）；执念[]（重大誓愿与放不下的爱恨，如「为满门讨还血债」「寻复活慕婉之法」）；道心（道心定力的概况描述）',
        init: () => ({ demon: null, vows: [], dao: '', log: [] }),

        /* v3.32.2 状态板摘要：☾ 心魔 62 ·心魔蚀痕·执念2（濒崩亮红） */
        summary(s) {
            if (s.demon == null && !s.vows.length) return [];
            if (s.demon == null) return [{ i: '☾', v: `执念${s.vows.length}`, l: '心魔未测' }];
            const z = DEMON_ZONES.find(t => s.demon <= t.max) || DEMON_ZONES[DEMON_ZONES.length - 1];
            const tone = s.demon >= 85 ? 'bad' : s.demon >= 60 ? 'warn' : s.demon <= 30 ? 'ok' : '';
            return [{ i: '☾', v: String(s.demon), l: z.label + (s.vows.length ? `·执念${s.vows.length}` : ''), tone }];
        },

        read(s, vars, round) {
            let d = false;
            /* 心魔值：仪表盘 dashboard 或顶层变量皆可 */
            let dv = null;
            try {
                const db = vars.dashboard || vars.gauges || {};
                if (db.demon != null) dv = db.demon;
            } catch (e) { }
            if (dv == null) dv = WXH.pick(vars, ['心魔', '心魔值', '心魔侵蚀', 'demon']);
            if (dv != null) {
                const m = String(dv).match(/(\d{1,3})/);
                if (m) {
                    const v = Math.max(0, Math.min(100, Number(m[1])));
                    if (v !== s.demon) {
                        /* 阶跃留痕：跨区记录（清明→蚀痕→低语→濒崩） */
                        const zone = (n) => DEMON_ZONES.findIndex(z => n <= z.max);
                        if (s.demon != null && zone(v) > zone(s.demon)) {
                            s.log.unshift(`第${round}回：心魔升至「${DEMON_ZONES[zone(v)].label}」（${v}）`);
                            if (s.log.length > 6) s.log.length = 6;
                        }
                        s.demon = v; d = true;
                    }
                }
            }
            /* 执念档案：立下的誓愿与放不下的爱恨 */
            WXH.asArr(vars.执念 || vars.誓愿 || vars.牵挂).forEach(x => {
                const str = String(x).trim();
                if (str && !s.vows.some(v => v.text === str)) {
                    s.vows.unshift({ text: str, round });
                    d = true;
                }
            });
            if (s.vows.length > 8) s.vows.length = 8;
            /* 道心概况 */
            const dao = WXH.pick(vars, ['道心', '道心定力']);
            if (dao != null && String(dao) !== s.dao) { s.dao = String(dao).slice(0, 40); d = true; }
            return d;
        },

        html(s) {
            const gaugeHtml = s.demon != null
                ? (() => { const gg = WXH.gauge(s.demon, DEMON_ZONES); return `<div class="wx-gauge-main"><b style="color:${gg.zone.color};font-size:18px;">${s.demon}</b><em style="color:${gg.zone.color};">${gg.zone.label}</em></div>${gg.html}`; })()
                : '';
            const demonCard = s.demon != null
                ? WXH.card('心魔侵蚀', gaugeHtml, { icon: '☾', grow: true, tag: DEMON_ZONES.find(z => s.demon <= z.max).label })
                : WXH.empty('☾', '道心尚明', '杀伐与仇恨会累积心魔——狠辣喂心魔、隐忍攒道心、静修可回落；突破关口心魔愈重，劫愈凶');
            const vows = s.vows.length ? WXH.card(`执念簿 · ${s.vows.length}条`, s.vows.map(v => `<div class="wx-task">
                <b style="font-weight:500;flex:1;">${WXH.esc(v.text)}</b>
                <span class="st" style="color:var(--imt,#9a8c6e);">第${v.round}回立</span>
            </div>`).join(''), { icon: '🕯', grow: true }) : '';
            const dao = s.dao ? WXH.card('道心定力', `<div class="wx-kv"><b style="font-weight:400;font-size:12.5px;">${WXH.esc(s.dao)}</b></div>`, { icon: '⛰', grow: true }) : '';
            const log = s.log.length ? WXH.card('心魔暗涨录', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:#e0a0a0;">${WXH.esc(t)}</b></div>`).join(''), { icon: '📉', grow: true }) : '';
            return `${demonCard}${vows}${dao}${log}
            <div class="wx-banner">执念的两面：执念是道心之根——为血债、为故人、为挚爱立下的誓愿，是熬过万载苦修的火种；执念也是心魔之种——放不下的恨与爱，会在突破的关口反噬其身。心魔劫至之时，执念化作心相：或为故人面容、或为血仇旧景、或为大道之惑，一念之差即是道心崩毁、修为尽废——放下或背负都是路，无对错但有代价。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.demon != null) {
                const z = DEMON_ZONES.find(zz => s.demon <= zz.max);
                t.push(`心魔侵蚀 ${s.demon}/100（${z.label}）：${s.demon >= 61 ? '心魔已在低语——杀伐与仇恨会继续喂大它，静修、放下与了断才能真正回落；近期若有境界突破，心魔劫必生变数，执念会化作心相反噬' : '杀伐与仇恨会累积心魔，狠辣的每一步都在账上'}`);
            }
            if (s.vows.length) t.push(`执念簿 ${s.vows.length} 条（${s.vows.slice(0, 3).map(v => v.text).join('、')}）：情节推进执念、心魔消耗执念——写情节时围绕它称量，突破关口的幻境戏以执念为心相`);
            if (s.dao) t.push(`道心定力：${s.dao}——道心是熬过瓶颈与心魔劫的本钱，隐忍与苦修都在攒它`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('xianni', [ladderMod, demonMod]);
})();
