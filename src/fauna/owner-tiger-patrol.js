/** Closed, obstacle-qualified native-tiger route. No teleport or phase restart.
 * Bounds retain the existing 10% slope / .09 roughness / full native radius gate.
 * Center [34.5,-39.5], radius .75: root extent [33.75,35.25] x [-40.25,-38.75].
 * Signed angularSpeed is THREE root Y angular velocity, not compass yaw.
 */
export const OWNER_TIGER_PATROL=Object.freeze({x:34.5,z:-39.5,radius:.75,angularSpeed:.12,ramp:2});
export function createOwnerTigerPatrol(route=OWNER_TIGER_PATROL){
 let elapsed=0,angle=0,blocked=false;
 const point=a=>({x:route.x+Math.cos(a)*route.radius,z:route.z+Math.sin(a)*route.radius});
 return {
  step(dt,safe=()=>true){
   if(!Number.isFinite(dt)||dt<0)throw Error('Invalid patrol delta');
   const ease=t=>{const u=Math.min(1,t/route.ramp);return u*u*(3-2*u);};
   const omega=blocked?0:route.angularSpeed*ease(elapsed+dt*.5),next=angle+omega*dt,p=point(next);
   if(!safe(p.x,p.z)){blocked=true;return {...point(angle),yaw:-angle,speed:0,angularSpeed:0,cycles:angle/(2*Math.PI),blocked};}
   if(dt>0){angle=next;elapsed+=dt;}
   return {...p,yaw:-angle,speed:omega*route.radius,angularSpeed:-omega,cycles:angle/(2*Math.PI),blocked};
  },
  reset(){elapsed=angle=0;blocked=false;},
  snapshot(){return {elapsed,angle,cycles:angle/(2*Math.PI),blocked};}
 };
}
