// ==========================================
// CORE UI & GESTURE SYSTEM (js/ui.js)
// ==========================================

// Map State & Zoom Utility
let currentMapZoom = 1, mapTransX = 0, mapTransY = 0;

function applyMapTransform() {
  const w = document.getElementById('map-svg-wrapper');
  if (w) w.style.transform = `scale(${currentMapZoom}) translate(${mapTransX}px,${mapTransY}px)`;
}

function zoomMap(factor) {
  currentMapZoom = Math.min(Math.max(currentMapZoom * factor, 0.4), 3.5);
  applyMapTransform();
}

function resetZoom() {
  currentMapZoom = 1; mapTransX = 0; mapTransY = 0; applyMapTransform();
}

function initMap() {
  currentMapZoom = 1; mapTransX = 0; mapTransY = 0;
  setTimeout(() => {
    const container = document.getElementById('map-container');
    if (!container) return;
    let lastDist = 0, pinching = false;
    let dsx = 0, dsy = 0, dstx = 0, dsty = 0;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    container.addEventListener('touchstart', e => {
      if (e.touches.length === 2) { lastDist = dist(e.touches); pinching = true; e.preventDefault(); }
      else if (e.touches.length === 1) {
        dsx = e.touches[0].clientX; dsy = e.touches[0].clientY;
        dstx = mapTransX; dsty = mapTransY; pinching = false;
      }
    }, { passive: false });
    container.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && pinching) {
        const d = dist(e.touches);
        currentMapZoom = Math.min(Math.max(currentMapZoom * (d / lastDist), 0.4), 3.5);
        lastDist = d; applyMapTransform(); e.preventDefault();
      } else if (e.touches.length === 1 && !pinching) {
        mapTransX = dstx + (e.touches[0].clientX - dsx) / currentMapZoom;
        mapTransY = dsty + (e.touches[0].clientY - dsy) / currentMapZoom;
        applyMapTransform(); e.preventDefault();
      }
    }, { passive: false });
    container.addEventListener('touchend', () => { pinching = false; });
  }, 100);
}

// Sharing Utility
function shareLink(title, text, url) {
  if (navigator.share) {
    navigator.share({
      title: title,
      text: text,
      url: url || window.location.href
    }).catch(err => console.log('Sdílení zrušeno', err));
  } else {
    copyToClipboard(text + (url ? ' ' + url : ''));
    showToast('Sdílení nepodporováno – zkopírováno.');
  }
}

// Theme Toggle System
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('app_theme', isLight ? 'light' : 'dark');
  updateThemeButtons();
}

function updateThemeButtons() {
  const isLight = document.body.classList.contains('light-theme');
  const btnHeader = document.getElementById('theme-toggle');
  const btnPicker = document.getElementById('picker-theme-toggle');
  const icon = isLight ? '🌙' : '☀️';
  if (btnHeader) btnHeader.textContent = icon;
  if (btnPicker) btnPicker.textContent = icon;
}

// Gesture System (Swipe & Pull-to-refresh)
function initSwipe() {
  const el = document.getElementById('app-main');
  if (!el || el._swipeOk) return;
  el._swipeOk = true;
  let sx, sy, st;
  el.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    const dt = Date.now() - st;
    sx = null;
    if (Math.abs(dx) < 55 || Math.abs(dy) > 90 || dt > 420) return;
    const city = currentCity; if (!city) return;
    const tabs = city.tabs;
    const idx = tabs.findIndex(t => !document.getElementById('section-' + t.id)?.classList.contains('hidden'));
    if (idx === -1) return;
    if (dx < 0 && idx < tabs.length - 1) switchTab(tabs[idx + 1].id);
    if (dx > 0 && idx > 0) switchTab(tabs[idx - 1].id);
  }, { passive: true });
}

