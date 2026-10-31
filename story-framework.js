/**
 * 通用小说创作框架 - Story Framework
 * 模仿「觅长生」game-framework.js 的配置驱动架构
 * 提供故事状态管理、会话历史、API 配置持久化等通用功能
 * 可以被不同的类型配置文件（configs/*-config.js）使用
 */

/* ==================== v3.18.1 书档隔离工具（修复：新开书残留上一本书的角色） ====================
 * 背景：沉浸档 imm_{genre}、世界线 tl_{genre} 等"书内数据"旧版按界共享——书架里
 * 多本书共用一份，新书的人物志/编年史/世界线全是上一本书的数据（用户反馈）。
 * 方案：与 storySave 同规则挂槽位后缀（主档无后缀=老键零迁移，副档 ~{slotId}），
 * 并提供旧共享键的一次性归属迁移（见 adoptLegacySlotKey）。 */
window.slotSuffixOf = function (genre) {
    try {
        let sid = (window.storyFramework && window.storyFramework.slotId) || '';
        if (!sid) sid = localStorage.getItem('storyActiveSlot_' + (genre || '')) || 'main';
        return (sid && sid !== 'main') ? '~' + sid : '';
    } catch (e) { return ''; }
};

/** 旧共享键一次性归属迁移：当前活跃副档「已有存档但无自有档」时，
 *  把旧共享键的数据认领为本档（迁移后删除旧键，主档与其余书档从此不再串味）。
 *  全新书（无存档）不认领——正是"新书残留旧书数据"的病灶，应从零开始。
 *  @returns {string} 本档应使用的键（无论是否发生迁移） */
window.claimSlotKey = function (legacyKey, genre) {
    const suffix = window.slotSuffixOf(genre);
    if (!suffix) return legacyKey;                        // 主档：直接沿用旧键
    const mine = legacyKey + suffix;
    try {
        if (!localStorage.getItem(mine) && localStorage.getItem(legacyKey)) {
            const g = genre || (window.storyFramework && window.storyFramework.genre) || '';
            const hasSave = !!(localStorage.getItem(`storySave_${g}${suffix}`) || localStorage.getItem(`storySave_${g}${suffix}.bak`));
            if (hasSave) {
                localStorage.setItem(mine, localStorage.getItem(legacyKey));
                localStorage.removeItem(legacyKey);
            }
        }
    } catch (e) { /* 迁移失败按无档处理，不伤主流程 */ }
    return mine;
};

class StoryFramework {
    constructor(config) {
        this.config = config; // 类型特定配置（悬疑/科幻/武侠/克苏鲁/自由）
        this.storyState = {
            variables: {},            // (variable_update) 解析后的全部变量
            conversationHistory: [],  // 完整对话历史 [{role, content}]
            isStoryStarted: false,    // 是否已完成故事设定并开篇
            setup: null,              // 故事设定（书名/视角/文风/开篇/技法/六维）
            lastVariables: {},        // 上一轮变量快照（用于增量渲染）
            turnCount: 0,             // 正文轮数（灵感引擎触发依据）
            turns: [],                // 轮次快照栈（回退 / 重新生成依据）
            illustrations: []         // v3.9.0 插图引擎：已生成插图记录 [{turn, prompt, url, ts}]（随档保存，回放命中缓存直显）
        };
        this.apiConfig = {
            endpoint: '',
            apiKey: '',
            model: '',
            type: 'openai',   // openai | gemini
            maxTokens: 16384,
            temperature: 0.9,
            stream: true      // 流式输出（兼容"假流式"中转模型；边生成边显示）
        };
        this.isProcessing = false;
        this.genre = config ? config.genreKey : 'free';
        // v3.5.0 多存档槽：本界书架的当前档位（'main' 为主档——键名不变，老存档无缝兼容）
        try { this.slotId = localStorage.getItem(`storyActiveSlot_${this.genre}`) || 'main'; }
        catch (e) { this.slotId = 'main'; }
    }

    /**
     * 初始化创作框架
     */
    init() {
        console.log('[StoryFramework] 初始化创作框架:', this.config.genreName);
        this.loadApiConfig();
        this.loadSave();
        if (this.config.onInit) {
            this.config.onInit(this);
        }
    }

    // ==================== API 配置（全局共享） ====================

