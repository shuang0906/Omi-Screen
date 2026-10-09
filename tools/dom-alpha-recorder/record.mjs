import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { record } from './src/recorder.mjs';

const { values } = parseArgs({ options: {
  help: { type: 'boolean', short: 'h' },
  config: { type: 'string' }, input: { type: 'string' }, selector: { type: 'string' },
  output: { type: 'string' }, format: { type: 'string' }, duration: { type: 'string' },
  fps: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' },
  scale: { type: 'string' }, padding: { type: 'string' }, warmup: { type: 'string' },
  root: { type: 'string' }, ffmpeg: { type: 'string' },
  'keep-frames': { type: 'boolean' }, overwrite: { type: 'boolean' },
} });
if (values.help) {
  console.log(`DOM Alpha Recorder
node record.mjs --input page.html --selector '.widget' --output output/widget.mov
node record.mjs --config examples/pie-chart.mjs

--input        Local HTML or http(s) URL
--selector     One DOM capture wrapper (default: body)
--format       mov (ProRes 4444), webm (VP9 alpha), png (default: mov)
--output       Output video or NEW frame directory
--duration     Seconds, 0 < n <= 600 (default: 3)
--fps          Integer, 1..120 (default: 30)
--width/height Viewport in CSS pixels (default: 1280/900)
--scale        Device pixel ratio, 1..4 (default: 1)
--padding      Transparent crop padding in CSS pixels (default: 0)
--warmup       Virtual milliseconds before recording (default: 0)
--root         Local HTTP server root (default: HTML parent directory)
--ffmpeg       FFmpeg binary (or FFMPEG_PATH environment variable)
--keep-frames  Keep PNG sources alongside video
--overwrite    Allow replacing an existing video (never a frame directory)

Config modules export default { input, selector, ..., setup, frame }.
setup({page,target}) runs before capture. frame({page,target,time,index})
runs before each screenshot; time is seconds. Paths in config are relative
to the config file; CLI paths are relative to your current directory.`);
} else {
  try {
    let config = {};
    if (values.config) {
      const file = path.resolve(values.config);
      config = { ...(await import(pathToFileURL(file).href)).default };
      for (const key of ['input', 'output', 'root']) {
        if (config[key] && !/^https?:\/\//i.test(config[key])) config[key] = path.resolve(path.dirname(file), config[key]);
      }
    }
    const { config: _, help: __, 'keep-frames': keepFrames, ...cli } = values;
    await record({ ...config, ...cli, ...(keepFrames === undefined ? {} : { keepFrames }) });
  } catch (error) {
    console.error(`Recorder: ${error.message}`);
    process.exitCode = 1;
  }
}
