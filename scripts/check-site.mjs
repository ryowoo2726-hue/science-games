import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';

export async function checkSite(root) {
  let references = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { await visit(file); continue; }
      if (!['.html', '.css'].includes(extname(file))) continue;
      const content = await readFile(file, 'utf8');
      const matches = extname(file) === '.html'
        ? content.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)
        : content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
      for (const match of matches) {
        const url = match[1].trim();
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue;
        const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
        let target = resolve(dirname(file), pathname);
        const rel = relative(root, target);
        if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`Link outside website: ${relative(root, file)} -> ${url}`);
        try {
          if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
          await stat(target);
        } catch { throw new Error(`Missing website file: ${relative(root, file)} -> ${url}`); }
        references++;
      }
    }
  }
  await visit(root);
  console.log(`웹사이트 내부 링크·파일 ${references}개 확인 완료`);
}
