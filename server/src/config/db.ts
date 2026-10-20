import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected -> ${env.mongoUri}`);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
