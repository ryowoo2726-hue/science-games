import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { npm, resetDist } from './utils.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const key = createHash('sha256').update(project).digest('hex').slice(0, 10);
const runtime = join(process.env.LOCALAPPDATA ?? tmpdir(), 'CodexProjects', `science-games-${key}`);
await mkdir(runtime, { recursive: true });
for (const entry of ['index.html', 'package.json', 'scripts', 'games']) {
  await cp(join(project, entry), join(runtime, entry), {
    recursive: true, force: true,
    filter: source => !['node_modules', 'dist', '.git'].includes(source.split(/[\\/]/).at(-1)),
  });
}
const buoyancy = join(runtime, 'games', 'buoyancy');
const fingerprint = createHash('sha256').update(await readFile(join(buoyancy, 'package-lock.json'))).digest('hex');
const marker = join(buoyancy, 'node_modules', '.science-games-lock');
let installed = '';
try { installed = await readFile(marker, 'utf8'); } catch { /* first launch */ }
if (installed !== fingerprint) {
  await npm(buoyancy, ['ci', '--no-fund', '--no-audit']);
  await writeFile(marker, fingerprint);
}
await npm(runtime, ['run', 'build']);
const output = await resetDist(project);
await cp(join(runtime, 'dist'), output, { recursive: true });
console.log('원본을 편집한 뒤 다시 실행하면 수정 내용이 반영됩니다.');
await import('./preview.mjs');
