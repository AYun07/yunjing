/**
 * 吞噬星空 · 界专属扩展（v3.4.0）
 * 🥋 武馆段位与猎人任务板——武者考核逐级解锁权限与机体；废墟区悬赏在案，完成与失败皆有世界反馈
 */
(function () {
    'use strict';

    const huntMod = {
        id: 'hunter', icon: '🥋', name: '武馆段位 · 猎人任务板',
        tip: '极限武馆考核逐级而升；废墟区悬赏在案——怪物的等级就是你的价目表',
        contract: '武馆段位（当前段位）；贡献（武馆贡献值）；任务[{名称,报酬,状态}]（在案悬赏：进行中/已完成/失败）',
        init: () => ({ rank: '', contrib: 0, tasks: [] }),

        /* v3.32.2 状态板摘要：🥋 学员级 ·贡献120 ·悬赏2在案 */
        summary(s) {
            if (!s.rank && !s.contrib && !s.tasks.length) return [];
            const doing = s.tasks.filter(t => t.status === 'doing').length;
            return [{
                i: '🥋', v: s.rank || '未入馆',
                l: [s.contrib ? `贡献${s.contrib}` : '', doing ? `悬赏${doing}在案` : ''].filter(Boolean).join('·')
            }];
        },

        read(s, vars, round) {
            let d = false;
            const r = vars.武馆段位 || vars.段位 || WXH.asObj(vars.武馆).段位;
            if (r && String(r) !== s.rank) { s.rank = String(r); d = true; }
            const c = WXH.pick(vars, ['贡献', '武馆贡献']);
            if (c != null) { const n = Number(String(c).replace(/[^\d]/g, '')) || 0; if (n !== s.contrib) { s.contrib = n; d = true; } }
            const raw = vars.任务 || vars.悬赏 || vars.任务板;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) WXH.asArr(raw).forEach(x => {
                const str = String(x);
                const m = str.match(/^(.+?)[（(](.+?)[)）]$/);
                const name = (m ? m[1] : str).trim();
                const status = /完成/.test(str) ? 'done' : /失败|放弃/.test(str) ? 'fail' : 'doing';
                const ex = s.tasks.find(t => t.name === name);
                if (!ex) { s.tasks.unshift({ name, status, note: m ? m[2] : '' }); d = true; }
                else if (ex.status !== status && status !== 'doing') { ex.status = status; d = true; }
            });
            Object.entries(WXH.asObj(raw)).forEach(([k, v]) => {
                const status = /完成/.test(String(v)) ? 'done' : /失败|放弃/.test(String(v)) ? 'fail' : 'doing';
                const ex = s.tasks.find(t => t.name === k);
                if (!ex) { s.tasks.unshift({ name: k, status, note: String(v).slice(0, 40) }); d = true; }
                else if (ex.status !== status && status !== 'doing') { ex.status = status; d = true; }
            });
            if (s.tasks.length > 14) s.tasks.length = 14;
            return d;
        },

        html(s) {
            const ST = { done: ['已完成', '#8fd9a8'], doing: ['进行中', '#e0a04c'], fail: ['失败', '#e07070'] };
            const rankCard = s.rank
                ? WXH.card('当前段位', WXH.kv([['段位', s.rank], ['贡献', s.contrib ? String(s.contrib) : '—']]), { icon: '🥋', grow: true })
                : WXH.empty('🥋', '尚未入馆考核', '拳力、速度、反应——硬指标达标才能晋级，武者之路从考核开始');
            const tasks = s.tasks.length
                ? WXH.card('任务板', s.tasks.map(t => `<div class="wx-task">
                    <b>${WXH.esc(t.name)}</b>
                    ${t.note ? `<i style="font-style:normal;font-size:11px;color:var(--imt,#9a8c6e);">${WXH.esc(t.note)}</i>` : ''}
                    <span class="st" style="background:${ST[t.status][1]}22;color:${ST[t.status][1]};">${ST[t.status][0]}</span></div>`).join(''), { icon: '📋', grow: true })
                : WXH.empty('📋', '任务板暂无在案悬赏', '废墟区、基地市、猎人网站——悬赏会随剧情钉上板来');
            return `${rankCard}${tasks}
            <div class="wx-banner">等级即生死：越阶接单是拿命换钱，废墟区的怪物不认人情；武馆贡献换装备、换秘籍、换考核资格——资源永远不够，取舍才见猎人本色。</div>`;
        },

        directive(s) {
            const doing = s.tasks.filter(t => t.status === 'doing');
            if (doing.length) return `猎人任务在案（${doing.map(t => t.name).slice(0, 2).join('、')}）：任务目标、报酬与风险应随剧情真实推进——完成要有过程，失败要有后果，不可悬空挂账。`;
            if (s.rank) return `武馆段位「${s.rank}」：考核与晋级的硬指标（拳力/速度）应随修炼显影；接任务须与段位匹配，废墟区的凶险按原著如实呈现。`;
            return '';
        }
    };

    if (window.WorldExt) WorldExt.define('swallowedstar', [huntMod]);
})();
