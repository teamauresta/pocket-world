import * as THREE from 'three';
import { ANIMAL_PARTS as P, ANIMAL_DETAIL_BUDGET as B } from './detail-contract.js';
import { composeAnimalShader, createAnimalMaterial, patchAnimalRest } from './animal-surface.js';
import { applyWet } from '../render/shared.js';

// A genuine 3D density volume, sampled at rest-space roots on every shell.
// Repeated axes avoid UV seams; the per-shell threshold tapers strand tips.
export function createHairVolume(seed=1,size=32) {
  const bytes=new Uint8Array(size*size*size);let s=seed>>>0;
  for(let i=0;i<bytes.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;bytes[i]=s>>>24;}
  const t=new THREE.Data3DTexture(bytes,size,size,size);t.format=THREE.RedFormat;t.type=THREE.UnsignedByteType;
  t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=t.wrapR=THREE.RepeatWrapping;t.unpackAlignment=1;t.needsUpdate=true;
  t.name='animal-procedural-hair-volume';return t;
}
const UNIFORMS=/* glsl */ `
uniform highp sampler3D uAnimalHair;
uniform float uAnimalShell;
uniform float uAnimalFurLength;
uniform float uAnimalFurFade;
uniform float uAnimalFurWet;
uniform float uAnimalFurNight;
uniform vec4 uAnimalEye0;
uniform vec4 uAnimalEye1;
`;
// A continuous eligibility varying controls BOTH length and coverage.
// Rounding interpolated part ids made hard, triangular hardware rims.
const MASK_FUNCTION=/* glsl */ `
float animalFurCoverage(vec3 p,vec3 n,float id) {
  if(id==${P.nose}.0||id==${P.antler}.0||id==${P.toe}.0||id==${P.claw}.0||id==${P.hoof}.0||id==${P.eye}.0||id==${P.lips}.0||id==${P.eyelid}.0||id==${P.innerEar}.0||id==${P.muzzle}.0||id==${P.paw}.0) return 0.0;
  float mask=smoothstep(0.13,0.28,p.y);
  if(id==${P.ear}.0) mask*=0.12;
  if(id==${P.head}.0||id==${P.cheek}.0) mask*=0.23;
  mask*=smoothstep(uAnimalEye0.w*1.5,uAnimalEye0.w*3.2,length(p-uAnimalEye0.xyz));
  mask*=smoothstep(uAnimalEye1.w*1.5,uAnimalEye1.w*3.2,length(p-uAnimalEye1.xyz));
  return mask;
}
`;
export const FUR_MASK=/* glsl */ `
varying float vAnimalFurCoverage;
float animalFurMask() { return smoothstep(0.02,0.72,vAnimalFurCoverage); }
`;
const EXTRUDE=/* glsl */ `
// Feather extrusion to zero BEFORE skinning instead of trimming inflated caps.
vAnimalFurCoverage=animalFurCoverage(aRestPosition,normal,aDetailPart);
float animalLength=uAnimalFurLength*uAnimalShell*uAnimalFurFade*(1.0-uAnimalFurWet*0.52)*vAnimalFurCoverage;
vec3 animalComb=vec3(-0.22,-0.12,0.0);
transformed += (normalize(normal)+animalComb*uAnimalShell)*animalLength;
`;
const DISCARD=/* glsl */ `
float furMask=animalFurMask();
// Fine sparse cross-sections, same 3D root across layers = coherent strands.
float hair=texture(uAnimalHair,vAnimalRest*19.0).r;
float threshold=mix(0.69,0.90,uAnimalShell);
float aa=clamp(fwidth(hair)*0.55,0.025,0.11);
float furAlpha=smoothstep(threshold-aa,threshold+aa,hair)*furMask*uAnimalFurFade;
if(furAlpha<0.06)discard;
`;

export function patchFurShader(shader,uniforms,depth=false) {
  patchAnimalRest(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+UNIFORMS+'\nvarying float vAnimalFurCoverage;\n'+MASK_FUNCTION)
    .replace('#include <skinning_vertex>',EXTRUDE+'\n#include <skinning_vertex>');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+UNIFORMS)
    .replace('void main()',FUR_MASK+'\nvoid main()')
    .replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+DISCARD+(depth?'\nif(furAlpha<0.4)discard;':''));
  if(!depth)shader.fragmentShader=shader.fragmentShader
    .replace('#include <opaque_fragment>',`
      float animalRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0);
      // Rim modulates existing illumination; never a self-emitting neon outline.
      outgoingLight += reflectedLight.directDiffuse*animalRim*0.07*(1.0-uAnimalFurNight*0.8);
      diffuseColor.a *= furAlpha*0.60;
      #include <opaque_fragment>`);
}

