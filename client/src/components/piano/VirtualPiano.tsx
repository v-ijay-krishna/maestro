import React, { useMemo } from 'react';
import { isBlackKey, midiToNoteName } from '@maestro/shared';

export interface PianoHighlight {
  note: number;
  kind: 'expected' | 'correct' | 'wrong';
}

interface VirtualPianoProps {
  lowestNote?: number; // default A0 = 21
  highestNote?: number; // default C8 = 108
  activeNotes: number[]; // currently held keys, from live MIDI (source of truth)
  highlights?: PianoHighlight[]; // reference/feedback overlay for Learn mode
  onKeyPress?: (note: number) => void; // optional mouse/touch fallback, not the primary input method
}

const HIGHLIGHT_COLOR: Record<PianoHighlight['kind'], string> = {
  // Inset outlines stay attached to each individual key. A CSS ring on
  // adjacent piano keys can visually merge into one large rectangle.
  expected: 'bg-accent-soft/80 shadow-[inset_0_0_0_3px_#ffffff,0_0_14px_#a78bfa]',
  correct: 'bg-key-correct/70 shadow-[inset_0_0_0_3px_#ffffff]',
  wrong: 'bg-key-wrong/70 shadow-[inset_0_0_0_3px_#ffffff]',
};

export function VirtualPiano({ lowestNote = 21, highestNote = 108, activeNotes, highlights = [], onKeyPress }: VirtualPianoProps) {
  const whiteKeys = useMemo(() => {
    const keys: number[] = [];
    for (let n = lowestNote; n <= highestNote; n++) if (!isBlackKey(n)) keys.push(n);
    return keys;
  }, [lowestNote, highestNote]);

  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const highlightMap = useMemo(() => new Map(highlights.map((h) => [h.note, h.kind])), [highlights]);

  const whiteKeyWidth = 100 / whiteKeys.length;

  return (
    <div className="relative w-full h-32 select-none">
      <div className="flex w-full h-full">
        {whiteKeys.map((note) => {
          const isActive = activeSet.has(note);
          const highlight = highlightMap.get(note);
          return (
            <button
              key={note}
              onMouseDown={() => onKeyPress?.(note)}
              title={midiToNoteName(note)}
              className={`relative flex-1 border border-surface-700 rounded-b-md transition-colors duration-75 ${highlight ? HIGHLIGHT_COLOR[highlight] : 'bg-white'} ${isActive ? 'bg-accent' : ''}`}
              style={{ marginLeft: note === lowestNote ? 0 : -1 }}
            >
              {highlight === 'expected' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-surface-950">{midiToNoteName(note)}</span>}
            </button>
          );
        })}
      </div>

      <div className="absolute top-0 left-0 w-full h-[62%] flex pointer-events-none">
        {whiteKeys.map((note, i) => {
          const blackNote = note + 1;
          if (blackNote > highestNote || !isBlackKey(blackNote)) return null;
          const isActive = activeSet.has(blackNote);
          const highlight = highlightMap.get(blackNote);
          const leftPercent = (i + 1) * whiteKeyWidth - whiteKeyWidth * 0.3;
          return (
            <button
              key={blackNote}
              onMouseDown={() => onKeyPress?.(blackNote)}
              title={midiToNoteName(blackNote)}
              className={`absolute h-full rounded-b-md pointer-events-auto transition-colors duration-75 ${highlight ? HIGHLIGHT_COLOR[highlight] : 'bg-surface-950'} ${isActive ? 'bg-accent' : ''}`}
              style={{ left: `${leftPercent}%`, width: `${whiteKeyWidth * 0.6}%` }}
            >
              {highlight === 'expected' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">{midiToNoteName(blackNote)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
