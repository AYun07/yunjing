#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 4 个天蚕土豆宇宙新世界生成专属主题 CSS（复用斗破皮肤骨架，仅换色与题名）。"""
import os

CSS_DIR = os.path.join(os.path.dirname(__file__), "..", "css")

WORLDS = [
    dict(
        genre="dazhuzai", theme="主宰紫金", name="大主宰",
        p="#9b6ad0", s="#d9a86a", a="#b08ad8", l="#cbb0e8", m="#c8aee0",
        bg="#120a18", tb="#1c1024", bg2="#160e1c",
        opt="✦ ", pan="❖ ",
        titles=["主宰王座","星河淬炼","大千榜刻名","灵力激发","灵力灌注",
                "主宰图鉴","星河流道","大千之路","灵诀钮","主宰刻字"],
    ),
    dict(
        genre="wudongqiankun", theme="祖符玄青", name="武动乾坤",
        p="#3a9d8f", s="#6fc9b0", a="#5fb8a8", l="#8fe0cf", m="#8fd8c8",
        bg="#08140f", tb="#0c1c16", bg2="#0a1812",
        opt="◈ ", pan="⬡ ",
        titles=["祖符圣地","符文淬炼","百朝榜刻名","元力激发","元力灌注",
                "祖符图鉴","符纹细道","武动之路","符诀钮","乾坤刻字"],
    ),
    dict(
        genre="yuanzun", theme="源气苍玄", name="元尊",
        p="#5a9bd4", s="#8fbfe8", a="#7ab0e0", l="#b6d8f4", m="#a8cdec",
        bg="#0a1118", tb="#101c28", bg2="#0c141e",
        opt="◉ ", pan="❖ ",
        titles=["苍玄圣地","源气淬炼","天源榜刻名","源气激发","源气灌注",
                "源术图鉴","源流细道","源途之路","源诀钮","苍玄刻字"],
    ),
    dict(
        genre="wanxiangzhiwang", theme="相辉流金", name="万相之王",
        p="#c9a83a", s="#e0c878", a="#d8b85a", l="#f0dd9a", m="#e6cf86",
        bg="#16120a", tb="#221c0e", bg2="#1a150c",
        opt="✶ ", pan="❖ ",
        titles=["相辉圣地","相纹淬炼","神州榜刻名","相术激发","相力灌注",
                "相术图鉴","相辉细道","万相之路","相诀钮","万相刻字"],
    ),
]

def rgba(hexv, alpha):
    hexv = hexv.lstrip("#")
    r, g, b = int(hexv[0:2], 16), int(hexv[2:4], 16), int(hexv[4:6], 16)
    return f"rgba({r}, {g}, {b}, {alpha})"

