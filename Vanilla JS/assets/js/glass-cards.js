(() => {
  'use strict';

  // Figma GLASS effect parameters (Card Stack 66/68/70/72).
  const GLASS = {
    refraction: 0.99,  // 0..1, strength of edge bending
    depth: 100,        // 0..100, how far the bevel reaches into the card
    dispersion: 0.5,   // 0..1, RGB split at the edges
    blur: 4            // px, frosted backdrop
  };
  const MAX_BEZEL = 24;    // px of bevel at depth 100
  const MAX_SHIFT = 40;    // px of displacement at refraction 1
  const MAX_SPLIT = 0.12;  // relative R/B scale spread at dispersion 1

  // backdrop-filter: url() only renders in Chromium; other browsers keep the CSS blur.
  const isChromium = /Chrome\//.test(navigator.userAgent);
  const card = document.querySelector('.card');
  const filter = document.getElementById('glass-refract');
  if (!isChromium || !card || !filter) return;
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

  // Rounded-rect displacement map: R/G hold the x/y offset (128 = none),
  // pointing inward and growing toward the edge like a convex lens bevel.
  function drawMap(w, h, r, bezel) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hw = w / 2, hh = h / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + .5 - hw, py = y + .5 - hh;
        const qx = Math.abs(px) - (hw - r);
        const qy = Math.abs(py) - (hh - r);
        let dist, nx, ny;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy) || 1;
          dist = r - len;
          nx = qx / len * Math.sign(px);
          ny = qy / len * Math.sign(py);
        } else if (qx > qy) {
          dist = r - qx;
          nx = Math.sign(px); ny = 0;
        } else {
          dist = r - qy;
          nx = 0; ny = Math.sign(py);
        }
        const t = Math.max(0, 1 - dist / bezel);
        const m = t * t * (3 - 2 * t);
        const i = (y * w + x) * 4;
        img.data[i] = 128 + nx * m * 127;
        img.data[i + 1] = 128 + ny * m * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  function build() {
    const w = Math.round(card.offsetWidth);
    const h = Math.round(card.offsetHeight);
    const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    const bezel = Math.max(1, MAX_BEZEL * GLASS.depth / 100);
    const shift = MAX_SHIFT * GLASS.refraction;
    const split = MAX_SPLIT * GLASS.dispersion;

    for (const el of [filter, filter.querySelector('[data-glass="map"]')]) {
      el.setAttribute('width', w);
      el.setAttribute('height', h);
    }
    filter.querySelector('[data-glass="map"]').setAttribute('href', drawMap(w, h, r, bezel));
    filter.querySelector('[data-glass="r"]').setAttribute('scale', -shift * (1 + split));
    filter.querySelector('[data-glass="g"]').setAttribute('scale', -shift);
    filter.querySelector('[data-glass="b"]').setAttribute('scale', -shift * (1 - split));
    filter.querySelector('[data-glass="blur"]').setAttribute('stdDeviation', GLASS.blur);
    document.documentElement.classList.add('glass-refract');
  }

  build();
})();
