export type UserRole = 'student' | 'teacher' | 'admin';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
}
