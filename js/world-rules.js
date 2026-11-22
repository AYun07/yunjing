/* 云境 · 世界规则档 WorldRules（自动生成，勿手改）
 * 由 scripts/gen-world-rules.mjs 从 configs/*.js 抽取 statKeys/baseAttributes 生成。
 * 新增世界后重跑该脚本即可自动纳入；已生成的世界数值不受影响。
 * window.WorldRules.currentAxes() 供 attribute-engine 读取每世界专属维度。
 */
(function(){
"use strict";
var REGISTRY = {
 "chaoshenxueyuan": {
  "name": "超神学院",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体能",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体能",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "agility",
    "name": "身手",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "身手",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "mind",
    "name": "心智",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心智",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "grit",
    "name": "血勇",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "血勇"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 12,
   "agility": 10,
   "mind": 12,
   "grit": 12,
   "fortune": 8,
   "connections": 6
  },
  "fingerprint": "body|体能,agility|身手,mind|心智,grit|血勇,fortune|气运,connections|人脉"
 },
 "cthulhu": {
  "name": "克苏鲁",
  "mode": "creation",
  "axes": [
   {
    "id": "dread",
    "name": "恐惧",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "恐惧"
    ]
   },
   {
    "id": "suspense",
    "name": "悬疑",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "悬疑"
    ]
   },
   {
    "id": "prose",
    "name": "文笔",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "文笔",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "pacing",
    "name": "节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "节奏"
    ]
   },
   {
    "id": "madness",
    "name": "疯狂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "疯狂"
    ]
   },
   {
    "id": "echo",
    "name": "余韵",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "余韵"
    ]
   }
  ],
  "baseAttributes": {
   "dread": 15,
   "suspense": 15,
   "prose": 10,
   "pacing": 10,
   "madness": 10,
   "echo": 10
  },
  "fingerprint": "dread|恐惧,suspense|悬疑,prose|文笔,pacing|节奏,madness|疯狂,echo|余韵"
 },
 "daoguiyixian": {
  "name": "道诡异仙",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "胆魄",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "胆魄",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "心神",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "心神"
    ]
   },
   {
    "id": "ties",
    "name": "人缘",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人缘",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 12,
   "comprehension": 12,
   "fortune": 12,
   "temperament": 16,
   "soul": 16,
   "ties": 12
  },
  "fingerprint": "body|胆魄,comprehension|悟性,fortune|气运,temperament|心性,soul|心神,ties|人缘"
 },
 "dazhuzai": {
  "name": "大主宰",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "灵魂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "灵魂"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "soul": 10,
   "ties": 10
  },
  "fingerprint": "body|根骨,comprehension|悟性,fortune|气运,temperament|心性,soul|灵魂,ties|人脉"
 },
 "dibao": {
  "name": "帝霸",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "psyche",
    "name": "神识",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "神识",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "will",
    "name": "道心",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "道心",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "psyche": 12,
   "comprehension": 12,
   "will": 10,
   "fortune": 10,
   "connections": 6
  },
  "fingerprint": "body|根骨,psyche|神识,comprehension|悟性,will|道心,fortune|气运,connections|人脉"
 },
 "ditandali": {
  "name": "开局地摊卖大力",
  "mode": "roleplay",
  "axes": [
   {
    "id": "strength",
    "name": "力量",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "力量",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "spirit",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "reaction",
    "name": "反应",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "反应"
    ]
   },
   {
    "id": "eloquence",
    "name": "口才",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "口才",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "strength": 10,
   "constitution": 10,
   "spirit": 10,
   "reaction": 10,
   "eloquence": 12,
   "fortune": 8
  },
  "fingerprint": "strength|力量,constitution|体魄,spirit|精神,reaction|反应,eloquence|口才,fortune|气运"
 },
 "douluodalu": {
  "name": "斗罗大陆",
  "mode": "roleplay",
  "axes": [
   {
    "id": "aptitude",
    "name": "武魂资质",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "武魂资质",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "foundation",
    "name": "底蕴",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "底蕴"
    ]
   },
   {
    "id": "reputation",
    "name": "声望",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "声望",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "aptitude": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "foundation": 10,
   "reputation": 10
  },
  "fingerprint": "aptitude|武魂资质,comprehension|悟性,fortune|气运,temperament|心性,foundation|底蕴,reputation|声望"
 },
 "doupocangqiong": {
  "name": "斗破苍穹",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "斗骨",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "斗骨"
    ]
   },
   {
    "id": "comprehension",
    "name": "药悟",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "药悟"
    ]
   },
   {
    "id": "fortune",
    "name": "异火缘",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "异火缘"
    ]
   },
   {
    "id": "temperament",
    "name": "斗心",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "斗心"
    ]
   },
   {
    "id": "soul",
    "name": "魂识",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "魂识"
    ]
   },
   {
    "id": "ties",
    "name": "宗门脉",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "宗门脉"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "soul": 10,
   "ties": 10
  },
  "fingerprint": "body|斗骨,comprehension|药悟,fortune|异火缘,temperament|斗心,soul|魂识,ties|宗门脉"
 },
 "earth": {
  "name": "地球",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体质",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体质",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "intellect",
    "name": "智力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "智力"
    ]
   },
   {
    "id": "charm",
    "name": "魅力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "魅力"
    ]
   },
   {
    "id": "will",
    "name": "意志",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "意志",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "agility",
    "name": "敏捷",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "敏捷"
    ]
   },
   {
    "id": "knowledge",
    "name": "学识",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "学识",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   }
  ],
  "baseAttributes": {
   "body": 14,
   "intellect": 14,
   "charm": 10,
   "will": 12,
   "agility": 10,
   "knowledge": 10
  },
  "fingerprint": "body|体质,intellect|智力,charm|魅力,will|意志,agility|敏捷,knowledge|学识"
 },
 "fanrenxiuxian": {
  "name": "凡人修仙传",
  "mode": "roleplay",
  "axes": [
   {
    "id": "root",
    "name": "资质",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "资质",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "spirit",
    "name": "神识",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "神识",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "temper",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "wit",
    "name": "谋略",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "谋略",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "root": 10,
   "spirit": 10,
   "constitution": 10,
   "temper": 10,
   "wit": 10,
   "fortune": 8
  },
  "fingerprint": "root|资质,spirit|神识,constitution|体魄,temper|心性,wit|谋略,fortune|气运"
 },
 "free": {
  "name": "自由创作",
  "mode": "creation",
  "axes": [
   {
    "id": "tension",
    "name": "张力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "张力"
    ]
   },
   {
    "id": "emotion",
    "name": "情感",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "情感"
    ]
   },
   {
    "id": "prose",
    "name": "文笔",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "文笔",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "pacing",
    "name": "节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "节奏"
    ]
   },
   {
    "id": "creativity",
    "name": "创意",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "创意",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "depth",
    "name": "深度",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "深度",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   }
  ],
  "baseAttributes": {
   "tension": 15,
   "emotion": 15,
   "prose": 10,
   "pacing": 10,
   "creativity": 10,
   "depth": 10
  },
  "fingerprint": "tension|张力,emotion|情感,prose|文笔,pacing|节奏,creativity|创意,depth|深度"
 },
 "freeworld": {
  "name": "自由世界",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "intellect",
    "name": "神智",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "神智"
    ]
   },
   {
    "id": "charm",
    "name": "灵魅",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "灵魅"
    ]
   },
   {
    "id": "will",
    "name": "战意",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "战意"
    ]
   },
   {
    "id": "agility",
    "name": "身法",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "身法"
    ]
   },
   {
    "id": "knowledge",
    "name": "阅历",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "阅历"
    ]
   }
  ],
  "baseAttributes": {
   "body": 14,
   "intellect": 14,
   "charm": 10,
   "will": 12,
   "agility": 10,
   "knowledge": 10
  },
  "fingerprint": "body|体魄,intellect|神智,charm|灵魅,will|战意,agility|身法,knowledge|阅历"
 },
 "guimi": {
  "name": "诡秘",
  "mode": "roleplay",
  "axes": [
   {
    "id": "learning",
    "name": "学识",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "学识",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "mind",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "combat",
    "name": "体术",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体术",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "spirit",
    "name": "灵性",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "灵性",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "eloquence",
    "name": "口才",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "口才",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "幸运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "幸运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "learning": 12,
   "mind": 12,
   "combat": 8,
   "spirit": 10,
   "eloquence": 12,
   "fortune": 8
  },
  "fingerprint": "learning|学识,mind|心性,combat|体术,spirit|灵性,eloquence|口才,fortune|幸运"
 },
 "guzhenren": {
  "name": "蛊真人",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "wit",
    "name": "算计",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "算计",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "spirit",
    "name": "灵魂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "灵魂"
    ]
   },
   {
    "id": "luck",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "grim",
    "name": "狠劲",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "狠劲",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 10,
   "wit": 14,
   "spirit": 8,
   "luck": 10,
   "grim": 14,
   "connections": 8
  },
  "fingerprint": "body|体魄,wit|算计,spirit|灵魂,luck|气运,grim|狠劲,connections|人脉"
 },
 "jianlai": {
  "name": "剑来",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "mind",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "root",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "speech",
    "name": "言辞",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "言辞",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "wit",
    "name": "机变",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "机变",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "福缘",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "福缘",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 10,
   "mind": 12,
   "root": 10,
   "speech": 10,
   "wit": 12,
   "fortune": 8
  },
  "fingerprint": "body|体魄,mind|心性,root|根骨,speech|言辞,wit|机变,fortune|福缘"
 },
 "limingzhijian": {
  "name": "黎明之剑",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "psyche",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "knowledge",
    "name": "学识",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "学识",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "will",
    "name": "心志",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "心志"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 12,
   "psyche": 12,
   "knowledge": 14,
   "will": 12,
   "fortune": 10,
   "connections": 5
  },
  "fingerprint": "body|体魄,psyche|精神,knowledge|学识,will|心志,fortune|气运,connections|人脉"
 },
 "longzu": {
  "name": "龙族",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "psyche",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "will",
    "name": "心志",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "心志"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 14,
   "psyche": 14,
   "comprehension": 10,
   "will": 12,
   "fortune": 10,
   "connections": 5
  },
  "fingerprint": "body|体魄,psyche|精神,comprehension|悟性,will|心志,fortune|气运,connections|人脉"
 },
 "lunhuileyuan": {
  "name": "轮回乐园",
  "mode": "roleplay",
  "axes": [
   {
    "id": "strength",
    "name": "力量",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "力量",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "agility",
    "name": "敏捷",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "敏捷"
    ]
   },
   {
    "id": "constitution",
    "name": "体力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "体力"
    ]
   },
   {
    "id": "intellect",
    "name": "智力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "智力"
    ]
   },
   {
    "id": "spirit",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "luck",
    "name": "幸运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "幸运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "strength": 10,
   "agility": 10,
   "constitution": 10,
   "intellect": 10,
   "spirit": 10,
   "luck": 8
  },
  "fingerprint": "strength|力量,agility|敏捷,constitution|体力,intellect|智力,spirit|精神,luck|幸运"
 },
 "mystery": {
  "name": "悬疑创作",
  "mode": "creation",
  "axes": [
   {
    "id": "suspense",
    "name": "悬念",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "悬念"
    ]
   },
   {
    "id": "logic",
    "name": "逻辑",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "逻辑",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "prose",
    "name": "文笔",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "文笔",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "pacing",
    "name": "节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "节奏"
    ]
   },
   {
    "id": "emotion",
    "name": "情感",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "情感"
    ]
   },
   {
    "id": "depth",
    "name": "深度",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "深度",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   }
  ],
  "baseAttributes": {
   "suspense": 15,
   "logic": 15,
   "prose": 10,
   "pacing": 10,
   "emotion": 10,
   "depth": 10
  },
  "fingerprint": "suspense|悬念,logic|逻辑,prose|文笔,pacing|节奏,emotion|情感,depth|深度"
 },
 "quanqiubingfeng": {
  "name": "全球冰封",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体能",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体能",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "agility",
    "name": "身手",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "身手",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "mind",
    "name": "心智",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心智",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "grit",
    "name": "狠劲",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "狠劲",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 12,
   "agility": 10,
   "mind": 12,
   "grit": 10,
   "fortune": 8,
   "connections": 8
  },
  "fingerprint": "body|体能,agility|身手,mind|心智,grit|狠劲,fortune|气运,connections|人脉"
 },
 "quanzhifashi": {
  "name": "全职法师",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "法体",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "法体"
    ]
   },
   {
    "id": "psyche",
    "name": "魔能",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "魔能"
    ]
   },
   {
    "id": "comprehension",
    "name": "法悟",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "法悟"
    ]
   },
   {
    "id": "will",
    "name": "法心",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "法心"
    ]
   },
   {
    "id": "fortune",
    "name": "命运",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "命运"
    ]
   },
   {
    "id": "connections",
    "name": "法师塔",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "法师塔"
    ]
   }
  ],
  "baseAttributes": {
   "body": 13,
   "psyche": 15,
   "comprehension": 11,
   "will": 12,
   "fortune": 10,
   "connections": 5
  },
  "fingerprint": "body|法体,psyche|魔能,comprehension|法悟,will|法心,fortune|命运,connections|法师塔"
 },
 "quanzhigaoshou": {
  "name": "全职高手",
  "mode": "roleplay",
  "axes": [
   {
    "id": "apm",
    "name": "手速",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "手速"
    ]
   },
   {
    "id": "sense",
    "name": "意识",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "意识"
    ]
   },
   {
    "id": "mind",
    "name": "心态",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心态",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "talent",
    "name": "天赋",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "天赋"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "fame",
    "name": "名气",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "名气",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "apm": 15,
   "sense": 15,
   "mind": 10,
   "talent": 10,
   "ties": 10,
   "fame": 10
  },
  "fingerprint": "apm|手速,sense|意识,mind|心态,talent|天赋,ties|人脉,fame|名气"
 },
 "scifi": {
  "name": "科幻创作",
  "mode": "creation",
  "axes": [
   {
    "id": "imagination",
    "name": "想象",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "想象"
    ]
   },
   {
    "id": "logic",
    "name": "逻辑",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "逻辑",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "prose",
    "name": "文笔",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "文笔",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "pacing",
    "name": "节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "节奏"
    ]
   },
   {
    "id": "emotion",
    "name": "情感",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "情感"
    ]
   },
   {
    "id": "philosophy",
    "name": "哲思",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "哲思"
    ]
   }
  ],
  "baseAttributes": {
   "imagination": 15,
   "logic": 15,
   "prose": 10,
   "pacing": 10,
   "emotion": 10,
   "philosophy": 10
  },
  "fingerprint": "imagination|想象,logic|逻辑,prose|文笔,pacing|节奏,emotion|情感,philosophy|哲思"
 },
 "shengxu": {
  "name": "圣墟",
  "mode": "roleplay",
  "axes": [
   {
    "id": "strength",
    "name": "力量",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "力量",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "spirit",
    "name": "神魂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "神魂"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "will",
    "name": "心志",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "心志"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "strength": 10,
   "constitution": 10,
   "spirit": 10,
   "comprehension": 10,
   "will": 10,
   "fortune": 8
  },
  "fingerprint": "strength|力量,constitution|体魄,spirit|神魂,comprehension|悟性,will|心志,fortune|气运"
 },
 "shenmifusu": {
  "name": "神秘复苏",
  "mode": "roleplay",
  "axes": [
   {
    "id": "strength",
    "name": "力量",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "力量",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "spirit",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "insight",
    "name": "洞察",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "洞察",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "nerve",
    "name": "胆识",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "胆识",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "strength": 10,
   "constitution": 10,
   "spirit": 10,
   "insight": 10,
   "nerve": 10,
   "fortune": 8
  },
  "fingerprint": "strength|力量,constitution|体魄,spirit|精神,insight|洞察,nerve|胆识,fortune|气运"
 },
 "shrouding": {
  "name": "遮天",
  "mode": "roleplay",
  "axes": [
   {
    "id": "aptitude",
    "name": "资质",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "资质",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "foundation",
    "name": "底蕴",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "底蕴"
    ]
   },
   {
    "id": "reputation",
    "name": "声望",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "声望",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "aptitude": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "foundation": 10,
   "reputation": 10
  },
  "fingerprint": "aptitude|资质,comprehension|悟性,fortune|气运,temperament|心性,foundation|底蕴,reputation|声望"
 },
 "swallowedstar": {
  "name": "吞噬星空",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "psyche",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "will",
    "name": "意志",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "意志",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "psyche": 15,
   "comprehension": 10,
   "will": 10,
   "fortune": 10,
   "connections": 10
  },
  "fingerprint": "body|根骨,psyche|精神,comprehension|悟性,will|意志,fortune|气运,connections|人脉"
 },
 "wangyou": {
  "name": "寰宇纪元",
  "mode": "roleplay",
  "axes": [
   {
    "id": "tension",
    "name": "战张力",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "战张力"
    ]
   },
   {
    "id": "emotion",
    "name": "羁绊",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "羁绊"
    ]
   },
   {
    "id": "prose",
    "name": "叙笔",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "叙笔"
    ]
   },
   {
    "id": "pacing",
    "name": "团战节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "团战节奏"
    ]
   },
   {
    "id": "creativity",
    "name": "配装创意",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "配装创意",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "depth",
    "name": "副本深度",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "副本深度",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   }
  ],
  "baseAttributes": {
   "tension": 15,
   "emotion": 15,
   "prose": 10,
   "pacing": 10,
   "creativity": 10,
   "depth": 10
  },
  "fingerprint": "tension|战张力,emotion|羁绊,prose|叙笔,pacing|团战节奏,creativity|配装创意,depth|副本深度"
 },
 "wanmeishijie": {
  "name": "完美世界",
  "mode": "roleplay",
  "axes": [
   {
    "id": "aptitude",
    "name": "资质",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "资质",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "foundation",
    "name": "底蕴",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "底蕴"
    ]
   },
   {
    "id": "reputation",
    "name": "名望",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "名望",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "aptitude": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "foundation": 10,
   "reputation": 10
  },
  "fingerprint": "aptitude|资质,comprehension|悟性,fortune|气运,temperament|心性,foundation|底蕴,reputation|名望"
 },
 "wanxiangzhiwang": {
  "name": "万相之王",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "相宫根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "相宫根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "灵性",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "灵性",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "soul": 10,
   "ties": 10
  },
  "fingerprint": "body|相宫根骨,comprehension|悟性,fortune|气运,temperament|心性,soul|灵性,ties|人脉"
 },
 "wudongqiankun": {
  "name": "武动乾坤",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "精神",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "精神",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "soul": 10,
   "ties": 10
  },
  "fingerprint": "body|根骨,comprehension|悟性,fortune|气运,temperament|心性,soul|精神,ties|人脉"
 },
 "wulianfengdian": {
  "name": "武炼巅峰",
  "mode": "roleplay",
  "axes": [
   {
    "id": "strength",
    "name": "力量",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "力量",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "meridian",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "will",
    "name": "心志",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "心志"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "strength": 10,
   "constitution": 10,
   "meridian": 10,
   "comprehension": 10,
   "will": 10,
   "fortune": 8
  },
  "fingerprint": "strength|力量,constitution|体魄,meridian|根骨,comprehension|悟性,will|心志,fortune|气运"
 },
 "wuxia": {
  "name": "武侠创作",
  "mode": "creation",
  "axes": [
   {
    "id": "martial",
    "name": "武戏",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "武戏",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "sentiment",
    "name": "文戏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "文戏"
    ]
   },
   {
    "id": "prose",
    "name": "文笔",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "文笔",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "pacing",
    "name": "节奏",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "节奏"
    ]
   },
   {
    "id": "chivalry",
    "name": "侠义",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "侠义"
    ]
   },
   {
    "id": "theme",
    "name": "立意",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "立意",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   }
  ],
  "baseAttributes": {
   "martial": 15,
   "sentiment": 15,
   "prose": 10,
   "pacing": 10,
   "chivalry": 10,
   "theme": 10
  },
  "fingerprint": "martial|武戏,sentiment|文戏,prose|文笔,pacing|节奏,chivalry|侠义,theme|立意"
 },
 "xianni": {
  "name": "仙逆",
  "mode": "roleplay",
  "axes": [
   {
    "id": "root",
    "name": "资质",
    "dpp": 18,
    "cap": 26,
    "bias": "修炼进度快、功法武技学得快、举一反三融会贯通",
    "kw": [
     "资质",
     "资质",
     "悟性",
     "修炼",
     "学习",
     "学识",
     "文笔",
     "创意"
    ]
   },
   {
    "id": "spirit",
    "name": "神识",
    "dpp": 30,
    "cap": 19,
    "bias": "危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优",
    "kw": [
     "神识",
     "神识",
     "感知",
     "精神",
     "洞察",
     "灵觉",
     "直觉",
     "灵感"
    ]
   },
   {
    "id": "constitution",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "daoHeart",
    "name": "道心",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "道心",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "killing",
    "name": "杀伐",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "杀伐"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "root": 10,
   "spirit": 10,
   "constitution": 10,
   "daoHeart": 10,
   "killing": 8,
   "fortune": 10
  },
  "fingerprint": "root|资质,spirit|神识,constitution|体魄,daoHeart|道心,killing|杀伐,fortune|气运"
 },
 "xuanjianxianzu": {
  "name": "玄鉴仙族",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体魄",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体魄",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "mind",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "alchem",
    "name": "炼丹",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "炼丹"
    ]
   },
   {
    "id": "combat",
    "name": "战力",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "战力",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "business",
    "name": "经营",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "经营"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 10,
   "mind": 14,
   "alchem": 12,
   "combat": 8,
   "business": 14,
   "fortune": 8
  },
  "fingerprint": "body|体魄,mind|心性,alchem|炼丹,combat|战力,business|经营,fortune|气运"
 },
 "yuanzun": {
  "name": "元尊",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "悟性",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "悟性",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "心性",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心性",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "神魂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "神魂"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 15,
   "comprehension": 15,
   "fortune": 10,
   "temperament": 10,
   "soul": 10,
   "ties": 10
  },
  "fingerprint": "body|根骨,comprehension|悟性,fortune|气运,temperament|心性,soul|神魂,ties|人脉"
 },
 "zhanhen": {
  "name": "我在精神病院学斩神",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "体能",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "体能",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "agility",
    "name": "身手",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "身手",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "mind",
    "name": "心智",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "心智",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "grit",
    "name": "胆魄",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "胆魄",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "fortune",
    "name": "气运",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "气运",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "connections",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 10,
   "agility": 12,
   "mind": 14,
   "grit": 12,
   "fortune": 8,
   "connections": 6
  },
  "fingerprint": "body|体能,agility|身手,mind|心智,grit|胆魄,fortune|气运,connections|人脉"
 },
 "zhongshengdushi": {
  "name": "重生之都市修仙",
  "mode": "roleplay",
  "axes": [
   {
    "id": "body",
    "name": "根骨",
    "dpp": 40,
    "cap": 18,
    "bias": "对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风",
    "kw": [
     "根骨",
     "力量",
     "体魄",
     "体质",
     "根骨",
     "体能",
     "身手",
     "体术"
    ]
   },
   {
    "id": "comprehension",
    "name": "灵慧",
    "dpp": 90,
    "cap": 11,
    "bias": "谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步",
    "kw": [
     "灵慧",
     "悟性",
     "智计",
     "智慧",
     "谋略",
     "算计",
     "逻辑",
     "机变"
    ]
   },
   {
    "id": "fortune",
    "name": "机缘",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "机缘",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   },
   {
    "id": "temperament",
    "name": "道心",
    "dpp": 70,
    "cap": 13,
    "bias": "抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱",
    "kw": [
     "道心",
     "心性",
     "意志",
     "道心",
     "胆魄",
     "心智",
     "狠劲",
     "心态"
    ]
   },
   {
    "id": "soul",
    "name": "神魂",
    "dpp": 50,
    "cap": 15,
    "bias": "该维度主导的同类行动天然占优",
    "kw": [
     "神魂"
    ]
   },
   {
    "id": "ties",
    "name": "人脉",
    "dpp": 300,
    "cap": 5,
    "bias": "机缘造遇频度高、险中得宝、贵人相助、绝处逢生",
    "kw": [
     "人脉",
     "气运",
     "运道",
     "机缘",
     "福缘",
     "幸运",
     "人脉",
     "声望"
    ]
   }
  ],
  "baseAttributes": {
   "body": 12,
   "comprehension": 14,
   "fortune": 12,
   "temperament": 14,
   "soul": 12,
   "ties": 12
  },
  "fingerprint": "body|根骨,comprehension|灵慧,fortune|机缘,temperament|道心,soul|神魂,ties|人脉"
 }
};
var FP_MAP = {};
Object.keys(REGISTRY).forEach(function(id){ FP_MAP[REGISTRY[id].fingerprint] = id; });

