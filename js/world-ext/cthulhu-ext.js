/**
 * 克苏鲁 · 界专属扩展（v3.4.0）
 * 🌌 SAN 疯狂表与禁书书架——理智跌破阈值叙述随之失控；禁忌之书予人神话知识，也削人的理智
 */
(function () {
    'use strict';

    const SAN_ZONES = [
        { max: 19, label: '疯狂边缘', color: '#b56ad8' },
        { max: 39, label: '临时疯狂', color: '#d86a8a' },
        { max: 69, label: '理智动摇', color: '#e0a04c' },
        { max: 100, label: '神智稳定', color: '#8fb8d9' }
    ];

    const sanMod = {
        id: 'san', icon: '🌌', name: 'SAN 疯狂表 · 禁书书架',
        tip: '知道的越多，离人越远——神话知识以理智为价',
        contract: 'SAN 或 理智（0-100：0=彻底疯狂）；克苏鲁神话或神话知识（0-100：对禁忌真相的了解）；禁书[{名称,代价}]（研读过的禁忌典籍）',
        init: () => ({ san: 55, myth: 0, tomes: [] }),

        /* v3.32.2 状态板摘要：🌌 SAN 55 ·神话20·禁书2（低理智亮警色） */
        summary(s) {
            const tone = s.san <= 19 ? 'bad' : s.san <= 39 ? 'warn' : 'ok';
            const l = [`神话${s.myth}`, s.tomes.length ? `禁书${s.tomes.length}` : ''].filter(Boolean).join('·');
            return [{ i: '🌌', v: String(s.san), l, tone }];
        },

        read(s, vars, round) {
            let d = false;
            const sv = WXH.pick(vars, ['SAN', 'san', '理智', '理智值']);
            if (sv != null) { const n = WXH.asNum(sv, s.san); if (n !== s.san) { s.san = n; d = true; } }
            const mv = WXH.pick(vars, ['克苏鲁神话', '神话知识', 'mythos']);
            if (mv != null) { const n = WXH.asNum(mv, s.myth); if (n !== s.myth) { s.myth = n; d = true; } }
            const _traw = vars.禁书 || vars.书架;
            if (!_traw || typeof _traw !== 'object' || Array.isArray(_traw)) WXH.asArr(_traw).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.tomes.some(t => t.name === nm)) { s.tomes.push({ name: nm, round }); d = true; }
            });
            Object.entries(WXH.asObj(vars.禁书)).forEach(([k, v]) => {
                if (!s.tomes.some(t => t.name === k)) { s.tomes.push({ name: k, cost: String(v).slice(0, 30), round }); d = true; }
            });
            if (s.tomes.length > 20) s.tomes.length = 20;
            return d;
        },

        html(s) {
            const g = WXH.gauge(s.san, SAN_ZONES);
            const myth = WXH.gauge(s.myth, [
                { max: 19, label: '一无所知', color: '#9a8c6e' },
                { max: 49, label: '窥见帷幕', color: '#c8c06a' },
                { max: 79, label: '禁忌学者', color: '#d86a8a' },
                { max: 100, label: '真相在握', color: '#b56ad8' }
            ]);
            const LORE = {
                '疯狂边缘': '现实在你的叙述里已经不可靠——名字会换、时间会折、门后站着的是谁取决于谁在读这段话',
                '临时疯狂': '恐惧漫过堤坝：幻听、癔症、短暂的失忆——发作过后，你对世界的账本少了一页',
                '理智动摇': '你开始怀疑自己的感官——还好，只是开始',
                '神智稳定': '一切都还正常——而"正常"正是深渊最好的伪装'
            }[g.zone.label];
            return `${WXH.card('理智 SAN', g.html + `<div class="wx-banner" style="margin-top:9px;"><b style="color:${g.zone.color};">${g.zone.label}</b>——${WXH.esc(LORE)}</div>`, { icon: '🌌', grow: true, tag: g.zone.label })}
            ${WXH.card('克苏鲁神话知识', myth.html, { icon: '📚', tag: myth.zone.label })}
            ${s.tomes.length ? WXH.card('禁书书架', s.tomes.map(t => `<div class="wx-kv"><span>第${t.round || '?'}回</span><b>${WXH.esc(t.name)}${t.cost ? ` <i style="font-style:normal;opacity:.6;font-size:11px;">代价：${WXH.esc(t.cost)}</i>` : ''}</b></div>`).join(''), { icon: '📖' }) : ''}
            <div class="wx-banner">知识即代价：每读懂一页禁忌，神话知识涨一分、理智跌一分——这是单向的门。读过的东西会改变你看世界的方式：正常的街景开始显出几何学上的错误。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.san <= 19) t.push(`SAN${s.san}·疯狂边缘：叙述应滑向不可靠——感官失真、时序错乱、人称游移，但线索依旧公平埋设（读者能拼出真相，角色拼不出）；疯狂发作须有触发物`);
            else if (s.san <= 39) t.push(`SAN${s.san}·临时疯狂：本轮可安排一次疯狂的显影（癔症性失忆/恐惧固着/歇斯底里），发作有触发、有余波`);
            if (s.myth >= 50) t.push(`神话知识${s.myth}：玩家已能认出部分征兆（符号、咒音、几何错误）——认出即加分也即扣SAN，知道的人不再是无辜者`);
            return t.join('；') || '';
        }
    };

    if (window.WorldExt) WorldExt.define('cthulhu', [sanMod]);
})();
