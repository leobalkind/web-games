// Centralized input for PUGFORT — WASD + mouse + build hotkeys.
// Optional touchControls overlays virtual joysticks for mobile.
export class Input {
  constructor(canvas, touchControls = null, gamepad = null) {
    this.canvas = canvas;
    this.touch = touchControls;
    this.gp = gamepad;
    this._touchPrevFiring = false;
    this.codes = new Set();
    this.mouse = { x: 0, y: 0, screenX: 0, screenY: 0 };
    this.mouseDown = false;
    this._justClicked = false;
    this._bJustPressed = false;
    this._oneJustPressed = false;
    this._twoJustPressed = false;
    this._threeJustPressed = false;
    this._fourJustPressed = false;
    this._fiveJustPressed = false;
    this._sixJustPressed = false;
    this._sevenJustPressed = false;
    this._eightJustPressed = false;
    this._nineJustPressed = false;
    this._zeroJustPressed = false;
    this._qJustPressed = false;
    this._eJustPressed = false;
    this._rJustPressed = false;
    this._escJustPressed = false;

    const onDown = (e) => {
      if (['KeyW','KeyA','KeyS','KeyD','Space','KeyB','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0',
           'KeyR','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyB' && !this.codes.has('KeyB')) this._bJustPressed = true;
      if (e.code === 'Digit1' && !this.codes.has('Digit1')) this._oneJustPressed = true;
      if (e.code === 'Digit2' && !this.codes.has('Digit2')) this._twoJustPressed = true;
      if (e.code === 'Digit3' && !this.codes.has('Digit3')) this._threeJustPressed = true;
      if (e.code === 'Digit4' && !this.codes.has('Digit4')) this._fourJustPressed = true;
      if (e.code === 'Digit5' && !this.codes.has('Digit5')) this._fiveJustPressed = true;
      if (e.code === 'Digit6' && !this.codes.has('Digit6')) this._sixJustPressed = true;
      if (e.code === 'Digit7' && !this.codes.has('Digit7')) this._sevenJustPressed = true;
      if (e.code === 'Digit8' && !this.codes.has('Digit8')) this._eightJustPressed = true;
      if (e.code === 'Digit9' && !this.codes.has('Digit9')) this._nineJustPressed = true;
      if (e.code === 'Digit0' && !this.codes.has('Digit0')) this._zeroJustPressed = true;
      if (e.code === 'KeyQ' && !this.codes.has('KeyQ')) this._qJustPressed = true;
      if (e.code === 'KeyE' && !this.codes.has('KeyE')) this._eJustPressed = true;
      if (e.code === 'KeyR' && !this.codes.has('KeyR')) this._rJustPressed = true;
      if (e.code === 'Escape') this._escJustPressed = true;
      this.codes.add(e.code);
    };
    const onUp = (e) => { this.codes.delete(e.code); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.screenX = e.clientX - rect.left;
        this.mouse.screenY = e.clientY - rect.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouseDown = true; this._justClicked = true; }
      });
    }
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.codes.has('KeyW') || this.codes.has('ArrowUp'))    y -= 1;
    if (this.codes.has('KeyS') || this.codes.has('ArrowDown'))  y += 1;
    if (this.codes.has('KeyA') || this.codes.has('ArrowLeft'))  x -= 1;
    if (this.codes.has('KeyD') || this.codes.has('ArrowRight')) x += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    if (this.gp?.connected && (this.gp.move.x || this.gp.move.y)) return this.gp.move;
    if (this.touch?.enabled) return this.touch.getMove();
    return { x: 0, y: 0 };
  }

  touchAim() {
    if (this.gp?.connected && this.gp.aim) return this.gp.aim;
    return this.touch?.enabled ? this.touch.getAim() : null;
  }
  isFiring() {
    if (this.mouseDown) return true;
    if (this.gp?.connected && this.gp.firing) return true;
    return this.touch?.enabled && this.touch.isFiring();
  }

  sprintDown() { return this.codes.has('ShiftLeft') || this.codes.has('ShiftRight'); }

  takeClick() {
    if (this._justClicked) { this._justClicked = false; return true; }
    // Touch fire is a held state; convert rising edge to a "click"
    if (this.touch?.enabled) {
      const firing = this.touch.isFiring();
      if (firing && !this._touchPrevFiring) {
        this._touchPrevFiring = true;
        return true;
      }
      if (!firing) this._touchPrevFiring = false;
    }
    return false;
  }
  takeBPress() {
    if (this._bJustPressed) { this._bJustPressed = false; return true; }
    return this.touch?.enabled && this.touch.consumeAbilityPressed();
  }
  takeOnePress() { const v = this._oneJustPressed; this._oneJustPressed = false; return v; }
  takeTwoPress() { const v = this._twoJustPressed; this._twoJustPressed = false; return v; }
  takeThreePress() { const v = this._threeJustPressed; this._threeJustPressed = false; return v; }
  takeFourPress() { const v = this._fourJustPressed; this._fourJustPressed = false; return v; }
  takeFivePress() { const v = this._fiveJustPressed; this._fiveJustPressed = false; return v; }
  takeSixPress() { const v = this._sixJustPressed; this._sixJustPressed = false; return v; }
  takeSevenPress() { const v = this._sevenJustPressed; this._sevenJustPressed = false; return v; }
  takeEightPress() { const v = this._eightJustPressed; this._eightJustPressed = false; return v; }
  takeNinePress()  { const v = this._nineJustPressed;  this._nineJustPressed  = false; return v; }
  takeZeroPress()  { const v = this._zeroJustPressed;  this._zeroJustPressed  = false; return v; }
  takeQPress() { const v = this._qJustPressed; this._qJustPressed = false; return v; }
  takeEPress() { const v = this._eJustPressed; this._eJustPressed = false; return v; }
  takeRPress() { const v = this._rJustPressed; this._rJustPressed = false; return v; }
  takeEscPress() { const v = this._escJustPressed; this._escJustPressed = false; return v; }

  postFrame() {
    this._justClicked = false;
    this._bJustPressed = false;
    this._oneJustPressed = false;
    this._twoJustPressed = false;
    this._threeJustPressed = false;
    this._fourJustPressed = false;
    this._fiveJustPressed = false;
    this._sixJustPressed = false;
    this._sevenJustPressed = false;
    this._eightJustPressed = false;
    this._nineJustPressed = false;
    this._zeroJustPressed = false;
    this._qJustPressed = false;
    this._eJustPressed = false;
    this._rJustPressed = false;
    this._escJustPressed = false;
  }
}
