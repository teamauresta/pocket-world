// Forest, jungle canopy, birch grove, meadow oaks and understory bushes, all instanced.
import * as THREE from 'three';
import { generateTree, SPECIES } from './treegen.js';
import { leafMaterial, barkMaterial, depthMaterialFor, distanceMaterialFor, prepareLeafMotion } from './materials.js';
import { makeSampler } from './scatter.js';
import { buildLianas, floweringTexture, buildSnagAccents } from './forest-detail.js';
import { mulberry32 } from '../core/noise.js';
import { VEGETATION_BUDGET } from './detail-contract.js';

const WIND = { amp: 0.16, flutter: 0.02, heightScale: 1, stiff: 2.2 };
const WIND_BARK = { amp: 0.16, heightScale: 1, stiff: 2.2 };
const WIND_BUSH = { amp: 0.06, flutter: 0.015, heightScale: 1, stiff: 1.5 };

export const TREE_SPEC = {
  pine: { seeds: [13977, 2201, 771, 9614, 4851], leaf: 'pine', bark: 'pine', leafTint: [0.62, 0.78, 0.55], barkTint: [0.85, 0.78, 0.72], h: [8.5, 13.5], w: [0.9, 1.15] },
  oak: { seeds: [35729, 4410, 8011, 1981, 7127], leaf: 'oak', bark: 'oak', leafTint: [0.78, 0.92, 0.62], barkTint: [0.8, 0.76, 0.7], h: [7.0, 10.0], w: [1.0, 1.25] },
  ash: { seeds: [8812, 1203, 6291, 4713, 9521], leaf: 'ash', bark: 'oak', leafTint: [0.62, 0.86, 0.5], barkTint: [0.62, 0.6, 0.55], h: [8.0, 11.5], w: [1.05, 1.3] },
  birch: { seeds: [5150, 991, 3077, 8115, 3129], leaf: 'aspen', bark: 'birch', leafTint: [0.72, 0.95, 0.42], barkTint: [1, 1, 1], h: [8.5, 11.5], w: [0.85, 1.05] },
  bush: { seeds: [111, 222, 333, 444, 555], leaf: 'oak', bark: 'oak', leafTint: [0.6, 0.8, 0.5], barkTint: [0.6, 0.55, 0.5], h: [1.5, 2.8], w: [1.3, 1.8] },
};

TREE_SPEC.broadleaf={...TREE_SPEC.ash,seeds:[9101,9102,9103,9104,9105],leaf:'ash',leafTint:[.73,.92,.65]};
TREE_SPEC.fig={...TREE_SPEC.oak,seeds:[8101,8102,8103,8104,8105],leafTint:[.68,.86,.58]};
TREE_SPEC.flowering={...TREE_SPEC.oak,seeds:[7101,7102,7103,7104,7105],leaf:'blossom',leafTint:[1,1,1]};

