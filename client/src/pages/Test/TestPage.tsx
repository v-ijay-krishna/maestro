import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api/client';
import { useMidiContext } from '../../context/MidiContext';
import { PerformanceRecorder } from '../../services/midi/PerformanceRecorder';
import { metronome as metronomeEngine } from '../../services/audio/Metronome';
import { NormalizedMidiData } from '@maestro/shared';

const TEMPO_STEPS = [40, 50, 60, 70, 80, 90, 100, 110, 120];

export function TestPage() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const { connectedDevice } = useMidiContext();

  const [songTitle, setSongTitle] = useState('');
  const [midiData, setMidiData] = useState<NormalizedMidiData | null>(null);
  const [songVersionId, setSongVersionId] = useState('');
  const [startBar, setStartBar] = useState(1);
  const [endBar, setEndBar] = useState(4);
  const [tempo, setTempo] = useState(60);
  const [useOriginalTempo, setUseOriginalTempo] = useState(true);
  const [metronome, setMetronome] = useState(true);
  const [countIn, setCountIn] = useState<0 | 1 | 2>(1);
  const [phase, setPhase] = useState<'config' | 'counting' | 'recording' | 'submitting'>('config');
  const [countInBeat, setCountInBeat] = useState(0);

  const recorder = React.useRef(new PerformanceRecorder());

  useEffect(() => {
    return () => {
      metronomeEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!songId) return;
    api.songs.getById(songId).then((s) => setSongTitle(s.title));
    api.songs.getMidi(songId).then(({ version, midiData }) => {
      setSongVersionId(version._id);
      setMidiData(midiData);
      setTempo(midiData.tempoMap[0]?.bpm ?? 120);
      const maxBar = midiData.bars.length;
      setEndBar(Math.min(4, maxBar));
    });
  }, [songId]);

  const originalBpm = midiData?.tempoMap[0]?.bpm ?? 120;
  const effectiveTempo = useOriginalTempo ? originalBpm : tempo;

  const startTest = async () => {
    setPhase('counting');
    const beatsPerBar = midiData?.bars[startBar - 1]?.timeSignature.numerator ?? 4;
    const totalCountInBeats = countIn * beatsPerBar;

    if (countIn === 0) {
      setPhase('recording');
      if (metronome) await metronomeEngine.start(effectiveTempo, beatsPerBar, () => {});
      recorder.current.start();
      return;
    }

    let beatsElapsed = 0;
    await metronomeEngine.start(effectiveTempo, beatsPerBar, (beatInBar) => {
      beatsElapsed += 1;
      setCountInBeat(beatInBar);
      if (beatsElapsed >= totalCountInBeats) {
        setPhase('recording');
        recorder.current.start();
        if (!metronome) metronomeEngine.stop();
      }
    });
  };

  const stopAndSubmit = async () => {
    setPhase('submitting');
    metronomeEngine.stop();
    const { events, durationSeconds } = recorder.current.stop();
    const performance = await api.performances.submit({
      config: {
        songId,
        songVersionId,
        mode: 'test',
        startBar,
        endBar,
        tempoBpm: effectiveTempo,
        metronomeEnabled: metronome,
        countInBars: countIn,
        hands: 'both',
      },
      events,
      durationSeconds,
    });
    navigate(`/performance/${performance._id}`);
  };

  if (!connectedDevice) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center">
        <h2 className="text-lg font-semibold">Connect your MIDI keyboard</h2>
        <p className="text-slate-400 text-sm mt-2">Test mode needs a physical MIDI keyboard connected via USB.</p>
      </div>
    );
  }

  if (!midiData) return <p className="text-slate-400">Loading song…</p>;

  const maxBar = midiData.bars.length;

  return (
    <div className="max-w-2xl">
      <Link to={`/songs/${songId}`} className="text-xs text-slate-400 hover:text-white">
        ← {songTitle}
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Test — {songTitle}</h1>

      {phase === 'config' && (
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start bar">
              <input type="number" min={1} max={maxBar} value={startBar} onChange={(e) => setStartBar(Number(e.target.value))} className="input" />
            </Field>
            <Field label="End bar">
              <input type="number" min={startBar} max={maxBar} value={endBar} onChange={(e) => setEndBar(Number(e.target.value))} className="input" />
            </Field>
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Bars 1-4', s: 1, e: Math.min(4, maxBar) },
              { label: 'Bars 5-8', s: Math.min(5, maxBar), e: Math.min(8, maxBar) },
              { label: 'Whole song', s: 1, e: maxBar },
            ].map((preset) => (
              <button key={preset.label} onClick={() => { setStartBar(preset.s); setEndBar(preset.e); }} className="px-3 py-1.5 bg-surface-800 rounded-lg text-xs">
                {preset.label}
              </button>
            ))}
          </div>

          <Field label="Tempo">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useOriginalTempo} onChange={(e) => setUseOriginalTempo(e.target.checked)} />
                Original tempo ({originalBpm} BPM)
              </label>
              {!useOriginalTempo && (
                <select value={tempo} onChange={(e) => setTempo(Number(e.target.value))} className="input w-auto">
                  {TEMPO_STEPS.map((t) => (
                    <option key={t} value={t}>
                      {t} BPM
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} />
              Metronome
            </label>
            <Field label="Count-in">
              <select value={countIn} onChange={(e) => setCountIn(Number(e.target.value) as 0 | 1 | 2)} className="input w-auto">
                <option value={0}>Off</option>
                <option value={1}>1 bar</option>
                <option value={2}>2 bars</option>
              </select>
            </Field>
          </div>

          <button onClick={startTest} className="w-full bg-accent rounded-xl py-3 font-semibold">
            Start Test
          </button>
        </div>
      )}

      {phase === 'counting' && (
        <div className="text-center py-24">
          <p className="text-slate-400 mb-2">Get ready…</p>
          <p className="text-6xl font-extrabold">{countInBeat}</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="text-center py-24">
          <p className="flex items-center justify-center gap-2 text-key-wrong font-medium mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-key-wrong animate-pulse" /> Recording
          </p>
          <p className="text-slate-400 mb-8">Play bars {startBar}–{endBar} at {effectiveTempo} BPM.</p>
          <button onClick={stopAndSubmit} className="px-6 py-3 bg-surface-800 rounded-xl font-semibold">
            Stop &amp; Analyze
          </button>
        </div>
      )}

      {phase === 'submitting' && <p className="text-center py-24 text-slate-400">Analyzing your performance…</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
