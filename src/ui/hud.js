// The overlay: time-of-day control, viewpoints, sound toggle, the info card and the about panel.
import { SPECIES_INFO } from './species.js';

const $ = (id) => document.getElementById(id);

export function timeName(h) {
  if (h < 4.5 || h >= 21) return 'Night';
  if (h < 6.5) return 'Dawn';
  if (h < 10) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17) return 'Afternoon';
  if (h < 19) return 'Golden hour';
  return 'Dusk';
}

export class Hud {
  constructor(handlers) {
    this.h = handlers;
    this.dragging = false;
    const time = $('time');
    time.addEventListener('input', () => { this.dragging = true; this.h.onTime(+time.value); this.label(+time.value); });
    time.addEventListener('change', () => { this.dragging = false; });
    $('play').addEventListener('click', () => this.h.onPlay(!this.playing));
    $('resumeAnimals')?.addEventListener('click', () => this.h.onPlay(true));
    $('animalSelect')?.addEventListener('change', e => { if(e.target.value)this.h.onFind?.(e.target.value); });
    $('qualitySelect')?.addEventListener('change', e => this.h.onQuality?.(e.target.value));
    $('sound').addEventListener('click', () => this.h.onSound(!this.sound));
    for (const b of $('views').querySelectorAll('button')) {
      b.addEventListener('click', () => this.h.onView(b.dataset.view));
    }
    $('infoClose').addEventListener('click', () => this.closeInfo());
    $('follow').addEventListener('click', () => this.h.onFollow(!this.following));
    $('detailBtn')?.addEventListener('click', () => { this.toggleAbout(true); this.aboutOpener = $('detailBtn'); $('qualitySelect').focus(); });
    $('aboutBtn').addEventListener('click', () => { this.aboutOpener = $('aboutBtn'); this.toggleAbout(); });
    $('aboutClose').addEventListener('click', () => this.toggleAbout(false, true));
    $('weather').addEventListener('click', () => this.toggleWeather());
    $('weatherClose').addEventListener('click', () => this.toggleWeather(false, true));
    for (const b of document.querySelectorAll('[data-weather]')) b.addEventListener('click', () => this.h.onWeather(b.dataset.weather));
    for (const b of document.querySelectorAll('[data-wind]')) b.addEventListener('click', () => this.h.onWind(b.dataset.wind));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('weatherPanel').hidden) this.toggleWeather(false, true);
      else if (!$('about').hidden) this.toggleAbout(false, true);
      else if (!$('info').hidden) this.closeInfo();
    });
    document.addEventListener('pointerdown', e => { if(!$('weatherPanel').contains(e.target) && !$('weather').contains(e.target)) this.toggleWeather(false); });
    this.setPlaying(true);
    this.setSound(false);
  }

  label(h) {
    const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
    $('clockTime').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.hour = h;
    $('clockName').textContent = (this.weatherState && this.weatherState !== 'clear' ? this.weatherState[0].toUpperCase() + this.weatherState.slice(1) + ' · ' : '') + timeName(h);
    $('time').setAttribute('aria-valuetext', `${$('clockTime').textContent}, ${timeName(h)}`);
  }

  toggleWeather(force, restoreFocus = false) {
    const open = force ?? $('weatherPanel').hidden;
    $('weatherPanel').hidden = !open; $('weather').setAttribute('aria-expanded', String(open));
    if(open) { this.hideInfo(); this.toggleAbout(false); $('weatherPanel').querySelector('[aria-pressed="true"]').focus(); }
    else if(restoreFocus) $('weather').focus();
  }
  setWeather(w) {
    this.weatherState = w.state;
    for(const b of document.querySelectorAll('[data-weather]')) b.setAttribute('aria-pressed',String(b.dataset.weather===w.mode));
    for(const b of document.querySelectorAll('[data-wind]')) b.setAttribute('aria-pressed',String(b.dataset.wind===w.windMode));
    $('weatherIcon').textContent = {clear:'☀',cloudy:'☁',rain:'☂',storm:'ϟ'}[w.state];
    $('weatherBadge').hidden = w.mode !== 'auto';
    const text = (w.mode==='auto'?'Auto · ':'') + w.state + ' · Wind: ' + w.windMode;
    if($('weatherAnnouncement').textContent!==text) $('weatherAnnouncement').textContent=text;
    this.label(this.hour ?? 16);
  }
  setTime(h) {
    if (this.dragging) return;
    $('time').value = h.toFixed(2);
    this.label(h);
  }

  setPlaying(on) {
    this.playing = on;
    const b = $('play');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Pause island: animals, day and weather' : 'Resume island: animals, day and weather');
    if($('animalsPaused'))$('animalsPaused').hidden=on;
    $('playIcon').setAttribute('d', on ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5l11 7-11 7z');
  }

  setSound(on) {
    this.sound = on;
    const b = $('sound');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    $('soundWave').setAttribute('d', on ? 'M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12' : 'M16 9l5 6M21 9l-5 6');
  }

  setView(name) {
    for (const b of $('views').querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.view === name));
  }

  setQuality(requested, effective) {
    const select=$('qualitySelect');if(select)select.value=['high','low','performance'].includes(requested)?requested:'auto';
    if($('qualityDescription'))$('qualityDescription').textContent='Current: '+(effective==='performance'?'performance: fewer plants, no shadows, bloom or focus blur.':effective==='high'?'high detail.':'balanced.');
  }

  setModelStatus(state) {
    const panel = $('modelStatus');
    if (!panel) return;
    const parts = Object.values(state.parts);
    const loading = parts.filter(p => p.status === 'loading').length;
    const failed = parts.filter(p => p.status === 'failed').length;
    panel.hidden = state.status === 'disabled' || (!loading && !failed);
    $('modelStatusText').textContent = loading
      ? `Loading wildlife: ${parts.filter(p => p.status === 'ready').length} of ${parts.length} groups ready. You can explore now.${failed ? ' Some wildlife could not load.' : ''}`
      : 'Some wildlife could not load. You can keep exploring or retry.';
    $('retryModels').hidden = !failed;
    $('retryModels').disabled = loading > 0;
  }

  closeInfo() {
    this.h.onCloseInfo();
    const target = this.infoOpener?.isConnected && this.infoOpener !== document.body ? this.infoOpener : $('animalSelect');
    target?.focus();
  }

  setAnimals(groups) {
    const select=$('animalSelect');if(!select)return;
    const signature=JSON.stringify(groups);if(signature===this.animalSignature)return;this.animalSignature=signature;
    const previous=select.value;select.replaceChildren(new Option(groups.length?'Find an animal…':'Loading animals…',''));
    for(const group of groups){const node=document.createElement('optgroup');node.label=group.label;for(const choice of group.choices)node.append(new Option(choice.label,choice.key));select.append(node);}
    select.disabled=!groups.length;
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }

  showInfo(key) {
    const select=$('animalSelect');if(select&&[...select.options].some(o=>o.value===key))select.value=key;
    const s = SPECIES_INFO[key];
    if (!s) return;
    $('infoKicker').textContent = s.where;
    $('infoName').textContent = s.name;
    $('infoLatin').textContent = s.latin;
    $('infoFact').textContent = s.fact;
    if ($('info').hidden) this.infoOpener = document.activeElement;
    $('info').hidden = false;
    $('infoClose').focus({ preventScroll: true });
    this.toggleWeather(false);
    $('about').hidden = true;
    $('aboutBtn').setAttribute('aria-expanded', 'false');
    this.setFollowing(false);
  }

  hideInfo() { $('info').hidden = true; this.setFollowing(false);if($('animalSelect'))$('animalSelect').value=''; }

  setFollowing(on) {
    this.following = on;
    $('follow').setAttribute('aria-pressed', String(on));
    $('follow').textContent = on ? 'Following' : 'Follow';
  }

  toggleAbout(force, restoreFocus = false) {
    const open = force ?? $('about').hidden;
    $('about').hidden = !open;
    $('aboutBtn').setAttribute('aria-expanded', String(open));
    if (open) { this.hideInfo(); this.toggleWeather(false); $('aboutClose').focus(); }
    else if (restoreFocus) (this.aboutOpener || $('aboutBtn')).focus();
  }
}
