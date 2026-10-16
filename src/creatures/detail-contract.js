// Shared animal-detail interface; rest-space ids do not depend on pose or LOD.
export const ANIMAL_PARTS = Object.freeze({ body:0, head:1, muzzle:2, cheek:3, nose:4, ear:5, paw:6, legF:7, legH:8, tail:9, neck:10, antler:11, toe:12, claw:13, hoof:14, eyelid:15, eye:16, lips:17, innerEar:18 });
export const ANIMAL_DETAIL_BUDGET = Object.freeze({ nearTriangles:20000, farTriangles:5000, farDistance:36, nearDistance:30, furFadeDistance:30, highShells:12, lowShells:6 });
// buildAnimal(key,{lod:'near'|'far'}) => existing geo/joints/feet plus detail:
// { lod, eyes:[{center:[x,y,z],radius:[x,y,z],side:1|-1}], species, triangleCount }.
// Geometry attributes: aRestPosition(vec3), aDetailPart(float); final pose skin
// attributes remain unchanged. feet has exactly four actual support anchors.
// Appearance module: createAnimalMaterial(species) -> MeshPhysicalMaterial;
// attachAnimalDetail(mesh,rig,data,{quality,seed}) -> {update({time,dt,distance,
// night,wet}),dispose(),snapshot()}. Parent owns integration/LOD scene wiring.
