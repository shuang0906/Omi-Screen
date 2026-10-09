/* ==========================================================================
   Glass Cards Slider
   Infinite horizontal film roll: wheel / drag / touch / keyboard input moves a
   target position, the rendered position eases toward it, and every frame is
   wrapped around so the roll never ends. Settles (snaps) on the nearest frame.
   ========================================================================== */

(function () {
  // Reuse the original glass cards, including their image crops and content order.
  var templates = document.getElementById('glass-slide-templates');
  var SLIDES = Array.prototype.map.call(templates.content.querySelectorAll('.card'), function(card) {
    return {
      html: card.outerHTML,
      title: card.querySelector('.card-brand').textContent + ' - ' + card.querySelector('.card-offer').textContent
    };
  });

  // ---- tuning -------------------------------------------------------------
  var EASE = 0.09;            // how fast the roll catches up with the target (per 60fps frame)
  var WHEEL_SPEED = 1;        // wheel delta multiplier
  var DRAG_SPEED = 1.6;       // drag distance multiplier
  var FLING = 12;             // drag release velocity multiplier
  var SNAP_DELAY = 90;        // ms of wheel inactivity before magnetic settling
  var SNAP_EASE = 0.2;        // firmer easing while centering a slide
  var ANIMATION_SPEED = 0.5;  // transition playback speed
  var SLIDE_OVERSHOOT = 0.06; // overshoot as a fraction of the remaining travel
  var SLIDE_OVERSHOOT_MAX = 6; // cap the slide overshoot in px
  var OVERSHOOT_DURATION = 1000; // one smooth overshoot, with no spring oscillation
  var OVERSHOOT_AMOUNT = 1.2;
  var IMG_PARALLAX = 0.36;    // image shift; keep below the 40% CSS overscan
  var TEXT_PARALLAX = 0.16;   // text container moves opposite to the image container
  var TEXT_PARALLAX_SCALE = 2; // double the individual text layer displacement
  var MAX_SQUASH = 0.07;      // max frame shrink at high speed
  var CARD_SCALE = 0.1;    // side cards are slightly smaller than the centered card
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var root = document.querySelector('[data-roll]');
  var track = root.querySelector('[data-roll="track"]');
  var backgroundLayers = document.querySelectorAll('[data-background]');

  function updateBackground() {
    var position = ((current / stride) % count + count) % count;
    var first = Math.floor(position);
    var second = (first + 1) % count;
    var mix = position - first;
    // Keep one layer opaque underneath the next so the glass always samples color.
    backgroundLayers.forEach(function(layer, index) {
      layer.style.opacity = index === first ? '1' : index === second ? String(mix) : '0';
      layer.style.zIndex = index === second ? '1' : '0';
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function slideHTML(slide) { return slide.html; }

  var count = SLIDES.length;
  var indicator = document.querySelector('[data-indicator]');
  var indicatorItems = [];
  var indicatorActive = -1;
  var autoplayElapsed = 0;
  var autoplayHovered = false;
  var autoplayFocused = false;
  var autoplayDuration = indicator ? Number(indicator.dataset.duration) || 3000 : 3000;

  if (indicator) {
    indicator.innerHTML = SLIDES.map(function(slide, i) {
      return '<button class="indicator-item" type="button" data-card-index="'+i+'" aria-label="Card '+(i+1)+' of '+count+'"><span class="indicator-track"><span class="indicator-fill"></span></span></button>';
    }).join('');
    indicatorItems = Array.from(indicator.querySelectorAll('.indicator-item'));
    indicator.addEventListener('click', function(e) {
      var button = e.target.closest('[data-card-index]');
      if (!button) return;
      clearTimeout(snapTimer);
      var index = ((Math.round(target / stride) % count) + count) % count;
      var step = Number(button.dataset.cardIndex) - index;
      if (step > count / 2) step -= count;
      if (step < -count / 2) step += count;
      goTo(step);
    });
    var viewport = document.querySelector('.slider-window');
    viewport.addEventListener('pointerenter', function() { autoplayHovered = true; });
    viewport.addEventListener('pointerleave', function() { autoplayHovered = false; });
    viewport.addEventListener('focusin', function() { autoplayFocused = true; });
    viewport.addEventListener('focusout', function(e) { autoplayFocused = viewport.contains(e.relatedTarget); });
  }

  function updateIndicator(dt) {
    if (!indicator) return;
    var index = ((Math.round(current / stride) % count) + count) % count;
    if (index !== indicatorActive) {
      autoplayElapsed = 0;
      indicatorActive = index;
      indicatorItems.forEach(function(button, i) {
        button.classList.toggle('is-active', i === index);
        if (i === index) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
        button.querySelector('.indicator-fill').style.transform = '';
      });
    }
    var settled = !dragging && slideOvershoot === 0 && Math.abs(current - target) < .5;
    if (!settled) autoplayElapsed = 0;
    else if (!autoplayHovered && !autoplayFocused && !document.hidden) autoplayElapsed += dt * (1000 / 60);
    var progress = Math.min(1, autoplayElapsed / autoplayDuration);
    indicatorItems[index].querySelector('.indicator-fill').style.transform = 'translateX(calc((var(--dot) - var(--pill-w)) * '+(1-progress)+'))';
    if (progress === 1) {
      autoplayElapsed = 0;
      goTo(1);
    }
  }

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
          frame: el.querySelector('.card'),
          img: el.querySelector('.card-img'),
          content: el.querySelector('.card-body'),
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

  function wrapPosition(position) {
    // A previous card still peeks into view at -stride. Recycle only after its
    // full width (plus shadow/overshoot clearance) has passed the left edge.
    var start = -(root.clientWidth + frameW) / 2 - SLIDE_OVERSHOOT_MAX - 24;
    return ((position - start) % length + length) % length + start;
  }

  // ---- state ----------------------------------------------------------------
  var frameW, stride, length;
  var target = 0, current = 0, last = 0, velocity = 0;
  var dragging = false, dragStartX = 0, dragStartTarget = 0, dragMoved = 0;
  var lastPointerX = 0, lastPointerT = 0, pointerV = 0;
  var snapTimer = null;
  var snapping = false;
  var snapGeneration = 0;
  var slideOvershoot = 0;

  function prepareSlideOvershoot() {
    var travel = target - current;
    slideOvershoot = Math.sign(travel) * Math.min(SLIDE_OVERSHOOT_MAX, Math.abs(travel) * SLIDE_OVERSHOOT);
  }

  function layout() {
    build();
    frameW = measureFrame();
    stride = frameW + gap();
    length = stride * items.length;
  }

  function snapToSlide() {
    clearTimeout(snapTimer);
    target = Math.round(target / stride) * stride;
    prepareSlideOvershoot();
    snapping = true;
    snapGeneration++;
    autoplayElapsed = 0;
  }

  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () {
      if (!dragging) snapToSlide();
    }, SNAP_DELAY);
  }

  function goTo(step) {
    target = (Math.round(target / stride) + step) * stride;
    prepareSlideOvershoot();
    snapping = true;
    snapGeneration++;
    autoplayElapsed = 0;
  }

  // ---- input ----------------------------------------------------------------
  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    var d = e.deltaMode === 1 ? delta * 32 : e.deltaMode === 2 ? delta * root.clientWidth : delta;
    snapping = false;
    slideOvershoot = 0;
    target += d * WHEEL_SPEED;
    scheduleSnap();
  }, { passive: false });

  root.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('button,a')) { dragMoved = 0; return; }
    root.setPointerCapture(e.pointerId);
    dragging = true;
    snapping = false;
    slideOvershoot = 0;
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
      slideOvershoot = 0;
    }, 150);
  });

  // ---- render loop ------------------------------------------------------------
  var prevT = performance.now();

  function render(now) {
    var dt = Math.max(.01, Math.min(64, now - prevT) / (1000 / 60));
    prevT = now;

    var ease = snapping ? SNAP_EASE : EASE;
    var destination = snapping ? target + slideOvershoot : target;
    if (reducedMotion.matches) {
      current = target;
      slideOvershoot = 0;
    } else {
      current += (destination - current) * (1 - Math.pow(1 - ease, dt * ANIMATION_SPEED));
      if (snapping && slideOvershoot !== 0 && Math.abs(destination - current) < Math.min(.5, Math.abs(slideOvershoot) * .1)) {
        // Turn once after passing the center, then ease back without oscillation.
        slideOvershoot = 0;
      } else if (slideOvershoot === 0 && Math.abs(target - current) < (snapping ? .35 : .01)) current = target;
    }
    velocity = (current - last) / dt;
    last = current;
    updateBackground();

    var vw = root.clientWidth;
    var left = (vw - frameW) / 2;                       // active frame is centred
    var squash = reducedMotion.matches ? 1 : 1 - Math.min(Math.abs(velocity) * 0.0003, MAX_SQUASH);

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = i * stride - current;
      x = wrapPosition(x);
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
      var cardProgress = imageProgress;
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
            finalX = wrapPosition(finalX);
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

      var distance = Math.abs(cardProgress);
      var momentum = reducedMotion.matches ? 0 : Math.max(-1, Math.min(1, velocity / 22));
      var scale = squash * (1 - distance * CARD_SCALE);
      it.frame.style.transform = 'scale(' + scale + ')';
      var shadowMotion = Math.sin(distance * Math.PI) * 12 + Math.abs(momentum) * 3;
      it.frame.style.setProperty('--motion-shadow-y', (6 + shadowMotion * .65) + 'px');
      it.frame.style.setProperty('--motion-shadow-blur', (14 + shadowMotion) + 'px');
      it.img.style.transform = 'translate3d(' + (-imageProgress * frameW * IMG_PARALLAX) + 'px,0,0)';
      it.content.style.transform = 'translate3d(' + (progress * frameW * TEXT_PARALLAX) + 'px,0,0)';
      for (var j = 0; j < it.layers.length; j++) {
        var l = it.layers[j];
        l.el.style.transform = 'translate3d(' + (progress * l.depth * 3 * TEXT_PARALLAX_SCALE * Math.min(1, frameW / 920)) + 'px,0,0)';
      }
    }


    var active = ((Math.round(current / stride) % count) + count) % count;
    updateIndicator(dt);
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
