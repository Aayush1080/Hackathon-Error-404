/*
  MoriSafe public app.
    - reports come from and go to the MoriSafe API (src/api.js); nothing is simulated or kept only on the phone
    - sending a report needs a citizen account (NID + password); reading alerts does not
    - every text is translated (src/i18n.js); report descriptions are translated by the server
    - camera, location and notifications use native features in the Android/iOS app (src/native.js)

  FILE MAP
    1 Helpers · 2 Device storage · 3 State · 4 Translations · 5 Geocoding · 6 Incident rules
    7 Screens (Sign-in, Alerts, Map, Report, Contacts, Profile) · 8 Rendering · 9 Photos · 10 Location & proximity
    11 Accounts · 12 Submit · 13 Sync & notifications · 14 Events · 15 Start-up
*/
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './app.css';
import * as api from './api.js';
import * as native from './native.js';
import { LANG, LANG_CODE } from './i18n.js';
import { CAT_COLOR, catKey, catTile, incidentIcon, placeBadge, placeIcon, placeTile } from './icons.js';
import PLACES from './places.json';

/* ============================================================ 1. HELPERS */
const $ = (s) => document.querySelector(s);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const now = () => {
  const d = new Date();
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
};
const hhmm = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const TOWNS = ['Port Louis', 'Curepipe', 'Quatre Bornes', 'Vacoas-Phoenix', 'Rose Hill', 'Beau Bassin', 'Mahébourg', 'Flic en Flac',
  'Grand Baie', 'Triolet', 'Goodlands', 'Moka', 'Centre de Flacq', 'Saint Pierre', 'Souillac', 'Other'];
const EVS = ['Falling debris', 'Accident', 'Fire', 'Flooding'];
const OTHER = 'Other';
const CATS = [...EVS, OTHER];
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const matchTown = (n) => {
  if (!n) return '';
  const x = norm(n);
  return TOWNS.find((t) => t !== 'Other' && (norm(t).includes(x) || x.includes(norm(t)))) || '';
};
const okImg = (x) => /^(blob:|data:image\/|https?:\/\/)/.test(x || '');
// Line icons (24 px grid) for the interface chrome.
const I = {
  shield: '<path d="M12 2.5l7.5 3v5.5c0 5-3.5 8.6-7.5 10.5-4-1.9-7.5-5.5-7.5-10.5V5.5z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const ico = (name, size = 22, sw = 2.2) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;

/* ============================================================ 2. DEVICE STORAGE
   Sign-in, preferences and pins stay on the phone, encrypted with AES-256-GCM using a non-extractable key
   kept in IndexedDB. Reports are never stored only on the phone. */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u) => {
  u = new Uint8Array(u);
  let s = '';
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
};
const ub = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const seal = async (key, o) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(o)))) };
};
const unseal = async (key, b) => JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub(b.iv) }, key, ub(b.ct))));
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open('morisafe', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('k');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const kv = async (m, k, v) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const o = db.transaction('k', m === 'get' ? 'readonly' : 'readwrite').objectStore('k'), q = m === 'get' ? o.get(k) : o.put(v, k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
};
async function devKey() {
  try {
    let k = await kv('get', 'dk');
    if (!k) {
      k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await kv('put', 'dk', k);
    }
    return k;
  } catch (e) {
    return null;
  }
}
const saved = () => ({ p: S.user, pins: S.pins, seen: [...S.seen].slice(-300), asked: [...S.asked].slice(-300), auth: S.auth });
const persist = async () => {
  try {
    const k = await devKey();
    if (k) localStorage.setItem('morisafe_d', JSON.stringify(await seal(k, saved())));
    else sessionStorage.setItem('morisafe_s', JSON.stringify(saved())); // no secure storage here: keep it for this visit only
  } catch (e) {}
};
async function loadSaved() {
  try {
    const k = await devKey(), raw = localStorage.getItem('morisafe_d');
    const d = k && raw ? await unseal(k, JSON.parse(raw)) : JSON.parse(sessionStorage.getItem('morisafe_s') || 'null');
    if (!d) return;
    const p = (d.p && d.p.pref) || {}, def = S.user.pref;
    S.user = Object.assign(S.user, d.p, {
      pref: Object.assign(def, p, { cats: { ...def.cats, ...p.cats }, a11y: { ...def.a11y, ...p.a11y }, layers: { ...def.layers, ...p.layers } }),
    });
    S.pins = d.pins || [];
    (d.seen || []).forEach((id) => S.seen.add(id));
    (d.asked || []).forEach((id) => S.asked.add(id));
    if (d.auth && d.auth.token && (!d.auth.exp || d.auth.exp * 1000 > Date.now())) { S.auth = d.auth; api.setToken(d.auth.token); }
  } catch (e) {}
}

/* ============================================================ 3. STATE
   Single global object S; the UI is re-rendered from it by draw(). */
const S = {
  tab: 'alerts', toast: '', cat: 'Fire', step: 1, sent: false, sentMerged: false, sending: false, sendPhase: '', sendPct: 0, drawer: false,
  closestId: null, sel: null, selPlace: null, selAsk: false, detail: null, camera: false, facing: 'environment', locating: false, alertNear: false,
  rerr: '', dup: null, geoHint: '', locState: 'idle', loading: true, again: false, loadErr: '', lastSync: 0, skew: 0, clientRef: null,
  mine: null, mineErr: '', deviceSync: '', pushToken: null,
  auth: null, authView: null, authErr: '', authBusy: '', showPw: false,
  prox: null, asked: new Set(), showOrig: new Set(),
  user: {
    welcomed: false,
    pref: {
      lang: 'English', cats: Object.fromEntries(CATS.map((c) => [c, true])), n10: false, loc: 'Ask each time', prox: true,
      a11y: { lg: false, hc: false }, layers: { inc: true, police: true, hospital: true, clinic: false, fire: true },
    },
  },
  pins: [], reports: [], seen: new Set(), seenReady: false, f: {}, fl: { town: 'All', ev: 'All', src: 'all' },
  photoView: null, photo: null, repPos: null, mv: { c: [-20.2, 57.55], z: 10 }, me: null,
};

/* ============================================================ 4. TRANSLATIONS (texts are in src/i18n.js) */
const t = (key, vars = {}) =>
  String((LANG[S.user.pref.lang] || LANG.English)[key] ?? LANG.English[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const langCode = () => LANG_CODE[S.user.pref.lang] || 'en';
const syncLanguage = () => { document.documentElement.lang = langCode(); };
const catName = (c) => (CATS.includes(c) ? t('cat_' + c.replace(' ', '_')) : c);
// "Other" reports carry their own (server-translated) name; preset types use the app's own translation.
const repName = (r) => (r.category === OTHER && r.cat ? r.cat : catName(r.category || r.cat));
const townName = (x) => (x === 'Other' ? t('otherTown') : x === 'All' ? t('all') : x);
const errMsg = (e) => {
  if (e && e.code === 'weak_password') return e.message;
  return e && e.code && LANG.English['e_' + e.code] ? t('e_' + e.code) : (e && e.message) || String(e);
};
const pill = (cls, txt, i = '') => `<span class="pill ${cls}">${i ? `<span aria-hidden="true">${i}</span>` : ''}${txt}</span>`;
const srcPill = (r) => (r.source === 'police' ? pill('p-pol', t('policeVerified'), '🛡') : pill('p-cit', t('citizenShort'), '✓'));
const dist = (r) => {
  if (!S.me) return '';
  const km = distanceKm(S.me, r);
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(km < 10 ? 1 : 0) + ' km';
};

/* ============================================================ 5. REVERSE GEOCODING */
async function revgeo(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`);
    if (!r.ok) throw 0;
    const a = (await r.json()).address || {};
    const town = a.city || a.town || a.village || a.municipality || a.suburb || '';
    const place = [a.road || a.pedestrian || a.footway, a.neighbourhood || a.suburb || a.hamlet, town].filter((x, i, l) => x && l.indexOf(x) === i).join(', ');
    if (place) return { place, town: matchTown(town) || matchTown(a.suburb || a.county || '') || 'Other' };
  } catch (e) {}
  try {
    const j = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`)).json();
    const place = [j.locality, j.city].filter((x, i, l) => x && l.indexOf(x) === i).join(', ');
    if (place) return { place, town: matchTown(j.city || j.locality || '') || 'Other' };
  } catch (e) {}
  return { place: lat.toFixed(5) + ', ' + lng.toFixed(5), town: 'Other' };
}

/* ============================================================ 6. INCIDENT RULES
   The server only sends approved reports published in the last 20 hours. Ages use the server's
   clock (S.skew), not the phone's, so a wrong phone clock cannot hide or revive alerts. */
const HOUR = 3600000, CURRENT_FOR = 20 * HOUR, DIM_AFTER = 12 * HOUR, NEAR_KM = 10, PROX_KM = 0.25;
const serverNow = () => Date.now() + S.skew;
const reportAge = (r) => Math.max(0, serverNow() - r.publishedAt);
const currentReports = () => S.reports.filter((r) => reportAge(r) < CURRENT_FOR);
const isDim = (r) => reportAge(r) >= DIM_AFTER;
const srcOk = (r) => S.fl.src === 'all' || r.source === S.fl.src;
const visible = () => currentReports().filter((r) =>
  (S.fl.town === 'All' || r.town === S.fl.town) &&
  (S.fl.ev === 'All' || (S.fl.ev === OTHER ? !EVS.includes(r.category) : r.category === S.fl.ev)) && srcOk(r) &&
  (!S.alertNear || !S.me || distanceKm(S.me, r) <= NEAR_KM));
