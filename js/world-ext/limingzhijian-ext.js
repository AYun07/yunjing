/**
 * 黎明之剑 · 界专属扩展（v3.19.0）
 * ⚙ 魔导工坊与奥术阶梯——法师等阶拾级而上，魔导技术树记下每一门手艺
 */
(function () {
    'use strict';

    const RANKS = ['未入门', '学徒', '一级法师', '二级法师', '三级法师', '四级法师', '五级法师', '六级法师', '七级法师', '八级法师', '九级法师', '传奇法师'];

    const magitechMod = {
        id: 'magitech', icon: '⚙', name: '魔导工坊 · 奥术阶梯',
        tip: '法师等阶拾级而上——学徒起步，一级至九级，传奇封顶；魔导技术树：从符文识读到魔网接口，每门手艺都是饭碗',
        contract: '境界（法师等阶：未入门/学徒/一级至九级/传奇法师）；魔导技术[]（已掌握的魔导技术清单，如：符文识读、机械装配）；魔导造诣（0-100，魔导技术研究的积累度）',
        init: () => ({ rank: 0, tech: [], craft: 0 }),

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.法师等阶 || WXH.asObj(vars.境界).法师等阶 || vars.status || '');
            const idx = RANKS.findIndex(r => r && raw.includes(r));
            if (idx >= 0 && idx !== s.rank) { s.rank = idx; d = true; }
            WXH.asArr(vars.魔导技术 || vars.已掌握技术 || vars.技术清单).forEach(x => {
                const str = String(x).trim();
                if (str && !s.tech.includes(str)) { s.tech.unshift(str); d = true; }
            });
            if (s.tech.length > 15) s.tech.length = 15;
            const craft = WXH.pick(vars, ['魔导造诣', '技术积累']);
            if (craft != null) {
                const m = String(craft).match(/(\d{1,3})/);
                if (m) { const v = Math.min(100, Number(m[1])); if (v !== s.craft) { s.craft = v; d = true; } }
            }
            return d;
        },

        /* v3.32.2 状态板摘要：⚡ 三级法师 ·⚒ 造诣45 */
        summary(s) {
            if (s.rank === 0 && !s.tech.length && !s.craft) return [];
            const items = [{ i: '⚡', v: RANKS[s.rank], l: s.tech.length ? `技${s.tech.length}门` : '' }];
            if (s.craft > 0) items.push({ i: '⚒', v: String(s.craft), l: '造诣', tone: s.craft >= 60 ? 'ok' : '' });
            return items;
        },

        html(s) {
            const shown = [RANKS[0], RANKS[1], RANKS[2], RANKS[4], RANKS[6], RANKS[8], RANKS[10], RANKS[11]];
            const cur = RANKS[s.rank];
            const ladder = WXH.card('法师等阶', `<div class="wx-stepper">
                ${shown.map(r => {
                const i = RANKS.indexOf(r);
                return `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`;
            }).join('')}
            </div>`, {
                icon: '⚡', grow: true, tag: '当前：' + cur
            });
            const craftColor = s.craft >= 60 ? '#d8a04c' : s.craft >= 30 ? '#5fb8d8' : '#b8c49a';
            const craftWord = s.craft >= 60 ? '工坊骨干' : s.craft >= 30 ? '熟练工' : s.craft > 0 ? '学徒工' : '尚未入门';
            const craft = WXH.card(`魔导造诣 · ${s.craft}（${craftWord}）`, `
                <div class="wx-gauge-main"><div class="wx-bar big"><i style="width:${s.craft}%;background:${craftColor};"></i></div><b style="color:${craftColor};">${craftWord}</b></div>
                <div style="margin-top:6px;font-size:11.5px;color:#a89878;">这个时代给手艺人的礼遇：懂符文的识字人，比会骑马的贵族值钱</div>`,
                { icon: '⚒', grow: true });
            const tech = s.tech.length ? WXH.card(`魔导技术树 · ${s.tech.length}门`, `${s.tech.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:12px;">⚙ ${WXH.esc(t)}</b></div>`).join('')}`, { icon: '🔧', grow: true }) : '';
            return `${ladder}${craft}${tech}
            <div class="wx-banner">黎明是一寸一寸亮起来的：等阶跃升须有师承、苦修或生死一线的契机；魔导技术每加一门，生计就宽一分——但工坊的规矩是图纸先看三遍再点火；造诣攒够了，时代自然会来找你。</div>`;
        },

        directive(s) {
            const t = [];
            t.push(`法师等阶${RANKS[s.rank]}：施法表现须贴合等阶（学徒连火苗都点不稳，九级足以主导一场战役），越级施法必付代价`);
            if (s.craft > 0) t.push(`魔导造诣 ${s.craft}：技术剧情按造诣给戏份——造诣不足时碰新机器，先写失败与学费`);
            if (s.tech.length) t.push(`已掌握魔导技术 ${s.tech.length} 门（${s.tech.slice(0, 5).join('、')}）：涉及时写实操细节（装配、校准、点火、故障），不写成名词罗列`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('limingzhijian', [magitechMod]);
})();
