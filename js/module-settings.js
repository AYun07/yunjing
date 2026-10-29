/**
 * 模块数值自定义面板 ModuleSettings（v3.33.0）
 * ---------------------------------------------------------------------------
 * 「所有模块数值玩家都可以自定义」的统一入口：界专属抽屉里每个模块右上角一枚 ⚙——
 *   · 改显示名 / 隐藏模块（隐藏 = 整个停摆：不吃变量、不出指引、不上状态板，数据保留）
 *   · 调模块公开的数值项（opts 描述表：布尔/数字/文本，如 自动回信开关、温度地板、
 *     投递延迟、降温节奏、历史上限……由各模块经 ModuleSettings.describe(id, opts) 自申报）
 *   · 一键恢复本模块默认
 * 存取约定（供模块在 read/html/act 里取用）：
 *   ModuleSettings.opt('comm', 'autoReply', true)   → 玩家改过的值，没改过给默认
 *   ModuleSettings.isHidden(id) / aliasOf(id, 默认名) → 由 world-ext-core 在渲染管线里消费
 * 存储 localStorage('moduleSet_${genre}')；随 genre 隔离，故障静默不伤主流程。
 */
(function () {
    'use strict';

    const VERSION = 'v3.36.1';
    const genre = (() => {
        try { return new URLSearchParams(location.search).get('genre') || 'free'; }
        catch (e) { return 'free'; }
    })();

    const STORE = `moduleSet_${genre}`;
    const DESC = {};    // modId -> [{key,label,type:'bool'|'number'|'text',dflt,tip}]
    let store = { hidden: {}, alias: {}, opts: {} };
    try {
        const raw = localStorage.getItem(STORE);
        if (raw) {
            const d = JSON.parse(raw);
            store = Object.assign({ hidden: {}, alias: {}, opts: {} }, d && typeof d === 'object' ? d : {});
            store.hidden = store.hidden || {}; store.alias = store.alias || {}; store.opts = store.opts || {};
        }
    } catch (e) { store = { hidden: {}, alias: {}, opts: {} }; }

    function save() { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) { /* 配额满静默 */ } }

    /* ==================== 模块消费的读取 API ==================== */
    function describe(id, defs) { if (Array.isArray(defs)) DESC[id] = defs; }

    function opt(id, key, dflt) {
        const o = store.opts[id] || {};
        const v = o[key];
        if (v === '' || v == null) return dflt;
        const desc = (DESC[id] || []).find(d => d.key === key);
        if (desc && desc.type === 'number') { const n = Number(v); return Number.isFinite(n) ? n : dflt; }
        if (desc && desc.type === 'bool') return v === true || v === 'true';
        return v;
    }
    function isHidden(id) { return !!store.hidden[id]; }
    function aliasOf(id, dflt) { const a = store.alias[id]; return (a && String(a).trim()) || dflt; }
    function setOpt(id, key, val) {
        store.opts[id] = store.opts[id] || {};
        store.opts[id][key] = val;
        save(); apply();
    }
    function setHidden(id, hid) { store.hidden[id] = !!hid; save(); apply(); }
    function setAlias(id, name) { store.alias[id] = String(name || '').slice(0, 14); save(); apply(); }
    function resetMod(id) {
        delete store.hidden[id]; delete store.alias[id]; delete store.opts[id];
        save(); apply();
    }

    /* 应用：状态板与界专属面板就地重绘（引擎未就绪时静默） */
    function apply() {
        try { window.WorldExt && WorldExt.refreshStrip && WorldExt.refreshStrip(); } catch (e) { }
        try {
            const body = document.getElementById('immBody');
            if (body && body.dataset.wxTab === '1' && window.WorldExt) body.innerHTML = WorldExt.panelHTML();
        } catch (e) { }
    }

    /* ==================== ⚙ 按钮（world-ext-core 渲染模块头时取用） ==================== */
    function button(id) {
        return `<button class="ms-btn" title="模块设置：改名 / 隐藏 / 自定义数值" onclick="event.stopPropagation();ModuleSettings.open('${id}')">⚙</button>`;
    }

    /* ==================== 设置弹窗 ==================== */
    let curId = null;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function open(id) {
        curId = id;
        injectStyle();
        const defs = DESC[id] || [];
        const old = document.getElementById('msOv'); if (old) old.remove();
        const ov = document.createElement('div');
        ov.id = 'msOv'; ov.className = 'ms-ov';
        ov.onclick = (e) => { if (e.target === ov) close(); };
        const rows = defs.map(d => {
            const v = opt(id, d.key, d.dflt);
            const tip = d.tip ? ` title="${esc(d.tip)}"` : '';
            if (d.type === 'bool') {
                return `<label class="ms-row" ${tip}><span>${esc(d.label)}</span>
                    <input type="checkbox" ${v ? 'checked' : ''} onchange="ModuleSettings.setOpt('${id}','${d.key}',this.checked)"></label>`;
            }
            if (d.type === 'number') {
                return `<label class="ms-row" ${tip}><span>${esc(d.label)}</span>
                    <input type="number" class="ms-num" value="${esc(v)}" onchange="ModuleSettings.setOpt('${id}','${d.key}',this.value)"></label>`;
            }
            return `<label class="ms-row" ${tip}><span>${esc(d.label)}</span>
                <input type="text" class="ms-txt" value="${esc(v)}" maxlength="60" onchange="ModuleSettings.setOpt('${id}','${d.key}',this.value)"></label>`;
        }).join('');
        ov.innerHTML = `
            <div class="ms-box">
                <div class="ms-hd"><b>⚙ 模块设置</b><button class="ms-x" onclick="ModuleSettings.close()">✕</button></div>
                <div class="ms-bd">
                    <label class="ms-row"><span>显示此模块</span>
                        <input type="checkbox" ${!isHidden(id) ? 'checked' : ''} onchange="ModuleSettings.setHidden('${id}',!this.checked)"></label>
                    <label class="ms-row"><span>显示名称</span>
                        <input type="text" class="ms-txt" value="${esc(aliasOf(id, ''))}" placeholder="留空 = 用世界默认名" maxlength="14"
                            onchange="ModuleSettings.setAlias('${id}',this.value)"></label>
                    ${defs.length ? `<div class="ms-sec">数值自定义</div>${rows}` : '<div class="ms-note">此模块暂无可调数值项</div>'}
                </div>
                <div class="ms-ft">
                    <button class="ms-reset" onclick="ModuleSettings.resetMod('${id}')">↺ 恢复默认</button>
                    <button class="ms-done" onclick="ModuleSettings.close()">完成</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        setTimeout(() => ov.classList.add('show'), 20);
    }
    function close() {
        const ov = document.getElementById('msOv');
        if (ov) { ov.classList.remove('show'); setTimeout(() => ov.remove(), 200); }
        curId = null;
    }

    /* ==================== 样式（吃 world-ext 抽屉主题变量） ==================== */
    function injectStyle() {
        if (document.getElementById('msStyle')) return;
        const st = document.createElement('style');
        st.id = 'msStyle';
        st.textContent = `
.ms-btn{margin-left:auto;flex:0 0 auto;background:none;border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 32%,transparent);
    color:var(--imt,#9a8c6e);border-radius:7px;width:22px;height:20px;font-size:11px;cursor:pointer;line-height:1;transition:all .2s}
.ms-btn:hover{color:var(--ip,#c9a86a);border-color:var(--ip,#c9a86a)}
.wx-sec-hd{display:flex;align-items:baseline;gap:8px}
.ms-ov{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);
    display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
.ms-ov.show{opacity:1}
.ms-box{width:min(92vw,400px);max-height:80vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
    background:var(--id,#161410);border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 40%,transparent);
    box-shadow:0 18px 50px rgba(0,0,0,.5);transform:translateY(12px);transition:transform .2s}
.ms-ov.show .ms-box{transform:translateY(0)}
.ms-hd{display:flex;align-items:center;padding:13px 16px;border-bottom:1px solid color-mix(in srgb,var(--ip,#c9a86a) 18%,transparent)}
.ms-hd b{color:var(--ip,#c9a86a);font-size:14px;letter-spacing:2px}
.ms-x{margin-left:auto;background:none;border:none;color:var(--imt,#9a8c6e);font-size:14px;cursor:pointer}
.ms-bd{padding:10px 16px;overflow-y:auto}
.ms-sec{font-size:11px;letter-spacing:2px;color:var(--imt,#9a8c6e);margin:12px 0 4px}
.ms-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed color-mix(in srgb,var(--imt,#9a8c6e) 22%,transparent);font-size:12.5px;color:var(--itx,#e8dcc0);cursor:pointer}
.ms-row:last-child{border-bottom:none}
.ms-row>span{flex:1}
.ms-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--ip,#c9a86a);cursor:pointer}
.ms-num{width:84px;background:rgba(0,0,0,.3);border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 30%,transparent);color:var(--itx,#e8dcc0);border-radius:8px;padding:5px 8px;font-size:12px;outline:none}
.ms-txt{flex:0 0 55%;max-width:55%;background:rgba(0,0,0,.3);border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 30%,transparent);color:var(--itx,#e8dcc0);border-radius:8px;padding:5px 8px;font-size:12px;outline:none}
.ms-note{font-size:12px;color:var(--imt,#9a8c6e);padding:14px 0;text-align:center}
.ms-ft{display:flex;gap:10px;padding:12px 16px;border-top:1px solid color-mix(in srgb,var(--ip,#c9a86a) 18%,transparent)}
.ms-ft button{flex:1;border-radius:9px;padding:8px 0;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.ms-reset{border:1px solid rgba(224,112,112,.4);background:rgba(224,112,112,.1);color:#e8a0a0}
.ms-done{border:1px solid color-mix(in srgb,var(--ip,#c9a86a) 55%,transparent);background:color-mix(in srgb,var(--ip,#c9a86a) 16%,transparent);color:var(--ip,#c9a86a)}`;
        document.head.appendChild(st);
    }

    /* ==================== 公开 API ==================== */
    window.ModuleSettings = {
        version: VERSION,
        describe, opt, isHidden, aliasOf,
        setOpt, setHidden, setAlias, resetMod,
        button, open, close,
        get _store() { return store; }
    };

    /* v3.36.1 修复：⚙ 按钮样式此前在首次打开设置弹窗时才注入——模块头部的 ⚙
       在那之前是裸按钮。改为装载即注入（脚本位于 head，document.head 已就绪） */
    try { if (typeof document !== 'undefined' && document.head) injectStyle(); } catch (e) { }
})();
