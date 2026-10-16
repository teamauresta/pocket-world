import * as THREE from 'three';
import { U } from '../render/shared.js';
import { PEAK } from './config.js';
import { mulberry32 } from '../core/noise.js';
// Output depth is not copied by the existing composite: sample opaque depth explicitly.
const clip = `uniform sampler2D tDepth; uniform sampler2D tHeight; uniform vec2 uResolution; varying vec3 vWorld;
void occlude(){if(vWorld.y<max(0.0,texture2D(tHeight,(vWorld.xz+50.0)/100.0).r))discard;if(max(abs(vWorld.x),abs(vWorld.z))>50.0)discard;float d=texture2D(tDepth,gl_FragCoord.xy/uResolution).x;if(gl_FragCoord.z>d+.000002)discard;}`;
const uniforms = height => ({ ...U, tHeight:{value:height},tDepth:{value:null},uResolution:{value:new THREE.Vector2()},uScale:{value:400} });
export class Rain {
  constructor(hf,height,canopy,{quality='high',lite=false,leafTexture}={}) {
    this.group=new THREE.Group();this.group.name='weather-particles';this.materials=[];this.hf=hf;
    const rng=mulberry32(823),low=quality==='low';this.maxDrops=lite?600:low?2500:6000;
    const g=new THREE.InstancedBufferGeometry(),plane=new THREE.PlaneGeometry(1,1);
    g.index=plane.index;g.attributes.position=plane.attributes.position;g.attributes.uv=plane.attributes.uv;
    const seeds=new Float32Array(this.maxDrops*3);for(let i=0;i<seeds.length;i++)seeds[i]=rng();g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,3));
    const mat=new THREE.ShaderMaterial({uniforms:uniforms(height),transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`attribute vec3 aSeed;uniform float uTime;uniform vec2 uWind;uniform float uWindStrength;uniform sampler2D tHeight;varying vec2 vUv;varying vec3 vWorld;varying float vAlive;
      void main(){float fall=mod(uTime*38.0+aSeed.z*75.0,75.0);vec3 p=vec3(aSeed.x*100.0-50.0,45.0-fall,aSeed.y*100.0-50.0);p.xz+=uWind*uWindStrength*.35*fall;p.xz=mod(p.xz+50.0,100.0)-50.0;vec3 velocity=normalize(vec3(uWind.x*uWindStrength*.35,-1.0,uWind.y*uWindStrength*.35));vec3 right=normalize(cross(velocity,normalize(cameraPosition-p)));p+=velocity*position.y*.9+right*position.x*.045;float ground=max(0.0,texture2D(tHeight,(p.xz+50.0)/100.0).r);vAlive=step(ground+.5,45.0-fall);vWorld=p;vUv=uv;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
      fragmentShader:clip+`uniform float uFlash;uniform vec3 uSunColor;varying vec2 vUv;varying float vAlive;void main(){if(vAlive<.5)discard;occlude();float a=(1.0-abs(vUv.x*2.0-1.0))*sin(vUv.y*3.14159)*.25;gl_FragColor=vec4(vec3(.6,.75,.9)+uSunColor*.3+uFlash*2.0,a);}`,
    });this.drops=new THREE.Mesh(g,mat);this.add(this.drops,4,'rain');
    const mask=new Uint8Array(64*64);for(let z=0;z<64;z++)for(let x=0;x<64;x++)mask[z*64+x]=canopy.free((x+.5)/64*100-50,(z+.5)/64*100-50,.8)?0:255;
    const canopyTex=new THREE.DataTexture(mask,64,64,THREE.RedFormat);canopyTex.needsUpdate=true;
    const count=lite?150:low?600:1500,positions=[],phases=[];for(let i=0;i<count;i++){positions.push(rng()*100-50,0,rng()*100-50);phases.push(rng());}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sg.setAttribute('aSeed',new THREE.Float32BufferAttribute(phases,1));
    const sm=new THREE.ShaderMaterial({uniforms:{...uniforms(height),tCanopy:{value:canopyTex},uLow:{value:low?1:0}},transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,
      vertexShader:`attribute float aSeed;uniform sampler2D tHeight;uniform sampler2D tCanopy;uniform float uLow;uniform float uTime;uniform float uScale;varying vec3 vWorld;varying float vAge;void main(){vec3 p=position;vec2 uv=(p.xz+50.0)/100.0;float h=texture2D(tHeight,uv).r;p.y=max(0.0,h)+.12;vAge=fract(uTime*.8+aSeed*13.0)*4.0;if(vAge>1.0||(h>0.0&&(uLow>.5||texture2D(tCanopy,uv).r>.2)))p.y=-10000.0;vWorld=p;vec4 mv=viewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.15+vAge*.6)*uScale/max(1.0,-mv.z),1.0,18.0);}`,
      fragmentShader:clip+`uniform float uRain;uniform float uFlash;varying float vAge;void main(){occlude();float r=length(gl_PointCoord-.5);float a=(1.0-smoothstep(.035,.10,abs(r-.32)))*(1.0-vAge)*uRain*.3;gl_FragColor=vec4(vec3(.65,.8,1.0)+uFlash,a);}`,
    });this.splashes=new THREE.Points(sg,sm);this.add(this.splashes,5,'rain-splashes');
    const lg=new THREE.BufferGeometry(),lp=[],ls=[];for(let i=0;i<(lite?40:low?150:400);i++){lp.push(rng()*100-50,rng()*30+3,rng()*100-50);ls.push(rng());}lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));lg.setAttribute('aSeed',new THREE.Float32BufferAttribute(ls,1));
    const lm=new THREE.ShaderMaterial({uniforms:{...uniforms(height),tLeaf:{value:leafTexture}},transparent:true,depthTest:false,depthWrite:false,
      vertexShader:`attribute float aSeed;uniform float uTime;uniform float uScale;uniform vec2 uWind;uniform float uWindStrength;uniform sampler2D tHeight;varying vec3 vWorld;varying float vSeed;void main(){vec3 p=position;p.xz=mod(p.xz+50.0+uWind*uTime*(1.0+uWindStrength*4.0)+vec2(sin(uTime+aSeed*40.0),cos(uTime*.7+aSeed*30.0))*.8,100.0)-50.0;p.y=mod(p.y-uTime*(.3+aSeed*.3),30.0)+3.0;float h=max(0.0,texture2D(tHeight,(p.xz+50.0)/100.0).r);if(p.y<h+.15||aSeed>uWindStrength*uWindStrength)p.y=-10000.0;vWorld=p;vSeed=aSeed;vec4 mv=viewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(.22*uScale/max(1.0,-mv.z),1.0,10.0);}`,
      fragmentShader:clip+`uniform sampler2D tLeaf;uniform float uTime;varying float vSeed;void main(){occlude();float a=uTime+vSeed*40.0;vec2 q=gl_PointCoord-.5;q=mat2(cos(a),-sin(a),sin(a),cos(a))*q+.5;if(any(lessThan(q,vec2(0)))||any(greaterThan(q,vec2(1))))discard;vec4 tex=texture2D(tLeaf,q);if(tex.a<.4)discard;gl_FragColor=vec4(mix(vec3(.3,.4,.08),vec3(.9,.5,.6),step(.8,vSeed))*tex.rgb,tex.a*.8);}`,
    });this.leaves=new THREE.Points(lg,lm);this.add(this.leaves,6,'wind-leaves');
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(360*3),3));bg.setAttribute('aEnd',new THREE.Float32BufferAttribute(new Float32Array(360*3),3));bg.setAttribute('aSide',new THREE.Float32BufferAttribute(new Float32Array(360),1));bg.setDrawRange(0,0);
    const bm=new THREE.ShaderMaterial({uniforms:uniforms(height),transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`attribute vec3 aEnd;attribute float aSide;varying vec3 vWorld;void main(){vec3 across=normalize(cross(normalize(aEnd-position),normalize(cameraPosition-position)));vec3 p=position+across*aSide*.12;vWorld=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
      fragmentShader:clip+`uniform float uFlash;void main(){occlude();gl_FragColor=vec4(vec3(4.0,5.0,7.0),uFlash);}`,
    });this.bolt=new THREE.Mesh(bg,bm);this.add(this.bolt,7,'lightning-bolt');this.bolt.visible=false;
  }
  add(mesh,order,name){mesh.renderOrder=order;mesh.name=name;mesh.frustumCulled=false;this.group.add(mesh);this.materials.push(mesh.material);}
  strike(event){
    const rng=mulberry32(event.seed),end=new THREE.Vector3(PEAK.x,this.hf.heightAt(PEAK.x,PEAK.z)+.3,PEAK.z),start=end.clone().add(new THREE.Vector3(5,40,-3)),points=[];
    const divide=(a,b,depth)=>{if(!depth){points.push([a,b]);return;}const mid=a.clone().lerp(b,.5);mid.x+=(rng()-.5)*depth*1.8;mid.z+=(rng()-.5)*depth*1.8;divide(a,mid,depth-1);divide(mid,b,depth-1);};
    divide(start,end,4);divide(points[6][0],end.clone().add(new THREE.Vector3(8,9,4)),3);
    const g=this.bolt.geometry;let i=0;for(const [a,b]of points)for(const [p,q,side]of [[a,b,-1],[a,b,1],[b,a,1],[a,b,1],[b,a,-1],[b,a,1]]){g.attributes.position.setXYZ(i,p.x,p.y,p.z);g.attributes.aEnd.setXYZ(i,q.x,q.y,q.z);g.attributes.aSide.setX(i,side);i++;}for(const attr of Object.values(g.attributes))attr.needsUpdate=true;g.setDrawRange(0,i);
  }
  update(w){this.drops.geometry.instanceCount=Math.floor(this.maxDrops*w.rain);this.drops.visible=w.rain>.005;this.splashes.visible=w.rain>.01;this.leaves.visible=w.wind>.15&&!w.reducedMotion;this.bolt.visible=!!w.lastStrike?.bolt&&!w.reducedMotion&&w.flash>.02;}
}
