# -*- coding: utf-8 -*-
"""v4.10.0 KB 数据治理器：js/kb/*.js 数组字面量的括号平衡扫描、污染清洗、索引重算。

为什么不用正则：KB 文件是单行巨型 JSON 数组，字符串内部含 ']'，
`\\[[\\s\\S]*?\\]` 这类非贪婪正则会提前截断（v4.10.0 初版清洗脚本即栽在这里）。
本工具按字符扫描，正确处理引号与转义，并容忍 JS 允许的尾逗号 `},\\n]`。

治理动作（均支持 --dry）：
  --fix-frag    删 F12：title 形如「世界观铁律/世界观设定 · <JS 代码>」的源码/提示词碎片
  --fix-nested  修 P2：把误塞进 add 数组的嵌套 list-of-dict 展开成独立条目（wangyou 34 条）
  --fix-dazhu   修 F6：清斗破库里《大主宰》单向倒灌（大主宰独立界已完整承载）
  --all         以上三项全做
  --reindex     按运行时口径（逐界按 title 去重）重算 js/kb/_index.json
  --verify      只读终验：全部数组可解析、三类污染归零
  --report      只读诊断（默认）
"""
import re, json, glob, os, sys, argparse, shutil, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB_DIR = os.path.join(ROOT, 'js', 'kb')
BACKUP = '/tmp/yj_kb_backup_v410'

# 与 knowledge-manager.js 的 KB_isCodeFragment() 完全一致：
# 只认「世界观铁律/世界观设定 · <明确 JS token>」，避免误伤「速查/条文汇编/总纲/档案」等合法条目。
CODE_FRAG = re.compile(
    r'^(?:const\s|let\s|var\s|function\b|=>|defaultSystemPrompt|defaultDynamicWorldPrompt|'
    r'getElementById|document\.|window\.|onInit\b|on[A-Z]|build[A-Z]|'
    r'[A-Za-z_]\w*StoryConfig|[A-Za-z_]\w*\s*[:=]\s*[\(\{`]|'
    r'[A-Za-z_]\w*\s*\(|if\s*\(|return\b|[\{\}])')
TITLE_PREFIX = re.compile(r'^(?:世界观铁律|世界观设定)\s*·\s*(.*)$')

# F6 精确判据：只删《大主宰》独立设定与人物关系，保留「斗破·」本界条目与
# 「同宇宙联动 / 天蚕土豆·」这类明确标注的项目有意联动说明。
DZ_PREFIX = re.compile(r'^大主宰·')
DZ_SPECIAL = re.compile(
    r'牧尘|洛璃|牧府|浮屠|万古会|天邪神|域外邪族|大千世界|北苍灵院|'
    r'曼荼罗|清衍静|不朽大帝|西天战皇|灵阵|邪神|九幽雀|九幽冥雀')
DZ_EDGE = re.compile(r'^(?:关系|血脉|体质|天赋)·')

ANCHOR = re.compile(r'(?:KB\[\s*"([^"]+)"\s*\]\s*=\s*|var\s+add\s*=\s*)\[')


def is_code_frag(e):
    if not isinstance(e, dict):
        return False
    m = TITLE_PREFIX.match(str(e.get('title') or '').strip())
    return bool(m and CODE_FRAG.match(m.group(1)))


def is_dazhu_leak(e, base):
    if not isinstance(e, dict) or not base.startswith('doupocangqiong'):
        return False
    t = str(e.get('title') or '').strip()
    if DZ_PREFIX.match(t):
        return True
    return bool(DZ_EDGE.match(t) and DZ_SPECIAL.search(t))


def scan_array(src, start):
    """src[start] == '['；返回配对 ']' 的下一个下标，失败返回 -1。"""
    depth, i, n = 0, start, len(src)
    while i < n:
        c = src[i]
        if c in ('"', "'", '`'):
            q = c
            i += 1
            while i < n:
                if src[i] == '\\':
                    i += 2
                    continue
                if src[i] == q:
                    i += 1
                    break
                i += 1
            continue
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1


