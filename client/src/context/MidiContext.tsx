import React, { createContext, useContext } from 'react';
import { useMidi, UseMidiResult } from '../hooks/useMidi';

const MidiContext = createContext<UseMidiResult | undefined>(undefined);

export function MidiProvider({ children }: { children: React.ReactNode }) {
  const midi = useMidi();
  return <MidiContext.Provider value={midi}>{children}</MidiContext.Provider>;
}

export function useMidiContext(): UseMidiResult {
  const ctx = useContext(MidiContext);
  if (!ctx) throw new Error('useMidiContext must be used within MidiProvider');
  return ctx;
}
