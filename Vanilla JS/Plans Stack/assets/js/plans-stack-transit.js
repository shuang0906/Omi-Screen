(() => {
  'use strict';

  // Front card → plan detail (Figma 4404:33902). The card itself grows into the 370 × 450 hero while
  // the stack falls back, the frosted page fades in and the sections rise in one after another.
  const root = document.querySelector('[data-pt="root"]');
  if (!root) return;

  const HERO = { left: 17, top: 64.5, width: 370, height: 450, radius: 16 };
  const CARD = 266;            // stack card size before scaling (plans-stack-cards.js)
  const CARD_RADIUS = 10.547;  // --card-r

  const OPEN_MS = 720;
  const CLOSE_MS = 600;
  // Quick start, long soft landing.
  const EASE = 'cubic-bezier(.32, .72, 0, 1)';
  const EASE_IN = 'cubic-bezier(.4, 0, 1, 1)';

  const $ = sel => root.querySelector(`[data-pt="${sel}"]`);
  const stage = root.querySelector('.plans-stage');
  // Home screen around the stack: title, buttons, Recent Activity, status bar and nav.
  const home = root.querySelector('[data-pt="home"]');
  const homeParts = Array.from(root.querySelectorAll('[data-pt="home-part"]'));
  const nav = root.querySelector('.pt-nav');
  const HOME_SHOWN = { opacity: 1, transform: 'none' };
  const HOME_HIDDEN = { opacity: 0, transform: 'translateY(16px)' };
  const stack = root.querySelector('[data-stack="cards"]');
  const detail = $('detail');
  const backdrop = $('backdrop');
  const scroll = $('scroll');
  const hero = $('hero');
  const heroImg = $('hero-img');
  const heroTitle = $('hero-title');
  const heroMeta = $('hero-meta');
  const heroUI = $('hero-ui');
  const heroBand = hero.querySelector('.pt-hero-band');
  const chromeTop = $('chrome-top');
  const chromeBottom = $('chrome-bottom');
  const closeBtn = $('close');
  const sections = Array.from(root.querySelectorAll('.pt-sec'));
  const announcement = document.querySelector('[data-announcement]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- Static content ----------

  // Draw all bars in one bitmap, with identical integer device-pixel widths.
  const barHeights = [...Array(9).fill(34.241), 28.534, 22.827, ...Array(25).fill(17.12)];
  const barsCanvas = document.createElement('canvas');
  barsCanvas.className = 'pt-bars-canvas';
  $('bars').replaceChildren(barsCanvas);
  const barsContext = barsCanvas.getContext('2d');
  let barsFrame = 0;
  function drawBars(elapsed = Infinity) {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(320 * dpr), height = Math.round(36 * dpr);
    if (barsCanvas.width !== width || barsCanvas.height !== height) {
      barsCanvas.width = width;
      barsCanvas.height = height;
    }
    barsContext.clearRect(0, 0, width, height);
    barsContext.fillStyle = '#fff';
    const thickness = Math.max(1, Math.round(2 * dpr));
    barHeights.forEach((target, i) => {
      const progress = Math.max(0, Math.min(1, (elapsed - 300 - i * 16) / 420));
      const ease = 1 - (1 - progress) ** 3;
      const length = Math.max(thickness, Math.round((2 + (target - 2) * ease) * dpr));
      const x = Math.round((1.5 + i * 9) * dpr);
      const y = Math.round((height - length) / 2);
      barsContext.beginPath();
      barsContext.roundRect(x, y, thickness, length, thickness / 2);
      barsContext.fill();
    });
  }
  function animateBars() {
    cancelAnimationFrame(barsFrame);
    if (reduceMotion.matches) { drawBars(); return; }
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      drawBars(elapsed);
      barsFrame = elapsed < 1280 ? requestAnimationFrame(frame) : 0;
    }
    drawBars(0);
    barsFrame = requestAnimationFrame(frame);
  }
  drawBars();

  const rule = '<li aria-hidden="true"><img class="pt-tx-rule" src="./assets/img/detail/rule-tx.svg" width="322" height="0.5" alt=""></li>';
  const row = `<li class="pt-tx-row">
      <div class="pt-tx-info"><p class="pt-tx-name">McDonald’s</p><p class="pt-tx-sub">Sep 12 • APY 5.1%</p></div>
      <p class="pt-tx-amount">+$20.87</p>
    </li>`;
  $('tx').innerHTML = [row, rule, row, rule, row, rule, row].join('');

  // ---------- Transition ----------

  let state = 'closed';   // closed | opening | open | closing
  let current = null;     // { card, from, ghost }
  let stageAnim = null;
  let homeAnims = [];
  const setHomeInert = on => { home.inert = on; if (nav) nav.inert = on; };
  const cancelHome = () => { homeAnims.forEach(a => a.cancel()); homeAnims = []; };
  let running = [];

  const run = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'both', ...opts });
    running.push(a);
    return a;
  };
  const clearRunning = () => {
    running.forEach(a => a.cancel());
    running = [];
  };
  const box = r => ({
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    borderRadius: `${r.radius}px`
  });

  function frontCard() {
    return stack.querySelector('.plan[aria-hidden="false"]');
  }

  function open(card) {
    if (state !== 'closed' || !card) return;
    state = 'opening';

    const cr = card.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const scale = cr.width / CARD;
    const from = {
      left: cr.left - rr.left, top: cr.top - rr.top,
      width: cr.width, height: cr.height, radius: CARD_RADIUS * scale
    };

    // Detail takes the card's plan.
    heroImg.src = card.querySelector('.plan-img').getAttribute('src');
    hero.style.setProperty('--pt-photo', `url("${heroImg.src}")`);
    heroTitle.textContent = card.querySelector('.plan-name').textContent;
    heroMeta.textContent = card.querySelector('.plan-meta').textContent;

    hero.querySelector('.pt-hero-value').textContent = card.querySelector('.plan-amount').textContent;
    hero.querySelector('.pt-hero-goal').textContent = card.querySelector('.plan-progress').textContent;

    // Keep one visible copy of each text throughout the card morph.
    const ghost = document.createElement('div');
    ghost.className = 'pt-ghost';
    ghost.style.width = '100%';
    ghost.style.height = '100%';
    scroll.scrollTop = 0;
    const heroRect = hero.getBoundingClientRect();
    const pairs = [
      ['.plan-name', '.pt-hero-title'],
      ['.plan-meta', '.pt-hero-meta'],
      ['.plan-amount', '.pt-hero-value'],
      ['.plan-progress', '.pt-hero-goal'],
    ];
    const textMorphs = pairs.map(([sourceSelector, targetSelector]) => {
      const source = card.querySelector(sourceSelector);
      const targetText = hero.querySelector(targetSelector);
      const sr = source.getBoundingClientRect();
      const tr = targetText.getBoundingClientRect();
      const sc = getComputedStyle(source), tc = getComputedStyle(targetText);
      const node = document.createElement('p');
      node.textContent = source.textContent;
      node.style.cssText = 'position:absolute;margin:0;white-space:nowrap;width:max-content;transform-origin:0 0;';
      const textStyle = (rect, origin, css, factor) => ({
        left: `${rect.left - origin.left}px`, top: `${rect.top - origin.top}px`,
        fontSize: `${parseFloat(css.fontSize) * factor}px`,
        lineHeight: css.lineHeight === 'normal' ? 'normal' : `${parseFloat(css.lineHeight) * factor}px`,
        letterSpacing: css.letterSpacing === 'normal' ? '0px' : `${parseFloat(css.letterSpacing) * factor}px`,
        fontWeight: css.fontWeight, color: css.color,
      });
      const start = textStyle(sr, cr, sc, scale);
      const end = textStyle(tr, heroRect, tc, 1);
      Object.assign(node.style, start);
      ghost.appendChild(node);
      targetText.style.visibility = 'hidden';
      return { node, targetText, start, end };
    });
    hero.appendChild(ghost);

    current = { card, from, ghost, textMorphs };
    scroll.scrollTop = 0;
    card.style.visibility = 'hidden';
    setHomeInert(true);
    detail.inert = false;
    detail.removeAttribute('aria-hidden');
    detail.classList.add('is-animating');
    if (announcement) announcement.textContent = `${heroTitle.textContent} details`;

    animateBars();
    if (reduceMotion.matches) {
      stageAnim = stage.animate([{ opacity: 0 }], { fill: 'forwards', duration: 0 });
      homeAnims = homeParts.map(el => el.animate([HOME_HIDDEN], { fill: 'forwards', duration: 0 }));
      return finishOpen();
    }

    const morph = run(hero, [box(from), box(HERO)], { duration: OPEN_MS, easing: EASE });
    textMorphs.forEach(({ node, start, end }) => run(node, [start, end], { duration: OPEN_MS, easing: EASE }));
    run(heroUI, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: OPEN_MS * .45, easing: 'ease-out' });
    run(heroBand, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 180, easing: 'ease-out' });
    run(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 460, easing: 'ease-out' });
    run(chromeTop, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 220, easing: 'ease-out' });
    run(chromeBottom, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: 360, easing: EASE });
    sections.forEach((el, i) => run(el,
      [{ opacity: 0, transform: 'translateY(56px)' }, { opacity: 1, transform: 'none' }],
      { duration: 640, delay: 170 + i * 60, easing: EASE }));

    // The rest of the stack sinks back and blurs away.
    stageAnim = stage.animate([
      { opacity: 1, transform: 'translateX(-50%)', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateX(-50%) translateY(36px) scale(.94)', filter: 'blur(6px)' }
    ], { duration: 460, easing: EASE, fill: 'forwards' });
    homeAnims = homeParts.map(el => el.animate([HOME_SHOWN, HOME_HIDDEN],
      { duration: 360, easing: EASE, fill: 'forwards' }));

    const last = running.reduce((a, b) => (b.effect.getComputedTiming().endTime > a.effect.getComputedTiming().endTime ? b : a), morph);
    last.finished.then(finishOpen, () => {});
  }

  function finishOpen() {
    clearRunning();
    current.ghost.remove();
    current.textMorphs.forEach(({ targetText }) => { targetText.style.visibility = ''; });
    detail.classList.remove('is-animating');
    detail.classList.add('is-open');
    state = 'open';
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (state !== 'open') return;
    state = 'closing';
    cancelAnimationFrame(barsFrame);
    drawBars();
    const { card, from, ghost, textMorphs } = current;
    const to = { ...from, top: from.top + scroll.scrollTop };

    detail.classList.remove('is-open');
    detail.classList.add('is-animating');
    if (announcement) announcement.textContent = 'Plans';

    if (reduceMotion.matches) return finishClose();

    hero.appendChild(ghost);
    textMorphs.forEach(({ targetText }) => { targetText.style.visibility = 'hidden'; });
    const morph = run(hero, [box(HERO), box(to)], { duration: CLOSE_MS, easing: EASE });
    run(heroUI, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' });
    textMorphs.forEach(({ node, start, end }) => run(node, [end, start], { duration: CLOSE_MS, easing: EASE }));
    run(heroBand, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' });
    run(chromeTop, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' });
    run(chromeBottom, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }],
      { duration: 260, easing: EASE_IN });
    sections.slice().reverse().forEach((el, i) => run(el,
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(40px)' }],
      { duration: 280, delay: i * 30, easing: EASE_IN }));
    run(backdrop, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 140, easing: 'ease-in-out' });

    stageAnim?.cancel();
    stageAnim = stage.animate([
      { opacity: 0, transform: 'translateX(-50%) translateY(36px) scale(.94)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'translateX(-50%)', filter: 'blur(0px)' }
    ], { duration: 520, delay: 120, easing: EASE, fill: 'backwards' });
    cancelHome();
    homeAnims = homeParts.map((el, i) => el.animate([HOME_HIDDEN, HOME_SHOWN],
      { duration: 380, delay: 120 + i * 20, easing: EASE, fill: 'backwards' }));

    morph.finished.then(finishClose, () => {});
  }

  function finishClose() {
    clearRunning();
    stageAnim?.cancel();
    stageAnim = null;
    cancelHome();
    current.ghost.remove();
    current.textMorphs.forEach(({ targetText }) => { targetText.style.visibility = ''; });
    current.card.style.visibility = 'visible';
    detail.classList.remove('is-animating', 'is-open');
    detail.setAttribute('aria-hidden', 'true');
    detail.inert = true;
    setHomeInert(false);
    current = null;
    state = 'closed';
    stack.focus({ preventScroll: true });
  }

  // ---------- Input ----------

  // A tap on the front card opens it; a drag only moves the stack. plans-stack-cards.js takes pointer
  // input on the whole stage (captured by the ruler), so the click lands on the stage.
  let down = null;
  stage.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), card: e.target.closest('.plan') };
  });
  stage.addEventListener('click', e => {
    const d = down;
    down = null;
    if (!d || !d.card || d.card !== frontCard()) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    open(d.card);
  });
  stage.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    open(frontCard());
  });

  closeBtn.addEventListener('click', close);
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
})();
