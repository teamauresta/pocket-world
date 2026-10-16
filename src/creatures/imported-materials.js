/** Explicit legacy glTF specular/glossiness support; no source-file conversion. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export const SPEC_GLOSS_EXTENSION='KHR_materials_pbrSpecularGlossiness';
export class ImportedSpecGlossMaterial extends THREE.MeshStandardMaterial {
  constructor(params={}) {
    const {specGlossColor, glossiness, specGlossMap, ...standard}=params;
    super(standard);this.specGlossColor=new THREE.Color().setRGB(...(specGlossColor||[1,1,1]));
    this.glossiness=glossiness??1;this.specGlossMap=specGlossMap||null;
    this.metalness=0;this.roughness=1-this.glossiness;
    this.userData.importedMaterial={extension:SPEC_GLOSS_EXTENSION,conversion:'native diffuse and linear specular F0 / glossiness BRDF; not metallic-roughness rebaking'};
    if(this.specGlossMap)this.defines={...this.defines,OWNER_SPEC_GLOSS_MAP:1};
    this.onBeforeCompile=function(s){
      s.uniforms.ownerSpecular={value:this.specGlossColor};s.uniforms.ownerGlossiness={value:this.glossiness};
      const map=this.specGlossMap;
      s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\n#ifdef OWNER_SPEC_GLOSS_MAP\nuniform mat3 ownerSpecGlossTransform;varying vec2 ownerSpecGlossUv;\n#endif`)
        .replace('#include <uv_vertex>',`#include <uv_vertex>\n#ifdef OWNER_SPEC_GLOSS_MAP\nownerSpecGlossUv=(ownerSpecGlossTransform*vec3(${map?.channel===1?'uv1':map?.channel===2?'uv2':map?.channel===3?'uv3':'uv'},1.0)).xy;\n#endif`);
      if(map){map.updateMatrix();s.uniforms.ownerSpecGlossMap={value:map};s.uniforms.ownerSpecGlossTransform={value:map.matrix};}
      s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nuniform vec3 ownerSpecular;uniform float ownerGlossiness;\n#ifdef OWNER_SPEC_GLOSS_MAP\nuniform sampler2D ownerSpecGlossMap;varying vec2 ownerSpecGlossUv;\n#endif`)
        .replace('#include <roughnessmap_fragment>',`vec4 ownerSpecGloss=vec4(ownerSpecular,ownerGlossiness);\n#ifdef OWNER_SPEC_GLOSS_MAP\nownerSpecGloss*=texture2D(ownerSpecGlossMap,ownerSpecGlossUv);\n#endif\nfloat roughnessFactor=1.0-clamp(ownerSpecGloss.a,0.0,1.0);`)
        .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>\nmaterial.metalness=0.0;\nmaterial.diffuseContribution=diffuseColor.rgb*(1.0-max(max(ownerSpecGloss.r,ownerSpecGloss.g),ownerSpecGloss.b));\nmaterial.specularColor=clamp(ownerSpecGloss.rgb,vec3(0.0),vec3(1.0));\nmaterial.specularColorBlended=material.specularColor;\nmaterial.specularF90=1.0;`);
    };
    this.customProgramCacheKey=()=> 'owner-spec-gloss-v1:'+Number(!!this.specGlossMap)+':'+(this.specGlossMap?.channel||0);
  }
  copy(source){super.copy(source);this.specGlossColor.copy(source.specGlossColor);this.glossiness=source.glossiness;this.specGlossMap=source.specGlossMap;return this;}
}
export class ImportedSpecGlossExtension {
  constructor(parser){this.parser=parser;this.name=SPEC_GLOSS_EXTENSION;}
  getMaterialType(index){if(this.parser.json.materials[index].extensions?.[this.name])return ImportedSpecGlossMaterial;return null;}
  async extendMaterialParams(index,params){
    const ext=this.parser.json.materials[index].extensions?.[this.name];if(!ext)return;
    const diffuse=ext.diffuseFactor||[1,1,1,1];params.color=new THREE.Color().setRGB(diffuse[0],diffuse[1],diffuse[2]);params.opacity=diffuse[3];
    params.specGlossColor=(ext.specularFactor||[1,1,1]).slice();params.glossiness=ext.glossinessFactor??1;
    const pending=[];
    if(ext.diffuseTexture)pending.push(this.parser.assignTexture(params,'map',ext.diffuseTexture,THREE.SRGBColorSpace));
    if(ext.specularGlossinessTexture)pending.push(this.parser.assignTexture(params,'specGlossMap',ext.specularGlossinessTexture,THREE.SRGBColorSpace));
    await Promise.all(pending);
    // A custom spec/gloss map needs the corresponding real UV attribute enabled.
    if(params.specGlossMap){params.defines={...params.defines,USE_UV:1};const channel=params.specGlossMap.channel||0;if(channel)params.defines['USE_UV'+channel]=1;}
    delete params.metalnessMap;delete params.roughnessMap;params.metalness=0;
  }
}
export function createImportedMaterialLoader(manager){return new GLTFLoader(manager).register(parser=>new ImportedSpecGlossExtension(parser));}
