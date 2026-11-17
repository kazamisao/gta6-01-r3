// The story of Solara Bay, as data: Rio Calloway, a driver who owes the
// wrong people money, takes jobs from fixer Marisol "Sol" Vega against the
// Coral Kings crew. Four missions, each a short chain of steps. A step is
// finished by a gameplay event (arrive at a landmark, steal a car, defeat a
// guard, wreck a crew car, shake the heat, collect a case). The machine is
// pure: the game feeds it events, it answers with objectives and rewards.

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Sol Vega',
    intro: 'Sol needs a clean car delivered to Harbor Point, no questions. Steal one and drive it over.',
    reward: 150,
    steps: [
      { event: 'arrive', at: 'marina', text: "Meet Sol at Sol's Marina Office" },
      { event: 'steal', text: 'Steal any car' },
      { event: 'arrive', at: 'harbor', text: 'Deliver the car to Harbor Point Warehouse' },
    ],
  },
  {
    id: 'ledger-run',
    title: 'Ledger Run',
    giver: 'Sol Vega',
    intro: "A ledger in Old Market Alley names every Coral Kings payoff. Pick it up and get it to the safehouse.",
    reward: 250,
    steps: [
      { event: 'arrive', at: 'market', text: 'Pick up the ledger in Old Market Alley' },
      { event: 'defeat', tag: 'marketGuard', count: 2, text: 'Fight off the Coral Kings ambush' },
      { event: 'arrive', at: 'safehouse', text: 'Take the ledger to the Palm Heights Safehouse' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'Sol Vega',
    intro: "Two Coral Kings cars are parked up in Coral Flats. Wreck them both, then shake the heat.",
    reward: 400,
    steps: [
      { event: 'destroy', tag: 'crewCarA', text: 'Wreck the first crew car in Coral Flats' },
      { event: 'destroy', tag: 'crewCarB', text: 'Wreck the second crew car in Coral Flats' },
      { event: 'heatZero', text: 'Lose the police: break line of sight until the stars fade' },
    ],
  },
  {
    id: 'low-tide',
    title: 'Low Tide',
    giver: 'Sol Vega',
    intro: "Dario Venn keeps his evidence case at the estate pier. Take it from his guards and bring it to Sol.",
    reward: 800,
    steps: [
      { event: 'arrive', at: 'estate', text: 'Reach the Venn Estate Pier' },
      { event: 'defeat', tag: 'estateGuard', count: 3, text: "Defeat Venn's guards" },
      { event: 'collect', tag: 'evidence', text: 'Grab the evidence case' },
      { event: 'arrive', at: 'marina', text: "Bring the evidence back to Sol's Marina Office" },
    ],
  },
];

/** A fresh mission-chain state: first mission, first step. */
export function createMissionState() {
  return { index: 0, step: 0, count: 0, done: false };
}

/** The mission the state is currently playing, or null when the chain is done. */
export function currentMission(state) {
  if (state.done || state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

/** The current step to show on the HUD, or null when the chain is done. */
export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.step] ?? null;
}

/** Does this gameplay event satisfy the current step? */
function stepMatches(step, event) {
  if (!step || !event || step.event !== event.type) return false;
  if (step.at !== undefined && step.at !== event.at) return false;
  if (step.tag !== undefined && step.tag !== event.tag) return false;
  return true;
}

/**
 * Feed one gameplay event to the chain. Returns what changed:
 * { advanced, missionComplete, reward, chainComplete }. Counted steps (a
 * number of guards to defeat) advance only when their count is reached.
 */
export function notifyMission(state, event) {
  const out = { advanced: false, missionComplete: false, reward: 0, chainComplete: false };
  const mission = currentMission(state);
  if (!mission) return out;
  const step = mission.steps[state.step];
  if (!stepMatches(step, event)) return out;
  const needed = step.count ?? 1;
  state.count += 1;
  if (state.count < needed) return out;
  state.count = 0;
  state.step += 1;
  out.advanced = true;
  if (state.step >= mission.steps.length) {
    out.missionComplete = true;
    out.reward = mission.reward;
    state.index += 1;
    state.step = 0;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      out.chainComplete = true;
    }
  }
  return out;
}
