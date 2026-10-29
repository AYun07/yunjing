(function() {
  "use strict";
  const CardIO = {
    esc(s) {
      return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /* ==================== PNG tEXt 块底层读写 ==================== */
    /** CRC32（PNG 块校验，IEEE 802.3 多项式） */
    _crcTable: null,
    _makeCrcTable() {
      if (this._crcTable) return this._crcTable;
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        t[n] = c >>> 0;
      }
      this._crcTable = t;
      return t;
    },
    crc32(bytes, start = 0, end = bytes.length) {
      const t = this._makeCrcTable();
      let c = 4294967295;
      for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 255] ^ c >>> 8;
      return (c ^ 4294967295) >>> 0;
    },
    /** UTF-8 编码（TextEncoder 缺席的罕见环境兜底走 unescape 老路） */
    _utf8(str) {
      if (window.TextEncoder) return new TextEncoder().encode(str);
      const bin = unescape(encodeURIComponent(str));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    },
    /**
     * 解析 PNG，抽出全部 tEXt 块
     * @returns {{width,height,texts:{keyword:string,bytes:Uint8Array}[]}|null}
     *          非法 PNG（签名/IHDR 缺失）返回 null
     */
    parsePng(buf) {
      try {
        const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < 8; i++) if (u8[i] !== SIG[i]) return null;
        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        let off = 8;
        let width = 0, height = 0, first = true;
        const texts = [];
        while (off + 12 <= u8.length) {
          const len = dv.getUint32(off);
          if (off + 12 + len > u8.length) break;
          const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
          if (first && type !== "IHDR") return null;
          if (type === "IHDR") {
            width = dv.getUint32(off + 8);
            height = dv.getUint32(off + 12);
          }
          if (type === "tEXt") {
            const data = u8.subarray(off + 8, off + 8 + len);
            const z = data.indexOf(0);
            if (z > 0) {
              const kw = this._latin1(data.subarray(0, z));
              texts.push({ keyword: kw, bytes: data.subarray(z + 1) });
            }
          }
          if (type === "IEND") break;
          first = false;
          off += 12 + len;
        }
        return { width, height, texts };
      } catch (e) {
        console.error("[CardIO] PNG 解析失败:", e);
        return null;
      }
    },
    /** Latin-1（ISO-8859-1）解码——tEXt 块正文按单字节直读 */
    _latin1(bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    },
    /**
     * 向 PNG 写入/替换 tEXt 块（keyword 相同则替换，保持其它块原样）
     * 只处理基础场景：不含 zlib 压缩的 tEXt 直插。写入位置在 IHDR 之后、
     * 其余数据块之前（规范允许任意位置，ST 亦读任意位置）。
     * @returns {Uint8Array|null} 新 PNG 字节流；目标非 PNG 返回 null
     */
    writeTextChunk(pngBytes, keyword, textBytes) {
      const parsed = this.parsePng(pngBytes);
      if (!parsed) return null;
      const IHDR_END = 33;
      const u8 = pngBytes instanceof Uint8Array ? pngBytes : new Uint8Array(pngBytes);
      const kw = this._utf8(keyword);
      const body = new Uint8Array(kw.length + 1 + textBytes.length);
      body.set(kw, 0);
      body[kw.length] = 0;
      body.set(textBytes, kw.length + 1);
      const typeBytes = this._utf8("tEXt");
      const chunk = new Uint8Array(12 + body.length);
      const dv = new DataView(chunk.buffer);
      dv.setUint32(0, body.length);
      chunk.set(typeBytes, 4);
      chunk.set(body, 8);
      const crc = this.crc32(chunk, 4, 8 + body.length);
      dv.setUint32(8 + body.length, crc);
      const rest = this._stripTextChunks(u8, keyword);
      const head = rest.subarray(0, IHDR_END);
      const tail = rest.subarray(IHDR_END);
      const out = new Uint8Array(head.length + chunk.length + tail.length);
      out.set(head, 0);
      out.set(chunk, head.length);
      out.set(tail, head.length + chunk.length);
      return out;
    },
    /** 剔除指定 keyword 的 tEXt 块（不校验 CRC，块结构信任解析结果） */
    _stripTextChunks(u8, keyword) {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      let off = 8;
      const keep = [u8.subarray(0, 8)];
      while (off + 12 <= u8.length) {
        const len = dv.getUint32(off);
        if (off + 12 + len > u8.length) break;
        const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
        let drop = false;
        if (type === "tEXt") {
          const data = u8.subarray(off + 8, off + 8 + len);
          const z = data.indexOf(0);
          if (z > 0 && this._latin1(data.subarray(0, z)) === keyword) drop = true;
        }
        if (!drop) keep.push(u8.subarray(off, off + 12 + len));
        if (type === "IEND") break;
        off += 12 + len;
      }
      let total = 0;
      keep.forEach((s) => total += s.length);
      const out = new Uint8Array(total);
      let pos = 0;
      keep.forEach((s) => {
        out.set(s, pos);
        pos += s.length;
      });
      return out;
    },
    /* ==================== 卡数据层（Base64 ↔ JSON） ==================== */
    /** Base64 → bytes（纯手写，兼容 Node/Browser 两头跑测试；含 URL-safe 变体归一） */
    b64ToBytes(b64) {
      const s = String(b64 || "").replace(/^data:[^,]*,/, "").replace(/[\r\n\s]/g, "").replace(/-/g, "+").replace(/_/g, "/");
      const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let bits = 0, acc = 0;
      const out = [];
      for (let i = 0; i < s.length; i++) {
        const v = B.indexOf(s[i]);
        if (v < 0) continue;
        acc = acc << 6 | v;
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          out.push(acc >> bits & 255);
        }
      }
      return new Uint8Array(out);
    },
    /** bytes → Base64 */
    bytesToB64(bytes) {
      const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let s = "";
      for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
        const has1 = i + 1 < bytes.length, has2 = i + 2 < bytes.length;
        s += B[b0 >> 2];
        s += B[(b0 & 3) << 4 | (has1 ? b1 >> 4 : 0)];
        s += has1 ? B[(b1 & 15) << 2 | (has2 ? b2 >> 6 : 0)] : "=";
        s += has2 ? B[b2 & 63] : "=";
      }
      return s;
    },
    /** bytes → UTF-8 字符串 */
    bytesToUtf8(bytes) {
      if (window.TextDecoder) {
        try {
          return new TextDecoder("utf-8").decode(bytes);
        } catch (e) {
        }
      }
      let s = "";
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i];
        if (b < 128) {
          s += String.fromCharCode(b);
          i += 1;
        } else if (b < 224) {
          s += String.fromCharCode((b & 31) << 6 | bytes[i + 1] & 63);
          i += 2;
        } else if (b < 240) {
          s += String.fromCharCode((b & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
          i += 3;
        } else {
          const cp = (b & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63;
          s += String.fromCodePoint(cp - 65536 + 65536);
          i += 4;
        }
      }
      return s;
    },
    /* ==================== 卡结构归一化（V2/V3 双兼容） ==================== */
    /**
     * 宽松取卡数据：V3 是 { spec:'chara_card_v3', data:{...} }，
     * V2 是 { spec:'chara_card_v2', data:{...} }，老卡甚至直接扁平。
     */
    cardData(card) {
      if (!card || typeof card !== "object") return {};
      if (card.data && typeof card.data === "object") return card.data;
      return card;
    },
    /** 卡规范版本号：3 / 2 / 0（无 spec 字段的老扁平卡） */
    specVer(card) {
      const spec = String((card == null ? void 0 : card.spec) || "");
      if (/v3/i.test(spec)) return 3;
      if (/v2/i.test(spec)) return 2;
      if ((card == null ? void 0 : card.data) && typeof card.data === "object") return 2;
      return 0;
    },
    /**
     * 从 PNG 字节流读卡
     * @returns {{card:object, ver:number, keyword:string}|null}
     */
    readCard(pngBuf) {
      const png = this.parsePng(pngBuf);
      if (!png) return null;
      const hit = png.texts.find((t) => t.keyword === "ccv3") || png.texts.find((t) => t.keyword === "chara");
      if (!hit) return null;
      const card = this._parseCardText(hit);
      if (!card) return null;
      return { card, ver: this.specVer(card), keyword: hit.keyword };
    },
    /**
     * tEXt 正文 → 卡对象，双格式自适应：
     *   ① UTF-8 JSON 直读（V3 ccv3 规范 + 本引擎导出的裸 JSON）
     *   ② Base64 解码再读（V2 chara 事实标准——ST / Chub / RisuAI 导出的卡
     *      一律是 Base64(UTF-8 JSON)，且常见 URL-safe 变体；JSON 含 {}": 等字符
     *      不可能通过 Base64 词表嗅探，故先直读失败再走解码不会误伤）
     */
    _parseCardText(hit) {
      try {
        const card = JSON.parse(this.bytesToUtf8(hit.bytes));
        if (card && typeof card === "object") return card;
      } catch (e) {
      }
      const asText = this._latin1(hit.bytes).trim();
      if (!asText || !/^[A-Za-z0-9+/\-_=\s]+$/.test(asText)) return null;
      try {
        const card = JSON.parse(this.bytesToUtf8(this.b64ToBytes(asText)));
        if (card && typeof card === "object") return card;
      } catch (e) {
        console.error("[CardIO] 卡 JSON 解析失败（UTF-8 与 Base64 均不通过）:", e);
      }
      return null;
    },
    /** 归一化：扁平化各实现差异（RisuAI 的 alternate_greetings 数组习惯等） */
    normalize(card) {
      const d = this.cardData(card);
      const book = d.character_book || d.characterBook || null;
      return {
        name: String(d.name || "").trim(),
        description: String(d.description || ""),
        personality: String(d.personality || ""),
        scenario: String(d.scenario || ""),
        first_mes: String(d.first_mes || d.firstMes || ""),
        mes_example: String(d.mes_example || d.mesExample || ""),
        creator_notes: String(d.creator_notes || d.creatorNotes || ""),
        system_prompt: String(d.system_prompt || d.systemPrompt || ""),
        post_history_instructions: String(d.post_history_instructions || ""),
        tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
        creator: String(d.creator || ""),
        character_version: String(d.character_version || d.characterVersion || ""),
        alternate_greetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings.map(String) : [],
        book: this.normalizeBook(book)
      };
    },
    /** 世界书归一化（V2 character_book → 统一内部结构） */
    normalizeBook(book) {
      var _a, _b;
      if (!book || typeof book !== "object") return null;
      const entries = Array.isArray(book.entries) ? book.entries : book.entries && typeof book.entries === "object" ? Object.values(book.entries) : [];
      return {
        name: String(book.name || ""),
        description: String(book.description || ""),
        scanDepth: Number((_b = (_a = book.scan_depth) != null ? _a : book.scanDepth) != null ? _b : 0) || 0,
        entries: entries.filter((e) => e && typeof e === "object").map((e) => {
          var _a2, _b2;
          return {
            keys: (Array.isArray(e.keys) ? e.keys : [e.key]).filter((k) => k != null && String(k).trim()).map(String),
            content: String(e.content || ""),
            enabled: e.enabled !== false && e.disable !== true,
            constant: !!e.constant,
            insertionOrder: Number((_b2 = (_a2 = e.insertion_order) != null ? _a2 : e.insertionOrder) != null ? _b2 : 100) || 100
          };
        }).filter((e) => e.content)
      };
    },
    /** 生成 V3 标准卡对象（云境 → 外部） */
    buildV3({
      name,
      description,
      personality,
      scenario,
      first_mes,
      mes_example,
      creator_notes,
      system_prompt,
      tags,
      creator,
      character_version,
      alternate_greetings,
      book
    }) {
      const d = {
        name: String(name || ""),
        description: String(description || ""),
        personality: String(personality || ""),
        scenario: String(scenario || ""),
        first_mes: String(first_mes || ""),
        mes_example: String(mes_example || ""),
        creator_notes: String(creator_notes || ""),
        system_prompt: String(system_prompt || ""),
        post_history_instructions: "",
        tags: Array.isArray(tags) ? tags.map(String) : [],
        creator: String(creator || "云境"),
        character_version: String(character_version || ""),
        extensions: { yunjing: { genre: this._genre() }, moshu: { genre: this._genre() } }
      };
      if (Array.isArray(alternate_greetings) && alternate_greetings.length) {
        d.alternate_greetings = alternate_greetings.map(String);
      }
      if (book && book.entries && book.entries.length) {
        d.character_book = {
          name: String(book.name || `${name}的世界书`),
          description: String(book.description || "由云境导出"),
          scan_depth: 4,
          entries: book.entries.map((e, i) => ({
            keys: e.keys,
            content: e.content,
            enabled: true,
            insertion_order: e.insertionOrder || 100 + i,
            case_sensitive: false,
            constant: !!e.constant
          }))
        };
      }
      return { spec: "chara_card_v3", spec_version: "3.0", data: d, ...{ ccv3: void 0 } };
    },
    _genre() {
      var _a;
      try {
        const g = new URLSearchParams(location.search).get("genre");
        return g || ((_a = window.storyFramework) == null ? void 0 : _a.genre) || "free";
      } catch (e) {
        return "free";
      }
    },
    /**
     * 卡 → PNG 字节流（双标识写入，老前端读 chara、新前端读 ccv3）
     *   ccv3 ：V3 规范——tEXt 直存 UTF-8 JSON
     *   chara：V2 事实标准——tEXt 存 Base64(UTF-8 JSON)（ST / Chub / RisuAI 的
     *          读取口径；Base64 纯 ASCII，天然满足 tEXt 的 Latin-1 安全约束）
     * @param {Uint8Array|null} basePng 底图（null 时用 1×1 透明像素占位）
     */
    async writeCard(cardObj, basePng) {
      let png = basePng;
      if (!png) png = this._placeholderPng();
      const jsonBytes = this._utf8(JSON.stringify(cardObj));
      let out = this.writeTextChunk(png, "ccv3", jsonBytes);
      if (!out) return null;
      out = this.writeTextChunk(out, "chara", this._utf8(this.bytesToB64(jsonBytes)));
      return out;
    },
    /** 1×1 透明 PNG（无立绘可导时的底图占位） */
    _placeholderPng() {
      const ihdr = [0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137];
      const idat = [0, 0, 0, 12, 73, 68, 65, 84, 120, 156, 98, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180];
      const iend = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
      return new Uint8Array([...[137, 80, 78, 71, 13, 10, 26, 10], ...ihdr, ...idat, ...iend]);
    },
    /* ==================== 文件落盘 / 读入 ==================== */
    /** 触发浏览器下载 */
    download(bytes, filename) {
      const blob = new Blob([bytes], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "card.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5e3);
    },
    /** File → ArrayBuffer（Promise） */
    readAsBytes(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(new Uint8Array(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsArrayBuffer(file);
      });
    }
  };
  window.CardIO = CardIO;
})();
