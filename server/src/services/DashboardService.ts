import { Types } from 'mongoose';
import { Performance } from '../models/Performance';
import { PracticeSession } from '../models';

export class DashboardService {
  async getSummary(userId: string) {
    const uid = new Types.ObjectId(userId);

    const recentPerformances = await Performance.find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('songId', 'title composer')
      .lean();

    const [timeStats] = await PracticeSession.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: null, totalSeconds: { $sum: '$durationSeconds' }, sessionCount: { $sum: 1 } } },
    ]);

    const streak = await this.computeStreak(uid);

    // Progress-over-time series for the dashboard's timing/duration graphs (Section 18).
    const trend = await Performance.find({ userId: uid })
      .sort({ createdAt: 1 })
      .select('createdAt overallScore analysis.dimensions.timing.score analysis.dimensions.duration.score songId')
      .limit(50)
      .lean();

    return {
      recentPerformances,
      practiceTime: {
        totalSeconds: timeStats?.totalSeconds ?? 0,
        sessionCount: timeStats?.sessionCount ?? 0,
      },
      learningStreakDays: streak,
      trend: trend.map((p) => ({
        date: p.createdAt,
        overallScore: p.overallScore,
        timingScore: p.analysis?.dimensions?.timing?.score ?? null,
        durationScore: p.analysis?.dimensions?.duration?.score ?? null,
      })),
    };
  }

  private async computeStreak(userId: Types.ObjectId): Promise<number> {
    const sessions = await PracticeSession.find({ userId }).sort({ startedAt: -1 }).select('startedAt').lean();
    if (sessions.length === 0) return 0;

    const days = new Set(sessions.map((s) => new Date(s.startedAt).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }
}

export const dashboardService = new DashboardService();
