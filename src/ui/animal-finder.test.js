import test from 'node:test';
import assert from 'node:assert/strict';
import { animalChoices } from './animal-finder.js';

test('finder groups present species and deduplicates individuals',()=>{
 const groups=animalChoices([{key:'native_bear'},{key:'native_wolf'},{key:'native_bear'},{key:'ownerBird'},{key:'native_whale'},{key:'native_coralFish'},{key:'does-not-exist'}]);
 assert.deepEqual(groups.map(g=>g.label),['Land','Birds','Sea']);
 assert.deepEqual(groups[0].choices.map(c=>c.key),['native_bear','native_wolf']);
 assert.equal(groups[0].choices[0].label,'Bear');assert.equal(groups[2].choices.length,2);
 assert(!JSON.stringify(groups).includes('stag'));
});
test('empty or not-yet-loaded finder advertises no absent animals',()=>{
 assert.deepEqual(animalChoices([]),[]);assert.deepEqual(animalChoices([{key:'native_elephant'}],{}),[]);
});
