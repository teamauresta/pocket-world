/** Owned low-poly roost proxy matched to the supplied bird's visible palette.
 * Not a recolor of the GLB. Source flock geometry/materials remain immutable.
 * Preserves belly support minimum and existing shader fold/flap attributes.
 */
import * as THREE from 'three';
import {BIRDS} from './birds.js';
export const BIRD_FALLBACK_PALETTE=Object.freeze({breast:'#e58f67',head:'#292d2b',wing:'#42483f',back:'#b8bdb7',tail:'#343c36',beak:'#343633'});
export function createBirdFallbackGeometry(flock){
 const geo=flock.mesh.geometry.clone(),p=geo.attributes.position,L=BIRDS[flock.key].L;
 const colors=Object.fromEntries(Object.entries(BIRD_FALLBACK_PALETTE).map(([k,v])=>[k,new THREE.Color(v)]));
 const color=new Float32Array(p.count*3),counts={};
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  // Remove the scarlet macaw's exceptionally long tail; leave the torso, belly
  // support and wing span coordinates intact. Monotonic shortening never expands envelope.
  if(x<-.3*L)x=-.3*L+(x+.3*L)*.48;
  p.setX(i,x);
  const part=x>.41*L?'beak':x>.23*L?'head':Math.abs(z)>.14*L?'wing':x<-.29*L?'tail':y>.035*L?'back':'breast';
  const c=colors[part];c.toArray(color,i*3);counts[part]=(counts[part]||0)+1;
 }
 geo.setAttribute('color',new THREE.BufferAttribute(color,3));
 // These two instance attributes must remain LIVE controller channels, not clone snapshots.
 for(const name of ['aFlap','aFold'])if(flock.mesh.geometry.getAttribute(name))geo.setAttribute(name,flock.mesh.geometry.getAttribute(name));
 geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
 geo.userData.ownerBirdFallback={palette:BIRD_FALLBACK_PALETTE,counts,tailCompression:.48,sourceBottom:flock.bottom};
 return geo;
}
/** Own depth material: no shared flock shadow callback/material mutation. */
export function createBirdFallbackDepth(source){
 const depth=source?source.clone():new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 if(source){depth.onBeforeCompile=source.onBeforeCompile;depth.customProgramCacheKey=source.customProgramCacheKey;}
 return depth;
}

/** RGBADepthPacking does NOT feed material.opacity to diffuseColor.a in Three's
 * depth shader. Explicit owned uniform/discard is required, not opacity metadata. */
export function ownBirdShadowDissolve(depth){
 const prior=depth.onBeforeCompile,key=depth.customProgramCacheKey.bind(depth);
 const fade={value:1};depth.userData.ownerBirdShadowFade=fade;
 depth.onBeforeCompile=shader=>{prior.call(depth,shader);shader.uniforms.uOwnerBirdShadowFade=fade;
  shader.fragmentShader='uniform float uOwnerBirdShadowFade;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',
   'float ownerNoise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453); if(ownerNoise >= uOwnerBirdShadowFade) discard;');
 };
 depth.customProgramCacheKey=()=>key()+'-owner-bird-shadow-dissolve-v1';return depth;
}