TEMPLATE = """/* ============================================================
   {name}主题 - {theme}（天蚕土豆大千世界宇宙）
   v3.98.0 每界专属 UI 皮肤：
   {t0} · {t5}标题 · 专属滚动条 · 主题色贯通全界面
   ============================================================ */
body {{
    --primary: {p};
    --primary-dim: {pdim};
    --primary-glow: {pglow};
    --secondary: {s};
    --accent: {a};
    --panel-border: {pborder};
    background-color: {bg};
    background-image:
        radial-gradient(ellipse 760px 440px at 14% -6%, {p10}, transparent 62%),
        radial-gradient(ellipse 640px 480px at 98% 110%, {s06}, transparent 60%),
        radial-gradient(ellipse 500px 300px at 50% 118%, {p08}, transparent 55%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130' viewBox='0 0 130 130'%3E%3Cg fill='none' stroke='%23{purl}' stroke-opacity='0.055'%3E%3Cpath d='M15 110 Q30 70 22 40 Q34 60 44 30 Q42 66 58 24 Q60 58 76 34 Q70 72 88 48'/%3E%3Cpath d='M60 128 Q76 92 70 64 Q80 82 92 58 Q90 90 104 70'/%3E%3C/g%3E%3Cg fill='%23{lurl}' fill-opacity='0.09'%3E%3Ccircle cx='30' cy='52' r='1.1'/%3E%3Ccircle cx='70' cy='28' r='1.3'/%3E%3Ccircle cx='95' cy='60' r='1'/%3E%3C/g%3E%3C/svg%3E");
}}
body .chapter-badge {{ background: linear-gradient(135deg, {l}, {p}); }}
body .progress-fill {{ background: linear-gradient(90deg, {p}, {s}); }}
body #sendBtn, body .btn-solid {{ background: linear-gradient(135deg, {l}, {p}); }}
body .foreshadow-item.planted {{
    background: {p08};
    border-left-color: {p};
    color: {m};
}}
body .char-status {{ color: {p}; border-color: {p40}; }}

/* ─────────── ① 顶栏：{t0} ─────────── */
body.theme-{genre} .top-bar {{
    background: linear-gradient(180deg, {tb96}, {bg293});
    border-bottom: 1px solid {p32};
    box-shadow: 0 2px 18px rgba(0, 0, 0, 0.45), 0 3px 12px {p10};
}}
body.theme-{genre} #gameTitle {{
    letter-spacing: 5px;
    text-shadow: 0 0 18px {p45}, 0 0 36px {s20};
}}

/* ─────────── ② 正文卡：{t1} ─────────── */
body.theme-{genre} .ai-card {{
    position: relative;
    border-left: 3px solid {p};
    background:
        linear-gradient(0deg, {p09}, transparent 30%),
        linear-gradient(160deg, {s04}, transparent 40%),
        var(--panel);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.38);
    transition: box-shadow 0.25s ease, border-color 0.25s ease;
}}
body.theme-{genre} .ai-card:hover {{
    border-left-color: {l};
    box-shadow: 0 4px 26px rgba(0, 0, 0, 0.42), 0 0 22px {p14};
}}
body.theme-{genre} .ai-card::before {{
    content: '';
    position: absolute;
    top: 0; right: 24px;
    width: 4px; height: 16px;
    background: linear-gradient(180deg, {l55}, transparent);
    border-radius: 2px 2px 0 0;
    pointer-events: none;
}}
body.theme-{genre} .ai-card::after {{
    content: '';
    position: absolute;
    top: 0; right: 14px;
    width: 3px; height: 10px;
    background: linear-gradient(180deg, {p50}, transparent);
    border-radius: 2px 2px 0 0;
    pointer-events: none;
}}
body.theme-{genre} .ai-card-header {{
    border-bottom: 1px solid {p22};
    border-image: linear-gradient(90deg, {p45}, {s15} 70%, transparent) 1;
}}

/* ─────────── ③ 章节徽章：{t2} ─────────── */
body.theme-{genre} .chapter-badge {{
    letter-spacing: 2px;
    border: 1px solid {l50};
    box-shadow: 0 0 14px {p35};
    text-shadow: 0 0 8px {p35};
}}

/* ─────────── ④ 选项按钮：{t3} ─────────── */
body.theme-{genre} .option-btn {{ border-radius: 8px 8px 8px 2px; }}
body.theme-{genre} .option-btn::before {{ content: '{opt}'; font-size: 0.8em; }}
body.theme-{genre} .option-btn:hover:not(:disabled) {{
    border-color: {p70};
    box-shadow: inset 2px 0 0 {p}, 0 0 16px {p18};
    background: {p06};
    text-shadow: 0 0 8px {p35};
}}
body.theme-{genre} .options-title {{ letter-spacing: 5px; }}
body.theme-{genre} .options-title::before {{ content: '≡ '; color: {a}; }}

/* ─────────── ⑤ 输入区：{t4} ─────────── */
body.theme-{genre} #userInput:focus {{
    border-color: {p};
    box-shadow: 0 0 0 3px {p16}, 0 0 22px {p12};
}}
body.theme-{genre} #sendBtn {{
    box-shadow: 0 0 14px {p30};
    letter-spacing: 1px;
}}

/* ─────────── ⑥ 面板：{t5} ─────────── */
body.theme-{genre} .panel-title {{ letter-spacing: 3px; }}
body.theme-{genre} .panel-title::before {{ content: '{pan}'; color: {a}; }}
body.theme-{genre} .gauge-label {{ color: {a}; }}
body.theme-{genre} .gauge-fill {{
    box-shadow: 0 0 8px {p40};
    background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.16) 0 4px, transparent 4px 8px);
    background-size: 8px 100%;
}}
body.theme-{genre} .sheet-box {{ border-top: 2px solid {p42}; }}
body.theme-{genre} .modal-box {{ border-top: 2px solid {p42}; }}

/* ─────────── ⑦ 滚动条：{t6} ─────────── */
body.theme-{genre} #chatMessages::-webkit-scrollbar-thumb,
body.theme-{genre} #statusPanel::-webkit-scrollbar-thumb,
body.theme-{genre} #setupWrap::-webkit-scrollbar-thumb {{ background: {p30}; }}
body.theme-{genre} #chatMessages::-webkit-scrollbar-thumb:hover {{ background: {p50}; }}

/* ─────────── ⑧ 扮演模式特化：{t7} ─────────── */
body.theme-{genre} .wizard-title {{ letter-spacing: 4px; text-shadow: 0 0 16px {p40}; }}
body.theme-{genre} .book-title-line {{ color: {p}; }}
body.theme-{genre} .status-panel {{
    border-image: linear-gradient(180deg, {p40}, {s12}) 1;
}}

/* ─────────── ⑨ 快捷指令：{t8} ─────────── */
body.theme-{genre} .quick-btn {{ border-radius: 8px 8px 8px 2px; }}
body.theme-{genre} .quick-btn:hover {{
    border-color: {p60};
    box-shadow: 0 0 10px {p16};
}}

/* ─────────── ⑩ 章节标题：{t9} ─────────── */
body.theme-{genre} .story-chapter-title {{
    letter-spacing: 10px;
    text-shadow: 0 0 22px {p40}, 0 0 44px {s20};
}}

/* ─────────── 移动端适配（皮肤只做轻装饰，不改布局） ─────────── */
body.theme-{genre}.mobile .ai-card::before,
body.theme-{genre}.mobile .ai-card::after {{ display: none; }}
"""


