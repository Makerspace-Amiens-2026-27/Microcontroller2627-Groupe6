/* Bouton GameBoy : étincelles, chauffe, et déverrouillage de la page secrète. */
(() => {
  'use strict';

  // ───── Réglages ─────
  const CLICKS_NEEDED = 20;   // nombre de clics à atteindre…
  const WINDOW_MS     = 2500; // …dans ce laps de temps (ms)
  const UNLOCK_DELAY  = 1100; // durée du « flash » avant la redirection (ms)
  const MAX_SPARKS    = 700;

  const btn = document.querySelector('.gb-btn');
  if (!btn) return;
  const link = btn.closest('a') || btn;
  const secretUrl = btn.dataset.secretUrl;
  link.classList.add('gb-link');
  link.setAttribute('aria-label', document.title.split(' | ')[0] || 'Accueil');

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ───── Canvas d'étincelles (plein écran, ne gêne pas les clics) ─────
  const canvas = document.createElement('canvas');
  canvas.className = 'gb-sparks';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ───── Couleur « métal chauffé » : gris → rouge sombre → orange → jaune ─────
  const STOPS = [
    [0.00, [141, 145, 153]],
    [0.25, [168,  40,  24]],
    [0.50, [240,  90,  10]],
    [0.75, [255, 170,  20]],
    [1.00, [255, 236, 120]],
  ];
  function colorAt(h) {
    for (let i = 1; i < STOPS.length; i++) {
      if (h <= STOPS[i][0]) {
        const [h0, c0] = STOPS[i - 1];
        const [h1, c1] = STOPS[i];
        const t = (h - h0) / (h1 - h0);
        return c0.map((v, k) => v + (c1[k] - v) * t);
      }
    }
    return STOPS[STOPS.length - 1][1];
  }

  // ───── État ─────
  let clicks = [];           // horodatages des clics récents
  let heat = 0;              // chaleur affichée (0..1), lissée
  let unlocking = false;
  let raf = 0;
  let last = 0;
  let emitAcc = 0;
  const sparks = [];

  const prune = (now) => {
    while (clicks.length && now - clicks[0] > WINDOW_MS) clicks.shift();
  };
  const heatFromCount = (n) => Math.min(1, Math.pow(n / CLICKS_NEEDED, 0.85));

  // ───── Étincelles ─────
  function emit(n, h) {
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const rad = r.width / 2;
    for (let i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * (170 + h * 330);
      sparks.push({
        x: cx + Math.cos(a) * rad * 0.9,
        y: cy + Math.sin(a) * rad * 0.9,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - Math.random() * 60,
        t: 0,
        life: 0.35 + Math.random() * (0.4 + h * 0.55),
        size: 1 + Math.random() * (1 + h * 1.6),
        hue: 18 + Math.random() * (28 + h * 22),
      });
    }
  }

  function drawSparks(dt) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      if (s.t >= s.life) { sparks.splice(i, 1); continue; }
      s.vy += 520 * dt;                 // gravité
      const drag = Math.pow(0.35, dt);  // frottement
      s.vx *= drag; s.vy *= drag;
      const px = s.x, py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const k = s.t / s.life;
      ctx.strokeStyle = `hsla(${s.hue}, 100%, ${88 - k * 38}%, ${1 - k})`;
      ctx.lineWidth = s.size * (1 - k * 0.5);
      ctx.beginPath();
      ctx.moveTo(px - s.vx * 0.012, py - s.vy * 0.012);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ───── Rendu du bouton ─────
  function applyLook(h) {
    const [r, g, b] = colorAt(h);
    btn.style.setProperty('--gb-color', `rgb(${r | 0}, ${g | 0}, ${b | 0})`);
    btn.style.setProperty('--gb-heat', h.toFixed(3));
    btn.style.setProperty('--gb-border', (2 + h * 8).toFixed(2) + 'px');
    let dx = 0, dy = 0;
    if (!reduceMotion && h > 0.6) {
      const amp = (h - 0.6) * 5;
      dx = (Math.random() - 0.5) * amp;
      dy = (Math.random() - 0.5) * amp;
    }
    btn.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${(1 + h * 0.4).toFixed(3)})`;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    prune(now);

    const target = unlocking ? 1 : heatFromCount(clicks.length);
    const speed = target > heat ? 14 : 2.5; // monte vite, refroidit doucement
    heat += (target - heat) * Math.min(1, dt * speed);

    // Étincelles continues quand ça chauffe vraiment
    if (heat > 0.35) {
      emitAcc += dt * (heat - 0.3) * 70;
      const n = Math.floor(emitAcc);
      if (n > 0) { emit(n, heat); emitAcc -= n; }
    }

    if (heat < 0.003 && target === 0) heat = 0;
    applyLook(heat);
    drawSparks(dt);

    if (heat > 0 || sparks.length || clicks.length) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function ensureLoop() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  // ───── Déverrouillage ─────
  function unlock() {
    unlocking = true;
    try { sessionStorage.setItem('gbUnlocked', '1'); } catch (_) {}
    btn.classList.add('gb-unlock');
    emit(180, 1);
    setTimeout(() => { window.location.href = secretUrl; }, UNLOCK_DELAY);
  }

  // ───── Clic ─────
  link.addEventListener('click', (e) => {
    e.preventDefault(); // le titre n'est plus un lien vers l'accueil (menu « Accueil » à la place)
    if (unlocking) return;
    const now = performance.now();
    clicks.push(now);
    prune(now);
    const h = heatFromCount(clicks.length);
    emit(Math.round(3 + h * 22), h);
    ensureLoop();
    if (clicks.length >= CLICKS_NEEDED) unlock();
  });
})();
