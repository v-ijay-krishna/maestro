import { Router, Request, Response, NextFunction } from 'express';
import { songService } from '../services/SongService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/songs?category=open_library&difficulty=intermediate&composer=beethoven&search=elise
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const songs = await songService.list({
      category: req.query.category as string | undefined,
      difficulty: req.query.difficulty as string | undefined,
      composer: req.query.composer as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(songs);
  } catch (err) {
    next(err);
  }
});

router.get('/favorites', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const songs = await songService.listFavorites(req.user!.userId);
    res.json(songs);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const song = await songService.getById(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (err) {
    next(err);
  }
});

// GET /api/songs/:id/midi?versionId=... -> normalized note/bar/tempo data for playback + learning + test reference
router.get('/:id/midi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await songService.getNormalizedMidi(req.params.id, req.query.versionId as string | undefined);
    if (!result) return res.status(404).json({ error: 'No MIDI data available for this song' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/favorite', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await songService.favorite(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/favorite', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await songService.unfavorite(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
