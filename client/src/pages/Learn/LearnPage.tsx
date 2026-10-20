import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MidiEvent, NormalizedMidiData, NormalizedNote } from '@maestro/shared';
import { VirtualPiano, PianoHighlight } from '../../components/piano/VirtualPiano';
import { useMidiContext } from '../../context/MidiContext';
import { LearningEngine, LearningFeedback } from '../../services/learning/LearningEngine';
import { midiEventStream } from '../../services/midi/MidiEngine';
import { learningAudio } from '../../services/audio/LearningAudio';
import { api } from '../../services/api/client';

type Phase = 'setup' | 'preview' | 'guided' | 'barComplete' | 'freeAttempt' | 'feedback' | 'finished';
type Section = 'song' | 'bar' | 'range';
type NoteGroup = { key: string; time: number; notes: NormalizedNote[] };
const button = 'px-3 py-2 rounded-lg text-sm bg-surface-800 hover:bg-surface-700 transition-colors';

function groupsFromNotes(notes: NormalizedNote[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  for (const note of [...notes].sort((a, b) => a.startTime - b.startTime || a.midi - b.midi)) {
    const previous = groups[groups.length - 1];
    if (previous && Math.abs(previous.time - note.startTime) < .04) previous.notes.push(note);
    else groups.push({ key: `${note.startTick}-${note.chordId ?? note.id}`, time: note.startTime, notes: [note] });
  }
  return groups;
}

function durationHint(notes: NormalizedNote[]) {
  const beats = Math.max(...notes.map((note) => note.durationBeats));
  if (beats <= .6) return 'Play it briefly.';
  if (beats <= 4) return `Hold for about ${Math.round(beats * 2) / 2} beat${beats >= 1.5 ? 's' : ''}.`;
  // Long MIDI sustains can be pedal/arrangement data, not an instruction to count 20 beats.
  return 'Hold until the next cue.';
}

function NoteRoll({ groups, elapsed, running }: { groups: NoteGroup[]; elapsed: number; running: boolean }) {
  const first = groups[0]?.time ?? 0;
  const visible = groups.filter((group) => group.time - first - elapsed > -.2 && group.time - first - elapsed < 3.8);
  return <div className="relative h-72 overflow-hidden rounded-t-2xl border border-surface-700 bg-gradient-to-b from-indigo-950/70 to-surface-950">
    <p className="absolute top-3 left-3 text-xs text-slate-400 z-10">{running ? 'Watch the next notes arrive at the line' : 'Preview paused'}</p>
    <div className="absolute inset-x-0 bottom-9 border-t-2 border-accent z-10"><span className="absolute right-3 -top-5 text-[10px] uppercase tracking-wider text-accent-soft">play here</span></div>
    {visible.map((group) => {
      const secondsAway = group.time - first - elapsed;
      const pitchCenter = group.notes.reduce((sum, note) => sum + note.midi, 0) / group.notes.length;
      const duration = Math.max(...group.notes.map((note) => note.durationSeconds));
      return <div key={group.key} className="absolute min-w-14 max-w-40 -translate-x-1/2 rounded-md bg-accent px-2 pt-1 text-center text-[11px] font-bold text-white shadow-[0_0_16px_rgba(124,92,255,.75)]" style={{ left: `${Math.max(7, Math.min(93, ((pitchCenter - 48) / 36) * 100))}%`, bottom: 36 + secondsAway * 60, height: Math.max(25, Math.min(80, duration * 58)) }}>
        {group.notes.map((note) => note.name).join(' + ')}
      </div>;
    })}
  </div>;
}

export function LearnPage() {
  const { songId } = useParams();
  const { connectedDevice, activeNotes } = useMidiContext();
  const [songTitle, setSongTitle] = useState('');
  const [midiData, setMidiData] = useState<NormalizedMidiData | null>(null);
  const [section, setSection] = useState<Section>('bar');
  const [startBar, setStartBar] = useState(1);
  const [endBar, setEndBar] = useState(1);
  const [phase, setPhase] = useState<Phase>('setup');
  const [engine, setEngine] = useState<LearningEngine | null>(null);
  const [position, setPosition] = useState({ bar: 1, noteGroupIndex: 0, totalGroupsInBar: 0 });
  const [feedback, setFeedback] = useState<LearningFeedback | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewSeconds, setPreviewSeconds] = useState(0);
  const [previewSpeed, setPreviewSpeed] = useState(80);
  const [completedBar, setCompletedBar] = useState<number | null>(null);
  const freeEvents = useRef<MidiEvent[]>([]);
  const inactivityTimer = useRef<number | null>(null);
  const previewSounded = useRef(new Set<string>());

  useEffect(() => {
    if (!songId) return;
    api.songs.getById(songId).then((song) => setSongTitle(song.title));
    api.songs.getMidi(songId).then(({ midiData: data }) => { setMidiData(data); setEndBar(data.bars.length || 1); });
    return () => { if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current); };
  }, [songId]);

  const range = useMemo(() => {
    const max = midiData?.bars.length || 1;
    if (section === 'song') return { start: 1, end: max };
    if (section === 'bar') return { start: startBar, end: startBar };
    return { start: Math.min(startBar, endBar), end: Math.max(startBar, endBar) };
  }, [midiData, section, startBar, endBar]);
  const selectedNotes = useMemo(() => midiData?.notes.filter((note) => note.bar >= range.start && note.bar <= range.end) ?? [], [midiData, range]);
  const previewGroups = useMemo(() => groupsFromNotes(selectedNotes), [selectedNotes]);
  const expected = useMemo(() => engine?.getExpectedGroup() ?? [], [engine, position, refresh]);
  const upcoming = useMemo(() => engine ? engine.getGroupsForBar(position.bar).slice(position.noteGroupIndex + 1, position.noteGroupIndex + 4) : [], [engine, position, refresh]);

  useEffect(() => {
    if (!previewRunning || phase !== 'preview') return;
    const timer = window.setInterval(() => setPreviewSeconds((seconds) => seconds + .05 * (previewSpeed / 100)), 50);
    return () => window.clearInterval(timer);
  }, [previewRunning, previewSpeed, phase]);
  useEffect(() => {
    if (!previewRunning || phase !== 'preview') return;
    const first = previewGroups[0]?.time ?? 0;
    for (const group of previewGroups) {
      const relative = group.time - first;
      if (relative <= previewSeconds && !previewSounded.current.has(group.key)) {
        previewSounded.current.add(group.key);
        learningAudio.play(group.notes, previewSpeed / 100);
      }
    }
  }, [previewSeconds, previewRunning, phase, previewGroups, previewSpeed]);

  const prepare = (next: 'preview' | 'guided') => {
    if (!midiData) return;
    // Audio is additive. A browser autoplay restriction must never prevent
    // the MIDI-guided lesson from starting or responding to a key press.
    void learningAudio.unlock().catch(() => undefined);
    const nextEngine = new LearningEngine(midiData, range.start, range.end);
    setEngine(nextEngine); setPosition(nextEngine.getPosition()); setFeedback(null); setCompletedBar(null); setRefresh((value) => value + 1);
    previewSounded.current.clear(); setPreviewSeconds(0); setPreviewRunning(next === 'preview'); setPhase(next);
  };
  const finishFreeAttempt = () => { if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current); setPhase('feedback'); };

  useEffect(() => {
    if (!engine || (phase !== 'guided' && phase !== 'freeAttempt')) return;
    return midiEventStream.subscribe((event) => {
      if (phase === 'freeAttempt') {
        if (event.type !== 'noteOn' && event.type !== 'noteOff') return;
        freeEvents.current.push(event);
        if (event.type === 'noteOn') {
          if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
          inactivityTimer.current = window.setTimeout(finishFreeAttempt, 3000);
        }
        return;
      }
      if (event.type !== 'noteOn' || event.note === undefined) return;
      const before = engine.getPosition();
      const matchedGroup = engine.getExpectedGroup();
      const result = engine.handleNoteOn(event);
      if (result) setFeedback(result);
      if (result?.type === 'correct') learningAudio.play(matchedGroup, 1, true);
      const after = engine.getPosition(); setPosition(after); setRefresh((value) => value + 1);
      if (after.bar !== before.bar || engine.isComplete()) { setCompletedBar(before.bar); setPhase('barComplete'); }
    });
  }, [engine, phase, position.bar]);

  const highlights: PianoHighlight[] = useMemo(() => {
    const result: PianoHighlight[] = expected.map((note) => ({ note: note.midi, kind: 'expected' }));
    if (feedback?.type === 'wrong_pitch' && feedback.actualNote !== undefined) result.push({ note: feedback.actualNote, kind: 'wrong' });
    return result;
  }, [expected, feedback]);
  const freeBullets = useMemo(() => {
    if (!engine || !completedBar) return [];
    const played = freeEvents.current.filter((event) => event.type === 'noteOn' && event.note !== undefined).map((event) => event.note!);
    const summary = engine.summarizeFreeAttempt(completedBar, played);
    const bullets = [summary.sequenceCorrect ? 'You played the correct notes in sequence.' : `You completed ${summary.correctMoments} musical moment${summary.correctMoments === 1 ? '' : 's'} in the expected order.`];
    if (summary.missedNotes.length) bullets.push(`Try again with ${[...new Set(summary.missedNotes)].slice(0, 4).join(', ')}.`);
    if (summary.unexpectedNotes.length) bullets.push('A few extra notes appeared—keep your eyes on the next cue.');
    if (!summary.missedNotes.length && !summary.unexpectedNotes.length) bullets.push('Nice natural run-through. Keep the transitions smooth.');
    const reference = engine.getGroupsForBar(completedBar).flat();
    const held = freeEvents.current.find((event) => {
      if (event.type !== 'noteOff' || event.note === undefined || event.duration === undefined) return false;
      const note = reference.find((candidate) => candidate.midi === event.note);
      return Boolean(note && Math.abs(event.duration - note.durationSeconds * 1000) > Math.max(500, note.durationSeconds * 700));
    });
    if (held?.note !== undefined && held.duration !== undefined) {
      const note = reference.find((candidate) => candidate.midi === held.note)!;
      bullets.push(held.duration > note.durationSeconds * 1000 ? `Try releasing ${note.name} a little sooner.` : `Try holding ${note.name} a little longer.`);
    }
    return bullets;
  }, [engine, completedBar, phase]);

  const startFreeAttempt = () => { freeEvents.current = []; setPhase('freeAttempt'); };
  const continueLearning = () => { if (!engine || engine.isComplete()) setPhase('finished'); else setPhase('guided'); };
  if (!midiData) return <p className="text-slate-400">Loading song...</p>;
  const maxBar = midiData.bars.length || 1;
  const hitNotes = previewGroups.filter((group) => Math.abs(group.time - (previewGroups[0]?.time ?? 0) - previewSeconds) < .2).flatMap((group) => group.notes);

  return <div className="max-w-6xl mx-auto">
    <Link to={`/songs/${songId}`} className="text-xs text-slate-400 hover:text-white">← {songTitle}</Link>
    <div className="flex flex-wrap items-end justify-between gap-4 mt-2 mb-6"><div><h1 className="text-2xl font-bold">Learn · {songTitle}</h1><p className="text-sm text-slate-400 mt-1">A guided, self-paced lesson—not a scored test.</p></div><span className={`text-xs ${connectedDevice ? 'text-key-correct' : 'text-amber-300'}`}>{connectedDevice ? `● ${connectedDevice.name} connected` : 'Connect a MIDI keyboard before practice.'}</span></div>
    {phase === 'setup' && <section className="max-w-2xl bg-surface-900 border border-surface-700 rounded-2xl p-6 space-y-5"><h2 className="font-semibold">Choose what to learn</h2><div className="flex flex-wrap gap-2">{([['song', 'Entire song'], ['bar', 'One bar'], ['range', 'Selected bars']] as const).map(([value, label]) => <button key={value} onClick={() => setSection(value)} className={`${button} ${section === value ? 'ring-2 ring-accent bg-surface-700' : ''}`}>{label}</button>)}</div>{section !== 'song' && <div className="grid grid-cols-2 gap-4 max-w-sm"><label className="text-sm">Start bar<input className="input mt-1" type="number" min={1} max={maxBar} value={startBar} onChange={(e) => setStartBar(Number(e.target.value))} /></label>{section === 'range' && <label className="text-sm">End bar<input className="input mt-1" type="number" min={startBar} max={maxBar} value={endBar} onChange={(e) => setEndBar(Number(e.target.value))} /></label>}</div>}<div className="flex gap-3"><button onClick={() => void prepare('preview')} className="bg-accent px-4 py-2.5 rounded-xl font-semibold">Play preview</button><button onClick={() => void prepare('guided')} disabled={!connectedDevice} className="px-4 py-2.5 rounded-xl bg-surface-800 disabled:opacity-40">Skip preview &amp; practice</button></div></section>}
    {phase === 'preview' && <section className="space-y-4"><NoteRoll groups={previewGroups} elapsed={previewSeconds} running={previewRunning} /><VirtualPiano lowestNote={48} highestNote={84} activeNotes={[]} highlights={hitNotes.map((note) => ({ note: note.midi, kind: 'expected' }))} /><div className="bg-surface-900 border border-surface-700 rounded-xl p-4 flex flex-wrap gap-4 items-center"><label className="text-sm flex-1 min-w-64">Preview speed: <b>{previewSpeed}%</b><input className="w-full accent-accent mt-2" type="range" min={40} max={150} step={5} value={previewSpeed} onChange={(e) => setPreviewSpeed(Number(e.target.value))} /></label><button className={button} onClick={() => { void learningAudio.unlock(); setPreviewRunning((value) => !value); }}>{previewRunning ? 'Pause' : 'Play'}</button><button className={button} onClick={() => { previewSounded.current.clear(); setPreviewSeconds(0); setPreviewRunning(true); }}>Restart</button><button className="bg-accent px-4 py-2 rounded-lg font-semibold" disabled={!connectedDevice} onClick={() => { setPreviewRunning(false); setPhase('guided'); }}>Start guided practice</button></div></section>}
    {phase === 'guided' && <section className="space-y-5"><div className="bg-surface-900 border border-surface-700 rounded-2xl p-7 text-center"><p className="text-xs uppercase tracking-widest text-slate-400">Bar {position.bar} · step {position.noteGroupIndex + 1} of {position.totalGroupsInBar}</p><div className="text-accent text-4xl leading-none mt-4">↓</div><div className="inline-block mt-2 rounded-xl border-2 border-accent bg-accent/15 px-7 py-3"><p className="text-xs uppercase tracking-wider text-accent-soft">Play this now</p><p className="text-4xl font-extrabold mt-1">{expected.map((note) => note.name).join(' + ')}</p></div><div className="text-accent text-4xl leading-none">↓</div>{expected.length > 0 && <p className="text-sm text-slate-400">{durationHint(expected)}</p>}{feedback && <p className={`mt-3 text-sm font-medium ${feedback.type === 'wrong_pitch' ? 'text-amber-200' : 'text-key-correct'}`}>{feedback.message}</p>}<div className="mt-5"><p className="text-[10px] uppercase tracking-widest text-slate-500">Coming up</p><p className="text-sm text-slate-300 mt-1">{upcoming.length ? upcoming.map((group) => group.map((note) => note.name).join(' + ')).join('  →  ') : 'End of bar'}</p></div></div><VirtualPiano lowestNote={48} highestNote={84} activeNotes={activeNotes} highlights={highlights} /><div className="flex flex-wrap gap-2"><button className={button} onClick={() => { engine?.previousNote(); if (engine) setPosition(engine.getPosition()); setRefresh((value) => value + 1); }}>Previous</button><button className={button} onClick={() => { engine?.repeatBar(); if (engine) setPosition(engine.getPosition()); setRefresh((value) => value + 1); }}>Replay bar</button><button className={button} onClick={() => { engine?.nextBar(); if (engine) setPosition(engine.getPosition()); setRefresh((value) => value + 1); }}>Skip bar</button></div></section>}
    {phase === 'barComplete' && <section className="max-w-xl text-center bg-surface-900 border border-surface-700 rounded-2xl p-8"><p className="text-key-correct font-semibold">Bar {completedBar} completed!</p><h2 className="text-2xl font-bold mt-2">Now try it your way.</h2><p className="text-sm text-slate-400 mt-2">No clock and no score—just a natural run-through.</p><div className="flex justify-center flex-wrap gap-3 mt-6"><button className="bg-accent px-4 py-2.5 rounded-xl font-semibold" onClick={startFreeAttempt}>Try this bar</button><button className={button} onClick={continueLearning}>{engine?.isComplete() ? 'Finish lesson' : 'Next bar'}</button></div></section>}
    {phase === 'freeAttempt' && <section className="space-y-5"><div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 text-center"><p className="text-xs uppercase tracking-widest text-slate-400">Free attempt · Bar {completedBar}</p><h2 className="text-2xl font-bold mt-3">Play the whole bar naturally</h2><p className="mt-2 text-sm text-slate-400">We’ll give a few friendly pointers after you stop.</p><button className="mt-5 bg-surface-800 px-4 py-2 rounded-lg text-sm" onClick={finishFreeAttempt}>I’m finished</button></div><VirtualPiano lowestNote={48} highestNote={84} activeNotes={activeNotes} /></section>}
    {phase === 'feedback' && <section className="max-w-xl bg-surface-900 border border-surface-700 rounded-2xl p-8"><p className="text-key-correct font-semibold">Practice feedback</p><h2 className="text-2xl font-bold mt-2">Nice work trying the bar.</h2><ul className="mt-4 space-y-2 text-sm text-slate-300">{freeBullets.map((bullet, index) => <li key={index}>• {bullet}</li>)}</ul><div className="flex gap-3 mt-6"><button className={button} onClick={startFreeAttempt}>Replay bar</button><button className="bg-accent px-4 py-2 rounded-lg font-semibold" onClick={continueLearning}>{engine?.isComplete() ? 'Finish lesson' : 'Next bar'}</button></div></section>}
    {phase === 'finished' && <section className="max-w-xl text-center bg-surface-900 border border-surface-700 rounded-2xl p-10"><p className="text-key-correct font-semibold">Lesson complete</p><h2 className="text-2xl font-bold mt-2">Great work learning {songTitle}.</h2><button className="mt-6 bg-accent px-4 py-2 rounded-lg font-semibold" onClick={() => setPhase('setup')}>Choose another section</button></section>}
  </div>;
}
