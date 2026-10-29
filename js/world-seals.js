/**
 * 界专属成就 WorldSeals（v3.16.0）—— 每界一套检定规则，解锁即入 GameLayer 印章册
 * ---------------------------------------------------------------------------
 * 与通用成就（战报/宝物/传书/境界梯）互补：界成就吃「剧情变量」——
 * 全职法师的元素圣徽、龙族的血统评级、帝霸的命宫、斗破的异火、道诡的心素……
 * 检定签名 test(vars, immState)：vars = (variable_update) 落表后的剧情变量。
 *
 * 接线：monkey-patch GameLayer.onGenre——换界/换世界线时自动重注册本界成就；
 *       检定由 GameLayer.onVars 每轮驱动（story-framework.updateStatusPanel 调用）。
 * 防撞：成就 id 统一加界前缀（qzf_ / long_ …），与通用 14 枚永不冲突。
 */
(function () {
    'use strict';

    /* ==================== 优化 v3.47.5-opt：序列化缓存 ==================== */
    /* 原代码每个成就 test 都 JSON.stringify(v)，上百个 seal 每轮重复整树序列化(O(seal数×状态大小))。
       这里按对象引用缓存：同一 vars 对象在一次检定内只序列化一次。 */
    let _ms_obj = null, _ms_str = '';
    const MoSeals_flat = (v) => {
        if (_ms_obj !== v) { _ms_obj = v; _ms_str = JSON.stringify(v); }
        return _ms_str;
    };

    /* ==================== 工具：从 vars 里捞字段 ==================== */
    /** 境界/等阶原文（各界字段名不同，逐个兜底） */
    const realmOf = (v) => String(v.cultivation || v.realm || v.ranking || v.境界 || v.等阶 || v.法师等阶 || v.rank || v.level || v.修为 || v.血统评级 || '');
    /** 玩家角色卡（18 字段） */
    const pc = (v) => {
        const cs = v.characters || {};
        for (const [k, c] of Object.entries(cs)) {
            if (c && (c.isPlayer || k === (v.playerName || ''))) return c || {};
        }
        return {};
    };
    /** NPC 角色卡数组 */
    const npcs = (v) => Object.entries(v.characters || {})
        .filter(([k, c]) => c && !c.isPlayer && k !== (v.playerName || ''))
        .map(([k, c]) => ({ name: k, ...c }));
    /** 数值仪表盘 */
    const g = (v, ...keys) => {
        const d = v.dashboard || v.gauges || {};
        for (const k of keys) if (d[k] != null) return Number(d[k]) || 0;
        for (const k of keys) if (v[k] != null) return Number(v[k]) || 0;
        return null;
    };

    /* ==================== 十五界成就定义 ==================== */
    const SEALS = {

        /* ---------- 全职法师：星辉与元素 ---------- */
        quanzhifashi: [
            { id: 'qzf_awaken', icon: '✨', name: '元素觉醒', desc: '第一次在测试台上亮起元素之光', test: (v) => realmOf(v).includes('初级') || (pc(v).realm || '').includes('初级') },
            { id: 'qzf_dual', icon: '🌠', name: '双系觉醒者', desc: '同时觉醒两系元素——百年难遇的妖孽天赋', test: (v) => { const el = pc(v).elements || v.elements || pc(v).已觉醒元素 || []; return Array.isArray(el) ? el.length >= 2 : String(el).split(/[、,，\s]+/).filter(Boolean).length >= 2; } },
            { id: 'qzf_forbid', icon: '🌀', name: '禁咒之阶', desc: '踏入禁咒法师的等阶', test: (v) => realmOf(v).includes('禁咒') || (pc(v).realm || pc(v).status || '').includes('禁咒') },
            { id: 'qzf_hunt', icon: '🗡', name: '荒野首猎', desc: '结界之外完成第一次魔物狩猎', test: (v) => { const h = (v.history || v.大事记 || []); return (Array.isArray(h) ? h.join('') : String(h)).match(/猎|击杀|讨伐/); } },
            { id: 'qzf_dark', icon: '🌑', name: '暗面交锋', desc: '与黑教廷的阴影正面相撞', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.includes('黑教廷'); } },
            { id: 'qzf_star', icon: '⚡', name: '星辉不熄', desc: '星辉充沛长期维持在 60 以上', test: (v) => (g(v, '星辉充沛', 'star') || 0) >= 60 }
        ],

        /* ---------- 龙族：血统与言灵 ---------- */
        longzu: [
            { id: 'long_awaken', icon: '🐉', name: '血统苏醒', desc: '混血种的血统第一次 rating 评测出级', test: (v) => /[BC]级|A级|S级/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).血统评级 || '')) },
            { id: 'long_s', icon: '👑', name: 'S级血统', desc: '血统评级触及 S 级——王之血脉', test: (v) => /S级/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).血统评级 || '')) },
            { id: 'long_word', icon: '🗣', name: '言灵初鸣', desc: '习得第一则言灵', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/言灵[：:]?\s*[^"',，。]{0,12}(青铜|风王|镰鼬|皇帝|镇魂|杀戮)/) },
            { id: 'long_cassell', icon: '🎓', name: '卡塞尔人', desc: '踏入卡塞尔学院的校门', test: (v) => MoSeals_flat(v).slice(0, 4000).includes('卡塞尔') },
            { id: 'long_king', icon: '🌊', name: '直面龙王', desc: '与沉睡之王的意志正面相对', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/龙王|尼德霍格|君焰/) },
            { id: 'long_exec', icon: '⚔', name: '执行部在册', desc: '以执行部成员身份接下第一单', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/执行部|狮子会/) }
        ],

        /* ---------- 帝霸：命宫与帝路 ---------- */
        dibao: [
            { id: 'db_palace', icon: '⛩', name: '命宫初开', desc: '第一重命宫在识海亮起', test: (v) => /命宫/.test(realmOf(v) + (pc(v).realm || '')) && !/凡体/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'db_true', icon: '💎', name: '叩问真命', desc: '真命现世——命宫深处的那一点光', test: (v) => /真命/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'db_artifact', icon: '🔱', name: '帝兵认主', desc: '一件万古帝兵承认了你的持有', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/帝兵.*(认主|认|入手|持有)/) },
            { id: 'db_forbid', icon: '🌫', name: '禁区来客', desc: '活着从一处禁区带回了东西', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/禁区/) },
            { id: 'db_road', icon: '🛤', name: '踏上帝路', desc: '在帝路争渡中留下自己的名字', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/帝路|争渡/) },
            { id: 'db_ancient', icon: '📖', name: '万古知音', desc: '识破一局万古棋的残局', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/万古|棋局|残局/) }
        ],

        /* ---------- 道诡异仙：心素与真假 ---------- */
        daoguiyixian: [
            { id: 'dgy_heart', icon: '🕯', name: '心素微光', desc: '在真假莫辨的世界里守住一点心素', test: (v) => MoSeals_flat(v).slice(0, 4000).includes('心素') },
            { id: 'dgy_sane', icon: '🧠', name: '神志清明', desc: '理智值长期稳在 60 以上', test: (v) => (g(v, 'sanity', '理智') || 0) >= 60 },
            { id: 'dgy_cross', icon: '🌀', name: '两界穿行', desc: '在疯人院与清风观之间活着走了一个来回', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.includes('白塔医院') && t.includes('清风观'); } },
            { id: 'dgy_dan', icon: '⚗️', name: '丹成入口', desc: '亲手炼成一炉丹', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/炼丹|丹成|成丹/) },
            { id: 'dgy_eyes', icon: '👁', name: '腊月十八', desc: '那个找眼睛的存在注意到了你', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/腊月十八|无生老母/) },
            { id: 'dgy_survive', icon: '🩸', name: '疯癫边缘', desc: '在理智触底的回合活了下来', test: (v, s) => { const tens = (s && s.tensions) || []; return tens.some(t => Number(t.v) >= 90); } }
        ],

        /* ---------- 重生之都市修仙 ---------- */
        zhongshengdushi: [
            { id: 'zss_rebirth', icon: '⏳', name: '百年一梦', desc: '仙尊的记忆与十七岁的身体合而为一', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/重生|仙尊|重回|百年/) },
            { id: 'zss_foundation', icon: '🏗', name: '筑基功成', desc: '灵气枯竭的年代里筑起道基', test: (v) => /筑基/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'zss_core', icon: '🌟', name: '金丹凝成', desc: '都市上空凝出一枚金丹', test: (v) => /金丹/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'zss_thunder', icon: '⚡', name: '渡劫之人', desc: '在霓虹灯下渡过一场天劫', test: (v) => /渡劫|雷劫/.test(realmOf(v) + (pc(v).realm || '') + MoSeals_flat(v).slice(0, 3000)) },
            { id: 'zss_protect', icon: '🛡', name: '护道之心', desc: '为身边人挡下一次必死之局', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/护住|挡下|救下|护道/) },
            { id: 'zss_lowkey', icon: '🎭', name: '扮猪吃虎', desc: '隐藏修为骗过所有窥探', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.includes('隐藏') || t.includes('扮猪') || t.includes('低调'); } }
        ],

        /* ---------- 吞噬星空 ---------- */
        swallowedstar: [
            { id: 'ss_warrior', icon: '👊', name: '武者入门', desc: '拳力突破武者考核线', test: (v) => /武者/.test(realmOf(v) + (pc(v).realm || '')) && !/学徒/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'ss_psychic', icon: '🧿', name: '精神念师', desc: '觉醒念力——脑域开出第二片海', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/精神念师|念力/) },
            { id: 'ss_beast', icon: '🐗', name: '兽潮余生', desc: '在兽潮的警报声里活到天亮', test: (v, s) => { const tens = (s && s.tensions) || []; return tens.some(t => Number(t.v) >= 85) && MoSeals_flat(v).slice(0, 3000).match(/兽潮|怪兽/); } },
            { id: 'ss_camp', icon: '🏕', name: '极限营员', desc: '踏入极限武馆训练营', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/训练营|极限武馆/) },
            { id: 'ss_star', icon: '🚀', name: '离地千丈', desc: '第一次离开基地市进入荒野深处', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/荒野|野外|废墟/) },
            { id: 'ss_planet', icon: '🌌', name: '星海之志', desc: '听闻或望见了星空的辽阔', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/星际|宇宙|飞船/) }
        ],

        /* ---------- 遮天 ---------- */
        shrouding: [
            { id: 'std_sea', icon: '🌊', name: '苦海行舟', desc: '在苦海中凝出第一缕神识', test: (v) => /苦海/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'std_dao', icon: '📜', name: '道宫藏神', desc: '迈入道宫之境', test: (v) => /道宫/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'std_holy', icon: '💫', name: '圣体初醒', desc: '荒古圣体的血在燃烧', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/圣体|荒古/) },
            { id: 'std_scripture', icon: '📖', name: '道经在手', desc: '得授一部道经', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/道经|经卷|古经/) },
            { id: 'std_forbid', icon: '⛰', name: '生命禁区', desc: '踏足七大人命禁区之一', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/生命禁区|禁区/) },
            { id: 'std_immortal', icon: '🕊', name: '仙路将开', desc: '望见成仙路的尽头', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/成仙路|仙路/) }
        ],

        /* ---------- 全职高手 ---------- */
        quanzhigaoshou: [
            { id: 'qzg_class', icon: '🎮', name: '职业认证', desc: '选定职业并打出第一场正式对局', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/职业|对局|比赛/) },
            { id: 'qzg_apm', icon: '⌨', name: '手速爆发', desc: 'APM 冲上 300 大关', test: (v) => (g(v, 'apm', '手速') || 0) >= 300 },
            { id: 'qzg_umbrella', icon: '☂', name: '千机多变', desc: '自制武器完成一次形态切换', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/千机伞|自制武器|银武/) },
            { id: 'qzg_comeback', icon: '🔥', name: '龙抬头', desc: '在落后局面完成翻盘', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/翻盘|逆转|反超/) },
            { id: 'qzg_guild', icon: '🚩', name: '建队之始', desc: '拥有了自己的战队或固定队', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/战队|公会/) },
            { id: 'qzg_final', icon: '🏆', name: '巅峰之战', desc: '站上总决赛的舞台', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/总决赛|决赛/) }
        ],

        /* ---------- 斗破苍穹 ---------- */
        doupocangqiong: [
            { id: 'dpc_fighter', icon: '🔥', name: '斗者之路', desc: '从斗之气迈入斗者之境', test: (v) => /斗者/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'dpc_fire', icon: '🌋', name: '异火加身', desc: '收服或炼化一缕异火', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/异火/) },
            { id: 'dpc_pill', icon: '⚗️', name: '丹成药香', desc: '炼出一炉像样的丹药', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/炼丹|丹成|成丹/) },
            { id: 'dpc_wing', icon: '🪽', name: '斗气化翼', desc: '斗气凝翼，翱翔九天', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/斗气化翼|化翼/) },
            { id: 'dpc_oath', icon: '⚔', name: '三年之约', desc: '赴一场改变命运的约战', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/三年之约|约战/) },
            { id: 'dpc_emperor', icon: '👑', name: '斗帝之路', desc: '触摸到斗帝的门槛', test: (v) => /斗圣|斗帝/.test(realmOf(v) + (pc(v).realm || '')) }
        ],

        /* ---------- 完美世界 ---------- */
        wanmeishijie: [
            { id: 'wms_bone', icon: '🦴', name: '骨文初悟', desc: '在血脉深处读出第一个骨文', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/骨文/) },
            { id: 'wms_beast', icon: '🐗', name: '太古凶兽', desc: '与太古凶兽正面遭遇并活着离开', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/凶兽|太古凶兽/) },
            { id: 'wms_sky', icon: '🪜', name: '登天之路', desc: '踏上白骨铺就的登天路', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/登天路|登天/) },
            { id: 'wms_sacrifice', icon: '🕯', name: '祭灵低语', desc: '听见祭灵的低语', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/祭灵/) },
            { id: 'wms_clan', icon: '🏛', name: '仙古遗民', desc: '与仙古遗族的后人相遇', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/仙古|遗族/) },
            { id: 'wms_grass', icon: '🌿', name: '一草斩月', desc: '一粒尘可填海，一根草可斩日月', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/斩日月|填海|草叶|青草/) }
        ],

        /* ---------- 斗罗大陆 ---------- */
        douluodalu: [
            { id: 'dld_soul', icon: '💠', name: '武魂觉醒', desc: '六岁那年的武魂觉醒仪式上亮起了光', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/武魂/) },
            { id: 'dld_ring', icon: '⭕', name: '第一魂环', desc: '猎杀魂兽吸收第一枚魂环', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/魂环/) },
            { id: 'dld_twin', icon: '✨', name: '双生武魂', desc: '第二武魂觉醒——万中无一', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/双生武魂|双武魂/) },
            { id: 'dld_title', icon: '🏅', name: '封号之路', desc: '获得属于自己的封号', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/封号/) },
            { id: 'dld_sea', icon: '🌊', name: '海神九考', desc: '接受海神的考验', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/海神|九考/) },
            { id: 'dld_monster', icon: '👹', name: '怪物学院', desc: '成为史莱克的一员', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/史莱克/) }
        ],

        /* ---------- 黎明之剑：魔导革命 ---------- */
        limingzhijian: [
            { id: 'lmz_awaken', icon: '✨', name: '魔力觉醒', desc: '觉醒魔力亲和，正式踏入法师之门', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/魔力亲和|法师之门|觉醒魔力/) || /学徒|[一二三四五六七八九]级法师|传奇法师/.test(realmOf(v) + (pc(v).realm || '')); } },
            { id: 'lmz_artisan', icon: '⚙', name: '工坊学徒', desc: '在魔导工坊里掌握第一门魔导手艺', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/魔导工坊|符文识读|机械装配|魔导技术|工坊学徒/); } },
            { id: 'lmz_rank5', icon: '📜', name: '高阶法师', desc: '法师等阶晋升五级——足以开宗授徒的层次', test: (v) => /[五六七八九]级法师|传奇法师/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'lmz_legend', icon: '🌅', name: '传奇之阶', desc: '立于等阶之巅——足以影响一国战略格局', test: (v) => /传奇法师|传奇/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'lmz_gondor', icon: '🏛', name: '废土来客', desc: '活着从废土带回旧纪元的遗产线索', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/废土.*(遗产|归来|带回)|刚铎|旧纪元/) },
            { id: 'lmz_industry', icon: '🏭', name: '时代功业', desc: '参与一项改变领地面貌的魔导工程', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/魔能列车|通车|投产|开学|魔能灯|印刷机|工坊.*(扩产|建成)/) }
        ],

        /* ---------- 轮回乐园：无限轮回 ---------- */
        lunhuileyuan: [
            { id: 'lhl_contract', icon: '⟳', name: '契约成立', desc: '与轮回乐园缔结契约，成为契约者', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/契约(成立|生效)|适格者|轮回乐园/); } },
            { id: 'lhl_first', icon: '⚔', name: '首单生还', desc: '完成第一个衍生世界任务并活着回来', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/任务(完成|结算)|首个任务|第一单.*完成|生还/); } },
            { id: 'lhl_tier3', icon: '🏅', name: '三阶之证', desc: '阶位晋升三阶——脱离新人耗材预备役', test: (v) => /[三四五六七八九十]阶|绝强者|至强者/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).阶位 || '')) },
            { id: 'lhl_epic', icon: '💎', name: '史诗入手', desc: '获得一件金色以上的高品质装备', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/(金色|淡金色|传说级|史诗级|圣灵级)品质|传说级「|史诗级「/) },
            { id: 'lhl_hunter', icon: '🔪', name: '猎杀阴影', desc: '遭遇猎杀者并活着回来', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/猎杀者|被盯上|悬赏.*自己/) && !/玩家名.*死亡/.test(t); } },
            { id: 'lhl_paradise', icon: '🌌', name: '绝强之壁', desc: '属性总和触及 300 点壁障', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/300(点)?(属性)?壁障|绝强者|至强者/) || ((g(v, '力量') || 0) + (g(v, '敏捷') || 0) + (g(v, '体力') || 0) + (g(v, '智力') || 0)) >= 300; } }
        ],

        /* ---------- 武炼巅峰：武道长征 ---------- */
        wulianfengdian: [
            { id: 'wlf_entry', icon: '⚔', name: '踏入武门', desc: '从凡俗之身淬体入门，正式踏上武道', test: (v) => /淬体境|开元境|气动境|离合境|真元境|神游境/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'wlf_letter', icon: '📜', name: '战书已递', desc: '递出人生第一封战书——胜负各安天命', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/战书|递战|挑战.*(演武|台)/) },
            { id: 'wlf_kaiyuan', icon: '🜂', name: '元气初开', desc: '破入开元境——真正具备属于自己的元气', test: (v) => /开元境|气动境|离合境|真元境|神游境|超凡境|入圣境/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'wlf_arts', icon: '📖', name: '功法入手', desc: '得一部玄阶以上的功法传承', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/(玄|地|天)阶(功法|武技|身法|残卷)/) },
            { id: 'wlf_stones', icon: '◈', name: '千石之资', desc: '行囊里的灵石攒过一千', test: (v) => { const n = Number(String(JSON.stringify(v).match(/灵石[：:]?\s*(\d{1,9})/) || [])[1] || 0); return n >= 1000 || /灵石.*(千|万)/.test(MoSeals_flat(v).slice(0, 4000)); } },
            { id: 'wlf_stain', icon: '🩸', name: '越阶而战', desc: '以弱胜强，越阶赢下一场生死之斗', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/越阶.*(胜|反杀|险胜)|以弱胜强|以下克上/) },
            { id: 'wlf_transcend', icon: '🏔', name: '超凡入圣', desc: '境界攀升至超凡以上——一方之望', test: (v) => /超凡境|入圣境|圣王境|返虚境|虚王境|道源境|帝尊境|开天境/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) }
        ],

        /* ---------- 圣墟：复苏进化 ---------- */
        shengxu: [
            { id: 'sx_awaken', icon: '🜂', name: '觉醒之光', desc: '唤醒体内沉睡的神秘因子，踏入进化之门', test: (v) => /觉醒境|枷锁境|逍遥境|观想境|餐霞境|塑形境|金身境|亚圣境|圣者境|映照|神照|神祇/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'sx_breath', icon: '🌬', name: '呼吸传承', desc: '得到一部呼吸法——进化的门槛已在脚下', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/呼吸法|吐纳法/) },
            { id: 'sx_lock', icon: '⛓', name: '挣断枷锁', desc: '挣断第一道枷锁——脱层皮，醒一种神通', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/挣断第?[一二三四五六七八九十]+道|枷锁境/) },
            { id: 'sx_fruit', icon: '🍇', name: '异果入口', desc: '服食异果，体质悄然改变', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/异果.*(服食|入口|吞服|吃)|服食异果/) },
            { id: 'sx_relic', icon: '🏛', name: '遗迹归来', desc: '从上古遗迹活着出来——不是空手，就是带伤', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/遗迹|秘境.*(归来|生还|探)/) },
            { id: 'sx_free', icon: '🦋', name: '逍遥世间', desc: '挣断枷锁入逍遥境——小妖初成', test: (v) => /逍遥境|观想境|餐霞境|塑形境|金身境|亚圣境|圣者境|映照|神照|神祇/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) }
        ],

        /* ---------- 神秘复苏：厉鬼复苏 ---------- */
        shenmifusu: [
            { id: 'smfs_first', icon: '🕯', name: '初次直面', desc: '第一次直面厉鬼并活着回来——活下来就是本钱', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/厉鬼|鬼物/) && !/玩家名.*死亡/.test(t); } },
            { id: 'smfs_seal_c', icon: '⛓', name: '禁锢入门', desc: '获得第一个禁锢——以命为契，与鬼共舞', test: (v) => /C级禁锢|[CSAB]级禁锢/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'smfs_gold', icon: '◈', name: '百金之资', desc: '身家黄金攒过一百克——克数就是命', test: (v) => { const m = String(JSON.stringify(v).match(/黄金[：:]?\s*(\d{1,7})/) || [])[1] || 0; return Number(m) >= 100 || /黄金.*(百|千|万)克/.test(MoSeals_flat(v).slice(0, 4000)); } },
            { id: 'smfs_rule', icon: '🔍', name: '规律在手', desc: '剥清一只厉鬼的杀人规律——档案柜里第一页', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/(规律|杀人规律).{0,20}(剥|破|查|清|明)|灵异档案/) },
            { id: 'smfs_seal_b', icon: '🔒', name: 'B级禁锢', desc: '禁锢跨过B级——生机与寿数都在账上', test: (v) => /[BS]级禁锢/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'smfs_domain', icon: '🌫', name: '鬼域生还', desc: '从鬼域里活着出来——路灯还亮着，你也是', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/鬼域.{0,30}(逃|出|生还|撤离)/) },
            { id: 'smfs_seal_s', icon: '👁', name: 'S级禁锢', desc: 'S级禁锢——感官或肢体，总得留下点什么', test: (v) => /S级禁锢/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) }
        ],

        /* ---------- 开局地摊卖大力：夜市烟火 ---------- */
        ditandali: [
            { id: 'dtdl_open', icon: '🏮', name: '开张首日', desc: '摊位第一次开张——灯亮了，就算入行', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/开张|出摊|摆摊|开市/) },
            { id: 'dtdl_system', icon: '💢', name: '系统激活', desc: '破地摊布醒了——怨气值开始入账', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/最强地摊系统|地摊系统|怨气值/) },
            { id: 'dtdl_dali', icon: '💪', name: '大力神水', desc: '第一瓶大力药水出手——十倍身体素质与秃顶齐飞', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/大力药水|大力水/) },
            { id: 'dtdl_rank', icon: '🏮', name: '灵武入门', desc: '踏入黑铁等阶——正式摸到时代的门槛', test: (v) => /黑铁|青铜|白银|黄金|铂金|钻石|星耀|道天/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'dtdl_resent', icon: '💢', name: '怨气冲天', desc: '怨气值攒过 80——十连抽的燃料够了', test: (v) => (g(v, '怨气值', '怨气', 'resentment') || 0) >= 80 },
            { id: 'dtdl_fame', icon: '⭐', name: '夜市名摊', desc: '人气值过 70——货越神，盯着的人越多', test: (v) => (g(v, '人气', 'popularity') || 0) >= 70 }
        ],

        /* ---------- 凡人修仙传：凡人仙路 ---------- */
        fanrenxiuxian: [
            { id: 'frx_qixuan', icon: '☯', name: '踏入仙途', desc: '引气入体，迈过仙凡之隔的第一道坎', test: (v) => /炼气|筑基|结丹|元婴|化神|炼虚|合体|大乘|渡劫|真仙|金仙|太乙|大罗/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'frx_linggen', icon: '🌱', name: '灵根入册', desc: '测灵台上验明灵根——资质的秤，压着前半生', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/灵根|测灵/) },
            { id: 'frx_fangshi', icon: '🏮', name: '坊市首航', desc: '第一次踏进修士坊市——一半的机缘从坊市来', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/坊市/) },
            { id: 'frx_dudai', icon: '👝', name: '储物袋在身', desc: '有了自己的储物袋——修士身份的第一标志', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/储物袋/) },
            { id: 'frx_dan', icon: '⚗️', name: '丹成入口', desc: '亲手炼成一炉丹，或服下一枚改命的丹药', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/炼丹|丹成|成丹|筑基丹/) },
            { id: 'frx_zhuji', icon: '🧱', name: '筑基功成', desc: '筑起道基——凡人与修士的分水岭', test: (v) => /筑基|结丹|元婴|化神|炼虚|合体|大乘|渡劫|真仙|金仙|太乙|大罗/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'frx_yuejie', icon: '⚔', name: '越阶搏杀', desc: '以弱胜强，越阶赢下一场生死之斗——底牌与算计的胜利', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/越阶.*(胜|反杀|险胜)|以下克上|以弱胜强/) },
            { id: 'frx_yuanying', icon: '👶', name: '元婴巨擘', desc: '碎丹成婴——人界一方巨擘的门槛', test: (v) => /元婴|化神|炼虚|合体|大乘|渡劫|真仙|金仙|太乙|大罗/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) }
        ],

        /* ---------- 仙逆：逆道四步 ---------- */
        xianni: [
            { id: 'xn_menqiang', icon: '✵', name: '踏入道途', desc: '凝气入门——从凡尘蝼蚁迈上逆天之路', test: (v) => /凝气|筑基|结丹|元婴|化神|婴变|问鼎|阴虚|阳实|窥涅|净涅|碎涅|空劫|踏天/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'xn_celing', icon: '⚖', name: '测灵之秤', desc: '测灵台前验明资质——冷眼与标签，是凡人的第一道秤', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/测灵|灵根资质|资质平庸|杂灵根/) },
            { id: 'xn_xueqiu', icon: '🩸', name: '血仇刻心', desc: '血债入骨——复仇的火种自此不灭', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/血仇|灭门|血债|复仇/) },
            { id: 'xn_zhuji', icon: '🧱', name: '筑基登梯', desc: '筑基功成——平庸资质硬生生熬出来的第一步', test: (v) => /筑基|结丹|元婴|化神|婴变|问鼎|阴虚|阳实|窥涅|净涅|碎涅|空劫|踏天/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'xn_xinmo', icon: '☾', name: '心魔劫渡', desc: '执念化作心相的关口——一念之差即是道心崩毁', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return t.match(/心魔/) && t.match(/渡|历|破|劫/); } },
            { id: 'xn_gushi', icon: '🗿', name: '古神造化', desc: '历古神一脉的传承洗礼——肉身成圣的另一条路', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/古神|肉身成圣/) },
            { id: 'xn_tanian', icon: '🪜', name: '踏天之路', desc: '涅槃空劫之上，望见四步之路的尽头', test: (v) => /窥涅|净涅|碎涅|空劫|踏天/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) }
        ],

        /* ---------- 地球开放世界：凡人一生 ---------- */
        earth: [
            { id: 'ea_root', icon: '🏠', name: '安身立命', desc: '境遇爬到安身立命——从初来乍到站稳了脚跟', test: (v) => /安身立命|小有积蓄|成家立业|家业渐兴|一方乡望|功成名就|颐养天年/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'ea_savings', icon: '💰', name: '略有积蓄', desc: '账上攒下第一笔钱——过日子的底气', test: (v) => /小有积蓄|成家立业|家业渐兴|一方乡望|功成名就|颐养天年/.test(realmOf(v) + (pc(v).realm || '')) || (g(v, 'savings', '积蓄') || 0) > 0 || MoSeals_flat(v).slice(0, 4000).match(/积蓄[：:]?\s*[1-9]/) },
            { id: 'ea_faraway', icon: '🧭', name: '远行之人', desc: '离开熟悉的地方，去远方讨生活', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/远行|异乡|他乡|漂泊|车票|船票|移民|闯荡/) },
            { id: 'ea_figure', icon: '📜', name: '青史一面', desc: '与史册上真实存在的人物打过照面', test: (v) => npcs(v).some(n => n && (n.isCanon || /史实人物/.test(String(n.note || '')))) },
            { id: 'ea_family', icon: '🏮', name: '成家立业', desc: '境遇抵达成家立业——日子过出了模样', test: (v) => /成家立业|家业渐兴|一方乡望|功成名就|颐养天年/.test(realmOf(v) + (pc(v).realm || '')) },
            { id: 'ea_twilight', icon: '🌅', name: '无憾此生', desc: '功成名就或颐养天年——一生走到收成的时候', test: (v) => /功成名就|颐养天年/.test(realmOf(v) + (pc(v).realm || '')) }
        ],

        /* ---------- 全球冰封：囤货与寒冬 ---------- */
        quanqiubingfeng: [
            { id: 'qqbf_rebirth', icon: '⏳', name: '重生先知', desc: '带着末世十年的记忆睁眼——距全球冰封还有三十天', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/重生|上一世|前世|倒计时/) },
            { id: 'qqbf_awaken', icon: '🌀', name: '虚空初醒', desc: '识海深处睁开那片黑暗虚空——空间异能·初醒', test: (v) => /空间异能|识海|虚空/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'qqbf_hoard', icon: '📦', name: '囤货达人', desc: '空间里的物资堆出量级——散尽家财换回来的命', test: (v) => (g(v, 'supplies', '物资储备') || 0) >= 60 || MoSeals_flat(v).slice(0, 4000).match(/囤积|囤货|物资.*(吨|充裕|充足)|(百方|千方|万方)/) },
            { id: 'qqbf_safehouse', icon: '🏠', name: '安全屋建造师', desc: '翡翠湾的家升级成末日堡垒——门后是另一个文明', test: (v) => /末日堡垒|超级安全屋|末日方舟/.test((pc(v).安全屋等级 || '') + MoSeals_flat(v).slice(0, 4000)) },
            { id: 'qqbf_freeze', icon: '❄', name: '寒潮降临', desc: '亲历灾变第一日——雪落下来，旧世界当场谢幕', test: (v) => { const t = MoSeals_flat(v).slice(0, 4000); return (g(v, 'cold', '寒潮烈度') || 0) >= 40 || t.match(/寒潮.*(降临|爆发)|全球冰封|灾变/); } },
            { id: 'qqbf_deepcold', icon: '🥶', name: '深寒幸存者', desc: '在-40℃以下的死城里活过一个冬天', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/-4[0-9]℃|-5[0-9]℃|-6[0-9]℃|-7[0-9]℃|-8[0-9]℃|深寒|极寒/) },
            { id: 'qqbf_revenge', icon: '⚔', name: '清算之刃', desc: '向前世的仇人递出第一刀——黑化复仇的账翻开了', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/清算|复仇|报仇|血债|仇人.*(死|倒|跪|伏)/) },
            { id: 'qqbf_newstar', icon: '🌍', name: '新蓝星之主', desc: '空间进化至新蓝星的尺度——文明在识海里重开一局', test: (v) => /新蓝星/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).空间容量 || '') + MoSeals_flat(v).slice(0, 3000)) }
        ],

        /* ---------- 超神学院：诸神时代的军礼 ---------- */
        chaoshenxueyuan: [
            { id: 'csxy_enlist', icon: '🎖', name: '入伍报到', desc: '穿上军装领到枪——成为地球防线上的一个兵', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/入伍|参军|军籍|新兵|雄兵连.*(入列|报到|一员)|地球防卫军.*(入列|报到)/) },
            { id: 'csxy_gene1', icon: '🧬', name: '基因初醒', desc: '超级基因第一次觉醒——一代战士，枪弹难伤', test: (v) => /一代|基因.*(觉醒|初醒)|超级基因/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).基因觉醒 || '')) },
            { id: 'csxy_gene2', icon: '⚡', name: '二代之力', desc: '觉醒特殊能力——速度、力量或射术超出凡人上限', test: (v) => /二代/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).基因觉醒 || '')) },
            { id: 'csxy_taotie', icon: '👾', name: '首战饕餮', desc: '与饕餮舰队的第一场血战——活着回到防线就算赢', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/饕餮.*(战|袭|降临|交火)|与.{0,6}饕餮.{0,8}(战|斗)/) },
            { id: 'csxy_angel', icon: '👼', name: '天使契约', desc: '一位天使主动与你缔结守护契约——圣光认下了你', test: (v) => /契约/.test(pc(v).守护天使 || '') || MoSeals_flat(v).slice(0, 4000).match(/守护天使.{0,12}契约|天使.{0,8}缔结|契约.{0,10}(炽心|炙心|凯莎|鹤熙|彦|天使)/) },
            { id: 'csxy_rearguard', icon: '🛡', name: '断后者', desc: '一句「我断后」——军礼的最高形式，袍泽都记着', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/断后|掩护(撤离|撤退|平民)|殿后|我(来|去)断/) },
            { id: 'csxy_gene3', icon: '✨', name: '神体之路', desc: '触摸三代神体的门槛——凡人的尽头是神', test: (v) => /三代|准神|神体/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).基因觉醒 || '')) },
            { id: 'csxy_hero', icon: '🏅', name: '文明脊梁', desc: '战功与军衔攒到地球给你记功的程度——你是英雄', test: (v) => (g(v, 'war', '战功') || 0) >= 800 || MoSeals_flat(v).slice(0, 4000).match(/战功.*(千|英雄|功勋卓著)|英雄.*(称号|勋章)|一等功/) }
        ],

        /* ---------- 斩神：守夜人的军礼 ---------- */
        zhanhen: [
            { id: 'zh_enlist', icon: '🌙', name: '守夜入伍', desc: '通过考核领到值夜装备——成为暗夜战线上的一名守夜人', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/守夜人.*(入队|入伍|报到|编制|一员)|通过.*(考核|入队)/) },
            { id: 'zh_awaken', icon: '🌀', name: '精神初醒', desc: '精神力踏入盏境——十米之内，世界换了一副面孔', test: (v) => /盏境|精神力.*(觉醒|初醒)/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).精神力境界 || '') + (pc(v).status || '')) },
            { id: 'zh_ruin', icon: '⚡', name: '禁墟觉醒', desc: '迷雾在你身上留下了礼物——超凡的根扎下了', test: (v) => /禁墟/.test(pc(v).禁墟 || '') || MoSeals_flat(v).slice(0, 4000).match(/禁墟.*(觉醒|能力|苏醒)|觉醒.{0,6}禁墟/) },
            { id: 'zh_mist', icon: '🌫', name: '初探雾区', desc: '第一次踏进迷雾禁区——活着回来才算数', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/迷雾禁区.*(进入|探索|踏入)|雾区.*(任务|巡逻|进入)/) },
            { id: 'zh_god', icon: '✨', name: '诸神结缘', desc: '与阳光精神病院的一位"病人"结下羁绊——神明记住了你', test: (v) => (Array.isArray(pc(v).神明羁绊) && pc(v).神明羁绊.length) || MoSeals_flat(v).slice(0, 4000).match(/结缘|羁绊.{0,10}(尼克斯|梅林|孙悟空|吉尔伽美什|耶兰得|神明)|病院.*(结缘|信任)/) },
            { id: 'zh_rearguard', icon: '🛡', name: '断后者', desc: '一句「我断后」——守夜人军礼的最高形式，袍泽都记着', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/断后|殿后|掩护(撤离|撤退|平民)|我(来|去)断/) },
            { id: 'zh_bloodmoon', icon: '🌕', name: '血月之夜', desc: '在血月升起的长夜活了下来——大夏最凶险的至暗时刻', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/血月/) },
            { id: 'zh_klein', icon: '♾', name: '克莱因之境', desc: '精神力取之不尽用之不竭——凡人的尽头，维度的彼岸', test: (v) => /克莱因/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).精神力境界 || '') + (pc(v).status || '')) }
        ],

        /* ---------- v3.47.2 剑来：山水问心 ---------- */
        jianlai: [
            { id: 'jl_lizhu', icon: '🏮', name: '骊珠初临', desc: '踏进骊珠洞天的小镇——天下的故事从这条街开始', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/骊珠洞天|泥瓶巷|小镇.{0,6}(初|来|到)/) },
            { id: 'jl_wenxin', icon: '📖', name: '读书种子', desc: '在圣人脚下听过一次课——道理进了心，就再也出不去了', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/山崖书院|文圣|听讲|读书.{0,6}(入门|开蒙)|道理.{0,8}心/) },
            { id: 'jl_dengtui', icon: '🪜', name: '修行登梯', desc: '练气士开脉登境，或武夫打熬出第一境——路虽远，行则将至', test: (v) => /洞府|观海|龙门|金丹|元婴|玉璞|仙人|飞升|泥胚|木胎|水银|英魄|金身|羽化|山巅/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).境界 || '') + (pc(v).status || '')) },
            { id: 'jl_changqiao', icon: '🗡', name: '远赴剑城', desc: '亲眼望见剑气长城——托月山下，剑修的家国', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/剑气长城|倒悬山|蛮荒天下.{0,6}(战|前线)/) },
            { id: 'jl_luopo', icon: '🏔', name: '落魄山一员', desc: '在落魄山有了名分——山不在高，人心齐了就高', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/落魄山.{0,10}(一员|弟子|供奉|山主|客卿|护山|记名)|加入落魄山/) },
            { id: 'jl_wenqie', icon: '⚖', name: '问心无愧', desc: '在两难关头选了难走的那条路——心事无亏，天地共鉴', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/问心无愧|良心|两难|取舍|扪心自问/) },
            { id: 'jl_yuanyou', icon: '🧭', name: '游历天下', desc: '离开家乡的洲，去看更远的山水——读万卷书，行万里路', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/游历|远游|出洲|宝瓶洲之外|渡船|跨洲/) },
            { id: 'jl_feisheng', icon: '☁', name: '登仙之路', desc: '修行抵达飞升之境——十四境之上，天门可期', test: (v) => /飞升|仙人境|十四境/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).境界 || '') + (pc(v).status || '')) }
        ],

        /* ---------- v3.47.2 诡秘之主：序列之梯 ---------- */
        guimi: [
            { id: 'gm_huiwu', icon: '🌫', name: '灰雾初临', desc: '意识坠入那片灰雾——命运的齿轮自此转动', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/灰雾之上|灰雾.{0,6}(降临|初临|进入)/) },
            { id: 'gm_xulie9', icon: '🧪', name: '魔药入喉', desc: '喝下第一瓶魔药成为序列 9——非凡与非人的界河跨过了', test: (v) => /序列\s*(9|九)|占卜家|学徒|小丑|通灵者|秘偶师/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).序列 || '') + (pc(v).status || '')) },
            { id: 'gm_yanshui', icon: '🔮', name: '演绎初成', desc: '第一次用演绎法推出真相——非凡者的脑子，比武器值钱', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/演绎法|推理.{0,6}(出|成|清)|占卜.{0,8}(成功|灵摆)/) },
            { id: 'gm_zhiye', icon: '🕯', name: '组织在册', desc: '值夜者、代行者或某位先生的在册身份——有了靠山，也有了枷锁', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/值夜者|代行者|心理炼金会|在册|正式成员/) },
            { id: 'gm_shikong', icon: '🌪', name: '失控边缘', desc: '在失控的悬崖边走过一遭——扮演法救回了你', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/失控.{0,8}(边缘|危险|抗争|抵抗)|差点失控/) },
            { id: 'gm_tarot', icon: '🃏', name: '灰雾集会', desc: '参与过灰雾之上的集会——愚者注视之下，众人平等', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/塔罗会|灰雾.{0,6}集会|愚者大人/) },
            { id: 'gm_xulie4', icon: '✨', name: '半神之门', desc: '序列 4——圣者之门在望，人性还剩几成', test: (v) => /序列\s*(4|3|2|1|0)[^\d]|半神|圣者/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).序列 || '') + (pc(v).status || '')) },
            { id: 'gm_zhenzhu', icon: '👑', name: '序列之顶', desc: '握住序列 0 的权柄——旧日的王座有了新主', test: (v) => /序列\s*0|真神|神明之位/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).序列 || '') + (pc(v).status || '')) }
        ],

        /* ---------- v3.47.2 蛊真人：转数之途 ---------- */
        guzhenren: [
            { id: 'gzr_kaimai', icon: '🩸', name: '一转开脉', desc: '开脉成为一转蛊师——万里蛊道，始于足下', test: (v) => /[一1]\s*转|开脉|初阶蛊师/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).转数 || '') + (pc(v).status || '')) },
            { id: 'gzr_liangu', icon: '🐛', name: '炼蛊初成', desc: '亲手炼出第一只蛊——材料、火候、心性，缺一不可', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/炼蛊.{0,8}(成|成功|出)|炼出.{0,6}蛊/) },
            { id: 'gzr_qingmao', icon: '⛰', name: '青茅岁月', desc: '在青茅山古月家挣出了自己的位置——家族是壳，本事是核', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/青茅山|古月家族|古月山寨/) },
            { id: 'gzr_benming', icon: '🦋', name: '本命之蛊', desc: '凝出本命蛊——从今往后，一荣俱荣，一损俱损', test: (v) => /本命蛊/.test(pc(v).本命蛊 || '') || MoSeals_flat(v).slice(0, 4000).match(/本命蛊.{0,10}(凝|成|炼成)/) },
            { id: 'gzr_chunqiu', icon: '⏳', name: '五百年一梦', desc: '与春秋蝉的因果有过交集——时光的债，最难还', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/春秋蝉|五百年.{0,6}(前|重生)|重生.{0,8}(蛊|记忆)/) },
            { id: 'gzr_menggu', icon: '🗺', name: '出山行蛊', desc: '离开青茅山闯荡外面的蛊界——山外有山，蛊外有蛊', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/出山|离.{0,4}青茅|闯荡|游历.{0,6}(蛊|南疆)/) },
            { id: 'gzr_wuzhuan', icon: '⚡', name: '五转大能', desc: '修为踏入五转——一方大能，蛊界有了你的名号', test: (v) => /[五六5 6]\s*转|蛊王|大能/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).转数 || '') + (pc(v).status || '')) },
            { id: 'gzr_jiuzhuan', icon: '👑', name: '九转无敌', desc: '蛊道之巅——尊者之路上，再无敌手', test: (v) => /[八9九]\s*转|蛊尊|尊者|无敌于世/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).转数 || '') + (pc(v).status || '')) }
        ],

        /* ---------- v3.47.2 玄鉴仙族：家业之印 ---------- */
        xuanjianxianzu: [
            { id: 'xjx_qiling', icon: '🌱', name: '家族启灵', desc: '测出灵根录入族谱——仙族的门，为你开了一条缝', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/灵根|启灵|录入族谱|测灵/) },
            { id: 'xjx_lianqi', icon: '🧗', name: '炼气入门', desc: '引气入体踏上炼气——千里之行，始于引气', test: (v) => /炼气|练气/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).修为 || '') + (pc(v).status || '')) },
            { id: 'xjx_lingtian', icon: '🌾', name: '灵田丰收', desc: '亲手侍弄的灵田出了头一茬好收成——家业从地里长出来', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/灵田.{0,10}(丰收|收成|产出|熟)|丰收/) },
            { id: 'xjx_liandan', icon: '⚗', name: '丹房出丹', desc: '丹房里炼出第一炉像样的丹——火候即人心', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/炼丹.{0,8}(成|出|功)|一炉.{0,4}丹|丹成/) },
            { id: 'xjx_zhuji', icon: '🏛', name: '筑基成真', desc: '筑基功成——从家族的苗子长成了家族的栋梁', test: (v) => /筑基|紫府|金丹|元婴|化神/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).修为 || '') + (pc(v).status || '')) },
            { id: 'xjx_zulao', icon: '📜', name: '族老颔首', desc: '在族议上说上了话——族老们开始正眼看你', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/族老.{0,12}(认可|颔首|点头|器重|正眼)|族议.{0,8}(发言|说上话)/) },
            { id: 'xjx_dangjia', icon: '🏠', name: '执掌一房', desc: '执掌房支或独当一面——家族的担子压上了你的肩', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/执掌|当家|家主.{0,6}(位|继)|独当一面|一房之主/) },
            { id: 'xjx_jindan', icon: '✨', name: '金丹大道', desc: '结成金丹——家族的祠堂里，将来自有你一座牌位', test: (v) => /金丹|元婴|化神/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).修为 || '') + (pc(v).status || '')) }
        ],

        /* ---------- 自由世界：亲手星座（人生印记——世界玩家亲笔，印章世界中性，任何世界都成立） ---------- */
        freeworld: [
            { id: 'fw_firstday', icon: '🔨', name: '落笔成世', desc: '在你亲手创造的世界里活过了头一天', test: (v) => (Number(v.chapter) || 0) >= 1 },
            { id: 'fw_roof', icon: '🏠', name: '立锥之地', desc: '有了自己的落脚处——床是自己的，门会锁', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/落脚|住处|安家|置了.{0,4}宅|赁下|租下|自家.{0,3}(屋|铺)|有了住处/) },
            { id: 'fw_craft', icon: '🛠', name: '一技傍身', desc: '一门吃饭的手艺立住了——荒年饿不死手艺人', test: (v) => MoSeals_flat(v).slice(0, 4000).match(/手艺|营生|出师|入行|拜师|上工|开张|开业|开工/) },
            { id: 'fw_friend', icon: '🤝', name: '他乡故知', desc: '在自己写下的世界里，交下第一个朋友', test: (v) => npcs(v).some(n => n && ((Number(n.favor) || 0) >= 60 || /挚友|知己|故交|好友/.test(String(n.relationship || '')))) },
            { id: 'fw_standing', icon: '📍', name: '小有名气', desc: '名字开始有人记得——圈子不大，够用了', test: (v) => /小有名气|安身立命|一方人物|声望渐起|执掌一方|功成身退|此生无憾/.test(realmOf(v) + (pc(v).realm || '') + (pc(v).status || '')) },
            { id: 'fw_law', icon: '📜', name: '立新法者', desc: '在世界宪法卡里立下第一条运行时新法——创世的权柄用到了实处', test: () => { try { const wc = window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.setup && window.storyFramework.storyState.setup.worldCode; return Array.isArray(wc && wc.amendments) && wc.amendments.length > 0; } catch (e) { return false; } } },
            { id: 'fw_lifer', icon: '🌅', name: '此生无憾', desc: '活过一百回合——从落脚谋生到回望一生', test: (v) => (Number(v.chapter) || 0) >= 100 }
        ],

        /* ---------- 五大创作工坊（通用写作里程） ---------- */
        _workshop: [
            { id: 'ws_ch10', icon: '📖', name: '十章之功', desc: '写到第十章', test: (v) => (Number(v.chapter) || 0) >= 10 },
            { id: 'ws_ch30', icon: '📚', name: '三十章不辍', desc: '写到第三十章', test: (v) => (Number(v.chapter) || 0) >= 30 },
            { id: 'ws_w10k', icon: '✒', name: '万字长文', desc: '累计一万字', test: (v) => (Number(v.wordCount) || 0) >= 10000 },
            { id: 'ws_w50k', icon: '🖋', name: '五万言成', desc: '累计五万字', test: (v) => (Number(v.wordCount) || 0) >= 50000 },
            { id: 'ws_peak', icon: '⚡', name: '张力之巅', desc: '写出张力 90+ 的生死关头', test: (v, s) => { const tens = (s && s.tensions) || []; return tens.some(t => Number(t.v) >= 90); } },
            { id: 'ws_npcs', icon: '🎭', name: '众生入场', desc: '五名角色同台登场', test: (v) => npcs(v).length >= 5 }
        ]
    };

    /* 创作工坊五界共用 _workshop 套 */
    ['mystery', 'scifi', 'wuxia', 'cthulhu', 'free'].forEach(k => { SEALS[k] = SEALS._workshop; });

    /* ==================== 换界注册 ==================== */
    function onGenre(g) {
        const key = g || 'free';
        const defs = SEALS[key] || SEALS._workshop;
        try {
            const n = window.GameLayer && window.GameLayer.registerSeals(defs);
            if (n) console.log(`[WorldSeals] ${key} 界专属成就就位：${n} 枚`);
        } catch (e) { /* 注册失败不影响主流程 */ }
        return window.WorldSeals;
    }

    /* monkey-patch GameLayer.onGenre：换界/换世界线时自动重注册（GameLayer.onGenre 由 ImmersiveSuite.load 调用） */
    function install() {
        if (!window.GameLayer || window.GameLayer.__sealsPatched) return;
        const orig = window.GameLayer.onGenre.bind(window.GameLayer);
        window.GameLayer.onGenre = function (g) {
            const r = orig(g);
            try { onGenre(g); } catch (e) { }
            return r;
        };
        window.GameLayer.__sealsPatched = true;
    }

    window.WorldSeals = {
        onGenre,
        install,
        /** 测试口：取出某界定义 */
        defsOf: (k) => SEALS[k] || SEALS._workshop,
        /** 测试口：全部界键 */
        genres: () => Object.keys(SEALS).filter(k => k !== '_workshop')
    };

    /* 自装：晚于 game-layer.js 加载即直接生效 */
    install();
})();
