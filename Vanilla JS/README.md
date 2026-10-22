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

直接用浏览器打开 `plans stack/plans-stack.html`。来自 Figma 节点 `3800:29077`，样式在 `plans stack/assets/css/plans-stack.css`，交互在 `plans stack/assets/js/plans-stack.js`。

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

## Pie Chart

直接用浏览器打开 `Pie Chart/pie-chart.html`。来自 Figma 节点 `552:4512`（272 × 272），放在「MegaETH (Internal)」节点 `4341:40564` 的 402 × 874 屏幕背景里（距顶 260px、水平居中；背景纹理与 Button Effect 相同，底部 445 × 309 渐变淡到 `#F4F4F4`），样式在 `Pie Chart/assets/css/pie-chart.css`，交互在 `Pie Chart/assets/js/pie-chart.js`。

- 五段环形由 JS 按 Figma 弧形数据生成：内径比 0.7353（外径 136、内径 100），四角圆角 4px，段间隔 1.6°，起始角 82.8°。比例改动后会自动重排。
- 点击扇形选中：选中段变为该段自己的颜色渐变（依次 `#BCB754` `#F8D1C2` `#C3E4F5` `#31318C` `#359E3F`，在 `SEGMENTS` 的 `color`），其余为玻璃段；中间金额滚动到新值，说明文字淡出淡入，指针绕圆心转到该段中点。聚焦后可用方向键 / Home / End 切换。
- 选中段的黄色渐变带 wave：黄色淡出边缘沿弧线起伏流动：波峰 `PEAK` = 1.5（超过外圈，外缘仍保留部分颜色），波谷再往里 34%（`SWING`），一圈约 5 个波峰（两组反向正弦，约 16°/s），亮带随之移动，并有轻微波纹从内圈向外扩散。由 canvas 逐像素绘制并按扇形路径裁切，参数在 `pie-chart.js` 顶部 `PEAK` / `SWING`、`WAVES`（`k` 波峰数/圈、`speed` 速度、`weight` 两组波的占比、`glow` 亮度变化）与 `RIPPLE`（`count` 环宽内波纹数、`speed` 向外速度、`depth` 明暗幅度）。系统设置减少动态效果时保持静止。
- 数据在 `SEGMENTS` 数组（名称、百分比、金额）；除 Tokyo Trip 外的名称与金额为占位。
- 玻璃段近似 Figma GLASS（光线 -45°）：40% 线性渐变（参考 Figma 节点 `4319:32117`，Figma 为 20%）：沿每段中线，内圈 `#ABABAB`（Figma `#D6D6D6` 加深 20%）到外圈透明白+ 白色内描边高光 + 柔和内发光，在 `#bababa` 背景上与设计稿一致。刻度环与指针使用 Figma 导出的 SVG。

## Plans Stack - Cards Only

Open `plans stack/plans-stack-cards.html` for the cards-only version. Drag the cards, scroll, or use the left/right arrow keys to switch plans. The original version remains at `plans stack/plans-stack.html`.

Background: Figma node `4402:36626` — a 402 × 795 frame (top corners 30 / 35) with the blue vertical gradient over `#878787`, as rendered in Figma. Extra gradient stops reproduce Figma's unpremultiplied blending. The stack is shifted so the front card is centred where Figma's is (y 337.5). Styles are in `assets/css/plans-stack-cards.css`.

## Plans Stack - Transit

直接用浏览器打开 `Plans Stack/plans-stack-transit.html`。初始界面来自 Figma 节点 `4422:37225`（402 × 874）：Intent Plans 标题、卡片堆（复用 `plans-stack-cards.js`）、Add Plan / See all 按钮和 Recent Activity 列表，页面可向下滚动，状态栏与底部导航（Nav Bar + AI Concierge，毛玻璃）固定。新设计里没有刻度尺，直接拖动卡片切换；刻度尺元素仍保留但隐藏，因为 `plans-stack-cards.js` 需要它。点击前卡（或聚焦后按 Enter / 空格）进入计划详情，详情来自 Figma 节点 `4404:33902`（402 × 1289，在 402 × 874 屏幕内滚动）。样式在 `assets/css/plans-stack-transit.css`，动画在 `assets/js/plans-stack-transit.js`。

- 打开：前卡本身放大成 370 × 450 的详情大图（720ms，`cubic-bezier(.32,.72,0,1)`），卡上原有文字淡出、详情文字随后淡入；其余卡片下沉、缩小并模糊消失，标题、按钮、Recent Activity、状态栏和导航一起淡出；磨砂背景淡入，下方各区块依次上浮出现；状态栏与底部 × 最后出现。
- 关闭：点底部 ×（或 Esc），大图缩回卡片原位（即使已向下滚动），其余元素反向退出。拖动卡片不会触发打开。
- 详情使用所点卡片的图片、名称和日期；金额、字段与交易记录为设计稿中的占位内容。状态栏、灵动岛、底部渐变与 × 固定在屏幕上，内容在其间滚动。
- 设计稿中磨砂层下方的 Pay 页面被 135.8 背景模糊后只剩颜色，因此只保留了 Personalized Rewards 黄色卡片作为模糊色块。
- 标题与金额使用 Suisse Int'l Medium，说明文字使用 Regular，字体文件在 `assets/fonts/`（从本机安装的字体复制）。
- 系统设置减少动态效果时直接切换，不播放动画。

## DOM Alpha Recorder

Reusable Playwright + FFmpeg transparent DOM recording tool: [`../tools/dom-alpha-recorder/README.md`](../tools/dom-alpha-recorder/README.md). Includes Pie Chart, Plans Stack and Earn Chart recording configurations.

## Button Effect

直接用浏览器打开 `Button Effect/button-effect.html`。来自 Figma「MegaETH (Internal)」节点 `4340:65987`（Light Mode，402 × 874，圆角 32），样式在 `Button Effect/assets/css/button-effect.css`，交互在 `Button Effect/assets/js/button-effect.js`。

- 背景层 402 × 796.103、15% 不透明度、底部圆角 26：`#EFEFCF` 底色上叠两张 color-burn 纹理（第二张按 Figma 裁切参数双向翻转）。Overlay 为 20% `#D9D9D9`，其背景模糊（50）直接作用在背景层上，这样屏幕边缘像 Figma 一样淡到 `#F4F4F4`，而不是混入页面外的灰色。
- 交易确认界面来自节点 `4341:87866`，按 Figma 绝对坐标排版：状态栏（Inter 500）、40px 白色关闭按钮、标题、Total Amount $500.00、5 行交易明细（10% 黑色分隔线）和底部免责声明；底部另有 445 × 309 渐变淡到 `#F4F4F4`。设计稿中 Overlay 下还有一条状态栏，按背景模糊处理成顶部的柔和阴影。设计稿里画面外（y 1455）的 Recent Activity 列表不可见，未加入。
- 按钮 378 × 56，位于 (12, 800.5)，64% 黑、圆角 41，左内边距 24；右侧 44px 圆形 36% 白底箭头。
- 设计稿没有原型交互，额外加了轻量反馈：悬停时按钮加深、箭头右移 2px；按下时缩到 0.97 并在手指位置出现柔光。系统设置减少动态效果时关闭这些动画。
