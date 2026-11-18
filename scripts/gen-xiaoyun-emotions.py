#!/usr/bin/env python3
"""小云 · 情绪动作视频生成（垂直切片：傲娇形态）
复用 gen-xiaoyun-videos.py 已攻破的取片链路（agnesapi→构造直链→裸GET下载），
只替换：情绪动作清单、prompt、参考图、输出路径。不改动已验证的 60 条管线。

用法：
  export AGNES_API_KEY='...'
  python3.11 scripts/gen-xiaoyun-emotions.py --form aojiao          # 单形态8条
  python3.11 scripts/gen-xiaoyun-emotions.py --all                   # 全12形态（后续）
  python3.11 scripts/gen-xiaoyun-emotions.py --status                # 查看进度
"""
import os, sys, json, time, base64, io, argparse
from datetime import datetime
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")
VIDEOS = os.path.join(ASSETS, "videos")
STATE = os.path.join(ROOT, ".codebuddy", "xiaoyun-emotion-state.json")

# ---- 复用原脚本已验证的底层（网络/backoff/取片）----
_spec = importlib.util.spec_from_file_location("basepipe", os.path.join(HERE, "gen-xiaoyun-videos.py"))
B = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(B)

# ---- 情绪动作清单（8 条，傲娇垂直切片）----
EMOTIONS = ["cheer", "angry", "pout", "shy", "surprised", "think", "sleep", "proud"]
EMOTION_CN = {"cheer": "欢呼", "angry": "生气", "pout": "撇嘴傲娇", "shy": "害羞",
              "surprised": "惊讶", "think": "思考", "sleep": "困倦", "proud": "得意"}

# 每个情绪 = 可见的物理动作信号 + 表情（关键：不能用抽象形容词，模型出不来）
EMOTION_MOTION = {
    "cheer":     "She raises BOTH arms high overhead in a joyful cheer, bounces once, wide happy smile, hair and skirt flare.",
    "angry":     "She furrows her brows into an angry frown, clenches both fists and stamps one foot, cheeks puffed with irritation, glaring.",
    "pout":      "She folds both arms across her chest, turns her face slightly aside with a classic tsundere pout, puffed cheeks and averted eyes.",
    "shy":       "She raises both hands to cover her flushed cheeks, looks down shyly, obvious red blush on both cheeks, shoulders hunched.",
    "surprised": "She leans back in surprise, one hand raised to her open mouth, eyes wide open, hair bobbing from the sudden startle.",
    "think":     "She rests one hand under her chin, tilts her head slightly and looks upward, thoughtful pondering expression, the other hand on her hip.",
    "sleep":     "She opens her mouth in a yawn and rubs one eye with her hand, body slumping slightly, eyelids heavy and sleepy.",
    "proud":     "She puts both hands on her hips, tilts her chin up with a smug confident grin, self-satisfied proud expression.",
}

FORMS = ["aojiao"]  # 垂直切片只做傲娇；--all 时扩展到全部
ALL_FORMS = ["luo", "yu", "jiaohua", "qingchun", "linjia", "kusa",
             "wenrou", "aojiao", "keai", "gaoguai", "youtai", "zhixing"]

BY_VIEW = ("chibi", "face")


def src_png(form):
    # 情绪动作统一用 happy 全身立绘作参考（锁身份、锁全身构图）
    return os.path.join(ASSETS, f"xiaoyun-{form}-happy.png")


def out_mp4(form, emo):
    return os.path.join(VIDEOS, f"xiaoyun-{form}-emo-{emo}.mp4")


def key_of(form, emo):
    return f"{form}/{emo}"


