import type { Cell } from '../shared/types.ts';

const SCALE = [0, 2, 4, 7, 9] as const;
const frequency = (semitone: number): number => 146.8324 * 2 ** (semitone / 12);

export class IslandAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: ConvolverNode | null = null;
  private ambient: AudioBufferSourceNode | null = null;
  private musicTimer: number | null = null;
  private beat = 0;
  private requested = false;
  private enableRevision = 0;
  private melodyTimers: number[] = [];
  private readonly onError: (message: string) => void;

  constructor(onError: (message: string) => void) {
    this.onError = onError;
    document.addEventListener('visibilitychange', this.visibility);
  }

  get enabled(): boolean {
    return this.requested;
  }

  async enable(): Promise<void> {
    const revision = ++this.enableRevision;
    if (!window.AudioContext) throw new Error('This browser does not support the island soundscape.');
    if (!this.context) this.create();
    const context = this.context;
    if (!context) throw new Error('The island soundscape could not start.');
    await context.resume();
    if (revision !== this.enableRevision) return;
    this.requested = true;
    this.master?.gain.setTargetAtTime(0.52, context.currentTime, 0.18);
    this.startMusic();
    this.note(12, 0.06, 0.7);
    this.note(19, 0.04, 0.8, 0.12);
  }

  disable(): void {
    this.enableRevision++;
    this.requested = false;
    this.stopMusic();
    this.melodyTimers.forEach((timer) => window.clearTimeout(timer));
    this.melodyTimers = [];
    if (this.context) this.master?.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
  }

  select(second = false): void {
    this.note(second ? 16 : 12, 0.065, 0.34);
    this.note(second ? 23 : 19, 0.025, 0.3, 0.045);
  }

  swap(water: boolean): void {
    if (!this.context || !this.master || !this.requested) return;
    const context = this.context;
    const noise = context.createBufferSource();
    noise.buffer = this.noiseBuffer(0.35);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(water ? 1300 : 650, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(130, context.currentTime + 0.32);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(water ? 0.10 : 0.075, context.currentTime + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
    noise.connect(filter).connect(envelope).connect(this.master);
    noise.start();
    noise.stop(context.currentTime + 0.35);
    this.note(0, 0.07, 0.45, 0.12);
    this.note(7, 0.045, 0.55, 0.28);
  }

  undo(): void {
    this.note(14, 0.035, 0.3);
    this.note(9, 0.025, 0.4, 0.08);
  }

  destination(count: number): void {
    this.note(12, 0.04, 0.65);
    this.note(16, 0.03, 0.75, 0.10);
    if (count > 1) this.note(19, 0.03, 0.95, 0.20);
  }

  finish(route: readonly Cell[]): void {
    if (!this.requested) return;
    this.melodyTimers.forEach((timer) => window.clearTimeout(timer));
    this.melodyTimers = route.slice(0, 14).map((cell, index) =>
      window.setTimeout(() => {
        const degree = SCALE[(cell.row * 2 + cell.col) % SCALE.length] ?? 0;
        this.note(degree + 12, 0.055, 0.8);
      }, index * 130));
    this.melodyTimers.push(window.setTimeout(() => {
      this.note(0, 0.055, 1.8);
      this.note(16, 0.035, 1.6);
      this.note(19, 0.025, 1.8);
    }, Math.min(route.length, 14) * 130 + 100));
  }

  private create(): void {
    const context = new AudioContext();
    this.context = context;
    const master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    master.connect(compressor).connect(context.destination);
    this.master = master;
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 1.1), context.sampleRate);
    let seed = 1931;
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = ((seed / 0xffffffff) * 2 - 1) * (1 - i / samples.length) ** 3;
      }
    }
    const echo = context.createConvolver();
    echo.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = 0.16;
    echo.connect(wet).connect(master);
    this.echo = echo;
    const air = context.createBufferSource();
    air.buffer = this.noiseBuffer(4);
    air.loop = true;
    const airFilter = context.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 380;
    const airGain = context.createGain();
    airGain.gain.value = 0.018;
    air.connect(airFilter).connect(airGain).connect(master);
    air.start();
    this.ambient = air;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const context = this.context;
    if (!context) throw new Error('Audio has not been initialized.');
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 73171;
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      last = (last + ((seed / 0xffffffff) * 2 - 1) * 0.05) / 1.045;
      data[i] = last * 4;
    }
    return buffer;
  }

  private note(semitone: number, volume: number, duration: number, delay = 0): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.requested || document.hidden) return;
    const at = context.currentTime + delay;
    const voice = context.createOscillator();
    const overtone = context.createOscillator();
    voice.type = 'sine';
    overtone.type = 'triangle';
    voice.frequency.value = frequency(semitone);
    overtone.frequency.value = frequency(semitone) * 2.003;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    const overtoneGain = context.createGain();
    overtoneGain.gain.value = 0.10;
    voice.connect(envelope);
    overtone.connect(overtoneGain).connect(envelope);
    envelope.connect(master);
    if (this.echo) envelope.connect(this.echo);
    voice.start(at);
    overtone.start(at);
    voice.stop(at + duration + 0.02);
    overtone.stop(at + duration + 0.02);
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return;
    const phrase = [0, 7, 4, 9, 2, 7, 4, 2, 0, 9, 7, 4, 2, 4, 7, 2];
    this.musicTimer = window.setInterval(() => {
      if (!this.requested || document.hidden) return;
      const tone = phrase[this.beat % phrase.length] ?? 0;
      this.note(tone + (this.beat % 4 === 0 ? 0 : 12), 0.018, 2.3);
      if (this.beat % 8 === 0) this.note(-12, 0.016, 4.5);
      this.beat++;
    }, 1400);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private visibility = (): void => {
    if (!this.context) return;
    if (document.hidden) {
      this.stopMusic();
      void this.context.suspend().catch((error: unknown) => this.fail(error));
    } else if (this.requested) {
      void this.context.resume().then(() => this.startMusic()).catch((error: unknown) => this.fail(error));
    }
  };

  private fail(error: unknown): void {
    console.error('Island soundscape failed:', error);
    this.disable();
    this.onError('The soundscape paused. Tap sound to try again.');
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.visibility);
    this.disable();
    this.ambient?.stop();
    if (this.context) void this.context.close().catch((error: unknown) => console.error('Could not close audio:', error));
  }
}
