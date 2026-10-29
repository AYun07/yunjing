/**
 * 重生之都市修仙 · 界专属扩展（v3.4.0）
 * 🎭 马甲管理器——明面身份与修行界身份双轨并行；暴露风险随扮猪吃虎累积，起疑名单步步逼近
 * 🏮 前世记忆库——北玄仙尊五百年底蕴按忆力解锁：功法/丹方/人脉/秘闻，调用一次少一分
 */
(function () {
    'use strict';

    /* ==================== 马甲管理器 ==================== */
    const RISK_ZONES = [
        { max: 19, label: '深藏不露', color: '#8fd9a8' },
        { max: 39, label: '偶有疑影', color: '#c8c06a' },
        { max: 59, label: '有人起疑', color: '#e0a04c' },
        { max: 79, label: '步步紧逼', color: '#e0784c' },
        { max: 100, label: '濒临揭穿', color: '#e07070' }
    ];

    const vestMod = {
        id: 'vest', icon: '🎭', name: '马甲管理器',
        tip: '明面是普通学生，暗地是修行界闻风丧胆的名号——两条线，一张脸',
        contract: '明面身份（学生/职员等世俗身份及近况）；修行界身份（在修行界的名号与传闻）；暴露风险（0-100：越高越接近被身边人识破）；起疑名单[]（已对玩家起疑的人及其怀疑什么）',
        init: () => ({ open: '', hidden: '', risk: 0, suspects: [] }),

        /* v3.32.2 状态板摘要：🎭 北玄仙尊 ·风险42·起疑2（濒临揭穿亮红） */
        summary(s) {
            if (!s.open && !s.hidden && !s.risk && !s.suspects.length) return [];
            const tone = s.risk >= 80 ? 'bad' : s.risk >= 60 ? 'warn' : 'ok';
            return [{
                i: '🎭', v: String(s.hidden || s.open || '马甲').slice(0, 8),
                l: `风险${s.risk}` + (s.suspects.length ? `·起疑${s.suspects.length}` : ''), tone
            }];
        },

        read(s, vars, round) {
            let d = false;
            const v = WXH.asObj(vars.马甲 || vars.身份);
            const open = v.明面 || vars.明面身份 || '';
            const hidden = v.修行界 || v.修行界身份 || v.暗面 || vars.修行界身份 || vars.名号 || '';
            if (open && open !== s.open) { s.open = String(open); d = true; }
            if (hidden && hidden !== s.hidden) { s.hidden = String(hidden); d = true; }
            const r = WXH.pick(vars, ['暴露风险', '马甲风险', 'risk']);
            if (r != null) { const n = WXH.asNum(r, s.risk); if (n !== s.risk) { s.risk = n; d = true; } }
            WXH.asArr(v.起疑名单 || vars.起疑名单 || vars.起疑者).forEach(x => {
                const nm = String(x).split(/[：:（(]/)[0].trim();
                if (nm && !s.suspects.some(u => u.name === nm)) { s.suspects.push({ name: nm, note: String(x).includes('：') ? String(x).split('：')[1] : '', round }); d = true; }
            });
            if (s.suspects.length > 12) s.suspects.length = 12;
            return d;
        },

        act(s, action, payload) {
            if (action !== 'nudge') return;
            const n = Math.max(0, Math.min(100, s.risk + Number(payload)));
            if (n === s.risk) return '已在端点';
            s.risk = n;
            return `暴露风险 → ${n}`;
        },

        html(s) {
            const g = WXH.gauge(s.risk, RISK_ZONES);
            const idCard = (t, name, note, icon, col) => `<div class="wx-mirror-side" style="border-color:${col}55;">
                <h4 style="color:${col};">${icon} ${t}</h4>${WXH.kv([['身份', name || '—'], ['近况', note || '—']])}</div>`;
            return `<div class="wx-mirror">
                ${idCard('明面 · 阳光下', s.open || '按设定台自述身份', '', '🌤', '#7ab8d8')}
                <div class="wx-mirror-mid"><b>🎭</b><small style="font-size:9.5px;color:var(--imt,#9a8c6e);">同一人</small></div>
                ${idCard('暗面 · 传闻里', s.hidden || '尚无名号', '', '🌙', '#c9584a')}
            </div>
            ${WXH.card('暴露风险', g.html, { icon: '🚨', tag: g.zone.label })}
            ${s.suspects.length ? WXH.card('起疑名单', s.suspects.map(u => `<div class="wx-kv"><span>${u.round ? '第' + u.round + '回' : '—'}</span><b>${WXH.esc(u.name)}${u.note ? '（疑：' + WXH.esc(u.note) + '）' : ''}</b></div>`).join(''), { icon: '👀' }) : ''}
            <div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('vest','nudge',-10)">−10 压下风波</button>
                <button class="wx-btn" onclick="WorldExt.act('vest','nudge',10)">+10 露出马脚</button>
                <small style="font-size:10.5px;color:var(--imt,#9a8c6e);">手动干预</small>
            </div>`;
        },

        directive(s) {
            const r = s.risk;
            if (r >= 80) return `暴露风险${r}·濒临揭穿：本轮应让最接近真相的人发起正面试探（当面验证/设局/摊牌），马甲状腺告急——揭穿与否由剧情逻辑裁定，不可无端化险。`;
            if (r >= 60) return `暴露风险${r}·步步紧逼：安排试探、巧合或目击桥段逼近马甲；起疑者${s.suspects.length ? '（' + s.suspects.map(u => u.name).slice(0, 3).join('、') + '）' : ''}的怀疑要有具体言行，不是空气。`;
            if (r >= 40) return `暴露风险${r}·有人起疑：身边人开始把不对劲串起来——补一两处"圆谎"或"险些穿帮"的细节，扮猪吃虎的张力靠这个养。`;
            if (r >= 20) return `暴露风险${r}·偶有疑影：可在日常线埋轻微的违和感（力道、眼力、反应速度），不急于点破。`;
            return `暴露风险${r}·深藏不露：马甲安稳，可从容布局扮猪吃虎；但每次动用修行手段都应让风险自然浮动。`;
        }
    };

    /* ==================== 前世记忆库 ==================== */
    const TYPES = [
        { key: '功法', icon: '📜', color: '#c9a86a' },
        { key: '丹方', icon: '⚗️', color: '#8fd9a8' },
        { key: '人脉', icon: '🤝', color: '#7ab8d8' },
        { key: '秘闻', icon: '🕯', color: '#b7a8e8' }
    ];

    const memoryMod = {
        id: 'memory', icon: '🏮', name: '前世记忆库',
        tip: '五百年仙尊底蕴，按忆力调用——功法残忆、古丹方、故人名册、昆墟秘辛',
        contract: '前世记忆[{名称,类别(功法/丹方/人脉/秘闻)}]（本轮追忆起的底蕴）；忆力（0-100：调用记忆的精神余量，随静修恢复）',
        init: () => ({ unlocked: [], power: 100 }),

        /* v3.32.2 状态板摘要：🏮 12条底蕴 ·忆力78（忆海干涸亮红） */
        summary(s) {
            if (!s.unlocked.length) return [];
            const tone = s.power <= 19 ? 'bad' : s.power <= 49 ? 'warn' : 'ok';
            return [{ i: '🏮', v: `${s.unlocked.length}条`, l: `忆力${s.power}`, tone }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = vars.前世记忆 || vars.记忆;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) WXH.asArr(raw).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.unlocked.some(u => u.name === nm)) { s.unlocked.push({ name: nm, type: '秘闻', round }); d = true; }
            });
            Object.entries(WXH.asObj(raw)).forEach(([k, v]) => {
                if (!s.unlocked.some(u => u.name === k)) {
                    const t = TYPES.some(t => String(v).includes(t.key) || k.includes(t.key)) ? TYPES.find(t => String(v).includes(t.key) || k.includes(t.key)).key : '秘闻';
                    s.unlocked.push({ name: k, type: t, note: String(v).slice(0, 50), round }); d = true;
                }
            });
            const p = WXH.pick(vars, ['忆力', '记忆余量']);
            if (p != null) { const n = WXH.asNum(p, s.power); if (n !== s.power) { s.power = n; d = true; } }
            if (s.unlocked.length > 40) s.unlocked.length = 40;
            return d;
        },

        html(s) {
            const g = WXH.gauge(s.power, [
                { max: 19, label: '忆海干涸', color: '#e07070' },
                { max: 49, label: '雾锁前尘', color: '#e0a04c' },
                { max: 79, label: '忆力尚可', color: '#c8c06a' },
                { max: 100, label: '前尘历历', color: '#8fd9a8' }
            ]);
            const byType = TYPES.map(t => {
                const list = s.unlocked.filter(u => u.type === t.key);
                if (!list.length) return '';
                return WXH.card(`${t.icon} ${t.key} · ${list.length}`, list.map(u =>
                    `<div class="wx-kv"><span>第${u.round || '?'}回</span><b>${WXH.esc(u.name)}${u.note ? ` <i style="font-style:normal;opacity:.6;font-size:11px;">${WXH.esc(u.note)}</i>` : ''}</b></div>`).join(''), {});
            }).join('');
            return `${WXH.card('忆力余量', g.html, { icon: '🏮', tag: g.zone.label })}
            ${byType || WXH.empty('🏮', '前尘封在雾里', '随剧情追忆起的功法、丹方、人脉、秘闻会自动归档——忆力越低，雾越浓')}
            <div class="wx-banner">底蕴不是无限仓库：调用前世记忆解题须耗忆力、写出追忆的恍惚一瞬；忆力随静修与安眠恢复——高考前夜该复习还是该打坐，是个问题。</div>`;
        },

        directive(s) {
            if (s.power <= 19) return `忆力${s.power}·忆海干涸：前世记忆暂不可调用，玩家须以今生凡躯应对——底蕴断供的窘迫要写实。`;
            if (s.unlocked.length) return `前世记忆已启 ${s.unlocked.length} 条：调用记忆时点明付出的忆力代价与恍惚感；前世的名号、故人与仇家可随记忆浮现，牵动今生的线。`;
            return '';
        }
    };

    if (window.WorldExt) WorldExt.define('zhongshengdushi', [vestMod, memoryMod]);
})();
