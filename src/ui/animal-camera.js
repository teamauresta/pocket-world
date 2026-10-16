import * as T from 'three';

/** Fast, conservative foliage-envelope search, not a pixel visibility certificate.
 * Camera only: no scenery hiding, animal moves, terrain edits or per-frame work. */
export function chooseAnimalCamera(target,preferred,{canopies=[],heightAt=()=>-100,radius=1}={}) {
 const boxes=canopies.map(c=>new T.Box3(new T.Vector3(c.minX-.12,c.minY-.12,c.minZ-.12),new T.Vector3(c.maxX+.12,c.maxY+.12,c.maxZ+.12))),distance=Math.max(8,preferred.length()),r=Math.min(1,radius*.25),samples=[target,target.clone().add(new T.Vector3(r,0,0)),target.clone().add(new T.Vector3(-r,0,0)),target.clone().add(new T.Vector3(0,0,r)),target.clone().add(new T.Vector3(0,0,-r))],ray=new T.Ray(),hit=new T.Vector3();
 const candidates=[preferred.clone()];for(const degrees of [5,10,15,20,25,40,55,70])for(let i=0;i<12;i++){const a=i*Math.PI/6,p=degrees*Math.PI/180;candidates.push(new T.Vector3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p)).multiplyScalar(distance));}
 let best=null;
 for(const offset of candidates){const position=target.clone().add(offset);if(position.y<heightAt(position.x,position.z)+.8)continue;let cost=0;
  for(const point of samples){const length=position.distanceTo(point);ray.set(position,point.clone().sub(position).normalize());let blocks=0;
   for(const box of boxes){if(box.containsPoint(position)){blocks+=5;continue;}if(ray.intersectBox(box,hit)&&hit.distanceTo(position)<length-Math.min(.4,radius*.2))blocks++;if(blocks>=8)break;}
   cost+=blocks;
   for(let k=1;k<12;k++){const p=position.clone().lerp(point,k/12);if(p.y<heightAt(p.x,p.z)+.12){cost+=30;break;}}
  }
  const preference=offset.distanceTo(preferred)/Math.max(1,distance)*.04,score=cost+preference;if(!best||score<best.score)best={position,score,blockedScore:cost};
 }
 return best||{position:target.clone().add(preferred),score:Infinity,blockedScore:Infinity};
}
