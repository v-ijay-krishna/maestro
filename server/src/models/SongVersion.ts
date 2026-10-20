import { Schema, model, Document, Types } from 'mongoose';

export interface ISongVersion extends Document {
  _id: Types.ObjectId;
  songId: Types.ObjectId;
  label: string;
  sourceFilePath: string; // relative to MIDI_DIR, e.g. "classical/fur-elise.mid"
  originalTempoBpm: number;
  midiDataId: Types.ObjectId;
  createdAt: Date;
}

const songVersionSchema = new Schema<ISongVersion>(
  {
    songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true, index: true },
    label: { type: String, default: 'Original' },
    sourceFilePath: { type: String, required: true, unique: true },
    originalTempoBpm: { type: Number, required: true },
    midiDataId: { type: Schema.Types.ObjectId, ref: 'MIDIData', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SongVersion = model<ISongVersion>('SongVersion', songVersionSchema);
