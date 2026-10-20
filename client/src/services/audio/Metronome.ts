import * as Tone from 'tone';

/**
 * A minimal, precise metronome built on Tone.Transport so beat timing
 * stays accurate even if the main JS thread is briefly busy (Web Audio's
 * own clock drives scheduling, not setInterval).
 */
export class Metronome {
  private synth: Tone.MembraneSynth | null = null;
  private loopId: number | null = null;
  private beatHandler: ((beatInBar: number) => void) | null = null;
  private beatCounter = 0;
  private beatsPerBar = 4;

  private ensureSynth() {
    if (!this.synth) {
      this.synth = new Tone.MembraneSynth({ envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).toDestination();
    }
  }

  async start(bpm: number, beatsPerBar = 4, onBeat?: (beatInBar: number) => void): Promise<void> {
    await Tone.start(); // resumes the AudioContext, must happen from a user gesture
    this.ensureSynth();
    this.beatsPerBar = beatsPerBar;
    this.beatCounter = 0;
    this.beatHandler = onBeat ?? null;

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.cancel();
    this.loopId = Tone.Transport.scheduleRepeat((time) => {
      const beatInBar = (this.beatCounter % this.beatsPerBar) + 1;
      const pitch = beatInBar === 1 ? 'C3' : 'G2'; // accent the downbeat, like a real metronome
      this.synth?.triggerAttackRelease(pitch, '32n', time);
      Tone.Draw.schedule(() => this.beatHandler?.(beatInBar), time);
      this.beatCounter += 1;
    }, '4n');

    Tone.Transport.start();
  }

  stop(): void {
    Tone.Transport.stop();
    if (this.loopId !== null) {
      Tone.Transport.clear(this.loopId);
      this.loopId = null;
    }
  }
}

export const metronome = new Metronome();
