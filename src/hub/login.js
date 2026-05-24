// =============================================================================
// HUB LOGIN OVERLAY + PROFILE QUICK-SWITCH + "MY DATA" MODAL
//
// Builds the full-screen login experience that appears BEFORE the hub becomes
// interactive on first visit (or after the player explicitly logs out and
// reloads). Also wires up the quick-switch dropdown on the footer profile chip
// and renders the rich "MY DATA" stats modal.
//
// This module is the public face of src/shared/profile.js — every visible
// piece of the account system funnels through here. The plain Profile modal
// stays as a fallback for power users (export / import / PIN management).
// =============================================================================

import {
  listProfiles,
  getActive,
  setActive,
  setActiveCloud,
  touchCloudSync,
  forgetCloudProfile,
  getProfileType,
  createProfile,
  deleteProfile,
  verifyPin,
  exportProfile,
  importProfile,
  onChange,
  profileColor,
  profileInitials,
  profileGamesPlayed,
} from '../shared/profile.js';
import * as cloudSync from '../shared/cloudSync.js';

// -------- tiny helpers ------------------------------------------------------
const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of (Array.isArray(children) ? children : [children])) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtWhen(ts) {
  if (!ts || typeof ts !== 'number') return '—';
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const t = new Date(d); t.setHours(0,0,0,0);
  const diffDays = Math.round((today - t) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return diffDays + 'd ago';
  if (diffDays < 30) return Math.floor(diffDays / 7) + 'w ago';
  return `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

// =============================================================================
// 1) LOGIN OVERLAY (first-visit / no-active-profile)
// =============================================================================

const LOGIN_ID = 'login-overlay';
const GUEST_KEY = 'wg:login:guest';  // remember "play as guest" choice

let _loginResolved = false;
function _markLoginResolved() {
  _loginResolved = true;
  document.body.classList.remove('login-locked');
  const ov = $(LOGIN_ID);
  if (ov) {
    ov.classList.add('is-leaving');
    setTimeout(() => { ov.hidden = true; ov.classList.remove('is-leaving'); }, 540);
  }
}

function buildLoginOverlayDom() {
  if ($(LOGIN_ID)) return $(LOGIN_ID);
  const cloudOn = cloudSync.isCloudEnabled();
  const ov = el('div', { id: LOGIN_ID, class: 'login-ov', 'aria-modal': 'true', role: 'dialog' });
  ov.innerHTML = `
    <div class="login-ov__scanlines" aria-hidden="true"></div>
    <div class="login-ov__vignette" aria-hidden="true"></div>
    <div class="login-ov__panel">
      <div class="login-ov__crt" aria-hidden="true">
        <span class="login-ov__crt-dot" style="background:#5ef38c"></span>
        <span class="login-ov__crt-label">WEBGAMES OS · v1.4</span>
      </div>
      <h1 class="login-ov__title">WELCOME</h1>
      <p class="login-ov__sub">PICK A PROFILE — saved locally on this device</p>

      ${cloudOn ? `
        <div class="login-ov__tabs" role="tablist">
          <button id="login-ov-tab-local" class="login-ov__tab is-active" role="tab" aria-selected="true" type="button">LOCAL</button>
          <button id="login-ov-tab-cloud" class="login-ov__tab" role="tab" aria-selected="false" type="button">CLOUD ACCOUNT</button>
        </div>
        <div class="login-ov__divider" aria-hidden="true"></div>
      ` : ''}

      <section id="login-ov-pane-local" class="login-ov__pane" role="tabpanel">
        <div id="login-ov-list" class="login-ov__list" role="list"></div>

        <div id="login-ov-create" class="login-ov__create" hidden>
          <h3 class="login-ov__create-title">NEW PROFILE</h3>
          <input id="login-ov-name" type="text" maxlength="24" placeholder="PLAYER NAME" autocomplete="off" />
          <input id="login-ov-pin" type="password" maxlength="6" inputmode="numeric" placeholder="PIN (OPTIONAL)" autocomplete="new-password" />
          <div class="login-ov__create-actions">
            <button id="login-ov-create-cancel" type="button" class="login-ov__btn login-ov__btn--ghost">CANCEL</button>
            <button id="login-ov-create-go" type="button" class="login-ov__btn login-ov__btn--primary">CREATE & PLAY</button>
          </div>
          <div id="login-ov-err" class="login-ov__err" hidden></div>
        </div>

        <button id="login-ov-new" type="button" class="login-ov__big-btn">
          <span class="login-ov__plus">+</span> CREATE NEW PROFILE
        </button>

        <button id="login-ov-guest" type="button" class="login-ov__guest">
          Play as GUEST (no save sync)
        </button>
      </section>

      ${cloudOn ? `
      <section id="login-ov-pane-cloud" class="login-ov__pane" role="tabpanel" hidden>
        <h3 class="login-ov__create-title">CLOUD ACCOUNT</h3>
        <p class="login-ov__sub" style="margin:4px 0 12px;">Cross-device sync via Supabase. Email + password.</p>
        <input id="login-ov-c-email" type="email" placeholder="EMAIL" autocomplete="email" />
        <input id="login-ov-c-pass" type="password" placeholder="PASSWORD" autocomplete="current-password" />
        <input id="login-ov-c-name" type="text" maxlength="24" placeholder="DISPLAY NAME (NEW ACCOUNTS ONLY)" autocomplete="off" />
        <div class="login-ov__cloud-actions">
          <button id="login-ov-c-signin" type="button" class="login-ov__btn login-ov__btn--primary">SIGN IN</button>
          <button id="login-ov-c-signup" type="button" class="login-ov__btn login-ov__btn--ghost">CREATE ACCOUNT</button>
        </div>
        <button id="login-ov-c-forgot" type="button" class="login-ov__guest" style="margin-top:4px;">FORGOT PASSWORD</button>
        <button id="login-ov-c-upgrade" type="button" class="login-ov__big-btn" hidden>
          <span class="login-ov__plus">↑</span> UPGRADE LOCAL PROFILE TO CLOUD
        </button>
        <div id="login-ov-c-msg" class="login-ov__err" hidden></div>
      </section>
      ` : ''}

      <div class="login-ov__footnote">
        ${cloudOn
          ? 'LOCAL profiles stay on this device. CLOUD accounts sync across devices.'
          : '100% LOCAL · NO ACCOUNT · NO EMAIL · NO TRACKING'}
      </div>
      ${!cloudOn ? `
        <div class="login-ov__hint">
          Cloud sync available — see <span style="color:#4cc9f0;">SUPABASE_SETUP.md</span> to enable cross-device saves
        </div>
      ` : ''}
    </div>
  `;
  document.body.appendChild(ov);
  return ov;
}

function renderLoginList() {
  const list = $('login-ov-list');
  if (!list) return;
  const profiles = listProfiles();
  if (!profiles.length) {
    list.innerHTML = '<div class="login-ov__empty">No profiles yet — create one or play as guest.</div>';
    return;
  }
  list.innerHTML = '';
  for (const p of profiles) {
    const played = profileGamesPlayed(p.id);
    const isCloud = p.type === 'cloud';
    const tile = el('div', { class: 'login-ov__tile' + (isCloud ? ' is-cloud' : ''), role: 'listitem', tabindex: '0', 'data-id': p.id });
    tile.innerHTML = `
      <div class="login-ov__avatar" style="background:${profileColor(p.id)}">
        <span class="login-ov__avatar-initials">${escapeHtml(profileInitials(p.name))}</span>
      </div>
      <div class="login-ov__tile-body">
        <div class="login-ov__tile-name">${escapeHtml(p.name)}${isCloud ? ' <span class="login-ov__cloud">☁ CLOUD</span>' : (p.pin ? ' <span class="login-ov__lock">LOCKED</span>' : '')}</div>
        <div class="login-ov__tile-meta">${isCloud ? escapeHtml(p.email || '') : (played + ' game' + (played === 1 ? '' : 's') + ' played')}</div>
      </div>
      ${p.pin && !isCloud ? `
        <div class="login-ov__pin-row" hidden>
          <input class="login-ov__pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" />
          <button class="login-ov__pin-go" type="button">GO</button>
        </div>` : ''}
    `;
    tile.addEventListener('click', () => {
      if (isCloud) {
        // Cloud profile tile = jump to CLOUD tab pre-filled with email,
        // user must re-enter password (we never persist passwords).
        const tabCloud = $('login-ov-tab-cloud');
        if (tabCloud) tabCloud.click();
        const emailInp = $('login-ov-c-email');
        if (emailInp) { emailInp.value = p.email || ''; emailInp.focus(); }
        const passInp = $('login-ov-c-pass');
        if (passInp) passInp.focus();
        return;
      }
      if (p.pin) {
        // Expand PIN row
        const row = tile.querySelector('.login-ov__pin-row');
        if (row) {
          row.hidden = false;
          const inp = row.querySelector('.login-ov__pin');
          if (inp) inp.focus();
        }
      } else {
        try { setActive(p.id); _markLoginResolved(); } catch (e) { showErr(e.message); }
      }
    });
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); }
    });
    if (p.pin && !isCloud) {
      const row = tile.querySelector('.login-ov__pin-row');
      const inp = row.querySelector('.login-ov__pin');
      const go = row.querySelector('.login-ov__pin-go');
      const submit = () => {
        if (!verifyPin(p.id, inp.value)) {
          inp.classList.add('is-wrong');
          showErr('Wrong PIN for ' + p.name);
          inp.select();
          return;
        }
        try { setActive(p.id); _markLoginResolved(); } catch (e) { showErr(e.message); }
      };
      go.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
    }
    list.appendChild(tile);
  }
}

function showErr(msg) {
  const el2 = $('login-ov-err');
  if (!el2) return;
  el2.textContent = msg;
  el2.hidden = !msg;
}

function bindLoginOverlayEvents() {
  $('login-ov-new')?.addEventListener('click', () => {
    $('login-ov-create').hidden = false;
    $('login-ov-name')?.focus();
  });
  $('login-ov-create-cancel')?.addEventListener('click', () => {
    $('login-ov-create').hidden = true;
    showErr('');
  });
  $('login-ov-create-go')?.addEventListener('click', () => {
    const name = $('login-ov-name')?.value || '';
    const pin = $('login-ov-pin')?.value || '';
    try {
      createProfile(name, pin || null);
      _markLoginResolved();
    } catch (e) {
      showErr(e.message || 'Could not create profile');
    }
  });
  $('login-ov-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('login-ov-pin')?.focus(); }
  });
  $('login-ov-pin')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('login-ov-create-go')?.click(); }
  });
  $('login-ov-guest')?.addEventListener('click', () => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch {}
    // Ensure no active profile so guest mode is honored downstream
    setActive(null);
    _markLoginResolved();
  });

  // ---- CLOUD tab wiring (only present when isCloudEnabled()) -----
  if (!cloudSync.isCloudEnabled()) return;
  const tabLocal = $('login-ov-tab-local');
  const tabCloud = $('login-ov-tab-cloud');
  const paneLocal = $('login-ov-pane-local');
  const paneCloud = $('login-ov-pane-cloud');
  function showTab(which) {
    const isCloud = which === 'cloud';
    tabLocal?.classList.toggle('is-active', !isCloud);
    tabCloud?.classList.toggle('is-active', isCloud);
    tabLocal?.setAttribute('aria-selected', String(!isCloud));
    tabCloud?.setAttribute('aria-selected', String(isCloud));
    if (paneLocal) paneLocal.hidden = isCloud;
    if (paneCloud) paneCloud.hidden = !isCloud;
    // Show "upgrade" button only when an active local profile exists.
    const upgrade = $('login-ov-c-upgrade');
    if (upgrade) {
      const a = getActive();
      upgrade.hidden = !(isCloud && a && getProfileType(a.id) === 'local');
    }
  }
  tabLocal?.addEventListener('click', () => showTab('local'));
  tabCloud?.addEventListener('click', () => showTab('cloud'));

  function showCloudMsg(msg, ok) {
    const el2 = $('login-ov-c-msg');
    if (!el2) return;
    el2.textContent = msg || '';
    el2.hidden = !msg;
    el2.style.color = ok ? '#5ef38c' : '';
    el2.style.background = ok ? 'rgba(94,243,140,0.1)' : '';
  }

  async function applyCloudSignedIn(user) {
    try {
      const name = user?.user_metadata?.display_name || (user?.email || '').split('@')[0] || 'CLOUD';
      setActiveCloud(user.id, user.email || '', name);
      // Pull profile data and hydrate local cache (best-effort).
      const { data, error } = await cloudSync.pullProfile(user.id);
      if (!error && data) {
        const prefix = 'wg:c:' + user.id + ':';
        try {
          for (const row of data.highScores || []) {
            localStorage.setItem(prefix + 'hs:' + row.game_id, JSON.stringify(row.score || {}));
          }
          // Group achievements by game
          const achByGame = new Map();
          for (const row of data.achievements || []) {
            if (!achByGame.has(row.game_id)) achByGame.set(row.game_id, []);
            achByGame.get(row.game_id).push(row.achievement_id);
          }
          for (const [gid, ids] of achByGame.entries()) {
            localStorage.setItem(prefix + 'ach:' + gid, JSON.stringify(ids));
          }
          // Group discoveries by game (mutation lab combos -> array of keys)
          const discByGame = new Map();
          for (const row of data.discoveries || []) {
            if (!discByGame.has(row.game_id)) discByGame.set(row.game_id, []);
            discByGame.get(row.game_id).push(row.discovery_key);
          }
          for (const [gid, keys] of discByGame.entries()) {
            // Heuristic: mutation-lab stores combos under :discoveredCombos
            if (gid === 'mutation-lab') {
              localStorage.setItem(prefix + 'mutation-lab:discoveredCombos', JSON.stringify(keys));
            } else {
              localStorage.setItem(prefix + 'codex:' + gid, JSON.stringify(keys));
            }
          }
          touchCloudSync(user.id);
        } catch {}
      }
      _markLoginResolved();
    } catch (e) {
      showCloudMsg(e.message || 'Sign-in failed');
    }
  }

  $('login-ov-c-signin')?.addEventListener('click', async () => {
    const email = $('login-ov-c-email')?.value?.trim() || '';
    const pass = $('login-ov-c-pass')?.value || '';
    if (!email || !pass) { showCloudMsg('Email and password required'); return; }
    showCloudMsg('Signing in…', true);
    const { user, error } = await cloudSync.signIn(email, pass);
    if (error) { showCloudMsg(error.message || 'Sign-in failed'); return; }
    if (!user) { showCloudMsg('Sign-in returned no user'); return; }
    await applyCloudSignedIn(user);
  });
  $('login-ov-c-signup')?.addEventListener('click', async () => {
    const email = $('login-ov-c-email')?.value?.trim() || '';
    const pass = $('login-ov-c-pass')?.value || '';
    const name = $('login-ov-c-name')?.value?.trim() || '';
    if (!email || !pass) { showCloudMsg('Email and password required'); return; }
    showCloudMsg('Creating account…', true);
    const { user, error } = await cloudSync.signUp(email, pass, name);
    if (error) { showCloudMsg(error.message || 'Sign-up failed'); return; }
    if (!user) { showCloudMsg('Check your inbox to confirm, then sign in.', true); return; }
    await applyCloudSignedIn(user);
  });
  $('login-ov-c-forgot')?.addEventListener('click', async () => {
    const email = $('login-ov-c-email')?.value?.trim() || '';
    if (!email) { showCloudMsg('Enter your email first'); return; }
    const { error } = await cloudSync.sendPasswordReset(email);
    if (error) { showCloudMsg(error.message || 'Reset failed'); return; }
    showCloudMsg('Password reset email sent.', true);
  });
  $('login-ov-c-upgrade')?.addEventListener('click', async () => {
    const a = getActive();
    if (!a || getProfileType(a.id) !== 'local') {
      showCloudMsg('No local profile is active');
      return;
    }
    const email = $('login-ov-c-email')?.value?.trim() || '';
    const pass = $('login-ov-c-pass')?.value || '';
    if (!email || !pass) { showCloudMsg('Email and password required to upgrade'); return; }
    showCloudMsg('Creating cloud account…', true);
    const { user, error } = await cloudSync.signUp(email, pass, a.name);
    if (error) { showCloudMsg(error.message || 'Upgrade failed'); return; }
    if (!user) { showCloudMsg('Confirm your email then sign in to finish upgrade.', true); return; }
    showCloudMsg('Uploading your saves…', true);
    await cloudSync.migrateLocalToCloud(user.id, a.id);
    await applyCloudSignedIn(user);
  });

  // Pre-fill: if a previous cloud session is still valid, jump straight to it.
  cloudSync.getSession().then(({ user }) => {
    if (user && !_loginResolved) {
      // Don't auto-resolve — just hint by switching tab so the player can click sign-in.
      // (We prefer explicit re-entry for security since password isn't persisted.)
    }
  }).catch(() => {});
}

// Public: decide whether to show the overlay and do so. Idempotent.
export function maybeShowLoginOverlay() {
  const active = getActive();
  // If a profile is already active OR the user previously chose guest, skip.
  if (active) return false;
  let chose_guest = false;
  try { chose_guest = localStorage.getItem(GUEST_KEY) === '1'; } catch {}
  if (chose_guest && listProfiles().length === 0) return false;
  // If they chose guest but profiles exist, we still want to give them the
  // option to log in — but don't FORCE it. Only force on truly first visit.
  if (chose_guest) return false;

  // Lock the body so hub interactions don't sneak through.
  document.body.classList.add('login-locked');
  buildLoginOverlayDom();
  renderLoginList();
  bindLoginOverlayEvents();
  $(LOGIN_ID).hidden = false;
  return true;
}

// Public: from "switch profile" UI, force the login overlay back open.
export function forceShowLoginOverlay() {
  try { localStorage.removeItem(GUEST_KEY); } catch {}
  setActive(null);
  document.body.classList.add('login-locked');
  buildLoginOverlayDom();
  renderLoginList();
  bindLoginOverlayEvents();
  const ov = $(LOGIN_ID);
  if (ov) { ov.hidden = false; ov.classList.remove('is-leaving'); }
  _loginResolved = false;
}

// =============================================================================
// 2) PROFILE CHIP — name + avatar dot + quick-switch dropdown
// =============================================================================

let _dropdownEl = null;
function closeDropdown() {
  if (_dropdownEl) { _dropdownEl.remove(); _dropdownEl = null; }
}
function openDropdown(anchorEl) {
  closeDropdown();
  const profiles = listProfiles();
  const active = getActive();
  const dd = el('div', { class: 'profile-dd', role: 'menu' });
  dd.innerHTML = `
    <div class="profile-dd__hdr">SWITCH PROFILE</div>
  `;
  const inner = el('div', { class: 'profile-dd__items' });
  if (profiles.length === 0) {
    inner.appendChild(el('div', { class: 'profile-dd__empty' }, 'No profiles yet — create one.'));
  } else {
    for (const p of profiles) {
      const isAct = active && active.id === p.id;
      const isCloud = p.type === 'cloud';
      const it = el('button', {
        type: 'button',
        class: 'profile-dd__item' + (isAct ? ' is-active' : ''),
        role: 'menuitem',
      });
      it.innerHTML = `
        <span class="profile-dd__dot" style="background:${profileColor(p.id)}"></span>
        <span class="profile-dd__name">${escapeHtml(p.name)}</span>
        ${isCloud ? '<span class="profile-dd__lock" style="border-color:#4cc9f0;color:#4cc9f0;">☁ CLOUD</span>' : (p.pin ? '<span class="profile-dd__lock">LOCKED</span>' : '')}
        ${isAct ? '<span class="profile-dd__check">ACTIVE</span>' : ''}
      `;
      it.addEventListener('click', () => {
        closeDropdown();
        if (isAct) return;
        if (isCloud) {
          // Re-auth required — push back to login overlay's cloud tab.
          forceShowLoginOverlay();
          setTimeout(() => {
            const tabCloud = $('login-ov-tab-cloud');
            if (tabCloud) tabCloud.click();
            const emailInp = $('login-ov-c-email');
            if (emailInp) emailInp.value = p.email || '';
            const passInp = $('login-ov-c-pass');
            if (passInp) passInp.focus();
          }, 80);
          return;
        }
        if (p.pin) {
          const entered = prompt('PIN for ' + p.name + ':');
          if (!verifyPin(p.id, entered || '')) { alert('Wrong PIN'); return; }
        }
        try { setActive(p.id); syncProfileChip(); }
        catch (e) { alert(e.message || 'Could not switch'); }
      });
      inner.appendChild(it);
    }
  }
  dd.appendChild(inner);
  const sep = el('div', { class: 'profile-dd__sep' });
  dd.appendChild(sep);
  const manage = el('button', { type: 'button', class: 'profile-dd__manage', role: 'menuitem' },
    'Manage Profiles…');
  manage.addEventListener('click', () => {
    closeDropdown();
    const btn = document.getElementById('profile-btn');
    if (btn) btn.click();
  });
  dd.appendChild(manage);
  const myData = el('button', { type: 'button', class: 'profile-dd__manage', role: 'menuitem' },
    'My Data / Stats');
  myData.addEventListener('click', () => { closeDropdown(); openMyDataModal(); });
  dd.appendChild(myData);
  const logout = el('button', { type: 'button', class: 'profile-dd__manage profile-dd__manage--danger', role: 'menuitem' },
    active ? 'Sign out → login screen' : 'Show login screen');
  logout.addEventListener('click', () => {
    closeDropdown();
    // If the active profile is cloud, also revoke the Supabase session.
    if (active && active.type === 'cloud') {
      try { cloudSync.signOut(); } catch {}
    }
    forceShowLoginOverlay();
  });
  dd.appendChild(logout);

  document.body.appendChild(dd);
  _dropdownEl = dd;
  // Position above the anchor (footer chip) — opens upward.
  const r = anchorEl.getBoundingClientRect();
  const ddRect = dd.getBoundingClientRect();
  let left = r.left + r.width / 2 - ddRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - ddRect.width - 8));
  let top = r.top - ddRect.height - 8;
  if (top < 8) top = r.bottom + 8;  // flip below if no room above
  dd.style.left = left + 'px';
  dd.style.top = top + 'px';

  // close on outside click / escape
  const onDocClick = (e) => {
    if (!dd.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) closeDropdown();
  };
  const onKey = (e) => { if (e.key === 'Escape') closeDropdown(); };
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  }, 0);
  dd.addEventListener('_cleanup', () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  });
  const orig = dd.remove.bind(dd);
  dd.remove = () => { dd.dispatchEvent(new Event('_cleanup')); orig(); };
}

export function syncProfileChip() {
  const chip = $('profile-chip');
  if (!chip) return;
  const active = getActive();
  const name = active ? active.name : 'GUEST';
  const color = active ? profileColor(active.id) : '#8a90b1';
  chip.innerHTML = `
    <span class="profile-chip__dot" style="background:${color}"></span>
    <span class="profile-chip__name">${escapeHtml(name)}</span>
    <span class="profile-chip__chev">▾</span>
  `;
  chip.classList.toggle('is-guest', !active);
  // Make the chip clickable to open quick-switch dropdown.
  if (!chip.dataset.bound) {
    chip.dataset.bound = '1';
    chip.style.cursor = 'pointer';
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', 'Switch profile');
    chip.addEventListener('click', () => {
      if (_dropdownEl) { closeDropdown(); return; }
      openDropdown(chip);
    });
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); }
    });
  }
  // Top-right "signed in as" pill
  syncTopRightPill();
}

function syncTopRightPill() {
  let pill = $('signed-in-pill');
  const active = getActive();
  if (!pill) {
    pill = el('div', { id: 'signed-in-pill', class: 'signed-in-pill' });
    document.body.appendChild(pill);
    pill.addEventListener('click', () => openMyDataModal());
    pill.style.cursor = 'pointer';
    pill.title = 'View your data';
  }
  const color = active ? profileColor(active.id) : '#8a90b1';
  if (active) {
    pill.innerHTML = `
      <span class="signed-in-pill__dot" style="background:${color}"></span>
      <span class="signed-in-pill__lbl">SIGNED IN</span>
      <span class="signed-in-pill__name">${escapeHtml(active.name)}</span>
    `;
    pill.title = 'Signed in as ' + active.name + ' — click for My Data';
  } else {
    pill.innerHTML = `
      <span class="signed-in-pill__dot" style="background:${color}"></span>
      <span class="signed-in-pill__name">GUEST</span>
    `;
    pill.title = 'No profile linked — click to view local data, or use the chip to log in';
  }
}

// =============================================================================
// 3) "MY DATA" MODAL — per-profile high scores + export/import/reset
// =============================================================================

const MYDATA_ID = 'mydata-modal';

function buildMyDataDom() {
  if ($(MYDATA_ID)) return $(MYDATA_ID);
  const m = el('div', { id: MYDATA_ID, class: 'hub-modal', hidden: true });
  m.innerHTML = `
    <div class="hub-modal__panel hub-modal__panel--wide mydata-panel">
      <div class="mydata-header">
        <h2>MY DATA</h2>
        <div id="mydata-profile-card" class="mydata-profile-card"></div>
      </div>
      <div id="mydata-summary" class="mydata-summary"></div>
      <div class="mydata-table-wrap">
        <table class="mydata-table">
          <thead>
            <tr><th>#</th><th>GAME</th><th>BEST</th><th>WHEN</th><th>LAST PLAYED</th></tr>
          </thead>
          <tbody id="mydata-tbody"></tbody>
        </table>
      </div>
      <div id="mydata-empty" class="mydata-empty" hidden>No runs yet — pick a card and start playing.</div>
      <div class="mydata-actions">
        <button id="mydata-export" type="button" class="profile-btn">EXPORT MY DATA</button>
        <button id="mydata-import" type="button" class="profile-btn profile-btn--ghost">IMPORT FROM FILE</button>
        <button id="mydata-reset" type="button" class="profile-btn profile-btn--danger">RESET ALL DATA</button>
        <button id="mydata-pull" type="button" class="profile-btn" hidden>PULL FROM CLOUD</button>
        <button id="mydata-push" type="button" class="profile-btn" hidden>PUSH ALL TO CLOUD</button>
      </div>
      <div id="mydata-msg" class="profile-error" hidden></div>
      <button id="mydata-close" type="button" class="hub-modal__close">DONE</button>
    </div>
  `;
  document.body.appendChild(m);

  // backdrop click
  m.addEventListener('click', (e) => { if (e.target === m) closeMyDataModal(); });
  $('mydata-close').addEventListener('click', closeMyDataModal);

  // Export
  $('mydata-export').addEventListener('click', () => {
    const a = getActive();
    if (!a) { showMyDataMsg('Log in first to export. Guest data isn\'t tied to a profile.'); return; }
    try {
      const json = exportProfile(a.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = a.name.replace(/[^a-z0-9_-]/gi, '_');
      link.href = url; link.download = `webgames-${safeName}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      showMyDataMsg('Exported ' + a.name + '.', true);
    } catch (e) { showMyDataMsg(e.message || 'Export failed'); }
  });
  // Import
  $('mydata-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const p = importProfile(reader.result);
          showMyDataMsg('Imported as "' + p.name + '" and switched to it.', true);
          renderMyDataModal();
          syncProfileChip();
        } catch (e) { showMyDataMsg(e.message || 'Import failed'); }
      };
      reader.readAsText(file);
    });
    input.click();
  });
  // PULL FROM CLOUD — re-fetch from Supabase, overwrite cached copy.
  $('mydata-pull').addEventListener('click', async () => {
    const a = getActive();
    if (!a || getProfileType(a.id) !== 'cloud') return;
    const userId = a.userId || String(a.id).slice(2);
    showMyDataMsg('Pulling from cloud…', true);
    const { data, error } = await cloudSync.pullProfile(userId);
    if (error || !data) { showMyDataMsg(error?.message || 'Pull failed'); return; }
    try {
      const prefix = 'wg:c:' + userId + ':';
      // wipe existing cloud cache for this user
      const toRm = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRm.push(k);
      }
      for (const k of toRm) localStorage.removeItem(k);
      // write fresh
      for (const row of data.highScores || []) {
        localStorage.setItem(prefix + 'hs:' + row.game_id, JSON.stringify(row.score || {}));
      }
      const achByGame = new Map();
      for (const row of data.achievements || []) {
        if (!achByGame.has(row.game_id)) achByGame.set(row.game_id, []);
        achByGame.get(row.game_id).push(row.achievement_id);
      }
      for (const [gid, ids] of achByGame.entries()) {
        localStorage.setItem(prefix + 'ach:' + gid, JSON.stringify(ids));
      }
      const discByGame = new Map();
      for (const row of data.discoveries || []) {
        if (!discByGame.has(row.game_id)) discByGame.set(row.game_id, []);
        discByGame.get(row.game_id).push(row.discovery_key);
      }
      for (const [gid, keys] of discByGame.entries()) {
        if (gid === 'mutation-lab') {
          localStorage.setItem(prefix + 'mutation-lab:discoveredCombos', JSON.stringify(keys));
        } else {
          localStorage.setItem(prefix + 'codex:' + gid, JSON.stringify(keys));
        }
      }
      touchCloudSync(userId);
      showMyDataMsg('Cloud data pulled.', true);
      renderMyDataModal();
    } catch (e) {
      showMyDataMsg(e.message || 'Pull failed');
    }
  });
  // PUSH ALL TO CLOUD — re-upload the local cache to Supabase (overwrites).
  $('mydata-push').addEventListener('click', async () => {
    const a = getActive();
    if (!a || getProfileType(a.id) !== 'cloud') return;
    const userId = a.userId || String(a.id).slice(2);
    showMyDataMsg('Pushing to cloud…', true);
    const prefix = 'wg:c:' + userId + ':';
    const tasks = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const suffix = k.slice(prefix.length);
      const raw = localStorage.getItem(k);
      if (raw == null) continue;
      let m = suffix.match(/^hs:(.+)$/);
      if (m) {
        let parsed; try { parsed = JSON.parse(raw); } catch { continue; }
        tasks.push(cloudSync.pushHighScore(m[1], parsed));
        continue;
      }
      m = suffix.match(/^ach:(.+)$/);
      if (m) {
        let arr; try { arr = JSON.parse(raw); } catch { continue; }
        if (Array.isArray(arr)) for (const aid of arr) tasks.push(cloudSync.pushAchievement(m[1], aid));
        continue;
      }
      m = suffix.match(/^codex:(.+)$/);
      if (m) {
        let parsed; try { parsed = JSON.parse(raw); } catch { continue; }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [dk, dv] of Object.entries(parsed)) tasks.push(cloudSync.pushDiscovery(m[1], dk, dv));
        }
        continue;
      }
      m = suffix.match(/^(.+):discoveredCombos$/);
      if (m) {
        let arr; try { arr = JSON.parse(raw); } catch { continue; }
        if (Array.isArray(arr)) for (const ck of arr) tasks.push(cloudSync.pushDiscovery(m[1], ck, null));
      }
    }
    try {
      await Promise.all(tasks);
      touchCloudSync(userId);
      showMyDataMsg('Local data pushed to cloud.', true);
      renderMyDataModal();
    } catch (e) {
      showMyDataMsg(e.message || 'Push failed');
    }
  });
  // Reset
  $('mydata-reset').addEventListener('click', () => {
    const a = getActive();
    const who = a ? '"' + a.name + '"' : 'GUEST';
    if (!confirm(`Reset ALL save data for ${who}? This wipes every high score, achievement, and setting under this profile. This cannot be undone.`)) return;
    if (a) {
      // Wipe profile-scoped keys (but keep the profile entry alive).
      const prefix = 'wg:p:' + a.id + ':';
      const toRm = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRm.push(k);
      }
      for (const k of toRm) localStorage.removeItem(k);
    } else {
      // Guest: wipe legacy un-prefixed keys
      const toRm = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('wg:hs:') || k.startsWith('wg:ach:') || k.startsWith('wg:codex:')) toRm.push(k);
      }
      for (const k of toRm) localStorage.removeItem(k);
    }
    showMyDataMsg('Reset complete.', true);
    renderMyDataModal();
  });
  return m;
}

