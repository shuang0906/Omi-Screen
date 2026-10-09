export default {
  input: '../../../Vanilla JS/plans stack/plans-stack-cards.html',
  selector: '.plans', duration: 4, fps: 30,
  format: 'mov', output: '../output/plans-stack.mov',
  css: '.stack:focus-visible { outline: none !important; }',
  async setup({ target }) { await target.locator('.stack').focus(); },
  async frame({ page, index }) {
    if ([15, 55, 95].includes(index)) await page.keyboard.press('ArrowRight');
  },
};
