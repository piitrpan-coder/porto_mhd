// ==========================================
// NEARBY PLACES SEARCH MODULE (js/nearby.js)
// ==========================================

const INTL_TO_OSM = { Sun:6, Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5 };
const OSM_DAYS    = { Mo:0, Tu:1, We:2, Th:3, Fr:4, Sa:5, Su:6 };

let _gpsPos = null;
let _gpsPosTime = 0;
let _nearbyDdVal = 'gps';

const NEARBY_CFG = {
  supermarket: { tag: '"shop"="supermarket"',  label: 'Supermarket', radius: 800  },
  cafe:        { tag: '"amenity"="cafe"',       label: 'Kavárna',     radius: 600  },
  restaurant:  { tag: '"amenity"="restaurant"', label: 'Restaurace',  radius: 800  },
  fast_food:   { tag: '"amenity"="fast_food"', label: 'Fast food',   radius: 600  },
  bar:         { tag: '"amenity"="bar"',        label: 'Bar',         radius: 600  },
  pharmacy:    { tag: '"amenity"="pharmacy"',   label: 'Lékárna',     radius: 1000 },
  atm:         { tag: '"amenity"="atm"',        label: 'Bankomat',    radius: 800  },
  fuel:        { tag: '"amenity"="fuel"',       label: 'Benzínka',    radius: 1500 },
  laundry:     { tag: '"shop"="laundry"',       label: 'Prádelna',    radius: 1000 }
};

window.getGpsPos = () => _gpsPos;

