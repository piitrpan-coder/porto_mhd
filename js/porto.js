// ==========================================
// PORTO SPECIFIC SYSTEM MODULE (js/porto.js)
// ==========================================

const RIDE_PRICE = { z2: 1.85, z4: 3.00 };
const COUNTDOWN_MS = { z2: 60 * 60 * 1000, z4: 75 * 60 * 1000 };

const STCP_STOPS = {
  lordelo:    { stops: [{ id:'LRD1',  label:'→ FLUP/Centrum', color:'#10b981' }, { id:'LRD2',  label:'→ Foz/Pláž', color:'#60a5fa' }] },
  planetario: { stops: [{ id:'PLNT1', label:'→ FLUP/Centrum', color:'#10b981' }, { id:'PLNT2', label:'→ Foz/Pláž', color:'#60a5fa' }] }
};

const STOPS_GEO = [
  { id:'LRD1',  name:'Prédios de Lordelo', dir:'→ FLUP/Centrum', lat:41.15441, lng:-8.64908, lines:'204, 207, 209' },
  { id:'LRD2',  name:'Prédios de Lordelo', dir:'→ Foz/Pláž',     lat:41.15441, lng:-8.64908, lines:'204' },
  { id:'PLNT1', name:'Planetário',          dir:'→ FLUP/Centrum', lat:41.15355, lng:-8.65148, lines:'200, 207, 209, 1M' },
  { id:'PLNT2', name:'Planetário',          dir:'→ Foz/Pláž',     lat:41.15355, lng:-8.65148, lines:'200, 207, 1M' },
  { id:'home',  name:'🏠 Ubytování',        dir:'Rua Paulo Gama 551', lat:41.15468, lng:-8.65016, lines:null }
];

window.depRefreshTimers = {};

function updateWalletUI() {
  const state = StateManager.get('porto');
  ['z2', 'z4'].forEach(zone => {
    const count = state.wallet[zone];
    const eur = (count * RIDE_PRICE[zone]).toFixed(2).replace('.', ',');
    const countEl = document.getElementById('wallet-' + zone + '-count');
    const eurEl   = document.getElementById('wallet-' + zone + '-eur');
    const card    = document.getElementById('wallet-' + zone + '-card');
    const warn    = document.getElementById('wallet-' + zone + '-warn');
    if (!countEl || !card) return;
    countEl.textContent = count;
    eurEl.textContent = '≈ ' + eur + ' €';
    card.classList.remove('border-red-500/60','bg-red-950/20','border-yellow-500/50','border-slate-800/60');
    if (count === 0) {
      card.classList.add('border-red-500/60', 'bg-red-950/20');
      if (warn) warn.textContent = '⚠ Prázdná!';
      if (warn) warn.classList.remove('hidden');
    } else if (count <= 2) {
      card.classList.add('border-yellow-500/50');
      if (warn) warn.textContent = '⚠ Doplnit!';
      if (warn) warn.classList.remove('hidden');
    } else {
      card.classList.add('border-slate-800/60');
      if (warn) warn.classList.add('hidden');
    }
  });
}

function changeRides(zone, amount) {
  const state = StateManager.get('porto');
  state.wallet[zone] = Math.max(0, state.wallet[zone] + amount);
  StorageSchema.save(`app_porto_wallet_${zone}`, state.wallet[zone]);
  updateWalletUI();
}

async function scheduleTicketNotifs(zone, startMs) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  const state = StateManager.get('porto');
  const existing = state.intervals.countdownNotifs || [];
  existing.forEach(id => clearTimeout(id));
  state.intervals.countdownNotifs = [];

  const duration = COUNTDOWN_MS[zone];
  const schedule = [
    [duration - 5*60000, '⏱ Jízdenka vyprší za 5 minut!', [200,100,200]],
    [duration - 60000, '🚨 Jízdenka vyprší za 1 minutu! Přestupuj!', [500,200,500,200,500]],
    [duration, '❌ Jízdenka vypršela – pípni znovu.', [1000]]
  ];

  schedule.forEach(([offset, body, vibrate]) => {
    const delay = startMs + offset - Date.now();
    if (delay > 0) {
      const timer = setTimeout(() => {
        new Notification('Porto MHD', { body, icon: './icon-192.png' });
        if (navigator.vibrate) navigator.vibrate(vibrate);
      }, delay);
      state.intervals.countdownNotifs.push(timer);
    }
  });
}

