/** Screen-door complement: no shared shader/material mutation or alpha blending. */
export const SWIMMER_DETAIL = Object.freeze({high:Object.freeze({near:8,far:14}),low:Object.freeze({near:5,far:9})});
export function swimmerDetailWeight(distance,quality='high') {
  const range=SWIMMER_DETAIL[quality];if(!range||!Number.isFinite(distance)||distance<0)throw new Error('Invalid swimmer detail view');
  const t=Math.max(0,Math.min(1,(distance-range.near)/(range.far-range.near)));return 1-t*t*(3-2*t);
}
export function patchSwimmerScreenDoor(material,uniform,near) {
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.uniforms.ownerSwimmerDetail=uniform;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float ownerSwimmerDetail;')
      .replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nfloat ownerDoor=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(0.06711056,0.00583715))));\n'+
        (near?'if(ownerDoor >= ownerSwimmerDetail) discard;':'if(ownerDoor < ownerSwimmerDetail) discard;'));
  };material.customProgramCacheKey=()=>key+'-owner-swimmer-door-'+(near?'near':'far');return material;
}
