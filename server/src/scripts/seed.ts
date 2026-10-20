import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { authService } from '../services/AuthService';

async function main() {
  await connectDB();

  const email = 'demo@maestro.app';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('[seed] demo user already exists:', email);
  } else {
    await authService.register('Demo Student', email, 'password123');
    console.log('[seed] created demo user -> email: demo@maestro.app / password: password123');
  }

  await disconnectDB();
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
