/**
 * 完美世界 · 界专属扩展（v3.4.0）
 * 🐉 宝术图鉴与洞天福地——凶兽宝术收集（拓印/传承/参悟）+ 修炼地灵气经营影响突破顺逆
 */
(function () {
    'use strict';

    const ORIGINS = [
        { key: '凶兽拓印', icon: '🐾', desc: '猎凶兽得其宝术拓片，参悟而得' },
        { key: '大教传承', icon: '⛩', desc: '入大教得嫡传，是底蕴级宝术' },
        { key: '古迹拓片', icon: '🏺', desc: '探古迹夺残拓，凶险与机缘并存' },
        { key: '天生神通', icon: '✨', desc: '血脉觉醒的自带之能' }
    ];

    const artMod = {
        id: 'baoshu', icon: '🐉', name: '宝术图鉴 · 洞天福地',
        tip: '宝术是战力命脉——太古十凶级宝术万金难求；修炼地灵气决定突破顺逆',
        contract: '宝术[{名称,来历}]（已修成的宝术）；修炼地{名称,灵气浓度,加成}（当前修炼之地）',
        init: () => ({ arts: [], land: null }),

        read(s, vars, round) {
            let d = false;
            const raw = vars.宝术 || vars.宝术图鉴;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) WXH.asArr(raw).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.arts.some(a => a.name === nm)) {
                    const og = ORIGINS.find(o => nm.includes(o.key.slice(0, 2))) || null;
                    s.arts.push({ name: nm, origin: og ? og.key : '', round }); d = true;
                }
            });
            Object.entries(WXH.asObj(raw)).forEach(([k, v]) => {
                if (!s.arts.some(a => a.name === k)) {
                    const og = ORIGINS.find(o => String(v).includes(o.key.slice(0, 2)));
                    s.arts.push({ name: k, origin: og ? og.key : String(v).slice(0, 30), round }); d = true;
                }
            });
            const ld = WXH.asObj(vars.修炼地 || vars.洞天 || WXH.asObj(vars.福地));
            const name = ld.name || ld.名称 || (typeof vars.修炼地 === 'string' ? vars.修炼地 : '');
            if (name) {
                const dens = WXH.asNum(ld.灵气浓度 || ld.灵气, 60);
                const land = { name: String(name), dens, bonus: String(ld.加成 || ld.bonus || '') };
                if (!s.land || s.land.name !== land.name || s.land.dens !== land.dens) { s.land = land; d = true; }
            }
            if (s.arts.length > 30) s.arts.length = 30;
            return d;
        },

        /* v3.32.2 状态板摘要：🐉 宝术5门 ·🏔 洞天福地 */
        summary(s) {
            const items = [];
            if (s.arts.length) items.push({ i: '🐉', v: `${s.arts.length}门`, l: '宝术' });
            if (s.land) {
                const zone = s.land.dens >= 85 ? '洞天福地' : s.land.dens >= 60 ? '灵气充裕' : s.land.dens >= 30 ? '寻常之地' : '灵气稀薄';
                items.push({ i: '🏔', v: String(s.land.dens), l: zone, tone: s.land.dens >= 85 ? 'ok' : s.land.dens < 30 ? 'bad' : '' });
            }
            return items;
        },

        html(s) {
            const groups = ORIGINS.map(o => {
                const list = s.arts.filter(a => !a.origin || a.origin === o.key);
                if (!list.length) return '';
                return WXH.card(`${o.icon} ${o.key} · ${list.length}`, list.map(a =>
                    `<div class="wx-kv"><span>第${a.round || '?'}回</span><b>${WXH.esc(a.name)}</b></div>`).join(''), { tag: o.desc });
            }).join('');
            const land = s.land
                ? WXH.card('修炼地 · ' + s.land.name, `${WXH.gauge(s.land.dens, [
                    { max: 29, label: '灵气稀薄', color: '#9a8c6e' },
                    { max: 59, label: '寻常之地', color: '#c8c06a' },
                    { max: 84, label: '灵气充裕', color: '#8fd9a8' },
                    { max: 100, label: '洞天福地', color: '#7ad8b8' }
                ]).html}${s.land.bonus ? WXH.kv([['此地加成', s.land.bonus]]) : ''}`, { icon: '🏔', grow: true })
                : WXH.empty('🏔', '尚无固定修炼地', '石村祖地、大荒秘境、上界道场——安身之处随剧情登记');
            return `${groups || WXH.empty('🐉', '尚未修成宝术', '猎凶兽、入大教、探古迹——宝术拓片到手即可参悟入册')}
            ${land}
            <div class="wx-banner">血脉相性 × 悟性 × 火候：同一门宝术，天骄之手翻江倒海，庸手依样画瓢；顶级宝术的获取须有奇遇与凶险的双重铺垫，绝不轻许。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.arts.length) t.push(`宝术在身（${s.arts.length} 门）：对敌时点明动用的宝术与其火候（初窥/小成/大成），凶兽宝术带有兽形真意；参悟新宝术要有拓片、静悟与顿悟的过程感`);
            if (s.land) t.push(`修炼地「${s.land.name}」灵气${s.land.dens}：突破与疗伤的顺逆应与灵气浓度相称——洞天福地里日进千里，荒山野岭寸进难求`);
            return t.join('；') || '';
        }
    };

    if (window.WorldExt) WorldExt.define('wanmeishijie', [artMod]);
})();
