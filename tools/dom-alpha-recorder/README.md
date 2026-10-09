# DOM Alpha Recorder

用 Playwright 按帧截取指定 DOM 区域，再用 FFmpeg 输出带 Alpha 通道的视频。可录制独立 HTML 或 HTTP 页面，支持 CSS、SVG、NumberFlow、普通 JS/RAF 动画和 Canvas。无需修改原 HTML。

## 安装与运行

在此文件夹打开 PowerShell：

```powershell
npm install
npx playwright install chromium
npm run demo
```

`npm run demo` 会重新生成并覆盖演示文件 `output/demo.mov`。

依赖包含完整 FFmpeg。也可通过 `--ffmpeg "C:\path\ffmpeg.exe"` 或 `FFMPEG_PATH` 指定已安装的版本。Playwright 自带的精简 FFmpeg 缺少 ProRes 编码，不适合此工具。

```powershell
# 指定任意 HTML 与组件选择器
node record.mjs --input "../../Vanilla JS/Pie Chart/pie-chart.html" --selector ".pc" --duration 3 --fps 60 --output output/pie.mov

# 透明 WebM
node record.mjs --input "examples/demo.html" --selector "#animation" --format webm --output output/demo.webm

# 无损透明 PNG 序列，不需要 FFmpeg
node record.mjs --input "examples/demo.html" --selector "#animation" --format png --output output/frames

# HTTP 页面也可以，使用自己的本地开发服务器
node record.mjs --input "http://localhost:3000" --selector ".widget" --output output/widget.mov

# 已准备好的项目录制配置
node record.mjs --config examples/pie-chart.mjs
node record.mjs --config examples/plans-stack.mjs
node record.mjs --config examples/earn-chart.mjs
```

视频默认不覆盖，重复录制可换输出名或加 `--overwrite`。PNG 目录和 `--keep-frames` 目录必须是新目录，防止混入旧帧。每次录制附带 `recording.json` 或视频旁的 `.json`，记录帧数、帧率、裁切尺寸和来源。

## 跨 HTML 复用

每个 HTML 只需要一份配置。配置内路径相对于配置文件，命令行指定的路径相对于终端当前目录。命令行参数会覆盖配置。

```js
export default {
  input: './my-animation.html',
  selector: '#capture',
  output: './output/my-animation.mov',
  format: 'mov',
  duration: 4,
  fps: 60,
  width: 1280,
  height: 900,
  scale: 2,
  padding: 16,
  warmup: 0, // 录制前推进的虚拟毫秒数
  // 清除组件自身的背景属于可选设置；默认保留组件的完整外观。
  css: '#capture { background: transparent !important; }',
  async setup({ page, target }) {
    // 等待字体/图片由工具自动处理；自定义数据或模块在这里等待。
    // 模拟点击用 dispatchEvent，避免冻结时钟下的可操作性等待。
    await target.locator('button').dispatchEvent('click');
  },
  async frame({ page, target, time, index }) {
    // 在特定时间点触发交互；不要在这里 waitForTimeout。
    if (index === 60) await target.locator('button').dispatchEvent('click');
  },
};
```

`setup` 在虚拟时钟暂停后执行。`frame` 在每帧时间推进后、截图前执行。使用 `page.mouse.move/down/up` 可按帧编排拖拽；用 `page.keyboard.press` 触发键盘交互。优先使用 `dispatchEvent('click')`，不要依赖 `locator.click()` 的自动稳定性等待：暂停中的 CSS 动画可能让它一直等待。`page.waitForTimeout()` 也不能用于这两个钩子。

也可以直接导入 API：

```js
import { record } from './src/recorder.mjs';
await record({ input: './page.html', selector: '.widget', format: 'png', output: './output/frames' });
```

## 透明度与录制时间

- 工具清除目标的祖先背景、阴影和边框，并隐藏目标外内容。目标及其子元素的背景、透明度和原本隐藏的卡片仍保留。需要额外移除背景层时用 `css` 配置。
- 裁切区域在开始时固定，输出尺寸不会随运动改变。选择一个能容纳整个动画的固定尺寸 wrapper；用 `padding` 给阴影留白，裁切区域必须落在 viewport 内。
- JS 的 `Date`、`performance.now`、计时器和 RAF 使用 Playwright 虚拟时钟。每帧推进约 `1000 / fps` 毫秒，截图耗时不会加快或拖慢动画；时间精度为毫秒，RAF 按浏览器模拟的节奏触发。
- CSS 与 WAAPI 动画通过 `currentTime` 同步到录制时间，新创建的动画也会被跟踪。手动反复 seek / resume 同一个 WAAPI 动画、Worker、视频或音频等独立时钟，需要自己的适配。
- 复杂 WebGL/WebGPU 或其他独立动画引擎可提供 `window.renderFrame = async seconds => { ... }`，工具会在每帧截图前调用。函数必须完成该帧绘制后返回，不能等待下一次 RAF。
- 本地 HTML 自动通过仅监听 `127.0.0.1` 的临时 HTTP 服务器打开。默认根目录是 HTML 所在目录；若资源跨目录，可加 `--root "../../Vanilla JS"`。录制结束后关闭服务器。
- 外部字体、CDN 脚本（如 NumberFlow）仍需网络。录制配置可等待 `window.NumberFlowPlugins`；离线录制需将外部依赖本地化。
- DOM 透明区域能保留 Alpha；`backdrop-filter` 没有外层背景可以模糊时，观感可能变化。输出不含音频。

## 输出格式

| 格式 | 用途 | 编码 |
| --- | --- | --- |
| MOV | 剪辑、合成 | ProRes 4444，`yuva444p10le` |
| WebM | 网页播放 | VP9 Alpha，`yuva420p`；奇数宽高补透明像素至偶数 |
| PNG | 无损中间帧 | RGBA，`frame-000000.png` 起 |

部分播放器显示黑底不代表没有透明通道。验证 WebM 时必须指定支持 Alpha 的 VP9 解码器：

```powershell
ffmpeg -c:v libvpx-vp9 -i output/demo.webm -frames:v 1 output/check.png
```

成功后默认清理临时帧；`--keep-frames` 可保留视频源帧。失败时保留帧并打印目录，便于重试编码。

## 验证

```powershell
npm test
```

测试覆盖参数校验、HTTP 目录边界、实际 Chromium 动画录制、RGBA 透明像素和已有输出保护。项目示例配置已实际运行；MOV 与 WebM 已导出并解码验证 Alpha。

实现参考：[Playwright Clock](https://playwright.dev/docs/clock)、[FFmpeg 编码文档](https://ffmpeg.org/ffmpeg-codecs.html)。