    /** 前置检查：接口是否已配置完整（用于发请求前友好引导，而非事后报错） */
    isApiConfigured() {
        return !!(this.apiConfig.endpoint && this.apiConfig.apiKey && this.apiConfig.model);
    }

    /** 未配置时的统一引导：提示 + 自动打开接口设置弹窗 */
    guideToConfig() {
        window.StoryResponseHandler?.renderSystemMessage(
            '⚙ 尚未配置 AI 接口：已为你打开「接口设置」，填入 API 地址 / Key / 模型名并保存后，重试即可。', 'error');
        if (window.ConfigModal) window.ConfigModal.open();
    }

    loadApiConfig() {
        const saved = localStorage.getItem('storyApiConfig');
        if (saved) {
            // v1.6.8 修复：损坏的 storyApiConfig（写入被截断/手动编辑出错）会让 JSON.parse 抛
            // SyntaxError → init 中断 → studio 白屏假死。损坏时丢弃并回默认配置。
            try {
                const cfg = JSON.parse(saved);
                if (cfg && typeof cfg === 'object') {
                    this.apiConfig = { ...this.apiConfig, ...cfg };
                }
            } catch (e) {
                console.error('[StoryFramework] 接口配置损坏，已重置为默认:', e);
                localStorage.removeItem('storyApiConfig');
            }
        }
    }

    /** 持久化接口配置：配额满/隐私模式写入失败不再打断保存流程（半保存状态更糟） */
    saveApiConfig() {
        try {
            localStorage.setItem('storyApiConfig', JSON.stringify(this.apiConfig));
        } catch (e) {
            console.error('[StoryFramework] 接口配置保存失败（存储已满或被禁用）:', e);
            window.showToast?.('配置保存失败：浏览器本地存储已满或被禁用，请清理站点数据后重试', 'error');
        }
    }

    // ==================== 存档（按类型隔离） ====================

    getSaveKey() {
        // v3.5.0 多存档槽：主档保持原键（老存档零迁移），副档挂槽位后缀
        const suffix = this.slotId && this.slotId !== 'main' ? `~${this.slotId}` : '';
        return `storySave_${this.genre}${suffix}`;
    }

