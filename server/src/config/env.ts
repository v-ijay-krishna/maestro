import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/maestro'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  midiDir: process.env.MIDI_DIR ?? '../data/midi',
  /** Future ML service — unset by default; MLScoringEngine is not wired in until this exists. */
  mlServiceUrl: process.env.ML_SERVICE_URL ?? '',
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'dev-secret-change-me-in-production') {
  throw new Error('JWT_SECRET must be set to a real secret in production');
}
