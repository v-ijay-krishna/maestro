# Drop your .mid / .midi files here

- `open-library/`  -> appears under the "Open Library" tab
- `trinity/`        -> appears under the "Trinity Gradebook" tab
- `my-library/`      -> appears under the "My Library" tab
- anything directly in `data/midi/` (no subfolder) also defaults to Open Library

After adding files, run:

    npm run ingest:midi --workspace=server

To set a clean title, composer, difficulty, tags, or Trinity grade for an
imported file, add an entry keyed by its relative path to
`library-metadata.json`. The MAESTRO lesson catalog is an example.

This is safe to re-run any time — it hashes each file's contents and skips
anything that hasn't changed, and updates the record for anything that has.

No files are checked into this repo (this directory is empty on purpose —
see Section 40 of the spec: "do not fabricate MIDI files").
