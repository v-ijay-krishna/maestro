import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { LearningProgress } from '../models';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await LearningProgress.find({ userId: req.user!.userId })
      .sort({ lastPracticedAt: -1 })
      .populate('songId', 'title composer difficulty')
      .lean();
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

router.get('/:songId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await LearningProgress.findOne({ userId: req.user!.userId, songId: req.params.songId }).lean();
    if (!progress) return res.status(404).json({ error: 'No progress recorded for this song yet' });
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

export default router;
