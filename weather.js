// Weather for the grid's weather card: Open-Meteo (free, no key). The place is either one the user
// picked (city search) or, by default, found roughly from the internet connection's address.
// Fetched only while the panel shows it, at most every 20 minutes; the last result is kept in the store.
'use strict';
const TTL = 20 * 60e3, LOC_TTL = 24 * 3600e3;

async function getJson(url, ms = 8000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Adacik/1.3 (weather)' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
// rough place from the connection (city level); two providers in case one is down
async function ipLocation() {
  try { const j = await getJson('https://ipwho.is/?fields=success,city,region,latitude,longitude'); if (j.success !== false && j.latitude != null) return { name: j.city || j.region || 'Konum', lat: j.latitude, lon: j.longitude, auto: true }; } catch {}
  const j = await getJson('https://get.geojs.io/v1/ip/geo.json');
  return { name: j.city || j.region || 'Konum', lat: +j.latitude, lon: +j.longitude, auto: true };
}

class Weather {
  constructor(store, save) { this.store = store; this.save = save; this.busy = null; store.weather = store.weather || {}; }
  get W() { return this.store.weather; }
  async location() {
    const s = this.store.settings || {};
    if (s.weatherLoc && s.weatherLoc.lat != null) return { ...s.weatherLoc, auto: false };
    if (this.W.auto && Date.now() - this.W.autoAt < LOC_TTL) return this.W.auto;
    const l = await ipLocation();
    // the address services spell places in ASCII ("Bandirma"): take the Turkish name of the nearest match
    try { const near = (await this.search(l.name) || []).find(r => Math.abs(r.lat - l.lat) < .6 && Math.abs(r.lon - l.lon) < .6); if (near) l.name = near.name; } catch {}
    this.W.auto = l; this.W.autoAt = Date.now(); this.save(); return l;
  }
  // cached unless stale (or forced); never two fetches at once
  async get(force) {
    const w = this.W, loc = (this.store.settings || {}).weatherLoc;
    const sameLoc = w.data && (!loc ? w.data.loc.auto : w.data.loc.lat === loc.lat && w.data.loc.lon === loc.lon);
    if (!force && sameLoc && Date.now() - w.at < TTL) return w.data;
    if (this.busy) return this.busy;
    this.busy = (async () => {
      try {
        const l = await this.location();
        const q = `latitude=${l.lat}&longitude=${l.lon}&timezone=auto&forecast_days=6`
          + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m'
          + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max';
        const j = await getJson('https://api.open-meteo.com/v1/forecast?' + q);
        const c = j.current, d = j.daily;
        const data = {
          loc: { name: l.name, lat: l.lat, lon: l.lon, auto: !!l.auto },
          cur: { t: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m, code: c.weather_code, day: !!c.is_day, wind: c.wind_speed_10m },
          days: d.time.map((t, i) => ({ date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null })),
          at: Date.now(),
        };
        w.data = data; w.at = Date.now(); w.err = ''; this.save();
        return data;
      } catch (e) { w.err = 'Hava durumu alınamadı'; return w.data ? { ...w.data, stale: true } : { error: w.err }; }
      finally { this.busy = null; }
    })();
    return this.busy;
  }
  async search(q) {
    q = String(q || '').trim(); if (q.length < 2) return [];
    try {
      const j = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=6&language=tr&format=json&name=' + encodeURIComponent(q));
      return (j.results || []).map(r => ({ name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
    } catch { return null; }
  }
}
module.exports = { Weather };
