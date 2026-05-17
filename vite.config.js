import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages serves from /web-games/ — base path needed in production.
// Dev server stays on '/' so localhost links work as before.
// Override with VITE_BASE env var for Vercel/Netlify (which serve from /).
export default defineConfig(({ command }) => ({
  root: '.',
  base: process.env.VITE_BASE ?? (command === 'build' ? '/web-games/' : '/'),
  server: {
    port: 5173,
    open: true,
    // Allow public tunneling (cloudflared, ngrok, etc.) to forward to dev server
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'index.html'),
        borkBattle: resolve(__dirname, 'games/bork-battle/index.html'),
        pugfort: resolve(__dirname, 'games/pugfort/index.html'),
        pugSnake: resolve(__dirname, 'games/pug-snake/index.html'),
        boopSnoot: resolve(__dirname, 'games/boop-snoot/index.html'),
      },
    },
  },
}));
