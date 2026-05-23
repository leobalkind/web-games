// Idempotent <style> injection shared by speedToggle / gradeCard / killFeed /
// wavePreview. Matches the neon pixel-art aesthetic (gameBase.css palette).
let _injected = false;
export function ensureSharedStyles() {
  if (_injected) return;
  if (document.getElementById('wg-overlay-shared')) { _injected = true; return; }
  const s = document.createElement('style');
  s.id = 'wg-overlay-shared';
  s.textContent = CSS;
  document.head.appendChild(s);
  _injected = true;
}
// Minified CSS. Common font-family is hoisted to a single selector group, and
// the deep-bg purple gradient is hoisted to `--wg-bg`.
const F = "font-family:'Press Start 2P',monospace";
const CSS = ":where(.wg-speed-toggle,.wg-grade,.wg-feed__item,.wg-grade__btn,.wg-wave-preview__inner){" + F + "}"
+ ".wg-speed-toggle{position:fixed;top:calc(12px + env(safe-area-inset-top,0));right:calc(64px + env(safe-area-inset-right,0));z-index:210;min-width:46px;height:40px;padding:0 10px;background:rgba(10,7,22,.85);color:#4cc9f0;border:2px solid #4cc9f0;border-radius:6px;font-size:.6rem;letter-spacing:.06em;cursor:pointer;box-shadow:0 0 12px rgba(76,201,240,.3);-webkit-tap-highlight-color:transparent}"
+ ".wg-speed-toggle:hover{transform:scale(1.06)}"
+ ".wg-speed-toggle[data-speed=\"2\"]{color:#ffd23f;border-color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.35)}"
+ ".wg-speed-toggle[data-speed=\"3\"]{color:#ff3aa1;border-color:#ff3aa1;box-shadow:0 0 14px rgba(255,58,161,.4)}"
+ ".wg-speed-toggle.is-disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.6)}"
+ ".wg-grade{position:fixed;inset:0;z-index:240;display:flex;align-items:center;justify-content:center;background:rgba(10,7,22,.86);backdrop-filter:blur(4px);color:#f8f5ff;opacity:0;transition:opacity .25s;pointer-events:none}"
+ ".wg-grade.is-shown{opacity:1;pointer-events:auto}"
+ ".wg-grade__card{position:relative;background:linear-gradient(135deg,#1a0f2e,#2a1255);border:3px solid #4cc9f0;border-radius:8px;padding:22px 28px 18px;max-width:480px;width:88vw;text-align:center;box-shadow:0 0 0 3px #050310,0 0 40px rgba(76,201,240,.4)}"
+ ".wg-grade__card::before,.wg-grade__card::after{content:'';position:absolute;width:18px;height:18px;border:2px solid #ff3aa1;pointer-events:none}"
+ ".wg-grade__card::before{top:-3px;left:-3px;border-right:0;border-bottom:0}"
+ ".wg-grade__card::after{bottom:-3px;right:-3px;border-left:0;border-top:0}"
+ ".wg-grade__letter{font-size:5rem;line-height:1;margin:0 0 4px;font-weight:700;letter-spacing:.04em;animation:wgGradePop .5s cubic-bezier(.5,2,.5,1)}"
+ "@keyframes wgGradePop{0%{transform:scale(.2);opacity:0}60%{transform:scale(1.15)}to{transform:scale(1);opacity:1}}"
+ ".wg-grade__title{font-size:.9rem;margin:4px 0 2px;letter-spacing:.06em;color:#ffd23f}"
+ ".wg-grade__sub{font-size:.5rem;margin:0 0 10px;color:#c8c0e8;letter-spacing:.04em}"
+ ".wg-grade__score{font-size:.55rem;margin:6px 0 12px;color:#c8c0e8;letter-spacing:.08em}"
+ ".wg-grade__score b{color:#4cc9f0;font-size:.8rem}"
+ ".wg-grade__bars{margin:0 0 14px;text-align:left}"
+ ".wg-grade__row{margin:0 0 8px}"
+ ".wg-grade__row-label{font-size:.45rem;letter-spacing:.06em;color:#c8c0e8;margin-bottom:3px;display:flex;justify-content:space-between}"
+ ".wg-grade__row-label span{color:#f8f5ff}"
+ ".wg-grade__bar{height:10px;background:rgba(0,0,0,.5);border:1px solid #2a2540;border-radius:3px;overflow:hidden}"
+ ".wg-grade__fill{height:100%;width:0;transition:width 1s cubic-bezier(.2,.7,.2,1)}"
+ ".wg-grade__btns{display:flex;gap:10px;justify-content:center;margin-top:8px;flex-wrap:wrap}"
+ ".wg-grade__btn{font-size:.55rem;letter-spacing:.06em;padding:10px 16px;border-radius:6px;cursor:pointer;text-decoration:none;display:inline-block;background:rgba(0,0,0,.4);color:#f8f5ff;border:2px solid #4cc9f0;transition:transform .1s}"
+ ".wg-grade__btn:hover{transform:translateY(-2px)}"
+ ".wg-grade__btn--restart{background:linear-gradient(180deg,#5ef38c,#3aa860);color:#0a1018;border-color:#9ef0b0}"
+ ".wg-feed{position:fixed;top:calc(60px + env(safe-area-inset-top,0));right:calc(12px + env(safe-area-inset-right,0));z-index:205;display:flex;flex-direction:column;gap:3px;align-items:flex-end;pointer-events:none;max-width:60vw}"
+ ".wg-feed__item{font-size:.5rem;letter-spacing:.04em;background:rgba(10,7,22,.78);border-left:3px solid currentColor;padding:5px 9px;border-radius:0 4px 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;opacity:0;transform:translateX(28px);transition:opacity .25s,transform .25s;text-shadow:0 0 6px currentColor}"
+ ".wg-feed__item.is-shown{opacity:1;transform:translateX(0)}"
+ ".wg-feed__item.is-fading{opacity:0;transform:translateX(28px)}"
+ ".wg-wave-preview{--wp-accent:#ff3aa1;position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom,0));transform:translate(-50%,40px);z-index:220;cursor:pointer;opacity:0;transition:opacity .3s,transform .3s cubic-bezier(.3,1.5,.5,1)}"
+ ".wg-wave-preview.is-shown{opacity:1;transform:translate(-50%,0)}"
+ ".wg-wave-preview.is-leaving{opacity:0;transform:translate(-50%,40px);transition:opacity .3s,transform .3s}"
+ ".wg-wave-preview__inner{background:linear-gradient(135deg,#1a0f2e,#2a1255);border:3px solid var(--wp-accent);border-radius:10px;padding:12px 22px;color:#f8f5ff;text-align:center;box-shadow:0 0 0 3px #050310,0 0 40px var(--wp-accent);min-width:280px;max-width:90vw}"
+ ".wg-wave-preview__head{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}"
+ ".wg-wave-preview__tag{font-size:.45rem;color:var(--wp-accent);letter-spacing:.16em;border:1px solid var(--wp-accent);padding:3px 8px;border-radius:3px;background:rgba(255,58,161,.1)}"
+ ".wg-wave-preview__title{font-size:.95rem;letter-spacing:.08em;color:#ffd23f}"
+ ".wg-wave-preview__sub{font-size:.5rem;color:#c8c0e8;letter-spacing:.06em}"
+ ".wg-wave-preview__enemies{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}"
+ ".wg-wave-preview__enemy{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:48px}"
+ ".wg-wave-preview__icon{font-size:1.4rem;line-height:1}"
+ ".wg-wave-preview__count{font-size:.55rem;color:#4cc9f0;letter-spacing:.06em}"
+ ".wg-wave-preview__label{font-size:.4rem;color:#c8c0e8;letter-spacing:.04em}"
+ "@media (max-width:560px){.wg-grade__card{padding:18px 18px 14px}.wg-grade__letter{font-size:3.6rem}.wg-feed__item{font-size:.45rem;padding:4px 7px}.wg-wave-preview__inner{padding:10px 16px;min-width:220px}.wg-wave-preview__title{font-size:.75rem}}";
