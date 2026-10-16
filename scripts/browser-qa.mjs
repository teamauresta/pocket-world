#!/usr/bin/env node
/** Independent review harness: no app/dependency/config writes, no server startup. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
if (args.includes('--help')) {
  console.log('node scripts/browser-qa.mjs --url http://127.0.0.1:PORT/ --out review/run [--lite] [--baseline] [--probe] [--timeout 180000] [--chromium PATH] [--playwright PATH]');
  process.exit(0);
}
const url = new URL(option('--url', 'http://127.0.0.1:5173/'));
url.searchParams.set('test', '1');
if (args.includes('--lite')) url.searchParams.set('lite', '1');
const output = path.resolve(option('--out', 'review/browser-qa'));
await fs.mkdir(output, { recursive: true });
const timeout = Number(option('--timeout', '180000'));
const baseline = args.includes('--baseline');
const { chromium } = await import(option('--playwright', '') ? pathToFileURL(option('--playwright', '')).href : 'playwright');
const report = { started: new Date().toISOString(), url: url.href, baseline, lite: args.includes('--lite'), rendering: 'Software WebGL requested; actual renderer recorded per context. Not hardware performance evidence.', checks: [], screenshots: [], errors: [], consoleErrors: [], warnings: [], failedRequests: [], httpErrors: [] };
const check = async (name, fn) => {
  const started = Date.now();
  try { const evidence = await fn(); report.checks.push({ name, status: 'pass', ms: Date.now() - started, evidence }); console.log('PASS', name); return evidence; }
  catch (e) { report.checks.push({ name, status: 'fail', ms: Date.now() - started, error: e.stack || String(e) }); console.error('FAIL', name, e.message); return null; }
};
const near = (a, b, epsilon = .025) => Number.isFinite(a) && Math.abs(a - b) <= epsilon;
const changed = (a, b) => a.some((v, i) => Math.abs(v - b[i]) > 1e-4);
const weatherTargets = {
  clear: { cloud: .05, rain: 0, wind: .2, fog: 0, waves: .2, lightning: 0 },
  cloudy: { cloud: .6, rain: 0, wind: .35, fog: .15, waves: .3, lightning: 0 },
  rain: { cloud: .85, rain: .6, wind: .5, fog: .35, waves: .5, lightning: 0 },
  storm: { cloud: 1, rain: 1, wind: .9, fog: .5, waves: 1, lightning: 1 },
};
// Adapter is deliberately narrow: unsupported hooks fail instead of manufacturing success.
async function state(page) {
  return page.evaluate(() => {
    const i = window.__isle, w = i.weather;
    const simple = (obj) => obj && Object.fromEntries(Object.entries(obj).filter(([, v]) => ['number', 'boolean', 'string'].includes(typeof v)));
    const current = simple(w?.current || w?.values || w);
    const target = simple(w?.target || w?.targets); // Do not infer targets from the harness's expected table.
    const uniforms = Object.fromEntries(Object.entries(i.U || i.uniforms || {}).filter(([k]) => /^u(Cloud|Rain|Wet|Fog|Flash|WindStrength|MoonPhase)$/.test(k)).map(([k,v]) => [k,v.value]));
    return { current, target, auto: w?.auto ?? w?.autoMode ?? (w ? w.mode === 'auto' : undefined), mode: w?.state ?? w?.stateName ?? w?.mode, windMode: w?.windMode, uniforms, weatherKeys: w ? Object.keys(w) : [], camera: i.camera.position.toArray(), targetCamera: i.controls.target.toArray(), quaternion: i.camera.quaternion.toArray(), distance: i.camera.position.distanceTo(i.controls.target), frames: i.frames?.(), bolt: w?.bolt?.visible ?? i.lightning?.bolt?.visible ?? i.weatherFX?.bolt?.visible, reduced: w?.reducedMotion ?? w?.reduced };
  });
}
async function renderedFrames(page, count = 2) {
  const start = await page.evaluate(() => window.__isle.frames());
  await page.waitForFunction(({ start, count }) => window.__isle.frames() >= start + count, { start, count }, { timeout });
}
async function resume(page) {
  await page.evaluate(() => { if (typeof window.__isle.resume !== 'function') throw Error('Missing __isle.resume(): capture pauses the baseline render loop'); window.__isle.resume(); });
}
async function capture(page, label, spec) {
  const receipt = await page.evaluate(async s => await window.__isle.capture(s), { ui: true, t: 12, frames: 2, ...spec });
  const observed = await state(page);
  const filename = label + '.png';
  await page.screenshot({ path: path.join(output, filename), timeout });
  report.screenshots.push({ filename, spec, receipt, observed, inspection: 'Requires visual inspection; saved image alone is not a visual pass.' });
  return { receipt, observed, filename };
}
async function panelControls(page) {
  const button = page.locator('#weatherBtn, #weatherToggle, button[aria-controls="weatherPanel"]').first();
  const fallback = page.getByRole('button', { name: /weather/i }).first();
  const trigger = await button.count() ? button : fallback;
  const controlled = await trigger.getAttribute('aria-controls');
  assert(controlled, 'Weather trigger must reference panel using aria-controls');
  const panel = page.locator('#' + controlled);
  return { trigger, panel };
}
async function openPanel(page) {
  const p = await panelControls(page);
  if (await p.trigger.getAttribute('aria-expanded') !== 'true') await p.trigger.click();
  await p.panel.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await p.trigger.getAttribute('aria-expanded'), 'true');
  return p;
}
async function choice(page, kind, value) {
  const { panel } = await openPanel(page);
  const data = panel.locator('[data-' + kind + '="' + value + '"]');
  if (await data.count() === 1) return data;
  const group = panel.getByRole('group', { name: kind === 'weather' ? /weather/i : /wind/i });
  return group.getByRole('button', { name: new RegExp('^' + value + '$', 'i') });
}
async function assertPressed(button) {
  assert.equal(await button.evaluate(el => el.tagName), 'BUTTON');
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
}
async function overflow(page) {
  const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth, escaping: [...document.querySelectorAll('#dock, #weatherPanel, [data-weather], [data-wind]')].filter(el => el.getClientRects().length).map(el => ({ id: el.id || el.textContent.trim(), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(r => r.left < -1 || r.right > innerWidth + 1) }));
  assert(result.scroll <= result.width + 1 && result.body <= result.width + 1 && !result.escaping.length, JSON.stringify(result));
  return result;
}
// Observe real Web Audio nodes without starting or resuming audio on the app's behalf.
async function instrumentAudio(context) {
  await context.addInitScript(() => {
    const contexts = [], gains = [], edges = [];
    window.__qaAudio = { contexts, gains, edges };
    for (const key of ['AudioContext', 'webkitAudioContext']) {
      const Native = window[key]; if (!Native) continue;
      window[key] = new Proxy(Native, { construct(Target, values) { const c = Reflect.construct(Target, values); contexts.push(c); return c; } });
    }
    const gain = BaseAudioContext.prototype.createGain;
    BaseAudioContext.prototype.createGain = function(...a) { const g = gain.apply(this, a); gains.push(g); return g; };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(...a) { const result = connect.apply(this, a); edges.push({ from: this, to: a[0] }); return result; };
    window.__qaAudioSnapshot = () => ({ contexts: contexts.map(c => ({ state: c.state, time: c.currentTime })), outputGains: edges.filter(e => contexts.some(c => e.to === c.destination) && e.from.gain).map(e => e.from.gain.value), directOutputNodes: edges.filter(e => contexts.some(c => e.to === c.destination)).map(e => e.from.constructor.name) });
  });
}
function attachErrors(page, device) {
  page.on('pageerror', e => report.errors.push({ device, message: e.stack || String(e) }));
  page.on('console', m => { const line = { device, message: m.text(), location: m.location() }; if (m.type() === 'error') report.consoleErrors.push(line); if (m.type() === 'warning') report.warnings.push(line); });
  page.on('requestfailed', r => report.failedRequests.push({ device, url: r.url(), local: new URL(r.url()).origin === url.origin, error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) report.httpErrors.push({ device, url: r.url(), local: new URL(r.url()).origin === url.origin, status: r.status() }); });
}
let browser;
try {
  // chromiumSandbox:true overrides Playwright's normal no-sandbox default. No fallback that weakens security.
  browser = await chromium.launch({ executablePath: option('--chromium', '/snap/bin/chromium'), headless: true, chromiumSandbox: true, timeout: 60000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  report.browser = await browser.version();
  if (args.includes('--probe')) {
    const page = await browser.newPage();
    await check('isolated software WebGL2 capability', async () => {
      const r = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) throw Error('WebGL2 context unavailable'); const e = g.getExtension('WEBGL_debug_renderer_info'); return { version: g.getParameter(g.VERSION), renderer: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), vendor: e ? g.getParameter(e.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR) }; });
      assert.match(r.renderer, /SwiftShader|llvmpipe|software/i); report.probe = r; return r;
    });
  } else for (const device of ['desktop', 'mobile']) {
    const mobile = device === 'mobile';
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    await instrumentAudio(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000); attachErrors(page, device);
    const loaded = await check(device + ': scene ready and actual renderer', async () => {
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForFunction(() => window.__isle?.ready, null, { timeout });
      const observed = await page.evaluate(() => { const i = window.__isle, gl = i.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION), viewport: { width: innerWidth, height: innerHeight }, canvas: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight }, keys: Object.keys(i), memory: i.renderer.info.memory }; });
      assert.match(observed.renderer, /SwiftShader|llvmpipe|software/i);
      assert(observed.canvas.width > 0 && observed.canvas.height > 0);
      await page.screenshot({ path: path.join(output, device + '-initial.png'), timeout });
      report.screenshots.push({ filename: device + '-initial.png', inspection: 'Initial UI + actual rendered canvas; manual inspection required' });
      return observed;
    });
    if (!loaded) { await context.close(); continue; }
    await check(device + ': initial layout', () => overflow(page));
    await check(device + ': audio not enabled on load', async () => { const a = await page.evaluate(() => window.__qaAudioSnapshot()); assert(a.contexts.every(c => c.state !== 'running') || (a.outputGains.length > 0 && a.outputGains.every(g => g === 0)), JSON.stringify(a)); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false'); return a; });
    if (!baseline) {
      await check(device + ': weather panel Escape outside and keyboard', async () => {
        let { trigger, panel } = await openPanel(page);
        await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' }); assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        await trigger.focus(); await page.keyboard.press('Enter'); await panel.waitFor({ state: 'visible' });
        await page.mouse.click(10, 110); await panel.waitFor({ state: 'hidden' }); assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        await openPanel(page); await overflow(page); await page.screenshot({ path: path.join(output, device + '-weather-panel.png'), timeout });
        report.screenshots.push({ filename: device + '-weather-panel.png' });
      });
      await check(device + ': wind Auto before weather targets', async () => { const b = await choice(page, 'wind', 'auto'); await b.click(); await assertPressed(b); });
      for (const mode of ['storm', 'clear', 'cloudy', 'rain', 'auto']) await check(device + ': weather button ' + mode, async () => {
        const before = await state(page), b = await choice(page, 'weather', mode); await b.click(); await assertPressed(b);
        const immediate = await state(page); assert(immediate.current && immediate.target, 'Missing numeric current/target weather instrumentation: ' + JSON.stringify(immediate));
        if (mode === 'auto') assert.equal(immediate.auto, true);
        else { assert.equal(immediate.auto, false); for (const [key, expected] of Object.entries(weatherTargets[mode])) assert(near(immediate.target[key], expected), key + ' target mismatch: ' + JSON.stringify(immediate)); }
        await renderedFrames(page, 4);
        const after = await state(page);
        for (const key of ['cloud', 'rain', 'wind', 'fog', 'waves']) assert(Number.isFinite(after.current[key]) && after.current[key] >= 0 && after.current[key] <= 1, 'Bad continuous ' + key);
        if (mode !== 'auto') {
          const moving = ['cloud', 'rain', 'wind', 'fog', 'waves'].filter(k => Math.abs(immediate.current[k] - immediate.target[k]) > .03);
          assert(moving.length, 'All values snapped at UI click instead of easing (or no measurable transition)');
          assert(moving.some(k => Math.abs(after.current[k] - after.target[k]) < Math.abs(immediate.current[k] - immediate.target[k])), 'No actual easing observed across rendered frames');
        }
        return { before, immediate, after };
      });
      for (const [mode, expected] of [['calm', .1], ['breezy', .4], ['windy', .75], ['auto', null]]) await check(device + ': wind button ' + mode, async () => {
        const b = await choice(page, 'wind', mode); await b.click(); await assertPressed(b);
        const before = await state(page); assert(before.target && Number.isFinite(before.target.wind), 'Missing wind target');
        if (expected !== null) assert(near(before.target.wind, expected), JSON.stringify(before));
        else { const weatherMode = String(before.mode).toLowerCase(); assert(weatherTargets[weatherMode], 'Unknown current weather mode for Auto wind: ' + JSON.stringify(before)); assert(near(before.target.wind, weatherTargets[weatherMode].wind)); }
        await renderedFrames(page, 4); const after = await state(page);
        if (Math.abs(before.current.wind - before.target.wind) > .01) assert(Math.abs(after.current.wind - after.target.wind) < Math.abs(before.current.wind - before.target.wind), 'Wind did not ease');
        return { before, after };
      });
      await page.keyboard.press('Escape');
      await check(device + ': clock communicates rain', async () => { const b = await choice(page, 'weather', 'rain'); await b.click(); await page.waitForFunction(() => /Rain/i.test(document.getElementById('clockName')?.textContent || ''), null, { timeout }); return page.locator('#clockName').innerText(); });
      await page.keyboard.press('Escape');
    }
    await check(device + ': pointer orbit and wheel transform', async () => {
      const before = await state(page); const box = await page.locator('#app canvas').boundingBox(); const x = box.x + box.width * .5, y = box.y + box.height * .42;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 35, { steps: 8 }); await page.mouse.up(); await renderedFrames(page, 2);
      const orbit = await state(page); assert(changed(before.quaternion, orbit.quaternion) && changed(before.camera, orbit.camera), 'Orbit did not change camera');
      await page.mouse.wheel(0, -240); await page.waitForFunction(d => Math.abs(window.__isle.camera.position.distanceTo(window.__isle.controls.target) - d) > .1, orbit.distance, { timeout });
      return { before, orbit, zoom: await state(page) };
    });
    if (mobile) await check('mobile: native emulated touch orbit and pinch', async () => {
      const cdp = await context.newCDPSession(page), before = await state(page);
      const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x,y,id]) => ({ x,y,id,radiusX:2,radiusY:2,force:1 })) });
      await send('touchStart', [[160,300,1]]); for (let n = 1; n <= 6; n++) await send('touchMove', [[160+n*12,300+n*3,1]]); await send('touchEnd', []); await renderedFrames(page, 2);
      const orbit = await state(page); assert(changed(before.quaternion, orbit.quaternion), 'Touch orbit failed');
      await send('touchStart', [[150,330,1],[230,330,2]]); for (let n = 1; n <= 6; n++) await send('touchMove', [[150-n*7,330,1],[230+n*7,330,2]]); await send('touchEnd', []); await renderedFrames(page, 2);
      const pinch = await state(page); assert(Math.abs(pinch.distance-orbit.distance) > .1, 'Pinch zoom failed'); await cdp.detach(); return { before, orbit, pinch };
    });
    await check(device + ': non-sound gestures cannot enable audio', async () => { const a = await page.evaluate(() => window.__qaAudioSnapshot()); assert(a.contexts.length === 0 || (a.outputGains.length > 0 && a.outputGains.every(g => g <= .001)), JSON.stringify(a)); return a; });
    await check(device + ': sound click opens gate and mute closes real output gain', async () => {
      await page.locator('#sound').click();
      await page.waitForFunction(() => { const a = window.__qaAudioSnapshot(); return a.contexts.some(c => c.state === 'running') && a.outputGains.some(g => g > .01); }, null, { timeout });
      const on = await page.evaluate(() => window.__qaAudioSnapshot()); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
      await page.locator('#sound').click();
      await page.waitForFunction(() => { const a = window.__qaAudioSnapshot(); return a.contexts.every(c => c.state !== 'running') || (a.outputGains.length > 0 && a.outputGains.every(g => g < .001)); }, null, { timeout });
      const off = await page.evaluate(() => window.__qaAudioSnapshot()); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false'); return { on, off, limitation: 'Proves graph gate, not audible speaker quality or thunder timbre. Gain fade allowed.' };
    });
    if (!baseline) await check(device + ': Sky view exposes celestial body and Overview restores framing', async () => {
      await page.locator('[data-view="sky"]').click();
      await page.waitForFunction(() => { const i=window.__isle; const d=i.U.uCelestialSun.value.y>.02?i.U.uCelestialSun.value:i.U.uMoonDir.value; return i.camera.getWorldDirection(i.camera.position.clone()).dot(d)>.995; }, null, {timeout});
      const sky=await page.evaluate(()=>({limit:window.__isle.controls.maxPolarAngle,camera:window.__isle.camera.position.toArray()}));
      assert(near(sky.limit,Math.PI,.00001));
      await page.locator('[data-view="overview"]').click();
      await page.waitForFunction(() => { const i=window.__isle; return i.controls.target.distanceTo(i.camera.position.clone().set(0,innerWidth/innerHeight<1?-16:-9,0))<.01; }, null, {timeout});
      const restored=await page.evaluate(()=>{const i=window.__isle; return {limit:i.controls.maxPolarAngle, corners:[[-53,-20,-53],[-53,-20,53],[53,-20,-53],[53,-20,53]].map(p=>i.camera.position.clone().set(...p).project(i.camera).toArray())};});
      assert(near(restored.limit,94*Math.PI/180,.00001));
      for(const p of restored.corners) assert(Math.abs(p[0])<.96&&Math.abs(p[1])<.96,'complete Overview base framing');
      return {sky,restored};
    });
    const shots = baseline ? [ ['clear-noon', { time: 12.5 }], ['clear-sunset', { time: 17.5 }], ['clear-night', { time: 22.5 }] ] : [
      ['clear-noon', { time: 12.5, weather: 'clear' }], ['clear-sunset', { time: 17.5, weather: 'clear' }], ['clear-twilight', { time: 18 + 40/60, weather: 'clear' }],
      ...[0,.25,.5].map(p => ['night-phase-' + p, { time: 22.5, weather: 'clear', moonPhase: p }]),
      ['night-cloudy', { time: 22.5, weather: 'cloudy', moonPhase: .5 }], ['rain-overview', { time: 16, weather: 'rain', wind: 'breezy' }], ['rain-meadow', { name: 'meadow', time: 16, weather: 'rain', wind: 'windy' }],
      ['storm-flash', { time: 16, weather: 'storm', flash: 1, bolt: true }], ['storm-reef', { name: 'reef', time: 16, weather: 'storm', flash: 0 }], ['windy', { name: 'meadow', time: 16, weather: 'clear', wind: 'windy' }],
    ];
    for (const [label, spec] of shots) await check(device + ': capture ' + label, async () => {
      const r = await capture(page, device + '-' + label, spec);
      if (!baseline) {
        for (const key of ['cloud','rain','fog','waves']) assert(near(r.observed.current?.[key], weatherTargets[spec.weather][key]), 'capture must snap ' + key);
        if (spec.moonPhase !== undefined) assert(near(r.observed.uniforms.uMoonPhase ?? r.observed.current.moonPhase, spec.moonPhase, .001), 'Moon phase not exposed/applied');
        if (spec.flash === 1) assert(near(r.observed.uniforms.uFlash ?? r.observed.current.flash, 1, .001), 'Forced flash not applied');
      }
      return r;
    });
    if (!baseline) await check(device + ': runtime reduced motion Auto off soft flash no bolt', async () => {
      await resume(page); const auto = await choice(page, 'weather', 'auto'); await auto.click(); assert.equal((await state(page)).auto, true); await page.keyboard.press('Escape');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => window.__isle.weather.auto === false || window.__isle.weather.autoMode === false || (typeof window.__isle.weather.mode === 'string' && window.__isle.weather.mode !== 'auto'), null, { timeout });
      const r = await capture(page, device + '-reduced-storm', { time: 22.5, weather: 'storm', flash: 1, bolt: true });
      const s = r.observed, flash = s.uniforms.uFlash ?? s.current?.flash;
      assert(Number.isFinite(flash) && flash <= .30001, 'Reduced-motion flash cap missing');
      assert.equal(s.auto, false);
      // Named scene traversal is fallback only; absence of an instrumented bolt is not evidence of invisibility.
      const bolt = s.bolt ?? await page.evaluate(() => { const objects = []; for (const root of [window.__isle.scene, window.__isle.seaScene]) root?.traverse(o => { if (/lightning.*bolt|bolt/i.test(o.name)) objects.push(o); }); return objects.length ? objects.some(o => o.visible && (!o.material || o.material.opacity > 0)) : null; });
      assert.equal(bolt, false, 'Need real bolt visibility false (expose __isle.weatherFX.bolt or named scene node)');
      return { ...s, bolt };
    });
    await context.close();
  }
} catch (error) {
  report.checks.push({ name: 'harness/browser startup', status: 'fail', error: error.stack || String(error) });
} finally {
  await browser?.close();
  if (!args.includes('--probe')) {
    await check('no uncaught page errors', async () => { assert.equal(report.errors.length, 0, JSON.stringify(report.errors)); });
    await check('no console errors', async () => { assert.equal(report.consoleErrors.length, 0, JSON.stringify(report.consoleErrors)); });
    await check('no failed local asset requests', async () => { const failures = [...report.failedRequests, ...report.httpErrors].filter(r => r.local); assert.equal(failures.length, 0, JSON.stringify(failures)); });
  }
  report.finished = new Date().toISOString();
  report.summary = { passed: report.checks.filter(c => c.status === 'pass').length, failed: report.checks.filter(c => c.status === 'fail').length, screenshots: report.screenshots.length, warnings: report.warnings.length };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'summary.md'), '# Pocket World browser QA\n\n' + JSON.stringify(report.summary) + '\n\n' + report.rendering + '\n\n' + report.checks.map(c => '- ' + c.status.toUpperCase() + ' ' + c.name + (c.error ? ': ' + c.error.split('\n')[0] : '')).join('\n') + '\n\nScreenshots need human inspection. Animal reactions/detail, real-device FPS, long-run Auto/drying and audible output quality are not certified by this harness.\n');
  console.log(JSON.stringify(report.summary), path.join(output, 'report.json'));
  process.exitCode = report.summary.failed ? 1 : 0;
}
