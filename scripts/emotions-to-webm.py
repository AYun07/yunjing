#!/usr/bin/env python3
"""把情绪动作的绿幕 MP4 批量转成透明 WebM（供前端叠加，无绿边）。
用法：python3.11 scripts/emotions-to-webm.py [--form aojiao] [--all]
"""
import os, sys, glob, subprocess, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS = os.path.join(ROOT, "assets", "videos")


def to_webm(mp4, force=False):
    webm = mp4[:-4] + ".webm"
    if not force and os.path.exists(webm) and os.path.getsize(webm) > 50000:
        return webm, "skip"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", mp4,
           "-an",  # 去音轨：带 opus 音轨的 WebM 在部分 headless 浏览器触发 MEDIA_ERR_SRC_NOT_SUPPORTED
           "-vf", "chromakey=0x00FF00:0.15:0.05,format=yuva420p",
           "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8",
           "-auto-alt-ref", "0", "-pix_fmt", "yuva420p",
           "-metadata:s:v:0", "alpha_mode=1", webm]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(webm):
        return None, r.stderr[:200]
    return webm, f"{os.path.getsize(webm)//1024}KB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--form", default="aojiao")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true", help="强制重转（覆盖旧WebM）")
    args = ap.parse_args()
    if args.all:
        pattern = "xiaoyun-*-emo-*.mp4"
    else:
        pattern = f"xiaoyun-{args.form}-emo-*.mp4"
    files = sorted(glob.glob(os.path.join(VIDEOS, pattern)))
    print(f"待转换 {len(files)} 条")
    ok = 0
    for f in files:
        out, info = to_webm(f, args.force)
        if out:
            ok += 1; print(f"  ✅ {os.path.basename(out)}  {info}")
        else:
            print(f"  ❌ {os.path.basename(f)}  {info}")
    print(f"=== 转换完成 {ok}/{len(files)} ===")


if __name__ == "__main__":
    main()
