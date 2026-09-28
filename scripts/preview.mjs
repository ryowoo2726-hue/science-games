import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('dist 폴더가 없습니다. 먼저 npm run build를 실행하세요.'); process.exit(1); }

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const rel = relative(root, path);
    if (rel === '..' || rel.startsWith(`..${sep}`) || rel.includes(':')) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(body);
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
server.on('listening', () => {
  console.log(`\n부력 미로가 준비됐습니다.\n브라우저에서 http://localhost:${port}/ 를 여세요.\n종료: Ctrl+C\n`);
});
server.listen(port, '0.0.0.0');
