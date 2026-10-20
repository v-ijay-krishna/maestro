import fs from 'fs';
import path from 'path';
import { MidiIngestionService } from './MidiIngestionService';
import { Song, SongVersion, MIDIData } from '../../models';

export interface IngestionReport {
  scanned: number;
  added: number;
  updated: number;
  skippedUnchanged: number;
  errors: { file: string; error: string }[];
}

type LessonMetadata = {
  title?: string;
  composer?: string;
  difficulty?: 'beginner' | 'early_intermediate' | 'intermediate' | 'advanced' | 'expert';
  genre?: string;
  description?: string;
  tags?: string[];
  trinity?: { grade: number; syllabusYear?: string; list?: string };
};

type LessonMetadataFile = Record<string, LessonMetadata>;

/** Optional catalog data keyed by paths relative to MIDI_DIR. */
function readLessonMetadata(rootDir: string): LessonMetadataFile {
  const metadataPath = path.join(rootDir, 'library-metadata.json');
  if (!fs.existsSync(metadataPath)) return {};

  const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`Invalid lesson metadata file: ${metadataPath}`);
  }
  return parsed as LessonMetadataFile;
}

/**
 * Recursively finds every .mid/.midi file under `rootDir`. This is the
 * mechanism that satisfies "do not hardcode songs" — dropping a new file
 * anywhere under /data/midi and re-running ingestion is the entire
 * workflow for adding a song.
 */
function findMidiFiles(rootDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(rootDir)) return results;

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(mid|midi)$/i.test(entry.name)) {
        results.push(full);
      }
    }
  };
  walk(rootDir);
  return results;
}

/** Turns "01-fur-elise-beethoven.mid" into a readable fallback title. */
function titleFromFilename(filePath: string): { title: string; composer: string } {
  const base = path.basename(filePath, path.extname(filePath));
  const cleaned = base.replace(/^[0-9]+[-_. ]*/, '').replace(/[-_]+/g, ' ').trim();
  const parts = cleaned.split(' - ');
  if (parts.length >= 2) {
    return { title: toTitleCase(parts[0]), composer: toTitleCase(parts[1]) };
  }
  return { title: toTitleCase(cleaned), composer: 'Unknown' };
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Category is inferred from the immediate parent folder name under the MIDI root, if present. */
function categoryFromPath(rootDir: string, filePath: string): 'open_library' | 'trinity_gradebook' | 'my_library_seed' {
  const rel = path.relative(rootDir, filePath).toLowerCase();
  if (rel.includes('trinity')) return 'trinity_gradebook';
  if (rel.includes('my-library') || rel.includes('my_library')) return 'my_library_seed';
  return 'open_library';
}

export class SongIngestionPipeline {
  private ingestor = new MidiIngestionService();

  async run(midiRootDir: string): Promise<IngestionReport> {
    const report: IngestionReport = { scanned: 0, added: 0, updated: 0, skippedUnchanged: 0, errors: [] };
    const files = findMidiFiles(midiRootDir);
    const metadata = readLessonMetadata(midiRootDir);
    report.scanned = files.length;

    for (const filePath of files) {
      try {
        await this.ingestOne(midiRootDir, filePath, report, metadata);
      } catch (err: any) {
        report.errors.push({ file: filePath, error: err?.message ?? String(err) });
      }
    }
    return report;
  }

  private async ingestOne(
    midiRootDir: string,
    filePath: string,
    report: IngestionReport,
    metadata: LessonMetadataFile,
  ): Promise<void> {
    const buffer = fs.readFileSync(filePath);
    const relPath = path.relative(midiRootDir, filePath).replace(/\\/g, '/');
    const { normalized, originalTempoBpm } = this.ingestor.parse(buffer, path.basename(filePath));

    const existingVersion = await SongVersion.findOne({ sourceFilePath: relPath });
    if (existingVersion) {
      const existingMidiData = await MIDIData.findById(existingVersion.midiDataId);
      if (existingMidiData && existingMidiData.sourceFileHash === normalized.sourceFileHash) {
        report.skippedUnchanged++;
        return;
      }
      // File changed on disk — replace the normalized payload, keep the same SongVersion id
      // so existing Performance history still points at a valid version.
      const midiData = await MIDIData.create(normalized);
      existingVersion.midiDataId = midiData._id;
      existingVersion.originalTempoBpm = originalTempoBpm;
      await existingVersion.save();
      report.updated++;
      return;
    }

    const fallback = titleFromFilename(filePath);
    const catalog = metadata[relPath];
    const title = catalog?.title ?? fallback.title;
    const composer = catalog?.composer ?? fallback.composer;
    const category = categoryFromPath(midiRootDir, filePath);

    let song = await Song.findOne({ title, composer });
    if (!song) {
      song = await Song.create({
        title,
        composer,
        category,
        difficulty: catalog?.difficulty ?? 'intermediate',
        genre: catalog?.genre,
        description: catalog?.description,
        trinity: catalog?.trinity,
        tags: catalog?.tags ?? [],
      });
    }

    const midiData = await MIDIData.create(normalized);
    const songVersion = await SongVersion.create({
      songId: song._id,
      label: 'Original',
      sourceFilePath: relPath,
      originalTempoBpm,
      midiDataId: midiData._id,
    });

    if (!song.defaultVersionId) {
      song.defaultVersionId = songVersion._id;
      await song.save();
    }

    report.added++;
  }
}