def loads_array(raw):
    try:
        v = json.loads(raw)
    except Exception:
        # JS 允许尾逗号，JSON 不允许
        fixed = re.sub(r',(\s*\])\s*$', r'\1', raw)
        if fixed == raw:
            return None
        try:
            v = json.loads(fixed)
        except Exception:
            return None
    return v if isinstance(v, list) else None


def segments_of(src):
    """返回 [(start, end, kind, list_or_None)]，按 start 升序。"""
    out, seen = [], set()
    for m in ANCHOR.finditer(src):
        # 锚点以 '\[' 结尾，m.end()-1 才是赋值号后的数组起始 '['。
        # 不能用 find('[', m.start())，否则会先命中 'KB[' 里的 '['。
        s = m.end() - 1
        if s < 0 or src[s] != '[' or s in seen:
            continue
        seen.add(s)
        e = scan_array(src, s)
        if e < 0:
            out.append((s, -1, m.group(1) or 'add', None))
            continue
        out.append((s, e, m.group(1) or 'add', loads_array(src[s:e])))
    return out


def kb_files():
    return sorted(glob.glob(os.path.join(KB_DIR, '*.js')))


def genre_of(base):
    return re.split(r'\.(?:core|ext)\.js$', base)[0]


def collect(base, src=None):
    """返回该文件所有段的 dict 元素（含嵌套展开前）。"""
    if src is None:
        src = open(os.path.join(KB_DIR, base), encoding='utf-8').read()
    out = []
    for (s, e, kind, arr) in segments_of(src):
        if arr:
            out.extend(arr)
    return out


