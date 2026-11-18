#!/usr/bin/env python3.11
# -*- coding: utf-8 -*-
"""
云境 · 小云动态视频（本地合成备用管线）
背景：agnes-video 的 /content 下载端点上游 litellm 服务池不可用（CF 502），
      原生 AI 视频暂无法落地。本管线用同一批精修立绘在真浏览器外合成
      真正的 MP4 视频文件，保证「每个形象 / 每个动作都是动态视频」可交付。
产物：assets/videos-local/xiaoyun-{form}-{view}.mp4
      assets/videos-local/xiaoyun-{view}-{form}.mp4  (chibi/face 命名同源)
纪律：· 不改动原生 agensvideo 管线与断点状态
      · 每条动作独立运动曲线 + 独立粒子层，5 个动作肉眼可区分
      · 绿幕版与展示版分离：展示版用于看效果，绿幕版用于云境前端抠像接入
"""
import os, sys, math, subprocess, shutil, argparse
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "videos-local")
TMP = os.path.join(ROOT, ".codebuddy", "xy-local-frames")

FORMS = ["luo", "yu", "jiaohua", "qingchun", "linjia", "kusa",
         "wenrou", "aojiao", "keai", "gaoguai", "youtai", "zhixing"]
VIEWS = ["happy", "wave", "battle", "chibi", "face"]
W, H = 576, 1024
FPS, SECONDS = 30, 2.4
NFRAMES = int(FPS * SECONDS)

# 每个动作的独立运动参数：(飘动幅度, 弹跳幅度, 呼吸幅度, 抖动幅度, 相位速度)
MOTION = {
    "happy":  dict(sway=7.0,  bounce=15.0, breath=0.022, shake=0.0, speed=1.0,  zoom=0.000),
    "wave":   dict(sway=17.0, bounce=3.0,  breath=0.010, shake=0.0, speed=1.0,  zoom=0.000),
    "battle": dict(sway=3.0,  bounce=2.0,  breath=0.006, shake=5.0, speed=2.0,  zoom=0.000),
    "chibi":  dict(sway=11.0, bounce=7.0,  breath=0.016, shake=0.0, speed=0.75, zoom=0.000),
    "face":   dict(sway=2.5,  bounce=1.0,  breath=0.008, shake=0.0, speed=0.6,  zoom=0.030),
}


def src_png(form, view):
    name = f"xiaoyun-{view}-{form}.png" if view in ("chibi", "face") else f"xiaoyun-{form}-{view}.png"
    return os.path.join(ASSETS, name)


def out_path(form, view, ext=".mp4"):
    name = f"xiaoyun-{view}-{form}{ext}" if view in ("chibi", "face") else f"xiaoyun-{form}-{view}{ext}"
    return os.path.join(OUT, name)


def make_bg():
    """柔和云境风格渐变背景（展示版）。"""
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top = np.array([238, 242, 255], dtype=np.float32)
    bot = np.array([205, 222, 252], dtype=np.float32)
    grad = top[None, None, :] * (1 - yy) + bot[None, None, :] * yy
    bg = np.repeat(grad, W, axis=1).astype(np.uint8)
    im = Image.fromarray(bg, "RGB")
    # 柔光斑
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, a in [(110, 210, 190, 46), (470, 430, 230, 38), (290, 820, 260, 30)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, a))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
    return im


