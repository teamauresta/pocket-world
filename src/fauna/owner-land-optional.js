/** Optional original elephant adapter; caller must explicitly load/wire it.
 * Panda has no deforming locomotion; elk authored root travel needs separate
 * extraction/contact qualification. Neither is silently translated as walking.
 */
export const OWNER_ELEPHANT_PROFILE=Object.freeze({key:'elephant',file:'elephant.glb',size:3.2,home:'meadow',yaw:0,walk:'TRS|walk',rest:'TRS|idle',restMode:'idle',pace:.4,feet:['leftLeg1_LoResFoot_07','rightLeg1_LoResFoot_011','leftLeg2_LoResFoot_034','rightLeg2_LoResFoot_038'],habitat:{x:4,z:-40,major:1,minor:.25,angle:0,pace:.4,walkSeconds:16,restSeconds:3}});
