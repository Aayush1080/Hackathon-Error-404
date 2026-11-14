/* Map symbols. Incidents are drop-shaped pins with one symbol per preset emergency type; emergency
   services (police, hospitals, clinics, fire stations) are rounded squares, so the two never look alike.
   Plain inline SVG: crisp at any size and identical on every phone. The admin dashboard has a copy. */
const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const SYMBOL = {
  Fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  Flooding: '<path d="M2 7c.6.5 1.2 1 2.5 1C7 8 7 6 9.5 6c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12.5c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  Accident: '<path d="M4 16.5V13l2-5h12l2 5v3.5z"/><path d="M4 13h16"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M9 3.5l1 2M15 3.5l-1 2M12 2.5V5"/>',
  'Falling debris': '<path d="M3 21h18"/><path d="M5 21l4-7 3 3 3-5 4 9"/><path d="M8 3.5l1 1.8M13 2.5l-.2 2.2M17.5 5l-1.2 1.6"/><circle cx="11" cy="9" r="1.2"/>',
  Other: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  police: '<path d="M12 2.5l7.5 3v5.5c0 5-3.5 8.6-7.5 10.5-4-1.9-7.5-5.5-7.5-10.5V5.5z"/><path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="#fff" stroke-width="1"/>',
  hospital: '<path d="M12 5v14M5 12h14" stroke-width="4" stroke-linecap="square"/>',
  clinic: '<path d="M12 6.5v11M6.5 12h11" stroke-width="3" stroke-linecap="square"/><circle cx="12" cy="12" r="9.5" stroke-width="1.6"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#fff" stroke="none"/>',
};
export const CAT_COLOR = { Fire: '#d9480f', Flooding: '#1c64d1', Accident: '#c92a2a', 'Falling debris': '#8a5a14', Other: '#6d3fc0' };
export const PLACE_COLOR = { police: '#1d3a8a', hospital: '#d61f45', clinic: '#0f8a5f', fire: '#b02a0f' };
export const catKey = (c) => (CAT_COLOR[c] ? c : 'Other');

/* Soft rounded tile: tinted background, symbol in the type's colour (cards, lists, sheets). */
export const catTile = (category, size = 44) => {
  const k = catKey(category), c = CAT_COLOR[k], s = Math.round(size * 0.55);
  const body = SYMBOL[k].replace(/fill="#fff"/g, `fill="${c}"`);
  return `<span class="tile" style="--c:${c};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg></span>`;
};
export const placeTile = (type, size = 40) => {
  const c = PLACE_COLOR[type], s = Math.round(size * 0.55);
  return `<span class="tile" style="--c:${c};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYMBOL[type].replace(/#fff/g, c)}</svg></span>`;
};

/* Small round symbol for lists and cards. */
export const catBadge = (category, size = 26) =>
  `<span class="cat-ic" style="background:${CAT_COLOR[catKey(category)]};width:${size}px;height:${size}px">${svg(SYMBOL[catKey(category)], `width="${Math.round(size * 0.66)}" height="${Math.round(size * 0.66)}"`)}</span>`;

/* Leaflet divIcon options for an incident pin. */
export function incidentIcon(L, category, { old = false, closest = false, police = false, label = '' } = {}) {
  const k = catKey(category);
  return L.divIcon({
    className: 'ipin-wrap',
    html: `<div class="ipin${old ? ' ipin-old' : ''}${closest ? ' ipin-near' : ''}${police ? ' ipin-police' : ''}" style="--c:${CAT_COLOR[k]}" title="${label}"><span>${svg(SYMBOL[k])}</span></div>${closest ? '<div class="ipin-star" aria-hidden="true">★</div>' : ''}`,
    iconSize: [34, 34], iconAnchor: [17, 41], popupAnchor: [0, -36], tooltipAnchor: [12, -24],
  });
}

/* Leaflet divIcon options for an emergency service (police station, hospital...). */
export function placeIcon(L, type) {
  return L.divIcon({
    className: 'poi-wrap',
    html: `<div class="poi" style="--c:${PLACE_COLOR[type]}">${svg(SYMBOL[type], 'width="13" height="13"')}</div>`,
    iconSize: [21, 21], iconAnchor: [10, 10], popupAnchor: [0, -10],
  });
}
export const placeBadge = (type) => `<span class="poi poi-inline" style="--c:${PLACE_COLOR[type]}">${svg(SYMBOL[type], 'width="13" height="13"')}</span>`;
