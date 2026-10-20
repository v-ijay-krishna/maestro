import { Schema, model, Document, Types } from 'mongoose';

/** One continuous app-open-to-close practice session, for streaks/time-practiced stats. */
export interface IPracticeSession extends Document {
  userId: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  songsTouched: Types.ObjectId[];
  performanceIds: Types.ObjectId[];
}

const practiceSessionSchema = new Schema<IPracticeSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  durationSeconds: { type: Number, default: 0 },
  songsTouched: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
  performanceIds: [{ type: Schema.Types.ObjectId, ref: 'Performance' }],
});
practiceSessionSchema.index({ userId: 1, startedAt: -1 });

export const PracticeSession = model<IPracticeSession>('PracticeSession', practiceSessionSchema);

/** Per-user, per-song learning cursor: how far through the piece they've gotten. */
export interface ILearningProgress extends Document {
  userId: Types.ObjectId;
  songId: Types.ObjectId;
  songVersionId: Types.ObjectId;
  currentBar: number;
  completedBars: number[];
  /** 0-1 per bar, running average from recent performances on that bar. Drives the bar heatmap. */
  barMastery: Record<string, number>;
  lastPracticedAt: Date;
}

const learningProgressSchema = new Schema<ILearningProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true },
  songVersionId: { type: Schema.Types.ObjectId, ref: 'SongVersion', required: true },
  currentBar: { type: Number, default: 1 },
  completedBars: { type: [Number], default: [] },
  barMastery: { type: Schema.Types.Mixed, default: {} },
  lastPracticedAt: { type: Date, default: Date.now },
});
// One progress doc per user+song; also serves "songs currently learning" dashboard query.
learningProgressSchema.index({ userId: 1, songId: 1 }, { unique: true });
learningProgressSchema.index({ userId: 1, lastPracticedAt: -1 });

export const LearningProgress = model<ILearningProgress>('LearningProgress', learningProgressSchema);

export interface IFavoriteSong extends Document {
  userId: Types.ObjectId;
  songId: Types.ObjectId;
  createdAt: Date;
}

const favoriteSongSchema = new Schema<IFavoriteSong>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
favoriteSongSchema.index({ userId: 1, songId: 1 }, { unique: true });

export const FavoriteSong = model<IFavoriteSong>('FavoriteSong', favoriteSongSchema);

export { User } from './User';
export { Song } from './Song';
export { SongVersion } from './SongVersion';
export { MIDIData } from './MIDIData';
export { Performance } from './Performance';
export { PerformanceEvent } from './PerformanceEvent';
