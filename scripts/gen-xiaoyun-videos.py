#!/usr/bin/env python3.11
# -*- coding: utf-8 -*-
"""
云境 · 小云动态视频批量生成管线
模型: agnes-video-2.5-flash (apihub.agnes-ai.com)
方式: mode=reference 图生视频 —— 每张立绘作为参考图，锁定角色形象
产物: assets/videos/xiaoyun-{form}-{view}.mp4  (12 形态 × 5 动作 = 60 条)

纪律:
  · 密钥只从环境变量 AGNES_API_KEY 读取，绝不写入文件/日志
  · 严格并发与速率控制（免费额度 429 极紧）：默认并发 1，提交节流 + 指数退避
  · 断点续传：state.json 记录每条状态；任务已成功但下载失败时只补下载、不重新生成
  · 可重入：任何时候中断，重跑会从断点继续

用法:
  export AGNES_API_KEY=...
  python3.11 scripts/gen-xiaoyun-videos.py --probe          # 只探测 content 端点是否恢复
  python3.11 scripts/gen-xiaoyun-videos.py --one aojiao/happy   # 出 1 条样片
  python3.11 scripts/gen-xiaoyun-videos.py --all            # 全量 60 条（断点续传）
  python3.11 scripts/gen-xiaoyun-videos.py --download-only  # 只补下载已成功的任务
  python3.11 scripts/gen-xiaoyun-videos.py --watch          # 守护：端点恢复后自动跑 --all

可选:
  --concurrency N   并发上限（默认 1，最大建议 2）
  --submit-gap S    两次提交最小间隔秒数（默认 12）
  --recovery-gap S  --watch 下探测间隔（默认 60）
  --max-wait M      --watch 最多等待分钟（默认 0=不限）
"""
import os, sys, json, time, base64, io, argparse, urllib.parse
from datetime import datetime

# ---------------- 配置 ----------------
BASE = "https://apihub.agnes-ai.com"
MODEL = "agnes-video-2.5-flash"
GEN_PATH = "/v1/video/generations"
KEY = os.environ.get("AGNES_API_KEY", "")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
VIDEOS = os.path.join(ASSETS, "videos")
STATE = os.path.join(ROOT, ".codebuddy", "xiaoyun-video-state.json")
os.makedirs(VIDEOS, exist_ok=True)
os.makedirs(os.path.dirname(STATE), exist_ok=True)

FORMS = ["luo", "yu", "jiaohua", "qingchun", "linjia", "kusa",
         "wenrou", "aojiao", "keai", "gaoguai", "youtai", "zhixing"]
VIEWS = ["happy", "wave", "battle", "chibi", "face"]

FORM_CN = {"luo": "萝莉", "yu": "御姐", "jiaohua": "校花", "qingchun": "清纯",
           "linjia": "邻家", "kusa": "酷飒", "wenrou": "温柔", "aojiao": "傲娇",
           "keai": "可爱", "gaoguai": "搞怪", "youtai": "幼态", "zhixing": "知性"}
VIEW_CN = {"happy": "欢呼", "wave": "挥手", "battle": "战斗", "chibi": "Q版全身", "face": "头像特写"}

