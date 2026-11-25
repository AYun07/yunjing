#!/bin/bash
# v6.3.9 改名回退脚本：把原著真名改回旧避讳名（仅在需要回退时运行，从项目根目录执行）
set -e
RENAME_FILE="js/world-rules.js js/atlas-verified-all.js 世界地图一览图-原著对照.html js/atlas-verified/dibao.js js/atlas-verified/ditandali.js js/atlas-verified/guzhenren.js js/atlas-verified/quanzhifashi.js js/atlas-verified/wanxiangzhiwang.js js/atlas-verified/fanrenxiuxian.js js/atlas-verified/zhanhen.js js/atlas-verified/zhongshengdushi.js js/atlas-verified/wangyou.js"
python3 - <<'PY'
import re
# 新名→旧名（反向）
BACK={'帝霸':'盗墓','开局地摊卖大力':'大地铁犁','蛊真人':'古真人','全职法师':'全知法师',
 '万相之王':'万象之王','凡人修仙传':'凡人修仙','我在精神病院学斩神':'战痕',
 '重生之都市修仙':'重生都市','寰宇纪元':'网游创作'}
files=['js/world-rules.js','js/atlas-verified-all.js','世界地图一览图-原著对照.html']
import glob
files+=glob.glob('js/atlas-verified/*.js')
for p in files:
    try: s=open(p,encoding='utf-8').read()
    except: continue
    o=s
    for new,old in BACK.items():
        s=s.replace('"name": "'+new+'"','"name": "'+old+'"')       # world-rules JSON
        s=s.replace("name: '"+new+"'","name: '"+old+"'")           # realm-ladders
        s=re.sub(r'(name\s*:\s*)"'+re.escape(new)+r'"', lambda m:m.group(1)+'"'+old+'"', s)  # atlas/all
        s=s.replace('<b>'+new+'</b>','<b>'+old+'</b>')             # HTML 卡片
    if s!=o: open(p,'w',encoding='utf-8').write(s); print('回退',p)
PY
# 还原 realm 相关文件
cp _bak_v638/realm-ladders.mjs scripts/realm-ladders.mjs
cp _bak_v638/realm-rules.js js/realm-rules.js
cp _bak_v638/compare-engine.js js/compare-engine.js
cp _bak_v638/compare-panel.js js/compare-panel.js
cp _bak_v638/gen-realm-rules.mjs scripts/gen-realm-rules.mjs
echo "注意：还需手动把 studio.html / sw.js / opening.html / map-verified.html 的版本号 6.3.9 改回 6.3.8"
