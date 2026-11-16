#!/usr/bin/env node
/**
 * 云境 · 版本归档同步器
 *
 * 作用：把仓库里已有的每个 git 标签，在 GitHub 上补成一个 Release。
 * GitHub 会为每个 Release 自动生成「Source code (zip) / (tar.gz)」，
 * 那就是该版本 100% 完整的内容包（含 js/ css/ assets/ 全部目录），无需再往仓库里塞压缩包。
 *
 * 用法：
 *   GITHUB_TOKEN=xxx node scripts/sync-releases.mjs --dry
 *   GITHUB_TOKEN=xxx node scripts/sync-releases.mjs
 *
 * 幂等：已存在的 release 跳过，可反复执行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.GITHUB_REPO || 'AYun07/yunjing';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const DRY = process.argv.includes('--dry');

const cmp = (a, b) => {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

/** 从 VERSIONS.md 解析出版本说明：{ 'v3.84.0': { date, desc } } */
function parseVersions() {
  const file = path.join(ROOT, 'VERSIONS.md');
  const out = {};
  if (!fs.existsSync(file)) return out;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## (v\d+\.\d+\.\d+)\s*[·・]?\s*(\d{4}-\d{2}-\d{2})?/);
    if (!m) continue;
    const ver = m[1];
    const date = m[2] || '';
    const buf = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^## /.test(lines[j])) break;
      if (/^- \[📂/.test(lines[j])) break;
      const t = lines[j].trim();
      if (t && t !== '---') buf.push(t);
    }
    out[ver] = { date, desc: buf.join('\n\n') };
  }
  return out;
}

async function api(url, opts = {}, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          Authorization: `token ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      });
      if (res.status === 204) return { ok: true, data: null };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${data.message || ''}`);
      return { ok: true, data };
    } catch (e) {
      if (i === tries) return { ok: false, error: e.message };
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
}

async function allTags() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const r = await api(`https://api.github.com/repos/${REPO}/tags?per_page=100&page=${page}`);
    if (!r.ok) throw new Error('取标签失败：' + r.error);
    if (!r.data.length) break;
    out.push(...r.data);
    if (r.data.length < 100) break;
  }
  return out;
}

async function allReleases() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const r = await api(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`);
    if (!r.ok) throw new Error('取发布失败：' + r.error);
    if (!r.data.length) break;
    out.push(...r.data);
    if (r.data.length < 100) break;
  }
  return out;
}

function bodyFor(ver, prev, info, tagSha) {
  const head = info?.desc ? info.desc : `版本 ${ver} 完整快照。`;
  const lines = [head, '', '---', ''];
  lines.push('**完整内容包**：本页 Assets 里的 `Source code (zip)` 即该版本全部文件（`js/` `css/` `assets/` `libs/` 及全部页面），下载解压即是一份可直接运行的完整工程，无需拼装。');
  if (prev) lines.push('', `**与上一版差异**：https://github.com/${REPO}/compare/${prev}...${ver}`);
  lines.push('', `**在线预览该版源码**：https://github.com/${REPO}/tree/${ver}`);
  return lines.join('\n');
}

const main = async () => {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN');
    process.exit(1);
  }
  const versions = parseVersions();
  const tags = (await allTags()).map((t) => t.name).filter((n) => /^v\d+\.\d+\.\d+$/.test(n));
  tags.sort(cmp);
  const rels = await allReleases();
  const have = new Set(rels.map((r) => r.tag_name));
  const latest = tags[tags.length - 1];

  console.log(`标签 ${tags.length} 个，已有发布 ${rels.length} 个，待补 ${tags.filter((t) => !have.has(t)).length} 个`);
  let ok = 0, skip = 0, bad = 0;

  for (let i = 0; i < tags.length; i++) {
    const ver = tags[i];
    if (have.has(ver)) { skip++; continue; }
    const prev = i > 0 ? tags[i - 1] : null;
    const info = versions[ver] || null;
    const payload = {
      tag_name: ver,
      name: `云境 ${ver}`,
      body: bodyFor(ver, prev, info, null),
      draft: false,
      prerelease: false,
      make_latest: ver === latest ? 'true' : 'false',
    };
    if (DRY) {
      console.log(`[dry] 将创建 ${ver}（上一版 ${prev || '无'}）`);
      ok++;
      continue;
    }
    const r = await api(`https://api.github.com/repos/${REPO}/releases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      ok++;
      console.log(`✓ ${ver}  ${info?.date || ''}`);
    } else {
      bad++;
      console.log(`✗ ${ver}  ${r.error}`);
    }
    await new Promise((res) => setTimeout(res, 400));
  }

  console.log(`\n完成：新建 ${ok}，跳过 ${skip}，失败 ${bad}`);
  console.log(`仓库发布页：https://github.com/${REPO}/releases`);
};

main().catch((e) => {
  console.error('失败：', e.message);
  process.exit(1);
});
