#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""交付截图后处理：裁掉抽屉容器底部的纯色空白。

RPG 抽屉是固定高度的浮层，截图会把下方大块背景一起带进来。
做法：逐行比对像素，若某一行与上一行完全相同且整体接近纯色，则视为空白行，
从最后一条"内容行"往下裁掉。保留少量边距。
"""
import os, sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/云境-v4.07.2-截图"

def trim(path, pad=12):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    # 取左侧 6 列作为背景参考（抽屉左边缘通常是纯背景）
    def row_is_blank(y):
        # 整行与参考行几乎一致 → 空白
        ref = [px[x, y] for x in range(0, min(6, w))]
        for x in range(0, w, 2):
            c = px[x, y]
            if any(abs(c[i] - ref[0][i]) > 10 for i in range(3)):
                return False
        return True
    last = h - 1
    while last > 40 and row_is_blank(last):
        last -= 1
    new_h = min(h, last + 1 + pad)
    if new_h < h - 8:
        im.crop((0, 0, w, new_h)).save(path)
        return h, new_h
    return h, h

for name in sorted(os.listdir(OUT)):
    if not name.lower().endswith(".png"):
        continue
    p = os.path.join(OUT, name)
    try:
        oh, nh = trim(p)
        print("  %-34s %d → %d" % (name, oh, nh))
    except Exception as e:
        print("  %-34s 处理失败: %s" % (name, str(e)[:60]))
print("完成")
