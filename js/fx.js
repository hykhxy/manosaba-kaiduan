/* 标题页动态层：鼠标 / 触摸 / 陀螺仪视差 + 花瓣与火星粒子（纯 canvas，零依赖） */
(function () {
  'use strict';
  var stage = document.getElementById('stage'), cv = document.getElementById('fx'), title = document.getElementById('title');
  if (!stage || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d'), W = 1270, H = 720;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tx = 0, ty = 0, mx = 0, my = 0, hv = 0, hvT = 0, q = 1;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function size() {
    var s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    q = clamp((window.devicePixelRatio || 1) * s, 1, 2);
    cv.width = Math.round(W * q); cv.height = Math.round(H * q);
  }
  window.addEventListener('resize', function () { setTimeout(size, 80); });
  size();

  /* 输入：鼠标 / 手指拖动 / 手机倾斜 */
  document.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - .5) * 2; ty = (e.clientY / window.innerHeight - .5) * 2;
  }, { passive: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null || e.beta == null) return;
    tx = clamp(e.gamma / 22, -1, 1); ty = clamp((e.beta - 40) / 22, -1, 1);
  }, true);
  stage.addEventListener('pointerover', function (e) { if (e.target.closest && e.target.closest('.mi')) hvT = 1; });
  stage.addEventListener('pointerout', function (e) { if (e.target.closest && e.target.closest('.mi')) hvT = 0; });

  /* 精灵图 */
  function petal(c1, c2) {
    var s = document.createElement('canvas'); s.width = s.height = 64; var g = s.getContext('2d');
    var gr = g.createLinearGradient(8, 8, 56, 56); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(60, 12, 62, 46, 32, 60); g.bezierCurveTo(2, 46, 4, 12, 32, 6); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(32, 0); g.lineTo(25, 12); g.lineTo(39, 12); g.closePath(); g.fill();
    return s;
  }
  function blur(src, px) {
    var s = document.createElement('canvas'); s.width = s.height = 96; var g = s.getContext('2d');
    if ('filter' in g) g.filter = 'blur(' + px + 'px)'; g.drawImage(src, 16, 16); return s;
  }
  function glow(c) {
    var s = document.createElement('canvas'); s.width = s.height = 64; var g = s.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, c); gr.addColorStop(.35, c.replace(/[\d.]+\)$/, '.35)')); gr.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
  }
  var pk = petal('#ffe3ee', '#ff8fb8'), rd = petal('#ff6a78', '#b3101f'), wh = petal('#ffffff', '#ffd0e0');
  var SP = [{ s: pk, b: blur(pk, 3) }, { s: rd, b: blur(rd, 3) }, { s: wh, b: blur(wh, 3) }];
  var EM = glow('rgba(255,120,110,1)');

  /* 粒子 */
  var small = window.innerWidth < 760, NP = small ? 26 : 52, NE = small ? 16 : 34, P = [], E = [], i;
  for (i = 0; i < NP; i++) {
    var z = .25 + Math.random() * 1.3;
    P.push({ x: Math.random() * W, y: Math.random() * H, z: z, k: Math.floor(Math.random() * 3), sz: (12 + Math.random() * 12) * z,
      vx: (10 + Math.random() * 20) * z, vy: (20 + Math.random() * 30) * z, r: Math.random() * 6.28, vr: (Math.random() - .5) * 1.6,
      ph: Math.random() * 6.28, fl: Math.random() * 6.28, a: clamp(.28 + z * .45, .3, .85) });
  }
  P.sort(function (a, b) { return a.z - b.z; });
  for (i = 0; i < NE; i++) {
    E.push({ x: Math.random() * W * .75, y: Math.random() * H, z: .3 + Math.random() * 1.1, sz: 6 + Math.random() * 14, vy: 12 + Math.random() * 28, ph: Math.random() * 6.28 });
  }

  var last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (title.hidden || document.hidden) { last = t; return; }
    var dt = clamp((t - last) / 1000, 0, .05); last = t;
    var calm = reduce ? .12 : 1;
    // 视差：指针目标 + 缓慢的“呼吸”漂移，没人操作时画面也在轻轻流动
    var ax = reduce ? 0 : Math.sin(t / 3400) * .3, ay = reduce ? 0 : Math.cos(t / 4300) * .22;
    mx += (tx + ax - mx) * .05; my += (ty + ay - my) * .05; hv += (hvT - hv) * .08;
    stage.style.setProperty('--mx', mx.toFixed(3)); stage.style.setProperty('--my', my.toFixed(3)); stage.style.setProperty('--hv', hv.toFixed(3));

    ctx.setTransform(q, 0, 0, q, 0, 0); ctx.clearRect(0, 0, W, H);
    var sp = (1 + hv * .9) * calm, p, ox, oy, X, Y, sc;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      p.x += (p.vx + Math.sin(t / 900 + p.ph) * 16 * p.z) * dt * sp; p.y += p.vy * dt * sp; p.r += p.vr * dt * sp; p.fl += dt * 2.2 * sp;
      if (p.y > H + 40) { p.y = -40; p.x = Math.random() * W - 100; }
      if (p.x > W + 60) p.x = -60;
      ox = -mx * p.z * 64; oy = -my * p.z * 38; X = p.x + ox; Y = p.y + oy;
      sc = .5 + .5 * Math.abs(Math.cos(p.fl));
      ctx.save(); ctx.translate(X, Y); ctx.rotate(p.r); ctx.scale(1, sc);
      ctx.globalAlpha = p.a * (p.z > 1.05 ? .8 : 1);
      var spr = SP[p.k], im = p.z > 1.05 ? spr.b : spr.s, d = p.z > 1.05 ? p.sz * 1.5 : p.sz;
      ctx.drawImage(im, -d / 2, -d / 2, d, d); ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < E.length; i++) {
      p = E[i];
      p.y -= p.vy * dt * sp * p.z; p.x += Math.sin(t / 1200 + p.ph) * 10 * dt;
      if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W * .75; }
      X = p.x - mx * p.z * 50; Y = p.y - my * p.z * 30;
      ctx.globalAlpha = (.35 + .35 * Math.sin(t / 400 + p.ph)) * Math.min(1, p.z + .3);
      var e = p.sz * p.z * 1.6; ctx.drawImage(EM, X - e / 2, Y - e / 2, e, e);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();
