import { Midi } from '@tonejs/midi';
import fs from 'fs';
import path from 'path';
import { MidiIngestionService } from '../src/services/ingestion/MidiIngestionService';

// Build a small synthetic MIDI file in memory to prove the parser/converter
// actually works: 4/4, 120bpm for bars 1-2, then a tempo change to 90bpm
// at bar 3, plus a time signature change to 3/4 at bar 3 - deliberately
// exercising the "do not assume fixed ms-per-tick" requirement.
const midi = new Midi();
midi.header.setTempo(120);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });

const track = midi.addTrack();
track.name = 'Right Hand';

// Bar 1 (4/4 @ 120bpm): quarter notes E5, F5, G5, and a half-beat-short A5
const ppq = midi.header.ppq;
const beatSec = 60 / 120;
track.addNote({ midi: 76, time: 0 * beatSec, duration: 1.0 * beatSec, velocity: 0.6 }); // E5, 1 beat
track.addNote({ midi: 77, time: 1 * beatSec, duration: 1.0 * beatSec, velocity: 0.65 }); // F5
track.addNote({ midi: 79, time: 2 * beatSec, duration: 1.0 * beatSec, velocity: 0.7 }); // G5
track.addNote({ midi: 81, time: 3 * beatSec, duration: 0.5 * beatSec, velocity: 0.5 }); // A5, short (0.5 beat)

// Bar 2: a chord (C5+E5+G5 together) then a note
track.addNote({ midi: 72, time: 4 * beatSec, duration: 2.0 * beatSec, velocity: 0.8 });
track.addNote({ midi: 76, time: 4 * beatSec, duration: 2.0 * beatSec, velocity: 0.8 });
track.addNote({ midi: 79, time: 4 * beatSec, duration: 2.0 * beatSec, velocity: 0.8 });
track.addNote({ midi: 74, time: 6 * beatSec, duration: 2.0 * beatSec, velocity: 0.55 });

// Tempo change to 90bpm and time-signature change to 3/4 starting bar 3 (tick 8 beats in)
const bar3StartTick = 8 * ppq;
midi.header.tempos.push({ ticks: bar3StartTick, bpm: 90 });
midi.header.timeSignatures.push({ ticks: bar3StartTick, timeSignature: [3, 4] });
// @tonejs/midi requires update() after manually mutating tempos/timeSignatures
// so its internal binary-search caches (event.time, event.measures) are
// recomputed. Skipping this hangs Track.addNote()'s seconds->ticks lookup.
midi.header.update();

const beatSec90 = 60 / 90;
const bar3StartSec = 8 * beatSec; // end of bar 2 in original tempo
track.addNote({ midi: 71, time: bar3StartSec + 0 * beatSec90, duration: 1.0 * beatSec90, velocity: 0.6 });
track.addNote({ midi: 72, time: bar3StartSec + 1 * beatSec90, duration: 1.0 * beatSec90, velocity: 0.6 });
track.addNote({ midi: 74, time: bar3StartSec + 2 * beatSec90, duration: 1.0 * beatSec90, velocity: 0.6 });

const buffer = Buffer.from(midi.toArray());
const outPath = path.join(__dirname, 'synthetic-test-song.mid');
fs.writeFileSync(outPath, buffer);

const service = new MidiIngestionService();
const { normalized, originalTempoBpm } = service.parse(buffer, 'synthetic-test-song.mid');

console.log('=== INGESTION TEST RESULT ===');
console.log('originalTempoBpm:', originalTempoBpm);
console.log('ticksPerQuarter:', normalized.ticksPerQuarter);
console.log('totalDurationSeconds:', normalized.totalDurationSeconds.toFixed(3));
console.log('trackCount:', normalized.trackCount, normalized.trackNames);
console.log('tempoMap:', normalized.tempoMap);
console.log('timeSignatureMap:', normalized.timeSignatureMap);
console.log('bars:', normalized.bars.map(b => ({ index: b.index, sig: b.timeSignature, startTime: +b.startTime.toFixed(3), endTime: +b.endTime.toFixed(3), notes: b.noteIds.length })));
console.log('notes:');
normalized.notes.forEach(n => {
  console.log(`  ${n.name.padEnd(4)} bar=${n.bar} beat=${n.beat.toFixed(2)} dur(beats)=${n.durationBeats.toFixed(2)} vel=${n.velocity} chord=${n.chordId ?? '-'} hand=${n.hand}`);
});
console.log('sourceFileHash:', normalized.sourceFileHash.slice(0, 16) + '...');
