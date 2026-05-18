import { defineConfig } from 'vite';
import { resolve } from 'path';

// Now a user-page repo (leobalkind.github.io) — serves from root '/'.
// Override with VITE_BASE env var for other hosts if needed.
export default defineConfig(({ command }) => ({
  root: '.',
  base: process.env.VITE_BASE ?? '/',
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
        pugHeist: resolve(__dirname, 'games/pug-heist/index.html'),
        pugCafe: resolve(__dirname, 'games/pug-cafe/index.html'),
        rocketPug: resolve(__dirname, 'games/rocket-pug/index.html'),
        dungeonDiggers: resolve(__dirname, 'games/dungeon-diggers/index.html'),
        mutationLab: resolve(__dirname, 'games/mutation-lab/index.html'),
        deliveryPugs: resolve(__dirname, 'games/delivery-pugs/index.html'),
      },
    },
  },
}));
