(() => {
  'use strict';

  const root = document.querySelector('[data-indicator]');
  const announcement = document.querySelector('[data-announcement]');
  if (!root) return;

  const COUNT = Number(root.dataset.count) || 4;
  const DURATION = Number(root.dataset.duration) || 3000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  root.style.setProperty('--duration', DURATION + 'ms');
  root.innerHTML = Array.from({ length: COUNT }, (_, i) => `
    <button class="indicator-item" type="button" aria-label="Slide ${i + 1} of ${COUNT}">
      <span class="indicator-track"><span class="indicator-fill"></span></span>
    </button>`).join('');

  const items = Array.from(root.querySelectorAll('.indicator-item'));
  let active = -1;

  function goTo(index) {
    const next = (index + COUNT) % COUNT;
    if (active >= 0) {
      items[active].classList.remove('is-active');
      items[active].removeAttribute('aria-current');
    }
    active = next;
    const item = items[active];
    void item.offsetWidth; // restart the progress animation when re-activating the same item
    item.classList.add('is-active');
    item.setAttribute('aria-current', 'true');
    if (announcement) announcement.textContent = `Slide ${active + 1} of ${COUNT}`;
    // Reduced motion has no progress animation, so advance on a timer instead.
    clearTimeout(goTo.timer);
    if (reduceMotion.matches) goTo.timer = setTimeout(() => goTo(active + 1), DURATION);
  }

  root.addEventListener('animationend', e => {
    if (e.animationName === 'indicator-progress') goTo(active + 1);
  });
  root.addEventListener('click', e => {
    const item = e.target.closest('.indicator-item');
    if (item) goTo(items.indexOf(item));
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    goTo(active + (e.key === 'ArrowRight' ? 1 : -1));
    items[active].focus();
  });

  // Pause while hovered or focused, like a slideshow.
  const layout = root.closest('.layout') || root;
  const pause = on => root.classList.toggle('is-paused', on);
  layout.addEventListener('pointerenter', () => pause(true));
  layout.addEventListener('pointerleave', () => pause(root.contains(document.activeElement)));
  root.addEventListener('focusin', () => pause(true));
  root.addEventListener('focusout', () => pause(layout.matches(':hover')));

  goTo(0);
})();
