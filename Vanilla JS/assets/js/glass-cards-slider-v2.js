/* ==========================================================================
   Glass Cards Slider v2
   Same motion model as glass-cards-slider.js: wheel / drag / touch / keyboard move
   a target position, the rendered position eases toward it, and items wrap so the
   slider never ends. Cards themselves land without overshoot; everything on a card
   except the photo (text and ticks) overshoots once on settle. The card design follows Figma
   node 3800:29024: the centred card shows its photo, neighbours fade into the
   frosted ghost cards.
   ========================================================================== */

(function () {
  // `saved` / `goal` drive the amount, the ratio line and the tick bar. `anim` sets how the
  // ticks grow in once the card settles (see tickBar). By default ticks grow left to right at
  // TICK_STAGGER ms apart, so more progress = a longer animation; `bounce` is the per-card
  // cubic-bezier y1 (1 = none). Overrides: order 'ltr' | 'rtl' | 'all' | 'center' | 'random',
  // stagger (ms between ticks), duration (ms per tick). The fully funded card uses 'center'.
  // The amount shows `from` (the balance before the latest deposit) and rolls up to `saved`
  // with NumberFlow as soon as a switch to the card starts. Amounts are placeholders.
  // `bg` is the container gradient (top, bottom) for each photo:
  // the photo's dominant hue at the lightness/saturation of the Figma gradient
  // (#33668a → #909cae for the sea photo), scaled by how saturated the photo is.
  // `tint` adds the multiply gradient from Figma node 3754:21698 over the photo.
  var PLANS = [
    { name: 'Tokyo Trip', meta: 'Flight • Jan 15', img: './assets/img/plans/sea.png', bg: ['#33668a', '#909cae'],
      from: 1040, saved: 1290, goal: 5000, anim: { bounce: 1.56 } },
    { name: 'Amalfi Dinner', meta: 'Dining • Mar 10', img: './assets/img/plans/pasta.jpg', bg: ['#416e7c', '#95a1a9'], tint: true,
      from: 420, saved: 480, goal: 600, anim: { bounce: 1 } },
    { name: 'Matcha Kit', meta: 'Food • Feb 02', img: './assets/img/plans/matcha.jpg', bg: ['#72912c', '#9fb08e'],
      from: 72, saved: 96, goal: 240, anim: { bounce: 2.1 } },
    { name: 'Alps Weekend', meta: 'Travel • Feb 20', img: './assets/img/plans/mountains.jpg', bg: ['#7e5d3f', '#aaa294'], tint: true,
      from: 1890, saved: 2150, goal: 3800, anim: { bounce: 1.35 } },
    { name: 'Family Day', meta: 'Leisure • Apr 05', img: './assets/img/plans/shadows.png', bg: ['#806a3d', '#aaa794'],
      from: 265, saved: 310, goal: 350, anim: { bounce: 1.9 } },
    { name: 'Dolomites', meta: 'Travel • Apr 18', img: './assets/img/plans/peaks.png', bg: ['#2c7291', '#8e9fb0'],
      from: 590, saved: 640, goal: 4200, anim: { bounce: 1.2 } },
    { name: 'Pantry Restock', meta: 'Groceries • May 01', img: './assets/img/plans/groceries.png', bg: ['#746e49', '#a6a698'],
      from: 150, saved: 175, goal: 250, anim: { bounce: 1.5 } },
    { name: 'Living Room', meta: 'Furniture • May 20', img: './assets/img/plans/interior.png', bg: ['#8d5330', '#afa18f'],
      from: 3240, saved: 3600, goal: 3600, anim: { order: 'center', stagger: 25, duration: 600, bounce: 1 } }
  ];
  var TICKS = 37;
  var TICK_STAGGER = 24;      // ms between ticks (left to right)
  var TICK_DURATION = 500;    // ms each tick takes to grow
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  // ---- geometry (Figma) ------------------------------------------------------
  var CARD_W = 259.064;
  var GHOST_W = 214.284;      // neighbour ghost card width
  var ROW_GAP = 17.935;       // gap between card and ghost
  var STRIDE = CARD_W / 2 + ROW_GAP + GHOST_W / 2; // centre-to-centre distance
  var GHOST_SCALE = GHOST_W / CARD_W;
  var GHOST_BLUR = 6.43;      // Figma layer blur 12.857 ≈ CSS blur 6.43
  var GHOST_OPACITY = 0.61;

  // ---- tuning ----------------------------------------------------------------
  var EASE = 0.09;            // how fast the slider catches up with the target (per 60fps frame)
  var WHEEL_SPEED = 1;        // wheel delta multiplier
  var DRAG_SPEED = 1.6;       // drag distance multiplier
  var FLING = 12;             // drag release velocity multiplier
  var SNAP_DELAY = 90;        // ms of wheel inactivity before magnetic settling
  // Card switch (snap / arrow keys / autoplay): a timed curve that starts from rest, picks
  // up speed and then brakes slowly. Starting at full speed (pure ease-out) made the first
  // frame jump, which read as a stutter.
  var SNAP_CURVE = cubicBezier(.45, 0, .15, 1);
  // When the card is already moving (drag release, or a new switch mid-switch) the curve
  // instead starts at that speed: cubic-bezier(SNAP_X1, y1, SNAP_X2, 1) with y1 matched.
  var SNAP_X1 = .33;
  var SNAP_X2 = .15;
  var SNAP_DURATION = 1200;    // ms for one card
  var SNAP_PER_CARD = 160;    // ms added per extra card travelled
  var SNAP_MAX = 1100;
  var ANIMATION_SPEED = 0.5;  // transition playback speed
  var OVERSHOOT_DURATION = 1000; // text + ticks: one smooth overshoot, no spring
  var OVERSHOOT_AMOUNT = 1.2;
  var IMG_PARALLAX = 1;       // 0..1 of the photo's spare width used for parallax
  var TEXT_PARALLAX = 0.16;   // text container moves opposite to the photo
  var TEXT_PARALLAX_SCALE = 2;
  var MAX_SQUASH = 0.07;      // max card shrink at high speed
  var AUTOPLAY_DELAY = 3000;  // ms a card stays once it has settled, then the next one comes in
  var PHOTO_FADE_START = 0.15; // photo/text start fading this far from the centre (0..1)
  var PHOTO_FADE_LENGTH = 0.7; // …and are gone after this much more
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // CSS-style cubic-bezier(x1, y1, x2, y2) easing: solve x(t) = p, return y(t).
  function cubicBezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function x(t) { return ((ax * t + bx) * t + cx) * t; }
    function dx(t) { return (3 * ax * t + 2 * bx) * t + cx; }
    function y(t) { return ((ay * t + by) * t + cy) * t; }
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      var t = p, i, d;
      for (i = 0; i < 6; i++) {
        d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= (x(t) - p) / d;
      }
      t = Math.min(1, Math.max(0, t));
      for (var lo = 0, hi = 1, j = 0; j < 12 && Math.abs(x(t) - p) > 1e-5; j++) {
        if (x(t) < p) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return y(t);
    };
  }

  var root = document.querySelector('[data-gslider]');

  // ---- background follows the photo colours ---------------------------------
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var BG = PLANS.map(function (p) { return [rgb(p.bg[0]), rgb(p.bg[1])]; });
  var lastBg = '';
  function mixColor(a, b, t) {
    return 'rgb(' + a.map(function (v, k) { return Math.round(v + (b[k] - v) * t); }).join(',') + ')';
  }
  function updateBackground() {
    // Blend between the two cards either side of the current position.
    var position = ((current / STRIDE) % count + count) % count;
    var first = Math.floor(position) % count;
    var second = (first + 1) % count;
    var t = position - Math.floor(position);
    var top = mixColor(BG[first][0], BG[second][0], t);
    var bottom = mixColor(BG[first][1], BG[second][1], t);
    var key = top + bottom;
    if (key === lastBg) return;
    lastBg = key;
    root.style.setProperty('--bg-top', top);
    root.style.setProperty('--bg-bottom', bottom);
  }
  var track = root.querySelector('[data-gslider="track"]');
  var announcement = document.querySelector('[data-announcement]');
  var count = PLANS.length;

  // Lit ticks for a funded ratio: full bars ending in a 20px then 16px taper, as in the
  // design (25.8% -> 9 full + taper). Fully funded = every bar full.
  function litCount(funded) {
    return funded >= 1 ? TICKS : Math.max(0, Math.min(TICKS, Math.round(funded * TICKS) + 1));
  }
  // Per-tick start delay (ms) for the grow-in, by the card's animation order.
  function tickDelay(i, lit, anim) {
    switch (anim.order) {
      case 'rtl': return (lit - 1 - i) * anim.stagger;
      case 'all': return 0;
      case 'center': return Math.abs(i - (lit - 1) / 2) * anim.stagger * 2;
      case 'random': return ((i * 37 + 11) % 23) * anim.stagger; // fixed pseudo-random order
      default: return i * anim.stagger;
    }
  }
  function tickBar(funded, custom) {
    var anim = {
      order: custom.order || 'ltr',
      stagger: custom.stagger != null ? custom.stagger : TICK_STAGGER,
      duration: custom.duration || TICK_DURATION,
      bounce: custom.bounce != null ? custom.bounce : 1.56
    };
    var lit = litCount(funded);
    var full = funded >= 1;
    var html = '';
    var longest = 0;
    for (var i = 0; i < TICKS; i++) {
      var cls = i < lit ? (full || i < lit - 2 ? 'is-full' : i === lit - 2 ? 'is-head1' : 'is-head2') : '';
      var delay = i < lit ? Math.round(tickDelay(i, lit, anim)) : 0;
      longest = Math.max(longest, delay);
      html += '<i style="--d:' + delay + 'ms"' + (cls ? ' class="' + cls + '"' : '') + '></i>';
    }
    return { html: html, total: longest + anim.duration, duration: anim.duration, bounce: anim.bounce };
  }

  function cardHTML(p) {
    var ticks = tickBar(p.saved / p.goal, p.anim);
    p.countDuration = ticks.total;
    var style = '--tick-dur:' + ticks.duration + 'ms;--tick-ease:cubic-bezier(.34,' + ticks.bounce + ',.64,1)';
    return '<div class="card" style="' + style + '">' +
      '<img class="gcard-img" src="' + p.img + '" alt="" draggable="false">' +
      (p.tint ? '<div class="gcard-tint"></div>' : '') +
      '<div class="gcard-body">' +
        '<div class="gcard-head" data-parallax="22"><p class="gcard-name">' + p.name + '</p><p class="gcard-meta">' + p.meta + '</p></div>' +
        '<div class="gcard-amounts" data-parallax="42"><p class="gcard-amount"><number-flow>' + money(p.from) + '</number-flow></p><p class="gcard-progress">' + money(p.saved) + '/' + money(p.goal) + '</p></div>' +
        '<div class="gcard-ticks" aria-hidden="true">' + ticks.html + '</div>' +
      '</div>' +
      '<div class="gcard-frost"></div>' +
    '</div>';
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- build items (cloned until the row is long enough to wrap seamlessly) --
  var items = [];
  function build() {
    track.innerHTML = '';
    items = [];
    var copies = Math.max(1, Math.ceil((root.clientWidth + STRIDE * 4) / (STRIDE * count)));
    for (var c = 0; c < copies; c++) {
      PLANS.forEach(function (plan, i) {
        var el = document.createElement('article');
        el.className = 'gslider-item';
        el.setAttribute('aria-roledescription', 'slide');
        el.setAttribute('aria-label', (i + 1) + ' of ' + count + ': ' + plan.name);
        el.innerHTML = cardHTML(plan);
        track.appendChild(el);
        items.push({
          el: el,
          card: el.querySelector('.card'),
          img: el.querySelector('.gcard-img'),
          body: el.querySelector('.gcard-body'),
          flow: el.querySelector('number-flow'),
          flowSaved: false,   // true once the amount has rolled up to `saved`
          plan: plan,
          live: false,
          parallaxPosition: null,
          overshootGeneration: -1,
          overshootElapsed: 0,
          overshootFrom: 0,
          overshootTo: 0,
          layers: Array.prototype.map.call(el.querySelectorAll('[data-parallax]'), function (l) {
            return { el: l, depth: parseFloat(l.getAttribute('data-parallax')) };
          })
        });
      });
    }
  }

  var length;
  function layout() {
    build();
    length = STRIDE * items.length;
  }
  function wrapPosition(x) {
    var start = -(root.clientWidth + CARD_W) / 2 - 24;
    return ((x - start) % length + length) % length + start;
  }

  // ---- state -----------------------------------------------------------------
  var target = 0, current = 0, last = 0, velocity = 0;
  var dragging = false, dragStartX = 0, dragStartTarget = 0, dragMoved = 0;
  var lastPointerX = 0, lastPointerT = 0, pointerV = 0;
  var snapTimer = null;
  var snapPending = false;    // wheel stopped, waiting SNAP_DELAY before snapping
  var snapping = false;
  var snapGeneration = 0;     // bumps on every snap so each card restarts its overshoot
  var tween = null;           // { from, to, start, duration } while a card switch plays

  function startTween() {
    var travel = target - current;
    var distance = Math.abs(travel);
    var cards = distance / STRIDE;
    var duration = Math.min(SNAP_MAX, SNAP_DURATION + SNAP_PER_CARD * Math.max(0, cards - 1));
    // Current speed in px/ms (velocity is px per 60fps frame).
    var speed = velocity * 60 / 1000;
    var ease = SNAP_CURVE;
    if (distance > .5 && speed * travel > 0) {
      // Already moving toward the target: start the curve at that speed so there is no jump.
      // cubic-bezier(x1, y1, …) starts at (y1 / x1) · distance / duration.
      var y1 = Math.min(1, SNAP_X1 * Math.abs(speed) * duration / distance);
      ease = cubicBezier(SNAP_X1, y1, SNAP_X2, 1);
    }
    tween = { from: current, to: target, start: performance.now(), duration: duration, ease: ease };
  }
  function snapToSlide() {
    clearTimeout(snapTimer);
    snapPending = false;
    target = Math.round(target / STRIDE) * STRIDE;
    snapping = true;
    snapGeneration++;
    startTween();
  }
  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapPending = true;
    snapTimer = setTimeout(function () {
      if (!dragging) snapToSlide();
    }, SNAP_DELAY);
  }
  function goTo(step) {
    target = (Math.round(target / STRIDE) + step) * STRIDE;
    snapping = true;
    snapGeneration++;
    startTween();
  }

  // ---- input -----------------------------------------------------------------
  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    var d = e.deltaMode === 1 ? delta * 32 : e.deltaMode === 2 ? delta * root.clientWidth : delta;
    snapping = false;
    tween = null;
    autoplayElapsed = 0;
    target += d * WHEEL_SPEED;
    scheduleSnap();
  }, { passive: false });

  root.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('button,a')) { dragMoved = 0; return; }
    root.setPointerCapture(e.pointerId);
    dragging = true;
    autoplayElapsed = 0;
    snapping = false;
    tween = null;
    dragMoved = 0;
    dragStartX = lastPointerX = e.clientX;
    target = current;
    dragStartTarget = current;
    lastPointerT = performance.now();
    pointerV = 0;
    clearTimeout(snapTimer);
    root.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var now = performance.now();
    var dx = e.clientX - lastPointerX;
    var dt = Math.max(1, now - lastPointerT);
    pointerV = pointerV * 0.6 + (dx / dt) * 0.4; // smoothed px/ms
    lastPointerX = e.clientX;
    lastPointerT = now;
    dragMoved = Math.max(dragMoved, Math.abs(e.clientX - dragStartX));
    target = dragStartTarget - (e.clientX - dragStartX) * DRAG_SPEED;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (performance.now() - lastPointerT < 100) {
      // Keep release momentum without letting a quick flick drift through many cards.
      target -= Math.max(-STRIDE * .65, Math.min(STRIDE * .65, pointerV * FLING * 16));
    }
    snapToSlide();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  root.addEventListener('click', function (e) {
    if (dragMoved > 5) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('keydown', function (e) {
    if (e.target.closest('input,textarea,select')) return;
    if (!['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'].includes(e.key)) return;
    clearTimeout(snapTimer);
    e.preventDefault();
    autoplayElapsed = 0;
    goTo(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var index = Math.round(target / STRIDE);
      layout();
      if (flowReady) items.forEach(setupFlow);
      target = current = last = index * STRIDE;
    }, 150);
  });

  // Amount: a NumberFlow (https://number-flow.barvian.me) per card, loaded as a module in the
  // HTML. Cards show `from`; the moment a switch to a card starts (snap / arrow key) its digits
  // roll up to `saved`, without waiting for the card or the overshoot to settle. Once the card
  // has faded into a ghost it snaps back to `from` silently, ready to roll again.
  var FLOW_EASE = 'cubic-bezier(.22, 1, .36, 1)';
  var flowReady = false;
  function setupFlow(it) {
    var f = it.flow;
    f.format = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 };
    f.locales = 'en-US';
    f.trend = 1;                       // digits always roll upward
    f.plugins = [window.NumberFlowPlugins.continuous];
    var d = Math.max(600, it.plan.countDuration);
    f.transformTiming = { duration: d, easing: FLOW_EASE };
    f.spinTiming = { duration: d, easing: FLOW_EASE };
    f.opacityTiming = { duration: 350, easing: 'ease-out' };
    it.flowSaved = reducedMotion.matches || it.live;
    setFlow(it, it.flowSaved ? it.plan.saved : it.plan.from, false);
  }
  function setFlow(it, value, animate) {
    if (!flowReady) return;
    it.flow.animated = animate;
    it.flow.update(value);
    it.flow.animated = true;
  }
  function initFlows() {
    if (flowReady || !window.NumberFlowPlugins) return;
    flowReady = true;
    items.forEach(setupFlow);
  }
  window.addEventListener('numberflow-ready', initFlows);
  initFlows(); // in case the module finished first

  // ---- render loop -----------------------------------------------------------
  var prevT = performance.now();
  var autoplayElapsed = 0;

  function render(now) {
    var dt = Math.max(.01, Math.min(64, now - prevT) / (1000 / 60));
    prevT = now;

    if (reducedMotion.matches) {
      current = target;
      tween = null;
    } else if (tween) {
      // Card switch: fast start, long gentle slow-down, lands exactly on the card.
      var p = Math.min(1, (now - tween.start) / tween.duration);
      current = tween.from + (tween.to - tween.from) * tween.ease(p);
      if (p === 1) { current = target; tween = null; }
    } else {
      // Dragging / wheel: follow the input.
      current += (target - current) * (1 - Math.pow(1 - EASE, dt * ANIMATION_SPEED));
      if (Math.abs(target - current) < .01) current = target;
    }
    velocity = (current - last) / dt;
    last = current;
    updateBackground();

    var vw = root.clientWidth;
    var left = (vw - CARD_W) / 2;
    var squash = reducedMotion.matches ? 1 : 1 - Math.min(Math.abs(velocity) * 0.0003, MAX_SQUASH);

    var anyLive = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = wrapPosition(i * STRIDE - current);
      var pos = left + x;

      if (pos > vw || pos + CARD_W < 0) {
        it.el.style.visibility = 'hidden';
        it.el.inert = true;
        if (it.live) { it.live = false; it.el.classList.remove('is-live'); }
        if (it.flowSaved && !reducedMotion.matches) { it.flowSaved = false; setFlow(it, it.plan.from, false); }
        it.parallaxPosition = null;
        it.overshootGeneration = -1;
        it.el.style.transform = 'translate3d(' + pos + 'px,0,0)';
        continue;
      }
      it.el.style.visibility = '';
      it.el.inert = Math.abs(x) > STRIDE / 2;
      it.el.style.transform = 'translate3d(' + pos + 'px,0,0)';

      // 0 = centred, 1 = neighbour slot (ghost card)
      var d = Math.min(1, Math.abs(x) / STRIDE);
      var side = x === 0 ? 0 : x > 0 ? 1 : -1;
      var progress = side * d;

      // Text and ticks: on each snap they ease to their resting offset with one
      // overshoot (ease-out-back); while dragging they trail the card.
      var textProgress = progress;
      if (reducedMotion.matches) {
        textProgress = 0;
        it.parallaxPosition = 0;
        it.overshootGeneration = -1;
      } else {
        if (it.parallaxPosition === null) it.parallaxPosition = progress;
        if (snapping) {
          if (it.overshootGeneration !== snapGeneration) {
            it.overshootGeneration = snapGeneration;
            it.overshootElapsed = 0;
            it.overshootFrom = it.parallaxPosition;
            var finalX = wrapPosition(i * STRIDE - target);
            it.overshootTo = Math.max(-1, Math.min(1, finalX / STRIDE));
          }
          it.overshootElapsed += dt * (1000 / 60);
          var t = Math.min(1, it.overshootElapsed / OVERSHOOT_DURATION);
          var back = t - 1;
          var eased = t === 1 ? 1 : 1 + (OVERSHOOT_AMOUNT + 1) * back * back * back + OVERSHOOT_AMOUNT * back * back;
          it.parallaxPosition = it.overshootFrom + (it.overshootTo - it.overshootFrom) * eased;
        } else {
          it.overshootGeneration = -1;
          it.parallaxPosition += (progress - it.parallaxPosition) * (1 - Math.pow(.8, dt));
        }
        textProgress = Math.max(-1.1, Math.min(1.1, it.parallaxPosition));
      }

      // Tick animation (.is-live in the CSS) starts only once the card has stopped and the
      // text/tick overshoot has finished. It then stays lit until another card becomes the
      // nearest to the centre.
      var nearest = Math.abs(x) < STRIDE / 2;
      var settled = !dragging && !snapPending && current === target &&
        (it.overshootGeneration === -1 || it.overshootElapsed >= OVERSHOOT_DURATION);
      var live = nearest && (it.live || settled);
      if (live) anyLive = true;
      if (live !== it.live) {
        it.live = live;
        it.el.classList.toggle('is-live', live);
      }

      // Card → ghost: shrink, blur, frost and fade; the photo and text cross-fade out.
      var visual = reducedMotion.matches ? Math.round(d) : d;
      var scale = squash * (1 - visual * (1 - GHOST_SCALE));
      it.card.style.transform = 'scale(' + scale.toFixed(4) + ')';
      it.card.style.opacity = (1 - visual * (1 - GHOST_OPACITY)).toFixed(3);
      it.card.style.filter = visual > .005 ? 'blur(' + (visual * GHOST_BLUR).toFixed(2) + 'px)' : 'none';
      it.card.style.setProperty('--frost', visual.toFixed(3));
      var photo = Math.max(0, Math.min(1, 1 - (visual - PHOTO_FADE_START) / PHOTO_FADE_LENGTH));
      it.card.style.setProperty('--photo', photo.toFixed(3));

      // Amount: roll up as soon as this card becomes the snap target; reset once it is a ghost.
      if (!reducedMotion.matches) {
        var isTarget = snapping && Math.abs(wrapPosition(i * STRIDE - target)) < STRIDE / 2;
        if ((isTarget || it.live) && !it.flowSaved) {
          it.flowSaved = true;
          setFlow(it, it.plan.saved, true);
        } else if (!isTarget && !it.live && it.flowSaved && photo === 0) {
          it.flowSaved = false;
          setFlow(it, it.plan.from, false);
        }
      }
      it.card.style.setProperty('--rim', (1 - visual).toFixed(3));
      // The glass only matters on the centred card; off-centre its backdrop would sample
      // the page outside the container, and the Figma ghost has a layer blur only.
      var glass = visual < .02 ? '' : 'none';
      it.card.style.backdropFilter = glass;
      it.card.style.webkitBackdropFilter = glass;

      // Photo parallax inside its cover crop, so the edges never show.
      var imgProgress = reducedMotion.matches ? 0 : progress;
      it.img.style.objectPosition = (50 + imgProgress * 50 * IMG_PARALLAX).toFixed(2) + '% 50%';
      it.body.style.transform = 'translate3d(' + (textProgress * CARD_W * TEXT_PARALLAX) + 'px,0,0)';
      for (var j = 0; j < it.layers.length; j++) {
        var l = it.layers[j];
        l.el.style.transform = 'translate3d(' + (textProgress * l.depth * 3 * TEXT_PARALLAX_SCALE * Math.min(1, CARD_W / 920)) + 'px,0,0)';
      }
    }

    // Autoplay: count only while the centre card is at rest (live); any movement or input
    // restarts the wait, and a hidden tab pauses it.
    if (anyLive && !dragging && !snapPending && !tween && !document.hidden) {
      autoplayElapsed += dt * (1000 / 60);
      if (autoplayElapsed >= AUTOPLAY_DELAY) {
        autoplayElapsed = 0;
        goTo(1);
      }
    } else {
      autoplayElapsed = 0;
    }

    var active = ((Math.round(current / STRIDE) % count) + count) % count;
    if (Math.abs(target - current) < .5) {
      var description = pad(active + 1) + ' / ' + pad(count) + ': ' + PLANS[active].name;
      if (announcement.textContent !== description) announcement.textContent = description;
    }

    // Keep coordinates bounded after arbitrarily many loops, including negative scroll.
    if (!dragging && Math.abs(current) > length * 100) {
      var offset = Math.trunc(current / length) * length;
      current -= offset; target -= offset; last -= offset;
    }

    requestAnimationFrame(render);
  }

  layout();
  requestAnimationFrame(render);
})();
