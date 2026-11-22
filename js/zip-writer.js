/* ============================================================
 * 云境 · 轻量 ZIP 打包器 v1.0（v6.4.0 二创版块）
 * ------------------------------------------------------------
 * 零第三方依赖。用浏览器原生 CompressionStream('deflate-raw') 压缩，
 * 不支持时回退 STORE（不压缩）。写标准 ZIP 结构：本地文件头 + 中央目录 + EOCD。
 * 用途：把玩家二创内容（增量包 / 桌面授权后的完整源码）打成 .zip 供下载与投稿。
 * 版权：云境独立实现，无第三方源码。CRC32 用标准多项式表。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- CRC32 ---------- */
  var CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }
  function crc32(u8) {
    var t = crcTable(), c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function enc(str) { return new TextEncoder().encode(str); }
  function canDeflate() { return typeof CompressionStream !== 'undefined'; }
  async function deflateRaw(u8) {
    if (!canDeflate()) return null;
    try {
      var cs = new CompressionStream('deflate-raw');
      var stream = new Blob([u8]).stream().pipeThrough(cs);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { return null; }
  }

  /* DOS 时间/日期 */
  function dosTime(d) {
    return ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  }

  function put16(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }
  function put32(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; a[o + 2] = (v >>> 16) & 255; a[o + 3] = (v >>> 24) & 255; }

  /**
   * 打包 entries -> Uint8Array(zip)
   * entries: [{ name:'a/b.txt', data: Uint8Array|string }]
   */
  async function makeZip(entries) {
    entries = (entries || []).filter(function (e) { return e && e.name; });
    var now = new Date();
    var t = dosTime(now), dt = dosDate(now);
    var locals = [], centrals = [];
    var offset = 0;

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var nameBytes = enc(e.name);
      var raw = typeof e.data === 'string' ? enc(e.data) : (e.data || new Uint8Array(0));
      var comp = await deflateRaw(raw);
      var method = comp ? 8 : 0;             // 8=DEFLATE, 0=STORE
      var payload = comp || raw;
      var crc = crc32(raw);

      /* 本地文件头 30 + name */
      var lh = new Uint8Array(30 + nameBytes.length);
      put32(lh, 0, 0x04034b50);
      put16(lh, 4, 20);                       // version needed
      put16(lh, 6, 0x0800);                   // UTF-8 flag
      put16(lh, 8, method);
      put16(lh, 10, t); put16(lh, 12, dt);
      put32(lh, 14, crc);
      put32(lh, 18, payload.length);
      put32(lh, 22, raw.length);
      put16(lh, 26, nameBytes.length);
      put16(lh, 28, 0);
      lh.set(nameBytes, 30);
      locals.push(lh, payload);

      /* 中央目录头 46 + name */
      var ch = new Uint8Array(46 + nameBytes.length);
      put32(ch, 0, 0x02014b50);
      put16(ch, 4, 20); put16(ch, 6, 20);
      put16(ch, 8, 0x0800); put16(ch, 10, method);
      put16(ch, 12, t); put16(ch, 14, dt);
      put32(ch, 16, crc);
      put32(ch, 20, payload.length);
      put32(ch, 24, raw.length);
      put16(ch, 28, nameBytes.length);
      put16(ch, 30, 0); put16(ch, 32, 0);
      put16(ch, 34, 0); put16(ch, 36, 0);
      put32(ch, 38, 0);
      put32(ch, 42, offset);
      ch.set(nameBytes, 46);
      centrals.push(ch);

      offset += lh.length + payload.length;
    }

    var cdSize = 0;
    centrals.forEach(function (c) { cdSize += c.length; });
    var eocd = new Uint8Array(22);
    put32(eocd, 0, 0x06054b50);
    put16(eocd, 8, entries.length);
    put16(eocd, 10, entries.length);
    put32(eocd, 12, cdSize);
    put32(eocd, 16, offset);

    var total = offset + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    locals.forEach(function (b) { out.set(b, p); p += b.length; });
    centrals.forEach(function (b) { out.set(b, p); p += b.length; });
    out.set(eocd, p);
    return out;
  }

  /* ---------- 解包（v6.5.0 增量补丁下载端） ---------- */
  function get16(a, o) { return a[o] | (a[o + 1] << 8); }
  function get32(a, o) { return (a[o] | (a[o + 1] << 8) | (a[o + 2] << 16) | (a[o + 3] << 24)) >>> 0; }

  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('当前环境不支持解压（DecompressionStream 不可用）');
    try {
      var ds = new DecompressionStream('deflate-raw');
      var stream = new Blob([u8]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { throw new Error('解压失败：' + (e && e.message || e)); }
  }

  /**
   * 解包 zip -> [{name, data:Uint8Array}]
   * 支持 STORE(0)/DEFLATE(8)；用中央目录定位，校验签名，CRC 校验。
   */
  async function unzip(u8) {
    if (!u8 || u8.length < 22) throw new Error('不是有效的 zip（过小）');
    // 找 EOCD（从尾部最多搜 64KB）
    var eocd = -1, min = Math.max(0, u8.length - 22 - 65535);
    for (var i = u8.length - 22; i >= min; i--) {
      if (get32(u8, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('未找到 zip 结束记录（EOCD）');
    var count = get16(u8, eocd + 10);
    var cdOff = get32(u8, eocd + 16);
    var out = [], p = cdOff;
    for (var n = 0; n < count; n++) {
      if (get32(u8, p) !== 0x02014b50) throw new Error('中央目录签名错误 @' + p);
      var method = get16(u8, p + 10);
      var crc = get32(u8, p + 16);
      var csize = get32(u8, p + 20);
      var usize = get32(u8, p + 24);
      var nameLen = get16(u8, p + 28);
      var extraLen = get16(u8, p + 30);
      var commentLen = get16(u8, p + 32);
      var localOff = get32(u8, p + 42);
      var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      // 本地头
      if (get32(u8, localOff) !== 0x04034b50) throw new Error('本地文件头签名错误：' + name);
      var lnameLen = get16(u8, localOff + 26);
      var lextraLen = get16(u8, localOff + 28);
      var dataStart = localOff + 30 + lnameLen + lextraLen;
      var comp = u8.subarray(dataStart, dataStart + csize);
      var raw;
      if (method === 0) raw = comp;
      else if (method === 8) raw = await inflateRaw(comp);
      else throw new Error('不支持的压缩方式 ' + method + '：' + name);
      if (usize && raw.length !== usize) throw new Error('解压长度不符：' + name + ' (' + raw.length + '≠' + usize + ')');
      if (raw.length && crc32(raw) !== crc) throw new Error('CRC 校验失败：' + name);
      out.push({ name: name, data: raw });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  /** 把解包项转为字符串文本（manifest / 内容 JSON 用） */
  function entryText(entry) {
    if (!entry) return '';
    return new TextDecoder().decode(entry.data || new Uint8Array(0));
  }

  function toBlob(u8) { return new Blob([u8], { type: 'application/zip' }); }
  function download(u8, filename) {
    var blob = toBlob(u8), url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'yunjing-fanwork.zip';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  globalThis.ZipWriter = {
    makeZip: makeZip, crc32: crc32, toBlob: toBlob, download: download,
    unzip: unzip, entryText: entryText,
    _canDeflate: canDeflate, _canInflate: function () { return typeof DecompressionStream !== 'undefined'; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.ZipWriter;
})();
