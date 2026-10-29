/**
 * 斩神 · 界专属扩展（v3.38.0）
 * 🌀 精神力阶梯·禁墟录——凡人之躯到克莱因境拾级而上，禁墟能力与等级同盘追踪
 * 🏥 病院羁绊·诸神录——与阳光精神病院诸神的羁绊与互动记录
 */
(function () {
    'use strict';

    /* 原著精神力六境：凡人之躯 → 盏境（觉醒菜鸟，感知十米）→ 池境（精神力外放）
       → 川境（随心调动，国家级战力）→ 海境（可释放领域，凡人巅峰）→ 无量境（近乎无穷）
       → 克莱因境（取之不尽，破维度——因近似克莱因瓶得名） */
    const REALMS = ['凡人之躯', '盏境', '池境', '川境', '海境', '无量境', '克莱因境'];

    /* 原著禁墟分级：无害 → 低危 → 危险 → 高危 → 超高危 → 王墟（人族自孕）→ 神墟（神明赐予） */
    const RUIN_LEVELS = ['无害', '低危', '危险', '高危', '超高危', '王墟', '神墟'];

    /* ==================== 模块一：精神力阶梯·禁墟录 ==================== */
    const spiritMod = {
        id: 'spirit', icon: '🌀', name: '精神力阶梯 · 禁墟录',
        tip: '精神力六境步步登天——盏境觉醒，池境外放，川境成势，海境称雄，无量境无穷，克莱因境破维度；禁墟能力逐级解锁',
        contract: '精神力境界（凡人之躯/盏境/池境/川境/海境/无量境/克莱因境）；禁墟（名称与等级，如「时之王·神墟」）；精神韧性（0-100整数）',
        init: () => ({ realm: 0, ruin: '', level: '', resilience: 50, log: [] }),

        /* v3.38.0 状态板摘要：🌀 川境 ·时之王 */
        summary(s) {
            if (s.realm <= 0 && !s.ruin) return [];
            const items = [];
            if (s.realm > 0) items.push({ i: '🌀', v: REALMS[s.realm], l: s.ruin || '' });
            else if (s.ruin) items.push({ i: '🌀', v: '未入品', l: s.ruin });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            /* 境界：从 status/realm/精神力境界 等候选键解析（长名先匹配，避免「盏」误吞「无量」） */
            const raw = String(WXH.pick(vars, ['精神力境界', '精神力', '境界', 'realm', 'status']) || '');
            let idx = -1;
            const PAT = [/克莱因/, /无量/, /海境/, /川境/, /池境/, /盏境/];
            for (let i = 0; i < PAT.length; i++) {
                if (PAT[i].test(raw)) { idx = i + 1; break; }
            }
            if (/凡人之躯|未觉醒/.test(raw)) idx = 0;
            if (idx !== s.realm) { s.realm = idx; d = true; }
            /* 禁墟名称与等级 */
            const ruin = String(WXH.pick(vars, ['禁墟', '禁墟能力', 'ruin']) || '').trim();
            if (ruin && ruin !== '无' && ruin !== '—' && ruin !== s.ruin) { s.ruin = ruin.slice(0, 16); d = true; }
            const lvRaw = String(WXH.pick(vars, ['禁墟等级', '禁墟评级', '序列']) || '');
            const lv = RUIN_LEVELS.find(l => lvRaw.indexOf(l) >= 0);
            if (lv && lv !== s.level) { s.level = lv; d = true; }
            /* 精神韧性（0-100） */
            const res = WXH.pick(vars, ['精神韧性', '韧性']);
            if (res != null) {
                const n = Number(String(res).match(/-?\d{1,3}/) && String(res).match(/-?\d{1,3}/)[0]);
                if (Number.isFinite(n)) { const c = Math.max(0, Math.min(100, Math.round(n))); if (c !== s.resilience) { s.resilience = c; d = true; } }
            }
            /* 破境留痕 */
            if (d && idx > (s._lastRealm || 0)) {
                s.log.unshift(`第${round}回：${REALMS[s._lastRealm || 0]} → ${REALMS[idx]}`);
                if (s.log.length > 6) s.log.length = 6;
            }
            s._lastRealm = idx;
            return d;
        },

        html(s) {
            const cur = s.realm > 0 ? REALMS[s.realm] : null;
            const ladder = WXH.card('精神力六境', `<div class="wx-stepper">
                ${REALMS.map((r, i) => `<div class="wx-step ${i === s.realm ? 'on' : i < s.realm ? 'done' : ''}" style="font-size:10.5px;">${i > 0 && i < s.realm ? '✓ ' : ''}${r.replace(/境$/, '')}</div>`).join('')}
            </div>`, {
                icon: '🌀', grow: true, tag: cur || '未觉醒'
            });
            const ruinCard = WXH.card('禁墟档案', WXH.kv([
                ['禁墟', s.ruin || '未觉醒'],
                ['等级', s.level || '待检测'],
                ['韧性', String(s.resilience)]
            ]), { icon: '⚡', grow: true, tag: s.level || '待检测' });
            const lvBar = WXH.card('精神韧性', WXH.bar(s.resilience, s.resilience >= 60 ? '#7ec8a0' : s.resilience >= 30 ? '#e0a84c' : '#e07070', `${s.resilience}/100`), { icon: '🧘', grow: true });
            const log = s.log.length ? WXH.card('破境录', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📈', grow: true }) : '';
            return `${ladder}${ruinCard}${lvBar}${log}
            <div class="wx-banner">六境即位阶：盏境十米之内觉醒，川境已是国家级战力，海境释放领域连神明都忌惮；禁墟是超凡的根——王墟由人族自孕，神墟是神的赐予；每一次破境都须有契机、铺垫与代价，不写在破境录里的跃升不算数。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.realm > 0) {
                t.push(`当前${REALMS[s.realm]}${s.ruin ? `，禁墟「${s.ruin}」${s.level ? `（${s.level}）` : ''}` : ''}：精神力能力按原著境界逻辑如实呈现——越级硬撼神明必付代价`);
            } else {
                t.push('凡人之躯：直面神秘只能靠战术、装备与跑位——活着才有下一轮；觉醒须有契机（濒死激发/神秘侵蚀/神明赐予），不许无端觉醒');
            }
            if (s.resilience < 30) t.push(`精神韧性仅 ${s.resilience}：精神攻击与神秘低语对你威胁倍增，幻觉与心魔须如实演绎`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：病院羁绊·诸神录 ==================== */
    const hospitalMod = {
        id: 'hospital', icon: '🏥', name: '病院羁绊 · 诸神录',
        tip: '阳光精神病院的特殊病人——六间病房住着六位神明，护工编号001-434；与神的羁绊是这个世界最珍贵的礼物',
        contract: '病院权限（无/访客/护工/受托者，凭剧情演进）；神明羁绊[]（已结缘的神明名，如尼克斯/孙悟空/梅林）；护工故识[]（熟悉的护工名）',
        init: () => ({ access: '', gods: [], nurses: [], events: [] }),

        /* v3.38.0 状态板摘要：🏥 护工 ·羁绊·孙悟空 */
        summary(s) {
            if (!s.access && !s.gods.length) return [];
            return [{
                i: '🏥', v: s.access || '无权限',
                l: s.gods.length ? `羁绊·${s.gods[s.gods.length - 1].name}` : '',
                tone: s.access === '护工' || s.access === '受托者' ? 'ok' : ''
            }];
        },

        read(s, vars, round) {
            let d = false;
            /* 病院权限（按原著：护工须有来历与入职剧情，受托者须神明亲授） */
            const acc = String(WXH.pick(vars, ['病院权限', '病院身份', '护工编号']) || '').trim();
            if (acc && acc !== '无' && acc !== '—' && acc !== s.access && acc.length <= 10) { s.access = acc; d = true; }
            /* 神明羁绊名单 */
            WXH.asArr(WXH.pick(vars, ['神明羁绊', '结缘神明', '神明'])).forEach(x => {
                const name = String(x).slice(0, 12);
                if (name && name !== '无' && !s.gods.some(g => g.name === name)) {
                    s.gods.unshift({ name, round });
                    d = true;
                }
            });
            if (s.gods.length > 8) s.gods.length = 8;
            /* 护工故识名单 */
            WXH.asArr(WXH.pick(vars, ['护工故识', '护工关系', '熟识护工'])).forEach(x => {
                const name = String(x).slice(0, 12);
                if (name && name !== '无' && !s.nurses.some(n => n.name === name)) {
                    s.nurses.unshift({ name, round });
                    d = true;
                }
            });
            if (s.nurses.length > 10) s.nurses.length = 10;
            return d;
        },

        html(s) {
            const accCard = s.access
                ? WXH.card('病院权限', `<div class="wx-gauge-main"><b style="color:#a8c4c8;font-size:16px;">🏥 ${WXH.esc(s.access)}</b><em style="color:#8a9aa0;">推门而入的资格</em></div>`, { icon: '🏥', tag: '已在册' })
                : WXH.empty('🏥', '尚无病院权限', '阳光精神病院不是想进就进的地方——护工有编号与来历，访客须有由头，受托者须神明亲授；与病院的交集按剧情合理展开');
            const gods = s.gods.length ? WXH.card(`神明羁绊 · ${s.gods.length}位`, s.gods.map(g => `<div class="wx-kv"><b>${WXH.esc(g.name)}</b><span style="font-size:11px;color:var(--imt,#9a8c6e);">第${g.round}回结缘</span></div>`).join(''), { icon: '✨', grow: true }) : '';
            const nurses = s.nurses.length ? WXH.card(`护工故识 · ${s.nurses.length}人`, s.nurses.map(n => `<div class="wx-kv"><b>${WXH.esc(n.name)}</b><span style="font-size:11px;color:var(--imt,#9a8c6e);">第${n.round}回相识</span></div>`).join(''), { icon: '👷', grow: true }) : '';
            return `${accCard}${gods}${nurses}
            <div class="wx-banner">病院的温度：六间病房住着能重洗大陆的存在——黑夜女神、梅林、孙悟空、吉尔伽美什……他们在此疗伤，也在等人记起他们的名字；羁绊不是 buff，是一个疯癫的神明把你当家人的那一刻。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.access) t.push(`病院权限「${s.access}」：与病院诸神的接触渠道按此权限合理展开——护工可日常巡房，访客须有由头，受托者可承接神明的托付`);
            if (s.gods.length) t.push(`神明羁绊 ${s.gods.length} 位（${s.gods.slice(0, 3).map(g => g.name).join('、')}）：神明对玩家的态度按原著性格如实演绎——羁绊带来的是牵挂而非战力加成，神明的疯与执念不许抹平`);
            if (s.nurses.length) t.push(`护工故识 ${s.nurses.length} 人（${s.nurses.slice(0, 3).map(n => n.name).join('、')}）：护工多是被收容的神秘，各有来历与分寸，交情按剧情演进`);
            return t.join('；');
        }
    };

    if (window.WorldExt) WorldExt.define('zhanhen', [spiritMod, hospitalMod]);
})();