def render(w):
    p = w["p"]
    s = w["s"]
    a = w["a"]
    l = w["l"]
    m = w["m"]
    bg = w["bg"]
    tb = w["tb"]
    bg2 = w["bg2"]
    sub = dict(
        genre=w["genre"], name=w["name"], theme=w["theme"],
        p=p, s=s, a=a, l=l, m=m, bg=bg, tb=tb, bg2=bg2,
        opt=w["opt"], pan=w["pan"],
        pdim=rgba(p, 0.12), pglow=rgba(p, 0.3), pborder=rgba(p, 0.18),
        p10=rgba(p, 0.1), s06=rgba(s, 0.06), p08=rgba(p, 0.08),
        purl=p.lstrip("#"), lurl=l.lstrip("#"),
        p40=rgba(p, 0.4), p32=rgba(p, 0.32),
        tb96=rgba(tb, 0.96), bg293=rgba(bg2, 0.93), p45=rgba(p, 0.45), s20=rgba(s, 0.2),
        p09=rgba(p, 0.09), s04=rgba(s, 0.04), l55=rgba(l, 0.55), p14=rgba(p, 0.14),
        p50=rgba(p, 0.5), p22=rgba(p, 0.22), p45b=rgba(p, 0.45), s15=rgba(s, 0.15),
        l50=rgba(l, 0.5), p35=rgba(p, 0.35),
        p70=rgba(p, 0.7), p18=rgba(p, 0.18), p06=rgba(p, 0.06),
        p16=rgba(p, 0.16), p12=rgba(p, 0.12), p30=rgba(p, 0.3),
        s12=rgba(s, 0.12), p60=rgba(p, 0.6),
        p42=rgba(p, 0.42), p30b=rgba(p, 0.3),
    )
    # 把标题列表映射
    for i, t in enumerate(w["titles"]):
        sub[f"t{i}"] = t
    return TEMPLATE.format(**sub)


def main():
    for w in WORLDS:
        css = render(w)
        out = os.path.join(CSS_DIR, f"{w['genre']}-style.css")
        with open(out, "w", encoding="utf-8") as f:
            f.write(css)
        print("生成:", out, len(css), "字节")


if __name__ == "__main__":
    main()
