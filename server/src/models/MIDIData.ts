import { Schema, model, Document, Types } from 'mongoose';
import { NormalizedNote, MidiBar, TempoEvent, TimeSignatureEvent } from '@maestro/shared';

export interface IMIDIData extends Document {
  _id: Types.ObjectId;
  ticksPerQuarter: number;
  tempoMap: TempoEvent[];
  timeSignatureMap: TimeSignatureEvent[];
  notes: NormalizedNote[];
  bars: MidiBar[];
  totalDurationSeconds: number;
  totalDurationTicks: number;
  trackCount: number;
  trackNames: string[];
  sourceFileHash: string;
  sourceFileName: string;
  createdAt: Date;
}

// Sub-schemas kept loose ({ strict: false } on arrays of plain objects)
// because NormalizedNote/MidiBar are precomputed, immutable-once-ingested
// value objects — re-declaring every field in Mongoose would just
// duplicate the shared TS type with no added safety.
const midiDataSchema = new Schema<IMIDIData>(
  {
    ticksPerQuarter: { type: Number, required: true },
    tempoMap: { type: [Schema.Types.Mixed], default: [] } as any,
    timeSignatureMap: { type: [Schema.Types.Mixed], default: [] } as any,
    notes: { type: [Schema.Types.Mixed], default: [] } as any,
    bars: { type: [Schema.Types.Mixed], default: [] } as any,
    totalDurationSeconds: { type: Number, required: true },
    totalDurationTicks: { type: Number, required: true },
    trackCount: { type: Number, required: true },
    trackNames: { type: [String], default: [] },
    // Hash lets the ingestion script skip re-parsing unchanged files,
    // and detect edited files that share the same path.
    sourceFileHash: { type: String, required: true, unique: true, index: true },
    sourceFileName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const MIDIData = model<IMIDIData>('MIDIData', midiDataSchema);
