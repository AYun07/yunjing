#!/usr/bin/env python3
"""v6.6.0 真机：把一件作品写入唯一总文件夹 community/works/<slug>/ 并更新 catalog。
模拟云境内 GC.publishWork 的完整逻辑（contents API PUT 三文件 + catalog CAS 写回）。
token 只从本机读取，绝不写进任何文件正文。"""
import json, base64, urllib.request, urllib.error, urllib.parse, datetime, hashlib, os

TOKEN = open('/root/.codebuddy/security/gh_token.txt', encoding='utf-8').read().strip()
API = 'https://api.github.com'
OWNER, REPO = 'AYun07', 'yunjing'
BRANCH = 'main'
WORKS = 'community/works'

def req(url, method='GET', body=None):
    r = urllib.request.Request(url, method=method)
    r.add_header('Authorization', 'Bearer ' + TOKEN)
    r.add_header('Accept', 'application/vnd.github+json')
    r.add_header('X-GitHub-Api-Version', '2022-11-28')
    if body is not None:
        r.add_header('Content-Type', 'application/json')
        r.data = json.dumps(body).encode('utf-8')
    return urllib.request.urlopen(r, timeout=60)

def content_url(path):
    return f'{API}/repos/{OWNER}/{REPO}/contents/' + '/'.join(urllib.parse.quote(p) for p in path.split('/'))

def get_sha(path):
    try:
        d = json.loads(req(content_url(path) + f'?ref={BRANCH}').read())
        return d.get('sha'), d.get('content')
    except urllib.error.HTTPError as e:
        if e.code == 404: return None, None
        raise

def put_file(path, content_bytes, msg):
    sha, _ = get_sha(path)
    b64 = base64.b64encode(content_bytes).decode('ascii')
    payload = {'message': msg, 'content': b64, 'branch': BRANCH}
    if sha: payload['sha'] = sha
    d = json.loads(req(content_url(path), 'PUT', payload).read())
    return d

def main():
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    # 复用首次发布的 slug，覆盖写入，避免留下两个测试作品
    prior = '/tmp/v660-publish-result.json'
    if os.path.exists(prior):
        slug = json.load(open(prior, encoding='utf-8'))['slug']
    else:
        slug = now.strftime('%Y%m%d-%H%M%S') + '-剑来武夫增强工坊版'
    folder = f'{WORKS}/{slug}'

    zip_bytes = open('/tmp/v660-work.zip', 'rb').read()
    size = len(zip_bytes)
    sha256 = hashlib.sha256(zip_bytes).hexdigest()

    # README 由云境产品同款 PatchEngine.buildFourSectionBody 生成（标记格式一致）
    readme = open('/tmp/v660-readme.md', encoding='utf-8').read()
    meta = {
        'title': '剑来·武夫境界增强(工坊版)', 'author': 'e2e实测',
        'createdAt': now.isoformat(), 'baseVersion': '6.6.0',
        'license': '开源·非盈利', 'slug': slug, 'package': 'package.zip',
        'size': size, 'hash': sha256, 'changes': 1, 'containsSave': False
    }

    print('=== 写入唯一作品文件夹 ===')
    print('目标:', folder)
    for name, data in [('README.md', readme.encode('utf-8')),
                       ('meta.json', json.dumps(meta, ensure_ascii=False, indent=2).encode('utf-8')),
                       ('package.zip', zip_bytes)]:
        d = put_file(f'{folder}/{name}', data, f'二创作品[工坊版]：{name}')
        print(f'  ✓ {name}  {len(data)}B  sha={d.get("content",{}).get("sha","")[:10]}')

    print('=== 更新 catalog.json（按时间倒序）===')
    cat_items = []
    cat_sha, cat_content = get_sha(f'{WORKS}/catalog.json')
    if cat_sha:
        old = json.loads(base64.b64decode(cat_content))
        cat_items = old.get('items', []) if isinstance(old, dict) else old
    cat_items = [x for x in cat_items if x.get('slug') != slug]
    cat_items.append({
        'slug': slug, 'title': meta['title'], 'author': meta['author'],
        'createdAt': meta['createdAt'], 'summary': '为剑来世界补充武夫十一境的完整突破体系',
        'size': size, 'hash': sha256,
        'readme': f'{folder}/README.md', 'package': f'{folder}/package.zip'
    })
    cat_items.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    cat_obj = {'schema': 1, 'items': cat_items}
    put_file(f'{WORKS}/catalog.json', json.dumps(cat_obj, ensure_ascii=False, indent=2).encode('utf-8'),
             '更新二创清单：剑来武夫增强(工坊版)')
    print(f'  ✓ catalog 现有 {len(cat_items)} 件作品')

    json.dump({'slug': slug, 'folder': folder, 'size': size, 'sha256': sha256,
               'packageUrl': f'https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/{folder}/package.zip',
               'readmeUrl': f'https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/{folder}/README.md'},
              open('/tmp/v660-publish-result.json', 'w'), ensure_ascii=False)
    print('\n发布完成:', folder)

if __name__ == '__main__':
    main()
