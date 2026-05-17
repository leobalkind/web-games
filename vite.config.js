import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages serves from /web-games/ — base path required for assets.
// Use VITE_BASE env to override (e.g. for Vercel/Netlify which serve from /).
const base = process.env.VITE_BASE ?? '/web-games/';

export default defineConfig({
  root: '.',
  base,
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'index.html'),
        borkBattle: resolve(__dirname, 'games/bork-battle/index.html'),
        pugfort: resolve(__dirname, 'games/pugfort/index.html'),
      },
    },
  },
});
