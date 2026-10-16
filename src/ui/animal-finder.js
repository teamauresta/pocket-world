import { SPECIES_INFO } from './species.js';

/** Offer actual actors only; one choice per species, not per individual. */
export function animalChoices(candidates, info = SPECIES_INFO) {
  const seen = new Set(), groups = { Land: [], Birds: [], Sea: [] };
  for (const c of candidates) {
    if (seen.has(c.key) || !info[c.key]) continue;
    seen.add(c.key);
    const group = c.domain || (['eagle','gull','macaw','ownerBird','ownerEagle'].includes(c.key) ? 'Birds'
      : /^(native_(whale|shark|dolphin|turtle|school|fish|coralFish)|ownerTuna|shark|manta|turtle|silver|clown|bluetang|yellowtang|angel|idol)$/.test(c.key) ? 'Sea' : 'Land');
    if (!groups[group]) continue;
    groups[group].push({ key:c.key, label:info[c.key].name.replace(/ · (supplied model|owner model)$/, '') });
  }
  return Object.entries(groups).filter(([,choices])=>choices.length).map(([label,choices])=>({label,choices}));
}
