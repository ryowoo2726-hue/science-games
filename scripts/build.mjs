import { cp, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npm, resetDist } from './utils.mjs';
import { checkSite } from './check-site.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buoyancy = join(project, 'games', 'buoyancy');
await npm(buoyancy, ['run', 'build']);
const output = await resetDist(project);
await cp(join(project, 'index.html'), join(output, 'index.html'));
for (const [game, entries] of [
  ['gravity', ['index.html', 'style.css', 'js']],
  ['elasticity', ['index.html', 'style.css', 'game.js']],
  ['friction', ['index.html', 'style.css', 'src', 'vendor']],
]) {
  for (const entry of entries) {
    await cp(join(project, 'games', game, entry), join(output, 'games', game, entry), { recursive: true });
  }
}
await cp(join(buoyancy, 'dist'), join(output, 'games', 'buoyancy'), { recursive: true });
await writeFile(join(output, '.nojekyll'), '');
await checkSite(output);
console.log(`통합 사이트 빌드 완료: ${output}`);