function showMyDataMsg(msg, ok) {
  const el2 = $('mydata-msg');
  if (!el2) return;
  el2.textContent = msg;
  el2.hidden = !msg;
  el2.style.color = ok ? '#5ef38c' : '';
  el2.style.background = ok ? 'rgba(94,243,140,0.1)' : '';
  if (ok && msg) setTimeout(() => { if (el2.textContent === msg) { el2.hidden = true; } }, 3500);
}

// Read the GAMES list from the hub grid (single source of truth) and emit
// rows for the My Data table. Each row: { id, title, best, whenTs, lastTs, ach }.
function collectGameRows() {
  const cards = [...document.querySelectorAll('.hub__grid .card[href*="/games/"]')];
  const rows = [];
  for (const card of cards) {
    const m = (card.getAttribute('href') || '').match(/\/games\/([^/]+)/);
    if (!m) continue;
    const id = m[1];
    const title = card.querySelector('.card__title')?.textContent?.trim() || id;
    // Resolve key for current profile (or legacy guest)
    const activeId = (() => { try { return localStorage.getItem('wg:profiles:active'); } catch { return null; } })();
    let key;
    if (!activeId) key = `wg:hs:${id}`;
    else if (String(activeId).startsWith('c_')) key = `wg:c:${String(activeId).slice(2)}:hs:${id}`;
    else key = `wg:p:${activeId}:hs:${id}`;
    let raw = null; try { raw = localStorage.getItem(key); } catch {}
    // Fallback to legacy guest data if profile-scoped is missing but legacy
    // is present (helps freshly-created profiles inherit the migration).
    if (!raw && activeId) { try { raw = localStorage.getItem('wg:hs:' + id); } catch {} }
    let bestText = '—', whenTs = null;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        for (const k of ['score','kills','floor','level','depth','wave','deliveries','cansTotal','haul','money']) {
          if (typeof data[k] === 'number') { bestText = `${k.toUpperCase()} ${data[k]}`; break; }
        }
        if (typeof data.ts === 'number') whenTs = data.ts;
      } catch {}
    }
    // Achievements (profile-scoped first, fallback legacy)
    let achN = 0;
    try {
      let aKey;
      if (!activeId) aKey = `wg:ach:${id}`;
      else if (String(activeId).startsWith('c_')) aKey = `wg:c:${String(activeId).slice(2)}:ach:${id}`;
      else aKey = `wg:p:${activeId}:ach:${id}`;
      let aRaw = localStorage.getItem(aKey);
      if (!aRaw && activeId) aRaw = localStorage.getItem('wg:ach:' + id);
      if (aRaw) { const arr = JSON.parse(aRaw); if (Array.isArray(arr)) achN = arr.length; }
    } catch {}
    rows.push({ id, title, bestText, whenTs, achN, played: !!raw });
  }
  return rows;
}

