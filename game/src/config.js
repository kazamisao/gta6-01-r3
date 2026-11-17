// Solara Bay's fixed numbers: world size, the road grid, speeds, the palette.
// Everything else reads its constants from here so the city, the physics and
// the rendering agree with each other.

export const WORLD = {
  width: 3200,
  height: 2400,
  block: 400, // distance between neighbouring road centrelines
  roadWidth: 76,
  sidewalk: 16,
};

export const PLAYER = {
  radius: 11,
  walkSpeed: 148,
  sprintSpeed: 232,
  maxHealth: 100,
};

export const SAVE_KEY = 'solara-bay-save-v1';
export const CITY_SEED = 20261118;
export const STEP = 1 / 60;

// Sun-soaked coastal palette: warm pavement, turquoise water, coral roofs.
export const PALETTE = {
  sky: '#ffe9c4',
  grass: '#7ec850',
  park: '#69b844',
  sand: '#f4dc9a',
  water: '#1fb6c9',
  waterDeep: '#1593ad',
  road: '#4a4a52',
  roadLine: '#f7e08a',
  sidewalk: '#cfc4ae',
  crosswalk: '#e8e4da',
  roofA: '#e2725b',
  roofB: '#f2a65a',
  roofC: '#d95d7b',
  roofD: '#8ecae6',
  wall: '#fdf3e0',
  palmTrunk: '#8a6642',
  palmLeaf: '#3f9e4d',
};
