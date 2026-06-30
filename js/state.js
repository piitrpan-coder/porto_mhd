// ==========================================
// STATE & API MANAGEMENT (js/state.js)
// ==========================================

const StorageSchema = {
  load(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Failed to load ${key}:`, e);
      return defaultValue;
    }
  },

  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[Storage] Quota exceeded – cleanup old cache');
        this.cleanup();
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e2) {
          console.error('[Storage] Still cannot save after cleanup:', e2);
        }
      } else {
        console.error('[Storage] Save failed:', e);
      }
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('[Storage] Remove failed:', e);
    }
  },

  cleanup() {
    const oneWeekAgo = Date.now() - 7 * 24 * 3600000;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('app_cache_')) {
        try {
          const { t } = JSON.parse(localStorage.getItem(key) || '{}');
          if (t && t < oneWeekAgo) {
            localStorage.removeItem(key);
          }
        } catch {}
      }
    }
  }
};

const StateManager = {
  cities: {},

  init(cityId) {
    if (!this.cities[cityId]) {
      this.cities[cityId] = {
        // App shell state
        activeTab: null,
        
        // Porto only: wallet rides count
        wallet: { z2: 0, z4: 0 },
        
        // Porto only: ticket expiration timestamp
        countdown: { start: 0, zone: null },
        
        // Custom Places (pois & home coordinates)
        places: { home: null, pois: [] },
        weather: null,
        nearby: { category: null, location: 'gps', results: [] },

        // Metadata
        intervals: {},
        listeners: []
      };

      this.restore(cityId);
    }
    return this.cities[cityId];
  },

  restore(cityId) {
    const state = this.cities[cityId];
    const city = CITIES.find(c => c.id === cityId);
    if (!city) return;

    state.places.home = StorageSchema.load(`app_${cityId}_home`, city.defaultHome);
    state.places.pois = StorageSchema.load(`app_${cityId}_pois`, []);

    if (city.hasWallet) {
      state.wallet.z2 = StorageSchema.load(`app_${cityId}_wallet_z2`, 0);
      state.wallet.z4 = StorageSchema.load(`app_${cityId}_wallet_z4`, 0);
    }

    if (city.hasCountdown) {
      state.countdown = StorageSchema.load(`app_${cityId}_countdown`, { start: 0, zone: null });
    }
  },

  get(cityId) {
    return this.init(cityId);
  },

  set(cityId, path, value) {
    const state = this.init(cityId);
    const keys = path.split('.');
    let obj = state;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;

    this.persistIfNeeded(cityId, keys[0], obj);
  },

  persistIfNeeded(cityId, category, value) {
    const persistKeys = ['places', 'wallet', 'countdown'];
    if (persistKeys.includes(category)) {
      StorageSchema.save(`app_${cityId}_${category}`, value);
    }
  },

  clearCity(cityId) {
    const state = this.get(cityId);

    Object.values(state.intervals).forEach(id => {
      if (typeof id === 'number') clearInterval(id);
      if (typeof id === 'number') clearTimeout(id);
    });
    state.intervals = {};

    state.listeners.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
    state.listeners = [];

    delete this.cities[cityId];
  }
};

const CityLifecycle = {
  async enter(city) {
    if (currentCity && currentCity.id !== city.id) {
      this.exit(currentCity);
    }

    currentCity = city;
    StateManager.init(city.id);
    StateManager.restore(city.id);

    this.scheduleUpdates(city);
    this.setupOfflineSync(city);
  },

  exit(city) {
    StateManager.clearCity(city.id);
  },

  scheduleUpdates(city) {
    const state = StateManager.get(city.id);

    if (state.intervals.clock) clearInterval(state.intervals.clock);
    updateClock(city);
    state.intervals.clock = setInterval(() => updateClock(city), 1000);

    if (state.intervals.weather) clearInterval(state.intervals.weather);
    WeatherModule.fetch(city);
    state.intervals.weather = setInterval(() => WeatherModule.fetch(city), 1800000);

    ExchangeRateModule.fetch();

    if (city.id === 'porto') {
      initPorto();
    } else {
      applyPlaces();
    }
  },

  setupOfflineSync(city) {
    const state = StateManager.get(city.id);

    const onlineHandler = () => {
      console.log(`[${city.id}] Back online – syncing...`);
      updateOnlineStatus();
      WeatherModule.fetch(city);
      showToast('Připojeno – data aktualizována.');
    };

    window.addEventListener('online', onlineHandler);
    state.listeners.push({ event: 'online', handler: onlineHandler });

    const offlineHandler = () => {
      console.log(`[${city.id}] Offline – using cache`);
      updateOnlineStatus();
      showToast('Offline – zobrazuji poslední data.');
    };

    window.addEventListener('offline', offlineHandler);
    state.listeners.push({ event: 'offline', handler: offlineHandler });
  }
};

async function apiFetch(url, fetchOpts = {}, cacheKey = null) {
  const timeout = fetchOpts._timeout || 10000;
  const opts = { ...fetchOpts };
  delete opts._timeout;

  const attempt = () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .then(r => { clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(e => { clearTimeout(timer); throw e; });
  };

  try {
    const data = await attempt().catch(() => attempt());
    if (cacheKey) {
      StorageSchema.save(`app_cache_${cacheKey}`, { data, t: Date.now() });
    }
    return { data, fromCache: false };
  } catch {
    if (cacheKey) {
      const cached = StorageSchema.load(`app_cache_${cacheKey}`);
      if (cached) {
        const { data, t } = cached;
        return { data, fromCache: true, cachedAt: t };
      }
    }
    throw new Error('offline');
  }
}

function localHHMM(timestamp, timezone) {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: timezone || 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(timestamp));
}

function staleDataHtml(cachedAt, timezone) {
  return '<div class="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/30 rounded-xl px-3 py-2 mb-2">'
    + '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    + 'Offline · naposledy aktualizováno ' + localHHMM(cachedAt, timezone)
    + '</div>';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('opacity-0'); t.classList.add('opacity-100');
  setTimeout(() => { t.classList.remove('opacity-100'); t.classList.add('opacity-0'); }, 2000);
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => showToast('📋 Zkopírováno!')).catch(() => {
    const el = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
    document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
    showToast('📋 Zkopírováno!');
  });
}
