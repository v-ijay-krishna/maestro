import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';
import { AuthTokenPayload } from '@maestro/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    req.user = authService.verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Usage: router.get('/students', requireAuth, requireRole('teacher'), ...) — ready for Phase 2 of the product (teacher mode). */
export function requireRole(...roles: Array<'student' | 'teacher' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
