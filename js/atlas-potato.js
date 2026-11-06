/* 云境 v3.98.0 · 天蚕土豆宇宙四界舆图（大主宰/武动乾坤/元尊/万相之王）
 * 形状同 atlas-panel.js 的 ATLAS_DATA：{ name, flavor, layers:[{id,name,ico,hint,decor,regions,roads,nodes}] }
 * 由 atlas-panel.js init() 在 ATLAS_ERAS 合并之后、injectSupplement() 之前并入 ATLAS_DATA。
 * 地名一律按原著；坐标 0-100，节点 id 全局唯一（前缀 d_/w_/y_/wx_ 防冲突）。 */
window.ATLAS_POTATO = {
  dazhuzai: {
    name: "大主宰 · 行旅图鉴",
    flavor: "大千世界，谁主沉浮",
    layers: [
      {
        id: "d_beiling", name: "北灵境", ico: "境", hint: "百灵天北灵境——牧尘走出牧府的起点", decor: "land",
        regions: [{ n: "北灵境", cx: 50, cy: 50, rx: 42, ry: 42, tr: "plain" }],
        roads: [["d_mufu", "d_beilingcheng"], ["d_beilingcheng", "d_linglu"]],
        nodes: [
          { id: "d_mufu", n: "牧府", x: 14, y: 72, t: "start", d: 1, rg: "北灵境", desc: "北灵境牧府，牧尘少主出身地。少年自废柴之姿起步，灵力与灵阵双修，从这里走向大千。", c: "《大主宰》开篇；牧尘身世见知识库。" },
          { id: "d_beilingcheng", n: "北灵境城", x: 40, y: 60, t: "city", d: 2, rg: "北灵境", desc: "北灵境中心城池，各方少年汇聚，牧府声名由此传开。", c: "原著北灵境篇。" },
          { id: "d_linglu", n: "灵路入口", x: 70, y: 38, t: "relic", d: 4, rg: "北灵境", desc: "灵路——天骄试炼之地，各族天骄在此角逐，是牧尘崭露头角的舞台。", c: "原著灵路篇；灵路设定见知识库。" }
        ]
      },
      {
        id: "d_beicang", name: "北苍大陆", ico: "院", hint: "北苍灵院——牧尘入学修行之地", decor: "land",
        regions: [{ n: "北苍大陆", cx: 50, cy: 50, rx: 44, ry: 40, tr: "plain" }],
        roads: [["d_beicanglingyuan", "d_wudao"], ["d_wudao", "d_shengling"]],
        nodes: [
          { id: "d_beicanglingyuan", n: "北苍灵院", x: 20, y: 64, t: "start", d: 2, rg: "北苍大陆", desc: "北苍大陆顶级学府，牧尘入学的起点，灵院大比与院史自此展开。", c: "原著北苍灵院篇。" },
          { id: "d_wudao", n: "武道院", x: 50, y: 50, t: "sect", d: 3, rg: "北苍大陆", desc: "北苍灵院武道一脉，藏功法无数，牧尘淬体锻魂之地。", c: "原著北苍灵院内设。" },
          { id: "d_shengling", n: "圣灵院", x: 80, y: 36, t: "sect", d: 4, rg: "北苍大陆", desc: "与北苍灵院齐名的圣院，天骄云集，与牧尘一脉渊源颇深。", c: "原著圣灵院设定。" }
        ]
      },
      {
        id: "d_daluo", name: "大罗天域", ico: "域", hint: "大罗天域——牧府立基之处", decor: "land",
        regions: [{ n: "大罗天域", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["d_daluotian", "d_mantuo"], ["d_mantuo", "d_mufudaluo"]],
        nodes: [
          { id: "d_daluotian", n: "大罗天域", x: 24, y: 60, t: "start", d: 2, rg: "大罗天域", desc: "大千世界一方天域，群雄并起；牧尘在此立牧府，聚拢班底。", c: "原著大罗天域篇。" },
          { id: "d_mantuo", n: "曼荼罗城", x: 52, y: 48, t: "city", d: 3, rg: "大罗天域", desc: "大罗天域核心城池，曼荼罗（天域之主）坐镇，繁华与凶险并存。", c: "原著曼荼罗设定。" },
          { id: "d_mufudaluo", n: "牧府（大罗）", x: 78, y: 36, t: "sect", d: 4, rg: "大罗天域", desc: "牧尘建立的牧府总坛，大千世界新一代强者的汇聚之地。", c: "原著牧府设定。" }
        ]
      },
      {
        id: "d_tianluo", name: "天罗大陆 · 大千世界", ico: "界", hint: "天罗大陆——大千世界的权力中心", decor: "land",
        regions: [{ n: "天罗大陆", cx: 46, cy: 52, rx: 40, ry: 38, tr: "plain" }, { n: "域外", cx: 86, cy: 22, rx: 16, ry: 16, tr: "desert" }],
        roads: [["d_mufuzb", "d_xitian"], ["d_xitian", "d_futu"], ["d_futu", "d_yuwai"]],
        nodes: [
          { id: "d_mufuzb", n: "牧府总部", x: 16, y: 70, t: "start", d: 2, rg: "天罗大陆", desc: "牧府坐镇天罗大陆，号令一方，是大千世界顶尖势力之一。", c: "原著牧府总部。" },
          { id: "d_xitian", n: "西天战殿", x: 44, y: 58, t: "sect", d: 4, rg: "天罗大陆", desc: "西天之主麾下战殿，兵锋所指威震大千，与牧府既有争锋亦有联手。", c: "原著西天战殿设定。" },
          { id: "d_futu", n: "浮屠古族", x: 66, y: 44, t: "sect", d: 5, rg: "天罗大陆", desc: "五大古族之一，洛璃所属，血脉与灵阵之道源远流长。", c: "原著浮屠古族设定。" },
          { id: "d_yuwai", n: "域外邪族", x: 88, y: 24, t: "danger", d: 5, rg: "域外", desc: "域外邪族盘踞之地，天邪神为尊，大千盟约最终决战之所。", c: "原著域外邪族/天邪神设定。" }
        ]
      }
    ]
  },
  wudongqiankun: {
    name: "武动乾坤 · 行旅图鉴",
    flavor: "以武立身，祖符镇世",
    layers: [
      {
        id: "w_dayan", name: "大炎王朝", ico: "朝", hint: "大炎王朝——林动自青阳镇起步", decor: "land",
        regions: [{ n: "大炎王朝", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["w_linjia", "w_qingyang"], ["w_qingyang", "w_yancheng"]],
        nodes: [
          { id: "w_linjia", n: "林氏宗族", x: 18, y: 70, t: "start", d: 1, rg: "大炎王朝", desc: "青阳镇林家，林动出身宗族；石符（祖石）自这里开启他的武道之路。", c: "《武动乾坤》开篇；林动身世见知识库。" },
          { id: "w_qingyang", n: "青阳镇", x: 44, y: 56, t: "city", d: 2, rg: "大炎王朝", desc: "林家所在的边镇，林动早年历练与初遇小貂之地。", c: "原著青阳镇篇。" },
          { id: "w_yancheng", n: "炎城", x: 74, y: 40, t: "city", d: 3, rg: "大炎王朝", desc: "大炎王朝重镇，符师公会所在，林动早期淘金与争锋之地。", c: "原著炎城设定。" }
        ]
      },
      {
        id: "w_dao", name: "道宗", ico: "宗", hint: "道宗——林动入荒殿修行", decor: "land",
        regions: [{ n: "道宗", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["w_daozong", "w_yuanmen"], ["w_yuanmen", "w_yaoyu"]],
        nodes: [
          { id: "w_daozong", n: "道宗·荒殿", x: 22, y: 62, t: "start", d: 2, rg: "道宗", desc: "道宗四大殿之一，林动拜入荒殿，习大荒囚天指，锋芒渐露。", c: "原著道宗篇；荒殿设定。" },
          { id: "w_yuanmen", n: "元门", x: 52, y: 50, t: "sect", d: 4, rg: "道宗", desc: "道宗死敌，三掌教坐镇，与林动及道宗结下血仇。", c: "原著元门三掌教设定。" },
          { id: "w_yaoyu", n: "妖域入口", x: 82, y: 36, t: "wild", d: 4, rg: "道宗", desc: "道宗通往妖域的门户，四霸族气息自此弥漫。", c: "原著妖域设定。" }
        ]
      },
      {
        id: "w_yaoyu", name: "妖域", ico: "族", hint: "妖域——四霸族与异魔域", decor: "wild",
        regions: [{ n: "妖域", cx: 48, cy: 52, rx: 44, ry: 40, tr: "forest" }, { n: "异魔域", cx: 86, cy: 24, rx: 16, ry: 16, tr: "desert" }],
        roads: [["w_sibazu", "w_yimo"]],
        nodes: [
          { id: "w_sibazu", n: "妖域四霸族", x: 30, y: 66, t: "start", d: 3, rg: "妖域", desc: "妖域四大霸族（如龙族、九命天猫族等）鼎立，小炎出身火炎族，林动于此结义。", c: "原著妖域四霸族设定。" },
          { id: "w_yimo", n: "异魔域", x: 84, y: 26, t: "danger", d: 5, rg: "异魔域", desc: "异魔皇盘踞之地，吞噬祖符、祸乱大千；林动晋祖境、终结异魔之祸的终局战场。", c: "原著异魔皇/异魔域设定。" }
        ]
      }
    ]
  },
  yuanzun: {
    name: "元尊 · 行旅图鉴",
    flavor: "源气为基，神府搬山",
    layers: [
      {
        id: "y_dazhou", name: "大周王朝", ico: "朝", hint: "大周王朝——周元废太子之身", decor: "land",
        regions: [{ n: "大周王朝", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["y_dazhouwanggong", "y_cangxuan"]],
        nodes: [
          { id: "y_dazhouwanggong", n: "大周王宫", x: 30, y: 64, t: "start", d: 1, rg: "大周王朝", desc: "大周王朝王宫，周元原为王太子，圣龙气运被夺后流落民间，誓要夺回一切。", c: "《元尊》开篇；周元身世见知识库。" },
          { id: "y_cangxuan", n: "苍玄宗", x: 66, y: 42, t: "sect", d: 4, rg: "大周王朝", desc: "大周境内第一宗门，周元拜入，开启四大主峰修行之路。", c: "原著苍玄宗设定。" }
        ]
      },
      {
        id: "y_cangxuan", name: "苍玄宗", ico: "宗", hint: "苍玄宗——四大主峰与圣源峰", decor: "land",
        regions: [{ n: "苍玄宗", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["y_sifeng", "y_shengyuan"], ["y_sifeng", "y_shengji"]],
        nodes: [
          { id: "y_sifeng", n: "四大主峰", x: 24, y: 62, t: "start", d: 2, rg: "苍玄宗", desc: "剑来峰/灵纹峰/水潭峰/风雷峰四大主峰，周元修行与各大比之所。", c: "原著苍玄宗四峰设定。" },
          { id: "y_shengyuan", n: "圣源峰", x: 54, y: 48, t: "sect", d: 4, rg: "苍玄宗", desc: "苍玄宗旧主圣源峰，夭夭出身之地，藏着苍玄老祖的传承。", c: "原著圣源峰/夭夭设定。" },
          { id: "y_shengji", n: "圣迹之地", x: 82, y: 32, t: "relic", d: 4, rg: "苍玄宗", desc: "圣迹之争所在，各脉天骄争夺机缘，周元由此崭露头角。", c: "原著圣迹之地设定。" }
        ]
      },
      {
        id: "y_guihu", name: "归墟山 · 圣族", ico: "圣", hint: "归墟山——圣族（圣神）之战", decor: "land",
        regions: [{ n: "归墟山", cx: 52, cy: 54, rx: 42, ry: 40, tr: "plain" }, { n: "圣族", cx: 84, cy: 24, rx: 16, ry: 16, tr: "desert" }],
        roads: [["y_guihu", "y_shengzu"]],
        nodes: [
          { id: "y_guihu", n: "归墟山", x: 32, y: 64, t: "start", d: 3, rg: "归墟山", desc: "周元后期修行与崛起之地，源法领域在此圆满。", c: "原著归墟山设定。" },
          { id: "y_shengzu", n: "圣族（圣神）", x: 84, y: 26, t: "danger", d: 5, rg: "圣族", desc: "圣族盘踞，圣神黑卵为祸天源界；周元率众破之，成周元始祖。其祸源正是后世大千世界天邪神一脉的远祖。", c: "原著圣族/圣神设定；同宇宙联动见知识库。" }
        ]
      }
    ]
  },
  wanxiangzhiwang: {
    name: "万相之王 · 行旅图鉴",
    flavor: "一相开天，万相镇世",
    layers: [
      {
        id: "wx_daxia", name: "大夏国", ico: "国", hint: "大夏国——洛岚府遗孤李洛", decor: "land",
        regions: [{ n: "大夏国", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["wx_luolai", "wx_shengxuan"], ["wx_shengxuan", "wx_daxiawangdu"]],
        nodes: [
          { id: "wx_luolai", n: "洛岚府", x: 18, y: 70, t: "start", d: 1, rg: "大夏国", desc: "大夏国洛岚府，李洛遗孤出身，父李太玄、母澹台岚皆是一代强者；府邸兴衰是主线之一。", c: "《万相之王》开篇；李洛身世见知识库。" },
          { id: "wx_shengxuan", n: "圣玄星学府", x: 46, y: 56, t: "sect", d: 3, rg: "大夏国", desc: "大夏顶级学府，李洛与姜青娥求学之地，各院大比、圣杯战在此上演。", c: "原著圣玄星学府设定。" },
          { id: "wx_daxiawangdu", n: "大夏王都", x: 76, y: 38, t: "city", d: 3, rg: "大夏国", desc: "大夏国权力中心，王室与各方势力盘踞，暗流涌动。", c: "原著大夏王都设定。" }
        ]
      },
      {
        id: "wx_tianyuan", name: "天元神州", ico: "神州", hint: "天元神州——天元古学府与天王脉", decor: "land",
        regions: [{ n: "天元神州", cx: 50, cy: 50, rx: 44, ry: 42, tr: "plain" }],
        roads: [["wx_tianyuangu", "wx_jinlong"], ["wx_jinlong", "wx_longya"]],
        nodes: [
          { id: "wx_tianyuangu", n: "天元古学府", x: 22, y: 62, t: "start", d: 3, rg: "天元神州", desc: "天元神州顶尖学府，李洛后期深造、结识各方天骄之地。", c: "原著天元古学府设定。" },
          { id: "wx_jinlong", n: "金龙宝行", x: 52, y: 48, t: "city", d: 4, rg: "天元神州", desc: "天元神州第一商行，财雄势大，与各大势力盘根错节。", c: "原著金龙宝行设定。" },
          { id: "wx_longya", n: "李天王一脉·龙牙脉", x: 80, y: 36, t: "sect", d: 4, rg: "天元神州", desc: "李天王一脉下辖龙牙脉，李太玄出身之所；李洛认祖归宗、揭开双相之秘的关键。", c: "原著李天王一脉/龙牙脉设定。" }
        ]
      },
      {
        id: "wx_guiyi", name: "归一会", ico: "暗", hint: "归一会——笼罩神州的暗影", decor: "land",
        regions: [{ n: "归一会", cx: 50, cy: 50, rx: 40, ry: 40, tr: "desert" }],
        roads: [["wx_guiyizong", "wx_shenmi"]],
        nodes: [
          { id: "wx_guiyizong", n: "归一会总坛", x: 40, y: 58, t: "start", d: 4, rg: "归一会", desc: "归一会盘踞天元神州的隐秘组织，图谋吞噬神州气运，是李洛一路对抗的暗影。", c: "原著归一会设定。" },
          { id: "wx_shenmi", n: "暗世界入口", x: 72, y: 40, t: "danger", d: 5, rg: "归一会", desc: "连通暗世界的门户，归一会阴谋与古老存在的交汇之地。", c: "原著暗世界设定。" }
        ]
      }
    ]
  }
};
