/* 云境 · 36 界专属状态字段表 v1.1.0（v4.19.2）
 *
 * 为什么有它
 *   旧 status-presets.js 只有 8 个「题材原型」，36 界往原型上套——于是仙逆、斗破、
 *   凡人、遮天全是同一套「道基/灵根/神通/法宝...」，玩家一眼就看出是通用模板。
 *   本表为 36 个有名世界各写 14 个贴合本界设定的「状态维度」字段 + 专属改名 + 专属关闭组。
 *
 * ★ v1.1.0 重要原则（v4.19.2，用户明确要求）——字段名只写「状态维度」，不写原著专名：
 *   状态栏是「玩家当前状态/数值面板」，字段标题必须是可复用的状态维度，例如：
 *     师承 / 道侣 / 家族 / 所属宗门 / 敌对势力 / 本命法宝 / 招牌绝招 / 当前境界 / 保命底牌
 *   绝不能把原著里的人名、宗门名、招式名、势力名、具体物品名写进字段标题，例如：
 *     药老之师 / 萧家族人 / 佛怒火莲 / 斗宗 / 魂殿 / 天逆珠 / 云天宗 / 李慕婉（均已剔除）
 *   那些具体名词属于「某个状态维度的取值」，应由 AI 在生成剧情时上报到字段的「值」里
 *   （例如：师承=药老、招牌绝招=佛怒火莲、当前境界=斗宗、敌对势力=魂殿）。
 *   世界之间的差异，靠「选取哪一组状态维度」体现，而不是靠往标题里塞专名。
 *
 * 数据格式
 *   raw: 'k:显示名:组|...'  共 14 项；组取 status-schema 的组 id：
 *     identity 身份 / where 时空 / body 身体 / mind 精神 / resource 资源 /
 *     reputation 声望 / relation 关系 / goal 目标 / state 状态效果 /
 *     combat 战力 / secret 隐秘
 *   relabel: 通用槽位 → 本界叫法（境界/状态/资源/所在 等），同样不含原著专名
 *   off: 本界关闭的组 id
 *
 * 接入方式
 *   status-presets.js 的 presetOf() 优先查 window.StatusWorldFields.get(genre)，
 *   命中则用本表，未命中回退旧 ARCH 原型。玩家已套用过的世界不覆盖（保持幂等纪律）。
 */