    saveStory() {
        /* v3.55.4 写合并：一轮落档路径上「主笔收尾 + 记忆登记 + 舞台登记 + 手机消息…」
           旁路系统会在同一 tick 内连打多次 saveStory()，每次都全量 JSON.stringify +
           主档/.bak 双写——大存档在低配设备上是明显卡顿源。
           现合并为微任务级一次落盘：同 tick 内只真正序列化写盘一次；
           微任务在当前宏任务结束前必然执行，页面隐藏/关闭前不可能丢写。
           clearSave 会取消挂起的写入，杜绝「清档瞬间旧档复活」（v3.47.1 同类竞态）。 */
        this._saveDirty = true;
        if (this._saveQueued) return;
        this._saveQueued = true;
        const run = () => {
            this._saveQueued = false;
            if (!this._saveDirty) return;   // clearSave 已取消：本次合并写作废
            this._saveDirty = false;
            try { this._saveStoryNow(); } catch (e) { console.error('[StoryFramework] 存档异常:', e); }
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(run);
        else Promise.resolve().then(run);
    }

    /** 立即冲刷挂起的合并写（切档 reload 前等紧急场景可显式调用；平时无需） */
    flushSave() {
        if (this._saveQueued && this._saveDirty) {
            this._saveDirty = false;
            try { this._saveStoryNow(); } catch (e) { console.error('[StoryFramework] 存档异常:', e); }
        }
        this._saveQueued = false;
    }

    /** 真正落盘（仅由合并队列 / flushSave 调用，勿直接调用） */
    _saveStoryNow() {
        // 动态世界运行态：剔除易失的 isProcessing 后随档保存
        const dwState = this.storyState.dynamicWorld
            ? { ...this.storyState.dynamicWorld, isProcessing: false }
            : undefined;
        const data = {
            variables: this.storyState.variables,
            conversationHistory: this.storyState.conversationHistory.slice(-80), // 防止超出localStorage上限
            isStoryStarted: this.storyState.isStoryStarted,
            setup: this.storyState.setup,
            turnCount: this.storyState.turnCount,
            turns: (this.storyState.turns || []).slice(-40),   // 轮次快照（回退/重新生成）
            inspirations: (this.storyState.inspirations || []),  // v1.6.8 修复：灵感采纳前不持久化，刷新即丢
            dynamicWorld: dwState,
            digest: this.storyState.digest || undefined,        // v1.6.9 T2-⑦：前情提要滚动摘要
            driftNotes: this.storyState.driftNotes || undefined, // v3.5.0：数值防漂移纠偏注记（跨轮持久，取后即清）
            // v3.6.0 质检套件：文风画像 / 角色圣经 / 节奏伏笔雷达 / 责编手记
            styleLog: this.storyState.styleLog || undefined,
            styleBaseline: this.storyState.styleBaseline || undefined,
            styleDeepNote: this.storyState.styleDeepNote || undefined,   // v3.7.0 文风道深度诊断（持久在场直至覆盖）
            bibleSnap: this.storyState.bibleSnap || undefined,
            bibleAlerts: this.storyState.bibleAlerts || undefined,
            pacingLog: this.storyState.pacingLog || undefined,
            pacingNotes: this.storyState.pacingNotes || undefined,
            reviewNotes: this.storyState.reviewNotes || undefined, // 取后即清
            reviewLog: this.storyState.reviewLog || undefined,
            tokenUsage: this.storyState.tokenUsage || undefined, // v1.6.9 T2-⑩：token 用量记账（累计口径随档）
            illustrations: (this.storyState.illustrations || []).slice(-60), // v3.9.0 插图记录（引擎侧已做体积防御，此处再限条数）
            phone: this.storyState.phone ? { ...this.storyState.phone, isProcessing: false } : undefined, // v3.19.6 地球开放世界·手机分身（联系人/聊天/朋友圈随档）
            recap: this.storyState.recap || undefined,        // v3.16.0 前情回顾：读档回归摘要（同章复用，章节推进后重生成）
            npcPortraits: this.storyState.npcPortraits || undefined, // v3.16.0 NPC 立绘表（模块侧已限 12 人/500KB）
            bookmarks: (this.storyState.bookmarks || []).slice(-30), // v3.17.0 名场面书签（模块侧已限 30 条）
        weeklyLog: (this.storyState.weeklyLog || []).slice(-12), // v3.17.0 创作周报流水（保留 12 周）
        // v3.18.0 万卡归宗版：分层长期记忆 / 舞台快照（模块侧已限层容量与历幕条数）
        memoryLayers: this.storyState.memoryLayers || undefined, // 五层记忆 {facts/relations/secrets/scenes/arcs, _upTo}
        sceneState: this.storyState.sceneState || undefined,     // 舞台快照 {current, history[≤12]}
            savedAt: new Date().toISOString()
        };
        /* v3.55.22 几千楼不忘剧情：localStorage 内联仅留最近 80 轮作兜底/快速冷加载，
           全量 conversationHistory 另存 IndexedDB（数百 MB 配额，刷新不丢）。
           带 upTo 元数据：读档时用「尾对齐」合并，陈旧 IDB 永不截断更新的内联楼层。
           楼数未变的重复保存直接跳过（性能护栏）。 */
        const trKey = this.getSaveKey();
        const fullCH = this.storyState.conversationHistory;
        if (window.StorageBoost && StorageBoost.ready() && Array.isArray(fullCH) && fullCH.length) {
            try { localStorage.setItem(trKey + '.tr', '1'); } catch (e) { }
            if (fullCH.length !== (this._trFlushedLen || 0)) {
                this._trFlushedLen = fullCH.length;
                /* StorageBoost.get 会 String(v)——对象必须先 JSON.stringify，读端再 parse 回来 */
                StorageBoost.put('transcript/' + trKey, JSON.stringify({ upTo: fullCH.length, floors: fullCH })).catch(() => { this._trFlushedLen = 0; });
            }
        }
        let json = JSON.stringify(data);
        const key = this.getSaveKey();

        /* v3.19.2 配额梯队：localStorage 全站仅约 5MB（主档+.bak+各书档+配置共用），
           写满时逐级瘦身保主档落盘，不再一轮爆死。
           梯队①撤备份 → ②插图骨架化 → ③立绘转 IndexedDB → ④整档转 IndexedDB */
        const write = (j) => { try { localStorage.setItem(key, j); return true; } catch (e) { return false; } };
        const done = () => { try { window.SaveSlots?.syncMeta(this); } catch (e) { } };

        // 正常路径：先把上一份存档挪到 .bak 槽再写主档（主档写坏时 loadSave 自动回退备份）
        try {
            const prev = localStorage.getItem(key);
            if (prev && prev !== json) {
                try { localStorage.setItem(key + '.bak', prev); } catch (e) { /* 配额不足：跳过备份 */ }
            }
        } catch (e) { }
        if (write(json)) { done(); return; }

        /* 梯队①：配额已满——撤掉 .bak 腾出整档空间直写主档。
           备份是锦上添花，主档落盘才是正事 */
        try { localStorage.removeItem(key + '.bak'); } catch (e) { }
        if (write(json)) {
            window.showToast?.('💾 存储空间紧张：已停用自动备份保住本轮存档。建议「导出存档」备份，或清理本站数据', 'info');
            done(); return;
        }

        /* 梯队②：插图 dataURL 骨架化（记录保留、图可重绘）——插图上限 2.5MB，常是配额大头 */
        if (Array.isArray(data.illustrations)
            && data.illustrations.some(x => typeof x.url === 'string' && x.url.startsWith('data:'))) {
            data.illustrations = data.illustrations.map(x =>
                (typeof x.url === 'string' && x.url.startsWith('data:')) ? { ...x, url: '' } : x);
            json = JSON.stringify(data);
            if (write(json)) {
                this.storyState.illustrations = data.illustrations;   /* 内存态同步：下次存档不再反弹 */
                window.showToast?.('💾 存储空间不足：已清空插图缓存本体（记录保留、可重绘）后落盘。建议导出备份或清理旧档', 'info');
                done(); return;
            }
        }

        /* 梯队③：立绘 dataURL 分流进 IndexedDB（复用 npc-portrait 的 idb:// 标记机制，
           数百 MB 配额；内存表同步，本次会话立绘照常可见） */
        const portraits = data.npcPortraits;
        if (portraits && window.StorageBoost && StorageBoost.ready()) {
            let moved = false;
            for (const [name, entry] of Object.entries(portraits)) {
                if (entry && typeof entry.url === 'string' && entry.url.startsWith('data:')) {
                    const k = '立绘/' + name;
                    const url = entry.url;
                    portraits[name] = { ...entry, url: StorageBoost.marker(k) };
                    if (window.NpcPortrait) {
                        (window.NpcPortrait._mem = window.NpcPortrait._mem || {})[name] = { url, ts: Date.now() };
                    }
                    StorageBoost.put(k, url);   /* 异步落 IDB，失败则仅本次会话内可见 */
                    moved = true;
                }
            }
            if (moved) {
                json = JSON.stringify(data);
                if (write(json)) {
                    window.showToast?.('💾 存储空间不足：立绘已转入浏览器大容量存储（IndexedDB）', 'info');
                    done(); return;
                }
            }
        }

        /* 梯队④：localStorage 彻底放不下（多书档共用配额或文本本身超限）——整档转 IndexedDB */
        if (window.StorageBoost && StorageBoost.ready()) {
            const j = json;
            StorageBoost.put('主档/' + key, j).then(ok => {
                if (ok) {
                    try { localStorage.setItem(key + '.idb', '1'); } catch (e) { }
                    window.showToast?.('💾 localStorage 配额已满：存档已转入浏览器大容量存储（IndexedDB），进度不丢', 'info');
                } else {
                    window.showToast?.('⚠ 存档失败：浏览器本地存储空间不足或被禁用，本轮回合未落盘。请导出存档备份，或清理本站数据后重试', 'error');
                }
            });
            return;
        }

        console.error('[StoryFramework] 存档失败（可能超出容量）');
        // v3.13.1 修复：旧版只打 console——配额满/隐私模式拦截时用户完全无感知，
        // 以为进度已存上，刷新后整章蒸发。现在明确弹提示并指路
        window.showToast?.('⚠ 存档失败：浏览器本地存储空间不足或被禁用，本轮回合未落盘。请导出存档备份，或清理本站数据后重试', 'error');
    }

    loadSave() {
        const read = (key) => {
            const saved = localStorage.getItem(key);
            if (!saved) return null;
            try { return JSON.parse(saved); } catch (e) { return null; }
        };
        // v1.6.9 T2-⑪：主档损坏时自动回退 .bak 备份（两档同坏才判定无存档）
        let data = read(this.getSaveKey());
        let fromBak = false;
        if (!data) {
            data = read(this.getSaveKey() + '.bak');
            fromBak = !!data;
        }
        if (data) {
            this.storyState = { ...this.storyState, ...data, lastVariables: {} };
            // v3.27.5：读档即自愈（旧档 items 等容器可能已被历史版本的行式指令污染）
            try { window.VariableInstructionParser?.normalizeContainers(this.storyState.variables); } catch (e) { }
            console.log('[StoryFramework] 读取存档成功，共', this.storyState.conversationHistory.length, '条历史');
            if (fromBak) {
                console.warn('[StoryFramework] 主存档损坏，已从自动备份恢复');
                window.showToast?.('⚠ 主存档已损坏，已自动从上一份备份恢复', 'info');
            }
            /* v3.55.22 几千楼不忘剧情：内联主档仅 80 轮，全量 transcript 落在 IndexedDB。
               此处异步补回完整历史，并用 Promise 暴露给启动链路——replayHistory 前 await，
               避免几千楼只渲/只恢复最近 80 轮。
               合并算法（尾对齐）：IDB 记录 upTo（已覆盖楼层总数）。在最近 80 轮的内联
               尾部里找 IDB 末楼的对齐点，IDB 之前的全量 + 对齐点之后的内联增量拼接——
               即使 IDB 落盘比内联旧几楼（最后一次 flush 被跳过/中断），也一楼不丢。 */
            this._transcriptPromise = null;
            if (localStorage.getItem(this.getSaveKey() + '.tr') && window.StorageBoost && StorageBoost.ready()) {
                const tk = 'transcript/' + this.getSaveKey();
                this._transcriptPromise = StorageBoost.get(tk).then(raw => {
                    /* StorageBoost.get 返回 JSON 字符串（旧格式直接返回数组），先归一化 */
                    let rec = raw;
                    if (typeof raw === 'string') { try { rec = JSON.parse(raw); } catch (e) { rec = null; } }
                    const inline = this.storyState.conversationHistory || [];
                    const floors = rec && Array.isArray(rec.floors) ? rec.floors : (Array.isArray(rec) ? rec : null);
                    if (!floors || !floors.length) return this.storyState;
                    let merged = null;
                    try {
                        const upTo = Number(rec.upTo) || floors.length;
                        const lastPersisted = floors[upTo - 1];
                        if (lastPersisted && upTo < upTo + inline.length) {
                            /* 在内联尾部（从后往前）找 IDB 末楼：找到则内联在其后为增量 */
                            for (let j = inline.length - 1; j >= 0; j--) {
                                const m = inline[j];
                                if (m && m.content != null &&
                                    String(m.content) === String(lastPersisted.content) &&
                                    (m.role || 'assistant') === (lastPersisted.role || 'assistant')) {
                                    merged = floors.slice(0, upTo).concat(inline.slice(j + 1));
                                    break;
                                }
                            }
                        }
                    } catch (e) { merged = null; }
                    if (!merged) merged = floors.length >= inline.length ? floors.slice() : inline;
                    if (merged.length > inline.length) {
                        this.storyState.conversationHistory = merged;
                        this._trFlushedLen = merged.length;
                        console.log('[StoryFramework] 已从 IndexedDB 恢复全量对话，共', merged.length, '条历史');
                    }
                    return this.storyState;
                }).catch(() => this.storyState);
            }
            return true;
        }
        if (localStorage.getItem(this.getSaveKey()) || localStorage.getItem(this.getSaveKey() + '.bak')) {
            console.error('[StoryFramework] 存档损坏（主档与备份均无法解析）');
        }
        /* v3.19.2：localStorage 两档皆空但 IDB 旗标在——配额耗尽时整档转存的最后容身所。
           异步恢复：boot 后 storyState 落位（聊天记录本就不随刷新重建，消费者均按需读取） */
        if (localStorage.getItem(this.getSaveKey() + '.idb') && window.StorageBoost && StorageBoost.ready()) {
            StorageBoost.get('主档/' + this.getSaveKey()).then(j => {
                if (!j) return;
                try {
                    const d = JSON.parse(j);
                    this.storyState = { ...this.storyState, ...d, lastVariables: {} };
                    // v3.27.5：IDB 大档恢复同样走容器自愈
                    try { window.VariableInstructionParser?.normalizeContainers(this.storyState.variables); } catch (e2) { }
                    console.log('[StoryFramework] localStorage 配额不足，已从 IndexedDB 恢复存档，共', this.storyState.conversationHistory.length, '条历史');
                    window.showToast?.('💾 存档较大，已从浏览器大容量存储（IndexedDB）恢复', 'info');
                } catch (e) { }
            }).catch(() => { });
        }
        return false;
    }

    /** v3.55.22 启动链路等待全量 transcript 从 IDB 恢复（无 IDB/无标记时立即 resolve） */
    whenTranscriptLoaded() {
        return (this._transcriptPromise && typeof this._transcriptPromise.then === 'function')
            ? this._transcriptPromise
            : Promise.resolve(this.storyState);
    }

    clearSave() {
        /* v3.55.4：清档先取消挂起的合并写——否则微任务里的旧状态会在清档后复活 */
        this._saveDirty = false;
        this._saveQueued = false;
        localStorage.removeItem(this.getSaveKey());
        localStorage.removeItem(this.getSaveKey() + '.bak');   // v1.6.9：显式清档时备份一并清除（尊重清空意图）
        // v3.55.22：全量 transcript 的 IDB 记录一并清理，防止幽灵档
        try { localStorage.removeItem(this.getSaveKey() + '.tr'); } catch (e) { }
        // v3.19.2：配额耗尽时转存 IndexedDB 的整档一并清理（旗标+原档），
        // 防止清档后 IDB 幽灵档在下次启动时又被恢复回来
        try {
            localStorage.removeItem(this.getSaveKey() + '.idb');
            if (window.StorageBoost && StorageBoost.ready()) {
                StorageBoost.remove('主档/' + this.getSaveKey());
                StorageBoost.remove('transcript/' + this.getSaveKey());
            }
        } catch (e) { }
        this._trFlushedLen = 0;   /* v3.55.22 transcript 节流游标归零 */
        this._transcriptPromise = null;
        window.TokenUsage?.reset();   // v1.6.9 T2-⑩：用量记账一并清零
        // v1.12.0：行旅图鉴足迹随清档重置
        try {
            if (window.StoryAtlas && this.config && this.config.genreKey) localStorage.removeItem('storyAtlas_' + this.config.genreKey);
            if (window.StoryAtlas) window.StoryAtlas.reset();
        } catch (e) { /* 图鉴故障不影响清档 */ }
        // v3.18.1 修复（用户反馈：新开的书里残留上一本书的角色）：
        // 旧版清档只清存档本体与图鉴——沉浸档（人物志/藏宝阁/编年史/战报/传书）、
        // 世界线、天道成就、界专属进度这些"书内数据"全部残留，重新开篇后
        // 新书直接继承旧书的角色名单与编年史。现随清档一并归零。
        try {
            if (window.ImmersiveSuite && window.ImmersiveSuite.resetForNewStory) window.ImmersiveSuite.resetForNewStory();
            if (window.TimelineBranch && window.TimelineBranch.resetAll) window.TimelineBranch.resetAll();
            if (window.GameLayer && window.GameLayer.resetAll) window.GameLayer.resetAll();
            if (window.ReaderLetters && window.ReaderLetters.resetAll) window.ReaderLetters.resetAll();
            if (window.WorldExt && window.WorldExt._reset) window.WorldExt._reset();
            if (this.config && this.config.genreKey) {
                // 沉浸演出游标（扉页章号 / 回响去重）也是书内状态，一并清
                ['immTitle_', 'immFlash_'].forEach(p => { try { localStorage.removeItem(p + this.config.genreKey); } catch (e) { } });
            }
        } catch (e) { /* 附属系统故障不影响清档主流程 */ }
        this.storyState = {
            variables: {},
            conversationHistory: [],
            isStoryStarted: false,
            setup: null,
            lastVariables: {},
            turnCount: 0,
            turns: [],
            illustrations: [],      // v3.9.0 插图记录随清档一并清空
            dynamicWorld: undefined,
            phone: undefined,       // v3.19.6 手机分身随清档清空（联系人/聊天/朋友圈/待回流近讯）
            digest: undefined,
            recap: undefined,       // v3.16.0 前情回顾随清档清空
            npcPortraits: undefined, // v3.16.0 NPC 立绘随清档清空
            bookmarks: undefined,   // v3.17.0 书签随清档清空
            weeklyLog: undefined,   // v3.17.0 周报流水随清档清空
            tokenUsage: { last: null, byTag: {}, total: { inTok: 0, outTok: 0, requests: 0 } }
        };
    }

    // ==================== 轮次快照（回退 / 重新生成） ====================

    /**
     * 每轮开始前压入现场快照：变量副本 + 历史长度 + 聊天流 DOM 长度 + 轮数。
     * 之后无论本轮发生什么（变量登记 / 变量AI / 世界动态 / 附属卡片），都可整体还原。
     */
    /** 当前轮的绝对轮号（末位快照 index；无快照返回 null）
     *  v1.6.9 T2-⑫：供旁路系统（变量AI/灵感/动态世界）在「触发时刻」捕获轮号，
     *  异步完成渲染卡片时用它打标签——避免用户此时已发下一轮导致标错轮 */
    currentTurnIndex() {
        const t = (this.storyState.turns || [])[this.storyState.turns.length - 1];
        return (t && typeof t.index === 'number') ? t.index : null;
    }

    pushTurnSnapshot(userMsg) {
        const s = this.storyState;
        if (!Array.isArray(s.turns)) s.turns = [];
        const container = document.getElementById('chatMessages');
        // 绝对轮号：接续末条快照的 index + 1（窗口滑动/回退弹栈后 turns.length 会偏移，
        // 不能用它当序号）；空表或旧档无 index 时退回 turns.length
        const last = s.turns[s.turns.length - 1];
        const nextIdx = (last && typeof last.index === 'number') ? last.index + 1 : s.turns.length;
        s.turns.push({
            user: userMsg,
            index: nextIdx,
            varsBefore: JSON.parse(JSON.stringify(s.variables || {})),
            histLen: s.conversationHistory.length,
            domLen: container ? container.children.length : 0,
            turnCount: s.turnCount,
            /* v3.31.3：前情提要与漂移注记一并入快照——回退时同步还原。
             * 背景（玩家反馈"回退次数多了出问题，之前说好的筑基中期"）：旧版只回滚
             * 变量与历史，滚动摘要里仍写着被回退掉的事件（"他已筑基中期"），此后
             * 每轮注入主笔上下文，AI 按旧摘要行文与面板新值打架——多次回退后必现。 */
            digestBefore: (s.digest && s.digest.summary) ? JSON.parse(JSON.stringify(s.digest)) : null,
            driftBefore: Array.isArray(s.driftNotes) ? s.driftNotes.slice() : null
        });
        if (s.turns.length > 40) s.turns.shift(); // 防存档膨胀（index 为绝对轮号，滑动无需重编号）
    }

    /**
     * 弹出并还原最后一轮开始前的现场：
     * 变量回滚 / 历史截断 / 聊天流卡片删除（含该轮附属：变量卡、世界动态通知、选项卡）
     * @returns {object|null} 被还原的轮次（含 user 指令，用于"重新生成"重发）
     */
    restoreTurn() {
        const s = this.storyState;
        if (!Array.isArray(s.turns) || !s.turns.length) return null;
        const t = s.turns.pop();
        // 弹出轮的绝对序号：优先用快照自带的 index，旧档缺失时按"末位"推断
        const poppedIdx = (typeof t.index === 'number') ? t.index : s.turns.length;

        s.variables = t.varsBefore || {};
        // 历史截断"只缩不扩"：旧档 histLen 大于当前历史（存档截80条）时绝不制造 undefined 空槽
        if (typeof t.histLen === 'number' && t.histLen >= 0 && t.histLen <= s.conversationHistory.length) {
            s.conversationHistory.length = t.histLen;
        }
        if (typeof t.turnCount === 'number') s.turnCount = t.turnCount;

        /* v3.31.3：前情提要与漂移注记随轮还原（快照缺失的旧档不覆盖现有值）——
         * 被回退轮次的事件从滚动摘要里一并消失，AI 上下文与面板不再各说各话；
         * 还原后 upToIndex 若越过当前历史长度（多次回退后），保守收缩到边界 */
        if (t.digestBefore !== undefined) {
            s.digest = t.digestBefore || undefined;
            if (s.digest && typeof s.digest.upToIndex === 'number'
                && s.digest.upToIndex > s.conversationHistory.length) {
                s.digest.upToIndex = Math.max(0, s.conversationHistory.length);
            }
        }
        if (t.driftBefore !== undefined) {
            s.driftNotes = t.driftBefore || [];
        }
        /* v3.31.3 回退代际 +1：在飞的滚动摘要（maybeSummarize 异步）完成后比对代际，
         * 发现回退发生过就丢弃结果——防止跨回退落库把旧事件写回摘要（竞态复活） */
        s._rollbackEpoch = (Number(s._rollbackEpoch) || 0) + 1;

        const container = document.getElementById('chatMessages');
        if (container) {
            // 主逻辑：按 data-turn 标签删除该轮全部卡片（用户卡 / 正文卡 / 变量AI卡 / 世界动态通知 / 灵感卡）
            // 标签在渲染时打（tagTurnCard），页面重载回放后快照重校准，删除依然精确。
            // 注意：无标签卡片 getAttribute 返回 null，Number(null)===0 会误判为第 0 轮——必须显式排除
            const doomed = [];
            for (const el of Array.from(container.children)) {
                const raw = el.getAttribute ? el.getAttribute('data-turn') : null;
                if (raw === null || raw === undefined || raw === '') continue;   // 无标签：常驻卡片，不参与删除
                const v = Number(raw);
                if (!Number.isNaN(v) && v >= poppedIdx) doomed.push(el);
            }
            if (doomed.length) {
                doomed.forEach(el => container.removeChild(el));
            } else if (typeof t.domLen === 'number' && t.domLen >= 0 && t.domLen < container.children.length) {
                // 兜底：无标签卡片（旧版存档回放）按 domLen 截断
                while (container.children.length > t.domLen) {
                    container.removeChild(container.lastChild);
                }
            }
        }
        this.updateStatusPanel();
        return t;
    }

    // ==================== 状态更新 ====================

    /**
     * 更新状态面板 - 通用方法
     * 调用类型特定的渲染函数
     */
    updateStatusPanel() {
        if (this.config.renderStatus) {
            this.config.renderStatus(this.storyState.variables);
        }
        // 行旅图鉴：每轮变量落地后同步位置（含回滚还原，onVars 幂等）
        if (window.StoryAtlas) {
            try { window.StoryAtlas.onVars(this.storyState.variables); } catch (e) { /* 图鉴故障不影响主流程 */ }
        }
        // 沉浸套件（太虚阁十二模块）：每轮变量落地后喂给图鉴/天梯/罗盘/战报/编年史
        if (window.ImmersiveSuite) {
            try {
                window.ImmersiveSuite.onVars(this.storyState.variables);
                if (this.config && this.config.genreKey && !document.getElementById('immDrawer')) window.ImmersiveSuite.init();
            } catch (e) { /* 沉浸层故障不影响主流程 */ }
        }
        // v3.2.0 天道层（成就/金榜）与读者来信：随每轮检定
        if (window.GameLayer) { try { window.GameLayer.onVars(this.storyState.variables); } catch (e) { } }
        if (window.ReaderLetters) { try { window.ReaderLetters.onVars(this.storyState.variables); } catch (e) { } }
    }

    /**
     * 更新变量（合并式，保留快照）
     */
    updateVariables(newVars) {
        this.storyState.lastVariables = { ...this.storyState.variables };
        this.storyState.variables = { ...this.storyState.variables, ...newVars };
        // v3.27.5：落地前容器自愈（任何路径写脏 items/foreshadowings/history 都在此修复，
        // 下游 GameLayer 成就判定与面板渲染拿到的恒为数组）
        try { window.VariableInstructionParser?.normalizeContainers(this.storyState.variables); } catch (e) { }
        this.updateStatusPanel();
        this.saveStory();
    }

    /**
     * 获取故事设定配置
     */
    getStorySetupConfig() {
        return this.config.storySetup || null;
    }

    /**
     * 获取状态字段配置
     */
    getStatusFieldsConfig() {
        return this.config.statusFields || [];
    }

    setStoryState(state) {
        this.storyState = { ...this.storyState, ...state };
    }

    getStoryState() {
        return this.storyState;
    }
}

// 导出框架类
window.StoryFramework = StoryFramework;

/**
 * 全局轻提示 Toast：任何界面阶段（含设定台）都可见，解决"点了没反应"
 */
window.showToast = function (text, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    // 入场动画
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 2600);
};
