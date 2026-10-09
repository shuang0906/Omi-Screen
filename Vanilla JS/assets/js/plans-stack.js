(() => {
  'use strict';

  // Cards in the stack. Amounts are placeholders.
  const PLANS = [
    { name: 'Tokyo Trip', meta: 'Flight • Jan 15', img: './assets/img/plans/sea.png' },
    { name: 'Amalfi Dinner', meta: 'Dining • Mar 10', img: './assets/img/plans/pasta.jpg' },
    { name: 'Matcha Kit', meta: 'Food • Feb 02', img: './assets/img/plans/matcha.jpg' },
    { name: 'Alps Weekend', meta: 'Travel • Feb 20', img: './assets/img/plans/mountains.jpg' },
    { name: 'Citrus Box', meta: 'Groceries • Mar 22', img: './assets/img/plans/lemons.png' },
    { name: 'Family Day', meta: 'Leisure • Apr 05', img: './assets/img/plans/shadows.png' },
    { name: 'Dolomites', meta: 'Travel • Apr 18', img: './assets/img/plans/peaks.png' },
    { name: 'Pantry Restock', meta: 'Groceries • May 01', img: './assets/img/plans/groceries.png' },
    { name: 'Living Room', meta: 'Furniture • May 20', img: './assets/img/plans/interior.png' }
  ];
  const AMOUNT = '$1,290';
  const PROGRESS = '$1,290/$5,000';

  // Stack geometry measured from Figma (stage coordinates, px). Depth 0 = front card.
  // Depth 3 is extrapolated: the slot a new card fades into at the back.
  const CARD = 266;
  const STAGE_W = 390;
  const LEVELS = [
    { top: 141, size: 266, blur: 0,     opacity: 1 },
    // Figma layer blur 4.376 / 3.846 (= 4.693 before scale); CSS blur ≈ half the Figma radius
    { top: 112, size: 248, blur: 2.35, opacity: 1 },
    { top: 97,  size: 218, blur: 2.35, opacity: 1 },
    { top: 89,  size: 192, blur: 2.35, opacity: 0 }
  ];
  const DROP = 480;              // px the front card falls to leave the 600px stage

  // Ruler: ticks 25px apart; one card per 3 ticks.
  const TICK_GAP = 25;
  const TICKS_PER_CARD = 3;
  const STEP = TICK_GAP * TICKS_PER_CARD; // 75px of ruler = 1 card
  const RULER_W = 351.5;
  const RULER_H = 18;
  const RULER_CENTER = 175.75;   // the fixed dark tick

  const DRAG_GAIN = 0.6;         // ruler px per px of pointer travel
  const INERTIA = 90;            // ms of release velocity carried into the snap target
  const SNAP_MIN = 520;          // ms, snap-back / short settle
  const SNAP_PER_CARD = 320;     // ms added per card travelled
  const SNAP_MAX = 1200;
  // Release keeps the finger's momentum, so it only decelerates (ease-out cubic).
  const EASE_RELEASE = cubicBezier(.33, 1, .68, 1);
  // Holding an arrow key keeps flipping cards: accelerate to a cruise speed, then on
  // release decelerate into the next card ahead.
  const SPIN_SPEED = STEP / 200;      // px per ms ≈ one card every 0.20s (peak)
  const SPIN_ACCEL = SPIN_SPEED / 380; // reaches cruise speed in 0.38s
  const SPIN_STOP_MIN = 260;          // ms, shortest release settle
  const SPIN_STOP_MAX = 720;
  const TAP_TIME = 250;               // key held longer than this starts spinning
  const TAP_DURATION = 600;           // ms, one-card move on a tap
  // Tap: a pronounced slow-in / fast / slow-out (ease-in-out quart).
  const EASE_TAP = cubicBezier(.76, 0, .24, 1);

  // CSS-style cubic-bezier(x1, y1, x2, y2) easing: solve x(t) = p, return y(t).
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const x = t => ((ax * t + bx) * t + cx) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    const y = t => ((ay * t + by) * t + cy) * t;
    return p => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let t = p;
      for (let i = 0; i < 6; i++) {
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= (x(t) - p) / d;
      }
      t = Math.min(1, Math.max(0, t));
      for (let i = 0, lo = 0, hi = 1; i < 12 && Math.abs(x(t) - p) > 1e-5; i++) {
        if (x(t) < p) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return y(t);
    };
  }

  const stack = document.querySelector('[data-stack="cards"]');
  const ruler = document.querySelector('[data-stack="ruler"]');
  const ticksSvg = document.querySelector('[data-stack="ticks"]');
  const announcement = document.querySelector('[data-announcement]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const N = PLANS.length;

  stack.innerHTML = PLANS.map((p, i) => `
    <article class="plan" aria-roledescription="slide" aria-label="${i + 1} of ${N}">
      <img class="plan-img" src="${p.img}" alt="" draggable="false">
      <div class="plan-content">
        <div class="plan-band"></div>
        <div class="plan-head">
          <p class="plan-name">${p.name}</p>
          <p class="plan-meta">${p.meta}</p>
        </div>
        <p class="plan-amount">${AMOUNT}</p>
        <p class="plan-progress">${PROGRESS}</p>
      </div>
    </article>`).join('');
  const cards = Array.from(stack.children);

  // Same geometry as the Figma ruler (15 ticks, 25px apart); drawn in code so the ticks
  // can slide while the dark centre tick stays put. One spare tick each side fades in/out.
  const SLIDING = 17;
  ticksSvg.innerHTML =
    Array.from({ length: SLIDING }, () => `<line class="tick" y1="0" y2="${RULER_H}"/>`).join('') +
    `<line class="tick-active" x1="${RULER_CENTER}" x2="${RULER_CENTER}" y1="0" y2="${RULER_H}"/>`;
  const ticks = Array.from(ticksSvg.querySelectorAll('.tick'));

  ruler.setAttribute('aria-valuemax', N);

  // State: ruler offset in px. Negative = ticks moved left = later cards.
  let offset = 0;
  let target = 0;
  let dragging = false;
  let raf = 0;
  let lastIndex = -1;

  const mod = (n, m) => ((n % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;

  function level(d) {
    const k = Math.min(LEVELS.length - 2, Math.floor(d));
    const t = d - k, a = LEVELS[k], b = LEVELS[k + 1];
    return {
      top: lerp(a.top, b.top, t),
      size: lerp(a.size, b.size, t),
      blur: lerp(a.blur, b.blur, t),
      opacity: lerp(a.opacity, b.opacity, t)
    };
  }

  function render() {
    const pos = -offset / STEP; // in cards
    cards.forEach((card, i) => {
      // Depth behind the front card, wrapped to [-N/2, N/2) for the infinite loop.
      const d = mod(i - pos + N / 2, N) - N / 2;
      const last = LEVELS.length - 1;
      if (d <= -1 || d >= last) {
        card.style.visibility = 'hidden';
        return;
      }
      let top, size, blur, opacity;
      if (d < 0) {
        // Front card dropping out of frame.
        ({ size, blur, opacity } = LEVELS[0]);
        top = LEVELS[0].top - d * DROP;
      } else {
        ({ top, size, blur, opacity } = level(d));
      }
      const s = size / CARD;
      const x = (STAGE_W - CARD) / 2;
      card.style.visibility = 'visible';
      card.style.transform = `translate3d(${x}px, ${top}px, 0) scale(${s})`;
      card.style.filter = blur > .01 ? `blur(${blur.toFixed(2)}px)` : 'none';
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(Math.round(100 - d * 10));
      card.style.setProperty('--fade', Math.max(0, 1 - Math.max(0, d) * 1.6).toFixed(3));
    });

    // Ticks slide with the offset; fade out over one gap beyond either end.
    const shift = mod(offset, TICK_GAP);
    ticks.forEach((tick, k) => {
      const x = .75 + (k - 1) * TICK_GAP + shift;
      const outside = Math.max(0, -x, x - (RULER_W - .75));
      tick.setAttribute('x1', x.toFixed(2));
      tick.setAttribute('x2', x.toFixed(2));
      tick.style.opacity = Math.max(0, 1 - outside / TICK_GAP).toFixed(3);
    });

    const index = mod(Math.round(pos), N);
    if (index !== lastIndex) {
      lastIndex = index;
      cards.forEach((card, i) => card.setAttribute('aria-hidden', String(i !== index)));
      ruler.setAttribute('aria-valuenow', index + 1);
      ruler.setAttribute('aria-valuetext', `${PLANS[index].name}, ${index + 1} of ${N}`);
      if (announcement && !dragging) announcement.textContent = `${PLANS[index].name}, ${index + 1} of ${N}`;
    }
  }

  // Time-based tween from the current offset to target.
  let tween = null;
  function loop(now) {
    const p = Math.min(1, (now - tween.start) / tween.duration);
    offset = tween.from + (tween.to - tween.from) * tween.ease(p);
    render();
    if (p < 1) {
      raf = requestAnimationFrame(loop);
    } else {
      offset = target;
      tween = null;
      raf = 0;
    }
  }
  function animateTo(next, ease, fixedDuration) {
    target = next;
    cancelAnimationFrame(raf);
    raf = 0;
    const distance = Math.abs(target - offset);
    if (reduceMotion.matches || distance < .01) {
      offset = target;
      tween = null;
      render();
      return;
    }
    const n = distance / STEP;
    const duration = fixedDuration || Math.min(SNAP_MAX, SNAP_MIN + SNAP_PER_CARD * Math.max(0, n - .5));
    tween = { from: offset, to: target, start: performance.now(), duration, ease };
    raf = requestAnimationFrame(loop);
  }
  const snap = a => Math.round(a / STEP) * STEP;

  // Horizontal drag on the ruler.
  let lastX = 0;
  let samples = [];
  ruler.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    ruler.setPointerCapture(e.pointerId);
    ruler.classList.add('is-dragging');
    clearTimeout(holdTimer);
    stopSpin();
    cancelAnimationFrame(raf);
    raf = 0;
    tween = null;
    target = offset;
    lastX = e.clientX;
    samples = [{ t: e.timeStamp, a: offset }];
  });
  ruler.addEventListener('pointermove', e => {
    if (!dragging) return;
    offset += (e.clientX - lastX) * DRAG_GAIN;
    lastX = e.clientX;
    target = offset;
    samples.push({ t: e.timeStamp, a: offset });
    while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
    render();
  });
  function release(e) {
    if (!dragging) return;
    dragging = false;
    ruler.classList.remove('is-dragging');
    if (ruler.hasPointerCapture(e.pointerId)) ruler.releasePointerCapture(e.pointerId);
    const first = samples[0];
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 ? (offset - first.a) / dt : 0; // px per ms
    const projected = offset + velocity * INERTIA;
    // A flick carries at most one card beyond where the ruler was let go.
    const limit = STEP;
    animateTo(snap(Math.max(offset - limit, Math.min(offset + limit, projected))), EASE_RELEASE);
  }
  ruler.addEventListener('pointerup', release);
  ruler.addEventListener('pointercancel', release);

  // Keyboard: right = next card (ticks move left).
  // Tap = one card; hold = keep flipping until the key is released.
  const KEY_DIR = { ArrowLeft: 1, ArrowRight: -1 };
  const held = [];       // arrow keys currently down, last pressed wins
  let spin = null;       // { v, from, last } while spinning
  let holdTimer = 0;
  let lastStep = 0;

  function spinFrame(now) {
    const dt = Math.min(50, now - spin.last);
    spin.last = now;
    const dir = held.length ? KEY_DIR[held[held.length - 1]] : 0;
    const vt = dir * SPIN_SPEED;
    spin.v += Math.sign(vt - spin.v) * Math.min(Math.abs(vt - spin.v), SPIN_ACCEL * dt);
    offset += spin.v * dt;
    target = offset;
    render();
    raf = requestAnimationFrame(spinFrame);
  }
  // Current speed of the running tween, in px per ms (0 when idle).
  function tweenVelocity() {
    if (!tween) return 0;
    const p = Math.min(1, (performance.now() - tween.start) / tween.duration);
    const e = tween.ease, h = .01;
    return (tween.to - tween.from) * (e(Math.min(1, p + h)) - e(p)) / (h * tween.duration);
  }
  function startSpin(from) {
    // Pick up the tap's speed so the hand-off into spinning is seamless.
    const v = tweenVelocity();
    cancelAnimationFrame(raf);
    tween = null;
    spin = { v, from, last: performance.now() };
    raf = requestAnimationFrame(spinFrame);
  }
  function stopSpin() {
    if (!spin) return;
    cancelAnimationFrame(raf);
    raf = 0;
    spin = null;
  }
  function releaseSpin() {
    const { v, from } = spin;
    const dir = Math.sign(v) || 1;
    stopSpin();
    // Next card ahead in the direction of travel, and always at least one card.
    let next = (dir > 0 ? Math.ceil(offset / STEP) : Math.floor(offset / STEP)) * STEP;
    if (next === from) next += dir * STEP;
    // Settle with a curve whose starting slope equals the current speed, so there is no
    // jolt: cubic-bezier(.33, y1, .68, 1) starts at (y1/.33)·distance/duration.
    const speed = Math.abs(v);
    let distance = Math.abs(next - offset);
    let duration = speed > 1e-4 ? 3 * distance / speed : SPIN_STOP_MAX;
    // Too close to brake over SPIN_STOP_MIN: coast on to further cards until there is room.
    while (speed > 1e-4 && duration < SPIN_STOP_MIN) {
      next += dir * STEP;
      distance += STEP;
      duration = 3 * distance / speed;
    }
    duration = Math.max(SPIN_STOP_MIN, Math.min(SPIN_STOP_MAX, duration));
    const y1 = Math.min(1, .33 * speed * duration / distance);
    animateTo(next, cubicBezier(.33, y1, .68, 1), duration);
  }

  ruler.addEventListener('keydown', e => {
    if (!(e.key in KEY_DIR)) return;
    e.preventDefault();
    if (reduceMotion.matches) {
      // No animation: step one card at a time, auto-repeating while held.
      if (e.timeStamp - lastStep < 220) return;
      lastStep = e.timeStamp;
      animateTo(snap(target) + KEY_DIR[e.key] * STEP);
      return;
    }
    if (e.repeat || held.includes(e.key)) return;
    held.push(e.key);
    if (spin) return; // already spinning: spinFrame follows the newest key
    tap(KEY_DIR[e.key]);
  });

  // A tap moves exactly one card with EASE_TAP; if the key is still down after
  // TAP_TIME the move hands over to continuous flipping.
  function tap(dir) {
    const base = tween ? tween.to : snap(offset);
    const next = base + dir * STEP;
    const v = tweenVelocity();
    let ease = EASE_TAP;
    if (v * dir > 1e-4) {
      // Tapping again while still moving the same way: keep the current speed.
      const y1 = Math.min(1, .4 * Math.abs(v) * TAP_DURATION / Math.abs(next - offset));
      ease = cubicBezier(.4, y1, .24, 1);
    }
    animateTo(next, ease, TAP_DURATION);
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (held.length && !spin && !dragging) startSpin(base);
    }, TAP_TIME);
  }

  function endKeys() {
    clearTimeout(holdTimer);
    if (spin) releaseSpin();
  }
  ruler.addEventListener('keyup', e => {
    const i = held.indexOf(e.key);
    if (i < 0) return;
    held.splice(i, 1);
    if (!held.length) endKeys();
  });
  ruler.addEventListener('blur', () => {
    held.length = 0;
    endKeys();
  });

  render();
})();
