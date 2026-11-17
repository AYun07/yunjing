/* 云境 · 38 界专属状态字段表 v1.0.0（v4.19.0）
 *
 * 为什么有它
 *   旧 status-presets.js 只有 8 个「题材原型」，36 界往原型上套——于是仙逆、斗破、
 *   凡人、遮天全是同一套「道基/灵根/神通/法宝...」，玩家一眼就看出是通用模板，
 *   与「每个世界的状态栏都不一样」直接冲突。
 *   本表为 36 个有名世界各写 14 个贴合原著设定的招牌字段 + 专属改名 + 专属关闭组；
 *   free / freeworld 是玩家自定义世界，不套预设（保持 StatusSchema 自由编辑）。
 *
 * 数据格式
 *   raw: 'k:显示名:组|...'  共 14 项；组取 status-schema 的组 id：
 *     identity 身份 / where 时空 / body 身体 / mind 精神 / resource 资源 /
 *     reputation 声望 / relation 关系 / goal 目标 / state 状态效果 /
 *     combat 战力 / secret 隐秘
 *   relabel: 通用槽位 → 本界叫法（境界/状态/资源/所在 等）
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
      relabel: { realm: '修为境界', health: '肉身', resource: '储物袋', location: '所在之地' },
      off: ['adult'],
      raw: 'daoji:道基:identity|shoushu:寿元:state|tianni:天逆珠:resource|yuanying:元婴:body|shaqi:杀伐因果:state|wuxing:悟性:mind|zongmen:云天宗:relation|shifu:师承遁天:relation|daolv:道侣李慕婉:relation|choujia:宿敌:relation|huafan:化凡历练:goal|qiyun:逆天气运:state|dipai:保命底牌:secret|jingjie:当前瓶颈:goal'
    },
    doupocangqiong: {
      relabel: { realm: '斗气等级', health: '体魄', resource: '纳戒储物', location: '所在' },
      off: ['adult'],
      raw: 'douqi:斗气属性:identity|doupai:斗气品阶:state|yihuo:异火:resource|douji:斗技:combat|dan Yao:丹药补给:resource|yaolao:药老之师:relation|jiayu:萧家族人:relation|yuantang:魂殿仇敌:relation|hanzhi:寒冰/异火抗力:body|douzong:斗宗威压:combat|mingqi:名气:reputation|naJie:纳戒珍宝:resource|fumo:佛怒火莲:combat|mubiao:成帝之志:goal'
    },
    wanmeishijie: {
      relabel: { realm: '境界（洞天/至尊）', health: '骨文肉身', resource: '宝符兽皮', location: '所在大荒' },
      off: ['adult'],
      raw: 'guyu:骨文:identity|dongtian:洞天境界:state|zhizun:至尊之称:reputation|baofu:宝符:resource|shoupi:兽皮战甲:resource|wuhun:武魂:combat|shihao:十冠王之影:relation|huanian:童年石村:relation|tianjing:天经地义:secret|zhuanshi:转世之谜:secret|shenwu:神物:resource|zhanyi:战意:combat|mingtian:名动天下:reputation|feisheng:飞升之念:goal'
    },
    douluodalu: {
      relabel: { realm: '魂环境界', health: '武魂体魄', resource: '魂币储物', location: '所在' },
      off: ['adult'],
      raw: 'wuhun:武魂:identity|huan:魂环配置:state|hunli:魂力:combat|hungu:魂骨:resource|hunjue:魂诀:combat|haoTian:昊天锤:resource|shifu:大师师父:relation|wudui:史莱克队友:relation|shen Yuan:神位传承:secret|ming Hao:封号:reputation|yao Shan:仙草灵药:resource|douhun:斗魂战绩:reputation|xue Se:血色诅咒:state|cheng Shen:成神之路:goal'
    },
    shrouding: {
      relabel: { realm: '境界（轮海/道宫/仙台）', health: '圣体', resource: '源天储物', location: '所在星域' },
      off: ['adult'],
      raw: 'shengti:荒古圣体:body|lunhai:轮海境界:state|jiumi:九秘:combat|dibing:帝兵:resource|yuanshu:源天术:identity|shengdi:古老圣地:relation|jiu Di:九大圣地关系:relation|pengyou:庞博等人:relation|xian Lu:成帝之路:goal|sui Yue:岁月流逝:state|jiu Mi:九秘所得:secret|ding Hai:鼎中世界:resource|di Lu:帝路争锋:combat|di Pai:帝者底牌:secret'
    },
    fanrenxiuxian: {
      relabel: { realm: '修仙境界', health: '肉身', resource: '储物袋', location: '所在秘境' },
      off: ['adult'],
      raw: 'linggen:灵根资质:identity|jingjie:修为境界:state|xiaolvping:神秘小瓶:secret|jie Dan:结丹期:body|yuan Ying:元婴:body|lingshi:灵石:resource|fupi:符箓:resource|feijian:飞剑法器:combat|menpai:七玄门/门派:relation|shifu:墨大夫之流:relation|chanjue:缠身因果:state|miji:秘境机缘:goal|shou Yuan:寿元大限:state|di Pai:隐匿底牌:secret'
    },
    jianlai: {
      relabel: { realm: '境界（十四境）', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'benming:本命物:identity|jianxin:本命剑:combat|jianqi:剑气:state|jingjie:十四境修为:state|rushi:儒释道三教:identity|jingyi:剑意:combat|shifu:老秀才之师:relation|chen Pingan:陈平安初心:secret|feilu:飞升之路:goal|xinjing:心镜:secret|hu Yuan:护山人:relation|gushu:古树/灵物:resource|jian Xiu:剑修同行:relation|wen Qihai:文脉气运:state'
    },
    guzhenren: {
      relabel: { realm: '真人之境', health: '道体', resource: '随身法器', location: '所在洞天' },
      off: ['adult'],
      raw: 'zhenren:真人果位:identity|famen:法门:combat|falu:法箓:resource|jingjie:修行境界:state|lingshi:灵石:resource|dongtian:洞天福地:where|shimen:师门:relation|daoyou:道友:relation|gxian:香火愿力:state|tian Jie:天劫:state|fabao:本命法宝:resource|dazai:灾劫:goal|mie Qu:灭quisitions:secret|chong Sheng:重生之谜:secret'
    },
    xuanjianxianzu: {
      relabel: { realm: '剑道境界', health: '剑体', resource: '剑囊', location: '所在剑域' },
      off: ['adult'],
      raw: 'jianxin:剑心:identity|jianyi:剑意:combat|jianyu:剑域:state|jingjie:剑道境界:state|jianming:本命剑:resource|jianshu:剑术:combat|shimen:剑宗师门:relation|jian Di:剑帝之志:goal|jianzhong:剑冢:where|ren Jian:人剑合一:state|jian Ling:剑灵:relation|chou Di:剑道宿敌:relation|po Jun:破军之势:combat|jian Pai:剑牌:secret'
    },
    dazhuzai: {
      relabel: { realm: '至尊境界', health: '灵力体魄', resource: '空间储物', location: '所在大陆' },
      off: ['adult'],
      raw: 'lingli:灵力:state|zhizun:至尊之路:goal|lingzhen:灵阵:combat|mu Chen:牧尘之本:secret|shenshou:神兽:resource|dalu:大千世界:where|jiayuan:牧府:relation|shili:势力:relation|tianzhi:天至尊:state|zhuzai:主宰之念:goal|lingyao:灵药:resource|zhan Li:战力:combat|ming Qi:名气:reputation|di Pai:至尊底牌:secret'
    },
    wudongqiankun: {
      relabel: { realm: '武学境界', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'zufu:祖符:identity|wuxue:武学:combat|fushi:符师:identity|niepan:涅槃:state|lin Dong:林动之志:secret|tiandi:天地榜:reputation|shili:势力:relation|lingdong:符文力量:state|qingyang:青阳镇羁绊:relation|gudong:远古秘藏:secret|zhanli:战力:combat|dabao:大荒宝藏:goal|qiyun:气运:state|di Pai:祖符底牌:secret'
    },
    yuanzun: {
      relabel: { realm: '源力境界', health: '源力体魄', resource: '源兵储物', location: '所在' },
      off: ['adult'],
      raw: 'yuanli:源力:state|yuanwen:源纹:combat|yuanbing:源兵:resource|zhou Yuan:周元之命:secret|zulong:祖龙经:combat|sheng Jing:圣境:goal|tiancai:天材地宝:resource|shili:大周势力:relation|ming Qi:名气:reputation|qi Yun:气运:state|zhan Li:战力:combat|chou Di:仇敌:relation|jiyuan:机缘:goal|di Pai:圣龙底牌:secret'
    },
    wanxiangzhiwang: {
      relabel: { realm: '万象境界', health: '体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'lingli:灵力:state|wanxiang:万象之力:combat|shengzhe:圣者之境:state|tianxiang:天象:secret|wuxiang:无相之秘:secret|shili:势力:relation|zhan Li:战力:combat|ming Qi:名望:reputation|jiyuan:机缘:goal|lingyao:灵药:resource|fabao:法宝:resource|chou Di:宿敌:relation|qiyun:气运:state|di Pai:底牌:secret'
    },
    shengxu: {
      relabel: { realm: '进化境界', health: '基因体魄', resource: '随身物', location: '所在' },
      off: ['adult'],
      raw: 'jiyin:基因链:body|changyu:场域:combat|lunhui:轮回:secret|chu Feng:楚风之本:secret|yangjian:阳间:where|xian Di:仙帝之途:goal|shenwu:神物:resource|daoshu:道书:resource|shili:势力:relation|zhan Li:战力:combat|ming Qi:名气:reputation|jinyi:进化境界:state|tiancai:天材地宝:resource|di Pai:轮回底牌:secret'
    },
    shenmifusu: {
      relabel: { realm: '驭鬼境界', health: '残躯', resource: '随身物', location: '所在凶地' },
      off: ['combat', 'adult'],
      raw: 'guiyu:鬼域:state|guiyan:鬼眼:identity|lizhi:厉鬼拼图:secret|yugui:驭鬼者:identity|lingshi:灵异力量:state|zhongshen:中等鬼圣:state|shenghuo:美好生活之愿:goal|jiazu:家族:relation|yinling:营地:relation|guidong:鬼洞:where|guitu:鬼图:secret|zuqiang:最强厉鬼:combat|huo Li:火种:resource|siwang:死亡倒计时:state'
    },
    wulianfengdian: {
      relabel: { realm: '山峰境界', health: '道体', resource: '随身法器', location: '所在峰' },
      off: ['adult'],
      raw: 'fengmai:五峰血脉:identity|zongmen:宗门:relation|jingjie:修行境界:state|famen:法门:combat|fabao:法器:resource|lingshi:灵石:resource|shifu:师尊:relation|tongmen:同门:relation|tian Jie:天劫:state|mingyun:气运:state|jin Di:禁地:where|miji:秘境:goal|zhan Li:战力:combat|di Pai:底牌:secret'
    },

    /* ==================== 网游 / 游戏 ==================== */
    quanzhifashi: {
      relabel: { realm: '魔法等级', health: '体魄', resource: '魔具/星尘', location: '所在' },
      off: ['adult'],
      raw: 'xinggui:星轨:identity|mofa:魔法系:combat|zhaohuan:召唤兽:resource|yuansu:元素掌控:combat|mofa Xiehui:魔法协会:relation|dibing:地冰/冰系:state|mofashi:魔法师等级:state|mo Fan:莫凡之本:secret|xingchen:星尘:resource|zhanji:战绩:reputation|duiyou:队友:relation|jiaoyuan:校园:where|jiebai:结界:combat|di Pai:底牌魔法:secret'
    },
    quanzhigaoshou: {
      relabel: { realm: '荣耀段位', health: '状态', resource: '装备/账号', location: '所在赛场' },
      off: ['adult'],
      raw: 'zhanghao:游戏账号:identity|zhiye:职业:identity|qianji San:千机伞:resource|zhuangbei:银武装备:resource|ji SKill:技能点:combat|zhandei:战队:relation|yes Qiu:叶秋之名:secret|rongyao:荣耀段位:state|zhanji:战绩:reputation|shengjie:荣耀教科书:reputation|duiyou:队友:relation|sai Chang:赛场:where|xin Shou:新手时期:secret|di Pai:压箱底操作:secret'
    },
    wangyou: {
      relabel: { realm: '角色等级', health: 'HP', resource: '金币/背包', location: '所在地图' },
      off: ['adult'],
      raw: 'zhiye:职业:identity|dengji:等级:state|zhuangbei:装备:resource|jineng:技能:combat|gonghui:公会:relation|fuben:副本进度:goal|hp:HP/MP:body|jinbi:金币:resource|bag:背包:resource|shengyu:声望:reputation|pk:PK值:state|duiyou:队伍:relation|zuiji:坐骑宠物:resource|di Pai:隐藏职业:secret'
    },

    /* ==================== 科幻 / 星际 ==================== */
    scifi: {
      relabel: { realm: '权限等级', health: '生命体征', resource: '资源点', location: '星域坐标' },
      off: ['adult'],
      raw: 'quanxian:权限等级:identity|jianzai:舰载系统:resource|nengliang:能量:state|wuxi:外骨骼:combat|wuqi:武器系统:combat|zhixing:执行力:combat|fei Chuan:飞船:resource|xingyu:星域:where|zhongzu:种族:identity|shili:势力:relation|renwu:任务:goal|chuanyin:通讯:state|f their:辐射:state|di Pai:隐藏科技:secret'
    },
    swallowedstar: {
      relabel: { realm: '宇宙等级', health: '生命基因', resource: '资源点', location: '星球坐标' },
      off: ['adult'],
      raw: 'jingen:基因原力:body|jingshen:精神念力:combat|wuxing:武者等级:state|luo Feng:罗峰之本:secret|zhanshen:战神:reputation|yuzhou:宇宙尊者:state|fei Jian:飞剑:resource|chan Jiang:戦将:state|shili:虚拟宇宙公司:relation|jiaren:家人:relation|renwu:任务:goal|ziyuan:资源:resource|ming Qi:名气:reputation|di Pai:本命神兵:secret'
    },
    chaoshenxueyuan: {
      relabel: { realm: '基因等级', health: '超级体魄', resource: '暗能量', location: '所在基地' },
      off: ['adult'],
      raw: 'jiyin:基因链条:body|tianshi:天使血脉:identity|emo:恶魔血脉:identity|chaoji:超级战士:state|an Nengliang:暗能量:resource|wuqi:武器:combat|liang Bing:凉冰:relation|xueyuan:超神学院:relation|deyang:德邦/地球:where|shenhe:神河文明:secret|zhanji:战绩:reputation|renwu:任务:goal|huoban:战友:relation|di Pai:终极底牌:secret'
    },
    ditandali: {
      relabel: { realm: '科技等级', health: '体魄', resource: '资源点', location: '所在星区' },
      off: ['adult'],
      raw: 'keji:科技等级:identity|zhuangbei:机甲装备:resource|nengliang:能源:state|zhanji:战机:resource|wuqi:武器系统:combat|shili:势力:relation|xingyu:星区:where|renwu:任务:goal|ming Qi:声望:reputation|duiyou:同伴:relation|qiyuan:起源之谜:secret|jineng:技能:combat|ziyuan:资源:resource|di Pai:底牌:secret'
    },

    /* ==================== 克苏鲁 / 诡秘 / 悬疑 ==================== */
    cthulhu: {
      relabel: { realm: '途径/序列', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'lizhi:理智值:mind|wuran:污染度:state|tujing:途径:identity|xulie:序列:state|moyao:魔药:resource|lingsheng:灵性:mind|jiao Tuan:教团:relation|gudai:旧日支配者:secret|jinji:禁忌知识:secret|yishi:仪式:combat|feichang:非凡物品:resource|zhizhe:已知真相:secret|mengyan:梦魇低语:state|di Pai:理智底牌:secret'
    },
    guimi: {
      relabel: { realm: '途径/序列', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'tujing:非凡途径:identity|xulie:序列:state|moyao:魔药消化:state|lizhi:理智:mind|yuanbao:源堡:secret|kelai:克莱恩身份:secret|huiwu:灰雾之上:where|mimi:密修会:relation|taiyang:太阳途径:combat|yishi:仪式魔法:combat|feiwu:非凡物品:resource|qianzhi:前置剧情:secret|di Pai:替身底牌:secret|shenzhi:真神之念:goal'
    },
    daoguiyixian: {
      relabel: { realm: '修真境界', health: '身心（真/假）', resource: '随身物', location: '所在（大傩/现实）' },
      off: ['combat', 'adult'],
      raw: 'xinsu:心素:identity|danuo:大傩:secret|lizhi:理智/迷惘:mind|zhenjia:真假之辨:secret|lifan:修真境界:state|guiyan:鬼眼:combat|yaoguai:妖魔:relation|zhenshen:真身:body|xinmian:心相:secret|bingshi:精神病诊断:secret|famen:法门:combat|huangli:黄里:where|huo Wang:火旺之志:goal|di Pai:幻觉底牌:secret'
    },
    mystery: {
      relabel: { realm: '调查等级', health: '身心', resource: '随身物', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'shenfen:调查员身份:identity|xiansuo:已知线索:secret|zhenxiang:触到的真相:secret|queshi:缺失信息:goal|kongju:恐惧值:mind|jingshen:精神稳定:mind|guangyuan:光源:resource|tuilu:退路:state|tongxing:同行者:relation|xinren:可信之人:relation|jilu:笔记录音:resource|shijian:剩余时间:goal|yichang:确认的异常:secret|anquan:安全屋:resource'
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
      raw: 'mofang:魔方源能:identity|faxue:学派:relation|zaowu:随身造物:resource|fuwenn:符文:state|zhuangzhi:蒸汽装置:resource|guanfang:官方身份:identity|zhuanli:专利成果:reputation|gongfang:工坊据点:resource|tudi:学徒:relation|hanghui:行会关系:relation|yanjiu:在研项目:goal|jiushang:旧伤义体:body|chuanwen:传闻:secret|falu:法律处境:state'
    },

    /* ==================== 都市 / 现代 ==================== */
    earth: {
      relabel: { realm: '社会阶层', health: '身体状态', resource: '资产', location: '所在' },
      off: ['combat', 'adult'],
      raw: 'zhiye:职业单位:identity|zhengjian:证件身份:identity|shouru:收入资产:resource|xianjin:随身现金:resource|shouji:手机通讯:resource|jiaotong:交通工具:resource|zhusuo:住所:resource|renmai:人脉靠山:relation|jiaren:家人牵挂:relation|mingsheng:社会名声:reputation|xinqing:心情压力:mind|anpai:近期安排:goal|mimi:不为人知的秘密:secret|mafan:当前的麻烦:state'
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
      raw: 'xuetong:龙族血统:identity|yanling:言灵:combat|hunxue:混血种:state|lu Mingfei:路明非之秘:secret|kaseer:卡塞尔学院:relation|nunu:诺诺:relation|huangli:绘梨衣:relation|longwang:龙王:secret|shijie:世界线:where|mingyun:命运:mind|zhanji:战绩:reputation|renwu:任务:goal|xinshi:心事:secret|di Pai:交换底牌:secret'
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
      raw: 'lunhui:轮回者身份:identity|jiewei:阶位:state|qianghua:强化:combat|duihuan:兑换点:resource|fuben:当前副本:where|renwu:任务:goal|shili:乐园阵营:relation|duiyou:队友:relation|shengcun:生存积分:state|ming Qi:名气:reputation|jiesuo:解锁权限:secret|zhanji:战绩:reputation|weixian:当前危机:state|di Pai:底牌:secret'
    },

    /* free / freeworld 为玩家自定义世界，不在此表；由 status-presets 回退处理 */
  };

  /** 把 'k:显示名:组|...' 解析成字段对象数组 */
  function parse(raw) {
    return String(raw || '').split('|').map(function (seg) {
      var p = seg.split(':');
      return { k: p[0], label: p[1] || p[0], group: p[2] || 'custom' };
    }).filter(function (f) { return f.k; });
  }

  var CACHE = {};
  function get(g) {
    if (!g) return null;
    if (CACHE[g]) return CACHE[g];
    var w = W[g];
    if (!w) return null;
    CACHE[g] = {
      arch: 'world:' + g,
      off: (w.off || []).slice(),
      relabel: Object.assign({}, w.relabel || {}),
      fields: parse(w.raw),
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

  window.StatusWorldFields = { W: W, get: get, genres: genres, diagnose: diagnose };
})();
