/**
 * 氛围引擎 AmbienceLayer（v3.1.0）
 * 全屏天气粒子（Canvas）+ 昼夜色温（双层滤镜）
 * ─ 天气吃 ImmersiveSuite 的 state.weather 中文关键词：雪/雨/雾/沙/花/雷/晴…
 * ─ 昼夜吃 state.time：地支时辰（子丑寅卯）或 24 时制（06:20）
 * ─ 十界各有一套粒子气质（色相/形态/密度），由 genreKey 驱动
 * ─ 性能：单 rAF 循环 · 视口隐藏自停 · prefers-reduced-motion 降级 · DPR 上限 2
 * 存储：ambParticle / ambTint（on|off，默认开）；异常永不外抛（氛围层不许伤主流程）
 */
const AmbienceLayer = (function () {
    'use strict';

    /* ==================== 世界粒子气质 ==================== */
    const MOODS = {
        shrouding:      { hue: 44,  sat: 82, lit: 68, dust: '道纹金尘',  drift: -0.12 },
        doupocangqiong: { hue: 26,  sat: 90, lit: 60, dust: '余烬焰屑',  drift: 0.1 },
        douluodalu:     { hue: 205, sat: 85, lit: 70, dust: '魂光萤羽',  drift: -0.06 },
        wanmeishijie:   { hue: 145, sat: 60, lit: 66, dust: '荒古孢子',  drift: 0.14 },
        swallowedstar:  { hue: 195, sat: 90, lit: 72, dust: '数据流光',  drift: -0.1 },
        quanzhigaoshou:  { hue: 48,  sat: 95, lit: 68, dust: '荣耀金屑',  drift: 0.08 },
        daoguiyixian:    { hue: 8,   sat: 38, lit: 46, dust: '纸灰阴尘',  drift: 0.05 },
        zhongshengdushi:{ hue: 44,  sat: 78, lit: 64, dust: '灵光金尘',  drift: -0.09 },
        dibao:           { hue: 42,  sat: 55, lit: 60, dust: '帝铜鎏尘',  drift: -0.07 },
        longzu:          { hue: 232, sat: 48, lit: 64, dust: '血裔紫霭',  drift: 0.06 },
        quanzhifashi:    { hue: 258, sat: 55, lit: 66, dust: '星辉浮芒',  drift: -0.08 },
        limingzhijian:   { hue: 38,  sat: 72, lit: 64, dust: '魔导火星',  drift: 0.11 },
        lunhuileyuan:    { hue: 355, sat: 62, lit: 58, dust: '数据血芒',  drift: -0.13 },
        wulianfengdian: { hue: 36,  sat: 88, lit: 60, dust: '锻金火花',  drift: 0.12 },
        shengxu:        { hue: 168, sat: 60, lit: 58, dust: '幽蓝孢光',  drift: -0.07 },
        shenmifusu:     { hue: 172, sat: 22, lit: 42, dust: '冥纸残烬',  drift: 0.03 },
        ditandali:      { hue: 38,  sat: 90, lit: 66, dust: '夜市灯屑',  drift: 0.09 },
        fanrenxiuxian:  { hue: 192, sat: 46, lit: 62, dust: '灵石浮芒',  drift: -0.08 },
        xianni:         { hue: 268, sat: 40, lit: 56, dust: '逆途星屑',  drift: 0.05 },
        earth:          { hue: 150, sat: 16, lit: 72, dust: '人间尘光',  drift: -0.04 },
        quanqiubingfeng:{ hue: 202, sat: 42, lit: 74, dust: '寒潮冰晶',  drift: 0.16 },
        chaoshenxueyuan:{ hue: 44,  sat: 52, lit: 66, dust: '圣光金尘',  drift: -0.06 },
        zhanhen:        { hue: 195, sat: 26, lit: 62, dust: '迷雾浮尘',  drift: 0.08 },
        jianlai:        { hue: 192, sat: 30, lit: 66, dust: '山水岚气',  drift: -0.05 },
        guimi:          { hue: 262, sat: 18, lit: 48, dust: '雾都煤灰',  drift: 0.06 },
        guzhenren:      { hue: 96,  sat: 45, lit: 52, dust: '蛊光磷粉',  drift: -0.1 },
        xuanjianxianzu: { hue: 130, sat: 38, lit: 66, dust: '灵田萤露',  drift: 0.05 },
        freeworld:      { hue: 272, sat: 30, lit: 68, dust: '凿空星屑',  drift: -0.05 },
        default:        { hue: 40,  sat: 30, lit: 78, dust: '墨韵浮尘',  drift: -0.04 }
    };
    const mood = (g) => MOODS[g] || MOODS.default;
    const hsl = (m, dl, a) => `hsla(${m.hue},${m.sat}%,${Math.min(96, m.lit + dl)}%,${a})`;

    /* ==================== 天气识别（中文关键词 → 形态） ==================== */
    function parseWeather(txt) {
        const s = String(txt || '');
        if (!s) return { kind: 'dust' };
        if (/雷|闪|霹/.test(s)) return { kind: /雨/.test(s) ? 'storm' : 'thunder' };
        if (/雪|雹|霜/.test(s)) return { kind: 'snow', heavy: /暴|大|狂/.test(s) };
        if (/雨|霖|潇/.test(s)) return { kind: 'rain', heavy: /暴|骤|倾/.test(s) };
        if (/雾|霾|瘴|岚/.test(s)) return { kind: 'fog' };
        if (/沙|尘|砾/.test(s)) return { kind: 'sand', heavy: /暴|狂|漫天/.test(s) };
        if (/花|樱|落英|桃/.test(s)) return { kind: 'petal' };
        if (/晴|朗|万里/.test(s)) return { kind: 'clear' };
        if (/夜|晚|月/.test(s)) return { kind: 'night' };
        return { kind: 'dust' };
    }

    /* ==================== 昼夜调色板（地支 12 档） ====================
       每档：[multiply 色+浓度, soft-light 顶光色+浓度] —— 午间近乎无滤镜，深夜墨蓝 */
    const TINTS = [
        /* 子 0 */ ['#070c22', .42, '120,140,255', .12],
        /* 丑 1 */ ['#070c22', .40, '110,130,240', .10],
        /* 寅 2 */ ['#100b28', .36, '170,120,220', .16],
        /* 卯 3 */ ['#1a1028', .26, '255,175,110', .26],
        /* 辰 4 */ ['#241a10', .12, '255,205,140', .20],
        /* 巳 5 */ ['#ffffff', .00, '255,240,210', .05],
        /* 午 6 */ ['#ffffff', .00, '255,255,240', .00],
        /* 未 7 */ ['#fff6e8', .02, '255,235,195', .06],
        /* 申 8 */ ['#2a1808', .10, '255,185,110', .18],
        /* 酉 9 */ ['#2a1008', .22, '255,135,80', .28],
        /* 戌 10*/ ['#140c26', .34, '150,110,220', .20],
        /* 亥 11 */ ['#080d24', .40, '110,130,250', .12]
    ];
    const HANJI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    /** 时辰文本 → 地支槽位 0-11；失败返回 -1 */
    function hourSlot(t) {
        const s = String(t || '').trim();
        if (!s) return -1;
        if (/^\d/.test(s)) {   /* 24 时制 */
            const m = s.match(/(\d{1,2})\s*[:：时点]/) || s.match(/^(\d{1,2})/);
            if (!m) return -1;
            let h = parseInt(m[1], 10); if (isNaN(h)) return -1;
            h = ((h % 24) + 24) % 24;
            return Math.floor(((h + 1) % 24) / 2);   /* 23:00 与 0:00 均归子时 */
        }
        for (let i = 0; i < HANJI.length; i++) if (s.includes(HANJI[i])) return i;
        return -1;
    }

    /* ==================== 内部状态 ==================== */
    let genre = 'default', weather = { kind: 'dust' }, slot = -1;
    let cv = null, cx = null, W = 0, H = 0, dpr = 1, raf = 0, running = false;
    let parts = [], fogBlobs = [], flash = 0, nextFlash = 0, t0 = 0;
    const reduced = (typeof matchMedia !== 'undefined') && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ls = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };
    const particleOn = () => ls.get('ambParticle', 'on') === 'on';
    const tintOn = () => ls.get('ambTint', 'on') === 'on';

    /* ==================== Canvas 装配 ==================== */
    function ensureCanvas() {
        if (cv) return true;
        try {
            cv = document.createElement('canvas');
            cv.id = 'ambCanvas';
            document.body.appendChild(cv);
            cx = cv.getContext('2d');
            if (!cx) return false;          /* 极老环境：无 2d 上下文，粒子静默退出 */
            sizeCanvas();
            window.addEventListener('resize', () => { clearTimeout(sizeCanvas._t); sizeCanvas._t = setTimeout(sizeCanvas, 200); });
            document.addEventListener('visibilitychange', () => document.hidden ? stop() : kick());
            return true;
        } catch (e) { cv = null; return false; }
    }
    function sizeCanvas() {
        if (!cv) return;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = window.innerWidth; H = window.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
    }

    /* ==================== 粒子工厂 ==================== */
    const R = (a, b) => a + Math.random() * (b - a);
    function spawn(layer) {   /* layer: 0 远 1 中 2 近 —— 视差三層 */
        const k = weather.kind, m = mood(genre);
        const p = { x: R(-40, W + 40), y: R(-H * .2, H + 20), layer, ph: R(0, 6.28), spin: R(-2, 2) };
        switch (k) {
            case 'snow': p.r = [1.1, 1.9, 3.0][layer] * (weather.heavy ? R(1.2, 1.9) : R(.85, 1.25));
                p.vy = (16 + layer * 16) * (weather.heavy ? 2.1 : 1); p.vx = R(-14, 10) + m.drift * 60; break;
            case 'rain': p.len = [5, 9, 15][layer] * (weather.heavy ? 1.7 : 1);
                p.vy = (420 + layer * 260) * (weather.heavy ? 1.5 : 1); p.vx = -34 - layer * 14; break;
            case 'sand': p.r = R(.7, 1.9); p.vy = R(6, 22); p.vx = -(200 + layer * 190) * (weather.heavy ? 1.6 : 1);
                p.len = R(6, 22); break;
            case 'petal': p.r = [2.2, 3.4, 4.8][layer]; p.vy = 22 + layer * 14; p.vx = R(-26, 12); break;
            default:      /* dust / clear / night / storm 余粒 */
                p.r = R(.6, 1.8) * (1 + layer * .5); p.vy = -R(3, 11); p.vx = R(-6, 6) + m.drift * 26; p.glow = true;
        }
        return p;
    }
    function build() {
        if (!cx) return;
        parts = []; fogBlobs = [];
        const k = weather.kind, m = mood(genre);
        let base = Math.min(190, Math.round(W * H / 8200));
        const counts = { snow: weather.heavy ? 1.9 : 1.25, rain: 1.35, sand: 1.5, petal: .8, fog: 0, dust: .32, clear: .26, night: .5, storm: 1, thunder: .3 };
        let n = Math.round(base * (counts[k] != null ? counts[k] : .4));
        n = Math.max(14, Math.min(300, n));
        if (k === 'fog') {
            for (let i = 0; i < 5; i++) fogBlobs.push({ x: R(0, W), y: R(H * .15, H * .95), r: R(W * .22, W * .5), vx: R(4, 14) * (Math.random() < .5 ? -1 : 1), ph: R(0, 6.28) });
        }
        for (let i = 0; i < n; i++) parts.push(spawn(i % 3));
        nextFlash = performance.now() + R(4000, 9000);
    }

    /* ==================== 主循环 ==================== */
    function frame(now) {
        if (!running) return;
        const dt = Math.min(64, now - (t0 || now)); t0 = now;
        const k = weather.kind, m = mood(genre);
        cx.clearRect(0, 0, W, H);

        /* 雾团：大半透明径向渐变漂移 */
        if (k === 'fog') {
            for (const f of fogBlobs) {
                f.x += f.vx * dt / 1000; f.ph += dt / 1400;
                if (f.x < -f.r) f.x = W + f.r; if (f.x > W + f.r) f.x = -f.r;
                const a = .05 + .035 * (Math.sin(f.ph) * .5 + .5);
                const g = cx.createRadialGradient(f.x, f.y, f.r * .1, f.x, f.y, f.r);
                g.addColorStop(0, `rgba(190,196,210,${a + .03})`); g.addColorStop(1, 'rgba(190,196,210,0)');
                cx.fillStyle = g; cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.29); cx.fill();
            }
        }

        for (const p of parts) {
            const sway = Math.sin((now / 1000) * 1.4 + p.ph);
            p.x += (p.vx + (k === 'snow' || k === 'petal' ? sway * 22 : 0)) * dt / 1000;
            p.y += p.vy * dt / 1000;
            if (k === 'petal') p.spin += dt / 600;
            const out = p.y > H + 30 || p.y < -H * .3 || p.x < -60 || p.x > W + 60;
            if (out) { Object.assign(p, spawn(p.layer)); if (p.vy > 0) p.y = -20; else p.y = H + 16; if (p.vx < 0) p.x = W + 30; else p.x = -30; continue; }

            cx.save();
            if (k === 'rain' || k === 'storm') {
                const op = [.25, .4, .6][p.layer];
                cx.strokeStyle = `rgba(174,194,224,${op})`; cx.lineWidth = [.8, 1.1, 1.5][p.layer];
                cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.vx * .024, p.y + p.len); cx.stroke();
            } else if (k === 'snow') {
                const op = [.4, .62, .9][p.layer];
                cx.fillStyle = `rgba(244,248,255,${op})`;
                if (p.layer === 2 && p.r > 2.6) {   /* 近层大朵：六枝星形 */
                    cx.translate(p.x, p.y); cx.rotate(now / 2400 + p.ph);
                    cx.strokeStyle = `rgba(244,248,255,${op * .9})`; cx.lineWidth = 1;
                    for (let i = 0; i < 6; i++) { cx.rotate(Math.PI / 3); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(0, -p.r * 1.7); cx.stroke(); }
                } else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.29); cx.fill(); }
            } else if (k === 'sand') {
                cx.strokeStyle = hsl(m, 8, [.3, .45, .65][p.layer]); cx.lineWidth = p.r;
                cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.len, p.y - p.len * .16); cx.stroke();
            } else if (k === 'petal') {
                cx.translate(p.x, p.y); cx.rotate(p.spin);
                cx.fillStyle = `rgba(248,${185 + p.layer * 18},${200 + p.layer * 12},${[.5, .7, .9][p.layer]})`;
                cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.29); cx.fill();
            } else {   /* 灵光尘：上浮 + 呼吸闪烁，六界各色 */
                const tw = .5 + .5 * Math.sin(now / 900 + p.ph * 3);
                const op = [.2, .38, .6][p.layer] * (.45 + .55 * tw);
                const rr = p.r * (0.8 + .5 * tw);
                const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 5);
                g.addColorStop(0, hsl(m, 10, Math.min(1, op + .3))); g.addColorStop(1, hsl(m, 10, 0));
                cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, rr * 5, 0, 6.29); cx.fill();
                cx.fillStyle = hsl(m, 24, Math.min(1, op + .45));
                cx.beginPath(); cx.arc(p.x, p.y, rr * .8, 0, 6.29); cx.fill();
            }
            cx.restore();
        }

        /* 雷：tintB 上叠一次双闪 */
        if ((k === 'thunder' || k === 'storm') && now > nextFlash) {
            flash = 1; nextFlash = now + R(6000, 16000);
            setTimeout(() => { flash = .8; }, 90);   /* 双连闪 */
        }
        if (flash > 0) {
            cx.fillStyle = `rgba(225,235,255,${flash * .32})`;
            cx.fillRect(0, 0, W, H);
            flash = Math.max(0, flash - dt / 260);
        }
        raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (running || !cx || !particleOn() || reduced) return;
      if (document.documentElement && document.documentElement.classList.contains('low-spec')) return; /* v3.55.3 流畅模式停粒子 */
      running = true; t0 = 0; raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); if (cx) cx.clearRect(0, 0, W, H); }

    /* ==================== 昼夜滤镜层 ==================== */
    let tA = null, tB = null;
    function ensureTint() {
        if (tA) return;
        try {
            tA = document.createElement('div'); tA.id = 'ambTintA';
            tB = document.createElement('div'); tB.id = 'ambTintB';
            document.body.appendChild(tA); document.body.appendChild(tB);
        } catch (e) { tA = null; }
    }
    function applyTint() {
        ensureTint();
        if (!tA) return;
        if (slot < 0 || !tintOn()) {
            tA.style.opacity = '0'; tB.style.opacity = '0'; return;
        }
        const [mult, ma, glow, ga] = TINTS[slot];
        tA.style.background = mult;
        tA.style.opacity = String(ma);
        tB.style.background = `radial-gradient(120% 62% at 50% -8%, rgba(${glow},${Math.min(.5, ga)}) 0%, rgba(${glow},0) 62%)`;
        tB.style.opacity = '1';
        tA.dataset.slot = HANJI[slot] || '';
    }

    /* ==================== 公开 API ==================== */
    const api = {
        /** 世界切换（重定粒子气质） */
        setGenre(g) { genre = g || 'default'; build(); return api; },
        /** 天气更新：中文描述任意长度 */
        setWeather(txt) { const w = parseWeather(txt); const changed = w.kind !== weather.kind || !!w.heavy !== !!weather.heavy; weather = w; if (changed) build(); kick(); return api; },
        /** 时辰更新：地支或 24 时制 */
        setTime(t) { const s = hourSlot(t); if (s !== slot) { slot = s; applyTint(); } return api; },
        /** 两个总开关（设置页签用），返回当前态描述 */
        toggleParticle() { const on = !particleOn(); ls.set('ambParticle', on ? 'on' : 'off'); on ? kick() : stop(); return on; },
        toggleTint() { const on = !tintOn(); ls.set('ambTint', on ? 'on' : 'off'); applyTint(); return on; },
        particleEnabled: particleOn, tintEnabled: tintOn,
        /** 首次启动（页面就绪即可调用，天气/时辰未知时先铺世界底噪灵光） */
        init(g) { if (g) genre = g; try { if (particleOn() && ensureCanvas()) kick(); applyTint(); } catch (e) { /* 氛围层永不伤主流程 */ } return api; },
        /** 调试口 */
        _info() { return { genre, weather, slot: slot, running, n: parts.length }; }
    };
    return api;
})();
window.AmbienceLayer = AmbienceLayer;
