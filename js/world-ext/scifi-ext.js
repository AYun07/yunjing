/**
 * 科幻 · 界专属扩展（v3.4.0）
 * 🚀 舰船控制台与科技树——氧气/燃料/船体/能源四线资源管理；科研解锁改写可用行动选项
 */
(function () {
    'use strict';

    const RES = [
        { key: '氧气', icon: '💨', color: '#7ad8b8' },
        { key: '燃料', icon: '⛽', color: '#e0a04c' },
        { key: '船体', icon: '🛠', color: '#9ab8d8' },
        { key: '能源', icon: '⚡', color: '#d8c25a' }
    ];

    const shipMod = {
        id: 'ship', icon: '🚀', name: '舰船控制台 · 科技树',
        tip: '深空里，仪表盘就是你的命——任一资源见底，剧情立刻改道',
        contract: '舰船{氧气,燃料,船体,能源}（各项 0-100）；科技[]（已解锁的科研项）',
        init: () => ({ res: { 氧气: 100, 燃料: 100, 船体: 100, 能源: 100 }, techs: [] }),

        /* v3.32.2 状态板摘要：🚀 氧88·燃45·船70·能100 ·科研4（任一告急亮红） */
        summary(s) {
            const tone = RES.some(r => s.res[r.key] < 30) ? 'bad' : RES.some(r => s.res[r.key] < 60) ? 'warn' : 'ok';
            const v = RES.map(r => `${r.icon}${s.res[r.key]}`).join('·');
            return [{ i: '🚀', v, l: s.techs.length ? `科研${s.techs.length}` : '', tone }];
        },

        read(s, vars, round) {
            let d = false;
            const sv = WXH.asObj(vars.舰船 || vars.飞船 || vars.资源);
            RES.forEach(r => {
                const v = sv[r.key] != null ? sv[r.key] : (vars[r.key] != null ? vars[r.key] : null);
                if (v != null) { const n = WXH.asNum(v, s.res[r.key]); if (n !== s.res[r.key]) { s.res[r.key] = n; d = true; } }
            });
            WXH.asArr(vars.科技 || vars.科研 || sv.科技).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.techs.some(t => t.name === nm)) { s.techs.push({ name: nm, round }); d = true; }
            });
            if (s.techs.length > 30) s.techs.length = 30;
            return d;
        },

        html(s) {
            const resCards = RES.map(r => {
                const v = s.res[r.key];
                const col = v < 30 ? '#e07070' : v < 60 ? '#e0a04c' : r.color;
                return `<div class="wx-card">
                    <div class="wx-card-hd"><span>${r.icon}</span><b>${r.key}</b>${v < 30 ? `<i class="wx-tag" style="background:#e0707022;color:#e07070;">告急</i>` : ''}</div>
                    <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${v}%;background:${col};"></i></div><b style="color:${col};">${v}</b></div>
                </div>`;
            }).join('');
            const techs = s.techs.length
                ? WXH.card(`科研解锁 · ${s.techs.length} 项`, `<div class="wx-chips">${s.techs.map(t => `<i>🔬 ${WXH.esc(t.name)}</i>`).join('')}</div>`, { icon: '🔬', grow: true })
                : WXH.empty('🔬', '科研尚在蓝图阶段', '推进、护盾、武器、生维四条线——每项解锁都会改写可用手段');
            return `<div class="wx-grid">${resCards}</div>${techs}
            <div class="wx-banner">资源即剧情：氧气见底比敌人现身更可怕；科研未解锁的手段不能凭空使用，解锁须有实验与试错的过程——飞船不会因为你需要就长出曲率引擎。</div>`;
        },

        directive(s) {
            const critical = RES.filter(r => s.res[r.key] < 30);
            if (critical.length) return `资源告急（${critical.map(r => r.key + ' ' + s.res[r.key]).join('、')}）：本轮危机应围绕该资源展开（泄漏/争夺/抢修/取舍），行动选项须受其硬约束——生存优先于任务`;
            const low = RES.filter(r => s.res[r.key] < 60);
            if (low.length) return `资源吃紧（${low.map(r => r.key).join('、')}）：日常决策应带资源意识（航线取舍、消耗品配给），为危机蓄势`;
            return s.techs.length ? `科技在册 ${s.techs.length} 项：动用科技手段时点明其来源与限制（能耗/冷却/副作用），未解锁的技术不得凭空出现` : '';
        }
    };

    if (window.WorldExt) WorldExt.define('scifi', [shipMod]);
})();
