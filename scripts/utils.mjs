import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

export function npm(cwd, args) {
  if (args.some(arg => !/^[a-zA-Z0-9:._-]+$/.test(arg))) throw new Error('Invalid npm argument');
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  return new Promise((done, reject) => {
    const child = spawn(command, commandArgs, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`npm ${args.join(' ')} failed (${code})`)));
  });
}

export async function resetDist(project) {
  const target = resolve(project, 'dist');
  if (relative(resolve(project), target) !== 'dist') throw new Error('Unexpected build directory');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  return target;
}
