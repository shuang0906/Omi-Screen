# Glass Cards Slider

打开 `glass-cards-slider.html` 查看新版本。原来的 `film-strip.html` 和 `glass-cards.html` 保持独立。

- 容器：370 × 417px，浅灰背景。
- 卡片：260 × 347px，使用 glass-cards 中的四张原始卡片和本地图片。
- 保留卡片渐变、边缘高光和玻璃折射；非 Chromium 浏览器使用模糊效果。
- 支持左右箭头、滚轮、拖拽、触摸、横向无限循环与吸附。
- 图片保持平滑视差，文字使用单次 overshoot。

卡片内容在页面的 `glass-slide-templates` 模板中。动画参数在 `assets/js/glass-cards-slider.js`，新版本的样式覆盖在 `assets/css/glass-cards-slider.css`。

已检查资源路径、卡片模板、居中、左右切换和循环逻辑。尚未在浏览器中进行视觉实测。
