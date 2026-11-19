/* Console Game Boy + pont EmulatorJS.
 * Sources vérifiées : EmulatorJS data/src/emulator.js (keyChange écoute keydown/keyup sur le
 * conteneur joueur et compare e.keyCode ; gameManager.simulateInput(player, index, value) ;
 * defaultControllers/initControlVars) et loader.js (EJS_defaultControls, EJS_emulator).
 * Index RetroPad : 0 = B, 8 = A, 2 = SELECT, 3 = START, 4..7 = haut/bas/gauche/droite. */
(() => {
  'use strict';

  const consoleEl = document.getElementById('gbx');
  const screen = document.getElementById('gbx-screen');
  const wrap = document.getElementById('gb-carts-wrap');
  const eject = document.getElementById('gb-eject');
  const dpad = document.getElementById('gbx-dpad');
  if (!consoleEl || !screen || !wrap || !eject || !dpad) return;
  const carts = Array.from(document.querySelectorAll('.gb-cart'));

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INSERT_MS = reduceMotion ? 10 : 1050;

  // Index RetroPad utilisés par EmulatorJS pour le core GB/GBA.
  const PAD = { B: 0, A: 8, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7 };
  // Clavier : codes keyCode attendus par EmulatorJS (keyMap : 13 enter, 16 shift, 37-40 flèches, 90 z, 88 x).
  // Codes utilisés uniquement pour le clavier physique (EmulatorJS se charge du reste via keyCode).
  const KEY = { B: { code: 'KeyZ', keyCode: 90, key: 'z' }, A: { code: 'KeyX', keyCode: 88, key: 'x' },
    SELECT: { code: 'KeyV', keyCode: 86, key: 'v' }, START: { code: 'Enter', keyCode: 13, key: 'Enter' },
    UP: { code: 'ArrowUp', keyCode: 38, key: 'ArrowUp' }, DOWN: { code: 'ArrowDown', keyCode: 40, key: 'ArrowDown' },
    LEFT: { code: 'ArrowLeft', keyCode: 37, key: 'ArrowLeft' }, RIGHT: { code: 'ArrowRight', keyCode: 39, key: 'ArrowRight' } };
  const DIR = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  // Contrôles par défaut transmis à EmulatorJS (option documentée EJS_defaultControls).
  window.EJS_defaultControls = {
    0: {
      0: { value: 'z', value2: 'BUTTON_2' },
      2: { value: 'v', value2: 'SELECT' },
      3: { value: 'enter', value2: 'START' },
      4: { value: 'up arrow', value2: 'DPAD_UP' },
      5: { value: 'down arrow', value2: 'DPAD_DOWN' },
      6: { value: 'left arrow', value2: 'DPAD_LEFT' },
      7: { value: 'right arrow', value2: 'DPAD_RIGHT' },
      8: { value: 'x', value2: 'BUTTON_1' }
    },
    1: {}, 2: {}, 3: {}
  };

  let loaded = false;
  let loaderAdded = false;
  const held = new Set();
  const status = document.createElement('p');
  status.id = 'gbx-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  eject.parentNode.insertBefore(status, eject);

  // Émulateur prêt ? (gameManager n'existe qu'après le démarrage du jeu)
  function emu() {
    const e = window.EJS_emulator;
    return e && e.started && e.gameManager && typeof e.gameManager.simulateInput === 'function' ? e : null;
  }
  function setPad(name, down) {
    const e = emu();
    if (e) e.gameManager.simulateInput(0, PAD[name], down ? 1 : 0);
  }
  function press(name) {
    if (held.has(name)) return;
    held.add(name);
    setPad(name, true);
  }
  function release(name) {
    if (!held.delete(name)) return;
    setPad(name, false);
  }
  function releaseAll() { Array.from(held).forEach(release); }

  // Clavier physique : fonctionne depuis toute la page (sauf si le focus est déjà dans l'écran,
  // auquel cas EmulatorJS reçoit directement l'événement natif).
  const byKey = {};
  Object.keys(KEY).forEach((n) => { byKey[KEY[n].code] = n; });
  document.addEventListener('keydown', (e) => {
    const name = byKey[e.code];
    if (!name || !loaded || screen.contains(e.target) || e.repeat) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault();
    press(name);
  });
  document.addEventListener('keyup', (e) => {
    const name = byKey[e.code];
    if (!name || screen.contains(e.target)) return;
    release(name);
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // Animation : la cartouche sélectionnée glisse jusqu'à la fente de la console, puis le jeu démarre.
  function insertAnimation(cart, done) {
    if (reduceMotion) { done(); return; }
    // Relever la géométrie en unités de viewport avant de fixer la cartouche en overlay.
    const from = cart.getBoundingClientRect();
    const to = consoleEl.querySelector('.gbx-lcd').getBoundingClientRect();
    const tx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const ty = (to.top + to.height / 2) - (from.top + from.height / 2);
    cart.style.setProperty('--origin-x', (from.left + from.width / 2) + 'px');
    cart.style.setProperty('--origin-y', (from.top + from.height / 2) + 'px');
    cart.style.setProperty('--tx', tx + 'px');
    cart.style.setProperty('--ty', ty + 'px');
    cart.style.position = 'fixed';
    cart.style.left = (from.left + from.width / 2) + 'px';
    cart.style.top = (from.top + from.height / 2) + 'px';
    cart.style.width = from.width + 'px';
    cart.style.height = from.height + 'px';
    cart.style.margin = '0';
    cart.style.transform = 'translate(-50%, -50%)';
    cart.classList.add('inserting');
    window.setTimeout(done, INSERT_MS);
  }

  function start(url, name, core, cart) {
    if (loaded || !url) return;
    loaded = true;
    carts.forEach((c) => { c.disabled = true; });
    const isGba = core === 'gba';
    const launch = () => {
      wrap.hidden = true;
      consoleEl.classList.add('on');
      eject.hidden = false;
      status.hidden = false;
      consoleEl.querySelector('.gbx-lcd').classList.toggle('gba-display', isGba);
      status.textContent = `Chargement de ${name}…`;

      window.EJS_player = '#gbx-screen';
      window.EJS_core = isGba ? 'gba' : 'gb'; // mGBA pour GBA ; Gambatte pour GB/GBC
      window.EJS_gameName = name;
      window.EJS_gameUrl = url;
      window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
      window.EJS_startOnLoaded = true;
      window.EJS_color = '#306230';
      window.EJS_onGameStart = () => { status.hidden = true; };

      if (!loaderAdded) {
        loaderAdded = true;
        const script = document.createElement('script');
        script.src = window.EJS_pathtodata + 'loader.js';
        script.async = true;
        script.onerror = () => {
          status.hidden = false;
          status.textContent = 'Impossible de charger EmulatorJS. Vérifie la connexion au CDN puis recharge la page.';
        };
        document.body.appendChild(script);
      }
    };
    insertAnimation(cart, launch);
  }

  carts.forEach((button) => {
    button.addEventListener('click', () => start(button.dataset.url, button.dataset.name || 'Game Boy', button.dataset.core || 'gb', button));
  });

  // Croix directionnelle : une seule direction à la fois, selon la position du pointeur.
  function setDirection(event) {
    const rect = dpad.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / rect.width - 0.5;
    const dy = (event.clientY - rect.top) / rect.height - 0.5;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'LEFT' : 'RIGHT') : (dy < 0 ? 'UP' : 'DOWN');
    DIR.forEach((d) => { if (d !== dir) release(d); });
    press(dir);
    dpad.dataset.dir = dir;
  }
  function clearDirection() {
    DIR.forEach(release);
    delete dpad.dataset.dir;
  }
  dpad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try { dpad.setPointerCapture(event.pointerId); } catch (_) {}
    setDirection(event);
  });
  dpad.addEventListener('pointermove', (event) => { if (event.buttons || event.pressure) setDirection(event); });
  dpad.addEventListener('pointerup', clearDirection);
  dpad.addEventListener('pointercancel', clearDirection);
  dpad.addEventListener('lostpointercapture', clearDirection);

  // Boutons A, B, SELECT, START (souris, tactile, stylet, et clavier de l'accessibilité).
  document.querySelectorAll('[data-btn]').forEach((button) => {
    const name = button.dataset.btn;
    if (PAD[name] === undefined) return;
    const down = (event) => {
      if (event) event.preventDefault();
      button.classList.add('is-down');
      press(name);
    };
    const up = () => {
      button.classList.remove('is-down');
      release(name);
    };
    button.addEventListener('pointerdown', (event) => {
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
      down(event);
    });
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    // Activation clavier (Entrée/Espace sur le bouton focalisé) : relâche après un court délai.
    button.addEventListener('click', (event) => {
      if (event.detail !== 0) return; // clic souris/tactile déjà géré par pointerdown/up
      down(); window.setTimeout(up, 90);
    });
  });

  eject.addEventListener('click', () => { releaseAll(); window.location.reload(); });
})();
