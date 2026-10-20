import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  const known: Record<string, number> = {
    EMAIL_IN_USE: 409,
    INVALID_CREDENTIALS: 401,
    NOT_FOUND: 404,
  };
  const status = known[message] ?? 500;
  if (status === 500) {
    console.error('[error]', err);
  }
  res.status(status).json({ error: status === 500 ? 'Internal server error' : message });
}
