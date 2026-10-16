import test from 'node:test';
import assert from 'node:assert/strict';
import { Weather } from '../world/weather.js';
import { Birds } from '../fauna/birds.js';
import { SeaLife } from './life.js';
import { Heightfield } from '../world/heightfield.js';

const hf = new Heightfield();

test('real Weather array-position event reaches birds and sea without silent rejection', () => {
  const birds = new Birds(hf), sea = new SeaLife(hf, [], { quality: 'low' });
  const weather = new Weather({ seed: 32 });
  weather.on('strike', event => { birds.onStrike(event); sea.onStrike(event); });
  const bird = birds.flocks[0].agents[0];
  const event = weather.strike({ position: bird.p.toArray(), bolt: false });
  assert(Array.isArray(event.position));
  assert(Number.isFinite(bird.scatterAt));
  birds.update(.25, .25, { rain: 1 });
  assert.equal(bird.reason, 'lightning');
  const fish = sea.species[0].agents[0];
  weather.strike({ position: fish.p.toArray(), bolt: false });
  assert(fish.dartUntil > 0 && fish.dart.y < 0);
  sea.update(1 / 60, {});
  assert.equal(fish.reason, 'lightning');
});

test('accepted multi-second updates do not discard elapsed behavior time', () => {
  const birds = new Birds(hf), sea = new SeaLife(hf, [], { quality: 'low' });
  birds.update(2, 2, {}); sea.update(2, {});
  assert(Math.abs(birds.time - 2) < 1e-8, 'bird clock must advance whole accepted delta');
  assert(Math.abs(sea.time - 2) < 1e-8, 'sea clock must advance whole accepted delta');
});

test('storms measurably deepen actual sharks at both quality tiers without floor or glass violations', () => {
  for (const quality of ['high', 'low']) {
    const clear = new SeaLife(hf, [], { quality }), storm = new SeaLife(hf, [], { quality });
    const values = { clear: [], storm: [] };
    for (let tick = 0; tick < 1080; tick++) {
      clear.update(1 / 60, {}); storm.update(1 / 60, { rain: 1, waves: 1, wind: 1 });
      for (const [name, system] of [['clear', clear], ['storm', storm]]) for (const a of system.sharks.agents) {
        if (tick >= 600) { const floor = hf.heightAt(a.p.x, a.p.z); values[name].push((a.p.y - floor) / -floor); }
        assert(!a.unavailable);
        assert(a.p.y >= a.bounds.bottom - 1e-8 && a.p.y <= a.bounds.top + 1e-8);
        assert(Math.abs(a.p.x) + a.bounds.extent[0] < 50 && Math.abs(a.p.z) + a.bounds.extent[2] < 50);
      }
    }
    const mean = a => a.reduce((sum, x) => sum + x, 0) / a.length;
    assert(mean(values.storm) < mean(values.clear) - .025, quality + ' real storm depth');
  }
});
