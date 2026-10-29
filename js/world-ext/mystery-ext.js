/**
 * 悬疑 · 界专属扩展（v3.4.0）
 * 🕵 证据板 · 红线图——线索×嫌疑人关联矩阵：钉线索、连红线、集齐链路发起指认（猜错有代价）
 */
(function () {
    'use strict';

    const ACCUSE_NEED = 3;   // 指认所需关联线索数

    const evidenceMod = {
        id: 'evidence', icon: '🕵', name: '证据板 · 红线图',
        tip: `点击交叉格连线/撤线；单名嫌疑人连满 ${ACCUSE_NEED} 条即可发起指认`,
        contract: '证据[{名称,指向}]（本轮新得的线索及其指向）；嫌疑人[]（在场可疑者）；指认结果（发起指认后回填：正确/错误及其后果）',
        init: () => ({ clues: [], suspects: [], links: {}, accused: null }),

        /* v3.32.2 状态板摘要：🕵 线索7×嫌疑人4 ·红线3（集满3条亮 ok 可发起指认） */
        summary(s) {
            if (!s.clues.length && !s.suspects.length) return [];
            const linked = Object.keys(s.links).length;
            const ready = s.suspects.some((su, si) => Object.keys(s.links).filter(k => k.split(':')[1] == si).length >= ACCUSE_NEED);
            return [{
                i: '🕵', v: `${s.clues.length}线索`,
                l: `嫌${s.suspects.length}·红线${linked}`, tone: ready ? 'ok' : ''
            }];
        },

        read(s, vars, round) {
            let d = false;
            /* 线索：支持数组或对象 */
            const evRaw = vars.证据 || vars.线索 || vars.evidence;
            if (!evRaw || typeof evRaw !== 'object' || Array.isArray(evRaw)) WXH.asArr(evRaw).forEach(name => {
                if (!s.clues.some(c => c.name === name)) { s.clues.push({ name, note: '', round }); d = true; }
            });
            Object.entries(WXH.asObj(evRaw)).forEach(([k, v]) => {
                if (!s.clues.some(c => c.name === k)) { s.clues.push({ name: k, note: String(v).slice(0, 60), round }); d = true; }
                else { const c = s.clues.find(x => x.name === k); if (v && String(v).slice(0, 60) !== c.note) { c.note = String(v).slice(0, 60); d = true; } }
            });
            /* 嫌疑人 */
            WXH.asArr(vars.嫌疑人 || vars.suspects).forEach(name => {
                const nm = String(name).replace(/[：:].*$/, '').trim();
                if (nm && !s.suspects.some(x => x.name === nm)) { s.suspects.push({ name: nm }); d = true; }
            });
            /* AI 自动连线：线索对象值里点名指向谁 */
            Object.entries(WXH.asObj(evRaw)).forEach(([k, v]) => {
                const ci = s.clues.findIndex(c => c.name === k);
                if (ci < 0) return;
                s.suspects.forEach((su, si) => {
                    const key = `${ci}:${si}`;
                    if (typeof v === 'string' && v.includes(su.name) && !s.links[key]) { s.links[key] = true; d = true; }
                });
            });
            /* 指认结果回填 */
            const res = vars.指认结果 || vars.指认;
            if (res && s.accused && !s.accused.result) { s.accused.result = String(res); d = true; }
            if (s.clues.length > 30) s.clues.length = 30;
            return d;
        },

        act(s, action, payload) {
            if (action === 'toggle') {
                const key = String(payload);
                if (s.links[key]) delete s.links[key]; else s.links[key] = true;
                return s.links[key] ? '红线已连' : '红线已撤';
            }
            if (action === 'accuse') {
                const si = Number(payload);
                const su = s.suspects[si];
                if (!su) return;
                const linked = Object.keys(s.links).filter(k => k.split(':')[1] == si).length;
                if (linked < ACCUSE_NEED) return `线索不足（${linked}/${ACCUSE_NEED}）`;
                s.accused = { suspect: su.name, round: null, result: '' };
                return `已对「${su.name}」发起指认——下一回合给出裁定`;
            }
            if (action === 'clearAccused') { s.accused = null; return '指认记录已清'; }
            if (action === 'addSuspect') {
                const nm = String(payload || '').trim();
                if (!nm) return;
                if (!s.suspects.some(x => x.name === nm)) s.suspects.push({ name: nm });
                return `嫌疑人「${nm}」入板`;
            }
        },

        html(s) {
            const hasData = s.clues.length || s.suspects.length;
            const linkedCount = (si) => Object.keys(s.links).filter(k => k.split(':')[1] == si).length;
            const parts = [];
            if (!hasData) {
                parts.push(WXH.empty('🕵', '软木板还空着', '随剧情上报的证据与嫌疑人会自动钉上板；也可在下方手动加嫌疑人'));
            } else {
                parts.push(`<div class="wx-matrix-wrap"><table class="wx-matrix">
                    <tr><th>线索 \\ 嫌疑</th>${s.suspects.map(su => `<th class="sus" title="${WXH.esc(su.name)}">${WXH.esc(su.name)}</th>`).join('')}</tr>
                    ${s.clues.map((c, ci) => `<tr>
                        <th title="${WXH.esc(c.note || c.name)}">${WXH.esc(c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name)}<i style="font-style:normal;opacity:.5;font-size:10px;">·${c.round || '?'}</i></th>
                        ${s.suspects.map((su, si) => {
                    const key = `${ci}:${si}`;
                    return `<td class="cell ${s.links[key] ? 'on' : ''}" onclick="WorldExt.act('evidence','toggle','${key}')">${s.links[key] ? '●' : '·'}</td>`;
                }).join('')}
                    </tr>`).join('')}
                </table></div>`);
                const ready = s.suspects.map((su, si) => ({ su, si, n: linkedCount(si) })).filter(x => x.n >= ACCUSE_NEED);
                if (ready.length && !(s.accused && !s.accused.result)) {
                    parts.push(ready.map(r => `<button class="wx-accuse" onclick="WorldExt.act('evidence','accuse',${r.si})">
                        🎯 发起指认 ·「${WXH.esc(r.su.name)}」（已连 ${r.n} 条线索）——赌上判断，错认有真实代价</button>`).join(''));
                }
            }
            if (s.accused) {
                parts.push(`<div class="wx-banner">${s.accused.result
                    ? `⚖️ 对「${WXH.esc(s.accused.suspect)}」的指认已有裁定：<b>${WXH.esc(s.accused.result)}</b>`
                    : `🎯 指认进行中：玩家押定「${WXH.esc(s.accused.suspect)}」——下回合由证据与真相裁定，错认须付真实代价`}
                    <button class="wx-btn danger" style="margin-left:8px;padding:2px 9px;font-size:11px;" onclick="WorldExt.act('evidence','clearAccused')">清记录</button></div>`);
            }
            parts.push(`<div class="wx-slot">
                <input id="wxSusInput" placeholder="手动添加嫌疑人（如：管家 老周）" maxlength="12">
                <button class="wx-btn" onclick="WorldExt.act('evidence','addSuspect',document.getElementById('wxSusInput').value)">钉上板</button>
            </div>`);
            return parts.join('');
        },

        directive(s) {
            if (s.accused && !s.accused.result) return `指认回合进行中：玩家已押定「${s.accused.suspect}」——本轮必须给出裁定，且由已连证据与真相共同裁决；指认错误的代价要真实（冤枉好人、打草惊蛇、真凶脱身），不能和稀泥。`;
            const ready = s.suspects.filter((su, si) => Object.keys(s.links).filter(k => k.split(':')[1] == si).length >= ACCUSE_NEED);
            if (ready.length) return `证据板渐满：「${ready.map(x => x.name).join('、')}」的嫌疑链路已成形，玩家随时可能发起指认——新线索应让案情更立体而非注水，误导性线索须公平（事后可回收）。`;
            if (s.clues.length >= 3) return '悬疑推进：本轮宜让至少一条旧线索获得新解释（回收），或抛出新线索改变怀疑的方向——线索只增不改写等于原地踏步。';
            return '';
        }
    };

    if (window.WorldExt) WorldExt.define('mystery', [evidenceMod]);
})();
