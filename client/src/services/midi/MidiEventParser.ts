import { MidiEvent, MidiEventType } from '@maestro/shared';
import { midiToNoteName } from '@maestro/shared';

/**
 * Decodes a raw 2-3 byte MIDI message into a normalized MidiEvent.
 * Handles the "note-on with velocity 0 means note-off" convention that
 * a lot of real keyboards use — we do not want two different code paths
 * downstream just because of that MIDI quirk.
 */
export function parseMidiMessage(data: Uint8Array, timestamp: number): MidiEvent | null {
  if (data.length === 0) return null;
  const statusByte = data[0];
  const command = statusByte & 0xf0;
  const channel = statusByte & 0x0f;

  switch (command) {
    case 0x90: {
      // Note On
      const note = data[1];
      const velocity = data[2] ?? 0;
      const type: MidiEventType = velocity === 0 ? 'noteOff' : 'noteOn';
      return {
        type,
        note,
        noteName: midiToNoteName(note),
        velocity,
        channel,
        timestamp,
        raw: Array.from(data),
      };
    }
    case 0x80: {
      // Note Off
      const note = data[1];
      const velocity = data[2] ?? 0;
      return {
        type: 'noteOff',
        note,
        noteName: midiToNoteName(note),
        velocity,
        channel,
        timestamp,
        raw: Array.from(data),
      };
    }
    case 0xb0: {
      // Control Change (sustain pedal = controller 64, etc. — Section 2 "pedal/control events")
      return {
        type: 'controlChange',
        controlNumber: data[1],
        controlValue: data[2],
        channel,
        timestamp,
        raw: Array.from(data),
      };
    }
    case 0xc0: {
      return { type: 'programChange', controlValue: data[1], channel, timestamp, raw: Array.from(data) };
    }
    case 0xe0: {
      return { type: 'pitchBend', controlValue: (data[2] << 7) | data[1], channel, timestamp, raw: Array.from(data) };
    }
    default:
      return null;
  }
}
