/* 云境 · 电影片头式入场 v8
   用户口径（2026-11-24）：放弃「女孩单独入场」分层方案。新入场 = 启动后先出「云境」两个大字
   → 大字淡出 → 画面推进到封面页（推镜头）→ 动态粒子全程开启。电影开场那种。
   实现（纯前端 / 离线 / 零密钥）：
   - 标题卡 = HTML 文字 + CSS 光晕/呼吸/扫光，非贴图非图片。
   - 封面画面 = 整幅动态视频 girl_live.mp4（月亮/云海/符纸全在动），转场时从虚/暗/放大推进到清晰。
   - 粒子引擎从第 0 帧就启动并全程常驻。
   约 3.2s 后三层移交封面 #stage 常驻（场景视频 + 粒子），四入口淡入，可点击/按键跳过。 */
(function(){
  'use strict';
  var SCENE_VIDEO = 'assets/cover-anim/girl_live.mp4';        // 横版整幅动态封面（无静态贴图）
  var SCENE_VIDEO_PORT = 'assets/cover-anim/girl_live_port.mp4'; // 竖版整幅动态封面（同世界观竖构图）
  var DURATION = 5000;

  function rnd(a,b){ return a + Math.random()*(b-a); }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function ease(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
  // smootherstep：两端一阶/二阶导均为 0，转场起止无加速度突变，比 easeInOutQuad 更丝滑
  function smoother(t){ t=clamp(t,0,1); return t*t*t*(t*(t*6-15)+10); }

  function suppressFirstRunGuide(){
    try {
      if (localStorage.getItem('yunjingFirstRunGuideDone') !== '1')
        localStorage.setItem('yunjingFirstRunGuideDone','1');
      var g = document.getElementById('yjFirstGuide');
      if (g && g.parentNode) g.parentNode.removeChild(g);
    } catch(e){}
  }

  /* ============ 粒子引擎：从第一帧起全程运行 ============ */
  function ParticleEngine(canvas){
    var ctx = canvas.getContext('2d');
    var W=0,H=0,DPR=1, clouds=[],stars=[],motes=[],runes=[];
    var raf=0, running=false, portrait=false, t0=performance.now(), alpha=0, target=0;
    function build(o){
      portrait = !!o;
      clouds=[]; stars=[]; motes=[]; runes=[];
      var nc=Math.round(W*H/62000)+12;
      for(var i=0;i<nc;i++) clouds.push({
        x:rnd(-.1,1.1)*W, y:rnd(.2,1.05)*H, r:rnd(150,440),
        vx:rnd(-3,5), vy:rnd(-1,1), a:rnd(.025,.10), ph:rnd(0,6.28),
        hue: Math.random()<.5?'236,224,255':'255,238,205'
      });
      var ns=Math.round(W*H/3200)+70;
      for(var j=0;j<ns;j++) stars.push({
        x:Math.random()*W, y:Math.random()*H*0.8, r:rnd(.4,1.6),
        ph:rnd(0,6.28), sp:rnd(.3,1.1), a:rnd(.2,.8)
      });
      var nm=Math.round(W*H/11000)+30;
      for(var k=0;k<nm;k++) motes.push({
        x:Math.random()*W, y:Math.random()*H, r:rnd(1,3),
        vy:rnd(-6,-2), vx:rnd(-3,3), ph:rnd(0,6.28), a:rnd(.35,.9)
      });
      for(var m=0;m<6;m++) runes.push({
        t:Math.random(), sp:rnd(.018,.05), r:rnd(120,300), ph:rnd(0,6.28), a:rnd(.2,.5)
      });
    }
    function resize(o){
      DPR=Math.min(window.devicePixelRatio||1,2);
      W=window.innerWidth; H=window.innerHeight;
      canvas.width=Math.round(W*DPR); canvas.height=Math.round(H*DPR);
      ctx.setTransform(DPR,0,0,DPR,0,0);
      build(o);
    }
    function drawCloud(c,t){
      var x=c.x+Math.sin(t*0.00005+c.ph)*c.vx*6;
      var y=c.y+Math.cos(t*0.00004+c.ph)*c.vy*4;
      var a=c.a*(0.75+0.25*Math.sin(t*0.0006+c.ph))*alpha;
      var g=ctx.createRadialGradient(x,y,0,x,y,c.r);
      g.addColorStop(0,'rgba('+c.hue+','+a+')');
      g.addColorStop(.5,'rgba('+c.hue+','+(a*.45)+')');
      g.addColorStop(1,'rgba('+c.hue+',0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,c.r,0,6.283); ctx.fill();
    }
    function drawMoonHalo(t){
      var mx=portrait? W*0.5 : W*0.26, my=portrait? H*0.16 : H*0.20;
      var pulse=1+0.06*Math.sin(t*0.0007);
      var R=Math.min(W,H)*0.19*pulse;
      var a=0.07*alpha;
      var g=ctx.createRadialGradient(mx,my,R*0.35,mx,my,R);
      g.addColorStop(0,'rgba(255,232,170,0)');
      g.addColorStop(.7,'rgba(255,224,150,'+a+')');
      g.addColorStop(1,'rgba(255,214,130,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(mx,my,R,0,6.283); ctx.fill();
    }
    function drawRune(t){
      var cx=W*0.5, cy=H*0.34;
      runes.forEach(function(r){
        r.t=(r.t+r.sp*0.0016)%1;
        var ang=r.t*6.283*2+r.ph;
        var x=cx+Math.cos(ang)*r.r*1.35, y=cy+Math.sin(ang)*r.r*0.55;
        var tw=0.6+0.4*Math.sin(t*0.0016+r.ph);
        var g=ctx.createRadialGradient(x,y,0,x,y,10);
        g.addColorStop(0,'rgba(255,236,170,'+(r.a*tw*alpha)+')');
        g.addColorStop(1,'rgba(255,220,140,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,10,0,6.283); ctx.fill();
      });
    }
    function frame(){
      if(!running) return;
      var t=performance.now()-t0;
      alpha += (target-alpha)*0.05;  // 平滑淡入（放慢，起步更柔和）
      ctx.clearRect(0,0,W,H);
      if(alpha>0.002){
        clouds.forEach(function(c){ drawCloud(c,t); });
        drawMoonHalo(t);
        stars.forEach(function(s){
          var a=s.a*(0.35+0.65*(0.5+0.5*Math.sin(t*0.0006*s.sp+s.ph)))*alpha;
          ctx.fillStyle='rgba(255,246,214,'+a+')';
          ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.283); ctx.fill();
        });
        motes.forEach(function(m){
          m.y+=m.vy*0.016; m.x+=Math.sin(t*0.0006+m.ph)*m.vx*0.01;
          if(m.y<-10){ m.y=H+10; m.x=Math.random()*W; }
          var a=m.a*(0.5+0.5*Math.sin(t*0.0012+m.ph))*alpha;
          var g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*3);
          g.addColorStop(0,'rgba(255,231,168,'+a+')');
          g.addColorStop(1,'rgba(255,220,150,0)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(m.x,m.y,m.r*3,0,6.283); ctx.fill();
        });
        drawRune(t);
      }
      raf=requestAnimationFrame(frame);
    }
    return {
      start:function(o){ resize(o); if(running)return; running=true; raf=requestAnimationFrame(frame); },
      resize:function(o){ if(running) resize(o); },
      enable:function(){ target=1; },
      stop:function(){ running=false; cancelAnimationFrame(raf); },
      get alpha(){ return alpha; }, get running(){ return running; }
    };
  }

  function play(){
    suppressFirstRunGuide();
    if (/[?&]denied=1/.test(location.search)) return;
    var portrait = window.innerHeight > window.innerWidth;
    var sceneSrc = portrait ? SCENE_VIDEO_PORT : SCENE_VIDEO;  // 横竖屏各用对应构图的动态封面
    document.body.classList.add('yjCoverIntro');

    // 三层：封面揭示层（虚→清晰推进） / 粒子画布（全程） / 片头标题卡（浮现→淡出）
    var wrap=document.createElement('div');
    wrap.id='coverIntro';
    wrap.setAttribute('aria-label','云境开场动画');
    wrap.innerHTML=
      '<div class="ci-sky"></div>'+
      '<div class="ci-reveal">'+
        '<video class="ci-scene-video" autoplay muted loop playsinline preload="auto">'+
          '<source src="'+sceneSrc+'" type="video/mp4">'+
        '</video>'+
      '</div>'+
      '<canvas class="ci-fx"></canvas>'+
      '<div class="ci-vignette"></div>'+
      '<div class="ci-titlecard"><div class="tc-halo"></div><h1>云境</h1>'+
        '<div class="tc-line"></div><p class="tc-sub">万象入云 · 一念一世界</p></div>'+
      '<button class="ci-skip" type="button" aria-label="跳过开场动画">跳过 ›</button>';
    (document.body||document.documentElement).appendChild(wrap);

    var reveal=wrap.querySelector('.ci-reveal');
    var sceneVideo=wrap.querySelector('.ci-scene-video');
    var canvasEl=wrap.querySelector('.ci-fx');
    var card=wrap.querySelector('.ci-titlecard');
    var skipBtn=wrap.querySelector('.ci-skip');

    var engine=ParticleEngine(canvasEl);
    engine.start(portrait);
    engine.enable();   // 粒子全程开启（从第 0 帧）
    function tryPlay(v){ try { var pr=v.play(); if(pr && pr.catch) pr.catch(function(){}); } catch(e){} }

    // 降级兜底：竖版视频缺失/损坏时回退横版，避免竖屏黑屏（横版视频始终存在）
    function fallbackToLandscape(){
      if(!portrait || sceneVideo.dataset.fb==='1') return;
      sceneVideo.dataset.fb='1';
      sceneSrc=SCENE_VIDEO;
      sceneVideo.src=SCENE_VIDEO;
      sceneVideo.load();
      tryPlay(sceneVideo);
    }
    if(portrait){
      sceneVideo.addEventListener('error', fallbackToLandscape);
      var srcEl=sceneVideo.querySelector('source');
      if(srcEl) srcEl.addEventListener('error', fallbackToLandscape);
      // 1.2s 内若竖版视频仍无有效画面(readyState<2)，回退
      setTimeout(function(){ if(sceneVideo.readyState<2) fallbackToLandscape(); }, 1200);
    }
    tryPlay(sceneVideo);

    var startT=performance.now();
    var phase='intro', raf=0, done=false;

    /* 时序（电影片头 · 丝滑交叉溶解版总 5s）：
       ① 0-500ms    深空起字（粒子已开始淡入）
       ② 500-2200ms  「云境」大字凝聚浮现（字距收拢 + 上移 + 光晕呼吸）
       ③ 2200-3400ms 停留
       ④ 3400-4700ms 标题淡出 + 封面推进 = 同一条 smootherstep 曲线的交叉溶解：
                      标题克制退场（只轻放大/轻虚化/轻上移），封面柔和浮现（幅度收敛），
                      两者此消彼长、起止无加速度突变 → 不突兀
       ⑤ 4700-5000ms 封面就位静止，粒子全程，随后 settle */
    function tick(now){
      var e=now-startT;
      // 转场共用进度 s（3400-4700ms），标题退 ∝ (1-s)，封面进 ∝ s —— 交叉溶解
      var s = smoother((e-3400)/1300);

      // 标题卡：退场克制（放大/虚化/位移幅度较上版减半，主要靠 opacity 淡出）
      var tcOp, tcScale=1, tcY=0, tcBlur=0, tcTrack=0.5;
      if(e<500){ tcOp=0; }
      else if(e<2200){ var a=ease((e-500)/1700); tcOp=a; tcTrack=0.5-0.22*a; tcY=(1-a)*12; }
      else if(e<3400){ tcOp=1; tcTrack=0.28; }
      else { tcOp=1-s; tcTrack=0.28+0.06*s; tcScale=1+0.04*s; tcY=-8*s; tcBlur=3*s; }
      card.style.opacity=tcOp;
      card.style.transform='translateY('+tcY+'px) scale('+tcScale+')';
      card.style.filter=tcBlur>0.01?('blur('+tcBlur+'px)'):'none';
      card.style.letterSpacing=tcTrack+'em';

      // 揭示层：与标题共用 s，柔和浮现（scale 1.10→1 / blur 5→0 / 亮度 0.55→1）
      var rvOp=s, rvScale=1.10-0.10*s, rvBlur=5*(1-s), rvBright=0.55+0.45*s;
      reveal.style.opacity=rvOp;
      reveal.style.transform='scale('+rvScale+')';
      reveal.style.filter='blur('+rvBlur+'px) brightness('+rvBright+')';

      if(e>=DURATION) settle(false); else raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);

    /* 收尾：场景视频 + 粒子移交封面页 #stage 常驻，wrap 淡出，四入口浮现 */
    function settle(fast){
      if(done) return; done=true;
      phase='cover';
      engine.enable();
      document.body.classList.remove('yjCoverIntro');
      if(fast) wrap.classList.add('fast');

      var stage=document.getElementById('stage');
      if(stage){
        var layer=document.getElementById('coverFxLayer');
        if(!layer){
          layer=document.createElement('div');
          layer.id='coverFxLayer';
          stage.insertBefore(layer, stage.firstChild);
        }
        reveal.style.opacity='1';
        reveal.style.transform='none';
        reveal.style.filter='none';
        layer.appendChild(reveal);
        canvasEl.className='ci-fx';
        layer.appendChild(canvasEl);
        layer.classList.add('is-live');
      }
      // 无缝收尾：封面已就位，立即撤掉黑色蒙版（否则黑色 wrap 渐隐会把封面重新盖黑再揭开 → 黑闪）；
      // 待底层渲染稳定两帧后移除覆盖层，全程画面连续无黑屏。
      wrap.style.background='transparent';
      var vig=wrap.querySelector('.ci-vignette'); if(vig) vig.style.display='none';
      if(skipBtn) skipBtn.style.display='none';
      var cleared=false;
      function clear(){
        if(cleared) return; cleared=true;
        if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
        document.removeEventListener('keydown',onKey);
        if(skipBtn && skipBtn.parentNode) skipBtn.removeEventListener('click',onSkip);
      }
      requestAnimationFrame(function(){ requestAnimationFrame(clear); });
      setTimeout(clear, 400);  // 兜底

      var menu=document.getElementById('menu');
      if(menu) setTimeout(function(){ menu.style.opacity='1'; }, fast?60:140);
    }

    function onKey(e){
      if(e.key==='Escape'||e.key==='Enter'||e.key===' '||e.key==='Spacebar'){
        e.preventDefault(); settle(true);
      }
    }
    function onSkip(){ settle(true); }
    if(skipBtn) skipBtn.addEventListener('click',onSkip);
    document.addEventListener('keydown',onKey);
    wrap.addEventListener('click',function(e){ if(!e.target.closest('.ci-skip')) settle(true); });

    window.CoverIntro={ play:play, _engine:engine, _video:sceneVideo, _sceneVideo:sceneVideo,
      get phase(){ return phase; },
      // 粒子是否处于持续运行状态（停留封面页期间恒为 true，引擎从不 stop）
      get particlesLive(){ return engine.running && engine.alpha>0.5; },
      skip:function(){ settle(true); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play);
  else play();
})();
