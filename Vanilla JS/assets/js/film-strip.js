/* ==========================================================================
   Film Strip Slider
   Infinite horizontal film roll: wheel / drag / touch / keyboard input moves a
   target position, the rendered position eases toward it, and every frame is
   wrapped around so the roll never ends. Settles (snaps) on the nearest frame.
   ========================================================================== */

(function () {
  // ---- placeholder content: replace with real images / copy ---------------
  var SLIDES = [
    { eyebrow: '01 / A story beyond the horizon', title: 'The Quiet\nEarth', specs: [['Director', 'Alex Morgan'], ['Year', '2026'], ['Format', 'Feature · 108 min']] },
    { eyebrow: '02 / Somewhere between here and there', title: 'After the\nLight', specs: [['Director', 'Jamie Parker'], ['Year', '2025'], ['Format', 'Short film · 24 min']] },
    { eyebrow: '03 / A place we once called home', title: 'Lost in\nElsewhere', specs: [['Director', 'Sam Ellis'], ['Year', '2025'], ['Format', 'Documentary · 86 min']] },
    { eyebrow: '04 / In the spaces between', title: 'Slow\nDays', specs: [['Director', 'Charlie Lee'], ['Year', '2024'], ['Format', 'Feature · 96 min']] },
    { eyebrow: '05 / Everything leaves a trace', title: 'A Distant\nMemory', specs: [['Director', 'Robin Blake'], ['Year', '2024'], ['Format', 'Short film · 18 min']] },
    { eyebrow: '06 / Until we meet again', title: 'Into the\nBlue', specs: [['Director', 'Taylor Reed'], ['Year', '2023'], ['Format', 'Documentary · 72 min']] }
  ];

  // ---- tuning -------------------------------------------------------------
  var EASE = 0.09;            // how fast the roll catches up with the target (per 60fps frame)
  var WHEEL_SPEED = 1;        // wheel delta multiplier
  var DRAG_SPEED = 1.6;       // drag distance multiplier
  var FLING = 12;             // drag release velocity multiplier
  var SNAP_DELAY = 90;        // ms of wheel inactivity before magnetic settling
  var SNAP_EASE = 0.2;        // firmer easing while centering a slide
  var ANIMATION_SPEED = 0.8;  // half speed: easing takes twice as long
  var OVERSHOOT_DURATION = 1000; // one smooth overshoot, with no spring oscillation
  var OVERSHOOT_AMOUNT = 1.2;
  var IMG_PARALLAX = 0.36;    // image shift; keep below the 40% CSS overscan
  var TEXT_PARALLAX = 0.16;   // text container moves opposite to the image container
  var TEXT_PARALLAX_SCALE = 2; // double the individual text layer displacement
  var MAX_SQUASH = 0.06;      // max frame shrink at high speed
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var root = document.querySelector('[data-roll]');
  var track = root.querySelector('[data-roll="track"]');

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Self-contained image placeholders: no network requests or image dependencies.
  // Replace this SVG with an <img class="roll-img" src="..." alt="..."> for real stills.
  function placeholder(i) {
    var colors = [['#999e82','#d8c9a0','#545e44','#343e30'],['#ac8269','#e1b791','#5c544c','#272f30'],['#718988','#c1c8b0','#465f5e','#253e42'],['#aca47e','#dfd5b8','#666c47','#333e29'],['#9f8b9d','#c7b4a9','#665b69','#343946'],['#708b9d','#b8c8cc','#405c70','#203a51']][i];
    return '<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky'+i+'" x2="0" y2="1"><stop stop-color="'+colors[0]+'"/><stop offset="1" stop-color="'+colors[1]+'"/></linearGradient><filter id="grain'+i+'"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><g filter="url(#grain'+i+')"><path fill="url(#sky'+i+')" d="M0 0h1600v1000H0z"/><circle cx="'+(1100-i*70)+'" cy="330" r="68" fill="'+colors[1]+'" opacity=".7"/><path fill="'+colors[2]+'" d="M0 600L180 470 350 570 590 390 800 530 1020 460 1210 570 1450 390 1600 490V1000H0z"/><path fill="'+colors[3]+'" d="M0 730Q300 570 540 760T1040 710T1600 670V1000H0z"/><path fill="'+colors[1]+'" opacity=".2" d="M930 660Q800 780 1090 1000H1310Q840 760 970 660z"/><path fill="#1e2622" d="M1190 750v-135h7v135zM1142 684l52-132 51 132zM1150 645l44-119 43 119z"/></g><text x="1530" y="120" text-anchor="end" fill="#fff8" font-family="monospace" font-size="14" letter-spacing="4">PLACEHOLDER STILL / '+pad(i+1)+'</text></svg>';
  }

  function slideHTML(slide, i) {
    var specs = slide.specs.map(function (s) {
      return '<li><span>' + s[0] + '</span><span>' + s[1] + '</span></li>';
    }).join('');
    return '' +
      '<div class="roll-frame">' +
        '<div class="roll-img">' + placeholder(i) + '</div>' +
        '<div class="roll-content">' +
          '<div class="roll-col">' +
            '<div class="roll-eyebrow" data-parallax="22">' + slide.eyebrow + '</div>' +
            '<h2 class="roll-title" data-parallax="42">' + slide.title.replace('\n', '<br>') + '</h2>' +
            '<ul class="roll-specs" data-parallax="16">' + specs + '</ul>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var count = SLIDES.length;

  // ---- build items (cloned until the roll is long enough to wrap seamlessly)
  var items = [];
  function build() {
    track.innerHTML = '';
    items = [];
    var frameW = measureFrame();
    var stride = frameW + gap();
    var copies = Math.max(1, Math.ceil((root.clientWidth + stride * 2) / (stride * count)));
    for (var c = 0; c < copies; c++) {
      SLIDES.forEach(function (slide, i) {
        var el = document.createElement('article');
        el.className = 'roll-item';
        el.innerHTML = slideHTML(slide, i);
        track.appendChild(el);
        items.push({
          el: el,
          frame: el.querySelector('.roll-frame'),
          img: el.querySelector('.roll-img'),
          content: el.querySelector('.roll-content'),
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

  function cssPx(name) {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:var(' + name + ')';
    root.appendChild(probe);
    var h = probe.getBoundingClientRect().width;
    root.removeChild(probe);
    return h;
  }
  function measureFrame() { return cssPx('--frame-w'); }
  function gap() { return cssPx('--gap'); }

  // ---- state ----------------------------------------------------------------
  var frameW, stride, length;
  var target = 0, current = 0, last = 0, velocity = 0;
  var dragging = false, dragStartX = 0, dragStartTarget = 0, dragMoved = 0;
  var lastPointerX = 0, lastPointerT = 0, pointerV = 0;
  var snapTimer = null;
  var snapping = false;
  var snapGeneration = 0;

  function layout() {
    build();
    frameW = measureFrame();
    stride = frameW + gap();
    length = stride * items.length;
  }

  function snapToSlide() {
    clearTimeout(snapTimer);
    target = Math.round(target / stride) * stride;
    snapping = true;
    snapGeneration++;
  }

  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () {
      if (!dragging) snapToSlide();
    }, SNAP_DELAY);
  }

  function goTo(step) {
    target = (Math.round(target / stride) + step) * stride;
    snapping = true;
    snapGeneration++;
  }

  // ---- input ----------------------------------------------------------------
  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    var d = e.deltaMode === 1 ? delta * 32 : e.deltaMode === 2 ? delta * root.clientWidth : delta;
    snapping = false;
    target += d * WHEEL_SPEED;
    scheduleSnap();
  }, { passive: false });

  root.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('button,a')) { dragMoved = 0; return; }
    root.setPointerCapture(e.pointerId);
    dragging = true;
    snapping = false;
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
      // Preserve release momentum without letting a quick flick drift through many slides.
      target -= Math.max(-stride * .65, Math.min(stride * .65, pointerV * FLING * 16));
    }
    snapToSlide();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // a drag must not trigger the links inside the frames
  root.addEventListener('click', function (e) {
    if (dragMoved > 5) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('keydown', function (e) {
    if (e.target.closest('input,textarea,select')) return;
    if (!['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' '].includes(e.key)) return;
    clearTimeout(snapTimer);
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goTo(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(-1); }
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var index = Math.round(target / stride);
      layout();
      target = current = last = index * stride;
    }, 150);
  });

  // ---- render loop ------------------------------------------------------------
  var prevT = performance.now();

  function render(now) {
    var dt = Math.max(.01, Math.min(64, now - prevT) / (1000 / 60));
    prevT = now;

    var ease = snapping ? SNAP_EASE : EASE;
    current += (target - current) * (reducedMotion.matches ? 1 : 1 - Math.pow(1 - ease, dt * ANIMATION_SPEED));
    if (Math.abs(target - current) < (snapping ? .35 : .01)) current = target;
    velocity = (current - last) / dt;
    last = current;

    var vw = root.clientWidth;
    var left = (vw - frameW) / 2;                       // active frame is centred
    var squash = reducedMotion.matches ? 1 : 1 - Math.min(Math.abs(velocity) * 0.0003, MAX_SQUASH);

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = i * stride - current;
      x = ((x + stride) % length + length) % length - stride; // wrap into [-stride, length - stride)
      var pos = left + x;

      if (pos > vw || pos + frameW < 0) {               // off screen: skip the heavy work
        it.el.style.visibility = 'hidden';
        it.el.inert = true;
        it.parallaxPosition = null;
        it.overshootGeneration = -1;
        it.el.style.transform = 'translate3d(' + pos + 'px,0,0)';
        continue;
      }
      it.el.style.visibility = '';
      it.el.inert = Math.abs(x) > stride / 2;
      it.el.style.transform = 'translate3d(' + pos + 'px,0,0)';

      // -1 … 1: how far this frame is from the centre of the viewport
      var progress = Math.max(-1, Math.min(1, (pos + frameW / 2 - vw / 2) / (vw / 2 + frameW / 2)));
      var imageProgress = reducedMotion.matches ? 0 : progress;
      if (reducedMotion.matches) {
        progress = 0;
        it.parallaxPosition = 0;
        it.overshootGeneration = -1;
      } else {
        if (it.parallaxPosition === null) it.parallaxPosition = progress;
        if (snapping) {
          if (it.overshootGeneration !== snapGeneration) {
            it.overshootGeneration = snapGeneration;
            it.overshootElapsed = 0;
            it.overshootFrom = it.parallaxPosition;
            var finalX = i * stride - target;
            finalX = ((finalX + stride) % length + length) % length - stride;
            it.overshootTo = Math.max(-1, Math.min(1, finalX / (vw / 2 + frameW / 2)));
          }
          it.overshootElapsed += dt * (1000 / 60);
          var t = Math.min(1, it.overshootElapsed / OVERSHOOT_DURATION);
          var back = t - 1;
          var eased = t === 1 ? 1 : 1 + (OVERSHOOT_AMOUNT + 1) * back * back * back
            + OVERSHOOT_AMOUNT * back * back;
          it.parallaxPosition = it.overshootFrom + (it.overshootTo - it.overshootFrom) * eased;
        } else {
          it.overshootGeneration = -1;
          it.parallaxPosition += (progress - it.parallaxPosition) * (1 - Math.pow(.8, dt));
        }
        // Keep the text's one-time overshoot within a restrained range.
        progress = Math.max(-1.1, Math.min(1.1, it.parallaxPosition));
      }

      it.frame.style.transform = 'scale(' + squash + ')';
      it.img.style.transform = 'translate3d(' + (-imageProgress * frameW * IMG_PARALLAX) + 'px,0,0)';
      it.content.style.transform = 'translate3d(' + (progress * frameW * TEXT_PARALLAX) + 'px,0,0)';
      for (var j = 0; j < it.layers.length; j++) {
        var l = it.layers[j];
        l.el.style.transform = 'translate3d(' + (progress * l.depth * 3 * TEXT_PARALLAX_SCALE * Math.min(1, frameW / 920)) + 'px,0,0)';
      }
    }


    var active = ((Math.round(current / stride) % count) + count) % count;
    var label = pad(active + 1);
    if (Math.abs(target - current) < .5) {
      var announcement = document.querySelector('[data-announcement]');
      var description = label + ' / ' + pad(count) + ': ' + SLIDES[active].title.replace('\n',' ');
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
