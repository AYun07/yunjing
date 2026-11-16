/**
 * 全职法师 · 界专属扩展（v3.15.0）
 * ✨ 星辰法典与元素圣徽——法师等阶拾级而上，每一级都是苦修与生死换来的质变；元素圣徽记下每一次觉醒与它的星辉
 */
(function () {
    'use strict';

    const RANKS = ['魔法学徒', '初级魔法师', '中级魔法师', '高级魔法师', '超级法师', '禁咒法师'];
    /* 元素系别色徽（展示用，按系上色） */
    const ELEMENT_HUE = {
        '火': '#e07040', '雷': '#a88af0', '冰': '#7fc0e8', '风': '#8fd8a8', '土': '#c8a468',
        '光': '#f0e0a0', '暗影': '#8a7ab0', '空间': '#9d9df0', '召唤': '#e8c060', '心灵': '#e8a0b8',
        '植物': '#78c878', '毒': '#a0c058', '混沌': '#c090c8', '音': '#88c8d8', '水': '#68a8e8'
    };

    const starMod = {
        id: 'starcodex', icon: '✨', name: '星辰法典 · 元素圣徽',
        tip: '法师等阶拾级而上——学徒到禁咒，每一级都是质变；元素圣徽：每一次觉醒都记下它的星辉',
        contract: '法师等阶（魔法学徒/初级/中级/高级/超级/禁咒）；星辉充沛（0-100，精神与星力的续航状态，越低施法越险）；元素（已觉醒元素系别记录）',
        init: () => ({ rank: 0, star: 70, elements: [] }),

        /* v3.32.2 状态板摘要：✨ 中级魔法师 ·星辉62 ·双系（星辉见底亮警色） */
        summary(s) {
            const tone = s.star >= 60 ? 'ok' : s.star >= 30 ? 'warn' : 'bad';
            const l = [s.elements.length ? `${s.elements.join('·')}系` : '', `星辉${s.star}`].filter(Boolean).join('·');
            return [{ i: '✨', v: RANKS[s.rank], l, tone }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.法师等阶 || vars.等阶 || vars.境界 || vars.status || '');
            const idx = RANKS.findIndex(r => raw.includes(r));
            if (idx >= 0 && idx !== s.rank) { s.rank = idx; d = true; }
            const star = WXH.pick(vars, ['星辉充沛', '星力状态', '星辉状态']);
            if (star != null) {
                const m = String(star).match(/(\d{1,3})/);
                if (m) { const v = Math.min(100, Number(m[1])); if (v !== s.star) { s.star = v; d = true; } }
            }
            WXH.asArr(vars.元素 || vars.已觉醒元素 || vars.觉醒元素).forEach(x => {
                const str = String(x);
                if (str && !s.elements.some(t => t === str)) { s.elements.unshift(str); d = true; }
            });
            if (s.elements.length > 5) s.elements.length = 5;
            return d;
        },

        html(s) {
            const ladder = WXH.card('法师等阶', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🔮', grow: true, tag: '当前：' + RANKS[s.rank]
            });
            const starColor = s.star >= 60 ? '#9d8cf0' : s.star >= 30 ? '#e0a84c' : '#e07070';
            const starWord = s.star >= 60 ? '充沛' : s.star >= 30 ? '见底' : '枯竭';
            const star = WXH.card(`星辉充沛 · ${s.star}%（${starWord}）`, `
                <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${s.star}%;background:${starColor};"></i></div><b style="color:${starColor};">${starWord}</b></div>
                <div style="margin-top:6px;font-size:11.5px;color:#8a86a8;">星辉走低时：法术哑火、精神透支、越级施术的反噬会先一步到——收手比逞强更需要勇气</div>`,
                { icon: '⚡', grow: true });
            const elems = s.elements.length ? WXH.card(`元素圣徽 · ${s.elements.length}枚`, `${s.elements.map(t => {
                const hue = ELEMENT_HUE[String(t).replace(/系$/, '').charAt(0)] || '#9d8cf0';
                return `<div class="wx-kv"><b style="font-weight:400;font-size:12px;color:${hue};">✦ ${WXH.esc(t)}</b></div>`;
            }).join('')}`, { icon: '🌠', grow: true }) : '';
            return `${ladder}${star}${elems}
            <div class="wx-banner">等阶是质变不是数值：学徒到初级隔着一道星轨的门，中级到高级隔着生死；双系觉醒者百年难遇——荣耀与杀机一起到账；星辉见底还硬撑着放最后一级法术的人，很多都没有等到救援。</div>`;
        },

        directive(s) {
            const t = [];
            t.push(`法师等阶${RANKS[s.rank]}：法术表现须贴合等阶（学徒放不出成形法术，禁咒法师一击可改写战局），越级施术必付代价`);
            if (s.star < 60) t.push(`星辉充沛 ${s.star}%${s.star < 30 ? '（枯竭）' : '（见底）'}：行文须体现精神透支的实感——指尖发麻、视野发暗、法术哑火；恢复需要休息与补给，不是喘口气就好`);
            if (s.elements.length) t.push(`已觉醒元素 ${s.elements.length} 系（${s.elements.join('、')}）：法术战斗写声光与空气的形变而非招式说明，连续施放消耗星辉`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('quanzhifashi', [starMod]);
})();
