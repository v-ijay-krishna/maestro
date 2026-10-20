const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note number (0-127) -> scientific pitch notation, e.g. 64 -> "E4". Middle C = 60 = C4. */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

/** "E4" -> 64. Returns null if the string doesn't parse. */
export function noteNameToMidi(name: string): number | null {
  const match = /^([A-Ga-g])(#|b)?(-?\d+)$/.exec(name.trim());
  if (!match) return null;
  const [, letter, accidental, octaveStr] = match;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = base[letter.toUpperCase()];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  const octave = parseInt(octaveStr, 10);
  return (octave + 1) * 12 + semitone;
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}
