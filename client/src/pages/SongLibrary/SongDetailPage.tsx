import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api/client';

export function SongDetailPage() {
  const { id } = useParams();
  const [song, setSong] = useState<any>(null);

  useEffect(() => {
    if (id) api.songs.getById(id).then(setSong);
  }, [id]);

  if (!song) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <Link to="/library" className="text-xs text-slate-400 hover:text-white">
        ← Back to library
      </Link>
      <h1 className="text-3xl font-bold mt-3">{song.title}</h1>
      <p className="text-slate-400 mt-1">{song.composer}</p>
      <div className="flex gap-2 mt-4">
        <span className="text-xs px-2 py-1 rounded-full bg-surface-700 capitalize">{song.difficulty.replace('_', ' ')}</span>
        {song.trinity?.grade && <span className="text-xs px-2 py-1 rounded-full bg-surface-700">Trinity Grade {song.trinity.grade}</span>}
      </div>
      {song.description && <p className="text-slate-300 mt-4">{song.description}</p>}

      {song.versions?.length === 0 ? (
        <p className="mt-6 text-sm text-key-wrong">
          This song has a catalog entry but no ingested MIDI data yet. Re-run <code>npm run ingest:midi</code>.
        </p>
      ) : (
        <div className="flex gap-3 mt-8">
          <Link to={`/learn/${song._id}`} className="px-5 py-2.5 bg-accent rounded-xl text-sm font-semibold">
            Learn
          </Link>
          <Link to={`/test/${song._id}`} className="px-5 py-2.5 bg-surface-800 rounded-xl text-sm font-semibold">
            Test
          </Link>
        </div>
      )}
    </div>
  );
}
