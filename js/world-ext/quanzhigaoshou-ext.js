/**
 * 全职高手 · 界专属扩展（v3.4.0）
 * 🎮 银武工坊与战队经营——自制银武形态库、技能点配布、战队资金/士气/赛程
 */
(function () {
    'use strict';

    const silverMod = {
        id: 'silver', icon: '🎮', name: '银武工坊 · 战队经营',
        tip: '千机伞多形态改造 + 技能点配布；网咖战队的资金、士气与赛程同盘经营',
        contract: '银武形态[]（当前解锁的武器形态）；技能点（可用技能点数）；战队{资金,士气,赛程}（经营现状与下一场比赛）',
        init: () => ({ forms: [], sp: 0, spMax: 0, team: null }),

        /* v3.32.2 状态板摘要：🎮 银武5形态 ·技点12 ·士气45（赛程在即亮 warn） */
        summary(s) {
            if (!s.forms.length && !s.sp && !s.team) return [];
            const items = [];
            if (s.forms.length) items.push({ i: '🔧', v: `${s.forms.length}形态`, l: s.sp ? `技点${s.sp}` : '' });
            if (s.team) {
                items.push({
                    i: '🏆', v: s.team.next ? '赛程在即' : `士气${s.team.morale}`,
                    l: s.team.next ? `士气${s.team.morale}` : '',
                    tone: s.team.next ? 'warn' : s.team.morale >= 70 ? 'ok' : s.team.morale < 40 ? 'bad' : ''
                });
            }
            return items;
        },

        read(s, vars, round) {
            let d = false;
            WXH.asArr(vars.银武形态 || vars.银武 || vars.千机伞形态).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.forms.includes(nm)) { s.forms.push(nm); d = true; }
            });
            const sp = WXH.pick(vars, ['技能点', '可用技能点']);
            if (sp != null) { const n = Number(sp) || 0; if (n !== s.sp) { s.sp = n; d = true; } }
            const spMax = WXH.pick(vars, ['技能点上限', '总技能点']);
            if (spMax != null) { const n = Number(spMax) || 0; if (n && n !== s.spMax) { s.spMax = n; d = true; } }
            const t = WXH.asObj(vars.战队 || vars.战队经营);
            if (Object.keys(t).length) {
                const nt = {
                    funds: String(t.资金 || t.funds || ''),
                    morale: WXH.asNum(t.士气, 50),
                    next: String(t.赛程 || t.下一场 || t.next || '')
                };
                if (!s.team || JSON.stringify(s.team) !== JSON.stringify(nt)) { s.team = nt; d = true; }
            }
            if (s.forms.length > 15) s.forms.length = 15;
            return d;
        },

        html(s) {
            const forms = s.forms.length
                ? WXH.card('银武形态库', `<div class="wx-chips">${s.forms.map(f => `<i>🔧 ${WXH.esc(f)}</i>`).join('')}</div>`, { icon: '🔧', tag: `${s.forms.length} 形态` })
                : WXH.empty('🔧', '银武尚在图纸阶段', '伞形态、枪形态、剑形态……每多一种形态，战斗就多一手');
            const spCard = s.spMax || s.sp
                ? WXH.card('技能点', `<div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${s.spMax ? Math.min(100, s.sp / s.spMax * 100) : 50}%;background:#5fc9d8;"></i></div><b style="color:#5fc9d8;">${s.sp}${s.spMax ? ' / ' + s.spMax : ''}</b></div><div class="wx-kv" style="margin-top:6px;"><span>配布心得</span><b>加满一技不如激活连招——combo 闭环才是荣耀的上限</b></div>`, { icon: '⚡' })
                : '';
            const team = s.team
                ? WXH.card('战队经营', [
                    s.team.funds ? WXH.kv([['资金', s.team.funds]]) : '',
                    WXH.kv([['士气', s.team.morale + ' / 100']]),
                    `<div class="wx-bar"><i style="width:${s.team.morale}%;background:${s.team.morale < 40 ? '#e07070' : s.team.morale < 70 ? '#e0a04c' : '#8fd9a8'};"></i></div>`,
                    s.team.next ? WXH.kv([['下一场', s.team.next]]) : ''
                ].join(''), { icon: '🏆', tag: s.team.next ? '赛程在即' : '休赛期' })
                : WXH.empty('🏆', '尚无战队', '兴欣从网咖起步——招人、训练、约战，荣耀之路先有队才有冠');
            return `${forms}${spCard}${team}
            <div class="wx-banner">荣耀是五个人的游戏：个人手速之外，战术板、队员状态与对手研究要写进比赛回合——具体到操作（走位/技能顺序/换装连招），不要写成"激烈交锋"四个字。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.forms.length) t.push(`银武已具 ${s.forms.length} 形态（${s.forms.slice(-3).join('、')}）：战斗中换形态即换打法，切换时机是操作亮点`);
            if (s.team && s.team.next) t.push(`赛程在即（${s.team.next}）：赛前训练、队员磨合与对手针对应占正文分量，比赛回合须落到具体操作与战术执行`);
            else if (s.team) t.push(`战队士气 ${s.team.morale}：低士气写矛盾与磨合，高士气写约战与冲榜`);
            return t.join('；') || '';
        }
    };

    if (window.WorldExt) WorldExt.define('quanzhigaoshou', [silverMod]);
})();
