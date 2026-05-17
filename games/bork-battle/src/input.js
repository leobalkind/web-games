// Centralized input. Tracks WASD, space, E, mouse position, mouse buttons.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, screenX: 0, screenY: 0 };
    this.mouseDown = false;
    this._spaceJustReleased = false;
    this._spaceDown = false;
    this._eJustPressed = false;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const isSpace = e.code === 'Space' || k === ' ';
      if (['w','a','s','d','e','m','b'].includes(k) || isSpace) e.preventDefault();
      if (isSpace) {
        if (!this._spaceDown) this._spaceJustPressed = true;
        this._spaceDown = true;
      }
      if (k === 'e' && !this.keys.has('e')) {
        this._eJustPressed = true;
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      const isSpace = e.code === 'Space' || k === ' ';
      if (isSpace) {
        this._spaceJustReleased = true;
        this._spaceDown = false;
      }
      this.keys.delete(k);
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.screenX = e.clientX - rect.left;
      this.mouse.screenY = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Movement direction from WASD as normalized vector
  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('w')) y -= 1;
    if (this.keys.has('s')) y += 1;
    if (this.keys.has('a')) x -= 1;
    if (this.keys.has('d')) x += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  // Call once per frame after reading
  postUpdate() {
    this._spaceJustReleased = false;
    this._spaceJustPressed = false;
    this._eJustPressed = false;
  }

  spaceDown() { return this._spaceDown; }
  spaceJustReleased() { return this._spaceJustReleased; }
  spaceJustPressed() { return this._spaceJustPressed; }
  eJustPressed() { return this._eJustPressed; }
}
