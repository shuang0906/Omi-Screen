(() => {
  // Plans shown in the ring, clockwise from the first segment. Amounts other than Tokyo Trip are placeholders.
  const SEGMENTS = [
    { name: 'Tokyo Trip',     pct: 35, amount: 52000 },
    { name: 'Emergency Fund', pct: 25, amount: 37150 },
    { name: 'New Car',        pct: 20, amount: 29720 },
    { name: 'Wedding',        pct: 12, amount: 17830 },
    { name: 'Home Office',    pct: 8,  amount: 11890 },
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

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('[data-pc]');
  const svg = root.querySelector('[data-pc="segments"]');
  const pointer = root.querySelector('[data-pc="pointer"]');
  const valueEl = root.querySelector('[data-pc="value"]');
  const captionEl = root.querySelector('[data-pc="caption"]');
  const percentEl = root.querySelector('[data-pc="percent"]');
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

  // Shared paints. The fills are the Figma radial gradients (centre 136,136, r 136); the rim / glow
  // approximate the GLASS effect (light −45°, intensity 0.8, depth 16) on the flat canvas.
  const ring = RI / R;
  const defs = el('defs');
  defs.innerHTML = `
    <radialGradient id="pc-fill-glass" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C}" r="${R}">
      <stop offset="${ring}" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#d5d5d5"/>
    </radialGradient>
    <radialGradient id="pc-fill-selected" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C}" r="${R}">
      <stop offset="${ring}" stop-color="#bcb754" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#bcb754" stop-opacity="0"/>
    </radialGradient>
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
      el('path', { d, fill: 'url(#pc-fill-glass)', 'fill-opacity': '0.2' }),
      el('path', { d, fill: '#fff', 'fill-opacity': '0.02' }),
      el('path', { d, fill: 'none', stroke: '#fff', 'stroke-opacity': '0.12', 'stroke-width': '6', 'clip-path': `url(#${clipId})`, filter: 'url(#pc-glow)' }),
      el('path', { d, fill: 'none', stroke: 'url(#pc-rim)', 'stroke-width': '1.4', 'clip-path': `url(#${clipId})` }),
    );

    g.append(
      glass,
      el('path', { class: 'pc-seg-selected', d, fill: 'url(#pc-fill-selected)' }),
      el('path', { class: 'pc-seg-sheen', d, fill: '#fff', 'fill-opacity': '0.12' }),
      el('path', { class: 'pc-seg-focus', d }),
    );
    svg.appendChild(g);

    segs.push({ ...s, g, mid: (a + b) / 2 });
    a = b + GAP;
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
