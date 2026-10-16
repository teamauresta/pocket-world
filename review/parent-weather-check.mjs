import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Weather } from '../src/world/weather.js';
const a = new Weather({ seed: 19 }), b = new Weather({ seed: 19 });
for (let i = 0; i < 1200; i++) a.update(1 / 60);
for (let i = 0; i < 200; i++) b.update(.1);
for (const key of ['cloud', 'rain', 'wind', 'fog', 'waves', 'wet', 'gust', 'flash', 'time']) assert(Math.abs(a[key] - b[key]) < 1e-8, key);
const runs = [];
for (const seed of [718, 711, 17, 1234, 2026]) {
  const states = new Set(), w = new Weather({ seed });
  let previous = 'clear', longest = 0, stormStart = 0, rainSpells = 0;
  for (let i = 0; i < 7200; i++) {
    const clearBefore = w.clearSeconds;
    w.update(1); states.add(w.state);
    for (const key of ['cloud', 'rain', 'wind', 'fog', 'waves', 'wet', 'gust', 'flash']) assert(w[key] >= 0 && w[key] <= 1, key);
    if (w.state === 'storm' && previous !== 'storm') stormStart = w.time;
    if (w.state !== 'storm' && previous === 'storm') longest = Math.max(longest, w.time - stormStart);
    if (['rain', 'storm'].includes(w.state) && !['rain', 'storm'].includes(previous)) { assert(clearBefore >= 179, 'rain cooldown'); rainSpells++; }
    previous = w.state;
  }
  assert(longest <= 121, 'storm cap');
  const paused = w.snapshot(); w.update(100, { paused: true }); assert.deepEqual(w.snapshot(), paused);
  w.setMode('storm', { snap: true }); w.setReducedMotion(true); w.strike({ bolt: true }); assert(w.flash <= .3);
  runs.push({ seed, seconds: 7200, states: [...states], longestStormSeconds: longest, rainSpells });
}
const report = { timestamp: new Date().toISOString(), weatherSourceSHA256: crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/world/weather.js', import.meta.url))).digest('hex'), rateIndependence: 'PASS', boundsCooldownStormCapPauseReducedMotion: 'PASS', runs, limitation: 'Pure simulation verification, not live physical-device performance.' };
fs.writeFileSync(new URL('parent-weather-check.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
