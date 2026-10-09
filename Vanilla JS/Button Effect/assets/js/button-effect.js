(() => {
  const button = document.querySelector('[data-be="button"]');
  if (!button) return;
  const metal = button.querySelector('[data-be="metal"]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let shader = null;
  let active = false;

  // Press: scale down slightly and light the sheen under the finger.
  const press = (e) => {
    const box = button.getBoundingClientRect();
    button.style.setProperty('--x', `${e.clientX - box.left}px`);
    button.style.setProperty('--y', `${e.clientY - box.top}px`);
    button.classList.add('is-pressed');
  };
  const release = () => button.classList.remove('is-pressed');

  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('pointercancel', release);

  button.addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
    button.style.removeProperty('--x');
    button.style.removeProperty('--y');
    button.classList.add('is-pressed');
  });
  button.addEventListener('keyup', release);
  button.addEventListener('blur', release);

  // Compile and render the idle shader before interaction, with its layer hidden.
  // The click handler only starts the already-prepared animation.
  try {
    shader = window.createButtonLiquidMetal(metal);
    shader.setSpeed(0);
    metal.querySelector('canvas')?.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      shader?.dispose();
      shader = null;
      metal.replaceChildren();
      button.classList.add('is-metal-fallback');
    });
  } catch (error) {
    metal.replaceChildren();
    button.classList.add('is-metal-fallback');
    console.warn('Liquid Metal uses a CSS fallback:', error.message);
  }

  button.addEventListener('click', () => {
    if (active) return;
    active = true;
    release();
    // Both visual states begin in this same event; no shader initialization wait.
    button.classList.add('is-active', 'is-metal-ready');
    button.querySelector('.be-label').setAttribute('aria-hidden', 'true');
    button.querySelector('.be-arrow').setAttribute('aria-hidden', 'true');
    shader?.setSpeed(reducedMotion.matches ? 0 : 0.7);
  });
  reducedMotion.addEventListener('change', () => shader?.setSpeed(!active || reducedMotion.matches ? 0 : 0.7));
  window.addEventListener('pagehide', () => { shader?.dispose(); shader = null; });
})();
