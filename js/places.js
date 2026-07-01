// ==========================================
// PLACES & ADDRESSES MANAGEMENT (js/places.js)
// ==========================================

const PlacesManager = {
  loadHome(cityId) {
    const city = CITIES.find(c => c.id === cityId);
    const stored = StorageSchema.load(`app_${cityId}_home`);
    return { ...city?.defaultHome, ...stored };
  },

  saveHome(cityId, home) {
    StorageSchema.save(`app_${cityId}_home`, home);
    StateManager.set(cityId, 'places.home', home);
  },

  loadPois(cityId) {
    return StorageSchema.load(`app_${cityId}_pois`, []);
  },

  savePois(cityId, pois) {
    StorageSchema.save(`app_${cityId}_pois`, pois);
    StateManager.set(cityId, 'places.pois', pois);
  },

  addPoi(cityId, poi) {
    const pois = this.loadPois(cityId);
    pois.push(poi);
    this.savePois(cityId, pois);
  },

  deletePoi(cityId, index) {
    const pois = this.loadPois(cityId);
    pois.splice(index, 1);
    this.savePois(cityId, pois);
  },

  toggleFavorite(cityId, index) {
    const pois = this.loadPois(cityId);
    if (pois[index]) {
      pois[index].favorite = !pois[index].favorite;
      this.savePois(cityId, pois);
    }
  }
};

let _poiFilter = 'all';

function setPoiFilter(filter) {
  _poiFilter = filter;
  renderPlacesModal();
}

function loadHome() { return PlacesManager.loadHome(currentCity?.id); }
function loadPois() { return PlacesManager.loadPois(currentCity?.id); }
function savePois(pois) { PlacesManager.savePois(currentCity?.id, pois); }
function deletePoi(index) { PlacesManager.deletePoi(currentCity?.id, index); renderPlacesModal(); applyPlaces(); }
function togglePoiFavorite(index) { PlacesManager.toggleFavorite(currentCity?.id, index); renderPlacesModal(); applyPlaces(); }

