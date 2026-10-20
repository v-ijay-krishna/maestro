import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@maestro.app');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 bg-surface-900 border border-surface-700 rounded-2xl p-8">
      <h1 className="text-xl font-bold mb-1">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <p className="text-sm text-slate-400 mb-6">Seeded demo account: demo@maestro.app / password123</p>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full bg-surface-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-accent" />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full bg-surface-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-accent" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full bg-surface-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-accent" />
        {error && <p className="text-key-wrong text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-accent hover:bg-accent/90 rounded-lg py-2 text-sm font-semibold">
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-xs text-slate-400 mt-4 hover:text-white">
        {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