(function () {
  'use strict';

  var W = {
    /* ==================== 修真 / 玄幻 ==================== */
    xianni: {
      relabel: { realm: '修为境界', health: '肉身', resource: '随身储物', location: '所在之地' },
      off: ['adult'],
      raw: 'daoji:道基:identity|shoushu:寿元:state|tianni:本命法宝:resource|yuanying:元婴:body|shaqi:杀伐因果:state|wuxing:悟性:mind|zongmen:所属宗门:relation|shifu:师承:relation|daolv:道侣:relation|choujia:宿敌:relation|huafan:历练目标:goal|qiyun:气运:state|dipai:保命底牌:secret|jingjie:当前瓶颈:goal'
    },
    doupocangqiong: {
      relabel: { realm: '斗气等级', health: '体魄', resource: '随身储物', location: '所在' },
      off: ['adult'],
      raw: 'douqi:斗气属性:identity|doupai:斗气品阶:state|yihuo:火种:resource|douji:斗技:combat|dan Yao:丹药补给:resource|yaolao:师承:relation|jiayu:家族:relation|yuantang:敌对势力:relation|hanzhi:体魄抗力:body|douzong:境界威压:combat|mingqi:名气:reputation|naJie:储物法宝:resource|fumo:招牌绝招:combat|mubiao:修炼目标:goal'
    },
    wanmeishijie: {
      relabel: { realm: '当前境界', health: '骨文肉身', resource: '护身宝物', location: '所在之地' },
      off: ['adult'],
      raw: 'guyu:骨文:identity|dongtian:当前境界:state|zhizun:境界名号:reputation|baofu:护身符箓:resource|shoupi:护身战甲:resource|wuhun:武魂:combat|shihao:前世背景:relation|huanian:出身来历:relation|tianjing:信念:secret|zhuanshi:转世之谜:secret|shenwu:神物:resource|zhanyi:战意:combat|mingtian:名望:reputation|feisheng:飞升目标:goal'
    },
    douluodalu: {
      relabel: { realm: '魂环境界', health: '武魂体魄', resource: '魂币储物', location: '所在' },
      off: ['adult'],
      raw: 'wuhun:武魂:identity|huan:魂环配置:state|hunli:魂力:combat|hungu:魂骨:resource|hunjue:魂诀:combat|haoTian:本命武魂:resource|shifu:师承:relation|wudui:队友:relation|shen Yuan:神位传承:secret|ming Hao:封号:reputation|yao Shan:灵药补给:resource|douhun:战绩:reputation|xue Se:诅咒状态:state|cheng Shen:成神目标:goal'
    },
    shrouding: {
      relabel: { realm: '当前境界', health: '圣体', resource: '随身储物', location: '所在星域' },
      off: ['adult'],
      raw: 'shengti:特殊体质:body|lunhai:当前境界:state|jiumi:秘术:combat|dibing:本命兵器:resource|yuanshu:传承功法:identity|shengdi:所属势力:relation|jiu Di:势力关系:relation|pengyou:伙伴:relation|xian Lu:成帝目标:goal|sui Yue:寿元状态:state|jiu Mi:秘术领悟:secret|ding Hai:随身秘境:resource|di Lu:争锋目标:combat|di Pai:保命底牌:secret'
    },
    fanrenxiuxian: {
      relabel: { realm: '修仙境界', health: '肉身', resource: '随身储物', location: '所在秘境' },
      off: ['adult'],
      raw: 'linggen:灵根资质:identity|jingjie:修为境界:state|xiaolvping:随身至宝:secret|jie Dan:丹道造诣:body|yuan Ying:元婴:body|lingshi:灵石:resource|fupi:符箓:resource|feijian:飞剑法器:combat|menpai:所属门派:relation|shifu:师承引路人:relation|chanjue:缠身因果:state|miji:秘境机缘:goal|shou Yuan:寿元大限:state|di Pai:隐匿底牌:secret'
    },
    jianlai: {
      relabel: { realm: '当前境界', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'benming:本命物:identity|jianxin:本命剑:combat|jianqi:剑气:state|jingjie:当前境界:state|rushi:修习源流:identity|jingyi:剑意:combat|shifu:师承:relation|chen Pingan:本心初心:secret|feilu:飞升目标:goal|xinjing:心境:secret|hu Yuan:守护之人:relation|gushu:灵物:resource|jian Xiu:剑修同伴:relation|wen Qihai:文脉气运:state'
    },
    guzhenren: {
      relabel: { realm: '真人之境', health: '道体', resource: '随身法器', location: '所在洞天' },
      off: ['adult'],
      raw: 'zhenren:当前境界:identity|famen:法门:combat|falu:法箓:resource|jingjie:修行境界:state|lingshi:灵石:resource|dongtian:所属洞天:where|shimen:师门:relation|daoyou:道友:relation|gxian:香火愿力:state|tian Jie:天劫:state|fabao:本命法宝:resource|dazai:灾劫:goal|mie Qu:大劫预言:secret|chong Sheng:重生之谜:secret'
    },
    xuanjianxianzu: {
      relabel: { realm: '剑道境界', health: '剑体', resource: '剑囊', location: '所在剑域' },
      off: ['adult'],
      raw: 'jianxin:剑心:identity|jianyi:剑意:combat|jianyu:剑域:state|jingjie:当前境界:state|jianming:本命剑:resource|jianshu:剑术:combat|shimen:所属宗门:relation|jian Di:剑道目标:goal|jianzhong:历练之地:where|ren Jian:人剑合一:state|jian Ling:剑灵:relation|chou Di:宿敌:relation|po Jun:战斗态势:combat|jian Pai:身份令牌:secret'
    },
    dazhuzai: {
      relabel: { realm: '至尊境界', health: '灵力体魄', resource: '空间储物', location: '所在大陆' },
      off: ['adult'],
      raw: 'lingli:灵力:state|zhizun:修炼目标:goal|lingzhen:灵阵:combat|mu Chen:主角根脚:secret|shenshou:神兽:resource|dalu:所在世界:where|jiayuan:所属势力:relation|shili:势力:relation|tianzhi:当前境界:state|zhuzai:终极目标:goal|lingyao:灵药:resource|zhan Li:战力:combat|ming Qi:名气:reputation|di Pai:保命底牌:secret'
    },
    wudongqiankun: {
      relabel: { realm: '武学境界', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'zufu:本命符印:identity|wuxue:武学:combat|fushi:符师身份:identity|niepan:涅槃状态:state|lin Dong:主角目标:secret|tiandi:名榜排名:reputation|shili:势力:relation|lingdong:符文力量:state|qingyang:故乡羁绊:relation|gudong:远古秘藏:secret|zhanli:战力:combat|dabao:秘藏机缘:goal|qiyun:气运:state|di Pai:保命底牌:secret'
    },
    yuanzun: {
      relabel: { realm: '源力境界', health: '源力体魄', resource: '源兵储物', location: '所在' },
      off: ['adult'],
      raw: 'yuanli:源力:state|yuanwen:源纹:combat|yuanbing:源兵:resource|zhou Yuan:主角命格:secret|zulong:传承功法:combat|sheng Jing:当前境界:goal|tiancai:天材地宝:resource|shili:所属势力:relation|ming Qi:名气:reputation|qi Yun:气运:state|zhan Li:战力:combat|chou Di:仇敌:relation|jiyuan:机缘:goal|di Pai:保命底牌:secret'
    },
    wanxiangzhiwang: {
      relabel: { realm: '万象境界', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'lingli:灵力:state|wanxiang:相力:combat|shengzhe:当前境界:state|tianxiang:天象:secret|wuxiang:无相之秘:secret|shili:势力:relation|zhan Li:战力:combat|ming Qi:名望:reputation|jiyuan:机缘:goal|lingyao:灵药:resource|fabao:法宝:resource|chou Di:宿敌:relation|qiyun:气运:state|di Pai:底牌:secret'
    },
    shengxu: {
      relabel: { realm: '进化境界', health: '基因体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'jiyin:基因链:body|changyu:场域:combat|lunhui:轮回之谜:secret|chu Feng:主角根脚:secret|yangjian:所在世界:where|xian Di:终极目标:goal|shenwu:神物:resource|daoshu:传承功法:resource|shili:势力:relation|zhan Li:战力:combat|ming Qi:名气:reputation|jinyi:当前境界:state|tiancai:天材地宝:resource|di Pai:保命底牌:secret'
    },
    shenmifusu: {
      relabel: { realm: '驭鬼境界', health: '残躯', resource: '随身物', location: '所在凶地' },
      off: ['combat', 'adult'],
      raw: 'guiyu:鬼域:state|guiyan:异能:identity|lizhi:能力拼图:secret|yugui:驭鬼者身份:identity|lingshi:灵异力量:state|zhongshen:当前境界:state|shenghuo:求生目标:goal|jiazu:家族:relation|yinling:所属阵营:relation|guidong:凶地:where|guitu:灵异档案:secret|zuqiang:最强手段:combat|huo Li:火种:resource|siwang:死亡倒计时:state'
    },
    wulianfengdian: {
      relabel: { realm: '山峰境界', health: '道体', resource: '随身法器', location: '所在峰' },
      off: ['adult'],
      raw: 'fengmai:血脉:identity|zongmen:所属宗门:relation|jingjie:当前境界:state|famen:法门:combat|fabao:法器:resource|lingshi:灵石:resource|shifu:师承:relation|tongmen:同门:relation|tian Jie:天劫:state|mingyun:气运:state|jin Di:禁地:where|miji:秘境:goal|zhan Li:战力:combat|di Pai:底牌:secret'
    },

    /* ==================== 网游 / 游戏 ==================== */
    quanzhifashi: {
      relabel: { realm: '魔法等级', health: '体魄', resource: '魔具/星尘', location: '所在' },
      off: ['adult'],
      raw: 'xinggui:星轨:identity|mofa:魔法系:combat|zhaohuan:召唤兽:resource|yuansu:元素掌控:combat|mofa Xiehui:所属协会:relation|dibing:主修系别:state|mofashi:当前等级:state|mo Fan:主角根脚:secret|xingchen:星尘:resource|zhanji:战绩:reputation|duiyou:队友:relation|jiaoyuan:所在校园:where|jiebai:结界:combat|di Pai:保命底牌:secret'
    },
    quanzhigaoshou: {
      relabel: { realm: '荣耀段位', health: '状态', resource: '装备/账号', location: '所在赛场' },
      off: ['adult'],
      raw: 'zhanghao:游戏账号:identity|zhiye:职业:identity|qianji San:本命武器:resource|zhuangbei:银武装备:resource|ji SKill:技能点:combat|zhandei:所属战队:relation|yes Qiu:隐藏身份:secret|rongyao:当前段位:state|zhanji:战绩:reputation|shengjie:实力评价:reputation|duiyou:队友:relation|sai Chang:所在赛场:where|xin Shou:新手经历:secret|di Pai:保命底牌:secret'
    },
    wangyou: {
      relabel: { realm: '角色等级', health: 'HP', resource: '金币/背包', location: '所在地图' },
      off: ['adult'],
      raw: 'zhiye:职业:identity|dengji:当前等级:state|zhuangbei:装备:resource|jineng:技能:combat|gonghui:所属公会:relation|fuben:副本进度:goal|hp:HP/MP:body|jinbi:金币:resource|bag:背包:resource|shengyu:声望:reputation|pk:PK值:state|duiyou:队伍:relation|zuiji:坐骑宠物:resource|di Pai:隐藏职业:secret'
    },

    /* ==================== 科幻 / 星际 ==================== */
    scifi: {
      relabel: { realm: '权限等级', health: '生命体征', resource: '资源点', location: '星域坐标' },
      off: ['adult'],
      raw: 'quanxian:权限等级:identity|jianzai:舰载系统:resource|nengliang:能量:state|wuxi:外骨骼:combat|wuqi:武器系统:combat|zhixing:执行力:combat|fei Chuan:座驾:resource|xingyu:所在星域:where|zhongzu:种族:identity|shili:势力:relation|renwu:任务:goal|chuanyin:通讯:state|f their:辐射:state|di Pai:隐藏科技:secret'
    },
    swallowedstar: {
      relabel: { realm: '宇宙等级', health: '生命基因', resource: '资源点', location: '星球坐标' },
      off: ['adult'],
      raw: 'jingen:基因原力:body|jingshen:精神念力:combat|wuxing:当前等级:state|luo Feng:主角根脚:secret|zhanshen:实力评价:reputation|yuzhou:当前境界:state|fei Jian:本命兵器:resource|chan Jiang:军衔身份:state|shili:所属势力:relation|jiaren:家人:relation|renwu:任务:goal|ziyuan:资源:resource|ming Qi:名气:reputation|di Pai:本命神兵:secret'
    },
    chaoshenxueyuan: {
      relabel: { realm: '基因等级', health: '超级体魄', resource: '暗能量', location: '所在基地' },
      off: ['adult'],
      raw: 'jiyin:基因链:body|tianshi:血脉:identity|emo:敌对血脉:identity|chaoji:当前身份:state|an Nengliang:暗能量:resource|wuqi:武器:combat|liang Bing:宿敌:relation|xueyuan:所属阵营:relation|deyang:所在星球:where|shenhe:文明传承:secret|zhanji:战绩:reputation|renwu:任务:goal|huoban:战友:relation|di Pai:保命底牌:secret'
    },
    ditandali: {
      relabel: { realm: '科技等级', health: '体魄', resource: '资源点', location: '所在星区' },
      off: ['adult'],
      raw: 'keji:当前等级:identity|zhuangbei:机甲装备:resource|nengliang:能源:state|zhanji:战机:resource|wuqi:武器系统:combat|shili:势力:relation|xingyu:所在星区:where|renwu:任务:goal|ming Qi:声望:reputation|duiyou:同伴:relation|qiyuan:起源之谜:secret|jineng:技能:combat|ziyuan:资源:resource|di Pai:底牌:secret'
    },

    /* ==================== 克苏鲁 / 诡秘 / 悬疑 ==================== */
    cthulhu: {
      relabel: { realm: '途径/序列', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'lizhi:理智值:mind|wuran:污染度:state|tujing:途径:identity|xulie:序列:state|moyao:魔药:resource|lingsheng:灵性:mind|jiao Tuan:所属教团:relation|gudai:信仰对象:secret|jinji:禁忌知识:secret|yishi:仪式:combat|feichang:非凡物品:resource|zhizhe:已知真相:secret|mengyan:梦魇低语:state|di Pai:保命底牌:secret'
    },
    guimi: {
      relabel: { realm: '途径/序列', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'tujing:非凡途径:identity|xulie:序列:state|moyao:魔药消化:state|lizhi:理智:mind|yuanbao:神秘归宿:secret|kelai:隐藏身份:secret|huiwu:隐秘据点:where|mimi:所属组织:relation|taiyang:主修途径:combat|yishi:仪式魔法:combat|feiwu:非凡物品:resource|qianzhi:前置经历:secret|di Pai:保命底牌:secret|shenzhi:终极目标:goal'
    },
    daoguiyixian: {
      relabel: { realm: '修真境界', health: '身心（真/假）', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'xinsu:心素:identity|danuo:所在世界:secret|lizhi:理智状态:mind|zhenjia:真假之辨:secret|lifan:当前境界:state|guiyan:异能:combat|yaoguai:敌对妖魔:relation|zhenshen:真身:body|xinmian:心相:secret|bingshi:精神状态:secret|famen:法门:combat|huangli:所在之地:where|huo Wang:主角目标:goal|di Pai:保命底牌:secret'
    },
    mystery: {
      relabel: { realm: '调查等级', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'shenfen:调查员身份:identity|xiansuo:已知线索:secret|zhenxiang:已知真相:secret|queshi:缺失信息:goal|kongju:恐惧值:mind|jingshen:精神稳定:mind|guangyuan:光源:resource|tuilu:退路:state|tongxing:同行者:relation|xinren:可信之人:relation|jilu:调查记录:resource|shijian:剩余时间:goal|yichang:确认的异常:secret|anquan:安全据点:resource'
    },

    /* ==================== 武侠 / 蒸汽 ==================== */
    wuxia: {
      relabel: { realm: '内力境界', health: '气血', resource: '银两盘缠', location: '所在' },
      off: ['adult'],
      raw: 'neili:内力:combat|neigong:内功心法:identity|zhaoshi:得意招式:combat|bingqi:趁手兵器:resource|qinggong:轻功身法:combat|menpai:门派师承:relation|tongmen:同门:relation|enyu:恩怨:relation|jianghu:江湖名望:reputation|wanted:通缉追杀:state|yinliang:银两:resource|shangyao:伤药:resource|jie:江湖规矩:secret|suoyuan:所托之事:goal'
    },
    limingzhijian: {
      relabel: { realm: '魔导等级', health: '体魄', resource: '资财', location: '所在城邦' },
      off: ['adult'],
      raw: 'mofang:源能:identity|faxue:学派:relation|zaowu:随身造物:resource|fuwenn:符文:state|zhuangzhi:蒸汽装置:resource|guanfang:官方身份:identity|zhuanli:专利成果:reputation|gongfang:工坊据点:resource|tudi:学徒:relation|hanghui:行会关系:relation|yanjiu:在研项目:goal|jiushang:旧伤义体:body|chuanwen:传闻:secret|falu:法律处境:state'
    },

    /* ==================== 都市 / 现代 ==================== */
    earth: {
      relabel: { realm: '社会阶层', health: '身体状态', resource: '资产', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'zhiye:职业:identity|zhengjian:证件身份:identity|shouru:收入资产:resource|xianjin:随身现金:resource|shouji:手机通讯:resource|jiaotong:交通工具:resource|zhusuo:住所:resource|renmai:人脉:relation|jiaren:家人:relation|mingsheng:社会名声:reputation|xinqing:心情压力:mind|anpai:近期安排:goal|mimi:秘密:secret|mafan:当前的麻烦:state'
    },
    zhongshengdushi: {
      relabel: { realm: '社会阶层', health: '身体状态', resource: '资产', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'qianshi:前世记忆:secret|chong Sheng:重生节点:where|zhiye:职业:identity|caiyun:财运:state|j iy uan:前世机缘:goal|renmai:人脉:relation|zhuyi:前世仇人:relation|shouru:资产:resource|mingsheng:名声:reputation|xinqing:心态:mind|jiaren:家人:relation|mubiao:今生目标:goal|mimi:重生之秘:secret|fengxian:风险:state'
    },
    zhanhen: {
      relabel: { realm: '军衔/地位', health: '体魄', resource: '装备物资', location: '所在' },
      off: ['adult'],
      raw: 'junxian:军衔身份:identity|bingzhong:兵种:combat|wuqi:武器:resource|zhuangbei:装备:resource|duiwu:队伍战友:relation|shangsi:上级:relation|renwu:任务:goal|zhanji:战绩:reputation|tizhi:体魄:body|jindu:任务进度:state|qingbao:情报:secret|difang:敌方:relation|zhanshu:战术:combat|di Pai:底牌:secret'
    },
    longzu: {
      relabel: { realm: '血统等级', health: '体魄', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'xuetong:血统:identity|yanling:言灵:combat|hunxue:混血种身份:state|lu Mingfei:隐藏身世:secret|kaseer:所属学院:relation|nunu:羁绊之人:relation|huangli:宿命羁绊:relation|longwang:强敌:secret|shijie:世界线:where|mingyun:命运:mind|zhanji:战绩:reputation|renwu:任务:goal|xinshi:心事:secret|di Pai:保命底牌:secret'
    },
    quanqiubingfeng: {
      relabel: { realm: '生存等级', health: '体温/体魄', resource: '物资', location: '所在避难所' },
      off: ['combat', 'adult'],
      raw: 'tiwen:体温:body|bingfeng:冰封等级:state|wuzi:物资储备:resource|shiwu:食物:resource|ranliao:燃料:resource|bishuo:避难所:where|duiyou:同伴:relation|jiren:敌人:relation|shengcun:生存天数:state|jihua:求生计划:goal|shengwang:声望:reputation|mimi:末世之秘:secret|weixian:当前危险:state|di Pai:底牌:secret'
    },
    dibao: {
      relabel: { realm: '社会阶层', health: '体魄', resource: '财物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'shenfen:身份:identity|zhiye:职业:identity|caifu:财富:resource|fangchan:房产:resource|renmai:人脉:relation|jiaren:家人:relation|mingsheng:名声:reputation|tizhi:体质:body|xinqing:心境:mind|jihua:规划:goal|mimi:秘密:secret|fengxian:风险:state|j iyu:机遇:goal|di Pai:底牌:secret'
    },
    lunhuileyuan: {
      relabel: { realm: '轮回者阶位', health: '体魄', resource: '强化点', location: '当前副本' },
      off: ['adult'],
      raw: 'lunhui:轮回者身份:identity|jiewei:阶位:state|qianghua:强化:combat|duihuan:兑换点:resource|fuben:当前副本:where|renwu:任务:goal|shili:所属阵营:relation|duiyou:队友:relation|shengcun:生存积分:state|ming Qi:名气:reputation|jiesuo:解锁权限:secret|zhanji:战绩:reputation|weixian:当前危机:state|di Pai:底牌:secret'
    },

    /* free / freeworld 为玩家自定义世界，不在此表；由 status-presets 回退处理 */
  };

  /* v1.3.0 多值栏目识别（全量覆盖 36 界）：
     这些「状态维度」本质上可同时存在多项（九个魂环、数件法宝、多位队友、
     数条线索、多种功法……），单值字符串写不下也显示不出。
     命中即标 multi=true，读写/编辑/渲染按数组处理。
     按语义分组逐字段审过 36 界全部字段；「本命剑/本命兵器/本命武魂」等唯一物、
     「当前境界/战力/名气/理智值」等标量数值一律不列，避免误伤。 */
  var MULTI_LABELS = {
    /* —— 人物关系 / 阵营（可多位）—— */
    '队友':1,'同伴':1,'伙伴':1,'道侣':1,'道友':1,'同门':1,'剑修同伴':1,'战友':1,'队伍战友':1,
    '家人':1,'家族':1,'羁绊之人':1,'宿命羁绊':1,'守护之人':1,'同行者':1,'可信之人':1,'上级':1,'队伍':1,
    '所属势力':1,'所属宗门':1,'所属阵营':1,'所属协会':1,'所属战队':1,'所属公会':1,'所属组织':1,
    '所属教团':1,'所属门派':1,'所属洞天':1,'势力':1,'势力关系':1,'行会关系':1,'人脉':1,
    '关系':1,'恩怨':1,'宿敌':1,'仇敌':1,'敌人':1,'敌方':1,'敌对势力':1,'敌对妖魔':1,'敌对血脉':1,'强敌':1,'通缉追杀':1,
    /* —— 功法 / 技能 / 神通（可多种）—— */
    '功法':1,'传承功法':1,'法门':1,'武学':1,'内功心法':1,'剑术':1,'剑意':1,'剑气':1,'修习源流':1,
    '秘术':1,'秘术领悟':1,'神通':1,'招牌绝招':1,'得意招式':1,'轻功身法':1,'魔法系':1,'元素掌控':1,
    '技能':1,'斗技':1,'火种':1,'师承':1,'门派师承':1,'师门':1,'师承引路人':1,
    '异能':1,'言灵':1,'血脉':1,'血统':1,'特殊体质':1,'灵根资质':1,'骨文':1,'符文':1,'符文力量':1,'源纹':1,
    '源兵':1,'法箓':1,'能力拼图':1,'模式':1,'能力':1,'招式':1,
    /* —— 装备 / 宝物 / 物资（可数件）—— */
    '法宝':1,'本命法宝':1,'法器':1,'飞剑法器':1,'随身至宝':1,'储物法宝':1,'护身符箓':1,'护身战甲':1,
    '装备':1,'银武装备':1,'机甲装备':1,'武器':1,'武器系统':1,'舰载系统':1,'蒸汽装置':1,'随身造物':1,'学徒':1,
    '本命物':1,'神物':1,'灵物':1,'灵药':1,'灵药补给':1,'丹药补给':1,'符箓':1,'天材地宝':1,'神兽':1,
    '秘藏':1,'远古秘藏':1,'随身秘境':1,'秘境':1,'非凡物品':1,'灵异档案':1,'召唤兽':1,'坐骑宠物':1,
    '背包':1,'物资储备':1,'食物':1,'燃料':1,'资源':1,'资产':1,'收入资产':1,'房产':1,'伤药':1,
    '座驾':1,'身份令牌':1,'灵阵':1,'结界':1,'天劫':1,'灾劫':1,'香火愿力':1,'专利成果':1,'在研项目':1,
    /* —— 魂环 / 魂师专属 —— */
    '魂环配置':1,'魂骨':1,'魂诀':1,'武魂':1,
    /* —— 信息 / 线索 / 真相（可多条）—— */
    '已知线索':1,'已知真相':1,'缺失信息':1,'调查记录':1,'确认的异常':1,'禁忌知识':1,'灵异档案':1,
    '秘密':1,'传闻':1,'情报':1,'机缘':1,'秘境机缘':1,'秘藏机缘':1,'前世记忆':1,'前世机缘':1,'前世背景':1,
    '出身来历':1,'转世之谜':1,'重生之谜':1,'重生之秘':1,'轮回之谜':1,'起源之谜':1,'大劫预言':1,
    '梦魇低语':1,'魔药':1,'魔药消化':1,'仪式':1,'仪式魔法':1,'隐秘据点':1,'安全据点':1,'避难所':1,
    '退路':1,'光源':1,'规划':1,'近期安排':1,'求生计划':1,'航海':1,
    /* —— 战绩 / 任务 / 底牌（可多项）—— */
    '战绩':1,'任务':1,'任务进度':1,'副本进度':1,'底牌':1,'保命底牌':1,'隐匿底牌':1,'杀伐因果':1,
    '缠身因果':1,'诅咒状态':1,'梦魇':1,'目标':1,'术法':1,'机遇':1,
    /* —— 通用复数后缀（兜底，防漏）—— */
    '途径':1,'非凡途径':1,'主修途径':1,'解锁权限':1,'通讯':1,'手机通讯':1,
    '文明传承':1,'神位传承':1,'隐藏科技':1,'游戏账号':1,'强化':1,'线索':1,
    '心血':1,'心愿':1,'心事':1,'所托之事':1,'江湖规矩':1,'信念':1,'战术':1,'奇遇':1,
    '战机':1
  };
  function isMulti(label) { return !!(label && MULTI_LABELS[label]); }

  /** 把 'k:显示名:组|...' 解析成字段对象数组 */
  function parse(raw) {
    return String(raw || '').split('|').map(function (seg) {
      var p = seg.split(':');
      var label = p[1] || p[0];
      return { k: p[0], label: label, group: p[2] || 'custom', multi: (p[3] === 'multi') || isMulti(label) };
    }).filter(function (f) { return f.k; });
  }

  /* ===== v1.4.0 题材字段别名（v4.28.0）=====
     若干「通用状态维度」（境界/底牌/名气/战力…）在 36 界 raw 里 label 完全一样，
     导致不同世界看起来「用了很多一样的东西」。这里按世界题材给这些维度换本界叫法：
     只改返回字段对象的 label（显示名 + 上报契约文案），不动 key k、不动 raw、不动存储，
     因此老存档、AI 上报键、迁移全部零影响。 */
  var GENRE_ARCH = {
    daoguiyixian:'kongbu', mystery:'kongbu',
    scifi:'keji', ditandali:'keji', chaoshenxueyuan:'keji', swallowedstar:'keji',
    doupocangqiong:'xianxia', wanmeishijie:'xianxia', douluodalu:'xianxia', shrouding:'xianxia',
    xianni:'xianxia', fanrenxiuxian:'xianxia', jianlai:'xianxia', guzhenren:'xianxia',
    xuanjianxianzu:'xianxia', dazhuzai:'xianxia', wudongqiankun:'xianxia', yuanzun:'xianxia',
    wanxiangzhiwang:'xianxia', shengxu:'xianxia', shenmifusu:'xianxia', wulianfengdian:'xianxia',
    quanzhifashi:'youxi', quanzhigaoshou:'youxi', wangyou:'youxi', lunhuileyuan:'youxi',
    cthulhu:'kepfu', guimi:'kepfu', wuxia:'wuxia', limingzhijian:'zhengqi',
    earth:'dushi', zhongshengdushi:'dushi', zhanhen:'dushi', longzu:'dushi',
    quanqiubingfeng:'dushi', dibao:'dushi'
  };
  var ARCH_LABEL = {
    xianxia: { '当前境界':'修为境界','保命底牌':'保命底牌','名气':'声名','战力':'战力','底牌':'底牌','势力':'势力','战绩':'战绩','任务':'历练' },
    keji:    { '当前境界':'进化阶位','保命底牌':'应急预案','名气':'知名度','战力':'战力指数','底牌':'隐藏协议','势力':'阵营','战绩':'战绩记录','任务':'指令' },
    dushi:   { '当前境界':'社会阶层','保命底牌':'压箱底牌','名气':'社会名声','战力':'影响力','底牌':'后手','势力':'人脉圈','战绩':'履历','任务':'事务' },
    kepfu:   { '当前境界':'途径序列','保命底牌':'保命手段','名气':'传闻度','战力':'威胁等级','底牌':'最后凭依','势力':'教团','战绩':'调查记录','任务':'委托' },
    youxi:   { '当前境界':'角色等级','保命底牌':'保命技能','名气':'知名度','战力':'战力评级','底牌':'隐藏技能','势力':'公会','战绩':'战绩','任务':'任务' },
    wuxia:   { '当前境界':'内力境界','保命底牌':'保命绝学','名气':'江湖名望','战力':'武功修为','底牌':'压箱绝招','势力':'门派','战绩':'战绩','任务':'江湖委托' },
    zhengqi: { '当前境界':'魔导等级','保命底牌':'应急装置','名气':'声誉','战力':'魔导输出','底牌':'备用装置','势力':'行会','战绩':'功绩','任务':'委托' },
    kongbu:  { '当前境界':'理智层级','保命底牌':'逃生筹码','名气':'恶名','战力':'危险度','底牌':'底牌','势力':'组织','战绩':'记录','任务':'委托' }
  };
  /* 36 界「当前境界」专属叫法：同题材内也各不相同，彻底消除雷同（通用意境词，非原著专名） */
  var WORLD_REALM = {
    xianni:'逆命之境', doupocangqiong:'斗气阶位', wanmeishijie:'骨文道境', douluodalu:'魂力阶位',
    shrouding:'修行秘境', fanrenxiuxian:'修仙层次', jianlai:'剑修境界', guzhenren:'真人道境',
    xuanjianxianzu:'剑道品阶', dazhuzai:'至尊之境', wudongqiankun:'武学境界', yuanzun:'源力境界',
    wanxiangzhiwang:'万象之境', shengxu:'进化层级', shenmifusu:'驭鬼之境', wulianfengdian:'武炼之境',
    quanzhifashi:'魔法阶位', quanzhigaoshou:'荣耀段位', wangyou:'角色等级', scifi:'进化阶位',
    swallowedstar:'生命层级', chaoshenxueyuan:'基因阶位', ditandali:'机甲等级', cthulhu:'途径序列',
    guimi:'非凡序列', daoguiyixian:'心相之境', mystery:'调查层级', wuxia:'内力境界',
    limingzhijian:'魔导等级', earth:'社会阶层', zhongshengdushi:'重生节点', zhanhen:'军衔层级',
    longzu:'混血层级', quanqiubingfeng:'冰封等级', dibao:'身手层级', lunhuileyuan:'轮回阶位'
  };
  /* 玄幻内部「保命底牌/战力」专属叫法（这几项题材别名在同题材内仍会撞，逐界再区分） */
  var WORLD_TRUMP = {
    xianni:'逆命底牌', shrouding:'保命古术', dazhuzai:'护道底牌', wudongqiankun:'武学底牌',
    yuanzun:'源术底牌', shengxu:'保命底牌', wanxiangzhiwang:'底牌', wulianfengdian:'保命底牌'
  };
  var WORLD_POWER = {
    dazhuzai:'至尊战力', wudongqiankun:'武道实力', yuanzun:'源力战力', wanxiangzhiwang:'相力战力',
    shengxu:'进化战力', wulianfengdian:'武炼战力'
  };
  function thematicLabel(g, label) {
    if (label === '当前境界' && WORLD_REALM[g]) return WORLD_REALM[g];
    if (label === '保命底牌' && WORLD_TRUMP[g]) return WORLD_TRUMP[g];
    if (label === '战力' && WORLD_POWER[g]) return WORLD_POWER[g];
    var arch = GENRE_ARCH[g];
    var m = arch && ARCH_LABEL[arch];
    return (m && m[label]) || label;
  }

  var CACHE = {};
  function get(g) {
    if (!g) return null;
    if (CACHE[g]) return CACHE[g];
    var w = W[g];
    if (!w) return null;
    var fields = parse(w.raw).map(function (f) {
      var nl = thematicLabel(g, f.label);
      return nl === f.label ? f : Object.assign({}, f, { label: nl, _baseLabel: f.label });
    });
    CACHE[g] = {
      arch: 'world:' + g,
      off: (w.off || []).slice(),
      relabel: Object.assign({}, w.relabel || {}),
      fields: fields,
      exclusive: true
    };
    return CACHE[g];
  }

  function genres() { return Object.keys(W); }

  function diagnose(g) {
    var p = get(g);
    if (!p) return '【' + g + '】无专属字段（自定义世界或未知界）';
    return '【' + g + '】专属字段 ' + p.fields.length + ' 项：' + p.fields.map(function (f) { return f.label; }).join('、');
  }

  window.StatusWorldFields = { W: W, get: get, genres: genres, diagnose: diagnose, isMulti: isMulti, MULTI_LABELS: MULTI_LABELS };
})();
