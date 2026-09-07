/**
 * Procedural audio for DRIFT 30.
 *
 * Everything is synthesised with WebAudio at runtime — no asset files, no
 * network requests, no licensing. The engine stays silent until the first
 * user gesture, which is what browsers require before an AudioContext may
 * start.
 */

type Voice = "click" | "splash" | "catch" | "haul" | "spark" | "pour" | "flare" | "rest" | "deny";

const ACTION_VOICE: Record<string, Voice> = {
  fish: "catch",
  salvage: "haul",
  purify: "pour",
  repair: "spark",
  dive: "splash",
  rest: "rest",
  rain: "pour",
  signal: "flare",
  bail: "splash",
  build: "spark",
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private started = false;

  /** Called on the first real interaction; safe to call repeatedly. */
  start(): void {
    if (this.started) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    master.connect(ctx.destination);
    this.master = master;

    this.noiseBuffer = this.buildNoise(ctx, 2);
    this.startAmbience();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    void this.ctx.resume();
    this.ramp(this.master.gain, muted ? 0 : 0.9, 0.25);
  }

  /** Two seconds of white noise, reused for every splash and wave. */
  private buildNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private ramp(param: AudioParam, value: number, seconds: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  /** Looping surf: filtered noise whose cutoff and level breathe like swell. */
  private startAmbience(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.055;
    this.ambientGain = gain;

    // slow LFO on the cutoff so the surf rises and falls instead of hissing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();

    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  /** Storms push the surf louder and brighter. */
  setStorm(storm: boolean): void {
    if (!this.ambientGain) return;
    this.ramp(this.ambientGain.gain, storm ? 0.16 : 0.055, 1.2);
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    peak: number,
    type: OscillatorType = "sine",
    endFreq?: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const osc = ctx.createOscillator();
    osc.type = type;
    const t = ctx.currentTime + start;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private noise(start: number, duration: number, peak: number, cutoff: number, sweepTo?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;

    const t = ctx.currentTime + start;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(cutoff, t);
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t + duration);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter).connect(gain).connect(master);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  play(voice: Voice): void {
    if (!this.ctx || this.muted) return;
    void this.ctx.resume();

    switch (voice) {
      case "click":
        this.tone(430, 0, 0.07, 0.16, "square", 620);
        break;
      case "deny":
        this.tone(180, 0, 0.1, 0.2, "sawtooth", 110);
        this.tone(150, 0.09, 0.12, 0.16, "sawtooth", 90);
        break;
      case "splash":
        this.noise(0, 0.45, 0.34, 900, 260);
        this.noise(0.16, 0.5, 0.16, 500, 180);
        break;
      case "catch":
        this.noise(0, 0.22, 0.2, 1400, 600);
        this.tone(620, 0.12, 0.16, 0.18, "triangle", 940);
        this.tone(940, 0.24, 0.2, 0.16, "triangle", 1250);
        break;
      case "haul":
        this.noise(0, 0.5, 0.18, 380, 190);
        this.tone(150, 0.05, 0.4, 0.16, "sawtooth", 95);
        break;
      case "spark":
        for (let i = 0; i < 5; i++) this.noise(i * 0.11, 0.09, 0.26, 2600 + i * 220, 900);
        break;
      case "pour":
        this.noise(0, 0.9, 0.15, 1900, 700);
        this.tone(760, 0.1, 0.5, 0.09, "sine", 1080);
        break;
      case "flare":
        this.noise(0, 0.7, 0.24, 700, 2600);
        this.tone(300, 0, 0.6, 0.2, "sawtooth", 1500);
        break;
      case "rest":
        this.tone(392, 0, 0.5, 0.12, "sine");
        this.tone(523, 0.12, 0.55, 0.1, "sine");
        break;
    }
  }

  playAction(actionId: string): void {
    this.play(ACTION_VOICE[actionId] ?? "click");
  }

  /** Rising arpeggio when a structure finishes building. */
  playUpgrade(): void {
    if (this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.09, 0.42, 0.17, "triangle"));
  }

  playWin(): void {
    if (this.muted) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.13, 1.4, 0.19, "triangle"));
    this.noise(0.5, 1.6, 0.09, 500, 1600);
  }

  playLose(): void {
    if (this.muted) return;
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.2, 1.1, 0.2, "sawtooth"));
    this.noise(0, 2.2, 0.2, 380, 120);
  }
}

export const audio = new AudioEngine();
