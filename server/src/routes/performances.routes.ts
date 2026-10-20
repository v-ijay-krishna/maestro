import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { performanceService } from '../services/PerformanceService';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const submitSchema = z.object({
  config: z.object({
    songId: z.string(),
    songVersionId: z.string(),
    mode: z.enum(['learn', 'test']),
    startBar: z.number().int().positive(),
    endBar: z.number().int().positive(),
    tempoBpm: z.number().positive(),
    metronomeEnabled: z.boolean(),
    countInBars: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    hands: z.enum(['both', 'left', 'right']),
  }),
  events: z.array(
    z.object({
      type: z.enum(['noteOn', 'noteOff']),
      note: z.number().int().min(0).max(127),
      velocity: z.number().int().min(0).max(127),
      channel: z.number().int().min(0).max(15),
      timestamp: z.number(),
      duration: z.number().optional(),
      bar: z.number().optional(),
      beat: z.number().optional(),
    })
  ),
  durationSeconds: z.number().nonnegative(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = submitSchema.parse(req.body);
    const performance = await performanceService.submitPerformance(req.user!.userId, body.config, body.events, body.durationSeconds);
    res.status(201).json(performance);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const performances = await performanceService.listForUser(req.user!.userId, Number(req.query.limit) || 20);
    res.json(performances);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await performanceService.getById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Performance not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
