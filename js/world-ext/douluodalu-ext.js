/**
 * 斗罗大陆 · 界专属扩展（v3.4.0）
 * 💍 魂环配装器——猎杀魂兽、按年限配色、观武魂成环路线；吸收仪式有年限压制与相性风险
 * 年限配色为原著铁律：十年白 · 百年黄 · 千年紫 · 万年黑 · 十万年红
 */
(function () {
    'use strict';

    const ringColor = (year) => year >= 100000 ? '#e05a5a'
        : year >= 10000 ? '#5a5a6e'
            : year >= 1000 ? '#9a6ad8'
                : year >= 100 ? '#d8c25a' : '#e8e4da';

    /* 各环位年限参考（原著惯例区间：年限越高压制越烈，须武魂相性与身体承受支撑） */
    const SLOT_REF = [
        '第一环：数十年~数百年为稳，越阶需极佳体质',
        '第二环：数百年为常，千年环已是豪赌',
        '第三环：千年上下为宜，万年环属传奇',
        '第四环：万年为常人极限之上，须底蕴支撑',
        '第五环及以后：万年以上逐环递增，环环皆是命关',
        '第六环以上：封号斗罗之资方敢奢谈'
    ];

    const ringMod = {
        id: 'soulring', icon: '💍', name: '魂环配装器',
        tip: '环色即年限：白十年 · 黄百年 · 紫千年 · 黑万年 · 红十万年',
        contract: '魂环[{年限,来源魂兽}]（已吸收之环）；吸收进行中（正在进行的猎杀/吸收仪式：目标魂兽与年限）',
        init: () => ({ rings: [], absorbing: '' }),

        /* v3.32.2 状态板摘要：💍 4环 ·最新：万年黑（吸收仪式进行中亮 warn） */
        summary(s) {
            if (!s.rings.length && !s.absorbing) return [];
            const last = s.rings[s.rings.length - 1];
            const label = last ? (last.year >= 10000 ? '万年黑' : last.year >= 1000 ? '千年紫' : last.year >= 100 ? '百年黄' : '十年白') : '';
            return [{ i: '💍', v: `${s.rings.length}环`, l: s.absorbing ? '吸收中' : label, tone: s.absorbing ? 'warn' : '' }];
        },

        parseRing(x) {
            if (typeof x === 'object' && x) {
                const year = Number(x.year || x.年限 || 0) || 0;
                return { year, beast: String(x.beast || x.来源 || x.来源魂兽 || x.name || '未知魂兽'), raw: x };
            }
            const s = String(x);
            const m = s.match(/(\d+)(万|千|百)?年/);
            let year = 0;
            if (m) year = Number(m[1]) * (m[2] === '万' ? 10000 : m[2] === '千' ? 1000 : m[2] === '百' ? 100 : 1);
            return { year, beast: s.replace(/[（(].*?[)）]/g, '').trim() || '未知魂兽', raw: x };
        },

        read(s, vars, round) {
            let d = false;
            const _rraw = vars.魂环 || vars.soulRings;
            if (!_rraw || typeof _rraw !== 'object' || Array.isArray(_rraw)) WXH.asArr(_rraw).forEach(x => {
                const r = this.parseRing(x);
                const key = `${r.year}|${r.beast}`;
                if (!s.rings.some(g => `${g.year}|${g.beast}` === key)) { s.rings.push({ ...r, round }); d = true; }
            });
            /* 对象形态：{ 一环:'百年XX', ... } */
            Object.entries(WXH.asObj(vars.魂环)).forEach(([k, v]) => {
                const r = this.parseRing(v);
                if (!s.rings.some(g => g.beast === r.beast && g.year === r.year)) { s.rings.push({ ...r, note: k, round }); d = true; }
            });
            const ab = vars.吸收进行中 || vars.吸收魂环进行中 || vars.吸收;
            if (ab != null && ab !== '' && String(ab) !== s.absorbing) { s.absorbing = String(ab); d = true; }
            if (s.rings.length > 9) s.rings.length = 9;
            return d;
        },

        html(s) {
            const slots = [];
            for (let i = 0; i < Math.max(6, s.rings.length + 1); i++) {
                const r = s.rings[i];
                slots.push(r
                    ? `<div class="wx-ring" style="background:${ringColor(r.year)};" title="${WXH.esc(r.beast)} ${r.year ? r.year + '年' : ''} · 第${r.round || '?'}回">${r.year >= 10000 ? (r.year / 10000) + '万' : r.year >= 1000 ? (r.year / 1000) + '千' : r.year >= 100 ? (r.year / 100) + '百' : r.year || '?'}</div>`
                    : `<div class="wx-ring ghost" title="第${i + 1}环空位">第${i + 1}环</div>`);
            }
            const nextIdx = s.rings.length;
            return `${WXH.card('已获魂环', `<div class="wx-rings">${slots.join('')}</div>`, { icon: '💍', tag: `${s.rings.length} / 9 环` })}
            ${s.rings.length ? WXH.card('环录', s.rings.map((r, i) => `<div class="wx-kv"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ringColor(r.year)};margin-right:5px;vertical-align:-1px;"></i>第${i + 1}环</span><b>${WXH.esc(r.beast)} · ${r.year ? r.year + ' 年' : '年限未知'} · 第${r.round || '?'}回入体</b></div>`).join(''), { icon: '📖' }) : ''}
            ${s.absorbing ? WXH.card('吸收仪式进行中', `<div class="wx-banner" style="border-color:#9a6ad888;background:#9a6ad812;">目标：${WXH.esc(s.absorbing)}<br>年限压制正在碾压肉身——撑过是环，撑不过是死。</div>`, { icon: '⚠️' }) : ''}
            ${WXH.card('下一环配装参考（原著惯例）', `<div class="wx-kv"><span>第 ${nextIdx + 1} 环</span><b>${WXH.esc(SLOT_REF[Math.min(nextIdx, SLOT_REF.length - 1)])}</b></div>`, { icon: '🧭' })}
            <div class="wx-banner">年限即压制：魂环年限远超自身境界时，吸收仪式就是渡劫——原著里没人靠侥幸连跳。环色配错可以废掉一条武魂路线，抉择前想想值不值。</div>`;
        },

        directive(s) {
            if (s.absorbing) return `魂环吸收进行中（${s.absorbing}）：本轮须写透年限压制与武魂相性——魂力冲刷、意志拉锯、魂兽残念反扑皆可入戏；超出承受年限的吸收有真实的反噬乃至殒身风险，不由玩家心愿豁免。`;
            if (s.rings.length) return `魂环在身（${s.rings.length} 环）：魂技发动以环为源，写战斗时点明动用的是哪一环之力；下一环的获取应循"猎杀→仪式→压制→抉择"的原著节奏，年限抉择要有真实的赌重。`;
            return '';
        }
    };

    if (window.WorldExt) WorldExt.define('douluodalu', [ringMod]);
})();
