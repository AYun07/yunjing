#!/usr/bin/env python3
"""
云境全量推送到 GitHub —— GitHub REST API（沙箱内 git 协议不通）。
以远端 main 当前 tree 为 base，把所有本地文件作为 blob 合并进新 tree，创建单个 commit 移动 main。
只覆盖/新增，绝不删除任何远端文件。并发上传 + 断点缓存，中断可续。
令牌从 /root/.codebuddy/security/gh_token.txt 读取，不落盘、不打印。
"""
import os, sys, json, base64, time, urllib.request, urllib.error, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = open('/root/.codebuddy/security/gh_token.txt', encoding='utf-8').read().strip()
OWNER, REPO, BRANCH = 'AYun07', 'yunjing', 'main'
API = 'https://api.github.com'
MAX_FILE = 100 * 1024 * 1024
SKIP_DIRS = {'.git', 'node_modules'}
SKIP_FILES = {'云境-Windows-4.34.0-便携版.zip', '云境-Android-4.34.0.apk'}
CACHE = '/tmp/yj-blob-cache.json'          # path -> sha，断点续传
WORKERS = 12

def api(method, path, body=None, retries=5):
    url = API + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    for i in range(retries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header('Authorization', 'Bearer ' + TOKEN)
        req.add_header('Accept', 'application/vnd.github+json')
        req.add_header('X-GitHub-Api-Version', '2022-11-28')
        if data: req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:200]
            if e.code in (403, 429) or 'rate limit' in detail.lower():
                time.sleep(4 * (i + 1)); continue
            if 500 <= e.code < 600:
                time.sleep(2 * (i + 1)); continue
            raise RuntimeError(f'{method} {path} HTTP {e.code}: {detail}')
        except Exception as e:
            if i == retries - 1: raise
            time.sleep(2 * (i + 1))

def collect_files():
    out = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES: continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
            try: sz = os.path.getsize(full)
            except: continue
            if sz > MAX_FILE:
                print('  [跳过>100MB]', rel, f'{sz/1048576:.0f}MB', flush=True); continue
            out.append((rel, full))
    return sorted(out)

def load_cache():
    if os.path.exists(CACHE):
        try: return json.load(open(CACHE, encoding='utf-8'))
        except: pass
    return {}

def upload_one(rel, full, cache):
    if rel in cache and cache[rel]:
        return rel, cache[rel], True
    content = open(full, 'rb').read()
    blob = api('POST', f'/repos/{OWNER}/{REPO}/git/blobs', {
        'content': base64.b64encode(content).decode('ascii'), 'encoding': 'base64'
    })
    return rel, blob['sha'], False

def main():
    dry = '--dry' in sys.argv
    ref = api('GET', f'/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}')
    commit_sha = ref['object']['sha']
    commit = api('GET', f'/repos/{OWNER}/{REPO}/git/commits/{commit_sha}')
    base_tree = commit['tree']['sha']
    print('远端 commit:', commit_sha[:10], '| base tree:', base_tree[:10], flush=True)

    files = collect_files()
    print(f'待推送: {len(files)} 文件, {sum(os.path.getsize(f) for _,f in files)/1048576:.0f} MB', flush=True)
    if dry:
        print('[dry-run] 不推送'); return

    cache = load_cache()
    print(f'断点缓存: {len(cache)} 条; 并发 {WORKERS}', flush=True)
    sha_map = {}
    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(upload_one, rel, full, cache): rel for rel, full in files}
        for fut in as_completed(futures):
            rel, sha, cached = fut.result()
            sha_map[rel] = sha
            done += 1
            if done % 100 == 0 or done == len(files):
                json.dump(sha_map, open(CACHE, 'w', encoding='utf-8'))
                print(f'  blobs {done}/{len(files)}', flush=True)
    json.dump(sha_map, open(CACHE, 'w', encoding='utf-8'))

    entries = [{'path': rel, 'mode': '100644', 'type': 'blob', 'sha': sha}
               for rel, sha in sorted(sha_map.items())]
    # 分批增量建 tree：GitHub 对单次 tree body 有大小上限，一次性提交 1500+ 项会 422 超时。
    # 每批以上一批的 sha 作 base_tree，链式推进，只增改不删。
    BATCH = 200
    cur_base = base_tree
    print(f'创建 tree（增量分批，每批 {BATCH}，共 {len(entries)} 项）...', flush=True)
    for bi in range(0, len(entries), BATCH):
        batch = entries[bi:bi+BATCH]
        nt = api('POST', f'/repos/{OWNER}/{REPO}/git/trees',
                 {'base_tree': cur_base, 'tree': batch})
        cur_base = nt['sha']
        print(f'  tree batch {bi//BATCH+1}/{(len(entries)+BATCH-1)//BATCH}: {cur_base[:10]}', flush=True)
    new_tree = {'sha': cur_base}
    print('  最终 tree:', new_tree['sha'][:10], flush=True)

    msg = 'release: v6.6.0 创意工坊单一文件夹(community/works 简介与包体同处+云境内一键下载安装)+修复CI版本同源 · 全量同步（只增改不删）'
    new_commit = api('POST', f'/repos/{OWNER}/{REPO}/git/commits', {
        'message': msg, 'tree': new_tree['sha'], 'parents': [commit_sha]
    })
    print('  新 commit:', new_commit['sha'][:10], flush=True)
    api('PATCH', f'/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}', {'sha': new_commit['sha'], 'force': False})
    print('完成！新 main =', new_commit['sha'], flush=True)
    print(f'https://github.com/{OWNER}/{REPO}/commit/{new_commit["sha"]}', flush=True)

if __name__ == '__main__':
    main()
