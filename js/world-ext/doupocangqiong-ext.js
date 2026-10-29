/**
 * 斗破苍穹 · 界专属扩展（v3.4.0）
 * 🔥 异火榜——二十三种异火收集录：夺火之险、吞噬之难；收榜进度即主线里程碑
 *    （知识库铁律：异火榜共二十三种，具体名次随剧情上报入榜，不预置编造）
 */
(function () {
    'use strict';

    const TOTAL = 23;   // 异火榜二十三种（原著铁律）

    const flameMod = {
        id: 'flames', icon: '🔥', name: '异火榜',
        tip: `天地间异火共二十三种，可遇不可求——夺火即夺命`,
        contract: '异火[{名称,榜位}]（已收异火）；吞噬融合（正在/已完成的双火融合记录）',
        init: () => ({ owned: [], merging: '', devoured: [] }),

        /* v3.32.2 状态板摘要：🔥 收火 3/23 ·最新：青莲地心火（吞噬融合亮 warn） */
        summary(s) {
            if (!s.owned.length && !s.merging) return [];
            const last = s.owned[s.owned.length - 1];
            const nm = last ? String(last.name).slice(0, 6) : '';
            return [{ i: '🔥', v: `${s.owned.length}/${TOTAL}`, l: s.merging ? '吞噬融合中' : nm, tone: s.merging ? 'warn' : '' }];
        },

        read(s, vars, round) {
            let d = false;
            const raw = vars.异火 || vars.异火收集;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) WXH.asArr(raw).forEach(x => {
                const nm = String(x).trim();
                if (nm && !s.owned.some(f => f.name === nm)) { s.owned.push({ name: nm, rank: '', round }); d = true; }
            });
            Object.entries(WXH.asObj(raw)).forEach(([k, v]) => {
                if (!s.owned.some(f => f.name === k)) {
                    const m = String(v).match(/第?\s*(\d+)/);
                    s.owned.push({ name: k, rank: m ? m[1] : '', round }); d = true;
                }
            });
            const mg = vars.吞噬融合 || vars.吞噬;
            if (mg != null && mg !== '' && String(mg) !== s.merging) { s.merging = String(mg); if (!s.devoured.includes(s.merging)) s.devoured.push(s.merging); d = true; }
            return d;
        },

        html(s) {
            const cells = [];
            for (let i = 0; i < TOTAL; i++) {
                const f = s.owned[i];
                cells.push(f
                    ? `<div class="wx-fire on" title="${WXH.esc(f.name)} · 第${f.round || '?'}回收服"><b>${WXH.esc(f.name.length > 6 ? f.name.slice(0, 5) + '…' : f.name)}</b><span>${f.rank ? '第' + f.rank + '位' : '已收'}</span></div>`
                    : `<div class="wx-fire"><b>？</b><span>虚位</span></div>`);
            }
            return `${WXH.card('收火录', `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;">${cells.join('')}</div>`, { icon: '🔥', tag: `${s.owned.length} / ${TOTAL}` })}
            ${s.owned.length ? WXH.card('火册', s.owned.map(f => `<div class="wx-kv"><span>第${f.round || '?'}回</span><b>${WXH.esc(f.name)}${f.rank ? ` · 榜上第 ${WXH.esc(f.rank)} 位` : ''}</b></div>`).join(''), { icon: '📖' }) : ''}
            ${s.devoured.length ? WXH.card('吞噬融合录', s.devoured.map(t => `<div class="wx-kv"><b style="font-weight:400;">🔥 ${WXH.esc(t)}</b></div>`).join(''), { icon: '🌋' }) : ''}
            <div class="wx-banner">异火有灵：原主不会拱手相让——夺火必经斗、封、炼三关；双火吞噬融合是拿命淬体，成则威能倍增，败则火毒焚身。斗气淬体与炼药师控火，是收火的两条腿。</div>`;
        },

        directive(s) {
            if (s.merging) return `吞噬融合进行中（${s.merging}）：双火在人身体内相噬，须写透焚身之痛与两火争锋的凶险——融合失败的火毒反噬是真实的死劫。`;
            if (s.owned.length) return `异火在身（${s.owned.map(f => f.name).slice(-2).join('、')} 等 ${s.owned.length} 种）：动用异火时写其天性（暴烈/阴冷/生机各异），对敌有压箱底的威能但消耗斗气极巨；新异火的机缘应伴随夺火之险。`;
            return '';
        }
    };

    if (window.WorldExt) WorldExt.define('doupocangqiong', [flameMod]);
})();
