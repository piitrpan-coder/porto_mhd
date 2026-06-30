// ==========================================
// WEATHER & EXCHANGE MODULE (js/weather.js)
// ==========================================

const WMO = {
  icons:  {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌦️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'},
  labels: {0:'Jasno',1:'Převážně jasno',2:'Polojasno',3:'Zataženo',45:'Mlha',48:'Jinovatka',51:'Mrholení',53:'Mrholení',55:'Mrholení',61:'Slabý déšť',63:'Déšť',65:'Silný déšť',71:'Sněžení',73:'Sněžení',75:'Sněhová bouře',80:'Přeháňky',81:'Přeháňky',82:'Silné přeháňky',95:'Bouřka',96:'Bouřka',99:'Silná bouřka'}
};

function fetchWeather(manual = false) { 
  if (currentCity) WeatherModule.fetch(currentCity, manual); 
}

const WeatherModule = {
  async fetch(city, manual = false) {
    if (!city.weatherLat || !city.weatherLng) return;

    const iEl = document.getElementById(`${city.id}-weather-icon`);
    if (manual && iEl) iEl.style.opacity = '0.3';

    try {
      const cacheKey = `weather_${city.id}`;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.weatherLat}&longitude=${city.weatherLng}&current=temperature_2m,weathercode,windspeed_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,weathercode,uv_index_max,sunrise,sunset&forecast_days=2&timezone=${encodeURIComponent(city.timezone)}`;

      const { data, fromCache, cachedAt } = await apiFetch(url, { _timeout: 8000 }, cacheKey);
      if (!document.getElementById(`${city.id}-weather-icon`)) return;

      this.render(city, data, fromCache, cachedAt);

      if (manual && !fromCache) showToast('Počasí aktualizováno ✓');
      if (manual && fromCache) showToast('Offline – zobrazena stará data.');
    } catch {
      if (manual) showToast('Nepodařilo se načíst počasí.');
    } finally {
      if (iEl) setTimeout(() => { iEl.style.opacity = '1'; }, 200);
    }
  },

  render(city, data, fromCache, cachedAt) {
    const { current: c, daily: d } = data;
    const sel = (id) => document.getElementById(id);
    const td = (id) => `${city.id}-${id}`;
    const setText = (id, val) => { const el = sel(id); if (el) el.textContent = val; };

    setText(td('weather-icon'), WMO.icons[c.weathercode] ?? '🌡️');
    setText(td('weather-temp'), Math.round(c.temperature_2m) + '°C');
    setText(td('weather-desc'), WMO.labels[c.weathercode] ?? 'Počasí');
    setText(td('weather-wind'), Math.round(c.windspeed_10m) + ' km/h');
    setText(td('uv-badge'), 'UV ' + (c.uv_index != null ? Math.round(c.uv_index) : '–'));

    if (d.weathercode?.[1]) setText(td('fc-icon'), WMO.icons[d.weathercode[1]] ?? '🌡️');
    if (d.temperature_2m_min?.[1] != null) {
      const min = Math.round(d.temperature_2m_min[1]);
      const max = Math.round(d.temperature_2m_max[1]);
      setText(td('fc-temp'), min + '–' + max + '°C');
    }
    setText(td('uv-max'), d.uv_index_max?.[0] != null ? Math.round(d.uv_index_max[0]) : '–');

    const sunRow = sel(td('sun-row'));
    if (sunRow && d.sunrise?.[0] && d.sunset?.[0]) {
      setText(td('sunrise'), d.sunrise[0].split('T')[1]);
      setText(td('sunset'), d.sunset[0].split('T')[1]);
      sunRow.classList.remove('hidden');
      sunRow.classList.add('flex');
    }

    const staleEl = sel(td('weather-stale'));
    if (staleEl) {
      if (fromCache && cachedAt) {
        staleEl.textContent = 'Offline · naposledy ' + localHHMM(cachedAt, city.timezone);
        staleEl.className = 'text-[10px] text-amber-400/70 mt-0.5';
      } else {
        staleEl.className = 'hidden';
      }
    }
  }
};

const ExchangeRateModule = {
  rate: 25.0,
  async fetch() {
    try {
      const cacheKey = 'exchange_rate_eur_czk';
      const url = 'https://open.er-api.com/v6/latest/EUR';
      const { data, fromCache, cachedAt } = await apiFetch(url, { _timeout: 8000 }, cacheKey);
      if (data && data.rates && data.rates.CZK) {
        this.rate = data.rates.CZK;
        this.updateUI(data.rates.CZK, cachedAt || Date.now());
      }
    } catch (e) {
      console.warn('Nepodařilo se načíst kurz:', e);
      const cached = StorageSchema.load('app_cache_exchange_rate_eur_czk');
      if (cached && cached.data && cached.data.rates && cached.data.rates.CZK) {
        this.rate = cached.data.rates.CZK;
        this.updateUI(cached.data.rates.CZK, cached.t);
      }
    }
  },
  updateUI(rate, timestamp) {
    const el = document.getElementById('rate-update-time');
    if (el) {
      const dateStr = new Date(timestamp).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
      el.textContent = `1 € = ${rate.toFixed(2)} Kč (${dateStr})`;
    }
  }
};

function convertCurrency(source) {
  const rate = ExchangeRateModule.rate;
  const eurInput = document.getElementById('conv-eur');
  const czkInput = document.getElementById('conv-czk');
  if (!eurInput || !czkInput) return;

  if (source === 'eur') {
    const val = parseFloat(eurInput.value);
    if (isNaN(val)) { czkInput.value = ''; return; }
    czkInput.value = (val * rate).toFixed(2);
  } else {
    const val = parseFloat(czkInput.value);
    if (isNaN(val)) { eurInput.value = ''; return; }
    eurInput.value = (val / rate).toFixed(2);
  }
}
