(() => {
  'use strict';

  // Cards on the wheel. Amounts are placeholders.
  const PLANS = [
    { name: 'Tokyo Trip', meta: 'Flight • Jan 15', img: './assets/img/plans/sea.png' },
    { name: 'Matcha Kit', meta: 'Food • Feb 02', img: './assets/img/plans/matcha.jpg' },
    { name: 'Alps Weekend', meta: 'Travel • Feb 20', img: './assets/img/plans/mountains.jpg' },
    { name: 'Amalfi Dinner', meta: 'Dining • Mar 10', img: './assets/img/plans/pasta.jpg' },
    { name: 'Citrus Box', meta: 'Groceries • Mar 22', img: './assets/img/plans/lemons.png' },
    { name: 'Family Day', meta: 'Leisure • Apr 05', img: './assets/img/plans/shadows.png' },
    { name: 'Dolomites', meta: 'Travel • Apr 18', img: './assets/img/plans/peaks.png' },
    { name: 'Pantry Restock', meta: 'Groceries • May 01', img: './assets/img/plans/groceries.png' },
    { name: 'Living Room', meta: 'Furniture • May 20', img: './assets/img/plans/interior.png' }
  ];
  const AMOUNT = '$1,290';
  const PROGRESS = '$1,290/$5,000';

  // Wheel geometry measured from Figma (stage coordinates, px).
  const WHEEL_X = 194.44;        // card wheel pivot = dial disc centre
  const WHEEL_Y = 657.24;
  const RADIUS = 438.7;          // centre card centre to pivot
  const RADIUS_GROW = 12.7;      // side cards sit slightly further out (451.4 at ±1)
  const CARD_ARC = 30.6;         // degrees along the arc between neighbouring cards
  const CARD_TILT = 30;          // card rotation at ±1
  const MAX_BLUR = 4.693;        // side card blur
  const CARD_W = 219.368;
  const CARD_H = 265.773;

  // Dial: 40 ticks, 9deg apart; one card per 3 ticks.
  const TICKS = 40;
  const TICK_STEP = 360 / TICKS;
  const TICKS_PER_CARD = 3;
  const DIAL_STEP = TICK_STEP * TICKS_PER_CARD; // 27deg of dial = 1 card
  const DIAL_BASE = -0.45;       // Figma rotation of the tick group
  const TICK_R = 269.63;
  const TICK_LEN = 9.71638;

  const DRAG_GAIN = 0.6;         // dial degrees per degree of pointer travel
  const INERTIA = 90;            // ms of release velocity carried into the snap target
  const SNAP_MIN = 520;          // ms, snap-back / short settle
  const SNAP_PER_CARD = 320;     // ms added per card travelled
  const SNAP_MAX = 1200;
  // Release keeps the finger's momentum, so it only decelerates (ease-out cubic).
  const EASE_RELEASE = cubicBezier(.33, 1, .68, 1);
  // Holding an arrow key spins the dial: accelerate to a cruise speed, then on
  // release decelerate (EASE_RELEASE) into the next card ahead.
  const SPIN_SPEED = DIAL_STEP / 100; // deg per ms ≈ one card every 0.10s (peak)
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

  const wheel = document.querySelector('[data-plans="wheel"]');
  const dial = document.querySelector('[data-plans="dial"]');
  const ticksSvg = document.querySelector('[data-plans="ticks"]');
  const announcement = document.querySelector('[data-announcement]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const N = PLANS.length;

  wheel.innerHTML = PLANS.map((p, i) => `
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
  const cards = Array.from(wheel.children);

  // Same geometry as the Figma "Repeat group 1"; drawn in code so the active
  // (dark) tick can stay fixed at the top while the dial turns underneath.
  const c = TICK_R;
  ticksSvg.innerHTML = Array.from({ length: TICKS }, (_, i) => {
    const a = i * TICK_STEP * Math.PI / 180;
    const s = Math.sin(a), k = Math.cos(a);
    const f = n => n.toFixed(3);
    return `<line class="tick" x1="${f(c + s * c)}" y1="${f(c - k * c)}" x2="${f(c + s * (c - TICK_LEN))}" y2="${f(c - k * (c - TICK_LEN))}"/>`;
  }).join('');
  ticksSvg.style.transformOrigin = `${c}px ${c}px`;
  const ticks = Array.from(ticksSvg.children);

  dial.setAttribute('aria-valuemax', N);

  // State: dial angle in degrees. Positive = clockwise = cards move right.
  let angle = 0;
  let target = 0;
  let dragging = false;
  let raf = 0;
  let lastIndex = -1;
  let activeTick = -1;

  const mod = (n, m) => ((n % m) + m) % m;

  function render() {
    const pos = angle / DIAL_STEP; // in cards
    cards.forEach((card, i) => {
      // Offset from centre in cards, wrapped to [-N/2, N/2) for the infinite loop.
      const o = mod(i + pos + N / 2, N) - N / 2;
      const a = o * CARD_ARC * Math.PI / 180;
      const r = RADIUS + RADIUS_GROW * o * o;
      const x = WHEEL_X + Math.sin(a) * r - CARD_W / 2;
      const y = WHEEL_Y - Math.cos(a) * r - CARD_H / 2;
      const d = Math.min(Math.abs(o), 1);
      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${o * CARD_TILT}deg)`;
      card.style.filter = d > .001 ? `blur(${(d * MAX_BLUR).toFixed(2)}px)` : 'none';
      card.style.zIndex = String(10 - Math.round(Math.abs(o) * 2));
      card.style.visibility = Math.abs(o) > 1.9 ? 'hidden' : 'visible';
      card.style.setProperty('--fade', Math.max(0, 1 - Math.abs(o) * 1.6).toFixed(3));
    });

    ticksSvg.style.transform = `rotate(${DIAL_BASE + angle}deg)`;
    const top = mod(Math.round(-angle / TICK_STEP), TICKS);
    if (top !== activeTick) {
      if (activeTick >= 0) ticks[activeTick].classList.remove('is-active');
      ticks[top].classList.add('is-active');
      activeTick = top;
    }

    const index = mod(Math.round(-pos), N);
    if (index !== lastIndex) {
      lastIndex = index;
      cards.forEach((card, i) => card.setAttribute('aria-hidden', String(i !== index)));
      dial.setAttribute('aria-valuenow', index + 1);
      dial.setAttribute('aria-valuetext', `${PLANS[index].name}, ${index + 1} of ${N}`);
      if (announcement && !dragging) announcement.textContent = `${PLANS[index].name}, ${index + 1} of ${N}`;
    }
  }

  // Time-based tween from the current angle to target.
  let tween = null;
  function loop(now) {
    const p = Math.min(1, (now - tween.start) / tween.duration);
    angle = tween.from + (tween.to - tween.from) * tween.ease(p);
    render();
    if (p < 1) {
      raf = requestAnimationFrame(loop);
    } else {
      angle = target;
      tween = null;
      raf = 0;
    }
  }
  function animateTo(next, ease, fixedDuration) {
    target = next;
    cancelAnimationFrame(raf);
    raf = 0;
    const distance = Math.abs(target - angle);
    if (reduceMotion.matches || distance < .01) {
      angle = target;
      tween = null;
      render();
      return;
    }
    const cards = distance / DIAL_STEP;
    const duration = fixedDuration || Math.min(SNAP_MAX, SNAP_MIN + SNAP_PER_CARD * Math.max(0, cards - .5));
    tween = { from: angle, to: target, start: performance.now(), duration, ease };
    raf = requestAnimationFrame(loop);
  }
  const snap = a => Math.round(a / DIAL_STEP) * DIAL_STEP;

  // Rotary drag: follow the pointer's angle around the dial centre.
  let lastPointerAngle = 0;
  let samples = [];
  function pointerAngle(e) {
    const rect = ticksSvg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI;
  }

  dial.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    dial.setPointerCapture(e.pointerId);
    dial.classList.add('is-dragging');
    clearTimeout(holdTimer);
    stopSpin();
    cancelAnimationFrame(raf);
    raf = 0;
    tween = null;
    target = angle;
    lastPointerAngle = pointerAngle(e);
    samples = [{ t: e.timeStamp, a: angle }];
  });
  dial.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = pointerAngle(e);
    let delta = now - lastPointerAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastPointerAngle = now;
    angle += delta * DRAG_GAIN;
    target = angle;
    samples.push({ t: e.timeStamp, a: angle });
    while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
    render();
  });
  function release(e) {
    if (!dragging) return;
    dragging = false;
    dial.classList.remove('is-dragging');
    if (dial.hasPointerCapture(e.pointerId)) dial.releasePointerCapture(e.pointerId);
    const first = samples[0];
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 ? (angle - first.a) / dt : 0; // deg per ms
    const projected = angle + velocity * INERTIA;
    // A flick carries at most one card beyond where the dial was let go.
    const limit = DIAL_STEP;
    animateTo(snap(Math.max(angle - limit, Math.min(angle + limit, projected))), EASE_RELEASE);
  }
  dial.addEventListener('pointerup', release);
  dial.addEventListener('pointercancel', release);

  // Keyboard: right = next card (dial turns anticlockwise, cards move left).
  // Tap = one card; hold = keep spinning until the key is released.
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
    angle += spin.v * dt;
    target = angle;
    render();
    raf = requestAnimationFrame(spinFrame);
  }
  // Current speed of the running tween, in deg per ms (0 when idle).
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
    let next = (dir > 0 ? Math.ceil(angle / DIAL_STEP) : Math.floor(angle / DIAL_STEP)) * DIAL_STEP;
    if (next === from) next += dir * DIAL_STEP;
    // Settle with a curve whose starting slope equals the current speed, so there is no
    // jolt: cubic-bezier(.33, y1, .68, 1) starts at (y1/.33)·distance/duration.
    // From cruise speed that is ease-out cubic.
    const speed = Math.abs(v);
    let distance = Math.abs(next - angle);
    let duration = speed > 1e-4 ? 3 * distance / speed : SPIN_STOP_MAX;
    // Too close to brake over SPIN_STOP_MIN: coast on to further cards until there is room.
    while (speed > 1e-4 && duration < SPIN_STOP_MIN) {
      next += dir * DIAL_STEP;
      distance += DIAL_STEP;
      duration = 3 * distance / speed;
    }
    duration = Math.max(SPIN_STOP_MIN, Math.min(SPIN_STOP_MAX, duration));
    const y1 = Math.min(1, .33 * speed * duration / distance);
    animateTo(next, cubicBezier(.33, y1, .68, 1), duration);
  }

  dial.addEventListener('keydown', e => {
    if (!(e.key in KEY_DIR)) return;
    e.preventDefault();
    if (reduceMotion.matches) {
      // No spin animation: step one card at a time, auto-repeating while held.
      if (e.timeStamp - lastStep < 220) return;
      lastStep = e.timeStamp;
      animateTo(snap(target) + KEY_DIR[e.key] * DIAL_STEP);
      return;
    }
    if (e.repeat || held.includes(e.key)) return;
    held.push(e.key);
    if (spin) return; // already spinning: spinFrame follows the newest key
    tap(KEY_DIR[e.key]);
  });

  // A tap moves exactly one card with EASE_TAP; if the key is still down after
  // TAP_TIME the move hands over to a continuous spin.
  function tap(dir) {
    const base = tween ? tween.to : snap(angle);
    const next = base + dir * DIAL_STEP;
    const v = tweenVelocity();
    let ease = EASE_TAP;
    if (v * dir > 1e-4) {
      // Tapping again while still moving the same way: keep the current speed
      // instead of restarting from rest, then slow out the same way.
      const y1 = Math.min(1, .4 * Math.abs(v) * TAP_DURATION / Math.abs(next - angle));
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
  dial.addEventListener('keyup', e => {
    const i = held.indexOf(e.key);
    if (i < 0) return;
    held.splice(i, 1);
    if (!held.length) endKeys();
  });
  dial.addEventListener('blur', () => {
    held.length = 0;
    endKeys();
  });

  render();
})();
