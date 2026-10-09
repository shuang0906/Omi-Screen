# Film Strip Slider

直接用浏览器打开 `film-strip.html`，无需安装或构建。

横向无限循环滑块，界面仅包含本地 SVG 占位图片与虚构文字。支持滚轮、触控板横向滚动、左右拖拽、触摸滑动和键盘左右箭头切换。滑动结束后吸附居中，文字与图片具有水平方向的反向视差。

## 替换与调整

- 在 `assets/js/film-strip.js` 的 `SLIDES` 数组修改文字内容。
- 在 `slideHTML()` 中，把图片占位容器替换为 `<img class="roll-img" src="图片路径" alt="画面描述">`。
- CSS 的 `--frame-w` 控制每页宽度，`--frame-h` 控制高度，`--gap` 控制页间距。
- `IMG_PARALLAX` 和 `TEXT_PARALLAX` 控制图片与文字容器位移，`TEXT_PARALLAX_SCALE` 控制文字内部各层位移。
- 图片位移比例应小于 CSS 中图片向左右扩展的比例，目前图片两侧各扩展 40%。
- `SNAP_DELAY` 与 `SNAP_EASE` 控制吸附等待时间和速度。系统设置减少动态效果时，停用缓动与视差。

## Glass Cards

直接用浏览器打开 `glass-cards.html`。四张优惠卡片来自 Figma「MegaETH (Internal)」节点 `3580:29458`，样式在 `assets/css/glass-cards.css`，图片在 `assets/img/glass-cards/`。

- 玻璃效果对应 Figma GLASS（模糊 4、折射 0.99、深度 100、光线 -45°、色散 0.5）。所有浏览器都有背景模糊与左上 / 右下高光边。
- Chromium 浏览器额外启用折射与色散：`assets/js/glass-cards.js` 生成圆角边缘位移图，并通过 `backdrop-filter: url(#glass-refract)` 应用。参数在该文件的 `GLASS` 对象中调整。
- 设计稿字体为 Suisse Int'l，未安装时回退到 Helvetica Neue。

## Gradient Cards

直接用浏览器打开 `gradient-cards.html`。四张渐变卡片背景（BG1–BG4）来自 Figma 节点 `3711:15315`，样式在 `assets/css/gradient-cards.css`。BG1 的黄色取自设计变量 `yellow/light-yellow` 与 `yellow/dark-yellow`，对应 `--yellow-light`、`--yellow-dark`。

## Slide Indicator

直接用浏览器打开 `indicator.html`。底部指示器来自 Figma 节点 `3582:30179`，放在 370 × 417 的 `#939393` 圆角容器中，不含上方卡片。

- 共 4 项，圆点 6px、间距 3px。当前项为 20px 胶囊（30% 白色轨道 + 白色进度条），进度条从 6px 白点长到走满后自动切到下一项。
- 点击圆点跳转，聚焦后可用左右箭头切换；鼠标悬停或聚焦时暂停。
- 在 `indicator.html` 的 `data-count` 改数量，`data-duration` 改每项时长（毫秒）。系统设置减少动态效果时，不播放进度与变形动画，仍按时长切换。

## Intent Plans（转盘卡片）

直接用浏览器打开 `plans.html`。来自 Figma 节点 `3740:13094`（Earn, Plans · Option 01）。

- 卡片排在一个大圆上（圆心即下方刻度盘圆心），中间卡片正立清晰，两侧卡片倾斜 ±30° 并模糊。卡片无限循环。
- 只能拖动下方刻度盘来切换：按手指绕圆心的角度转动，松手后带惯性吸附到最近一张。刻度 9° 一格，每 3 格（27°）切换一张卡；深色刻度固定在正上方。聚焦刻度盘后可用左右箭头：点按切换一张，长按持续转动，松开后减速停在前进方向的下一张。
- 在 `assets/js/plans.js` 的 `PLANS` 数组修改卡片标题与图片；金额为占位。几何参数（半径、角度、模糊）在同文件顶部常量中。
- 刻度由 JS 按 Figma「Repeat group 1」的几何生成，以便深色刻度不随转盘移动。

## Intent Plans（堆叠版）

直接用浏览器打开 `plans-stack.html`。来自 Figma 节点 `3800:29077`，样式在 `assets/css/plans-stack.css`，交互在 `assets/js/plans-stack.js`。

- 卡片前后堆叠：前卡 266px，后面两张缩小、模糊并露出顶边。拖动下方刻度尺，前卡下移出画面，后面的卡依次放大变清晰补到前面，最后方淡入一张新卡；反向拖动则把上一张从下方拉回。卡片无限循环。
- 刻度 25px 一格，每 3 格（75px）切换一张；深色刻度固定在中间，两端的刻度滑出时淡出。
- 键盘、长按、运动曲线与转盘版一致（`DRAG_GAIN`、`TAP_DURATION`、`SPIN_SPEED`、`SPIN_STOP_MIN` 等常量在文件顶部）。各层卡片的位置、尺寸与模糊在 `LEVELS`，前卡下落距离在 `DROP`。

## Glass Cards Slider v2

直接用浏览器打开 `glass-cards-slider-v2.html`。卡片设计与容器来自 Figma 节点 `3800:29024`（Family），样式在 `assets/css/glass-cards-slider-v2.css`，交互在 `assets/js/glass-cards-slider-v2.js`；原 `glass-cards-slider.html` 保持不变。

- 容器 384 × 487，背景渐变随当前卡片照片的颜色变化（滑动时在相邻两张之间连续过渡；颜色在 `PLANS` 的 `bg` 中），卡片 259.064 × 345.75，照片铺满，含标题、金额与 37 格资金进度条，底部 Add Plan 按钮。
- 滑动方式沿用原版：滚轮、拖拽、触摸、左右箭头，无限循环，吸附时文字单次 overshoot，照片在裁切范围内视差。
- 相邻卡片会渐变成设计稿中两侧的毛玻璃占位卡（白色 40%、模糊、61% 不透明度、缩小到 214.284 宽）。
- 卡片在 `PLANS` 数组中修改；金额为占位。中间卡片保留 Figma GLASS 的边缘高光与折射（Chromium，复用 `assets/js/glass-cards.js`）。
- 金额使用 [NumberFlow](https://number-flow.barvian.me)（`number-flow@0.6.2`，从 esm.sh 加载，需联网）：每张卡先显示 `from`，切换一开始就滚动到 `saved`；卡片变成两侧虚化卡后静默回到 `from`。刻度动画仍在卡片停稳、文字 overshoot 结束后才开始。每张卡的 `from`/`saved`/`goal` 与刻度动画参数 `anim` 在 `PLANS` 中。
