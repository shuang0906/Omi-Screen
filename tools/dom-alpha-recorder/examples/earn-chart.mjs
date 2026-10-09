export default {
  input: '../../../Vanilla JS/Earn Chart/earn-chart.html',
  selector: '.ec', duration: 4, fps: 30,
  format: 'mov', output: '../output/earn-chart.mov',
  // Retain the widget's own background; clear .ec as well if you want only its content.
  async setup({ page }) {
    await page.waitForFunction(() => !!window.NumberFlowPlugins, null, { polling: 100 });
  },
  async frame({ page, target, time }) {
    const box = await target.locator('[data-ec="bars"]').boundingBox();
    const t = Math.min(1, Math.max(0, (time - 0.5) / 3));
    await page.mouse.move(box.x + 5 + (box.width - 10) * t, box.y + box.height / 2);
  },
};
