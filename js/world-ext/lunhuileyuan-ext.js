/**
 * 轮回乐园 · 界专属扩展（v3.19.0）
 * ⟳ 乐园面板与阶位阶梯——契约者阶位拾级而上；属性面板、乐园币与技能栏同盘追踪
 */
(function () {
    'use strict';

    const RANKS = ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶', '七阶', '八阶', '九阶', '十阶', '绝强者', '至强者'];
    const ATTRS = [
        { k: '力量', c: '#e05858' }, { k: '敏捷', c: '#e8a04c' }, { k: '体力', c: '#8fd9a8' },
        { k: '智力', c: '#5fb8d8' }, { k: '幸运', c: '#b890f0' }, { k: '魅力', c: '#d88ab8' }
    ];
    const EQUIP_GRADES = ['无品级', '白色', '绿色', '蓝色', '紫色', '暗紫色', '淡金色', '金色', '传说级', '史诗级'];

    const paradiseMod = {
        id: 'paradise', icon: '⟳', name: '乐园面板 · 阶位阶梯',
        tip: '契约者阶位拾级而上——一阶起步，十阶封顶，其上还有绝强者与至强者；属性面板、乐园币与技能栏一屏追踪',
        contract: '阶位（契约者阶位：一阶/二阶/…/十阶，其上为绝强者、至强者）；乐园币（当前余额数字）；技能[]（已掌握技能清单，标注品质更佳）；属性{力量,敏捷,体力,智力,幸运,魅力}（属性面板数值）',
        init: () => ({ rank: 0, coins: null, skills: [], attrs: {} }),

        /* v3.32.2 状态板摘要：⟳ 三阶 ·乐园币24000 ·技能5 */
        summary(s) {
            const l = [
                s.coins != null ? `乐园币${s.coins.toLocaleString()}` : '',
                s.skills.length ? `技能${s.skills.length}` : ''
            ].filter(Boolean).join('·');
            return [{ i: '⟳', v: RANKS[s.rank], l }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.阶位 || vars.契约者阶位 || vars.品级 || vars.境界 || vars.status || '');
            /* 「十阶」须先于「一阶」匹配，避免子串误判；「绝强者/至强者」单列 */
            let idx = -1;
            if (/至强者/.test(raw)) idx = 11;
            else if (/绝强者/.test(raw)) idx = 10;
            else if (/十阶/.test(raw)) idx = 9;
            else {
                const m = raw.match(/([一二三四五六七八九])阶/);
                if (m) idx = '一二三四五六七八九'.indexOf(m[1]);
                else if (/一阶/.test(raw)) idx = 0;
            }
            if (idx > s.rank) { s.rank = idx; d = true; }
            else if (idx >= 0 && idx !== s.rank) { s.rank = idx; d = true; }
            const coins = WXH.pick(vars, ['乐园币', '乐园币余额']);
            if (coins != null) {
                const m = String(coins).match(/(\d{1,9})/);
                if (m) { const v = Number(m[1]); if (v !== s.coins) { s.coins = v; d = true; } }
            }
            WXH.asArr(vars.技能 || vars.已掌握技能).forEach(x => {
                const str = String(x).trim();
                if (str && !s.skills.includes(str)) { s.skills.unshift(str); d = true; }
            });
            if (s.skills.length > 12) s.skills.length = 12;
            const a = WXH.asObj(vars.属性 || vars.属性面板);
            for (const { k } of ATTRS) {
                if (a[k] != null) {
                    const n = Number(a[k]) || 0;
                    if (n !== (s.attrs[k] || 0)) { s.attrs[k] = n; d = true; }
                }
            }
            return d;
        },

        html(s) {
            const ladder = WXH.card('契约者阶位', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🏅', grow: true, tag: '当前：' + RANKS[s.rank]
            });
            const attrRows = ATTRS.filter(a => s.attrs[a.k] != null);
            const attrs = attrRows.length ? WXH.card('属性面板', `
                <div class="wx-kvs">${attrRows.map(a => `<div class="wx-kv"><span>${a.k}</span><b style="color:${a.c};">${WXH.esc(s.attrs[a.k])}</b></div>`).join('')}</div>`,
                { icon: '📊', tag: '四维' }) : '';
            const coins = s.coins != null
                ? WXH.card('乐园币', `<div class="wx-gauge-main"><b style="color:#e8c45c;font-size:18px;">◈ ${s.coins.toLocaleString()}</b><em style="color:#a89878;">乐园硬通货</em></div>`, { icon: '◈', tag: '余额' })
                : WXH.empty('◈', '乐园币尚未入账', '完成任务、出售缴获与交易区倒卖都是来钱路——每一枚都标着风险价');
            const skills = s.skills.length ? WXH.card(`技能栏 · ${s.skills.length}项`, `${s.skills.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">✦ ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '✦', grow: true }) : '';
            return `${ladder}${attrs}${coins}${skills}
            <div class="wx-banner">乐园不养闲人：阶位跃升要靠属性总和破壁障加突破考核，属性要拿药剂与苦修去喂；技能栏每亮一行，都在下个衍生世界多一分活路；装备品质从无品级到史诗级拾级而上（${EQUIP_GRADES.join(' → ')}），缴获先看品质再看出处；乐园币永远不够花——优先买保命的，再买变强的。</div>`;
        },

        directive(s) {
            const t = [];
            t.push(`契约者阶位${RANKS[s.rank]}：实力表现须贴合阶位（一阶新人靠装备与谨慎，八阶足以左右一场任务战局，绝强者与至强者是位面级存在），越阶硬撼必付代价`);
            if (s.coins != null) t.push(`乐园币余额 ${s.coins.toLocaleString()}：采购、药剂与情报都要花钱，钱紧时写取舍`);
            if (s.skills.length) t.push(`技能栏 ${s.skills.length} 项（${s.skills.slice(0, 4).join('、')}）：技能动用写实效与代价，不写成招式播报`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('lunhuileyuan', [paradiseMod]);
})();
