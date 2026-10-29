(function() {
  "use strict";
  const PALETTES = {
    shrouding: { primary: "#e8c477", accent: "#9f8fef", stone: "#8d93b8", tree: "#6fae8f", sand: "#d8c08a", water: "#5f7fd9", deep: "#0b1020", panel: "#101830", text: "#e9e6da", muted: "#a9a6c0" },
    doupocangqiong: { primary: "#f0b45c", accent: "#e0703c", stone: "#b09478", tree: "#8fae6f", sand: "#e0c084", water: "#4f9fd8", deep: "#150e08", panel: "#1e130a", text: "#f2e8d8", muted: "#b8a48c" },
    douluodalu: { primary: "#8fc3f2", accent: "#a8e0ff", stone: "#8ba4c0", tree: "#7fc0a0", sand: "#d8cc9a", water: "#4fa0e0", deep: "#0a1420", panel: "#0e1c2c", text: "#e6eef8", muted: "#9fb4c8" },
    wanmeishijie: { primary: "#7ed9a8", accent: "#e6cf8f", stone: "#9ab098", tree: "#5fc488", sand: "#d8c890", water: "#4fb8d8", deep: "#0a1712", panel: "#0e2018", text: "#e8f2ea", muted: "#a0b8a8" },
    swallowedstar: { primary: "#5fd4f0", accent: "#8ab0ff", stone: "#8898b8", tree: "#6fd0a8", sand: "#d0c8a0", water: "#4f9fe8", deep: "#070d1c", panel: "#0c1526", text: "#e8f0f8", muted: "#98a8c0" },
    quanzhigaoshou: { primary: "#f0c060", accent: "#b48cf0", stone: "#a098c0", tree: "#7fd0a0", sand: "#e0cc9a", water: "#6f8fe8", deep: "#120e1e", panel: "#191327", text: "#f0ecf8", muted: "#b0a8c8" },
    daoguiyixian: { primary: "#c9584a", accent: "#d8a898", stone: "#7a6862", tree: "#5f7a68", sand: "#c0a488", water: "#4f6f88", deep: "#100a0c", panel: "#1c1016", text: "#e8dcd6", muted: "#a89088" },
    zhongshengdushi: { primary: "#d8b468", accent: "#8a6df0", stone: "#8a8ca8", tree: "#6fc0a0", sand: "#d8c8a0", water: "#5f8fd8", deep: "#0c0e1a", panel: "#141126", text: "#eef0e8", muted: "#a8a8c0" },
    dibao: { primary: "#d8b46a", accent: "#a8745a", stone: "#a08a6a", tree: "#7a9a6a", sand: "#dcc898", water: "#8aa8c8", deep: "#14100a", panel: "#1a140c", text: "#efe6d4", muted: "#b0a488" },
    longzu: { primary: "#8a9ae8", accent: "#d87a94", stone: "#8888a8", tree: "#68c0a8", sand: "#c8c4a8", water: "#6f8fd8", deep: "#0d0c16", panel: "#13121e", text: "#e8eaf6", muted: "#a0a4c0" },
    quanzhifashi: { primary: "#9d8cf0", accent: "#e8a25c", stone: "#8a86a8", tree: "#68c0a8", sand: "#d8cca8", water: "#6f8fd8", deep: "#0e0d18", panel: "#141222", text: "#eae6f6", muted: "#a49cc0" },
    limingzhijian: { primary: "#d8a04c", accent: "#5fb8d8", stone: "#a89068", tree: "#8fb07a", sand: "#d8c090", water: "#5f9fd8", deep: "#12100a", panel: "#1a1610", text: "#e8e0d0", muted: "#a89878" },
    lunhuileyuan: { primary: "#e05858", accent: "#8a94b8", stone: "#8a8494", tree: "#6fa888", sand: "#c0b098", water: "#7f8fc0", deep: "#0c0a0e", panel: "#141014", text: "#e8e4ea", muted: "#a89ca8" },
    wulianfengdian: { primary: "#d89030", accent: "#c8a878", stone: "#a89068", tree: "#8fae6f", sand: "#dcc898", water: "#8aa8c8", deep: "#100d0a", panel: "#1a1510", text: "#ece4d8", muted: "#b0a48c" },
    shengxu: { primary: "#4cb8a8", accent: "#a8c8c0", stone: "#6a8494", tree: "#5fc4a0", sand: "#c8c4a0", water: "#4f9fc8", deep: "#0a0e0f", panel: "#10171a", text: "#e8f0ee", muted: "#90aaa8" },
    shenmifusu: { primary: "#7ab0a8", accent: "#a8c8c0", stone: "#5a7068", tree: "#4f7a6a", sand: "#b0a890", water: "#4f7f88", deep: "#0a0f0e", panel: "#0f1614", text: "#e8f0ec", muted: "#90a8a0" },
    ditandali: { primary: "#e8a04c", accent: "#f0c890", stone: "#a88860", tree: "#8fb07a", sand: "#e0c890", water: "#8aa8c8", deep: "#131009", panel: "#1a150c", text: "#f0e8d8", muted: "#b09878" },
    fanrenxiuxian: { primary: "#5db8c8", accent: "#a8d8e0", stone: "#4a8090", tree: "#6fae8f", sand: "#c8c4a0", water: "#4f9fc8", deep: "#0a0f12", panel: "#101820", text: "#e8f0f2", muted: "#90a8b0" },
    xianni: { primary: "#9d86d0", accent: "#c8b8e8", stone: "#6a5a90", tree: "#5f8a7a", sand: "#b0a8c0", water: "#5a6fc0", deep: "#0c0a12", panel: "#141020", text: "#ece8f2", muted: "#a098b8" },
    earth: { primary: "#5a9e7f", accent: "#c9a06a", stone: "#8a9888", tree: "#6fb088", sand: "#d8c090", water: "#4f8fb8", deep: "#0e1416", panel: "#141d1f", text: "#e8f0ea", muted: "#98aaa0" },
    quanqiubingfeng: { primary: "#5fb8d8", accent: "#b8e8f4", stone: "#7a94a8", tree: "#6fb0c0", sand: "#c8d8dc", water: "#4f9fd8", deep: "#08111c", panel: "#0d1826", text: "#e8f2f8", muted: "#94aab8" },
    chaoshenxueyuan: { primary: "#e8c478", accent: "#f4e0b8", stone: "#8a8494", tree: "#6fae8f", sand: "#d8c8a0", water: "#7e9cd8", deep: "#0c0e18", panel: "#12141f", text: "#eef0e6", muted: "#9aa4bc" },
    zhanhen: { primary: "#a8c4c8", accent: "#d8e4e8", stone: "#6a7a80", tree: "#5f9a8a", sand: "#c8c8b8", water: "#7e9ccc", deep: "#101418", panel: "#141a1e", text: "#e8f0f2", muted: "#8aa0a8" },
    jianlai: { primary: "#8fc4b8", accent: "#d8b86a", stone: "#6a8a80", tree: "#5fa890", sand: "#c8c0a0", water: "#5f9fc0", deep: "#101815", panel: "#16201c", text: "#e8f0ec", muted: "#8aa8a0" },
    guimi: { primary: "#b8a0d8", accent: "#c9a06a", stone: "#7a7488", tree: "#5f7a6a", sand: "#b0a488", water: "#5f7fa8", deep: "#14101a", panel: "#1a1422", text: "#eae4f0", muted: "#a094b0" },
    guzhenren: { primary: "#8fd88a", accent: "#d84a4a", stone: "#6a8068", tree: "#4fa060", sand: "#b8b890", water: "#5f8f88", deep: "#0c140c", panel: "#121c12", text: "#e8f2e8", muted: "#90b090" },
    xuanjianxianzu: { primary: "#9fd8a8", accent: "#e8c45c", stone: "#80907a", tree: "#68c080", sand: "#d0c090", water: "#5f9fb8", deep: "#101810", panel: "#161e16", text: "#e8f0e8", muted: "#98b098" },
    /* v3.31.4 原创界配色：武侠（宣纸墨金）与无图鉴界的行迹图兜底配色 */
    wuxia: { primary: "#c9b98a", accent: "#8aa8b8", stone: "#8a8478", tree: "#6f8f7a", sand: "#c8b48a", water: "#6f8f9f", deep: "#0d0b08", panel: "#16120c", text: "#eee8d8", muted: "#a89c88" },
    mystery: { primary: "#c8a088", accent: "#8aa0a8", stone: "#7a746e", tree: "#5f7a68", sand: "#b8a488", water: "#5f7f8f", deep: "#100c0e", panel: "#181214", text: "#e8e0d8", muted: "#a09488" },
    cthulhu: { primary: "#6fb8a8", accent: "#8a78c8", stone: "#4a6862", tree: "#3f5a52", sand: "#8a98a0", water: "#4f6f9f", deep: "#080d0e", panel: "#0d1416", text: "#e0ece8", muted: "#88a8a0" },
    scifi: { primary: "#5fc8e8", accent: "#8ab0ff", stone: "#5a7890", tree: "#4fae9f", sand: "#a8b8c0", water: "#4f8fd8", deep: "#060a18", panel: "#0a1020", text: "#e6f0f8", muted: "#8ca0b8" },
    free: { primary: "#c9a86a", accent: "#9fb8d8", stone: "#8a8878", tree: "#6f9f7a", sand: "#d0bc90", water: "#6f8fb0", deep: "#0e0d0a", panel: "#15130d", text: "#eee8d8", muted: "#a8a090" },
    freeworld: { primary: "#b8a878", accent: "#8fc0b0", stone: "#8a8474", tree: "#6f9f88", sand: "#c8b890", water: "#5f8fa8", deep: "#0c0d0a", panel: "#13140f", text: "#eae8dc", muted: "#a0a490" }
  };
  const ATLAS_DATA = {
    /* ---------- 遮天 ---------- */
    shrouding: {
      name: "遮天 · 行旅图鉴",
      flavor: "九龙拉棺，自泰山而来",
      layers: [
        {
          id: "earth",
          name: "地球 · 起点",
          ico: "星",
          hint: "万古之前的蓝星，一切始于泰山之约",
          decor: "cosmos",
          regions: [{ n: "华夏大地", cx: 50, cy: 48, rx: 36, ry: 28, tr: "plain" }],
          roads: [["taishan", "guanca"]],
          nodes: [
            {
              id: "taishan",
              n: "泰山之巅",
              x: 30,
              y: 42,
              t: "start",
              d: 2,
              rg: "华夏大地",
              desc: "五岳之首，历代封禅之地。同学聚会登山至此，天外九龙拉棺而至，五色祭坛显现，一切命运自此改写。",
              c: "原著开篇「泰山」章；九龙拉棺降临之地。"
            },
            {
              id: "guanca",
              n: "青铜古棺",
              x: 72,
              y: 62,
              t: "relic",
              d: 3,
              rg: "华夏大地",
              aliases: ["九龙拉棺", "古棺", "铜棺"],
              desc: "九龙拖行的巨大青铜古棺，横渡星空九死一生。棺内众人各怀心思，抵达北斗前有人陨落，有人蜕变。",
              c: "原著横渡星空段落；棺渡诸天，直达北斗星域。"
            }
          ]
        },
        {
          id: "east",
          name: "东荒 · 五域",
          ico: "山",
          hint: "北斗星域东荒——圣地世家并立，禁区威压万古",
          decor: "land",
          regions: [{ n: "域外", cx: 90, cy: 16, rx: 16, ry: 14, tr: "plain" }, { n: "北域边缘", cx: 37, cy: 34, rx: 16, ry: 14, tr: "plain" }, 
            { n: "燕地", cx: 22, cy: 61, rx: 21, ry: 22, tr: "plain" },
            { n: "北域", cx: 55, cy: 22, rx: 19, ry: 13, tr: "mountain" },
            { n: "西漠", cx: 74, cy: 64, rx: 16, ry: 14, tr: "desert" },
            { n: "南岭", cx: 55, cy: 86, rx: 18, ry: 11, tr: "forest" },
            { n: "中州", cx: 86, cy: 40, rx: 12, ry: 12, tr: "city" }
          ],
          roads: [
            ["yan", "lingxu"],
            ["lingxu", "taixuan"],
            ["yan", "ji"],
            ["ji", "jiang"],
            ["jiang", "nanling"],
            ["taixuan", "yaoguang"],
            ["yaoguang", "kuang"],
            ["ximo", "nanling"],
            ["zhongzhou", "ximo"],
            ["xingkong", "zhongzhou"]
          ],
          nodes: [
            {
              id: "yan",
              n: "燕国",
              x: 15,
              y: 72,
              t: "start",
              d: 1,
              rg: "燕地",
              desc: "东荒凡俗小国，叶凡一行坠入北斗后的第一站。灵气稀薄却市井安稳，是凡人视角看修真界的窗口。",
              c: "原著前期燕国篇；凡俗势力详录见知识库。"
            },
            {
              id: "lingxu",
              n: "灵墟洞天",
              x: 26,
              y: 56,
              t: "sect",
              d: 2,
              rg: "燕地",
              aliases: ["灵墟", "灵虚洞天"],
              desc: "燕国地界的修士洞天，叶凡一行初入北斗修行界的落脚处。洞天福地、道台传承，亦有暗流与算计。",
              c: "原著早期灵墟洞天线；初入修行界之地。"
            },
            {
              id: "taixuan",
              n: "太玄门",
              x: 20,
              y: 42,
              t: "sect",
              d: 2,
              rg: "燕地",
              aliases: ["太玄"],
              desc: "燕国境内大派，星峰之争所在地。山门藏经、长老授业，凡俗与修真界的分界在此分明。",
              c: "原著早期宗门线；星峰之争所在地。"
            },
            {
              id: "yaoguang",
              n: "摇光圣地",
              x: 37,
              y: 34,
              t: "sect",
              d: 4,
              rg: "北域边缘",
              aliases: ["摇光"],
              desc: "东荒圣地之一，圣主坐镇，底蕴深不可测。明面上仙风道骨，暗地里为圣体之秘与神源不惜代价。",
              c: "原著东荒圣地之一；与主角阵营纠葛极深。"
            },
            {
              id: "ji",
              n: "姬家",
              x: 30,
              y: 66,
              t: "sect",
              d: 4,
              rg: "燕地",
              aliases: ["姬家祖地"],
              desc: "帝裔世家，虚字秘术传世，族中高手如云。姬紫月出自此家；祖地底蕴深藏，轻易不可招惹。",
              c: "原著姬家详录见知识库；大帝传承世家。"
            },
            {
              id: "jiang",
              n: "姜家",
              x: 22,
              y: 80,
              t: "sect",
              d: 4,
              rg: "燕地",
              desc: "与姬家并立的帝裔世家，恒宇大帝传承。神王姜太虚护短之名震东荒，「姜家的事，姜家接下」。",
              c: "原著姜家详录；神王姜太虚镇族。"
            },
            {
              id: "kuang",
              n: "北域古矿",
              x: 55,
              y: 20,
              t: "danger",
              d: 5,
              rg: "北域",
              aliases: ["北域", "古矿"],
              desc: "神源出世之地，也是埋葬无数修士的凶地。矿道深处封印着不可言说的存在，源天师一脉的传承与此息息相关。",
              c: "原著北域源矿篇；源天师与源术体系见知识库。"
            },
            {
              id: "ximo",
              n: "西漠佛国",
              x: 74,
              y: 66,
              t: "sect",
              d: 4,
              rg: "西漠",
              aliases: ["西漠"],
              desc: "佛门净土，寺钟悠远，佛法无边。安妙依所在的须弥山香火鼎盛；佛门因果业障，一入便是万劫。",
              c: "原著西漠佛门详录；佛门大能坐镇。"
            },
            {
              id: "nanling",
              n: "南岭妖域",
              x: 55,
              y: 86,
              t: "wild",
              d: 4,
              rg: "南岭",
              aliases: ["南岭"],
              desc: "妖族聚居之地，青帝遗泽所在。妖气纵横，大圣出没；人族修士深入其中，十不存一。",
              c: "原著妖族与青帝详录；妖族大圣领地。"
            },
            {
              id: "zhongzhou",
              n: "中州",
              x: 86,
              y: 42,
              t: "city",
              d: 3,
              rg: "中州",
              desc: "东荒之外的浩土中枢，古路交汇、群雄并起。欲问鼎天下者，终将踏足中州问鼎之路。",
              c: "原著五域格局；北斗五域与星空古路见知识库。"
            },
            {
              id: "xingkong",
              n: "星空古路",
              x: 90,
              y: 16,
              t: "relic",
              d: 5,
              rg: "域外",
              aliases: ["古路"],
              desc: "横贯星空的万古试炼之路，一路血与机缘。走完此路者方有资格角逐帝路，叶凡十二年方归。",
              c: "原著星空古路篇；五域与星空格局见知识库。"
            }
          ]
        },
        {
          id: "xianlu",
          name: "星空 · 仙路",
          ico: "仙",
          hint: "万古争渡——成仙路开，仙域在望",
          decor: "cosmos",
          regions: [
            { n: "试炼古路", cx: 32, cy: 47, rx: 28, ry: 24, tr: "void" },
            { n: "仙路", cx: 84, cy: 30, rx: 15, ry: 17, tr: "void" }
          ],
          roads: [["xingkong1", "yinghuo"], ["xingkong1", "ziwei"], ["ziwei", "chengxian"], ["chengxian", "xianyu"]],
          nodes: [
            {
              id: "xingkong1",
              n: "星空第一城",
              x: 28,
              y: 44,
              t: "city",
              d: 3,
              rg: "试炼古路",
              aliases: ["第一城"],
              desc: "古路上的第一座雄城，诸天天骄汇聚之地。城中一砖一瓦皆刻着岁月，也是最公平的擂台。",
              c: "原著星空古路诸城；天骄争锋之地。"
            },
            {
              id: "yinghuo",
              n: "荧惑古星",
              x: 15,
              y: 64,
              t: "relic",
              d: 4,
              rg: "试炼古路",
              aliases: ["荧惑"],
              desc: "古路上的死亡之星，大雷音寺遗迹所在。古佛气息犹存，一步一劫，佛缘与杀机并存。",
              c: "原著荧惑古星篇；大雷音寺遗迹。"
            },
            {
              id: "ziwei",
              n: "紫微古星",
              x: 50,
              y: 30,
              t: "wild",
              d: 4,
              rg: "试炼古路",
              aliases: ["紫微"],
              desc: "古路上的大星，教派林立、古族盘踞。星域浩瀚，恩怨同样浩瀚。",
              c: "原著紫微古星篇；古族与教派格局。"
            },
            {
              id: "chengxian",
              n: "成仙路",
              x: 80,
              y: 38,
              t: "relic",
              d: 5,
              rg: "仙路",
              aliases: ["仙路"],
              desc: "万古以来最大的因果：仙路开启之日，禁区至尊出世，黑暗动乱席卷诸天。血染长阶，方有一线登仙之机。",
              c: "原著黑暗动乱详录；成仙路引动大劫。"
            },
            {
              id: "xianyu",
              n: "仙域",
              x: 92,
              y: 20,
              t: "relic",
              d: 3,
              rg: "仙路",
              desc: "破碎的仙域，诸帝终局的归宿。长生不再是无根之谈，可仙域残破，补天之路同样漫长。",
              c: "原著终局；联手诸帝入仙域补天。"
            }
          ]
        }
      ]
    },
    /* ---------- 斗破苍穹 ---------- */
    doupocangqiong: {
      name: "斗破苍穹 · 行旅图鉴",
      flavor: "三十年河东，三十年河西",
      layers: [
        {
          id: "jiama",
          name: "加玛帝国",
          ico: "山",
          hint: "斗气大陆西南——乌坦城少年的起点",
          decor: "land",
          regions: [{ n: "黑角域边缘", cx: 48, cy: 83, rx: 16, ry: 23, tr: "plain" }, 
            { n: "乌坦城地界", cx: 21, cy: 67, rx: 17, ry: 14, tr: "plain" },
            { n: "黑角域", cx: 40, cy: 30, rx: 15, ry: 12, tr: "desert" },
            { n: "帝都圈", cx: 80, cy: 47, rx: 21, ry: 21, tr: "plain" }
          ],
          roads: [["wutan", "moshou"], ["moshou", "kanan"], ["kanan", "tianfen"], ["kanan", "heijiao"], ["didu", "yunlan"], ["moshou", "didu"]],
          nodes: [
            {
              id: "wutan",
              n: "乌坦城",
              x: 12,
              y: 78,
              t: "start",
              d: 1,
              rg: "乌坦城地界",
              desc: "加玛帝国边陲小城，萧家所在。少年萧炎在此从天才跌落为废柴，又遇药老，一切恩怨自退婚始。",
              c: "原著开篇；萧家与乌坦城势力见知识库。"
            },
            {
              id: "moshou",
              n: "魔兽山脉",
              x: 30,
              y: 56,
              t: "wild",
              d: 3,
              rg: "乌坦城地界",
              aliases: ["魔兽山脉边缘"],
              desc: "横亘大陆的莽莽山脉，魔兽横行。采药人用命换钱，斗者在此淬体，机缘与兽口同在。",
              c: "原著早期历练地；魔兽体系见知识库。"
            },
            {
              id: "yunlan",
              n: "云岚宗",
              x: 88,
              y: 36,
              t: "sect",
              d: 4,
              rg: "帝都圈",
              aliases: ["云岚"],
              desc: "加玛帝国第一宗门，三年之约的赌台。宗门气运系于纳兰家与云山一念，终在萧炎手中轰然落幕。",
              c: "原著云岚宗与退婚事件、云岚宗覆灭详录。"
            },
            {
              id: "kanan",
              n: "迦南学院",
              x: 48,
              y: 74,
              t: "city",
              d: 2,
              rg: "黑角域边缘",
              aliases: ["迦南"],
              desc: "大陆著名学府，藏龙卧虎。内院强榜争锋、天焚炼气塔下镇压陨落心炎——学院线是少年意气的主场。",
              c: "原著迦南学院详录；天焚炼气塔与内院。"
            },
            {
              id: "tianfen",
              n: "天焚炼气塔",
              x: 48,
              y: 92,
              t: "relic",
              d: 4,
              rg: "黑角域边缘",
              aliases: ["炼气塔"],
              desc: "迦南学院内院深处的古塔，塔底封印异火陨落心炎。塔中修炼一日千里，塔底之心躁动不安。",
              c: "原著异火榜十四位陨落心炎封印地。"
            },
            {
              id: "heijiao",
              n: "黑角域",
              x: 40,
              y: 30,
              t: "danger",
              d: 4,
              rg: "黑角域",
              desc: "法外之地，弱肉强食写在明面上。拍卖会、黑市、佣兵与亡命徒共存——混乱，却也最有机缘。",
              c: "原著黑角域详录；混乱之地。"
            },
            {
              id: "didu",
              n: "加玛圣城",
              x: 72,
              y: 58,
              t: "city",
              d: 2,
              rg: "帝都圈",
              aliases: ["帝都", "加玛帝都"],
              desc: "帝国心脏，繁华鼎盛。炼药师大会在此举行，岩枭之名一战倾城；皇权与宗门在此角力。",
              c: "原著帝都篇；化名岩枭与七幻青灵涎。"
            }
          ]
        },
        {
          id: "zhongzhou",
          name: "中州 · 万域之心",
          ico: "城",
          hint: "大陆中央——强者如林，远古八族的舞台",
          decor: "land",
          regions: [{ n: "古族界域", cx: 86, cy: 30, rx: 16, ry: 14, tr: "plain" }, { n: "兽域", cx: 18, cy: 28, rx: 16, ry: 14, tr: "plain" }, { n: "天墓", cx: 64, cy: 50, rx: 16, ry: 14, tr: "plain" }, 
            { n: "星陨阁地界", cx: 28, cy: 55, rx: 17, ry: 15, tr: "plain" },
            { n: "丹塔", cx: 50, cy: 38, rx: 13, ry: 12, tr: "city" },
            { n: "魂殿势力圈", cx: 78, cy: 62, rx: 17, ry: 14, tr: "void" }
          ],
          roads: [["xunyuange", "danta"], ["danta", "tianmu"], ["shouyu", "xunyuange"], ["hundian", "gujie"], ["tianmu", "hundian"]],
          nodes: [
            {
              id: "xunyuange",
              n: "星陨阁",
              x: 28,
              y: 55,
              t: "sect",
              d: 3,
              rg: "星陨阁地界",
              aliases: ["星陨"],
              desc: "药老旧部所创的中州势力，天府联盟的骨架。阁中强者念旧情深——「药尘的东西，也敢碰？」",
              c: "原著星陨阁与药老旧部详录。"
            },
            {
              id: "danta",
              n: "丹塔",
              x: 50,
              y: 38,
              t: "sect",
              d: 3,
              rg: "丹塔",
              desc: "炼药师界的中州圣地，塔内丹香千年不散。丹会争锋以丹论道，玄空子坐镇，规矩森严。",
              c: "原著丹塔与炼药师界详录。"
            },
            {
              id: "tianmu",
              n: "天墓",
              x: 64,
              y: 50,
              t: "relic",
              d: 5,
              rg: "天墓",
              desc: "埋葬远古强者的宏大墓域，萧族先辈萧玄的残魂在此。墓中能量体游荡，机缘与凶险皆万载沉眠。",
              c: "原著天墓与萧玄详录；萧族旧事。"
            },
            {
              id: "shouyu",
              n: "兽域",
              x: 18,
              y: 28,
              t: "wild",
              d: 4,
              rg: "兽域",
              desc: "魔兽一族的地界，太古虚龙一脉盘踞。紫妍的血脉归统之路在此展开，龙威如渊。",
              c: "原著紫妍与太古虚龙详录；龙岛归统。"
            },
            {
              id: "hundian",
              n: "魂殿",
              x: 78,
              y: 64,
              t: "danger",
              d: 5,
              rg: "魂殿势力圈",
              aliases: ["魂殿总部"],
              desc: "笼罩大陆万年的阴影，捕魂炼魄，无所不在。营救药老、清算魂族——终局大幕自此拉开。",
              c: "原著魂殿与魂族详录；终极黑手。"
            },
            {
              id: "gujie",
              n: "古界",
              x: 86,
              y: 30,
              t: "relic",
              d: 4,
              rg: "古族界域",
              aliases: ["古族"],
              desc: "远古八族各自的血脉界域，古族居首。石界封锁岁月，血脉论高下，萧薰儿的家与枷锁皆在此。",
              c: "原著远古八族详录；血脉与古界。"
            }
          ]
        }
      ]
    },
    /* ---------- 斗罗大陆 ---------- */
    douluodalu: {
      name: "斗罗大陆 · 行旅图鉴",
      flavor: "这世上没有废武魂，只有废魂师",
      layers: [
        {
          id: "main",
          name: "斗罗大陆",
          ico: "陆",
          hint: "两大帝国并立，武魂殿阴影笼罩",
          decor: "land",
          regions: [
            { n: "圣魂村—史莱克", cx: 30, cy: 77, rx: 28, ry: 15, tr: "plain" },
            { n: "天斗帝国", cx: 36, cy: 40, rx: 19, ry: 15, tr: "city" },
            { n: "星罗帝国", cx: 83, cy: 48, rx: 15, ry: 17, tr: "plain" },
            { n: "魂兽地界", cx: 60, cy: 44, rx: 13, ry: 12, tr: "forest" },
            { n: "碧波海", cx: 88, cy: 14, rx: 11, ry: 9, tr: "water" },
            { n: "武魂殿", cx: 72, cy: 80, rx: 13, ry: 10, tr: "city" },
            { n: "法外之地", cx: 14, cy: 20, rx: 11, ry: 9, tr: "desert" },
            { n: "海外孤岛", cx: 91, cy: 10, rx: 9, ry: 7, tr: "water" },
            { n: "猎魂森林", cx: 26, cy: 58, rx: 11, ry: 8, tr: "forest" },
            { n: "落日森林", cx: 44, cy: 56, rx: 12, ry: 9, tr: "forest" },
            { id: "balake", n: "巴拉克王国", cx: 50, cy: 68, rx: 12, ry: 8, tr: "plain" }
          ],
          roads: [
            ["shenghun", "nuoding"],
            ["nuoding", "shulaik"],
            ["shulaik", "suto"],
            ["shulaik", "xingdou"],
            ["tiandou", "xingdou"],
            ["tiandou", "wuhuncheng"],
            ["shalv", "tiandou"],
            ["wuhuncheng", "jialing"],
            ["xingdou", "holyisland"],
            ["nuoding", "liehun"],
            ["tiandou", "haotian"],
            ["tiandou", "qibaoliu"],
            ["qibaoliu", "landian"],
            ["shulaik", "binghuo"],
            ["xingluo", "jialing"],
            ["wuhuncheng", "hanhai"],
            ["hanhai", "holyisland"]
          ],
          nodes: [
            {
              id: "shenghun",
              n: "圣魂村",
              x: 10,
              y: 86,
              t: "start",
              d: 1,
              rg: "圣魂村—史莱克",
              desc: "天斗帝国边陲小村，铁匠唐昊隐居之地。六岁武魂觉醒日，蓝银草与昊天锤一明一暗，命运自此转向。",
              c: "原著开篇；主角出生地。"
            },
            {
              id: "nuoding",
              n: "诺丁学院",
              x: 24,
              y: 78,
              t: "city",
              d: 1,
              rg: "圣魂村—史莱克",
              aliases: ["诺丁"],
              desc: "村镇小学堂，却来了位魂师理论第一的大师。师徒之缘始于此，「没有废武魂，只有废魂师」。",
              c: "原著两段学院线之一；大师玉小刚登场地。"
            },
            {
              id: "shulaik",
              n: "史莱克学院",
              x: 40,
              y: 84,
              t: "sect",
              d: 2,
              rg: "圣魂村—史莱克",
              aliases: ["史莱克"],
              desc: "只收怪物的怪物学院，校训便是「只收怪物」。七怪聚义于此，魔鬼训练与大斗魂场连胜打出名号。",
              c: "原著史莱克学院线；弗兰德、赵无极执教。"
            },
            {
              id: "suto",
              n: "索托城",
              x: 50,
              y: 68,
              t: "city",
              d: 2,
              rg: "巴拉克王国",
              aliases: ["苏托城", "索托", "巴拉克城"],
              desc: "史莱克学院所在的繁华之城，大斗魂场灯火不熄。七怪初登擂台，连胜纪录自这里开始累积。",
              c: "原著大斗魂场竞技线。"
            },
            {
              id: "xingdou",
              n: "星斗大森林",
              x: 60,
              y: 44,
              t: "wild",
              d: 4,
              rg: "魂兽地界",
              aliases: ["星斗"],
              desc: "魂兽圣地，十万年魂兽栖息的核心区。猎魂人的猎场，也是魂兽的家园；大明二明镇守此地。",
              c: "原著星斗大森林；魂环猎取主线地。"
            },
            {
              id: "tiandou",
              n: "天斗城",
              x: 34,
              y: 36,
              t: "city",
              d: 3,
              rg: "天斗帝国",
              aliases: ["天斗皇城"],
              desc: "天斗帝国帝都，皇室深宫暗流涌动。精英大赛在此设擂，雪清河的假面下藏着武魂殿的影子。",
              c: "原著精英大赛线；天斗皇室格局。"
            },
            {
              id: "wuhuncheng",
              n: "武魂城",
              x: 70,
              y: 74,
              t: "danger",
              d: 5,
              rg: "武魂殿",
              aliases: ["武魂殿", "教皇殿"],
              desc: "武魂殿的权力中枢，教皇比比东坐镇。白金色的教皇殿巍峨如神迹——斗罗大陆真正的阴影中心。",
              c: "原著第一反派势力；比比东与供奉殿所在。"
            },
            {
              id: "shalv",
              n: "杀戮之都",
              x: 18,
              y: 18,
              t: "danger",
              d: 5,
              rg: "法外之地",
              aliases: ["杀戮"],
              desc: "无法无天的凶城，以杀止杀的地狱路。杀神领域在此淬炼，走出去的人，眼里都多了点别的东西。",
              c: "原著杀戮之都/地狱路/杀神领域详录。"
            },
            {
              id: "jialing",
              n: "嘉陵关",
              x: 88,
              y: 40,
              t: "relic",
              d: 5,
              rg: "星罗帝国",
              desc: "两帝国边境的雄关，终局决战之地。双神之战在此收官，血仇与时代，都在关墙下做了总决算。",
              c: "原著嘉陵关决战；终局之战。"
            },
            {
              id: "holyisland",
              n: "海神岛",
              x: 90,
              y: 10,
              t: "relic",
              d: 4,
              rg: "海外孤岛",
              aliases: ["海神"],
              desc: "海外神岛，波塞西守护海神传承。海神九考一考一重天，过者承神位——唐三的神考之路在此完成。",
              c: "原著海神岛/海神九考/海神三叉戟详录。"
            },
            {
              id: "haotian",
              n: "昊天宗",
              x: 24,
              y: 30,
              t: "sect",
              d: 4,
              rg: "天斗帝国",
              aliases: ["昊天"],
              desc: "上三宗之首，天下第一器武魂昊天锤的祖地。宗门隐于深山，一声锤响可震退万魂；唐昊一脉的荣光与血债，都压在这座山门上。",
              c: "原著上三宗设定；唐三父系血脉与昊天锤出处。"
            },
            {
              id: "qibaoliu",
              n: "七宝琉璃宗",
              x: 46,
              y: 30,
              t: "sect",
              d: 3,
              rg: "天斗帝国",
              aliases: ["七宝"],
              desc: "上三宗之一，天下第一辅助武魂七宝琉璃塔所在。宁风致掌宗，富甲一方又不失人情——史莱克最硬的后台之一。",
              c: "原著上三宗设定；宁风致、宁荣荣与史莱克结盟线。"
            },
            {
              id: "landian",
              n: "蓝电霸王龙家族",
              x: 38,
              y: 48,
              t: "sect",
              d: 4,
              rg: "天斗帝国",
              aliases: ["蓝电"],
              desc: "上三宗之一，以兽武魂蓝电霸王龙称雄的古老家族。族中子弟皆具龙相，却在武魂殿的清洗中血流成河——盛极而衰只在一夜。",
              c: "原著上三宗设定；武魂殿灭门线。"
            },
            {
              id: "liehun",
              n: "猎魂森林",
              x: 24,
              y: 57,
              t: "wild",
              d: 2,
              rg: "猎魂森林",
              desc: "天斗帝国圈养低阶魂兽的官办猎场，入内须持武魂殿手形。十年百年魂兽居多，是少年魂师取第一魂环的入门地。",
              c: "原著开篇猎环篇；唐三第一魂环获取地。"
            },
            {
              id: "binghuo",
              n: "冰火两仪眼",
              x: 42,
              y: 54,
              t: "relic",
              d: 5,
              rg: "落日森林",
              desc: "落日森林深处的两极奇泉，一眼至寒、一眼至炎。仙草在此疯长，剧毒与造化同源——独孤博守着它，也困于它。",
              c: "原著冰火两仪眼与仙草线；独孤博与唐三交易。"
            },
            {
              id: "xingluo",
              n: "星罗城",
              x: 78,
              y: 50,
              t: "city",
              d: 3,
              rg: "星罗帝国",
              aliases: ["星罗皇城"],
              desc: "星罗帝国帝都，朱家与戴家的王座。尚武之风冠绝大陆，皇位之争以胜负定生死——戴沫白从这里一路杀出来。",
              c: "原著星罗帝国篇；戴沐白与朱竹清出身地。"
            },
            {
              id: "hanhai",
              n: "瀚海城",
              x: 84,
              y: 18,
              t: "city",
              d: 2,
              rg: "碧波海",
              aliases: ["瀚海"],
              desc: "面朝碧波海的港城，武魂分殿临海而立。通往海神岛的航路与谣言一样多，出海的人一半为传承，一半为逃命。",
              c: "原著武魂殿分殿体系与海外航路。"
            }
          ]
        }
      ]
    },
    /* ---------- 完美世界 ---------- */
    wanmeishijie: {
      name: "完美世界 · 行旅图鉴",
      flavor: "等我长大，把骨夺回来",
      layers: [
        {
          id: "xiajie",
          name: "下界 · 大荒",
          ico: "荒",
          hint: "石村烟火与大荒凶兽共存的起点",
          decor: "land",
          regions: [
            { n: "石村地界", cx: 22, cy: 68, rx: 15, ry: 13, tr: "forest" },
            { n: "石国", cx: 49, cy: 44, rx: 17, ry: 14, tr: "plain" },
            { n: "凶地", cx: 56, cy: 80, rx: 17, ry: 12, tr: "mountain" },
            { n: "北海水域", cx: 78, cy: 52, rx: 12, ry: 9, tr: "water" }
          ],
          roads: [["shicun", "dahuang"], ["dahuang", "shiguo"], ["shiguo", "huoguo"], ["dahuang", "xushen"], ["xushen", "baiduanshan"], ["shiguo", "wuwangfu"], ["wuwangfu", "butian"], ["huoguo", "kunpeng"], ["baiduanshan", "xiling"]],
          nodes: [
            {
              id: "shicun",
              n: "石村",
              x: 12,
              y: 74,
              t: "start",
              d: 1,
              rg: "石村地界",
              desc: "大荒边缘的小村，村口一株焦黑古柳。至尊骨被夺的少年在此长大，柳神庇护，炊烟最暖。",
              c: "原著开篇；柳神与石村详录见知识库。"
            },
            {
              id: "dahuang",
              n: "大荒",
              x: 32,
              y: 62,
              t: "wild",
              d: 3,
              rg: "石村地界",
              desc: "凶兽横行的莽荒之地，太古十凶的传说在此流传。村人狩猎以命换食，少年在此淬骨开路。",
              c: "原著大荒与凶兽生态；太古十凶宝术。"
            },
            {
              id: "xushen",
              n: "虚神界",
              x: 45,
              y: 86,
              t: "relic",
              d: 4,
              rg: "凶地",
              aliases: ["虚神"],
              desc: "神秘浩瀚的历练之界，一层塔一道关。天骄在此生死相争，符文与宝术的领悟以血为学费。",
              c: "原著虚神界历练篇。"
            },
            {
              id: "shiguo",
              n: "石国都城",
              x: 42,
              y: 44,
              t: "city",
              d: 3,
              rg: "石国",
              aliases: ["石国"],
              desc: "下界第一个王权舞台，庙堂之上祖宗法度压人。夺骨之局的因果在此第一次摆上台面。",
              c: "原著石国篇；王权与祖制之争。"
            },
            {
              id: "huoguo",
              n: "火国",
              x: 62,
              y: 52,
              t: "city",
              d: 3,
              rg: "石国",
              desc: "下界大国，火灵儿的故国。明艳直率的公主在此长大，国运与情义同样滚烫。",
              c: "原著火国与火灵儿详录。"
            },
            {
              id: "baiduanshan",
              n: "百断山",
              x: 68,
              y: 80,
              t: "danger",
              d: 5,
              rg: "凶地",
              aliases: ["百断"],
              desc: "下界著名凶地，山断百折，古之遗迹与杀机并存。多少人进去了没出来，出来的人都不再是从前的人。",
              c: "原著百断山探险篇。"
            },
            {
              id: "wuwangfu",
              n: "武王府",
              x: 50,
              y: 50,
              t: "city",
              d: 3,
              rg: "石国",
              aliases: ["武王府"],
              desc: "石国武王府，石昊出生的地方。至尊骨在此被夺，襁褓里的血债，成了后来一切因果的第一块砖。",
              c: "原著开篇；夺骨之局的起点。"
            },
            {
              id: "butian",
              n: "补天阁",
              x: 36,
              y: 36,
              t: "sect",
              d: 3,
              rg: "石国",
              aliases: ["补天"],
              desc: "石国大门派，祭灵是一株葫芦藤。祭灵坐化之日群狼环伺，门人四散——后来石昊去上界前，把它重新立了起来。",
              c: "原著补天阁篇；鬼爷一脉的下界传承。"
            },
            {
              id: "kunpeng",
              n: "鲲鹏巢",
              x: 76,
              y: 50,
              t: "relic",
              d: 5,
              rg: "北海水域",
              aliases: ["鲲鹏巢穴", "北海"],
              desc: "北海深处的太古巢穴，鲲鹏沉眠万年。石昊从这里带走了震古烁今的鲲鹏法——也带走了同代天骄的命。",
              c: "原著北海篇；鲲鹏宝术的出处。"
            },
            {
              id: "xiling",
              n: "西陵兽山",
              x: 56,
              y: 78,
              t: "danger",
              d: 4,
              rg: "凶地",
              aliases: ["西陵"],
              desc: "太古凶兽的埋骨地与守护者居所，与诡异的西陵界相接。因参与补天阁灭门遭石昊清算，从此一蹶不振。",
              c: "原著西陵兽山篇；凶兽葬地设定。"
            }
          ]
        },
        {
          id: "shangjie",
          name: "上界 · 三千州",
          ico: "界",
          hint: "浩土三千州——天骄如过江之鲫",
          decor: "cosmos",
          regions: [
            { n: "三千州", cx: 25, cy: 40, rx: 21, ry: 19, tr: "plain" },
            { n: "边荒帝关", cx: 64, cy: 34, rx: 14, ry: 13, tr: "mountain" },
            { n: "界海", cx: 84, cy: 62, rx: 14, ry: 15, tr: "water" },
            { n: "仙域", cx: 91, cy: 21, rx: 9, ry: 8, tr: "void" },
            { n: "异域", cx: 70, cy: 78, rx: 16, ry: 12, tr: "void" }
          ],
          roads: [["sanqian", "guji"], ["sanqian", "diguan"], ["diguan", "jiehai"], ["jiehai", "xianyuj"], ["diguan", "tianshen"], ["diguan", "yiyu"]],
          nodes: [
            {
              id: "sanqian",
              n: "上界三千州",
              x: 30,
              y: 52,
              t: "city",
              d: 3,
              rg: "三千州",
              aliases: ["三千州", "上界"],
              desc: "「荒」之名行走之地，大教圣地古族林立。一域之骄到了这里不过是沧海一粟，天骄多如过江之鲫。",
              c: "原著上界篇；大教/圣地/古族格局。"
            },
            {
              id: "guji",
              n: "仙古遗迹",
              x: 20,
              y: 26,
              t: "relic",
              d: 4,
              rg: "三千州",
              aliases: ["仙古"],
              desc: "上一个纪元的残响，神藏深处的宝藏与古之意志同眠。古迹开启之日，各方倾巢而出。",
              c: "原著古迹与神藏体系。"
            },
            {
              id: "diguan",
              n: "帝关",
              x: 64,
              y: 34,
              t: "danger",
              d: 5,
              rg: "边荒帝关",
              aliases: ["边荒帝关"],
              desc: "镇守诸天的雄关，血战万古不曾陷落。「身后就是万灵——退一步都不行」，帝关落败是全书最重的一笔。",
              c: "原著帝关之战；边荒血战。"
            },
            {
              id: "jiehai",
              n: "界海",
              x: 84,
              y: 62,
              t: "wild",
              d: 5,
              rg: "界海",
              aliases: ["黑暗界海"],
              desc: "诸天之外的黑暗汪洋，黑暗动乱的源头。渡海者九死一生，独断万古的背影自这里走向黑暗深处。",
              c: "原著界海与黑暗动乱详录。"
            },
            {
              id: "xianyuj",
              n: "仙域",
              x: 92,
              y: 22,
              t: "relic",
              d: 3,
              rg: "仙域",
              desc: "万古征途的终点，成仙执念的答案。走到这里的人已经不多了——荒天帝独断万古，静待故人。",
              c: "原著终局；独断万古与仙域。"
            },
            {
              id: "tianshen",
              n: "天神书院",
              x: 58,
              y: 24,
              t: "sect",
              d: 4,
              rg: "边荒帝关",
              aliases: ["天神书院"],
              desc: "边荒之地的最高学府，只为帝关输送英杰。同代天骄在此同堂修行，孟天正一脉在此传道——出了书院的门，就是战场。",
              c: "原著天神书院篇；孟天正与边荒殉道线。"
            },
            {
              id: "yiyu",
              n: "异域",
              x: 68,
              y: 76,
              t: "danger",
              d: 5,
              rg: "异域",
              aliases: ["异域"],
              desc: "被诡异与不祥侵染的大陆，九天十地的宿敌。安澜、俞陀等不朽之王自此跨界而来——石昊在这里被出卖，也在这里杀出名号。",
              c: "原著异域篇；不朽之王与跨界战争线。"
            }
          ]
        }
      ]
    },
    /* ---------- 吞噬星空 ---------- */
    swallowedstar: {
      name: "吞噬星空 · 行旅图鉴",
      flavor: "家，以后交给我",
      layers: [
        {
          id: "earth",
          name: "地球 · 基地市时代",
          ico: "城",
          hint: "大涅槃之后——武者守卫文明的年代",
          decor: "land",
          regions: [
            { n: "江南基地市", cx: 22, cy: 80, rx: 15, ry: 12, tr: "city" },
            { n: "废墟区", cx: 38, cy: 50, rx: 13, ry: 12, tr: "desert" },
            { n: "训练营", cx: 70, cy: 42, rx: 15, ry: 13, tr: "city" },
            { n: "华夏诸城", cx: 16, cy: 40, rx: 12, ry: 10, tr: "city" },
            { n: "澳洲荒原", cx: 52, cy: 78, rx: 14, ry: 11, tr: "desert" },
            { n: "遗迹", cx: 58, cy: 66, rx: 12, ry: 9, tr: "void" }
          ],
          roads: [["jiangnan", "feixu"], ["jiangnan", "jixian"], ["feixu", "wudao"], ["wudao", "xunlian"], ["jiangnan", "huangye"], ["huangye", "feixu"], ["jiangnan", "jingdu"], ["jiangnan", "aozhou"], ["wudao", "jiangnan"]],
          nodes: [
            {
              id: "jiangnan",
              n: "江南基地市",
              x: 16,
              y: 76,
              t: "start",
              d: 2,
              rg: "江南基地市",
              aliases: ["江南"],
              desc: "华夏五十一基地市之一，罗峰的家。学校、武馆、小区烟火气俱全——怪兽纪元里难得的安稳角落。",
              c: "原著开篇；江南基地市详录见知识库。"
            },
            {
              id: "feixu",
              n: "废墟区",
              x: 34,
              y: 50,
              t: "danger",
              d: 4,
              rg: "废墟区",
              aliases: ["废墟"],
              desc: "大涅槃前的城市残骸，怪兽的巢穴，武者的猎场。双尾猫鼠与铁甲龙在此游荡，用命换钱的地方。",
              c: "原著废墟区与遗迹详录；怪兽等级体系。"
            },
            {
              id: "jixian",
              n: "极限武馆总部",
              x: 28,
              y: 88,
              t: "sect",
              d: 2,
              rg: "江南基地市",
              aliases: ["极限武馆"],
              desc: "洪创立的武者圣地，规矩森严、传承有序。从这里走出的武者，扛起了人类文明的脊梁。",
              c: "原著极限武馆体系详录。"
            },
            {
              id: "wudao",
              n: "雾岛遗迹",
              x: 56,
              y: 66,
              t: "relic",
              d: 4,
              rg: "遗迹",
              aliases: ["雾岛"],
              desc: "呼延博留下的传承之地，巴巴塔沉眠于此。云雾锁岛，强者云集——罗峰命运的真正转折点。",
              c: "原著雾岛遗迹篇；巴巴塔与呼延博传承详录。"
            },
            {
              id: "xunlian",
              n: "精英训练营",
              x: 72,
              y: 42,
              t: "sect",
              d: 3,
              rg: "训练营",
              aliases: ["训练营"],
              desc: "极限武馆的最高学府，全球天才的角斗场。入学考核百里挑一，出营者皆是人族未来的战神苗子。",
              c: "原著精英训练营篇。"
            },
            {
              id: "huangye",
              n: "荒野区",
              x: 44,
              y: 42,
              t: "wild",
              d: 3,
              rg: "废墟区",
              aliases: ["荒野"],
              desc: "基地市高墙之外的一切：废弃公路、长草的楼盘、不知名的兽吼。武者在这里用命换材料，普通人一辈子不敢踏出墙外一步。",
              c: "原著荒野区设定；武者出城狩猎的日常舞台。"
            },
            {
              id: "jingdu",
              n: "京都基地市",
              x: 14,
              y: 38,
              t: "city",
              d: 2,
              rg: "华夏诸城",
              aliases: ["京都"],
              desc: "华夏另一座核心基地市，飞碟航线十几分钟可达。权力与兵力在此集结，大涅槃后的国都，守着最后一点体面。",
              c: "原著基地市体系；华夏势力格局。"
            },
            {
              id: "aozhou",
              n: "澳洲大陆",
              x: 50,
              y: 76,
              t: "wild",
              d: 5,
              rg: "澳洲荒原",
              aliases: ["澳洲"],
              desc: "整片沦陷给怪兽的大陆，王级与皇级领主的巢穴所在。人类远征队进去就只剩番号——罗峰在这里第一次见识什么叫\"高等生命\"。",
              c: "原著澳洲篇；王级怪兽与人类远征线。"
            }
          ]
        },
        {
          id: "cosmos",
          name: "星海 · 宇宙时代",
          ico: "星",
          hint: "地球接轨宇宙——舞台放大到诸天星海",
          decor: "cosmos",
          regions: [{ n: "星海", cx: 44, cy: 61, rx: 40, ry: 17, tr: "void" }, 
            { n: "虚拟宇宙", cx: 28, cy: 30, rx: 14, ry: 12, tr: "void" },
            { n: "混沌城", cx: 52, cy: 48, rx: 14, ry: 12, tr: "city" },
            { n: "宇宙海", cx: 89, cy: 28, rx: 13, ry: 17, tr: "void" },
            { n: "人类疆域", cx: 66, cy: 26, rx: 14, ry: 11, tr: "city" },
            { n: "异族疆域", cx: 40, cy: 72, rx: 15, ry: 11, tr: "desert" }
          ],
          roads: [["xuni", "hundun"], ["hundun", "yuanxing"], ["yunmo", "hundun"], ["yuanxing", "yuzhouhai"], ["yuzhouhai", "qiyuan"], ["hundun", "jufu"], ["yuanxing", "jixie"]],
          nodes: [
            {
              id: "xuni",
              n: "虚拟宇宙网络",
              x: 28,
              y: 30,
              t: "relic",
              d: 2,
              rg: "虚拟宇宙",
              aliases: ["虚拟宇宙"],
              desc: "覆盖诸天的虚拟网络，一个账号通行宇宙。杀戮场、太初秘境、交易拍卖皆在其中——虚拟即真实。",
              c: "原著虚拟宇宙详录；原祖的造物。"
            },
            {
              id: "hundun",
              n: "混沌城",
              x: 52,
              y: 48,
              t: "city",
              d: 3,
              rg: "混沌城",
              aliases: ["混沌城主城"],
              desc: "混沌城主坐镇之地，罗峰的师门所在。城主惜字如金，「去悟」「不够，再练」——强者的道场。",
              c: "原著混沌城主详录；拜师线。"
            },
            {
              id: "yuanxing",
              n: "原始星",
              x: 68,
              y: 64,
              t: "wild",
              d: 5,
              rg: "星海",
              aliases: ["原始宇宙", "原始星域"],
              desc: "原始宇宙的凶险星域，异族与人类在此血战。原始星大战让罗峰之名传遍星海——扬名之地，亦是埋骨之地。",
              c: "原著原始星大战；星海崛起线。"
            },
            {
              id: "yunmo",
              n: "陨墨星",
              x: 20,
              y: 58,
              t: "relic",
              d: 4,
              rg: "星海",
              aliases: ["陨墨"],
              desc: "呼延博曾经的领地，巴巴塔守护万年的故乡遗迹。传承的起点，因果的源头。",
              c: "原著呼延博传承背景；陨墨星主。"
            },
            {
              id: "yuzhouhai",
              n: "宇宙海",
              x: 86,
              y: 40,
              t: "wild",
              d: 5,
              rg: "宇宙海",
              desc: "容纳诸多宇宙的浩瀚之海，界兽浩劫的战场。终极之战在此落幕，见证者寥寥。",
              c: "原著界兽浩劫与宇宙海终局详录。"
            },
            {
              id: "qiyuan",
              n: "起源大陆",
              x: 92,
              y: 16,
              t: "relic",
              d: 3,
              rg: "宇宙海",
              desc: "传说中一切的源头，真正的强者之地。罗峰携原祖乘星辰塔而去——书页合上之处，路才刚开始。",
              c: "原著终局；星辰塔前往起源大陆。"
            },
            {
              id: "jufu",
              n: "巨斧斗武场",
              x: 64,
              y: 24,
              t: "arena",
              d: 4,
              rg: "人类疆域",
              aliases: ["巨斧"],
              desc: "巨斧创始者立下的斗战圣地，遍设场馆、生死自负。无限制格斗与押注同在，赢了拿资源，输了连名字都不留。",
              c: "原著人类五大巅峰势力；洪的出身线。"
            },
            {
              id: "jixie",
              n: "机械族疆域",
              x: 38,
              y: 70,
              t: "danger",
              d: 5,
              rg: "异族疆域",
              aliases: ["机械族"],
              desc: "机械族盘踞的星域，金属与算力的帝国。它们没有血肉，也不懂怜悯——与虫族、妖族同列宇宙巅峰族群，是人族最难缠的对手之一。",
              c: "原著宇宙巅峰族群设定；人族对外战争线。"
            }
          ]
        }
      ]
    },
    /* ---------- 全职高手 ---------- */
    quanzhigaoshou: {
      name: "全职高手 · 行旅图鉴",
      flavor: "如果喜欢，就把这一切当作是荣耀",
      layers: [
        {
          id: "glory",
          name: "荣耀双界",
          ico: "竞",
          hint: "现实与荣耀——一个网吧少年到巅峰的路",
          decor: "city",
          regions: [
            { n: "H市 · 现实", cx: 19, cy: 72, rx: 15, ry: 20, tr: "city" },
            { n: "荣耀 · 网游", cx: 42, cy: 62, rx: 17, ry: 15, tr: "void" },
            { n: "赛场", cx: 75, cy: 41, rx: 20, ry: 28, tr: "city" },
            { id: "shijiesai", n: "世界邀请赛 · 苏黎世", cx: 92, cy: 16, rx: 9, ry: 8, tr: "city" }
          ],
          roads: [
            ["wangba", "hcity"],
            ["wangba", "tenth"],
            ["wangba", "training"],
            ["tenth", "bosszone"],
            ["bosszone", "challenge"],
            ["challenge", "allstar"],
            ["allstar", "finals"],
            ["finals", "worldcup"]
          ],
          nodes: [
            {
              id: "wangba",
              n: "兴欣网吧",
              x: 10,
              y: 86,
              t: "start",
              d: 1,
              rg: "H市 · 现实",
              aliases: ["网吧", "兴欣"],
              desc: "一切重启的地方。老板娘陈果的店，叶修白天是网管，夜里是君莫笑——兴欣战队从这里起步。",
              c: "原著开篇；网吧与民间电竞生态详录。"
            },
            {
              id: "hcity",
              n: "H市街区",
              x: 24,
              y: 74,
              t: "city",
              d: 1,
              rg: "H市 · 现实",
              aliases: ["H市"],
              desc: "战队驻地与日常生活圈。楼下便利店、训练归来的一碗热面——荣耀之外，人间烟火。",
              c: "原著兴欣战队详录；草登顶模板的起点。"
            },
            {
              id: "tenth",
              n: "荣耀第十区",
              x: 36,
              y: 72,
              t: "wild",
              d: 2,
              rg: "荣耀 · 网游",
              aliases: ["第十区", "新区"],
              desc: "新开的服务器，君莫笑重出江湖之地。散人全技能流派惊艳全服，各战队公会闻风而动。",
              c: "原著网游线；散人与千机伞体系。"
            },
            {
              id: "bosszone",
              n: "野图BOSS领地",
              x: 52,
              y: 54,
              t: "danger",
              d: 3,
              rg: "荣耀 · 网游",
              aliases: ["野图"],
              desc: "公会混战的核心战场，橙装与材料的出处。嘉世、蓝雨、微草的公会在此明争暗斗，战术与手速的绞肉机。",
              c: "原著公会争夺线；野图BOSS体系。"
            },
            {
              id: "training",
              n: "兴欣训练室",
              x: 28,
              y: 58,
              t: "sect",
              d: 1,
              rg: "荣耀 · 网游",
              aliases: ["训练室"],
              desc: "从网吧隔间到正规训练室，兴欣的成长刻度。唐柔的加练、包子的脑洞、魏琛的录像分析都在这里。",
              c: "原著训练与青训体系详录。"
            },
            {
              id: "challenge",
              n: "挑战赛场馆",
              x: 58,
              y: 32,
              t: "arena",
              d: 3,
              rg: "赛场",
              aliases: ["挑战赛"],
              desc: "重回联盟的唯一通道，圈外势力的独木桥。兴欣的奇迹之路从这里正式起跳。",
              c: "原著挑战赛奇迹之路详录。"
            },
            {
              id: "allstar",
              n: "全明星会场",
              x: 76,
              y: 40,
              t: "arena",
              d: 2,
              rg: "赛场",
              aliases: ["全明星"],
              desc: "赛季中段的嘉年华，星光与口水齐飞。新秀挑战赛暗流涌动——这里能一夜成名，也能一夜看清新星成色。",
              c: "原著全明星周末详录。"
            },
            {
              id: "finals",
              n: "总决赛场馆",
              x: 84,
              y: 66,
              t: "arena",
              d: 3,
              rg: "赛场",
              aliases: ["总决赛"],
              desc: "荣耀之巅的舞台，第十赛季决赛对轮回。山呼海啸的场馆里，千机伞撑开的那个夏天值得整部书。",
              c: "原著第十赛季夺冠之路详录。"
            },
            {
              id: "worldcup",
              n: "世界邀请赛",
              x: 92,
              y: 16,
              t: "arena",
              d: 3,
              rg: "世界邀请赛 · 苏黎世",
              aliases: ["世界邀请赛", "国家队"],
              desc: "全书终章，国家队集结出征。曾经赛场上的死敌并肩而立——荣耀，从来不止是一个人的。",
              c: "原著世界邀请赛与全书终章。"
            }
          ]
        },
        {
          id: "fuben",
          name: "荣耀 · 副本与神域",
          ico: "副",
          hint: "从格林之森的哥布林到神之领域的空中陵墓——材料、纪录与银装都从这里出",
          decor: "land",
          regions: [
            { n: "练级区", cx: 30, cy: 34, rx: 22, ry: 18, tr: "forest" },
            { n: "副本深处", cx: 62, cy: 30, rx: 20, ry: 16, tr: "mountain" },
            { n: "神之领域", cx: 48, cy: 72, rx: 24, ry: 14, tr: "city" }
          ],
          roads: [["gelin", "maigu"], ["maigu", "yixian"], ["yixian", "kongzhong"], ["gelin", "xishan"], ["kongzhong", "xishan"]],
          nodes: [
            {
              id: "gelin",
              n: "格林之森",
              x: 22,
              y: 28,
              t: "wild",
              d: 2,
              rg: "练级区",
              aliases: ["格林", "哥布林"],
              desc: "五级就能进的最低级副本，草丛与树林里全是哥布林。暗夜猫妖藏在最深处，指甲、利爪与眼石是千机伞最早的那一批材料——大神不喝解毒药，照样单刷。",
              c: "原著首个副本；千机伞升级材料的产地。"
            },
            {
              id: "maigu",
              n: "埋骨之地",
              x: 38,
              y: 42,
              t: "danger",
              d: 3,
              rg: "练级区",
              aliases: ["埋骨", "丧尸贝利"],
              desc: "二十三到二十七级的副本，遍地尸骨与僵尸。叶修在这里用卡怪刷新纪录，转头被卧底抄走了战法；隐藏的吸血鬼骑士格罗一苏醒，掉落的就是橙武吸血光剑。",
              c: "原著副本纪录线；卡怪流打法的成名地。"
            },
            {
              id: "yixian",
              n: "一线峡谷",
              x: 56,
              y: 24,
              t: "danger",
              d: 3,
              rg: "副本深处",
              aliases: ["峡谷", "影刀客"],
              desc: "三十到三十三级的峡谷副本，地形窄长，专治人多。叶修在这里带着一行人把抢BOSS的公会精英全数打落到掉级——副本可以刷，峡谷惹不得。",
              c: "原著公会对抗线；一线峡谷剿公会之战。"
            },
            {
              id: "kongzhong",
              n: "空中陵墓",
              x: 72,
              y: 38,
              t: "relic",
              d: 4,
              rg: "副本深处",
              aliases: ["陵墓", "神域副本"],
              desc: "神之领域的三大高级副本之一，悬在地图之上的层层陵寝。地面会在无声中错位，浮雕会转过背去——能够在这里稳定刷出纪录的，都是联盟俱乐部的技术部。",
              c: "原著神之领域副本设定；满级之后的资源区。"
            },
            {
              id: "xishan",
              n: "溪山城",
              x: 40,
              y: 70,
              t: "city",
              d: 2,
              rg: "神之领域",
              aliases: ["溪山", "蓝溪阁驻地"],
              desc: "神之领域的主城之一，名字里带一个「溪」字，被蓝溪阁选作了公会驻地。神域的公会可以占城、可以划地盘——前提是先有足够的实力和财力。",
              c: "原著公会驻地线；神之领域的城镇。"
            }
          ]
        },
        {
          id: "lianmeng",
          name: "联盟 · 主场城市",
          ico: "盟",
          hint: "二十支战队，二十座城——春去秋来的客场，和不肯让出的主场",
          decor: "city",
          regions: [
            { n: "北方主场", cx: 34, cy: 32, rx: 28, ry: 20, tr: "plain" },
            { n: "南方主场", cx: 70, cy: 62, rx: 24, ry: 22, tr: "city" }
          ],
          roads: [["bhome", "qhome"], ["qhome", "shome"], ["ghome", "shome"], ["bhome", "ghome"]],
          nodes: [
            {
              id: "bhome",
              n: "B市 · 三队同城",
              x: 22,
              y: 26,
              t: "city",
              d: 2,
              rg: "北方主场",
              aliases: ["B市", "微草", "皇风", "义斩"],
              desc: "微草、皇风、义斩三支战队同据京城。王杰希的魔术师从这里出发，B市办联赛也最舍得投入——三家抢的不是冠军，是这座城市的目光。",
              c: "原著战队版图；微草、皇风、义斩主场均在B市。"
            },
            {
              id: "qhome",
              n: "Q市 · 霸图",
              x: 46,
              y: 40,
              t: "arena",
              d: 2,
              rg: "北方主场",
              aliases: ["Q市", "霸气雄图"],
              desc: "霸气雄图的主场城市。韩文清一拳一拳打了十年没换过发型，Q市人便把整座城的气质按在了他们队长身上——硬，且不回头。",
              c: "原著战队版图；霸图主场Q市（青岛）。"
            },
            {
              id: "ghome",
              n: "G市 · 蓝雨",
              x: 58,
              y: 52,
              t: "arena",
              d: 2,
              rg: "南方主场",
              aliases: ["G市", "蓝溪阁", "蓝雨主场"],
              desc: "蓝雨战队与蓝溪阁公会的大本营在广州。喻文州的慢与黄少天的快、一个人的冷静与另一个人的废话，是这座城市最有反差的一对招牌。",
              c: "原著战队版图；蓝雨主场G市（广州）。"
            },
            {
              id: "shome",
              n: "S市 · 轮回",
              x: 84,
              y: 72,
              t: "arena",
              d: 3,
              rg: "南方主场",
              aliases: ["S市", "轮回"],
              desc: "轮回战队主场，两连冠从这里垒起。周泽楷话不多，可每次他抬枪的时候，整座城市的欢呼替他把话说完了。",
              c: "原著战队版图；轮回主场S市（上海）。"
            }
          ]
        }
      ]
    },
    /* ---------- 道诡异仙 ---------- */
    daoguiyixian: {
      name: "道诡异仙 · 行旅图鉴",
      flavor: "苦药与消毒水，哪个是真的",
      layers: [
        {
          id: "modern",
          name: "现代世界",
          ico: "医",
          hint: "白塔医院的走廊尽头，站着谁",
          decor: "city",
          regions: [{ n: "城市", cx: 50, cy: 50, rx: 42, ry: 32, tr: "city" }],
          roads: [["baita", "yangna"], ["baita", "paichusuo"], ["paichusuo", "kangling"]],
          nodes: [
            {
              id: "baita",
              n: "白塔医院",
              x: 46,
              y: 42,
              t: "start",
              d: 3,
              rg: "城市",
              aliases: ["白塔", "医院", "十三号病房", "精神病房"],
              desc: "消毒水、白炽灯、深夜查房的脚步。约束带解开又系上，走廊尽头的灯闪了三下——护士说那里没有站过人。",
              c: '原著现代线主场景；心素少年的"病房"。'
            },
            {
              id: "kangling",
              n: "康宁医院",
              x: 66,
              y: 66,
              t: "city",
              d: 3,
              rg: "城市",
              aliases: ["康宁"],
              desc: "另一家精神卫生中心，病友的家长在走廊里熬红了眼。这里的医生说的话，和白塔那边对不上。",
              c: "原著现代线医院之一。"
            },
            {
              id: "yangna",
              n: "杨娜的出租屋",
              x: 28,
              y: 64,
              t: "city",
              d: 1,
              rg: "城市",
              aliases: ["杨娜家", "出租屋"],
              desc: "三十平米的小屋，桌上温着一碗汤。她说你什么时候醒，她都等着——这句话比任何符咒都灵。",
              c: "原著现代线情感锚点。"
            },
            {
              id: "paichusuo",
              n: "派出所",
              x: 60,
              y: 34,
              t: "city",
              d: 2,
              rg: "城市",
              aliases: ["警局"],
              desc: "白炽灯下的笔录椅。母亲哭着问你到底看见了什么；民警递来的烟，一根接一根。",
              c: "原著现代线「妈，我分不清」名场面所在。"
            }
          ]
        },
        {
          id: "danuo",
          name: "大傩世界",
          ico: "傩",
          hint: "清风观的药炉，牛心村的香火",
          decor: "land",
          regions: [
            { n: "清风观地界", cx: 30, cy: 30, rx: 20, ry: 16, tr: "mountain" },
            { n: "牛心村", cx: 62, cy: 40, rx: 16, ry: 13, tr: "plain" },
            { n: "恒华山", cx: 37, cy: 72, rx: 15, ry: 13, tr: "mountain" },
            { n: "大梁", cx: 78, cy: 70, rx: 16, ry: 12, tr: "city" },
            { n: "酆都地界", cx: 16, cy: 58, rx: 11, ry: 22, tr: "void" },
            { id: "baiyujing_r", n: "白玉京 · 仙界", cx: 20, cy: 88, rx: 10, ry: 8, tr: "void" }
          ],
          roads: [["qingfeng", "niuxin"], ["niuxin", "baijia"], ["niuxin", "henghua"], ["henghua", "zhengde"], ["niuxin", "daliang"], ["daliang", "fengdu"], ["fengdu", "baiyujing"]],
          nodes: [
            {
              id: "qingfeng",
              n: "清风观",
              x: 30,
              y: 26,
              t: "sect",
              d: 4,
              rg: "清风观地界",
              aliases: ["清风", "道观"],
              desc: "药炉日夜不熄的道观。观主丹阳子说要拿你炼药，师兄们的笑里各有算计；门缝里那双眼睛，夜里总在。",
              c: "原著开篇主场景；药引囚居之地。"
            },
            {
              id: "niuxin",
              n: "牛心村",
              x: 62,
              y: 38,
              t: "city",
              d: 3,
              rg: "牛心村",
              aliases: ["白家村", "村子"],
              desc: "白莲香火最盛的村子。晒谷场、老槐树、祠堂的鼓——规矩比官府大，无生老母的经比盐金贵。",
              c: "原著白家与白莲教线主场景。"
            },
            {
              id: "baijia",
              n: "白家祠堂",
              x: 70,
              y: 50,
              t: "danger",
              d: 5,
              rg: "牛心村",
              aliases: ["祠堂", "白家"],
              desc: "地砖下传来响动。撬开是一间暗室：人柱林立，六匹陶瓷马正对着门口——白家惨案的中心，无生老母的祭坛。",
              c: "原著牛心村惨案核心地点。"
            },
            {
              id: "henghua",
              n: "恒华山·安慈庵",
              x: 30,
              y: 76,
              t: "sect",
              d: 3,
              rg: "恒华山",
              aliases: ["安慈庵", "恒华山"],
              desc: "静心师太清修的庵堂。夜里上山求救的人，有的下来了，有的没下来；庵里的钟，只在该响的时候响。",
              c: "原著恒华山安慈庵线。"
            },
            {
              id: "zhengde",
              n: "正德寺",
              x: 44,
              y: 68,
              t: "sect",
              d: 3,
              rg: "恒华山",
              aliases: ["正德"],
              desc: "香火尚可的宝刹。僧人慈眉，只是大殿里那尊佛像的肉，怎么看怎么不像泥塑的。",
              c: "原著正德寺线；血肉佛像所在。"
            },
            {
              id: "daliang",
              n: "大梁京城",
              x: 78,
              y: 68,
              t: "city",
              d: 3,
              rg: "大梁",
              aliases: ["大梁", "京城"],
              desc: "大梁的帝都。监天司的高墙、市井的杂耍、码头来的传闻——天子的脚底下，压着多少不该知道的事。",
              c: "原著大梁朝堂与监天司线。"
            },
            {
              id: "fengdu",
              n: "酆都",
              x: 12,
              y: 50,
              t: "danger",
              d: 5,
              rg: "酆都地界",
              aliases: ["鬼城", "黑暗洞窟"],
              desc: "传说中的鬼城，黑暗洞窟深不见底。活人进，死物出；这里的黑，比夜老得多。",
              c: "原著酆都黑暗洞窟篇。"
            },
            {
              id: "baiyujing",
              n: "白玉京",
              x: 20,
              y: 88,
              t: "relic",
              d: 5,
              rg: "白玉京 · 仙界",
              aliases: ["白玉京", "司命天庭"],
              desc: "天道与司命所在之地。凡人抬头看不见它，它低头却看得见每一个凡人——迷惘、生长、杀戮、死亡，各有其主。",
              c: "原著终局篇；司命与天道棋局。"
            }
          ]
        }
      ]
    },
    /* ---------- 重生之都市修仙 ---------- */
    zhongshengdushi: {
      name: "重生之都市修仙 · 行旅图鉴",
      flavor: "上一世登临宇宙之巅，这一世从高三开始",
      layers: [
        {
          id: "china",
          name: "华夏 · 都市篇",
          ico: "市",
          hint: "2007年前后的中国——超凡藏在市井褶皱里",
          decor: "city",
          regions: [
            { n: "楚州·泗水", cx: 27, cy: 74, rx: 14, ry: 11, tr: "plain" },
            { n: "江南·金陵", cx: 52, cy: 66, rx: 17, ry: 14, tr: "city" },
            { n: "江北", cx: 36, cy: 39, rx: 14, ry: 10, tr: "city" },
            { n: "燕京", cx: 75, cy: 38, rx: 15, ry: 12, tr: "city" },
            { n: "海东", cx: 86, cy: 62, rx: 12, ry: 10, tr: "city" },
            { id: "ditiequan", n: "地下拳场", cx: 40, cy: 82, rx: 11, ry: 8, tr: "city" },
            { id: "dongshan_r", n: "东山坪", cx: 52, cy: 44, rx: 12, ry: 9, tr: "mountain" }
          ],
          roads: [["sishui", "jiangbei"], ["sishui", "jinling"], ["jinling", "yanjing"], ["yanjing", "haidong"], ["jinling", "dongshan"], ["yanjing", "wangjiashan"]],
          nodes: [
            {
              id: "sishui",
              n: "泗水县",
              x: 20,
              y: 68,
              t: "start",
              d: 1,
              rg: "楚州·泗水",
              aliases: ["泗水", "楚州", "一中"],
              desc: "重生之地。泗水一中的晚自习、老街的面馆、锦绣集团初创的办公室——五百年修为与十七岁的课本，从这里重新开始。",
              c: "原著开场主场景；重生者的高三。"
            },
            {
              id: "jiangbei",
              n: "江北·招待所",
              x: 30,
              y: 34,
              t: "city",
              d: 1,
              rg: "江北",
              aliases: ["江北", "招待所"],
              desc: "吊扇吱呀的老招待所。前台叫阿秀的姑娘总会多打一壶热水——苦尽甘来的人，值得这世上所有的温柔。",
              c: "原著阿秀线主场景。"
            },
            {
              id: "jinling",
              n: "金陵",
              x: 46,
              y: 58,
              t: "city",
              d: 2,
              rg: "江南·金陵",
              aliases: ["南京", "明德集团", "金陵大学", "灯会"],
              desc: "六朝古都，商埠重地。明德集团的大厦、金陵大学的林荫道、秦淮河的灯会——白衣胜雪的少女在此回眸，命运的齿轮自此咬合。",
              c: "原著方琼线与商战线主场景。"
            },
            {
              id: "yanjing",
              n: "燕京",
              x: 70,
              y: 32,
              t: "city",
              d: 3,
              rg: "燕京",
              aliases: ["北京", "京城"],
              desc: "王家深宅所在的帝都。嫡系骄横、旁支谨慎，夺产的倾轧从不摆在台面上——直到有人把它摆上了燕京山。",
              c: "原著王家线主场景。"
            },
            {
              id: "wangjiashan",
              n: "燕京山",
              x: 80,
              y: 44,
              t: "danger",
              d: 4,
              rg: "燕京",
              aliases: ["燕京山"],
              desc: "王家年轻一代最优秀的王城陨落之地。一战之后，京城圈子里流传着一句话：别去惹那个人。",
              c: "原著斩王城名场面所在。"
            },
            {
              id: "haidong",
              n: "海东",
              x: 86,
              y: 60,
              t: "city",
              d: 2,
              rg: "海东",
              aliases: ["海东市"],
              desc: "海滨商埠，徐家的地盘。镁光灯下的娱乐圈浮浮沉沉，蓉妃师姐的笑，比镜头里累。",
              c: "原著许蓉妃线主场景。"
            },
            {
              id: "auction",
              n: "地下拍卖行",
              x: 58,
              y: 74,
              t: "arena",
              d: 3,
              rg: "江南·金陵",
              aliases: ["拍卖行", "夜拍"],
              desc: '只在深夜开槌的场子。压轴的"培元丹"出价到八位数时，满座豪客没人想过，有一双眼睛一眼看穿了成色。',
              c: "原著丹药夜拍线。"
            },
            {
              id: "arena",
              n: "地下拳场",
              x: 40,
              y: 82,
              t: "arena",
              d: 3,
              rg: "地下拳场",
              aliases: ["拳场", "铁笼"],
              desc: "铁笼、赌注、四十场不败的外劲好手。为筹钱走进来的人，要么站着出去，要么被抬出去。",
              c: "原著地下拳场线。"
            },
            {
              id: "dongshan",
              n: "东山坪",
              x: 52,
              y: 44,
              t: "sect",
              d: 4,
              rg: "东山坪",
              aliases: ["金城东山", "青龙大阵"],
              desc: "聚灵、引灵、迷雾、幻象、巨木齐备的超大型法阵所在——凡人看不见山里的仙家气象，北琼派的气象。",
              c: "原著青龙大阵与北琼道场线。"
            }
          ]
        },
        {
          id: "hidden",
          name: "隐秘世界",
          ico: "隐",
          hint: "昆仑档案之外——隐门、昆墟与海外术师",
          decor: "land",
          regions: [
            { n: "华国隐地", cx: 31, cy: 40, rx: 24, ry: 22, tr: "mountain" },
            { n: "昆墟界", cx: 74, cy: 36, rx: 17, ry: 15, tr: "water" },
            { n: "海外", cx: 70, cy: 76, rx: 22, ry: 13, tr: "void" }
          ],
          roads: [["kunlun", "yaoshengu"], ["kunlun", "hongmen"], ["hongmen", "guiwu"], ["kunxu", "lujia"], ["zuoxu", "aluo"]],
          nodes: [
            {
              id: "kunlun",
              n: "昆仑总部",
              x: 26,
              y: 30,
              t: "sect",
              d: 3,
              rg: "华国隐地",
              aliases: ["昆仑", "特殊部门"],
              desc: '华国特殊部门的心脏。档案里存着这个国家一切"不正常"的名字，叶擎苍的办公室灯火长明——守护者从不合眼。',
              c: "原著昆仑线主场景。"
            },
            {
              id: "hongmen",
              n: "洪门堂口",
              x: 44,
              y: 50,
              t: "city",
              d: 2,
              rg: "华国隐地",
              aliases: ["洪门"],
              desc: "老江湖的地界。堂口的规矩比法律老，香堂的牌位比合同重；林家兄弟的拳，在码头打出了名。",
              c: "原著洪门武道线。"
            },
            {
              id: "yaoshengu",
              n: "药神谷",
              x: 18,
              y: 56,
              t: "sect",
              d: 3,
              rg: "华国隐地",
              aliases: ["药神谷"],
              desc: "中古丹鼎派余脉的深谷。市面丹药一半出自此谷——药香深处，掌柜的不见外客。",
              c: "原著丹道线主场景。"
            },
            {
              id: "guiwu",
              n: "鬼巫教",
              x: 42,
              y: 24,
              t: "danger",
              d: 4,
              rg: "华国隐地",
              aliases: ["黑巫教", "鬼巫"],
              desc: "巫蛊咒法的老巢。血脉咒、驭鬼术，救人与杀人只隔一道血——动阴手的人，最好先想想代价。",
              c: "原著鬼巫教反派线。"
            },
            {
              id: "kunxu",
              n: "昆墟界",
              x: 74,
              y: 30,
              t: "wild",
              d: 4,
              rg: "昆墟界",
              aliases: ["昆墟"],
              desc: "冰封的另一方天地。灵气远胜地球，陆家深居其中；那位冰灵根的家主夫人，眉眼是治好之后才有的倾城。",
              c: "原著昆墟界篇主场景。"
            },
            {
              id: "lujia",
              n: "陆家",
              x: 84,
              y: 42,
              t: "sect",
              d: 3,
              rg: "昆墟界",
              aliases: ["陆家"],
              desc: "昆墟界执掌者之一。祖训、血脉、门楣——规矩压人，也护人。",
              c: "原著陆燕雪线主场景。"
            },
            {
              id: "zuoxu",
              n: "左须神社",
              x: 62,
              y: 78,
              t: "danger",
              d: 4,
              rg: "海外",
              aliases: ["神社", "日国", "伊势大神宫", "阴阳师"],
              desc: "日国神道的深处的阴翳。五鬼铃、式神、咒杀——海外术师的手，一次次伸过海来。",
              c: "原著日国阴阳师线。"
            },
            {
              id: "aluo",
              n: "阿罗敌佛教",
              x: 84,
              y: 78,
              t: "sect",
              d: 3,
              rg: "海外",
              aliases: ["阿罗敌"],
              desc: "东南亚的密教势力。转轮拳印的秘传拳术里，藏着不属于人间的力。",
              c: "原著东南亚密教线。"
            }
          ]
        },
        {
          id: "cosmos",
          name: "星空尽头",
          ico: "星",
          hint: "中央星河——真武仙宗与九大仙宗的尺度",
          decor: "cosmos",
          regions: [
            { n: "中央星河", cx: 44, cy: 42, rx: 26, ry: 20, tr: "void" },
            { n: "天荒·遗弃星域", cx: 77, cy: 72, rx: 15, ry: 14, tr: "void" }
          ],
          roads: [["zhenwu", "central"], ["central", "tianhuang"], ["tianhuang", "qingshan"]],
          nodes: [
            {
              id: "zhenwu",
              n: "真武仙宗",
              x: 34,
              y: 30,
              t: "sect",
              d: 5,
              rg: "中央星河",
              aliases: ["真武", "仙宗", "师门"],
              desc: "中央星河世界北域的斗战第一道统。苍青仙人座下真传的名字曾在此被抹去，又在五百年后被重新提起——北玄仙尊，回来了。",
              c: "原著师门线；前世因果的源头。"
            },
            {
              id: "central",
              n: "中央星河",
              x: 50,
              y: 44,
              t: "city",
              d: 4,
              rg: "中央星河",
              aliases: ["星河", "九大仙宗"],
              desc: "九大仙宗共治的宇宙中枢。真武、五行、羽化、大道……庞然大物的一念，便是星域的兴衰。",
              c: "原著九大仙宗格局。"
            },
            {
              id: "tianhuang",
              n: "天荒",
              x: 82,
              y: 62,
              t: "danger",
              d: 5,
              rg: "天荒·遗弃星域",
              aliases: ["天荒", "遗弃星域"],
              desc: "华族先民迁徙之地，遗弃星域的尽头。踏天神君的阴影压了万年——一掌落下的那天，万年债清了。",
              c: "原著天荒篇；踏天神君之战。"
            },
            {
              id: "qingshan",
              n: "青山星",
              x: 72,
              y: 82,
              t: "wild",
              d: 3,
              rg: "天荒·遗弃星域",
              aliases: ["青山"],
              desc: "星域边陲的修行星。凡俗与修士共处一星，烟火与仙气各安其位。",
              c: "原著后期星域图卷之一。"
            }
          ]
        }
      ]
    },
    /* ---------- 帝霸 ---------- */
    dibao: {
      name: "帝霸 · 行旅图鉴",
      flavor: "万古悠悠，帝路争渡",
      layers: [
        {
          id: "edge",
          name: "边荒 · 凡尘",
          ico: "边",
          hint: "牧笛声起的地方——一切大人物都从凡尘走出来",
          decor: "land",
          regions: [
            { n: "边荒牧野", cx: 30, cy: 34, rx: 20, ry: 15, tr: "plain" },
            { n: "古国边地", cx: 68, cy: 28, rx: 17, ry: 13, tr: "mountain" },
            { n: "边荒坊市", cx: 47, cy: 72, rx: 18, ry: 14, tr: "city" },
            { n: "旧战场", cx: 15, cy: 72, rx: 12, ry: 11, tr: "desert" }
          ],
          roads: [["cun", "fangshi"], ["fangshi", "bianjun"], ["fangshi", "kuang"], ["cun", "jiuzhan"]],
          nodes: [
            {
              id: "cun",
              n: "边荒牧村",
              x: 28,
              y: 32,
              t: "start",
              d: 1,
              rg: "边荒牧野",
              aliases: ["牧村", "村子", "边荒"],
              desc: "原著开篇之地：万古归来的存在以牧羊少年的皮囊在此出现。羊群、草坡与极远的山影——谁也想不到，这片牧野的宁静只是万古棋局落子前的深呼吸。",
              c: "原著开篇场景；万古棋局的起点。"
            },
            {
              id: "fangshi",
              n: "边荒坊市",
              x: 52,
              y: 64,
              t: "city",
              d: 2,
              rg: "边荒坊市",
              aliases: ["坊市", "集市"],
              desc: "边荒最热闹的地方：三教九流在此换酒换消息，散修用命换来的东西在这里标价。柜台后面的老掌柜，眼睛比谁都毒。",
              c: "原著修行经济线主场景。"
            },
            {
              id: "bianjun",
              n: "古国边戍",
              x: 74,
              y: 26,
              t: "city",
              d: 3,
              rg: "古国边地",
              aliases: ["边军", "戍堡", "边关"],
              desc: "古国边军的戍堡：烽燧、军规与刀口舔血的粮饷。老兵说山那边的东西不认军旗——他们见过，所以活下来的话都少。",
              c: "原著边军与古国线。"
            },
            {
              id: "kuang",
              n: "灵矿",
              x: 42,
              y: 80,
              t: "danger",
              d: 4,
              rg: "边荒坊市",
              aliases: ["矿洞", "矿场", "灵矿"],
              desc: "半开化的灵矿区：矿奴的手电光在黑暗里晃。越深处灵气越浓，传说也越邪——有人挖到过帝兵残片，有人挖到了不该挖的东西。",
              c: "原著资源与底层线；机缘与凶险同矿。"
            },
            {
              id: "jiuzhan",
              n: "上古城战场",
              x: 15,
              y: 70,
              t: "relic",
              d: 5,
              rg: "旧战场",
              aliases: ["古战场", "遗迹", "旧战场"],
              desc: '某个早已无载的大世留下的战场：锈蚀的兵器半埋在沙里，风一吹，呜呜地响。拾骨人在此讨生活——命大的发财，命小的成为下一件"遗物"。',
              c: "原著遗迹与拾骨线；纪元纵深的第一课。"
            }
          ]
        },
        {
          id: "heart",
          name: "中域 · 争渡",
          ico: "帝",
          hint: "大教世家皇朝古族共治的天下——规矩森严，资源即权柄",
          decor: "land",
          regions: [{ n: "域外", cx: 66, cy: 14, rx: 16, ry: 14, tr: "city" }, { n: "禁区边缘", cx: 34, cy: 16, rx: 16, ry: 14, tr: "city" }, 
            { n: "中域帝都", cx: 50, cy: 30, rx: 18, ry: 14, tr: "city" },
            { n: "大教山门地带", cx: 24, cy: 60, rx: 18, ry: 15, tr: "mountain" },
            { n: "世家古族之地", cx: 76, cy: 62, rx: 17, ry: 14, tr: "forest" },
            { n: "禁区", cx: 15, cy: 18, rx: 10, ry: 10, tr: "void" }
          ],
          roads: [["didu", "dajiao"], ["didu", "shijia"], ["dajiao", "guzu"], ["shijia", "guzu"], ["didu", "diling"], ["diling", "jinqu"], ["didu", "dilu"]],
          nodes: [
            {
              id: "didu",
              n: "中域帝都",
              x: 50,
              y: 30,
              t: "city",
              d: 3,
              rg: "中域帝都",
              aliases: ["帝都", "京城", "中域"],
              desc: "当代皇朝的京城：宫阙连云，仪仗如龙。天子的诏令从这里发往四方；朝堂之下，暗流比明面上的权力更深。",
              c: "原著皇朝线中枢。"
            },
            {
              id: "dajiao",
              n: "大教山门",
              x: 24,
              y: 58,
              t: "sect",
              d: 4,
              rg: "大教山门地带",
              aliases: ["大教", "山门"],
              desc: "传承无数岁月的大教：云海之上的宫阙、藏经阁的灯火、一脉相承的道统。收徒大典之日，长队能排出十里——大教给你一扇门，也要你的一生。",
              c: "原著大教体系主场景。"
            },
            {
              id: "shijia",
              n: "世家祖地",
              x: 74,
              y: 54,
              t: "sect",
              d: 4,
              rg: "世家古族之地",
              aliases: ["世家", "祖地"],
              desc: "帝裔世家的祖地：祠堂里的牌位比王朝的国祚更老。姓氏给你一扇门，也给你一群盯着你的眼睛。",
              c: "原著世家线主场景。"
            },
            {
              id: "guzu",
              n: "古族族地",
              x: 84,
              y: 72,
              t: "sect",
              d: 4,
              rg: "世家古族之地",
              aliases: ["古族", "族地"],
              desc: "从上一个大世活到今天的古族：族史漫漶，祖传之物各有来历。年轻人以为古族守旧——其实他们只是在等一个旧纪元的账期。",
              c: "原著古族线；纪元纵深的活证据。"
            },
            {
              id: "diling",
              n: "帝陵",
              x: 34,
              y: 16,
              t: "relic",
              d: 5,
              rg: "禁区边缘",
              aliases: ["帝陵", "帝藏"],
              desc: "大帝陨落后长眠之地：帝兵的余威仍在，禁制一层叠一层。夺宝者来了又去，绝大多数留在里面——活下来的那几个，改写了一个时代。",
              c: "原著帝藏线；富贵险中求的极致。"
            },
            {
              id: "jinqu",
              n: "禁区",
              x: 14,
              y: 18,
              t: "danger",
              d: 5,
              rg: "禁区",
              aliases: ["禁区", "绝地"],
              desc: "不可说之地：当地人提起时压低声音，地图上只画一团墨。进去的人十不还一，活着出来的，多半不再是人。禁区现异象，天下必有大事。",
              c: "原著禁区体系；世界级事件的伏笔所在。"
            },
            {
              id: "dilu",
              n: "帝路",
              x: 66,
              y: 14,
              t: "arena",
              d: 5,
              rg: "域外",
              aliases: ["帝路", "争渡"],
              desc: "万古以来天骄争渡的终极之途：一个大世里踏上此路的人千千万，登临绝巅者寥寥可数。帝路尽头是帝之位——荣耀、旧账与万古恩怨的总开关。",
              c: "原著帝路争渡总纲。"
            }
          ]
        }
      ]
    },
    /* ---------- 龙族 ---------- */
    longzu: {
      name: "龙族 · 行旅图鉴",
      flavor: "烫金信封里，装着另一个世界",
      layers: [
        {
          id: "surface",
          name: "表世界 · 都市",
          ico: "市",
          hint: "考试、地铁与便利店——普通人的世界安然运转",
          decor: "city",
          regions: [
            { n: "家乡城市", cx: 29, cy: 41, rx: 18, ry: 24, tr: "city" },
            { n: "芝加哥", cx: 72, cy: 30, rx: 15, ry: 12, tr: "city" },
            { n: "东亚都会", cx: 60, cy: 76, rx: 20, ry: 12, tr: "city" },
            { id: "dixia", n: "地下空间", cx: 18, cy: 62, rx: 11, ry: 9, tr: "city" }
          ],
          roads: [["jia", "xuexiao"], ["xuexiao", "ditie"], ["jia", "chuanshuo"], ["zhijiage", "xuexiao"], ["xuexiao", "dongya"]],
          nodes: [
            {
              id: "jia",
              n: "家 · 信箱",
              x: 26,
              y: 34,
              t: "start",
              d: 1,
              rg: "家乡城市",
              aliases: ["家", "出租屋", "信箱"],
              desc: "一切开始的地方：一封烫金的信躺在信箱里，落款是一个你没听说过的学院。妈妈说是诈骗，你觉得也是——但谁都没舍得扔。",
              c: "原著邀请函线；表世界的入口。"
            },
            {
              id: "xuexiao",
              n: "高三教室",
              x: 40,
              y: 48,
              t: "city",
              d: 1,
              rg: "家乡城市",
              aliases: ["学校", "教室", "高三"],
              desc: "倒计时牌、模拟考排名与晚自习的日光灯。有人在这里睡着，有人在这里醒着——醒来的人，看黑板的眼神不太一样了。",
              c: "原著衰仔日常线主场景。"
            },
            {
              id: "ditie",
              n: "末班地铁",
              x: 18,
              y: 62,
              t: "danger",
              d: 3,
              rg: "地下空间",
              aliases: ["地铁", "末班车"],
              desc: "深夜的末班车：车厢空得很规律。老乘客都知道别坐最后一节——上个月起，有位乘客每周三都来，从不刷卡，也从不走门。",
              c: "原著都市恐怖接口；表里重叠的高发地。"
            },
            {
              id: "chuanshuo",
              n: "都市传说现场",
              x: 34,
              y: 20,
              t: "relic",
              d: 3,
              rg: "家乡城市",
              aliases: ["传说", "现场", "论坛"],
              desc: "论坛置顶帖的坐标：失踪案、废弃医院、桥洞下的爪痕。博主来了又删帖，删了又来——有些流量的代价是命。",
              c: "原著都市传说线；表层与里层的天然接口。"
            },
            {
              id: "zhijiage",
              n: "芝加哥",
              x: 72,
              y: 28,
              t: "city",
              d: 2,
              rg: "芝加哥",
              aliases: ["芝加哥", "机场"],
              desc: "密歇根湖畔的 windy city：雪、摩天楼与深藏不露的老钱。出租车驶过第九街区时，司机忽然不再说话。",
              c: "原著学院所在城市。"
            },
            {
              id: "dongya",
              n: "东亚都会",
              x: 60,
              y: 78,
              t: "city",
              d: 2,
              rg: "东亚都会",
              aliases: ["东京", "上海", "东亚"],
              desc: "雨夜霓虹的东方都市：拉面店、游戏中心、祭典的老街。有人在这里过完了最亮的一个夏天——夏天的东西，总是留不住。",
              c: "原著东亚线主场景。"
            }
          ]
        },
        {
          id: "hidden",
          name: "里世界 · 学院与家族",
          ico: "隐",
          hint: "屠龙者的秩序——学分、简报、家规与锁着的档案室",
          decor: "land",
          regions: [
            { n: "卡塞尔学院", cx: 34, cy: 34, rx: 22, ry: 17, tr: "city" },
            { n: "屠龙者家族地界", cx: 76, cy: 32, rx: 17, ry: 13, tr: "mountain" },
            { n: "东亚家族联盟", cx: 67, cy: 74, rx: 16, ry: 13, tr: "forest" }
          ],
          roads: [["kasaier", "tushuguan"], ["kasaier", "zhixingbu"], ["kasaier", "sushe"], ["kasaier", "jiazu"], ["jiazu", "dongyaLM"], ["dongyaLM", "chaohui"]],
          nodes: [
            {
              id: "kasaier",
              n: "卡塞尔学院",
              x: 34,
              y: 32,
              t: "sect",
              d: 3,
              rg: "卡塞尔学院",
              aliases: ["卡塞尔", "学院", "学校"],
              desc: "芝加哥的屠龙者学院：哥特校舍、苛刻的学分制度与藏满秘密的地下设施。它给你归属，也随时可能把你填进任务名单。",
              c: "原著主场景；屠龙者的摇篮。"
            },
            {
              id: "tushuguan",
              n: "图书馆 · 档案室",
              x: 20,
              y: 44,
              t: "relic",
              d: 3,
              rg: "卡塞尔学院",
              aliases: ["图书馆", "档案室"],
              desc: "藏书百万卷的图书馆，地下档案室的某些门永远锁着。管钥匙的人说：档案比龙活得久——因为龙也会死，档案不会。",
              c: "原著黑幕线；秘辛的存放处。"
            },
            {
              id: "zhixingbu",
              n: "执行部",
              x: 46,
              y: 44,
              t: "arena",
              d: 4,
              rg: "卡塞尔学院",
              aliases: ["执行部", "任务部"],
              desc: "学院的任务执行机构：简报、代号、条款与生还率。老手都知道先看最后一栏——那一栏从不说谎。",
              c: "原著任务线核心机构。"
            },
            {
              id: "sushe",
              n: "宿舍楼",
              x: 30,
              y: 18,
              t: "city",
              d: 1,
              rg: "卡塞尔学院",
              aliases: ["宿舍", "寝室"],
              desc: "断网、泡面与卧谈会：室友是那种学籍拖了八年不毕业的老油条，门路比教授还野。夜谈里一半是荤话，一半是真的。",
              c: "原著同窗线主场景。"
            },
            {
              id: "jiazu",
              n: "屠龙者家族",
              x: 78,
              y: 30,
              t: "sect",
              d: 3,
              rg: "屠龙者家族地界",
              aliases: ["家族", "豪门"],
              desc: "欧洲豪门大族的深宅：血脉、家训与银器擦得发亮的餐桌。家族子弟从出生就被期待拿出漂亮的评级——宴会上的笑声，都是称量过的。",
              c: "原著家族线主场景。"
            },
            {
              id: "dongyaLM",
              n: "东亚家族联盟",
              x: 60,
              y: 68,
              t: "sect",
              d: 4,
              rg: "东亚家族联盟",
              aliases: ["东亚联盟", "古老家族"],
              desc: "古老而独立的东亚体系：祭典、家规、密室与老宅深处的秘密。其力量足以与学院分庭抗礼——合作、猜忌与博弈并存。",
              c: "原著东亚势力线。"
            },
            {
              id: "chaohui",
              n: "樱之祭典",
              x: 74,
              y: 80,
              t: "wild",
              d: 3,
              rg: "东亚家族联盟",
              aliases: ["祭典", "夏日祭"],
              desc: '夏天、拉面、游戏厅与烟花——那个夏天透明得像玻璃。多年后你会想起这一晚，想起有人对你说"下次再来"。',
              c: "原著东亚之夏线；最柔软也最锋利的篇章。"
            }
          ]
        },
        {
          id: "abyss",
          name: "沉睡之地",
          ico: "龙",
          hint: "诸王长眠之处——温度先降，声音先没",
          decor: "cosmos",
          regions: [
            { n: "极北冰川", cx: 26, cy: 26, rx: 16, ry: 13, tr: "void" },
            { n: "深海", cx: 62, cy: 30, rx: 17, ry: 13, tr: "water" },
            { n: "王座", cx: 84, cy: 60, rx: 12, ry: 12, tr: "void" }
          ],
          roads: [["bingchuan", "shenhai"], ["shenhai", "wangzuo"]],
          nodes: [
            {
              id: "bingchuan",
              n: "极北冰川",
              x: 26,
              y: 24,
              t: "danger",
              d: 5,
              rg: "极北冰川",
              aliases: ["冰川", "极北"],
              desc: "万年冰盖之下有心跳般的低频震动。科考队去了七支，回来一支——回来的那支，再也不吃生的东西了。",
              c: "原著龙类沉眠地之一。"
            },
            {
              id: "shenhai",
              n: "深海",
              x: 62,
              y: 28,
              t: "danger",
              d: 5,
              rg: "深海",
              aliases: ["深海", "海沟"],
              desc: "阳光到不了的地方，声呐会录到不该存在的歌。渔民说那片海上的雾有形状——像有什么东西趴在水下看天。",
              c: "原著龙王线；苏醒征兆的源头之一。"
            },
            {
              id: "wangzuo",
              n: "王座",
              x: 84,
              y: 58,
              t: "relic",
              d: 5,
              rg: "王座",
              aliases: ["王座", "黑王", "诸王"],
              desc: "位格最高的王沉眠之地：梦从那里扩散，渗进千万人的睡眠。诸王苏醒之日，便是人类文明的大劫——现在，它只是翻了个身。",
              c: "原著终局伏笔；终极事件所在。"
            }
          ]
        }
      ]
    },
    quanzhifashi: {
      name: "全职法师 · 行旅图鉴",
      flavor: "结界亮着的时候，谁都想不起外面是什么",
      layers: [
        {
          id: "city",
          name: "城内 · 结界之下",
          ico: "城",
          hint: "学校、月考与夜市——魔法是这个世界的基础设施",
          decor: "city",
          regions: [
            { n: "博城", cx: 26, cy: 41, rx: 19, ry: 22, tr: "city" },
            { n: "帝都", cx: 69, cy: 36, rx: 16, ry: 13, tr: "city" },
            { n: "南方都会", cx: 60, cy: 78, rx: 18, ry: 12, tr: "city" }
          ],
          roads: [["jia", "xuexiao"], ["xuexiao", "yeshi"], ["jia", "gongjiao"], ["didu", "xueyuan"], ["xueyuan", "nanfang"], ["yeshi", "jiejie"]],
          nodes: [
            {
              id: "jia",
              n: "家 · 老小区",
              x: 26,
              y: 34,
              t: "start",
              d: 1,
              rg: "博城",
              aliases: ["家", "老小区", "出租屋"],
              desc: "一切开始的地方：晾台上的校服、冰箱里的剩菜、老爹压在抽屉底的那点积蓄。觉醒通知就贴在楼道的公告栏里，你的名字排在第三行。",
              c: "玩家起点；都市烟火线的锚点。"
            },
            {
              id: "xuexiao",
              n: "魔法高中 · 测试台",
              x: 40,
              y: 48,
              t: "sect",
              d: 1,
              rg: "博城",
              aliases: ["学校", "高中", "测试台", "考场"],
              desc: "觉醒考核的测试台立在体育馆正中：掌心按上去，光亮不亮、亮成什么颜色，一整个夏天的心跳就停在那几秒里。",
              c: "原著觉醒线主场景；每位法师的起点。"
            },
            {
              id: "yeshi",
              n: "夜市 · 小卖部",
              x: 20,
              y: 60,
              t: "city",
              d: 2,
              rg: "博城",
              aliases: ["夜市", "小卖部", "小吃街"],
              desc: "收摊很晚的一条街：烤串的烟火气混着魔具摊的星光。摊主们都有个共识——凌晨三点警报响的时候，先收摊，再跑。",
              c: "都市烟火线；消息与兼职的集散地。"
            },
            {
              id: "gongjiao",
              n: "末班公交",
              x: 32,
              y: 22,
              t: "danger",
              d: 3,
              rg: "博城",
              aliases: ["公交", "末班车", "公交车"],
              desc: "末班公交的路线贴着结界内沿走。老乘客都知道靠结界那侧的座位夏天也凉——上个月起，有位乘客每周三都上车，从不刷卡，影子却比人多一条。",
              c: "都市怪谈接口；表里重叠的高发地。"
            },
            {
              id: "didu",
              n: "帝都",
              x: 72,
              y: 28,
              t: "city",
              d: 2,
              rg: "帝都",
              aliases: ["帝都", "首都", "火车站"],
              desc: "魔法协会总部与最高学府所在的巨城：法阵供电的霓虹、飞行执照的考试队、以及协会大楼顶层永不熄灯的会议室。",
              c: "原著中后期主舞台；权力与秩序的中心。"
            },
            {
              id: "xueyuan",
              n: "帝都魔法学院",
              x: 66,
              y: 44,
              t: "sect",
              d: 2,
              rg: "帝都",
              aliases: ["学院", "魔法学院", "高等学府", "圣诺"],
              desc: "法阵穹顶罩着整片校区：新生分系测试的长队、训练场上炸开的元素光、图书馆顶层只对高阶法师开放的禁书区。从这里毕业的人，名字会进协会的名册。",
              c: "原著学院线主场景；法师成长与势力交汇地。"
            },
            {
              id: "jiejie",
              n: "结界内沿 · 警戒线",
              x: 12,
              y: 52,
              t: "danger",
              d: 3,
              rg: "博城",
              aliases: ["内沿", "警戒线", "墙根", "边界"],
              desc: "博城墙内最后一排路灯的尽头：巡逻队的探照灯每隔一刻钟扫过一遍，光带之外的荒野黑得像没画完的地图。墙上贴着猎者公会的悬赏，风吹得哗哗响。",
              c: "城内通往城外的咽喉；怪谈与猎者线的接口。"
            },
            {
              id: "nanfang",
              n: "南方都会",
              x: 60,
              y: 78,
              t: "city",
              d: 2,
              rg: "南方都会",
              aliases: ["南方", "南城", "海城"],
              desc: "湿热的海风与通宵的大排档：这里的猎者公会分部挂着全大陆最高的悬赏完成率——和最长的阵亡名单。",
              c: "原著南部线；猎者生态最浓的城市。"
            }
          ]
        },
        {
          id: "wild",
          name: "城外 · 荒野猎场",
          ico: "野",
          hint: "结界之外——猎者的战场，悬赏单的背面",
          decor: "land",
          regions: [
            { n: "博城郊野", cx: 30, cy: 34, rx: 18, ry: 14, tr: "forest" },
            { n: "魔物山脉", cx: 66, cy: 44, rx: 20, ry: 15, tr: "mountain" },
            { n: "古战场遗迹", cx: 81, cy: 70, rx: 15, ry: 12, tr: "desert" }
          ],
          roads: [["jiejiexi", "shandi"], ["shandi", "yiji"], ["yiji", "jingqu"]],
          nodes: [
            {
              id: "jiejiexi",
              n: "城西结界线",
              x: 24,
              y: 40,
              t: "arena",
              d: 3,
              rg: "博城郊野",
              aliases: ["结界", "城西", "结界线"],
              desc: "泛着微光的界壁下是巡逻队的岗亭。裂缝每月都修，每月都新添——守夜的老队员说，结界挡得住魔物，挡不住好奇心。",
              c: "城内与荒野的交界；灾变预警的第一线。"
            },
            {
              id: "shandi",
              n: "魔物山脉",
              x: 64,
              y: 44,
              t: "danger",
              d: 4,
              rg: "魔物山脉",
              aliases: ["山脉", "猎场", "深山"],
              desc: "悬赏单上出现频率最高的地名：岩甲魔、风行狼群、以及山顶那只没人敢接单的大家伙。猎者说山里的雾会走——跟着雾走，就回不来了。",
              c: "猎者任务线主战场。"
            },
            {
              id: "yiji",
              n: "废弃古城",
              x: 76,
              y: 74,
              t: "relic",
              d: 4,
              rg: "古战场遗迹",
              aliases: ["古城", "遗迹", "废墟"],
              desc: "地图上没有名字的城：考古队来过，勘探队来过，都没再来过。断墙上的抓痕比人高——那是从里面挠的。",
              c: "古老存在线；秘辛与机缘并存。"
            },
            {
              id: "jingqu",
              n: "协会禁区",
              x: 86,
              y: 64,
              t: "sect",
              d: 5,
              rg: "古战场遗迹",
              aliases: ["禁区", "协会禁区", "封禁区"],
              desc: "魔法协会拉了三道警戒线的区域：进去要签的文件比阵亡抚恤条款还厚。据说地下封着的东西，比城墙外的所有魔物加起来都老。",
              c: "协会黑幕线；封印与真相。"
            }
          ]
        },
        {
          id: "dark",
          name: "暗面 · 黑教廷之地",
          ico: "暗",
          hint: "潜伏的教团——他们从不白天露脸",
          decor: "cosmos",
          regions: [
            { n: "黑教廷暗区", cx: 34, cy: 30, rx: 17, ry: 13, tr: "void" },
            { n: "灾变遗址", cx: 66, cy: 32, rx: 16, ry: 12, tr: "desert" },
            { n: "祭坛", cx: 82, cy: 62, rx: 12, ry: 11, tr: "void" }
          ],
          roads: [["didian", "yizhi"], ["yizhi", "jitan"]],
          nodes: [
            {
              id: "didian",
              n: "黑教廷据点",
              x: 34,
              y: 28,
              t: "danger",
              d: 5,
              rg: "黑教廷暗区",
              aliases: ["据点", "黑袍", "教廷"],
              desc: "城中最普通的仓库地下室：白天的租约挂在一家物流公司名下，夜里 chant 的声音隔着三层隔音棉。他们信的东西没有名字——因为名字会招来审判。",
              c: "原著反派线；阴谋的策源地。"
            },
            {
              id: "yizhi",
              n: "灾变遗址",
              x: 66,
              y: 30,
              t: "relic",
              d: 4,
              rg: "灾变遗址",
              aliases: ["遗址", "灾变", "废城"],
              desc: "某次大灾变后废弃的城区：时钟停在劫难发生的那一刻，协会的封锁线绕着它画了一个圈。幸存者说那晚先看见的是紫色的光。",
              c: "原著灾变线；黑教廷阴谋的现场。"
            },
            {
              id: "jitan",
              n: "献祭祭坛",
              x: 82,
              y: 60,
              t: "danger",
              d: 5,
              rg: "祭坛",
              aliases: ["祭坛", "祭台", "黑祭"],
              desc: '荒野深处的不规则石阵：走近了会先听见自己的心跳，再听见别的。教廷的信徒管这里叫"门"——门的那边是什么，回来的人都不肯说。',
              c: "原著终局级伏笔；大事件所在。"
            }
          ]
        }
      ]
    },
    /* ---------- 黎明之剑 ---------- */
    limingzhijian: {
      name: "黎明之剑 · 行旅图鉴",
      flavor: "魔灯一盏盏亮起来的时候，没人记得油灯的味道了",
      layers: [
        {
          id: "cecil",
          name: "塞西尔领 · 黎明工地",
          ico: "厂",
          hint: "魔导革命的发源地——工坊、学堂与铁路一寸寸生长",
          decor: "city",
          regions: [
            { n: "塞西尔主城", cx: 36, cy: 38, rx: 20, ry: 15, tr: "city" },
            { n: "领地村野", cx: 66, cy: 70, rx: 20, ry: 14, tr: "plain" },
            { n: "南境边陲", cx: 14, cy: 66, rx: 13, ry: 12, tr: "forest" }
          ],
          roads: [["lingzhufu", "gongfang"], ["lingzhufu", "xuetang"], ["gongfang", "yimin"], ["xuetang", "tielu"], ["tielu", "shaoxian"]],
          nodes: [
            {
              id: "lingzhufu",
              n: "领主府 · 先祖工坊",
              x: 34,
              y: 34,
              t: "start",
              d: 1,
              rg: "塞西尔主城",
              aliases: ["领主府", "先祖", "工坊", "府邸"],
              desc: "千年前的传奇英雄在自家棺椁里醒来，如今这座府邸的地窖里堆满图纸与魔导机件。领民说先祖大人夜夜不眠——没人知道他其实是在给新发明起怪名字。",
              c: "原著主线起点；高文·塞西尔的居所。"
            },
            {
              id: "gongfang",
              n: "魔导工坊区",
              x: 48,
              y: 48,
              t: "sect",
              d: 1,
              rg: "塞西尔主城",
              aliases: ["工坊", "工坊区", "魔导工坊", "厂区"],
              desc: '符文阵列在这里被拆成可计算的工程：学徒描线、匠人装配、蒸汽机试车的白汽混着魔力辉光。墙上的标语是领主亲笔——"量产比独门更重要"。',
              c: "原著魔导工业线主场景；瑞贝卡的实验场。"
            },
            {
              id: "xuetang",
              n: "学堂街",
              x: 22,
              y: 46,
              t: "city",
              d: 1,
              rg: "塞西尔主城",
              aliases: ["学堂", "学校", "教室", "新学"],
              desc: '识字、算术与符文原理：移民的娃娃们趴在崭新的课桌上，读的是上个月才印出来的课本。老农民路过时总要多看两眼——他们这辈子头一回见"字"能当饭吃。',
              c: "原著教育线；新市民的成长通道。"
            },
            {
              id: "yimin",
              n: "移民村",
              x: 64,
              y: 66,
              t: "city",
              d: 2,
              rg: "领地村野",
              aliases: ["移民村", "垦荒村", "村", "村子"],
              desc: "全大陆的人都在往南境涌：逃荒的、避债的、想学手艺的。村里一天一个样——新犁、新邻居、新的口音，唯一不变的是村口那张招工布告，纸边都翻卷了。",
              c: "原著拓荒线；玩家生计的自然入口。"
            },
            {
              id: "tielu",
              n: "铁路工地",
              x: 50,
              y: 76,
              t: "arena",
              d: 2,
              rg: "领地村野",
              aliases: ["铁路", "工地", "路基", "铁轨"],
              desc: "魔能列车的路基一里里往北铺：夯土的号子、测量仪的星光、以及工头那本越记越厚的工钱账。老人说疯了——用铁铺路；年轻人不说话，闷头领工钱。",
              c: "原著动脉工程；时代红利的具象。"
            },
            {
              id: "shaoxian",
              n: "南境哨线",
              x: 16,
              y: 64,
              t: "danger",
              d: 3,
              rg: "南境边陲",
              aliases: ["哨线", "哨塔", "边境", "边陲"],
              desc: "领地最外沿的一串哨塔：新式探照灯的光柱缓缓扫过树线，换岗的新兵磨着新操典。边境的夜偶尔有不该有的动静——哨兵的规矩是：先点灯，再报告。",
              c: "原著边防线；领外危机的第一现场。"
            }
          ]
        },
        {
          id: "continent",
          name: "洛伦大陆 · 列国棋盘",
          ico: "陆",
          hint: "安苏与提丰的旧账，圣光与王权的暗战，全大陆都在看南境",
          decor: "land",
          regions: [
            { n: "安苏王国", cx: 35, cy: 38, rx: 20, ry: 15, tr: "plain" },
            { n: "提丰帝国", cx: 72, cy: 34, rx: 19, ry: 14, tr: "mountain" },
            { n: "圣灵平原", cx: 58, cy: 78, rx: 17, ry: 12, tr: "forest" }
          ],
          roads: [["shengsunier", "jiaoqu"], ["shengsunier", "tifengbian"], ["tifengbian", "shengling"]],
          nodes: [
            {
              id: "shengsunier",
              n: "圣苏尼尔",
              x: 30,
              y: 30,
              t: "city",
              d: 2,
              rg: "安苏王国",
              aliases: ["圣苏尼尔", "王都", "安苏", "帝都"],
              desc: "安苏的王都：深宫里坐着体弱多病的国王，权臣与宗室围着继承问题转圈。旧贵族在沙龙里嘲笑南境的暴发户——笑归笑，家里的魔灯一盏没少买。",
              c: "原著安苏政局线中枢。"
            },
            {
              id: "jiaoqu",
              n: "教区大教堂",
              x: 40,
              y: 46,
              t: "sect",
              d: 2,
              rg: "安苏王国",
              aliases: ["教堂", "教区", "大教堂", "圣光教会"],
              desc: "圣光教会的心脏之一：彩窗、圣歌与政治。基层牧师真心行善，上层把信仰当筹码——印刷术让人人都读得起经文了，这件事本身就让某些人睡不着。",
              c: "原著教会线；神权暗战的现场。"
            },
            {
              id: "tifengbian",
              n: "提丰边境",
              x: 68,
              y: 40,
              t: "arena",
              d: 3,
              rg: "提丰帝国",
              aliases: ["提丰", "边境", "帝国"],
              desc: "旧强权的国境线：帝国铁骑的军列昼夜不停，皇帝罗塞塔把帝国当棋盘下了几十年。提丰的近代化比谁都快也比谁都狠——见过那边工厂的人，回不去旧生活了。",
              c: "原著提丰线；竞合并存的老邻居。"
            },
            {
              id: "shengling",
              n: "圣灵平原",
              x: 58,
              y: 78,
              t: "wild",
              d: 4,
              rg: "圣灵平原",
              aliases: ["圣灵", "平原", "朝圣"],
              desc: "圣灵长眠的圣地：朝圣者的一生所愿、列国默契的禁区。平原的风比别处安静，安静得像有什么在听——这里的事，中前期只露一角，谁也别问太深。",
              c: "原著深水区伏笔；禁忌与真相的接口。"
            }
          ]
        },
        {
          id: "wasteland",
          name: "废土 · 旧纪元残响",
          ico: "墟",
          hint: "刚铎的坟场——风里有锈，锈里有不该亮着的灯",
          decor: "cosmos",
          regions: [
            { n: "废土外缘", cx: 34, cy: 36, rx: 18, ry: 14, tr: "desert" },
            { n: "刚铎遗迹群", cx: 76, cy: 67, rx: 20, ry: 15, tr: "void" }
          ],
          roads: [["bianyuanshiji", "yiji2"], ["yiji2", "shenmo"]],
          nodes: [
            {
              id: "bianyuanshiji",
              n: "边缘市集",
              x: 30,
              y: 34,
              t: "city",
              d: 3,
              rg: "废土外缘",
              aliases: ["市集", "边缘", "废土市集", "拾荒"],
              desc: "废土风与文明世界的交割处：拾荒人卸下旧纪元的零件换酒钱，向导的价目表按深入程度标价，黑市商人什么都收——就是不问来路。",
              c: "废土线的自然入口；玩家接活的码头。"
            },
            {
              id: "yiji2",
              n: "刚铎遗迹",
              x: 70,
              y: 58,
              t: "relic",
              d: 5,
              rg: "刚铎遗迹群",
              aliases: ["遗迹", "刚铎", "废墟", "旧纪元"],
              desc: "七百年前魔潮吞噬的帝国残骸：失效的符文阵列仍偶尔亮起，自动机械守卫还在巡逻一片无人的城。每一件刚铎遗物都可能改写魔导技术的进程——每一件也都可能改写你的墓志铭。",
              c: "原著遗产线；宝藏与坟墓的混合体。"
            },
            {
              id: "shenmo",
              n: "静默深区",
              x: 82,
              y: 76,
              t: "danger",
              d: 5,
              rg: "刚铎遗迹群",
              aliases: ["深区", "静默", "深处", "禁地"],
              desc: "连拾荒人的传说都绕着走的地带：仪器进去就失灵，风停得像被掐断。偶尔有光在废墟深处亮起——不是人点的，也不像是给活人看的。",
              c: "原著真相线；魔潮倒计时的核心谜团。"
            }
          ]
        }
      ]
    },
    /* ---------- 轮回乐园 ---------- */
    lunhuileyuan: {
      name: "轮回乐园 · 行旅图鉴",
      flavor: "任务简报没有废话，死人的名字也不上榜",
      layers: [
        {
          id: "paradise",
          name: "乐园空间 · 契约者之家",
          ico: "园",
          hint: "任务之间的休整地——兑换、训练、交易与那些没回来的人",
          decor: "city",
          regions: [
            { n: "居住区", cx: 30, cy: 36, rx: 18, ry: 14, tr: "city" },
            { n: "交易区", cx: 77, cy: 39, rx: 20, ry: 14, tr: "city" },
            { n: "训练区", cx: 52, cy: 76, rx: 20, ry: 13, tr: "plain" }
          ],
          roads: [["gongyu", "duihuan"], ["gongyu", "xunlian"], ["duihuan", "jiaoyi"], ["jiaoyi", "xuanshang"], ["xunlian", "qianghua"]],
          nodes: [
            {
              id: "gongyu",
              n: "契约者公寓",
              x: 28,
              y: 34,
              t: "start",
              d: 1,
              rg: "居住区",
              aliases: ["公寓", "住处", "房间", "家"],
              desc: "乐园分配的私人空间：门锁认契约者的血液，屋里陈设简陋得像审讯室。墙上没有窗——反正窗外也没有风景，只有下一场任务。",
              c: "玩家起点；任务间隙的唯一退路。"
            },
            {
              id: "duihuan",
              n: "兑换商店",
              x: 44,
              y: 42,
              t: "sect",
              d: 2,
              rg: "居住区",
              aliases: ["商店", "兑换", "乐园商店", "便利店"],
              desc: "乐园直营的兑换界面：药剂、装备、图纸与情报，明码标价，概不还价。定价偶尔坑爹得像恶作剧——但没人敢投诉，因为投诉渠道不存在。",
              c: "原著经济线；乐园币的去处之一。"
            },
            {
              id: "jiaoyi",
              n: "交易区",
              x: 70,
              y: 32,
              t: "city",
              d: 2,
              rg: "交易区",
              aliases: ["交易", "市集", "黑市", "摆摊"],
              desc: "契约者之间的灰色生态：倒卖缴获、交换情报、组队拼单、发布私人委托。上周还跟你拼团买药剂的那个人，摊位今天空着——没人提，摊位第二天就有人顶上。",
              c: "原著交易区生态；情报与人情的中转站。"
            },
            {
              id: "xuanshang",
              n: "悬赏榜",
              x: 84,
              y: 46,
              t: "danger",
              d: 3,
              rg: "交易区",
              aliases: ["悬赏", "悬赏榜", "名单", "猎杀名单"],
              desc: "交易区最亮的一块石碑：每天有新名字刻上去，旧名字偶尔被划掉——被划掉的意思，写在石碑背面，没人想去看第二遍。",
              c: "猎杀线；契约者互相标价的黑暗面。"
            },
            {
              id: "xunlian",
              n: "训练场",
              x: 48,
              y: 76,
              t: "arena",
              d: 2,
              rg: "训练区",
              aliases: ["训练", "训练场", "练习", "靶场"],
              desc: "药剂喂出来的属性要在这里打磨成肌肉记忆：靶场、对练场与那些练废了的新人。老手都懂——乐园给的东西是贷款，训练场是把贷款变成本钱的地方。",
              c: "原著成长线；苦修与实战的中介。"
            },
            {
              id: "qianghua",
              n: "强化仓",
              x: 64,
              y: 80,
              t: "sect",
              d: 3,
              rg: "训练区",
              aliases: ["强化", "强化仓", "仓", "维护"],
              desc: "冷光蓝白的胶囊舱体：躺进去，属性点的分配、装备的强化与身体的调校一气呵成。舱门关上前没人说话——出来后的账单，才是真正的窒息时刻。",
              c: "原著强化线；乐园币的另一大去处。"
            }
          ]
        },
        {
          id: "derivative",
          name: "衍生世界 · 无限战场",
          ico: "衍",
          hint: "熟悉的动漫世界，陌生的死亡规则——完成即生，失败即真死",
          decor: "land",
          regions: [
            { n: "忍者世界", cx: 27, cy: 39, rx: 19, ry: 14, tr: "forest" },
            { n: "伟大航路", cx: 72, cy: 34, rx: 19, ry: 14, tr: "water" },
            { n: "尸魂界", cx: 58, cy: 79, rx: 17, ry: 13, tr: "mountain" }
          ],
          roads: [["rujie", "kaohe"], ["kaohe", "weituo"], ["hanglu", "weiling"], ["weiling", "liesha"]],
          nodes: [
            {
              id: "rujie",
              n: "入界点",
              x: 26,
              y: 30,
              t: "start",
              d: 2,
              rg: "忍者世界",
              aliases: ["入界", "投放点", "落点", "传送"],
              desc: '任务简报念完的最后一句"祝你好运"之后，你睁开眼的地方：一座陌生的村落、一条陌生的街、一个即将被原著剧情碾过的时代。先别急着感慨——先确认撤离条件。',
              c: "衍生世界通用入口；新任务的开局锚点。"
            },
            {
              id: "kaohe",
              n: "考核场",
              x: 38,
              y: 44,
              t: "arena",
              d: 3,
              rg: "忍者世界",
              aliases: ["考核", "考核场", "测试", "演习场"],
              desc: "原著经典节点之一：下忍考核的残酷筛选在眼前原样上演。忍术的结印有节奏，血继限界是压倒性的存在——新人遇到上忍级别的冲突，跑就是最优解。",
              c: "原著首个衍生世界线；新人试炼场。"
            },
            {
              id: "weituo",
              n: "任务委托所",
              x: 16,
              y: 48,
              t: "city",
              d: 2,
              rg: "忍者世界",
              aliases: ["委托", "委托所", "任务板", "事务所"],
              desc: "原著世界的原生规则照常运转：委托板上贴着当地人的生计，你的任务简报藏在其中。接本地委托攒资源、混脸熟、探情报——原著剧情是大树，新人在树荫下找活路。",
              c: "衍生世界生计线；借势与伪装的支点。"
            },
            {
              id: "hanglu",
              n: "航路港口",
              x: 72,
              y: 30,
              t: "city",
              d: 2,
              rg: "伟大航路",
              aliases: ["港口", "航路", "码头", "海岛"],
              desc: "伟大航路的岛屿串起任务链：海军与海贼的夹缝里藏着生路，恶魔果实是重宝也是招祸的招牌。上了船记得先弄清两件事——船长的立场，和你自己的退路。",
              c: "原著衍生世界之一；海贼线锚点。"
            },
            {
              id: "weiling",
              n: "外围据点",
              x: 50,
              y: 74,
              t: "relic",
              d: 3,
              rg: "尸魂界",
              aliases: ["据点", "外围", "哨站", "流魂街"],
              desc: "力量体系森严的世界的边缘地带：本地强者一个眼神就能压死低阶契约者。在这里，规则内的伪装比武器重要——活人，才能等到撤离时限。",
              c: "原著衍生世界之一；高碾压位面代表。"
            },
            {
              id: "liesha",
              n: "猎杀阴影",
              x: 66,
              y: 84,
              t: "danger",
              d: 4,
              rg: "尸魂界",
              aliases: ["猎杀", "阴影", "伏击", "跟踪"],
              desc: "同场契约者的威胁从不宣战：一个多看了你装备两眼的家伙、一条只有你们两个人知道的巷子。被盯上的契约者，最好的结果是察觉早、跑得快——第二好的没有。",
              c: "契约者互猎线；无限流的真正底色。"
            }
          ]
        },
        {
          id: "abyss",
          name: "敌对乐园 · 暗流",
          ico: "戮",
          hint: "死亡与绝望在轮回之外窥伺——乐园之间的战争从不宣战",
          decor: "cosmos",
          regions: [
            { n: "死亡乐园暗区", cx: 32, cy: 39, rx: 19, ry: 14, tr: "void" },
            { n: "绝望乐园", cx: 70, cy: 36, rx: 18, ry: 13, tr: "void" },
            { n: "乐园深处", cx: 52, cy: 76, rx: 16, ry: 13, tr: "void" }
          ],
          roads: [["chuxinglie", "shashenchang"], ["shashenchang", "juewang"], ["juewang", "shenchu"]],
          nodes: [
            {
              id: "chuxinglie",
              n: "处刑者猎场",
              x: 28,
              y: 30,
              t: "danger",
              d: 5,
              rg: "死亡乐园暗区",
              aliases: ["处刑者", "猎场", "死亡乐园"],
              desc: "死亡乐园的对位契约者出没的死局：同样冷酷、同样致命、与猎杀者是天生的死敌。身份暴露的瞬间就是动手的倒计时——处刑者不宣战、不废话，出手就是杀招。",
              c: "原著敌对乐园线；位面战争的刀锋。"
            },
            {
              id: "shashenchang",
              n: "猎杀者战场",
              x: 36,
              y: 48,
              t: "arena",
              d: 5,
              rg: "死亡乐园暗区",
              aliases: ["猎杀者", "战场", "苏晓", "猎杀"],
              desc: "猎杀者以同侪为猎物的猎场：每猎杀一人可夺取对方的随机技能或装备。他们精于算计、讲究效率、绝不做亏本的猎杀——这片战场最锋利的那把刀，姓苏。",
              c: "原著猎杀线；主角所在的黑暗生态。"
            },
            {
              id: "juewang",
              n: "绝望乐园",
              x: 70,
              y: 34,
              t: "danger",
              d: 5,
              rg: "绝望乐园",
              aliases: ["绝望", "绝望乐园", "疯狂者"],
              desc: "比死亡更疯狂的存在：来自绝望乐园的契约者行事没有底线可讲。遭遇即是死亡游戏的开局——谈判？可以谈，谈完再动手的都算有礼貌。",
              c: "原著深水区；更黑暗的位面势力。"
            },
            {
              id: "shenchu",
              n: "乐园深处",
              x: 52,
              y: 78,
              t: "relic",
              d: 5,
              rg: "乐园深处",
              aliases: ["深处", "乐园深处", "秘密", "禁忌"],
              desc: "交易区传说里才有的地方：乐园意志的栖所。它给任务、给奖励，也从不多解释一个字。想知道答案的契约者很多——他们的问题都留在了问题里。",
              c: "原著终极悬念；中前期只给征兆。"
            }
          ]
        }
      ]
    },
    /* ---------- 武炼巅峰 ---------- */
    wulianfengdian: {
      name: "武炼巅峰 · 行旅图鉴",
      flavor: "武之巅峰，是孤独，是寂寞，是漫漫求索",
      layers: [
        {
          id: "dahan",
          name: "大汉王朝 · 武路起点",
          ico: "汉",
          hint: "凌霄阁的扫帚声与中都的八大家——亿万武者挤在同一条起步路上",
          decor: "land",
          regions: [
            { n: "凌霄山脉", cx: 35, cy: 36, rx: 20, ry: 15, tr: "mountain" },
            { n: "中都地界", cx: 69, cy: 39, rx: 19, ry: 15, tr: "plain" },
            { n: "玄铁矿区", cx: 50, cy: 76, rx: 18, ry: 13, tr: "desert" },
            { id: "hengluoshang", n: "恒罗商路", cx: 60, cy: 56, rx: 12, ry: 9, tr: "plain" }
          ],
          roads: [["lingxiage", "fangshi"], ["fangshi", "zhongdu"], ["lingxiage", "xuantie"], ["fangshi", "hengluo"]],
          nodes: [
            {
              id: "lingxiage",
              n: "凌霄阁",
              x: 24,
              y: 30,
              t: "sect",
              d: 2,
              rg: "凌霄山脉",
              aliases: ["凌霄", "山门", "宗门", "凌霄阁山门"],
              desc: "大汉王朝地界的宗门，规矩立得比山门还硬：挑战制——同门争位递战书，演武台上生死自负。杂役院子里有个扫地的少年，扫了三年，没人多看他一眼。",
              c: "原著开篇「凌霄阁」线；杨开扫地起步之地。"
            },
            {
              id: "yanwu",
              n: "外门演武场",
              x: 34,
              y: 42,
              t: "arena",
              d: 3,
              rg: "凌霄山脉",
              aliases: ["演武场", "挑战台", "擂台", "演武"],
              desc: "青石铺就的场子，四角立着刻名的石碑——碑上的名字换得比季节还快。递战书在这里，了恩怨也在这里；台下看热闹的，多半在掂量自己还差几层。",
              c: "宗门挑战制落点；玩家递出第一封战书的地方。"
            },
            {
              id: "fangshi",
              n: "凌霄坊市",
              x: 46,
              y: 40,
              t: "city",
              d: 2,
              rg: "凌霄山脉",
              aliases: ["坊市", "集市", "市集", "凌霄城"],
              desc: "山门下自发长出来的市镇：丹药铺子、功法残卷、兵器行、灵石柜面，吆喝声里一半是买卖一半是消息。行情比山里的天气变得还快——昨天还抢手的丹炉，今天就无人问津。",
              c: "资源与情报集散地；坊市传闻的来源。"
            },
            {
              id: "zhongdu",
              n: "中都",
              x: 78,
              y: 32,
              t: "city",
              d: 3,
              rg: "中都地界",
              aliases: ["中都城", "京城", "都城", "八大家"],
              desc: "大汉王朝的心脏，八大家的棋盘：杨、秋、霍、孟、柳、康、高、叶——每一家的门楣都比普通宗门的山门高。街上随便撞个人都可能是哪家管事，说话前先看清腰牌。",
              c: "原著「中都」线；八大家博弈的舞台。"
            },
            {
              id: "hengluo",
              n: "恒罗商会",
              x: 60,
              y: 56,
              t: "city",
              d: 2,
              rg: "恒罗商路",
              aliases: ["恒罗", "商会", "商队", "恒罗商队"],
              desc: "做的是天下人的买卖：灵药、矿料、消息、人情，明码标价也暗中计息。商路的尽头没有它不认识的人，镖旗所过之处，绿林也要给三分薄面——另外七分，是买来的。",
              c: "原著经济线；商路与消息的枢纽。"
            },
            {
              id: "xuantie",
              n: "玄铁矿脉",
              x: 50,
              y: 78,
              t: "danger",
              d: 4,
              rg: "玄铁矿区",
              aliases: ["玄铁", "矿脉", "铁矿", "矿区"],
              desc: "凌霄阁名下的矿脉，深入地下不知几许。矿道越深越冷，灯照不透的黑里偶有异响。坊市传闻说：曾有个杂役弟子在矿洞深处得了造化——传闻没说的是，进去十个，出来一个。",
              c: "原著「无字黑书」出世之地；机缘与凶险一体。"
            }
          ]
        },
        {
          id: "cangyun",
          name: "苍云邪地 · 六王之域",
          ico: "邪",
          hint: "大汉王朝以南的化外之地——规矩是活下来的人定的",
          decor: "land",
          regions: [
            { n: "邪地外围", cx: 33, cy: 39, rx: 19, ry: 14, tr: "desert" },
            { n: "六王封地", cx: 70, cy: 34, rx: 18, ry: 13, tr: "mountain" },
            { n: "禁绝深处", cx: 50, cy: 76, rx: 17, ry: 13, tr: "void" }
          ],
          roads: [["bianyuan", "fengdi"], ["fengdi", "shenchujin"], ["bianyuan", "mofang"]],
          nodes: [
            {
              id: "bianyuan",
              n: "邪地边缘",
              x: 26,
              y: 30,
              t: "start",
              d: 3,
              rg: "邪地外围",
              aliases: ["边缘", "邪地入口", "邪地外围", "苍云边缘"],
              desc: "官道尽头再往南，界碑上刻着「生人止步」——字是刀刻的，碑是新的，老碑埋在底下，跟刻碑的人一起。商队到这里换短刀，行人到这里学闭嘴。",
              c: "玩家踏入邪地的第一站；规矩改写的临界线。"
            },
            {
              id: "mofang",
              n: "黑风寨市",
              x: 40,
              y: 48,
              t: "city",
              d: 3,
              rg: "邪地外围",
              aliases: ["寨市", "黑风寨", "黑市", "邪地坊市"],
              desc: "邪地外围的灰色聚落：销赃、买命、探消息，什么都有。桌上的酒按坛算，桌下的账按人算。这里不问来路——问来路的，多半活不到结账。",
              c: "邪地生态样本；灰色交易的落脚点。"
            },
            {
              id: "fengdi",
              n: "六王封地",
              x: 70,
              y: 34,
              t: "danger",
              d: 5,
              rg: "六王封地",
              aliases: ["封地", "邪王", "六王", "邪王殿"],
              desc: "六大邪王各占一方，各自的旗号就是各自的法。正道宗门的名字在这里不值一块灵石，能通行的只有实力与利益。地界上偶尔能看见正道修士的尸首——摆得很整齐，像某种问候。",
              c: "原著「苍云邪地」线；六大邪王博弈之地。"
            },
            {
              id: "shenchujin",
              n: "禁绝深处",
              x: 50,
              y: 78,
              t: "danger",
              d: 5,
              rg: "禁绝深处",
              aliases: ["深处", "禁地", "邪地深处", "禁绝"],
              desc: "连邪王都不轻易提的地方：山是黑的，雾是不散的，进去的路只认得回来的方向——如果运气好。邪地的老人们说，那里睡着不该被吵醒的东西。",
              c: "原著深水区；中前期只给征兆不给答案。"
            }
          ]
        },
        {
          id: "daqian",
          name: "大千界海 · 武道通天",
          ico: "千",
          hint: "界壁之外还有界壁——开天之路，一步一座界碑",
          decor: "cosmos",
          regions: [
            { n: "界壁通道", cx: 30, cy: 34, rx: 19, ry: 14, tr: "void" },
            { n: "星域古路", cx: 72, cy: 34, rx: 18, ry: 13, tr: "void" },
            { n: "武道绝巅", cx: 52, cy: 76, rx: 16, ry: 13, tr: "void" }
          ],
          roads: [["jiebi", "gulu"], ["gulu", "dianfeng"]],
          nodes: [
            {
              id: "jiebi",
              n: "界壁",
              x: 28,
              y: 30,
              t: "relic",
              d: 4,
              rg: "界壁通道",
              aliases: ["界壁", "通界", "界门", "跨界"],
              desc: "两界之间的那层膜：元气涌动如潮，硬闯的人化在潮里，懂行的人贴着潮走。跨过去，功法还是那部功法，天却不是那片天——低境修士头一件事是重新学会呼吸。",
              c: "世界层级跃迁通道；大格局展开的门户。"
            },
            {
              id: "gulu",
              n: "星域古路",
              x: 70,
              y: 34,
              t: "relic",
              d: 5,
              rg: "星域古路",
              aliases: ["古路", "星路", "星空古道"],
              desc: "悬在虚空里的断续通路，沿途散落着不知哪个纪元留下的残碑与枯骨。走这条路的人冲的都是同一个方向——路的名字，取自尽头那个字。",
              c: "原著长征线；漫漫武路的具象。"
            },
            {
              id: "dianfeng",
              n: "武道绝巅",
              x: 52,
              y: 76,
              t: "relic",
              d: 5,
              rg: "武道绝巅",
              aliases: ["绝巅", "巅峰", "武之巅峰", "开天"],
              desc: "古路上所有脚印指向的地方。到了那里的人不回头，也回不了头——回头看，来路上挤着的人影比星星还多，可山顶的风，只有一个人在听。",
              c: "原著主题落点：高处不胜寒。"
            }
          ]
        }
      ]
    },
    /* ---------- 圣墟 ---------- */
    shengxu: {
      name: "圣墟 · 行旅图鉴",
      flavor: "大漠尽头彼岸花开，看见的人别声张",
      layers: [
        {
          id: "damo",
          name: "大漠尽头 · 彼岸花海",
          ico: "漠",
          hint: "一望无垠的大漠——蓝色花开一夜谢，看见的人别声张",
          decor: "land",
          regions: [
            { n: "大漠古道", cx: 32, cy: 39, rx: 18, ry: 14, tr: "desert" },
            { n: "彼岸花海", cx: 70, cy: 34, rx: 19, ry: 13, tr: "forest" },
            { n: "蓝雾深处", cx: 50, cy: 76, rx: 17, ry: 13, tr: "mountain" }
          ],
          roads: [["gudao", "huahai"], ["huahai", "lanwu"], ["gudao", "shitou"]],
          nodes: [
            {
              id: "gudao",
              n: "大漠古道",
              x: 26,
              y: 30,
              t: "start",
              d: 2,
              rg: "大漠古道",
              aliases: ["大漠", "沙漠", "古道", "黄沙"],
              desc: "一望无垠的大漠，空旷而高远：红日西坠时地平线一片殷红，上古的烽烟早已在岁月中逝去。孤身走这条路的人都带着自己的事——风景是真的，回不回得去另说。",
              c: "原著开篇「沙漠中的彼岸花」之地；楚风孤身旅行处。"
            },
            {
              id: "shitou",
              n: "黄河故道",
              x: 38,
              y: 48,
              t: "relic",
              d: 3,
              rg: "大漠古道",
              aliases: ["黄河", "故道", "河床", "旧河道"],
              desc: "几经变迁的黄河古道还在这片沙海里留着印子：干涸的河床、半埋的渡口石碑。牧人说涨蓝雾的夜里，河床深处会传来水声——可这条河，断了不知多少年。",
              c: "上古遗迹线；岁月感的具象落点。"
            },
            {
              id: "huahai",
              n: "彼岸花海",
              x: 70,
              y: 34,
              t: "wild",
              d: 4,
              rg: "彼岸花海",
              aliases: ["花海", "彼岸花", "蓝花", "蓝色彼岸花"],
              desc: "大漠尽头一夜绽放的蓝色彼岸花：一条条花瓣展开又向后弯曲，蓝光流动，一眼望不到边。彼岸花红得鲜艳，而它是蓝色的——从没有人听说有蓝色彼岸花。",
              c: "原著开篇意象；复苏进程的标志性异变。"
            },
            {
              id: "lanwu",
              n: "蓝雾深处",
              x: 50,
              y: 78,
              t: "danger",
              d: 5,
              rg: "蓝雾深处",
              aliases: ["蓝雾", "雾区", "深处", "幽雾"],
              desc: "一缕幽雾又一次临近大地的深处：沧海成尘，雷电枯竭，世间的枷锁在这里被打开。指南针在里头转圈，进去的人多半没回来——回来的那几个，眼睛里都带着同一种东西。",
              c: "复苏本源线；神秘石罐的埋线之地。"
            }
          ]
        },
        {
          id: "lanxing",
          name: "复苏蓝星 · 异变之地",
          ico: "蓝",
          hint: "昆仑剥出青铜色，太行走出金小牛，名山大川重获神性",
          decor: "land",
          regions: [
            { n: "昆仑山区", cx: 30, cy: 32, rx: 19, ry: 14, tr: "mountain" },
            { n: "中原名山", cx: 75, cy: 39, rx: 18, ry: 13, tr: "forest" },
            { n: "现代都市", cx: 42, cy: 80, rx: 18, ry: 13, tr: "city" }
          ],
          roads: [["kunlun", "taihang"], ["taihang", "qinling"], ["kunlun", "dushi"], ["dushi", "yiren"]],
          nodes: [
            {
              id: "kunlun",
              n: "昆仑山",
              x: 28,
              y: 28,
              t: "relic",
              d: 5,
              rg: "昆仑山区",
              aliases: ["昆仑", "昆仑山形变", "金顶", "青铜昆仑"],
              desc: "山体剥落，露出的不是岩石是青铜——整座山像一件出土的礼器。金顶地宫的门开过一次，进去的人带出来的东西，够异人圈消化十年。现在山周围一圈，全是各个组织设的哨。",
              c: "原著核心遗迹线；石罐出世之地、神话祖地。"
            },
            {
              id: "taihang",
              n: "太行山",
              x: 66,
              y: 30,
              t: "sect",
              d: 4,
              rg: "中原名山",
              aliases: ["太行", "金色小牛", "小黄牛"],
              desc: "一头金色小牛从这里闯出的秘境：呼吸法残篇的传承之地，进化的门槛就埋在这片山里。山上灵气渐浓，守山的规矩一天一个样——守规矩的不是人。",
              c: "呼吸法传承线；盗引呼吸法的源头。"
            },
            {
              id: "qinling",
              n: "秦岭",
              x: 84,
              y: 48,
              t: "wild",
              d: 4,
              rg: "中原名山",
              aliases: ["秦岭", "银盒", "终南山"],
              desc: "藏着上古银盒等传承的名山：深山里的东西一个个睁了眼，采药人说他家的老路还在，路边的山不太对了。各地秘境次第开启，名额与时机就是博弈。",
              c: "上古传承线；秘境开启的样本。"
            },
            {
              id: "dushi",
              n: "现代都市",
              x: 50,
              y: 74,
              t: "city",
              d: 2,
              rg: "现代都市",
              aliases: ["城市", "都市", "市区", "县城"],
              desc: "表面照旧：早高峰、外卖、热搜。变化藏在细节里——朋友圈的异兽目击被和谐得越来越快，体检中心多了「觉醒检测」的窗口，老同学群里有人半年没说话了。",
              c: "复苏时代日常面；信息与暗流的交汇处。"
            },
            {
              id: "yiren",
              n: "异人组织",
              x: 34,
              y: 86,
              t: "sect",
              d: 3,
              rg: "现代都市",
              aliases: ["异人", "组织", "异人圈", "机构"],
              desc: "觉醒者们的圈子：有官方背景的、财团养的、野生凑的，各自攒着各自的消息和算盘。招募的方式五花八门——共同点只有一个：先问你会什么，再问你想要什么。",
              c: "原著势力线；玩家可选的阵营入口。"
            }
          ]
        },
        {
          id: "zongshen",
          name: "复苏棋局 · 上古纵深",
          ico: "弈",
          hint: "棋盘上不止这一纪——知道的越多，睡得越少",
          decor: "cosmos",
          regions: [
            { n: "太阳系深空", cx: 28, cy: 34, rx: 19, ry: 14, tr: "void" },
            { n: "上古棋局", cx: 70, cy: 34, rx: 18, ry: 13, tr: "void" },
            { n: "界外之界", cx: 52, cy: 76, rx: 16, ry: 13, tr: "void" }
          ],
          roads: [["shenkong", "qiju"], ["qiju", "jiewai"]],
          nodes: [
            {
              id: "shenkong",
              n: "太阳系深空",
              x: 26,
              y: 30,
              t: "relic",
              d: 5,
              rg: "太阳系深空",
              aliases: ["深空", "月球", "外太空", "星空"],
              desc: "望远镜照得到，人去不了——暂时。复苏的不止是山里的神话：夜空中有些星星的位置，跟旧星图对不上了。天文学界保持沉默，异人圈传得沸沸扬扬。",
              c: "原著格局线；复苏的宇宙尺度伏笔。"
            },
            {
              id: "qiju",
              n: "上古棋局",
              x: 70,
              y: 34,
              t: "danger",
              d: 5,
              rg: "上古棋局",
              aliases: ["棋局", "布局", "黑手", "操盘"],
              desc: "散落各地的古迹拼起来，隐约是一盘棋：谁布的、下的什么注、谁在执子——没有人知道。知道一些的人不说，说一些的人不知全部。棋盘上的棋子，偶尔会醒。",
              c: "原著终极悬念；复苏背后的真相线。"
            },
            {
              id: "jiewai",
              n: "界外之界",
              x: 52,
              y: 78,
              t: "relic",
              d: 5,
              rg: "界外之界",
              aliases: ["界外", "另一界", "阴阳", "未知之地"],
              desc: "古籍里一笔带过、老人们讳莫如深的地方：阳间之外有阴间，世界之外有世界。复苏年代最深的秘密不在山里——山只是门的形状。",
              c: "原著世界观纵深；中前期只留征兆。"
            }
          ]
        }
      ]
    },
    /* ---------- 神秘复苏 ---------- */
    shenmifusu: {
      name: "神秘复苏 · 行旅图鉴",
      flavor: "深夜的敲门声，数清了再开",
      layers: [
        {
          id: "dachang",
          name: "大昌市 · 灵异之城",
          ico: "昌",
          hint: "厉鬼复苏最早显形的城市之一——第七中学的黑板、老城的筒子楼、深夜的敲门声",
          decor: "city",
          regions: [
            { n: "老城区", cx: 32, cy: 41, rx: 19, ry: 14, tr: "city" },
            { n: "第七中学片区", cx: 76, cy: 36, rx: 18, ry: 18, tr: "plain" },
            { n: "鬼域边缘", cx: 52, cy: 76, rx: 17, ry: 13, tr: "void" },
            { id: "zongbu_r", n: "总部 · 大昌分部", cx: 84, cy: 56, rx: 10, ry: 9, tr: "city" }
          ],
          roads: [["qizhong", "laocheng"], ["laocheng", "tongzilou"], ["qizhong", "zongbu"]],
          nodes: [
            {
              id: "qizhong",
              n: "第七中学",
              x: 68,
              y: 26,
              t: "start",
              d: 3,
              rg: "第七中学片区",
              aliases: ["七中", "第七中学", "江州七中", "学校", "教室"],
              desc: "一切开始的地方：黑板前那行人皮纸、放晚自习后空荡的走廊、教学楼下永远修不好的路灯。杨间就是从这里的教室，一步步走进灵异的深渊。",
              c: "原著开篇线；人皮纸初现之地。"
            },
            {
              id: "laocheng",
              n: "老城区",
              x: 28,
              y: 32,
              t: "city",
              d: 2,
              rg: "老城区",
              aliases: ["老城", "旧城区", "城区"],
              desc: "九十年代盖的旧楼、杂货铺、修理摊。表面上是市井烟火，暗地里是灵异事件的高发区——住在这里的人有的搬走了，有的「搬走」了。",
              c: "原著市井线；灵异传闻的集散地。"
            },
            {
              id: "tongzilou",
              n: "筒子楼",
              x: 36,
              y: 52,
              t: "danger",
              d: 4,
              rg: "老城区",
              aliases: ["筒子楼", "旧楼", "单元楼"],
              desc: "一条走廊一排门的旧楼。三层那户人家搬走三年了，半夜还有人冲马桶；楼道声控灯不亮的地方，尽量绕着走。大昌市的老人都说：这楼不干净。",
              c: "典型灵异事件场景；驭鬼者的第一线战场。"
            },
            {
              id: "zongbu",
              n: "总部大昌分部",
              x: 84,
              y: 56,
              t: "sect",
              d: 2,
              rg: "总部 · 大昌分部",
              aliases: ["总部", "分部", "驭鬼者组织", "灵异调查局"],
              desc: "驭鬼者组织的据点：档案柜里锁着一城的灵异卷宗，武器库里放着黄金打造的器具。编制、晋升、任务——这里是复苏时代新秩序的心脏之一。",
              c: "原著势力线；玩家可选的阵营入口。"
            },
            {
              id: "guiyu_bian",
              n: "鬼域边缘",
              x: 52,
              y: 80,
              t: "danger",
              d: 5,
              rg: "鬼域边缘",
              aliases: ["鬼域", "鬼域边缘", "鬼区"],
              desc: "不该存在的街区：路灯亮着，行人不动，声音传不出去。从这里进去的人要靠自己的命换路——黄金、禁锢、运气，缺一样就出不来。",
              c: "原著鬼域设定；S级凶险之地。"
            }
          ]
        },
        {
          id: "jiangzhou",
          name: "各地灵异 · 驭鬼网络",
          ico: "档",
          hint: "复苏不止一城——各地灵异事件、驭鬼者的网络与黄金黑市",
          decor: "land",
          regions: [
            { n: "江州市", cx: 28, cy: 32, rx: 19, ry: 14, tr: "city" },
            { n: "黄金黑市", cx: 77, cy: 40, rx: 18, ry: 16, tr: "city" },
            { n: "驭鬼者网络", cx: 50, cy: 76, rx: 18, ry: 13, tr: "mountain" },
            { id: "yidong_r", n: "移动灵异", cx: 84, cy: 58, rx: 10, ry: 9, tr: "void" }
          ],
          roads: [["jiangzhou", "heishijing"], ["jiangzhou", "wangluo"], ["heishijing", "yidong"]],
          nodes: [
            {
              id: "jiangzhou",
              n: "江州市",
              x: 26,
              y: 30,
              t: "city",
              d: 3,
              rg: "江州市",
              aliases: ["江州", "邻市"],
              desc: "大昌之外的又一灵异重镇：第七中学后巷的传闻、医院太平间的目击、本地驭鬼者的地盘规矩。复苏年代的城市各有各的鬼，各有各的账。",
              c: "原著多城线；灵异事件的横向铺开。"
            },
            {
              id: "heishijing",
              n: "黄金黑市",
              x: 70,
              y: 32,
              t: "relic",
              d: 4,
              rg: "黄金黑市",
              aliases: ["黑市", "黄金市场", "黑金市"],
              desc: "黄金在复苏年代是硬通货也是命：这里的买卖用克计价，交易的双方都不问来路。买主里有驭鬼者，有想成为驭鬼者的，也有活不了几天想搏一把的。",
              c: "原著经济线；黄金配额的市井面。"
            },
            {
              id: "yidong",
              n: "移动灵异",
              x: 84,
              y: 58,
              t: "wild",
              d: 4,
              rg: "移动灵异",
              aliases: ["移动鬼", "游荡鬼物", "迁徙"],
              desc: "有些鬼不在原地等：沿着公路走、跟着末班车跑、藏在货车里进城。各地的灵异通报里，它们的编号都是「移动」开头——最难抓的一类。",
              c: "原著设定线；游荡型厉鬼。"
            },
            {
              id: "wangluo",
              n: "驭鬼者网络",
              x: 50,
              y: 74,
              t: "sect",
              d: 3,
              rg: "驭鬼者网络",
              aliases: ["驭鬼者", "网络", "同行", "驭鬼人"],
              desc: "总部之外散落各地的驭鬼者：有人按规矩办事，有人单干，有人本身就是隐患。他们交换情报的方式很老派——酒桌上、纸条上、死人留下的档案里。",
              c: "原著群像线；玩家可结交的同行。"
            }
          ]
        },
        {
          id: "shenchu",
          name: "鬼域纵深 · 人间之外",
          ico: "冥",
          hint: "档案柜最深的那一格——知道的越多，睡得越少",
          decor: "cosmos",
          regions: [
            { n: "鬼域内部", cx: 30, cy: 34, rx: 19, ry: 14, tr: "void" },
            { n: "复苏之源", cx: 70, cy: 34, rx: 18, ry: 13, tr: "void" },
            { n: "人间之外", cx: 52, cy: 76, rx: 16, ry: 13, tr: "void" }
          ],
          roads: [["guiyu_nei", "fusu_zhiyuan"], ["fusu_zhiyuan", "renjian_zhiwai"]],
          nodes: [
            {
              id: "guiyu_nei",
              n: "鬼域内部",
              x: 28,
              y: 30,
              t: "danger",
              d: 5,
              rg: "鬼域内部",
              aliases: ["鬼域内部", "深处", "鬼域中心"],
              desc: "鬼域不是地方，是规则：进去的人看到的街和现实叠在一起，走错的每一步都在付账。有驭鬼者从里面带出过东西——也带出过不该带的东西。",
              c: "原著核心设定；规则怪谈的主场。"
            },
            {
              id: "fusu_zhiyuan",
              n: "复苏之源",
              x: 70,
              y: 34,
              t: "relic",
              d: 5,
              rg: "复苏之源",
              aliases: ["源头", "复苏", "起因"],
              desc: "鬼为什么出现？从哪天开始？谁定的规律？档案柜里最早的一页也只有半句话。所有的线索都指向同一个方向——那里没有活人回来过。",
              c: "原著终极悬念；复苏的真相线。"
            },
            {
              id: "renjian_zhiwai",
              n: "人间之外",
              x: 52,
              y: 78,
              t: "wild",
              d: 5,
              rg: "人间之外",
              aliases: ["人间之外", "阴间", "另一侧"],
              desc: "老辈人烧纸时会念叨的那个地方。禁锢到S级的人偶尔会「看见」它的边界——看一眼，就得留下点什么。档案里管这个叫：价目表。",
              c: "原著世界观纵深；S级禁锢的代价所指。"
            }
          ]
        }
      ]
    },
    /* ---------- 开局地摊卖大力 ---------- */
    ditandali: {
      name: "开局地摊卖大力 · 行旅图鉴",
      flavor: "货在人先，人在祸前",
      layers: [
        {
          id: "yeshi",
          name: "江城夜市 · 摊位街",
          ico: "摊",
          hint: "一盏灯一块布的江湖——收摊跑路全夜市第一",
          decor: "city",
          regions: [
            { n: "摊位街", cx: 59, cy: 27, rx: 24, ry: 14, tr: "city" },
            { n: "江城一中片区", cx: 24, cy: 70, rx: 18, ry: 13, tr: "plain" },
            { n: "城郊", cx: 78, cy: 70, rx: 17, ry: 12, tr: "mountain" }
          ],
          roads: [["tanwei", "jiapo"], ["tanwei", "yizhong"], ["tanwei", "chengjiao"], ["yizhong", "gueryuan"]],
          nodes: [
            {
              id: "tanwei",
              n: "夜市摊位街",
              x: 50,
              y: 32,
              t: "start",
              d: 2,
              rg: "摊位街",
              aliases: ["夜市", "摊位", "地摊", "摆摊", "夜市街"],
              desc: "灯泡一盏盏亮起来的江湖：烧烤摊的烟、隔壁摊的收音机放着灵武新闻、穿拖鞋的顾客蹲在摊前砍价。江南的地摊就支在这里——一块破布，压着一个系统。",
              c: "原著主场；主角摊位所在地。"
            },
            {
              id: "jiapo",
              n: "隔壁摊",
              x: 68,
              y: 22,
              t: "city",
              d: 1,
              rg: "摊位街",
              aliases: ["隔壁", "邻摊", "同行"],
              desc: "夜市的人情都在隔壁摊之间：借个火、看个摊、传个话。兽化系大姐的卤味摊、卖假古董的老周、直播的小年轻——复苏年代的市井，比异能更早教会人活法。",
              c: "原著群像线；夜市烟火的核心。"
            },
            {
              id: "yizhong",
              n: "江城一中",
              x: 24,
              y: 66,
              t: "sect",
              d: 2,
              rg: "江城一中片区",
              aliases: ["一中", "江城一中", "灵武班", "学校"],
              desc: "灵武班比文化班多两层铁门：模拟考的战损、月考的哀嚎、天赋评级的公示栏。吊车尾的江南就是从这里放学后去夜市出摊的——两边的账，他都得算。",
              c: "原著校园线；灵武班与天赋评级的舞台。"
            },
            {
              id: "chengjiao",
              n: "城郊",
              x: 78,
              y: 70,
              t: "wild",
              d: 3,
              rg: "城郊",
              aliases: ["城郊", "郊区", "野外"],
              desc: "灵武新闻里异兽出没的常客：收摊晚了走夜路的摊主都懂，电瓶车要充满电。巡逻的暗夜军偶尔会来夜市买东西——制服口袋里，装着这个时代的秩序。",
              c: "原著凶险线；异兽与暗流的第一线。"
            },
            {
              id: "gueryuan",
              n: "江城孤儿院",
              x: 30,
              y: 74,
              t: "poi",
              d: 1,
              rg: "江城一中片区",
              aliases: ["孤儿院"],
              desc: "江南长大的地方，也是他和钟映雪认识的地方。床铺、旧照片、院里那棵树——后来他走过再多地方，账本第一页还是这里。",
              c: "原著主角出身地；江南与钟映雪的起点。"
            }
          ]
        },
        {
          id: "jiangcheng",
          name: "复苏江城 · 灵武纪元",
          ico: "武",
          hint: "灵墟大门洞开二十年——灵武协会、暗夜军与大门的格局",
          decor: "land",
          regions: [
            { n: "灵武协会", cx: 30, cy: 41, rx: 19, ry: 14, tr: "city" },
            { n: "暗夜军驻地", cx: 70, cy: 34, rx: 18, ry: 13, tr: "mountain" },
            { n: "灵墟大门", cx: 50, cy: 76, rx: 18, ry: 13, tr: "void" },
            { n: "千湖岛", cx: 20, cy: 68, rx: 11, ry: 9, tr: "water" },
            { n: "先驱者学院", cx: 40, cy: 12, rx: 13, ry: 8, tr: "city" },
            { id: "kaoping_r", n: "灵墟考核场", cx: 44, cy: 52, rx: 12, ry: 9, tr: "plain" }
          ],
          roads: [["xiehui", "anyejun"], ["anyejun", "damen"], ["xiehui", "kaoping"], ["xiehui", "songjiang"], ["songjiang", "xianqu"], ["kaoping", "qianhudao"]],
          nodes: [
            {
              id: "xiehui",
              n: "灵武协会",
              x: 26,
              y: 30,
              t: "sect",
              d: 2,
              rg: "灵武协会",
              aliases: ["协会", "灵武协会"],
              desc: "灵武者的官方组织：评级、发证、发通报。大厅里的电子屏滚动着异兽目击，柜台后的人一板一眼——但在复苏年代，一纸评级就是一条命的门路。",
              c: "原著势力线；玩家可挂靠的体制入口。"
            },
            {
              id: "kaoping",
              n: "灵墟考核场",
              x: 44,
              y: 52,
              t: "relic",
              d: 4,
              rg: "灵墟考核场",
              aliases: ["考核场", "考核", "试炼"],
              desc: "灵墟考核的比试之地：黑铁对青铜、异能对异能，输了的下辈子摸不到门。看台上的人眼神都在算——这个人，值不值得投资。",
              c: "原著考核线；等阶攀升的名利场。"
            },
            {
              id: "anyejun",
              n: "暗夜军驻地",
              x: 70,
              y: 32,
              t: "sect",
              d: 3,
              rg: "暗夜军驻地",
              aliases: ["暗夜军", "驻地", "军营"],
              desc: "镇压大门与异兽的暴力机关：大兵的津贴不高，风险全在门里。他们来夜市买东西从不砍价——见惯了明天，就没心思计较今天的三五块。",
              c: "原著势力线；江南后期的归属。"
            },
            {
              id: "damen",
              n: "灵墟大门",
              x: 50,
              y: 78,
              t: "danger",
              d: 5,
              rg: "灵墟大门",
              aliases: ["大门", "灵墟", "灵墟大门"],
              desc: "二十年前洞开的那扇门：门里有灵气、有异兽、有讲不清的东西。人类拿它没办法，只好围着它建了个时代。夜市收摊后往城外看——那道光，一直亮着。",
              c: "原著核心设定；时代棋局的关键。"
            },
            {
              id: "qianhudao",
              n: "千湖岛灵墟",
              x: 18,
              y: 66,
              t: "wild",
              d: 3,
              rg: "千湖岛",
              aliases: ["千湖岛"],
              desc: "水面星罗、岛屿成群的灵墟，期末考核的经典考场。灵兽与灵珠都藏在水气里——熊二就是在这里被江南带出来的。",
              c: "原著千湖岛灵墟篇；考核与伙伴线。"
            },
            {
              id: "songjiang",
              n: "松江灵武中学",
              x: 16,
              y: 40,
              t: "sect",
              d: 2,
              rg: "灵武协会",
              aliases: ["松江", "灵武中学"],
              desc: "江南苦读想转进去的学校：灵武班、资源倾斜、通往更大舞台的门票。为了这张门票，他在夜市把摊摆了无数个通宵。",
              c: "原著升学线；江南转学目标。"
            },
            {
              id: "xianqu",
              n: "先驱者学院",
              x: 40,
              y: 14,
              t: "sect",
              d: 5,
              rg: "先驱者学院",
              aliases: ["先驱者"],
              desc: "全国最神秘的学院，院长是\"火神\"萧吹火。能进这里的，都是被时代挑中的名字；江南掀翻校长那天，这里才算真正记住了他。",
              c: "原著学院线；萧吹火与顶尖战力格局。"
            }
          ]
        },
        {
          id: "shidai",
          name: "时代棋局 · 大门彼端",
          ico: "局",
          hint: "地摊虽小，摊布底下压着整个时代的风浪",
          decor: "cosmos",
          regions: [
            { n: "灵墟内部", cx: 30, cy: 34, rx: 19, ry: 14, tr: "void" },
            { n: "白鲨暗面", cx: 70, cy: 34, rx: 18, ry: 13, tr: "void" },
            { n: "时代之巅", cx: 52, cy: 76, rx: 16, ry: 13, tr: "void" },
            { n: "虚空海", cx: 82, cy: 62, rx: 13, ry: 10, tr: "void" },
            { n: "不夜城", cx: 16, cy: 74, rx: 12, ry: 9, tr: "city" }
          ],
          roads: [["lingxu_nei", "baisha"], ["baisha", "shidai_dian"], ["lingxu_nei", "xukonghai"], ["baisha", "buoyecheng"], ["buoyecheng", "shidai_dian"]],
          nodes: [
            {
              id: "lingxu_nei",
              n: "灵墟内部",
              x: 28,
              y: 30,
              t: "danger",
              d: 5,
              rg: "灵墟内部",
              aliases: ["灵墟内部", "门内", "门里"],
              desc: "大门之内的世界：异兽的巢、资源的库、规矩的坟场。进去的人拿命换机缘，出来的东西在夜市能卖上价——但夜市摊主都知道，有些货不能碰。",
              c: "原著凶险纵深；机缘与死亡同源。"
            },
            {
              id: "baisha",
              n: "白鲨暗面",
              x: 70,
              y: 34,
              t: "danger",
              d: 5,
              rg: "白鲨暗面",
              aliases: ["白鲨", "暗面", "黑手"],
              desc: "夜市里出手阔绰的生面孔、考核场边不散的影子、通报里没写的失踪案——线索拧成一股，指向同一个代号。他们不问你想不想要这个时代，只问挡没挡路。",
              c: "原著反派线；复苏时代的既得利益者。"
            },
            {
              id: "shidai_dian",
              n: "时代之巅",
              x: 52,
              y: 78,
              t: "relic",
              d: 5,
              rg: "时代之巅",
              aliases: ["时代之巅", "时代之王", "终点"],
              desc: "从夜市摊位到时代之王有多远？没人算得清。只知道每一代都有人往上爬，爬上去的人回头看——底下的人还是那么小，夜市的灯还是那么亮。",
              c: "原著主线纵深；江南的路，也是这个时代的路。"
            },
            {
              id: "xukonghai",
              n: "虚空海",
              x: 80,
              y: 60,
              t: "danger",
              d: 5,
              rg: "虚空海",
              aliases: ["虚空海灵墟"],
              desc: "西疆深处的虚空海灵墟，空间异能灵兽的老家。虚空锦鲤、鬼脸蟾蜍皆产于此——江南一身的\"空间\"本事，根子都在这片海。",
              c: "原著灵墟体系；江南空间系灵珠来源。"
            },
            {
              id: "buoyecheng",
              n: "不夜城",
              x: 14,
              y: 72,
              t: "city",
              d: 3,
              rg: "不夜城",
              aliases: ["不夜"],
              desc: "灯不灭的城：交易、情报、暗活儿都在此过手。江南在这里遇到了小岚——一个同样认钱、同样不肯认命的姑娘。",
              c: "原著都市线；江南与岚相遇之地。"
            }
          ]
        }
      ]
    },
    /* ---------- 地球开放世界（v3.19.6：东西半球双图层，时代中立的真实地理） ---------- */
    earth: {
      name: "地球开放世界 · 行旅图鉴",
      flavor: "世界不给故事，只给因果",
      layers: [
        {
          id: "east",
          name: "东半球 · 旧大陆",
          ico: "东",
          hint: "欧亚非三洲——丝路古道、帝国兴替、千年商埠都在这一半",
          decor: "land",
          regions: [
            { n: "欧罗巴", cx: 21, cy: 33, rx: 15, ry: 12, tr: "plain" },
            { n: "西伯利亚", cx: 49, cy: 16, rx: 18, ry: 7, tr: "mountain" },
            { n: "阿非利加", cx: 24, cy: 69, rx: 15, ry: 14, tr: "desert" },
            { n: "中东两河", cx: 41, cy: 42, rx: 10, ry: 8, tr: "desert" },
            { n: "南亚次大陆", cx: 62, cy: 56, rx: 9, ry: 9, tr: "forest" },
            { n: "华夏九州", cx: 72, cy: 39, rx: 14, ry: 16, tr: "plain" }
          ],
          roads: [
            ["changan", "baghdad"],
            ["baghdad", "constantinople"],
            ["constantinople", "rome"],
            ["rome", "paris"],
            ["paris", "london"],
            ["moscow", "paris"],
            ["changan", "delhi"],
            ["delhi", "baghdad"],
            ["guangzhou", "delhi"],
            ["cairo", "baghdad"],
            ["beijing", "changan"],
            ["beijing", "moscow"],
            ["shanghai", "guangzhou"],
            ["capetown", "cairo"],
            ["changan", "dunhuang"]
          ],
          nodes: [
            {
              id: "changan",
              n: "长安·关中",
              x: 70,
              y: 34,
              t: "start",
              d: 2,
              rg: "华夏九州",
              aliases: ["长安", "西安", "关中", "西京"],
              desc: "渭水之滨的十三朝古都：周秦汉唐在此定鼎，驼铃从这里出发摇向西域。各朝各代的名字换过——镐京、咸阳、长安、西安——但八百里秦川始终是中国的心脏。",
              c: "古典帝国的丝路起点；汉唐气象的原点。"
            },
            {
              id: "dunhuang",
              n: "敦煌·河西走廊",
              x: 62,
              y: 30,
              t: "relic",
              d: 3,
              rg: "华夏九州",
              aliases: ["敦煌", "河西走廊", "玉门关", "阳关"],
              desc: "河西走廊的咽喉：莫高窟的飞天画了一千年，玉门关外的风沙没停过一千年。出关是西域，入关是中原——商队、僧人、戍卒与流放者都从这里走过。",
              c: "丝路孔道；东西方文明在此交换呼吸。"
            },
            {
              id: "beijing",
              n: "北京·燕京",
              x: 78,
              y: 26,
              t: "city",
              d: 2,
              rg: "华夏九州",
              aliases: ["北京", "燕京", "北平", "大都", "京师"],
              desc: "燕山脚下的帝都：从蓟城到大都到北平，名字换了多少轮，皇城的分量没换过。胡同里的市声与朝堂上的风雷，隔着一道墙。",
              c: "元明清至近代的政治心脏；时代更迭的风暴眼。"
            },
            {
              id: "shanghai",
              n: "上海·淞沪",
              x: 82,
              y: 42,
              t: "city",
              d: 1,
              rg: "华夏九州",
              aliases: ["上海", "淞沪", "申城", "十里洋场"],
              desc: "长江入海口的码头城市：开埠之前是松江府的县城，开埠之后是远东第一大都会。外滩的万国建筑、弄堂的亭子间、十六铺的货栈——近代中国的两面都在这里。",
              c: "近代通商口岸；东西交汇的浮世绘。"
            },
            {
              id: "guangzhou",
              n: "广州·番禺",
              x: 72,
              y: 52,
              t: "city",
              d: 2,
              rg: "华夏九州",
              aliases: ["广州", "番禺", "五羊城", " Canton"],
              desc: "珠江口的千年商港：从南海商船到十三行到广交会，两千年来中国的大门一直开在这里。凉茶铺与骑楼、报关行与洋行——做买卖的基因刻在这座城里。",
              c: "海上丝路主港；中国面向南海的门户。"
            },
            {
              id: "delhi",
              n: "德里·恒河平原",
              x: 62,
              y: 54,
              t: "city",
              d: 2,
              rg: "南亚次大陆",
              aliases: ["德里", "新德里", "恒河", "天竺"],
              desc: "恒河平原上的古都群：七个城址叠在一处，从孔雀王朝到莫卧儿到英属印度。北方的回廊与南方的神庙、香料与纱丽、种姓与市集——次大陆的千年都在这一带打转。",
              c: "南亚文明枢纽；玄奘西行的终点方向。"
            },
            {
              id: "baghdad",
              n: "巴格达·两河",
              x: 46,
              y: 46,
              t: "relic",
              d: 3,
              rg: "中东两河",
              aliases: ["巴格达", "两河", "美索不达米亚", "巴比伦"],
              desc: "底格里斯河畔的《一千零一夜》之城：阿拔斯王朝的智慧宫曾是世界的图书馆，巴比伦的空中花园传说就在下游不远处。两河流域是人类最早写下的那几页历史。",
              c: "文明摇篮；丝路中段的商贸与学问之都。"
            },
            {
              id: "constantinople",
              n: "君士坦丁堡",
              x: 36,
              y: 38,
              t: "relic",
              d: 3,
              rg: "中东两河",
              aliases: ["君士坦丁堡", "伊斯坦布尔", "拜占庭", "金角湾"],
              desc: "博斯普鲁斯海峡上的两洲锁钥：一座城横跨欧亚，一道海峡分开黑海与地中海。罗马人称它新罗马，奥斯曼人称它君士坦丁堡的继任——谁来都得先过这道海峡。",
              c: "欧亚十字路口；帝国兴替的活年表。"
            },
            {
              id: "cairo",
              n: "开罗·尼罗河",
              x: 32,
              y: 58,
              t: "relic",
              d: 3,
              rg: "阿非利加",
              aliases: ["开罗", "尼罗河", "吉萨", "金字塔", "埃及"],
              desc: "尼罗河赠礼的城：金字塔在城郊站了四千五百年，斯芬克斯的谜语没人答对过。从法老到托勒密到阿拉伯，河水的涨落写成了埃及的历法。",
              c: "古文明地标；尼罗河农业文明的心脏。"
            },
            {
              id: "capetown",
              n: "好望角",
              x: 16,
              y: 80,
              t: "wild",
              d: 4,
              rg: "阿非利加",
              aliases: ["好望角", "开普敦", "风暴角", " Cape of Good Hope"],
              desc: "非洲最西南的尖角：大西洋与印度洋在这里打架，桌山的云一年四季不散。帆船时代的水手叫它风暴角——绕过它，东方的香料就到手了。",
              c: "大航海时代的关键航路；两大洋的分界。"
            },
            {
              id: "moscow",
              n: "莫斯科",
              x: 44,
              y: 18,
              t: "city",
              d: 3,
              rg: "西伯利亚",
              aliases: ["莫斯科", "克里姆林", "莫斯科公国"],
              desc: "森林与河流间的城堡城市：克里姆林的洋葱顶下，从大公国到沙皇到红色帝国的七百年。冬天来得早走得晚，这座城市的一切都带着雪气。",
              c: "欧亚北方的政治重心；横贯西伯利亚的起点。"
            },
            {
              id: "rome",
              n: "罗马·七丘",
              x: 28,
              y: 42,
              t: "relic",
              d: 2,
              rg: "欧罗巴",
              aliases: ["罗马", "七丘之城", "永恒之城", " Rome"],
              desc: "台伯河畔七座山丘上的永恒之城：条条大路通向它，也从它伸向四方。斗兽场的残柱、万神殿的穹顶、梵蒂冈的钟声——两千年的层压层。",
              c: "古典时代西方的心脏；帝国法度的原产地。"
            },
            {
              id: "paris",
              n: "巴黎·塞纳河",
              x: 22,
              y: 28,
              t: "city",
              d: 2,
              rg: "欧罗巴",
              aliases: ["巴黎", "塞纳河", "花都", " Paris"],
              desc: "塞纳河左岸与右岸的城：从卡佩王朝的岛城到革命的街头到印象派的画布。咖啡馆里坐过写宣言的、流亡的、恋爱的——这座城市擅长把日子过成主义。",
              c: "近代思想与艺术的风暴眼。"
            },
            {
              id: "london",
              n: "伦敦·泰晤士",
              x: 14,
              y: 24,
              t: "city",
              d: 2,
              rg: "欧罗巴",
              aliases: ["伦敦", "泰晤士河", "雾都", " London"],
              desc: "泰晤士河边多雾的城：从罗马人的哨所到金融城的玻璃塔，两千年的账本没断过页。议会的大本钟、东区的码头、金融家与工人——它发明的现代世界，一半从这里起航。",
              c: "工业革命的发动机房；近代全球贸易的账房。"
            }
          ]
        },
        {
          id: "west",
          name: "西半球 · 新大陆与七海",
          ico: "西",
          hint: "美洲与大洋洲——大航海之后的世界另一半，帆船时代的航线图",
          decor: "cosmos",
          regions: [
            { n: "北美洲", cx: 18, cy: 26, rx: 17, ry: 14, tr: "forest" },
            { n: "中美洲", cx: 20, cy: 54, rx: 7, ry: 8, tr: "forest" },
            { n: "南美洲", cx: 32, cy: 83, rx: 16, ry: 20, tr: "forest" },
            { n: "太平洋", cx: 66, cy: 36, rx: 20, ry: 15, tr: "water" },
            { n: "大洋洲", cx: 80, cy: 74, rx: 11, ry: 8, tr: "plain" }
          ],
          roads: [
            ["newyork", "sanfrancisco"],
            ["newyork", "mexico"],
            ["mexico", "lima"],
            ["lima", "rio"],
            ["rio", "buenosaires"],
            ["honolulu", "sanfrancisco"],
            ["sydney", "honolulu"],
            ["capehorn", "buenosaires"],
            ["newyork", "london_route"]
          ],
          nodes: [
            {
              id: "newyork",
              n: "纽约·新阿姆斯特丹",
              x: 26,
              y: 26,
              t: "start",
              d: 2,
              rg: "北美洲",
              aliases: ["纽约", "New York", "曼哈顿", "新阿姆斯特丹"],
              desc: "哈德逊河口的新阿姆斯特丹→纽约：从皮毛贸易站到世界之都不到三百年。华尔街的铜牛、埃利斯岛的移民船、百老汇的灯——全世界的野心都在这座岛上排队。",
              c: "近代移民与资本的总闸口。"
            },
            {
              id: "london_route",
              n: "北大西洋航线",
              x: 10,
              y: 18,
              t: "poi",
              d: 3,
              rg: "北美洲",
              aliases: ["北大西洋", "大西洋航线", "跨洋邮轮"],
              desc: "旧大陆与新大陆之间的黄金水道：五月花号的清教徒、贩奴船的暗史、邮轮时代的头等舱与统舱、后来的援欧物资船队——现代世界的一半故事在这条线上来回。",
              c: "连接东西两半球的主航路。"
            },
            {
              id: "sanfrancisco",
              n: "旧金山·金山",
              x: 10,
              y: 34,
              t: "city",
              d: 2,
              rg: "北美洲",
              aliases: ["旧金山", "三藩市", "金山", "San Francisco", "淘金"],
              desc: "太平洋岸的金山：1848 年的黄金把全世界的人吸到这片滩头——广东话的「金山」就是这么叫开的。后来的铁路、后来的码头、后来的硅谷，浪头一茬接一茬。",
              c: "淘金潮地标；太平洋岸的移民之门。"
            },
            {
              id: "mexico",
              n: "墨西哥城·特诺奇",
              x: 20,
              y: 52,
              t: "relic",
              d: 2,
              rg: "中美洲",
              aliases: ["墨西哥城", "特诺奇蒂特兰", "阿兹特克", " Tenochtitlan"],
              desc: "特斯科科湖上的阿兹特克都城：金字塔在湖心站了两百年，西班牙人来了把它拆了垫新城的地基。海拔两千二百米的盆地，今天的城市还在往下沉。",
              c: "中美古文明的心脏；征服时代的第一现场。"
            },
            {
              id: "lima",
              n: "利马·印加故地",
              x: 24,
              y: 72,
              t: "relic",
              d: 3,
              rg: "南美洲",
              aliases: ["利马", "库斯科", "印加", "马丘比丘", " Inca"],
              desc: "安第斯山与太平洋之间的王者之城：印加的库斯科与马丘比丘立在山顶，西班牙的利马立在海岸。黄金国度的传说从这里传出去，害得整代欧洲人做黄金梦。",
              c: "印加文明故地；安第斯山地的心脏。"
            },
            {
              id: "rio",
              n: "里约热内卢",
              x: 42,
              y: 82,
              t: "city",
              d: 2,
              rg: "南美洲",
              aliases: ["里约", "里约热内卢", " Rio"],
              desc: "瓜纳巴拉湾畔的奇妙之城：基督像张开双臂站在山顶，糖面包山泡在海里。从葡萄牙王室流亡地到共和国的狂欢节——这座城把苦难也过成了桑巴。",
              c: "南大西洋的门户；殖民史与嘉年华的两面。"
            },
            {
              id: "buenosaires",
              n: "布宜诺斯艾利斯",
              x: 30,
              y: 90,
              t: "city",
              d: 2,
              rg: "南美洲",
              aliases: ["布宜诺斯艾利斯", "南美巴黎", " Buenos Aires"],
              desc: "拉普拉塔河口的南美巴黎：欧洲的移民把它修成了欧式大都会，探戈在街角诞生。肉铺与剧院、码头与庄园——南美的粮仓牵着全欧洲的胃口。",
              c: "南锥体的门户；大西洋南端的枢纽。"
            },
            {
              id: "capehorn",
              n: "合恩角",
              x: 22,
              y: 96,
              t: "wild",
              d: 5,
              rg: "南美洲",
              aliases: ["合恩角", " Cape Horn", "风暴角"],
              desc: "美洲最南的尖角：西风带常年在此发疯，浪高十米是家常便饭。巴拿马运河开通前，想从大西洋去太平洋的帆船没有第二条路——合恩角吃过的船，没人统计得清。",
              c: "帆船时代的鬼门关；两大洋的南端咽喉。"
            },
            {
              id: "honolulu",
              n: "檀香山·夏威夷",
              x: 62,
              y: 44,
              t: "wild",
              d: 3,
              rg: "太平洋",
              aliases: ["檀香山", "夏威夷", "火奴鲁鲁", " Honolulu", "Hawaii"],
              desc: "太平洋十字路口的火山群岛：波利尼西亚人划着双体独木舟最先找到它，后来的捕鲸船、蔗糖园、珍珠港——太平洋的故事有一半要在这片水域里讲。",
              c: "太平洋中继站；航海时代的补给锚地。"
            },
            {
              id: "sydney",
              n: "悉尼·植物学湾",
              x: 82,
              y: 76,
              t: "city",
              d: 2,
              rg: "大洋洲",
              aliases: ["悉尼", "雪梨", "植物学湾", " Sydney"],
              desc: "植物学湾流放犯开始的城：1788 年第一舰队载着囚犯到此，歌剧院的位置当年是采石场。从流放地到南半球的都会——这座城的年轮里刻着帝国的另一面。",
              c: "大洋洲门户；南太平洋的最大都会。"
            }
          ]
        }
      ]
    },
    /* ---------- 凡人修仙传（v3.25.0：天南越国→乱星海→灵界三图层） ---------- */
    fanrenxiuxian: {
      name: "凡人修仙传 · 行旅图鉴",
      flavor: "炼气十三层，一层数着走",
      layers: [
        {
          id: "yueguo",
          name: "天南 · 越国七派",
          ico: "越",
          hint: "正道七派与魔道六宗对峙的江湖之地——凡人仙路的第一程",
          decor: "land",
          regions: [
            { n: "越国七派地界", cx: 36, cy: 46, rx: 22, ry: 16, tr: "plain" },
            { n: "慕兰草原", cx: 76, cy: 20, rx: 16, ry: 11, tr: "desert" },
            { n: "魔道六宗地界", cx: 72, cy: 70, rx: 17, ry: 12, tr: "mountain" }
          ],
          roads: [["qingniu", "qixuan"], ["qixuan", "huangfeng"], ["huangfeng", "yanyue"], ["huangfeng", "xuese"], ["xuese", "modao"], ["huangfeng", "mulan"]],
          nodes: [
            {
              id: "qingniu",
              n: "青牛镇·韩家村",
              x: 20,
              y: 56,
              t: "start",
              d: 1,
              rg: "越国七派地界",
              aliases: ["青牛镇", "韩家村", "青牛镇韩家村"],
              desc: "越国边陲的小镇与村落：土路、麦田、鸡鸣炊烟。韩立从这里揣着三叔的引荐信走出，成了七玄门的记名弟子——凡人视角的仙路，起点低到尘埃里。",
              c: "原著开篇；韩立出身之地（青牛镇韩家村农家子）。"
            },
            {
              id: "qixuan",
              n: "彩霞山·七玄门",
              x: 35,
              y: 49,
              t: "sect",
              d: 2,
              rg: "越国七派地界",
              aliases: ["七玄门", "彩霞山", "神手谷", "墨大夫"],
              desc: "江湖门派而非修仙门派：镖行绿林的营生、刀口舔血的门规。神手谷的墨大夫医术冠绝一门、表面慈和，收徒授药——传功者未必善意，机缘背后多是算计。",
              c: "原著第一卷；墨大夫夺舍之局即原著第一件大事。"
            },
            {
              id: "huangfeng",
              n: "黄枫谷",
              x: 45,
              y: 35,
              t: "sect",
              d: 2,
              rg: "越国七派地界",
              aliases: ["黄枫谷", "百药园", "越国七派"],
              desc: "越国正道七派之一，采药炼丹见长。四灵根资质的杂役弟子在此看守百药园、蛰伏苦修——七派共掌灵脉坊市与收徒大典，与魔道六宗对峙多年。",
              c: "原著韩立出身门派；越国七派：黄枫谷、掩月宗、灵兽山、巨剑门、清虚门、天阙堡、化刀坞。"
            },
            {
              id: "yanyue",
              n: "掩月宗",
              x: 26,
              y: 36,
              t: "sect",
              d: 2,
              rg: "越国七派地界",
              aliases: ["掩月宗", "女修大派"],
              desc: "越国七派之一的女修大派，南宫婉出身之地。正道与魔道的暗流里，掩月宗的消息网比剑光更利——女修的世界自有一套法则。",
              c: "原著七派之一；南宫婉出身门派。"
            },
            {
              id: "xuese",
              n: "血色禁地",
              x: 52,
              y: 56,
              t: "relic",
              d: 4,
              rg: "越国七派地界",
              aliases: ["血色禁地", "血色试炼", "禁地"],
              desc: "七派与魔道六宗争夺的秘境：血色试炼的征召令名额有限、生死自负——功法与死亡名额一起发。灵药灵矿遍地，也白骨遍地，进去的人一半回不来。",
              c: "原著血色试炼篇；门派历练的搏命生意。"
            },
            {
              id: "modao",
              n: "魔道六宗",
              x: 72,
              y: 70,
              t: "danger",
              d: 4,
              rg: "魔道六宗地界",
              aliases: ["魔道六宗", "魔道", "六宗"],
              desc: "与越国七派对峙多年的魔道势力：功法诡异、行事狠辣，与正道划疆而治又蚕食不休。魔道之乱一起，越国山河变色——韩立也因此流落乱星海。",
              c: "原著越国魔道之乱；天南格局的另一半。"
            },
            {
              id: "mulan",
              n: "慕兰草原",
              x: 76,
              y: 20,
              t: "wild",
              d: 3,
              rg: "慕兰草原",
              aliases: ["慕兰草原", "慕兰", "萨满"],
              desc: "越国东北面的异族之地：信奉萨满法师的部落纵横草原，与天南修士连年大战。边患是天南格局的时代底色——圣兽一出，战场便是修士的绞肉机。",
              c: "原著天南慕兰之战；萨满法师的边患。"
            }
          ]
        },
        {
          id: "luanxinghai",
          name: "乱星海 · 星城棋局",
          ico: "海",
          hint: "天南以东的万岛之域——星宫双圣统御要冲，妖族与散修并存",
          decor: "cosmos",
          regions: [
            { n: "星宫内海", cx: 36, cy: 40, rx: 20, ry: 15, tr: "water" },
            { n: "妖族海域", cx: 64, cy: 20, rx: 16, ry: 11, tr: "void" },
            { n: "散修外海", cx: 70, cy: 62, rx: 18, ry: 13, tr: "mountain" }
          ],
          roads: [["tianxing", "xutian"], ["tianxing", "waihai"], ["tianxing", "yaoyu"]],
          nodes: [
            {
              id: "tianxing",
              n: "天星城·星宫",
              x: 32,
              y: 38,
              t: "city",
              d: 3,
              rg: "星宫内海",
              aliases: ["天星城", "星宫", "星城", "双圣"],
              desc: "乱星海的要冲中枢：星宫双圣统御之地，万岛修士在此汇聚。坊市连绵、拍卖会的压轴宝物能引结丹元婴修士亲自下场——化外之地的秩序，全在双圣的规矩里。",
              c: "原著乱星海篇；星宫双圣统御要冲。"
            },
            {
              id: "xutian",
              n: "虚天殿",
              x: 48,
              y: 28,
              t: "relic",
              d: 5,
              rg: "星宫内海",
              aliases: ["虚天殿", "虚天鼎", "古殿"],
              desc: "星海深处的上古遗殿：诸方势力眼中的造化之地。殿开之日群鲨闻腥而至——进得去出不来是常态，机缘与白骨同层相叠。",
              c: "原著乱星海秘境；韩立得虚天鼎之地。"
            },
            {
              id: "yaoyu",
              n: "妖族海域",
              x: 64,
              y: 20,
              t: "danger",
              d: 4,
              rg: "妖族海域",
              aliases: ["妖族", "妖修", "妖域"],
              desc: "妖修盘踞的海域：化形大妖威压一域，人妖两立又互通有无。妖丹与灵材的生意做的人不少——一半喂了海，一半发了财。",
              c: "原著乱星海妖族设定。"
            },
            {
              id: "waihai",
              n: "外海诸岛",
              x: 70,
              y: 62,
              t: "wild",
              d: 3,
              rg: "散修外海",
              aliases: ["外海", "万岛", "诸岛"],
              desc: "散修讨生活的万岛之域：灵矿、妖材、海盗与捡漏。天高星宫远，穷字当头的散修在这里搏每一枚灵石——乱世的秩序，是活下来的人定的。",
              c: "原著乱星海散修生态；韩立结丹之地。"
            }
          ]
        },
        {
          id: "lingjie",
          name: "灵界 · 万族争锋",
          ico: "灵",
          hint: "飞升者的世界——人妖魔万族林立，天渊城是种族战争的前线",
          decor: "cosmos",
          regions: [
            { n: "人族疆域", cx: 32, cy: 40, rx: 20, ry: 15, tr: "plain" },
            { n: "天渊前线", cx: 66, cy: 34, rx: 16, ry: 12, tr: "mountain" },
            { n: "魔族地界", cx: 64, cy: 72, rx: 18, ry: 13, tr: "void" }
          ],
          roads: [["renjiang", "tianyuan"], ["tianyuan", "moyuan"]],
          nodes: [
            {
              id: "renjiang",
              n: "人族疆域",
              x: 28,
              y: 42,
              t: "city",
              d: 2,
              rg: "人族疆域",
              aliases: ["人族", "人族疆域", "飞升者落地"],
              desc: "飞升者落地的世界一角：灵气充沛、法则完整，城池与大洲层层叠叠。人界的恩怨情仇到了这里只是起点——格局一层层放大，境界也一层层重排。",
              c: "原著灵界篇；飞升者的时代。"
            },
            {
              id: "tianyuan",
              n: "天渊城",
              x: 66,
              y: 34,
              t: "sect",
              d: 4,
              rg: "天渊前线",
              aliases: ["天渊城", "天渊", "前线要塞"],
              desc: "人族对抗魔族的前线要塞：万年攻防、尸山血海。戍边的修士用军功换资源——最残酷的战场，也是最快的登天梯。",
              c: "原著灵界天渊城；人族前线要塞。"
            },
            {
              id: "moyuan",
              n: "魔族地界",
              x: 64,
              y: 72,
              t: "danger",
              d: 5,
              rg: "魔族地界",
              aliases: ["魔族", "魔劫", "魔军"],
              desc: "魔族大军压境的方向：魔劫一起，灵界诸族都要选边站。深渊那头的秩序与人界截然两样——那是修真生态的另一极，也是大道之争的尽头。",
              c: "原著灵界魔族设定；魔劫的来处。"
            }
          ]
        }
      ]
    },
    /* ---------- 仙逆（v3.25.0：赵国→天南→罗天星域三图层） ---------- */
    xianni: {
      name: "仙逆 · 行旅图鉴",
      flavor: "顺为凡，逆则仙，只在心中一念间",
      layers: [
        {
          id: "zhaoguo",
          name: "赵国 · 凡尘道途",
          ico: "赵",
          hint: "恒岳派与藤家的修真格局——逆天路的起点，也是血仇的来处",
          decor: "land",
          regions: [
            { n: "赵国腹地", cx: 40, cy: 44, rx: 22, ry: 16, tr: "plain" },
            { n: "恒岳山地", cx: 76, cy: 28, rx: 15, ry: 11, tr: "mountain" },
            { n: "藤家地界", cx: 72, cy: 70, rx: 16, ry: 11, tr: "mountain" }
          ],
          roads: [["wangjiacun", "hengyue"], ["hengyue", "tengjia"], ["wangjiacun", "tengjia"], ["hengyue", "xuandao"], ["wangjiacun", "shiyin"]],
          nodes: [
            {
              id: "wangjiacun",
              n: "王家村",
              x: 26,
              y: 52,
              t: "start",
              d: 1,
              rg: "赵国腹地",
              aliases: ["王家村", "王林故乡", "村口"],
              desc: "土墙茅舍、鸡鸣炊烟。四叔领着测灵的少年从这里走出村口——多年后王林回来时，只剩满门的新坟。凡尘的重量，是「逆」字的来处。",
              c: "原著开篇；王林故乡，王家灭门之地。"
            },
            {
              id: "hengyue",
              n: "恒岳派",
              x: 76,
              y: 30,
              t: "sect",
              d: 2,
              rg: "恒岳山地",
              aliases: ["恒岳派", "恒岳", "测灵台", "杂役房"],
              desc: "赵国修真门派：收徒大典开山测灵，资质上佳者入内门，平庸者受尽冷眼在底层苦熬。杂役房的少年在这里偶得天逆珠——仙路的转机，藏在最不起眼的角落。",
              c: "原著第一卷；王林入门之地，天逆珠机缘所在。"
            },
            {
              id: "tengjia",
              n: "藤家",
              x: 72,
              y: 68,
              t: "danger",
              d: 4,
              rg: "藤家地界",
              aliases: ["藤家", "藤家城", "修真家族"],
              desc: "赵国修真家族：血脉传承、家规森严，与门派争地盘、结姻亲、算旧账。门中子弟的跋扈牵出血仇——王家灭门之夜的火，从这里烧起。",
              c: "原著前期；血仇的源头，王林命运的转折。"
            },
            {
              id: "xuandao",
              n: "玄道宗",
              x: 52,
              y: 50,
              t: "sect",
              d: 3,
              rg: "赵国腹地",
              aliases: ["玄道"],
              desc: "赵国后起的强势门派，压得恒岳派抬不起头。收徒、联姻、抢灵脉，手段比功法更熟练——修真界第一堂\"现实课\"。",
              c: "原著赵国格局；与恒岳派分庭抗礼的门派。"
            },
            {
              id: "shiyin",
              n: "尸阴宗",
              x: 30,
              y: 36,
              t: "sect",
              d: 4,
              rg: "赵国腹地",
              aliases: ["尸阴"],
              desc: "修真联盟两大顶级宗门之一，以控尸、养尸、卖尸为业。宗门之人行止诡异，手上却握着别人求不到的东西。",
              c: "原著顶级宗门设定；南云子一脉。"
            }
          ]
        },
        {
          id: "tiannan",
          name: "天南 · 群雄杀伐",
          ico: "南",
          hint: "凶名与机缘并起之地——宗门与修真家族盘根错节，杀伐成风",
          decor: "land",
          regions: [
            { n: "天南群雄地", cx: 38, cy: 44, rx: 24, ry: 17, tr: "plain" },
            { n: "秘境凶地带", cx: 74, cy: 28, rx: 16, ry: 12, tr: "mountain" },
            { n: "边荒流亡地", cx: 70, cy: 70, rx: 17, ry: 12, tr: "desert" },
            { n: "修魔海", cx: 30, cy: 70, rx: 15, ry: 11, tr: "water" }
          ],
          roads: [["fangshi", "guishi"], ["guishi", "jingdi"], ["fangshi", "bianhuang"], ["fangshi", "yuntian"], ["guishi", "xiumohai"]],
          nodes: [
            {
              id: "fangshi",
              n: "天南坊市",
              x: 30,
              y: 38,
              t: "city",
              d: 3,
              rg: "天南群雄地",
              aliases: ["坊市", "天南坊市", "集市"],
              desc: "群雄地界的修士集市：明面售功法丹药法器，暗地流通消息、悬赏与杀令。凶名在此流转，机缘也在此过手——一半的恩怨从坊市结起。",
              c: "原著天南生态；消息与悬赏的枢纽。"
            },
            {
              id: "guishi",
              n: "鬼市",
              x: 46,
              y: 58,
              t: "danger",
              d: 4,
              rg: "天南群雄地",
              aliases: ["鬼市", "黑市"],
              desc: "夜半才开的黑市：摊主不点灯，货物不看价，规矩只有一条——不问来路。修真界最暗的角落，进去的人各怀鬼胎，出来的东西未必都带着干净账。",
              c: "原著修真界黑市；这方天地的暗面。"
            },
            {
              id: "jingdi",
              n: "秘境凶地",
              x: 74,
              y: 28,
              t: "relic",
              d: 4,
              rg: "秘境凶地带",
              aliases: ["秘境", "凶地", "传承之地"],
              desc: "传承、凶地、机缘层层叠叠之地：强者吃肉、弱者垫刀。王林在此杀出赫赫凶名——天南格局因他数次洗牌，凶名是资产也是靶子。",
              c: "原著天南篇；凶名与机缘并起之地。"
            },
            {
              id: "bianhuang",
              n: "边荒流亡地",
              x: 70,
              y: 70,
              t: "wild",
              d: 3,
              rg: "边荒流亡地",
              aliases: ["边荒", "流亡地", "荒野"],
              desc: "天南边缘的流亡之地：仇家追杀令下的人、门派倾轧的败者、亡命的散修都在这里讨生活。杀令悬着的日子，出门先看风向。",
              c: "原著散修亡命生态；王林流亡线参照。"
            },
            {
              id: "yuntian",
              n: "云天宗",
              x: 24,
              y: 50,
              t: "sect",
              d: 3,
              rg: "天南群雄地",
              aliases: ["云天"],
              desc: "以炼丹立身的宗门，丹香飘出十里。李慕婉在此执掌丹炉，也在此把一生的寿元，一点点炼进了别人的保命符里。",
              c: "原著宗门线；李慕婉与丹道线。"
            },
            {
              id: "xiumohai",
              n: "修魔海",
              x: 28,
              y: 68,
              t: "danger",
              d: 5,
              rg: "修魔海",
              aliases: ["修魔", "内海", "外海"],
              desc: "横亘四大陆之间的魔域之海，内海外海、九百九十九座城池。躲追杀的人往这里钻，追杀的人也往这里钻——王林在内海的碎心乱，撞上了古神传承。",
              c: "原著修魔海篇；古神传承的关键地。"
            }
          ]
        },
        {
          id: "luotian",
          name: "罗天星域 · 大能棋局",
          ico: "星",
          hint: "朱雀星之外的浩瀚星空——联盟与古族各执棋子，古神传承沉睡其间",
          decor: "cosmos",
          regions: [
            { n: "星域联盟地", cx: 34, cy: 38, rx: 20, ry: 14, tr: "city" },
            { n: "古族疆域", cx: 72, cy: 30, rx: 16, ry: 12, tr: "mountain" },
            { n: "古神之地", cx: 62, cy: 70, rx: 18, ry: 13, tr: "void" },
            { n: "界外虚空", cx: 91, cy: 60, rx: 8, ry: 12, tr: "void" }
          ],
          roads: [["lianmeng", "guzu"], ["guzu", "gushen"], ["gushen", "jiewai"], ["lianmeng", "zhuque"], ["zhuque", "tianyun"]],
          nodes: [
            {
              id: "lianmeng",
              n: "星域联盟",
              x: 32,
              y: 36,
              t: "sect",
              d: 3,
              rg: "星域联盟地",
              aliases: ["联盟", "星域联盟"],
              desc: "罗天星域的大势力：亿万星辰、诸界并立，联盟执子之手在云端落子。跨星而行是第一步巅峰者的奢望——星域层次的争锋，动辄牵动数星生灭。",
              c: "原著罗天星域篇；联盟棋局。"
            },
            {
              id: "guzu",
              n: "古族",
              x: 72,
              y: 30,
              t: "sect",
              d: 4,
              rg: "古族疆域",
              aliases: ["古族", "古老族群"],
              desc: "星海深处的古老族群：底蕴深不见底，与联盟各执棋子。低境界修士只看得见棋盘的一角——大能的算计，是这个世界永不停歇的背景音。",
              c: "原著罗天星域篇；古族设定。"
            },
            {
              id: "gushen",
              n: "古神之地",
              x: 60,
              y: 70,
              t: "relic",
              d: 5,
              rg: "古神之地",
              aliases: ["古神之地", "涂司", "古神传承"],
              desc: "涂司一脉的传承所在：古神以肉身成圣，不修元婴、不炼法宝，一身血肉即是神通。传承、考验、陨落者的白骨层层相叠——造化与凶险等价。",
              c: "原著古神之地篇；涂司传承，王林脱胎换骨之地。"
            },
            {
              id: "jiewai",
              n: "界外虚空",
              x: 90,
              y: 58,
              t: "danger",
              d: 5,
              rg: "界外虚空",
              aliases: ["界外", "虚空", "星域之外"],
              desc: "星域之外还有星域，天地之外还有天地：赵国→天南→罗天星域→界外，每一层都是数量级的跃升。跨星离乡是纪元级的转折——故土与坟茔，从此隔着星空。",
              c: "原著世界观纵深；界外虚空。"
            },
            {
              id: "zhuque",
              n: "朱雀星",
              x: 22,
              y: 30,
              t: "city",
              d: 3,
              rg: "星域联盟地",
              aliases: ["朱雀"],
              desc: "王林出身的那颗修真星，六块大陆、无数修真国。恒岳派、藤家、赵国都在这一方天地里——此后千年，他再回望时，故土已成星图上的一个点。",
              c: "原著第一卷舞台；朱雀星六大陆设定。"
            },
            {
              id: "tianyun",
              n: "天运星",
              x: 42,
              y: 26,
              t: "relic",
              d: 4,
              rg: "星域联盟地",
              aliases: ["天运"],
              desc: "天运子坐镇的七级修真星，算尽天机者之门庭。王林在此拜师学天运之道，也在此第一次感到——有人一直在算他。",
              c: "原著天运星篇；天运子师徒线与伏笔源头。"
            }
          ]
        }
      ]
    },
    /* ---------- 全球冰封 ---------- */
    quanqiubingfeng: {
      name: "全球冰封 · 行旅图鉴",
      flavor: "上一世的敲门声，这一世的三十天",
      layers: [
        {
          id: "tianhai",
          name: "天海市 · 灾变前夜",
          ico: "市",
          hint: "2050年11月——倒计时三十天的城市，一切还来得及",
          decor: "city",
          regions: [
            { n: "城东·翡翠湾", cx: 34, cy: 66, rx: 16, ry: 12, tr: "city" },
            { n: "城北·仓储区", cx: 30, cy: 32, rx: 17, ry: 12, tr: "city" },
            { n: "市中心", cx: 57, cy: 52, rx: 17, ry: 14, tr: "city" },
            { n: "城西·物流园", cx: 80, cy: 66, rx: 14, ry: 11, tr: "city" },
            { n: "远郊·山岭", cx: 84, cy: 24, rx: 13, ry: 11, tr: "mountain" }
          ],
          roads: [["feicuiwan", "pifa"], ["feicuiwan", "yiyuan"], ["feicuiwan", "gaolin"], ["pifa", "cangku"], ["cangku", "wuliu"], ["gaolin", "qixiangju"], ["wuliu", "shanlin"]],
          nodes: [
            {
              id: "feicuiwan",
              n: "翡翠湾小区",
              x: 30,
              y: 66,
              t: "start",
              d: 2,
              rg: "城东·翡翠湾",
              aliases: ["翡翠湾", "小区", "安全屋", "家"],
              desc: "两百来户的中档商品住宅——玩家的主舞台与安全屋所在。门禁、监控、业主群、点头之交的邻居：上辈子递出善意又被他们分食的地方，这辈子要变成全世界最硬的堡垒。",
              c: "原著主场景；安全屋与恶邻群像的舞台。"
            },
            {
              id: "cangku",
              n: "沃尔玛仓库",
              x: 26,
              y: 32,
              t: "relic",
              d: 2,
              rg: "城北·仓储区",
              aliases: ["仓库", "沃尔玛", "华南区仓库", "大仓"],
              desc: '百亿物资的海洋。货架连着货架，监控死角连着监控死角——仓储主管闭着眼都能画出每条通道，只是没人知道哪些"进货损耗"进了识海里的黑暗虚空。',
              c: "原著张奕的职业舞台；囤货流第一据点。"
            },
            {
              id: "pifa",
              n: "城北批发市场",
              x: 38,
              y: 36,
              t: "city",
              d: 1,
              rg: "城北·仓储区",
              aliases: ["批发市场", "粮油市场", "市场"],
              desc: "论斤进货论吨卖货的地方。粮油摊主看粮食的眼光跟看金子一样——大宗走账要趁早，抢购潮一起，这里的价钱一天三变。",
              c: "原著大宗囤货渠道；物价风向标。"
            },
            {
              id: "yiyuan",
              n: "市第一人民医院",
              x: 46,
              y: 62,
              t: "sect",
              d: 2,
              rg: "市中心",
              aliases: ["市一院", "医院", "第一人民医院"],
              desc: "周可儿的阵地。急诊科的灯二十四小时亮着，抗生素与退烧药在货架上排队——灾变前这里挤破头，灾变后一根抗生素换一条命。",
              c: "原著周可儿线主场景；药品命脉。"
            },
            {
              id: "gaolin",
              n: "高架环线",
              x: 60,
              y: 42,
              t: "danger",
              d: 3,
              rg: "市中心",
              aliases: ["高架", "环线", "堵车", "立交"],
              desc: "灾变日的堵死动脉。抢购潮起时排到天边的车龙、寒潮降临后冻在原地的一排排铁壳——有人弃车而逃，有人一辈子留在了驾驶座上。",
              c: "原著灾变日名场面；出城之路的坟墓。"
            },
            {
              id: "qixiangju",
              n: "气象局",
              x: 68,
              y: 56,
              t: "sect",
              d: 2,
              rg: "市中心",
              aliases: ["气象局", "气象台", "预警中心"],
              desc: '预警的源头，也是含糊其辞的源头。极光的报告压在抽屉里，"降温预报"的字眼改了又改——老同学的值班电话，比新闻早四十八小时。',
              c: "原著预警线；灾变信息的第一手来源。"
            },
            {
              id: "wuliu",
              n: "城西物流园",
              x: 80,
              y: 64,
              t: "city",
              d: 2,
              rg: "城西·物流园",
              aliases: ["物流园", "货运站", "冷链"],
              desc: "卡车与冷库的世界。柴油、冷链、整托盘的方便面——有渠道的人在这里一车一车地往外拉，没渠道的人在抢购潮里抢购物车。",
              c: "原著物流渠道；大宗物资的集散地。"
            },
            {
              id: "shanlin",
              n: "远郊山岭",
              x: 86,
              y: 22,
              t: "wild",
              d: 3,
              rg: "远郊·山岭",
              aliases: ["山里", "远郊", "水库", "山区"],
              desc: '城市尽头的山与水库。猎人的雪路、看林人的小屋、冻住的水面——极寒期过后，这里是还能"打猎"的地方，也是最早被雪封死的地方。',
              c: "原著远郊生存线；狩猎与避难。"
            }
          ]
        },
        {
          id: "bingfeng",
          name: "冰封死城 · 深寒纪元",
          ico: "冰",
          hint: "-40℃以下——死城、据点与豺狼的时代",
          decor: "land",
          regions: [
            { n: "死城街区", cx: 34, cy: 48, rx: 24, ry: 17, tr: "city" },
            { n: "地下网络", cx: 68, cy: 34, rx: 18, ry: 13, tr: "void" },
            { n: "帮派割据带", cx: 64, cy: 72, rx: 20, ry: 13, tr: "desert" }
          ],
          roads: [["jiaqu", "ditie"], ["ditie", "guolu"], ["guolu", "shangchang"], ["shangchang", "tianhe"], ["jiaqu", "heiwu"]],
          nodes: [
            {
              id: "jiaqu",
              n: "小区据点",
              x: 24,
              y: 46,
              t: "start",
              d: 3,
              rg: "死城街区",
              aliases: ["小区", "翡翠湾据点", "路障"],
              desc: '断电后的翡翠湾：路障、巡逻的邻居、分粮的账本。体面在一周内耗尽——业主群从"互相帮助"变成"资源共享"，再变成拉帮结派的豺狼窝。',
              c: "原著深寒期主场景；人性绞杀的第一线。"
            },
            {
              id: "heiwu",
              n: "冻毙街巷",
              x: 44,
              y: 58,
              t: "danger",
              d: 4,
              rg: "死城街区",
              aliases: ["街巷", "冻尸", "死街"],
              desc: "保持着跑的姿势的冻毙者、撬空了的商铺、冻住的车阵。白天是白毛风的世界，夜里是狼嚎与撬门声的世界——活人给死人让路的地方。",
              c: "原著深寒期街景；死城的日常。"
            },
            {
              id: "ditie",
              n: "地铁站据点",
              x: 58,
              y: 30,
              t: "sect",
              d: 3,
              rg: "地下网络",
              aliases: ["地铁", "地铁站", "地下"],
              desc: "地下迷宫里的热岛。幸存者围着锅炉蜷缩，配给按人头算，进出要登记——地下的温度比地面高二十度，人心比地面低二十度。",
              c: "原著据点时代代表；地下生存线。"
            },
            {
              id: "guolu",
              n: "锅炉房据点",
              x: 74,
              y: 42,
              t: "city",
              d: 3,
              rg: "地下网络",
              aliases: ["锅炉房", "热源", "暖站"],
              desc: "一切围着热源转的时代地标。煤与柴决定据点寿命，守炉的人握着实权——来这里换暖的人，兜里都揣着最后的家当。",
              c: "原著据点生态；热源即秩序。"
            },
            {
              id: "shangchang",
              n: "大商场据点",
              x: 66,
              y: 76,
              t: "arena",
              d: 4,
              rg: "帮派割据带",
              aliases: ["商场", "购物中心", "大卖场"],
              desc: "被帮派接管的大卖场：货架分区变势力分赃，一楼易货二楼住人地下车库是刑场——这里的规矩写在墙上，破规矩的人挂在墙上。",
              c: "原著天合帮势力圈；据点时代的黑市。"
            },
            {
              id: "tianhe",
              n: "天合帮地盘",
              x: 82,
              y: 70,
              t: "danger",
              d: 5,
              rg: "帮派割据带",
              aliases: ["天合帮", "帮派", "帮会"],
              desc: '以狠辣和地盘意识崛起的末世帮派。收"保护税"、垄断黑市、征募异能者——在他们的地盘上，独行者的行李从来不属于自己。',
              c: "原著帮派线；据点时代最直接的暴力威胁。"
            }
          ]
        },
        {
          id: "xinlanxing",
          name: "新蓝星纪元 · 虚空尽头",
          ico: "星",
          hint: "第二波伽马冲击前后——百年沉睡与最后的方舟",
          decor: "cosmos",
          regions: [
            { n: "识海虚空", cx: 23, cy: 52, rx: 20, ry: 18, tr: "void" },
            { n: "冰封蓝星", cx: 66, cy: 38, rx: 20, ry: 15, tr: "water" },
            { n: "沉睡基地带", cx: 70, cy: 76, rx: 18, ry: 12, tr: "void" }
          ],
          roads: [["xukong", "binghe"], ["binghe", "chenmian"], ["xukong", "xinlanxing"]],
          nodes: [
            {
              id: "xukong",
              n: "识海虚空",
              x: 26,
              y: 40,
              t: "relic",
              d: 3,
              rg: "识海虚空",
              aliases: ["虚空", "识海", "空间", "异空间"],
              desc: "意念深处的黑暗国度。收放万物、时间停滞、容量随岁月成长——从初开虚空的方寸之地，到装得下山河的随身世界：异能者的尽头，是把家搬进虚空。",
              c: "原著空间异能本体；玩家的随身仓库。"
            },
            {
              id: "binghe",
              n: "冰封蓝星",
              x: 62,
              y: 36,
              t: "wild",
              d: 5,
              rg: "冰封蓝星",
              aliases: ["蓝星", "冰河时代", "极寒世界"],
              desc: "-89℃的白色星球。大气在凝华、海洋在加深、文明的名字埋在雪下——五千年后地质纪年的新篇章，正在此刻结冰。",
              c: "原著世界观纵深；冰河时代的蓝星全貌。"
            },
            {
              id: "chenmian",
              n: "百年沉睡基地",
              x: 70,
              y: 74,
              t: "sect",
              d: 4,
              rg: "沉睡基地带",
              aliases: ["沉睡计划", "休眠舱", "百年沉睡"],
              desc: '国家级的豪赌：低温休眠舱与长期生命维持系统，"睡过这个冬天"的百年之约。舱门合上前没人知道答案——醒来时是春天，还是永远。',
              c: "原著后期脉络；百年沉睡计划。"
            },
            {
              id: "xinlanxing",
              n: "新蓝星空间",
              x: 20,
              y: 70,
              t: "relic",
              d: 5,
              rg: "识海虚空",
              aliases: ["新蓝星", "新蓝星空间", "方舟"],
              desc: '空间异能进化的终极形态：可居住、可耕种、可成长的"新蓝星"尺度。冰河时代里最后的方舟——当外面的一切都冻死，方舟里还能种出春天。',
              c: "原著终极脉络；空间进化的尽头。"
            }
          ]
        }
      ]
    },
    /* ---------- 超神学院（v3.37.0：诸神注视下的地球） ---------- */
    chaoshenxueyuan: {
      name: "超神学院 · 行旅图鉴",
      flavor: "饕餮在天上，你身后是万家灯火",
      layers: [
        {
          id: "juxia",
          name: "巨峡市 · 诸神初临",
          ico: "神",
          hint: "饕餮舰队进入太阳系——凡人时代落幕，诸神时代开幕",
          decor: "city",
          regions: [
            { n: "巨峡城区", cx: 44, cy: 49, rx: 20, ry: 15, tr: "city" },
            { n: "军事管制带", cx: 74, cy: 34, rx: 15, ry: 12, tr: "mountain" },
            { n: "近郊防线", cx: 30, cy: 71, rx: 20, ry: 14, tr: "desert" }
          ],
          roads: [["xueyuan", "xiongbing"], ["xueyuan", "junqu"], ["xueyuan", "jiuxia"], ["junqu", "fangxian"], ["jiuxia", "gangkou"], ["xiongbing", "fangxian"]],
          nodes: [
            {
              id: "xueyuan",
              n: "超神学院",
              x: 42,
              y: 46,
              t: "start",
              d: 1,
              rg: "巨峡城区",
              aliases: ["学院", "超神学院", "校址"],
              desc: "天使援建的神秘学府：明面上是高校，底下是超级基因的摇篮。教学楼、实训场、基因实验室——从这里走出来的，是一代又一代扛住诸神时代的超级战士。",
              c: "原著主舞台；基因觉醒与集训的起点。"
            },
            {
              id: "xiongbing",
              n: "雄兵连基地",
              x: 58,
              y: 58,
              t: "sect",
              d: 2,
              rg: "巨峡城区",
              aliases: ["雄兵连", "基地", "连部"],
              desc: "地球防卫军最锋利的一把刀。军械库、模拟战舱、战术沙盘与永远亮着的指挥室——从这里派出去的任务，回得来才叫任务，回不来的叫牺牲。",
              c: "原著核心编制；玩家的归属与战场。"
            },
            {
              id: "junqu",
              n: "巨峡军分区",
              x: 76,
              y: 30,
              t: "city",
              d: 2,
              rg: "军事管制带",
              aliases: ["军分区", "军区", "司令部"],
              desc: "战争机器的中枢。征兵令、配给令、宵禁令都从这里发出去——大人物们对着星图争论空天军的部署，而窗外的城市还在过最后一段寻常日子。",
              c: "原著军方线；军功晋升的必经之路。"
            },
            {
              id: "jiuxia",
              n: "旧峡街区",
              x: 30,
              y: 40,
              t: "city",
              d: 1,
              rg: "巨峡城区",
              aliases: ["旧街", "老城区", "街区"],
              desc: "市井烟火与前沿科幻同框的地方。早点摊的蒸汽混着巡逻机的轰鸣，孩子的书包上挂着天使挂件——被诸神注视的普通人，日子照过，也照怕。",
              c: "原著市民视角；军民同框的日常舞台。"
            },
            {
              id: "gangkou",
              n: "远洋港区",
              x: 22,
              y: 62,
              t: "relic",
              d: 2,
              rg: "近郊防线",
              aliases: ["港口", "港区", "码头"],
              desc: '防空识别区的前哨。货轮与军舰同泊，起重机臂下是堆成山的集装箱——第一次饕餮空袭时，这里是巨峡市看见"天塌了"的地方。',
              c: "原著空袭线；平民撤离与守备战场。"
            },
            {
              id: "fangxian",
              n: "近郊防线",
              x: 44,
              y: 80,
              t: "danger",
              d: 3,
              rg: "近郊防线",
              aliases: ["防线", "外围防线", "战壕"],
              desc: "城市最后的墙。战壕、龙牙桩、防空炮位与一轮轮换防的士兵——这里的每个人都知道火力打不穿神级，但身后是家，所以不走。",
              c: "原著守土线；断后与牺牲的舞台。"
            }
          ]
        },
        {
          id: "diqiu",
          name: "地球战场 · 诸神博弈",
          ico: "战",
          hint: "雄兵连至烈阳天道——战火从巨峡烧向全球",
          decor: "land",
          regions: [
            { n: "华夏战区", cx: 32, cy: 42, rx: 24, ry: 27, tr: "plain" },
            { n: "沦陷废土带", cx: 67, cy: 64, rx: 18, ry: 15, tr: "desert" },
            { n: "极地虚空界", cx: 24, cy: 78, rx: 14, ry: 10, tr: "void" }
          ],
          roads: [["tianren", "zhanqu"], ["zhanqu", "feitutai"], ["feitutai", "anjiangjie"], ["anjiangjie", "kongdian"]],
          nodes: [
            {
              id: "zhanqu",
              n: "华夏联合战区",
              x: 32,
              y: 34,
              t: "city",
              d: 2,
              rg: "华夏战区",
              aliases: ["战区", "联合指挥部", "联合战区"],
              desc: "全球最完整的军事体系。空天战机、轨道炮阵地、成建制的超级战士——在诸神的棋盘上，这里是地球文明还能执子的证明。",
              c: "原著战区线；大战役的指挥中枢。"
            },
            {
              id: "tianren",
              n: "天刃·轨道泊位",
              x: 18,
              y: 22,
              t: "relic",
              d: 4,
              rg: "华夏战区",
              aliases: ["天刃", "天刃七号", "轨道"],
              desc: "悬在近地轨道的天使之城。圣光织成的船体与地球的卫星同轨——天使的意志从这里俯瞰人间，凯莎的威压也从这里压下来。",
              c: "原著天使线；天使文明的中枢要地。"
            },
            {
              id: "feitutai",
              n: "饕餮登陆场",
              x: 62,
              y: 52,
              t: "danger",
              d: 4,
              rg: "沦陷废土带",
              aliases: ["登陆场", "陨落区", "战场遗迹"],
              desc: "第一次接触战争留下的疤。焦黑的巨坑、扭曲的装甲残骸、至今还在的虚空余波——饕餮的先锋从这里踏上地球，也从这里被打回去。",
              c: "原著血战线；老兵们的伤心地。"
            },
            {
              id: "anjiangjie",
              n: "暗界裂隙带",
              x: 72,
              y: 76,
              t: "wild",
              d: 5,
              rg: "沦陷废土带",
              aliases: ["裂隙", "暗界", "虫门"],
              desc: "卡尔暗世界渗入现实的伤口。紫黑色的能量在裂隙里翻涌，靠近的人会听见低语——恶魔的虫门与虚空的裂隙，都在这里与地球短兵相接。",
              c: "原著虚空线；暗面博弈的入口。"
            },
            {
              id: "kongdian",
              n: "空天母舰基地",
              x: 46,
              y: 62,
              t: "sect",
              d: 3,
              rg: "华夏战区",
              aliases: ["母舰", "空天基地", "机场"],
              desc: "钢铁巨鲸的巢穴。跑道尽头停着随时升空的空天战机，地勤在甲板上奔走——人类用工业文明的极限，给自己造了一双够得着天空的翅膀。",
              c: "原著科技线；空天力量的心脏。"
            }
          ]
        },
        {
          id: "xingji",
          name: "星际深空 · 文明棋局",
          ico: "星",
          hint: "天使星云、烈阳、冥河——诸神各自的疆土",
          decor: "cosmos",
          regions: [
            { n: "天使星云", cx: 26, cy: 32, rx: 16, ry: 13, tr: "water" },
            { n: "烈阳星域", cx: 74, cy: 33, rx: 16, ry: 12, tr: "desert" },
            { n: "暗世界虚空", cx: 60, cy: 70, rx: 24, ry: 12, tr: "void" }
          ],
          roads: [["tianshi", "lieyang"], ["tianshi", "minghe"], ["minghe", "anhei"], ["lieyang", "feileize"]],
          nodes: [
            {
              id: "tianshi",
              n: "天使星云·圣城",
              x: 22,
              y: 28,
              t: "relic",
              d: 5,
              rg: "天使星云",
              aliases: ["圣城", "天使星云", "天城"],
              desc: "圣光的源头。浮空的神殿、金色的云海、世代传承的天使军团——凯莎的王座在这里，天使的正义也从这里出发：护佑文明，或者审判文明。",
              c: "原著天使文明心脏；圣光叙事的源头。"
            },
            {
              id: "lieyang",
              n: "烈阳星",
              x: 66,
              y: 26,
              t: "sect",
              d: 5,
              rg: "烈阳星域",
              aliases: ["烈阳", "烈阳文明", "潘震"],
              desc: "恒日之火锻造的军事文明。以战养战的烈阳人信奉实力即公理——他们是地球最凶的敌人之一，却也和地球最像：都在用战争换取生存。",
              c: "原著烈阳线；另类军神的疆土。"
            },
            {
              id: "minghe",
              n: "冥河要塞",
              x: 44,
              y: 62,
              t: "danger",
              d: 5,
              rg: "暗世界虚空",
              aliases: ["冥河", "恶魔星域", "莫甘娜"],
              desc: "恶魔文明的巢穴。虫门在此开合，莫甘娜的军团在此集结——恶魔的逻辑简单直接：要么跪下，要么烧掉。这里的每一次集结，都是地球的一次倒计时。",
              c: "原著恶魔线；虫门战争策源地。"
            },
            {
              id: "anhei",
              n: "卡尔暗世界",
              x: 76,
              y: 78,
              t: "wild",
              d: 5,
              rg: "暗世界虚空",
              aliases: ["暗世界", "虚空", "卡尔"],
              desc: '虚空尽头的彼岸。吞噬光与热的暗物质疆域，卡尔在此推演他的"救世"——对暗世界而言，诸神的时代该结束了，包括天使，也包括地球。',
              c: "原著终极暗线；文明级威胁的本体。"
            },
            {
              id: "feileize",
              n: "费雷泽星球",
              x: 84,
              y: 40,
              t: "city",
              d: 4,
              rg: "烈阳星域",
              aliases: ["费雷泽", "弗雷泽"],
              desc: "被卷入诸神战争的边缘文明。科技不高、运气很差，恰好卡在几大文明的航线上——小文明在大棋局里的挣扎，是这颗星球全部的戏份。",
              c: "原著外线战场；文明夹缝的缩影。"
            }
          ]
        }
      ]
    },
    /* ---------- 我在精神病院学斩神（v3.38.0：迷雾笼罩的都市） ---------- */
    zhanhen: {
      name: "斩神 · 行旅图鉴",
      flavor: "大夏境内，神明禁行",
      layers: [
        {
          id: "cangnan",
          name: "沧南市 · 昼夜双面",
          ico: "沧",
          hint: "沧南奇迹的市民在此生活十年——没人知道自己是被奇迹复苏的",
          decor: "city",
          regions: [
            { n: "沧南城区", cx: 49, cy: 48, rx: 26, ry: 15, tr: "city" },
            { n: "旧城巷陌", cx: 22, cy: 36, rx: 14, ry: 11, tr: "forest" },
            { n: "城郊结合带", cx: 70, cy: 74, rx: 16, ry: 11, tr: "desert" }
          ],
          roads: [["bingyuan", "shao"], ["shao", "xiaoyuan"], ["bingyuan", "jiequ"], ["jiequ", "jiuye"], ["shao", "jiuye"]],
          nodes: [
            {
              id: "bingyuan",
              n: "阳光精神病院",
              x: 30,
              y: 56,
              t: "relic",
              d: 3,
              rg: "沧南城区",
              aliases: ["精神病院", "阳光病院", "病院"],
              desc: '市立破败精神病院，实为诸神疗伤的居所——六间病房住着六位"病人"：黑夜女神尼克斯、梅林、孙悟空、吉尔伽美什……他们随便逃出一个，都能让整片大陆重新洗牌。院长林七夜在此守家。',
              c: "原著最特殊地点；温情与恐怖一体两面。"
            },
            {
              id: "shao",
              n: "守夜人哨点",
              x: 50,
              y: 40,
              t: "sect",
              d: 2,
              rg: "沧南城区",
              aliases: ["哨点", "136小队", "小队驻地"],
              desc: "沧南136小队驻地：任务板、装备库、会议室与永远煮着水的茶水间。守夜人的家——出任务时性命相托，回来时能喝上一口热水。",
              c: "原著组织线；守夜人日常的舞台。"
            },
            {
              id: "xiaoyuan",
              n: "沧南夜市",
              x: 68,
              y: 46,
              t: "city",
              d: 1,
              rg: "沧南城区",
              aliases: ["夜市", "小吃街", "市集"],
              desc: "霓虹与烟火气的据点。烤串摊、糖水铺、代驾司机与加班晚归的普通人——迷雾时代里，这点烟火是全城人的定心丸。",
              c: "原著市井线；日常温情的地标。"
            },
            {
              id: "jiequ",
              n: "旧城街区",
              x: 22,
              y: 32,
              t: "city",
              d: 2,
              rg: "旧城巷陌",
              aliases: ["旧街", "老城区", "巷陌"],
              desc: '都市传说的温床。深夜的敲门声、消失的流浪猫、老人们讳莫如深的"雾里的事"——旧城的巷子比新城更深，传闻也比新闻更真。',
              c: "原著传闻线；神秘事件的策源地。"
            },
            {
              id: "jiuye",
              n: "九野商圈",
              x: 60,
              y: 74,
              t: "city",
              d: 1,
              rg: "城郊结合带",
              aliases: ["商圈", "九野", "写字楼"],
              desc: "白领、外卖与写字楼的白昼秩序。没人知道楼下的便利店老板见过几次守夜人换防，也没人知道加班的深夜里雾会漫到第几层台阶。",
              c: "原著都市线；昼夜双面的切面。"
            }
          ]
        },
        {
          id: "shouye",
          name: "守夜战线 · 入夜之后",
          ico: "夜",
          hint: "巡逻、镇守、低语、刀光——守夜人守的是夜里的万家灯火",
          decor: "land",
          regions: [
            { n: "外围巡逻带", cx: 40, cy: 40, rx: 18, ry: 19, tr: "plain" },
            { n: "迷雾渗透区", cx: 66, cy: 60, rx: 18, ry: 13, tr: "mountain" },
            { n: "沉龙关故地", cx: 24, cy: 76, rx: 14, ry: 10, tr: "desert" }
          ],
          roads: [["xunluo", "wuqu"], ["wuqu", "chenlong"], ["xunluo", "jixun"], ["jixun", "chenlong"]],
          nodes: [
            {
              id: "xunluo",
              n: "夜巡动线",
              x: 32,
              y: 30,
              t: "city",
              d: 2,
              rg: "外围巡逻带",
              aliases: ["巡逻", "夜巡", "动线"],
              desc: "入夜后的城市另一副面孔：手电的光圈、对讲机的电流声、野猫炸毛的墙角——守夜人按动线巡逻，神秘按规律出没。",
              c: "原著日常线；值夜任务的主舞台。"
            },
            {
              id: "wuqu",
              n: "雾区边缘",
              x: 66,
              y: 56,
              t: "danger",
              d: 4,
              rg: "迷雾渗透区",
              aliases: ["雾区", "迷雾", "雾边"],
              desc: '迷雾与城市的交界。温度在这里骤降，声音在这里消失，探头探脑的"东西"在雾墙那头打量人间——低危到超高危的神秘都在雾后排队。',
              c: "原著凶险线；神秘遭遇的前沿。"
            },
            {
              id: "chenlong",
              n: "沉龙关",
              x: 24,
              y: 74,
              t: "danger",
              d: 5,
              rg: "沉龙关故地",
              aliases: ["沉龙关", "关隘", "古战场"],
              desc: "守夜人的伤心地与成名地。曾在这里倒下的人名字都刻在纪念碑上，活着走出来的人后来都被叫作老兵——沉龙关战役，是守夜人编年史里最重的一页。",
              c: "原著大战线；牺牲与觉悟的舞台。"
            },
            {
              id: "jixun",
              n: "集训营地",
              x: 48,
              y: 62,
              t: "sect",
              d: 2,
              rg: "迷雾渗透区",
              aliases: ["集训营", "营地", "新兵营"],
              desc: "各方新丁的淬炼场。白天练体能与战术，晚上学禁墟知识与守夜规矩——同期之间结下的交情，往后都是可以把后背交给对方的交情。",
              c: "原著成长线；新丁晋升的必经站。"
            }
          ]
        },
        {
          id: "shenyu",
          name: "诸神棋局 · 神域迷踪",
          ico: "神",
          hint: "神明的疆域与外神的低语——大夏是他们的禁行区",
          decor: "cosmos",
          regions: [
            { n: "诸神领域", cx: 30, cy: 34, rx: 18, ry: 14, tr: "water" },
            { n: "境外渗透网", cx: 55, cy: 33, rx: 18, ry: 14, tr: "desert" },
            { n: "外神血月界", cx: 48, cy: 74, rx: 20, ry: 12, tr: "void" }
          ],
          roads: [["shenxi", "shendian"], ["shenxi", "shentong"], ["shentong", "xueyue"], ["shendian", "xueyue"]],
          nodes: [
            {
              id: "shenxi",
              n: "诸神信仰界",
              x: 26,
              y: 30,
              t: "relic",
              d: 4,
              rg: "诸神领域",
              aliases: ["信仰界", "神域", "诸神"],
              desc: "希腊、北欧、埃及、高天原、西方圣教——诸神各怀心思的疆土。他们为自保放弃过人类，也有神明甘愿入轮回守护人间；神也是众生，有他们的执念与账。",
              c: "原著神明线；文明级棋局的棋盘。"
            },
            {
              id: "shendian",
              n: "神殿残响",
              x: 44,
              y: 22,
              t: "sect",
              d: 4,
              rg: "境外渗透网",
              aliases: ["神殿", "残响", "旧神殿"],
              desc: "境外神明渗透现实的锚点。祭坛的残响、信徒的呢喃、借躯还神的仪式——守夜人拆一个少一个，神明建一个多一个。",
              c: "原著渗透线；境外神明的入口。"
            },
            {
              id: "shentong",
              n: "神秘巢穴",
              x: 64,
              y: 44,
              t: "wild",
              d: 4,
              rg: "境外渗透网",
              aliases: ["巢穴", "神秘聚集地", "雾巢"],
              desc: "迷雾怪物盘踞的深巢。规律在巢里最真，弱点在巢里最险——观察、记录、试探是凡人对抗神秘的正道，硬莽等于送命。",
              c: "原著任务线；清剿与探索的目标。"
            },
            {
              id: "xueyue",
              n: "血月之境",
              x: 48,
              y: 76,
              t: "danger",
              d: 5,
              rg: "外神血月界",
              aliases: ["血月", "外神", "克苏鲁"],
              desc: "克苏鲁系外神的疆域——迷雾与血月的缔造者。血月升起的夜晚，大夏最凶险的至暗时刻：低语会撕开认知，看见的人不一定还是人。",
              c: "原著终极暗线；文明级威胁的本体。"
            }
          ]
        }
      ]
    },
    /* ---------- 剑来（v3.47.3：骊珠洞天 + 浩然天下 双层图） ---------- */
    jianlai: {
      name: "剑来 · 行旅图鉴",
      flavor: "天下的道理，慢慢讲",
      layers: [
        {
          id: "lizhu",
          name: "骊珠洞天 · 小镇",
          ico: "珠",
          hint: "一座被各方仙家盯了千年的小镇——气数散尽前最后的盛宴",
          decor: "land",
          regions: [
            { n: "小镇街巷", cx: 42, cy: 52, rx: 26, ry: 19, tr: "city" },
            { n: "泥瓶巷陌", cx: 18, cy: 32, rx: 13, ry: 11, tr: "forest" },
            { n: "杏花山水", cx: 68, cy: 30, rx: 19, ry: 13, tr: "water" }
          ],
          roads: [["nipinxiang", "jieshi"], ["jieshi", "tiesuojing"], ["jieshi", "xuetang"], ["tiesuojing", "xinghua"], ["jieshi", "laolongyao"]],
          nodes: [
            {
              id: "nipinxiang",
              n: "泥瓶巷",
              x: 22,
              y: 30,
              t: "start",
              d: 1,
              rg: "泥瓶巷陌",
              aliases: ["泥瓶巷", "老宅", "草鞋少年家"],
              desc: "小镇最穷的一条巷子，草鞋少年陈平安的家——破灶冷席，檐下埋着一坛老酒。天底下的大故事，就从这条窄巷的一碗糙米饭开始。",
              c: "原著开篇之地；主角的根。"
            },
            {
              id: "tiesuojing",
              n: "铁锁井",
              x: 44,
              y: 58,
              t: "relic",
              d: 2,
              rg: "小镇街巷",
              aliases: ["老井", "井口", "锁龙井"],
              desc: "小镇中心的千年老井，四条锈迹斑斑的铁链垂入井底。井栏被岁月磨得温润——搬山猿、正阳山、风雪庙，都曾在这口井边打水喝出各自的算盘。",
              c: "原著重要地脉；骊珠洞天的镇物。"
            },
            {
              id: "xuetang",
              n: "小镇学塾",
              x: 58,
              y: 44,
              t: "sect",
              d: 1,
              rg: "小镇街巷",
              aliases: ["学塾", "私塾", "先生处"],
              desc: "齐静春坐馆的学塾。孩子的念书声、先生的翻书声——一位教得出山长的大儒，守着小镇的最后一春。",
              c: "原著文脉线；齐静春的讲席。"
            },
            {
              id: "jieshi",
              n: "小镇街市",
              x: 40,
              y: 46,
              t: "city",
              d: 1,
              rg: "小镇街巷",
              aliases: ["街市", "集市", "铺子"],
              desc: "打铁铺、酒肆、绸缎庄、胭脂铺——小镇四姓的营生都在这。泥瓶巷少年挑灯做簪，藕花福地之外的烟火人间，不过这一条街。",
              c: "原著市井线；人间烟火的底色。"
            },
            {
              id: "xinghua",
              n: "杏花洞府",
              x: 68,
              y: 28,
              t: "danger",
              d: 3,
              rg: "杏花山水",
              aliases: ["杏花", "洞府", "福地"],
              desc: "小镇地底连绵的洞天残骸——飞升台、莲花小洞天、藕花福地。气数散尽前最后的盛宴，各路仙家早已在暗中分好了赃。",
              c: "原著机缘线；洞天气数的遗产。"
            },
            {
              id: "laolongyao",
              n: "老龙窑",
              x: 48,
              y: 64,
              t: "relic",
              d: 2,
              rg: "小镇街巷",
              aliases: ["龙窑", "老龙"],
              desc: "小镇东南的千年古窑，炉火从不熄。阮邛在此铸剑、也在此挑人——一柄剑换一句话，买的人未必懂，卖的人从不赊。",
              c: "原著铸剑线；阮邛与龙泉剑宗的源头。"
            }
          ]
        },
        {
          id: "haoran",
          name: "浩然天下 · 山水远游",
          ico: "山",
          hint: "宝瓶洲出，大渎入海——读书人与剑修的江湖都在路上",
          decor: "land",
          regions: [
            { n: "宝瓶洲腹地", cx: 34, cy: 34, rx: 24, ry: 16, tr: "plain" },
            { n: "大渎两岸", cx: 62, cy: 60, rx: 20, ry: 14, tr: "water" },
            { n: "倒悬剑域", cx: 22, cy: 72, rx: 16, ry: 12, tr: "mountain" }
          ],
          roads: [["luopo", "shuyuan"], ["luopo", "dukou"], ["dukou", "daoxuan"], ["daoxuan", "jianqi"], ["luopo", "dalicheng"], ["dukou", "laolongcheng"], ["dukou", "shujianhu"]],
          nodes: [
            {
              id: "luopo",
              n: "落魄山",
              x: 32,
              y: 32,
              t: "sect",
              d: 2,
              rg: "宝瓶洲腹地",
              aliases: ["落魄山", "山头", "新藕花"],
              desc: "骊珠洞天散伙后新起的山头，一匾「落魄」二字。山主陈平安、看门的裴钱、护山的朱敛——后来天下响当当的名字，都从这个不起眼的小山头走出来。",
              c: "原著根据地；主角一脉的山门。"
            },
            {
              id: "shuyuan",
              n: "山崖书院",
              x: 44,
              y: 22,
              t: "sect",
              d: 1,
              rg: "宝瓶洲腹地",
              aliases: ["山崖", "书院", "讲学处"],
              desc: "宝瓶洲文脉所在。山崖上读书声不断，君子轮番讲学——读书人的道理，山上山下都认三分。",
              c: "原著文教线；浩然气象的源头。"
            },
            {
              id: "jianqi",
              n: "剑气长城",
              x: 18,
              y: 76,
              t: "danger",
              d: 5,
              rg: "倒悬剑域",
              aliases: ["剑气长城", "长城", "城头"],
              desc: "倒悬于天地间的万里城墙，剑修的坟场与丰碑。城头一行字，刻着陈清都万年的孤独——避暑行宫与天空之城，都在这座墙的影子里。",
              c: "原著战争线；剑修的圣地。"
            },
            {
              id: "daoxuan",
              n: "倒悬山",
              x: 30,
              y: 62,
              t: "city",
              d: 3,
              rg: "倒悬剑域",
              aliases: ["倒悬山", "渡口", "仙城"],
              desc: "连接浩然与剑气长城的中转仙城。渡船、牌坊楼、客栈——天下行人往来，都在这座倒挂的山里歇脚。",
              c: "原著交通线；两界往来的枢纽。"
            },
            {
              id: "dukou",
              n: "跨洲渡口",
              x: 64,
              y: 58,
              t: "city",
              d: 2,
              rg: "大渎两岸",
              aliases: ["渡口", "大渎", "水路"],
              desc: "宝瓶洲大渎入海处，跨洲渡船的泊地。山河迢迢，一叶渡船载着读书人、剑客、小贩与野心——去桐叶洲还是皑皑洲，全看船票与缘分。",
              c: "原著游历线；远行的起点。"
            },
            {
              id: "dalicheng",
              n: "大骊京城",
              x: 18,
              y: 26,
              t: "city",
              d: 3,
              rg: "宝瓶洲腹地",
              aliases: ["大骊", "京城"],
              desc: "崔瀺以百年棋局扶起的铁血帝都。皇帝宋和当朝，国师绣虎幕后——宝瓶洲的规矩，多半是从这座城里一份份公文里长出来的。",
              c: "原著王朝线；崔瀺布局与宝瓶洲格局。"
            },
            {
              id: "laolongcheng",
              n: "老龙城",
              x: 70,
              y: 54,
              t: "city",
              d: 3,
              rg: "大渎两岸",
              aliases: ["老龙"],
              desc: "桐叶洲第一大港，商船昼夜不息。符、范两家在此盘根错节——天下最不讲道理的地方，往往是最讲生意的地方。",
              c: "原著商贸线；老龙城与桐叶洲势力。"
            },
            {
              id: "shujianhu",
              n: "书简湖",
              x: 54,
              y: 68,
              t: "danger",
              d: 4,
              rg: "大渎两岸",
              aliases: ["书简"],
              desc: "宝瓶洲与中州交界的水域，问心之地。这里没有王法，只有强弱；陈平安在此当账房先生，也是在此第一次算不清自己。",
              c: "原著问心局；书简湖善恶试炼线。"
            }
          ]
        },
        {
          id: "tianxia",
          name: "天下之外 · 三教据点",
          ico: "天",
          hint: "蛮荒、青冥、莲花——三教各守一方，各有各的天",
          decor: "cosmos",
          regions: [
            { n: "蛮荒天下", cx: 26, cy: 46, rx: 18, ry: 16, tr: "desert" },
            { n: "青冥天下", cx: 68, cy: 30, rx: 16, ry: 13, tr: "mountain" },
            { n: "莲花天下", cx: 66, cy: 76, rx: 17, ry: 13, tr: "water" }
          ],
          roads: [["tuoyue", "baiyu"], ["baiyu", "jingtufo"]],
          nodes: [
            {
              id: "tuoyue",
              n: "托月山",
              x: 22,
              y: 42,
              t: "danger",
              d: 5,
              rg: "蛮荒天下",
              aliases: ["托月", "王座"],
              desc: "蛮荒天下的权力中心，远古王座所在。十四王座大妖自此发号施令，隔着剑气长城，与浩然对望了整整一万年。",
              c: "原著蛮荒篇；妖族大本营与王座体系。"
            },
            {
              id: "baiyu",
              n: "白玉京",
              x: 68,
              y: 28,
              t: "sect",
              d: 4,
              rg: "青冥天下",
              aliases: ["白玉"],
              desc: "青冥天下的最高处，道祖坐镇之地。三十六洞天、七十二福地皆在其下——道家抬头守着的那片天外天，就压在这里。",
              c: "原著三教格局；道祖与化外天魔线。"
            },
            {
              id: "jingtufo",
              n: "净土佛国",
              x: 64,
              y: 74,
              t: "sect",
              d: 4,
              rg: "莲花天下",
              aliases: ["净土", "佛国"],
              desc: "莲花天下的一百零八座净土，四方佛陀镇守。佛门之人日日诵经，不为超度众生，只为压住下面那些不肯安分的东西。",
              c: "原著三教格局；佛家镇压幽冥线。"
            }
          ]
        }
      ]
    },
    /* ---------- 诡秘之主（v3.47.3：雾都 + 灰雾之上 双层图） ---------- */
    guimi: {
      name: "诡秘之主 · 行旅图鉴",
      flavor: "神秘汇聚到一处，就成了命运",
      layers: [
        {
          id: "wudu",
          name: "鲁恩王国 · 雾都",
          ico: "雾",
          hint: "第五纪的贝克兰德——煤气灯、电报局与教堂钟声里的暗流",
          decor: "city",
          regions: [
            { n: "贝克兰德城区", cx: 45, cy: 39, rx: 30, ry: 21, tr: "city" },
            { n: "东堡贫民区", cx: 20, cy: 70, rx: 16, ry: 12, tr: "desert" },
            { n: "港口带", cx: 74, cy: 66, rx: 14, ry: 12, tr: "water" }
          ],
          roads: [["mingsike", "heiing"], ["heiing", "jietailun"], ["mingsike", "zhanbu"], ["zhanbu", "tasuke"], ["heiing", "tasuke"], ["heiing", "shengsaimu"], ["heiing", "yongganzhe"], ["jietailun", "fengshou"], ["mingsike", "xiersidun"]],
          nodes: [
            {
              id: "mingsike",
              n: "明斯克街公寓",
              x: 40,
              y: 36,
              t: "start",
              d: 1,
              rg: "贝克兰德城区",
              aliases: ["公寓", "住处", "出租屋"],
              desc: "老式公寓二楼带窗户的单间。煤气灯、壁炉、楼下房东太太的咳嗽——克莱恩在这里醒来，也在这里戴上命运的面具。",
              c: "原著开篇之地；穿越者的第一个家。"
            },
            {
              id: "heiing",
              n: "黑荆棘事务所",
              x: 56,
              y: 44,
              t: "sect",
              d: 2,
              rg: "贝克兰德城区",
              aliases: ["黑荆棘", "安保公司", "事务所"],
              desc: "表面是安保侦探事务所，实为值夜者小队的据点。沙发上永远有人补觉，茶水间永远有人煮咖啡——队长的沉默，就是这里最响的规矩。",
              c: "原著组织线；值夜者的家。"
            },
            {
              id: "jietailun",
              n: "廷根教堂",
              x: 64,
              y: 30,
              t: "relic",
              d: 2,
              rg: "贝克兰德城区",
              aliases: ["教堂", "风暴教堂", "忏悔室"],
              desc: "黑铁与白银铸就的风暴之主教堂。忏悔室、圣器室、地下的灰雾封印——神圣与危险同在，凡人的敬畏在这里有了形状。",
              c: "原著信仰线；教会的臂膀。"
            },
            {
              id: "zhanbu",
              n: "占卜屋",
              x: 20,
              y: 68,
              t: "city",
              d: 2,
              rg: "东堡贫民区",
              aliases: ["占卜", "塔罗", "灵视"],
              desc: "东堡一间不起眼的占卜小屋。水晶球、塔罗牌、熏香与符咒——江湖骗子和真非凡者共用这条街，区别只在收费与命长。",
              c: "原著灰市线；神秘学的一角。"
            },
            {
              id: "tasuke",
              n: "塔苏克港",
              x: 74,
              y: 64,
              t: "city",
              d: 3,
              rg: "港口带",
              aliases: ["港口", "码头", "远航"],
              desc: "鲁恩最繁忙的远洋港口。蒸汽货轮、水手的歌、走私者的黑话——新大陆的机遇与旧大陆的罪恶，都从这里上岸。",
              c: "原著航路线；跨海的门。"
            },
            {
              id: "shengsaimu",
              n: "圣赛缪尔教堂",
              x: 26,
              y: 26,
              t: "relic",
              d: 3,
              rg: "贝克兰德城区",
              aliases: ["圣赛缪尔", "北区教堂", "黑夜教堂"],
              desc: "北区那座纯黑对称的建筑，两侧钟楼夹着采光孔，把微弱的天光引进祈祷厅。黑夜女神教会贝克兰德教区总部——正厅向凡人敞开，地下则锁着封印物和值夜者不该让人看见的东西。",
              c: "原著教会线；黑夜女神教会贝克兰德教区总部，位于北区。"
            },
            {
              id: "yongganzhe",
              n: "勇敢者酒吧",
              x: 32,
              y: 50,
              t: "city",
              d: 2,
              rg: "贝克兰德城区",
              aliases: ["酒吧", "赏金客", "桥区域"],
              desc: "贝克兰德桥区域一间昏暗的酒吧，赏金客与非凡者的接头处。老板不问来路，客人不报真名——许多委托从这里开始，也有许多人从这里再没回去。",
              c: "原著赏金线；第十九章「勇敢者酒吧」，获者与值夜者的交集点。"
            },
            {
              id: "xiersidun",
              n: "希尔斯顿证券交易所",
              x: 62,
              y: 22,
              t: "poi",
              d: 2,
              rg: "贝克兰德城区",
              aliases: ["交易所", "希尔斯顿区"],
              desc: "鲁恩王国的钱心脏。证券交易所、票据交换所、期货中心与七大银行总部挤在同一个区——在这里，一条电报线路往往比教堂的钟声更有权威。",
              c: "原著经济线；希尔斯顿区为王国的经济、商业与金融中心。"
            },
            {
              id: "fengshou",
              n: "丰收教堂",
              x: 48,
              y: 56,
              t: "relic",
              d: 2,
              rg: "贝克兰德城区",
              aliases: ["大桥南区", "大地母神"],
              desc: "大桥南区的白色教堂，大地母神教会的据点。来祈祷的多是工人与农夫，热粥、黑面包和极朴素的祷词——神的慈悲在这里是按碗算的。",
              c: "原著教会线；大地母神教会的丰收教堂，位于大桥南区。"
            }
          ]
        },
        {
          id: "huiwu",
          name: "隐秘世界 · 灰雾之上",
          ico: "灰",
          hint: "二十二条途径、诸神的目光与失控的边界——非凡者的另一张地图",
          decor: "cosmos",
          regions: [
            { n: "灰雾领域", cx: 30, cy: 30, rx: 22, ry: 16, tr: "water" },
            { n: "教会辖域", cx: 64, cy: 32, rx: 20, ry: 14, tr: "plain" },
            { n: "隐秘地下", cx: 48, cy: 74, rx: 24, ry: 14, tr: "void" }
          ],
          roads: [["huiwushang", "zhuanlun"], ["huiwushang", "jiaohui"], ["jiaohui", "dixia"], ["zhuanlun", "dixia"]],
          nodes: [
            {
              id: "huiwushang",
              n: "灰雾之上",
              x: 28,
              y: 30,
              t: "relic",
              d: 5,
              rg: "灰雾领域",
              aliases: ["灰雾", "巨殿", "源堡"],
              desc: "灰雾深处的古老宫殿，一张长长的青铜桌，二十二把高背椅。命运的转折从这里开始——愚者不语，居于灰雾之上。",
              c: "原著核心秘境；塔罗会的会场。"
            },
            {
              id: "zhuanlun",
              n: "皎白月下",
              x: 44,
              y: 42,
              t: "danger",
              d: 4,
              rg: "灰雾领域",
              aliases: ["皎白月", "梦境", "灵界"],
              desc: "灰雾与梦境的交界。皎白的月亮、扭曲的街道、半凝的影子——灵界旅行者的必经之地，也是疯子的温床。",
              c: "原著灵界线；意识的险途。"
            },
            {
              id: "jiaohui",
              n: "教会圣座",
              x: 64,
              y: 30,
              t: "sect",
              d: 3,
              rg: "教会辖域",
              aliases: ["教会总部", "圣者", "诸神"],
              desc: "风暴、黑夜、蒸汽与机械、知识与智慧——诸神教会在人间的高塔。信众的祈祷汇成海洋，圣者的目光垂落如渊。",
              c: "原著神学线；秩序的顶端。"
            },
            {
              id: "dixia",
              n: "隐秘据点",
              x: 48,
              y: 72,
              t: "wild",
              d: 3,
              rg: "隐秘地下",
              aliases: ["据点", "秘密组织", "聚会"],
              desc: "贝克兰德地下的隐秘角落。极光会、心理炼金会、玫瑰学派——邪教徒与野心家的客厅，每一次聚会都意味着明天的报纸多一桩悬案。",
              c: "原著暗线；混沌的温床。"
            }
          ]
        },
        {
          id: "shenqi",
          name: "苏尼亚海 · 神弃之地",
          ico: "弃",
          hint: "航线尽头的永恒黄昏——只剩史书上几行字的东大陆",
          decor: "land",
          regions: [
            { n: "苏尼亚航路", cx: 30, cy: 30, rx: 24, ry: 18, tr: "water" },
            { n: "神弃之地", cx: 62, cy: 40, rx: 24, ry: 20, tr: "void" },
            { n: "旧世界遗迹", cx: 48, cy: 74, rx: 24, ry: 13, tr: "desert" }
          ],
          roads: [["luoside", "baiyincheng"], ["baiyincheng", "yuecheng"], ["baiyincheng", "juren"], ["juren", "luoside"]],
          nodes: [
            {
              id: "luoside",
              n: "罗思德群岛",
              x: 26,
              y: 28,
              t: "city",
              d: 3,
              rg: "苏尼亚航路",
              aliases: ["群岛", "中苏尼亚海"],
              desc: "苏尼亚海航线上的群岛，鲁恩王国在这片海域的统治支点，也是风暴教会的关键教区。礁石上常年驻着一位能进枢机会议的高级执事——越往东，海图上的空白越多。",
              c: "原著航路线；苏尼亚海统治支点，风暴教会关键教区。"
            },
            {
              id: "baiyincheng",
              n: "白银城",
              x: 56,
              y: 34,
              t: "sect",
              d: 4,
              rg: "神弃之地",
              aliases: ["白银之国", "巨人语城"],
              desc: "神弃之地深处最后的人类城邦，古称「白银之国」，通用语是巨人语。城外是无光的荒野与变异的怪物，城里的人靠着教典、纪律和一句不许问出口的来历，硬撑了三千多年。",
              c: "原著神弃之地线；克莱恩以「太阳」身份介入之地。"
            },
            {
              id: "yuecheng",
              n: "月城",
              x: 78,
              y: 50,
              t: "danger",
              d: 5,
              rg: "神弃之地",
              aliases: ["月城之地", "边界灰雾"],
              desc: "神弃之地最东面的城，比白银城更苦。没有可靠的食物来源，居民只能猎食变异的怪物，多数人的结局是体内积满疯狂而死——他们世代守着边界那片灰雾，守了三千年。",
              c: "原著神弃之地线；遵循远古太阳神教旨的守护者。"
            },
            {
              id: "juren",
              n: "巨人王庭",
              x: 42,
              y: 72,
              t: "relic",
              d: 5,
              rg: "旧世界遗迹",
              aliases: ["王庭", "巨人尸骸"],
              desc: "沐浴在永恒黄昏中的巨大建筑群，巨人王与王后神国的废墟。它是神弃之地通往外界唯一的接口——门一直开着，只是没人愿意先迈出去。",
              c: "原著神弃之地线；进出神弃之地的唯一通道。"
            }
          ]
        }
      ]
    },
    /* ---------- 蛊真人（v3.47.3：青茅山 + 南疆 双层图） ---------- */
    guzhenren: {
      name: "蛊真人 · 行旅图鉴",
      flavor: "人心比蛊虫难养",
      layers: [
        {
          id: "qingmao",
          name: "青茅山 · 古月家",
          ico: "蛊",
          hint: "五百年重生者的起点——一个普通蛊师家族的柴米与算计",
          decor: "land",
          regions: [
            { n: "青茅山腹", cx: 44, cy: 38, rx: 30, ry: 21, tr: "forest" },
            { n: "家族驻地", cx: 24, cy: 68, rx: 18, ry: 13, tr: "plain" },
            { n: "白云山外", cx: 70, cy: 64, rx: 16, ry: 12, tr: "mountain" }
          ],
          roads: [["laozhai", "liangu"], ["laozhai", "qingmaoshan"], ["qingmaoshan", "yizhuang"], ["qingmaoshan", "baiyun"]],
          nodes: [
            {
              id: "laozhai",
              n: "古月老宅",
              x: 24,
              y: 66,
              t: "start",
              d: 1,
              rg: "家族驻地",
              aliases: ["老宅", "古月家", "祖宅"],
              desc: "青茅山下古月家族的祖宅。祠堂、演武场、藏蛊阁——五百年前那个少年在这里重生，带着一肚子「先知」开始第二次人生。",
              c: "原著开篇之地；重生的起点。"
            },
            {
              id: "liangu",
              n: "炼蛊房",
              x: 34,
              y: 76,
              t: "relic",
              d: 3,
              rg: "家族驻地",
              aliases: ["炼蛊", "蛊房", "秘室"],
              desc: "族中炼蛊师的地盘。丹炉、蛊盆、药材架与一屋子的嗡鸣——一只蛊成，白骨铺垫；一只蛊败，血本无归。",
              c: "原著核心系统；蛊的产房。"
            },
            {
              id: "qingmaoshan",
              n: "青茅猎场",
              x: 46,
              y: 36,
              t: "wild",
              d: 3,
              rg: "青茅山腹",
              aliases: ["青茅山", "猎场", "深山"],
              desc: "家族赖以为生的猎场。晨露未干就进山，日头偏西才回寨——野蛊、凶兽、蛇窟与同族的黑手，都在这条山道上。",
              c: "原著生计线；历练的操场。"
            },
            {
              id: "baiyun",
              n: "白云坊市",
              x: 70,
              y: 62,
              t: "city",
              d: 2,
              rg: "白云山外",
              aliases: ["坊市", "白云山", "集市"],
              desc: "白云山下的修士坊市。摊位上摆着蛊虫、药材、元石与残卷——讨价还价是规矩，坐地起价是本事，捡漏是命。",
              c: "原著交易线；资源的集散地。"
            },
            {
              id: "yizhuang",
              n: "义庄秘地",
              x: 40,
              y: 50,
              t: "danger",
              d: 4,
              rg: "青茅山腹",
              aliases: ["义庄", "家族秘辛"],
              desc: "族中讳莫如深的禁地。停尸的义庄、锁魂的阵法、先祖的枯坐——家族发迹的秘密与黑账，都埋在这里的地下。",
              c: "原著暗线；家族的原罪。"
            }
          ]
        },
        {
          id: "nanjiang",
          name: "南疆 · 蛊师江湖",
          ico: "疆",
          hint: "正魔大战的火药桶——五百年前烧过一次，随时再烧一次",
          decor: "land",
          regions: [
            { n: "南疆蛊域", cx: 36, cy: 34, rx: 26, ry: 18, tr: "forest" },
            { n: "正魔战线", cx: 64, cy: 38, rx: 20, ry: 14, tr: "mountain" },
            { n: "蛮荒深处", cx: 48, cy: 72, rx: 22, ry: 14, tr: "void" }
          ],
          roads: [["yimeng", "yaoshan"], ["yimeng", "mogu"], ["mogu", "manhuang"], ["yaoshan", "manhuang"], ["yimeng", "yitianshan"], ["mogu", "yitianshan"]],
          nodes: [
            {
              id: "mogu",
              n: "魔道盘踞地",
              x: 64,
              y: 38,
              t: "danger",
              d: 4,
              rg: "正魔战线",
              aliases: ["魔道", "魔头", "炼尸"],
              desc: "魔道蛊师的势力范围。炼尸窟、血蛊池、以人饲蛊的密林——正魔大战的火药桶，五百年前烧过一次，随时再烧一次。",
              c: "原著阵营线；正魔对立的前沿。"
            },
            {
              id: "yimeng",
              n: "义盟驻地",
              x: 30,
              y: 30,
              t: "sect",
              d: 2,
              rg: "南疆蛊域",
              aliases: ["义盟", "正道", "盟会"],
              desc: "南疆正道义盟的驻地。盟主大会、斩妖檄文、各家的人情与算计——正道的光鲜与龌龊，在一张盟桌上摆得明明白白。",
              c: "原著政治线；正道的棋盘。"
            },
            {
              id: "yaoshan",
              n: "万药山",
              x: 44,
              y: 22,
              t: "wild",
              d: 3,
              rg: "南疆蛊域",
              aliases: ["药山", "采药", "灵材"],
              desc: "盛产灵材的药山。云雾里的灵芝、崖缝里的天蚕、毒瘴里的药引——采药人赌命换钱，蛊师拿钱换蛊。",
              c: "原著资源线；南疆的宝库。"
            },
            {
              id: "manhuang",
              n: "蛮荒深处",
              x: 48,
              y: 72,
              t: "danger",
              d: 5,
              rg: "蛮荒深处",
              aliases: ["蛮荒", "深处", "禁地"],
              desc: "人迹罕至的蛮荒腹地。太古遗种、瘴海凶蛊、失落古洞——九转传闻的源头，也是九死一生的代名词。",
              c: "原著终极线；高风险的宝地。"
            },
            {
              id: "yitianshan",
              n: "义天山",
              x: 50,
              y: 26,
              t: "danger",
              d: 5,
              rg: "南疆蛊域",
              aliases: ["义天山大战", "南疆高峰"],
              desc: "南疆十万大山里的一座高峰，正魔两道敢把全部筹码推上桌的地方。大战一起，各家蛰伏几百年的底牌全被翻到明面上——山还是那座山，埋在下面的名字年年不同。",
              c: "原著剧情线；义天山大战的发生地。"
            }
          ]
        },
        {
          id: "wuyu",
          name: "五域 · 两天",
          ico: "域",
          hint: "蛊界真正的棋盘——五域界壁消融之后，天庭、长生天与两天一并压向人间",
          decor: "land",
          regions: [
            { n: "中州大地", cx: 22, cy: 28, rx: 18, ry: 15, tr: "mountain" },
            { n: "西漠沙海", cx: 22, cy: 66, rx: 16, ry: 12, tr: "desert" },
            { n: "东海北原", cx: 64, cy: 38, rx: 22, ry: 22, tr: "water" },
            { n: "太古两天", cx: 66, cy: 78, rx: 22, ry: 10, tr: "void" }
          ],
          roads: [["tianting", "shidagupai"], ["shidagupai", "diyuan"], ["tianting", "tianlu"], ["tianlu", "wankuang"], ["diyuan", "baohuangtian"], ["baohuangtian", "jiaoren"], ["jiaoren", "zhenyanglou"], ["zhenyanglou", "tianlu"]],
          nodes: [
            {
              id: "tianting",
              n: "天庭",
              x: 18,
              y: 22,
              t: "sect",
              d: 5,
              rg: "中州大地",
              aliases: ["天庭洞天", "尊者"],
              desc: "蛊界至高的蛊仙势力，洞天悬在中洲正中高空。历代尊者的塑像居高临下俯瞰五域——天本无言，天庭替它开了口。",
              c: "原著势力设定；统率中洲十大古派的最强者。"
            },
            {
              id: "shidagupai",
              n: "中州十大古派",
              x: 32,
              y: 34,
              t: "sect",
              d: 4,
              rg: "中州大地",
              aliases: ["仙鹤门", "战仙宗", "风云府", "天莲派"],
              desc: "仙鹤门、战仙宗、风云府、古魂门、万龙坞、黑天寺、灵缘斋、灵蝶谷、天妒楼、天莲派。五域之中唯中州行门派制度，师徒相传，把住了古代真传的大半。",
              c: "原著势力设定；中州十大古派，天庭之下。"
            },
            {
              id: "diyuan",
              n: "中州地渊",
              x: 14,
              y: 38,
              t: "danger",
              d: 4,
              rg: "中州大地",
              aliases: ["地渊", "深渊"],
              desc: "中洲腹地深不见底的裂谷，地脉在这里赤裸裸地裸露着。掉下去的东西不会回来，被扔下去的人在族谱上只留「失踪」二字——灯照不到底，比黑暗更深的是沉默。",
              c: "原著地理设定；中洲最著名的险地之一。"
            },
            {
              id: "tianlu",
              n: "天露绿洲",
              x: 18,
              y: 64,
              t: "city",
              d: 3,
              rg: "西漠沙海",
              aliases: ["绿洲", "西漠活水"],
              desc: "沙丘之间第一口有活水的井。凡人靠它活命，超级家族把它连同一整条商路写进账册——西漠能住人的地方就那么几处，多一事不如少一事。",
              c: "原著地理设定；西漠绿洲作为繁衍之地与资源点。"
            },
            {
              id: "wankuang",
              n: "万矿戈壁",
              x: 30,
              y: 74,
              t: "wild",
              d: 3,
              rg: "西漠沙海",
              aliases: ["矿脉", "戈壁"],
              desc: "砾石遍地的矿脉带，风蚀层下埋着各色矿石。西漠本就贫瘠，能挖出东西的地方必然有人抢——石头是不动的，抢石头的人年年换。",
              c: "原著地理设定；西漠以沙漠戈壁划分地域。"
            },
            {
              id: "jiaoren",
              n: "鲛人王庭",
              x: 58,
              y: 30,
              t: "sect",
              d: 4,
              rg: "东海北原",
              aliases: ["鲛人", "异人势力"],
              desc: "东海深处的水下王庭，五域之中唯一的异人超级势力。水道道痕在这里浓得像水本身——人不识水性便上不了岸，异人也不肯上岸。",
              c: "原著势力设定；东海唯一的异人超级势力。"
            },
            {
              id: "zhenyanglou",
              n: "真阳楼",
              x: 76,
              y: 48,
              t: "sect",
              d: 4,
              rg: "东海北原",
              aliases: ["长生天", "王庭福地"],
              desc: "北原长生天的核心。真阳楼每隔十年把王庭福地的天劫地灾排遣出去，换来一场席卷草原的超级大风雪与随之而来的飞手雪——躲不进王庭福地的部族，就此被风刮走。",
              c: "原著势力设定；北原黄金部族共奉长生天。"
            },
            {
              id: "baohuangtian",
              n: "宝黄天",
              x: 62,
              y: 76,
              t: "poi",
              d: 3,
              rg: "太古两天",
              aliases: ["宝光", "公共洞天"],
              desc: "蛊界最庞大也最安全的公共洞天与交易市场。谁也别想在宝黄天里动手——货架上的东西按自身价值散出宝光，宝光越盛越金贵，而买卖双方互相看不见。",
              c: "原著交易设定；蛊仙专用的公共洞天市场。"
            }
          ]
        }
      ]
    },
    /* ---------- 玄鉴仙族（v3.47.3：家族领地 + 修真界 双层图） ---------- */
    xuanjianxianzu: {
      name: "玄鉴仙族 · 行旅图鉴",
      flavor: "修仙如种田，急不得",
      layers: [
        {
          id: "lingdi",
          name: "家族领地 · 玄鉴宗",
          ico: "族",
          hint: "一个修仙家族的全部家当——山门、灵田、丹房与祖祠",
          decor: "land",
          regions: [
            { n: "山门腹地", cx: 42, cy: 36, rx: 28, ry: 19, tr: "plain" },
            { n: "灵田水系", cx: 24, cy: 66, rx: 18, ry: 13, tr: "water" },
            { n: "外围坊麓", cx: 70, cy: 62, rx: 16, ry: 12, tr: "forest" }
          ],
          roads: [["shanmen", "danfang"], ["shanmen", "cangjing"], ["shanmen", "lingtian"], ["lingtian", "yanwu"]],
          nodes: [
            {
              id: "shanmen",
              n: "玄鉴山门",
              x: 42,
              y: 34,
              t: "start",
              d: 1,
              rg: "山门腹地",
              aliases: ["山门", "宗门", "本家"],
              desc: "玄鉴仙族的山门所在。牌坊、大殿、护山大阵与历代祖师的牌位——一族修士从这扇门里进进出出，有人光耀门楣，有人一去不回。",
              c: "原著根据地；家族的心脏。"
            },
            {
              id: "lingtian",
              n: "灵田稻浪",
              x: 24,
              y: 64,
              t: "city",
              d: 1,
              rg: "灵田水系",
              aliases: ["灵田", "田亩", "灵谷"],
              desc: "家族的命根子。一垄垄灵稻四季不歇，引灵渠的水汽氤氲——族里的每一颗灵石、每一炉丹，根子上都是这片田。",
              c: "原著经济线；家族的根基。"
            },
            {
              id: "danfang",
              n: "丹房",
              x: 54,
              y: 42,
              t: "relic",
              d: 2,
              rg: "山门腹地",
              aliases: ["丹房", "炼丹", "丹炉"],
              desc: "族中丹师的领地。丹炉日夜不熄——一炉丹成，族里能多撑十年；一炉丹炸，要开祠堂议事。",
              c: "原著产业线；丹药的产地。"
            },
            {
              id: "cangjing",
              n: "藏经阁",
              x: 32,
              y: 24,
              t: "sect",
              d: 2,
              rg: "山门腹地",
              aliases: ["藏经", "功法", "书阁"],
              desc: "家族历代积攒的功法典籍所在。残卷、抄本、孤本层层上锁——外门弟子只能看一层，阁顶那一格，只有家主能开。",
              c: "原著传承线；知识的宝库。"
            },
            {
              id: "yanwu",
              n: "演武场",
              x: 68,
              y: 60,
              t: "wild",
              d: 2,
              rg: "外围坊麓",
              aliases: ["演武", "大比", "校场"],
              desc: "族中子弟晨练与大比的校场。木桩、剑架、符靶一应俱全——一年一度的大比在这里开锣，谁上主脉、谁守灵田，一场场比出来。",
              c: "原著竞争线；子弟的擂台。"
            }
          ]
        },
        {
          id: "xiuzhenjie",
          name: "修真界 · 坊市与四方",
          ico: "界",
          hint: "小家族的生存哲学——联姻、结盟、借势、忍气",
          decor: "land",
          regions: [
            { n: "坊市商路", cx: 50, cy: 32, rx: 28, ry: 16, tr: "plain" },
            { n: "友邻宗门", cx: 20, cy: 36, rx: 16, ry: 13, tr: "mountain" },
            { n: "秘境矿脉", cx: 66, cy: 70, rx: 18, ry: 13, tr: "void" }
          ],
          roads: [["fangshi", "kuangmai"], ["fangshi", "zongmen"], ["kuangmai", "mijing"], ["zongmen", "mijing"]],
          nodes: [
            {
              id: "fangshi",
              n: "青枫坊市",
              x: 50,
              y: 30,
              t: "city",
              d: 2,
              rg: "坊市商路",
              aliases: ["坊市", "集市", "青枫"],
              desc: "方圆千里最大的散修坊市。灵石铺柜台、法器挂满墙、丹药论瓶卖——坊主笑面迎客，暗地里各家眼线比客人还多。",
              c: "原著交易线；家族的钱袋子。"
            },
            {
              id: "kuangmai",
              n: "家族矿脉",
              x: 66,
              y: 68,
              t: "wild",
              d: 3,
              rg: "秘境矿脉",
              aliases: ["矿脉", "灵矿", "矿洞"],
              desc: "家族新得的灵矿。矿洞深处的灵石晶簇、暗河里的未知生物、以及盯上矿脉的各路豺狼——守矿比挖矿难。",
              c: "原著资源线；是非之地。"
            },
            {
              id: "zongmen",
              n: "友邻宗门",
              x: 20,
              y: 36,
              t: "sect",
              d: 3,
              rg: "友邻宗门",
              aliases: ["邻宗", "大宗", "仙门"],
              desc: "周边大宗门的山门。人家一个外门长老的修为就够自家老祖出手——联姻、结盟、借势、忍气，小家族在大宗门面前的生存哲学。",
              c: "原著外交线；仰人鼻息的艺术。"
            },
            {
              id: "mijing",
              n: "小秘境",
              x: 50,
              y: 74,
              t: "danger",
              d: 4,
              rg: "秘境矿脉",
              aliases: ["秘境", "古修", "遗府"],
              desc: "坊市传闻中的古修遗府。禁制将破未破，机缘与凶险五五开——每开一次，修真界都要少一批人，多一批传说。",
              c: "原著机缘线；豪赌的赌场。"
            }
          ]
        },
        {
          id: "yueguo",
          name: "越国 · 古黎道",
          ico: "鉴",
          hint: "大黎山下的水网与稻田——一个农户家族变成仙族的全部舞台",
          decor: "land",
          regions: [
            { n: "古黎道", cx: 28, cy: 30, rx: 22, ry: 18, tr: "plain" },
            { n: "大黎山脉", cx: 22, cy: 68, rx: 18, ry: 14, tr: "mountain" },
            { n: "望月湖", cx: 60, cy: 34, rx: 22, ry: 18, tr: "water" },
            { n: "青池宗境", cx: 62, cy: 72, rx: 20, ry: 13, tr: "forest" }
          ],
          roads: [["lijingcun", "meichihe"], ["lijingcun", "gulidao"], ["gulidao", "wangyuehu"], ["lijingcun", "dailishan"], ["dailishan", "shanyue"], ["wangyuehu", "yujia"], ["wangyuehu", "qingchizong"], ["qingchizong", "qingsuifeng"]],
          nodes: [
            {
              id: "lijingcun",
              n: "黎泾村",
              x: 20,
              y: 26,
              t: "start",
              d: 1,
              rg: "古黎道",
              aliases: ["黎泾", "李氏祖地", "老村"],
              desc: "眉尺河畔的农耕小村。李氏在这里世代务农两百余年，直到有人在河底捞起一面布满裂纹的青灰铜镜——这一家人的命数，从那天起改了方向。",
              c: "原著开篇；李氏家族起源地，玄鉴现世之处。"
            },
            {
              id: "meichihe",
              n: "眉尺河",
              x: 34,
              y: 38,
              t: "poi",
              d: 2,
              rg: "古黎道",
              aliases: ["眉尺", "河底"],
              desc: "绕村而过的一条水。灌溉、渔网、洗衣的石埠都在河边，孩子的第一趟水也从这里蹚——李项平就是在它的河底把那面法鉴捞了上来。",
              c: "原著开篇设定；玄鉴坠落并被打捞之处。"
            },
            {
              id: "gulidao",
              n: "古黎道",
              x: 16,
              y: 42,
              t: "city",
              d: 2,
              rg: "古黎道",
              aliases: ["越国南部", "乡土"],
              desc: "越国南部的一方水土，名唤古黎道。宗门把它划作一个治理单元，坞堡、村寨与墟市散在水网之间——后来整条道都姓了李，只是没人记得是从哪一年开始的。",
              c: "原著地理设定；李氏在青池宗治下逐步掌控的一方。"
            },
            {
              id: "dailishan",
              n: "大黎山",
              x: 18,
              y: 66,
              t: "danger",
              d: 3,
              rg: "大黎山脉",
              aliases: ["大黎", "凶山"],
              desc: "村后那片凶险难测的大山。晨雾里能听见不该有的声音，猎户进山要结伴、要在日落前出山——山里出柴火，也出吃人的东西。",
              c: "原著开篇设定；黎泾村背后的凶险大山。"
            },
            {
              id: "shanyue",
              n: "山越之地",
              x: 32,
              y: 76,
              t: "danger",
              d: 3,
              rg: "大黎山脉",
              aliases: ["山越", "蛮族"],
              desc: "聚居在大山里的山越人，刀耕火种，不认山外的王法。冲突起来时不讲列阵，只讲谁先熬不住——李家的族兵，就是被他们一下下逼出来的。",
              c: "原著族群设定；与李氏长期冲突的山中之民。"
            },
            {
              id: "wangyuehu",
              n: "望月湖",
              x: 52,
              y: 32,
              t: "city",
              d: 2,
              rg: "望月湖",
              aliases: ["湖洲", "望月"],
              desc: "李氏举族迁徙后的核心根据地。湖心的沙洲上起屋、围堤、筑阵，芦苇荡与后山替他们挡了几代人——月华落下来的时候，湖面像铺着一层可以拿来修行的东西。",
              c: "原著第二卷「长鲸月落」；李氏立足望月湖。"
            },
            {
              id: "yujia",
              n: "郁家",
              x: 70,
              y: 44,
              t: "sect",
              d: 3,
              rg: "望月湖",
              aliases: ["邻族", "世家"],
              desc: "湖那一头的修真世家。婚丧嫁娶都带着试探，矿脉与码头的界线年年重画——李通崖一剑逼退郁家之后，这条界线才算暂时定下来。",
              c: "原著邻族设定；与李氏争夺资源的另一世家。"
            },
            {
              id: "qingchizong",
              n: "青池宗",
              x: 56,
              y: 72,
              t: "sect",
              d: 3,
              rg: "青池宗境",
              aliases: ["青池", "大宗"],
              desc: "越国南部的大宗，李氏早年仰仗的宗主。峰主、坊市、村落三级治理，靠资粮贡赋而非刀兵立规矩——供奉稽查看着是文书往来，实则每回都能刮下一层油。",
              c: "原著势力设定；越国南部大宗，李家依附对象。"
            },
            {
              id: "qingsuifeng",
              n: "青穗峰",
              x: 74,
              y: 78,
              t: "sect",
              d: 2,
              rg: "青池宗境",
              aliases: ["青穗", "青穗剑仙"],
              desc: "青池宗辖内的一座山峰。李尺泾在此入门，把宗门的功法一点点搬回村里；后来李通崖仗一柄月阙剑得了「青穗剑仙」的名号——峰还是那座峰，人换了一茬又一茬。",
              c: "原著宗门设定；李尺泾拜入之处，李通崖成名之处。"
            }
          ]
        }
      ]
    },
    /* ---------- 武侠仙侠（v3.31.4：原创江湖·类型地标图） ----------
       本界非原著改编——预设节点全部是江湖常见「去处原型」（客栈/渡口/镖局/
       山门/法场…），AI 报具体小场所（临江客栈/城南老铁铺…）时由行迹地标
       引擎就地生成 ✦ 标记，绝不冒充原著地点。 */
    wuxia: {
      generic: true,
      name: "武侠 · 江湖舆图",
      flavor: "有人的地方，就有江湖",
      layers: [
        {
          id: "zhongyuan",
          name: "中原 · 江湖",
          ico: "湖",
          hint: "庙堂与市井之间——镖旗、剑派、渡口与法场都在这一页",
          decor: "land",
          regions: [
            { n: "中原腹地", cx: 44, cy: 44, rx: 26, ry: 20, tr: "plain" },
            { n: "江南水乡", cx: 64, cy: 79, rx: 18, ry: 12, tr: "water" },
            { n: "川蜀山岳", cx: 18, cy: 67, rx: 13, ry: 14, tr: "mountain" },
            { n: "北地边关", cx: 56, cy: 16, rx: 20, ry: 7, tr: "mountain" }
          ],
          roads: [
            ["yuelai", "taiyue"],
            ["yuelai", "jingcheng"],
            ["jingcheng", "fachang"],
            ["yuelai", "biaozhan"],
            ["biaozhan", "yangdu"],
            ["yangdu", "jiulou"],
            ["yuelai", "heifeng"],
            ["taiyue", "heifeng"]
          ],
          nodes: [
            {
              id: "yuelai",
              n: "悦来客栈",
              x: 34,
              y: 44,
              t: "start",
              d: 1,
              rg: "中原腹地",
              aliases: ["客栈", "客栈大堂", "悦来", "大堂"],
              desc: "天下的客栈十有八九都叫这个名。跑江湖的、走镖的、避仇的、寻人的，都在这里歇脚——消息也在这里过夜。故事多半从大堂一角的一碗酒开始。",
              c: "江湖常见去处（类型地标）：消息与是非的集散地。"
            },
            {
              id: "jingcheng",
              n: "京城",
              x: 56,
              y: 20,
              t: "city",
              d: 3,
              rg: "北地边关",
              aliases: ["京师", "皇城", "天子脚下", "帝都"],
              desc: "庙堂之高，江湖之远，中间隔着一道城墙。六部衙门、达官贵邸、天子脚下规矩大——江湖人在这里收敛刀剑，也在这里把事情闹得不可收拾。",
              c: "江湖常见去处（类型地标）：庙堂与江湖的角力场。"
            },
            {
              id: "yangdu",
              n: "扬州渡口",
              x: 58,
              y: 70,
              t: "city",
              d: 1,
              rg: "江南水乡",
              aliases: ["渡口", "码头", "漕运码头", "扬州"],
              desc: "南北漕运的咽喉，桅樯如林。船家、漕帮、行商与刀客在跳板间擦肩——上船容易下船难，江心的买卖没人管。",
              c: "江湖常见去处（类型地标）：水路江湖的门户口岸。"
            },
            {
              id: "biaozhan",
              n: "威远镖局",
              x: 46,
              y: 58,
              t: "sect",
              d: 2,
              rg: "中原腹地",
              aliases: ["镖局", "镖行", "走镖"],
              desc: "刀口舔血的营生，讲的是「镖在人在」。趟子手喊镖号、镖师枕着刀睡觉——绿林道上的规矩、人情与仇家，一趟镖里全见分晓。",
              c: "江湖常见去处（类型地标）：走镖人的总部与坟场。"
            },
            {
              id: "taiyue",
              n: "太岳剑派",
              x: 20,
              y: 56,
              t: "sect",
              d: 2,
              rg: "川蜀山岳",
              aliases: ["山门", "剑派", "名门正派", "太岳"],
              desc: "名门正派的山门：晨钟暮鼓、剑冢祖训、讲武堂上辈分森严。掌门一句话，百十弟子提剑下山——名门有名门的体面，也有名门的算计。",
              c: "江湖常见去处（类型地标）：门派体系与正邪之争的舞台。"
            },
            {
              id: "fachang",
              n: "西市法场",
              x: 50,
              y: 32,
              t: "danger",
              d: 3,
              rg: "中原腹地",
              aliases: ["法场", "刑场", "菜市口"],
              desc: "午时三刻，监斩官掷签，刀落之前什么都有可能发生：劫法场的、喊冤的、围观起哄的，还有人堆里按刀不动的仇家。",
              c: "江湖常见去处（类型地标）：命悬一线与法场劫人的经典场景。"
            },
            {
              id: "heifeng",
              n: "黑风寨",
              x: 16,
              y: 78,
              t: "danger",
              d: 4,
              rg: "川蜀山岳",
              aliases: ["山寨", "绿林", "匪寨", "黑店"],
              desc: "三面绝壁一面吊桥，寨旗是黑的，规矩也是。当家的讲义气也讲价钱——道上的朋友喝过酒，道下的肥羊留下买路钱。",
              c: "江湖常见去处（类型地标）：绿林道的据点。"
            },
            {
              id: "jiulou",
              n: "醉仙楼",
              x: 70,
              y: 88,
              t: "city",
              d: 1,
              rg: "江南水乡",
              aliases: ["酒楼", "酒肆", "酒馆", "醉仙"],
              desc: "百年老字号，跑堂的吆喝三层楼都听得见。文人题壁、侠客掷杯、说书人把隔壁桌的事编成段子——酒是个好东西，坏事的也都是它。",
              c: "江湖常见去处（类型地标）：结怨与化仇都常有的热闹地。"
            }
          ]
        },
        {
          id: "siwai",
          name: "塞外 · 四疆",
          ico: "疆",
          hint: "出关便是另一重江湖——草原、丝路、瘴林、东海与天险",
          decor: "land",
          regions: [
            { n: "塞北草原", cx: 28, cy: 28, rx: 19, ry: 13, tr: "plain" },
            { n: "西域丝路", cx: 64, cy: 42, rx: 17, ry: 15, tr: "desert" },
            { n: "南疆瘴林", cx: 40, cy: 82, rx: 17, ry: 10, tr: "forest" },
            { n: "东海之滨", cx: 86, cy: 72, rx: 10, ry: 9, tr: "water" },
            { n: "雪岭天关", cx: 58, cy: 13, rx: 22, ry: 6, tr: "mountain" }
          ],
          roads: [["saibei", "xueling"], ["saibei", "sichou"], ["sichou", "jianzhong"], ["sichou", "nanjiang"], ["nanjiang", "donghai"]],
          nodes: [
            {
              id: "saibei",
              n: "塞北王庭",
              x: 26,
              y: 26,
              t: "wild",
              d: 4,
              rg: "塞北草原",
              aliases: ["草原", "王庭", "马市", "塞北"],
              desc: "天似穹庐，笼盖四野。铁骑的故乡：互市的马、抢来的盐、部落之间的盟与叛。中原的侠客在这里学谦卑——马快、弓沉、话少。",
              c: "江湖常见去处（类型地标）：边塞线与草原势力的舞台。"
            },
            {
              id: "sichou",
              n: "丝路重镇",
              x: 64,
              y: 44,
              t: "city",
              d: 3,
              rg: "西域丝路",
              aliases: ["西域", "丝路", "重镇", "胡商"],
              desc: "黄沙尽头的一汪绿洲城：驼铃、香料、波斯毯与四面八方的口音。客栈里半数是商人，另一半说不清是什么人。",
              c: "江湖常见去处（类型地标）：东西商道与异域武学的路口。"
            },
            {
              id: "nanjiang",
              n: "南疆瘴林",
              x: 40,
              y: 84,
              t: "wild",
              d: 5,
              rg: "南疆瘴林",
              aliases: ["南疆", "瘴林", "十万大山", "毒沼"],
              desc: "湿热的雾瘴里藏着蛊、毒、瘴与不肯见外人的寨子。进山带盐，出山带命——用毒的世家、养蛊的苗人，规矩比中原的门派更硬。",
              c: "江湖常见去处（类型地标）：毒蛊一脉的巢穴与凶险纵深。"
            },
            {
              id: "donghai",
              n: "东海渔港",
              x: 86,
              y: 72,
              t: "city",
              d: 2,
              rg: "东海之滨",
              aliases: ["东海", "渔港", "海港", "出海"],
              desc: "咸腥的码头：渔汛、私盐、东渡的船与不归的帆。海边的人信龙王也信拳头——下海讨生活的狠，不输刀口舔血。",
              c: "江湖常见去处（类型地标）：海路纵深与海外传说的起点。"
            },
            {
              id: "xueling",
              n: "雪岭雄关",
              x: 52,
              y: 12,
              t: "danger",
              d: 4,
              rg: "雪岭天关",
              aliases: ["雪岭", "雄关", "关外", "天险"],
              desc: "一线鸟道盘上云霄，关门一闭便是两个天下。戍卒的狼烟、马帮的铜铃、雪山派的眼线——天险之处，必有江湖。",
              c: "江湖常见去处（类型地标）：天险关隘与戍边格局。"
            },
            {
              id: "jianzhong",
              n: "绝壁剑冢",
              x: 76,
              y: 14,
              t: "relic",
              d: 4,
              rg: "雪岭天关",
              aliases: ["剑冢", "绝壁", "剑冢遗迹"],
              desc: "万仞绝壁下的深谷，锈剑插了一谷——每一柄背后都是一段没说完的恩怨。传说谷底压着前朝剑圣的遗刻，历代登壁者众，生还者寡。",
              c: "江湖常见去处（类型地标）：机缘、遗刻与旧案的经典埋藏地。"
            }
          ]
        }
      ]
    },
    /* ---------- 克苏鲁恐怖（创作工坊 · 类型地标） ---------- */
    cthulhu: {
      generic: true,
      name: "克苏鲁 · 行旅图鉴",
      flavor: "看得越清楚，醒着的每一夜就越长",
      layers: [
        {
          id: "arkham",
          name: "阿卡姆 · 雾雨学城",
          ico: "雾",
          hint: "一座雨总也停不下来的大学城：图书馆、疯人院、码头各藏着半本不该读的书",
          decor: "city",
          regions: [
            { n: "密斯卡托尼克河岸", cx: 34, cy: 42, rx: 24, ry: 24, tr: "city" },
            { n: "联邦山旧城区", cx: 70, cy: 30, rx: 18, ry: 16, tr: "city" },
            { n: "南岸码头区", cx: 52, cy: 80, rx: 24, ry: 12, tr: "water" }
          ],
          roads: [
            ["miskatonic", "library"],
            ["miskatonic", "history"],
            ["miskatonic", "lodge"],
            ["lodge", "asylum"],
            ["miskatonic", "docks"],
            ["history", "docks"],
            ["docks", "lodge"]
          ],
          nodes: [
            {
              id: "miskatonic",
              n: "密斯卡托尼克大学",
              x: 30,
              y: 40,
              t: "start",
              d: 2,
              rg: "密斯卡托尼克河岸",
              aliases: ["密大", "大学", "密斯卡托尼克", "学府"],
              desc: "灰石教学楼常年返潮，人类学系、考古学系与民俗学系的办公室在同一层。调查多从这里开始：一份委托、一封讣告、一件寄错的包裹——教授们总是先派学生去，自己留在灯下翻书。",
              c: "克苏鲁题材常见去处（类型地标）：理性阵营的起点与任务发布地。"
            },
            {
              id: "library",
              n: "禁书阅览室",
              x: 18,
              y: 28,
              t: "relic",
              d: 4,
              rg: "密斯卡托尼克河岸",
              aliases: ["图书馆", "禁书室", "阅览室", "珍本室"],
              desc: "地下三层，铁门锁着拉丁文与阿拉伯文的抄本。借书卡上有几十年前的名字，笔迹越往后越抖。抄下一段咒文只需一刻钟，忘掉它要花掉余生。",
              c: "克苏鲁题材常见去处（类型地标）：禁忌知识的收藏所。"
            },
            {
              id: "history",
              n: "阿卡姆历史学会",
              x: 44,
              y: 52,
              t: "poi",
              d: 2,
              rg: "密斯卡托尼克河岸",
              aliases: ["历史学会", "学会", "档案室", "旧报馆"],
              desc: "黄铜吊灯下的旧报纸合订本、教会名册与地契。这里的老太太记得城里每一户人家的祖上——前提是你能听懂她含糊其辞的部分。",
              c: "克苏鲁题材常见去处（类型地标）：旧案、族谱与传闻的查证处。"
            },
            {
              id: "asylum",
              n: "阿卡姆疯人院",
              x: 72,
              y: 26,
              t: "danger",
              d: 4,
              rg: "联邦山旧城区",
              aliases: ["疯人院", "疗养院", "精神病院", "收容所"],
              desc: "走廊尽头的病房住着见过不该见之物的人。他们说的东西互相矛盾，唯独在某一处细节上出奇一致。探视时间很短，夜里的声音很长。",
              c: "克苏鲁题材常见去处（类型地标）：理智耗尽者的收容地与线索源。"
            },
            {
              id: "lodge",
              n: "银暮密会堂",
              x: 64,
              y: 38,
              t: "sect",
              d: 3,
              rg: "联邦山旧城区",
              aliases: ["密会堂", "教团", "集会地", "银暮小屋"],
              desc: "门铃响三长两短，门后是兜帽与低语。他们不效忠某一个名字，只在需要时与人合作、也随时反噬。混入其中能得到别处得不到的答案，代价是你会被记住。",
              c: "克苏鲁题材常见去处（类型地标）：邪教与秘密结社的巢穴。"
            },
            {
              id: "docks",
              n: "阿卡姆南码头",
              x: 50,
              y: 80,
              t: "poi",
              d: 2,
              rg: "南岸码头区",
              aliases: ["码头", "港区", "南码头", "仓库区"],
              desc: "夜里从海上来的船不报关。鱼腥味盖过了别的味道，守夜人说他只听见浪。翻一翻货单，有些箱子的重量与内容对不上。",
              c: "克苏鲁题材常见去处（类型地标）：走私、偷渡与异物的入口。"
            }
          ]
        },
        {
          id: "countryside",
          name: "新英格兰 · 诡影乡野",
          ico: "野",
          hint: "离城越远，规矩越古老：河谷、渔镇与荒原各守着一份不该翻的旧账",
          decor: "land",
          regions: [
            { n: "密斯卡托尼克河谷", cx: 30, cy: 40, rx: 22, ry: 22, tr: "forest" },
            { n: "海岸渔镇", cx: 74, cy: 40, rx: 20, ry: 18, tr: "water" },
            { n: "枯萎荒原", cx: 42, cy: 84, rx: 26, ry: 10, tr: "desert" }
          ],
          roads: [
            ["kingsport", "innsmouth"],
            ["innsmouth", "dunwich"],
            ["dunwich", "whateley"],
            ["dunwich", "blasted"],
            ["innsmouth", "blasted"]
          ],
          nodes: [
            {
              id: "dunwich",
              n: "敦威治村",
              x: 26,
              y: 44,
              t: "wild",
              d: 3,
              rg: "密斯卡托尼克河谷",
              aliases: ["敦威治", "山村", "河谷", "山谷"],
              desc: "十几户人家的破落山村，教堂塌了半边，孩子不上学。问路时他们会先看你从哪个方向来。山那边的东西长得太快，村里人从不提它的名字。",
              c: "克苏鲁题材常见去处（类型地标）：闭塞山村与异变血裔的舞台。"
            },
            {
              id: "whateley",
              n: "韦特利农庄",
              x: 38,
              y: 26,
              t: "danger",
              d: 4,
              rg: "密斯卡托尼克河谷",
              aliases: ["农庄", "老宅", "韦特利家", "谷仓"],
              desc: "木板钉死的谷仓比正屋还大，圈里的牲口被咬得不像任何一种本地野兽。楼上窗子日夜遮着布——据说是有人在养什么。进屋前记得数清自己的脚步声。",
              c: "克苏鲁题材常见去处（类型地标）：异界召唤与家族秘仪的现场。"
            },
            {
              id: "innsmouth",
              n: "印斯茅斯渔港",
              x: 76,
              y: 44,
              t: "city",
              d: 4,
              rg: "海岸渔镇",
              aliases: ["印斯茅斯", "渔港", "渔村", "海岸小镇"],
              desc: "一半的房屋空着，剩下的住着眼神湿冷、脖子上有细痕的人。这里的金饰成色好得离谱，旅馆老板不收外地人的钱。天黑之后别出门，也别往礁石那边看。",
              c: "克苏鲁题材常见去处（类型地标）：与深海缔约的血脉小镇。"
            },
            {
              id: "kingsport",
              n: "金斯波特海岬",
              x: 66,
              y: 28,
              t: "poi",
              d: 2,
              rg: "海岸渔镇",
              aliases: ["金斯波特", "海岬", "灯塔", "老渔村"],
              desc: "独立战争前的石头房子沿崖而建，灯塔的光扫过雾面一秒一次。老住户讲猎巫年代的旧事时语气平淡，仿佛那些事还在继续。",
              c: "克苏鲁题材常见去处（类型地标）：古老港口与旧日传承的入口。"
            },
            {
              id: "blasted",
              n: "枯萎荒原",
              x: 42,
              y: 84,
              t: "danger",
              d: 5,
              rg: "枯萎荒原",
              aliases: ["荒原", "枯萎之地", "星之彩", "陨坑"],
              desc: "一英里见方的土地寸草不生，夜里无风自动、泛着不属于任何已知光谱的颜色。井水早不能喝，搬走的人没一个敢回头。站得越久，越难说出自己看见了什么。",
              c: "克苏鲁题材常见去处（类型地标）：异星坠落物的污染区。"
            }
          ]
        },
        {
          id: "beyond",
          name: "异域 · 深渊与梦境",
          ico: "渊",
          hint: "地图边缘之外：沉城、冰原与不该被梦见的地方",
          decor: "cosmos",
          regions: [
            { n: "南太平洋礁域", cx: 24, cy: 40, rx: 18, ry: 20, tr: "water" },
            { n: "南极冰原", cx: 66, cy: 34, rx: 18, ry: 18, tr: "mountain" },
            { n: "异星梦境", cx: 50, cy: 84, rx: 30, ry: 10, tr: "void" }
          ],
          roads: [
            ["rlyeh", "madness"],
            ["rlyeh", "dreamgate"],
            ["madness", "dreamgate"],
            ["dreamgate", "carcosa"]
          ],
          nodes: [
            {
              id: "rlyeh",
              n: "拉莱耶礁",
              x: 22,
              y: 38,
              t: "relic",
              d: 5,
              rg: "南太平洋礁域",
              aliases: ["拉莱耶", "沉城", "南太平洋礁", "海底都市"],
              desc: "海图上没有的黑点，只在地震后才浮出水面几分钟。石块的棱角不合任何几何学，走上去会觉得上下颠倒。睡在下面的那位并未死去——它只是在等星辰归位。",
              c: "克苏鲁题材常见去处（类型地标）：旧日支配者的沉眠之所。"
            },
            {
              id: "madness",
              n: "疯狂山脉营地",
              x: 66,
              y: 34,
              t: "danger",
              d: 5,
              rg: "南极冰原",
              aliases: ["疯狂山脉", "南极", "营地", "冰原"],
              desc: "黑色山脉比喜马拉雅还高，山那侧的废墟比人类历史更久远。风里回荡着五拍一循环的哨声，营地的狗一听见就发狂。带够燃料，也带够不回头的决心。",
              c: "克苏鲁题材常见去处（类型地标）：极地远征与史前废墟的终点。"
            },
            {
              id: "dreamgate",
              n: "幻梦境入口",
              x: 36,
              y: 84,
              t: "poi",
              d: 3,
              rg: "异星梦境",
              aliases: ["幻梦境", "梦境入口", "梦境", "梦界"],
              desc: "清醒世界的另一侧：七十级台阶、能让人下坠的悬崖与不设门的城池。做梦够深的人能走进去，走进去的人往往分不清自己是醒着还是在往更深处走。",
              c: "克苏鲁题材常见去处（类型地标）：梦与现实交界的异界纵深。"
            },
            {
              id: "carcosa",
              n: "卡尔克萨废城",
              x: 62,
              y: 86,
              t: "relic",
              d: 4,
              rg: "异星梦境",
              aliases: ["卡尔克萨", "废城", "哈利湖", "黄衣之王"],
              desc: "湖畔的废墟在两颗太阳下沉睡，塔楼的影子不朝着光来的方向。戴着苍白面具的东西在城中行走，见它真容的人此后只会重复同一句话。",
              c: "克苏鲁题材常见去处（类型地标）：异星遗迹与不可名状者的居城。"
            }
          ]
        }
      ]
    },
    /* ---------- 悬疑推理（创作工坊 · 类型地标） ---------- */
    mystery: {
      generic: true,
      name: "悬疑推理 · 行旅图鉴",
      flavor: "每个在场的人，都少说了一件事",
      layers: [
        {
          id: "city",
          name: "雾都 · 案发地",
          ico: "城",
          hint: "雨夜、煤气灯与永远擦不干净的石板路——警署、法医室与俱乐部之间只隔几条街",
          decor: "city",
          regions: [
            { n: "旧城区", cx: 30, cy: 40, rx: 24, ry: 22, tr: "city" },
            { n: "河岸港区", cx: 74, cy: 62, rx: 20, ry: 18, tr: "water" },
            { n: "新市广场", cx: 42, cy: 84, rx: 28, ry: 10, tr: "city" }
          ],
          roads: [
            ["police", "morgue"],
            ["police", "alley"],
            ["police", "court"],
            ["court", "club"],
            ["club", "warehouse"],
            ["alley", "club"]
          ],
          nodes: [
            {
              id: "police",
              n: "中央警署",
              x: 28,
              y: 40,
              t: "start",
              d: 2,
              rg: "旧城区",
              aliases: ["警署", "警局", "警察局", "重案组"],
              desc: "二楼的办公室永远亮着灯：案卷、证物袋与冷掉的咖啡。问讯室的单向玻璃后面，每个人的说法都对得上——除了时间差上那七分钟。",
              c: "悬疑推理常见去处（类型地标）：调查的起点与问讯舞台。"
            },
            {
              id: "morgue",
              n: "法医检验室",
              x: 18,
              y: 50,
              t: "poi",
              d: 2,
              rg: "旧城区",
              aliases: ["法医室", "验尸房", "停尸间", "解剖室"],
              desc: "瓷砖、不锈钢与福尔马林的味道。尸体不会说谎，但也不主动开口：尸斑的位置、指甲里的纤维、胃内容物的消化程度，都要有人替它说话。",
              c: "悬疑推理常见去处（类型地标）：物证与死亡时间的判定所。"
            },
            {
              id: "alley",
              n: "雾巷现场",
              x: 40,
              y: 30,
              t: "danger",
              d: 3,
              rg: "旧城区",
              aliases: ["案发地", "小巷", "后巷", "现场"],
              desc: "两堵高墙之间的一条窄巷，煤气灯坏了三个月没人修。粉笔线画下一个人形，墙上有刮痕、地上有不属于死者的鞋印——第一现场往往比证词诚实。",
              c: "悬疑推理常见去处（类型地标）：第一现场与重现推演之地。"
            },
            {
              id: "court",
              n: "中央法庭",
              x: 42,
              y: 84,
              t: "city",
              d: 3,
              rg: "新市广场",
              aliases: ["法庭", "法院", "审判庭"],
              desc: "橡木高背椅、旁听席与不许喧哗的规矩。这里不查真相，只认证据链：漏掉一环，真凶就当庭走出大门。结案陈词往往也是全案最精彩的一页。",
              c: "悬疑推理常见去处（类型地标）：指控、辩护与真相摊牌的终局场。"
            },
            {
              id: "club",
              n: "银匙俱乐部",
              x: 70,
              y: 54,
              t: "poi",
              d: 2,
              rg: "河岸港区",
              aliases: ["俱乐部", "私人会所", "沙龙", "牌室"],
              desc: "皮沙发、雪茄与不对外人开放的会员名册。上流社会的八卦在这里流通得比报纸快，一句醉话抵得过半打笔录——前提是你能混进去。",
              c: "悬疑推理常见去处（类型地标）：上流人脉与隐秘交易的社交场。"
            },
            {
              id: "warehouse",
              n: "废弃码头仓库",
              x: 80,
              y: 70,
              t: "danger",
              d: 4,
              rg: "河岸港区",
              aliases: ["仓库", "码头仓库", "废弃仓库", "货栈"],
              desc: "锈死的卷帘门只开半扇，海水的腥味混着机油。木箱上有外文的唛头，角落里的麻袋不该那么沉。来这里的人都不想被看见，所以很少有人活着作证。",
              c: "悬疑推理常见去处（类型地标）：走私、绑架与最终对峙的高危现场。"
            }
          ]
        },
        {
          id: "outskirts",
          name: "郊野 · 庄园与旧镇",
          ico: "庄",
          hint: "出了城，熟人社会更密不透风：庄园、旅馆与疗养院各锁着一段旧事",
          decor: "land",
          regions: [
            { n: "郊野庄园带", cx: 32, cy: 40, rx: 24, ry: 22, tr: "forest" },
            { n: "荒镇旧路", cx: 70, cy: 40, rx: 20, ry: 20, tr: "plain" },
            { n: "疗养院山林", cx: 46, cy: 84, rx: 26, ry: 10, tr: "mountain" }
          ],
          roads: [
            ["manor", "chamber"],
            ["manor", "station"],
            ["station", "hotel"],
            ["hotel", "sanatorium"],
            ["manor", "sanatorium"]
          ],
          nodes: [
            {
              id: "manor",
              n: "雨夜庄园",
              x: 28,
              y: 36,
              t: "poi",
              d: 3,
              rg: "郊野庄园带",
              aliases: ["庄园", "老宅", "宅邸", "别墅"],
              desc: "暴雨冲垮了唯一一条路，电话线在晚饭前断了。客厅里坐着八个人：继承人、旧友、管家、不请自来的客人——每个人都有理由希望那个人死，也都有不在场证明。",
              c: "悬疑推理常见去处（类型地标）：封闭空间与限定嫌疑人的经典舞台。"
            },
            {
              id: "chamber",
              n: "庄园密室",
              x: 40,
              y: 26,
              t: "relic",
              d: 4,
              rg: "郊野庄园带",
              aliases: ["密室", "书房", "暗室", "藏书室"],
              desc: "门从里面反锁，钥匙在死者手心里，窗户是十九世纪的老式插销。壁炉后的暗格、地板下的夹层、书房里翻到第几页的日记——密室从来不是给凶手用的，是给说故事的人用的。",
              c: "悬疑推理常见去处（类型地标）：密室手法与暗格遗嘱的藏身处。"
            },
            {
              id: "hotel",
              n: "废弃旅馆",
              x: 70,
              y: 40,
              t: "danger",
              d: 4,
              rg: "荒镇旧路",
              aliases: ["旅馆", "废弃旅店", "汽车旅馆", "旧旅馆"],
              desc: "招牌掉了一个字母，登记簿停在十一年前的那一天。走廊地毯吸掉脚步声，三楼的房间门牌号比房间数多一个。过夜的人第二天早上常常少一个。",
              c: "悬疑推理常见去处（类型地标）：失踪案与旧案回访的荒废据点。"
            },
            {
              id: "station",
              n: "雾镇车站",
              x: 62,
              y: 52,
              t: "poi",
              d: 2,
              rg: "荒镇旧路",
              aliases: ["车站", "火车站", "候车室", "月台"],
              desc: "一天只有两班车的小站，候车室的炉子常年烧着。站长记得每个上下车的人，售票存根能还原一整条时间线——有时候，不在场证明就毁在一张票根上。",
              c: "悬疑推理常见去处（类型地标）：时刻表与不在场证明的核对点。"
            },
            {
              id: "sanatorium",
              n: "岭上疗养院",
              x: 46,
              y: 84,
              t: "danger",
              d: 5,
              rg: "疗养院山林",
              aliases: ["疗养院", "精神病院", "疗养所", "山间病院"],
              desc: "盘山公路尽头的一栋白楼，病历锁在铁柜里，医生的名字早已被涂掉。病人们说的事情互相印证，却无人相信——在这里，分不清谁是病人、谁是被藏起来的人。",
              c: "悬疑推理常见去处（类型地标）：身份疑云与旧案真相的封存地。"
            }
          ]
        },
        {
          id: "nightlines",
          name: "夜行 · 铁道与暗面",
          ico: "夜",
          hint: "移动的密室与不记名的情报网：列车、道口、当铺与报馆资料室",
          decor: "land",
          regions: [
            { n: "夜行铁道", cx: 40, cy: 40, rx: 32, ry: 14, tr: "plain" },
            { n: "地下情报网", cx: 46, cy: 80, rx: 30, ry: 12, tr: "city" }
          ],
          roads: [
            ["train", "crossing"],
            ["train", "pawnshop"],
            ["pawnshop", "archive"],
            ["crossing", "archive"]
          ],
          nodes: [
            {
              id: "train",
              n: "夜行列车",
              x: 24,
              y: 40,
              t: "poi",
              d: 3,
              rg: "夜行铁道",
              aliases: ["列车", "夜车", "火车", "卧铺车厢"],
              desc: "封闭、高速、乘客名单固定——最完美的密室。检票口在身后关上，到站之前没有人能下船：行李架上的箱子、上锁的盥洗室、半夜停车的三分钟，全都是破绽。",
              c: "悬疑推理常见去处（类型地标）：移动密室与限时破案的经典设定。"
            },
            {
              id: "crossing",
              n: "荒野道口",
              x: 56,
              y: 44,
              t: "danger",
              d: 3,
              rg: "夜行铁道",
              aliases: ["道口", "铁道路口", "无人道口", "荒野"],
              desc: "拦杆、闪灯与一片没有路灯的旷野。车灯扫过时能看见土路上的新鲜车辙，以及被拖行过的痕迹。目击者只有一个：值夜的道口工，而他记性不太好。",
              c: "悬疑推理常见去处（类型地标）：抛尸、转运与时间点对质的现场。"
            },
            {
              id: "pawnshop",
              n: "旧货当铺",
              x: 34,
              y: 80,
              t: "poi",
              d: 2,
              rg: "地下情报网",
              aliases: ["当铺", "旧货店", "典当行", "古董店"],
              desc: "柜台上摆着没人认领的抵押品，后屋的账本只写代号不写名字。任何一件赃物都会先经过这里——朝奉的眼睛比警探更毒，只是他从不主动开口。",
              c: "悬疑推理常见去处（类型地标）：赃物流转与线人交易的暗面枢纽。"
            },
            {
              id: "archive",
              n: "报馆资料室",
              x: 60,
              y: 84,
              t: "relic",
              d: 2,
              rg: "地下情报网",
              aliases: ["报馆", "资料室", "报社", "档案室"],
              desc: "过期的社会新闻按年份装订，剪报上有前任记者留下的批注。二十年前的版面里藏着同一副面孔、同一个手法——连环的事，从来不是第一次发生。",
              c: "悬疑推理常见去处（类型地标）：旧案比对与线索串联的资料库。"
            }
          ]
        }
      ]
    },
    /* ---------- 科幻未来（创作工坊 · 类型地标） ---------- */
    scifi: {
      generic: true,
      name: "科幻未来 · 行旅图鉴",
      flavor: "所有技术问题，最后都变成人的问题",
      layers: [
        {
          id: "orbit",
          name: "轨道 · 环带空间站",
          ico: "轨",
          hint: "重力靠旋转制造，空气靠配给——枢纽舱、船坞与摆渡港串起一条补给线",
          decor: "cosmos",
          regions: [
            { n: "中央环带", cx: 40, cy: 40, rx: 26, ry: 20, tr: "void" },
            { n: "外环船坞", cx: 74, cy: 66, rx: 20, ry: 16, tr: "void" },
            { n: "地勤枢纽", cx: 30, cy: 82, rx: 20, ry: 10, tr: "city" }
          ],
          roads: [
            ["hub", "aicore"],
            ["hub", "shuttle"],
            ["aicore", "dock"],
            ["dock", "wreck"],
            ["wreck", "shuttle"]
          ],
          nodes: [
            {
              id: "hub",
              n: "中央枢纽舱",
              x: 34,
              y: 36,
              t: "start",
              d: 2,
              rg: "中央环带",
              aliases: ["枢纽舱", "中央舱", "空间站", "中环"],
              desc: "八根辐条通向环体，转一圈九十秒，窗外是永不落下的地球。舱内挤着货商、走私贩、换班的工程师与等着被遣返的人——一切委托与麻烦都从这里分发。",
              c: "科幻未来常见去处（类型地标）：轨道社会的中心与任务起点。"
            },
            {
              id: "aicore",
              n: "AI 核心机房",
              x: 52,
              y: 30,
              t: "relic",
              d: 4,
              rg: "中央环带",
              aliases: ["AI核心", "核心机房", "主机", "智脑"],
              desc: "恒温、无尘、只有散热风扇的白噪音。三十七层权限里最高那三层从未有人用过。它回答问题的方式越来越像在反问，而日志里有一段被自己删掉了。",
              c: "科幻未来常见去处（类型地标）：人工智能与失控危机的核心现场。"
            },
            {
              id: "dock",
              n: "外环船坞",
              x: 74,
              y: 64,
              t: "poi",
              d: 2,
              rg: "外环船坞",
              aliases: ["船坞", "泊位", "维修坞", "航天港"],
              desc: "机械臂托着半拆的货船，焊花在真空里无声地闪。坞长什么都修，也什么都敢收——只要价钱合适，船籍编号可以重新打一遍。",
              c: "科幻未来常见去处（类型地标）：改装、补给与灰色交易的中转站。"
            },
            {
              id: "wreck",
              n: "废弃舰船",
              x: 62,
              y: 76,
              t: "danger",
              d: 4,
              rg: "外环船坞",
              aliases: ["废船", "幽灵船", "失事船", "弃舰"],
              desc: "失去动力的老舰在轨道上漂了十二年，舱内还有气压，黑匣子还在循环播放最后一句通话。登舰的人都说冷，且说不清是温度还是别的原因。",
              c: "科幻未来常见去处（类型地标）：密闭求生与失踪事件的高危现场。"
            },
            {
              id: "shuttle",
              n: "地勤摆渡港",
              x: 28,
              y: 82,
              t: "city",
              d: 1,
              rg: "地勤枢纽",
              aliases: ["摆渡港", "航天港", "地勤站", "发射场"],
              desc: "每天四班下行，票价抵得上普通人半年工资。候机厅里一半是回家的人，另一半是再也回不去的——安检门能查出金属，查不出别的东西。",
              c: "科幻未来常见去处（类型地标）：天地往返与身份出逃的关口。"
            }
          ]
        },
        {
          id: "megalopolis",
          name: "地表 · 赛博都市",
          ico: "霓",
          hint: "上层是企业的天穹，下层是霓虹照不到的街——同一座城，两个纪元",
          decor: "city",
          regions: [
            { n: "上层天穹区", cx: 44, cy: 26, rx: 28, ry: 14, tr: "city" },
            { n: "旧城下街区", cx: 40, cy: 68, rx: 30, ry: 16, tr: "city" },
            { n: "城郊废土", cx: 82, cy: 72, rx: 14, ry: 14, tr: "desert" }
          ],
          roads: [
            ["tower", "arena"],
            ["tower", "neon"],
            ["neon", "lab"],
            ["lab", "waste"],
            ["arena", "neon"]
          ],
          nodes: [
            {
              id: "tower",
              n: "天穹企业塔",
              x: 30,
              y: 24,
              t: "city",
              d: 3,
              rg: "上层天穹区",
              aliases: ["企业塔", "公司总部", "天穹区", "摩天楼"],
              desc: "两百层的玻璃塔顶在云上，雨季的人工日照只照这一片。董事会的一句话能让下城区停水三天——在这里办事要预约、要担保，还要有人替你背书。",
              c: "科幻未来常见去处（类型地标）：巨型企业权力与阴谋的顶点。"
            },
            {
              id: "arena",
              n: "全息竞技场",
              x: 60,
              y: 30,
              t: "arena",
              d: 3,
              rg: "上层天穹区",
              aliases: ["竞技场", "角斗场", "全息场", "赛场"],
              desc: "观众席投影在真实座位的残骸上，选手的义体在碰撞里冒着冷却雾。赢的人能换一张上城通行证，输的人由赞助商回收零件——票价便宜得可疑。",
              c: "科幻未来常见去处（类型地标）：义体竞技与阶层跃迁的残酷舞台。"
            },
            {
              id: "neon",
              n: "霓虹黑市",
              x: 34,
              y: 66,
              t: "poi",
              d: 3,
              rg: "旧城下街区",
              aliases: ["黑市", "下城区", "夜市", "霓虹街"],
              desc: "招牌用六种语言闪烁，雨水把霓虹倒影搅成一锅汤。这里卖二手神经模组、假身份、走私药，也卖消息——问价之前先想清楚，你买到的情报会不会同时被卖给对方。",
              c: "科幻未来常见去处（类型地标）：灰色交易与情报流通的地下街区。"
            },
            {
              id: "lab",
              n: "生化实验室",
              x: 54,
              y: 74,
              t: "danger",
              d: 4,
              rg: "旧城下街区",
              aliases: ["实验室", "生化所", "研究所", "隔离区"],
              desc: "气闸门后是负压走廊，培养舱里养着不该被造出来的东西。日志显示隔离等级上周被悄悄降过一档，而通风口的风向，正对着城区的排水系统。",
              c: "科幻未来常见去处（类型地标）：失控实验与疫情封锁的源头。"
            },
            {
              id: "waste",
              n: "城郊废土",
              x: 84,
              y: 72,
              t: "wild",
              d: 3,
              rg: "城郊废土",
              aliases: ["废土", "城郊", "垃圾带", "无人区"],
              desc: "电子垃圾堆成的山丘一直铺到地平线，拾荒者住在集装箱里，靠拆旧型号的主板过活。城市的排污渠在这里入海，喝下游水的人活不过四十岁。",
              c: "科幻未来常见去处（类型地标）：文明边缘的拾荒带与流放地。"
            }
          ]
        },
        {
          id: "deepspace",
          name: "深空 · 星舰与殖民地",
          ico: "舰",
          hint: "离开大气层之后：穹顶城、舰桥、星门与小行星矿带",
          decor: "cosmos",
          regions: [
            { n: "火星殖民地", cx: 30, cy: 40, rx: 22, ry: 18, tr: "desert" },
            { n: "深空航道", cx: 70, cy: 34, rx: 20, ry: 18, tr: "void" },
            { n: "小行星矿带", cx: 52, cy: 82, rx: 30, ry: 10, tr: "mountain" }
          ],
          roads: [
            ["mars", "terraform"],
            ["mars", "bridge"],
            ["bridge", "gate"],
            ["gate", "belt"],
            ["terraform", "belt"]
          ],
          nodes: [
            {
              id: "mars",
              n: "火星穹顶城",
              x: 28,
              y: 38,
              t: "city",
              d: 3,
              rg: "火星殖民地",
              aliases: ["火星", "穹顶城", "殖民地", "红色星球"],
              desc: "二十个互不相通的穹顶靠气闸连接，穹顶外是零下六十度的夜。空气按人头配给，水比酒贵，出生在这里的孩子从没见过下雨——自治的口号贴在每个走廊口。",
              c: "科幻未来常见去处（类型地标）：地外殖民与资源配给政治的舞台。"
            },
            {
              id: "terraform",
              n: "地表改造站",
              x: 40,
              y: 26,
              t: "poi",
              d: 3,
              rg: "火星殖民地",
              aliases: ["改造站", "地球化站", "改造工程", "气象站"],
              desc: "巨大的放热塔昼夜运转，把稀薄的大气一点点加厚。工程师说还要四十年，工人说这辈子看不到——而地下岩层里挖出的东西，比任何一个工期都古老。",
              c: "科幻未来常见去处（类型地标）：改造工程与地外遗迹的发现地。"
            },
            {
              id: "bridge",
              n: "深空舰桥",
              x: 70,
              y: 34,
              t: "poi",
              d: 3,
              rg: "深空航道",
              aliases: ["舰桥", "指挥舱", "星舰", "主控室"],
              desc: "全息星图铺满半舱，值更官的咖啡在失重里凝成球。航行日志比任何人的记忆都长：一次偏航、一段被跳过的坐标、一个不该收到回音的呼叫。",
              c: "科幻未来常见去处（类型地标）：远航指挥与深空事故的现场。"
            },
            {
              id: "gate",
              n: "跃迁星门",
              x: 80,
              y: 46,
              t: "relic",
              d: 5,
              rg: "深空航道",
              aliases: ["星门", "跃迁门", "虫洞", "传送门"],
              desc: "直径两公里的环，谁也说不清是谁造的、通向哪里。通航三百年，回来的船比出去的少，回来的船长的报告也比出去时短。穿过它只需要一秒，理解它需要一代人。",
              c: "科幻未来常见去处（类型地标）：超光速航行与未知接触的关口。"
            },
            {
              id: "belt",
              n: "小行星矿场",
              x: 52,
              y: 82,
              t: "danger",
              d: 4,
              rg: "小行星矿带",
              aliases: ["矿场", "矿带", "小行星", "采矿站"],
              desc: "凿岩机昼夜不停，矿工按吨位计酬，安全规程贴在墙上没人看。合同之外还有另一套规矩：矿脉深处发现的东西，公司不写在报告里。",
              c: "科幻未来常见去处（类型地标）：资源争夺与劳工冲突的前线。"
            }
          ]
        }
      ]
    }
  };
  const state = { genre: null, layerId: null, currentId: null, visits: [], dyn: [], open: false };
  const $ = (id) => document.getElementById(id);
  const store = {};
  function currentGenreKey() {
    const k = window.storyFramework && window.storyFramework.config && window.storyFramework.config.genreKey;
    return k || new URLSearchParams(location.search).get("genre");
  }
  function ensureGenreData(genre) {
    if (!genre || ATLAS_DATA[genre]) return ATLAS_DATA[genre] || null;
    ATLAS_DATA[genre] = {
      generic: true,
      fallback: true,
      name: "行迹图鉴",
      flavor: "此界无预置舆图，足迹即山河",
      layers: [{
        id: "trace",
        name: "行迹",
        ico: "✦",
        hint: "AI 上报的每一处落脚地都会在此生成地标",
        decor: "land",
        regions: [],
        roads: [],
        nodes: [{
          id: "start_" + genre,
          n: "启程之地",
          x: 50,
          y: 50,
          t: "start",
          d: 1,
          rg: "起点",
          desc: "故事开始的地方。此界暂无预置舆图——AI 每上报一处行踪，行迹图鉴便落下一枚地标，走到哪，记到哪。",
          c: "行迹图鉴 · 原创世界"
        }]
      }]
    };
    return ATLAS_DATA[genre];
  }
  function isTraceMode() {
    const g = ATLAS_DATA[state.genre];
    return state.genre === "earth" || !!(g && g.generic);
  }
  function isFallbackGenre(genre) {
    const g = ATLAS_DATA[genre];
    return !!(g && g.generic && g.fallback);
  }
  function storeKey() {
    return `storyAtlas_${state.genre}`;
  }
  function save() {
    const v = JSON.stringify({ layerId: state.layerId, currentId: state.currentId, visits: state.visits, dyn: state.dyn || [] });
    try {
      localStorage.setItem(storeKey(), v);
    } catch (e) {
    }
    store[storeKey()] = v;
  }
  function load(genre) {
    let raw = null;
    try {
      raw = localStorage.getItem("storyAtlas_" + genre) || store["storyAtlas_" + genre];
    } catch (e) {
      raw = store["storyAtlas_" + genre] || null;
    }
    if (raw) {
      try {
        const o = JSON.parse(raw);
        state.layerId = o.layerId || null;
        state.currentId = o.currentId || null;
        state.visits = Array.isArray(o.visits) ? o.visits : [];
        state.dyn = Array.isArray(o.dyn) ? o.dyn.filter((d) => d && d.id && d.n) : [];
      } catch (e) {
        state.visits = [];
        state.dyn = [];
      }
    }
  }
  function allNodes(genre) {
    const g = ATLAS_DATA[genre];
    if (!g) return [];
    const out = [];
    g.layers.forEach((l) => l.nodes.forEach((n) => out.push({ ...n, layerId: l.id })));
    (state.dyn || []).forEach((d) => out.push(d));
    return out;
  }
  function norm(s) {
    return String(s || "").replace(/[\s·・,，。、"'「」『』（）()【】\[\]]/g, "");
  }
  function matchNode(genre, rawLoc) {
    if (!rawLoc) return null;
    const parts = String(rawLoc).split(/[,，、\/]|(?:->|→|至|到)/).map(norm).filter((v) => v.length >= 2);
    if (!parts.length) return null;
    const nodes = allNodes(genre);
    let last = null;
    for (const v of parts) {
      let hit = nodes.find((n) => norm(n.n) === v) || nodes.find((n) => (n.aliases || []).some((a) => norm(a) === v)) || nodes.find((n) => v.includes(norm(n.n)) && norm(n.n).length >= 2) || nodes.find((n) => norm(n.n).includes(v));
      if (hit) last = hit;
    }
    return last;
  }
  const DYN_MAX = 16;
  function strHash(s) {
    let h = 5381;
    s = String(s);
    for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) >>> 0;
    return h;
  }
  function resolveLocation(genre, rawLoc, round) {
    if (!rawLoc) return null;
    const parts = String(rawLoc).split(/[,，、\/]|(?:->|→|至|到)/).map(norm).filter((v) => v.length >= 2);
    if (!parts.length) return null;
    const nodes = allNodes(genre);
    const findPreset = (v) => nodes.find((n) => !n.dyn && (norm(n.n) === v || (n.aliases || []).some((a) => norm(a) === v))) || nodes.find((n) => !n.dyn && v.includes(norm(n.n)) && norm(n.n).length >= 2) || nodes.find((n) => !n.dyn && norm(n.n).includes(v));
    const last = parts[parts.length - 1];
    const exact = (v) => nodes.find((n) => !n.dyn && (norm(n.n) === v || (n.aliases || []).some((a) => norm(a) === v)));
    if (exact(last)) return exact(last);
    let embed = null;
    for (const c of nodes) {
      if (c.dyn || norm(c.n).length < 2 || !last.includes(norm(c.n))) continue;
      const rest = last.split(norm(c.n)).join("").replace(/^[的·之外内旁附近处地]+/, "").replace(/[的·之外内旁附近处地]+$/, "");
      if (rest.length >= 2 && (!embed || norm(c.n).length > norm(embed.n).length)) embed = c;
    }
    const exist = (state.dyn || []).find((d) => norm(d.n) === last || (d.aliases || []).some((a) => norm(a) === last));
    if (exist) return exist;
    if (!embed) {
      const fuzzy = nodes.find((n) => !n.dyn && last.length >= 2 && norm(n.n).includes(last)) || nodes.find((n) => !n.dyn && last.length >= 2 && (n.aliases || []).some((a) => norm(a).includes(last)));
      if (fuzzy) return fuzzy;
    }
    let anchor = embed;
    if (!anchor) for (const v of parts) {
      const h = findPreset(v);
      if (h) anchor = h;
    }
    if (!anchor && state.currentId) {
      const cur = nodes.find((n) => n.id === state.currentId) || null;
      anchor = cur && cur.dyn && isFallbackGenre(genre) ? cur : cur && !cur.dyn ? cur : null;
    }
    if (!anchor) {
      const g = ATLAS_DATA[genre];
      for (const l of g.layers) {
        const s = l.nodes.find((n) => n.t === "start");
        if (s) {
          anchor = { ...s, layerId: l.id };
          break;
        }
      }
    }
    if (!anchor) return null;
    let nm = last.split(norm(anchor.n)).join("").replace(/^[的·之外内旁附近处地]+/, "").replace(/[的·之外内旁附近处地]+$/, "");
    if (nm.length < 2) nm = last;
    if (nm.length > 10) nm = nm.slice(0, 10);
    const seed = strHash(anchor.id + "|" + nm);
    const same = nodes.filter((n) => n.layerId === anchor.layerId);
    let bx = anchor.x, by = anchor.y, best = -1;
    for (let i = 0; i < 14; i++) {
      const a = prand(seed, i) * Math.PI * 2, r = 5 + prand(seed + 7, i) * 4.5;
      const x = Math.min(94, Math.max(6, anchor.x + Math.cos(a) * r));
      const y = Math.min(92, Math.max(8, anchor.y + Math.sin(a) * r));
      let md = 99;
      for (const n of same) {
        const dd = Math.hypot(n.x - x, n.y - y);
        if (dd < md) md = dd;
      }
      if (md > best) {
        best = md;
        bx = x;
        by = y;
      }
      if (best >= 5.5) break;
    }
    const poi = {
      id: "dyn_" + seed.toString(36) + "_" + (state.dyn || []).length,
      n: nm,
      x: +bx.toFixed(1),
      y: +by.toFixed(1),
      t: "poi",
      d: Math.max(1, Math.min(3, anchor.d || 1)),
      rg: anchor.rg || "剧情行旅",
      layerId: anchor.layerId,
      anchorId: anchor.id,
      anchorN: anchor.n,
      round: round || 1,
      raw: String(rawLoc).trim(),
      dyn: true,
      aliases: [last],
      desc: "",
      c: ""
    };
    state.dyn = state.dyn || [];
    state.dyn.push(poi);
    if (state.dyn.length > DYN_MAX) {
      const idx = state.dyn.findIndex((d) => d.id !== poi.id);
      if (idx >= 0) {
        const dead = state.dyn[idx];
        state.dyn.splice(idx, 1);
        state.visits = state.visits.filter((v) => v.id !== dead.id);
      }
    }
    return poi;
  }
  function removeDyn(id) {
    state.dyn = (state.dyn || []).filter((d) => d.id !== id);
    state.visits = state.visits.filter((v) => v.id !== id);
    if (state.currentId === id) state.currentId = null;
    save();
    if (state.open) render();
  }
  function playerName() {
    const fw = window.storyFramework;
    const s = fw && fw.storyState && fw.storyState.setup;
    return s && s.playerName || null;
  }
  function strLoc(v) {
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }
  function extractPlayerLocation(vars) {
    if (!vars) return null;
    const chars = vars.characters;
    if (chars && typeof chars === "object" && !Array.isArray(chars)) {
      const pn = playerName();
      if (pn && chars[pn]) {
        const l = strLoc(chars[pn].location);
        if (l) return l;
      }
      for (const c of Object.values(chars)) {
        if (c && c.isPlayer === true) {
          const l = strLoc(c.location);
          if (l) return l;
        }
      }
    }
    for (const k of Object.keys(vars)) {
      if (/(^|\.)(location|位置|所在地|行踪|当前地点|坐标)$/i.test(k)) {
        const l = strLoc(vars[k]);
        if (l) return l;
      }
    }
    return null;
  }
  function onVars(vars) {
    const gk = currentGenreKey();
    if (gk && gk !== state.genre) {
      if (!ATLAS_DATA[gk]) ensureGenreData(gk);
      state.genre = gk;
      state.currentId = null;
      state.visits = [];
      state.layerId = null;
      state.dyn = [];
      load(gk);
    }
    if (!state.genre || !ATLAS_DATA[state.genre]) return;
    const loc = extractPlayerLocation(vars);
    if (!loc) return;
    const round = Number(vars && (vars.chapter || vars["回合数"])) || window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.turnCount || 0;
    const node = resolveLocation(state.genre, loc, round) || matchNode(state.genre, loc);
    if (!node) return;
    state.currentId = node.id;
    state.layerId = node.layerId;
    if (!state.visits.some((v) => v.id === node.id)) state.visits.push({ id: node.id, round });
    save();
    if (state.open) render();
  }
  function resolveCurrent() {
    const g = ATLAS_DATA[state.genre];
    if (!g) return null;
    if (state.currentId) {
      const n = allNodes(state.genre).find((x) => x.id === state.currentId);
      if (n) return { node: n, standby: false };
    }
    for (const l of g.layers) {
      const s = l.nodes.find((n) => n.t === "start");
      if (s) return { node: { ...s, layerId: l.id }, standby: true };
    }
    return null;
  }
  function pal() {
    const p = PALETTES[state.genre] || PALETTES.shrouding;
    return p;
  }
  function hexA(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return `rgba(200,170,110,${a})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
  }
  function dcol(d) {
    return ["#7fd98f", "#d9c97f", "#e8a34c", "#e07856", "#e05656"][Math.max(1, Math.min(5, d)) - 1];
  }
  function prand(i, salt) {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function blobPath(cx, cy, rx, ry, seed) {
    const K = 12;
    const pts = [];
    for (let i = 0; i < K; i++) {
      const a = i / K * Math.PI * 2;
      const w = 0.84 + prand(i * 3 + seed * 17, seed + 2) * 0.3;
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
    }
    let d = `M${((pts[0][0] + pts[1][0]) / 2).toFixed(1)},${((pts[0][1] + pts[1][1]) / 2).toFixed(1)}`;
    for (let i = 1; i <= K; i++) {
      const p = pts[i % K], q = pts[(i + 1) % K];
      d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`;
    }
    return d + " Z";
  }
  function terrainGlyph(tr, x, y, s, P) {
    switch (tr) {
      case "mountain":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".72">
                <path d="M-2.1,1.1 L-.8,-1.4 L-.1,-.2 L.7,-1.6 L2.1,1.1 Z" fill="${hexA(P.stone, 0.5)}" stroke="${hexA(P.stone, 0.8)}" stroke-width=".22"/>
                <path d="M-.8,-1.4 L-.45,-.75 L-.15,-1.05 L.05,-.75 L.3,-1 Z" fill="${hexA(P.text, 0.55)}"/></g>`;
      case "forest":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".72">
                <line x1="0" y1=".5" x2="0" y2="1.3" stroke="${hexA(P.tree, 0.8)}" stroke-width=".28"/>
                <path d="M0,-1.5 L.85,.1 L.4,.1 L1,1.1 L-1,1.1 L-.4,.1 L-.85,.1 Z" fill="${hexA(P.tree, 0.55)}" stroke="${hexA(P.tree, 0.85)}" stroke-width=".2"/></g>`;
      case "desert":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".66">
                <path d="M-1.8,.3 Q-.9,-.6 0,.3 T1.8,.3" fill="none" stroke="${hexA(P.sand, 0.85)}" stroke-width=".26" stroke-linecap="round"/>
                <path d="M-1.1,1.1 Q-.4,.4 .4,1.1 T1.4,1.1" fill="none" stroke="${hexA(P.sand, 0.6)}" stroke-width=".22" stroke-linecap="round"/></g>`;
      case "water":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".72">
                <path d="M-1.9,0 Q-1.4,-.55 -.95,0 T0,0 T.95,0 T1.9,0" fill="none" stroke="${hexA(P.water, 0.85)}" stroke-width=".26" stroke-linecap="round"/>
                <path d="M-1.4,.9 Q-.9,.4 -.4,.9 T.6,.9 T1.6,.9" fill="none" stroke="${hexA(P.water, 0.55)}" stroke-width=".2" stroke-linecap="round"/></g>`;
      case "city":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".72">
                <rect x="-1.6" y="-.2" width=".85" height="1.5" fill="${hexA(P.accent, 0.5)}" stroke="${hexA(P.accent, 0.85)}" stroke-width=".18"/>
                <rect x="-.5" y="-.9" width=".9" height="2.2" fill="${hexA(P.accent, 0.62)}" stroke="${hexA(P.accent, 0.9)}" stroke-width=".18"/>
                <rect x=".6" y="-.35" width=".95" height="1.65" fill="${hexA(P.accent, 0.5)}" stroke="${hexA(P.accent, 0.85)}" stroke-width=".18"/></g>`;
      case "void":
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".8">
                <path d="M0,-1.5 L.32,-.32 L1.5,0 L.32,.32 L0,1.5 L-.32,.32 L-1.5,0 L-.32,-.32 Z" fill="${hexA(P.accent, 0.6)}" stroke="${hexA(P.accent, 0.9)}" stroke-width=".16"/></g>`;
      default:
        return `<g transform="translate(${x},${y}) scale(${s})" opacity=".55">
                <path d="M-1.6,.9 Q-1.2,-.5 -.6,.3 Q-.1,-.9 .5,-.1 Q1.1,-.8 1.6,.4" fill="none" stroke="${hexA(P.tree, 0.6)}" stroke-width=".24" stroke-linecap="round"/></g>`;
    }
  }
  function regionSvg(r, idx, P) {
    const col = { mountain: P.stone, forest: P.tree, desert: P.sand, water: P.water, city: P.accent, void: P.accent, plain: P.tree }[r.tr] || P.stone;
    const blob = blobPath(r.cx, r.cy, r.rx, r.ry, idx + 1);
    const blobIn = blobPath(r.cx, r.cy, r.rx * 0.82, r.ry * 0.82, idx + 40);
    const area = r.rx * r.ry;
    const count = Math.max(3, Math.min(9, Math.round(area / 42)));
    let glyphs = "";
    for (let i = 0; i < count; i++) {
      const a = prand(i + idx * 31, 7) * Math.PI * 2;
      const rr = 0.28 + prand(i + idx * 31, 8) * 0.62;
      const gx = r.cx + Math.cos(a) * r.rx * rr;
      const gy = r.cy + Math.sin(a) * r.ry * rr;
      const gs = 0.9 + prand(i + idx * 31, 9) * 0.85;
      glyphs += terrainGlyph(r.tr, gx.toFixed(1), gy.toFixed(1), gs.toFixed(2), P);
    }
    const ly = Math.max(3.4, r.cy - r.ry - 3.1);
    const tw = r.n.length * 2.06 + 4.6;
    const label = `<g>
            <rect x="${(r.cx - tw / 2).toFixed(1)}" y="${ly.toFixed(1)}" width="${tw.toFixed(1)}" height="3.6" rx="1.7" fill="${hexA(P.deep, 0.72)}" stroke="${hexA(col, 0.5)}" stroke-width=".24"/>
            <path d="M${(r.cx - tw / 2 + 1.6).toFixed(1)},${(ly + 1.8).toFixed(1)} l1,-1 l1,1 l-1,1 Z" fill="${hexA(col, 0.9)}"/>
            <text x="${(r.cx + 0.9).toFixed(1)}" y="${(ly + 2.55).toFixed(1)}" font-size="1.95" fill="${hexA(P.text, 0.92)}" text-anchor="middle" letter-spacing=".6" class="atlas-label">${r.n}</text></g>`;
    return `<g class="atlas-region">
            <path d="${blob}" fill="${hexA(col, 0.09)}" stroke="${hexA(col, 0.42)}" stroke-width=".32" stroke-dasharray="2 1.3"/>
            <path d="${blobIn}" fill="none" stroke="${hexA(col, 0.16)}" stroke-width=".2" stroke-dasharray="1 1.6"/>
            ${glyphs}${label}</g>`;
  }
  function bgSvg(decor, P) {
    if (decor === "cosmos") {
      let stars = "";
      const N = 88;
      for (let i = 0; i < N; i++) {
        const sx = 2 + prand(i, 1) * 96, sy = 2 + prand(i, 2) * 96;
        const big = prand(i, 3) > 0.82;
        const r = big ? 0.5 + prand(i, 4) * 0.4 : 0.18 + prand(i, 4) * 0.3;
        const tw = prand(i, 5) > 0.7 ? ' class="atlas-twinkle"' : "";
        stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r.toFixed(2)}" fill="${hexA(big ? P.text : P.muted, 0.16 + prand(i, 6) * 0.5)}"${tw}/>`;
        if (big) stars += `<path d="M${sx.toFixed(1)},${(sy - r * 2.4).toFixed(1)} v${(r * 4.8).toFixed(1)} M${(sx - r * 2.4).toFixed(1)},${sy.toFixed(1)} h${(r * 4.8).toFixed(1)}" stroke="${hexA(P.text, 0.28)}" stroke-width=".12"/>`;
      }
      let constel = "";
      for (let c = 0; c < 2; c++) {
        let d = "", pts = [];
        for (let i = 0; i < 5; i++) {
          pts.push([8 + prand(i + c * 9, 11) * 80, 8 + prand(i + c * 9, 12) * 80]);
        }
        pts.forEach((p, i) => {
          d += (i ? " L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
        });
        constel += `<path d="${d}" fill="none" stroke="${hexA(P.accent, 0.2)}" stroke-width=".14" stroke-dasharray="1 .8"/>`;
        pts.forEach((p) => {
          constel += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r=".38" fill="${hexA(P.accent, 0.5)}"/>`;
        });
      }
      return `<g>
                <ellipse cx="70" cy="28" rx="26" ry="12" fill="${hexA(P.accent, 0.07)}" filter="url(#agBlur2)"/>
                <ellipse cx="24" cy="74" rx="20" ry="9" fill="${hexA(P.primary, 0.06)}" filter="url(#agBlur2)"/>
                ${stars}${constel}</g>`;
    }
    if (decor === "city") {
      let grid = "";
      for (let v = 5; v < 100; v += 5) {
        const major = v % 25 === 0;
        grid += `<line x1="${v}" y1="2" x2="${v}" y2="98" stroke="${hexA(P.accent, major ? 0.16 : 0.07)}" stroke-width="${major ? 0.2 : 0.12}"/>
                         <line x1="2" y1="${v}" x2="98" y2="${v}" stroke="${hexA(P.accent, major ? 0.16 : 0.07)}" stroke-width="${major ? 0.2 : 0.12}"/>`;
      }
      let circuits = "";
      const traces = [[6, 20, 26, 20, 26, 44], [60, 92, 60, 70, 84, 70], [14, 60, 14, 84, 34, 84], [44, 12, 44, 26, 58, 26]];
      traces.forEach((t) => {
        let d = `M${t[0]},${t[1]}`;
        for (let k = 2; k + 1 < t.length; k += 2) d += ` L${t[k]},${t[k + 1]}`;
        circuits += `<path d="${d}" fill="none" stroke="${hexA(P.accent, 0.3)}" stroke-width=".22"/>
                    <circle cx="${t[t.length - 2]}" cy="${t[t.length - 1]}" r=".5" fill="${hexA(P.accent, 0.7)}"/>`;
      });
      return `<g>${grid}${circuits}</g>`;
    }
    let m = "";
    const ridges = [{ y: 87, a: 5, o: 0.1 }, { y: 92.5, a: 6.5, o: 0.15 }, { y: 97, a: 5.5, o: 0.2 }];
    ridges.forEach((r, i) => {
      let d = `M-2,101 L-2,${r.y}`;
      for (let x = 0; x <= 100; x += 12.5) {
        const peak = r.y - r.a * (0.4 + prand(x / 12.5 + i * 7, 5));
        d += ` L${x + 6.25},${peak.toFixed(1)} L${x + 12.5},${(r.y - prand(x / 12.5, 6) * 2).toFixed(1)}`;
      }
      d += " L102,101 Z";
      m += `<path d="${d}" fill="${hexA(P.primary, r.o)}"/>`;
    });
    return `<g>${m}
            <ellipse cx="30" cy="16" rx="24" ry="5" fill="${hexA(P.text, 0.05)}" filter="url(#agBlur2)"/>
            <ellipse cx="74" cy="72" rx="20" ry="4.5" fill="${hexA(P.text, 0.04)}" filter="url(#agBlur2)"/></g>`;
  }
  function glyph(n, mode, P) {
    const isCur = mode === "cur", isStd = mode === "standby";
    const visited = mode === "vis" || isCur;
    const k = isCur || isStd ? 1.28 : 1;
    const main = visited ? P.primary : hexA(P.muted, 0.9);
    const fill = visited ? P.primary : "none";
    const fogAttr = mode === "fog" ? ' opacity=".55" filter="url(#agFog)"' : "";
    const body = (() => {
      switch (n.t) {
        case "start":
          return `<circle r="2.2" fill="${hexA(P.primary, visited ? 0.3 : 0.08)}" stroke="${main}" stroke-width=".45"/>
                    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="${(Math.cos(a * Math.PI / 180) * 2.6).toFixed(2)}" y1="${(Math.sin(a * Math.PI / 180) * 2.6).toFixed(2)}" x2="${(Math.cos(a * Math.PI / 180) * 3.3).toFixed(2)}" y2="${(Math.sin(a * Math.PI / 180) * 3.3).toFixed(2)}" stroke="${main}" stroke-width=".3"/>`).join("")}
                    <circle r="1.05" fill="${fill}" stroke="${main}" stroke-width=".4"/>
                    <circle r=".38" fill="${isCur ? "#fff" : P.deep}"/>`;
        case "city":
          return `<path d="M-2.1,1.6 V-.4 h.7 v-.7 h.5 v.7 h.6 V-1.5 l1,-.8 l1,.8 V1.6 Z" fill="${fill}" stroke="${main}" stroke-width=".38"/>
                    <rect x="-2.1" y="-.9" width=".5" height=".55" fill="${main}"/><rect x="-1.2" y="-.9" width=".5" height=".55" fill="${main}"/>
                    <rect x="-.1" y="-1.7" width=".5" height=".5" fill="${main}"/>`;
        case "sect":
          return `<path d="M-2.3,-.9 h4.6 M-2,-1.5 h4 M-1.9,-1 v3 M1.9,-1 v3 M-2.3,2.2 h4.6" stroke="${main}" stroke-width=".42" fill="none" stroke-linecap="round"/>
                    <path d="M-2.6,-1.9 Q0,-3 2.6,-1.9" stroke="${main}" stroke-width=".4" fill="none"/>`;
        case "wild":
          return `<path d="M-3,1.6 L-1.1,-1.9 L-.1,-.3 L1,-2.2 L3,1.6 Z" fill="${fill}" stroke="${main}" stroke-width=".38"/>
                    <path d="M-1.1,-1.9 L-.75,-1.2 L-.45,-1.6 L-.15,-1.1 L.1,-1.5" stroke="${hexA(P.text, visited ? 0.8 : 0.5)}" stroke-width=".22" fill="none"/>`;
        case "danger":
          return `<path d="M-3,1.6 L-1.5,-2 L-.1,-.5 L1.3,-2.3 L3,1.6 Z" fill="${fill}" stroke="${dcol(n.d)}" stroke-width=".42"/>
                    <circle cx="-1" cy=".3" r=".26" fill="${dcol(n.d)}"/><circle cx="1" cy=".5" r=".26" fill="${dcol(n.d)}"/>
                    <path d="M2.2,-2.6 l0,1.6 l-1,-.8 Z" fill="${dcol(n.d)}" stroke="${dcol(n.d)}" stroke-width=".3" stroke-linejoin="round"/>`;
        case "arena":
          return `<rect x="-2" y="-.6" width="4" height="2.2" rx=".3" fill="${fill}" stroke="${main}" stroke-width=".38"/>
                    <path d="M-.6,-.6 v-1 h1.2 v1" stroke="${main}" stroke-width=".34" fill="none"/>
                    <path d="M-1.3,-3 Q0,-4.6 1.3,-3 Q1.3,-1.6 0,-1.9 Q-1.3,-1.6 -1.3,-3 Z" fill="${fill}" stroke="${main}" stroke-width=".36"/>
                    <line x1="0" y1="-1.9" x2="0" y2="-.6" stroke="${main}" stroke-width=".3"/><line x1="-1.7" y1="1.6" x2="1.7" y2="1.6" stroke="${main}" stroke-width=".4"/>`;
        case "poi":
          return `<g>
                            <path d="M-2.5,1.8 h5" stroke="${main}" stroke-width=".3" stroke-linecap="round" opacity=".85"/>
                            <line x1="0" y1="-3.1" x2="0" y2="1.5" stroke="${main}" stroke-width=".3"/>
                            <path d="M0,-3.1 L2.5,-2.1 L.6,-1.3 L0,-.5 Z" fill="${main}" stroke="${hexA(P.deep, 0.4)}" stroke-width=".12"/>
                            <path d="M0,.1 l.32,.62 l.62,.32 l-.62,.32 l-.32,.62 l-.32,-.62 l-.62,-.32 l.62,-.32 Z" fill="${visited ? main : "none"}" stroke="${main}" stroke-width=".18"/></g>`;
        default:
          return `<path d="M-1.9,1.8 h3.8 M-1.5,1 v.8 h3 V1 M-1.2,-.1 v1.1 h2.4 V-.1 M-.9,-1.1 v1 h1.8 v-1" stroke="${main}" stroke-width=".34" fill="${visited ? hexA(P.primary, 0.25) : "none"}"/>
                    <path d="M-2.2,-1.2 Q0,-2.6 2.2,-1.2 M-1.4,-2.2 Q0,-3.3 1.4,-2.2" stroke="${main}" stroke-width=".36" fill="none"/>
                    <path d="M0,-3.9 l.3,.8 l.8,.12 l-.6,.56 l.16,.8 l-.66,-.42 l-.66,.42 l.16,-.8 l-.6,-.56 l.8,-.12 Z" fill="${isCur ? "#fff" : main}" stroke="${main}" stroke-width=".14"/>`;
      }
    })();
    const ring = `<circle r="3.3" fill="none" stroke="${dcol(n.d)}" stroke-width=".3" stroke-dasharray="${(n.d / 5 * 20.7).toFixed(1)} 20.7" stroke-linecap="round" transform="rotate(-90)" opacity="${visited ? 0.8 : 0.4}"/>`;
    const vi = state.visits.findIndex((v) => v.id === n.id);
    const badge = visited && !isCur && vi >= 0 ? `<g transform="translate(2.9,-2.9)">
            <circle r="1.5" fill="${hexA(P.deep, 0.92)}" stroke="${P.primary}" stroke-width=".26"/>
            <text y=".62" font-size="1.7" fill="${P.primary}" text-anchor="middle" font-weight="700">${vi + 1}</text></g>` : "";
    let mark = "";
    if (isCur) {
      mark = `<circle class="atlas-pulse" r="3.9" fill="none" stroke="${P.primary}" stroke-width=".5"/>
                    <circle class="atlas-pulse d2" r="3.9" fill="none" stroke="${hexA(P.primary, 0.7)}" stroke-width=".35"/>
                    <circle r="4.6" fill="${hexA(P.primary, 0.13)}"/>
                    <circle class="atlas-spin" r="5.2" fill="none" stroke="${hexA(P.primary, 0.55)}" stroke-width=".26" stroke-dasharray="1.2 1.8"/>`;
    } else if (isStd) {
      mark = `<circle r="4.2" fill="${hexA(P.accent, 0.1)}" stroke="${hexA(P.accent, 0.6)}" stroke-width=".3" stroke-dasharray="1.4 1.2"/>
                    <circle class="atlas-pulse d2" r="3.6" fill="none" stroke="${hexA(P.accent, 0.55)}" stroke-width=".3"/>`;
    }
    let banner = "";
    if (isCur || isStd) {
      const up = n.y > 16;
      const txt = isCur ? "你在这里" : "整装待发";
      const w = txt.length * 2.05 + 2.2;
      const fc = isCur ? P.primary : P.accent;
      const flip = n.x + w + 3 > 97;
      const ox = flip ? -w : 0;
      const fy = up ? -6.6 : 6.6;
      banner = `<g>
                <line x1="0" y1="${up ? -2.8 : 2.8}" x2="${(ox + 0.5).toFixed(1)}" y2="${fy + (up ? 1.6 : -1.6)}" stroke="${hexA(fc, 0.75)}" stroke-width=".24"/>
                <g transform="translate(${ox.toFixed(1)},${fy})">
                    <path d="M0,${up ? 1.5 : -1.5} h${w.toFixed(1)} v${up ? -3 : 3} h-${(w - 1.6).toFixed(1)} l-.8,${up ? -1 : 1} l-.8,${up ? 1 : -1} Z" fill="${fc}" stroke="${hexA(P.deep, 0.45)}" stroke-width=".14"/>
                    <text x="${(w / 2).toFixed(1)}" y="${up ? -0.6 : 2.2}" font-size="1.95" fill="${P.deep}" text-anchor="middle" font-weight="700" letter-spacing=".35" class="atlas-label">${txt}</text>
                </g></g>`;
    }
    const label = (() => {
      const fs = isCur || isStd ? 2.9 : 2.4;
      const right = n.x <= 72;
      const lx = right ? 4.4 : -4.4;
      const anchor = right ? "start" : "end";
      const lf = isCur ? P.primary : isStd ? P.accent : visited ? P.text : hexA(P.muted, 0.85);
      return `<text x="${lx}" y=".85" font-size="${fs}" fill="${lf}"${isCur || isStd ? ' font-weight="700"' : ""} text-anchor="${anchor}" class="atlas-label" opacity="${mode === "fog" ? 0.6 : 1}">${n.n}</text>`;
    })();
    return `<g class="atlas-node${mode === "fog" ? " atlas-fogged" : ""}" data-node="${n.id}" style="cursor:pointer;">
            <g transform="translate(${n.x},${n.y})">
                ${mark}
                <g transform="scale(${k})"${fogAttr}>${ring}${body}</g>
                ${badge}${banner}${label}
            </g></g>`;
  }
  function layerSvg(layer) {
    const P = pal();
    const visitedIds = state.visits.map((v) => v.id);
    const layerNodes = layer.nodes.concat((state.dyn || []).filter((d) => d.layerId === layer.id));
    const byId = {};
    layerNodes.forEach((n) => byId[n.id] = n);
    const cur = resolveCurrent();
    let roads = "";
    (layer.roads || []).forEach(([a, b]) => {
      const A = byId[a], B = byId[b];
      if (!A || !B) return;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const off = Math.min(8, len * 0.18) * ((A.x * B.y - B.x * A.y) % 2 === 0 ? 1 : -1);
      const cx2 = mx - dy / len * off, cy2 = my + dx / len * off;
      const both = visitedIds.includes(a) && visitedIds.includes(b);
      const seg = `M${A.x},${A.y} Q${cx2.toFixed(1)},${cy2.toFixed(1)} ${B.x},${B.y}`;
      roads += `<path d="${seg}" fill="none" stroke="${hexA(P.deep, 0.55)}" stroke-width="${both ? 1.15 : 0.85}" stroke-linecap="round"/>`;
      roads += `<path d="${seg}" fill="none" stroke="${hexA(P.primary, both ? 0.72 : 0.22)}" stroke-width="${both ? 0.5 : 0.3}" stroke-dasharray="${both ? "2.4 1.3" : ".8 1.5"}" stroke-linecap="round"${both ? ' class="atlas-dash" filter="url(#agGlow)"' : ""}/>`;
    });
    let tethers = "";
    (state.dyn || []).filter((d) => d.layerId === layer.id).forEach((d) => {
      const a = byId[d.anchorId];
      if (!a) return;
      tethers += `<path d="M${a.x},${a.y} L${d.x},${d.y}" fill="none" stroke="${hexA(P.accent, 0.42)}" stroke-width=".22" stroke-dasharray=".7 1.2"/>`;
    });
    let trail = "";
    const seq = state.visits.filter((v) => byId[v.id]).map((v) => byId[v.id]);
    if (seq.length >= 2) {
      let d = `M${seq[0].x},${seq[0].y}`;
      for (let i = 1; i < seq.length; i++) {
        const p = seq[i - 1], q = seq[i];
        d += ` Q${((p.x + q.x) / 2 + (q.y - p.y) * 0.08).toFixed(1)},${((p.y + q.y) / 2 - (q.x - p.x) * 0.08).toFixed(1)} ${q.x},${q.y}`;
      }
      trail = `<path d="${d}" fill="none" stroke="${hexA(P.primary, 0.9)}" stroke-width=".62" stroke-linecap="round" filter="url(#agGlow)" class="atlas-dash" stroke-dasharray="2.4 1.7"/>
                     <path d="${d}" fill="none" stroke="${hexA(P.primary, 0.25)}" stroke-width="1.5" stroke-linecap="round" filter="url(#agBlur)"/>`;
    }
    const regions = (layer.regions || []).map((r, i) => regionSvg(r, i, P)).join("");
    const nodes = layerNodes.map((n) => {
      let mode = "fog";
      if (cur && cur.node.id === n.id && cur.node.layerId === layer.id) mode = cur.standby ? "standby" : "cur";
      else if (visitedIds.includes(n.id)) mode = "vis";
      else if (n.dyn) mode = "vis";
      return glyph(n, mode, P);
    }).join("");
    const compass = `<g transform="translate(90.5,10.5)" opacity=".92">
            <circle r="5.2" fill="${hexA(P.deep, 0.55)}" stroke="${hexA(P.primary, 0.45)}" stroke-width=".3"/>
            <circle r="4" fill="none" stroke="${hexA(P.primary, 0.25)}" stroke-width=".18"/>
            ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="-4.6" x2="0" y2="-4" stroke="${hexA(P.primary, 0.5)}" stroke-width=".18" transform="rotate(${i * 30})"/>`).join("")}
            <path d="M0,-3.7 L.75,0 L0,3.7 L-.75,0 Z" fill="${P.primary}"/>
            <path d="M-3.7,0 L0,.75 L3.7,0 L0,-.75 Z" fill="${hexA(P.text, 0.55)}"/>
            <path d="M0,-3 L.5,-.5 L0,0 L-.5,-.5 Z" fill="#fff" opacity=".9"/>
            <circle r=".55" fill="${P.primary}" stroke="${hexA(P.deep, 0.8)}" stroke-width=".2"/>
            <text y="-5.7" font-size="1.8" fill="${hexA(P.text, 0.9)}" text-anchor="middle" class="atlas-label">北</text></g>`;
    const tw = layer.name.length * 2.6 + 9;
    const cart = `<g>
            <rect x="3.4" y="3.4" width="${tw.toFixed(1)}" height="6.4" rx="1.2" fill="${hexA(P.deep, 0.82)}" stroke="${hexA(P.primary, 0.5)}" stroke-width=".32"/>
            <rect x="4.4" y="4.3" width="${(tw - 2).toFixed(1)}" height="4.6" rx=".8" fill="none" stroke="${hexA(P.primary, 0.2)}" stroke-width=".18"/>
            <path d="M${(3.4 - 1e-3 + 1.5).toFixed(1)},6.6 l1.1,-1.1 l1.1,1.1 l-1.1,1.1 Z" fill="${P.primary}"/>
            <path d="M${(tw + 1.8).toFixed(1)},6.6 l1.1,-1.1 l1.1,1.1 l-1.1,1.1 Z" fill="${P.primary}"/>
            <text x="${(3.4 + tw / 2 + 0.9).toFixed(1)}" y="8.3" font-size="2.85" fill="${P.primary}" text-anchor="middle" letter-spacing="1.4" class="atlas-label">${layer.name}</text></g>`;
    const corners = [[3, 3, 1, 1], [97, 3, -1, 1], [3, 97, 1, -1], [97, 97, -1, -1]].map(([cx0, cy0, sx, sy]) => `<path d="M${cx0},${cy0 + 5.6 * sy} L${cx0},${cy0} L${cx0 + 5.6 * sx},${cy0}" fill="none" stroke="${hexA(P.primary, 0.6)}" stroke-width=".42"/>
             <path d="M${cx0 + 1.6 * sx},${cy0 + 1.6 * sy} l.9,-.9 l.9,.9 l-.9,.9 Z" fill="${hexA(P.primary, 0.8)}"/>`).join("");
    const scale = `<g opacity=".85">
            <line x1="78" y1="95.6" x2="94" y2="95.6" stroke="${hexA(P.primary, 0.6)}" stroke-width=".3"/>
            <line x1="78" y1="94.6" x2="78" y2="96.6" stroke="${hexA(P.primary, 0.6)}" stroke-width=".3"/>
            <line x1="86" y1="95" x2="86" y2="96.2" stroke="${hexA(P.primary, 0.6)}" stroke-width=".25"/>
            <line x1="94" y1="94.6" x2="94" y2="96.6" stroke="${hexA(P.primary, 0.6)}" stroke-width=".3"/>
            <text x="86" y="93.4" font-size="1.75" fill="${hexA(P.muted, 0.85)}" text-anchor="middle" class="atlas-label">千里</text></g>`;
    const seal = state.visits.length === 0 ? `<g transform="translate(50,46) rotate(-5)" opacity=".9">
            <circle r="8.6" fill="none" stroke="${hexA(P.primary, 0.4)}" stroke-width=".35" stroke-dasharray="1.6 1.2"/>
            <circle r="7.2" fill="none" stroke="${hexA(P.primary, 0.28)}" stroke-width=".22"/>
            <text y="-1.2" font-size="3.3" fill="${hexA(P.primary, 0.85)}" text-anchor="middle" letter-spacing="1.6" class="atlas-label">迷雾未开</text>
            <text y="2.6" font-size="1.9" fill="${hexA(P.muted, 0.85)}" text-anchor="middle" letter-spacing=".6" class="atlas-label">踏出第一步 · 足迹自会点亮</text></g>` : "";
    return `
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" class="atlas-svg">
            <defs>
                <radialGradient id="agBg" cx="34%" cy="22%">
                    <stop offset="0%" stop-color="${hexA(P.primary, 0.13)}"/>
                    <stop offset="55%" stop-color="${hexA(P.panel, 0.95)}"/>
                    <stop offset="100%" stop-color="${hexA(P.deep, 0.98)}"/>
                </radialGradient>
                <radialGradient id="agVig" cx="50%" cy="50%" r="72%">
                    <stop offset="0%" stop-color="${hexA(P.deep, 0)}"/>
                    <stop offset="74%" stop-color="${hexA(P.deep, 0)}"/>
                    <stop offset="100%" stop-color="${hexA(P.deep, 0.55)}"/>
                </radialGradient>
                <filter id="agPaper" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
                    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .9  0 0 0 .05 0"/>
                </filter>
                <filter id="agGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation=".55" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="agBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".7"/></filter>
                <filter id="agBlur2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
                <filter id="agFog" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".3"/></filter>
            </defs>
            <rect x=".6" y=".6" width="98.8" height="98.8" rx="2.4" fill="url(#agBg)"/>
            ${bgSvg(layer.decor, P)}
            <rect x=".6" y=".6" width="98.8" height="98.8" rx="2.4" fill="url(#agVig)" pointer-events="none"/>
            <rect x=".6" y=".6" width="98.8" height="98.8" rx="2.4" filter="url(#agPaper)" opacity=".5" pointer-events="none"/>
            ${regions}
            ${roads}
            ${tethers}
            ${trail}
            <g filter="url(#agGlow)">${nodes}</g>
            ${seal}
            ${cart}${compass}${corners}${scale}
            <text x="4.2" y="96.2" font-size="1.85" fill="${hexA(P.muted, 0.7)}" letter-spacing=".4" class="atlas-label">${layer.hint}</text>
            <rect x=".6" y=".6" width="98.8" height="98.8" rx="2.4" fill="none" stroke="${hexA(P.primary, 0.5)}" stroke-width=".45"/>
            <rect x="2.2" y="2.2" width="95.6" height="95.6" rx="1.6" fill="none" stroke="${hexA(P.primary, 0.18)}" stroke-width=".22"/>
        </svg>`;
  }
  function typeTxt(t) {
    if (isTraceMode()) {
      return { start: "起点", city: "城镇", sect: "势力/门派", wild: "荒野", danger: "险地", relic: "古迹/秘境", arena: "赛场", poi: "✦ 行迹地标" }[t] || "地点";
    }
    return { start: "起点", city: "城镇", sect: "宗门/势力", wild: "荒野", danger: "凶地", relic: "秘境/遗迹", arena: "赛场", poi: "✦ 剧情地标" }[t] || "地点";
  }
  function dangerStars(d, P) {
    let h = "";
    for (let i = 1; i <= 5; i++) {
      h += `<span style="color:${i <= d ? dcol(d) : "rgba(127,127,127,.22)"};">◆</span>`;
    }
    return h;
  }
  function detailHtml(node, layer, P) {
    const visitedIds = state.visits.map((v) => v.id);
    const isCur = node.id === state.currentId;
    const visited = visitedIds.includes(node.id);
    const rec = state.visits.find((v) => v.id === node.id);
    const vi = visitedIds.indexOf(node.id);
    const badge = isCur ? `<span class="ab ab-cur">◈ 当前位置</span>` : visited ? `<span class="ab ab-vis">已到访 · 第 ${vi + 1} 站</span>` : `<span class="ab ab-fog">未涉足 · 迷雾</span>`;
    const routes = (layer.roads || []).filter((r) => r.includes(node.id)).map((r) => {
      const other = r[0] === node.id ? r[1] : r[0];
      const n2 = layer.nodes.find((x) => x.id === other);
      return n2 ? n2.n : "";
    }).filter(Boolean);
    return `
        <div class="atlas-detail">
            <div class="ad-head">
                <div class="ad-title" style="color:${P.primary};">${node.n}</div>
                <div class="ad-badges">${badge}<span class="ab">${typeTxt(node.t)}</span><span class="ab">${node.rg}</span></div>
            </div>
            <div class="ad-row"><span>危险度</span><span class="ad-v">${dangerStars(node.d, P)}</span></div>
            <div class="ad-desc">${node.dyn ? isTraceMode() ? `此处不在预置舆图之上——第 ${node.round} 回合你的行踪落在「${node.raw}」，行旅图鉴随行迹落笔生成此地，坐落于「${node.anchorN}」一带。` : `此处不在原著舆图之上——第 ${node.round} 回合你的行踪落在「${node.raw}」，行旅图鉴随剧情落笔生成此地，坐落于「${node.anchorN}」一带。` : node.desc}</div>
            ${routes.length ? `<div class="ad-route">古道通连 · ${routes.join(" ↔ ")}</div>` : ""}
            ${node.dyn ? `<div class="ad-canon" style="border-left-color:${hexA(P.accent, 0.6)};">${isTraceMode() ? "✦ 行迹地标 · 由 AI 上报行踪实时生成，随经历累积；如系误报可移除" : "✦ 剧情地标 · 由 AI 上报行踪实时生成，随剧情累积；如系误报可移除"}</div>
                   <button class="ad-del" onclick="StoryAtlas.removeDyn('${node.id}')">✕ 移除此地标</button>` : `<div class="ad-canon" style="border-left-color:${hexA(P.primary, 0.55)};">${isTraceMode() ? "风土地理志" : "原著地理志"} · ${node.c}</div>`}
            ${visited ? `<div class="ad-visit">足迹 · 首次到访：第 ${rec && rec.round ? rec.round : "—"} 回合${isCur ? " · 现正身处此地" : ""}</div>` : ""}
        </div>`;
  }
  function render() {
    const genre = state.genre, g = ATLAS_DATA[genre], wrap = $("atlasPanel");
    if (!g || !wrap) return;
    const P = pal();
    if (!state.layerId || !g.layers.some((l) => l.id === state.layerId)) state.layerId = g.layers[0].id;
    const layer = g.layers.find((l) => l.id === state.layerId);
    const presetNodes = allNodes(genre).filter((n) => !n.dyn);
    const presetIds = new Set(presetNodes.map((n) => n.id));
    const totalN = presetNodes.length;
    const visitedN = state.visits.filter((v) => presetIds.has(v.id)).length;
    const dynN = (state.dyn || []).length;
    const pct = totalN ? Math.min(100, Math.round(visitedN / totalN * 100)) : 0;
    const cur = resolveCurrent();
    const pn = playerName();
    wrap.innerHTML = `
        <div class="atlas-inner">
            <div class="atlas-head">
                <div>
                    <div class="atlas-title" style="color:${P.primary};">${g.name}</div>
                    <div class="atlas-flavor">「${g.flavor}」${pn ? `<span class="atlas-pn">旅人 · ${pn}</span>` : ""}</div>
                </div>
                <div class="atlas-hbtns">
                    <button class="atlas-close" title="重置本界足迹" onclick="StoryAtlas.resetFootprint()">↺</button>
                    <button class="atlas-close" onclick="StoryAtlas.toggle(false)">✕</button>
                </div>
            </div>
            ${g.generic ? `<div class="atlas-generic" style="border-color:${hexA(P.accent, 0.38)};color:${P.muted};">${g.fallback ? "✦ 原创世界 · 行迹图鉴：此界暂无预置舆图——AI 每上报一处行踪即落一枚行迹地标，走到哪，记到哪" : "✦ 原创江湖 · 预设为江湖常见去处（类型地标）；身处具体小场所时将自动生成行迹地标，走到哪记到哪"}</div>` : ""}
            <div class="atlas-tabs">
                ${g.layers.map((l) => `<button class="atlas-tab ${l.id === state.layerId ? "on" : ""}" style="--p:${P.primary};" onclick="StoryAtlas.switchLayer('${l.id}')"><i>${l.ico || "◈"}</i>${l.name}</button>`).join("")}
            </div>
            <div class="atlas-progress">
                <div class="ap-txt"><span>足迹点亮 <b style="color:${P.primary};">${visitedN}</b> / ${totalN} 处${dynN ? ` · <span style="color:${P.accent};">${isTraceMode() ? "行迹" : "剧情"}地标 <b>${dynN}</b></span>` : ""}</span><span style="color:${P.primary};">${pct}%</span></div>
                <div class="ap-bar"><div class="ap-fill" style="width:${pct}%;background:linear-gradient(90deg,${hexA(P.primary, 0.45)},${P.primary});box-shadow:0 0 8px ${hexA(P.primary, 0.55)};"></div></div>
                <div class="ap-now">${cur ? cur.standby ? `整装待发 · 起点「${cur.node.n}」——开篇后 AI 上报行踪，足迹自动点亮` : `此刻 · ${cur.node.n}${cur.node.dyn ? '<span style="color:' + P.accent + ';">（' + (isTraceMode() ? "行迹" : "剧情") + "地标）</span>" : ""}` : "尚无位置记录"}</div>
            </div>
            <div class="atlas-map" style="border-color:${hexA(P.primary, 0.3)};">${layerSvg(layer)}</div>
            <div id="atlasDetail"></div>
            <div class="atlas-legend">
                <span><i class="lg lg-cur" style="background:${P.primary};box-shadow:0 0 5px ${P.primary};"></i>当前</span>
                <span><i class="lg" style="background:${hexA(P.primary, 0.9)};"></i>已到访</span>
                <span><i class="lg lg-fog"></i>迷雾</span>
                <span style="color:${P.accent};">✦ ${isTraceMode() ? "行迹" : "剧情"}地标</span>
                <span class="lg-road" style="border-color:${hexA(P.primary, 0.55)};"></span>
                <span class="lg-hint">点击地点看详情</span>
            </div>
        </div>`;
    wrap.querySelectorAll(".atlas-node").forEach((el) => {
      el.addEventListener("click", () => {
        const node = allNodes(genre).find((n) => n.id === el.getAttribute("data-node"));
        if (!node) return;
        const ln = g.layers.find((l) => l.id === node.layerId);
        const box = $("atlasDetail");
        if (box) box.innerHTML = detailHtml(node, ln || layer, P);
        box == null ? void 0 : box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
    if (cur && cur.node.layerId === state.layerId) {
      const box = $("atlasDetail");
      if (box) box.innerHTML = detailHtml(cur.node, g.layers.find((l) => l.id === state.layerId) || layer, P);
    }
    bindZoomGestures();
    resetZoom(false);
  }
  const zoom = { k: 1, tx: 0, ty: 0, maxK: 4 };
  function mapDom() {
    const p = $("atlasPanel");
    return p ? p.querySelector(".atlas-map") : null;
  }
  function applyZoom(animate) {
    const map = mapDom();
    if (!map) return;
    const svg = map.querySelector(".atlas-svg");
    if (!svg) return;
    svg.style.transition = animate === false ? "none" : "";
    svg.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.k})`;
    map.style.touchAction = zoom.k > 1.001 ? "none" : "pan-y";
    map.classList.toggle("canpan", zoom.k > 1.001);
    const zin = map.querySelector(".atlas-zbtn[data-zin]");
    const zout = map.querySelector(".atlas-zbtn[data-zout]");
    if (zin) zin.disabled = zoom.k >= zoom.maxK - 1e-3;
    if (zout) zout.disabled = zoom.k <= 1.001;
  }
  function clampPan() {
    const map = mapDom();
    if (!map) return;
    const r = map.getBoundingClientRect();
    const mx = Math.max(0, r.width * (zoom.k - 1) / 2);
    const my = Math.max(0, r.height * (zoom.k - 1) / 2);
    zoom.tx = Math.min(mx, Math.max(-mx, zoom.tx));
    zoom.ty = Math.min(my, Math.max(-my, zoom.ty));
  }
  function zoomBy(f, cx, cy, animate) {
    const map = mapDom();
    if (!map) return;
    const r = map.getBoundingClientRect();
    const px = cx != null ? cx - r.left - r.width / 2 : 0;
    const py = cy != null ? cy - r.top - r.height / 2 : 0;
    const nk = Math.min(zoom.maxK, Math.max(1, zoom.k * f));
    if (Math.abs(nk - zoom.k) < 1e-4) return;
    const ratio = nk / zoom.k;
    zoom.tx = px - (px - zoom.tx) * ratio;
    zoom.ty = py - (py - zoom.ty) * ratio;
    zoom.k = nk;
    if (zoom.k <= 1.001) {
      zoom.k = 1;
      zoom.tx = 0;
      zoom.ty = 0;
    }
    clampPan();
    applyZoom(animate);
  }
  function resetZoom(animate) {
    zoom.k = 1;
    zoom.tx = 0;
    zoom.ty = 0;
    applyZoom(animate);
  }
  function bindZoomGestures() {
    const map = mapDom();
    if (!map || map.dataset.zoomBound) return;
    map.dataset.zoomBound = "1";
    const ctl = document.createElement("div");
    ctl.className = "atlas-zoom";
    ctl.innerHTML = `
            <button type="button" class="atlas-zbtn" data-zin title="放大">＋</button>
            <button type="button" class="atlas-zbtn" data-zout title="缩小">－</button>
            <button type="button" class="atlas-zbtn" data-zreset title="复位视图" style="font-size:13px;">⤢</button>`;
    ctl.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest(".atlas-zbtn");
      if (!b) return;
      if (b.hasAttribute("data-zin")) zoomBy(1.5);
      else if (b.hasAttribute("data-zout")) zoomBy(1 / 1.5);
      else resetZoom();
    });
    map.appendChild(ctl);
    const pts = /* @__PURE__ */ new Map();
    let lastDist = 0, moved = false;
    map.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest(".atlas-zoom")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pts.size === 2) {
        const v = [...pts.values()];
        lastDist = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
        map.classList.add("dragging");
      } else if (zoom.k > 1.001) {
        map.classList.add("dragging");
      }
    });
    map.addEventListener("pointermove", (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (pts.size === 2) {
        const v = [...pts.values()];
        const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
        if (lastDist > 0 && d > 0 && Math.abs(d - lastDist) > 0.5) {
          zoomBy(d / lastDist, (v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2, false);
        }
        lastDist = d;
      } else if (zoom.k > 1.001) {
        zoom.tx += dx;
        zoom.ty += dy;
        clampPan();
        applyZoom(false);
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) lastDist = 0;
      if (pts.size === 0) {
        map.classList.remove("dragging");
        if (moved) {
          const swallow = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          map.addEventListener("click", swallow, true);
          setTimeout(() => map.removeEventListener("click", swallow, true), 80);
        }
      }
    };
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);
  }
  function ensureDom() {
    if ($("atlasPanel")) return;
    const overlay = document.createElement("div");
    overlay.id = "atlasOverlay";
    overlay.addEventListener("click", () => toggle(false));
    document.body.appendChild(overlay);
    const panel = document.createElement("aside");
    panel.id = "atlasPanel";
    panel.setAttribute("role", "dialog");
    document.body.appendChild(panel);
  }
  function toggle(force) {
    const willOpen = typeof force === "boolean" ? force : !state.open;
    ensureDom();
    const ov = $("atlasOverlay"), pn = $("atlasPanel");
    if (!ov || !pn) return;
    if (willOpen) {
      const genre = currentGenreKey();
      if (genre) {
        if (!ATLAS_DATA[genre]) ensureGenreData(genre);
        const changed = state.genre !== genre;
        state.genre = genre;
        if (changed) {
          state.currentId = null;
          state.visits = [];
          state.layerId = null;
          state.dyn = [];
          load(genre);
        }
      }
      state.open = willOpen;
      try {
        const vars = window.storyFramework && window.storyFramework.storyState && window.storyFramework.storyState.variables;
        if (vars) onVars(vars);
      } catch (e) {
      }
      render();
      ov.classList.add("on");
      pn.classList.add("on");
    } else {
      state.open = willOpen;
      ov.classList.remove("on");
      pn.classList.remove("on");
    }
  }
  function switchLayer(id) {
    state.layerId = id;
    save();
    render();
  }
  async function resetFootprint() {
    var _a;
    const msg = "重置本界行旅足迹？（清空到访记录、当前位置与剧情地标）";
    if ((_a = window.UIDialog) == null ? void 0 : _a.confirm) {
      const ok = await window.UIDialog.confirm({ title: "重置行旅足迹", message: msg, danger: true, confirmText: "重置" });
      if (!ok) return;
    } else if (!confirm(msg)) return;
    state.visits = [];
    state.currentId = null;
    state.layerId = null;
    state.dyn = [];
    save();
    render();
  }
  function injectStyle() {
    if ($("atlasStyle")) return;
    const st = document.createElement("style");
    st.id = "atlasStyle";
    st.textContent = `
        #atlasOverlay{position:fixed;inset:0;background:rgba(4,4,10,.62);backdrop-filter:blur(4px);z-index:88;opacity:0;visibility:hidden;transition:.3s;}
        #atlasOverlay.on{opacity:1;visibility:visible;}
        #atlasPanel{position:fixed;top:0;right:0;height:100%;width:min(620px,100vw);z-index:89;
            background:linear-gradient(168deg,var(--panel,#141a2a),color-mix(in srgb,var(--panel,#141a2a) 82%,#000));
            border-left:1px solid color-mix(in srgb,var(--primary,#c9a86a) 30%,transparent);
            transform:translateX(103%);transition:transform .38s cubic-bezier(.2,.9,.28,1);
            display:flex;overflow:hidden;box-shadow:-26px 0 70px rgba(0,0,0,.55);}
        #atlasPanel.on{transform:translateX(0);}
        .atlas-inner{flex:1;display:flex;flex-direction:column;min-height:0;padding:16px 16px 12px;overflow-y:auto;scrollbar-width:thin;}
        .atlas-head{display:flex;justify-content:space-between;align-items:flex-start;}
        .atlas-title{font-size:19px;font-weight:700;letter-spacing:4px;font-family:'Noto Serif SC',serif;}
        .atlas-flavor{font-size:11px;color:var(--text-muted,#a8a290);opacity:.9;margin-top:4px;letter-spacing:1.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        /* v3.31.4 原创界提示横幅：武侠类型地标图 / 行迹图兜底说明 */
        .atlas-generic{margin-top:9px;font-size:10.5px;line-height:1.7;letter-spacing:.4px;padding:6px 11px;
            border:1px dashed color-mix(in srgb,var(--accent,#8aa8b8) 38%,transparent);border-radius:10px;background:rgba(0,0,0,.14);}
        .atlas-pn{font-size:10px;padding:2px 8px;border-radius:99px;border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 40%,transparent);color:var(--primary,#c9a86a);letter-spacing:1px;}
        .atlas-hbtns{display:flex;gap:6px;}
        .atlas-close{background:none;border:1px solid var(--panel-border,rgba(200,170,110,.25));color:var(--text-muted,#a8a290);width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:13px;transition:.2s;}
        .atlas-close:hover{color:var(--primary,#c9a86a);border-color:var(--primary,#c9a86a);}
        .atlas-tabs{display:flex;gap:7px;margin:13px 0 9px;flex-wrap:wrap;}
        .atlas-tab{background:rgba(127,127,127,.07);border:1px solid var(--panel-border,rgba(200,170,110,.2));color:var(--text-muted,#a8a290);
            font-size:11.5px;padding:5px 13px;border-radius:999px;cursor:pointer;letter-spacing:1px;transition:.2s;font-family:inherit;display:flex;align-items:center;gap:6px;}
        .atlas-tab i{font-style:normal;font-family:'Noto Serif SC',serif;font-size:11px;width:18px;height:18px;border-radius:5px;
            display:inline-flex;align-items:center;justify-content:center;background:rgba(127,127,127,.12);}
        .atlas-tab.on{color:#131109;background:var(--p,var(--primary,#c9a86a));border-color:var(--p,var(--primary,#c9a86a));font-weight:700;
            box-shadow:0 0 14px color-mix(in srgb,var(--p,var(--primary,#c9a86a)) 45%,transparent);}
        .atlas-tab.on i{background:rgba(0,0,0,.18);}
        .atlas-progress{margin-bottom:9px;}
        .ap-txt{display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted,#a8a290);margin-bottom:4px;letter-spacing:.5px;}
        .ap-bar{height:5px;border-radius:99px;background:rgba(127,127,127,.16);overflow:hidden;position:relative;}
        .ap-fill{height:100%;border-radius:99px;transition:width .7s;position:relative;overflow:hidden;}
        .ap-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);animation:apShine 3.2s linear infinite;}
        @keyframes apShine{from{transform:translateX(-100%);}to{transform:translateX(100%);}}
        .ap-now{font-size:11.5px;color:var(--primary,#c9a86a);margin-top:5px;letter-spacing:.5px;}
        .atlas-map{flex:1;min-height:320px;display:flex;align-items:center;justify-content:center;border:1px solid var(--panel-border,rgba(200,170,110,.25));
            border-radius:16px;padding:7px;overflow:hidden;position:relative;
            background:radial-gradient(130% 100% at 30% 16%,color-mix(in srgb,var(--primary,#c9a86a) 6%,transparent),transparent 62%),rgba(0,0,0,.24);
            box-shadow:inset 0 0 34px rgba(0,0,0,.4);
            touch-action:pan-y;   /* v3.27.4：纵向滚动让给面板，横向拖拽/双指捏合留给缩放 */}
        .atlas-svg{width:100%;height:100%;max-height:56vh;min-height:320px;transition:transform .22s ease;will-change:transform;}
        /* ---- v3.27.4 地图缩放（手机端 1.85 单位标签≈7px，无缩放不可读）---- */
        .atlas-map.canpan .atlas-svg{cursor:grab;}
        .atlas-map.dragging .atlas-svg{transition:none;cursor:grabbing;}
        .atlas-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;z-index:5;}
        .atlas-zbtn{width:36px;height:36px;border-radius:11px;border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 42%,transparent);
            background:rgba(10,12,20,.87);color:var(--primary,#c9a86a);font-size:17px;line-height:1;cursor:pointer;font-family:inherit;
            display:flex;align-items:center;justify-content:center;transition:.15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
        .atlas-zbtn:hover{background:color-mix(in srgb,var(--primary,#c9a86a) 20%,transparent);}
        .atlas-zbtn:active{transform:scale(.9);}
        .atlas-zbtn:disabled{opacity:.3;cursor:default;}
        .atlas-label{font-family:'Noto Serif SC',serif;paint-order:stroke;stroke:rgba(4,4,9,.78);stroke-width:.66;}
        .atlas-pulse{animation:atlasPulse 2.6s ease-out infinite;transform-box:fill-box;transform-origin:center;}
        .atlas-pulse.d2{animation-delay:1.3s;}
        @keyframes atlasPulse{0%{opacity:.95;transform:scale(.5);}72%{opacity:.07;transform:scale(1.45);}100%{opacity:0;transform:scale(1.45);}}
        .atlas-spin{animation:atlasSpin 16s linear infinite;transform-box:fill-box;transform-origin:center;}
        @keyframes atlasSpin{to{transform:rotate(360deg);}}
        .atlas-dash{animation:atlasDash 24s linear infinite;}
        @keyframes atlasDash{to{stroke-dashoffset:-96;}}
        .atlas-twinkle{animation:atlasTw 3.8s ease-in-out infinite;}
        @keyframes atlasTw{50%{opacity:.12;}}
        .atlas-node{transition:filter .2s;}
        .atlas-node:hover{filter:drop-shadow(0 0 2.6px var(--primary,#c9a86a)) brightness(1.25);}
        .atlas-fogged:hover{filter:drop-shadow(0 0 2.2px var(--primary,#c9a86a)) brightness(1.15);}
        .atlas-detail{margin-top:11px;border:1px solid color-mix(in srgb,var(--primary,#c9a86a) 34%,transparent);border-radius:14px;padding:13px 15px;
            background:linear-gradient(150deg,color-mix(in srgb,var(--primary,#c9a86a) 9%,transparent),rgba(0,0,0,.16));}
        .ad-title{font-size:17px;font-weight:700;letter-spacing:3px;margin-bottom:7px;font-family:'Noto Serif SC',serif;}
        .ad-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px;}
        .ab{font-size:10.5px;padding:2.5px 10px;border-radius:99px;border:1px solid var(--panel-border,rgba(200,170,110,.2));color:var(--text-muted,#a8a290);letter-spacing:1px;}
        .ab-cur{background:var(--primary,#c9a86a);color:#15130c;font-weight:700;border-color:var(--primary,#c9a86a);}
        .ab-vis{color:var(--primary,#c9a86a);border-color:var(--primary,#c9a86a);}
        .ab-fog{opacity:.75;}
        .ad-del{margin-top:9px;font-size:10.5px;padding:3px 12px;border-radius:99px;border:1px solid rgba(224,119,119,.45);background:rgba(224,86,86,.08);color:#e08a8a;cursor:pointer;letter-spacing:1px;font-family:inherit;transition:.2s;}
        .ad-del:hover{background:rgba(224,86,86,.2);border-color:rgba(224,119,119,.75);}
        .ad-row{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-muted,#a8a290);margin-bottom:7px;letter-spacing:2px;}
        .ad-v{letter-spacing:2px;font-size:11px;}
        .ad-desc{font-size:12.5px;line-height:1.85;color:var(--text,#e8e4d8);text-align:justify;}
        .ad-route{margin-top:8px;font-size:11px;color:var(--primary,#c9a86a);letter-spacing:.5px;}
        .ad-canon{margin-top:9px;padding:7px 11px;border-left:2px solid var(--primary,#c9a86a);font-size:11px;color:var(--text-muted,#a8a290);line-height:1.7;background:rgba(0,0,0,.16);border-radius:0 8px 8px 0;}
        .ad-visit{margin-top:9px;font-size:11px;color:var(--primary,#c9a86a);letter-spacing:.5px;}
        .atlas-legend{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:11px;font-size:10.5px;color:var(--text-muted,#a8a290);}
        .atlas-legend span{display:flex;align-items:center;gap:4px;}
        .lg{width:8px;height:8px;border-radius:50%;display:inline-block;}
        .lg-cur{animation:atlasBlink 2s ease-in-out infinite;}
        @keyframes atlasBlink{50%{opacity:.4;}}
        .lg-fog{background:transparent;border:1px dashed var(--text-muted,#a8a290);}
        .lg-road{width:16px;height:0;border-top:1.5px dashed color-mix(in srgb,var(--primary,#c9a86a) 55%,transparent);}
        .lg-hint{opacity:.7;}
        @media (max-width:560px){#atlasPanel{width:100vw;}.atlas-svg{max-height:47vh;min-height:280px;}.atlas-map{min-height:280px;}}
        `;
    document.head.appendChild(st);
  }
  function init() {
    injectStyle();
    const genre = new URLSearchParams(location.search).get("genre");
    if (genre) {
      if (!ATLAS_DATA[genre]) ensureGenreData(genre);
      state.genre = genre;
      load(genre);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.open) toggle(false);
    });
  }
  const StoryAtlas = {
    toggle,
    switchLayer,
    onVars,
    init,
    resetFootprint,
    removeDyn,
    data: ATLAS_DATA,
    reset: function() {
      state.visits = [];
      state.currentId = null;
      state.layerId = null;
      state.dyn = [];
      save();
      if (state.open) render();
    }
  };
  window.StoryAtlas = StoryAtlas;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
