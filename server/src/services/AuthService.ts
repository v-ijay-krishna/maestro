import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { AuthTokenPayload, PublicUser } from '@maestro/shared';

const SALT_ROUNDS = 12;

export class AuthService {
  async register(name: string, email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new Error('EMAIL_IN_USE');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash, role: 'student' });
    return { user: this.toPublic(user), token: this.issueToken(user) };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');
    return { user: this.toPublic(user), token: this.issueToken(user) };
  }

  issueToken(user: IUser): string {
    const payload: AuthTokenPayload = { userId: user._id.toString(), role: user.role };
    return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
  }

  toPublic(user: IUser): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
