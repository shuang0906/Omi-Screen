import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { record, normalize } from '../src/recorder.mjs';
import { serve } from '../src/server.mjs';

const input = fileURLToPath(new URL('../examples/demo.html', import.meta.url));
test('validates inputs before launching a browser', () => {
  for (const options of [{}, { input, fps: NaN }, { input, fps: 1.5 }, { input, width: Infinity }, { input, format: 'mp4' }, { input, duration: 0 }]) assert.throws(() => normalize(options));
});
test('serves HTML and refuses files beyond the selected root', async () => {
  const server = await serve(input);
  try {
    assert.equal((await fetch(server.url)).status, 200);
    const base = new URL(server.url).origin;
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 403);
  } finally { await server.close(); }
});
test('captures evolving CSS and RAF frames with real transparent pixels', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dom-alpha-test-'));
  try {
    const output = path.join(directory, 'frames');
    const result = await record({ input, selector: '#animation', output, format: 'png', duration: 0.6, fps: 5 });
    assert.equal(result.frames, 3);
    const first = await readFile(path.join(output, 'frame-000000.png'));
    const last = await readFile(path.join(output, 'frame-000002.png'));
    assert.notDeepEqual(first, last, 'animation must advance');
    assert.equal(first.readUInt32BE(16), 360);
    assert.equal(first.readUInt32BE(20), 240);
    assert.equal(first[25], 6, 'PNG must contain RGBA');
    // The first scanline is fully transparent; inspect raw alpha bytes.
    const chunks = [];
    for (let offset = 8; offset < first.length;) {
      const length = first.readUInt32BE(offset);
      if (first.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(first.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const pixels = inflateSync(Buffer.concat(chunks));
    // For the first pixel all PNG predictor neighbors are zero, regardless of filter.
    assert.equal(pixels[4], 0, 'corner alpha must be zero');
    await assert.rejects(record({ input, selector: '#animation', output, format: 'png' }), /Output exists/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
