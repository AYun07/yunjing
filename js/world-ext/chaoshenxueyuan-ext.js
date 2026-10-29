/**
 * 超神学院 · 界专属扩展（v3.37.0）
 * 🧬 基因阶梯·军功簿——凡人之躯到三代超级战士拾级而上，军衔与战功同盘追踪
 * 👼 守护天使·阵营罗盘——契约天使（若有）与阵营立场的实时罗盘
 */
(function () {
    'use strict';

    /* 原著基因阶梯：凡人之躯 → 一代超级战士（免疫常规热武器）→ 二代超级战士（特殊能力，寿逾千年）
       → 三代超级战士·准神（神体，可自称神）；其上是凯莎式的神圣之躯（原著天花板，玩家不可企及） */
    const RANKS = ['凡人之躯', '一代超级战士', '二代超级战士', '三代超级战士·准神'];

    /* ==================== 模块一：基因阶梯·军功簿 ==================== */
    const geneMod = {
        id: 'gene', icon: '🧬', name: '基因阶梯 · 军功簿',
        tip: '超级基因一级一级觉醒——免疫枪弹是一代，特殊能力是二代，神体是三代；军衔与战功同册记功',
        contract: '基因觉醒（当前等阶，注明系别如「二代·狙击专精」）；军衔（当前军衔）；战功（累计战功值整数）；编制（所属部队）',
        init: () => ({ rank: 0, apt: '', rankTitle: '', honors: 0, unit: '', log: [] }),

        /* v3.37.0 状态板摘要：🧬 二代超级战士 ·战功320 */
        summary(s) {
            if (s.rank <= 0 && !s.honors) return [];
            const items = [];
            if (s.rank > 0) items.push({ i: '🧬', v: RANKS[s.rank], l: s.apt || '' });
            if (s.honors) items.push({ i: '🎖', v: `战功${s.honors}`, l: s.unit || '' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            /* 基因等阶：从 status/realm/基因觉醒 等候选键解析（长名先匹配，避免「一代」误吞「二代」） */
            const raw = String(WXH.pick(vars, ['基因觉醒', '基因等阶', 'realm', 'status']) || '');
            let idx = -1;
            const PAT = [/三代|准神/, /二代/, /一代/];
            for (let i = 0; i < PAT.length; i++) {
                if (PAT[i].test(raw)) { idx = i + 1; break; }
            }
            if (raw.indexOf('凡人之躯') >= 0) idx = 0;
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 等阶全名（如「二代·狙击专精」） */
            const rt = raw.match(/([一二三]代超级战士(?:·准神)?)[·•:：]?\s*([^\s，。；]{0,10})/);
            if (rt) {
                const full = rt[2] ? `${rt[1]}·${rt[2]}` : rt[1];
                if (full !== s.rankTitle) { s.rankTitle = full; s.apt = rt[2] || s.apt; d = true; }
            }
            /* 战功 */
            const honors = WXH.pick(vars, ['战功', '战功值', '功勋']);
            if (honors != null) {
                const m = String(honors).match(/-?\d{1,6}/);
                if (m) { const n = Number(m[0]); if (n !== s.honors) { s.honors = n; d = true; } }
            }
            /* 军衔与编制 */
            const rankM = String(WXH.pick(vars, ['军衔', '军阶']) || '');
            if (rankM && rankM !== s._rankLast) { s._rankLast = rankM; d = true; }
            const unit = String(WXH.pick(vars, ['编制', '所属部队', '部队']) || '');
            if (unit && unit !== s.unit) { s.unit = unit; d = true; }
            /* 跃升留痕 */
            if (d && idx > (s._lastRank || 0)) {
                s.log.unshift(`第${round}回：${RANKS[s._lastRank || 0]} → ${RANKS[idx]}`);
                if (s.log.length > 6) s.log.length = 6;
            }
            s._lastRank = idx;
            return d;
        },

        html(s) {
            const cur = s.rank > 0 ? RANKS[s.rank] : null;
            const ladder = WXH.card('基因阶梯', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i > 0 && i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🧬', grow: true, tag: s.rankTitle || (cur ? cur : '未觉醒')
            });
            const mil = WXH.card('军功簿', WXH.kv([
                ['军衔', s._rankLast || '—'],
                ['编制', s.unit || '—'],
                ['战功', s.honors ? String(s.honors) : '—']
            ]), { icon: '🎖', grow: true, tag: '地球防卫军' });
            const log = s.log.length ? WXH.card('觉醒录', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📈', grow: true }) : '';
            return `${ladder}${mil}${log}
            <div class="wx-banner">基因即位阶：一代免疫枪弹，二代各怀异禀，三代可自称神——但台阶要一级一级上；每一级都有排异期、代价与战绩撑腰，不写在军功簿上的觉醒不算数。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank > 0) {
                t.push(`当前${RANKS[s.rank]}${s.apt ? '（' + s.apt + '）' : ''}：基因能力可用，但战力须按原著代际逻辑如实呈现——越级硬撼神体级的对手（凯莎/华烨级）必付代价`);
            } else {
                t.push('凡人之躯：直面饕餮与恶魔只能靠战术、火力与跑位——活着才有下一轮');
            }
            if (s.honors) t.push(`战功 ${s.honors}：军衔晋升与装备优先权的依据，晋升须有战功与事件双支撑`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：守护天使·阵营罗盘 ==================== */
    const guardMod = {
        id: 'guardian', icon: '👼', name: '守护天使 · 阵营罗盘',
        tip: '天使的契约不由人强求——诸神注视下，你站在哪边，哪边就多一分重量',
        contract: '守护天使（契约天使名，无则不上报；按原著逻辑须天使主动缔结）；阵营立场（天使/恶魔/地球军/中立）；战友[]（并肩作战过的袍泽）',
        init: () => ({ angel: '', camp: '', mates: [] }),

        /* v3.37.0 状态板摘要：👼 契约·炙心 ·地球军 */
        summary(s) {
            if (!s.angel && !s.camp) return [];
            return [{
                i: '👼', v: s.angel ? `契约·${s.angel}` : '无契约',
                l: s.camp || '',
                tone: s.angel ? '' : ''
            }];
        },

        read(s, vars, round) {
            let d = false;
            /* 守护天使契约（按原著：天使主动缔结，AI 决定；玩家不可强求） */
            const angel = String(WXH.pick(vars, ['守护天使', '契约天使']) || '').trim();
            if (angel && angel !== s.angel && angel !== '无' && angel !== '—') { s.angel = angel; d = true; }
            /* 阵营立场 */
            const camp = String(WXH.pick(vars, ['阵营立场', '阵营', '立场']) || '').trim();
            if (camp && camp !== s.camp && camp.length <= 8) { s.camp = camp; d = true; }
            /* 战友名单 */
            WXH.asArr(WXH.pick(vars, ['战友', '并肩战友', '袍泽'])).forEach(x => {
                const name = String(x).slice(0, 12);
                if (name && !s.mates.some(m => m.name === name)) {
                    s.mates.unshift({ name, round });
                    d = true;
                }
            });
            if (s.mates.length > 12) s.mates.length = 12;
            return d;
        },

        html(s) {
            const angelCard = s.angel
                ? WXH.card('守护天使契约', `<div class="wx-gauge-main"><b style="color:#f4e0b8;font-size:17px;">👼 ${WXH.esc(s.angel)}</b><em style="color:#b0a48c;">圣光与你同在</em></div>`, { icon: '👼', tag: '契约在身' })
                : WXH.empty('👼', '尚无守护天使', '按原著逻辑，契约须天使主动缔结——凯莎的正义秩序不会无缘无故眷顾谁；用行动赢得注视');
            const campCard = s.camp
                ? WXH.card('阵营罗盘', `<div class="wx-gauge-main"><b style="color:#e8c478;font-size:16px;">${WXH.esc(s.camp)}</b><em style="color:#b0a48c;">立场即命运</em></div>`, { icon: '🧭', tag: '当前立场' })
                : WXH.empty('🧭', '立场未明', '天使的秩序、恶魔的自由、地球的钢铁、虚空的恐惧——站哪边，什么时候站，都是剧情的重量级抉择');
            const mates = s.mates.length ? WXH.card(`并肩战友 · ${s.mates.length}人`, s.mates.map(m => `<div class="wx-kv"><b>${WXH.esc(m.name)}</b><span style="font-size:11px;color:var(--imt,#9a8c6e);">第${m.round}回并肩</span></div>`).join(''), { icon: '🎖', grow: true }) : '';
            return `${angelCard}${campCard}${mates}
            <div class="wx-banner">文明的牌桌上没有中立的安全区：凯莎陨落、莫甘娜化魔、卡尔的虚空理论——每个阵营都有它的账单；契约与立场，改的不是一个标签，是此后每一轮的际遇。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.angel) t.push(`守护天使契约（${s.angel}）在身：天使方的资源与庇护按契约逻辑兑现，但契约不是无敌护身符——原著里契约天使也会陨落`);
            if (s.camp) t.push(`阵营立场「${s.camp}」：对应阵营的人物接触、资源与敌意按此展开，立场摇摆本身也是剧情`);
            if (s.mates.length) t.push(`并肩战友 ${s.mates.length} 人（${s.mates.slice(0, 3).map(m => m.name).join('、')}）：袍泽的生死与信任须随剧情如实演进，不许工具人化`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('chaoshenxueyuan', [geneMod, guardMod]);
})();