function configOf(cfg){
  cfg = cfg || (window.GenreStoryConfig || {});
  return cfg;
}
function fingerprintOf(cfg){
  cfg = configOf(cfg);
  if (!cfg || !Array.isArray(cfg.statKeys) || !cfg.statKeys.length) return '';
  /* key|label 联合指纹：多世界共用同一套 key（body/comprehension...），仅 label 区分 */
  return cfg.statKeys.map(function(k){ return k.key + '|' + (k.label||''); }).join(',');
}
function current(){
  var fp = fingerprintOf();
  var id = FP_MAP[fp];
  return id ? REGISTRY[id] : null;
}
/* 动态发现：新世界只要有 statKeys，即使未重跑生成器也能即时生成维度档 */
function derive(cfg){
  cfg = configOf(cfg);
  if (!cfg || !Array.isArray(cfg.statKeys)) return null;
  var ARCH = [{"id":"body","dpp":40,"cap":18,"bias":"对抗、劳作、承伤、炼体一类行动天然占优，正面硬拼不落下风","kw":["力量","体魄","体质","根骨","体能","身手","体术","战力","武戏","气血","肉身","strength","body","constitution"]},{"id":"sense","dpp":30,"cap":19,"bias":"危险预感、搜寻踪迹、识破隐匿、斗法先知先觉一类判定占优","kw":["神识","感知","精神","洞察","灵觉","直觉","灵感","灵性","sense","perception","spirit"]},{"id":"mind","dpp":70,"cap":13,"bias":"抵抗诱惑、幻术、恐惧与心魔，苦熬瓶颈不崩、绝境不乱","kw":["心性","意志","道心","胆魄","心智","狠劲","心态","胆识","坚韧","will","mind"]},{"id":"wit","dpp":90,"cap":11,"bias":"谋划布局、辩才谈判、破译推演占优，能想他人想不到的一步","kw":["悟性","智计","智慧","谋略","算计","逻辑","机变","言辞","口才","灵慧","wit","intellect","logic"]},{"id":"learn","dpp":18,"cap":26,"bias":"修炼进度快、功法武技学得快、举一反三融会贯通","kw":["资质","悟性","修炼","学习","学识","文笔","创意","深度","立意","root","aptitude","learn"]},{"id":"luck","dpp":300,"cap":5,"bias":"机缘造遇频度高、险中得宝、贵人相助、绝处逢生","kw":["气运","运道","机缘","福缘","幸运","人脉","声望","名气","名望","人缘","缘分","fortune","luck","charm"]}];
  var axes = cfg.statKeys.map(function(s){
    var key = s.key, label = s.label || key, l = String(label).toLowerCase(), a = {id:'generic',dpp:50,cap:15,bias:'该维度主导的同类行动天然占优',kw:[]};
    outer: for (var i=0;i<ARCH.length;i++) for (var j=0;j<ARCH[i].kw.length;j++)
      if (l.indexOf(ARCH[i].kw[j].toLowerCase())>=0){ a=ARCH[i]; break outer; }
    return {id:key,name:label,dpp:a.dpp,cap:a.cap,bias:a.bias,kw:[label].concat(a.kw.slice(0,6))};
  });
  return {name:'新世界',mode:cfg.mode||'roleplay',axes:axes,baseAttributes:cfg.baseAttributes||{},fingerprint:fingerprintOf(cfg),derived:true};
}
function currentAxes(){
  var r = current();
  if (r && r.axes && r.axes.length) return r.axes;
  var d = derive();
  return d && d.axes && d.axes.length ? d.axes : null;
}
function axesFor(cfg){
  var r = current(); if (r && r.axes && r.axes.length) return r.axes;
  var fp = fingerprintOf(cfg); var id = FP_MAP[fp];
  if (id) return REGISTRY[id].axes;
  var d = derive(cfg); return d ? d.axes : null;
}
window.WorldRules = {
  version: '1.0.0', worldCount: Object.keys(REGISTRY).length,
  REGISTRY: REGISTRY, current: current, currentAxes: currentAxes,
  axesFor: axesFor, fingerprintOf: fingerprintOf, derive: derive
};
})();
