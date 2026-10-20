# MAESTRO — Architecture

## 1. Monorepo structure

```
/client   React + TypeScript + Vite frontend
/server   Node + Express + TypeScript API
/shared   TypeScript types shared by both (MIDI, song, performance, ML-boundary interfaces)
/data/midi  Where you drop .mid/.midi files for ingestion
/docs     This file
```

npm workspaces tie the three packages together so `shared` types are a single
source of truth instead of being duplicated (and drifting) between frontend
and backend. `client` and `server` never redeclare a type that already exists
in `shared` — e.g. `NormalizedMidiData`, `PerformanceEvent`, `Mistake`.

## 2. The MIDI pipeline, end to end

```
Physical keyboard --USB--> Web MIDI API --> MidiDeviceManager --> MidiEventParser
   --> MidiEventStream --> { VirtualPiano, LearningEngine, PerformanceRecorder }
```

This is entirely client-side and entirely synchronous with the DOM event
loop — no network round-trip sits between a key press and the UI reacting.
See "Real-time vs. persistence path" below.

Reference song data takes a different, offline path:

```
.mid file on disk --> MidiIngestionService (parses with @tonejs/midi)
   --> MusicTimeConverter (ticks -> seconds -> bar/beat, tempo-aware)
   --> NormalizedMidiData --> MongoDB (MIDIData collection)
```

Both paths converge on the same vocabulary (`shared/src/types/midi.ts`):
a live `MidiEvent` and a reference `NormalizedNote` both carry pitch,
velocity, and precise timing, so the scoring engine can diff them directly.

## 3. Real-time path vs. persistence path (Section 35)

- **Real-time path**: MIDI → `MidiEventStream` → UI. Purely in-browser.
  `PerformanceRecorder` subscribes to the same stream and buffers events in
  a plain array — no `fetch()` calls happen while the user is playing.
- **Persistence path**: only once a Learn session is "finished" or a Test is
  "stopped" does the buffered event array get POSTed to
  `/api/performances`, once, in a single request. The server re-runs
  scoring itself (never trusts a client-computed score) and persists both
  the raw `PerformanceEvent` rows and the derived `PerformanceAnalysisResult`.

This is why `PerformanceRecorder.start()`/`.stop()` never touch `fetch`.

## 4. Why bar/beat math lives in `MusicTimeConverter`

MIDI files store time in ticks, and tempo can change mid-file. Naively
treating "1 tick = N milliseconds" breaks the moment there's a tempo change.
`MusicTimeConverter` builds two independent piecewise-linear segment tables
— one for tempo changes (tick → cumulative seconds) and one for
time-signature changes (tick → cumulative bar count) — and every
tick→seconds or tick→bar/beat conversion in the app goes through it. This
was verified against a synthetic MIDI file with both a tempo change
(120→90 BPM) and a time-signature change (4/4→3/4) mid-piece; bar
boundaries and wall-clock bar times came out correct on both sides of the
change (see `server/scratch/testIngest.ts` if you want to rerun it).

## 5. The ML boundary (Sections 15 & 26)

```
Performance events + reference MIDI
        |
        v
  ScoringEngine (interface, shared/src/types/analysis.ts)
        |
   +----+-----------------------+
   |                            |
RuleBasedScoringEngine    (future) MLScoringEngine
(server/services/scoring)  (calls an external HTTP service)
```

`PerformanceService` never imports `RuleBasedScoringEngine` directly — it
asks `getScoringEngine()` (`services/scoring/ScoringEngineFactory.ts`) for
whatever engine is configured. Every engine must return the same
`PerformanceAnalysisResult` shape (summary + per-dimension scores +
explainable mistakes + bar heatmap + narrative). This means:

- The frontend, database schema, and API contract never change when the
  scoring implementation changes.
- Swapping in an ML engine later is a one-file change: implement
  `MLScoringEngine`, flip the branch in `ScoringEngineFactory`.
- Nothing about the ML service's language/framework is committed to now —
  `env.mlServiceUrl` is the only hook, and it's unset by default.

`shared/src/types/analysis.ts` also defines `PerformanceFeatureVector` and
`PerformanceAnalyzer` for a future explicit feature-extraction step, ahead
of when it's actually needed.

## 6. Database schema & indexing

| Collection | Purpose | Key indexes |
|---|---|---|
| `User` | accounts, role (`student`\|`teacher`\|`admin`) | `email` (unique), `{teacherId, role}` for future teacher roster queries |
| `Song` | catalog metadata only | text index on `{title, composer, tags}` for search; `{category, difficulty}` compound for library filtering |
| `SongVersion` | one ingested MIDI file backing a Song | `sourceFilePath` (unique) — this is how re-ingestion finds "have I seen this file before" |
| `MIDIData` | the heavy normalized parse payload | `sourceFileHash` (unique) — content-based change detection, independent of file path |
| `Performance` | one Learn/Test session's summary + full analysis | `{userId, createdAt}` for dashboard history; `{userId, songId, createdAt}` for per-song history |
| `PerformanceEvent` | raw per-note captures, kept for ML research | `{performanceId, timestamp}` — the only access pattern this collection serves |
| `PracticeSession` | app-open-to-close session, for streak/time stats | `{userId, startedAt}` |
| `LearningProgress` | per-user-per-song bar mastery cursor | `{userId, songId}` unique; `{userId, lastPracticedAt}` for "currently learning" |
| `FavoriteSong` | My Library | `{userId, songId}` unique |

`Performance` deliberately stores the full `analysis` object (not just a
score) inline — the dashboard's history list needs it without a join, but
`PerformanceEvent` rows are only fetched when a user drills into one
specific performance, or by a future ML batch job. This keeps the common
dashboard query cheap while still preserving 100% of the raw capture
(Section 16 — never throw away timing data).

## 7. API layer

Every route follows `routes -> controllers (inline in the route file for
these simple cases) -> services -> Mongoose models`. Business logic (score
calculation, ingestion, bar-mastery updates) lives in `server/src/services/`,
never in a route handler. `RuleBasedScoringEngine` in particular has zero
Express/HTTP knowledge — it's a pure function of
`(reference, startBar, endBar, events, tempo) -> analysis`, which is what
makes it independently unit-testable and swappable.

## 8. What's deliberately NOT built yet

- **Teacher mode UI.** The `role` field, `requireRole()` middleware, and
  `teacherId` on `User` exist so this is a schema/auth change away, not a
  rewrite, but there's no teacher dashboard yet (Section 27: "do not
  overbuild this now").
- **ML scoring service.** The boundary exists (`ScoringEngine` interface,
  `env.mlServiceUrl`); no model is implemented (Section 26 explicitly
  says not to force this now).
- **Hand-separation ground truth.** `NormalizedNote.hand` is a heuristic
  (track-count based), clearly commented as such — not a real hand-tracking
  model.
- **Mobile/desktop native clients.** The API is plain REST/JSON with no
  web-specific coupling, so a future Electron or React Native client would
  talk to the same backend without changes.