function renderMyDataModal() {
  const a = getActive();
  const isCloud = !!a && a.type === 'cloud';
  // Toggle PULL/PUSH visibility for cloud profiles
  const pull = $('mydata-pull'); if (pull) pull.hidden = !isCloud;
  const push = $('mydata-push'); if (push) push.hidden = !isCloud;
  // Profile card
  const card = $('mydata-profile-card');
  if (card) {
    const color = a ? profileColor(a.id) : '#8a90b1';
    const initials = a ? profileInitials(a.name) : '?';
    const cloudBadge = isCloud
      ? `<span class="mydata-cloud-badge">☁ SYNCED${a.lastSync ? ' · ' + fmtWhen(a.lastSync) : ''}</span>`
      : '';
    const sub = !a
      ? 'unsaved — no profile linked'
      : isCloud
        ? `${escapeHtml(a.email || '')}`
        : `${a.pin ? 'LOCKED · ' : ''}profile id ${a.id}`;
    card.innerHTML = `
      <div class="mydata-avatar" style="background:${color}">
        <span>${escapeHtml(initials)}</span>
      </div>
      <div class="mydata-profile-body">
        <div class="mydata-profile-name">${escapeHtml(a ? a.name : 'GUEST')} ${cloudBadge}</div>
        <div class="mydata-profile-sub">${sub}</div>
      </div>
    `;
  }
  const rows = collectGameRows();
  // Sort played-first by best score descending, then alpha
  rows.sort((x, y) => {
    if (x.played !== y.played) return x.played ? -1 : 1;
    if (x.whenTs !== y.whenTs) return (y.whenTs || 0) - (x.whenTs || 0);
    return x.title.localeCompare(y.title);
  });
  const played = rows.filter((r) => r.played).length;
  const achTot = rows.reduce((s, r) => s + r.achN, 0);
  const sum = $('mydata-summary');
  if (sum) {
    sum.innerHTML = `
      <div class="mydata-stat"><span class="mydata-stat__big">${played}</span><span class="mydata-stat__lbl">games played</span></div>
      <div class="mydata-stat"><span class="mydata-stat__big">${rows.length}</span><span class="mydata-stat__lbl">total titles</span></div>
      <div class="mydata-stat"><span class="mydata-stat__big">${achTot}</span><span class="mydata-stat__lbl">achievements</span></div>
    `;
  }
  const tbody = $('mydata-tbody');
  const empty = $('mydata-empty');
  if (tbody) {
    tbody.innerHTML = '';
    let rank = 0;
    for (const r of rows) {
      if (r.played) rank++;
      const tr = el('tr', { class: r.played ? 'is-played' : 'is-empty' });
      tr.innerHTML = `
        <td class="mydata-rank">${r.played ? rank : ''}</td>
        <td class="mydata-game">${escapeHtml(r.title)}</td>
        <td class="mydata-best">${r.bestText}${r.achN ? ` · ACH ${r.achN}` : ''}</td>
        <td class="mydata-when">${fmtWhen(r.whenTs)}</td>
        <td class="mydata-last">${r.whenTs ? new Date(r.whenTs).toLocaleDateString() : '—'}</td>
      `;
      tbody.appendChild(tr);
    }
  }
  if (empty) empty.hidden = played > 0;
  showMyDataMsg('');
}

export function openMyDataModal() {
  buildMyDataDom();
  renderMyDataModal();
  const m = $(MYDATA_ID);
  if (m) m.hidden = false;
}
export function closeMyDataModal() {
  const m = $(MYDATA_ID);
  if (m) m.hidden = true;
}

// =============================================================================
// 4) BOOTSTRAP — wire to onChange so chip stays fresh
// =============================================================================

onChange(() => { syncProfileChip(); if ($(MYDATA_ID) && !$(MYDATA_ID).hidden) renderMyDataModal(); });

export function initHubAccounts() {
  // Build chip / pill first so they exist before the login overlay logic runs
  syncProfileChip();
  // Show login overlay if no active profile and player hasn't picked guest
  maybeShowLoginOverlay();
  // ESC closes mydata
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMyDataModal();
  });
}
