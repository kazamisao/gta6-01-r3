// Saving and loading: the save is one JSON object in localStorage holding
// cash, mission progress and where the player stood. Serialize and parse are
// pure functions so the tests can round-trip them without a browser, and the
// parser refuses anything that is not a well-formed Solara Bay save.

export const SAVE_VERSION = 1;

/** Turn a save object into the stored string. */
export function serializeSave(data) {
  return JSON.stringify({
    version: SAVE_VERSION,
    cash: Math.max(0, Math.floor(data.cash ?? 0)),
    missionIndex: data.missionIndex ?? 0,
    missionStep: data.missionStep ?? 0,
    x: data.x ?? 0,
    y: data.y ?? 0,
    inCar: Boolean(data.inCar),
  });
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Parse a stored string back into a save object, or null when it is not one. */
export function parseSave(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (!isFiniteNumber(raw.cash) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null;
  if (!Number.isInteger(raw.missionIndex) || raw.missionIndex < 0) return null;
  if (!Number.isInteger(raw.missionStep) || raw.missionStep < 0) return null;
  return {
    cash: raw.cash,
    missionIndex: raw.missionIndex,
    missionStep: raw.missionStep,
    x: raw.x,
    y: raw.y,
    inCar: Boolean(raw.inCar),
  };
}