const inMauritius = (lat, lng) => {
  lat = Number(lat); lng = Number(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -20.65 && lat <= -19.85 && lng >= 57.18 && lng <= 58.1;
};
const distanceKm = (a, b) => {
  const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
function shouldNotify(r) {
  const p = S.user.pref;
  if (p.cats[catKey(r.category)] === false) return false;
  if (!p.n10) return true;
  return !!(S.me && distanceKm(S.me, r) <= NEAR_KM);
}
const mapIncidents = () => currentReports().filter(srcOk);
const ago = (ms) => (ms < HOUR ? t('minAgo', { n: Math.max(1, Math.round(ms / 60000)) }) : t('hAgo', { n: (ms / HOUR).toFixed(1) }));
const segSrc = () => `<div class="seg" role="group" aria-label="${esc(t('reportedBy'))}">${[['all', 'srcAll'], ['citizen', 'srcCitizen'], ['police', 'srcPolice']]
  .map(([v, k]) => `<button data-src="${v}" aria-pressed="${S.fl.src === v}">${v === 'police' ? '🛡 ' : ''}${t(k)}</button>`).join('')}</div>`;

/* ============================================================ 7a. SCREEN: SIGN IN / CREATE ACCOUNT */
function AuthScreen() {
  const reg = S.authView === 'register', f = S.f, busy = S.authBusy, v = (k) => esc(f[k] || '');
  return `<div class="phone"><main class="scr auth">
<div class="auth-hero"><div class="logo xl">${ico('shield', 34, 2.2)}</div><h1>${t('welcome')}</h1><p>${t('welcomeBody')}</p></div>
<div class="auth-card">
<div class="field"><label for="alang">${ico('globe', 16)} ${t('language')}</label><select id="alang" data-lang>${Object.keys(LANG).map((l) => `<option ${l === S.user.pref.lang ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
<div class="seg" role="group"><button type="button" data-a="authsignin" aria-pressed="${!reg}">${t('signIn')}</button><button type="button" data-a="authreg" aria-pressed="${reg}">${t('createAccount')}</button></div>
<form id="authform" novalidate>
${reg ? `<div class="field"><label for="afn">${t('fullName')}</label><input type="text" id="afn" autocomplete="name" maxlength="80" value="${v('afn')}"></div>` : ''}
<div class="field"><label for="anid">${t('nid')}</label><input type="text" id="anid" autocomplete="username" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="${t('nidPh')}" value="${v('anid')}"><small>${t('nidHelp')}</small></div>
${reg ? `<div class="field"><label for="aph">${t('phoneOpt')}</label><div class="phone-field"><span>+230</span><input type="tel" id="aph" inputmode="numeric" autocomplete="tel-national" maxlength="8" value="${v('aph')}" placeholder="5123 4567"></div></div>` : ''}
<div class="field"><label for="apw">${t('password')}</label><div class="pw-field"><input type="${S.showPw ? 'text' : 'password'}" id="apw" autocomplete="${reg ? 'new-password' : 'current-password'}" maxlength="128" value="${v('apw')}"><button type="button" class="link" data-a="togglepw">${S.showPw ? t('hidePw') : t('showPw')}</button></div>${reg ? `<small>${t('pwHelp')}</small>` : ''}</div>
${reg ? `<div class="field"><label for="apw2">${t('confirmPw')}</label><input type="${S.showPw ? 'text' : 'password'}" id="apw2" autocomplete="new-password" maxlength="128" value="${v('apw2')}"></div>
<label class="chk"><input type="checkbox" id="acon" ${f.acon ? 'checked' : ''}><span>${t('consent')}</span></label>` : ''}
${S.authErr ? `<div class="notice err" role="alert">${esc(S.authErr)}</div>` : ''}
<button class="btn pri" type="submit" ${busy ? 'disabled aria-busy="true"' : ''}>${busy ? esc(busy) : reg ? t('createAccount') : t('signIn')}</button>
</form>
<p class="fine">${ico('lock', 14)} ${t('authPrivacy')}</p>
</div>
<button class="btn ghost" data-a="guest">${S.user.welcomed ? t('cancel') : t('continueGuest')}</button>${S.user.welcomed ? '' : `<p class="fine center">${t('guestNote')}</p>`}
</main></div>`;
}

/* ============================================================ 7b. SCREEN: ALERTS */
function Header() {
  const u = S.auth && S.auth.user;
  const ini = u ? u.full_name.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase() : '';
  const where = S.me ? t('nearYou') : 'Mauritius';
  const when = S.loading && !S.lastSync ? t('loadingAlerts') : S.lastSync ? t('updated', { t: hhmm(S.lastSync) }) : '';
  return `<header class="hdr"><div class="logo">${ico('shield', 21, 2.4)}</div><div class="hdr-t"><h1>MoriSafe</h1><small>${ico('pin', 13, 2.4)} ${esc(where)} · ${esc(when)}${S.loading && S.lastSync ? ' · ' + t('refreshing') : ''}</small></div>
<button class="iconbtn" data-a="refresh" aria-label="${esc(t('refresh'))}">${ico('refresh', 19)}</button><button class="av" data-t="profile" aria-label="${esc(t('profile'))}">${ini ? esc(ini) : ico('user', 19)}</button></header>`;
}
// The emergency notice always sits directly under the MoriSafe title.
const Sos = () => `<section class="sos" aria-label="${esc(t('sosTitle'))}"><b>${ico('alert', 17, 2.4)} ${t('sosTitle')}</b><p>${t('sosBody')}</p>
<div class="calls"><a href="tel:999"><em>999</em>${t('sPolice')}</a><a href="tel:114"><em>114</em>${t('sSamu')}</a><a href="tel:115"><em>115</em>${t('sFire')}</a></div></section>`;
function incCard(r) {
  const dim = isDim(r), d = dist(r);
  const thumb = r.photo && okImg(r.photo) ? `<button class="thumb" data-a="openphoto" data-rid="${esc(r.id)}" aria-label="${esc(t('viewPhoto'))}"><img src="${esc(r.photo)}" alt="" loading="lazy"></button>` : '';
  return `<article class="inc${dim ? ' dim' : ''}" style="--c:${CAT_COLOR[catKey(r.category)]}"><button class="inc-main" data-a="detail" data-id="${esc(r.id)}">${catTile(r.category, 46)}
<span class="inc-t"><b>${esc(repName(r))}</b><span class="m">${esc(r.area || townName(r.town || 'Other'))}</span><span class="m">${ago(reportAge(r))}${d ? ' · ' + d : ''}${r.time ? ' · ' + t('seen', { t: esc(r.time) }) : ''}</span>
<span class="pills">${srcPill(r)}${dim ? pill('p-old', t('over12short'), '◷') : ''}${r.translated ? pill('p-tr', t('translatedAuto').replace(/\.$/, ''), '⇄') : ''}</span></span></button>${thumb}
${r.desc ? `<p class="inc-d">${esc(S.showOrig.has(r.id) && r.descOrig ? r.descOrig : r.desc)}</p>` : ''}</article>`;
}
function Alerts() {
  const v = visible(), act = v.length, nf = (S.fl.town !== 'All') + (S.fl.ev !== 'All');
  const err = S.loadErr ? `<div class="notice err" role="alert">${esc(S.loadErr)}${S.lastSync ? ' ' + t('showingFrom', { t: hhmm(S.lastSync) }) : ''}</div>` : '';
  const list = v.length ? v.map(incCard).join('') : S.loading && !S.lastSync ? '<div class="skel"></div><div class="skel"></div>' :
    `<div class="empty">${catTile('Other', 56).replace('class="tile"', 'class="tile ok"')}<h3>${t('noneTitle')}</h3><p>${S.reports.length ? t('noMatch') : t('noneApproved')}</p><button class="btn pri sm" data-t="report">${ico('plus', 18, 2.8)} ${t('reportHazard')}</button></div>`;
  return `${Header()}${Sos()}${segSrc()}
<div class="sec"><h2>${S.loading && !S.lastSync ? t('loadingAlerts') : act ? (act === 1 ? t('activeOne') : t('activeMany', { n: act })) : t('activeNone')}</h2>
<button class="chip${S.alertNear ? ' on' : ''}" data-a="near4" aria-pressed="${S.alertNear}">${ico('pin', 14, 2.4)} ${NEAR_KM} km</button><button class="chip${nf ? ' on' : ''}" data-a="filters">${ico('filter', 14, 2.4)} ${t('filters')}${nf ? ' · ' + nf : ''}</button></div>
${err}${list}`;
}
function Drawer() {
  const Lb = (arr, k, key, lbl) => arr.map((x) => `<button class="chip" ${key}="${esc(x)}" aria-pressed="${S.fl[k] === x}">${esc(lbl(x))}</button>`).join('');
  return `<button class="scrim" data-a="fclose" aria-label="${t('close')}"></button><aside class="bsheet" aria-label="${t('filters')}"><div class="grab"></div>
<div class="bsheet-h"><h2>${t('filters')}</h2><button class="btn pri sm" data-a="fclose">${t('done')}</button></div>
<h3>${t('reportedBy')}</h3>${segSrc()}
<h3>${t('typeOfIncident')}</h3><div class="chips">${Lb(['All', ...CATS], 'ev', 'data-fe', (x) => (x === 'All' ? t('all') : catName(x)))}</div>
<h3>${t('location')}</h3><div class="chips">${Lb(['All', ...TOWNS], 'town', 'data-ft', townName)}</div></aside>`;
}
function DetailModal() {
  const r = S.detail && S.reports.find((x) => x.id === S.detail);
  if (!r) return '';
  const orig = S.showOrig.has(r.id) && r.descOrig, desc = orig ? r.descOrig : r.desc, d = dist(r);
  return `<button class="scrim" data-a="closedetail" aria-label="${t('close')}"></button><aside class="bsheet detail" role="dialog" aria-label="${esc(repName(r))}"><div class="grab"></div>
${r.photo && okImg(r.photo) ? `<button class="hero" data-a="openphoto" data-rid="${esc(r.id)}" aria-label="${esc(t('viewPhoto'))}"><img src="${esc(r.photo)}" alt="${esc(t('photoAlt'))}"></button>` : ''}
<div class="sheet-h">${catTile(r.category, 46)}<div><h2>${esc(repName(r))}</h2><div class="m">${esc(r.area || r.town || '')}</div></div><button class="iconbtn" data-a="closedetail" aria-label="${t('close')}">${ico('x', 18)}</button></div>
<div class="pills">${srcPill(r)}${isDim(r) ? pill('p-old', t('over12short'), '◷') : ''}</div>
<div class="facts"><span>${ico('clock', 15)} ${r.time ? t('observedAt', { t: esc(r.time) }) : t('timeNotGiven')}</span><span>${ico('bell', 15)} ${t('published', { ago: ago(reportAge(r)) })}</span>${d ? `<span>${ico('pin', 15)} ${t('kmAway', { d })}</span>` : ''}</div>
${desc ? `<p class="desc">${esc(desc)}</p>` : ''}${r.translated ? `<p class="fine">${t('translatedAuto')} <button class="link" data-a="orig" data-id="${esc(r.id)}">${orig ? t('showTranslation') : t('showOriginal')}</button></p>` : ''}
<div class="row2"><button class="btn" data-a="closedetail">${t('close')}</button><button class="btn pri" data-a="seemap" data-id="${esc(r.id)}">${ico('map', 18)} ${t('viewOnMap')}</button></div></aside>`;
}

/* ============================================================ 7c. SCREEN: MAP (full screen) */
const LAYERS = [['inc', 'lyIncidents'], ['police', 'lyPolice'], ['hospital', 'lyHospital'], ['clinic', 'lyClinic'], ['fire', 'lyFire']];
function MapS() {
  const ly = S.user.pref.layers, n = mapIncidents().length;
  const chips = LAYERS.map(([k, key]) => `<button class="chip${ly[k] ? ' on' : ''}" data-layer="${k}" aria-pressed="${!!ly[k]}">${k === 'inc' ? ico('alert', 14, 2.4) : placeBadge(k)} ${t(key)}${k === 'inc' ? ' · ' + n : ''}</button>`).join('');
  return `<div class="mapwrap"><div id="map" role="application" aria-label="${esc(t('mapLabel'))}"></div>
<div class="map-top"><div class="search">${ico('search', 18, 2.4)}<input type="search" id="msearch" placeholder="${esc(t('searchPh'))}" value="${esc(S.f.msearch || '')}" autocomplete="off"><button class="iconbtn sm" data-a="filters2" aria-label="${esc(t('filters'))}">${ico('filter', 16, 2.4)}</button></div>
<div id="msug" class="sug"></div><div class="mchips">${chips}</div></div>
<div class="map-fabs"><button class="fabsm" data-a="locate" aria-label="${esc(t('myLocation'))}">${ico('locate', 20)}</button><button class="fabsm" data-a="closest" aria-label="${esc(t('closest'))}">${ico('star', 20)}</button></div>
${S.loadErr ? `<div class="map-note err">${esc(S.loadErr)}</div>` : S.loading && !S.lastSync ? `<div class="map-note">${t('loadingInc')}</div>` : `<div class="map-note" id="zoomhint" hidden>${t('zoomForServices')}</div>`}
<div id="msheet">${MapSheet()}</div></div>`;
}
function MapSheet() {
  if (S.selPlace) {
    const p = S.selPlace;
    return `<div class="msheet"><div class="grab"></div><div class="sheet-h">${placeTile(p.t, 44)}<div><h2>${esc(p.n)}</h2><div class="m">${t('pl_' + p.t)}${S.me ? ' · ' + t('kmAway', { d: dist(p) }) : ''}</div></div><button class="iconbtn" data-a="unsel" aria-label="${t('close')}">${ico('x', 18)}</button></div>
${p.ph ? `<div class="row2"><a class="btn pri" href="tel:${esc(p.ph.replace(/[^\d+]/g, ''))}">${ico('phone', 17)} ${esc(t('call', { n: p.ph }))}</a></div>` : ''}</div>`;
  }
  const r = S.sel && S.reports.find((x) => x.id === S.sel);
  if (!r) return '';
  const asked = S.asked.has(r.id) && !S.selAsk;
  return `<div class="msheet"><div class="grab"></div><div class="sheet-h">${catTile(r.category, 46)}<div><h2>${esc(repName(r))}</h2><div class="m">${esc(r.area || r.town || '')}${S.me ? ' · ' + t('kmAway', { d: dist(r) }) : ''}${r.time ? ' · ' + t('seen', { t: esc(r.time) }) : ''}</div></div>${r.source === 'police' ? pill('p-pol', t('sPolice'), '🛡') : ''}<button class="iconbtn" data-a="unsel" aria-label="${t('close')}">${ico('x', 18)}</button></div>
${S.selAsk ? `<p class="q">${t('nearQ')}</p><div class="row2"><button class="btn" data-a="mapno">${t('noGone')}</button><button class="btn pri" data-a="mapyes">${t('yesThere')}</button></div>`
    : `<div class="row2">${asked ? '' : `<button class="btn" data-a="mapask">${t('nearQ')}</button>`}<button class="btn dark" data-a="detail" data-id="${esc(r.id)}">${t('viewDetails')}</button></div>`}</div>`;
}
function searchMatches(q) {
  q = norm(q.trim());
  if (q.length < 2) return [];
  const inc = mapIncidents().filter((r) => norm(repName(r) + ' ' + (r.area || '') + ' ' + (r.town || '')).includes(q)).slice(0, 4)
    .map((r) => ({ k: 'i', id: r.id, lat: r.lat, lng: r.lng, html: `${catTile(r.category, 30)}<span><b>${esc(repName(r))}</b><small>${esc(r.area || r.town || '')}</small></span>` }));
  const pl = PLACES.filter((p) => norm(p.n).includes(q)).slice(0, 5)
    .map((p) => ({ k: 'p', id: p.n, lat: p.lat, lng: p.lng, html: `${placeTile(p.t, 30)}<span><b>${esc(p.n)}</b><small>${t('pl_' + p.t)}</small></span>` }));
  return [...inc, ...pl];
}
function renderSug() {
  const box = $('#msug');
  if (!box) return;
  const q = S.f.msearch || '', xs = searchMatches(q);
  box.innerHTML = q.trim().length < 2 ? '' : xs.length
    ? xs.map((x, i) => `<button data-a="goto" data-i="${i}">${x.html}</button>`).join('')
    : `<div class="none">${t('noResults')}</div>`;
  renderSug.last = xs;
}
let MAPI = null, REPORTMAP = null, WATCHING = false, LOC_FAILED_AT = 0;
const ISLAND_BOUNDS = [[-20.65, 57.18], [-19.85, 58.1]];
// Esri street tiles: free, no key, and no referrer requirement (OpenStreetMap's own servers block app traffic).
const addMapTiles = (map) => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Tiles © Esri · Places © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
// force: the person asked for it (a switch or button). Otherwise, after a failure (e.g. permission denied)
// wait a minute before asking again: retrying from draw() on every failure redrew the page in an endless loop.
function ensureMapLocation(force) {
  if (WATCHING || S.user.pref.loc === 'Never share location') return;
  if (!force && LOC_FAILED_AT && Date.now() - LOC_FAILED_AT < 60000) return;
  WATCHING = true;
  S.locating = !S.me;
  native.watchPosition((here) => {
    if (!inMauritius(here.lat, here.lng)) return;
    const first = !S.me, before = repCheck();
    S.me = here;
    S.locating = false;
    if (first) {
      if (S.tab !== 'map') S.mv = { c: [here.lat, here.lng], z: 14 };
      if (['alerts', 'report'].includes(S.tab) && !S.authView && !S.detail) draw();
      if (S.tab === 'map' && MAPI) drawMe();
      if (S.user.pref.n10) syncDevice();
    } else if (S.tab === 'report' && !S.authView && !S.sending && repCheck() !== before) draw();
    else if (S.tab === 'map' && MAPI) drawMe();
    checkProximity();
  }, () => {
    S.locating = false;
    WATCHING = false;
    LOC_FAILED_AT = Date.now();
    if (S.tab === 'report') draw();
  }).catch(() => { S.locating = false; WATCHING = false; LOC_FAILED_AT = Date.now(); });
}
let ME_MARK = null;
function drawMe() {
  if (!MAPI || !S.me) return;
  if (ME_MARK) ME_MARK.setLatLng([S.me.lat, S.me.lng]);
  else ME_MARK = L.marker([S.me.lat, S.me.lng], { icon: L.divIcon({ className: 'me-wrap', html: '<div class="me-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), zIndexOffset: 900, keyboard: false, interactive: false }).addTo(MAPI);
}
function selectOnMap(r) {
  S.sel = r ? r.id : null; S.selPlace = null; S.selAsk = false;
  const box = $('#msheet');
  if (box) box.innerHTML = MapSheet();
}
function initMap() {
  if (MAPI) { MAPI.remove(); MAPI = null; }
  ME_MARK = null;
  const el = document.getElementById('map');
  if (!el) return;
  const m = (MAPI = L.map(el, { maxBounds: ISLAND_BOUNDS, maxBoundsViscosity: 1, minZoom: 9, zoomControl: false }).setView(S.mv.c, S.mv.z));
  addMapTiles(m);
  const ly = S.user.pref.layers;
  // Emergency services appear from street level (zoom 12) so they never bury the incidents on the island view.
  const poi = L.layerGroup(), anyPoi = ['police', 'hospital', 'clinic', 'fire'].some((k) => ly[k]);
  PLACES.forEach((p) => {
    if (!ly[p.t]) return;
    L.marker([p.lat, p.lng], { icon: placeIcon(L, p.t), title: p.n, keyboard: false, zIndexOffset: -500 })
      .on('click', () => { S.selPlace = p; S.sel = null; const b = $('#msheet'); if (b) b.innerHTML = MapSheet(); }).addTo(poi);
  });
  const showPoi = () => {
    const on = m.getZoom() >= 12;
    if (on) poi.addTo(m); else poi.remove();
    const hint = $('#zoomhint');
    if (hint) hint.hidden = on || !anyPoi;
  };
  m.on('zoomend', showPoi);
  setTimeout(showPoi, 0);
  if (ly.inc) mapIncidents().forEach((i) => {
    const closest = i.id === S.closestId;
    L.marker([i.lat, i.lng], { icon: incidentIcon(L, i.category, { old: isDim(i), closest, police: i.source === 'police', label: esc(repName(i)) }), title: repName(i), zIndexOffset: closest || i.id === S.sel ? 1000 : 0 })
      .on('click', () => selectOnMap(i)).addTo(m);
  });
  m.on('click', () => { if (S.sel || S.selPlace) { S.sel = null; S.selPlace = null; const b = $('#msheet'); if (b) b.innerHTML = ''; } });
  m.on('moveend', () => { const c = m.getCenter(); S.mv = { c: [c.lat, c.lng], z: m.getZoom() }; });
  drawMe();
  fitMapToBox(m, el);
  ensureMapLocation();
}
// Report map. The incident must be inside the dashed 500 m circle around the reporter.
function initReportMap() {
  if (REPORTMAP) { REPORTMAP.remove(); REPORTMAP = null; }
  const el = document.getElementById('report-map');
  if (!el) return;
  const p = S.repPos, hasPoint = p && inMauritius(p.lat, p.lng), me = S.me, bad = repCheck() === 'errRadius';
  const m = (REPORTMAP = L.map(el, { maxBounds: ISLAND_BOUNDS, maxBoundsViscosity: 1, minZoom: 9, zoomControl: false })
    .setView(hasPoint ? [p.lat, p.lng] : me ? [me.lat, me.lng] : [-20.2, 57.55], hasPoint || me ? 16 : 10));
  addMapTiles(m);
  if (me) {
    // The 500 m circle the incident must be in. Red while the chosen point is outside it.
    const ring = L.circle([me.lat, me.lng], { radius: REPORT_KM * 1000, color: bad ? '#e5383b' : '#0e9f8f', weight: 2, dashArray: '6 5', fillColor: bad ? '#e5383b' : '#0e9f8f', fillOpacity: 0.08, interactive: false }).addTo(m);
    const box = ring.getBounds();
    if (hasPoint) box.extend([p.lat, p.lng]);
    m.fitBounds(box, { padding: [12, 12] });
    L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'me-wrap', html: '<div class="me-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, keyboard: false }).addTo(m);
  }
  if (hasPoint) L.marker([p.lat, p.lng], { icon: incidentIcon(L, S.cat), zIndexOffset: 1000 }).addTo(m);
  m.on('click', async (e) => {
    const d = { lat: e.latlng.lat, lng: e.latlng.lng, town: 'Other' };
    if (!inMauritius(d.lat, d.lng)) return toast(t('chooseInMu'));
    // Keep a name the person typed; only replace an empty or auto-filled one with the street lookup.
    const typed = S.f.rl && S.f.rl !== S.rlAuto;
    S.repPos = d; if (!typed) S.f.rl = ''; S.rerr = ''; S.geoHint = ''; S.dup = null;
    draw();
    const g = await revgeo(d.lat, d.lng);
    if (S.repPos === d) {
      d.town = g.town;
      if (!S.f.rl || S.f.rl === S.rlAuto) { S.f.rl = g.place; S.rlAuto = g.place; }
      draw();
    }
  });
  fitMapToBox(m, el);
}
// Leaflet measures its box once, when created. If the layout settles afterwards (fonts, tab switch,
// phone rotation), tiles and markers end up offset and part of the map stays grey. Re-measure on resize.
function fitMapToBox(m, el) {
  requestAnimationFrame(() => m.invalidateSize());
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { if (m._container === el && el.isConnected) m.invalidateSize(); else ro.disconnect(); });
    ro.observe(el);
    m.on('unload', () => ro.disconnect());
  }
}

/* ============================================================ 7d. SCREEN: REPORT (3 steps) */
function stepOk(n) {
  if (n === 1) return !(S.cat === OTHER && !(S.f.ro || '').trim()) && S.repPos && inMauritius(S.repPos.lat, S.repPos.lng) && !repCheck();
  if (n === 2) return !!S.photo;
  return true;
}
function Report() {
  if (S.sent)
    return `<div class="done"><div class="done-ic">${ico('check', 40, 3)}</div><h1>${t('received')}</h1><p class="lead">${t('receivedBody')}</p>${S.sentMerged ? `<div class="notice ok">${t('receivedMerged')}</div>` : ''}<p class="fine">${t('receivedNext')}</p>
<div class="notice err">${t('inDanger')}</div><button class="btn pri" data-a="anew">${t('backToAlerts')}</button></div>`;
  if (!S.auth)
    return `<div class="phead"><h1>${t('reportHazard')}</h1></div><div class="notice err">${t('emergency')}</div>
<div class="card center"><div class="logo xl">${ico('lock', 30)}</div><h2>${t('signInToReport')}</h2><p class="fine">${t('signInToReportBody')}</p><div class="row2"><button class="btn" data-a="authreg">${t('createAccount')}</button><button class="btn pri" data-a="authsignin">${t('signIn')}</button></div></div>`;
  const st = S.step, names = ['step1', 'step2', 'step3'];
  const head = `<div class="phead"><div><h1>${t('reportHazard')}</h1><small>${t('stepOf', { n: st })} · ${t(names[st - 1])}</small></div><button class="iconbtn" data-a="represet" aria-label="${t('cancel')}">${ico('x', 18)}</button></div>
<div class="steps">${[1, 2, 3].map((i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '', action = '';
  if (st === 1) {
    const chk = repCheck(), d = S.repPos && S.me ? Math.round(distanceKm(S.me, S.repPos) * 1000) : null;
    const status = chk && !(chk === 'needLoc' && S.locState === 'busy') ? `<div class="notice err radius-err" role="alert">${t(chk)}</div>`
      : S.locState === 'busy' ? `<div class="notice">${t('locating')}</div>`
      : S.repPos ? `<div class="notice ok">${ico('check', 16, 2.8)} ${esc(S.f.rl || S.repPos.lat.toFixed(5) + ', ' + S.repPos.lng.toFixed(5))}${d !== null ? ' · ' + t('mFromYou', { m: d }) : ''}</div>`
      : `<p class="fine">${S.me ? t('tapCircleHelp') : t('mapHelp')}</p>`;
    body = `<h3 class="lbl">${t('whatHappening')}</h3><div class="cats" role="group">${CATS.map((c) => `<button data-cat="${c}" aria-pressed="${S.cat === c}" style="--c:${CAT_COLOR[c]}">${catTile(c, 40)}<span>${esc(catName(c))}</span></button>`).join('')}</div>
${S.cat === OTHER ? `<div class="field"><label for="ro">${t('describeOther')}</label><input type="text" id="ro" maxlength="60" value="${esc(S.f.ro || '')}" placeholder="${esc(t('otherPh'))}"></div>` : ''}
<h3 class="lbl">${t('whereRadius')}</h3>
<div class="field"><div class="loc-field"><input type="text" id="rl" maxlength="160" value="${esc(S.f.rl || '')}" placeholder="${esc(t('locPh'))}" aria-label="${esc(t('location'))}"><button class="chip on" data-a="geo">${ico('locate', 14, 2.4)} ${t('useLocation')}</button></div></div>
${S.geoHint ? `<div class="notice err">${esc(S.geoHint)}</div>` : ''}${status}<div id="report-map" role="application" aria-label="${esc(t('locationMap'))}"></div>`;
    action = `<button class="btn pri" data-a="next" ${stepOk(1) ? '' : 'disabled'}>${t('continueBtn')} ${ico('arrow', 18, 2.6)}</button>`;
  } else if (st === 2) {
    body = `<h3 class="lbl">${t('photo')}</h3>
<div class="photos">${S.photo ? (S.photo.previewable ? `<div class="ph has"><img src="${S.photo.url}" alt="${esc(t('photoPreview'))}"><span>${ico('check', 14, 3)} ${t('photoAdded')}</span></div>` : `<div class="ph has plain">${t('noPreview')}</div>`) +
      `<button class="ph add" data-a="cam">${ico('camera', 24)}<span>${t('retake')}</span></button>`
      : `<button class="ph add big" data-a="cam">${ico('camera', 28)}<span>${t('take')}</span></button><button class="ph add big" data-a="gal">${ico('image', 28)}<span>${t('choose')}</span></button>`}</div>
${S.photo ? `<div class="row-links"><button class="link" data-a="gal">${t('choose')}</button><button class="link" data-a="nophoto">${t('remove')}</button></div>` : ''}
<div class="field"><label for="rt">${t('observed')}</label><input type="time" id="rt" value="${esc(S.f.rt || (S.f.rt = now()))}"></div>
<div class="field"><label for="rd">${t('description')}</label><textarea id="rd" rows="4" maxlength="500" placeholder="${esc(t('descPh'))}">${esc(S.f.rd || '')}</textarea></div>
${S.rerr ? `<div class="notice err" role="alert">${esc(S.rerr)}</div>` : ''}`;
    action = `<button class="btn" data-a="prev">${t('back')}</button><button class="btn pri" data-a="next" ${stepOk(2) ? '' : 'disabled'}>${t('continueBtn')} ${ico('arrow', 18, 2.6)}</button>`;
  } else {
    let dup = '';
    if (S.dup) {
      const x = S.dup.existing;
      const msg = x ? t('dupExisting', { cat: esc(catName(x.label)), m: x.distance_m, place: esc(x.location_name || '') }) : esc(S.dup.message);
      dup = `<div class="notice warn" role="alert"><b>${t('dupTitle')}</b> ${msg}<br>${t('dupBody')}<div class="row2 wrap">${x ? `<button class="btn sm pri" data-a="sendmerge">${t('dupSame')}</button>` : ''}<button class="btn sm" data-a="senddistinct">${t('dupDiff')}</button><button class="btn sm ghost" data-a="nodup">${t('cancel')}</button></div></div>`;
    }
    const d = S.repPos && S.me ? Math.round(distanceKm(S.me, S.repPos) * 1000) : null, chk = repCheck();
    body = `<h3 class="lbl">${t('yourReport')}</h3><div class="card summary"><div class="sheet-h">${catTile(S.cat, 46)}<div><h2>${esc(S.cat === OTHER ? S.f.ro || catName(OTHER) : catName(S.cat))}</h2><div class="m">${esc(S.f.rl || '')}${d !== null ? ' · ' + t('mFromYou', { m: d }) : ''}</div></div></div>
${S.photo && S.photo.previewable ? `<img class="sum-img" src="${S.photo.url}" alt="${esc(t('photoPreview'))}">` : ''}
<div class="facts"><span>${ico('clock', 15)} ${t('observedAt', { t: esc(S.f.rt || now()) })}</span></div>${S.f.rd ? `<p class="desc">${esc(S.f.rd)}</p>` : ''}</div>
<p class="fine">${t('privacyNote')}</p><div class="notice err small">${t('inDanger')}</div>
${chk ? `<div class="notice err radius-err" role="alert">${t(chk)}</div>` : ''}${S.rerr ? `<div class="notice err" role="alert">${esc(S.rerr)}</div>` : ''}${dup}
${S.sending && S.sendPhase === 'upload' ? `<div class="progress" aria-hidden="true"><span id="sendbar" style="width:${S.sendPct}%"></span></div>` : ''}`;
    const label = S.sending ? (S.sendPhase === 'verify' ? t('verifying') : t('sending', { p: S.sendPct })) : t('send');
    action = `<button class="btn" data-a="prev" ${S.sending ? 'disabled' : ''}>${t('back')}</button><button class="btn pri" id="sendbtn" data-a="send" ${S.sending ? 'disabled aria-busy="true"' : chk ? `disabled title="${esc(t(chk))}"` : ''}>${label}</button>`;
  }
  return `${head}${body}<div class="actionbar">${action}</div>`;
}

/* ============================================================ 7e. SCREEN: CONTACTS
   SAMU's emergency number is 114 (Ministry of Health / Mauritius Tourism). */
const CONTACTS = [
  ['c_police', '999'], ['c_samu', '114'], ['c_fire', '115'], ['c_child', '113'], ['c_fpu_dv', '119'], ['c_crime', '148'], ['c_info', '2080034'],
  ['c_complaints', '8002345'], ['c_fpu', '2102116'], ['c_minors', '2134093'], ['c_tourist', '2131640'], ['c_env', '2105151'], ['c_coast', '2122747'], ['c_weather', '171'],
];
const Contacts = () => `<div class="phead"><div><h1>${t('contactsTitle')}</h1><small>${t('contactsHelp')}</small></div></div>
<h3 class="lbl">${t('emergencyNumbers')}</h3><div class="big3">${[['c_police', '999', '#1d3a8a', 'shield'], ['c_samu', '114', '#d61f45', 'plus'], ['c_fire', '115', '#d9480f', 'alert']]
  .map(([k, n, c, i]) => `<a href="tel:${n}" style="--c:${c}" aria-label="${esc(t('callX', { name: t(k), n }))}"><span class="b3i">${ico(i, 20, 2.6)}</span><em>${n}</em><small>${esc(t(k))}</small></a>`).join('')}</div>
<h3 class="lbl">${t('otherNumbers')}</h3><div class="list">${CONTACTS.slice(3).map(([k, n]) => `<a class="row" href="tel:${n}" aria-label="${esc(t('callX', { name: t(k), n }))}"><span class="tile" style="--c:#0e9f8f;width:38px;height:38px;color:#0e9f8f">${ico('phone', 18)}</span><span class="row-t">${esc(t(k))}</span><span class="num">${n}</span></a>`).join('')}</div>`;

/* ============================================================ 7f. SCREEN: PROFILE */
function Mine() {
  if (S.mine === null && !S.mineErr) return `<div class="fine">${t('loading')}</div>`;
  if (S.mineErr) return `<div class="notice err" role="alert">${esc(S.mineErr)}</div>`;
  if (!S.mine.length) return `<p class="fine">${t('noReports')}</p>`;
  const col = { pending: 'p-new', approved: 'p-cit', resolved: 'p-tr', 'not published': 'p-old' };
  return S.mine.map((m) => `<div class="row">${catTile(m.category || OTHER, 38)}<span class="row-t"><b>${esc(m.category === OTHER ? m.label : catName(m.category || m.label))}</b><small>${esc(m.location_name)} · ${t('sentOn', { d: new Date(m.created_at).toLocaleDateString() })}${m.merged ? ' · ' + t('mergedNote') : ''}</small></span>${pill(col[m.status] || 'p-old', t('st_' + m.status))}</div>`).join('');
}
const sw = (attr, on, label, extra = '') => `<label class="swrow">${extra}<span class="row-t">${label}</span><input type="checkbox" class="sw" ${attr} ${on ? 'checked' : ''}></label>`;
function Profile() {
  const p = S.user.pref, u = S.auth && S.auth.user;
  const ini = u ? u.full_name.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase() : '';
  const account = u
    ? `<div class="card acct"><div class="avatar">${esc(ini)}</div><div><h2>${esc(u.full_name)}</h2><div class="m">NID ${esc(u.nid_masked)}${u.phone ? ' · ' + esc(u.phone) : ''}</div>${u.role === 'police' ? pill('p-pol', t('policeAccount'), '🛡') : pill('p-cit', t('citizenAccount'), '✓')}</div></div>
<div class="card"><div class="card-h"><h3>${t('yourReports')}</h3><button class="iconbtn sm" data-a="mine" aria-label="${esc(t('refreshStatus'))}">${ico('refresh', 16)}</button></div><div class="list flat">${Mine()}</div></div>`
    : `<div class="card center"><div class="avatar">${ico('user', 30)}</div><h2>${t('guest')}</h2><p class="fine">${t('guestBody')}</p><div class="row2"><button class="btn" data-a="authreg">${t('createAccount')}</button><button class="btn pri" data-a="authsignin">${t('signIn')}</button></div></div>`;
  const opt = (vals, cur) => vals.map(([v, k]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t(k))}</option>`).join('');
  return `<div class="phead"><h1>${t('profile')}</h1></div>${account}
<div class="card"><h3>${ico('globe', 17)} ${t('language')}</h3><select id="plang" data-lang>${Object.keys(LANG).map((l) => `<option ${l === p.lang ? 'selected' : ''}>${l}</option>`).join('')}</select><p class="fine">${t('langNote')}</p></div>
<div class="card"><h3>${ico('bell', 17)} ${t('notifyAbout')}</h3><div class="list flat">${CATS.map((c) => sw(`data-nc="${esc(c)}"`, p.cats[c] !== false, esc(catName(c)), catTile(c, 34))).join('')}</div>
<h3 class="mt">${t('notifArea')}</h3><p class="fine">${t('notifAreaHelp', { km: NEAR_KM })}</p>${sw('data-n10', p.n10, t('onlyNear', { km: NEAR_KM }))}
${S.deviceSync ? `<p class="fine">${esc(S.deviceSync)}</p>` : ''}
<h3 class="mt">${t('proximity')}</h3><p class="fine">${t('proxHelp')}</p>${sw('data-prox', p.prox, t('proxToggle'))}</div>
<div class="card"><h3>${ico('lock', 17)} ${t('privacy')}</h3><div class="field"><label for="ploc">${t('locPrivacy')}</label><select id="ploc" data-loc>${opt([['Ask each time', 'locAsk'], ['Always allow', 'locAlways'], ['Never share location', 'locNever']], p.loc)}</select></div></div>
<div class="card"><h3>${ico('eye', 17)} ${t('a11y')}</h3>${sw('data-d="lg"', p.a11y.lg, t('larger'))}${sw('data-d="hc"', p.a11y.hc, t('hc'))}</div>
${u ? `<button class="btn" data-a="signout">${ico('logout', 18)} ${t('signOut')}</button>` : ''}<button class="btn danger" data-a="wipe">${t('wipe')}</button>`;
}

/* ============================================================ 8. RENDERING */
const NAV = [['alerts', 'bell'], ['map', 'map'], ['report', 'plus'], ['contacts', 'phone'], ['profile', 'user']];
function ProxSheet() {
  const r = S.prox && S.reports.find((x) => x.id === S.prox);
  if (!r) return '';
  return `<div class="bsheet prox" role="dialog" aria-label="${esc(t('nearTitle'))}"><div class="grab"></div><div class="sheet-h">${catTile(r.category, 46)}<div><h2>${t('nearTitle')}</h2><div class="m">${esc(repName(r))} · ${esc(r.area || r.town || '')}</div></div></div>
<p class="q">${t('nearQ')}</p><div class="row2"><button class="btn" data-a="fbno">${t('noGone')}</button><button class="btn pri" data-a="fbyes">${t('yesThere')}</button></div><button class="btn ghost" data-a="fbskip">${t('notSure')}</button></div>`;
}
function CameraView() {
  if (!S.camera) return '';
  return `<div class="camera-full" role="dialog" aria-label="${esc(t('cameraLabel'))}"><video id="cam-video" autoplay playsinline muted></video>
<div class="camera-bar"><button class="btn" data-a="closecam">${t('cancel')}</button><button class="shutter" data-a="takecapture" aria-label="${esc(t('capture'))}"></button><button class="btn" data-a="flipcam" aria-label="${esc(t('switchCam'))}">⟲</button></div>
<button class="link cam-alt" data-a="camapp">${t('useCameraApp')}</button></div>`;
}
function TabBar() {
  return `<nav class="tabbar" aria-label="Main">${NAV.map(([k, i]) => k === 'report'
    ? `<button class="fab" data-t="report" aria-label="${esc(t('reportHazard'))}" ${S.tab === k ? 'aria-current="page"' : ''}>${ico('plus', 26, 3)}</button>`
    : `<button data-t="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ico(i, 22)}<span>${t(k)}</span></button>`).join('')}</nav>`;
}
function App() {
  if (S.authView) return AuthScreen();
  const body = { alerts: Alerts, map: MapS, report: Report, contacts: Contacts, profile: Profile }[S.tab]();
  const modal = S.photoView ? `<div class="photo-modal" role="dialog" aria-label="${esc(t('photoAlt'))}"><img src="${esc(S.photoView)}" alt="${esc(t('photoAlt'))}"><button class="btn pri" data-a="closephoto">${t('close')}</button></div>` : '';
  return `<div class="phone"><main class="scr${S.tab === 'map' ? ' full' : ''}${S.tab === 'report' && S.auth && !S.sent ? ' with-actions' : ''}">${body}</main>${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}${TabBar()}${S.detail ? DetailModal() : ''}${S.drawer ? Drawer() : ''}${ProxSheet()}${modal}${CameraView()}</div>`;
}
function draw() {
  syncLanguage();
  const keep = document.activeElement && document.activeElement.id;
  const sel = keep && document.activeElement.selectionStart;
  const scr = $('.scr'), top = scr ? scr.scrollTop : 0, view = S.authView ? 'auth' : S.tab + (S.tab === 'report' ? S.step : ''), sameView = draw.lastView === view;
  if (MAPI && view !== 'map') { MAPI.remove(); MAPI = null; }
  if (REPORTMAP && view !== 'report1') { REPORTMAP.remove(); REPORTMAP = null; }
  $('#root').innerHTML = App();
  if (view === 'map') { initMap(); renderSug(); }
  else if (view === 'report1') initReportMap();
  if (S.camera && CAMERA_STREAM) { // the video element was re-created: reattach the live camera
    const v = $('#cam-video');
    if (v) { v.srcObject = CAMERA_STREAM; v.play().catch(() => {}); }
  }
  if (sameView && $('.scr')) $('.scr').scrollTop = top;
  draw.lastView = view;
  if (keep) {
    const e = document.getElementById(keep);
    if (e && e.focus) {
      e.focus();
      try { if (typeof sel === 'number' && e.setSelectionRange) e.setSelectionRange(sel, sel); } catch (x) {}
    }
  }
}
let toastTimer = null;
function toast(msg) {
  S.toast = msg;
  const el = $('.toast');
  if (el) el.textContent = msg; else draw();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = ''; const e = $('.toast'); if (e) e.remove(); }, 2800);
}

/* ============================================================ 9. PHOTOS
   Resized to 1600 px JPEG on the phone when the browser can decode it; otherwise (e.g. HEIC in Chrome)
   the original is sent and the server converts it. The server always re-encodes and strips metadata. */
const MAX_PHOTO = 10 * 1024 * 1024;
async function prepareImage(blob) {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc);
    c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (out) return { blob: out, previewable: true };
  } catch (e) {}
  return { blob, previewable: /^image\/(jpeg|png|webp|gif)$/.test(blob.type) };
}
async function setPhoto(blob) {
  if (!blob) return;
  const prepared = await prepareImage(blob);
  if (prepared.blob.size > MAX_PHOTO) { S.rerr = t('photoTooBig'); return draw(); }
  if (S.photo) URL.revokeObjectURL(S.photo.url);
  S.photo = { ...prepared, url: URL.createObjectURL(prepared.blob) };
  S.rerr = '';
  draw();
}
function clearPhoto() {
  if (S.photo) URL.revokeObjectURL(S.photo.url);
  S.photo = null;
}
function pick(cam) {
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = 'image/*';
  if (cam) i.capture = 'environment';
  i.onchange = () => i.files[0] && setPhoto(i.files[0]);
  i.click();
}
async function choosePhoto(fromCamera) {
  if (native.isNative) {
    try { await setPhoto(await native.nativePhoto(fromCamera)); }
    catch (e) { S.rerr = fromCamera ? t('camErr') : t('galErr'); draw(); }
    return;
  }
  if (fromCamera) openDeviceCamera(); else pick(false);
}
let CAMERA_STREAM = null;
function stopCamera() {
  if (CAMERA_STREAM) { CAMERA_STREAM.getTracks().forEach((x) => x.stop()); CAMERA_STREAM = null; }
  S.camera = false;
}
/* Live camera inside the app (full screen). Falls back to the phone's own camera app when the browser
   cannot open the camera (no permission, insecure page, old browser). */
async function openDeviceCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return pick(true);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: S.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    stopCamera();
    CAMERA_STREAM = stream;
    S.camera = true;
    draw();
  } catch (e) {
    stopCamera();
    draw();
    pick(true);
  }
}
function captureCameraPhoto() {
  const v = $('#cam-video');
  if (!v || !v.videoWidth) return toast(t('camStarting'));
  const sc = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * sc);
  c.height = Math.round(v.videoHeight * sc);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  stopCamera();
  draw();
  c.toBlob((b) => setPhoto(b), 'image/jpeg', 0.88);
}

/* ============================================================ 10. LOCATION & PROXIMITY */
function locateMapPosition(onSuccess, onFailure) {
  if (S.user.pref.loc === 'Never share location') { onFailure && onFailure(); return toast(t('locOff')); }
  toast(t('askingLoc'));
  native.getPosition().then((here) => {
    if (!inMauritius(here.lat, here.lng)) { onFailure && onFailure(); return toast(t('outsideMu')); }
    S.me = here;
    S.mv = { c: [here.lat, here.lng], z: 15 };
    onSuccess && onSuccess();
    draw();
    checkProximity();
  }, () => { onFailure && onFailure(); toast(t('locFail')); });
}
function chooseClosestIncident() {
  const xs = mapIncidents();
  if (!xs.length) return toast(t('noIncCompare'));
  const c = xs.reduce((b, x) => (!b || distanceKm(S.me, x) < distanceKm(S.me, b) ? x : b), null);
  S.closestId = c.id;
  S.sel = c.id;
  S.selPlace = null;
  S.mv = { c: [c.lat, c.lng], z: 15 };
  S.user.pref.layers.inc = true;
  draw();
  toast(t('closestToast', { cat: repName(c), km: distanceKm(S.me, c).toFixed(1) }));
}
/* The incident must be within 500 m of where the reporter is now. Returns the i18n key of the problem, or ''. */
const REPORT_KM = 0.5;
function repCheck() {
  if (S.user.pref.loc === 'Never share location') return 'locOffReport';
  if (!S.me) return 'needLoc';
  if (S.repPos && distanceKm(S.me, S.repPos) > REPORT_KM) return 'errRadius';
  return '';
}
function maybeAutoLocate() {
  if (S.tab !== 'report' || !S.auth || S.sent) return;
  ensureMapLocation(true); // keep the position fresh while the person is on this screen
  if (!S.repPos && S.locState === 'idle') fillLocation(true);
}
function fillLocation(auto) {
  const fail = (m) => {
    S.locState = 'fail';
    S.geoHint = m;
    draw();
    ensureMapLocation(true);
  };
  if (S.user.pref.loc === 'Never share location') return fail(t('locOff'));
  S.locState = 'busy';
  S.geoHint = '';
  draw();
  const before = S.repPos, stale = () => {
    if (S.repPos !== before) { if (S.locState === 'busy') S.locState = 'idle'; draw(); return true; }
    return false;
  };
  native.getPosition().then(async ({ lat, lng }) => {
    if (stale()) return;
    if (!inMauritius(lat, lng)) return fail(t('outsideMu'));
    S.me = { lat, lng };
    S.repPos = { lat, lng, town: 'Other' };
    S.locState = 'ok';
    draw();
    const pos = S.repPos, g = await revgeo(lat, lng);
    if (S.repPos !== pos) return;
    pos.town = g.town;
    if (!S.f.rl || S.f.rl === S.rlAuto) { S.f.rl = g.place; S.rlAuto = g.place; }
    S.geoHint = '';
    S.rerr = '';
    draw();
  }, () => { if (!stale()) fail(t('locFailCheck')); });
}
/* "Is it still there?": when the person passes within 250 m of a published incident they have not been
   asked about, a sheet asks them (and a notification, if the app is in the background). */
function checkProximity() {
  if (!S.user.pref.prox || !S.me || S.prox || S.photoView || S.camera || S.authView || S.sending || S.detail) return;
  const r = currentReports().find((x) => !S.asked.has(x.id) && distanceKm(S.me, x) <= PROX_KM);
  if (!r) return;
  S.asked.add(r.id);
  S.prox = r.id;
  persist();
  if (document.visibilityState !== 'visible') native.notify(t('nearNotifTitle', { cat: repName(r) }), t('nearNotifBody'));
  draw();
}
async function sendAnswer(id, still) {
  S.asked.add(id);
  persist();
  try { await api.sendFeedback(id, still); toast(t('thanks')); } catch (e) { toast(errMsg(e)); }
}
async function answerProximity(still) {
  const id = S.prox;
  S.prox = null;
  draw();
  if (still !== null) sendAnswer(id, still);
}
async function startProximity() {
  const p = S.user.pref;
  if (!p.prox || p.loc === 'Never share location') return;
  if (p.loc === 'Always allow' || (await native.locationGranted())) ensureMapLocation();
}

/* ============================================================ 11. ACCOUNTS (NID sign-in) */
const NID_RE = /^[A-Z]\d{6}[0-9A-Z]{7}$/;
function nidDateOk(nid) {
  const dd = +nid.slice(1, 3), mm = +nid.slice(3, 5), yy = +nid.slice(5, 7);
  return [1900, 2000].some((c) => {
    const d = new Date(c + yy, mm - 1, dd);
    return d.getFullYear() === c + yy && d.getMonth() === mm - 1 && d.getDate() === dd && d <= new Date();
  });
}
function openAuth(view) {
  stopCamera();
  Object.assign(S, { authView: view, authErr: '', authBusy: '', showPw: false });
  draw();
}
async function doAuth() {
  if (S.authBusy) return;
  const reg = S.authView === 'register', f = S.f;
  const nid = String(f.anid || '').replace(/[\s-]/g, '').toUpperCase(), pw = f.apw || '', name = String(f.afn || '').trim(), ph = String(f.aph || '').replace(/\D/g, '');
  const err = (k) => { S.authErr = t(k); draw(); };
  if (reg && (name.length < 2 || !/\p{L}/u.test(name))) return err('errName');
  if (!NID_RE.test(nid)) return err('errNid');
  if (!nidDateOk(nid)) return err('errNidDate');
  if (reg) {
    if (ph && !/^\d{7,8}$/.test(ph)) return err('errPhone');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return err('errPw');
    if (pw !== (f.apw2 || '')) return err('errPwMatch');
    if (!f.acon) return err('errConsent');
  } else if (!pw) return err('errPw');
  S.authErr = '';
  S.authBusy = t('verifying');
  draw();
  try {
    const proof = await api.humanProof(reg ? 'register' : 'login');
    S.authBusy = reg ? t('creating') : t('signingIn');
    draw();
    const d = reg ? await api.register({ nid, full_name: name, phone: ph || null, password: pw }, proof) : await api.login({ nid, password: pw }, proof);
    S.auth = { token: d.token, user: d.user, exp: d.expires_at };
    api.setToken(d.token);
    ['anid', 'apw', 'apw2', 'afn', 'aph', 'acon'].forEach((k) => delete S.f[k]);
    Object.assign(S, { authView: null, authBusy: '', showPw: false, mine: null });
    S.user.welcomed = true;
    persist();
    draw();
    toast(t('welcomeUser', { name: d.user.full_name }));
    if (S.tab === 'profile') loadMine();
    if (S.tab === 'report') maybeAutoLocate();
  } catch (e) {
    S.authBusy = '';
    S.authErr = errMsg(e);
    draw();
  }
}
function signOut(silent) {
  S.auth = null;
  api.setToken(null);
  S.mine = null;
  persist();
  if (!silent) { draw(); toast(t('signedOut')); }
}

/* ============================================================ 12. SUBMIT REPORT
   Shows success only after the server confirms the report and photo are saved. A retry after a network
   error reuses the same client_ref, so the server never stores the same report twice. */
async function sendReport(opts = {}) {
  if (S.sending) return;
  if (!S.auth) return openAuth('signin');
  const lcInput = String(S.f.rl || '').trim(), tm = S.f.rt || now(), ds = String(S.f.rd || '').trim(), pos = S.repPos || {}, custom = (S.f.ro || '').trim();
  Object.assign(S.f, { rl: lcInput, rt: tm, rd: ds });
  if (S.cat === OTHER && !custom) { S.step = 1; S.rerr = t('errOther'); return draw(); }
  if (!inMauritius(pos.lat, pos.lng)) { S.step = 1; return draw(); }
  const chk = repCheck();
  if (chk) { S.rerr = t(chk); return draw(); }
  if (!S.photo) { S.step = 2; S.rerr = t('errPhoto'); return draw(); }
  const lc = lcInput || pos.lat.toFixed(5) + ', ' + pos.lng.toFixed(5);
  S.clientRef = S.clientRef || crypto.randomUUID();
  Object.assign(S, { rerr: '', dup: null, sending: true, sendPhase: 'verify', sendPct: 0 });
  draw();
  let res;
  try {
    const proof = await api.humanProof('report');
    S.sendPhase = 'upload';
    draw();
    res = await api.submitReport({
      category: S.cat, custom_category: S.cat === OTHER ? custom : '', location_name: lc, town: pos.town || matchTown(lc) || 'Other',
      latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6), observed_time: tm, description: ds, client_ref: S.clientRef,
      confirm_distinct: opts.distinct ? 'true' : '', merge_into: opts.merge || '',
      my_latitude: S.me.lat.toFixed(6), my_longitude: S.me.lng.toFixed(6),
    }, S.photo.blob, proof, (pct) => {
      S.sendPct = pct;
      const b = $('#sendbtn'), bar = $('#sendbar');
      if (b) b.textContent = t('sending', { p: pct });
      if (bar) bar.style.width = pct + '%';
    });
  } catch (e) {
    S.sending = false;
    if (e.code === 'possible_duplicate') S.dup = { message: e.message, existing: e.details && e.details.existing };
    else if (e.status === 401) { signOut(true); S.authView = 'signin'; S.authErr = t('sessionEnded'); }
    else if (e.status === 0) S.rerr = errMsg(e) + ' ' + t('notSent');
    else S.rerr = errMsg(e);
    return draw();
  }
  clearPhoto();
  Object.assign(S, { sending: false, sent: true, step: 1, sentMerged: !!(res.report && res.report.merged), repPos: null, locState: 'idle', geoHint: '', clientRef: null, mine: null, dup: null });
  Object.assign(S.f, { rl: '', rd: '', ro: '', rt: '' });
  draw();
}

/* ============================================================ 13. SYNC & NOTIFICATIONS */
const toLocal = (x) => ({
  id: x.id, cat: x.label, category: x.category, source: x.source || 'citizen', area: x.location_name, town: x.town || matchTown(x.location_name) || 'Other',
  lat: Number(x.latitude), lng: Number(x.longitude), time: x.observed_time || '', desc: x.description || '', descOrig: x.description_original || '',
  translated: !!x.translated, photo: x.photo_url, publishedAt: Date.parse(x.published_at), updatedAt: x.updated_at,
});
let lastSig = '';
async function loadReports() {
  if (S.loading && S.lastSync) { S.again = true; return; }
  S.loading = true;
  try {
    const d = await api.listReports(langCode());
    S.skew = Date.parse(d.server_time) - Date.now();
    const old = new Map(S.reports.map((r) => [r.id, r]));
    // keep a report's existing photo URL while it is unchanged, so images are not re-downloaded every minute
    S.reports = d.reports.map((x) => {
      const r = toLocal(x), prev = old.get(r.id);
      if (prev && prev.updatedAt === r.updatedAt && prev.photo) r.photo = prev.photo;
      return r;
    });
    S.loadErr = '';
    S.lastSync = Date.now();
    announceNew();
  } catch (e) {
    S.loadErr = errMsg(e);
  }
  S.loading = false;
  const sig = S.reports.map((r) => r.id + r.updatedAt + r.desc + r.cat).join() + S.loadErr + Math.floor(S.lastSync / 60000) + S.user.pref.lang;
  if (S.tab === 'alerts' && sig !== lastSig && !S.camera && !S.authView && !S.detail && !S.drawer) draw();
  else if (S.tab === 'map' && sig !== lastSig && !S.authView && !S.detail && !S.f.msearch) draw();
  lastSig = sig;
  checkProximity();
  if (S.again) { S.again = false; loadReports(); }
}
function announceNew() {
  const fresh = S.reports.filter((r) => !S.seen.has(r.id));
  fresh.forEach((r) => S.seen.add(r.id));
  if (!S.seenReady) { S.seenReady = true; persist(); return; } // first load: nothing is "new"
  const wanted = fresh.filter(shouldNotify);
  if (wanted.length) {
    const r = wanted[0], more = wanted.length > 1 ? ' ' + t('more', { n: wanted.length - 1 }) : '';
    native.notify(t('newNotif', { cat: repName(r) }), `${r.area || r.town}${more}`);
  }
  if (fresh.length) persist();
}
let syncTimer = null;
function syncDevice() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const p = S.user.pref;
    try {
      const r = await api.registerDevice({
        platform: native.platform, push_token: S.pushToken, categories: CATS.filter((c) => p.cats[c] !== false),
        only_nearby: p.n10, latitude: p.n10 && S.me ? S.me.lat : null, longitude: p.n10 && S.me ? S.me.lng : null, language: p.lang,
      });
      S.deviceSync = r.push ? t('syncPush') : t('syncOpen');
    } catch (e) {
      S.deviceSync = t('syncLater');
    }
    if (S.tab === 'profile' && !S.authView) draw();
  }, 800);
}
async function loadMine() {
  if (!S.auth) return;
  S.mineErr = '';
  try { S.mine = (await api.myReports()).reports; }
  catch (e) { S.mine = null; S.mineErr = errMsg(e); }
  if (S.tab === 'profile' && !S.authView) draw();
}
const applyA11y = () => Object.entries(S.user.pref.a11y || {}).forEach(([k, v]) => document.body.classList.toggle(k, !!v));

/* ============================================================ 14. EVENTS */
function goTab(tab) {
  if (tab !== 'report') stopCamera();
  if (tab !== 'map') { S.sel = null; S.selPlace = null; }
  S.tab = tab;
  S.drawer = false;
  S.detail = null;
  if (tab !== 'report') S.sent = false;
  draw();
  if ($('.scr')) $('.scr').scrollTop = 0;
  if (tab === 'report') maybeAutoLocate();
  if (tab === 'profile') loadMine();
}
document.addEventListener('submit', (e) => {
  if (e.target.id === 'authform') { e.preventDefault(); doAuth(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.ft) { S.fl.town = d.ft; return draw(); }
  if (d.fe) { S.fl.ev = d.fe; return draw(); }
  if (d.src) { S.fl.src = d.src; return draw(); }
  if (d.layer) { S.user.pref.layers[d.layer] = !S.user.pref.layers[d.layer]; persist(); return draw(); }
  if (d.t) return goTab(d.t);
  if (d.cat) {
    S.cat = d.cat; S.rerr = ''; S.dup = null;
    draw();
    if (d.cat === OTHER) setTimeout(() => { const o = $('#ro'); o && o.focus(); }, 0);
    return;
  }
  switch (d.a) {
    case 'authsignin': if (S.authView) { S.authView = 'signin'; S.authErr = ''; return draw(); } return openAuth('signin');
    case 'authreg': if (S.authView) { S.authView = 'register'; S.authErr = ''; return draw(); } return openAuth('register');
    case 'togglepw': S.showPw = !S.showPw; return draw();
    case 'guest': S.user.welcomed = true; S.authView = null; persist(); return draw();
    case 'signout': return signOut(false);
    case 'wipe':
      if (confirm(t('wipeConfirm'))) {
        try { localStorage.removeItem('morisafe_d'); sessionStorage.removeItem('morisafe_s'); } catch (x) {}
        api.forgetDevice().catch(() => {});
        api.resetDeviceId();
        api.setToken(null);
        S.pins = [];
        S.auth = null;
        S.asked.clear();
        S.mine = null;
        draw();
        toast(t('wiped'));
      }
      return;
    case 'mine': S.mine = null; draw(); return loadMine();
    case 'refresh': S.loadErr = ''; draw(); return loadReports();
    case 'filters': S.drawer = true; return draw();
    case 'filters2': S.drawer = true; return draw();
    case 'fclose': S.drawer = false; return draw();
    case 'orig': if (S.showOrig.has(d.id)) S.showOrig.delete(d.id); else S.showOrig.add(d.id); return draw();
    case 'detail': S.detail = d.id; return draw();
    case 'closedetail': S.detail = null; return draw();
    case 'seemap': {
      const r = S.reports.find((x) => x.id === d.id);
      S.detail = null;
      if (r) { S.mv = { c: [r.lat, r.lng], z: 16 }; S.closestId = r.id; S.sel = r.id; }
      S.user.pref.layers.inc = true;
      S.tab = 'map'; S.drawer = false;
      return draw();
    }
    case 'unsel': return selectOnMap(null);
    case 'mapask': S.selAsk = true; { const box = $('#msheet'); if (box) box.innerHTML = MapSheet(); } return;
    case 'mapyes': case 'mapno': { const id = S.sel; S.selAsk = false; sendAnswer(id, d.a === 'mapyes'); const box = $('#msheet'); if (box) box.innerHTML = MapSheet(); return; }
    case 'goto': {
      const x = (renderSug.last || [])[+d.i];
      if (!x) return;
      S.f.msearch = '';
      S.mv = { c: [x.lat, x.lng], z: 16 };
      if (x.k === 'i') { S.sel = x.id; S.selPlace = null; S.user.pref.layers.inc = true; }
      else { S.selPlace = PLACES.find((p) => p.n === x.id && p.lat === x.lat) || null; S.sel = null; }
      return draw();
    }
    case 'locate':
      if (S.me) { S.mv = { c: [S.me.lat, S.me.lng], z: 15 }; if (MAPI) MAPI.setView(S.mv.c, S.mv.z); return; }
      return locateMapPosition();
    case 'rep': S.sent = false; return goTab('report');
    case 'openphoto': {
      const r = S.reports.find((x) => x.id === d.rid);
      if (r && r.photo) { S.photoView = r.photo; draw(); }
      return;
    }
    case 'closephoto': S.photoView = null; return draw();
    case 'cam': return choosePhoto(true);
    case 'gal': return choosePhoto(false);
    case 'takecapture': return captureCameraPhoto();
    case 'flipcam': S.facing = S.facing === 'environment' ? 'user' : 'environment'; return openDeviceCamera();
    case 'camapp': stopCamera(); draw(); return pick(true);
    case 'closecam': stopCamera(); return draw();
    case 'nophoto': clearPhoto(); return draw();
    case 'geo': return fillLocation(false);
    case 'next':
      if (!stepOk(S.step)) { S.rerr = S.step === 2 ? t('errPhoto') : ''; return draw(); }
      S.rerr = ''; S.step = Math.min(3, S.step + 1); draw(); if ($('.scr')) $('.scr').scrollTop = 0; return;
    case 'prev': S.rerr = ''; S.dup = null; S.step = Math.max(1, S.step - 1); draw(); if ($('.scr')) $('.scr').scrollTop = 0; return;
    case 'represet':
      clearPhoto();
      Object.assign(S, { step: 1, repPos: null, locState: 'idle', geoHint: '', rerr: '', dup: null, clientRef: null });
      Object.assign(S.f, { rl: '', rd: '', ro: '', rt: '' });
      return goTab('alerts');
    case 'near4':
      if (S.alertNear) { S.alertNear = false; return draw(); }
      if (S.me) { S.alertNear = true; return draw(); }
      return locateMapPosition(() => { S.alertNear = true; });
    case 'closest':
      S.closestId = null;
      if (!S.me) return locateMapPosition(() => chooseClosestIncident());
      return chooseClosestIncident();
    case 'send': return sendReport();
    case 'senddistinct': return sendReport({ distinct: true });
    case 'sendmerge': return sendReport({ merge: S.dup && S.dup.existing && S.dup.existing.id });
    case 'nodup': S.dup = null; return draw();
    case 'anew': S.sent = false; return goTab('alerts');
    case 'fbyes': return answerProximity(true);
    case 'fbno': return answerProximity(false);
    case 'fbskip': return answerProximity(null);
  }
});
document.addEventListener('input', (e) => {
  const x = e.target;
  if (!x.id) return;
  S.f[x.id] = x.type === 'checkbox' ? x.checked : x.value;
  if (x.id === 'msearch') renderSug();
  // Enable "Continue" on step 1 as soon as an "Other" description is typed, without a full redraw.
  if (x.id === 'ro') { const n = $('[data-a="next"]'); if (n) n.disabled = !stepOk(1); }
});
document.addEventListener('change', async (e) => {
  const x = e.target, p = S.user.pref;
  const isLang = x.dataset.lang !== undefined; // <select data-lang> has an empty value, so test presence
  if (isLang) { p.lang = x.value; draw(); loadReports(); }
  if (x.dataset.nc) p.cats[x.dataset.nc] = x.checked;
  if (x.dataset.n10 !== undefined) {
    p.n10 = x.checked;
    if (x.checked && !S.me) ensureMapLocation(true);
  }
  if (x.dataset.prox !== undefined) {
    p.prox = x.checked;
    if (x.checked) ensureMapLocation(true);
  }
  if ((x.dataset.nc || x.dataset.n10 !== undefined) && x.checked) await native.notificationPermission(true);
  if (x.dataset.nc || x.dataset.n10 !== undefined || isLang) syncDevice();
  if (x.dataset.loc !== undefined) p.loc = x.value;
  if (x.dataset.d) { p.a11y[x.dataset.d] = x.checked; applyA11y(); }
  persist();
});
function handleBack() {
  if (S.authView && S.user.welcomed) { S.authView = null; draw(); return true; }
  if (S.prox) { S.prox = null; draw(); return true; }
  if (S.photoView) { S.photoView = null; draw(); return true; }
  if (S.camera) { stopCamera(); draw(); return true; }
  if (S.detail) { S.detail = null; draw(); return true; }
  if (S.drawer) { S.drawer = false; draw(); return true; }
  if (S.tab === 'report' && S.step > 1 && !S.sent) { S.step--; draw(); return true; }
  if (S.tab !== 'alerts') { goTab('alerts'); return true; }
  return false;
}

/* ============================================================ 15. START-UP */
draw();
loadSaved().finally(() => {
  applyA11y();
  if (!S.auth && !S.user.welcomed) S.authView = 'register'; // first launch: ask to sign in or create an account
  draw();
  if (S.auth) {
    api.me().then((d) => { S.auth.user = d.user; persist(); if (S.tab === 'profile' && !S.authView) draw(); }).catch((e) => {
      if (e.status === 401 || e.status === 403) { signOut(true); S.authView = 'signin'; S.authErr = errMsg(e); draw(); }
    });
  }
  if (S.user.pref.loc === 'Always allow') ensureMapLocation();
  startProximity();
  loadReports();
  setInterval(loadReports, 60000);
  native.onResume(loadReports);
  native.onBackButton(handleBack);
  native.setupPush((token) => { S.pushToken = token; syncDevice(); });
  syncDevice();
});
