/**
 * 神秘复苏 · 界专属扩展（v3.19.0）
 * 🕯 禁锢阶梯——C/B/A/S 四级禁锢拾级而上，S级要拿命换；黄金配额与所驭厉鬼同盘追踪
 * ☠ 灵异档案——遭遇过的厉鬼按「等级·规律·破绽」建档，规则怪谈的命就是档案的命
 */
(function () {
    'use strict';

    /* 原著禁锢阶梯：普通人→C级→B级→A级→S级（S级须付出感官或肢体级别的永久代价） */
    const RANKS = ['普通人', 'C级禁锢', 'B级禁锢', 'A级禁锢', 'S级禁锢'];
    /* 原著鬼物等级：S毁灭级 / A灾难级 / B危险级 / C限制级 */
    const GHOST_TIERS = ['S', 'A', 'B', 'C'];
    const CN_NUM = '零一二三四五六七八九';

    /* ==================== 模块一：禁锢阶梯 ==================== */
    const sealMod = {
        id: 'seal', icon: '🕯', name: '禁锢阶梯 · 黄金配额',
        tip: '四级禁锢以命换力——C级起步、S级拿感官肢体抵账；黄金克鬼，克数就是命',
        contract: '境界（当前禁锢等级，注明所驭厉鬼如「B级禁锢·旧镜」）；黄金（当前持有黄金克数）；厉鬼[]（已驾驭或封印的厉鬼清单，注明等级）',
        init: () => ({ rank: 0, ghost: '', gold: null, ghosts: [], log: [] }),

        /* v3.32.2 状态板摘要：🕯 B级禁锢·旧镜 ·黄金320g ·驭鬼2 */
        summary(s) {
            if (s.rank <= 0 && s.gold == null && !s.ghosts.length) return [];
            const items = [];
            if (s.rank > 0) items.push({
                i: '🕯', v: RANKS[s.rank],
                l: s.ghost ? `驭${s.ghost}` : (s.ghosts.length ? `驭鬼${s.ghosts.length}` : '')
            });
            if (s.gold != null) items.push({ i: '◈', v: `${s.gold}g`, l: '黄金' });
            return items;
        },

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.realm || vars.禁锢 || vars.status || '');
            /* 长名先匹配，避免「C级」误吞 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 所驭厉鬼名：「B级禁锢·旧镜」→旧镜 */
            const gm = raw.match(/[CSAB]级禁锢[·•:：]?\s*(.{1,12})/);
            const ghost = gm ? gm[1].trim() : '';
            if (ghost && ghost !== s.ghost) { s.ghost = ghost; d = true; }
            /* 黄金克数 */
            const gold = WXH.pick(vars, ['黄金', '黄金克数', 'gold']);
            if (gold != null) {
                const m = String(gold).match(/(\d{1,7})/);
                if (m) { const v = Number(m[1]); if (v !== s.gold) { s.gold = v; d = true; } }
            }
            /* 厉鬼清单 */
            WXH.asArr(vars.厉鬼 || vars.已驭厉鬼 || vars.所驭厉鬼 || vars.鬼物).forEach(x => {
                const str = String(x).trim();
                if (str && !s.ghosts.some(g => g.name === str || g.name.includes(str))) {
                    const tier = GHOST_TIERS.find(t => str.indexOf(t + '级') >= 0) || '';
                    s.ghosts.unshift({ name: str, tier, round });
                    d = true;
                }
            });
            if (s.ghosts.length > 10) s.ghosts.length = 10;
            /* 跃升留痕 */
            if (d && idx > (s._lastRank || 0)) {
                s.log.unshift(`第${round}回：${RANKS[s._lastRank || 0]} → ${RANKS[idx]}`);
                if (s.log.length > 6) s.log.length = 6;
            }
            s._lastRank = idx;
            return d;
        },

        html(s) {
            const cur = s.rank > 0 ? RANKS[s.rank] : null;
            const ladder = WXH.card('禁锢阶梯', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i > 0 && i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '🕯', grow: true, tag: cur ? `当前：${cur}${s.ghost ? '·' + s.ghost : ''}` : '未涉灵异'
            });
            const gold = s.gold != null
                ? WXH.card('黄金配额', `<div class="wx-gauge-main"><b style="color:#e8c45c;font-size:18px;">◈ ${s.gold.toLocaleString()} g</b><em style="color:#a89878;">鬼力不侵的硬通货</em></div>`, { icon: '◈', tag: '克鬼' })
                : WXH.empty('◈', '身无寸金', '黄金隔绝鬼的感知与灵异辐射——总部配额、黑市金店、遗物继承都是来路；克数就是命');
            const ghosts = s.ghosts.length ? WXH.card(`所驭厉鬼 · ${s.ghosts.length}只`, `${s.ghosts.map(g => `<div class="wx-kv"><span>${g.tier ? g.tier + '级' : '未评级'}</span><b>${WXH.esc(g.name)}${g.round ? ` <i style="font-style:normal;opacity:.55;font-size:11px;">·第${g.round}回得</i>` : ''}</b></div>`).join('')}`, { icon: '☠', grow: true }) : '';
            const log = s.log.length ? WXH.card('跃升代价录', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📉', grow: true }) : '';
            return `${ladder}${gold}${ghosts}${log}
            <div class="wx-banner">鬼无法被杀死——能对付鬼的只有鬼；禁锢是把厉鬼封进载体或自身，以命维持平衡：C级禁锢折寿减元，B级伴随精神污染，A级留永久创伤，S级要拿感官或肢体抵账——跃升没有白给的。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank > 0) {
                t.push(`当前${RANKS[s.rank]}${s.ghost ? '（所驭：' + s.ghost + '）' : ''}：禁锢之力可用，但每次动用都须写代价（感官磨损/精神污染/寿命折损按级别递增），绝不无偿`);
            } else {
                t.push('尚无禁锢之力：面对厉鬼只能靠观察、规律与黄金周旋——跑得掉才有下回');
            }
            if (s.gold != null) t.push(`黄金持有 ${s.gold}g：可隔绝鬼的感知与灵异辐射，克数就是命——不足时写拮据，充裕时也别挥霍`);
            if (s.ghosts.length) t.push(`所驭厉鬼 ${s.ghosts.length} 只（${s.ghosts.slice(0, 3).map(g => g.name).join('、')}）：厉鬼各有其规则与脾气，驱使写反噬风险`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：灵异档案 ==================== */
    const fileMod = {
        id: 'ghostfile', icon: '☠', name: '灵异档案 · 规律簿',
        tip: '厉鬼杀人有规律可循——等级、规律、破绽三栏建档，档案的厚度就是命的长度',
        contract: '灵异档案[]（已遭遇厉鬼的条目，格式「名称/等级/杀人规律/破绽」四段斜杠分隔，或分字段上报）',
        init: () => ({ files: [] }),

        /* v3.32.2 状态板摘要：☠ 档案3件 ·敲门鬼C（最高危亮红） */
        summary(s) {
            if (!s.files.length) return [];
            const hasS = s.files.some(f => /S/.test(f.tier || ''));
            const hasA = s.files.some(f => /A/.test(f.tier || ''));
            return [{
                i: '☠', v: `档案${s.files.length}件`,
                l: s.files[0] ? String(s.files[0].name).slice(0, 6) : '',
                tone: hasS ? 'bad' : hasA ? 'warn' : ''
            }];
        },

        read(s, vars, round) {
            let d = false;
            /* 兼容：数组条目「敲门鬼/C级/须三次回应方触发索命/不进门只叩门」或对象 {名称,等级,规律,破绽}
               原始数组直取（asArr 会把对象扁平成名字串，丢等级/规律/破绽字段） */
            const raw = vars.灵异档案 || vars.厉鬼档案 || vars.ghostFiles || vars.档案;
            const items = Array.isArray(raw) ? raw : WXH.asArr(raw);
            items.forEach(x => {
                if (x == null || x === '') return;
                const o = (x && typeof x === 'object' && !Array.isArray(x)) ? x : null;
                const str = String(o ? (o.name || o.名称 || '') : x).trim();
                if (!str) return;
                const parts = str.split(/[\/／|｜]/).map(p => p.trim()).filter(Boolean);
                const name = String(o ? (o.name || o.名称 || parts[0]) : (parts[0] || str)).slice(0, 20);
                const tier = String(o ? (o.tier || o.等级 || parts[1] || '') : (parts[1] || '')).slice(0, 6);
                const rule = String(o ? (o.rule || o.规律 || parts[2] || '') : (parts[2] || '')).slice(0, 40);
                const flaw = String(o ? (o.flaw || o.破绽 || parts[3] || '') : (parts[3] || '')).slice(0, 40);
                if (!s.files.some(f => f.name === name)) {
                    s.files.unshift({ name, tier, rule, flaw, round });
                    d = true;
                }
            });
            if (s.files.length > 14) s.files.length = 14;
            return d;
        },

        html(s) {
            if (!s.files.length) return WXH.empty('☠', '档案柜还空着', '遭遇第一起灵异事件后，AI 会把厉鬼的等级、杀人规律与破绽归档在这里——先剥规律，再谈活命');
            return `${WXH.card(`已归档厉鬼 · ${s.files.length}件`, s.files.map(f => `<div class="wx-task" style="flex-direction:column;align-items:stretch;">
                <b style="color:var(--itx,#e8dcc0);">${WXH.esc(f.name)} <i style="font-style:normal;font-size:10.5px;padding:1px 7px;border-radius:8px;background:rgba(122,176,168,.14);color:#7ab0a8;">${WXH.esc(f.tier || '未评级')}</i></b>
                ${f.rule ? `<div class="wx-kv"><span>杀人规律</span><b style="font-weight:400;">${WXH.esc(f.rule)}</b></div>` : ''}
                ${f.flaw ? `<div class="wx-kv"><span>破绽</span><b style="font-weight:400;">${WXH.esc(f.flaw)}</b></div>` : ''}
            </div>`).join(''), { icon: '☠', grow: true })}
            <div class="wx-banner">厉鬼杀人有规律可循——完整度越高的鬼越脱离规则，触之即死；档案不全的案子别硬查，规律没剥清的鬼别硬碰。</div>`;
        },

        directive(s) {
            if (!s.files.length) return '';
            return `灵异档案已归档 ${s.files.length} 件：已归档的厉鬼若再登场，其行为必须严格符合档案里的杀人规律与破绽（规则怪谈的铁则：先埋后收，不临时改规则）；档案之外的厉鬼新登场时，须在正文中公平埋下可被观察的规律线索。`;
        }
    };

    if (window.WorldExt) WorldExt.define('shenmifusu', [sealMod, fileMod]);
})();
