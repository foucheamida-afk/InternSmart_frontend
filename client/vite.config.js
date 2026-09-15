import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Editor/agent tooling writes files atomically through sibling temp
    // directories (e.g. .App.jsx.<pid>.<uuid>.tmpdir/App.jsx.tmp). Vite's file
    // watcher crashes with EBUSY if one is locked mid-write, which repeatedly
    // killed the dev server. These are never real source files, so ignore them.
    watch: {
      // Editor/agent tooling writes transient files into the project while saving
      // (.X.jsx.<pid>.<uuid>.tmpdir/, _tmpLint2.json, *.tmp). Vite's NATIVE watcher
      // throws EBUSY whenever one of those is locked mid-write, and that error kills
      // the whole dev server - it has happened three times now, on three different
      // files. Two defences: ignore those names, and use polling so the native
      // watcher (the thing that throws) is not used at all.
      ignored: ['**/.*tmpdir*/**', '**/.*tmpdir*', '**/_tmp*', '**/*.tmp', '**/*.tmp.*'],
      usePolling: true,
      interval: 400,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
});
