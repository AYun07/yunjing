/**
 * 遮天 · 界专属扩展（v3.4.0）
 * 🌊 轮海秘境与源术罗盘——苦海→命泉→神桥→彼岸四层循序；源术赌石：切开之前谁也不知石中乾坤
 */
(function () {
    'use strict';

    const STAGES = ['苦海', '命泉', '神桥', '彼岸'];

    const wheelMod = {
        id: 'wheelsea', icon: '🌊', name: '轮海秘境 · 源术罗盘',
        tip: '轮海四层，循序而进；源术罗盘指石问源——赌的是眼力，拼的是心跳',
        contract: '轮海层次（苦海/命泉/神桥/彼岸之一，若当处轮海境）；赌石{战绩,切石记录}（源术赌石的胜负与所得）',
        init: () => ({ stage: -1, stones: { wins: 0, losses: 0, log: [] } }),

        /* v3.32.2 状态板摘要：🌊 命泉 ·赌石3胜1负（未入轮海则只显战绩） */
        summary(s) {
            const st = s.stones;
            if (s.stage < 0 && !st.wins && !st.losses) return [];
            const items = [];
            if (s.stage >= 0) items.push({ i: '🌊', v: STAGES[s.stage], l: '轮海' });
            if (st.wins || st.losses) items.push({ i: '🧿', v: `${st.wins}胜${st.losses}负`, l: '源术' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.轮海 || vars.轮海层次 || WXH.asObj(vars.秘境).轮海 || '');
            const idx = STAGES.findIndex(x => raw.includes(x));
            if (idx >= 0 && idx !== s.stage) { s.stage = idx; d = true; }
            const gs = WXH.asObj(vars.赌石 || vars.源术);
            if (gs.战绩) {
                const m = String(gs.战绩).match(/(\d+).*?(\d+)/);
                if (m) {
                    const w = Number(m[1]), l = Number(m[2]);
                    if (w !== s.stones.wins || l !== s.stones.losses) { s.stones.wins = w; s.stones.losses = l; d = true; }
                }
            }
            WXH.asArr(gs.切石记录 || vars.切石).forEach(x => {
                const str = String(x);
                if (str && !s.stones.log.some(t => t === str)) { s.stones.log.unshift(str); d = true; }
            });
            const w2 = WXH.pick(vars, ['赌石胜', '源术胜']); const l2 = WXH.pick(vars, ['赌石负', '源术负']);
            if (w2 != null && Number(w2) !== s.stones.wins) { s.stones.wins = Number(w2) || 0; d = true; }
            if (l2 != null && Number(l2) !== s.stones.losses) { s.stones.losses = Number(l2) || 0; d = true; }
            if (s.stones.log.length > 8) s.stones.log.length = 8;
            return d;
        },

        html(s) {
            const wheel = WXH.card('轮海四层', `<div class="wx-stepper">
                ${STAGES.map((t, i) => `<div class="wx-step ${i === s.stage ? 'on' : i < s.stage ? 'done' : ''}">${i < s.stage ? '✓ ' : ''}${t}</div>`).join('')}
            </div>`, {
                icon: '🌊', grow: true, tag: s.stage >= 0 ? '当前：' + STAGES[s.stage] : '未入轮海'
            });
            const st = s.stones;
            const total = st.wins + st.losses;
            const rate = total ? Math.round(st.wins / total * 100) : 0;
            const gamble = WXH.card(`源术赌石 · ${st.wins}胜${st.losses}负`, (total
                ? `<div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${rate}%;background:#c9a86a;"></i></div><b style="color:#c9a86a;">眼力 ${rate}%</b></div>`
                : '') + (st.log.length ? `<div style="margin-top:8px;">${st.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">🪨 ${WXH.esc(t)}</b></div>`).join('')}</div>` : ''),
                { icon: '🧿', grow: true });
            return `${wheel}${gamble}
            <div class="wx-banner">轮海在腹下：开辟苦海、涌出命泉、搭起神桥、抵达彼岸——一层有一层的天地；源术赌石是高风险机缘：切涨要写出眼力所据（纹路/手感/气机），切垮要写出真金白银的肉痛。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.stage >= 0) t.push(`轮海境·${STAGES[s.stage]}层：修行描写须贴合当前层次的意象（苦海之阔/命泉之涌/神桥之险/彼岸之明），进一层有一层的关口与异象`);
            const total = s.stones.wins + s.stones.losses;
            if (total) t.push(`赌石战绩 ${s.stones.wins}胜${s.stones.losses}负：源术判石要有依据（石纹/气机/手感），输赢都影响身家——连败之后的心态与翻本冲动是好戏`);
            return t.join('；') || '';
        }
    };

    if (window.WorldExt) WorldExt.define('shrouding', [wheelMod]);
})();