# 12 形态服装/发型识别词（与生图脚本同源，配合参考图锁定身份）
OUTFIT = {
    "luo": "cute pastel frilly dress with cloud motifs",
    "yu": "elegant champagne-gold off-shoulder long dress",
    "jiaohua": "academy school blazer with pleated skirt",
    "qingchun": "blue-and-white sailor school uniform",
    "linjia": "soft cozy casual home outfit holding a small white cat",
    "kusa": "black leather jacket and dark punk streetwear",
    "wenrou": "light lavender long dress",
    "aojiao": "blue-and-white frilled maid dress with blue ribbons and white thigh-high socks",
    "keai": "fluffy white cloud-themed hoodie",
    "gaoguai": "colorful playful patchwork outfit",
    "youtai": "fluffy soft fleece dress",
    "zhixing": "cream knit sweater and thin-frame round glasses",
}
HAIR = {
    "luo": "short fluffy bob with two tiny low pigtails and a curly ahoge",
    "yu": "long straight silky hair worn down with loose waves, no tails",
    "jiaohua": "sleek high ponytail with a ribbon headband",
    "qingchun": "two tidy braided twin pigtails with blue ribbons",
    "linjia": "soft low half-up hairstyle with side-swept bangs",
    "kusa": "sharp high single ponytail with choppy layered bangs",
    "wenrou": "hime-cut long straight hair with blunt cheek-length side locks",
    "aojiao": "big fluffy twin tails tied with red ribbons and cloud ornaments",
    "keai": "two round puffy buns high on the head with cloud hair clips",
    "gaoguai": "asymmetrical mismatched twin tails with colorful star clips",
    "youtai": "short bob with rounded inward curled ends and a tiny top ahoge",
    "zhixing": "neat low bun / tidy braided up-do with thin-frame round glasses",
}
EXPR = {
    "luo": "excited playful childlike joy, sparkling wide eyes, happy open laugh",
    "yu": "elegant confident poise, distinctly half-lidded eyes, faint smirk",
    "jiaohua": "bright confident school-queen, wide open eyes, clear teeth-showing smile",
    "qingchun": "shy and flustered, downward eyes, obvious red blush, pressed lips",
    "linjia": "eyes closed in happy crescent curves, warm smile, hugging the white cat",
    "kusa": "cool aloof rebellious, sharp narrowed eyes, one brow raised, no smile",
    "wenrou": "serene tender warmth, softly half-closed eyes, faint tiny smile",
    "aojiao": "classic tsundere pout, puffed cheeks, sidelong glare, 'hmph' mouth",
    "keai": "maximum bright cuteness, eyes curved in happy arcs, huge open grin",
    "gaoguai": "silly goofy comic face, one eye winking, tongue out, lopsided grin",
    "youtai": "innocent baby wonder, very wide curious eyes, small round 'o' mouth",
    "zhixing": "calm intellectual composure, hand resting under chin, thoughtful eyes",
}
# 5 动作的运动描述（这是"动态"的核心）
MOTION = {
    "happy": ("She raises both arms in a joyful celebratory cheer, bounces lightly once, "
              "beaming smile, hair and skirt flare softly with the motion."),
    "wave": ("She raises one hand and waves it toward the viewer in a friendly greeting, "
             "gentle smile, slight body sway, hair tips and sleeve sway naturally."),
    "battle": ("She shifts into a dynamic fighting stance, one arm thrust forward, "
               "hair and skirt whip with the quick motion, determined focused gaze, "
               "a faint burst of light particles behind her."),
    "chibi": ("She stands in a relaxed cute pose and sways gently side to side, "
              "tiny playful hop, hair and skirt bob softly, cheerful idle animation."),
    "face": ("Close-up portrait: she blinks once slowly, smiles warmly, "
             "a few strands of hair drift across her face, subtle breathing motion."),
}
FRAMING = {
    "happy": "full body visible head to feet", "wave": "full body visible head to feet",
    "battle": "full body visible head to feet", "chibi": "full body visible head to feet",
    "face": "head and shoulders close-up, face fills frame",
}
# 每个 view 的画布与输出比例（参考图与输出比例对齐，避免裁切）
# full-body 竖版 -> 9:16；头像 -> 1:1
CANVAS = {"happy": (576, 1024), "wave": (576, 1024), "battle": (576, 1024),
          "chibi": (576, 1024), "face": (640, 640)}
ASPECT = {"happy": "9:16", "wave": "9:16", "battle": "9:16", "chibi": "9:16", "face": "1:1"}

# 背景策略：纯色绿幕便于后续抠成透明，避免接入云境时出现白底方块
BG_GREEN = ("STUDIO BACKGROUND: solid pure flat chroma green (#00FF00), completely uniform, "
            "no gradient, no shadows, no floor, no objects, no other elements.")
