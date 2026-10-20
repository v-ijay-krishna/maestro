import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MidiStatusIndicator } from '../components/midi/MidiStatusIndicator';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/library', label: 'Play / Learn' },
  { to: '/test', label: 'Test' },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-700 bg-surface-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-lg font-extrabold tracking-tight">
              MAESTRO<span className="text-accent">.</span>
            </span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-surface-800 text-white' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <MidiStatusIndicator />
            {user ? (
              <button onClick={logout} className="text-sm text-slate-400 hover:text-white">
                {user.name} · Sign out
              </button>
            ) : (
              <NavLink to="/auth" className="text-sm text-accent-soft">
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
