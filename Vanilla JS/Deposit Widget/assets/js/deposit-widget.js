(() => {
  // Ruler (Figma node 514:7183): 57 ticks across 354px, $10 per tick, label every $100.
  const MIN = 100;
  const MAX = 2500;  // max available balance
  const STEP = 10;
  const LABEL_EVERY = 100;
  const START = 500;
  const TICK_GAP = 6.28125;
  const APY = 1.5; // $500 for 1Y → +$750.00 in the design

  // Ticks swell towards the needle. Fitted to the Figma lines: with
  // G = BUMP · exp(-d² / 2σ²), opacity = 0.2 + G and length = 12.6 + 36.6 · G.
  const TICK_Y = 40.14;        // vertical centre of the ticks in the ruler box
  const TICK_LEN = 12.6;
  const TICK_OPACITY = 0.2;
  const BUMP = 1.121;
  const BUMP_SIGMA = 21.2;
  const BUMP_LEN = 36.6;
  // Glass pill (30px wide): ticks under it are hidden; the lens shows the nearest ones
  // pulled in (×0.84) at 55%, 32px long, as in the design (167 / 188).
  const LENS_HALF = 15;
  const LENS_SCALE = 0.84;
  const LENS_LEN = 32;
  const LENS_OPACITY = 0.55;

  // Label curve: ±1 label sits on its tick at 50% opacity, ±2 is pushed out a little at 20%.
  const NEAR = TICK_GAP * (LABEL_EVERY / STEP); // 62.8px
  const FAR = NEAR * 2;
  const WARP = 0.12;

  const FRICTION = 0.92;
  const SNAP_EASE = 0.18;

  // Rubber band past MIN / MAX: no hard stop. The pull is resisted (it approaches
  // RUBBER_MAX px), the ticks next to the end spread apart, and a spring brings it back.
  const RUBBER_MAX = 150;      // px, asymptote of the overshoot
  const RUBBER_K = 0.55;       // lower = stiffer
  const STRETCH = 2.2;         // extra gap next to the end at full pull (2.2 → 3.2× the gap)
  const STRETCH_FALLOFF = 36;  // px over which the stretch fades back to the normal gap
  const SPRING_K = 0.09;       // per frame²
  const SPRING_C = 0.6;        // per frame (≈ critical damping, no bounce past the end)
  const NUDGE_VELOCITY = 12;   // $/frame when a key pushes against an end
  const WHEEL_SNAP_DELAY = 140;
  const FLOW_EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const AMOUNT_FLOW_MS = 450;
  const YIELD_FLOW_MS = 700;

  const root = document.querySelector('[data-dw]');
  if (!root) return;

  // Touch-style pointer, scoped to this widget. Native touch keeps its normal behavior.
  const touchCircle = document.createElement('span');
  touchCircle.className = 'dw-touch-circle';
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

  const ruler = root.querySelector('[data-dw="ruler"]');
  const ticksEl = root.querySelector('[data-dw="ticks"]');
  const lensTicksEl = root.querySelector('[data-dw="lens-ticks"]');
  const labelsEl = root.querySelector('[data-dw="labels"]');
  const amountEl = root.querySelector('[data-dw="amount"]');
  const yieldEl = root.querySelector('[data-dw="yield"]');
  const chipsEl = root.querySelector('[data-dw="chips"]');
  const chips = [...chipsEl.querySelectorAll('.dw-chip')];
  const pill = chipsEl.querySelector('.dw-chip-pill');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const center = ruler.clientWidth / 2;
  const pxPerDollar = TICK_GAP / STEP;

  const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const snapValue = (v) => clamp(Math.round(v / STEP) * STEP, MIN, MAX);

  // Tick pools: only the ticks inside the ruler exist; the frame loop re-dresses them.
  const makePool = (parent, n) => Array.from({ length: n }, () => {
    const el = document.createElement('i');
    parent.appendChild(el);
    return { el, shown: true };
  });
  const tickPool = makePool(ticksEl, Math.ceil(ruler.clientWidth / TICK_GAP) + 3);
  const lensPool = makePool(lensTicksEl, 6);

  function drawTick(t, x, len, opacity) {
    if (opacity <= 0.002) { hideTick(t); return; }
    const h = len + 2; // round caps add 1px at each end
    t.el.style.height = `${h}px`;
    t.el.style.transform = `translate3d(${x - 1}px,${TICK_Y - h / 2}px,0)`;
    t.el.style.opacity = opacity.toFixed(3);
    t.shown = true;
  }
  function hideTick(t) {
    if (t.shown) { t.el.style.opacity = '0'; t.shown = false; }
  }

  const labels = [];
  for (let v = Math.ceil(MIN / LABEL_EVERY) * LABEL_EVERY; v <= MAX; v += LABEL_EVERY) {
    const span = document.createElement('span');
    span.textContent = `$${whole.format(v)}`;
    span.style.opacity = '0';
    labelsEl.appendChild(span);
    labels.push({ v, el: span, w: 0, visible: false });
  }
  labels.forEach((l) => { l.w = l.el.offsetWidth; });
  document.fonts?.ready.then(() => { labels.forEach((l) => { l.w = l.el.offsetWidth; }); render(); });

  ruler.setAttribute('aria-valuemin', MIN);
  ruler.setAttribute('aria-valuemax', MAX);

  let value = START;   // may sit past MIN / MAX while rubber-banding
  let mode = null;     // 'glide' (inertia) | 'spring' (back to an end) | 'snap' (onto a tick)
  let target = null;   // snap / spring target
  let velocity = 0;    // $ per frame
  let months = Number(chips.find((c) => c.getAttribute('aria-checked') === 'true').dataset.months);
  let shownAmount = null;
  let raf = 0;

  function labelOpacity(a) {
    // Gone before the label would touch the glass pill (15px + half a label + gap)
    if (a <= NEAR) return 0.5 * smooth((a - 34) / (NEAR - 6 - 34));
    if (a <= FAR) return 0.5 - 0.3 * (a - NEAR) / NEAR;
    return 0.2 * (1 - smooth((a - FAR) / (center - FAR + 20)));
  }

  // Rubber band ------------------------------------------------------------
  const rubber = (px) => (1 - 1 / (px * RUBBER_K / RUBBER_MAX + 1)) * RUBBER_MAX;
  const unrubber = (px) => (RUBBER_MAX / RUBBER_K) * (1 / (1 - Math.min(px, RUBBER_MAX * 0.999) / RUBBER_MAX) - 1);
  const endOf = (v) => (v > MAX ? MAX : v < MIN ? MIN : null);

  // Unclamped input (drag / wheel) → value with resistance past the ends, and back
  function fromRaw(raw) {
    if (raw > MAX) return MAX + rubber((raw - MAX) * pxPerDollar) / pxPerDollar;
    if (raw < MIN) return MIN - rubber((MIN - raw) * pxPerDollar) / pxPerDollar;
    return raw;
  }
  function toRaw(v) {
    if (v > MAX) return MAX + unrubber((v - MAX) * pxPerDollar) / pxPerDollar;
    if (v < MIN) return MIN - unrubber((MIN - v) * pxPerDollar) / pxPerDollar;
    return v;
  }

  // Offset of a tick from the needle (px). Past an end the end tick trails the needle by
  // the overshoot and the gaps next to it widen, fading back to normal further away.
  function offsetOf(v) {
    if (value > MAX) return -stretched(MAX - v, (value - MAX) * pxPerDollar);
    if (value < MIN) return stretched(v - MIN, (MIN - value) * pxPerDollar);
    return (v - value) * pxPerDollar;
  }
  function stretched(fromEnd, over) {
    const e = fromEnd * pxPerDollar;
    return over + e * (1 + STRETCH * (over / RUBBER_MAX) * Math.exp(-e / STRETCH_FALLOFF));
  }

  function render() {
    // Ticks within the ruler, from the left edge
    const first = Math.max(MIN, Math.ceil((Math.min(value, MAX) - (center + 2) / pxPerDollar) / STEP) * STEP);
    let ti = 0;
    let li = 0;
    for (let v = first; v <= MAX; v += STEP) {
      const d = offsetOf(v);
      if (d < -center - 2) continue;
      if (d > center + 2 || ti >= tickPool.length) break;
      const a = Math.abs(d);
      const g = BUMP * Math.exp(-(d * d) / (2 * BUMP_SIGMA * BUMP_SIGMA));
      const outside = smooth((a - (LENS_HALF - 1)) / 2.5);
      drawTick(tickPool[ti++], center + d, TICK_LEN + BUMP_LEN * g, Math.min(1, TICK_OPACITY + g) * outside);

      const lx = d * LENS_SCALE;
      const la = Math.abs(lx);
      if (la < LENS_HALF && li < lensPool.length) {
        const o = LENS_OPACITY * smooth((la - 6.5) / 2.5) * (1 - smooth((la - (LENS_HALF - 1.5)) / 1.5));
        drawTick(lensPool[li++], center + lx, LENS_LEN, o);
      }
    }
    while (ti < tickPool.length) hideTick(tickPool[ti++]);
    while (li < lensPool.length) hideTick(lensPool[li++]);

    for (const l of labels) {
      const dx = offsetOf(l.v);
      const a = Math.abs(dx);
      if (a > center + 40) {
        if (l.visible) { l.el.style.opacity = '0'; l.visible = false; }
        continue;
      }
      const x = center + dx * (1 + WARP * (a / FAR) ** 4);
      l.el.style.transform = `translate3d(${x - l.w / 2}px,0,0)`;
      l.el.style.opacity = labelOpacity(a).toFixed(3);
      l.visible = true;
    }

    const amount = snapValue(value);
    if (amount !== shownAmount) {
      shownAmount = amount;
      setFlow(amountEl, amount, `$${whole.format(amount)}`);
      ruler.setAttribute('aria-valuenow', amount);
      ruler.setAttribute('aria-valuetext', `$${whole.format(amount)}`);
      updateYield();
    }
  }

  // Amounts: NumberFlow (https://number-flow.barvian.me), loaded as a module in the HTML.
  // Until it is ready (or if it fails to load) the elements just show plain text.
  const AMOUNT_FORMAT = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 };
  const YIELD_FORMAT = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' };
  let flowReady = false;

  const yieldFor = (amount) => amount * APY * (months / 12);

  function setFlow(el, v, text) {
    if (flowReady) el.update(v);
    else el.textContent = text;
  }

  function updateYield() {
    const v = yieldFor(shownAmount);
    setFlow(yieldEl, v, `+$${money.format(v)}`);
  }

  function setupFlow(el, format, duration, v) {
    el.textContent = '';
    el.locales = 'en-US';
    el.format = format;
    el.plugins = [window.NumberFlowPlugins.continuous];
    el.transformTiming = { duration, easing: FLOW_EASE };
    el.spinTiming = { duration, easing: FLOW_EASE };
    el.opacityTiming = { duration: 350, easing: 'ease-out' };
    el.animated = false;
    el.update(v);
    el.animated = true;
  }

  function initFlows() {
    if (flowReady || !window.NumberFlowPlugins || shownAmount === null) return;
    flowReady = true;
    setupFlow(amountEl, AMOUNT_FORMAT, AMOUNT_FLOW_MS, shownAmount);
    setupFlow(yieldEl, YIELD_FORMAT, YIELD_FLOW_MS, yieldFor(shownAmount));
  }

  // Motion: inertia, a spring back from past an end, then ease onto the nearest tick ----
  let lastFrame = 0;

  function loop(now) {
    raf = 0;
    const f = lastFrame ? Math.min(3, (now - lastFrame) / 16.67) : 1;
    lastFrame = now;

    if (mode === 'glide') {
      const end = endOf(value);
      if (end !== null) {
        // Ran past an end: the spring takes over the momentum and brings it back
        mode = 'spring';
        target = end;
      } else {
        value += velocity * f;
        velocity *= FRICTION ** f;
        if (Math.abs(velocity) < 0.4) { mode = 'snap'; target = snapValue(value); }
      }
    }
    if (mode === 'spring') {
      velocity += (-SPRING_K * (value - target) - SPRING_C * velocity) * f;
      value += velocity * f;
      if (Math.abs(value - target) * pxPerDollar < 0.05 && Math.abs(velocity) * pxPerDollar < 0.05) {
        value = target;
        mode = null;
      }
    } else if (mode === 'snap') {
      value += (target - value) * (1 - (1 - SNAP_EASE) ** f);
      if (Math.abs(target - value) < 0.05) { value = target; mode = null; }
    }

    render();
    if (mode) raf = requestAnimationFrame(loop);
    else { target = null; velocity = 0; lastFrame = 0; }
  }

  function run(nextMode, to, vel = 0) {
    mode = nextMode;
    target = to;
    velocity = vel;
    if (reduceMotion) {
      value = nextMode === 'glide' ? snapValue(value) : to;
      mode = null; target = null; velocity = 0;
      render();
      return;
    }
    if (!raf) { lastFrame = 0; raf = requestAnimationFrame(loop); }
  }

  // Ease onto a tick, or spring back first when past an end
  function settle(to) {
    const end = endOf(value);
    if (end !== null) run('spring', end);
    else run('snap', snapValue(to));
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    mode = null;
    target = null;
    velocity = 0;
    lastFrame = 0;
  }

  // Drag ------------------------------------------------------------------
  let dragging = false;
  let dragRaw = 0;     // unclamped value under the finger
  let lastX = 0;
  let lastT = 0;
  let dragVel = 0;
  let downX = 0;
  let dragMoved = false;

  ruler.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stop();
    dragging = true;
    root.dispatchEvent(new CustomEvent("dw-drag-change", { detail: { dragging: true } }));
    dragMoved = false;
    dragRaw = toRaw(value);
    downX = e.clientX;
    lastX = e.clientX;
    lastT = e.timeStamp;
    dragVel = 0;
    ruler.setPointerCapture(e.pointerId);
    ruler.classList.add('is-dragging');
  });

  ruler.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    if (Math.abs(e.clientX - downX) > 3) dragMoved = true;
    const dt = Math.max(1, e.timeStamp - lastT);
    lastX = e.clientX;
    lastT = e.timeStamp;
    const prev = value;
    dragRaw -= dx / pxPerDollar;
    value = fromRaw(dragRaw);
    dragVel = 0.8 * ((value - prev) / dt * 16.7) + 0.2 * dragVel;
    render();
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    root.dispatchEvent(new CustomEvent("dw-drag-change", { detail: { dragging: false } }));
    ruler.classList.remove('is-dragging');
    if (ruler.hasPointerCapture(e.pointerId)) ruler.releasePointerCapture(e.pointerId);
    if (e.timeStamp - lastT > 80) dragVel = 0;
    const end = endOf(value);
    if (end !== null) run('spring', end, dragVel);
    else if (Math.abs(dragVel) < 0.5) settle(value);
    else run('glide', null, dragVel);
  };
  ruler.addEventListener('pointerup', endDrag);
  ruler.addEventListener('pointercancel', endDrag);

  // Wheel / trackpad --------------------------------------------------------
  let wheelTimer = 0;
  let wheelRaw = null;
  ruler.addEventListener('wheel', (e) => {
    e.preventDefault();
    stop();
    if (wheelRaw === null) wheelRaw = toRaw(value);
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    wheelRaw += d / pxPerDollar * 0.6;
    value = fromRaw(wheelRaw);
    render();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelRaw = null; settle(value); }, WHEEL_SNAP_DELAY);
  }, { passive: false });

  // Keyboard --------------------------------------------------------------
  ruler.addEventListener('keydown', (e) => {
    const base = mode === 'snap' || mode === 'spring' ? target : snapValue(value);
    const big = e.shiftKey ? LABEL_EVERY : STEP;
    const map = {
      ArrowRight: base + big, ArrowUp: base + big,
      ArrowLeft: base - big, ArrowDown: base - big,
      PageUp: base + LABEL_EVERY * 5, PageDown: base - LABEL_EVERY * 5,
      Home: MIN, End: MAX,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    const to = map[e.key];
    // Pushing against an end: a small rubber-band nudge instead of nothing
    if ((to > MAX && base >= MAX) || (to < MIN && base <= MIN)) {
      run('spring', base, to > MAX ? NUDGE_VELOCITY : -NUDGE_VELOCITY);
      return;
    }
    stop();
    settle(to);
  });

  // Click a label to jump to it (ignored after a drag)
  ruler.addEventListener('click', (e) => {
    if (dragMoved) return;
    const span = e.target.closest('.dw-labels span');
    if (!span) return;
    const l = labels.find((x) => x.el === span);
    if (l) settle(l.v);
  });

  // Period chips ----------------------------------------------------------
  function placePill(chip, animate) {
    if (!animate) pill.style.transition = 'none';
    pill.style.width = `${chip.offsetWidth}px`;
    pill.style.transform = `translateX(${chip.offsetLeft}px)`;
    if (!animate) { pill.offsetWidth; pill.style.transition = ''; }
  }

  function selectChip(chip, focus) {
    chips.forEach((c) => {
      const on = c === chip;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
    placePill(chip, true);
    if (focus) chip.focus();
    months = Number(chip.dataset.months);
    updateYield();
  }

  chips.forEach((c) => { c.tabIndex = c.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.dw-chip');
    if (chip) selectChip(chip, false);
  });
  chipsEl.addEventListener('keydown', (e) => {
    const i = chips.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    selectChip(chips[(i + d + chips.length) % chips.length], true);
  });

  const activeChip = () => chips.find((c) => c.getAttribute('aria-checked') === 'true');
  placePill(activeChip(), false);
  document.fonts?.ready.then(() => placePill(activeChip(), false));

  render();
  window.addEventListener('numberflow-ready', initFlows);
  initFlows(); // in case the module finished first
})();
