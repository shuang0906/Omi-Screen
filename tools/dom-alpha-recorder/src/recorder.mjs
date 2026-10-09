import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, access, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { serve } from './server.mjs';

export function normalize(options) {
  const o = { selector: 'body', format: 'mov', duration: 3, fps: 30, width: 1280, height: 900, scale: 1, padding: 0, warmup: 0, ...options };
  if (!o.input) throw new Error('--input or a config with input is required.');
  if (!['mov', 'webm', 'png'].includes(o.format)) throw new Error('format must be mov, webm or png.');
  for (const [key, min, max, integer] of [['duration', 0.001, 600], ['fps', 1, 120, true], ['width', 1, 8192, true], ['height', 1, 8192, true], ['scale', 1, 4], ['padding', 0, 4096], ['warmup', 0, 600000, true]]) {
    o[key] = Number(o[key]);
    if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max || (integer && !Number.isInteger(o[key]))) throw new Error(`Invalid ${key}. Expected ${min}..${max}${integer ? ' (integer)' : ''}.`);
  }
  o.output = path.resolve(o.output || `output/recording.${o.format === 'png' ? 'frames' : o.format}`);
  return o;
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function run(binary, args, inherit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout?.on('data', data => { output += data; });
    child.stderr?.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`FFmpeg exited ${code}: ${output.slice(-2000)}`)));
  });
}
async function findFFmpeg(o) {
  let binary = o.ffmpeg || process.env.FFMPEG_PATH;
  if (!binary) {
    try { binary = createRequire(import.meta.url)('ffmpeg-static'); } catch { binary = 'ffmpeg'; }
  }
  let encoders;
  try { encoders = await run(binary, ['-hide_banner', '-encoders']); }
  catch { throw new Error('FFmpeg unavailable. Run npm install, or set --ffmpeg / FFMPEG_PATH to a full FFmpeg build.'); }
  const codec = o.format === 'mov' ? 'prores_ks' : 'libvpx-vp9';
  if (!encoders.includes(codec)) throw new Error(`FFmpeg is missing ${codec}. Use a full build; Playwright bundled FFmpeg is insufficient.`);
  return binary;
}

