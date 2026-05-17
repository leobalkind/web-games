import { Container, Graphics, Text } from 'pixi.js';
import { COLORS } from './colors.js';
import { AUDIENCE_SIGNS, rndPick } from './funnyText.js';

// Tiny pixel pugs lined around the perimeter that hold up signs and react.
export class Audience {
  constructor(world, count = 80) {
    this.container = new Container();
    this.container.label = 'audience';
    world.container.addChild(this.container);
    this.pugs = [];

    const { width, height } = world.bounds;
    const spacing = (width * 2 + height * 2) / count;
    let traveled = 0;
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0;
      let pos = i * spacing;
      const w = width, h = height;
      const perim = 2 * w + 2 * h;
      pos = pos % perim;
      if (pos < w) { x = pos; y = -22; }
      else if (pos < w + h) { x = w + 18; y = pos - w; }
      else if (pos < 2 * w + h) { x = w - (pos - w - h); y = h + 18; }
      else { x = -22; y = h - (pos - 2 * w - h); }
      this._makePug(x, y, i);
    }
  }

  _makePug(x, y, idx) {
    const c = new Container();
    c.x = x; c.y = y;
    const g = new Graphics();
    // tiny chunky pug body
    const palette = [
      [COLORS.pugCinnamon, COLORS.pugBrown],
      [COLORS.pugCream, COLORS.pugBrown],
      [0x9aa0c1, 0x5a6a8a],
      [0x6a3a8a, 0x4a2a6a],
    ];
    const [body, ear] = palette[idx % palette.length];
    g.rect(-3, -3, 6, 5).fill(body);
    g.rect(-3, -5, 6, 2).fill(body);
    g.rect(-3, -6, 1, 2).fill(ear);
    g.rect(2, -6, 1, 2).fill(ear);
    g.rect(-2, -4, 1, 1).fill(COLORS.pugBlack);
    g.rect(1, -4, 1, 1).fill(COLORS.pugBlack);
    c.addChild(g);

    // sign
    const signG = new Graphics();
    signG.rect(-7, -16, 14, 8).fill(COLORS.white);
    signG.rect(-7, -16, 14, 8).stroke({ color: COLORS.pugBlack, width: 1 });
    c.addChild(signG);
    const signText = new Text({
      text: rndPick(AUDIENCE_SIGNS),
      style: {
        fill: COLORS.pugBlack,
        fontFamily: 'monospace',
        fontSize: 6,
        fontWeight: 'bold',
      },
    });
    signText.anchor.set(0.5);
    signText.x = 0; signText.y = -12;
    c.addChild(signText);

    this.container.addChild(c);
    this.pugs.push({ c, g, signG, signText, baseY: y, t: Math.random() * Math.PI * 2 });
  }

  // call on kill events to trigger a wave
  cheer() {
    for (const p of this.pugs) {
      p.t = Math.random() * 0.5; // synchronize so they bounce together
      if (Math.random() < 0.4) {
        p.signText.text = rndPick(['BORK!', 'GG', 'WOW', '!!!', 'L', 'W']);
      }
    }
  }

  update(dt) {
    for (const p of this.pugs) {
      p.t += dt * 4;
      const bob = Math.abs(Math.sin(p.t)) * 3;
      p.c.y = p.baseY - bob;
      // occasionally swap sign
      if (Math.random() < 0.001) p.signText.text = rndPick(AUDIENCE_SIGNS);
    }
  }

  // Mark which audience pugs are now in the danger zone (turn into ghosts)
  applyDangerZone(zoneRect) {
    for (const p of this.pugs) {
      const inSafe =
        p.c.x > zoneRect.x &&
        p.c.x < zoneRect.x + zoneRect.w &&
        p.c.y > zoneRect.y &&
        p.c.y < zoneRect.y + zoneRect.h;
      p.c.alpha = inSafe ? 1 : 0.3;
      p.signText.alpha = inSafe ? 1 : 0.3;
    }
  }
}