def transform(arr, base, flags):
    """返回 (new_arr, 删除数, 展开数)。"""
    out, removed, expanded = [], 0, 0
    for x in arr:
        if isinstance(x, list) and flags.get('nested'):
            # P2：嵌套 list-of-dict 是被误当成单个元素塞进来的整批条目，展开而非丢弃
            good = [y for y in x if isinstance(y, dict)]
            if good:
                out.extend(good)
                expanded += len(good)
                removed += len(x) - len(good)
                continue
            removed += 1
            continue
        if not isinstance(x, dict):
            removed += 1
            continue
        if flags.get('frag') and is_code_frag(x):
            removed += 1
            continue
        if flags.get('dazhu') and is_dazhu_leak(x, base):
            removed += 1
            continue
        out.append(x)
    return out, removed, expanded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--verify', action='store_true')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--fix-frag', action='store_true')
    ap.add_argument('--fix-nested', action='store_true')
    ap.add_argument('--fix-dazhu', action='store_true')
    ap.add_argument('--reindex', action='store_true')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='', help='只处理指定文件名（逗号分隔）')
    args = ap.parse_args()
    flags = dict(frag=args.all or args.fix_frag,
                 nested=args.all or args.fix_nested,
                 dazhu=args.all or args.fix_dazhu)
    do_fix = any(flags.values())
    if not (args.report or args.verify or do_fix or args.reindex):
        args.report = True
    only = set(x.strip() for x in args.only.split(',') if x.strip())

    # ---------- 诊断 / 终验 ----------
    if args.report or args.verify:
        stat = dict(files=0, segs=0, entries=0, fail=0, frag=0, nested=0, dazhu=0, dazhu_ai=0)
        bad = []
        for fp in kb_files():
            base = os.path.basename(fp)
            if base in ('_common.js', 'names.js') or (only and base not in only):
                continue
            src = open(fp, encoding='utf-8').read()
            segs = segments_of(src)
            if not segs:
                continue
            stat['files'] += 1
            for (s, e, kind, arr) in segs:
                stat['segs'] += 1
                if arr is None:
                    stat['fail'] += 1
                    bad.append('%s@%d' % (base, s))
                    continue
                stat['entries'] += len(arr)
                for x in arr:
                    if isinstance(x, list):
                        stat['nested'] += 1
                    elif not isinstance(x, dict):
                        continue
                    else:
                        if is_code_frag(x):
                            stat['frag'] += 1
                        if is_dazhu_leak(x, base):
                            stat['dazhu'] += 1
                            if x.get('alwaysInclude') is True:
                                stat['dazhu_ai'] += 1
        print('=== %s ===' % ('终验' if args.verify else '诊断'))
        print('文件 %d ｜ 数组段 %d ｜ 条目 %d ｜ 解析失败 %d' %
              (stat['files'], stat['segs'], stat['entries'], stat['fail']))
        print('F12 源码碎片 %d ｜ 嵌套数组元素 %d ｜ F6 大主宰倒灌 %d（常驻 %d）' %
              (stat['frag'], stat['nested'], stat['dazhu'], stat['dazhu_ai']))
        if bad:
            print('解析失败位置: ' + ', '.join(bad[:20]))
        if args.verify:
            ok = (stat['fail'] == 0 and stat['frag'] == 0 and
                  stat['nested'] == 0 and stat['dazhu'] == 0)
            print('终验结果: ' + ('PASS' if ok else 'FAIL'))
            return 0 if ok else 1

    # ---------- 治理 ----------
    if do_fix:
        if not os.path.isdir(BACKUP):
            shutil.copytree(KB_DIR, BACKUP)
            print('已备份 js/kb → %s' % BACKUP)
        changed = 0
        tot_rm = tot_exp = 0
        for fp in kb_files():
            base = os.path.basename(fp)
            if base in ('_common.js', 'names.js') or (only and base not in only):
                continue
            src = open(fp, encoding='utf-8').read()
            edits, f_rm, f_exp = [], 0, 0
            for (s, e, kind, arr) in segments_of(src):
                if arr is None or not arr:
                    continue
                new, rm, exp = transform(arr, base, flags)
                if rm == 0 and exp == 0:
                    continue
                edits.append((s, e, json.dumps(new, ensure_ascii=False, separators=(',', ':'))))
                f_rm += rm
                f_exp += exp
            if not edits:
                continue
            out = src
            for (s, e, text) in reversed(edits):
                out = out[:s] + text + out[e:]
            if not args.dry:
                open(fp, 'w', encoding='utf-8').write(out)
            changed += 1
            tot_rm += f_rm
            tot_exp += f_exp
            print('  %s%-30s 删 %-4d 展开 %-3d' %
                  ('[DRY] ' if args.dry else '', base, f_rm, f_exp))
        print('\n%s 治理文件 %d 个 ｜ 删除 %d 条 ｜ 展开 %d 条' %
              ('[DRY] ' if args.dry else '', changed, tot_rm, tot_exp))

    # ---------- 索引重算 ----------
    if args.reindex:
        idx_path = os.path.join(KB_DIR, '_index.json')
        idx = json.load(open(idx_path, encoding='utf-8'))
        genres = collections.defaultdict(list)
        for fp in kb_files():
            base = os.path.basename(fp)
            if base in ('_common.js', 'names.js'):
                continue
            g = genre_of(base)
            if not g or g.startswith('_'):
                continue
            genres[g].extend(collect(base))
        counts = {}
        for g, arr in sorted(genres.items()):
            seen, n = set(), 0
            for x in arr:
                if not isinstance(x, dict):
                    continue
                t = str(x.get('title') or '').strip()
                if t in seen:
                    continue
                seen.add(t)
                n += 1
            counts[g] = n
        old_total = idx.get('total')
        idx['genres'] = counts
        idx['total'] = sum(counts.values())
        print('\n索引重算: %d 界 ｜ 旧 total %s ｜ 新 total %d' %
              (len(counts), old_total, idx['total']))
        for g in sorted(counts):
            print('  %-22s %5d' % (g, counts[g]))
        if not args.dry:
            open(idx_path, 'w', encoding='utf-8').write(
                json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + '\n')
            print('已写入 %s' % idx_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