export async function record(options) {
  const o = normalize(options);
  if (await exists(o.output) && (!o.overwrite || o.format === 'png')) throw new Error(`Output exists: ${o.output}. Use a new path or --overwrite for video.`);
  const ffmpeg = o.format === 'png' ? null : await findFFmpeg(o);
  const { chromium } = await import('playwright');
  let server, browser, frameDir, completed = false;
  const keep = o.format === 'png' || o.keepFrames;
  try {
    let url = o.input;
    if (!/^https?:\/\//i.test(url)) { server = await serve(path.resolve(url), o.root && path.resolve(o.root)); url = server.url; }
    if (o.format === 'png') frameDir = o.output;
    else if (keep) frameDir = `${o.output}.frames`;
    else frameDir = await mkdtemp(path.join(tmpdir(), 'dom-alpha-'));
    await mkdir(path.dirname(o.output), { recursive: true });
    if (keep) await mkdir(frameDir); // Never merge old frame sequences.
    browser = await chromium.launch({ headless: true, ...o.launchOptions });
    const page = await browser.newPage({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: o.scale, reducedMotion: 'no-preference', locale: 'en-US' });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => console.warn(`Page error: ${error.message}`));
    // Install before navigation so page timers and RAF are controlled from startup.
    const epoch = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(epoch);
    await page.goto(url, { waitUntil: 'load' });
    if (o.readySelector) await page.locator(o.readySelector).waitFor({ state: 'attached' });
    const target = page.locator(o.selector);
    if (await target.count() !== 1) throw new Error(`Selector must match exactly one element: ${o.selector}`);
    await target.waitFor({ state: 'visible' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await target.evaluate(async node => {
      await Promise.all([...node.querySelectorAll('img')].map(img => img.decode().catch(() => { throw new Error(`Image failed: ${img.src}`); })));
    });
    // Isolate the chosen DOM subtree while preserving its styles and layout.
    await target.evaluate(node => {
      node.setAttribute('data-dom-alpha-target', '');
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        parent.style.setProperty('background', 'transparent', 'important');
        parent.style.setProperty('box-shadow', 'none', 'important');
        parent.style.setProperty('border-color', 'transparent', 'important');
      }
    });
    await page.addStyleTag({ content: `body { visibility: hidden !important; } [data-dom-alpha-target] { visibility: visible !important; }` });
    if (o.css) await page.addStyleTag({ content: o.css });
    // Do not use locator.click/press auto-waits with a paused animation clock.
    // Scenario hooks can use dispatchEvent, page.mouse or page.keyboard instead.
    if (o.setup) await o.setup({ page, target });
    await page.clock.runFor(o.warmup);
    const box = await target.boundingBox();
    if (!box || !box.width || !box.height) throw new Error('Target has no capture area.');
    const x = Math.floor(box.x - o.padding), y = Math.floor(box.y - o.padding);
    const clip = { x, y, width: Math.ceil(box.x + box.width + o.padding) - x, height: Math.ceil(box.y + box.height + o.padding) - y };
    if (x < 0 || y < 0 || x + clip.width > o.width || y + clip.height > o.height) throw new Error('Capture area exceeds viewport. Increase width/height or reduce padding.');
    const frames = Math.ceil(o.duration * o.fps);
    console.log(`Capture ${clip.width * o.scale} x ${clip.height * o.scale}, ${frames} frames at ${o.fps} fps`);
    let previousMs = 0;
    for (let index = 0; index < frames; index++) {
      const ms = Math.round(index * 1000 / o.fps);
      if (ms > previousMs) await page.clock.runFor(ms - previousMs);
      previousMs = ms;
      if (o.frame) await o.frame({ page, target, time: index / o.fps, index });
      await page.evaluate(async ({ ms }) => {
        if (typeof window.renderFrame === 'function') await window.renderFrame(ms / 1000);
        // CSS/WAAPI timelines are independent from the JS clock. Seek them too.
        window.__domAlphaTimelines ??= new WeakMap();
        for (const animation of document.getAnimations()) {
          let entry = window.__domAlphaTimelines.get(animation);
          if (!entry) {
            entry = { start: ms, offset: animation.playState === 'paused' ? (animation.currentTime ?? 0) : 0, rate: animation.playbackRate, paused: animation.playState === 'paused' };
            window.__domAlphaTimelines.set(animation, entry);
            animation.pause();
          }
          const currentTime = entry.offset + (entry.paused ? 0 : (ms - entry.start) * entry.rate);
          animation.currentTime = currentTime;
          const end = animation.effect?.getComputedTiming().endTime;
          if (!entry.paused && entry.rate > 0 && Number.isFinite(end) && currentTime >= end) animation.finish();
        }
      }, { ms });
      await page.screenshot({ path: path.join(frameDir, `frame-${String(index).padStart(6, '0')}.png`), clip, omitBackground: true, animations: 'allow', caret: 'hide', scale: 'device' });
      if (index % o.fps === 0 || index === frames - 1) console.log(`Frames ${index + 1}/${frames}`);
    }
    await browser.close(); browser = null;
    if (ffmpeg) {
      const encoding = o.format === 'mov'
        ? ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16']
        : ['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2:color=black@0', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '18'];
      await run(ffmpeg, ['-hide_banner', o.overwrite ? '-y' : '-n', '-framerate', String(o.fps), '-i', path.join(frameDir, 'frame-%06d.png'), '-frames:v', String(frames), ...encoding, '-an', o.output], true);
    }
    const manifest = { input: o.input, selector: o.selector, format: o.format, fps: o.fps, frames, duration: frames / o.fps, clip, scale: o.scale, output: o.output };
    await writeFile(o.format === 'png' ? path.join(frameDir, 'recording.json') : `${o.output}.json`, JSON.stringify(manifest, null, 2));
    completed = true;
    console.log(`Saved: ${o.output}`);
    return manifest;
  } finally {
    await browser?.close();
    await server?.close();
    // Only remove this process's uniquely generated temporary directory.
    // Keep failed captures for diagnosis or manual encoding.
    if (frameDir && !keep && completed) await rm(frameDir, { recursive: true, force: true });
    else if (frameDir && !completed) console.warn(`Capture frames retained: ${frameDir}`);
  }
}