function startCountdown(zone) {
  const startMs = Date.now();
  const state = StateManager.get('porto');
  state.countdown = { start: startMs, zone };
  StorageSchema.save('app_porto_countdown', state.countdown);
  scheduleTicketNotifs(zone, startMs);
  renderCountdown();
}

function cancelCountdown() {
  const state = StateManager.get('porto');
  const existing = state.intervals.countdownNotifs || [];
  existing.forEach(id => clearTimeout(id));
  state.intervals.countdownNotifs = [];
  state.countdown = { start: 0, zone: null };
  StorageSchema.save('app_porto_countdown', state.countdown);
  renderCountdown();
}

function renderCountdown() {
  const state = StateManager.get('porto');
  const { start, zone } = state.countdown;
  const display  = document.getElementById('countdown-display');
  const buttons  = document.getElementById('countdown-buttons');
  const stickyEl = document.getElementById('sticky-cd');
  if (!display || !buttons) return;

  if (!start) {
    display.classList.add('hidden');
    buttons.classList.remove('hidden');
    stickyEl?.classList.add('hidden');
    return;
  }
  display.classList.remove('hidden');
  buttons.classList.add('hidden');
  stickyEl?.classList.remove('hidden');

  const duration  = COUNTDOWN_MS[zone];
  const elapsed   = Date.now() - start;
  const remaining = Math.max(0, duration - elapsed);

  const timeEl  = document.getElementById('countdown-time');
  const barEl   = document.getElementById('countdown-bar');
  const labelEl = document.getElementById('countdown-zone-label');
  const untilEl = document.getElementById('countdown-valid-until');
  const stickyTime  = document.getElementById('sticky-time');
  const stickyZone  = document.getElementById('sticky-zone');
  const stickyBar   = document.getElementById('sticky-bar');
  const stickyValid = document.getElementById('sticky-valid');
  if (!timeEl) return;

  const zoneLabel = zone === 'z2' ? 'Z2 · 60 min' : 'Z4 · 75 min';
  if (labelEl) labelEl.textContent = zoneLabel;
  if (stickyZone) stickyZone.textContent = zoneLabel;
  const pct = ((remaining / duration) * 100) + '%';
  if (barEl) barEl.style.width = pct;
  if (stickyBar) stickyBar.style.width = pct;

  if (remaining === 0) {
    timeEl.textContent = 'VYPRŠELA!';
    timeEl.className = 'text-3xl font-black text-center tracking-tight text-red-400 font-mono animate-pulse';
    if (barEl) barEl.className = 'h-full rounded-full bg-red-600';
    if (untilEl) untilEl.textContent = 'Jízdenka neplatí — pípni znovu.';
    if (stickyTime) { stickyTime.textContent = 'VYPRŠELA!'; stickyTime.style.color = '#f87171'; }
    if (stickyBar) stickyBar.style.background = '#ef4444';
    if (stickyValid) stickyValid.textContent = 'Pípni znovu!';
    if (elapsed > duration + 60000) cancelCountdown();
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeStr = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
  timeEl.textContent = timeStr;
  if (stickyTime) stickyTime.textContent = timeStr;

  let color;
  if (remaining > 15 * 60000) {
    color = '#34d399';
    timeEl.className = 'text-4xl font-black text-center tracking-tight text-emerald-400 font-mono tabular-nums';
    if (barEl) barEl.className = 'h-full rounded-full transition-all duration-1000 bg-emerald-500';
  } else if (remaining > 5 * 60000) {
    color = '#fbbf24';
    timeEl.className = 'text-4xl font-black text-center tracking-tight text-yellow-400 font-mono tabular-nums';
    if (barEl) barEl.className = 'h-full rounded-full transition-all duration-1000 bg-yellow-500';
  } else {
    color = '#f87171';
    timeEl.className = 'text-4xl font-black text-center tracking-tight text-red-400 font-mono tabular-nums animate-pulse';
    if (barEl) barEl.className = 'h-full rounded-full transition-all duration-1000 bg-red-500';
  }
  if (stickyTime) stickyTime.style.color = color;
  if (stickyBar) stickyBar.style.background = color;

  try {
    const validUntil = new Date(start + duration);
    const t = new Intl.DateTimeFormat('cs-CZ', { timeZone:'Europe/Lisbon', hour:'2-digit', minute:'2-digit', hour12:false }).format(validUntil);
    if (untilEl) untilEl.textContent = 'Platí do: ' + t + ' (portug. čas)';
    if (stickyValid) stickyValid.textContent = 'Platí do ' + t;
  } catch(e) { if (untilEl) untilEl.textContent = ''; }
}

function initPorto() {
  const state = StateManager.get('porto');

  state.wallet = {
    z2: StorageSchema.load('app_porto_wallet_z2', 0),
    z4: StorageSchema.load('app_porto_wallet_z4', 0)
  };
  updateWalletUI();

  state.countdown = StorageSchema.load('app_porto_countdown', { start: 0, zone: null });
  renderCountdown();
  if (state.intervals.countdownRender) clearInterval(state.intervals.countdownRender);
  state.intervals.countdownRender = setInterval(renderCountdown, 1000);

  if (state.countdown.start) {
    scheduleTicketNotifs(state.countdown.zone, state.countdown.start);
  }

  WeatherModule.fetch(currentCity);
  if (state.intervals.weather) clearInterval(state.intervals.weather);
  state.intervals.weather = setInterval(() => WeatherModule.fetch(currentCity), 1800000);

  applyPlaces();
}

async function loadArrivals(key) {
  const config = STCP_STOPS[key];
  const container = document.getElementById('dep-' + key);
  const btn = document.getElementById('dep-btn-' + key);
  if (!container || !btn) return;

  btn.innerHTML = '<span class="spin">⟳</span> Načítám…'; btn.disabled = true;
  container.classList.remove('hidden');
  container.innerHTML = '<div class="space-y-2">'
    + [1,2].map(() => '<div class="h-12 rounded-xl bg-slate-800/60 animate-pulse"></div>').join('')
    + '</div>';
  clearTimeout(window.depRefreshTimers[key]);

  const timezone = currentCity?.timezone || 'Europe/Lisbon';
  const results = await Promise.all(
    config.stops.map(stop =>
      apiFetch(
        'https://proxy.cors.sh/https://stcp.pt/api/stops/' + stop.id + '/realtime',
        { cache: 'no-store', _timeout: 8000 },
        'stcp_' + stop.id
      )
        .then(r => ({ ...stop, arrivals: r.data.arrivals || [], ok: true, fromCache: r.fromCache, cachedAt: r.cachedAt }))
        .catch(() => ({ ...stop, arrivals: [], ok: false }))
    )
  );

  const allFailed = results.every(r => !r.ok);
  if (allFailed) {
    container.innerHTML = '<div style="padding:10px 4px;text-align:center"><p style="font-size:14px;color:#f87171;font-weight:600">Nepodařilo se načíst</p><p style="font-size:12px;color:#475569;margin-top:4px">Zkontroluj připojení.</p></div>';
    btn.innerHTML = '↺ Zkusit znovu'; btn.disabled = false; return;
  }

  const anyFromCache = results.some(r => r.fromCache);
  const minCachedAt = results.reduce((m, r) => (r.cachedAt && r.cachedAt < m) ? r.cachedAt : m, Infinity);

  const all = [];
  results.forEach(r => r.arrivals.forEach(a => all.push({ ...a, dirLabel: r.label, dirColor: r.color })));
  all.sort((a, b) => a.arrival_minutes - b.arrival_minutes);

  let html = (anyFromCache && minCachedAt !== Infinity) ? staleDataHtml(minCachedAt, timezone) : '';

  if (all.length === 0) {
    html += '<p style="font-size:14px;color:#64748b;text-align:center;padding:12px 0">Žádné spoje v příštích 60 min.</p>';
  } else {
    const rows = all.slice(0, 6).map(a => {
      const mins = a.arrival_minutes;
      const minsStr = mins <= 0 ? 'Přijíždí!' : mins + ' min';
      const minsColor = mins <= 0 ? '#34d399' : mins <= 3 ? '#34d399' : mins <= 6 ? '#fbbf24' : '#94a3b8';
      const delayHtml = (a.status === 'DELAYED' && a.delay_minutes > 0.5)
        ? ' <span style="color:#f87171;font-size:11px">+' + Math.round(a.delay_minutes) + '\'</span>' : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-bottom:1px solid rgba(51,65,85,0.5)">'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<span style="background:#1e293b;color:#fbbf24;font-weight:900;font-size:15px;padding:4px 8px;border-radius:8px;min-width:38px;text-align:center;font-family:monospace">' + (a.route_short_name || a.route_long_name) + '</span>'
        + '<div><div style="font-size:14px;color:#e2e8f0;font-weight:600">' + a.trip_headsign + '</div>'
        + '<div style="font-size:11px;color:' + a.dirColor + ';margin-top:2px">' + a.dirLabel + '</div></div></div>'
        + '<span style="font-weight:900;font-size:17px;color:' + minsColor + ';font-family:monospace;white-space:nowrap">' + minsStr + delayHtml + '</span>'
        + '</div>';
    }).join('');
    const footer = !anyFromCache
      ? '<div style="font-size:11px;color:#334155;text-align:right;padding:4px 12px">Aktualizováno '
          + new Date().toLocaleTimeString('cs-CZ', { hour:'2-digit', minute:'2-digit' }) + ' · auto-refresh 30 s</div>'
      : '';
    html += '<div style="background:rgba(2,6,23,0.4);border:1px solid rgba(51,65,85,0.4);border-radius:12px;overflow:hidden;margin-bottom:4px">'
      + '<div style="padding:0 4px">' + rows + '</div>' + footer + '</div>';
  }
  container.innerHTML = html;
  btn.innerHTML = '↺ Obnovit'; btn.disabled = false;
  window.depRefreshTimers[key] = setTimeout(() => loadArrivals(key), 30000);
}

function locateMeNow() {
  const btn = document.getElementById('locate-btn');
  const result = document.getElementById('locate-result');
  if (!navigator.geolocation) {
    result.classList.remove('hidden');
    result.innerHTML = '<p style="font-size:11px;color:#f87171;padding:6px">Geolokace není dostupná v tomto prohlížeči.</p>';
    return;
  }
  btn.textContent = '⟳ Hledám polohu…'; btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude:lat, longitude:lng, accuracy } = pos.coords;
      const sorted = STOPS_GEO
        .map(s => ({ ...s, dist: Math.round(haversineM(lat, lng, s.lat, s.lng)) }))
        .sort((a, b) => a.dist - b.dist);
      const rows = sorted.map(s => {
        const wmin = Math.ceil(s.dist / 75);
        const col = s.dist < 200 ? '#34d399' : s.dist < 500 ? '#fbbf24' : '#94a3b8';
        const badge = s.id !== 'home'
          ? '<span style="background:#1e293b;color:#64748b;font-size:9px;padding:1px 5px;border-radius:3px;font-family:monospace;margin-right:5px">' + s.id + '</span>' : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 2px;border-bottom:1px solid rgba(51,65,85,0.3)">'
          + '<div>' + badge
          + '<span style="font-size:11px;color:#e2e8f0;font-weight:600">' + s.name + '</span>'
          + '<span style="font-size:9px;color:#64748b;display:block;margin-top:1px">' + s.dir + (s.lines ? ' · ' + s.lines : '') + '</span></div>'
          + '<div style="text-align:right">'
          + '<span style="font-size:13px;font-weight:900;color:' + col + ';font-family:monospace">' + s.dist + ' m</span>'
          + '<span style="font-size:9px;color:#64748b;display:block">~' + wmin + ' min pěšky</span></div></div>';
      }).join('');
      result.classList.remove('hidden');
      result.innerHTML = '<div style="font-size:10px;color:#334155;padding:2px 0 6px">GPS přesnost ±' + Math.round(accuracy) + ' m</div>' + rows;
      btn.textContent = '📍 Obnovit polohu'; btn.disabled = false;
    },
    err => {
      const msgs = { 1:'Přístup zamítnut – povol polohu v nastavení.', 2:'Poloha není dostupná.', 3:'Časový limit vypršel.' };
      result.classList.remove('hidden');
      result.innerHTML = '<p style="font-size:11px;color:#f87171;padding:6px">' + (msgs[err.code] || 'Chyba geolokace.') + '</p>';
      btn.textContent = '📍 Zjistit polohu'; btn.disabled = false;
    },
    { timeout:10000, enableHighAccuracy:true }
  );
}
