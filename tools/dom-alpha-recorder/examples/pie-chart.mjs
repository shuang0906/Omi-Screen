export default {
  input: '../../../Vanilla JS/Pie Chart/pie-chart.html',
  selector: '.pc', duration: 4, fps: 30, padding: 12,
  format: 'mov', output: '../output/pie-chart.mov',
  async setup({ page }) {
    // Wait for the externally loaded NumberFlow module when recording rolling numbers.
    await page.waitForFunction(() => !!window.NumberFlowPlugins, null, { polling: 100 });
  },
  async frame({ page, index, target }) {
    if (index === 15) await target.locator('.pc-seg').nth(1).dispatchEvent('click');
    if (index === 60) await target.locator('.pc-seg').nth(2).dispatchEvent('click');
    if (index === 90) await target.locator('.pc-seg').nth(0).dispatchEvent('click');
  },
};
