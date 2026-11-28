/* 云境 · 每界「入世封面」WorldPortal v1.0.0（v4.28.0）
 * ---------------------------------------------------------------------------
 * 主内容区空状态时（尚未配置模型 / 开局未落笔）显示一屏沉浸式世界封面，
 * 替代原来「大片空白 + 一条冷提示」。每界按题材骨架生成不同意境场景：
 *   玄幻云海 / 网游HUD / 都市天际 / 科幻星域 / 克苏鲁深渊 / 武侠江湖 / 蒸汽齿轮 / 恐怖档案
 * 全部为纯 CSS + 内联 SVG，无外部图片依赖；文案是通用入世引导，非假正文、非原著专名。
 * 有真实对话卡片后自动隐藏，不干扰正常创作。
 */
(function () {
  'use strict';

  var CN = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function genreKey() {
    try {
      var q = new URLSearchParams(location.search).get('genre');
      if (q) return q;
      var fw = window.storyFramework;
      return (fw && (fw.genre || (fw.config && fw.config.genre))) || 'free';
    } catch (e) { return 'free'; }
  }
  function zhName() {
    /* v7.6.3：与 card-hub/dlc-manager/knowledge-manager 统一 genreName 权威来源。
     * 原实现只读 storyFramework.config.genreName，当该对象尚未就绪（如 mystery 界
     * 首次进入、config 挂载时序晚于本模块渲染）时兜底成「未知世界」，玩家看到标题
     * 不跟随 config。改为优先 GenreStoryConfig（各 config 通用导出名），再退 storyFramework。 */
    try {
      var g = window.GenreStoryConfig;
      if (g && g.genreName) return g.genreName;
      var fw = window.storyFramework;
      return (fw && fw.config && fw.config.genreName) || '未知世界';
    } catch (e) { return '未知世界'; }
  }
  /* v7.0.5：选定身份后把主角名带进世界门面，让「你是谁」和「在哪一界」对得上 */
  function heroName() {
    try {
      var ST = window.StoryStance;
      if (ST) {
        var mode = ST.get && ST.get();
        if (mode === 'side') {
          var side = ST.getSideCharInfo && ST.getSideCharInfo();
          if (side && side.name) return side.name;
        }
        if (mode === 'hero') {
          var canon = ST.canonHeroName && ST.canonHeroName();
          if (canon) return canon;
        }
      }
      var bio = document.getElementById('wiz_heroBio');
      if (bio && bio.value) {
        var m = bio.value.match(/姓名[：:]\s*([^\n，。；;]{1,12})/);
        if (m && m[1]) return m[1].trim();
      }
    } catch(e){console.warn("[swallowed] world-portal",e)}
    return '';
  }
  function worldInfo() {
    var k = genreKey();
    var SS = window.StatusSkins;
    var w = (SS && SS.worldOf) ? SS.worldOf(k) : { c: '#e0a84c', s: '境', m: '随心所至 · 万象由心' };
    var arch = (SS && SS.skinOf) ? SS.skinOf(k) : 'xianxia';
    return { key: k, name: zhName(), c: w.c, s: w.s, m: w.m, arch: arch, hero: heroName() };
  }

  /* 每界入世引导语（通用意境，非原著专名，按题材） */
  var LEAD = {
    xianxia: '长路漫漫，修行自此始',
    youxi:   '角色已就绪，等待你的第一道指令',
    dushi:   '城市的这一页，由你来写',
    keji:    '链路已建立，前方是未知星域',
    kepfu:   '你睁眼的那一刻，它便开始注视你',
    wuxia:   '江湖路远，且问这一程去往何处',
    zhengqi: '魔导核心已预热，等待驱动',
    kongbu:  '卷宗已启封，真相藏在字缝之间'
  };

  /* 每界意境场景：返回一层背景 HTML（绝对定位、z-index:0） */
  function sceneHTML(arch) {
    switch (arch) {
      case 'xianxia': /* 云海仙山 + 太极 + 孤月 */
        return '<div class="wp-scene wp-xianxia">' +
          '<div class="wp-sun"></div><div class="wp-mount m1"></div><div class="wp-mount m2"></div>' +
          '<div class="wp-cloud c1"></div><div class="wp-cloud c2"></div><div class="wp-cloud c3"></div>' +
          '<div class="wp-taiji">☯</div>' +
          '<div class="wp-glyph">道</div></div>';
      case 'youxi': /* 技能环 + 网格 + 血条 */
        return '<div class="wp-scene wp-youxi">' +
          '<div class="wp-grid"></div><div class="wp-hud-ring"><i></i><b></b></div>' +
          '<div class="wp-skill s1">✦</div><div class="wp-skill s2">⚔</div><div class="wp-skill s3">✧</div>' +
          '<div class="wp-glyph">战</div></div>';
      case 'dushi': /* 天际线 + 霓虹 + 车流光轨 */
        return '<div class="wp-scene wp-dushi">' +
          '<div class="wp-sky"></div><div class="wp-city">' +
          '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
          '<div class="wp-trail"></div><div class="wp-glyph">城</div></div>';
      case 'keji': /* 星域 + 网格地平线 + 雷达 + 数据流 */
        return '<div class="wp-scene wp-keji">' +
          '<div class="wp-stars"></div><div class="wp-horizon"></div>' +
          '<div class="wp-radar"><b></b><i></i></div>' +
          '<div class="wp-stream">01001101 10110 0110 11010 00101 11100 01101 1001 00110 10101</div>' +
          '<div class="wp-glyph">宇</div></div>';
      case 'kepfu': /* 深渊漩涡 + 触手 + 凝视之眼 + 诡符 */
        return '<div class="wp-scene wp-kepfu">' +
          '<div class="wp-vortex"></div><div class="wp-tentacle t1"></div><div class="wp-tentacle t2"></div>' +
          '<div class="wp-eye">👁</div><div class="wp-runes">☾ ✦ ⚝ ⟡ ☿ ♄ ✧ ☽</div>' +
          '<div class="wp-glyph">渊</div></div>';
      case 'wuxia': /* 水墨远山 + 竹影 + 剑气 + 朱砂 */
        return '<div class="wp-scene wp-wuxia">' +
          '<div class="wp-inkmount"></div><div class="wp-bamboo b1"></div><div class="wp-bamboo b2"></div>' +
          '<div class="wp-sword"></div><div class="wp-redseal">侠</div>' +
          '<div class="wp-glyph">侠</div></div>';
      case 'zhengqi': /* 齿轮 + 黄铜光 + 蒸汽 */
        return '<div class="wp-scene wp-zhengqi">' +
          '<div class="wp-gear g1">⚙</div><div class="wp-gear g2">⚙</div><div class="wp-gear g3">⚙</div>' +
          '<div class="wp-steam"></div><div class="wp-glyph">灵</div></div>';
      case 'kongbu': /* 昏暗档案 + 血印 + 机密章 */
        return '<div class="wp-scene wp-kongbu">' +
          '<div class="wp-paper"></div><div class="wp-handprint">✋</div>' +
          '<div class="wp-confid">机 密</div><div class="wp-glyph">谜</div></div>';
      default:
        return '<div class="wp-scene wp-xianxia"><div class="wp-sun"></div><div class="wp-glyph">境</div></div>';
    }
  }

  var CSS = `
/* ===== 每界世界扉页 WorldPortal v1.0.0（挂在开局设定台上方） ===== */
#setupWrap{position:relative}
.wp-portal{position:relative;height:206px;flex:none;display:flex;align-items:center;
  padding:22px 30px;margin:0 0 16px;overflow:hidden;isolation:isolate;text-align:left;
  border-radius:14px;border:1px solid color-mix(in srgb,var(--wpri) 30%,transparent);
  box-shadow:0 10px 34px rgba(0,0,0,.28),inset 0 0 40px color-mix(in srgb,var(--wpri) 10%,transparent);
  color:var(--text,#e8dcc0)}
.wp-portal::before{content:"";position:absolute;inset:-40px;z-index:-2;pointer-events:none;
  background:radial-gradient(ellipse 46% 90% at 12% 50%,var(--wpri-glow,rgba(224,168,76,.18)),transparent 72%)}
.wp-portal::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(90deg,rgba(0,0,0,.28),transparent 62%)}
.wp-scene{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.wp-glyph{position:absolute;right:4%;top:50%;transform:translateY(-50%);
  font:700 clamp(150px,20vw,250px) "STKaiti","KaiTi",serif;line-height:1;
  color:var(--wpri);opacity:.07;white-space:nowrap;user-select:none}

/* 内容：左对齐竖排 */
.wp-inner{position:relative;z-index:2;max-width:70%;display:flex;flex-direction:column;align-items:flex-start}
.wp-sig{width:52px;height:52px;display:grid;place-items:center;margin-bottom:12px;
  font:700 30px "STKaiti","KaiTi",serif;color:#fff;border-radius:9px;
  background:linear-gradient(145deg,color-mix(in srgb,var(--wpri) 92%,#fff),color-mix(in srgb,var(--wpri) 74%,#000));
  border:1px solid color-mix(in srgb,var(--wpri) 60%,#fff);
  box-shadow:0 0 26px var(--wpri-glow),inset 0 0 0 2px rgba(255,255,255,.16);
  animation:wpFloat 5s ease-in-out infinite}
@keyframes wpFloat{50%{transform:translateY(-6px)}}
.wp-eyebrow{font-size:10px;letter-spacing:.42em;text-indent:.42em;color:var(--wpri);opacity:.85;margin-bottom:8px}
.wp-title{font:700 clamp(26px,4vw,38px) "STKaiti","KaiTi",serif;letter-spacing:.2em;text-indent:.2em;
  color:var(--wpri);text-shadow:0 0 26px var(--wpri-glow);margin:0 0 6px;line-height:1.3}
.wp-hero-tag{font-size:.5em;font-weight:400;letter-spacing:.08em;text-indent:0;margin-left:.5em;
  color:var(--text-muted,#b9ad93);text-shadow:none;vertical-align:middle}
.wp-motto{font:13px "STKaiti","KaiTi",serif;letter-spacing:.16em;color:var(--text,#e8dcc0);opacity:.8;margin-bottom:4px}
.wp-lead{font-size:12px;line-height:1.7;color:var(--text-muted,#b9ad93);opacity:.82;max-width:46ch;margin:4px 0 0}
.wp-divider{width:90px;height:1px;margin:12px 0;
  background:linear-gradient(90deg,var(--wpri),transparent);opacity:.6;position:relative}
.wp-portal .wp-cta,.wp-portal .wp-hint{display:none}

/* ---------- 1 玄幻：云海仙山 + 孤月 + 太极 ---------- */
.wp-xianxia{background:linear-gradient(180deg,rgba(10,28,28,.2),transparent 42%,rgba(8,22,20,.5))}
.wp-sun{position:absolute;right:16%;top:12%;width:90px;height:90px;border-radius:50%;
  background:radial-gradient(circle,var(--wpri-glow),transparent 66%);box-shadow:0 0 70px var(--wpri-glow);animation:wpGlow 4s infinite}
@keyframes wpGlow{50%{opacity:.6;transform:scale(1.08)}}
.wp-mount{position:absolute;bottom:0;width:120%;height:38%;
  background:linear-gradient(180deg,color-mix(in srgb,var(--wpri) 16%,transparent),transparent)}
.wp-mount.m1{left:-10%;clip-path:polygon(0 100%,10% 55%,22% 78%,38% 28%,52% 70%,66% 40%,80% 72%,92% 35%,100% 100%)}
.wp-mount.m2{left:-6%;bottom:-4%;height:26%;opacity:.5;
  clip-path:polygon(0 100%,14% 62%,30% 82%,46% 48%,62% 78%,78% 52%,100% 84%,100% 100%)}
.wp-cloud{position:absolute;height:16px;border-radius:50%;background:var(--wpri);filter:blur(14px);opacity:.08}
.wp-cloud.c1{left:8%;top:64%;width:44%}.wp-cloud.c2{right:6%;top:72%;width:38%}.wp-cloud.c3{left:24%;top:80%;width:52%;animation:wpDrift 12s linear infinite}
@keyframes wpDrift{50%{transform:translateX(30px)}}
.wp-taiji{position:absolute;right:10%;top:18%;font-size:56px;color:var(--wpri);opacity:.14;animation:wpSpin 18s linear infinite}
@keyframes wpSpin{to{transform:rotate(360deg)}}

/* ---------- 2 网游：技能环 + 网格 + 技能格 ---------- */
.wp-youxi{background:linear-gradient(180deg,rgba(8,19,26,.3),transparent 45%)}
.wp-grid{position:absolute;inset:0;opacity:.18;
  background-image:linear-gradient(var(--wpri) 1px,transparent 1px),linear-gradient(90deg,var(--wpri) 1px,transparent 1px);
  background-size:44px 44px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 55%);mask-image:linear-gradient(180deg,transparent,#000 55%)}
.wp-hud-ring{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:250px;height:250px;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--wpri) 30%,transparent);opacity:.35}
.wp-hud-ring i{position:absolute;inset:16px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--wpri) 40%,transparent);animation:wpSpin 24s linear infinite}
.wp-hud-ring b{position:absolute;inset:44px;border-radius:50%;border:1px solid color-mix(in srgb,var(--wpri) 50%,transparent)}
.wp-skill{position:absolute;width:42px;height:42px;display:grid;place-items:center;font-size:20px;color:var(--wpri);
  border:1px solid color-mix(in srgb,var(--wpri) 45%,transparent);border-radius:8px;background:color-mix(in srgb,var(--wpri) 8%,transparent);opacity:.5}
.wp-skill.s1{left:14%;top:30%}.wp-skill.s2{right:14%;top:36%}.wp-skill.s3{right:20%;bottom:24%}

/* ---------- 3 都市：天际线 + 霓虹 + 车流 ---------- */
.wp-dushi{background:linear-gradient(180deg,color-mix(in srgb,var(--wpri) 8%,transparent),transparent 55%)}
.wp-sky{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 80%,var(--wpri-glow),transparent 55%);opacity:.5}
.wp-city{position:absolute;left:0;right:0;bottom:0;height:42%;display:flex;align-items:flex-end;gap:2%;padding:0 3%;opacity:.16}
.wp-city i{flex:1;background:var(--wpri);border-radius:2px 2px 0 0}
.wp-city i:nth-child(1){height:40%}.wp-city i:nth-child(2){height:66%}.wp-city i:nth-child(3){height:50%}
.wp-city i:nth-child(4){height:82%}.wp-city i:nth-child(5){height:58%}.wp-city i:nth-child(6){height:72%}
.wp-city i:nth-child(7){height:44%}.wp-city i:nth-child(8){height:62%}
.wp-trail{position:absolute;left:0;right:0;bottom:8%;height:2px;background:linear-gradient(90deg,transparent,var(--wpri),transparent);
  box-shadow:0 0 20px 4px var(--wpri-glow);opacity:.5;animation:wpGlow 3s infinite}

/* ---------- 4 科幻：星域 + 网格地平线 + 雷达 + 数据流 ---------- */
.wp-keji{background:linear-gradient(180deg,rgba(3,8,11,.4),transparent 50%)}
.wp-stars{position:absolute;inset:0;opacity:.5;
  background-image:radial-gradient(1px 1px at 12% 22%,var(--wpri) 50%,transparent),radial-gradient(1px 1px at 78% 16%,var(--wpri) 50%,transparent),
    radial-gradient(1.5px 1.5px at 34% 38%,var(--wpri) 50%,transparent),radial-gradient(1px 1px at 62% 30%,var(--wpri) 50%,transparent),
    radial-gradient(1px 1px at 88% 46%,var(--wpri) 50%,transparent),radial-gradient(1px 1px at 22% 58%,var(--wpri) 50%,transparent);
  animation:wpTwinkle 4s ease-in-out infinite}
@keyframes wpTwinkle{50%{opacity:.25}}
.wp-horizon{position:absolute;left:-20%;right:-20%;bottom:6%;height:34%;
  background-image:linear-gradient(var(--wpri) 1px,transparent 1px),linear-gradient(90deg,var(--wpri) 1px,transparent 1px);
  background-size:40px 26px;opacity:.14;transform:perspective(300px) rotateX(62deg);transform-origin:bottom;
  -webkit-mask-image:linear-gradient(180deg,transparent,#000);mask-image:linear-gradient(180deg,transparent,#000)}
.wp-radar{position:absolute;right:12%;top:20%;width:140px;height:140px;border-radius:50%;opacity:.4;
  border:1px solid color-mix(in srgb,var(--wpri) 40%,transparent);
  background:repeating-radial-gradient(circle,transparent 0 22px,color-mix(in srgb,var(--wpri) 18%,transparent) 22px 23px)}
.wp-radar b{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,var(--wpri),transparent 28%);animation:wpSpin 3.5s linear infinite}
.wp-radar i{position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:var(--wpri);transform:translate(-50%,-50%);box-shadow:0 0 10px var(--wpri)}
.wp-stream{position:absolute;left:6%;top:20%;writing-mode:vertical-rl;font:10px ui-monospace,monospace;
  color:var(--wpri);opacity:.14;letter-spacing:.24em;max-height:60%;overflow:hidden}

/* ---------- 5 克苏鲁：深渊漩涡 + 触手 + 凝视之眼 + 诡符 ---------- */
.wp-kepfu{background:radial-gradient(ellipse at 50% 46%,color-mix(in srgb,var(--wpri) 14%,transparent),transparent 60%),linear-gradient(180deg,rgba(8,5,12,.5),transparent 45%)}
.wp-vortex{position:absolute;left:50%;top:44%;width:340px;height:340px;transform:translate(-50%,-50%);border-radius:50%;opacity:.18;
  background:repeating-radial-gradient(circle,transparent 0 26px,var(--wpri) 26px 27px);animation:wpSpin 30s linear infinite}
.wp-tentacle{position:absolute;border:6px solid var(--wpri);border-radius:50%;opacity:.1;filter:blur(2px)}
.wp-tentacle.t1{width:300px;height:300px;left:-90px;bottom:-90px;border-right-color:transparent;border-top-color:transparent;transform:rotate(22deg)}
.wp-tentacle.t2{width:260px;height:260px;right:-70px;top:10%;border-left-color:transparent;border-bottom-color:transparent;transform:rotate(-32deg)}
.wp-eye{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:96px;opacity:.1;filter:drop-shadow(0 0 20px var(--wpri));animation:wpBlink 6s infinite}
@keyframes wpBlink{0%,92%,100%{transform:translate(-50%,-50%) scaleY(1)}95%{transform:translate(-50%,-50%) scaleY(.08)}}
.wp-runes{position:absolute;left:0;right:0;bottom:14%;text-align:center;font-size:22px;letter-spacing:.5em;color:var(--wpri);opacity:.18}

/* ---------- 6 武侠：水墨远山 + 竹影 + 剑气 + 朱砂 ---------- */
.wp-wuxia{background:linear-gradient(180deg,color-mix(in srgb,var(--wpri) 10%,transparent),transparent 50%)}
.wp-inkmount{position:absolute;left:-5%;right:-5%;bottom:0;height:36%;opacity:.14;
  background:var(--wpri);clip-path:polygon(0 100%,12% 52%,24% 76%,40% 30%,55% 68%,70% 42%,86% 74%,100% 46%,100% 100%)}
.wp-bamboo{position:absolute;bottom:0;width:7px;height:60%;background:linear-gradient(180deg,transparent,var(--wpri));opacity:.16}
.wp-bamboo.b1{left:12%;transform:rotate(-4deg)}.wp-bamboo.b2{right:14%;height:70%;transform:rotate(5deg)}
.wp-sword{position:absolute;right:18%;top:16%;width:2px;height:180px;
  background:linear-gradient(180deg,transparent,var(--wpri),transparent);transform:rotate(38deg);opacity:.28;box-shadow:0 0 18px 2px var(--wpri-glow)}
.wp-redseal{position:absolute;left:16%;top:24%;width:52px;height:52px;display:grid;place-items:center;
  font:700 30px "STKaiti","KaiTi",serif;color:var(--wpri);border:3px double var(--wpri);border-radius:4px;opacity:.3;transform:rotate(-9deg)}

/* ---------- 7 蒸汽：齿轮 + 黄铜光 + 蒸汽 ---------- */
.wp-zhengqi{background:radial-gradient(circle at 50% 70%,var(--wpri-glow),transparent 55%)}
.wp-gear{position:absolute;color:var(--wpri);opacity:.09;line-height:1;animation:wpSpin 22s linear infinite}
.wp-gear.g1{font-size:280px;left:6%;bottom:-6%}.wp-gear.g2{font-size:170px;right:8%;top:16%;animation-direction:reverse}
.wp-gear.g3{font-size:110px;right:26%;bottom:16%;animation-duration:14s}
.wp-steam{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 90%,var(--wpri-glow),transparent 45%);opacity:.4;animation:wpGlow 5s infinite}

/* ---------- 8 恐怖：昏暗档案 + 血印 + 机密章 ---------- */
.wp-kongbu{background:radial-gradient(ellipse at 50% 46%,color-mix(in srgb,var(--wpri) 10%,transparent),transparent 50%),linear-gradient(180deg,rgba(20,14,8,.5),transparent)}
.wp-paper{position:absolute;inset:8% 16%;border:1px solid color-mix(in srgb,var(--wpri) 20%,transparent);opacity:.12;
  background:repeating-linear-gradient(180deg,transparent 0 26px,color-mix(in srgb,var(--wpri) 30%,transparent) 26px 27px)}
.wp-handprint{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-16deg);font-size:150px;color:var(--wpri);opacity:.07}
.wp-confid{position:absolute;right:16%;top:20%;font:700 22px "STKaiti","KaiTi",serif;color:var(--wpri);border:3px double var(--wpri);
  padding:6px 12px;opacity:.22;transform:rotate(-12deg)}

/* 浅色题材（武侠/都市/恐怖）扉页：加亮底 + 文字压深，保证可读 */
.wp-portal.light{background:linear-gradient(100deg,rgba(235,222,186,.92),rgba(222,208,170,.86) 55%,rgba(206,192,154,.8))}
.wp-portal.light::after{background:linear-gradient(90deg,rgba(255,250,235,.15),transparent 62%)}
.wp-portal.light .wp-title{color:color-mix(in srgb,var(--wpri) 55%,#241c10);text-shadow:0 1px 0 rgba(255,255,255,.35)}
.wp-portal.light .wp-motto,.wp-portal.light .wp-lead{color:#4a4033;opacity:.9}
.wp-portal.light .wp-eyebrow{color:color-mix(in srgb,var(--wpri) 50%,#241c10)}
.wp-portal.light::before{opacity:.5}

@media(max-width:700px){
  .wp-sig{width:52px;height:52px;font-size:30px}
  .wp-title{font-size:28px}
  .wp-glyph{font-size:150px}
}`;

  function injectCSS() {
    var s = document.createElement('style');
    s.id = 'wp-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  var LIGHT_ARCH = { dushi: 1, wuxia: 1, kongbu: 1 };
  var portal = null;
  var lastKey = '';

  function setupVisible() {
    var w = document.getElementById('setupWrap');
    // 设定台可见（非 none）时显示扉页；开局后向导隐藏，扉页随之消失
    return !!(w && w.style.display !== 'none' && w.offsetParent !== null);
  }

  function show() {
    var host = document.getElementById('setupWrap');
    if (!host || !setupVisible() || (portal && portal.isConnected)) return;
    if (host.querySelector('#worldPortal')) return;
    var w = worldInfo();
    var key = w.key;
    var portalEl = document.createElement('div');
    portalEl.className = 'wp-portal' + (LIGHT_ARCH[w.arch] ? ' light' : '');
    portalEl.id = 'worldPortal';
    portalEl.setAttribute('data-world', key);
    portalEl.setAttribute('data-arch', w.arch);
    portalEl.style.setProperty('--wpri', w.c);
    portalEl.style.setProperty('--wpri-glow', hexA(w.c, 0.4));
    portalEl.innerHTML =
      sceneHTML(w.arch) +
      '<div class="wp-inner">' +
        '<div class="wp-sig">' + esc(w.s) + '</div>' +
        '<div class="wp-eyebrow">' + (w.hero ? ('— 此世身份：' + esc(w.hero) + ' —') : '— 云境 · 待君入世 —') + '</div>' +
        '<h1 class="wp-title">' + esc(w.name) + (w.hero ? ('<span class="wp-hero-tag">· ' + esc(w.hero) + '</span>') : '') + '</h1>' +
        '<div class="wp-motto">' + esc(w.m) + '</div>' +
        '<div class="wp-divider"></div>' +
        '<div class="wp-lead">' + esc(LEAD[w.arch] || LEAD.xianxia) + '</div>' +
      '</div>';
    host.insertBefore(portalEl, host.firstChild);
    portal = portalEl;
    lastKey = key;
  }

  function hide() {
    if (portal && portal.isConnected) { portal.remove(); }
    portal = null;
    var leftover = document.getElementById('worldPortal');
    if (leftover) leftover.remove();
  }

  function hexA(hex, a) {
    var h = String(hex || '#e0a84c').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 224, g = parseInt(h.slice(2, 4), 16) || 168, b = parseInt(h.slice(4, 6), 16) || 76;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function sync() {
    var w = worldInfo();
    if (portal && portal.isConnected && portal.getAttribute('data-world') !== w.key) hide();
    if (!setupVisible()) { hide(); return; }
    if (!portal || !portal.isConnected) show();
  }

  function init() {
    injectCSS();
    setTimeout(sync, 600);
    setTimeout(sync, 1500);
    var wrap = document.getElementById('setupWrap');
    if (wrap && window.MutationObserver) {
      var mo = new MutationObserver(function () { setTimeout(sync, 60); });
      mo.observe(wrap, { childList: true, subtree: false });
      var setupBox = document.getElementById('setupContainer');
      if (setupBox) mo.observe(setupBox, { childList: true, subtree: false });
    }
    window.addEventListener('yj:config-saved', function () { setTimeout(sync, 200); });
    window.addEventListener('yj:genre-changed', function () { hide(); setTimeout(sync, 300); });
    window.addEventListener('yj:story-reset', function () { hide(); setTimeout(sync, 300); });
  }

  window.WorldPortal = { init: init, show: function () { hide(); show(); }, hide: hide, sync: sync };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
