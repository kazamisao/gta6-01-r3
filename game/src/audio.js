// All of Solara Bay's sound is synthesized with WebAudio: no audio files.
// Gameplay code raises sound events by NAME (a plain string like 'crash'),
// and the player below switches on that same name field, so an event and the
// sound it triggers can never drift apart. One-off sounds are short oscillator
// and noise shapes; the engine hum and the police siren are loops whose pitch
// follows the game. Pitch variation comes from a seeded stream, never from
// Math.random, so a take is reproducible.

/** Every sound name the dispatcher can play. */
export const SOUND_EVENTS = [
  'engine',
  'crash',
  'siren',
  'gunshot',
  'pickup',
  'jingle',
  'door',
  'click',
  'busted',
  'hit',
];

/** The sound name a gameplay event asks for (identity for the core names). */
export function soundForEvent(event) {
  return SOUND_EVENTS.includes(event) ? event : null;
}

/**
 * Create the sound player around a seeded rng. Safe to construct anywhere:
 * the AudioContext itself is only created on the first resume() call, which
 * the game makes from a user gesture.
 */
export function createAudio(rng) {
  let ctx = null;
  let master = null;
  let engineNodes = null;
  let sirenNodes = null;

  function ensureContext() {
    if (ctx) return true;
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = rng() * 2 - 1;
    return buffer;
  }

  function tone(freqFrom, freqTo, seconds, type, gainValue, when = 0) {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function noise(seconds, filterFreq, gainValue, type = 'lowpass') {
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + seconds + 0.02);
  }

  /** Play a one-off sound by name. Unknown names are ignored. */
  function play(name) {
    if (!SOUND_EVENTS.includes(name)) return;
    if (name === 'engine' || name === 'siren') return; // loops, see below
    if (!ensureContext() || ctx.state !== 'running') return;
    switch (name) {
      case 'gunshot': {
        const jitter = 0.9 + rng() * 0.25;
        noise(0.13 * jitter, 2600, 0.5, 'bandpass');
        tone(160 * jitter, 45, 0.11, 'triangle', 0.4);
        break;
      }
      case 'crash': {
        noise(0.32, 700, 0.55);
        tone(110 + rng() * 40, 34, 0.3, 'sine', 0.6);
        break;
      }
      case 'hit': {
        noise(0.07, 1500, 0.3, 'bandpass');
        break;
      }
      case 'pickup': {
        tone(660, 660, 0.07, 'sine', 0.25);
        tone(990, 990, 0.1, 'sine', 0.25, 0.07);
        break;
      }
      case 'jingle': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.28, i * 0.11));
        break;
      }
      case 'door': {
        noise(0.05, 900, 0.2);
        tone(190, 120, 0.08, 'square', 0.12, 0.03);
        break;
      }
      case 'click': {
        tone(840, 700, 0.05, 'square', 0.15);
        break;
      }
      case 'busted': {
        tone(392, 392, 0.18, 'triangle', 0.3);
        tone(311, 311, 0.18, 'triangle', 0.3, 0.18);
        tone(233, 196, 0.34, 'triangle', 0.3, 0.36);
        break;
      }
      default:
        break;
    }
  }

  /** Start or stop the engine loop; speedRatio 0..1 bends its pitch. */
  function setEngine(on, speedRatio = 0) {
    if (!ensureContext()) return;
    if (on && !engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      engineNodes = { osc, gain, filter };
    }
    if (engineNodes) {
      const target = on ? 0.05 + speedRatio * 0.05 : 0;
      engineNodes.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineNodes.osc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.08);
      if (!on && target === 0) {
        const nodes = engineNodes;
        engineNodes = null;
        window.setTimeout(() => {
          try {
            nodes.osc.stop();
          } catch {
            /* already stopped */
          }
        }, 350);
      }
    }
  }

  /** Start or stop the police siren loop. */
  function setSiren(on) {
    if (!ensureContext()) return;
    if (on && !sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.65;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 150;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    }
    if (!on && sirenNodes) {
      const nodes = sirenNodes;
      sirenNodes = null;
      try {
        nodes.osc.stop();
        nodes.lfo.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  /** Create/resume the context from a user gesture. */
  function resume() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  return { play, setEngine, setSiren, resume };
}