def make_reference(form):
    from PIL import Image
    im = Image.open(src_png(form)).convert("RGBA")
    W, H = 576, 1024  # 全身竖版
    maxw, maxh = int(W * 0.82), int(H * 0.86)
    r = min(maxw / im.width, maxh / im.height)
    nw, nh = max(256, round(im.width * r)), max(256, round(im.height * r))
    if min(nw, nh) < 256:
        s = 256 / min(nw, nh); nw, nh = round(nw * s), round(nh * s)
    im = im.resize((nw, nh), Image.LANCZOS)
    bg = Image.new("RGBA", (W, H), (0, 255, 0, 255))
    bg.alpha_composite(im, ((W - nw) // 2, (H - nh) // 2))
    buf = io.BytesIO(); bg.convert("RGB").save(buf, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build_prompt(form, emo):
    return ("Animate the EXACT anime girl shown in the reference image into a short looping clip. "
            f"Keep her identical: {B.HAIR[form]}, big bright blue eyes, silver-white hair, "
            f"small white cloud hair ornaments, wearing {B.OUTFIT[form]}. "
            f"Her signature personality: {B.EXPR[form]}. "
            f"NOW SHOW THIS SPECIFIC ACTION AND EXPRESSION: {EMOTION_MOTION[emo]} "
            "full body visible head to feet. "
            f"{B.BG_GREEN} {B.STYLE}")


def log(*a):
    print(f"[{datetime.now().strftime('%H:%M:%S')}]", *a, flush=True)


def load_state():
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    if os.path.exists(STATE):
        try: return json.load(open(STATE))
        except Exception: return {}
    return {}


def save_state(st):
    json.dump(st, open(STATE, "w"), ensure_ascii=False, indent=1)


def done_on_disk(form, emo):
    p = out_mp4(form, emo)
    return os.path.exists(p) and os.path.getsize(p) > 50000


def run(form, emo, st, submit_gap=12):
    dest = out_mp4(form, emo)
    if done_on_disk(form, emo):
        log(f"[{form}/{emo}] 已存在，跳过"); return True
    ref = make_reference(form)
    body = {"model": B.MODEL, "mode": "reference", "prompt": build_prompt(form, emo),
            "images": [ref], "aspect_ratio": "9:16", "n": 1}
    last = [0.0]
    gap = time.time() - last[0]
    if gap < submit_gap: time.sleep(submit_gap - gap)
    r, err = B.request_with_backoff("POST", B.BASE + B.GEN_PATH,
                                    tag=f"submit {form}/{emo}", json_body=body,
                                    timeout=90, retries=8, base_wait=15)
    if err:
        log(f"[{form}/{emo}] 提交失败: {err}"); return False
    j = r.json(); tid = j.get("id") or j.get("task_id"); vid = j.get("video_id")
    if not tid:
        log(f"[{form}/{emo}] 无 task_id: {str(j)[:200]}"); return False
    log(f"[{form}/{emo}] 已提交 task={tid}")
    st[key_of(form, emo)] = {"status": "submitted", "task_id": tid, "video_id": vid,
                             "at": datetime.now().isoformat()}; save_state(st)
    # 用 agnesapi 等到 completed 并拿直链
    status, direct, reason = B.poll_agnesapi(vid, max_sec=400, interval=20) if vid else ("NO_VID", None, "无video_id")
    if status == "SUCCESS":
        ok, info = B.download_direct(direct, dest)
        if ok:
            st[key_of(form, emo)] = {"status": "downloaded", "task_id": tid, "video_id": vid,
                                     "file": os.path.basename(dest), "size": info,
                                     "at": datetime.now().isoformat()}; save_state(st)
            log(f"[{form}/{emo}] ✅ 完成 {info}"); return True
        # direct 401 时现场构造直链再试
        built = B.video_id_to_direct(vid)
        if built and built != direct:
            ok, info = B.download_direct(built, dest)
            if ok:
                st[key_of(form, emo)] = {"status": "downloaded", "task_id": tid, "video_id": vid,
                                         "file": os.path.basename(dest), "size": info,
                                         "at": datetime.now().isoformat()}; save_state(st)
                log(f"[{form}/{emo}] ✅ 完成(构造直链) {info}"); return True
    # 兜底：fetch_video 现场解析
    ok, info, _ = B.fetch_video(tid, vid, dest, retries=4)
    if ok:
        st[key_of(form, emo)] = {"status": "downloaded", "task_id": tid, "video_id": vid,
                                 "file": os.path.basename(dest), "size": info,
                                 "at": datetime.now().isoformat()}; save_state(st)
        log(f"[{form}/{emo}] ✅ 完成(兜底) {info}"); return True
    st[key_of(form, emo)] = {"status": "failed", "task_id": tid, "video_id": vid,
                             "reason": str(reason or info)[:200]}; save_state(st)
    log(f"[{form}/{emo}] ❌ 失败: {reason or info}"); return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--form", default="aojiao")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--submit-gap", type=float, default=12)
    args = ap.parse_args()

    st = load_state()
    if args.status:
        from collections import Counter
        c = Counter(v.get("status") for v in st.values())
        print("情绪动作状态:", dict(c))
        for k, v in st.items():
            print(" ", k, v.get("status"), v.get("size", ""))
        n = sum(1 for f in (ALL_FORMS if args.all else FORMS) for e in EMOTIONS if done_on_disk(f, e))
        print("磁盘成品:", n, "条")
        return

    forms = ALL_FORMS if args.all else [args.form]
    jobs = [(f, e) for f in forms for e in EMOTIONS]
    todo = [(f, e) for f, e in jobs if not done_on_disk(f, e)]
    log(f"待生成 {len(todo)} 条（情绪动作）")
    ok = 0
    for f, e in todo:
        if run(f, e, st, args.submit_gap): ok += 1
    log(f"=== 完成 {ok}/{len(todo)}，磁盘共 {sum(1 for f in forms for e in EMOTIONS if done_on_disk(f,e))} 条 ===")


if __name__ == "__main__":
    main()