function initPullToRefresh() {
  const container = document.getElementById('app-main');
  if (!container) return;

  let startY = 0;
  let pulling = false;
  
  let ptr = document.getElementById('ptr-indicator');
  if (!ptr) {
    ptr = document.createElement('div');
    ptr.id = 'ptr-indicator';
    ptr.style.cssText = 'height:0px; overflow:hidden; display:flex; align-items:center; justify-content:center; text-align:center; font-size:12px; color:#94a3b8; transition:height 0.15s ease, opacity 0.15s ease; opacity:0; background:rgba(15,23,42,0.6); border-radius:12px; margin-bottom:8px;';
    ptr.innerHTML = '<span id="ptr-arrow" style="transition:transform 0.15s; margin-right:6px;">↓</span><span id="ptr-text">Táhnutím obnovíte…</span>';
    container.parentNode.insertBefore(ptr, container);
  }

  container.addEventListener('touchstart', e => {
    if (container.scrollTop === 0 && e.touches.length === 1) {
      startY = e.touches[0].clientY;
      pulling = true;
    } else {
      pulling = false;
    }
  });

  container.addEventListener('touchmove', e => {
    if (!pulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    if (diff > 0) {
      if (diff > 10) e.preventDefault();
      
      const height = Math.min(diff * 0.4, 60);
      ptr.style.height = height + 'px';
      ptr.style.opacity = (height / 60);
      
      const arrow = document.getElementById('ptr-arrow');
      const text = document.getElementById('ptr-text');
      if (height >= 50) {
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        if (text) text.textContent = 'Pusťte pro obnovení…';
      } else {
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        if (text) text.textContent = 'Táhnutím obnovíte…';
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', async e => {
    if (!pulling) return;
    pulling = false;
    const arrow = document.getElementById('ptr-arrow');
    const text = document.getElementById('ptr-text');
    
    if (parseInt(ptr.style.height) >= 50) {
      ptr.style.height = '45px';
      if (arrow) arrow.innerHTML = '🔄';
      if (arrow) arrow.className = 'spin';
      if (text) text.textContent = 'Aktualizuji…';
      
      try {
        if (currentCity) {
          await Promise.all([
            WeatherModule.fetch(currentCity, true),
            ExchangeRateModule.fetch()
          ]);
          showToast('Data aktualizována.');
        }
      } catch (err) {
        showToast('Chyba při aktualizaci.');
      }
    }
    
    setTimeout(() => {
      ptr.style.height = '0px';
      ptr.style.opacity = '0';
      setTimeout(() => {
        if (arrow) {
          arrow.innerHTML = '↓';
          arrow.className = '';
          arrow.style.transform = 'rotate(0deg)';
        }
        if (text) text.textContent = 'Táhnutím obnovíte…';
      }, 150);
    }, 600);
  });
}

// Router & Tab Switches
function switchTab(tabId) {
  const city = currentCity;
  if (!city) return;
  city.tabs.forEach(tab => {
    const sec = document.getElementById('section-' + tab.id);
    const btn = document.getElementById('tab-btn-' + tab.id);
    if (!sec || !btn) return;
    if (tab.id === tabId) {
      sec.classList.remove('hidden');
      btn.style.color = city.color;
      btn.style.background = 'rgba(255,255,255,0.07)';
      if (tabId === 'places') applyPlaces();
    } else {
      sec.classList.add('hidden');
      btn.style.color = '#475569';
      btn.style.background = '';
    }
  });

  const container = document.getElementById('app-main');
  if (container) container.scrollTop = 0;
}

function showCityPicker() {
  localStorage.removeItem('app_last_city');
  document.getElementById('city-picker').classList.remove('hidden');
  document.getElementById('city-app').classList.add('hidden');
  document.getElementById('app-header').style.borderColor = '';
  document.getElementById('app-nav').style.borderColor = '';

  if (currentCity) {
    CityLifecycle.exit(currentCity);
  }
  updateThemeButtons();
}

function renderCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;

  // Save last opened city
  localStorage.setItem('app_last_city', cityId);

  // Setup city-app header colors
  document.getElementById('city-picker').classList.add('hidden');
  document.getElementById('city-app').classList.remove('hidden');
  document.getElementById('city-emoji').textContent = city.emoji;
  document.getElementById('city-name-header').textContent = city.name;
  document.getElementById('city-name-header').style.color = city.color;

  // Header bottom borders matching city accent colors
  document.getElementById('app-header').style.borderColor = city.color + '66';
  document.getElementById('app-nav').style.borderColor = city.color + '66';

  // Navigation tabs
  document.getElementById('tab-buttons').innerHTML = city.tabs.map(tab => `
    <button id="tab-btn-${tab.id}" onclick="switchTab('${tab.id}')"
      class="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-all duration-150 cursor-pointer select-none"
      style="color:#475569">
      <span class="text-xl leading-none">${tab.icon}</span>
      <span class="text-[11px] font-bold mt-1 leading-none">${tab.label}</span>
    </button>`).join('');

  // Tab content
  document.getElementById('app-main').innerHTML = city.tabs.map(tab => `
    <section id="section-${tab.id}" class="animate-fade-in space-y-4 hidden">
      ${renderTabContent(tab.id, city)}
    </section>`).join('');

  // UI init
  initMap();
  updateOnlineStatus();

  // Show first tab
  switchTab(city.tabs[0].id);
  initSwipe();
  applyPlaces();
  initPullToRefresh();
  updateThemeButtons();
}

function updateClock(city) {
  try {
    const now = new Date();
    const t = now.toLocaleTimeString('cs-CZ', { timeZone:city.timezone, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    const d = now.toLocaleDateString('cs-CZ', { timeZone:city.timezone, weekday:'long', day:'numeric', month:'long' });
    const te = document.getElementById('city-time');
    const de = document.getElementById('city-date');
    if (te) te.textContent = city.timeLabel + ': ' + t;
    if (de) de.textContent = d;
  } catch(e) {}
}

// Lagos Specific Geolocation
function locateMeLagos() {
  const btn = document.getElementById('locate-btn-lagos');
  const result = document.getElementById('locate-result-lagos');
  if (!btn || !result) return;
  btn.textContent = '⏳ Zjišťuji polohu…'; btn.disabled = true;
  if (!navigator.geolocation) {
    result.textContent = 'Geolokace není k dispozici v tomto prohlížeči.';
    result.classList.remove('hidden');
    btn.innerHTML = '<span>📍</span><span>Zobrazit moji polohu v Google Maps</span>';
    btn.disabled = false; return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapsUrl = 'https://www.google.com/maps?q=' + lat + ',' + lng;
      result.innerHTML = '<p class="text-xs text-slate-300 mb-2">📍 Tvoje poloha: <span class="font-mono text-cyan-400">' + lat + ', ' + lng + '</span></p>'
        + '<a href="' + mapsUrl + '" target="_blank" class="text-xs text-cyan-400 underline font-bold">Otevřít v Google Maps ↗</a>';
      result.classList.remove('hidden');
      btn.innerHTML = '<span>📍</span><span>Zobrazit moji polohu v Google Maps</span>';
      btn.disabled = false;
    },
    () => {
      result.textContent = 'Nepodařilo se zjistit polohu. Povol přístup k poloze v nastavení prohlížeče.';
      result.classList.remove('hidden');
      btn.innerHTML = '<span>📍</span><span>Zobrazit moji polohu v Google Maps</span>';
      btn.disabled = false;
    },
    { timeout:10000, maximumAge:60000 }
  );
}

// ==========================================
// PHOTO MANAGEMENT & PHOTO SPOT LOGIC
// ==========================================
const _fetchingPhotos = new Set();

function _triggerPhotoFetch(type, cityId) {
  const items = type === 'itin' ? getCustomItineraries(cityId) : getCustomPhotoSpots(cityId);
  const pending = items.filter(it => it.photoQuery && !loadPhoto(it._id));
  if (!pending.length) return;
  if (!navigator.onLine) return;
  const wifi = isOnWifi();
  if (wifi === false) return;
  scheduleFetchPhotos(type, cityId, pending);
}

function scheduleFetchPhotos(type, cityId, items) {
  items.forEach(item => {
    const key = `${type}_${cityId}_${item._id}`;
    if (_fetchingPhotos.has(key)) return;
    if (loadPhoto(item._id)) return;
    _fetchingPhotos.add(key);
    fetchAndStorePhoto(type, cityId, item)
      .finally(() => _fetchingPhotos.delete(key));
  });
}

async function fetchAndStorePhoto(type, cityId, item) {
  try {
    const imgUrl = await fetchWikipediaThumb(item.photoQuery);
    if (!imgUrl) return;

    const resp = await fetch(imgUrl);
    if (!resp.ok) return;
    const blob = await resp.blob();
    const dataUrl = await blobToDataUrl(blob);
    const compressed = await compressImage(dataUrl);
    if (!savePhoto(item._id, compressed)) return;

    const safeId = item._id.replace(/[^a-z0-9]/gi, '_');
    const ph = document.getElementById(`ph-${safeId}`);
    if (!ph) return;

    const isEdit = !!_editMode[`${type}_${cityId}`];
    const h = type === 'itin' ? 160 : 130;
    const deleteBtn = isEdit
      ? `<button onclick="deleteItemPhoto('${type}','${cityId}','${item._id}')" class="absolute top-2 right-2 bg-slate-900/90 text-red-400 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold cursor-pointer transition active:scale-90">×</button>`
      : '';
    ph.outerHTML = `
      <div class="relative ${type === 'itin' ? 'mb-3' : 'mb-2'} rounded-xl overflow-hidden animate-fade-in" style="height:${h}px">
        <img src="${compressed}" class="w-full h-full object-cover" alt="" loading="lazy">
        ${deleteBtn}
      </div>`;
  } catch {
    const safeId = item._id.replace(/[^a-z0-9]/gi, '_');
    const ph = document.getElementById(`ph-${safeId}`);
    if (ph) ph.remove();
  }
}

async function fetchWikipediaThumb(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&piprop=thumbnail&pithumbsize=900&format=json&origin=*`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    return Object.values(pages)[0]?.thumbnail?.source ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

function getCustomItineraries(cityId) {
  try {
    const s = localStorage.getItem(`custom_itin_${cityId}`);
    if (s) return JSON.parse(s);
  } catch {}
  const city = CITIES.find(c => c.id === cityId);
  return (city?.itineraries || []).map((it, i) => ({ ...it, _id: `${cityId}_itin_d${i}` }));
}

function saveCustomItineraries(cityId, items) {
  localStorage.setItem(`custom_itin_${cityId}`, JSON.stringify(items));
}

function getCustomPhotoSpots(cityId) {
  try {
    const s = localStorage.getItem(`custom_ps_${cityId}`);
    if (s) return JSON.parse(s);
  } catch {}
  const city = CITIES.find(c => c.id === cityId);
  return (city?.photoSpots || []).map((ps, i) => ({ ...ps, _id: `${cityId}_ps_d${i}` }));
}

function saveCustomPhotoSpots(cityId, items) {
  localStorage.setItem(`custom_ps_${cityId}`, JSON.stringify(items));
}

function loadPhoto(photoId) {
  return localStorage.getItem(`photo_${photoId}`);
}

function savePhoto(photoId, dataUrl) {
  try {
    localStorage.setItem(`photo_${photoId}`, dataUrl);
    return true;
  } catch {
    showToast('Nedostatek místa. Smaž starší fotografie a zkus znovu.');
    return false;
  }
}

function deletePhoto(photoId) {
  localStorage.removeItem(`photo_${photoId}`);
}

function compressImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 800, maxH = 600;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function isOnWifi() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return null;
  if (conn.type === 'wifi') return true;
  if (conn.type && conn.type !== 'wifi') return false;
  return null;
}

function toggleItinEdit(cityId) {
  _editMode[`itin_${cityId}`] = !_editMode[`itin_${cityId}`];
  refreshItinerariesSection(cityId);
}

function togglePsEdit(cityId) {
  _editMode[`ps_${cityId}`] = !_editMode[`ps_${cityId}`];
  refreshPhotoSpotsSection(cityId);
}

function refreshItinerariesSection(cityId) {
  const wrap = document.getElementById(`itin-wrap-${cityId}`);
  if (!wrap) return;
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;
  wrap.innerHTML = _renderItinerariesInner(city);
  _triggerPhotoFetch('itin', cityId);
}

function refreshPhotoSpotsSection(cityId) {
  const wrap = document.getElementById(`ps-wrap-${cityId}`);
  if (!wrap) return;
  const city = CITIES.find(c => c.id === cityId);
  if (!city) return;
  wrap.innerHTML = _renderPhotoSpotsInner(city);
  _triggerPhotoFetch('ps', cityId);
}

function deleteItineraryItem(cityId, itemId) {
  let items = getCustomItineraries(cityId);
  deletePhoto(itemId);
  items = items.filter(it => it._id !== itemId);
  saveCustomItineraries(cityId, items);
  refreshItinerariesSection(cityId);
  showToast('Den odstraněn.');
}

function deletePhotoSpotItem(cityId, itemId) {
  let items = getCustomPhotoSpots(cityId);
  deletePhoto(itemId);
  items = items.filter(ps => ps._id !== itemId);
  saveCustomPhotoSpots(cityId, items);
  refreshPhotoSpotsSection(cityId);
  showToast('Místo odstraněno.');
}

function submitAddItinerary(cityId) {
  const dayEl   = document.getElementById(`itin-add-day-${cityId}`);
  const titleEl = document.getElementById(`itin-add-title-${cityId}`);
  const stepsEl = document.getElementById(`itin-add-steps-${cityId}`);
  if (!dayEl || !titleEl || !stepsEl) return;

  const day   = dayEl.value.trim();
  const title = titleEl.value.trim();
  const steps = stepsEl.value.split('\n').map(s => s.trim()).filter(Boolean);

  if (!day || !title)   { showToast('Vyplň název dne a podtitulek.'); return; }
  if (!steps.length)    { showToast('Přidej alespoň jeden krok.'); return; }

  const items  = getCustomItineraries(cityId);
  const colors = ['#fbbf24','#a78bfa','#34d399','#60a5fa','#f87171','#fb923c'];
  const color  = colors[items.length % colors.length];
  items.push({ day, title, color, steps, _id: `${cityId}_itin_${Date.now()}` });
  saveCustomItineraries(cityId, items);
  refreshItinerariesSection(cityId);
  showToast('Den přidán.');
}

function submitAddPhotoSpot(cityId) {
  const nameEl = document.getElementById(`ps-add-name-${cityId}`);
  const timeEl = document.getElementById(`ps-add-time-${cityId}`);
  const mapsEl = document.getElementById(`ps-add-maps-${cityId}`);
  if (!nameEl || !timeEl) return;

  const name     = nameEl.value.trim();
  const bestTime = timeEl.value.trim();
  const mapsUrl  = mapsEl?.value.trim() || '';

  if (!name || !bestTime) { showToast('Vyplň název a nejlepší čas.'); return; }

  const items = getCustomPhotoSpots(cityId);
  items.push({ name, bestTime, mapsUrl, _id: `${cityId}_ps_${Date.now()}` });
  saveCustomPhotoSpots(cityId, items);
  refreshPhotoSpotsSection(cityId);
  showToast('Místo přidáno.');
}

function resetItinerariesToDefault(cityId) {
  if (!confirm('Obnovit výchozí itineráře? Vlastní úpravy i fotografie budou ztraceny.')) return;
  getCustomItineraries(cityId).forEach(it => deletePhoto(it._id));
  localStorage.removeItem(`custom_itin_${cityId}`);
  _editMode[`itin_${cityId}`] = false;
  refreshItinerariesSection(cityId);
  showToast('Výchozí itineráře obnoveny.');
}

function resetPhotoSpotsToDefault(cityId) {
  if (!confirm('Obnovit výchozí foto tipy? Vlastní úpravy i fotografie budou ztraceny.')) return;
  getCustomPhotoSpots(cityId).forEach(ps => deletePhoto(ps._id));
  localStorage.removeItem(`custom_ps_${cityId}`);
  _editMode[`ps_${cityId}`] = false;
  refreshPhotoSpotsSection(cityId);
  showToast('Výchozí foto tipy obnoveny.');
}

function openPhotoPanel(type, cityId, itemId) {
  const key = `${type}_${cityId}_${itemId}`;
  _photoPanel[key] = !_photoPanel[key];
  if (type === 'itin') refreshItinerariesSection(cityId);
  else                 refreshPhotoSpotsSection(cityId);
}

function handlePhotoFileChange(input, type, cityId, itemId) {
  const file = input.files[0];
  if (!file) return;

  const wifi = isOnWifi();
  if (wifi === false) {
    if (!confirm('Nejsi připojen(a) k Wi-Fi. Uložit fotografii přes mobilní data?')) {
      input.value = '';
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      showToast('Zpracovávám…');
      const compressed = await compressImage(e.target.result);
      const ok = savePhoto(itemId, compressed);
      if (ok) {
        _photoPanel[`${type}_${cityId}_${itemId}`] = false;
        showToast('Fotografie uložena offline.');
      }
      if (type === 'itin') refreshItinerariesSection(cityId);
      else                 refreshPhotoSpotsSection(cityId);
    } catch {
      showToast('Chyba při zpracování fotografie.');
    }
  };
  reader.readAsDataURL(file);
}

function saveUrlPhoto(inputId, type, cityId, itemId) {
  const url = document.getElementById(inputId)?.value.trim();
  if (!url || !url.startsWith('http')) {
    showToast('Zadej platnou URL adresu fotografie (https://…).');
    return;
  }
  const ok = savePhoto(itemId, url);
  if (ok) {
    _photoPanel[`${type}_${cityId}_${itemId}`] = false;
    showToast('URL fotografie uložena. Pro offline přístup použij ↓ Offline (WiFi).');
  }
  if (type === 'itin') refreshItinerariesSection(cityId);
  else                 refreshPhotoSpotsSection(cityId);
}

async function downloadUrlPhotoOffline(type, cityId, itemId) {
  const url = loadPhoto(itemId);
  if (!url || url.startsWith('data:')) return;

  const wifi = isOnWifi();
  if (wifi === false) {
    showToast('Stahování pro offline funguje jen na Wi-Fi. Připoj se k Wi-Fi a zkus znovu.');
    return;
  }
  if (wifi === null) {
    if (!confirm('Nelze zjistit typ připojení. Stáhnout fotografii offline?')) return;
  }

  showToast('Stahuji…');
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const compressed = await compressImage(e.target.result);
          const ok = savePhoto(itemId, compressed);
          if (ok) showToast('Fotografie uložena pro offline.');
          if (type === 'itin') refreshItinerariesSection(cityId);
          else                 refreshPhotoSpotsSection(cityId);
          res();
        } catch { rej(e); }
      };
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch {
    showToast('Nepodařilo se stáhnout (CORS nebo chyba sítě). Zkus uložit foto ze galerie přímo.');
  }
}

function deleteItemPhoto(type, cityId, itemId) {
  deletePhoto(itemId);
  _photoPanel[`${type}_${cityId}_${itemId}`] = false;
  if (type === 'itin') refreshItinerariesSection(cityId);
  else                 refreshPhotoSpotsSection(cityId);
  showToast('Fotografie smazána.');
}
