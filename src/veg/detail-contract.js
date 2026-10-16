// Shared vegetation-detail interface. Keep placement/navigation RNG independent
// of decoration variation and quality so qualified animal routes stay valid.
export const VEGETATION_ATTRIBUTES=Object.freeze({crownDepth:'aCrownDepth',leafVariant:'aLeafVariant',color:'color'});
export const VEGETATION_BUDGET=Object.freeze({colorPassTriangles:2500000,colorPassCalls:260,leafResolution:1024,variantsPerSpecies:5});
// Tree-generated leaves supply scalar aCrownDepth (0 outer..1 inner), per-card
// aLeafVariant (0..2) and RGB color. Materials must default missing attributes
// for legacy bamboo/palm/fern cards; compose wind/wet/translucency/shadow hooks.
// buildTrees(hf,tex,hash,{quality='high'}={}) keeps userData.perches and adds
// userData.detail (actual species/variant/root/card counts; no fake FPS stats).
// Ground decorations stay OUT of collision inventory. Existing solid records,
// glades, heights and river/coast exclusions remain authoritative.
