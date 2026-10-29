/**
 * 道诡异仙 · 界专属扩展（v3.4.0）
 * 🪞 双界对照镜——现代病房与大傩世界两栏并排、同刻互译、跨界牵连高亮
 * 🧠 清醒度量表——越疯越强但失控：低清醒解锁心素之力、滑到极端触发世界切换
 */
(function () {
    'use strict';

    const mirrorMod = {
        id: 'mirror', icon: '🪞', name: '双界对照镜',
        tip: '两个世界同时真实运转——同刻对照，跨界牵连互相应答',
        contract: '双世界.现代{场景,近况,异象} 与 双世界.大傩{场景,近况,异象}（两界各自当前境况）；跨界牵连[]（本轮两界互相留下的痕迹，如：现代吞的药 ↔ 大傩口中的苦）',
        init: () => ({ modern: { scene: '', status: '', odd: '', round: 0 }, danao: { scene: '', status: '', odd: '', round: 0 }, links: [] }),

        /* v3.32.2 状态板摘要：🪞 病房↔清风观 ·牵连3（两侧未上报则不上条） */
        summary(s) {
            const m = s.modern.scene || s.modern.status;
            const d = s.danao.scene || s.danao.status;
            if (!m && !d && !s.links.length) return [];
            const short = x => String(x || '').slice(0, 6);
            return [{ i: '🪞', v: `${short(m) || '—'}↔${short(d) || '—'}`, l: s.links.length ? `牵连${s.links.length}` : '' }];
        },

        read(s, vars, round) {
            let d = false;
            const dw = WXH.asObj(vars.双世界 || vars.dualWorld || vars.双界);
            const mod = WXH.asObj(dw.现代 || dw.modern);
            const dan = WXH.asObj(dw.大傩 || dw.大傩世界 || dw.danao);
            /* 现代侧 */
            const mScene = mod.scene || mod.场景 || vars.现代场景 || vars['双世界.现代.场景'] || '';
            const mStat = mod.status || mod.近况 || mod.状态 || vars.现代近况 || '';
            const mOdd = mod.odd || mod.异象 || mod.vision || vars.现代异象 || '';
            if (mScene || mStat || mOdd) {
                s.modern = { scene: mScene || s.modern.scene, status: mStat || s.modern.status, odd: mOdd || s.modern.odd, round };
                d = true;
            }
            /* 大傩侧 */
            const dScene = dan.scene || dan.场景 || vars.大傩场景 || vars['双世界.大傩.场景'] || '';
            const dStat = dan.status || dan.近况 || dan.状态 || vars.大傩近况 || '';
            const dOdd = dan.odd || dan.异象 || dan.vision || vars.大傩异象 || '';
            if (dScene || dStat || dOdd) {
                s.danao = { scene: dScene || s.danao.scene, status: dStat || s.danao.status, odd: dOdd || s.danao.odd, round };
                d = true;
            }
            /* 跨界牵连 */
            const links = WXH.asArr(vars.跨界牵连 || vars.跨界痕迹 || (dw.links));
            if (links.length) {
                links.forEach(t => { if (!s.links.includes(t)) { s.links.unshift(t); d = true; } });
                if (s.links.length > 8) s.links.length = 8;
            }
            return d;
        },

        html(s) {
            const side = (o, title, icon) => `<div class="wx-mirror-side">
                <h4>${icon} ${title}${o.round ? ` <i style="font-style:normal;opacity:.6;font-size:10.5px;">·第${o.round}回</i>` : ''}</h4>
                ${WXH.kv([['场景', o.scene || '—'], ['近况', o.status || '—'], ['异象', o.odd || '—']])}
            </div>`;
            const both = s.modern.scene || s.modern.status || s.danao.scene || s.danao.status;
            if (!both && !s.links.length) return WXH.empty('🪞', '镜面尚蒙着雾', '开篇后 AI 上报两界境况，这里会并排映出两个世界');
            const reson = s.modern.round && s.modern.round === s.danao.round;
            return `<div class="wx-mirror">
                ${side(s.modern, '现代 · 白塔医院', '🏥')}
                <div class="wx-mirror-mid"><b class="${reson ? 'wx-reson' : ''}" title="${reson ? '同一回合两界同时更新——共振之刻' : '镜'}">🪞</b>
                    ${reson ? '<small style="font-size:9.5px;color:var(--ip,#c9a86a);">共振</small>' : ''}</div>
                ${side(s.danao, '大傩 · 清风观', '⛩')}
            </div>
            ${s.links.length ? WXH.card('跨界牵连 · 两界互答的痕迹', s.links.map((t, i) => `<div class="wx-kv"><span><i class="wx-idx">${i + 1}</i></span><b>${WXH.esc(t)}</b></div>`).join(''), { icon: '⚡', grow: true }) : ''}
            <div class="wx-banner">真相未判：镜只照见两侧，不裁定孰真孰伪——同物异形（药↔丹、护士↔道童）正是这个世界的语法。</div>`;
        },

        directive(s) {
            if (!(s.modern.scene || s.danao.scene)) return '';
            return '双世界引擎：两个世界同时真实运转；若本轮发生跨界牵连，两界痕迹必须互相应答（一侧的举动在另一侧留下可查的痕）；世界切换不预告、不解释——一段苦还没咽完，另一界的味道已经漫上来。';
        }
    };

    /* ==================== 清醒度量表 ==================== */
    const SANITY_ZONES = [
        { max: 19, label: '疯境临门', color: '#e07070' },
        { max: 39, label: '恍惚失序', color: '#e0a04c' },
        { max: 59, label: '半醒半梦', color: '#c8c06a' },
        { max: 84, label: '清明持守', color: '#8fd9a8' },
        { max: 100, label: '彻醒入世', color: '#7ab8d8' }
    ];

    const sanityMod = {
        id: 'sanity', icon: '🧠', name: '清醒度量表',
        tip: '心素之路：越疯越接近真相，越醒越远离力量——滑向两端各有代价',
        contract: '清醒度（0-100 整数：0=彻底疯癫，100=彻底清醒；随所见所历浮动）',
        init: () => ({ value: 60, log: [] }),

        /* v3.32.2 状态板摘要：🧠 清醒度 42 ·半醒半梦（低清醒亮警色） */
        summary(s) {
            const z = SANITY_ZONES.find(t => s.value <= t.max) || SANITY_ZONES[SANITY_ZONES.length - 1];
            const tone = s.value <= 19 ? 'bad' : s.value <= 39 ? 'warn' : 'ok';
            return [{ i: '🧠', v: String(s.value), l: z.label, tone }];
        },

        read(s, vars, round) {
            const v = WXH.pick(vars, ['清醒度', 'sanity', '心素清醒度']);
            if (v == null) return false;
            const n = WXH.asNum(v, s.value);
            if (n !== s.value) {
                s.log.unshift(`第${round}回：${s.value} → ${n}`);
                if (s.log.length > 6) s.log.length = 6;
                s.value = n;
                return true;
            }
            return false;
        },

        html(s) {
            const g = WXH.gauge(s.value, SANITY_ZONES);
            const z = g.zone;
            const lore = {
                '疯境临门': '异象全开，心素之力随手可及——但人与疯子的界限只剩一层纸；言语、时序、身份都开始互相渗透',
                '恍惚失序': '两界的界线发黏：声音串味、面孔重叠；力量可用，代价渐显',
                '半醒半梦': '骑墙之位：两边的规则都管着你，也都管不实你',
                '清明持守': '异象敛形，人情线清晰——适合查证、结盟、缝补关系',
                '彻醒入世': '世界表现得像个正常世界——可越正常，越说明有什么在装'
            }[z.label];
            return `${g.html}
            <div class="wx-banner" style="margin-top:10px;"><b style="color:${z.color};">${z.label}</b>——${WXH.esc(lore)}</div>
            ${s.log.length ? WXH.card('滑落与爬升', s.log.map(t => `<div class="wx-kv"><b style="font-weight:400;font-size:11.5px;color:var(--imt,#9a8c6e);">${WXH.esc(t)}</b></div>`).join(''), { icon: '📉', grow: true }) : ''}
            <div class="wx-slot">
                <button class="wx-btn" onclick="WorldExt.act('sanity','nudge',-5)">−5 疯一分</button>
                <button class="wx-btn" onclick="WorldExt.act('sanity','nudge',5)">+5 醒一分</button>
                <small style="font-size:10.5px;color:var(--imt,#9a8c6e);">手动干预（主持补正）</small>
            </div>`;
        },

        act(s, action, payload) {
            if (action !== 'nudge') return;
            const n = Math.max(0, Math.min(100, s.value + Number(payload)));
            if (n === s.value) return '已在端点';
            s.log.unshift(`主持补正：${s.value} → ${n}`);
            if (s.log.length > 6) s.log.length = 6;
            s.value = n;
            return `清醒度 ${n}`;
        },

        directive(s) {
            if (s.value <= 19) return `清醒度${s.value}·疯境临门：感知可错乱、心素之力大开但要写失控的代价；叙述本身可以不可靠，但线索须公平埋设（先埋后收）。`;
            if (s.value <= 39) return `清醒度${s.value}·恍惚失序：两界细节互相渗透（串味的声音、重叠的面孔），力量可用但代价渐显。`;
            if (s.value <= 59) return `清醒度${s.value}·半醒半梦：两边规则都对玩家半生效，最适合写真假莫辨的两可场景。`;
            if (s.value <= 84) return `清醒度${s.value}·清明持守：异象敛形，人情线清晰，适合查证与结盟；诡异退成背景的不对劲。`;
            return `清醒度${s.value}·彻醒入世：世界表现得过分正常——越正常越说明有什么在装；可在日常细节里埋"装出来"的破绽。`;
        }
    };

    if (window.WorldExt) WorldExt.define('daoguiyixian', [mirrorMod, sanityMod]);
})();
