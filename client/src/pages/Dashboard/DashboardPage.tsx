import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../../services/api/client';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([api.analysis.dashboard(), api.progress.list()])
      .then(([s, p]) => {
        setSummary(s);
        setProgress(p);
      })
      .catch(() => setErrored(true))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your dashboard"
        detail="Practice history, progress graphs, and streaks are tied to your account."
        cta={{ to: '/auth', label: 'Sign in' }}
      />
    );
  }

  if (loading) return <p className="text-slate-400">Loading dashboard…</p>;
  if (errored) return <p className="text-key-wrong">Could not load dashboard data.</p>;

  const hours = Math.floor((summary?.practiceTime.totalSeconds ?? 0) / 3600);
  const minutes = Math.floor(((summary?.practiceTime.totalSeconds ?? 0) % 3600) / 60);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.name.split(' ')[0]}.</h1>
        <p className="text-slate-400 text-sm mt-1">Here's where your practice stands.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Learning streak" value={`${summary.learningStreakDays} day${summary.learningStreakDays === 1 ? '' : 's'}`} />
        <StatCard label="Time practiced" value={`${hours}h ${minutes}m`} />
        <StatCard label="Practice sessions" value={String(summary.practiceTime.sessionCount)} />
        <StatCard label="Songs in progress" value={String(progress.length)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Timing &amp; duration over time</h2>
          {summary.trend.length === 0 ? (
            <p className="text-sm text-slate-500">No test results yet — complete a Test to see your progress here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#20242f" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#171a22', border: '1px solid #2b3040' }} />
                <Line type="monotone" dataKey="timingScore" stroke="#4fb0ff" name="Timing" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="durationScore" stroke="#3ddc97" name="Duration" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Songs currently learning</h2>
          {progress.length === 0 ? (
            <EmptyInline text="No songs in progress yet." linkTo="/library" linkLabel="Browse the library" />
          ) : (
            <ul className="space-y-3">
              {progress.slice(0, 5).map((p) => (
                <li key={p._id} className="flex items-center justify-between text-sm">
                  <span>{p.songId?.title ?? 'Untitled'}</span>
                  <span className="text-slate-500">Bar {p.currentBar} · {p.completedBars.length} bars mastered</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Recent performances</h2>
        {summary.recentPerformances.length === 0 ? (
          <EmptyInline text="No test results yet." linkTo="/library" linkLabel="Start a Test" />
        ) : (
          <div className="space-y-2">
            {summary.recentPerformances.map((p: any) => (
              <Link
                key={p._id}
                to={`/performance/${p._id}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-800 hover:bg-surface-700 transition-colors text-sm"
              >
                <div>
                  <p className="font-medium">{p.songId?.title ?? 'Untitled'}</p>
                  <p className="text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()} · Bars {p.startBar}-{p.endBar}</p>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <Dim label="Notes" value={p.analysis.dimensions.noteAccuracy.score} />
                  <Dim label="Timing" value={p.analysis.dimensions.timing.score} />
                  <Dim label="Duration" value={p.analysis.dimensions.duration.score} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-2xl p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Dim({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-semibold text-white">{value}%</p>
      <p>{label}</p>
    </div>
  );
}

function EmptyInline({ text, linkTo, linkLabel }: { text: string; linkTo: string; linkLabel: string }) {
  return (
    <p className="text-sm text-slate-500">
      {text}{' '}
      <Link to={linkTo} className="text-accent-soft">
        {linkLabel}
      </Link>
    </p>
  );
}

function EmptyState({ title, detail, cta }: { title: string; detail: string; cta: { to: string; label: string } }) {
  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-slate-400 text-sm mt-2">{detail}</p>
      <Link to={cta.to} className="inline-block mt-4 px-4 py-2 bg-accent rounded-lg text-sm font-medium">
        {cta.label}
      </Link>
    </div>
  );
}
