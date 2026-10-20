import { Song } from '../models/Song';
import { SongVersion } from '../models/SongVersion';
import { MIDIData } from '../models/MIDIData';
import { FavoriteSong } from '../models';
import { Types } from 'mongoose';

export interface SongListFilters {
  category?: string;
  difficulty?: string;
  composer?: string;
  search?: string;
}

export class SongService {
  async list(filters: SongListFilters) {
    const query: Record<string, unknown> = {};
    if (filters.category) query.category = filters.category;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.composer) query.composer = new RegExp(filters.composer, 'i');
    if (filters.search) query.$text = { $search: filters.search };

    return Song.find(query).sort({ title: 1 }).lean();
  }

  async getById(id: string) {
    const song = await Song.findById(id).lean();
    if (!song) return null;
    const versions = await SongVersion.find({ songId: id }).lean();
    return { ...song, versions };
  }

  /** Returns the normalized MIDI payload for a version (or the song's default version). */
  async getNormalizedMidi(songId: string, versionId?: string) {
    let version;
    if (versionId) {
      version = await SongVersion.findOne({ _id: versionId, songId });
    } else {
      const song = await Song.findById(songId);
      if (!song?.defaultVersionId) return null;
      version = await SongVersion.findById(song.defaultVersionId);
    }
    if (!version) return null;
    const midiData = await MIDIData.findById(version.midiDataId).lean();
    if (!midiData) return null;
    return { version, midiData };
  }

  async favorite(userId: string, songId: string) {
    await FavoriteSong.updateOne(
      { userId: new Types.ObjectId(userId), songId: new Types.ObjectId(songId) },
      { $setOnInsert: { userId, songId } },
      { upsert: true }
    );
  }

  async unfavorite(userId: string, songId: string) {
    await FavoriteSong.deleteOne({ userId, songId });
  }

  async listFavorites(userId: string) {
    const favorites = await FavoriteSong.find({ userId }).lean();
    const songIds = favorites.map((f) => f.songId);
    return Song.find({ _id: { $in: songIds } }).lean();
  }
}

export const songService = new SongService();
