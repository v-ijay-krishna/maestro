import { Schema, model, Document, Types } from 'mongoose';

/**
 * One row per captured noteOn/noteOff. Deliberately NOT embedded inside
 * Performance: a test on a long piece can generate thousands of events,
 * and the dashboard/history views only need the parent Performance
 * document (with its precomputed `analysis`). Raw events are fetched
 * only when the user drills into a specific performance, or by future
 * ML batch jobs.
 */
export interface IPerformanceEvent extends Document {
  performanceId: Types.ObjectId;
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  channel: number;
  timestamp: number; // ms, relative to performance start
  duration?: number; // ms, only on noteOff
  bar?: number;
  beat?: number;
}

const performanceEventSchema = new Schema<IPerformanceEvent>({
  performanceId: { type: Schema.Types.ObjectId, ref: 'Performance', required: true, index: true },
  type: { type: String, enum: ['noteOn', 'noteOff'], required: true },
  note: { type: Number, required: true },
  velocity: { type: Number, required: true },
  channel: { type: Number, required: true },
  timestamp: { type: Number, required: true },
  duration: { type: Number },
  bar: { type: Number },
  beat: { type: Number },
});

// Bulk-fetch "everything for this performance, in order" is the only
// access pattern this collection needs to serve.
performanceEventSchema.index({ performanceId: 1, timestamp: 1 });

export const PerformanceEvent = model<IPerformanceEvent>('PerformanceEvent', performanceEventSchema);
