/**
 * 玄鉴仙族 · 界专属模块（原著机制向，v3.47.7）
 * 依据原著设定补足 module-forge 通用玩法之外的专属机制：
 *  1. 符种坛：玄珠符种一枚为基，余量上限六枚，种下可反哺；符箓是李玄宣副业，非家族核心传承
 *  2. 牲祭坛·箓气：以牲畜祭玄鉴得箓气，箓气色随祭品境界——灰(凡牲)/白/青/黄
 *  3. 族谱位阶：世代字辈、大宗小宗之别，家族阶梯 凡族→筑基世家→紫府仙族
 * ⚠️ 同人设定的"符牌体系/许愿树/李望柯"等一律不收。
 */
(function () {
    'use strict';

    /* 箓气色阶（祭品境界越高，箓气越贵） */
    const LU_QI = [
        { k: '灰', c: '#9aa0b4', ref: '凡牲（猪羊鸡犬）——最贱之祭，箓气浅淡' },
        { k: '白', c: '#d8d8d8', ref: '开脉/胎息牲畜——稍有灵性，箓气可用' },
        { k: '青', c: '#7fc9a8', ref: '练气层次——箓气清贵，玄鉴嘉纳' },
        { k: '黄', c: '#d8b85a', ref: '筑基之牲——千金难求，一祭可抵百灰' }
    ];

    /* ── 模块一：符种坛 ── */
    const fuzhong = {
        id: 'xjfuzhong', icon: '🌱', name: '符种坛',
        tip: '玄珠符种 · 余量至多六枚 · 种下反哺',
        contract: '符种余量(0~6)；受种者[{人,符种desc}]；反哺(所获)',
        init: () => ({ reserve: 0, holders: [], feedback: '' }),

        summary(s) {
            if (!s.reserve && !s.holders.length) return [];
            return [{ i: '🌱', v: `${s.reserve}/6`, l: s.holders.length ? `种于 ${s.holders.length} 人` : '符种', tone: s.reserve >= 5 ? 'ok' : '' }];
        },

        read(s, vars, round) {
            let d = false;
            const r = vars.符种余量;
            if (r != null && r !== '') {
                const n = WXH.asNum(r);
                if (n !== s.reserve) { s.reserve = Math.max(0, Math.min(6, n)); d = true; }
            }
            const h = vars.受种者 || vars.符种;
            if (Array.isArray(h)) {
                h.forEach(x => {
                    if (!x) return;
                    const it = typeof x === 'object' ? { who: String(x.人 || x.name || '').slice(0, 16), desc: String(x.desc || x.符种desc || x.符种 || '').slice(0, 40) } : { who: String(x).slice(0, 16), desc: '' };
                    if (it.who && !s.holders.some(o => o.who === it.who)) { s.holders.push(it); d = true; }
                });
                if (s.holders.length > 12) s.holders.length = 12;
            } else if (h && typeof h === 'object' && h.人) {
                const it = { who: String(h.人).slice(0, 16), desc: String(h.desc || h.符种desc || '').slice(0, 40) };
                if (!s.holders.some(o => o.who === it.who)) { s.holders.push(it); d = true; }
            }
            const f = vars.反哺;
            if (f != null && f !== '' && String(f) !== s.feedback) { s.feedback = String(typeof f === 'object' ? (f.所获 || f.desc || '') : f).slice(0, 60); d = true; }
            return d;
        },

        html(s) {
            if (!s.reserve && !s.holders.length) return WXH.empty('🌱', '符种未启', '玄珠藏种，种成符箓——一枚为基，余量至多六枚，这是李家独一份的活水。');
            const rows = s.holders.map(h => `<div class="wx-kv"><span>${WXH.esc(h.who)}</span><b>${WXH.esc(h.desc || '已受符种')}</b></div>`).join('');
            return `${WXH.card('符种坛 · 玄珠余量', `
            <div class="wx-kv"><span>余量</span><b>${s.reserve} / 6 枚</b></div>
            <div class="wx-kv"><span>流转</span><b>种下者练气有成，符种可反哺玄珠，化作家族底蕴</b></div>
            ${s.feedback ? `<div class="wx-banner" style="border-color:#7fc9a888;background:#7fc9a812;">🌾 反哺入账：${WXH.esc(s.feedback)}</div>` : ''}
            <div class="wx-banner">符种是家族的本钱：余量见底时，受种者的成长反哺就是续命的唯一来路。</div>`, { icon: '🌱', tag: `${s.reserve}/6`, grow: true })}
            ${rows ? WXH.card('受种名册', rows, { icon: '📋' }) : ''}`;
        },

        directive(s) {
            if (!s.reserve && !s.holders.length) return '';
            return `符种坛在案：玄珠余 ${s.reserve}/6 枚${s.holders.length ? `，已种 ${s.holders.map(h => h.who).join('、')}` : ''}。受种者练气有成须反哺玄珠；余量紧缺时家族对"种给谁"会起真实纷争。注意：符箓之道是李玄宣的副业成就，并非家族核心传承，勿写成李家本职。`;
        }
    };

    /* ── 模块二：牲祭坛 · 箓气 ── */
    const shengji = {
        id: 'xjshengji', icon: '🔥', name: '牲祭坛·箓气',
        tip: '以牲祭鉴 · 箓气四色：灰白青黄',
        contract: '牲祭(祭品+所求)；箓气[{色,名目}]',
        init: () => ({ rite: '', qi: [] }),

        summary(s) {
            if (!s.rite && !s.qi.length) return [];
            const top = s.qi[s.qi.length - 1];
            return [{ i: '🔥', v: top ? top.k : '未启', l: s.rite ? '祭在灶前' : '箓气', tone: '' }];
        },

        read(s, vars, round) {
            let d = false;
            const r = vars.牲祭;
            if (r != null && r !== '' && String(r) !== s.rite) { s.rite = String(typeof r === 'object' ? (r.祭品 || r.desc || '') : r).slice(0, 60); d = true; }
            if (!r && s.rite) { s.rite = ''; d = true; }
            const q = vars.箓气;
            if (Array.isArray(q)) q.forEach(x => {
                const it = typeof x === 'object' ? { k: String(x.色 || x.k || '').slice(0, 2), n: String(x.名目 || x.n || x.desc || '').slice(0, 40) } : { k: String(x).slice(0, 2), n: '' };
                if (it.k && !s.qi.some(o => o.k === it.k && o.n === it.n)) { s.qi.push(it); d = true; }
            });
            if (s.qi.length > 10) s.qi.length = 10;
            return d;
        },

        html(s) {
            if (!s.rite && !s.qi.length) return WXH.empty('🔥', '牲祭未启', '玄鉴好飨——以牲畜之血肉换箓气，是家族根脚所在。');
            const legend = LU_QI.map(l => `<div class="wx-kv"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.c};margin-right:5px;vertical-align:-1px;"></i>${l.k}箓</span><b>${l.ref}</b></div>`).join('');
            const rows = s.qi.map(q => { const l = LU_QI.find(x => x.k === q.k) || LU_QI[0]; return `<div class="wx-kv"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.c};margin-right:5px;vertical-align:-1px;"></i>${WXH.esc(q.k)}箓</span><b>${WXH.esc(q.n || '入鉴收藏')}</b></div>`; }).join('');
            return `${WXH.card('箓气色阶（原著）', legend, { icon: '🎨' })}
            ${rows ? WXH.card('已得箓气', rows, { icon: '📜' }) : ''}
            ${s.rite ? WXH.card('祭在灶前', `<div class="wx-banner">🔥 ${WXH.esc(s.rite)}——牲祭有香火，玄鉴有应答，也有脾气。</div>`, { icon: '🔥' }) : ''}
            <div class="wx-banner">玄鉴：青灰铜镜，镜中另藏古怪——牲祭所得箓气按祭品境界分灰/白/青/黄四色，越贵越灵。</div>`;
        },

        directive(s) {
            if (!s.rite && !s.qi.length) return '';
            return `牲祭坛在案${s.rite ? `（当前祭事：${s.rite}）` : ''}：写牲祭须落到选牲、沐浴、设坛、祝祷的实在流程，箓气以色分级（灰/白/青/黄对应凡牲至筑基）；玄鉴有应必有所图，勿写成有求必应的许愿机。`;
        }
    };

    /* ── 模块三：族谱位阶 ── */
    const zupu = {
        id: 'xjzupu', icon: '📖', name: '族谱位阶',
        tip: '世代字辈 · 大宗小宗 · 凡族→筑基世家→紫府仙族',
        contract: '族中大事(事由)；族位(凡族/筑基世家/紫府仙族)；当家人(人名)',
        init: () => ({ rank: '凡族', head: '', events: [] }),

        summary(s) {
            if (s.rank === '凡族' && !s.head && !s.events.length) return [];
            return [{ i: '📖', v: s.rank, l: s.head || '', tone: s.rank === '紫府仙族' ? 'ok' : '' }];
        },

        read(s, vars, round) {
            let d = false;
            const rk = vars.族位 || vars.家族位阶;
            if (rk != null && rk !== '' && String(rk) !== s.rank) { s.rank = String(rk).slice(0, 8); d = true; }
            const hd = vars.当家人 || vars.家主;
            if (hd != null && hd !== '' && String(hd) !== s.head) { s.head = String(hd).slice(0, 12); d = true; }
            const ev = vars.族中大事;
            if (ev != null && ev !== '') {
                const arr = Array.isArray(ev) ? ev : String(ev).split(/[；;\n]+/);
                arr.forEach(x => {
                    const t = String(typeof x === 'object' ? (x.text || x.事由 || x.desc || '') : x).trim().slice(0, 40);
                    if (t && !s.events.some(e => e.text === t)) { s.events.unshift({ text: t, round }); d = true; }
                });
                if (s.events.length > 10) s.events.length = 10;
            }
            return d;
        },

        html(s) {
            if (s.rank === '凡族' && !s.head && !s.events.length) return WXH.empty('📖', '族谱冷清', '一姓之兴在代代接力——修仙世家，拼的不是一人之勇。');
            const ladder = ['凡族', '筑基世家', '紫府仙族'];
            const li = ladder.map(r => `<div class="wx-kv"><span>${r}</span><b>${r === s.rank ? '◉ 当前' : (ladder.indexOf(r) < ladder.indexOf(s.rank) ? '已过' : '未至')}</b></div>`).join('');
            return `${WXH.card('家族阶梯', li, { icon: '🪜', tag: s.rank, grow: true })}
            ${s.head ? `<div class="wx-kv"><span>当家人</span><b>${WXH.esc(s.head)}</b></div>` : ''}
            ${s.events.length ? WXH.card('族中大事记', s.events.map(e => `<div class="wx-kv"><span>第${e.round || '?'}回</span><b>${WXH.esc(e.text)}</b></div>`).join(''), { icon: '📜' }) : ''}
            <div class="wx-banner">宗法原著：世代依字辈排行，大宗承祧、小宗别支——大宗小宗之分牵动资源、联姻与心气，家宅之内也有庙堂。</div>`;
        },

        directive(s) {
            if (s.rank === '凡族' && !s.head && !s.events.length) return '';
            return `族谱在案（位阶：${s.rank}${s.head ? `·当家人：${s.head}` : ''}）：家族叙事须循大宗小宗宗法与字辈世代，族内资源的倾斜、嫡庶的分际、联姻的算计皆由此生；家族阶梯（凡族→筑基世家→紫府仙族）每一级上跃都是全书级大事。`;
        }
    };

    if (window.WorldExt) WorldExt.define('xuanjianxianzu', [fuzhong, shengji, zupu]);
})();