function addPoi() {
  const emoji   = (document.getElementById('modal-poi-emoji')?.value.trim()   || '📍');
  const name    =  document.getElementById('modal-poi-name')?.value.trim()    || '';
  const address =  document.getElementById('modal-poi-address')?.value.trim() || '';
  const lat     = parseFloat(document.getElementById('modal-poi-lat')?.value)  || null;
  const lng     = parseFloat(document.getElementById('modal-poi-lng')?.value)  || null;
  if (!name) { showToast('Vyplň název místa.'); return; }
  PlacesManager.addPoi(currentCity?.id, { emoji, name, address: address || name, lat, lng });
  ['modal-poi-emoji','modal-poi-name','modal-poi-address','modal-poi-lat','modal-poi-lng'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderPlacesModal();
  applyPlaces();
  showToast('📍 ' + name + ' přidáno!');
}

function saveHomeSettings() {
  const name    = document.getElementById('modal-home-name')?.value.trim()    || '';
  const address = document.getElementById('modal-home-address')?.value.trim() || '';
  const lat     = parseFloat(document.getElementById('modal-home-lat')?.value)  || null;
  const lng     = parseFloat(document.getElementById('modal-home-lng')?.value)  || null;
  if (!name || !address) { showToast('Vyplň název a adresu.'); return; }
  PlacesManager.saveHome(currentCity?.id, { name, address, lat, lng });
  applyPlaces();
  showToast('Ubytování uloženo ✓');
}

function resetHomeSettings() {
  const city = CITIES.find(c => c.id === currentCity?.id);
  if (!city) return;
  StorageSchema.save(`app_${currentCity.id}_home`, null);
  StateManager.set(currentCity.id, 'places.home', city.defaultHome);
  renderPlacesModal();
  applyPlaces();
  showToast('Ubytování resetováno.');
}

function applyPlaces() {
  if (!currentCity) return;
  const home = PlacesManager.loadHome(currentCity.id);
  const pois = PlacesManager.loadPois(currentCity.id);
  const opts = [
    { val: 'gps',  label: '📍 Moje poloha (GPS)' },
    { val: 'home', label: '🏠 ' + (home?.name || 'Ubytování') }
  ];
  // Favorites first, then the rest
  const sorted = [...pois].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  sorted.filter(p => p.lat && p.lng).forEach((p, i) => {
    const heart = p.favorite ? '❤️ ' : '';
    opts.push({ val: 'poi_' + pois.indexOf(p), label: heart + (p.emoji || '📍') + ' ' + p.name });
  });
  populateNearbyDd(opts);

  const overviewHomeLabel = document.getElementById('overview-home-address');
  if (overviewHomeLabel) {
    overviewHomeLabel.textContent = home?.name || home?.address || 'Ubytování';
  }
}

let _editingPoiIdx = null;

function startEditPoi(idx) {
  _editingPoiIdx = idx;
  renderPlacesModal();
}

function cancelEditPoi() {
  _editingPoiIdx = null;
  renderPlacesModal();
}

function saveEditPoi(idx) {
  const nameInput = document.getElementById(`edit-poi-name-${idx}`);
  const noteInput = document.getElementById(`edit-poi-note-${idx}`);
  if (!nameInput) return;
  const name = nameInput.value.trim();
  const note = noteInput ? noteInput.value.trim() : '';
  if (!name) { showToast('Název nesmí být prázdný.'); return; }
  
  const pois = PlacesManager.loadPois(currentCity.id);
  if (pois[idx]) {
    pois[idx].name = name;
    pois[idx].note = note;
    PlacesManager.savePois(currentCity.id, pois);
    _editingPoiIdx = null;
    renderPlacesModal();
    applyPlaces();
    showToast('Místo aktualizováno.');
  }
}

function renderPlacesModal() {
  if (!currentCity) return;
  const h = PlacesManager.loadHome(currentCity.id);
  const ni  = document.getElementById('modal-home-name');    if (ni)  ni.value  = h.name;
  const ai  = document.getElementById('modal-home-address'); if (ai)  ai.value  = h.address;
  const lti = document.getElementById('modal-home-lat');     if (lti) lti.value = h.lat;
  const lni = document.getElementById('modal-home-lng');     if (lni) lni.value = h.lng;

  const allPois = PlacesManager.loadPois(currentCity.id);
  const list = document.getElementById('modal-poi-list');
  if (!list) return;

  const hasFavs = allPois.some(p => p.favorite);
  const filterBar = `
    <div class="flex gap-1.5 mb-3">
      <button onclick="setPoiFilter('all')"
        class="px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer select-none ${_poiFilter === 'all' ? 'bg-yellow-500/15 border-yellow-600/30 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-400'}">
        Vše (${allPois.length})
      </button>
      <button onclick="setPoiFilter('fav')"
        class="px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer select-none ${_poiFilter === 'fav' ? 'bg-red-500/15 border-red-600/30 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400'}">
        ❤️ Oblíbené (${allPois.filter(p => p.favorite).length})
      </button>
    </div>`;

  const pois = _poiFilter === 'fav' ? allPois.filter(p => p.favorite) : allPois;

  if (allPois.length === 0) {
    list.innerHTML = `<div class="text-center py-8 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
       <div class="text-4xl mb-3">📍</div>
       <p class="text-sm font-bold text-slate-300">Zatím žádná uložená místa</p>
       <p class="text-xs text-slate-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
         Vyhledej si zajímavá místa v okolí na kartě Přehled a klikni na <strong>+ Uložit</strong>, nebo zadej vlastní souřadnice níže.
       </p>
     </div>`;
    return;
  }

  const emptyFav = _poiFilter === 'fav' && pois.length === 0
    ? `<p class="text-xs text-slate-500 italic text-center py-4">Žádná oblíbená místa. Klepni na 🤍 u místa pro přidání.</p>`
    : '';

  list.innerHTML = filterBar + emptyFav + pois.map((p) => {
      const i = allPois.indexOf(p);
      if (_editingPoiIdx === i) {
        return `
          <div class="p-3.5 rounded-xl bg-slate-950/40 border border-slate-700/50 space-y-2.5">
            <div class="flex gap-2">
              <input id="edit-poi-name-${i}" type="text" value="${p.name}" placeholder="Název" class="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none">
              <input id="edit-poi-note-${i}" type="text" value="${p.note || ''}" placeholder="Poznámka (např. kafe)" class="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none">
            </div>
            <div class="flex justify-end gap-1.5 text-xs">
              <button onclick="cancelEditPoi()" class="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer">Zrušit</button>
              <button onclick="saveEditPoi(${i})" class="px-2.5 py-1 rounded bg-yellow-500 text-slate-950 font-bold cursor-pointer">Uložit</button>
            </div>
          </div>`;
      }
      const noteHtml = p.note ? `<div class="text-[10px] text-yellow-400/80 mt-0.5 font-medium truncate">📝 ${p.note}</div>` : '';
      const heartIcon = p.favorite ? '❤️' : '🤍';
      return `
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border ${p.favorite ? 'border-red-900/40' : 'border-slate-800/50'} gap-2">
          <div class="truncate flex-1 cursor-pointer" data-addr="${p.address.replace(/"/g, '&quot;')}" onclick="copyToClipboard(this.dataset.addr)">
            <span class="text-sm font-bold text-slate-200 block truncate">${p.emoji || '📍'} ${p.name}</span>
            <span class="text-xs text-slate-500 block truncate">${p.address} <span class="text-slate-700">· klepni pro kopírování</span></span>
            ${noteHtml}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="togglePoiFavorite(${i})" class="text-lg px-1.5 py-1.5 transition cursor-pointer select-none active:scale-90" aria-label="Oblíbené">${heartIcon}</button>
            <button onclick="startEditPoi(${i})" class="text-slate-400 hover:text-yellow-400 text-sm px-1.5 py-1.5 transition cursor-pointer select-none" aria-label="Upravit">✏️</button>
            <button onclick="deletePoi(${i})" class="text-slate-500 hover:text-red-400 text-base px-1.5 py-1.5 transition cursor-pointer select-none" aria-label="Odstranit ${p.name}">✕</button>
          </div>
        </div>`;
    }).join('');
}

// Backup & Recovery
const BackupManager = {
  exportData(cityId) {
    const data = {
      version: 2.0,
      cityId,
      home: PlacesManager.loadHome(cityId),
      pois: PlacesManager.loadPois(cityId),
      planner: typeof PlannerManager !== 'undefined' ? PlannerManager.load(cityId) : []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guide_backup_${cityId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Záloha stažena ✓');
  },
  importData(cityId, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || data.cityId !== cityId) {
          showToast('Chyba: Záloha patří jinému městu.');
          return;
        }
        if (data.home) {
          localStorage.setItem(`app_${cityId}_home`, JSON.stringify(data.home));
        }
        if (data.pois) {
          localStorage.setItem(`app_${cityId}_pois`, JSON.stringify(data.pois));
        }
        if (data.planner) {
          localStorage.setItem(`app_${cityId}_planner`, JSON.stringify(data.planner));
        }
        
        // Refresh UI
        applyPlaces();
        renderPlacesModal();
        if (typeof renderPlannerItems === 'function') {
          renderPlannerItems(cityId);
        }
        showToast('Záloha úspěšně nahrána! ✓');
      } catch {
        showToast('Chyba: Neplatný formát zálohy.');
      }
    };
    reader.readAsText(file);
  }
};

