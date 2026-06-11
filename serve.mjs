// Tiny zero-dependency static file server used by the Playwright tests (and `npm run serve`).
// Serves the repo root so http://localhost:8080/retirement_model.html maps to ./retirement_model.html.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname === '/') pathname = '/retirement_model.html';
    // Resolve safely inside root (block path traversal).
    const safe = normalize(pathname).replace(/^([.][.](?:[/\\]|$))+/, '');
    const file = join(root, safe);
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, () => console.log(`static server on http://localhost:${port}`));
