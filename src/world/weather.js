// Pure seeded simulation: fixed 60 Hz clock, independent of render rate and wall-clock timers.
import { mulberry32 } from '../core/noise.js';
export const PRESETS = Object.freeze({
  clear: { cloud: .05, rain: 0, wind: .2, fog: 0, waves: .2, lightning: 0 },
  cloudy: { cloud: .6, rain: 0, wind: .35, fog: .15, waves: .3, lightning: 0 },
  rain: { cloud: .85, rain: .6, wind: .5, fog: .35, waves: .5, lightning: 0 },
  storm: { cloud: 1, rain: 1, wind: .9, fog: .5, waves: 1, lightning: 1 },
});
export const WINDS = Object.freeze({ calm: .1, breezy: .4, windy: .75 });
const TAU = { cloud: 8, rain: 5, wind: 3, fog: 8, waves: 5, lightning: 5 };
const STEP = 1 / 60;
const bounded = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
export class Weather {
  constructor({ seed = 711, reducedMotion = false, quality = 'high' } = {}) {
    this.rng = mulberry32(seed); this.quality = quality;
    this.mode = reducedMotion ? 'clear' : 'auto'; this.state = 'clear'; this.windMode = 'auto';
    Object.assign(this, PRESETS.clear);
    this.wet = 0; this.gust = 0; this.flash = 0; this.time = 0; this.remainder = 0;
    this.reducedMotion = reducedMotion; this.clearSeconds = 0; this.stateSeconds = 0;
    this.nextAuto = 90 + this.rng() * 90; this.nextGust = 0; this.gustTarget = 0;
    this.nextStrike = Infinity; this.strikeAge = Infinity; this.lastStrike = null; this.strikeCount = 0;
    this.strikePosition = [-27.5, 24, -27.5];
    this.listeners = new Set(); this.windDirection = [Math.cos(.56), Math.sin(.56)];
  }
  on(name, fn) { if (name !== 'strike' || typeof fn !== 'function') throw new TypeError('Expected strike listener'); this.listeners.add(fn); return () => this.listeners.delete(fn); }
  setMode(mode, { snap = false } = {}) {
    if (mode !== 'auto' && !Object.hasOwn(PRESETS, mode)) throw new RangeError('Unknown weather');
    this.mode = mode;
    if (mode !== 'auto') this.changeState(mode);
    else this.nextAuto = this.time + 90 + this.rng() * 90;
    if (snap) this.snap();
  }
  changeState(state) {
    if (state !== this.state) { this.state = state; this.stateSeconds = 0; }
    if (state === 'rain' || state === 'storm') this.clearSeconds = 0;
  }
  setWind(mode, { snap = false } = {}) {
    if (mode !== 'auto' && !Object.hasOwn(WINDS, mode) && !bounded(mode)) throw new RangeError('Unknown wind');
    this.windMode = mode; if (snap) this.wind = this.windTarget();
  }
  get target() { return { ...PRESETS[this.state], wind: this.windTarget() }; }
  windTarget() { return this.windMode === 'auto' ? PRESETS[this.state].wind : (typeof this.windMode === 'number' ? this.windMode : WINDS[this.windMode]); }
  snap() {
    Object.assign(this, PRESETS[this.state]); this.wind = this.windTarget(); this.wet = this.rain;
    this.gust = .25 * this.wind; this.flash = 0; this.strikeAge = Infinity; this.lastStrike = null;
    this.nextStrike = this.lightning > .5 ? this.time + 6 + this.rng() * 12 : Infinity;
  }
  setReducedMotion(on) {
    this.reducedMotion = !!on;
    if (on && this.mode === 'auto') this.setMode('clear');
    this.flash = Math.min(this.flash, on ? .3 : 1);
  }
  strike({ position = this.strikePosition, bolt, distance = 120, seed } = {}) {
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(distance) || distance < 0) throw new RangeError('Invalid strike');
    this.strikeAge = 0; this.strikeCount++;
    this.lastStrike = Object.freeze({ position: [...position], distance, time: this.time, seed: seed === undefined ? Math.floor(this.rng() * 4294967296) : seed >>> 0, bolt: bolt ?? this.rng() < 1 / 3 });
    this.flash = this.reducedMotion ? .3 : 1;
    for (const fn of this.listeners) fn(this.lastStrike);
    return this.lastStrike;
  }
  autoStep() {
    const r = this.rng(); let next = this.state;
    if (next === 'clear') next = r < .6 ? 'cloudy' : 'clear';
    else if (next === 'cloudy') next = r < .4 ? 'clear' : r < .8 ? 'rain' : 'cloudy';
    else if (next === 'rain') next = r < .5 ? 'cloudy' : r < .7 ? 'storm' : 'rain';
    else next = r < .7 ? 'rain' : 'storm';
    // Cooldown gates NEW wet spells, not the storm -> rain continuation of one spell.
    if (next === 'rain' && this.state === 'cloudy' && this.clearSeconds < 180) next = 'clear';
    this.changeState(next); this.nextAuto = this.time + 90 + this.rng() * 90;
  }
  update(dt, { paused = false } = {}) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 3600) throw new RangeError('dt must be 0..3600 seconds');
    if (paused || dt === 0) return;
    this.remainder += dt;
    const steps = Math.floor((this.remainder + 1e-9) / STEP);
    this.remainder = Math.max(0, this.remainder - steps * STEP);
    for (let i = 0; i < steps; i++) this.step();
  }
  step() {
    this.time += STEP; this.stateSeconds += STEP;
    if (this.state === 'clear') this.clearSeconds += STEP;
    if (this.mode === 'auto') {
      if (this.state === 'storm' && this.stateSeconds >= 120 - 1e-8) { this.changeState('rain'); this.nextAuto = this.time + 90 + this.rng() * 90; }
      else if (this.time >= this.nextAuto) this.autoStep();
    }
    const target = PRESETS[this.state];
    for (const key of Object.keys(TAU)) this[key] += ((key === 'wind' ? this.windTarget() : target[key]) - this[key]) * (1 - Math.exp(-STEP / TAU[key]));
    this.wet += (this.rain - this.wet) * (1 - Math.exp(-STEP / (this.rain > this.wet ? 15 : 60)));
    if (this.time >= this.nextGust) { this.gustTarget = this.rng(); this.nextGust = this.time + 2 + this.rng() * 4; }
    this.gust += (this.gustTarget * this.wind - this.gust) * (1 - Math.exp(-STEP / 1.4));
    const angle = .56 + Math.sin(this.time / 95) * Math.PI / 9;
    this.windDirection[0] = Math.cos(angle); this.windDirection[1] = Math.sin(angle);
    this.strikeAge += STEP;
    if (this.lightning > .5) {
      if (!Number.isFinite(this.nextStrike)) this.nextStrike = this.time + 6 + this.rng() * 12;
      if (this.time >= this.nextStrike) { this.strike(); this.nextStrike = this.time + 6 + this.rng() * 12; }
    } else this.nextStrike = Infinity;
    const a = this.strikeAge;
    const pulses = this.quality === 'low' || this.reducedMotion ? 0 : (a >= .13 ? .65 * Math.exp(-(a - .13) * 38) : 0) + (a >= .27 ? .4 * Math.exp(-(a - .27) * 40) : 0);
    this.flash = a < .55 ? Math.min(1, Math.exp(-a * 18) + pulses) * (this.reducedMotion ? .3 : 1) : 0;
  }
  snapshot() {
    const out = { mode: this.mode, state: this.state, windMode: this.windMode, time: this.time, clearSeconds: this.clearSeconds, stateSeconds: this.stateSeconds, reducedMotion: this.reducedMotion, strikeCount: this.strikeCount, lastStrike: this.lastStrike, windDirection: [...this.windDirection] };
    for (const key of [...Object.keys(TAU), 'wet', 'gust', 'flash']) out[key] = this[key];
    return out;
  }
}
export function loadWeatherPreference(getStorage = () => globalThis.localStorage) {
  try {
    const v = JSON.parse(getStorage().getItem('pocket-world-weather'));
    if (!v || !['auto', ...Object.keys(PRESETS)].includes(v.weather) || !['auto', ...Object.keys(WINDS)].includes(v.wind)) return null;
    return v;
  } catch { return null; }
}
export function saveWeatherPreference(weather, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem('pocket-world-weather', JSON.stringify({ weather: weather.mode, wind: weather.windMode })); } catch { /* private mode / quota */ }
}
