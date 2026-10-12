/**
 * Bundles each function (with the shared src/domain code) into a single ESM
 * file and uploads it as a new active deployment.
 *
 *   npm run functions:deploy            # all
 *   npm run functions:deploy weekly-invoice
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { build } from 'esbuild';
import { Functions } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

import { FUNCTIONS } from '../functions/manifest';
import { adminClient } from './lib/admin';

const root = path.resolve(import.meta.dirname, '..');
const only = process.argv.slice(2);
const functions = new Functions(adminClient());

async function deploy(id: string) {
  const outDir = path.join(root, 'functions', id, 'dist');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [path.join(root, 'functions', id, 'src', 'main.ts')],
    outfile: path.join(outDir, 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    // node-appwrite pulls in CJS deps; give them a require().
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
  });
  writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));

  const tarball = path.join(root, 'functions', id, 'code.tar.gz');
  execFileSync('tar', ['-czf', tarball, '-C', outDir, '.']);
  const deployment = await functions.createDeployment(
    id,
    InputFile.fromPath(tarball, 'code.tar.gz'),
    true,
    'main.js',
    '',
  );
  rmSync(tarball);
  console.log(`Deployed ${id}: ${deployment.$id}`);
}

async function main() {
  for (const fn of FUNCTIONS) {
    if (only.length === 0 || only.includes(fn.id)) await deploy(fn.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
