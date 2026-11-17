// Keyboard and mouse state for the game: held keys as a set, one-shot action
// presses queued for the frame that consumes them, and the mouse position
// and button for aiming. WASD or arrows move, Shift sprints, E interacts,
// F or a mouse click fires, P or Esc pauses.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;

const KEY_ACTIONS = {
  KeyE: ACTION_INTERACT,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
};

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let queuedActions = 0;

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') ev.preventDefault();
    held.add(ev.code);
    const action = KEY_ACTIONS[ev.code];
    if (action && !ev.repeat) queuedActions |= action;
  });
  window.addEventListener('keyup', (ev) => {
    held.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) mouse.down = true;
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) mouse.down = false;
  });

  return {
    mouse,
    /** The movement axis the player is asking for: {x, y} each in -1..1. */
    axis() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y };
    },
    /** Driving input for the car the player sits in. */
    drive() {
      let throttle = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) throttle += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) throttle -= 1;
      let steer = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) steer -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) steer += 1;
      return { throttle, steer };
    },
    sprinting() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    firing() {
      return mouse.down || held.has('KeyF');
    },
    /** Take the one-shot actions pressed since the last call. */
    takeActions() {
      const out = queuedActions;
      queuedActions = 0;
      return out;
    },
    /** Queue an action from the mouse (start-screen buttons). */
    press(action) {
      queuedActions |= action;
    },
  };
}
