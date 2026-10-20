import path from 'path';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { SongIngestionPipeline } from '../services/ingestion/SongIngestionPipeline';

async function main() {
  const midiRoot = path.resolve(__dirname, '../../', env.midiDir);
  console.log(`[ingest] scanning ${midiRoot}`);

  await connectDB();
  const pipeline = new SongIngestionPipeline();
  const report = await pipeline.run(midiRoot);

  console.log('[ingest] done:', report);
  if (report.scanned === 0) {
    console.log(
      `[ingest] No .mid/.midi files found. Place files under: ${midiRoot}\n` +
        `          Optional subfolders: open-library/, trinity-gradebook/, my-library/`
    );
  }
  await disconnectDB();
  process.exit(report.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[ingest] fatal error', err);
  process.exit(1);
});
