import * as THREE from 'three';
import { ANIMAL_PARTS as P } from './detail-contract.js';
import { createAnimalEyes, detailSeed } from './animal-eye.js';
import { createAnimalFur } from './animal-fur.js';

const SPECIES = ['tiger', 'stag', 'doe', 'fawn', 'bear', 'panda'];
export const finiteUnit = (v, fallback = 0) => Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 1) : fallback;

// Capture now: Three's default key evaluates this.onBeforeCompile dynamically.
export function composeAnimalShader(material, key, patch) {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    patch(shader, renderer);
  };
  material.customProgramCacheKey = () => previousKey + '|animal-' + key;
  material.needsUpdate = true;
  return material;
}

export const ANIMAL_REST_VERTEX = /* glsl */ `
attribute vec3 aRestPosition;
attribute float aDetailPart;
varying vec3 vAnimalRest;
varying vec3 vAnimalRestNormal;
flat varying float vAnimalPart;
varying vec4 vAnimalParts0;
varying vec4 vAnimalParts1;
varying vec4 vAnimalParts2;
varying vec4 vAnimalParts3;
varying vec4 vAnimalParts4;
`;
export const ANIMAL_REST_FRAGMENT = /* glsl */ `
varying vec3 vAnimalRest;
varying vec3 vAnimalRestNormal;
flat varying float vAnimalPart;
varying vec4 vAnimalParts0;
varying vec4 vAnimalParts1;
varying vec4 vAnimalParts2;
varying vec4 vAnimalParts3;
varying vec4 vAnimalParts4;
float animalPart(float id) {
  int k=int(id);
  if(k<4)return vAnimalParts0[k];
  if(k<8)return vAnimalParts1[k-4];
  if(k<12)return vAnimalParts2[k-8];
  if(k<16)return vAnimalParts3[k-12];
  return vAnimalParts4[k-16];
}
float animalHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float animalNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(animalHash(i),animalHash(i+vec3(1,0,0)),f.x),mix(animalHash(i+vec3(0,1,0)),animalHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(animalHash(i+vec3(0,0,1)),animalHash(i+vec3(1,0,1)),f.x),mix(animalHash(i+vec3(0,1,1)),animalHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float animalBand(float phase,float width) {
  float d=abs(fract(phase)-0.5), aa=max(fwidth(phase)*0.6,0.008);
  return 1.0-smoothstep(width-aa,width+aa,d);
}
`;

export function patchAnimalRest(shader) {
  if (!shader.vertexShader.includes('attribute vec3 aRestPosition;')) {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n'+ANIMAL_REST_VERTEX)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAnimalRest=aRestPosition; vAnimalRestNormal=normal; vAnimalPart=aDetailPart;\n'+[0,1,2,3,4].map(g=>'vAnimalParts'+g+'=vec4('+[0,1,2,3].map(i=>'1.0-step(0.49,abs(aDetailPart-'+(g*4+i)+'.0))').join(',')+');').join('\n'));
  }
  if (!shader.fragmentShader.includes('varying vec3 vAnimalRest;')) shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n'+ANIMAL_REST_FRAGMENT);
}

