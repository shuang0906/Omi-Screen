# Button Effect

打开 `button-effect.html`。点击 Confirm 后，状态 1 始终保留在 shader 下方。底色、文字、整个箭头和外轮廓作为同一层在 500ms 内模糊到 24px，类似 Figma Layer Blur，不隐藏或淡出。状态 2 点击后立即开始，用 500ms 渐入并持续流动。刷新可重播。时长由 CSS 的 `--be-state-duration` 控制；模糊强度在 `.be-state-one` 的 `filter` 中调整。CSS 修改无需重新打包。

使用 [Paper 官方 Liquid Metal](https://shaders.paper.design/liquid-metal)，固定版本 `@paper-design/shaders@0.0.81`。Shader 内绘制胶囊轮廓；按钮允许模糊向外扩散，不改变按钮布局尺寸。

本地打包后的 `assets/js/liquid-metal.js` 可以直接通过 `file://` 打开，不依赖 CDN。无 WebGL2 时使用 CSS 金属渐变；系统开启减少动态效果时使用静态画面。

修改 shader 参数后重新构建：

```powershell
npm install
npm run build
```

参数在 `assets/js/liquid-metal-source.js`，时长和缓动在 `assets/css/button-effect.css`。Paper 的许可证和声明保存在 `assets/vendor/paper-shaders/`。

状态 2 的独立 shader 边缘模糊在 `liquid-metal-source.js` 的 `EDGE_BLUR` 中控制，当前 `{ radius: 0, width: 0, padding: 0 }`。`radius` 控制外轮廓柔化及纹理模糊半径，`width` 控制向内的纹理模糊范围，`padding` 是 canvas 外扩留白，启用柔边时应大于 `radius`。单位均为 CSS 像素。修改 shader 后运行 `npm run build`。

按钮周围的交易确认界面（状态栏、关闭按钮、标题、金额、交易明细、免责声明）来自 Figma 节点 `4341:87866`，按 Figma 绝对坐标放在 `button-effect.html` 中，样式在 `button-effect.css` 的 Review content 部分。纯静态，不影响按钮交互。
