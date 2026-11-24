#!/usr/bin/env python3
"""云境智能体插件 CLI · 列世界 / 导出世界设定 / 搜索 / 规则摘要。
只依赖 Python 3 标准库。在云境仓库根目录运行，或用 --repo 指定仓库路径。
"""
import argparse, glob, os, re, sys

RULES = """云境创作规则摘要
1. 世界铁则优先：每个世界 configs/*-config.js 的 fullSystemPrompt 为准。
2. 防吃书防全知：按身份门控信息，不提前剧透、不跳阶越境、圣贤不全知全能。
3. 三段式输出：小说正文 + (variable_update) 变量块 + 6 个行动选项。
4. 界面提示不进正文；数值只在变量块出现。
5. 跨层战力对比标注「估算，仅供校准」，不写进正文。
6. 护栏：拒绝未成年人色情、真实在世人物不当描写。
"""

def find_repo(explicit):
    if explicit:
        return os.path.abspath(explicit)
    # 优先当前目录，其次脚本上两级（plugin/yunjing-skill -> 仓库根）
    here = os.path.dirname(os.path.abspath(__file__))
    for d in [os.getcwd(), os.path.abspath(os.path.join(here, '..', '..'))]:
        if os.path.isdir(os.path.join(d, 'configs')):
            return d
    return os.getcwd()

def world_title(path, s):
    m = re.search(r'你是《([^》]+)》', s) or re.search(r'《([^》]+)》', s)
    if m: return m.group(1)
    return os.path.basename(path).replace('-config.js', '')

def extract_prompt(s):
    # fullSystemPrompt = `....` 或 "...."
    m = re.search(r'fullSystemPrompt\s*=\s*`([\s\S]*?)`', s)
    if m: return m.group(1).strip()
    m = re.search(r'fullSystemPrompt\s*=\s*"([\s\S]*?)";', s)
    if m: return m.group(1).strip()
    return ''

def load_worlds(repo):
    out = {}
    for f in sorted(glob.glob(os.path.join(repo, 'configs', '*-config.js'))):
        code = os.path.basename(f).replace('-config.js', '')
        try:
            s = open(f, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        out[code] = {'path': f, 'title': world_title(f, s), 'prompt': extract_prompt(s)}
    return out

def cmd_list(repo, args):
    worlds = load_worlds(repo)
    print(f'云境世界清单（{len(worlds)} 个）')
    print(f'{"代号":<22} 标题')
    print('-' * 50)
    for code, w in worlds.items():
        print(f'{code:<22} {w["title"]}')

def cmd_world(repo, args):
    worlds = load_worlds(repo)
    code = args.code
    if code not in worlds:
        # 支持按标题模糊匹配
        hit = [c for c, w in worlds.items() if code in w['title']]
        if len(hit) == 1:
            code = hit[0]
        elif len(hit) > 1:
            print('匹配到多个世界，请用代号：' + ', '.join(hit), file=sys.stderr)
            return 2
        else:
            print(f'未找到世界：{args.code}（用 yj.py list 查看代号）', file=sys.stderr)
            return 1
    w = worlds[code]
    md = f'# 云境世界设定 · {w["title"]}（{code}）\n\n来源：`{os.path.relpath(w["path"], repo)}`\n\n---\n\n{w["prompt"] or "（该文件未提取到 fullSystemPrompt，请直接阅读源文件内容。）"}\n'
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as fh:
            fh.write(md)
        print(f'已导出：{args.output}')
    else:
        print(md)
    return 0

def cmd_search(repo, args):
    worlds = load_worlds(repo)
    kw = args.keyword
    hit = 0
    for code, w in worlds.items():
        if kw in w['prompt']:
            # 摘出含关键词的行
            lines = [ln.strip() for ln in w['prompt'].splitlines() if kw in ln.strip()]
            print(f'## {w["title"]}（{code}）')
            for ln in lines[:3]:
                print('  ' + ln[:160])
            hit += 1
    print(f'\n共 {hit} 个世界命中「{kw}」')

def cmd_rules(repo, args):
    print(RULES, end='')

def main():
    ap = argparse.ArgumentParser(description='云境智能体插件 CLI')
    ap.add_argument('--repo', help='云境仓库根目录（默认自动探测）')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('list', help='列出全部世界')
    pw = sub.add_parser('world', help='导出某世界设定')
    pw.add_argument('code', help='世界代号或标题片段')
    pw.add_argument('-o', '--output', help='输出到文件')
    ps = sub.add_parser('search', help='搜索世界设定关键词')
    ps.add_argument('keyword')
    sub.add_parser('rules', help='创作规则摘要')
    args = ap.parse_args()
    repo = find_repo(args.repo)
    if not os.path.isdir(os.path.join(repo, 'configs')):
        print(f'未在 {repo} 找到 configs/，请用 --repo 指定云境仓库根目录', file=sys.stderr)
        return 1
    return {'list': cmd_list, 'world': cmd_world, 'search': cmd_search, 'rules': cmd_rules}[args.cmd](repo, args) or 0

if __name__ == '__main__':
    sys.exit(main())