export function buildTrees(hf, tex, hash, {quality='high'}={}) {
  const group = new THREE.Group();
  group.name = 'trees';
  const sites=[], variants=[], perches = []; // Actual high branch vertices, retained without altering generated geometry.
  const S = makeSampler(hf, 4242);
  const R = S.rng;
  const place = {}; // species -> [variant][] of transforms
  for (const k of Object.keys(TREE_SPEC)) place[k] = TREE_SPEC[k].seeds.map(() => []);
  const add = (sp, x, y, z, rot, h, w, tilt) => {
    // Exactly one draw, as before. New models may not perturb placement RNG.
    const selection=R(),biome=S.at(x,z),originalSpecies=sp;
    if(sp!=='bush'&&biome.jungle>.55) sp=mulberry32((Math.round(x*101)*73856093)^(Math.round(z*101)*19349663))()<.6?'broadleaf':'fig';
    else if(sp==='oak'&&biome.meadow>.4&&biome.glade<.15) sp='flowering';
    const vi=Math.floor(selection*TREE_SPEC[sp].seeds.length);
    const t={x,y,z,rot,h,w,tilt,biome,originalSpecies,species:sp,variant:vi,id:sites.length};
    place[sp][vi].push(t);sites.push(t);
  };
  const pick = (a) => a[0] + R() * (a[1] - a[0]);

  // canopy trees
  S.grid(2.7, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 1.9 || p.slope > 0.5 || p.river < 1.0 || p.coast > -3.5) return;
    const birch = S.smoothstep(14, 26, p.e) * p.meadow;
    const alpine = S.smoothstep(19, 12.5, p.h);
    let prob = (p.forest * 0.92 + p.jungle * 0.9 + p.bamboo * 0.12 + p.meadow * (0.05 + birch * 0.75)) * alpine;
    // keep a clearing in the middle of the meadow and along the river
    prob *= S.smoothstep(0.5, 4, p.river) * (1 - p.glade);
    if (R() > prob) return;
    if (!hash.free(x, z, 1.25)) return;
    let sp;
    if (birch > 0.4 && R() < birch) sp = 'birch';
    else {
      const r = R() * (p.forest + p.jungle + p.meadow + p.bamboo);
      if (r < p.forest) sp = R() < (p.h > 12 ? 0.9 : 0.7) ? 'pine' : 'oak';
      else if (r < p.forest + p.jungle) sp = R() < 0.75 ? 'ash' : 'oak';
      else sp = R() < 0.6 ? 'oak' : 'birch';
    }
    const s = TREE_SPEC[sp];
    let h = pick(s.h) * (sp === 'pine' ? 1 - 0.25 * S.smoothstep(14, 24, p.h) : 1);
    hash.add(x, z, sp === 'pine' ? 1.3 : 1.6);
    add(sp, x, p.h - 0.25, z, R() * Math.PI * 2, h, pick(s.w), (R() - 0.5) * 0.08);
  });

  // understory bushes
  S.grid(1.9, (x, z) => {
    const p = S.at(x, z);
    if (p.h < 1.3 || p.slope > 0.55 || p.river < 0.4 || p.coast > -2) return;
    const prob = (p.forest * 0.32 + p.jungle * 0.45 + p.bamboo * 0.12 + p.meadow * 0.05 + (p.river < 3 ? 0.3 : 0)) * (1 - p.glade * 0.85) * S.smoothstep(21, 15, p.h);
    if (R() > prob) return;
    if (!hash.free(x, z, 0.6)) return;
    hash.add(x, z, 0.6);
    add('bush', x, p.h - 0.1, z, R() * Math.PI * 2, pick(TREE_SPEC.bush.h), pick(TREE_SPEC.bush.w), (R() - 0.5) * 0.2);
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const col = new THREE.Color();
  let tris = 0, count = 0;
  const colorRng=mulberry32(93721);
  for (const [sp, s] of Object.entries(TREE_SPEC)) {
    const leafTex = sp==='flowering' ? floweringTexture(quality) : tex.leaf[s.leaf] || tex.leaf.oak;
    const leafMat = leafMaterial(leafTex, new THREE.Color(...s.leafTint), { quality, species:s.leaf, wind: sp === 'bush' ? WIND_BUSH : WIND, translucency: sp === 'birch' ? 0.6 : 0.45 });
    const barkMat = barkMaterial(tex.bark[s.bark], tex.barkN[s.bark] || null, new THREE.Color(...s.barkTint), { quality, wind: sp === 'bush' ? WIND_BUSH : WIND_BARK });
    const depthLeaf = depthMaterialFor(leafMat, sp === 'bush' ? WIND_BUSH : WIND);
    s.seeds.forEach((seed, vi) => {
      const list = place[sp][vi];
      if (!list.length) return;
      const g = generateTree({ ...SPECIES[sp], seed, roots:sp!=='bush' });
      prepareLeafMotion(g.leaves);
      variants.push({species:sp,variant:vi,seed,instances:list.length,trianglesPerInstance:g.tris,...g.detail});
      const branchPos = g.branches.attributes.position;
      let highest = 0;
      for (let k = 1; k < branchPos.count; k++) if (branchPos.getY(k) > branchPos.getY(highest)) highest = k;
      const branchTip = new THREE.Vector3().fromBufferAttribute(branchPos, highest);
      const bm = new THREE.InstancedMesh(g.branches, barkMat, list.length);
      const lm = new THREE.InstancedMesh(g.leaves, leafMat, list.length);
      bm.name=sp+'-branches-'+vi;lm.name=sp+'-leaves-'+vi;
      bm.userData.detail={species:sp,variant:vi,role:'branches'};lm.userData.detail={species:sp,variant:vi,role:'leaves'};
      bm.customDepthMaterial=depthMaterialFor(barkMat,sp==='bush'?WIND_BUSH:WIND_BARK);
      lm.customDepthMaterial = depthLeaf;
      bm.customDistanceMaterial=distanceMaterialFor(barkMat,sp==='bush'?WIND_BUSH:WIND_BARK);
      lm.customDistanceMaterial=distanceMaterialFor(leafMat,sp==='bush'?WIND_BUSH:WIND);
      list.forEach((t, i) => {
        e.set(t.tilt, t.rot, t.tilt * 0.7);
        q.setFromEuler(e);
        sc.set(t.h * t.w, t.h, t.h * t.w);
        pos.set(t.x, t.y, t.z);
        m4.compose(pos, q, sc);
        bm.setMatrixAt(i, m4);
        lm.setMatrixAt(i, m4);
        if (sp !== 'bush') {
          const anchor = branchTip.clone().applyMatrix4(m4);
          t.attach=anchor.clone();t.branchVertex=highest;t.branchMesh=bm.name;t.instance=i;
          t.branchLocalHeight=branchTip.y;t.branchBaseXZ=[Math.fround(t.x),Math.fround(t.z)];
          perches.push({ siteId:t.id, mesh:bm.name, instance:i, vertex:highest, x: anchor.x, y: anchor.y, z: anchor.z, species: sp, radius: .45, height: t.h,
            localHeight: branchTip.y, windAmp: WIND_BARK.amp, windStiff: WIND_BARK.stiff, instBase: [t.x, t.z] });
        }
        const v = 0.82 + colorRng() * 0.3;
        col.setRGB(v * (0.95 + colorRng() * 0.1), v, v * (0.9 + colorRng() * 0.15));
        lm.setColorAt(i, col);
      });
      for (const m of [bm, lm]) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.computeBoundingSphere();
        group.add(m);
      }
      tris += g.tris * list.length;
      count += list.length;
    });
  }
  // Liana macro wind follows measured branch endpoints with its own materials.
  const vineWind={amp:.025,flutter:.008,heightScale:40,stiff:2.2};
  const vineBark=barkMaterial(tex.bark.oak,tex.barkN.oak||null,new THREE.Color(.4,.38,.22),{quality,wind:vineWind});
  const vineLeaf=leafMaterial(tex.leaf.ash||tex.leaf.oak,new THREE.Color(.64,.82,.46),{quality,species:'ash',wind:vineWind});
  const lianas=buildLianas(sites,hf,vineBark,vineLeaf);
  group.add(lianas);lianas.traverse(m=>{if(m.isMesh){
    tris+=m.geometry.index.count/3;
  }});
  const snags=buildSnagAccents(sites,vineBark);group.add(snags);snags.traverse(m=>{if(m.isMesh)tris+=m.geometry.index.count/3;});
  const vineWoodDepth=depthMaterialFor(vineBark,vineWind);
  for(const accents of [snags])accents.traverse(m=>{if(m.isMesh&&!m.material.alphaTest)m.customDepthMaterial=vineWoodDepth;});
  const roots=variants.reduce((n,v)=>n+(v.tubes||0)*v.instances,0);
  const aerialRoots=variants.reduce((n,v)=>n+(v.aerialRoots||0)*v.instances,0);
  group.userData.detail={quality,variantTarget:VEGETATION_BUDGET.variantsPerSpecies,variants,roots,aerialRoots,
    lianas:lianas.userData.links,snagAccents:snags.userData.accents,deadSnags:snags.userData.accents,sites:sites.map(({attach,...t})=>({...t,attach:attach?.toArray()})),
    placementPolicy:'unchanged single RNG selection draw; biome substitution after original height/radius choice',
    omitted:'Live canopies/shelters retained. Complete bare dead snags share existing occupied footprints; no extra uncollided routes/sites. Fallen floor logs are owned by forest-floor.'};
  group.userData.stats = { tris, count };
  group.userData.perches = perches;
  return group;
}
