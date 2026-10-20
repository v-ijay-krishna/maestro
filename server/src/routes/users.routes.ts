import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { authService } from '../services/AuthService';

const router = Router();

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(authService.toPublic(user));
  } catch (err) {
    next(err);
  }
});

export default router;
