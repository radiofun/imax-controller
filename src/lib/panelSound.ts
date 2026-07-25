/** Tiny Web Audio synth for industrial panel beeps — no asset files. */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Browsers block audio until a user gesture — call from any click/key. */
export function unlockAudio() {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  unlocked = true;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  gain = 0.06,
  freqEnd?: number,
) {
  const ac = getCtx();
  if (!ac || !unlocked) return;
  if (ac.state === "suspended") void ac.resume();

  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, freqEnd),
      t0 + duration,
    );
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst(duration: number, gain = 0.04) {
  const ac = getCtx();
  if (!ac || !unlocked) return;
  if (ac.state === "suspended") void ac.resume();

  const n = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  const t0 = ac.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g);
  g.connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  /** Soft UI tick */
  click() {
    tone(880, 0.045, "square", 0.045);
  },
  /** Menu / focus move */
  nav() {
    tone(1200, 0.028, "square", 0.03);
  },
  /** Confirm / select */
  ok() {
    tone(660, 0.05, "square", 0.05);
    tone(990, 0.07, "square", 0.035);
  },
  /** Toggle on */
  on() {
    tone(520, 0.06, "square", 0.05, 780);
  },
  /** Toggle off */
  off() {
    tone(780, 0.06, "square", 0.045, 420);
  },
  /** Transport RUN */
  run() {
    tone(220, 0.08, "sawtooth", 0.04);
    tone(440, 0.12, "square", 0.05);
  },
  /** Transport JOG */
  jog() {
    tone(340, 0.05, "square", 0.05);
    window.setTimeout(() => tone(340, 0.05, "square", 0.04), 70);
  },
  /** Transport STOP */
  stop() {
    tone(180, 0.14, "square", 0.07, 90);
    noiseBurst(0.05, 0.03);
  },
  /** Open overlay */
  open() {
    tone(400, 0.06, "triangle", 0.05, 700);
  },
  /** Close overlay */
  close() {
    tone(700, 0.06, "triangle", 0.045, 320);
  },
  /** Auto-load / longer action */
  load() {
    tone(300, 0.05, "square", 0.04);
    window.setTimeout(() => tone(450, 0.05, "square", 0.04), 80);
    window.setTimeout(() => tone(600, 0.08, "square", 0.05), 160);
  },
  /** Alarm ack */
  warn() {
    tone(240, 0.1, "square", 0.06);
    window.setTimeout(() => tone(240, 0.1, "square", 0.05), 120);
  },
};