function exportBackup() {
  if (currentCity) BackupManager.exportData(currentCity.id);
}

function importBackup(inputEl) {
  if (currentCity && inputEl.files && inputEl.files[0]) {
    BackupManager.importData(currentCity.id, inputEl.files[0]);
    inputEl.value = '';
  }
}

function openPlacesModal() {
  renderPlacesModal();
  document.getElementById('places-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePlacesModal() {
  document.getElementById('places-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// Nominatim Geocoding
let _nominatimTimer = null;

function geocodeAddressField(addressId, latId, lngId) {
  const address = (document.getElementById(addressId) || {}).value?.trim();
  if (!address) return;
  const latEl = document.getElementById(latId);
  const lngEl = document.getElementById(lngId);
  if (!latEl || !lngEl) return;
  if (latEl.value && lngEl.value) return;

  fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1', {
    headers: { 'Accept-Language': 'cs,en' }
  })
    .then(r => r.json())
    .then(data => {
      if (!data.length) { showToast('Adresa nenalezena – souřadnice doplň ručně.'); return; }
      latEl.value = parseFloat(data[0].lat);
      lngEl.value = parseFloat(data[0].lon);
      showToast('Souřadnice doplněny ✓');
    })
    .catch(() => showToast('Chyba připojení.'));
}

function nominatimSearch(inputId, resultsId) {
  const query = (document.getElementById(inputId) || {}).value || '';
  const list = document.getElementById(resultsId);
  if (!list) return;
  clearTimeout(_nominatimTimer);
  if (query.trim().length < 3) { list.classList.add('hidden'); list.innerHTML = ''; return; }

  const coordMatch = query.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);

  _nominatimTimer = setTimeout(() => {
    list.innerHTML = '<div class="px-3 py-2 text-slate-500 text-xs">Hledám…</div>';
    list.classList.remove('hidden');

    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]), lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json', {
          headers: { 'Accept-Language': 'cs,en' }
        })
          .then(r => r.json())
          .then(data => {
            const name = data.name || data.display_name?.split(',')[0] || 'Zadané souřadnice';
            list.innerHTML = '<div class="px-3 py-2.5 cursor-pointer hover:bg-slate-700 active:bg-slate-600 transition">'
              + '<div class="font-semibold text-slate-100 text-xs">' + name + '</div>'
              + '<div class="text-[10px] text-slate-400 truncate">' + (data.display_name || lat + ', ' + lon) + '</div></div>';
            list.querySelector('div > div').parentElement.addEventListener('click', () =>
              nominatimFill(resultsId, { ...data, lat: String(lat), lon: String(lon) })
            );
          })
          .catch(() => {
            const fallback = { lat: String(lat), lon: String(lon), name: 'Zadané souřadnice', display_name: lat + ', ' + lon };
            list.innerHTML = '<div class="px-3 py-2.5 cursor-pointer hover:bg-slate-700 active:bg-slate-600 transition">'
              + '<div class="font-semibold text-slate-100 text-xs">Zadané souřadnice</div>'
              + '<div class="text-[10px] text-slate-400">' + lat + ', ' + lon + '</div></div>';
            list.querySelector('div > div').parentElement.addEventListener('click', () => nominatimFill(resultsId, fallback));
          });
        return;
      }
    }

    fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5&addressdetails=1', {
      headers: { 'Accept-Language': 'cs,en' }
    })
      .then(r => r.json())
      .then(data => {
        if (!data.length) { list.innerHTML = '<div class="px-3 py-2 text-slate-500 text-xs">Nic nenalezeno.</div>'; return; }
        list.innerHTML = data.map((item, i) =>
          '<div data-idx="' + i + '" class="px-3 py-2.5 border-b border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-700 active:bg-slate-600 transition">'
          + '<div class="font-semibold text-slate-100 text-xs">' + (item.name || item.display_name.split(',')[0]) + '</div>'
          + '<div class="text-[10px] text-slate-400 truncate">' + item.display_name + '</div></div>'
        ).join('');
        list.querySelectorAll('[data-idx]').forEach(el => {
          el.addEventListener('click', () => nominatimFill(resultsId, data[parseInt(el.dataset.idx)]));
        });
      })
      .catch(() => { list.innerHTML = '<div class="px-3 py-2 text-red-400 text-xs">Chyba připojení.</div>'; });
  }, 400);
}

