import { Schema, model, Document, Types } from 'mongoose';
import { PerformanceAnalysisResult } from '@maestro/shared';

export interface IPerformance extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  songId: Types.ObjectId;
  songVersionId: Types.ObjectId;
  mode: 'learn' | 'test';
  startBar: number;
  endBar: number;
  tempoBpm: number;
  metronomeEnabled: boolean;
  durationSeconds: number;
  /** Full explainable analysis — see shared PerformanceAnalysisResult. Never just a number. */
  analysis: PerformanceAnalysisResult;
  /** Convenience denormalized field for fast dashboard sorting/filtering without unpacking `analysis`. */
  overallScore: number;
  scoringEngine: string; // "rule-based-v1" | future "ml-v1" — which engine produced `analysis`
  createdAt: Date;
}

const performanceSchema = new Schema<IPerformance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    songId: { type: Schema.Types.ObjectId, ref: 'Song', required: true, index: true },
    songVersionId: { type: Schema.Types.ObjectId, ref: 'SongVersion', required: true },
    mode: { type: String, enum: ['learn', 'test'], required: true },
    startBar: { type: Number, required: true },
    endBar: { type: Number, required: true },
    tempoBpm: { type: Number, required: true },
    metronomeEnabled: { type: Boolean, default: false },
    durationSeconds: { type: Number, required: true },
    analysis: { type: Schema.Types.Mixed, required: true },
    overallScore: { type: Number, required: true, index: true },
    scoringEngine: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Dashboard's "performance history for this user, newest first" query.
performanceSchema.index({ userId: 1, createdAt: -1 });
// "History for this user on this song" (song page progress view).
performanceSchema.index({ userId: 1, songId: 1, createdAt: -1 });

export const Performance = model<IPerformance>('Performance', performanceSchema);
