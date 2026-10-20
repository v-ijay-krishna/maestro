import { Types } from 'mongoose';
import { PerformanceEvent as PerformanceEventType, PerformanceConfig } from '@maestro/shared';
import { Performance } from '../models/Performance';
import { PerformanceEvent } from '../models/PerformanceEvent';
import { SongVersion } from '../models/SongVersion';
import { MIDIData } from '../models/MIDIData';
import { LearningProgress } from '../models';
import { getScoringEngine } from './scoring/ScoringEngineFactory';

export class PerformanceService {
  /**
   * The browser has already done all real-time work (Section 35) — this
   * is called once, after the user stops playing, with the full captured
   * event stream. We re-run scoring server-side (never trust the client's
   * own score) and persist both the raw events and the derived analysis.
   */
  async submitPerformance(userId: string, config: PerformanceConfig, events: PerformanceEventType[], durationSeconds: number) {
    const version = await SongVersion.findById(config.songVersionId);
    if (!version) throw new Error('NOT_FOUND');
    const midiData = await MIDIData.findById(version.midiDataId).lean();
    if (!midiData) throw new Error('NOT_FOUND');

    const engine = getScoringEngine();
    const analysis = await engine.score(midiData as any, config.startBar, config.endBar, events, config.tempoBpm);

    const overallScore = Math.round(
      (analysis.dimensions.noteAccuracy.score +
        analysis.dimensions.timing.score +
        analysis.dimensions.duration.score +
        analysis.dimensions.rhythm.score +
        analysis.dimensions.dynamics.score) /
        5
    );

    const performance = await Performance.create({
      userId,
      songId: version.songId,
      songVersionId: version._id,
      mode: config.mode,
      startBar: config.startBar,
      endBar: config.endBar,
      tempoBpm: config.tempoBpm,
      metronomeEnabled: config.metronomeEnabled,
      durationSeconds,
      analysis,
      overallScore,
      scoringEngine: engine.name,
    });

    if (events.length > 0) {
      await PerformanceEvent.insertMany(
        events.map((e) => ({ ...e, performanceId: performance._id })),
        { ordered: false }
      );
    }

    await this.updateLearningProgress(userId, version.songId.toString(), version._id.toString(), analysis.barHeatmap);

    return performance;
  }

  private async updateLearningProgress(
    userId: string,
    songId: string,
    songVersionId: string,
    barHeatmap: { bar: number; status: string }[]
  ) {
    const progress = await LearningProgress.findOneAndUpdate(
      { userId, songId },
      {
        $setOnInsert: { userId, songId, songVersionId, currentBar: 1, completedBars: [] },
        $set: { lastPracticedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    for (const entry of barHeatmap) {
      const masteryDelta = entry.status === 'good' ? 1 : entry.status === 'needs_practice' ? 0.5 : 0;
      const prev = progress.barMastery[String(entry.bar)] ?? 0;
      // Exponential moving average so mastery reflects recent attempts more than ancient ones.
      progress.barMastery[String(entry.bar)] = prev * 0.6 + masteryDelta * 0.4;
      if (entry.status === 'good' && !progress.completedBars.includes(entry.bar)) {
        progress.completedBars.push(entry.bar);
      }
    }
    progress.markModified('barMastery');
    await progress.save();
  }

  async getById(id: string) {
    const performance = await Performance.findById(id).lean();
    if (!performance) return null;
    const events = await PerformanceEvent.find({ performanceId: id }).sort({ timestamp: 1 }).lean();
    return { performance, events };
  }

  async listForUser(userId: string, limit = 20) {
    return Performance.find({ userId }).sort({ createdAt: -1 }).limit(limit).populate('songId', 'title composer').lean();
  }

  async listForUserAndSong(userId: string, songId: string) {
    return Performance.find({ userId, songId }).sort({ createdAt: -1 }).lean();
  }
}

export const performanceService = new PerformanceService();