function nominatimFill(resultsId, item) {
  const shortName = item.name || item.display_name.split(',')[0];
  const lat = parseFloat(item.lat), lng = parseFloat(item.lon);
  if (resultsId === 'modal-home-results') {
    document.getElementById('modal-home-name').value    = shortName;
    document.getElementById('modal-home-address').value = item.display_name;
    document.getElementById('modal-home-lat').value     = lat;
    document.getElementById('modal-home-lng').value     = lng;
    document.getElementById('modal-home-search').value  = '';
  } else {
    document.getElementById('modal-poi-name').value    = shortName;
    document.getElementById('modal-poi-address').value = item.display_name;
    document.getElementById('modal-poi-lat').value     = lat;
    document.getElementById('modal-poi-lng').value     = lng;
    document.getElementById('modal-poi-search').value  = '';
  }
  const list = document.getElementById(resultsId);
  list.classList.add('hidden'); list.innerHTML = '';
}

document.addEventListener('click', e => {
  ['modal-home-results', 'modal-poi-results'].forEach(id => {
    const list = document.getElementById(id);
    if (list && !list.classList.contains('hidden') && !list.contains(e.target)) {
      const inputId = id.replace('-results', '-search');
      if (e.target.id !== inputId) { list.classList.add('hidden'); list.innerHTML = ''; }
    }
  });
});
