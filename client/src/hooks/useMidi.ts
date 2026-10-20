import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiDeviceInfo, MidiEvent } from '@maestro/shared';
import { midiEngine } from '../services/midi/MidiEngine';
import { midiEventStream } from '../services/midi/MidiEventStream';

export interface UseMidiResult {
  supported: boolean;
  initialized: boolean;
  error: string | null;
  devices: MidiDeviceInfo[];
  connectedDevice: MidiDeviceInfo | null;
  requestAccess: () => Promise<void>;
  connect: (deviceId: string) => void;
  disconnect: () => void;
  /** Note numbers currently held down, for lighting up the virtual piano. */
  activeNotes: number[];
  lastEvent: MidiEvent | null;
}

export function useMidi(): UseMidiResult {
  const [supported] = useState(() => midiEngine.isSupported());
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<MidiDeviceInfo | null>(null);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
  const unsubscribeDeviceList = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = midiEventStream.subscribe((event) => {
      setLastEvent(event);
      if (event.type === 'noteOn' || event.type === 'noteOff') {
        setActiveNotes(midiEventStream.getHeldNotes());
      }
    });
    return unsub;
  }, []);

  const requestAccess = useCallback(async () => {
    try {
      await midiEngine.init();
      setInitialized(true);
      setError(null);
      setDevices(midiEngine.listDevices());
      unsubscribeDeviceList.current = midiEngine.onDeviceListChange(setDevices);
    } catch (err: any) {
      setError(err?.message === 'WEB_MIDI_UNSUPPORTED' ? 'This browser does not support Web MIDI. Try Chrome or Edge.' : 'Could not access MIDI devices.');
    }
  }, []);

  const connect = useCallback((deviceId: string) => {
    const ok = midiEngine.connect(deviceId);
    if (ok) setConnectedDevice(midiEngine.getActiveDevice());
  }, []);

  const disconnect = useCallback(() => {
    midiEngine.disconnect();
    setConnectedDevice(null);
    setActiveNotes([]);
  }, []);

  useEffect(() => () => unsubscribeDeviceList.current?.(), []);

  return { supported, initialized, error, devices, connectedDevice, requestAccess, connect, disconnect, activeNotes, lastEvent };
}
