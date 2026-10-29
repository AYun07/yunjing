/**
 * 圣墟 · 界专属扩展（v3.19.0）
 * 🜂 进化之路——凡人觉醒、挣断枷锁的呼吸长征；神通觉醒与传承见闻同盘追踪
 */
(function () {
    'use strict';

    /* 原著进化阶梯：凡人→觉醒（一至九段）→枷锁（王级·十二道，挣断一道道枷锁）→逍遥→观想→餐霞→塑形→金身→亚圣→圣者→映照→神照→神祇 */
    const RANKS = ['凡人', '觉醒境', '枷锁境', '逍遥境', '观想境', '餐霞境', '塑形境', '金身境', '亚圣境', '圣者境', '映照级', '神照级', '神祇级'];
    const ATTRS = [
        { k: '力量', c: '#e05848' }, { k: '体魄', c: '#e8a04c' }, { k: '精神', c: '#a8d88f' },
        { k: '悟性', c: '#5fb8d8' }, { k: '心志', c: '#78ccbe' }, { k: '气运', c: '#b890f0' }
    ];
    /* 中文数字解析（枷锁境十二段需支持到十二） */
    const CN_D = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const cn2n = (s) => {
        if (!s) return 0;
        if (s === '十') return 10;
        if (s === '十一') return 11;
        if (s === '十二') return 12;
        if (/^十./.test(s)) return 10 + (CN_D[s[1]] || 0);
        if (/^.十/.test(s)) return (CN_D[s[0]] || 1) * 10;
        return CN_D[s] || 0;
    };

    const evolveMod = {
        id: 'evolve', icon: '🜂', name: '进化之路 · 呼吸传承',
        tip: '凡人起步、神祇封顶的进化阶梯——觉醒分九段、枷锁一道道挣断；呼吸法传承与神通觉醒一屏追踪',
        contract: '境界（当前进化境界，觉醒境须注明段数如「觉醒境三段」，枷锁境须注明挣断第几道如「枷锁境·挣断第三道」）；呼吸法[]（已掌握的呼吸法传承清单，残缺/完整可注明）；神通[]（已觉醒神通清单）；体质{力量,体魄,精神,悟性,心志,气运}（六维资质数值）',
        init: () => ({ rank: 0, sub: 0, breaths: [], powers: [], attrs: {} }),

        /* v3.32.2 状态板摘要：🜂 枷锁境·挣断三道 ·呼吸2·神通1 */
        summary(s) {
            const sub = s.rank === 1 ? `第${s.sub || 1}段` : (s.rank === 2 ? `断${s.sub || 0}道` : '');
            const l = [
                s.breaths.length ? `呼吸${s.breaths.length}` : '',
                s.powers.length ? `神通${s.powers.length}` : ''
            ].filter(Boolean).join('·');
            return [{ i: '🜂', v: RANKS[s.rank] + (sub ? '·' + sub : ''), l }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.realm || vars.status || '');
            /* 长名先匹配，避免「觉醒境」被「醒」类子串误判 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx < 0 && /凡人|未觉醒/.test(raw)) idx = 0;
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 子阶段：觉醒境九段 / 枷锁境十二道 */
            let sub = 0;
            const seg = raw.match(/第?([一二三四五六七八九十]{1,2})段/);
            const lock = raw.match(/挣断第?([一二三四五六七八九十]{1,2})道|第?([一二三四五六七八九十]{1,2})道枷锁/);
            if (seg) sub = cn2n(seg[1]);
            else if (lock) sub = cn2n(lock[1] || lock[2]);
            if (sub !== s.sub) { s.sub = sub; d = true; }
            WXH.asArr(vars.呼吸法 || vars.已掌握呼吸法).forEach(x => {
                const str = String(x).trim();
                if (str && !s.breaths.includes(str)) { s.breaths.unshift(str); d = true; }
            });
            if (s.breaths.length > 8) s.breaths.length = 8;
            WXH.asArr(vars.神通 || vars.已觉醒神通).forEach(x => {
                const str = String(x).trim();
                if (str && !s.powers.includes(str)) { s.powers.unshift(str); d = true; }
            });
            if (s.powers.length > 10) s.powers.length = 10;
            const a = WXH.asObj(vars.资质 || vars.体质 || vars.属性);
            for (const { k } of ATTRS) {
                if (a[k] != null) {
                    const n = Number(a[k]) || 0;
                    if (n !== (s.attrs[k] || 0)) { s.attrs[k] = n; d = true; }
                }
            }
            return d;
        },

        html(s) {
            const subTag = s.rank === 1 ? `第${s.sub || 1}段` : (s.rank === 2 ? `挣断第${s.sub || 0}道` : '');
            const ladder = WXH.card('进化阶梯', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🜂', grow: true, tag: '当前：' + RANKS[s.rank] + (subTag ? '·' + subTag : '')
            });
            const attrRows = ATTRS.filter(a => s.attrs[a.k] != null);
            const attrs = attrRows.length ? WXH.card('进化资质', `
                <div class="wx-kvs">${attrRows.map(a => `<div class="wx-kv"><span>${a.k}</span><b style="color:${a.c};">${WXH.esc(s.attrs[a.k])}</b></div>`).join('')}</div>`,
                { icon: '📊', tag: '六维' }) : '';
            const breaths = s.breaths.length
                ? WXH.card(`呼吸传承 · ${s.breaths.length}部`, `${s.breaths.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">🜂 ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '🜂', grow: true })
                : WXH.empty('🜂', '尚未得传任何呼吸法', '复苏纪元的门槛就是一部呼吸法——上古传承、异人组织与遗迹里都藏着，就看命里有没有');
            const powers = s.powers.length ? WXH.card(`神通觉醒 · ${s.powers.length}项`, `${s.powers.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">✦ ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '✦', grow: true }) : '';
            return `${ladder}${attrs}${breaths}${powers}
            <div class="wx-banner">进化无坦途：觉醒九段是熬出来的年头，枷锁境十二道枷锁每挣断一道都要脱层皮、醒一种神通；呼吸法残缺就得自己参悟补全，异果能改体质也暗藏凶险；这世道机缘与陷阱同源——长得越奇的东西，背后盯着的眼睛越多。</div>`;
        },

        directive(s) {
            const t = [];
            const cur = RANKS[s.rank] || '凡人';
            const sub = s.rank === 1 ? `第${s.sub || 1}段` : (s.rank === 2 ? `已挣断${s.sub || 0}道枷锁` : '');
            t.push(`当前进化境界${cur}${sub ? '（' + sub + '）' : ''}：实力表现须贴合境界（凡人是普通人，觉醒境是超凡入门，枷锁境挣断越多越强，映照级以上是位面大能），越阶硬撼必付代价`);
            if (s.breaths.length) t.push(`呼吸传承 ${s.breaths.length} 部（${s.breaths.slice(0, 3).join('、')}）：吐纳修行写气息流转与参悟过程，不写成系统面板`);
            if (s.powers.length) t.push(`神通觉醒 ${s.powers.length} 项（${s.powers.slice(0, 4).join('、')}）：动用写实效与代价，神通不是无限弹药`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('shengxu', [evolveMod]);
})();
