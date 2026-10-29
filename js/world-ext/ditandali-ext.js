/**
 * 开局地摊卖大力 · 界专属扩展（v3.19.0）
 * 🏮 灵武九星——黑铁起步、道天封顶的八阶长征，九星一档与天赋评级同盘追踪
 * 💢 地摊系统——怨气值攒池抽奖：被坑得越惨燃料越旺，十连抽多半谢谢惠顾
 */
(function () {
    'use strict';

    /* 原著灵武等阶：黑铁→青铜→白银→黄金→铂金→钻石→星耀→道天（每阶九星） */
    const RANKS = ['黑铁', '青铜', '白银', '黄金', '铂金', '钻石', '星耀', '道天'];
    const CN_NUM = '零一二三四五六七八九';

    /* ==================== 模块一：灵武九星阶梯 ==================== */
    const martialMod = {
        id: 'martial', icon: '🏮', name: '灵武九星 · 天赋评级',
        tip: '八阶九星的灵武长征——黑铁起步、道天封顶；天赋评级压着绝大多数人的一生',
        contract: '等阶（当前灵武等阶含星级，如「黑铁三星」「青铜一星」）；天赋（天赋评级如 E/B/A/SS/SSS+）；异能（觉醒的异能，如「空间系」「火系」「兽化系」）',
        init: () => ({ rank: -1, star: 0, talent: '', power: '' }),

        /* v3.32.2 状态板摘要：🏮 青铜3星 ·SSS+ ·空间系 */
        summary(s) {
            if (s.rank < 0 && !s.talent && !s.power) return [];
            const items = [];
            if (s.rank >= 0) items.push({ i: '🏮', v: RANKS[s.rank], l: s.star ? `${s.star}星` : '' });
            else items.push({ i: '🏮', v: '凡人', l: s.talent || '' });
            if (s.power) items.push({ i: '⚡', v: s.talent || '异能', l: s.power });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.等阶 || vars.境界 || vars.realm || vars.status || '');
            /* 长名先匹配，避免「黄金阶」吞「黄」 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 星级解析：「黑铁三星」→3；九星圆满按9计 */
            const sm = raw.match(/([一二三四五六七八九])星/);
            const star = sm ? CN_NUM.indexOf(sm[1]) : (/九星|圆满/.test(raw) ? 9 : 0);
            if (idx >= 0 && star !== s.star) { s.star = star; d = true; }
            /* 天赋评级与异能 */
            const talent = WXH.pick(vars, ['天赋', '天赋评级', 'talent']);
            if (talent != null && String(talent) !== s.talent) { s.talent = String(talent).slice(0, 8); d = true; }
            const power = WXH.pick(vars, ['异能', '觉醒异能', 'power']);
            if (power != null && String(power) !== s.power) { s.power = String(power).slice(0, 16); d = true; }
            return d;
        },

        html(s) {
            const cur = s.rank >= 0 ? RANKS[s.rank] : null;
            const ladder = WXH.card('灵武八阶', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🏮', grow: true, tag: cur ? `当前：${cur}${s.star ? '·' + s.star + '星' : ''}` : '凡人之躯'
            });
            const info = WXH.card('评级与异能', WXH.kv([
                ['天赋评级', s.talent || '—'],
                ['觉醒异能', s.power || '—'],
                ['当前等阶', cur ? `${cur}${s.star ? ' ' + s.star + '星' : ''}` : '凡人（未入灵武）']
            ]), { icon: '⚡', tag: '命格' });
            const stars = s.rank >= 0 ? WXH.card(`${RANKS[s.rank]}·星位`, `<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">${Array.from({ length: 9 }, (_, i) => `<span style="font-size:15px;opacity:${i < s.star ? 1 : .25};">★</span>`).join('')}<b style="margin-left:6px;color:#e8a04c;font-size:12.5px;">${s.star}/9</b></div>`, { icon: '★', tag: '一阶九星' }) : '';
            return `${ladder}${info}${stars}
            <div class="wx-banner">灵武等阶是硬约束：黑铁九星也摸不到青铜的门，越级靠底牌与脑子，不靠嗓门；天赋评级压着绝大多数人的一生——但命格这东西，比评级更不讲道理。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank >= 0) {
                t.push(`当前${RANKS[s.rank]}${s.star ? ' ' + s.star + '星' : ''}：实力表现须贴阶（黑铁是刚引灵气入体的新手，黄金可称一方好手，道天是种族极限之上的存在），越阶挑战必付代价或靠底牌`);
            } else {
                t.push('尚未踏入灵武等阶：凡人之躯，遇上黑铁一星都得赔笑——觉醒、拜师、药剂、系统道具都是入门的路子');
            }
            if (s.talent) t.push(`天赋评级 ${s.talent}：评级决定觉醒上限与异能强度，写社会反馈（同学的目光、协会的门槛）时以此为准`);
            if (s.power) t.push(`觉醒异能「${s.power}」：交锋写实质感（空间系的挪移、火系的爆发、兽化系的形态切换各有打法），不写成招式播报`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：地摊系统·怨气池 ==================== */
    /* 原著系统奖池：大力药水为招牌，十连抽多半谢谢惠顾 */
    const POOL = [
        { name: '谢谢惠顾', w: 46, rarity: 'gray', note: '空手而归——系统的日常' },
        { name: '小布丁', w: 18, rarity: 'blue', note: 'Q弹好吃，聊胜于无' },
        { name: '幸运樱桃', w: 14, rarity: 'blue', note: '当日气运小幅加成' },
        { name: '解毒小黄豆', w: 10, rarity: 'purple', note: '解百毒，救急神器' },
        { name: '洗髓灵果', w: 7, rarity: 'gold', note: '洗筋伐髓，修行资质+1' },
        { name: '大力药水', w: 5, rarity: 'gold', note: '十倍身体素质持续三天三夜——副作用：秃顶·肌肉爆衣' }
    ];
    const RARITY_COLOR = { gray: '#9a8c6e', blue: '#68a8d8', purple: '#a888e8', gold: '#e8c45c' };

    const stallMod = {
        id: 'stall', icon: '💢', name: '地摊系统 · 怨气池',
        tip: '被坑得越惨怨气越足，怨气越足燃料越旺——十连抽多半「谢谢惠顾」',
        contract: '怨气值（0-100 整数：他人被坑后积攒的系统燃料，抽奖消耗）；系统道具[]（地摊系统抽得或正在出售的道具清单）',
        init: () => ({ value: 5, draws: [], items: [] }),

        /* v3.32.2 状态板摘要：💢 怨气 62 ·怨气冲天（可十连亮红） */
        summary(s) {
            const tone = s.value >= 80 ? 'bad' : s.value >= 50 ? 'warn' : '';
            const l = s.value >= 80 ? '可十连' : s.value >= 50 ? '燃料正旺' : '燃料不足';
            return [{ i: '💢', v: String(s.value), l: s.items.length ? `${l}·道具${s.items.length}` : l, tone }];
        },

        read(s, vars, round) {
            let d = false;
            const v = WXH.pick(vars, ['怨气值', '怨气', 'resentment']);
            if (v != null) {
                const m = String(v).match(/-?\d{1,3}/);
                if (m) {
                    const n = Math.max(0, Math.min(100, Number(m[0])));
                    if (n !== s.value) { s.value = n; d = true; }
                }
            }
            WXH.asArr(vars.系统道具 || vars.地摊道具 || vars.道具).forEach(x => {
                const str = String(x).trim();
                if (str && !s.items.includes(str)) { s.items.unshift(str); d = true; }
            });
            if (s.items.length > 12) s.items.length = 12;
            return d;
        },

        html(s) {
            const zones = [
                { max: 19, label: '燃料不足', color: '#9a8c6e' },
                { max: 49, label: '怨气渐积', color: '#68a8d8' },
                { max: 79, label: '怨气冲天', color: '#e8a04c' },
                { max: 100, label: '怨气滔天·可十连', color: '#e05848' }
            ];
            const g = WXH.gauge(s.value, zones);
            const pool = WXH.card('系统奖池 · 概率一览', POOL.map(p => `<div class="wx-kv"><span style="color:${RARITY_COLOR[p.rarity]};">${p.name}</span><b style="font-weight:400;"><i style="font-style:normal;color:${RARITY_COLOR[p.rarity]};">${p.w}%</i> · ${WXH.esc(p.note)}</b></div>`).join(''), { icon: '🎁', grow: true, tag: '十连900' });
            const items = s.items.length ? WXH.card(`道具行囊 · ${s.items.length}件`, s.items.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">✦ ${WXH.esc(t)}</b></div>`).join(''), { icon: '✦' }) : '';
            const draws = s.draws.length ? WXH.card('抽奖实录', s.draws.map((t, i) => `<div class="wx-kv"><span><i class="wx-idx">${i + 1}</i></span><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '🎲', grow: true }) : '';
            return `${g.html}
            <div class="wx-banner" style="margin-top:10px;"><b style="color:${g.zone.color};">${g.zone.label}</b>——${s.value >= 80 ? '怨气够一次十连了：十抽九空是常态，抽之前先做好心理建设' : s.value >= 50 ? '燃料正旺，单抽可试手气；摊位的坑客名场面是攒怨气的正路' : '还得攒——坑客要坑得巧妙，怨气才收得上来'}</div>
            ${items}${pool}${draws}
            <div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('stall','draw',1)">单抽 · 耗100怨气值</button>
                <button class="wx-btn" onclick="WorldExt.act('stall','draw',10)">十连 · 耗900怨气值</button>
                <small style="font-size:10.5px;color:var(--imt,#9a8c6e);">主持手摇抽奖（结果供剧情参考）</small>
            </div>`;
        },

        act(s, action, payload) {
            if (action !== 'draw') return;
            const n = Number(payload) || 1;
            const cost = n >= 10 ? 900 : 100;
            if (s.value < cost / 10) return `怨气值不足（需${cost}燃料刻度）`;
            s.value = Math.max(0, s.value - cost / 10);
            const results = [];
            for (let i = 0; i < n; i++) {
                let roll = Math.random() * 100;
                let got = POOL[0];
                for (const p of POOL) { roll -= p.w; if (roll <= 0) { got = p; break; } }
                results.push(got);
                if (got.name !== '谢谢惠顾') { const tag = `[${RARITY_COLOR[got.rarity]}]`; if (!s.items.some(x => x.includes(got.name))) s.items.unshift(got.name); }
            }
            const good = results.filter(r => r.name !== '谢谢惠顾');
            s.draws.unshift(`怨气抽奖×${n}：${good.length ? good.map(r => r.name).join('、') : '全军覆没'}`);
            if (s.draws.length > 8) s.draws.length = 8;
            return good.length ? `抽中：${good.map(r => r.name).join('、')}` : '谢谢惠顾 ×' + n;
        },

        directive(s) {
            if (s.value >= 80) return `怨气值${s.value}·滔天：本端系统燃料足，可安排一次抽奖事件（大奖概率真实偏低——十连九空是常态，抽中大力药水须写秃顶爆衣的社死代价）`;
            if (s.value >= 50) return `怨气值${s.value}·冲天：顾客被坑的名场面是攒怨气的正路，写摊位的鸡飞狗跳往足了写`;
            if (s.value >= 20) return `怨气值${s.value}·渐积：正常经营中，可偶遇小坑小赚的市井桥段`;
            return `怨气值${s.value}·不足：系统燃料见底，摊位得先整出点「值得被怨」的花活`;
        }
    };

    if (window.WorldExt) WorldExt.define('ditandali', [martialMod, stallMod]);
})();
