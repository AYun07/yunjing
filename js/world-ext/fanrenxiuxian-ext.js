/**
 * 凡人修仙传 · 界专属扩展（v3.26.0）
 * ☯ 仙路长梯——炼气十三层数着走，筑基结丹元婴化神炼虚合体大乘一路长征；灵石身家与寿元同盘追踪
 * ⚗ 储物袋账簿——已移交 PlayerKit 通用背包（js/player-kit.js fanrenxiuxian 定制：
 *    法器/丹药/功法/灵药灵材/符箓阵盘五品类 + 囤积点名 + 手动增删），此处不再重复实现
 */
(function () {
    'use strict';

    /* 原著境界阶梯：炼气→筑基→结丹→元婴→化神（人界）→炼虚→合体→大乘→渡劫（飞升）→真仙→金仙→太乙→大罗（仙界） */
    const RANKS = ['炼气', '筑基', '结丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙', '金仙', '太乙', '大罗'];
    const STAGE = ['初期', '中期', '后期', '大圆满'];
    /* 中文数字（一至十五：凝气/炼气层数用） */
    function cnNum(str) {
        const CN = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
        if (!str) return 0;
        if (/^十$/.test(str)) return 10;
        if (/^十./.test(str)) return 10 + (CN[str[1]] || 0);
        if (/^.十/.test(str)) return (CN[str[0]] || 1) * 10 + (CN[str[2]] || 0);
        return CN[str] || 0;
    }

    /* ==================== 模块一：仙路长梯 ==================== */
    const ladderMod = {
        id: 'ladder', icon: '☯', name: '仙路长梯 · 灵石寿元',
        tip: '炼气十三层数着走，筑基方入修士之列，元婴称一方巨擘，大乘渡劫方窥仙门——灵石身家与寿元大限同盘追踪',
        contract: '境界（当前境界含层数与期段，如「炼气五层」「筑基中期」「元婴后期」；境界跃升当轮务必更新）；灵石（当前灵石余额数字，注明下品/中品/上品更佳）；寿元（当前寿元概况，如「约余百载」）；资质（灵根资质，如「四灵根·伪灵根」）',
        init: () => ({ rank: -1, layer: 0, stage: '', stones: null, life: '', root: '', log: [] }),

        read(s, vars, round) {
            let d = false;
            const raw = String(vars.境界 || vars.realm || vars.修为 || vars.status || '');
            /* 长名先匹配（自尾向头），避免「炼虚」吞「炼气」一类的子串误判 */
            let idx = -1;
            for (let i = RANKS.length - 1; i >= 0; i--) {
                if (raw.indexOf(RANKS[i]) >= 0) { idx = i; break; }
            }
            if (idx !== s.rank) { s.rank = idx; d = true; }
            /* 炼气层数：「炼气十三层」→13；十三层圆满按13计 */
            const lm = raw.match(/([一二三四五六七八九十]{1,3})层/);
            const layer = lm ? cnNum(lm[1]) : 0;
            if (idx === 0 && layer !== s.layer) { s.layer = layer; d = true; }
            /* 期段：筑基以上「初期/中期/后期/大圆满」 */
            let stage = '';
            for (const st of STAGE) { if (raw.indexOf(st) >= 0) { stage = st; break; } }
            if (stage !== s.stage) { s.stage = stage; d = true; }
            /* 灵石身家 */
            const stones = WXH.pick(vars, ['灵石', '灵石余额', '下品灵石']);
            if (stones != null) {
                const m = String(stones).match(/(\d{1,9})/);
                if (m) { const v = Number(m[1]); if (v !== s.stones) { s.stones = v; d = true; } }
            }
            /* 寿元与灵根 */
            const life = WXH.pick(vars, ['寿元', '寿数']);
            if (life != null && String(life) !== s.life) { s.life = String(life); d = true; }
            const root = WXH.pick(vars, ['灵根', '资质', '灵根资质']);
            if (root != null && String(root) !== s.root) { s.root = String(root).slice(0, 16); d = true; }
            /* 跃升留痕（凡人流的每一步都是熬出来的，值得记账） */
            if (d && idx > (s._lastRank || -1)) {
                s.log.unshift(`第${round}回：${s._lastRank >= 0 ? RANKS[s._lastRank] : '凡人'} → ${RANKS[idx]}${idx > 0 && stage ? stage : idx === 0 && layer ? '·' + layer + '层' : ''}`);
                if (s.log.length > 6) s.log.length = 6;
            }
            s._lastRank = idx;
            return d;
        },

        /* v3.32.2 状态板摘要：☯ 筑基中期 ·寿元约余百载 ·灵石12,000 */
        summary(s) {
            if (s.rank < 0 && s.stones == null && !s.life && !s.root) return [];
            const items = [];
            if (s.rank >= 0) {
                const sub = s.rank === 0 && s.layer ? `${s.layer}层` : (s.rank > 0 && s.stage ? s.stage : '');
                items.push({ i: '☯', v: RANKS[s.rank], l: sub });
            }
            if (s.stones != null) items.push({ i: '◈', v: s.stones.toLocaleString(), l: '灵石' });
            if (s.life) items.push({ i: '⏳', v: s.life, l: '寿元' });
            return items;
        },

        html(s) {
            const cur = s.rank >= 0 ? RANKS[s.rank] + (s.rank === 0 && s.layer ? '·' + s.layer + '层' : (s.rank > 0 && s.stage ? s.stage : '')) : null;
            const ladder = WXH.card('仙路长梯', `<div class="wx-stepper">
                ${RANKS.map((r, i) => `<div class="wx-step ${i === s.rank ? 'on' : i < s.rank ? 'done' : ''}">${i < s.rank ? '✓ ' : ''}${r}</div>`).join('')}
            </div>`, {
                icon: '☯', grow: true, tag: cur ? `当前：${cur}` : '凡人·未启灵根'
            });
            const stones = s.stones != null
                ? WXH.card('灵石身家', `<div class="wx-gauge-main"><b style="color:#e8c45c;font-size:18px;">◈ ${s.stones.toLocaleString()}</b><em style="color:#a89878;">修真界硬通货</em></div>`, { icon: '◈', tag: '钱袋' })
                : WXH.empty('◈', '钱袋空空', '坊市讨生活、门派月例、任务缴获与秘境捡漏都是来钱路——修仙烧钱，穷字能写尽修士百态');
            const kvs = [];
            if (s.root) kvs.push(['灵根资质', s.root]);
            if (s.life) kvs.push(['寿元', s.life]);
            const info = kvs.length ? WXH.card('修仙档案', `<div class="wx-kvs">${kvs.map(p => `<div class="wx-kv"><span>${p[0]}</span><b>${WXH.esc(p[1])}</b></div>`).join('')}</div>`, { icon: '📜' }) : '';
            const log = s.log.length ? WXH.card('破境留痕', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📈', grow: true }) : '';
            return `${ladder}${info}${stones}${log}
            <div class="wx-banner">境界是铁律：炼气一层层数着走，筑基是仙凡分水岭，元婴在人界已是一方巨擘——越阶挑战须有天大机缘与底牌，隔一小层次就是天堑；寿元是大限，境界不至寿元先尽，「坐化」是修真界最常见的死法；灵石即修为，账要笔笔算清。</div>`;
        },

        directive(s) {
            const t = [];
            if (s.rank >= 0) {
                t.push(`当前境界${RANKS[s.rank]}${s.rank === 0 && s.layer ? '第' + s.layer + '层' : (s.rank > 0 && s.stage ? s.stage : '')}：实力表现须贴合境界（炼气是引气入体的低阶修士，筑基可御器远遁，结丹寿五百载，元婴可夺舍重生），越阶硬撼必付代价，苟道是常态`);
            } else {
                t.push('尚未踏入仙途：只是一介凡人，仙凡之隔云泥之别——测灵根是入界第一关');
            }
            if (s.stones != null) t.push(`灵石余额 ${s.stones.toLocaleString()}：丹药功法法器样样要钱，钱紧时写取舍，财不露白`);
            if (s.life) t.push(`寿元 ${s.life}：寿元是大限，闭关与苦修都在消耗光阴，境界不至寿元先尽的压迫感要写进叙事`);
            if (s.root) t.push(`灵根资质 ${s.root}：资质决定修炼速度与门派待遇，伪灵根与杂灵根的冷眼是常态剧情`);
            return t.join('；');
        }
    };

    /* ==================== 模块二：储物袋账簿（v3.26.0 移交） ====================
       旧实现（行囊清单+机缘账簿+品阶色）已并入 PlayerKit 通用背包：
       js/player-kit.js WORLDS.fanrenxiuxian.bag——法器/丹药/功法/灵药灵材/符箓阵盘
       五品类入格、+品名 xN 记账、囤积点名、手动增删、藏宝阁同源回写。
       此处仅保留 ladderMod，避免双背包双契约。 */

    if (window.WorldExt) WorldExt.define('fanrenxiuxian', [ladderMod]);
})();
