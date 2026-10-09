import http from 'node:http';
import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
export function contained(root, file) {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export async function serve(input, directory = path.dirname(input)) {
  const root = await realpath(directory);
  const file = await realpath(input);
  if (!contained(root, file)) throw new Error('Input HTML is outside --root.');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const candidate = path.resolve(root, `.${pathname}`);
      if (!contained(root, candidate)) { res.writeHead(403).end(); return; }
      const actual = await realpath(candidate);
      if (!contained(root, actual)) { res.writeHead(403).end(); return; }
      if (!(await stat(actual)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(actual).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      createReadStream(actual).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const relative = path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');
  return { url: `http://127.0.0.1:${server.address().port}/${relative}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