STYLE = ("Clean Japanese anime illustration, crisp lineart, soft cel shading, high detail, "
         "smooth gentle motion, stable character identity, no camera movement, no zoom, "
         "no extra characters, no text, no watermark, seamless loop feel.")


def log(*a):
    print(f"[{datetime.now().strftime('%H:%M:%S')}]", *a, flush=True)


def key_of(form, view):
    return f"{form}/{view}"


def src_png(form, view):
    name = f"xiaoyun-{view}-{form}.png" if view in ("chibi", "face") else f"xiaoyun-{form}-{view}.png"
    return os.path.join(ASSETS, name)


def out_mp4(form, view):
    name = f"xiaoyun-{view}-{form}.mp4" if view in ("chibi", "face") else f"xiaoyun-{form}-{view}.mp4"
    return os.path.join(VIDEOS, name)


# ---------------- 参考图预处理 ----------------
def make_reference(form, view):
    """合成到纯色底、规范到画布尺寸(>=256)，返回 data URL。"""
    from PIL import Image
    im = Image.open(src_png(form, view)).convert("RGBA")
    W, H = CANVAS[view]
    # 等比 contain 到画布 78% 高度/宽度
    maxw, maxh = int(W * 0.82), int(H * 0.86)
    r = min(maxw / im.width, maxh / im.height)
    nw, nh = max(256, round(im.width * r)), max(256, round(im.height * r))
    # 保证缩放后仍 >=256（小图会被放大以满足 API 约束）
    if min(nw, nh) < 256:
        s = 256 / min(nw, nh); nw, nh = round(nw * s), round(nh * s)
    im = im.resize((nw, nh), Image.LANCZOS)
    # 纯绿底（视频里人物站在绿幕前）
    bg = Image.new("RGBA", (W, H), (0, 255, 0, 255))
    bg.alpha_composite(im, ((W - nw) // 2, (H - nh) // 2))
    buf = io.BytesIO(); bg.convert("RGB").save(buf, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), (W, H)


def build_prompt(form, view):
    return (f"Animate the EXACT anime girl shown in the reference image into a short looping clip. "
            f"Keep her identical: {HAIR[form]}, big bright blue eyes, silver-white hair, "
            f"small white cloud hair ornaments, wearing {OUTFIT[form]}. "
            f"Her expression: {EXPR[form]}. "
            f"MOTION: {MOTION[view]} {FRAMING[view]}. "
            f"{BG_GREEN} {STYLE}")


# ---------------- HTTP（带退避）----------------
import requests

def headers(json_ct=True):
    h = {"Authorization": f"Bearer {KEY}"}
    if json_ct: h["Content-Type"] = "application/json"
    return h


def request_with_backoff(method, url, *, tag="", json_body=None, timeout=60,
                         retries=6, base_wait=8, accept_429=True):
    """带 429/5xx/网络异常指数退避的请求。返回 (resp, err)。"""
    wait = base_wait
    for attempt in range(retries):
        try:
            if method == "POST":
                r = requests.post(url, headers=headers(), json=json_body, timeout=timeout)
            else:
                r = requests.get(url, headers=headers(False), timeout=timeout, allow_redirects=False)
            code = r.status_code
            if code == 200:
                return r, None
            if (accept_429 and code == 429) or code >= 500:
                log(f"  [{tag}] HTTP {code}，退避 {wait}s 后重试 ({attempt+1}/{retries})")
                time.sleep(wait); wait = min(wait * 2, 300)
                continue
            return r, f"HTTP {code}: {r.text[:200]}"
        except Exception as e:
            log(f"  [{tag}] 网络异常 {type(e).__name__}，退避 {wait}s ({attempt+1}/{retries})")
            time.sleep(wait); wait = min(wait * 2, 300)
    return None, f"{tag} 重试 {retries} 次仍失败"


def submit(form, view, submit_gap, last_submit):
    """提交任务，返回 task_id。遵守提交节流。"""
    ref, _ = make_reference(form, view)
    body = {"model": MODEL, "mode": "reference", "prompt": build_prompt(form, view),
            "images": [ref], "aspect_ratio": ASPECT[view], "n": 1}
    # 提交节流
    gap = time.time() - last_submit[0]
    if gap < submit_gap:
        time.sleep(submit_gap - gap)
    r, err = request_with_backoff("POST", BASE + GEN_PATH, tag=f"submit {form}/{view}",
                                  json_body=body, timeout=90, retries=8, base_wait=15)
    last_submit[0] = time.time()
    if err: return None, err
    j = r.json()
    tid = j.get("id") or j.get("task_id")
    if not tid: return None, f"响应无 task_id: {str(j)[:200]}"
    # 提交响应通常自带 base64 的 video_id，后续 agnesapi 解析直链要用；
    # 带在元组里回传，省去一次 retrieve。没有则为 None，下载阶段再补 retrieve。
    vid = j.get("video_id")
    return (tid, vid), None


def poll(tid, form, view, max_sec=600, interval=15):
    """轮询任务到终态。返回 (status, result_url, fail_reason)。"""
    url = f"{BASE}{GEN_PATH}/{tid}"
    t0 = time.time()
    while time.time() - t0 < max_sec:
        r, err = request_with_backoff("GET", url, tag=f"poll {form}/{view}",
                                      timeout=30, retries=4, base_wait=8)
        if err:
            time.sleep(interval); continue
        d = r.json().get("data", {})
        st = d.get("status")
        if st == "SUCCESS":
            return "SUCCESS", d.get("result_url"), None
        if st == "FAILURE":
            return "FAILURE", None, str(d.get("fail_reason"))[:300]
        time.sleep(interval)
    return "TIMEOUT", None, f"轮询超过 {max_sec}s"


def download(result_url, dest, form, view, retries=8, base_wait=20):
    """下载 content 到 dest，校验是 mp4。502 持续时返回 False 供后续补取。"""
    wait = base_wait
    for attempt in range(retries):
        r, err = request_with_backoff("GET", result_url, tag=f"dl {form}/{view}",
                                      timeout=90, retries=1, base_wait=wait, accept_429=False)
        if r is not None and r.status_code == 200:
            ct = r.headers.get("content-type", "")
            data = r.content
            if len(data) > 5000 and "html" not in ct and "text/plain" not in ct and data[:4] != b"\x00\x00\x00\x00":
                open(dest, "wb").write(data)
                return True, f"{len(data)//1024}KB"
            log(f"  [dl {form}/{view}] 非视频内容 ct={ct[:30]} len={len(data)}")
        else:
            code = r.status_code if r is not None else "ERR"
            log(f"  [dl {form}/{view}] 下载失败 HTTP {code}，{wait}s 后重试 ({attempt+1}/{retries})")
        time.sleep(wait); wait = min(wait * 2, 180)
    return False, "content 端点持续不可用"


def retrieve_video_id(tid):
    """从 /v1/videos/{task_id} 取 base64 的 video_id（提交响应没带时的兜底）。"""
    try:
        r = requests.get(f"{BASE}/v1/videos/{tid}", headers=headers(False), timeout=30)
        if r.status_code == 200:
            return r.json().get("video_id")
    except Exception:
        pass
    return None


# agnesapi 有严格查询频率限制（触发 429 会让签名 URL 时序错乱），
# 用全局节流器串行化所有查询：两次查询至少滞 GA P 秒，遇 429 指数退避。
import threading
_agnes_lock = threading.Lock()
_agnes_last = [0.0]
AGNES_GAP = 20  # 两次 agnesapi 查询最小间隔（秒）

def agnesapi_get(vid_b64, gap=AGNES_GAP):
    """统一入口：节流 + 429 退避地查询 agnesapi，返回 (status_code, json或None)。"""
    with _agnes_lock:
        wait_gap = gap - (time.time() - _agnes_last[0])
        if wait_gap > 0:
            time.sleep(wait_gap)
        code = None; body = None
        for attempt in range(8):
            try:
                r = requests.get(f"{BASE}/agnesapi",
                                 params={"video_id": vid_b64, "model_name": MODEL},
                                 headers=headers(False), timeout=40)
                code = r.status_code
                if code == 200:
                    try: body = r.json()
                    except Exception: body = None
                    _agnes_last[0] = time.time()
                    return code, body
                if code == 429:
                    back = min(20 * (attempt + 1), 120)
                    log(f"  [agnesapi] 429，退避 {back}s ({attempt+1}/8)")
                    time.sleep(back)
                    continue
                if code >= 500:
                    time.sleep(min(15 * (attempt + 1), 60)); continue
                _agnes_last[0] = time.time()
                return code, r.text[:160]
            except Exception as e:
                log(f"  [agnesapi] 网络异常 {type(e).__name__}")
                time.sleep(15)
        _agnes_last[0] = time.time()
        return code, body


def resolve_direct_url(vid_b64, retries=5, base_wait=12):
    """用 video_id 查 agnesapi 拿 platform-outputs 直链（经统一节流器）。"""
    if not vid_b64:
        return None, "无 video_id"
    for attempt in range(retries):
        code, body = agnesapi_get(vid_b64)
        if code == 200 and isinstance(body, dict):
            u = body.get("url") or body.get("video_url")
            if not u and isinstance(body.get("metadata"), dict):
                u = body["metadata"].get("url")
            if u and u.startswith("http"):
                return u, None
            log(f"  [resolve] agnesapi 200 但无 url: {str(body)[:140]}")
        else:
            log(f"  [resolve] agnesapi code={code} body={str(body)[:100]}")
        time.sleep(base_wait)
    return None, "agnesapi 多次未返回直链"


def poll_agnesapi(vid_b64, max_sec=600, interval=20):
    """查 agnesapi 等到 completed 并拿直链（经统一节流器）。
    返回 (status, direct_url, fail_reason)。
    """
    if not vid_b64:
        return "NO_VID", None, "提交响应无 video_id"
    t0 = time.time()
    while time.time() - t0 < max_sec:
        code, body = agnesapi_get(vid_b64)
        if code == 200 and isinstance(body, dict):
            st = body.get("status")
            if st == "completed" and body.get("url"):
                return "SUCCESS", body["url"], None
            if st in ("failed", "error"):
                return "FAILURE", None, str(body.get("error"))[:200]
        # queued/in_progress 或其他：节流器已保证间隔，继续
    return "TIMEOUT", None, f"agnesapi 轮询超过 {max_sec}s"


def video_id_to_direct(vid_b64):
    """从提交/retrieve 得到的 base64 video_id 直接解出 platform-outputs 直链。
    格式: video_<base64>(litellm:...;video_id:video_<hash>;deployment_id:...)
    直链: https://platform-outputs.agnes-ai.space/videos/agnes-video-2.5/video_<hash>.mp4
    该直链无需签名、无需带 key，可直接 GET 下载（实测 200）。
    """
    try:
        if not vid_b64 or not vid_b64.startswith("video_"):
            return None
        dec = base64.b64decode(vid_b64[6:]).decode()
        real = [x.split(":", 1)[1] for x in dec.split(";") if x.startswith("video_id:")][0]
        return f"https://platform-outputs.agnes-ai.space/videos/agnes-video-2.5/{real}.mp4"
    except Exception:
        return None


def download_direct(url, dest, retries=6, base_wait=15):
    """从真实直链下载 mp4，校验是视频而非 HTML 错误页。"""
    wait = base_wait
    for attempt in range(retries):
        try:
            # 直链是 platform-outputs.agnes-ai.space 的公开签名URL，
            # 带 Agnes 的 Bearer token 反而会被判为 401 —— 必须不带 header 下载
            r = requests.get(url, timeout=120)
            ct = r.headers.get("content-type", "")
            data = r.content
            if r.status_code == 200 and len(data) > 5000 and "html" not in ct and "text/plain" not in ct:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                open(dest, "wb").write(data)
                return True, f"{len(data)//1024}KB"
            if r.status_code == 401:
                return False, "HTTP 401 直链过期"  # 交给 fetch_video 重新 resolve
            log(f"  [dl-direct] HTTP {r.status_code} ct={ct[:24]} len={len(data)}，{wait}s 后重试")
        except Exception as e:
            log(f"  [dl-direct] 异常 {type(e).__name__}，{wait}s 后重试")
        time.sleep(wait); wait = min(wait * 2, 120)
    return False, "直链下载持续失败"


def fetch_video(task_id, vid_b64, dest, retries=8, known_direct=None):
    """完整取片链路：直链(优先用已知) -> 下载；401 过期则重新 resolve。
    返回 (ok, info, direct_url)。
    """
    vid = vid_b64 or retrieve_video_id(task_id)
    if not vid:
        return False, "取不到 video_id", None
    # 首选：从 video_id 直接构造直链（无需 agnesapi 查询、无 429 风险）
    built = video_id_to_direct(vid)
    candidates = []
    for u in (built, known_direct):
        if u and u not in candidates:
            candidates.append(u)
    last_err = "无可用直链"
    for u in candidates:
        ok, info = download_direct(u, dest)
        if ok:
            return ok, info, u
        last_err = info
    # 回退：现场查 agnesapi 拿官方直链
    fresh, err2 = resolve_direct_url(vid, retries=retries)
    if fresh and fresh not in candidates:
        ok, info = download_direct(fresh, dest)
        if ok:
            return ok, info, fresh
        last_err = info
    return False, last_err, (built or known_direct)


# ---------------- 状态管理 ----------------
def load_state():
    if os.path.exists(STATE):
        try: return json.load(open(STATE, encoding="utf-8"))
        except Exception: pass
    return {}


def save_state(st):
    tmp = STATE + ".tmp"
    open(tmp, "w", encoding="utf-8").write(json.dumps(st, ensure_ascii=False, indent=1))
    os.replace(tmp, STATE)


def all_jobs():
    return [(f, v) for f in FORMS for v in VIEWS]


def is_done(st, form, view, dest):
    e = st.get(key_of(form, view), {})
    return e.get("status") == "downloaded" and os.path.exists(dest) and os.path.getsize(dest) > 5000


# ---------------- 端点恢复探测 ----------------
def probe_endpoint(st=None):
    """探测 agnesapi -> 直链 取片通道是否可用（不再探测坏掉的 /content）。
    用 state 里任一 video_id 或已知真实 video_id 作探针：能解析出直链且能下载即恢复。
    返回 (ok, detail)。
    """
    # 已知真实可用的 video_id（提交响应自带，base64 串），作为兜底探针
    KNOWN_VID = ("video_bGl0ZWxsbTpjdXN0b21fbGxtX3Byb3ZpZGVyOm9wZW5haTttb2RlbF9pZDphZ25lcy12aWRlby1yZWYydmE7"
                 "dmlkZW9faWQ6dmlkZW9fY2EyOTU3MDBiNzRlYjk0ZTYzOTg1MDY5Y2Q1ZDJjMTcxOTg1MDg1Nzc3MGEzNGE5O2RlcGxveW1lbnRfaWQ6ZjRlMTE4NzMtNmQ1ZS00YTZhLTg3NTUtZjk1MjA1YWM0ZWU3")
    vids = []
    if st:
        for e in st.values():
            v = e.get("video_id")
            if v and isinstance(v, str) and v not in vids:
                vids.append(v)
    if KNOWN_VID not in vids: vids.append(KNOWN_VID)
    details = []
    for vid in vids[:3]:
        direct, err = resolve_direct_url(vid, retries=2, base_wait=6)
        if err:
            details.append(str(err)[:40]); continue
        try:
            r = requests.get(direct, headers=headers(False), timeout=25)
            ct = r.headers.get("content-type", "")
            ok = r.status_code == 200 and len(r.content) > 5000 and "html" not in ct
            details.append(f"{r.status_code}/{ct[:12]}")
            if ok:
                return True, f"通道可用 ({len(r.content)//1024}KB 可下载)"
        except Exception as e:
            details.append(type(e).__name__)
    return False, "取片通道探针均不可用 [" + ", ".join(details[:4]) + "]"


# ---------------- 主流程 ----------------
def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def run(jobs, args, st):
    """滑动窗口并发生成。统一用 5 元组 (form, view, tid, vid, direct)。
    已成功/下载失败的记录只补下载、不重新生成（省额度）。
    取片链路：提交 -> agnesapi 轮询拿直链 -> platform-outputs 直链下载。
    """
    W = max(1, args.concurrency)
    todo = [(f, v) for f, v in jobs if not is_done(st, f, v, out_mp4(f, v))]
    total = len(jobs)
    done = sum(1 for f, v in jobs if is_done(st, f, v, out_mp4(f, v)))
    log(f"待处理 {len(todo)} 条，窗口并发 W={W}，提交间隔 {args.submit_gap}s")

    for bi, chunk in enumerate(chunks(todo, W), 1):
        log(f"--- 批次 {bi}（{len(chunk)} 条）---")
        last_submit = [0.0]
        # 待轮询（新提交）：(form, view, tid, vid, is_retry=False)
        to_poll = []
        # 已就绪可直接下载（补下载）：(form, view, tid, vid, direct)
        ready = []
        # 阶段 1：补下载记录 or 提交新任务（严格节流）
        for form, view in chunk:
            k = key_of(form, view); e = st.get(k, {})
            es = e.get("status")
            if es in ("success", "download_failed") and (e.get("task_id") or e.get("video_id")):
                ready.append((form, view, e.get("task_id"), e.get("video_id"), e.get("direct_url")))
                log(f"  [{k}] 任务已成功，本批补下载")
            else:
                ret, err = submit(form, view, args.submit_gap, last_submit)
                if err:
                    log(f"  ❌ [{k}] 提交失败: {err}")
                    st[k] = {"status": "submit_failed", "error": err}; save_state(st)
                    continue
                tid, vid = ret
                st[k] = {"status": "submitted", "task_id": tid, "video_id": vid,
                         "at": datetime.now().isoformat()}; save_state(st)
                log(f"  [{k}] 已提交 task={tid}")
                to_poll.append((form, view, tid, vid))

        # 阶段 2：统一轮询（agnesapi 状态准；重叠等待提速）
        polled = list(ready)  # 补下载任务直接进入下载阶段
        for form, view, tid, vid in to_poll:
            log(f"  [{form}/{view}] 轮询中（agnesapi）…")
            status, direct_url, reason = poll_agnesapi(vid, max_sec=args.poll_max)
            # 回退：agnesapi 超时/无 vid 时用 generations 端点
            if status in ("NO_VID", "TIMEOUT"):
                log(f"  [{form}/{view}] agnesapi {status}，回退 generations 轮询")
                st2, _u, r2 = poll(tid, form, view, max_sec=args.poll_max)
                if st2 == "SUCCESS":
                    if not vid:
                        vid = retrieve_video_id(tid)
                    direct_url, _ = resolve_direct_url(vid, retries=4) if vid else (None, None)
                    status = "SUCCESS" if direct_url else "NO_DIRECT"
                    reason = "" if direct_url else "拿不到直链"
                elif st2 == "FAILURE":
                    status, reason = "FAILURE", r2
            k = key_of(form, view)
            if status != "SUCCESS":
                log(f"  ❌ [{k}] 任务 {status}: {reason}")
                prev = st.get(k, {})
                st[k] = {"status": "gen_failed", "task_id": tid,
                         "video_id": vid or prev.get("video_id"), "error": reason}
                save_state(st)
                continue
            st[k] = {"status": "success", "task_id": tid, "video_id": vid,
                     "direct_url": direct_url}
            save_state(st)
            polled.append((form, view, tid, vid, direct_url))

        # 阶段 3：下载（优先用 poll 阶段刚解析的直链；401 时自动刷新）
        for form, view, tid, vid, direct in polled:
            k = key_of(form, view); dest = out_mp4(form, view)
            log(f"  [{k}] 下载中…")
            ok, info, final_direct = fetch_video(tid, vid, dest, retries=args.dl_retries,
                                                  known_direct=direct)
            if ok:
                st[k] = {"status": "downloaded", "task_id": tid, "video_id": vid,
                         "direct_url": final_direct, "file": os.path.basename(dest),
                         "size": info, "at": datetime.now().isoformat()}
                done += 1; log(f"  ✅ [{k}] 完成 {info}")
            else:
                st[k] = {"status": "download_failed", "task_id": tid,
                         "video_id": vid, "direct_url": final_direct, "error": info}
                log(f"  ⏳ [{k}] 取片失败，保留 task_id/video_id 待续（不重生成）")
            save_state(st)
        log(f"--- 批次 {bi} 结束，累计 {done}/{total} ---")
    return done, total


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--probe", action="store_true", help="只探测 content 端点是否恢复")
    p.add_argument("--one", help="只生成 1 条，格式 form/view，如 aojiao/happy")
    p.add_argument("--all", action="store_true", help="全量 60 条")
    p.add_argument("--download-only", action="store_true", help="只补下载已成功的任务")
    p.add_argument("--watch", action="store_true", help="守护：端点恢复后自动跑 --all")
    p.add_argument("--status", action="store_true", help="打印当前进度")
    p.add_argument("--concurrency", type=int, default=1)
    p.add_argument("--submit-gap", type=int, default=12, help="两次提交最小间隔秒")
    p.add_argument("--recovery-gap", type=int, default=60, help="--watch 探测间隔秒")
    p.add_argument("--max-wait", type=int, default=0, help="--watch 最多等待分钟，0=不限")
    p.add_argument("--poll-max", type=int, default=600)
    p.add_argument("--dl-retries", type=int, default=8)
    p.add_argument("--dl-wait", type=int, default=20)
    args = p.parse_args()

    if not KEY and not (args.probe or args.status):
        log("❌ 未设置环境变量 AGNES_API_KEY"); sys.exit(2)

    st = load_state()

    if args.status:
        cnt = {}
        for k, e in st.items(): cnt[e.get("status", "?")] = cnt.get(e.get("status", "?"), 0) + 1
        log("状态统计:", cnt)
        for k, e in sorted(st.items()):
            if e.get("status") != "downloaded":
                log(f"  未完成 {k}: {e.get('status')} {e.get('error','')[:60]}")
        return

    if args.probe:
        ok, detail = probe_endpoint(st)
        log("端点" + ("✅ 已恢复" if ok else "❌ 仍不可用"), detail)
        sys.exit(0 if ok else 1)

    if args.watch:
        log(f"👀 守护启动：每 {args.recovery_gap}s 探测端点，恢复后自动全量生成")
        t0 = time.time()
        while True:
            ok, detail = probe_endpoint(load_state())
            if ok:
                log("✅ 端点恢复！启动全量生成"); break
            if args.max_wait and (time.time() - t0) > args.max_wait * 60:
                log(f"⏰ 等待超过 {args.max_wait} 分钟仍不可用，退出（脚本可重入，随时重跑）"); return
            log(f"  端点未恢复 ({detail})，{args.recovery_gap}s 后再探")
            time.sleep(args.recovery_gap)
        st = load_state()  # 恢复到最新断点，再跑全量
        jobs = all_jobs(); run(jobs, args, st); return

    if args.one:
        parts = args.one.split("/")
        if len(parts) != 2 or parts[0] not in FORMS or parts[1] not in VIEWS:
            log("❌ --one 格式应为 form/view，如 aojiao/happy"); sys.exit(2)
        jobs = [(parts[0], parts[1])]
    elif args.download_only:
        jobs = [(f, v) for f, v in all_jobs()
                if st.get(key_of(f, v), {}).get("status") in ("success", "download_failed")]
    elif args.all:
        jobs = all_jobs()
    else:
        p.print_help(); return

    log(f"开始，共 {len(jobs)} 条任务，并发={args.concurrency}，提交间隔={args.submit_gap}s")
    done, total = run(jobs, args, st)
    log(f"=== 完成 {done}/{total} ===")


if __name__ == "__main__":
    main()
