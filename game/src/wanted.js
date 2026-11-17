// The wanted system: crimes add heat, heat becomes stars, stars decide how
// many police cars hunt the player. Heat only decays while no police officer
// can see the player, so breaking line of sight is how you cool down. Pure
// state and rules, no rendering, so the tests can drive it directly.

export const CRIME_HEAT = {
  theft: 26, // stealing a car
  hitCar: 14, // colliding with traffic
  hitPed: 42, // running a pedestrian down
  shot: 18, // firing the pistol in public
  killPed: 78, // a pedestrian dies
  sabotage: 30, // wrecking a crew car on a mission
};

const STAR_THRESHOLDS = [1, 55, 120, 210, 320];

/** A fresh wanted state: no heat, no stars. */
export function createWanted() {
  return { heat: 0 };
}

/** Add a crime's heat. Unknown crimes add nothing. */
export function addCrime(wanted, crime) {
  const heat = CRIME_HEAT[crime];
  if (heat) wanted.heat = Math.min(500, wanted.heat + heat);
  return wanted;
}

/** How many stars the current heat is worth (0 to 5). */
export function starsFor(wanted) {
  let stars = 0;
  for (const t of STAR_THRESHOLDS) if (wanted.heat >= t) stars += 1;
  return stars;
}

/**
 * Advance the wanted state one step. `seen` is true while any police unit
 * has eyes on the player: heat holds (and creeps up a little at high stars);
 * unseen, it drains away until the stars are gone.
 */
export function updateWanted(wanted, dt, seen) {
  if (seen) {
    if (wanted.heat > 200) wanted.heat = Math.min(500, wanted.heat + 2.5 * dt);
  } else {
    wanted.heat = Math.max(0, wanted.heat - 13 * dt);
  }
  return wanted;
}

/** How many police cars the current stars send out. */
export function policeTarget(wanted) {
  const stars = starsFor(wanted);
  if (stars === 0) return 0;
  return Math.min(6, stars + 1);
}
