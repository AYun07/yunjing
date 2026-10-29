/**
 * 武侠 · 界专属扩展（v3.4.0）
 * ⚔ 江湖声望谱与兵器谱——名门/魔教/朝廷/绿林/百姓五路声望此消彼长；兵器谱排名以实绩爬升
 */
(function () {
    'use strict';

    const AXES = [
        { key: '名门正派', icon: '🏯', color: '#8fb8d9' },
        { key: '魔教', icon: '🌙', color: '#c9584a' },
        { key: '朝廷', icon: '👑', color: '#d8c25a' },
        { key: '绿林', icon: '🗡', color: '#8fd9a8' },
        { key: '百姓', icon: '🏮', color: '#e0a04c' }
    ];

    const repMod = {
        id: 'jianghu', icon: '⚔', name: '江湖声望谱 · 兵器谱',
        tip: '江湖不是铁板一块——五路声望各记各的账；兵器谱排名，以命换',
        contract: '声望{名门正派,魔教,朝廷,绿林,百姓}（各 0-100）；兵器谱排名（百晓生兵器谱上的位次，无名则空）',
        init: () => ({ rep: {}, weapon: '' }),

        /* v3.32.2 状态板摘要：⚔ 名门72·魔教31 ·兵器谱第3（五路最高最低各取一路） */
        summary(s) {
            const known = AXES.filter(a => s.rep[a.key] != null);
            if (!known.length && !s.weapon) return [];
            const items = [];
            if (known.length) {
                const hi = known.reduce((a, b) => s.rep[a.key] >= s.rep[b.key] ? a : b);
                const lo = known.reduce((a, b) => s.rep[a.key] <= s.rep[b.key] ? a : b);
                const tone = s.rep[hi.key] >= 75 ? 'ok' : s.rep[lo.key] <= 25 ? 'bad' : '';
                items.push({
                    i: '⚔', v: `${hi.icon}${s.rep[hi.key]}`,
                    l: known.length > 1 ? `${lo.icon}${s.rep[lo.key]}` : hi.key, tone
                });
            }
            if (s.weapon) items.push({ i: '🗡', v: s.weapon, l: '兵器谱' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const rv = WXH.asObj(vars.声望 || vars.江湖声望);
            AXES.forEach(a => {
                const v = rv[a.key] != null ? rv[a.key] : (vars[a.key] != null ? vars[a.key] : null);
                if (v != null) { const n = WXH.asNum(v, 50); if (n !== (s.rep[a.key] == null ? 50 : s.rep[a.key])) { s.rep[a.key] = n; d = true; } }
            });
            const w = vars.兵器谱排名 || vars.兵器谱 || WXH.asObj(vars.兵器).排名;
            if (w != null && w !== '' && String(w) !== s.weapon) { s.weapon = String(w); d = true; }
            return d;
        },

        html(s) {
            const has = AXES.some(a => s.rep[a.key] != null);
            const repCard = has
                ? WXH.card('五路声望', AXES.map(a => {
                    const v = s.rep[a.key] == null ? 50 : s.rep[a.key];
                    const col = v < 25 ? '#e07070' : v < 50 ? '#e0a04c' : v < 75 ? a.color : '#8fd9a8';
                    return `<div class="wx-kv"><span>${a.icon} ${a.key}</span><b style="flex:1;display:flex;align-items:center;gap:8px;">
                        <div class="wx-bar"><i style="width:${v}%;background:${col};"></i></div><span style="color:${col};font-size:11.5px;">${v}</span></b></div>`;
                }).join(''), { icon: '⚖', grow: true })
                : WXH.empty('⚖', '声望簿尚未开卷', '行侠、结怨、投门、落草——五路江湖各记各的账');
            const weapon = s.weapon
                ? WXH.card('兵器谱', `<div style="text-align:center;padding:8px 0;"><b style="font-size:26px;color:var(--ip,#c9a86a);letter-spacing:2px;">${WXH.esc(s.weapon)}</b><div style="font-size:11px;color:var(--imt,#9a8c6e);margin-top:5px;">百晓生品评天下兵器——排名即敌意：名次越高，挑战者越多</div></div>`, { icon: '🗡', grow: true })
                : '';
            return `${repCard}${weapon}
            <div class="wx-banner">此消彼长：救名门伤魔教，劫富户涨绿林跌朝廷——五本账难得全赢；兵器谱升一位，要有拿得出手的实绩（胜过谁、杀了谁），江湖自会传。</div>`;
        },

        directive(s) {
            const known = AXES.filter(a => s.rep[a.key] != null);
            const hi = known.filter(a => s.rep[a.key] >= 75).map(a => a.key);
            const lo = known.filter(a => s.rep[a.key] <= 25).map(a => a.key);
            const t = [];
            if (hi.length) t.push(`声望高企（${hi.join('、')}）：此路人脉愿为玩家出手相助，但也带来束缚（名门要你守规矩、魔教要你交投名状）`);
            if (lo.length) t.push(`声望扫地（${lo.join('、')}）：此路视玩家为敌——追杀、悬赏、拒售皆随影而至`);
            if (s.weapon) t.push(`兵器谱在册「${s.weapon}」：江湖人对名次的反应要写实——不服者上门、觊觎者出手`);
            return t.join('；') || '';
        }
    };

    if (window.WorldExt) WorldExt.define('wuxia', [repMod]);
})();
