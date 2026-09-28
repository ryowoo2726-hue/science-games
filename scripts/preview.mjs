import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const base = '/science-games/';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('먼저 개발실행.cmd 또는 npm run build를 실행하세요.'); process.exit(1); }

const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/' || url.pathname === base.slice(0, -1)) {
      response.writeHead(302, { Location: base }); response.end(); return;
    }
    if (!url.pathname.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
    const pathname = decodeURIComponent(url.pathname.slice(base.length));
    let target = resolve(root, pathname || 'index.html');
    const rel = relative(root, target);
    if (rel === '..' || rel.startsWith(`..${sep}`) || rel.includes(':') || rel.split(sep).some(part => part.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    if ((await stat(target)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(302, { Location: `${url.pathname}/` }); response.end(); return; }
      target = resolve(target, 'index.html');
    }
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('파일을 찾을 수 없습니다.');
  }
});
let port = Number(process.env.PORT) || 4173;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < 4193) { port++; server.listen(port, '0.0.0.0'); }
  else { console.error(error.message); process.exit(1); }
});
server.on('listening', () => console.log(`통합 사이트: http://localhost:${port}${base}\n종료: Ctrl+C`));
server.listen(port, '0.0.0.0');
