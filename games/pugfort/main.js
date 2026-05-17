import { Game } from './src/Game.js';

const root = document.getElementById('game-root');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const restartBtn = document.getElementById('end-restart');

const game = new Game();

function hide(el) { el.hidden = true; el.classList.add('is-hidden'); }
function show(el) { el.hidden = false; el.classList.remove('is-hidden'); }

async function play() {
  hide(startOverlay);
  hide(endOverlay);
  await game.start();
}

// Async boot wrapped in an IIFE so production build doesn't need top-level await
(async () => {
  await game.init(root);
  startBtn.addEventListener('click', play);
  restartBtn.addEventListener('click', play);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (!startOverlay.classList.contains('is-hidden') || !endOverlay.classList.contains('is-hidden'))) {
      play();
    }
  });
})();
