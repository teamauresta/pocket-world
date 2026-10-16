// World-space, non-instanced lianas follow actual Float32 branch endpoints.
import * as THREE from 'three';
import { depthMaterialFor, distanceMaterialFor } from './materials.js';

export const LIANA_ATTRIBUTES = Object.freeze({start:'aLianaStart',end:'aLianaEnd',t:'aLianaT'});
export const LIANA_WIND_HEADER = /* glsl */ `
attribute vec3 aLianaStart; attribute vec3 aLianaEnd; attribute float aLianaT;
vec3 lianaBranchOffset(vec3 endpoint) {
  // xy = instance base xz; z = normalized branch-local attachment height.
  float bend = pow(clamp(endpoint.z, 0.0, 1.5), 2.2000);
  float phase = dot(endpoint.xy, vec2(.131, .173));
  float gust = smoothstep(.6, 1.0, sin(dot(endpoint.xy, uWind) * .08 - uTime * .9 * (.5 + uWindStrength))) * uWindGust;
  float sway = sin(uTime * 1.25 + phase) * .6 + sin(uTime * 2.15 + phase * 1.7) * .3 + sin(uTime * 3.7 + phase * 2.3) * .1;
  vec3 offset = vec3(0.0);
  offset.xz = uWind * sway * bend * .1600 * (.4 + 2.2 * uWindStrength) * (1.0 + gust);
  offset.xz += uWind * .6 * uWindStrength * uWindStrength * bend;
  return offset;
}
`;
export const LIANA_WIND_CHUNK = /* glsl */ `
#ifndef USE_INSTANCING
  // applyWind has already applied rigid card rotation AND vegOffset. Undo only
  // that old offset (including legacy flutter), never the rigid card rotation.
  transformed -= vegOffset;
  transformed += mix(lianaBranchOffset(aLianaStart), lianaBranchOffset(aLianaEnd), aLianaT);
#endif
#include <project_vertex>
`;
export function applyLianaWind(material) {
  if(material.userData.lianaWind)return material;
  if(!material.userData.vegetationWind)throw new Error('Liana hook requires existing applyWind');
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    if(!shader.vertexShader.includes('transformed += vegOffset;'))throw new Error('Liana applyWind composition contract changed');
    // Insert after the shared uniforms, before existing helper functions.
    shader.vertexShader=shader.vertexShader.replace('vec3 vegRotate',LIANA_WIND_HEADER+'\nvec3 vegRotate')
      .replace('#include <project_vertex>',LIANA_WIND_CHUNK);
  };
  material.customProgramCacheKey=()=>key+'|liana-endpoints-v1';
  material.userData.lianaWind={amp:.16,stiff:2.2,heightScale:1,method:'ring/card-constant endpoint interpolation'};
  return material;
}
// THREE.Material.clone does NOT copy onBeforeCompile/defaultAttributeValues.
// Copy the composed hooks explicitly; never mutate snag/shared source materials.
export function ownLianaMaterials(source) {
  const color=source.clone();
  color.onBeforeCompile=source.onBeforeCompile;
  const key=source.customProgramCacheKey();color.customProgramCacheKey=()=>key;
  color.defaultAttributeValues={...source.defaultAttributeValues};
  const depth=depthMaterialFor(color),distance=distanceMaterialFor(color);
  for(const m of [color,depth,distance])applyLianaWind(m);
  return {color,depth,distance};
}
export function addLianaAttributes(geometry,start,end,parameters) {
  const count=geometry.attributes.position.count;
  if(parameters.length!==count||![...start,...end,...parameters].every(Number.isFinite))throw new Error('Invalid liana endpoint attributes');
  for(const [name,value]of [[LIANA_ATTRIBUTES.start,start],[LIANA_ATTRIBUTES.end,end]]){
    const a=new Float32Array(count*3);for(let i=0;i<count;i++)a.set(value,i*3);
    geometry.setAttribute(name,new THREE.BufferAttribute(a,3));
  }
  geometry.setAttribute(LIANA_ATTRIBUTES.t,new THREE.Float32BufferAttribute(parameters,1));
}
// CPU reference, intentionally exposed for measured endpoint regression tests.
export function lianaBranchOffsetCPU(endpoint,{time,wind,strength,gust}){
  const [x,z,h]=endpoint,bend=Math.pow(Math.max(0,Math.min(1.5,h)),2.2),phase=x*.131+z*.173;
  const t=Math.max(0,Math.min(1,(Math.sin((x*wind[0]+z*wind[1])*.08-time*.9*(.5+strength))-.6)/.4));
  const g=t*t*(3-2*t)*gust;
  const sway=Math.sin(time*1.25+phase)*.6+Math.sin(time*2.15+phase*1.7)*.3+Math.sin(time*3.7+phase*2.3)*.1;
  const d=sway*bend*.16*(.4+2.2*strength)*(1+g)+.6*strength*strength*bend;
  return [wind[0]*d,0,wind[1]*d];
}
