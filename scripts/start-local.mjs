import { cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Keep npm's thousands of small dependency files off a virtual cloud drive.
// This copies source files; it never removes or moves the user's project.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const key = createHash('sha256').update(project).digest('hex').slice(0, 10);
const runtime = join(process.env.LOCALAPPDATA ?? tmpdir(), 'CodexProjects', `buoyancy-maze-${key}`);
await mkdir(runtime, { recursive: true });
for (const entry of ['src', 'public', 'tests', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts']) {
  await cp(join(project, entry), join(runtime, entry), { recursive: true, force: true });
}
console.log(`\n로컬 실행 폴더: ${runtime}\n원본 프로젝트는 ${project}에 유지됩니다.\n`);

function npm(args) {
  // Arguments below are fixed script names; no user content is passed to the shell.
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: runtime, stdio: 'inherit' })
    : spawn('npm', args, { cwd: runtime, stdio: 'inherit' });
  return new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`npm ${args.join(' ')} 종료 코드: ${code}`)));
  });
}
async function availablePort() {
  for (let port = 5173; port < 5194; port++) {
    const free = await new Promise(resolvePromise => {
      const probe = createServer();
      probe.once('error', () => resolvePromise(false));
      probe.listen(port, '0.0.0.0', () => probe.close(() => resolvePromise(true)));
    });
    if (free) return port;
  }
  throw new Error('5173~5193 포트가 모두 사용 중입니다. 기존 개발 서버를 종료해 주세요.');
}
try {
  // Reuse dependencies only when the exact lockfile matches the installed marker.
  const { writeFile } = await import('node:fs/promises');
  const lock = await readFile(join(runtime, 'package-lock.json'), 'utf8');
  const fingerprint = createHash('sha256').update(lock).digest('hex');
  const marker = join(runtime, 'node_modules', '.buoyancy-lock');
  let installed = '';
  try { installed = await readFile(marker, 'utf8'); } catch { /* first launch */ }
  if (installed !== fingerprint) { await npm(['ci', '--no-fund']); await writeFile(marker, fingerprint); }
  const port = await availablePort();
  await npm(['run', 'dev', '--', '--port', String(port)]);
} catch (error) { console.error(error.message); process.exitCode = 1; }