export function createAnimalFur(owner,data,{species='tiger',quality='high',seed=1}={}) {
  const constraints=[],shells=[],materials=[],layers=[];let texture=null,disposed=false,fade=0,budgetWeights=null;
  const valid=owner.isSkinnedMesh&&owner.skeleton&&owner.geometry.attributes.aRestPosition&&owner.geometry.attributes.aDetailPart;
  if(!valid&&quality!=='off')constraints.push('Fur requires bound SkinnedMesh with rest-position and stable part attributes.');
  const count=valid&&quality!=='off'?(quality==='low'?B.lowShells:B.highShells):0;
  const eye=(index)=>{const e=data.detail?.eyes?.[index];return e?new THREE.Vector4(...e.center,Math.max(...e.radius)*1.35):new THREE.Vector4(1e3,1e3,1e3,0.001);};
  const common={uAnimalFurFade:{value:0},uAnimalFurWet:{value:0},uAnimalFurNight:{value:0},uAnimalEye0:{value:eye(0)},uAnimalEye1:{value:eye(1)}};
  if(count)texture=createHairVolume(seed);
  for(let i=0;i<count;i++){
    const uniforms={...common,uAnimalFurFade:{value:0},uAnimalHair:{value:texture},uAnimalShell:{value:(i+1)/count},uAnimalFurLength:{value:species==='bear'||species==='panda'?0.020:species==='tiger'?0.012:0.008}};
    const mat=createAnimalMaterial(species);mat.name='animal-fur-shell-'+i;mat.transparent=true;mat.depthWrite=false;mat.side=THREE.FrontSide;
    composeAnimalShader(mat,'shell-v4',s=>patchFurShader(s,uniforms));applyWet(mat);materials.push(mat);
    const shell=new THREE.SkinnedMesh(owner.geometry,mat);shell.name='animal-fur-'+i;shell.userData.animalFur=true;
    // Identity child, not a clone of owner's transform. attached bind inverse
    // MUST follow its world matrix; copying inverse once doubles a moved root.
    owner.add(shell);shell.bindMode=owner.bindMode;shell.bind(owner.skeleton,owner.bindMatrix);
    shell.frustumCulled=false;shell.receiveShadow=owner.receiveShadow;shell.visible=false;
    shell.renderOrder=owner.renderOrder;
    // One outer shell casts a consistent sparse fur shadow, not 12 shadow
    // passes. Inner layers remain represented by the solid owner's shadow.
    shell.castShadow=i===count-1&&owner.castShadow;
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    const distance=new THREE.MeshDistanceMaterial();
    for(const m of [depth,distance]){composeAnimalShader(m,'shell-depth-v4',s=>patchFurShader(s,uniforms,true));materials.push(m);}
    shell.customDepthMaterial=depth;shell.customDistanceMaterial=distance;
    shells.push(shell);layers.push(uniforms);
  }
  return {constraints,shells,
    // Admission changes only visibility/extrusion, never topology or skin bind.
    setBudgetWeights(weights=null){
      if(weights!==null&&(!Array.isArray(weights)||weights.length!==count||weights.some(v=>!Number.isFinite(v)||v<0||v>1)))throw new RangeError('Invalid fur layer weights');
      budgetWeights=weights?.slice()??null;
    },
    update(distance,wet,night){
      if(disposed)return;
      fade=Number.isFinite(distance)?1-THREE.MathUtils.smoothstep(distance,18,B.furFadeDistance):0;
      common.uAnimalFurFade.value=fade;common.uAnimalFurWet.value=Number.isFinite(wet)?THREE.MathUtils.clamp(wet,0,1):0;common.uAnimalFurNight.value=Number.isFinite(night)?THREE.MathUtils.clamp(night,0,1):0;
      for(let i=0;i<shells.length;i++){const shell=shells[i],weight=budgetWeights?.[i]??1;layers[i].uAnimalFurFade.value=fade*weight;shell.visible=fade*weight>0.005;shell.receiveShadow=owner.receiveShadow;}
    },
    snapshot(){return {budgeted:budgetWeights!==null,layerWeights:budgetWeights?.slice()??null,shellCount:shells.length,visibleShells:shells.filter(s=>s.visible).length,fade,volumeSize:texture?texture.image.width:0,genuineShells:true,shadowShells:shells.filter(s=>s.visible&&s.castShadow).length,drawCallsUpperBound:shells.filter(s=>s.visible).length,disposed};},
    dispose(){if(disposed)return;disposed=true;for(const shell of shells)shell.removeFromParent();for(const m of materials)m.dispose();texture?.dispose();/* shared geometry / skeleton / owner material deliberately not disposed */},
  };
}
