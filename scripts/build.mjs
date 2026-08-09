#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(rootDir, 'packages');

const cleanDts = async (dir, inSrc = false) => {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === 'node_modules') return;

      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        await cleanDts(path, inSrc || entry.name === 'src');
      } else if (inSrc && entry.name.endsWith('.d.ts')) {
        await rm(path);
      }
    }),
  );
};

const run = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

const args = process.argv.slice(2);

if (args[0] === '--clean') {
  await cleanDts(packagesDir);
} else {
  const isTurbo = args[0] === '--turbo';
  const command =
    process.platform === 'win32'
      ? isTurbo
        ? 'turbo.cmd'
        : 'rolldown.cmd'
      : isTurbo
        ? 'turbo'
        : 'rolldown';
  const commandArgs = isTurbo ? ['run', 'build'] : args;
  const skipCleanup = process.env.ORCHID_BUILD_FROM_TURBO === '1';
  let exitCode;

  try {
    exitCode = await run(
      command,
      commandArgs,
      isTurbo ? { ...process.env, ORCHID_BUILD_FROM_TURBO: '1' } : process.env,
    );
  } finally {
    if (!skipCleanup) await cleanDts(packagesDir);
  }

  process.exitCode = exitCode;
}