const COAT = /* glsl */ `
vec3 animalCoat() {
  vec3 p=vAnimalRest, n=normalize(vAnimalRestNormal);
  float body=animalPart(${P.body}.0), head=animalPart(${P.head}.0), muzzle=animalPart(${P.muzzle}.0), cheek=animalPart(${P.cheek}.0);
  float legs=max(animalPart(${P.legF}.0),animalPart(${P.legH}.0)), tail=animalPart(${P.tail}.0), ear=animalPart(${P.ear}.0);
  float belly=(1.0-smoothstep(-0.55,0.05,n.y))*body;
  float inner=(1.0-smoothstep(-0.55,0.1,n.z*sign(p.z)))*legs;
  float spine=smoothstep(0.45,0.96,n.y)*body;
  vec3 cream=vec3(0.86,0.81,0.70), black=vec3(0.008,0.007,0.006), col=vec3(0.30,0.13,0.046);
  #if ANIMAL_SPECIES == 0
    col=vec3(0.84,0.29,0.035);
    col=mix(col,cream,max(belly,max(inner*0.87,max(muzzle,cheek)*0.95)));
    float noise=animalNoise(p*5.0)-0.5;
    float phase=p.x*4.8+0.38*sin(p.y*4.0+abs(p.z)*3.1)+noise*0.48;
    float width=mix(0.025,0.20,smoothstep(0.61,1.35,p.y));
    float stripe=animalBand(phase,width)*body*(1.0-belly);
    stripe=max(stripe,animalBand(p.y*6.6+noise*0.37,0.115)*legs*(1.0-inner)*smoothstep(0.15,0.3,p.y));
    stripe=max(stripe,animalBand(p.x*4.6+noise*0.18,0.20)*tail);
    stripe=max(stripe,animalBand(p.y*9.0+abs(p.z)*5.0+noise*0.3,0.12)*max(head,cheek)*smoothstep(1.1,1.2,p.y));
    col=mix(col,black,stripe);
    col=mix(col,black,ear*(1.0-smoothstep(-0.2,0.6,n.x)));
  #elif ANIMAL_SPECIES == 1 || ANIMAL_SPECIES == 2 || ANIMAL_SPECIES == 3
    col=vec3(0.38,0.16,0.052);
    #if ANIMAL_SPECIES == 1
      col*=0.78;
    #endif
    col=mix(col,cream,max(belly,inner*0.63));
    col*=1.0-spine*0.24;
    #if ANIMAL_SPECIES != 1
      float dots=0.0;
      for(int row=0;row<2;row++) {
        float r=float(row), phase=p.x*6.4+r*0.47;
        vec2 q=vec2((fract(phase)-0.5)/0.20,(p.y-(1.13+r*0.14+0.025*sin(p.x*5.0)))/0.041);
        float aa=max(fwidth(length(q)),0.04);
        dots=max(dots,1.0-smoothstep(0.82-aa,1.0+aa,length(q)));
      }
      dots*=body*smoothstep(0.12,0.22,abs(p.z))*(1.0-smoothstep(0.67,0.80,abs(p.x)));
      col=mix(col,cream,dots*0.93);
    #endif
  #elif ANIMAL_SPECIES == 4
    col=vec3(0.19,0.076,0.027)*(1.0-spine*0.24);
    col=mix(col,vec3(0.38,0.20,0.085),max(muzzle*0.7,max(belly,inner)*0.22));
  #elif ANIMAL_SPECIES == 5
    col=cream;
    float saddle=(1.0-smoothstep(0.145,0.205,abs(p.x-0.35+0.15*(p.y-0.9))))*body;
    vec3 e=vec3(p.x-1.25,p.y-1.04,abs(p.z)-0.14);
    vec2 q=mat2(0.878,-0.479,0.479,0.878)*e.xy;
    float pandaEyePatch=1.0-smoothstep(0.88,1.12,length(vec3(q/vec2(0.145,0.095),e.z/0.13)));
    col=mix(col,black,max(max(legs,ear),max(saddle,pandaEyePatch*max(head,muzzle))));
  #endif
  col*=0.97+animalNoise(p*21.0)*0.06;
  // One-hot weights cannot synthesize unrelated part colours across a triangle.
  #if ANIMAL_SPECIES == 0
    col=mix(col,vec3(0.39,0.12,0.095),animalPart(4.0));
  #else
    col=mix(col,black,animalPart(4.0));
  #endif
  col=mix(col,black,max(animalPart(16.0),animalPart(17.0)));
  col=mix(col,vec3(0.34,0.24,0.14),animalPart(11.0));
  col=mix(col,vec3(0.032,0.025,0.019),max(animalPart(13.0),animalPart(14.0)));
  col=mix(col,vec3(0.36,0.22,0.18),animalPart(18.0));
  float foot=max(animalPart(6.0),animalPart(12.0));
  #if ANIMAL_SPECIES == 1 || ANIMAL_SPECIES == 2 || ANIMAL_SPECIES == 3 || ANIMAL_SPECIES == 5
    col=mix(col,black,foot);
  #elif ANIMAL_SPECIES == 0
    col=mix(col,mix(vec3(0.84,0.29,0.035),cream,0.35),foot);
  #else
    col=mix(col,vec3(0.14,0.05,0.018),foot);
  #endif
  return col;
}
`;

export function createAnimalMaterial(species = 'tiger') {
  const id=SPECIES.indexOf(species);
  if(id<0) throw new Error('Unknown animal species: '+species);
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:false,roughness:0.84,metalness:0,sheen:0.5,sheenRoughness:0.65,sheenColor:new THREE.Color(0.7,0.59,0.45)});
  material.name='animal-coat-'+species;
  material.userData.animalSpecies=species;
  composeAnimalShader(material,'coat-v5-'+species,shader=>{
    patchAnimalRest(shader);
    shader.fragmentShader=shader.fragmentShader.replace('void main()', '#define ANIMAL_SPECIES '+id+'\n'+COAT+'\nvoid main()')
      // Before color_fragment: applyWet inserts after it in either hook order.
      .replace('#include <color_fragment>','diffuseColor.rgb = animalCoat();\n#include <color_fragment>');
  });
  return material;
}

/** Does not own mesh material, geometry or skeleton. Reattach after LOD swap. */
export function attachAnimalDetail(mesh,rig,data,{quality='high',seed=1}={}) {
  const species=data.detail?.species||mesh.material.userData.animalSpecies||'tiger';
  const near=data.detail?.lod!=='far';
  const constraints=[];
  if(!data.detail?.eyes?.length) constraints.push('Missing rest-pose eye metadata: eyes not attached.');
  const eyes=createAnimalEyes(rig,near?data:{...data,detail:{...data.detail,eyes:[]}},{species,seed:detailSeed(seed)});
  const fur=createAnimalFur(mesh,data,{species,quality:near?quality:'off',seed:detailSeed(seed)});
  constraints.push(...eyes.constraints,...fur.constraints);
  let disposed=false, elapsed=0, lastTime=null, distance=Infinity, wet=0, night=0;
  return {
    setFurBudget(weights=null){fur.setBudgetWeights(weights);},
    update(state={}) {
      if(disposed) return;
      const dt=Number.isFinite(state.dt)?Math.max(0,state.dt):0;
      const t=Number.isFinite(state.time)?Math.max(0,state.time):null;
      // Backwards seek is an explicit deterministic reset, even while paused.
      if(t!==null&&lastTime!==null&&t<lastTime) elapsed=t;
      else if(dt>0) elapsed+=dt;
      if(t!==null) lastTime=t;
      if(Number.isFinite(state.distance)) distance=Math.max(0,state.distance);
      wet=finiteUnit(state.wet,wet); night=finiteUnit(state.night,night);
      eyes.update(elapsed,near&&distance<36,wet,night);
      fur.update(distance,wet,night);
    },
    snapshot() { return {species,lod:near?'near':'far',quality,seed:detailSeed(seed),disposed,elapsed,distance,wet,night,eyes:eyes.snapshot(),fur:fur.snapshot(),constraints:[...constraints]}; },
    dispose() { if(disposed)return; disposed=true; eyes.dispose(); fur.dispose(); },
  };
}
