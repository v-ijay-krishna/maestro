import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errors';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import songRoutes from './routes/songs.routes';
import performanceRoutes from './routes/performances.routes';
import progressRoutes from './routes/progress.routes';
import libraryRoutes from './routes/library.routes';
import analysisRoutes from './routes/analysis.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' })); // performance submissions can carry thousands of events

  // Generous but present — protects auth endpoints from brute force without
  // throttling legitimate MIDI-heavy usage of other routes.
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
  );

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/songs', songRoutes);
  app.use('/api/performances', performanceRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/library', libraryRoutes);
  app.use('/api/analysis', analysisRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
