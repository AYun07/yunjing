import subprocess, json, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
os.chdir(r"E:\小鲸鱼\workspace")
GH = "C:/Users/13011/bin/git.exe"

# 1. 把 v3.61.0 小云动态引擎提交到 main
r = subprocess.run([GH, "add", "-A"], capture_output=True, text=True, encoding="utf-8", errors="replace")
r = subprocess.run([GH, "commit", "-m", "feat(chibi): 小云动态引擎 v3.61.0 — idle视频循环+关键动作帧动画混合方案\n\n- js/chibi-anim.js: 三层架构(idle视频/帧动画/静图回退), 接 mo-chibi.js 钩子\n- css/base-style.css: .mc-video/.mc-frame 样式\n- studio.html: chibi-anim.js 接入 demand 组\n- sw.js: SW_VER→v3.61.0 + 资源入预缓存\n- assets/chibi/: jump/spell 8帧 + manifest.json (idle视频待队列释放后补齐)\n\n验证: Node new Function 全量 218 js 文件语法 0 失败"],
    capture_output=True, text=True, encoding="utf-8", errors="replace")
print("commit:", (r.stdout + r.stderr).strip().splitlines()[-1])

# 2. 推到 main
r = subprocess.run([GH, "push", "origin", "main"], capture_output=True, text=True, encoding="utf-8", errors="replace")
print("push:", (r.stdout + r.stderr).strip()[:200])
