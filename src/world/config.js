// World dimensions. The diorama is viewed from the front corner (+x, +z).
// "front" axis d = (x + z) / sqrt2 points at the viewer, "right" axis e = (x - z) / sqrt2 points to screen-right.
export const HALF = 50; // the slice spans [-HALF, HALF] on x and z
export const SEA = 0; // sea level
export const DEEP = -22; // typical deep sea floor
export const BOTTOM = -27; // bottom of the earth cross-section (top of the plinth)
export const BASE_H = 6.5; // height of the walnut plinth
export const BASE_MARGIN = 3.5; // how far the plinth extends past the slice
export const GRID = 257; // heightfield samples per side
export const CELL = (2 * HALF) / (GRID - 1);
export const INSET = 6.5; // strait between the island and the back glass
export const PEAK = { x: -27.5, z: -27.5 };

// Open glades kept free of trees: home ranges for the animals. Given in (d, e) and radius.
export const GLADES = [
  { name: 'meadow', d: 2, e: 17, r: 10 },
  { name: 'riverside', d: -8, e: 5, r: 6 },
  { name: 'jungle', d: -2, e: -23, r: 6.5 },
  { name: 'bamboo', d: 0, e: -8, r: 5.5 },
];
export const SEED = 11;

export const SQ = Math.SQRT1_2;
export const dOf = (x, z) => (x + z) * SQ;
export const eOf = (x, z) => (x - z) * SQ;
export const fromDE = (d, e) => [(d + e) * SQ, (d - e) * SQ];