function haversineM(la1, ln1, la2, ln2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(la2-la1)/2)**2 + Math.cos(r(la1))*Math.cos(r(la2))*Math.sin(r(ln2-ln1)/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isOpenNow(ohStr, timezone) {
  if (!ohStr) return null;
  ohStr = ohStr.trim();
  if (ohStr === '24/7') return true;
  try {
    const now = new Date();
    const parts = Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const curDay = INTL_TO_OSM[parts.find(p => p.type === 'weekday')?.value || ''] ?? -1;
    if (curDay < 0) return null;
    const curMins = parseInt(parts.find(p => p.type === 'hour')?.value || '0') * 60
                  + parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    let anyDayMatched = false;
    for (const rule of ohStr.split(';').map(s => s.trim()).filter(Boolean)) {
      const m = rule.match(/^([\w,\-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
      if (!m) continue;
      const [, daysPart, openT, closeT] = m;
      let dayMatch = false;
      for (const seg of daysPart.split(',')) {
        const d = seg.split('-');
        if (d.length === 2) {
          const si = OSM_DAYS[d[0]], ei = OSM_DAYS[d[1]];
          if (si !== undefined && ei !== undefined)
            dayMatch = si <= ei ? (curDay >= si && curDay <= ei) : (curDay >= si || curDay <= ei);
        } else { dayMatch = OSM_DAYS[seg] === curDay; }
        if (dayMatch) break;
      }
      if (!dayMatch) continue;
      anyDayMatched = true;
      if (/\soff\s*$/i.test(rule)) continue;
      const [oh, om] = openT.split(':').map(Number);
      const [ch, cm] = closeT.split(':').map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;
      const open = closeMins > openMins
        ? curMins >= openMins && curMins < closeMins
        : curMins >= openMins || curMins < closeMins;
      if (open) return true;
    }
    return anyDayMatched ? false : null;
  } catch {
    return null;
  }
}

function getOpenStatusHtml(ohStr, timezone) {
  if (!ohStr) return '';
  ohStr = ohStr.trim();
  if (ohStr === '24/7') {
    return '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-md ml-1">Otevřeno</span>';
  }
  try {
    const now = new Date();
    const parts = Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const curDay = INTL_TO_OSM[parts.find(p => p.type === 'weekday')?.value || ''] ?? -1;
    if (curDay < 0) return '';
    const curMins = parseInt(parts.find(p => p.type === 'hour')?.value || '0') * 60
                  + parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    let anyDayMatched = false;
    let opensLaterToday = null;

    for (const rule of ohStr.split(';').map(s => s.trim()).filter(Boolean)) {
      const m = rule.match(/^([\w,\-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
      if (!m) continue;
      const [, daysPart, openT, closeT] = m;
      let dayMatch = false;
      for (const seg of daysPart.split(',')) {
        const d = seg.split('-');
        if (d.length === 2) {
          const si = OSM_DAYS[d[0]], ei = OSM_DAYS[d[1]];
          if (si !== undefined && ei !== undefined)
            dayMatch = si <= ei ? (curDay >= si && curDay <= ei) : (curDay >= si || curDay <= ei);
        } else { dayMatch = OSM_DAYS[seg] === curDay; }
        if (dayMatch) break;
      }
      if (!dayMatch) continue;
      anyDayMatched = true;
      if (/\soff\s*$/i.test(rule)) continue;
      
      const [oh, om] = openT.split(':').map(Number);
      const [ch, cm] = closeT.split(':').map(Number);
      const openMins = oh * 60 + om;
      const closeMins = ch * 60 + cm;
      
      const open = closeMins > openMins
        ? curMins >= openMins && curMins < closeMins
        : curMins >= openMins || curMins < closeMins;
      
      if (open) {
        return '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-md ml-1">Otevřeno</span>';
      }
      
      if (curMins < openMins) {
        if (opensLaterToday === null || openMins < opensLaterToday.mins) {
          opensLaterToday = { label: openT, mins: openMins };
        }
      }
    }
    
    if (opensLaterToday) {
      return `<span class="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded-md ml-1">Otevírá v ${opensLaterToday.label}</span>`;
    }
    
    return anyDayMatched 
      ? '<span class="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-md ml-1">Zavřeno</span>'
      : '';
  } catch {
    return '';
  }
}

function toggleNearbyDd(e) {
  e && e.stopPropagation();
  const menu  = document.getElementById('nearby-dd-menu');
  const arrow = document.getElementById('nearby-dd-arrow');
  if (!menu) return;
  const opening = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  if (arrow) arrow.style.transform = opening ? 'rotate(180deg)' : '';
  if (opening) {
    setTimeout(() => {
      document.addEventListener('click', function close(ev) {
        if (!document.getElementById('nearby-dd-wrap')?.contains(ev.target)) {
          menu.classList.add('hidden');
          if (arrow) arrow.style.transform = '';
        }
        document.removeEventListener('click', close);
      });
    }, 0);
  }
}

function selectNearbyLoc(val, label) {
  _nearbyDdVal = val;
  const lbl = document.getElementById('nearby-dd-label');
  if (lbl) lbl.textContent = label;
  document.getElementById('nearby-dd-menu')?.classList.add('hidden');
  const arrow = document.getElementById('nearby-dd-arrow');
  if (arrow) arrow.style.transform = '';
  document.getElementById('nearby-results').innerHTML = '';
  document.querySelectorAll('.nearby-cat-btn').forEach(b => b.classList.remove('ring-1','ring-yellow-400','text-yellow-400'));
}

function populateNearbyDd(options) {
  const menu = document.getElementById('nearby-dd-menu');
  if (!menu) return;
  menu.innerHTML = options.map(opt => {
    const active = opt.val === _nearbyDdVal;
    const safeLabel = opt.label.replace(/"/g, '&quot;');
    return `<button data-val="${opt.val}" data-label="${safeLabel}" onclick="selectNearbyLoc(this.dataset.val, this.dataset.label)"
      class="nearby-dd-opt w-full text-left px-4 py-3.5 text-sm hover:bg-slate-700 flex items-center gap-2 transition ${active ? 'text-yellow-400 font-bold bg-slate-700/50' : 'text-slate-200'}">
      <span class="truncate">${opt.label}</span>
      ${active ? '<svg class="w-4 h-4 shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
    </button>`;
  }).join('');
}

function saveNearbyPoi(name, lat, lng) {
  const pois = loadPois();
  if (pois.some(p => p.lat && Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001)) {
    showToast('Místo je již uloženo.'); return;
  }
  pois.push({ emoji: '📍', name, address: lat.toFixed(5) + ', ' + lng.toFixed(5), lat, lng });
  savePois(pois);
  applyPlaces();
  showToast('📍 ' + name + ' uloženo!');
}

async function fetchNearby(btn, category) {
  const val = _nearbyDdVal;
  const timezone = currentCity?.timezone || 'Europe/Lisbon';
  let lat, lng;

  const results = document.getElementById('nearby-results');
  document.querySelectorAll('.nearby-cat-btn').forEach(b => b.classList.remove('ring-1','ring-yellow-400','text-yellow-400'));
  btn.classList.add('ring-1','ring-yellow-400','text-yellow-400');

  if (val === 'gps') {
    if (!_gpsPos || Date.now() - _gpsPosTime > 60000) {
      results.innerHTML = '<p class="text-slate-500 text-center py-3 text-xs">Zjišťuji polohu…</p>';
      try {
        const pos = await new Promise((res, rej) => {
          if (!navigator.geolocation) return rej(new Error('no-geo'));
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true });
        });
        _gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _gpsPosTime = Date.now();
      } catch {
        _gpsPos = null;
        const h = loadHome();
        lat = h.lat; lng = h.lng;
        showToast('GPS nedostupné – hledám od ubytování.');
      }
    }
    if (_gpsPos) { lat = _gpsPos.lat; lng = _gpsPos.lng; }
  } else if (val === 'home') {
    const h = loadHome(); lat = h.lat; lng = h.lng;
  } else {
    const idx = parseInt(val.replace('poi_', ''));
    const poi = loadPois()[idx];
    if (!poi || !poi.lat) { showToast('Toto místo nemá souřadnice.'); return; }
    lat = poi.lat; lng = poi.lng;
  }

  results.innerHTML = '<div class="space-y-2">'
    + [1,2,3].map(() => '<div class="h-14 rounded-xl bg-slate-800/60 animate-pulse"></div>').join('')
    + '</div>';

  const cfg = NEARBY_CFG[category];
  const q = `[out:json][timeout:12];(node[${cfg.tag}](around:${cfg.radius},${lat},${lng});way[${cfg.tag}](around:${cfg.radius},${lat},${lng}););out center 15;`;
  const cacheKey = `nearby_${category}_${Math.round(lat * 100)}_${Math.round(lng * 100)}`;

  let result;
  try {
    result = await apiFetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q, _timeout: 12000 }, cacheKey);
  } catch {
    results.innerHTML = '<p class="text-red-400 text-center py-3 text-[11px]">Chyba – zkontroluj připojení a zkus znovu.</p>';
    return;
  }

  const { data, fromCache, cachedAt } = result;
  const places = (data.elements || [])
    .map(el => {
      const elat = el.lat ?? el.center?.lat, elng = el.lon ?? el.center?.lon;
      if (!elat) return null;
      const tags = el.tags || {};
      return {
        name: tags.name || tags['name:en'] || cfg.label,
        dist: Math.round(haversineM(lat, lng, elat, elng)),
        oh: tags.opening_hours || null,
        stars: tags.stars || null,
        elat, elng
      };
    })
    .filter(Boolean).sort((a, b) => a.dist - b.dist).slice(0, 10);

  const stale = fromCache ? staleDataHtml(cachedAt, timezone) : '';

  if (!places.length) {
    results.innerHTML = stale + '<p class="text-slate-500 text-center py-3 text-xs">Nic v okolí ' + cfg.radius + ' m nenalezeno.</p>';
    return;
  }

  const cards = places.map(p => {
    const openBadge = getOpenStatusHtml(p.oh, timezone);
    const starsHtml = p.stars ? ' <span class="text-xs text-yellow-400 ml-1">★ ' + p.stars + '</span>' : '';
    const safeName = p.name.replace(/"/g, '&quot;');
    return '<div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 gap-3">'
      + '<div class="flex-1 min-w-0">'
      + '<div class="flex items-center flex-wrap mb-0.5">'
      + '<span class="text-slate-100 font-bold text-sm truncate">' + p.name + '</span>'
      + openBadge + starsHtml
      + '</div>'
      + '<span class="text-slate-500 text-xs font-mono">' + p.dist + ' m · ~' + Math.ceil(p.dist / 75) + ' min chůze</span>'
      + '</div>'
      + '<div class="flex items-center gap-1.5 shrink-0">'
      + '<button data-name="' + safeName + '" data-lat="' + p.elat + '" data-lng="' + p.elng + '" onclick="saveNearbyPoi(this.dataset.name,+this.dataset.lat,+this.dataset.lng)"'
      + ' class="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 text-xs px-2 py-2 rounded-xl font-bold transition cursor-pointer">+ Uložit</button>'
      + '<a href="https://www.google.com/maps/search/?api=1&query=' + p.elat + ',' + p.elng + '" target="_blank" rel="noopener" '
      + 'class="bg-slate-700 hover:bg-slate-600 active:scale-95 text-yellow-400 text-sm px-3 py-2 rounded-xl font-bold transition">Mapa</a>'
      + '</div>'
      + '</div>';
  }).join('');

  results.innerHTML = stale + cards;
}
