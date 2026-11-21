# -*- coding: utf-8 -*-
"""测试脚本共用路径解析（v5.1.1 修 P2-3）。

此前多个脚本把仓库写死成 /workspace/yunjing、把产物写死成 /tmp：
换一台机器（Windows / 别的目录 / CI 的 runner）就直接 FileNotFoundError，
脚本连「跑不起来」都谈不上，CI 里也只能整段跳过。

现在统一：
  · 仓库根 = 由本文件位置推导（__file__ 上溯两级），永远跟着仓库走；
  · 产物目录 = yunjing-test/out/（可用环境变量 YJ_OUT_DIR 覆盖）；
  · 界清单 = 直接扫 js/kb/*.core.js，不再依赖任何绝对路径。"""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT_DIR = os.environ.get('YJ_OUT_DIR') or os.path.join(ROOT, 'yunjing-test', 'out')

def genres():
    """从仓库里的 js/kb/*.core.js 推出界清单。"""
    import glob
    return sorted(os.path.basename(f)[:-len('.core.js')] for f in glob.glob(os.path.join(ROOT, 'js', 'kb', '*.core.js')))

def kb_index():
    return os.path.join(ROOT, 'js', 'kb', '_index.json')

def out_path(name):
    """产物输出路径（自动建目录），返回绝对路径。"""
    os.makedirs(OUT_DIR, exist_ok=True)
    return os.path.join(OUT_DIR, name)

def out_glob(pattern):
    """在产物目录里按通配符找文件。"""
    import glob
    return sorted(glob.glob(os.path.join(OUT_DIR, pattern)))
