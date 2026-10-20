import { Schema, model, Document, Types } from 'mongoose';

export interface ISong extends Document {
  _id: Types.ObjectId;
  title: string;
  composer: string;
  category: 'open_library' | 'trinity_gradebook' | 'my_library_seed';
  difficulty: 'beginner' | 'early_intermediate' | 'intermediate' | 'advanced' | 'expert';
  genre?: string;
  description?: string;
  trinity?: { grade: number; syllabusYear?: string; list?: string };
  defaultVersionId?: Types.ObjectId;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<ISong>(
  {
    title: { type: String, required: true, trim: true, index: true },
    composer: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ['open_library', 'trinity_gradebook', 'my_library_seed'],
      default: 'open_library',
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'early_intermediate', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate',
      index: true,
    },
    genre: { type: String, trim: true },
    description: { type: String, trim: true },
    trinity: {
      grade: Number,
      syllabusYear: String,
      list: String,
    },
    defaultVersionId: { type: Schema.Types.ObjectId, ref: 'SongVersion' },
    tags: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);

// Text index powers Open Library search (title/composer/tags).
songSchema.index({ title: 'text', composer: 'text', tags: 'text' });
// Compound index for the library's common filter combo (category + difficulty).
songSchema.index({ category: 1, difficulty: 1 });

export const Song = model<ISong>('Song', songSchema);
