import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const versionFile = JSON.parse(
  readFileSync(fileURLToPath(new URL('./version.json', import.meta.url)), 'utf-8'),
) as { versionName: string; versionCode: number };

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(versionFile.versionName),
    __APP_VERSION_CODE__: versionFile.versionCode,
  },
  build: {
    outDir: 'dist',
  },
});
