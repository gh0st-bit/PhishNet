import { build } from 'esbuild';

await build({
  entryPoints: {
    index: 'server/index.ts',
    worker: 'server/worker.ts',
    'migrate-runtime': 'scripts/migrate-runtime.ts',
    bootstrap: 'scripts/bootstrap.ts',
    'provision-runtime':'scripts/provision-runtime.ts',
    'create-admin': 'scripts/create-admin.ts',
  },
  platform: 'node', packages: 'external', bundle: true, format: 'esm', outdir: 'dist',
});
