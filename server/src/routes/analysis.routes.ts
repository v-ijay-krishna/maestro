import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { dashboardService } from '../services/DashboardService';

const router = Router();
router.use(requireAuth);

// GET /api/analysis/dashboard -> everything the Dashboard page needs in one call
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await dashboardService.getSummary(req.user!.userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
