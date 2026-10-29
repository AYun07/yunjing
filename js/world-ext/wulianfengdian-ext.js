/**
 * 武炼巅峰 · 界专属扩展（v3.19.0）
 * ⚔ 武道阶梯——淬体起步、开天封顶的十四境长征；功法武技与灵石身家同盘追踪
 */
(function () {
    'use strict';

    /* 原著境界阶梯：淬体→开元→气动→离合→真元→神游→超凡→入圣→圣王→返虚→虚王→道源→帝尊→开天 */
    const RANKS = ['淬体境', '开元境', '气动境', '离合境', '真元境', '神游境', '超凡境', '入圣境', '圣王境', '返虚境', '虚王境', '道源境', '帝尊境', '开天境'];
    const ATTRS = [
        { k: '力量', c: '#e05848' }, { k: '体魄', c: '#e8a04c' }, { k: '根骨', c: '#a8d88f' },
        { k: '悟性', c: '#5fb8d8' }, { k: '心志', c: '#c8a878' }, { k: '气运', c: '#b890f0' }
    ];
    const CN_NUM = '零一二三四五六七八九';

    const martialMod = {
        id: 'martial', icon: '⚔', name: '武道阶梯 · 功法行囊',
        tip: '十四境武路拾级而上——淬体起步、开天封顶；功法武技与灵石身家一屏追踪，越阶挑战必付代价',
        contract: '境界（当前境界含层数，如「淬体境五层」「真元境三层」）；灵石（当前余额数字）；功法[]（已掌握功法与武技清单，标注品阶更佳）；资质{力量,体魄,根骨,悟性,心志,气运}（六维资质数值）',
        init: () => ({ rank: -1, layer: 0, stones: null, arts: [], attrs: {} }),

        /* v3.32.2 状态板摘要：⚔ 淬体境5层 ·灵石1200 */
        summary(s) {
            if (s.rank < 0 && s.stones == null && !s.arts.length) return [];
            const items = [];
            if (s.rank >= 0) items.push({ i: '⚔', v: RANKS[s.rank], l: s.layer ? `${s.layer}层` : (s.arts.length ? `功法${s.arts.length}` : '') });
            if (s.stones != null) items.push({ i: '◈', v: s.stones.toLocaleString(), l: '灵石' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.realm || vars.status || '');
            /* 长名先匹配：道源/虚王/圣王等同尾字境界须按序试探，避免子串误判 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 层数解析：「淬体境五层」→5；九层圆满按9计 */
            const lm = raw.match(/([一二三四五六七八九])层/);
            const layer = lm ? CN_NUM.indexOf(lm[1]) : (/九层|圆满/.test(raw) ? 9 : 0);
            if (idx >= 0 && layer !== s.layer) { s.layer = layer; d = true; }
            const stones = WXH.pick(vars, ['灵石', '灵石余额']);
            if (stones != null) {
                const m = String(stones).match(/(\d{1,9})/);
                if (m) { const v = Number(m[1]); if (v !== s.stones) { s.stones = v; d = true; } }
            }
            WXH.asArr(vars.功法 || vars.已掌握功法 || vars.武技).forEach(x => {
                const str = String(x).trim();
                if (str && !s.arts.includes(str)) { s.arts.unshift(str); d = true; }
            });
            if (s.arts.length > 12) s.arts.length = 12;
            const a = WXH.asObj(vars.资质 || vars.属性);
            for (const { k } of ATTRS) {
                if (a[k] != null) {
                    const n = Number(a[k]) || 0;
                    if (n !== (s.attrs[k] || 0)) { s.attrs[k] = n; d = true; }
                }
            }
            return d;
        },

        html(s) {
            const cur = s.rank >= 0 ? RANKS[s.rank] : null;
            const ladder = WXH.card('武道阶梯', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '⚔', grow: true, tag: cur ? `当前：${cur}${s.layer ? '·' + s.layer + '层' : ''}` : '未入门'
            });
            const attrRows = ATTRS.filter(a => s.attrs[a.k] != null);
            const attrs = attrRows.length ? WXH.card('武道资质', `
                <div class="wx-kvs">${attrRows.map(a => `<div class="wx-kv"><span>${a.k}</span><b style="color:${a.c};">${WXH.esc(s.attrs[a.k])}</b></div>`).join('')}</div>`,
                { icon: '📊', tag: '六维' }) : '';
            const stones = s.stones != null
                ? WXH.card('灵石', `<div class="wx-gauge-main"><b style="color:#e8c45c;font-size:18px;">◈ ${s.stones.toLocaleString()}</b><em style="color:#a89878;">武道硬通货</em></div>`, { icon: '◈', tag: '身家' })
                : WXH.empty('◈', '行囊里还没有灵石', '坊市讨生活、宗门月例、镖银与缴获变卖都是来钱路——武道一途，处处要钱');
            const arts = s.arts.length ? WXH.card(`功法武技 · ${s.arts.length}项`, `${s.arts.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">✦ ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '✦', grow: true }) : '';
            return `${ladder}${attrs}${stones}${arts}
            <div class="wx-banner">武路无捷径：淬体打熬筋骨、开元引气入体，一步一层都是苦功喂出来的；功法武技越阶动用必反噬，根骨悟性差半分，突破就多熬三年；坊市规矩是拳头大的说了算，灵石永远不够花——先买保命的丹药，再买变强的功法。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank >= 0) {
                t.push(`当前境界${RANKS[s.rank]}${s.layer ? '第' + s.layer + '层' : ''}：实力表现须贴合境界（淬体境是打熬筋骨的凡俗武者，神游境可神识离体御空，帝尊境是一方大能），越阶硬撼必付代价`);
            } else {
                t.push('尚未踏入武道门槛：只是懂些拳脚的普通人，遇上淬体境武者都得绕着走');
            }
            if (s.stones != null) t.push(`灵石余额 ${s.stones.toLocaleString()}：丹药、功法与器械样样要钱，钱紧时写取舍`);
            if (s.arts.length) t.push(`功法武技 ${s.arts.length} 项（${s.arts.slice(0, 4).join('、')}）：动用写实效与代价，不写成招式播报`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('wulianfengdian', [martialMod]);
})();
