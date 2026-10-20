import * as Tone from 'tone';
import { NormalizedNote } from '@maestro/shared';

/**
 * Output-only sound for Learn Mode. It deliberately never subscribes to, or
 * sits in front of, Web MIDI input: callers invoke it only after a UI action
 * or a completed note match.
 */
class LearningAudio {
  private synth: Tone.PolySynth | null = null;

  private ensureSynth(): Tone.PolySynth {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.35, release: 0.3 },
      }).toDestination();
      this.synth.volume.value = -8;
    }
    return this.synth;
  }

  async unlock(): Promise<void> {
    await Tone.start(); // must follow a button click under browser autoplay rules
    this.ensureSynth();
  }

  play(notes: Pick<NormalizedNote, 'midi' | 'durationSeconds'>[], speed = 1, short = false): void {
    if (notes.length === 0) return;
    // Do not let an output-device issue interrupt the synchronous note match.
    try {
      const synth = this.ensureSynth();
      const pitches = notes.map((note) => Tone.Frequency(note.midi, 'midi').toNote());
      const longest = Math.max(...notes.map((note) => note.durationSeconds), 0.18);
      synth.triggerAttackRelease(pitches, short ? 0.22 : Math.min(3, Math.max(0.12, longest / speed)));
    } catch {
      // The visual/matching lesson remains fully usable if Web Audio fails.
    }
  }
}

export const learningAudio = new LearningAudio();
