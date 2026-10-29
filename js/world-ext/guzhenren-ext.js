/**
 * 蛊真人 · 界专属模块（原著机制向，v3.47.7）
 * 依据原著铁律补足 module-forge 通用玩法之外的专属机制：
 *  1. 本命蛊：一名额、与命绑定，蛊师重伤则本命蛊同受其伤；更换本命蛊原著无据，不提供
 *  2. 炼蛊合炼：蛊方 + 蛊材 + 真元，转数越高失败率越险（四五转尚可十中九，六转十不存一）
 *  3. 春秋蝉回溯：回溯有价——天意污染、气运折损，次数越多反噬越重
 */
(function () {
    'use strict';

    /* 真元颜色表（原著：转数对应真元色泽） */
    const ESSENCE_COLOR = ['清白', '淡红', '火红', '橙色', '翠绿', '青蓝', '深蓝', '暗紫', '彩斑'];
    const yuanColor = (turn) => ESSENCE_COLOR[Math.min(9, Math.max(1, turn)) - 1];

    /* ── 模块一：本命蛊 ── */
    const gubenming = {
        id: 'gubenming', icon: '🐛', name: '本命蛊',
        tip: '一名额 · 与命绑定 · 蛊师伤则蛊伤',
        contract: '本命蛊[{名称,转数,desc}]；温养(温养之事)；本命蛊伤势(伤势描述)',
        init: () => ({ gu: null, nurturing: '', hurt: '' }),

        summary(s) {
            if (!s.gu && !s.hurt) return [];
            return [{ i: '🐛', v: s.gu ? `${s.gu.turn || '?'}转` : '空缺', l: s.hurt ? '带伤' : (s.gu ? (s.gu.name || '') : '未合炼'), tone: s.hurt ? 'warn' : '' }];
        },

        read(s, vars, round) {
            let d = false;
            const g = vars.本命蛊;
            if (g != null && g !== '') {
                let ng = null;
                if (Array.isArray(g)) { const f = g[g.length - 1]; if (f) ng = typeof f === 'object' ? f : { name: String(f) }; }
                else if (typeof g === 'object') ng = g;
                else ng = { name: String(g) };
                if (ng) {
                    ng.turn = Number(ng.turn || ng.转数 || (s.gu && s.gu.turn) || 0) || (s.gu && s.gu.turn) || 1;
                    ng.desc = String(ng.desc || ng.描述 || (s.gu && s.gu.desc) || '');
                    if (!s.gu || s.gu.name !== ng.name || s.gu.turn !== ng.turn || s.gu.desc !== ng.desc) { s.gu = ng; d = true; }
                }
            }
            const nu = vars.温养 != null ? vars.温养 : vars.本命蛊温养;
            if (nu != null && nu !== '' && String(nu) !== s.nurturing) { s.nurturing = String(nu).slice(0, 60); d = true; }
            const hu = vars.本命蛊伤势 != null ? vars.本命蛊伤势 : vars.蛊伤;
            if (hu != null && hu !== '' && String(hu) !== s.hurt) { s.hurt = String(hu).slice(0, 60); d = true; }
            if (!hu && s.hurt) { s.hurt = ''; d = true; }
            return d;
        },

        html(s) {
            if (!s.gu && !s.nurturing && !s.hurt) return WXH.empty('🐛', '本命蛊尚未合炼', '空窍元海中的一名额——原著铁律：每名蛊师一生只得一枚本命蛊位，与命相系，不可更易。');
            const turn = s.gu ? Number(s.gu.turn || 1) : 0;
            return `${s.gu ? WXH.card('本命蛊 · 与命相系', `<div class="wx-kv"><span>名目</span><b>${WXH.esc(s.gu.name || '未名之蛊')}</b></div>
            <div class="wx-kv"><span>转数</span><b>${turn} 转蛊（真元显 ${yuanColor(turn)}）</b></div>
            ${s.gu.desc ? `<div class="wx-kv"><span>蛊性</span><b>${WXH.esc(s.gu.desc)}</b></div>` : ''}
            ${s.hurt ? `<div class="wx-banner" style="border-color:#e05a5a88;background:#e05a5a12;">🩸 本命蛊带伤：${WXH.esc(s.hurt)}——蛊伤即身伤，蛊师垂死则本命蛊陪葬。</div>` : ''}`, { icon: '🐛', tag: `${turn}转` }) : ''}
            ${s.nurturing ? WXH.card('温养中', `<div class="wx-banner">🌿 ${WXH.esc(s.nurturing)}</div>`, { icon: '🌿' }) : ''}
            ${s.gu ? '' : `<div class="wx-banner">⚠️ 本命蛊名额唯一：一旦合炼定下，终生不改。五转之前合炼，便是押上整条修途的赌注。</div>`}
            <div class="wx-banner">原著规矩：本命蛊随魂认主、与命绑定——蛊师重伤则本命蛊同受其伤；本命蛊败亡，蛊师道基随之崩塌。</div>`;
        },

        directive(s) {
            if (s.hurt) return `本命蛊带伤（${s.hurt}）：伤蛊即伤身，正文须体现蛊师自身状态与战力折损，疗蛊即是疗命。`;
            if (s.gu) return `本命蛊「${s.gu.name}」（${s.gu.turn || '?'}转）在窍：战斗与谋算应以本命蛊为核心杀手/底牌，温养饲喂是日常功课；本命蛊不可更换、不可抛弃。`;
            return '本命蛊位尚空：若剧情走向合炼本命蛊，须写明这是一锤定音的终身抉择（一名额铁律），务必郑重铺陈。';
        }
    };

    /* ── 模块二：炼蛊合炼 ── */
    const guliangu = {
        id: 'guliangu', icon: '🔥', name: '炼蛊合炼',
        tip: '蛊方+蛊材+真元 · 转数越高风险越狰',
        contract: '炼蛊中{蛊名,转数,蛊方完整度,已备蛊材,风险}；炼蛊成(所成之蛊)；炼蛊败(败因)',
        init: () => ({ job: null, log: [] }),

        summary(s) {
            if (s.job) return [{ i: '🔥', v: `${s.job.turn || '?'}转`, l: `炼：${s.job.name}`, tone: 'warn' }];
            if (s.log.length) return [{ i: '🔥', v: s.log[0].t === '成' ? '蛊成' : '炸炉', l: s.log[0].n, tone: s.log[0].t === '成' ? 'ok' : 'bad' }];
            return [];
        },

        read(s, vars, round) {
            let d = false;
            const j = vars.炼蛊中;
            if (j && typeof j === 'object' && !Array.isArray(j)) {
                const nj = {
                    name: String(j.蛊名 || j.name || '无名之蛊').slice(0, 24),
                    turn: Number(j.转数 || j.turn || 1) || 1,
                    recipe: String(j.蛊方完整度 || j.蛊方 || j.recipe || '未知').slice(0, 40),
                    mats: String(j.已备蛊材 || j.蛊材 || j.mats || '').slice(0, 80),
                    risk: String(j.风险 || j.risk || '').slice(0, 40)
                };
                if (JSON.stringify(nj) !== JSON.stringify(s.job)) { s.job = nj; d = true; }
            } else if (!j && s.job) { s.job = null; d = true; }
            [['炼蛊成', '成'], ['炼蛊败', '败']].forEach(([k, t]) => {
                const v = vars[k];
                if (v != null && v !== '') {
                    const n = String(typeof v === 'object' ? (v.名 || v.name || JSON.stringify(v)) : v).slice(0, 30);
                    if (!s.log.length || s.log[0].n !== n || s.log[0].t !== t) { s.log.unshift({ t, n, round }); if (s.log.length > 8) s.log.length = 8; s.job = null; d = true; }
                }
            });
            return d;
        },

        html(s) {
            const failRef = ['一转二转：失手只是白忙一场', '三转：蛊方差漏即炸炉', '四转五转：十合犹有一败（失败率约一成内），蛊材俱焚', '六转：十不存一，非气运惊人者莫试'];
            const body = s.job ? `<div class="wx-kv"><span>目标</span><b>${WXH.esc(s.job.name)}（${s.job.turn} 转）</b></div>
            <div class="wx-kv"><span>蛊方完整度</span><b>${WXH.esc(s.job.recipe)}</b></div>
            ${s.job.mats ? `<div class="wx-kv"><span>已备蛊材</span><b>${WXH.esc(s.job.mats)}</b></div>` : ''}
            ${s.job.risk ? `<div class="wx-banner" style="border-color:#e0a84c88;background:#e0a84c12;">⚠️ ${WXH.esc(s.job.risk)}</div>` : ''}
            <div class="wx-banner">合炼三要素缺一不可：完整蛊方 + 对应转数蛊材 + 蛊师真元灌注。${WXH.esc(failRef[Math.min(9, Math.max(1, s.job.turn)) - 1] || failRef[3])}——败则蛊材俱损，是血本无归的豪赌。</div>`
                : `<div class="wx-banner">炼蛊 = 蛊方 × 蛊材 × 真元。转数越高，天地越吝：四五转尚可十中九，六转十不存一。</div>`;
            const log = s.log.length ? WXH.card('合炼纪略', s.log.map(l => `<div class="wx-kv"><span>第${l.round || '?'}回</span><b>${l.t === '成' ? '✅' : '💥'} ${WXH.esc(l.n)}</b></div>`).join(''), { icon: '📖' }) : '';
            return WXH.card('炼蛊合炼', body, { icon: '🔥', grow: true }) + log;
        },

        directive(s) {
            if (s.job) return `炼蛊进行中（${s.job.name}·${s.job.turn}转）：正文须落到蛊方勘验、蛊材甄选、真元灌注与炼蛊室火候的具体过程；${s.job.turn >= 5 ? '此等转数十不存一，写透破釜沉舟的赌性' : '失败同样烧尽蛊材，让代价真实'}；成或败以 (炼蛊成/炼蛊败) 上报。`;
            if (s.log.length && s.log[0].t === '败') return `上一炉合炼失败（${s.log[0].n}）：蛊材已焚、真元亏空，正文延续折损善后与再谋之路。`;
            if (s.log.length && s.log[0].t === '成') return `新蛊「${s.log[0].n}」出炉：写清其蛊性、用法与日后温养饲喂的隐患，好蛊也是新麻烦的开端。`;
            return '';
        }
    };

    /* ── 模块三：春秋蝉回溯 ── */
    const guchanhui = {
        id: 'guchanhui', icon: '🕰', name: '春秋蝉',
        tip: '回溯有价 · 天意污染 · 气运折损',
        contract: '春秋蝉回溯(回溯缘由)；天意污染(表现)；气运(顺/衰/劫)',
        init: () => ({ times: 0, lastWhy: '', pollution: '', luck: '' }),

        summary(s) {
            if (!s.times && !s.pollution && !s.luck) return [];
            return [{ i: '🕰', v: s.times ? `${s.times}次` : '未醒', l: s.pollution ? '天意污染' : (s.luck || ''), tone: s.pollution ? 'bad' : (s.luck === '劫' ? 'warn' : '') }];
        },

        read(s, vars, round) {
            let d = false;
            const w = vars.春秋蝉回溯;
            if (w != null && w !== '') { s.times += 1; s.lastWhy = String(typeof w === 'object' ? (w.缘由 || w.why || '') : w).slice(0, 60); d = true; }
            const p = vars.天意污染;
            if (p != null && String(p) !== s.pollution) { s.pollution = String(p).slice(0, 60); d = true; }
            if (!p && s.pollution) { s.pollution = ''; d = true; }
            const l = vars.气运;
            if (l != null && l !== '' && String(l) !== s.luck) { s.luck = String(l).slice(0, 8); d = true; }
            return d;
        },

        html(s) {
            if (!s.times && !s.pollution && !s.luck) return WXH.empty('🕰', '春秋蝉未鸣', '宿命之蛊——一旦回溯，天地重开而代价暗生。');
            return WXH.card('春秋蝉 · 回溯之账', `
            <div class="wx-kv"><span>回溯次数</span><b>${s.times} 次</b></div>
            ${s.lastWhy ? `<div class="wx-kv"><span>最近缘由</span><b>${WXH.esc(s.lastWhy)}</b></div>` : ''}
            ${s.pollution ? `<div class="wx-banner" style="border-color:#9a6ad888;background:#9a6ad812;">🌫 天意污染：${WXH.esc(s.pollution)}——次数越多，天意越憎，祸患无形。</div>` : ''}
            ${s.luck ? `<div class="wx-kv"><span>气运表象</span><b>${WXH.esc(s.luck)}</b></div>` : ''}
            <div class="wx-banner">原著铁律：春秋蝉回溯不是免费的读档——生机折损、天意污染、气运暗衰层层累积。回溯越多，人越接近"天之弃子"。</div>`, { icon: '🕰', grow: true });
        },

        directive(s) {
            if (!s.times) return '';
            return `春秋蝉已回溯 ${s.times} 次${s.lastWhy ? `（最近：${s.lastWhy}）` : ''}：正文须让回溯的代价持续显形——${s.pollution ? `天意污染（${s.pollution}）具体作祟` : '天意对主角渐生排斥，顺境里藏反常'}；气运不是白来的，福缘背后皆有暗账。`;
        }
    };

    if (window.WorldExt) WorldExt.define('guzhenren', [gubenming, guliangu, guchanhui]);
})();
