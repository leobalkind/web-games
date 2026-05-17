// Lightweight Gamepad API wrapper — exposes move/aim/fire/ability state.
// Standard mapping: left stick (axes 0/1) = move, right stick (2/3) = aim+fire,
// A (button 0) = fire/confirm, B (button 1) = ability/cancel, Start (9) = pause.
const DEAD = 0.18;

class GamepadAdapter {
  constructor() {
    this.connected = false;
    this._lastFire = false;
    this._lastAbility = false;
    this._lastPause = false;
    this.justAbility = false;
    this.justPause = false;
    window.addEventListener('gamepadconnected', (e) => {
      this.connected = true;
      console.info('[Gamepad] connected:', e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = false;
    });
  }
  // Call once per frame
  pump() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const g of gps) { if (g && g.connected) { gp = g; break; } }
    if (!gp) {
      this.move = { x: 0, y: 0 };
      this.aim = null;
      this.firing = false;
      this.abilityDown = false;
      this.justAbility = false;
      this.justPause = false;
      return;
    }
    // Move from left stick
    const lx = gp.axes[0] || 0;
    const ly = gp.axes[1] || 0;
    const lmag = Math.hypot(lx, ly);
    if (lmag > DEAD) {
      const s = (lmag - DEAD) / (1 - DEAD);
      this.move = { x: (lx / lmag) * s, y: (ly / lmag) * s };
    } else {
      this.move = { x: 0, y: 0 };
    }
    // Aim from right stick
    const rx = gp.axes[2] || 0;
    const ry = gp.axes[3] || 0;
    const rmag = Math.hypot(rx, ry);
    if (rmag > DEAD) {
      this.aim = { x: rx / rmag, y: ry / rmag };
      this.firing = true; // deflecting = firing
    } else {
      this.aim = null;
      this.firing = false;
    }
    // Buttons
    const aDown = gp.buttons[0]?.pressed;
    const bDown = gp.buttons[1]?.pressed;
    const startDown = gp.buttons[9]?.pressed;
    if (aDown) this.firing = true; // A also fires
    // Ability — rising edge
    const abilityNow = !!(gp.buttons[1]?.pressed || gp.buttons[2]?.pressed);
    this.abilityDown = abilityNow;
    this.justAbility = abilityNow && !this._lastAbility;
    this._lastAbility = abilityNow;
    // Pause — rising edge
    const pauseNow = !!startDown;
    this.justPause = pauseNow && !this._lastPause;
    this._lastPause = pauseNow;
  }
}

const _gp = new GamepadAdapter();
export function getGamepad() { return _gp; }
