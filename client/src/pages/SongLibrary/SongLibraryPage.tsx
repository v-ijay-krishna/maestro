import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api/client';

const TABS = [
  { key: 'open_library', label: 'Open Library' },
  { key: 'trinity_gradebook', label: 'Trinity Gradebook' },
  { key: 'my_library_seed', label: 'My Library' },
] as const;

export function SongLibraryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('open_library');
  const [songs, setSongs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(true);
  const [libraryCounts, setLibraryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api.library.summary().then((res) => {
      const map: Record<string, number> = {};
      res.categories.forEach((c: any) => (map[c.key] = c.count));
      setLibraryCounts(map);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { category: tab };
    if (search) params.search = search;
    if (difficulty) params.difficulty = difficulty;
    api.songs
      .list(params)
      .then(setSongs)
      .finally(() => setLoading(false));
  }, [tab, search, difficulty]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Play / Learn</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-accent text-white' : 'bg-surface-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {libraryCounts[t.key] !== undefined && <span className="ml-2 text-xs opacity-70">{libraryCounts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or composer…"
          className="flex-1 bg-surface-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-accent"
        />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-surface-800 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="early_intermediate">Early intermediate</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading songs…</p>
      ) : songs.length === 0 ? (
        <NoSongsState tab={tab} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {songs.map((song) => (
            <Link
              key={song._id}
              to={`/songs/${song._id}`}
              className="bg-surface-900 border border-surface-700 rounded-2xl p-5 hover:border-accent transition-colors"
            >
              <p className="font-semibold">{song.title}</p>
              <p className="text-sm text-slate-400">{song.composer}</p>
              <div className="mt-3 flex gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-700 text-slate-300 capitalize">
                  {song.difficulty.replace('_', ' ')}
                </span>
                {song.trinity?.grade && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-700 text-slate-300">Grade {song.trinity.grade}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NoSongsState({ tab }: { tab: string }) {
  return (
    <div className="bg-surface-900 border border-dashed border-surface-600 rounded-2xl p-10 text-center text-slate-400">
      <p className="font-medium text-slate-200">No songs found in this category yet.</p>
      <p className="text-sm mt-2 max-w-md mx-auto">
        Drop .mid/.midi files into <code className="bg-surface-800 px-1.5 py-0.5 rounded">/data/midi</code>
        {tab === 'trinity_gradebook' && <> under a <code className="bg-surface-800 px-1.5 py-0.5 rounded">trinity/</code> subfolder</>}
        {tab === 'my_library_seed' && <> under a <code className="bg-surface-800 px-1.5 py-0.5 rounded">my-library/</code> subfolder</>}
        {' '}and run <code className="bg-surface-800 px-1.5 py-0.5 rounded">npm run ingest:midi</code>.
      </p>
    </div>
  );
}
