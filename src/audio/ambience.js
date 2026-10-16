// Ambient sound made live with Web Audio: surf, wind in the leaves, the waterfall, birdsong by day and
// crickets by night. Nothing is downloaded; everything is shaped noise and short synthesized chirps.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.night = 0;
    this.nextBird = 0;
    this.nextCricket = 0; this.nextPatter = 0; this.pendingThunder = []; this.transients = new Set(); this.generation = 0;
  }

  async start() {
    const generation = ++this.generation;
    if (!this.ctx) this.build();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (generation !== this.generation) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.7, t, 0.6);
    this.on = true;
  }

  stop() {
    this.generation++; this.pendingThunder.length = 0; this.on = false;
    for(const source of this.transients) { try { source.stop(); } catch {} } this.transients.clear();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0, t);
    this.on = false;
  }

  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // brown-ish noise source, shared by every texture
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5 + w * 0.08;
      }
    }
    this.noiseBuffer = buf;
    const noise = () => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * 3);
      return s;
    };

    // surf: low rumble that swells every few seconds
    const surf = noise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 650;
    this.surfGain = ctx.createGain();
    this.surfGain.gain.value = 0.35;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.11;
    const swellAmt = ctx.createGain();
    swellAmt.gain.value = 0.2;
    swell.connect(swellAmt).connect(this.surfGain.gain);
    swell.start();
    surf.connect(lp).connect(this.surfGain).connect(this.master);

    // wind in the leaves
    const wind = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.5;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.05;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 0.035;
    gust.connect(gustAmt).connect(this.windGain.gain);
    gust.start();
    wind.connect(bp).connect(this.windGain).connect(this.master);

    // waterfall: steady hiss, louder when the camera is close
    const fall = noise();
    const fb = ctx.createBiquadFilter();
    fb.type = 'bandpass'; fb.frequency.value = 950; fb.Q.value = 0.35;
    this.fallGain = ctx.createGain();
    this.fallGain.gain.value = 0;
    fall.connect(fb).connect(this.fallGain).connect(this.master);

    const rain = noise(), hp = ctx.createBiquadFilter(), rainBand = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 400; rainBand.type = 'bandpass'; rainBand.frequency.value = 3000; rainBand.Q.value = .45;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(hp).connect(rainBand).connect(this.rainGain).connect(this.master);
    const whistle = noise(), wb = ctx.createBiquadFilter(); wb.type='bandpass';wb.frequency.value=900;wb.Q.value=6;
    this.whistleGain=ctx.createGain();this.whistleGain.gain.value=0;whistle.connect(wb).connect(this.whistleGain).connect(this.master);
    this.birdBus = ctx.createGain();
    this.birdBus.gain.value = 0.18;
    this.birdBus.connect(this.master);
    this.cricketBus = ctx.createGain();
    this.cricketBus.gain.value = 0;
    this.cricketBus.connect(this.master);
  }

  chirp(bus, { f0, f1, dur, pan, gain }) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(bus); } else o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  strike(event, now, camera) {
    if(!this.on || !this.ctx) return;
    const distance = camera ? Math.hypot(...event.position.map((v,i)=>v-camera[i])) : event.distance;
    this.pendingThunder.push({ due: now + Math.max(.3,Math.min(3,distance/343*.2)), distance });
  }
  noiseBurst(duration, gain, frequency, pan = 0, thunder = false) {
    if(!this.on) return;
    const ctx=this.ctx,t=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=ctx.createGain();
    source.buffer=this.noiseBuffer;source.loop=true;filter.type=thunder?'lowpass':'bandpass';filter.frequency.setValueAtTime(frequency,t);
    if(thunder)filter.frequency.exponentialRampToValueAtTime(120,t+duration);
    amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(gain,t+.03);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter).connect(amp);
    if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;amp.connect(p).connect(this.master);}else amp.connect(this.master);
    this.transients.add(source);source.onended=()=>{source.disconnect();filter.disconnect();amp.disconnect();this.transients.delete(source);};source.start();source.stop(t+duration+.05);
  }
  // state: { night (0..1), zoom (0 far .. 1 close), fall (0..1 closeness to the waterfall), underwater (0..1) }
  update(state, now) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const day = 1 - state.night;
    this.surfGain.gain.setTargetAtTime(0.28 + 0.25 * state.underwater, t, 0.5);
    const wind=state.wind ?? .2,rain=state.rain ?? 0;
    this.windGain.gain.setTargetAtTime(.02+.12*wind, t, .8);
    this.rainGain.gain.setTargetAtTime(.35*rain,t,.3);
    this.whistleGain.gain.setTargetAtTime(Math.max(0,wind-.7)*.3,t,.5);
    if(!state.paused){
      for(const event of this.pendingThunder.filter(e=>e.due<=now)) this.noiseBurst(3+Math.random()*3,.65/(1+event.distance/120),900,Math.random()-.5,true);
      this.pendingThunder=this.pendingThunder.filter(e=>e.due>now);
      if(rain>.01&&now>=this.nextPatter){this.noiseBurst(.04,.1*rain,3000,Math.random()*2-1);this.nextPatter=now+1/(20*rain);}
    }
    this.fallGain.gain.setTargetAtTime((0.02 + 0.3 * state.fall) * (1+rain), t, 0.5);
    this.birdBus.gain.setTargetAtTime(0.16 * day * (0.5 + 0.5 * state.zoom), t, 1);
    this.cricketBus.gain.setTargetAtTime(0.05 * state.night, t, 1);
    // birdsong: short phrases of two to four notes
    if (day > 0.2 && now > this.nextBird) {
      const n = 2 + Math.floor(Math.random() * 3);
      const base = 2300 + Math.random() * 1800;
      const pan = Math.random() * 1.6 - 0.8;
      for (let i = 0; i < n; i++) {
        setTimeout(() => this.chirp(this.birdBus, { f0: base * (1 + Math.random() * 0.2), f1: base * (1.25 + Math.random() * 0.4), dur: 0.07 + Math.random() * 0.06, pan, gain: 0.5 }), i * (90 + Math.random() * 60));
      }
      this.nextBird = now + 0.9 + Math.random() * 2.8;
    }
    // crickets: rapid triple pulses
    if (state.night > 0.3 && now > this.nextCricket) {
      const f = 4300 + Math.random() * 600;
      const pan = Math.random() * 1.4 - 0.7;
      for (let i = 0; i < 3; i++) setTimeout(() => this.chirp(this.cricketBus, { f0: f, f1: f * 1.02, dur: 0.035, pan, gain: 0.35 }), i * 45);
      this.nextCricket = now + 0.25 + Math.random() * 0.7;
    }
  }
}
