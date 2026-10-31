/**
 * 🗄 存储扩容 StorageBoost（v3.19.0 · 万象扩展版）
 * ---------------------------------------------------------------------------
 * localStorage 的 5MB 是云境的隐形天花板：立绘超 500KB 不落盘、随档上限
 * 12 人、大图重绘烧钱。本模块引入 localForage（IndexedDB 同形封装），
 * 把「大体积 dataURL / 长文本」分流进数百 MB 的 IDB：
 *   - media 仓：图片等二进制（消费方用 idb:// 前缀标记在原存档里占位）
 *   - 预热：启动时把 IDB 内容灌回消费方会话内存表（同步读路径零改造）
 *   - 体检：容量估算（navigator.storage.estimate，配额通常数百 MB 起）
 * 挂载：studio.html 各业务模块之后；npc-portrait.js 是首个消费方。
 * 附带：window.loadLibOnce —— 大库（lunar/cytoscape 等）按需懒加载的公共
 * 工具（首屏只带 localforage + confetti 两个小库，700KB+ 的大库用时再取）。
 */
(function () {
    'use strict';

    const IDB_PREFIX = 'idb://';
    const _libLoading = {};

    /** 通用懒加载：lib 已在（全局变量存在）直接兑现；否则动态注入 <script>，失败不缓存 */
    window.loadLibOnce = function (src, globalName) {
        if (globalName && window[globalName]) return Promise.resolve(true);
        if (_libLoading[src]) return _libLoading[src];
        _libLoading[src] = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => { delete _libLoading[src]; resolve(false); };
            document.head.appendChild(s);
        });
        return _libLoading[src];
    };

    const StorageBoost = {

        IDB_PREFIX,

        /* ==================== 就绪与仓库 ==================== */

        /** localForage 是否已加载（studio.html 同步引入，正常恒真） */
        ready() { return !!window.localforage; },

        /** media 仓单例（独立于 localforage 默认仓，清理互不干扰） */
        store() {
            if (this._store) return this._store;
            if (!window.localforage) return null;
            try {
                /* 显式走 window.localforage：与 ready() 判据同源，
                   沙箱/模块作用域下裸标识符解析不到也不致静默降级 */
                this._store = window.localforage.createInstance({ name: (window.YunjingID && window.YunjingID.dbName) ? window.YunjingID.dbName('moshu') : 'moshu', storeName: 'media' });
            } catch (e) { return null; }
            return this._store;
        },

        /* ==================== 标记读写（消费方约定） ==================== */

        /** 该 url 是否为 IDB 占位标记（存档里只存 idb://键，正文数据在 IDB） */
        isMarker(url) { return typeof url === 'string' && url.indexOf(IDB_PREFIX) === 0; },

        /** 生成占位标记 */
        marker(key) { return IDB_PREFIX + key; },

        /* ============ 品牌库迁移收尾（v3.55.24 协作 id-migrate.js） ============
           id-migrate 复制旧库(moshu)→新库(yunjing)并标记完成后派发本事件。
           此前直接切读新库会丢「迁移后本会话的写入」（实测全量对话 transcript
           104 楼退回 1 楼快照）。现由本模块收尾：把旧库当前最新数据整库补写进
           新库（旧库在本会话是超集——迁移后的写入全落在旧库实例上），然后清掉
           实例缓存，此后新建的仓一律用新库名。旧库保留作数据兜底。 */
        _installMigrationTail() {
            if (this._migTailInstalled || !window.localforage) return;
            this._migTailInstalled = true;
            const self = this;
            window.addEventListener('yunjing-db-migrated', async (ev) => {
                try {
                    const from = (ev && ev.detail && ev.detail.from) || 'moshu';
                    const to = (ev && ev.detail && ev.detail.to);
                    if (!to || from === to) return;
                    if (window.YunjingID && typeof window.YunjingID.dbName === 'function' && window.YunjingID.dbName(from) === from) {
                        /* 标记尚未生效（异常时序）：不切换，仅保留旧库 */
                    }
                    const oldStore = window.localforage.createInstance({ name: from, storeName: 'media' });
                    const keys = await oldStore.keys();
                    /* 目标必须是显式新建的新库实例——self.store() 此时可能返回
                       缓存的旧库实例（本会话早已建仓），补写会自我覆盖而失效 */
                    const dst = window.localforage.createInstance({ name: to, storeName: 'media' });
                    let copied = 0;
                    for (const k of keys) {
                        try {
                            const v = await oldStore.getItem(k);
                            if (v != null) { await dst.setItem(k, v); copied++; }
                        } catch (e) { /* 单键失败不阻断 */ }
                    }
                    /* 切换：清缓存后本会话后续 store() 一律新库名（已含全部最新数据） */
                    self._store = null;
                    console.log('[存储扩容] 品牌库迁移收尾完成：', from, '→', to, '，补写', copied, '键，已切换新库');
                } catch (e) {
                    console.warn('[存储扩容] 迁移收尾失败（保留旧库，下次会话重试）:', e && e.message);
                }
            });
        },

        /** 写入（dataURL / 长文本）。成功返回 true；库缺失 / 写失败返回 false（消费方自行降级） */
        async put(key, value) {
            const st = this.store();
            if (!st || value == null) return false;
            try { await st.setItem(String(key), value); return true; }
            catch (e) { console.warn('[存储扩容] 写入失败（配额或隐私模式）:', e.message); return false; }
        },

        /** 读取（不存在返回 ''，绝不抛错） */
        async get(key) {
            const st = this.store();
            if (!st) return '';
            try {
                const v = await st.getItem(String(key));
                return (v == null) ? '' : String(v);
            } catch (e) { return ''; }
        },

        /** 删除（存档清理时联动；失败静默） */
        async remove(key) {
            const st = this.store();
            if (!st) return false;
            try { await st.removeItem(String(key)); return true; }
            catch (e) { return false; }
        },

        /** 全部键（前缀过滤可空） */
        async keys(prefix) {
            const st = this.store();
            if (!st) return [];
            try {
                const ks = await st.keys();
                return prefix ? ks.filter(k => String(k).indexOf(prefix) === 0) : ks;
            } catch (e) { return []; }
        },

        /* ==================== 容量体检 ==================== */

        /** 浏览器存储配额估算（IDB + localStorage 合计），供「存档体检」引用 */
        async capacity() {
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const est = await navigator.storage.estimate();
                    const used = Number(est.usage) || 0;
                    const quota = Number(est.quota) || 0;
                    return { ok: true, used, quota, pct: quota ? Math.round(used / quota * 1000) / 10 : null };
                }
            } catch (e) { }
            return { ok: false, used: 0, quota: 0, pct: null };
        },

        /** media 仓条目数与总体积（dataURL 粗算） */
        async mediaStats() {
            const ks = await this.keys();
            let bytes = 0;
            for (const k of ks) {
                const v = await this.get(k);
                bytes += v.length;
            }
            return { count: ks.length, bytes };
        },

        /** 一键清空 media 仓（「重新开篇」等彻底清理场景用） */
        async clearMedia() {
            const st = this.store();
            if (!st) return 0;
            try {
                const n = (await st.keys()).length;
                await st.clear();
                return n;
            } catch (e) { return 0; }
        }
    };

    window.StorageBoost = StorageBoost;
    StorageBoost._installMigrationTail();
})();