def load_char(form, view):
    im = Image.open(src_png(form, view)).convert("RGBA")
    # contain 到画布 82% 宽 / 86% 高
    maxw, maxh = int(W * 0.82), int(H * 0.86)
    r = min(maxw / im.width, maxh / im.height)
    nw, nh = max(1, round(im.width * r)), max(1, round(im.height * r))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((W - nw) // 2, (H - nh) // 2))
    return canvas


def warp(char_rgba, t, p, view):
    """网格形变：呼吸缩放 + 分段飘动 + 弹跳 + 战斗抖动。返回 RGBA。"""
    a = np.asarray(char_rgba, dtype=np.uint8)
    ph = 2 * math.pi * t * p["speed"]
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    ny = Y / H
    # 分段飘动：越靠下（裙摆/腿）摆幅越大
    sway = p["sway"] * np.sin(ph + ny * 2.6) * (ny ** 1.15)
    # 挥手动作：右上区域（手臂）额外相位摆动
    if view == "wave":
        right = np.clip((X / W - 0.52) / 0.48, 0, 1) ** 1.4
        sway += 13.0 * right * np.sin(ph * 1.6 + 0.9)
    # 战斗：高频小抖动 + 轻微前倾
    jitter = 0.0
    if p["shake"]:
        jitter = p["shake"] * np.sin(ph * 5.0)
        sway += 2.0 * np.sin(ph * 4.0) * ny
    bounce = p["bounce"] * np.sin(ph)
    scale = 1.0 + p["breath"] * np.sin(ph * 2.0) + p["zoom"] * (0.5 - 0.5 * math.cos(ph))
    # 目标像素 -> 源像素
    sx = (X - W / 2) / scale + W / 2 - sway - jitter
    sy = (Y - H / 2) / scale + H / 2 - bounce
    map_x = sx.astype(np.float32)
    map_y = sy.astype(np.float32)
    out = np.zeros_like(a)
    for c in range(4):
        out[:, :, c] = cv2.remap(
            a[:, :, c], map_x, map_y, cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    # 边缘轻微抗锯齿
    return Image.fromarray(out, "RGBA")


def draw_particles(d, t, view):
    """每个动作独立的粒子层。d 为 ImageDraw(RGBA)。"""
    ph = t * 2 * math.pi
    if view == "happy":
        for i in range(9):
            x = int(60 + i * 60 + 18 * math.sin(ph + i))
            y = int(H * (0.92 - ((t * 0.55 + i / 9) % 1)))
            r = 5 + i % 3
            d.ellipse([x - r, y - r, x + r, y + r],
                      fill=(255, 214, 92, 210))
    elif view == "wave":
        for i in range(7):
            x = int(W - 70 - i * 12 + 22 * math.sin(ph * 1.2 + i))
            y = int(300 + 70 * i - ((t * 90) % 90) + 12 * math.sin(ph + i))
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 150, 176, 175))
    elif view == "battle":
        cx, cy = W // 2, int(H * 0.55)
        rr = int(80 + 150 * ((t * 1.4) % 1))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  outline=(255, 255, 255, int(150 * (1 - (t * 1.4) % 1))), width=5)
        for i in range(10):
            y = int(60 + i * 90 + ((t * 380) % 90))
            d.line([(20, y), (110, y - 26)], fill=(255, 255, 255, 120), width=3)
    elif view == "chibi":
        for i in range(5):
            x = int(40 + i * 130 + 26 * math.sin(ph * 0.8 + i))
            y = int(120 + (i % 3) * 250 + 14 * math.sin(ph + i))
            d.ellipse([x - 26, y - 12, x + 26, y + 12], fill=(255, 255, 255, 95))
    elif view == "face":
        for i in range(12):
            x = int(50 + (i * 97) % 480 + 10 * math.sin(ph + i))
            y = int(80 + (i * 173) % 880 + 8 * math.cos(ph * 1.3 + i))
            r = 2 + i % 3
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 250, 220, 130))


def render(form, view, variant="show"):
    """variant='show' -> 渐变背景 H.264 MP4（给人看/下载）
       variant='alpha' -> 透明背景 VP9-alpha WebM（给云境前端叠加）"""
    alpha_mode = variant == "alpha"
    os.makedirs(TMP, exist_ok=True)
    for f in os.listdir(TMP):
        os.remove(os.path.join(TMP, f))
    bg = (Image.new("RGBA", (W, H), (0, 0, 0, 0)) if alpha_mode
          else make_bg().convert("RGBA"))
    char = load_char(form, view)
    p = MOTION[view]
    for i in range(NFRAMES):
        t = i / NFRAMES
        frame = bg.copy()
        frame.alpha_composite(warp(char, t, p, view))
        fx = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_particles(ImageDraw.Draw(fx), t, view)
        frame.alpha_composite(fx)
        frame.save(os.path.join(TMP, f"f_{i:04d}.png")) if alpha_mode \
            else frame.convert("RGB").save(os.path.join(TMP, f"f_{i:04d}.png"))
    ext = ".webm" if alpha_mode else ".mp4"
    dest = out_path(form, view, ext)
    os.makedirs(OUT, exist_ok=True)
    common = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
              "-i", os.path.join(TMP, "f_%04d.png")]
    if alpha_mode:
        cmd = common + ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                        "-b:v", "0", "-crf", "34", "-deadline", "realtime",
                        "-cpu-used", "8", "-auto-alt-ref", "0", dest]
    else:
        cmd = common + ["-c:v", "libopenh264", "-b:v", "2500k",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", dest]
    subprocess.run(cmd, check=True)
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--form", default="aojiao")
    ap.add_argument("--all", action="store_true", help="全量 12×5=60 条")
    ap.add_argument("--alpha", action="store_true", help="产出透明 WebM（前端叠加用）")
    ap.add_argument("--both", action="store_true", help="同时产出 MP4 与透明 WebM")
    args = ap.parse_args()
    forms = FORMS if args.all else [args.form]
    variants = ["show", "alpha"] if args.both else (["alpha"] if args.alpha else ["show"])
    total = len(forms) * len(VIEWS) * len(variants)
    n = 0
    for form in forms:
        for view in VIEWS:
            for v in variants:
                n += 1
                d = render(form, view, v)
                print(f"[{n}/{total}] {os.path.basename(d)}  {os.path.getsize(d)//1024}KB", flush=True)
    shutil.rmtree(TMP, ignore_errors=True)
    print("完成，输出目录:", OUT)


if __name__ == "__main__":
    main()
