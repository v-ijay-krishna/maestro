import React, { useState } from 'react';
import { useMidiContext } from '../../context/MidiContext';

export function MidiStatusIndicator() {
  const { supported, initialized, error, devices, connectedDevice, requestAccess, connect, disconnect } = useMidiContext();
  const [open, setOpen] = useState(false);

  if (!supported) {
    return <span className="text-xs text-key.wrong px-3 py-1.5 rounded-full bg-surface-800">Web MIDI unsupported</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!initialized) requestAccess();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 hover:bg-surface-700 transition-colors text-xs font-medium"
      >
        <span className={connectedDevice ? 'text-key-correct' : 'text-slate-500'}>{connectedDevice ? '●' : '○'}</span>
        <span>{connectedDevice ? `MIDI Connected — ${connectedDevice.name}` : 'MIDI Not Connected'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-800 border border-surface-600 rounded-xl shadow-xl p-3 z-50">
          {error && <p className="text-key-wrong text-xs mb-2">{error}</p>}
          {!initialized && !error && (
            <p className="text-slate-400 text-xs mb-2">Click again to grant MIDI access, then select your keyboard below.</p>
          )}
          {initialized && devices.length === 0 && (
            <p className="text-slate-400 text-xs">No MIDI input devices found. Connect your keyboard via USB.</p>
          )}
          <ul className="space-y-1 max-h-52 overflow-y-auto">
            {devices.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => connect(d.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm ${
                    connectedDevice?.id === d.id ? 'bg-accent/20 text-accent-soft' : 'hover:bg-surface-700'
                  }`}
                >
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
          {connectedDevice && (
            <button onClick={disconnect} className="mt-2 text-xs text-slate-400 hover:text-key-wrong">
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
