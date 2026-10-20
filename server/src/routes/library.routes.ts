import { Router, Request, Response, NextFunction } from 'express';
import { Song } from '../models/Song';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await Song.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    res.json({
      categories: [
        { key: 'open_library', label: 'Open Library', count: counts.find((c) => c._id === 'open_library')?.count ?? 0 },
        { key: 'trinity_gradebook', label: 'Trinity Gradebook', count: counts.find((c) => c._id === 'trinity_gradebook')?.count ?? 0 },
        { key: 'my_library_seed', label: 'My Library', count: counts.find((c) => c._id === 'my_library_seed')?.count ?? 0 },
      ],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
