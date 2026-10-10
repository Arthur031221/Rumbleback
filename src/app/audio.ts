/**
 * A few synthesized sounds for the moments a wave reaches the pin: a short low thump for P, a longer
 * rumble for S that grows with the intensity at the pin, and a soft two note chime for the alert.
 * Nothing is loaded, and nothing plays until the viewer turns sound on, which is also the click that
 * lets the browser start audio.
 */
export type Cue = 'P' | 'S' | 'alert';

export function createAudio() {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;

  function context(): AudioContext {
    if (!ctx) {
      ctx = new AudioContext();
      // Brown noise, two seconds: a running sum of white noise, which is mostly low rumble.
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return ctx;
  }

  const envelope = (gain: GainNode, at: number, peak: number, attack: number, decay: number) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };

  function tone(c: AudioContext, freq: number, endFreq: number, at: number, peak: number, attack: number, decay: number): void {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(endFreq, at + attack + decay);
    envelope(gain, at, peak, attack, decay);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  return {
    /** Starts the audio context. Call from a click. */
    async enable(): Promise<void> {
      await context().resume();
    },
    /** `strength` is 0 to 1 and only matters for S. */
    play(cue: Cue, strength = 0.5): void {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime + 0.02;
      if (cue === 'P') {
        tone(ctx, 95, 55, now, 0.5, 0.01, 0.35);
      } else if (cue === 'S') {
        const level = 0.35 + 0.65 * strength;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150;
        const gain = ctx.createGain();
        envelope(gain, now, 0.9 * level, 0.12, 1.5 + 1.5 * strength);
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        src.stop(now + 3.4);
        tone(ctx, 52, 38, now, 0.55 * level, 0.08, 1.6 + strength);
      } else {
        tone(ctx, 660, 660, now, 0.18, 0.01, 0.22);
        tone(ctx, 880, 880, now + 0.16, 0.18, 0.01, 0.3);
      }
    },
  };
}
