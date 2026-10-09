(() => {
  // Plans shown in the ring, clockwise from the first segment. Amounts other than Tokyo Trip are placeholders.
  // color = the selected fill.
  const SEGMENTS = [
    { name: 'Tokyo Trip',     pct: 35, amount: 52000, color: '#bcb754' },
    { name: 'Emergency Fund', pct: 25, amount: 37150, color: '#f8d1c2' },
    { name: 'New Car',        pct: 20, amount: 29720, color: '#c3e4f5' },
    { name: 'Wedding',        pct: 12, amount: 17830, color: '#31318c' },
    { name: 'Home Office',    pct: 8,  amount: 11890, color: '#359e3f' },
  ];
  const SELECTED = 0;

  // Figma geometry (node 552:4512). Angles are radians, clockwise from 3 o'clock, as in Figma arcData.
  const SIZE = 272;
  const C = SIZE / 2;
  const R = 136;                      // outer radius
  const RI = R * 0.7352941;           // innerRadius ratio → 100
  const CORNER = 4;                   // cornerRadius
  const START = 1.4451326;            // startingAngle of the first segment
  const GAP = 0.0279253;              // 1.6° between segments

  const COUNT_DURATION = 600;         // value roll, ms
  const FADE_DURATION = 450;          // selected fill crossfade, ms (matches the glass transition)

  // Wave on the selected gradient: the fade-out edge (Figma: 0.6 → 0 from inner to outer radius)
  // rises and falls along the arc. Two sines travelling in opposite directions; k = crests per turn,
  // speed = rad/s of phase (crest travel = speed / k), weight = share of the swing,
  // glow = brightness swing of the band that travels with it.
  const SELECTED_ALPHA = 0.6;
  const WAVES = [
    { k: 5, speed: 1.4,  weight: 0.7, glow: 0.1 },
    { k: 9, speed: -0.9, weight: 0.3, glow: 0.05 },
  ];
  // Where the fade ends, as a share of the ring width (1 = the outer edge): at the crests (PEAK)
  // and how far the troughs drop below them (SWING).
  const PEAK = 1.5;
  const SWING = 0.34;
  // Ripples running outward through the gradient: count across the ring width, speed in ring widths/s,
  // depth = brightness swing.
  const RIPPLE = { count: 1.6, speed: 0.35, depth: 0.1 };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('[data-pc]');
  if (!root) return;
  // Touch-style pointer, scoped to this widget. Native touch keeps its normal behavior.
  const touchCircle = document.createElement('span');
  touchCircle.className = 'pc-touch-circle';
  touchCircle.setAttribute('aria-hidden', 'true');
  root.appendChild(touchCircle);
  root.classList.add('has-touch-cursor');
  let cursorPointer = null;
  function moveTouchCircle(event) {
    if (cursorPointer !== null && event.pointerId !== cursorPointer) return;
    const rect = root.getBoundingClientRect();
    const x = (event.clientX - rect.left) * root.offsetWidth / rect.width;
    const y = (event.clientY - rect.top) * root.offsetHeight / rect.height;
    touchCircle.style.transform = 'translate3d(' + (x - 18) + 'px,' + (y - 18) + 'px,0)';
    touchCircle.classList.toggle('is-visible', event.pointerType !== 'touch' || cursorPointer !== null);
  }
  function releaseTouchCircle(event) {
    if (cursorPointer !== null && event.pointerId !== cursorPointer) return;
    cursorPointer = null;
    touchCircle.classList.remove('is-pressed');
    if (event.pointerType === 'touch') touchCircle.classList.remove('is-visible');
  }
  root.addEventListener('pointerenter', moveTouchCircle);
  root.addEventListener('pointermove', moveTouchCircle);
  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    cursorPointer = event.pointerId;
    moveTouchCircle(event);
    touchCircle.classList.add('is-pressed');
  });
  root.addEventListener('pointerleave', () => touchCircle.classList.remove('is-visible'));
  window.addEventListener('pointerup', releaseTouchCircle);
  window.addEventListener('pointercancel', releaseTouchCircle);
  window.addEventListener('blur', () => {
    cursorPointer = null;
    touchCircle.classList.remove('is-visible', 'is-pressed');
  });



  const svg = root.querySelector('[data-pc="segments"]');
  const pointer = root.querySelector('[data-pc="pointer"]');
  const valueEl = root.querySelector('[data-pc="value"]');
  const captionEl = root.querySelector('[data-pc="caption"]');
  const percentEl = root.querySelector('[data-pc="percent"]');
  const wave = root.querySelector('[data-pc="wave"]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const el = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  };
  const pt = (a, r) => `${(C + r * Math.cos(a)).toFixed(3)} ${(C + r * Math.sin(a)).toFixed(3)}`;

  // Annular sector with all four corners rounded, matching Figma's ellipse arc + cornerRadius.
  function sectorPath(a, b) {
    const k = CORNER;
    const dOut = Math.asin(k / (R - k));
    const dIn = Math.asin(k / (RI + k));
    const rOut = Math.sqrt((R - k) ** 2 - k * k);
    const rIn = Math.sqrt((RI + k) ** 2 - k * k);
    const large = b - a > Math.PI ? 1 : 0;
    return [
      `M${pt(a, rOut)}`,
      `A${k} ${k} 0 0 1 ${pt(a + dOut, R)}`,
      `A${R} ${R} 0 ${large} 1 ${pt(b - dOut, R)}`,
      `A${k} ${k} 0 0 1 ${pt(b, rOut)}`,
      `L${pt(b, rIn)}`,
      `A${k} ${k} 0 0 1 ${pt(b - dIn, RI)}`,
      `A${RI} ${RI} 0 ${large} 0 ${pt(a + dIn, RI)}`,
      `A${k} ${k} 0 0 1 ${pt(a, rIn)}`,
      'Z',
    ].join('');
  }

  // Shared paints. The rim / glow approximate the GLASS effect (light −45°, intensity 0.8, depth 16).
  // Unselected fill (after Figma node 4319:32117): 40% linear gradient along each segment's centre radius,
  // #ABABAB at the inner edge (Figma #D6D6D6, 20% darker) fading to transparent white at the outer edge.
  const GLASS_FILL_LENGTH = R - RI;
  const defs = el('defs');
  defs.innerHTML = `
    <linearGradient id="pc-rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.95"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="pc-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>`;
  svg.appendChild(defs);

  // ---------- Build segments ----------

  const segs = [];
  let a = START;
  SEGMENTS.forEach((s, i) => {
    const b = a + (s.pct / 100) * Math.PI * 2 - GAP;
    const d = sectorPath(a, b);
    const clipId = `pc-clip-${i}`;

    const mid = (a + b) / 2;
    const [x1, y1] = pt(mid, R - GLASS_FILL_LENGTH).split(' ');
    const [x2, y2] = pt(mid, R).split(' ');
    const fill = el('linearGradient', { id: `pc-fill-glass-${i}`, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 });
    fill.append(
      el('stop', { offset: '0', 'stop-color': '#ababab' }),
      el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' }),
    );
    defs.appendChild(fill);

    const clip = el('clipPath', { id: clipId });
    clip.appendChild(el('path', { d }));
    defs.appendChild(clip);

    const g = el('g', {
      class: 'pc-seg',
      role: 'radio',
      tabindex: '-1',
      'aria-checked': 'false',
      'aria-label': `${s.pct}% ${s.name}, ${money.format(s.amount)}`,
    });

    const glass = el('g', { class: 'pc-seg-glass' });
    glass.append(
      el('path', { d, fill: `url(#pc-fill-glass-${i})`, 'fill-opacity': '0.4' }),
      el('path', { d, fill: '#fff', 'fill-opacity': '0.02' }),
      el('path', { d, fill: 'none', stroke: '#fff', 'stroke-opacity': '0.12', 'stroke-width': '6', 'clip-path': `url(#${clipId})`, filter: 'url(#pc-glow)' }),
      el('path', { d, fill: 'none', stroke: 'url(#pc-rim)', 'stroke-width': '1.4', 'clip-path': `url(#${clipId})` }),
    );

    g.append(
      glass,
      el('path', { class: 'pc-seg-sheen', d, fill: '#fff', 'fill-opacity': '0.12' }),
      el('path', { class: 'pc-seg-focus', d }),
    );
    svg.appendChild(g);

    const rgb = [1, 3, 5].map((o) => parseInt(s.color.slice(o, o + 2), 16));
    segs.push({ ...s, g, a, b, mid, rgb, path: new Path2D(d) });
    a = b + GAP;
  });

  // ---------- Selected fill (wave) ----------

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(SIZE * dpr);
  wave.width = W;
  wave.height = W;
  const ctx = wave.getContext('2d');
  const buffer = document.createElement('canvas');
  buffer.width = W;
  buffer.height = W;
  const bctx = buffer.getContext('2d');
  const image = bctx.createImageData(W, W);
  const px = image.data;

  // Per segment, the device pixels it can cover (1px margin; the clip trims the edge) with their
  // radius as a 0–1 share of the ring and an unwrapped angle, so the wave is continuous across ±π.
  const TAU = Math.PI * 2;
  const margin = 1.5 / RI;
  segs.forEach((s) => {
    const idx = [], u = [], th = [];
    const span = s.b - s.a;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5) / dpr - C;
        const dy = (y + 0.5) / dpr - C;
        const r = Math.hypot(dx, dy);
        if (r < RI - 1.5 || r > R + 1.5) continue;
        let rel = ((Math.atan2(dy, dx) - s.a) % TAU + TAU) % TAU;
        if (rel > TAU - margin) rel -= TAU;
        if (rel > span + margin) continue;
        idx.push((y * W + x) * 4);
        u.push((r - RI) / (R - RI));
        th.push(s.a + rel);
      }
    }
    s.px = { idx: Int32Array.from(idx), u: Float32Array.from(u), th: Float32Array.from(th) };
    s.alpha = 0;
    s.fade = null;
  });

  let waveFrame = 0;
  const easeOut = (t) => 1 - (1 - t) ** 4;

  function paintSegment(s, time) {
    const { idx, u, th } = s.px;
    const [cr, cg, cb] = s.rgb;
    for (let n = 0; n < idx.length; n++) {
      const p = idx[n];
      px[p] = cr;
      px[p + 1] = cg;
      px[p + 2] = cb;
      let wave = 0, glow = 1;
      for (const w of WAVES) {
        const phase = w.k * th[n] - w.speed * time;
        wave += w.weight * Math.sin(phase);
        glow += w.glow * Math.sin(phase + 1.2);
      }
      const reach = PEAK - SWING * (1 - wave) / 2;
      const r = Math.max(0, u[n]);
      glow += RIPPLE.depth * Math.sin(TAU * (r * RIPPLE.count - time * RIPPLE.speed));
      const t = Math.max(0, 1 - r / reach);
      px[p + 3] = Math.min(255, SELECTED_ALPHA * t * glow * 255);
    }
  }

  function drawWave(now) {
    const time = reduceMotion.matches ? 0 : now / 1000;
    let live = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);

    for (const s of segs) {
      if (s.fade) {
        const t = Math.min(1, (now - s.fade.t0) / FADE_DURATION);
        s.alpha = s.fade.from + (s.fade.to - s.fade.from) * easeOut(t);
        if (t >= 1) s.fade = null;
        else live = true;
      }
      if (s.alpha <= 0) continue;
      paintSegment(s, time);
    }
    bctx.putImageData(image, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of segs) {
      if (s.alpha <= 0) continue;
      ctx.save();
      ctx.clip(s.path);
      ctx.globalAlpha = s.alpha;
      ctx.drawImage(buffer, 0, 0, SIZE, SIZE);
      ctx.restore();
      if (!reduceMotion.matches) live = true;
    }

    waveFrame = live ? requestAnimationFrame(drawWave) : 0;
  }

  function showSelected(i, animate) {
    const now = performance.now();
    segs.forEach((s, j) => {
      const to = j === i ? 1 : 0;
      if (!animate || reduceMotion.matches) {
        s.alpha = to;
        s.fade = null;
      } else if (s.alpha !== to) {
        s.fade = { from: s.alpha, to, t0: now };
      }
    });
    if (!waveFrame) waveFrame = requestAnimationFrame(drawWave);
  }

  reduceMotion.addEventListener('change', () => {
    if (!waveFrame) waveFrame = requestAnimationFrame(drawWave);
  });

  // ---------- Selection ----------

  let current = -1;
  let pointerDeg = 0;
  let captionTimer = 0;
  let shownAmount = SEGMENTS[SELECTED].amount;

  let flowReady = false;
  let shownPercent = SEGMENTS[SELECTED].pct;
  function setNumber(node, value, fallback, animate = true) {
    if (!flowReady) { node.textContent = fallback; return; }
    node.animated = animate && !reduceMotion.matches;
    node.update(value);
  }
  function rollValue(to, animate = true) {
    shownAmount = to;
    setNumber(valueEl, to, money.format(to), animate);
  }
  function initFlows() {
    if (flowReady || !window.NumberFlowPlugins) return;
    for (const [node, format, value] of [
      [valueEl, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }, shownAmount],
      [percentEl, { style: 'percent', maximumFractionDigits: 0 }, shownPercent / 100],
    ]) {
      node.textContent = '';
      node.locales = 'en-US';
      node.format = format;
      node.plugins = [window.NumberFlowPlugins.continuous];
      node.transformTiming = { duration: COUNT_DURATION, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      node.spinTiming = { duration: COUNT_DURATION, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      node.opacityTiming = { duration: 250, easing: 'ease-out' };
      node.animated = false;
      node.update(value);
    }
    flowReady = true;
  }

  function swapCaption(text) {
    clearTimeout(captionTimer);
    if (reduceMotion.matches) {
      captionEl.textContent = text;
      return;
    }
    captionEl.classList.add('is-out');
    captionTimer = setTimeout(() => {
      captionEl.textContent = text;
      captionEl.classList.remove('is-out');
    }, 180);
  }

  function select(i, { focus = false, animate = true } = {}) {
    i = (i + segs.length) % segs.length;
    if (i === current) return;
    const prev = current;
    current = i;

    segs.forEach((s, j) => {
      s.g.setAttribute('aria-checked', String(j === i));
      s.g.setAttribute('tabindex', j === i ? '0' : '-1');
    });
    if (focus) segs[i].g.focus();

    // The pointer art is placed for the first segment; turn it the shortest way to the new mid-angle.
    const target = ((segs[i].mid - segs[0].mid) * 180) / Math.PI;
    const delta = ((target - pointerDeg) % 360 + 540) % 360 - 180;
    pointerDeg += delta;
    pointer.style.transform = `rotate(${pointerDeg}deg)`;

    showSelected(i, animate && prev !== -1);

    const s = segs[i];
    shownPercent = s.pct;
    setNumber(percentEl, s.pct / 100, `${s.pct}%`, animate && prev !== -1);
    if (!animate || prev === -1) {
      rollValue(s.amount, false);
      captionEl.textContent = s.name;
      return;
    }
    rollValue(s.amount);
    swapCaption(s.name);
  }

  segs.forEach((s, i) => {
    s.g.addEventListener('click', () => select(i));
  });

  svg.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in keys) {
      e.preventDefault();
      select(current + keys[e.key], { focus: true });
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      select(e.key === 'Home' ? 0 : segs.length - 1, { focus: true });
    }
  });

  select(SELECTED, { animate: false });
  window.addEventListener('numberflow-ready', initFlows);
  initFlows();
})();
