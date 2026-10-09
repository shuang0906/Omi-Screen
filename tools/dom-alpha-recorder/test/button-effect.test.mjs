import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const input = new URL('../../../Vanilla JS/Button Effect/button-effect.html', import.meta.url).href;
const output = new URL('../output/', import.meta.url);
test('button keeps the entire blurred original layer below the shader', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, offline: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(input);
    await page.evaluate(() => document.fonts.ready);
    const button = page.locator('[data-be="button"]');
    const before = await button.boundingBox();
    await mkdir(output, { recursive: true });
    await button.screenshot({ path: fileURLToPath(new URL('button-before.png', output)) });
    await button.click();
    await page.waitForTimeout(250);
    const early = await page.locator('.be-state-one').evaluate(node => ({
      opacity: getComputedStyle(node).opacity,
      blur: parseFloat(getComputedStyle(node).filter.slice(5)),
      metal: getComputedStyle(document.querySelector('.be-metal')).opacity,
    }));
    assert.equal(early.opacity, '1');
    assert.ok(early.blur > 0 && early.blur < 24);
    assert.ok(Number(early.metal) > 0, 'shader starts fading in immediately');
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.be-state-one').evaluate(node => getComputedStyle(node).filter), 'blur(24px)');
    assert.equal(await page.locator('.be-label').evaluate(node => getComputedStyle(node).visibility), 'visible');
    assert.equal(await page.locator('.be-arrow').evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await button.evaluate(node => getComputedStyle(node).overflow), 'visible');
    assert.equal(await page.locator('.be-metal canvas').count(), 1);
    assert.equal(await button.getAttribute('aria-label'), 'Confirm');
    assert.equal(await button.evaluate(node => node.classList.contains('is-metal-fallback')), false);
    assert.equal(await page.locator('.be-metal').evaluate(node => getComputedStyle(node).opacity), '1');
    assert.deepEqual(await button.boundingBox(), before);
    await button.screenshot({ path: fileURLToPath(new URL('button-metal.png', output)) });
    const first = await page.locator('.be-metal').evaluate(node => node.paperShaderMount.getCurrentFrame());
    await page.waitForTimeout(100);
    const second = await page.locator('.be-metal').evaluate(node => node.paperShaderMount.getCurrentFrame());
    assert.ok(second > first, 'shader animation advances');
    await button.click();
    assert.equal(await page.locator('.be-metal canvas').count(), 1);
    await page.addStyleTag({ content: 'html, body, .be { background: transparent !important; } .be-bg, .be-overlay, .be-metal { display: none !important; }' });
    const softEdge = await page.screenshot({
      path: fileURLToPath(new URL('button-soft-edge.png', output)),
      omitBackground: true,
      clip: { x: before.x - 12, y: before.y - 12, width: before.width + 24, height: before.height + 24 },
    });
    const alpha = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const x = Math.floor(image.width / 2);
      return [0, 7, 14, 40].map(y => ctx.getImageData(x, y, 1, 1).data[3]);
    }, softEdge.toString('base64'));
    assert.ok(alpha[1] > 0 && alpha[1] < 255, 'whole layer blur spreads outside the original contour');
    assert.ok(alpha[3] > alpha[1], 'blurred surface remains visible below the shader');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('keyboard, reduced motion and unavailable WebGL have a usable fallback', { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl2' ? null : original.call(this, type, ...args);
      };
    });
    await page.goto(input);
    await page.locator('[data-be="button"]').press('Enter');
    assert.equal(await page.locator('.be-button').evaluate(node => node.classList.contains('is-metal-fallback')), true);
    assert.equal(await page.locator('.be-label').evaluate(node => getComputedStyle(node).visibility), 'visible');
    assert.equal(await page.locator('.be-metal').evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await page.locator('.be-metal').evaluate(node => getComputedStyle(node).animationName), 'none');
  } finally { await browser.close(); }
});
