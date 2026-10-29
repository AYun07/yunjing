/**
 * 龙族 · 界专属扩展（v3.8.0）
 * 🐉 血统秘档与言灵刻印——血统评级拾级而上，血统越纯离人越远；言灵刻印记下每一次觉醒与它的代价
 */
(function () {
    'use strict';

    const RANKS = ['未觉醒', 'C级', 'B级', 'A级', 'S级'];

    const bloodMod = {
        id: 'bloodarchive', icon: '🐉', name: '血统秘档 · 言灵刻印',
        tip: '血统评级拾级而上——C/B/A/S，纯度即力量也即诅咒；言灵刻印：每一次觉醒都记下它的代价',
        contract: '血统评级（未觉醒/C级/B级/A级/S级）；血统同调（0-100，血统与自我的平衡度，越低越危险）；言灵（已觉醒言灵的名称与编号记录）',
        init: () => ({ rank: 0, sync: 70, words: [] }),

        /* v3.32.2 状态板摘要：🐉 B级 ·同调38% ·言灵2（同调失衡亮警色） */
        summary(s) {
            const tone = s.sync >= 60 ? 'ok' : s.sync >= 30 ? 'warn' : 'bad';
            const l = [
                `同调${s.sync}%`,
                s.words.length ? `言灵${s.words.length}` : ''
            ].filter(Boolean).join('·');
            return [{ i: '🐉', v: RANKS[s.rank], l, tone }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.血统 || vars.血统评级 || WXH.asObj(vars.境界).血统 || vars.境界 || vars.status || '');
            const idx = RANKS.findIndex(r => raw.includes(r));
            if (idx > s.rank) { s.rank = idx; d = true; }
            else if (idx >= 0 && idx !== s.rank) { s.rank = idx; d = true; }
            const sync = WXH.pick(vars, ['血统同调', '同调度', '血统稳定度']);
            if (sync != null) {
                const m = String(sync).match(/(\d{1,3})/);
                if (m) { const v = Math.min(100, Number(m[1])); if (v !== s.sync) { s.sync = v; d = true; } }
            }
            WXH.asArr(vars.言灵 || vars.已觉醒言灵).forEach(x => {
                const str = String(x);
                if (str && !s.words.some(t => t === str)) { s.words.unshift(str); d = true; }
            });
            if (s.words.length > 6) s.words.length = 6;
            return d;
        },

        html(s) {
            const ladder = WXH.card('血统评级', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🩸', grow: true, tag: '当前：' + RANKS[s.rank]
            });
            const syncColor = s.sync >= 60 ? '#8a9ae8' : s.sync >= 30 ? '#e0a84c' : '#e07070';
            const syncWord = s.sync >= 60 ? '稳定' : s.sync >= 30 ? '失衡边缘' : '濒临失控';
            const sync = WXH.card(`血统同调 · ${s.sync}%（${syncWord}）`, `
                <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${s.sync}%;background:${syncColor};"></i></div><b style="color:${syncColor};">${syncWord}</b></div>
                <div style="margin-top:6px;font-size:11.5px;color:#8a86a8;">同调走低时：瞳色异常、体温变化、龙化冲动——离"人"越来越远</div>`,
                { icon: '⚖️', grow: true });
            const words = s.words.length ? WXH.card(`言灵刻印 · ${s.words.length}枚`, `${s.words.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">🔱 ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '🗣️', grow: true }) : '';
            return `${ladder}${sync}${words}
            <div class="wx-banner">血统是力量也是枷锁：评级跃升从来不是白拿的——测试、任务、家族期待与血统深处的低语一起到账；同调度过低时，血统的反噬会先于敌人的刀到来；言灵觉醒必有代价，刻印之下每一枚都是一段往事。</div>`;
        },

        directive(s) {
            const t = [];
            t.push(`血统评级${RANKS[s.rank]}：力量表现须贴合评级（C级靠训练与装备，S级言灵足以改写战局），越级硬撼必付代价`);
            if (s.sync < 60) t.push(`血统同调 ${s.sync}%${s.sync < 30 ? '（濒临失控）' : '（失衡边缘）'}：行文须体现血统低语与人性拉扯——瞳色异变、冲动、梦魇；同调修复需要情感锚点或意志支撑，不是睡一觉就好`);
            if (s.words.length) t.push(`已觉醒言灵 ${s.words.length} 枚（${s.words.join('、')}）：言灵发动写"声音、温度、空气的变形"而非招式说明，动用有代价`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('longzu', [bloodMod]);
})();
