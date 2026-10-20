import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api/client';

const HEATMAP_COLOR: Record<string, string> = {
  good: 'bg-key-correct',
  needs_practice: 'bg-key-early',
  difficult: 'bg-key-wrong',
  not_attempted: 'bg-surface-700',
};

export function PerformancePage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (id) api.performances.getById(id).then(setData);
  }, [id]);

  if (!data) return <p className="text-slate-400">Loading…</p>;
  const { performance } = data;
  const a = performance.analysis;

  return (
    <div className="max-w-3xl">
      <Link to="/" className="text-xs text-slate-400 hover:text-white">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold mt-2">Performance Analysis</h1>
      <p className="text-slate-400 text-sm mt-1">
        Bars {performance.startBar}–{performance.endBar} · {performance.tempoBpm} BPM · {new Date(performance.createdAt).toLocaleString()}
      </p>

      <div className="grid grid-cols-5 gap-3 mt-6">
        {Object.entries(a.dimensions).map(([key, dim]: [string, any]) => (
          <div key={key} className="bg-surface-900 border border-surface-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-2xl font-bold mt-1">{dim.score}</p>
            <p className="text-xs text-slate-400 mt-1">{dim.label}</p>
            <p className="text-[11px] text-slate-500 mt-2">{dim.detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 mt-6">
        <h2 className="font-semibold mb-3">What happened</h2>
        <ul className="space-y-1.5 text-sm text-slate-300 list-disc list-inside">
          {a.narrative.map((line: string, i: number) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 mt-6">
        <h2 className="font-semibold mb-3">Bar heatmap</h2>
        <div className="flex flex-wrap gap-1.5">
          {a.barHeatmap.map((b: any) => (
            <div key={b.bar} title={`Bar ${b.bar}: ${b.status.replace('_', ' ')} (${b.mistakeCount} issues)`} className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-medium ${HEATMAP_COLOR[b.status]}`}>
              {b.bar}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 mt-6">
        <h2 className="font-semibold mb-3">Mistakes ({a.mistakes.length})</h2>
        {a.mistakes.length === 0 ? (
          <p className="text-sm text-key-correct">No mistakes detected — excellent playing!</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {a.mistakes.map((m: any, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-slate-400 shrink-0">Bar {m.bar}</span>
                <span className="text-slate-300">{m.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
