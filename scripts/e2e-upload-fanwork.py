#!/usr/bin/env python3
"""v6.5.0 实测：把二创补丁包传到 GitHub 社区目录 + 发 Issue 记录（走 git data API，无需 Gist 权限）"""
import os, json, base64, urllib.request, urllib.error, urllib.parse, hashlib, time
TOKEN=open('/root/.codebuddy/security/gh_token.txt',encoding='utf-8').read().strip()
OWNER,REPO,BRANCH='AYun07','yunjing','main'
API='https://api.github.com'
B64=open('/tmp/e2e-patch.zip.b64',encoding='utf-8').read().strip()
PKG_PATH='community/packages/剑来武夫增强包-v6.5.0.zip.b64'

def api(method,path,body=None,retries=4):
    data=json.dumps(body).encode() if body is not None else None
    for i in range(retries):
        req=urllib.request.Request(API+path,data=data,method=method)
        req.add_header('Authorization','Bearer '+TOKEN)
        req.add_header('Accept','application/vnd.github+json')
        req.add_header('X-GitHub-Api-Version','2022-11-28')
        if data: req.add_header('Content-Type','application/json')
        try:
            with urllib.request.urlopen(req,timeout=90) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            d=e.read().decode('utf-8','replace')[:200]
            if e.code in (403,429) or 'rate limit' in d.lower(): time.sleep(4*(i+1)); continue
            if 500<=e.code<600: time.sleep(2*(i+1)); continue
            raise RuntimeError(f'{method} {path} HTTP {e.code}: {d}')
        except Exception as e:
            if i==retries-1: raise
            time.sleep(2*(i+1))

def main():
    print('=== 上传二创补丁包到 GitHub ===')
    # 1. 当前 ref/commit/tree
    ref=api('GET',f'/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}')
    sha=ref['object']['sha']
    commit=api('GET',f'/repos/{OWNER}/{REPO}/git/commits/{sha}')
    base_tree=commit['tree']['sha']
    # 2. 上传包体 blob
    content=B64.encode()
    blob=api('POST',f'/repos/{OWNER}/{REPO}/git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})
    print('  包体 blob:',blob['sha'][:12],'|',len(content),'字符')
    # 3. 建 tree（base_tree 合并，只增改不删）
    tree=api('POST',f'/repos/{OWNER}/{REPO}/git/trees',{'base_tree':base_tree,'tree':[
        {'path':PKG_PATH,'mode':'100644','type':'blob','sha':blob['sha']}
    ]})
    # 4. commit + 移动 ref
    nc=api('POST',f'/repos/{OWNER}/{REPO}/git/commits',{
        'message':'e2e: 上传二创实测补丁包（剑来武夫增强 v6.5.0）',
        'tree':tree['sha'],'parents':[sha]})
    api('PATCH',f'/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}',{'sha':nc['sha'],'force':False})
    print('  新 commit:',nc['sha'][:12])
    raw_url=f'https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/'+urllib.parse.quote(PKG_PATH)
    # 5. 发 Issue（带标签，若标签不存在先建）
    try:
        api('POST',f'/repos/{OWNER}/{REPO}/labels',{'name':'二创投稿','color':'f4d896','description':'玩家二创作品'})
    except Exception: pass
    body=('<!--YJ_NOTE-->\n真机实测二创包：剑来·武夫十一境增强。含 DLC、插件清单、图标资源包、'
          '一段 4 消息的真实对话存档。基于云境 v6.5.0，按增量补丁格式打包（8 项改动）。\n<!--/YJ_NOTE-->\n'
          '<!--YJ_GIST-->'+json.dumps({'rawUrl':raw_url,'path':PKG_PATH,'host':'repo'})+'<!--/YJ_GIST-->\n'
          '\n---\n由云境二创版块真机实测自动发布 · 开源非盈利 · 风险自负')
    iss=api('POST',f'/repos/{OWNER}/{REPO}/issues',{'title':'[二创实测] 剑来·武夫十一境增强包 v6.5.0','body':body,'labels':['二创投稿']})
    print('  Issue #'+str(iss.get('number')),'|',iss.get('html_url'))
    # 6. 写回元信息供核验脚本
    json.dump({'commit':nc['sha'],'path':PKG_PATH,'rawUrl':raw_url,'issue':iss.get('number'),
               'issueUrl':iss.get('html_url'),'sha256':hashlib.sha256(content).hexdigest(),'b64len':len(content)},
              open('/tmp/e2e-upload-result.json','w'),ensure_ascii=False,indent=2)
    print('  已保存上传结果 /tmp/e2e-upload-result.json')

if __name__=='__main__': main()
